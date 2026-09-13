import {createElementComponent} from '../core/elementComponent.js';
import {elementDofs,zeros,positive,finite,subtract} from './utils.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function initialComponentState(){return{plasticDeformation:0,backForce:0,cumulativePlasticDeformation:0,dissipatedEnergy:0,lastDeformation:0,lastForce:0,active:true,yielded:false}}

function evaluateLaw(definition,deformation,committed={}){
  const law=String(definition.law||'elastic').toLowerCase(),d=finite('link deformation',deformation,definition.label),k=positive('link stiffness k',definition.k,definition.label),state={...initialComponentState(),...(committed||{})};
  if(law==='elastic'){const q=k*d;return{force:q,tangent:k,state:{...state,lastDeformation:d,lastForce:q,active:true,yielded:false},branch:'elastic'}}
  if(law==='gap-tension'||law==='gap-compression'){
    const gap=Math.max(0,Number(definition.gap)||0),tension=law==='gap-tension',active=tension?d>gap:d<-gap,q=active?k*(d-(tension?gap:-gap)):0;return{force:q,tangent:active?k:0,state:{...state,lastDeformation:d,lastForce:q,active,yielded:false},branch:active?'contact':'open-gap'};
  }
  if(law==='bilinear-kinematic'){
    const fy=positive('yieldForce',definition.yieldForce??definition.fy,definition.label),b=clamp(Number(definition.hardeningRatio)||0,0,.95),H=b>0?k*b/(1-b):0,p=Number(state.plasticDeformation)||0,alpha=Number(state.backForce)||0,qTrial=k*(d-p),xi=qTrial-alpha,f=Math.abs(xi)-fy,tol=1e-12*Math.max(1,fy,Math.abs(qTrial));
    if(f<=tol){return{force:qTrial,tangent:k,state:{...state,lastDeformation:d,lastForce:qTrial,active:true,yielded:Math.abs(f)<=10*tol&&Math.abs(p)>0},branch:Math.abs(p)>0?'elastic-unloading-reloading':'elastic'}}
    const sign=xi<0?-1:1,dGamma=f/(k+H),plasticDeformation=p+dGamma*sign,backForce=alpha+H*dGamma*sign,cumulativePlasticDeformation=(Number(state.cumulativePlasticDeformation)||0)+dGamma,force=qTrial-k*dGamma*sign,tangent=H>0?k*H/(k+H):0,dissipatedEnergy=(Number(state.dissipatedEnergy)||0)+fy*dGamma;
    return{force,tangent,state:{...state,plasticDeformation,backForce,cumulativePlasticDeformation,dissipatedEnergy,lastDeformation:d,lastForce:force,active:true,yielded:true},branch:'plastic-return',plasticIncrement:dGamma};
  }
  throw new Error(`NonlinearLink: lei '${definition.law}' não suportada.`);
}

function createNonlinearLinkComponent({element,dimension}){
  const components=Array.from(element?.components||[]);if(!components.length)throw new Error(`NonlinearLink ${element?.id||'(sem id)'}: components é obrigatório.`);const allowed=dimension===2?new Set(['ux','uy','rz']):new Set(['ux','uy','uz','rx','ry','rz']),labels=components.map((component,index)=>{const label=String(component.label||'');if(!allowed.has(label))throw new Error(`NonlinearLink ${element.id}: componente ${index+1} usa DOF inválido ${label}.`);return label});if(new Set(labels).size!==labels.length)throw new Error(`NonlinearLink ${element.id}: labels de componentes devem ser únicos.`);
  const initialState={components:Object.fromEntries(labels.map(label=>[label,initialComponentState()]))},n=labels.length,externalForce=Array(2*n).fill(0);
  return createElementComponent({id:element.id,type:element.type,dofs:elementDofs(element,labels),initialState,metadata:{dimension:`${dimension}d`,family:'nonlinear-link',stateful:true},evaluate:({u,committedState})=>{
    const tangent=zeros(2*n),internalForce=Array(2*n).fill(0),nextState={components:{}},outputs=[];
    components.forEach((definition,i)=>{const label=labels[i],deformation=u[n+i]-u[i],law=evaluateLaw({...definition,label},deformation,committedState?.components?.[label]);internalForce[i]-=law.force;internalForce[n+i]+=law.force;tangent[i][i]+=law.tangent;tangent[i][n+i]-=law.tangent;tangent[n+i][i]-=law.tangent;tangent[n+i][n+i]+=law.tangent;nextState.components[label]=law.state;outputs.push({label,law:String(definition.law||'elastic'),deformation,force:law.force,tangent:law.tangent,branch:law.branch,plasticIncrement:Number(law.plasticIncrement)||0,state:law.state})});
    return{tangent,residual:subtract(internalForce,externalForce),internalForce,externalForce,state:nextState,outputs:{components:outputs,totalDissipatedEnergy:outputs.reduce((s,row)=>s+(Number(row.state.dissipatedEnergy)||0),0)}};
  }});
}

export const createNonlinearLink2DComponent=({element})=>createNonlinearLinkComponent({element,dimension:2});
export const createNonlinearLink3DComponent=({element})=>createNonlinearLinkComponent({element,dimension:3});
export {evaluateLaw as nonlinearLinkLawState};
