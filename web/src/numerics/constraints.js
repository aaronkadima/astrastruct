import {SparseMatrixBuilder,SparseMatrixCSR,csrFromDense} from './sparseMatrix.js';
import {solveLinearSystem} from './linearSolver.js';

function asCSR(A){return A instanceof SparseMatrixCSR?A:csrFromDense(A)}
function checkDof(dof,n,label='DOF'){if(!Number.isInteger(dof)||dof<0||dof>=n)throw new RangeError(`${label} ${dof} fora de [0, ${n}).`)}
function addCoeff(map,key,value){const next=(map.get(key)||0)+value;if(Math.abs(next)<=1e-15)map.delete(key);else map.set(key,next)}

export class ConstraintManager {
  constructor(){this._dependent=new Map()}
  prescribe(dof,value=0){
    const v=Number(value);if(!Number.isFinite(v))throw new Error(`Restrição prescrita inválida no DOF ${dof}.`);
    this._set(dof,{kind:'prescribed',slave:dof,masters:[],offset:v});return this;
  }
  equalDOF(slave,master,{factor=1,offset=0}={}){return this.addMPC(slave,[{dof:master,coefficient:factor}],offset,'equalDOF')}
  addMPC(slave,masters,offset=0,kind='mpc'){
    const c=Number(offset);if(!Number.isFinite(c))throw new Error(`MPC: offset inválido no DOF ${slave}.`);
    if(!Array.isArray(masters)||!masters.length)throw new Error('MPC: informe pelo menos um DOF mestre.');
    const normalized=masters.map(term=>{const dof=Number(term.dof),coefficient=Number(term.coefficient);if(!Number.isInteger(dof)||!Number.isFinite(coefficient))throw new Error('MPC: termo mestre inválido.');return{dof,coefficient}}).filter(t=>Math.abs(t.coefficient)>0);
    if(!normalized.length)throw new Error('MPC: todos os coeficientes são nulos.');
    this._set(slave,{kind,slave,masters:normalized,offset:c});return this;
  }
  _set(slave,constraint){if(!Number.isInteger(slave)||slave<0)throw new Error(`Restrição: DOF dependente inválido ${slave}.`);if(this._dependent.has(slave))throw new Error(`Restrição duplicada no DOF ${slave}.`);this._dependent.set(slave,constraint)}
  has(dof){return this._dependent.has(dof)}
  get size(){return this._dependent.size}
  list(){return [...this._dependent.values()].map(c=>({...c,masters:c.masters.map(m=>({...m}))}))}
  equations(nDofs){
    const out=[];
    for(const c of this._dependent.values()){
      checkDof(c.slave,nDofs,'DOF dependente');const coefficients=new Map([[c.slave,1]]);
      for(const term of c.masters){checkDof(term.dof,nDofs,'DOF mestre');addCoeff(coefficients,term.dof,-term.coefficient)}
      out.push({kind:c.kind,coefficients,rhs:c.offset,slave:c.slave});
    }
    return out;
  }
  resolveExpressions(nDofs){
    const cache=new Map(),visiting=new Set();
    const resolve=(dof)=>{
      checkDof(dof,nDofs);if(cache.has(dof))return cache.get(dof);if(visiting.has(dof))throw new Error(`MPC cíclica detectada envolvendo o DOF ${dof}.`);
      visiting.add(dof);const c=this._dependent.get(dof);let expression;
      if(!c)expression={constant:0,coefficients:new Map([[dof,1]])};
      else{
        let constant=c.offset;const coefficients=new Map();
        for(const term of c.masters){checkDof(term.dof,nDofs,'DOF mestre');const master=resolve(term.dof);constant+=term.coefficient*master.constant;for(const [root,coef] of master.coefficients)addCoeff(coefficients,root,term.coefficient*coef)}
        expression={constant,coefficients};
      }
      visiting.delete(dof);cache.set(dof,expression);return expression;
    };
    return Array.from({length:nDofs},(_,i)=>resolve(i));
  }
}

