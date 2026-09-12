import { spatialAxes } from './spatial3d.js';

const EPS=1e-12;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('Co-rotacional 3D: vetor degenerado.');return scale(a,1/n)};
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const matMul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const identity3=()=>[[1,0,0],[0,1,0],[0,0,1]];
const columns=(x,y,z)=>[[x[0],y[0],z[0]],[x[1],y[1],z[1]],[x[2],y[2],z[2]]];

function skew(v){return[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]}
function addMatrices(A,B){return A.map((r,i)=>r.map((v,j)=>v+B[i][j]))}
function scaleMatrix(A,s){return A.map(r=>r.map(v=>v*s))}

/** Rodrigues exponential map: global rotation vector -> proper orthogonal matrix. */
export function rotationVectorToMatrix(theta=[0,0,0]){
  const a=[Number(theta[0])||0,Number(theta[1])||0,Number(theta[2])||0],angle=norm(a);
  if(angle<1e-10){const K=skew(a);return addMatrices(identity3(),K)}
  const axis=scale(a,1/angle),K=skew(axis),K2=matMul(K,K);
  return addMatrices(addMatrices(identity3(),scaleMatrix(K,Math.sin(angle))),scaleMatrix(K2,1-Math.cos(angle)));
}

/** SO(3) logarithm map, returned in the local coordinates of the supplied matrix. */
export function matrixToRotationVector(R){
  const c=clamp((R[0][0]+R[1][1]+R[2][2]-1)/2,-1,1),angle=Math.acos(c);
  if(angle<1e-9)return[(R[2][1]-R[1][2])/2,(R[0][2]-R[2][0])/2,(R[1][0]-R[0][1])/2];
  if(Math.PI-angle<1e-6){
    const xx=Math.max(0,(R[0][0]+1)/2),yy=Math.max(0,(R[1][1]+1)/2),zz=Math.max(0,(R[2][2]+1)/2);let axis=[Math.sqrt(xx),Math.sqrt(yy),Math.sqrt(zz)];
    if(R[0][1]<0)axis[1]*=-1;if(R[0][2]<0)axis[2]*=-1;if(norm(axis)<EPS)axis=[1,0,0];axis=unit(axis);return scale(axis,angle);
  }
  const s=2*Math.sin(angle),axis=[(R[2][1]-R[1][2])/s,(R[0][2]-R[2][0])/s,(R[1][0]-R[0][1])/s];
  return scale(axis,angle);
}

function nodePosition(node,u,offset){return[Number(node.x||0)+Number(u[offset]||0),Number(node.y||0)+Number(u[offset+1]||0),Number(node.z||0)+Number(u[offset+2]||0)]}
function nodeRotation(u,offset){return rotationVectorToMatrix([Number(u[offset+3]||0),Number(u[offset+4]||0),Number(u[offset+5]||0)])}

/**
 * Element-level co-rotational kinematics for a spatial Euler-Bernoulli frame.
 *
 * The element frame follows the current chord. Its local y axis is obtained by
 * projecting the mean of the two rotated end y axes onto the plane normal to
 * the chord. Therefore a common finite rigid-body rotation is filtered out.
 *
 * This v0.30 foundation intentionally returns kinematics only. Global internal
 * forces and the consistent tangent are connected in the next solver stage.
 */
export function corotationalFrame3DKinematics(a,b,e={},elementDisplacements=[]){
  if(!Array.isArray(elementDisplacements)||elementDisplacements.length!==12)throw new Error('Co-rotacional 3D: vetor do elemento deve possuir 12 DOFs.');
  const initial=spatialAxes(a,b,e),C0=transpose(initial.R),x1=nodePosition(a,elementDisplacements,0),x2=nodePosition(b,elementDisplacements,6),chord=sub(x2,x1),L=norm(chord);
  if(!(L>1e-10))throw new Error(`Co-rotacional 3D: elemento ${e.id||''} colapsou para comprimento nulo.`);
  const ex=unit(chord),Q1=nodeRotation(elementDisplacements,0),Q2=nodeRotation(elementDisplacements,6),ey0=initial.ey;
  const ey1=matVec(Q1,ey0),ey2=matVec(Q2,ey0),meanY=add(ey1,ey2);let eyCandidate=sub(meanY,scale(ex,dot(meanY,ex)));
  if(norm(eyCandidate)<1e-9){const transported=matVec(Q1,ey0);eyCandidate=sub(transported,scale(ex,dot(transported,ex)))}
  if(norm(eyCandidate)<1e-9){const fallback=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];eyCandidate=sub(fallback,scale(ex,dot(fallback,ex)))}
  const ey=unit(eyCandidate),ez=unit(cross(ex,ey)),C=columns(ex,ey,ez),Ct=transpose(C);
  const relative1=matMul(Ct,matMul(Q1,C0)),relative2=matMul(Ct,matMul(Q2,C0)),theta1=matrixToRotationVector(relative1),theta2=matrixToRotationVector(relative2);
  return{
    initialLength:initial.L,
    currentLength:L,
    axial:L-initial.L,
    currentAxes:{ex,ey,ez,R:[ex,ey,ez],C},
    initialAxes:{ex:initial.ex,ey:initial.ey,ez:initial.ez,R:initial.R,C:C0},
    endRotations:{i:theta1,j:theta2},
    basic:[L-initial.L,...theta1,...theta2],
    currentPositions:{i:x1,j:x2},
    rotationMatrices:{i:Q1,j:Q2},
    relativeRotationMatrices:{i:relative1,j:relative2}
  };
}

export function rigidBodyDisplacement3D(node,rotationVector=[0,0,0],translation=[0,0,0]){
  const Q=rotationVectorToMatrix(rotationVector),x=[Number(node.x)||0,Number(node.y)||0,Number(node.z)||0],xr=add(matVec(Q,x),translation);
  return [...sub(xr,x),...rotationVector.map(Number)];
}
