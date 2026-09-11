import {
  demoTruss, demoFrame, demoBeamUDL, demoMixed,
  emptyProject, makeFrameElement
} from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function near(actual, expected, tol, message) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${message}: esperado ${expected}, obtido ${actual}`);
  }
}

for (const p of [demoTruss(), demoFrame(), demoMixed()]) {
  const r = solve(p);
  assert(r.displacements.length > 0, `${p.name}: sem deslocamentos`);
  assert(r.displacements.every(d => [d.ux, d.uy, d.rz].every(Number.isFinite)), `${p.name}: resultado não finito`);
  assert(r.elementForces.length === p.elements.length, `${p.name}: número de resultados de elementos inconsistente`);
  console.log(p.name, 'OK', 'solver=', r.type, 'DOFs=', r.dofs, 'ativos=', r.activeDofs);
}

// Viga biapoiada L=6 m, q=20 kN/m: reações verticais = 60 kN em cada apoio.
// Com E=30 GPa e I=0,003125 m4, flecha teórica no meio = 5 q L4 / (384 EI) = 0,0036 m.
{
  const p = demoBeamUDL();
  const r = solve(p);
  const r1 = r.reactions.find(x => x.nodeId === 'N1');
  const r3 = r.reactions.find(x => x.nodeId === 'N3');
  const mid = r.displacements.find(x => x.nodeId === 'N2');
  near(r1.fy, 60, 1e-6, 'Viga UDL: reação N1');
  near(r3.fy, 60, 1e-6, 'Viga UDL: reação N3');
  near(Math.abs(mid.uy), 0.0036, 2e-5, 'Viga UDL: flecha no meio');
  near(r1.fy + r3.fy, 120, 1e-6, 'Viga UDL: equilíbrio vertical');
  console.log(p.name, 'OK', 'Ry=', r1.fy, r3.fy, 'flecha meio [mm]=', Math.abs(mid.uy) * 1000);
}

// Extremidade rotulada: momento local recuperado deve ser nulo na liberação.
{
  const p = emptyProject();
  p.name = 'Teste de liberação rotacional';
  p.nodes = [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 4, y: 0 }];
  const e = makeFrameElement({ id: 'E1', n1: 'N1', n2: 'N2', label: 'Viga rotulada' });
  e.releases.rz2 = true;
  p.elements = [e];
  p.supports = [
    { nodeId: 'N1', ux: true, uy: true, rz: true },
    { nodeId: 'N2', ux: false, uy: true, rz: false }
  ];
  p.elementLoads = [{ id: 'EL1', caseId: 'LC1', elementId: 'E1', kind: 'uniform', qx: 0, qy: -10 }];
  const r = solve(p);
  const f = r.elementForces[0];
  near(f.M2, 0, 1e-8, 'Liberação rotacional: M2');
  console.log(p.name, 'OK', 'M2=', f.M2);
}

console.log('Todos os smoke tests do AstraStruct v0.2 passaram.');
