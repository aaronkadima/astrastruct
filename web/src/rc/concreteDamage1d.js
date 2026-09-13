export const RC_CONCRETE_1D_CONTRACT='rc-concrete-1d/v1';

const EPS=1e-15;
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`RCConcrete1D: ${name} deve ser finito.`);return n};
const positive=(name,value)=>{const n=finite(name,value);if(!(n>0))throw new Error(`RCConcrete1D: ${name} deve ser positivo.`);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function initialConcreteDamageState(){return{maxTensionStrain:0,maxCompressionStrain:0,tensionDamage:0,compressionDamage:0,cracked:false,crushed:false,crackClosed:false,tensileFractureEnergy:0,compressiveFractureEnergy:0,lastStrain:0,lastStress:0}}

function parameters(material,options={}){
  if(!material)throw new Error('RCConcrete1D: material ausente.');
  const E=positive('E',material.E),fc=1000*Math.abs(positive('fck/fcm',options.compressionStrengthMPa??material.fcm??material.fck)),ft=1000*Math.abs(positive('fctm',options.tensionStrengthMPa??material.fctm)),lch=positive('characteristicLength',options.characteristicLength),Gf=positive('fractureEnergy',options.fractureEnergy??material.Gf??material.fractureEnergy),epsc0=Math.abs(positive('epsc0',options.epsc0??.002)),GcRaw=Number(options.compressionFractureEnergy??material.Gc??material.compressionFractureEnergy),Gc=Number.isFinite(GcRaw)&&GcRaw>0?GcRaw:null,epscuExplicit=Math.abs(Number(options.epscu??.0035));
  const epsCr=ft/E,epsTu=epsCr+2*Gf/(ft*lch),epscu=Gc?epsc0+2*Gc/(fc*lch):Math.max(epsc0*(1+1e-9),epscuExplicit);
  return{E,fc,ft,lch,Gf,Gc,epsc0,epscu,epsCr,epsTu};
}

function tensionEnvelope(eps,p){
  if(eps<=0)return{stress:0,tangent:p.E,branch:'origin'};
  if(eps<=p.epsCr)return{stress:p.E*eps,tangent:p.E,branch:'tension-elastic'};
  if(eps>=p.epsTu)return{stress:0,tangent:0,branch:'tension-fully-cracked'};
  const tangent=-p.ft/(p.epsTu-p.epsCr),stress=p.ft+tangent*(eps-p.epsCr);return{stress,tangent,branch:'tension-softening'};
}
function compressionEnvelope(kappa,p){
  if(kappa<=0)return{stress:0,tangent:p.E,branch:'origin'};
  if(kappa<=p.epsc0){const eta=kappa/p.epsc0,stress=-p.fc*(2*eta-eta*eta),tangent=2*p.fc*(1-eta)/p.epsc0;return{stress,tangent,branch:'compression-parabola'}}
  if(kappa>=p.epscu)return{stress:0,tangent:0,branch:'crushed'};
  const slope=p.fc/(p.epscu-p.epsc0),stress=-p.fc+slope*(kappa-p.epsc0);return{stress:slope===0?-p.fc:stress,tangent:slope,branch:'compression-softening'};
}
function tensileEnergy(kappa,p){if(kappa<=p.epsCr)return 0;const D=p.epsTu-p.epsCr,x=clamp(kappa-p.epsCr,0,D);return p.ft*(x-x*x/(2*D))*p.lch}
function compressiveEnergy(kappa,p){if(!p.Gc||kappa<=p.epsc0)return 0;const D=p.epscu-p.epsc0,x=clamp(kappa-p.epsc0,0,D);return p.fc*(x-x*x/(2*D))*p.lch}

/**
 * Scalar uniaxial damage/crack-band law with unilateral crack closure.
 * Stress units follow AstraStruct (kN/m²); Gf/Gc are kN/m and lch is m.
 * The routine is pure: committed state is never mutated.
 */
export function concreteDamageState({strain,material,committed=null,...options}={}){
  const eps=finite('strain',strain),p=parameters(material,options),c={...initialConcreteDamageState(),...(committed||{})};
  for(const key of ['maxTensionStrain','maxCompressionStrain','tensionDamage','compressionDamage','tensileFractureEnergy','compressiveFractureEnergy','lastStrain','lastStress'])c[key]=finite(key,c[key]);
  let stress=0,tangent=0,branch='origin',cracked=!!c.cracked,crushed=!!c.crushed,crackClosed=false,maxTensionStrain=Math.max(0,c.maxTensionStrain),maxCompressionStrain=Math.max(0,c.maxCompressionStrain),tensionDamage=clamp(c.tensionDamage,0,1),compressionDamage=clamp(c.compressionDamage,0,1);
  if(eps>=0){
    if(eps>maxTensionStrain+EPS){maxTensionStrain=eps;const env=tensionEnvelope(eps,p);stress=env.stress;tangent=env.tangent;branch=env.branch;if(eps>p.epsCr){cracked=true;tensionDamage=eps>EPS?clamp(1-stress/(p.E*eps),0,1):0}}
    else if(eps>0){const k=Math.max(maxTensionStrain,eps),envK=tensionEnvelope(k,p);tensionDamage=k>EPS?clamp(1-envK.stress/(p.E*k),0,1):tensionDamage;stress=(1-tensionDamage)*p.E*eps;tangent=(1-tensionDamage)*p.E;branch=cracked?'tension-unloading-reloading':'tension-elastic'}
    else{stress=0;tangent=cracked?(1-tensionDamage)*p.E:p.E;branch=cracked?'crack-origin':'origin'}
  }else{
    crackClosed=cracked;const kappa=-eps;
    if(kappa>maxCompressionStrain+EPS){maxCompressionStrain=kappa;const env=compressionEnvelope(kappa,p);stress=env.stress;tangent=env.tangent;branch=env.branch;if(kappa>p.epsc0){compressionDamage=kappa>EPS?clamp(1-Math.abs(stress)/(p.E*kappa),0,1):0}if(kappa>=p.epscu-EPS)crushed=true}
    else{const k=Math.max(maxCompressionStrain,kappa),envK=compressionEnvelope(k,p);compressionDamage=k>p.epsc0&&k>EPS?clamp(1-Math.abs(envK.stress)/(p.E*k),0,1):compressionDamage;stress=(1-compressionDamage)*p.E*eps;tangent=(1-compressionDamage)*p.E;branch=maxCompressionStrain>p.epsc0?'compression-unloading-reloading':'compression-reloading'}
  }
  if(maxTensionStrain>=p.epsTu-EPS){tensionDamage=1;cracked=true;if(eps>=0){stress=0;tangent=0;branch='tension-fully-cracked'}}
  if(maxCompressionStrain>=p.epscu-EPS){compressionDamage=1;crushed=true;if(eps<0&&-eps>=maxCompressionStrain-EPS){stress=0;tangent=0;branch='crushed'}}
  const tensileFractureEnergy=Math.max(c.tensileFractureEnergy,tensileEnergy(maxTensionStrain,p)),compressiveFractureEnergy=Math.max(c.compressiveFractureEnergy,compressiveEnergy(maxCompressionStrain,p));
  const history={maxTensionStrain,maxCompressionStrain,tensionDamage,compressionDamage,cracked,crushed,crackClosed,tensileFractureEnergy,compressiveFractureEnergy,lastStrain:eps,lastStress:stress};
  return{contract:RC_CONCRETE_1D_CONTRACT,type:'concrete-scalar-damage-crack-band',strain:eps,stress,tangent,branch,cracked,crushed,crackClosed,tensionDamage,compressionDamage,history,parameters:{...p}};
}

export function concreteCrackBandParameters({material,characteristicLength,fractureEnergy,compressionFractureEnergy=null,epsc0=.002,epscu=.0035}={}){
  return parameters(material,{characteristicLength,fractureEnergy,compressionFractureEnergy,epsc0,epscu});
}
