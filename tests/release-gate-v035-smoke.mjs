import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {SECTION_ENGINE_CONTRACT} from '../web/src/sections/index.js';
import {MESH_ENGINE_CONTRACT,MESH_SURFACE_ENGINE_VERSION} from '../web/src/mesh/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.35.0','package.json deve declarar v0.35.0');
assert.equal(PRODUCT_VERSION,'0.35.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.35 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.35 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1','v0.35 preserva Component/Element API v1');
assert.equal(SECTION_ENGINE_CONTRACT,'section-engine/v1','v0.35 preserva Section Engine v1');
assert.equal(MESH_ENGINE_CONTRACT,'mesh-surface/v1','Mesh & Surface Engine deve declarar mesh-surface/v1');
assert.equal(MESH_SURFACE_ENGINE_VERSION,'0.35.0-exp','implementação Mesh & Surface Engine deve corresponder à v0.35');

const mandatory=[
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v035-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v034-smoke.mjs'),'gate histórico v0.34 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

const docs=await readFile(new URL('../docs/mesh-surface-engine-v035.md',import.meta.url),'utf8');
for(const phrase of ['surface-mesh/v1','tri3','quad4','refinamento conforme','θ × r','v0.36 — Advanced Element Library'])assert.ok(docs.includes(phrase),`documentação v0.35 incompleta: ${phrase}`);

console.log('AstraStruct v0.35 release gate: Mesh & Surface Engine, Section Engine, Component API, Numerical Core 2 e regressões P2/P3/P4 coerentes.');
