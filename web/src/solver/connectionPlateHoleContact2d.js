import {zeros,solveLinear} from './matrix.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GAUSS=1/Math.sqrt(3);
const GPS=[[-GAUSS,-GAUSS,1],[GAUSS,-GAUSS,1],[GAUSS,GAUSS,1],[-GAUSS,GAUSS,1]];

export const DEFAULT_CONNECTION_PLATE_HOLE_CONTACT={
  length:.50,width:.32,thickness:.012,E:200e6,nu:.30,fy:355e3,hardeningRatio:.02,
  meshX:8,meshY:6,edgeDisplacementMax:.006,steps:24,maxIterations:55,
  cutIntegrationOrder:8,boundarySegments:64,contactNormalStiffness:5e8,voidStiffnessRatio:1e-7,
  edgeYStabilizationRatio:1e-10,absoluteTolerance:1e-7,relativeTolerance:1e-8
};

export function normalizeConnectionPlateHoleConfig(input={}){
  const c={...DEFAULT_CONNECTION_PLATE_HOLE_CONTACT,...input};
  return{
    ...c,
    length:Math.max(.02,finite(c.length,.50)),
    width:Math.max(.02,finite(c.width,.32)),
    thickness:Math.max(1e-4,finite(c.thickness,.012)),
    E:Math.max(1,finite(c.E,200e6)),
    nu:clamp(finite(c.nu,.30),-.49,.49),
    fy:Math.max(0,finite(c.fy,355e3)),
    hardeningRatio:clamp(finite(c.hardeningRatio,.02),0,1),
    meshX:Math.max(3,Math.min(28,Math.round(finite(c.meshX,8)))),
    meshY:Math.max(3,Math.min(22,Math.round(finite(c.meshY,6)))),
    edgeDisplacementMax:Math.max(0,finite(c.edgeDisplacementMax,.006)),
    steps:Math.max(1,Math.min(120,Math.round(finite(c.steps,24)))),
    maxIterations:Math.max(8,Math.min(120,Math.round(finite(c.maxIterations,55)))),
    cutIntegrationOrder:Math.max(4,Math.min(18,Math.round(finite(c.cutIntegrationOrder,8)))),
    boundarySegments:Math.max(24,Math.min(180,Math.round(finite(c.boundarySegments,64)))),
    contactNormalStiffness:Math.max(1,finite(c.contactNormalStiffness,5e8)),
    voidStiffnessRatio:clamp(finite(c.voidStiffnessRatio,1e-7),1e-10,1e-3),
    edgeYStabilizationRatio:clamp(finite(c.edgeYStabilizationRatio,1e-10),1e-14,1e-5),
    absoluteTolerance:Math.max(1e-12,finite(c.absoluteTolerance,1e-7)),
    relativeTolerance:Math.max(1e-12,finite(c.relativeTolerance,1e-8))
  };
}

export function generateExplicitHoleBoltGroup({nx=2,ny=2,spacingX=.12,spacingY=.12,centerX=.25,centerY=0,boltDiameter=.020,gap=.001,contactNormalStiffness=5e8,shearCapacity=0}={}){
  const out=[];
  const nxn=Math.max(1,Math.min(8,Math.round(finite(nx,2))));
  const nyn=Math.max(1,Math.min(8,Math.round(finite(ny,2))));
  const sx=Math.max(0,finite(spacingX,.12));
  const sy=Math.max(0,finite(spacingY,.12));
  for(let j=0;j<nyn;j++)for(let i=0;i<nxn;i++)out.push({
    id:`B${j*nxn+i+1}`,
    x:finite(centerX,.25)+(i-(nxn-1)/2)*sx,
    y:finite(centerY)+(j-(nyn-1)/2)*sy,
    boltDiameter:Math.max(1e-4,finite(boltDiameter,.020)),
    gap:Math.max(0,finite(gap,.001)),
    contactNormalStiffness:Math.max(1,finite(contactNormalStiffness,5e8)),
    shearCapacity:Math.max(0,finite(shearCapacity))
  });
  return out;
}

