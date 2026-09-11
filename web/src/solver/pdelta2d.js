import { zeros, solveConstrained, addSub, mul } from './matrix.js';
import { prepareFrameElement, recoverFrameEndForces, frameEndHasRotationalStiffness, transpose, mm } from './frameElement.js';
import { condenseEndConnections } from './endConnections.js';
import { addNodalSprings, recoverSpringForces } from './springs.js';
import { sectionDepth } from '../core/model.js';

function addMatrices(A,B){return A.map((row,i)=>row.map((v,j)=>v+B[i][j]))}

// Matriz geométrica consistente de viga-coluna 2D.
// Convenção do AstraStruct: N > 0 = tração. Logo compressão (N < 0)
// reduz a rigidez tangente automaticamente pelo sinal do multiplicador.
export function frameLocalGeometricStiffness(N,L){
  if(!(L>0)||Math.abs(N)<1e-15)return zeros(6);
  const f=N/(30*L),L2=L*L;
  return [
    [0,0,0,0,0,0],
    [0,36,3*L,0,-36,3*L],
    [0,3*L,4*L2,0,-3*L,-L2],
    [0,0,0,0,0,0],
    [0,-36,-3*L,0,36,-3*L],
    [0,3*L,-L2,0,-3*L,4*L2]
  ].map(row=>row.map(v=>v*f));
}

function physicalAxial(force){
  return 0.5*((Number(force.N2)||0)-(Number(force.N1)||0));
}

function hasFlexibleEnds(e){
  if(e.releases?.rz1||e.releases?.rz2)return true;
  for(const key of ['rz1','rz2']){
    const raw=e.rotationalSprings?.[key];
    if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw)))return true;
  }
  return false;
}

