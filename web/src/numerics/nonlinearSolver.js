import {csrFromDense,SparseMatrixCSR} from './sparseMatrix.js';
import {solveLinearSystem} from './linearSolver.js';
import {NonlinearConvergenceError,norm2,normInf} from './diagnostics.js';

const STRATEGIES=Object.freeze(['full','modified','line-search']);

export function createTolerancePolicy({absoluteResidual=1e-8,relativeResidual=1e-8,absoluteIncrement=1e-10,relativeIncrement=1e-8,maxIterations=40}={}){
  const policy={absoluteResidual:Number(absoluteResidual),relativeResidual:Number(relativeResidual),absoluteIncrement:Number(absoluteIncrement),relativeIncrement:Number(relativeIncrement),maxIterations:Number(maxIterations)};
  for(const [key,value] of Object.entries(policy))if(!Number.isFinite(value)||value<0)throw new Error(`Tolerância inválida: ${key}=${value}.`);
  if(!Number.isInteger(policy.maxIterations)||policy.maxIterations<1)throw new Error('maxIterations deve ser inteiro positivo.');return Object.freeze(policy);
}

function asVector(v,n,label){const out=Array.from(v||[],Number);if(out.length!==n||out.some(x=>!Number.isFinite(x)))throw new Error(`${label}: vetor inválido ou incompatível.`);return out}
function scaledConvergence(residual,increment,x,initialResidual,policy){
  const rAbs=normInf(residual),rRel=rAbs/Math.max(1,initialResidual),duAbs=normInf(increment),duRel=duAbs/Math.max(1,normInf(x));
  return{rAbs,rRel,duAbs,duRel,residualOK:rAbs<=policy.absoluteResidual||rRel<=policy.relativeResidual,incrementOK:duAbs<=policy.absoluteIncrement||duRel<=policy.relativeIncrement};
}

export function newtonSolve({initial,residual,tangent,strategy='full',tolerances={},linearSolver={},modifiedRefresh=0,lineSearch={}}){
  if(!STRATEGIES.includes(strategy))throw new Error(`Estratégia de Newton desconhecida: ${strategy}.`);
  if(typeof residual!=='function'||typeof tangent!=='function')throw new Error('Newton: residual() e tangent() são obrigatórios.');
  let x=Array.from(initial||[],Number);if(!x.length||x.some(v=>!Number.isFinite(v)))throw new Error('Newton: estado inicial inválido.');
  const refreshEvery=Number(modifiedRefresh)||0;if(refreshEvery<0||!Number.isInteger(refreshEvery))throw new Error('modifiedRefresh deve ser inteiro não negativo.');
  const reduction=Number(lineSearch.reduction??0.5),minStep=Number(lineSearch.minStep??1/128),armijo=Number(lineSearch.armijo??1e-4);
  if(!(reduction>0&&reduction<1)||!(minStep>0&&minStep<=1)||!(armijo>0&&armijo<1))throw new Error('Parâmetros de line-search inválidos.');
  const n=x.length,policy=createTolerancePolicy(tolerances),history=[];let r=asVector(residual(x),n,'Newton residual'),initialResidual=Math.max(normInf(r),1e-30),cachedTangent=null,lastIncrement=Array(n).fill(Infinity);
  const first=scaledConvergence(r,Array(n).fill(0),x,initialResidual,policy);if(first.residualOK)return{x,converged:true,iterations:0,history:[{iteration:0,...first}],strategy,policy};
  for(let iteration=1;iteration<=policy.maxIterations;iteration++){
    const refresh=strategy!=='modified'||!cachedTangent||refreshEvery>0&&((iteration-1)%refreshEvery===0);
    if(refresh)cachedTangent=tangent(x,iteration);
    const K=cachedTangent instanceof SparseMatrixCSR?cachedTangent:csrFromDense(cachedTangent),rhs=r.map(v=>-v),linear=solveLinearSystem(K,rhs,linearSolver);let dx=linear.x,step=1;
    if(strategy==='line-search'){
      const base=norm2(r);let accepted=false;
      while(step>=minStep){const trial=x.map((v,i)=>v+step*dx[i]),rt=asVector(residual(trial),n,'Newton line-search residual');if(norm2(rt)<=(1-armijo*step)*base){x=trial;r=rt;accepted=true;break}step*=reduction}
      if(!accepted){step=minStep;x=x.map((v,i)=>v+step*dx[i]);r=asVector(residual(x),n,'Newton residual')}
    }else{x=x.map((v,i)=>v+dx[i]);r=asVector(residual(x),n,'Newton residual')}
    lastIncrement=dx.map(v=>step*v);const metrics=scaledConvergence(r,lastIncrement,x,initialResidual,policy);history.push({iteration,step,...metrics,linear:linear.diagnostics});
    if(metrics.residualOK&&metrics.incrementOK)return{x,converged:true,iterations:iteration,history,strategy,policy};
  }
  const final=scaledConvergence(r,lastIncrement,x,initialResidual,policy);throw new NonlinearConvergenceError(`Newton não convergiu em ${policy.maxIterations} iterações.`,{strategy,policy,final,history});
}

export function newtonStrategies(){return[...STRATEGIES]}
