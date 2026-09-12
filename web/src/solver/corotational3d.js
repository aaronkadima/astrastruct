import { spatialAxes } from './spatial3d.js';
import { zeros, solveConstrained } from './matrix.js';

const EPS=1e-12;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('Co-rotacional 3D: vetor degenerado.');return scale(a,1/n)};
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const matMul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const identity3=()=>[[1,0,0],[0,1,0],[0,0,1]];
const columns=(x,y,z)=>[[x[0],y[0],z[0]],[x[1],y[1],z[1]],[x[2],y[2],z[2]]];

function skew(v){return[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]}
function addMatrices(A,B){return A.map((r,i)=>r.map((v,j)=>v+B[i][j]))}
function scaleMatrix(A,s){return A.map(r=>r.map(v=>v*s))}
function transform12(R){const T=zeros(12);for(const o of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[o+i][o+j]=R[i][j];return T}
function maxFree(v,free){let m=0;for(const i of free)m=Math.max(m,Math.abs(Number(v[i])||0));return m}

/** Rodrigues exponential map: global rotation vector -> proper orthogonal matrix. */
export function rotationVectorToMatrix(theta=[0,0,0]){
  const a=[Number(theta[0])||0,Number(theta[1])||0,Number(theta[2])||0],angle=norm(a);
  if(angle<1e-10){const K=skew(a);return addMatrices(identity3(),K)}
  const axis=scale(a,1/angle),K=skew(axis),K2=matMul(K,K);
  return addMatrices(addMatrices(identity3(),scaleMatrix(K,Math.sin(angle))),scaleMatrix(K2,1-Math.cos(angle)));
}

/** SO(3) logarithm map, returned in the local coordinates of the supplied matrix. */
export function matrixToRotationVector(R){
  const c=clamp((R[0][0]+R[1][1]+R[2][2]-1)/2,-1,1),angle=Math.acos(c);
  if(angle<1e-9)return[(R[2][1]-R[1][2])/2,(R[0][2]-R[2][0])/2,(R[1][0]-R[0][1])/2];
  if(Math.PI-angle<1e-6){
    const xx=Math.max(0,(R[0][0]+1)/2),yy=Math.max(0,(R[1][1]+1)/2),zz=Math.max(0,(R[2][2]+1)/2);let axis=[Math.sqrt(xx),Math.sqrt(yy),Math.sqrt(zz)];
    if(R[0][1]<0)axis[1]*=-1;if(R[0][2]<0)axis[2]*=-1;if(norm(axis)<EPS)axis=[1,0,0];axis=unit(axis);return scale(axis,angle);
  }
  const s=2*Math.sin(angle),axis=[(R[2][1]-R[1][2])/s,(R[0][2]-R[2][0])/s,(R[1][0]-R[0][1])/s];
  return scale(axis,angle);
}

function nodePosition(node,u,offset){return[Number(node.x||0)+Number(u[offset]||0),Number(node.y||0)+Number(u[offset+1]||0),Number(node.z||0)+Number(u[offset+2]||0)]}
function nodeRotation(u,offset){return rotationVectorToMatrix([Number(u[offset+3]||0),Number(u[offset+4]||0),Number(u[offset+5]||0)])}

/**
 * Element-level co-rotational kinematics for a spatial Euler-Bernoulli frame.
 * The element frame follows the current chord and filters common rigid-body
 * translation/rotation from the local deformation measures.
 */
export function corotationalFrame3DKinematics(a,b,e={},elementDisplacements=[]){
  if(!Array.isArray(elementDisplacements)||elementDisplacements.length!==12)throw new Error('Co-rotacional 3D: vetor do elemento deve possuir 12 DOFs.');
  const initial=spatialAxes(a,b,e),C0=transpose(initial.R),x1=nodePosition(a,elementDisplacements,0),x2=nodePosition(b,elementDisplacements,6),chord=sub(x2,x1),L=norm(chord);
  if(!(L>1e-10))throw new Error(`Co-rotacional 3D: elemento ${e.id||''} colapsou para comprimento nulo.`);
  const ex=unit(chord),Q1=nodeRotation(elementDisplacements,0),Q2=nodeRotation(elementDisplacements,6),ey0=initial.ey;
  const ey1=matVec(Q1,ey0),ey2=matVec(Q2,ey0),meanY=add(ey1,ey2);let eyCandidate=sub(meanY,scale(ex,dot(meanY,ex)));
  if(norm(eyCandidate)<1e-9){const transported=matVec(Q1,ey0);eyCandidate=sub(transported,scale(ex,dot(transported,ex)))}
  if(norm(eyCandidate)<1e-9){const fallback=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];eyCandidate=sub(fallback,scale(ex,dot(fallback,ex)))}
  const ey=unit(eyCandidate),ez=unit(cross(ex,ey)),C=columns(ex,ey,ez),Ct=transpose(C);
  const relative1=matMul(Ct,matMul(Q1,C0)),relative2=matMul(Ct,matMul(Q2,C0)),theta1=matrixToRotationVector(relative1),theta2=matrixToRotationVector(relative2);
  return{initialLength:initial.L,currentLength:L,axial:L-initial.L,currentAxes:{ex,ey,ez,R:[ex,ey,ez],C},initialAxes:{ex:initial.ex,ey:initial.ey,ez:initial.ez,R:initial.R,C:C0},endRotations:{i:theta1,j:theta2},basic:[L-initial.L,...theta1,...theta2],currentPositions:{i:x1,j:x2},rotationMatrices:{i:Q1,j:Q2},relativeRotationMatrices:{i:relative1,j:relative2}};
}

