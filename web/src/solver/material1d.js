const EPS=1e-15;

function finite(name,value){
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error(`Material 1D: ${name} deve ser finito.`);
  return n;
}

/**
 * Envelope monotônico bilinear simétrico para aço.
 *
 * Mantido para compatibilidade com as rótulas concentradas e com a
 * plasticidade distribuída monotônica das versões anteriores.
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

export function zeroSteelKinematicHistory(){
  return{plasticStrain:0,backstress:0,cumulativePlasticStrain:0,dissipatedEnergy:0,strain:0,stress:0,yieldedEver:false,lastFlowDirection:0,loadingDirection:0,reversalCount:0};
}

export function normalizeSteelKinematicHistory(raw=null){
  const source=raw?.history||raw||{},base=zeroSteelKinematicHistory();
  const out={...base};
  for(const key of ['plasticStrain','backstress','cumulativePlasticStrain','dissipatedEnergy','strain','stress']){
    const value=Number(source?.[key]);out[key]=Number.isFinite(value)?value:base[key];
  }
  out.cumulativePlasticStrain=Math.max(0,out.cumulativePlasticStrain);
  out.dissipatedEnergy=Math.max(0,out.dissipatedEnergy);
  out.yieldedEver=!!source?.yieldedEver;
  out.lastFlowDirection=Number(source?.lastFlowDirection)<0?-1:(Number(source?.lastFlowDirection)>0?1:0);
  out.loadingDirection=Number(source?.loadingDirection)<0?-1:(Number(source?.loadingDirection)>0?1:0);
  out.reversalCount=Math.max(0,Math.round(Number(source?.reversalCount)||0));
  return out;
}

/**
 * 1D associative elastoplastic steel with linear kinematic hardening.
 *
 * State variables are committed only outside this function. Every call performs
 * a trial return-mapping from the supplied committed state, which makes it safe
 * inside Newton and line-search evaluations. The requested post-yield tangent
 * ratio b=Et/E is mapped to Hkin=bE/(1-b), yielding the exact algorithmic
 * tangent Et=bE during plastic loading and E during unloading/reloading.
 */
export function bilinearSteelKinematicState({strain,E,fy,hardeningRatio=0.01,committedState=null}){
  const eps=finite('deformação',strain),modulus=finite('E',E),yieldStress=Math.abs(finite('fy',fy)),b=finite('razão de encruamento',hardeningRatio),previous=normalizeSteelKinematicHistory(committedState);
  if(!(modulus>0))throw new Error('Material 1D: E deve ser positivo.');
  if(!(yieldStress>0))throw new Error('Material 1D: fy deve ser positivo.');
  if(!(b>=0&&b<1))throw new Error('Material 1D: para encruamento cinemático, Et/E deve satisfazer 0 ≤ b < 1.');
  const H=b<=EPS?0:b*modulus/(1-b),yieldTol=Math.max(1e-9,1e-10*yieldStress),deltaStrain=eps-previous.strain,loadingDirection=Math.abs(deltaStrain)<=EPS?previous.loadingDirection:(deltaStrain>0?1:-1),reversal=previous.loadingDirection!==0&&loadingDirection!==0&&loadingDirection!==previous.loadingDirection;
  const sigmaTrial=modulus*(eps-previous.plasticStrain),xiTrial=sigmaTrial-previous.backstress,fTrial=Math.abs(xiTrial)-yieldStress;
  let stress=sigmaTrial,tangent=modulus,plasticStrain=previous.plasticStrain,backstress=previous.backstress,cumulativePlasticStrain=previous.cumulativePlasticStrain,dissipatedEnergy=previous.dissipatedEnergy,plasticIncrement=0,flowDirection=previous.lastFlowDirection,plastic=false;
  if(fTrial>yieldTol){
    flowDirection=xiTrial<0?-1:1;
    const dGamma=fTrial/(modulus+H);
    plasticIncrement=dGamma*flowDirection;
    plasticStrain=previous.plasticStrain+plasticIncrement;
    backstress=previous.backstress+H*plasticIncrement;
    stress=modulus*(eps-plasticStrain);
    tangent=H>0?modulus*H/(modulus+H):0;
    cumulativePlasticStrain=previous.cumulativePlasticStrain+dGamma;
    dissipatedEnergy=previous.dissipatedEnergy+yieldStress*dGamma;
    plastic=true;
  }
  const relativeStress=stress-backstress,onYieldSurface=Math.abs(Math.abs(relativeStress)-yieldStress)<=10*yieldTol,yielded=plastic||(previous.yieldedEver&&onYieldSurface),history={plasticStrain,backstress,cumulativePlasticStrain,dissipatedEnergy,strain:eps,stress,yieldedEver:previous.yieldedEver||plastic,lastFlowDirection:flowDirection,loadingDirection,reversalCount:previous.reversalCount+(reversal?1:0)};
  const branch=plastic?(flowDirection>0?'plastic-loading-positive':'plastic-loading-negative'):(reversal?'elastic-reversal':(history.yieldedEver?'elastic-unloading-reloading':'elastic'));
  return{type:'steel-bilinear-kinematic-history',strain:eps,stress,tangent,yielded,plastic,yieldStrain:yieldStress/modulus,yieldStress,hardeningRatio:b,hardeningModulus:H,branch,plasticStrain,backstress,relativeStress,plasticIncrement,cumulativePlasticStrain,dissipatedEnergy,dissipationIncrement:dissipatedEnergy-previous.dissipatedEnergy,reversal,reversalCount:history.reversalCount,loadingDirection,history};
}

export function bilinearSteelKinematicFromModelMaterial(material,strain,{hardeningRatio=0.01,committedState=null}={}){
  if(!material)throw new Error('Material 1D: material ausente.');
  const type=String(material.type||'').toLowerCase();
  if(type!=='steel'&&type!=='rebar')throw new Error(`Material 1D: tipo "${material.type||'desconhecido'}" ainda não suportado pelo aço cinemático.`);
  const E=finite('E',material.E),fyMPa=Math.abs(finite('fy',material.fy));
  return bilinearSteelKinematicState({strain,E,fy:fyMPa*1000,hardeningRatio,committedState});
}

export const MATERIAL_1D_VERSION='0.21.0-exp';
