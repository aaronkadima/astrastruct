import { bilinearSteelState, bilinearSteelFromModelMaterial } from './material1d.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Seção de fibras: ${name} deve ser finito.`);return n};

export function rectangularFibers({width,height,nFibers=40}){
  const b=finite('largura',width),h=finite('altura',height),n=Math.max(2,Math.min(400,Math.round(finite('número de fibras',nFibers))));
  if(!(b>0&&h>0))throw new Error('Seção de fibras: largura e altura devem ser positivas.');
  const dy=h/n,area=b*dy;
  return Array.from({length:n},(_,i)=>({id:i+1,y:-h/2+(i+.5)*dy,area,width:b,height:dy}));
}

export function fiberSectionState({fibers,epsilon0=0,kappa=0,materialLaw}){
  if(!Array.isArray(fibers)||!fibers.length)throw new Error('Seção de fibras: malha de fibras vazia.');
  if(typeof materialLaw!=='function')throw new Error('Seção de fibras: lei constitutiva ausente.');
  const eps0=finite('epsilon0',epsilon0),curvature=finite('kappa',kappa);
  let N=0,M=0,k11=0,k12=0,k22=0,yieldedFibers=0,minStress=Infinity,maxStress=-Infinity,minStrain=Infinity,maxStrain=-Infinity;
  const states=fibers.map((fiber,index)=>{
    const y=finite(`y da fibra ${index+1}`,fiber.y),area=finite(`área da fibra ${index+1}`,fiber.area);if(!(area>0))throw new Error(`Seção de fibras: área da fibra ${index+1} deve ser positiva.`);
    const strain=eps0-curvature*y,state=materialLaw(strain,fiber,index),stress=finite(`tensão da fibra ${index+1}`,state?.stress),Et=finite(`tangente da fibra ${index+1}`,state?.tangent);
    N+=stress*area;M-=stress*area*y;k11+=Et*area;k12-=Et*area*y;k22+=Et*area*y*y;if(state?.yielded)yieldedFibers++;
    minStress=Math.min(minStress,stress);maxStress=Math.max(maxStress,stress);minStrain=Math.min(minStrain,strain);maxStrain=Math.max(maxStrain,strain);
    return{...fiber,strain,stress,tangent:Et,yielded:!!state?.yielded,branch:state?.branch||null};
  });
  return{type:'fiber-section-2d',epsilon0:eps0,kappa:curvature,N,M,tangent:[[k11,k12],[k12,k22]],yieldedFibers,fiberCount:states.length,minStress,maxStress,minStrain,maxStrain,fibers:states};
}

export function rectangularSteelFiberSectionState({width,height,nFibers=40,epsilon0=0,kappa=0,E,fy,hardeningRatio=0.01}){
  const fibers=rectangularFibers({width,height,nFibers});
  return fiberSectionState({fibers,epsilon0,kappa,materialLaw:strain=>bilinearSteelState({strain,E,fy,hardeningRatio})});
}

export function rectangularSteelFiberSectionFromModel({section,material,nFibers=40,epsilon0=0,kappa=0,hardeningRatio=0.01}){
  if(!section)throw new Error('Seção de fibras: seção do modelo ausente.');
  const width=Number(section.b??section.width),height=Number(section.h??section.depth);
  const fibers=rectangularFibers({width,height,nFibers});
  return fiberSectionState({fibers,epsilon0,kappa,materialLaw:strain=>bilinearSteelFromModelMaterial(material,strain,{hardeningRatio})});
}

