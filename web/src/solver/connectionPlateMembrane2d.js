import {zeros,solveLinear} from './matrix.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GAUSS=1/Math.sqrt(3);
const GPS=[[-GAUSS,-GAUSS],[GAUSS,-GAUSS],[GAUSS,GAUSS],[-GAUSS,GAUSS]];

export const DEFAULT_CONNECTION_PLATE_MEMBRANE={
  length:0.50,width:0.32,thickness:0.012,E:200e6,nu:0.30,fy:355e3,hardeningRatio:0.02,
  meshX:6,meshY:4,edgeDisplacementMax:0.006,steps:24,maxIterations:45,
  absoluteTolerance:1e-7,relativeTolerance:1e-8
};

export function normalizeConnectionPlateConfig(input={}){
  const c={...DEFAULT_CONNECTION_PLATE_MEMBRANE,...input};
  const length=Math.max(.02,finite(c.length,.50)),width=Math.max(.02,finite(c.width,.32)),thickness=Math.max(1e-4,finite(c.thickness,.012)),E=Math.max(1,finite(c.E,200e6)),nu=clamp(finite(c.nu,.30),-.49,.49),fy=Math.max(0,finite(c.fy,355e3));
  return{...c,length,width,thickness,E,nu,fy,hardeningRatio:clamp(finite(c.hardeningRatio,.02),0,1),meshX:Math.max(2,Math.min(24,Math.round(finite(c.meshX,6)))),meshY:Math.max(2,Math.min(18,Math.round(finite(c.meshY,4)))),edgeDisplacementMax:Math.max(0,finite(c.edgeDisplacementMax,.006)),steps:Math.max(1,Math.min(120,Math.round(finite(c.steps,24)))),maxIterations:Math.max(8,Math.min(120,Math.round(finite(c.maxIterations,45)))),absoluteTolerance:Math.max(1e-12,finite(c.absoluteTolerance,1e-7)),relativeTolerance:Math.max(1e-12,finite(c.relativeTolerance,1e-8))};
}

export function generateFlexiblePlateBoltGroup({nx=2,ny=2,spacingX=.12,spacingY=.12,centerX=.25,centerY=0,bearingStiffness=200000,gap=.001,boltDiameter=.020,shearCapacity=0,yieldForce=0,postYieldRatio=.02}={}){
  const out=[],sx=Math.max(0,finite(spacingX,.12)),sy=Math.max(0,finite(spacingY,.12)),nxn=Math.max(1,Math.min(8,Math.round(finite(nx,2)))),nyn=Math.max(1,Math.min(8,Math.round(finite(ny,2))));
  for(let j=0;j<nyn;j++)for(let i=0;i<nxn;i++)out.push({id:`B${j*nxn+i+1}`,x:finite(centerX,.25)+(i-(nxn-1)/2)*sx,y:finite(centerY)+(j-(nyn-1)/2)*sy,k:Math.max(EPS,finite(bearingStiffness,200000)),gap:Math.max(0,finite(gap,.001)),boltDiameter:Math.max(1e-4,finite(boltDiameter,.020)),shearCapacity:Math.max(0,finite(shearCapacity)),yieldForce:Math.max(0,finite(yieldForce)),postYieldRatio:Math.max(0,finite(postYieldRatio,.02))});
  return out;
}

function planeStressD(E,nu){const c=E/(1-nu*nu);return[[c,c*nu,0],[c*nu,c,0],[0,0,c*(1-nu)/2]]}
function mv(A,x){return A.map(r=>r.reduce((s,v,i)=>s+v*x[i],0))}
function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
function mm(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)))}
function addSub(K,ke,idx){for(let i=0;i<idx.length;i++)for(let j=0;j<idx.length;j++)K[idx[i]][idx[j]]+=ke[i][j]}
function addVec(f,fe,idx){for(let i=0;i<idx.length;i++)f[idx[i]]+=fe[i]}
function vmStress(s){const [sx,sy,txy]=s;return Math.sqrt(Math.max(0,sx*sx-sx*sy+sy*sy+3*txy*txy))}

function shape(xi,eta){return[.25*(1-xi)*(1-eta),.25*(1+xi)*(1-eta),.25*(1+xi)*(1+eta),.25*(1-xi)*(1+eta)]}
function shapeDerivatives(xi,eta){return{xi:[-.25*(1-eta),.25*(1-eta),.25*(1+eta),-.25*(1+eta)],eta:[-.25*(1-xi),-.25*(1+xi),.25*(1+xi),.25*(1-xi)]}}
function bMatrix(coords,xi,eta){
  const d=shapeDerivatives(xi,eta);let j11=0,j12=0,j21=0,j22=0;
  for(let i=0;i<4;i++){j11+=d.xi[i]*coords[i][0];j12+=d.xi[i]*coords[i][1];j21+=d.eta[i]*coords[i][0];j22+=d.eta[i]*coords[i][1]}
  const detJ=j11*j22-j12*j21;if(!(detJ>EPS))throw new Error('Chapa flexível: Jacobiano Q4 não positivo.');const inv=[[j22/detJ,-j12/detJ],[-j21/detJ,j11/detJ]],B=zeros(3,8);
  for(let i=0;i<4;i++){const dx=inv[0][0]*d.xi[i]+inv[0][1]*d.eta[i],dy=inv[1][0]*d.xi[i]+inv[1][1]*d.eta[i],o=2*i;B[0][o]=dx;B[1][o+1]=dy;B[2][o]=dy;B[2][o+1]=dx}
  return{B,detJ,N:shape(xi,eta)};
}

