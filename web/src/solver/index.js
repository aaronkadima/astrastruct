import { solveTruss2D } from './truss2d.js';
import { solveFrame2D } from './frame2d.js';
import { solveMixed2D } from './mixed2d.js';
import { solveFramePDelta2D } from './pdelta2d.js';
import { solveBuckling2D } from './buckling2d.js';
import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D, solveFrameCorotationalArcLength2D } from './corotational2d.js';
import { activeFiberHinges, solveFrameCorotationalFiberHinges2D } from './materialNonlinear2d.js';
import { solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D } from './dynamics2d.js';
import { solveSpatial3D } from './spatial3d.js';
import { solveFramePDelta3D } from './pdelta3d.js';
import { solveModal3D, solveBuckling3D } from './modalStability3d.js';
import { resolveScenario } from './scenario.js';
import { buildElementResponses } from './postprocess.js';
import { classifyElementSet, inferProjectDimension } from '../core/elementRegistry.js';
import { attachResultContract } from '../core/contracts.js';

function solveLinearModel(project) {
  const elementSet = classifyElementSet(project);
  if (elementSet === 'truss2d') return solveTruss2D(project);
  if (elementSet === 'frame2d') return solveFrame2D(project);
  if (elementSet === 'mixed2d') return solveMixed2D(project);
  if (elementSet === 'truss3d' || elementSet === 'frame3d' || elementSet === 'mixed3d') return solveSpatial3D(project);
  const types = [...new Set((project.elements || []).map(e => e.type))];
  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${types.join(', ') || 'modelo vazio'}`);
}

function modalImperfectionConfig(project,scenarioId){
  const cfg=project.settings?.imperfection;
  if(!cfg?.enabled)return null;
  if((cfg.source||'bucklingMode')!=='bucklingMode')throw new Error(`Fonte de imperfeição ainda não suportada: ${cfg.source}.`);
  const amplitudeMm=Number(cfg.amplitudeMm),mode=Math.max(1,Math.min(12,Math.round(Number(cfg.mode)||1))),referenceScenarioId=cfg.scenarioId||scenarioId||project.settings?.analysisScenarioId||project.loadCases?.[0]?.id;
  if(!(amplitudeMm>0&&Number.isFinite(amplitudeMm)))throw new Error('Imperfeição modal: amplitude máxima deve ser positiva e finita em mm.');
  return{amplitudeMm,mode,referenceScenarioId};
}
function buildModalImperfection(project,scenarioId){
  const cfg=modalImperfectionConfig(project,scenarioId);if(!cfg)return null;
  const buckling=solveBuckling2D(project,cfg.referenceScenarioId,{modes:cfg.mode}),selected=buckling.modes?.[cfg.mode-1];
  if(!selected)throw new Error(`Imperfeição modal: modo ${cfg.mode} não disponível para o cenário ${cfg.referenceScenarioId}.`);
  const amplitude=cfg.amplitudeMm/1000;
  return{source:'bucklingMode',mode:cfg.mode,referenceScenarioId:cfg.referenceScenarioId,criticalFactor:selected.factor,amplitude,amplitudeMm:cfg.amplitudeMm,vector:selected.vector.map(v=>v*amplitude)};
}
function buildModalImperfection3D(project,scenarioId){
  const cfg=modalImperfectionConfig(project,scenarioId);if(!cfg)return null;
  const buckling=solveBuckling3D(project,cfg.referenceScenarioId,{modes:cfg.mode}),selected=buckling.modes?.[cfg.mode-1];
  if(!selected)throw new Error(`Imperfeição modal 3D: modo ${cfg.mode} não disponível para o cenário ${cfg.referenceScenarioId}.`);
  const amplitude=cfg.amplitudeMm/1000;
  return{source:'bucklingMode',mode:cfg.mode,referenceScenarioId:cfg.referenceScenarioId,criticalFactor:selected.factor,amplitude,amplitudeMm:cfg.amplitudeMm,vector:selected.vector.map(v=>v*amplitude)};
}

function solveStructuralModel(sourceProject,resolvedProject,scenarioId) {
  if (resolvedProject.settings?.analysisType === 'pdelta') {
    if(inferProjectDimension(resolvedProject)==='3d') return solveFramePDelta3D(resolvedProject,{initialImperfection:buildModalImperfection3D(sourceProject,scenarioId)});
    const initialImperfection=buildModalImperfection(sourceProject,scenarioId);
    return solveFramePDelta2D(resolvedProject,{initialImperfection});
  }
  return solveLinearModel(resolvedProject);
}

function solveRaw(project, scenarioId) {
  const analysisType=project.settings?.analysisType||'linear',dimension=inferProjectDimension(project),fiberHinges=activeFiberHinges(project),s=project.settings||{};
  if(dimension==='3d'&&!['linear','modal','pdelta'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.29; use análise linear, modal ou P-Delta.`);
  if(analysisType==='modal'){
    if(fiberHinges.length)throw new Error('Dinâmica modal v0.25 é linear-elástica; desative as rótulas de fibras.');
    const result=dimension==='3d'?solveModal3D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation}):solveModal2D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation});
    const resolved=resolveScenario(project,scenarioId);return{...result,scenario:resolved.scenario,analysisType:'modal'};
  }
  if(analysisType==='response-spectrum'){
    if(fiberHinges.length)throw new Error('Espectro de resposta v0.25 é linear-elástico; desative as rótulas de fibras.');
    return solveResponseSpectrum2D(project,{massFormulation:s.dynamicMassFormulation,modes:s.modalModes,dampingRatio:s.dynamicDampingRatio,timeStep:s.dynamicTimeStep,direction:s.dynamicGroundMotionDirection,groundMotionPoints:s.dynamicGroundMotionPoints,groundMotionPointsY:s.dynamicGroundMotionPointsY,combination:s.responseSpectrumCombination,directionalCombination:s.responseSpectrumDirectionalCombination,periodMin:s.responseSpectrumPeriodMin,periodMax:s.responseSpectrumPeriodMax,periodCount:s.responseSpectrumPeriodPoints,targetSpectrumPoints:s.responseSpectrumTargetPoints,preprocess:{baselineCorrection:s.groundMotionBaselineCorrection,taperRatio:s.groundMotionTaperRatio,highPassHz:s.groundMotionHighPassHz,lowPassHz:s.groundMotionLowPassHz,resampleDt:s.groundMotionResampleDt,scaleFactor:s.groundMotionScaleFactor}});
  }
  if(analysisType==='time-history'){
    if(fiberHinges.length)throw new Error('História temporal v0.25 é linear-elástica; desative as rótulas de fibras.');
    return solveTimeHistory2D(project,scenarioId,{massFormulation:s.dynamicMassFormulation,dampingRatio:s.dynamicDampingRatio,rayleighMode1:s.dynamicRayleighMode1,rayleighMode2:s.dynamicRayleighMode2,timeStep:s.dynamicTimeStep,duration:s.dynamicDuration,monitorNodeId:s.dynamicMonitorNodeId,monitorDof:s.dynamicMonitorDof,historyPoints:s.dynamicHistoryPoints,excitationType:s.dynamicExcitationType,groundMotionDirection:s.dynamicGroundMotionDirection,groundMotionPoints:s.dynamicGroundMotionPoints,groundMotionPointsY:s.dynamicGroundMotionPointsY,preprocess:{baselineCorrection:s.groundMotionBaselineCorrection,taperRatio:s.groundMotionTaperRatio,highPassHz:s.groundMotionHighPassHz,lowPassHz:s.groundMotionLowPassHz,resampleDt:s.groundMotionResampleDt,scaleFactor:s.groundMotionScaleFactor}});
  }
  if(fiberHinges.length&&analysisType!=='corotational')throw new Error('Rótulas de fibras v0.16 exigem análise Geom. não linear (co-rotacional). Selecione esse modo antes de executar a análise.');
  if(analysisType==='corotational'){
    const initialImperfection=buildModalImperfection(project,scenarioId),controlMode=s.nonlinearControlMode==='arc-length'?'arc-length':(s.nonlinearControlMode==='displacement'?'displacement':'load'),options={steps:s.nonlinearSteps,maxIterations:s.nonlinearMaxIterations,tolerance:s.nonlinearTolerance,lineSearch:s.nonlinearLineSearch,initialImperfection,controlMode,displacementTolerance:s.displacementControlTolerance,displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},cyclicProtocol:{enabled:!!s.cyclicProtocolEnabled,targets:Array.isArray(s.cyclicProtocolTargets)?s.cyclicProtocolTargets:[],stepsPerSegment:s.cyclicStepsPerSegment},arcLengthMonitor:{nodeId:s.arcLengthMonitorNodeId||s.displacementControlNodeId,dof:s.arcLengthMonitorDof||s.displacementControlDof},arcLengthInitialLoadIncrement:s.arcLengthInitialLoadIncrement,arcLengthInitialSign:s.arcLengthInitialSign,arcLengthTargetIterations:s.arcLengthTargetIterations,arcLengthMaxCutbacks:s.arcLengthMaxCutbacks,arcLengthMinRadiusFactor:s.arcLengthMinRadiusFactor,arcLengthMaxRadiusFactor:s.arcLengthMaxRadiusFactor,arcLengthConstraintTolerance:s.arcLengthConstraintTolerance,stabilityTracking:s.stabilityTracking,stabilityEigenTolerance:s.stabilityEigenTolerance,stabilityAsymmetryTolerance:s.stabilityAsymmetryTolerance,stabilityMaxDofs:s.stabilityMaxDofs,stabilityModeCount:s.stabilityModeCount,stabilityClusterTolerance:s.stabilityClusterTolerance,stabilityMacThreshold:s.stabilityMacThreshold,branchExploreEnabled:s.branchExploreEnabled,branchExploreAmplitude:s.branchExploreAmplitude,branchExploreMaxIterations:s.branchExploreMaxIterations,branchExploreMaxEvents:s.branchExploreMaxEvents,branchSwitchEnabled:s.branchSwitchEnabled,branchSwitchSign:s.branchSwitchSign,branchSwitchAmplitude:s.branchSwitchAmplitude,materialMaxIterations:s.materialMaxIterations,materialTolerance:s.materialTolerance,materialRelaxation:s.materialRelaxation,materialCoupling:s.materialCoupling};
    const result=fiberHinges.length?solveFrameCorotationalFiberHinges2D(project,scenarioId,options):(controlMode==='arc-length'?solveFrameCorotationalArcLength2D(project,scenarioId,options):(controlMode==='displacement'?solveFrameCorotationalDisplacementControl2D(project,scenarioId,options):solveFrameCorotational2D(project,scenarioId,options)));
    return{...result,analysisType:'corotational',solverVersion:result.solverVersion||'0.13.6-exp'};
  }
  const resolved = resolveScenario(project, scenarioId);
  const result = solveStructuralModel(project,resolved.project,scenarioId||resolved.scenario?.id);
  if(result.dimension==='3d')return{...result,scenario:resolved.scenario,analysisType:result.analysisType||analysisType,solverVersion:result.solverVersion||(analysisType==='pdelta'?'0.29.0':'0.26.0')};
  const elementResponses = buildElementResponses(resolved.project, result, 41);
  return {
    ...result,
    elementResponses,
    scenario: resolved.scenario,
    analysisType: resolved.project.settings?.analysisType || 'linear',
    solverVersion: analysisType==='pdelta'?'0.12.0':'0.13.4-exp'
  };
}

export function solve(project, scenarioId) {
  return attachResultContract(project, scenarioId, solveRaw(project, scenarioId));
}
