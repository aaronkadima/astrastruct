import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {IFC_SCHEMA,IFC_STANDARD,IFC_LOAD_EXCHANGE_CONTRACT,IFC_LOAD_EXCHANGE_VERSION,IFC_STEP_LOAD_CONTRACT,IFC_STEP_LOAD_VERSION,IFC_STEP_LOAD_PARSE_CONTRACT,IFC_STEP_LOAD_PARSE_VERSION,IFC_STEP_WRITER_VERSION,IFC_EXCHANGE_VERSION,IFC_MATERIAL_STRENGTH_VERSION,IFC_IMPORT_STAGING_VERSION} from '../web/src/interop/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.47.0','v0.48 permanece experimental: package.json deve ficar em v0.47.0 até o gate final');
assert.equal(PRODUCT_VERSION,'0.47.0','PRODUCT_VERSION só muda no fechamento formal da v0.48');
assert.equal(PROJECT_SCHEMA_VERSION,2);assert.equal(RESULT_CONTRACT_VERSION,'1.0');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(IFC_LOAD_EXCHANGE_CONTRACT,'ifc-structural-loads/v1');assert.equal(IFC_LOAD_EXCHANGE_VERSION,'0.48.0-exp');
assert.equal(IFC_STEP_LOAD_CONTRACT,'ifc-step-loads/v1');assert.equal(IFC_STEP_LOAD_VERSION,'0.48.0-exp');assert.equal(IFC_STEP_LOAD_PARSE_CONTRACT,'ifc-step-load-parse/v1');assert.equal(IFC_STEP_LOAD_PARSE_VERSION,'0.48.0-exp');assert.equal(IFC_STEP_WRITER_VERSION,'0.48.0-exp');assert.equal(IFC_EXCHANGE_VERSION,'0.48.0-exp');
assert.equal(IFC_MATERIAL_STRENGTH_VERSION,'0.47.0-exp');assert.equal(IFC_IMPORT_STAGING_VERSION,'0.47.0-exp');

for(const test of ['tests/development-gate-v048-smoke.mjs','tests/ifc-load-parse-v048-smoke.mjs','tests/ifc-step-loads-v048-smoke.mjs','tests/ifc-load-mapping-v048-smoke.mjs','tests/ifc-material-strength-v047-smoke.mjs','tests/ifc-import-staging-v046-smoke.mjs'])assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v047-smoke.mjs'),'release gate histórico não deve ser o gate frontal da v0.48 experimental');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida');

const docs=await readFile(new URL('../docs/ifc-loads-v048.md',import.meta.url),'utf8');
for(const phrase of ['IfcStructuralLoadCase','GLOBAL_COORDS','LOCAL_COORDS','IfcStructuralLinearAction','IfcRelAssignsToGroupByFactor','IfcRelConnectsStructuralActivity','LoadedBy','loadGlobalIds','ifc-step-load-parse/v1','Nenhuma promoção para `main`'])assert.ok(docs.includes(phrase),`documentação v0.48 incompleta: ${phrase}`);

console.log('AstraStruct v0.48 development gate: canonical, STEP and parser IFC load exchange active while product remains formally v0.47.0.');
