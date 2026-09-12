from pathlib import Path
import re

p=Path('web/src/solver/corotational2d.js')
s=p.read_text()

s=s.replace(
"export function corotationalDistributedPlasticityElementState({X1,Y1,X2,Y2,qGlobal,E,A,I,initialBasic=[0,0,0],section,material,distributedPlasticity={}}){",
"export function corotationalDistributedPlasticityElementState({X1,Y1,X2,Y2,qGlobal,E,A,I,initialBasic=[0,0,0],section,material,distributedPlasticity={},committedHistory=null}){")
s=s.replace(
"const distributed=distributedSteelFiberBasicState({elasticBasic,L0,section,material,config:distributedPlasticity}),basicForces=distributed.basicForces",
"const distributed=distributedSteelFiberBasicState({elasticBasic,L0,section,material,config:distributedPlasticity,committedHistory}),basicForces=distributed.basicForces")
s=s.replace(
"distributedPlasticity:item.distributedPlasticity});return{state,qElement:qNode",
"distributedPlasticity:item.distributedPlasticity,committedHistory:options.distributedPlasticityHistory?.[item.e.id]||null});return{state,qElement:qNode")

start=s.index('function distributedPlasticityResult(states=[]){')
end=s.index('\nfunction baseReactionAt',start)
replacement=r'''function distributedPlasticityResult(states=[]){
  const records=[];
  for(const entry of states||[]){
    const d=entry.state?.distributedPlasticity||entry.connected?.distributedPlasticity;if(!d)continue;
    records.push({elementId:entry.item.e.id,sectionFamily:d.sectionFamily,integrationPoints:d.integrationPoints,nFibers:d.nFibers,hardeningRatio:d.hardeningRatio,cyclic:!!d.cyclic,kinematicFraction:d.kinematicFraction,yieldedPointCount:d.yieldedPointCount,yieldedFiberCount:d.yieldedFiberCount,totalFiberCount:d.totalFiberCount,maxYieldFraction:d.maxYieldFraction,plasticLengthEstimate:d.plasticLengthEstimate,dissipatedEnergyIncrement:Number(d.dissipatedEnergyIncrement)||0,cumulativeDissipatedEnergy:Number(d.cumulativeDissipatedEnergy)||0,sections:(d.sections||[]).map(q=>({xi:q.xi,x:q.x,epsilon0:q.epsilon0,kappa:q.kappa,N:q.N,M:q.M,yieldedFibers:q.yieldedFibers,fiberCount:q.fiberCount,yieldFraction:q.yieldFraction,minStress:q.minStress,maxStress:q.maxStress,minStrain:q.minStrain,maxStrain:q.maxStrain,maxEquivalentPlasticStrain:q.maxEquivalentPlasticStrain,maxBackstress:q.maxBackstress,dissipatedEnergyIncrement:q.dissipatedEnergyIncrement}))})
  }
  const cyclic=records.some(r=>r.cyclic);
  return{enabled:records.length>0,version:cyclic?'0.21.0-exp':'0.20.0-exp',model:'displacement-based Euler-Bernoulli with Gauss-Lobatto steel fiber sections',integration:'Gauss-Lobatto including member ends',monotonic:!cyclic,cyclicHistory:cyclic,hardening:cyclic?'linear combined kinematic/isotropic with return mapping':'monotonic bilinear envelope',records,yieldedPointCount:records.reduce((a,r)=>a+r.yieldedPointCount,0),yieldedFiberCount:records.reduce((a,r)=>a+r.yieldedFiberCount,0),plasticLengthEstimate:records.reduce((a,r)=>a+r.plasticLengthEstimate,0),cumulativeDissipatedEnergy:records.reduce((a,r)=>a+r.cumulativeDissipatedEnergy,0)};
}
function hasDistributedPlasticity(prepared){return(prepared?.elements||[]).some(x=>x.distributedPlasticity?.enabled)}
function hasCyclicDistributedPlasticity(prepared){return(prepared?.elements||[]).some(x=>x.distributedPlasticity?.enabled&&x.distributedPlasticity?.cyclic)}
function commitDistributedPlasticityHistory(states=[],store={}){
  for(const entry of states||[]){const d=entry.state?.distributedPlasticity||entry.connected?.distributedPlasticity;if(d?.historyTrial)store[entry.item.e.id]=d.historyTrial}
  return store;
}
function cyclicHistoryEnergy(store={}){return Object.values(store||{}).reduce((sum,h)=>sum+(Number(h?.cumulativeDissipatedEnergy)||0),0)}
function displacementTargets(control,steps,raw={}){
  if(!raw?.enabled)return Array.from({length:steps},(_,i)=>control.targetDisplacement*(i+1)/steps);
  const peaks=(Array.isArray(raw.targets)?raw.targets:[]).map(Number).filter(Number.isFinite);
  if(!peaks.length)throw new Error('Protocolo cíclico: informe pelo menos um deslocamento alvo.');
  const perSegment=clamp(Math.round(Number(raw.stepsPerSegment??6)||6),2,60),out=[];let previous=0;
  for(const peak of peaks){if(Math.abs(peak-previous)<=1e-14)continue;for(let j=1;j<=perSegment;j++)out.push(previous+(peak-previous)*j/perSegment);previous=peak}
  if(!out.length)throw new Error('Protocolo cíclico: todos os alvos coincidem com o estado inicial.');
  return out;
}
'''
s=s[:start]+replacement+s[end:]

