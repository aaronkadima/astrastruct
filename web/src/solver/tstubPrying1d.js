import {zeros,solveLinear} from './matrix.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DEFAULT_TSTUB={plateE:200e6,stripWidth:.10,thickness:.012,m:.08,n:.05,boltE:200e6,boltArea:245e-6,gripLength:.06,boltYieldForce:120,boltPostYieldRatio:.02,toeContactStiffness:2e7,maxUplift:.004,steps:30,maxIterations:40,tolerance:1e-10};
function beamK(EI,L){const a=EI/(L**3),L2=L*L;return[[12*a,6*L*a,-12*a,6*L*a],[6*L*a,4*L2*a,-6*L*a,2*L2*a],[-12*a,-6*L*a,12*a,-6*L*a],[6*L*a,2*L2*a,-6*L*a,4*L2*a]]}
function add(K,ke,idx){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)K[idx[i]][idx[j]]+=ke[i][j]}
function mv(A,x){return A.map(r=>r.reduce((s,v,i)=>s+v*x[i],0))}
function boltLaw(w,c){if(!(w>0))return{force:0,tangent:0,state:'slack'};const k=c.boltE*c.boltArea/c.gripLength,fy=c.boltYieldForce;if(!(fy>0)||k*w<=fy)return{force:k*w,tangent:k,state:'bolt-elastic'};const wy=fy/k,h=c.boltPostYieldRatio;return{force:fy+h*k*(w-wy),tangent:h*k,state:h>EPS?'bolt-postyield':'bolt-capped'}}
function normalize(input={}){const c={...DEFAULT_TSTUB,...input};return{...c,plateE:Math.max(1,finite(c.plateE,200e6)),stripWidth:Math.max(.005,finite(c.stripWidth,.1)),thickness:Math.max(.001,finite(c.thickness,.012)),m:Math.max(.005,finite(c.m,.08)),n:Math.max(.005,finite(c.n,.05)),boltE:Math.max(1,finite(c.boltE,200e6)),boltArea:Math.max(1e-8,finite(c.boltArea,245e-6)),gripLength:Math.max(.002,finite(c.gripLength,.06)),boltYieldForce:Math.max(0,finite(c.boltYieldForce,120)),boltPostYieldRatio:clamp(finite(c.boltPostYieldRatio,.02),0,1),toeContactStiffness:Math.max(1,finite(c.toeContactStiffness,2e7)),maxUplift:Math.max(0,finite(c.maxUplift,.004)),steps:Math.max(1,Math.min(120,Math.round(finite(c.steps,30)))),maxIterations:Math.max(8,Math.round(finite(c.maxIterations,40))),tolerance:Math.max(1e-14,finite(c.tolerance,1e-10))}}
function baseStiffness(c){const I=c.stripWidth*c.thickness**3/12,EI=c.plateE*I,K=zeros(6);add(K,beamK(EI,c.m),[0,1,2,3]);add(K,beamK(EI,c.n),[2,3,4,5]);return{K,I,EI}}
function stateAt(c,base,u){const K=base.K.map(r=>[...r]),f=mv(base.K,u),bolt=boltLaw(u[2],c);f[2]+=bolt.force;K[2][2]+=bolt.tangent;const toeActive=u[4]<0,toeForce=toeActive?c.toeContactStiffness*u[4]:0;if(toeActive){f[4]+=toeForce;K[4][4]+=c.toeContactStiffness}return{K,f,bolt,toeActive,toeForce}}

