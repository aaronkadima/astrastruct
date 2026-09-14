const clone=value=>JSON.parse(JSON.stringify(value));
function parts(path){return Array.isArray(path)?path:String(path||'').split('.').filter(Boolean);}
function locate(root,path){const p=parts(path);if(!p.length)throw new Error('Target sem caminho de propriedade.');let obj=root;for(let i=0;i<p.length-1;i++){if(obj==null||!(p[i] in obj))throw new Error(`Caminho inexistente: ${p.slice(0,i+1).join('.')}`);obj=obj[p[i]];}return{obj,key:p.at(-1)};}
function targetRoot(project,target){
  if(target?.kind==='entity'){
    const collection=project?.[target.collection];if(!Array.isArray(collection))throw new Error(`Coleção inexistente: ${target.collection}.`);
    const entity=collection.find(item=>String(item?.id)===String(target.id));if(!entity)throw new Error(`Entidade não encontrada: ${target.collection}.${target.id}.`);return{root:entity,path:target.property||target.path};
  }
  if(target?.kind==='path')return{root:project,path:target.path};
  throw new Error('Target deve declarar kind="entity" ou kind="path".');
}
export function getTargetValue(project,target){const{root,path}=targetRoot(project,target),{obj,key}=locate(root,path),value=obj[key];if(!Number.isFinite(Number(value)))throw new Error(`Target ${String(path)} não contém valor numérico finito.`);return Number(value);}
export function setTargetValue(project,target,value){if(!Number.isFinite(Number(value)))throw new Error('Valor de target deve ser numérico e finito.');const{root,path}=targetRoot(project,target),{obj,key}=locate(root,path);obj[key]=Number(value);return project;}
export function applyTargetValues(project,assignments){const next=clone(project);for(const assignment of assignments)setTargetValue(next,assignment.target,assignment.value);return next;}
export function cloneProject(project){return clone(project);}