export function rigidBodyDisplacement3D(node,rotationVector=[0,0,0],translation=[0,0,0]){
  const Q=rotationVectorToMatrix(rotationVector),x=[Number(node.x)||0,Number(node.y)||0,Number(node.z)||0],xr=add(matVec(Q,x),translation);
  return [...sub(xr,x),...rotationVector.map(Number)];
}

function materialFor(project,e){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`Co-rotacional 3D: material ausente em ${e.id}.`);return m}
function sectionFor(project,e){return(project.sections||[]).find(s=>s.id===e.sectionId)||{}}
function prop(e,s,key,fallback){const v=Number(e?.[key]??s?.[key]??fallback);return Number.isFinite(v)?v:0}
function properties(project,e,L0){const m=materialFor(project,e),s=sectionFor(project,e),E=Number(m.E),nu=Number(m.nu),G=Number(m.G)||(Number.isFinite(nu)?E/(2*(1+nu)):0),A=prop(e,s,'A'),Iy=prop(e,s,'Iy',e.I??s.I),Iz=prop(e,s,'Iz',e.I??s.I),J=prop(e,s,'J');for(const [k,v] of Object.entries({E,G,A,Iy,Iz,J,L0}))if(!(Number(v)>0))throw new Error(`Co-rotacional 3D ${e.id}: propriedade ${k} deve ser positiva.`);return{E,G,A,Iy,Iz,J}}

/** Elastic local resisting forces associated with the co-rotated basic state. */
export function corotationalFrame3DInternalForce(project,e,a,b,elementDisplacements=[]){
  const k=corotationalFrame3DKinematics(a,b,e,elementDisplacements),p=properties(project,e,k.initialLength),L0=k.initialLength,L=k.currentLength,t1=k.endRotations.i,t2=k.endRotations.j;
  const N=p.E*p.A/L0*k.axial,Ti=p.G*p.J/L0*(t1[0]-t2[0]),Tj=-Ti;
  const Myi=p.E*p.Iy/L0*(4*t1[1]+2*t2[1]),Myj=p.E*p.Iy/L0*(2*t1[1]+4*t2[1]);
  const Mzi=p.E*p.Iz/L0*(4*t1[2]+2*t2[2]),Mzj=p.E*p.Iz/L0*(2*t1[2]+4*t2[2]);
  const Vyi=(Mzi+Mzj)/L,Vyj=-Vyi,Vzi=-(Myi+Myj)/L,Vzj=-Vzi;
  const local=[-N,Vyi,Vzi,Ti,Myi,Mzi,N,Vyj,Vzj,Tj,Myj,Mzj],T=transform12(k.currentAxes.R),global=matVec(transpose(T),local);
  return{kinematics:k,properties:p,local,global,N,Vy1:Vyi,Vz1:Vzi,T1:Ti,My1:Myi,Mz1:Mzi,Vy2:Vyj,Vz2:Vzj,T2:Tj,My2:Myj,Mz2:Mzj};
}

