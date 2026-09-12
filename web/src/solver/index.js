import { solveTruss2D } from './truss2d.js';
import { solveFrame2D } from './frame2d.js';
import { solveMixed2D } from './mixed2d.js';
import { solveFramePDelta2D } from './pdelta2d.js';
import { solveBuckling2D } from './buckling2d.js';
import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D, solveFrameCorotationalArcLength2D } from './corotational2d.js';
import { activeFiberHinges, solveFrameCorotationalFiberHinges2D } from './materialNonlinear2d.js';
import { resolveScenario } from './scenario.js';
import { buildElementResponses } from './postprocess.js';

function solveLinearModel(project) {
  const types = new Set((project.elements || []).map(e => e.type));
  if (types.size === 1 && types.has('truss2d')) return solveTruss2D(project);
  if (types.size === 1 && types.has('frame2d')) return solveFrame2D(project);
  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return solveMixed2D(project);
  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${[...types].join(', ')}`);
}

function buildModalImperfection(project,scenarioId){
  const cfg=project.settings?.imperfection;
  if(!cfg?.enabled)return null;
  if((cfg.source||'bucklingMode')!=='bucklingMode')throw new Error(`Fonte de imperfeição ainda não suportada: ${cfg.source}.`);
  const amplitudeMm=Number(cfg.amplitudeMm),mode=Math.max(1,Math.min(12,Math.round(Number(cfg.mode)||1))),referenceScenarioId=cfg.scenarioId||scenarioId||project.settings?.analysisScenarioId||project.loadCases?.[0]?.id;
  if(!(amplitudeMm>0&&Number.isFinite(amplitudeMm)))throw new Error('Imperfeição modal: amplitude máxima deve ser positiva e finita em mm.');
  const buckling=solveBuckling2D(project,referenceScenarioId,{modes:mode}),selected=buckling.modes?.[mode-1];
  if(!selected)throw new Error(`Imperfeição modal: modo ${mode} não disponível para o cenário ${referenceScenarioId}.`);
  const amplitude=amplitudeMm/1000;
  return{source:'bucklingMode',mode,referenceScenarioId,criticalFactor:selected.factor,amplitude,amplitudeMm,vector:selected.vector.map(v=>v*amplitude)};
}

function solveStructuralModel(sourceProject,resolvedProject,scenarioId) {
  if (resolvedProject.settings?.analysisType === 'pdelta') {
    const initialImperfection=buildModalImperfection(sourceProject,scenarioId);
    return solveFramePDelta2D(resolvedProject,{initialImperfection});
  }
  return solveLinearModel(resolvedProject);
}

export function solve(project, scenarioId) {
  const analysisType=project.settings?.analysisType||'linear',fiberHinges=activeFiberHinges(project);
  if(fiberHinges.length&&analysisType!=='corotational')throw new Error('Rótulas de fibras v0.16 exigem análise Geom. não linear (co-rotacional). Selecione esse modo antes de executar a análise.');
  if(analysisType==='corotational'){
    const s=project.settings||{},initialImperfection=buildModalImperfection(project,scenarioId),controlMode=s.nonlinearControlMode==='arc-length'?'arc-length':(s.nonlinearControlMode==='displacement'?'displacement':'load'),options={steps:s.nonlinearSteps,maxIterations:s.nonlinearMaxIterations,tolerance:s.nonlinearTolerance,lineSearch:s.nonlinearLineSearch,initialImperfection,controlMode,displacementTolerance:s.displacementControlTolerance,displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},arcLengthMonitor:{nodeId:s.arcLengthMonitorNodeId||s.displacementControlNodeId,dof:s.arcLengthMonitorDof||s.displacementControlDof},arcLengthInitialLoadIncrement:s.arcLengthInitialLoadIncrement,arcLengthInitialSign:s.arcLengthInitialSign,arcLengthTargetIterations:s.arcLengthTargetIterations,arcLengthMaxCutbacks:s.arcLengthMaxCutbacks,arcLengthMinRadiusFactor:s.arcLengthMinRadiusFactor,arcLengthMaxRadiusFactor:s.arcLengthMaxRadiusFactor,arcLengthConstraintTolerance:s.arcLengthConstraintTolerance,stabilityTracking:s.stabilityTracking,stabilityEigenTolerance:s.stabilityEigenTolerance,stabilityAsymmetryTolerance:s.stabilityAsymmetryTolerance,stabilityMaxDofs:s.stabilityMaxDofs,branchSwitchEnabled:s.branchSwitchEnabled,branchSwitchSign:s.branchSwitchSign,branchSwitchAmplitude:s.branchSwitchAmplitude,materialMaxIterations:s.materialMaxIterations,materialTolerance:s.materialTolerance,materialRelaxation:s.materialRelaxation,materialCoupling:s.materialCoupling};
    const result=fiberHinges.length?solveFrameCorotationalFiberHinges2D(project,scenarioId,options):(controlMode==='arc-length'?solveFrameCorotationalArcLength2D(project,scenarioId,options):(controlMode==='displacement'?solveFrameCorotationalDisplacementControl2D(project,scenarioId,options):solveFrameCorotational2D(project,scenarioId,options)));
    return{...result,analysisType:'corotational',solverVersion:result.solverVersion||'0.13.6-exp'};
  }
  const resolved = resolveScenario(project, scenarioId);
  const result = solveStructuralModel(project,resolved.project,scenarioId||resolved.scenario?.id);
  const elementResponses = buildElementResponses(resolved.project, result, 41);
  return {
    ...result,
    elementResponses,
    scenario: resolved.scenario,
    analysisType: resolved.project.settings?.analysisType || 'linear',
    solverVersion: analysisType==='pdelta'?'0.12.0':'0.13.4-exp'
  };
}
