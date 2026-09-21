import assert from 'node:assert/strict';
import {solveSpatial3D} from '../web/src/solver/spatial3d.js';
import {buildFrameDiagram3D,frameDiagramFieldValue3D,frameDiagramRange3D,probeProjectedFrameDiagram3D,probeProjectedFrameEnvelope3D,buildFrameDiagramEnvelope3D,frameDiagramEnvelopeRange3D,frameDiagramLabels3D,frameEnvelopeLabels3D} from '../web/src/view/frameDiagram3d.js';

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

{
  const items=[{e:{id:'Eprobe'},points:[
    {xi:0,x:0,value:-10,pOffset:{x:10,y:20,visible:true},pBase:{x:10,y:40}},
    {xi:.5,x:1.5,value:0,pOffset:{x:60,y:20,visible:true},pBase:{x:60,y:40}},
    {xi:1,x:3,value:20,pOffset:{x:110,y:20,visible:true},pBase:{x:110,y:40}}
  ]}];
  const probe=probeProjectedFrameDiagram3D(items,85,22,6);assert.ok(probe);assert.equal(probe.elementId,'Eprobe');close(probe.xi,.75,1e-12,'probe xi');close(probe.x,2.25,1e-12,'probe x');close(probe.value,10,1e-12,'probe interpolated value');close(probe.baseScreen.x,85,1e-12,'probe baseline interpolation');
  assert.equal(probeProjectedFrameDiagram3D(items,85,50,4),null);
}
{
  const P1=10,P2=-18,make=P=>({...base,supports:[{nodeId:'A',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'B',fy:P}]});
  const p=make(P1),r1=solveSpatial3D(p),r2=solveSpatial3D(make(P2)),env=buildFrameDiagramEnvelope3D(p,[{combinationId:'C1',result:r1},{combinationId:'C2',result:r2}],9),row=env.elements[0];
  assert.equal(env.contract,'frame-diagram-envelope-3d/v1');assert.equal(row.stations.length,9);
  const root=row.stations[0].fields.MzBar;close(root.min,P2*L,1e-8,'envelope root Mz min');close(root.max,P1*L,1e-8,'envelope root Mz max');assert.equal(root.minCombinationId,'C2');assert.equal(root.maxCombinationId,'C1');assert.equal(root.governingCombinationId,'C2');
  const range=frameDiagramEnvelopeRange3D(env,'MzBar');close(range.min,P2*L,1e-8,'envelope global min');close(range.max,P1*L,1e-8,'envelope global max');assert.equal(range.absPoint.combinationId,'C2');
}

{
  const active={elements:[{elementId:'Eenv',stations:[{My:5},{My:7},{My:9}]}]},items=[{e:{id:'Eenv'},points:[
    {xi:0,x:0,env:{min:-10,max:12,minCombinationId:'C1',maxCombinationId:'C2'},pBase:{x:20,y:40,visible:true},pMin:{x:20,y:55,visible:true},pMax:{x:20,y:20,visible:true}},
    {xi:.5,x:1.5,env:{min:-8,max:15,minCombinationId:'C3',maxCombinationId:'C4'},pBase:{x:70,y:40,visible:true},pMin:{x:70,y:52,visible:true},pMax:{x:70,y:18,visible:true}},
    {xi:1,x:3,env:{min:-6,max:10,minCombinationId:'C5',maxCombinationId:'C6'},pBase:{x:120,y:40,visible:true},pMin:{x:120,y:49,visible:true},pMax:{x:120,y:25,visible:true}}
  ]}];
  const probe=probeProjectedFrameEnvelope3D(items,73,19,8,active,'MyBar');assert.ok(probe);assert.equal(probe.elementId,'Eenv');assert.equal(probe.stationIndex,1);close(probe.xi,.5,1e-12,'envelope probe xi');close(probe.x,1.5,1e-12,'envelope probe x');close(probe.min,-8,1e-12,'envelope probe min');close(probe.max,15,1e-12,'envelope probe max');close(probe.activeValue,7,1e-12,'envelope probe active value');assert.equal(probe.minCombinationId,'C3');assert.equal(probe.maxCombinationId,'C4');
}

{
  const scene={elements:[{elementId:'Elabels',type:'frame3d',stations:[
    {xi:0,x:0,Mz:-10},{xi:.25,x:.75,Mz:-4},{xi:.5,x:1.5,Mz:2},{xi:.75,x:2.25,Mz:8},{xi:1,x:3,Mz:3}
  ]}]};
  const labels=frameDiagramLabels3D(scene,'MzBar',{count:3,includeExtrema:true,includeZeros:true}),row=labels.elements[0],zeros=row.labels.filter(x=>x.kind==='zero');
  assert.equal(labels.contract,'frame-diagram-labels-3d/v1');assert.ok(row.labels.some(x=>x.kind==='min'&&x.value===-10));assert.ok(row.labels.some(x=>x.kind==='max'&&x.value===8));assert.equal(zeros.length,1);close(zeros[0].xi,.25+(.25*4/6),1e-12,'zero crossing xi');assert.ok(row.labels.filter(x=>x.kind==='sample').length>=2);
}
{
  const env={elements:[{elementId:'Eenvlabels',type:'frame3d',stations:[
    {xi:0,x:0,fields:{MzBar:{min:-9,max:12,minCombinationId:'C1',maxCombinationId:'C2'}}},
    {xi:.5,x:1.5,fields:{MzBar:{min:-15,max:7,minCombinationId:'C3',maxCombinationId:'C4'}}},
    {xi:1,x:3,fields:{MzBar:{min:-4,max:18,minCombinationId:'C5',maxCombinationId:'C6'}}}
  ]}]};
  const labels=frameEnvelopeLabels3D(env,'MzBar',{count:3,includeExtrema:true}),row=labels.elements[0];
  assert.equal(labels.contract,'frame-envelope-labels-3d/v1');assert.ok(row.labels.some(x=>x.kind==='min'&&x.min===-15&&x.minCombinationId==='C3'));assert.ok(row.labels.some(x=>x.kind==='max'&&x.max===18&&x.maxCombinationId==='C6'));assert.ok(row.labels.filter(x=>x.kind==='sample').length>=2);
}
