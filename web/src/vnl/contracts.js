export const VNL_CONTRACT = 'visual-nonlinear-language/v2';
export const VNL_VERSION = '0.49.0-exp';
export const VNL_EXECUTION_CONTRACT = 'vnl-execution/v1';
export const VNL_PROJECT_CONTRACT = 'project-vnl/v1';

export const VNL_PORT_TYPES = Object.freeze({
  MODEL: 'structural-model',
  RESULT: 'analysis-result',
  PLOT: 'plot-descriptor',
  ARTIFACT: 'export-artifact',
});

const modelIn = Object.freeze({ model: { type: VNL_PORT_TYPES.MODEL, required: true } });
const modelOut = Object.freeze({ model: { type: VNL_PORT_TYPES.MODEL } });
const modelTransform = (label, category, defaultParams = {}) => Object.freeze({
  label, category, inputs: modelIn, outputs: modelOut, defaultParams: Object.freeze(defaultParams), executable: true,
});

export const VNL_BLOCK_CATALOG = Object.freeze({
  Geometry: Object.freeze({
    label: 'Geometry', category: 'model', inputs: Object.freeze({}), outputs: modelOut,
    defaultParams: Object.freeze({ source: 'project' }), executable: true,
  }),
  Mesh: modelTransform('Mesh', 'model'),
  Material: modelTransform('Material', 'model'),
  Section: modelTransform('Section', 'model'),
  Reinforcement: modelTransform('Reinforcement', 'model'),
  Boundary: modelTransform('Boundary', 'model'),
  Connection: modelTransform('Connection', 'model'),
  Load: modelTransform('Load', 'model'),
  Combination: modelTransform('Combination', 'model'),
  'Material Nonlinearity': modelTransform('Material Nonlinearity', 'analysis', { enabled: true }),
  'Geometric Nonlinearity': modelTransform('Geometric Nonlinearity', 'analysis', { mode: 'corotational' }),
  Increment: modelTransform('Increment', 'analysis', {
    steps: 20,
    controlMode: 'load',
    displacementNodeId: null,
    displacementDof: 'uy',
    displacementTarget: -0.05,
    arcLengthInitialLoadIncrement: 0.05,
  }),
  Convergence: modelTransform('Convergence', 'analysis', {
    maxIterations: 35,
    tolerance: 1e-8,
    lineSearch: true,
  }),
  Contact: modelTransform('Contact', 'analysis', { enabled: true }),
  Solver: Object.freeze({
    label: 'Solver', category: 'execution', inputs: modelIn,
    outputs: Object.freeze({ result: { type: VNL_PORT_TYPES.RESULT } }),
    defaultParams: Object.freeze({ analysisType: 'inherit', scenarioId: null, label: 'Analysis' }), executable: true,
  }),
  Result: Object.freeze({
    label: 'Result', category: 'postprocess',
    inputs: Object.freeze({ result: { type: VNL_PORT_TYPES.RESULT, required: true } }),
    outputs: Object.freeze({ result: { type: VNL_PORT_TYPES.RESULT } }),
    defaultParams: Object.freeze({ label: 'Result' }), executable: true,
  }),
  Plot: Object.freeze({
    label: 'Plot', category: 'postprocess',
    inputs: Object.freeze({ result: { type: VNL_PORT_TYPES.RESULT, required: true } }),
    outputs: Object.freeze({ plot: { type: VNL_PORT_TYPES.PLOT } }),
    defaultParams: Object.freeze({ metric: 'displacementMagnitude', label: 'Response plot' }), executable: true,
  }),
  Export: Object.freeze({
    label: 'Export', category: 'postprocess',
    inputs: Object.freeze({
      result: { type: VNL_PORT_TYPES.RESULT, required: false },
      plot: { type: VNL_PORT_TYPES.PLOT, required: false },
    }),
    outputs: Object.freeze({ artifact: { type: VNL_PORT_TYPES.ARTIFACT } }),
    defaultParams: Object.freeze({ format: 'json', fileName: 'astrastruct-vnl-result.json' }), executable: true,
    requireAnyInput: true,
  }),
});

export const VNL_BLOCKS = Object.freeze(Object.keys(VNL_BLOCK_CATALOG));

export function vnlBlockDefinition(type) {
  return VNL_BLOCK_CATALOG[type] || null;
}

export function defaultVnlParams(type) {
  const definition = vnlBlockDefinition(type);
  return definition ? { ...definition.defaultParams } : {};
}
