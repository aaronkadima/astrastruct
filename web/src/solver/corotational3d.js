import { zeros, addSub, solveLinear } from './matrix.js';
import { spatialAxes, frame3DLocalStiffness } from './spatial3d.js';
import { resolveScenario } from './scenario.js';

const EPS=1e-12;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const norm=v=>Math.hypot(...v);
const normInf=v=>v.length?Math.max(...v.map(x=>Math.abs(x))):0;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('Co-rotacional 3D: vetor degenerado.');return a.map(v=>v/n)};
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const addVector=(a,b)=>a.map((v,i)=>v+b[i]);

function skew(v){return[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]}
function identity3(){return[[1,0,0],[0,1,0],[0,0,1]]}
function add3(A,B,s=1){return A.map((r,i)=>r.map((v,j)=>v+s*B[i][j]))}
function outer3(a,b){return a.map(x=>b.map(y=>x*y))}

export function rotationVectorToMatrix(raw){
  const v=raw.map(Number),theta=norm(v),I=identity3();
  if(theta<1e-10){const K=skew(v),K2=mm(K,K);return add3(add3(I,K),K2,.5)}
  const a=v.map(x=>x/theta),K=skew(a),aa=outer3(a,a),c=Math.cos(theta),s=Math.sin(theta);
  return I.map((r,i)=>r.map((_,j)=>c*I[i][j]+(1-c)*aa[i][j]+s*K[i][j]));
}

export function rotationMatrixToVector(M){
  const c=clamp((M[0][0]+M[1][1]+M[2][2]-1)/2,-1,1),theta=Math.acos(c);
  if(theta<1e-9)return[.5*(M[2][1]-M[1][2]),.5*(M[0][2]-M[2][0]),.5*(M[1][0]-M[0][1])];
  if(Math.PI-theta<1e-6){
    const axis=[
      Math.sqrt(Math.max(0,(M[0][0]+1)/2)),
      Math.sqrt(Math.max(0,(M[1][1]+1)/2)),
      Math.sqrt(Math.max(0,(M[2][2]+1)/2))
    ];
    if(M[2][1]-M[1][2]<0)axis[0]*=-1;
    if(M[0][2]-M[2][0]<0)axis[1]*=-1;
    if(M[1][0]-M[0][1]<0)axis[2]*=-1;
    const n=norm(axis);return(n>EPS?axis.map(x=>theta*x/n):[theta,0,0]);
  }
  const f=theta/(2*Math.sin(theta));
  return[f*(M[2][1]-M[1][2]),f*(M[0][2]-M[2][0]),f*(M[1][0]-M[0][1])];
}

function transform12(R){
  const T=zeros(12);
  for(const off of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[off+i][off+j]=R[i][j];
  return T;
}

function currentFrame(reference,q){
  const x1=add(reference.X1,q.slice(0,3)),x2=add(reference.X2,q.slice(6,9)),dx=sub(x2,x1),l=norm(dx);
  if(!(l>1e-10))throw new Error('Co-rotacional 3D: comprimento corrente degenerado.');
  const ex=unit(dx),Q1=rotationVectorToMatrix(q.slice(3,6)),Q2=rotationVectorToMatrix(q.slice(9,12));
  const ey0=reference.R0[1],ez0=reference.R0[2],ey1=mv(Q1,ey0),ey2=mv(Q2,ey0),ez1=mv(Q1,ez0),ez2=mv(Q2,ez0);
  const project=v=>sub(v,scale(ex,dot(v,ex)));
  let eyCandidate=project(add(ey1,ey2));
  if(norm(eyCandidate)<1e-9){
    const ezCandidate=project(add(ez1,ez2));
    if(norm(ezCandidate)>1e-9)eyCandidate=cross(ezCandidate,ex);
  }
  if(norm(eyCandidate)<1e-9)eyCandidate=project(ey0);
  if(norm(eyCandidate)<1e-9)eyCandidate=project(ez0);
  const ey=unit(eyCandidate),ez=unit(cross(ex,ey)),R=[ex,ey,ez],B0=transpose(reference.R0);
  const rel1=mm(R,mm(Q1,B0)),rel2=mm(R,mm(Q2,B0)),phi1=rotationMatrixToVector(rel1),phi2=rotationMatrixToVector(rel2);
  return{x1,x2,l,ex,ey,ez,R,Q1,Q2,phi1,phi2};
}

function sectionFor(project,e){return(project.sections||[]).find(s=>s.id===e.sectionId)||{}}
function materialFor(project,e){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`Co-rotacional 3D: material ausente em ${e.id}.`);return m}
function prop(e,s,key,fallback){const v=Number(e?.[key]??s?.[key]??fallback);return Number.isFinite(v)?v:0}

