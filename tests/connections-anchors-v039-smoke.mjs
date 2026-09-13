import assert from 'node:assert/strict';
import {
  CONNECTIONS_ANCHORS_CONTRACT,CONNECTIONS_ANCHORS_VERSION,CONNECTION_OBJECT_CONTRACT,CONNECTION_COUPLING_CONTRACT,
  CONNECTION_COMPONENT_CONTRACT,ANCHOR_GROUP_3D_CONTRACT,evaluateConnectionObject,connectionKinematicMap,
  relativeConnectionDeformation,createConnection3DComponent,buildAnchorGroupConnection,createAnchorGroup3DComponent,
  registerConnectionComponents
} from '../web/src/connections/index.js';
import {hasElementComponentFactory,getElementDefinition,createRegisteredElementComponent} from '../web/src/core/elementRegistry.js';

const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const vclose=(a,b,tol=1e-8,msg='')=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol,`${msg}[${i}]`))};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const norm=a=>Math.hypot(...a);

assert.equal(CONNECTIONS_ANCHORS_CONTRACT,'connections-anchors/v1');
assert.equal(CONNECTIONS_ANCHORS_VERSION,'0.39.0-exp');

// Local-global B map: a rigid-body motion with coincident connection points through offsets must produce zero relative deformation.
const n1={id:'N1',x:0,y:0,z:0},n2={id:'N2',x:1,y:0,z:0},map=connectionKinematicMap({node1:n1,node2:n2,localAxes:{x:[1,0,0],y:[0,1,0]},offset1:[.5,0,0],offset2:[-.5,0,0]});
assert.equal(map.contract,CONNECTION_COUPLING_CONTRACT);const omega=[0,0,.01],t=[.003,-.002,.001],u1=add(t,cross(omega,[n1.x,n1.y,n1.z])),u2=add(t,cross(omega,[n2.x,n2.y,n2.z])),uRigid=[...u1,...omega,...u2,...omega],qRigid=relativeConnectionDeformation(map,uRigid);assert.ok(norm(qRigid)<1e-12,`movimento rígido gerou deformação ${norm(qRigid)}`);

// Orientation: local x aligned with global y must project a local axial spring into global Y.
const project={nodes:[n1,n2]},oriented=createConnection3DComponent({element:{id:'Cori',type:'connection3d',n1:'N1',n2:'N2',localAxes:{x:[0,1,0],y:[0,0,1]},mechanisms:[{id:'kx',type:'spring6',stiffness:[100,0,0,0,0,0]}]},project}),uo=Array(12).fill(0);uo[7]=.01;const ro=oriented.response(uo);close(ro.outputs.localDeformation[0],.01,1e-12,'deformação local x');close(ro.internalForce[7],1,1e-12,'força global Y no nó 2');close(ro.internalForce[1],-1,1e-12,'ação-reação global Y');

// Tension row: delta_z = uz + rx*y - ry*x and generalized moments follow r × F.
const row=evaluateConnectionObject({connection:{id:'rows',mechanisms:[{id:'T1',type:'tension-row',x:.2,y:.1,stiffness:1000,yieldForce:10,postYieldRatio:.1}]},deformation:[0,0,.001,.01,0,0]});assert.equal(row.contract,CONNECTION_OBJECT_CONTRACT);close(row.mechanisms[0].extension,.002,1e-12,'abertura da fileira');close(row.wrench[2],2,1e-12,'tração');close(row.wrench[3],.2,1e-12,'Mx da fileira');close(row.wrench[4],-.4,1e-12,'My da fileira');

// Prescribed shear: stick -> slip through clearance -> bearing.
const boltMechanism={id:'shear',type:'bolt-group-slip-bearing',bolts:[{id:'B1',x:0,y:0}],defaults:{mu:.3,preload:100,slipPlanes:1,holeFactor:1,slipStiffness:1e5,gap:.001,bearingStiffness:2e5,bearingYieldForce:0}},boltConnection={id:'bolt',mechanisms:[boltMechanism]};
const stick=evaluateConnectionObject({connection:boltConnection,deformation:[.0001,0,0,0,0,0]}),slip=evaluateConnectionObject({connection:boltConnection,deformation:[.0005,0,0,0,0,0]}),bearing=evaluateConnectionObject({connection:boltConnection,deformation:[.002,0,0,0,0,0]});assert.equal(stick.mechanisms[0].bolts[0].slipped,false);assert.equal(slip.mechanisms[0].bolts[0].slipped,true);assert.equal(slip.mechanisms[0].bolts[0].bearingActive,false);assert.equal(bearing.mechanisms[0].bolts[0].bearingActive,true);close(stick.wrench[0],10,1e-10,'stick force');close(slip.wrench[0],30,1e-10,'slip cap');close(bearing.wrench[0],230,1e-8,'slip+bearing');