function validateGlobalScope(project){
  if(!(project.nodes||[]).length||!(project.elements||[]).length)throw new Error('Co-rotacional 3D: modelo vazio.');
  if((project.elements||[]).some(e=>e.type!=='frame3d'))throw new Error('Co-rotacional 3D v0.30 experimental suporta somente elementos frame3d.');
  if((project.elementLoads||[]).length)throw new Error('Co-rotacional 3D v0.30 experimental: cargas de barra ainda não são suportadas; use cargas nodais.');
  if((project.nodeSprings||[]).length||(project.settlements||[]).length)throw new Error('Co-rotacional 3D v0.30 experimental: molas nodais e recalques ainda não são suportados.');
  for(const e of project.elements||[])if(e.releases&&Object.values(e.releases).some(Boolean))throw new Error(`Co-rotacional 3D v0.30 experimental: releases ainda não suportados em ${e.id}.`);
  for(const s of project.supports||[])for(const key of ['ux','uy','uz','rx','ry','rz'])if(s[key]&&Math.abs(Number(s[`${key}Value`])||0)>1e-12)throw new Error('Co-rotacional 3D v0.30 experimental: apoios devem possuir deslocamentos prescritos nulos.');
}

function modelAssembly(project,u){
  const nodes=project.nodes||[],map=new Map(nodes.map((n,i)=>[n.id,i])),Fint=Array(nodes.length*6).fill(0),responses=[];
  for(const e of project.elements||[]){const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Co-rotacional 3D: elemento ${e.id} referencia nó inexistente.`);const idx=[0,1,2,3,4,5].map(k=>6*i+k).concat([0,1,2,3,4,5].map(k=>6*j+k)),ue=idx.map(k=>u[k]),r=corotationalFrame3DInternalForce(project,e,nodes[i],nodes[j],ue);idx.forEach((g,k)=>{Fint[g]+=r.global[k]});responses.push({elementId:e.id,type:'frame3d',N1:-r.local[0],N2:r.local[6],Vy1:r.Vy1,Vz1:r.Vz1,T1:r.T1,My1:r.My1,Mz1:r.Mz1,Vy2:r.Vy2,Vz2:r.Vz2,T2:r.T2,My2:r.My2,Mz2:r.Mz2,localForces:r.local,localDisplacements:r.kinematics.basic,currentAxes:r.kinematics.currentAxes,currentLength:r.kinematics.currentLength,initialLength:r.kinematics.initialLength})}
  return{Fint,responses};
}
function externalVector(project,map){const F=Array((project.nodes||[]).length*6).fill(0);for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;const vals=[l.fx,l.fy,l.fz,l.mx,l.my,l.mz];for(let k=0;k<6;k++)F[6*i+k]+=Number(vals[k])||0}return F}
function prescribedDofs(project,map){const p=new Map(),keys=['ux','uy','uz','rx','ry','rz'];for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;keys.forEach((k,d)=>{if(s[k])p.set(6*i+d,0)})}return p}
function numericalTangent(project,u,base,fdStep){const nd=u.length,K=zeros(nd),char=Math.max(1,...(project.elements||[]).map(e=>{const a=(project.nodes||[]).find(n=>n.id===e.n1),b=(project.nodes||[]).find(n=>n.id===e.n2);return a&&b?spatialAxes(a,b,e).L:1}));for(let j=0;j<nd;j++){const rotational=j%6>=3,h=Math.max(1e-9,fdStep*Math.max(1,rotational?Math.abs(u[j]):char,Math.abs(u[j]))),up=[...u];up[j]+=h;const fp=modelAssembly(project,up).Fint;for(let i=0;i<nd;i++)K[i][j]=(fp[i]-base[i])/h}return K}

/**
 * Experimental global elastic co-rotational frame3d solver (v0.30 foundation).
 * Uses a numerically differentiated tangent so kinematic correctness can be
 * validated before replacing it with a closed-form consistent tangent.
 */
export function solveFrameCorotational3D(project,options={}){
  validateGlobalScope(project);const nodes=project.nodes||[],nd=nodes.length*6,map=new Map(nodes.map((n,i)=>[n.id,i])),prescribed=prescribedDofs(project,map),free=Array.from({length:nd},(_,i)=>i).filter(i=>!prescribed.has(i)),Fref=externalVector(project,map);
  if(!free.length)throw new Error('Co-rotacional 3D: modelo sem graus de liberdade livres.');
  const steps=Math.max(1,Math.min(100,Math.round(Number(options.steps??project.settings?.nonlinearSteps??10)))),maxIterations=Math.max(3,Math.min(80,Math.round(Number(options.maxIterations??project.settings?.nonlinearMaxIterations??30)))),tolerance=Math.max(1e-10,Number(options.tolerance??project.settings?.nonlinearTolerance??1e-7)),fdStep=Math.max(1e-9,Math.min(1e-4,Number(options.fdStep??2e-7))),lineSearch=options.lineSearch??true;
  let u=Array(nd).fill(0),last=null;const history=[];
  for(let step=1;step<=steps;step++){
    const lambda=step/steps;let converged=false,residualNorm=Infinity,iterations=0;
    for(let iteration=1;iteration<=maxIterations;iteration++){
      iterations=iteration;const assembled=modelAssembly(project,u),target=Fref.map(v=>lambda*v),residual=target.map((v,i)=>v-assembled.Fint[i]);residualNorm=maxFree(residual,free);const scaleR=Math.max(1,maxFree(target,free));
      if(residualNorm<=tolerance*scaleR){converged=true;last=assembled;break}
      const K=numericalTangent(project,u,assembled.Fint,fdStep),du=solveConstrained(K,residual,prescribed).u;if(du.some(v=>!Number.isFinite(v)))throw new Error(`Co-rotacional 3D: incremento não finito no passo ${step}.`);
      let alpha=1,best=u.map((v,i)=>v+du[i]),bestNorm=Infinity;
      if(lineSearch){for(let cut=0;cut<8;cut++){const trial=u.map((v,i)=>v+alpha*du[i]),fi=modelAssembly(project,trial).Fint,rr=target.map((v,i)=>v-fi[i]),n=maxFree(rr,free);if(n<bestNorm){bestNorm=n;best=trial}if(n<residualNorm)break;alpha*=.5}}
      u=best;if(Math.max(...u.map(Math.abs))>1e4)throw new Error('Co-rotacional 3D divergiu: deslocamentos/rotações não físicos.');
    }
    if(!converged){const a=modelAssembly(project,u),target=Fref.map(v=>lambda*v),r=target.map((v,i)=>v-a.Fint[i]);residualNorm=maxFree(r,free);if(residualNorm<=tolerance*Math.max(1,maxFree(target,free))){converged=true;last=a}}
    if(!converged)throw new Error(`Co-rotacional 3D não convergiu no passo ${step}/${steps} após ${maxIterations} iterações (‖r‖∞=${residualNorm.toExponential(3)}).`);
    history.push({step,lambda,iterations,residualNorm});
  }
  last=last||modelAssembly(project,u);const reactions=last.Fint.map((v,i)=>v-Fref[i]),displacements=nodes.map((n,i)=>({nodeId:n.id,ux:u[6*i],uy:u[6*i+1],uz:u[6*i+2],rx:u[6*i+3],ry:u[6*i+4],rz:u[6*i+5]}));
  return{type:'frame3d-corotational',dimension:'3d',analysisType:'corotational',solverVersion:'0.30.0-exp',dofs:nd,activeDofs:free.length,displacements,reactions:nodes.map((n,i)=>({nodeId:n.id,fx:reactions[6*i],fy:reactions[6*i+1],fz:reactions[6*i+2],mx:reactions[6*i+3],my:reactions[6*i+4],mz:reactions[6*i+5]})),elementForces:last.responses,nonlinear:{formulation:'spatial co-rotational Euler-Bernoulli frame; numerical consistent tangent foundation',steps,maxIterations,tolerance,fdStep,lineSearch,history,converged:true}};
}
