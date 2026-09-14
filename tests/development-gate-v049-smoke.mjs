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
assert.equal(pkg.version, '0.48.0', 'produto permanece 0.48.0 durante o gate experimental v0.49');
assert.equal(PRODUCT_VERSION, '0.48.0', 'PRODUCT_VERSION não sobe antes do release gate v0.49');
assert.equal(PROJECT_SCHEMA_VERSION, 2, 'campo project.vnl é extensão aditiva no gate experimental');
assert.equal(RESULT_CONTRACT_VERSION, '1.0');

assert.equal(VNL_CONTRACT, 'visual-nonlinear-language/v2');
assert.equal(VNL_VERSION, '0.49.0-exp');
assert.equal(VNL_EXECUTION_CONTRACT, 'vnl-execution/v1');
assert.equal(VNL_PROJECT_CONTRACT, 'project-vnl/v1');
for (const block of ['Geometry','Material','Section','Boundary','Load','Combination','Material Nonlinearity','Geometric Nonlinearity','Increment','Convergence','Contact','Solver','Result','Plot','Export']) {
  assert.ok(VNL_BLOCKS.includes(block), `bloco VNL obrigatório ausente: ${block}`);
}

assert.ok(pkg.scripts.test.startsWith('node tests/development-gate-v049-smoke.mjs && node tests/vnl-runtime-v049-smoke.mjs'), 'test chain deve iniciar pelo gate e smoke VNL v0.49');
assert.ok(pkg.scripts.test.includes('tests/release-gate-v048-smoke.mjs'), 'release gate v0.48 permanece durante desenvolvimento v0.49');
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v049-smoke.mjs'), 'release gate v0.49 não deve existir antes do fechamento');

const docs = await readFile(new URL('../docs/vnl-complete-v049.md', import.meta.url), 'utf8');
for (const phrase of [
  'v0.49 = VNL completa',
  'visual-nonlinear-language/v2',
  'analysis-config/v1',
  'executeVnlGraph()',
  'branching',
  'editor React',
  'v0.50 — Reliability + Optimization',
  'v0.51+',
  '`main` permanece estável e intocada',
]) assert.ok(docs.includes(phrase), `documentação v0.49 incompleta: ${phrase}`);

console.log('AstraStruct v0.49 development gate: roadmap locked to complete VNL before reliability/optimization and AI automation.');
