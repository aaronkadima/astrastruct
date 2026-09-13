const UNIT_TO_M={0:1,1:.0254,2:.3048,3:1609.344,4:.001,5:.01,6:1,7:1000,8:2.54e-8,9:2.54e-5,10:.9144,11:1e-10,12:1e-9,13:1e-6,14:.1,15:10,16:100,17:1e9,18:1.495978707e11,19:9.460730472e15,20:3.085677581e16};
const UNIT_LABEL={0:'sem unidade',1:'in',2:'ft',3:'mi',4:'mm',5:'cm',6:'m',7:'km',8:'microin',9:'mil',10:'yd',11:'Å',12:'nm',13:'µm',14:'dm',15:'dam',16:'hm',17:'Gm',18:'AU',19:'ly',20:'pc'};
const finite=v=>Number.isFinite(Number(v))?Number(v):0;

function pairs(text){
  const lines=String(text??'').replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n'),out=[];
  for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isFinite(code))continue;out.push({code,value:lines[i+1].trim()})}
  return out;
}
function headerUnits(ps){for(let i=0;i<ps.length-2;i++)if(ps[i].code===9&&ps[i].value==='$INSUNITS'){for(let j=i+1;j<Math.min(ps.length,i+8);j++)if(ps[j].code===70)return Number(ps[j].value)||0}return 0}
function entitiesPairs(ps){let inside=false;const out=[];for(let i=0;i<ps.length;i++){const p=ps[i];if(p.code===0&&p.value==='SECTION'&&ps[i+1]?.code===2&&ps[i+1]?.value==='ENTITIES'){inside=true;i++;continue}if(inside&&p.code===0&&p.value==='ENDSEC')break;if(inside)out.push(p)}return out}
function entityRecords(ps){const out=[];let current=null;for(const p of ps){if(p.code===0){if(current)out.push(current);current={type:p.value,pairs:[]};continue}if(current)current.pairs.push(p)}if(current)out.push(current);return out}
function one(rec,code,fallback=''){const p=rec.pairs.find(x=>x.code===code);return p?p.value:fallback}
function all(rec,code){return rec.pairs.filter(x=>x.code===code).map(x=>x.value)}
function lineEntity(rec){const layer=one(rec,8,'0'),x1=finite(one(rec,10)),y1=finite(one(rec,20)),x2=finite(one(rec,11)),y2=finite(one(rec,21));return{type:'LINE',layer,segments:[{x1,y1,x2,y2}]}}
function lwpolylineEntity(rec){
  const layer=one(rec,8,'0'),closed=(Number(one(rec,70,'0'))&1)!==0,pts=[];let pending=null;
  for(const p of rec.pairs){if(p.code===10){if(pending&&Number.isFinite(pending.x)&&Number.isFinite(pending.y))pts.push(pending);pending={x:finite(p.value),y:NaN}}else if(p.code===20&&pending)pending.y=finite(p.value)}if(pending&&Number.isFinite(pending.x)&&Number.isFinite(pending.y))pts.push(pending);
  const segments=[];for(let i=0;i<pts.length-1;i++)segments.push({x1:pts[i].x,y1:pts[i].y,x2:pts[i+1].x,y2:pts[i+1].y});if(closed&&pts.length>2)segments.push({x1:pts[pts.length-1].x,y1:pts[pts.length-1].y,x2:pts[0].x,y2:pts[0].y});return{type:'LWPOLYLINE',layer,closed,points:pts,segments};
}

export function inspectDxfPlan(text){
  const ps=pairs(text),unitsCode=headerUnits(ps),records=entityRecords(entitiesPairs(ps)),entities=[];
  for(const r of records){if(r.type==='LINE')entities.push(lineEntity(r));else if(r.type==='LWPOLYLINE')entities.push(lwpolylineEntity(r))}
  const layers=[...new Set(entities.map(e=>e.layer))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  return{unitsCode,unitsLabel:UNIT_LABEL[unitsCode]||`código ${unitsCode}`,unitScale:UNIT_TO_M[unitsCode]??1,layers,entities,stats:{records:records.length,supportedEntities:entities.length,segments:entities.reduce((s,e)=>s+e.segments.length,0),unsupported:records.filter(r=>!['LINE','LWPOLYLINE'].includes(r.type)).reduce((m,r)=>(m[r.type]=(m[r.type]||0)+1,m),{})}};
}

export function dxfToPlan(text,{layers=null,manualScale=1,tolerance=.01,shiftToOrigin=true}={}){
  const inspected=inspectDxfPlan(text),selected=Array.isArray(layers)&&layers.length?new Set(layers):null,scale=(inspected.unitScale||1)*Math.max(1e-12,finite(manualScale)||1),tol=Math.max(1e-8,finite(tolerance)||.01),segments=[];
  for(const e of inspected.entities){if(selected&&!selected.has(e.layer))continue;for(const s of e.segments){const x1=s.x1*scale,y1=s.y1*scale,x2=s.x2*scale,y2=s.y2*scale;if(Math.hypot(x2-x1,y2-y1)>tol*1e-3)segments.push({layer:e.layer,x1,y1,x2,y2})}}
  if(!segments.length)throw new Error('DXF: nenhuma LINE/LWPOLYLINE válida nas layers selecionadas.');
  let minX=Math.min(...segments.flatMap(s=>[s.x1,s.x2])),minY=Math.min(...segments.flatMap(s=>[s.y1,s.y2]));if(!shiftToOrigin){minX=0;minY=0}
  const nodes=[],edges=[],buckets=new Map();
  const key=(x,y)=>`${Math.round(x/tol)}:${Math.round(y/tol)}`;
  const getNode=(x,y)=>{x-=minX;y-=minY;const k=key(x,y),candidates=[];for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=1;iy++){const [gx,gy]=k.split(':').map(Number),arr=buckets.get(`${gx+ix}:${gy+iy}`);if(arr)candidates.push(...arr)}let found=candidates.find(n=>Math.hypot(n.x-x,n.y-y)<=tol);if(found)return found;found={id:`P${nodes.length+1}`,x,y};nodes.push(found);const bk=key(x,y);if(!buckets.has(bk))buckets.set(bk,[]);buckets.get(bk).push(found);return found};
  const edgeKeys=new Set();for(const s of segments){const a=getNode(s.x1,s.y1),b=getNode(s.x2,s.y2);if(a.id===b.id)continue;const ek=[a.id,b.id].sort().join('|');if(edgeKeys.has(ek))continue;edgeKeys.add(ek);edges.push({id:`L${edges.length+1}`,n1:a.id,n2:b.id,layer:s.layer})}
  if(!edges.length)throw new Error('DXF: a tolerância eliminou todas as linhas estruturais.');
  const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  return{planNodes:nodes,planEdges:edges,layers:inspected.layers,unitsCode:inspected.unitsCode,unitsLabel:inspected.unitsLabel,unitScale:inspected.unitScale,manualScale:finite(manualScale)||1,tolerance:tol,bounds,stats:{...inspected.stats,selectedSegments:segments.length,nodes:nodes.length,edges:edges.length}};
}