// Anchor group: symmetric uplift gives equal tension; biaxial rotation activates only the opening side.
const anchorDefaults={steelStiffness:2e5,steelYield:120,steelUltimate:160,bondStiffness:8e4,bondPeak:100,concreteStiffness:5e4,concretePeak:90,edgeFactor:1,postPeakResidualRatio:.15,softeningDisplacement:.004},anchors=[[-.1,-.1],[-.1,.1],[.1,-.1],[.1,.1]].map(([x,y],i)=>({id:`A${i+1}`,x,y})),anchorObject={id:'AG',mechanisms:[{id:'anchors',type:'anchor-group',anchors,defaults:anchorDefaults}]};
const uplift=evaluateConnectionObject({connection:anchorObject,deformation:[0,0,.001,0,0,0]}),af=uplift.mechanisms[0].anchors.filter(a=>a.tension>0).map(a=>a.tension);assert.equal(af.length,4);af.forEach(f=>close(f,af[0],1e-12,'uplift simétrico'));
const rotation=evaluateConnectionObject({connection:anchorObject,deformation:[0,0,0,0,.01,0]}),activeRotation=rotation.mechanisms[0].anchors.filter(a=>a.tension>0);assert.equal(activeRotation.length,2);assert.ok(activeRotation.every(a=>a.x<0),'rotação ry deve abrir apenas lado x<0');

// Builder combines anchor tension, compression contact and optional in-plane slip/bearing in one object.
const built=buildAnchorGroupConnection({id:'AG2',anchors,anchorDefaults,compressionPoints:[{id:'P1',x:.1,y:0,stiffness:1e6}],shearBolts:[{id:'S1',x:0,y:0}],shearDefaults:{mu:.3,preload:100,slipStiffness:1e5,gap:.001,bearingStiffness:2e5}});assert.equal(built.contract,ANCHOR_GROUP_3D_CONTRACT);assert.deepEqual(built.mechanisms.map(m=>m.type),['anchor-group','bolt-group-slip-bearing']);

// Component registration, local-global assembly, state transaction and tangent consistency away from event boundaries.
const types=registerConnectionComponents();for(const type of ['connection3d','anchor-group-3d']){assert.ok(types.includes(type));assert.equal(hasElementComponentFactory(type),true)}assert.equal(getElementDefinition('connection3d').capabilities.localGlobalCoupling,true);assert.equal(getElementDefinition('anchor-group-3d').capabilities.anchorInteraction,true);
const rowElement={id:'Cfd',type:'connection3d',n1:'N1',n2:'N2',localAxes:{x:[1,0,0],y:[0,1,0]},mechanisms:[{id:'T',type:'tension-row',x:0,y:.1,stiffness:1000,yieldForce:100}]},registered=createRegisteredElementComponent(rowElement,{project}),u=Array(12).fill(0);u[8]=.002;const r0=registered.response(u);assert.equal(registered.metadata.contract,CONNECTION_COMPONENT_CONTRACT);const h=1e-7,up=[...u],um=[...u];up[8]+=h;um[8]-=h;const fp=registered.response(up).internalForce[8],fm=registered.response(um).internalForce[8],fd=(fp-fm)/(2*h);close(r0.tangent[8][8],fd,1e-7,'tangente global vs FD');assert.equal(registered.committedState().mechanisms.T,undefined);registered.response(u);registered.commit();assert.ok(registered.committedState().mechanisms.T);const committed=registered.committedState();const ur=[...u];ur[8]=.004;registered.response(ur);assert.notDeepEqual(registered.trialState(),committed);registered.rollback();assert.deepEqual(registered.trialState(),committed);

// Explicit anchor-group component is a registered 12-DOF local-global object.
const agElement={id:'AGR',type:'anchor-group-3d',n1:'N1',n2:'N2',localAxes:{x:[1,0,0],y:[0,1,0]},anchors,anchorDefaults},ag=createAnchorGroup3DComponent({element:agElement,project});assert.equal(ag.dofCount,12);const ar=ag.response([0,0,0,0,0,0,0,0,.001,0,0,0]);assert.ok(ar.outputs.localWrench[2]>0);const agRegistered=createRegisteredElementComponent({...agElement,id:'AGR2'},{project});assert.equal(agRegistered.type,'anchor-group-3d');

// Offset force projection must preserve global force and moment equilibrium about a common origin.
const offsetElement={id:'Ceq',type:'connection3d',n1:'N1',n2:'N2',localAxes:{x:[1,0,0],y:[0,1,0]},offset1:[.5,0,0],offset2:[-.5,0,0],mechanisms:[{id:'z',type:'spring6',stiffness:[0,0,1000,0,0,0]}]},ceq=createConnection3DComponent({element:offsetElement,project}),ue=Array(12).fill(0);ue[8]=.001;const re=ceq.response(ue),F1=re.internalForce.slice(0,3),M1=re.internalForce.slice(3,6),F2=re.internalForce.slice(6,9),M2=re.internalForce.slice(9,12);vclose(add(F1,F2),[0,0,0],1e-12,'equilíbrio de forças');const totalMoment=add(add(M1,cross([n1.x,n1.y,n1.z],F1)),add(M2,cross([n2.x,n2.y,n2.z],F2)));vclose(totalMoment,[0,0,0],1e-12,'equilíbrio de momentos');

console.log('AstraStruct v0.39 Connections & Anchors 2 smoke: composite connection objects, local-global coupling, slip-bearing, tension/compression rows and 3D anchor groups OK.');
