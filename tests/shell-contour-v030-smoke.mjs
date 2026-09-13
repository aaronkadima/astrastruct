import assert from 'node:assert/strict';
import {extrapolateShellGaussToNodes,buildShellNodalContour} from '../web/src/core/shellContour.js';

const g=1/Math.sqrt(3),f=(xi,eta)=>2+3*xi-4*eta+5*xi*eta,gp=(index,xi,eta)=>({index,naturalCoordinates:{xi,eta},membraneResultants:{Nx:f(xi,eta)},bendingMoments:{Mx:2*f(xi,eta)},transverseShear:{Qx:-f(xi,eta)},membraneStress:{sx:10*f(xi,eta)}}),response={elementId:'S1',type:'shell4',area:12,gaussPoints:[gp(1,-g,-g),gp(2,g,-g),gp(3,g,g),gp(4,-g,g)]};
const corners=[f(-1,-1),f(1,-1),f(1,1),f(-1,1)],ext=extrapolateShellGaussToNodes(response,'Nx');for(let i=0;i<4;i++)assert.ok(Math.abs(ext[i]-corners[i])<1e-12,`corner ${i}: ${ext[i]} vs ${corners[i]}`);
const project={nodes:[{id:'N1'},{id:'N2'},{id:'N3'},{id:'N4'},{id:'N5'},{id:'N6'}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4']},{id:'S2',type:'shell4',nodeIds:['N2','N5','N6','N3']}]};
const response2={...response,elementId:'S2',area:6,gaussPoints:response.gaussPoints.map(p=>({...p,membraneResultants:{Nx:p.membraneResultants.Nx+6}}))},contour=buildShellNodalContour(project,{elementForces:[response,response2]},'Nx');assert.equal(contour.shellCount,2);assert.equal(contour.nodes.length,6);assert.equal(contour.nodes.find(x=>x.nodeId==='N2').contributors,2);assert.equal(contour.nodes.find(x=>x.nodeId==='N3').contributors,2);
// Shared nodes are area-weighted: S1 contributes twice the weight of S2.
const s1N2=corners[1],s2N2=corners[0]+6,expectedN2=(2*s1N2+s2N2)/3;assert.ok(Math.abs(contour.byNode.N2-expectedN2)<1e-12);assert.equal(contour.source,'gauss-2x2-extrapolated');assert.ok(contour.range.maxAbs>0);
console.log('shell-contour-v030-smoke: OK');
