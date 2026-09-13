import {registerElementType,getElementDefinition,registerElementComponentFactory} from '../core/elementRegistry.js';
import {createNonlinearShell4Component} from '../shell/nonlinearShell4Component.js';
import {createContactPair2DComponent,createContactPair3DComponent} from '../contact/contactPair.js';
import {createNodeSegmentContact2DComponent,createNodeTriangleContact3DComponent} from '../contact/nodeSurfaceContact.js';

const definitions=[
  {type:'shell4-nonlinear',label:'Shell Q4 RC não linear',dimension:'3d',category:'surface',dofsPerNode:['ux','uy','uz','rx','ry','rz'],nodeCount:4,capabilities:{linear:false,materialNonlinear:true,fixedCrack:true,layered:true,componentAssembly:true,commitRollback:true}},
  {type:'contact2d',label:'Contato par-a-par 2D',dimension:'2d',category:'contact',dofsPerNode:['ux','uy'],nodeCount:2,capabilities:{linear:false,unilateral:true,friction:true,smallSliding:true,componentAssembly:true,commitRollback:true}},
  {type:'contact3d',label:'Contato par-a-par 3D',dimension:'3d',category:'contact',dofsPerNode:['ux','uy','uz'],nodeCount:2,capabilities:{linear:false,unilateral:true,friction:true,smallSliding:true,componentAssembly:true,commitRollback:true}},
  {type:'contact-node-segment2d',label:'Contato nó-segmento 2D',dimension:'2d',category:'contact',dofsPerNode:['ux','uy'],nodeCount:3,capabilities:{linear:false,unilateral:true,friction:true,nodeToSurface:true,smallSliding:true,componentAssembly:true,commitRollback:true}},
  {type:'contact-node-triangle3d',label:'Contato nó-triângulo 3D',dimension:'3d',category:'contact',dofsPerNode:['ux','uy','uz'],nodeCount:4,capabilities:{linear:false,unilateral:true,friction:true,nodeToSurface:true,smallSliding:true,componentAssembly:true,commitRollback:true}},
];
const factories={
  'shell4-nonlinear':createNonlinearShell4Component,
  contact2d:createContactPair2DComponent,
  contact3d:createContactPair3DComponent,
  'contact-node-segment2d':createNodeSegmentContact2DComponent,
  'contact-node-triangle3d':createNodeTriangleContact3DComponent,
};

export function registerAdvancedShellContactComponents(){for(const definition of definitions){if(!getElementDefinition(definition.type))registerElementType(definition);registerElementComponentFactory(definition.type,factories[definition.type])}return definitions.map(d=>d.type)}
export const ADVANCED_SHELL_CONTACT_TYPES=Object.freeze(definitions.map(d=>d.type));
