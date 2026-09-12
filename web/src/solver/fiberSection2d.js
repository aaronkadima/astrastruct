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

/**
 * Rótula concentrada de flexão pura baseada na seção de fibras.
 * theta é a rotação relativa da rótula e Lp o comprimento plástico de referência.
 * A versão inicial impõe epsilon0=0 e, portanto, é destinada a benchmark/uso sem
 * interação axial significativa. A integração global deve verificar esse escopo.
 */
export function fiberHingePureBendingState({rotation,hingeLength,section,material,nFibers=40,hardeningRatio=0.01}){
  const theta=finite('rotação da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength);if(!(Lp>0))throw new Error('Rótula de fibras: comprimento deve ser positivo.');
  const curvature=theta/Lp,state=rectangularSteelFiberSectionFromModel({section,material,nFibers,epsilon0:0,kappa:curvature,hardeningRatio}),sectionTangent=state.tangent[1][1],rotationalTangent=sectionTangent/Lp;
  return{type:'fiber-hinge-pure-bending',rotation:theta,hingeLength:Lp,curvature,moment:state.M,rotationalTangent,sectionState:state,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount};
}

export const FIBER_SECTION_VERSION='0.14.0-exp';
