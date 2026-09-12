import { solveFrameCorotational2D } from './corotational2d.js';
import { fiberHingeSectionState, sectionFibersFromModel, sectionFiberFamily } from './fiberSection2d.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Não linearidade material: ${name} deve ser finito.`);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function hingeConfig(raw){
  if(!raw?.enabled)return null;
  return{enabled:true,hingeLength:finite('Lp',raw.hingeLength??raw.Lp??0.35),nFibers:Math.max(8,Math.min(400,Math.round(Number(raw.nFibers)||40))),hardeningRatio:clamp(Number(raw.hardeningRatio??0.01),1e-6,0.25)};
}

export function activeFiberHinges(project){
  const out=[];
  for(const e of project.elements||[]){
    if(e.type!=='frame2d')continue;
    for(const [key,end] of [['rz1',1],['rz2',2]]){const config=hingeConfig(e.fiberHinges?.[key]);if(config)out.push({elementId:e.id,key,end,config})}
  }
  return out;
}

function validateHinges(project,hinges){
  for(const h of hinges){
    const e=(project.elements||[]).find(x=>x.id===h.elementId);if(!e)throw new Error(`Rótula de fibras: elemento ${h.elementId} inexistente.`);
    if(e.releases?.[h.key])throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: não combine rótula plástica com release ideal no mesmo extremo.`);
    const raw=e.rotationalSprings?.[h.key];if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw)))throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: remova a mola rotacional linear do mesmo extremo.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId),sec=(project.sections||[]).find(s=>s.id===e.sectionId);
    if(!mat)throw new Error(`Rótula de fibras ${h.elementId}: material ausente.`);if(!sec)throw new Error(`Rótula de fibras ${h.elementId}: seção ausente.`);
    if(String(mat.type||'').toLowerCase()!=='steel')throw new Error(`Rótula de fibras ${h.elementId}: v0.15 aceita apenas material do tipo steel.`);
    if(!(Number(mat.E)>0&&Number(mat.fy)>0))throw new Error(`Rótula de fibras ${h.elementId}: E e fy devem ser positivos.`);
    const family=sectionFiberFamily(sec);if(!['rect','i','rhs'].includes(family))throw new Error(`Rótula de fibras ${h.elementId}: família de seção "${family}" não suportada. Use retangular, I/H ou RHS.`);
    try{sectionFibersFromModel({section:sec,nFibers:Math.max(8,h.config.nFibers)})}catch(error){throw new Error(`Rótula de fibras ${h.elementId}: ${error?.message||String(error)}`)}
    if(!(h.config.hingeLength>0))throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: Lp deve ser positivo.`);
  }
}

function dataFor(project,h){
  const e=project.elements.find(x=>x.id===h.elementId),material=project.materials.find(m=>m.id===e.materialId),section=project.sections.find(s=>s.id===e.sectionId);
  return{...h,e,material,section};
}

function constitutiveState(project,h,rotation,targetAxialForce){
  const d=dataFor(project,h),cfg=d.config;
  return fiberHingeSectionState({rotation,hingeLength:cfg.hingeLength,targetAxialForce,section:d.section,material:d.material,nFibers:cfg.nFibers,hardeningRatio:cfg.hardeningRatio});
}

function hingeMap(hinges){
  const map=new Map();for(const h of hinges){if(!map.has(h.elementId))map.set(h.elementId,[]);map.get(h.elementId).push(h)}return map;
}

function connectionByEnd(connected,end){return(connected.connectionRotations||[]).find(c=>Number(c.end)===Number(end))}

