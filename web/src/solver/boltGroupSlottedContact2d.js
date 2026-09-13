import {generateRectangularBoltGroup} from './boltGroup2d.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]]),scale=Math.max(EPS,...A.flat().map(v=>Math.abs(v)));
  for(let k=0;k<3;k++){
    let p=k;
    for(let i=k+1;i<3;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;
    if(Math.abs(M[p][k])<=scale*1e-14)throw new Error('Contato em furo oblongo: tangente singular. Verifique geometria, rigidez e padrão de contato.');
    if(p!==k)[M[p],M[k]]=[M[k],M[p]];
    const d=M[k][k];
    for(let j=k;j<4;j++)M[k][j]/=d;
    for(let i=0;i<3;i++){
      if(i===k)continue;
      const f=M[i][k];
      for(let j=k;j<4;j++)M[i][j]-=f*M[k][j];
    }
  }
  return M.map(r=>r[3]);
}

function mat3(){return[[0,0,0],[0,0,0],[0,0,0]]}
function addOuter(K,v,k){for(let i=0;i<3;i++)for(let j=0;j<3;j++)K[i][j]+=k*v[i]*v[j]}
function noGapStiffness(bolts){
  const K=mat3();
  for(const b of bolts){
    addOuter(K,[1,0,-b.y],b.k);
    addOuter(K,[0,1,b.x],b.k);
  }
  return K;
}
function loadVector(loads){
  const fx=finite(loads?.fx),fy=finite(loads?.fy),mz=finite(loads?.mz),ex=finite(loads?.loadPointX),ey=finite(loads?.loadPointY);
  return{fx,fy,mz,ex,ey,totalMz:mz+ex*fy-ey*fx,P:[fx,fy,mz+ex*fy-ey*fx]};
}
function boltLaw(p,b){
  if(!(p>0))return{force:0,tangent:0,state:'gap'};
  const k=Math.max(EPS,b.k),yieldForce=Math.max(0,b.yieldForce),post=Math.max(0,b.postYieldRatio);
  if(!(yieldForce>0))return{force:k*p,tangent:k,state:'bearing-elastic'};
  const py=yieldForce/k;
  if(p<=py)return{force:k*p,tangent:k,state:'bearing-elastic'};
  return{force:yieldForce+post*k*(p-py),tangent:post*k,state:post>EPS?'bearing-postyield':'bearing-capped'};
}

/**
 * Capsule-hole kinematics. The free region is a segment of half-length a,
 * thickened by the radial clearance g. a=0 exactly recovers a circular hole.
 */
function contactKinematics(dx,dy,b){
  const a=Math.max(0,b.slotHalfLength),angle=finite(b.slotAngle),cx=Math.cos(angle),cy=Math.sin(angle);
  const along=dx*cx+dy*cy,slotCoordinate=clamp(along,-a,a),qx=slotCoordinate*cx,qy=slotCoordinate*cy;
  const vx=dx-qx,vy=dy-qy,normalDistance=Math.hypot(vx,vy),penetration=normalDistance-b.gap;
  const nx=normalDistance>EPS?vx/normalDistance:0,ny=normalDistance>EPS?vy/normalDistance:0;
  return{
    relativeMagnitude:Math.hypot(dx,dy),along,slotCoordinate,closestPoint:{x:qx,y:qy},contactNormal:{x:nx,y:ny},normalDistance,
    penetration:Math.max(0,penetration),insideClearance:penetration<=0
  };
}

function clearanceBoundaryAlong(dx,dy,b){
  const r=Math.hypot(dx,dy),reach=Math.max(0,b.gap+b.slotHalfLength);
  if(r<=EPS||reach<=EPS)return 0;
  const ux=dx/r,uy=dy/r;let lo=0,hi=reach*(1+1e-8)+1e-12;
  for(let i=0;i<50;i++){
    const mid=.5*(lo+hi),kin=contactKinematics(ux*mid,uy*mid,b);
    if(kin.normalDistance<=b.gap)lo=mid;else hi=mid;
  }
  return .5*(lo+hi);
}