function planeStressD(E,nu){
  const k=E/(1-nu*nu);
  return[[k,k*nu,0],[k*nu,k,0],[0,0,k*(1-nu)/2]];
}
function mv(A,x){return A.map(r=>r.reduce((s,v,i)=>s+v*x[i],0))}
function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
function mm(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)))}
function addSub(K,ke,idx,scale=1){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)K[idx[i]][idx[j]]+=scale*ke[i][j]}
function addVec(f,fe,idx,scale=1){for(let i=0;i<idx.length;i++)f[idx[i]]+=scale*fe[i]}
function vmStress(s){const[sx,sy,txy]=s;return Math.sqrt(Math.max(0,sx*sx-sx*sy+sy*sy+3*txy*txy))}
function rms(v){return Math.sqrt(v.reduce((s,x)=>s+x*x,0)/Math.max(1,v.length))}
function shape(xi,eta){return[.25*(1-xi)*(1-eta),.25*(1+xi)*(1-eta),.25*(1+xi)*(1+eta),.25*(1-xi)*(1+eta)]}
function shapeDerivatives(xi,eta){return{xi:[-.25*(1-eta),.25*(1-eta),.25*(1+eta),-.25*(1+eta)],eta:[-.25*(1-xi),-.25*(1+xi),.25*(1+xi),.25*(1-xi)]}}

function bMatrix(coords,xi,eta){
  const d=shapeDerivatives(xi,eta);
  let j11=0,j12=0,j21=0,j22=0;
  for(let i=0;i<4;i++){
    j11+=d.xi[i]*coords[i][0];
    j12+=d.xi[i]*coords[i][1];
    j21+=d.eta[i]*coords[i][0];
    j22+=d.eta[i]*coords[i][1];
  }
  const detJ=j11*j22-j12*j21;
  if(!(detJ>EPS))throw new Error('Chapa com furo: Jacobiano Q4 não positivo.');
  const inv=[[j22/detJ,-j12/detJ],[-j21/detJ,j11/detJ]],B=zeros(3,8),N=shape(xi,eta);
  for(let i=0;i<4;i++){
    const dx=inv[0][0]*d.xi[i]+inv[0][1]*d.eta[i];
    const dy=inv[1][0]*d.xi[i]+inv[1][1]*d.eta[i];
    const o=2*i;
    B[0][o]=dx;B[1][o+1]=dy;B[2][o]=dy;B[2][o+1]=dx;
  }
  return{B,detJ,N};
}
function physicalPoint(coords,N){return N.reduce((p,w,i)=>[p[0]+w*coords[i][0],p[1]+w*coords[i][1]],[0,0])}
function constitutiveAt(strain,D,c){
  const trial=mv(D,strain),vm=vmStress(trial);
  if(!(c.fy>0)||vm<=c.fy*(1+1e-10))return{stress:trial,tangent:D,vm,yielded:false,plasticStrain:0};
  const h=c.hardeningRatio;
  const scale=h+(1-h)*c.fy/Math.max(EPS,vm);
  const target=scale*vm;
  const stress=trial.map(v=>v*scale);
  const gradVmStress=[trial[0]-.5*trial[1],trial[1]-.5*trial[0],3*trial[2]].map(v=>v/Math.max(EPS,vm));
  const gradVmStrain=[0,1,2].map(j=>gradVmStress.reduce((s,g,i)=>s+g*D[i][j],0));
  const dScaleDvm=-(1-h)*c.fy/Math.max(EPS,vm*vm);
  const tangent=D.map((row,i)=>row.map((v,j)=>scale*v+trial[i]*dScaleDvm*gradVmStrain[j]));
  return{stress,tangent,vm:target,yielded:true,plasticStrain:Math.max(0,(vm-target)/c.E)};
}

