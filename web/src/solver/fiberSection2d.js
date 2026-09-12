import { bilinearSteelState, bilinearSteelFromModelMaterial, cyclicSteelFromModelMaterial } from './material1d.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Seção de fibras: ${name} deve ser finito.`);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function sectionFiberFamily(section){
  const raw=String(section?.family||((Number(section?.b??section?.width)>0&&Number(section?.h??section?.depth)>0)?'rect':'')).trim().toLowerCase();
  if(['rect','rectangle','retangular'].includes(raw))return'rect';
  if(['i','h','ih','i/h','wide-flange','wideflange'].includes(raw))return'i';
  if(['rhs','box','hss-rect','hss_rect','tube-rect'].includes(raw))return'rhs';
  return raw||'unknown';
}

function layerCounts(heights,total,minEach=2){
  const hs=heights.map(h=>Math.max(0,Number(h)||0)),active=hs.map((h,i)=>h>0?i:-1).filter(i=>i>=0);
  if(!active.length)throw new Error('Seção de fibras: regiões sem altura positiva.');
  const n=Math.max(active.length*minEach,Math.min(400,Math.round(Number(total)||40))),counts=hs.map(()=>0);
  active.forEach(i=>{counts[i]=minEach});
  let remaining=n-active.length*minEach;
  const sum=active.reduce((s,i)=>s+hs[i],0),raw=active.map(i=>remaining*hs[i]/sum),floors=raw.map(Math.floor);
  active.forEach((i,j)=>{counts[i]+=floors[j]});remaining-=floors.reduce((s,v)=>s+v,0);
  const order=active.map((i,j)=>({i,j,f:raw[j]-floors[j]})).sort((a,b)=>b.f-a.f);
  for(let k=0;k<remaining;k++)counts[order[k%order.length].i]++;
  return counts;
}

function layeredFibers(regions,nFibers){
  const counts=layerCounts(regions.map(r=>r.y1-r.y0),nFibers),fibers=[];
  regions.forEach((r,regionIndex)=>{
    const width=finite(`largura da região ${regionIndex+1}`,r.width),height=finite(`altura da região ${regionIndex+1}`,r.y1-r.y0),n=counts[regionIndex];
    if(!(width>0&&height>0&&n>0))throw new Error(`Seção de fibras: geometria inválida na região ${regionIndex+1}.`);
    const dy=height/n,area=width*dy;
    for(let i=0;i<n;i++)fibers.push({id:fibers.length+1,y:r.y0+(i+.5)*dy,area,width,height:dy,region:r.region||`region-${regionIndex+1}`});
  });
  return fibers;
}

export function rectangularFibers({width,height,nFibers=40}){
  const b=finite('largura',width),h=finite('altura',height),n=Math.max(2,Math.min(400,Math.round(finite('número de fibras',nFibers))));
  if(!(b>0&&h>0))throw new Error('Seção de fibras: largura e altura devem ser positivas.');
  const dy=h/n,area=b*dy;
  return Array.from({length:n},(_,i)=>({id:i+1,y:-h/2+(i+.5)*dy,area,width:b,height:dy,region:'rect'}));
}

export function iSectionFibers({height,width,webThickness,flangeThickness,nFibers=80}){
  const h=finite('altura do perfil I/H',height),b=finite('largura da mesa do perfil I/H',width),tw=finite('espessura da alma',webThickness),tf=finite('espessura da mesa',flangeThickness),n=clamp(Math.round(finite('número de fibras',nFibers)),6,400);
  if(!(h>0&&b>0&&tw>0&&tf>0))throw new Error('Seção de fibras I/H: h, b, tw e tf devem ser positivos.');
  if(!(2*tf<h))throw new Error('Seção de fibras I/H: deve valer 2·tf < h.');
  if(!(tw<=b))throw new Error('Seção de fibras I/H: deve valer tw ≤ b.');
  const y0=-h/2,y1=y0+tf,y2=h/2-tf,y3=h/2;
  return layeredFibers([
    {y0,y1,width:b,region:'flange-bottom'},
    {y0:y1,y1:y2,width:tw,region:'web'},
    {y0:y2,y1:y3,width:b,region:'flange-top'}
  ],n);
}

export function rhsFibers({height,width,thickness,nFibers=80}){
  const h=finite('altura do RHS',height),b=finite('largura do RHS',width),t=finite('espessura do RHS',thickness),n=clamp(Math.round(finite('número de fibras',nFibers)),6,400);
  if(!(h>0&&b>0&&t>0))throw new Error('Seção de fibras RHS: h, b e t devem ser positivos.');
  if(!(2*t<h&&2*t<b))throw new Error('Seção de fibras RHS: deve valer 2·t < h e 2·t < b.');
  const y0=-h/2,y1=y0+t,y2=h/2-t,y3=h/2;
  return layeredFibers([
    {y0,y1,width:b,region:'wall-bottom'},
    {y0:y1,y1:y2,width:2*t,region:'side-walls'},
    {y0:y2,y1:y3,width:b,region:'wall-top'}
  ],n);
}

