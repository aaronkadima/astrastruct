from pathlib import Path


def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# --- corotational arc-length solver -------------------------------------------------
p=Path('web/src/solver/corotational2d.js')
text=p.read_text()
if 'solveFrameCorotationalArcLength2D' not in text:
    text += r'''

function resolveArcLengthMonitor(prepared,raw={}){
  const nodeId=String(raw.nodeId||prepared.nodes.at(-1)?.id||'');
  const dof=String(raw.dof||'uy').toLowerCase(),offsets={ux:0,uy:1,rz:2};
  if(!(dof in offsets))throw new Error(`Arc-length: grau de liberdade monitorado inválido "${dof}".`);
  const nodePosition=prepared.map.get(nodeId);
  if(nodePosition==null)throw new Error(`Arc-length: nó monitor ${nodeId||'(não definido)'} inexistente.`);
  const index=3*nodePosition+offsets[dof];
  if(prepared.prescribed.has(index)||!prepared.free.includes(index))throw new Error(`Arc-length: ${nodeId}/${dof} é restringido ou não possui rigidez ativa; escolha um DOF livre para monitoramento.`);
  return{nodeId,dof,index,freePosition:prepared.free.indexOf(index),unit:dof==='rz'?'rad':'m'};
}

function arcCharacteristicLength(prepared){
  const xs=prepared.nodes.map(n=>Number(n.x)),ys=prepared.nodes.map(n=>Number(n.y));
  const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys),diag=Math.hypot(dx,dy);
  const mean=prepared.elements.length?prepared.elements.reduce((s,e)=>s+Number(e.L0||0),0)/prepared.elements.length:0;
  return Math.max(diag,mean,1e-3);
}
function arcWeights(prepared,Lchar){return prepared.free.map(i=>i%3===2?Lchar*Lchar:1)}
function arcDot(a,b,w){return a.reduce((s,v,i)=>s+w[i]*v*b[i],0)}
function arcNorm(du,dLambda,w,alpha){return Math.sqrt(Math.max(0,arcDot(du,du,w)+alpha*alpha*dLambda*dLambda))}
function arcConstraint(du,dLambda,w,alpha,radius){return arcDot(du,du,w)+alpha*alpha*dLambda*dLambda-radius*radius}
function arcMerit(prepared,current,g,lambda,radius){
  const forceScale=residualScale(prepared,current,lambda),constraintScale=Math.max(radius*radius,1e-18);
  return Math.hypot(current.norm/forceScale,Math.abs(g)/constraintScale);
}
function freeVector(prepared,full){return prepared.free.map(i=>full[i])}
function addFreeIncrement(prepared,base,du,scale=1){const out=[...base];prepared.free.forEach((d,k)=>{out[d]+=scale*du[k]});return out}

function arcPredictor(prepared,uBase,lambdaBase,current,radius,weights,alpha,previous,initialSign,options={}){
  const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),dRdl=residualLoadDerivative(prepared,uBase,lambdaBase,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length;
  if(!previous){
    const duHat=solveLinear(Kff,pf),denom=arcNorm(duHat,1,weights,alpha);
    if(!(denom>1e-16&&Number.isFinite(denom)))throw new Error('Arc-length: direção tangente inicial degenerada; verifique o padrão de carga.');
    const dLambda=(initialSign<0?-1:1)*radius/denom,du=duHat.map(v=>v*dLambda);
    return{du,dLambda,loadDerivative:dRdl,orientation:'initial-tangent'};
  }
  const prevNorm=arcNorm(previous.du,previous.dLambda,weights,alpha);
  if(!(prevNorm>1e-16))throw new Error('Arc-length: incremento anterior degenerado para seleção do ramo.');
  const augmented=Kff.map((row,i)=>[...row,-pf[i]]),orientationRow=[...previous.du.map((v,i)=>weights[i]*v/prevNorm),alpha*alpha*previous.dLambda/prevNorm];
  augmented.push(orientationRow);
  const raw=solveLinear(augmented,[...Array(nf).fill(0),radius]),du0=raw.slice(0,nf),dl0=raw[nf],n0=arcNorm(du0,dl0,weights,alpha);
  if(!(n0>1e-16&&Number.isFinite(n0)))throw new Error('Arc-length: preditor de continuação degenerado.');
  const scale=radius/n0;
  return{du:du0.map(v=>v*scale),dLambda:dl0*scale,loadDerivative:dRdl,orientation:'previous-tangent'};
}

function pathTurningEvents(history){
  const events=[];
  for(let i=2;i<history.length;i++){
    const a=history[i-2],b=history[i-1],c=history[i],dl1=b.loadFactor-a.loadFactor,dl2=c.loadFactor-b.loadFactor,du1=b.monitoredDisplacement-a.monitoredDisplacement,du2=c.monitoredDisplacement-b.monitoredDisplacement;
    if(dl1*dl2<0)events.push({type:'load-factor-turning',step:b.step,loadFactor:b.loadFactor,monitoredDisplacement:b.monitoredDisplacement});
    if(du1*du2<0)events.push({type:'displacement-turning',step:b.step,loadFactor:b.loadFactor,monitoredDisplacement:b.monitoredDisplacement});
  }
  return events;
}

/**
 * v0.17 spherical arc-length / Riks continuation.
 * The equilibrium residual follows the existing convention R=Pext-fint and the
 * correction solves the bordered system [K -dR/dlambda; dg/du dg/dlambda].
 * Rotations enter the spherical metric through a characteristic model length so
 * translational and rotational increments share length units.
 */
export function solveFrameCorotationalArcLength2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project;
  validateModel(p,{initialImperfection:options.initialImperfection});
  const prepared=prepare(p,options.initialImperfection);prepared.supports=p.supports||[];
  const monitor=resolveArcLengthMonitor(prepared,options.arcLengthMonitor||options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??40)||40),1,500),maxIterations=clamp(Math.round(Number(options.maxIterations??45)||45),3,140),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),constraintTolerance=Math.max(1e-10,Number(options.arcLengthConstraintTolerance??1e-6)||1e-6),lineSearch=options.lineSearch!==false;
  const initialLoadIncrement=Math.max(1e-5,Math.abs(Number(options.arcLengthInitialLoadIncrement??0.05)||0.05)),initialSign=Number(options.arcLengthInitialSign)<0?-1:1,targetIterations=clamp(Math.round(Number(options.arcLengthTargetIterations??6)||6),2,20),maxCutbacks=clamp(Math.round(Number(options.arcLengthMaxCutbacks??8)||8),0,16),minRadiusFactor=clamp(Number(options.arcLengthMinRadiusFactor??0.02)||0.02,1e-4,1),maxRadiusFactor=Math.max(1,Number(options.arcLengthMaxRadiusFactor??4)||4);
  const Lchar=arcCharacteristicLength(prepared),weights=arcWeights(prepared,Lchar),u=Array(prepared.nd).fill(0),initial=residualAt(prepared,u,0,options),K0=prepared.free.map(i=>prepared.free.map(j=>initial.K[i][j])),p0full=residualLoadDerivative(prepared,u,0,options),p0=prepared.free.map(i=>p0full[i]);
  let duHat0;try{duHat0=solveLinear(K0,p0)}catch(e){throw new Error(`Arc-length: não foi possível obter a direção tangente inicial. ${e.message||e}`)}
  const metric0=Math.sqrt(Math.max(0,arcDot(duHat0,duHat0,weights))),alphaRaw=Number(options.arcLengthLoadScale),alpha=alphaRaw>0&&Number.isFinite(alphaRaw)?alphaRaw:Math.max(metric0,Lchar*1e-6),initialRadius=initialLoadIncrement*arcNorm(duHat0,1,weights,alpha),minRadius=initialRadius*minRadiusFactor,maxRadius=initialRadius*maxRadiusFactor;
  if(!(initialRadius>1e-14&&Number.isFinite(initialRadius)))throw new Error('Arc-length: raio inicial inválido; o padrão de carga pode ser nulo ou incompatível com a estrutura.');
  let lambda=0,radius=initialRadius,last=initial,previous=null,firstYield=null;const history=[],yieldedKeys=new Set();
  for(let step=1;step<=steps;step++){
    const uBase=[...u],lambdaBase=lambda;let accepted=false,lastError=null,iteration=0,cutbacksUsed=0,usedRadius=radius;
    for(let attempt=0;attempt<=maxCutbacks;attempt++){
      cutbacksUsed=attempt;usedRadius=radius;uBase.forEach((v,i)=>{u[i]=v});lambda=lambdaBase;
      try{
        const baseState=residualAt(prepared,uBase,lambdaBase,options),predictor=arcPredictor(prepared,uBase,lambdaBase,baseState,radius,weights,alpha,previous,initialSign,options);
        const predicted=addFreeIncrement(prepared,uBase,predictor.du);predicted.forEach((v,i)=>{u[i]=v});lambda=lambdaBase+predictor.dLambda;last=residualAt(prepared,u,lambda,options);
        let converged=false;
        for(iteration=1;iteration<=maxIterations;iteration++){
          const duStep=prepared.free.map((d,k)=>u[d]-uBase[d]),dLambdaStep=lambda-lambdaBase,g=arcConstraint(duStep,dLambdaStep,weights,alpha,radius),scale=residualScale(prepared,last,lambda),gTol=Math.max(constraintTolerance*radius*radius,1e-14);
          if(last.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(g)<=gTol){converged=true;break}
          const Kff=prepared.free.map(i=>prepared.free.map(j=>last.K[i][j])),rf=prepared.free.map(i=>last.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length,augmented=Kff.map((row,i)=>[...row,-pf[i]]),constraintRow=[...duStep.map((v,i)=>2*weights[i]*v),2*alpha*alpha*dLambdaStep];augmented.push(constraintRow);
          let correction;try{correction=solveLinear(augmented,[...rf,-g])}catch(e){throw new Error(`sistema bordado singular no corretor do passo ${step}, iteração ${iteration}: ${e.message||e}`)}
          const duCorr=correction.slice(0,nf),dlCorr=correction[nf];if(!(Number.isFinite(dlCorr)&&duCorr.every(Number.isFinite)))throw new Error(`correção inválida no passo ${step}, iteração ${iteration}`);
          const currentMerit=arcMerit(prepared,last,g,lambda,radius);let eta=1,next=null;
          if(lineSearch){for(let ls=0;ls<8;ls++){const trial=addFreeIncrement(prepared,u,duCorr,eta),trialLambda=lambda+eta*dlCorr,candidate=residualAt(prepared,trial,trialLambda,options),duTrial=prepared.free.map(d=>trial[d]-uBase[d]),gTrial=arcConstraint(duTrial,trialLambda-lambdaBase,weights,alpha,radius),merit=arcMerit(prepared,candidate,gTrial,trialLambda,radius);if(merit<currentMerit||eta<=1/128){next={trial,trialLambda,candidate};break}eta*=.5}}
          if(!next){const trial=addFreeIncrement(prepared,u,duCorr),trialLambda=lambda+dlCorr;next={trial,trialLambda,candidate:residualAt(prepared,trial,trialLambda,options)}}
          next.trial.forEach((v,i)=>{u[i]=v});lambda=next.trialLambda;last=next.candidate;
          if(!Number.isFinite(lambda)||Math.abs(lambda)>1e8||u.some(v=>!Number.isFinite(v)||Math.abs(v)>1e5))throw new Error(`resposta não física no passo ${step}`);
        }
        if(!converged){const duStep=prepared.free.map(d=>u[d]-uBase[d]),g=arcConstraint(duStep,lambda-lambdaBase,weights,alpha,radius),scale=residualScale(prepared,last,lambda),gTol=Math.max(constraintTolerance*radius*radius,1e-14);if(last.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(g)<=gTol)converged=true}
        if(!converged)throw new Error(`não convergiu em ${maxIterations} iterações (lambda=${lambda}, |R|=${last.norm})`);
        accepted=true;break;
      }catch(e){lastError=e;uBase.forEach((v,i)=>{u[i]=v});lambda=lambdaBase;if(attempt>=maxCutbacks||radius*.5<minRadius)break;radius*=.5}
    }
    if(!accepted)throw new Error(`Arc-length não convergiu no passo ${step}/${steps} após ${cutbacksUsed} cutback(s). ${lastError?.message||lastError||''}`);
    const stepDu=prepared.free.map(d=>u[d]-uBase[d]),stepDl=lambda-lambdaBase,stepNorm=arcNorm(stepDu,stepDl,weights,alpha),materialLocalIterations=Math.max(0,...(last.states||[]).map(x=>Number(x.connected?.materialLocalIterations)||0)),hinges=fiberYieldSnapshot(last.states),yielded=hinges.filter(h=>h.yieldedFibers>0),newlyYielded=[];
    for(const h of yielded){const key=`${h.elementId}:${h.end}`;if(!yieldedKeys.has(key)){yieldedKeys.add(key);newlyYielded.push(h)}}
    if(!firstYield&&newlyYielded.length)firstYield={step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],hinges:newlyYielded};
    const adapt=clamp(Math.sqrt(targetIterations/Math.max(1,iteration)),.65,1.35),radiusNext=clamp(radius*adapt,minRadius,maxRadius);
    history.push({step,loadFactor:lambda,monitoredDisplacement:u[monitor.index],baseReaction:baseReactionAt(prepared,last,monitor.dof),iterations:iteration,residualNorm:last.norm,arcConstraint:arcConstraint(stepDu,stepDl,weights,alpha,usedRadius),arcRadius:usedRadius,arcNorm:stepNorm,loadIncrement:stepDl,cutbacks:cutbacksUsed,materialLocalIterations,yieldedHingeCount:yielded.length,yieldedHinges:yielded,newlyYieldedHinges:newlyYielded});
    previous={du:stepDu,dLambda:stepDl};radius=radiusNext;
  }
  last=residualAt(prepared,u,lambda,options);
  const reactions=prepared.nodes.map((n,i)=>({nodeId:n.id,fx:last.fint[3*i]-last.external[3*i],fy:last.fint[3*i+1]-last.external[3*i+1],mz:last.fint[3*i+2]-last.external[3*i+2]})),displacements=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:u[3*i],uy:u[3*i+1],rz:u[3*i+2]}));
  const initialDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]})):null,totalDisplacements=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,ux:prepared.imperfection.vector[3*i]+u[3*i],uy:prepared.imperfection.vector[3*i+1]+u[3*i+1],rz:prepared.imperfection.vector[3*i+2]+u[3*i+2]})):null,initialGeometry=prepared.imperfection?prepared.nominalNodes.map((n,i)=>({nodeId:n.id,nominal:{x:Number(n.x),y:Number(n.y)},reference:{x:Number(prepared.nodes[i].x),y:Number(prepared.nodes[i].y)},offset:{ux:prepared.imperfection.vector[3*i],uy:prepared.imperfection.vector[3*i+1],rz:prepared.imperfection.vector[3*i+2]}})):null;
  const elementForces=last.states.map(({item,state,connected,followerStates})=>{const endGlobal=state.internal.map((v,k)=>v-lambda*item.pGlobal[k]),endLocal=globalVectorToLocal(endGlobal,state.c,state.s),followerEnds=followerStates.map(({load,current})=>({id:load.id,end:2,px:load.px,py:load.py,currentGlobal:{fx:current.fx,fy:current.fy},appliedGlobal:{fx:lambda*current.fx,fy:lambda*current.fy},loadFactor:lambda,alpha:state.alpha,tangentMaxAbs:current.tangentMaxAbs,consistentExternalTangent:true}));return{elementId:item.e.id,type:'frame2d',N1:endLocal[0],V1:endLocal[1],M1:endLocal[2],N2:endLocal[3],V2:endLocal[4],M2:endLocal[5],basicForces:{N:state.basicForces[0],M1:state.basicForces[1],M2:state.basicForces[2]},connectionRotations:connected.connectionRotations,connectionCondensation:{internalResidual:connected.internalConnectionResidual,stiffnesses:connected.stiffnesses,materialLocalIterations:Number(connected.materialLocalIterations)||0,materialResidual:Number(connected.materialResidual)||0,materialMeta:connected.materialConnectionMeta||null},corotational:{L0:state.L0,l:state.l,alpha:state.alpha,dAlpha:state.dAlpha,basic:state.basic,initialBasic:state.initialBasic,elasticBasic:state.elasticBasic,referenceImperfection:prepared.imperfection?{enabled:true}:null},loadSummary:{...item.summary,appliedLoadFactor:lambda,thermal:{...item.thermal.summary,appliedFactor:lambda,dTApplied:lambda*Number(item.thermal.summary.dT||0),dTGradientApplied:lambda*Number(item.thermal.summary.dTGradient||0)},followerEnds},equivalentNodalLoad:{referenceLocal:item.pLocal,referenceGlobal:item.pGlobal,appliedGlobal:item.pGlobal.map(v=>lambda*v)}}});
  const followerCount=prepared.elements.reduce((n,e)=>n+e.followers.length,0),flexibleEndCount=prepared.elements.reduce((n,item)=>n+connectionStiffnesses(item.e.releases||{},item.e.rotationalSprings||{}).filter(Number.isFinite).length,0),imperfectionMeta=prepared.imperfection?{enabled:true,source:prepared.imperfection.source||'explicit',mode:prepared.imperfection.mode||null,referenceScenarioId:prepared.imperfection.referenceScenarioId||null,criticalFactor:prepared.imperfection.criticalFactor||null,amplitude:prepared.imperfection.maxTranslation,amplitudeMm:prepared.imperfection.maxTranslation*1000,reference:'stress-free imperfect geometry',rotations:'stored as initial nodal orientation metadata'}:null,curve=history.map(h=>({step:h.step,monitoredDisplacement:h.monitoredDisplacement,loadFactor:h.loadFactor,baseReaction:h.baseReaction,arcRadius:h.arcRadius,iterations:h.iterations,loadIncrement:h.loadIncrement,cutbacks:h.cutbacks,yieldedHingeCount:h.yieldedHingeCount,newlyYieldedHinges:h.newlyYieldedHinges})),turningPoints=pathTurningEvents(history),peak=curve.reduce((best,row)=>!best||Math.abs(row.loadFactor)>Math.abs(best.loadFactor)?row:best,null);
  const arcLength={enabled:true,method:'crisfield-spherical',monitor,finalLoadFactor:lambda,curve,turningPoints,firstYield,initialLoadIncrement,initialRadius,finalRadius:radius,loadScale:alpha,characteristicLength:Lchar,targetIterations,maxCutbacks,minRadiusFactor,maxRadiusFactor,constraintTolerance,adaptive:true,branchSelection:'positive projection on previous generalized tangent',loadFactorDerivative:'centered finite difference of complete residual',peakLoadFactor:peak?.loadFactor??lambda,peakMonitoredDisplacement:peak?.monitoredDisplacement??u[monitor.index]};
  const base={type:'frame2d-corotational-arc-length-experimental',solverVersion:'0.17.0-exp',scenario:resolved.scenario,dofs:prepared.nd,activeDofs:prepared.free.length,displacements,initialDisplacements,totalDisplacements,initialGeometry,reactions,elementForces,imperfection:imperfectionMeta,arcLength,nonlinear:{formulation:'2D co-rotational Euler-Bernoulli',controlMode:'arc-length',steps,maxIterations,tolerance,absoluteTolerance,lineSearch,finalLoadFactor:lambda,loadModel:'scaled reference load pattern + thermal initial strain/curvature + follower end forces',followerLoads:{count:followerCount,externalTangent:'consistent',supported:'element end 2 concentrated force'},endConnections:{flexibleEndCount,method:'internal end rotations + Schur condensation',customResolver:typeof options.connectionResolver==='function',experimental:true},imperfection:imperfectionMeta,arcLength,history,converged:true}};
  return{...base,elementResponses:buildCorotationalResponses(p,base,41)};
}
'''
    p.write_text(text)

