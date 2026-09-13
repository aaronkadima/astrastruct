import {registerElementType,registerElementComponentFactory} from '../core/elementRegistry.js';
import {createBondSlipLinkComponent} from './bondLinkComponent.js';

export function registerNonlinearRCComponents(){
  registerElementType({type:'bond-slip-link',label:'Bond-slip RC',dimension:'2d',category:'connection',dofsPerNode:['configurable'],nodeCount:2,capabilities:{nonlinear:true,bondSlip:true,commitRollback:true}});
  registerElementComponentFactory('bond-slip-link',({element})=>createBondSlipLinkComponent({element}));
  return['bond-slip-link'];
}
