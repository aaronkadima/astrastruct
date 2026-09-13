import {designCheck,requiredFinite,requiredPositive,requiredNonnegative} from './engine.js';

function steelParams(profile){const p=profile?.parameters?.steel;if(!p)throw new Error('CodeDesign Steel: profile.parameters.steel é obrigatório.');return p}

export function steelGrossYieldStrengths({profile,section={},materials={}}={}){
  const p=steelParams(profile),Fy=requiredPositive('materials.Fy',materials.Fy),Ag=requiredPositive('section.Ag',section.Ag),Zy=requiredNonnegative('section.Zy',section.Zy??0),Zz=requiredNonnegative('section.Zz',section.Zz??0),Aw=requiredNonnegative('section.Aw',section.Aw??0),phiTension=requiredPositive('steel.phiTension',p.phiTension),phiBending=requiredPositive('steel.phiBending',p.phiBending),phiShear=requiredPositive('steel.phiShear',p.phiShear),shearCoefficient=requiredNonnegative('steel.shearCoefficient',p.shearCoefficient);
  return{contract:'steel-basic-strengths/v1',profileId:profile.id,nominal:{tension:Ag*Fy/1000,momentY:Fy*Zy/1e6,momentZ:Fy*Zz/1e6,shear:shearCoefficient*Fy*Aw/1000},design:{tension:phiTension*Ag*Fy/1000,momentY:phiBending*Fy*Zy/1e6,momentZ:phiBending*Fy*Zz/1e6,shear:phiShear*shearCoefficient*Fy*Aw/1000},assumptions:['Resistências de escoamento da seção bruta/plástica apenas; não substituem flambagem global/local, LTB, ruptura líquida ou block shear.']};
}

export function steelMemberDesign({profile,demand={},resistances={}}={}){
  const p=steelParams(profile),Pu=Math.abs(requiredFinite('demand.Pu',demand.Pu??0)),Muy=Math.abs(requiredFinite('demand.Muy',demand.Muy??0)),Muz=Math.abs(requiredFinite('demand.Muz',demand.Muz??0)),Vu=Math.abs(requiredFinite('demand.Vu',demand.Vu??0)),mode=String(demand.axialMode||'compression').toLowerCase();
  const axial=mode==='tension'?requiredPositive('resistances.tension',resistances.tension):requiredPositive('resistances.compression',resistances.compression),My=requiredPositive('resistances.momentY',resistances.momentY),Mz=requiredPositive('resistances.momentZ',resistances.momentZ),V=requiredPositive('resistances.shear',resistances.shear),axialExponent=requiredPositive('steel.interaction.axialExponent',p.interaction?.axialExponent),bendingExponent=requiredPositive('steel.interaction.bendingExponent',p.interaction?.bendingExponent),interactionLimit=requiredPositive('steel.interaction.limit',p.interaction?.limit),interaction=Pu/axial;
  const bending=Math.pow(Muy/My,bendingExponent)+Math.pow(Muz/Mz,bendingExponent),combined=Math.pow(interaction,axialExponent)+bending;
  const checks=[
    designCheck({id:'steel-axial',discipline:'Steel',limitState:mode==='tension'?'Tração axial':'Compressão axial',demand:Pu,resistance:axial,unit:'kN',profile,clause:profile.clauses?.steelAxial??null,equation:'Demand ≤ design axial resistance',notes:mode==='compression'?['A resistência de compressão deve já incluir flambagem/local buckling conforme o profile normativo aplicável.']:[],details:{mode}}),
    designCheck({id:'steel-bending-y',discipline:'Steel',limitState:'Flexão eixo y',demand:Muy,resistance:My,unit:'kN·m',profile,clause:profile.clauses?.steelBending??null,equation:'Muy ≤ M_Rd,y'}),
    designCheck({id:'steel-bending-z',discipline:'Steel',limitState:'Flexão eixo z',demand:Muz,resistance:Mz,unit:'kN·m',profile,clause:profile.clauses?.steelBending??null,equation:'Muz ≤ M_Rd,z'}),
    designCheck({id:'steel-shear',discipline:'Steel',limitState:'Cisalhamento',demand:Vu,resistance:V,unit:'kN',profile,clause:profile.clauses?.steelShear??null,equation:'Vu ≤ V_Rd'}),
    designCheck({id:'steel-interaction',discipline:'Steel',limitState:'Interação axial–flexão biaxial',demand:combined,resistance:interactionLimit,unit:'-',profile,clause:profile.clauses?.steelInteraction??null,equation:'(Pu/PRd)^p + (Muy/MyRd)^q + (Muz/MzRd)^q ≤ limit',notes:['Expoentes e limite de interação são parâmetros explícitos do profile.'],details:{axialRatio:interaction,bendingRatio:bending,axialExponent,bendingExponent,interactionLimit}})
  ];
  return checks;
}
