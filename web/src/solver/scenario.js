function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function listScenarios(project) {
  const cases = (project.loadCases || []).map(c => ({ id: c.id, name: c.name, kind: 'case', type: c.type || 'user' }));
  const combinations = (project.loadCombinations || []).map(c => ({ id: c.id, name: c.name, kind: 'combination', type: c.type || 'custom' }));
  return [...cases, ...combinations];
}

export function resolveScenario(project, scenarioId) {
  const cases = project.loadCases || [];
  const combinations = project.loadCombinations || [];
  const fallbackId = project.settings?.analysisScenarioId || cases[0]?.id;
  const id = scenarioId || fallbackId;
  const loadCase = cases.find(c => c.id === id);
  const combination = combinations.find(c => c.id === id);
  if (!loadCase && !combination) throw new Error(`Cenário de análise não encontrado: ${id || '(vazio)'}.`);

  const factors = new Map();
  let scenario;
  if (loadCase) {
    factors.set(loadCase.id, 1);
    scenario = { id: loadCase.id, name: loadCase.name, kind: 'case', type: loadCase.type || 'user' };
  } else {
    for (const term of combination.terms || []) {
      if (!cases.some(c => c.id === term.caseId)) continue;
      const factor = Number(term.factor);
      if (!Number.isFinite(factor) || Math.abs(factor) < 1e-15) continue;
      factors.set(term.caseId, (factors.get(term.caseId) || 0) + factor);
    }
    if (!factors.size) throw new Error(`A combinação ${combination.name || combination.id} não possui termos válidos.`);
    scenario = {
      id: combination.id,
      name: combination.name,
      kind: 'combination',
      type: combination.type || 'custom',
      terms: [...factors].map(([caseId, factor]) => ({ caseId, factor }))
    };
  }

  const scaled = clone(project);
  const firstCaseId = cases[0]?.id;
  const factorFor = load => factors.get(load.caseId || firstCaseId) || 0;

  scaled.loads = (project.loads || [])
    .map(load => ({ load, factor: factorFor(load) }))
    .filter(x => Math.abs(x.factor) > 1e-15)
    .map(({ load, factor }) => ({
      ...clone(load),
      fx: (load.fx || 0) * factor,
      fy: (load.fy || 0) * factor,
      mz: (load.mz || 0) * factor,
      sourceCaseId: load.caseId || firstCaseId,
      scenarioFactor: factor
    }));

  scaled.elementLoads = (project.elementLoads || [])
    .map(load => ({ load, factor: factorFor(load) }))
    .filter(x => Math.abs(x.factor) > 1e-15)
    .map(({ load, factor }) => {
      const out = {
        ...clone(load),
        sourceCaseId: load.caseId || firstCaseId,
        scenarioFactor: factor
      };
      if (load.kind === 'uniform') {
        out.qx = (load.qx || 0) * factor;
        out.qy = (load.qy || 0) * factor;
      } else if (load.kind === 'point') {
        out.px = (load.px || 0) * factor;
        out.py = (load.py || 0) * factor;
      } else if (load.kind === 'selfWeight') {
        out.weightFactor = factor * (Number(load.factor) || 1);
      }
      return out;
    });

  scaled.results = null;
  scaled.__scenario = scenario;
  return { project: scaled, scenario };
}
