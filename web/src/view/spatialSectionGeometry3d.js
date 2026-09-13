import {add3,cross3,dot3,norm3,nodePoint,scale3,sub3,unit3,v3} from './spatialView3d.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const positive=(v,f)=>{const x=finite(v);return x>EPS?x:f};

function nodeById(project,id){return(project?.nodes||[]).find(n=>n.id===id)||null}
function axesFromEndpoints(e,a,b){
  const ex=unit3(sub3(b,a));if(norm3(ex)<EPS)return null;
  let ref=Array.isArray(e?.orientation?.up)?v3(...e.orientation.up):[0,0,1];
  if(norm3(ref)<EPS||Math.abs(dot3(unit3(ref),ex))>.98)ref=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];
  const ey=unit3(sub3(ref,scale3(ex,dot3(ref,ex)))),ez=unit3(cross3(ex,ey));
  return{a,b,ex,ey,ez,length:norm3(sub3(b,a))};
}
function face(id,points,kind='side'){return{id,points,kind,center:points.reduce((a,p)=>add3(a,scale3(p,1/points.length)),[0,0,0])}}

export function resolveSectionDimensions3D(project,e){
  const sec=(project?.sections||[]).find(s=>s.id===e?.sectionId)||{};
  const A=positive(sec.A,0),fallback=A>EPS?Math.sqrt(A):.12;
  let b=positive(sec.b??sec.width??sec.B,fallback),h=positive(sec.h??sec.height??sec.depth??sec.H,fallback);
  if(e?.type==='truss3d'){
    const d=positive(sec.d??sec.diameter,A>EPS?Math.sqrt(4*A/Math.PI):fallback);b=d;h=d;
  }
  return{b,h,A,section:sec};
}

/** Rectangular true-section prism for frame/truss visualization. h follows local ey; b follows local ez. */
export function frameSectionPrism3D(project,e,{a=null,b=null}={}){
  const na=nodeById(project,e?.n1),nb=nodeById(project,e?.n2),pa=a||nodePoint(na),pb=b||nodePoint(nb);if(!na||!nb||!pa||!pb)return null;
  const ax=axesFromEndpoints(e,pa,pb);if(!ax)return null;const dim=resolveSectionDimensions3D(project,e),hy=dim.h/2,hz=dim.b/2;
  const corner=(p,sy,sz)=>add3(add3(p,scale3(ax.ey,sy*hy)),scale3(ax.ez,sz*hz));
  const a00=corner(pa,-1,-1),a10=corner(pa,1,-1),a11=corner(pa,1,1),a01=corner(pa,-1,1),b00=corner(pb,-1,-1),b10=corner(pb,1,-1),b11=corner(pb,1,1),b01=corner(pb,-1,1);
  return{
    type:'frame-section-prism-3d',elementId:e.id,sectionId:e.sectionId,dimensions:dim,axes:ax,
    corners:{a00,a10,a11,a01,b00,b10,b11,b01},
    faces:[
      face(`${e.id}:start`,[a00,a01,a11,a10],'end'),face(`${e.id}:end`,[b00,b10,b11,b01],'end'),
      face(`${e.id}:y-`,[a00,b00,b01,a01]),face(`${e.id}:y+`,[a10,a11,b11,b10]),
      face(`${e.id}:z-`,[a00,a10,b10,b00]),face(`${e.id}:z+`,[a01,b01,b11,a11])
    ]
  };
}

function shellIds(e){return Array.isArray(e?.nodeIds)&&e.nodeIds.length>=4?e.nodeIds.slice(0,4):[e?.n1,e?.n2,e?.n3,e?.n4]}
export function resolveShellThickness3D(project,e){
  const sec=(project?.sections||[]).find(s=>s.id===e?.sectionId)||{};return positive(e?.thickness??e?.t??sec.thickness??sec.t,.15);
}

/** Solid slab/shell visualization using its actual thickness around the midsurface. */
export function shellSectionPrism3D(project,e,{points=null}={}){
  const ids=shellIds(e),base=points||ids.map(id=>nodeById(project,id)).map(nodePoint);if(base.length<4||base.some(p=>!p))return null;
  const n=unit3(cross3(sub3(base[1],base[0]),sub3(base[3],base[0])));if(norm3(n)<EPS)return null;const t=resolveShellThickness3D(project,e),off=scale3(n,t/2),top=base.map(p=>add3(p,off)),bottom=base.map(p=>sub3(p,off));
  return{
    type:'shell-section-prism-3d',elementId:e.id,thickness:t,normal:n,nodeIds:ids,
    top,bottom,
    faces:[face(`${e.id}:top`,top,'top'),face(`${e.id}:bottom`,[bottom[3],bottom[2],bottom[1],bottom[0]],'bottom'),...Array.from({length:4},(_,i)=>{const j=(i+1)%4;return face(`${e.id}:edge${i+1}`,[bottom[i],bottom[j],top[j],top[i]],'edge')})]
  };
}

export function trueSectionScene3D(project,{pointForNode=null}={}){
  const point=id=>{const n=nodeById(project,id);return pointForNode?pointForNode(n):nodePoint(n)},frames=[],shells=[];
  for(const e of project?.elements||[]){
    if(e.type==='frame3d'||e.type==='truss3d'){const g=frameSectionPrism3D(project,e,{a:point(e.n1),b:point(e.n2)});if(g)frames.push(g)}
    else if(e.type==='shell4'){const g=shellSectionPrism3D(project,e,{points:shellIds(e).map(point)});if(g)shells.push(g)}
  }
  return{frames,shells,faces:[...frames.flatMap(x=>x.faces.map(f=>({...f,elementId:x.elementId,geometryType:'frame'}))),...shells.flatMap(x=>x.faces.map(f=>({...f,elementId:x.elementId,geometryType:'shell'})))]};
}
