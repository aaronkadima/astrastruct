import { analysisConfigFromSettings } from '../core/analysisConfig.js';
import { validateGraph } from './graph.js';
import { vnlBlockDefinition } from './contracts.js';

const clone = value => JSON.parse(JSON.stringify(value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positiveInt = (value, fallback, min = 1, max = 10000) => Math.max(min, Math.min(max, Math.round(finite(value, fallback))));
const positive = (value, fallback, min = 1e-12, max = Number.POSITIVE_INFINITY) => Math.max(min, Math.min(max, Math.abs(finite(value, fallback))));

export class VnlCompileError extends Error {
  constructor(message, validation = null) {
    super(message);
    this.name = 'VnlCompileError';
    this.validation = validation;
  }
}

function synchronizedProject(project, settings) {
  const next = clone(project);
  next.settings = { ...(next.settings || {}), ...settings };
  next.analysis = analysisConfigFromSettings(next.settings);
  return next;
}

function applyAnalysisBlock(project, node) {
  const settings = { ...(project.settings || {}) };
  const params = node.params || {};
  if (node.type === 'Geometric Nonlinearity') {
    const mode = String(params.mode || 'corotational');
    if (!['linear', 'pdelta', 'corotational'].includes(mode)) throw new VnlCompileError(`VNL: modo geométrico não suportado: ${mode}.`);
    settings.analysisType = mode;
  } else if (node.type === 'Material Nonlinearity') {
    if (params.enabled !== false) settings.analysisType = 'corotational';
  } else if (node.type === 'Increment') {
    settings.nonlinearSteps = positiveInt(params.steps, settings.nonlinearSteps || 20, 1, 200);
    const mode = String(params.controlMode || settings.nonlinearControlMode || 'load');
    settings.nonlinearControlMode = ['load', 'displacement', 'arc-length'].includes(mode) ? mode : 'load';
    if (params.displacementNodeId !== undefined) settings.displacementControlNodeId = params.displacementNodeId || null;
    if (params.displacementDof !== undefined) settings.displacementControlDof = params.displacementDof || 'uy';
    if (params.displacementTarget !== undefined) settings.displacementControlTarget = finite(params.displacementTarget, settings.displacementControlTarget || -0.05);
    if (params.arcLengthInitialLoadIncrement !== undefined) settings.arcLengthInitialLoadIncrement = positive(params.arcLengthInitialLoadIncrement, settings.arcLengthInitialLoadIncrement || 0.05, 1e-5);
  } else if (node.type === 'Convergence') {
    const maxIterations = positiveInt(params.maxIterations, settings.nonlinearMaxIterations || 35, 2, 100);
    const tolerance = positive(params.tolerance, settings.nonlinearTolerance || 1e-8, 1e-12);
    settings.nonlinearMaxIterations = maxIterations;
    settings.nonlinearTolerance = tolerance;
    settings.nonlinearLineSearch = params.lineSearch !== false;
    settings.pDeltaMaxIterations = maxIterations;
    settings.pDeltaTolerance = tolerance;
  } else if (node.type === 'Solver') {
    const requested = String(params.analysisType || 'inherit');
    if (requested !== 'inherit') {
      if (!['linear', 'pdelta', 'corotational', 'modal', 'time-history', 'response-spectrum'].includes(requested)) {
        throw new VnlCompileError(`VNL: Solver.analysisType não suportado: ${requested}.`);
      }
      settings.analysisType = requested;
    }
    if (params.scenarioId) settings.analysisScenarioId = String(params.scenarioId);
  }
  return synchronizedProject(project, settings);
}

function incomingEdges(graph, nodeId) {
  return graph.edges.filter(edge => edge.to.nodeId === nodeId);
}

function valueForInput(graph, values, node, port) {
  const edge = incomingEdges(graph, node.id).find(item => item.to.port === port);
  return edge ? values.get(`${edge.from.nodeId}:${edge.from.port}`) : undefined;
}

function setOutput(values, nodeId, port, value) {
  values.set(`${nodeId}:${port}`, value);
}

export function compileVnlGraph(inputGraph, project) {
  const validation = validateGraph(inputGraph);
  if (!validation.ok) {
    const summary = validation.errors.map(issue => issue.message).join(' ');
    throw new VnlCompileError(summary || 'VNL: grafo inválido.', validation);
  }
  const graph = validation.graph;
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const values = new Map(), executionPlan = [], solvers = [];

  for (const nodeId of validation.order) {
    const node = nodeMap.get(nodeId);
    if (!node || node.enabled === false) continue;
    const definition = vnlBlockDefinition(node.type);
    if (!definition) throw new VnlCompileError(`VNL: definição ausente para ${node.type}.`, validation);

    if (node.type === 'Geometry') {
      const model = synchronizedProject(project, project.settings || {});
      setOutput(values, node.id, 'model', model);
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'model-source' });
      continue;
    }

    if (definition.outputs?.model) {
      const inputModel = valueForInput(graph, values, node, 'model');
      if (!inputModel) throw new VnlCompileError(`VNL: ${node.type} não recebeu structural-model.`, validation);
      const model = applyAnalysisBlock(inputModel, node);
      setOutput(values, node.id, 'model', model);
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'model-transform', analysisConfig: model.analysis });
      continue;
    }

    if (node.type === 'Solver') {
      const inputModel = valueForInput(graph, values, node, 'model');
      if (!inputModel) throw new VnlCompileError(`VNL: Solver ${node.id} não recebeu structural-model.`, validation);
      const model = applyAnalysisBlock(inputModel, node);
      const scenarioId = node.params?.scenarioId || model.settings?.analysisScenarioId || model.loadCases?.[0]?.id || null;
      const descriptor = {
        kind: 'solver-descriptor',
        nodeId: node.id,
        label: node.params?.label || node.id,
        scenarioId,
        analysisType: model.settings?.analysisType || 'linear',
        analysisConfig: model.analysis || analysisConfigFromSettings(model.settings || {}),
        project: model,
      };
      setOutput(values, node.id, 'result', descriptor);
      solvers.push(descriptor);
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'solver', scenarioId, analysisType: descriptor.analysisType });
      continue;
    }

    if (node.type === 'Result') {
      const descriptor = valueForInput(graph, values, node, 'result');
      setOutput(values, node.id, 'result', descriptor);
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'result' });
      continue;
    }

    if (node.type === 'Plot') {
      const descriptor = valueForInput(graph, values, node, 'result');
      setOutput(values, node.id, 'plot', {
        kind: 'plot-descriptor',
        source: descriptor,
        metric: node.params?.metric || 'displacementMagnitude',
        label: node.params?.label || node.id,
      });
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'plot', metric: node.params?.metric || 'displacementMagnitude' });
      continue;
    }

    if (node.type === 'Export') {
      const result = valueForInput(graph, values, node, 'result');
      const plot = valueForInput(graph, values, node, 'plot');
      setOutput(values, node.id, 'artifact', {
        kind: 'export-descriptor', source: result || plot,
        format: node.params?.format || 'json', fileName: node.params?.fileName || 'astrastruct-vnl-result.json',
      });
      executionPlan.push({ nodeId: node.id, type: node.type, kind: 'export', format: node.params?.format || 'json' });
    }
  }

  return {
    contract: VNL_CONTRACT_SAFE(),
    version: '0.49.0-exp',
    graph,
    validation,
    executionPlan,
    solvers,
  };
}

function VNL_CONTRACT_SAFE() {
  return 'vnl-compiled-plan/v1';
}
