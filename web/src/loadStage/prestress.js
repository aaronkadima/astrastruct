export const PRESTRESS_ACTION_CONTRACT='prestress-action/v1';
const finite=(name,v,f=0)=>{const n=Number(v??f);if(!Number.isFinite(n))throw new Error(`PrestressAction: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`PrestressAction: ${name} deve ser positivo.`);return n};
const factor=v=>Math.max(0,Math.min(1,finite('effectiveFactor',v,1)));

export function prestressInitialState2D({force,eccentricity=0,effectiveFactor=1,E,A,I}={}){
  const P=Math.max(0,finite('force',force))*factor(effectiveFactor),e=finite('eccentricity',eccentricity),Em=positive('E',E),area=positive('A',A),inertia=positive('I',I),eps0=-P/(Em*area),kappa0=P*e/(Em*inertia),N0=Em*area*eps0,M0=Em*inertia*kappa0;
  return{contract:PRESTRESS_ACTION_CONTRACT,dimension:'2d',effectiveForce:P,eccentricity:e,effectiveFactor:factor(effectiveFactor),eps0,kappa0,N0,M0,equivalentLocal:[-N0,0,-M0,N0,0,M0]};
}

export function prestressInitialState3D({force,eccentricityY=0,eccentricityZ=0,effectiveFactor=1,E,A,Iy,Iz}={}){
  const P=Math.max(0,finite('force',force))*factor(effectiveFactor),ey=finite('eccentricityY',eccentricityY),ez=finite('eccentricityZ',eccentricityZ),Em=positive('E',E),area=positive('A',A),iy=positive('Iy',Iy),iz=positive('Iz',Iz),eps0=-P/(Em*area),My=P*ez,Mz=-P*ey,kappaY=My/(Em*iy),kappaZ=Mz/(Em*iz),N0=Em*area*eps0;
  return{contract:PRESTRESS_ACTION_CONTRACT,dimension:'3d',effectiveForce:P,eccentricityY:ey,eccentricityZ:ez,effectiveFactor:factor(effectiveFactor),eps0,kappaY,kappaZ,N0,My,Mz,equivalentLocal:[-N0,0,0,0,-My,-Mz,N0,0,0,0,My,Mz]};
}

export function prestressElementLoad({id,elementId,force,eccentricity=0,eccentricityY=0,eccentricityZ=0,effectiveFactor=1,caseId=null,actionId=null}={}){
  if(!elementId)throw new Error('PrestressAction: elementId é obrigatório.');return{id:id||`prestress_${elementId}`,kind:'prestress',elementId:String(elementId),force:Math.max(0,finite('force',force)),eccentricity:finite('eccentricity',eccentricity),eccentricityY:finite('eccentricityY',eccentricityY),eccentricityZ:finite('eccentricityZ',eccentricityZ),effectiveFactor:factor(effectiveFactor),caseId,actionId,contract:PRESTRESS_ACTION_CONTRACT};
}
