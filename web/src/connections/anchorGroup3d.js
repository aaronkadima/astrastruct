import {createConnection3DComponent} from './connectionComponent.js';

export const ANCHOR_GROUP_3D_CONTRACT='anchor-group-3d/v1';

export function buildAnchorGroupConnection(element={}){
  if(!Array.isArray(element.anchors)||!element.anchors.length)throw new Error('AnchorGroup3D: informe ao menos um chumbador.');
  const mechanisms=[{id:'anchors',type:'anchor-group',anchors:element.anchors,defaults:element.anchorDefaults||{},compressionPoints:element.compressionPoints||[],compressionStiffness:element.compressionStiffness}];
  if(Array.isArray(element.shearBolts)&&element.shearBolts.length)mechanisms.push({id:'shear',type:'bolt-group-slip-bearing',bolts:element.shearBolts,defaults:element.shearDefaults||{}});
  for(const row of element.extraTensionRows||[])mechanisms.push({...row,type:'tension-row'});
  for(const row of element.extraCompressionRows||[])mechanisms.push({...row,type:'compression-row'});
  return{id:element.id,contract:ANCHOR_GROUP_3D_CONTRACT,localAxes:element.localAxes,localYHint:element.localYHint,offset1:element.offset1||[0,0,0],offset2:element.offset2||[0,0,0],mechanisms};
}

export function createAnchorGroup3DComponent({element,project}={}){
  const connection=buildAnchorGroupConnection(element);return createConnection3DComponent({element:{...element,type:element.type||'anchor-group-3d',connection},project});
}
