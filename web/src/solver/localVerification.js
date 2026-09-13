import {normalizeConnectionPlateHoleConfig,solveConnectionPlateHoleAtDisplacement,solveConnectionPlateHoleContact} from './connectionPlateHoleContact2d.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const rel=(a,b)=>Math.abs(a-b)/Math.max(EPS,Math.abs(b));

function metrics(sol){
  if(!sol)throw new Error('Verificação local: solução ausente.');
  const areaErr=sol.area?.analyticalVoid>EPS?Math.abs(sol.area.void-sol.area.analyticalVoid)/sol.area.analyticalVoid:0;
  return{converged:Boolean(sol.converged),load:finite(sol.appliedLoad),peakPressureMPa:finite(sol.peakPressureMPa),maxVmMPa:finite(sol.maxVmMPa),maxOvalizationMm:finite(sol.maxOvalizationMm),forceResidual:Math.abs(finite(sol.equilibrium?.relativeFxResidual)),areaError:areaErr,symmetryError:mirrorYSymmetryError(sol.state?.holes||[])};
}
function mirrorYSymmetryError(holes){
  if(!Array.isArray(holes)||!holes.length)return 0;let err=0,count=0;
  for(const h of holes){const mate=holes.find(q=>q.id!==h.id&&Math.abs(q.x-h.x)<1e-8&&Math.abs(q.y+h.y)<1e-8);if(!mate)continue;err=Math.max(err,rel(h.peakPressureMPa,mate.peakPressureMPa),rel(h.resultant?.magnitude||0,mate.resultant?.magnitude||0));count++}
  return count?err:0;
}
function solveFinal(input,overrides={}){const c=normalizeConnectionPlateHoleConfig({...input,...overrides}),sol=solveConnectionPlateHoleAtDisplacement({...input,...c},c.edgeDisplacementMax);return{config:c,solution:sol,metrics:metrics(sol)}}
function convergenceSeries(input,variants,mapper){return variants.map(v=>{const patch=mapper(v);const run=solveFinal(input,patch);return{parameter:v,...run.metrics}})}
function lastDelta(series,key){if(series.length<2)return null;const a=series.at(-2)?.[key],b=series.at(-1)?.[key];return Number.isFinite(a)&&Number.isFinite(b)?rel(a,b):null}
function integrateExternalWork(curve){let w=0;for(let i=1;i<curve.length;i++){const a=curve[i-1],b=curve[i];w+=.5*(finite(a.load)+finite(b.load))*(finite(b.displacement)-finite(a.displacement))}return w}
function contactSpringEnergy(final){let w=0;for(const h of final?.state?.holes||[])for(const s of h.segments||[])if(s.active)w+=.5*h.contactNormalStiffness*s.penetration*s.penetration*s.area;return w}

export const DEFAULT_LOCAL_VERIFICATION_THRESHOLDS={mesh:0.05,quadrature:0.025,angular:0.025,knSensitivity:0.15,forceResidual:2e-3,areaError:0.05,symmetry:0.02};

/**
 * Verification harness for the explicit-hole contact Lab. It does not modify the
 * mechanics kernel; it repeatedly solves the same problem with controlled
 * discretization changes and reports observable convergence/sensitivity.
 */
