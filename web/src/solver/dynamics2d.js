import { zeros, addSub, solveLinear, mul } from './matrix.js';
import { frameLocalStiffness, frameTransform, transpose, mm, prepareFrameElement } from './frameElement.js';
import { addNodalSprings } from './springs.js';
import { resolveScenario } from './scenario.js';
import { sectionDepth } from '../core/model.js';

const G0=9.80665,EPS=1e-12;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const identity=n=>{const I=zeros(n);for(let i=0;i<n;i++)I[i][i]=1;return I};
const symmetrize=A=>A.map((r,i)=>r.map((_,j)=>.5*(A[i][j]+A[j][i])));
const matAdd=(A,B,sa=1,sb=1)=>A.map((r,i)=>r.map((v,j)=>sa*v+sb*B[i][j]));
const matScale=(A,s)=>A.map(r=>r.map(v=>s*v));

function cholesky(A,label='Dinâmica'){
  const n=A.length,L=zeros(n),scale=Math.max(1,...A.map((r,i)=>Math.abs(r[i]))),tol=scale*1e-12;
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
    if(i===j){if(!(s>tol))throw new Error(`${label}: matriz de rigidez reduzida não é positiva definida. Verifique apoios, mecanismos e rigidez.`);L[i][j]=Math.sqrt(s)}
    else L[i][j]=s/L[j][j];
  }
  return L;
}
function solveLower(L,b){const n=L.length,x=Array(n).fill(0);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s-=L[i][j]*x[j];x[i]=s/L[i][i]}return x}
function solveUpperFromLowerTranspose(L,b){const n=L.length,x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=L[j][i]*x[j];x[i]=s/L[i][i]}return x}
function leftSolveLower(L,B){const n=L.length,m=B[0]?.length||0,X=zeros(n,m);for(let j=0;j<m;j++){const col=solveLower(L,B.map(r=>r[j]));for(let i=0;i<n;i++)X[i][j]=col[i]}return X}
function jacobiSymmetric(A,{tolerance=1e-11,maxIterations=null}={}){
  const n=A.length,B=A.map(r=>[...r]),V=identity(n),maxIter=maxIterations||Math.max(80,n*n*80),norm=Math.max(1,...B.flat().map(Math.abs)),tol=tolerance*norm;let iterations=0;
  for(;iterations<maxIter;iterations++){
    let p=0,q=Math.min(1,n-1),max=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const v=Math.abs(B[i][j]);if(v>max){max=v;p=i;q=j}}
    if(max<=tol)break;
    const app=B[p][p],aqq=B[q][q],apq=B[p][q],theta=.5*Math.atan2(2*apq,aqq-app),c=Math.cos(theta),s=Math.sin(theta);
    for(let k=0;k<n;k++)if(k!==p&&k!==q){const kp=B[k][p],kq=B[k][q];B[k][p]=B[p][k]=c*kp-s*kq;B[k][q]=B[q][k]=s*kp+c*kq}
    B[p][p]=c*c*app-2*s*c*apq+s*s*aqq;B[q][q]=s*s*app+2*s*c*apq+c*c*aqq;B[p][q]=B[q][p]=0;
    for(let k=0;k<n;k++){const vp=V[k][p],vq=V[k][q];V[k][p]=c*vp-s*vq;V[k][q]=s*vp+c*vq}
  }
  if(iterations>=maxIter)throw new Error('Dinâmica modal: decomposição de autovalores não convergiu.');
  return{values:B.map((r,i)=>r[i]),vectors:V,iterations};
}

