import {designCheck,requiredFinite,requiredPositive,requiredNonnegative} from './engine.js';

function foundationParams(profile,branch){const p=profile?.parameters?.foundation?.[branch];if(!p)throw new Error(`CodeDesign Foundation: profile.parameters.foundation.${branch} é obrigatório.`);return p}
const absFinite=(label,value)=>Math.abs(requiredFinite(label,value));

export function rectangularFootingContact({profile,demand={},footing={},soil={}}={}){
  const B=requiredPositive('footing.B',footing.B),L=requiredPositive('footing.L',footing.L),N=requiredFinite('demand.N',demand.N),Mx=requiredFinite('demand.Mx',demand.Mx??0),My=requiredFinite('demand.My',demand.My??0),qDesign=requiredPositive('soil.qDesign',soil.qDesign),A=B*L,Ix=B*L**3/12,Iy=L*B**3/12;
  const corners=[];for(const x of [-B/2,B/2])for(const y of [-L/2,L/2])corners.push({x,y,q:N/A+Mx*y/Ix+My*x/Iy});
  const qmax=Math.max(...corners.map(c=>c.q)),qmin=Math.min(...corners.map(c=>c.q)),tol=1e-10*Math.max(1,Math.abs(qmax),qDesign),fullContact=N>0&&qmin>=-tol;
  return designCheck({id:'foundation-bearing',discipline:'Foundation',limitState:'Pressão de contato da base',demand:qmax,resistance:fullContact?qDesign:null,unit:'kPa',profile,clause:profile.clauses?.foundationBearing??null,equation:'q(x,y)=N/A + Mx·y/Ix + My·x/Iy',notes:fullContact?['Distribuição linear de pressão sob hipótese de base rígida e contato integral.']:['Há perda de contato/tração na base; a distribuição linear em contato integral não pode aprovar esta verificação. Use análise de contato parcial/não linear.'],details:{B,L,A,Ix,Iy,N,Mx,My,qmin,qmax,qDesign,corners,fullContact,eccentricity:{ex:N!==0?My/N:null,ey:N!==0?Mx/N:null},kern:{ex:B/6,ey:L/6}}});
}

export function foundationSlidingDesign({profile,demand={},footing={}}={}){
  const p=foundationParams(profile,'sliding'),mu=requiredNonnegative('foundation.sliding.frictionCoefficient',p.frictionCoefficient),cohesion=requiredNonnegative('foundation.sliding.cohesionKPa',p.cohesionKPa??0),phi=requiredPositive('foundation.sliding.resistanceFactor',p.resistanceFactor??1),B=requiredPositive('footing.B',footing.B),L=requiredPositive('footing.L',footing.L),N=Math.max(0,requiredFinite('demand.N',demand.N)),Hx=requiredFinite('demand.Hx',demand.Hx??0),Hy=requiredFinite('demand.Hy',demand.Hy??0),H=Math.hypot(Hx,Hy),friction=mu*N,cohesionForce=cohesion*B*L,resistance=phi*(friction+cohesionForce);
  return designCheck({id:'foundation-sliding',discipline:'Foundation',limitState:'Deslizamento da base',demand:H,resistance,unit:'kN',profile,clause:profile.clauses?.foundationSliding??null,equation:'R = φr·(μ·N+ c·A)',notes:['μ, coesão c e φr são parâmetros explícitos do profile; empuxos passivos não são adicionados automaticamente.'],details:{B,L,N,Hx,Hy,H,mu,cohesion,phi,friction,cohesionForce}});
}

export function foundationOverturningDesign({profile,stabilizingMoment,overturningMoment}={}){
  const p=foundationParams(profile,'stability'),requiredFS=requiredPositive('foundation.stability.requiredOverturningFS',p.requiredOverturningFS),Ms=requiredNonnegative('stabilizingMoment',stabilizingMoment),Mo=requiredNonnegative('overturningMoment',overturningMoment),factoredDemand=requiredFS*Mo;
  return designCheck({id:'foundation-overturning',discipline:'Foundation',limitState:'Estabilidade ao tombamento',demand:factoredDemand,resistance:Ms,unit:'kN·m',profile,clause:profile.clauses?.foundationOverturning??null,equation:'Mstabilizing ≥ FSreq·Moverturning',notes:['FSreq é fornecido explicitamente pelo profile.'],details:{stabilizingMoment:Ms,overturningMoment:Mo,requiredFS,actualFS:Mo>0?Ms/Mo:null}});
}

