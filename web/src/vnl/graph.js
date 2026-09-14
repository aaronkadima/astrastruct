import {
  VNL_CONTRACT,
  VNL_VERSION,
  VNL_BLOCKS,
  vnlBlockDefinition,
  defaultVnlParams,
} from './contracts.js';

export { VNL_BLOCKS, VNL_CONTRACT, VNL_VERSION } from './contracts.js';

const clone = value => JSON.parse(JSON.stringify(value));
const edgeId = (fromNode, fromPort, toNode, toPort) => `${fromNode}:${fromPort}->${toNode}:${toPort}`;

export function createVnlNode(type, options = {}) {
  if (!vnlBlockDefinition(type)) throw new Error(`VNL: bloco desconhecido: ${type}.`);
  return {
    id: options.id || `B_${Math.random().toString(36).slice(2, 9)}`,
    type,
    enabled: options.enabled !== false,
    params: { ...defaultVnlParams(type), ...(options.params || {}) },
    position: options.position ? { ...options.position } : null,
    label: options.label || null,
  };
}

export function createVnlEdge(fromNode, fromPort, toNode, toPort, options = {}) {
  return {
    id: options.id || edgeId(fromNode, fromPort, toNode, toPort),
    from: { nodeId: fromNode, port: fromPort },
    to: { nodeId: toNode, port: toPort },
  };
}

function sequentialGraphFromNodes(nodes, options = {}) {
  const normalizedNodes = nodes.map((node, index) => createVnlNode(node.type, {
    ...node,
    id: node.id || `B${index + 1}`,
    params: node.params || {},
  }));
  const edges = [];
  for (let i = 0; i < normalizedNodes.length - 1; i += 1) {
    const a = normalizedNodes[i], b = normalizedNodes[i + 1];
    const aDef = vnlBlockDefinition(a.type), bDef = vnlBlockDefinition(b.type);
    const outPort = Object.keys(aDef.outputs || {})[0];
    const candidateInputs = Object.entries(bDef.inputs || {});
    const inPort = candidateInputs.find(([, spec]) => spec.type === aDef.outputs?.[outPort]?.type)?.[0];
    if (outPort && inPort) edges.push(createVnlEdge(a.id, outPort, b.id, inPort));
  }
  return {
    contract: VNL_CONTRACT,
    version: VNL_VERSION,
    id: options.id || 'vnl-main',
    name: options.name || 'Fluxo principal',
    nodes: normalizedNodes,
    edges,
    metadata: { ...(options.metadata || {}) },
  };
}

export function defaultGraph(options = {}) {
  const types = ['Geometry', 'Material', 'Section', 'Boundary', 'Load', 'Combination', 'Solver', 'Result', 'Plot'];
  return sequentialGraphFromNodes(types.map((type, index) => ({
    id: `B${index + 1}`,
    type,
    position: { x: 60 + index * 170, y: 80 },
  })), options);
}

export function normalizeGraph(input) {
  if (Array.isArray(input)) return sequentialGraphFromNodes(input);
  const source = input && typeof input === 'object' ? clone(input) : defaultGraph();
  const nodes = Array.isArray(source.nodes) ? source.nodes.map((node, index) => createVnlNode(node.type, {
    ...node,
    id: node.id || `B${index + 1}`,
  })) : [];
  const edges = Array.isArray(source.edges) ? source.edges.map((edge, index) => ({
    id: edge.id || `E${index + 1}`,
    from: { nodeId: edge.from?.nodeId, port: edge.from?.port },
    to: { nodeId: edge.to?.nodeId, port: edge.to?.port },
  })) : [];
  return {
    contract: VNL_CONTRACT,
    version: VNL_VERSION,
    id: source.id || 'vnl-main',
    name: source.name || 'Fluxo principal',
    nodes,
    edges,
    metadata: { ...(source.metadata || {}) },
  };
}

function enabledGraph(graph) {
  const nodes = graph.nodes.filter(node => node.enabled !== false);
  const ids = new Set(nodes.map(node => node.id));
  return { nodes, edges: graph.edges.filter(edge => ids.has(edge.from.nodeId) && ids.has(edge.to.nodeId)) };
}

export function topologicalOrder(input) {
  const graph = normalizeGraph(input), { nodes, edges } = enabledGraph(graph);
  const indegree = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (!indegree.has(edge.to.nodeId) || !outgoing.has(edge.from.nodeId)) continue;
    indegree.set(edge.to.nodeId, indegree.get(edge.to.nodeId) + 1);
    outgoing.get(edge.from.nodeId).push(edge.to.nodeId);
  }
  const queue = nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const target of outgoing.get(id) || []) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  return { order, cyclic: order.length !== nodes.length };
}

function graphReachability(graph, starts, reverse = false) {
  const adjacency = new Map(graph.nodes.map(node => [node.id, []]));
  for (const edge of graph.edges) {
    const a = reverse ? edge.to.nodeId : edge.from.nodeId;
    const b = reverse ? edge.from.nodeId : edge.to.nodeId;
    if (adjacency.has(a)) adjacency.get(a).push(b);
  }
  const seen = new Set(), queue = [...starts];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of adjacency.get(id) || []) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

