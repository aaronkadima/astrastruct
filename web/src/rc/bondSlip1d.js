export const RC_BOND_SLIP_1D_CONTRACT='rc-bond-slip-1d/v1';

const EPS=1e-15;
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`RCBondSlip1D: ${name} deve ser finito.`);return n};
const positive=(name,value)=>{const n=finite(name,value);if(!(n>0))throw new Error(`RCBondSlip1D: ${name} deve ser positivo.`);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function initialBondSlipState(){return{maxAbsSlip:0,lastSlip:0,lastTraction:0,loadingDirection:0,reversalCount:0,cumulativeSlip:0}}

function params(options={}){
  const tauMax=positive('tauMax',options.tauMax),s1=positive('s1',options.s1),s2=positive('s2',options.s2),s3=positive('s3',options.s3),tauResidual=Math.max(0,finite('tauResidual',options.tauResidual??0)),alpha=clamp(finite('alpha',options.alpha??1),.1,1);
  if(!(s1<=s2&&s2<s3))throw new Error('RCBondSlip1D: deve valer s1 ≤ s2 < s3.');if(tauResidual>tauMax)throw new Error('RCBondSlip1D: tauResidual não pode exceder tauMax.');return{tauMax,s1,s2,s3,tauResidual,alpha};
}
function envelope(absSlip,p){
  if(absSlip<=EPS)return{traction:0,tangent:p.alpha===1?p.tauMax/p.s1:p.tauMax*p.alpha/p.s1,branch:'origin'};
  if(absSlip<=p.s1){const r=absSlip/p.s1,traction=p.tauMax*r**p.alpha,tangent=p.tauMax*p.alpha/p.s1*Math.max(r,1e-12)**(p.alpha-1);return{traction,tangent,branch:'ascending'}}
  if(absSlip<=p.s2)return{traction:p.tauMax,tangent:0,branch:'plateau'};
  if(absSlip<=p.s3){const tangent=-(p.tauMax-p.tauResidual)/(p.s3-p.s2),traction=p.tauMax+tangent*(absSlip-p.s2);return{traction,tangent,branch:'softening'}}
  return{traction:p.tauResidual,tangent:0,branch:'residual'};
}

/** Symmetric local bond-slip envelope with secant unloading/reloading to the origin. */
export function bondSlipState({slip,committed=null,...options}={}){
  const s=finite('slip',slip),p=params(options),c={...initialBondSlipState(),...(committed||{})};for(const key of ['maxAbsSlip','lastSlip','lastTraction','loadingDirection','reversalCount','cumulativeSlip'])c[key]=finite(key,c[key]);
  const abs=Math.abs(s),direction=Math.abs(s-c.lastSlip)>EPS?(s>c.lastSlip?1:-1):c.loadingDirection,reversalCount=c.reversalCount+(c.loadingDirection&&direction&&c.loadingDirection!==direction?1:0),maxAbsSlip=Math.max(c.maxAbsSlip,abs),newMaximum=abs>=c.maxAbsSlip-EPS,sign=s<0?-1:1;let traction,tangent,branch;
  if(abs<=EPS){traction=0;const peak=envelope(Math.max(maxAbsSlip,EPS),p),secant=maxAbsSlip>EPS?peak.traction/maxAbsSlip:p.tauMax/p.s1;tangent=secant;branch=maxAbsSlip>EPS?'unloading-origin':'origin'}
  else if(newMaximum){const env=envelope(abs,p);traction=sign*env.traction;tangent=env.tangent;branch=env.branch}
  else{const envMax=envelope(maxAbsSlip,p),secant=maxAbsSlip>EPS?envMax.traction/maxAbsSlip:p.tauMax/p.s1;traction=secant*s;tangent=secant;branch='unloading-reloading'}
  const history={maxAbsSlip,lastSlip:s,lastTraction:traction,loadingDirection:direction,reversalCount,cumulativeSlip:c.cumulativeSlip+Math.abs(s-c.lastSlip)};
  return{contract:RC_BOND_SLIP_1D_CONTRACT,type:'bond-slip-envelope',slip:s,traction,tangent,branch,history,parameters:p};
}
