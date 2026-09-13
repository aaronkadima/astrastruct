const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]]),scale=Math.max(EPS,...A.flat().map(v=>Math.abs(v)));
  for(let k=0;k<3;k++){
    let p=k;for(let i=k+1;i<3;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;
    if(Math.abs(M[p][k])<=scale*1e-13)throw new Error('Punção: perímetro degenerado ou sem rigidez geométrica para distribuir momentos.');
    if(p!==k)[M[p],M[k]]=[M[k],M[p]];
    const d=M[k][k];for(let j=k;j<4;j++)M[k][j]/=d;
    for(let i=0;i<3;i++){if(i===k)continue;const f=M[i][k];for(let j=k;j<4;j++)M[i][j]-=f*M[k][j]}
  }
  return M.map(r=>r[3]);
}

export function rectangularCriticalPerimeter({columnX=.30,columnY=.30,offset=.40}={}){
  const bx=Math.max(EPS,finite(columnX,.30)),by=Math.max(EPS,finite(columnY,.30)),a=Math.max(0,finite(offset,.40)),hx=bx/2+a,hy=by/2+a;
  return[{x:-hx,y:-hy},{x:hx,y:-hy},{x:hx,y:hy},{x:-hx,y:hy}];
}

function normalizePerimeter(points){
  if(!Array.isArray(points)||points.length<3)throw new Error('Punção: informe um perímetro fechado com pelo menos três vértices.');
  const out=points.map((p,i)=>({x:finite(p?.x),y:finite(p?.y),id:p?.id||`P${i+1}`}));
  let length=0;for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length];length+=Math.hypot(b.x-a.x,b.y-a.y)}if(!(length>EPS))throw new Error('Punção: perímetro crítico degenerado.');
  return out;
}

/** Exact line integrals of 1,x,y,x²,xy,y² over the closed polygon boundary. */
export function perimeterLineIntegrals(points){
  const p=normalizePerimeter(points);let I0=0,Ix=0,Iy=0,Ixx=0,Ixy=0,Iyy=0;
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<=EPS)continue;
    I0+=L;Ix+=L*(a.x+b.x)/2;Iy+=L*(a.y+b.y)/2;
    Ixx+=L*(a.x*a.x+a.x*b.x+b.x*b.x)/3;Iyy+=L*(a.y*a.y+a.y*b.y+b.y*b.y)/3;
    Ixy+=L*(a.x*a.y+(a.x*dy+a.y*dx)/2+dx*dy/3);
  }
  return{I0,Ix,Iy,Ixx,Ixy,Iyy,centroid:{x:Ix/I0,y:Iy/I0}};
}

function samplePerimeter(points,perEdge=40){
  const p=normalizePerimeter(points),n=Math.max(2,Math.min(500,Math.round(finite(perEdge,40)))),samples=[];let s0=0;
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],L=Math.hypot(b.x-a.x,b.y-a.y);for(let j=0;j<n;j++){const t=j/n;samples.push({edge:i,t,s:s0+t*L,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}s0+=L;
  }
  samples.push({edge:p.length-1,t:1,s:s0,x:p[0].x,y:p[0].y});return samples;
}

/**
 * Mechanics-only punching demand distribution on a critical perimeter.
 * q(s)=a+b*x+c*y [force/length]. For a vertical shear resultant V, the
 * sign convention is Mx=∮y q ds and My=-∮x q ds. Stress tau=q/d.
 */
export function solvePunchingPerimeterDemand({perimeter,effectiveDepth=.20,V=500,Mx=0,My=0,samplesPerEdge=40}={}){
  const pts=normalizePerimeter(perimeter),d=Math.max(EPS,finite(effectiveDepth,.20)),ints=perimeterLineIntegrals(pts),G=[[ints.I0,ints.Ix,ints.Iy],[ints.Ix,ints.Ixx,ints.Ixy],[ints.Iy,ints.Ixy,ints.Iyy]],target=[finite(V),-finite(My),finite(Mx)],coeff=solve3(G,target),[a,b,c]=coeff,samples=samplePerimeter(pts,samplesPerEdge).map(p=>{const q=a+b*p.x+c*p.y,tau=q/d;return{...p,q,tau}});
  const min=samples.reduce((m,p)=>p.tau<m.tau?p:m,samples[0]),max=samples.reduce((m,p)=>p.tau>m.tau?p:m,samples[0]),maxAbs=samples.reduce((m,p)=>Math.abs(p.tau)>Math.abs(m.tau)?p:m,samples[0]),average=finite(V)/(ints.I0*d),amplification=Math.abs(average)>EPS?Math.abs(maxAbs.tau/average):null;
  const recovered={V:a*ints.I0+b*ints.Ix+c*ints.Iy,My:-(a*ints.Ix+b*ints.Ixx+c*ints.Ixy),Mx:a*ints.Iy+b*ints.Ixy+c*ints.Iyy},residual={V:finite(V)-recovered.V,Mx:finite(Mx)-recovered.Mx,My:finite(My)-recovered.My},residualNorm=Math.hypot(residual.V,residual.Mx/Math.max(d,1),residual.My/Math.max(d,1));
  return{type:'punching-perimeter-demand',solverVersion:'0.30.0',perimeter:pts,effectiveDepth:d,actions:{V:finite(V),Mx:finite(Mx),My:finite(My)},lineIntegrals:ints,coefficients:{a,b,c},samples,perimeterLength:ints.I0,averageStress:average,extrema:{min,max,maxAbs},amplification,equilibrium:{recovered,residual,residualNorm},assumptions:['distribuição linear de fluxo cortante q=a+b·x+c·y no perímetro','profundidade efetiva d constante','ações V/Mx/My referidas à origem do perímetro','kernel de demanda: nenhuma resistência normativa é calculada']};
}
