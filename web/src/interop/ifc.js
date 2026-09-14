export const IFC_INTEROP_CONTRACT='ifc-interoperability/v1';
export const IFC_INTEROP_VERSION='0.45.0-exp';
export const IFC_SCHEMA='IFC4X3_ADD2';
export const IFC_STANDARD='ISO 16739-1:2024';

const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').trim();
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const key=(kind,id)=>`${kind}:${text(id)}`;

function requireId(kind,value){const id=text(value);if(!id)throw new Error(`IFC interop: ${kind} requer id.`);return id}
function uniqueById(items=[],kind='item'){const seen=new Set();for(const item of items){const id=requireId(kind,item?.id);if(seen.has(id))throw new Error(`IFC interop: ${kind} duplicado ${id}.`);seen.add(id)}return seen}
function nodeIdsForElement(e={}){
  if(Array.isArray(e.nodeIds)&&e.nodeIds.length)return e.nodeIds.map(text).filter(Boolean);
  if(Array.isArray(e.nodes)&&e.nodes.every(x=>typeof x==='string'||typeof x==='number'))return e.nodes.map(text).filter(Boolean);
  return ['n1','n2','n3','n4','n5','n6','n7','n8'].map(k=>text(e[k])).filter(Boolean);
}

export function ifcClassForElement(element={}){
  const type=text(element.type).toLowerCase();
  if(/shell|surface|plate|slab|membrane|wall/.test(type))return'IfcStructuralSurfaceMember';
  return'IfcStructuralCurveMember';
}

function supportForNode(project,nodeId){
  const list=Array.isArray(project?.supports)?project.supports:[];
  const hits=list.filter(s=>text(s.nodeId??s.node??s.id)===nodeId);
  if(!hits.length)return null;
  return{ifcClass:'IfcBoundaryNodeCondition',source:copy(hits)};
}

function materialRecord(m){
  const id=requireId('material',m?.id);
  return{key:key('material',id),ifcClass:'IfcMaterial',sourceId:id,name:text(m.name)||id,category:text(m.type)||null,properties:copy(m)};
}

function sectionRecord(s){
  const id=requireId('section',s?.id);
  return{key:key('section',id),ifcConcept:'IfcProfileDef',sourceId:id,name:text(s.name)||id,family:text(s.family)||null,properties:copy(s)};
}

function nodeRecord(project,n){
  const id=requireId('node',n?.id);
  return{key:key('node',id),ifcClass:'IfcStructuralPointConnection',sourceId:id,name:text(n.name)||id,placement:{x:finite(n.x),y:finite(n.y),z:finite(n.z)},condition:supportForNode(project,id),properties:copy(n)};
}

function memberRecord(e,nodeSet){
  const id=requireId('element',e?.id),refs=nodeIdsForElement(e);
  if(refs.length<2)throw new Error(`IFC interop: elemento ${id} requer ao menos dois nós.`);
  for(const n of refs)if(!nodeSet.has(n))throw new Error(`IFC interop: elemento ${id} referencia nó inexistente ${n}.`);
  return{
    key:key('member',id),ifcClass:ifcClassForElement(e),sourceId:id,name:text(e.name)||id,elementType:text(e.type)||'unknown',
    nodeRefs:refs.map(n=>key('node',n)),materialRef:text(e.materialId)?key('material',e.materialId):null,sectionRef:text(e.sectionId)?key('section',e.sectionId):null,
    properties:copy(e)
  };
}

function connectionRecords(member){
  return member.nodeRefs.map((nodeRef,index)=>({
    key:key('rel',`${member.sourceId}:${index+1}`),ifcClass:'IfcRelConnectsStructuralMember',memberRef:member.key,nodeRef,
    source:{memberId:member.sourceId,nodeId:nodeRef.slice('node:'.length),position:index}
  }));
}

export function createIfcInteroperabilityModel(project={},options={}){
  const projectId=requireId('project',project.id),projectName=text(project.name)||projectId;
  const nodes=Array.isArray(project.nodes)?project.nodes:[],elements=Array.isArray(project.elements)?project.elements:[],materials=Array.isArray(project.materials)?project.materials:[],sections=Array.isArray(project.sections)?project.sections:[];
  const nodeSet=uniqueById(nodes,'node');uniqueById(elements,'element');uniqueById(materials,'material');uniqueById(sections,'section');
  const nodeRecords=nodes.map(n=>nodeRecord(project,n)),materialRecords=materials.map(materialRecord),sectionRecords=sections.map(sectionRecord),members=elements.map(e=>memberRecord(e,nodeSet));
  const materialKeys=new Set(materialRecords.map(x=>x.key)),sectionKeys=new Set(sectionRecords.map(x=>x.key));
  for(const m of members){if(m.materialRef&&!materialKeys.has(m.materialRef))throw new Error(`IFC interop: ${m.sourceId} referencia material inexistente ${m.materialRef}.`);if(m.sectionRef&&!sectionKeys.has(m.sectionRef))throw new Error(`IFC interop: ${m.sourceId} referencia seção inexistente ${m.sectionRef}.`)}
  const relationships=members.flatMap(connectionRecords);
  const model={
    contract:IFC_INTEROP_CONTRACT,version:IFC_INTEROP_VERSION,schema:IFC_SCHEMA,standard:IFC_STANDARD,
    exchange:{purpose:text(options.purpose)||'STRUCTURAL_ANALYSIS',serialization:'canonical-json',stepWriterReady:false,validationTarget:'buildingSMART IFC 4.3 validation service'},
    project:{key:key('project',projectId),ifcClass:'IfcProject',sourceId:projectId,name:projectName,units:text(project.units)||'kN-m-MPa',schemaVersion:project.schemaVersion??null,productVersion:project.meta?.productVersion??null},
    analysisModel:{key:key('analysis',projectId),ifcClass:'IfcStructuralAnalysisModel',name:text(options.analysisModelName)||`${projectName} — Structural Analysis`,predefinedType:'LOADING_3D'},
    nodes:nodeRecords,members,materials:materialRecords,sections:sectionRecords,relationships,
    detailing:options.detailing?copy(options.detailing):null,analysis:options.analysis?copy(options.analysis):null,
    provenance:{generator:'AstraStruct',interopVersion:IFC_INTEROP_VERSION,sourceProjectId:projectId,...copy(options.provenance||{})},
    limitations:[
      'canonical interoperability model; ainda não é serialização STEP .ifc',
      'IfcProfileDef é registrado como conceito de mapeamento; subtype/profile geometry será materializado pelo writer IFC',
      'validação schema/MVD externa é obrigatória antes de declarar arquivo IFC conforme'
    ]
  };
  validateIfcInteroperabilityModel(model);return model;
}

