const EPS=1e-12;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const p3=n=>[finite(n?.x),finite(n?.y),finite(n?.z)];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const triArea=(a,b,c)=>.5*norm(cross(sub(b,a),sub(c,a)));
const quadArea=pts=>triArea(pts[0],pts[1],pts[2])+triArea(pts[0],pts[2],pts[3]);
const shellIds=e=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);
function uniqueId(base,used){let id=String(base),i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
function blend(points,u,v){const N=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v],out=[0,0,0];for(let i=0;i<4;i++)for(let k=0;k<3;k++)out[k]+=N[i]*points[i][k];return out}
function key3(p,tol){return p.map(v=>Math.round(v/tol)).join('|')}
function neighborKeys(p,tol){const q=p.map(v=>Math.round(v/tol)),out=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)out.push(`${q[0]+i}|${q[1]+j}|${q[2]+k}`);return out}

export function refineShell4Mesh(project,{elementIds=null,levelId=null,divisionsX=2,divisionsY=2,tolerance=1e-7,maxDivisions=20}={}){
  const p=clone(project),nx=Math.max(1,Math.min(maxDivisions,Math.round(finite(divisionsX,2)))),ny=Math.max(1,Math.min(maxDivisions,Math.round(finite(divisionsY,2)))),tol=Math.max(1e-10,Math.abs(finite(tolerance,1e-7)));if(nx===1&&ny===1)throw new Error('Refinamento shell4: use pelo menos 2 divisões em uma direção.');
  const selectedIds=Array.isArray(elementIds)&&elementIds.length?new Set(elementIds.map(String)):null,nodeById=new Map((p.nodes||[]).map(n=>[String(n.id),n]));
  const selected=(p.elements||[]).filter(e=>{if(e.type!=='shell4')return false;if(selectedIds&&!selectedIds.has(String(e.id)))return false;if(levelId!=null){const ids=shellIds(e),first=nodeById.get(String(ids[0]));return String(e.levelId??first?.levelId??'')===String(levelId)}return true});
  if(!selected.length)throw new Error('Refinamento shell4: nenhum elemento selecionado.');
  const selectedSet=new Set(selected.map(e=>String(e.id))),usedNodes=new Set((p.nodes||[]).map(n=>String(n.id))),usedElements=new Set((p.elements||[]).map(e=>String(e.id))),usedLoads=new Set((p.elementLoads||[]).map(l=>String(l.id))),spatial=new Map();
  const indexNode=n=>{const q=p3(n),key=key3(q,tol);if(!spatial.has(key))spatial.set(key,[]);spatial.get(key).push(n)};(p.nodes||[]).forEach(indexNode);
  const findNode=q=>{for(const key of neighborKeys(q,tol))for(const n of spatial.get(key)||[]){const r=p3(n);if(Math.max(Math.abs(r[0]-q[0]),Math.abs(r[1]-q[1]),Math.abs(r[2]-q[2]))<=tol)return n}return null};
  const addNode=(q,base,level)=>{const existing=findNode(q);if(existing)return{node:existing,created:false};const id=uniqueId(base,usedNodes),node={id,x:q[0],y:q[1],z:q[2],...(level!=null?{levelId:level}:{})};p.nodes.push(node);indexNode(node);return{node,created:true}};
  const childElements=[],childLoads=[],parentLoads=new Map();for(const l of p.elementLoads||[]){const id=String(l.elementId);if(!selectedSet.has(id))continue;if(!parentLoads.has(id))parentLoads.set(id,[]);parentLoads.get(id).push(l)}
  let createdNodes=0,reusedGeneratedNodes=0,areaBefore=0,areaAfter=0;
  for(const e of selected){
    const ids=shellIds(e);if(ids.length!==4||new Set(ids.map(String)).size!==4)throw new Error(`Refinamento shell4 ${e.id}: quatro nós distintos são obrigatórios.`);const corners=ids.map(id=>nodeById.get(String(id)));if(corners.some(n=>!n))throw new Error(`Refinamento shell4 ${e.id}: nó inexistente.`);const pts=corners.map(p3),level=e.levelId??corners[0]?.levelId??null;areaBefore+=quadArea(pts);const grid=Array.from({length:ny+1},()=>Array(nx+1));
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      if(i===0&&j===0){grid[j][i]=corners[0].id;continue}if(i===nx&&j===0){grid[j][i]=corners[1].id;continue}if(i===nx&&j===ny){grid[j][i]=corners[2].id;continue}if(i===0&&j===ny){grid[j][i]=corners[3].id;continue}
      const q=blend(pts,i/nx,j/ny),found=addNode(q,`SN_${e.id}_${i}_${j}`,level);grid[j][i]=found.node.id;if(found.created){createdNodes++;nodeById.set(String(found.node.id),found.node)}else reusedGeneratedNodes++;
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const childIds=[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]],id=uniqueId(`${e.id}_R${j+1}C${i+1}`,usedElements),child={...clone(e),id,nodeIds:[...childIds],n1:childIds[0],n2:childIds[1],n3:childIds[2],n4:childIds[3],label:`${e.label||e.id} · R${j+1}C${i+1}`,parentShellId:e.parentShellId||e.id,meshRefinement:{sourceElementId:e.id,divisionsX:nx,divisionsY:ny,row:j,column:i}};childElements.push(child);const cpts=childIds.map(nid=>p3(nodeById.get(String(nid))));areaAfter+=quadArea(cpts);
      for(const load of parentLoads.get(String(e.id))||[]){if(!['surface','pressure'].includes(load.kind))throw new Error(`Refinamento shell4 ${e.id}: carga '${load.kind||'desconhecida'}' não pode ser transferida.`);const lid=uniqueId(`${load.id||'SURF'}_${j+1}_${i+1}`,usedLoads);childLoads.push({...clone(load),id:lid,elementId:id})}
    }
  }
  p.elements=(p.elements||[]).filter(e=>!selectedSet.has(String(e.id))).concat(childElements);p.elementLoads=(p.elementLoads||[]).filter(l=>!selectedSet.has(String(l.elementId))).concat(childLoads);
  if(!['linear','modal'].includes(String(p.settings?.analysisType||'linear')))p.settings={...(p.settings||{}),analysisType:'linear'};
  const areaRelativeError=Math.abs(areaAfter-areaBefore)/Math.max(EPS,areaBefore),report={sourceShells:selected.length,childShells:childElements.length,createdNodes,reusedGeneratedNodes,divisionsX:nx,divisionsY:ny,areaBefore,areaAfter,areaRelativeError,levelId:levelId??null};p.meta={...(p.meta||{}),shellRefinementUpdatedAt:new Date().toISOString(),lastShellRefinementReport:report};return{project:p,report,children:childElements.map(e=>e.id)};
}
