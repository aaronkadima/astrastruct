import { zeros, addSub, solveLinear } from './matrix.js';
import { resolveScenario } from './scenario.js';
import { buildCorotationalResponses } from './corotationalPostprocess.js';
import { uniformDistributedLoadVector, pointLoadVector } from './frameElement.js';
import { endRotationalStiffness } from './endConnections.js';
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
const maxAbsMatrix=A=>Math.max(0,...A.flat().map(v=>Math.abs(v)));

function validateModel(project,{initialImperfection=null}={}){
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length||!elements.length)throw new Error('Co-rotacional: modelo sem nós ou elementos.');
  if(elements.some(e=>e.type!=='frame2d'))throw new Error('Co-rotacional v0.13 experimental suporta somente elementos frame2d.');
  for(const e of elements)for(const end of [1,2])endRotationalStiffness(e.releases||{},e.rotationalSprings||{},end);
  const unsupported=(project.elementLoads||[]).find(l=>!['uniform','selfWeight','point','thermal','followerEnd'].includes(l.kind));
  if(unsupported)throw new Error(`Co-rotacional experimental ainda não aceita carga de barra do tipo "${unsupported.kind}".`);
  const invalidFollower=(project.elementLoads||[]).find(l=>l.kind==='followerEnd'&&Number(l.end??2)!==2);
  if(invalidFollower)throw new Error('Co-rotacional v0.13.6 experimental aceita força seguidora somente na extremidade 2 do elemento.');
  if((project.nodeSprings||[]).length)throw new Error('Co-rotacional v0.13 experimental ainda não aceita molas nodais.');
  if((project.settlements||[]).length)throw new Error('Co-rotacional v0.13 experimental ainda não aceita recalques/deslocamentos impostos.');
  if(project.settings?.imperfection?.enabled&&!initialImperfection)throw new Error('Co-rotacional: a imperfeição está ativa, mas o vetor da geometria inicial não foi fornecido ao kernel. Use o dispatcher do AstraStruct ou desative a imperfeição.');
  for(const s of project.supports||[]){
    const values=[s.baseUxValue,s.baseUyValue,s.baseRzValue,s.uxValue,s.uyValue,s.rzValue].map(v=>Number(v)||0);
    if(values.some(v=>Math.abs(v)>EPS))throw new Error('Co-rotacional v0.13 experimental ainda não aceita deslocamentos impostos nos apoios.');
  }
}

function normalizeInitialImperfection(project,nodes,raw){
  if(!raw)return null;
  const nd=nodes.length*3;
  if(!Array.isArray(raw.vector)||raw.vector.length!==nd)throw new Error(`Imperfeição co-rotacional inválida: vetor deve possuir ${nd} graus de liberdade.`);
  const vector=raw.vector.map((v,i)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`Imperfeição co-rotacional inválida no DOF ${i}.`);return n});
  const maxTranslation=Math.max(0,...nodes.flatMap((_,i)=>[Math.abs(vector[3*i]),Math.abs(vector[3*i+1])]));
  if(!(maxTranslation>EPS))throw new Error('Imperfeição co-rotacional sem componente translacional significativa.');
  const map=new Map(nodes.map((n,i)=>[n.id,i]));
  for(const s of project.supports||[]){
    const i=map.get(s.nodeId);if(i==null)continue;
    if(s.ux&&Math.abs(vector[3*i])>1e-8)throw new Error(`Imperfeição co-rotacional incompatível com apoio Ux no nó ${s.nodeId}.`);
    if(s.uy&&Math.abs(vector[3*i+1])>1e-8)throw new Error(`Imperfeição co-rotacional incompatível com apoio Uy no nó ${s.nodeId}.`);
    if(s.rz&&Math.abs(vector[3*i+2])>1e-8)throw new Error(`Imperfeição co-rotacional incompatível com apoio Rz no nó ${s.nodeId}.`);
  }
  const referenceNodes=nodes.map((n,i)=>({...n,x:Number(n.x)+vector[3*i],y:Number(n.y)+vector[3*i+1]}));
  return{...raw,vector,maxTranslation,amplitude:Number(raw.amplitude)||maxTranslation,amplitudeMm:Number(raw.amplitudeMm)||maxTranslation*1000,referenceNodes};
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

function prepareReferenceElementLoads(project,e,mat,L0,c0,s0){
  let qx=0,qy=0,pLocal=Array(6).fill(0),selfWeight=0;
  const points=[],loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id);
  for(const load of loads){
    if(load.kind==='thermal'||load.kind==='followerEnd')continue;
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
    summary:{mode:'reference-dead',uniform:{qx,qy},selfWeight,points,reference:{L0,c0,s0,globalPerReferenceLength},supportedKinds:['uniform','selfWeight','point']}
  };
}

function prepareFollowerElementLoads(project,e){
  return(project.elementLoads||[]).filter(l=>l.elementId===e.id&&l.kind==='followerEnd').map(load=>({
    id:load.id,end:Number(load.end??2),px:Number(load.px)||0,py:Number(load.py)||0,
    sourceCaseId:load.sourceCaseId||load.caseId||null,scenarioFactor:Number(load.scenarioFactor??1)
  }));
}

export function followerEndLoadState({px=0,py=0,end=2,l,c,s}){
  const L=Number(l),cc=Number(c),ss=Number(s),Px=Number(px)||0,Py=Number(py)||0,which=Number(end??2);
  if(which!==2)throw new Error('Força seguidora: somente a extremidade 2 é suportada nesta versão.');
  if(!(L>EPS)&&!(Number.isFinite(cc)&&Number.isFinite(ss)))throw new Error('Força seguidora: geometria corrente inválida.');
  if(!(L>EPS))throw new Error('Força seguidora: comprimento corrente inválido.');
  const fx=cc*Px-ss*Py,fy=ss*Px+cc*Py,dfx=-ss*Px-cc*Py,dfy=cc*Px-ss*Py;
  const g=[ss/L,-cc/L,0,-ss/L,cc/L,0],vector=[0,0,0,fx,fy,0],tangent=zeros(6);
  tangent[3]=g.map(v=>dfx*v);tangent[4]=g.map(v=>dfy*v);
  return{end:2,px:Px,py:Py,fx,fy,vector,tangent,dAlphaDq:g,tangentMaxAbs:maxAbsMatrix(tangent)};
}

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
  const initialBasic=[eps0*L0,-kappa0*L0/2,kappa0*L0/2],E=Number(mat.E)||0,A=Number(e.A)||0,I=Number(e.I)||0;
  const forceScale=Math.max(Math.abs(E*A*eps0),Math.abs(E*I*kappa0));
  return{initialBasic,forceScale,summary:{dT,dTGradient,alpha,eps0,kappa0,sectionHeight:sectionDepth(section),initialBasic,forceScale}};
}

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

