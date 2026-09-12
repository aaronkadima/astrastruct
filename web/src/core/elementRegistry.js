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
  if (types.size === 1 && types.has('truss3d')) return 'truss3d';
  if (types.size === 1 && types.has('frame3d')) return 'frame3d';
  if ([...types].every(t => t === 'frame3d' || t === 'truss3d')) return 'mixed3d';
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


registerElementType({
  type: 'truss3d',
  label: 'Treliça 3D',
  dimension: '3d',
  dofsPerNode: ['ux','uy','uz'],
  nodeCount: 2,
  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: false },
});

registerElementType({
  type: 'frame3d',
  label: 'Frame 3D Euler–Bernoulli',
  dimension: '3d',
  dofsPerNode: ['ux','uy','uz','rx','ry','rz'],
  nodeCount: 2,
  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: false },
});