export function runHoleContactVerification(input={},options={}){
  const c=normalizeConnectionPlateHoleConfig(input),thresholds={...DEFAULT_LOCAL_VERIFICATION_THRESHOLDS,...(options.thresholds||{})};
  const meshLevels=options.meshLevels||[[Math.max(3,c.meshX-2),Math.max(3,c.meshY-2)],[c.meshX,c.meshY],[Math.min(28,c.meshX+2),Math.min(22,c.meshY+2)]];
  const quadratureOrders=options.quadratureOrders||[Math.max(4,c.cutIntegrationOrder-4),c.cutIntegrationOrder,Math.min(18,c.cutIntegrationOrder+4)];
  const boundarySegments=options.boundarySegments||[Math.max(24,Math.round(c.boundarySegments/2)),c.boundarySegments,Math.min(180,c.boundarySegments*2)];
  const knFactors=options.knFactors||[.5,1,2];
  const reference=solveFinal(input,{});
  const mesh=convergenceSeries(input,meshLevels,v=>({meshX:v[0],meshY:v[1]}));
  const quadrature=convergenceSeries(input,quadratureOrders,v=>({cutIntegrationOrder:v}));
  const angular=convergenceSeries(input,boundarySegments,v=>({boundarySegments:v}));
  const kn=convergenceSeries(input,knFactors,v=>({contactNormalStiffness:c.contactNormalStiffness*v,bolts:(input.bolts||[]).map(b=>({...b,contactNormalStiffness:(b.contactNormalStiffness||c.contactNormalStiffness)*v}))}));
  const meshDelta=Math.max(lastDelta(mesh,'load')||0,lastDelta(mesh,'peakPressureMPa')||0),quadratureDelta=Math.max(lastDelta(quadrature,'load')||0,lastDelta(quadrature,'peakPressureMPa')||0),angularDelta=Math.max(lastDelta(angular,'load')||0,lastDelta(angular,'peakPressureMPa')||0);
  const knBase=kn.find(q=>q.parameter===1)||kn[Math.floor(kn.length/2)],knSpread=Math.max(...kn.map(q=>rel(q.load,knBase.load)),...kn.map(q=>rel(q.peakPressureMPa,knBase.peakPressureMPa)));
  const curve=solveConnectionPlateHoleContact({...input,...c}),externalWork=integrateExternalWork(curve.curve||[]),contactEnergy=contactSpringEnergy(curve.final),energyAccounting={externalWork,contactSpringEnergy:contactEnergy,plateAndPlasticRemainder:externalWork-contactEnergy,closed:false,note:'O restante reúne energia de deformação da chapa e dissipação plástica; o kernel atual não as separa, portanto não é apresentado como resíduo de energia.'};
  const warnings=[];
  if(!reference.metrics.converged)warnings.push('A solução de referência não convergiu.');
  if(meshDelta>thresholds.mesh)warnings.push(`Sensibilidade de malha ${(100*meshDelta).toFixed(1)}% > ${(100*thresholds.mesh).toFixed(1)}%.`);
  if(quadratureDelta>thresholds.quadrature)warnings.push(`Sensibilidade da quadratura cut-cell ${(100*quadratureDelta).toFixed(1)}% > ${(100*thresholds.quadrature).toFixed(1)}%.`);
  if(angularDelta>thresholds.angular)warnings.push(`Sensibilidade da discretização angular ${(100*angularDelta).toFixed(1)}% > ${(100*thresholds.angular).toFixed(1)}%.`);
  if(knSpread>thresholds.knSensitivity)warnings.push(`Sensibilidade a k_n ${(100*knSpread).toFixed(1)}% > ${(100*thresholds.knSensitivity).toFixed(1)}%; interprete pressão/ovalização com cautela.`);
  if(reference.metrics.forceResidual>thresholds.forceResidual)warnings.push(`Resíduo de equilíbrio ${(100*reference.metrics.forceResidual).toFixed(3)}% acima do limite.`);
  if(reference.metrics.areaError>thresholds.areaError)warnings.push(`Erro de área vazada ${(100*reference.metrics.areaError).toFixed(2)}% acima do limite.`);
  if(reference.metrics.symmetryError>thresholds.symmetry)warnings.push(`Erro de simetria ${(100*reference.metrics.symmetryError).toFixed(2)}% acima do limite.`);
  return{type:'local-verification-hole-contact',version:'0.30.9',reference:reference.metrics,studies:{mesh,quadrature,angular,kn},indicators:{meshDelta,quadratureDelta,angularDelta,knSpread,forceResidual:reference.metrics.forceResidual,areaError:reference.metrics.areaError,symmetryError:reference.metrics.symmetryError},thresholds,energyAccounting,warnings,adequate:warnings.length===0,provenance:{solverType:'connection-plate-hole-contact-2d',solverVersion:curve.solverVersion}};
}

export function verificationSummaryCsv(result){
  const rows=['study,parameter,converged,load_kN,peak_pressure_MPa,max_vm_MPa,ovalization_mm,force_residual,area_error,symmetry_error'];
  for(const [study,series] of Object.entries(result.studies||{}))for(const p of series)rows.push([study,Array.isArray(p.parameter)?p.parameter.join('x'):p.parameter,p.converged?1:0,p.load,p.peakPressureMPa,p.maxVmMPa,p.maxOvalizationMm,p.forceResidual,p.areaError,p.symmetryError].join(','));
  return rows.join('\n');
}
