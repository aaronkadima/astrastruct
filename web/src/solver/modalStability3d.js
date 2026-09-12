import { zeros, addSub, mul } from './matrix.js';
import { spatialAxes, frame3DLocalStiffness, solveSpatial3D } from './spatial3d.js';
import { resolveScenario } from './scenario.js';

const G0=9.80665,EPS=1e-12;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const identity=n=>{const I=zeros(n);for(let i=0;i<n;i++)I[i][i]=1;return I};
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const symmetrize=A=>A.map((r,i)=>r.map((_,j)=>.5*(A[i][j]+A[j][i])));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));

function sectionFor(project,e){return (project.sections||[]).find(s=>s.id===e.sectionId)||{}}
function materialFor(project,e){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`3D modal/stability: material ausente em ${e.id}.`);return m}
function prop(e,s,key,fallback){const v=Number(e?.[key]??s?.[key]??fallback);return Number.isFinite(v)?v:0}
function transform12(R){const T=zeros(12);for(const off of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[off+i][off+j]=R[i][j];return T}
function framePrepared(project,e,a,b){
  const axes=spatialAxes(a,b,e),mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),nu=Number(mat.nu),G=Number(mat.G)||(Number.isFinite(nu)?E/(2*(1+nu)):0),A=prop(e,sec,'A'),Iy=prop(e,sec,'Iy',e.I??sec.I),Iz=prop(e,sec,'Iz',e.I??sec.I),J=prop(e,sec,'J');
  if(!(E>0&&G>0&&A>0&&Iy>0&&Iz>0&&J>0))throw new Error(`3D modal/stability: ${e.id} requer E,G,A,Iy,Iz,J positivos.`);
  const kl=frame3DLocalStiffness({E,G,A,Iy,Iz,J,L:axes.L}),T=transform12(axes.R),kg=mm(transpose(T),mm(kl,T));
  return{axes,mat,sec,E,G,A,Iy,Iz,J,kl,T,kg};
}
function trussPrepared(project,e,a,b){
  const axes=spatialAxes(a,b,e),mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),A=prop(e,sec,'A');if(!(E>0&&A>0))throw new Error(`3D modal: ${e.id} requer E e A positivos.`);
  const k=zeros(12),d=axes.ex,c=E*A/axes.L;for(let r=0;r<3;r++)for(let q=0;q<3;q++){const v=c*d[r]*d[q];k[r][q]+=v;k[r][6+q]-=v;k[6+r][q]-=v;k[6+r][6+q]+=v}return{axes,mat,sec,E,A,kg:k};
}
function elementIdx(i,j){return[0,1,2,3,4,5,6,7,8,9,10,11].map(k=>k<6?6*i+k:6*j+k-6)}
function addBlock(M,idx,Q,scale=1){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)M[idx[i]][idx[j]]+=scale*Q[i][j]}

