from pathlib import Path


def rep(path, old, new):
    p=Path(path); t=p.read_text()
    if old not in t:
        raise SystemExit(f'anchor not found in {path}: {old[:160]!r}')
    p.write_text(t.replace(old,new,1))

# -----------------------------------------------------------------------------
# Core: tangent spectrum, singularity classification and experimental switching
# -----------------------------------------------------------------------------
p=Path('web/src/solver/corotational2d.js'); t=p.read_text()
if 'function tangentStabilityState' not in t:
    anchor='function pathTurningEvents(history){'
    if anchor not in t: raise SystemExit('arc-length helper anchor missing')
    block=r'''
function jacobiSymmetricEigen(A,maxSweeps=32,tolerance=1e-11){
  const n=A.length;if(!n)return[];
  const B=A.map(r=>r.map(Number)),V=zeros(n);for(let i=0;i<n;i++)V[i][i]=1;
  const scale=Math.max(1e-18,maxAbsMatrix(B));
  for(let sweep=0;sweep<maxSweeps;sweep++){
    let maxOff=0,changed=false;
    for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++){
      const apq=B[p][q],aa=Math.abs(apq);maxOff=Math.max(maxOff,aa);if(aa<=tolerance*scale)continue;
      const app=B[p][p],aqq=B[q][q],tau=(aqq-app)/(2*apq),sgn=tau>=0?1:-1,tt=sgn/(Math.abs(tau)+Math.sqrt(1+tau*tau)),c=1/Math.sqrt(1+tt*tt),s=tt*c;
      B[p][p]=app-tt*apq;B[q][q]=aqq+tt*apq;B[p][q]=B[q][p]=0;
      for(let k=0;k<n;k++)if(k!==p&&k!==q){const bkp=B[k][p],bkq=B[k][q];B[k][p]=B[p][k]=c*bkp-s*bkq;B[k][q]=B[q][k]=s*bkp+c*bkq}
      for(let k=0;k<n;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq}
      changed=true;
    }
    if(!changed||maxOff<=tolerance*scale)break;
  }
  return Array.from({length:n},(_,j)=>{let vector=V.map(r=>r[j]),norm=Math.hypot(...vector);if(norm>0)vector=vector.map(v=>v/norm);return{value:B[j][j],vector}});
}

function tangentStabilityState(prepared,current,Lchar,previous=null,options={}){
  const n=prepared.free.length,maxDofs=clamp(Math.round(Number(options.stabilityMaxDofs??120)||120),6,500),asymTol=Math.max(1e-12,Number(options.stabilityAsymmetryTolerance??1e-6)||1e-6);
  if(!n)return{enabled:false,reason:'no-free-dofs',dofs:0};
  if(n>maxDofs)return{enabled:false,reason:'dof-limit',dofs:n,maxDofs};
  const scales=prepared.free.map(d=>d%3===2?Lchar:1),K=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),raw=K.map((r,i)=>r.map((v,j)=>v/(scales[i]*scales[j]))),sym=raw.map((r,i)=>r.map((v,j)=>.5*(v+raw[j][i]))),skew=raw.map((r,i)=>r.map((v,j)=>v-raw[j][i])),asymmetry=maxAbsMatrix(skew)/Math.max(1,maxAbsMatrix(raw)),pairs=jacobiSymmetricEigen(sym);
  if(!pairs.length)return{enabled:false,reason:'eigensolver-empty',dofs:n};
  let selected=pairs.reduce((a,b)=>Math.abs(b.value)<Math.abs(a.value)?b:a,pairs[0]);
  if(previous?.modeGeneralized?.length===n){
    let best=-1;for(const pair of pairs){const mac=Math.abs(pair.vector.reduce((s,v,i)=>s+v*previous.modeGeneralized[i],0));if(mac>best){best=mac;selected=pair}}
  }
  let modeGeneralized=[...selected.vector];
  if(previous?.modeGeneralized?.length===n){const dot=modeGeneralized.reduce((s,v,i)=>s+v*previous.modeGeneralized[i],0);if(dot<0)modeGeneralized=modeGeneralized.map(v=>-v)}else{let im=0;for(let i=1;i<n;i++)if(Math.abs(modeGeneralized[i])>Math.abs(modeGeneralized[im]))im=i;if(modeGeneralized[im]<0)modeGeneralized=modeGeneralized.map(v=>-v)}
  const mode=modeGeneralized.map((v,i)=>v/scales[i]),im=modeGeneralized.reduce((best,_,i)=>Math.abs(modeGeneralized[i])>Math.abs(modeGeneralized[best])?i:best,0),globalDof=prepared.free[im],nodeIndex=Math.floor(globalDof/3),dof=['ux','uy','rz'][globalDof%3];
  return{enabled:true,method:'scaled-symmetric-tangent-jacobi',dofs:n,eigenvalue:Number(selected.value),mode,modeGeneralized,tangentAsymmetry:asymmetry,conservativeCompatible:asymmetry<=asymTol,asymmetryTolerance:asymTol,dominant:{nodeId:prepared.nodes[nodeIndex]?.id||null,dof,globalDof,freePosition:im},symmetricPart:true};
}

function stabilityTransition(prepared,prev,curr,previousPoint,currentPoint,previousIncrement,currentIncrement,referenceEigenvalue,tolerance){
  if(!prev?.enabled||!curr?.enabled)return null;
  const a=Number(prev.eigenvalue),b=Number(curr.eigenvalue);if(!(Number.isFinite(a)&&Number.isFinite(b))||a*b>0||Math.abs(a-b)<1e-18)return null;
  const frac=Math.abs(a)/(Math.abs(a)+Math.abs(b)||1),criticalLoadFactor=previousPoint.loadFactor+frac*(currentPoint.loadFactor-previousPoint.loadFactor),criticalDisplacement=previousPoint.monitoredDisplacement+frac*(currentPoint.monitoredDisplacement-previousPoint.monitoredDisplacement),turning=Number.isFinite(previousIncrement)&&previousIncrement*currentIncrement<0,conservative=prev.conservativeCompatible&&curr.conservativeCompatible,type=!conservative?'nonconservative-singularity-candidate':(turning?'limit-point':'bifurcation-candidate'),source=Math.abs(a)<=Math.abs(b)?prev:curr,mode=[...(source.mode||[])],full=Array(prepared.nd).fill(0);prepared.free.forEach((d,i)=>{full[d]=mode[i]||0});
  const modeByNode=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:full[3*i],uy:full[3*i+1],rz:full[3*i+2]}));
  return{type,betweenSteps:[previousPoint.step,currentPoint.step],step:currentPoint.step,criticalLoadFactor,criticalMonitoredDisplacement:criticalDisplacement,eigenvalueBefore:a,eigenvalueAfter:b,eigenvalueRatioBefore:a/Math.max(Math.abs(referenceEigenvalue)||1,1e-18),eigenvalueRatioAfter:b/Math.max(Math.abs(referenceEigenvalue)||1,1e-18),tolerance,loadIncrementBefore:previousIncrement,loadIncrementAfter:currentIncrement,tangentAsymmetry:Math.max(prev.tangentAsymmetry||0,curr.tangentAsymmetry||0),dominant:source.dominant,mode,modeByNode,classificationBasis:!conservative?'tangent is materially non-symmetric; symmetric-part spectrum only':(turning?'zero crossing plus load-factor reversal':'zero crossing without load-factor reversal')};
}

function perturbArcPredictor(predictor,request,weights,alpha,radius,amplitude,sign){
  let mode=[...(request?.mode||[])],mn=Math.sqrt(Math.max(0,arcDot(mode,mode,weights)));if(!(mn>1e-14))return{...predictor,branchPerturbation:null};mode=mode.map(v=>v/mn);
  const du0=predictor.du,du2=arcDot(du0,du0,weights);if(du2>1e-18){const projection=arcDot(mode,du0,weights)/du2,orth=mode.map((v,i)=>v-projection*du0[i]),on=Math.sqrt(Math.max(0,arcDot(orth,orth,weights)));if(on>1e-8)mode=orth.map(v=>v/on)}
  const beta=clamp(Math.abs(Number(amplitude)||.08),1e-4,.45),sgn=Number(sign)<0?-1:1,perturbation=beta*radius,du=du0.map((v,i)=>v+sgn*perturbation*mode[i]),norm=arcNorm(du,predictor.dLambda,weights,alpha),scale=radius/Math.max(norm,1e-18);
  return{...predictor,du:du.map(v=>v*scale),dLambda:predictor.dLambda*scale,branchPerturbation:{sourceEventStep:request.sourceEventStep,sourceCriticalLoadFactor:request.sourceCriticalLoadFactor,amplitudeRatio:beta,sign:sgn,mode:[...mode],orientation:'critical-eigenmode-orthogonal-perturbation'}};
}

'''
    t=t.replace(anchor,block+anchor,1)

