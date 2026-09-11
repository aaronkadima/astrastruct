import {
  demoTruss, demoFrame, demoBeamUDL, demoMixed, demoLoadCases,
  emptyProject, makeFrameElement
} from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { solveEnvelope } from '../web/src/solver/envelope.js';

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
  assert(r.elementResponses.length === p.elements.length, `${p.name}: pós-processamento incompleto`);
  console.log(p.name, 'OK', 'solver=', r.type, 'DOFs=', r.dofs, 'ativos=', r.activeDofs);
}

// Viga biapoiada L=6 m, q=20 kN/m: reações verticais = 60 kN em cada apoio.
// Com E=30 GPa e I=0,003125 m4, flecha teórica no meio = 5 q L4 / (384 EI) = 0,0036 m.
// Momento fletor máximo = qL²/8 = 90 kN.m.
{
  const p = demoBeamUDL();
  const r = solve(p, 'LC1');
  const r1 = r.reactions.find(x => x.nodeId === 'N1');
  const r3 = r.reactions.find(x => x.nodeId === 'N3');
  const mid = r.displacements.find(x => x.nodeId === 'N2');
  near(r1.fy, 60, 1e-6, 'Viga UDL: reação N1');
  near(r3.fy, 60, 1e-6, 'Viga UDL: reação N3');
  near(Math.abs(mid.uy), 0.0036, 2e-5, 'Viga UDL: flecha no meio');
  near(r1.fy + r3.fy, 120, 1e-6, 'Viga UDL: equilíbrio vertical');

  const moments = r.elementResponses.flatMap(er => er.stations.map(s => s.M));
  near(Math.max(...moments), 90, 1e-6, 'Viga UDL: momento máximo do diagrama');
  const e1 = r.elementResponses.find(er => er.elementId === 'E1');
  const e2 = r.elementResponses.find(er => er.elementId === 'E2');
  near(e1.stations[0].M, 0, 1e-7, 'Viga UDL: M apoio esquerdo');
  near(e1.stations.at(-1).M, 90, 1e-6, 'Viga UDL: M no meio pela esquerda');
  near(e2.stations[0].M, 90, 1e-6, 'Viga UDL: M no meio pela direita');
  near(e2.stations.at(-1).M, 0, 1e-6, 'Viga UDL: M apoio direito');
  console.log(p.name, 'OK', 'Ry=', r1.fy, r3.fy, 'flecha meio [mm]=', Math.abs(mid.uy) * 1000, 'Mmax=', Math.max(...moments));
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
  const r = solve(p, 'LC1');
  const f = r.elementForces[0];
  near(f.M2, 0, 1e-8, 'Liberação rotacional: M2');
  near(r.elementResponses[0].stations.at(-1).M, 0, 1e-8, 'Liberação rotacional: M(x=L)');
  console.log(p.name, 'OK', 'M2=', f.M2);
}

// Princípio da superposição: COMB1 = 1.2G + 1.5Q deve reproduzir a combinação
// linear dos vetores de deslocamentos e reações obtidos isoladamente.
{
  const p = demoLoadCases();
  const g = solve(p, 'G');
  const q = solve(p, 'Q');
  const c = solve(p, 'COMB1');
  assert(c.scenario.kind === 'combination', 'Combinação: metadado de cenário incorreto');

  for (let i = 0; i < c.displacements.length; i++) {
    for (const dof of ['ux', 'uy', 'rz']) {
      near(c.displacements[i][dof], 1.2 * g.displacements[i][dof] + 1.5 * q.displacements[i][dof], 1e-10, `Superposição ${c.displacements[i].nodeId}.${dof}`);
    }
  }
  for (let i = 0; i < c.reactions.length; i++) {
    for (const dof of ['fx', 'fy', 'mz']) {
      near(c.reactions[i][dof], 1.2 * g.reactions[i][dof] + 1.5 * q.reactions[i][dof], 1e-8, `Reação combinada ${c.reactions[i].nodeId}.${dof}`);
    }
  }

  // A mesma superposição deve aparecer no campo M(x) amostrado.
  for (let ei = 0; ei < c.elementResponses.length; ei++) {
    const ce = c.elementResponses[ei], ge = g.elementResponses[ei], qe = q.elementResponses[ei];
    for (let si = 0; si < ce.stations.length; si += 8) {
      near(ce.stations[si].M, 1.2 * ge.stations[si].M + 1.5 * qe.stations[si].M, 1e-8, `Superposição M(x) ${ce.elementId}@${si}`);
    }
  }

  const env = solveEnvelope(p);
  assert(env.scenarios.length === 3, 'Envelope: quantidade de cenários inesperada');
  assert(env.elementResponses.length === p.elements.length, 'Envelope: elementos ausentes');
  for (const er of env.elementResponses) {
    assert(er.stations.every(s => s.M.min <= s.M.max && s.N.min <= s.N.max), `Envelope inválido em ${er.elementId}`);
  }
  console.log(p.name, 'OK', 'cenário=', c.scenario.name, 'envelope cenários=', env.scenarios.length);
}

console.log('Todos os smoke tests do AstraStruct v0.4 passaram.');
