import { zeros, addSub, solveLinear } from './matrix.js';
import { resolveScenario } from './scenario.js';
import { buildCorotationalResponses } from './corotationalPostprocess.js';
import { uniformDistributedLoadVector, pointLoadVector } from './frameElement.js';
import { sectionDepth } from '../core/model.js';

const EPS=1e-12;
const normInf=v=>v.length?Math.max(...v.map(x=>Math.abs(x))):0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const outer=(a,b)=>a.map(x=>b.map(y=>x*y));
const addMatrix=(A,B,scale=1)=>A.map((r,i)=>r.map((v,j)=>v+scale*B[i][j]));
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,v)=>A.map(r=>r.reduce((s,x,j)=>s+x*v[j],0));
const addVector=(a,b)=>a.map((v,i)=>v+b[i]);
const subVector=(a,b)=>a.map((v,i)=>v-b[i]);

function hasFlexibleEnds(e){
  if(e.releases?.rz1||e.releases?.rz2)return true;
  for(const key of ['rz1','rz2']){
    const raw=e.rotationalSprings?.[key];
    if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw)))return true;
  }
  return false;
}

function validateModel(project){
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length||!elements.length)throw new Error('Co-rotacional: modelo sem nós ou elementos.');
  if(elements.some(e=>e.type!=='frame2d'))throw new Error('Co-rotacional v0.13 experimental suporta somente elementos frame2d.');
  if(elements.some(hasFlexibleEnds))throw new Error('Co-rotacional v0.13 experimental requer extremidades rígidas.');
  const unsupported=(project.elementLoads||[]).find(l=>!['uniform','selfWeight','point','thermal'].includes(l.kind));
  if(unsupported)throw new Error(`Co-rotacional v0.13.3 experimental ainda não aceita carga de barra do tipo "${unsupported.kind}"; são aceitas uniform, selfWeight e point como cargas mortas da referência e thermal como deformação inicial.`);
  if((project.nodeSprings||[]).length)throw new Error('Co-rotacional v0.13 experimental ainda não aceita molas nodais.');
  if((project.settlements||[]).length)throw new Error('Co-rotacional v0.13 experimental ainda não aceita recalques/deslocamentos impostos.');
  if(project.settings?.imperfection?.enabled)throw new Error('Co-rotacional v0.13 experimental ainda não aceita imperfeição geométrica inicial; desative a imperfeição modal ou use P-Delta.');
  for(const s of project.supports||[]){
    const values=[s.baseUxValue,s.baseUyValue,s.baseRzValue,s.uxValue,s.uyValue,s.rzValue].map(v=>Number(v)||0);
    if(values.some(v=>Math.abs(v)>EPS))throw new Error('Co-rotacional v0.13 experimental ainda não aceita deslocamentos impostos nos apoios.');
  }
}

function localVectorToGlobal(vector,c,s){
  return[
    c*vector[0]-s*vector[1],s*vector[0]+c*vector[1],vector[2],
    c*vector[3]-s*vector[4],s*vector[3]+c*vector[4],vector[5]
  ];
}

function globalVectorToLocal(vector,c,s){
  return[
    c*vector[0]+s*vector[1],-s*vector[0]+c*vector[1],vector[2],
    c*vector[3]+s*vector[4],-s*vector[3]+c*vector[4],vector[5]
  ];
}

/**
 * Cargas mecânicas mortas da configuração de referência.
 * Os vetores nodais equivalentes são congelados na configuração inicial e não
 * acrescentam tangente externa ao Newton.
 */