function embeddedConnectionResolver(project,hinges,options={}){
  const byElement=hingeMap(hinges),maxLocal=Math.max(3,Math.min(80,Math.round(Number(options.materialMaxIterations??20)||20))),tolerance=Math.max(1e-10,Number(options.materialTolerance??1e-6)||1e-6),relaxation=clamp(Number(options.materialRelaxation??1),0.2,1),linearizationTolerance=Math.max(1e-8,Math.sqrt(tolerance));
  return({item,solveConnected})=>{
    const local=byElement.get(item.e.id)||[];if(!local.length)return solveConnected();
    const releases={...(item.e.releases||{})},rotationalSprings={...(item.e.rotationalSprings||{})},rotationalSpringMoments={...(item.e.rotationalSpringMoments||{})};
    for(const h of local){const s0=constitutiveState(project,h,0,0);releases[h.key]=false;rotationalSprings[h.key]=Math.max(1e-9,s0.rotationalTangent);rotationalSpringMoments[h.key]=0}
    let connected=null,records=[];
    for(let iteration=1;iteration<=maxLocal;iteration++){
      connected=solveConnected({releases,rotationalSprings,rotationalSpringMoments});const targetAxialForce=Number(connected.state?.basicForces?.[0])||0;records=[];let maxRelativeResidual=0,maxLinearizationChange=0;
      for(const h of local){
        const c=connectionByEnd(connected,h.end);if(!c)throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: rotação interna não foi recuperada no Newton local.`);
        const rotation=Number(c.relativeRotation)||0,state=constitutiveState(project,h,rotation,targetAxialForce),constitutiveMoment=Number(state.moment)||0,elementMoment=Number(c.moment)||0,momentResidual=elementMoment-constitutiveMoment,scale=Math.max(1,Math.abs(elementMoment),Math.abs(constitutiveMoment)),relativeResidual=Math.abs(momentResidual)/scale,targetStiffness=Math.max(1e-9,Number(state.rotationalTangent)||1e-9),targetOffsetMoment=constitutiveMoment-targetStiffness*rotation,currentStiffness=Math.max(1e-9,Number(rotationalSprings[h.key])||1e-9),currentOffset=Number(rotationalSpringMoments[h.key])||0,kChange=Math.abs(targetStiffness-currentStiffness)/Math.max(1,Math.abs(targetStiffness),Math.abs(currentStiffness)),m0Change=Math.abs(targetOffsetMoment-currentOffset)/Math.max(1,Math.abs(targetOffsetMoment),Math.abs(currentOffset),Math.abs(constitutiveMoment)),linearizationChange=Math.max(kChange,m0Change),secantStiffness=Math.abs(rotation)>1e-10?constitutiveMoment/rotation:targetStiffness;
        maxRelativeResidual=Math.max(maxRelativeResidual,relativeResidual);maxLinearizationChange=Math.max(maxLinearizationChange,linearizationChange);
        records.push({elementId:h.elementId,end:h.end,key:h.key,rotation,elementMoment,constitutiveMoment,momentResidual,relativeResidual,secantStiffness,tangent:targetStiffness,appliedStiffness:Number(c.k),appliedOffsetMoment:Number(c.offsetMoment)||0,targetStiffness,targetOffsetMoment,linearizationChange,hingeLength:h.config.hingeLength,targetAxialForce,axialResidual:state.axialResidual,epsilon0:state.epsilon0,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount,sectionFamily:state.sectionFamily,hardeningRatio:h.config.hardeningRatio,localIterations:iteration});
      }
      if(iteration>1&&maxRelativeResidual<=tolerance&&maxLinearizationChange<=linearizationTolerance){
        const byEnd=new Map(records.map(r=>[r.end,r]));
        const connectionRotations=(connected.connectionRotations||[]).map(c=>{const r=byEnd.get(Number(c.end));return r?{...c,type:'fiber-hinge',k:r.appliedStiffness,offsetMoment:r.appliedOffsetMoment,secantStiffness:r.secantStiffness,constitutiveMoment:r.constitutiveMoment,constitutiveTangent:r.tangent,hingeLength:r.hingeLength,targetAxialForce:r.targetAxialForce,axialResidual:r.axialResidual,epsilon0:r.epsilon0,yieldedFibers:r.yieldedFibers,fiberCount:r.fiberCount,sectionFamily:r.sectionFamily,hardeningRatio:r.hardeningRatio,materialModel:'bilinear-steel-monotonic',materialLinearization:'embedded-tangent-affine',materialCoupling:'embedded-local-newton',localIterations:iteration,materialResidual:r.momentResidual}:c});
        return{...connected,connectionRotations,materialLocalIterations:iteration,materialResidual:Math.max(0,...records.map(r=>Math.abs(r.momentResidual))),materialRecords:records,materialConnectionMeta:{coupling:'embedded-local-newton',tolerance,linearizationTolerance,relaxation}};
      }
      for(const r of records){rotationalSprings[r.key]=(1-relaxation)*Number(rotationalSprings[r.key])+relaxation*r.targetStiffness;rotationalSpringMoments[r.key]=(1-relaxation)*(Number(rotationalSpringMoments[r.key])||0)+relaxation*r.targetOffsetMoment}
    }
    const worst=Math.max(0,...records.map(r=>r.relativeResidual));throw new Error(`Rótulas de fibras v0.15: Newton constitutivo local não convergiu no elemento ${item.e.id} em ${maxLocal} iterações (resíduo relativo máximo=${worst.toExponential(3)}).`);
  };
}

function decorateEmbeddedResult(result,hinges,options={}){
  const records=(result.elementForces||[]).flatMap(force=>(force.connectionRotations||[]).filter(c=>c.type==='fiber-hinge').map(c=>({elementId:force.elementId,end:c.end,key:Number(c.end)===1?'rz1':'rz2',rotation:c.relativeRotation,elementMoment:c.moment,constitutiveMoment:c.constitutiveMoment,momentResidual:c.materialResidual,relativeResidual:Math.abs(Number(c.materialResidual)||0)/Math.max(1,Math.abs(Number(c.moment)||0),Math.abs(Number(c.constitutiveMoment)||0)),secantStiffness:c.secantStiffness,tangent:c.constitutiveTangent,appliedStiffness:c.k,appliedOffsetMoment:c.offsetMoment,hingeLength:c.hingeLength,targetAxialForce:c.targetAxialForce,axialResidual:c.axialResidual,epsilon0:c.epsilon0,yieldedFibers:c.yieldedFibers,fiberCount:c.fiberCount,sectionFamily:c.sectionFamily,hardeningRatio:c.hardeningRatio,localIterations:c.localIterations})));
  const maxMomentResidual=Math.max(0,...records.map(r=>Math.abs(Number(r.momentResidual)||0))),maxLocalIterations=Math.max(0,...records.map(r=>Number(r.localIterations)||0)),tolerance=Math.max(1e-10,Number(options.materialTolerance??1e-6)||1e-6);
  const materialNonlinearity={enabled:true,model:'concentrated-steel-fiber-hinges',constitutiveLaw:'monotonic bilinear steel fibers with local N-M equilibrium',supportedSectionFamilies:['rect','i','rhs'],hingeCount:hinges.length,coupling:'embedded-local-newton',outerIterations:0,maxLocalIterations,tolerance,maxMomentResidual,globalStrategy:'single global co-rotational Newton with constitutive hinge Newton embedded in every residual/tangent evaluation',linearization:'tangent-affine embedded',historyDependent:false,cyclic:false,records};
  return{...result,type:'frame2d-corotational-fiber-hinge-experimental',solverVersion:'0.15.0-exp',elementForces:result.elementForces,materialNonlinearity,nonlinear:{...(result.nonlinear||{}),materialNonlinearity:{enabled:true,model:materialNonlinearity.model,hingeCount:hinges.length,coupling:materialNonlinearity.coupling,outerIterations:0,maxLocalIterations,maxMomentResidual,linearization:materialNonlinearity.linearization}}};
}

function initializeWorkingProject(project,hinges){
  const p=clone(project);for(const h of hinges){const e=p.elements.find(x=>x.id===h.elementId),state=constitutiveState(project,h,0,0),k=Math.max(1e-9,state.rotationalTangent);e.releases={...(e.releases||{}),[h.key]:false};e.rotationalSprings={...(e.rotationalSprings||{}),[h.key]:k};e.rotationalSpringMoments={...(e.rotationalSpringMoments||{}),[h.key]:0}return p}
  return p;
}

function findConnection(result,h){
  const force=(result.elementForces||[]).find(f=>f.elementId===h.elementId),connection=(force?.connectionRotations||[]).find(c=>Number(c.end)===h.end);if(!force||!connection)throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: estado de ligação não foi recuperado pelo solver co-rotacional.`);return{force,connection};
}

function decorateOuterResult(result,records,outerIterations,tolerance){
  const byKey=new Map(records.map(r=>[`${r.elementId}:${r.end}`,r]));
  const elementForces=(result.elementForces||[]).map(force=>({...force,connectionRotations:(force.connectionRotations||[]).map(c=>{const r=byKey.get(`${force.elementId}:${c.end}`);if(!r)return c;return{...c,type:'fiber-hinge',k:r.appliedStiffness,offsetMoment:r.appliedOffsetMoment,secantStiffness:r.secantStiffness,constitutiveMoment:r.constitutiveMoment,constitutiveTangent:r.tangent,hingeLength:r.hingeLength,targetAxialForce:r.targetAxialForce,axialResidual:r.axialResidual,epsilon0:r.epsilon0,yieldedFibers:r.yieldedFibers,fiberCount:r.fiberCount,sectionFamily:r.sectionFamily,hardeningRatio:r.hardeningRatio,materialModel:'bilinear-steel-monotonic',materialLinearization:'outer-tangent-affine',materialCoupling:'outer-compatibility',nextLinearization:{k:r.nextStiffness,offsetMoment:r.nextOffsetMoment}}})}));
  const maxMomentResidual=Math.max(0,...records.map(r=>Math.abs(r.momentResidual))),materialNonlinearity={enabled:true,model:'concentrated-steel-fiber-hinges',constitutiveLaw:'monotonic bilinear steel fibers with local N-M equilibrium',supportedSectionFamilies:['rect','i','rhs'],hingeCount:records.length,coupling:'outer-compatibility',outerIterations,tolerance,maxMomentResidual,globalStrategy:'compatibility mode: outer constitutive iteration around the global corotational Newton solve',linearization:'outer tangent-affine',historyDependent:false,cyclic:false,records};
  return{...result,type:'frame2d-corotational-fiber-hinge-experimental',solverVersion:'0.15.0-exp',elementForces,materialNonlinearity,nonlinear:{...(result.nonlinear||{}),materialNonlinearity:{enabled:true,model:materialNonlinearity.model,hingeCount:records.length,coupling:materialNonlinearity.coupling,outerIterations,maxMomentResidual,linearization:materialNonlinearity.linearization}}};
}

function solveOuterCompatibility(project,scenarioId,hinges,options={}){
  const maxOuter=Math.max(3,Math.min(60,Math.round(Number(options.materialMaxIterations??30)||30))),tolerance=Math.max(1e-9,Number(options.materialTolerance??1e-5)||1e-5),relaxation=clamp(Number(options.materialRelaxation??0.65),0.1,1),working=initializeWorkingProject(project,hinges);let result=null,records=[],previousRotations=new Map();
  for(let outer=1;outer<=maxOuter;outer++){
    result=solveFrameCorotational2D(working,scenarioId,{...options,connectionResolver:null});records=[];let maxRelativeResidual=0,maxRotationChange=0;
    for(const h of hinges){
      const {force,connection}=findConnection(result,h),rotation=Number(connection.relativeRotation)||0,targetAxialForce=Number(force.basicForces?.N)||0,state=constitutiveState(project,h,rotation,targetAxialForce),constitutiveMoment=state.moment,elementMoment=Number(connection.moment)||0,momentResidual=elementMoment-constitutiveMoment,scale=Math.max(1,Math.abs(elementMoment),Math.abs(constitutiveMoment)),relativeResidual=Math.abs(momentResidual)/scale;
      let secantStiffness=Math.abs(rotation)>1e-10?constitutiveMoment/rotation:state.rotationalTangent;if(!(Number.isFinite(secantStiffness)&&secantStiffness>0))secantStiffness=Math.max(1e-9,state.rotationalTangent);
      const tangentStiffness=Math.max(1e-9,Number(state.rotationalTangent)||1e-9),targetOffsetMoment=constitutiveMoment-tangentStiffness*rotation,e=working.elements.find(x=>x.id===h.elementId),appliedStiffness=Number(connection.k),appliedOffsetMoment=Number(connection.offsetMoment)||0,oldK=Number(e.rotationalSprings?.[h.key]),oldOffset=Number(e.rotationalSpringMoments?.[h.key])||0,nextK=Number.isFinite(oldK)&&oldK>0?(1-relaxation)*oldK+relaxation*tangentStiffness:tangentStiffness,nextOffset=(1-relaxation)*oldOffset+relaxation*targetOffsetMoment;
      e.rotationalSprings={...(e.rotationalSprings||{}),[h.key]:Math.max(1e-9,nextK)};e.rotationalSpringMoments={...(e.rotationalSpringMoments||{}),[h.key]:nextOffset};
      const key=`${h.elementId}:${h.end}`,previous=previousRotations.get(key),rotationChange=previous==null?Infinity:Math.abs(rotation-previous);previousRotations.set(key,rotation);maxRotationChange=Math.max(maxRotationChange,Number.isFinite(rotationChange)?rotationChange:0);maxRelativeResidual=Math.max(maxRelativeResidual,relativeResidual);
      records.push({elementId:h.elementId,end:h.end,key:h.key,rotation,elementMoment,constitutiveMoment,momentResidual,relativeResidual,secantStiffness,tangent:state.rotationalTangent,appliedStiffness,appliedOffsetMoment,nextStiffness:Math.max(1e-9,nextK),nextOffsetMoment:nextOffset,targetOffsetMoment,hingeLength:h.config.hingeLength,targetAxialForce,axialResidual:state.axialResidual,epsilon0:state.epsilon0,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount,sectionFamily:state.sectionFamily,hardeningRatio:h.config.hardeningRatio});
    }
    if(outer>1&&maxRelativeResidual<=tolerance&&maxRotationChange<=Math.max(1e-10,tolerance))return decorateOuterResult(result,records,outer,tolerance);
  }
  const worst=Math.max(0,...records.map(r=>r.relativeResidual));throw new Error(`Rótulas de fibras v0.15 modo compatibilidade não convergiram em ${maxOuter} iterações externas (resíduo relativo máximo=${worst.toExponential(3)}).`);
}

/**
 * v0.15 material-geometric coupling.
 *
 * The default path embeds the local constitutive Newton loop for every fiber hinge
 * inside each global co-rotational residual/tangent evaluation. End rotations remain
 * internal coordinates condensed by Schur. The constitutive law is linearized as
 * M ≈ kt Δθ + M0, with kt=dM/dθ at constant axial force and M0=M-ktΔθ.
 *
 * This removes the v0.14 global outer material loop. Axial force N is refreshed at
 * every global trial state, while the N-M cross derivative with respect to axial
 * translation is still frozen inside a given global tangent evaluation. Therefore
 * v0.15 is an embedded return-mapping/Newton formulation, not yet a fully monolithic
 * augmented system with explicit section variables as global DOFs.
 */
export function solveFrameCorotationalFiberHinges2D(project,scenarioId,options={}){
  const hinges=activeFiberHinges(project);if(!hinges.length)return solveFrameCorotational2D(project,scenarioId,options);validateHinges(project,hinges);
  if(options.materialCoupling==='outer')return solveOuterCompatibility(project,scenarioId,hinges,options);
  const connectionResolver=embeddedConnectionResolver(project,hinges,options),result=solveFrameCorotational2D(project,scenarioId,{...options,connectionResolver});return decorateEmbeddedResult(result,hinges,options);
}

export const MATERIAL_NONLINEAR_VERSION='0.15.0-exp';
