const EPS=1e-9;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const shellNodeIds=e=>e?.type==='shell4'?(Array.isArray(e.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e.n1,e.n2,e.n3,e.n4]).filter(Boolean):[];
const pairKey=(a,b)=>[String(a),String(b)].sort().join('|');
const shellKey=ids=>[...ids].map(String).sort().join('|');
function uniqueCoords(values,tol){const out=[];for(const raw of [...values].sort((a,b)=>a-b)){const v=finite(raw),found=out.findIndex(x=>Math.abs(x-v)<=tol);if(found<0)out.push(v);else out[found]=(out[found]+v)/2}return out}
function uniqueId(base,used){let id=base,i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
function polygonAreaSigned(points){let a=0;for(let i=0;i<points.length;i++){const j=(i+1)%points.length;a+=points[i][0]*points[j][1]-points[j][0]*points[i][1]}return a/2}
function rotations(a){return a.map((_,i)=>a.slice(i).concat(a.slice(0,i)))}
function cycleKey(ids){const a=ids.map(String),r=[...a].reverse();return rotations(a).concat(rotations(r)).map(x=>x.join('|')).sort()[0]}
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function onSegment(p,a,b,tol){return Math.abs(orient(a,b,p))<=tol&&p[0]>=Math.min(a[0],b[0])-tol&&p[0]<=Math.max(a[0],b[0])+tol&&p[1]>=Math.min(a[1],b[1])-tol&&p[1]<=Math.max(a[1],b[1])+tol}
function segmentsIntersect(a,b,c,d,tol){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);if(((o1>tol&&o2<-tol)||(o1<-tol&&o2>tol))&&((o3>tol&&o4<-tol)||(o3<-tol&&o4>tol)))return true;return onSegment(c,a,b,tol)||onSegment(d,a,b,tol)||onSegment(a,c,d,tol)||onSegment(b,c,d,tol)}
function pointInPolygon(p,poly,tol){for(let i=0;i<poly.length;i++)if(onSegment(p,poly[i],poly[(i+1)%poly.length],tol))return true;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],hit=((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1]+1e-30)+a[0]);if(hit)inside=!inside}return inside}
function levelNodeSet(project,{levelId=null,elevation=null,tolerance=1e-5}={}){const tol=Math.max(1e-8,Math.abs(finite(tolerance,1e-5))),nodes=project?.nodes||[];return{tol,nodes:nodes.filter(n=>levelId!=null?String(n.levelId)===String(levelId):(Number.isFinite(Number(elevation))?Math.abs(finite(n.z)-finite(elevation))<=tol:true))}}

export function detectRectangularShellCells(project,{levelId=null,elevation=null,tolerance=1e-5,requireBoundaryElements=true}={}){
  const {tol,nodes:levelNodes}=levelNodeSet(project,{levelId,elevation,tolerance});if(levelNodes.length<4)return[];
  const xs=uniqueCoords(levelNodes.map(n=>finite(n.x)),tol),ys=uniqueCoords(levelNodes.map(n=>finite(n.y)),tol);if(xs.length<2||ys.length<2)return[];
  const nodeAt=(x,y)=>levelNodes.find(n=>Math.abs(finite(n.x)-x)<=tol&&Math.abs(finite(n.y)-y)<=tol)||null;
  const edges=new Set((project?.elements||[]).filter(e=>e.type!=='shell4'&&e.n1&&e.n2).map(e=>pairKey(e.n1,e.n2))),existing=new Set((project?.elements||[]).filter(e=>e.type==='shell4').map(e=>shellKey(shellNodeIds(e)))),cells=[];
  for(let iy=0;iy<ys.length-1;iy++)for(let ix=0;ix<xs.length-1;ix++){
    const a=nodeAt(xs[ix],ys[iy]),b=nodeAt(xs[ix+1],ys[iy]),c=nodeAt(xs[ix+1],ys[iy+1]),d=nodeAt(xs[ix],ys[iy+1]);if(!a||!b||!c||!d)continue;const ids=[a.id,b.id,c.id,d.id];if(new Set(ids).size!==4||existing.has(shellKey(ids)))continue;
    const boundary=[pairKey(a.id,b.id),pairKey(b.id,c.id),pairKey(c.id,d.id),pairKey(d.id,a.id)],closed=boundary.every(k=>edges.has(k));if(requireBoundaryElements&&!closed)continue;
    const width=Math.abs(xs[ix+1]-xs[ix]),height=Math.abs(ys[iy+1]-ys[iy]);if(width<=tol||height<=tol)continue;cells.push({nodeIds:ids,n1:a.id,n2:b.id,n3:c.id,n4:d.id,x0:xs[ix],x1:xs[ix+1],y0:ys[iy],y1:ys[iy+1],width,height,area:width*height,boundaryClosed:closed,levelId:levelId??a.levelId??null,shape:'rectangle'});
  }
  return cells;
}

