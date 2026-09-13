import { zeros, solveLinear } from './matrix.js';

const EPS=1e-14;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sign=v=>v<0?-1:1;
const maxAbs=a=>Math.max(0,...a.map(v=>Math.abs(v)));

export const DEFAULT_ANCHOR_PULLOUT={
  embedment:0.12,diameter:0.012,E:200e6,fy:500e3,segments:40,
  tauMax:6000,s1:0.0005,s2:0.0015,sf:0.006,residualRatio:0.15,
  headEnabled:false,headStiffness:2e6,headCapacity:0,
  displacementMax:0.01,steps:80,maxIterations:60,relativeTolerance:1e-8,absoluteTolerance:1e-8
};

export function normalizeAnchorPulloutConfig(input={}){
  const c={...DEFAULT_ANCHOR_PULLOUT,...input},embedment=Math.max(1e-5,finite(c.embedment,DEFAULT_ANCHOR_PULLOUT.embedment)),diameter=Math.max(1e-5,finite(c.diameter,DEFAULT_ANCHOR_PULLOUT.diameter)),E=Math.max(1,finite(c.E,DEFAULT_ANCHOR_PULLOUT.E)),segments=Math.max(2,Math.min(300,Math.round(finite(c.segments,DEFAULT_ANCHOR_PULLOUT.segments)))),tauMax=Math.max(0,finite(c.tauMax,DEFAULT_ANCHOR_PULLOUT.tauMax)),s1=Math.max(1e-9,finite(c.s1,DEFAULT_ANCHOR_PULLOUT.s1)),s2=Math.max(s1,finite(c.s2,DEFAULT_ANCHOR_PULLOUT.s2)),sf=Math.max(s2+1e-9,finite(c.sf,DEFAULT_ANCHOR_PULLOUT.sf));
  return{...c,embedment,diameter,E,fy:Math.max(0,finite(c.fy,0)),segments,tauMax,s1,s2,sf,residualRatio:clamp(finite(c.residualRatio,.15),0,1),headEnabled:Boolean(c.headEnabled),headStiffness:Math.max(0,finite(c.headStiffness,0)),headCapacity:Math.max(0,finite(c.headCapacity,0)),displacementMax:Math.max(0,finite(c.displacementMax,.01)),steps:Math.max(1,Math.min(500,Math.round(finite(c.steps,80)))),maxIterations:Math.max(5,Math.min(200,Math.round(finite(c.maxIterations,60)))),relativeTolerance:Math.max(1e-12,finite(c.relativeTolerance,1e-8)),absoluteTolerance:Math.max(1e-12,finite(c.absoluteTolerance,1e-8))};
}

/** Monotonic local bond-slip law. tau is kN/m² and slip is m. */
export function anchorBondLaw(slip,input={}){
  const c=normalizeAnchorPulloutConfig(input),a=Math.abs(finite(slip)),sgn=slip===0?1:sign(slip),tauResidual=c.tauMax*c.residualRatio;let tauAbs=0,tangent=0,branch='elastic';
  if(a<=c.s1){tauAbs=c.tauMax*a/c.s1;tangent=c.tauMax/c.s1;branch='ascending'}
  else if(a<=c.s2){tauAbs=c.tauMax;tangent=0;branch='plateau'}
  else if(a<=c.sf){const q=(a-c.s2)/(c.sf-c.s2);tauAbs=c.tauMax+(tauResidual-c.tauMax)*q;tangent=(tauResidual-c.tauMax)/(c.sf-c.s2);branch='softening'}
  else{tauAbs=tauResidual;tangent=0;branch='residual'}
  return{tau:sgn*tauAbs,tangent,branch,tauAbs};
}

export function anchorHeadLaw(slip,input={}){
  const c=normalizeAnchorPulloutConfig(input);if(!c.headEnabled||!(c.headStiffness>0)||!(c.headCapacity>0))return{force:0,tangent:0,branch:'disabled'};const a=Math.abs(finite(slip)),sgn=slip===0?1:sign(slip),trial=c.headStiffness*a;if(trial<c.headCapacity)return{force:sgn*trial,tangent:c.headStiffness,branch:'elastic'};return{force:sgn*c.headCapacity,tangent:0,branch:'capacity'};
}