function connectionStiffnesses(releases={},rotationalSprings={}){
  return[endRotationalStiffness(releases,rotationalSprings,1),endRotationalStiffness(releases,rotationalSprings,2)];
}

function connectionMomentOffsets(rotationalSpringMoments={}){
  const value=key=>{const raw=rotationalSpringMoments?.[key];return Number.isFinite(Number(raw))?Number(raw):0};
  return[value('rz1'),value('rz2')];
}

function condenseTangent(Ke,Tq,Tr,flex,kEnds){
  const Hqq=mm(transpose(Tq),mm(Ke,Tq)),Hqr=mm(transpose(Tq),mm(Ke,Tr)),Hrq=mm(transpose(Tr),mm(Ke,Tq)),Hrr=mm(transpose(Tr),mm(Ke,Tr));
  flex.forEach((end,a)=>{
    const k=kEnds[end],dof=end===0?2:5;
    Hqq[dof][dof]+=k;Hqr[dof][a]-=k;Hrq[a][dof]-=k;Hrr[a][a]+=k;
  });
  const K=Hqq.map(r=>[...r]);
  for(let j=0;j<6;j++){
    const x=solveLinear(Hrr,Hrq.map(r=>r[j]));
    for(let i=0;i<6;i++)K[i][j]-=Hqr[i].reduce((sum,v,a)=>sum+v*x[a],0);
  }
  return K;
}

/**
 * Condensação energética das rotações internas de extremidade.
 * Para uma ligação flexível, theta_e é DOF interno e a mola armazena
 * 1/2*k(theta_n-theta_e)^2. O Hessiano aumentado é condensado por Schur.
 * pGlobal representa dead loads de referência conjugadas aos DOFs do elemento;
 * seus momentos de extremidade participam do equilíbrio interno antes da
 * condensação. Releases são o limite k=0 e rigidez infinita representa ligação rígida.
 */
export function corotationalConnectedElementState({X1,Y1,X2,Y2,qGlobal,E,A,I,initialBasic=[0,0,0],pGlobal=[0,0,0,0,0,0],loadFactor=1,releases={},rotationalSprings={},rotationalSpringMoments={}}){
  const qNode=qGlobal.map(Number),p=pGlobal.map(Number),lambda=Number(loadFactor),kEnds=connectionStiffnesses(releases,rotationalSprings),mEnds=connectionMomentOffsets(rotationalSpringMoments),flex=[0,1].filter(i=>Number.isFinite(kEnds[i]));
  if(!flex.length){
    const state=corotationalElementState({X1,Y1,X2,Y2,qGlobal:qNode,E,A,I,initialBasic});
    return{state,qElement:qNode,gradient:state.internal.map((v,i)=>v-lambda*p[i]),tangent:state.tangent,connectionRotations:[],internalConnectionResidual:0,stiffnesses:kEnds};
  }

  const seed=corotationalElementState({X1,Y1,X2,Y2,qGlobal:qNode,E,A,I,initialBasic}),L0=seed.L0,ei=E*I/L0,Kb=[[4*ei,2*ei],[2*ei,4*ei]],rotDofs=[2,5],initial=initialBasic.map(Number),d0=[seed.dAlpha+initial[1],seed.dAlpha+initial[2]],beta=[qNode[2],qNode[5]],rigid=[0,1].filter(i=>!flex.includes(i));
  const Aint=flex.map((i,a)=>flex.map((j,b)=>Kb[i][j]+(a===b?kEnds[i]:0)));
  const rhs=flex.map(i=>{
    const thermalChord=Kb[i][0]*d0[0]+Kb[i][1]*d0[1],fixed=rigid.reduce((sum,j)=>sum+Kb[i][j]*beta[j],0),k=kEnds[i],theta=qNode[rotDofs[i]],pMoment=lambda*p[rotDofs[i]],offsetMoment=mEnds[i];
    return pMoment+k*theta+offsetMoment+thermalChord-fixed;
  });
  const solved=solveLinear(Aint,rhs);flex.forEach((end,a)=>{beta[end]=solved[a]});
  const qElement=[...qNode];qElement[2]=beta[0];qElement[5]=beta[1];
  const state=corotationalElementState({X1,Y1,X2,Y2,qGlobal:qElement,E,A,I,initialBasic}),beamGradient=state.internal.map((v,i)=>v-lambda*p[i]);

  const Tq=zeros(6),Tr=zeros(6,flex.length);
  for(const d of [0,1,3,4])Tq[d][d]=1;
  rigid.forEach(end=>{const d=rotDofs[end];Tq[d][d]=1});
  flex.forEach((end,a)=>{Tr[rotDofs[end]][a]=1});
  const gradient=mv(transpose(Tq),beamGradient),connectionRotations=[];
  let internalConnectionResidual=0;
  flex.forEach(end=>{
    const dof=rotDofs[end],k=kEnds[end],offsetMoment=mEnds[end],relativeRotation=qNode[dof]-beta[end],springMoment=k*relativeRotation+offsetMoment,elementMoment=beamGradient[dof],residual=elementMoment-springMoment;
    gradient[dof]+=springMoment;internalConnectionResidual=Math.max(internalConnectionResidual,Math.abs(residual));
    connectionRotations.push({dof,end:end+1,k,offsetMoment,nodeRotation:qNode[dof],elementRotation:beta[end],relativeRotation,moment:elementMoment,springMoment,residual,type:k===0?'release':'semirigid'});
  });
  const tangent=condenseTangent(state.tangent,Tq,Tr,flex,kEnds);
  return{state,qElement,gradient,tangent,connectionRotations,internalConnectionResidual,stiffnesses:kEnds,momentOffsets:mEnds};
}

function nodeHasRotationalStiffness(elements,nodeId){
  return elements.some(e=>{
    if(e.n1===nodeId)return endRotationalStiffness(e.releases||{},e.rotationalSprings||{},1)>0;
    if(e.n2===nodeId)return endRotationalStiffness(e.releases||{},e.rotationalSprings||{},2)>0;
    return false;
  });
}

