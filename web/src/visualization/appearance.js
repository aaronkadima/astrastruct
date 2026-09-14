export const ELEMENT_APPEARANCE_CONTRACT='element-appearance/v1';
export const ELEMENT_APPEARANCE_VERSION='0.52.0-exp';
export const STRUCTURAL_GROUP_APPEARANCE_CONTRACT='structural-appearance-group/v1';
export const STRUCTURAL_GROUP_APPEARANCE_VERSION='0.52.0-exp';
export const NODE_APPEARANCE_CONTRACT='node-appearance/v1';
export const NODE_APPEARANCE_VERSION='0.52.0-exp';
export const STRUCTURAL_APPEARANCE_GROUPS=Object.freeze([
  {id:'slab',label:'Lajes',color:'#6d8da4'},
  {id:'beam',label:'Vigas',color:'#2f70ad'},
  {id:'column',label:'Pilares',color:'#536f86'},
  {id:'wall',label:'Paredes',color:'#8a8178'},
  {id:'brace',label:'Treliças / contraventamentos / cabos',color:'#368b79'},
  {id:'foundation',label:'Fundações',color:'#8d7a68'},
  {id:'other',label:'Outros',color:'#68757f'}
]);
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const groupById=id=>STRUCTURAL_APPEARANCE_GROUPS.find(g=>g.id===id)||STRUCTURAL_APPEARANCE_GROUPS.at(-1);
const hex=v=>{const s=String(v??'').trim();if(!s)return null;if(/^#[0-9a-f]{6}$/i.test(s))return s.toLowerCase();if(/^#[0-9a-f]{3}$/i.test(s))return('#'+s.slice(1).split('').map(x=>x+x).join('')).toLowerCase();throw new Error('Appearance: color deve usar #RRGGBB.');};
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const nodeIds=e=>e?.nodeIds?.length?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4].filter(Boolean);
const point=(project,id)=>(project?.nodes||[]).find(n=>String(n.id)===String(id));
const textKey=e=>[e?.appearanceGroup,e?.structuralGroup,e?.structuralRole,e?.role,e?.category,e?.type,e?.label,e?.name].filter(Boolean).join(' ').toLowerCase();
function explicitGroup(e){
  const key=textKey(e);
  if(/foundation|footing|sapata|funda[cç][aã]o|radier|pile\s*cap|pilecap|bloco\s+de\s+coroamento/.test(key))return'foundation';
  if(/slab|laje|deck|floor\s*plate/.test(key))return'slab';
  if(/wall|parede|shear\s*wall/.test(key))return'wall';
  if(/column|pillar|pilar|coluna/.test(key))return'column';
  if(/beam|girder|viga/.test(key))return'beam';
  if(/brace|bracing|contravent|truss|treli[cç]|cable|cabo|tirante/.test(key))return'brace';
  return null;
}
function shellGroup(project,e){
  const pts=nodeIds(e).map(id=>point(project,id)).filter(Boolean);if(pts.length<3)return'slab';
  const a=pts[0],b=pts[1],c=pts[2],u=[number(b.x)-number(a.x),number(b.y)-number(a.y),number(b.z)-number(a.z)],v=[number(c.x)-number(a.x),number(c.y)-number(a.y),number(c.z)-number(a.z)],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],norm=Math.hypot(...n);if(norm<1e-12)return'slab';return Math.abs(n[2])/norm>=.65?'slab':'wall';
}
function frameGroup(project,e){
  const a=point(project,e?.n1),b=point(project,e?.n2);if(!a||!b)return'beam';const dx=number(b.x)-number(a.x),dy=number(b.y)-number(a.y),dz=number(b.z)-number(a.z),type=String(e?.type||'').toLowerCase(),vertical=type.includes('2d')?Math.abs(dy):Math.abs(dz),L=Math.hypot(dx,dy,dz);return L>1e-12&&vertical/L>=.65?'column':'beam';
}
export function normalizeElementAppearance(value={}){
  return{contract:ELEMENT_APPEARANCE_CONTRACT,version:ELEMENT_APPEARANCE_VERSION,color:hex(value.color),opacity:clamp(Number.isFinite(Number(value.opacity))?Number(value.opacity):1,0,1),visible:value.visible!==false};
}
export function nodeAppearance(project){
  const value=project?.visualization?.nodeAppearance||{};
  return{contract:NODE_APPEARANCE_CONTRACT,version:NODE_APPEARANCE_VERSION,opacity:clamp(Number.isFinite(Number(value.opacity))?Number(value.opacity):1,0,1),visible:value.visible!==false};
}
export function withNodeAppearance(project,patch={}){
  const p=clone(project||{}),current=nodeAppearance(p);p.visualization={...(p.visualization||{})};p.visualization.nodeAppearance={contract:NODE_APPEARANCE_CONTRACT,version:NODE_APPEARANCE_VERSION,opacity:clamp(Number.isFinite(Number(patch.opacity))?Number(patch.opacity):current.opacity,0,1),visible:patch.visible===undefined?current.visible:patch.visible!==false};return p;
}
export function resetNodeAppearance(project){const p=clone(project||{});if(p.visualization?.nodeAppearance){p.visualization={...p.visualization};delete p.visualization.nodeAppearance;}return p;}
export function structuralElementGroup(project,elementOrId){
  const e=typeof elementOrId==='string'?(project?.elements||[]).find(x=>String(x.id)===String(elementOrId)):elementOrId||{},explicit=explicitGroup(e);if(explicit)return explicit;
  const type=String(e.type||'').toLowerCase();if(/foundation|footing|pilecap/.test(type))return'foundation';if(type.includes('shell')||type.includes('plate')||type.includes('surface'))return shellGroup(project,e);if(type.includes('truss')||type.includes('cable'))return'brace';if(type.includes('frame')||type.includes('beam'))return frameGroup(project,e);return'other';
}
export function defaultGroupAppearance(groupId){const g=groupById(groupId);return{contract:STRUCTURAL_GROUP_APPEARANCE_CONTRACT,version:STRUCTURAL_GROUP_APPEARANCE_VERSION,groupId:g.id,label:g.label,color:g.color,opacity:1,visible:true,source:'default'};}
export function defaultElementColor(element={},project=null){const type=String(element?.type||'').toLowerCase(),groupId=project?structuralElementGroup(project,element):(explicitGroup(element)||(type.includes('truss')||type.includes('cable')?'brace':type.includes('shell')?'slab':'beam'));return defaultGroupAppearance(groupId).color;}
export function groupAppearance(project,groupId){
  const g=groupById(groupId),stored=project?.visualization?.groupAppearance?.[g.id];if(stored){const n=normalizeElementAppearance(stored);return{contract:STRUCTURAL_GROUP_APPEARANCE_CONTRACT,version:STRUCTURAL_GROUP_APPEARANCE_VERSION,groupId:g.id,label:g.label,color:n.color||g.color,opacity:n.opacity,visible:n.visible,source:'group'};}
  const legacy=(project?.elements||[]).find(e=>structuralElementGroup(project,e)===g.id&&project?.visualization?.elementAppearance?.[e.id]);if(legacy){const n=normalizeElementAppearance(project.visualization.elementAppearance[legacy.id]);return{contract:STRUCTURAL_GROUP_APPEARANCE_CONTRACT,version:STRUCTURAL_GROUP_APPEARANCE_VERSION,groupId:g.id,label:g.label,color:n.color||g.color,opacity:n.opacity,visible:n.visible,source:'legacy-element'};}
  return defaultGroupAppearance(g.id);
}
export function elementAppearance(project,elementOrId){
  const id=typeof elementOrId==='string'?elementOrId:elementOrId?.id,e=typeof elementOrId==='string'?(project?.elements||[]).find(x=>String(x.id)===String(id)):elementOrId||{},groupId=structuralElementGroup(project,e),groupStored=project?.visualization?.groupAppearance?.[groupId];
  if(groupStored){const a=groupAppearance(project,groupId);return{...normalizeElementAppearance(a),color:a.color,groupId,groupLabel:a.label,source:'group'};}
  const legacy=project?.visualization?.elementAppearance?.[id]??e?.appearance;if(legacy){const n=normalizeElementAppearance(legacy);return{...n,color:n.color||defaultGroupAppearance(groupId).color,groupId,groupLabel:groupById(groupId).label,source:'legacy-element'};}
  const a=defaultGroupAppearance(groupId);return{...normalizeElementAppearance(a),color:a.color,groupId,groupLabel:a.label,source:'default'};
}
export function withGroupAppearance(project,groupId,patch={}){
  const p=clone(project||{}),g=groupById(groupId);p.visualization={...(p.visualization||{})};p.visualization.groupAppearance={...(p.visualization.groupAppearance||{})};p.visualization.elementAppearance={...(p.visualization.elementAppearance||{})};
  const current=groupAppearance(p,g.id),n=normalizeElementAppearance({...current,...patch}),stored={contract:STRUCTURAL_GROUP_APPEARANCE_CONTRACT,version:STRUCTURAL_GROUP_APPEARANCE_VERSION,groupId:g.id,color:n.color||g.color,opacity:n.opacity,visible:n.visible};p.visualization.groupAppearance[g.id]=stored;
  for(const e of p.elements||[])if(structuralElementGroup(p,e)===g.id)p.visualization.elementAppearance[e.id]={contract:ELEMENT_APPEARANCE_CONTRACT,version:ELEMENT_APPEARANCE_VERSION,color:stored.color,opacity:stored.opacity,visible:stored.visible,derivedFromGroup:g.id};
  return p;
}
export function materializeGroupAppearances(project){let out=clone(project||{});for(const g of STRUCTURAL_APPEARANCE_GROUPS)if(out?.visualization?.groupAppearance?.[g.id])out=withGroupAppearance(out,g.id,out.visualization.groupAppearance[g.id]);return out;}
export function resetGroupAppearance(project,groupId){
  const p=clone(project||{}),g=groupById(groupId);if(p.visualization?.groupAppearance)delete p.visualization.groupAppearance[g.id];if(p.visualization?.elementAppearance)for(const e of p.elements||[])if(structuralElementGroup(p,e)===g.id)delete p.visualization.elementAppearance[e.id];return p;
}
export function resetAllGroupAppearances(project){let out=clone(project||{});for(const g of STRUCTURAL_APPEARANCE_GROUPS)out=resetGroupAppearance(out,g.id);return out;}
export function withElementAppearance(project,elementId,patch={}){const e=(project?.elements||[]).find(x=>String(x.id)===String(elementId));if(!e)throw new Error(`Appearance: elemento '${elementId}' não existe.`);return withGroupAppearance(project,structuralElementGroup(project,e),patch);}
export function resetElementAppearance(project,elementId){const e=(project?.elements||[]).find(x=>String(x.id)===String(elementId));return e?resetGroupAppearance(project,structuralElementGroup(project,e)):clone(project||{});}
export function applyAppearanceToType(project,sourceElementId){const e=(project?.elements||[]).find(x=>String(x.id)===String(sourceElementId));if(!e)throw new Error('Appearance: elemento fonte não encontrado.');const groupId=structuralElementGroup(project,e),style=elementAppearance(project,e);return withGroupAppearance(project,groupId,style);}
export function appearanceGroupSummary(project){const rows=STRUCTURAL_APPEARANCE_GROUPS.map(g=>{const elements=(project?.elements||[]).filter(e=>structuralElementGroup(project,e)===g.id),appearance=groupAppearance(project,g.id);return{id:g.id,label:g.label,count:elements.length,...appearance};});return{contract:'structural-appearance-group-summary/v1',version:STRUCTURAL_GROUP_APPEARANCE_VERSION,count:rows.length,custom:rows.filter(r=>r.source==='group').length,rows};}
export function appearanceSummary(project){const elements=project?.elements||[],rows=elements.map(e=>({id:e.id,type:e.type,...elementAppearance(project,e)}));return{contract:'element-appearance-summary/v1',version:ELEMENT_APPEARANCE_VERSION,count:rows.length,custom:rows.filter(r=>r.source==='group'||r.source==='legacy-element').length,rows,groups:appearanceGroupSummary(project),nodes:nodeAppearance(project)};}
