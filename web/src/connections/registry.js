import {registerElementType,getElementDefinition,registerElementComponentFactory} from '../core/elementRegistry.js';
import {createConnection3DComponent} from './connectionComponent.js';
import {createAnchorGroup3DComponent} from './anchorGroup3d.js';

const definitions=[
  {type:'connection3d',label:'Objeto de conexão 3D',dimension:'3d',category:'connection',dofsPerNode:['ux','uy','uz','rx','ry','rz'],nodeCount:2,capabilities:{linear:false,localGlobalCoupling:true,compositeMechanisms:true,slipBearing:true,tensionRows:true,compressionContact:true,componentAssembly:true,commitRollback:true}},
  {type:'anchor-group-3d',label:'Grupo de chumbadores 3D',dimension:'3d',category:'connection',dofsPerNode:['ux','uy','uz','rx','ry','rz'],nodeCount:2,capabilities:{linear:false,localGlobalCoupling:true,anchorInteraction:true,biaxialMoment:true,shearSlipBearing:true,compressionContact:true,componentAssembly:true,commitRollback:true}}
];
const factories={connection3d:createConnection3DComponent,'anchor-group-3d':createAnchorGroup3DComponent};
export function registerConnectionComponents(){for(const d of definitions){if(!getElementDefinition(d.type))registerElementType(d);registerElementComponentFactory(d.type,factories[d.type])}return definitions.map(d=>d.type)}
export const CONNECTION_COMPONENT_TYPES=Object.freeze(definitions.map(d=>d.type));