function prepareReferenceElementLoads(project,e,mat,L0,c0,s0){
  let qx=0,qy=0,pLocal=Array(6).fill(0),selfWeight=0;
  const points=[],loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id);
  for(const load of loads){
    if(load.kind==='thermal')continue;
    if(load.kind==='point'){
      const xi=clamp(Number(load.xi??0.5),0,1),px=Number(load.px)||0,py=Number(load.py)||0;
      pLocal=addVector(pLocal,pointLoadVector(px,py,L0,xi));
      points.push({xi,a0:xi*L0,px,py,global:{x:c0*px-s0*py,y:s0*px+c0*py}});
      continue;
    }
    let lx=0,ly=0;
    if(load.kind==='uniform'){
      lx=Number(load.qx)||0;ly=Number(load.qy)||0;
    }else if(load.kind==='selfWeight'){
      const gamma=Number(load.gamma)||Number(mat.density)||0;
      const rawFactor=load.weightFactor??load.factor;
      const factor=Number.isFinite(Number(rawFactor))?Number(rawFactor):1;
      const w=gamma*Number(e.A)*factor;
      lx=-s0*w;ly=-c0*w;selfWeight+=w;
    }
    qx+=lx;qy+=ly;pLocal=addVector(pLocal,uniformDistributedLoadVector(lx,ly,L0));
  }
  const pGlobal=localVectorToGlobal(pLocal,c0,s0);
  const globalPerReferenceLength={x:c0*qx-s0*qy,y:s0*qx+c0*qy};
  return{
    pLocal,pGlobal,
    summary:{
      mode:'reference-dead',uniform:{qx,qy},selfWeight,points,
      reference:{L0,c0,s0,globalPerReferenceLength},
      supportedKinds:['uniform','selfWeight','point']
    }
  };
}

/**
 * Estado térmico inicial. A temperatura não é força externa: entra como
 * deformação axial e curvatura inicial no sistema básico co-rotacional.
 */
function prepareThermalInitialState(project,e,mat,section,L0){
  let dT=0,dTGradient=0;
  for(const load of (project.elementLoads||[]).filter(l=>l.elementId===e.id&&l.kind==='thermal')){
    dT+=Number(load.dT)||0;dTGradient+=Number(load.dTGradient)||0;
  }
  const alpha=Number(mat.alpha)||0,eps0=alpha*dT;
  let kappa0=0;
  if(Math.abs(dTGradient)>1e-15){
    const h=sectionDepth(section);
    if(!(h>0))throw new Error(`Co-rotacional térmico: gradiente em ${e.id} requer altura/profundidade positiva da seção.`);
    kappa0=-alpha*dTGradient/h;
  }
  const initialBasic=[eps0*L0,-kappa0*L0/2,kappa0*L0/2];
  return{initialBasic,summary:{dT,dTGradient,alpha,eps0,kappa0,sectionHeight:sectionDepth(section),initialBasic}};
}

/**
 * Estado de um elemento de pórtico 2D co-rotacional de Euler-Bernoulli.
 * initialBasic representa deformações iniciais livres (p.ex. térmicas).
 */
export function corotationalElementState({X1,Y1,X2,Y2,qGlobal,E,A,I,initialBasic=[0,0,0]}){
  const q=qGlobal.map(Number),dx0=X2-X1,dy0=Y2-Y1,L0=Math.hypot(dx0,dy0);
  if(!(L0>EPS))throw new Error('Co-rotacional: elemento com comprimento inicial nulo.');
  if(!(E>0&&A>0&&I>0))throw new Error('Co-rotacional: E, A e I devem ser positivos.');
  const alpha0=Math.atan2(dy0,dx0),x1=X1+q[0],y1=Y1+q[1],x2=X2+q[3],y2=Y2+q[4],dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);
  if(!(l>EPS))throw new Error('Co-rotacional: comprimento corrente degenerado.');
  const c=dx/l,s=dy/l,alpha=Math.atan2(dy,dx),dAlpha=wrapAngle(alpha-alpha0),basic=[l-L0,q[2]-dAlpha,q[5]-dAlpha],initial=initialBasic.map(Number),elasticBasic=subVector(basic,initial);
  const kb=[[E*A/L0,0,0],[0,4*E*I/L0,2*E*I/L0],[0,2*E*I/L0,4*E*I/L0]],basicForces=mv(kb,elasticBasic),[N,M1,M2]=basicForces;
  const r=[-c,-s,0,c,s,0],z=[s,-c,0,-s,c,0],e1=[0,0,1,0,0,0],e2=[0,0,0,0,0,1];
  const B=[r,z.map((v,i)=>-v/l+e1[i]),z.map((v,i)=>-v/l+e2[i])],internal=mv(transpose(B),basicForces);
  let tangent=mm(transpose(B),mm(kb,B));
  tangent=addMatrix(tangent,outer(z,z),N/l);
  tangent=addMatrix(tangent,addMatrix(outer(r,z),outer(z,r)),(M1+M2)/(l*l));
  const V=(M1+M2)/l;
  return{L0,l,alpha0,alpha,dAlpha,c,s,basic,initialBasic:initial,elasticBasic,basicForces,internal,tangent,endForces:{N1:-N,V1:V,M1,N2:N,V2:-V,M2}};
}

