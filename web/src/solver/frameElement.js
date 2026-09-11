import { solveLinear, mul } from './matrix.js';

export function transpose(A) {
  return A[0].map((_, j) => A.map(r => r[j]));
}

export function mm(A, B) {
  return A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
}

export function frameLocalStiffness(E, A, I, L) {
  const ea = E * A / L;
  const ei = E * I;
  const L2 = L * L;
  const L3 = L2 * L;
  return [
    [ ea, 0, 0, -ea, 0, 0 ],
    [ 0, 12 * ei / L3, 6 * ei / L2, 0, -12 * ei / L3, 6 * ei / L2 ],
    [ 0, 6 * ei / L2, 4 * ei / L, 0, -6 * ei / L2, 2 * ei / L ],
    [ -ea, 0, 0, ea, 0, 0 ],
    [ 0, -12 * ei / L3, -6 * ei / L2, 0, 12 * ei / L3, -6 * ei / L2 ],
    [ 0, 6 * ei / L2, 2 * ei / L, 0, -6 * ei / L2, 4 * ei / L ]
  ];
}

export function frameTransform(c, s) {
  return [
    [ c, s, 0, 0, 0, 0 ],
    [ -s, c, 0, 0, 0, 0 ],
    [ 0, 0, 1, 0, 0, 0 ],
    [ 0, 0, 0, c, s, 0 ],
    [ 0, 0, 0, -s, c, 0 ],
    [ 0, 0, 0, 0, 0, 1 ]
  ];
}

// Carga distribuída uniforme no sistema local do elemento.
// qx > 0 atua em +x local; qy > 0 atua em +y local.
export function uniformDistributedLoadVector(qx = 0, qy = 0, L) {
  return [
    qx * L / 2,
    qy * L / 2,
    qy * L * L / 12,
    qx * L / 2,
    qy * L / 2,
    -qy * L * L / 12
  ];
}

function addVectors(a, b) {
  return a.map((v, i) => v + b[i]);
}

function zeroMatrix(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function releasedDofs(releases = {}) {
  const out = [];
  if (releases.rz1) out.push(2);
  if (releases.rz2) out.push(5);
  return out;
}

function condenseReleased(kl, pOriginal, releases = {}) {
  const r = releasedDofs(releases);
  if (!r.length) {
    return {
      kEff: kl.map(row => [...row]),
      pEff: [...pOriginal],
      releaseData: null
    };
  }

  const a = [0, 1, 2, 3, 4, 5].filter(i => !r.includes(i));
  const Kaa = a.map(i => a.map(j => kl[i][j]));
  const Kar = a.map(i => r.map(j => kl[i][j]));
  const Kra = r.map(i => a.map(j => kl[i][j]));
  const Krr = r.map(i => r.map(j => kl[i][j]));
  const pa = a.map(i => pOriginal[i]);
  const pr = r.map(i => pOriginal[i]);

  // X = inv(Krr) * Kra
  const columns = a.map((_, j) => solveLinear(Krr, Kra.map(row => row[j])));
  const X = r.map((_, ri) => a.map((_, aj) => columns[aj][ri]));
  const y = solveLinear(Krr, pr);

  const kCond = Kaa.map((row, i) => row.map((v, j) =>
    v - Kar[i].reduce((sum, kar, rr) => sum + kar * X[rr][j], 0)
  ));
  const pCond = pa.map((v, i) =>
    v - Kar[i].reduce((sum, kar, rr) => sum + kar * y[rr], 0)
  );

  const kEff = zeroMatrix(6);
  const pEff = Array(6).fill(0);
  a.forEach((ii, i) => {
    pEff[ii] = pCond[i];
    a.forEach((jj, j) => { kEff[ii][jj] = kCond[i][j]; });
  });

  return {
    kEff,
    pEff,
    releaseData: { active: a, released: r, Krr, Kra, pr }
  };
}

export function prepareFrameElement({ E, A, I, L, c, s, loads = [], releases = {} }) {
  if (!(E > 0)) throw new Error('Módulo de elasticidade E deve ser positivo.');
  if (!(A > 0)) throw new Error('Área A deve ser positiva.');
  if (!(I > 0)) throw new Error('Inércia I deve ser positiva.');
  if (!(L > 1e-12)) throw new Error('Comprimento do elemento deve ser positivo.');

  const kl = frameLocalStiffness(E, A, I, L);
  const tr = frameTransform(c, s);
  const pOriginal = loads.reduce((acc, load) => {
    if (load.kind !== 'uniform') return acc;
    return addVectors(acc, uniformDistributedLoadVector(load.qx || 0, load.qy || 0, L));
  }, Array(6).fill(0));

  const { kEff, pEff, releaseData } = condenseReleased(kl, pOriginal, releases);
  const kg = mm(transpose(tr), mm(kEff, tr));
  const pg = mul(transpose(tr), pEff);

  return { kl, tr, kg, pg, pOriginal, pEff, releaseData, L, c, s };
}

export function recoverFrameEndForces(prepared, globalDisplacements) {
  const ulNodal = mul(prepared.tr, globalDisplacements);
  let ul = [...ulNodal];

  if (prepared.releaseData) {
    const { active, released, Krr, Kra, pr } = prepared.releaseData;
    const ua = active.map(i => ulNodal[i]);
    const rhs = pr.map((v, ri) =>
      v - Kra[ri].reduce((sum, k, j) => sum + k * ua[j], 0)
    );
    const ur = solveLinear(Krr, rhs);
    released.forEach((dof, i) => { ul[dof] = ur[i]; });
  }

  const q = mul(prepared.kl, ul).map((v, i) => v - prepared.pOriginal[i]);
  return { q, ul, ulNodal };
}

export function frameEndHasRotationalStiffness(element, nodeId) {
  if (element.type !== 'frame2d') return false;
  if (element.n1 === nodeId) return !element.releases?.rz1;
  if (element.n2 === nodeId) return !element.releases?.rz2;
  return false;
}
