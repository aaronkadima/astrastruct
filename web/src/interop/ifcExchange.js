import {createIfcInteroperabilityModel} from './ifc.js';
import {createIfcIdentityMap,assignIfcGlobalIds,newIfcGuid,validateIfcGuid} from './ifcGuid.js';
import {createIfcMaterialMapping,summarizeIfcMaterialMapping} from './ifcMaterial.js';
import {createIfcStructuralLoadMapping,summarizeIfcStructuralLoadMapping} from './ifcLoads.js';
import {renderIfcStep,validateIfcStepReadiness,validateIfcStepEnvelope} from './ifcStep.js';

export const IFC_EXCHANGE_STATE_CONTRACT='ifc-exchange-state/v1';
export const IFC_EXCHANGE_VERSION='0.48.0-exp';

const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const n=v=>Number(v);
const positive=v=>Number.isFinite(n(v))&&n(v)>0;
const text=v=>String(v??'').trim();

export function explicitIfcProfileFromSection(section={}){
  if(section.ifcProfile)return copy(section.ifcProfile);
  const family=text(section.family).toLowerCase();
  if(family==='rect'&&positive(section.b)&&positive(section.h))return{ifcClass:'IfcRectangleProfileDef',profileName:text(section.name)||text(section.id)||null,xDim:n(section.b),yDim:n(section.h)};
  if(family==='circle'&&positive(section.d))return{ifcClass:'IfcCircleProfileDef',profileName:text(section.name)||text(section.id)||null,radius:n(section.d)/2};
  if(family==='i'&&positive(section.b)&&positive(section.h)&&positive(section.tw)&&positive(section.tf))return{ifcClass:'IfcIShapeProfileDef',profileName:text(section.name)||text(section.id)||null,overallWidth:n(section.b),overallDepth:n(section.h),webThickness:n(section.tw),flangeThickness:n(section.tf),...(Number.isFinite(n(section.r))&&n(section.r)>=0?{filletRadius:n(section.r)}:{})};
  return null;
}

export function enrichProjectSectionsForIfc(project={}){
  const out=copy(project)||{};
  out.sections=(Array.isArray(out.sections)?out.sections:[]).map(section=>{
    const profile=explicitIfcProfileFromSection(section);
    return profile?{...section,ifcProfile:profile}:section;
  });
  return out;
}

export function inspectIfcExchangeReadiness(project={}){
  const enrichedProject=enrichProjectSectionsForIfc(project),canonical=createIfcInteroperabilityModel(enrichedProject),mapping=createIfcMaterialMapping(canonical),summary=summarizeIfcMaterialMapping(mapping),loadMapping=createIfcStructuralLoadMapping(enrichedProject),loadSummary=summarizeIfcStructuralLoadMapping(loadMapping);
  return{enrichedProject,canonical,mapping,summary,loadMapping,loadSummary,materialReady:summary.pending===0,loadReady:loadMapping.ready,ready:summary.pending===0&&loadMapping.ready};
}

function existingGuid(value){return validateIfcGuid(value)?value:null}
function guid(guidFactory){const value=guidFactory();if(!validateIfcGuid(value))throw new Error('IFC exchange: guidFactory retornou GlobalId inválido.');return value}
function loadRootRecords(mapping){return[...(mapping?.cases||[]),...(mapping?.combinations||[]),...(mapping?.actions||[]),...(mapping?.relationships?.caseAssignments||[]),...(mapping?.relationships?.combinationFactors||[]),...(mapping?.relationships?.activityConnections||[])];}

export function normalizeIfcExchangeState(state={},projectId=null){
  const source=state&&typeof state==='object'?state:{};
  return{
    contract:IFC_EXCHANGE_STATE_CONTRACT,version:IFC_EXCHANGE_VERSION,projectId:text(projectId||source.projectId)||null,
    ids:source.ids&&typeof source.ids==='object'?{...source.ids}:{},
    declarationGlobalId:existingGuid(source.declarationGlobalId),groupGlobalId:existingGuid(source.groupGlobalId),
    materialAssociationGlobalIds:source.materialAssociationGlobalIds&&typeof source.materialAssociationGlobalIds==='object'?{...source.materialAssociationGlobalIds}:{},
    loadGlobalIds:source.loadGlobalIds&&typeof source.loadGlobalIds==='object'?{...source.loadGlobalIds}:{},
    creationDate:Number.isInteger(Number(source.creationDate))&&Number(source.creationDate)>=0?Number(source.creationDate):null
  };
}

export function prepareIfcExchange(project={},options={}){
  const inspection=inspectIfcExchangeReadiness(project);
  if(inspection.summary.pending){const pending=inspection.mapping.entries.filter(x=>x.status==='PENDING').map(x=>`${x.memberId}:${x.reason}`).join(', ');throw new Error(`IFC exchange: elementos pendentes impedem exportação: ${pending}.`)}
  if(!inspection.loadMapping.ready){const blocking=(inspection.loadMapping.issues||[]).map(x=>x.code).join(', ');throw new Error(`IFC exchange: cargas/casos pendentes impedem exportação: ${blocking}.`)}
  const guidFactory=typeof options.guidFactory==='function'?options.guidFactory:newIfcGuid,state=normalizeIfcExchangeState(options.state,inspection.canonical.project.sourceId);
  const identityMap=createIfcIdentityMap(inspection.canonical,{guidFactory:key=>existingGuid(state.ids[key])||guid(guidFactory)});
  const identified=assignIfcGlobalIds(inspection.canonical,{identityMap});
  const materialAssociationGlobalIds={...state.materialAssociationGlobalIds};
  for(const entry of inspection.mapping.entries.filter(x=>x.status==='READY'))if(!existingGuid(materialAssociationGlobalIds[entry.memberId]))materialAssociationGlobalIds[entry.memberId]=guid(guidFactory);
  const loadGlobalIds={...state.loadGlobalIds};
  for(const record of loadRootRecords(inspection.loadMapping))if(!existingGuid(loadGlobalIds[record.key]))loadGlobalIds[record.key]=guid(guidFactory);
  const declarationGlobalId=state.declarationGlobalId||guid(guidFactory),groupGlobalId=state.groupGlobalId||guid(guidFactory);
  const timestamp=text(options.timestamp)||new Date().toISOString();
  const parsedMs=Date.parse(timestamp);if(!Number.isFinite(parsedMs))throw new Error('IFC exchange: timestamp ISO inválido.');
  const creationDate=state.creationDate??Math.floor(parsedMs/1000);
  const ownerMetadata={...(options.ownerMetadata||{}),creationDate};
  const writerOptions={declarationGlobalId,groupGlobalId,materialAssociationGlobalIds,loadMapping:inspection.loadMapping,loadGlobalIds,ownerMetadata,timestamp,fileName:text(options.fileName)||`${inspection.canonical.project.sourceId}.ifc`};
  const readiness=validateIfcStepReadiness(identified,writerOptions),step=renderIfcStep(identified,writerOptions),envelope=validateIfcStepEnvelope(step);
  const nextState={contract:IFC_EXCHANGE_STATE_CONTRACT,version:IFC_EXCHANGE_VERSION,projectId:inspection.canonical.project.sourceId,ids:{...identityMap.ids},declarationGlobalId,groupGlobalId,materialAssociationGlobalIds,loadGlobalIds,creationDate};
  return{...inspection,canonical:identified,state:nextState,writerOptions,readiness,step,envelope};
}

export function safeIfcFilename(project={}){
  const base=(text(project.name)||text(project.id)||'astrastruct').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'astrastruct';
  return`${base}.ifc`;
}