function prepareCache(project,nodes,map){
  const cache=[];
  for(const e of project.elements||[]){
    if(e.type!=='frame2d')throw new Error('P-Delta v0.12 suporta apenas modelos compostos por elementos frame2d.');
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>1e-10))throw new Error(`Elemento ${e.id} possui comprimento nulo.`);
    const c=dx/L,s=dy/L,mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Material ausente em ${e.id}.`);
    const sec=(project.sections||[]).find(x=>x.id===e.sectionId),loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id).map(l=>l.kind==='selfWeight'?{...l,gamma:Number(l.gamma)||Number(mat.density)||0}:l);
    const material=prepareFrameElement({E:mat.E,A:e.A,I:e.I,L,c,s,loads,releases:e.releases||{},rotationalSprings:e.rotationalSprings||{},alpha:Number(mat.alpha)||0,sectionHeight:sectionDepth(sec)});
    cache.push({e,i,j,L,c,s,mat,material,idx:[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]});
  }
  return cache;
}

function prescribedMap(project,nodes,elements,map){
  const prescribed=new Map();
  for(const support of project.supports||[]){const i=map.get(support.nodeId);if(i==null)continue;if(support.ux)prescribed.set(3*i,Number(support.uxValue)||0);if(support.uy)prescribed.set(3*i+1,Number(support.uyValue)||0);if(support.rz)prescribed.set(3*i+2,Number(support.rzValue)||0)}
  nodes.forEach((node,i)=>{const active=elements.some(e=>frameEndHasRotationalStiffness(e,node.id));if(!active&&!prescribed.has(3*i+2))prescribed.set(3*i+2,0)});
  return prescribed;
}

function normalizeImperfection(options,nd,prescribed,elements){
  const raw=options.initialImperfection;
  if(!raw)return null;
  if(elements.some(hasFlexibleEnds))throw new Error('P-Delta com imperfeição modal v0.12 requer extremidades rígidas; releases e ligações semirrígidas ainda não estão validados para este recurso.');
  if(!Array.isArray(raw.vector)||raw.vector.length!==nd)throw new Error(`Imperfeição inicial inválida: vetor deve possuir ${nd} graus de liberdade.`);
  const vector=raw.vector.map((v,i)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`Imperfeição inicial inválida no DOF ${i}.`);return n});
  for(const d of prescribed.keys())if(Math.abs(vector[d])>1e-9)throw new Error(`Imperfeição inicial incompatível com apoio no DOF ${d}.`);
  const maxTranslation=Math.max(0,...vector.filter((_,i)=>i%3!==2).map(Math.abs));
  if(!(maxTranslation>1e-12))throw new Error('Imperfeição inicial sem componente translacional significativa.');
  return{...raw,vector,maxTranslation};
}

export function solveFramePDelta2D(project,options={}){
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length)throw new Error('Modelo sem nós.');if(!elements.length)throw new Error('Modelo sem elementos.');
  if(elements.some(e=>e.type!=='frame2d'))throw new Error('P-Delta v0.12 suporta somente pórticos 2D puros. Use análise linear para modelos mistos/treliças.');
  const maxIterations=Math.max(2,Math.min(100,Math.round(Number(options.maxIterations??project.settings?.pDeltaMaxIterations??30)))),tolerance=Math.max(1e-12,Number(options.tolerance??project.settings?.pDeltaTolerance??1e-8));
  const nd=nodes.length*3,map=new Map(nodes.map((n,i)=>[n.id,i])),cache=prepareCache(project,nodes,map),prescribed=prescribedMap(project,nodes,elements,map),imperfection=normalizeImperfection(options,nd,prescribed,elements),u0=imperfection?.vector||Array(nd).fill(0);
  let axial=new Map(cache.map(x=>[x.e.id,0])),uPrev=Array(nd).fill(0),last=null,converged=false,maxDelta=Infinity;

  for(let iteration=1;iteration<=maxIterations;iteration++){
    const K=zeros(nd),F=Array(nd).fill(0);
    for(const item of cache){
      const N=axial.get(item.e.id)||0,kgLocal=frameLocalGeometricStiffness(N,item.L),ktLocal=addMatrices(item.material.kl,kgLocal);
      const zero=Array(6).fill(0),cond=condenseEndConnections(ktLocal,zero,item.e.releases||{},item.e.rotationalSprings||{}),kg=mm(transpose(item.material.tr),mm(cond.kEff,item.material.tr));
      addSub(K,kg,item.idx);item.material.pg.forEach((v,k)=>{F[item.idx[k]]+=v});
      if(imperfection&&Math.abs(N)>1e-15){
        // F_imp = -Kg(N) u0. Nesta versão a imperfeição modal é habilitada
        // apenas para extremidades rígidas, portanto a matriz geométrica pode
        // ser transformada diretamente sem condensação adicional.
        const kgOnly=mm(transpose(item.material.tr),mm(kgLocal,item.material.tr)),u0e=item.idx.map(i=>u0[i]),fImp=mul(kgOnly,u0e).map(v=>-v);
        fImp.forEach((v,k)=>{F[item.idx[k]]+=v});
      }
    }
    addNodalSprings(K,project,map,3);
    for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=l.fx||0;F[3*i+1]+=l.fy||0;F[3*i+2]+=l.mz||0}
    const solved=solveConstrained(K,F,prescribed),u=solved.u;
    maxDelta=Math.max(...u.map((v,i)=>Math.abs(v-uPrev[i])));const scale=Math.max(1,Math.max(...u.map(Math.abs)));
    const forces=cache.map(item=>{
      const ug=item.idx.map(i=>u[i]),rec=recoverFrameEndForces(item.material,ug),u0g=item.idx.map(i=>u0[i]),u0l=imperfection?mul(item.material.tr,u0g):Array(6).fill(0),localTotal=rec.ul.map((v,i)=>v+u0l[i]);
      return{elementId:item.e.id,type:'frame2d',N1:rec.q[0],V1:rec.q[1],M1:rec.q[2],N2:rec.q[3],V2:rec.q[4],M2:rec.q[5],localDisplacements:rec.ul,localDisplacementsTotal:localTotal,nodalLocalDisplacements:rec.ulNodal,nodalLocalDisplacementsTotal:rec.ulNodal.map((v,i)=>v+u0l[i]),connectionRotations:rec.connectionRotations,loadSummary:item.material.loadSummary};
    });
    const newAxial=new Map(forces.map(f=>[f.elementId,physicalAxial(f)]));
    last={iteration,K,F,u,R:solved.R,free:solved.free,forces,axial:newAxial};
    if(iteration>1&&maxDelta<=tolerance*scale){converged=true;break}
    if(u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e3))throw new Error('P-Delta divergiu: deslocamentos não físicos indicam instabilidade ou modelo inadequado.');
    axial=newAxial;uPrev=[...u];
  }
  if(!converged)throw new Error(`P-Delta não convergiu em ${maxIterations} iterações (Δu=${maxDelta.toExponential(3)}).`);

  const displacements=nodes.map((n,i)=>({nodeId:n.id,ux:last.u[3*i],uy:last.u[3*i+1],rz:last.u[3*i+2]}));
  const initialDisplacements=nodes.map((n,i)=>({nodeId:n.id,ux:u0[3*i],uy:u0[3*i+1],rz:u0[3*i+2]}));
  const totalDisplacements=nodes.map((n,i)=>({nodeId:n.id,ux:last.u[3*i]+u0[3*i],uy:last.u[3*i+1]+u0[3*i+1],rz:last.u[3*i+2]+u0[3*i+2]}));
  return{type:'frame2d-pdelta',solverVersion:'0.12.0',dofs:nd,activeDofs:last.free.length,displacements,initialDisplacements:imperfection?initialDisplacements:null,totalDisplacements:imperfection?totalDisplacements:null,reactions:nodes.map((n,i)=>({nodeId:n.id,fx:last.R[3*i],fy:last.R[3*i+1],mz:last.R[3*i+2]})),springForces:recoverSpringForces(project,displacements),elementForces:last.forces,pDelta:{converged:true,iterations:last.iteration,tolerance,maxDelta,axialForces:[...last.axial].map(([elementId,N])=>({elementId,N})),imperfection:imperfection?{enabled:true,source:imperfection.source||'modal',mode:imperfection.mode||null,referenceScenarioId:imperfection.referenceScenarioId||null,amplitude:imperfection.maxTranslation,amplitudeMm:imperfection.maxTranslation*1000,criticalFactor:imperfection.criticalFactor||null}:null}};
}
