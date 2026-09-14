import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {createSeededRandom,inverseNormalCdf,quantileRandomVariable} from './random.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';
function wilson(failures,n,z=1.959963984540054){if(!n)return{lower:0,upper:1};const p=failures/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;return{lower:Math.max(0,center-half),upper:Math.min(1,center+half)};}
function shuffle(values,rng){for(let i=values.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;}
export function runLatinHypercubeReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],sampleCount=Math.trunc(Number(config.samples??config.sampleCount??1000)),seed=Number(config.seed??1);if(!(sampleCount>1&&sampleCount<=1e6))throw new Error('Latin Hypercube: número de amostras deve estar entre 2 e 1.000.000.');if(!variables.length)throw new Error('Latin Hypercube: declare ao menos uma variável aleatória.');if(!config.limitState)throw new Error('Latin Hypercube: limitState é obrigatório.');if(config.correlationMatrix)throw new Error('Latin Hypercube v0.50 aceita somente variáveis independentes; correlationMatrix não é suportada nesta etapa.');
  const rng=createSeededRandom(seed),strata=variables.map(v=>{
    if((v.distribution||'deterministic')==='deterministic')return Array(sampleCount).fill(.5);
    const probs=Array.from({length:sampleCount},(_,i)=>(i+rng())/sampleCount);return shuffle(probs,rng);
  });
  let failures=0,mean=0,m2=0;const stored=[];
  for(let i=0;i<sampleCount;i++){
    const values=variables.map((v,j)=>quantileRandomVariable(v,strata[j][i])),sampled=variables.map((v,j)=>({id:v.id,target:v.target,value:values[j]})),candidate=applyTargetValues(project,sampled),result=solver(candidate,config.scenarioId),state=evaluateLimitState(result,config.limitState);if(state.failure)failures++;const k=i+1,delta=state.demand-mean;mean+=delta/k;m2+=delta*(state.demand-mean);if(config.storeSamples)stored.push({index:i,variables:Object.fromEntries(sampled.map(x=>[x.id,x.value])),demand:state.demand,g:state.g,failure:state.failure});
  }
  const pf=failures/sampleCount,interval95=wilson(failures,sampleCount),beta=pf>0&&pf<1?-inverseNormalCdf(pf):null;
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'latin-hypercube',seed,sampleCount,failures,pf,beta,interval95,demand:{mean,standardDeviation:sampleCount>1?Math.sqrt(m2/(sampleCount-1)):0},variables:variables.map(v=>({id:v.id,distribution:v.distribution||'deterministic',mean:v.mean??v.value,standardDeviation:v.standardDeviation??v.sd??0,target:v.target})),limitState:config.limitState,correlationMatrix:null,assumptions:{independentVariables:true,stratification:'one equiprobable stratum per sample and variable'},samples:config.storeSamples?stored:undefined};
}
