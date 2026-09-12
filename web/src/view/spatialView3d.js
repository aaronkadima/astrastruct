const EPS=1e-12;
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const v3=(x=0,y=0,z=0)=>[Number(x)||0,Number(y)||0,Number(z)||0];
export const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm3=a=>Math.hypot(a[0],a[1],a[2]);
export const unit3=a=>{const n=norm3(a);return n>EPS?scale3(a,1/n):[0,0,0]};
export const nodePoint=n=>v3(n?.x,n?.y,n?.z);

export function bounds3D(project={}){
  const nodes=project.nodes||[];if(!nodes.length)return{min:[-1,-1,-1],max:[1,1,1],center:[0,0,0],span:[2,2,2],radius:1.732};
  const pts=nodes.map(nodePoint),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of pts)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
  const center=min.map((v,k)=>(v+max[k])/2),span=min.map((v,k)=>Math.max(0,max[k]-v)),radius=Math.max(.5,.5*Math.hypot(...span));
  return{min,max,center,span,radius};
}
export function characteristicLength3D(project={}){const b=bounds3D(project);return Math.max(1,b.span[0],b.span[1],b.span[2],2*b.radius)}

const presets={
  iso:{yaw:Math.PI/4,pitch:Math.PI/6},
  xy:{yaw:0,pitch:Math.PI/2-1e-5},
  xz:{yaw:Math.PI/2,pitch:0},
  yz:{yaw:0,pitch:0},
};
export function fitCamera3D(project={},preset='iso',projection='perspective'){
  const b=bounds3D(project),p=presets[preset]||presets.iso;
  return{target:[...b.center],yaw:p.yaw,pitch:p.pitch,distance:Math.max(2,b.radius*3.5),orthoScale:Math.max(2,b.radius*2.7),zoom:1,fov:42,projection,preset};
}
export function applyCameraPreset3D(camera,project,preset){const next=fitCamera3D(project,preset,camera?.projection||'perspective');return{...next,zoom:camera?.zoom||1,projection:camera?.projection||next.projection}}
export function cameraBasis3D(camera){
  const cp=Math.cos(camera.pitch),n=unit3([cp*Math.cos(camera.yaw),cp*Math.sin(camera.yaw),Math.sin(camera.pitch)]),forward=scale3(n,-1),upRef=Math.abs(dot3(n,[0,0,1]))>.96?[0,1,0]:[0,0,1],right=unit3(cross3(upRef,n)),up=unit3(cross3(n,right)),position=add3(camera.target,scale3(n,camera.distance));
  return{position,right,up,forward,back:n};
}
export function projectPoint3D(point,camera,viewport={width:1000,height:680}){
  const {position,right,up,forward}=cameraBasis3D(camera),v=sub3(point,position),x=dot3(v,right),y=dot3(v,up),depth=dot3(v,forward),w=Math.max(1,viewport.width),h=Math.max(1,viewport.height);
  if(camera.projection==='orthographic'){
    const px=Math.min(w,h)/Math.max(EPS,camera.orthoScale)*camera.zoom;return{x:w/2+x*px,y:h/2-y*px,depth,visible:true,scale:px};
  }
  if(depth<=1e-6)return{x:NaN,y:NaN,depth,visible:false,scale:0};
  const focal=.5*h/Math.tan((camera.fov||42)*Math.PI/360)*camera.zoom,scale=focal/depth;return{x:w/2+x*scale,y:h/2-y*scale,depth,visible:true,scale};
}
export function worldPerPixel3D(camera,viewport={width:1000,height:680}){
  const h=Math.max(1,viewport.height);if(camera.projection==='orthographic')return camera.orthoScale/(h*Math.max(.05,camera.zoom));return 2*camera.distance*Math.tan((camera.fov||42)*Math.PI/360)/(h*Math.max(.05,camera.zoom));
}
export function panCamera3D(camera,dxPx,dyPx,viewport){const b=cameraBasis3D(camera),s=worldPerPixel3D(camera,viewport),delta=add3(scale3(b.right,-dxPx*s),scale3(b.up,dyPx*s));return{...camera,target:add3(camera.target,delta),preset:'custom'}}
export function orbitCamera3D(camera,dxPx,dyPx){return{...camera,yaw:camera.yaw-dxPx*.008,pitch:clamp(camera.pitch+dyPx*.008,-Math.PI*.495,Math.PI*.495),preset:'custom'}}

