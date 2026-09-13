const EPS=1e-10;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clone=v=>JSON.parse(JSON.stringify(v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normAngle=a=>{let x=Math.abs(a)%Math.PI;return x>Math.PI/2?Math.PI-x:x};

function uniqueId(base,used){let id=base,i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
function normalizePlan(planNodes=[],planEdges=[]){
  const used=new Set(),nodes=(planNodes||[]).map((n,i)=>({id:uniqueId(String(n?.id||`P${i+1}`),used),x:finite(n?.x),y:finite(n?.y),...(n?.levelId?{levelId:n.levelId}:{})})),ids=new Set(nodes.map(n=>n.id));
  const edges=(planEdges||[]).map((e,i)=>({id:String(e?.id||`L${i+1}`),n1:String(e?.n1||''),n2:String(e?.n2||''),...(e?.layer!=null?{layer:String(e.layer)}:{})})).filter(e=>ids.has(e.n1)&&ids.has(e.n2)&&e.n1!==e.n2);
  return{nodes,edges};
}
function snapNodes(nodes,grid){
  if(!(grid>EPS))return{nodes,changed:0};let changed=0;
  const next=nodes.map(n=>{const x=Math.round(n.x/grid)*grid,y=Math.round(n.y/grid)*grid;if(Math.abs(x-n.x)>EPS||Math.abs(y-n.y)>EPS)changed++;return{...n,x,y}});return{nodes:next,changed};
}
function orthogonalize(nodes,edges,angleDeg){
  const tol=Math.max(0,Math.min(15,finite(angleDeg,0)))*Math.PI/180;if(!(tol>0))return{nodes,changed:0};
  const map=new Map(nodes.map(n=>[n.id,n])),props=new Map(nodes.map(n=>[n.id,{xs:[],ys:[]}])) ,affected=new Set();
  for(const e of edges){const a=map.get(e.n1),b=map.get(e.n2);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<EPS)continue;const theta=normAngle(Math.atan2(dy,dx));if(theta<=tol){const y=(a.y+b.y)/2;props.get(a.id).ys.push(y);props.get(b.id).ys.push(y);affected.add(a.id);affected.add(b.id)}else if(Math.abs(Math.PI/2-theta)<=tol){const x=(a.x+b.x)/2;props.get(a.id).xs.push(x);props.get(b.id).xs.push(x);affected.add(a.id);affected.add(b.id)}}
  let changed=0;const next=nodes.map(n=>{const p=props.get(n.id),x=p.xs.length?p.xs.reduce((s,v)=>s+v,0)/p.xs.length:n.x,y=p.ys.length?p.ys.reduce((s,v)=>s+v,0)/p.ys.length:n.y;if(Math.abs(x-n.x)>EPS||Math.abs(y-n.y)>EPS)changed++;return{...n,x,y}});return{nodes:next,changed,affected:affected.size};
}
function mergeVertices(nodes,edges,tolerance){
  const tol=Math.max(EPS,finite(tolerance,.01));if(nodes.length<2)return{nodes,edges,merged:0};
  const parent=nodes.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
  const buckets=new Map(),key=(x,y)=>`${Math.round(x/tol)}:${Math.round(y/tol)}`;
  for(let i=0;i<nodes.length;i++){const n=nodes[i],k=key(n.x,n.y),[gx,gy]=k.split(':').map(Number);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of buckets.get(`${gx+dx}:${gy+dy}`)||[])if(dist(n,nodes[j])<=tol)join(i,j);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)}
  const groups=new Map();for(let i=0;i<nodes.length;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i)}
  const oldToNew=new Map(),out=[];for(const idxs of groups.values()){const base=nodes[idxs[0]],x=idxs.reduce((s,i)=>s+nodes[i].x,0)/idxs.length,y=idxs.reduce((s,i)=>s+nodes[i].y,0)/idxs.length,n={...base,x,y};out.push(n);for(const i of idxs)oldToNew.set(nodes[i].id,n.id)}
  return{nodes:out,edges:edges.map(e=>({...e,n1:oldToNew.get(e.n1)||e.n1,n2:oldToNew.get(e.n2)||e.n2})),merged:nodes.length-out.length};
}
function dedupeEdges(nodes,edges,minLength){
  const map=new Map(nodes.map(n=>[n.id,n])),keys=new Set(),out=[];let shortRemoved=0,duplicateRemoved=0,degenerateRemoved=0;
  for(const e of edges){const a=map.get(e.n1),b=map.get(e.n2);if(!a||!b||e.n1===e.n2){degenerateRemoved++;continue}if(dist(a,b)<minLength){shortRemoved++;continue}const k=[e.n1,e.n2].sort().join('|')+'|'+String(e.layer??'');if(keys.has(k)){duplicateRemoved++;continue}keys.add(k);out.push(e)}return{edges:out,shortRemoved,duplicateRemoved,degenerateRemoved};
}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;if(L2<EPS)return dist(p,a);return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/Math.sqrt(L2)}
function simplifyCollinear(nodes,edges,tolerance,angleDeg){
  const tol=Math.max(EPS,finite(tolerance,.01)),angTol=Math.max(.01,finite(angleDeg,1))*Math.PI/180;let workNodes=clone(nodes),workEdges=clone(edges),removed=0,changed=true;
  while(changed){changed=false;const nodeMap=new Map(workNodes.map(n=>[n.id,n])),inc=new Map(workNodes.map(n=>[n.id,[]]));for(const e of workEdges){inc.get(e.n1)?.push(e);inc.get(e.n2)?.push(e)}
    for(const n of workNodes){const es=inc.get(n.id)||[];if(es.length!==2)continue;const [e1,e2]=es;if(String(e1.layer??'')!==String(e2.layer??''))continue;const other=(e)=>e.n1===n.id?e.n2:e.n1,a=nodeMap.get(other(e1)),b=nodeMap.get(other(e2));if(!a||!b||a.id===b.id)continue;const v1=[a.x-n.x,a.y-n.y],v2=[b.x-n.x,b.y-n.y],L1=Math.hypot(...v1),L2=Math.hypot(...v2);if(L1<EPS||L2<EPS)continue;const c=Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(L1*L2))),angle=Math.acos(c);if(Math.abs(Math.PI-angle)>angTol||pointLineDistance(n,a,b)>tol)continue;const id=e1.id||`L${workEdges.length+1}`,merged={...e1,id,n1:a.id,n2:b.id};workEdges=workEdges.filter(e=>e!==e1&&e!==e2);workEdges.push(merged);workNodes=workNodes.filter(x=>x.id!==n.id);removed++;changed=true;break}
  }
  return{nodes:workNodes,edges:workEdges,removed};
}
function bounds(nodes){if(!nodes.length)return{minX:0,maxX:0,minY:0,maxY:0,width:0,height:0};const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return{minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY}}

