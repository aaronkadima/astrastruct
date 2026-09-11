import { sectionDepth } from '../core/model.js';

const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function hermiteTransverse(phi1,phi2,L,xi){
  const x2=xi*xi,x3=x2*xi,h2=L*(xi-2*x2+x3),h4=L*(-x2+x3);
  return h2*phi1+h4*phi2;
}

function hermiteSlope(phi1,phi2,xi){
  const dh2=1-4*xi+3*xi*xi,dh4=-2*xi+3*xi*xi;
  return dh2*phi1+dh4*phi2;
}

function currentUniformLoad(force,L0,l,c,s){
  const ref=force.loadSummary?.reference,global=ref?.globalPerReferenceLength;
  if(!global||!(l>1e-12))return{qx:0,qy:0,gx:0,gy:0,scale:1,mode:force.loadSummary?.mode||'none'};
  const gx=num(global.x),gy=num(global.y),scale=L0/l;
  return{qx:(c*gx+s*gy)*scale,qy:(-s*gx+c*gy)*scale,gx,gy,scale,mode:force.loadSummary?.mode||'reference-dead'};
}

export function buildCorotationalResponses(project,result,samples=41){
  const count=Math.max(2,Math.min(201,Math.round(samples))),disp=new Map((result.displacements||[]).map(d=>[d.nodeId,d])),forces=new Map((result.elementForces||[]).map(f=>[f.elementId,f])),responses=[];
  for(const e of project.elements||[]){
    if(e.type!=='frame2d')continue;const a=project.nodes.find(n=>n.id===e.n1),b=project.nodes.find(n=>n.id===e.n2),f=forces.get(e.id);if(!a||!b||!f)continue;
    const da=disp.get(a.id)||{ux:0,uy:0,rz:0},db=disp.get(b.id)||{ux:0,uy:0,rz:0},x1=num(a.x)+num(da.ux),y1=num(a.y)+num(da.uy),x2=num(b.x)+num(db.ux),y2=num(b.y)+num(db.uy),dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),L0=Math.hypot(num(b.x)-num(a.x),num(b.y)-num(a.y));
    if(!(l>1e-12&&L0>1e-12))continue;
    const c=dx/l,s=dy/l,basic=f.corotational?.basic||[l-L0,0,0],phi1=num(basic[1]),phi2=num(basic[2]),load=currentUniformLoad(f,L0,l,c,s),qx=load.qx,qy=load.qy,N1=num(f.N1),V1=num(f.V1),M1=num(f.M1),N2=num(f.N2),V2=num(f.V2),M2=num(f.M2),stations=[];
    const sec=(project.sections||[]).find(x=>x.id===e.sectionId),depth=sectionDepth(sec),cY=depth/2,A=num(e.A),I=num(e.I),flexuralStressAvailable=cY>0&&I>0;
    for(let i=0;i<count;i++){
      const xi=i/(count-1),xc=xi*l,w=hermiteTransverse(phi1,phi2,l,xi),slope=hermiteSlope(phi1,phi2,xi),xd=x1+c*xc-s*w,yd=y1+s*xc+c*w,x0=num(a.x)+xi*(num(b.x)-num(a.x)),y0=num(a.y)+xi*(num(b.y)-num(a.y));
      const N=-N1-qx*xc,V=V1+qy*xc,M=-M1+V1*xc+qy*xc*xc/2,sigmaAxial=A>0?N/A/1000:null,sigmaB=flexuralStressAvailable?M*cY/I/1000:null,sigmaTop=sigmaB==null?null:sigmaAxial-sigmaB,sigmaBottom=sigmaB==null?null:sigmaAxial+sigmaB,sigmaAbs=sigmaB==null?(sigmaAxial==null?null:Math.abs(sigmaAxial)):Math.max(Math.abs(sigmaTop),Math.abs(sigmaBottom));
      stations.push({xi,x:xi*L0,xCurrent:xc,N,V,M,x0,y0,xd,yd,ux:xd-x0,uy:yd-y0,uLocal:xi*(l-L0),vLocal:w,rotationRelative:slope,sigmaAxial,sigmaTop,sigmaBottom,sigmaAbs});
    }
    const end=stations.at(-1),equilibriumResidual={N:num(end?.N)-N2,V:num(end?.V)+V2,M:num(end?.M)-M2},equilibriumResidualAbs=Math.max(...Object.values(equilibriumResidual).map(Math.abs));
    responses.push({elementId:e.id,type:'frame2d-corotational',L:L0,currentLength:l,c,s,currentGeometry:true,qx,qy,loadModel:load.mode,referenceLoad:{globalPerReferenceLength:{x:load.gx,y:load.gy},currentScale:load.scale,uniform:f.loadSummary?.uniform||{qx:0,qy:0},selfWeight:num(f.loadSummary?.selfWeight)},loadRecovery:{equilibriumResidual,equilibriumResidualAbs},stress:{available:flexuralStressAvailable,axialOnly:!flexuralStressAvailable,cY,unit:'MPa'},convention:{N:'tração positiva',V:'+y co-rotante positivo',M:'sagente positivo',stress:'tração positiva'},stations});
  }
  return responses;
}

export function corotationalResponseExtrema(response){
  const fields=['N','V','M','uLocal','vLocal','ux','uy','sigmaAxial','sigmaTop','sigmaBottom','sigmaAbs'],out={};
  for(const field of fields){const vals=(response.stations||[]).map(s=>Number(s[field])).filter(Number.isFinite);out[field]=vals.length?{min:Math.min(...vals),max:Math.max(...vals),abs:Math.max(...vals.map(Math.abs))}:{min:null,max:null,abs:null}}
  return out;
}
