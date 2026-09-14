import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {createSeededRandom,inverseNormalCdf,sampleRandomVariable} from './random.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';
function wilson(failures,n,z=1.959963984540054){if(!n)return{lower:0,upper:1};const p=failures/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;return{lower:Math.max(0,center-half),upper:Math.min(1,center+half)};}
export function runMonteCarloReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],sampleCount=Math.trunc(Number(config.samples??config.sampleCount??1000)),seed=Number(config.seed??1);if(!(sampleCount>0&&sampleCount<=1e6))throw new Error('Monte Carlo: número de amostras deve estar entre 1 e 1.000.000.');if(!variables.length)throw new Error('Monte Carlo: declare ao menos uma variável aleatória.');if(!config.limitState)throw new Error('Monte Carlo: limitState é obrigatório.');
  const rng=createSeededRandom(seed);let failures=0,mean=0,m2=0;const stored=[];
  for(let i=0;i<sampleCount;i++){
    const sampled=variables.map(variable=>({id:variable.id,target:variable.target,value:sampleRandomVariable(variable,rng)})),candidate=applyTargetValues(project,sampled),result=solver(candidate,config.scenarioId),state=evaluateLimitState(result,config.limitState);if(state.failure)failures++;const k=i+1,delta=state.demand-mean;mean+=delta/k;m2+=delta*(state.demand-mean);if(config.storeSamples)stored.push({index:i,variables:Object.fromEntries(sampled.map(x=>[x.id,x.value])),demand:state.demand,g:state.g,failure:state.failure});
  }
  const pf=failures/sampleCount,interval95=wilson(failures,sampleCount),beta=pf>0&&pf<1?-inverseNormalCdf(pf):null;
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'monte-carlo',seed,sampleCount,failures,pf,beta,interval95,demand:{mean,standardDeviation:sampleCount>1?Math.sqrt(m2/(sampleCount-1)):0},variables:variables.map(v=>({id:v.id,distribution:v.distribution||'deterministic',mean:v.mean??v.value,standardDeviation:v.standardDeviation??v.sd??0,target:v.target})),limitState:config.limitState,samples:config.storeSamples?stored:undefined};
}
