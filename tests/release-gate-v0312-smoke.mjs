import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

assert.equal(pkg.version,'0.31.2','package.json deve declarar a versão consolidada v0.31.2');
assert.equal(PRODUCT_VERSION,'0.31.2','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.31.2 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.31.2 não altera o contrato structural-result/v1');

const mandatory=[
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v0312-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'o gate principal não pode voltar ao runner de descoberta automática');

console.log('AstraStruct v0.31.2 release gate: versão, contratos e cobertura P2/P3/P4 coerentes.');
