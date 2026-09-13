import {registerRuleSet} from '../core/ruleEngine.js';

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const kN=N=>N/1000;
const check=(id,limitState,demand,resistance,extra={})=>({id,limitState,demand:n(demand),resistance:n(resistance),unit:'kN',...extra});

export function evaluateEn1993_1_8_2024(input={}){
  const out=[];
  if(input.bolt){
    const b=input.bolt,gammaM2=Math.max(1e-12,n(b.gammaM2,1.25)),planes=Math.max(1,n(b.planes,1)),alphaV=n(b.alphaV,.6),k2=n(b.k2,.9),fub=Math.max(0,n(b.fub)),A=Math.max(0,n(b.A||b.As)),As=Math.max(0,n(b.As||b.A)),VEd=Math.abs(n(b.VEd)),TEd=Math.abs(n(b.TEd)),FvRd=fub>0&&A>0?kN(alphaV*fub*A*planes/gammaM2):0,FtRd=fub>0&&As>0?kN(k2*fub*As/gammaM2):0;
    if(FvRd>0)out.push(check('bolt-shear','Resistência do parafuso ao cisalhamento',VEd,FvRd,{clause:'EN 1993-1-8 · fastener resistance',equation:'αv·fub·A·nplanes/γM2',parameters:{alphaV,fub,A,planes,gammaM2}}));
    if(FtRd>0)out.push(check('bolt-tension','Resistência do parafuso à tração',TEd,FtRd,{clause:'EN 1993-1-8 · fastener resistance',equation:'k2·fub·As/γM2',parameters:{k2,fub,As,gammaM2}}));
    if(FvRd>0&&FtRd>0){const utilization=VEd/FvRd+TEd/(1.4*FtRd);out.push({id:'bolt-combined',limitState:'Interação cisalhamento–tração',demand:utilization,resistance:1,unit:'ratio',utilization,clause:'EN 1993-1-8 · interaction',equation:'VEd/FvRd + TEd/(1.4FtRd) ≤ 1',parameters:{VEd,TEd,FvRd,FtRd}})}
  }
  if(input.bearing){
    const b=input.bearing,gammaM2=Math.max(1e-12,n(b.gammaM2,1.25)),k1=Math.max(0,n(b.k1)),alphaB=Math.max(0,n(b.alphaB)),fu=Math.max(0,n(b.fu)),d=Math.max(0,n(b.d)),t=Math.max(0,n(b.t)),VEd=Math.abs(n(b.VEd||b.demand)),holeFactor=Math.max(0,n(b.holeFactor,1));
    if(k1>0&&alphaB>0&&fu>0&&d>0&&t>0)out.push(check('bearing','Bearing da chapa junto ao parafuso',VEd,kN(holeFactor*k1*alphaB*fu*d*t/gammaM2),{clause:'EN 1993-1-8 · fastener bearing',equation:'khole·k1·αb·fu·d·t/γM2',parameters:{holeFactor,k1,alphaB,fu,d,t,gammaM2},notes:['k1, αb e o fator de tipo de furo permanecem explícitos para compatibilidade com geometria e National Annex aplicáveis.']}));
  }
  if(input.blockTearing){
    const s=input.blockTearing,gammaM2=Math.max(1e-12,n(s.gammaM2,1.25)),gammaM0=Math.max(1e-12,n(s.gammaM0,1)),fu=Math.max(0,n(s.fu)),fy=Math.max(0,n(s.fy)),Ant=Math.max(0,n(s.Ant)),Anv=Math.max(0,n(s.Anv)),tensionFactor=Math.max(0,n(s.tensionFactor,1)),demand=Math.abs(n(s.demand||s.NEd));
    if(fu>0&&fy>0&&(Ant>0||Anv>0)){const Rd=kN(tensionFactor*fu*Ant/gammaM2+fy*Anv/(Math.sqrt(3)*gammaM0));out.push(check('block-tearing','Block tearing da chapa',demand,Rd,{clause:'EN 1993-1-8 · block tearing family',equation:'kt·fu·Ant/γM2 + fy·Anv/(√3γM0)',parameters:{tensionFactor,fu,Ant,gammaM2,fy,Anv,gammaM0},notes:['O fator de tensão é configurável porque a expressão depende do caso de carregamento e do perfil de aplicação/National Annex.']}))}
  }
  return out;
}

export const EN1993_1_8_2024_RULESET=registerRuleSet({
  id:'en-1993-1-8-2024-connections',code:'EN 1993-1-8',edition:'2024',scope:['bolt-shear','bolt-tension','bolt-interaction','bearing','block-tearing'],
  provenance:{publisher:'CEN / national adoption',standard:'EN 1993-1-8:2024',formulaFamily:'steel joint resistance',nationalAnnexParameters:true,units:'N-mm-MPa internally; results kN',sourceStatus:'2024 edition current; partial factors and geometry coefficients remain explicit'},
  evaluate:evaluateEn1993_1_8_2024
});
