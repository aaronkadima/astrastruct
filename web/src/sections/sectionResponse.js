import {createSectionMaterialLaw} from './materialLaws.js';
import {csrFromDense} from '../numerics/sparseMatrix.js';
import {solveLinearSystem} from '../numerics/linearSolver.js';
import {NonlinearConvergenceError,normInf} from '../numerics/diagnostics.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SectionResponse: ${name} deve ser finito.`);return n};
const zeros=()=>Array.from({length:3},()=>Array(3).fill(0));

function generalizedVector(value={}){
  if(Array.isArray(value)){if(value.length!==3)throw new Error('SectionResponse: generalizedStrain deve ter 3 componentes.');return value.map((v,i)=>finite(`generalizedStrain[${i}]`,v))}
  return[finite('epsilon0',value.epsilon0??0),finite('kappaY',value.kappaY??0),finite('kappaZ',value.kappaZ??0)];
}
function resultantVector(value={}){
  if(Array.isArray(value)){if(value.length!==3)throw new Error('SectionResponse: target deve ter 3 componentes.');return value.map((v,i)=>finite(`target[${i}]`,v))}
  return[finite('N',value.N??0),finite('My',value.My??0),finite('Mz',value.Mz??0)];
}
function materialById(materials,id){
  if(materials instanceof Map)return materials.get(id)||null;
  if(Array.isArray(materials))return materials.find(m=>m.id===id)||null;
  if(materials&&typeof materials==='object')return materials[id]||null;return null;
}
function optionsFor(materialOptions,materialId,material){
  if(typeof materialOptions==='function')return materialOptions(materialId,material)||{};
  return materialOptions?.[materialId]||materialOptions?.[material?.type]||materialOptions?.default||{};
}

function cellMoments(fiber,index){
  const IyLocal=finite(`fiber[${index}].IyLocal`,fiber.IyLocal??0),IzLocal=finite(`fiber[${index}].IzLocal`,fiber.IzLocal??0),IyzLocal=finite(`fiber[${index}].IyzLocal`,fiber.IyzLocal??0);
  if(IyLocal<0||IzLocal<0)throw new Error(`SectionResponse: inércias locais da fibra ${index} não podem ser negativas.`);
  return{IyLocal,IzLocal,IyzLocal};
}

/**
 * Biaxial fiber/cell integration in the y-z plane.
 *
 * The generalized strain field is affine:
 *   eps(y,z) = eps0 - kappaY*z + kappaZ*y.
 *
 * Each integration cell stores its centroidal area moments. Stress and tangent
 * are evaluated at the cell centroid; the affine first-order continuation with
 * that tangent is integrated analytically inside the cell. Therefore elastic
 * rectangular cells reproduce A, Iy, Iz and Iyz exactly instead of degrading to
 * a midpoint-rule inertia. Discrete bars/points simply have zero local moments.
 */
