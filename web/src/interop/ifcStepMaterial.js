import {validateIfcGuid} from './ifcGuid.js';
import {createIfcMaterialMapping,validateIfcMaterialMapping,summarizeIfcMaterialMapping} from './ifcMaterial.js';

export const IFC_STEP_MATERIAL_CONTRACT='ifc-step-material/v1';
export const IFC_STEP_MATERIAL_VERSION='0.47.0-exp';

const ref=id=>`#${id}`;
const refs=ids=>`(${ids.map(ref).join(',')})`;
const enumValue=v=>`.${String(v).trim().toUpperCase()}.`;
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC STEP material: ${name} deve ser finito.`);return n};
const num=(v,name)=>{const n=finite(v,name);if(Number.isInteger(n))return `${n}.`;let s=String(n);if(!/[.eE]/.test(s))s+='.';return s.replace('e','E')};

function spfString(value){
  const source=String(value??'');let out='';
  for(const ch of source){const cp=ch.codePointAt(0);if(cp>=32&&cp<=126&&ch!=="'"&&ch!=='\\')out+=ch;else if(ch==="'")out+="''";else{const units=[];for(let i=0;i<ch.length;i++)units.push(ch.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0'));out+=`\\X2\\${units.join('')}\\X0\\`;}}
  return `'${out}'`;
}

function optionalString(value){return value==null||value===''?'$':spfString(value)}
function getOrAdd(emitter,key,entityFactory){if(emitter.byKey.has(key))return emitter.id(key);return emitter.add(entityFactory(),key)}
function relationGuid(map,entry){return map?.[entry.memberKey]??map?.[entry.memberId]??null}

function emitMaterial(emitter,material){
  return getOrAdd(emitter,material.key,()=>`IFCMATERIAL(${spfString(material.name)},$,${optionalString(material.category)})`);
}

function emitMechanicalProperties(emitter,materialId,canonicalMaterial){
  const source=canonicalMaterial?.properties||{},propertyIds=[],materialKey=canonicalMaterial?.key||`material:${materialId}`;
  const add=(suffix,name,type,value)=>{
    if(value==null||value===''||!Number.isFinite(Number(value)))return;
    const n=Number(value);if((type==='IFCMODULUSOFELASTICITYMEASURE'||type==='IFCPOSITIVERATIOMEASURE')&&!(n>0))return;
    if(type==='IFCTHERMALEXPANSIONCOEFFICIENTMEASURE'&&n<0)return;
    propertyIds.push(getOrAdd(emitter,`step:material-property:${materialKey}:${suffix}`,()=>`IFCPROPERTYSINGLEVALUE(${spfString(name)},$,${type}(${num(n,name)}),$)`));
  };
  if(Number(source.E)>0)add('young','YoungModulus','IFCMODULUSOFELASTICITYMEASURE',Number(source.E)/1000);
  if(Number(source.G)>0)add('shear','ShearModulus','IFCMODULUSOFELASTICITYMEASURE',Number(source.G)/1000);
  if(source.nu!=null&&source.nu!==''&&Number(source.nu)>0)add('poisson','PoissonRatio','IFCPOSITIVERATIOMEASURE',Number(source.nu));
  if(source.alpha!=null&&source.alpha!==''&&Number.isFinite(Number(source.alpha)))add('thermal-expansion','ThermalExpansionCoefficient','IFCTHERMALEXPANSIONCOEFFICIENTMEASURE',Number(source.alpha));
  if(!propertyIds.length)return null;
  return getOrAdd(emitter,`step:material-properties:${materialKey}`,()=>`IFCMATERIALPROPERTIES(${spfString('Pset_MaterialMechanical')},$,${refs(propertyIds)},${ref(materialId)})`);
}

function emitStrengthProperties(emitter,materialId,canonicalMaterial){
  const source=canonicalMaterial?.properties||{},kind=String(source.type||canonicalMaterial?.category||'').trim().toLowerCase(),materialKey=canonicalMaterial?.key||`material:${materialId}`;
  const emitSet=(setName,items)=>{
    const propertyIds=[];
    for(const item of items){
      if(item.value==null||item.value===''||!Number.isFinite(Number(item.value))||!(Number(item.value)>0))continue;
      propertyIds.push(getOrAdd(emitter,`step:material-strength-property:${materialKey}:${item.suffix}`,()=>`IFCPROPERTYSINGLEVALUE(${spfString(item.name)},$,IFCPRESSUREMEASURE(${num(Number(item.value),item.name)}),$)`));
    }
    if(!propertyIds.length)return null;
    return getOrAdd(emitter,`step:material-strength:${materialKey}:${setName}`,()=>`IFCMATERIALPROPERTIES(${spfString(setName)},$,${refs(propertyIds)},${ref(materialId)})`);
  };
  if(kind==='steel'||kind==='rebar'){
    const fy=Number(source.fy),fu=Number(source.fu);
    if(fy>0&&fu>0&&fu<fy)throw new Error(`IFC STEP material: fu não pode ser menor que fy em ${canonicalMaterial?.sourceId||materialKey}.`);
    return emitSet('Pset_MaterialSteel',[{suffix:'yield',name:'YieldStress',value:source.fy},{suffix:'ultimate',name:'UltimateStress',value:source.fu}]);
  }
  if(kind==='concrete'||kind==='grout')return emitSet('Pset_MaterialConcrete',[{suffix:'compressive',name:'CompressiveStrength',value:source.fck}]);
  return null;
}

function emitProfile(emitter,entry){
  const p=entry.profile,key=`profile:${entry.section.sourceId}`;
  if(p.position)throw new Error(`IFC STEP material: Position explícita de perfil ainda não suportada em ${entry.memberId}.`);
  return getOrAdd(emitter,key,()=>{
    const head=`${enumValue(p.profileType)},${optionalString(p.profileName)},$`;
    if(p.ifcClass==='IfcRectangleProfileDef')return`IFCRECTANGLEPROFILEDEF(${head},${num(p.xDim,'xDim')},${num(p.yDim,'yDim')})`;
    if(p.ifcClass==='IfcCircleProfileDef')return`IFCCIRCLEPROFILEDEF(${head},${num(p.radius,'radius')})`;
    if(p.ifcClass==='IfcIShapeProfileDef')return`IFCISHAPEPROFILEDEF(${head},${num(p.overallWidth,'overallWidth')},${num(p.overallDepth,'overallDepth')},${num(p.webThickness,'webThickness')},${num(p.flangeThickness,'flangeThickness')},${p.filletRadius==null?'$':num(p.filletRadius,'filletRadius')},${p.flangeEdgeRadius==null?'$':num(p.flangeEdgeRadius,'flangeEdgeRadius')},${p.flangeSlope==null?'$':num(p.flangeSlope,'flangeSlope')})`;
    throw new Error(`IFC STEP material: perfil não suportado ${p.ifcClass}.`);
  });
}

function emitProfileUsage(emitter,entry,materialId){
  const profileId=emitProfile(emitter,entry);
  const materialProfileKey=`material-profile:${entry.memberId}`;
  const materialProfileId=getOrAdd(emitter,materialProfileKey,()=>`IFCMATERIALPROFILE(${optionalString(entry.materialProfile.name)},$,${ref(materialId)},${ref(profileId)},$,'LoadBearing')`);
  const setKey=`material-profile-set:${entry.memberId}`;
  const setId=getOrAdd(emitter,setKey,()=>`IFCMATERIALPROFILESET(${optionalString(entry.materialProfileSet.name)},$,${refs([materialProfileId])},$)`);
  const usageKey=`material-profile-usage:${entry.memberId}`;
  return getOrAdd(emitter,usageKey,()=>`IFCMATERIALPROFILESETUSAGE(${ref(setId)},${entry.usage.cardinalPoint??'$'},${entry.usage.referenceExtent==null?'$':num(entry.usage.referenceExtent,'ReferenceExtent')})`);
}

export function validateIfcStepMaterialReadiness(model,{materialAssociationGlobalIds={},allowPendingMaterials=false}={}){
  const mapping=createIfcMaterialMapping(model);validateIfcMaterialMapping(mapping);
  const summary=summarizeIfcMaterialMapping(mapping),allGuids=new Set();
  if(summary.pending&&!allowPendingMaterials){const pending=mapping.entries.filter(x=>x.status==='PENDING').map(x=>`${x.memberId}:${x.reason}`).join(', ');throw new Error(`IFC STEP material: mapeamentos PENDING impedem exportação: ${pending}.`)}
  for(const entry of mapping.entries.filter(x=>x.status==='READY')){
    if(entry.mode==='MATERIAL_PROFILE_SET'&&entry.profile?.position)throw new Error(`IFC STEP material: Position explícita de perfil ainda não suportada em ${entry.memberId}.`);
    const guid=relationGuid(materialAssociationGlobalIds,entry);if(!validateIfcGuid(guid))throw new Error(`IFC STEP material: GlobalId de IfcRelAssociatesMaterial obrigatório para ${entry.memberId}.`);
    if(allGuids.has(guid))throw new Error(`IFC STEP material: GlobalId duplicado ${guid}.`);allGuids.add(guid)}
  return{contract:IFC_STEP_MATERIAL_CONTRACT,version:IFC_STEP_MATERIAL_VERSION,mapping,summary,associationGlobalIds:[...allGuids]};
}

export function emitIfcStepMaterials(emitter,model,options={}){
  const ready=validateIfcStepMaterialReadiness(model,options),relationIds=[],ownerHistory=options.ownerHistoryId?ref(options.ownerHistoryId):'$',canonicalMaterials=new Map((model.materials||[]).map(m=>[m.key,m]));
  for(const entry of ready.mapping.entries){
    if(entry.status!=='READY')continue;
    const materialId=emitMaterial(emitter,entry.material),canonicalMaterial=canonicalMaterials.get(entry.material.key);emitMechanicalProperties(emitter,materialId,canonicalMaterial);emitStrengthProperties(emitter,materialId,canonicalMaterial);
    const relatingMaterialId=entry.mode==='DIRECT_MATERIAL'?materialId:emitProfileUsage(emitter,entry,materialId);
    const memberId=emitter.id(entry.memberKey),guid=relationGuid(options.materialAssociationGlobalIds,entry);
    relationIds.push(emitter.add(`IFCRELASSOCIATESMATERIAL(${spfString(guid)},${ownerHistory},$,$,(${ref(memberId)}),${ref(relatingMaterialId)})`,`step:material-rel:${entry.memberId}`));
  }
  return{...ready,relationIds};
}
