export const IFC_MECHANICAL_EXCHANGE_CONTRACT='ifc-mechanical-exchange/v1';
export const IFC_MECHANICAL_EXCHANGE_VERSION='0.46.0-exp';

const enumValue=token=>token&&typeof token==='object'&&typeof token.enum==='string'?token.enum:null;
const refId=token=>token&&Number.isInteger(token.ref)?token.ref:null;
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC mechanical: ${name} deve ser finito.`);return n};

function entity(parsed,id,expectedType=null){
  const e=parsed?.entities?.get(Number(id));if(!e)throw new Error(`IFC mechanical: entidade #${id} ausente.`);
  if(expectedType&&e.type!==expectedType)throw new Error(`IFC mechanical: esperado ${expectedType} em #${id}, recebido ${e.type}.`);return e;
}
function typed(token,type,name){
  if(!token||typeof token!=='object'||token.type!==type)throw new Error(`IFC mechanical: ${name} deve usar ${type}.`);
  return finite(token.value,name);
}
function siUnit(parsed,unitType){
  const matches=(parsed?.byType?.get('IFCSIUNIT')||[]).filter(e=>enumValue(e.args?.[1])===unitType);
  if(matches.length!==1)throw new Error(`IFC mechanical: esperado exatamente um IfcSIUnit ${unitType}; encontrados ${matches.length}.`);
  return matches[0];
}
function assertSi(parsed,unitType,{prefix=null,name}){
  const e=siUnit(parsed,unitType),actualPrefix=enumValue(e.args?.[2]),actualName=enumValue(e.args?.[3]);
  if(actualPrefix!==prefix||actualName!==name)throw new Error(`IFC mechanical: ${unitType} não suportado; esperado ${prefix?prefix+' ':''}${name}, recebido ${actualPrefix?actualPrefix+' ':''}${actualName||'ausente'}.`);
}

export function validateAstraStructIfcUnits(parsed){
  assertSi(parsed,'LENGTHUNIT',{prefix:null,name:'METRE'});
  assertSi(parsed,'FORCEUNIT',{prefix:'KILO',name:'NEWTON'});
  assertSi(parsed,'PRESSUREUNIT',{prefix:'MEGA',name:'PASCAL'});
  assertSi(parsed,'PLANEANGLEUNIT',{prefix:null,name:'RADIAN'});
  return{contract:IFC_MECHANICAL_EXCHANGE_CONTRACT,version:IFC_MECHANICAL_EXCHANGE_VERSION,unitSystem:'kN-m-MPa'};
}

export function extractIfcMechanicalMaterialProperties(parsed){
  validateAstraStructIfcUnits(parsed);
  const byMaterialEntityId=new Map();
  for(const set of parsed?.byType?.get('IFCMATERIALPROPERTIES')||[]){
    if(set.args?.[0]!=='Pset_MaterialMechanical')continue;
    if(!Array.isArray(set.args?.[2])||!set.args[2].length)throw new Error(`IFC mechanical: Pset_MaterialMechanical #${set.id} sem propriedades.`);
    const materialEntityId=refId(set.args?.[3]);if(!materialEntityId)throw new Error(`IFC mechanical: Pset_MaterialMechanical #${set.id} sem material.`);
    entity(parsed,materialEntityId,'IFCMATERIAL');
    if(byMaterialEntityId.has(materialEntityId))throw new Error(`IFC mechanical: Pset_MaterialMechanical duplicado para IfcMaterial #${materialEntityId}.`);
    const out={materialEntityId,propertySetEntityId:set.id,E:null,G:null,nu:null,alpha:null};
    for(const token of set.args[2]){
      const propertyId=refId(token);if(!propertyId)throw new Error(`IFC mechanical: propriedade sem referência em #${set.id}.`);
      const p=entity(parsed,propertyId,'IFCPROPERTYSINGLEVALUE'),name=String(p.args?.[0]??'');
      if(name==='YoungModulus')out.E=typed(p.args?.[2],'IFCMODULUSOFELASTICITYMEASURE','YoungModulus')*1000;
      else if(name==='ShearModulus')out.G=typed(p.args?.[2],'IFCMODULUSOFELASTICITYMEASURE','ShearModulus')*1000;
      else if(name==='PoissonRatio')out.nu=typed(p.args?.[2],'IFCPOSITIVERATIOMEASURE','PoissonRatio');
      else if(name==='ThermalExpansionCoefficient')out.alpha=typed(p.args?.[2],'IFCTHERMALEXPANSIONCOEFFICIENTMEASURE','ThermalExpansionCoefficient');
    }
    if(out.E!=null&&!(out.E>0))throw new Error(`IFC mechanical: YoungModulus deve ser positivo em material #${materialEntityId}.`);
    if(out.G!=null&&!(out.G>0))throw new Error(`IFC mechanical: ShearModulus deve ser positivo em material #${materialEntityId}.`);
    if(out.nu!=null&&!(out.nu>0))throw new Error(`IFC mechanical: PoissonRatio deve ser positivo em material #${materialEntityId}.`);
    byMaterialEntityId.set(materialEntityId,out);
  }
  return{contract:IFC_MECHANICAL_EXCHANGE_CONTRACT,version:IFC_MECHANICAL_EXCHANGE_VERSION,unitSystem:'kN-m-MPa',byMaterialEntityId};
}
