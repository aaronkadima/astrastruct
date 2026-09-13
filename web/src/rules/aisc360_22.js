import {registerRuleSet} from '../core/ruleEngine.js';

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const kN=N=>N/1000;
const check=(id,limitState,demand,resistance,extra={})=>({id,limitState,demand:n(demand),resistance:n(resistance),unit:'kN',...extra});

export function evaluateAisc360_22(input={}){
  const out=[];
  if(input.bolt){
    const b=input.bolt,phi=n(b.phi,.75),planes=Math.max(1,n(b.planes,1)),Ab=Math.max(0,n(b.Ab)),At=Math.max(0,n(b.At||b.Ab)),Fnv=Math.max(0,n(b.Fnv)),Fnt=Math.max(0,n(b.Fnt)),Vu=Math.abs(n(b.Vu)),Tu=Math.abs(n(b.Tu));
    if(Fnv>0&&Ab>0)out.push(check('bolt-shear','Parafuso ao cisalhamento',Vu,phi*kN(Fnv*Ab*planes),{clause:'J3',equation:'φ·Fnv·Ab·nplanes',parameters:{phi,Fnv,Ab,planes}}));
    if(Fnt>0&&At>0)out.push(check('bolt-tension','Parafuso à tração',Tu,phi*kN(Fnt*At),{clause:'J3',equation:'φ·Fnt·At',parameters:{phi,Fnt,At}}));
    if(Fnv>0&&Fnt>0&&Ab>0&&At>0&&Tu>0){
      const frv=Vu*1000/Math.max(1e-12,Ab*planes),FntPrime=Math.max(0,Math.min(Fnt,1.3*Fnt-(Fnt/(Math.max(1e-12,phi*Fnv)))*frv));
      out.push(check('bolt-combined','Interação cisalhamento–tração no parafuso',Tu,phi*kN(FntPrime*At),{clause:'J3.7',equation:"F'nt=min[Fnt,1.3Fnt-(Fnt/(φFnv))frv]",parameters:{phi,Fnv,Fnt,frv,FntPrime,At,planes},notes:['A demanda de cisalhamento é convertida em tensão requerida usando Ab e o número de planos informados.']}));
    }
  }
  if(input.bearing){
    const b=input.bearing,phi=n(b.phi,.75),Fu=Math.max(0,n(b.Fu)),t=Math.max(0,n(b.t)),d=Math.max(0,n(b.d)),Lc=Math.max(0,n(b.Lc)),Vu=Math.abs(n(b.Vu||b.demand)),cb=n(b.bearingCoefficient,b.deformationConsidered===false?3.0:2.4),ct=n(b.tearoutCoefficient,b.deformationConsidered===false?1.5:1.2);
    if(Fu>0&&t>0&&d>0)out.push(check('bearing','Bearing no material conectado',Vu,phi*kN(cb*d*t*Fu),{clause:'J3.6',equation:'φ·Cb·d·t·Fu',parameters:{phi,cb,d,t,Fu}}));
    if(Fu>0&&t>0&&Lc>0)out.push(check('tearout','Rasgamento/tear-out junto ao furo',Vu,phi*kN(ct*Lc*t*Fu),{clause:'J3.6',equation:'φ·Ct·Lc·t·Fu',parameters:{phi,ct,Lc,t,Fu}}));
  }
  if(input.netSection){
    const s=input.netSection,phi=n(s.phi,.75),Fu=Math.max(0,n(s.Fu)),An=Math.max(0,n(s.An)),U=Math.max(0,n(s.U,1)),Tu=Math.abs(n(s.Tu||s.demand));
    if(Fu>0&&An>0)out.push(check('net-section','Ruptura da seção líquida',Tu,phi*kN(Fu*U*An),{clause:'D2/J4',equation:'φ·Fu·Ae, Ae=U·An',parameters:{phi,Fu,An,U,Ae:U*An}}));
  }
  if(input.blockShear){
    const s=input.blockShear,phi=n(s.phi,.75),Fu=Math.max(0,n(s.Fu)),Fy=Math.max(0,n(s.Fy)),Anv=Math.max(0,n(s.Anv)),Agv=Math.max(0,n(s.Agv)),Ant=Math.max(0,n(s.Ant)),Ubs=Math.max(0,n(s.Ubs,1)),demand=Math.abs(n(s.demand??s.Vu??s.Tu));
    if(Fu>0&&Fy>0&&Anv>0&&Agv>0){const shearTerm=Math.min(.6*Fu*Anv,.6*Fy*Agv),Rn=kN(shearTerm+Ubs*Fu*Ant);out.push(check('block-shear','Ruptura por block shear',demand,phi*Rn,{clause:'J4.3',equation:'φ·[min(0.6FuAnv,0.6FyAgv)+UbsFuAnt]',parameters:{phi,Fu,Fy,Anv,Agv,Ant,Ubs,Rn}}))}
  }
  return out;
}

export const AISC360_22_RULESET=registerRuleSet({
  id:'aisc-360-22-connections',code:'ANSI/AISC 360',edition:'2022',scope:['bolt-shear','bolt-tension','bolt-interaction','bearing','tear-out','net-section','block-shear'],
  provenance:{publisher:'American Institute of Steel Construction',standard:'ANSI/AISC 360-22',formulaProfile:'LRFD',units:'N-mm-MPa internally; results kN',sourceStatus:'edition verified; coefficients exposed in inputs where geometry/hole condition controls'},
  evaluate:evaluateAisc360_22
});
