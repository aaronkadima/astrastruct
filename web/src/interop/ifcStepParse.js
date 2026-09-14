import {validateIfcGuid} from './ifcGuid.js';
import {IFC_SCHEMA} from './ifc.js';

export const IFC_STEP_PARSER_CONTRACT='ifc-step-parser/v1';
export const IFC_STEP_PARSER_VERSION='0.45.0-exp';

function splitTopLevel(source){
  const parts=[];let start=0,depth=0,inString=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(inString){if(ch==="'"&&source[i+1]==="'"){i++;continue}if(ch==="'")inString=false;continue}
    if(ch==="'"){inString=true;continue}if(ch==='(')depth++;else if(ch===')')depth--;else if(ch===','&&depth===0){parts.push(source.slice(start,i).trim());start=i+1}
    if(depth<0)throw new Error('IFC STEP parser: parênteses desbalanceados.');
  }
  if(inString||depth!==0)throw new Error('IFC STEP parser: expressão incompleta.');parts.push(source.slice(start).trim());return parts;
}

function decodeSpfString(token){
  let body=token.slice(1,-1).replace(/''/g,"'");
  body=body.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g,(_,hex)=>{let out='';for(let i=0;i<hex.length;i+=4)out+=String.fromCharCode(parseInt(hex.slice(i,i+4),16));return out});
  return body;
}

function parseToken(token){
  const t=token.trim();if(t==='$'||t==='*')return null;
  if(/^#\d+$/.test(t))return{ref:Number(t.slice(1))};
  if(/^'.*'$/s.test(t))return decodeSpfString(t);
  if(/^\.[A-Z0-9_]+\.$/.test(t))return{enum:t.slice(1,-1)};
  if(t.startsWith('(')&&t.endsWith(')')){const inner=t.slice(1,-1).trim();return inner?splitTopLevel(inner).map(parseToken):[]}
  const typed=t.match(/^([A-Z][A-Z0-9_]*)\((.*)\)$/s);if(typed)return{type:typed[1],value:parseToken(typed[2])};
  if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(t))return Number(t);
  throw new Error(`IFC STEP parser: token não suportado ${t}.`);
}