# --- dispatcher --------------------------------------------------------------------
replace('web/src/solver/index.js',
"import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D } from './corotational2d.js';",
"import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D, solveFrameCorotationalArcLength2D } from './corotational2d.js';")
replace('web/src/solver/index.js',
"const s=project.settings||{},initialImperfection=buildModalImperfection(project,scenarioId),controlMode=s.nonlinearControlMode==='displacement'?'displacement':'load',options={steps:s.nonlinearSteps,maxIterations:s.nonlinearMaxIterations,tolerance:s.nonlinearTolerance,lineSearch:s.nonlinearLineSearch,initialImperfection,controlMode,displacementTolerance:s.displacementControlTolerance,displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},materialMaxIterations:s.materialMaxIterations,materialTolerance:s.materialTolerance,materialRelaxation:s.materialRelaxation,materialCoupling:s.materialCoupling};",
"const s=project.settings||{},initialImperfection=buildModalImperfection(project,scenarioId),controlMode=s.nonlinearControlMode==='arc-length'?'arc-length':(s.nonlinearControlMode==='displacement'?'displacement':'load'),options={steps:s.nonlinearSteps,maxIterations:s.nonlinearMaxIterations,tolerance:s.nonlinearTolerance,lineSearch:s.nonlinearLineSearch,initialImperfection,controlMode,displacementTolerance:s.displacementControlTolerance,displacementControl:{nodeId:s.displacementControlNodeId,dof:s.displacementControlDof,targetDisplacement:s.displacementControlTarget},arcLengthMonitor:{nodeId:s.arcLengthMonitorNodeId||s.displacementControlNodeId,dof:s.arcLengthMonitorDof||s.displacementControlDof},arcLengthInitialLoadIncrement:s.arcLengthInitialLoadIncrement,arcLengthInitialSign:s.arcLengthInitialSign,arcLengthTargetIterations:s.arcLengthTargetIterations,arcLengthMaxCutbacks:s.arcLengthMaxCutbacks,arcLengthMinRadiusFactor:s.arcLengthMinRadiusFactor,arcLengthMaxRadiusFactor:s.arcLengthMaxRadiusFactor,arcLengthConstraintTolerance:s.arcLengthConstraintTolerance,materialMaxIterations:s.materialMaxIterations,materialTolerance:s.materialTolerance,materialRelaxation:s.materialRelaxation,materialCoupling:s.materialCoupling};")
replace('web/src/solver/index.js',
"const result=fiberHinges.length?solveFrameCorotationalFiberHinges2D(project,scenarioId,options):(controlMode==='displacement'?solveFrameCorotationalDisplacementControl2D(project,scenarioId,options):solveFrameCorotational2D(project,scenarioId,options));",
"const result=fiberHinges.length?solveFrameCorotationalFiberHinges2D(project,scenarioId,options):(controlMode==='arc-length'?solveFrameCorotationalArcLength2D(project,scenarioId,options):(controlMode==='displacement'?solveFrameCorotationalDisplacementControl2D(project,scenarioId,options):solveFrameCorotational2D(project,scenarioId,options)));" )

