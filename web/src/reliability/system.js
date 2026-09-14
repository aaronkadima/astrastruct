import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {createSeededRandom,inverseNormalCdf,sampleRandomVariable} from './random.js';
import {sampleCorrelatedNormalValues} from './correlation.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';

function wilson(failures,n,z=1.959963984540054){
  if(!n)return{lower:0,upper:1};
  const p=failures/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;
  return{lower:Math.max(0,center-half),upper:Math.min(1,center+half)};
}
function betaFromPf(pf){return pf>0&&pf<1?-inverseNormalCdf(pf):null;}

export function runSystemMonteCarloReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],limitStates=Array.isArray(config.limitStates)?config.limitStates:[];
  const sampleCount=Math.trunc(Number(config.samples??config.sampleCount??1000)),seed=Number(config.seed??1),systemMode=config.systemMode||'series';
  if(!(sampleCount>0&&sampleCount<=1e6))throw new Error('Confiabilidade de sistema: número de amostras deve estar entre 1 e 1.000.000.');
  if(!variables.length)throw new Error('Confiabilidade de sistema: declare ao menos uma variável aleatória.');
  if(!limitStates.length)throw new Error('Confiabilidade de sistema: declare ao menos um estado limite.');
  if(!['series','parallel'].includes(systemMode))throw new Error(`Modo de sistema não suportado: ${systemMode}.`);
  const ids=new Set();for(let i=0;i<limitStates.length;i++){const id=limitStates[i].id||`LS${i+1}`;if(ids.has(id))throw new Error(`Estado limite duplicado: ${id}.`);ids.add(id);}
  const rng=createSeededRandom(seed),componentFailures=Array(limitStates.length).fill(0);let systemFailures=0;const stored=[];
  for(let i=0;i<sampleCount;i++){
    const values=config.correlationMatrix?sampleCorrelatedNormalValues(variables,config.correlationMatrix,rng).values:variables.map(v=>sampleRandomVariable(v,rng));
    const sampled=variables.map((v,j)=>({id:v.id,target:v.target,value:values[j]})),candidate=applyTargetValues(project,sampled),result=solver(candidate,config.scenarioId);
    const states=limitStates.map((ls,j)=>{const state=evaluateLimitState(result,ls);if(state.failure)componentFailures[j]++;return{id:ls.id||`LS${j+1}`,...state};});
    const failure=systemMode==='series'?states.some(s=>s.failure):states.every(s=>s.failure);if(failure)systemFailures++;
    if(config.storeSamples)stored.push({index:i,variables:Object.fromEntries(sampled.map(x=>[x.id,x.value])),failure,states:states.map(s=>({id:s.id,demand:s.demand,g:s.g,failure:s.failure}))});
  }
  const components=limitStates.map((ls,i)=>{const pf=componentFailures[i]/sampleCount;return{id:ls.id||`LS${i+1}`,failures:componentFailures[i],pf,beta:betaFromPf(pf),interval95:wilson(componentFailures[i],sampleCount),limitState:ls};});
  const pf=systemFailures/sampleCount;
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'system-monte-carlo',systemMode,seed,sampleCount,failures:systemFailures,pf,beta:betaFromPf(pf),interval95:wilson(systemFailures,sampleCount),components,correlationMatrix:config.correlationMatrix??null,samples:config.storeSamples?stored:undefined};
}