function activeSetCandidate(c,base,uplift,boltState,toeActive){
  const K=base.K.map(r=>[...r]),constant=Array(6).fill(0),u=Array(6).fill(0),free=[2,3,4,5],prescribed=[0,1];u[0]=uplift;u[1]=0;
  const kb=c.boltE*c.boltArea/c.gripLength,fy=c.boltYieldForce,h=c.boltPostYieldRatio;
  if(boltState==='elastic')K[2][2]+=kb;
  else if(boltState==='postyield'){K[2][2]+=h*kb;constant[2]+=fy*(1-h)}
  if(toeActive)K[4][4]+=c.toeContactStiffness;
  const Kff=free.map(i=>free.map(j=>K[i][j]));
  const rhs=free.map(i=>-constant[i]-prescribed.reduce((s,j)=>s+K[i][j]*u[j],0));
  let q;try{q=solveLinear(Kff,rhs)}catch{return null}
  free.forEach((d,i)=>u[d]=q[i]);
  const wy=fy>0?fy/kb:Infinity,tol=1e-10*Math.max(1,uplift);
  const boltOk=boltState==='slack'?u[2]<=tol:boltState==='elastic'?u[2]>=-tol&&u[2]<=wy+tol:u[2]>=wy-tol;
  const toeOk=toeActive?u[4]<=tol:u[4]>=-tol;
  if(!boltOk||!toeOk)return null;
  const exact=stateAt(c,base,u),R=free.map(d=>exact.f[d]),scale=Math.max(1,exact.bolt.force,Math.abs(exact.toeForce)),norm=Math.hypot(...R)/scale;
  return{u,state:exact,norm,boltState,toeActive};
}
function solveActiveSet(c,base,uplift){
  const boltStates=c.boltYieldForce>0?['slack','elastic','postyield']:['slack','elastic'],candidates=[];
  for(const boltState of boltStates)for(const toeActive of [false,true]){const x=activeSetCandidate(c,base,uplift,boltState,toeActive);if(x)candidates.push(x)}
  if(!candidates.length)throw new Error('T-stub/prying: nenhum conjunto ativo compatível foi encontrado.');
  candidates.sort((a,b)=>a.norm-b.norm);
  return candidates[0];
}

export function solveTStubAtUplift(input={},uplift=0,initial=null){
  const c=normalize(input),base=baseStiffness(c),target=Math.max(0,finite(uplift)),sol=solveActiveSet(c,base,target),u=sol.u,state=sol.state,norm=sol.norm,converged=norm<=Math.max(c.tolerance,1e-9),reaction=state.f[0],appliedTension=Math.abs(reaction),pryingReaction=Math.max(0,-state.toeForce),boltTension=state.bolt.force;
  return{type:'tstub-prying-state',solverVersion:'0.31.0',config:c,uplift:u[0],u,converged,iterations:1,residualNorm:norm,activeSet:{bolt:sol.boltState,toe:sol.toeActive},appliedTension,boltTension,pryingReaction,pryingRatio:appliedTension>EPS?pryingReaction/appliedTension:0,toeActive:state.toeActive,boltState:state.bolt.state,plate:{I:base.I,EI:base.EI,webRotation:0,boltUplift:u[2],toeGap:u[4]},equilibrium:{vertical:appliedTension+pryingReaction-boltTension,relative:(appliedTension+pryingReaction-boltTension)/Math.max(1,appliedTension)}};
}
export function solveTStubPrying(input={}){const c=normalize(input),curve=[],states=[];for(let i=0;i<=c.steps;i++){const d=c.maxUplift*i/c.steps,sol=solveTStubAtUplift(c,d);states.push(sol);curve.push({step:i,uplift:d,upliftMm:d*1000,appliedTension:sol.appliedTension,boltTension:sol.boltTension,pryingReaction:sol.pryingReaction,pryingRatio:sol.pryingRatio,toeActive:sol.toeActive,boltState:sol.boltState,residualNorm:sol.residualNorm,converged:sol.converged});if(!sol.converged)break}const final=states.at(-1);return{type:'tstub-prying-1d',solverVersion:'0.31.0',config:c,curve,final,events:{firstPrying:curve.find(p=>p.toeActive)||null,firstBoltYield:curve.find(p=>p.boltState.includes('postyield')||p.boltState.includes('capped'))||null},assumptions:['faixa de flange modelada por viga Euler–Bernoulli de largura efetiva definida pelo usuário','junção com alma recebe uplift imposto e rotação nula','parafuso modelado por mola axial unilateral bilinear','toe modelado por contato unilateral de penalidade','estados de contato/escoamento resolvidos por enumeração ativa exata da lei linear por trechos','pequenas rotações e sem contato 3D da cabeça/porca','modelo mecânico; resistência normativa permanece externa']}}
