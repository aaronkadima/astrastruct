export const ELEMENT_APPEARANCE_CONTRACT='element-appearance/v1';
export const ELEMENT_APPEARANCE_VERSION='0.52.0-exp';
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hex=v=>{const s=String(v??'').trim();if(!s)return null;if(/^#[0-9a-f]{6}$/i.test(s))return s.toLowerCase();if(/^#[0-9a-f]{3}$/i.test(s))return('#'+s.slice(1).split('').map(x=>x+x).join('')).toLowerCase();throw new Error('Appearance: color deve usar #RRGGBB.');};
export function normalizeElementAppearance(value={}){
  return{contract:ELEMENT_APPEARANCE_CONTRACT,version:ELEMENT_APPEARANCE_VERSION,color:hex(value.color),opacity:clamp(Number.isFinite(Number(value.opacity))?Number(value.opacity):1,0,1),visible:value.visible!==false};
}
export function defaultElementColor(element={}){
  const type=String(element.type||'').toLowerCase();
  if(type.includes('shell')||type.includes('slab')||type.includes('wall'))return'#6d8da4';
  if(type.includes('truss')||type.includes('cable'))return'#368b79';
  if(type.includes('foundation')||type.includes('footing'))return'#8d7a68';
  return'#2f70ad';
}
export function elementAppearance(project,elementOrId){
  const id=typeof elementOrId==='string'?elementOrId:elementOrId?.id,element=typeof elementOrId==='string'?(project?.elements||[]).find(e=>String(e.id)===String(id)):elementOrId||{};
  const stored=project?.visualization?.elementAppearance?.[id]??element?.appearance??{};
  const normalized=normalizeElementAppearance(stored);
  return{...normalized,color:normalized.color||defaultElementColor(element)};
}
export function withElementAppearance(project,elementId,patch={}){
  const p=clone(project||{}),id=String(elementId??'').trim();if(!id)throw new Error('Appearance: elementId é obrigatório.');
  if(!(p.elements||[]).some(e=>String(e.id)===id))throw new Error(`Appearance: elemento '${id}' não existe.`);
  p.visualization={...(p.visualization||{})};p.visualization.elementAppearance={...(p.visualization.elementAppearance||{})};
  const current=elementAppearance(p,id),next=normalizeElementAppearance({...current,...patch});
  p.visualization.elementAppearance[id]={contract:next.contract,version:next.version,color:next.color,opacity:next.opacity,visible:next.visible};
  return p;
}
export function resetElementAppearance(project,elementId){
  const p=clone(project||{}),id=String(elementId??'');if(p.visualization?.elementAppearance)delete p.visualization.elementAppearance[id];return p;
}
export function applyAppearanceToType(project,sourceElementId){
  const p=clone(project||{}),source=(p.elements||[]).find(e=>String(e.id)===String(sourceElementId));if(!source)throw new Error('Appearance: elemento fonte não encontrado.');
  const style=elementAppearance(p,source);let out=p;for(const e of p.elements||[])if(e.type===source.type)out=withElementAppearance(out,e.id,style);return out;
}
export function appearanceSummary(project){
  const elements=project?.elements||[],rows=elements.map(e=>({id:e.id,type:e.type,...elementAppearance(project,e)}));
  return{contract:'element-appearance-summary/v1',version:ELEMENT_APPEARANCE_VERSION,count:rows.length,custom:rows.filter(r=>project?.visualization?.elementAppearance?.[r.id]).length,rows};
}
