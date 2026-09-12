import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { corotationalElementState, followerEndLoadState, solveFrameCorotational2D } from '../web/src/solver/corotational2d.js';
import { resolveScenario } from '../web/src/solver/scenario.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}
function mustThrow(fn,pattern,message){let thrown=null;try{fn()}catch(e){thrown=e}assert(thrown,`${message}: era esperado erro`);assert(pattern.test(String(thrown?.message||thrown)),`${message}: mensagem inesperada: ${thrown?.message||thrown}`)}

function currentFollower(args,q,px,py){
  const state=corotationalElementState({...args,qGlobal:q});
  return followerEndLoadState({px,py,end:2,l:state.l,c:state.c,s:state.s});
}

// 1) Tangente externa consistente: Kext=dP/dq contra diferença central.
{
  const args={X1:0,Y1:0,X2:3,Y2:1,E:200e6,A:.01,I:.0002},q=[.10,.20,.30,.40,-.10,-.20],px=12,py=-7,h=1e-7;
  const base=currentFollower(args,q,px,py);let maxDiff=0,maxRef=0;
  for(let j=0;j<6;j++){
    const qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;
    const fp=currentFollower(args,qp,px,py).vector,fm=currentFollower(args,qm,px,py).vector;
    for(let i=0;i<6;i++){
      const numeric=(fp[i]-fm[i])/(2*h),analytic=base.tangent[i][j];
      maxDiff=Math.max(maxDiff,Math.abs(analytic-numeric));maxRef=Math.max(maxRef,Math.abs(numeric));
    }
  }
  const relative=maxDiff/Math.max(1,maxRef),asym=Math.max(...base.tangent.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-base.tangent[j][i]))));
  assert(relative<2e-7,`Follower: tangente externa inconsistente, erro relativo ${relative}`);
  assert(asym>1e-3,'Follower: tangente externa deveria ser não simétrica para esta carga não conservativa');
  console.log('Co-rotacional — tangente externa follower OK','erro relativo=',relative,'assimetria=',asym);
}

// 2) Rotação objetiva da força: componentes locais permanecem constantes enquanto
// as componentes globais seguem a corda corrente.
{
  const beta=.63,l=4,c=Math.cos(beta),s=Math.sin(beta),px=18,py=-9,f=followerEndLoadState({px,py,end:2,l,c,s});
  near(f.fx,c*px-s*py,1e-12,'Follower: Fx global');near(f.fy,s*px+c*py,1e-12,'Follower: Fy global');
  const localX=c*f.fx+s*f.fy,localY=-s*f.fx+c*f.fy;
  near(localX,px,1e-12,'Follower: Px local preservado');near(localY,py,1e-12,'Follower: Py local preservado');
  console.log('Co-rotacional — rotação da força follower OK','alpha=',beta,'Fglobal=',f.fx,f.fy);
}

// 3) Solver completo: balanço com força transversal follower na ponta. Verifica
// convergência, direção corrente e equilíbrio global de forças e momento.
{
  const p=emptyProject();p.name='Co-rotacional — força seguidora na extremidade 2';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50',A:.15,I:.003125})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[];
  p.elementLoads=[{id:'FOL1',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:2,px:0,py:-10}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:45,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId==='N2'),ra=r.reactions.find(x=>x.nodeId==='N1'),follower=r.elementForces[0].loadSummary.followerEnds[0];
  assert(r.nonlinear.converged,'Follower: solução não convergiu');assert(r.nonlinear.followerLoads.count===1,'Follower: contagem de cargas incorreta');assert(r.nonlinear.followerLoads.externalTangent==='consistent','Follower: metadado de tangente consistente ausente');
  assert(tip.uy<0,'Follower: deslocamento vertical da ponta deveria ser negativo');
  const x=4+tip.ux,y=tip.uy,l=Math.hypot(x,y),c=x/l,s=y/l,fx=-s*(-10),fy=c*(-10);
  near(follower.currentGlobal.fx,fx,2e-9,'Follower: Fx final');near(follower.currentGlobal.fy,fy,2e-9,'Follower: Fy final');
  near(ra.fx+fx,0,2e-7,'Follower: equilíbrio global Fx');near(ra.fy+fy,0,2e-7,'Follower: equilíbrio global Fy');near(ra.mz+x*fy-y*fx,0,3e-6,'Follower: equilíbrio global de momento');
  assert(follower.tangentMaxAbs>0,'Follower: tangente externa final deveria ser não nula');near(r.solverVersion==='0.13.6-exp'?1:0,1,0,'Follower: versão do kernel');
  console.log(p.name,'OK','tip [mm]=',tip.ux*1000,tip.uy*1000,'Fglobal=',fx,fy,'R=',ra.fx,ra.fy,ra.mz);
}

// 4) Scenario Engine: combinação deve escalar as componentes locais antes do
// carregamento incremental do Newton.
{
  const p=emptyProject();p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.elementLoads=[{id:'FOL1',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:2,px:2,py:-4}];p.loadCombinations=[{id:'C1',name:'Follower × 1.5',type:'custom',terms:[{caseId:'LC1',factor:1.5}]}];p.settings.analysisScenarioId='C1';
  const resolved=resolveScenario(p,'C1'),load=resolved.project.elementLoads[0];near(load.px,3,1e-12,'Follower scenario: Px');near(load.py,-6,1e-12,'Follower scenario: Py');
  const r=solveFrameCorotational2D(p,'C1',{steps:5,tolerance:1e-9}),summary=r.elementForces[0].loadSummary.followerEnds[0];near(summary.px,3,1e-12,'Follower solver: Px escalado');near(summary.py,-6,1e-12,'Follower solver: Py escalado');
  console.log('Co-rotacional — combinação follower OK','Px=',summary.px,'Py=',summary.py);
}

// 5) Escopo inicial deliberado: extremidade 1 ainda é recusada.
{
  const p=emptyProject();p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.elementLoads=[{id:'FOL1',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:1,px:0,py:-5}];
  mustThrow(()=>solveFrameCorotational2D(p,'LC1'),/extremidade 2/i,'Follower: extremidade 1 deve ser recusada nesta etapa');
  console.log('Co-rotacional — escopo follower protegido OK: apenas extremidade 2');
}

console.log('Todos os smoke tests de força seguidora co-rotacional v0.13.6 passaram.');
