import { solveLinear } from './matrix.js';

const ROT_KEYS=['rx1','ry1','rz1','rx2','ry2','rz2'];
const ROT_DOFS={rx1:3,ry1:4,rz1:5,rx2:9,ry2:10,rz2:11};
const EPS=1e-12;
const zeros=(n,m=n)=>Array.from({length:n},()=>Array(m).fill(0));

function finiteStiffness(value){
  if(value===null||value===undefined||value==='')return Infinity;
  const k=Number(value);
  if(!Number.isFinite(k))return Infinity;
  if(k<0)throw new Error('Rigidez rotacional 3D não pode ser negativa.');
  return k;
}

export function rotationalConnectionStiffness3D(releases={},rotationalSprings={}){
  const out={};
  for(const key of ROT_KEYS)out[key]=releases?.[key]?0:finiteStiffness(rotationalSprings?.[key]);
  return out;
}

function connectionSet(releases={},rotationalSprings={}){
  const stiffness=rotationalConnectionStiffness3D(releases,rotationalSprings);
  const entries=ROT_KEYS.map(key=>({key,dof:ROT_DOFS[key],k:stiffness[key],end:key.endsWith('1')?1:2,axis:key[1]}));
  const detachedTorsion=stiffness.rx1===0&&stiffness.rx2===0;
  const flexible=entries.filter(x=>Number.isFinite(x.k)&&!(detachedTorsion&&(x.key==='rx1'||x.key==='rx2')));
  return{entries,flexible,stiffness,detachedTorsion};
}

function evaluate12(kl,pOriginal,uN,data){
  const qBase=()=>kl.map((row,i)=>row.reduce((s,v,j)=>s+v*uN[j],0)-pOriginal[i]);
  if(!data.flexible.length){const q=qBase();if(data.detachedTorsion){q[3]=0;q[9]=0}return{q,uElement:[...uN],connectionRotations:[]}}
  const {r,a,ks,Krr,Kra,pr}=data,ua=a.map(i=>uN[i]),unr=r.map(i=>uN[i]);
  const S=Krr.map((row,i)=>row.map((v,j)=>v+(i===j?ks[i]:0)));
  const rhs=pr.map((v,i)=>v-Kra[i].reduce((sum,k,j)=>sum+k*ua[j],0)+ks[i]*unr[i]);
  const ur=solveLinear(S,rhs),uElement=[...uN];r.forEach((dof,i)=>{uElement[dof]=ur[i]});
  const qElement=kl.map((row,i)=>row.reduce((sum,v,j)=>sum+v*uElement[j],0)-pOriginal[i]);
  const q=[...qElement];r.forEach((dof,i)=>{q[dof]=ks[i]*(uN[dof]-ur[i])});
  if(data.detachedTorsion){q[3]=0;q[9]=0}
  const connectionRotations=r.map((dof,i)=>({key:data.keys[i],dof,end:data.ends[i],axis:data.axes[i],k:ks[i],nodeRotation:uN[dof],elementRotation:ur[i],relativeRotation:uN[dof]-ur[i],moment:q[dof]}));
  if(data.detachedTorsion)for(const key of ['rx1','rx2'])connectionRotations.push({key,dof:ROT_DOFS[key],end:key.endsWith('1')?1:2,axis:'x',k:0,nodeRotation:uN[ROT_DOFS[key]],elementRotation:null,relativeRotation:null,moment:0});
  return{q,uElement,connectionRotations};
}

/** Static condensation of local frame3d end rotations against nodal rotations. */
export function condenseEndConnections3D(kl,pOriginal=Array(12).fill(0),releases={},rotationalSprings={}){
  const set=connectionSet(releases,rotationalSprings),baseK=kl.map(r=>[...r]),baseP=[...pOriginal];
  if(set.detachedTorsion){for(const d of [3,9]){for(let j=0;j<12;j++){baseK[d][j]=0;baseK[j][d]=0}baseP[d]=0}}
  const flexible=set.flexible;
  if(!flexible.length)return{kEff:baseK,pEff:baseP,connectionData:{flexible:[],entries:set.entries,detachedTorsion:set.detachedTorsion}};
  const r=flexible.map(x=>x.dof),ks=flexible.map(x=>x.k),ends=flexible.map(x=>x.end),axes=flexible.map(x=>x.axis),keys=flexible.map(x=>x.key),a=Array.from({length:12},(_,i)=>i).filter(i=>!r.includes(i));
  const Krr=r.map(i=>r.map(j=>baseK[i][j])),Kra=r.map(i=>a.map(j=>baseK[i][j])),pr=r.map(i=>baseP[i]);
  const data={flexible,r,a,ks,ends,axes,keys,Krr,Kra,pr,entries:set.entries,detachedTorsion:set.detachedTorsion};
  const u0=Array(12).fill(0),q0=evaluate12(baseK,baseP,u0,data).q,pEff=q0.map(v=>-v),kEff=zeros(12);
  for(let j=0;j<12;j++){
    const uj=Array(12).fill(0);uj[j]=1;
    const qj=evaluate12(baseK,baseP,uj,data).q;
    for(let i=0;i<12;i++)kEff[i][j]=qj[i]-q0[i];
  }
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){const v=.5*(kEff[i][j]+kEff[j][i]);kEff[i][j]=v;kEff[j][i]=v}
  return{kEff,pEff,connectionData:data};
}

