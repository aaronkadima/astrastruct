import { VNL_PROJECT_CONTRACT, VNL_VERSION } from './contracts.js';
import { defaultVnlGraph, normalizeGraph, validateGraph } from './graph.js';

const clone = value => JSON.parse(JSON.stringify(value));

export function vnlGraphFromProject(project = {}) {
  const stored = project?.vnl?.graph || project?.vnlGraph || null;
  return normalizeGraph(stored || defaultVnlGraph({ id: `vnl-${project?.id || 'project'}` }));
}

export function withVnlGraph(project, graph) {
  const validation = validateGraph(graph);
  if (!validation.ok) {
    const details = validation.errors.map(issue => issue.message).join(' ');
    throw new Error(details || 'VNL: grafo inválido não pode ser persistido.');
  }
  const next = clone(project);
  next.vnl = {
    contract: VNL_PROJECT_CONTRACT,
    version: VNL_VERSION,
    graph: validation.graph,
  };
  if ('vnlGraph' in next) delete next.vnlGraph;
  return next;
}

export function clearVnlGraph(project) {
  const next = clone(project);
  delete next.vnl;
  delete next.vnlGraph;
  return next;
}
