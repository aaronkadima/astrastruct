import { solveTruss2D } from './truss2d.js';
import { solveFrame2D } from './frame2d.js';
import { solveMixed2D } from './mixed2d.js';
import { resolveScenario } from './scenario.js';

function solveStructuralModel(project) {
  const types = new Set((project.elements || []).map(e => e.type));
  if (types.size === 1 && types.has('truss2d')) return solveTruss2D(project);
  if (types.size === 1 && types.has('frame2d')) return solveFrame2D(project);
  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return solveMixed2D(project);
  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${[...types].join(', ')}`);
}

export function solve(project, scenarioId) {
  const resolved = resolveScenario(project, scenarioId);
  const result = solveStructuralModel(resolved.project);
  return {
    ...result,
    scenario: resolved.scenario,
    solverVersion: '0.3.0'
  };
}
