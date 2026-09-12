import { spatialAxes } from './spatial3d.js';
import { rotationVectorToMatrix } from './corotational3d.js';

const clone=v=>JSON.parse(JSON.stringify(v));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));

function validateVector(project,imperfection){
  const nd=(project.nodes||[]).length*6,raw=imperfection?.vector;
  if(!Array.isArray(raw)||raw.length!==nd)throw new Error(`Imperfeição co-rotacional 3D: vetor deve possuir ${nd} DOFs.`);
  const vector=raw.map((v,i)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`Imperfeição co-rotacional 3D: valor inválido no DOF ${i}.`);return n});
  const nodeMap=new Map((project.nodes||[]).map((n,i)=>[n.id,i]));
  for(const s of project.supports||[]){const i=nodeMap.get(s.nodeId);if(i==null)continue;for(const [k,d] of [['ux',0],['uy',1],['uz',2],['rx',3],['ry',4],['rz',5]])if(s[k]&&Math.abs(vector[6*i+d])>1e-8)throw new Error(`Imperfeição co-rotacional 3D incompatível com apoio ${s.nodeId}/${k}.`)}
  const maxTranslation=Math.max(0,...vector.filter((_,i)=>i%6<3).map(Math.abs));if(!(maxTranslation>1e-12))throw new Error('Imperfeição co-rotacional 3D sem componente translacional significativa.');
  return{vector,maxTranslation};
}

/**
 * Builds a piecewise-straight stress-free reference geometry from a modal field.
 * Nodal translations move the reference coordinates. Each member local-y axis is
 * rotated by the mean modal end rotation and then reprojected by spatialAxes.
 */
export function buildStressFreeImperfectionReference3D(project,imperfection){
  const {vector,maxTranslation}=validateVector(project,imperfection),out=clone(project),originalNodes=project.nodes||[],index=new Map(originalNodes.map((n,i)=>[n.id,i]));
  out.nodes=(out.nodes||[]).map((n,i)=>({...n,x:Number(n.x||0)+vector[6*i],y:Number(n.y||0)+vector[6*i+1],z:Number(n.z||0)+vector[6*i+2]}));
  const originalById=new Map(originalNodes.map(n=>[n.id,n]));
  out.elements=(out.elements||[]).map(e=>{
    if(e.type!=='frame3d')return e;const a=originalById.get(e.n1),b=originalById.get(e.n2),i=index.get(e.n1),j=index.get(e.n2);if(!a||!b||i==null||j==null)return e;
    const axes=spatialAxes(a,b,e),theta=[0,1,2].map(k=>.5*(vector[6*i+3+k]+vector[6*j+3+k])),Q=rotationVectorToMatrix(theta),up=matVec(Q,axes.ey);
    return{...e,orientation:{...(e.orientation||{}),up}};
  });
  return{project:out,vector,maxTranslation,source:imperfection?.source||'bucklingMode',mode:imperfection?.mode||null,referenceScenarioId:imperfection?.referenceScenarioId||null,criticalFactor:imperfection?.criticalFactor||null,amplitudeMm:Number(imperfection?.amplitudeMm)||maxTranslation*1000};
}

export function decorateCorotational3DImperfectionResult(result,originalProject,reference){
  const vector=reference.vector,nodes=originalProject.nodes||[],initialDisplacements=nodes.map((n,i)=>({nodeId:n.id,ux:vector[6*i],uy:vector[6*i+1],uz:vector[6*i+2],rx:vector[6*i+3],ry:vector[6*i+4],rz:vector[6*i+5]})),byId=new Map((result.displacements||[]).map(d=>[d.nodeId,d]));
  const totalDisplacements=nodes.map((n,i)=>{const d=byId.get(n.id)||{};return{nodeId:n.id,ux:vector[6*i]+Number(d.ux||0),uy:vector[6*i+1]+Number(d.uy||0),uz:vector[6*i+2]+Number(d.uz||0),rx:vector[6*i+3]+Number(d.rx||0),ry:vector[6*i+4]+Number(d.ry||0),rz:vector[6*i+5]+Number(d.rz||0)}});
  return{...result,initialDisplacements,totalDisplacements,nonlinear:{...(result.nonlinear||{}),imperfection:{enabled:true,stressFreeReference:true,source:reference.source,mode:reference.mode,referenceScenarioId:reference.referenceScenarioId,criticalFactor:reference.criticalFactor,amplitude:reference.maxTranslation,amplitudeMm:reference.amplitudeMm,formulation:'piecewise stress-free modal reference geometry'}}};
}
