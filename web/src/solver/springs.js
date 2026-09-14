export function addNodalSprings(K, project, nodeMap, dofsPerNode = 3) {
  for (const spring of project.nodeSprings || []) {
    const i = nodeMap.get(spring.nodeId);
    if (i == null) continue;
    const kx = Number(spring.kx) || 0;
    const ky = Number(spring.ky) || 0;
    const kr = Number(spring.kr) || 0;
    if (kx < 0 || ky < 0 || kr < 0) throw new Error(`Mola ${spring.id || spring.nodeId}: rigidez não pode ser negativa.`);
    K[dofsPerNode * i][dofsPerNode * i] += kx;
    K[dofsPerNode * i + 1][dofsPerNode * i + 1] += ky;
    if (dofsPerNode >= 3) K[dofsPerNode * i + 2][dofsPerNode * i + 2] += kr;
  }
}

export function recoverSpringForces(project, displacements) {
  const disp = new Map((displacements || []).map(d => [d.nodeId, d]));
  return (project.nodeSprings || []).map(spring => {
    const d = disp.get(spring.nodeId) || { ux: 0, uy: 0, rz: 0 };
    const kx = Number(spring.kx) || 0;
    const ky = Number(spring.ky) || 0;
    const kr = Number(spring.kr) || 0;
    return {
      springId: spring.id,
      nodeId: spring.nodeId,
      kx, ky, kr,
      fx: -kx * (Number(d.ux) || 0),
      fy: -ky * (Number(d.uy) || 0),
      mz: -kr * (Number(d.rz) || 0)
    };
  });
}

export function spatialSpringStiffnesses(spring = {}) {
  const values = [
    Number(spring.kx) || 0,
    Number(spring.ky) || 0,
    Number(spring.kz) || 0,
    Number(spring.krx) || 0,
    Number(spring.kry) || 0,
    Number(spring.krz ?? spring.kr) || 0
  ];
  if (values.some(v => v < 0)) throw new Error(`Mola ${spring.id || spring.nodeId || ''}: rigidez não pode ser negativa.`);
  return values;
}

export function addSpatialNodalSprings(K, project, nodeMap, dofsPerNode = 6) {
  if (dofsPerNode < 6) throw new Error('Mola espacial requer seis graus de liberdade por nó.');
  for (const spring of project.nodeSprings || []) {
    const i = nodeMap.get(spring.nodeId);
    if (i == null) continue;
    const values = spatialSpringStiffnesses(spring);
    for (let d = 0; d < 6; d++) K[dofsPerNode * i + d][dofsPerNode * i + d] += values[d];
  }
}

export function recoverSpatialSpringForces(project, displacements) {
  const disp = new Map((displacements || []).map(d => [d.nodeId, d]));
  return (project.nodeSprings || []).map(spring => {
    const d = disp.get(spring.nodeId) || {};
    const k = spatialSpringStiffnesses(spring);
    const u = [d.ux, d.uy, d.uz, d.rx, d.ry, d.rz].map(v => Number(v) || 0);
    return {
      springId: spring.id,
      nodeId: spring.nodeId,
      kx: k[0], ky: k[1], kz: k[2], krx: k[3], kry: k[4], krz: k[5],
      fx: -k[0] * u[0], fy: -k[1] * u[1], fz: -k[2] * u[2],
      mx: -k[3] * u[3], my: -k[4] * u[4], mz: -k[5] * u[5]
    };
  });
}