export function fiberSectionResponse3D({fibers,materials,generalizedStrain={},materialOptions={}}={}){
  const rows=Array.from(fibers||[]);if(!rows.length)throw new Error('SectionResponse: fibras ausentes.');const e=generalizedVector(generalizedStrain),K=zeros();let N=0,My=0,Mz=0,yieldedFibers=0,crackedFibers=0,crushedFibers=0,minStrain=Infinity,maxStrain=-Infinity,minStress=Infinity,maxStress=-Infinity;
  const states=rows.map((fiber,index)=>{
    const y=finite(`fiber[${index}].y`,fiber.y),z=finite(`fiber[${index}].z`,fiber.z),area=finite(`fiber[${index}].area`,fiber.area);if(!(area>0))throw new Error(`SectionResponse: área da fibra ${index} deve ser positiva.`);
    const {IyLocal,IzLocal,IyzLocal}=cellMoments(fiber,index),material=materialById(materials,fiber.materialId);if(!material)throw new Error(`SectionResponse: material ${fiber.materialId} ausente na fibra ${fiber.id||index}.`);
    const B=[1,-z,y],strain=B[0]*e[0]+B[1]*e[1]+B[2]*e[2],law=createSectionMaterialLaw(material,optionsFor(materialOptions,fiber.materialId,material)),state=law(strain),stress=finite(`fiber[${index}].stress`,state.stress),Et=finite(`fiber[${index}].tangent`,state.tangent),force=stress*area;

    // Exact for affine strain + linear material; first-order consistent cell
    // correction for nonlinear laws around the centroid state.
    const localMy=Et*(e[1]*IyLocal-e[2]*IyzLocal),localMz=Et*(-e[1]*IyzLocal+e[2]*IzLocal);
    N+=force;My+=B[1]*force+localMy;Mz+=B[2]*force+localMz;

    K[0][0]+=Et*area;
    K[0][1]+=Et*(-area*z);K[1][0]+=Et*(-area*z);
    K[0][2]+=Et*(area*y);K[2][0]+=Et*(area*y);
    K[1][1]+=Et*(area*z*z+IyLocal);
    K[2][2]+=Et*(area*y*y+IzLocal);
    const yz=-Et*(area*y*z+IyzLocal);K[1][2]+=yz;K[2][1]+=yz;

    if(state.yielded)yieldedFibers++;if(state.cracked)crackedFibers++;if(state.crushed)crushedFibers++;minStrain=Math.min(minStrain,strain);maxStrain=Math.max(maxStrain,strain);minStress=Math.min(minStress,stress);maxStress=Math.max(maxStress,stress);
    return{...fiber,strain,stress,tangent:Et,force,localMomentCorrection:{My:localMy,Mz:localMz},materialType:material.type||'elastic',yielded:!!state.yielded,cracked:!!state.cracked,crushed:!!state.crushed,branch:state.branch||null};
  });
  return{contract:'section-response/v1',integration:'centroid-with-local-cell-moments',generalizedStrain:{epsilon0:e[0],kappaY:e[1],kappaZ:e[2]},resultants:{N,My,Mz},resultantVector:[N,My,Mz],tangent:K,fibers:states,fiberCount:states.length,yieldedFibers,crackedFibers,crushedFibers,minStrain,maxStrain,minStress,maxStress};
}

export function solveSectionEquilibrium3D({fibers,materials,target={},initial={},materialOptions={},tolerances={}}={}){
  const targetVector=resultantVector(target),absTol=Math.max(1e-12,Number(tolerances.absoluteResidual)||1e-6),relTol=Math.max(1e-12,Number(tolerances.relativeResidual)||1e-9),incTol=Math.max(1e-14,Number(tolerances.increment)||1e-12),maxIterations=Math.max(2,Math.min(100,Math.round(Number(tolerances.maxIterations)||40)));let e=generalizedVector(initial),history=[];
  const scale=Math.max(1,...targetVector.map(Math.abs));
  for(let iteration=0;iteration<=maxIterations;iteration++){
    const response=fiberSectionResponse3D({fibers,materials,generalizedStrain:e,materialOptions}),residual=response.resultantVector.map((v,i)=>v-targetVector[i]),rAbs=normInf(residual),rRel=rAbs/scale;
    if(rAbs<=absTol||rRel<=relTol)return{contract:'section-equilibrium/v1',converged:true,iterations:iteration,target:{N:targetVector[0],My:targetVector[1],Mz:targetVector[2]},generalizedStrain:response.generalizedStrain,response,residual,history};
    if(iteration===maxIterations)break;
    const linear=solveLinearSystem(csrFromDense(response.tangent),residual.map(v=>-v),{method:'direct',relativePivotTolerance:1e-12,absolutePivotTolerance:1e-18}),de=linear.x;e=e.map((v,i)=>v+de[i]);history.push({iteration:iteration+1,rAbs,rRel,increment:de,incrementNorm:normInf(de),linear:linear.diagnostics});
    if(de.some(v=>!Number.isFinite(v))||e.some(v=>!Number.isFinite(v)))throw new NonlinearConvergenceError('SectionResponse: incremento não finito no equilíbrio N–My–Mz.',{iteration,residual,de,e});
    if(normInf(de)<=incTol&&rAbs>absTol&&rRel>relTol)throw new NonlinearConvergenceError('SectionResponse: equilíbrio N–My–Mz estagnou.',{iteration,residual,de,e,history});
  }
  throw new NonlinearConvergenceError(`SectionResponse: equilíbrio N–My–Mz não convergiu em ${maxIterations} iterações.`,{target:targetVector,generalizedStrain:e,history});
}

export function elasticSectionStiffnessFromFibers({fibers,materials}={}){
  return fiberSectionResponse3D({fibers,materials,generalizedStrain:[0,0,0],materialOptions:{default:{}}}).tangent;
}
