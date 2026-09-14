import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {createSeededRandom,inverseNormalCdf,sampleStandardNormal} from './random.js';
import {choleskyCorrelation,multiplyLowerTriangular,normalPhysicalValues} from './correlation.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';
import {runFormReliability} from './form.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);

export function runImportanceSamplingReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[],sampleCount=Math.trunc(Number(config.samples??config.sampleCount??2000)),seed=Number(config.seed??1);
  if(!(sampleCount>1&&sampleCount<=1e6))throw new Error('Importance sampling: número de amostras deve estar entre 2 e 1.000.000.');
  if(!variables.length)throw new Error('Importance sampling: declare ao menos uma variável aleatória.');if(!config.limitState)throw new Error('Importance sampling: limitState é obrigatório.');
  for(const v of variables)if((v.distribution||'normal')!=='normal')throw new Error('Importance sampling v0.50 aceita somente variáveis normais.');
  const L=choleskyCorrelation(config.correlationMatrix,variables.length),form=config.centerU?null:runFormReliability(project,{variables,limitState:config.limitState,scenarioId:config.scenarioId,correlationMatrix:config.correlationMatrix,maxIterations:config.formMaxIterations??50,relaxation:config.formRelaxation??1},solver);
  if(form&&!form.converged)throw new Error('Importance sampling: FORM não convergiu; forneça centerU explícito ou corrija o estado limite.');
  const center=(config.centerU??form.designPoint.u).map(Number);if(center.length!==variables.length||center.some(x=>!Number.isFinite(x)))throw new Error('Importance sampling: centerU incompatível com as variáveis.');
  const rng=createSeededRandom(seed);let sumY=0,sumY2=0,sumW=0,sumW2=0,failureSamples=0,sumFailureW=0,sumFailureW2=0;const stored=[];
  for(let i=0;i<sampleCount;i++){
    const eps=variables.map(()=>sampleStandardNormal(rng)),u=center.map((c,j)=>c+eps[j]),z=multiplyLowerTriangular(L,u),values=normalPhysicalValues(variables,z),candidate=applyTargetValues(project,variables.map((v,j)=>({target:v.target,value:values[j]}))),result=solver(candidate,config.scenarioId),state=evaluateLimitState(result,config.limitState);
    const logWeight=-0.5*dot(u,u)+0.5*dot(eps,eps),weight=Math.exp(logWeight),y=state.failure?weight:0;
    if(!Number.isFinite(weight))throw new Error('Importance sampling: peso de verossimilhança não finito.');if(state.failure){failureSamples++;sumFailureW+=weight;sumFailureW2+=weight*weight;}
    sumY+=y;sumY2+=y*y;sumW+=weight;sumW2+=weight*weight;
    if(config.storeSamples)stored.push({index:i,u,weight,demand:state.demand,g:state.g,failure:state.failure});
  }
  const pf=sumY/sampleCount,sampleVariance=Math.max(0,(sumY2-sampleCount*pf*pf)/(sampleCount-1)),standardError=Math.sqrt(sampleVariance/sampleCount),z95=1.959963984540054,interval95={lower:Math.max(0,pf-z95*standardError),upper:Math.min(1,pf+z95*standardError)},ess=sumW2>0?(sumW*sumW)/sumW2:0,failureEss=sumFailureW2>0?(sumFailureW*sumFailureW)/sumFailureW2:0,beta=pf>0&&pf<1?-inverseNormalCdf(pf):null;
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'importance-sampling-form-center',seed,sampleCount,pf,beta,standardError,coefficientOfVariation:pf>0?standardError/pf:null,interval95,proposal:{centerU:center,source:config.centerU?'explicit':'FORM design point'},diagnostics:{failureSamples,ess,failureEss,meanWeight:sumW/sampleCount},form:form?{beta:form.beta,pf:form.pf,iterations:form.iterations,designPoint:form.designPoint}:null,correlationMatrix:config.correlationMatrix??null,limitState:config.limitState,samples:config.storeSamples?stored:undefined};
}
