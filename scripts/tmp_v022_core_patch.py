from pathlib import Path

# material1d: reversal counter in history
p=Path('web/src/solver/material1d.js'); s=p.read_text()
s=s.replace("return{plasticStrain:0,backstress:0,equivalentPlasticStrain:0,dissipatedEnergyDensity:0,stress:0,strain:0,loadingDirection:0,yielded:false};","return{plasticStrain:0,backstress:0,equivalentPlasticStrain:0,dissipatedEnergyDensity:0,stress:0,strain:0,loadingDirection:0,reversalCount:0,yielded:false};")
s=s.replace("const deltaStrain=eps-c.strain,loadingDirection=Math.abs(deltaStrain)>EPS?(deltaStrain>0?1:-1):Number(c.loadingDirection)||0;","const deltaStrain=eps-c.strain,previousDirection=Number(c.loadingDirection)||0,loadingDirection=Math.abs(deltaStrain)>EPS?(deltaStrain>0?1:-1):previousDirection,reversalCount=(Number(c.reversalCount)||0)+(previousDirection&&loadingDirection&&previousDirection!==loadingDirection?1:0);")
s=s.replace("const history={...c,strain:eps,stress:sigmaTrial,loadingDirection,yielded:","const history={...c,strain:eps,stress:sigmaTrial,loadingDirection,reversalCount,yielded:")
s=s.replace("const history={plasticStrain,backstress,equivalentPlasticStrain,dissipatedEnergyDensity,stress,strain:eps,loadingDirection,yielded:true};","const history={plasticStrain,backstress,equivalentPlasticStrain,dissipatedEnergyDensity,stress,strain:eps,loadingDirection,reversalCount,yielded:true};")
s=s.replace("export const MATERIAL_1D_VERSION='0.21.0-exp';","export const MATERIAL_1D_VERSION='0.22.0-exp';")
p.write_text(s)

