const EPS=1e-12;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>Math.hypot(...a);
const lerp=(a,b,t)=>a+(b-a)*t;
const nodePoint=n=>[Number(n?.x)||0,Number(n?.y)||0,Number(n?.z)||0];

const FIELD_META={
  N:{label:'N',unit:'kN',offsetAxis:'ey',signed:true},
  V:{label:'|V|',unit:'kN',offsetAxis:'ey',signed:false},
  Vy:{label:'Vy',unit:'kN',offsetAxis:'ey',signed:true},
  Vz:{label:'Vz',unit:'kN',offsetAxis:'ez',signed:true},
  T:{label:'T',unit:'kN·m',offsetAxis:'ey',signed:true},
  M:{label:'|M|',unit:'kN·m',offsetAxis:'ey',signed:false},
  MyBar:{label:'My',unit:'kN·m',offsetAxis:'ez',signed:true},
  MzBar:{label:'Mz',unit:'kN·m',offsetAxis:'ey',signed:true},
  UxBar:{label:'Ux',unit:'mm',offsetAxis:'ey',signed:true},
  UyBar:{label:'Uy',unit:'mm',offsetAxis:'ey',signed:true},
  UzBar:{label:'Uz',unit:'mm',offsetAxis:'ey',signed:true},
  UmagBar:{label:'|u|',unit:'mm',offsetAxis:'ey',signed:false},
  epsX:{label:'εx',unit:'µε',offsetAxis:'ey',signed:true},
  kappaY:{label:'κy',unit:'1/m',offsetAxis:'ez',signed:true},
  kappaZ:{label:'κz',unit:'1/m',offsetAxis:'ey',signed:true},
  twistRate:{label:'dθx/dx',unit:'rad/m',offsetAxis:'ey',signed:true},
};
export const FRAME_DIAGRAM_FIELDS=Object.freeze(Object.keys(FIELD_META));
export const isFrameDiagramField3D=field=>Object.prototype.hasOwnProperty.call(FIELD_META,String(field));
export const frameDiagramFieldMeta3D=field=>FIELD_META[String(field)]||null;

