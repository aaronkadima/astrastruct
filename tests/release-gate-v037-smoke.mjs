import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {SECTION_ENGINE_CONTRACT} from '../web/src/sections/index.js';
import {MESH_ENGINE_CONTRACT} from '../web/src/mesh/index.js';
import {ADVANCED_ELEMENT_LIBRARY_CONTRACT,ADVANCED_ELEMENT_LIBRARY_VERSION} from '../web/src/elements/index.js';
import {
  NONLINEAR_RC_CONTRACT,NONLINEAR_RC_VERSION,RC_CONCRETE_1D_CONTRACT,RC_REBAR_1D_CONTRACT,
  RC_BOND_SLIP_1D_CONTRACT,RC_BOND_LINK_CONTRACT,RC_SECTION_RESPONSE_CONTRACT
} from '../web/src/rc/index.js';
import {registerBuiltInElementComponents} from '../web/src/core/builtInElementComponents.js';
import {getElementDefinition,hasElementComponentFactory} from '../web/src/core/elementRegistry.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.37.0','package.json deve declarar v0.37.0');
assert.equal(PRODUCT_VERSION,'0.37.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.37 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.37 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1','v0.37 preserva Component/Element API v1');
assert.equal(SECTION_ENGINE_CONTRACT,'section-engine/v1','v0.37 preserva Section Engine v1');
assert.equal(MESH_ENGINE_CONTRACT,'mesh-surface/v1','v0.37 preserva Mesh & Surface Engine v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_CONTRACT,'advanced-element-library/v1','v0.37 preserva Advanced Element Library v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_VERSION,'0.36.0-exp','v0.37 não reversiona a biblioteca avançada');
assert.equal(NONLINEAR_RC_CONTRACT,'nonlinear-rc/v1');
assert.equal(NONLINEAR_RC_VERSION,'0.37.0-exp');
assert.equal(RC_CONCRETE_1D_CONTRACT,'rc-concrete-1d/v1');
assert.equal(RC_REBAR_1D_CONTRACT,'rc-rebar-1d/v1');
assert.equal(RC_BOND_SLIP_1D_CONTRACT,'rc-bond-slip-1d/v1');
assert.equal(RC_BOND_LINK_CONTRACT,'rc-bond-link/v1');
assert.equal(RC_SECTION_RESPONSE_CONTRACT,'rc-section-response/v1');

const registered=registerBuiltInElementComponents();
assert.ok(registered.includes('bond-slip-link'),'bond-slip-link deve ser registrado pelo bootstrap de componentes');
assert.equal(hasElementComponentFactory('bond-slip-link'),true,'bond-slip-link deve possuir Component factory');
const bondDefinition=getElementDefinition('bond-slip-link');
assert.equal(bondDefinition?.category,'connection');
assert.equal(bondDefinition?.capabilities?.bondSlip,true);
assert.equal(bondDefinition?.capabilities?.commitRollback,true);

const mandatory=[
  'tests/nonlinear-rc-v037-smoke.mjs',
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v037-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v036-smoke.mjs'),'gate histórico v0.36 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v038'),'nenhum teste da v0.38 pode ser antecipado no gate v0.37');

const docs=await readFile(new URL('../docs/nonlinear-rc-v037.md',import.meta.url),'utf8');
for(const phrase of ['nonlinear-rc/v1','crack-band','fechamento unilateral','bond-slip','N–My–Mz','commit/rollback','v0.38 — Advanced shells/contact'])assert.ok(docs.includes(phrase),`documentação v0.37 incompleta: ${phrase}`);

console.log('AstraStruct v0.37 release gate: Nonlinear RC + Advanced Elements + Mesh + Section + Component API + Numerical Core 2 + regressões P2/P3/P4 coerentes.');
