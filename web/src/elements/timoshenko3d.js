import {createElementComponent} from '../core/elementComponent.js';
import {spatialAxes} from '../solver/spatial3d.js';
import {materialFor,sectionFor,property,positive,elementDofs,zeros,transpose,mm,matVec,subtract,assertNoElementLoads,nodeFor} from './utils.js';

function transform12(R){const T=zeros(12);for(const offset of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[offset+i][offset+j]=R[i][j];return T}

export function timoshenko3DLocalStiffness({E,G,A,Iy,Iz,J,Ay,Az,kappaY=5/6,kappaZ=5/6,L}){
  for(const [name,value] of Object.entries({E,G,A,Iy,Iz,J,Ay,Az,kappaY,kappaZ,L}))positive(name,value,'timoshenko3d');const k=zeros(12),EA=E*A/L,GJ=G*J/L,phiZ=12*E*Iz/(kappaY*G*Ay*L*L),phiY=12*E*Iy/(kappaZ*G*Az*L*L);
  k[0][0]=k[6][6]=EA;k[0][6]=k[6][0]=-EA;k[3][3]=k[9][9]=GJ;k[3][9]=k[9][3]=-GJ;
  const addBending=(idx,I,phi,sign)=>{const den=1+phi,a=12*E*I/(den*L**3),b=6*E*I/(den*L**2),c=(4+phi)*E*I/(den*L),d=(2-phi)*E*I/(den*L),base=sign>0?[[a,b,-a,b],[b,c,-b,d],[-a,-b,a,-b],[b,d,-b,c]]:[[a,-b,-a,-b],[-b,c,b,d],[-a,b,a,b],[-b,d,b,c]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)k[idx[i]][idx[j]]+=base[i][j]};
  addBending([1,5,7,11],Iz,phiZ,1);addBending([2,4,8,10],Iy,phiY,-1);return{k,phiY,phiZ,effectiveShearRigidityY:kappaY*G*Ay,effectiveShearRigidityZ:kappaZ*G*Az};
}

export function createTimoshenko3DComponent({element,project}){
  if(!project)throw new Error(`Timoshenko3D ${element?.id||'(sem id)'}: project é obrigatório.`);assertNoElementLoads(project,element,'Timoshenko3D');const a=nodeFor(project,element.n1,element.id),b=nodeFor(project,element.n2,element.id),axes=spatialAxes(a,b,element),material=materialFor(project,element),section=sectionFor(project,element),E=positive('E',material.E,element.id),nu=Number(material.nu),G=positive('G',material.G??(Number.isFinite(nu)?E/(2*(1+nu)):NaN),element.id),A=positive('A',property(element,section,'A'),element.id),Iy=positive('Iy',property(element,section,'Iy',property(element,section,'I')),element.id),Iz=positive('Iz',property(element,section,'Iz',property(element,section,'I')),element.id),J=positive('J',property(element,section,'J'),element.id),Ay=positive('Ay',property(element,section,'Ay',property(element,section,'Asy',A)),element.id),Az=positive('Az',property(element,section,'Az',property(element,section,'Asz',A)),element.id),kappaY=positive('kappaY',element.kappaY??section.kappaY??element.shearCorrectionY??5/6,element.id),kappaZ=positive('kappaZ',element.kappaZ??section.kappaZ??element.shearCorrectionZ??5/6,element.id),local=timoshenko3DLocalStiffness({E,G,A,Iy,Iz,J,Ay,Az,kappaY,kappaZ,L:axes.L}),T=transform12(axes.R),kg=mm(transpose(T),mm(local.k,T)),externalForce=Array(12).fill(0);
  return createElementComponent({id:element.id,type:element.type,dofs:elementDofs(element,['ux','uy','uz','rx','ry','rz']),metadata:{dimension:'3d',family:'timoshenko',linear:true,shearDeformation:true},evaluate:({u})=>{const internalForce=matVec(kg,u),ul=matVec(T,u),endForces=matVec(local.k,ul);return{tangent:kg,residual:subtract(internalForce,externalForce),internalForce,externalForce,outputs:{L:axes.L,localAxes:axes,phiY:local.phiY,phiZ:local.phiZ,localDisplacements:ul,endForces,properties:{E,G,A,Iy,Iz,J,Ay,Az,kappaY,kappaZ}}}}});
}
