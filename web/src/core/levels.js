const EPS=1e-9;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const zOf=n=>finite(n?.z,0);

export function deriveLevels(project,{tolerance=1e-6}={}){
  const tol=Math.max(1e-9,Math.abs(finite(tolerance,1e-6))),declared=Array.isArray(project?.levels)?project.levels:[];
  if(declared.length){return declared.map((l,i)=>({id:String(l.id||`L${i}`),name:String(l.name||`Nível ${i}`),elevation:finite(l.elevation),index:Number.isFinite(Number(l.index))?Number(l.index):i})).sort((a,b)=>a.elevation-b.elevation).map((l,i)=>({...l,index:i}))}
  const zs=[];for(const n of project?.nodes||[]){const z=zOf(n);let group=zs.find(g=>Math.abs(g-z)<=tol);if(!group){group={sum:0,count:0};zs.push(group)}group.sum+=z;group.count++}
  return zs.map(g=>g.sum/g.count).sort((a,b)=>a-b).map((elevation,index)=>({id:`L${index}`,name:index===0?'Base':`Pavimento ${index}`,elevation,index}));
}

export function assignLevels(project,{tolerance=1e-5}={}){
  const p=clone(project),levels=deriveLevels(p,{tolerance}),tol=Math.max(1e-9,Math.abs(finite(tolerance,1e-5)));p.levels=levels;
  p.nodes=(p.nodes||[]).map(n=>{const z=zOf(n),level=levels.reduce((best,l)=>!best||Math.abs(l.elevation-z)<Math.abs(best.elevation-z)?l:best,null);return level&&Math.abs(level.elevation-z)<=tol?{...n,levelId:level.id}:{...n}});return p;
}

function uniqueId(base,used){let id=base,i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
function levelNodes(project,level,tol){return(project.nodes||[]).filter(n=>n.levelId===level.id||Math.abs(zOf(n)-level.elevation)<=tol)}
function verticalTemplate(project){return(project.elements||[]).find(e=>{if(e.type!=='frame3d')return false;const a=(project.nodes||[]).find(n=>n.id===e.n1),b=(project.nodes||[]).find(n=>n.id===e.n2);return a&&b&&Math.abs(zOf(a)-zOf(b))>1e-6})||(project.elements||[]).find(e=>e.type==='frame3d')||null}

export function duplicateLevel(project,{sourceLevelId=null,targetElevation=NaN,targetName=null,copyLoads=true,connectVertical=true,tolerance=1e-5}={}){
  const p=assignLevels(project,{tolerance}),levels=deriveLevels(p,{tolerance}),source=levels.find(l=>l.id===sourceLevelId);if(!source)throw new Error(`Pavimento de origem '${sourceLevelId}' não encontrado.`);
  const targetZ=finite(targetElevation,NaN);if(!Number.isFinite(targetZ))throw new Error('Elevação do novo pavimento deve ser numérica.');const tol=Math.max(1e-8,Math.abs(finite(tolerance,1e-5)));if(levels.some(l=>Math.abs(l.elevation-targetZ)<=tol))throw new Error('Já existe um nível nessa elevação.');
  const sourceNodes=levelNodes(p,source,tol);if(!sourceNodes.length)throw new Error('Pavimento de origem não possui nós.');const sourceIds=new Set(sourceNodes.map(n=>n.id)),usedNodes=new Set((p.nodes||[]).map(n=>n.id)),usedElems=new Set((p.elements||[]).map(e=>e.id)),targetId=uniqueId(`L${levels.length}`,new Set(levels.map(l=>l.id))),target={id:targetId,name:targetName||`Pavimento ${levels.length}`,elevation:targetZ,index:levels.length},nodeMap=new Map();
  for(const n of sourceNodes){const id=uniqueId(`${n.id}_${targetId}`,usedNodes);nodeMap.set(n.id,id);p.nodes.push({...clone(n),id,z:targetZ,levelId:targetId})}
  const horizontal=(p.elements||[]).filter(e=>sourceIds.has(e.n1)&&sourceIds.has(e.n2));const elementMap=new Map();for(const e of horizontal){const id=uniqueId(`${e.id}_${targetId}`,usedElems);elementMap.set(e.id,id);p.elements.push({...clone(e),id,n1:nodeMap.get(e.n1),n2:nodeMap.get(e.n2),label:`${e.label||e.id} · ${target.name}`})}
  if(connectVertical){const tpl=verticalTemplate(p);if(tpl){for(const n of sourceNodes){const id=uniqueId(`C_${n.id}_${targetId}`,usedElems);p.elements.push({...clone(tpl),id,n1:n.id,n2:nodeMap.get(n.id),label:`Pilar ${source.name} → ${target.name}`,releases:{rx1:false,ry1:false,rz1:false,rx2:false,ry2:false,rz2:false},rotationalSprings:{rx1:null,ry1:null,rz1:null,rx2:null,ry2:null,rz2:null}})}}}
  if(copyLoads){const newLoads=[];for(const l of p.loads||[]){if(!sourceIds.has(l.nodeId))continue;newLoads.push({...clone(l),id:uniqueId(`${l.id||'L'}_${targetId}`,new Set((p.loads||[]).concat(newLoads).map(x=>x.id))),nodeId:nodeMap.get(l.nodeId)})}p.loads.push(...newLoads);const newElementLoads=[];for(const l of p.elementLoads||[]){if(!elementMap.has(l.elementId))continue;newElementLoads.push({...clone(l),id:uniqueId(`${l.id||'EL'}_${targetId}`,new Set((p.elementLoads||[]).concat(newElementLoads).map(x=>x.id))),elementId:elementMap.get(l.elementId)})}p.elementLoads.push(...newElementLoads)}
  p.levels=[...levels,target].sort((a,b)=>a.elevation-b.elevation).map((l,index)=>({...l,index}));p.meta={...(p.meta||{}),levelsUpdatedAt:new Date().toISOString()};return assignLevels(p,{tolerance});
}

export function levelSummary(project,{tolerance=1e-5}={}){
  const p=assignLevels(project,{tolerance}),levels=deriveLevels(p,{tolerance});return levels.map(l=>{const nodes=(p.nodes||[]).filter(n=>n.levelId===l.id),ids=new Set(nodes.map(n=>n.id)),elements=(p.elements||[]).filter(e=>ids.has(e.n1)&&ids.has(e.n2));return{...l,nodeCount:nodes.length,horizontalElementCount:elements.length}});
}
