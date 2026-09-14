import{DIGITAL_ENGINEERING_RECORD_CONTRACT,DIGITAL_ENGINEERING_RECORD_VERSION}from'./contracts.js';
import{fingerprint}from'./stableHash.js';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function fingerprintSource(project){
  const p=clone(project||{});
  delete p.results;delete p.automationStudy;
  if(p.meta&&typeof p.meta==='object'){delete p.meta.updatedAt;delete p.meta.lastOpenedAt;}
  return p;
}
export function projectFingerprint(project){return fingerprint(fingerprintSource(project));}
export function summarizeProjectForDigitalRecord(project){
  return{id:project?.id??null,name:project?.name??null,schemaVersion:project?.schemaVersion??project?.meta?.schemaVersion??null,productVersion:project?.meta?.productVersion??null,analysisType:project?.settings?.analysisType||'linear',analysisScenarioId:project?.settings?.analysisScenarioId??null,nodes:Array.isArray(project?.nodes)?project.nodes.length:0,elements:Array.isArray(project?.elements)?project.elements.length:0,loadCases:Array.isArray(project?.loadCases)?project.loadCases.length:0,combinations:Array.isArray(project?.loadCombinations)?project.loadCombinations.length:0,fingerprint:projectFingerprint(project)};
}
export function createDigitalEngineeringRecord(project,{executedAt=null,study=null,steps=[],advisor=null,status='completed'}={}){
  if(!project||typeof project!=='object')throw new Error('DigitalEngineering: projeto é obrigatório.');
  const time=executedAt||new Date().toISOString(),projectSummary=summarizeProjectForDigitalRecord(project),execution={status,study:{contract:study?.contract??null,version:study?.version??null,name:study?.name??null,preset:study?.preset??null,scenarioId:study?.scenarioId??null,stopOnError:study?.stopOnError!==false},steps:clone(steps).map(s=>({id:s.id,type:s.type,status:s.status,startedAt:s.startedAt??null,finishedAt:s.finishedAt??null,summary:s.summary??null,error:s.error??null})),advisor:advisor?{provider:clone(advisor.provider),summary:clone(advisor.summary)}:null};
  const evidenceFingerprint=fingerprint({project:projectSummary,execution});
  return{contract:DIGITAL_ENGINEERING_RECORD_CONTRACT,version:DIGITAL_ENGINEERING_RECORD_VERSION,recordId:`DER-${evidenceFingerprint.split(':').at(-1)}`,executedAt:time,project:projectSummary,execution,evidenceFingerprint};
}
export function exportDigitalEngineeringRecord(record){
  if(record?.contract!==DIGITAL_ENGINEERING_RECORD_CONTRACT)throw new Error('DigitalEngineering: registro incompatível.');
  return JSON.stringify(record,null,2);
}
