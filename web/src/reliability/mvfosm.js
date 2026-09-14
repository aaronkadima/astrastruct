import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {normalCdf} from './random.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';
function physicalMean(v){const m=Number(v.mean??v.value);if(!Number.isFinite(m))throw new Error(`MVFOSM: média inválida em ${v.id}.`);return m;}
function physicalSd(v){const s=Number(v.standardDeviation??v.sd??0);if(!(s>=0))throw new Error(`MVFOSM: desvio padrão inválido em ${v.id}.`);return s;}
export function runMvfosmReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[];if(!variables.length)throw new Error('MVFOSM: declare ao menos uma variável aleatória.');if(!config.limitState)throw new Error('MVFOSM: limitState é obrigatório.');
  const means=variables.map(physicalMean),sds=variables.map(physicalSd),evaluate=values=>{const candidate=applyTargetValues(project,variables.map((v,i)=>({target:v.target,value:values[i]}))),result=solver(candidate,config.scenarioId);return evaluateLimitState(result,config.limitState);};
  const base=evaluate(means),sensitivities=[];let varianceG=0;
  for(let i=0;i<variables.length;i++){
    const sd=sds[i];if(sd===0){sensitivities.push({id:variables[i].id,derivative:0,alpha:0});continue;}const h=Math.max(Math.abs(means[i])*1e-6,sd*1e-3,1e-9),plus=[...means],minus=[...means];plus[i]+=h;minus[i]-=h;const gp=evaluate(plus).g,gm=evaluate(minus).g,derivative=(gp-gm)/(2*h);varianceG+=(derivative*sd)**2;sensitivities.push({id:variables[i].id,derivative,alpha:null});
  }
  const standardDeviationG=Math.sqrt(varianceG),beta=standardDeviationG>0?base.g/standardDeviationG:null,pf=beta==null?null:normalCdf(-beta);if(standardDeviationG>0)for(const s of sensitivities){const i=variables.findIndex(v=>v.id===s.id);s.alpha=(s.derivative*sds[i])/standardDeviationG;}
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'mvfosm',meanPoint:{values:Object.fromEntries(variables.map((v,i)=>[v.id,means[i]])),demand:base.demand,g:base.g},standardDeviationG,beta,pf,sensitivities,limitState:config.limitState,assumptions:{independentVariables:true,linearization:'mean-point finite difference'}};
}
