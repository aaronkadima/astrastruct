import {zeros,solveLinear,mul,addSub} from './matrix.js';
export function solveTruss2D(project){
  const nodes=project.nodes,nd=nodes.length*2,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i]));
  for(const e of project.elements.filter(e=>e.type==='truss2d')){const i=map.get(e.n1),j=map.get(e.n2),a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L,mat=project.materials.find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}`);const k=mat.E*e.A/L,ke=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(r=>r.map(v=>v*k));addSub(K,ke,[2*i,2*i+1,2*j,2*j+1]);}
  for(const l of project.loads){const i=map.get(l.nodeId);if(i==null)continue;F[2*i]+=l.fx||0;F[2*i+1]+=l.fy||0}
  const fixed=[];for(const s of project.supports){const i=map.get(s.nodeId);if(s.ux)fixed.push(2*i);if(s.uy)fixed.push(2*i+1)}
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.includes(i));if(!free.length)throw new Error('Modelo sem graus de liberdade livres.');
  const Kr=free.map(i=>free.map(j=>K[i][j])),Fr=free.map(i=>F[i]),ur=solveLinear(Kr,Fr),u=Array(nd).fill(0);free.forEach((d,i)=>u[d]=ur[i]);const R=mul(K,u).map((v,i)=>v-F[i]);
  const axial=project.elements.filter(e=>e.type==='truss2d').map(e=>{const i=map.get(e.n1),j=map.get(e.n2),a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L,mat=project.materials.find(m=>m.id===e.materialId),de=(-c*u[2*i]-s*u[2*i+1]+c*u[2*j]+s*u[2*j+1]);return {elementId:e.id,N:mat.E*e.A/L*de}});
  return {type:'truss2d',dofs:nd,displacements:nodes.map((n,i)=>({nodeId:n.id,ux:u[2*i],uy:u[2*i+1],rz:0})),reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[2*i],fy:R[2*i+1],mz:0})),elementForces:axial};
}
