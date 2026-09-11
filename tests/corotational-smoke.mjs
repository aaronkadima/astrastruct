import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { corotationalElementState, corotationalConnectedElementState, followerEndLoadState, solveFrameCorotational2D } from '../web/src/solver/corotational2d.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}
function mustThrow(fn,pattern,message){let thrown=null;try{fn()}catch(e){thrown=e}assert(thrown,`${message}: era esperado erro`);assert(pattern.test(String(thrown?.message||thrown)),`${message}: mensagem inesperada: ${thrown?.message||thrown}`)}
function simpleCantilever(){
  const p=emptyProject();p.name='Co-rotacional — validação de escopo';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];
  p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50',A:.15,I:.003125})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];return p;
}

// 1) Objetividade: translação + rotação rígida finita não podem gerar deformação nem força interna.
{
  const L=3.7,beta=.83,tx=1.25,ty=-.62,X1=0,Y1=0,X2=L,Y2=0;
  const x1=tx,y1=ty,x2=tx+L*Math.cos(beta),y2=ty+L*Math.sin(beta),q=[x1-X1,y1-Y1,beta,x2-X2,y2-Y2,beta];
  const s=corotationalElementState({X1,Y1,X2,Y2,qGlobal:q,E:200e6,A:.01,I:.0002});
  assert(Math.max(...s.basic.map(Math.abs))<1e-12,'Co-rotacional: deformação espúria em movimento rígido');
  assert(Math.max(...s.internal.map(Math.abs))<1e-6,'Co-rotacional: força espúria em movimento rígido');
  console.log('Co-rotacional — objetividade OK','beta=',beta,'rad');
}

// 2) Tangente interna consistente: comparar d(fint)/dq analítico contra diferença central.
{
  const args={X1:0,Y1:0,X2:3,Y2:1,E:200e6,A:.01,I:.0002},q=[.10,.20,.30,.40,-.10,-.20],h=1e-7;
  const base=corotationalElementState({...args,qGlobal:q});let maxDiff=0,maxRef=0;
  for(let j=0;j<6;j++){
    const qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;
    const fp=corotationalElementState({...args,qGlobal:qp}).internal,fm=corotationalElementState({...args,qGlobal:qm}).internal;
    for(let i=0;i<6;i++){const numeric=(fp[i]-fm[i])/(2*h),analytic=base.tangent[i][j];maxDiff=Math.max(maxDiff,Math.abs(analytic-numeric));maxRef=Math.max(maxRef,Math.abs(numeric))}
  }
  const relative=maxDiff/Math.max(1,maxRef);assert(relative<2e-6,`Co-rotacional: tangente interna inconsistente, erro relativo ${relative}`);
  console.log('Co-rotacional — tangente interna consistente OK','erro relativo=',relative);
}

// 3) Limite de pequenas rotações: console deve reproduzir PL^3/(3EI).
{
  const p=simpleCantilever();p.name='Co-rotacional — limite linear';
  const r=solveFrameCorotational2D(p,'LC1',{steps:4,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId==='N2'),exact=-10*4**3/(3*30e6*.003125);
  near(tip.uy,exact,2e-9,'Co-rotacional: limite linear do console');
  assert(r.nonlinear.converged,'Co-rotacional: metadado de convergência ausente');
  assert(r.elementResponses?.length===1,'Co-rotacional: pós-processamento do console ausente');
  console.log(p.name,'OK','uy [mm]=',tip.uy*1000,'linear [mm]=',exact*1000);
}

function circularArc(ne){
  const p=emptyProject(),L=4,theta=1,E=30e6,I=.003125,A=.15,le=L/ne,M=E*I*theta/L;
  p.name=`Co-rotacional — arco circular ${ne}e`;p.nodes=Array.from({length:ne+1},(_,i)=>({id:`N${i}`,x:i*le,y:0}));
  p.elements=Array.from({length:ne},(_,i)=>makeFrameElement({id:`E${i+1}`,n1:`N${i}`,n2:`N${i+1}`,sectionId:'rc_30x50',A,I}));
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:true}];p.loads=[{id:'M',caseId:'LC1',nodeId:`N${ne}`,fx:0,fy:0,mz:M}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:20,maxIterations:45,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId===`N${ne}`),x=L+tip.ux,y=tip.uy,xExact=L*Math.sin(theta)/theta,yExact=L*(1-Math.cos(theta))/theta,error=Math.hypot(x-xExact,y-yExact);
  return{p,r,tip,x,y,xExact,yExact,error,M};
}

