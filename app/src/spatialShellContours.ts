// Shell4 scientific contour projection for the 3D canvas.
// Numerical recovery remains in web/src/core; this module only prepares display fields.
// @ts-ignore
import {buildShellNodalContour} from '../../web/src/core/shellContour.js';
// @ts-ignore
import {shellFieldSamples} from '../../web/src/core/shellPostprocess.js';
// @ts-ignore
import {projectPoint3D} from '../../web/src/view/spatialView3d.js';

export type ShellField='Nx'|'Ny'|'Nxy'|'Mx'|'My'|'Mxy'|'Qx'|'Qy'|'Ux'|'Uy'|'Uz'|'Umag';
export type ShellContourMode='gauss'|'nodal'|'center';
export type ShellScaleMode='symmetric'|'range';
export type ContourRange={min:number;max:number;maxAbs:number};
export type ShellContourFrame={displacementMap?:Map<any,any>;displacementPhase?:number;referenceMaxAbs?:number};

type P3=[number,number,number];
const finite=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
export const shellNodeIds=(e:any)=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);
const p3=(n:any):P3=>[finite(n?.x),finite(n?.y),finite(n?.z)];
const N=(xi:number,eta:number)=>[.25*(1-xi)*(1-eta),.25*(1+xi)*(1-eta),.25*(1+xi)*(1+eta),.25*(1-xi)*(1+eta)];
function naturalPointFromCorners(corners:P3[],xi:number,eta:number):P3{const q=N(xi,eta),out:P3=[0,0,0];for(let i=0;i<4;i++){out[0]+=q[i]*corners[i][0];out[1]+=q[i]*corners[i][1];out[2]+=q[i]*corners[i][2]}return out}
export function shellNaturalPoint(nodes:any[],xi:number,eta:number):P3{return naturalPointFromCorners(nodes.map(p3),xi,eta)}
const FIELD_PATH:any={Nx:['membraneResultants','Nx'],Ny:['membraneResultants','Ny'],Nxy:['membraneResultants','Nxy'],Mx:['bendingMoments','Mx'],My:['bendingMoments','My'],Mxy:['bendingMoments','Mxy'],Qx:['transverseShear','Qx'],Qy:['transverseShear','Qy']};
const readPath=(o:any,path:string[])=>path.reduce((v:any,k:string)=>v?.[k],o);
export function shellCenterValue(response:any,field:ShellField){return finite(readPath(response,FIELD_PATH[field]||[]))}
export const DISPLACEMENT_SHELL_FIELDS:ShellField[]=['Ux','Uy','Uz','Umag'];
export function isDisplacementShellField(field:ShellField){return(DISPLACEMENT_SHELL_FIELDS as string[]).includes(field)}
function displacementFieldValue(d:any,field:ShellField,phase=1){if(!d)return 0;const ux=finite(Array.isArray(d)?d[0]:d.ux),uy=finite(Array.isArray(d)?d[1]:d.uy),uz=finite(Array.isArray(d)?d[2]:d.uz),p=finite(phase,1),value=field==='Ux'?ux*p:field==='Uy'?uy*p:field==='Uz'?uz*p:Math.hypot(ux,uy,uz)*Math.abs(p);return Math.abs(value)<1e-15?0:value}
function bilinearCoefficientsFromCorners(q:number[]){return{a:(q[0]+q[1]+q[2]+q[3])/4,b:(-q[0]+q[1]+q[2]-q[3])/4,c:(-q[0]-q[1]+q[2]+q[3])/4,d:(q[0]-q[1]+q[2]-q[3])/4}}
export function shellFieldUnit(field:ShellField){if(isDisplacementShellField(field))return'm';return field.startsWith('M')?'kN·m/m':'kN/m'}
export function shellContourModeLabel(mode:ShellContourMode){return mode==='nodal'?'Nodal suavizado':mode==='gauss'?'Gauss 2×2':'Centro do elemento'}

