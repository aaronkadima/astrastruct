import { zeros, solveConstrained, addSub } from './matrix.js';
import { prepareFrameElement, recoverFrameEndForces, frameEndHasRotationalStiffness } from './frameElement.js';
import { addNodalSprings, recoverSpringForces } from './springs.js';
import { sectionDepth } from '../core/model.js';

export function solveMixed2D(project) {
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length)throw new Error('Modelo sem nós.');
  if(!elements.length)throw new Error('Modelo sem elementos.');
  const nd=nodes.length*3,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i])),cache=[];

  for(const e of elements){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>1e-10))throw new Error(`Elemento ${e.id} possui comprimento nulo.`);
    const c=dx/L,s=dy/L,mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}.`);
    const elementLoads=(project.elementLoads||[]).filter(l=>l.elementId===e.id);

    if(e.type==='frame2d'){
      const sec=(project.sections||[]).find(x=>x.id===e.sectionId);
      const loads=elementLoads.map(l=>l.kind==='selfWeight'?{...l,gamma:Number(l.gamma)||Number(mat.density)||0}:l);
      const prepared=prepareFrameElement({E:mat.E,A:e.A,I:e.I,L,c,s,loads,releases:e.releases||{},rotationalSprings:e.rotationalSprings||{},alpha:Number(mat.alpha)||0,sectionHeight:sectionDepth(sec)});
      const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];addSub(K,prepared.kg,idx);prepared.pg.forEach((v,k)=>{F[idx[k]]+=v});cache.push({kind:'frame2d',e,idx,prepared});
    }else if(e.type==='truss2d'){
      if(!(e.A>0))throw new Error(`Elemento ${e.id}: A deve ser positiva.`);
      const k=mat.E*e.A/L,ke4=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(row=>row.map(v=>v*k)),idx4=[3*i,3*i+1,3*j,3*j+1];
      addSub(K,ke4,idx4);
      for(const load of elementLoads.filter(l=>l.kind==='selfWeight')){
        const gamma=Number(load.gamma)||Number(mat.density)||0,factor=Number.isFinite(Number(load.weightFactor))?Number(load.weightFactor):1,total=gamma*e.A*L*factor;
        F[3*i+1]-=total/2;F[3*j+1]-=total/2;
      }
      let thermalStrain=0;
      for(const load of elementLoads.filter(l=>l.kind==='thermal')){
        if(Math.abs(Number(load.dTGradient)||0)>1e-15)throw new Error(`Elemento ${e.id}: treliça 2D não admite gradiente térmico.`);
        const eps=(Number(mat.alpha)||0)*(Number(load.dT)||0),n0=mat.E*e.A*eps;
        thermalStrain+=eps;F[3*i]+=-n0*c;F[3*i+1]+=-n0*s;F[3*j]+=n0*c;F[3*j+1]+=n0*s;
      }
      cache.push({kind:'truss2d',e,i,j,c,s,L,mat,thermalStrain});
    }else throw new Error(`Tipo de elemento não suportado no solver misto: ${e.type}`);
  }

  addNodalSprings(K,project,map,3);
  for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=l.fx||0;F[3*i+1]+=l.fy||0;F[3*i+2]+=l.mz||0}
  const prescribed=new Map();
  for(const support of project.supports||[]){const i=map.get(support.nodeId);if(i==null)continue;if(support.ux)prescribed.set(3*i,Number(support.uxValue)||0);if(support.uy)prescribed.set(3*i+1,Number(support.uyValue)||0);if(support.rz)prescribed.set(3*i+2,Number(support.rzValue)||0)}
  nodes.forEach((node,i)=>{const activeRotation=elements.some(e=>frameEndHasRotationalStiffness(e,node.id));if(!activeRotation&&!prescribed.has(3*i+2))prescribed.set(3*i+2,0)});
  const {u,R,free}=solveConstrained(K,F,prescribed);
  const displacements=nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));

  const elementForces=cache.map(item=>{
    if(item.kind==='frame2d'){const ug=item.idx.map(i=>u[i]),{q,ul,ulNodal,connectionRotations}=recoverFrameEndForces(item.prepared,ug);return{elementId:item.e.id,type:'frame2d',N1:q[0],V1:q[1],M1:q[2],N2:q[3],V2:q[4],M2:q[5],localDisplacements:ul,nodalLocalDisplacements:ulNodal,connectionRotations,loadSummary:item.prepared.loadSummary}}
    const {e,i,j,c,s,L,mat,thermalStrain}=item,de=-c*u[3*i]-s*u[3*i+1]+c*u[3*j]+s*u[3*j+1];return{elementId:e.id,type:'truss2d',N:mat.E*e.A*(de/L-thermalStrain),thermalStrain};
  });
  return{type:'mixed2d',solverVersion:'0.9.0',dofs:nd,activeDofs:free.length,displacements,reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[3*i],fy:R[3*i+1],mz:R[3*i+2]})),springForces:recoverSpringForces(project,displacements),elementForces};
}