// 4) Grande rotação sob momento puro — arco circular e convergência de malha.
{
  const a4=circularArc(4),a8=circularArc(8),a16=circularArc(16);
  assert(a8.error<a4.error*.35,`Co-rotacional: convergência 4->8 insuficiente (${a4.error} -> ${a8.error})`);
  assert(a16.error<a8.error*.35,`Co-rotacional: convergência 8->16 insuficiente (${a8.error} -> ${a16.error})`);
  near(a16.tip.rz,1,2e-8,'Co-rotacional: rotação final sob momento puro');
  near(a16.x,a16.xExact,7e-4,'Co-rotacional: coordenada x do arco circular');near(a16.y,a16.yExact,4e-4,'Co-rotacional: coordenada y do arco circular');
  const reaction=a16.r.reactions.find(x=>x.nodeId==='N0');near(reaction.mz,-a16.M,2e-5,'Co-rotacional: equilíbrio de momento');
  assert(a16.r.elementResponses.length===16,'Co-rotacional: número de respostas de elemento incorreto');
  assert(a16.r.elementResponses.every(e=>e.currentGeometry&&e.stations.length===41),'Co-rotacional: respostas não usam geometria corrente');
  const lastResponse=a16.r.elementResponses.at(-1),end=lastResponse.stations.at(-1);near(end.xd,a16.x,2e-9,'Co-rotacional: pós-processamento x da ponta');near(end.yd,a16.y,2e-9,'Co-rotacional: pós-processamento y da ponta');
  const momentError=Math.max(...a16.r.elementResponses.flatMap(e=>e.stations.map(s=>Math.abs(s.M-a16.M))));assert(momentError<2e-5,`Co-rotacional: momento puro não preservado no pós-processamento (${momentError})`);
  assert(a16.r.elementResponses.every(e=>e.stations.every(s=>Number.isFinite(s.sigmaTop)&&Number.isFinite(s.sigmaBottom))),'Co-rotacional: tensões elásticas ausentes');
  console.log('Co-rotacional — convergência/pós-processamento OK','erros [m]=',a4.error,a8.error,a16.error,'tip16=',a16.x,a16.y,'erro M=',momentError);
}

// 5) UDL morta na configuração de referência.
{
  const p=emptyProject();p.name='Co-rotacional — UDL de referência';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:3,y:0},{id:'N3',x:6,y:0}];
  p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'}),makeFrameElement({id:'E2',n1:'N2',n2:'N3'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N3',ux:false,uy:true,rz:false}];
  p.elementLoads=[{id:'Q1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20},{id:'Q2',caseId:'LC1',elementId:'E2',kind:'uniform',qx:0,qy:-20}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:40,tolerance:1e-10}),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N3'),mid=r.displacements.find(x=>x.nodeId==='N2'),moments=r.elementResponses.flatMap(e=>e.stations.map(s=>s.M)),mmax=Math.max(...moments),recovery=Math.max(...r.elementResponses.map(e=>e.loadRecovery.equilibriumResidualAbs));
  near(ra.fy,60,2e-5,'Co-rotacional UDL: RA');near(rb.fy,60,2e-5,'Co-rotacional UDL: RB');near(ra.fy+rb.fy,120,2e-5,'Co-rotacional UDL: equilíbrio vertical');
  near(Math.abs(mid.uy),.0036,3e-5,'Co-rotacional UDL: flecha do meio');near(mmax,90,.08,'Co-rotacional UDL: Mmax');
  assert(recovery<.15,`Co-rotacional UDL: resíduo de recuperação excessivo (${recovery})`);
  assert(r.elementResponses.every(e=>e.loadModel==='reference-dead'),'Co-rotacional UDL: metadado de carga morta ausente');
  console.log(p.name,'OK','R=',ra.fy,rb.fy,'uy meio [mm]=',mid.uy*1000,'Mmax=',mmax,'resíduo=',recovery);
}

