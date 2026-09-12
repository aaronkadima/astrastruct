const EPS=1e-15;

function finite(name,value){
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error(`Material 1D: ${name} deve ser finito.`);
  return n;
}

/**
 * Envelope monotônico bilinear simétrico para aço.
 *
 * As unidades são deliberadamente agnósticas, desde que E e fy sejam coerentes.
 * No modelo AstraStruct, E é armazenado em kN/m² e fy em MPa; use
 * bilinearSteelFromModelMaterial() para fazer a conversão de fy.
 *
 * Esta primeira versão NÃO implementa histórico, descarga, Bauschinger,
 * endurecimento cinemático/isotrópico cíclico ou dano.
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

export const MATERIAL_1D_VERSION='0.14.0-exp';
