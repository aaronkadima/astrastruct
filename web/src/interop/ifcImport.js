import {emptyProject} from '../core/model.js';
import {parseIfcStepEntities,parseIfcStructuralStep} from './ifcStepParse.js';

export const IFC_IMPORT_STAGING_CONTRACT='ifc-import-staging/v1';
export const IFC_IMPORT_STAGING_VERSION='0.46.0-exp';

const text=v=>String(v??'').trim();
const finite=v=>Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));

function entity(parsed,id,expectedType=null){
  const e=parsed.entities.get(Number(id));
  if(!e)throw new Error(`IFC import: entidade #${id} ausente.`);
  if(expectedType&&e.type!==expectedType)throw new Error(`IFC import: esperado ${expectedType} em #${id}, recebido ${e.type}.`);
  return e;
}

function refId(token){return token&&Number.isInteger(token.ref)?token.ref:null}
function enumValue(token){return token&&typeof token==='object'&&typeof token.enum==='string'?token.enum:null}
function typedValue(token,expectedType){
  if(!token||typeof token!=='object'||token.type!==expectedType)throw new Error(`IFC import: esperado ${expectedType}.`);
  return token.value;
}

function boolSelect(token){
  if(token==null)return false;
  if(token?.type==='IFCBOOLEAN'){
    const v=enumValue(token.value);if(v==='T')return true;if(v==='F')return false;
    throw new Error('IFC import: IfcBoolean inválido em boundary condition.');
  }
  if(token?.type==='IFCLINEARSTIFFNESSMEASURE'||token?.type==='IFCROTATIONALSTIFFNESSMEASURE'){
    const n=Number(token.value);if(!Number.isFinite(n)||n<0)throw new Error('IFC import: rigidez nodal deve ser finita e não negativa.');return n;
  }
  throw new Error(`IFC import: boundary select não suportado ${token?.type||typeof token}.`);
}

function uniqueId(preferred,prefix,index,used){
  const raw=text(preferred).replace(/[^A-Za-z0-9_.:-]+/g,'_').replace(/^_+|_+$/g,'');
  const base=raw||`${prefix}${index+1}`;let id=base,n=2;while(used.has(id))id=`${base}_${n++}`;used.add(id);return id;
}

function normalizeMaterialType(category){
  const c=text(category).toLowerCase();
  if(c.includes('steel')||c.includes('aço')||c.includes('aco'))return'steel';
  if(c.includes('concrete')||c.includes('concreto'))return'concrete';
  if(c.includes('rebar')||c.includes('reinforcement')||c.includes('armadura'))return'rebar';
  if(c.includes('grout')||c.includes('graute'))return'grout';
  return'imported';
}

