import { zeros, solveLinear, mul, addSub } from './matrix.js';

export function solveTruss2D(project) {
  const nodes = project.nodes || [];
  const elements = (project.elements || []).filter(e => e.type === 'truss2d');
  if (!nodes.length) throw new Error('Modelo sem nós.');
  if (!elements.length) throw new Error('Modelo sem elementos de treliça 2D.');

  const nd = nodes.length * 2;
  const K = zeros(nd);
  const F = Array(nd).fill(0);
  const map = new Map(nodes.map((n, i) => [n.id, i]));

  for (const e of elements) {
    const i = map.get(e.n1), j = map.get(e.n2);
    if (i == null || j == null) throw new Error(`Elemento ${e.id} referencia nó inexistente.`);
    const a = nodes[i], b = nodes[j];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (!(L > 1e-10)) throw new Error(`Elemento ${e.id} possui comprimento nulo.`);
    if (!(e.A > 0)) throw new Error(`Elemento ${e.id}: A deve ser positiva.`);
    const mat = (project.materials || []).find(m => m.id === e.materialId);
    if (!mat) throw new Error(`Material ausente em ${e.id}.`);
    const c = dx / L, s = dy / L, k = mat.E * e.A / L;
    const ke = [
      [c*c, c*s, -c*c, -c*s],
      [c*s, s*s, -c*s, -s*s],
      [-c*c, -c*s, c*c, c*s],
      [-c*s, -s*s, c*s, s*s]
    ].map(row => row.map(v => v * k));
    addSub(K, ke, [2*i, 2*i+1, 2*j, 2*j+1]);
  }

  for (const l of project.loads || []) {
    const i = map.get(l.nodeId);
    if (i == null) continue;
    F[2*i] += l.fx || 0;
    F[2*i+1] += l.fy || 0;
  }

  const fixed = new Set();
  for (const support of project.supports || []) {
    const i = map.get(support.nodeId);
    if (i == null) continue;
    if (support.ux) fixed.add(2*i);
    if (support.uy) fixed.add(2*i+1);
  }
  const free = Array.from({ length: nd }, (_, i) => i).filter(i => !fixed.has(i));
  if (!free.length) throw new Error('Modelo sem graus de liberdade livres.');

  const Kr = free.map(i => free.map(j => K[i][j]));
  const Fr = free.map(i => F[i]);
  const ur = solveLinear(Kr, Fr);
  const u = Array(nd).fill(0);
  free.forEach((d, i) => { u[d] = ur[i]; });
  const R = mul(K, u).map((v, i) => v - F[i]);

  const axial = elements.map(e => {
    const i = map.get(e.n1), j = map.get(e.n2), a = nodes[i], b = nodes[j];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), c = dx / L, s = dy / L;
    const mat = project.materials.find(m => m.id === e.materialId);
    const de = -c*u[2*i] - s*u[2*i+1] + c*u[2*j] + s*u[2*j+1];
    return { elementId: e.id, type: 'truss2d', N: mat.E * e.A / L * de };
  });

  return {
    type: 'truss2d',
    solverVersion: '0.2.0',
    dofs: nd,
    activeDofs: free.length,
    displacements: nodes.map((n, i) => ({ nodeId: n.id, ux: u[2*i], uy: u[2*i+1], rz: 0 })),
    reactions: nodes.map((n, i) => ({ nodeId: n.id, fx: R[2*i], fy: R[2*i+1], mz: 0 })),
    elementForces: axial
  };
}
