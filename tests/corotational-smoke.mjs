import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { corotationalElementState, solveFrameCorotational2D } from '../web/src/solver/corotational2d.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

// 1) Objetividade: translação + rotação rígida finita não podem gerar deformação nem força interna.
{
  const L=3.7,beta=.83,tx=1.25,ty=-.62,X1=0,Y1=0,X2=L,Y2=0;
  const x1=tx,y1=ty,x2=tx+L*Math.cos(beta),y2=ty+L*Math.sin(beta),q=[x1-X1,y1-Y1,beta,x2-X2,y2-Y2,beta];
  const s=corotationalElementState({X1,Y1,X2,Y2,qGlobal:q,E:200e6,A:.01,I:.0002});
  assert(Math.max(...s.basic.map(Math.abs))<1e-12,'Co-rotacional: deformação espúria em movimento rígido');
  assert(Math.max(...s.internal.map(Math.abs))<1e-6,'Co-rotacional: força espúria em movimento rígido');
  console.log('Co-rotacional — objetividade OK','beta=',beta,'rad');
}

// 2) Tangente consistente: comparar d(fint)/dq analítico contra diferença central
// em um estado com rotação/translação finitas, não apenas na origem.
{
  const args={X1:0,Y1:0,X2:3,Y2:1,E:200e6,A:.01,I:.0002},q=[.10,.20,.30,.40,-.10,-.20],h=1e-7;
  const base=corotationalElementState({...args,qGlobal:q});let maxDiff=0,maxRef=0;
  for(let j=0;j<6;j++){
    const qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;
    const fp=corotationalElementState({...args,qGlobal:qp}).internal,fm=corotationalElementState({...args,qGlobal:qm}).internal;
    for(let i=0;i<6;i++){const numeric=(fp[i]-fm[i])/(2*h),analytic=base.tangent[i][j];maxDiff=Math.max(maxDiff,Math.abs(analytic-numeric));maxRef=Math.max(maxRef,Math.abs(numeric))}
  }
  const relative=maxDiff/Math.max(1,maxRef);assert(relative<2e-6,`Co-rotacional: tangente inconsistente, erro relativo ${relative}`);
  console.log('Co-rotacional — tangente consistente OK','erro relativo=',relative);
}

// 3) Limite de pequenas rotações: console deve reproduzir PL^3/(3EI).
{
  const p=emptyProject();p.name='Co-rotacional — limite linear';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];
  p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50',A:.15,I:.003125})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:4,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId==='N2'),exact=-10*4**3/(3*30e6*.003125);
  near(tip.uy,exact,2e-9,'Co-rotacional: limite linear do console');
  assert(r.nonlinear.converged,'Co-rotacional: metadado de convergência ausente');
  assert(r.elementResponses?.length===1,'Co-rotacional: pós-processamento do console ausente');
  console.log(p.name,'OK','uy [mm]=',tip.uy*1000,'linear [mm]=',exact*1000);
}

function circularArc(ne){
  const p=emptyProject(),L=4,theta=1,E=30e6,I=.003125,A=.15,le=L/ne,M=E*I*theta/L;
  p.name=`Co-rotacional — arco circular ${ne}e`;p.nodes=Array.from({length:ne+1},(_,i)=>({id:`N${i}`,x:i*le,y:0}));
  p.elements=Array.from({length:ne},(_,i)=>makeFrameElement({id:`E${i+1}`,n1:`N${i}`,n2:`N${i+1}`,sectionId:'rc_30x50',A,I}));
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:true}];p.loads=[{id:'M',caseId:'LC1',nodeId:`N${ne}`,fx:0,fy:0,mz:M}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:20,maxIterations:45,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId===`N${ne}`),x=L+tip.ux,y=tip.uy,xExact=L*Math.sin(theta)/theta,yExact=L*(1-Math.cos(theta))/theta,error=Math.hypot(x-xExact,y-yExact);
  return{p,r,tip,x,y,xExact,yExact,error,M};
}

// 4) Grande rotação sob momento puro. A solução contínua inextensível é arco circular:
// theta = M L/EI; xL=L sin(theta)/theta; yL=L(1-cos(theta))/theta.
// O erro deve cair monotonicamente com refinamento 4 -> 8 -> 16 elementos.
{
  const a4=circularArc(4),a8=circularArc(8),a16=circularArc(16);
  assert(a8.error<a4.error*.35,`Co-rotacional: convergência 4->8 insuficiente (${a4.error} -> ${a8.error})`);
  assert(a16.error<a8.error*.35,`Co-rotacional: convergência 8->16 insuficiente (${a8.error} -> ${a16.error})`);
  near(a16.tip.rz,1,2e-8,'Co-rotacional: rotação final sob momento puro');
  near(a16.x,a16.xExact,7e-4,'Co-rotacional: coordenada x do arco circular');near(a16.y,a16.yExact,4e-4,'Co-rotacional: coordenada y do arco circular');
  const reaction=a16.r.reactions.find(x=>x.nodeId==='N0');near(reaction.mz,-a16.M,2e-5,'Co-rotacional: equilíbrio de momento');
  assert(a16.r.elementResponses.length===16,'Co-rotacional: número de respostas de elemento incorreto');
  assert(a16.r.elementResponses.every(e=>e.currentGeometry&&e.stations.length===41),'Co-rotacional: respostas não usam geometria corrente');
  const lastResponse=a16.r.elementResponses.at(-1),end=lastResponse.stations.at(-1);near(end.xd,a16.x,2e-9,'Co-rotacional: pós-processamento x da ponta');near(end.yd,a16.y,2e-9,'Co-rotacional: pós-processamento y da ponta');
  const momentError=Math.max(...a16.r.elementResponses.flatMap(e=>e.stations.map(s=>Math.abs(s.M-a16.M))));assert(momentError<2e-5,`Co-rotacional: momento puro não preservado no pós-processamento (${momentError})`);
  assert(a16.r.elementResponses.every(e=>e.stations.every(s=>Number.isFinite(s.sigmaTop)&&Number.isFinite(s.sigmaBottom))),'Co-rotacional: tensões elásticas ausentes');
  console.log('Co-rotacional — convergência/pós-processamento OK','erros [m]=',a4.error,a8.error,a16.error,'tip16=',a16.x,a16.y,'erro M=',momentError);
}

console.log('Todos os smoke tests co-rotacionais experimentais do AstraStruct v0.13 passaram.');
