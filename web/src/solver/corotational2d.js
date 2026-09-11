import { zeros, addSub, solveLinear } from './matrix.js';
import { resolveScenario } from './scenario.js';
import { buildCorotationalResponses } from './corotationalPostprocess.js';

const EPS=1e-12;
const normInf=v=>v.length?Math.max(...v.map(x=>Math.abs(x))):0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const outer=(a,b)=>a.map(x=>b.map(y=>x*y));
const addMatrix=(A,B,scale=1)=>A.map((r,i)=>r.map((v,j)=>v+scale*B[i][j]));
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,v)=>A.map(r=>r.reduce((s,x,j)=>s+x*v[j],0));

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
  if((project.elementLoads||[]).length)throw new Error('Co-rotacional v0.13 experimental aceita somente cargas nodais; cargas de barra serão adicionadas após validação do núcleo.');
  if((project.nodeSprings||[]).length)throw new Error('Co-rotacional v0.13 experimental ainda não aceita molas nodais.');
  for(const s of project.supports||[]){
    if(Math.abs(Number(s.uxValue)||0)>EPS||Math.abs(Number(s.uyValue)||0)>EPS||Math.abs(Number(s.rzValue)||0)>EPS)throw new Error('Co-rotacional v0.13 experimental ainda não aceita deslocamentos impostos.');
  }
}

/**
 * Estado de um elemento de pórtico 2D co-rotacional de Euler-Bernoulli.
 * qGlobal = [u1,v1,theta1,u2,v2,theta2].
 * Deformações básicas: [l-L0, theta1-dAlpha, theta2-dAlpha].
 * A tangente é consistente: Kt = B^T kb B + termos geométricos exatos
 * associados às derivadas de l e alpha.
 */
export function corotationalElementState({X1,Y1,X2,Y2,qGlobal,E,A,I}){
  const q=qGlobal.map(Number),dx0=X2-X1,dy0=Y2-Y1,L0=Math.hypot(dx0,dy0);
  if(!(L0>EPS))throw new Error('Co-rotacional: elemento com comprimento inicial nulo.');
  if(!(E>0&&A>0&&I>0))throw new Error('Co-rotacional: E, A e I devem ser positivos.');
  const alpha0=Math.atan2(dy0,dx0),x1=X1+q[0],y1=Y1+q[1],x2=X2+q[3],y2=Y2+q[4],dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);
  if(!(l>EPS))throw new Error('Co-rotacional: comprimento corrente degenerado.');
  const c=dx/l,s=dy/l,alpha=Math.atan2(dy,dx),dAlpha=wrapAngle(alpha-alpha0),basic=[l-L0,q[2]-dAlpha,q[5]-dAlpha];
  const kb=[[E*A/L0,0,0],[0,4*E*I/L0,2*E*I/L0],[0,2*E*I/L0,4*E*I/L0]],basicForces=mv(kb,basic),[N,M1,M2]=basicForces;
  const r=[-c,-s,0,c,s,0],z=[s,-c,0,-s,c,0],e1=[0,0,1,0,0,0],e2=[0,0,0,0,0,1];
  const B=[r,z.map((v,i)=>-v/l+e1[i]),z.map((v,i)=>-v/l+e2[i])],internal=mv(transpose(B),basicForces);
  let tangent=mm(transpose(B),mm(kb,B));
  tangent=addMatrix(tangent,outer(z,z),N/l);
  tangent=addMatrix(tangent,addMatrix(outer(r,z),outer(z,r)),(M1+M2)/(l*l));
  const V=(M1+M2)/l;
  return{L0,l,alpha0,alpha,dAlpha,c,s,basic,basicForces,internal,tangent,endForces:{N1:-N,V1:V,M1,N2:N,V2:-V,M2}};
}

function prepare(project){
  const nodes=project.nodes||[],map=new Map(nodes.map((n,i)=>[n.id,i])),elements=[];
  for(const e of project.elements||[]){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Co-rotacional: elemento ${e.id} referencia nó inexistente.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Co-rotacional: material ausente em ${e.id}.`);
    const a=nodes[i],b=nodes[j],L0=Math.hypot(b.x-a.x,b.y-a.y);if(!(L0>EPS))throw new Error(`Co-rotacional: elemento ${e.id} possui comprimento nulo.`);
    const E=Number(mat.E),A=Number(e.A),I=Number(e.I);if(!(E>0&&A>0&&I>0))throw new Error(`Co-rotacional: propriedades inválidas em ${e.id}.`);
    elements.push({e,i,j,a,b,E,A,I,idx:[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]});
  }
  const prescribed=new Set();
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;if(s.ux)prescribed.add(3*i);if(s.uy)prescribed.add(3*i+1);if(s.rz)prescribed.add(3*i+2)}
  const nd=nodes.length*3,free=Array.from({length:nd},(_,i)=>i).filter(i=>!prescribed.has(i));
  if(!free.length)throw new Error('Co-rotacional: não existem graus de liberdade livres.');
  if(free.length>240)throw new Error(`Co-rotacional v0.13 experimental limita a análise a 240 DOFs livres no navegador; modelo atual: ${free.length}.`);
  const F=Array(nd).fill(0);for(const load of project.loads||[]){const i=map.get(load.nodeId);if(i==null)continue;F[3*i]+=Number(load.fx)||0;F[3*i+1]+=Number(load.fy)||0;F[3*i+2]+=Number(load.mz)||0}
  return{nodes,map,elements,prescribed,free,nd,F};
}

function assemble(prepared,u){
  const K=zeros(prepared.nd),fint=Array(prepared.nd).fill(0),states=[];
  for(const item of prepared.elements){
    const state=corotationalElementState({X1:Number(item.a.x),Y1:Number(item.a.y),X2:Number(item.b.x),Y2:Number(item.b.y),qGlobal:item.idx.map(i=>u[i]),E:item.E,A:item.A,I:item.I});
    addSub(K,state.tangent,item.idx);state.internal.forEach((v,k)=>{fint[item.idx[k]]+=v});states.push({item,state});
  }
  return{K,fint,states};
}

function residualAt(prepared,u,loadFactor){
  const assembled=assemble(prepared,u),external=prepared.F.map(v=>v*loadFactor),residual=external.map((v,i)=>v-assembled.fint[i]);
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
      const current=residualAt(prepared,u,lambda),scale=Math.max(1,normInf(prepared.free.map(i=>current.external[i])));
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
      const current=residualAt(prepared,u,lambda),scale=Math.max(1,normInf(prepared.free.map(i=>current.external[i])));if(current.norm<=tolerance*scale){converged=true;last=current}
    }
    if(!converged)throw new Error(`Co-rotacional não convergiu no passo ${step}/${steps} em ${maxIterations} iterações.`);
    history.push({step,loadFactor:lambda,iterations:iteration,residualNorm:last.norm});
  }
  last=residualAt(prepared,u,1);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-prepared.F[3*i],fy:last.fint[3*i+1]-prepared.F[3*i+1],mz:last.fint[3*i+2]-prepared.F[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const elementForces=last.states.map(({item,state})=>({elementId:item.e.id,type:'frame2d',...state.endForces,basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic}}));
  const base={type:'frame2d-corotational-experimental',solverVersion:'0.13.0-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,reactions,elementForces,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',steps,maxIterations,tolerance,lineSearch,history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}
