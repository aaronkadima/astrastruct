const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export const DEFAULT_BOLT_GROUP={
  bolts:[
    {id:'B1',x:-0.10,y:-0.075,kx:250000,ky:250000,shearCapacity:80},
    {id:'B2',x: 0.10,y:-0.075,kx:250000,ky:250000,shearCapacity:80},
    {id:'B3',x: 0.10,y: 0.075,kx:250000,ky:250000,shearCapacity:80},
    {id:'B4',x:-0.10,y: 0.075,kx:250000,ky:250000,shearCapacity:80}
  ],
  loads:{fx:40,fy:25,mz:8,loadPointX:0,loadPointY:0}
};

function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]]),scale=Math.max(EPS,...A.flat().map(v=>Math.abs(v)));
  for(let k=0;k<3;k++){
    let p=k;for(let i=k+1;i<3;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;
    if(Math.abs(M[p][k])<=scale*1e-12)throw new Error('Grupo de parafusos: matriz de rigidez singular. Verifique a quantidade, posição e rigidez dos parafusos.');
    if(p!==k)[M[p],M[k]]=[M[k],M[p]];
    const d=M[k][k];for(let j=k;j<4;j++)M[k][j]/=d;
    for(let i=0;i<3;i++){if(i===k)continue;const f=M[i][k];for(let j=k;j<4;j++)M[i][j]-=f*M[k][j]}
  }
  return M.map(r=>r[3]);
}

function determinant3(A){return A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0])}
function addOuter(K,v,k){for(let i=0;i<3;i++)for(let j=0;j<3;j++)K[i][j]+=k*v[i]*v[j]}

export function generateRectangularBoltGroup({nx=2,ny=2,spacingX=.20,spacingY=.15,kx=250000,ky=250000,shearCapacity=80}={}){
  nx=Math.max(1,Math.round(finite(nx,2)));ny=Math.max(1,Math.round(finite(ny,2)));if(nx*ny<2)throw new Error('Grupo de parafusos: informe ao menos dois parafusos.');
  const sx=Math.max(0,finite(spacingX,.20)),sy=Math.max(0,finite(spacingY,.15)),out=[];let n=1;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)out.push({id:`B${n++}`,x:(i-(nx-1)/2)*sx,y:(j-(ny-1)/2)*sy,kx:Math.max(0,finite(kx)),ky:Math.max(0,finite(ky)),shearCapacity:Math.max(0,finite(shearCapacity))});
  return out;
}

/**
 * Linear in-plane bolt-group analysis with a rigid plate.
 * DOFs are plate translations ux, uy and small rotation theta about z.
 * Each bolt is represented by independent translational springs kx, ky.
 * All inputs must use a consistent force-length unit system.
 */
export function solveRigidPlateBoltGroup(input={}){
  const bolts=(Array.isArray(input.bolts)?input.bolts:DEFAULT_BOLT_GROUP.bolts).map((b,i)=>({
    id:String(b.id||`B${i+1}`),x:finite(b.x),y:finite(b.y),kx:Math.max(0,finite(b.kx)),ky:Math.max(0,finite(b.ky)),shearCapacity:Math.max(0,finite(b.shearCapacity))
  }));
  if(bolts.length<2)throw new Error('Grupo de parafusos: informe ao menos dois parafusos.');
  if(!bolts.some(b=>b.kx>EPS)||!bolts.some(b=>b.ky>EPS))throw new Error('Grupo de parafusos: rigidez translacional insuficiente em x ou y.');

  const loads={...(DEFAULT_BOLT_GROUP.loads||{}),...(input.loads||{})},fx=finite(loads.fx),fy=finite(loads.fy),mz=finite(loads.mz),loadPointX=finite(loads.loadPointX),loadPointY=finite(loads.loadPointY),totalMz=mz+loadPointX*fy-loadPointY*fx;
  const K=[[0,0,0],[0,0,0],[0,0,0]];
  for(const b of bolts){addOuter(K,[1,0,-b.y],b.kx);addOuter(K,[0,1,b.x],b.ky)}
  const rhs=[fx,fy,totalMz],q=solve3(K,rhs),[ux,uy,theta]=q;
  const results=bolts.map(b=>{
    const dx=ux-theta*b.y,dy=uy+theta*b.x,bfx=b.kx*dx,bfy=b.ky*dy,magnitude=Math.hypot(bfx,bfy),moment=b.x*bfy-b.y*bfx,utilization=b.shearCapacity>EPS?magnitude/b.shearCapacity:null;
    return{...b,displacement:{x:dx,y:dy,magnitude:Math.hypot(dx,dy)},force:{fx:bfx,fy:bfy,magnitude,moment},reactionOnPlate:{fx:-bfx,fy:-bfy,mz:-moment},utilization};
  });
  const sums=results.reduce((a,b)=>({fx:a.fx+b.force.fx,fy:a.fy+b.force.fy,mz:a.mz+b.force.moment}),{fx:0,fy:0,mz:0}),residual={fx:fx-sums.fx,fy:fy-sums.fy,mz:totalMz-sums.mz};
  const sx=bolts.reduce((s,b)=>s+b.kx,0),sy=bolts.reduce((s,b)=>s+b.ky,0),centerOfRigidity={x:sy>EPS?bolts.reduce((s,b)=>s+b.ky*b.x,0)/sy:0,y:sx>EPS?bolts.reduce((s,b)=>s+b.kx*b.y,0)/sx:0};
  const maxBolt=results.reduce((a,b)=>!a||b.force.magnitude>a.force.magnitude?b:a,null),maxUtilization=results.reduce((m,b)=>Math.max(m,b.utilization??0),0),externalWork=.5*(fx*ux+fy*uy+totalMz*theta),residualNorm=Math.hypot(residual.fx,residual.fy,residual.mz/Math.max(1,Math.max(...bolts.map(b=>Math.hypot(b.x,b.y)))));
  return{
    type:'bolt-group-rigid-plate-2d',solverVersion:'0.30.0',bolts:results,plateDisplacement:{ux,uy,theta},loads:{fx,fy,mz,loadPointX,loadPointY,totalMz},stiffnessMatrix:K,determinant:determinant3(K),centerOfRigidity,equilibrium:{transferred:sums,residual,residualNorm},maxBolt,maxUtilization,externalWork,
    assumptions:['placa rígida no plano','pequenas rotações','molas lineares independentes kx/ky por parafuso','sem contato, atrito, folga, bearing ou plastificação automática','capacidade cortante, quando informada, é apenas um limite definido pelo usuário']
  };
}
