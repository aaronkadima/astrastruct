const ELEMENT_TYPES = new Map();

export function registerElementType(definition) {
  if (!definition?.type) throw new Error('ElementRegistry: definition.type é obrigatório.');
  const normalized = {
    dimension: '2d',
    category: 'structural',
    dofsPerNode: [],
    nodeCount: 2,
    capabilities: {},
    ...definition,
    capabilities: { ...(definition.capabilities || {}) },
  };
  ELEMENT_TYPES.set(normalized.type, Object.freeze(normalized));
  return normalized;
}

export function getElementDefinition(type) {
  return ELEMENT_TYPES.get(type) || null;
}

export function listElementDefinitions() {
  return [...ELEMENT_TYPES.values()];
}

export function inferProjectDimension(project = {}) {
  const dimensions = new Set((project.elements || []).map(e => getElementDefinition(e.type)?.dimension).filter(Boolean));
  if (!dimensions.size) return '2d';
  if (dimensions.size > 1) return 'mixed-dimension';
  return [...dimensions][0];
}

export function classifyElementSet(project = {}) {
  const types = new Set((project.elements || []).map(e => e.type));
  if (!types.size) return 'empty';
  if (types.size === 1 && types.has('truss2d')) return 'truss2d';
  if (types.size === 1 && types.has('frame2d')) return 'frame2d';
  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return 'mixed2d';
  return 'unsupported';
}

registerElementType({
  type: 'truss2d',
  label: 'Treliça 2D',
  dimension: '2d',
  dofsPerNode: ['ux','uy'],
  nodeCount: 2,
  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: true },
});

registerElementType({
  type: 'frame2d',
  label: 'Frame 2D Euler–Bernoulli',
  dimension: '2d',
  dofsPerNode: ['ux','uy','rz'],
  nodeCount: 2,
  capabilities: { linear: true, pdelta: true, corotational: true, dynamics: true },
});