# --- material wrapper ---------------------------------------------------------------
replace('web/src/solver/materialNonlinear2d.js',
"import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D } from './corotational2d.js';",
"import { solveFrameCorotational2D, solveFrameCorotationalDisplacementControl2D, solveFrameCorotationalArcLength2D } from './corotational2d.js';")
replace('web/src/solver/materialNonlinear2d.js',
"  const displacementControl = options.controlMode === 'displacement';\n  const solveGlobal = displacementControl ? solveFrameCorotationalDisplacementControl2D : solveFrameCorotational2D;",
"  const displacementControl = options.controlMode === 'displacement', arcLength = options.controlMode === 'arc-length', pathControl = displacementControl || arcLength;\n  const solveGlobal = arcLength ? solveFrameCorotationalArcLength2D : (displacementControl ? solveFrameCorotationalDisplacementControl2D : solveFrameCorotational2D);")
replace('web/src/solver/materialNonlinear2d.js',
"  if (displacementControl && options.materialCoupling === 'outer') throw new Error('Pushover v0.16 com rótulas de fibras requer acoplamento material embutido; o modo externo v0.14 permanece apenas para controle de carga.');",
"  if (pathControl && options.materialCoupling === 'outer') throw new Error('Controle de caminho v0.17 com rótulas de fibras requer acoplamento material embutido; o modo externo v0.14 permanece apenas para controle de carga.');")
replace('web/src/solver/materialNonlinear2d.js',
"    solverVersion: '0.16.0-exp',",
"    solverVersion: options.controlMode === 'arc-length' ? '0.17.0-exp' : '0.16.0-exp',")
replace('web/src/solver/materialNonlinear2d.js',
"export const MATERIAL_NONLINEAR_VERSION = '0.16.0-exp';",
"export const MATERIAL_NONLINEAR_VERSION = '0.17.0-exp';")