export function recoverEndConnections3D(kl,pOriginal,uN,connectionData){
  const data=connectionData||{flexible:[],entries:[],detachedTorsion:false};
  let baseK=kl.map(r=>[...r]),baseP=[...pOriginal];
  if(data.detachedTorsion){for(const d of [3,9]){for(let j=0;j<12;j++){baseK[d][j]=0;baseK[j][d]=0}baseP[d]=0}}
  return evaluate12(baseK,baseP,uN,data);
}

/**
 * Kinematic transformation from nodal DOFs to the elastic member-end DOFs after
 * massless released/semi-rigid rotational connections are statically condensed.
 * u_element = B * u_node for zero fixed-end loads. This is useful for projecting
 * mass and geometric-stiffness matrices consistently with the same connection law.
 */
export function endConnectionKinematicMap3D(kl,releases={},rotationalSprings={}){
  const zero=Array(12).fill(0),connection=condenseEndConnections3D(kl,zero,releases,rotationalSprings),B=zeros(12);
  for(let j=0;j<12;j++){
    const u=Array(12).fill(0);u[j]=1;
    const recovered=recoverEndConnections3D(kl,zero,u,connection.connectionData);
    for(let i=0;i<12;i++)B[i][j]=recovered.uElement[i];
  }
  return{B,kEff:connection.kEff,connectionData:connection.connectionData};
}

/**
 * Co-rotational constitutive end-rotation solve. Krot uses [rx1,ry1,rz1,rx2,ry2,rz2].
 * pRot is the equivalent natural/thermal moment vector, so q = Krot*theta - pRot.
 */
export function resolveCorotationalEndMoments3D(Krot,pRot,nodeRotations,releases={},rotationalSprings={}){
  const stiffness=rotationalConnectionStiffness3D(releases,rotationalSprings);
  const groups=[['rx1','rx2',0,3],['ry1','ry2',1,4],['rz1','rz2',2,5]];
  const elementRotations=[...nodeRotations],moments=Array(6).fill(0),connectionRotations=[];
  for(const [k1,k2,i,j] of groups){
    const keys=[k1,k2],idx=[i,j],ks=[stiffness[k1],stiffness[k2]],flex=[0,1].filter(a=>Number.isFinite(ks[a]));
    if(!flex.length){for(const a of [0,1])moments[idx[a]]=Krot[idx[a]].reduce((s,v,c)=>s+v*nodeRotations[c],0)-pRot[idx[a]];continue}
    if(ks[0]===0&&ks[1]===0&&k1==='rx1'){
      moments[i]=0;moments[j]=0;connectionRotations.push({key:k1,end:1,axis:'x',k:0,nodeRotation:nodeRotations[i],elementRotation:null,relativeRotation:null,moment:0},{key:k2,end:2,axis:'x',k:0,nodeRotation:nodeRotations[j],elementRotation:null,relativeRotation:null,moment:0});continue;
    }
    const active=[0,1].filter(a=>!flex.includes(a)),r=flex.map(a=>idx[a]),aidx=active.map(a=>idx[a]);
    const S=r.map((ri,rr)=>r.map((rj,cc)=>Krot[ri][rj]+(rr===cc?ks[flex[rr]]:0)));
    const rhs=r.map((ri,rr)=>pRot[ri]-aidx.reduce((s,aj)=>s+Krot[ri][aj]*nodeRotations[aj],0)+ks[flex[rr]]*nodeRotations[ri]);
    let ur;
    if(S.length===1)ur=[Math.abs(S[0][0])>EPS?rhs[0]/S[0][0]:nodeRotations[r[0]]];else ur=solveLinear(S,rhs);
    r.forEach((ri,rr)=>{elementRotations[ri]=ur[rr]});
    for(const a of [0,1]){
      const dof=idx[a];
      if(Number.isFinite(ks[a]))moments[dof]=ks[a]*(nodeRotations[dof]-elementRotations[dof]);
      else moments[dof]=Krot[dof].reduce((s,v,c)=>s+v*elementRotations[c],0)-pRot[dof];
    }
    for(const a of flex){const dof=idx[a];connectionRotations.push({key:keys[a],end:a+1,axis:keys[a][1],k:ks[a],nodeRotation:nodeRotations[dof],elementRotation:elementRotations[dof],relativeRotation:nodeRotations[dof]-elementRotations[dof],moment:moments[dof]})}
  }
  return{moments,elementRotations,connectionRotations,stiffness};
}
