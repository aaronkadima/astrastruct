import assert from 'node:assert/strict';
import { emptyProject, makeFrameElement, normalizeProject } from '../web/src/core/model.js';
import { createVnlNode, createVnlEdge, executeVnlGraph, VNL_CONTRACT, VNL_VERSION } from '../web/src/vnl/index.js';

function graphFor(analysisType, scenarioId = 'LC1') {
  return {
    contract: VNL_CONTRACT,
    version: VNL_VERSION,
    id: `mode-${analysisType}`,
    name: `VNL ${analysisType}`,
    nodes: [
      createVnlNode('Geometry', { id: 'G' }),
      createVnlNode('Solver', { id: 'S', params: { analysisType, scenarioId, label: analysisType } }),
      createVnlNode('Result', { id: 'R' }),
    ],
    edges: [
      createVnlEdge('G', 'model', 'S', 'model'),
      createVnlEdge('S', 'result', 'R', 'result'),
    ],
  };
}

function frameProject() {
  const p = emptyProject();
  p.name = 'VNL static modes';
  p.nodes = [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 4, y: 0 }];
  p.elements = [makeFrameElement({ id: 'E1', n1: 'N1', n2: 'N2', sectionId: 'rc_30x50', A: 0.15, I: 0.003125 })];
  p.supports = [{ nodeId: 'N1', ux: true, uy: true, rz: true }];
  p.loads = [{ id: 'P1', caseId: 'LC1', nodeId: 'N2', fx: -80, fy: -10, mz: 0 }];
  p.loadCases = [{ id: 'LC1', name: 'Static', type: 'user' }];
  p.loadCombinations = [];
  p.settings.analysisScenarioId = 'LC1';
  p.settings.activeLoadCaseId = 'LC1';
  p.settings.nonlinearSteps = 8;
  p.settings.nonlinearMaxIterations = 40;
  p.settings.nonlinearTolerance = 1e-9;
  return normalizeProject(p);
}

function dynamicProject() {
  const g = 9.80665, L = 2, E = 200e6, A = 0.01, gamma = 78.5;
  const p = emptyProject();
  p.name = 'VNL dynamic modes';
  p.nodes = [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: L, y: 0 }];
  p.elements = [{ id: 'T1', type: 'truss2d', n1: 'N1', n2: 'N2', materialId: 'S', sectionId: 'TR', A, I: 0 }];
  p.materials = [{ id: 'S', name: 'Steel', type: 'steel', E, density: gamma, alpha: 12e-6, fy: 355 }];
  p.sections = [{ id: 'TR', name: 'Truss', family: 'truss', A, I: 0 }];
  p.supports = [{ nodeId: 'N1', ux: true, uy: true, rz: true }, { nodeId: 'N2', ux: false, uy: true, rz: false }];
  p.loads = [{ id: 'P', caseId: 'LC1', nodeId: 'N2', fx: 10, fy: 0, mz: 0 }];
  p.elementLoads = [];
  p.loadCases = [{ id: 'LC1', name: 'Dynamic', type: 'user' }];
  p.loadCombinations = [];
  const gm = [{ t: 0, accelG: 0 }, { t: 0.04, accelG: 0.20 }, { t: 0.08, accelG: 0 }, { t: 0.12, accelG: -0.10 }, { t: 0.20, accelG: 0 }];
  p.settings = {
    ...p.settings,
    activeLoadCaseId: 'LC1',
    analysisScenarioId: 'LC1',
    dynamicMassFormulation: 'consistent',
    modalModes: 3,
    dynamicDampingRatio: 0.02,
    dynamicRayleighMode1: 1,
    dynamicRayleighMode2: 1,
    dynamicTimeStep: 0.002,
    dynamicDuration: 0.20,
    dynamicMonitorNodeId: 'N2',
    dynamicMonitorDof: 'ux',
    dynamicExcitationType: 'load-pattern',
    dynamicHistoryPoints: [{ t: 0, scale: 0 }, { t: 0.04, scale: 1 }, { t: 0.12, scale: -0.5 }, { t: 0.20, scale: 0 }],
    dynamicGroundMotionDirection: 'x',
    dynamicGroundMotionPoints: gm,
    responseSpectrumCombination: 'cqc',
    responseSpectrumDirectionalCombination: 'srss',
    responseSpectrumPeriodMin: 0.01,
    responseSpectrumPeriodMax: 0.5,
    responseSpectrumPeriodPoints: 30,
  };
  assert(g > 0);
  return normalizeProject(p);
}

const staticProject = frameProject();
for (const mode of ['linear', 'pdelta', 'corotational']) {
  const execution = executeVnlGraph(graphFor(mode), staticProject);
  assert.ok(execution.primaryResult, `${mode}: VNL deve retornar resultado principal`);
  assert.equal(execution.primaryResult.analysisType, mode, `${mode}: analysisType deve sobreviver ao runtime VNL`);
  assert.ok(Array.isArray(execution.primaryResult.displacements) && execution.primaryResult.displacements.length > 0, `${mode}: deslocamentos ausentes`);
}

const dynamic = dynamicProject();
const modal = executeVnlGraph(graphFor('modal'), dynamic).primaryResult;
assert.equal(modal.analysisType, 'modal');
assert.ok((modal.modal?.modes || modal.modes || []).length > 0, 'modal: modos ausentes');

const timeHistory = executeVnlGraph(graphFor('time-history'), dynamic).primaryResult;
assert.equal(timeHistory.analysisType, 'time-history');
assert.ok(timeHistory.history?.length > 2, 'time-history: histórico ausente');
assert.ok(timeHistory.peakResponse?.absDisplacement > 0, 'time-history: resposta nula inesperada');

const spectrum = executeVnlGraph(graphFor('response-spectrum'), dynamic).primaryResult;
assert.equal(spectrum.analysisType, 'response-spectrum');
assert.ok(spectrum.combined?.peakTranslationalDisplacement > 0, 'response-spectrum: resposta combinada ausente');
assert.ok(spectrum.modalContributions?.length > 0, 'response-spectrum: contribuições modais ausentes');

console.log('AstraStruct v0.49 VNL modes smoke: linear, P-Delta, corotational, modal, time-history and response-spectrum execute through the public VNL runtime.');
