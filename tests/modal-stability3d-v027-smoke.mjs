import assert from 'node:assert/strict';
import { solveModal3D, solveBuckling3D, frame3DMassLocal, frame3DLocalGeometricStiffness } from '../web/src/solver/modalStability3d.js';

const close=(a,b,rel,msg)=>{const e=Math.abs(a-b)/Math.max(1e-12,Math.abs(b));assert.ok(e<=rel,`${msg}: got ${a}, expected ${b}, rel=${e}`)};
const G0=9.80665,E=200e6,gamma=78.5,rho=gamma/G0,A=.01,L=3;

// 1) Single axial truss element: discrete consistent/lumped eigenvalues are analytical.
{
  const base={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'T1',type:'truss3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A}],materials:[{id:'S',E,nu:.3,density:gamma}],sections:[{id:'SEC',A}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true},{nodeId:'N2',uy:true,uz:true}],loads:[],elementLoads:[],settlements:[],nodalMasses:[]};
  const c=solveModal3D(base,{modes:1,massFormulation:'consistent'}),l=solveModal3D(base,{modes:1,massFormulation:'lumped'}),wc=Math.sqrt(3*E/(rho*L*L)),wl=Math.sqrt(2*E/(rho*L*L));
  close(c.modes[0].omega,wc,2e-10,'truss3d consistent axial omega');
  close(l.modes[0].omega,wl,2e-10,'truss3d lumped axial omega');
  close(c.modes[0].participation.effectiveMassRatioX,1,2e-10,'truss3d X effective mass');
}

// 2) A spatial cantilever yields finite 3D modes and directional participation in X/Y/Z.
{
  const p={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:2.5,y:1.2,z:.8}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.012,Iy:7e-5,Iz:9e-5,J:2e-5,orientation:{up:[0,0,1]}}],materials:[{id:'S',E,nu:.3,density:gamma}],sections:[{id:'SEC',A:.012,Iy:7e-5,Iz:9e-5,J:2e-5}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads:[],settlements:[],nodalMasses:[]};
  const r=solveModal3D(p,{modes:6,massFormulation:'consistent'});assert.ok(r.modes.length>=4);assert.ok(r.modes.every((m,i)=>m.frequencyHz>0&&(i===0||m.frequencyHz>=r.modes[i-1].frequencyHz));assert.ok(r.modes.some(m=>m.participation.effectiveMassRatioZ>1e-4));assert.equal(r.dimension,'3d');
}

// 3) Mass and geometric matrices remain symmetric in both bending planes.
{
  const M=frame3DMassLocal({totalMass:2.4,L:3,rotaryMass:.04,formulation:'consistent'}),Kg=frame3DLocalGeometricStiffness(-500,3);let em=0,eg=0;for(let i=0;i<12;i++)for(let j=0;j<12;j++){em=Math.max(em,Math.abs(M[i][j]-M[j][i]));eg=Math.max(eg,Math.abs(Kg[i][j]-Kg[j][i]))}assert.ok(em<1e-12);assert.ok(eg<1e-12);assert.ok(M[4][4]>0&&M[5][5]>0&&M[3][3]>0);
}

// 4) Multi-element pin-ended column: first two spatial buckling factors converge to Euler about Iy and Iz.
{
  const n=8,Lc=4,P=1000,Iy=6e-5,Iz=9e-5,J=2e-5,nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:Lc*i/n,y:0,z:0})),elements=Array.from({length:n},(_,i)=>({id:`E${i}`,type:'frame3d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}));
  const p={nodes,elements,materials:[{id:'S',E,nu:.3,density:gamma}],sections:[{id:'SEC',A,Iy,Iz,J}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true},{nodeId:`N${n}`,uy:true,uz:true}],loads:[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:-P}],elementLoads:[],settlements:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Compressão'}],loadCombinations:[],settings:{analysisScenarioId:'LC1',analysisType:'linear'}};
  const r=solveBuckling3D(p,'LC1',{modes:4}),weak=Math.PI**2*E*Iy/(Lc*Lc*P),strong=Math.PI**2*E*Iz/(Lc*Lc*P);
  close(r.modes[0].factor,weak,.003,'3D Euler weak-axis factor');
  close(r.modes[1].factor,strong,.003,'3D Euler strong-axis factor');
  assert.ok(r.modes[0].displacements.some(d=>Math.abs(d.uz)>0.5),'weak-axis mode should be predominantly local-z/global-z');
  assert.ok(r.modes[1].displacements.some(d=>Math.abs(d.uy)>0.5),'strong-axis mode should be predominantly local-y/global-y');
  assert.equal(r.dimension,'3d');
}

// 5) Buckling requires a compressive reference state.
{
  const p={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:2,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.01,Iy:1e-4,Iz:1e-4,J:2e-5,orientation:{up:[0,1,0]}}],materials:[{id:'S',E,nu:.3,density:gamma}],sections:[{id:'SEC',A:.01,Iy:1e-4,Iz:1e-4,J:2e-5}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'T',caseId:'LC1',nodeId:'N2',fx:10}],elementLoads:[],settlements:[],loadCases:[{id:'LC1'}],loadCombinations:[],settings:{analysisScenarioId:'LC1'}};assert.throws(()=>solveBuckling3D(p,'LC1'),/não produz compressão/);
}

console.log('v0.27 3D modal/stability smoke: OK');