fn_start=s.index('export function solveFrameCorotationalDisplacementControl2D')
fn_end=s.index('\n\nfunction resolveArcLengthMonitor',fn_start)
fn=s[fn_start:fn_end]
old="const control=resolveDisplacementControl(prepared,options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??20)||20),1,300),maxIterations=clamp(Math.round(Number(options.maxIterations??40)||40),3,120),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),controlTolerance=Math.max(1e-10,Number(options.displacementTolerance??1e-7)||1e-7),lineSearch=options.lineSearch!==false;"
new="const control=resolveDisplacementControl(prepared,options.displacementControl||{}),requestedSteps=clamp(Math.round(Number(options.steps??20)||20),1,300),maxIterations=clamp(Math.round(Number(options.maxIterations??40)||40),3,120),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),controlTolerance=Math.max(1e-10,Number(options.displacementTolerance??1e-7)||1e-7),lineSearch=options.lineSearch!==false,cyclicProtocol={enabled:!!options.cyclicProtocol?.enabled,targets:options.cyclicProtocol?.targets||[],stepsPerSegment:options.cyclicProtocol?.stepsPerSegment??6},targets=displacementTargets(control,requestedSteps,cyclicProtocol),steps=targets.length,cyclicMaterial=hasCyclicDistributedPlasticity(prepared),analysisOptions=cyclicMaterial?{...options,distributedPlasticityHistory:{}}:options;if(cyclicMaterial&&!cyclicProtocol.enabled)throw new Error('Plasticidade distribuída cíclica v0.21 requer controle de deslocamento com protocolo cíclico ativo.');"
if old not in fn: raise SystemExit('control declaration anchor missing')
fn=fn.replace(old,new)
fn=fn.replace("const target=control.targetDisplacement*step/steps,controlScale=Math.max(1e-8,Math.abs(control.targetDisplacement))","const target=targets[step-1],controlScale=Math.max(1e-8,...targets.map(Math.abs))")
fn=fn.replace('residualAt(prepared,u,lambda,options)','residualAt(prepared,u,lambda,analysisOptions)')
fn=fn.replace('residualAt(prepared,trial,trialLambda,options)','residualAt(prepared,trial,trialLambda,analysisOptions)')
fn=fn.replace('residualLoadDerivative(prepared,u,lambda,options)','residualLoadDerivative(prepared,u,lambda,analysisOptions)')
anchor="if(!firstYield&&newlyYielded.length)firstYield={step,loadFactor:lambda,controlledDisplacement:u[control.index],hinges:newlyYielded};\n    history.push({step,loadFactor:lambda,controlledDisplacement:u[control.index],targetDisplacement:target,baseReaction:baseReactionAt(prepared,last,control.dof),iterations:iteration,residualNorm:last.norm,controlResidual:target-u[control.index],materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded});"
replace="if(!firstYield&&newlyYielded.length)firstYield={step,loadFactor:lambda,controlledDisplacement:u[control.index],hinges:newlyYielded};\n    if(cyclicMaterial){commitDistributedPlasticityHistory(last.states,analysisOptions.distributedPlasticityHistory);last=residualAt(prepared,u,lambda,analysisOptions)}\n    const distributedStep=distributedPlasticityResult(last.states);\n    history.push({step,loadFactor:lambda,controlledDisplacement:u[control.index],targetDisplacement:target,baseReaction:baseReactionAt(prepared,last,control.dof),iterations:iteration,residualNorm:last.norm,controlResidual:target-u[control.index],materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYieldedHinges??newlyYielded,distributedYieldedPointCount:distributedStep.yieldedPointCount,distributedDissipatedEnergy:cyclicMaterial?cyclicHistoryEnergy(analysisOptions.distributedPlasticityHistory):distributedStep.cumulativeDissipatedEnergy});"
if anchor not in fn: raise SystemExit('history anchor missing')
fn=fn.replace(anchor,replace)
# fix accidental undefined expression intentionally to simple variable
fn=fn.replace('newlyYieldedHinges:newlyYieldedHinges??newlyYielded','newlyYieldedHinges:newlyYielded')
old_p="pushover={enabled:true,method:'displacement-control',control,finalLoadFactor:lambda,curve,peakLoadFactor:peak?.loadFactor??lambda,peakControlledDisplacement:peak?.controlledDisplacement??u[control.index],firstYield,loadFactorDerivative:'centered finite difference of complete residual',arcLength:false};"
new_p="pushover={enabled:true,method:cyclicProtocol.enabled?'cyclic-displacement-control':'displacement-control',control,finalLoadFactor:lambda,curve,peakLoadFactor:peak?.loadFactor??lambda,peakControlledDisplacement:peak?.controlledDisplacement??u[control.index],firstYield,loadFactorDerivative:'centered finite difference of complete residual',arcLength:false,cyclicProtocol:{enabled:cyclicProtocol.enabled,targets:[...cyclicProtocol.targets],stepsPerSegment:cyclicProtocol.stepsPerSegment,totalSteps:steps,commitRollback:cyclicMaterial?'committed after converged global step; trial states discarded on Newton/line-search rejection':'not active'},cumulativeDissipatedEnergy:cyclicMaterial?cyclicHistoryEnergy(analysisOptions.distributedPlasticityHistory):0};"
if old_p not in fn: raise SystemExit('pushover anchor missing')
fn=fn.replace(old_p,new_p)
fn=fn.replace("solverVersion:hasDistributedPlasticity(prepared)?'0.20.0-exp':'0.16.0-exp'","solverVersion:cyclicMaterial?'0.21.0-exp':(hasDistributedPlasticity(prepared)?'0.20.0-exp':'0.16.0-exp')")
fn=fn.replace("controlMode:'displacement',steps,maxIterations","controlMode:cyclicProtocol.enabled?'cyclic-displacement':'displacement',steps,maxIterations")
s=s[:fn_start]+fn+s[fn_end:]
p.write_text(s)