function axesFromResult(project,e,force){
  const raw=force?.localAxes;
  if(raw?.ex&&raw?.ey&&raw?.ez&&Number(raw?.length??raw?.L)>0)return{ex:[...raw.ex],ey:[...raw.ey],ez:[...raw.ez],length:Number(raw.length??raw.L),a:raw.a?[...raw.a]:nodePoint((project.nodes||[]).find(n=>n.id===e.n1)),b:raw.b?[...raw.b]:nodePoint((project.nodes||[]).find(n=>n.id===e.n2))};
  const a=nodePoint((project.nodes||[]).find(n=>n.id===e.n1)),b=nodePoint((project.nodes||[]).find(n=>n.id===e.n2)),dx=sub(b,a),L=norm(dx);if(!(L>EPS))return null;const ex=scale(dx,1/L);
  let ref=Array.isArray(e.orientation?.up)?e.orientation.up.map(Number):[0,0,1];if(norm(ref)<EPS||Math.abs(dot(ref,ex)/Math.max(EPS,norm(ref)))>.98)ref=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];
  const proj=dot(ref,ex),rawEy=sub(ref,scale(ex,proj)),ey=scale(rawEy,1/Math.max(EPS,norm(rawEy))),ez=[ex[1]*ey[2]-ex[2]*ey[1],ex[2]*ey[0]-ex[0]*ey[2],ex[0]*ey[1]-ex[1]*ey[0]];
  return{ex,ey,ez,length:L,a,b};
}
function material(project,e){return(project.materials||[]).find(m=>m.id===e.materialId)||{}}
function section(project,e){return(project.sections||[]).find(s=>s.id===e.sectionId)||{}}
function prop(e,s,key,fallback=0){const v=Number(e?.[key]??s?.[key]??fallback);return Number.isFinite(v)?v:0}
function displacementRows(result){return result?.totalDisplacements||result?.displacements||result?.combined?.displacements||[]}
function sumUniform(force){return(force?.loadSummary||[]).filter(l=>l?.kind==='uniform').reduce((a,l)=>({qx:a.qx+(Number(l.qx)||0),qy:a.qy+(Number(l.qy)||0),qz:a.qz+(Number(l.qz)||0)}),{qx:0,qy:0,qz:0})}
function hermite(v1,t1,v2,t2,L,xi){
  const x2=xi*xi,x3=x2*xi,h1=1-3*x2+2*x3,h2=L*(xi-2*x2+x3),h3=3*x2-2*x3,h4=L*(-x2+x3);
  return h1*v1+h2*t1+h3*v2+h4*t2;
}
function frameDisplacement(local,L,xi,axes){
  const u=lerp(Number(local[0])||0,Number(local[6])||0,xi),v=hermite(Number(local[1])||0,Number(local[5])||0,Number(local[7])||0,Number(local[11])||0,L,xi),w=hermite(Number(local[2])||0,-(Number(local[4])||0),Number(local[8])||0,-(Number(local[10])||0),L,xi),rx=lerp(Number(local[3])||0,Number(local[9])||0,xi);
  const global=add(add(scale(axes.ex,u),scale(axes.ey,v)),scale(axes.ez,w));return{u,v,w,rx,global,ux:global[0],uy:global[1],uz:global[2],umag:norm(global)};
}
function trussDisplacement(d1,d2,xi,axes){
  const global=[0,1,2].map(k=>lerp(Number(d1?.[['ux','uy','uz'][k]])||0,Number(d2?.[['ux','uy','uz'][k]])||0,xi)),u=dot(global,axes.ex),v=dot(global,axes.ey),w=dot(global,axes.ez);
  return{u,v,w,rx:0,global,ux:global[0],uy:global[1],uz:global[2],umag:norm(global)};
}
function referencePoint(axes,xi){return add(axes.a,scale(sub(axes.b,axes.a),xi))}
function nodalLocalDofs(dmap,e,axes){const a=dmap.get(String(e.n1))||{},b=dmap.get(String(e.n2))||{},vec=d=>[Number(d.ux)||0,Number(d.uy)||0,Number(d.uz)||0],rot=d=>[Number(d.rx)||0,Number(d.ry)||0,Number(d.rz)||0],local=v=>[dot(v,axes.ex),dot(v,axes.ey),dot(v,axes.ez)],ta=local(vec(a)),ra=local(rot(a)),tb=local(vec(b)),rb=local(rot(b));return[...ta,...ra,...tb,...rb]}
function frameStations(project,e,force,n,dmap){
  const axes=axesFromResult(project,e,force);if(!axes)return null;const L=axes.length,mat=material(project,e),sec=section(project,e),E=Number(mat.E)||0,nu=Number(mat.nu),G=Number(mat.G)||(E>0&&Number.isFinite(nu)?E/(2*(1+nu)):0),A=prop(e,sec,'A'),Iy=prop(e,sec,'Iy',e.I??sec.I),Iz=prop(e,sec,'Iz',e.I??sec.I),J=prop(e,sec,'J'),loads=sumUniform(force),candidate=force?.localDisplacementsTotal||force?.elementLocalDisplacements||force?.localDisplacements,local=Array.isArray(candidate)&&candidate.length>=12?candidate:nodalLocalDofs(dmap,e,axes),stations=[];
  const N1=Number(force?.N1)||0,Vy1=Number(force?.Vy1)||0,Vz1=Number(force?.Vz1)||0,T1=Number(force?.T1)||0,T2=Number(force?.T2)||0,My1=Number(force?.My1)||0,Mz1=Number(force?.Mz1)||0;
  for(let i=0;i<n;i++){const xi=i/(n-1),x=xi*L,N=-N1-loads.qx*x,Vy=Vy1+loads.qy*x,Vz=Vz1+loads.qz*x,T=lerp(-T1,T2,xi),My=-My1-Vz1*x-loads.qz*x*x/2,Mz=-Mz1+Vy1*x+loads.qy*x*x/2,d=frameDisplacement(local,L,xi,axes),point=referencePoint(axes,xi),epsX=E>0&&A>0?N/(E*A):null,kappaY=E>0&&Iy>0?My/(E*Iy):null,kappaZ=E>0&&Iz>0?Mz/(E*Iz):null,twistRate=G>0&&J>0?T/(G*J):null;stations.push({xi,x,point,deformedPoint:add(point,d.global),...d,N,Vy,Vz,T,My,Mz,epsX,kappaY,kappaZ,twistRate})}
  return{elementId:e.id,type:e.type,axes,properties:{E,G,A,Iy,Iz,J},loads,stations};
}
function trussStations(project,e,force,n,dmap){
  const axes=axesFromResult(project,e,force);if(!axes)return null;const mat=material(project,e),sec=section(project,e),E=Number(mat.E)||0,A=prop(e,sec,'A'),N=Number(force?.axialForce??force?.N2??-force?.N1)||0,epsX=E>0&&A>0?N/(E*A):null,d1=dmap.get(String(e.n1)),d2=dmap.get(String(e.n2)),stations=[];
  for(let i=0;i<n;i++){const xi=i/(n-1),x=xi*axes.length,d=trussDisplacement(d1,d2,xi,axes),point=referencePoint(axes,xi);stations.push({xi,x,point,deformedPoint:add(point,d.global),...d,N,Vy:0,Vz:0,T:0,My:0,Mz:0,epsX,kappaY:0,kappaZ:0,twistRate:0})}
  return{elementId:e.id,type:e.type,axes,properties:{E,A},loads:{qx:0,qy:0,qz:0},stations};
}
export function buildFrameDiagram3D(project={},result={},samples=31){
  const n=Math.max(2,Math.min(201,Math.round(Number(samples)||31))),forces=new Map((result?.elementForces||[]).map(f=>[String(f.elementId),f])),dmap=new Map(displacementRows(result).map(d=>[String(d.nodeId),d])),elements=[];
  for(const e of project.elements||[]){if(!['frame3d','truss3d'].includes(e.type))continue;const force=forces.get(String(e.id));if(!force)continue;const row=e.type==='frame3d'?frameStations(project,e,force,n,dmap):trussStations(project,e,force,n,dmap);if(row)elements.push(row)}
  return{contract:'frame-diagram-3d/v1',samples:n,elements};
}
export function frameDiagramFieldValue3D(station,field){
  const s=station||{};switch(String(field)){
    case'N':return Number(s.N)||0;case'Vy':return Number(s.Vy)||0;case'Vz':return Number(s.Vz)||0;case'V':return Math.hypot(Number(s.Vy)||0,Number(s.Vz)||0);
    case'T':return Number(s.T)||0;case'MyBar':return Number(s.My)||0;case'MzBar':return Number(s.Mz)||0;case'M':return Math.hypot(Number(s.My)||0,Number(s.Mz)||0);
    case'UxBar':return 1000*(Number(s.ux)||0);case'UyBar':return 1000*(Number(s.uy)||0);case'UzBar':return 1000*(Number(s.uz)||0);case'UmagBar':return 1000*(Number(s.umag)||0);
    case'epsX':return 1e6*(Number(s.epsX)||0);case'kappaY':return Number(s.kappaY)||0;case'kappaZ':return Number(s.kappaZ)||0;case'twistRate':return Number(s.twistRate)||0;default:return 0;
  }
}
export function frameDiagramRange3D(scene,field){
  const values=[];let minPoint=null,maxPoint=null;for(const e of scene?.elements||[])for(const s of e.stations||[]){const value=frameDiagramFieldValue3D(s,field);if(!Number.isFinite(value))continue;values.push(value);if(!minPoint||value<minPoint.value)minPoint={elementId:e.elementId,station:s,value};if(!maxPoint||value>maxPoint.value)maxPoint={elementId:e.elementId,station:s,value}}
  if(!values.length)return{min:0,max:0,maxAbs:0,minPoint:null,maxPoint:null};const min=Math.min(...values),max=Math.max(...values);return{min,max,maxAbs:Math.max(Math.abs(min),Math.abs(max)),minPoint,maxPoint};
}

