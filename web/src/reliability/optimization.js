import {solve} from '../solver/index.js';
import {OPTIMIZATION_CONTRACT,OPTIMIZATION_VERSION} from './contracts.js';
import {applyTargetValues,getTargetValue} from './projectTarget.js';
import {extractResponse} from './response.js';
import {runFormReliability} from './form.js';
import {runMvfosmReliability} from './mvfosm.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function evaluateOptimizationObjective(objective,values,result){
  if(objective?.kind==='response')return Number(objective.factor??1)*extractResponse(result,objective.selector);
  if(objective?.kind==='design-sum')return(objective.terms||[]).reduce((sum,t)=>{const x=Number(values[t.variableId]);if(!Number.isFinite(x))throw new Error(`Objetivo referencia variável ausente: ${t.variableId}.`);return sum+Number(t.coefficient??1)*(x**Number(t.power??1));},0);
  if(objective?.kind==='weighted-sum'){
    const terms=Array.isArray(objective.terms)?objective.terms:[];if(!terms.length)throw new Error('Objetivo weighted-sum exige ao menos um termo.');
    return terms.reduce((sum,t)=>{const weight=Number(t.weight),scale=Number(t.scale);if(!(weight>=0&&Number.isFinite(weight)))throw new Error('Objetivo weighted-sum exige pesos não negativos e finitos.');if(!(scale>0&&Number.isFinite(scale)))throw new Error('Objetivo weighted-sum exige scale positivo e explícito em cada termo.');const raw=evaluateOptimizationObjective(t.objective,values,result),oriented=t.direction==='maximize'?-raw:raw;return sum+weight*oriented/scale;},0);
  }
  throw new Error(`Objetivo não suportado: ${objective?.kind}.`);
}

function deterministicConstraintState(constraint,result){
  const response=extractResponse(result,constraint.selector),limit=Number(constraint.limit),relation=constraint.relation||'<=';if(!Number.isFinite(limit))throw new Error(`Constraint ${constraint.id||''}: limit inválido.`);if(!['<=','>='].includes(relation))throw new Error(`Constraint ${constraint.id||''}: relação não suportada ${relation}.`);const raw=relation==='>='?limit-response:response-limit,scale=Math.max(Math.abs(limit),1e-12),violation=Math.max(0,raw)/scale;return{id:constraint.id||null,kind:'response',response,limit,relation,violation,satisfied:violation<=Number(constraint.tolerance??1e-10)};
}

function reliabilityConstraintState(constraint,candidate,solver,scenarioId){
  const method=constraint.method||'form',variables=Array.isArray(constraint.variables)?constraint.variables:[],limitState=constraint.limitState;if(!variables.length)throw new Error(`Constraint ${constraint.id||''}: declare variables para confiabilidade.`);if(!limitState)throw new Error(`Constraint ${constraint.id||''}: limitState é obrigatório.`);
  if(method==='mvfosm'&&constraint.correlationMatrix)throw new Error(`Constraint ${constraint.id||''}: MVFOSM v0.50 não aceita correlationMatrix; use FORM.`);
  const cfg={variables,limitState,scenarioId:constraint.scenarioId??scenarioId,correlationMatrix:constraint.correlationMatrix,maxIterations:constraint.maxIterations,gradientStep:constraint.gradientStep,toleranceU:constraint.toleranceU,toleranceG:constraint.toleranceG,relaxation:constraint.relaxation};
  const reliability=method==='mvfosm'?runMvfosmReliability(candidate,cfg,solver):method==='form'?runFormReliability(candidate,cfg,solver):(()=>{throw new Error(`Constraint ${constraint.id||''}: método de confiabilidade não suportado ${method}.`);})();
  const minBeta=constraint.minBeta==null?null:Number(constraint.minBeta),maxPf=constraint.maxPf==null?null:Number(constraint.maxPf);if(minBeta==null&&maxPf==null)throw new Error(`Constraint ${constraint.id||''}: declare minBeta e/ou maxPf.`);if(minBeta!=null&&!Number.isFinite(minBeta))throw new Error(`Constraint ${constraint.id||''}: minBeta inválido.`);if(maxPf!=null&&!(maxPf>0&&maxPf<1))throw new Error(`Constraint ${constraint.id||''}: maxPf deve estar entre 0 e 1.`);
  const beta=Number(reliability.beta),pf=Number(reliability.pf);let violation=0;if(minBeta!=null)violation+=Math.max(0,minBeta-beta)/Math.max(Math.abs(minBeta),1);if(maxPf!=null)violation+=Math.max(0,pf-maxPf)/Math.max(maxPf,1e-12);const converged=method!=='form'||reliability.converged===true;if(!converged)violation=Math.max(1,violation);
  return{id:constraint.id||null,kind:'reliability',method,beta,pf,minBeta,maxPf,converged,violation,satisfied:converged&&violation<=Number(constraint.tolerance??1e-8),reliability};
}

