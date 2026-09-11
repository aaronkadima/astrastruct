export function validateProject(project) {
  const issues = [];
  const nodes = project.nodes || [];
  const elements = project.elements || [];
  const materials = project.materials || [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const materialIds = new Set(materials.map(m => m.id));

  if (!nodes.length) issues.push(issue('error', 'EMPTY_NODES', 'O modelo não possui nós.'));
  if (!elements.length) issues.push(issue('error', 'EMPTY_ELEMENTS', 'O modelo não possui elementos.'));

  for (const e of elements) {
    if (!nodeIds.has(e.n1) || !nodeIds.has(e.n2)) {
      issues.push(issue('error', 'MISSING_NODE', `Elemento ${e.id} referencia nó inexistente.`));
      continue;
    }
    const a = nodes.find(n => n.id === e.n1);
    const b = nodes.find(n => n.id === e.n2);
    if (Math.hypot(b.x - a.x, b.y - a.y) <= 1e-10) {
      issues.push(issue('error', 'ZERO_LENGTH', `Elemento ${e.id} possui comprimento nulo.`));
    }
    if (!materialIds.has(e.materialId)) {
      issues.push(issue('error', 'MISSING_MATERIAL', `Elemento ${e.id} não possui material válido.`));
    }
    if (!(e.A > 0)) issues.push(issue('error', 'INVALID_AREA', `Elemento ${e.id}: área A deve ser positiva.`));
    if (e.type === 'frame2d' && !(e.I > 0)) {
      issues.push(issue('error', 'INVALID_INERTIA', `Elemento ${e.id}: inércia I deve ser positiva.`));
    }
  }

  const referenced = new Set(elements.flatMap(e => [e.n1, e.n2]));
  for (const n of nodes) {
    if (!referenced.has(n.id)) issues.push(issue('warning', 'ORPHAN_NODE', `Nó ${n.id} está isolado.`));
  }

  for (const l of project.loads || []) {
    if (!nodeIds.has(l.nodeId)) issues.push(issue('error', 'LOAD_NODE', `Carga ${l.id} referencia nó inexistente.`));
  }

  const elementIds = new Set(elements.map(e => e.id));
  for (const l of project.elementLoads || []) {
    if (!elementIds.has(l.elementId)) {
      issues.push(issue('error', 'LOAD_ELEMENT', `Carga de elemento ${l.id} referencia elemento inexistente.`));
      continue;
    }
    const e = elements.find(x => x.id === l.elementId);
    if (e?.type !== 'frame2d') {
      issues.push(issue('warning', 'LOAD_UNSUPPORTED', `Carga distribuída em ${e?.id || l.elementId} ainda só é resolvida em elementos de pórtico 2D.`));
    }
  }

  const supportNodes = new Set((project.supports || []).filter(s => s.ux || s.uy || s.rz).map(s => s.nodeId));
  if (elements.length && !supportNodes.size) {
    issues.push(issue('error', 'NO_SUPPORTS', 'Nenhuma restrição de apoio foi definida. O modelo será um mecanismo.'));
  }

  const components = connectedComponents(nodes, elements);
  if (components.length > 1) {
    issues.push(issue('warning', 'DISCONNECTED', `O modelo possui ${components.length} componentes desconectados.`));
  }
  components.forEach((component, index) => {
    if (component.size && ![...component].some(id => supportNodes.has(id))) {
      issues.push(issue('error', 'UNSUPPORTED_COMPONENT', `Componente ${index + 1} não possui apoio.`));
    }
  });

  const restrictions = (project.supports || []).reduce((sum, s) => sum + Number(!!s.ux) + Number(!!s.uy) + Number(!!s.rz), 0);
  if (elements.length && restrictions < 2) {
    issues.push(issue('warning', 'LOW_RESTRAINT', 'Há poucas restrições globais; verifique a estabilidade cinemática do modelo.'));
  }

  return {
    ok: !issues.some(i => i.level === 'error'),
    issues,
    stats: {
      nodes: nodes.length,
      elements: elements.length,
      frameElements: elements.filter(e => e.type === 'frame2d').length,
      trussElements: elements.filter(e => e.type === 'truss2d').length,
      supports: supportNodes.size,
      nodalLoads: (project.loads || []).length,
      elementLoads: (project.elementLoads || []).length,
      components: components.length
    }
  };
}

function issue(level, code, message) {
  return { level, code, message };
}

function connectedComponents(nodes, elements) {
  const adjacency = new Map(nodes.map(n => [n.id, new Set()]));
  for (const e of elements) {
    if (!adjacency.has(e.n1) || !adjacency.has(e.n2)) continue;
    adjacency.get(e.n1).add(e.n2);
    adjacency.get(e.n2).add(e.n1);
  }

  const seen = new Set();
  const components = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const comp = new Set();
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      comp.add(id);
      for (const next of adjacency.get(id) || []) if (!seen.has(next)) stack.push(next);
    }
    components.push(comp);
  }
  return components;
}