export function validateIfcInteroperabilityModel(model){
  if(model?.contract!==IFC_INTEROP_CONTRACT)throw new Error('IFC interop: contrato inválido.');
  if(model?.version!==IFC_INTEROP_VERSION)throw new Error('IFC interop: versão incompatível.');
  if(model?.schema!==IFC_SCHEMA)throw new Error('IFC interop: schema incompatível.');
  if(model?.project?.ifcClass!=='IfcProject')throw new Error('IFC interop: IfcProject ausente.');
  if(model?.analysisModel?.ifcClass!=='IfcStructuralAnalysisModel')throw new Error('IFC interop: IfcStructuralAnalysisModel ausente.');
  const nodeKeys=new Set(),memberKeys=new Set();
  for(const n of model.nodes||[]){if(n.ifcClass!=='IfcStructuralPointConnection')throw new Error(`IFC interop: nó ${n.sourceId} com classe inválida.`);if(nodeKeys.has(n.key))throw new Error(`IFC interop: chave de nó duplicada ${n.key}.`);nodeKeys.add(n.key);for(const a of ['x','y','z'])if(!Number.isFinite(Number(n.placement?.[a])))throw new Error(`IFC interop: coordenada ${a} inválida em ${n.sourceId}.`)}
  for(const m of model.members||[]){if(!['IfcStructuralCurveMember','IfcStructuralSurfaceMember'].includes(m.ifcClass))throw new Error(`IFC interop: membro ${m.sourceId} com classe inválida.`);if(memberKeys.has(m.key))throw new Error(`IFC interop: chave de membro duplicada ${m.key}.`);memberKeys.add(m.key);if((m.nodeRefs||[]).length<2)throw new Error(`IFC interop: membro ${m.sourceId} sem conectividade suficiente.`);for(const ref of m.nodeRefs)if(!nodeKeys.has(ref))throw new Error(`IFC interop: referência de nó inválida ${ref}.`)}
  for(const r of model.relationships||[]){if(r.ifcClass!=='IfcRelConnectsStructuralMember'||!memberKeys.has(r.memberRef)||!nodeKeys.has(r.nodeRef))throw new Error(`IFC interop: relação estrutural inválida ${r.key}.`)}
  return true;
}

export function renderIfcInteroperabilityJson(model,space=2){validateIfcInteroperabilityModel(model);return JSON.stringify(model,null,space)}
export function parseIfcInteroperabilityJson(json){const model=JSON.parse(String(json));validateIfcInteroperabilityModel(model);return model}

export function restoreStructuralCoreFromIfcModel(model){
  validateIfcInteroperabilityModel(model);
  return{
    id:model.project.sourceId,name:model.project.name,units:model.project.units,schemaVersion:model.project.schemaVersion,
    nodes:(model.nodes||[]).map(n=>({...copy(n.properties),id:n.sourceId,x:n.placement.x,y:n.placement.y,z:n.placement.z})),
    elements:(model.members||[]).map(m=>({...copy(m.properties),id:m.sourceId,type:m.elementType})),
    materials:(model.materials||[]).map(m=>({...copy(m.properties),id:m.sourceId})),
    sections:(model.sections||[]).map(s=>({...copy(s.properties),id:s.sourceId}))
  };
}

export function summarizeIfcInteroperability(model){
  validateIfcInteroperabilityModel(model);
  const curves=(model.members||[]).filter(x=>x.ifcClass==='IfcStructuralCurveMember').length,surfaces=(model.members||[]).filter(x=>x.ifcClass==='IfcStructuralSurfaceMember').length;
  return{schema:model.schema,projectId:model.project.sourceId,nodes:model.nodes.length,members:model.members.length,curves,surfaces,materials:model.materials.length,sections:model.sections.length,relationships:model.relationships.length,stepWriterReady:model.exchange.stepWriterReady};
}
