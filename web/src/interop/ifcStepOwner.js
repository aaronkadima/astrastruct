export const IFC_STEP_OWNER_CONTRACT='ifc-step-owner/v1';
export const IFC_STEP_OWNER_VERSION='0.45.0-exp';

const text=v=>String(v??'').trim();
const ref=id=>`#${id}`;

function spfString(value){
  const source=String(value??'');let out='';
  for(const ch of source){const cp=ch.codePointAt(0);if(cp>=32&&cp<=126&&ch!=="'"&&ch!=='\\')out+=ch;else if(ch==="'")out+="''";else{const units=[];for(let i=0;i<ch.length;i++)units.push(ch.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0'));out+=`\\X2\\${units.join('')}\\X0\\`;}}
  return `'${out}'`;
}
const optionalString=value=>value==null||String(value).trim()===''?'$':spfString(value);

function creationTimestamp(metadata,stepTimestamp){
  if(metadata?.creationDate!=null){const n=Number(metadata.creationDate);if(!Number.isInteger(n)||n<0)throw new Error('IFC owner: creationDate deve ser IfcTimeStamp inteiro não negativo.');return n}
  const ms=Date.parse(String(stepTimestamp||''));if(!Number.isFinite(ms))throw new Error('IFC owner: timestamp ISO válido ou creationDate explícito é obrigatório.');return Math.floor(ms/1000);
}

export function validateIfcOwnerMetadata(metadata={},stepTimestamp=null){
  const person=metadata.person||{},organization=metadata.organization||{},application=metadata.application||{};
  if(!text(person.identification)&&!text(person.familyName)&&!text(person.givenName))throw new Error('IFC owner: pessoa requer identification, familyName ou givenName.');
  if(!text(organization.name))throw new Error('IFC owner: organization.name é obrigatório.');
  if(!text(application.version))throw new Error('IFC owner: application.version é obrigatório.');
  if(!text(application.fullName))throw new Error('IFC owner: application.fullName é obrigatório.');
  if(!text(application.identifier))throw new Error('IFC owner: application.identifier é obrigatório.');
  const normalized={
    contract:IFC_STEP_OWNER_CONTRACT,version:IFC_STEP_OWNER_VERSION,
    person:{identification:text(person.identification)||null,familyName:text(person.familyName)||null,givenName:text(person.givenName)||null},
    organization:{identification:text(organization.identification)||null,name:text(organization.name),description:text(organization.description)||null},
    application:{version:text(application.version),fullName:text(application.fullName),identifier:text(application.identifier)},
    creationDate:creationTimestamp(metadata,stepTimestamp)
  };
  return normalized;
}

export function emitIfcStepOwner(emitter,metadata,stepTimestamp){
  const m=validateIfcOwnerMetadata(metadata,stepTimestamp);
  const personId=emitter.add(`IFCPERSON(${optionalString(m.person.identification)},${optionalString(m.person.familyName)},${optionalString(m.person.givenName)},$,$,$,$,$)`,'step:owner:person');
  const organizationId=emitter.add(`IFCORGANIZATION(${optionalString(m.organization.identification)},${spfString(m.organization.name)},${optionalString(m.organization.description)},$,$)`,'step:owner:organization');
  const personOrgId=emitter.add(`IFCPERSONANDORGANIZATION(${ref(personId)},${ref(organizationId)},$)`,'step:owner:person-organization');
  const applicationId=emitter.add(`IFCAPPLICATION(${ref(organizationId)},${spfString(m.application.version)},${spfString(m.application.fullName)},${spfString(m.application.identifier)})`,'step:owner:application');
  const ownerHistoryId=emitter.add(`IFCOWNERHISTORY(${ref(personOrgId)},${ref(applicationId)},$,$,$,$,$,${m.creationDate})`,'step:owner:history');
  return{metadata:m,personId,organizationId,personOrgId,applicationId,ownerHistoryId};
}
