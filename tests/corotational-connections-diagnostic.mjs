import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { solveFrameCorotational2D } from '../web/src/solver/corotational2d.js';

function model(){
  const p=emptyProject();p.name='Diagnóstico — console semirrígido';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];
  const e=makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50'});
  e.rotationalSprings={rz1:10000,rz2:null};p.elements=[e];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];
  return p;
}

for(const lineSearch of [false,true]){
  for(const tolerance of [1e-8,1e-9,1e-10]){
    try{
      const r=solveFrameCorotational2D(model(),'LC1',{steps:8,maxIterations:40,tolerance,lineSearch});
      const tip=r.displacements.find(d=>d.nodeId==='N2'),f=r.elementForces[0],conn=f.connectionRotations.find(c=>c.end===1),last=r.nonlinear.history.at(-1),maxIterations=Math.max(...r.nonlinear.history.map(h=>h.iterations));
      console.log('DIAG semirigid OK',{lineSearch,tolerance,uyMm:tip.uy*1000,M1:f.M1,relativeRotation:conn?.relativeRotation,internalResidual:f.connectionCondensation?.internalResidual,lastResidual:last?.residualNorm,maxIterations});
    }catch(error){
      console.log('DIAG semirigid FAIL',{lineSearch,tolerance,message:error?.message||String(error)});
    }
  }
}