// 6) Peso próprio de referência.
{
  const p=emptyProject();p.name='Co-rotacional — peso próprio de referência';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'SW1',caseId:'LC1',elementId:'E1',kind:'selfWeight'}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:6,tolerance:1e-10}),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),resp=r.elementResponses[0],mmax=Math.max(...resp.stations.map(s=>s.M));
  near(ra.fy,11.25,2e-6,'Co-rotacional peso próprio: RA');near(rb.fy,11.25,2e-6,'Co-rotacional peso próprio: RB');near(ra.fy+rb.fy,22.5,2e-6,'Co-rotacional peso próprio: equilíbrio');near(mmax,16.875,.02,'Co-rotacional peso próprio: Mmax');
  near(resp.referenceLoad.selfWeight,3.75,1e-12,'Co-rotacional peso próprio: intensidade');
  console.log(p.name,'OK','R=',ra.fy,rb.fy,'Mmax=',mmax,'w=',resp.referenceLoad.selfWeight);
}

// 7) Carga pontual em barra como dead load de referência.
{
  const p=emptyProject();p.name='Co-rotacional — carga pontual de referência';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.elementLoads=[{id:'P1',caseId:'LC1',elementId:'E1',kind:'point',xi:.5,px:0,py:-100}];
  const linear=solve(p,'LC1'),r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:40,tolerance:1e-10}),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),resp=r.elementResponses[0],mid=resp.stations[20],before=resp.stations[19],mmax=Math.max(...resp.stations.map(s=>s.M)),lr1=linear.displacements.find(d=>d.nodeId==='N1'),lr2=linear.displacements.find(d=>d.nodeId==='N2'),nr1=r.displacements.find(d=>d.nodeId==='N1'),nr2=r.displacements.find(d=>d.nodeId==='N2'),recovery=resp.loadRecovery.equilibriumResidualAbs;
  near(ra.fy,50,2e-4,'Co-rotacional point: RA');near(rb.fy,50,2e-4,'Co-rotacional point: RB');near(ra.fy+rb.fy,100,2e-4,'Co-rotacional point: equilíbrio vertical');near(mmax,150,.15,'Co-rotacional point: Mmax');
  near(nr1.rz,lr1.rz,2e-7,'Co-rotacional point: rotação N1 no limite linear');near(nr2.rz,lr2.rz,2e-7,'Co-rotacional point: rotação N2 no limite linear');
  near(mid.V-before.V,-100,.15,'Co-rotacional point: salto de cortante');near(resp.referenceLoad.currentPoints[0].py,-100,.05,'Co-rotacional point: projeção transversal corrente');
  assert(recovery<.5,`Co-rotacional point: resíduo de recuperação excessivo (${recovery})`);
  console.log(p.name,'OK','R=',ra.fy,rb.fy,'Mmax=',mmax,'salto V=',mid.V-before.V,'resíduo=',recovery);
}

