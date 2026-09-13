function assertIndex(i,n,label){if(!Number.isInteger(i)||i<0||i>=n)throw new RangeError(`${label}: índice ${i} fora de [0, ${n}).`)}

export class SparseMatrixCSR {
  constructor(nRows,nCols,rowPtr,colIdx,values){
    if(!Number.isInteger(nRows)||nRows<0||!Number.isInteger(nCols)||nCols<0)throw new Error('CSR: dimensões inválidas.');
    if(rowPtr.length!==nRows+1||colIdx.length!==values.length||rowPtr[nRows]!==values.length)throw new Error('CSR: estrutura inconsistente.');
    this.nRows=nRows;this.nCols=nCols;
    this.rowPtr=Int32Array.from(rowPtr);this.colIdx=Int32Array.from(colIdx);this.values=Float64Array.from(values);
  }
  get nnz(){return this.values.length}
  get(i,j){
    assertIndex(i,this.nRows,'CSR linha');assertIndex(j,this.nCols,'CSR coluna');
    for(let p=this.rowPtr[i];p<this.rowPtr[i+1];p++){const c=this.colIdx[p];if(c===j)return this.values[p];if(c>j)break}
    return 0;
  }
  matVec(x){
    if(x.length!==this.nCols)throw new Error(`CSR matVec: vetor ${x.length} incompatível com ${this.nCols} colunas.`);
    const y=Array(this.nRows).fill(0);
    for(let i=0;i<this.nRows;i++){let s=0;for(let p=this.rowPtr[i];p<this.rowPtr[i+1];p++)s+=this.values[p]*x[this.colIdx[p]];y[i]=s}
    return y;
  }
  diagonal(){const n=Math.min(this.nRows,this.nCols),d=Array(n).fill(0);for(let i=0;i<n;i++)d[i]=this.get(i,i);return d}
  toDense(){
    const A=Array.from({length:this.nRows},()=>Array(this.nCols).fill(0));
    for(let i=0;i<this.nRows;i++)for(let p=this.rowPtr[i];p<this.rowPtr[i+1];p++)A[i][this.colIdx[p]]=this.values[p];
    return A;
  }
  forEachNonZero(fn){for(let i=0;i<this.nRows;i++)for(let p=this.rowPtr[i];p<this.rowPtr[i+1];p++)fn(this.values[p],i,this.colIdx[p])}
}

export class SparseMatrixBuilder {
  constructor(nRows,nCols=nRows){
    if(!Number.isInteger(nRows)||nRows<0||!Number.isInteger(nCols)||nCols<0)throw new Error('SparseMatrixBuilder: dimensões inválidas.');
    this.nRows=nRows;this.nCols=nCols;this.rows=Array.from({length:nRows},()=>new Map());
  }
  add(i,j,value){
    assertIndex(i,this.nRows,'SparseBuilder linha');assertIndex(j,this.nCols,'SparseBuilder coluna');
    const v=Number(value);if(!Number.isFinite(v))throw new Error(`SparseBuilder: valor não finito em (${i},${j}).`);
    if(v===0)return this;const next=(this.rows[i].get(j)||0)+v;
    if(next===0)this.rows[i].delete(j);else this.rows[i].set(j,next);return this;
  }
  set(i,j,value){assertIndex(i,this.nRows,'SparseBuilder linha');assertIndex(j,this.nCols,'SparseBuilder coluna');const v=Number(value);if(!Number.isFinite(v))throw new Error(`SparseBuilder: valor não finito em (${i},${j}).`);if(v===0)this.rows[i].delete(j);else this.rows[i].set(j,v);return this}
  addBlock(rowIndices,colIndices,block){
    if(block.length!==rowIndices.length)throw new Error('SparseBuilder addBlock: número de linhas incompatível.');
    for(let a=0;a<rowIndices.length;a++){
      if(block[a].length!==colIndices.length)throw new Error('SparseBuilder addBlock: número de colunas incompatível.');
      for(let b=0;b<colIndices.length;b++)this.add(rowIndices[a],colIndices[b],block[a][b]);
    }
    return this;
  }
  addSymmetricBlock(indices,block){return this.addBlock(indices,indices,block)}
  build({dropTolerance=0}={}){
    const tol=Math.max(0,Number(dropTolerance)||0),rowPtr=[0],colIdx=[],values=[];
    for(const row of this.rows){
      const entries=[...row.entries()].filter(([,v])=>Math.abs(v)>tol).sort((a,b)=>a[0]-b[0]);
      for(const [j,v] of entries){colIdx.push(j);values.push(v)}rowPtr.push(values.length);
    }
    return new SparseMatrixCSR(this.nRows,this.nCols,rowPtr,colIdx,values);
  }
}

export function csrFromDense(A,{dropTolerance=0}={}){
  if(!Array.isArray(A))throw new Error('csrFromDense: matriz inválida.');
  const nRows=A.length,nCols=nRows?(A[0]?.length||0):0,b=new SparseMatrixBuilder(nRows,nCols),tol=Math.max(0,Number(dropTolerance)||0);
  for(let i=0;i<nRows;i++){
    if(!Array.isArray(A[i])||A[i].length!==nCols)throw new Error('csrFromDense: matriz não retangular.');
    for(let j=0;j<nCols;j++){const v=Number(A[i][j]);if(!Number.isFinite(v))throw new Error(`csrFromDense: valor não finito em (${i},${j}).`);if(Math.abs(v)>tol)b.add(i,j,v)}
  }
  return b.build();
}

export function sparseIdentity(n){const b=new SparseMatrixBuilder(n);for(let i=0;i<n;i++)b.add(i,i,1);return b.build()}

export function sparseTranspose(A){
  const b=new SparseMatrixBuilder(A.nCols,A.nRows);A.forEachNonZero((v,i,j)=>b.add(j,i,v));return b.build();
}
