import {registerRuleSet} from '../core/ruleEngine.js';

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const kN=N=>N/1000;
const check=(id,limitState,demand,resistance,extra={})=>({id,limitState,demand:n(demand),resistance:n(resistance),unit:'kN',...extra});

function punchingChecks(p){
  const out=[],Vu=Math.abs(n(p.Vu)),fc=Math.max(0,n(p.fc)),b0=Math.max(0,n(p.b0)),d=Math.max(0,n(p.d)),beta=Math.max(1e-12,n(p.beta,1)),alphaS=Math.max(0,n(p.alphaS,40)),lambda=Math.max(0,n(p.lambda,1)),lambdaS=Math.max(0,n(p.lambdaS,1)),phi=Math.max(0,n(p.phi,.75));
  if(!(fc>0&&b0>0&&d>0))return out;
  const root=Math.sqrt(fc),v1=.33*lambdaS*lambda*root,v2=.17*(1+2/beta)*lambdaS*lambda*root,v3=.083*(2+alphaS*d/b0)*lambdaS*lambda*root,vc=Math.min(v1,v2,v3),Vc=kN(vc*b0*d),phiVc=phi*Vc;
  out.push(check('punching-two-way','Punção / cisalhamento bidirecional sem armadura transversal',Vu,phiVc,{clause:'ACI CODE-318-25 · Ch. 22 two-way shear',equation:'φ·min(vc1,vc2,vc3)·b0·d',parameters:{phi,fc,b0,d,beta,alphaS,lambda,lambdaS,v1,v2,v3,vc,Vc}}));
  if(Number.isFinite(Number(p.maxDemandStressMPa))){const demand=Math.abs(n(p.maxDemandStressMPa));out.push({id:'punching-stress-map',limitState:'Pico de tensão de punção no perímetro',demand,resistance:phi*vc,unit:'MPa',clause:'ACI CODE-318-25 · Ch. 22 two-way shear',equation:'τu,max ≤ φvc',parameters:{phi,vc},notes:['A demanda τu,max pode vir do campo distribuído do Lab de punção; o plugin não substitui a determinação do perímetro crítico.']})}
  return out;
}
function anchorTensionChecks(a){
  const out=[],Nu=Math.abs(n(a.Nu)),fc=Math.max(0,n(a.fc)),hef=Math.max(0,n(a.hef)),lambdaA=Math.max(0,n(a.lambdaA,1)),type=String(a.anchorType||'cast-in'),kc=Math.max(0,n(a.kc,type==='post-installed'?7:10)),phi=Math.max(0,n(a.phi,.70));
  if(fc>0&&hef>0){
    const Nb=kN(kc*lambdaA*Math.sqrt(fc)*hef**1.5),ANco=Math.max(1e-12,n(a.ANco,9*hef*hef)),ANc=Math.max(0,n(a.ANc,ANco)),psiEc=Math.max(0,n(a.psiEc,1)),psiC=Math.max(0,n(a.psiC,1)),psiCp=Math.max(0,n(a.psiCp,1)),psiA=Math.max(0,n(a.psiA,1)),psiCm=Math.max(0,n(a.psiCm,1));
    let psiEd=n(a.psiEd,NaN);if(!Number.isFinite(psiEd)){const ca=n(a.edgeDistance,NaN);psiEd=Number.isFinite(ca)?(ca>=1.5*hef?1:Math.min(1,.7+.3*ca/(1.5*hef))):1}
    psiEd=Math.max(0,psiEd);
    const Ncb=Nb*(ANc/ANco)*psiEc*psiEd*psiC*psiCp*psiA*psiCm,design=phi*Ncb;
    out.push(check('anchor-concrete-breakout-tension','Ruptura do cone de concreto em tração',Nu,design,{clause:'ACI CODE-318-25 · Ch. 17 concrete breakout in tension',equation:'φ·Nb·(ANc/ANco)·Πψ',parameters:{phi,kc,lambdaA,fc,hef,Nb,ANc,ANco,psiEc,psiEd,psiC,psiCp,psiA,psiCm,Ncb},notes:['φ depende das condições do sistema de ancoragem e deve ser confirmado para o caso de projeto.','kc pode ser sobrescrito pelo perfil de ancoragem aplicável.']}));
  }
  const Ase=Math.max(0,n(a.Ase)),futa=Math.max(0,n(a.futa)),phiSteel=Math.max(0,n(a.phiSteel,.75));if(Ase>0&&futa>0)out.push(check('anchor-steel-tension','Ruptura do aço do chumbador em tração',Nu,phiSteel*kN(Ase*futa),{clause:'ACI CODE-318-25 · Ch. 17 steel strength in tension',equation:'φ·Ase·futa',parameters:{phiSteel,Ase,futa}}));
  return out;
}
function anchorShearEdgeChecks(a){
  const Vu=Math.abs(n(a.Vu)),Vb=Math.max(0,n(a.basicShearBreakout)),phi=Math.max(0,n(a.phi,.70));if(!(Vb>0))return[];
  const AVco=Math.max(1e-12,n(a.AVco,1)),AVc=Math.max(0,n(a.AVc,AVco)),psiEcV=Math.max(0,n(a.psiEcV,1)),psiEdV=Math.max(0,n(a.psiEdV,1)),psiCV=Math.max(0,n(a.psiCV,1)),psiHV=Math.max(0,n(a.psiHV,1)),Vcb=Vb*(AVc/AVco)*psiEcV*psiEdV*psiCV*psiHV;
  return[check('anchor-concrete-edge-shear','Breakout de concreto junto à borda em cisalhamento',Vu,phi*Vcb,{clause:'ACI CODE-318-25 · Ch. 17 concrete edge breakout in shear',equation:'φ·Vb·(AVc/AVco)·Πψ',parameters:{phi,Vb,AVc,AVco,psiEcV,psiEdV,psiCV,psiHV,Vcb},notes:['basicShearBreakout (Vb) deve ser fornecido pelo perfil geométrico aplicável; o AstraStruct não replica tabelas/coeficientes licenciados que não foram verificados publicamente.']}))];
}

export function evaluateAci318_25(input={}){return[...punchingChecks(input.punching||{}),...anchorTensionChecks(input.anchorTension||{}),...anchorShearEdgeChecks(input.anchorShearEdge||{})]}
export const ACI318_25_RULESET=registerRuleSet({id:'aci-318-25-punching-anchors',code:'ACI CODE 318',edition:'2025',scope:['two-way-shear','anchor-steel-tension','anchor-concrete-breakout-tension','anchor-edge-breakout-shear'],provenance:{publisher:'American Concrete Institute',standard:'ACI CODE-318-25',units:'N-mm-MPa internally; results kN/MPa',sourceStatus:'2025 edition verified; condition-dependent φ and anchor modifiers remain explicit'},evaluate:evaluateAci318_25});