export function validateGraph(input) {
  let graph;
  try { graph = normalizeGraph(input); }
  catch (error) {
    return { ok: false, missing: [], errors: [{ code: 'GRAPH_NORMALIZATION_FAILED', message: error.message }], warnings: [], order: [], graph: null };
  }
  const errors = [], warnings = [];
  const { nodes, edges } = enabledGraph(graph);
  const nodeMap = new Map();
  for (const node of nodes) {
    if (nodeMap.has(node.id)) errors.push({ code: 'DUPLICATE_NODE_ID', nodeId: node.id, message: `VNL: ID de bloco duplicado ${node.id}.` });
    else nodeMap.set(node.id, node);
    if (!vnlBlockDefinition(node.type)) errors.push({ code: 'UNKNOWN_BLOCK', nodeId: node.id, message: `VNL: bloco desconhecido ${node.type}.` });
  }

  const edgeIds = new Set(), incomingByPort = new Map();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) errors.push({ code: 'DUPLICATE_EDGE_ID', edgeId: edge.id, message: `VNL: ID de ligação duplicado ${edge.id}.` });
    edgeIds.add(edge.id);
    const source = nodeMap.get(edge.from.nodeId), target = nodeMap.get(edge.to.nodeId);
    if (!source || !target) {
      errors.push({ code: 'EDGE_NODE_MISSING', edgeId: edge.id, message: `VNL: ligação ${edge.id} referencia bloco inexistente.` });
      continue;
    }
    const sourcePort = vnlBlockDefinition(source.type)?.outputs?.[edge.from.port];
    const targetPort = vnlBlockDefinition(target.type)?.inputs?.[edge.to.port];
    if (!sourcePort) errors.push({ code: 'OUTPUT_PORT_MISSING', edgeId: edge.id, message: `VNL: porta de saída ${source.type}.${edge.from.port} não existe.` });
    if (!targetPort) errors.push({ code: 'INPUT_PORT_MISSING', edgeId: edge.id, message: `VNL: porta de entrada ${target.type}.${edge.to.port} não existe.` });
    if (sourcePort && targetPort && sourcePort.type !== targetPort.type) errors.push({
      code: 'PORT_TYPE_MISMATCH', edgeId: edge.id,
      message: `VNL: tipos incompatíveis ${sourcePort.type} -> ${targetPort.type} em ${edge.id}.`,
    });
    const portKey = `${edge.to.nodeId}:${edge.to.port}`;
    if (incomingByPort.has(portKey)) errors.push({ code: 'MULTIPLE_INPUTS', edgeId: edge.id, message: `VNL: porta ${portKey} recebeu mais de uma ligação.` });
    else incomingByPort.set(portKey, edge.id);
  }

  for (const node of nodes) {
    const def = vnlBlockDefinition(node.type);
    if (!def) continue;
    const connectedPorts = new Set(edges.filter(edge => edge.to.nodeId === node.id).map(edge => edge.to.port));
    for (const [port, spec] of Object.entries(def.inputs || {})) {
      if (spec.required && !connectedPorts.has(port)) errors.push({ code: 'REQUIRED_INPUT_MISSING', nodeId: node.id, port, message: `VNL: ${node.type}.${port} requer uma entrada.` });
    }
    if (def.requireAnyInput && !connectedPorts.size) errors.push({ code: 'ANY_INPUT_REQUIRED', nodeId: node.id, message: `VNL: ${node.type} requer ao menos uma entrada.` });
  }

  const geometry = nodes.filter(node => node.type === 'Geometry');
  const solvers = nodes.filter(node => node.type === 'Solver');
  const results = nodes.filter(node => node.type === 'Result');
  const missing = [];
  if (!geometry.length) missing.push('Geometry');
  if (!solvers.length) missing.push('Solver');
  if (!results.length) missing.push('Result');
  if (geometry.length > 1) errors.push({ code: 'MULTIPLE_GEOMETRY_SOURCES', message: 'VNL: o grafo deve possuir uma única fonte Geometry por execução.' });
  if (missing.length) errors.push({ code: 'REQUIRED_BLOCKS_MISSING', message: `VNL: blocos obrigatórios ausentes: ${missing.join(', ')}.` });

  const topo = topologicalOrder(graph);
  if (topo.cyclic) errors.push({ code: 'GRAPH_CYCLE', message: 'VNL: ciclos não são permitidos; o grafo de execução deve ser acíclico.' });

  if (geometry.length === 1) {
    const reachable = graphReachability({ nodes, edges }, [geometry[0].id]);
    for (const node of nodes) if (!reachable.has(node.id)) errors.push({ code: 'DISCONNECTED_FROM_GEOMETRY', nodeId: node.id, message: `VNL: ${node.type} (${node.id}) não é alcançável a partir de Geometry.` });
  }
  if (results.length) {
    const canReachResult = graphReachability({ nodes, edges }, results.map(node => node.id), true);
    for (const solver of solvers) if (!canReachResult.has(solver.id)) errors.push({ code: 'SOLVER_WITHOUT_RESULT', nodeId: solver.id, message: `VNL: Solver ${solver.id} não alimenta nenhum bloco Result.` });
  }

  const outgoing = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of edges) outgoing.set(edge.from.nodeId, (outgoing.get(edge.from.nodeId) || 0) + 1);
  for (const node of nodes) {
    if ((outgoing.get(node.id) || 0) === 0 && !['Result', 'Plot', 'Export'].includes(node.type)) warnings.push({ code: 'DEAD_END', nodeId: node.id, message: `VNL: ${node.type} (${node.id}) termina sem pós-processamento.` });
  }

  return { ok: errors.length === 0, missing, errors, warnings, order: topo.order, graph };
}

export function connectSequentially(nodes, options = {}) {
  return sequentialGraphFromNodes(nodes, options);
}
