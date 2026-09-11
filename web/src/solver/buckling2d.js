import { zeros, addSub } from './matrix.js';
import { frameLocalStiffness, frameTransform, transpose, mm } from './frameElement.js';
import { frameLocalGeometricStiffness } from './pdelta2d.js';
import { addNodalSprings } from './springs.js';
import { resolveScenario } from './scenario.js';
import { solveFrame2D } from './frame2d.js';

const EPS=1e-12;

function identity(n){const I=zeros(n);for(let i=0;i<n;i++)I[i][i]=1;return I}
function cloneMatrix(A){return A.map(r=>[...r])}
function symmetrize(A){return A.map((row,i)=>row.map((_,j)=>0.5*(A[i][j]+A[j][i])))}
function neg(A){return A.map(row=>row.map(v=>-v))}

function cholesky(A){
  const n=A.length,L=zeros(n),scale=Math.max(1,...A.map((r,i)=>Math.abs(r[i]))),tol=scale*1e-12;
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
    if(i===j){if(!(s>tol))throw new Error('Flambagem: matriz elástica não é positiva definida. Verifique apoios, mecanismos e rigidez do modelo.');L[i][j]=Math.sqrt(s)}
    else L[i][j]=s/L[j][j];
  }
  return L;
}
function solveLower(L,b){
  const n=L.length,x=Array(n).fill(0);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s-=L[i][j]*x[j];x[i]=s/L[i][i]}return x;
}
function solveUpperFromLowerTranspose(L,b){
  const n=L.length,x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=L[j][i]*x[j];x[i]=s/L[i][i]}return x;
}
function leftSolveLower(L,B){
  const n=L.length,m=B[0]?.length||0,X=zeros(n,m);for(let j=0;j<m;j++){const col=solveLower(L,B.map(r=>r[j]));for(let i=0;i<n;i++)X[i][j]=col[i]}return X;
}

function jacobiSymmetric(A,{maxIterations,tolerance}={}){
  const n=A.length,B=cloneMatrix(A),V=identity(n),maxIter=maxIterations||Math.max(60,n*n*60),norm=Math.max(1,...B.flat().map(Math.abs)),tol=(tolerance||1e-11)*norm;
  let iterations=0;
  for(;iterations<maxIter;iterations++){
    let p=0,q=1,max=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const v=Math.abs(B[i][j]);if(v>max){max=v;p=i;q=j}}
    if(max<=tol)break;
    const app=B[p][p],aqq=B[q][q],apq=B[p][q],theta=.5*Math.atan2(2*apq,aqq-app),c=Math.cos(theta),s=Math.sin(theta);
    for(let k=0;k<n;k++)if(k!==p&&k!==q){const bkp=B[k][p],bkq=B[k][q];B[k][p]=B[p][k]=c*bkp-s*bkq;B[k][q]=B[q][k]=s*bkp+c*bkq}
    B[p][p]=c*c*app-2*s*c*apq+s*s*aqq;B[q][q]=s*s*app+2*s*c*apq+c*c*aqq;B[p][q]=B[q][p]=0;
    for(let k=0;k<n;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq}
  }
  if(iterations>=maxIter)throw new Error('Flambagem: decomposição de autovalores não convergiu.');
  return{values:B.map((r,i)=>r[i]),vectors:V,iterations};
}

function physicalAxial(force){return .5*((Number(force.N2)||0)-(Number(force.N1)||0))}
function hasFlexibleEnds(e){
  if(e.releases?.rz1||e.releases?.rz2)return true;
  for(const key of ['rz1','rz2']){const raw=e.rotationalSprings?.[key];if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw)))return true}
  return false;
}
function prescribedDofs(project,map){
  const set=new Set();for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;if(s.ux)set.add(3*i);if(s.uy)set.add(3*i+1);if(s.rz)set.add(3*i+2)}return set;
}