# --- project settings ---------------------------------------------------------------
replace('web/src/core/model.js',
"      nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,",
"      nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,\n      arcLengthMonitorNodeId: null, arcLengthMonitorDof: 'uy', arcLengthInitialLoadIncrement: 0.05, arcLengthInitialSign: 1, arcLengthTargetIterations: 6, arcLengthMaxCutbacks: 8, arcLengthMinRadiusFactor: 0.02, arcLengthMaxRadiusFactor: 4, arcLengthConstraintTolerance: 1e-6,")
replace('web/src/core/model.js',
"  p.settings.nonlinearControlMode = p.settings.nonlinearControlMode === 'displacement' ? 'displacement' : 'load';",
"  p.settings.nonlinearControlMode = p.settings.nonlinearControlMode === 'arc-length' ? 'arc-length' : (p.settings.nonlinearControlMode === 'displacement' ? 'displacement' : 'load');")
replace('web/src/core/model.js',
"  p.settings.displacementControlTolerance = Math.max(1e-10, Number(p.settings.displacementControlTolerance) || 1e-7);",
"  p.settings.displacementControlTolerance = Math.max(1e-10, Number(p.settings.displacementControlTolerance) || 1e-7);\n  p.settings.arcLengthMonitorNodeId = p.settings.arcLengthMonitorNodeId || null;\n  p.settings.arcLengthMonitorDof = ['ux','uy','rz'].includes(p.settings.arcLengthMonitorDof) ? p.settings.arcLengthMonitorDof : 'uy';\n  p.settings.arcLengthInitialLoadIncrement = Math.max(1e-5, Math.abs(Number(p.settings.arcLengthInitialLoadIncrement) || 0.05));\n  p.settings.arcLengthInitialSign = Number(p.settings.arcLengthInitialSign) < 0 ? -1 : 1;\n  p.settings.arcLengthTargetIterations = Math.max(2, Math.min(20, Math.round(Number(p.settings.arcLengthTargetIterations) || 6)));\n  p.settings.arcLengthMaxCutbacks = Math.max(0, Math.min(16, Math.round(Number(p.settings.arcLengthMaxCutbacks) || 8)));\n  p.settings.arcLengthMinRadiusFactor = Math.max(1e-4, Math.min(1, Number(p.settings.arcLengthMinRadiusFactor) || 0.02));\n  p.settings.arcLengthMaxRadiusFactor = Math.max(1, Number(p.settings.arcLengthMaxRadiusFactor) || 4);\n  p.settings.arcLengthConstraintTolerance = Math.max(1e-10, Number(p.settings.arcLengthConstraintTolerance) || 1e-6);")

