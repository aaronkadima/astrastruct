import assert from 'node:assert/strict';
import {solveSpatial3D} from '../web/src/solver/spatial3d.js';
import {buildFrameDiagram3D,frameDiagramFieldValue3D,frameDiagramRange3D} from '../web/src/view/frameDiagram3d.js';

const close=(a,b,t=1e-9,m='value')=>assert.ok(Math.abs(a-b)<=t,`${m}: got ${a}, expected ${b}`);
const E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3;
const base={materials:[{id:'S',E,nu}],sections:[{id:'SEC',A,Iy,Iz,J,I:Iz}],nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:L,y:0,z:0}],elements:[{id:'E',type:'frame3d',n1:'A',n2:'B',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],loads:[],elementLoads:[],supports:[]};

{
  const q=-8,p={...base,supports:[{nodeId:'A',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'B',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],elementLoads:[{elementId:'E',kind:'uniform',qy:q}]},r=solveSpatial3D(p),scene=buildFrameDiagram3D(p,r,5),s=scene.elements[0].stations;
  close(s[0].Mz,q*L*L/12,1e-8,'fixed-end Mz left');close(s[2].Mz,-q*L*L/24,1e-8,'fixed-end Mz mid');close(s[4].Mz,q*L*L/12,1e-8,'fixed-end Mz right');
  close(s[0].Vy,-q*L/2,1e-8,'Vy left');close(s[4].Vy,q*L/2,1e-8,'Vy right');
  const range=frameDiagramRange3D(scene,'MzBar');assert.ok(range.min<0&&range.max>0);assert.equal(scene.samples,5);
}
{
  const P=12,p={...base,supports:[{nodeId:'A',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'B',fy:-P}]},r=solveSpatial3D(p),scene=buildFrameDiagram3D(p,r,21),s=scene.elements[0].stations;
  close(s[0].Mz,-P*L,1e-8,'cantilever Mz root');close(s.at(-1).Mz,0,1e-8,'cantilever Mz tip');close(s.at(-1).uy,-P*L**3/(3*E*Iz),2e-12,'cantilever tip displacement');
  assert.ok(Math.abs(s[10].uy)>0&&Math.abs(s[10].uy)<Math.abs(s.at(-1).uy));
  close(frameDiagramFieldValue3D(s.at(-1),'UyBar'),1000*s.at(-1).uy,1e-12,'Uy display in mm');
}
{
  const Q=35,p={...base,supports:[{nodeId:'A',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'B',fx:Q}]},r=solveSpatial3D(p),scene=buildFrameDiagram3D(p,r,11),s=scene.elements[0].stations;
  for(const st of s){close(st.N,Q,1e-7,'axial N');close(st.epsX,Q/(E*A),1e-12,'axial strain')}
  close(frameDiagramFieldValue3D(s[5],'epsX'),1e6*Q/(E*A),1e-9,'microstrain field');
}
console.log('frame diagram 3D smoke: OK');
