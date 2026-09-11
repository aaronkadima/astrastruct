import { solveTruss2D } from './truss2d.js';
import { solveFrame2D } from './frame2d.js';
import { solveMixed2D } from './mixed2d.js';
import { solveFramePDelta2D } from './pdelta2d.js';
import { resolveScenario } from './scenario.js';
import { buildElementResponses } from './postprocess.js';

function solveLinearModel(project) {
  const types = new Set((project.elements || []).map(e => e.type));
  if (types.size === 1 && types.has('truss2d')) return solveTruss2D(project);
  if (types.size === 1 && types.has('frame2d')) return solveFrame2D(project);
  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return solveMixed2D(project);
  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${[...types].join(', ')}`);
}

function solveStructuralModel(project) {
  if (project.settings?.analysisType === 'pdelta') return solveFramePDelta2D(project);
  return solveLinearModel(project);
}

export function solve(project, scenarioId) {
  const resolved = resolveScenario(project, scenarioId);
  const result = solveStructuralModel(resolved.project);
  const elementResponses = buildElementResponses(resolved.project, result, 41);
  return {
    ...result,
    elementResponses,
    scenario: resolved.scenario,
    analysisType: resolved.project.settings?.analysisType || 'linear',
    solverVersion: '0.10.0'
  };
}