function responseAt(q,bolts){
  const [ux,uy,theta]=q,transferred=[0,0,0],items=[];
  for(const b of bolts){
    const dx=ux-theta*b.y,dy=uy+theta*b.x,kin=contactKinematics(dx,dy,b),law=boltLaw(kin.penetration,b);
    let fx=0,fy=0;
    if(law.force>0){fx=law.force*kin.contactNormal.x;fy=law.force*kin.contactNormal.y}
    const mz=-b.y*fx+b.x*fy;
    transferred[0]+=fx;transferred[1]+=fy;transferred[2]+=mz;
    items.push({...b,hole:{type:b.slotHalfLength>EPS?'slotted':'circular',gap:b.gap,slotHalfLength:b.slotHalfLength,slotLength:2*b.slotHalfLength,slotAngle:b.slotAngle},relativeDisplacement:{x:dx,y:dy,magnitude:kin.relativeMagnitude},slotCoordinate:kin.slotCoordinate,closestPoint:kin.closestPoint,contactNormal:kin.contactNormal,normalDistance:kin.normalDistance,penetration:kin.penetration,force:{fx,fy,magnitude:law.force,moment:mz},state:law.state,tangent:law.tangent,utilization:b.shearCapacity>EPS?law.force/b.shearCapacity:null});
  }
  return{transferred,items};
}
function jacobian(q,bolts,hBase=1e-7){
  const J=mat3();
  for(let j=0;j<3;j++){
    const h=Math.max(1e-10,hBase*Math.max(1,Math.abs(q[j]))),qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;
    const fp=responseAt(qp,bolts).transferred,fm=responseAt(qm,bolts).transferred;
    for(let i=0;i<3;i++)J[i][j]=(fp[i]-fm[i])/(2*h);
  }
  return J;
}
function residualNorm(R,P,L){
  const fs=Math.max(1,Math.hypot(P[0],P[1])),ms=Math.max(1,Math.abs(P[2]),fs*Math.max(.01,L));
  return Math.sqrt((R[0]/fs)**2+(R[1]/fs)**2+(R[2]/ms)**2);
}
function predictor(P,bolts){
  const K=noGapStiffness(bolts);let q=solve3(K,P),scale=1;
  for(const b of bolts){
    const dx=q[0]-q[2]*b.y,dy=q[1]+q[2]*b.x,r=Math.hypot(dx,dy);
    if(r>EPS){const free=clearanceBoundaryAlong(dx,dy,b);scale=Math.max(scale,1+free/r)}
  }
  if(scale>1)q=q.map(v=>v*scale);
  return q;
}

export function generateSlottedContactBoltGroup({nx=2,ny=2,spacingX=.20,spacingY=.15,bearingStiffness=250000,gap=.001,slotLength=.012,slotAngle=0,shearCapacity=80,yieldForce=0,postYieldRatio=.02}={}){
  const half=.5*Math.max(0,finite(slotLength,.012)),angle=finite(slotAngle);
  return generateRectangularBoltGroup({nx,ny,spacingX,spacingY,kx:1,ky:1,shearCapacity}).map(b=>({id:b.id,x:b.x,y:b.y,k:Math.max(EPS,finite(bearingStiffness,250000)),gap:Math.max(0,finite(gap,.001)),slotHalfLength:half,slotAngle:angle,shearCapacity:Math.max(0,finite(shearCapacity,80)),yieldForce:Math.max(0,finite(yieldForce)),postYieldRatio:Math.max(0,finite(postYieldRatio,.02))}));
}

