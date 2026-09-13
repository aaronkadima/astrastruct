import { spatialAxes } from './spatial3d.js';
import { solveFrameCorotational3D } from './corotational3d.js';
import { prestressInitialState3D } from '../loadStage/prestress.js';

const EPS=1e-12;
const clone=v=>JSON.parse(JSON.stringify(v));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const zeros12=()=>Array(12).fill(0);
const add12=(a,b)=>a.map((v,i)=>v+b[i]);

function transform12(R){
  const T=Array.from({length:12},()=>Array(12).fill(0));
  for(const o of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[o+i][o+j]=R[i][j];
  return T;
}
function sectionFor(project,e){return(project.sections||[]).find(s=>s.id===e.sectionId)||{}}
function materialFor(project,e){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`Co-rotacional 3D: material ausente em ${e.id}.`);return m}
function areaFor(project,e){const s=sectionFor(project,e),A=Number(e.A??s.A);if(!(A>0))throw new Error(`Co-rotacional 3D ${e.id}: área A deve ser positiva para peso próprio.`);return A}
function positiveProp(e,s,key,fallback){const v=Number(e?.[key]??s?.[key]??fallback);if(!(v>0))throw new Error(`Co-rotacional 3D ${e.id}: propriedade ${key} deve ser positiva para protensão.`);return v}
function prestressThermalEquivalent(project,e,load){
  const mat=materialFor(project,e),s=sectionFor(project,e),E=Number(mat.E),A=positiveProp(e,s,'A'),Iy=positiveProp(e,s,'Iy',e.I??s.I),Iz=positiveProp(e,s,'Iz',e.I??s.I),alpha=Number(mat.alpha)||0;if(!(E>0&&alpha!==0))throw new Error(`Co-rotacional 3D ${e.id}: E e alpha não nulo são necessários para equivalência de protensão.`);
  const ps=prestressInitialState3D({force:load.force,eccentricityY:load.eccentricityY??load.eccentricity??0,eccentricityZ:load.eccentricityZ??0,effectiveFactor:load.effectiveFactor??1,E,A,Iy,Iz}),hY=Number(e.h??e.depth??s.h??s.depth)||0,hZ=Number(e.b??e.width??s.b??s.width)||0;
  if(Math.abs(ps.kappaZ)>EPS&&!(hY>0))throw new Error(`Co-rotacional 3D ${e.id}: eccentricidade local-y requer h/depth para equivalência de protensão.`);if(Math.abs(ps.kappaY)>EPS&&!(hZ>0))throw new Error(`Co-rotacional 3D ${e.id}: eccentricidade local-z requer b/width para equivalência de protensão.`);
  return{id:`__PS_${load.id||e.id}`,kind:'thermal',elementId:e.id,dT:ps.eps0/alpha,dTGradientY:Math.abs(ps.kappaZ)>EPS?-ps.kappaZ*hY/alpha:0,dTGradientZ:Math.abs(ps.kappaY)>EPS?ps.kappaY*hZ/alpha:0,sourceKind:'prestress',prestress:ps,actionId:load.actionId??null,caseId:load.caseId??null};
}

export function uniformLoadVector3D(qx=0,qy=0,qz=0,L=0){
  if(!(L>0))throw new Error('Carga uniforme 3D: comprimento deve ser positivo.');
  const p=zeros12();
  p[0]=qx*L/2;p[6]=qx*L/2;
  p[1]=qy*L/2;p[7]=qy*L/2;p[5]=qy*L*L/12;p[11]=-qy*L*L/12;
  p[2]=qz*L/2;p[8]=qz*L/2;p[4]=-qz*L*L/12;p[10]=qz*L*L/12;
  return p;
}
export function pointLoadVector3D(px=0,py=0,pz=0,L=0,xi=.5){
  if(!(L>0))throw new Error('Carga pontual 3D: comprimento deve ser positivo.');
  const r=Math.max(0,Math.min(1,Number(xi))),r2=r*r,r3=r2*r,h1=1-3*r2+2*r3,h2=L*(r-2*r2+r3),h3=3*r2-2*r3,h4=L*(-r2+r3),p=zeros12();
  p[0]=px*(1-r);p[6]=px*r;
  p[1]=py*h1;p[5]=py*h2;p[7]=py*h3;p[11]=py*h4;
  p[2]=pz*h1;p[4]=-pz*h2;p[8]=pz*h3;p[10]=-pz*h4;
  return p;
}

/**
 * Converts conservative mechanical frame3d element actions into constant global
 * equivalent nodal dead loads on the reference configuration. Thermal,
 * prestress (mapped to the same initial-strain variables) and followerEnd actions
 * remain attached to the element.
 */
