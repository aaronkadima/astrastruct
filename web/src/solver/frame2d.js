import { zeros, solveConstrained, addSub } from './matrix.js';
import { prepareFrameElement, recoverFrameEndForces, frameEndHasRotationalStiffness } from './frameElement.js';

export function solveFrame2D(project) {
  const nodes = project.nodes || [];
  const elements = (project.elements || []).filter(e => e.type === 'frame2d');
  if (!nodes.length) throw new Error('Modelo sem nós.');
  if (!elements.length) throw new Error('Modelo sem elementos de pórtico 2D.');

  const nd = nodes.length * 3, K = zeros(nd), F = Array(nd).fill(0);
  const map = new Map(nodes.map((n,i)=>[n.id,i])), cache=[];

  for (const e of elements) {
    const i=map.get(e.n1),j=map.get(e.n2);
    if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);
    if(!(L>1e-10))throw new Error(`Elemento ${e.id} possui comprimento nulo.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId);
    if(!mat)throw new Error(`Material ausente em ${e.id}.`);
    const loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id).map(l=>l.kind==='selfWeight'?{...l,gamma:Number(l.gamma)||Number(mat.density)||0}:l);
    const prepared=prepareFrameElement({E:mat.E,A:e.A,I:e.I,L,c:dx/L,s:dy/L,loads,releases:e.releases||{}});
    const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];
    addSub(K,prepared.kg,idx);prepared.pg.forEach((v,k)=>{F[idx[k]]+=v});cache.push({e,idx,prepared});
  }

  for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=l.fx||0;F[3*i+1]+=l.fy||0;F[3*i+2]+=l.mz||0}

  const prescribed=new Map();
  for(const support of project.supports||[]){const i=map.get(support.nodeId);if(i==null)continue;if(support.ux)prescribed.set(3*i,Number(support.uxValue)||0);if(support.uy)prescribed.set(3*i+1,Number(support.uyValue)||0);if(support.rz)prescribed.set(3*i+2,Number(support.rzValue)||0)}
  nodes.forEach((node,i)=>{const activeRotation=elements.some(e=>frameEndHasRotationalStiffness(e,node.id));if(!activeRotation&&!prescribed.has(3*i+2))prescribed.set(3*i+2,0)});
  if(!prescribed.size)throw new Error('Modelo sem restrições de apoio.');

  const {u,R,free}=solveConstrained(K,F,prescribed);
  const elementForces=cache.map(({e,idx,prepared})=>{
    const ug=idx.map(i=>u[i]),{q,ul}=recoverFrameEndForces(prepared,ug);
    return {elementId:e.id,type:'frame2d',N1:q[0],V1:q[1],M1:q[2],N2:q[3],V2:q[4],M2:q[5],localDisplacements:ul,loadSummary:prepared.loadSummary};
  });

  return {type:'frame2d',solverVersion:'0.5.0',dofs:nd,activeDofs:free.length,
    displacements:nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]})),
    reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[3*i],fy:R[3*i+1],mz:R[3*i+2]})),elementForces};
}
