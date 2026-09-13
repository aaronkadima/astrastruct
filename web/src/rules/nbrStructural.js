import {registerRuleSet} from '../core/ruleEngine.js';

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function parameterCheck(id,label,data,clause){
  const demand=Math.abs(n(data?.demand??data?.Vu??data?.Tu)),direct=Number(data?.designResistance),hasDirect=Number.isFinite(direct)&&direct>=0;
  let resistance=hasDirect?direct:null,equation='Rd fornecido a partir da cópia licenciada';
  if(resistance===null&&Number.isFinite(Number(data?.coefficient))&&Number.isFinite(Number(data?.strengthMPa))&&Number.isFinite(Number(data?.areaMm2))){resistance=n(data.coefficient)*n(data.strengthMPa)*n(data.areaMm2)*Math.max(1,n(data.planes,1))/Math.max(1e-12,n(data.gamma,1))/1000;equation='C·f·A·n/γ (parâmetros transcritos pelo usuário)'}
  return{id,limitState:label,demand,resistance,unit:'kN',ok:resistance===null?null:undefined,clause,equation,parameters:{...(data||{})},notes:resistance===null?['Informe a resistência de cálculo ou os coeficientes da edição licenciada. O AstraStruct não inventa coeficientes ABNT não verificados publicamente.']:['Resultado calculado a partir de resistência/coeficientes fornecidos pelo usuário conforme sua cópia licenciada.']};
}
export function evaluateNbr8800(input={}){
  const out=[];
  const defs=[['boltShear','bolt-shear','Parafuso ao cisalhamento'],['boltTension','bolt-tension','Parafuso à tração'],['bearing','bearing','Pressão de contato/bearing'],['tearout','tearout','Rasgamento junto ao furo'],['netSection','net-section','Ruptura de seção líquida'],['blockShear','block-shear','Ruptura em bloco']];
  for(const[key,id,label]of defs)if(input[key])out.push(parameterCheck(id,label,input[key],'ABNT NBR 8800:2024 Versão Corrigida:2025 · cláusula a confirmar na edição licenciada'));
  return out;
}
export const NBR8800_RULESET=registerRuleSet({id:'nbr-8800-2024vc2025-connections',code:'ABNT NBR 8800',edition:'2024 Versão Corrigida:2025',scope:['bolt-shear','bolt-tension','bearing','tear-out','net-section','block-shear'],provenance:{publisher:'ABNT',standard:'ABNT NBR 8800:2024 Versão Corrigida:2025',requiresLicensedParameters:true,automaticResistance:false,policy:'No coefficients copied or guessed without public verification; accepts licensed user/profile parameters.'},evaluate:evaluateNbr8800});

export function evaluateNbr6118(input={}){
  const p=input.punching||{},Vu=Math.abs(n(p.Vu)),vRd=Number(p.designPunchingResistanceMPa),b0=Math.max(0,n(p.b0)),d=Math.max(0,n(p.d));
  if(Number.isFinite(vRd)&&vRd>=0&&b0>0&&d>0){const Rd=vRd*b0*d/1000;return[{id:'punching',limitState:'Punção',demand:Vu,resistance:Rd,unit:'kN',clause:'ABNT NBR 6118:2026 · resistência fornecida pelo perfil licenciado',equation:'VRd=vRd·u·d',parameters:{vRd,b0,d},notes:['vRd deve ser transcrito/calculado conforme a edição licenciada aplicável.']}]} 
  const direct=Number(p.designResistance);return[{id:'punching',limitState:'Punção',demand:Vu,resistance:Number.isFinite(direct)&&direct>=0?direct:null,unit:'kN',ok:null,clause:'ABNT NBR 6118:2026 · cláusula a confirmar na edição licenciada',equation:'resistência de cálculo parametrizada',parameters:{...p},notes:['Informe vRd + perímetro efetivo + d, ou a resistência de cálculo obtida da cópia licenciada.']}];
}
export const NBR6118_RULESET=registerRuleSet({id:'nbr-6118-2026-punching',code:'ABNT NBR 6118',edition:'2026',scope:['punching'],provenance:{publisher:'ABNT',standard:'ABNT NBR 6118:2026',requiresLicensedParameters:true,automaticResistance:false,policy:'Normative coefficients are not guessed; design resistance is supplied by a licensed profile/user input.'},evaluate:evaluateNbr6118});
