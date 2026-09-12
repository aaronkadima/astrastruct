import { migrateProject } from './migrations.js';
import { analysisConfigFromSettings } from './analysisConfig.js';
import { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION, productMetadata } from './version.js';

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const MATERIALS = [
  { id: 'concrete30', name: 'Concreto C30 (exemplo)', type: 'concrete', E: 30e6, nu: 0.20, density: 25, alpha: 10e-6, fck: 30, fctm: 2.9, fy: null, unit: 'kN/m²', verified: false },
  { id: 'steel355', name: 'Aço estrutural fy=355 MPa (exemplo)', type: 'steel', E: 200e6, nu: 0.30, density: 78.5, alpha: 12e-6, fy: 355, fu: 510, unit: 'kN/m²', verified: false },
  { id: 'rebar500', name: 'Aço de armadura fy=500 MPa (exemplo)', type: 'rebar', E: 210e6, nu: 0.30, density: 78.5, alpha: 12e-6, fy: 500, fu: 550, unit: 'kN/m²', verified: false },
  { id: 'grout30', name: 'Graute 30 MPa (exemplo)', type: 'grout', E: 25e6, nu: 0.20, density: 23, alpha: 10e-6, fck: 30, unit: 'kN/m²', verified: false }
];

export const SECTIONS = [
  { id: 'rc_30x50', name: 'RC retangular 30 × 50 cm', family: 'rect', b: 0.30, h: 0.50, A: 0.150, I: 0.003125 },
  { id: 'rc_30x60', name: 'RC retangular 30 × 60 cm', family: 'rect', b: 0.30, h: 0.60, A: 0.180, I: 0.005400 },
  { id: 'steel_generic', name: 'Aço — seção genérica', family: 'steel', A: 0.012, I: 0.000220 },
  { id: 'steel_i_400x200_demo', name: 'Aço — perfil I 400 × 200 mm (exemplo)', family: 'i', h: 0.400, b: 0.200, tw: 0.010, tf: 0.016, A: 0.010080, I: 0.00027759616 },
  { id: 'truss_generic', name: 'Barra axial — seção genérica', family: 'truss', A: 0.004, I: 0 }
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function defaultAlpha(type) { return type === 'steel' || type === 'rebar' ? 12e-6 : 10e-6; }
function normalizeRotationalSpring(value) {
  if (value === null || value === undefined || value === '') return null;
  const k = Number(value);
  return Number.isFinite(k) ? Math.max(0, k) : null;
}

export function sectionDepth(section) {
  if (!section) return 0;
  if (Number(section.h) > 0) return Number(section.h);
  if (Number(section.d) > 0) return Number(section.d);
  if (Number(section.depth) > 0) return Number(section.depth);
  if (Number(section.cY) > 0) return 2 * Number(section.cY);
  return 0;
}

export function emptyProject() {
  return {
    id: uid('project'), name: 'Novo projeto', version: 13, schemaVersion: PROJECT_SCHEMA_VERSION, units: 'kN-m-MPa',
    nodes: [], elements: [], materials: clone(MATERIALS), sections: clone(SECTIONS), supports: [],
    loads: [], elementLoads: [], settlements: [], nodeSprings: [], nodalMasses: [],
    loadCases: [{ id: 'LC1', name: 'Caso 1', type: 'user' }],
    loadCombinations: [{ id: 'COMB1', name: 'Combinação customizada 1', type: 'custom', terms: [{ caseId: 'LC1', factor: 1.0 }] }],
    connections: [], results: null,
    settings: {
      grid: 0.25, snap: true, deformationScale: 1,
      activeLoadCaseId: 'LC1', analysisScenarioId: 'LC1',
      analysisType: 'linear', pDeltaMaxIterations: 30, pDeltaTolerance: 1e-8,
      nonlinearSteps: 20, nonlinearMaxIterations: 35, nonlinearTolerance: 1e-8, nonlinearLineSearch: true,
      nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,
      cyclicProtocolEnabled: false, cyclicProtocolTargets: [-0.02,0.02,-0.04,0.04,0], cyclicStepsPerSegment: 6,
      arcLengthMonitorNodeId: null, arcLengthMonitorDof: 'uy', arcLengthInitialLoadIncrement: 0.05, arcLengthInitialSign: 1, arcLengthTargetIterations: 6, arcLengthMaxCutbacks: 8, arcLengthMinRadiusFactor: 0.02, arcLengthMaxRadiusFactor: 4, arcLengthConstraintTolerance: 1e-6,
      stabilityTracking: true, stabilityEigenTolerance: 0.05, stabilityAsymmetryTolerance: 1e-6, stabilityMaxDofs: 120, stabilityModeCount: 4, stabilityClusterTolerance: 0.03, stabilityMacThreshold: 0.25, branchExploreEnabled: false, branchExploreAmplitude: 0.08, branchExploreMaxIterations: 30, branchExploreMaxEvents: 3, branchSwitchEnabled: false, branchSwitchSign: 1, branchSwitchAmplitude: 0.08,
      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',
      dynamicMassFormulation: 'consistent', modalModes: 6, dynamicDampingRatio: 0.02, dynamicRayleighMode1: 1, dynamicRayleighMode2: 2, dynamicTimeStep: 0.01, dynamicDuration: 1, dynamicMonitorNodeId: null, dynamicMonitorDof: 'uy', dynamicHistoryPoints: [{t:0,scale:0},{t:0.1,scale:1},{t:1,scale:0}], dynamicExcitationType: 'load-pattern', dynamicGroundMotionDirection: 'x', dynamicGroundMotionPoints: [{t:0,accelG:0},{t:0.05,accelG:0.15},{t:0.10,accelG:0},{t:0.15,accelG:-0.10},{t:0.20,accelG:0}], dynamicGroundMotionPointsY: [{t:0,accelG:0},{t:0.05,accelG:0.10},{t:0.10,accelG:0},{t:0.15,accelG:-0.06},{t:0.20,accelG:0}], groundMotionBaselineCorrection: 'linear', groundMotionTaperRatio: 0.02, groundMotionHighPassHz: 0, groundMotionLowPassHz: 0, groundMotionResampleDt: 0, groundMotionScaleFactor: 1, dynamicGroundMotionLibrary: [], responseSpectrumCombination: 'cqc', responseSpectrumDirectionalCombination: 'srss', responseSpectrumPeriodMin: 0.02, responseSpectrumPeriodMax: 4, responseSpectrumPeriodPoints: 80, responseSpectrumTargetPoints: [],
      imperfection: { enabled: false, source: 'bucklingMode', scenarioId: null, mode: 1, amplitudeMm: 10 }
    },
    meta: { solverVersion: '0.13.6-exp', productVersion: PRODUCT_VERSION, schemaVersion: PROJECT_SCHEMA_VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  };
}

export function normalizeProject(input) {
  const base = emptyProject(), p = { ...base, ...migrateProject(input || {}) };
  p.nodes = Array.isArray(p.nodes) ? p.nodes : [];
  p.elements = Array.isArray(p.elements) ? p.elements : [];
  p.materials = Array.isArray(p.materials) && p.materials.length ? p.materials : clone(MATERIALS);
  p.sections = Array.isArray(p.sections) && p.sections.length ? p.sections : clone(SECTIONS);
  p.supports = Array.isArray(p.supports) ? p.supports : [];
  p.loads = Array.isArray(p.loads) ? p.loads : [];
  p.elementLoads = Array.isArray(p.elementLoads) ? p.elementLoads : [];
  p.settlements = Array.isArray(p.settlements) ? p.settlements : [];
  p.nodeSprings = Array.isArray(p.nodeSprings) ? p.nodeSprings : [];
  p.nodalMasses = Array.isArray(p.nodalMasses) ? p.nodalMasses : [];
  p.loadCases = Array.isArray(p.loadCases) && p.loadCases.length ? p.loadCases : clone(base.loadCases);
  p.loadCombinations = Array.isArray(p.loadCombinations) ? p.loadCombinations : clone(base.loadCombinations);
  p.connections = Array.isArray(p.connections) ? p.connections : [];
  p.settings = { ...base.settings, ...(p.settings || {}), imperfection: { ...base.settings.imperfection, ...(p.settings?.imperfection || {}) } };
  const analysisType=String(p.settings.analysisType||'linear');
  p.settings.analysisType = ['pdelta','corotational','modal','time-history','response-spectrum'].includes(analysisType) ? analysisType : 'linear';
  p.settings.pDeltaMaxIterations = Math.max(2, Math.min(100, Math.round(Number(p.settings.pDeltaMaxIterations) || 30)));
  p.settings.pDeltaTolerance = Math.max(1e-12, Number(p.settings.pDeltaTolerance) || 1e-8);
  p.settings.nonlinearSteps = Math.max(1, Math.min(200, Math.round(Number(p.settings.nonlinearSteps) || 20)));
  p.settings.nonlinearMaxIterations = Math.max(3, Math.min(100, Math.round(Number(p.settings.nonlinearMaxIterations) || 35)));
  p.settings.nonlinearTolerance = Math.max(1e-12, Number(p.settings.nonlinearTolerance) || 1e-8);
  p.settings.nonlinearLineSearch = p.settings.nonlinearLineSearch !== false;
  p.settings.nonlinearControlMode = p.settings.nonlinearControlMode === 'arc-length' ? 'arc-length' : (p.settings.nonlinearControlMode === 'displacement' ? 'displacement' : 'load');
  p.settings.displacementControlNodeId = p.settings.displacementControlNodeId || null;
  p.settings.displacementControlDof = ['ux','uy','rz'].includes(p.settings.displacementControlDof) ? p.settings.displacementControlDof : 'uy';
  p.settings.displacementControlTarget = Number.isFinite(Number(p.settings.displacementControlTarget)) && Math.abs(Number(p.settings.displacementControlTarget)) > 1e-12 ? Number(p.settings.displacementControlTarget) : -0.05;
  p.settings.displacementControlTolerance = Math.max(1e-10, Number(p.settings.displacementControlTolerance) || 1e-7);
  p.settings.cyclicProtocolEnabled = !!p.settings.cyclicProtocolEnabled;
  p.settings.cyclicProtocolTargets = (Array.isArray(p.settings.cyclicProtocolTargets)?p.settings.cyclicProtocolTargets:[]).map(Number).filter(Number.isFinite).slice(0,30);
  if(!p.settings.cyclicProtocolTargets.length)p.settings.cyclicProtocolTargets=[-0.02,0.02,-0.04,0.04,0];
  p.settings.cyclicStepsPerSegment = Math.max(2, Math.min(60, Math.round(Number(p.settings.cyclicStepsPerSegment) || 6)));
  p.settings.arcLengthMonitorNodeId = p.settings.arcLengthMonitorNodeId || null;
  p.settings.arcLengthMonitorDof = ['ux','uy','rz'].includes(p.settings.arcLengthMonitorDof) ? p.settings.arcLengthMonitorDof : 'uy';
  p.settings.arcLengthInitialLoadIncrement = Math.max(1e-5, Math.abs(Number(p.settings.arcLengthInitialLoadIncrement) || 0.05));
  p.settings.arcLengthInitialSign = Number(p.settings.arcLengthInitialSign) < 0 ? -1 : 1;
  p.settings.arcLengthTargetIterations = Math.max(2, Math.min(20, Math.round(Number(p.settings.arcLengthTargetIterations) || 6)));
  p.settings.arcLengthMaxCutbacks = Math.max(0, Math.min(16, Math.round(Number(p.settings.arcLengthMaxCutbacks) || 8)));
  p.settings.arcLengthMinRadiusFactor = Math.max(1e-4, Math.min(1, Number(p.settings.arcLengthMinRadiusFactor) || 0.02));
  p.settings.arcLengthMaxRadiusFactor = Math.max(1, Number(p.settings.arcLengthMaxRadiusFactor) || 4);
  p.settings.arcLengthConstraintTolerance = Math.max(1e-10, Number(p.settings.arcLengthConstraintTolerance) || 1e-6);
  p.settings.stabilityTracking = p.settings.stabilityTracking !== false;
  p.settings.stabilityEigenTolerance = Math.max(1e-5, Math.min(1, Math.abs(Number(p.settings.stabilityEigenTolerance) || 0.05)));
  p.settings.stabilityAsymmetryTolerance = Math.max(1e-12, Math.min(0.1, Math.abs(Number(p.settings.stabilityAsymmetryTolerance) || 1e-6)));
  p.settings.stabilityMaxDofs = Math.max(6, Math.min(500, Math.round(Number(p.settings.stabilityMaxDofs) || 120)));
  p.settings.stabilityModeCount = Math.max(1, Math.min(12, Math.round(Number(p.settings.stabilityModeCount) || 4)));
  p.settings.stabilityClusterTolerance = Math.max(1e-6, Math.min(0.5, Math.abs(Number(p.settings.stabilityClusterTolerance) || 0.03)));
  p.settings.stabilityMacThreshold = Math.max(0, Math.min(1, Number(p.settings.stabilityMacThreshold) || 0.25));
  p.settings.branchExploreEnabled = !!p.settings.branchExploreEnabled;
  p.settings.branchExploreAmplitude = Math.max(1e-4, Math.min(0.45, Math.abs(Number(p.settings.branchExploreAmplitude) || 0.08)));
  p.settings.branchExploreMaxIterations = Math.max(5, Math.min(80, Math.round(Number(p.settings.branchExploreMaxIterations) || 30)));
  p.settings.branchExploreMaxEvents = Math.max(1, Math.min(12, Math.round(Number(p.settings.branchExploreMaxEvents) || 3)));
  p.settings.branchSwitchEnabled = !!p.settings.branchSwitchEnabled;
  p.settings.branchSwitchSign = Number(p.settings.branchSwitchSign) < 0 ? -1 : 1;
  p.settings.branchSwitchAmplitude = Math.max(1e-4, Math.min(0.45, Math.abs(Number(p.settings.branchSwitchAmplitude) || 0.08)));
  p.settings.materialMaxIterations = Math.max(3, Math.min(80, Math.round(Number(p.settings.materialMaxIterations) || 30)));
  p.settings.materialTolerance = Math.max(1e-10, Number(p.settings.materialTolerance) || 1e-6);
  p.settings.materialRelaxation = Math.max(.2, Math.min(1, Number(p.settings.materialRelaxation) || 1));
  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';
  p.settings.dynamicMassFormulation = p.settings.dynamicMassFormulation === 'lumped' ? 'lumped' : 'consistent';
  p.settings.modalModes = Math.max(1, Math.min(20, Math.round(Number(p.settings.modalModes) || 6)));
  p.settings.dynamicDampingRatio = Math.max(0, Math.min(.30, Number(p.settings.dynamicDampingRatio) || 0));
  p.settings.dynamicRayleighMode1 = Math.max(1, Math.min(20, Math.round(Number(p.settings.dynamicRayleighMode1) || 1)));
  p.settings.dynamicRayleighMode2 = Math.max(1, Math.min(20, Math.round(Number(p.settings.dynamicRayleighMode2) || 2)));
  p.settings.dynamicTimeStep = Math.max(1e-5, Number(p.settings.dynamicTimeStep) || .01);
  p.settings.dynamicDuration = Math.max(p.settings.dynamicTimeStep, Number(p.settings.dynamicDuration) || 1);
  p.settings.dynamicMonitorNodeId = p.settings.dynamicMonitorNodeId || null;
  p.settings.dynamicMonitorDof = ['ux','uy','rz'].includes(p.settings.dynamicMonitorDof) ? p.settings.dynamicMonitorDof : 'uy';
  p.settings.dynamicHistoryPoints = (Array.isArray(p.settings.dynamicHistoryPoints)?p.settings.dynamicHistoryPoints:[]).map(x=>({t:Number(x?.t),scale:Number(x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.scale)).sort((a,b)=>a.t-b.t).slice(0,200);
  if(p.settings.dynamicHistoryPoints.length<2)p.settings.dynamicHistoryPoints=[{t:0,scale:0},{t:.1,scale:1},{t:1,scale:0}];
  p.settings.dynamicExcitationType = p.settings.dynamicExcitationType === 'base-acceleration' ? 'base-acceleration' : 'load-pattern';
  p.settings.dynamicGroundMotionDirection = ['x','y','xy'].includes(p.settings.dynamicGroundMotionDirection) ? p.settings.dynamicGroundMotionDirection : 'x';
  const normGround=raw=>(Array.isArray(raw)?raw:[]).map(x=>({t:Number(x?.t),accelG:Number(x?.accelG??x?.accelerationG??x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.accelG)).sort((a,b)=>a.t-b.t).slice(0,10000);
  p.settings.dynamicGroundMotionPoints = normGround(p.settings.dynamicGroundMotionPoints);
  if(p.settings.dynamicGroundMotionPoints.length<2)p.settings.dynamicGroundMotionPoints=[{t:0,accelG:0},{t:.05,accelG:.15},{t:.10,accelG:0},{t:.15,accelG:-.10},{t:.20,accelG:0}];
  p.settings.dynamicGroundMotionPointsY = normGround(p.settings.dynamicGroundMotionPointsY);
  if(p.settings.dynamicGroundMotionPointsY.length<2)p.settings.dynamicGroundMotionPointsY=[{t:0,accelG:0},{t:.05,accelG:.10},{t:.10,accelG:0},{t:.15,accelG:-.06},{t:.20,accelG:0}];
  p.settings.groundMotionBaselineCorrection = ['none','mean','linear'].includes(p.settings.groundMotionBaselineCorrection) ? p.settings.groundMotionBaselineCorrection : 'linear';
  p.settings.groundMotionTaperRatio = Math.max(0,Math.min(.25,Number(p.settings.groundMotionTaperRatio) || 0));
  p.settings.groundMotionHighPassHz = Math.max(0,Number(p.settings.groundMotionHighPassHz) || 0);
  p.settings.groundMotionLowPassHz = Math.max(0,Number(p.settings.groundMotionLowPassHz) || 0);
  p.settings.groundMotionResampleDt = Math.max(0,Number(p.settings.groundMotionResampleDt) || 0);
  p.settings.groundMotionScaleFactor = Number.isFinite(Number(p.settings.groundMotionScaleFactor)) ? Number(p.settings.groundMotionScaleFactor) : 1;
  p.settings.dynamicGroundMotionLibrary = (Array.isArray(p.settings.dynamicGroundMotionLibrary)?p.settings.dynamicGroundMotionLibrary:[]).slice(0,12).map((r,i)=>({id:String(r?.id||`GM${i+1}`),name:String(r?.name||`Registro ${i+1}`),x:normGround(r?.x),y:normGround(r?.y)})).filter(r=>r.x.length>=2);
  p.settings.responseSpectrumCombination = p.settings.responseSpectrumCombination === 'srss' ? 'srss' : 'cqc';
  p.settings.responseSpectrumDirectionalCombination = p.settings.responseSpectrumDirectionalCombination === '100-30' ? '100-30' : 'srss';
  p.settings.responseSpectrumPeriodMin = Math.max(0.001, Number(p.settings.responseSpectrumPeriodMin) || .02);
  p.settings.responseSpectrumPeriodMax = Math.max(p.settings.responseSpectrumPeriodMin, Number(p.settings.responseSpectrumPeriodMax) || 4);
  p.settings.responseSpectrumPeriodPoints = Math.max(10, Math.min(300, Math.round(Number(p.settings.responseSpectrumPeriodPoints) || 80)));
  p.settings.responseSpectrumTargetPoints = (Array.isArray(p.settings.responseSpectrumTargetPoints)?p.settings.responseSpectrumTargetPoints:[]).map(x=>({period:Number(x?.period??x?.t),saG:Number(x?.saG??x?.sa)})).filter(x=>Number.isFinite(x.period)&&x.period>0&&Number.isFinite(x.saG)&&x.saG>0).sort((a,b)=>a.period-b.period).slice(0,500);
  p.settings.imperfection.enabled = !!p.settings.imperfection.enabled;
  p.settings.imperfection.source = p.settings.imperfection.source === 'bucklingMode' ? 'bucklingMode' : 'bucklingMode';
  p.settings.imperfection.scenarioId = p.settings.imperfection.scenarioId || null;
  p.settings.imperfection.mode = Math.max(1, Math.min(12, Math.round(Number(p.settings.imperfection.mode) || 1)));
  p.settings.imperfection.amplitudeMm = Number.isFinite(Number(p.settings.imperfection.amplitudeMm)) && Number(p.settings.imperfection.amplitudeMm) > 0 ? Number(p.settings.imperfection.amplitudeMm) : 10;
  p.analysis = analysisConfigFromSettings(p.settings);
  p.schemaVersion = PROJECT_SCHEMA_VERSION;
  p.meta = productMetadata({ ...base.meta, ...(p.meta || {}), solverVersion: '0.13.6-exp', updatedAt: new Date().toISOString() });
  p.version = 13; // legacy compatibility marker; schemaVersion is authoritative.


  const firstCaseId = p.loadCases[0]?.id || 'LC1';
  p.loads = p.loads.map(l => ({ ...l, caseId: l.caseId || firstCaseId }));
  p.elementLoads = p.elementLoads.map(l => {
    const out={ ...l, caseId: l.caseId || firstCaseId };
    if(out.kind==='followerEnd'){
      out.end=Number(out.end??2);
      out.px=Number(out.px)||0;
      out.py=Number(out.py)||0;
    }
    return out;
  });
  p.settlements = p.settlements.map(s => ({ ...s, caseId: s.caseId || firstCaseId, ux: Number(s.ux)||0, uy: Number(s.uy)||0, rz: Number(s.rz)||0 }));
  p.nodeSprings = p.nodeSprings.map(s => ({ ...s, id: s.id || uid('SPR'), kx: Math.max(0, Number(s.kx)||0), ky: Math.max(0, Number(s.ky)||0), kr: Math.max(0, Number(s.kr)||0) }));
  p.nodalMasses = p.nodalMasses.map(m => ({ ...m, id: m.id || uid('MASS'), mx: Math.max(0, Number(m.mx)||0), my: Math.max(0, Number(m.my)||0), mr: Math.max(0, Number(m.mr)||0) })).filter(m=>m.nodeId&&(m.mx>0||m.my>0||m.mr>0));
  p.materials = p.materials.map(m => ({ ...m, alpha: Number.isFinite(Number(m.alpha)) ? Number(m.alpha) : defaultAlpha(m.type) }));
  p.elements = p.elements.map(e => {
    const releases = { rz1: false, rz2: false, ...(e.releases || {}) };
    const rotationalSprings = {
      rz1: normalizeRotationalSpring(e.rotationalSprings?.rz1),
      rz2: normalizeRotationalSpring(e.rotationalSprings?.rz2)
    };
    if (releases.rz1) rotationalSprings.rz1 = 0;
    if (releases.rz2) rotationalSprings.rz2 = 0;
    const rawDp=e.distributedPlasticity||{},integrationPoints=[3,5].includes(Math.round(Number(rawDp.integrationPoints)))?Math.round(Number(rawDp.integrationPoints)):5,distributedPlasticity={enabled:!!rawDp.enabled,integrationPoints,nFibers:Math.max(8,Math.min(400,Math.round(Number(rawDp.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(rawDp.hardeningRatio)||.01))),cyclic:!!rawDp.cyclic,kinematicFraction:Math.max(0,Math.min(1,Number.isFinite(Number(rawDp.kinematicFraction))?Number(rawDp.kinematicFraction):1))};
    const normHinge=(raw={})=>({enabled:!!raw.enabled,hingeLength:Math.max(1e-4,Number(raw.hingeLength)||.35),nFibers:Math.max(8,Math.min(400,Math.round(Number(raw.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(raw.hardeningRatio)||.01))),cyclic:!!raw.cyclic,kinematicFraction:Math.max(0,Math.min(1,Number.isFinite(Number(raw.kinematicFraction))?Number(raw.kinematicFraction):1))});
    const fiberHinges={rz1:normHinge(e.fiberHinges?.rz1),rz2:normHinge(e.fiberHinges?.rz2)};
    return { ...e, releases, rotationalSprings, distributedPlasticity, fiberHinges };
  });
  p.supports = p.supports.map(s => ({
    ...s,
    baseUxValue: Number(s.baseUxValue) || 0,
    baseUyValue: Number(s.baseUyValue) || 0,
    baseRzValue: Number(s.baseRzValue) || 0
  }));

  const validCaseIds = new Set(p.loadCases.map(c => c.id));
  const validNodeIds = new Set(p.nodes.map(n => n.id));
  p.loads = p.loads.filter(l => validCaseIds.has(l.caseId));
  p.elementLoads = p.elementLoads.filter(l => validCaseIds.has(l.caseId));
  p.settlements = p.settlements.filter(s => validCaseIds.has(s.caseId));
  p.nodeSprings = p.nodeSprings.filter(s => validNodeIds.has(s.nodeId) && (s.kx || s.ky || s.kr));
  p.loadCombinations = p.loadCombinations.map(c => ({
    ...c, type: c.type || 'custom',
    terms: (c.terms || []).filter(t => validCaseIds.has(t.caseId)).map(t => ({ caseId: t.caseId, factor: Number(t.factor) || 0 }))
  }));
  if (!validCaseIds.has(p.settings.activeLoadCaseId)) p.settings.activeLoadCaseId = firstCaseId;
  const validScenarioIds = new Set([...p.loadCases.map(c => c.id), ...p.loadCombinations.map(c => c.id)]);
  if (!validScenarioIds.has(p.settings.analysisScenarioId)) p.settings.analysisScenarioId = firstCaseId;
  if (p.settings.imperfection.scenarioId && !validScenarioIds.has(p.settings.imperfection.scenarioId)) p.settings.imperfection.scenarioId = null;
  return p;
}

export function makeFrameElement({ id = uid('E'), n1, n2, materialId = 'concrete30', sectionId = 'rc_30x50', label = 'Pórtico 2D', A, I } = {}) {
  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS[0];
  return { id, type: 'frame2d', n1, n2, materialId, sectionId, A: A ?? section.A, I: I ?? section.I, releases: { rz1: false, rz2: false }, rotationalSprings: { rz1: null, rz2: null }, label };
}

export function makeTrussElement({ id = uid('E'), n1, n2, materialId = 'steel355', sectionId = 'truss_generic', label = 'Treliça 2D', A } = {}) {
  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS.find(s => s.id === 'truss_generic');
  return { id, type: 'truss2d', n1, n2, materialId, sectionId, A: A ?? section.A, I: 0, releases: { rz1: true, rz2: true }, rotationalSprings: { rz1: 0, rz2: 0 }, label };
}

export function demoFrame() {
  const p = emptyProject(); p.name = 'Pórtico demonstrativo';
  p.nodes = [{ id:'N1',x:0,y:0 },{ id:'N2',x:0,y:3 },{ id:'N3',x:5,y:3 },{ id:'N4',x:5,y:0 }];
  p.elements = [
    makeFrameElement({ id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x60',A:.18,I:.0054,label:'Pilar 1' }),
    makeFrameElement({ id:'E2',n1:'N2',n2:'N3',sectionId:'rc_30x50',label:'Viga' }),
    makeFrameElement({ id:'E3',n1:'N3',n2:'N4',sectionId:'rc_30x60',A:.18,I:.0054,label:'Pilar 2' })
  ];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N4',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:20,fy:0,mz:0},{id:'L2',caseId:'LC1',nodeId:'N3',fx:0,fy:-40,mz:0}]; return p;
}

export function demoBeamUDL() {
  const p=emptyProject();p.name='Viga biapoiada — carga distribuída';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:3,y:0},{id:'N3',x:6,y:0}];
  p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',label:'Viga — trecho 1'}),makeFrameElement({id:'E2',n1:'N2',n2:'N3',label:'Viga — trecho 2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N3',ux:false,uy:true,rz:false}];
  p.elementLoads=[{id:'EL1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20},{id:'EL2',caseId:'LC1',elementId:'E2',kind:'uniform',qx:0,qy:-20}];return p;
}

export function demoTruss() {
  const p=emptyProject();p.name='Treliça demonstrativa';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0},{id:'N3',x:2,y:3}];
  p.elements=[makeTrussElement({id:'E1',n1:'N1',n2:'N3',label:'Barra 1'}),makeTrussElement({id:'E2',n1:'N3',n2:'N2',label:'Barra 2'}),makeTrussElement({id:'E3',n1:'N1',n2:'N2',label:'Barra 3'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[{id:'L1',caseId:'LC1',nodeId:'N3',fx:0,fy:-100,mz:0}];return p;
}

export function demoMixed() {
  const p=emptyProject();p.name='Pórtico contraventado misto';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:0,y:3},{id:'N3',x:5,y:3},{id:'N4',x:5,y:0}];
  p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'steel_generic',A:.012,I:.00022,label:'Coluna 1'}),makeFrameElement({id:'E2',n1:'N2',n2:'N3',materialId:'steel355',sectionId:'steel_generic',A:.012,I:.00022,label:'Viga'}),makeFrameElement({id:'E3',n1:'N3',n2:'N4',materialId:'steel355',sectionId:'steel_generic',A:.012,I:.00022,label:'Coluna 2'}),makeTrussElement({id:'E4',n1:'N1',n2:'N3',materialId:'steel355',A:.004,label:'Contraventamento'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N4',ux:true,uy:true,rz:true}];p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:50,fy:0,mz:0}];return p;
}

export function demoLoadCases() {
  const p=demoFrame();p.name='Pórtico — casos e combinação';
  p.loadCases=[{id:'G',name:'Permanente (exemplo)',type:'permanent'},{id:'Q',name:'Variável (exemplo)',type:'variable'}];
  p.loads=[{id:'LG1',caseId:'G',nodeId:'N3',fx:0,fy:-30,mz:0},{id:'LQ1',caseId:'Q',nodeId:'N2',fx:25,fy:0,mz:0}];
  p.elementLoads=[{id:'EG1',caseId:'G',elementId:'E2',kind:'uniform',qx:0,qy:-8}];
  p.loadCombinations=[{id:'COMB1',name:'Combinação customizada demonstrativa',type:'custom',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}];
  p.settings.activeLoadCaseId='G';p.settings.analysisScenarioId='COMB1';return p;
}
