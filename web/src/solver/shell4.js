import { zeros } from './matrix.js';

const EPS=1e-12;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('shell4: vetor geométrico degenerado.');return a.map(v=>v/n)};
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));
const addScaled=(K,Q,s)=>{for(let i=0;i<K.length;i++)for(let j=0;j<K[i].length;j++)K[i][j]+=s*Q[i][j]};
const btDb=(B,D)=>mm(transpose(B),mm(D,B));

function p3(n){return[Number(n.x)||0,Number(n.y)||0,Number(n.z)||0]}

export function shell4LocalAxes(nodes,e={}){
  if(!Array.isArray(nodes)||nodes.length!==4)throw new Error(`shell4 ${e.id||''}: são necessários quatro nós.`);
  const p=nodes.map(p3),ex=unit(sub(p[1],p[0])),rawNormal=cross(sub(p[1],p[0]),sub(p[3],p[0])),ez=unit(rawNormal),ey=unit(cross(ez,ex));
  const local=p.map(q=>{const d=sub(q,p[0]);return{x:dot(d,ex),y:dot(d,ey),z:dot(d,ez)}}),span=Math.max(1,...local.map(q=>Math.hypot(q.x,q.y))),warp=Math.max(...local.map(q=>Math.abs(q.z)));
  if(warp>Math.max(1e-8,span*1e-6))throw new Error(`shell4 ${e.id||''}: nós não são coplanares (desvio ${warp.toExponential(3)} m).`);
  const R=[ex,ey,ez];return{ex,ey,ez,R,origin:p[0],local:local.map(q=>[q.x,q.y]),warp};
}

function transform24(R){const T=zeros(24);for(let n=0;n<4;n++)for(const o of [6*n,6*n+3])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[o+i][o+j]=R[i][j];return T}
function shape(xi,eta){return[
  .25*(1-xi)*(1-eta),.25*(1+xi)*(1-eta),.25*(1+xi)*(1+eta),.25*(1-xi)*(1+eta)
]}
function shapeNaturalDerivatives(xi,eta){return{
  xi:[-.25*(1-eta),.25*(1-eta),.25*(1+eta),-.25*(1+eta)],
  eta:[-.25*(1-xi),-.25*(1+xi),.25*(1+xi),.25*(1-xi)]
}}
function pointKinematics(coords,xi,eta){
  const N=shape(xi,eta),d=shapeNaturalDerivatives(xi,eta);let j11=0,j12=0,j21=0,j22=0;
  for(let i=0;i<4;i++){j11+=d.xi[i]*coords[i][0];j12+=d.xi[i]*coords[i][1];j21+=d.eta[i]*coords[i][0];j22+=d.eta[i]*coords[i][1]}
  const detJ=j11*j22-j12*j21;if(!(detJ>1e-12))throw new Error('shell4: Jacobiano não positivo; verifique ordem dos nós/elemento degenerado.');const inv=[[j22/detJ,-j12/detJ],[-j21/detJ,j11/detJ]],dNdx=[],dNdy=[];
  for(let i=0;i<4;i++){dNdx.push(inv[0][0]*d.xi[i]+inv[0][1]*d.eta[i]);dNdy.push(inv[1][0]*d.xi[i]+inv[1][1]*d.eta[i])}
  return{N,dNdx,dNdy,detJ};
}
function bMatrices(coords,xi,eta){
  const q=pointKinematics(coords,xi,eta),Bm=zeros(3,24),Bb=zeros(3,24),Bs=zeros(2,24);
  for(let i=0;i<4;i++){const o=6*i,N=q.N[i],dx=q.dNdx[i],dy=q.dNdy[i];
    Bm[0][o]=dx;Bm[1][o+1]=dy;Bm[2][o]=dy;Bm[2][o+1]=dx;
    // Physical local rotations: rx=dw/dy, ry=-dw/dx in Kirchhoff limit.
    Bb[0][o+4]=dx;Bb[1][o+3]=-dy;Bb[2][o+3]=-dx;Bb[2][o+4]=dy;
    Bs[0][o+2]=dx;Bs[0][o+4]=N;Bs[1][o+2]=dy;Bs[1][o+3]=-N;
  }
  return{...q,Bm,Bb,Bs};
}
function constitutive(E,nu,t,shearCorrection=5/6){
  if(!(E>0&&t>0))throw new Error('shell4: E e espessura devem ser positivos.');if(!(nu>-0.99&&nu<.4999))throw new Error('shell4: coeficiente de Poisson inválido.');
  const C=[[1,nu,0],[nu,1,0],[0,0,(1-nu)/2]],cm=E*t/(1-nu*nu),cb=E*t**3/(12*(1-nu*nu)),G=E/(2*(1+nu)),cs=shearCorrection*G*t;
  return{Dm:C.map(r=>r.map(v=>v*cm)),Db:C.map(r=>r.map(v=>v*cb)),Ds:[[cs,0],[0,cs]],G,shearCorrection};
}
function polygonArea(coords){let a=0;for(let i=0;i<4;i++){const j=(i+1)%4;a+=coords[i][0]*coords[j][1]-coords[j][0]*coords[i][1]}return Math.abs(a)/2}

