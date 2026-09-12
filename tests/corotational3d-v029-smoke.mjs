import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFramePDelta3D } from '../web/src/solver/pdelta3d.js';
import { corotationalFrame3DState, rotationVectorToMatrix, solveFrameCorotational3D } from '../web/src/solver/corotational3d.js';
import { solve } from '../web/src/solver/index.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err ${Math.abs(a-b)}`);
const mv=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const maxabs=v=>Math.max(...v.map(Math.abs));
const E=200e6,nu=.3,G=E/(2*(1+nu)),A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3;
const base={materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],elementLoads:[],loads:[],supports:[],settings:{analysisType:'corotational',analysisScenarioId:'LC1',nonlinearSteps:8,nonlinearMaxIterations:40,nonlinearTolerance:1e-8,nonlinearLineSearch:true}};

function cantilever({fx=0,fy=0,fz=0,mx=0,my=0,mz=0}={}){
  return {...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx,fy,fz,mx,my,mz}],elementLoads:[]};
}

// 1) Movimento rígido 3D deve produzir forças internas praticamente nulas.
{
  const X1=[0,0,0],X2=[L,0,0],rot=[0.15,-0.08,0.20],Q=rotationVectorToMatrix(rot),t=[0.4,-0.2,0.3],x1=mv(Q,X1).map((v,i)=>v+t[i]),x2=mv(Q,X2).map((v,i)=>v+t[i]);
  const q=[x1[0]-X1[0],x1[1]-X1[1],x1[2]-X1[2],...rot,x2[0]-X2[0],x2[1]-X2[1],x2[2]-X2[2],...rot];
  const s=corotationalFrame3DState({X1,X2,qGlobal:q,E,G,A,Iy,Iz,J,orientation:{up:[0,1,0]}});
  assert.ok(maxabs(s.internal)<1e-4,`movimento rígido gerou força interna ${maxabs(s.internal)}`);
  assert.ok(Math.abs(s.delta)<1e-10);
}

// 2) No regime de pequenas deformações, a resposta converge para o frame3d linear.
{
  const p=cantilever({fy:-1}),lin=solveSpatial3D(p),nl=solveFrameCorotational3D(p,'LC1',{steps:5,maxIterations:30,tolerance:1e-9}),dl=lin.displacements[1],dn=nl.displacements[1];
  close(dn.uy,dl.uy,2e-6,'small-load uy');
  close(dn.rz,dl.rz,2e-6,'small-load rz');
  assert.equal(nl.nonlinear.converged,true);
}

// 3) Torção pequena deve reproduzir T L/(GJ).
{
  const T=0.5,p=cantilever({mx:T}),r=solveFrameCorotational3D(p,'LC1',{steps:4,maxIterations:30,tolerance:1e-9}),d=r.displacements[1];
  close(d.rx,T*L/(G*J),3e-6,'small torsion rotation');
  close(Math.abs(r.elementForces[0].T1),T,2e-4,'torsion end force');
}

// 4) Compressão + ação transversal deve amplificar a resposta e permanecer próxima do P-Delta no regime moderado.
{
  const p=cantilever({fx:-1000,fy:-10}),lin=solveSpatial3D(p),pd=solveFramePDelta3D(p,{maxIterations:60,tolerance:1e-10}),nl=solveFrameCorotational3D(p,'LC1',{steps:20,maxIterations:50,tolerance:1e-8}),ul=Math.abs(lin.displacements[1].uy),up=Math.abs(pd.displacements[1].uy),un=Math.abs(nl.displacements[1].uy);
  assert.ok(un>ul*1.03,`co-rotacional não amplificou: linear=${ul}, nonlinear=${un}`);
  assert.ok(Math.abs(un-up)/up<0.15,`co-rotacional/P-Delta divergiram além do limite: corot=${un}, pdelta=${up}`);
}

// 5) Dispatcher principal deve selecionar o solver 3D co-rotacional.
{
  const p=cantilever({fy:-1}),r=solve(p,'LC1');
  assert.equal(r.dimension,'3d');
  assert.equal(r.analysisType,'corotational');
  assert.equal(r.solverVersion,'0.29.0-exp');
  assert.equal(r.contract.request.solverId,'corotational-frame3d');
}

// 6) Escopo protegido: truss3d, releases e cargas de barra não uniformes permanecem bloqueados.
{
  const p=cantilever({fy:-1});
  assert.throws(()=>solveFrameCorotational3D({...p,elements:[{...p.elements[0],type:'truss3d'}]},'LC1'),/somente.*frame3d/i);
  assert.throws(()=>solveFrameCorotational3D({...p,elements:[{...p.elements[0],releases:{rz2:true}}]},'LC1'),/releases/i);
  assert.throws(()=>solveFrameCorotational3D({...p,elementLoads:[{id:'PL',caseId:'LC1',elementId:'E1',kind:'point',px:0,py:-1,pz:0,xi:.5}]},'LC1'),/ainda não aceita carga de barra/i);
}

console.log('v0.29 co-rotational 3D smoke: OK');