// 8) Expansão térmica uniforme livre.
{
  const p=emptyProject();p.name='Co-rotacional — expansão térmica livre';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.elementLoads=[{id:'T1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:50,dTGradient:0}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:5,maxIterations:30,tolerance:1e-11}),tip=r.displacements.find(d=>d.nodeId==='N2'),f=r.elementForces[0],expected=10e-6*50*2;
  near(tip.ux,expected,2e-10,'Co-rotacional térmico livre: ux');near(tip.uy,0,1e-10,'Co-rotacional térmico livre: uy');near(tip.rz,0,1e-10,'Co-rotacional térmico livre: rz');
  near(f.basicForces.N,0,2e-5,'Co-rotacional térmico livre: N');near(f.basicForces.M1,0,2e-5,'Co-rotacional térmico livre: M1');near(f.basicForces.M2,0,2e-5,'Co-rotacional térmico livre: M2');
  near(f.loadSummary.thermal.eps0,10e-6*50,1e-15,'Co-rotacional térmico livre: epsT');
  console.log(p.name,'OK','ux [mm]=',tip.ux*1000,'N=',f.basicForces.N);
}

// 9) Expansão uniforme impedida: N=-EA alpha dT, compressão negativa.
{
  const p=emptyProject();p.name='Co-rotacional — expansão térmica impedida';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:true,uy:true,rz:false}];p.elementLoads=[{id:'T1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:50,dTGradient:0}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:5,tolerance:1e-11}),f=r.elementForces[0],ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),expected=-30e6*.15*10e-6*50;
  near(f.basicForces.N,expected,2e-6,'Co-rotacional térmico impedido: N');near(ra.fx,-expected,2e-6,'Co-rotacional térmico impedido: reação N1');near(rb.fx,expected,2e-6,'Co-rotacional térmico impedido: reação N2');
  console.log(p.name,'OK','N=',f.basicForces.N,'kN');
}

// 10) Gradiente térmico livre: forma de arco praticamente sem tensões.
{
  const L=4,ne=8,le=L/ne,alpha=10e-6,dTg=20,h=.5,kappa=-alpha*dTg/h,theta=kappa*L;
  const p=emptyProject();p.name='Co-rotacional — gradiente térmico livre';p.nodes=Array.from({length:ne+1},(_,i)=>({id:`N${i}`,x:i*le,y:0}));
  p.elements=Array.from({length:ne},(_,i)=>makeFrameElement({id:`E${i+1}`,n1:`N${i}`,n2:`N${i+1}`,sectionId:'rc_30x50'}));p.supports=[{nodeId:'N0',ux:true,uy:true,rz:true}];
  p.elementLoads=p.elements.map((e,i)=>({id:`TG${i+1}`,caseId:'LC1',elementId:e.id,kind:'thermal',dT:0,dTGradient:dTg}));
  const r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:40,tolerance:1e-9}),tip=r.displacements.find(d=>d.nodeId===`N${ne}`),x=L+tip.ux,y=tip.uy,xExact=Math.sin(theta)/kappa,yExact=(1-Math.cos(theta))/kappa,error=Math.hypot(x-xExact,y-yExact),maxForce=Math.max(...r.elementForces.flatMap(f=>[f.basicForces.N,f.basicForces.M1,f.basicForces.M2].map(Math.abs)));
  near(tip.rz,theta,2e-9,'Co-rotacional gradiente térmico: rotação final');assert(error<1e-7,`Co-rotacional gradiente térmico: erro geométrico excessivo (${error})`);assert(maxForce<2e-4,`Co-rotacional gradiente térmico: força residual excessiva (${maxForce})`);
  near(r.elementForces[0].loadSummary.thermal.kappa0,kappa,1e-15,'Co-rotacional gradiente térmico: kappaT');
  console.log(p.name,'OK','theta=',tip.rz,'tip=',x,y,'erro [m]=',error,'força residual=',maxForce);
}

// 11) Tangente externa consistente da força seguidora de extremidade.
{
  const X1=0,Y1=0,X2=3,Y2=1,q=[.10,.20,.13,.40,-.10,-.08],px=13,py=-7,h=1e-7;
  const stateFromQ=qq=>{const x1=X1+qq[0],y1=Y1+qq[1],x2=X2+qq[3],y2=Y2+qq[4],dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);return followerEndLoadState({px,py,end:2,l,c:dx/l,s:dy/l})};
  const base=stateFromQ(q);let maxDiff=0,maxRef=0;
  for(let j=0;j<6;j++){
    const qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;const fp=stateFromQ(qp).vector,fm=stateFromQ(qm).vector;
    for(let i=0;i<6;i++){const numeric=(fp[i]-fm[i])/(2*h),analytic=base.tangent[i][j];maxDiff=Math.max(maxDiff,Math.abs(analytic-numeric));maxRef=Math.max(maxRef,Math.abs(numeric))}
  }
  const relative=maxDiff/Math.max(1,maxRef);assert(relative<2e-7,`Follower: tangente externa inconsistente, erro relativo ${relative}`);
  assert(Math.abs(base.tangent[3][1]-base.tangent[1][3])>1e-6,'Follower: Kext deveria ser não simétrica neste estado');
  console.log('Co-rotacional — tangente externa follower OK','erro relativo=',relative,'max|Kext|=',base.tangentMaxAbs);
}