function constitutiveAt(strain,D,c){
  const trial=mv(D,strain),vm=vmStress(trial);if(!(c.fy>0)||vm<=c.fy*(1+1e-10))return{stress:trial,tangent:D,vm,yielded:false,scale:1,plasticStrain:0};
  const target=c.fy+c.hardeningRatio*(vm-c.fy),scale=target/Math.max(EPS,vm),stress=trial.map(v=>v*scale),tangent=D.map(r=>r.map(v=>v*scale)),plasticStrain=Math.max(0,(vm-target)/c.E);
  return{stress,tangent,vm:target,yielded:true,scale,plasticStrain};
}

function makeMesh(c){
  const nodes=[],elements=[],dx=c.length/c.meshX,dy=c.width/c.meshY;
  for(let j=0;j<=c.meshY;j++)for(let i=0;i<=c.meshX;i++)nodes.push({id:j*(c.meshX+1)+i,x:i*dx,y:-c.width/2+j*dy});
  for(let j=0;j<c.meshY;j++)for(let i=0;i<c.meshX;i++){const n0=j*(c.meshX+1)+i,n1=n0+1,n3=(j+1)*(c.meshX+1)+i,n2=n3+1;elements.push({id:`E${elements.length+1}`,nodes:[n0,n1,n2,n3]})}
  return{nodes,elements,dx,dy};
}

function normalizeBolts(bolts,c,mesh){
  const source=Array.isArray(bolts)?bolts:[];if(!source.length)throw new Error('Chapa flexível: informe ao menos um parafuso.');
  return source.map((b,i)=>{const x=finite(b.x),y=finite(b.y);if(x<=EPS||x>=c.length-EPS||y<=-c.width/2+EPS||y>=c.width/2-EPS)throw new Error(`Chapa flexível: ${b.id||`B${i+1}`} deve ficar no interior da chapa.`);const ix=Math.min(c.meshX-1,Math.max(0,Math.floor(x/mesh.dx))),iy=Math.min(c.meshY-1,Math.max(0,Math.floor((y+c.width/2)/mesh.dy))),x0=ix*mesh.dx,y0=-c.width/2+iy*mesh.dy,xi=2*(x-x0)/mesh.dx-1,eta=2*(y-y0)/mesh.dy-1,el=mesh.elements[iy*c.meshX+ix],N=shape(xi,eta);return{id:String(b.id||`B${i+1}`),x,y,k:Math.max(EPS,finite(b.k??b.bearingStiffness,200000)),gap:Math.max(0,finite(b.gap,.001)),boltDiameter:Math.max(1e-4,finite(b.boltDiameter,.020)),shearCapacity:Math.max(0,finite(b.shearCapacity)),yieldForce:Math.max(0,finite(b.yieldForce)),postYieldRatio:Math.max(0,finite(b.postYieldRatio,.02)),elementId:el.id,elementNodes:el.nodes,N};});
}

function boltLaw(p,b){if(!(p>0))return{force:0,tangent:0,state:'gap'};const k=b.k,fy=b.yieldForce,post=b.postYieldRatio;if(!(fy>0))return{force:k*p,tangent:k,state:'bearing-elastic'};const py=fy/k;if(p<=py)return{force:k*p,tangent:k,state:'bearing-elastic'};return{force:fy+post*k*(p-py),tangent:post*k,state:post>EPS?'bearing-postyield':'bearing-capped'}}

function contactAt(u,b,c){
  let ux=0,uy=0;for(let i=0;i<4;i++){const n=b.elementNodes[i],N=b.N[i];ux+=N*u[2*n];uy+=N*u[2*n+1]}const r=Math.hypot(ux,uy),p=r-b.gap,law=boltLaw(p,b),fx=r>EPS?law.force*ux/r:0,fy=r>EPS?law.force*uy/r:0;
  let kt=[[0,0],[0,0]];if(r>EPS&&law.force>0){const nx=ux/r,ny=uy/r,a=law.tangent,beta=law.force/r;kt=[[a*nx*nx+beta*(1-nx*nx),a*nx*ny-beta*nx*ny],[a*nx*ny-beta*nx*ny,a*ny*ny+beta*(1-ny*ny)]]}
  return{relativeDisplacement:{x:ux,y:uy,magnitude:r},penetration:Math.max(0,p),force:{fx,fy,magnitude:law.force},state:law.state,tangent:law.tangent,kt,utilization:b.shearCapacity>EPS?law.force/b.shearCapacity:null,bearingStressEquivalentMPa:law.force/(c.thickness*b.boltDiameter)/1000};
}