function segmentProjection(px,py,a,b){
  const vx=(Number(b?.x)||0)-(Number(a?.x)||0),vy=(Number(b?.y)||0)-(Number(a?.y)||0),wx=px-(Number(a?.x)||0),wy=py-(Number(a?.y)||0),d=vx*vx+vy*vy,t=d>EPS?Math.max(0,Math.min(1,(wx*vx+wy*vy)/d)):0,x=(Number(a?.x)||0)+t*vx,y=(Number(a?.y)||0)+t*vy;
  return{t,x,y,distance:Math.hypot(px-x,py-y)};
}
export function probeProjectedFrameDiagram3D(items=[],px=0,py=0,threshold=14){
  let best=null;
  for(const item of items||[]){const pts=(item?.points||[]).filter(p=>p?.pOffset?.visible!==false&&Number.isFinite(Number(p?.pOffset?.x))&&Number.isFinite(Number(p?.pOffset?.y)));for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],q=segmentProjection(Number(px)||0,Number(py)||0,a.pOffset,b.pOffset);if(q.distance>threshold||best&&q.distance>=best.distance)continue;const t=q.t,interp=(k,f=0)=>lerp(Number(a?.[k])||f,Number(b?.[k])||f,t),baseX=lerp(Number(a?.pBase?.x)||0,Number(b?.pBase?.x)||0,t),baseY=lerp(Number(a?.pBase?.y)||0,Number(b?.pBase?.y)||0,t);best={elementId:String(item?.e?.id??item?.row?.elementId??''),segmentIndex:i-1,distance:q.distance,screen:{x:q.x,y:q.y},baseScreen:{x:baseX,y:baseY},xi:interp('xi'),x:interp('x'),value:interp('value'),stationA:a,stationB:b,t}}}
  return best;
}
export function probeProjectedFrameEnvelope3D(items=[],px=0,py=0,threshold=16,activeScene=null,field='M'){
  let best=null;const activeByElement=new Map((activeScene?.elements||[]).map(e=>[String(e.elementId),e]));
  for(const item of items||[]){const pts=item?.points||[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];for(const branch of ['pMin','pMax']){if(a?.[branch]?.visible===false||b?.[branch]?.visible===false)continue;const q=segmentProjection(Number(px)||0,Number(py)||0,a[branch],b[branch]);if(q.distance>threshold||best&&q.distance>=best.distance)continue;const index=q.t<.5?i-1:i,s=pts[index],elementId=String(item?.e?.id??item?.row?.elementId??''),activeRow=activeByElement.get(elementId),activeStation=activeRow?.stations?.[index],activeValue=activeStation?frameDiagramFieldValue3D(activeStation,field):null,min=Number(s?.env?.min),max=Number(s?.env?.max);best={elementId,stationIndex:index,distance:q.distance,branch:branch==='pMin'?'min':'max',screen:{x:Number(s?.[branch]?.x)||0,y:Number(s?.[branch]?.y)||0},baseScreen:{x:Number(s?.pBase?.x)||0,y:Number(s?.pBase?.y)||0},minScreen:{x:Number(s?.pMin?.x)||0,y:Number(s?.pMin?.y)||0},maxScreen:{x:Number(s?.pMax?.x)||0,y:Number(s?.pMax?.y)||0},xi:Number(s?.xi)||0,x:Number(s?.x)||0,min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null,minCombinationId:s?.env?.minCombinationId||null,maxCombinationId:s?.env?.maxCombinationId||null,governingCombinationId:s?.env?.governingCombinationId||null,activeValue:Number.isFinite(Number(activeValue))?Number(activeValue):null,station:s}}}}
  return best;
}
function emptyEnv(){return{min:null,max:null,absMax:null,minCombinationId:null,maxCombinationId:null,governingCombinationId:null}}
function extendEnv(env,value,combinationId){const v=Number(value);if(!Number.isFinite(v))return;if(env.min==null||v<env.min){env.min=v;env.minCombinationId=combinationId}if(env.max==null||v>env.max){env.max=v;env.maxCombinationId=combinationId}if(env.absMax==null||Math.abs(v)>Math.abs(env.absMax)){env.absMax=v;env.governingCombinationId=combinationId}}
export function buildFrameDiagramEnvelope3D(project={},solvedEntries=[],samples=31){
  const n=Math.max(2,Math.min(201,Math.round(Number(samples)||31))),byElement=new Map(),scenarioIds=[];
  for(let i=0;i<(solvedEntries||[]).length;i++){const entry=solvedEntries[i]||{},result=entry.result||entry,combinationId=String(entry.combinationId||entry.id||result?.scenario?.id||`scenario-${i+1}`);if(!Array.isArray(result?.elementForces))continue;scenarioIds.push(combinationId);const scene=buildFrameDiagram3D(project,result,n);for(const row of scene.elements||[]){let env=byElement.get(String(row.elementId));if(!env){env={elementId:String(row.elementId),type:row.type,axes:row.axes,stations:(row.stations||[]).map(s=>({xi:s.xi,x:s.x,point:s.point,fields:Object.fromEntries(FRAME_DIAGRAM_FIELDS.map(f=>[f,emptyEnv()]))}))};byElement.set(String(row.elementId),env)}(row.stations||[]).forEach((s,k)=>{const target=env.stations[k];if(!target)return;for(const field of FRAME_DIAGRAM_FIELDS)extendEnv(target.fields[field],frameDiagramFieldValue3D(s,field),combinationId)})}}
  return{contract:'frame-diagram-envelope-3d/v1',samples:n,scenarioIds,elements:[...byElement.values()]};
}
export function frameDiagramEnvelopeRange3D(envelope,field){
  let min=Infinity,max=-Infinity,absMax=0,minPoint=null,maxPoint=null,absPoint=null;for(const e of envelope?.elements||[])for(const s of e.stations||[]){const env=s?.fields?.[field];if(!env)continue;const lo=Number(env.min),hi=Number(env.max),hasLo=Number.isFinite(lo),hasHi=Number.isFinite(hi);if(hasLo&&lo<min){min=lo;minPoint={elementId:e.elementId,station:s,value:lo,combinationId:env.minCombinationId}}if(hasHi&&hi>max){max=hi;maxPoint={elementId:e.elementId,station:s,value:hi,combinationId:env.maxCombinationId}}let candidate=null,combinationId=null;if(Number.isFinite(Number(env.absMax))){candidate=Number(env.absMax);combinationId=env.governingCombinationId}else if(hasLo||hasHi){const useLo=hasLo&&(!hasHi||Math.abs(lo)>=Math.abs(hi));candidate=useLo?lo:hi;combinationId=useLo?env.minCombinationId:env.maxCombinationId}if(candidate!=null&&Math.abs(candidate)>absMax){absMax=Math.abs(candidate);absPoint={elementId:e.elementId,station:s,value:candidate,combinationId}}}
  if(min===Infinity)min=0;if(max===-Infinity)max=0;return{min,max,maxAbs:absMax,minPoint,maxPoint,absPoint};
}
