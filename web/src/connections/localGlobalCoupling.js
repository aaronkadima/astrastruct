export const CONNECTION_COUPLING_CONTRACT='connection-local-global/v1';

const EPS=1e-12;
const vec=v=>Array.from(v||[],Number);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=(a,label)=>{const n=norm(a);if(!(n>EPS))throw new Error(`ConnectionCoupling: ${label} degenerado.`);return a.map(v=>v/n)};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,x)=>A.map(r=>dot(r,x));
const zeros=(n,m)=>Array.from({length:n},()=>Array(m).fill(0));
function p3(n){return[Number(n?.x)||0,Number(n?.y)||0,Number(n?.z)||0]}
function skew(r){return[[0,-r[2],r[1]],[r[2],0,-r[0]],[-r[1],r[0],0]]}
function setBlock(A,r0,c0,B,s=1){for(let i=0;i<B.length;i++)for(let j=0;j<B[i].length;j++)A[r0+i][c0+j]+=s*B[i][j]}

export function connectionLocalBasis({node1,node2,localAxes=null,localYHint=null}={}){
  let ex,ey,ez;
  if(localAxes?.x&&localAxes?.y){ex=unit(vec(localAxes.x),'eixo local x');const yh=vec(localAxes.y),proj=scale(ex,dot(yh,ex));ey=unit(sub(yh,proj),'eixo local y');ez=unit(cross(ex,ey),'eixo local z');ey=unit(cross(ez,ex),'eixo local y ortogonal')}
  else{
    ex=unit(sub(p3(node2),p3(node1)),'linha entre nós');let hint=localYHint?vec(localYHint):[0,0,1];if(Math.abs(dot(unit(hint,'localYHint'),ex))>.98)hint=[0,1,0];if(Math.abs(dot(unit(hint,'localYHint alternativo'),ex))>.98)hint=[1,0,0];const proj=scale(ex,dot(hint,ex));ey=unit(sub(hint,proj),'eixo local y');ez=unit(cross(ex,ey),'eixo local z');ey=unit(cross(ez,ex),'eixo local y ortogonal');
  }
  const R=[ex,ey,ez];return{contract:CONNECTION_COUPLING_CONTRACT,R,RT:transpose(R),axes:{x:ex,y:ey,z:ez}};
}

export function connectionKinematicMap({node1,node2,localAxes=null,localYHint=null,offset1=[0,0,0],offset2=[0,0,0]}={}){
  const basis=connectionLocalBasis({node1,node2,localAxes,localYHint}),R=basis.R,RT=basis.RT,r1Local=vec(offset1),r2Local=vec(offset2);if(r1Local.length!==3||r2Local.length!==3||[...r1Local,...r2Local].some(v=>!Number.isFinite(v)))throw new Error('ConnectionCoupling: offsets devem ter três valores finitos.');
  const r1=mv(RT,r1Local),r2=mv(RT,r2Local),B=zeros(6,12),S1=skew(r1),S2=skew(r2);
  setBlock(B,0,0,R,-1);setBlock(B,0,3,mm(R,S1),1);setBlock(B,0,6,R,1);setBlock(B,0,9,mm(R,S2),-1);
  setBlock(B,3,3,R,-1);setBlock(B,3,9,R,1);
  return{contract:CONNECTION_COUPLING_CONTRACT,...basis,B,offsets:{local1:r1Local,local2:r2Local,global1:r1,global2:r2}};
}

export function relativeConnectionDeformation(map,globalDofs){const u=vec(globalDofs);if(u.length!==12||u.some(v=>!Number.isFinite(v)))throw new Error('ConnectionCoupling: são necessários 12 DOFs globais.');return mv(map.B,u)}
export function projectConnectionWrench(map,localWrench){const f=vec(localWrench);if(f.length!==6||f.some(v=>!Number.isFinite(v)))throw new Error('ConnectionCoupling: wrench local deve ter 6 componentes.');return mv(transpose(map.B),f)}
export function projectConnectionTangent(map,localTangent){if(!Array.isArray(localTangent)||localTangent.length!==6||localTangent.some(r=>!Array.isArray(r)||r.length!==6))throw new Error('ConnectionCoupling: tangente local deve ser 6×6.');return mm(transpose(map.B),mm(localTangent,map.B))}

export function connectionEquilibrium(globalForces){const f=vec(globalForces);if(f.length!==12)throw new Error('ConnectionCoupling: equilíbrio requer 12 forças generalizadas.');const F1=f.slice(0,3),M1=f.slice(3,6),F2=f.slice(6,9),M2=f.slice(9,12);return{forceBalance:F1.map((v,i)=>v+F2[i]),momentBalance:M1.map((v,i)=>v+M2[i]),forceNorm:norm(F1.map((v,i)=>v+F2[i]))}}
