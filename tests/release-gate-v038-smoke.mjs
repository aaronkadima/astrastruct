import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {SECTION_ENGINE_CONTRACT} from '../web/src/sections/index.js';
import {MESH_ENGINE_CONTRACT} from '../web/src/mesh/index.js';
import {ADVANCED_ELEMENT_LIBRARY_CONTRACT,ADVANCED_ELEMENT_LIBRARY_VERSION} from '../web/src/elements/index.js';
import {NONLINEAR_RC_CONTRACT,NONLINEAR_RC_VERSION} from '../web/src/rc/index.js';
import {
  ADVANCED_SHELL_CONTACT_CONTRACT,ADVANCED_SHELL_CONTACT_VERSION,SHELL_CONCRETE_PLANE_STRESS_CONTRACT,
  LAYERED_SHELL_SECTION_CONTRACT,NONLINEAR_SHELL4_COMPONENT_CONTRACT,CONTACT_PAIR_CONTRACT,
  NODE_SURFACE_CONTACT_CONTRACT,registerAdvancedShellContactComponents
} from '../web/src/shellContact/index.js';
import {hasElementComponentFactory,getElementDefinition} from '../web/src/core/elementRegistry.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.38.0','package.json deve declarar v0.38.0');
assert.equal(PRODUCT_VERSION,'0.38.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.38 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.38 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1');
assert.equal(SECTION_ENGINE_CONTRACT,'section-engine/v1');
assert.equal(MESH_ENGINE_CONTRACT,'mesh-surface/v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_CONTRACT,'advanced-element-library/v1');
assert.equal(ADVANCED_ELEMENT_LIBRARY_VERSION,'0.36.0-exp');
assert.equal(NONLINEAR_RC_CONTRACT,'nonlinear-rc/v1');
assert.equal(NONLINEAR_RC_VERSION,'0.37.0-exp');
assert.equal(ADVANCED_SHELL_CONTACT_CONTRACT,'advanced-shell-contact/v1');
assert.equal(ADVANCED_SHELL_CONTACT_VERSION,'0.38.0-exp');
assert.equal(SHELL_CONCRETE_PLANE_STRESS_CONTRACT,'shell-concrete-plane-stress/v1');
assert.equal(LAYERED_SHELL_SECTION_CONTRACT,'layered-shell-section/v1');
assert.equal(NONLINEAR_SHELL4_COMPONENT_CONTRACT,'nonlinear-shell4-component/v1');
assert.equal(CONTACT_PAIR_CONTRACT,'contact-pair/v1');
assert.equal(NODE_SURFACE_CONTACT_CONTRACT,'node-surface-contact/v1');

const types=registerAdvancedShellContactComponents();
for(const type of ['shell4-nonlinear','contact2d','contact3d','contact-node-segment2d','contact-node-triangle3d']){assert.ok(types.includes(type));assert.equal(hasElementComponentFactory(type),true,`${type} deve ter Component factory`)}
assert.equal(getElementDefinition('shell4-nonlinear').capabilities.materialNonlinear,true);
assert.equal(getElementDefinition('contact-node-segment2d').capabilities.nodeToSurface,true);
assert.equal(getElementDefinition('contact-node-triangle3d').capabilities.nodeToSurface,true);

const mandatory=[
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
  'tests/release-gate-v038-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v037-smoke.mjs'),'gate histórico v0.37 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v039'),'nenhum teste da v0.39 pode ser antecipado no gate v0.38');

const docs=await readFile(new URL('../docs/advanced-shell-contact-v038.md',import.meta.url),'utf8');
for(const phrase of ['advanced-shell-contact/v1','fissura fixa','shear retention','aggregate interlock','nó–segmento','nó–triângulo','Coulomb','commit/rollback','v0.39 — Connections & Anchors 2'])assert.ok(docs.includes(phrase),`documentação v0.38 incompleta: ${phrase}`);

console.log('AstraStruct v0.38 release gate: nonlinear shell, RC layers, general contact 2D/3D e regressões anteriores coerentes.');
