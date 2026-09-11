import { solveLinear } from './matrix.js';

function zeros(n,m=n){return Array.from({length:n},()=>Array(m).fill(0))}
function finiteStiffness(value){if(value===null||value===undefined||value==='')return Infinity;const k=Number(value);if(!Number.isFinite(k))return Infinity;if(k<0)throw new Error('Rigidez rotacional de ligação não pode ser negativa.');return k}

export function endRotationalStiffness(releases={},rotationalSprings={},end=1){
  const key=end===1?'rz1':'rz2';
  if(releases?.[key])return 0;
  return finiteStiffness(rotationalSprings?.[key]);
}

function connectionSet(releases={},rotationalSprings={}){
  const k1=endRotationalStiffness(releases,rotationalSprings,1),k2=endRotationalStiffness(releases,rotationalSprings,2);
  const entries=[{dof:2,k:k1,end:1},{dof:5,k:k2,end:2}];
  const flexible=entries.filter(x=>Number.isFinite(x.k));
  return{entries,flexible};
}

function evaluate(kl,pOriginal,uN,data){
  if(!data.flexible.length){
    const q=kl.map((row,i)=>row.reduce((s,v,j)=>s+v*uN[j],0)-pOriginal[i]);
    return{q,uElement:[...uN],connectionRotations:[]};
  }
  const {r,a,ks,Krr,Kra,pr}=data,ua=a.map(i=>uN[i]),unr=r.map(i=>uN[i]);
  const S=Krr.map((row,i)=>row.map((v,j)=>v+(i===j?ks[i]:0)));
  const rhs=pr.map((v,i)=>v-Kra[i].reduce((sum,k,j)=>sum+k*ua[j],0)+ks[i]*unr[i]);
  const ur=solveLinear(S,rhs),uElement=[...uN];r.forEach((dof,i)=>{uElement[dof]=ur[i]});
  const qElement=kl.map((row,i)=>row.reduce((sum,v,j)=>sum+v*uElement[j],0)-pOriginal[i]);
  const q=[...qElement];r.forEach((dof,i)=>{q[dof]=ks[i]*(uN[dof]-ur[i])});
  return{q,uElement,connectionRotations:r.map((dof,i)=>({dof,end:data.ends[i],k:ks[i],nodeRotation:uN[dof],elementRotation:ur[i],relativeRotation:uN[dof]-ur[i],moment:q[dof]}))};
}

export function condenseEndConnections(kl,pOriginal,releases={},rotationalSprings={}){
  const set=connectionSet(releases,rotationalSprings),flexible=set.flexible;
  if(!flexible.length)return{kEff:kl.map(r=>[...r]),pEff:[...pOriginal],connectionData:{flexible:[],entries:set.entries}};
  const r=flexible.map(x=>x.dof),ks=flexible.map(x=>x.k),ends=flexible.map(x=>x.end),a=[0,1,2,3,4,5].filter(i=>!r.includes(i));
  const Krr=r.map(i=>r.map(j=>kl[i][j])),Kra=r.map(i=>a.map(j=>kl[i][j])),pr=r.map(i=>pOriginal[i]);
  const data={flexible,r,a,ks,ends,Krr,Kra,pr,entries:set.entries};
  const u0=Array(6).fill(0),q0=evaluate(kl,pOriginal,u0,data).q,pEff=q0.map(v=>-v),kEff=zeros(6);
  for(let j=0;j<6;j++){
    const uj=Array(6).fill(0);uj[j]=1;
    const qj=evaluate(kl,pOriginal,uj,data).q;
    for(let i=0;i<6;i++)kEff[i][j]=qj[i]-q0[i];
  }
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const v=.5*(kEff[i][j]+kEff[j][i]);kEff[i][j]=v;kEff[j][i]=v}
  return{kEff,pEff,connectionData:data};
}

export function recoverEndConnections(kl,pOriginal,uN,connectionData){
  return evaluate(kl,pOriginal,uN,connectionData||{flexible:[]});
}
