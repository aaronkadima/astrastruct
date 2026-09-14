import {runMonteCarloReliability} from './monteCarlo.js';
import {runLatinHypercubeReliability} from './latinHypercube.js';
import {runMvfosmReliability} from './mvfosm.js';
import {runFormReliability} from './form.js';
import {runSystemMonteCarloReliability} from './system.js';
import {runImportanceSamplingReliability} from './importanceSampling.js';

export const RELIABILITY_STUDY_CONTRACT='project-reliability-study/v1';
export const RELIABILITY_STUDY_VERSION='0.50.0-exp';
export const RELIABILITY_METHODS=Object.freeze(['monte-carlo','latin-hypercube','mvfosm','form','system-monte-carlo','importance-sampling']);
const clone=value=>JSON.parse(JSON.stringify(value));

export function defaultReliabilityStudy(){return{contract:RELIABILITY_STUDY_CONTRACT,version:RELIABILITY_STUDY_VERSION,name:'Estudo de confiabilidade',method:'form',scenarioId:null,variables:[],limitStates:[],activeLimitStateId:null,correlationMatrix:null,samples:2000,seed:50050,systemMode:'series',lastResult:null};}
export function normalizeReliabilityStudy(input={}){
  const base=defaultReliabilityStudy(),s={...base,...clone(input)};s.contract=RELIABILITY_STUDY_CONTRACT;s.version=RELIABILITY_STUDY_VERSION;s.method=RELIABILITY_METHODS.includes(s.method)?s.method:'form';s.variables=Array.isArray(s.variables)?s.variables.map(v=>clone(v)):[];s.limitStates=Array.isArray(s.limitStates)?s.limitStates.map(ls=>clone(ls)):[];s.samples=Math.max(2,Math.min(1000000,Math.trunc(Number(s.samples)||2000)));s.seed=Number.isFinite(Number(s.seed))?Number(s.seed):50050;s.systemMode=s.systemMode==='parallel'?'parallel':'series';s.correlationMatrix=Array.isArray(s.correlationMatrix)?clone(s.correlationMatrix):null;s.activeLimitStateId=s.activeLimitStateId||s.limitStates[0]?.id||null;s.lastResult=s.lastResult&&typeof s.lastResult==='object'?clone(s.lastResult):null;return s;
}
export function reliabilityStudyFromProject(project){return normalizeReliabilityStudy(project?.reliabilityStudy||{});}
export function summarizeReliabilityResult(result){
  if(!result||typeof result!=='object')return null;const summary={contract:result.contract||null,version:result.version||null,method:result.method||null,pf:Number.isFinite(Number(result.pf))?Number(result.pf):null,beta:Number.isFinite(Number(result.beta))?Number(result.beta):null,sampleCount:result.sampleCount??null,failures:result.failures??null,interval95:result.interval95??null,standardError:result.standardError??null,coefficientOfVariation:result.coefficientOfVariation??null,designPoint:result.designPoint??result.form?.designPoint??null,components:result.components??null,diagnostics:result.diagnostics??null,converged:result.converged??null,iterations:result.iterations??null};return summary;
}
export function withReliabilityStudy(project,study,lastResult=undefined){const next=clone(project),normalized=normalizeReliabilityStudy(study);if(lastResult!==undefined)normalized.lastResult=summarizeReliabilityResult(lastResult);next.reliabilityStudy=normalized;return next;}
function activeLimitState(study){const ls=study.limitStates.find(x=>x.id===study.activeLimitStateId)||study.limitStates[0];if(!ls)throw new Error('Estudo de confiabilidade: declare ao menos um estado limite.');return ls;}
export function executeReliabilityStudy(project,input={},solver){
  const study=normalizeReliabilityStudy(input),base={variables:study.variables,scenarioId:study.scenarioId,correlationMatrix:study.correlationMatrix,samples:study.samples,seed:study.seed};
  if(study.method==='monte-carlo')return runMonteCarloReliability(project,{...base,limitState:activeLimitState(study)},solver);
  if(study.method==='latin-hypercube')return runLatinHypercubeReliability(project,{...base,limitState:activeLimitState(study)},solver);
  if(study.method==='mvfosm')return runMvfosmReliability(project,{...base,limitState:activeLimitState(study)},solver);
  if(study.method==='form')return runFormReliability(project,{...base,limitState:activeLimitState(study)},solver);
  if(study.method==='importance-sampling')return runImportanceSamplingReliability(project,{...base,limitState:activeLimitState(study)},solver);
  if(study.method==='system-monte-carlo')return runSystemMonteCarloReliability(project,{...base,limitStates:study.limitStates,systemMode:study.systemMode},solver);
  throw new Error(`Método de confiabilidade não suportado: ${study.method}.`);
}
