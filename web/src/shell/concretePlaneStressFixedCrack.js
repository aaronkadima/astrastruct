import {concreteDamageState,concreteCrackBandParameters,initialConcreteDamageState} from '../rc/concreteDamage1d.js';

export const SHELL_CONCRETE_PLANE_STRESS_CONTRACT='shell-concrete-plane-stress/v1';
const EPS=1e-14;
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`ShellConcrete: ${name} deve ser finito.`);return n};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

export function initialShellConcreteState(){return{orientationAngle:null,dir1:initialConcreteDamageState(),dir2:initialConcreteDamageState(),cracked:false,crushed:false,lastStrain:[0,0,0],lastStress:[0,0,0],shearRetention:1,aggregateInterlockActive:false}}

function elasticD(E,nu){const c=E/(1-nu*nu);return[[c,c*nu,0],[c*nu,c,0],[0,0,E/(2*(1+nu))]]}
function matVec(A,x){return A.map(r=>dot(r,x))}
function principal(strain){const [ex,ey,gxy]=strain,avg=.5*(ex+ey),r=Math.hypot(.5*(ex-ey),.5*gxy),e1=avg+r,e2=avg-r,angle=.5*Math.atan2(gxy,ex-ey);return{e1,e2,angle}}
function strainLocal(strain,theta){const[ex,ey,g]=strain,c=Math.cos(theta),s=Math.sin(theta),c2=c*c,s2=s*s,cs=c*s;return[c2*ex+s2*ey+cs*g,s2*ex+c2*ey-cs*g,2*cs*(ey-ex)+(c2-s2)*g]}
function stressGlobal(local,theta){const[sn,st,tau]=local,c=Math.cos(theta),s=Math.sin(theta),c2=c*c,s2=s*s,cs=c*s;return[c2*sn+s2*st-2*cs*tau,s2*sn+c2*st+2*cs*tau,cs*(sn-st)+(c2-s2)*tau]}
function triggerOrientation(strain,p){const q=principal(strain);if(q.e1>p.epsCr+EPS||q.e2<-p.epsc0-EPS)return q.angle;return null}

function core({strain,material,committed,characteristicLength,fractureEnergy,compressionFractureEnergy,epsc0=.002,epscu=.0035,shearRetentionMin=.05,shearRetentionExponent=1.5,aggregateInterlockMu=.6,aggregateInterlockCohesion=0}={}){
  const e=Array.from(strain||[],Number);if(e.length!==3||e.some(v=>!Number.isFinite(v)))throw new Error('ShellConcrete: strain deve ser [ex,ey,gxy].');
  if(!material)throw new Error('ShellConcrete: material ausente.');const E=finite('E',material.E),nu=finite('nu',material.nu??.2);if(!(E>0&&nu>-.99&&nu<.4999))throw new Error('ShellConcrete: E/nu inválidos.');
  const p=concreteCrackBandParameters({material,characteristicLength,fractureEnergy:fractureEnergy??material.Gf??material.fractureEnergy,compressionFractureEnergy:compressionFractureEnergy??material.Gc??material.compressionFractureEnergy,epsc0,epscu}),c={...initialShellConcreteState(),...(committed||{})};
  let theta=Number.isFinite(Number(c.orientationAngle))?Number(c.orientationAngle):null;
  if(theta==null)theta=triggerOrientation(e,p);
  if(theta==null){const D=elasticD(E,nu),stress=matVec(D,e),history={...clone(c),orientationAngle:null,lastStrain:[...e],lastStress:[...stress],shearRetention:1,aggregateInterlockActive:false};return{contract:SHELL_CONCRETE_PLANE_STRESS_CONTRACT,strain:e,stress,tangent:D,branch:'uncracked-elastic',cracked:false,crushed:false,crackAngle:null,shearRetention:1,aggregateInterlockActive:false,history,local:null}}
  const el=strainLocal(e,theta),o={characteristicLength,fractureEnergy:fractureEnergy??material.Gf??material.fractureEnergy,compressionFractureEnergy:compressionFractureEnergy??material.Gc??material.compressionFractureEnergy,epsc0,epscu},s1=concreteDamageState({strain:el[0],material,committed:c.dir1,...o}),s2=concreteDamageState({strain:el[1],material,committed:c.dir2,...o}),d=Math.max(Number(s1.tensionDamage)||0,Number(s2.tensionDamage)||0),betaMin=clamp(Number(shearRetentionMin)||0,0,1),beta=betaMin+(1-betaMin)*(1-d)**Math.max(.1,Number(shearRetentionExponent)||1.5),G=E/(2*(1+nu));let tau=beta*G*el[2],interlock=false;
  const compression=Math.max(0,-Math.min(s1.stress,s2.stress)),cap=Math.max(0,Number(aggregateInterlockCohesion)||0)+Math.max(0,Number(aggregateInterlockMu)||0)*compression;
  if(cap>0&&Math.abs(tau)>cap){tau=Math.sign(tau||1)*cap;interlock=true}
  const localStress=[s1.stress,s2.stress,tau],stress=stressGlobal(localStress,theta),history={orientationAngle:theta,dir1:clone(s1.history),dir2:clone(s2.history),cracked:!!(s1.cracked||s2.cracked),crushed:!!(s1.crushed||s2.crushed),lastStrain:[...e],lastStress:[...stress],shearRetention:beta,aggregateInterlockActive:interlock};
  return{contract:SHELL_CONCRETE_PLANE_STRESS_CONTRACT,strain:e,stress,branch:'fixed-crack-orthotropic',cracked:history.cracked,crushed:history.crushed,crackAngle:theta,shearRetention:beta,aggregateInterlockActive:interlock,history,local:{strain:el,stress:localStress,dir1:s1,dir2:s2,aggregateInterlockCap:cap}};
}

export function concretePlaneStressFixedCrackState(args={}){
  const base=core(args);if(base.tangent)return base;const e=[...base.strain],h0=Math.max(1e-10,Number(args.finiteDifferenceStep)||1e-8),D=Array.from({length:3},()=>Array(3).fill(0));
  for(let j=0;j<3;j++){const h=h0*Math.max(1,Math.abs(e[j])*1e3),ep=[...e],em=[...e];ep[j]+=h;em[j]-=h;const sp=core({...args,strain:ep}).stress,sm=core({...args,strain:em}).stress;for(let i=0;i<3;i++)D[i][j]=(sp[i]-sm[i])/(2*h)}
  return{...base,tangent:D};
}
