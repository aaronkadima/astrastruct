export const IFC_MATERIAL_MAPPING_CONTRACT='ifc-material-mapping/v1';
export const IFC_MATERIAL_MAPPING_VERSION='0.45.0-exp';

const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').trim();
const finitePositive=(v,name)=>{const n=Number(v);if(!Number.isFinite(n)||!(n>0))throw new Error(`IFC material: ${name} deve ser positivo.`);return n};
const finiteNonNegative=(v,name)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(`IFC material: ${name} deve ser não negativo.`);return n};
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC material: ${name} deve ser finito.`);return n};

const PROFILE_SCHEMAS={
  IfcRectangleProfileDef:['xDim','yDim'],
  IfcCircleProfileDef:['radius'],
  IfcIShapeProfileDef:['overallWidth','overallDepth','webThickness','flangeThickness']
};

function materialByKey(model){return new Map((model?.materials||[]).map(m=>[m.key,m]))}
function sectionByKey(model){return new Map((model?.sections||[]).map(s=>[s.key,s]))}

export function validateExplicitIfcProfile(profile){
  if(!profile||typeof profile!=='object')throw new Error('IFC material: ifcProfile deve ser objeto.');
  const ifcClass=text(profile.ifcClass),required=PROFILE_SCHEMAS[ifcClass];
  if(!required)throw new Error(`IFC material: perfil explícito não suportado: ${ifcClass||'(vazio)'}.`);
  const normalized={ifcClass,profileType:text(profile.profileType)||'AREA',profileName:text(profile.profileName)||null,position:copy(profile.position||null)};
  if(!['AREA','CURVE'].includes(normalized.profileType.toUpperCase()))throw new Error(`IFC material: ProfileType inválido ${normalized.profileType}.`);
  normalized.profileType=normalized.profileType.toUpperCase();
  for(const key of required)normalized[key]=finitePositive(profile[key],`${ifcClass}.${key}`);
  if(profile.filletRadius!=null)normalized.filletRadius=finiteNonNegative(profile.filletRadius,`${ifcClass}.filletRadius`);
  if(profile.flangeEdgeRadius!=null)normalized.flangeEdgeRadius=finiteNonNegative(profile.flangeEdgeRadius,`${ifcClass}.flangeEdgeRadius`);
  if(profile.flangeSlope!=null)normalized.flangeSlope=finite(profile.flangeSlope,`${ifcClass}.flangeSlope`);
  if(ifcClass==='IfcIShapeProfileDef'){
    if(!(normalized.webThickness<normalized.overallWidth))throw new Error('IFC material: IfcIShapeProfileDef.webThickness deve ser menor que overallWidth.');
    if(!((2*normalized.flangeThickness)<normalized.overallDepth))throw new Error('IFC material: 2*IfcIShapeProfileDef.flangeThickness deve ser menor que overallDepth.');
    if(normalized.filletRadius!=null){
      const maxWidth=(normalized.overallWidth-normalized.webThickness)/2;
      const maxDepth=(normalized.overallDepth-2*normalized.flangeThickness)/2;
      if(normalized.filletRadius>maxWidth||normalized.filletRadius>maxDepth)throw new Error('IFC material: IfcIShapeProfileDef.filletRadius excede a geometria disponível.');
    }
  }
  return normalized;
}

function surfaceThickness(member,section){
  const raw=member?.properties?.thickness??member?.properties?.t??section?.properties?.thickness??section?.properties?.t??null;
  if(raw==null||raw==='')return null;
  return finitePositive(raw,`espessura ${member.sourceId}`);
}

function directSurfaceMapping(member,material,section){
  return{
    memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'READY',mode:'DIRECT_MATERIAL',
    material:{key:material.key,ifcClass:'IfcMaterial',sourceId:material.sourceId,name:text(material.name)||material.sourceId,category:text(material.category)||null},
    thickness:surfaceThickness(member,section),
    relationship:{ifcClass:'IfcRelAssociatesMaterial',relatedObjectRef:member.key,relatingMaterialRef:material.key},
    note:'Superfície homogênea: material mínimo associado diretamente; espessura permanece no IfcStructuralSurfaceMember.'
  };
}

function curveProfileMapping(member,material,section){
  if(!section)return{
    memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'PENDING',mode:'MATERIAL_PROFILE_SET',reason:'SECTION_MISSING',
    materialRef:material.key,note:'Membro linear requer seção para material profile set.'
  };
  const explicit=section?.properties?.ifcProfile??section?.ifcProfile??null;
  if(!explicit)return{
    memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'PENDING',mode:'MATERIAL_PROFILE_SET',reason:'IFC_PROFILE_MISSING',
    materialRef:material.key,sectionRef:section.key,
    note:'AstraStruct não infere geometria de IfcProfileDef a partir apenas de A/I/J. Forneça section.ifcProfile explicitamente.'
  };
  const profile=validateExplicitIfcProfile(explicit);
  return{
    memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'READY',mode:'MATERIAL_PROFILE_SET',
    material:{key:material.key,ifcClass:'IfcMaterial',sourceId:material.sourceId,name:text(material.name)||material.sourceId,category:text(material.category)||null},
    section:{key:section.key,sourceId:section.sourceId,name:text(section.name)||section.sourceId},profile,
    materialProfile:{ifcClass:'IfcMaterialProfile',name:text(section.name)||section.sourceId,materialRef:material.key,profileRef:`profile:${section.sourceId}`},
    materialProfileSet:{ifcClass:'IfcMaterialProfileSet',name:text(section.name)||section.sourceId,materialProfileRefs:[`material-profile:${member.sourceId}`]},
    usage:{ifcClass:'IfcMaterialProfileSetUsage',cardinalPoint:10,forProfileSetRef:`material-profile-set:${member.sourceId}`,referenceExtent:null},
    relationship:{ifcClass:'IfcRelAssociatesMaterial',relatedObjectRef:member.key,relatingMaterialRef:`material-profile-usage:${member.sourceId}`},
    note:'Perfil explícito aceito; cardinal point 10 representa o centroide geométrico do perfil.'
  };
}

export function createIfcMaterialMapping(model={}){
  const materials=materialByKey(model),sections=sectionByKey(model),entries=[];
  for(const member of model.members||[]){
    const material=member.materialRef?materials.get(member.materialRef):null,section=member.sectionRef?sections.get(member.sectionRef):null;
    if(!member.materialRef){entries.push({memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'PENDING',mode:null,reason:'MATERIAL_MISSING',note:'Nenhum material foi associado ao membro no modelo de origem.'});continue}
    if(!material)throw new Error(`IFC material: ${member.sourceId} referencia material inexistente ${member.materialRef}.`);
    if(member.ifcClass==='IfcStructuralSurfaceMember')entries.push(directSurfaceMapping(member,material,section));
    else if(member.ifcClass==='IfcStructuralCurveMember')entries.push(curveProfileMapping(member,material,section));
    else entries.push({memberKey:member.key,memberId:member.sourceId,memberClass:member.ifcClass,status:'PENDING',mode:null,reason:'MEMBER_CLASS_UNSUPPORTED'});
  }
  const mapping={contract:IFC_MATERIAL_MAPPING_CONTRACT,version:IFC_MATERIAL_MAPPING_VERSION,schema:model.schema??null,entries};
  validateIfcMaterialMapping(mapping);return mapping;
}

export function validateIfcMaterialMapping(mapping){
  if(mapping?.contract!==IFC_MATERIAL_MAPPING_CONTRACT)throw new Error('IFC material: contrato inválido.');
  if(mapping?.version!==IFC_MATERIAL_MAPPING_VERSION)throw new Error('IFC material: versão incompatível.');
  const seen=new Set();
  for(const entry of mapping.entries||[]){
    if(!entry.memberKey||seen.has(entry.memberKey))throw new Error(`IFC material: memberKey inválida/duplicada ${entry.memberKey}.`);seen.add(entry.memberKey);
    if(!['READY','PENDING'].includes(entry.status))throw new Error(`IFC material: status inválido em ${entry.memberId}.`);
    if(entry.status==='READY'&&entry.mode==='DIRECT_MATERIAL'){
      if(entry.memberClass!=='IfcStructuralSurfaceMember'||entry.material?.ifcClass!=='IfcMaterial'||entry.relationship?.ifcClass!=='IfcRelAssociatesMaterial')throw new Error(`IFC material: associação direta inválida em ${entry.memberId}.`);
      if(entry.thickness!=null&&!(Number(entry.thickness)>0))throw new Error(`IFC material: espessura inválida em ${entry.memberId}.`);
    }
    if(entry.status==='READY'&&entry.mode==='MATERIAL_PROFILE_SET'){
      if(entry.memberClass!=='IfcStructuralCurveMember')throw new Error(`IFC material: profile set aplicado a membro não linear ${entry.memberId}.`);
      validateExplicitIfcProfile(entry.profile);
      if(entry.materialProfile?.ifcClass!=='IfcMaterialProfile'||entry.materialProfileSet?.ifcClass!=='IfcMaterialProfileSet'||entry.usage?.ifcClass!=='IfcMaterialProfileSetUsage'||entry.relationship?.ifcClass!=='IfcRelAssociatesMaterial')throw new Error(`IFC material: material profile set incompleto em ${entry.memberId}.`);
    }
    if(entry.status==='PENDING'&&!entry.reason)throw new Error(`IFC material: PENDING sem reason em ${entry.memberId}.`);
  }
  return true;
}

export function summarizeIfcMaterialMapping(mapping){
  validateIfcMaterialMapping(mapping);const summary={total:0,ready:0,pending:0,directMaterial:0,profileSet:0,reasons:{}};
  for(const entry of mapping.entries){summary.total++;if(entry.status==='READY')summary.ready++;else summary.pending++;if(entry.mode==='DIRECT_MATERIAL'&&entry.status==='READY')summary.directMaterial++;if(entry.mode==='MATERIAL_PROFILE_SET'&&entry.status==='READY')summary.profileSet++;if(entry.reason)summary.reasons[entry.reason]=(summary.reasons[entry.reason]||0)+1}
  return summary;
}