# fiberSection2d: import cyclic law + cyclic hinge section
p=Path('web/src/solver/fiberSection2d.js'); s=p.read_text()
s=s.replace("import { bilinearSteelState, bilinearSteelFromModelMaterial } from './material1d.js';","import { bilinearSteelState, bilinearSteelFromModelMaterial, cyclicSteelFromModelMaterial } from './material1d.js';")
insert=r'''

/** v0.22 concentrated cyclic steel fiber hinge with committed/trial material history. */
export function fiberHingeCyclicSectionState({rotation,hingeLength,targetAxialForce=0,section,material,nFibers=40,hardeningRatio=0.01,kinematicFraction=1,committedHistory=null,maxIterations=30,tolerance=1e-9,initialEpsilon0=null}){
  const theta=finite('rotação cíclica da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength),targetN=finite('esforço normal alvo',targetAxialForce);if(!(Lp>0))throw new Error('Rótula cíclica de fibras: comprimento deve ser positivo.');
  if(!material)throw new Error('Rótula cíclica de fibras: material ausente.');const E=finite('E',material.E);if(!(E>0))throw new Error('Rótula cíclica de fibras: E deve ser positivo.');
  const sectionFamily=sectionFiberFamily(section),fibers=sectionFibersFromModel({section,nFibers}),area=fibers.reduce((a,f)=>a+f.area,0),curvature=theta/Lp,committedFibers=committedHistory?.fibers||[];
  let epsilon0=initialEpsilon0==null?targetN/(E*area):finite('epsilon0 inicial',initialEpsilon0),state=null,residual=Infinity,iteration=0;
  const fyScale=Math.abs(Number(material.fy)||0)*1000*area,forceScale=Math.max(1,Math.abs(targetN),fyScale),tol=Math.max(1e-12,Number(tolerance)||1e-9)*forceScale,maxIt=Math.max(3,Math.min(80,Math.round(Number(maxIterations)||30)));
  for(iteration=1;iteration<=maxIt;iteration++){
    state=fiberSectionState({fibers,epsilon0,kappa:curvature,materialLaw:(strain,fiber,index)=>cyclicSteelFromModelMaterial(material,strain,{hardeningRatio,kinematicFraction,committed:committedFibers[index]||null})});residual=state.N-targetN;
    if(Math.abs(residual)<=tol)break;const K11=state.tangent[0][0];if(!(Math.abs(K11)>1e-12))throw new Error('Rótula cíclica de fibras: rigidez axial tangente degenerada.');epsilon0-=residual/K11;if(!Number.isFinite(epsilon0)||Math.abs(epsilon0)>.5)throw new Error('Rótula cíclica de fibras: equilíbrio axial divergiu.');
  }
  if(!state||Math.abs(residual)>tol)throw new Error(`Rótula cíclica de fibras: equilíbrio axial não convergiu em ${maxIt} iterações.`);
  // Re-evaluate once at converged epsilon0 so fiber history corresponds exactly to accepted local state.
  const finalStates=fibers.map((fiber,index)=>{const strain=epsilon0-curvature*fiber.y,law=cyclicSteelFromModelMaterial(material,strain,{hardeningRatio,kinematicFraction,committed:committedFibers[index]||null});return{...fiber,strain,stress:law.stress,tangent:law.tangent,yielded:!!law.yielded,branch:law.branch||null,history:law.history,plasticMultiplier:Number(law.plasticMultiplier)||0,equivalentPlasticStrain:Number(law.equivalentPlasticStrain)||0,backstress:Number(law.backstress)||0,dissipatedEnergyDensity:Number(law.dissipatedEnergyDensity)||0};});
  let N=0,M=0,K11=0,K12=0,K22=0,yieldedFibers=0;for(const f of finalStates){N+=f.stress*f.area;M-=f.stress*f.area*f.y;K11+=f.tangent*f.area;K12-=f.tangent*f.area*f.y;K22+=f.tangent*f.area*f.y*f.y;if(f.yielded)yieldedFibers++;}
  if(!(Math.abs(K11)>1e-12))throw new Error('Rótula cíclica de fibras: K11 tangente degenerado.');const D=K22-K12*K12/K11,rotationalTangent=D/Lp;
  const cumulativeDissipatedEnergy=finalStates.reduce((sum,f)=>sum+f.dissipatedEnergyDensity*f.area*Lp,0),maxEquivalentPlasticStrain=Math.max(0,...finalStates.map(f=>Math.abs(f.equivalentPlasticStrain))),meanEquivalentPlasticStrain=finalStates.reduce((sum,f)=>sum+Math.abs(f.equivalentPlasticStrain)*f.area,0)/Math.max(area,1e-18),maxBackstress=Math.max(0,...finalStates.map(f=>Math.abs(f.backstress))),maxReversalCount=Math.max(0,...finalStates.map(f=>Number(f.history?.reversalCount)||0));
  const historyTrial={version:'0.22.0-exp',rotation:theta,epsilon0,fibers:finalStates.map(f=>f.history),cumulativeDissipatedEnergy,maxEquivalentPlasticStrain,meanEquivalentPlasticStrain,maxBackstress,maxReversalCount};
  return{type:'fiber-hinge-steel-nm-cyclic',rotation:theta,hingeLength:Lp,curvature,targetAxialForce:targetN,epsilon0,moment:M,rotationalTangent,flexuralTangentAtConstantN:D,axialResidual:N-targetN,axialIterations:iteration,sectionFamily,sectionState:{type:'fiber-section-2d-cyclic',epsilon0,kappa:curvature,N,M,tangent:[[K11,K12],[K12,K22]],yieldedFibers,fiberCount:finalStates.length,fibers:finalStates},yieldedFibers,fiberCount:finalStates.length,historyTrial,cumulativeDissipatedEnergy,maxEquivalentPlasticStrain,meanEquivalentPlasticStrain,maxBackstress,maxReversalCount};
}
'''
s=s.replace("\nexport const FIBER_SECTION_VERSION='0.14.2-exp';",insert+"\nexport const FIBER_SECTION_VERSION='0.22.0-exp';")
p.write_text(s)

# corotational generic commit hook
p=Path('web/src/solver/corotational2d.js'); s=p.read_text()
anchor="if(cyclicMaterial){commitDistributedPlasticityHistory(last.states,analysisOptions.distributedPlasticityHistory);last=residualAt(prepared,u,lambda,analysisOptions)}"
repl=anchor+"\n    if(typeof analysisOptions.commitMaterialHistory==='function'){analysisOptions.commitMaterialHistory(last.states,{step,loadFactor:lambda,controlledDisplacement:u[control.index]});last=residualAt(prepared,u,lambda,analysisOptions)}"
if anchor not in s: raise SystemExit('corotational commit anchor missing')
s=s.replace(anchor,repl)
p.write_text(s)