/** Deterministic cleanup for structural plan centerlines before 3D extrusion. */
export function cleanPlanGeometry(planNodes=[],planEdges=[],options={}){
  const mergeTolerance=Math.max(EPS,finite(options.mergeTolerance,.01)),minLength=Math.max(0,finite(options.minLength,.02)),snapGrid=Math.max(0,finite(options.snapGrid,0)),orthogonalAngleDeg=Math.max(0,finite(options.orthogonalAngleDeg,0)),mergeCollinear=options.mergeCollinear!==false,collinearAngleDeg=Math.max(.01,finite(options.collinearAngleDeg,1));
  let {nodes,edges}=normalizePlan(planNodes,planEdges);const input={nodes:nodes.length,edges:edges.length},snapped=snapNodes(nodes,snapGrid);nodes=snapped.nodes;const ortho=orthogonalize(nodes,edges,orthogonalAngleDeg);nodes=ortho.nodes;const merged=mergeVertices(nodes,edges,mergeTolerance);nodes=merged.nodes;edges=merged.edges;const first=dedupeEdges(nodes,edges,minLength);edges=first.edges;let simplified={nodes,edges,removed:0};if(mergeCollinear)simplified=simplifyCollinear(nodes,edges,mergeTolerance,collinearAngleDeg);nodes=simplified.nodes;edges=simplified.edges;const second=dedupeEdges(nodes,edges,minLength);edges=second.edges;const used=new Set(edges.flatMap(e=>[e.n1,e.n2]));const orphanRemoved=nodes.filter(n=>!used.has(n.id)).length;nodes=nodes.filter(n=>used.has(n.id));const nodeSet=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>nodeSet.has(e.n1)&&nodeSet.has(e.n2));
  edges=edges.map((e,i)=>({...e,id:e.id||`L${i+1}`}));
  return{planNodes:nodes,planEdges:edges,bounds:bounds(nodes),stats:{inputNodes:input.nodes,inputEdges:input.edges,outputNodes:nodes.length,outputEdges:edges.length,snappedNodes:snapped.changed,orthogonalizedNodes:ortho.changed||0,mergedVertices:merged.merged,shortEdgesRemoved:first.shortRemoved+second.shortRemoved,duplicateEdgesRemoved:first.duplicateRemoved+second.duplicateRemoved,degenerateEdgesRemoved:first.degenerateRemoved+second.degenerateRemoved,collinearVerticesRemoved:simplified.removed,orphanNodesRemoved:orphanRemoved,changed:input.nodes!==nodes.length||input.edges!==edges.length||snapped.changed>0||(ortho.changed||0)>0}};
}
