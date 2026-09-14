export const IFC_GUID_ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const IFC_GUID_SET=new Set(IFC_GUID_ALPHABET);
const MAX_UUID=(1n<<128n)-1n;

function uuidHex(value){
  const hex=String(value??'').trim().replace(/[{}-]/g,'').toLowerCase();
  if(!/^[0-9a-f]{32}$/.test(hex))throw new Error('IFC GUID: UUID deve conter exatamente 128 bits em hexadecimal.');
  return hex;
}

export function validateIfcGuid(value){
  const guid=String(value??'');
  if(guid.length!==22)return false;
  if(![...guid].every(c=>IFC_GUID_SET.has(c)))return false;
  if(IFC_GUID_ALPHABET.indexOf(guid[0])>3)return false;
  return true;
}

export function compressIfcGuid(uuid){
  let n=BigInt(`0x${uuidHex(uuid)}`),out='';
  for(let i=0;i<22;i++){out=IFC_GUID_ALPHABET[Number(n&63n)]+out;n>>=6n;}
  if(n!==0n||!validateIfcGuid(out))throw new Error('IFC GUID: falha de compressão.');
  return out;
}

export function expandIfcGuid(guid,{hyphenated=false}={}){
  const value=String(guid??'');if(!validateIfcGuid(value))throw new Error('IFC GUID: valor comprimido inválido.');
  let n=0n;for(const c of value)n=(n<<6n)+BigInt(IFC_GUID_ALPHABET.indexOf(c));
  if(n>MAX_UUID)throw new Error('IFC GUID: valor excede 128 bits.');
  const hex=n.toString(16).padStart(32,'0');
  return hyphenated?`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`:hex;
}

export function newIfcGuid(){
  if(typeof globalThis.crypto?.randomUUID!=='function')throw new Error('IFC GUID: crypto.randomUUID indisponível neste ambiente.');
  return compressIfcGuid(globalThis.crypto.randomUUID());
}

function copy(v){return v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));}
function rootedRecords(model){
  return [model?.project,model?.analysisModel,...(model?.nodes||[]),...(model?.members||[]),...(model?.relationships||[])].filter(Boolean);
}
function resolveMap(source,key){if(typeof source==='function')return source(key);if(source&&typeof source==='object')return source[key];return null;}

export function createIfcIdentityMap(model,{uuidFactory=null,guidFactory=null}={}){
  const records=rootedRecords(model),ids={};
  const guidFn=guidFactory||(uuidFactory?null:()=>newIfcGuid());
  const uuidFn=uuidFactory;
  for(const record of records){
    const key=String(record.key??'').trim();if(!key)throw new Error('IFC GUID: registro IfcRoot sem key estável.');
    const guid=record.globalId||(guidFn?guidFn(key,record):compressIfcGuid(uuidFn(key,record)));
    if(!validateIfcGuid(guid))throw new Error(`IFC GUID: identidade inválida para ${key}.`);
    if(Object.values(ids).includes(guid))throw new Error(`IFC GUID: identidade duplicada ${guid}.`);
    ids[key]=guid;
  }
  return{contract:'ifc-identity-map/v1',schema:model?.schema??null,projectKey:model?.project?.key??null,ids};
}

export function assignIfcGlobalIds(model,{identityMap=null,guidByKey=null,uuidByKey=null,generateMissing=false}={}){
  const out=copy(model),seen=new Set();
  const map=identityMap?.ids??identityMap??null;
  for(const record of rootedRecords(out)){
    const key=String(record.key??'').trim();if(!key)throw new Error('IFC GUID: registro IfcRoot sem key estável.');
    let guid=record.globalId||resolveMap(map,key)||resolveMap(guidByKey,key);
    if(!guid){const uuid=resolveMap(uuidByKey,key);if(uuid)guid=compressIfcGuid(uuid);}
    if(!guid&&generateMissing)guid=newIfcGuid();
    if(!guid)throw new Error(`IFC GUID: GlobalId ausente para ${key}.`);
    if(!validateIfcGuid(guid))throw new Error(`IFC GUID: GlobalId inválido para ${key}.`);
    if(seen.has(guid))throw new Error(`IFC GUID: GlobalId duplicado ${guid}.`);seen.add(guid);record.globalId=guid;
  }
  out.identity={contract:'ifc-identity/v1',persistent:true,count:seen.size,source:identityMap?'identity-map':guidByKey||uuidByKey?'provided':'generated-and-attached'};
  return out;
}

export function validateIfcGlobalIds(model){
  const records=rootedRecords(model),seen=new Set();
  for(const record of records){
    if(!validateIfcGuid(record.globalId))throw new Error(`IFC GUID: GlobalId ausente/inválido para ${record.key}.`);
    if(seen.has(record.globalId))throw new Error(`IFC GUID: GlobalId duplicado ${record.globalId}.`);seen.add(record.globalId);
  }
  return true;
}
