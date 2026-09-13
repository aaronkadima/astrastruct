import {createSurfaceMesh,meshNodeMap} from './meshModel.js';

const EPS=1e-14;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);return n>EPS?a.map(v=>v/n):null};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const point=n=>[Number(n.x),Number(n.y),Number(n.z)];

function polygonNormal(points){let n=[0,0,0];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];n=add(n,[(p[1]-q[1])*(p[2]+q[2]),(p[2]-q[2])*(p[0]+q[0]),(p[0]-q[0])*(p[1]+q[1])])}return unit(n)}
function triangleArea(a,b,c){return .5*norm(cross(sub(b,a),sub(c,a)))}
function interiorAngle(prev,current,next){const a=sub(prev,current),b=sub(next,current),na=norm(a),nb=norm(b);if(!(na>EPS&&nb>EPS))return 0;return Math.acos(clamp(dot(a,b)/(na*nb),-1,1))*180/Math.PI}

export function surfaceCellGeometry(mesh,cellOrId){
  const normalized=createSurfaceMesh(mesh),nodeMap=meshNodeMap(normalized),cell=typeof cellOrId==='string'?normalized.cells.find(c=>c.id===cellOrId):cellOrId;if(!cell)throw new Error(`SurfaceGeometry: célula ${cellOrId} não encontrada.`);
  const nodes=cell.nodeIds.map(id=>nodeMap.get(String(id)));if(nodes.some(n=>!n))throw new Error(`SurfaceGeometry: célula ${cell.id} referencia nó ausente.`);const points=nodes.map(point),normal=polygonNormal(points);if(!normal)throw new Error(`SurfaceGeometry: célula ${cell.id} degenerada.`);
  const centroid=scale(points.reduce(add,[0,0,0]),1/points.length),area=cell.type==='tri3'?triangleArea(points[0],points[1],points[2]):triangleArea(points[0],points[1],points[2])+triangleArea(points[0],points[2],points[3]),edges=points.map((p,i)=>norm(sub(points[(i+1)%points.length],p))),angles=points.map((p,i)=>interiorAngle(points[(i+points.length-1)%points.length],p,points[(i+1)%points.length])),planeDistances=points.map(p=>dot(sub(p,centroid),normal)),warpage=Math.max(...planeDistances.map(Math.abs)),span=Math.max(...edges,EPS),aspectRatio=Math.max(...edges)/Math.max(EPS,Math.min(...edges));
  const cornerScaledJacobians=points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],a=sub(next,p),b=sub(prev,p),den=norm(a)*norm(b);return den>EPS?dot(cross(a,b),normal)/den:0}),minScaledJacobian=Math.min(...cornerScaledJacobians);
  return{contract:'surface-cell-geometry/v1',cellId:cell.id,type:cell.type,nodeIds:[...cell.nodeIds],centroid:{x:centroid[0],y:centroid[1],z:centroid[2]},normal:{x:normal[0],y:normal[1],z:normal[2]},area,edgeLengths:edges,angles,minAngle:Math.min(...angles),maxAngle:Math.max(...angles),aspectRatio,warpage,warpageRatio:warpage/span,planeDistances,cornerScaledJacobians,minScaledJacobian};
}

export function evaluateSurfaceCellQuality(mesh,cellOrId,{aspectWarning=4,minAngleWarning=25,maxAngleWarning=155,minScaledJacobianWarning=.3,warpageRatioWarning=.02}={}){
  const geometry=surfaceCellGeometry(mesh,cellOrId),issues=[];let status='good';if(!(geometry.area>EPS)){status='invalid';issues.push('Área não positiva ou degenerada.')}if(!(geometry.minScaledJacobian>0)){status='invalid';issues.push('Jacobiano/canto orientado não positivo.')}if(status!=='invalid'){
    if(geometry.aspectRatio>aspectWarning){status='warning';issues.push(`Aspect ratio ${geometry.aspectRatio.toFixed(3)} > ${aspectWarning}.`)}
    if(geometry.minAngle<minAngleWarning||geometry.maxAngle>maxAngleWarning){status='warning';issues.push(`Ângulos ${geometry.minAngle.toFixed(2)}°–${geometry.maxAngle.toFixed(2)}° fora da faixa recomendada.`)}
    if(geometry.minScaledJacobian<minScaledJacobianWarning){status='warning';issues.push(`Jacobiano escalado ${geometry.minScaledJacobian.toFixed(3)} < ${minScaledJacobianWarning}.`)}
    if(geometry.type==='quad4'&&geometry.warpageRatio>warpageRatioWarning){status='warning';issues.push(`Warpage relativo ${geometry.warpageRatio.toExponential(3)} > ${warpageRatioWarning}.`)}
  }
  return{...geometry,status,issues};
}

export function evaluateSurfaceMeshQuality(mesh,options={}){
  const normalized=createSurfaceMesh(mesh),items=normalized.cells.map(cell=>evaluateSurfaceCellQuality(normalized,cell,options)),counts={good:0,warning:0,invalid:0};for(const item of items)counts[item.status]++;
  const area=items.reduce((s,item)=>s+item.area,0);return{contract:'surface-mesh-quality/v1',meshId:normalized.id,total:items.length,area,counts,items,ok:counts.invalid===0,worst:items.length?{aspectRatio:Math.max(...items.map(x=>x.aspectRatio)),minAngle:Math.min(...items.map(x=>x.minAngle)),maxAngle:Math.max(...items.map(x=>x.maxAngle)),minScaledJacobian:Math.min(...items.map(x=>x.minScaledJacobian)),warpageRatio:Math.max(...items.map(x=>x.warpageRatio))}:null};
}