export function evaluateOptimizationConstraint(constraint,candidate,result,solver=solve,scenarioId=null){return constraint?.kind==='reliability'?reliabilityConstraintState(constraint,candidate,solver,scenarioId):deterministicConstraintState(constraint,result);}
function better(a,b,direction){if(!b)return true;if(a.feasible!==b.feasible)return a.feasible;if(!a.feasible&&Math.abs(a.totalViolation-b.totalViolation)>1e-14)return a.totalViolation<b.totalViolation;return direction==='maximize'?a.objective>b.objective:a.objective<b.objective;}

export function optimizeProject(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],constraints=Array.isArray(config.constraints)?config.constraints:[],direction=config.direction||'minimize';if(!variables.length)throw new Error('Otimização: declare ao menos uma variável de projeto.');if(!config.objective)throw new Error('Otimização: objective é obrigatório.');
  const initial={},ranges={};for(const variable of variables){const lower=Number(variable.lower),upper=Number(variable.upper);if(!Number.isFinite(lower)||!Number.isFinite(upper)||!(upper>lower))throw new Error(`Variável ${variable.id}: limites inválidos.`);ranges[variable.id]=upper-lower;initial[variable.id]=clamp(Number(variable.initial??getTargetValue(project,variable.target)),lower,upper);}
  let evaluations=0;const history=[],evaluate=values=>{const candidate=applyTargetValues(project,variables.map(v=>({target:v.target,value:values[v.id]}))),result=solver(candidate,config.scenarioId),states=constraints.map(c=>evaluateOptimizationConstraint(c,candidate,result,solver,config.scenarioId)),totalViolation=states.reduce((s,c)=>s+c.violation,0),objective=evaluateOptimizationObjective(config.objective,values,result),record={values:{...values},objective,constraints:states,totalViolation,feasible:states.every(c=>c.satisfied),result};evaluations++;if(config.storeHistory!==false)history.push({iteration:evaluations,values:{...values},objective,feasible:record.feasible,totalViolation});return record;};
  let current=evaluate(initial);const stepFraction=Number(config.initialStepFraction??0.25),tolerance=Number(config.tolerance??1e-4),maxIterations=Math.trunc(Number(config.maxIterations??80)),steps=Object.fromEntries(variables.map(v=>[v.id,ranges[v.id]*stepFraction]));let iterations=0;
  while(iterations<maxIterations){iterations++;let improved=false;for(const variable of variables){for(const sign of [-1,1]){const trial={...current.values},next=clamp(trial[variable.id]+sign*steps[variable.id],Number(variable.lower),Number(variable.upper));if(next===trial[variable.id])continue;trial[variable.id]=next;const candidate=evaluate(trial);if(better(candidate,current,direction)){current=candidate;improved=true;}}}if(!improved)for(const variable of variables)steps[variable.id]*=0.5;const maxRelative=Math.max(...variables.map(v=>steps[v.id]/ranges[v.id]));if(maxRelative<=tolerance)break;}
  const bestProject=applyTargetValues(project,variables.map(v=>({target:v.target,value:current.values[v.id]})));
  return{contract:OPTIMIZATION_CONTRACT,version:OPTIMIZATION_VERSION,method:'bounded-coordinate-search',direction,iterations,evaluations,converged:Math.max(...variables.map(v=>steps[v.id]/ranges[v.id]))<=tolerance,best:{values:current.values,objective:current.objective,feasible:current.feasible,totalViolation:current.totalViolation,constraints:current.constraints},bestProject,history:config.storeHistory===false?undefined:history};
}
