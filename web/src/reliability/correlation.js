import {sampleStandardNormal} from './random.js';
export function identityCorrelation(n){return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));}
export function choleskyCorrelation(matrix,n=matrix?.length){
  const R=matrix??identityCorrelation(n);if(!Array.isArray(R)||R.length!==n||R.some(row=>!Array.isArray(row)||row.length!==n))throw new Error(`Matriz de correlação deve ser ${n}x${n}.`);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=Number(R[i][j]);if(!Number.isFinite(v)||v<-1||v>1)throw new Error(`Correlação inválida R[${i},${j}].`);if(i===j&&Math.abs(v-1)>1e-10)throw new Error('Diagonal da matriz de correlação deve ser unitária.');if(Math.abs(v-Number(R[j][i]))>1e-10)throw new Error('Matriz de correlação deve ser simétrica.');}
  const L=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let sum=Number(R[i][j]);for(let k=0;k<j;k++)sum-=L[i][k]*L[j][k];if(i===j){if(!(sum>1e-12))throw new Error('Matriz de correlação deve ser positiva definida.');L[i][j]=Math.sqrt(sum);}else L[i][j]=sum/L[j][j];}
  return L;
}
export function multiplyLowerTriangular(L,u){return L.map((row,i)=>row.slice(0,i+1).reduce((s,v,j)=>s+v*u[j],0));}
export function normalPhysicalValues(variables,z){return variables.map((v,i)=>{if((v.distribution||'normal')!=='normal')throw new Error('Correlação explícita v0.50 aceita apenas variáveis normais.');const mean=Number(v.mean),sd=Number(v.standardDeviation??v.sd);if(!Number.isFinite(mean)||!(sd>=0))throw new Error(`Parâmetros normais inválidos em ${v.id}.`);return mean+sd*z[i];});}
export function sampleCorrelatedNormalValues(variables,correlationMatrix,rng){const L=choleskyCorrelation(correlationMatrix,variables.length),u=variables.map(()=>sampleStandardNormal(rng)),z=multiplyLowerTriangular(L,u);return{u,z,values:normalPhysicalValues(variables,z),cholesky:L};}
