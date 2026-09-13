import assert from 'node:assert/strict';
import {demoRectangularWaterTankShell3D} from '../web/src/core/advancedExamples.js';
import {solve} from '../web/src/solver/index.js';

const gamma=9.81,L=6,W=4,H=3,p=demoRectangularWaterTankShell3D({length:L,width:W,height:H,waterDepth:H,divX:3,divY:2,divZ:3,thickness:.2,gammaWater:gamma});
const shells=p.elements.filter(e=>e.type==='shell4');assert.equal(shells.length,36);assert.equal(p.meta.tank.wallShells,30);assert.equal(p.meta.tank.bottomShells,6);assert.equal(p.nodes.length,42);assert.equal(p.elementLoads.filter(l=>l.kind==='surface').length,36);assert.ok(p.supports.length>=12);
const byElement=new Map(shells.map(e=>[e.id,e])),area=e=>{const q=e.nodeIds.map(id=>p.nodes.find(n=>n.id===id));let a=0;for(let i=0;i<4;i++){const j=(i+1)%4,A=q[i],B=q[j];const ux=B.x-A.x,uy=B.y-A.y,uz=B.z-A.z,C=q[(i+3)%4],vx=C.x-A.x,vy=C.y-A.y,vz=C.z-A.z;a=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)}return a};
const resultant=surface=>p.elementLoads.filter(l=>l.surface===surface).reduce((s,l)=>s+Math.abs(l.pressure)*area(byElement.get(l.elementId)),0);
const wallL=.5*gamma*H*H*L,wallW=.5*gamma*H*H*W,bottom=gamma*H*L*W;assert.ok(Math.abs(resultant('south')-wallL)<1e-9);assert.ok(Math.abs(resultant('north')-wallL)<1e-9);assert.ok(Math.abs(resultant('west')-wallW)<1e-9);assert.ok(Math.abs(resultant('east')-wallW)<1e-9);assert.ok(Math.abs(resultant('bottom')-bottom)<1e-9);
const r=solve(p,'WATER');assert.equal(r.dimension,'3d');assert.equal(r.type,'shell4');const rz=r.reactions.reduce((s,x)=>s+(Number(x.fz)||0),0),rx=r.reactions.reduce((s,x)=>s+(Number(x.fx)||0),0),ry=r.reactions.reduce((s,x)=>s+(Number(x.fy)||0),0);assert.ok(Math.abs(rz-bottom)<1e-5,`vertical hydrostatic equilibrium ${rz} vs ${bottom}`);assert.ok(Math.abs(rx)<1e-5,`net Rx ${rx}`);assert.ok(Math.abs(ry)<1e-5,`net Ry ${ry}`);assert.ok(r.elementForces.filter(e=>e.type==='shell4').some(e=>Math.abs(e.bendingMoments?.Mx||0)>1e-8));

// Partial filling: panels above the water line are unloaded and the integrated
// wall resultant still follows 1/2 gamma h² times wall length.
const q=demoRectangularWaterTankShell3D({length:L,width:W,height:H,waterDepth:1.5,divX:3,divY:2,divZ:3,gammaWater:gamma});const south=q.elementLoads.filter(l=>l.surface==='south'),qBy=new Map(q.elements.map(e=>[e.id,e]));const qarea=e=>{const n=e.nodeIds.map(id=>q.nodes.find(x=>x.id===id)),u=[n[1].x-n[0].x,n[1].y-n[0].y,n[1].z-n[0].z],v=[n[3].x-n[0].x,n[3].y-n[0].y,n[3].z-n[0].z];return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])};const qres=south.reduce((s,l)=>s+l.pressure*qarea(qBy.get(l.elementId)),0);assert.ok(Math.abs(qres-.5*gamma*1.5**2*L)<1e-9);assert.ok(south.every(l=>l.z0<1.5));

console.log('water-tank-shell-v030-smoke: OK');
