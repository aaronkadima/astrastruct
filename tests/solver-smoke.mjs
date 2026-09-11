import {
  demoTruss, demoFrame, demoBeamUDL, demoMixed, demoLoadCases,
  emptyProject, makeFrameElement
} from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { solveEnvelope } from '../web/src/solver/envelope.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

for(const p of [demoTruss(),demoFrame(),demoMixed()]){
  const r=solve(p);assert(r.displacements.length>0,`${p.name}: sem deslocamentos`);assert(r.displacements.every(d=>[d.ux,d.uy,d.rz].every(Number.isFinite)),`${p.name}: resultado não finito`);assert(r.elementForces.length===p.elements.length,`${p.name}: resultados de elementos inconsistentes`);assert(r.elementResponses.length===p.elements.length,`${p.name}: pós-processamento incompleto`);console.log(p.name,'OK','solver=',r.type,'DOFs=',r.dofs,'ativos=',r.activeDofs)
}

// Viga biapoiada L=6 m, q=20 kN/m: R=60+60 kN, delta=3.6 mm, Mmax=90 kN.m.
// Para seção 0.30 x 0.50 m, sigma extrema no meio = M*c/I = 7.2 MPa.
{
  const p=demoBeamUDL(),r=solve(p,'LC1'),r1=r.reactions.find(x=>x.nodeId==='N1'),r3=r.reactions.find(x=>x.nodeId==='N3'),mid=r.displacements.find(x=>x.nodeId==='N2');
  near(r1.fy,60,1e-6,'Viga UDL: reação N1');near(r3.fy,60,1e-6,'Viga UDL: reação N3');near(Math.abs(mid.uy),.0036,2e-5,'Viga UDL: flecha');near(r1.fy+r3.fy,120,1e-6,'Viga UDL: equilíbrio');
  const moments=r.elementResponses.flatMap(er=>er.stations.map(s=>s.M));near(Math.max(...moments),90,1e-6,'Viga UDL: Mmax');
  const end=r.elementResponses.find(er=>er.elementId==='E1').stations.at(-1);near(end.sigmaTop,-7.2,1e-8,'Viga UDL: sigma topo');near(end.sigmaBottom,7.2,1e-8,'Viga UDL: sigma base');
  console.log(p.name,'OK','Ry=',r1.fy,r3.fy,'Mmax=',Math.max(...moments),'sigma=',end.sigmaTop,end.sigmaBottom,'MPa');
}

// Extremidade rotulada: momento recuperado nulo.
{
  const p=emptyProject();p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];const e=makeFrameElement({id:'E1',n1:'N1',n2:'N2'});e.releases.rz2=true;e.rotationalSprings.rz2=0;p.elements=[e];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'EL1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-10}];const r=solve(p,'LC1');near(r.elementForces[0].M2,0,1e-8,'Release M2');near(r.elementResponses[0].stations.at(-1).M,0,1e-8,'Release M(x=L)');console.log('Liberação rotacional OK');
}

// Cantilever com mola rotacional na base: delta = PL^3/(3EI) + PL^2/kθ.
// P=10 kN, L=4 m, EI=93750 kN.m2, kθ=10000 kN.m/rad -> delta=18.27556 mm.
{
  const p=emptyProject();p.name='Console — ligação semirrígida';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];const e=makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50'});e.rotationalSprings={rz1:10000,rz2:null};p.elements=[e];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];
  const r=solve(p,'LC1'),tip=r.displacements.find(d=>d.nodeId==='N2'),f=r.elementForces[0],conn=f.connectionRotations.find(x=>x.end===1),expected=10*4**3/(3*30e6*.003125)+10*4**2/10000;
  near(Math.abs(tip.uy),expected,1e-10,'Semirrígida: flecha do console');near(Math.abs(f.M1),40,1e-8,'Semirrígida: momento na base');near(Math.abs(conn.relativeRotation),.004,1e-10,'Semirrígida: rotação relativa');near(Math.abs(conn.moment),40,1e-8,'Semirrígida: momento transmitido');console.log(p.name,'OK','delta [mm]=',Math.abs(tip.uy)*1000,'M=',f.M1,'dtheta=',conn.relativeRotation);
}

// Carga pontual P=100 kN no meio de viga biapoiada L=6 m: R=50+50 kN e Mmax=PL/4=150 kN.m.
{
  const p=emptyProject();p.name='Viga — carga pontual';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'P1',caseId:'LC1',elementId:'E1',kind:'point',xi:.5,px:0,py:-100}];
  const r=solve(p,'LC1'),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),resp=r.elementResponses[0],mid=resp.stations.find(s=>Math.abs(s.x-3)<1e-9);
  near(ra.fy,50,1e-7,'Carga pontual: RA');near(rb.fy,50,1e-7,'Carga pontual: RB');near(mid.M,150,1e-7,'Carga pontual: M meio');near(ra.fy+rb.fy,100,1e-7,'Carga pontual: equilíbrio');console.log(p.name,'OK','R=',ra.fy,rb.fy,'Mmax=',Math.max(...resp.stations.map(s=>s.M)));
}