function uniformLocalVector(loads,L){
  const p=Array(12).fill(0),summary=[];
  for(const load of loads||[]){
    if(load.kind!=='uniform')continue;
    const qx=Number(load.qx)||0,qy=Number(load.qy)||0,qz=Number(load.qz)||0;
    p[0]+=qx*L/2;p[6]+=qx*L/2;
    p[1]+=qy*L/2;p[7]+=qy*L/2;p[5]+=qy*L*L/12;p[11]-=qy*L*L/12;
    p[2]+=qz*L/2;p[8]+=qz*L/2;p[4]-=qz*L*L/12;p[10]+=qz*L*L/12;
    summary.push({kind:'uniform',qx,qy,qz});
  }
  return{p,summary};
}

function prepareElement(project,e,a,b){
  const axes=spatialAxes(a,b,e),mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),nu=Number(mat.nu),G=Number(mat.G)||(Number.isFinite(nu)?E/(2*(1+nu)):0),A=prop(e,sec,'A'),Iy=prop(e,sec,'Iy',e.I??sec.I),Iz=prop(e,sec,'Iz',e.I??sec.I),J=prop(e,sec,'J');
  if(!(E>0&&G>0&&A>0&&Iy>0&&Iz>0&&J>0))throw new Error(`Co-rotacional 3D: ${e.id} requer E,G,A,Iy,Iz,J positivos.`);
  const kl=frame3DLocalStiffness({E,G,A,Iy,Iz,J,L:axes.L}),T0=transform12(axes.R),loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id),unsupported=loads.find(l=>l.kind!=='uniform');
  if(unsupported)throw new Error(`Co-rotacional 3D v0.29 ainda não aceita carga de barra do tipo "${unsupported.kind}".`);
  const {p:pl,summary}=uniformLocalVector(loads,axes.L),pg=mv(transpose(T0),pl);
  return{e,X1:[Number(a.x),Number(a.y),Number(a.z||0)],X2:[Number(b.x),Number(b.y),Number(b.z||0)],R0:axes.R,L0:axes.L,E,G,A,Iy,Iz,J,kl,T0,pl,pg,loadSummary:summary};
}

export function corotationalFrame3DState({X1,X2,qGlobal,E,G,A,Iy,Iz,J,orientation={}}){
  const a={x:X1[0],y:X1[1],z:X1[2]},b={x:X2[0],y:X2[1],z:X2[2]},axes=spatialAxes(a,b,{id:'state',orientation}),reference={X1:[...X1],X2:[...X2],R0:axes.R,L0:axes.L,E,G,A,Iy,Iz,J,kl:frame3DLocalStiffness({E,G,A,Iy,Iz,J,L:axes.L})};
  return elementState(reference,qGlobal);
}

function elementState(item,qGlobal){
  const q=qGlobal.map(Number),frame=currentFrame(item,q),delta=frame.l-item.L0;
  const d=[-delta/2,0,0,frame.phi1[0],frame.phi1[1],frame.phi1[2],delta/2,0,0,frame.phi2[0],frame.phi2[1],frame.phi2[2]],localForces=mv(item.kl,d),T=transform12(frame.R),internal=mv(transpose(T),localForces);
  return{...frame,delta,localDeformation:d,localForces,T,internal};
}

function numericalTangent(item,q,state=null){
  const base=state||elementState(item,q),K=zeros(12),hL=1e-7*Math.max(1,item.L0),hR=1e-7;
  for(let j=0;j<12;j++){
    const h=(j%6)<3?hL:hR,qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;
    const fp=elementState(item,qp).internal,fm=elementState(item,qm).internal;
    for(let i=0;i<12;i++)K[i][j]=(fp[i]-fm[i])/(2*h);
  }
  return{state:base,tangent:K};
}

