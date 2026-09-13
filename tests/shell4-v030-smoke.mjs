import assert from 'node:assert/strict';
import { shell4Element, recoverShell4 } from '../web/src/solver/shell4.js';

const E=30e6,nu=.2,t=.20,a=4,b=3,area=a*b,nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:a,y:0,z:0},{id:'N3',x:a,y:b,z:0},{id:'N4',x:0,y:b,z:0}];
const dot=(x,y)=>x.reduce((s,v,i)=>s+v*y[i],0),mv=(A,x)=>A.map(r=>dot(r,x)),quad=(x,A)=>dot(x,mv(A,x));
const maxAbs=x=>Math.max(0,...x.map(Math.abs));

// Geometry, symmetry and uniform pressure equivalent loads.
{
  const e=shell4Element({nodes,E,nu,thickness:t,pressure:-10,element:{id:'S1'}});assert.ok(Math.abs(e.area-area)<1e-12);assert.equal(e.kl.length,24);assert.equal(e.kg.length,24);
  let asym=0;for(let i=0;i<24;i++)for(let j=0;j<24;j++)asym=Math.max(asym,Math.abs(e.kl[i][j]-e.kl[j][i]));assert.ok(asym<1e-7,`shell stiffness asymmetry ${asym}`);
  const wz=[2,8,14,20],loads=wz.map(i=>e.pLocal[i]);for(const q of loads)assert.ok(Math.abs(q+30)<1e-9,`pressure nodal load ${q}`);assert.ok(Math.abs(loads.reduce((s,v)=>s+v,0)+120)<1e-9);
}

// Rigid translations contain no membrane/bending/shear strain.
{
  const e=shell4Element({nodes,E,nu,thickness:t,element:{id:'S1'}});for(const dof of [0,1,2]){const u=Array(24).fill(0);for(let i=0;i<4;i++)u[6*i+dof]=1;assert.ok(maxAbs(mv(e.kl,u))<1e-7,`rigid translation dof ${dof} generated force`)}
}

// Constant membrane strain patch test: u=eps*x, v=0.
{
  const eps=.001,e=shell4Element({nodes,E,nu,thickness:t,element:{id:'S1'}}),u=Array(24).fill(0);for(let i=0;i<4;i++)u[6*i]=eps*nodes[i].x;const energy=.5*quad(u,e.kl),cm=E*t/(1-nu*nu),expected=.5*cm*eps*eps*area;assert.ok(Math.abs(energy-expected)/expected<1e-10,`membrane energy ${energy} vs ${expected}`);const r=recoverShell4(e,u);assert.ok(Math.abs(r.membraneStrain.ex-eps)<1e-12);assert.ok(Math.abs(r.membraneResultants.Nx-cm*eps)<1e-8);
}

// Constant bending-curvature patch under reduced shear integration. The nodal w
// field cancels transverse shear at the element center, where shear is integrated.
{
  const kappa=.001,e=shell4Element({nodes,E,nu,thickness:t,element:{id:'S1'}}),u=Array(24).fill(0);for(let i=0;i<4;i++){const x=nodes[i].x;u[6*i+2]=-.5*kappa*x*x;u[6*i+4]=kappa*x}const energy=.5*quad(u,e.kl),db=E*t**3/(12*(1-nu*nu)),expected=.5*db*kappa*kappa*area;assert.ok(Math.abs(energy-expected)/expected<1e-9,`bending energy ${energy} vs ${expected}`);const r=recoverShell4(e,u);assert.ok(Math.abs(r.curvature.kx-kappa)<1e-12);assert.ok(Math.abs(r.transverseShearStrain.gxz)<1e-12);
}

// Pressure resultant follows the local shell normal after 3D transformation.
{
  const vertical=[{x:0,y:0,z:0},{x:4,y:0,z:0},{x:4,y:0,z:3},{x:0,y:0,z:3}],p=-7,e=shell4Element({nodes:vertical,E,nu,thickness:t,pressure:p,element:{id:'SV'}}),sum=[0,0,0];for(let i=0;i<4;i++){sum[0]+=e.pg[6*i];sum[1]+=e.pg[6*i+1];sum[2]+=e.pg[6*i+2]}const target=e.axes.ez.map(v=>v*p*12);for(let i=0;i<3;i++)assert.ok(Math.abs(sum[i]-target[i])<1e-9,`pressure resultant component ${i}: ${sum[i]} vs ${target[i]}`);
}

console.log('shell4-v030-smoke: OK');
