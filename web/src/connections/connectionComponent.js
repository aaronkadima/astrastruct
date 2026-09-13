import {createElementComponent} from '../core/elementComponent.js';
import {evaluateConnectionObject,initialConnectionObjectState} from './connectionObject.js';
import {connectionKinematicMap,relativeConnectionDeformation,projectConnectionWrench,projectConnectionTangent} from './localGlobalCoupling.js';

export const CONNECTION_COMPONENT_CONTRACT='connection-component/v1';
const labels=['ux','uy','uz','rx','ry','rz'];
function node(project,id,elementId){const n=(project?.nodes||[]).find(x=>String(x.id)===String(id));if(!n)throw new Error(`ConnectionComponent ${elementId}: nó ${id} não encontrado.`);return n}
function dofs(n1,n2){return[n1,n2].flatMap(nodeId=>labels.map(label=>({owner:String(nodeId),nodeId:String(nodeId),label})))}

export function createConnection3DComponent({element,project}={}){
  if(!element?.id||!element?.n1||!element?.n2)throw new Error('ConnectionComponent: id, n1 e n2 são obrigatórios.');
  const n1=node(project,element.n1,element.id),n2=node(project,element.n2,element.id),definition={...(element.connection||element),id:element.id},map=connectionKinematicMap({node1:n1,node2:n2,localAxes:definition.localAxes,localYHint:definition.localYHint,offset1:definition.offset1||[0,0,0],offset2:definition.offset2||[0,0,0]});
  return createElementComponent({id:element.id,type:element.type||'connection3d',dofs:dofs(element.n1,element.n2),initialState:initialConnectionObjectState(),metadata:{contract:CONNECTION_COMPONENT_CONTRACT,family:'connection',dimension:'3d',localGlobalCoupling:true,stateful:true},evaluate:({u,committedState})=>{
    const q=relativeConnectionDeformation(map,u),local=evaluateConnectionObject({connection:definition,deformation:q,committedState}),internalForce=projectConnectionWrench(map,local.wrench),tangent=projectConnectionTangent(map,local.tangent);
    return{tangent,residual:[...internalForce],internalForce,externalForce:Array(12).fill(0),state:local.state,outputs:{contract:CONNECTION_COMPONENT_CONTRACT,localDeformation:q,localWrench:local.wrench,mechanisms:local.mechanisms,basis:map.axes,offsets:map.offsets,kinematicMap:map.B}};
  }});
}
