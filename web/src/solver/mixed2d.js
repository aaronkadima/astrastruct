import {zeros,solveLinear,mul,addSub} from './matrix.js';

function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
function mm(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)))}
function frameLocalK(E,A,I,L){const ea=E*A/L,ei=E*I,L2=L*L,L3=L2*L;return [[ea,0,0,-ea,0,0],[0,12*ei/L3,6*ei/L2,0,-12*ei/L3,6*ei/L2],[0,6*ei/L2,4*ei/L,0,-6*ei/L2,2*ei/L],[-ea,0,0,ea,0,0],[0,-12*ei/L3,-6*ei/L2,0,12*ei/L3,-6*ei/L2],[0,6*ei/L2,2*ei/L,0,-6*ei/L2,4*ei/L]]}
function frameT(c,s){return [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]]}

export function solveMixed2D(project){
  const nodes=project.nodes;
  if(!nodes.length) throw new Error('Modelo sem nós.');
  if(!project.elements.length) throw new Error('Modelo sem elementos.');
  const nd=nodes.length*3,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i])),cache=[];
  for(const e of project.elements){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<=1e-10)throw new Error(`Elemento ${e.id} possui comprimento nulo.`);
    const c=dx/L,s=dy/L,mat=project.materials.find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}`);const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];
    if(e.type==='frame2d'){
      if(!(e.A>0)||!(e.I>0))throw new Error(`Elemento ${e.id}: A e I devem ser positivos.`);
      const kl=frameLocalK(mat.E,e.A,e.I,L),tr=frameT(c,s),kg=mm(transpose(tr),mm(kl,tr));addSub(K,kg,idx);cache.push({kind:'frame2d',e,kl,tr,idx});
    }else if(e.type==='truss2d'){
      if(!(e.A>0))throw new Error(`Elemento ${e.id}: A deve ser positiva.`);
      const k=mat.E*e.A/L,ke4=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(r=>r.map(v=>v*k)),idx4=[3*i,3*i+1,3*j,3*j+1];addSub(K,ke4,idx4);cache.push({kind:'truss2d',e,i,j,c,s,L,mat});
    }else throw new Error(`Tipo de elemento não suportado no solver misto: ${e.type}`);
  }
  for(const l of project.loads){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=l.fx||0;F[3*i+1]+=l.fy||0;F[3*i+2]+=l.mz||0}
  const fixed=new Set();for(const s of project.supports){const i=map.get(s.nodeId);if(i==null)continue;if(s.ux)fixed.add(3*i);if(s.uy)fixed.add(3*i+1);if(s.rz)fixed.add(3*i+2)}
  for(let i=0;i<nodes.length;i++){const hasFrame=project.elements.some(e=>e.type==='frame2d'&&(e.n1===nodes[i].id||e.n2===nodes[i].id));if(!hasFrame)fixed.add(3*i+2)}
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));if(!free.length)throw new Error('Modelo sem graus de liberdade livres.');
  const Kr=free.map(i=>free.map(j=>K[i][j])),Fr=free.map(i=>F[i]),ur=solveLinear(Kr,Fr),u=Array(nd).fill(0);free.forEach((d,i)=>u[d]=ur[i]);const R=mul(K,u).map((v,i)=>v-F[i]);
  const elementForces=cache.map(ca=>{if(ca.kind==='frame2d'){const ug=ca.idx.map(i=>u[i]),ul=mul(ca.tr,ug),q=mul(ca.kl,ul);return {elementId:ca.e.id,type:'frame2d',N1:q[0],V1:q[1],M1:q[2],N2:q[3],V2:q[4],M2:q[5]}}const {e,i,j,c,s,L,mat}=ca,de=(-c*u[3*i]-s*u[3*i+1]+c*u[3*j]+s*u[3*j+1]);return {elementId:e.id,type:'truss2d',N:mat.E*e.A/L*de}});
  return {type:'mixed2d',dofs:nd,activeDofs:free.length,displacements:nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]})),reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[3*i],fy:R[3*i+1],mz:R[3*i+2]})),elementForces};
}
