import {validateAstraStructIfcUnits} from './ifcMechanical.js';

export const IFC_MATERIAL_STRENGTH_CONTRACT='ifc-material-strength/v1';
export const IFC_MATERIAL_STRENGTH_VERSION='0.47.0-exp';

const refId=token=>token&&Number.isInteger(token.ref)?token.ref:null;
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC strength: ${name} deve ser finito.`);return n};

function entity(parsed,id,expectedType=null){
  const e=parsed?.entities?.get(Number(id));if(!e)throw new Error(`IFC strength: entidade #${id} ausente.`);
  if(expectedType&&e.type!==expectedType)throw new Error(`IFC strength: esperado ${expectedType} em #${id}, recebido ${e.type}.`);return e;
}
function pressure(token,name){
  if(!token||typeof token!=='object'||token.type!=='IFCPRESSUREMEASURE')throw new Error(`IFC strength: ${name} deve usar IFCPRESSUREMEASURE.`);
  const n=finite(token.value,name);if(!(n>0))throw new Error(`IFC strength: ${name} deve ser positivo.`);return n;
}
function recordFor(map,materialEntityId){
  if(!map.has(materialEntityId))map.set(materialEntityId,{materialEntityId,fy:null,fu:null,fck:null,steelPropertySetEntityId:null,concretePropertySetEntityId:null});
  return map.get(materialEntityId);
}

export function extractIfcStrengthMaterialProperties(parsed){
  const units=validateAstraStructIfcUnits(parsed),byMaterialEntityId=new Map();
  for(const set of parsed?.byType?.get('IFCMATERIALPROPERTIES')||[]){
    const setName=String(set.args?.[0]??'');
    if(setName!=='Pset_MaterialSteel'&&setName!=='Pset_MaterialConcrete')continue;
    const materialEntityId=refId(set.args?.[3]);if(!materialEntityId)throw new Error(`IFC strength: ${setName} #${set.id} sem material.`);
    entity(parsed,materialEntityId,'IFCMATERIAL');
    if(!Array.isArray(set.args?.[2]))throw new Error(`IFC strength: ${setName} #${set.id} sem lista de propriedades.`);
    const out=recordFor(byMaterialEntityId,materialEntityId),seen=new Set();
    if(setName==='Pset_MaterialSteel'){
      if(out.steelPropertySetEntityId)throw new Error(`IFC strength: Pset_MaterialSteel duplicado para IfcMaterial #${materialEntityId}.`);
      out.steelPropertySetEntityId=set.id;
    }else{
      if(out.concretePropertySetEntityId)throw new Error(`IFC strength: Pset_MaterialConcrete duplicado para IfcMaterial #${materialEntityId}.`);
      out.concretePropertySetEntityId=set.id;
    }
    for(const token of set.args[2]){
      const propertyId=refId(token);if(!propertyId)throw new Error(`IFC strength: propriedade sem referência em #${set.id}.`);
      const p=entity(parsed,propertyId,'IFCPROPERTYSINGLEVALUE'),name=String(p.args?.[0]??'');
      if(seen.has(name))throw new Error(`IFC strength: propriedade ${name} duplicada em ${setName} #${set.id}.`);seen.add(name);
      if(setName==='Pset_MaterialSteel'&&name==='YieldStress')out.fy=pressure(p.args?.[2],'YieldStress');
      else if(setName==='Pset_MaterialSteel'&&name==='UltimateStress')out.fu=pressure(p.args?.[2],'UltimateStress');
      else if(setName==='Pset_MaterialConcrete'&&name==='CompressiveStrength')out.fck=pressure(p.args?.[2],'CompressiveStrength');
    }
    if(out.fy!=null&&out.fu!=null&&out.fu<out.fy)throw new Error(`IFC strength: UltimateStress não pode ser menor que YieldStress em material #${materialEntityId}.`);
  }
  return{contract:IFC_MATERIAL_STRENGTH_CONTRACT,version:IFC_MATERIAL_STRENGTH_VERSION,unitSystem:units.unitSystem,byMaterialEntityId};
}