/** Four-node flat Mindlin-Reissner shell: membrane + bending + reduced-integration shear. */
export function shell4Element({nodes,E,nu,thickness,pressure=0,shearCorrection=5/6,drillingFactor=1e-6,element={}}){
  const axes=shell4LocalAxes(nodes,element),coords=axes.local,t=Number(thickness),mat=constitutive(Number(E),Number(nu),t,Number(shearCorrection)||5/6),K=zeros(24),pLocal=Array(24).fill(0),g=1/Math.sqrt(3),gauss=[[-g,-g],[g,-g],[g,g],[-g,g]];
  for(const [xi,eta] of gauss){const b=bMatrices(coords,xi,eta);addScaled(K,btDb(b.Bm,mat.Dm),b.detJ);addScaled(K,btDb(b.Bb,mat.Db),b.detJ);const N=b.N,p=Number(pressure)||0;for(let i=0;i<4;i++)pLocal[6*i+2]+=N[i]*p*b.detJ}
  // Selective reduced integration for transverse shear mitigates locking in thin slabs.
  const bs=bMatrices(coords,0,0);addScaled(K,btDb(bs.Bs,mat.Ds),4*bs.detJ);
  const area=polygonArea(coords),kDrill=Math.max(0,Number(drillingFactor)||0)*mat.G*t*area;for(let i=0;i<4;i++)K[6*i+5][6*i+5]+=kDrill/4;
  const T=transform24(axes.R),kg=mm(transpose(T),mm(K,T)),pg=mv(transpose(T),pLocal);
  return{kl:K,kg,T,pLocal,pg,axes,coords,area,thickness:t,E:Number(E),nu:Number(nu),constitutive:mat,drillingStiffness:kDrill};
}

/**
 * Surface mass matrix for shell4. massDensity is mass per volume in the active
 * unit system (e.g. t/m³ when forces are kN and g is expressed in m/s²).
 * Translational inertia uses rho*t; Mindlin rotations rx/ry use rho*t³/12.
 * Drilling rotation receives only an optional tiny regularizing inertia.
 */
export function shell4MassMatrix({nodes,massDensity,thickness,formulation='consistent',drillingRotaryFactor=1e-6,element={}}){
  const rho=Number(massDensity),t=Number(thickness);if(!(rho>0&&t>0))throw new Error('Massa shell4: densidade de massa e espessura devem ser positivas.');const axes=shell4LocalAxes(nodes,element),coords=axes.local,area=polygonArea(coords);if(!(area>EPS))throw new Error('Massa shell4: área degenerada.');const ml=zeros(24),kind=formulation==='lumped'?'lumped':'consistent',rotaryPerArea=rho*t**3/12,drill=Math.max(0,Number(drillingRotaryFactor)||0);
  if(kind==='lumped'){
    const mt=rho*t*area/4,jr=rotaryPerArea*area/4;for(let i=0;i<4;i++){const o=6*i;for(const d of [0,1,2])ml[o+d][o+d]=mt;for(const d of [3,4])ml[o+d][o+d]=jr;ml[o+5][o+5]=jr*drill}
  }else{
    const g=1/Math.sqrt(3),gauss=[[-g,-g],[g,-g],[g,g],[-g,g]];for(const [xi,eta] of gauss){const q=pointKinematics(coords,xi,eta);for(let i=0;i<4;i++)for(let j=0;j<4;j++){const w=q.N[i]*q.N[j]*q.detJ,oi=6*i,oj=6*j,mt=rho*t*w,jr=rotaryPerArea*w;for(const d of [0,1,2])ml[oi+d][oj+d]+=mt;for(const d of [3,4])ml[oi+d][oj+d]+=jr;ml[oi+5][oj+5]+=jr*drill}}
  }
  const T=transform24(axes.R),mg=mm(transpose(T),mm(ml,T)),totalMass=rho*t*area,totalRotaryMass=rotaryPerArea*area;
  return{ml,mg,T,axes,coords,area,thickness:t,massDensity:rho,totalMass,totalRotaryMass,formulation:kind,drillingRotaryFactor:drill};
}

export function recoverShell4(elementData,globalDisplacements){
  if(!Array.isArray(globalDisplacements)||globalDisplacements.length!==24)throw new Error('shell4: recuperação requer 24 deslocamentos globais.');const ul=mv(elementData.T,globalDisplacements),b=bMatrices(elementData.coords,0,0),eps=mv(b.Bm,ul),kappa=mv(b.Bb,ul),gamma=mv(b.Bs,ul),N=mv(elementData.constitutive.Dm,eps),M=mv(elementData.constitutive.Db,kappa),Q=mv(elementData.constitutive.Ds,gamma),stress=N.map(v=>v/elementData.thickness);
  return{localDisplacements:ul,membraneStrain:{ex:eps[0],ey:eps[1],gxy:eps[2]},membraneStress:{sx:stress[0],sy:stress[1],txy:stress[2]},membraneResultants:{Nx:N[0],Ny:N[1],Nxy:N[2]},curvature:{kx:kappa[0],ky:kappa[1],kxy:kappa[2]},bendingMoments:{Mx:M[0],My:M[1],Mxy:M[2]},transverseShearStrain:{gxz:gamma[0],gyz:gamma[1]},transverseShear:{Qx:Q[0],Qy:Q[1]}};
}
