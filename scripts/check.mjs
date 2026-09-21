import {readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1)}
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.isFile()&&e.name.endsWith('.js'))out.push(p)}return out}
run('npx',['tsc','-p','tsconfig.json','--noEmit']);
const files=(await walk(resolve('web/src'))).sort();
for(const file of files)run(process.execPath,['--check',file]);
run(process.execPath,['tests/visual-detail-foundation-v052-smoke.mjs']);
run(process.execPath,['tests/market-parity-v053-smoke.mjs']);
run(process.execPath,['tests/market-parity-advanced-v053-smoke.mjs']);
run(process.execPath,['tests/wind-durability-v0532-smoke.mjs']);
run(process.execPath,['tests/foundation-ssi-v0533-smoke.mjs']);
run(process.execPath,['tests/foundation-ssi-v0534-smoke.mjs']);
run(process.execPath,['tests/geotechnical-v0535-smoke.mjs']);
run(process.execPath,['tests/foundation-dashboard-v0536-smoke.mjs']);
run(process.execPath,['tests/elu-els-dashboard-v0537-smoke.mjs']);
run(process.execPath,['tests/combination-envelope-v0538-smoke.mjs']);
run(process.execPath,['tests/combination-visualization-v05310-smoke.mjs']);
run(process.execPath,['tests/combination-reactions-v05311-smoke.mjs']);
run(process.execPath,['tests/foundation-reaction-link-v05312-smoke.mjs']);
run(process.execPath,['tests/foundation-solid3d-smoke.mjs']);
run(process.execPath,['tests/rebar-cage-3d-smoke.mjs']);
run(process.execPath,['tests/rc-shear-sizing-smoke.mjs']);
run(process.execPath,['tests/rc-sizing-bar-pick-smoke.mjs']);
run(process.execPath,['tests/auto-rebar-cage-orchestrator-smoke.mjs']);
run(process.execPath,['tests/rebar-shape-drawing-smoke.mjs']);
run(process.execPath,['tests/building-launcher-config-smoke.mjs']);
run(process.execPath,['tests/building-launcher-analysis-smoke.mjs']);
run(process.execPath,['tests/frame-diagram3d-smoke.mjs']);
console.log(`AstraStruct check: TypeScript + ${files.length} módulos JS validados + gates funcionais v0.52, v0.53.0–v0.53.12 + fundações sólidas, dimensionamento RC e armaduras 3D/2D.`);
