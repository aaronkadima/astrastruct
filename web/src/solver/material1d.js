const EPS=1e-15;

function finite(name,value){
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error(`Material 1D: ${name} deve ser finito.`);
  return n;
}

function clamp(v,a,b){return Math.min(b,Math.max(a,v));}

/**
 * Envelope monotônico bilinear simétrico para aço.
 * Mantido por compatibilidade com rótulas concentradas e análises monotônicas.
 */
export function bilinearSteelState({strain,E,fy,hardeningRatio=0.01}){
  const eps=finite('deformação',strain),modulus=finite('E',E),yieldStress=Math.abs(finite('fy',fy)),b=finite('razão de encruamento',hardeningRatio);
  if(!(modulus>0))throw new Error('Material 1D: E deve ser positivo.');
  if(!(yieldStress>0))throw new Error('Material 1D: fy deve ser positivo.');
  if(!(b>=0&&b<=1))throw new Error('Material 1D: razão de encruamento deve estar entre 0 e 1.');
  const yieldStrain=yieldStress/modulus,abs=Math.abs(eps),sign=eps<0?-1:1;
  if(abs<=yieldStrain+EPS){
    return{type:'steel-bilinear-monotonic',strain:eps,stress:modulus*eps,tangent:modulus,yielded:false,yieldStrain,yieldStress,hardeningRatio:b,branch:'elastic'};
  }
  const stress=sign*(yieldStress+b*modulus*(abs-yieldStrain));
  return{type:'steel-bilinear-monotonic',strain:eps,stress,tangent:b*modulus,yielded:true,yieldStrain,yieldStress,hardeningRatio:b,branch:'post-yield'};
}

/** Convert an AstraStruct model material to the unit system used by the solver. */
export function bilinearSteelFromModelMaterial(material,strain,{hardeningRatio=0.01}={}){
  if(!material)throw new Error('Material 1D: material ausente.');
  const type=String(material.type||'').toLowerCase();
  if(type!=='steel'&&type!=='rebar')throw new Error(`Material 1D: tipo "${material.type||'desconhecido'}" ainda não suportado pelo aço bilinear.`);
  const E=finite('E',material.E),fyMPa=Math.abs(finite('fy',material.fy));
  return bilinearSteelState({strain,E,fy:fyMPa*1000,hardeningRatio});
}

export function initialSteelHistoryState(){
  return{plasticStrain:0,backstress:0,equivalentPlasticStrain:0,dissipatedEnergyDensity:0,stress:0,strain:0,loadingDirection:0,yielded:false};
}

/**
 * v0.21 incremental 1D return mapping with linear combined hardening.
 *
 * The post-yield tangent is prescribed through hardeningRatio b. The equivalent
 * plastic modulus H is chosen so E*H/(E+H)=bE. kinematicFraction partitions H
 * between kinematic translation of the yield surface and isotropic expansion.
 * Pure kinematic hardening (default) provides a transparent Bauschinger effect.
 * The routine is pure: committed is never mutated; history is the trial state.
 */
export function cyclicSteelState({strain,E,fy,hardeningRatio=0.01,kinematicFraction=1,committed=null}){
  const eps=finite('deformação',strain),modulus=finite('E',E),yieldStress=Math.abs(finite('fy',fy)),b=clamp(finite('razão de encruamento',hardeningRatio),0,.95),eta=clamp(finite('fração cinemática',kinematicFraction),0,1);
  if(!(modulus>0))throw new Error('Material 1D cíclico: E deve ser positivo.');
  if(!(yieldStress>0))throw new Error('Material 1D cíclico: fy deve ser positivo.');
  const c={...initialSteelHistoryState(),...(committed||{})};
  for(const key of ['plasticStrain','backstress','equivalentPlasticStrain','dissipatedEnergyDensity','stress','strain'])c[key]=finite(key,c[key]);
  const Htotal=b<=EPS?0:modulus*b/(1-b),Hkin=eta*Htotal,Hiso=(1-eta)*Htotal;
  const sigmaTrial=modulus*(eps-c.plasticStrain),xiTrial=sigmaTrial-c.backstress,radius=yieldStress+Hiso*c.equivalentPlasticStrain,fTrial=Math.abs(xiTrial)-radius,tol=1e-12*Math.max(1,yieldStress,Math.abs(sigmaTrial));
  const deltaStrain=eps-c.strain,loadingDirection=Math.abs(deltaStrain)>EPS?(deltaStrain>0?1:-1):Number(c.loadingDirection)||0;
  if(fTrial<=tol){
    const history={...c,strain:eps,stress:sigmaTrial,loadingDirection,yielded:Math.abs(Math.abs(xiTrial)-radius)<=10*tol&&c.equivalentPlasticStrain>0};
    return{type:'steel-bilinear-cyclic-combined-hardening',strain:eps,stress:sigmaTrial,tangent:modulus,yielded:history.yielded,yieldStrain:yieldStress/modulus,yieldStress,hardeningRatio:b,kinematicFraction:eta,branch:c.equivalentPlasticStrain>0?'elastic-unloading-reloading':'elastic',plasticMultiplier:0,plasticStrain:history.plasticStrain,backstress:history.backstress,equivalentPlasticStrain:history.equivalentPlasticStrain,dissipatedEnergyDensity:history.dissipatedEnergyDensity,history};
  }
  const sign=xiTrial<0?-1:1,den=modulus+Hkin+Hiso,dGamma=fTrial/Math.max(den,EPS),plasticStrain=c.plasticStrain+dGamma*sign,backstress=c.backstress+Hkin*dGamma*sign,equivalentPlasticStrain=c.equivalentPlasticStrain+dGamma,stress=sigmaTrial-modulus*dGamma*sign,tangent=(Hkin+Hiso)>EPS?modulus*(Hkin+Hiso)/den:0,dissipationIncrement=Math.max(0,yieldStress*dGamma),dissipatedEnergyDensity=c.dissipatedEnergyDensity+dissipationIncrement;
  const history={plasticStrain,backstress,equivalentPlasticStrain,dissipatedEnergyDensity,stress,strain:eps,loadingDirection,yielded:true};
  return{type:'steel-bilinear-cyclic-combined-hardening',strain:eps,stress,tangent,yielded:true,yieldStrain:yieldStress/modulus,yieldStress,hardeningRatio:b,kinematicFraction:eta,branch:'plastic-return',plasticMultiplier:dGamma,plasticStrain,backstress,equivalentPlasticStrain,dissipationIncrement,dissipatedEnergyDensity,history};
}

export function cyclicSteelFromModelMaterial(material,strain,{hardeningRatio=0.01,kinematicFraction=1,committed=null}={}){
  if(!material)throw new Error('Material 1D cíclico: material ausente.');
  const type=String(material.type||'').toLowerCase();
  if(type!=='steel'&&type!=='rebar')throw new Error(`Material 1D cíclico: tipo "${material.type||'desconhecido'}" não suportado.`);
  const E=finite('E',material.E),fyMPa=Math.abs(finite('fy',material.fy));
  return cyclicSteelState({strain,E,fy:fyMPa*1000,hardeningRatio,kinematicFraction,committed});
}

export const MATERIAL_1D_VERSION='0.21.0-exp';