# materialNonlinear cyclic concentrated hinges
p=Path('web/src/solver/materialNonlinear2d.js'); s=p.read_text()
s=s.replace("import { fiberHingeSectionState, sectionFibersFromModel, sectionFiberFamily } from './fiberSection2d.js';","import { fiberHingeSectionState, fiberHingeCyclicSectionState, sectionFibersFromModel, sectionFiberFamily } from './fiberSection2d.js';")
s=s.replace("hardeningRatio: clamp(Number(raw.hardeningRatio ?? 0.01), 1e-6, 0.25)","hardeningRatio: clamp(Number(raw.hardeningRatio ?? 0.01), 1e-6, 0.25),\n    cyclic: !!raw.cyclic,\n    kinematicFraction: clamp(Number.isFinite(Number(raw.kinematicFraction)) ? Number(raw.kinematicFraction) : 1, 0, 1)")
old="function constitutiveState(project, h, rotation, targetAxialForce) {\n  const d = dataFor(project, h);\n  const cfg = d.config;\n  return fiberHingeSectionState({\n    rotation,\n    hingeLength: cfg.hingeLength,\n    targetAxialForce,\n    section: d.section,\n    material: d.material,\n    nFibers: cfg.nFibers,\n    hardeningRatio: cfg.hardeningRatio\n  });\n}"
new="function hingeHistoryKey(h){return `${h.elementId}:${h.key}`}\nfunction constitutiveState(project, h, rotation, targetAxialForce, options={}) {\n  const d = dataFor(project, h),cfg=d.config;\n  if(cfg.cyclic)return fiberHingeCyclicSectionState({rotation,hingeLength:cfg.hingeLength,targetAxialForce,section:d.section,material:d.material,nFibers:cfg.nFibers,hardeningRatio:cfg.hardeningRatio,kinematicFraction:cfg.kinematicFraction,committedHistory:options.hingeHistoryStore?.[hingeHistoryKey(h)]||null});\n  return fiberHingeSectionState({rotation,hingeLength:cfg.hingeLength,targetAxialForce,section:d.section,material:d.material,nFibers:cfg.nFibers,hardeningRatio:cfg.hardeningRatio});\n}"
if old not in s: raise SystemExit('constitutiveState anchor missing')
s=s.replace(old,new)
s=s.replace("const initial = constitutiveState(project, h, 0, 0);","const initial = constitutiveState(project, h, 0, 0, options);")
s=s.replace("const state = constitutiveState(project, h, rotation, targetAxialForce);","const state = constitutiveState(project, h, rotation, targetAxialForce, options);")
# enrich records
s=s.replace("hardeningRatio: h.config.hardeningRatio,\n          localIterations: iteration","hardeningRatio: h.config.hardeningRatio,\n          cyclic: !!h.config.cyclic,\n          kinematicFraction: h.config.kinematicFraction,\n          historyTrial: state.historyTrial || null,\n          cumulativeDissipatedEnergy: Number(state.cumulativeDissipatedEnergy)||0,\n          maxEquivalentPlasticStrain: Number(state.maxEquivalentPlasticStrain)||0,\n          meanEquivalentPlasticStrain: Number(state.meanEquivalentPlasticStrain)||0,\n          maxBackstress: Number(state.maxBackstress)||0,\n          maxReversalCount: Number(state.maxReversalCount)||0,\n          localIterations: iteration")
s=s.replace("materialModel: 'bilinear-steel-monotonic',","materialModel: r.cyclic ? 'bilinear-steel-cyclic-combined-hardening' : 'bilinear-steel-monotonic',")
s=s.replace("hardeningRatio: r.hardeningRatio,\n            materialModel:","hardeningRatio: r.hardeningRatio,\n            cyclic: r.cyclic, kinematicFraction:r.kinematicFraction, historyTrial:r.historyTrial, cumulativeDissipatedEnergy:r.cumulativeDissipatedEnergy, maxEquivalentPlasticStrain:r.maxEquivalentPlasticStrain, meanEquivalentPlasticStrain:r.meanEquivalentPlasticStrain, maxBackstress:r.maxBackstress, maxReversalCount:r.maxReversalCount,\n            materialModel:")
# decorate extraction
s=s.replace("hardeningRatio: c.hardeningRatio,\n        localIterations:","hardeningRatio: c.hardeningRatio, cyclic:!!c.cyclic, kinematicFraction:c.kinematicFraction, cumulativeDissipatedEnergy:Number(c.cumulativeDissipatedEnergy)||0, maxEquivalentPlasticStrain:Number(c.maxEquivalentPlasticStrain)||0, meanEquivalentPlasticStrain:Number(c.meanEquivalentPlasticStrain)||0, maxBackstress:Number(c.maxBackstress)||0, maxReversalCount:Number(c.maxReversalCount)||0,\n        localIterations:")
s=s.replace("constitutiveLaw: 'monotonic bilinear steel fibers with local N-M equilibrium',","constitutiveLaw: hinges.some(h=>h.config.cyclic)?'incremental cyclic bilinear steel fibers with combined hardening and local N-M equilibrium':'monotonic bilinear steel fibers with local N-M equilibrium',")
s=s.replace("historyDependent: false,\n    cyclic: false,","historyDependent: hinges.some(h=>h.config.cyclic),\n    cyclic: hinges.some(h=>h.config.cyclic),\n    cumulativeDissipatedEnergy: records.reduce((a,r)=>a+(Number(r.cumulativeDissipatedEnergy)||0),0),\n    maxEquivalentPlasticStrain: Math.max(0,...records.map(r=>Number(r.maxEquivalentPlasticStrain)||0)),\n    maxReversalCount: Math.max(0,...records.map(r=>Number(r.maxReversalCount)||0)),")
s=s.replace("solverVersion: result?.distributedPlasticity?.enabled ? '0.20.0-exp' : (options.controlMode === 'arc-length' ? '0.19.0-exp' : '0.16.0-exp'),","solverVersion: hinges.some(h=>h.config.cyclic)?'0.22.0-exp':(result?.distributedPlasticity?.enabled ? '0.21.0-exp' : (options.controlMode === 'arc-length' ? '0.19.0-exp' : '0.16.0-exp')), ")
# working project initialization uses options unavailable; leave monotonic initial stiffness equivalent
# solve function: inject cyclic store/options before solver call
needle="const displacementControl = options.controlMode === 'displacement', arcLength = options.controlMode === 'arc-length', pathControl = displacementControl || arcLength;"
repl=needle+"\n  const cyclicHinges=hinges.filter(h=>h.config.cyclic);if(cyclicHinges.length&&(!displacementControl||!options.cyclicProtocol?.enabled))throw new Error('Rótulas cíclicas v0.22 requerem controle de deslocamento com protocolo cíclico ativo.');\n  const hingeHistoryStore={};const commitMaterialHistory=(states)=>{for(const entry of states||[])for(const c of entry.connected?.connectionRotations||[]){if(c.type!=='fiber-hinge'||!c.cyclic||!c.historyTrial)continue;hingeHistoryStore[`${entry.item.e.id}:${Number(c.end)===1?'rz1':'rz2'}`]=c.historyTrial}};\n  const effectiveOptions=cyclicHinges.length?{...options,hingeHistoryStore,commitMaterialHistory}:options;"
if needle not in s: raise SystemExit('solve options anchor missing')
s=s.replace(needle,repl)
s=s.replace("if (!hinges.length) return solveGlobal(project, scenarioId, options);","if (!hinges.length) return solveGlobal(project, scenarioId, options);")
# resolver + solveGlobal use effectiveOptions in embedded branch. Replace specific calls after validation globally carefully.
s=s.replace("const resolver = embeddedConnectionResolver(project, hinges, options);","const resolver = embeddedConnectionResolver(project, hinges, effectiveOptions);")
s=s.replace("const result = solveGlobal(project, scenarioId, { ...options, connectionResolver: resolver });","const result = solveGlobal(project, scenarioId, { ...effectiveOptions, connectionResolver: resolver });")
s=s.replace("return decorateEmbeddedResult(result, hinges, options);","return decorateEmbeddedResult(result, hinges, effectiveOptions);")
p.write_text(s)

# model normalize concentrated hinge cyclic fields
p=Path('web/src/core/model.js'); s=p.read_text()
anchor="const releases = { rz1: false, rz2: false, ...(e.releases || {}) };"
# normalize fiberHinges in return by inserting before return if not already handled
old="return { ...e, releases, rotationalSprings, distributedPlasticity };"
new="const normHinge=(raw={})=>({enabled:!!raw.enabled,hingeLength:Math.max(1e-4,Number(raw.hingeLength)||.35),nFibers:Math.max(8,Math.min(400,Math.round(Number(raw.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(raw.hardeningRatio)||.01))),cyclic:!!raw.cyclic,kinematicFraction:Math.max(0,Math.min(1,Number.isFinite(Number(raw.kinematicFraction))?Number(raw.kinematicFraction):1))});\n    const fiberHinges={rz1:normHinge(e.fiberHinges?.rz1),rz2:normHinge(e.fiberHinges?.rz2)};\n    return { ...e, releases, rotationalSprings, distributedPlasticity, fiberHinges };"
if old not in s: raise SystemExit('model return anchor missing')
s=s.replace(old,new)
p.write_text(s)
