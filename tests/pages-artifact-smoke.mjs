import fs from 'node:fs';
import path from 'node:path';

function assert(condition,message){if(!condition)throw new Error(message)}
const root=path.resolve('dist');
const indexPath=path.join(root,'index.html'),healthPath=path.join(root,'health.html');
assert(fs.existsSync(indexPath),'Pages artifact: dist/index.html ausente.');
assert(fs.existsSync(healthPath),'Pages artifact: dist/health.html ausente.');
const html=fs.readFileSync(indexPath,'utf8'),health=fs.readFileSync(healthPath,'utf8');
assert(/Carregando AstraStruct/.test(html),'Pages artifact: fallback de bootstrap ausente.');
assert(/bootstrap 0\.13\.5/.test(html),'Pages artifact: versão do bootstrap 0.13.5 ausente.');
assert(/health-0\.13\.5/.test(health),'Pages artifact: health.html inesperado.');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(ref=>ref.includes('/assets/'));
assert(refs.length>=2,`Pages artifact: esperava referências JS/CSS, obtidas ${refs.length}.`);
for(const ref of refs){
  assert(ref.startsWith('/astrastruct/assets/'),`Pages artifact: caminho fora da base /astrastruct/: ${ref}`);
  const relative=ref.slice('/astrastruct/'.length).split(/[?#]/)[0];
  const file=path.join(root,relative);
  assert(fs.existsSync(file),`Pages artifact: recurso referenciado não existe: ${relative}`);
  assert(fs.statSync(file).size>0,`Pages artifact: recurso vazio: ${relative}`);
}
const js=refs.filter(ref=>/\.js(?:$|[?#])/.test(ref)),css=refs.filter(ref=>/\.css(?:$|[?#])/.test(ref));
assert(js.length>=1,'Pages artifact: bundle JavaScript ausente.');
assert(css.length>=1,'Pages artifact: bundle CSS ausente.');
console.log('Pages artifact OK',{indexBytes:fs.statSync(indexPath).size,healthBytes:fs.statSync(healthPath).size,assets:refs});
