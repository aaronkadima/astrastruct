import {solve} from '../solver/index.js';
import {RELIABILITY_CONTRACT,RELIABILITY_VERSION} from './contracts.js';
import {normalCdf} from './random.js';
import {applyTargetValues} from './projectTarget.js';
import {evaluateLimitState} from './response.js';
import {choleskyCorrelation,multiplyLowerTriangular,normalPhysicalValues} from './correlation.js';
const norm=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function runFormReliability(project,config={},solver=solve){
  const variables=Array.isArray(config.variables)?config.variables:[];if(!variables.length)throw new Error('FORM: declare ao menos uma variável aleatória.');if(!config.limitState)throw new Error('FORM: limitState é obrigatório.');
  for(const v of variables){if((v.distribution||'normal')!=='normal')throw new Error('FORM v0.50 aceita somente variáveis normais.');if(!(Number(v.standardDeviation??v.sd)>0))throw new Error(`FORM: ${v.id} exige desvio padrão positivo.`);}
  const L=choleskyCorrelation(config.correlationMatrix,variables.length),evaluate=u=>{const z=multiplyLowerTriangular(L,u),values=normalPhysicalValues(variables,z),candidate=applyTargetValues(project,variables.map((v,i)=>({target:v.target,value:values[i]}))),result=solver(candidate,config.scenarioId),state=evaluateLimitState(result,config.limitState);return{...state,u:[...u],z,values};};
  const maxIterations=Math.trunc(Number(config.maxIterations??50)),gradientStep=Number(config.gradientStep??1e-4),toleranceU=Number(config.toleranceU??1e-6),toleranceG=Number(config.toleranceG??1e-9),relaxation=Number(config.relaxation??1);if(!(gradientStep>0)||!(toleranceU>0)||!(toleranceG>0)||!(relaxation>0&&relaxation<=1))throw new Error('FORM: parâmetros numéricos inválidos.');
  let u=Array.isArray(config.initialU)&&config.initialU.length===variables.length?config.initialU.map(Number):Array(variables.length).fill(0),converged=false,iterations=0,last=null,gradient=null,alpha=null;
  const origin=evaluate(Array(variables.length).fill(0));
  for(let it=0;it<maxIterations;it++){
    iterations=it+1;last=evaluate(u);gradient=[];for(let i=0;i<u.length;i++){const up=[...u],um=[...u];up[i]+=gradientStep;um[i]-=gradientStep;gradient.push((evaluate(up).g-evaluate(um).g)/(2*gradientStep));}
    const ng=norm(gradient);if(!(ng>0&&Number.isFinite(ng)))throw new Error('FORM: gradiente de g nulo ou inválido.');alpha=gradient.map(x=>x/ng);const scalar=dot(gradient,u)-last.g,nextRaw=gradient.map(x=>x*scalar/(ng*ng)),next=u.map((x,i)=>x+relaxation*(nextRaw[i]-x)),du=norm(next.map((x,i)=>x-u[i]));u=next;const check=evaluate(u);if(du<=toleranceU&&Math.abs(check.g)<=toleranceG){last=check;converged=true;break;}
  }
  last=evaluate(u);gradient=[];for(let i=0;i<u.length;i++){const up=[...u],um=[...u];up[i]+=gradientStep;um[i]-=gradientStep;gradient.push((evaluate(up).g-evaluate(um).g)/(2*gradientStep));}const ng=norm(gradient);alpha=ng>0?gradient.map(x=>x/ng):Array(u.length).fill(null);const betaMagnitude=norm(u),beta=(origin.g>=0?1:-1)*betaMagnitude,pf=normalCdf(-beta);
  return{contract:RELIABILITY_CONTRACT,version:RELIABILITY_VERSION,method:'form-hlrf',converged,iterations,beta,pf,designPoint:{u:[...u],z:last.z,physical:Object.fromEntries(variables.map((v,i)=>[v.id,last.values[i]])),g:last.g,demand:last.demand},alpha:Object.fromEntries(variables.map((v,i)=>[v.id,alpha[i]])),correlationMatrix:config.correlationMatrix??null,limitState:config.limitState,assumptions:{distributions:'normal',transformation:'Cholesky correlated normal',algorithm:'Hasofer-Lind-Rackwitz-Fiessler'}};
}