function prepare(project){
  const nodes=project.nodes||[],map=new Map(nodes.map((n,i)=>[n.id,i])),elements=[],nd=nodes.length*3,F=Array(nd).fill(0);
  for(const e of project.elements||[]){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Co-rotacional: elemento ${e.id} referencia nó inexistente.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Co-rotacional: material ausente em ${e.id}.`);
    const section=(project.sections||[]).find(s=>s.id===e.sectionId);
    const a=nodes[i],b=nodes[j],dx0=Number(b.x)-Number(a.x),dy0=Number(b.y)-Number(a.y),L0=Math.hypot(dx0,dy0);if(!(L0>EPS))throw new Error(`Co-rotacional: elemento ${e.id} possui comprimento nulo.`);
    const E=Number(mat.E),A=Number(e.A),I=Number(e.I);if(!(E>0&&A>0&&I>0))throw new Error(`Co-rotacional: propriedades inválidas em ${e.id}.`);
    const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2],c0=dx0/L0,s0=dy0/L0,referenceLoads=prepareReferenceElementLoads(project,e,mat,L0,c0,s0),thermal=prepareThermalInitialState(project,e,mat,section,L0);
    referenceLoads.pGlobal.forEach((v,k)=>{F[idx[k]]+=v});
    elements.push({e,i,j,a,b,E,A,I,idx,c0,s0,thermal,...referenceLoads});
  }
  const prescribed=new Set();
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;if(s.ux)prescribed.add(3*i);if(s.uy)prescribed.add(3*i+1);if(s.rz)prescribed.add(3*i+2)}
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!prescribed.has(i));
  if(!free.length)throw new Error('Co-rotacional: não existem graus de liberdade livres.');
  if(free.length>240)throw new Error(`Co-rotacional v0.13 experimental limita a análise a 240 DOFs livres no navegador; modelo atual: ${free.length}.`);
  for(const load of project.loads||[]){const i=map.get(load.nodeId);if(i==null)continue;F[3*i]+=Number(load.fx)||0;F[3*i+1]+=Number(load.fy)||0;F[3*i+2]+=Number(load.mz)||0}
  return{nodes,map,elements,prescribed,free,nd,F};
}

function assemble(prepared,u,loadFactor=1){
  const K=zeros(prepared.nd),fint=Array(prepared.nd).fill(0),states=[];
  for(const item of prepared.elements){
    const initialBasic=item.thermal.initialBasic.map(v=>v*loadFactor);
    const state=corotationalElementState({X1:Number(item.a.x),Y1:Number(item.a.y),X2:Number(item.b.x),Y2:Number(item.b.y),qGlobal:item.idx.map(i=>u[i]),E:item.E,A:item.A,I:item.I,initialBasic});
    addSub(K,state.tangent,item.idx);state.internal.forEach((v,k)=>{fint[item.idx[k]]+=v});states.push({item,state});
  }
  return{K,fint,states};
}

function residualAt(prepared,u,loadFactor){
  const assembled=assemble(prepared,u,loadFactor),external=prepared.F.map(v=>v*loadFactor),residual=external.map((v,i)=>v-assembled.fint[i]);
  return{...assembled,external,residual,norm:normInf(prepared.free.map(i=>residual[i]))};
}

export function solveFrameCorotational2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project;validateModel(p);const prepared=prepare(p);
  const steps=clamp(Math.round(Number(options.steps??20)||20),1,200),maxIterations=clamp(Math.round(Number(options.maxIterations??35)||35),3,100),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),lineSearch=options.lineSearch!==false;
  const u=Array(prepared.nd).fill(0),history=[];
  let last=null;
  for(let step=1;step<=steps;step++){
    const lambda=step/steps;let converged=false,iteration=0;
    for(iteration=1;iteration<=maxIterations;iteration++){
      const current=residualAt(prepared,u,lambda),thermalScale=Math.max(0,...prepared.elements.flatMap(e=>e.thermal.initialBasic.map(v=>Math.abs(v*lambda)))),scale=Math.max(1,normInf(prepared.free.map(i=>current.external[i])),thermalScale);
      if(current.norm<=tolerance*scale){converged=true;last=current;break}
      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]);let du;
      try{du=solveLinear(Kff,rf)}catch(e){throw new Error(`Co-rotacional: tangente singular no passo ${step}, iteração ${iteration}. ${e.message||e}`)}
      let eta=1,next=null;
      if(lineSearch){
        for(let ls=0;ls<7;ls++){
          const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=eta*du[k]});const candidate=residualAt(prepared,trial,lambda);
          if(candidate.norm<current.norm||eta<=1/64){next={trial,candidate};break}eta*=.5;
        }
      }
      if(!next){const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=du[k]});next={trial,candidate:residualAt(prepared,trial,lambda)}}
      next.trial.forEach((v,i)=>{u[i]=v});last=next.candidate;
      if(u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e4))throw new Error(`Co-rotacional: resposta não física no passo ${step}.`);
    }
    if(!converged){
      const current=residualAt(prepared,u,lambda),thermalScale=Math.max(0,...prepared.elements.flatMap(e=>e.thermal.initialBasic.map(v=>Math.abs(v*lambda)))),scale=Math.max(1,normInf(prepared.free.map(i=>current.external[i])),thermalScale);if(current.norm<=tolerance*scale){converged=true;last=current}
    }
    if(!converged)throw new Error(`Co-rotacional não convergiu no passo ${step}/${steps} em ${maxIterations} iterações.`);
    history.push({step,loadFactor:lambda,iterations:iteration,residualNorm:last.norm});
  }
  last=residualAt(prepared,u,1);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-prepared.F[3*i],fy:last.fint[3*i+1]-prepared.F[3*i+1],mz:last.fint[3*i+2]-prepared.F[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const elementForces=last.states.map(({item,state})=>{
    const endGlobal=state.internal.map((v,k)=>v-item.pGlobal[k]),endLocal=globalVectorToLocal(endGlobal,state.c,state.s);
    return{elementId:item.e.id,type:'frame2d',N1:endLocal[0],V1:endLocal[1],M1:endLocal[2],N2:endLocal[3],V2:endLocal[4],M2:endLocal[5],basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic,initialBasic:state.initialBasic,elasticBasic:state.elasticBasic},loadSummary:{...item.summary,thermal:item.thermal.summary},equivalentNodalLoad:{referenceLocal:item.pLocal,global:item.pGlobal}};
  });
  const base={type:'frame2d-corotational-experimental',solverVersion:'0.13.3-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,reactions,elementForces,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',steps,maxIterations,tolerance,lineSearch,loadModel:'reference-dead mechanical loads + thermal initial strain/curvature',history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}
