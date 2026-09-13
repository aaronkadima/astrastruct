import assert from 'node:assert/strict';
import {DofManager} from '../web/src/numerics/dofManager.js';
import {createElementComponent,validateElementComponent,ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {assembleElementComponents,commitElementComponents,rollbackElementComponents} from '../web/src/core/elementAssembly.js';
import {registerBuiltInElementComponents} from '../web/src/core/builtInElementComponents.js';
import {createRegisteredElementComponent,hasElementComponentFactory,registerElementComponentFactory} from '../web/src/core/elementRegistry.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const symmetric=(A,tol=1e-12)=>A.every((row,i)=>row.every((v,j)=>Math.abs(v-A[j][i])<=tol*Math.max(1,Math.abs(v),Math.abs(A[j][i]))));

registerBuiltInElementComponents();
assert.equal(hasElementComponentFactory('truss2d'),true);assert.equal(hasElementComponentFactory('frame2d'),true);
assert.throws(()=>registerElementComponentFactory('future-element',()=>null),/tipo não registrado/);

const project={
  nodes:[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}],
  materials:[{id:'steel',type:'steel',E:200e6,density:78.5,alpha:12e-6}],
  sections:[{id:'S1',family:'rect',h:.4,b:.2,A:.08,I:.0010666666666666667}],
  elementLoads:[]
};
const trussElement={id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel',A:.01};
const truss=createRegisteredElementComponent(trussElement,{project});
assert.equal(truss.contract,ELEMENT_COMPONENT_CONTRACT);assert.equal(validateElementComponent(truss),true);assert.equal(truss.dofCount,4);
const trussResponse=truss.response([0,0,.001,0]);
assert.equal(trussResponse.contract,'element-response/v1');assert.equal(symmetric(trussResponse.tangent),true);
close(trussResponse.outputs.N,1000,1e-12,'força axial');
trussResponse.internalForce.forEach((v,i)=>close(v,[-1000,0,1000,0][i],1e-12,'força interna truss'));
close(trussResponse.residual.reduce((s,v)=>s+v,0),0,1e-12,'equilíbrio nodal truss');

const frameElement={id:'F1',type:'frame2d',n1:'N1',n2:'N2',materialId:'steel',sectionId:'S1',A:.08,I:.0010666666666666667,releases:{},rotationalSprings:{}};
const frame=createRegisteredElementComponent(frameElement,{project}),frameResponse=frame.response([0,0,0,.001,0,0]);
assert.equal(frame.dofCount,6);assert.equal(symmetric(frameResponse.tangent),true);
close(frameResponse.outputs.endForces[0],-8000,1e-11,'N1 frame');close(frameResponse.outputs.endForces[3],8000,1e-11,'N2 frame');
close(frameResponse.residual[0]+frameResponse.residual[3],0,1e-12,'equilíbrio axial frame');

// Stateful component: every trial starts from committed state. Rollback must discard unconverged history.
const stateful=createElementComponent({
  id:'STATE1',type:'state-probe',dofs:[{owner:'N1',nodeId:'N1',label:'ux'}],initialState:{damage:0,plastic:0},
  evaluate:({u,committedState})=>{
    const damage=Math.max(Number(committedState.damage)||0,Math.abs(u[0])*.1),plastic=(Number(committedState.plastic)||0)+(Math.abs(u[0])>1?Math.abs(u[0])-1:0);
    return{tangent:[[100]],internalForce:[100*u[0]],externalForce:[0],residual:[100*u[0]],state:{damage,plastic},outputs:{damage,plastic}};
  }
});
stateful.response([2]);close(stateful.trialState().damage,.2);close(stateful.committedState().damage,0);
rollbackElementComponents([stateful]);close(stateful.trialState().damage,0);close(stateful.committedState().plastic,0);
stateful.response([3]);commitElementComponents([stateful]);close(stateful.committedState().damage,.3);close(stateful.committedState().plastic,2);
stateful.response([.5]);close(stateful.trialState().damage,.3);close(stateful.trialState().plastic,2);stateful.rollback();

// Universal sparse assembly uses DOF descriptors instead of nodeIndex*dofsPerNode assumptions.
const dofs=new DofManager(),assembly=assembleElementComponents({components:[truss],dofManager:dofs,displacements:[0,0,.001,0]});
assert.equal(assembly.contract,'element-assembly/v1');assert.equal(assembly.dofs,4);assert.ok(assembly.tangent.nnz>0);assert.deepEqual(dofs.ownerDofs('N1'),{ux:0,uy:1});
assembly.residual.forEach((v,i)=>close(v,[-1000,0,1000,0][i],1e-12,'assembly residual'));

const bad=createElementComponent({id:'BAD',type:'probe',dofs:[{owner:'N1',label:'ux'}],evaluate:()=>({residual:[0,1],tangent:[[1]]})});
assert.throws(()=>bad.response([0]),/residual deve ter 1 valores finitos/);

console.log('AstraStruct v0.33 Component/Element API smoke: contract, real adapters, sparse assembly and commit/rollback OK.');