function meshY(c,dy,j){return(j-c.meshY/2)*dy}
function makeMesh(c){
  const nodes=[],elements=[],dx=c.length/c.meshX,dy=c.width/c.meshY;
  for(let j=0;j<=c.meshY;j++)for(let i=0;i<=c.meshX;i++)nodes.push({
    id:j*(c.meshX+1)+i,
    x:i*dx,
    y:meshY(c,dy,j)
  });
  for(let j=0;j<c.meshY;j++)for(let i=0;i<c.meshX;i++){
    const n0=j*(c.meshX+1)+i,n1=n0+1,n3=(j+1)*(c.meshX+1)+i,n2=n3+1;
    elements.push({id:`E${elements.length+1}`,nodes:[n0,n1,n2,n3],ix:i,iy:j});
  }
  return{nodes,elements,dx,dy};
}

function normalizeBolts(bolts,c){
  if(!Array.isArray(bolts)||!bolts.length)throw new Error('Chapa com furo: informe ao menos um parafuso/furo.');
  const out=bolts.map((b,i)=>{
    const boltDiameter=Math.max(1e-4,finite(b.boltDiameter,.020));
    const gap=Math.max(0,finite(b.gap,.001));
    const holeRadius=boltDiameter/2+gap;
    const x=finite(b.x),y=finite(b.y);
    if(x-holeRadius<=EPS||x+holeRadius>=c.length-EPS||y-holeRadius<=-c.width/2+EPS||y+holeRadius>=c.width/2-EPS)throw new Error(`Chapa com furo: ${b.id||`B${i+1}`} não possui ligamento de borda positivo.`);
    return{
      id:String(b.id||`B${i+1}`),x,y,boltDiameter,boltRadius:boltDiameter/2,gap,holeRadius,
      contactNormalStiffness:Math.max(1,finite(b.contactNormalStiffness,c.contactNormalStiffness)),
      shearCapacity:Math.max(0,finite(b.shearCapacity))
    };
  });
  for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
    const a=out[i],b=out[j],d=Math.hypot(a.x-b.x,a.y-b.y);
    if(d<=a.holeRadius+b.holeRadius+1e-8)throw new Error(`Chapa com furo: furos ${a.id} e ${b.id} se sobrepõem.`);
  }
  return out;
}
function insideHole(x,y,holes){for(const h of holes)if(Math.hypot(x-h.x,y-h.y)<h.holeRadius)return h;return null}
function bboxIntersectsHole(coords,h){
  const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const cx=clamp(h.x,xmin,xmax),cy=clamp(h.y,ymin,ymax);
  return Math.hypot(cx-h.x,cy-h.y)<h.holeRadius+1e-12;
}
function integrationRule(coords,holes,c){
  const cut=holes.some(h=>bboxIntersectsHole(coords,h));
  if(!cut)return GPS;
  const n=c.cutIntegrationOrder,w=4/(n*n),pts=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)pts.push([-1+(i+.5)*2/n,-1+(j+.5)*2/n,w]);
  return pts;
}
function locate(mesh,c,x,y){
  const ix=Math.min(c.meshX-1,Math.max(0,Math.floor(x/mesh.dx)));
  const rawY=y/mesh.dy+c.meshY/2;
  const iy=Math.min(c.meshY-1,Math.max(0,Math.floor(rawY)));
  const el=mesh.elements[iy*c.meshX+ix];
  const x0=ix*mesh.dx,y0=meshY(c,mesh.dy,iy);
  const xi=2*(x-x0)/mesh.dx-1,eta=2*(y-y0)/mesh.dy-1;
  return{el,N:shape(xi,eta),xi,eta};
}
function interpolateDisplacement(u,el,N){
  let ux=0,uy=0;
  for(let i=0;i<4;i++){
    const n=el.nodes[i],w=N[i];
    ux+=w*u[2*n];uy+=w*u[2*n+1];
  }
  return[ux,uy];
}

