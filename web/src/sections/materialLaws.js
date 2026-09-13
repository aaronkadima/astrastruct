import {bilinearSteelFromModelMaterial} from '../solver/material1d.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SectionMaterial: ${name} deve ser finito.`);return n};

export function elasticSectionMaterial(material,strain){
  if(!material)throw new Error('SectionMaterial: material ausente.');const E=finite('E',material.E),eps=finite('strain',strain);if(!(E>0))throw new Error('SectionMaterial: E deve ser positivo.');
  return{type:'elastic',strain:eps,stress:E*eps,tangent:E,yielded:false,crushed:false,cracked:false};
}

export function steelSectionMaterial(material,strain,{hardeningRatio=.01}={}){
  const state=bilinearSteelFromModelMaterial(material,strain,{hardeningRatio});return{...state,crushed:false,cracked:false};
}

export function concreteSectionMaterial(material,strain,{compressionStrengthMPa=null,epsc2=.002,epscu=.0035,tension='none',tensionStrengthMPa=null,tensionSofteningStrain=null}={}){
  if(!material)throw new Error('SectionMaterial concrete: material ausente.');
  const eps=finite('strain',strain),E=finite('E',material.E),fcMPa=Math.abs(Number(compressionStrengthMPa??material.fcm??material.fck));if(!(E>0&&fcMPa>0))throw new Error('SectionMaterial concrete: E e fck/fcm devem ser positivos.');
  const fc=fcMPa*1000,e2=Math.abs(finite('epsc2',epsc2)),eu=Math.abs(finite('epscu',epscu));if(!(e2>0&&eu>e2))throw new Error('SectionMaterial concrete: deve valer epscu > epsc2 > 0.');
  if(eps<0){
    const x=-eps;
    if(x<=e2){const eta=x/e2,stress=-fc*(2*eta-eta*eta),tangent=2*fc*(1-eta)/e2;return{type:'concrete-parabola-rectangle',strain:eps,stress,tangent,yielded:false,crushed:false,cracked:false,branch:'compression-parabola'}}
    if(x<=eu)return{type:'concrete-parabola-rectangle',strain:eps,stress:-fc,tangent:0,yielded:false,crushed:false,cracked:false,branch:'compression-plateau'};
    return{type:'concrete-parabola-rectangle',strain:eps,stress:0,tangent:0,yielded:false,crushed:true,cracked:false,branch:'crushed'};
  }
  if(eps===0)return{type:'concrete-parabola-rectangle',strain:eps,stress:0,tangent:tension==='none'?0:E,yielded:false,crushed:false,cracked:false,branch:'origin'};
  if(tension==='none')return{type:'concrete-parabola-rectangle',strain:eps,stress:0,tangent:0,yielded:false,crushed:false,cracked:true,branch:'tension-cutoff'};
  const ftMPa=Math.abs(Number(tensionStrengthMPa??material.fctm??0));if(!(ftMPa>0))throw new Error('SectionMaterial concrete: resistência à tração ausente para modo tensionado.');
  const ft=ftMPa*1000,epsCr=ft/E;
  if(eps<=epsCr)return{type:'concrete-tension',strain:eps,stress:E*eps,tangent:E,yielded:false,crushed:false,cracked:false,branch:'tension-elastic'};
  if(tension==='elastic')return{type:'concrete-tension',strain:eps,stress:0,tangent:0,yielded:false,crushed:false,cracked:true,branch:'tension-cracked'};
  if(tension!=='linear-softening')throw new Error(`SectionMaterial concrete: modo de tração desconhecido ${tension}.`);
  const epsTu=Math.max(epsCr*1.0001,Number(tensionSofteningStrain)||10*epsCr);
  if(eps>=epsTu)return{type:'concrete-tension',strain:eps,stress:0,tangent:0,yielded:false,crushed:false,cracked:true,branch:'tension-softened'};
  const tangent=-ft/(epsTu-epsCr),stress=ft+tangent*(eps-epsCr);return{type:'concrete-tension',strain:eps,stress,tangent,yielded:false,crushed:false,cracked:true,branch:'tension-softening'};
}

export function createSectionMaterialLaw(material,options={}){
  const type=String(material?.type||'elastic').toLowerCase();
  if(type==='steel'||type==='rebar')return strain=>steelSectionMaterial(material,strain,options);
  if(type==='concrete'||type==='grout')return strain=>concreteSectionMaterial(material,strain,options);
  return strain=>elasticSectionMaterial(material,strain);
}
