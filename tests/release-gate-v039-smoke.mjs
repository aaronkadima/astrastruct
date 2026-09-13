import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {ADVANCED_SHELL_CONTACT_CONTRACT,ADVANCED_SHELL_CONTACT_VERSION} from '../web/src/shellContact/index.js';
import {NONLINEAR_RC_CONTRACT,NONLINEAR_RC_VERSION} from '../web/src/rc/index.js';
import {
  CONNECTIONS_ANCHORS_CONTRACT,CONNECTIONS_ANCHORS_VERSION,CONNECTION_OBJECT_CONTRACT,CONNECTION_COUPLING_CONTRACT,
  CONNECTION_COMPONENT_CONTRACT,ANCHOR_GROUP_3D_CONTRACT,registerConnectionComponents
} from '../web/src/connections/index.js';
import {hasElementComponentFactory,getElementDefinition} from '../web/src/core/elementRegistry.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.39.0','package.json deve declarar v0.39.0');
assert.equal(PRODUCT_VERSION,'0.39.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.39 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.39 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1');
assert.equal(ADVANCED_SHELL_CONTACT_CONTRACT,'advanced-shell-contact/v1');
assert.equal(ADVANCED_SHELL_CONTACT_VERSION,'0.38.0-exp');
assert.equal(NONLINEAR_RC_CONTRACT,'nonlinear-rc/v1');
assert.equal(NONLINEAR_RC_VERSION,'0.37.0-exp');
assert.equal(CONNECTIONS_ANCHORS_CONTRACT,'connections-anchors/v1');
assert.equal(CONNECTIONS_ANCHORS_VERSION,'0.39.0-exp');
assert.equal(CONNECTION_OBJECT_CONTRACT,'connection-object/v1');
assert.equal(CONNECTION_COUPLING_CONTRACT,'connection-local-global/v1');
assert.equal(CONNECTION_COMPONENT_CONTRACT,'connection-component/v1');
assert.equal(ANCHOR_GROUP_3D_CONTRACT,'anchor-group-3d/v1');

const types=registerConnectionComponents();
for(const type of ['connection3d','anchor-group-3d']){assert.ok(types.includes(type));assert.equal(hasElementComponentFactory(type),true,`${type} deve ter Component factory`)}
assert.equal(getElementDefinition('connection3d').capabilities.localGlobalCoupling,true);
assert.equal(getElementDefinition('anchor-group-3d').capabilities.anchorInteraction,true);

const mandatory=[
  'tests/connections-anchors-v039-smoke.mjs',
  'tests/advanced-shell-contact-v038-smoke.mjs',
  'tests/node-surface-contact-v038-smoke.mjs',
  'tests/nonlinear-rc-v037-smoke.mjs',
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v039-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v038-smoke.mjs'),'gate histórico v0.38 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v040'),'nenhum teste da v0.40 pode ser antecipado no gate v0.39');

const docs=await readFile(new URL('../docs/connections-anchors-v039.md',import.meta.url),'utf8');
for(const phrase of ['connections-anchors/v1','q = B u','B^T K_local B','stick → slip → bearing','anchor-group-3d/v1','commit/rollback','v0.40 — Load/Stage Engine'])assert.ok(docs.includes(phrase),`documentação v0.39 incompleta: ${phrase}`);

console.log('AstraStruct v0.39 release gate: connection objects, local-global coupling, anchor groups and prior regressions coherent.');