function contactBoundary(c,mesh,holes,u){
  const all=[];
  for(const h of holes){
    const segs=[],nseg=c.boundarySegments,ds=2*Math.PI*h.holeRadius/nseg;
    let Fx=0,Fy=0,arc=0,peak=0,weightedCx=0,weightedCy=0,psum=0,meanUx=0,meanUy=0;
    const samples=[];
    for(let s=0;s<nseg;s++){
      const angle=2*Math.PI*(s+.5)/nseg,nx=Math.cos(angle),ny=Math.sin(angle);
      const x=h.x+h.holeRadius*nx,y=h.y+h.holeRadius*ny;
      const loc=locate(mesh,c,x,y),disp=interpolateDisplacement(u,loc.el,loc.N);
      samples.push({s,angle,nx,ny,x,y,loc,disp});
      meanUx+=disp[0]/nseg;meanUy+=disp[1]/nseg;
    }
    let rmin=Infinity,rmax=-Infinity;
    for(const q of samples){
      const un=q.disp[0]*q.nx+q.disp[1]*q.ny;
      const clearance=h.gap+un;
      const penetration=Math.max(0,-clearance);
      const pressure=h.contactNormalStiffness*penetration;
      const area=c.thickness*ds;
      const fx=-pressure*area*q.nx,fy=-pressure*area*q.ny,active=pressure>EPS;
      Fx+=fx;Fy+=fy;
      if(active){
        arc+=ds;peak=Math.max(peak,pressure);
        weightedCx+=pressure*Math.cos(q.angle);weightedCy+=pressure*Math.sin(q.angle);psum+=pressure;
      }
      const ur=(q.disp[0]-meanUx)*q.nx+(q.disp[1]-meanUy)*q.ny;
      rmin=Math.min(rmin,ur);rmax=Math.max(rmax,ur);
      segs.push({...q,clearance,penetration,pressure,pressureMPa:pressure/1000,area,force:{fx,fy,magnitude:Math.hypot(fx,fy)},active,radialDeformation:ur});
    }
    const angleDeg=psum>EPS?(Math.atan2(weightedCy,weightedCx)*180/Math.PI+360)%360:null;
    const resultant=Math.hypot(Fx,Fy),ovalization=Math.max(0,rmax-rmin);
    all.push({
      ...h,segments:segs,resultant:{fx:Fx,fy:Fy,magnitude:resultant},peakPressure:peak,peakPressureMPa:peak/1000,
      activeArcLength:arc,activeArcDegrees:arc/(2*Math.PI*h.holeRadius)*360,contactCentroidAngleDeg:angleDeg,
      meanBoundaryDisplacement:{x:meanUx,y:meanUy},ovalization,ovalizationMm:ovalization*1000,
      ovalizationRatio:ovalization/(2*h.holeRadius),bearingStressEquivalentMPa:resultant/(c.thickness*h.boltDiameter)/1000,
      utilization:h.shearCapacity>EPS?resultant/h.shearCapacity:null
    });
  }
  return all;
}

