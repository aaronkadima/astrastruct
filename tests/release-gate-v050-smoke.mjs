import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {VNL_CONTRACT,VNL_VERSION} from '../web/src/vnl/index.js';
import {
  RELIABILITY_CONTRACT,RELIABILITY_VERSION,OPTIMIZATION_CONTRACT,OPTIMIZATION_VERSION,
  MULTIOBJECTIVE_OPTIMIZATION_CONTRACT,MULTIOBJECTIVE_OPTIMIZATION_VERSION,
  RELIABILITY_STUDY_CONTRACT,RELIABILITY_STUDY_VERSION,RELIABILITY_METHODS,
  OPTIMIZATION_STUDY_CONTRACT,OPTIMIZATION_STUDY_VERSION,
} from '../web/src/reliability/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.50.0','package.json deve declarar v0.50.0');
assert.equal(PRODUCT_VERSION,'0.50.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.50 mantém schema persistido v2');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.50 mantém structural-result/v1');
assert.equal(VNL_CONTRACT,'visual-nonlinear-language/v2');assert.equal(VNL_VERSION,'0.49.0-exp');
assert.equal(RELIABILITY_CONTRACT,'structural-reliability/v1');assert.equal(RELIABILITY_VERSION,'0.50.0-exp');
assert.equal(OPTIMIZATION_CONTRACT,'structural-optimization/v1');assert.equal(OPTIMIZATION_VERSION,'0.50.0-exp');
assert.equal(MULTIOBJECTIVE_OPTIMIZATION_CONTRACT,'structural-multiobjective-optimization/v1');assert.equal(MULTIOBJECTIVE_OPTIMIZATION_VERSION,'0.50.0-exp');
assert.equal(RELIABILITY_STUDY_CONTRACT,'project-reliability-study/v1');assert.equal(RELIABILITY_STUDY_VERSION,'0.50.0-exp');
assert.equal(OPTIMIZATION_STUDY_CONTRACT,'project-optimization-study/v1');assert.equal(OPTIMIZATION_STUDY_VERSION,'0.50.0-exp');
for(const method of ['monte-carlo','latin-hypercube','mvfosm','form','system-monte-carlo','importance-sampling'])assert.ok(RELIABILITY_METHODS.includes(method),`método v0.50 ausente: ${method}`);
const prefix='node tests/release-gate-v050-smoke.mjs && node tests/reliability-optimization-v050-smoke.mjs && node tests/reliability-system-v050-smoke.mjs && node tests/reliability-lhs-v050-smoke.mjs && node tests/reliability-study-v050-smoke.mjs && node tests/optimization-study-v050-smoke.mjs && node tests/optimization-advanced-v050-smoke.mjs && node tests/vnl-runtime-v049-smoke.mjs && node tests/vnl-modes-v049-smoke.mjs';
assert.ok(pkg.scripts.test.startsWith(prefix),'test chain deve iniciar pelo release gate e todos os smokes v0.50 antes das regressões VNL');
assert.ok(!pkg.scripts.test.includes('tests/development-gate-v050-smoke.mjs'),'development gate v0.50 não deve permanecer ativo após fechamento');
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v049-smoke.mjs'),'release gate v0.49 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática de testes continua proibida');
for(const mandatory of ['tests/ifc-load-import-v048-smoke.mjs','tests/ifc-material-strength-v047-smoke.mjs','tests/ifc-import-staging-v046-smoke.mjs','tests/ifc-interop-v045-smoke.mjs','tests/detailing-report-v044-smoke.mjs','tests/code-design-v043-smoke.mjs','tests/design-actions-combinations-v042-smoke.mjs','tests/nonlinear-dynamics-v041-smoke.mjs','tests/load-stage-engine-v040-smoke.mjs','tests/connections-anchors-v039-smoke.mjs','tests/advanced-shell-contact-v038-smoke.mjs','tests/nonlinear-rc-v037-smoke.mjs','tests/advanced-element-library-v036-smoke.mjs','tests/mesh-surface-engine-v035-smoke.mjs','tests/section-engine-v034-smoke.mjs','tests/component-element-api-v033-smoke.mjs','tests/numerical-core-v032-smoke.mjs'])assert.ok(pkg.scripts.test.includes(mandatory),`gate histórico obrigatório ausente: ${mandatory}`);
const docs=await readFile(new URL('../docs/reliability-optimization-v050.md',import.meta.url),'utf8');
for(const phrase of ['A v0.50 está formalmente fechada no branch `develop`','PRODUCT_VERSION = 0.50.0','Monte Carlo','Latin Hypercube','MVFOSM','FORM / HL-RF','Confiabilidade de sistema','Importance sampling','RBDO','Pareto','project-reliability-study/v1','project-optimization-study/v1','desktop, Android e tablet','v0.51+ — IA/Automation/Digital Engineering','Nenhuma promoção para `main`'])assert.ok(docs.includes(phrase),`documentação v0.50 incompleta: ${phrase}`);
console.log('AstraStruct v0.50 release gate: reliability, rare-event/system methods, persisted workbenches, deterministic/RBDO/Pareto optimization and historical regression chain coherent.');