function assemble(c,mesh,bolts,u){
  const nd=mesh.nodes.length*2,K=zeros(nd),f=Array(nd).fill(0),D=planeStressD(c.E,c.nu),elementStates=[];
  for(const e of mesh.elements){const coords=e.nodes.map(n=>[mesh.nodes[n].x,mesh.nodes[n].y]),idx=e.nodes.flatMap(n=>[2*n,2*n+1]),ue=idx.map(d=>u[d]),ke=zeros(8),fe=Array(8).fill(0),gps=[];let vmSum=0,plasticSum=0,yieldedCount=0;
    for(const [xi,eta] of GPS){const q=bMatrix(coords,xi,eta),eps=mv(q.B,ue),mat=constitutiveAt(eps,D,c),Bt=transpose(q.B),kg=mm(Bt,mm(mat.tangent,q.B)),fg=mv(Bt,mat.stress),w=c.thickness*q.detJ;for(let i=0;i<8;i++){fe[i]+=fg[i]*w;for(let j=0;j<8;j++)ke[i][j]+=kg[i][j]*w}vmSum+=mat.vm;plasticSum+=mat.plasticStrain;if(mat.yielded)yieldedCount++;gps.push({xi,eta,strain:eps,stress:mat.stress,vm:mat.vm,yielded:mat.yielded,plasticStrain:mat.plasticStrain})}
    addSub(K,ke,idx);addVec(f,fe,idx);elementStates.push({id:e.id,nodes:e.nodes,center:{x:coords.reduce((s,p)=>s+p[0],0)/4,y:coords.reduce((s,p)=>s+p[1],0)/4},vm:vmSum/4,maxVm:Math.max(...gps.map(g=>g.vm)),yieldedFraction:yieldedCount/4,plasticStrain:plasticSum/4,gaussPoints:gps});
  }
  const boltStates=[];for(const b of bolts){const st=contactAt(u,b,c);boltStates.push({...b,...st});for(let i=0;i<4;i++){const ni=b.elementNodes[i],Ni=b.N[i],ii=[2*ni,2*ni+1];f[ii[0]]+=Ni*st.force.fx;f[ii[1]]+=Ni*st.force.fy;for(let j=0;j<4;j++){const nj=b.elementNodes[j],Nj=b.N[j],jj=[2*nj,2*nj+1],w=Ni*Nj;K[ii[0]][jj[0]]+=w*st.kt[0][0];K[ii[0]][jj[1]]+=w*st.kt[0][1];K[ii[1]][jj[0]]+=w*st.kt[1][0];K[ii[1]][jj[1]]+=w*st.kt[1][1]}}}
  return{K,f,elements:elementStates,bolts:boltStates};
}

function freeAndPrescribed(c,mesh,delta){
  const prescribed=new Map(),loaded=[];for(const n of mesh.nodes)if(Math.abs(n.x-c.length)<=1e-10){prescribed.set(2*n.id,delta);loaded.push(2*n.id)}
  const mid=Math.round(c.meshY/2)*(c.meshX+1)+c.meshX;prescribed.set(2*mid+1,0);const fixed=new Set(prescribed.keys()),free=Array.from({length:mesh.nodes.length*2},(_,i)=>i).filter(i=>!fixed.has(i));return{prescribed,loaded,free};
}
function rms(v){return Math.sqrt(v.reduce((s,x)=>s+x*x,0)/Math.max(1,v.length))}