function assemble(c,mesh,holes,u){
  const nd=mesh.nodes.length*2,K=zeros(nd),f=Array(nd).fill(0),D=planeStressD(c.E,c.nu),elementStates=[];
  let materialArea=0,voidArea=0;
  for(const e of mesh.elements){
    const coords=e.nodes.map(n=>[mesh.nodes[n].x,mesh.nodes[n].y]);
    const idx=e.nodes.flatMap(n=>[2*n,2*n+1]);
    const ue=idx.map(d=>u[d]),ke=zeros(8),fe=Array(8).fill(0),gps=[];
    const rule=integrationRule(coords,holes,c);
    let materialWeight=0,geomWeight=0,vmSum=0,plasticSum=0,yieldedCount=0,materialCount=0;
    for(const [xi,eta,natWeight] of rule){
      const q=bMatrix(coords,xi,eta),pt=physicalPoint(coords,q.N),hole=insideHole(pt[0],pt[1],holes);
      const scale=hole?c.voidStiffnessRatio:1,eps=mv(q.B,ue);
      const mat=hole?{stress:mv(D,eps),tangent:D,vm:0,yielded:false,plasticStrain:0}:constitutiveAt(eps,D,c);
      const Bt=transpose(q.B),kg=mm(Bt,mm(mat.tangent,q.B)),fg=mv(Bt,mat.stress),w=c.thickness*q.detJ*natWeight;
      for(let i=0;i<8;i++){
        fe[i]+=fg[i]*w*scale;
        for(let j=0;j<8;j++)ke[i][j]+=kg[i][j]*w*scale;
      }
      geomWeight+=q.detJ*natWeight;
      if(!hole){
        materialWeight+=q.detJ*natWeight;vmSum+=mat.vm;plasticSum+=mat.plasticStrain;materialCount++;
        if(mat.yielded)yieldedCount++;
        gps.push({xi,eta,x:pt[0],y:pt[1],stress:mat.stress,vm:mat.vm,yielded:mat.yielded,plasticStrain:mat.plasticStrain});
      }
    }
    addSub(K,ke,idx);addVec(f,fe,idx);
    materialArea+=materialWeight;voidArea+=Math.max(0,geomWeight-materialWeight);
    elementStates.push({
      id:e.id,nodes:e.nodes,center:{x:coords.reduce((s,p)=>s+p[0],0)/4,y:coords.reduce((s,p)=>s+p[1],0)/4},
      materialFraction:geomWeight>EPS?materialWeight/geomWeight:0,vm:materialCount?vmSum/materialCount:0,
      maxVm:materialCount?Math.max(...gps.map(g=>g.vm)):0,yieldedFraction:materialCount?yieldedCount/materialCount:0,
      plasticStrain:materialCount?plasticSum/materialCount:0,gaussPoints:gps
    });
  }

  const contacts=contactBoundary(c,mesh,holes,u);
  for(const h of contacts)for(const s of h.segments)if(s.active){
    const nvec=[s.nx,s.ny],k=h.contactNormalStiffness*s.area,loc=s.loc;
    for(let i=0;i<4;i++){
      const ni=loc.el.nodes[i],Ni=loc.N[i],ii=[2*ni,2*ni+1];
      f[ii[0]]+=Ni*s.force.fx;f[ii[1]]+=Ni*s.force.fy;
      for(let j=0;j<4;j++){
        const nj=loc.el.nodes[j],Nj=loc.N[j],jj=[2*nj,2*nj+1],w=Ni*Nj*k;
        K[ii[0]][jj[0]]+=w*nvec[0]*nvec[0];K[ii[0]][jj[1]]+=w*nvec[0]*nvec[1];
        K[ii[1]][jj[0]]+=w*nvec[1]*nvec[0];K[ii[1]][jj[1]]+=w*nvec[1]*nvec[1];
      }
    }
  }
  return{K,f,elements:elementStates,holes:contacts,materialArea,voidArea};
}

function boundaryConditions(c,mesh,delta){
  const prescribed=new Map(),loaded=[],edgeY=[];
  for(const n of mesh.nodes)if(Math.abs(n.x-c.length)<=1e-10){
    prescribed.set(2*n.id,delta);loaded.push(2*n.id);edgeY.push(2*n.id+1);
  }
  const tied=new Set(edgeY),groups=[];
  for(let d=0;d<mesh.nodes.length*2;d++)if(!prescribed.has(d)&&!tied.has(d))groups.push([d]);
  const edgeYGroup=groups.length;groups.push(edgeY);
  return{prescribed,loaded,edgeY,groups,edgeYGroup};
}
function enforceBoundaryKinematics(u,bc){
  for(const[d,v]of bc.prescribed)u[d]=v;
  const y=bc.edgeY.reduce((s,d)=>s+u[d],0)/Math.max(1,bc.edgeY.length);
  for(const d of bc.edgeY)u[d]=y;
}
function reducedResidual(state,bc,ky,u){
  const R=bc.groups.map(g=>g.reduce((s,d)=>s+state.f[d],0));
  R[bc.edgeYGroup]+=ky*u[bc.edgeY[0]];
  return R;
}
function reducedTangent(state,bc,ky){
  const n=bc.groups.length,K=zeros(n);
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){
    let s=0;
    for(const i of bc.groups[a])for(const j of bc.groups[b])s+=state.K[i][j];
    K[a][b]=s;
  }
  K[bc.edgeYGroup][bc.edgeYGroup]+=ky;
  return K;
}
function applyReducedIncrement(u,bc,du,alpha=1){
  for(let a=0;a<bc.groups.length;a++)for(const d of bc.groups[a])u[d]+=alpha*du[a];
  enforceBoundaryKinematics(u,bc);
}

