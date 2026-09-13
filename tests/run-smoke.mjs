import {readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {spawn} from 'node:child_process';

const root=resolve('tests');
const EXCLUDED=new Set(['pages-artifact-smoke.mjs']);
const TEST_TIMEOUT_MS=120_000;
const files=(await readdir(root,{withFileTypes:true}))
  .filter(e=>e.isFile()&&e.name.endsWith('-smoke.mjs')&&!EXCLUDED.has(e.name))
  .map(e=>e.name).sort();
if(!files.length)throw new Error('AstraStruct smoke runner: nenhum teste encontrado.');

function runFile(path,name){
  return new Promise((resolveRun,rejectRun)=>{
    const child=spawn(process.execPath,[path],{stdio:'inherit',env:process.env});
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      child.kill('SIGKILL');
      rejectRun(new Error(`AstraStruct smoke runner: timeout de ${TEST_TIMEOUT_MS/1000}s em ${name}.`));
    },TEST_TIMEOUT_MS);
    child.on('error',error=>{
      if(settled)return;
      settled=true;clearTimeout(timer);rejectRun(error);
    });
    child.on('exit',(code,signal)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(code===0)resolveRun();
      else rejectRun(new Error(`AstraStruct smoke runner: ${name} falhou (code=${code}, signal=${signal||'none'}).`));
    });
  });
}

for(const name of files){
  const path=resolve(root,name);
  process.stdout.write(`\n[smoke] ${relative(process.cwd(),path)}\n`);
  await runFile(path,name);
}
console.log(`\nAstraStruct smoke runner: ${files.length} arquivos executados em processos isolados.`);
