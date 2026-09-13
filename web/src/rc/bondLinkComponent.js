import {createElementComponent} from '../core/elementComponent.js';
import {bondSlipState,initialBondSlipState} from './bondSlip1d.js';

export const RC_BOND_LINK_CONTRACT='rc-bond-link/v1';

const positive=(name,value)=>{const n=Number(value);if(!(n>0))throw new Error(`RCBondLink: ${name} deve ser positivo.`);return n};

export function createBondSlipLinkComponent({element}={}){
  if(!element?.id||!element?.n1||!element?.n2)throw new Error('RCBondLink: id, n1 e n2 são obrigatórios.');const label=String(element.dofLabel||'ux'),bondArea=positive('bondArea',element.bondArea),law={tauMax:positive('tauMax',element.tauMax),s1:positive('s1',element.s1),s2:positive('s2',element.s2),s3:positive('s3',element.s3),tauResidual:Number(element.tauResidual??0),alpha:Number(element.alpha??1)};
  return createElementComponent({id:element.id,type:element.type||'bond-slip-link',dofs:[{owner:String(element.n1),nodeId:String(element.n1),label},{owner:String(element.n2),nodeId:String(element.n2),label}],initialState:initialBondSlipState(),metadata:{contract:RC_BOND_LINK_CONTRACT,family:'bond-slip',stateful:true,dofLabel:label},evaluate:({u,committedState})=>{const slip=u[1]-u[0],state=bondSlipState({slip,committed:committedState,...law}),force=state.traction*bondArea,kt=state.tangent*bondArea;return{tangent:[[kt,-kt],[-kt,kt]],residual:[-force,force],internalForce:[-force,force],externalForce:[0,0],state:state.history,outputs:{slip,traction:state.traction,bondArea,force,tangent:kt,branch:state.branch,law:state.parameters}}}});
}
