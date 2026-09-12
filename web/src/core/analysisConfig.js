const pick = (source, keys) => Object.fromEntries(keys.filter(k => source?.[k] !== undefined).map(k => [k, source[k]]));

const STATIC_KEYS = [
  'analysisType','analysisScenarioId','pDeltaMaxIterations','pDeltaTolerance','imperfection'
];
const NONLINEAR_KEYS = [
  'nonlinearSteps','nonlinearMaxIterations','nonlinearTolerance','nonlinearLineSearch','nonlinearControlMode',
  'displacementControlNodeId','displacementControlDof','displacementControlTarget','displacementControlTolerance',
  'cyclicProtocolEnabled','cyclicProtocolTargets','cyclicStepsPerSegment',
  'arcLengthMonitorNodeId','arcLengthMonitorDof','arcLengthInitialLoadIncrement','arcLengthInitialSign',
  'arcLengthTargetIterations','arcLengthMaxCutbacks','arcLengthMinRadiusFactor','arcLengthMaxRadiusFactor',
  'arcLengthConstraintTolerance','stabilityTracking','stabilityEigenTolerance','stabilityAsymmetryTolerance',
  'stabilityMaxDofs','stabilityModeCount','stabilityClusterTolerance','stabilityMacThreshold',
  'branchExploreEnabled','branchExploreAmplitude','branchExploreMaxIterations','branchExploreMaxEvents',
  'branchSwitchEnabled','branchSwitchSign','branchSwitchAmplitude','materialMaxIterations','materialTolerance',
  'materialRelaxation','materialCoupling'
];
const DYNAMIC_KEYS = [
  'dynamicMassFormulation','modalModes','dynamicDampingRatio','dynamicRayleighMode1','dynamicRayleighMode2',
  'dynamicTimeStep','dynamicDuration','dynamicMonitorNodeId','dynamicMonitorDof','dynamicHistoryPoints',
  'dynamicExcitationType'
];
const SEISMIC_KEYS = [
  'dynamicGroundMotionDirection','dynamicGroundMotionPoints','dynamicGroundMotionPointsY','groundMotionBaselineCorrection',
  'groundMotionTaperRatio','groundMotionHighPassHz','groundMotionLowPassHz','groundMotionResampleDt','groundMotionScaleFactor',
  'dynamicGroundMotionLibrary','responseSpectrumCombination','responseSpectrumDirectionalCombination',
  'responseSpectrumPeriodMin','responseSpectrumPeriodMax','responseSpectrumPeriodPoints','responseSpectrumTargetPoints'
];
const MODELING_KEYS = ['grid','snap','deformationScale','activeLoadCaseId'];

export const ANALYSIS_CONFIG_DOMAINS = Object.freeze({
  modeling: MODELING_KEYS,
  static: STATIC_KEYS,
  nonlinear: NONLINEAR_KEYS,
  dynamics: DYNAMIC_KEYS,
  seismic: SEISMIC_KEYS,
});

export function analysisConfigFromSettings(settings = {}) {
  return {
    contract: 'analysis-config/v1',
    modeling: pick(settings, MODELING_KEYS),
    static: pick(settings, STATIC_KEYS),
    nonlinear: pick(settings, NONLINEAR_KEYS),
    dynamics: pick(settings, DYNAMIC_KEYS),
    seismic: pick(settings, SEISMIC_KEYS),
  };
}

export function settingsFromAnalysisConfig(config = {}, base = {}) {
  const merged = { ...base };
  for (const domain of ['modeling','static','nonlinear','dynamics','seismic']) {
    Object.assign(merged, config?.[domain] || {});
  }
  return merged;
}

export function resolveAnalysisConfig(project = {}) {
  const fromSettings = analysisConfigFromSettings(project.settings || {});
  const stored = project.analysis || {};
  const merged = { contract: 'analysis-config/v1' };
  for (const domain of ['modeling','static','nonlinear','dynamics','seismic']) {
    // Runtime settings win so existing React controls remain authoritative during the migration window.
    merged[domain] = { ...(stored?.[domain] || {}), ...(fromSettings?.[domain] || {}) };
  }
  return merged;
}

export function synchronizeAnalysisConfig(project = {}) {
  const settings = settingsFromAnalysisConfig(project.analysis || {}, project.settings || {});
  const analysis = analysisConfigFromSettings(settings);
  return { ...project, settings, analysis };
}
