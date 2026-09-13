import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.32.0','package.json deve declarar v0.32.0');
assert.equal(PRODUCT_VERSION,'0.32.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.32 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.32 não altera structural-result/v1');

const mandatory=[
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v032-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v0312-smoke.mjs'),'gate histórico v0.31.2 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

console.log('AstraStruct v0.32 release gate: versão, contratos, Numerical Core 2 e regressões P2/P3/P4 coerentes.');