function gaussCoefficients(response:any,field:ShellField){
  const samples=shellFieldSamples(response,field);if(samples.length!==4){const v=shellCenterValue(response,field);return{a:v,b:0,c:0,d:0}}
  const q=[...samples].sort((a:any,b:any)=>Number(a.pointIndex)-Number(b.pointIndex)).map((x:any)=>finite(x.value)),g=1/Math.sqrt(3);
  return{a:(q[0]+q[1]+q[2]+q[3])/4,b:(-q[0]+q[1]+q[2]-q[3])/(4*g),c:(-q[0]-q[1]+q[2]+q[3])/(4*g),d:(q[0]-q[1]+q[2]-q[3])/(4*g*g)};
}
function bilinear(q:number[],xi:number,eta:number){const s=N(xi,eta);return s.reduce((a,v,i)=>a+v*finite(q[i]),0)}
function range(values:number[]):ContourRange{if(!values.length)return{min:0,max:0,maxAbs:0};const min=Math.min(...values),max=Math.max(...values);return{min,max,maxAbs:Math.max(Math.abs(min),Math.abs(max))}}

export function buildShellContourData(project:any,result:any,field:ShellField,mode:ShellContourMode,pointForNode:(n:any)=>P3=p3,frame?:ShellContourFrame){
  const shells=(project?.elements||[]).filter((e:any)=>e.type==='shell4'),nodeMap=new Map((project?.nodes||[]).map((n:any)=>[String(n.id),n]));
  if(isDisplacementShellField(field)){
    const dispMap=frame?.displacementMap?new Map([...frame.displacementMap].map(([id,d]:any)=>[String(id),d])):new Map((result?.displacements||[]).map((d:any)=>[String(d.nodeId),d])),phase=frame?.displacementPhase??1,byNode:any={},usedNodeIds=new Set<string>();
    for(const e of shells)for(const id of shellNodeIds(e))usedNodeIds.add(String(id));
    for(const id of usedNodeIds)byNode[id]=displacementFieldValue(dispMap.get(id),field,phase);
    const center:any={},gauss:any={},extrema:any[]=[],seen=new Set<string>();
    for(const e of shells){
      const ids=shellNodeIds(e),ns=ids.map((id:any)=>nodeMap.get(String(id))).filter(Boolean);if(ns.length!==4)continue;
      const q=ids.map((id:any)=>finite(byNode[String(id)]));
      center[String(e.id)]=q.reduce((a:number,b:number)=>a+b,0)/4;gauss[String(e.id)]=bilinearCoefficientsFromCorners(q);
      if(mode==='center')extrema.push({value:center[String(e.id)],point:naturalPointFromCorners(ns.map(pointForNode),0,0),elementId:e.id});
      else for(let i=0;i<4;i++){const id=String(ids[i]);if(seen.has(id))continue;seen.add(id);extrema.push({value:byNode[id],point:pointForNode(ns[i]),nodeId:ids[i]})}
    }
    const values=[...usedNodeIds].map(id=>finite(byNode[id]));
    return{field,mode,byNode,center,gauss,range:range(values),extrema,shellCount:shells.length,source:'nodal-displacement-exact',isDisplacement:true};
  }
  const responseMap=new Map((result?.elementForces||[]).filter((r:any)=>r.type==='shell4').map((r:any)=>[String(r.elementId),r]));
  const nodal=mode==='nodal'?buildShellNodalContour(project,result,field):null,byNode:any=nodal?.byNode||{},center:any={},gauss:any={},extrema:any[]=[];
  if(mode==='nodal')for(const x of nodal?.nodes||[]){const n=nodeMap.get(String(x.nodeId));if(n)extrema.push({value:finite(x.value),point:pointForNode(n),nodeId:x.nodeId})}
  for(const e of shells){const r:any=responseMap.get(String(e.id));if(!r)continue;center[String(e.id)]=shellCenterValue(r,field);gauss[String(e.id)]=gaussCoefficients(r,field);const ns=shellNodeIds(e).map((id:any)=>nodeMap.get(String(id))).filter(Boolean);if(ns.length!==4)continue;const corners=ns.map(pointForNode);if(mode==='center')extrema.push({value:center[String(e.id)],point:naturalPointFromCorners(corners,0,0),elementId:e.id});if(mode==='gauss')for(const s of shellFieldSamples(r,field)){const xi=finite(s.naturalCoordinates?.xi),eta=finite(s.naturalCoordinates?.eta);extrema.push({value:finite(s.value),point:naturalPointFromCorners(corners,xi,eta),elementId:e.id,pointIndex:s.pointIndex})}}
  const values=extrema.map(x=>finite(x.value));return{field,mode,byNode,center,gauss,range:range(values),extrema,shellCount:responseMap.size,source:mode==='nodal'?'gauss-2x2-extrapolated-smoothed':mode==='gauss'?'gauss-2x2':'element-center'};
}
export function shellContourValueAt(data:any,e:any,xi:number,eta:number){
  if(!data)return 0;const id=String(e.id);if(data.mode==='center')return finite(data.center?.[id]);if(data.isDisplacement){const c=data.gauss?.[id];return c?c.a+c.b*xi+c.c*eta+c.d*xi*eta:finite(data.center?.[id])}if(data.mode==='gauss'){const c=data.gauss?.[id];return c?c.a+c.b*xi+c.c*eta+c.d*xi*eta:finite(data.center?.[id])}const ids=shellNodeIds(e),q=ids.map((n:any)=>finite(data.byNode?.[String(n)],finite(data.center?.[id])));return bilinear(q,xi,eta)
}
export function shellContourRatio(value:number,r:ContourRange,scale:ShellScaleMode){
  if(scale==='symmetric')return r.maxAbs>1e-12?Math.max(-1,Math.min(1,value/r.maxAbs)):0;const span=r.max-r.min;if(Math.abs(span)<1e-12)return 0;return Math.max(-1,Math.min(1,2*(value-r.min)/span-1))
}
export function buildShellContourScene(project:any,result:any,field:ShellField,mode:ShellContourMode,scale:ShellScaleMode,camera:any,size:{width:number;height:number},subdivisions=8,pointForNode:(n:any)=>P3=p3,frame?:ShellContourFrame){
  const data=buildShellContourData(project,result,field,mode,pointForNode,frame),referenceMaxAbs=Math.max(0,finite(frame?.referenceMaxAbs,data.range.maxAbs)),colorIntensity=referenceMaxAbs>1e-12?Math.max(0,Math.min(1,data.range.maxAbs/referenceMaxAbs)):data.range.maxAbs>1e-12?1:0,nodes=project?.nodes||[],nodeMap=new Map(nodes.map((n:any)=>[String(n.id),n])),shells=(project?.elements||[]).filter((e:any)=>e.type==='shell4'),n=Math.max(2,Math.min(16,Math.round(subdivisions))),items:any[]=[];
  for(const e of shells){const ns=shellNodeIds(e).map((id:any)=>nodeMap.get(String(id)));if(ns.some((x:any)=>!x))continue;const corners=ns.map(pointForNode),pp=corners.map((c:P3)=>projectPoint3D(c,camera,size)),depth=pp.reduce((s:number,p:any)=>s+finite(p.depth),0)/4,cells:any[]=[];
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x0=-1+2*i/n,x1=-1+2*(i+1)/n,y0=-1+2*j/n,y1=-1+2*(j+1)/n,nat=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],points=nat.map(([xi,eta])=>projectPoint3D(naturalPointFromCorners(corners,xi,eta),camera,size));if(points.some((p:any)=>!p.visible))continue;const xm=(x0+x1)/2,ym=(y0+y1)/2,value=shellContourValueAt(data,e,xm,ym),rawRatio=shellContourRatio(value,data.range,scale);cells.push({points,value,rawRatio,ratio:rawRatio*colorIntensity})}
    items.push({e,ns,pp,d:depth,cells})
  }
  items.sort((a,b)=>b.d-a.d);let min:any=null,max:any=null;for(const x of data.extrema||[]){if(!min||x.value<min.value)min=x;if(!max||x.value>max.value)max=x}
  return{...data,items,min,max,scale,colorIntensity,referenceMaxAbs}
}