/** Detect direct four-edge floor bays, including skewed/trapezoidal quadrilaterals. */
export function detectQuadrilateralShellCells(project,{levelId=null,elevation=null,tolerance=1e-5,requireBoundaryElements=true,skipDiagonals=true,maxCells=5000}={}){
  const {tol,nodes:levelNodes}=levelNodeSet(project,{levelId,elevation,tolerance});if(levelNodes.length<4)return[];const nodeMap=new Map(levelNodes.map(n=>[String(n.id),n])),levelIds=new Set(nodeMap.keys()),edges=new Set(),adj=new Map();
  const connect=(a,b)=>{a=String(a);b=String(b);if(a===b||!levelIds.has(a)||!levelIds.has(b))return;edges.add(pairKey(a,b));if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a)};
  for(const e of project?.elements||[])if(e.type!=='shell4'&&e.n1&&e.n2)connect(e.n1,e.n2);
  if(requireBoundaryElements&&edges.size<4)return[];const existing=new Set((project?.elements||[]).filter(e=>e.type==='shell4').map(e=>shellKey(shellNodeIds(e)))),seen=new Set(),cells=[];
  const ids=[...levelIds].sort();
  for(const a of ids)for(const b of adj.get(a)||[])for(const c of adj.get(b)||[]){if(c===a)continue;for(const d of adj.get(c)||[]){if(d===a||d===b||d===c||!(adj.get(d)||new Set()).has(a))continue;const raw=[a,b,c,d],ck=cycleKey(raw);if(seen.has(ck)){continue}seen.add(ck);if(existing.has(shellKey(raw)))continue;if(skipDiagonals&&(edges.has(pairKey(a,c))||edges.has(pairKey(b,d))))continue;let poly=raw.map(id=>{const n=nodeMap.get(id);return[finite(n.x),finite(n.y)]});if(segmentsIntersect(poly[0],poly[1],poly[2],poly[3],tol)||segmentsIntersect(poly[1],poly[2],poly[3],poly[0],tol))continue;let signed=polygonAreaSigned(poly);if(Math.abs(signed)<=tol*tol)continue;let ordered=raw;if(signed<0){ordered=[a,d,c,b];poly=ordered.map(id=>{const n=nodeMap.get(id);return[finite(n.x),finite(n.y)]});signed=-signed}
      const own=new Set(ordered),hasExtra=levelNodes.some(n=>!own.has(String(n.id))&&pointInPolygon([finite(n.x),finite(n.y)],poly,tol));if(hasExtra)continue;
      const boundary=[pairKey(ordered[0],ordered[1]),pairKey(ordered[1],ordered[2]),pairKey(ordered[2],ordered[3]),pairKey(ordered[3],ordered[0])],closed=boundary.every(k=>edges.has(k));if(requireBoundaryElements&&!closed)continue;const p=ordered.map(id=>nodeMap.get(id)),lengths=p.map((n,i)=>Math.hypot(finite(p[(i+1)%4].x)-finite(n.x),finite(p[(i+1)%4].y)-finite(n.y)));cells.push({nodeIds:ordered,n1:ordered[0],n2:ordered[1],n3:ordered[2],n4:ordered[3],area:signed,boundaryClosed:closed,edgeLengths:lengths,levelId:levelId??p[0]?.levelId??null,shape:'quadrilateral'});if(cells.length>=maxCells)return cells}
  }
  return cells;
}