export function solveBuckling2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project,nodes=p.nodes||[],elements=p.elements||[];
  if(!nodes.length||!elements.length)throw new Error('Flambagem: modelo sem nós ou elementos.');
  if(elements.some(e=>e.type!=='frame2d'))throw new Error('Flambagem linear v0.11 suporta somente modelos formados por frame2d.');
  if(elements.some(hasFlexibleEnds))throw new Error('Flambagem linear v0.11 ainda requer extremidades rígidas. Releases e ligações semirrígidas serão habilitados após validação específica.');

  const requested=Math.max(1,Math.min(12,Math.round(Number(options.modes??5)))),reference=solveFrame2D(p),nd=nodes.length*3,map=new Map(nodes.map((n,i)=>[n.id,i])),K=zeros(nd),Kg=zeros(nd),axialMap=new Map(reference.elementForces.map(f=>[f.elementId,physicalAxial(f)]));
  const compressive=[...axialMap.values()].filter(N=>N<-1e-9);if(!compressive.length)throw new Error('Flambagem: o cenário de referência não produz esforços axiais de compressão significativos.');

  for(const e of elements){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Flambagem: elemento ${e.id} referencia nó inexistente.`);
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>1e-10))throw new Error(`Flambagem: elemento ${e.id} possui comprimento nulo.`);
    const mat=(p.materials||[]).find(m=>m.id===e.materialId);if(!mat)throw new Error(`Flambagem: material ausente em ${e.id}.`);
    const E=Number(mat.E),A=Number(e.A),I=Number(e.I);if(!(E>0&&A>0&&I>0))throw new Error(`Flambagem: E, A e I devem ser positivos em ${e.id}.`);
    const c=dx/L,s=dy/L,T=frameTransform(c,s),Tt=transpose(T),ke=mm(Tt,mm(frameLocalStiffness(E,A,I,L),T)),N=axialMap.get(e.id)||0,kge=mm(Tt,mm(frameLocalGeometricStiffness(N,L),T)),idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];
    addSub(K,ke,idx);addSub(Kg,kge,idx);
  }
  addNodalSprings(K,p,map,3);
  const fixed=prescribedDofs(p,map),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));
  if(!free.length)throw new Error('Flambagem: não existem graus de liberdade livres.');
  if(free.length>240)throw new Error(`Flambagem linear v0.11 limita a análise a 240 graus de liberdade livres no navegador; modelo atual: ${free.length}.`);

  const Kf=free.map(i=>free.map(j=>K[i][j])),Gf=free.map(i=>free.map(j=>-Kg[i][j])),L=cholesky(symmetrize(Kf)),B=leftSolveLower(L,Gf),Ared=symmetrize(transpose(leftSolveLower(L,transpose(B)))),eig=jacobiSymmetric(Ared,options);
  const maxMu=Math.max(EPS,...eig.values.map(Math.abs)),muTol=maxMu*1e-9,candidates=eig.values.map((mu,index)=>({mu,index})).filter(x=>x.mu>muTol).map(x=>({...x,factor:1/x.mu})).filter(x=>Number.isFinite(x.factor)&&x.factor>0).sort((a,b)=>a.factor-b.factor);
  if(!candidates.length)throw new Error('Flambagem: nenhum autovalor crítico positivo foi encontrado para o padrão de cargas de referência.');

  const modes=candidates.slice(0,requested).map((cand,modeIndex)=>{
    const y=eig.vectors.map(row=>row[cand.index]),xfree=solveUpperFromLowerTranspose(L,y),full=Array(nd).fill(0);free.forEach((d,i)=>{full[d]=xfree[i]});
    let maxTranslation=0,sign=1,signValue=0;for(let i=0;i<nodes.length;i++)for(const d of [3*i,3*i+1]){const v=full[d];if(Math.abs(v)>maxTranslation){maxTranslation=Math.abs(v);signValue=v}}
    if(!(maxTranslation>EPS))maxTranslation=Math.max(EPS,...full.map(Math.abs));if(signValue<0)sign=-1;for(let i=0;i<full.length;i++)full[i]=sign*full[i]/maxTranslation;
    return{mode:modeIndex+1,factor:cand.factor,mu:cand.mu,vector:full,displacements:nodes.map((n,i)=>({nodeId:n.id,ux:full[3*i],uy:full[3*i+1],rz:full[3*i+2]}))};
  });

  return{type:'frame2d-buckling',solverVersion:'0.11.0',scenario:resolved.scenario,reference:{elementAxialForces:[...axialMap].map(([elementId,N])=>({elementId,N})),loadPattern:'resolved scenario'},dofs:nd,freeDofs:free.length,eigenIterations:eig.iterations,modes,criticalFactor:modes[0].factor};
}
