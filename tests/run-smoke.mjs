import {readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve('tests');
const files=(await readdir(root,{withFileTypes:true})).filter(e=>e.isFile()&&e.name.endsWith('-smoke.mjs')).map(e=>e.name).sort();
if(!files.length)throw new Error('AstraStruct smoke runner: nenhum teste encontrado.');
for(const name of files){
  const path=resolve(root,name);
  process.stdout.write(`\n[smoke] ${relative(process.cwd(),path)}\n`);
  await import(`${pathToFileURL(path).href}?run=${Date.now()}`);
}
console.log(`\nAstraStruct smoke runner: ${files.length} arquivos executados.`);