export function solveFlexibleConnectionPlateAtDisplacement(input={},targetDisplacement=0,initial=null){
  const c=normalizeConnectionPlateConfig(input),mesh=makeMesh(c),bolts=normalizeBolts(input.bolts,c,mesh),nd=mesh.nodes.length*2,u=Array.isArray(initial)&&initial.length===nd?[...initial]:Array(nd).fill(0),bc=freeAndPrescribed(c,mesh,Math.max(0,finite(targetDisplacement)));for(const [d,v] of bc.prescribed)u[d]=v;let state=assemble(c,mesh,bolts,u),iterations=0,converged=false,residualNorm=Infinity;
  const scale=Math.max(1,c.E*c.thickness*c.width*Math.max(c.edgeDisplacementMax,1e-5)/Math.max(c.length,1e-3));
  for(let it=0;it<c.maxIterations;it++){iterations=it+1;const R=bc.free.map(d=>state.f[d]);residualNorm=rms(R);const tol=Math.max(c.absoluteTolerance,c.relativeTolerance*scale);if(residualNorm<=tol){converged=true;break}const Kff=bc.free.map(i=>bc.free.map(j=>state.K[i][j]));let du;try{du=solveLinear(Kff,R.map(v=>-v))}catch(err){return{converged:false,iterations,residualNorm,error:err?.message||String(err),u,state,config:c,mesh,bolts}}
    let alpha=1,best=null,bestNorm=residualNorm;for(let ls=0;ls<10;ls++){const trial=[...u];bc.free.forEach((d,i)=>trial[d]+=alpha*du[i]);for(const [d,v] of bc.prescribed)trial[d]=v;const st=assemble(c,mesh,bolts,trial),rn=rms(bc.free.map(d=>st.f[d]));if(rn<bestNorm){best={u:trial,state:st};bestNorm=rn}if(rn<=residualNorm*(1-1e-4*alpha))break;alpha*=.5}if(best){for(let i=0;i<nd;i++)u[i]=best.u[i];state=best.state}else{bc.free.forEach((d,i)=>u[d]+=du[i]*.05);for(const [d,v] of bc.prescribed)u[d]=v;state=assemble(c,mesh,bolts,u)}
  }
  const tol=Math.max(c.absoluteTolerance,c.relativeTolerance*scale);if(!converged){residualNorm=rms(bc.free.map(d=>state.f[d]));converged=residualNorm<=tol*5}
  const edgeInternal=bc.loaded.reduce((s,d)=>s+state.f[d],0),appliedLoad=edgeInternal,totalBoltFx=state.bolts.reduce((s,b)=>s+b.force.fx,0),totalBoltFy=state.bolts.reduce((s,b)=>s+b.force.fy,0),maxVm=Math.max(0,...state.elements.map(e=>e.maxVm)),yieldedAreaFraction=state.elements.reduce((s,e)=>s+e.yieldedFraction,0)/(state.elements.length||1),maxPlasticStrain=Math.max(0,...state.elements.map(e=>e.plasticStrain));
  return{type:'connection-plate-membrane-2d-state',solverVersion:'0.30.4',config:c,mesh,u,state,converged,iterations,residualNorm,edgeDisplacement:Math.max(0,finite(targetDisplacement)),appliedLoad,totalBoltFx,totalBoltFy,maxVm,yieldedAreaFraction,maxPlasticStrain,equilibrium:{fxResidual:appliedLoad-totalBoltFx,relativeFxResidual:(appliedLoad-totalBoltFx)/Math.max(1,Math.abs(appliedLoad))}};
}

export function solveFlexibleConnectionPlate(input={}){
  const c=normalizeConnectionPlateConfig(input),curve=[],states=[];let prev=null,failedAt=null;
  for(let step=0;step<=c.steps;step++){const delta=c.edgeDisplacementMax*step/c.steps,sol=solveFlexibleConnectionPlateAtDisplacement({...input,...c},delta,prev);curve.push({step,lambda:c.edgeDisplacementMax>EPS?delta/c.edgeDisplacementMax:0,displacement:delta,displacementMm:delta*1000,load:sol.appliedLoad,maxVm:sol.maxVm,maxVmMPa:sol.maxVm/1000,yieldedAreaFraction:sol.yieldedAreaFraction,maxPlasticStrain:sol.maxPlasticStrain,activeBolts:sol.state.bolts.filter(b=>b.state!=='gap').length,iterations:sol.iterations,residualNorm:sol.residualNorm,converged:sol.converged});states.push(sol);if(!sol.converged){failedAt=step;break}prev=sol.u}
  const final=states.at(-1),peak=curve.reduce((a,b)=>!a||Math.abs(b.load)>Math.abs(a.load)?b:a,null),firstContact=curve.find(p=>p.activeBolts>0)||null,firstYield=curve.find(p=>p.yieldedAreaFraction>0)||null;
  return{type:'connection-plate-membrane-2d',solverVersion:'0.30.4',control:'edge-displacement',config:c,curve,final,peak,events:{firstContact,firstYield},diagnostics:{failedAt,converged:failedAt==null,maxVmMPa:(final?.maxVm||0)/1000,yieldedAreaFraction:final?.yieldedAreaFraction||0,maxPlasticStrain:final?.maxPlasticStrain||0,equilibrium:final?.equilibrium||null},assumptions:['chapa modelada por elementos Q4 de membrana em estado plano de tensões','pequenas deformações geométricas no plano','plasticização monotônica por relação bilinear secante governada por tensão equivalente de von Mises','contato parafuso–furo unilateral radial interpolado no interior da malha','parafusos referidos a um corpo rígido; sem atrito pré-contato ou pré-tensão','não inclui rasgamento de borda, block shear, prying fora do plano nem resistência normativa automática']};
}
