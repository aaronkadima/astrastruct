import assert from 'node:assert/strict';
import {
  ADVANCED_SHELL_CONTACT_CONTRACT,ADVANCED_SHELL_CONTACT_VERSION,SHELL_CONCRETE_PLANE_STRESS_CONTRACT,
  LAYERED_SHELL_SECTION_CONTRACT,CONTACT_PAIR_CONTRACT,concretePlaneStressFixedCrackState,
  layeredShellSectionResponse,createLayeredShellSectionTransaction,createNonlinearShell4Component,
  createContactPair2DComponent,createContactPair3DComponent,registerAdvancedShellContactComponents
} from '../web/src/shellContact/index.js';
import {shell4Element} from '../web/src/solver/shell4.js';
import {mul} from '../web/src/solver/matrix.js';
import {hasElementComponentFactory,getElementDefinition,createRegisteredElementComponent} from '../web/src/core/elementRegistry.js';

const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const vclose=(a,b,tol=1e-8,msg='')=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol,`${msg}[${i}]`))};
const norm=a=>Math.hypot(...a);
const concrete={id:'C30',type:'concrete',E:30e6,nu:.2,fck:30,fctm:3,Gf:.1,Gc:3};

assert.equal(ADVANCED_SHELL_CONTACT_CONTRACT,'advanced-shell-contact/v1');assert.equal(ADVANCED_SHELL_CONTACT_VERSION,'0.38.0-exp');
const registered=registerAdvancedShellContactComponents();for(const type of ['shell4-nonlinear','contact2d','contact3d']){assert.ok(registered.includes(type));assert.equal(hasElementComponentFactory(type),true)}
assert.equal(getElementDefinition('shell4-nonlinear').capabilities.materialNonlinear,true);assert.equal(getElementDefinition('contact3d').capabilities.unilateral,true);

// Plane stress: uncracked isotropic limit, fixed crack, shear retention and aggregate interlock.
const elastic=concretePlaneStressFixedCrackState({strain:[1e-5,0,0],material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});assert.equal(elastic.contract,SHELL_CONCRETE_PLANE_STRESS_CONTRACT);close(elastic.stress[0],concrete.E/(1-concrete.nu**2)*1e-5,1e-10,'plane stress elastic sx');close(elastic.stress[1],concrete.E*concrete.nu/(1-concrete.nu**2)*1e-5,1e-10,'plane stress elastic sy');assert.equal(elastic.cracked,false);
const cracked=concretePlaneStressFixedCrackState({strain:[4e-4,0,0],material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});assert.equal(cracked.cracked,true);close(cracked.crackAngle,0,1e-8,'crack direction');assert.ok(cracked.shearRetention<1);
const closedShear=concretePlaneStressFixedCrackState({strain:[-8e-4,0,.01],material:concrete,committed:cracked.history,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3,aggregateInterlockMu:.4});assert.equal(closedShear.local.dir1.crackClosed,true);assert.equal(closedShear.aggregateInterlockActive,true);assert.ok(Math.abs(closedShear.local.stress[2])<=closedShear.local.aggregateInterlockCap+1e-8);

// Layer integration: membrane is exact; midpoint bending converges monotonically to t^3/12.
const t=.2,mem=layeredShellSectionResponse({thickness:t,concreteMaterial:concrete,layerCount:8,generalizedStrain:[1e-5,0,0,0,0,0,0,0],options:{characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3}});assert.equal(mem.contract,LAYERED_SHELL_SECTION_CONTRACT);const D11=concrete.E/(1-concrete.nu**2);close(mem.tangent[0][0],D11*t,1e-10,'shell membrane stiffness');
const exactB=D11*t**3/12,err=n=>Math.abs(layeredShellSectionResponse({thickness:t,concreteMaterial:concrete,layerCount:n,generalizedStrain:[0,0,0,1e-5,0,0,0,0],options:{characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3}}).tangent[3][3]-exactB);assert.ok(err(16)<err(8)&&err(8)<err(4),'integração em espessura deve convergir em flexão');
const tx=createLayeredShellSectionTransaction({thickness:t,concreteMaterial:concrete,layerCount:8,options:{characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3}}),txCrack=tx.response([4e-4,0,0,0,0,0,0,0]);assert.ok(txCrack.crackedLayers>0);assert.equal(tx.committedState().concrete.some(x=>x.cracked),false);tx.commit();const committed=tx.committedState();tx.response([-8e-4,0,.01,0,0,0,0,0]);assert.notDeepEqual(tx.trialState(),committed);tx.rollback();assert.deepEqual(tx.trialState(),committed);