# Upgrade arc solver version comment and inject stability controls.
t=t.replace(' * v0.17 spherical arc-length / Riks continuation.',' * v0.18 spherical arc-length / Riks continuation with tangent-stability tracking.',1)
old="  const initialLoadIncrement=Math.max(1e-5,Math.abs(Number(options.arcLengthInitialLoadIncrement??0.05)||0.05)),initialSign=Number(options.arcLengthInitialSign)<0?-1:1,targetIterations=clamp(Math.round(Number(options.arcLengthTargetIterations??6)||6),2,20),maxCutbacks=clamp(Math.round(Number(options.arcLengthMaxCutbacks??8)||8),0,16),minRadiusFactor=clamp(Number(options.arcLengthMinRadiusFactor??0.02)||0.02,1e-4,1),maxRadiusFactor=Math.max(1,Number(options.arcLengthMaxRadiusFactor??4)||4);"
new=old+"\n  const stabilityTracking=options.stabilityTracking!==false,stabilityTolerance=Math.max(1e-5,Math.abs(Number(options.stabilityEigenTolerance??0.05)||0.05)),branchSwitchEnabled=!!options.branchSwitchEnabled,branchSwitchSign=Number(options.branchSwitchSign)<0?-1:1,branchSwitchAmplitude=clamp(Math.abs(Number(options.branchSwitchAmplitude??.08)||.08),1e-4,.45);"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc options anchor missing')
old="  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null;const history=[],yieldedKeys=new Set();"
new="  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null,pendingBranchSwitch=null;const history=[],yieldedKeys=new Set(),stabilityEvents=[],branchSwitches=[];\n  let previousStability=stabilityTracking?tangentStabilityState(prepared,initial,Lchar,null,options):null;const referenceEigenvalue=previousStability?.enabled?Math.abs(previousStability.eigenvalue):null;if(previousStability?.enabled)previousStability.eigenvalueRatio=previousStability.eigenvalue/Math.max(referenceEigenvalue||1,1e-18);"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc initialization anchor missing')
old="    const uBase=[...u],lambdaBase=lambda;let accepted=false,lastError=null,iteration=0,cutbacksUsed=0,usedRadius=radius;"
new="    const uBase=[...u],lambdaBase=lambda,branchRequest=pendingBranchSwitch;let accepted=false,lastError=null,iteration=0,cutbacksUsed=0,usedRadius=radius,branchPerturbationUsed=null;"
t=t.replace(old,new,1)
old="        const baseState=residualAt(prepared,uBase,lambdaBase,options),predictor=arcPredictor(prepared,uBase,lambdaBase,baseState,radius,weights,alpha,previous,initialSign,options);\n        const predicted=addFreeIncrement(prepared,uBase,predictor.du);predicted.forEach((v,i)=>{u[i]=v});lambda=lambdaBase+predictor.dLambda;last=residualAt(prepared,u,lambda,options);"
new="        const baseState=residualAt(prepared,uBase,lambdaBase,options);let predictor=arcPredictor(prepared,uBase,lambdaBase,baseState,radius,weights,alpha,previous,initialSign,options);if(branchRequest){predictor=perturbArcPredictor(predictor,branchRequest,weights,alpha,radius,branchSwitchAmplitude,branchSwitchSign);branchPerturbationUsed=predictor.branchPerturbation}\n        const predicted=addFreeIncrement(prepared,uBase,predictor.du);predicted.forEach((v,i)=>{u[i]=v});lambda=lambdaBase+predictor.dLambda;last=residualAt(prepared,u,lambda,options);"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc predictor anchor missing')
old="    const stepDu=prepared.free.map(d=>u[d]-uBase[d]),stepDl=lambda-lambdaBase,stepNorm=arcNorm(stepDu,stepDl,weights,alpha),materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0)),hinges=fiberYieldSnapshot(last.states),yielded=hinges.filter(h=>h.yieldedFibers>0),newlyYielded=[];"
new="    const stepDu=prepared.free.map(d=>u[d]-uBase[d]),stepDl=lambda-lambdaBase,stepNorm=arcNorm(stepDu,stepDl,weights,alpha),materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0)),hinges=fiberYieldSnapshot(last.states),yielded=hinges.filter(h=>h.yieldedFibers>0),newlyYielded=[];\n    let branchSwitchRecord=null;if(branchRequest){const mode=branchRequest.mode||[],projection=mode.length?Math.abs(arcDot(stepDu,mode,weights))/Math.max(usedRadius,1e-18):0;branchSwitchRecord={sourceEventStep:branchRequest.sourceEventStep,appliedStep:step,criticalLoadFactor:branchRequest.sourceCriticalLoadFactor,amplitudeRatio:branchSwitchAmplitude,sign:branchSwitchSign,projectionRatio:projection,retained:projection>Math.max(1e-4,.15*branchSwitchAmplitude),predictor:branchPerturbationUsed};branchSwitches.push(branchSwitchRecord);pendingBranchSwitch=null}"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc step state anchor missing')
old="    const adapt=clamp(Math.sqrt(targetIterations/Math.max(1,iteration)),.65,1.35),radiusNext=clamp(radius*adapt,minRadius,maxRadius);\n    history.push({step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],baseReaction:baseReactionAt(prepared,last,monitor.dof),iterations:iteration,residualNorm:last.norm,arcConstraint:arcConstraint(stepDu,stepDl,weights,alpha,usedRadius),arcRadius:usedRadius,arcNorm:stepNorm,loadIncrement:stepDl,cutbacks:cutbacksUsed,materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded});\n    previous={du:stepDu,dLambda:stepDl};radius=radiusNext;"
new="    const adapt=clamp(Math.sqrt(targetIterations/Math.max(1,iteration)),.65,1.35),radiusNext=clamp(radius*adapt,minRadius,maxRadius),previousPoint=history.length?history.at(-1):{step:0,loadFactor:lambdaBase,monitoredDisplacement:uBase[monitor.index]},currentPoint={step,loadFactor:lambda,monitoredDisplacement:u[monitor.index]},stabilityState=stabilityTracking?tangentStabilityState(prepared,last,Lchar,previousStability,options):null;if(stabilityState?.enabled)stabilityState.eigenvalueRatio=stabilityState.eigenvalue/Math.max(referenceEigenvalue||1,1e-18);\n    const stabilityEvent=stabilityTransition(prepared,previousStability,stabilityState,previousPoint,currentPoint,previous?.dLambda,stepDl,referenceEigenvalue,stabilityTolerance);if(stabilityEvent){stabilityEvents.push(stabilityEvent);if(branchSwitchEnabled&&stabilityEvent.type==='bifurcation-candidate'&&!pendingBranchSwitch&&!branchSwitches.length)pendingBranchSwitch={sourceEventStep:stabilityEvent.step,sourceCriticalLoadFactor:stabilityEvent.criticalLoadFactor,mode:stabilityEvent.mode}}\n    history.push({step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],baseReaction:baseReactionAt(prepared,last,monitor.dof),iterations:iteration,residualNorm:last.norm,arcConstraint:arcConstraint(stepDu,stepDl,weights,alpha,usedRadius),arcRadius:usedRadius,arcNorm:stepNorm,loadIncrement:stepDl,cutbacks:cutbacksUsed,materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded,criticalEigenvalue:stabilityState?.enabled?stabilityState.eigenvalue:null,eigenvalueRatio:stabilityState?.enabled?stabilityState.eigenvalueRatio:null,tangentAsymmetry:stabilityState?.enabled?stabilityState.tangentAsymmetry:null,nearSingular:stabilityState?.enabled?Math.abs(stabilityState.eigenvalueRatio)<=stabilityTolerance:false,stabilityEvent:stabilityEvent?{type:stabilityEvent.type,criticalLoadFactor:stabilityEvent.criticalLoadFactor,dominant:stabilityEvent.dominant}:null,branchSwitch:branchSwitchRecord});\n    previousStability=stabilityState;previous={du:stepDu,dLambda:stepDl};radius=radiusNext;"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc history anchor missing')
old="  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0),imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null,curve=history.map(h=>({step:h.step,monitoredDisplacement:h.monitoredDisplacement,loadFactor:h.loadFactor,baseReaction:h.baseReaction,arcRadius:h.arcRadius,iterations:h.iterations,loadIncrement:h.loadIncrement,cutbacks:h.cutbacks,yieldedHingeCount:h.yieldedHingeCount,newlyYieldedHinges:h.newlyYieldedHinges})),turningPoints=pathTurningEvents(history),peak=curve.reduce((best,row)=>!best||Math.abs(row.loadFactor)>Math.abs(best.loadFactor)?row:best,null);"
new="  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0),imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null,curve=history.map(h=>({step:h.step,monitoredDisplacement:h.monitoredDisplacement,loadFactor:h.loadFactor,baseReaction:h.baseReaction,arcRadius:h.arcRadius,iterations:h.iterations,loadIncrement:h.loadIncrement,cutbacks:h.cutbacks,yieldedHingeCount:h.yieldedHingeCount,newlyYieldedHinges:h.newlyYieldedHinges,criticalEigenvalue:h.criticalEigenvalue,eigenvalueRatio:h.eigenvalueRatio,tangentAsymmetry:h.tangentAsymmetry,nearSingular:h.nearSingular,stabilityEvent:h.stabilityEvent,branchSwitch:h.branchSwitch})),turningPoints=pathTurningEvents(history),peak=curve.reduce((best,row)=>!best||Math.abs(row.loadFactor)>Math.abs(best.loadFactor)?row:best,null);"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc curve anchor missing')
old="  const arcLength={enabled:true,method:'crisfield-spherical',monitor,finalLoadFactor:lambda,curve,turningPoints,firstYield,initialLoadIncrement,initialRadius,finalRadius:radius,loadScale:alpha,characteristicLength:Lchar,targetIterations,maxCutbacks,minRadiusFactor,maxRadiusFactor,constraintTolerance,adaptive:true,branchSelection:'positive projection on previous generalized tangent',loadFactorDerivative:'centered finite difference of complete residual',peakLoadFactor:peak?.loadFactor??lambda,peakMonitoredDisplacement:peak?.monitoredDisplacement??u[monitor.index]};\n  const base={type:'frame2d-corotational-arc-length-experimental',solverVersion:'0.17.0-exp'"
new="  const stability={enabled:stabilityTracking,method:'scaled symmetric-part tangent eigenspectrum (Jacobi)',referenceEigenvalue,relativeTolerance:stabilityTolerance,asymmetryTolerance:Number(options.stabilityAsymmetryTolerance??1e-6)||1e-6,maxDofs:clamp(Math.round(Number(options.stabilityMaxDofs??120)||120),6,500),events:stabilityEvents,branchSwitch:{enabled:branchSwitchEnabled,method:'critical-mode orthogonal predictor perturbation',sign:branchSwitchSign,amplitudeRatio:branchSwitchAmplitude,switches:branchSwitches,experimental:true},classification:'limit-point when tangent zero-crossing coincides with load-factor reversal; bifurcation-candidate otherwise for near-symmetric tangent',nonconservativeCaveat:'for materially non-symmetric tangents (e.g. follower loads), only the symmetric part is monitored and no conservative bifurcation claim is made'};\n  const arcLength={enabled:true,method:'crisfield-spherical',monitor,finalLoadFactor:lambda,curve,turningPoints,firstYield,initialLoadIncrement,initialRadius,finalRadius:radius,loadScale:alpha,characteristicLength:Lchar,targetIterations,maxCutbacks,minRadiusFactor,maxRadiusFactor,constraintTolerance,adaptive:true,branchSelection:'positive projection on previous generalized tangent',loadFactorDerivative:'centered finite difference of complete residual',peakLoadFactor:peak?.loadFactor??lambda,peakMonitoredDisplacement:peak?.monitoredDisplacement??u[monitor.index],stability};\n  const base={type:'frame2d-corotational-arc-length-experimental',solverVersion:'0.18.0-exp'"
if old in t:t=t.replace(old,new,1)
else: raise SystemExit('arc result anchor missing')
p.write_text(t)

