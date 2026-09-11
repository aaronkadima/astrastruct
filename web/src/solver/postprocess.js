function sumUniformLoads(project, elementId) {
  return (project.elementLoads || [])
    .filter(l => l.elementId === elementId && l.kind === 'uniform')
    .reduce((acc, l) => ({ qx: acc.qx + (l.qx || 0), qy: acc.qy + (l.qy || 0) }), { qx: 0, qy: 0 });
}

function hermite(local, L, xi) {
  const u = (1 - xi) * local[0] + xi * local[3];
  const x2 = xi * xi, x3 = x2 * xi;
  const h1 = 1 - 3 * x2 + 2 * x3;
  const h2 = L * (xi - 2 * x2 + x3);
  const h3 = 3 * x2 - 2 * x3;
  const h4 = L * (-x2 + x3);
  const v = h1 * local[1] + h2 * local[2] + h3 * local[4] + h4 * local[5];
  return { u, v };
}

function frameResponse(project, element, force, samples) {
  const a = project.nodes.find(n => n.id === element.n1);
  const b = project.nodes.find(n => n.id === element.n2);
  if (!a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (!(L > 0)) return null;
  const c = dx / L, s = dy / L;
  const { qx, qy } = sumUniformLoads(project, element.id);
  const local = force.localDisplacements || [0, 0, 0, 0, 0, 0];
  const stations = [];

  for (let i = 0; i < samples; i++) {
    const xi = i / (samples - 1), x = xi * L;
    // Convenções internas para a face esquerda da seção:
    // N > 0 = tração; V segue +y local; M > 0 = sagente.
    const N = -(force.N1 || 0) - qx * x;
    const V = (force.V1 || 0) + qy * x;
    const M = -(force.M1 || 0) + (force.V1 || 0) * x + qy * x * x / 2;
    const d = hermite(local, L, xi);
    const du = c * d.u - s * d.v;
    const dv = s * d.u + c * d.v;
    stations.push({
      xi, x,
      N, V, M,
      uLocal: d.u, vLocal: d.v,
      x0: a.x + xi * dx,
      y0: a.y + xi * dy,
      ux: du, uy: dv
    });
  }

  return {
    elementId: element.id,
    type: 'frame2d',
    L, c, s, qx, qy,
    convention: { N: 'tração positiva', V: '+y local positivo', M: 'sagente positivo' },
    stations
  };
}

function trussResponse(project, element, force, samples) {
  const a = project.nodes.find(n => n.id === element.n1);
  const b = project.nodes.find(n => n.id === element.n2);
  if (!a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (!(L > 0)) return null;
  const c = dx / L, s = dy / L;
  const disp = new Map((project.__resultDisplacements || []).map(d => [d.nodeId, d]));
  const da = disp.get(a.id) || { ux: 0, uy: 0 }, db = disp.get(b.id) || { ux: 0, uy: 0 };
  const stations = [];
  for (let i = 0; i < samples; i++) {
    const xi = i / (samples - 1), x = xi * L;
    const ux = (1 - xi) * da.ux + xi * db.ux;
    const uy = (1 - xi) * da.uy + xi * db.uy;
    stations.push({ xi, x, N: force.N || 0, V: 0, M: 0, x0: a.x + xi * dx, y0: a.y + xi * dy, ux, uy, uLocal: c * ux + s * uy, vLocal: -s * ux + c * uy });
  }
  return { elementId: element.id, type: 'truss2d', L, c, s, qx: 0, qy: 0, convention: { N: 'tração positiva' }, stations };
}

export function buildElementResponses(project, result, samples = 41) {
  const n = Math.max(2, Math.min(201, Math.round(samples)));
  const forceMap = new Map((result.elementForces || []).map(f => [f.elementId, f]));
  const enrichedProject = { ...project, __resultDisplacements: result.displacements || [] };
  return (project.elements || []).map(element => {
    const force = forceMap.get(element.id);
    if (!force) return null;
    return element.type === 'frame2d'
      ? frameResponse(enrichedProject, element, force, n)
      : trussResponse(enrichedProject, element, force, n);
  }).filter(Boolean);
}

export function responseExtrema(response) {
  const fields = ['N', 'V', 'M', 'uLocal', 'vLocal', 'ux', 'uy'];
  const extrema = {};
  for (const field of fields) {
    const vals = response.stations.map(p => Number(p[field]) || 0);
    extrema[field] = { min: Math.min(...vals), max: Math.max(...vals), abs: Math.max(...vals.map(Math.abs)) };
  }
  return extrema;
}