function validateModel(project){
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length||!elements.length)throw new Error('Co-rotacional 3D: modelo sem nós ou elementos.');
  if(elements.some(e=>e.type!=='frame3d'))throw new Error('Co-rotacional 3D v0.29 suporta somente modelos compostos por frame3d.');
  if((project.nodeSprings||[]).length)throw new Error('Co-rotacional 3D v0.29 ainda não aceita molas nodais.');
  if((project.settlements||[]).length)throw new Error('Co-rotacional 3D v0.29 ainda não aceita recalques/deslocamentos impostos.');
  if(project.settings?.imperfection?.enabled)throw new Error('Co-rotacional 3D v0.29 ainda não aceita imperfeição geométrica inicial.');
  for(const e of elements){
    if(e.releases&&Object.values(e.releases).some(Boolean))throw new Error(`Co-rotacional 3D v0.29 ainda não aceita releases em ${e.id}.`);
    if(e.rotationalSprings&&Object.values(e.rotationalSprings).some(v=>v!==null&&v!==undefined&&v!==''))throw new Error(`Co-rotacional 3D v0.29 ainda não aceita ligações semirrígidas em ${e.id}.`);
  }
  for(const s of project.supports||[]){
    const vals=['ux','uy','uz','rx','ry','rz'].map(k=>Number(s[`${k}Value`]??s[`base${k[0].toUpperCase()+k.slice(1)}Value`])||0);
    if(vals.some(v=>Math.abs(v)>EPS))throw new Error('Co-rotacional 3D v0.29 requer apoios homogêneos; deslocamentos prescritos não nulos não são suportados.');
  }
}

