export const CODE_DESIGN_CONTRACT='code-design/v1';
export const CODE_DESIGN_PROFILE_CONTRACT='code-design-profile/v1';
export const CODE_DESIGN_CHECK_CONTRACT='code-design-check/v1';
export const CODE_DESIGN_VERSION='0.43.0-exp';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finiteOrNull=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
export const requiredFinite=(label,value)=>{const n=finiteOrNull(value);if(n===null)throw new Error(`CodeDesign: ${label} deve ser finito.`);return n};
export const requiredPositive=(label,value)=>{const n=requiredFinite(label,value);if(!(n>0))throw new Error(`CodeDesign: ${label} deve ser > 0.`);return n};
export const requiredNonnegative=(label,value)=>{const n=requiredFinite(label,value);if(n<0)throw new Error(`CodeDesign: ${label} deve ser >= 0.`);return n};
export const requiredText=(label,value)=>{const s=String(value??'').trim();if(!s)throw new Error(`CodeDesign: ${label} é obrigatório.`);return s};

export function createCodeDesignProfile(profile={}){
  const id=requiredText('profile.id',profile.id),code=requiredText(`${id}.code`,profile.code),edition=profile.edition==null?null:String(profile.edition),provenance=profile.provenance;
  if(!provenance||typeof provenance!=='object')throw new Error(`CodeDesign: profile '${id}' requer provenance explícita.`);
  if(!profile.parameters||typeof profile.parameters!=='object')throw new Error(`CodeDesign: profile '${id}' requer parameters explícitos.`);
  return Object.freeze({contract:CODE_DESIGN_PROFILE_CONTRACT,version:CODE_DESIGN_VERSION,id,code,edition,provenance:clone(provenance),parameters:clone(profile.parameters),clauses:clone(profile.clauses||{})});
}

export function designCheck({id,discipline,limitState,demand,resistance,unit='-',profile,clause=null,equation=null,notes=[],details={}}={}){
  const D=finiteOrNull(demand),R=finiteOrNull(resistance),utilization=D!==null&&R!==null&&R>0?Math.abs(D)/R:null,ok=utilization===null?null:utilization<=1+1e-12;
  return{contract:CODE_DESIGN_CHECK_CONTRACT,version:CODE_DESIGN_VERSION,id:requiredText('check.id',id),discipline:requiredText(`${id}.discipline`,discipline),limitState:requiredText(`${id}.limitState`,limitState),demand:D,resistance:R,utilization,ok,unit:String(unit),profileId:profile?.id??null,code:profile?.code??null,edition:profile?.edition??null,provenance:clone(profile?.provenance??null),clause, equation,notes:Array.from(notes||[],String),details:clone(details)};
}

export function summarizeCodeDesign({profile,checks=[],combinationId=null}={}){
  const rows=Array.from(checks||[]);if(!rows.length)throw new Error('CodeDesign: ao menos uma verificação é necessária.');for(const c of rows)if(c?.contract!==CODE_DESIGN_CHECK_CONTRACT)throw new Error('CodeDesign: check incompatível com code-design-check/v1.');
  const evaluated=rows.filter(c=>c.utilization!==null),governing=evaluated.length?evaluated.reduce((a,b)=>b.utilization>a.utilization?b:a):null;
  return{contract:CODE_DESIGN_CONTRACT,version:CODE_DESIGN_VERSION,profile:{id:profile?.id??null,code:profile?.code??null,edition:profile?.edition??null,provenance:clone(profile?.provenance??null)},combinationId:combinationId==null?null:String(combinationId),checks:rows,summary:{count:rows.length,pass:rows.filter(c=>c.ok===true).length,fail:rows.filter(c=>c.ok===false).length,pending:rows.filter(c=>c.ok===null).length,maxUtilization:governing?.utilization??null,governingCheckId:governing?.id??null}};
}

export function governingAcrossCombinations(cases=[]){
  const rows=Array.from(cases||[]);if(!rows.length)throw new Error('CodeDesign: cases é obrigatório.');let governing=null;
  for(const row of rows){const result=row.result;if(result?.contract!==CODE_DESIGN_CONTRACT)throw new Error('CodeDesign: resultado de combinação inválido.');for(const check of result.checks){if(check.utilization===null)continue;const point={combinationId:String(row.combinationId??result.combinationId??''),checkId:check.id,discipline:check.discipline,limitState:check.limitState,utilization:check.utilization,ok:check.ok};if(!governing||point.utilization>governing.utilization)governing=point}}
  return{contract:'code-design-envelope/v1',version:CODE_DESIGN_VERSION,count:rows.length,governing};
}