/** Nonlinear rigid-plate contact against circular or capsule/slotted bolt holes. */
export function solveBoltGroupSlottedClearanceContact({bolts=[],loads={},steps=12,maxIterations=60,tolerance=1e-9}={}){
  const bs=(Array.isArray(bolts)?bolts:[]).map((b,i)=>{
    const slotHalfLength=b.slotHalfLength!=null?finite(b.slotHalfLength):.5*finite(b.slotLength,0);
    return{id:String(b.id||`B${i+1}`),x:finite(b.x),y:finite(b.y),k:Math.max(EPS,finite(b.k??b.bearingStiffness,250000)),gap:Math.max(0,finite(b.gap,.001)),slotHalfLength:Math.max(0,slotHalfLength),slotAngle:finite(b.slotAngle),shearCapacity:Math.max(0,finite(b.shearCapacity)),yieldForce:Math.max(0,finite(b.yieldForce)),postYieldRatio:Math.max(0,finite(b.postYieldRatio,.02))};
  });
  if(bs.length<2)throw new Error('Contato em furo oblongo: informe ao menos dois parafusos.');
  const L=Math.max(.01,...bs.map(b=>Math.hypot(b.x,b.y)+b.slotHalfLength)),lv=loadVector(loads),nSteps=Math.max(1,Math.min(100,Math.round(finite(steps,12)))),tol=Math.max(1e-12,finite(tolerance,1e-9)),history=[];let q=[0,0,0],last=null;
  for(let step=1;step<=nSteps;step++){
    const lambda=step/nSteps,P=lv.P.map(v=>v*lambda);if(step===1)q=predictor(P,bs);
    let converged=false,iterations=0,norm=Infinity;
    for(iterations=1;iterations<=maxIterations;iterations++){
      const state=responseAt(q,bs),R=P.map((v,i)=>v-state.transferred[i]);norm=residualNorm(R,P,L);if(norm<=tol){last=state;converged=true;break}
      const J=jacobian(q,bs),scale=Math.max(EPS,...J.flat().map(v=>Math.abs(v))),reg=scale*1e-10;for(let i=0;i<3;i++)J[i][i]+=reg;
      const dq=solve3(J,R);let accepted=false,alpha=1;
      for(let ls=0;ls<14;ls++){const trial=q.map((v,i)=>v+alpha*dq[i]),st=responseAt(trial,bs),Rt=P.map((v,i)=>v-st.transferred[i]),nt=residualNorm(Rt,P,L);if(nt<norm||alpha<1e-4){q=trial;accepted=true;break}alpha*=.5}
      if(!accepted)q=q.map((v,i)=>v+dq[i]*1e-4);
    }
    if(!converged){const state=responseAt(q,bs),R=P.map((v,i)=>v-state.transferred[i]);norm=residualNorm(R,P,L);if(norm>Math.max(tol*10,1e-7))throw new Error(`Contato em furo oblongo: Newton não convergiu no passo ${step}/${nSteps} (resíduo ${norm.toExponential(3)}).`);last=state}
    history.push({step,lambda,iterations,residualNorm:norm,plateDisplacement:{ux:q[0],uy:q[1],theta:q[2]},activeBolts:last.items.filter(b=>b.state!=='gap').length,maxBoltForce:Math.max(0,...last.items.map(b=>b.force.magnitude))});
  }
  const final=responseAt(q,bs),R=lv.P.map((v,i)=>v-final.transferred[i]),rn=residualNorm(R,lv.P,L),maxBolt=final.items.reduce((a,b)=>!a||b.force.magnitude>a.force.magnitude?b:a,null),maxUtilization=Math.max(0,...final.items.map(b=>b.utilization??0));
  return{type:'bolt-group-slotted-clearance-contact-2d',solverVersion:'0.30.1',bolts:final.items,plateDisplacement:{ux:q[0],uy:q[1],theta:q[2]},loads:{...lv},equilibrium:{transferred:{fx:final.transferred[0],fy:final.transferred[1],mz:final.transferred[2]},residual:{fx:R[0],fy:R[1],mz:R[2]},residualNorm:rn},history,maxBolt,maxUtilization,activeBolts:final.items.filter(b=>b.state!=='gap').length,assumptions:['placa rígida no plano','furo circular ou oblongo idealizado como cápsula (trecho reto + extremidades semicirculares)','movimento livre sem força dentro da folga e do comprimento do rasgo','contato unilateral normal ao contorno após fechamento da folga','lei normal elástica ou bilinear de bearing definida pelo usuário','Newton-Raphson incremental com tangente numérica','sem atrito, pré-tensão, prying, flexibilidade explícita da chapa ou resistência normativa automática']};
}
