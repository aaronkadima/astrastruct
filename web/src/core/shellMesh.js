const EPS=1e-9;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const shellNodeIds=e=>e?.type==='shell4'?(Array.isArray(e.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e.n1,e.n2,e.n3,e.n4]).filter(Boolean):[];
const pairKey=(a,b)=>[String(a),String(b)].sort().join('|');
const shellKey=ids=>[...ids].map(String).sort().join('|');
function uniqueCoords(values,tol){const out=[];for(const raw of [...values].sort((a,b)=>a-b)){const v=finite(raw),found=out.findIndex(x=>Math.abs(x-v)<=tol);if(found<0)out.push(v);else out[found]=(out[found]+v)/2}return out}
function uniqueId(base,used){let id=base,i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}

export function detectRectangularShellCells(project,{levelId=null,elevation=null,tolerance=1e-5,requireBoundaryElements=true}={}){
  const tol=Math.max(1e-8,Math.abs(finite(tolerance,1e-5))),allNodes=project?.nodes||[],levelNodes=allNodes.filter(n=>levelId!=null?String(n.levelId)===String(levelId):(Number.isFinite(Number(elevation))?Math.abs(finite(n.z)-finite(elevation))<=tol:true));
  if(levelNodes.length<4)return[];
  const xs=uniqueCoords(levelNodes.map(n=>finite(n.x)),tol),ys=uniqueCoords(levelNodes.map(n=>finite(n.y)),tol);if(xs.length<2||ys.length<2)return[];
  const nodeAt=(x,y)=>levelNodes.find(n=>Math.abs(finite(n.x)-x)<=tol&&Math.abs(finite(n.y)-y)<=tol)||null;
  const edges=new Set((project?.elements||[]).filter(e=>e.type!=='shell4'&&e.n1&&e.n2).map(e=>pairKey(e.n1,e.n2))),existing=new Set((project?.elements||[]).filter(e=>e.type==='shell4').map(e=>shellKey(shellNodeIds(e)))),cells=[];
  for(let iy=0;iy<ys.length-1;iy++)for(let ix=0;ix<xs.length-1;ix++){
    const a=nodeAt(xs[ix],ys[iy]),b=nodeAt(xs[ix+1],ys[iy]),c=nodeAt(xs[ix+1],ys[iy+1]),d=nodeAt(xs[ix],ys[iy+1]);if(!a||!b||!c||!d)continue;const ids=[a.id,b.id,c.id,d.id];if(new Set(ids).size!==4||existing.has(shellKey(ids)))continue;
    const boundary=[pairKey(a.id,b.id),pairKey(b.id,c.id),pairKey(c.id,d.id),pairKey(d.id,a.id)],closed=boundary.every(k=>edges.has(k));if(requireBoundaryElements&&!closed)continue;
    const width=Math.abs(xs[ix+1]-xs[ix]),height=Math.abs(ys[iy+1]-ys[iy]);if(width<=tol||height<=tol)continue;cells.push({nodeIds:ids,n1:a.id,n2:b.id,n3:c.id,n4:d.id,x0:xs[ix],x1:xs[ix+1],y0:ys[iy],y1:ys[iy+1],width,height,area:width*height,boundaryClosed:closed,levelId:levelId??a.levelId??null});
  }
  return cells;
}

export function addRectangularShellPanels(project,{levelId=null,elevation=null,materialId=null,thickness=.18,pressure=0,caseId=null,shearCorrection=5/6,drillingFactor=1e-6,requireBoundaryElements=true,tolerance=1e-5,labelPrefix='Laje'}={}){
  const p=clone(project),cells=detectRectangularShellCells(p,{levelId,elevation,tolerance,requireBoundaryElements});if(!cells.length)throw new Error('Nenhum painel retangular fechado elegível foi encontrado no nível selecionado.');
  const matId=materialId||p.materials?.find(m=>String(m.type).toLowerCase()==='concrete')?.id||p.materials?.[0]?.id;if(!matId)throw new Error('Shell4: material não definido.');const t=Math.max(1e-5,finite(thickness,.18)),kappa=Math.max(.05,Math.min(1,finite(shearCorrection,5/6))),drill=Math.max(0,finite(drillingFactor,1e-6)),pLoad=finite(pressure),activeCase=caseId||p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id,usedElements=new Set((p.elements||[]).map(e=>String(e.id))),usedLoads=new Set((p.elementLoads||[]).map(l=>String(l.id))),created=[];
  p.elements=p.elements||[];p.elementLoads=p.elementLoads||[];
  for(let i=0;i<cells.length;i++){
    const cell=cells[i],id=uniqueId(`SHELL_${String(levelId??'L')}_${i+1}`,usedElements),e={id,type:'shell4',nodeIds:[...cell.nodeIds],n1:cell.n1,n2:cell.n2,n3:cell.n3,n4:cell.n4,materialId:matId,thickness:t,shearCorrection:kappa,drillingFactor:drill,label:`${labelPrefix} ${i+1}`,levelId:cell.levelId};p.elements.push(e);let loadId=null;if(Math.abs(pLoad)>EPS){loadId=uniqueId(`SURF_${id}`,usedLoads);p.elementLoads.push({id:loadId,caseId:activeCase,elementId:id,kind:'surface',pressure:pLoad})}created.push({elementId:id,loadId,nodeIds:[...cell.nodeIds],area:cell.area})
  }
  p.settings={...(p.settings||{}),analysisType:'linear'};p.meta={...(p.meta||{}),shellMeshUpdatedAt:new Date().toISOString()};return{project:p,created,cells,report:{created:created.length,totalArea:created.reduce((s,x)=>s+x.area,0),levelId:levelId??null,pressure:pLoad,thickness:t,requireBoundaryElements:!!requireBoundaryElements}};
}