export function prepareCorotational3DDeadLoads(project){
  const out=clone(project),nodes=out.nodes||[],map=new Map(nodes.map(n=>[n.id,n])),synthetic=[],metadata=new Map(),allowed=new Set(['uniform','point','selfWeight','thermal','prestress','followerEnd']),unsupported=(out.elementLoads||[]).find(l=>!allowed.has(l.kind));
  if(unsupported)throw new Error(`Co-rotacional 3D v0.40: carga de barra '${unsupported.kind||'desconhecida'}' ainda não é suportada.`);
  const elementMap=new Map((out.elements||[]).map(e=>[e.id,e])),retainedLoads=[];for(const load of out.elementLoads||[]){if(load.kind==='thermal'||load.kind==='followerEnd')retainedLoads.push(load);else if(load.kind==='prestress'){const e=elementMap.get(load.elementId);if(!e)throw new Error(`Co-rotacional 3D: elemento ${load.elementId} da protensão não encontrado.`);retainedLoads.push(prestressThermalEquivalent(out,e,load))}}
  for(const e of out.elements||[]){
    if(e.type!=='frame3d')continue;
    const a=map.get(e.n1),b=map.get(e.n2);if(!a||!b)throw new Error(`Co-rotacional 3D: elemento ${e.id} referencia nó inexistente.`);
    const axes=spatialAxes(a,b,e),T=transform12(axes.R),loads=(out.elementLoads||[]).filter(l=>l.elementId===e.id&&['uniform','point','selfWeight'].includes(l.kind));let pl=zeros12();const summary=[];
    for(const load of loads){
      let p=null;
      if(load.kind==='uniform'){
        const qx=Number(load.qx)||0,qy=Number(load.qy)||0,qz=Number(load.qz)||0;p=uniformLoadVector3D(qx,qy,qz,axes.L);summary.push({kind:'uniform',qx,qy,qz});
      }else if(load.kind==='point'){
        const px=Number(load.px)||0,py=Number(load.py)||0,pz=Number(load.pz)||0,xi=Math.max(0,Math.min(1,Number(load.xi??.5)));p=pointLoadVector3D(px,py,pz,axes.L,xi);summary.push({kind:'point',px,py,pz,xi});
      }else if(load.kind==='selfWeight'){
        const mat=materialFor(out,e),gamma=Number(load.gamma)||Number(mat.density)||0,factor=Number.isFinite(Number(load.weightFactor??load.factor))?Number(load.weightFactor??load.factor):1;if(!(gamma>=0))throw new Error(`Co-rotacional 3D ${e.id}: peso específico inválido.`);
        const w=gamma*areaFor(out,e)*factor,qGlobal=[0,0,-w],qLocal=matVec(axes.R,qGlobal);p=uniformLoadVector3D(qLocal[0],qLocal[1],qLocal[2],axes.L);summary.push({kind:'selfWeight',gamma,factor,w,gravity:[0,0,-1],qLocal});
      }
      if(p)pl=add12(pl,p);
    }
    if(summary.length){
      const pg=matVec(transpose(T),pl),iVals=pg.slice(0,6),jVals=pg.slice(6,12);
      synthetic.push({id:`__CR3D_${e.id}_I`,nodeId:e.n1,fx:iVals[0],fy:iVals[1],fz:iVals[2],mx:iVals[3],my:iVals[4],mz:iVals[5]});
      synthetic.push({id:`__CR3D_${e.id}_J`,nodeId:e.n2,fx:jVals[0],fy:jVals[1],fz:jVals[2],mx:jVals[3],my:jVals[4],mz:jVals[5]});
      metadata.set(e.id,{elementId:e.id,initialAxes:axes,localEquivalent:pl,globalEquivalent:pg,summary});
    }
  }
  out.loads=[...(out.loads||[]),...synthetic];out.elementLoads=retainedLoads;
  return{project:out,metadata,prestressConversions:retainedLoads.filter(l=>l.sourceKind==='prestress')};
}

function currentLocalEquivalent(meta,response){
  if(!meta)return zeros12();
  const R=response?.currentAxes?.R;if(!Array.isArray(R)||R.length!==3)return meta.localEquivalent;
  return matVec(transform12(R),meta.globalEquivalent);
}
function withRecoveredDeadLoadForces(result,metadata){
  const elementForces=(result.elementForces||[]).map(r=>{
    const meta=metadata.get(r.elementId);if(!meta)return r;
    const p=currentLocalEquivalent(meta,r),q=(r.localForces||zeros12()).map((v,i)=>v-p[i]);
    return{...r,N1:q[0],Vy1:q[1],Vz1:q[2],T1:q[3],My1:q[4],Mz1:q[5],N2:q[6],Vy2:q[7],Vz2:q[8],T2:q[9],My2:q[10],Mz2:q[11],localForces:q,elasticLocalForces:r.localForces,loadSummary:meta.summary,deadLoadEquivalentLocal:p,deadLoadEquivalentGlobal:meta.globalEquivalent};
  });
  return{...result,elementForces};
}

export function solveFrameCorotational3DWithDeadLoads(project,options={}){
  const prepared=prepareCorotational3DDeadLoads(project),result=solveFrameCorotational3D(prepared.project,options);
  return withRecoveredDeadLoadForces(result,prepared.metadata);
}