export function solveConnectionPlateHoleAtDisplacement(input={},targetDisplacement=0,initial=null){
  const c=normalizeConnectionPlateHoleConfig(input),mesh=makeMesh(c),holes=normalizeBolts(input.bolts,c),nd=mesh.nodes.length*2;
  const u=Array.isArray(initial)&&initial.length===nd?[...initial]:Array(nd).fill(0);
  const bc=boundaryConditions(c,mesh,Math.max(0,finite(targetDisplacement)));
  enforceBoundaryKinematics(u,bc);
  let state=assemble(c,mesh,holes,u),iterations=0,converged=false,residualNorm=Infinity;
  const scale=Math.max(1,c.E*c.thickness*c.width*Math.max(c.edgeDisplacementMax,1e-5)/Math.max(c.length,1e-3));
  const tol=Math.max(c.absoluteTolerance,c.relativeTolerance*scale);
  const ky=c.edgeYStabilizationRatio*c.E*c.thickness*c.width/Math.max(c.length,1e-3);

  for(let it=0;it<c.maxIterations;it++){
    iterations=it+1;
    const R=reducedResidual(state,bc,ky,u);
    residualNorm=rms(R);
    if(residualNorm<=tol){converged=true;break}
    let du;
    try{du=solveLinear(reducedTangent(state,bc,ky),R.map(v=>-v))}
    catch(err){return{type:'connection-plate-hole-contact-2d-state',solverVersion:'0.30.5',config:c,mesh,u,state,converged:false,iterations,residualNorm,error:err?.message||String(err)}}
    let alpha=1,best=null,bestNorm=residualNorm;
    for(let ls=0;ls<10;ls++){
      const trial=[...u];applyReducedIncrement(trial,bc,du,alpha);
      const st=assemble(c,mesh,holes,trial),rn=rms(reducedResidual(st,bc,ky,trial));
      if(rn<bestNorm){best={u:trial,state:st};bestNorm=rn}
      if(rn<=residualNorm*(1-1e-4*alpha))break;
      alpha*=.5;
    }
    if(best){for(let i=0;i<nd;i++)u[i]=best.u[i];state=best.state}
    else{applyReducedIncrement(u,bc,du,.05);state=assemble(c,mesh,holes,u)}
  }
  if(!converged){residualNorm=rms(reducedResidual(state,bc,ky,u));converged=residualNorm<=tol*5}

  const edgeInternal=bc.loaded.reduce((s,d)=>s+state.f[d],0);
  const edgeYReaction=bc.edgeY.reduce((s,d)=>s+state.f[d],0);
  const appliedLoad=edgeInternal,totalFx=state.holes.reduce((s,h)=>s+h.resultant.fx,0),totalFy=state.holes.reduce((s,h)=>s+h.resultant.fy,0);
  const maxVm=Math.max(0,...state.elements.map(e=>e.maxVm));
  const yieldedAreaFraction=state.elements.reduce((s,e)=>s+e.yieldedFraction*e.materialFraction,0)/Math.max(EPS,state.elements.reduce((s,e)=>s+e.materialFraction,0));
  const maxPlasticStrain=Math.max(0,...state.elements.map(e=>e.plasticStrain));
  const peakPressureMPa=Math.max(0,...state.holes.map(h=>h.peakPressureMPa));
  const maxOvalizationMm=Math.max(0,...state.holes.map(h=>h.ovalizationMm));
  const edgeYDisplacement=bc.edgeY.length?u[bc.edgeY[0]]:0;
  return{
    type:'connection-plate-hole-contact-2d-state',solverVersion:'0.30.5',config:c,mesh,u,state,converged,iterations,residualNorm,
    edgeDisplacement:Math.max(0,finite(targetDisplacement)),edgeYDisplacement,edgeYReaction,appliedLoad,totalFx,totalFy,
    maxVm,maxVmMPa:maxVm/1000,yieldedAreaFraction,maxPlasticStrain,peakPressureMPa,maxOvalizationMm,
    equilibrium:{fxResidual:appliedLoad-totalFx,relativeFxResidual:(appliedLoad-totalFx)/Math.max(1,Math.abs(appliedLoad)),fyResidual:totalFy,edgeYReaction,stabilizationReaction:ky*edgeYDisplacement},
    area:{material:state.materialArea,void:state.voidArea,geometric:c.length*c.width,analyticalVoid:holes.reduce((s,h)=>s+Math.PI*h.holeRadius*h.holeRadius,0)}
  };
}

