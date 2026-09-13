import { mul } from './matrix.js';
import { condenseEndConnections, recoverEndConnections, endRotationalStiffness } from './endConnections.js';
import { prestressInitialState2D } from '../loadStage/prestress.js';

export function transpose(A) { return A[0].map((_, j) => A.map(r => r[j])); }
export function mm(A, B) { return A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0))); }

export function frameLocalStiffness(E, A, I, L) {
  const ea=E*A/L, ei=E*I, L2=L*L, L3=L2*L;
  return [
    [ea,0,0,-ea,0,0],
    [0,12*ei/L3,6*ei/L2,0,-12*ei/L3,6*ei/L2],
    [0,6*ei/L2,4*ei/L,0,-6*ei/L2,2*ei/L],
    [-ea,0,0,ea,0,0],
    [0,-12*ei/L3,-6*ei/L2,0,12*ei/L3,-6*ei/L2],
    [0,6*ei/L2,2*ei/L,0,-6*ei/L2,4*ei/L]
  ];
}

export function frameTransform(c,s) {
  return [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];
}

export function uniformDistributedLoadVector(qx=0,qy=0,L) {
  return [qx*L/2,qy*L/2,qy*L*L/12,qx*L/2,qy*L/2,-qy*L*L/12];
}

export function pointLoadVector(px=0,py=0,L,xi=0.5) {
  const r=Math.max(0,Math.min(1,Number(xi)));
  const r2=r*r,r3=r2*r;
  const h1=1-3*r2+2*r3, h2=L*(r-2*r2+r3), h3=3*r2-2*r3, h4=L*(-r2+r3);
  return [px*(1-r),py*h1,py*h2,px*r,py*h3,py*h4];
}

export function thermalLoadVector({E,A,I,alpha=0,dT=0,dTGradient=0,sectionHeight=0}) {
  const eps0=(Number(alpha)||0)*(Number(dT)||0);
  let kappa0=0;
  const grad=Number(dTGradient)||0;
  if(Math.abs(grad)>1e-15){
    const h=Number(sectionHeight)||0;
    if(!(h>0))throw new Error('Gradiente térmico requer altura/profundidade positiva da seção.');
    kappa0=-(Number(alpha)||0)*grad/h;
  }
  const n0=E*A*eps0,m0=E*I*kappa0;
  return {vector:[-n0,0,-m0,n0,0,m0],eps0,kappa0,n0,m0};
}

function addVectors(a,b){return a.map((v,i)=>v+b[i])}

export function prepareFrameElement({E,A,I,L,c,s,loads=[],releases={},rotationalSprings={},alpha=0,sectionHeight=0}) {
  if(!(E>0))throw new Error('Módulo de elasticidade E deve ser positivo.');
  if(!(A>0))throw new Error('Área A deve ser positiva.');
  if(!(I>0))throw new Error('Inércia I deve ser positiva.');
  if(!(L>1e-12))throw new Error('Comprimento do elemento deve ser positivo.');
  const kl=frameLocalStiffness(E,A,I,L),tr=frameTransform(c,s);
  let pOriginal=Array(6).fill(0);
  const loadSummary={uniform:{qx:0,qy:0},points:[],thermal:{dT:0,dTGradient:0,eps0:0,kappa0:0},prestress:[]};

  for(const load of loads){
    if(load.kind==='uniform'){
      const qx=load.qx||0,qy=load.qy||0;
      pOriginal=addVectors(pOriginal,uniformDistributedLoadVector(qx,qy,L));
      loadSummary.uniform.qx+=qx;loadSummary.uniform.qy+=qy;
    } else if(load.kind==='point'){
      const px=load.px||0,py=load.py||0,xi=Math.max(0,Math.min(1,Number(load.xi??0.5)));
      pOriginal=addVectors(pOriginal,pointLoadVector(px,py,L,xi));
      loadSummary.points.push({xi,a:xi*L,px,py});
    } else if(load.kind==='selfWeight'){
      const gamma=Number(load.gamma)||0, factor=Number.isFinite(Number(load.weightFactor))?Number(load.weightFactor):1;
      const w=gamma*A*factor;
      const qx=-s*w,qy=-c*w;
      pOriginal=addVectors(pOriginal,uniformDistributedLoadVector(qx,qy,L));
      loadSummary.uniform.qx+=qx;loadSummary.uniform.qy+=qy;
    } else if(load.kind==='thermal'){
      const dT=Number(load.dT)||0,dTGradient=Number(load.dTGradient)||0;
      const th=thermalLoadVector({E,A,I,alpha,dT,dTGradient,sectionHeight});
      pOriginal=addVectors(pOriginal,th.vector);
      loadSummary.thermal.dT+=dT;loadSummary.thermal.dTGradient+=dTGradient;
      loadSummary.thermal.eps0+=th.eps0;loadSummary.thermal.kappa0+=th.kappa0;
    } else if(load.kind==='prestress'){
      const ps=prestressInitialState2D({force:load.force,eccentricity:load.eccentricity??load.eccentricityY??0,effectiveFactor:load.effectiveFactor??1,E,A,I});
      pOriginal=addVectors(pOriginal,ps.equivalentLocal);
      loadSummary.prestress.push({id:load.id||null,force:ps.effectiveForce,eccentricity:ps.eccentricity,eps0:ps.eps0,kappa0:ps.kappa0,N0:ps.N0,M0:ps.M0});
    }
  }

  const {kEff,pEff,connectionData}=condenseEndConnections(kl,pOriginal,releases,rotationalSprings);
  const kg=mm(transpose(tr),mm(kEff,tr)),pg=mul(transpose(tr),pEff);
  return{kl,tr,kg,pg,pOriginal,pEff,connectionData,L,c,s,loadSummary};
}

export function recoverFrameEndForces(prepared,globalDisplacements) {
  const ulNodal=mul(prepared.tr,globalDisplacements);
  const recovered=recoverEndConnections(prepared.kl,prepared.pOriginal,ulNodal,prepared.connectionData);
  return{q:recovered.q,ul:recovered.uElement,ulNodal,connectionRotations:recovered.connectionRotations};
}

export function frameEndHasRotationalStiffness(element,nodeId) {
  if(element.type!=='frame2d')return false;
  if(element.n1===nodeId)return endRotationalStiffness(element.releases||{},element.rotationalSprings||{},1)>0;
  if(element.n2===nodeId)return endRotationalStiffness(element.releases||{},element.rotationalSprings||{},2)>0;
  return false;
}
