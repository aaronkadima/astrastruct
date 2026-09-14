const SQRT2=Math.sqrt(2);
export function createSeededRandom(seed=1){
  let a=(Number(seed)>>>0)||0x9e3779b9;
  return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
export function sampleStandardNormal(rng){
  let u=0,v=0;while(u<=Number.EPSILON)u=rng();v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
export function erfApprox(x){
  const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+0.3275911*a),y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t)*Math.exp(-a*a);return sign*y;
}
export function normalCdf(x){return 0.5*(1+erfApprox(x/SQRT2));}
export function inverseNormalCdf(p){
  if(!(p>0&&p<1))return p===0?-Infinity:(p===1?Infinity:NaN);
  const a=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.38357751867269e2,-3.066479806614716e1,2.506628277459239];
  const b=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
  const c=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
  const plow=0.02425,phigh=1-plow;let q,r;
  if(p<plow){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>phigh){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
export function sampleRandomVariable(variable,rng){
  const distribution=variable.distribution||'deterministic';
  const mean=Number(variable.mean??variable.value),sd=Number(variable.standardDeviation??variable.sd??0);
  if(distribution==='deterministic'){if(!Number.isFinite(mean))throw new Error(`Variável ${variable.id||''}: valor determinístico inválido.`);return mean;}
  if(distribution==='normal'){if(!Number.isFinite(mean)||!(sd>=0))throw new Error(`Variável ${variable.id||''}: parâmetros normais inválidos.`);return mean+sd*sampleStandardNormal(rng);}
  if(distribution==='lognormal'){
    if(!(mean>0)||!(sd>=0))throw new Error(`Variável ${variable.id||''}: lognormal exige média positiva e desvio não negativo.`);
    if(sd===0)return mean;const sigma2=Math.log(1+(sd*sd)/(mean*mean)),mu=Math.log(mean)-sigma2/2;return Math.exp(mu+Math.sqrt(sigma2)*sampleStandardNormal(rng));
  }
  if(distribution==='uniform'){
    const min=Number(variable.min),max=Number(variable.max);if(!Number.isFinite(min)||!Number.isFinite(max)||!(max>min))throw new Error(`Variável ${variable.id||''}: limites uniformes inválidos.`);return min+(max-min)*rng();
  }
  throw new Error(`Distribuição não suportada: ${distribution}.`);
}