export function foundationPunchingDesign({profile,demand={},geometry={},materials={}}={}){
  const p=foundationParams(profile,'punching'),phi=requiredPositive('foundation.punching.phi',p.phi),coefficient=requiredNonnegative('foundation.punching.concreteCoefficient',p.concreteCoefficient),lambda=requiredNonnegative('materials.lambda',materials.lambda??1),fc=requiredPositive('materials.fc',materials.fc),b0=requiredPositive('geometry.b0',geometry.b0),d=requiredPositive('geometry.d',geometry.d),Vu=absFinite('demand.Vu',demand.Vu),nominal=coefficient*lambda*Math.sqrt(fc)*b0*d/1000,resistance=phi*nominal;
  return designCheck({id:'foundation-punching',discipline:'Foundation',limitState:'Punção da fundação',demand:Vu,resistance,unit:'kN',profile,clause:profile.clauses?.foundationPunching??null,equation:'Vn=Cp·λ·√fc·b0·d; VRd=φ·Vn',notes:['Cp e φ são parâmetros explícitos do profile; perímetro crítico b0 e profundidade d devem ser fornecidos segundo o plugin normativo aplicável.'],details:{phi,coefficient,lambda,fc,b0,d,nominal}});
}

export function foundationOneWayShearDesign({profile,demand={},geometry={},materials={}}={}){
  const p=foundationParams(profile,'oneWayShear'),phi=requiredPositive('foundation.oneWayShear.phi',p.phi),coefficient=requiredNonnegative('foundation.oneWayShear.concreteCoefficient',p.concreteCoefficient),lambda=requiredNonnegative('materials.lambda',materials.lambda??1),fc=requiredPositive('materials.fc',materials.fc),bw=requiredPositive('geometry.bw',geometry.bw),d=requiredPositive('geometry.d',geometry.d),Vu=absFinite('demand.Vu',demand.Vu),nominal=coefficient*lambda*Math.sqrt(fc)*bw*d/1000,resistance=phi*nominal;
  return designCheck({id:'foundation-one-way-shear',discipline:'Foundation',limitState:'Cisalhamento unidirecional da fundação',demand:Vu,resistance,unit:'kN',profile,clause:profile.clauses?.foundationOneWayShear??null,equation:'Vn=Cv·λ·√fc·bw·d; VRd=φ·Vn',notes:['Cv e φ são parâmetros explícitos do profile; a posição da seção crítica deve ser definida pelo plugin normativo aplicável.'],details:{phi,coefficient,lambda,fc,bw,d,nominal}});
}

export function foundationFlexureStripDesign({profile,demand={},strip={},reinforcement={},materials={}}={}){
  const p=foundationParams(profile,'flexure'),phi=requiredPositive('foundation.flexure.phi',p.phi),leverArmRatio=requiredPositive('foundation.flexure.leverArmRatio',p.leverArmRatio),Mu=absFinite('demand.Mu',demand.Mu),As=requiredPositive('reinforcement.As',reinforcement.As),fy=requiredPositive('materials.fy',materials.fy),d=requiredPositive('strip.d',strip.d),z=leverArmRatio*d,nominal=As*fy*z/1e6,resistance=phi*nominal;
  return designCheck({id:'foundation-flexure',discipline:'Foundation',limitState:'Flexão de faixa da fundação',demand:Mu,resistance,unit:'kN·m',profile,clause:profile.clauses?.foundationFlexure??null,equation:'Mn=As·fy·z; z=κz·d; MRd=φ·Mn',notes:['κz e φ são parâmetros explícitos do profile; esta formulação é uma verificação simplificada de faixa e não substitui compatibilidade de deformações quando exigida.'],details:{phi,leverArmRatio,As,fy,d,z,nominal}});
}
