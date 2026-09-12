import { solveFrameCorotational2D } from './corotational2d.js';
import { fiberHingeSectionState } from './fiberSection2d.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Não linearidade material: ${name} deve ser finito.`);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function hingeConfig(raw){
  if(!raw?.enabled)return null;
  return{
    enabled:true,
    hingeLength:finite('Lp',raw.hingeLength??raw.Lp??0.35),
    nFibers:Math.max(8,Math.min(400,Math.round(Number(raw.nFibers)||40))),
    hardeningRatio:clamp(Number(raw.hardeningRatio??0.01),1e-6,0.25)
  };
}

export function activeFiberHinges(project){
  const out=[];
  for(const e of project.elements||[]){
    if(e.type!=='frame2d')continue;
    for(const [key,end] of [['rz1',1],['rz2',2]]){
      const config=hingeConfig(e.fiberHinges?.[key]);
      if(config)out.push({elementId:e.id,key,end,config});
    }
  }
  return out;
}

function validateHinges(project,hinges){
  for(const h of hinges){
    const e=(project.elements||[]).find(x=>x.id===h.elementId);if(!e)throw new Error(`Rótula de fibras: elemento ${h.elementId} inexistente.`);
    if(e.releases?.[h.key])throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: não combine rótula plástica com release ideal no mesmo extremo.`);
    const raw=e.rotationalSprings?.[h.key];if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw)))throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: remova a mola rotacional linear do mesmo extremo.`);
    const mat=(project.materials||[]).find(m=>m.id===e.materialId),sec=(project.sections||[]).find(s=>s.id===e.sectionId);
    if(!mat)throw new Error(`Rótula de fibras ${h.elementId}: material ausente.`);
    if(String(mat.type||'').toLowerCase()!=='steel')throw new Error(`Rótula de fibras ${h.elementId}: v0.14 aceita apenas material do tipo steel.`);
    if(!(Number(mat.E)>0&&Number(mat.fy)>0))throw new Error(`Rótula de fibras ${h.elementId}: E e fy devem ser positivos.`);
    if(!(Number(sec?.b??sec?.width)>0&&Number(sec?.h??sec?.depth)>0))throw new Error(`Rótula de fibras ${h.elementId}: v0.14 requer seção retangular com b e h positivos.`);
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

function initializeWorkingProject(project,hinges){
  const p=clone(project);
  for(const h of hinges){
    const e=p.elements.find(x=>x.id===h.elementId),state=constitutiveState(project,h,0,0),k=Math.max(1e-9,state.rotationalTangent);
    e.releases={...(e.releases||{}),[h.key]:false};e.rotationalSprings={...(e.rotationalSprings||{}),[h.key]:k};e.rotationalSpringMoments={...(e.rotationalSpringMoments||{}),[h.key]:0};
  }
  return p;
}

function findConnection(result,h){
  const force=(result.elementForces||[]).find(f=>f.elementId===h.elementId),connection=(force?.connectionRotations||[]).find(c=>Number(c.end)===h.end);
  if(!force||!connection)throw new Error(`Rótula de fibras ${h.elementId}/${h.key}: estado de ligação não foi recuperado pelo solver co-rotacional.`);
  return{force,connection};
}

function decorateResult(result,records,outerIterations,tolerance,strategy){
  const byKey=new Map(records.map(r=>[`${r.elementId}:${r.end}`,r]));
  const elementForces=(result.elementForces||[]).map(force=>({...force,connectionRotations:(force.connectionRotations||[]).map(c=>{
    const r=byKey.get(`${force.elementId}:${c.end}`);if(!r)return c;
    return{...c,type:'fiber-hinge',k:r.appliedStiffness,offsetMoment:r.appliedOffsetMoment,secantStiffness:r.secantStiffness,constitutiveMoment:r.constitutiveMoment,constitutiveTangent:r.tangent,hingeLength:r.hingeLength,targetAxialForce:r.targetAxialForce,axialResidual:r.axialResidual,epsilon0:r.epsilon0,yieldedFibers:r.yieldedFibers,fiberCount:r.fiberCount,hardeningRatio:r.hardeningRatio,materialModel:'bilinear-steel-monotonic',materialLinearization:strategy};
  })}));
  const maxResidual=Math.max(0,...records.map(r=>Math.abs(r.momentResidual)));
  const globalStrategy=strategy==='secant'?'secant outer iteration around validated corotational equilibrium':'affine constitutive tangent linearization condensed through end-rotation Schur complement';
  return{...result,type:'frame2d-corotational-fiber-hinge-experimental',solverVersion:'0.14.1-exp',elementForces,materialNonlinearity:{enabled:true,model:'concentrated-steel-fiber-hinges',constitutiveLaw:'monotonic bilinear steel fibers with local N-M equilibrium',hingeCount:records.length,outerIterations,tolerance,maxMomentResidual:maxResidual,globalStrategy,linearization:strategy,historyDependent:false,cyclic:false,records},nonlinear:{...(result.nonlinear||{}),materialNonlinearity:{enabled:true,model:'concentrated-steel-fiber-hinges',hingeCount:records.length,outerIterations,maxMomentResidual:maxResidual,linearization:strategy}}};
}

/**
 * v0.14 material-nonlinear wrapper.
 *
 * Each enabled fiber hinge is represented in the validated co-rotational kernel
 * by an affine rotational law M = kt*theta + M0. After every global solution the
 * recovered relative rotation and axial force are sent to the fiber section,
 * which solves local N-M equilibrium. The next constitutive linearization uses
 * kt=dM/dtheta and M0=M-kt*theta, so the material tangent participates directly
 * in the existing Schur condensation of the end rotation.
 *
 * A legacy `materialStrategy: 'secant'` mode keeps the v0.14 k=M/theta update
 * for regression/fallback. The default tangent mode is still an outer material
 * iteration, not yet a fully monolithic Newton solve with axial-material coupling.
 * It remains monotonic concentrated plasticity and does not claim cyclic history,
 * distributed plasticity, concrete damage or bond-slip.
 */
export function solveFrameCorotationalFiberHinges2D(project,scenarioId,options={}){
  const hinges=activeFiberHinges(project);if(!hinges.length)return solveFrameCorotational2D(project,scenarioId,options);
  validateHinges(project,hinges);
  const maxOuter=Math.max(3,Math.min(60,Math.round(Number(options.materialMaxIterations??30)||30))),tolerance=Math.max(1e-9,Number(options.materialTolerance??1e-5)||1e-5),relaxation=clamp(Number(options.materialRelaxation??0.65),0.1,1),strategy=options.materialStrategy==='secant'?'secant':'tangent';
  const working=initializeWorkingProject(project,hinges);let result=null,records=[],previousRotations=new Map();
  for(let outer=1;outer<=maxOuter;outer++){
    result=solveFrameCorotational2D(working,scenarioId,options);records=[];let maxRelativeResidual=0,maxRotationChange=0;
    for(const h of hinges){
      const {force,connection}=findConnection(result,h),rotation=Number(connection.relativeRotation)||0,targetAxialForce=Number(force.basicForces?.N)||0,state=constitutiveState(project,h,rotation,targetAxialForce),constitutiveMoment=state.moment,elementMoment=Number(connection.moment)||0,momentResidual=elementMoment-constitutiveMoment,scale=Math.max(1,Math.abs(elementMoment),Math.abs(constitutiveMoment)),relativeResidual=Math.abs(momentResidual)/scale;
      let secantStiffness=Math.abs(rotation)>1e-10?constitutiveMoment/rotation:state.rotationalTangent;
      if(!(Number.isFinite(secantStiffness)&&secantStiffness>0))secantStiffness=Math.max(1e-9,state.rotationalTangent);
      const tangentStiffness=Math.max(1e-9,Number(state.rotationalTangent)||1e-9),targetStiffness=strategy==='secant'?secantStiffness:tangentStiffness,targetOffsetMoment=strategy==='secant'?0:constitutiveMoment-targetStiffness*rotation;
      const e=working.elements.find(x=>x.id===h.elementId),oldK=Number(e.rotationalSprings?.[h.key]),oldOffset=Number(e.rotationalSpringMoments?.[h.key])||0,nextK=Number.isFinite(oldK)&&oldK>0?(1-relaxation)*oldK+relaxation*targetStiffness:targetStiffness,nextOffset=(1-relaxation)*oldOffset+relaxation*targetOffsetMoment;
      e.rotationalSprings={...(e.rotationalSprings||{}),[h.key]:Math.max(1e-9,nextK)};e.rotationalSpringMoments={...(e.rotationalSpringMoments||{}),[h.key]:nextOffset};
      const key=`${h.elementId}:${h.end}`,previous=previousRotations.get(key),rotationChange=previous==null?Infinity:Math.abs(rotation-previous);previousRotations.set(key,rotation);maxRotationChange=Math.max(maxRotationChange,Number.isFinite(rotationChange)?rotationChange:0);maxRelativeResidual=Math.max(maxRelativeResidual,relativeResidual);
      records.push({elementId:h.elementId,end:h.end,key:h.key,rotation,elementMoment,constitutiveMoment,momentResidual,relativeResidual,secantStiffness,tangent:state.rotationalTangent,appliedStiffness:Number(e.rotationalSprings?.[h.key]),appliedOffsetMoment:Number(e.rotationalSpringMoments?.[h.key])||0,targetOffsetMoment,hingeLength:h.config.hingeLength,targetAxialForce,axialResidual:state.axialResidual,epsilon0:state.epsilon0,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount,hardeningRatio:h.config.hardeningRatio});
    }
    if(outer>1&&maxRelativeResidual<=tolerance&&maxRotationChange<=Math.max(1e-10,tolerance))return decorateResult(result,records,outer,tolerance,strategy);
  }
  const worst=Math.max(0,...records.map(r=>r.relativeResidual));throw new Error(`Rótulas de fibras v0.14 não convergiram em ${maxOuter} iterações externas (resíduo relativo máximo=${worst.toExponential(3)}).`);
}

export const MATERIAL_NONLINEAR_VERSION='0.14.1-exp';
