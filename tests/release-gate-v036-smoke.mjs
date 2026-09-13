import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {SECTION_ENGINE_CONTRACT} from '../web/src/sections/index.js';
import {MESH_ENGINE_CONTRACT} from '../web/src/mesh/index.js';
import {ADVANCED_ELEMENT_LIBRARY_CONTRACT,ADVANCED_ELEMENT_LIBRARY_VERSION} from '../web/src/elements/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.36.0','package.json deve declarar v0.36.0');
assert.equal(PRODUCT_VERSION,'0.36.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.36 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.36 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1','v0.36 preserva Component/Element API v1');
assert.equal(SECTION_ENGINE_CONTRACT,'section-engine/v1','v0.36 preserva Section Engine v1');
assert.equal(MESH_ENGINE_CONTRACT,'mesh-surface/v1','v0.36 preserva Mesh & Surface Engine v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_CONTRACT,'advanced-element-library/v1','biblioteca avançada deve declarar seu contrato v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_VERSION,'0.36.0-exp','versão interna da biblioteca avançada deve ser v0.36.0-exp');

const mandatory=[
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v036-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v035-smoke.mjs'),'gate histórico v0.35 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

const docs=await readFile(new URL('../docs/advanced-element-library-v036.md',import.meta.url),'utf8');
for(const phrase of ['Timoshenko','cable','commit/rollback','rigid zones','advanced-element-library/v1','v0.37 — Nonlinear RC'])assert.ok(docs.includes(phrase),`documentação v0.36 incompleta: ${phrase}`);

console.log('AstraStruct v0.36 release gate: advanced elements, Mesh, Section, Component API, Numerical Core 2 e regressões P2/P3/P4 coerentes.');