function assemble(c,u){
  const n=c.segments+1,L=c.embedment,le=L/c.segments,A=Math.PI*c.diameter*c.diameter/4,perimeter=Math.PI*c.diameter,kbar=c.E*A/le,f=Array(n).fill(0),K=zeros(n),bond=[];
  for(let e=0;e<c.segments;e++){const i=e,j=e+1,d=u[i]-u[j],q=kbar*d;f[i]+=q;f[j]-=q;K[i][i]+=kbar;K[i][j]-=kbar;K[j][i]-=kbar;K[j][j]+=kbar}
  for(let i=0;i<n;i++){const tributary=(i===0||i===n-1)?le/2:le,b=anchorBondLaw(u[i],c),factor=perimeter*tributary;f[i]+=factor*b.tau;K[i][i]+=factor*b.tangent;bond.push({...b,tributary,force:factor*b.tau})}
  const head=anchorHeadLaw(u[n-1],c);f[n-1]+=head.force;K[n-1][n-1]+=head.tangent;
  const barForces=Array.from({length:c.segments},(_,e)=>kbar*(u[e]-u[e+1])),barStress=barForces.map(q=>q/A);
  return{f,K,bond,head,barForces,barStress,A,perimeter,le,kbar};
}

function residualNorm(a){return Math.sqrt(a.reduce((s,v)=>s+v*v,0)/Math.max(1,a.length))}
function predictor(c,delta){const A=Math.PI*c.diameter*c.diameter/4,p=Math.PI*c.diameter,kBond=p*c.tauMax/c.s1,lambda=Math.sqrt(Math.max(0,kBond/(c.E*A))),L=c.embedment,n=c.segments+1;if(!(lambda>EPS))return Array(n).fill(delta);const den=Math.cosh(Math.min(30,lambda*L));return Array.from({length:n},(_,i)=>{const x=L*i/c.segments;return delta*Math.cosh(Math.min(30,lambda*(L-x)))/den})}

export function solveAnchorPulloutAtDisplacement(input={},targetDisplacement=0,initial=null){
  const c=normalizeAnchorPulloutConfig(input),n=c.segments+1,delta=Math.max(0,finite(targetDisplacement)),u=Array.isArray(initial)&&initial.length===n?[...initial]:predictor(c,delta);u[0]=delta;const capacityScale=Math.max(1,c.tauMax*Math.PI*c.diameter*c.embedment+(c.headEnabled?c.headCapacity:0)),tol=Math.max(c.absoluteTolerance,c.relativeTolerance*capacityScale);let state=assemble(c,u),converged=false,iterations=0,lastNorm=Infinity;
  for(let iter=0;iter<c.maxIterations;iter++){iterations=iter+1;const r=state.f.slice(1),rn=residualNorm(r);lastNorm=rn;if(rn<=tol){converged=true;break}const Kff=state.K.slice(1).map(row=>row.slice(1));let du;try{du=solveLinear(Kff,r.map(v=>-v))}catch(err){return{converged:false,iterations,residualNorm:rn,error:err?.message||String(err),u,state,config:c}}
    let alpha=1,best=null,bestNorm=rn;for(let ls=0;ls<12;ls++){const trial=[delta,...u.slice(1).map((v,i)=>v+alpha*du[i])],s=assemble(c,trial),q=residualNorm(s.f.slice(1));if(q<bestNorm){best={u:trial,state:s};bestNorm=q}if(q<=rn*(1-1e-4*alpha)||q<=tol)break;alpha*=.5}
    if(best){for(let i=0;i<n;i++)u[i]=best.u[i];state=best.state}else{for(let i=1;i<n;i++)u[i]+=du[i]*.0625;u[0]=delta;state=assemble(c,u)}
  }
  if(!converged){lastNorm=residualNorm(state.f.slice(1));converged=lastNorm<=tol}
  return{converged,iterations,residualNorm:lastNorm,u:[...u],state,config:c};
}

