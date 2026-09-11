import {demoTruss,demoFrame,emptyProject} from '../web/src/core/model.js';
import {solve} from '../web/src/solver/index.js';

const mixed=emptyProject();
mixed.name='Pórtico contraventado misto';
mixed.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:0,y:3},{id:'N3',x:4,y:3},{id:'N4',x:4,y:0}];
mixed.elements=[
 {id:'F1',type:'frame2d',n1:'N1',n2:'N2',materialId:'steel355',A:.01,I:.0002},
 {id:'F2',type:'frame2d',n1:'N2',n2:'N3',materialId:'steel355',A:.01,I:.0002},
 {id:'F3',type:'frame2d',n1:'N3',n2:'N4',materialId:'steel355',A:.01,I:.0002},
 {id:'T1',type:'truss2d',n1:'N1',n2:'N3',materialId:'steel355',A:.003,I:0}
];
mixed.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N4',ux:true,uy:true,rz:true}];
mixed.loads=[{id:'L1',nodeId:'N2',fx:40,fy:0,mz:0}];

for (const p of [demoTruss(),demoFrame(),mixed]) {
  const r=solve(p);
  if(!r.displacements.length) throw new Error('no displacements');
  if(r.displacements.some(d=>![d.ux,d.uy,d.rz].every(Number.isFinite))) throw new Error('non-finite result');
  console.log(p.name, 'OK', 'solver=',r.type,'DOFs=',r.dofs);
}
