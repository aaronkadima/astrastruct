import {csrFromDense} from '../numerics/sparseMatrix.js';
import {solveDenseCompatible} from '../numerics/linearSolver.js';
import {ConstraintManager,solveConstrainedSystem} from '../numerics/constraints.js';

export function zeros(n,m=n){return Array.from({length:n},()=>Array(m).fill(0))}

// API histórica preservada; a fatoração agora é fornecida pelo Numerical Core 2.
export function solveLinear(A,b){return solveDenseCompatible(A,b,{relativePivotTolerance:1e-12,absolutePivotTolerance:1e-14})}

export function mul(A,x){return A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0))}
export function addSub(K,ke,idx){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)K[idx[i]][idx[j]]+=ke[i][j]}

// Compatibilidade com Map<dof,value>: internamente usa transformação exata u=Tq+c.
export function solveConstrained(K,F,prescribed=new Map()){
  const nd=F.length,u0=Array(nd).fill(0),constrained=[...prescribed.keys()].sort((a,b)=>a-b),manager=new ConstraintManager();
  for(const d of constrained){
    const value=Number(prescribed.get(d));
    if(!Number.isFinite(value))throw new Error(`Deslocamento prescrito inválido no DOF ${d}.`);
    manager.prescribe(d,value);u0[d]=value;
  }
  const fixed=new Set(constrained),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));
  const solved=solveConstrainedSystem(csrFromDense(K),F,manager,{enforcement:'transformation',linearSolver:{method:'direct'}}),u=solved.u;
  const R=mul(K,u).map((v,i)=>v-F[i]);
  return {u,R,free,constrained,numericalDiagnostics:solved.diagnostics};
}