// 12) Follower axial + combinação: o Scenario Engine deve escalar Px/Py antes do caminho de Newton.
{
  const p=emptyProject();p.name='Co-rotacional — follower axial combinado';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[];
  p.elementLoads=[{id:'F1',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:2,px:100,py:0}];
  p.loadCombinations=[{id:'COMB_F',name:'1.4 follower',type:'custom',terms:[{caseId:'LC1',factor:1.4}]}];
  const r=solveFrameCorotational2D(p,'COMB_F',{steps:7,maxIterations:35,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId==='N2'),ra=r.reactions.find(x=>x.nodeId==='N1'),f=r.elementResponses[0].followerEnds[0],expectedP=140,expectedU=expectedP*2/(30e6*.15);
  near(tip.ux,expectedU,2e-10,'Follower combinado: deslocamento axial');near(tip.uy,0,1e-10,'Follower combinado: deslocamento transversal');near(ra.fx,-expectedP,2e-6,'Follower combinado: reação axial');
  near(f.px,expectedP,1e-12,'Follower combinado: Px escalado');near(f.currentGlobal.fx,expectedP,2e-6,'Follower combinado: Fx global');near(f.currentGlobal.fy,0,1e-10,'Follower combinado: Fy global');
  assert(f.consistentExternalTangent===true,'Follower combinado: metadado da tangente externa ausente');assert(r.nonlinear.followerLoads?.count===1,'Follower combinado: contagem de follower incorreta');assert(r.solverVersion==='0.13.4-exp','Follower combinado: versão do solver incorreta');
  console.log(p.name,'OK','Px=',f.px,'ux [mm]=',tip.ux*1000,'R=',ra.fx);
}

// 13) Tangente condensada de duas ligações semirrígidas contra diferença central.
{
  const q=[.08,.11,.06,.31,-.07,-.04],h=1e-7,args={X1:0,Y1:0,X2:3,Y2:.8,E:30e6,A:.15,I:.003125,initialBasic:[2e-4,-1.5e-4,2.2e-4],pGlobal:[2,-3,1.1,4,-5,-1.7],loadFactor:.65,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:12000,rz2:35000}};
  const state=qq=>corotationalConnectedElementState({...args,qGlobal:qq}),base=state(q);let maxDiff=0,maxRef=0,maxAsym=0;
  for(let j=0;j<6;j++){
    const qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;const gp=state(qp).gradient,gm=state(qm).gradient;
    for(let i=0;i<6;i++){const numeric=(gp[i]-gm[i])/(2*h),analytic=base.tangent[i][j];maxDiff=Math.max(maxDiff,Math.abs(analytic-numeric));maxRef=Math.max(maxRef,Math.abs(numeric));maxAsym=Math.max(maxAsym,Math.abs(base.tangent[i][j]-base.tangent[j][i]))}
  }
  const relative=maxDiff/Math.max(1,maxRef);assert(relative<3e-6,`Conexão co-rotacional: tangente condensada inconsistente (${relative})`);assert(maxAsym/Math.max(1,maxRef)<1e-10,`Conexão co-rotacional: tangente conservativa perdeu simetria (${maxAsym})`);assert(base.internalConnectionResidual<1e-7,`Conexão co-rotacional: equilíbrio interno residual ${base.internalConnectionResidual}`);
  console.log('Co-rotacional — tangente semirrígida condensada OK','erro relativo=',relative,'resíduo interno=',base.internalConnectionResidual);
}

