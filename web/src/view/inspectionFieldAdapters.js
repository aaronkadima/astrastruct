import {createInspectionField} from '../core/inspectionField.js';

function solverProvenance(result,sourceType=result?.type){return{sourceType:String(sourceType||'unknown'),solverVersion:String(result?.solverVersion||result?.final?.solverVersion||'unknown')}}
function need(result,type){if(!result)throw new Error(`inspection adapter: resultado ${type} ausente.`);return result}

export function anchorBondInspectionField(result,{profile='final'}={}){
  need(result,'anchor-pullout');const points=result.profiles?.[profile];
  if(!Array.isArray(points)||!points.length)throw new Error(`inspection adapter: perfil de ancoragem '${profile}' ausente.`);
  return createInspectionField({
    id:`anchor-bond-${profile}`,fieldType:'bond-stress',label:'Tensão de aderência τ',unit:'MPa',
    geometry:{kind:'path-1d',axis:'embedment-depth',closed:false},
    samples:points.map(p=>({entityId:`N${p.node}`,depth:p.depth,s:p.depth,value:p.bondStressMPa,slipMm:p.slip*1000,bondForce:p.bondForce,steelStressMPa:p.steelStressMPa})),
    provenance:solverProvenance(result),meta:{profile,embedment:result.config?.embedment,diameter:result.config?.diameter}
  });
}

export function punchingDemandInspectionField(result){
  need(result,'punching-perimeter');if(!Array.isArray(result.samples)||!result.samples.length)throw new Error('inspection adapter: amostras do perímetro de punção ausentes.');
  return createInspectionField({
    id:'punching-demand-perimeter',fieldType:'punching-shear-stress',label:'Demanda de punção τ',unit:'MPa',
    geometry:{kind:'closed-boundary-2d',closed:true},scale:{symmetric:true},
    samples:result.samples.map((p,i)=>({entityId:`P${i}`,x:p.x,y:p.y,s:p.s,value:p.tau/1000,edge:p.edge,t:p.t,q:p.q})),
    provenance:solverProvenance(result),meta:{effectiveDepth:result.effectiveDepth,perimeterLength:result.perimeterLength,actions:result.actions}
  });
}

function resolvedHoleState(result,state){
  if(state&&typeof state==='object'&&Array.isArray(state.holes))return state;
  if(result?.state?.holes)return result.state;
  if(result?.final?.state?.holes)return result.final.state;
  throw new Error('inspection adapter: estado de contato dos furos ausente.');
}

export function holeContactPressureInspectionField(result,{holeId=null,state='final'}={}){
  need(result,'hole-contact');const st=resolvedHoleState(result,state),holes=holeId?st.holes.filter(h=>h.id===holeId):st.holes;
  if(!holes.length)throw new Error(`inspection adapter: furo ${holeId||'(todos)'} não encontrado.`);
  const samples=[];
  for(const hole of holes)for(const s of hole.segments||[])samples.push({entityId:hole.id,x:s.x,y:s.y,angle:s.angle,active:Boolean(s.active),value:s.pressureMPa,penetrationMm:s.penetration*1000,radialDeformationMm:s.radialDeformation*1000,dFx:s.force?.fx||0,dFy:s.force?.fy||0});
  return createInspectionField({
    id:holeId?`hole-contact-pressure-${holeId}`:'hole-contact-pressure-all',fieldType:'contact-pressure',label:'Pressão normal de contato p(θ)',unit:'MPa',
    geometry:{kind:'circular-boundary-2d',closed:true},samples,
    provenance:solverProvenance(result),meta:{holeId,holes:holes.map(h=>({id:h.id,x:h.x,y:h.y,holeRadius:h.holeRadius,boltRadius:h.boltRadius,activeArcDegrees:h.activeArcDegrees,peakPressureMPa:h.peakPressureMPa}))}
  });
}

export function plateVonMisesInspectionField(result,{state='final'}={}){
  need(result,'plate');const st=state&&typeof state==='object'&&Array.isArray(state.elements)?state:(result?.state?.elements?result.state:result?.final?.state);
  if(!Array.isArray(st?.elements)||!st.elements.length)throw new Error('inspection adapter: estados de elementos da chapa ausentes.');
  return createInspectionField({
    id:'plate-von-mises',fieldType:'von-mises-stress',label:'Tensão equivalente de von Mises',unit:'MPa',
    geometry:{kind:'element-centroids-2d',closed:false},
    samples:st.elements.map(e=>({entityId:e.id,x:e.center?.x??0,y:e.center?.y??0,value:(e.maxVm??e.vm??0)/1000,materialFraction:e.materialFraction,yieldedFraction:e.yieldedFraction,plasticStrain:e.plasticStrain})),
    provenance:solverProvenance(result),meta:{source:'element-centroid/max-gauss'}
  });
}
