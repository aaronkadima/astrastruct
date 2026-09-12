import fs from 'node:fs';
import path from 'node:path';

function assert(condition,message){if(!condition)throw new Error(message)}
function escapeRegExp(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

const root=path.resolve('dist');
const packagePath=path.resolve('package.json');
const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
const version=String(pkg.version||'').trim();
const configuredBase=String(process.env.ASTRA_BASE_PATH||'/astrastruct/');
const base=configuredBase.endsWith('/')?configuredBase:`${configuredBase}/`;
const indexPath=path.join(root,'index.html'),healthPath=path.join(root,'health.html');

assert(version,'Pages artifact: versão do package.json ausente.');
assert(fs.existsSync(indexPath),'Pages artifact: dist/index.html ausente.');
assert(fs.existsSync(healthPath),'Pages artifact: dist/health.html ausente.');

const html=fs.readFileSync(indexPath,'utf8'),health=fs.readFileSync(healthPath,'utf8');
assert(/Carregando AstraStruct/.test(html),'Pages artifact: fallback de bootstrap ausente.');
const bootstrapPatterns=[
  new RegExp(`BOOT_VERSION=['\"]${escapeRegExp(version)}['\"]`,'i'),
  new RegExp(`v${escapeRegExp(version)}(?:…|\.\.\.|<)`,'i'),
  new RegExp(`bootstrap\\s+${escapeRegExp(version)}`,'i')
];
assert(bootstrapPatterns.some(pattern=>pattern.test(html)),`Pages artifact: versão do bootstrap ${version} ausente.`);
assert(new RegExp(`health-${escapeRegExp(version)}`,'i').test(health),`Pages artifact: health.html não corresponde à versão ${version}.`);

const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(ref=>ref.includes('/assets/'));
assert(refs.length>=2,`Pages artifact: esperava referências JS/CSS, obtidas ${refs.length}.`);
for(const ref of refs){
  assert(ref.startsWith(`${base}assets/`),`Pages artifact: caminho fora da base ${base}: ${ref}`);
  const relative=ref.slice(base.length).split(/[?#]/)[0];
  const file=path.join(root,relative);
  assert(fs.existsSync(file),`Pages artifact: recurso referenciado não existe: ${relative}`);
  assert(fs.statSync(file).size>0,`Pages artifact: recurso vazio: ${relative}`);
}
const js=refs.filter(ref=>/\.js(?:$|[?#])/.test(ref)),css=refs.filter(ref=>/\.css(?:$|[?#])/.test(ref));
assert(js.length>=1,'Pages artifact: bundle JavaScript ausente.');
assert(css.length>=1,'Pages artifact: bundle CSS ausente.');
console.log('Pages artifact OK',{version,base,indexBytes:fs.statSync(indexPath).size,healthBytes:fs.statSync(healthPath).size,assets:refs});