function rectangleSection(profile,id,name){
  const x=Number(profile.args?.[3]),y=Number(profile.args?.[4]);
  if(!(x>0&&y>0))throw new Error(`IFC import: dimensões retangulares inválidas em ${id}.`);
  const a=x*y,iy=x*y**3/12,iz=y*x**3/12,m=Math.max(x,y),n=Math.min(x,y),beta=Math.max(0.01,1-0.63*n/m+0.052*(n/m)**5),j=m*n**3*beta/3;
  return{id,name,family:'rect',b:x,h:y,A:a,I:Math.max(iy,iz),Iy:iy,Iz:iz,J:j,verified:false,ifcProfile:{ifcClass:'IfcRectangleProfileDef',profileName:profile.args?.[1]??name,xDim:x,yDim:y}};
}
function circleSection(profile,id,name){
  const r=Number(profile.args?.[3]);if(!(r>0))throw new Error(`IFC import: raio circular inválido em ${id}.`);
  const a=Math.PI*r*r,i=Math.PI*r**4/4,j=2*i;
  return{id,name,family:'circle',d:2*r,A:a,I:i,Iy:i,Iz:i,J:j,verified:false,ifcProfile:{ifcClass:'IfcCircleProfileDef',profileName:profile.args?.[1]??name,radius:r}};
}
function iSection(profile,id,name){
  const b=Number(profile.args?.[3]),h=Number(profile.args?.[4]),tw=Number(profile.args?.[5]),tf=Number(profile.args?.[6]),r=profile.args?.[7]==null?null:Number(profile.args?.[7]);
  if(!(b>0&&h>0&&tw>0&&tf>0&&tw<b&&2*tf<h))throw new Error(`IFC import: dimensões I/H inválidas em ${id}.`);
  const hw=h-2*tf,a=2*b*tf+hw*tw,iy=(b*h**3-(b-tw)*hw**3)/12,iz=2*(tf*b**3/12)+hw*tw**3/12,j=(2*b*tf**3+hw*tw**3)/3;
  return{id,name,family:'i',b,h,tw,tf,...(r!=null&&Number.isFinite(r)?{r}:{}),A:a,I:iy,Iy:iy,Iz:iz,J:j,verified:false,ifcProfile:{ifcClass:'IfcIShapeProfileDef',profileName:profile.args?.[1]??name,overallWidth:b,overallDepth:h,webThickness:tw,flangeThickness:tf,...(r!=null&&Number.isFinite(r)?{filletRadius:r}:{})}};
}
function sectionFromProfile(profile,id,name){
  if(profile.type==='IFCRECTANGLEPROFILEDEF')return rectangleSection(profile,id,name);
  if(profile.type==='IFCCIRCLEPROFILEDEF')return circleSection(profile,id,name);
  if(profile.type==='IFCISHAPEPROFILEDEF')return iSection(profile,id,name);
  throw new Error(`IFC import: perfil ${profile.type} não suportado.`);
}

function boundaryState(generic,pointConnection){
  const boundaryId=refId(pointConnection.args?.[7]);if(!boundaryId)return null;
  const b=entity(generic,boundaryId,'IFCBOUNDARYNODECONDITION'),values=b.args.slice(1,7).map(boolSelect);
  if(values.length!==6)throw new Error('IFC import: IfcBoundaryNodeCondition deve possuir seis rigidezes.');
  return{entityId:b.id,name:b.args?.[0]??null,ux:values[0],uy:values[1],uz:values[2],rx:values[3],ry:values[4],rz:values[5]};
}

function curveElementType(generic,member,issues){
  const e=entity(generic,member.entityId,'IFCSTRUCTURALCURVEMEMBER'),predefined=enumValue(e.args?.[7]);
  if(predefined==='PIN_JOINED_MEMBER')return{type:'truss3d',predefinedType:predefined};
  if(predefined==='RIGID_JOINED_MEMBER')return{type:'frame3d',predefinedType:predefined};
  issues.push({severity:'BLOCKING',code:'CURVE_PREDEFINED_TYPE_UNSUPPORTED',entityId:member.entityId,message:`IfcStructuralCurveMember #${member.entityId} possui PredefinedType ${predefined||'ausente'}, sem mapeamento estrutural seguro.`});
  return{type:null,predefinedType:predefined};
}

function surfaceElementType(member,issues){
  const predefined=text(member.predefinedType).toUpperCase();
  if(['SHELL','BENDING_ELEMENT','MEMBRANE_ELEMENT'].includes(predefined))return'shell4';
  issues.push({severity:'BLOCKING',code:'SURFACE_PREDEFINED_TYPE_UNSUPPORTED',entityId:member.entityId,message:`IfcStructuralSurfaceMember #${member.entityId} possui PredefinedType ${predefined||'ausente'}, sem mapeamento seguro.`});
  return null;
}