# -----------------------------------------------------------------------------
# Settings and dispatcher
# -----------------------------------------------------------------------------
rep('web/src/core/model.js',
"      arcLengthMonitorNodeId: null, arcLengthMonitorDof: 'uy', arcLengthInitialLoadIncrement: 0.05, arcLengthInitialSign: 1, arcLengthTargetIterations: 6, arcLengthMaxCutbacks: 8, arcLengthMinRadiusFactor: 0.02, arcLengthMaxRadiusFactor: 4, arcLengthConstraintTolerance: 1e-6,",
"      arcLengthMonitorNodeId: null, arcLengthMonitorDof: 'uy', arcLengthInitialLoadIncrement: 0.05, arcLengthInitialSign: 1, arcLengthTargetIterations: 6, arcLengthMaxCutbacks: 8, arcLengthMinRadiusFactor: 0.02, arcLengthMaxRadiusFactor: 4, arcLengthConstraintTolerance: 1e-6,\n      stabilityTracking: true, stabilityEigenTolerance: 0.05, stabilityAsymmetryTolerance: 1e-6, stabilityMaxDofs: 120, branchSwitchEnabled: false, branchSwitchSign: 1, branchSwitchAmplitude: 0.08,")
rep('web/src/core/model.js',
"  p.settings.arcLengthConstraintTolerance = Math.max(1e-10, Number(p.settings.arcLengthConstraintTolerance) || 1e-6);",
"  p.settings.arcLengthConstraintTolerance = Math.max(1e-10, Number(p.settings.arcLengthConstraintTolerance) || 1e-6);\n  p.settings.stabilityTracking = p.settings.stabilityTracking !== false;\n  p.settings.stabilityEigenTolerance = Math.max(1e-5, Math.min(1, Math.abs(Number(p.settings.stabilityEigenTolerance) || 0.05)));\n  p.settings.stabilityAsymmetryTolerance = Math.max(1e-12, Math.min(0.1, Math.abs(Number(p.settings.stabilityAsymmetryTolerance) || 1e-6)));\n  p.settings.stabilityMaxDofs = Math.max(6, Math.min(500, Math.round(Number(p.settings.stabilityMaxDofs) || 120)));\n  p.settings.branchSwitchEnabled = !!p.settings.branchSwitchEnabled;\n  p.settings.branchSwitchSign = Number(p.settings.branchSwitchSign) < 0 ? -1 : 1;\n  p.settings.branchSwitchAmplitude = Math.max(1e-4, Math.min(0.45, Math.abs(Number(p.settings.branchSwitchAmplitude) || 0.08)));")
rep('web/src/solver/index.js',
"arcLengthConstraintTolerance:s.arcLengthConstraintTolerance,materialMaxIterations:s.materialMaxIterations",
"arcLengthConstraintTolerance:s.arcLengthConstraintTolerance,stabilityTracking:s.stabilityTracking,stabilityEigenTolerance:s.stabilityEigenTolerance,stabilityAsymmetryTolerance:s.stabilityAsymmetryTolerance,stabilityMaxDofs:s.stabilityMaxDofs,branchSwitchEnabled:s.branchSwitchEnabled,branchSwitchSign:s.branchSwitchSign,branchSwitchAmplitude:s.branchSwitchAmplitude,materialMaxIterations:s.materialMaxIterations")
rep('web/src/solver/materialNonlinear2d.js',
"solverVersion: options.controlMode === 'arc-length' ? '0.17.0-exp' : '0.16.0-exp',",
"solverVersion: options.controlMode === 'arc-length' ? '0.18.0-exp' : '0.16.0-exp',")

