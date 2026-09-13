import {createElementComponent} from './elementComponent.js';
import {registerElementComponentFactory} from './elementRegistry.js';
import {sectionDepth} from './model.js';
import {mul} from '../solver/matrix.js';
import {prepareFrameElement,recoverFrameEndForces} from '../solver/frameElement.js';
import {registerAdvancedElementComponents} from '../elements/registry.js';
import {registerNonlinearRCComponents} from '../rc/registry.js';
import {registerAdvancedShellContactComponents} from '../shellContact/registry.js';
import {registerConnectionComponents} from '../connections/registry.js';

function byId(rows,id,label,elementId){const row=(rows||[]).find(item=>item.id===id);if(!row)throw new Error(`ElementComponent ${elementId}: ${label} ${id} não encontrado.`);return row}
function geometry2d(project,element){
  const a=byId(project.nodes,element.n1,'nó',element.id),b=byId(project.nodes,element.n2,'nó',element.id),dx=Number(b.x)-Number(a.x),dy=Number(b.y)-Number(a.y),L=Math.hypot(dx,dy);
  if(!(L>1e-12))throw new Error(`ElementComponent ${element.id}: comprimento nulo.`);return{a,b,dx,dy,L,c:dx/L,s:dy/L};
}
function elementDofs2d(element,labels){return[element.n1,element.n2].flatMap(nodeId=>labels.map(label=>({owner:String(nodeId),nodeId:String(nodeId),label})))}
function subtract(a,b){return a.map((v,i)=>v-b[i])}

export function createTruss2DComponent({element,project}){
  if(!project)throw new Error(`ElementComponent ${element?.id||'(sem id)'}: project é obrigatório.`);
  const g=geometry2d(project,element),material=byId(project.materials,element.materialId,'material',element.id),E=Number(material.E),A=Number(element.A);
  if(!(E>0)||!(A>0))throw new Error(`ElementComponent ${element.id}: E e A devem ser positivos.`);
  const k=E*A/g.L,c=g.c,s=g.s,tangent=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(row=>row.map(v=>v*k));
  const loads=(project.elementLoads||[]).filter(load=>load.elementId===element.id),externalForce=Array(4).fill(0);let thermalStrain=0;
  for(const load of loads){
    if(load.kind==='selfWeight'){
      const gamma=Number(load.gamma)||Number(material.density)||0,factor=Number.isFinite(Number(load.weightFactor))?Number(load.weightFactor):1,total=gamma*A*g.L*factor;externalForce[1]-=total/2;externalForce[3]-=total/2;
    }else if(load.kind==='thermal'){
      if(Math.abs(Number(load.dTGradient)||0)>1e-15)throw new Error(`ElementComponent ${element.id}: treliça 2D não admite gradiente térmico.`);
      const eps=(Number(material.alpha)||0)*(Number(load.dT)||0),n0=E*A*eps;thermalStrain+=eps;externalForce[0]+=-n0*c;externalForce[1]+=-n0*s;externalForce[2]+=n0*c;externalForce[3]+=n0*s;
    }
  }
  return createElementComponent({
    id:element.id,type:element.type,dofs:elementDofs2d(element,['ux','uy']),metadata:{dimension:'2d',family:'truss',linear:true},
    evaluate:({u})=>{
      const internalForce=mul(tangent,u),de=-c*u[0]-s*u[1]+c*u[2]+s*u[3],N=E*A*(de/g.L-thermalStrain);
      return{tangent,residual:subtract(internalForce,externalForce),internalForce,externalForce,outputs:{N,thermalStrain,L:g.L,c:g.c,s:g.s}};
    }
  });
}

export function createFrame2DComponent({element,project}){
  if(!project)throw new Error(`ElementComponent ${element?.id||'(sem id)'}: project é obrigatório.`);
  const g=geometry2d(project,element),material=byId(project.materials,element.materialId,'material',element.id),section=(project.sections||[]).find(row=>row.id===element.sectionId)||null,loads=(project.elementLoads||[]).filter(load=>load.elementId===element.id).map(load=>load.kind==='selfWeight'?{...load,gamma:Number(load.gamma)||Number(material.density)||0}:load);
  const prepared=prepareFrameElement({E:Number(material.E),A:Number(element.A),I:Number(element.I),L:g.L,c:g.c,s:g.s,loads,releases:element.releases||{},rotationalSprings:element.rotationalSprings||{},alpha:Number(material.alpha)||0,sectionHeight:sectionDepth(section)});
  return createElementComponent({
    id:element.id,type:element.type,dofs:elementDofs2d(element,['ux','uy','rz']),metadata:{dimension:'2d',family:'frame',linear:true},
    evaluate:({u})=>{
      const internalForce=mul(prepared.kg,u),externalForce=[...prepared.pg],recovered=recoverFrameEndForces(prepared,u);
      return{tangent:prepared.kg,residual:subtract(internalForce,externalForce),internalForce,externalForce,outputs:{L:g.L,c:g.c,s:g.s,endForces:[...recovered.q],localDisplacements:[...recovered.ul],nodalLocalDisplacements:[...recovered.ulNodal],connectionRotations:recovered.connectionRotations,loadSummary:prepared.loadSummary}};
    }
  });
}

export function registerBuiltInElementComponents(){
  registerElementComponentFactory('truss2d',createTruss2DComponent);
  registerElementComponentFactory('frame2d',createFrame2DComponent);
  return['truss2d','frame2d',...registerAdvancedElementComponents(),...registerNonlinearRCComponents(),...registerAdvancedShellContactComponents(),...registerConnectionComponents()];
}
