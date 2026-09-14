const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));

const DOFS=[
  ['ux','kx','translationalStiffnessX'],['uy','ky','translationalStiffnessY'],['uz','kz','translationalStiffnessZ'],
  ['rx','krx','rotationalStiffnessX'],['ry','kry','rotationalStiffnessY'],['rz','krz','rotationalStiffnessZ']
];

function sameNode(record,nodeId){return String(record?.nodeId??record?.node??'').trim()===String(nodeId).trim();}
function isFixed(value){return value===true||value===1||String(value).toLowerCase()==='fixed';}
function finiteValues(records,key){return records.map(r=>r?.[key]).filter(v=>v!==''&&v!=null&&Number.isFinite(Number(v))).map(Number);}

export function ifcBoundaryValue({supports=[],springs=[],restraintKey,stiffnessKey}){
  if(supports.some(s=>isFixed(s?.[restraintKey])))return true;
  const values=finiteValues(springs,stiffnessKey);
  if(values.length){const sum=values.reduce((a,b)=>a+b,0);return sum===0?false:sum;}
  return false;
}

export function createIfcBoundaryNodeCondition(project={},nodeId){
  const supports=(Array.isArray(project.supports)?project.supports:[]).filter(s=>sameNode(s,nodeId));
  const springs=(Array.isArray(project.nodeSprings)?project.nodeSprings:[]).filter(s=>sameNode(s,nodeId));
  if(!supports.length&&!springs.length)return null;
  const condition={ifcClass:'IfcBoundaryNodeCondition',name:`Boundary ${nodeId}`,source:{supports:copy(supports),springs:copy(springs)}};
  for(const [restraintKey,stiffnessKey,ifcKey] of DOFS)condition[ifcKey]=ifcBoundaryValue({supports,springs,restraintKey,stiffnessKey});
  validateIfcBoundaryNodeCondition(condition);return condition;
}

export function validateIfcBoundaryNodeCondition(condition){
  if(condition?.ifcClass!=='IfcBoundaryNodeCondition')throw new Error('IFC boundary: classe inválida.');
  for(const [, ,key] of DOFS){const value=condition[key];if(typeof value!=='boolean'&&!Number.isFinite(Number(value)))throw new Error(`IFC boundary: ${key} deve ser booleano ou rigidez numérica.`);}
  return true;
}

export function summarizeIfcBoundaryNodeCondition(condition){
  validateIfcBoundaryNodeCondition(condition);
  const result={fixed:0,released:0,springs:0};
  for(const [, ,key] of DOFS){const value=condition[key];if(value===true)result.fixed++;else if(value===false)result.released++;else result.springs++;}
  return result;
}
