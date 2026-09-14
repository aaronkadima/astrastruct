import {solve} from '../solver/index.js';
import {MULTIOBJECTIVE_OPTIMIZATION_CONTRACT,MULTIOBJECTIVE_OPTIMIZATION_VERSION} from './contracts.js';
import {optimizeProject,evaluateOptimizationObjective} from './optimization.js';

function normalizeObjectives(input){
  const objectives=Array.isArray(input)?input:[];if(objectives.length<2)throw new Error('Pareto: declare ao menos dois objetivos.');
  const ids=new Set();return objectives.map((o,i)=>{const id=String(o.id||`OBJ${i+1}`);if(ids.has(id))throw new Error(`Pareto: objetivo duplicado ${id}.`);ids.add(id);const scale=Number(o.scale);if(!(scale>0&&Number.isFinite(scale)))throw new Error(`Pareto: objetivo ${id} exige scale positivo e explícito.`);if(!o.objective)throw new Error(`Pareto: objetivo ${id} não declara objective.`);return{id,direction:o.direction==='maximize'?'maximize':'minimize',scale,objective:o.objective};});
}
function normalizeWeightSet(set,objectives,index){
  const raw=Array.isArray(set)?Object.fromEntries(objectives.map((o,i)=>[o.id,Number(set[i]??0)])):set||{},weights={};let sum=0;for(const o of objectives){const w=Number(raw[o.id]??0);if(!(w>=0&&Number.isFinite(w)))throw new Error(`Pareto: peso inválido em ${o.id}, conjunto ${index+1}.`);weights[o.id]=w;sum+=w;}if(!(sum>0))throw new Error(`Pareto: conjunto de pesos ${index+1} deve conter peso positivo.`);for(const id of Object.keys(weights))weights[id]/=sum;return weights;
}
function oriented(point,objective){const v=Number(point.objectives[objective.id]);return objective.direction==='maximize'?-v:v;}
function dominates(a,b,objectives,tol){let strict=false;for(const o of objectives){const av=oriented(a,o),bv=oriented(b,o),eps=tol*Math.max(1,Math.abs(av),Math.abs(bv));if(av>bv+eps)return false;if(av<bv-eps)strict=true;}return strict;}
function sameDesign(a,b,tol){const ids=new Set([...Object.keys(a.designValues||{}),...Object.keys(b.designValues||{})]);for(const id of ids){const x=Number(a.designValues?.[id]),y=Number(b.designValues?.[id]);if(!Number.isFinite(x)||!Number.isFinite(y))return false;if(Math.abs(x-y)>tol*Math.max(1,Math.abs(x),Math.abs(y)))return false;}return true;}

export function optimizeParetoProject(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],constraints=Array.isArray(config.constraints)?config.constraints:[],objectives=normalizeObjectives(config.objectives),sets=Array.isArray(config.weightSets)?config.weightSets:[];if(!variables.length)throw new Error('Pareto: declare ao menos uma variável de projeto.');if(!sets.length)throw new Error('Pareto: weightSets explícitos são obrigatórios.');
  const designTolerance=Number(config.designTolerance??1e-8),dominanceTolerance=Number(config.dominanceTolerance??1e-9);let totalEvaluations=0;const candidates=[];
  for(let i=0;i<sets.length;i++){
    const weights=normalizeWeightSet(sets[i],objectives,i),scalar={kind:'weighted-sum',terms:objectives.map(o=>({weight:weights[o.id],scale:o.scale,direction:o.direction,objective:o.objective}))};
    const run=optimizeProject(project,{variables,constraints,objective:scalar,direction:'minimize',scenarioId:config.scenarioId,initialStepFraction:config.initialStepFraction,tolerance:config.tolerance,maxIterations:config.maxIterations,storeHistory:false},solver);totalEvaluations+=run.evaluations;
    const result=solver(run.bestProject,config.scenarioId),values=Object.fromEntries(objectives.map(o=>[o.id,evaluateOptimizationObjective(o.objective,run.best.values,result)]));
    const point={index:i,weights,objectives:values,designValues:{...run.best.values},feasible:run.best.feasible,totalViolation:run.best.totalViolation,constraints:run.best.constraints,scalarObjective:run.best.objective,converged:run.converged,iterations:run.iterations,evaluations:run.evaluations};
    if(!candidates.some(existing=>sameDesign(existing,point,designTolerance)))candidates.push(point);
  }
  const feasible=candidates.filter(p=>p.feasible),front=feasible.filter((p,i)=>!feasible.some((q,j)=>i!==j&&dominates(q,p,objectives,dominanceTolerance)));
  return{contract:MULTIOBJECTIVE_OPTIMIZATION_CONTRACT,version:MULTIOBJECTIVE_OPTIMIZATION_VERSION,method:'explicit-weighted-sum-pareto',objectives:objectives.map(({objective,...meta})=>meta),weightSetCount:sets.length,candidateCount:candidates.length,totalEvaluations,candidates,front};
}
