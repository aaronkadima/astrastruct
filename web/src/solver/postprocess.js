import { sectionDepth } from '../core/model.js';

function hermite(local,L,xi){
  const u=(1-xi)*local[0]+xi*local[3],x2=xi*xi,x3=x2*xi;
  const h1=1-3*x2+2*x3,h2=L*(xi-2*x2+x3),h3=3*x2-2*x3,h4=L*(-x2+x3);
  return{u,v:h1*local[1]+h2*local[2]+h3*local[4]+h4*local[5]};
}

function frameResponse(project,element,force,samples){
  const a=project.nodes.find(n=>n.id===element.n1),b=project.nodes.find(n=>n.id===element.n2);if(!a||!b)return null;
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>0))return null;const c=dx/L,s=dy/L;
  const summary=force.loadSummary||{uniform:{qx:0,qy:0},points:[],thermal:{}},qx=summary.uniform?.qx||0,qy=summary.uniform?.qy||0,points=summary.points||[];
  const local=force.localDisplacementsTotal||force.localDisplacements||[0,0,0,0,0,0],stations=[];
  const section=(project.sections||[]).find(sec=>sec.id===element.sectionId),depth=sectionDepth(section),cY=depth/2,A=Number(element.A)||0,I=Number(element.I)||0;
  const flexuralStressAvailable=cY>0&&I>0;
  for(let i=0;i<samples;i++){
    const xi=i/(samples-1),x=xi*L;
    let N=-(force.N1||0)-qx*x,V=(force.V1||0)+qy*x,M=-(force.M1||0)+(force.V1||0)*x+qy*x*x/2;
    for(const p of points){
      if(x+1e-12>=p.a){N-=p.px||0;V+=p.py||0;M+=(p.py||0)*(x-p.a)}
    }
    const d=hermite(local,L,xi),du=c*d.u-s*d.v,dv=s*d.u+c*d.v;
    const sigmaAxial=A>0?N/A/1000:null;
    const sigmaB=flexuralStressAvailable?M*cY/I/1000:null;
    const sigmaTop=sigmaB==null?null:sigmaAxial-sigmaB;
    const sigmaBottom=sigmaB==null?null:sigmaAxial+sigmaB;
    const sigmaAbs=sigmaB==null?(sigmaAxial==null?null:Math.abs(sigmaAxial)):Math.max(Math.abs(sigmaTop),Math.abs(sigmaBottom));
    stations.push({xi,x,N,V,M,uLocal:d.u,vLocal:d.v,x0:a.x+xi*dx,y0:a.y+xi*dy,ux:du,uy:dv,sigmaAxial,sigmaTop,sigmaBottom,sigmaAbs});
  }
  return{elementId:element.id,type:'frame2d',L,c,s,qx,qy,pointLoads:points,thermal:summary.thermal||{},stress:{available:flexuralStressAvailable,axialOnly:!flexuralStressAvailable,cY,unit:'MPa'},convention:{N:'tração positiva',V:'+y local positivo',M:'sagente positivo',stress:'tração positiva'},stations};
}

function trussResponse(project,element,force,samples){
  const a=project.nodes.find(n=>n.id===element.n1),b=project.nodes.find(n=>n.id===element.n2);if(!a||!b)return null;
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(!(L>0))return null;const c=dx/L,s=dy/L,disp=new Map((project.__resultDisplacements||[]).map(d=>[d.nodeId,d])),da=disp.get(a.id)||{ux:0,uy:0},db=disp.get(b.id)||{ux:0,uy:0},stations=[];
  const A=Number(element.A)||0,sigma=A>0?(Number(force.N)||0)/A/1000:null;
  for(let i=0;i<samples;i++){const xi=i/(samples-1),x=xi*L,ux=(1-xi)*da.ux+xi*db.ux,uy=(1-xi)*da.uy+xi*db.uy;stations.push({xi,x,N:force.N||0,V:0,M:0,x0:a.x+xi*dx,y0:a.y+xi*dy,ux,uy,uLocal:c*ux+s*uy,vLocal:-s*ux+c*uy,sigmaAxial:sigma,sigmaTop:sigma,sigmaBottom:sigma,sigmaAbs:sigma==null?null:Math.abs(sigma)})}
  return{elementId:element.id,type:'truss2d',L,c,s,qx:0,qy:0,pointLoads:[],thermal:{eps0:force.thermalStrain||0,kappa0:0},stress:{available:A>0,axialOnly:true,cY:0,unit:'MPa'},convention:{N:'tração positiva',stress:'tração positiva'},stations};
}

export function buildElementResponses(project,result,samples=41){
  const n=Math.max(2,Math.min(201,Math.round(samples))),forceMap=new Map((result.elementForces||[]).map(f=>[f.elementId,f])),enrichedProject={...project,__resultDisplacements:result.totalDisplacements||result.displacements||[]};
  return(project.elements||[]).map(element=>{const force=forceMap.get(element.id);if(!force)return null;return element.type==='frame2d'?frameResponse(enrichedProject,element,force,n):trussResponse(enrichedProject,element,force,n)}).filter(Boolean);
}

export function responseExtrema(response){
  const fields=['N','V','M','uLocal','vLocal','ux','uy','sigmaAxial','sigmaTop','sigmaBottom','sigmaAbs'],extrema={};
  for(const field of fields){const vals=response.stations.map(p=>Number(p[field])).filter(Number.isFinite);if(!vals.length){extrema[field]={min:null,max:null,abs:null};continue}extrema[field]={min:Math.min(...vals),max:Math.max(...vals),abs:Math.max(...vals.map(Math.abs))}}
  return extrema;
}
