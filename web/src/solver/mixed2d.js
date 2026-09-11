import { zeros, solveLinear, mul, addSub } from './matrix.js';
import { prepareFrameElement, recoverFrameEndForces, frameEndHasRotationalStiffness } from './frameElement.js';

export function solveMixed2D(project) {
  const nodes = project.nodes || [];
  const elements = project.elements || [];
  if (!nodes.length) throw new Error('Modelo sem nós.');
  if (!elements.length) throw new Error('Modelo sem elementos.');

  const nd = nodes.length * 3;
  const K = zeros(nd);
  const F = Array(nd).fill(0);
  const map = new Map(nodes.map((n, i) => [n.id, i]));
  const cache = [];

  for (const e of elements) {
    const i = map.get(e.n1);
    const j = map.get(e.n2);
    if (i == null || j == null) throw new Error(`Elemento ${e.id} referencia nó inexistente.`);

    const a = nodes[i];
    const b = nodes[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (!(L > 1e-10)) throw new Error(`Elemento ${e.id} possui comprimento nulo.`);

    const c = dx / L;
    const s = dy / L;
    const mat = (project.materials || []).find(m => m.id === e.materialId);
    if (!mat) throw new Error(`Material ausente em ${e.id}.`);

    if (e.type === 'frame2d') {
      const loads = (project.elementLoads || []).filter(l => l.elementId === e.id);
      const prepared = prepareFrameElement({
        E: mat.E,
        A: e.A,
        I: e.I,
        L,
        c,
        s,
        loads,
        releases: e.releases || {}
      });
      const idx = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2];
      addSub(K, prepared.kg, idx);
      prepared.pg.forEach((v, k) => { F[idx[k]] += v; });
      cache.push({ kind: 'frame2d', e, idx, prepared });
    } else if (e.type === 'truss2d') {
      if (!(e.A > 0)) throw new Error(`Elemento ${e.id}: A deve ser positiva.`);
      const k = mat.E * e.A / L;
      const ke4 = [
        [c * c, c * s, -c * c, -c * s],
        [c * s, s * s, -c * s, -s * s],
        [-c * c, -c * s, c * c, c * s],
        [-c * s, -s * s, c * s, s * s]
      ].map(row => row.map(v => v * k));
      const idx4 = [3 * i, 3 * i + 1, 3 * j, 3 * j + 1];
      addSub(K, ke4, idx4);
      cache.push({ kind: 'truss2d', e, i, j, c, s, L, mat });
    } else {
      throw new Error(`Tipo de elemento não suportado no solver misto: ${e.type}`);
    }
  }

  for (const l of project.loads || []) {
    const i = map.get(l.nodeId);
    if (i == null) continue;
    F[3 * i] += l.fx || 0;
    F[3 * i + 1] += l.fy || 0;
    F[3 * i + 2] += l.mz || 0;
  }

  const fixed = new Set();
  for (const support of project.supports || []) {
    const i = map.get(support.nodeId);
    if (i == null) continue;
    if (support.ux) fixed.add(3 * i);
    if (support.uy) fixed.add(3 * i + 1);
    if (support.rz) fixed.add(3 * i + 2);
  }

  // DOF de rotação é inativo quando o nó não possui nenhuma extremidade de pórtico
  // capaz de transmitir momento (nós de treliça ou apenas extremidades rotuladas).
  nodes.forEach((node, i) => {
    const activeRotation = elements.some(e => frameEndHasRotationalStiffness(e, node.id));
    if (!activeRotation) fixed.add(3 * i + 2);
  });

  const free = Array.from({ length: nd }, (_, i) => i).filter(i => !fixed.has(i));
  if (!free.length) throw new Error('Modelo sem graus de liberdade livres.');

  const Kr = free.map(i => free.map(j => K[i][j]));
  const Fr = free.map(i => F[i]);
  const ur = solveLinear(Kr, Fr);
  const u = Array(nd).fill(0);
  free.forEach((d, i) => { u[d] = ur[i]; });
  const R = mul(K, u).map((v, i) => v - F[i]);

  const elementForces = cache.map(item => {
    if (item.kind === 'frame2d') {
      const ug = item.idx.map(i => u[i]);
      const { q, ul } = recoverFrameEndForces(item.prepared, ug);
      return {
        elementId: item.e.id,
        type: 'frame2d',
        N1: q[0], V1: q[1], M1: q[2],
        N2: q[3], V2: q[4], M2: q[5],
        localDisplacements: ul
      };
    }

    const { e, i, j, c, s, L, mat } = item;
    const de = -c * u[3 * i] - s * u[3 * i + 1] + c * u[3 * j] + s * u[3 * j + 1];
    return { elementId: e.id, type: 'truss2d', N: mat.E * e.A / L * de };
  });

  return {
    type: 'mixed2d',
    solverVersion: '0.2.0',
    dofs: nd,
    activeDofs: free.length,
    displacements: nodes.map((n, i) => ({
      nodeId: n.id,
      ux: u[3 * i],
      uy: u[3 * i + 1],
      rz: u[3 * i + 2]
    })),
    reactions: nodes.map((n, i) => ({
      nodeId: n.id,
      fx: R[3 * i],
      fy: R[3 * i + 1],
      mz: R[3 * i + 2]
    })),
    elementForces
  };
}