function materialAndSectionMaps(parsed,usedMaterialIds,usedSectionIds,issues){
  const materialByEntity=new Map(),sectionByProfileEntity=new Map(),relationByMemberEntity=new Map(),materials=[],sections=[];
  for(const rel of parsed.materials||[]){
    let materialId=materialByEntity.get(rel.material.entityId);
    if(!materialId){
      materialId=uniqueId(rel.material.name,'MAT',materials.length,usedMaterialIds);materialByEntity.set(rel.material.entityId,materialId);
      materials.push({id:materialId,name:text(rel.material.name)||materialId,type:normalizeMaterialType(rel.material.category),E:null,nu:null,G:null,density:null,alpha:null,verified:false,analysisReady:false,ifc:{entityId:rel.material.entityId,category:rel.material.category??null}});
    }
    let sectionId=null;
    if(rel.mode==='MATERIAL_PROFILE_SET'&&rel.profile){
      sectionId=sectionByProfileEntity.get(rel.profile.entityId)||null;
      if(!sectionId){
        sectionId=uniqueId(rel.profile.args?.[1]||`IFC profile ${rel.profile.entityId}`,'SEC',sections.length,usedSectionIds);
        try{sections.push({...sectionFromProfile(rel.profile,sectionId,text(rel.profile.args?.[1])||sectionId),ifc:{entityId:rel.profile.entityId,mode:rel.mode,cardinalPoint:rel.cardinalPoint??null}});sectionByProfileEntity.set(rel.profile.entityId,sectionId)}
        catch(err){issues.push({severity:'BLOCKING',code:'PROFILE_INVALID',entityId:rel.profile.entityId,message:err?.message||String(err)});sectionId=null}
      }
    }
    for(const memberEntityId of rel.relatedEntityIds||[])relationByMemberEntity.set(memberEntityId,{rel,materialId,sectionId});
  }
  return{materials,sections,relationByMemberEntity};
}

function mechanicalIssues(project){
  const issues=[];const matById=new Map(project.materials.map(m=>[m.id,m])),secById=new Map(project.sections.map(s=>[s.id,s]));
  for(const e of project.elements){
    const m=matById.get(e.materialId),s=secById.get(e.sectionId);
    if(!m){issues.push({severity:'BLOCKING',code:'MATERIAL_MISSING',elementId:e.id,message:`Elemento ${e.id} sem material IFC associado.`});continue}
    if(!positive(m.E))issues.push({severity:'BLOCKING',code:'YOUNG_MODULUS_MISSING',elementId:e.id,materialId:m.id,message:`Material ${m.id} não possui módulo de Young validado.`});
    if(e.type==='frame3d'&&!positive(m.G)&&!finite(m.nu))issues.push({severity:'BLOCKING',code:'SHEAR_MODULUS_MISSING',elementId:e.id,materialId:m.id,message:`Material ${m.id} requer G ou ν para frame3d.`});
    if(e.type==='shell4'&&!finite(m.nu))issues.push({severity:'BLOCKING',code:'POISSON_RATIO_MISSING',elementId:e.id,materialId:m.id,message:`Material ${m.id} requer ν para shell4.`});
    if(!s){issues.push({severity:'BLOCKING',code:'SECTION_MISSING',elementId:e.id,message:`Elemento ${e.id} sem seção IFC utilizável.`});continue}
    if(e.type==='truss3d'&&!positive(s.A))issues.push({severity:'BLOCKING',code:'SECTION_AREA_MISSING',elementId:e.id,sectionId:s.id,message:`Seção ${s.id} requer A positivo.`});
    if(e.type==='frame3d'&&(!positive(s.A)||!positive(s.Iy)||!positive(s.Iz)||!positive(s.J)))issues.push({severity:'BLOCKING',code:'FRAME_SECTION_PROPERTIES_MISSING',elementId:e.id,sectionId:s.id,message:`Seção ${s.id} requer A, Iy, Iz e J positivos.`});
    if(e.type==='shell4'&&!positive(e.thickness??s.t??s.thickness))issues.push({severity:'BLOCKING',code:'SURFACE_THICKNESS_MISSING',elementId:e.id,sectionId:s.id,message:`Superfície ${e.id} requer espessura positiva.`});
  }
  return issues;
}

