import {validateIfcInteroperabilityModel,IFC_SCHEMA} from './ifc.js';
import {validateIfcGlobalIds,validateIfcGuid} from './ifcGuid.js';
import {validateIfcProjectContext} from './ifcContext.js';

export const IFC_STEP_WRITER_CONTRACT='ifc-step-writer/v1';
export const IFC_STEP_WRITER_VERSION='0.45.0-exp';

const finite=(v,name='number')=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC STEP: ${name} deve ser finito.`);return n;};
const num=(v,name)=>{const n=finite(v,name);if(Number.isInteger(n))return `${n}.`;let s=String(n);if(!/[.eE]/.test(s))s+='.';return s.replace('e','E');};
const enumValue=v=>`.${String(v).trim().toUpperCase()}.`;
const ref=id=>`#${id}`;
const refs=ids=>`(${ids.map(ref).join(',')})`;

function spfString(value){
  const source=String(value??'');let out='';
  for(const ch of source){const cp=ch.codePointAt(0);if(cp>=32&&cp<=126&&ch!=="'"&&ch!=='\\')out+=ch;else if(ch==="'")out+="''";else{const units=[];for(let i=0;i<ch.length;i++)units.push(ch.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0'));out+=`\\X2\\${units.join('')}\\X0\\`;}}
  return `'${out}'`;
}

function normalize(v,name){const a=v.map((x,i)=>finite(x,`${name}[${i}]`));const m=Math.hypot(...a);if(m<1e-12)throw new Error(`IFC STEP: ${name} não pode ser nulo.`);return a.map(x=>x/m);}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0)}
function subtract(a,b,scale=1){return a.map((x,i)=>x-scale*b[i])}
function memberAxis(member,nodeByKey){
  const ids=member.nodeRefs||[];const a=nodeByKey.get(ids[0]),b=nodeByKey.get(ids[ids.length-1]);
  if(!a||!b)throw new Error(`IFC STEP: nós ausentes no membro ${member.sourceId}.`);
  const tangent=normalize([b.placement.x-a.placement.x,b.placement.y-a.placement.y,b.placement.z-a.placement.z],`tangente ${member.sourceId}`);
  const candidate=Math.abs(dot(tangent,[0,0,1]))<0.95?[0,0,1]:[1,0,0];
  return normalize(subtract(candidate,tangent,dot(candidate,tangent)),`Axis ${member.sourceId}`);
}

function boundarySelect(value,kind){
  if(value===true)return'IFCBOOLEAN(.T.)';
  if(value===false)return'IFCBOOLEAN(.F.)';
  const n=num(value,`${kind} stiffness`);
  return kind==='translation'?`IFCLINEARSTIFFNESSMEASURE(${n})`:`IFCROTATIONALSTIFFNESSMEASURE(${n})`;
}

function createEmitter(){let next=1;const lines=[],byKey=new Map();return{
  add(entity,key=null){const id=next++;lines.push(`#${id}=${entity};`);if(key){if(byKey.has(key))throw new Error(`IFC STEP: chave duplicada no writer ${key}.`);byKey.set(key,id)}return id;},
  id(key){const id=byKey.get(key);if(!id)throw new Error(`IFC STEP: referência não emitida ${key}.`);return id;},lines,byKey
}}

function emitUnitAssignment(emitter,assignment){
  const pendingDerived=[];
  for(const unit of assignment.units){
    if(unit.ifcClass==='IfcSIUnit'){
      const prefix=unit.prefix?enumValue(unit.prefix):'$';
      emitter.add(`IFCSIUNIT(*,${enumValue(unit.unitType)},${prefix},${enumValue(unit.name)})`,unit.key);
    }else pendingDerived.push(unit);
  }
  for(const unit of pendingDerived){
    const elementIds=unit.elements.map((element,i)=>emitter.add(`IFCDERIVEDUNITELEMENT(${ref(emitter.id(element.unitRef))},${Number(element.exponent)})`,`${unit.key}:element:${i}`));
    emitter.add(`IFCDERIVEDUNIT(${refs(elementIds)},${enumValue(unit.unitType)},$,$)`,unit.key);
  }
  return emitter.add(`IFCUNITASSIGNMENT(${refs(assignment.units.map(unit=>emitter.id(unit.key)))})`,assignment.key);
}

function emitContext(emitter,context){
  const main=context.representationContexts[0],wcs=main.worldCoordinateSystem;
  const origin=emitter.add(`IFCCARTESIANPOINT((${wcs.location.map((v,i)=>num(v,`WCS ${i}`)).join(',')}))`,'step:wcs:origin');
  const axis=emitter.add(`IFCDIRECTION((${wcs.axis.map((v,i)=>num(v,`WCS axis ${i}`)).join(',')}))`,'step:wcs:axis');
  const xdir=emitter.add(`IFCDIRECTION((${wcs.refDirection.map((v,i)=>num(v,`WCS ref ${i}`)).join(',')}))`,'step:wcs:ref');
  const placement=emitter.add(`IFCAXIS2PLACEMENT3D(${ref(origin)},${ref(axis)},${ref(xdir)})`,'step:wcs:placement');
  const north=main.trueNorth?emitter.add(`IFCDIRECTION((${main.trueNorth.directionRatios.map((v,i)=>num(v,`TrueNorth ${i}`)).join(',')}))`,'step:trueNorth'):null;
  return emitter.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,${spfString(main.contextType)},3,${num(main.precision,'precision')},${ref(placement)},${north?ref(north):'$'})`,main.key);
}

function emitSharedPlacement(emitter){
  const p=emitter.add('IFCCARTESIANPOINT((0.,0.,0.))','step:analysis:origin');
  const a=emitter.add(`IFCAXIS2PLACEMENT3D(${ref(p)},$,$)`,'step:analysis:axis');
  return emitter.add(`IFCLOCALPLACEMENT($,${ref(a)})`,'step:analysis:placement');
}

function emitBoundary(emitter,node){
  if(!node.condition)return null;const c=node.condition;
  return emitter.add(`IFCBOUNDARYNODECONDITION(${spfString(c.name||`Boundary ${node.sourceId}`)},${boundarySelect(c.translationalStiffnessX,'translation')},${boundarySelect(c.translationalStiffnessY,'translation')},${boundarySelect(c.translationalStiffnessZ,'translation')},${boundarySelect(c.rotationalStiffnessX,'rotation')},${boundarySelect(c.rotationalStiffnessY,'rotation')},${boundarySelect(c.rotationalStiffnessZ,'rotation')})`,`step:boundary:${node.sourceId}`);
}

export function validateIfcStepReadiness(model,{declarationGlobalId,groupGlobalId}={}){
  validateIfcInteroperabilityModel(model);validateIfcProjectContext(model.context);validateIfcGlobalIds(model);
  if(model.schema!==IFC_SCHEMA)throw new Error(`IFC STEP: schema ${model.schema} não suportado.`);
  const unsupported=(model.members||[]).filter(x=>x.ifcClass!=='IfcStructuralCurveMember');
  if(unsupported.length)throw new Error(`IFC STEP: writer v0.45 suporta apenas membros de curva; não suportados: ${unsupported.map(x=>x.sourceId).join(', ')}.`);
  if(!validateIfcGuid(declarationGlobalId))throw new Error('IFC STEP: declarationGlobalId persistente é obrigatório.');
  if(!validateIfcGuid(groupGlobalId))throw new Error('IFC STEP: groupGlobalId persistente é obrigatório.');
  const all=new Set([declarationGlobalId,groupGlobalId]);for(const record of [model.project,model.analysisModel,...model.nodes,...model.members,...model.relationships]){if(all.has(record.globalId))throw new Error(`IFC STEP: GlobalId duplicado ${record.globalId}.`);all.add(record.globalId)}
  return{contract:IFC_STEP_WRITER_CONTRACT,version:IFC_STEP_WRITER_VERSION,schema:model.schema,curveMembers:model.members.length,nodes:model.nodes.length,relationships:model.relationships.length,warnings:['material/profile associations ainda não serializadas neste incremento curve-only','validação externa buildingSMART/IfcOpenShell continua obrigatória antes de promover o writer para produção']};
}

export function renderIfcStep(model,options={}){
  const readiness=validateIfcStepReadiness(model,options),emitter=createEmitter();
  const unitsId=emitUnitAssignment(emitter,model.context.units),contextId=emitContext(emitter,model.context),sharedPlacementId=emitSharedPlacement(emitter);
  const projectId=emitter.add(`IFCPROJECT(${spfString(model.project.globalId)},$,${spfString(model.project.name)},$,$,$,$,(${ref(contextId)}),${ref(unitsId)})`,model.project.key);
  const analysisId=emitter.add(`IFCSTRUCTURALANALYSISMODEL(${spfString(model.analysisModel.globalId)},$,${spfString(model.analysisModel.name)},$,$,${enumValue(model.analysisModel.predefinedType||'LOADING_3D')},$,$,$,${ref(sharedPlacementId)})`,model.analysisModel.key);
  emitter.add(`IFCRELDECLARES(${spfString(options.declarationGlobalId)},$,${spfString('AstraStruct structural analysis declaration')},$,${ref(projectId)},(${ref(analysisId)}))`,'step:rel:declares');

  const nodeByKey=new Map(model.nodes.map(x=>[x.key,x]));
  for(const node of model.nodes){
    const point=emitter.add(`IFCCARTESIANPOINT((${[node.placement.x,node.placement.y,node.placement.z].map((v,i)=>num(v,`${node.sourceId}[${i}]`)).join(',')}))`,`step:point:${node.sourceId}`);
    const vertex=emitter.add(`IFCVERTEXPOINT(${ref(point)})`,`step:vertex:${node.sourceId}`);
    const topology=emitter.add(`IFCTOPOLOGYREPRESENTATION(${ref(contextId)},${spfString('Reference')},${spfString('Vertex')},(${ref(vertex)}))`,`step:topology:${node.sourceId}`);
    const shape=emitter.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${ref(topology)}))`,`step:shape:${node.sourceId}`);
    const boundary=emitBoundary(emitter,node);
    emitter.add(`IFCSTRUCTURALPOINTCONNECTION(${spfString(node.globalId)},$,${spfString(node.name)},$,$,${ref(sharedPlacementId)},${ref(shape)},${boundary?ref(boundary):'$'},$)`,node.key);
  }

  for(const member of model.members){
    const ends=member.nodeRefs;if(ends.length!==2)throw new Error(`IFC STEP: membro de curva ${member.sourceId} deve possuir exatamente dois nós neste writer.`);
    const edge=emitter.add(`IFCEDGE(${ref(emitter.id(`step:vertex:${ends[0].slice(5)}`))},${ref(emitter.id(`step:vertex:${ends[1].slice(5)}`))})`,`step:edge:${member.sourceId}`);
    const topology=emitter.add(`IFCTOPOLOGYREPRESENTATION(${ref(contextId)},${spfString('Reference')},${spfString('Edge')},(${ref(edge)}))`,`step:topology:member:${member.sourceId}`);
    const shape=emitter.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${ref(topology)}))`,`step:shape:member:${member.sourceId}`);
    const axisVector=memberAxis(member,nodeByKey),axis=emitter.add(`IFCDIRECTION((${axisVector.map((v,i)=>num(v,`${member.sourceId} Axis ${i}`)).join(',')}))`,`step:axis:${member.sourceId}`);
    emitter.add(`IFCSTRUCTURALCURVEMEMBER(${spfString(member.globalId)},$,${spfString(member.name)},$,$,${ref(sharedPlacementId)},${ref(shape)},.RIGID_JOINED_MEMBER.,${ref(axis)})`,member.key);
  }

  for(const relation of model.relationships){emitter.add(`IFCRELCONNECTSSTRUCTURALMEMBER(${spfString(relation.globalId)},$,$,$,${ref(emitter.id(relation.memberRef))},${ref(emitter.id(relation.nodeRef))},$,$,$,$)`,relation.key)}
  const grouped=[...model.nodes.map(x=>emitter.id(x.key)),...model.members.map(x=>emitter.id(x.key))];
  emitter.add(`IFCRELASSIGNSTOGROUP(${spfString(options.groupGlobalId)},$,$,$,${refs(grouped)},$,${ref(analysisId)})`,'step:rel:group');

  const timestamp=String(options.timestamp||new Date().toISOString().replace(/\.\d{3}Z$/,'Z'));
  const fileName=String(options.fileName||`${model.project.sourceId||'astrastruct'}.ifc`);
  const header=[
    'ISO-10303-21;','HEADER;',"FILE_DESCRIPTION(('AstraStruct structural analysis exchange'),'2;1');",
    `FILE_NAME(${spfString(fileName)},${spfString(timestamp)},(${spfString(options.author||'')}),(${spfString(options.organization||'')}),${spfString('AstraStruct')},${spfString(`AstraStruct ${IFC_STEP_WRITER_VERSION}`)},'');`,
    `FILE_SCHEMA((${spfString(IFC_SCHEMA)}));`,'ENDSEC;','DATA;'
  ];
  return [...header,...emitter.lines,'ENDSEC;','END-ISO-10303-21;',''].join('\n');
}

export function validateIfcStepEnvelope(step){
  const text=String(step||'');
  if(!text.startsWith('ISO-10303-21;\nHEADER;'))throw new Error('IFC STEP: cabeçalho ISO-10303-21 ausente.');
  if(!text.includes(`FILE_SCHEMA(('${IFC_SCHEMA}'));`))throw new Error('IFC STEP: FILE_SCHEMA incompatível.');
  if(!text.endsWith('END-ISO-10303-21;\n'))throw new Error('IFC STEP: terminador ausente.');
  const ids=[...text.matchAll(/^#(\d+)=/gm)].map(x=>Number(x[1]));if(!ids.length)throw new Error('IFC STEP: DATA vazio.');
  const defined=new Set(ids);for(const match of text.matchAll(/#(\d+)/g)){const id=Number(match[1]);if(!defined.has(id))throw new Error(`IFC STEP: referência #${id} não definida.`)}
  return{entities:ids.length,maxEntityId:Math.max(...ids),schema:IFC_SCHEMA,hasProject:/IFCPROJECT\(/.test(text),hasAnalysisModel:/IFCSTRUCTURALANALYSISMODEL\(/.test(text),hasPointConnections:/IFCSTRUCTURALPOINTCONNECTION\(/.test(text),hasCurveMembers:/IFCSTRUCTURALCURVEMEMBER\(/.test(text)};
}
