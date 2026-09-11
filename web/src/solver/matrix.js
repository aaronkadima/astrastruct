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

// Resolve K u = F com deslocamentos prescritos arbitrários.
// prescribed é Map<dof,value>. Valores zero reproduzem os apoios clássicos.
export function solveConstrained(K,F,prescribed=new Map()){
  const nd=F.length,u=Array(nd).fill(0),constrained=[...prescribed.keys()].sort((a,b)=>a-b);
  for(const d of constrained){
    const value=Number(prescribed.get(d));
    if(!Number.isFinite(value))throw new Error(`Deslocamento prescrito inválido no DOF ${d}.`);
    u[d]=value;
  }
  const fixed=new Set(constrained),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));
  if(free.length){
    const Kr=free.map(i=>free.map(j=>K[i][j]));
    const Fr=free.map(i=>F[i]-constrained.reduce((sum,j)=>sum+K[i][j]*u[j],0));
    const ur=solveLinear(Kr,Fr);
    free.forEach((d,i)=>{u[d]=ur[i]});
  }
  const R=mul(K,u).map((v,i)=>v-F[i]);
  return {u,R,free,constrained};
}
