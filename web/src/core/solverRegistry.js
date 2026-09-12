const SOLVERS = new Map();

export function registerSolver(definition) {
  if (!definition?.id) throw new Error('SolverRegistry: definition.id é obrigatório.');
  const normalized = Object.freeze({
    analysisType: 'linear',
    dimensions: ['2d'],
    elementSets: [],
    nonlinear: false,
    dynamic: false,
    experimental: false,
    ...definition,
  });
  SOLVERS.set(normalized.id, normalized);
  return normalized;
}

export function getSolverDefinition(id) {
  return SOLVERS.get(id) || null;
}

export function listSolverDefinitions() {
  return [...SOLVERS.values()];
}

export function findSolver({ analysisType, dimension = '2d', elementSet } = {}) {
  return listSolverDefinitions().find(s =>
    s.analysisType === analysisType &&
    s.dimensions.includes(dimension) &&
    (!elementSet || !s.elementSets.length || s.elementSets.includes(elementSet))
  ) || null;
}

registerSolver({ id: 'linear-truss2d', analysisType: 'linear', elementSets: ['truss2d'] });
registerSolver({ id: 'linear-frame2d', analysisType: 'linear', elementSets: ['frame2d'] });
registerSolver({ id: 'linear-mixed2d', analysisType: 'linear', elementSets: ['mixed2d'] });
registerSolver({ id: 'pdelta-frame2d', analysisType: 'pdelta', elementSets: ['frame2d'], nonlinear: true });
registerSolver({ id: 'corotational-frame2d', analysisType: 'corotational', elementSets: ['frame2d'], nonlinear: true, experimental: true });
registerSolver({ id: 'modal-2d', analysisType: 'modal', elementSets: ['truss2d','frame2d','mixed2d'], dynamic: true });
registerSolver({ id: 'time-history-2d', analysisType: 'time-history', elementSets: ['truss2d','frame2d','mixed2d'], dynamic: true });
registerSolver({ id: 'response-spectrum-2d', analysisType: 'response-spectrum', elementSets: ['truss2d','frame2d','mixed2d'], dynamic: true });
