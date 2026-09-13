import {designCheck,requiredFinite,requiredPositive,requiredNonnegative} from './engine.js';

function rcParams(profile,branch){const p=profile?.parameters?.rc?.[branch];if(!p)throw new Error(`CodeDesign RC: profile.parameters.rc.${branch} é obrigatório.`);return p}

function solveNeutralAxis({b,d,As,fc,fy,Es,alpha1,beta1,epsCu}){
  const force=c=>{const a=beta1*c,C=alpha1*fc*b*a,epsS=epsCu*(d-c)/c,fs=Math.min(fy,Math.max(0,Es*epsS)),T=As*fs;return{balance:C-T,C,T,a,epsS,fs}};
  let lo=Math.max(1e-9,d*1e-9),hi=d*(1-1e-10),flo=force(lo),fhi=force(hi);if(!(flo.balance<0&&fhi.balance>0))throw new Error('CodeDesign RC flexure: não foi possível delimitar o eixo neutro para a seção simplesmente armada.');
  let mid=null,state=null;for(let i=0;i<100;i++){mid=.5*(lo+hi);state=force(mid);if(Math.abs(state.balance)<=1e-10*Math.max(1,state.C,state.T))break;if(state.balance>0)hi=mid;else lo=mid}return{c:mid,...state};
}

export function rcRectangularFlexureDesign({profile,demand={},section={},reinforcement={},materials={}}={}){
  const p=rcParams(profile,'flexure'),phi=requiredPositive('rc.flexure.phi',p.phi),alpha1=requiredPositive('rc.flexure.alpha1',p.alpha1),beta1=requiredPositive('rc.flexure.beta1',p.beta1),epsCu=requiredPositive('rc.flexure.epsCu',p.epsCu),b=requiredPositive('section.b',section.b),d=requiredPositive('section.d',section.d),As=requiredPositive('reinforcement.As',reinforcement.As),fc=requiredPositive('materials.fc',materials.fc),fy=requiredPositive('materials.fy',materials.fy),Es=requiredPositive('materials.Es',materials.Es),Mu=Math.abs(requiredFinite('demand.Mu',demand.Mu));
  const state=solveNeutralAxis({b,d,As,fc,fy,Es,alpha1,beta1,epsCu}),MnNmm=state.T*(d-state.a/2),Mn=MnNmm/1e6,resistance=phi*Mn;
  return designCheck({id:'rc-flexure',discipline:'RC',limitState:'Flexão simples de seção retangular simplesmente armada',demand:Mu,resistance,unit:'kN·m',profile,clause:profile.clauses?.rcFlexure??null,equation:'C=α1·fc·b·β1·c = As·fs; Mn=T·(d-a/2); Rd=φ·Mn',notes:['α1, β1, εcu e φ são fornecidos pelo profile; o AstraStruct não os infere de uma norma nesta camada.','Formulação limitada a flexão simples com armadura tracionada concentrada em d.'],details:{b,d,As,fc,fy,Es,phi,alpha1,beta1,epsCu,c:state.c,a:state.a,steelStrain:state.epsS,steelStress:state.fs,steelYielded:Math.abs(state.fs-fy)<=1e-8*Math.max(1,fy),compressionForceN:state.C,tensionForceN:state.T,Mn}});
}

export function rcShearDesign({profile,demand={},section={},reinforcement={},materials={}}={}){
  const p=rcParams(profile,'shear'),phi=requiredPositive('rc.shear.phi',p.phi),vcCoefficient=requiredNonnegative('rc.shear.vcCoefficient',p.vcCoefficient),steelCoefficient=requiredNonnegative('rc.shear.steelCoefficient',p.steelCoefficient),bw=requiredPositive('section.bw',section.bw),d=requiredPositive('section.d',section.d),fc=requiredPositive('materials.fc',materials.fc),fy=requiredPositive('materials.fy',materials.fy),lambda=requiredNonnegative('materials.lambda',materials.lambda??1),Vu=Math.abs(requiredFinite('demand.Vu',demand.Vu)),Av=requiredNonnegative('reinforcement.Av',reinforcement.Av??0),s=Av>0?requiredPositive('reinforcement.s',reinforcement.s):1;
  const VcN=vcCoefficient*lambda*Math.sqrt(fc)*bw*d,VsN=Av>0?steelCoefficient*Av*fy*d/s:0,nominal=(VcN+VsN)/1000,resistance=phi*nominal;
  return designCheck({id:'rc-shear',discipline:'RC',limitState:'Cisalhamento unidirecional parametrizado',demand:Vu,resistance,unit:'kN',profile,clause:profile.clauses?.rcShear??null,equation:'Rn = Cc·λ·√fc·bw·d + Cs·Av·fy·d/s; Rd=φ·Rn',notes:['Cc, Cs e φ são parâmetros explícitos do profile.','Limites máximos de tensão, requisitos mínimos de armadura e efeitos de tamanho devem ser adicionados pelo plugin normativo aplicável quando exigidos.'],details:{phi,vcCoefficient,steelCoefficient,bw,d,fc,fy,lambda,Av,s,Vc:VcN/1000,Vs:VsN/1000,nominal}});
}