export function parseIfcStepEntities(step){
  const text=String(step||'');if(!text.startsWith('ISO-10303-21;'))throw new Error('IFC STEP parser: envelope ISO-10303-21 ausente.');
  if(!text.includes(`FILE_SCHEMA(('${IFC_SCHEMA}'));`))throw new Error(`IFC STEP parser: schema deve ser ${IFC_SCHEMA}.`);
  const entities=new Map(),byType=new Map();
  for(const line of text.split(/\r?\n/)){
    if(!line.startsWith('#'))continue;
    const match=line.match(/^#(\d+)=([A-Z][A-Z0-9_]*)\((.*)\);$/s);if(!match)throw new Error(`IFC STEP parser: entidade inválida: ${line.slice(0,120)}.`);
    const id=Number(match[1]),type=match[2];if(entities.has(id))throw new Error(`IFC STEP parser: id duplicado #${id}.`);
    const rawArgs=splitTopLevel(match[3]),args=rawArgs.map(parseToken),entity={id,type,args,rawArgs};entities.set(id,entity);
    if(!byType.has(type))byType.set(type,[]);byType.get(type).push(entity);
  }
  if(!entities.size)throw new Error('IFC STEP parser: nenhuma entidade DATA encontrada.');
  for(const entity of entities.values())for(const token of entity.args)walkRefs(token,id=>{if(!entities.has(id))throw new Error(`IFC STEP parser: #${entity.id} referencia #${id} inexistente.`)});
  return{contract:IFC_STEP_PARSER_CONTRACT,version:IFC_STEP_PARSER_VERSION,schema:IFC_SCHEMA,entities,byType};
}

function walkRefs(token,visit){if(token&&typeof token==='object'){if(Number.isInteger(token.ref))visit(token.ref);else if(Array.isArray(token))for(const x of token)walkRefs(x,visit);else if('value'in token)walkRefs(token.value,visit)}}
function one(parsed,type){const list=parsed.byType.get(type)||[];if(list.length!==1)throw new Error(`IFC STEP parser: esperado exatamente um ${type}; encontrados ${list.length}.`);return list[0]}
function entity(parsed,token,expectedType=null){if(!token||!Number.isInteger(token.ref))throw new Error('IFC STEP parser: referência esperada.');const e=parsed.entities.get(token.ref);if(!e)throw new Error(`IFC STEP parser: #${token.ref} ausente.`);if(expectedType&&e.type!==expectedType)throw new Error(`IFC STEP parser: esperado ${expectedType}, recebido ${e.type}.`);return e}
function list(token){if(!Array.isArray(token))throw new Error('IFC STEP parser: lista esperada.');return token}
function string(token,name){if(typeof token!=='string')throw new Error(`IFC STEP parser: string esperada em ${name}.`);return token}
function number(token,name){if(!Number.isFinite(token))throw new Error(`IFC STEP parser: número esperado em ${name}.`);return token}

function productPoint(parsed,pointConnection){
  const shape=entity(parsed,pointConnection.args[6],'IFCPRODUCTDEFINITIONSHAPE'),reps=list(shape.args[2]);if(reps.length!==1)throw new Error('IFC STEP parser: point connection deve possuir uma representação.');
  const topology=entity(parsed,reps[0],'IFCTOPOLOGYREPRESENTATION');if(string(topology.args[2],'RepresentationType')!=='Vertex')throw new Error('IFC STEP parser: point connection sem topologia Vertex.');
  const items=list(topology.args[3]);if(items.length!==1)throw new Error('IFC STEP parser: Vertex topology deve possuir um item.');
  const vertex=entity(parsed,items[0],'IFCVERTEXPOINT'),point=entity(parsed,vertex.args[0],'IFCCARTESIANPOINT'),coords=list(point.args[0]).map((x,i)=>number(x,`Coordinates[${i}]`));
  if(coords.length!==3)throw new Error('IFC STEP parser: nó estrutural deve possuir três coordenadas.');return{shape,topology,vertex,point,coords};
}

function productTopology(parsed,member){
  const shape=entity(parsed,member.args[6],'IFCPRODUCTDEFINITIONSHAPE'),reps=list(shape.args[2]);if(reps.length!==1)throw new Error(`IFC STEP parser: ${member.type} deve possuir uma representação.`);
  const topology=entity(parsed,reps[0],'IFCTOPOLOGYREPRESENTATION'),items=list(topology.args[3]);if(items.length!==1)throw new Error(`IFC STEP parser: ${member.type} deve possuir um item topológico.`);return{shape,topology,item:entity(parsed,items[0])};
}

function materialInfo(parsed,rel){
  const related=list(rel.args[4]),target=entity(parsed,rel.args[5]);
  if(target.type==='IFCMATERIAL')return{mode:'DIRECT_MATERIAL',relatedEntityIds:related.map(x=>entity(parsed,x).id),material:{entityId:target.id,name:string(target.args[0],'IfcMaterial.Name'),category:target.args[2]??null}};
  if(target.type!=='IFCMATERIALPROFILESETUSAGE')throw new Error(`IFC STEP parser: RelatingMaterial não suportado ${target.type}.`);
  const set=entity(parsed,target.args[0],'IFCMATERIALPROFILESET'),profiles=list(set.args[2]);if(profiles.length!==1)throw new Error('IFC STEP parser: profile set deve possuir exatamente um profile no subconjunto AstraStruct.');
  const mp=entity(parsed,profiles[0],'IFCMATERIALPROFILE'),mat=entity(parsed,mp.args[2],'IFCMATERIAL'),profile=entity(parsed,mp.args[3]);
  if(!['IFCRECTANGLEPROFILEDEF','IFCCIRCLEPROFILEDEF','IFCISHAPEPROFILEDEF'].includes(profile.type))throw new Error(`IFC STEP parser: perfil não suportado ${profile.type}.`);
  return{mode:'MATERIAL_PROFILE_SET',relatedEntityIds:related.map(x=>entity(parsed,x).id),material:{entityId:mat.id,name:string(mat.args[0],'IfcMaterial.Name'),category:mat.args[2]??null},profile:{entityId:profile.id,type:profile.type,args:profile.args},cardinalPoint:target.args[1]};
}

function ownerInfo(parsed){
  const history=one(parsed,'IFCOWNERHISTORY'),personOrg=entity(parsed,history.args[0],'IFCPERSONANDORGANIZATION'),person=entity(parsed,personOrg.args[0],'IFCPERSON'),organization=entity(parsed,personOrg.args[1],'IFCORGANIZATION'),application=entity(parsed,history.args[1],'IFCAPPLICATION');
  if(entity(parsed,application.args[0],'IFCORGANIZATION').id!==organization.id)throw new Error('IFC STEP parser: ApplicationDeveloper diverge da organização do owner.');
  return{ownerHistoryEntityId:history.id,creationDate:number(history.args[7],'CreationDate'),person:{identification:person.args[0]??null,familyName:person.args[1]??null,givenName:person.args[2]??null},organization:{identification:organization.args[0]??null,name:string(organization.args[1],'Organization.Name'),description:organization.args[2]??null},application:{version:string(application.args[1],'Application.Version'),fullName:string(application.args[2],'Application.FullName'),identifier:string(application.args[3],'Application.Identifier')}};
}

const ROOT_TYPES=new Set(['IFCPROJECT','IFCSTRUCTURALANALYSISMODEL','IFCSTRUCTURALPOINTCONNECTION','IFCSTRUCTURALCURVEMEMBER','IFCSTRUCTURALSURFACEMEMBER','IFCRELCONNECTSSTRUCTURALMEMBER','IFCRELDECLARES','IFCRELASSIGNSTOGROUP','IFCRELASSOCIATESMATERIAL']);

export function parseIfcStructuralStep(step){
  const parsed=parseIfcStepEntities(step),owner=ownerInfo(parsed),roots=[],seenGuids=new Set();
  for(const e of parsed.entities.values())if(ROOT_TYPES.has(e.type)){const globalId=string(e.args[0],`${e.type}.GlobalId`);if(!validateIfcGuid(globalId))throw new Error(`IFC STEP parser: GlobalId inválido em #${e.id}.`);if(seenGuids.has(globalId))throw new Error(`IFC STEP parser: GlobalId duplicado ${globalId}.`);seenGuids.add(globalId);if(!e.args[1]||e.args[1].ref!==owner.ownerHistoryEntityId)throw new Error(`IFC STEP parser: ${e.type} #${e.id} não referencia OwnerHistory comum.`);roots.push({entityId:e.id,type:e.type,globalId})}
  const project=one(parsed,'IFCPROJECT'),analysis=one(parsed,'IFCSTRUCTURALANALYSISMODEL'),nodes=[],vertexToNode=new Map(),pointToNode=new Map();
  for(const e of parsed.byType.get('IFCSTRUCTURALPOINTCONNECTION')||[]){const p=productPoint(parsed,e),node={entityId:e.id,globalId:string(e.args[0],'PointConnection.GlobalId'),name:e.args[2]??null,coordinates:p.coords,vertexEntityId:p.vertex.id,pointEntityId:p.point.id};nodes.push(node);vertexToNode.set(p.vertex.id,node);pointToNode.set(p.point.id,node)}
  const members=[];
  for(const e of parsed.byType.get('IFCSTRUCTURALCURVEMEMBER')||[]){const t=productTopology(parsed,e);if(t.topology.args[2]!=='Edge'||t.item.type!=='IFCEDGE')throw new Error(`IFC STEP parser: curve member #${e.id} sem Edge.`);const a=entity(parsed,t.item.args[0],'IFCVERTEXPOINT'),b=entity(parsed,t.item.args[1],'IFCVERTEXPOINT'),na=vertexToNode.get(a.id),nb=vertexToNode.get(b.id);if(!na||!nb)throw new Error(`IFC STEP parser: curve member #${e.id} usa vértice não associado a point connection.`);members.push({entityId:e.id,type:'curve',globalId:string(e.args[0],'CurveMember.GlobalId'),name:e.args[2]??null,nodeGlobalIds:[na.globalId,nb.globalId]})}
  for(const e of parsed.byType.get('IFCSTRUCTURALSURFACEMEMBER')||[]){const t=productTopology(parsed,e);if(t.topology.args[2]!=='Face'||t.item.type!=='IFCFACESURFACE')throw new Error(`IFC STEP parser: surface member #${e.id} sem FaceSurface.`);const bounds=list(t.item.args[0]);if(bounds.length!==1)throw new Error('IFC STEP parser: superfície AstraStruct deve possuir um contorno externo.');const outer=entity(parsed,bounds[0],'IFCFACEOUTERBOUND'),loop=entity(parsed,outer.args[0],'IFCPOLYLOOP'),points=list(loop.args[0]);const connected=points.map(p=>{const point=entity(parsed,p,'IFCCARTESIANPOINT'),node=pointToNode.get(point.id);if(!node)throw new Error(`IFC STEP parser: ponto #${point.id} da superfície não pertence a point connection.`);return node.globalId});members.push({entityId:e.id,type:'surface',globalId:string(e.args[0],'SurfaceMember.GlobalId'),name:e.args[2]??null,nodeGlobalIds:connected,predefinedType:e.args[7]?.enum??null,thickness:e.args[8]??null})}
  const connections=(parsed.byType.get('IFCRELCONNECTSSTRUCTURALMEMBER')||[]).map(e=>({entityId:e.id,globalId:string(e.args[0],'RelConnects.GlobalId'),memberEntityId:entity(parsed,e.args[4]).id,nodeEntityId:entity(parsed,e.args[5]).id}));
  const materials=(parsed.byType.get('IFCRELASSOCIATESMATERIAL')||[]).map(e=>({entityId:e.id,globalId:string(e.args[0],'RelAssociatesMaterial.GlobalId'),...materialInfo(parsed,e)}));
  return{contract:'ifc-structural-step/v1',parserVersion:IFC_STEP_PARSER_VERSION,schema:IFC_SCHEMA,project:{entityId:project.id,globalId:string(project.args[0],'Project.GlobalId'),name:project.args[2]??null},analysisModel:{entityId:analysis.id,globalId:string(analysis.args[0],'Analysis.GlobalId'),name:analysis.args[2]??null},owner,nodes,members,connections,materials,rootCount:roots.length,entityCount:parsed.entities.size};
}

export function validateIfcStructuralRoundTrip(model,parsedStep){
  const parsed=typeof parsedStep==='string'?parseIfcStructuralStep(parsedStep):parsedStep,nodeByKey=new Map((model.nodes||[]).map(n=>[n.key,n]));
  if(parsed.project.globalId!==model.project.globalId)throw new Error('IFC STEP round-trip: Project GlobalId divergiu.');
  if(parsed.analysisModel.globalId!==model.analysisModel.globalId)throw new Error('IFC STEP round-trip: AnalysisModel GlobalId divergiu.');
  const expectedNodes=new Map((model.nodes||[]).map(n=>[n.globalId,n])),actualNodes=new Map(parsed.nodes.map(n=>[n.globalId,n]));
  if(expectedNodes.size!==actualNodes.size)throw new Error('IFC STEP round-trip: quantidade de nós divergiu.');
  for(const [guid,n] of expectedNodes){const actual=actualNodes.get(guid);if(!actual)throw new Error(`IFC STEP round-trip: nó ${guid} ausente.`);const expected=[n.placement.x,n.placement.y,n.placement.z].map(Number);if(expected.some((v,i)=>Math.abs(v-actual.coordinates[i])>1e-12))throw new Error(`IFC STEP round-trip: coordenadas divergiram no nó ${guid}.`)}
  const expectedMembers=new Map((model.members||[]).map(m=>[m.globalId,m])),actualMembers=new Map(parsed.members.map(m=>[m.globalId,m]));
  if(expectedMembers.size!==actualMembers.size)throw new Error('IFC STEP round-trip: quantidade de membros divergiu.');
  for(const [guid,m] of expectedMembers){
    const actual=actualMembers.get(guid);if(!actual)throw new Error(`IFC STEP round-trip: membro ${guid} ausente.`);
    const expected=(m.nodeRefs||[]).map(k=>nodeByKey.get(k)?.globalId);
    if(expected.some(x=>!x))throw new Error(`IFC STEP round-trip: referência de nó canônica ausente em ${guid}.`);
    if(JSON.stringify(expected)!==JSON.stringify(actual.nodeGlobalIds))throw new Error(`IFC STEP round-trip: conectividade divergiu em ${guid}.`);
  }
  return{project:true,nodes:expectedNodes.size,members:expectedMembers.size,materialAssociations:parsed.materials.length,owner:true};
}