export function frame3DMassLocal({totalMass,L,rotaryMass,formulation='consistent'}){
  if(!(totalMass>0&&L>0))throw new Error('Massa 3D: massa total e comprimento devem ser positivos.');
  const M=zeros(12),kind=formulation==='lumped'?'lumped':'consistent';
  if(kind==='lumped'){
    for(const i of [0,1,2,6,7,8])M[i][i]=totalMass/2;
    if(rotaryMass>0){M[3][3]=rotaryMass/2;M[9][9]=rotaryMass/2}
    return M;
  }
  addBlock(M,[0,6],[[2,1],[1,2]],totalMass/6);
  const Q=[[156,22*L,54,-13*L],[22*L,4*L*L,13*L,-3*L*L],[54,13*L,156,-22*L],[-13*L,-3*L*L,-22*L,4*L*L]],b=totalMass/420;
  addBlock(M,[1,5,7,11],Q,b);
  const D=[1,-1,1,-1],Qw=Q.map((r,i)=>r.map((v,j)=>D[i]*v*D[j]));addBlock(M,[2,4,8,10],Qw,b);
  if(rotaryMass>0)addBlock(M,[3,9],[[2,1],[1,2]],rotaryMass/6);
  return M;
}
function truss3DMassGlobal(totalMass,formulation='consistent'){
  const M=zeros(12),kind=formulation==='lumped'?'lumped':'consistent';
  if(kind==='lumped'){for(const i of [0,1,2,6,7,8])M[i][i]=totalMass/2;return M}
  for(let a=0;a<3;a++){M[a][a]+=totalMass/3;M[a][6+a]+=totalMass/6;M[6+a][a]+=totalMass/6;M[6+a][6+a]+=totalMass/3}return M;
}
function prescribed(project,map,frameNodes){
  const out=new Map(),fields=['ux','uy','uz','rx','ry','rz'];
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;fields.forEach((f,k)=>{if(s[f])out.set(6*i+k,Number(s[`${f}Value`])||0)})}
  for(const [nodeId,i] of map){if(frameNodes.has(nodeId))continue;for(let k=3;k<6;k++)if(!out.has(6*i+k))out.set(6*i+k,0)}
  return out;
}
function cholesky(A,label){
  const n=A.length,L=zeros(n),scale=Math.max(1,...A.map((r,i)=>Math.abs(r[i]))),tol=scale*1e-12;
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];if(i===j){if(!(s>tol))throw new Error(`${label}: matriz de rigidez reduzida não é positiva definida. Verifique apoios/mecanismos.`);L[i][j]=Math.sqrt(s)}else L[i][j]=s/L[j][j]}
  return L;
}
function solveLower(L,b){const n=L.length,x=Array(n).fill(0);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s-=L[i][j]*x[j];x[i]=s/L[i][i]}return x}
function solveUpperLT(L,b){const n=L.length,x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=L[j][i]*x[j];x[i]=s/L[i][i]}return x}
function leftSolveLower(L,B){const n=L.length,m=B[0]?.length||0,X=zeros(n,m);for(let j=0;j<m;j++){const col=solveLower(L,B.map(r=>r[j]));for(let i=0;i<n;i++)X[i][j]=col[i]}return X}
function jacobiSymmetric(A,{tolerance=1e-11,maxIterations=null,label='Autovalor 3D'}={}){
  const n=A.length,B=A.map(r=>[...r]),V=identity(n),maxIter=maxIterations||Math.max(80,n*n*80),norm=Math.max(1,...B.flat().map(Math.abs)),tol=tolerance*norm;let iterations=0;
  for(;iterations<maxIter;iterations++){
    let p=0,q=Math.min(1,n-1),max=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const v=Math.abs(B[i][j]);if(v>max){max=v;p=i;q=j}}if(max<=tol)break;
    const app=B[p][p],aqq=B[q][q],apq=B[p][q],theta=.5*Math.atan2(2*apq,aqq-app),c=Math.cos(theta),s=Math.sin(theta);
    for(let k=0;k<n;k++)if(k!==p&&k!==q){const kp=B[k][p],kq=B[k][q];B[k][p]=B[p][k]=c*kp-s*kq;B[k][q]=B[q][k]=s*kp+c*kq}
    B[p][p]=c*c*app-2*s*c*apq+s*s*aqq;B[q][q]=s*s*app+2*s*c*apq+c*c*aqq;B[p][q]=B[q][p]=0;
    for(let k=0;k<n;k++){const vp=V[k][p],vq=V[k][q];V[k][p]=c*vp-s*vq;V[k][q]=s*vp+c*vq}
  }
  if(iterations>=maxIter)throw new Error(`${label}: decomposição de autovalores não convergiu.`);return{values:B.map((r,i)=>r[i]),vectors:V,iterations};
}
function normalizedDisplay(full,nodes){let max=0,signValue=0;for(let i=0;i<nodes.length;i++)for(let d=0;d<3;d++){const v=full[6*i+d];if(Math.abs(v)>max){max=Math.abs(v);signValue=v}}if(!(max>EPS))max=Math.max(EPS,...full.map(Math.abs));const sign=signValue<0?-1:1;return full.map(v=>sign*v/max)}
function influence(free,offset){return free.map(d=>d%6===offset?1:0)}

