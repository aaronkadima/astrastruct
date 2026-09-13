import {cyclicSteelFromModelMaterial,initialSteelHistoryState} from '../solver/material1d.js';

export const RC_REBAR_1D_CONTRACT='rc-rebar-1d/v1';

export function initialRebarState(){return initialSteelHistoryState()}

export function rebarState({strain,material,committed=null,hardeningRatio=.01,kinematicFraction=1}={}){
  const state=cyclicSteelFromModelMaterial(material,strain,{hardeningRatio,kinematicFraction,committed});
  return{contract:RC_REBAR_1D_CONTRACT,type:'rc-rebar-cyclic-steel',strain:state.strain,stress:state.stress,tangent:state.tangent,yielded:!!state.yielded,branch:state.branch,history:state.history,plasticStrain:state.plasticStrain,backstress:state.backstress,equivalentPlasticStrain:state.equivalentPlasticStrain,dissipatedEnergyDensity:state.dissipatedEnergyDensity,hardeningRatio:state.hardeningRatio,kinematicFraction:state.kinematicFraction};
}
