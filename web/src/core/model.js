export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const MATERIALS = [
  { id: 'concrete30', name: 'Concreto C30 (exemplo)', type: 'concrete', E: 30e6, nu: 0.20, density: 25, fck: 30, fctm: 2.9, fy: null, unit: 'kN/m²', verified: false },
  { id: 'steel355', name: 'Aço estrutural fy=355 MPa (exemplo)', type: 'steel', E: 200e6, nu: 0.30, density: 78.5, fy: 355, fu: 510, unit: 'kN/m²', verified: false },
  { id: 'rebar500', name: 'Aço de armadura fy=500 MPa (exemplo)', type: 'rebar', E: 210e6, nu: 0.30, density: 78.5, fy: 500, fu: 550, unit: 'kN/m²', verified: false },
  { id: 'grout30', name: 'Graute 30 MPa (exemplo)', type: 'grout', E: 25e6, nu: 0.20, density: 23, fck: 30, unit: 'kN/m²', verified: false }
];

export const SECTIONS = [
  { id: 'rc_30x50', name: 'RC retangular 30 × 50 cm', family: 'rect', b: 0.30, h: 0.50, A: 0.150, I: 0.003125 },
  { id: 'rc_30x60', name: 'RC retangular 30 × 60 cm', family: 'rect', b: 0.30, h: 0.60, A: 0.180, I: 0.005400 },
  { id: 'steel_generic', name: 'Aço — seção genérica', family: 'steel', A: 0.012, I: 0.000220 },
  { id: 'truss_generic', name: 'Barra axial — seção genérica', family: 'truss', A: 0.004, I: 0 }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function emptyProject() {
  return {
    id: uid('project'),
    name: 'Novo projeto',
    version: 3,
    units: 'kN-m-MPa',
    nodes: [],
    elements: [],
    materials: clone(MATERIALS),
    sections: clone(SECTIONS),
    supports: [],
    loads: [],
    elementLoads: [],
    loadCases: [{ id: 'LC1', name: 'Caso 1', type: 'user' }],
    loadCombinations: [{ id: 'COMB1', name: 'Combinação customizada 1', type: 'custom', terms: [{ caseId: 'LC1', factor: 1.0 }] }],
    connections: [],
    results: null,
    settings: {
      grid: 0.25,
      snap: true,
      deformationScale: 1,
      activeLoadCaseId: 'LC1',
      analysisScenarioId: 'LC1'
    },
    meta: {
      solverVersion: '0.3.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

export function normalizeProject(input) {
  const base = emptyProject();
  const p = { ...base, ...(input || {}) };
  p.nodes = Array.isArray(p.nodes) ? p.nodes : [];
  p.elements = Array.isArray(p.elements) ? p.elements : [];
  p.materials = Array.isArray(p.materials) && p.materials.length ? p.materials : clone(MATERIALS);
  p.sections = Array.isArray(p.sections) && p.sections.length ? p.sections : clone(SECTIONS);
  p.supports = Array.isArray(p.supports) ? p.supports : [];
  p.loads = Array.isArray(p.loads) ? p.loads : [];
  p.elementLoads = Array.isArray(p.elementLoads) ? p.elementLoads : [];
  p.loadCases = Array.isArray(p.loadCases) && p.loadCases.length ? p.loadCases : clone(base.loadCases);
  p.loadCombinations = Array.isArray(p.loadCombinations) ? p.loadCombinations : clone(base.loadCombinations);
  p.connections = Array.isArray(p.connections) ? p.connections : [];
  p.settings = { ...base.settings, ...(p.settings || {}) };
  p.meta = { ...base.meta, ...(p.meta || {}), solverVersion: '0.3.0' };
  p.version = 3;

  const firstCaseId = p.loadCases[0]?.id || 'LC1';
  p.loads = p.loads.map(l => ({ ...l, caseId: l.caseId || firstCaseId }));
  p.elementLoads = p.elementLoads.map(l => ({ ...l, caseId: l.caseId || firstCaseId }));
  p.elements = p.elements.map(e => ({ ...e, releases: { rz1: false, rz2: false, ...(e.releases || {}) } }));

  const validCaseIds = new Set(p.loadCases.map(c => c.id));
  p.loadCombinations = p.loadCombinations.map(c => ({
    ...c,
    type: c.type || 'custom',
    terms: (c.terms || []).filter(t => validCaseIds.has(t.caseId)).map(t => ({ caseId: t.caseId, factor: Number(t.factor) || 0 }))
  }));
  if (!validCaseIds.has(p.settings.activeLoadCaseId)) p.settings.activeLoadCaseId = firstCaseId;
  const validScenarioIds = new Set([...p.loadCases.map(c => c.id), ...p.loadCombinations.map(c => c.id)]);
  if (!validScenarioIds.has(p.settings.analysisScenarioId)) p.settings.analysisScenarioId = firstCaseId;
  return p;
}

export function makeFrameElement({ id = uid('E'), n1, n2, materialId = 'concrete30', sectionId = 'rc_30x50', label = 'Pórtico 2D', A, I } = {}) {
  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS[0];
  return {
    id,
    type: 'frame2d',
    n1,
    n2,
    materialId,
    sectionId,
    A: A ?? section.A,
    I: I ?? section.I,
    releases: { rz1: false, rz2: false },
    label
  };
}

export function makeTrussElement({ id = uid('E'), n1, n2, materialId = 'steel355', sectionId = 'truss_generic', label = 'Treliça 2D', A } = {}) {
  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS.find(s => s.id === 'truss_generic');
  return {
    id,
    type: 'truss2d',
    n1,
    n2,
    materialId,
    sectionId,
    A: A ?? section.A,
    I: 0,
    releases: { rz1: true, rz2: true },
    label
  };
}

export function demoFrame() {
  const p = emptyProject();
  p.name = 'Pórtico demonstrativo';
  p.nodes = [
    { id: 'N1', x: 0, y: 0 },
    { id: 'N2', x: 0, y: 3 },
    { id: 'N3', x: 5, y: 3 },
    { id: 'N4', x: 5, y: 0 }
  ];
  p.elements = [
    makeFrameElement({ id: 'E1', n1: 'N1', n2: 'N2', sectionId: 'rc_30x60', A: 0.18, I: 0.0054, label: 'Pilar 1' }),
    makeFrameElement({ id: 'E2', n1: 'N2', n2: 'N3', sectionId: 'rc_30x50', label: 'Viga' }),
    makeFrameElement({ id: 'E3', n1: 'N3', n2: 'N4', sectionId: 'rc_30x60', A: 0.18, I: 0.0054, label: 'Pilar 2' })
  ];
  p.supports = [
    { nodeId: 'N1', ux: true, uy: true, rz: true },
    { nodeId: 'N4', ux: true, uy: true, rz: true }
  ];
  p.loads = [
    { id: 'L1', caseId: 'LC1', nodeId: 'N2', fx: 20, fy: 0, mz: 0 },
    { id: 'L2', caseId: 'LC1', nodeId: 'N3', fx: 0, fy: -40, mz: 0 }
  ];
  return p;
}

export function demoBeamUDL() {
  const p = emptyProject();
  p.name = 'Viga biapoiada — carga distribuída';
  p.nodes = [
    { id: 'N1', x: 0, y: 0 },
    { id: 'N2', x: 3, y: 0 },
    { id: 'N3', x: 6, y: 0 }
  ];
  p.elements = [
    makeFrameElement({ id: 'E1', n1: 'N1', n2: 'N2', label: 'Viga — trecho 1' }),
    makeFrameElement({ id: 'E2', n1: 'N2', n2: 'N3', label: 'Viga — trecho 2' })
  ];
  p.supports = [
    { nodeId: 'N1', ux: true, uy: true, rz: false },
    { nodeId: 'N3', ux: false, uy: true, rz: false }
  ];
  p.elementLoads = [
    { id: 'EL1', caseId: 'LC1', elementId: 'E1', kind: 'uniform', qx: 0, qy: -20 },
    { id: 'EL2', caseId: 'LC1', elementId: 'E2', kind: 'uniform', qx: 0, qy: -20 }
  ];
  return p;
}

export function demoTruss() {
  const p = emptyProject();
  p.name = 'Treliça demonstrativa';
  p.nodes = [
    { id: 'N1', x: 0, y: 0 },
    { id: 'N2', x: 4, y: 0 },
    { id: 'N3', x: 2, y: 3 }
  ];
  p.elements = [
    makeTrussElement({ id: 'E1', n1: 'N1', n2: 'N3', label: 'Barra 1' }),
    makeTrussElement({ id: 'E2', n1: 'N3', n2: 'N2', label: 'Barra 2' }),
    makeTrussElement({ id: 'E3', n1: 'N1', n2: 'N2', label: 'Barra 3' })
  ];
  p.supports = [
    { nodeId: 'N1', ux: true, uy: true, rz: false },
    { nodeId: 'N2', ux: false, uy: true, rz: false }
  ];
  p.loads = [{ id: 'L1', caseId: 'LC1', nodeId: 'N3', fx: 0, fy: -100, mz: 0 }];
  return p;
}

export function demoMixed() {
  const p = emptyProject();
  p.name = 'Pórtico contraventado misto';
  p.nodes = [
    { id: 'N1', x: 0, y: 0 },
    { id: 'N2', x: 0, y: 3 },
    { id: 'N3', x: 5, y: 3 },
    { id: 'N4', x: 5, y: 0 }
  ];
  p.elements = [
    makeFrameElement({ id: 'E1', n1: 'N1', n2: 'N2', materialId: 'steel355', sectionId: 'steel_generic', A: 0.012, I: 0.00022, label: 'Coluna 1' }),
    makeFrameElement({ id: 'E2', n1: 'N2', n2: 'N3', materialId: 'steel355', sectionId: 'steel_generic', A: 0.012, I: 0.00022, label: 'Viga' }),
    makeFrameElement({ id: 'E3', n1: 'N3', n2: 'N4', materialId: 'steel355', sectionId: 'steel_generic', A: 0.012, I: 0.00022, label: 'Coluna 2' }),
    makeTrussElement({ id: 'E4', n1: 'N1', n2: 'N3', materialId: 'steel355', A: 0.004, label: 'Contraventamento' })
  ];
  p.supports = [
    { nodeId: 'N1', ux: true, uy: true, rz: true },
    { nodeId: 'N4', ux: true, uy: true, rz: true }
  ];
  p.loads = [{ id: 'L1', caseId: 'LC1', nodeId: 'N2', fx: 50, fy: 0, mz: 0 }];
  return p;
}

export function demoLoadCases() {
  const p = demoFrame();
  p.name = 'Pórtico — casos e combinação';
  p.loadCases = [
    { id: 'G', name: 'Permanente (exemplo)', type: 'permanent' },
    { id: 'Q', name: 'Variável (exemplo)', type: 'variable' }
  ];
  p.loads = [
    { id: 'LG1', caseId: 'G', nodeId: 'N3', fx: 0, fy: -30, mz: 0 },
    { id: 'LQ1', caseId: 'Q', nodeId: 'N2', fx: 25, fy: 0, mz: 0 }
  ];
  p.elementLoads = [{ id: 'EG1', caseId: 'G', elementId: 'E2', kind: 'uniform', qx: 0, qy: -8 }];
  p.loadCombinations = [{
    id: 'COMB1',
    name: 'Combinação customizada demonstrativa',
    type: 'custom',
    terms: [{ caseId: 'G', factor: 1.2 }, { caseId: 'Q', factor: 1.5 }]
  }];
  p.settings.activeLoadCaseId = 'G';
  p.settings.analysisScenarioId = 'COMB1';
  return p;
}
