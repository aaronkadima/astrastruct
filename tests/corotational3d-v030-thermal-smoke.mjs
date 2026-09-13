import assert from 'node:assert/strict';
import {solveFrameCorotational3DWithDeadLoads} from '../web/src/solver/corotational3dLoads.js';
import {resolveScenario} from '../web/src/solver/scenario.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3,alpha=1.2e-5,h=.30,b=.20,dT=50;
function model(elementLoads=[],tipSupport={}){return{nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,h,b,orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:78.5,alpha}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz,h,b}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},...(Object.keys(tipSupport).length?[{nodeId:'N2',...tipSupport}]:[])],loads:[],elementLoads,nodeSprings:[],settlements:[],loadCases:[{id:'LC1',name:'Térmica'}],loadCombinations:[],settings:{analysisScenarioId:'LC1',nonlinearSteps:6,nonlinearMaxIterations:40,nonlinearTolerance:1e-9}}}
const maxEndForce=r=>Math.max(0,...Object.entries(r.elementForces[0]||{}).filter(([k])=>/^(N|Vy|Vz|T|My|Mz)[12]$/.test(k)).map(([,v])=>Math.abs(Number(v)||0)));

// 1) Uniform temperature: free cantilever expands by alpha*dT*L without thermal force.
{
 const p=model([{id:'T',caseId:'LC1',elementId:'E1',kind:'thermal',dT}]),r=solveFrameCorotational3DWithDeadLoads(p,{steps:6,tolerance:1e-9}),u=r.displacements[1].ux,expected=alpha*dT*L;
 close(u,expected,2e-8,'free thermal expansion');assert.ok(maxEndForce(r)<2e-4,`free thermal force=${maxEndForce(r)}`);assert.ok(Math.abs(r.reactions[0].fx)<2e-4,`free thermal reaction=${r.reactions[0].fx}`);close(r.elementForces[0].thermal.eps0,alpha*dT,1e-14,'thermal strain');
}

// 2) Axially restrained member develops EA*alpha*dT compression.
{
 const p=model([{id:'T',caseId:'LC1',elementId:'E1',kind:'thermal',dT}],{ux:true}),r=solveFrameCorotational3DWithDeadLoads(p,{steps:5,tolerance:1e-9}),expected=E*A*alpha*dT,N=r.elementForces[0].N2;
 close(Math.abs(N),expected,1e-5,'restrained thermal axial force');close(Math.abs(r.reactions[0].fx),expected,1e-5,'restrained thermal reaction');close(r.displacements[1].ux,0,1e-12,'restrained ux');
}

// 3) Local-y temperature gradient induces free curvature about local z with negligible force.
{
 const gradient=20,kappa=-alpha*gradient/h,p=model([{id:'TG',caseId:'LC1',elementId:'E1',kind:'thermal',dT:0,dTGradient:gradient}]),r=solveFrameCorotational3DWithDeadLoads(p,{steps:8,tolerance:2e-9}),u=r.displacements[1],expectedY=L*Math.sin(kappa*L/2),expectedRz=kappa*L;
 close(u.uy,expectedY,Math.max(3e-7,Math.abs(expectedY)*.015),'free thermal gradient tip y');close(u.rz,expectedRz,Math.max(2e-7,Math.abs(expectedRz)*.015),'free thermal gradient tip rz');assert.ok(maxEndForce(r)<.02,`free gradient residual force=${maxEndForce(r)}`);close(r.elementForces[0].thermal.kappaZ,kappa,1e-14,'thermal curvature z');
}

// 4) Explicit local-z gradient uses section width and bends about local y.
{
 const gradientZ=12,kappaY=alpha*gradientZ/b,p=model([{id:'TGZ',caseId:'LC1',elementId:'E1',kind:'thermal',dTGradientZ:gradientZ}]),r=solveFrameCorotational3DWithDeadLoads(p,{steps:8,tolerance:2e-9}),u=r.displacements[1];assert.ok(Math.abs(u.uz)>1e-4,'gradient local-z must create out-of-plane displacement');close(Math.abs(u.ry),Math.abs(kappaY*L),Math.max(3e-7,Math.abs(kappaY*L)*.02),'free thermal gradient ry');assert.ok(maxEndForce(r)<.03,`free gradient-z residual force=${maxEndForce(r)}`);
}

// 5) Load combinations scale both explicit spatial gradient components, not only the legacy dTGradient field.
{
 const p=model([{id:'TC',caseId:'LC1',elementId:'E1',kind:'thermal',dT:10,dTGradientY:8,dTGradientZ:-6}]);p.loadCombinations=[{id:'U',name:'1.5T',terms:[{caseId:'LC1',factor:1.5}]}];const resolved=resolveScenario(p,'U'),t=resolved.project.elementLoads[0];close(t.dT,15,1e-12,'combination dT');close(t.dTGradientY,12,1e-12,'combination gradient Y');close(t.dTGradientZ,-9,1e-12,'combination gradient Z');
}

console.log('v0.30 co-rotational 3D thermal initial-state smoke: OK');
