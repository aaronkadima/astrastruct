import { PRODUCT_VERSION } from './version.js';

export const INSPECTION_FIELD_CONTRACT='inspection-field/v1';

const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;

function normalizeSample(sample,index){
  const value=finite(sample?.value);
  if(value===null)throw new Error(`inspection-field/v1: amostra ${index} sem valor numérico finito.`);
  const out={...sample,index,value};
  for(const key of ['x','y','z','s','angle','depth']){
    if(sample?.[key]===undefined||sample?.[key]===null)delete out[key];
    else{const n=finite(sample[key]);if(n===null)throw new Error(`inspection-field/v1: coordenada ${key} inválida na amostra ${index}.`);out[key]=n}
  }
  if(sample?.active!==undefined)out.active=Boolean(sample.active);
  if(sample?.entityId!==undefined)out.entityId=String(sample.entityId);
  return out;
}

function deriveScale(samples,scale={}){
  const values=samples.map(s=>s.value),min=Math.min(...values),max=Math.max(...values),maxAbs=Math.max(Math.abs(min),Math.abs(max));
  const requestedMin=finite(scale?.min),requestedMax=finite(scale?.max),requestedMaxAbs=finite(scale?.maxAbs);
  return{
    min:requestedMin??min,
    max:requestedMax??max,
    maxAbs:requestedMaxAbs??maxAbs,
    symmetric:Boolean(scale?.symmetric),
    mode:String(scale?.mode||'linear')
  };
}

export function createInspectionField(input={}){
  const id=String(input.id||'').trim(),fieldType=String(input.fieldType||'').trim(),label=String(input.label||fieldType).trim(),unit=String(input.unit||'').trim();
  if(!id)throw new Error('inspection-field/v1: id obrigatório.');
  if(!fieldType)throw new Error(`inspection-field/v1: fieldType obrigatório em ${id}.`);
  if(!unit)throw new Error(`inspection-field/v1: unidade obrigatória em ${id}.`);
  if(!Array.isArray(input.samples)||!input.samples.length)throw new Error(`inspection-field/v1: ${id} requer ao menos uma amostra.`);
  const samples=input.samples.map(normalizeSample),geometry={kind:String(input.geometry?.kind||'points'),...(input.geometry||{})};
  return{
    contract:INSPECTION_FIELD_CONTRACT,
    id,fieldType,label,unit,geometry,samples,
    scale:deriveScale(samples,input.scale||{}),
    provenance:{productVersion:PRODUCT_VERSION,...(input.provenance||{})},
    meta:{...(input.meta||{})}
  };
}

export function validateInspectionField(field){
  if(!field||field.contract!==INSPECTION_FIELD_CONTRACT)throw new Error(`Contrato de campo incompatível: ${field?.contract||'ausente'}.`);
  const rebuilt=createInspectionField(field);
  if(rebuilt.samples.length!==field.samples.length)throw new Error('inspection-field/v1: contagem de amostras inconsistente.');
  return true;
}

export function inspectionFieldRange(field){
  validateInspectionField(field);
  const values=field.samples.map(s=>s.value);
  return{min:Math.min(...values),max:Math.max(...values),maxAbs:Math.max(...values.map(Math.abs))};
}

export function inspectionFieldCsv(field){
  validateInspectionField(field);
  const coordinateKeys=['entityId','x','y','z','s','angle','depth','active'];
  const extras=new Set();for(const sample of field.samples)for(const key of Object.keys(sample))if(!['index','value',...coordinateKeys].includes(key))extras.add(key);
  const keys=['index',...coordinateKeys.filter(k=>field.samples.some(s=>s[k]!==undefined)),'value',...extras];
  const cell=v=>v===undefined||v===null?'':String(v).includes(',')?`"${String(v).replaceAll('"','""')}"`:String(v);
  return [keys.join(','),...field.samples.map(s=>keys.map(k=>cell(s[k])).join(','))].join('\n');
}
