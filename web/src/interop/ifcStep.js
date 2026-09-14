import {validateIfcInteroperabilityModel,IFC_SCHEMA} from './ifc.js';
import {validateIfcGlobalIds,validateIfcGuid} from './ifcGuid.js';
import {validateIfcProjectContext} from './ifcContext.js';
import {validateIfcStepMaterialReadiness,emitIfcStepMaterials} from './ifcStepMaterial.js';
import {validateIfcStepLoadReadiness,emitIfcStepLoadGroups,emitIfcStepLoadActions} from './ifcStepLoads.js';
import {validateIfcOwnerMetadata,emitIfcStepOwner} from './ifcStepOwner.js';

export const IFC_STEP_WRITER_CONTRACT='ifc-step-writer/v1';
export const IFC_STEP_WRITER_VERSION='0.48.0-exp';

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
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function magnitude(a){return Math.hypot(...a)}
function pointOf(node){return[node.placement.x,node.placement.y,node.placement.z].map(Number)}

function memberAxis(member,nodeByKey){
  const ids=member.nodeRefs||[];const a=nodeByKey.get(ids[0]),b=nodeByKey.get(ids[ids.length-1]);
  if(!a||!b)throw new Error(`IFC STEP: nós ausentes no membro ${member.sourceId}.`);
  const tangent=normalize(subtract(pointOf(b),pointOf(a)),`tangente ${member.sourceId}`);
  const candidate=Math.abs(dot(tangent,[0,0,1]))<0.95?[0,0,1]:[1,0,0];
  return normalize(subtract(candidate,tangent,dot(candidate,tangent)),`Axis ${member.sourceId}`);
}

function surfaceGeometry(member,nodeByKey,precision=1e-6){
  const nodes=(member.nodeRefs||[]).map(k=>nodeByKey.get(k));if(nodes.some(x=>!x))throw new Error(`IFC STEP: nós ausentes na superfície ${member.sourceId}.`);
  if(nodes.length<3)throw new Error(`IFC STEP: superfície ${member.sourceId} requer ao menos três nós.`);
  const points=nodes.map(pointOf),p0=points[0];let v1=null,normalRaw=null;
  for(let i=1;i<points.length&&!normalRaw;i++){
    const candidate1=subtract(points[i],p0);if(magnitude(candidate1)<=precision)continue;
    for(let j=i+1;j<points.length;j++){
      const candidate2=subtract(points[j],p0),c=cross(candidate1,candidate2);
      if(magnitude(c)>precision){v1=candidate1;normalRaw=c;break;}
    }
  }
  if(!normalRaw)throw new Error(`IFC STEP: superfície ${member.sourceId} degenerada/colinear.`);
  const normal=normalize(normalRaw,`normal ${member.sourceId}`),refDirection=normalize(v1,`refDirection ${member.sourceId}`),tol=Math.max(precision,1e-9);
  for(let i=0;i<points.length;i++){const distance=Math.abs(dot(subtract(points[i],p0),normal));if(distance>tol)throw new Error(`IFC STEP: superfície ${member.sourceId} não planar; nó ${member.nodeRefs[i]} distancia ${distance}.`)}
  return{nodes,points,normal,refDirection};
}