# Existing v0.17 arc-length regression now runs on the v0.18 continuation kernel.
pth=Path('tests/arc-length-smoke.mjs'); x=pth.read_text().replace("r.solverVersion==='0.17.0-exp'","r.solverVersion==='0.18.0-exp'").replace("r.solverVersion==='0.17.0-exp'","r.solverVersion==='0.18.0-exp'"); pth.write_text(x)

# -----------------------------------------------------------------------------
# New stability / bifurcation benchmark
# -----------------------------------------------------------------------------
Path('tests/stability-bifurcation-smoke.mjs').write_text(r'''import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { solveBuckling2D } from '../web/src/solver/buckling2d.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const nearRel=(a,b,r,m)=>{if(Math.abs(a-b)>r*Math.max(1,Math.abs(b)))throw new Error(`${m}: esperado ~${b}, obtido ${a}`)};

function eulerColumn(branchSwitchEnabled=false){
  const p=emptyProject(),L=4,n=8,P=10000,E=200e6,I=8e-5,A=.01;
  p.materials=[{id:'S',name:'Steel elastic',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];
  p.sections=[{id:'SEC',name:'Column',family:'rect',b:.1,h:.8,A,I}];
  p.nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:0,y:L*i/n}));p.elements=[];
  for(let i=0;i<n;i++)p.elements.push({id:`E${i+1}`,type:'frame2d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}});
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:false},{nodeId:`N${n}`,ux:true,uy:false,rz:false}];
  p.loads=[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:0,fy:-P,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:`N${n/2}`,arcLengthMonitorDof:'ux',arcLengthInitialLoadIncrement:.06,arcLengthInitialSign:1,arcLengthTargetIterations:5,arcLengthMaxCutbacks:12,arcLengthMinRadiusFactor:.001,arcLengthMaxRadiusFactor:1.5,arcLengthConstraintTolerance:1e-6,nonlinearSteps:30,nonlinearMaxIterations:70,nonlinearTolerance:1e-9,nonlinearLineSearch:true,stabilityTracking:true,stabilityEigenTolerance:.08,stabilityAsymmetryTolerance:1e-7,stabilityMaxDofs:120,branchSwitchEnabled,branchSwitchSign:1,branchSwitchAmplitude:.12};
  return p;
}

{
  const p=eulerColumn(false),linear=solveBuckling2D(p,'LC1',{modes:1}),r=solve(p,'LC1'),events=r.arcLength?.stability?.events||[],bif=events.find(e=>e.type==='bifurcation-candidate');
  assert(r.solverVersion==='0.18.0-exp',`v0.18: versão inesperada ${r.solverVersion}`);
  assert(r.arcLength?.stability?.enabled,'v0.18: diagnóstico espectral ausente');
  assert(bif,'v0.18: bifurcação da coluna de Euler não detectada');
  nearRel(bif.criticalLoadFactor,linear.criticalFactor,.12,'v0.18: fator crítico não acompanha flambagem linear');
  assert(bif.dominant?.dof==='ux',`v0.18: modo crítico deveria ser lateral ux, obtido ${bif.dominant?.dof}`);
  assert(Math.abs(bif.tangentAsymmetry)<1e-7,'v0.18: coluna conservativa apareceu não simétrica');
  console.log('v0.18 — classificação de bifurcação Euler OK','arc=',bif.criticalLoadFactor,'linear=',linear.criticalFactor,'dominante=',bif.dominant);
}

{
  const r=solve(eulerColumn(true),'LC1'),sw=r.arcLength?.stability?.branchSwitch?.switches||[],bif=(r.arcLength?.stability?.events||[]).find(e=>e.type==='bifurcation-candidate'),curve=r.arcLength?.curve||[],maxUx=Math.max(0,...curve.map(x=>Math.abs(Number(x.monitoredDisplacement)||0)));
  assert(bif,'v0.18 branch switch: bifurcação não detectada');
  assert(sw.length>=1,'v0.18 branch switch: perturbação modal não foi aplicada');
  assert(sw[0].predictor?.orientation==='critical-eigenmode-orthogonal-perturbation','v0.18 branch switch: metadado do preditor ausente');
  assert(maxUx>1e-5,`v0.18 branch switch: ramo lateral não foi excitado, maxUx=${maxUx}`);
  console.log('v0.18 — branch switch modal experimental OK','switch=',sw[0],'maxUx [mm]=',maxUx*1000);
}

// The shallow-arch limit point from the v0.17 benchmark should not be mislabeled as a pitchfork bifurcation.
{
  const p=emptyProject(),E=200e6,A=1e-4,I=1e-8;p.materials=[{id:'S',name:'Steel',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'axial',family:'rect',b:.01,h:.01,A,I}];p.nodes=[{id:'L',x:-1,y:0},{id:'C',x:0,y:.1},{id:'R',x:1,y:0}];p.elements=[{id:'E1',type:'frame2d',n1:'L',n2:'C',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}},{id:'E2',type:'frame2d',n1:'C',n2:'R',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}}];p.supports=[{nodeId:'L',ux:true,uy:true,rz:true},{nodeId:'R',ux:true,uy:true,rz:true},{nodeId:'C',ux:true,uy:false,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'C',fx:0,fy:-10,mz:0}];p.settings={...p.settings,analysisType:'corotational',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'C',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.08,arcLengthTargetIterations:5,arcLengthMaxCutbacks:10,arcLengthMinRadiusFactor:.005,arcLengthMaxRadiusFactor:3,nonlinearSteps:32,nonlinearMaxIterations:60,nonlinearTolerance:1e-9,stabilityTracking:true};
  const r=solve(p,'LC1'),events=r.arcLength?.stability?.events||[];
  assert(events.some(e=>e.type==='limit-point'),`v0.18: ponto-limite do arco raso não foi classificado; eventos=${JSON.stringify(events.map(e=>e.type))}`);
  console.log('v0.18 — classificação de ponto-limite OK',events.filter(e=>e.type==='limit-point').map(e=>e.criticalLoadFactor));
}

console.log('Todos os smoke tests de estabilidade/bifurcação do AstraStruct v0.18 passaram.');
''')

# Add new test to suite.
p=Path('package.json'); s=p.read_text();
if 'stability-bifurcation-smoke.mjs' not in s:s=s.replace('node tests/arc-length-smoke.mjs','node tests/arc-length-smoke.mjs && node tests/stability-bifurcation-smoke.mjs');p.write_text(s)

print('v0.18 core patch applied')