function hasFlexibleEnds(e){
  if(e.releases?.rz1||e.releases?.rz2)return true;
  return ['rz1','rz2'].some(k=>{const v=e.rotationalSprings?.[k];return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))});
}
function hasMaterialNonlinearity(e){return !!e.distributedPlasticity?.enabled||['rz1','rz2'].some(k=>!!e.fiberHinges?.[k]?.enabled)}
function dynamicValidation(project,{timeHistory=false}={}){
  const nodes=project.nodes||[],elements=project.elements||[];
  if(!nodes.length||!elements.length)throw new Error('Dinâmica v0.24: modelo sem nós ou elementos.');
  if(elements.some(e=>!['frame2d','truss2d'].includes(e.type)))throw new Error('Dinâmica v0.24 suporta apenas frame2d e truss2d.');
  if(elements.some(e=>e.type==='frame2d'&&hasFlexibleEnds(e)))throw new Error('Dinâmica v0.24 requer extremidades rígidas nos elementos frame2d; releases e ligações semirrígidas ficam para uma validação dinâmica posterior.');
  if(elements.some(hasMaterialNonlinearity))throw new Error('Dinâmica v0.24 é linear-elástica e não aceita rótulas plásticas ou plasticidade distribuída.');
  if((project.settlements||[]).length)throw new Error('Dinâmica v0.24 ainda não admite recalques/deslocamentos impostos.');
  for(const s of project.supports||[])if([s.uxValue,s.uyValue,s.rzValue,s.baseUxValue,s.baseUyValue,s.baseRzValue].some(v=>Math.abs(Number(v)||0)>1e-12))throw new Error('Dinâmica v0.24 requer apoios homogêneos; deslocamentos prescritos não nulos não são suportados.');
  for(const e of elements){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`Dinâmica: material ausente em ${e.id}.`);if(!(Number(m.E)>0&&Number(m.density)>0))throw new Error(`Dinâmica: ${e.id} requer E>0 e peso específico density>0 kN/m³.`);if(!(Number(e.A)>0))throw new Error(`Dinâmica: ${e.id} requer A>0.`);if(e.type==='frame2d'&&!(Number(e.I)>0))throw new Error(`Dinâmica: ${e.id} requer I>0.`)}
  if(timeHistory){const allowed=new Set(['uniform','selfWeight','point']);const bad=(project.elementLoads||[]).filter(l=>!allowed.has(l.kind));if(bad.length)throw new Error(`História temporal v0.24 aceita apenas cargas de barra uniform, selfWeight e point no padrão dinâmico; remova: ${[...new Set(bad.map(x=>x.kind))].join(', ')}.`);for(const l of project.elementLoads||[])if(l.kind==='point'){const e=elements.find(x=>x.id===l.elementId);if(e?.type==='truss2d')throw new Error('História temporal v0.24 não aplica carga pontual interior em truss2d.')}}
}

function frameMassLocal(total,L,formulation){
  const M=zeros(6);if(formulation==='lumped'){for(const d of [0,1,3,4])M[d][d]=total/2;return M}
  const a=total/6;M[0][0]+=2*a;M[0][3]+=a;M[3][0]+=a;M[3][3]+=2*a;
  const b=total/420,idx=[1,2,4,5],Q=[[156,22*L,54,-13*L],[22*L,4*L*L,13*L,-3*L*L],[54,13*L,156,-22*L],[-13*L,-3*L*L,-22*L,4*L*L]];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)M[idx[i]][idx[j]]+=b*Q[i][j];return M;
}
function trussMass(total,formulation){
  const M=zeros(4);if(formulation==='lumped'){for(const d of [0,1,2,3])M[d][d]=total/2;return M}
  const a=total/6;for(const [i,j] of [[0,2],[1,3]]){M[i][i]+=2*a;M[i][j]+=a;M[j][i]+=a;M[j][j]+=2*a}return M;
}
function trussStiffness(E,A,L,c,s){const k=E*A/L;return [[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]].map(r=>r.map(v=>v*k))}