function curveType(member){const type=String(member.elementType||'').toLowerCase();return type.includes('truss')?'PIN_JOINED_MEMBER':'RIGID_JOINED_MEMBER'}
function surfaceType(member){const type=String(member.elementType||'').toLowerCase();if(type.includes('membrane'))return'MEMBRANE_ELEMENT';if(type.includes('plate')||type.includes('slab'))return'BENDING_ELEMENT';return'SHELL'}
function surfaceThickness(member,sectionByKey){
  const section=member.sectionRef?sectionByKey.get(member.sectionRef):null;const raw=member.properties?.thickness??member.properties?.t??section?.properties?.thickness??section?.properties?.t??null;
  if(raw==null||raw==='')return null;const value=finite(raw,`thickness ${member.sourceId}`);if(!(value>0))throw new Error(`IFC STEP: espessura da superfície ${member.sourceId} deve ser positiva.`);return value;
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

function validateMemberGeometry(model){
  const nodeByKey=new Map(model.nodes.map(x=>[x.key,x])),precision=model.context.representationContexts[0].precision;
  for(const member of model.members){
    if(member.ifcClass==='IfcStructuralCurveMember'){
      if(member.nodeRefs.length!==2)throw new Error(`IFC STEP: membro de curva ${member.sourceId} deve possuir exatamente dois nós neste writer.`);memberAxis(member,nodeByKey);
    }else if(member.ifcClass==='IfcStructuralSurfaceMember')surfaceGeometry(member,nodeByKey,precision);
    else throw new Error(`IFC STEP: classe de membro não suportada ${member.ifcClass} (${member.sourceId}).`);
  }
}

export function validateIfcStepReadiness(model,options={}){
  const {declarationGlobalId,groupGlobalId}=options;
  validateIfcInteroperabilityModel(model);validateIfcProjectContext(model.context);validateIfcGlobalIds(model);
  if(model.schema!==IFC_SCHEMA)throw new Error(`IFC STEP: schema ${model.schema} não suportado.`);validateMemberGeometry(model);
  if(!validateIfcGuid(declarationGlobalId))throw new Error('IFC STEP: declarationGlobalId persistente é obrigatório.');
  if(!validateIfcGuid(groupGlobalId))throw new Error('IFC STEP: groupGlobalId persistente é obrigatório.');
  const owner=validateIfcOwnerMetadata(options.ownerMetadata||{},options.timestamp),materialReady=validateIfcStepMaterialReadiness(model,options),loadReady=options.loadMapping?validateIfcStepLoadReadiness(options.loadMapping,{loadGlobalIds:options.loadGlobalIds||{}}):null;
  const all=new Set([declarationGlobalId,groupGlobalId]);
  for(const record of [model.project,model.analysisModel,...model.nodes,...model.members,...model.relationships]){if(all.has(record.globalId))throw new Error(`IFC STEP: GlobalId duplicado ${record.globalId}.`);all.add(record.globalId)}
  for(const guid of materialReady.associationGlobalIds){if(all.has(guid))throw new Error(`IFC STEP: GlobalId duplicado ${guid}.`);all.add(guid)}
  for(const guid of loadReady?.globalIds||[]){if(all.has(guid))throw new Error(`IFC STEP: GlobalId duplicado ${guid}.`);all.add(guid)}
  const curves=model.members.filter(x=>x.ifcClass==='IfcStructuralCurveMember').length,surfaces=model.members.filter(x=>x.ifcClass==='IfcStructuralSurfaceMember').length;
  const loadSummary=loadReady?{loadCases:loadReady.loadCases,loadCombinations:loadReady.loadCombinations,actions:loadReady.actions,rootCount:loadReady.rootCount,topLevelKeys:[...loadReady.topLevelKeys]}:null;
  return{contract:IFC_STEP_WRITER_CONTRACT,version:IFC_STEP_WRITER_VERSION,schema:model.schema,curveMembers:curves,surfaceMembers:surfaces,nodes:model.nodes.length,relationships:model.relationships.length,materialSummary:materialReady.summary,loadSummary,owner:{organization:owner.organization.name,application:owner.application.fullName,applicationVersion:owner.application.version,creationDate:owner.creationDate},warnings:['conectividade de superfícies permanece baseada nas point connections canônicas até o gate de conexões de borda/face','validação externa buildingSMART/IfcOpenShell continua obrigatória antes de promover o writer para produção']};
}

export function renderIfcStep(model,options={}){
  const timestamp=String(options.timestamp||new Date().toISOString().replace(/\.\d{3}Z$/,'Z')),resolvedOptions={...options,timestamp};
  validateIfcStepReadiness(model,resolvedOptions);const emitter=createEmitter(),owner=emitIfcStepOwner(emitter,options.ownerMetadata||{},timestamp),ownerRef=ref(owner.ownerHistoryId);
  const unitsId=emitUnitAssignment(emitter,model.context.units),contextId=emitContext(emitter,model.context),sharedPlacementId=emitSharedPlacement(emitter);
  const projectId=emitter.add(`IFCPROJECT(${spfString(model.project.globalId)},${ownerRef},${spfString(model.project.name)},$,$,$,$,(${ref(contextId)}),${ref(unitsId)})`,model.project.key);
  const loadGroups=resolvedOptions.loadMapping?emitIfcStepLoadGroups(emitter,resolvedOptions.loadMapping,{loadGlobalIds:resolvedOptions.loadGlobalIds||{},ownerHistoryId:owner.ownerHistoryId}):null;
  const loadedBy=loadGroups?.topLevelEntityIds?.length?refs(loadGroups.topLevelEntityIds):'$';
  const analysisId=emitter.add(`IFCSTRUCTURALANALYSISMODEL(${spfString(model.analysisModel.globalId)},${ownerRef},${spfString(model.analysisModel.name)},$,$,${enumValue(model.analysisModel.predefinedType||'LOADING_3D')},$,${loadedBy},$,${ref(sharedPlacementId)})`,model.analysisModel.key);
  emitter.add(`IFCRELDECLARES(${spfString(options.declarationGlobalId)},${ownerRef},${spfString('AstraStruct structural analysis declaration')},$,${ref(projectId)},(${ref(analysisId)}))`,'step:rel:declares');

  const nodeByKey=new Map(model.nodes.map(x=>[x.key,x])),sectionByKey=new Map(model.sections.map(x=>[x.key,x])),precision=model.context.representationContexts[0].precision;
  for(const node of model.nodes){
    const point=emitter.add(`IFCCARTESIANPOINT((${[node.placement.x,node.placement.y,node.placement.z].map((v,i)=>num(v,`${node.sourceId}[${i}]`)).join(',')}))`,`step:point:${node.sourceId}`);
    const vertex=emitter.add(`IFCVERTEXPOINT(${ref(point)})`,`step:vertex:${node.sourceId}`);
    const topology=emitter.add(`IFCTOPOLOGYREPRESENTATION(${ref(contextId)},${spfString('Reference')},${spfString('Vertex')},(${ref(vertex)}))`,`step:topology:${node.sourceId}`);
    const shape=emitter.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${ref(topology)}))`,`step:shape:${node.sourceId}`);
    const boundary=emitBoundary(emitter,node);
    emitter.add(`IFCSTRUCTURALPOINTCONNECTION(${spfString(node.globalId)},${ownerRef},${spfString(node.name)},$,$,${ref(sharedPlacementId)},${ref(shape)},${boundary?ref(boundary):'$'},$)`,node.key);
  }

  for(const member of model.members){
    if(member.ifcClass==='IfcStructuralCurveMember'){
      const ends=member.nodeRefs;
      const edge=emitter.add(`IFCEDGE(${ref(emitter.id(`step:vertex:${ends[0].slice(5)}`))},${ref(emitter.id(`step:vertex:${ends[1].slice(5)}`))})`,`step:edge:${member.sourceId}`);
      const topology=emitter.add(`IFCTOPOLOGYREPRESENTATION(${ref(contextId)},${spfString('Reference')},${spfString('Edge')},(${ref(edge)}))`,`step:topology:member:${member.sourceId}`);
      const shape=emitter.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${ref(topology)}))`,`step:shape:member:${member.sourceId}`);
      const axisVector=memberAxis(member,nodeByKey),axis=emitter.add(`IFCDIRECTION((${axisVector.map((v,i)=>num(v,`${member.sourceId} Axis ${i}`)).join(',')}))`,`step:axis:${member.sourceId}`);
      emitter.add(`IFCSTRUCTURALCURVEMEMBER(${spfString(member.globalId)},${ownerRef},${spfString(member.name)},$,$,${ref(sharedPlacementId)},${ref(shape)},${enumValue(curveType(member))},${ref(axis)})`,member.key);
    }else{
      const geometry=surfaceGeometry(member,nodeByKey,precision),pointIds=member.nodeRefs.map(k=>emitter.id(`step:point:${k.slice(5)}`));
      const loop=emitter.add(`IFCPOLYLOOP(${refs(pointIds)})`,`step:polyloop:${member.sourceId}`);
      const bound=emitter.add(`IFCFACEOUTERBOUND(${ref(loop)},.T.)`,`step:face-bound:${member.sourceId}`);
      const origin=pointIds[0],normal=emitter.add(`IFCDIRECTION((${geometry.normal.map((v,i)=>num(v,`${member.sourceId} normal ${i}`)).join(',')}))`,`step:surface-normal:${member.sourceId}`);
      const xdir=emitter.add(`IFCDIRECTION((${geometry.refDirection.map((v,i)=>num(v,`${member.sourceId} refDirection ${i}`)).join(',')}))`,`step:surface-ref:${member.sourceId}`);
      const planePlacement=emitter.add(`IFCAXIS2PLACEMENT3D(${ref(origin)},${ref(normal)},${ref(xdir)})`,`step:surface-placement:${member.sourceId}`);
      const plane=emitter.add(`IFCPLANE(${ref(planePlacement)})`,`step:plane:${member.sourceId}`);
      const face=emitter.add(`IFCFACESURFACE((${ref(bound)}),${ref(plane)},.T.)`,`step:face:${member.sourceId}`);
      const topology=emitter.add(`IFCTOPOLOGYREPRESENTATION(${ref(contextId)},${spfString('Reference')},${spfString('Face')},(${ref(face)}))`,`step:topology:member:${member.sourceId}`);
      const shape=emitter.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${ref(topology)}))`,`step:shape:member:${member.sourceId}`),thickness=surfaceThickness(member,sectionByKey);
      emitter.add(`IFCSTRUCTURALSURFACEMEMBER(${spfString(member.globalId)},${ownerRef},${spfString(member.name)},$,$,${ref(sharedPlacementId)},${ref(shape)},${enumValue(surfaceType(member))},${thickness==null?'$':num(thickness,`thickness ${member.sourceId}`)})`,member.key);
    }
  }

  emitIfcStepMaterials(emitter,model,{...resolvedOptions,ownerHistoryId:owner.ownerHistoryId});
  for(const relation of model.relationships){emitter.add(`IFCRELCONNECTSSTRUCTURALMEMBER(${spfString(relation.globalId)},${ownerRef},$,$,${ref(emitter.id(relation.memberRef))},${ref(emitter.id(relation.nodeRef))},$,$,$,$)`,relation.key)}
  if(resolvedOptions.loadMapping)emitIfcStepLoadActions(emitter,resolvedOptions.loadMapping,{loadGlobalIds:resolvedOptions.loadGlobalIds||{},ownerHistoryId:owner.ownerHistoryId});
  const grouped=[...model.nodes.map(x=>emitter.id(x.key)),...model.members.map(x=>emitter.id(x.key))];
  emitter.add(`IFCRELASSIGNSTOGROUP(${spfString(options.groupGlobalId)},${ownerRef},$,$,${refs(grouped)},$,${ref(analysisId)})`,'step:rel:group');

  const personName=[owner.metadata.person.givenName,owner.metadata.person.familyName].filter(Boolean).join(' ')||owner.metadata.person.identification||'';
  const fileName=String(options.fileName||`${model.project.sourceId||'astrastruct'}.ifc`),headerAuthor=options.author??personName,headerOrganization=options.organization??owner.metadata.organization.name;
  const header=[
    'ISO-10303-21;','HEADER;',"FILE_DESCRIPTION(('AstraStruct structural analysis exchange'),'2;1');",
    `FILE_NAME(${spfString(fileName)},${spfString(timestamp)},(${spfString(headerAuthor)}),(${spfString(headerOrganization)}),${spfString('AstraStruct')},${spfString(`AstraStruct ${IFC_STEP_WRITER_VERSION}`)},'');`,
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
  return{entities:ids.length,maxEntityId:Math.max(...ids),schema:IFC_SCHEMA,hasProject:/IFCPROJECT\(/.test(text),hasAnalysisModel:/IFCSTRUCTURALANALYSISMODEL\(/.test(text),hasPointConnections:/IFCSTRUCTURALPOINTCONNECTION\(/.test(text),hasCurveMembers:/IFCSTRUCTURALCURVEMEMBER\(/.test(text),hasSurfaceMembers:/IFCSTRUCTURALSURFACEMEMBER\(/.test(text),hasFaceSurface:/IFCFACESURFACE\(/.test(text),hasMaterial:/IFCMATERIAL\(/.test(text),hasMaterialAssociations:/IFCRELASSOCIATESMATERIAL\(/.test(text),hasProfileSetUsage:/IFCMATERIALPROFILESETUSAGE\(/.test(text),hasOwnerHistory:/IFCOWNERHISTORY\(/.test(text),hasApplication:/IFCAPPLICATION\(/.test(text),hasLoadCases:/IFCSTRUCTURALLOADCASE\(/.test(text),hasLoadGroups:/IFCSTRUCTURALLOADGROUP\(/.test(text),hasPointActions:/IFCSTRUCTURALPOINTACTION\(/.test(text),hasLinearActions:/IFCSTRUCTURALLINEARACTION\(/.test(text),hasStructuralActivityConnections:/IFCRELCONNECTSSTRUCTURALACTIVITY\(/.test(text),hasFactoredLoadGroups:/IFCRELASSIGNSTOGROUPBYFACTOR\(/.test(text)};
}
