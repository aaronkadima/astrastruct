from pathlib import Path
import re

p=Path('web/src/solver/corotational2d.js')
t=p.read_text()

anchor="import { sectionDepth } from '../core/model.js';\n"
ins="import { analyzeTangentSpectrum, detectMultimodeTransitions, applyReferenceEigenvalueRatios } from './stabilityMultimode2d.js';\n"
if ins not in t:
    if anchor not in t: raise SystemExit('import anchor missing')
    t=t.replace(anchor,anchor+ins,1)

pat=r"function tangentStabilityState\(prepared,current,Lchar,previous=null,options=\{\}\)\{.*?\n\}\n\nfunction stabilityTransition\(prepared,prev,curr,previousPoint,currentPoint,previousIncrement,currentIncrement,referenceEigenvalue,tolerance\)\{.*?\n\}\n"
rep="""function tangentStabilityState(prepared,current,Lchar,previous=null,options={}){\n  return analyzeTangentSpectrum(prepared,current,Lchar,previous,options);\n}\n\nfunction stabilityTransitions(prepared,prev,curr,previousPoint,currentPoint,previousIncrement,currentIncrement,referenceEigenvalues,tolerance){\n  return detectMultimodeTransitions(prepared,prev,curr,previousPoint,currentPoint,previousIncrement,currentIncrement,referenceEigenvalues,tolerance);\n}\n"""
nt,n=re.subn(pat,rep,t,count=1,flags=re.S)
if n!=1 and 'function stabilityTransitions(' not in t: raise SystemExit('stability function replacement failed')
t=nt

probe="""
function probeModalBranch(prepared,uBase,lambdaBase,rawMode,weights,radius,amplitude,sign,monitor,options,maxIterations,tolerance,absoluteTolerance,constraintTolerance){
  try{
    let mode=[...(rawMode||[])],mn=Math.sqrt(Math.max(0,arcDot(mode,mode,weights)));if(!(mn>1e-14))throw new Error('modo crítico degenerado');mode=mode.map(v=>v/mn);
    const sgn=Number(sign)<0?-1:1,beta=clamp(Math.abs(Number(amplitude)||.08),1e-4,.45),target=sgn*beta*radius;
    let u=addFreeIncrement(prepared,uBase,mode,target),lambda=lambdaBase,current=residualAt(prepared,u,lambda,options),iteration=0;
    for(iteration=1;iteration<=maxIterations;iteration++){
      const duStep=prepared.free.map(d=>u[d]-uBase[d]),g=arcDot(duStep,mode,weights)-target,scale=residualScale(prepared,current,lambda),gTol=Math.max(constraintTolerance*Math.max(Math.abs(target),radius*1e-3),1e-12);
      if(current.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(g)<=gTol)return{sign:sgn,success:true,loadFactor:lambda,monitoredDisplacement:u[monitor.index],residualNorm:current.norm,iterations:iteration,projectionRatio:arcDot(duStep,mode,weights)/Math.max(radius,1e-18),targetRatio:sgn*beta};
      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]),aug=Kff.map((row,i)=>[...row,-pf[i]]);aug.push([...mode.map((v,i)=>weights[i]*v),0]);
      const corr=solveLinear(aug,[...rf,-g]),du=corr.slice(0,prepared.free.length),dl=corr.at(-1);if(!(Number.isFinite(dl)&&du.every(Number.isFinite)))throw new Error('correção modal inválida');
      const baseMerit=Math.hypot(current.norm/Math.max(scale,1e-18),Math.abs(g)/Math.max(Math.abs(target),1e-12));let eta=1,next=null;
      for(let ls=0;ls<7;ls++){
        const trial=addFreeIncrement(prepared,u,du,eta),trialLambda=lambda+eta*dl,candidate=residualAt(prepared,trial,trialLambda,options),trialDu=prepared.free.map(d=>trial[d]-uBase[d]),trialG=arcDot(trialDu,mode,weights)-target,trialScale=residualScale(prepared,candidate,trialLambda),merit=Math.hypot(candidate.norm/Math.max(trialScale,1e-18),Math.abs(trialG)/Math.max(Math.abs(target),1e-12));
        if(merit<baseMerit||eta<=1/64){next={u:trial,lambda:trialLambda,current:candidate};break}eta*=.5;
      }
      if(!next)throw new Error('line search modal sem redução de mérito');u=next.u;lambda=next.lambda;current=next.current;
    }
    return{sign:sgn,success:false,error:`não convergiu em ${maxIterations} iterações`,residualNorm:current.norm};
  }catch(e){return{sign:Number(sign)<0?-1:1,success:false,error:e?.message||String(e)}}
}

"""
if 'function probeModalBranch(' not in t:
    marker='function pathTurningEvents(history){'
    if marker not in t: raise SystemExit('probe insertion marker missing')
    t=t.replace(marker,probe+marker,1)

t=t.replace(' * v0.18 spherical arc-length / Riks continuation with tangent-stability tracking.',' * v0.19 spherical arc-length / Riks continuation with multimode tangent-stability tracking.',1)

