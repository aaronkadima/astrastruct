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
