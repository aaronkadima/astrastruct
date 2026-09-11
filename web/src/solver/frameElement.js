import { solveLinear, mul } from './matrix.js';

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

function addVectors(a,b){return a.map((v,i)=>v+b[i])}
function zeroMatrix(n){return Array.from({length:n},()=>Array(n).fill(0))}
function releasedDofs(releases={}){const out=[];if(releases.rz1)out.push(2);if(releases.rz2)out.push(5);return out}

function condenseReleased(kl,pOriginal,releases={}) {
  const r=releasedDofs(releases);
  if(!r.length)return{kEff:kl.map(row=>[...row]),pEff:[...pOriginal],releaseData:null};
  const a=[0,1,2,3,4,5].filter(i=>!r.includes(i));
  const Kaa=a.map(i=>a.map(j=>kl[i][j])),Kar=a.map(i=>r.map(j=>kl[i][j])),Kra=r.map(i=>a.map(j=>kl[i][j])),Krr=r.map(i=>r.map(j=>kl[i][j]));
  const pa=a.map(i=>pOriginal[i]),pr=r.map(i=>pOriginal[i]);
  const columns=a.map((_,j)=>solveLinear(Krr,Kra.map(row=>row[j])));
  const X=r.map((_,ri)=>a.map((_,aj)=>columns[aj][ri]));
  const y=solveLinear(Krr,pr);
  const kCond=Kaa.map((row,i)=>row.map((v,j)=>v-Kar[i].reduce((sum,kar,rr)=>sum+kar*X[rr][j],0)));
  const pCond=pa.map((v,i)=>v-Kar[i].reduce((sum,kar,rr)=>sum+kar*y[rr],0));
  const kEff=zeroMatrix(6),pEff=Array(6).fill(0);
  a.forEach((ii,i)=>{pEff[ii]=pCond[i];a.forEach((jj,j)=>{kEff[ii][jj]=kCond[i][j]})});
  return{kEff,pEff,releaseData:{active:a,released:r,Krr,Kra,pr}};
}

export function prepareFrameElement({E,A,I,L,c,s,loads=[],releases={}}) {
  if(!(E>0))throw new Error('Módulo de elasticidade E deve ser positivo.');
  if(!(A>0))throw new Error('Área A deve ser positiva.');
  if(!(I>0))throw new Error('Inércia I deve ser positiva.');
  if(!(L>1e-12))throw new Error('Comprimento do elemento deve ser positivo.');
  const kl=frameLocalStiffness(E,A,I,L),tr=frameTransform(c,s);
  let pOriginal=Array(6).fill(0);
  const loadSummary={uniform:{qx:0,qy:0},points:[]};

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
      // Gravidade global em -Y transformada para eixos locais da barra.
      const qx=-s*w,qy=-c*w;
      pOriginal=addVectors(pOriginal,uniformDistributedLoadVector(qx,qy,L));
      loadSummary.uniform.qx+=qx;loadSummary.uniform.qy+=qy;
    }
  }

  const {kEff,pEff,releaseData}=condenseReleased(kl,pOriginal,releases);
  const kg=mm(transpose(tr),mm(kEff,tr)),pg=mul(transpose(tr),pEff);
  return{kl,tr,kg,pg,pOriginal,pEff,releaseData,L,c,s,loadSummary};
}

export function recoverFrameEndForces(prepared,globalDisplacements) {
  const ulNodal=mul(prepared.tr,globalDisplacements);let ul=[...ulNodal];
  if(prepared.releaseData){
    const {active,released,Krr,Kra,pr}=prepared.releaseData,ua=active.map(i=>ulNodal[i]);
    const rhs=pr.map((v,ri)=>v-Kra[ri].reduce((sum,k,j)=>sum+k*ua[j],0));
    const ur=solveLinear(Krr,rhs);released.forEach((dof,i)=>{ul[dof]=ur[i]});
  }
  const q=mul(prepared.kl,ul).map((v,i)=>v-prepared.pOriginal[i]);
  return{q,ul,ulNodal};
}

export function frameEndHasRotationalStiffness(element,nodeId) {
  if(element.type!=='frame2d')return false;
  if(element.n1===nodeId)return !element.releases?.rz1;
  if(element.n2===nodeId)return !element.releases?.rz2;
  return false;
}
