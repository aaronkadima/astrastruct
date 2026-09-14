import{solve as defaultSolve}from'../solver/index.js';
import{executeReliabilityStudy,summarizeReliabilityResult,executeOptimizationStudy,summarizeOptimizationResult}from'../reliability/index.js';
import{runEngineeringAdvisor}from'./advisor.js';
import{createDigitalEngineeringRecord}from'./digitalRecord.js';
import{AUTOMATION_CONTRACT,AUTOMATION_VERSION,AUTOMATION_STUDY_CONTRACT,AUTOMATION_STUDY_VERSION,AUTOMATION_STEP_TYPES,AUTOMATION_PRESETS}from'./contracts.js';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const PRESET_STEPS=Object.freeze({
  'analysis-review':[{id:'solve',type:'solve'},{id:'advisor',type:'advisor'},{id:'snapshot',type:'snapshot'}],
  'analysis-reliability':[{id:'solve',type:'solve'},{id:'reliability',type:'reliability'},{id:'advisor',type:'advisor'},{id:'snapshot',type:'snapshot'}],
  'analysis-optimization':[{id:'solve',type:'solve'},{id:'optimization',type:'optimization'},{id:'advisor',type:'advisor'},{id:'snapshot',type:'snapshot'}],
  'digital-audit':[{id:'advisor',type:'advisor'},{id:'snapshot',type:'snapshot'}],
});
export function automationStepsForPreset(preset='analysis-review'){return clone(PRESET_STEPS[AUTOMATION_PRESETS.includes(preset)?preset:'analysis-review']);}
export function defaultAutomationStudy(){return{contract:AUTOMATION_STUDY_CONTRACT,version:AUTOMATION_STUDY_VERSION,name:'Automação de engenharia',preset:'analysis-review',scenarioId:null,stopOnError:true,steps:automationStepsForPreset('analysis-review'),lastRun:null};}
export function normalizeAutomationStudy(input={}){
  const base=defaultAutomationStudy(),s={...base,...clone(input)};s.contract=AUTOMATION_STUDY_CONTRACT;s.version=AUTOMATION_STUDY_VERSION;s.preset=AUTOMATION_PRESETS.includes(s.preset)?s.preset:'analysis-review';s.scenarioId=s.scenarioId||null;s.stopOnError=s.stopOnError!==false;
  const raw=Array.isArray(s.steps)&&s.steps.length?s.steps:automationStepsForPreset(s.preset);s.steps=raw.map((step,i)=>({id:String(step?.id||`step-${i+1}`),type:AUTOMATION_STEP_TYPES.includes(step?.type)?step.type:'advisor',enabled:step?.enabled!==false,options:step?.options&&typeof step.options==='object'?clone(step.options):{}}));s.lastRun=s.lastRun&&typeof s.lastRun==='object'?clone(s.lastRun):null;return s;
}
export function automationStudyFromProject(project){return normalizeAutomationStudy(project?.automationStudy||{});}
export function summarizeSolveResult(result){
  if(!result||typeof result!=='object')return null;const displacements=result.totalDisplacements||result.displacements||[],maxTranslation=Math.max(0,...displacements.map(d=>Math.hypot(Number(d?.ux)||0,Number(d?.uy)||0,Number(d?.uz)||0)));
  return{contract:result.contract||null,type:result.type||null,analysisType:result.analysisType||null,dimension:result.dimension||null,solverVersion:result.solverVersion||null,scenarioId:result.scenario?.id||null,nodeResults:displacements.length,elementResults:Array.isArray(result.elementForces)?result.elementForces.length:Array.isArray(result.elementResponses)?result.elementResponses.length:0,maxTranslation};
}
export function summarizeAutomationRun(run){
  if(!run||typeof run!=='object')return null;return{contract:run.contract||AUTOMATION_CONTRACT,version:run.version||AUTOMATION_VERSION,status:run.status||null,startedAt:run.startedAt||null,finishedAt:run.finishedAt||null,preset:run.preset||null,scenarioId:run.scenarioId||null,errors:run.errors??0,steps:clone(run.steps||[]),advisor:run.advisor?{provider:clone(run.advisor.provider),summary:clone(run.advisor.summary),items:clone(run.advisor.items)}:null,record:clone(run.record||null)};
}
export function withAutomationStudy(project,study,lastRun=undefined){const next=clone(project),normalized=normalizeAutomationStudy(study);if(lastRun!==undefined)normalized.lastRun=summarizeAutomationRun(lastRun);next.automationStudy=normalized;return next;}
export function executeAutomationStudy(project,input={},dependencies={}){
  if(!project||typeof project!=='object')throw new Error('Automation: projeto é obrigatório.');
  const study=normalizeAutomationStudy(input),solver=dependencies.solve||defaultSolve,now=dependencies.now||(()=>new Date().toISOString());let latestResult=null,advisor=null,errors=0;const steps=[],startedAt=now();
  for(const step of study.steps){
    if(!step.enabled){steps.push({id:step.id,type:step.type,status:'skipped',startedAt:null,finishedAt:null,summary:null,error:null});continue;}
    const started=now();try{
      let summary=null;
      if(step.type==='solve'){latestResult=solver(project,step.options?.scenarioId||study.scenarioId||undefined);summary=summarizeSolveResult(latestResult);}
      else if(step.type==='reliability'){const raw=executeReliabilityStudy(project,project.reliabilityStudy||{},solver);summary=summarizeReliabilityResult(raw);}
      else if(step.type==='optimization'){const raw=executeOptimizationStudy(project,project.optimizationStudy||{},solver);summary=summarizeOptimizationResult(raw);}
      else if(step.type==='advisor'){advisor=runEngineeringAdvisor(project,{result:latestResult,automation:{errors}});summary={provider:clone(advisor.provider),summary:clone(advisor.summary)};}
      else if(step.type==='snapshot'){summary={digitalRecord:'generated-at-run-finalization'};}
      steps.push({id:step.id,type:step.type,status:'success',startedAt:started,finishedAt:now(),summary,error:null});
    }catch(error){errors+=1;steps.push({id:step.id,type:step.type,status:'error',startedAt:started,finishedAt:now(),summary:null,error:error?.message||String(error)});if(study.stopOnError)break;}
  }
  if(!advisor){try{advisor=runEngineeringAdvisor(project,{result:latestResult,automation:{errors}});}catch{advisor=null;}}
  const finishedAt=now(),status=errors?'completed-with-errors':'completed',record=createDigitalEngineeringRecord(project,{executedAt:finishedAt,study,steps,advisor,status});
  return{contract:AUTOMATION_CONTRACT,version:AUTOMATION_VERSION,status,startedAt,finishedAt,preset:study.preset,scenarioId:study.scenarioId,errors,steps,advisor,record};
}
