import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION, RESULT_CONTRACT_VERSION } from '../web/src/core/version.js';
import {
  VNL_CONTRACT,
  VNL_VERSION,
  VNL_EXECUTION_CONTRACT,
  VNL_PROJECT_CONTRACT,
  VNL_BLOCKS,
} from '../web/src/vnl/index.js';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.version, '0.49.0', 'package.json deve declarar v0.49.0');
assert.equal(PRODUCT_VERSION, '0.49.0', 'PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION, 2, 'v0.49 mantém o schema persistido v2');
assert.equal(RESULT_CONTRACT_VERSION, '1.0', 'v0.49 mantém structural-result/v1');

assert.equal(VNL_CONTRACT, 'visual-nonlinear-language/v2');
assert.equal(VNL_VERSION, '0.49.0-exp');
assert.equal(VNL_EXECUTION_CONTRACT, 'vnl-execution/v1');
assert.equal(VNL_PROJECT_CONTRACT, 'project-vnl/v1');
for (const block of [
  'Geometry','Mesh','Material','Section','Reinforcement','Boundary','Connection','Load','Combination',
  'Material Nonlinearity','Geometric Nonlinearity','Increment','Convergence','Contact','Solver','Result','Plot','Export',
]) assert.ok(VNL_BLOCKS.includes(block), `bloco VNL obrigatório ausente: ${block}`);

assert.ok(
  pkg.scripts.test.startsWith('node tests/release-gate-v049-smoke.mjs && node tests/vnl-runtime-v049-smoke.mjs && node tests/vnl-modes-v049-smoke.mjs'),
  'test chain deve iniciar pelo release gate, runtime e modos VNL v0.49',
);
for (const mandatory of [
  'tests/ifc-load-import-v048-smoke.mjs',
  'tests/ifc-load-parse-v048-smoke.mjs',
  'tests/ifc-step-loads-v048-smoke.mjs',
  'tests/ifc-load-mapping-v048-smoke.mjs',
  'tests/ifc-material-strength-v047-smoke.mjs',
  'tests/ifc-import-staging-v046-smoke.mjs',
  'tests/ifc-interop-v045-smoke.mjs',
  'tests/detailing-report-v044-smoke.mjs',
  'tests/code-design-v043-smoke.mjs',
  'tests/design-actions-combinations-v042-smoke.mjs',
  'tests/nonlinear-dynamics-v041-smoke.mjs',
  'tests/load-stage-engine-v040-smoke.mjs',
  'tests/connections-anchors-v039-smoke.mjs',
  'tests/advanced-shell-contact-v038-smoke.mjs',
  'tests/nonlinear-rc-v037-smoke.mjs',
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
]) assert.ok(pkg.scripts.test.includes(mandatory), `gate histórico obrigatório ausente: ${mandatory}`);
assert.ok(!pkg.scripts.test.includes('tests/development-gate-v049-smoke.mjs'), 'development gate v0.49 não deve permanecer ativo após o fechamento');
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v048-smoke.mjs'), 'release gate v0.48 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'), 'descoberta automática de testes continua proibida');

const docs = await readFile(new URL('../docs/vnl-complete-v049.md', import.meta.url), 'utf8');
for (const phrase of [
  'A v0.49 está formalmente fechada no branch `develop`',
  'PRODUCT_VERSION = 0.49.0',
  'visual-nonlinear-language/v2',
  'analysis-config/v1',
  'executeVnlGraph()',
  'Linear, P-Delta, co-rotacional, modal, time-history e response-spectrum',
  'branching',
  'editor React',
  'desktop, Android e tablet',
  'IfcOpenShell',
  'v0.50 — Reliability + Optimization',
  'v0.51+',
  'Nenhuma promoção para `main`',
]) assert.ok(docs.includes(phrase), `documentação v0.49 incompleta: ${phrase}`);

console.log('AstraStruct v0.49 release gate: complete typed VNL, solver reuse, branching, persistence, React workbench and cross-viewport regression coherent.');