# index.js: pass cyclic protocol settings
p=Path('web/src/solver/index.js'); s=p.read_text()
needle="displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},arcLengthMonitor:"
repl="displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},cyclicProtocol:{enabled:!!s.cyclicProtocolEnabled,targets:Array.isArray(s.cyclicProtocolTargets)?s.cyclicProtocolTargets:[],stepsPerSegment:s.cyclicStepsPerSegment},arcLengthMonitor:"
if needle not in s: raise SystemExit('index cyclic anchor missing')
p.write_text(s.replace(needle,repl))

# model.js settings + normalization + element distributed config normalization
p=Path('web/src/core/model.js'); s=p.read_text()
s=s.replace("nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,","nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,\n      cyclicProtocolEnabled: false, cyclicProtocolTargets: [-0.02,0.02,-0.04,0.04,0], cyclicStepsPerSegment: 6,")
anchor="p.settings.displacementControlTolerance = Math.max(1e-10, Number(p.settings.displacementControlTolerance) || 1e-7);"
s=s.replace(anchor,anchor+"\n  p.settings.cyclicProtocolEnabled = !!p.settings.cyclicProtocolEnabled;\n  p.settings.cyclicProtocolTargets = (Array.isArray(p.settings.cyclicProtocolTargets)?p.settings.cyclicProtocolTargets:[]).map(Number).filter(Number.isFinite).slice(0,30);\n  if(!p.settings.cyclicProtocolTargets.length)p.settings.cyclicProtocolTargets=[-0.02,0.02,-0.04,0.04,0];\n  p.settings.cyclicStepsPerSegment = Math.max(2, Math.min(60, Math.round(Number(p.settings.cyclicStepsPerSegment) || 6)));")
old="return { ...e, releases, rotationalSprings };"
new="const dp={enabled:!!e.distributedPlasticity?.enabled,integrationPoints:[3,5].includes(Math.round(Number(e.distributedPlasticity?.integrationPoints)))?Math.round(Number(e.distributedPlasticity.integrationPoints)):5,nFibers:Math.max(8,Math.min(400,Math.round(Number(e.distributedPlasticity?.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(e.distributedPlasticity?.hardeningRatio)||.01))),cyclic:!!e.distributedPlasticity?.cyclic,kinematicFraction:Math.max(0,Math.min(1,Number.isFinite(Number(e.distributedPlasticity?.kinematicFraction))?Number(e.distributedPlasticity.kinematicFraction):1))};\n    return { ...e, releases, rotationalSprings, distributedPlasticity:dp };"
if old not in s: raise SystemExit('model element anchor missing')
p.write_text(s.replace(old,new))