export function createIfcImportStaging(step,{projectId=null,projectName=null}={}){
  const parsed=parseIfcStructuralStep(step),generic=parseIfcStepEntities(step),issues=[],usedNodeIds=new Set(),usedElementIds=new Set(),usedMaterialIds=new Set(),usedSectionIds=new Set();
  const project=emptyProject();
  project.id=text(projectId)||`IFC_${parsed.project.globalId}`;project.name=text(projectName)||text(parsed.project.name)||'Projeto importado IFC';
  project.nodes=[];project.elements=[];project.materials=[];project.sections=[];project.supports=[];project.nodeSprings=[];project.loads=[];project.elementLoads=[];project.settlements=[];project.nodalMasses=[];project.results=null;

  const nodeIdByGuid=new Map();
  for(const [i,n] of parsed.nodes.entries()){
    const id=uniqueId(n.name,'N',i,usedNodeIds);nodeIdByGuid.set(n.globalId,id);
    project.nodes.push({id,name:text(n.name)||id,x:Number(n.coordinates[0]),y:Number(n.coordinates[1]),z:Number(n.coordinates[2]),ifcGlobalId:n.globalId,ifcEntityId:n.entityId});
    const pointConnection=entity(generic,n.entityId,'IFCSTRUCTURALPOINTCONNECTION'),boundary=boundaryState(generic,pointConnection);
    if(boundary){
      const fields=['ux','uy','uz','rx','ry','rz'],support={id:`SUP_${id}`,nodeId:id},spring={id:`SPR_${id}`,nodeId:id,kx:0,ky:0,kz:0,krx:0,kry:0,krz:0};let hasSupport=false,hasSpring=false;
      for(const [idx,key] of fields.entries()){
        const v=boundary[key];if(v===true){support[key]=true;hasSupport=true}else support[key]=false;
        if(typeof v==='number'&&v>0){const sk=['kx','ky','kz','krx','kry','krz'][idx];spring[sk]=v;hasSpring=true}
      }
      if(hasSupport)project.supports.push(support);if(hasSpring)project.nodeSprings.push(spring);
    }
  }

  const mapped=materialAndSectionMaps(parsed,usedMaterialIds,usedSectionIds,issues);project.materials=mapped.materials;project.sections=mapped.sections;
  for(const [i,m] of parsed.members.entries()){
    const id=uniqueId(m.name,'E',i,usedElementIds),nodeIds=(m.nodeGlobalIds||[]).map(g=>nodeIdByGuid.get(g));
    if(nodeIds.some(x=>!x)){issues.push({severity:'BLOCKING',code:'MEMBER_NODE_UNRESOLVED',entityId:m.entityId,message:`Membro #${m.entityId} referencia nó não resolvido.`});continue}
    const relation=mapped.relationByMemberEntity.get(m.entityId)||null;let type=null,predefinedType=null;
    if(m.type==='curve'){const mappedType=curveElementType(generic,m,issues);type=mappedType.type;predefinedType=mappedType.predefinedType;if(nodeIds.length!==2)issues.push({severity:'BLOCKING',code:'CURVE_NODE_COUNT_UNSUPPORTED',entityId:m.entityId,message:`Membro de curva #${m.entityId} requer exatamente 2 nós no AstraStruct.`})}
    else{type=surfaceElementType(m,issues);predefinedType=m.predefinedType;if(nodeIds.length!==4)issues.push({severity:'BLOCKING',code:'SURFACE_NODE_COUNT_UNSUPPORTED',entityId:m.entityId,message:`Superfície #${m.entityId} possui ${nodeIds.length} nós; o solver atual requer shell4 com exatamente 4 nós.`})}
    if(!type)continue;
    let sectionId=relation?.sectionId||null;
    if(type==='shell4'){
      const thickness=Number(m.thickness);if(thickness>0){sectionId=uniqueId(`${id}_shell`,'SEC',project.sections.length,usedSectionIds);project.sections.push({id:sectionId,name:`${text(m.name)||id} — shell`,family:'shell',t:thickness,thickness,verified:false,ifc:{memberEntityId:m.entityId,predefinedType}})}
    }
    if((type==='frame3d'||type==='truss3d')&&!sectionId)issues.push({severity:'BLOCKING',code:'PROFILE_MISSING',entityId:m.entityId,message:`Membro ${id} não possui perfil IFC suportado.`});
    const element={id,name:text(m.name)||id,type,materialId:relation?.materialId||null,sectionId,ifcGlobalId:m.globalId,ifcEntityId:m.entityId,ifcPredefinedType:predefinedType};
    if(type==='shell4'){element.nodeIds=nodeIds;element.n1=nodeIds[0];element.n2=nodeIds[1];element.n3=nodeIds[2];element.n4=nodeIds[3];if(Number(m.thickness)>0)element.thickness=Number(m.thickness)}else{element.n1=nodeIds[0];element.n2=nodeIds[1]}
    project.elements.push(element);
  }

  const geometryIssues=issues.filter(x=>x.severity==='BLOCKING'),analysisIssues=[...geometryIssues,...mechanicalIssues(project)];
  const geometryReady=geometryIssues.length===0,analysisReady=analysisIssues.length===0;
  project.meta={...project.meta,importedFrom:{format:'IFC',schema:parsed.schema,contract:IFC_IMPORT_STAGING_CONTRACT,parserVersion:parsed.parserVersion,projectGlobalId:parsed.project.globalId,analysisModelGlobalId:parsed.analysisModel.globalId},analysisReady,importStatus:analysisReady?'READY':'PENDING'};
  project.ifcImport={contract:IFC_IMPORT_STAGING_CONTRACT,version:IFC_IMPORT_STAGING_VERSION,projectGlobalId:parsed.project.globalId,analysisModelGlobalId:parsed.analysisModel.globalId,owner:copy(parsed.owner),geometryReady,analysisReady};
  return{contract:IFC_IMPORT_STAGING_CONTRACT,version:IFC_IMPORT_STAGING_VERSION,schema:parsed.schema,project,parsed,readiness:{geometryReady,analysisReady,geometryIssues,analysisIssues},summary:{nodes:project.nodes.length,elements:project.elements.length,curves:project.elements.filter(x=>x.type==='frame3d'||x.type==='truss3d').length,surfaces:project.elements.filter(x=>x.type==='shell4').length,materials:project.materials.length,sections:project.sections.length,supports:project.supports.length,nodeSprings:project.nodeSprings.length,geometryBlocking:geometryIssues.length,analysisBlocking:analysisIssues.length}};
}

export function validateIfcImportStaging(staging,{requireAnalysisReady=false}={}){
  if(staging?.contract!==IFC_IMPORT_STAGING_CONTRACT||staging?.version!==IFC_IMPORT_STAGING_VERSION)throw new Error('IFC import: staging incompatível.');
  if(!staging?.readiness?.geometryReady)throw new Error(`IFC import: geometria possui ${staging?.readiness?.geometryIssues?.length||0} bloqueio(s).`);
  if(requireAnalysisReady&&!staging?.readiness?.analysisReady)throw new Error(`IFC import: análise possui ${staging?.readiness?.analysisIssues?.length||0} pendência(s).`);
  return true;
}

export function summarizeIfcImportStaging(staging){
  if(staging?.contract!==IFC_IMPORT_STAGING_CONTRACT)throw new Error('IFC import: staging inválido.');
  return{...staging.summary,schema:staging.schema,geometryReady:!!staging.readiness?.geometryReady,analysisReady:!!staging.readiness?.analysisReady};
}