// Nonlinear shell4 must reproduce the existing linear Q4 in a purely elastic membrane state.
const nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:1,y:0,z:0},{id:'N3',x:1,y:1,z:0},{id:'N4',x:0,y:1,z:0}],project={nodes,materials:[concrete],sections:[{id:'S',thickness:t}],elementLoads:[]},element={id:'NS1',type:'shell4-nonlinear',nodeIds:nodes.map(n=>n.id),materialId:'C30',sectionId:'S',layerCount:12,characteristicLength:.1,drillingFactor:1e-6},nl=createNonlinearShell4Component({element,project}),u=Array(24).fill(0);u[6]=1e-5;u[12]=1e-5;const nlElastic=nl.response(u),lin=shell4Element({nodes,E:concrete.E,nu:concrete.nu,thickness:t,drillingFactor:1e-6,element:{id:'L1'}}),linForce=mul(lin.kg,u);vclose(nlElastic.internalForce,linForce,2e-6,'nonlinear shell elastic limit');assert.ok(norm(nlElastic.residual)>0);const uCr=[...u];uCr[6]=1e-3;uCr[12]=1e-3;const shellCrack=nl.response(uCr);assert.ok(shellCrack.outputs.gaussPoints.some(p=>p.crackedLayers>0));nl.rollback();assert.deepEqual(nl.trialState(),nl.committedState());
const registeredShell=createRegisteredElementComponent({...element,id:'NS2'},{project});assert.equal(registeredShell.type,'shell4-nonlinear');

// 2D unilateral contact: open -> close; friction stick -> slip with transactional state.
const contactProject2={nodes:[{id:'A',x:0,y:0},{id:'B',x:1,y:0}]},cOpen=createContactPair2DComponent({element:{id:'Copen',type:'contact2d',n1:'A',n2:'B',normal:[1,0],initialGap:.001,normalStiffness:1000},project:contactProject2}),open=cOpen.response([0,0,0,0]);assert.equal(open.outputs.active,false);close(open.outputs.gap,.001);assert.ok(open.tangent.flat().every(v=>Math.abs(v)<1e-14));const closed=cOpen.response([0,0,-.002,0]);assert.equal(closed.outputs.active,true);close(closed.outputs.penetration,.001);close(closed.outputs.normalForce,-1);vclose(closed.internalForce,[1,0,-1,0],1e-12,'contact pair equilibrium');close(closed.internalForce.reduce((a,b)=>a+b,0),0,1e-12);
const friction=createContactPair2DComponent({element:{id:'Cf',type:'contact2d',n1:'A',n2:'B',normal:[1,0],normalStiffness:1000,tangentialStiffness:200,frictionCoefficient:.5},project:contactProject2}),stick=friction.response([0,0,-.001,.001]);assert.equal(stick.outputs.branch,'stick');close(Math.abs(stick.outputs.tangentialForce[1]),.2,1e-12);const slip=friction.response([0,0,-.001,.01]);assert.equal(slip.outputs.branch,'slip');close(norm(slip.outputs.tangentialForce),.5,1e-12,'Coulomb cap');assert.ok(slip.outputs.dissipatedEnergy>0);friction.commit();const fc=friction.committedState();friction.response([0,0,-.001,-.01]);assert.notDeepEqual(friction.trialState(),fc);friction.rollback();assert.deepEqual(friction.trialState(),fc);

// 3D contact preserves arbitrary normal orientation and two-dimensional tangential plane.
const contactProject3={nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:0,y:0,z:1}]},c3=createContactPair3DComponent({element:{id:'C3',type:'contact3d',n1:'A',n2:'B',normal:[0,0,1],normalStiffness:2000,tangentialStiffness:500,frictionCoefficient:.25},project:contactProject3}),r3=c3.response([0,0,0,.002,0,-.001]);assert.equal(r3.contract,'element-response/v1');assert.equal(c3.metadata.contract,CONTACT_PAIR_CONTRACT);assert.equal(r3.outputs.active,true);close(r3.outputs.normalForce,-2);assert.ok(norm(r3.outputs.tangentialForce)<=.5+1e-10);close(r3.internalForce[0]+r3.internalForce[3],0,1e-12);close(r3.internalForce[1]+r3.internalForce[4],0,1e-12);close(r3.internalForce[2]+r3.internalForce[5],0,1e-12);

console.log('AstraStruct v0.38 Advanced Shell/Contact smoke: fixed-crack plane stress, layered nonlinear shell4 and unilateral frictional contact 2D/3D OK.');
