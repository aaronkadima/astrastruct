import {registerElementType,getElementDefinition,registerElementComponentFactory} from '../core/elementRegistry.js';
import {createTimoshenko2DComponent} from './timoshenko2d.js';
import {createTimoshenko3DComponent} from './timoshenko3d.js';
import {createCable2DComponent,createCable3DComponent} from './cable.js';
import {createNonlinearLink2DComponent,createNonlinearLink3DComponent} from './nonlinearLink.js';
import {createRigidOffsetFrame2DComponent,createRigidOffsetFrame3DComponent} from './rigidOffsetFrame.js';

const definitions=[
  {type:'timoshenko2d',label:'Frame 2D Timoshenko',dimension:'2d',dofsPerNode:['ux','uy','rz'],nodeCount:2,capabilities:{linear:true,shearDeformation:true,componentAssembly:true}},
  {type:'timoshenko3d',label:'Frame 3D Timoshenko',dimension:'3d',dofsPerNode:['ux','uy','uz','rx','ry','rz'],nodeCount:2,capabilities:{linear:true,shearDeformation:true,componentAssembly:true}},
  {type:'cable2d',label:'Cabo 2D co-rotacional',dimension:'2d',dofsPerNode:['ux','uy'],nodeCount:2,capabilities:{linear:false,corotational:true,tensionOnly:true,componentAssembly:true}},
  {type:'cable3d',label:'Cabo 3D co-rotacional',dimension:'3d',dofsPerNode:['ux','uy','uz'],nodeCount:2,capabilities:{linear:false,corotational:true,tensionOnly:true,componentAssembly:true}},
  {type:'link2d',label:'Link não linear 2D',dimension:'2d',dofsPerNode:['configurable'],nodeCount:2,capabilities:{linear:false,stateful:true,cyclic:true,componentAssembly:true}},
  {type:'link3d',label:'Link não linear 3D',dimension:'3d',dofsPerNode:['configurable'],nodeCount:2,capabilities:{linear:false,stateful:true,cyclic:true,componentAssembly:true}},
  {type:'frame2d-offset',label:'Frame 2D com offsets/zonas rígidas',dimension:'2d',dofsPerNode:['ux','uy','rz'],nodeCount:2,capabilities:{linear:true,rigidOffsets:true,rigidZones:true,componentAssembly:true}},
  {type:'frame3d-offset',label:'Frame 3D com offsets/zonas rígidas',dimension:'3d',dofsPerNode:['ux','uy','uz','rx','ry','rz'],nodeCount:2,capabilities:{linear:true,rigidOffsets:true,rigidZones:true,componentAssembly:true}},
];
const factories={timoshenko2d:createTimoshenko2DComponent,timoshenko3d:createTimoshenko3DComponent,cable2d:createCable2DComponent,cable3d:createCable3DComponent,link2d:createNonlinearLink2DComponent,link3d:createNonlinearLink3DComponent,'frame2d-offset':createRigidOffsetFrame2DComponent,'frame3d-offset':createRigidOffsetFrame3DComponent};

export function registerAdvancedElementComponents(){for(const definition of definitions)if(!getElementDefinition(definition.type))registerElementType(definition);for(const definition of definitions)registerElementComponentFactory(definition.type,factories[definition.type]);return definitions.map(definition=>definition.type)}
export const ADVANCED_ELEMENT_TYPES=Object.freeze(definitions.map(definition=>definition.type));