function addShellCells(project,cells,{levelId=null,materialId=null,thickness=.18,pressure=0,caseId=null,shearCorrection=5/6,drillingFactor=1e-6,labelPrefix='Laje',reportKind='rectangular'}={}){
  const p=clone(project);if(!cells.length)throw new Error(reportKind==='quadrilateral'?'Nenhum painel quadrilateral fechado elegível foi encontrado no nível selecionado.':'Nenhum painel retangular fechado elegível foi encontrado no nível selecionado.');
  const matId=materialId||p.materials?.find(m=>String(m.type).toLowerCase()==='concrete')?.id||p.materials?.[0]?.id;if(!matId)throw new Error('Shell4: material não definido.');const t=Math.max(1e-5,finite(thickness,.18)),kappa=Math.max(.05,Math.min(1,finite(shearCorrection,5/6))),drill=Math.max(0,finite(drillingFactor,1e-6)),pLoad=finite(pressure),activeCase=caseId||p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id,usedElements=new Set((p.elements||[]).map(e=>String(e.id))),usedLoads=new Set((p.elementLoads||[]).map(l=>String(l.id))),created=[];
  p.elements=p.elements||[];p.elementLoads=p.elementLoads||[];
  for(let i=0;i<cells.length;i++){
    const cell=cells[i],id=uniqueId(`SHELL_${String(levelId??'L')}_${i+1}`,usedElements),e={id,type:'shell4',nodeIds:[...cell.nodeIds],n1:cell.n1,n2:cell.n2,n3:cell.n3,n4:cell.n4,materialId:matId,thickness:t,shearCorrection:kappa,drillingFactor:drill,label:`${labelPrefix} ${i+1}`,levelId:cell.levelId};p.elements.push(e);let loadId=null;if(Math.abs(pLoad)>EPS){loadId=uniqueId(`SURF_${id}`,usedLoads);p.elementLoads.push({id:loadId,caseId:activeCase,elementId:id,kind:'surface',pressure:pLoad})}created.push({elementId:id,loadId,nodeIds:[...cell.nodeIds],area:cell.area})
  }
  p.settings={...(p.settings||{}),analysisType:'linear'};p.meta={...(p.meta||{}),shellMeshUpdatedAt:new Date().toISOString()};return{project:p,created,cells,report:{kind:reportKind,created:created.length,totalArea:created.reduce((s,x)=>s+x.area,0),levelId:levelId??null,pressure:pLoad,thickness:t,requireBoundaryElements:true}};
}

export function addRectangularShellPanels(project,{levelId=null,elevation=null,materialId=null,thickness=.18,pressure=0,caseId=null,shearCorrection=5/6,drillingFactor=1e-6,requireBoundaryElements=true,tolerance=1e-5,labelPrefix='Laje'}={}){
  const cells=detectRectangularShellCells(project,{levelId,elevation,tolerance,requireBoundaryElements});return addShellCells(project,cells,{levelId,materialId,thickness,pressure,caseId,shearCorrection,drillingFactor,labelPrefix,reportKind:'rectangular'});
}

export function addQuadrilateralShellPanels(project,{levelId=null,elevation=null,materialId=null,thickness=.18,pressure=0,caseId=null,shearCorrection=5/6,drillingFactor=1e-6,requireBoundaryElements=true,tolerance=1e-5,labelPrefix='Laje',skipDiagonals=true,maxCells=5000}={}){
  const cells=detectQuadrilateralShellCells(project,{levelId,elevation,tolerance,requireBoundaryElements,skipDiagonals,maxCells});return addShellCells(project,cells,{levelId,materialId,thickness,pressure,caseId,shearCorrection,drillingFactor,labelPrefix,reportKind:'quadrilateral'});
}
