export function zeros(n,m=n){return Array.from({length:n},()=>Array(m).fill(0))}
export function solveLinear(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]),eps=1e-12;
  for(let k=0;k<n;k++){
    let piv=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[piv][k]))piv=i;
    if(Math.abs(M[piv][k])<eps)throw new Error('Matriz singular: estrutura instável, mecanismo ou restrições insuficientes.');
    [M[k],M[piv]]=[M[piv],M[k]];
    for(let i=k+1;i<n;i++){const f=M[i][k]/M[k][k];for(let j=k;j<=n;j++)M[i][j]-=f*M[k][j]}
  }
  const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s-=M[i][j]*x[j];x[i]=s/M[i][i]}
  return x;
}
export function mul(A,x){return A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0))}
export function addSub(K,ke,idx){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)K[idx[i]][idx[j]]+=ke[i][j]}