function profile(c,u,state){const out=[];for(let i=0;i<u.length;i++){const axial=i<state.barForces.length?state.barForces[i]:(state.barForces.at(-1)||0),stress=i<state.barStress.length?state.barStress[i]:(state.barStress.at(-1)||0);out.push({node:i,depth:c.embedment*i/c.segments,slip:u[i],bondStress:state.bond[i]?.tau||0,bondStressMPa:(state.bond[i]?.tau||0)/1000,bondForce:state.bond[i]?.force||0,barForce:axial,steelStress:stress,steelStressMPa:stress/1000})}return out}
function curvePoint(c,delta,sol){const s=sol.state,maxBond=Math.max(0,...s.bond.map(x=>Math.abs(x.tau))),maxSteel=Math.max(0,...s.barStress.map(Math.abs));return{displacement:delta,displacementMm:delta*1000,load:s.f[0],maxBondStress:maxBond,maxBondStressMPa:maxBond/1000,headForce:s.head.force,maxSteelStress:maxSteel,maxSteelStressMPa:maxSteel/1000,steelYieldRatio:c.fy>0?maxSteel/c.fy:0,iterations:sol.iterations,residualNorm:sol.residualNorm,converged:sol.converged}}

/**
 * Displacement-controlled monotonic pull-out analysis of a 1D axial anchor bar
 * coupled to fixed concrete through distributed nonlinear bond-slip springs.
 * The formulation can follow descending bond branches without force-control
 * snap-through. It is a mechanics Lab model, not a code-design resistance check.
 */
export function solveBondedAnchorPullout(input={}){
  const c=normalizeAnchorPulloutConfig(input),curve=[],states=[];let previous=null,failedAt=null;
  for(let step=0;step<=c.steps;step++){const delta=c.displacementMax*step/c.steps,guess=previous&&step>0?previous.map(v=>v*(delta/Math.max(EPS,c.displacementMax*(step-1)/c.steps))):null,sol=solveAnchorPulloutAtDisplacement(c,delta,guess);const point=curvePoint(c,delta,sol);curve.push(point);states.push(sol);if(!sol.converged){failedAt=step;break}previous=sol.u}
  let peakIndex=0;for(let i=1;i<curve.length;i++)if(curve[i].load>curve[peakIndex].load)peakIndex=i;const finalIndex=curve.length-1,peak=curve[peakIndex],final=curve[finalIndex],peakState=states[peakIndex],finalState=states[finalIndex],yielded=curve.some(x=>x.steelYieldRatio>=1),headCapacityReached=c.headEnabled&&c.headCapacity>0&&curve.some(x=>Math.abs(x.headForce)>=c.headCapacity*(1-1e-6)),postPeakDrop=final&&peak&&peak.load>EPS?Math.max(0,(peak.load-final.load)/peak.load):0;
  let governing='bond-response';if(yielded)governing='steel-yield';else if(headCapacityReached&&Math.abs(peak.headForce)>0.5*Math.abs(peak.load))governing='head-capacity';else if(postPeakDrop>.05)governing='bond-pullout-softening';
  const work=curve.slice(1).reduce((sum,p,i)=>sum+.5*(curve[i].load+p.load)*(p.displacement-curve[i].displacement),0);
  return{type:'anchor-pullout-1d',solverVersion:'0.30.0',control:'displacement',config:c,curve,peak:{index:peakIndex,...peak},final:{index:finalIndex,...final},profiles:{peak:peakState?profile(c,peakState.u,peakState.state):[],final:finalState?profile(c,finalState.u,finalState.state):[]},diagnostics:{governing,yielded,headCapacityReached,postPeakDrop,work,failedAt,converged:failedAt==null},assumptions:['Barra axial 1D com concreto de referência fixo.','Aderência distribuída monotônica τ–s; sem histerese de descarregamento nesta versão.','Controle de deslocamento no extremo carregado para rastrear o ramo pós-pico.','Não substitui verificação normativa de cone de concreto, pry-out ou ruptura de borda.']};
}
