import { zeros, solveConstrained, addSub } from './matrix.js';
import { addNodalSprings, recoverSpringForces } from './springs.js';

export function solveTruss2D(project) {
  const nodes=project.nodes||[],elements=(project.elements||[]).filter(e=>e.type==='truss2d');
  if(!nodes.length)throw new Error('Modelo sem nós.');if(!elements.length)throw new Error('Modelo sem elementos de treliça 2D.');
  const nd=nodes.length*2,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i])),cache=[];

  for(const e of elements){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>1e-10))throw new Error(`Elemento ${e.id} possui comprimento nulo.`);if(!(e.A>0))throw new Error(`Elemento ${e.id}: A deve ser positiva.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}.`);
    const c=dx/L,s=dy/L,k=mat.E*e.A/L,ke=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(row=>row.map(v=>v*k));addSub(K,ke,[2*i,2*i+1,2*j,2*j+1]);
    const elementLoads=(project.elementLoads||[]).filter(l=>l.elementId===e.id);
    for(const load of elementLoads.filter(l=>l.kind==='selfWeight')){
      const gamma=Number(load.gamma)||Number(mat.density)||0,factor=Number.isFinite(Number(load.weightFactor))?Number(load.weightFactor):1,total=gamma*e.A*L*factor;
      F[2*i+1]-=total/2;F[2*j+1]-=total/2;
    }
    let thermalStrain=0;
    for(const load of elementLoads.filter(l=>l.kind==='thermal')){
      if(Math.abs(Number(load.dTGradient)||0)>1e-15)throw new Error(`Elemento ${e.id}: treliça 2D não admite gradiente térmico.`);
      const eps=(Number(mat.alpha)||0)*(Number(load.dT)||0),n0=mat.E*e.A*eps;
      thermalStrain+=eps;
      F[2*i]+=-n0*c;F[2*i+1]+=-n0*s;F[2*j]+=n0*c;F[2*j+1]+=n0*s;
    }
    cache.push({e,i,j,c,s,L,mat,thermalStrain});
  }

  addNodalSprings(K,project,map,2);
  for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;F[2*i]+=l.fx||0;F[2*i+1]+=l.fy||0}
  const prescribed=new Map();for(const support of project.supports||[]){const i=map.get(support.nodeId);if(i==null)continue;if(support.ux)prescribed.set(2*i,Number(support.uxValue)||0);if(support.uy)prescribed.set(2*i+1,Number(support.uyValue)||0)}
  const {u,R,free}=solveConstrained(K,F,prescribed);
  const displacements=nodes.map((n,i)=>({nodeId:n.id,ux:u[2*i],uy:u[2*i+1],rz:0}));
  const axial=cache.map(({e,i,j,c,s,L,mat,thermalStrain})=>{const de=-c*u[2*i]-s*u[2*i+1]+c*u[2*j]+s*u[2*j+1];return{elementId:e.id,type:'truss2d',N:mat.E*e.A*(de/L-thermalStrain),thermalStrain}});
  return{type:'truss2d',solverVersion:'0.9.0',dofs:nd,activeDofs:free.length,displacements,reactions:nodes.map((n,i)=>({nodeId:n.id,fx:R[2*i],fy:R[2*i+1],mz:0})),springForces:recoverSpringForces(project,displacements),elementForces:axial};
}