export function assembleDynamicSystem2D(project,{massFormulation='consistent',includeLoadVector=false}={}){
  dynamicValidation(project,{timeHistory:includeLoadVector});const nodes=project.nodes||[],elements=project.elements||[],nd=3*nodes.length,map=new Map(nodes.map((n,i)=>[n.id,i])),K=zeros(nd),M=zeros(nd),F=Array(nd).fill(0),formulation=massFormulation==='lumped'?'lumped':'consistent',frameRotationNodes=new Set();
  for(const e of elements){
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Dinâmica: ${e.id} referencia nó inexistente.`);const a=nodes[i],b=nodes[j],dx=Number(b.x)-Number(a.x),dy=Number(b.y)-Number(a.y),L=Math.hypot(dx,dy);if(!(L>1e-10))throw new Error(`Dinâmica: ${e.id} possui comprimento nulo.`);const c=dx/L,s=dy/L,mat=(project.materials||[]).find(x=>x.id===e.materialId),gamma=Number(mat.density),massDensity=gamma/G0,totalMass=massDensity*Number(e.A)*L;
    if(e.type==='frame2d'){
      frameRotationNodes.add(e.n1);frameRotationNodes.add(e.n2);const T=frameTransform(c,s),Tt=transpose(T),ke=mm(Tt,mm(frameLocalStiffness(Number(mat.E),Number(e.A),Number(e.I),L),T)),me=mm(Tt,mm(frameMassLocal(totalMass,L,formulation),T)),idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2];addSub(K,ke,idx);addSub(M,me,idx);
      if(includeLoadVector){const sec=(project.sections||[]).find(x=>x.id===e.sectionId),loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id).map(l=>l.kind==='selfWeight'?{...l,gamma:Number(l.gamma)||gamma}:l),prepared=prepareFrameElement({E:mat.E,A:e.A,I:e.I,L,c,s,loads,releases:{},rotationalSprings:{},alpha:Number(mat.alpha)||0,sectionHeight:sectionDepth(sec)});prepared.pg.forEach((v,k)=>{F[idx[k]]+=v})}
    }else{
      const idx=[3*i,3*i+1,3*j,3*j+1],ke=trussStiffness(Number(mat.E),Number(e.A),L,c,s),me=trussMass(totalMass,formulation);addSub(K,ke,idx);addSub(M,me,idx);
      if(includeLoadVector)for(const load of (project.elementLoads||[]).filter(l=>l.elementId===e.id&&l.kind==='selfWeight')){const g=Number(load.gamma)||gamma,factor=Number.isFinite(Number(load.weightFactor))?Number(load.weightFactor):1,total=g*Number(e.A)*L*factor;F[3*i+1]-=total/2;F[3*j+1]-=total/2}
    }
  }
  addNodalSprings(K,project,map,3);
  for(const nm of project.nodalMasses||[]){const i=map.get(nm.nodeId);if(i==null)continue;M[3*i][3*i]+=Math.max(0,Number(nm.mx)||0);M[3*i+1][3*i+1]+=Math.max(0,Number(nm.my)||0);M[3*i+2][3*i+2]+=Math.max(0,Number(nm.mr)||0)}
  if(includeLoadVector)for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;F[3*i]+=Number(l.fx)||0;F[3*i+1]+=Number(l.fy)||0;F[3*i+2]+=Number(l.mz)||0}
  const fixed=new Set();for(const support of project.supports||[]){const i=map.get(support.nodeId);if(i==null)continue;if(support.ux)fixed.add(3*i);if(support.uy)fixed.add(3*i+1);if(support.rz)fixed.add(3*i+2)}
  nodes.forEach((n,i)=>{const kr=(project.nodeSprings||[]).filter(x=>x.nodeId===n.id).reduce((q,x)=>q+(Number(x.kr)||0),0),mr=(project.nodalMasses||[]).filter(x=>x.nodeId===n.id).reduce((q,x)=>q+(Number(x.mr)||0),0);if(!frameRotationNodes.has(n.id)&&!(kr>0)&&!(mr>0))fixed.add(3*i+2)});
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.has(i));if(!free.length)throw new Error('Dinâmica: não existem graus de liberdade livres.');if(free.length>240)throw new Error(`Dinâmica v0.24 limita o núcleo modal a 240 DOFs livres no navegador; modelo atual: ${free.length}.`);
  const Kf=free.map(i=>free.map(j=>K[i][j])),Mf=free.map(i=>free.map(j=>M[i][j]));cholesky(symmetrize(Kf));
  return{project,nodes,elements,map,nd,K,M,F,free,fixed,Kf,Mf,Ff:free.map(i=>F[i]),massFormulation:formulation,gravity:G0};
}

function influence(free,direction){const offset=direction==='x'?0:1;return free.map(d=>d%3===offset?1:0)}
function normalizeDisplay(full,nodes){let max=0,signValue=0;for(let i=0;i<nodes.length;i++)for(const d of [3*i,3*i+1])if(Math.abs(full[d])>max){max=Math.abs(full[d]);signValue=full[d]}if(!(max>EPS))max=Math.max(EPS,...full.map(Math.abs));const sign=signValue<0?-1:1;return full.map(v=>sign*v/max)}

export function solveModal2D(project,options={}){
  const sys=assembleDynamicSystem2D(project,{massFormulation:options.massFormulation}),requested=clamp(Math.round(Number(options.modes??6)||6),1,20),L=cholesky(symmetrize(sys.Kf),'Dinâmica modal'),B0=leftSolveLower(L,sys.Mf),B=symmetrize(transpose(leftSolveLower(L,transpose(B0)))),eig=jacobiSymmetric(B,options),maxMu=Math.max(EPS,...eig.values.map(Math.abs)),tol=maxMu*1e-10,positive=eig.values.map((mu,index)=>({mu,index})).filter(x=>x.mu>tol).sort((a,b)=>b.mu-a.mu),rx=influence(sys.free,'x'),ry=influence(sys.free,'y'),Mx=dot(rx,mul(sys.Mf,rx)),My=dot(ry,mul(sys.Mf,ry));
  if(!positive.length)throw new Error('Dinâmica modal: nenhuma massa modal positiva foi encontrada. Verifique density e massas nodais.');
  let cumX=0,cumY=0;const modes=positive.slice(0,requested).map((cand,k)=>{let x=solveUpperFromLowerTranspose(L,eig.vectors.map(r=>r[cand.index])),gm=dot(x,mul(sys.Mf,x));if(!(gm>EPS))throw new Error('Dinâmica modal: massa generalizada degenerada.');const nrm=Math.sqrt(gm);x=x.map(v=>v/nrm);gm=1;const omega=Math.sqrt(1/cand.mu),frequencyHz=omega/(2*Math.PI),period=1/frequencyHz,gk=dot(x,mul(sys.Kf,x)),px=dot(x,mul(sys.Mf,rx)),py=dot(x,mul(sys.Mf,ry)),effX=px*px/gm,effY=py*py/gm;cumX+=Mx>EPS?effX/Mx:0;cumY+=My>EPS?effY/My:0;const fullMass=Array(sys.nd).fill(0);sys.free.forEach((d,i)=>{fullMass[d]=x[i]});const display=normalizeDisplay(fullMass,sys.nodes);return{mode:k+1,omega,frequencyHz,period,eigenvalue:omega*omega,generalizedMass:gm,generalizedStiffness:gk,participation:{x:px,y:py,effectiveMassX:effX,effectiveMassY:effY,effectiveMassRatioX:Mx>EPS?effX/Mx:0,effectiveMassRatioY:My>EPS?effY/My:0,cumulativeMassRatioX:cumX,cumulativeMassRatioY:cumY},massNormalizedVector:fullMass,vector:display,displacements:sys.nodes.map((n,i)=>({nodeId:n.id,ux:display[3*i],uy:display[3*i+1],rz:display[3*i+2]}))}});
  return{type:'dynamic-modal2d',analysisType:'modal',solverVersion:'0.24.0-exp',dofs:sys.nd,freeDofs:sys.free.length,massFormulation:sys.massFormulation,gravity:sys.gravity,densityConvention:'material.density interpreted as unit weight [kN/m³]; mass density = density/g',eigenIterations:eig.iterations,totalParticipatingMass:{x:Mx,y:My},modes,displacements:modes[0].displacements,modal:{modes,requestedModes:requested}};
}

export function rayleighFromModes(modes,{dampingRatio=.02,mode1=1,mode2=2}={}){
  const z=clamp(Number(dampingRatio)||0,0,.30),a=modes[Math.max(0,Math.min(modes.length-1,Math.round(Number(mode1)||1)-1))],b=modes[Math.max(0,Math.min(modes.length-1,Math.round(Number(mode2)||2)-1))];if(!a)throw new Error('Rayleigh: nenhum modo disponível.');const w1=a.omega,w2=b?.omega||w1;let alphaM=0,betaK=0;if(z>0){if(Math.abs(w2-w1)<=1e-10*Math.max(1,w1)){alphaM=2*z*w1;betaK=0}else{alphaM=2*z*w1*w2/(w1+w2);betaK=2*z/(w1+w2)}}return{dampingRatio:z,mode1:a.mode,mode2:b?.mode||a.mode,omega1:w1,omega2:w2,alphaM,betaK};
}

export function newmarkLinearSystem({M,C,K,forceAtTime,dt,duration,u0=null,v0=null,beta=.25,gamma=.5,onStep=null}){
  const n=K.length,h=Number(dt),T=Number(duration);if(!(h>0&&T>0))throw new Error('Newmark: dt e duração devem ser positivos.');const steps=Math.max(1,Math.ceil(T/h)),stepDt=T/steps,b=Number(beta),g=Number(gamma);if(!(b>0&&g>0))throw new Error('Newmark: beta e gamma devem ser positivos.');let u=u0?[...u0]:Array(n).fill(0),v=v0?[...v0]:Array(n).fill(0),a=Array(n).fill(0);const p0=forceAtTime(0),p0norm=Math.max(0,...p0.map(Math.abs)),hasInitial=!!u0||!!v0;if(!hasInitial&&p0norm>1e-10)throw new Error('Newmark v0.24 parte de repouso e requer força dinâmica nula em t=0. Faça a história de escala iniciar em 0.');if(hasInitial){const rhs0=p0.map((x,i)=>x-mul(C,v)[i]-mul(K,u)[i]);try{a=solveLinear(M,rhs0)}catch{throw new Error('Newmark: a matriz de massa é singular para o estado inicial imposto. Use massa consistente ou condições iniciais compatíveis com os DOFs inerciais.')}}
  const A0=1/(b*stepDt*stepDt),A1=g/(b*stepDt),A2=1/(b*stepDt),A3=1/(2*b)-1,A4=g/b-1,A5=stepDt*(g/(2*b)-1),Keff=matAdd(matAdd(K,M,1,A0),C,1,A1),history=[];
  const emit=(step,t,p)=>{const kinetic=.5*dot(v,mul(M,v)),strain=.5*dot(u,mul(K,u)),row={step,t,u:[...u],v:[...v],a:[...a],force:[...p],kineticEnergy:kinetic,strainEnergy:strain,totalMechanicalEnergy:kinetic+strain};history.push(row);if(onStep)onStep(row)};emit(0,0,p0);
  for(let step=1;step<=steps;step++){const t=step*stepDt,p=forceAtTime(t),mu=u.map((x,i)=>A0*x+A2*v[i]+A3*a[i]),cv=u.map((x,i)=>A1*x+A4*v[i]+A5*a[i]),rhs=p.map((x,i)=>x+mul(M,mu)[i]+mul(C,cv)[i]),un=solveLinear(Keff,rhs),an=un.map((x,i)=>A0*(x-u[i])-A2*v[i]-A3*a[i]),vn=v.map((x,i)=>x+stepDt*((1-g)*a[i]+g*an[i]));u=un;v=vn;a=an;emit(step,t,p)}return{dt:stepDt,duration:T,steps,beta:b,gamma:g,history,final:{u,v,a}};
}

function interpolateHistory(points,t){if(t<=points[0].t)return points[0].scale;if(t>=points.at(-1).t)return points.at(-1).scale;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];if(t>=a.t&&t<=b.t){const r=(t-a.t)/(b.t-a.t);return a.scale+r*(b.scale-a.scale)}}return 0}
function monitorDof(sys,nodeId,dof){const i=sys.map.get(nodeId);if(i==null)throw new Error(`História temporal: nó monitor ${nodeId} inexistente.`);const off={ux:0,uy:1,rz:2}[dof];if(off===undefined)throw new Error(`História temporal: DOF monitor inválido ${dof}.`);const global=3*i+off,pos=sys.free.indexOf(global);if(pos<0)throw new Error(`História temporal: ${nodeId}/${dof} é restringido ou inativo.`);return{nodeId,dof,global,freePosition:pos,unit:dof==='rz'?'rad':'m'} }

function normalizeGroundMotion(raw){
  const points=(Array.isArray(raw)?raw:[]).map(x=>({t:Number(x?.t),accelG:Number(x?.accelG??x?.accelerationG??x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.accelG)).sort((a,b)=>a.t-b.t);
  if(points.length<2)throw new Error('Excitação sísmica v0.24 requer ao menos dois pontos {t, accelG}.');
  if(Math.abs(points[0].t)>1e-12)throw new Error('Acelerograma v0.24 deve iniciar em t=0.');
  for(let i=1;i<points.length;i++)if(!(points[i].t>points[i-1].t))throw new Error('Acelerograma: tempos devem ser estritamente crescentes.');
  if(Math.abs(points[0].accelG)>1e-10)throw new Error('Acelerograma v0.24 deve iniciar com aceleração zero; pré-penda t=0, a=0 após a correção de linha de base.');
  return points;
}
function groundAcceleration(points,t){return interpolateHistory(points.map(x=>({t:x.t,scale:x.accelG*G0})),t)}
function groundAccelerationG(points,t){return interpolateHistory(points.map(x=>({t:x.t,scale:x.accelG})),t)}
function minGroundStep(points){let h=Infinity;for(let i=1;i<points.length;i++)h=Math.min(h,points[i].t-points[i-1].t);return Number.isFinite(h)?h:.01}

export function cqcCorrelation(omegaI,omegaJ,dampingRatio=.05){
  const wi=Math.abs(Number(omegaI)),wj=Math.abs(Number(omegaJ)),z=clamp(Math.abs(Number(dampingRatio)||0),0,.30);if(!(wi>0&&wj>0))return 0;if(Math.abs(wi-wj)<=1e-12*Math.max(wi,wj))return 1;const r=Math.min(wi,wj)/Math.max(wi,wj),num=8*z*z*(1+r)*Math.pow(r,1.5),den=Math.pow(1-r*r,2)+4*z*z*r*Math.pow(1+r,2);return den>EPS?clamp(num/den,0,1):0;
}

function sdofSpectrumPoint(points,period,dampingRatio,timeStep){
  const T=Number(period),z=clamp(Number(dampingRatio)||0,0,.30);if(!(T>0))throw new Error('Espectro: período deve ser positivo.');const omega=2*Math.PI/T,m=1,k=omega*omega,c=2*z*omega,duration=points.at(-1).t,h=Math.min(Math.max(1e-5,Number(timeStep)||minGroundStep(points)),Math.max(1e-5,duration)),steps=Math.max(1,Math.ceil(duration/h)),dt=duration/steps,b=.25,g=.5,A0=1/(b*dt*dt),A1=g/(b*dt),A2=1/(b*dt),A3=1/(2*b)-1,A4=g/b-1,A5=dt*(g/(2*b)-1),keff=k+A0*m+A1*c;let u=0,v=0,a=0,sd=0,absAcc=0;
  for(let step=1;step<=steps;step++){const t=step*dt,ag=groundAcceleration(points,t),p=-ag,rhs=p+m*(A0*u+A2*v+A3*a)+c*(A1*u+A4*v+A5*a),un=rhs/keff,an=A0*(un-u)-A2*v-A3*a,vn=v+dt*((1-g)*a+g*an);u=un;v=vn;a=an;sd=Math.max(sd,Math.abs(u));absAcc=Math.max(absAcc,Math.abs(a+ag))}
  const sv=omega*sd,sa=omega*omega*sd;return{period:T,frequencyHz:1/T,omega,sd,sv,sa,saG:sa/G0,absoluteAcceleration:absAcc,absoluteAccelerationG:absAcc/G0};
}

export function responseSpectrumFromGroundMotion(raw,options={}){
  const points=normalizeGroundMotion(raw),z=clamp(Number(options.dampingRatio??.05)||0,0,.30),timeStep=Math.max(1e-5,Number(options.timeStep)||minGroundStep(points));let periods;
  if(Array.isArray(options.periods)&&options.periods.length)periods=[...new Set(options.periods.map(Number).filter(x=>Number.isFinite(x)&&x>0))].sort((a,b)=>a-b);else{const t0=Math.max(.001,Number(options.periodMin)||.02),t1=Math.max(t0,Number(options.periodMax)||4),n=clamp(Math.round(Number(options.periodCount)||80),10,300);periods=Array.from({length:n},(_,i)=>t0+(t1-t0)*(n===1?0:i/(n-1)))}
  const values=periods.map(T=>sdofSpectrumPoint(points,T,z,timeStep)),pgaG=Math.max(...points.map(x=>Math.abs(x.accelG)));return{dampingRatio:z,timeStep,groundMotionPoints:points,pgaG,pga:pgaG*G0,values,ordinates:{sd:'m',sv:'m/s pseudo',sa:'m/s² pseudo',saG:'g pseudo'}};
}

function combineModalVectors(vectors,omegas,zeta,method){
  if(!vectors.length)return[];const n=vectors[0].length,out=Array(n).fill(0),kind=method==='srss'?'srss':'cqc';for(let d=0;d<n;d++){let sum=0;if(kind==='srss'){for(const v of vectors)sum+=v[d]*v[d]}else for(let i=0;i<vectors.length;i++)for(let j=0;j<vectors.length;j++)sum+=cqcCorrelation(omegas[i],omegas[j],zeta)*vectors[i][d]*vectors[j][d];out[d]=Math.sqrt(Math.max(0,sum))}return out;
}

export function solveResponseSpectrum2D(project,options={}){
  const massFormulation=options.massFormulation==='lumped'?'lumped':'consistent',modesRequested=Math.max(1,Math.min(20,Math.round(Number(options.modes)||6))),modal=solveModal2D(project,{massFormulation,modes:modesRequested}),direction=options.direction==='y'?'y':'x',z=clamp(Number(options.dampingRatio??.05)||0,0,.30),points=normalizeGroundMotion(options.groundMotionPoints),dense=responseSpectrumFromGroundMotion(points,{dampingRatio:z,timeStep:options.timeStep,periodMin:options.periodMin,periodMax:options.periodMax,periodCount:options.periodCount}),atModes=responseSpectrumFromGroundMotion(points,{dampingRatio:z,timeStep:options.timeStep,periods:modal.modes.map(m=>m.period)}),specByPeriod=new Map(atModes.values.map(x=>[x.period,x])),vectors=[],omegas=[],modalContributions=[];
  for(const m of modal.modes){const sp=specByPeriod.get(m.period),participation=Number(m.participation?.[direction])||0,q=participation*sp.sd,vec=m.massNormalizedVector.map(v=>v*q),maxModalTranslational=Math.max(0,...project.nodes.map((n,i)=>Math.hypot(vec[3*i]||0,vec[3*i+1]||0)));vectors.push(vec);omegas.push(m.omega);modalContributions.push({mode:m.mode,period:m.period,frequencyHz:m.frequencyHz,omega:m.omega,participationFactor:participation,effectiveMassRatio:direction==='x'?m.participation?.effectiveMassRatioX:m.participation?.effectiveMassRatioY,sd:sp.sd,sv:sp.sv,sa:sp.sa,saG:sp.saG,generalizedPeak:q,maxModalTranslational})}
  const combination=options.combination==='srss'?'srss':'cqc',combined=combineModalVectors(vectors,omegas,z,combination),displacements=project.nodes.map((n,i)=>({nodeId:n.id,ux:combined[3*i]||0,uy:combined[3*i+1]||0,rz:combined[3*i+2]||0})),peakCombinedDisplacement=Math.max(0,...displacements.map(d=>Math.hypot(d.ux,d.uy))),cum=modal.modes.at(-1)?.participation?.[direction==='x'?'cumulativeMassRatioX':'cumulativeMassRatioY']||0;
  return{type:'dynamic-response-spectrum2d',analysisType:'response-spectrum',solverVersion:'0.24.0-exp',dofs:modal.dofs,freeDofs:modal.freeDofs,massFormulation,densityConvention:modal.densityConvention,modal:{modes:modal.modes,requestedModes:modesRequested},direction,dampingRatio:z,combination,spectrum:dense,modalContributions,combined:{method:combination,peakTranslationalDisplacement:peakCombinedDisplacement,cumulativeEffectiveMassRatio:cum},displacements};
}

export function solveTimeHistory2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project,excitationType=options.excitationType==='base-acceleration'?'base-acceleration':'scaled-load-pattern',sys=assembleDynamicSystem2D(p,{massFormulation:options.massFormulation,includeLoadVector:excitationType==='scaled-load-pattern'}),modal=solveModal2D(p,{massFormulation:options.massFormulation,modes:Math.max(2,Number(options.rayleighMode2)||2)}),rayleigh=rayleighFromModes(modal.modes,{dampingRatio:options.dampingRatio,mode1:options.rayleighMode1,mode2:options.rayleighMode2}),C=matAdd(matScale(sys.Mf,rayleigh.alphaM),matScale(sys.Kf,rayleigh.betaK)),raw=Array.isArray(options.historyPoints)?options.historyPoints:[],loadPoints=raw.map(x=>({t:Number(x.t),scale:Number(x.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.scale)).sort((a,b)=>a.t-b.t),groundPoints=excitationType==='base-acceleration'?normalizeGroundMotion(options.groundMotionPoints):null;
  if(excitationType==='scaled-load-pattern'){if(loadPoints.length<2)throw new Error('História temporal v0.24 requer pelo menos dois pontos {t, scale}.');if(Math.abs(loadPoints[0].t)>1e-12||Math.abs(loadPoints[0].scale)>1e-12)throw new Error('História temporal v0.24 deve iniciar em t=0 com scale=0.');for(let i=1;i<loadPoints.length;i++)if(!(loadPoints[i].t>loadPoints[i-1].t))throw new Error('História temporal: tempos devem ser estritamente crescentes.');}
  const naturalDuration=excitationType==='base-acceleration'?groundPoints.at(-1).t:loadPoints.at(-1).t,duration=Number(options.duration)>0?Number(options.duration):naturalDuration,dt=Number(options.timeStep)||.01;if(!(duration>0&&dt>0))throw new Error('História temporal: duração e passo de tempo devem ser positivos.');if(Math.ceil(duration/dt)>10000)throw new Error('História temporal v0.24 limita a integração a 10.000 passos no navegador.');const nodeId=options.monitorNodeId||p.nodes?.at(-1)?.id,dof=['ux','uy','rz'].includes(options.monitorDof)?options.monitorDof:'uy',monitor=monitorDof(sys,nodeId,dof),peakByNode=new Map(p.nodes.map(n=>[n.id,{nodeId:n.id,ux:0,uy:0,rz:0}])),direction=options.groundMotionDirection==='y'?'y':'x',r=excitationType==='base-acceleration'?influence(sys.free,direction):null,mr=r?mul(sys.Mf,r):null;
  const forceAtTime=t=>excitationType==='base-acceleration'?mr.map(v=>-v*groundAcceleration(groundPoints,t)):(()=>{const scale=interpolateHistory(loadPoints,t);return sys.Ff.map(v=>scale*v)})(),integrated=newmarkLinearSystem({M:sys.Mf,C,K:sys.Kf,forceAtTime,dt,duration,onStep:row=>{for(let ni=0;ni<p.nodes.length;ni++){const rec=peakByNode.get(p.nodes[ni].id);for(const [key,off] of [['ux',0],['uy',1],['rz',2]]){const pos=sys.free.indexOf(3*ni+off),value=pos>=0?Math.abs(row.u[pos]):0;if(value>rec[key])rec[key]=value}}}}),history=integrated.history.map(row=>{const ag=excitationType==='base-acceleration'?groundAcceleration(groundPoints,row.t):0,agG=excitationType==='base-acceleration'?groundAccelerationG(groundPoints,row.t):0,relativeAcceleration=row.a[monitor.freePosition],monitorMatchesGround=(monitor.dof==='ux'&&direction==='x')||(monitor.dof==='uy'&&direction==='y');return{step:row.step,t:row.t,scale:excitationType==='scaled-load-pattern'?interpolateHistory(loadPoints,row.t):null,groundAcceleration:ag,groundAccelerationG:agG,displacement:row.u[monitor.freePosition],velocity:row.v[monitor.freePosition],acceleration:relativeAcceleration,absoluteAcceleration:relativeAcceleration+(monitorMatchesGround?ag:0),kineticEnergy:row.kineticEnergy,strainEnergy:row.strainEnergy,totalMechanicalEnergy:row.totalMechanicalEnergy}}),peak=history.reduce((best,r)=>Math.abs(r.displacement)>Math.abs(best.displacement)?r:best,history[0]),fullFinal=Array(sys.nd).fill(0);sys.free.forEach((d,i)=>{fullFinal[d]=integrated.final.u[i]});
  return{type:'dynamic-time-history2d',analysisType:'time-history',solverVersion:'0.24.0-exp',scenario:resolved.scenario,dofs:sys.nd,freeDofs:sys.free.length,massFormulation:sys.massFormulation,gravity:sys.gravity,densityConvention:'material.density interpreted as unit weight [kN/m³]; mass density = density/g',modal:{modes:modal.modes,usedForDamping:true},rayleigh,newmark:{method:'average-acceleration',beta:integrated.beta,gamma:integrated.gamma,timeStep:integrated.dt,duration:integrated.duration,steps:integrated.steps},excitation:excitationType==='base-acceleration'?{type:'base-acceleration',baseAcceleration:true,direction,groundMotionPoints:groundPoints,pgaG:Math.max(...groundPoints.map(x=>Math.abs(x.accelG)))}:{type:'scaled-load-pattern',historyPoints:loadPoints,referenceScenarioId:scenarioId||resolved.scenario?.id,baseAcceleration:false},monitor,history,peakResponse:{...peak,absDisplacement:Math.abs(peak.displacement)},peakByNode:[...peakByNode.values()],displacements:p.nodes.map((n,i)=>({nodeId:n.id,ux:fullFinal[3*i],uy:fullFinal[3*i+1],rz:fullFinal[3*i+2]}))};
}

export const DYNAMICS_VERSION='0.24.0-exp';
