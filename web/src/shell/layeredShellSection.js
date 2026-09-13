import {ElementStateTransaction} from '../core/elementComponent.js';
import {concretePlaneStressFixedCrackState,initialShellConcreteState} from './concretePlaneStressFixedCrack.js';
import {rebarState,initialRebarState} from '../rc/rebar1d.js';

export const LAYERED_SHELL_SECTION_CONTRACT='layered-shell-section/v1';
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`LayeredShell: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`LayeredShell: ${name} deve ser positivo.`);return n};
const zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
const addOuter=(K,a,b,scale)=>{for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)K[i][j]+=scale*a[i]*b[j]};
const addMat=(K,A,rows,cols,scale=1)=>{for(let i=0;i<rows.length;i++)for(let j=0;j<cols.length;j++)K[rows[i]][cols[j]]+=scale*A[i][j]};

function gstrain(value={}){const keys=['ex','ey','gxy','kx','ky','kxy','gxz','gyz'];if(Array.isArray(value)){if(value.length!==8)throw new Error('LayeredShell: generalizedStrain deve ter 8 valores.');return value.map((v,i)=>finite(`strain[${i}]`,v))}return keys.map(k=>finite(k,value[k]??0))}
function initialHistory(layerCount,rebarCount){return{contract:'layered-shell-history/v1',concrete:Array.from({length:layerCount},()=>initialShellConcreteState()),rebar:Array.from({length:rebarCount},()=>initialRebarState())}}
function dirVector(angle){const c=Math.cos(angle),s=Math.sin(angle);return[c*c,s*s,c*s]}

export function layeredShellSectionResponse({thickness,concreteMaterial,reinforcementLayers=[],layerCount=8,generalizedStrain={},committedHistory=null,options={}}={}){
  const t=positive('thickness',thickness),n=Math.max(2,Math.min(40,Math.round(Number(layerCount)||8))),mat=concreteMaterial;if(!mat)throw new Error('LayeredShell: concreteMaterial é obrigatório.');const e=gstrain(generalizedStrain),dz=t/n,K=zeros(8),R=Array(8).fill(0),layers=[],rebarOut=[],history=committedHistory||initialHistory(n,reinforcementLayers.length),trialConcrete=[],trialRebar=[];let crackedLayers=0,crushedLayers=0,interlockLayers=0,betaSum=0;
  for(let i=0;i<n;i++){
    const z=-t/2+(i+.5)*dz,strain=[e[0]+z*e[3],e[1]+z*e[4],e[2]+z*e[5]],state=concretePlaneStressFixedCrackState({strain,material:mat,committed:history.concrete?.[i],characteristicLength:options.characteristicLength,fractureEnergy:options.fractureEnergy??mat.Gf??mat.fractureEnergy,compressionFractureEnergy:options.compressionFractureEnergy??mat.Gc??mat.compressionFractureEnergy,epsc0:options.epsc0,epscu:options.epscu,shearRetentionMin:options.shearRetentionMin,shearRetentionExponent:options.shearRetentionExponent,aggregateInterlockMu:options.aggregateInterlockMu,aggregateInterlockCohesion:options.aggregateInterlockCohesion,finiteDifferenceStep:options.finiteDifferenceStep}),s=state.stress,D=state.tangent;
    for(let a=0;a<3;a++){R[a]+=s[a]*dz;R[3+a]+=s[a]*z*dz}
    const Bz=[[1,0,0,z,0,0],[0,1,0,0,z,0],[0,0,1,0,0,z]];for(let a=0;a<6;a++)for(let b=0;b<6;b++){let v=0;for(let p=0;p<3;p++)for(let q=0;q<3;q++)v+=Bz[p][a]*D[p][q]*Bz[q][b];K[a][b]+=v*dz}
    trialConcrete.push(clone(state.history));layers.push({index:i,z,strain,stress:s,tangent:D,cracked:state.cracked,crushed:state.crushed,crackAngle:state.crackAngle,shearRetention:state.shearRetention,aggregateInterlockActive:state.aggregateInterlockActive,branch:state.branch});if(state.cracked)crackedLayers++;if(state.crushed)crushedLayers++;if(state.aggregateInterlockActive)interlockLayers++;betaSum+=state.shearRetention;
  }
  reinforcementLayers.forEach((row,index)=>{
    const z=finite(`rebar[${index}].z`,row.z),area=positive(`rebar[${index}].areaPerWidth`,row.areaPerWidth),angle=(Number(row.angleDeg??0))*Math.PI/180,a=dirVector(angle),eps=a[0]*(e[0]+z*e[3])+a[1]*(e[1]+z*e[4])+a[2]*(e[2]+z*e[5]),material=row.material;if(!material)throw new Error(`LayeredShell: rebar[${index}].material é obrigatório.`);const state=rebarState({strain:eps,material,committed:history.rebar?.[index],hardeningRatio:row.hardeningRatio??options.rebarHardeningRatio??.01,kinematicFraction:row.kinematicFraction??options.rebarKinematicFraction??1}),N=state.stress*area,Et=state.tangent*area,b=[a[0],a[1],a[2],z*a[0],z*a[1],z*a[2]];for(let j=0;j<6;j++)R[j]+=N*b[j];addOuter(K,b,b,Et);trialRebar.push(clone(state.history));rebarOut.push({index,z,angleDeg:Number(row.angleDeg??0),strain:eps,stress:state.stress,forcePerWidth:N,tangentPerWidth:Et,yielded:state.yielded,branch:state.branch})
  });
  const E=positive('concrete E',mat.E),nu=finite('concrete nu',mat.nu??.2),G=E/(2*(1+nu)),beta=n?betaSum/n:1,ks=Math.max(.01,Number(options.shearCorrection)||5/6),shear=ks*G*t*beta;R[6]=shear*e[6];R[7]=shear*e[7];K[6][6]=shear;K[7][7]=shear;
  return{contract:LAYERED_SHELL_SECTION_CONTRACT,generalizedStrain:{ex:e[0],ey:e[1],gxy:e[2],kx:e[3],ky:e[4],kxy:e[5],gxz:e[6],gyz:e[7]},resultants:{Nx:R[0],Ny:R[1],Nxy:R[2],Mx:R[3],My:R[4],Mxy:R[5],Qx:R[6],Qy:R[7]},resultantVector:R,tangent:K,layers,reinforcementLayers:rebarOut,crackedLayers,crushedLayers,aggregateInterlockLayers:interlockLayers,meanShearRetention:beta,trialHistory:{contract:'layered-shell-history/v1',concrete:trialConcrete,rebar:trialRebar}};
}

export function createLayeredShellSectionTransaction({thickness,concreteMaterial,reinforcementLayers=[],layerCount=8,options={},initialState=null}={}){
  const n=Math.max(2,Math.min(40,Math.round(Number(layerCount)||8))),tx=new ElementStateTransaction(initialState||initialHistory(n,reinforcementLayers.length));let last=null;
  return Object.freeze({contract:'layered-shell-section-transaction/v1',response:(strain)=>{last=layeredShellSectionResponse({thickness,concreteMaterial,reinforcementLayers,layerCount:n,generalizedStrain:strain,committedHistory:tx.committed(),options});tx.setTrial(last.trialHistory);return clone(last)},commit:()=>tx.commit(),rollback:()=>tx.rollback(),committedState:()=>tx.committed(),trialState:()=>tx.trial(),snapshot:()=>tx.snapshot(),lastResponse:()=>last?clone(last):null});
}