# Remove duplicated material settings introduced in v0.16 normalization.
text=Path('web/src/core/model.js').read_text()
dup="""      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',\n      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',"""
if dup in text:text=text.replace(dup,"      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',",1)
dup2="""  p.settings.materialMaxIterations = Math.max(3, Math.min(80, Math.round(Number(p.settings.materialMaxIterations) || 30)));\n  p.settings.materialTolerance = Math.max(1e-10, Number(p.settings.materialTolerance) || 1e-6);\n  p.settings.materialRelaxation = Math.max(.2, Math.min(1, Number(p.settings.materialRelaxation) || 1));\n  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';\n  p.settings.materialMaxIterations = Math.max(3, Math.min(80, Math.round(Number(p.settings.materialMaxIterations) || 30)));\n  p.settings.materialTolerance = Math.max(1e-10, Number(p.settings.materialTolerance) || 1e-6);\n  p.settings.materialRelaxation = Math.max(.2, Math.min(1, Number(p.settings.materialRelaxation) || 1));\n  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';"""
if dup2 in text:text=text.replace(dup2,"""  p.settings.materialMaxIterations = Math.max(3, Math.min(80, Math.round(Number(p.settings.materialMaxIterations) || 30)));\n  p.settings.materialTolerance = Math.max(1e-10, Number(p.settings.materialTolerance) || 1e-6);\n  p.settings.materialRelaxation = Math.max(.2, Math.min(1, Number(p.settings.materialRelaxation) || 1));\n  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';""",1)
Path('web/src/core/model.js').write_text(text)