export function sectionFibersFromModel({section,nFibers=40}){
  if(!section)throw new Error('Seção de fibras: seção do modelo ausente.');
  const family=sectionFiberFamily(section),h=Number(section.h??section.depth),b=Number(section.b??section.width);
  if(family==='rect')return rectangularFibers({width:b,height:h,nFibers});
  if(family==='i')return iSectionFibers({height:h,width:b,webThickness:section.tw??section.webThickness,flangeThickness:section.tf??section.flangeThickness,nFibers});
  if(family==='rhs')return rhsFibers({height:h,width:b,thickness:section.t??section.thickness,nFibers});
  throw new Error(`Seção de fibras: família "${family}" ainda não suportada. Use rect, i/h ou rhs.`);
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

export function steelFiberSectionFromModel({section,material,nFibers=40,epsilon0=0,kappa=0,hardeningRatio=0.01}){
  const family=sectionFiberFamily(section),fibers=sectionFibersFromModel({section,nFibers}),state=fiberSectionState({fibers,epsilon0,kappa,materialLaw:strain=>bilinearSteelFromModelMaterial(material,strain,{hardeningRatio})});
  return{...state,sectionFamily:family,geometricArea:fibers.reduce((s,f)=>s+f.area,0),discreteSecondMoment:fibers.reduce((s,f)=>s+f.area*f.y*f.y,0)};
}

/** Pure-bending helper retained as an exact local benchmark. */
export function fiberHingePureBendingState({rotation,hingeLength,section,material,nFibers=40,hardeningRatio=0.01}){
  const theta=finite('rotação da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength);if(!(Lp>0))throw new Error('Rótula de fibras: comprimento deve ser positivo.');
  const curvature=theta/Lp,state=steelFiberSectionFromModel({section,material,nFibers,epsilon0:0,kappa:curvature,hardeningRatio}),sectionTangent=state.tangent[1][1],rotationalTangent=sectionTangent/Lp;
  return{type:'fiber-hinge-pure-bending',rotation:theta,hingeLength:Lp,curvature,moment:state.M,rotationalTangent,sectionFamily:state.sectionFamily,sectionState:state,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount};
}

/**
 * Concentrated steel fiber hinge with axial-force equilibrium.
 *
 * For a prescribed relative rotation theta, kappa=theta/Lp. epsilon0 is solved
 * locally so the fiber section reproduces targetAxialForce (N>0 tension).
 * The flexural tangent at constant N is the Schur complement
 * D_Mk|N = K22 - K12²/K11, converted to dM/dtheta by division by Lp.
 *
 * Supported strong-axis meshes in v0.14.2: rectangular, I/H and RHS. The I/H
 * web and flanges and the RHS walls are integrated as vertical strips; fibers at
 * the same y are combined by width because their uniaxial strain is identical.
 * The constitutive law is still the monotonic bilinear envelope; no cyclic
 * history/unloading is implied by this local equilibrium solve.
 */
export function fiberHingeSectionState({rotation,hingeLength,targetAxialForce=0,section,material,nFibers=40,hardeningRatio=0.01,maxIterations=30,tolerance=1e-9,initialEpsilon0=null}){
  const theta=finite('rotação da rótula',rotation),Lp=finite('comprimento da rótula',hingeLength),targetN=finite('esforço normal alvo',targetAxialForce);if(!(Lp>0))throw new Error('Rótula de fibras: comprimento deve ser positivo.');
  if(!material)throw new Error('Rótula de fibras: material ausente.');
  const E=finite('E',material.E);if(!(E>0))throw new Error('Rótula de fibras: E deve ser positivo.');
  const sectionFamily=sectionFiberFamily(section),fibers=sectionFibersFromModel({section,nFibers}),area=fibers.reduce((s,f)=>s+f.area,0),curvature=theta/Lp;
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
  return{type:'fiber-hinge-steel-nm',rotation:theta,hingeLength:Lp,curvature,targetAxialForce:targetN,epsilon0,moment:state.M,rotationalTangent,flexuralTangentAtConstantN,axialResidual:residual,axialIterations:iteration,sectionFamily,sectionState:{...state,sectionFamily},yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount};
}


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

export const FIBER_SECTION_VERSION='0.22.0-exp';