old="  const stabilityTracking=options.stabilityTracking!==false,stabilityTolerance=Math.max(1e-5,Math.abs(Number(options.stabilityEigenTolerance??0.05)||0.05)),branchSwitchEnabled=!!options.branchSwitchEnabled,branchSwitchSign=Number(options.branchSwitchSign)<0?-1:1,branchSwitchAmplitude=clamp(Math.abs(Number(options.branchSwitchAmplitude??.08)||.08),1e-4,.45);"
new="  const stabilityTracking=options.stabilityTracking!==false,stabilityTolerance=Math.max(1e-5,Math.abs(Number(options.stabilityEigenTolerance??0.05)||0.05)),stabilityModeCount=clamp(Math.round(Number(options.stabilityModeCount??4)||4),1,12),stabilityClusterTolerance=clamp(Math.abs(Number(options.stabilityClusterTolerance??.03)||.03),1e-6,.5),stabilityMacThreshold=clamp(Number(options.stabilityMacThreshold??.25)||.25,0,1),branchSwitchEnabled=!!options.branchSwitchEnabled,branchSwitchSign=Number(options.branchSwitchSign)<0?-1:1,branchSwitchAmplitude=clamp(Math.abs(Number(options.branchSwitchAmplitude??.08)||.08),1e-4,.45),branchExploreEnabled=!!options.branchExploreEnabled,branchExploreAmplitude=clamp(Math.abs(Number(options.branchExploreAmplitude??branchSwitchAmplitude)||branchSwitchAmplitude),1e-4,.45),branchExploreMaxIterations=clamp(Math.round(Number(options.branchExploreMaxIterations??30)||30),5,80),branchExploreMaxEvents=clamp(Math.round(Number(options.branchExploreMaxEvents??3)||3),1,12);"
if old not in t: raise SystemExit('stability options anchor missing')
t=t.replace(old,new,1)

old="  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null,pendingBranchSwitch=null;const history=[],yieldedKeys=new Set(),stabilityEvents=[],branchSwitches=[];\n  let previousStability=stabilityTracking?tangentStabilityState(prepared,initial,Lchar,null,options):null;const referenceEigenvalue=previousStability?.enabled?Math.abs(previousStability.eigenvalue):null;if(previousStability?.enabled)previousStability.eigenvalueRatio=previousStability.eigenvalue/Math.max(referenceEigenvalue||1,1e-18);"
new="  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null,pendingBranchSwitch=null;const history=[],yieldedKeys=new Set(),stabilityEvents=[],branchSwitches=[],branchExplorations=[];\n  let previousStability=stabilityTracking?tangentStabilityState(prepared,initial,Lchar,null,{...options,stabilityModeCount,stabilityClusterTolerance,stabilityMacThreshold}):null;const referenceEigenvalues=Object.fromEntries((previousStability?.modes||[]).map(m=>[m.id,Math.abs(m.eigenvalue)])),referenceEigenvalue=previousStability?.enabled?Math.abs(previousStability.eigenvalue):null;if(previousStability?.enabled)applyReferenceEigenvalueRatios(previousStability,referenceEigenvalues);"
if old not in t: raise SystemExit('stability initialization anchor missing')
t=t.replace(old,new,1)

pat=r"    const adapt=clamp\(Math\.sqrt\(targetIterations/Math\.max\(1,iteration\)\),\.65,1\.35\),radiusNext=.*?\n    const stabilityEvent=.*?\n    history\.push"
rep="""    const adapt=clamp(Math.sqrt(targetIterations/Math.max(1,iteration)),.65,1.35),radiusNext=clamp(radius*adapt,minRadius,maxRadius),previousPoint=history.length?history.at(-1):{step:0,loadFactor:lambdaBase,monitoredDisplacement:uBase[monitor.index]},currentPoint={step,loadFactor:lambda,monitoredDisplacement:u[monitor.index]},stabilityState=stabilityTracking?tangentStabilityState(prepared,last,Lchar,previousStability,{...options,stabilityModeCount,stabilityClusterTolerance,stabilityMacThreshold}):null;if(stabilityState?.enabled)applyReferenceEigenvalueRatios(stabilityState,referenceEigenvalues);\n    const newStabilityEvents=stabilityTransitions(prepared,previousStability,stabilityState,previousPoint,currentPoint,previous?.dLambda,stepDl,referenceEigenvalues,stabilityTolerance);\n    for(const stabilityEvent of newStabilityEvents){\n      stabilityEvents.push(stabilityEvent);\n      if(branchExploreEnabled&&stabilityEvent.type==='bifurcation-candidate'&&branchExplorations.length<branchExploreMaxEvents){const probes=[1,-1].map(sign=>probeModalBranch(prepared,u,lambda,stabilityEvent.mode,weights,usedRadius,branchExploreAmplitude,sign,monitor,options,branchExploreMaxIterations,tolerance,absoluteTolerance,constraintTolerance));const exploration={sourceEventStep:stabilityEvent.step,modeId:stabilityEvent.modeId,clusterId:stabilityEvent.clusterId,criticalLoadFactor:stabilityEvent.criticalLoadFactor,amplitudeRatio:branchExploreAmplitude,probes,successfulSigns:probes.filter(x=>x.success).map(x=>x.sign),experimental:true};branchExplorations.push(exploration);stabilityEvent.branchExploration={successfulSigns:exploration.successfulSigns,probes:probes.map(x=>({sign:x.sign,success:x.success,loadFactor:x.loadFactor,monitoredDisplacement:x.monitoredDisplacement,projectionRatio:x.projectionRatio,error:x.error||null}))}}\n      if(branchSwitchEnabled&&stabilityEvent.type==='bifurcation-candidate'&&!pendingBranchSwitch&&!branchSwitches.length)pendingBranchSwitch={sourceEventStep:stabilityEvent.step,sourceCriticalLoadFactor:stabilityEvent.criticalLoadFactor,modeId:stabilityEvent.modeId,clusterId:stabilityEvent.clusterId,mode:stabilityEvent.mode};\n    }\n    history.push"""
nt,n=re.subn(pat,rep,t,count=1,flags=re.S)
if n!=1: raise SystemExit('stability update block replacement failed')
t=nt