export function elementAxes3D(project,e){
  const a=(project.nodes||[]).find(n=>n.id===e.n1),b=(project.nodes||[]).find(n=>n.id===e.n2);if(!a||!b)return null;const pa=nodePoint(a),pb=nodePoint(b),ex=unit3(sub3(pb,pa));if(norm3(ex)<EPS)return null;
  let ref=Array.isArray(e.orientation?.up)?v3(...e.orientation.up):[0,0,1];if(norm3(ref)<EPS||Math.abs(dot3(unit3(ref),ex))>.98)ref=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];
  const ey=unit3(sub3(ref,scale3(ex,dot3(ref,ex)))),ez=unit3(cross3(ex,ey));return{ex,ey,ez,length:norm3(sub3(pb,pa)),a:pa,b:pb};
}
export function localVectorToGlobal3D(project,e,local){const ax=elementAxes3D(project,e);if(!ax)return[0,0,0];return add3(add3(scale3(ax.ex,Number(local?.[0])||0),scale3(ax.ey,Number(local?.[1])||0)),scale3(ax.ez,Number(local?.[2])||0))}

function fieldMap(rows=[]){return new Map(rows.map(d=>[d.nodeId,v3(d.ux,d.uy,d.uz)]))}
export function resolveShapeField3D(result,bucklingView,modeIndex=0){
  const buckMode=bucklingView?.result?.dimension==='3d'?bucklingView.result.modes?.[bucklingView.modeIndex??modeIndex]:null;if(buckMode)return{kind:'buckling',label:`Flambagem · modo ${buckMode.mode??(modeIndex+1)}`,map:fieldMap(buckMode.displacements),mode:buckMode};
  if(result?.dimension==='3d'&&result?.analysisType==='modal'){
    const modes=result.modal?.modes||result.modes||[],mode=modes[Math.max(0,Math.min(modes.length-1,modeIndex))];if(mode)return{kind:'modal',label:`Modo ${mode.mode??(modeIndex+1)}`,map:fieldMap(mode.displacements),mode};
  }
  const hasImperfection=!!(result?.pDelta?.imperfection?.enabled||result?.nonlinear?.imperfection?.enabled);
  if(result?.dimension==='3d'&&Array.isArray(result.totalDisplacements)&&hasImperfection)return{kind:'deformed',label:'Deformada total · u₀ + Δu',map:fieldMap(result.totalDisplacements),mode:null};
  if(result?.dimension==='3d'&&Array.isArray(result.displacements))return{kind:'deformed',label:'Deformada',map:fieldMap(result.displacements),mode:null};
  return{kind:'model',label:'Modelo',map:new Map(),mode:null};
}
export function maxFieldMagnitude3D(field){let m=0;for(const v of field?.values?.()||[])m=Math.max(m,norm3(v));return m}
export function displacedPoint3D(node,field,scale=1,phase=1){const p=nodePoint(node),d=field?.get?.(node.id)||[0,0,0];return add3(p,scale3(d,scale*phase))}
export function elementResultScalar3D(result,elementId,kind='none'){
  if(kind==='none')return 0;const f=(result?.elementForces||[]).find(x=>x.elementId===elementId);if(!f)return 0;
  if(kind==='N')return Math.max(Math.abs(Number(f.N1??f.axialForce)||0),Math.abs(Number(f.N2??f.axialForce)||0));
  if(kind==='V')return Math.max(Math.hypot(Number(f.Vy1)||0,Number(f.Vz1)||0),Math.hypot(Number(f.Vy2)||0,Number(f.Vz2)||0));
  if(kind==='M')return Math.max(Math.hypot(Number(f.My1)||0,Number(f.Mz1)||0),Math.hypot(Number(f.My2)||0,Number(f.Mz2)||0));
  if(kind==='T')return Math.max(Math.abs(Number(f.T1)||0),Math.abs(Number(f.T2)||0));return 0;
}
export function niceGridStep3D(length){const raw=Math.max(1e-6,length/8),pow=10**Math.floor(Math.log10(raw)),n=raw/pow,base=n<1.5?1:n<3.5?2:n<7.5?5:10;return base*pow}