function prepare(project){
  validateModel(project);const nodes=project.nodes||[],map=new Map(nodes.map((n,i)=>[n.id,i])),elements=[],nd=6*nodes.length,F=Array(nd).fill(0),prescribed=new Map(),fields=['ux','uy','uz','rx','ry','rz'];
  for(const e of project.elements||[]){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Co-rotacional 3D: ${e.id} referencia nó inexistente.`);
    const item=prepareElement(project,e,nodes[i],nodes[j]),idx=[0,1,2,3,4,5,6,7,8,9,10,11].map(k=>k<6?6*i+k:6*j+k-6);item.pg.forEach((v,k)=>{F[idx[k]]+=v});elements.push({...item,idx});
  }
  for(const load of project.loads||[]){const i=map.get(load.nodeId);if(i==null)continue;const vals=[load.fx,load.fy,load.fz,load.mx,load.my,load.mz];for(let k=0;k<6;k++)F[6*i+k]+=Number(vals[k])||0}
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;fields.forEach((f,k)=>{if(s[f])prescribed.set(6*i+k,0)})}
  const fixed=new Set(prescribed.keys()),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));if(!free.length)throw new Error('Co-rotacional 3D: não existem DOFs livres.');
  return{nodes,map,elements,nd,F,prescribed,free};
}

function assemble(prepared,u){
  const K=zeros(prepared.nd),fint=Array(prepared.nd).fill(0),states=[];
  for(const item of prepared.elements){const q=item.idx.map(i=>u[i]),{state,tangent}=numericalTangent(item,q);addSub(K,tangent,item.idx);state.internal.forEach((v,k)=>{fint[item.idx[k]]+=v});states.push({item,state});}
  return{K,fint,states};
}

function residualAt(prepared,u,lambda){
  const assembled=assemble(prepared,u),external=prepared.F.map(v=>lambda*v),residual=external.map((v,i)=>v-assembled.fint[i]),normResidual=normInf(prepared.free.map(i=>residual[i]));
  return{...assembled,external,residual,norm:normResidual};
}

export function solveFrameCorotational3D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project,prepared=prepare(p),steps=clamp(Math.round(Number(options.steps??p.settings?.nonlinearSteps??20)||20),1,100),maxIterations=clamp(Math.round(Number(options.maxIterations??p.settings?.nonlinearMaxIterations??35)||35),3,80),tolerance=Math.max(1e-11,Number(options.tolerance??p.settings?.nonlinearTolerance??1e-8)||1e-8),lineSearch=options.lineSearch??p.settings?.nonlinearLineSearch??true,u=Array(prepared.nd).fill(0),history=[];let last=null;
  for(let step=1;step<=steps;step++){
    const lambda=step/steps;let converged=false,iteration=0;
    for(iteration=1;iteration<=maxIterations;iteration++){
      const current=residualAt(prepared,u,lambda),scaleResidual=Math.max(1,normInf(prepared.free.map(i=>current.external[i])));
      if(current.norm<=tolerance*scaleResidual){converged=true;last=current;break}
      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]);let du;
      try{du=solveLinear(Kff,rf)}catch(e){throw new Error(`Co-rotacional 3D: tangente singular no passo ${step}, iteração ${iteration}. ${e.message||e}`)}
      let eta=1,next=null;
      if(lineSearch){for(let ls=0;ls<7;ls++){const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=eta*du[k]});const candidate=residualAt(prepared,trial,lambda);if(candidate.norm<current.norm||eta<=1/64){next={trial,candidate};break}eta*=.5}}
      if(!next){const trial=[...u];prepared.free.forEach((d,k)=>{trial[d]+=du[k]});next={trial,candidate:residualAt(prepared,trial,lambda)}}
      next.trial.forEach((v,i)=>{u[i]=v});last=next.candidate;
      if(u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e4))throw new Error(`Co-rotacional 3D: resposta não física no passo ${step}.`);
    }
    if(!converged){const current=residualAt(prepared,u,lambda),scaleResidual=Math.max(1,normInf(prepared.free.map(i=>current.external[i])));if(current.norm<=tolerance*scaleResidual){converged=true;last=current}}
    if(!converged)throw new Error(`Co-rotacional 3D não convergiu no passo ${step}/${steps} em ${maxIterations} iterações.`);
    history.push({step,loadFactor:lambda,iterations:iteration,residualNorm:last.norm});
  }
  last=residualAt(prepared,u,1);
  const displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[6*i],uy:u[6*i+1],uz:u[6*i+2],rx:u[6*i+3],ry:u[6*i+4],rz:u[6*i+5]})),reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[6*i]-last.external[6*i],fy:last.fint[6*i+1]-last.external[6*i+1],fz:last.fint[6*i+2]-last.external[6*i+2],mx:last.fint[6*i+3]-last.external[6*i+3],my:last.fint[6*i+4]-last.external[6*i+4],mz:last.fint[6*i+5]-last.external[6*i+5]}));
  const elementForces=last.states.map(({item,state})=>{const pCurrent=mv(state.T,item.pg),q=state.localForces.map((v,i)=>v-pCurrent[i]);return{elementId:item.e.id,type:'frame3d',N1:q[0],Vy1:q[1],Vz1:q[2],T1:q[3],My1:q[4],Mz1:q[5],N2:q[6],Vy2:q[7],Vz2:q[8],T2:q[9],My2:q[10],Mz2:q[11],localDisplacements:state.localDeformation,localAxes:{L:state.l,ex:state.ex,ey:state.ey,ez:state.ez,R:state.R},corotational:{L0:item.L0,l:state.l,axialExtension:state.delta,relativeRotation1:state.phi1,relativeRotation2:state.phi2},loadSummary:item.loadSummary};});
  return{type:'frame3d-corotational-experimental',dimension:'3d',analysisType:'corotational',solverVersion:'0.29.0-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,reactions,elementForces,nonlinear:{formulation:'3D co-rotational Euler-Bernoulli experimental',rotationParameterization:'global rotation vectors + transported corotational triad',tangent:'central numerical derivative of internal nodal forces',steps,maxIterations,tolerance,lineSearch,loadModel:'reference-dead nodal and uniform member loads',history,converged:true,limitations:['frame3d only','no releases/semirigid connections','no imposed displacements','no initial imperfections','no follower/member point/self-weight/thermal loads']}};
}
