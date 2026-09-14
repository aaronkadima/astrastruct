import assert from 'node:assert/strict';
import { demoFrame } from '../web/src/core/model.js';
import {
  VNL_CONTRACT,
  VNL_VERSION,
  VNL_EXECUTION_CONTRACT,
  createVnlNode,
  createVnlEdge,
  defaultVnlGraph,
  validateGraph,
  compileVnlGraph,
  executeVnlGraph,
  withVnlGraph,
  vnlGraphFromProject,
} from '../web/src/vnl/index.js';

const project = demoFrame();

const graph = defaultVnlGraph({ id: 'smoke-linear', name: 'Linear smoke' });
assert.equal(graph.contract, VNL_CONTRACT);
assert.equal(graph.version, VNL_VERSION);
const validation = validateGraph(graph);
assert.equal(validation.ok, true, validation.errors.map(x => x.message).join('\n'));
assert.deepEqual(validation.missing, []);
assert.equal(validation.order.length, graph.nodes.length);

const execution = executeVnlGraph(graph, project);
assert.equal(execution.contract, VNL_EXECUTION_CONTRACT);
assert.equal(execution.results.length, 1);
assert.ok(execution.primaryResult);
assert.equal(execution.primaryResult.analysisType, 'linear');
assert.equal(execution.plots.length, 1);
assert.equal(execution.plots[0].metric, 'displacementMagnitude');
assert.ok(execution.plots[0].series.length > 0);

const nonlinearNodes = [
  createVnlNode('Geometry', { id: 'G' }),
  createVnlNode('Geometric Nonlinearity', { id: 'GN', params: { mode: 'corotational' } }),
  createVnlNode('Increment', { id: 'INC', params: { steps: 12, controlMode: 'load' } }),
  createVnlNode('Convergence', { id: 'CONV', params: { maxIterations: 44, tolerance: 1e-7, lineSearch: false } }),
  createVnlNode('Solver', { id: 'S', params: { analysisType: 'inherit', scenarioId: project.loadCases[0].id } }),
  createVnlNode('Result', { id: 'R' }),
];
const nonlinearGraph = {
  contract: VNL_CONTRACT,
  version: VNL_VERSION,
  id: 'compile-nonlinear',
  name: 'Nonlinear compile smoke',
  nodes: nonlinearNodes,
  edges: [
    createVnlEdge('G', 'model', 'GN', 'model'),
    createVnlEdge('GN', 'model', 'INC', 'model'),
    createVnlEdge('INC', 'model', 'CONV', 'model'),
    createVnlEdge('CONV', 'model', 'S', 'model'),
    createVnlEdge('S', 'result', 'R', 'result'),
  ],
};
const compiled = compileVnlGraph(nonlinearGraph, project);
assert.equal(compiled.solvers.length, 1);
assert.equal(compiled.solvers[0].analysisType, 'corotational');
assert.equal(compiled.solvers[0].project.settings.nonlinearSteps, 12);
assert.equal(compiled.solvers[0].project.settings.nonlinearMaxIterations, 44);
assert.equal(compiled.solvers[0].project.settings.nonlinearTolerance, 1e-7);
assert.equal(compiled.solvers[0].project.settings.nonlinearLineSearch, false);
assert.equal(compiled.solvers[0].analysisConfig.contract, 'analysis-config/v1');

const branchingGraph = {
  contract: VNL_CONTRACT,
  version: VNL_VERSION,
  id: 'branching',
  name: 'Two analyses',
  nodes: [
    createVnlNode('Geometry', { id: 'G' }),
    createVnlNode('Solver', { id: 'S1', params: { label: 'Linear A', analysisType: 'linear' } }),
    createVnlNode('Solver', { id: 'S2', params: { label: 'Linear B', analysisType: 'linear' } }),
    createVnlNode('Result', { id: 'R1' }),
    createVnlNode('Result', { id: 'R2' }),
    createVnlNode('Plot', { id: 'P1', params: { metric: 'uy', label: 'Uy A' } }),
    createVnlNode('Export', { id: 'E2', params: { format: 'json', fileName: 'branch-b.json' } }),
  ],
  edges: [
    createVnlEdge('G', 'model', 'S1', 'model'),
    createVnlEdge('G', 'model', 'S2', 'model'),
    createVnlEdge('S1', 'result', 'R1', 'result'),
    createVnlEdge('S2', 'result', 'R2', 'result'),
    createVnlEdge('R1', 'result', 'P1', 'result'),
    createVnlEdge('R2', 'result', 'E2', 'result'),
  ],
};
const branchValidation = validateGraph(branchingGraph);
assert.equal(branchValidation.ok, true, branchValidation.errors.map(x => x.message).join('\n'));
const branchExecution = executeVnlGraph(branchingGraph, project);
assert.equal(branchExecution.results.length, 2);
assert.equal(branchExecution.plots.length, 1);
assert.equal(branchExecution.artifacts.length, 1);
assert.equal(branchExecution.artifacts[0].fileName, 'branch-b.json');
assert.ok(branchExecution.artifacts[0].content.includes('structural-result/v1'));

const persisted = withVnlGraph(project, branchingGraph);
assert.equal(persisted.vnl.version, VNL_VERSION);
const recovered = vnlGraphFromProject(persisted);
assert.equal(recovered.id, 'branching');
assert.equal(validateGraph(recovered).ok, true);

const mismatchGraph = {
  contract: VNL_CONTRACT,
  version: VNL_VERSION,
  id: 'bad-types',
  nodes: [createVnlNode('Geometry', { id: 'G' }), createVnlNode('Solver', { id: 'S' }), createVnlNode('Result', { id: 'R' }), createVnlNode('Section', { id: 'SEC' })],
  edges: [
    createVnlEdge('G', 'model', 'S', 'model'),
    createVnlEdge('S', 'result', 'R', 'result'),
    createVnlEdge('R', 'result', 'SEC', 'model'),
  ],
};
const mismatch = validateGraph(mismatchGraph);
assert.equal(mismatch.ok, false);
assert.ok(mismatch.errors.some(issue => issue.code === 'PORT_TYPE_MISMATCH'));

const cyclicGraph = {
  contract: VNL_CONTRACT,
  version: VNL_VERSION,
  id: 'cycle',
  nodes: [
    createVnlNode('Geometry', { id: 'G' }),
    createVnlNode('Material', { id: 'M' }),
    createVnlNode('Section', { id: 'SEC' }),
    createVnlNode('Solver', { id: 'S' }),
    createVnlNode('Result', { id: 'R' }),
  ],
  edges: [
    createVnlEdge('G', 'model', 'M', 'model'),
    createVnlEdge('M', 'model', 'SEC', 'model'),
    createVnlEdge('SEC', 'model', 'M', 'model', { id: 'cycle-edge' }),
    createVnlEdge('SEC', 'model', 'S', 'model'),
    createVnlEdge('S', 'result', 'R', 'result'),
  ],
};
const cyclic = validateGraph(cyclicGraph);
assert.equal(cyclic.ok, false);
assert.ok(cyclic.errors.some(issue => issue.code === 'GRAPH_CYCLE'));

console.log('AstraStruct v0.49 VNL smoke: typed DAG, compiler, solver runtime, branching, persistence and invalid-graph guards coherent.');