export function reduceByTransformation(A,F,constraints=new ConstraintManager()){
  A=asCSR(A);if(A.nRows!==A.nCols)throw new Error('Transformação MPC: matriz deve ser quadrada.');const n=A.nRows;if(F.length!==n)throw new Error('Transformação MPC: RHS incompatível.');
  const expressions=constraints.resolveExpressions(n),roots=[...new Set(expressions.flatMap(e=>[...e.coefficients.keys()]))].sort((a,b)=>a-b),rootIndex=new Map(roots.map((d,i)=>[d,i])),offset=expressions.map(e=>e.constant);
  const Kc=A.matVec(offset),effective=F.map((v,i)=>Number(v)-Kc[i]),Fr=Array(roots.length).fill(0),builder=new SparseMatrixBuilder(roots.length);
  for(let i=0;i<n;i++)for(const [root,coef] of expressions[i].coefficients)Fr[rootIndex.get(root)]+=coef*effective[i];
  A.forEachNonZero((value,i,j)=>{
    for(const [ri,ai] of expressions[i].coefficients)for(const [rj,aj] of expressions[j].coefficients)builder.add(rootIndex.get(ri),rootIndex.get(rj),ai*value*aj);
  });
  const reconstruct=(q)=>expressions.map(e=>e.constant+[...e.coefficients].reduce((s,[root,coef])=>s+coef*q[rootIndex.get(root)],0));
  return {K:builder.build(),F:Fr,roots,expressions,offset,reconstruct};
}

export function applyPenaltyConstraints(A,F,constraints,{penalty}={}){
  A=asCSR(A);const n=A.nRows;if(A.nCols!==n||F.length!==n)throw new Error('Penalty constraints: sistema incompatível.');
  const scale=Math.max(1,...A.diagonal().map(Math.abs)),alpha=Number(penalty)||scale*1e10,builder=new SparseMatrixBuilder(n),rhs=Array.from(F,Number);
  A.forEachNonZero((v,i,j)=>builder.add(i,j,v));
  for(const equation of constraints.equations(n)){
    for(const [i,ci] of equation.coefficients){rhs[i]+=alpha*ci*equation.rhs;for(const [j,cj] of equation.coefficients)builder.add(i,j,alpha*ci*cj)}
  }
  return {K:builder.build(),F:rhs,penalty:alpha};
}

export function augmentWithLagrangeMultipliers(A,F,constraints){
  A=asCSR(A);const n=A.nRows;if(A.nCols!==n||F.length!==n)throw new Error('Lagrange constraints: sistema incompatível.');const equations=constraints.equations(n),m=equations.length,builder=new SparseMatrixBuilder(n+m),rhs=[...Array.from(F,Number),...equations.map(e=>e.rhs)];
  A.forEachNonZero((v,i,j)=>builder.add(i,j,v));
  equations.forEach((equation,k)=>{const row=n+k;for(const [dof,c] of equation.coefficients){builder.add(row,dof,c);builder.add(dof,row,c)}});
  return {K:builder.build(),F:rhs,physicalDofs:n,multipliers:m};
}

export function solveConstrainedSystem(A,F,constraints=new ConstraintManager(),{enforcement='transformation',linearSolver={}}={}){
  if(enforcement==='transformation'){
    const reduced=reduceByTransformation(A,F,constraints);const solved=solveLinearSystem(reduced.K,reduced.F,linearSolver),u=reduced.reconstruct(solved.x);return{u,multipliers:null,reduced,diagnostics:{...solved.diagnostics,enforcement}};
  }
  if(enforcement==='penalty'){
    const penalized=applyPenaltyConstraints(A,F,constraints,linearSolver),solved=solveLinearSystem(penalized.K,penalized.F,linearSolver);return{u:solved.x,multipliers:null,reduced:penalized,diagnostics:{...solved.diagnostics,enforcement,penalty:penalized.penalty}};
  }
  if(enforcement==='lagrange'){
    const augmented=augmentWithLagrangeMultipliers(A,F,constraints),solved=solveLinearSystem(augmented.K,augmented.F,{...linearSolver,method:'direct'});return{u:solved.x.slice(0,augmented.physicalDofs),multipliers:solved.x.slice(augmented.physicalDofs),reduced:augmented,diagnostics:{...solved.diagnostics,enforcement}};
  }
  throw new Error(`Método de imposição de restrições desconhecido: ${enforcement}.`);
}