// 14) Console com mola rotacional na base: limite linear conhecido e momento transmitido pela mola.
{
  const p=emptyProject();p.name='Co-rotacional — console semirrígido';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];const e=makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50'});e.rotationalSprings={rz1:10000,rz2:null};p.elements=[e];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:40,tolerance:1e-10}),tip=r.displacements.find(d=>d.nodeId==='N2'),f=r.elementForces[0],conn=f.connectionRotations.find(x=>x.end===1),expected=10*4**3/(3*30e6*.003125)+10*4**2/10000;
  near(Math.abs(tip.uy),expected,2e-6,'Co-rotacional semirrígido: flecha');near(Math.abs(f.M1),40,.03,'Co-rotacional semirrígido: M1');near(Math.abs(conn.relativeRotation),.004,4e-6,'Co-rotacional semirrígido: rotação relativa');near(Math.abs(conn.moment),40,.03,'Co-rotacional semirrígido: momento da ligação');assert(f.connectionCondensation.internalResidual<1e-7,'Co-rotacional semirrígido: equilíbrio interno da ligação');
  console.log(p.name,'OK','delta [mm]=',Math.abs(tip.uy)*1000,'M=',f.M1,'dtheta=',conn.relativeRotation);
}

// 15) Viga biapoiada com releases nas duas extremidades sob UDL: momentos finais nulos e carga de barra condensada corretamente.
{
  const p=emptyProject();p.name='Co-rotacional — UDL com duas rótulas';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];const e=makeFrameElement({id:'E1',n1:'N1',n2:'N2'});e.releases={rz1:true,rz2:true};e.rotationalSprings={rz1:0,rz2:0};p.elements=[e];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'Q1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20}];
  const r=solveFrameCorotational2D(p,'LC1',{steps:8,maxIterations:40,tolerance:1e-10}),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),f=r.elementForces[0],resp=r.elementResponses[0],mmax=Math.max(...resp.stations.map(s=>s.M));
  near(ra.fy,60,2e-5,'Co-rotacional release UDL: RA');near(rb.fy,60,2e-5,'Co-rotacional release UDL: RB');near(f.M1,0,2e-6,'Co-rotacional release UDL: M1');near(f.M2,0,2e-6,'Co-rotacional release UDL: M2');near(mmax,90,.08,'Co-rotacional release UDL: Mmax');assert(f.connectionRotations.length===2,'Co-rotacional release UDL: metadados das duas rótulas ausentes');assert(f.connectionRotations.every(c=>Math.abs(c.moment)<2e-6),'Co-rotacional release UDL: momento residual em rótula');assert(f.connectionCondensation.internalResidual<1e-7,'Co-rotacional release UDL: equilíbrio interno da condensação');
  console.log(p.name,'OK','R=',ra.fy,rb.fy,'Mext=',f.M1,f.M2,'Mmax=',mmax);
}

// 16) Estados ainda fora do escopo devem ser recusados, nunca ignorados.
{
  const settlement=simpleCantilever();settlement.settlements=[{id:'SET1',caseId:'LC1',nodeId:'N1',ux:0,uy:.001,rz:0}];
  mustThrow(()=>solveFrameCorotational2D(settlement,'LC1'),/deslocamentos impostos|recalques/i,'Co-rotacional: recalque deve ser recusado');
  const imperfect=simpleCantilever();imperfect.settings.imperfection={...(imperfect.settings.imperfection||{}),enabled:true,scenarioId:'LC1',mode:1,amplitudeMm:10};
  mustThrow(()=>solveFrameCorotational2D(imperfect,'LC1'),/imperfei/i,'Co-rotacional: imperfeição modal deve ser recusada');
  const prescribed=simpleCantilever();prescribed.supports[0].baseUxValue=.001;
  mustThrow(()=>solveFrameCorotational2D(prescribed,'LC1'),/deslocamentos impostos/i,'Co-rotacional: deslocamento base deve ser recusado');
  const invalidFollower=simpleCantilever();invalidFollower.loads=[];invalidFollower.elementLoads=[{id:'F1',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:1,px:0,py:-10}];
  mustThrow(()=>solveFrameCorotational2D(invalidFollower,'LC1'),/extremidade 2/i,'Co-rotacional: follower na extremidade 1 deve ser recusada');
  console.log('Co-rotacional — escopo protegido OK: recalques, imperfeição, deslocamento base e follower fora da ext. 2 recusados');
}

console.log('Todos os smoke tests co-rotacionais experimentais do AstraStruct v0.13.4 passaram.');