/** Pure-bending helper retained as an exact local benchmark. */
export function fiberHingePureBendingState({rotation,hingeLength,section,material,nFibers=40,hardeningRatio=0.01}){
  const theta=finite('rotação da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength);if(!(Lp>0))throw new Error('Rótula de fibras: comprimento deve ser positivo.');
  const curvature=theta/Lp,state=rectangularSteelFiberSectionFromModel({section,material,nFibers,epsilon0:0,kappa:curvature,hardeningRatio}),sectionTangent=state.tangent[1][1],rotationalTangent=sectionTangent/Lp;
  return{type:'fiber-hinge-pure-bending',rotation:theta,hingeLength:Lp,curvature,moment:state.M,rotationalTangent,sectionState:state,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount};
}

/**
 * Concentrated steel fiber hinge with axial-force equilibrium.
 *
 * For a prescribed relative rotation theta, kappa=theta/Lp. epsilon0 is solved
 * locally so the fiber section reproduces targetAxialForce (N>0 tension).
 * The flexural tangent at constant N is the Schur complement
 * D_Mk|N = K22 - K12²/K11, converted to dM/dtheta by division by Lp.
 *
 * The constitutive law is still the monotonic bilinear envelope; no cyclic
 * history/unloading is implied by this local equilibrium solve.
 */
export function fiberHingeSectionState({rotation,hingeLength,targetAxialForce=0,section,material,nFibers=40,hardeningRatio=0.01,maxIterations=30,tolerance=1e-9,initialEpsilon0=null}){
  const theta=finite('rotação da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength),targetN=finite('esforço normal alvo',targetAxialForce);if(!(Lp>0))throw new Error('Rótula de fibras: comprimento deve ser positivo.');
  if(!material)throw new Error('Rótula de fibras: material ausente.');
  const E=finite('E',material.E);if(!(E>0))throw new Error('Rótula de fibras: E deve ser positivo.');
  const width=Number(section?.b??section?.width),height=Number(section?.h??section?.depth),fibers=rectangularFibers({width,height,nFibers}),area=fibers.reduce((s,f)=>s+f.area,0),curvature=theta/Lp;
  let epsilon0=initialEpsilon0==null?targetN/(E*area):finite('epsilon0 inicial',initialEpsilon0),state=null,residual=Infinity,iteration=0;
  const fyScale=Math.abs(Number(material.fy)||0)*1000*area,forceScale=Math.max(1,Math.abs(targetN),fyScale),tol=Math.max(1e-12,Number(tolerance)||1e-9)*forceScale,maxIt=Math.max(3,Math.min(80,Math.round(Number(maxIterations)||30)));
  const materialLaw=strain=>bilinearSteelFromModelMaterial(material,strain,{hardeningRatio});
  for(iteration=1;iteration<=maxIt;iteration++){
    state=fiberSectionState({fibers,epsilon0,kappa:curvature,materialLaw});residual=state.N-targetN;
    if(Math.abs(residual)<=tol)break;
    const K11=state.tangent[0][0];if(!(Math.abs(K11)>1e-12))throw new Error('Rótula de fibras: rigidez axial tangente degenerada durante equilíbrio N–M. Use encruamento positivo ou reduza o nível de plastificação.');
    epsilon0-=residual/K11;
    if(!Number.isFinite(epsilon0)||Math.abs(epsilon0)>.5)throw new Error('Rótula de fibras: equilíbrio axial divergiu para deformação não física.');
  }
  if(!state||Math.abs(residual)>tol)throw new Error(`Rótula de fibras: equilíbrio axial não convergiu em ${maxIt} iterações.`);
  const [[K11,K12],[,K22]]=state.tangent;if(!(Math.abs(K11)>1e-12))throw new Error('Rótula de fibras: K11 tangente degenerado.');
  const flexuralTangentAtConstantN=K22-K12*K12/K11,rotationalTangent=flexuralTangentAtConstantN/Lp;
  return{type:'fiber-hinge-steel-nm',rotation:theta,hingeLength:Lp,curvature,targetAxialForce:targetN,epsilon0,moment:state.M,rotationalTangent,flexuralTangentAtConstantN,axialResidual:residual,axialIterations:iteration,sectionState:state,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount};
}

export const FIBER_SECTION_VERSION='0.14.0-exp';
