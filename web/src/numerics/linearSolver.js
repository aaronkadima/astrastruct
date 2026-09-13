import {csrFromDense,SparseMatrixCSR} from './sparseMatrix.js';
import {NumericalSingularityError,dot,inspectMatrix,norm2,normInf,relativeResidual} from './diagnostics.js';

function asCSR(A){return A instanceof SparseMatrixCSR?A:csrFromDense(A)}
function finiteVector(b,n,label='vetor'){if(!Array.isArray(b)&&!(b instanceof Float64Array))throw new Error(`${label}: entrada inválida.`);if(b.length!==n)throw new Error(`${label}: dimensão ${b.length} incompatível com ${n}.`);const out=Array.from(b,Number);if(out.some(v=>!Number.isFinite(v)))throw new Error(`${label}: contém valor não finito.`);return out}

export function solveSparseDirect(A,b,{relativePivotTolerance=1e-12,absolutePivotTolerance=1e-14,dropTolerance=1e-15}={}){
  A=asCSR(A);if(A.nRows!==A.nCols)throw new Error('Solver direto: matriz deve ser quadrada.');
  const n=A.nRows,rhs=finiteVector(b,n,'Solver direto RHS'),rows=Array.from({length:n},()=>new Map()),scales=Array(n).fill(0);
  A.forEachNonZero((v,i,j)=>{rows[i].set(j,v);scales[i]=Math.max(scales[i],Math.abs(v))});
  const matrixInfo=inspectMatrix(A),pivots=[],scaledPivots=[];
  for(let k=0;k<n;k++){
    let pivotRow=-1,best=-1;
    for(let i=k;i<n;i++){
      const a=Math.abs(rows[i].get(k)||0),scale=Math.max(scales[i],Number.MIN_VALUE),score=a/scale;
      if(score>best){best=score;pivotRow=i}
    }
    const pivotAbs=pivotRow>=0?Math.abs(rows[pivotRow].get(k)||0):0,threshold=absolutePivotTolerance;
    if(!(pivotAbs>threshold))throw new NumericalSingularityError(`Matriz singular no pivô ${k}.`,{pivotIndex:k,pivotAbs,threshold,rankEstimate:k,matrix:matrixInfo,pivots:[...pivots],scaledPivots:[...scaledPivots]});
    if(pivotRow!==k){[rows[k],rows[pivotRow]]=[rows[pivotRow],rows[k]];[rhs[k],rhs[pivotRow]]=[rhs[pivotRow],rhs[k]];[scales[k],scales[pivotRow]]=[scales[pivotRow],scales[k]]}
    const pivot=rows[k].get(k),pivotScale=Math.max(scales[k],Math.abs(pivot),Number.MIN_VALUE);pivots.push(Math.abs(pivot));scaledPivots.push(Math.abs(pivot)/pivotScale);
    for(let i=k+1;i<n;i++){
      const aik=rows[i].get(k)||0;if(Math.abs(aik)<=dropTolerance){rows[i].delete(k);continue}
      const factor=aik/pivot;rows[i].delete(k);
      for(const [j,v] of rows[k]){
        if(j<=k)continue;const next=(rows[i].get(j)||0)-factor*v;
        if(Math.abs(next)<=dropTolerance)rows[i].delete(j);else rows[i].set(j,next);
      }
      rhs[i]-=factor*rhs[k];
    }
  }
  const x=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){
    let s=rhs[i];for(const [j,v] of rows[i])if(j>i)s-=v*x[j];const d=rows[i].get(i)||0;
    if(Math.abs(d)<=absolutePivotTolerance)throw new NumericalSingularityError(`Matriz singular na retro-substituição do DOF ${i}.`,{pivotIndex:i,pivotAbs:Math.abs(d),threshold:absolutePivotTolerance,rankEstimate:i,matrix:matrixInfo,pivots:[...pivots],scaledPivots:[...scaledPivots]});
    x[i]=s/d;
  }
  const residual=relativeResidual(A,x,b),pivotMin=pivots.length?Math.min(...pivots):0,pivotMax=pivots.length?Math.max(...pivots):0,minScaledPivot=scaledPivots.length?Math.min(...scaledPivots):0,pivotRatio=pivotMax>0?pivotMin/pivotMax:0;
  return {x,diagnostics:{method:'sparse-direct-pivoted',iterations:1,residual,pivotMin,pivotMax,pivotRatio,minScaledPivot,illConditioned:minScaledPivot<=relativePivotTolerance||pivotRatio<=relativePivotTolerance,rankEstimate:n,matrix:matrixInfo}};
}