function prepare(project,initialImperfection=null){
  const nominalNodes=project.nodes||[],imperfection=normalizeInitialImperfection(project,nominalNodes,initialImperfection),nodes=imperfection?.referenceNodes||nominalNodes.map(n=>({...n})),map=new Map(nodes.map((n,i)=>[n.id,i])),elements=[],nd=nodes.length*3,F=Array(nd).fill(0);
  for(const e of project.elements||[]){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Co-rotacional: elemento ${e.id} referencia nó inexistente.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Co-rotacional: material ausente em ${e.id}.`);
    const section=(project.sections||[]).find(s=>s.id===e.sectionId),a=nodes[i],b=nodes[j],aNominal=nominalNodes[i],bNominal=nominalNodes[j],dx0=Number(b.x)-Number(a.x),dy0=Number(b.y)-Number(a.y),L0=Math.hypot(dx0,dy0);
    if(!(L0>EPS))throw new Error(`Co-rotacional: elemento ${e.id} possui comprimento de referência nulo após aplicar a imperfeição.`);
    const E=Number(mat.E),A=Number(e.A),I=Number(e.I);if(!(E>0&&A>0&&I>0))throw new Error(`Co-rotacional: propriedades inválidas em ${e.id}.`);
    const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2],c0=dx0/L0,s0=dy0/L0,referenceLoads=prepareReferenceElementLoads(project,e,mat,L0,c0,s0),thermal=prepareThermalInitialState(project,e,mat,section,L0),followers=prepareFollowerElementLoads(project,e);
    elements.push({e,i,j,a,b,aNominal,bNominal,E,A,I,idx,c0,s0,thermal,followers,...referenceLoads});
  }
  const prescribed=new Set();
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;if(s.ux)prescribed.add(3*i);if(s.uy)prescribed.add(3*i+1);if(s.rz)prescribed.add(3*i+2)}
  nodes.forEach((node,i)=>{if(!nodeHasRotationalStiffness(project.elements||[],node.id)&&!prescribed.has(3*i+2))prescribed.add(3*i+2)});
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!prescribed.has(i));
  if(!free.length)throw new Error('Co-rotacional: não existem graus de liberdade livres.');
  if(free.length>240)throw new Error(`Co-rotacional v0.13 experimental limita a análise a 240 DOFs livres no navegador; modelo atual: ${free.length}.`);
  for(const load of project.loads||[]){const i=map.get(load.nodeId);if(i==null)continue;F[3*i]+=Number(load.fx)||0;F[3*i+1]+=Number(load.fy)||0;F[3*i+2]+=Number(load.mz)||0}
  return{nodes,nominalNodes,map,elements,prescribed,free,nd,F,imperfection};
}

function assemble(prepared,u,loadFactor=1,options={}){
  const Kint=zeros(prepared.nd),Kext=zeros(prepared.nd),fint=Array(prepared.nd).fill(0),follower=Array(prepared.nd).fill(0),states=[];
  for(const item of prepared.elements){
    const initialBasic=item.thermal.initialBasic.map(v=>v*loadFactor),qNode=item.idx.map(i=>u[i]);
    const connectionArgs={X1:Number(item.a.x),Y1:Number(item.a.y),X2:Number(item.b.x),Y2:Number(item.b.y),qGlobal:qNode,E:item.E,A:item.A,I:item.I,initialBasic,pGlobal:item.pGlobal,loadFactor,releases:item.e.releases||{},rotationalSprings:item.e.rotationalSprings||{},rotationalSpringMoments:item.e.rotationalSpringMoments||{}};
    const connected=typeof options.connectionResolver==='function'?options.connectionResolver({item,qNode,initialBasic,loadFactor,connectionArgs,solveConnected:(overrides={})=>corotationalConnectedElementState({...connectionArgs,...overrides})}):corotationalConnectedElementState(connectionArgs),state=connected?.state;
    if(!state||!Array.isArray(connected?.gradient)||!Array.isArray(connected?.tangent))throw new Error(`Co-rotacional: resolvedor de ligação retornou estado inválido em ${item.e.id}.`);
    addSub(Kint,connected.tangent,item.idx);connected.gradient.forEach((v,k)=>{fint[item.idx[k]]+=v});
    const followerStates=item.followers.map(load=>{
      const current=followerEndLoadState({px:load.px,py:load.py,end:load.end,l:state.l,c:state.c,s:state.s});
      current.vector.forEach((v,k)=>{follower[item.idx[k]]+=v});addSub(Kext,current.tangent,item.idx);
      return{load,current};
    });
    states.push({item,state,connected,followerStates});
  }
  return{Kint,Kext,fint,follower,states};
}

function residualAt(prepared,u,loadFactor,options={}){
  const assembled=assemble(prepared,u,loadFactor,options),external=prepared.F.map((v,i)=>loadFactor*(v+assembled.follower[i])),residual=external.map((v,i)=>v-assembled.fint[i]),K=addMatrix(assembled.Kint,assembled.Kext,-loadFactor);
  return{...assembled,K,external,residual,norm:normInf(prepared.free.map(i=>residual[i]))};
}

function residualScale(prepared,current,loadFactor){
  const mechanical=normInf(prepared.free.map(i=>current.external[i])),reference=Math.max(0,...prepared.elements.map(e=>normInf(e.pGlobal)*Math.abs(loadFactor))),thermal=Math.max(0,...prepared.elements.map(e=>Math.abs(e.thermal.forceScale*loadFactor)));
  return Math.max(1,mechanical,reference,thermal);
}

export function solveFrameCorotational2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project;validateModel(p,{initialImperfection:options.initialImperfection});const prepared=prepare(p,options.initialImperfection);
  const steps=clamp(Math.round(Number(options.steps??20)||20),1,200),maxIterations=clamp(Math.round(Number(options.maxIterations??35)||35),3,100),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),lineSearch=options.lineSearch!==false;
  const u=Array(prepared.nd).fill(0),history=[];let last=null;
  for(let step=1;step<=steps;step++){
    const lambda=step/steps;let converged=false,iteration=0;
    for(iteration=1;iteration<=maxIterations;iteration++){
      const current=residualAt(prepared,u,lambda,options),scale=residualScale(prepared,current,lambda);
      if(current.norm<=tolerance*scale){converged=true;last=current;break}
      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]);let du;
      try{du=solveLinear(Kff,rf)}catch(e){throw new Error(`Co-rotacional: tangente singular no passo ${step}, iteração ${iteration}. ${e.message||e}`)}
      let eta=1,next=null;
      if(lineSearch){
        for(let ls=0;ls<7;ls++){
          const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=eta*du[k]});const candidate=residualAt(prepared,trial,lambda,options);
          if(candidate.norm<current.norm||eta<=1/64){next={trial,candidate};break}eta*=.5;
        }
      }
      if(!next){const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=du[k]});next={trial,candidate:residualAt(prepared,trial,lambda,options)}}
      next.trial.forEach((v,i)=>{u[i]=v});last=next.candidate;
      if(u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e4))throw new Error(`Co-rotacional: resposta não física no passo ${step}.`);
    }
    if(!converged){const current=residualAt(prepared,u,lambda,options),scale=residualScale(prepared,current,lambda);if(current.norm<=tolerance*scale){converged=true;last=current}}
    if(!converged)throw new Error(`Co-rotacional não convergiu no passo ${step}/${steps} em ${maxIterations} iterações.`);
    const materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0));
    history.push({step,loadFactor:lambda,iterations:iteration,residualNorm:last.norm,materialLocalIterations});
  }
  last=residualAt(prepared,u,1,options);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-last.external[3*i],fy:last.fint[3*i+1]-last.external[3*i+1],mz:last.fint[3*i+2]-last.external[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const initialDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]})):null;
  const totalDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i]+u[3*i],uy:prepared.imperfection.vector[3*i+1]+u[3*i+1],rz:prepared.imperfection.vector[3*i+2]+u[3*i+2]})):null;
  const initialGeometry=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,nominal:{x:Number(n.x),y:Number(n.y)},reference:{x:Number(prepared.nodes[i].x),y:Number(prepared.nodes[i].y)},offset:{ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]}})):null;
  const elementForces=last.states.map(({item,state,connected,followerStates})=>{
    const endGlobal=state.internal.map((v,k)=>v-item.pGlobal[k]),endLocal=globalVectorToLocal(endGlobal,state.c,state.s);
    const followerEnds=followerStates.map(({load,current})=>({id:load.id,end:2,px:load.px,py:load.py,currentGlobal:{fx:current.fx,fy:current.fy},alpha:state.alpha,tangentMaxAbs:current.tangentMaxAbs,consistentExternalTangent:true}));
    return{elementId:item.e.id,type:'frame2d',N1:endLocal[0],V1:endLocal[1],M1:endLocal[2],N2:endLocal[3],V2:endLocal[4],M2:endLocal[5],basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},connectionRotations:connected.connectionRotations,connectionCondensation:{internalResidual:connected.internalConnectionResidual,stiffnesses:connected.stiffnesses,materialLocalIterations:Number(connected.materialLocalIterations)||0,materialResidual:Number(connected.materialResidual)||0,materialMeta:connected.materialConnectionMeta||null},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic,initialBasic:state.initialBasic,elasticBasic:state.elasticBasic,referenceImperfection:prepared.imperfection?{enabled:true}:null},loadSummary:{...item.summary,thermal:item.thermal.summary,followerEnds},equivalentNodalLoad:{referenceLocal:item.pLocal,global:item.pGlobal}};
  });
  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0);
  const imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null;
  const base={type:'frame2d-corotational-experimental',solverVersion:'0.13.6-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,initialDisplacements,totalDisplacements,initialGeometry,reactions,elementForces,imperfection:imperfectionMeta,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',steps,maxIterations,tolerance,lineSearch,loadModel:'reference-dead mechanical loads + thermal initial strain/curvature + follower end forces',followerLoads:{count:followerCount,externalTangent:'consistent',supported:'element end 2 concentrated force'},endConnections:{flexibleEndCount,method:'internal end rotations + Schur condensation',customResolver:typeof options.connectionResolver==='function',experimental:true},imperfection:imperfectionMeta,history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}


function resolveDisplacementControl(prepared, raw={}){
  const nodeId=String(raw.nodeId||'');
  const dof=String(raw.dof||'uy').toLowerCase();
  const offsets={ux:0,uy:1,rz:2};
  if(!(dof in offsets))throw new Error(`Pushover: grau de liberdade controlado inválido "${dof}".`);
  const nodePosition=prepared.map.get(nodeId);
  if(nodePosition==null)throw new Error(`Pushover: nó de controle ${nodeId||'(não definido)'} inexistente.`);
  const index=3*nodePosition+offsets[dof];
  if(prepared.prescribed.has(index)||!prepared.free.includes(index))throw new Error(`Pushover: ${nodeId}/${dof} é restringido ou não possui rigidez ativa; escolha um DOF livre.`);
  const freePosition=prepared.free.indexOf(index);
  const targetDisplacement=Number(raw.targetDisplacement);
  if(!(Number.isFinite(targetDisplacement)&&Math.abs(targetDisplacement)>1e-12))throw new Error('Pushover: deslocamento alvo deve ser finito e diferente de zero.');
  return{nodeId,dof,index,freePosition,targetDisplacement,unit:dof==='rz'?'rad':'m'};
}

function residualLoadDerivative(prepared,u,loadFactor,options={}){
  const h=Math.max(1e-7,1e-6*Math.max(1,Math.abs(loadFactor)));
  const plus=residualAt(prepared,u,loadFactor+h,options),minus=residualAt(prepared,u,loadFactor-h,options);
  return plus.residual.map((v,i)=>(v-minus.residual[i])/(2*h));
}

function displacementControlMerit(prepared,current,controlError,loadFactor,targetDisplacement){
  const forceScale=residualScale(prepared,current,loadFactor),dispScale=Math.max(1e-8,Math.abs(targetDisplacement));
  return Math.hypot(current.norm/forceScale,Math.abs(controlError)/dispScale);
}

function fiberYieldSnapshot(states=[]){
  const rows=[];
  for(const entry of states){
    for(const c of entry.connected?.connectionRotations||[]){
      if(c.type!=='fiber-hinge')continue;
      rows.push({elementId:entry.item.e.id,end:Number(c.end),key:Number(c.end)===1?'rz1':'rz2',yieldedFibers:Number(c.yieldedFibers)||0,fiberCount:Number(c.fiberCount)||0,rotation:Number(c.relativeRotation)||0,moment:Number(c.constitutiveMoment??c.moment)||0,sectionFamily:c.sectionFamily||null});
    }
  }
  return rows;
}

function baseReactionAt(prepared,current,dof){
  const offset=dof==='ux'?0:dof==='uy'?1:2,key=dof==='ux'?'ux':dof==='uy'?'uy':'rz';
  let sum=0;
  for(const support of prepared.supports||[]){
    if(!support?.[key])continue;
    const pos=prepared.map.get(support.nodeId);if(pos==null)continue;
    const i=3*pos+offset;sum+=current.fint[i]-current.external[i];
  }
  return sum;
}

/**
 * v0.16 displacement-controlled equilibrium path.
 *
 * Unknowns at each Newton correction are the free displacement vector and the
 * scalar load-pattern multiplier lambda. With residual R=Pext-fint and the
 * existing tangent convention K*du=R at fixed lambda, the augmented correction
 * is K du - (dR/dlambda) dlambda = R with c^T du = uTarget-uControl.
 * The complete dR/dlambda is evaluated by a centered finite difference so dead,
 * thermal, follower and embedded constitutive effects remain inside the path.
 */
export function solveFrameCorotationalDisplacementControl2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project;
  validateModel(p,{initialImperfection:options.initialImperfection});
  const prepared=prepare(p,options.initialImperfection);prepared.supports=p.supports||[];
  const control=resolveDisplacementControl(prepared,options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??20)||20),1,300),maxIterations=clamp(Math.round(Number(options.maxIterations??40)||40),3,120),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),controlTolerance=Math.max(1e-10,Number(options.displacementTolerance??1e-7)||1e-7),lineSearch=options.lineSearch!==false;
  const u=Array(prepared.nd).fill(0),history=[];let last=null,lambda=0;const yieldedKeys=new Set();let firstYield=null;
  for(let step=1;step<=steps;step++){
    const target=control.targetDisplacement*step/steps,controlScale=Math.max(1e-8,Math.abs(control.targetDisplacement)),controlTolAbs=controlTolerance*controlScale;let converged=false,iteration=0;
    for(iteration=1;iteration<=maxIterations;iteration++){
      const current=residualAt(prepared,u,lambda,options),scale=residualScale(prepared,current,lambda),controlError=target-u[control.index];
      if(current.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current;break}
      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length,augmented=Kff.map((row,i)=>[...row,-pf[i]]),constraint=Array(nf+1).fill(0);constraint[control.freePosition]=1;augmented.push(constraint);let correction;
      try{correction=solveLinear(augmented,[...rf,controlError])}catch(e){throw new Error(`Pushover: sistema aumentado singular no passo ${step}, iteração ${iteration}. O padrão de carga pode não controlar ${control.nodeId}/${control.dof}. ${e.message||e}`)}
      const du=correction.slice(0,nf),dLambda=correction[nf];
      if(!(Number.isFinite(dLambda)&&du.every(Number.isFinite)))throw new Error(`Pushover: correção aumentada inválida no passo ${step}, iteração ${iteration}.`);
      const currentMerit=displacementControlMerit(prepared,current,controlError,lambda,control.targetDisplacement);let eta=1,next=null;
      if(lineSearch){
        for(let ls=0;ls<8;ls++){
          const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=eta*du[k]});const trialLambda=lambda+eta*dLambda,candidate=residualAt(prepared,trial,trialLambda,options),trialError=target-trial[control.index],merit=displacementControlMerit(prepared,candidate,trialError,trialLambda,control.targetDisplacement);
          if(merit<currentMerit||eta<=1/128){next={trial,trialLambda,candidate};break}eta*=.5;
        }
      }
      if(!next){const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=du[k]});const trialLambda=lambda+dLambda;next={trial,trialLambda,candidate:residualAt(prepared,trial,trialLambda,options)}}
      next.trial.forEach((v,i)=>{u[i]=v});lambda=next.trialLambda;last=next.candidate;
      if(!Number.isFinite(lambda)||Math.abs(lambda)>1e7||u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e4))throw new Error(`Pushover: resposta não física no passo ${step}.`);
    }
    if(!converged){const current=residualAt(prepared,u,lambda,options),scale=residualScale(prepared,current,lambda),controlError=target-u[control.index];if(current.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current}}
    if(!converged){const diagnostic=residualAt(prepared,u,lambda,options),controlError=target-u[control.index],scale=residualScale(prepared,diagnostic,lambda);throw new Error(`Pushover não convergiu no passo ${step}/${steps} em ${maxIterations} iterações: lambda=${lambda}, u=${u[control.index]}, alvo=${target}, erroControle=${controlError}, |R|=${diagnostic.norm}, escalaR=${scale}.`)}
    const materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0)),hinges=fiberYieldSnapshot(last.states),yielded=hinges.filter(h=>h.yieldedFibers>0),newlyYielded=[];
    for(const h of yielded){const key=`${h.elementId}:${h.end}`;if(!yieldedKeys.has(key)){yieldedKeys.add(key);newlyYielded.push(h)}}
    if(!firstYield&&newlyYielded.length)firstYield={step,loadFactor:lambda,controlledDisplacement:u[control.index],hinges:newlyYielded};
    history.push({step,loadFactor:lambda,controlledDisplacement:u[control.index],targetDisplacement:target,baseReaction:baseReactionAt(prepared,last,control.dof),iterations:iteration,residualNorm:last.norm,controlResidual:target-u[control.index],materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded});
  }
  last=residualAt(prepared,u,lambda,options);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-last.external[3*i],fy:last.fint[3*i+1]-last.external[3*i+1],mz:last.fint[3*i+2]-last.external[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const initialDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]})):null;
  const totalDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i]+u[3*i],uy:prepared.imperfection.vector[3*i+1]+u[3*i+1],rz:prepared.imperfection.vector[3*i+2]+u[3*i+2]})):null;
  const initialGeometry=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,nominal:{x:Number(n.x),y:Number(n.y)},reference:{x:Number(prepared.nodes[i].x),y:Number(prepared.nodes[i].y)},offset:{ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]}})):null;
  const elementForces=last.states.map(({item,state,connected,followerStates})=>{
    const endGlobal=state.internal.map((v,k)=>v-lambda*item.pGlobal[k]),endLocal=globalVectorToLocal(endGlobal,state.c,state.s);
    const followerEnds=followerStates.map(({load,current})=>({id:load.id,end:2,px:load.px,py:load.py,currentGlobal:{fx:current.fx,fy:current.fy},appliedGlobal:{fx:lambda*current.fx,fy:lambda*current.fy},loadFactor:lambda,alpha:state.alpha,tangentMaxAbs:current.tangentMaxAbs,consistentExternalTangent:true}));
    return{elementId:item.e.id,type:'frame2d',N1:endLocal[0],V1:endLocal[1],M1:endLocal[2],N2:endLocal[3],V2:endLocal[4],M2:endLocal[5],basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},connectionRotations:connected.connectionRotations,connectionCondensation:{internalResidual:connected.internalConnectionResidual,stiffnesses:connected.stiffnesses,materialLocalIterations:Number(connected.materialLocalIterations)||0,materialResidual:Number(connected.materialResidual)||0,materialMeta:connected.materialConnectionMeta||null},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic,initialBasic:state.initialBasic,elasticBasic:state.elasticBasic,referenceImperfection:prepared.imperfection?{enabled:true}:null},loadSummary:{...item.summary,appliedLoadFactor:lambda,thermal:{...item.thermal.summary,appliedFactor:lambda,dTApplied:lambda*Number(item.thermal.summary.dT||0),dTGradientApplied:lambda*Number(item.thermal.summary.dTGradient||0)},followerEnds},equivalentNodalLoad:{referenceLocal:item.pLocal,referenceGlobal:item.pGlobal,appliedGlobal:item.pGlobal.map(v=>lambda*v)}};
  });
  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0),imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null;
  const curve=history.map(h=>({step:h.step,controlledDisplacement:h.controlledDisplacement,loadFactor:h.loadFactor,baseReaction:h.baseReaction,yieldedHingeCount:h.yieldedHingeCount,newlyYieldedHinges:h.newlyYieldedHinges})),peak=curve.reduce((best,row)=>!best||Math.abs(row.loadFactor)>Math.abs(best.loadFactor)?row:best,null),pushover={enabled:true,method:'displacement-control',control,finalLoadFactor:lambda,curve,peakLoadFactor:peak?.loadFactor??lambda,peakControlledDisplacement:peak?.controlledDisplacement??u[control.index],firstYield,loadFactorDerivative:'centered finite difference of complete residual',arcLength:false};
  const base={type:'frame2d-corotational-displacement-control-experimental',solverVersion:'0.16.0-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,initialDisplacements,totalDisplacements,initialGeometry,reactions,elementForces,imperfection:imperfectionMeta,pushover,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',controlMode:'displacement',steps,maxIterations,tolerance,absoluteTolerance,controlTolerance,lineSearch,finalLoadFactor:lambda,loadModel:'scaled reference load pattern + thermal initial strain/curvature + follower end forces',followerLoads:{count:followerCount,externalTangent:'consistent',supported:'element end 2 concentrated force'},endConnections:{flexibleEndCount,method:'internal end rotations + Schur condensation',customResolver:typeof options.connectionResolver==='function',experimental:true},imperfection:imperfectionMeta,pushover,history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}


function resolveArcLengthMonitor(prepared,raw={}){
  const nodeId=String(raw.nodeId||prepared.nodes.at(-1)?.id||'');
  const dof=String(raw.dof||'uy').toLowerCase(),offsets={ux:0,uy:1,rz:2};
  if(!(dof in offsets))throw new Error(`Arc-length: grau de liberdade monitorado inválido "${dof}".`);
  const nodePosition=prepared.map.get(nodeId);
  if(nodePosition==null)throw new Error(`Arc-length: nó monitor ${nodeId||'(não definido)'} inexistente.`);
  const index=3*nodePosition+offsets[dof];
  if(prepared.prescribed.has(index)||!prepared.free.includes(index))throw new Error(`Arc-length: ${nodeId}/${dof} é restringido ou não possui rigidez ativa; escolha um DOF livre para monitoramento.`);
  return{nodeId,dof,index,freePosition:prepared.free.indexOf(index),unit:dof==='rz'?'rad':'m'};
}

function arcCharacteristicLength(prepared){
  const xs=prepared.nodes.map(n=>Number(n.x)),ys=prepared.nodes.map(n=>Number(n.y));
  const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys),diag=Math.hypot(dx,dy);
  const mean=prepared.elements.length?prepared.elements.reduce((s,e)=>s+Number(e.L0||0),0)/prepared.elements.length:0;
  return Math.max(diag,mean,1e-3);
}
function arcWeights(prepared,Lchar){return prepared.free.map(i=>i%3===2?Lchar*Lchar:1)}
function arcDot(a,b,w){return a.reduce((s,v,i)=>s+w[i]*v*b[i],0)}
function arcNorm(du,dLambda,w,alpha){return Math.sqrt(Math.max(0,arcDot(du,du,w)+alpha*alpha*dLambda*dLambda))}
function arcConstraint(du,dLambda,w,alpha,radius){return arcDot(du,du,w)+alpha*alpha*dLambda*dLambda-radius*radius}
function arcMerit(prepared,current,g,lambda,radius){
  const forceScale=residualScale(prepared,current,lambda),constraintScale=Math.max(radius*radius,1e-18);
  return Math.hypot(current.norm/forceScale,Math.abs(g)/constraintScale);
}
function freeVector(prepared,full){return prepared.free.map(i=>full[i])}
function addFreeIncrement(prepared,base,du,scale=1){const out=[...base];prepared.free.forEach((d,k)=>{out[d]+=scale*du[k]});return out}

function arcPredictor(prepared,uBase,lambdaBase,current,radius,weights,alpha,previous,initialSign,options={}){
  const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),dRdl=residualLoadDerivative(prepared,uBase,lambdaBase,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length;
  if(!previous){
    const duHat=solveLinear(Kff,pf),denom=arcNorm(duHat,1,weights,alpha);
    if(!(denom>1e-16&&Number.isFinite(denom)))throw new Error('Arc-length: direção tangente inicial degenerada; verifique o padrão de carga.');
    const dLambda=(initialSign<0?-1:1)*radius/denom,du=duHat.map(v=>v*dLambda);
    return{du,dLambda,loadDerivative:dRdl,orientation:'initial-tangent'};
  }
  const prevNorm=arcNorm(previous.du,previous.dLambda,weights,alpha);
  if(!(prevNorm>1e-16))throw new Error('Arc-length: incremento anterior degenerado para seleção do ramo.');
  const augmented=Kff.map((row,i)=>[...row,-pf[i]]),orientationRow=[...previous.du.map((v,i)=>weights[i]*v/prevNorm),alpha*alpha*previous.dLambda/prevNorm];
  augmented.push(orientationRow);
  const raw=solveLinear(augmented,[...Array(nf).fill(0),radius]),du0=raw.slice(0,nf),dl0=raw[nf],n0=arcNorm(du0,dl0,weights,alpha);
  if(!(n0>1e-16&&Number.isFinite(n0)))throw new Error('Arc-length: preditor de continuação degenerado.');
  const scale=radius/n0;
  return{du:du0.map(v=>v*scale),dLambda:dl0*scale,loadDerivative:dRdl,orientation:'previous-tangent'};
}

function pathTurningEvents(history){
  const events=[];
  for(let i=2;i<history.length;i++){
    const a=history[i-2],b=history[i-1],c=history[i],dl1=b.loadFactor-a.loadFactor,dl2=c.loadFactor-b.loadFactor,du1=b.monitoredDisplacement-a.monitoredDisplacement,du2=c.monitoredDisplacement-b.monitoredDisplacement;
    if(dl1*dl2<0)events.push({type:'load-factor-turning',step:b.step,loadFactor:b.loadFactor,monitoredDisplacement:b.monitoredDisplacement});
    if(du1*du2<0)events.push({type:'displacement-turning',step:b.step,loadFactor:b.loadFactor,monitoredDisplacement:b.monitoredDisplacement});
  }
  return events;
}

/**
 * v0.17 spherical arc-length / Riks continuation.
 * The equilibrium residual follows the existing convention R=Pext-fint and the
 * correction solves the bordered system [K -dR/dlambda; dg/du dg/dlambda].
 * Rotations enter the spherical metric through a characteristic model length so
 * translational and rotational increments share length units.
 */
export function solveFrameCorotationalArcLength2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project;
  validateModel(p,{initialImperfection:options.initialImperfection});
  const prepared=prepare(p,options.initialImperfection);prepared.supports=p.supports||[];
  const monitor=resolveArcLengthMonitor(prepared,options.arcLengthMonitor||options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??40)||40),1,500),maxIterations=clamp(Math.round(Number(options.maxIterations??45)||45),3,140),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),constraintTolerance=Math.max(1e-10,Number(options.arcLengthConstraintTolerance??1e-6)||1e-6),lineSearch=options.lineSearch!==false;
  const initialLoadIncrement=Math.max(1e-5,Math.abs(Number(options.arcLengthInitialLoadIncrement??0.05)||0.05)),initialSign=Number(options.arcLengthInitialSign)<0?-1:1,targetIterations=clamp(Math.round(Number(options.arcLengthTargetIterations??6)||6),2,20),maxCutbacks=clamp(Math.round(Number(options.arcLengthMaxCutbacks??8)||8),0,16),minRadiusFactor=clamp(Number(options.arcLengthMinRadiusFactor??0.02)||0.02,1e-4,1),maxRadiusFactor=Math.max(1,Number(options.arcLengthMaxRadiusFactor??4)||4);
  const Lchar=arcCharacteristicLength(prepared),weights=arcWeights(prepared,Lchar),u=Array(prepared.nd).fill(0),initial=residualAt(prepared,u,0,options),K0=prepared.free.map(i=>prepared.free.map(j=>initial.K[i][j])),p0full=residualLoadDerivative(prepared,u,0,options),p0=prepared.free.map(i=>p0full[i]);
  let duHat0;try{duHat0=solveLinear(K0,p0)}catch(e){throw new Error(`Arc-length: não foi possível obter a direção tangente inicial. ${e.message||e}`)}
  const metric0=Math.sqrt(Math.max(0,arcDot(duHat0,duHat0,weights))),alphaRaw=Number(options.arcLengthLoadScale),alpha=alphaRaw>0&&Number.isFinite(alphaRaw)?alphaRaw:Math.max(metric0,Lchar*1e-6),initialRadius=initialLoadIncrement*arcNorm(duHat0,1,weights,alpha),minRadius=initialRadius*minRadiusFactor,maxRadius=initialRadius*maxRadiusFactor;
  if(!(initialRadius>1e-14&&Number.isFinite(initialRadius)))throw new Error('Arc-length: raio inicial inválido; o padrão de carga pode ser nulo ou incompatível com a estrutura.');
  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null;const history=[],yieldedKeys=new Set();
  for(let step=1;step<=steps;step++){
    const uBase=[...u],lambdaBase=lambda;let accepted=false,lastError=null,iteration=0,cutbacksUsed=0,usedRadius=radius;
    for(let attempt=0;attempt<=maxCutbacks;attempt++){
      cutbacksUsed=attempt;usedRadius=radius;uBase.forEach((v,i)=>{u[i]=v});lambda=lambdaBase;
      try{
        const baseState=residualAt(prepared,uBase,lambdaBase,options),predictor=arcPredictor(prepared,uBase,lambdaBase,baseState,radius,weights,alpha,previous,initialSign,options);
        const predicted=addFreeIncrement(prepared,uBase,predictor.du);predicted.forEach((v,i)=>{u[i]=v});lambda=lambdaBase+predictor.dLambda;last=residualAt(prepared,u,lambda,options);
        let converged=false;
        for(iteration=1;iteration<=maxIterations;iteration++){
          const duStep=prepared.free.map((d,k)=>u[d]-uBase[d]),dLambdaStep=lambda-lambdaBase,g=arcConstraint(duStep,dLambdaStep,weights,alpha,radius),scale=residualScale(prepared,last,lambda),gTol=Math.max(constraintTolerance*radius*radius,1e-14);
          if(last.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(g)<=gTol){converged=true;break}
          const Kff=prepared.free.map(i=>prepared.free.map(j=>last.K[i][j])),rf=prepared.free.map(i=>last.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length,augmented=Kff.map((row,i)=>[...row,-pf[i]]),constraintRow=[...duStep.map((v,i)=>2*weights[i]*v),2*alpha*alpha*dLambdaStep];augmented.push(constraintRow);
          let correction;try{correction=solveLinear(augmented,[...rf,-g])}catch(e){throw new Error(`sistema bordado singular no corretor do passo ${step}, iteração ${iteration}: ${e.message||e}`)}
          const duCorr=correction.slice(0,nf),dlCorr=correction[nf];if(!(Number.isFinite(dlCorr)&&duCorr.every(Number.isFinite)))throw new Error(`correção inválida no passo ${step}, iteração ${iteration}`);
          const currentMerit=arcMerit(prepared,last,g,lambda,radius);let eta=1,next=null;
          if(lineSearch){for(let ls=0;ls<8;ls++){const trial=addFreeIncrement(prepared,u,duCorr,eta),trialLambda=lambda+eta*dlCorr,candidate=residualAt(prepared,trial,trialLambda,options),duTrial=prepared.free.map(d=>trial[d]-uBase[d]),gTrial=arcConstraint(duTrial,trialLambda-lambdaBase,weights,alpha,radius),merit=arcMerit(prepared,candidate,gTrial,trialLambda,radius);if(merit<currentMerit||eta<=1/128){next={trial,trialLambda,candidate};break}eta*=.5}}
          if(!next){const trial=addFreeIncrement(prepared,u,duCorr),trialLambda=lambda+dlCorr;next={trial,trialLambda,candidate:residualAt(prepared,trial,trialLambda,options)}}
          next.trial.forEach((v,i)=>{u[i]=v});lambda=next.trialLambda;last=next.candidate;
          if(!Number.isFinite(lambda)||Math.abs(lambda)>1e8||u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e5))throw new Error(`resposta não física no passo ${step}`);
        }
        if(!converged){const duStep=prepared.free.map(d=>u[d]-uBase[d]),g=arcConstraint(duStep,lambda-lambdaBase,weights,alpha,radius),scale=residualScale(prepared,last,lambda),gTol=Math.max(constraintTolerance*radius*radius,1e-14);if(last.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(g)<=gTol)converged=true}
        if(!converged)throw new Error(`não convergiu em ${maxIterations} iterações (lambda=${lambda}, |R|=${last.norm})`);
        accepted=true;break;
      }catch(e){lastError=e;uBase.forEach((v,i)=>{u[i]=v});lambda=lambdaBase;if(attempt>=maxCutbacks||radius*.5<minRadius)break;radius*=.5}
    }
    if(!accepted)throw new Error(`Arc-length não convergiu no passo ${step}/${steps} após ${cutbacksUsed} cutback(s). ${lastError?.message||lastError||''}`);
    const stepDu=prepared.free.map(d=>u[d]-uBase[d]),stepDl=lambda-lambdaBase,stepNorm=arcNorm(stepDu,stepDl,weights,alpha),materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0)),hinges=fiberYieldSnapshot(last.states),yielded=hinges.filter(h=>h.yieldedFibers>0),newlyYielded=[];
    for(const h of yielded){const key=`${h.elementId}:${h.end}`;if(!yieldedKeys.has(key)){yieldedKeys.add(key);newlyYielded.push(h)}}
    if(!firstYield&&newlyYielded.length)firstYield={step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],hinges:newlyYielded};
    const adapt=clamp(Math.sqrt(targetIterations/Math.max(1,iteration)),.65,1.35),radiusNext=clamp(radius*adapt,minRadius,maxRadius);
    history.push({step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],baseReaction:baseReactionAt(prepared,last,monitor.dof),iterations:iteration,residualNorm:last.norm,arcConstraint:arcConstraint(stepDu,stepDl,weights,alpha,usedRadius),arcRadius:usedRadius,arcNorm:stepNorm,loadIncrement:stepDl,cutbacks:cutbacksUsed,materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded});
    previous={du:stepDu,dLambda:stepDl};radius=radiusNext;
  }
  last=residualAt(prepared,u,lambda,options);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-last.external[3*i],fy:last.fint[3*i+1]-last.external[3*i+1],mz:last.fint[3*i+2]-last.external[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const initialDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]})):null,totalDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i]+u[3*i],uy:prepared.imperfection.vector[3*i+1]+u[3*i+1],rz:prepared.imperfection.vector[3*i+2]+u[3*i+2]})):null,initialGeometry=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,nominal:{x:Number(n.x),y:Number(n.y)},reference:{x:Number(prepared.nodes[i].x),y:Number(prepared.nodes[i].y)},offset:{ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]}})):null;
  const elementForces=last.states.map(({item,state,connected,followerStates})=>{const endGlobal=state.internal.map((v,k)=>v-lambda*item.pGlobal[k]),endLocal=globalVectorToLocal(endGlobal,state.c,state.s),followerEnds=followerStates.map(({load,current})=>({id:load.id,end:2,px:load.px,py:load.py,currentGlobal:{fx:current.fx,fy:current.fy},appliedGlobal:{fx:lambda*current.fx,fy:lambda*current.fy},loadFactor:lambda,alpha:state.alpha,tangentMaxAbs:current.tangentMaxAbs,consistentExternalTangent:true}));return{elementId:item.e.id,type:'frame2d',N1:endLocal[0],V1:endLocal[1],M1:endLocal[2],N2:endLocal[3],V2:endLocal[4],M2:endLocal[5],basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},connectionRotations:connected.connectionRotations,connectionCondensation:{internalResidual:connected.internalConnectionResidual,stiffnesses:connected.stiffnesses,materialLocalIterations:Number(connected.materialLocalIterations)||0,materialResidual:Number(connected.materialResidual)||0,materialMeta:connected.materialConnectionMeta||null},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic,initialBasic:state.initialBasic,elasticBasic:state.elasticBasic,referenceImperfection:prepared.imperfection?{enabled:true}:null},loadSummary:{...item.summary,appliedLoadFactor:lambda,thermal:{...item.thermal.summary,appliedFactor:lambda,dTApplied:lambda*Number(item.thermal.summary.dT||0),dTGradientApplied:lambda*Number(item.thermal.summary.dTGradient||0)},followerEnds},equivalentNodalLoad:{referenceLocal:item.pLocal,referenceGlobal:item.pGlobal,appliedGlobal:item.pGlobal.map(v=>lambda*v)}}});
  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0),imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null,curve=history.map(h=>({step:h.step,monitoredDisplacement:h.monitoredDisplacement,loadFactor:h.loadFactor,baseReaction:h.baseReaction,arcRadius:h.arcRadius,iterations:h.iterations,loadIncrement:h.loadIncrement,cutbacks:h.cutbacks,yieldedHingeCount:h.yieldedHingeCount,newlyYieldedHinges:h.newlyYieldedHinges})),turningPoints=pathTurningEvents(history),peak=curve.reduce((best,row)=>!best||Math.abs(row.loadFactor)>Math.abs(best.loadFactor)?row:best,null);
  const arcLength={enabled:true,method:'crisfield-spherical',monitor,finalLoadFactor:lambda,curve,turningPoints,firstYield,initialLoadIncrement,initialRadius,finalRadius:radius,loadScale:alpha,characteristicLength:Lchar,targetIterations,maxCutbacks,minRadiusFactor,maxRadiusFactor,constraintTolerance,adaptive:true,branchSelection:'positive projection on previous generalized tangent',loadFactorDerivative:'centered finite difference of complete residual',peakLoadFactor:peak?.loadFactor??lambda,peakMonitoredDisplacement:peak?.monitoredDisplacement??u[monitor.index]};
  const base={type:'frame2d-corotational-arc-length-experimental',solverVersion:'0.17.0-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,initialDisplacements,totalDisplacements,initialGeometry,reactions,elementForces,imperfection:imperfectionMeta,arcLength,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',controlMode:'arc-length',steps,maxIterations,tolerance,absoluteTolerance,lineSearch,finalLoadFactor:lambda,loadModel:'scaled reference load pattern + thermal initial strain/curvature + follower end forces',followerLoads:{count:followerCount,externalTangent:'consistent',supported:'element end 2 concentrated force'},endConnections:{flexibleEndCount,method:'internal end rotations + Schur condensation',customResolver:typeof options.connectionResolver==='function',experimental:true},imperfection:imperfectionMeta,arcLength,history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}