export function assembleDynamicSystem3D(project,{massFormulation='consistent'}={}){
  const nodes=project.nodes||[],elements=project.elements||[];if(!nodes.length||!elements.length)throw new Error('Dinâmica 3D v0.27: modelo sem nós ou elementos.');if(elements.some(e=>!['frame3d','truss3d'].includes(e.type)))throw new Error('Dinâmica 3D v0.27 aceita apenas frame3d/truss3d.');
  if((project.settlements||[]).length)throw new Error('Dinâmica 3D v0.27 ainda não admite recalques/deslocamentos impostos.');
  const nd=6*nodes.length,K=zeros(nd),M=zeros(nd),map=new Map(nodes.map((n,i)=>[n.id,i])),frameNodes=new Set(),kind=massFormulation==='lumped'?'lumped':'consistent';
  for(const e of elements){const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Dinâmica 3D: ${e.id} referencia nó inexistente.`);const a=nodes[i],b=nodes[j],idx=elementIdx(i,j),prep=e.type==='frame3d'?framePrepared(project,e,a,b):trussPrepared(project,e,a,b),gamma=Number(prep.mat.density);if(!(gamma>0))throw new Error(`Dinâmica 3D: ${e.id} requer density>0 kN/m³.`);const rho=gamma/G0,total=rho*prep.properties?.A*prep.axes.L||rho*prep.A*prep.axes.L;
    addSub(K,prep.kg,idx);
    if(e.type==='frame3d'){frameNodes.add(e.n1);frameNodes.add(e.n2);const A=prep.A,Ip=Math.max(EPS,Number(e.Ip??prep.sec.Ip)||prep.Iy+prep.Iz),rotary=rho*Ip*prep.axes.L,ml=frame3DMassLocal({totalMass:rho*A*prep.axes.L,L:prep.axes.L,rotaryMass:rotary,formulation:kind}),mg=mm(transpose(prep.T),mm(ml,prep.T));addSub(M,mg,idx)}
    else addSub(M,truss3DMassGlobal(rho*prep.A*prep.axes.L,kind),idx);
  }
  for(const nm of project.nodalMasses||[]){const i=map.get(nm.nodeId);if(i==null)continue;const vals=[nm.mx,nm.my,nm.mz,nm.mrx,nm.mry,nm.mrz??nm.mr];for(let k=0;k<6;k++)M[6*i+k][6*i+k]+=Math.max(0,Number(vals[k])||0)}
  const fixed=prescribed(project,map,frameNodes);for(const [d,v] of fixed)if(Math.abs(v)>1e-12)throw new Error('Dinâmica 3D v0.27 requer apoios homogêneos; deslocamentos prescritos não nulos não são suportados.');
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));if(!free.length)throw new Error('Dinâmica 3D: não existem DOFs livres.');if(free.length>300)throw new Error(`Dinâmica 3D v0.27 limita a análise a 300 DOFs livres; modelo atual: ${free.length}.`);
  const Kf=free.map(i=>free.map(j=>K[i][j])),Mf=free.map(i=>free.map(j=>M[i][j]));cholesky(symmetrize(Kf),'Dinâmica modal 3D');return{nodes,elements,nd,K,M,free,Kf,Mf,massFormulation:kind,gravity:G0};
}

export function solveModal3D(project,options={}){
  const sys=assembleDynamicSystem3D(project,options),requested=clamp(Math.round(Number(options.modes??6)||6),1,20),L=cholesky(symmetrize(sys.Kf),'Dinâmica modal 3D'),B0=leftSolveLower(L,sys.Mf),B=symmetrize(transpose(leftSolveLower(L,transpose(B0)))),eig=jacobiSymmetric(B,{...options,label:'Dinâmica modal 3D'}),maxMu=Math.max(EPS,...eig.values.map(Math.abs)),tol=maxMu*1e-10,positive=eig.values.map((mu,index)=>({mu,index})).filter(x=>x.mu>tol).sort((a,b)=>b.mu-a.mu),rx=influence(sys.free,0),ry=influence(sys.free,1),rz=influence(sys.free,2),Mx=dot(rx,mul(sys.Mf,rx)),My=dot(ry,mul(sys.Mf,ry)),Mz=dot(rz,mul(sys.Mf,rz));
  if(!positive.length)throw new Error('Dinâmica modal 3D: nenhuma massa modal positiva foi encontrada.');let cumX=0,cumY=0,cumZ=0;
  const modes=positive.slice(0,requested).map((cand,k)=>{let x=solveUpperLT(L,eig.vectors.map(r=>r[cand.index])),gm=dot(x,mul(sys.Mf,x));if(!(gm>EPS))throw new Error('Dinâmica modal 3D: massa generalizada degenerada.');x=x.map(v=>v/Math.sqrt(gm));gm=1;const omega=Math.sqrt(1/cand.mu),frequencyHz=omega/(2*Math.PI),period=1/frequencyHz,gk=dot(x,mul(sys.Kf,x)),px=dot(x,mul(sys.Mf,rx)),py=dot(x,mul(sys.Mf,ry)),pz=dot(x,mul(sys.Mf,rz)),effX=px*px,effY=py*py,effZ=pz*pz,rxm=Mx>EPS?effX/Mx:0,rym=My>EPS?effY/My:0,rzm=Mz>EPS?effZ/Mz:0;cumX+=rxm;cumY+=rym;cumZ+=rzm;const fullMass=Array(sys.nd).fill(0);sys.free.forEach((d,i)=>fullMass[d]=x[i]);const display=normalizedDisplay(fullMass,sys.nodes);return{mode:k+1,omega,frequencyHz,period,eigenvalue:omega*omega,generalizedMass:gm,generalizedStiffness:gk,participation:{x:px,y:py,z:pz,effectiveMassX:effX,effectiveMassY:effY,effectiveMassZ:effZ,effectiveMassRatioX:rxm,effectiveMassRatioY:rym,effectiveMassRatioZ:rzm,cumulativeMassRatioX:cumX,cumulativeMassRatioY:cumY,cumulativeMassRatioZ:cumZ},massNormalizedVector:fullMass,vector:display,displacements:sys.nodes.map((n,i)=>({nodeId:n.id,ux:display[6*i],uy:display[6*i+1],uz:display[6*i+2],rx:display[6*i+3],ry:display[6*i+4],rz:display[6*i+5]}))}});
  return{type:'dynamic-modal3d',dimension:'3d',analysisType:'modal',solverVersion:'0.27.0',dofs:sys.nd,freeDofs:sys.free.length,massFormulation:sys.massFormulation,gravity:G0,densityConvention:'material.density interpreted as unit weight [kN/m³]; mass density = density/g',eigenIterations:eig.iterations,totalParticipatingMass:{x:Mx,y:My,z:Mz},modes,displacements:modes[0]?.displacements||[],modal:{modes,requestedModes:requested}};
}

export function frame3DLocalGeometricStiffness(N,L){
  const K=zeros(12);if(!(L>0)||Math.abs(N)<1e-15)return K;const f=N/(30*L),L2=L*L,Q=[[36,3*L,-36,3*L],[3*L,4*L2,-3*L,-L2],[-36,-3*L,36,-3*L],[3*L,-L2,-3*L,4*L2]].map(r=>r.map(v=>v*f));addBlock(K,[1,5,7,11],Q,1);const D=[1,-1,1,-1],Qw=Q.map((r,i)=>r.map((v,j)=>D[i]*v*D[j]));addBlock(K,[2,4,8,10],Qw,1);return K;
}
function physicalAxial(force){return .5*((Number(force.N2)||0)-(Number(force.N1)||0))}

export function solveBuckling3D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project,nodes=p.nodes||[],elements=p.elements||[];if(!nodes.length||!elements.length)throw new Error('Flambagem 3D: modelo sem nós ou elementos.');if(elements.some(e=>e.type!=='frame3d'))throw new Error('Flambagem linear 3D v0.27 aceita somente frame3d; truss3d não possui rigidez flexional de flambagem.');
  const reference=solveSpatial3D(p),axialMap=new Map(reference.elementForces.map(f=>[f.elementId,physicalAxial(f)]));if(![...axialMap.values()].some(N=>N<-1e-9))throw new Error('Flambagem 3D: o cenário de referência não produz compressão significativa.');
  const nd=6*nodes.length,K=zeros(nd),Kg=zeros(nd),map=new Map(nodes.map((n,i)=>[n.id,i])),frameNodes=new Set(nodes.map(n=>n.id));
  for(const e of elements){const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Flambagem 3D: ${e.id} referencia nó inexistente.`);const prep=framePrepared(p,e,nodes[i],nodes[j]),idx=elementIdx(i,j),N=axialMap.get(e.id)||0,kgl=frame3DLocalGeometricStiffness(N,prep.axes.L),kgg=mm(transpose(prep.T),mm(kgl,prep.T));addSub(K,prep.kg,idx);addSub(Kg,kgg,idx)}
  const fixed=prescribed(p,map,frameNodes),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));if(!free.length)throw new Error('Flambagem 3D: não existem DOFs livres.');if(free.length>300)throw new Error(`Flambagem 3D v0.27 limita a análise a 300 DOFs livres; modelo atual: ${free.length}.`);
  const Kf=free.map(i=>free.map(j=>K[i][j])),Gf=free.map(i=>free.map(j=>-Kg[i][j])),L=cholesky(symmetrize(Kf),'Flambagem 3D'),B0=leftSolveLower(L,Gf),B=symmetrize(transpose(leftSolveLower(L,transpose(B0)))),eig=jacobiSymmetric(B,{...options,label:'Flambagem 3D'}),maxMu=Math.max(EPS,...eig.values.map(Math.abs)),tol=maxMu*1e-9,candidates=eig.values.map((mu,index)=>({mu,index})).filter(x=>x.mu>tol).map(x=>({...x,factor:1/x.mu})).filter(x=>Number.isFinite(x.factor)&&x.factor>0).sort((a,b)=>a.factor-b.factor),requested=clamp(Math.round(Number(options.modes??6)||6),1,20);if(!candidates.length)throw new Error('Flambagem 3D: nenhum autovalor crítico positivo foi encontrado.');
  const modes=candidates.slice(0,requested).map((cand,k)=>{const xfree=solveUpperLT(L,eig.vectors.map(r=>r[cand.index])),full=Array(nd).fill(0);free.forEach((d,i)=>full[d]=xfree[i]);const display=normalizedDisplay(full,nodes);return{mode:k+1,factor:cand.factor,mu:cand.mu,vector:display,rawVector:full,displacements:nodes.map((n,i)=>({nodeId:n.id,ux:display[6*i],uy:display[6*i+1],uz:display[6*i+2],rx:display[6*i+3],ry:display[6*i+4],rz:display[6*i+5]}))}});
  return{type:'frame3d-buckling',dimension:'3d',solverVersion:'0.27.0',scenario:resolved.scenario,reference:{elementAxialForces:[...axialMap].map(([elementId,N])=>({elementId,N})),loadPattern:'resolved scenario'},dofs:nd,freeDofs:free.length,eigenIterations:eig.iterations,modes,criticalFactor:modes[0].factor,stability:{formulation:'linear-eigen-buckling-3d',convention:'N>0 tension; compression negative'}};
}
