import {createSurfaceMesh} from './meshModel.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`MeshGenerator: ${name} deve ser finito.`);return n};
const count=(name,value,max=500)=>{const n=Math.round(finite(name,value));if(n<1||n>max)throw new Error(`MeshGenerator: ${name} deve estar entre 1 e ${max}.`);return n};
const p3=(p,label)=>({id:p?.id!=null?String(p.id):null,x:finite(`${label}.x`,p?.x),y:finite(`${label}.y`,p?.y),z:finite(`${label}.z`,p?.z??0)});

function bilinear(corners,u,v){const N=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v],out={x:0,y:0,z:0};for(let i=0;i<4;i++){out.x+=N[i]*corners[i].x;out.y+=N[i]*corners[i].y;out.z+=N[i]*corners[i].z}return out}
function uniqueId(base,used){let id=String(base),i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}

export function createBilinearPatchMesh({id='patch',corners,divisionsU=1,divisionsV=1,nodePrefix='MN',cellPrefix='MC',group=null}={}){
  const c=Array.from(corners||[],(p,i)=>p3(p,`corner[${i}]`));if(c.length!==4)throw new Error('MeshGenerator: patch bilinear requer 4 cantos [00,10,11,01].');const nu=count('divisionsU',divisionsU),nv=count('divisionsV',divisionsV),usedNodes=new Set(c.filter(p=>p.id).map(p=>p.id)),nodes=[],grid=Array.from({length:nv+1},()=>Array(nu+1));
  const cornerAt=(i,j)=>i===0&&j===0?0:i===nu&&j===0?1:i===nu&&j===nv?2:i===0&&j===nv?3:null;
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
    const cornerIndex=cornerAt(i,j),q=bilinear(c,i/nu,j/nv),base=cornerIndex!=null&&c[cornerIndex].id?c[cornerIndex].id:`${nodePrefix}_${i}_${j}`,nodeId=uniqueId(base,usedNodes);grid[j][i]=nodeId;nodes.push({id:nodeId,...q,...(group!=null?{group}:{}),meta:{u:i/nu,v:j/nv}})
  }
  const cells=[];for(let j=0;j<nv;j++)for(let i=0;i<nu;i++)cells.push({id:`${cellPrefix}_${i}_${j}`,type:'quad4',nodeIds:[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]],...(group!=null?{group}:{}),meta:{i,j}});
  return createSurfaceMesh({id,nodes,cells,metadata:{generator:'bilinear-patch',divisionsU:nu,divisionsV:nv}});
}

function newell(points){let n=[0,0,0];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];n[0]+=(p.y-q.y)*(p.z+q.z);n[1]+=(p.z-q.z)*(p.x+q.x);n[2]+=(p.x-q.x)*(p.y+q.y)}return n}
function projected(points){const n=newell(points),axis=Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;return points.map(p=>axis===0?[p.y,p.z]:axis===1?[p.x,p.z]:[p.x,p.y])}
function signedArea2D(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1]}return a/2}
function cross2(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function inTriangle(p,a,b,c,tol=1e-12){const x1=cross2(a,b,p),x2=cross2(b,c,p),x3=cross2(c,a,p);return x1>=-tol&&x2>=-tol&&x3>=-tol}

export function triangulatePlanarPolygon({id='polygon-mesh',vertices,nodePrefix='PN',cellPrefix='PT',group=null,tolerance=1e-10}={}){
  let nodes=Array.from(vertices||[],(p,i)=>{const q=p3(p,`vertex[${i}]`);return{id:q.id||`${nodePrefix}_${i+1}`,x:q.x,y:q.y,z:q.z,...(group!=null?{group}: {})}});if(nodes.length<3)throw new Error('MeshGenerator: polígono requer ao menos 3 vértices.');if(new Set(nodes.map(n=>n.id)).size!==nodes.length)throw new Error('MeshGenerator: ids de vértices duplicados.');
  const nvec=newell(nodes),nNorm=Math.hypot(...nvec);if(!(nNorm>tolerance))throw new Error('MeshGenerator: polígono degenerado.');const unit=nvec.map(v=>v/nNorm),origin=nodes[0],maxPlane=Math.max(...nodes.map(p=>Math.abs((p.x-origin.x)*unit[0]+(p.y-origin.y)*unit[1]+(p.z-origin.z)*unit[2])));if(maxPlane>tolerance)throw new Error(`MeshGenerator: polígono não planar; desvio ${maxPlane}.`);
  let xy=projected(nodes);if(signedArea2D(xy)<0){nodes=[...nodes].reverse();xy=[...xy].reverse()}
  const indices=nodes.map((_,i)=>i),triangles=[];let guard=0;while(indices.length>3&&guard++<nodes.length*nodes.length){let clipped=false;for(let k=0;k<indices.length;k++){
    const ia=indices[(k+indices.length-1)%indices.length],ib=indices[k],ic=indices[(k+1)%indices.length],a=xy[ia],b=xy[ib],c=xy[ic];if(cross2(a,b,c)<=tolerance)continue;const contains=indices.some(j=>j!==ia&&j!==ib&&j!==ic&&inTriangle(xy[j],a,b,c,tolerance));if(contains)continue;triangles.push([ia,ib,ic]);indices.splice(k,1);clipped=true;break
  }if(!clipped)throw new Error('MeshGenerator: triangulação ear-clipping falhou; verifique auto-interseção/degeneração.')}
  if(indices.length===3)triangles.push([...indices]);if(triangles.length!==nodes.length-2)throw new Error('MeshGenerator: triangulação incompleta.');
  const cells=triangles.map((tri,i)=>({id:`${cellPrefix}_${i+1}`,type:'tri3',nodeIds:tri.map(j=>nodes[j].id),...(group!=null?{group}: {})}));return createSurfaceMesh({id,nodes,cells,metadata:{generator:'ear-clipping',polygonVertices:nodes.length}});
}
