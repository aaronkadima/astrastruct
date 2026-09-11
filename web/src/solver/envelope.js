import { solve } from './index.js';
import { listScenarios } from './scenario.js';

function initStationEnvelope(station) {
  return {
    xi: station.xi,
    x: station.x,
    N: { min: station.N, max: station.N },
    V: { min: station.V, max: station.V },
    M: { min: station.M, max: station.M },
    vLocal: { min: station.vLocal, max: station.vLocal },
    ux: { min: station.ux, max: station.ux },
    uy: { min: station.uy, max: station.uy }
  };
}

function extend(range, value) {
  range.min = Math.min(range.min, value);
  range.max = Math.max(range.max, value);
}

export function solveEnvelope(project, scenarioIds = null) {
  const ids = scenarioIds?.length ? scenarioIds : listScenarios(project).map(s => s.id);
  if (!ids.length) throw new Error('Nenhum cenário disponível para envelope.');

  const solved = ids.map(id => solve(project, id));
  const nodeMap = new Map();
  const elementMap = new Map();

  for (const result of solved) {
    for (const d of result.displacements || []) {
      let env = nodeMap.get(d.nodeId);
      if (!env) {
        env = {
          nodeId: d.nodeId,
          ux: { min: d.ux, max: d.ux },
          uy: { min: d.uy, max: d.uy },
          rz: { min: d.rz, max: d.rz }
        };
        nodeMap.set(d.nodeId, env);
      } else {
        extend(env.ux, d.ux); extend(env.uy, d.uy); extend(env.rz, d.rz);
      }
    }

    for (const response of result.elementResponses || []) {
      let env = elementMap.get(response.elementId);
      if (!env) {
        env = {
          elementId: response.elementId,
          type: response.type,
          L: response.L,
          stations: response.stations.map(initStationEnvelope)
        };
        elementMap.set(response.elementId, env);
      } else {
        response.stations.forEach((st, i) => {
          const target = env.stations[i];
          if (!target) return;
          extend(target.N, st.N); extend(target.V, st.V); extend(target.M, st.M);
          extend(target.vLocal, st.vLocal); extend(target.ux, st.ux); extend(target.uy, st.uy);
        });
      }
    }
  }

  return {
    type: 'linear-envelope',
    scenarioIds: ids,
    scenarios: solved.map(r => r.scenario),
    nodeDisplacements: [...nodeMap.values()],
    elementResponses: [...elementMap.values()],
    solverVersion: '0.4.0'
  };
}
