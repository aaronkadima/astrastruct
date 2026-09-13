const ELEMENT_TYPES = new Map();
const ELEMENT_COMPONENT_FACTORIES = new Map();

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

export function registerElementComponentFactory(type, factory) {
  const key=String(type||'').trim();
  if(!ELEMENT_TYPES.has(key))throw new Error(`ElementRegistry: tipo não registrado para component factory: ${key||'(vazio)'}.`);
  if(typeof factory!=='function')throw new Error(`ElementRegistry: component factory de ${key} deve ser função.`);
  ELEMENT_COMPONENT_FACTORIES.set(key,factory);
  return factory;
}

export function getElementComponentFactory(type) {
  return ELEMENT_COMPONENT_FACTORIES.get(String(type||'').trim()) || null;
}

export function hasElementComponentFactory(type) {
  return ELEMENT_COMPONENT_FACTORIES.has(String(type||'').trim());
}

export function createRegisteredElementComponent(element, context={}) {
  if(!element?.type)throw new Error('ElementRegistry: element.type é obrigatório para criar component.');
  const factory=getElementComponentFactory(element.type);
  if(!factory)throw new Error(`ElementRegistry: component factory não registrada para ${element.type}.`);
  return factory({element,...context});
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
  // shell4 is dispatched through the spatial mixed3d assembler even when it is
  // the only element family; solveSpatial3D still reports result.type='shell4'.
  if (types.size === 1 && types.has('shell4')) return 'mixed3d';
  if ([...types].every(t => t === 'frame3d' || t === 'truss3d' || t === 'shell4')) return 'mixed3d';
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
  capabilities: { linear: true, pdelta: true, corotational: true, dynamics: true },
});

registerElementType({
  type: 'shell4',
  label: 'Casca/Laje Q4 Mindlin–Reissner',
  dimension: '3d',
  category: 'surface',
  dofsPerNode: ['ux','uy','uz','rx','ry','rz'],
  nodeCount: 4,
  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: true, modal: true, surfacePressure: true, membrane: true, bending: true, transverseShear: true },
});