old="branchSwitch:branchSwitchRecord});"
new="branchSwitch:branchSwitchRecord,criticalModes:(stabilityState?.modes||[]).map(m=>({id:m.id,rank:m.rank,eigenvalue:m.eigenvalue,eigenvalueRatio:m.eigenvalueRatio,macToPrevious:m.macToPrevious,clusterId:m.clusterId,clusterSize:m.clusterSize,subspaceContinuity:m.subspaceContinuity,dominant:m.dominant})),stabilityEvents:newStabilityEvents.map(e=>({type:e.type,modeId:e.modeId,clusterId:e.clusterId,criticalLoadFactor:e.criticalLoadFactor,mac:e.mac}))});"
if old not in t: raise SystemExit('history metadata anchor missing')
t=t.replace(old,new,1)

t=t.replace('branchSwitch:h.branchSwitch})),turningPoints=pathTurningEvents(history)', 'branchSwitch:h.branchSwitch,criticalModes:h.criticalModes,stabilityEvents:h.stabilityEvents})),turningPoints=pathTurningEvents(history)',1)

pat=r"  const stability=\{enabled:stabilityTracking,method:'scaled symmetric-part tangent eigenspectrum \(Jacobi\)'.*?\};\n  const arcLength="
rep="""  const stability={enabled:stabilityTracking,method:'scaled symmetric-part tangent eigenspectrum (Jacobi) · multimode',referenceEigenvalue,referenceEigenvalues,relativeTolerance:stabilityTolerance,asymmetryTolerance:Number(options.stabilityAsymmetryTolerance??1e-6)||1e-6,maxDofs:clamp(Math.round(Number(options.stabilityMaxDofs??120)||120),6,500),modeCount:stabilityModeCount,clusterTolerance:stabilityClusterTolerance,macThreshold:stabilityMacThreshold,events:stabilityEvents,finalModes:(previousStability?.modes||[]).map(m=>({id:m.id,rank:m.rank,eigenvalue:m.eigenvalue,eigenvalueRatio:m.eigenvalueRatio,macToPrevious:m.macToPrevious,clusterId:m.clusterId,clusterSize:m.clusterSize,subspaceContinuity:m.subspaceContinuity,dominant:m.dominant})),finalClusters:(previousStability?.clusters||[]).map(c=>({id:c.id,size:c.size,meanEigenvalue:c.meanEigenvalue,minAbsEigenvalue:c.minAbsEigenvalue,subspaceContinuity:c.subspaceContinuity,modeIds:c.modes.map(m=>m.id)})),branchExploration:{enabled:branchExploreEnabled,method:'independent ± critical-mode one-step equilibrium probes',amplitudeRatio:branchExploreAmplitude,maxIterations:branchExploreMaxIterations,explorations:branchExplorations,experimental:true},branchSwitch:{enabled:branchSwitchEnabled,method:'critical-mode one-step modal-amplitude constraint + arc-length continuation',sign:branchSwitchSign,amplitudeRatio:branchSwitchAmplitude,switches:branchSwitches,experimental:true},classification:'mode-by-mode zero crossing; limit-point when crossing coincides with load-factor reversal; bifurcation-candidate otherwise for near-symmetric tangent',modeTracking:'greedy MAC plus near-degenerate eigenspace clustering and subspace continuity',nonconservativeCaveat:'for materially non-symmetric tangents (e.g. follower loads), only the symmetric part is monitored and no conservative bifurcation claim is made'};\n  const arcLength="""
nt,n=re.subn(pat,rep,t,count=1,flags=re.S)
if n!=1: raise SystemExit('stability result replacement failed')
t=nt

t=t.replace("solverVersion:'0.18.0-exp'","solverVersion:'0.19.0-exp'",1)
p.write_text(t)
