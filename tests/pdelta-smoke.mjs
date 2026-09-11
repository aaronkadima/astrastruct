import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}
function assert(condition,message){if(!condition)throw new Error(message)}

// Console vertical de 6 m discretizado em 4 elementos, EI=162000 kN.m².
// Carga horizontal H=10 kN e compressão de topo P=4000 kN.
// Solução contínua da viga-coluna:
// delta = H/P * [tan(lambda)/k - L], k=sqrt(P/EI), lambda=kL.
{
  const p=emptyProject();p.name='Coluna — P-Delta canônico';p.settings.analysisType='pdelta';p.settings.pDeltaMaxIterations=30;p.settings.pDeltaTolerance=1e-10;
  const L=6,ne=4,le=L/ne;
  p.nodes=Array.from({length:ne+1},(_,i)=>({id:`N${i}`,x:0,y:i*le}));
  p.elements=Array.from({length:ne},(_,i)=>makeFrameElement({id:`E${i+1}`,n1:`N${i}`,n2:`N${i+1}`,sectionId:'rc_30x60',A:.18,I:.0054,label:`Trecho ${i+1}`}));
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:true}];
  p.loads=[{id:'H',caseId:'LC1',nodeId:'N4',fx:10,fy:0,mz:0},{id:'P',caseId:'LC1',nodeId:'N4',fx:0,fy:-4000,mz:0}];
  const r=solve(p,'LC1'),tip=r.displacements.find(d=>d.nodeId==='N4'),EI=30e6*.0054,P=4000,H=10,k=Math.sqrt(P/EI),exact=H/P*(Math.tan(k*L)/k-L);
  near(tip.ux,exact,6e-8,'P-Delta: deslocamento lateral de topo');
  assert(r.pDelta?.converged,'P-Delta: metadado de convergência ausente');
  assert(r.pDelta.iterations<=6,'P-Delta: convergência excessivamente lenta');
  for(const x of r.pDelta.axialForces)near(x.N,-4000,1e-6,`P-Delta: esforço axial ${x.elementId}`);
  console.log(p.name,'OK','delta [mm]=',tip.ux*1000,'exato [mm]=',exact*1000,'iterações=',r.pDelta.iterations);
}

// Sem compressão axial, P-Delta deve coincidir com a análise linear.
{
  const make=mode=>{const p=emptyProject();p.settings.analysisType=mode;p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:0,y:4}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x60',A:.18,I:.0054})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'H',caseId:'LC1',nodeId:'N2',fx:20,fy:0,mz:0}];return p};
  const linear=solve(make('linear'),'LC1'),second=solve(make('pdelta'),'LC1'),u1=linear.displacements.find(d=>d.nodeId==='N2').ux,u2=second.displacements.find(d=>d.nodeId==='N2').ux;
  near(u2,u1,1e-12,'P-Delta sem N: equivalência linear');
  console.log('P-Delta sem esforço axial OK','ux=',u2);
}

console.log('Todos os smoke tests P-Delta do AstraStruct v0.10 passaram.');
