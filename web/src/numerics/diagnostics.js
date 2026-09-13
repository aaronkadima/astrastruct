export class NumericalSingularityError extends Error {
  constructor(message, diagnostics={}) {
    super(message);
    this.name='NumericalSingularityError';
    this.code='ASTRA_NUMERICAL_SINGULARITY';
    this.diagnostics={...diagnostics};
  }
}

export class NonlinearConvergenceError extends Error {
  constructor(message, diagnostics={}) {
    super(message);
    this.name='NonlinearConvergenceError';
    this.code='ASTRA_NONLINEAR_NONCONVERGENCE';
    this.diagnostics={...diagnostics};
  }
}

export function normInf(v){
  let m=0;
  for(const value of v||[])m=Math.max(m,Math.abs(Number(value)||0));
  return m;
}

export function norm2(v){
  let s=0;
  for(const value of v||[]){const x=Number(value)||0;s+=x*x}
  return Math.sqrt(s);
}

export function dot(a,b){
  if(a.length!==b.length)throw new Error('Produto escalar: dimensões incompatíveis.');
  let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;
}

export function relativeResidual(A,x,b){
  const ax=typeof A.matVec==='function'?A.matVec(x):A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
  const r=ax.map((v,i)=>v-b[i]),abs=normInf(r),scale=Math.max(1,normInf(b));
  return {residual:r,absolute:abs,relative:abs/scale};
}

export function inspectMatrix(A,{zeroTolerance=1e-14}={}){
  const nRows=Number(A?.nRows??A?.length??0),nCols=Number(A?.nCols??A?.[0]?.length??0);
  if(!(nRows>=0&&nCols>=0))throw new Error('Matriz inválida para diagnóstico.');
  const get=typeof A?.get==='function'?(i,j)=>A.get(i,j):(i,j)=>Number(A[i]?.[j]||0);
  let maxAbs=0,maxDiag=0,minDiag=Infinity,maxAsymmetry=0;
  const zeroRows=[];
  for(let i=0;i<nRows;i++){
    let rowMax=0;
    for(let j=0;j<nCols;j++){
      const a=Math.abs(get(i,j));rowMax=Math.max(rowMax,a);maxAbs=Math.max(maxAbs,a);
      if(i===j){maxDiag=Math.max(maxDiag,a);minDiag=Math.min(minDiag,a)}
      if(i<nCols&&j<nRows)maxAsymmetry=Math.max(maxAsymmetry,Math.abs(get(i,j)-get(j,i)));
    }
    if(rowMax<=zeroTolerance)zeroRows.push(i);
  }
  if(!Number.isFinite(minDiag))minDiag=0;
  return {
    nRows,nCols,maxAbs,maxDiagonalAbs:maxDiag,minDiagonalAbs:minDiag,
    diagonalScaleRatio:maxDiag>0?minDiag/maxDiag:0,
    symmetryError:maxAbs>0?maxAsymmetry/maxAbs:0,
    zeroRows,
    square:nRows===nCols
  };
}
