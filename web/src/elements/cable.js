import {createElementComponent} from '../core/elementComponent.js';
import {geometry2D,geometry3D,materialFor,sectionFor,property,positive,elementDofs,zeros,norm,subtract,dot} from './utils.js';

function cableTangent({dimension,n,N,EA,L0,l,active}){
  const size=2*dimension,K=zeros(size);if(!active)return K;const g=[...n.map(v=>-v),...n],kAxial=EA/L0;for(let i=0;i<size;i++)for(let j=0;j<size;j++)K[i][j]+=kAxial*g[i]*g[j];
  if(Math.abs(N)>0&&l>1e-14){const P=zeros(dimension);for(let i=0;i<dimension;i++)for(let j=0;j<dimension;j++)P[i][j]=(i===j?1:0)-n[i]*n[j];const c=N/l;for(let i=0;i<dimension;i++)for(let j=0;j<dimension;j++){const v=c*P[i][j];K[i][j]+=v;K[i][dimension+j]-=v;K[dimension+i][j]-=v;K[dimension+i][dimension+j]+=v}}
  return K;
}

function createCableComponent({element,project,dimension}){
  if(!project)throw new Error(`Cable${dimension}D ${element?.id||'(sem id)'}: project é obrigatório.`);const geometry=dimension===2?geometry2D(project,element):geometry3D(project,element),material=materialFor(project,element),section=sectionFor(project,element),E=positive('E',material.E,element.id),A=positive('A',property(element,section,'A'),element.id),EA=E*A,L0=geometry.L,initialForce=Math.max(0,Number(element.initialForce)||0),tensionOnly=element.tensionOnly!==false,labels=dimension===2?['ux','uy']:['ux','uy','uz'],referenceA=dimension===2?[Number(geometry.a.x),Number(geometry.a.y)]:geometry.pa,referenceB=dimension===2?[Number(geometry.b.x),Number(geometry.b.y)]:geometry.pb,externalForce=Array(2*dimension).fill(0);
  return createElementComponent({id:element.id,type:element.type,dofs:elementDofs(element,labels),initialState:{active:initialForce>0,N:initialForce,strain:0,currentLength:L0},metadata:{dimension:`${dimension}d`,family:'cable',corotational:true,tensionOnly},evaluate:({u})=>{
    const p1=referenceA.map((v,i)=>v+u[i]),p2=referenceB.map((v,i)=>v+u[dimension+i]),d=p2.map((v,i)=>v-p1[i]),l=norm(d);if(!(l>1e-12))throw new Error(`Cable ${element.id}: comprimento corrente degenerado.`);const n=d.map(v=>v/l),strain=(l-L0)/L0,trialForce=initialForce+EA*strain,active=!tensionOnly||trialForce>0,N=active?trialForce:0,g=[...n.map(v=>-v),...n],internalForce=g.map(v=>N*v),tangent=cableTangent({dimension,n,N,EA,L0,l,active}),state={active,N,strain,currentLength:l,direction:[...n]};
    return{tangent,residual:subtract(internalForce,externalForce),internalForce,externalForce,state,outputs:{N,strain,active,currentLength:l,referenceLength:L0,direction:n,initialForce,tensionOnly,axialRigidity:EA}};
  }});
}

export const createCable2DComponent=args=>createCableComponent({...args,dimension:2});
export const createCable3DComponent=args=>createCableComponent({...args,dimension:3});

export function cableAxialState({referenceLength,currentVector,E,A,initialForce=0,tensionOnly=true}){const L0=positive('referenceLength',referenceLength,'cable-state'),l=norm(currentVector);if(!(l>1e-12))throw new Error('Cable state: vetor corrente degenerado.');const EA=positive('E',E,'cable-state')*positive('A',A,'cable-state'),strain=(l-L0)/L0,trialForce=Math.max(0,Number(initialForce)||0)+EA*strain,active=!tensionOnly||trialForce>0;return{N:active?trialForce:0,strain,active,currentLength:l,direction:currentVector.map(v=>v/l),axialRigidity:EA}}
