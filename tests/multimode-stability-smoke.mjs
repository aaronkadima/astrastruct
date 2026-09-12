import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { analyzeTangentSpectrum } from '../web/src/solver/stabilityMultimode2d.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};

function syntheticDegenerateSubspace(){
  const prepared={free:[0,3],nodes:[{id:'A'},{id:'B'}],nd:6},K=Array.from({length:6},()=>Array(6).fill(0));K[0][0]=1;K[3][3]=1;
  const previous={enabled:true,modes:[
    {id:'mode-a',modeGeneralized:[Math.SQRT1_2,Math.SQRT1_2]},
    {id:'mode-b',modeGeneralized:[-Math.SQRT1_2,Math.SQRT1_2]}
  ],clusters:[{id:'cluster-old',modes:[{modeGeneralized:[Math.SQRT1_2,Math.SQRT1_2]},{modeGeneralized:[-Math.SQRT1_2,Math.SQRT1_2]}]}]};
  const state=analyzeTangentSpectrum(prepared,{K},1,previous,{stabilityModeCount:2,stabilityClusterTolerance:.05,stabilityMacThreshold:.2,stabilityMaxDofs:20});
  assert(state.modes.length===2,'v0.19 synthetic: dois modos não foram preservados');
  assert(state.clusters.some(c=>c.size===2),'v0.19 synthetic: subespaço degenerado não foi agrupado');
  const c=state.clusters.find(x=>x.size===2);assert(c.subspaceContinuity>.999999,`v0.19 synthetic: continuidade de subespaço baixa ${c.subspaceContinuity}`);
  console.log('v0.19 — MAC/subespaço degenerado OK',c.subspaceContinuity);
}

function eulerColumn({explore=false}={}){
  const p=emptyProject(),L=4,n=8,P=10000,E=200e6,I=8e-5,A=.01;
  p.materials=[{id:'S',name:'Steel elastic',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'Column',family:'rect',b:.1,h:.8,A,I}];
  p.nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:0,y:L*i/n}));p.elements=[];for(let i=0;i<n;i++)p.elements.push({id:`E${i+1}`,type:'frame2d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}});
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:false},{nodeId:`N${n}`,ux:true,uy:false,rz:false}];p.loads=[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:0,fy:-P,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'N4',arcLengthMonitorDof:'ux',arcLengthInitialLoadIncrement:.06,arcLengthTargetIterations:5,arcLengthMaxCutbacks:12,arcLengthMinRadiusFactor:.001,arcLengthMaxRadiusFactor:1.5,nonlinearSteps:26,nonlinearMaxIterations:70,nonlinearTolerance:1e-9,stabilityTracking:true,stabilityEigenTolerance:.08,stabilityAsymmetryTolerance:1e-7,stabilityMaxDofs:120,stabilityModeCount:4,stabilityClusterTolerance:.03,stabilityMacThreshold:.2,branchExploreEnabled:explore,branchExploreAmplitude:.08,branchExploreMaxIterations:40,branchExploreMaxEvents:2,branchSwitchEnabled:false};
  return p;
}

function twinEulerColumns(){
  const p=emptyProject(),L=4,n=6,P=10000,E=200e6,I=8e-5,A=.01;
  p.materials=[{id:'S',name:'Steel elastic',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'Column',family:'rect',b:.1,h:.8,A,I}];p.nodes=[];p.elements=[];p.loads=[];p.supports=[];
  for(const [prefix,x] of [['A',-1],['B',1]]){
    for(let i=0;i<=n;i++)p.nodes.push({id:`${prefix}${i}`,x,y:L*i/n});
    for(let i=0;i<n;i++)p.elements.push({id:`${prefix}E${i+1}`,type:'frame2d',n1:`${prefix}${i}`,n2:`${prefix}${i+1}`,materialId:'S',sectionId:'SEC',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}});
    p.supports.push({nodeId:`${prefix}0`,ux:true,uy:true,rz:false},{nodeId:`${prefix}${n}`,ux:true,uy:false,rz:false});p.loads.push({id:`P${prefix}`,caseId:'LC1',nodeId:`${prefix}${n}`,fx:0,fy:-P,mz:0});
  }
  p.elementLoads=[];p.nodeSprings=[];p.settlements=[];p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'A3',arcLengthMonitorDof:'ux',arcLengthInitialLoadIncrement:.06,arcLengthTargetIterations:5,arcLengthMaxCutbacks:10,nonlinearSteps:22,nonlinearMaxIterations:60,nonlinearTolerance:1e-9,stabilityTracking:true,stabilityEigenTolerance:.1,stabilityAsymmetryTolerance:1e-7,stabilityMaxDofs:200,stabilityModeCount:6,stabilityClusterTolerance:.06,stabilityMacThreshold:.15,branchExploreEnabled:false,branchSwitchEnabled:false};return p;
}

syntheticDegenerateSubspace();

{
  const r=solve(twinEulerColumns(),'LC1'),st=r.arcLength?.stability,rows=r.arcLength?.curve||[],clustered=rows.flatMap(x=>x.criticalModes||[]).filter(m=>m.clusterSize>=2),bifs=(st?.events||[]).filter(e=>e.type==='bifurcation-candidate');
  assert(r.solverVersion==='0.19.0-exp',`v0.19 twin: versão inesperada ${r.solverVersion}`);assert(st?.modeCount>=4,'v0.19 twin: espectro multimodal não ativo');assert(clustered.length>0,'v0.19 twin: modos degenerados das colunas gêmeas não foram agrupados');assert(bifs.length>=2,`v0.19 twin: esperava ao menos duas travessias modais, obtido ${bifs.length}`);
  console.log('v0.19 — colunas gêmeas multimodais OK','bifurcações=',bifs.map(e=>({mode:e.modeId,cluster:e.clusterId,lambda:e.criticalLoadFactor,mac:e.mac})));
}

{
  const r=solve(eulerColumn({explore:true}),'LC1'),explorations=r.arcLength?.stability?.branchExploration?.explorations||[],x=explorations[0],probes=x?.probes||[];
  assert(x,'v0.19 exploration: nenhuma exploração ±φ foi registrada');assert(probes.length===2,'v0.19 exploration: deveriam existir dois probes');assert(probes.every(p=>p.success),`v0.19 exploration: probe falhou ${JSON.stringify(probes)}`);assert(new Set(probes.map(p=>p.sign)).size===2,'v0.19 exploration: sinais + e - não foram ambos avaliados');
  const u=probes.map(p=>Number(p.monitoredDisplacement));assert(u[0]*u[1]<0,`v0.19 exploration: ramos probes não ficaram em lados opostos, u=${u}`);
  console.log('v0.19 — exploração bilateral de ramo OK',probes.map(p=>({sign:p.sign,lambda:p.loadFactor,u:p.monitoredDisplacement,projection:p.projectionRatio})));
}

console.log('Todos os smoke tests multimodais do AstraStruct v0.19 passaram.');
