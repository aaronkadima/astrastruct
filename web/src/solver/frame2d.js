import {zeros,solveLinear,mul,addSub} from './matrix.js';
function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
function mm(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)))}
function localK(E,A,I,L){const ea=E*A/L,ei=E*I,L2=L*L,L3=L2*L;return [[ea,0,0,-ea,0,0],[0,12*ei/L3,6*ei/L2,0,-12*ei/L3,6*ei/L2],[0,6*ei/L2,4*ei/L,0,-6*ei/L2,2*ei/L],[-ea,0,0,ea,0,0],[0,-12*ei/L3,-6*ei/L2,0,12*ei/L3,-6*ei/L2],[0,6*ei/L2,2*ei/L,0,-6*ei/L2,4*ei/L]]}
function T(c,s){return [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]]}
export function solveFrame2D(project){
 const nodes=project.nodes,nd=nodes.length*3,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i])),cache=[];
 for(const e of project.elements.filter(e=>e.type==='frame2d')){const i=map.get(e.n1),j=map.get(e.n2),a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L,mat=project.materials.find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}`);const kl=localK(mat.E,e.A,e.I,L),tr=T(c,s),kg=mm(transpose(tr),mm(kl,tr)),idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];addSub(K,kg,idx);cache.push({e,kl,tr,idx});}
 for(const l of project.loads){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=l.fx||0;F[3*i+1]+=l.fy||0;F[3*i+2]+=l.mz||0}
 const fixed=[];for(const s of project.supports){const i=map.get(s.nodeId);if(s.ux)fixed.push(3*i);if(s.uy)fixed.push(3*i+1);if(s.rz)fixed.push(3*i+2)}const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.includes(i));
 if(!free.length)throw new Error('Modelo sem graus de liberdade livres.');
 const Kr=free.map(i=>free.map(j=>K[i][j])),Fr=free.map(i=>F[i]),ur=solveLinear(Kr,Fr),u=Array(nd).fill(0);free.forEach((d,i)=>u[d]=ur[i]);const R=mul(K,u).map((v,i)=>v-F[i]);
 const ef=cache.map(({e,kl,tr,idx})=>{const ug=idx.map(i=>u[i]),ul=mul(tr,ug),q=mul(kl,ul);return {elementId:e.id,N1:q[0],V1:q[1],M1:q[2],N2:q[3],V2:q[4],M2:q[5]}});
 return {type:'frame2d',dofs:nd,displacements:nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]})),reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[3*i],fy:R[3*i+1],mz:R[3*i+2]})),elementForces:ef};
}
