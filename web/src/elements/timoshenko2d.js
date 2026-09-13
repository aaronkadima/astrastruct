import {createElementComponent} from '../core/elementComponent.js';
import {frameTransform} from '../solver/frameElement.js';
import {geometry2D,materialFor,sectionFor,property,positive,elementDofs,zeros,transpose,mm,matVec,subtract,assertNoElementLoads} from './utils.js';

export function timoshenko2DLocalStiffness({E,G,A,I,As,kappa=5/6,L}){
  for(const [name,value] of Object.entries({E,G,A,I,As,kappa,L}))positive(name,value,'timoshenko2d');
  const k=zeros(6),EA=E*A/L,GA=kappa*G*As,phi=12*E*I/(GA*L*L),den=1+phi,a=12*E*I/(den*L**3),b=6*E*I/(den*L**2),c=(4+phi)*E*I/(den*L),d=(2-phi)*E*I/(den*L);
  k[0][0]=k[3][3]=EA;k[0][3]=k[3][0]=-EA;
  const idx=[1,2,4,5],kb=[[a,b,-a,b],[b,c,-b,d],[-a,-b,a,-b],[b,d,-b,c]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)k[idx[i]][idx[j]]=kb[i][j];
  return{k,phi,effectiveShearRigidity:GA};
}

export function createTimoshenko2DComponent({element,project}){
  if(!project)throw new Error(`Timoshenko2D ${element?.id||'(sem id)'}: project é obrigatório.`);assertNoElementLoads(project,element,'Timoshenko2D');const g=geometry2D(project,element),material=materialFor(project,element),section=sectionFor(project,element),E=positive('E',material.E,element.id),nu=Number(material.nu),G=positive('G',material.G??(Number.isFinite(nu)?E/(2*(1+nu)):NaN),element.id),A=positive('A',property(element,section,'A'),element.id),I=positive('I',property(element,section,'I'),element.id),As=positive('As',property(element,section,'As',property(element,section,'Ay',property(element,section,'shearArea',A))),element.id),kappa=positive('shearCorrection',element.shearCorrection??section.shearCorrection??5/6,element.id),local=timoshenko2DLocalStiffness({E,G,A,I,As,kappa,L:g.L}),T=frameTransform(g.c,g.s),kg=mm(transpose(T),mm(local.k,T)),externalForce=Array(6).fill(0);
  return createElementComponent({id:element.id,type:element.type,dofs:elementDofs(element,['ux','uy','rz']),metadata:{dimension:'2d',family:'timoshenko',linear:true,shearDeformation:true},evaluate:({u})=>{const internalForce=matVec(kg,u),ul=matVec(T,u),endForces=matVec(local.k,ul);return{tangent:kg,residual:subtract(internalForce,externalForce),internalForce,externalForce,outputs:{L:g.L,c:g.c,s:g.s,phi:local.phi,effectiveShearRigidity:local.effectiveShearRigidity,localDisplacements:ul,endForces,properties:{E,G,A,I,As,kappa}}}}});
}
