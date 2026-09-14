import {optimizeProject} from './optimization.js';

export const OPTIMIZATION_STUDY_CONTRACT='project-optimization-study/v1';
export const OPTIMIZATION_STUDY_VERSION='0.50.0-exp';
export const OPTIMIZATION_STUDY_METHODS=Object.freeze(['bounded-coordinate-search']);
const clone=value=>JSON.parse(JSON.stringify(value));

export function defaultOptimizationStudy(){
  return{
    contract:OPTIMIZATION_STUDY_CONTRACT,
    version:OPTIMIZATION_STUDY_VERSION,
    name:'Estudo de otimização',
    method:'bounded-coordinate-search',
    scenarioId:null,
    direction:'minimize',
    variables:[],
    objective:{kind:'design-sum',terms:[]},
    constraints:[],
    initialStepFraction:.25,
    tolerance:1e-4,
    maxIterations:80,
    storeHistory:true,
    lastResult:null,
  };
}

export function normalizeOptimizationStudy(input={}){
  const base=defaultOptimizationStudy(),s={...base,...clone(input)};
  s.contract=OPTIMIZATION_STUDY_CONTRACT;
  s.version=OPTIMIZATION_STUDY_VERSION;
  s.method=OPTIMIZATION_STUDY_METHODS.includes(s.method)?s.method:'bounded-coordinate-search';
  s.direction=s.direction==='maximize'?'maximize':'minimize';
  s.variables=Array.isArray(s.variables)?s.variables.map(v=>clone(v)):[];
  s.objective=s.objective&&typeof s.objective==='object'?clone(s.objective):clone(base.objective);
  s.constraints=Array.isArray(s.constraints)?s.constraints.map(c=>clone(c)):[];
  s.initialStepFraction=Math.max(1e-4,Math.min(.5,Number(s.initialStepFraction)||.25));
  s.tolerance=Math.max(1e-8,Math.min(.1,Number(s.tolerance)||1e-4));
  s.maxIterations=Math.max(1,Math.min(10000,Math.trunc(Number(s.maxIterations)||80)));
  s.storeHistory=s.storeHistory!==false;
  s.lastResult=s.lastResult&&typeof s.lastResult==='object'?clone(s.lastResult):null;
  return s;
}

export function optimizationStudyFromProject(project){
  return normalizeOptimizationStudy(project?.optimizationStudy||{});
}

export function summarizeOptimizationResult(result){
  if(!result||typeof result!=='object')return null;
  const history=Array.isArray(result.history)?result.history:[];
  return{
    contract:result.contract||null,
    version:result.version||null,
    method:result.method||null,
    direction:result.direction||null,
    iterations:result.iterations??null,
    evaluations:result.evaluations??null,
    converged:result.converged??null,
    best:result.best?clone(result.best):null,
    historySummary:history.length?{
      count:history.length,
      first:clone(history[0]),
      last:clone(history.at(-1)),
    }:null,
  };
}

export function withOptimizationStudy(project,study,lastResult=undefined){
  const next=clone(project),normalized=normalizeOptimizationStudy(study);
  if(lastResult!==undefined)normalized.lastResult=summarizeOptimizationResult(lastResult);
  next.optimizationStudy=normalized;
  return next;
}

export function executeOptimizationStudy(project,input={},solver){
  const study=normalizeOptimizationStudy(input);
  if(study.method!=='bounded-coordinate-search')throw new Error(`Método de otimização não suportado: ${study.method}.`);
  return optimizeProject(project,{
    variables:study.variables,
    objective:study.objective,
    constraints:study.constraints,
    direction:study.direction,
    scenarioId:study.scenarioId,
    initialStepFraction:study.initialStepFraction,
    tolerance:study.tolerance,
    maxIterations:study.maxIterations,
    storeHistory:study.storeHistory,
  },solver);
}

export function applyOptimizationBest(project,study,result){
  if(!result?.bestProject||!result?.best?.feasible)throw new Error('Otimização: não há melhor projeto factível para aplicar.');
  return withOptimizationStudy(result.bestProject,study,result);
}