// Peso próprio de viga RC horizontal: gamma=25 kN/m3, A=0.15 m2 -> w=3.75 kN/m.
{
  const p=emptyProject();p.name='Viga — peso próprio';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2'})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'SW1',caseId:'LC1',elementId:'E1',kind:'selfWeight',factor:1}];
  const r=solve(p,'LC1'),ra=r.reactions.find(x=>x.nodeId==='N1'),rb=r.reactions.find(x=>x.nodeId==='N2'),mmax=Math.max(...r.elementResponses[0].stations.map(s=>s.M));
  near(ra.fy,11.25,1e-7,'Peso próprio: RA');near(rb.fy,11.25,1e-7,'Peso próprio: RB');near(mmax,16.875,1e-6,'Peso próprio: Mmax');console.log(p.name,'OK','R=',ra.fy,rb.fy,'Mmax=',mmax);
}

// Deslocamento imposto axial: barra E=200 GPa, A=.004 m2, L=4 m, delta=1 mm -> N=200 kN.
{
  const p=emptyProject();p.name='Barra — recalque axial';p.loadCases=[{id:'S',name:'Recalque',type:'other'}];p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.004,I:0,label:'Barra'}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:true,uy:true,rz:false}];p.settlements=[{id:'S1',caseId:'S',nodeId:'N2',ux:.001,uy:0,rz:0}];
  const r=solve(p,'S'),n=r.elementForces[0].N;near(n,200,1e-7,'Recalque axial: N');near(r.displacements.find(d=>d.nodeId==='N2').ux,.001,1e-12,'Recalque axial: Ux prescrito');console.log(p.name,'OK','N=',n,'kN');
}

// Expansão térmica livre: delta = alpha * DeltaT * L e N ~ 0.
{
  const p=emptyProject();p.name='Barra — expansão térmica livre';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Barra térmica'}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.elementLoads=[{id:'T1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:50,dTGradient:0}];
  const r=solve(p,'LC1'),u=r.displacements.find(d=>d.nodeId==='N2').ux,N=r.elementForces[0].N;near(u,12e-6*50*2,1e-12,'Térmica livre: deslocamento');near(N,0,1e-8,'Térmica livre: força axial');console.log(p.name,'OK','ux=',u,'N=',N);
}

// Barra totalmente impedida: N = -EA alpha DeltaT = -1200 kN.
{
  const p=emptyProject();p.name='Barra — térmica impedida';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Barra térmica'}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:true,uy:true,rz:false}];p.elementLoads=[{id:'T1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:50,dTGradient:0}];
  const r=solve(p,'LC1'),N=r.elementForces[0].N;near(N,-1200,1e-7,'Térmica impedida: N');console.log(p.name,'OK','N=',N);
}

// Gradiente térmico fixo-fixo: |M| = EI |kappa_t| = 37.5 kN.m para C30 30x50.
{
  const p=emptyProject();p.name='Viga — gradiente térmico';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];p.elements=[makeFrameElement({id:'E1',n1:'N1',n2:'N2',sectionId:'rc_30x50'})];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:true,uy:true,rz:true}];p.elementLoads=[{id:'TG1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:0,dTGradient:20}];
  const r=solve(p,'LC1'),f=r.elementForces[0];near(Math.abs(f.M1),37.5,1e-7,'Gradiente térmico: M1');near(Math.abs(f.M2),37.5,1e-7,'Gradiente térmico: M2');console.log(p.name,'OK','M=',f.M1,f.M2);
}

// Barra + mola ao solo: kbarra=EA/L=1e6 kN/m, ks=1e5 kN/m, P=110 kN -> u=0.1 mm, N=100 kN, Fs=-10 kN.
{
  const p=emptyProject();p.name='Barra — mola axial';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Barra com mola'}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.nodeSprings=[{id:'SPR1',nodeId:'N2',kx:1e5,ky:0,kr:0}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:110,fy:0,mz:0}];
  const r=solve(p,'LC1'),u=r.displacements.find(d=>d.nodeId==='N2').ux,N=r.elementForces[0].N,fs=r.springForces[0].fx;near(u,.0001,1e-12,'Mola axial: deslocamento');near(N,100,1e-8,'Mola axial: N');near(fs,-10,1e-8,'Mola axial: força da mola');console.log(p.name,'OK','u=',u,'N=',N,'Fs=',fs);
}

// Superposição e envelope dos cenários lineares.
{
  const p=demoLoadCases(),g=solve(p,'G'),q=solve(p,'Q'),c=solve(p,'COMB1');assert(c.scenario.kind==='combination','Metadado de combinação incorreto');
  for(let i=0;i<c.displacements.length;i++)for(const dof of ['ux','uy','rz'])near(c.displacements[i][dof],1.2*g.displacements[i][dof]+1.5*q.displacements[i][dof],1e-10,`Superposição ${c.displacements[i].nodeId}.${dof}`);
  for(let i=0;i<c.reactions.length;i++)for(const dof of ['fx','fy','mz'])near(c.reactions[i][dof],1.2*g.reactions[i][dof]+1.5*q.reactions[i][dof],1e-8,`Reação combinada ${c.reactions[i].nodeId}.${dof}`);
  const env=solveEnvelope(p);assert(env.scenarios.length===3,'Envelope: cenários');assert(env.elementResponses.length===p.elements.length,'Envelope: elementos');assert(env.elementResponses.some(e=>e.stations.some(s=>s.sigmaAxial)),'Envelope: tensões ausentes');console.log(p.name,'OK','envelope=',env.scenarios.length);
}

console.log('Todos os smoke tests do AstraStruct v0.9 passaram.');