export function solveConjugateGradient(A,b,{relativeTolerance=1e-10,absoluteTolerance=1e-12,maxIterations,initial=null,jacobi=true}={}){
  A=asCSR(A);if(A.nRows!==A.nCols)throw new Error('CG: matriz deve ser quadrada.');const n=A.nRows,rhs=finiteVector(b,n,'CG RHS');
  let x=initial?finiteVector(initial,n,'CG initial'):Array(n).fill(0),Ax=A.matVec(x),r=rhs.map((v,i)=>v-Ax[i]);
  const diag=A.diagonal(),M=jacobi?diag.map((v,i)=>{if(Math.abs(v)<=1e-18)throw new NumericalSingularityError(`CG/Jacobi: diagonal nula no DOF ${i}.`,{pivotIndex:i,matrix:inspectMatrix(A)});return 1/v}):Array(n).fill(1);
  let z=r.map((v,i)=>M[i]*v),p=[...z],rz=dot(r,z),bNorm=Math.max(1,norm2(rhs)),target=Math.max(absoluteTolerance,relativeTolerance*bNorm),rNorm=norm2(r),iterations=0;
  const limit=Math.max(1,Number(maxIterations)||Math.max(50,4*n));
  if(rNorm<=target)return{x,diagnostics:{method:'conjugate-gradient',iterations,residual:relativeResidual(A,x,rhs),converged:true,target,matrix:inspectMatrix(A)}};
  for(let k=0;k<limit;k++){
    const Ap=A.matVec(p),den=dot(p,Ap);
    if(!(den>0))throw new NumericalSingularityError('CG detectou curvatura não positiva; matriz não é SPD ou está singular.',{iteration:k,pAp:den,residualNorm:rNorm,matrix:inspectMatrix(A)});
    const alpha=rz/den;x=x.map((v,i)=>v+alpha*p[i]);r=r.map((v,i)=>v-alpha*Ap[i]);rNorm=norm2(r);iterations=k+1;
    if(rNorm<=target)break;
    z=r.map((v,i)=>M[i]*v);const rzNew=dot(r,z),beta=rzNew/rz;p=z.map((v,i)=>v+beta*p[i]);rz=rzNew;
  }
  const residual=relativeResidual(A,x,rhs),converged=rNorm<=target;
  return{x,diagnostics:{method:'conjugate-gradient',iterations,residual,converged,target,matrix:inspectMatrix(A)}};
}

export function solveLinearSystem(A,b,{method='auto',...options}={}){
  const csr=asCSR(A),n=csr.nRows;
  if(method==='direct')return solveSparseDirect(csr,b,options);
  if(method==='cg')return solveConjugateGradient(csr,b,options);
  if(method!=='auto')throw new Error(`Solver linear desconhecido: ${method}.`);
  const info=inspectMatrix(csr),symmetric=info.symmetryError<=1e-12,preferCG=symmetric&&n>=Number(options.cgThreshold||600);
  if(preferCG){const result=solveConjugateGradient(csr,b,options);if(result.diagnostics.converged)return result}
  return solveSparseDirect(csr,b,options);
}

export function solveDenseCompatible(A,b,options={}){return solveLinearSystem(csrFromDense(A),b,{method:'direct',...options}).x}

export function equilibriumNorm(A,x,b){const {residual}=relativeResidual(asCSR(A),x,b);return{absolute:normInf(residual),relative:normInf(residual)/Math.max(1,normInf(b))}}