export function solveConnectionPlateHoleContact(input={}){
  const c=normalizeConnectionPlateHoleConfig(input),curve=[],states=[];
  let prev=null,failedAt=null;
  for(let step=0;step<=c.steps;step++){
    const delta=c.edgeDisplacementMax*step/c.steps;
    const sol=solveConnectionPlateHoleAtDisplacement({...input,...c},delta,prev);
    curve.push({
      step,lambda:c.edgeDisplacementMax>EPS?delta/c.edgeDisplacementMax:0,displacement:delta,displacementMm:delta*1000,
      load:sol.appliedLoad,edgeYDisplacementMm:(sol.edgeYDisplacement||0)*1000,maxVmMPa:sol.maxVmMPa,
      yieldedAreaFraction:sol.yieldedAreaFraction,maxPlasticStrain:sol.maxPlasticStrain,peakPressureMPa:sol.peakPressureMPa,
      maxOvalizationMm:sol.maxOvalizationMm,activeHoles:sol.state?.holes?.filter(h=>h.activeArcLength>EPS).length||0,
      activeArcDegrees:Math.max(0,...(sol.state?.holes||[]).map(h=>h.activeArcDegrees)),iterations:sol.iterations,residualNorm:sol.residualNorm,converged:sol.converged
    });
    states.push(sol);
    if(!sol.converged){failedAt=step;break}
    prev=sol.u;
  }
  const final=states.at(-1);
  const peak=curve.reduce((a,b)=>!a||Math.abs(b.load)>Math.abs(a.load)?b:a,null);
  const firstContact=curve.find(p=>p.activeHoles>0)||null,firstYield=curve.find(p=>p.yieldedAreaFraction>0)||null;
  return{
    type:'connection-plate-hole-contact-2d',solverVersion:'0.30.5',control:'edge-displacement',config:c,curve,final,peak,
    events:{firstContact,firstYield},
    diagnostics:{failedAt,converged:failedAt==null,peakPressureMPa:final?.peakPressureMPa||0,maxOvalizationMm:final?.maxOvalizationMm||0,maxVmMPa:final?.maxVmMPa||0,yieldedAreaFraction:final?.yieldedAreaFraction||0,equilibrium:final?.equilibrium||null,area:final?.area||null},
    assumptions:[
      'chapa Q4 de membrana em estado plano de tensões com domínio circular vazado por integração embutida',
      'malha transversal construída exatamente em torno de y=0 para preservar simetria de reflexão em ponto flutuante',
      'furo circular exato na lei de contato; integração de volume em células cortadas por quadratura composta',
      'pequena regularização de rigidez fictícia dentro do vazio apenas para condicionamento numérico',
      'contato normal unilateral sem atrito distribuído em segmentos do contorno cilíndrico do furo',
      'parafuso rígido e fixo no centro do furo; folga radial explícita',
      'bordo x=L acionado como linha rígida no plano: ux uniforme imposto; todos os uy do bordo são vinculados a uma translação comum livre, impondo reação transversal resultante nula',
      'regularização transversal do bordo livre é ínfima e atua apenas para remover o modo rígido antes do contato',
      'pressão p_n=k_n·δ integrada na área cilíndrica t·ds',
      'plasticização monotônica bilinear secante governada por von Mises com tangente algorítmica consistente da lei secante',
      'ovalização calculada removendo a translação média do contorno',
      'não inclui atrito, pré-tensão, prying fora do plano, block shear, rasgamento de borda ou resistência normativa automática'
    ]
  };
}