# --- structural regression ----------------------------------------------------------
Path('tests/arc-length-smoke.mjs').write_text(r'''import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const near=(a,b,t,m)=>{if(Math.abs(a-b)>t)throw new Error(`${m}: esperado ${b}, obtido ${a}`)};

function shallowArch(){
  const p=emptyProject(),E=200e6,A=1e-4,I=1e-8;
  p.materials=[{id:'S',name:'Steel',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];
  p.sections=[{id:'SEC',name:'axial',family:'rect',b:.01,h:.01,A,I}];
  p.nodes=[{id:'L',x:-1,y:0},{id:'C',x:0,y:.1},{id:'R',x:1,y:0}];
  p.elements=[
    {id:'E1',type:'frame2d',n1:'L',n2:'C',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}},
    {id:'E2',type:'frame2d',n1:'C',n2:'R',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}}
  ];
  p.supports=[{nodeId:'L',ux:true,uy:true,rz:true},{nodeId:'R',ux:true,uy:true,rz:true},{nodeId:'C',ux:true,uy:false,rz:true}];
  p.loads=[{id:'P',caseId:'LC1',nodeId:'C',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'C',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.08,arcLengthInitialSign:1,arcLengthTargetIterations:5,arcLengthMaxCutbacks:10,arcLengthMinRadiusFactor:.005,arcLengthMaxRadiusFactor:3,arcLengthConstraintTolerance:2e-6,nonlinearSteps:32,nonlinearMaxIterations:60,nonlinearTolerance:1e-9,nonlinearLineSearch:true};
  return p;
}

{
  const p=shallowArch(),r=solve(p,'LC1'),curve=r.arcLength?.curve||[],L0=Math.hypot(1,.1),EA=200e6*1e-4;
  assert(r.solverVersion==='0.17.0-exp',`arc-length: versão inesperada ${r.solverVersion}`);
  assert(r.arcLength?.enabled&&r.arcLength.method==='crisfield-spherical','arc-length: metadados ausentes');
  assert(curve.length===32,'arc-length: número de passos incorreto');
  for(const row of curve){
    const y=.1+row.monitoredDisplacement,l=Math.hypot(1,y),N=EA/L0*(l-L0),expected=-2*N*y/l/10;
    near(row.loadFactor,expected,Math.max(2e-3,Math.abs(expected)*4e-3),`arc-length: equilíbrio analítico no passo ${row.step}`);
  }
  const turning=(r.arcLength.turningPoints||[]).find(x=>x.type==='load-factor-turning');
  assert(turning,'arc-length: ponto-limite de carga não detectado');
  const i=curve.findIndex(x=>x.step===turning.step);assert(i>0&&i<curve.length-1,'arc-length: ponto-limite fora do interior da curva');
  assert(curve[i-1].loadFactor<curve[i].loadFactor&&curve[i+1].loadFactor<curve[i].loadFactor,'arc-length: lambda não atravessou o máximo local');
  assert(curve[i+1].monitoredDisplacement<curve[i].monitoredDisplacement,'arc-length: deslocamento deveria continuar no ramo pós-pico');
  assert(curve.some((x,j)=>j>i&&x.loadIncrement<0),'arc-length: fator de carga não reverteu após o ponto-limite');
  console.log('v0.17 — shallow arch snap-through OK','turning=',turning,'lambdaFinal=',r.arcLength.finalLoadFactor);
}

function fiberCantilever(){
  const p=emptyProject(),b=.2,h=.4,A=b*h,I=b*h**3/12;
  p.materials=[{id:'S355',name:'S355',type:'steel',E:200e6,nu:.3,density:0,alpha:12e-6,fy:355,fu:510}];
  p.sections=[{id:'R',name:'R200x400',family:'rect',b,h,A,I}];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:true,hingeLength:.35,nFibers:80,hardeningRatio:.01},rz2:{enabled:false}}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'L',caseId:'LC1',nodeId:'N2',fx:0,fy:-800,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'N2',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.04,arcLengthTargetIterations:6,arcLengthMaxCutbacks:8,nonlinearSteps:10,nonlinearMaxIterations:50,nonlinearTolerance:1e-8,materialCoupling:'embedded',materialMaxIterations:45,materialTolerance:2e-5,materialRelaxation:.7};
  return p;
}
{
  const r=solve(fiberCantilever(),'LC1');
  assert(r.solverVersion==='0.17.0-exp','arc-length material: versão incorreta');
  assert(r.materialNonlinearity?.coupling==='embedded-local-newton','arc-length material: acoplamento local não preservado');
  assert(r.arcLength?.curve?.length===10,'arc-length material: curva ausente');
  assert(Number.isFinite(r.arcLength.finalLoadFactor),'arc-length material: lambda final inválido');
  console.log('v0.17 — arc-length + rótula de fibras OK','lambda=',r.arcLength.finalLoadFactor);
}

console.log('Todos os smoke tests de arc-length/Riks do AstraStruct v0.17 passaram.');
''')

replace('package.json',
'node tests/material-global-smoke.mjs && node tests/pushover-smoke.mjs',
'node tests/material-global-smoke.mjs && node tests/pushover-smoke.mjs && node tests/arc-length-smoke.mjs')
