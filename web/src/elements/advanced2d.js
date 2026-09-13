import {createElementComponent} from '../core/elementComponent.js';

export const ADVANCED_ELEMENT_LIBRARY_CONTRACT='advanced-elements/v1';

const EPS=1e-12;
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`AdvancedElement: ${name} deve ser finito.`);return n};
const positive=(name,value)=>{const n=finite(name,value);if(!(n>0))throw new Error(`AdvancedElement: ${name} deve ser positivo.`);return n};
const zeros=(n,m=n)=>Array.from({length:n},()=>Array(m).fill(0));
const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
const matMul=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
const matVec=(A,x)=>A.map(row=>row.reduce((s,v,j)=>s+v*x[j],0));
const quadTransform=(K,T)=>matMul(transpose(T),matMul(K,T));
const outer=(a,b)=>a.map(x=>b.map(y=>x*y));
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
const subtract=(A,B)=>A.map((row,i)=>row.map((v,j)=>v-B[i][j]));
const scaleMatrix=(A,s)=>A.map(row=>row.map(v=>v*s));
const addMatrix=(A,B)=>A.map((row,i)=>row.map((v,j)=>v+B[i][j]));

function node(project,id,elementId){const value=(project?.nodes||[]).find(row=>String(row.id)===String(id));if(!value)throw new Error(`AdvancedElement ${elementId}: nó ${id} não encontrado.`);return value}
function material(project,id,elementId){const value=(project?.materials||[]).find(row=>String(row.id)===String(id));if(!value)throw new Error(`AdvancedElement ${elementId}: material ${id} não encontrado.`);return value}
function geometry2d(project,element){const a=node(project,element.n1,element.id),b=node(project,element.n2,element.id),dx=finite('dx',b.x)-finite('x1',a.x),dy=finite('dy',b.y)-finite('y1',a.y),L=Math.hypot(dx,dy);if(!(L>EPS))throw new Error(`AdvancedElement ${element.id}: comprimento nulo.`);return{a,b,L,c:dx/L,s:dy/L}}
function dofs2d(element,labels){return[element.n1,element.n2].flatMap(nodeId=>labels.map(label=>({owner:String(nodeId),nodeId:String(nodeId),label})))}

export function timoshenkoLocalStiffness2D({E,G,A,I,shearArea=A,shearCorrection=1,L}={}){
  E=positive('E',E);G=positive('G',G);A=positive('A',A);I=positive('I',I);shearArea=positive('shearArea',shearArea);shearCorrection=positive('shearCorrection',shearCorrection);L=positive('L',L);
  const phi=12*E*I/(shearCorrection*G*shearArea*L*L),den=1+phi,EA=E*A/L,k1=12*E*I/(den*L**3),k2=6*E*I/(den*L**2),k3=(4+phi)*E*I/(den*L),k4=(2-phi)*E*I/(den*L),K=zeros(6);
  K[0][0]=EA;K[0][3]=-EA;K[3][0]=-EA;K[3][3]=EA;
  const ids=[1,2,4,5],B=[[k1,k2,-k1,k2],[k2,k3,-k2,k4],[-k1,-k2,k1,-k2],[k2,k4,-k2,k3]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)K[ids[i]][ids[j]]=B[i][j];
  return{K,phi,L,flexuralShearParameter:phi};
}

export function frameTransform2D(c,s){return[[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]]}

/** R maps nodal local DOFs to deformable-end DOFs through rigid arms. */
export function rigidOffsetTransform2D({offsetI={x:0,y:0},offsetJ={x:0,y:0}}={}){
  const xi=finite('offsetI.x',offsetI?.x??0),yi=finite('offsetI.y',offsetI?.y??0),xj=finite('offsetJ.x',offsetJ?.x??0),yj=finite('offsetJ.y',offsetJ?.y??0),R=identity(6);
  R[0][2]=-yi;R[1][2]=xi;R[3][5]=-yj;R[4][5]=xj;return R;
}

export function createTimoshenkoFrame2DComponent({element,project}){
  if(!project)throw new Error(`AdvancedElement ${element?.id||'(sem id)'}: project obrigatório.`);const g=geometry2d(project,element),m=material(project,element.materialId,element.id),E=positive('E',m.E),nu=Number.isFinite(Number(m.nu))?Number(m.nu):.3,G=positive('G',element.G??m.G??E/(2*(1+nu))),A=positive('A',element.A),I=positive('I',element.I),shearArea=positive('shearArea',element.shearArea??A),kappa=positive('shearCorrection',element.shearCorrection??5/6),rzi=Math.max(0,finite('rigidZoneI',element.rigidZoneI??0)),rzj=Math.max(0,finite('rigidZoneJ',element.rigidZoneJ??0)),rawI=element.offsetI||{},rawJ=element.offsetJ||{},offsetI={x:finite('offsetI.x',rawI.x??0)+rzi,y:finite('offsetI.y',rawI.y??0)},offsetJ={x:finite('offsetJ.x',rawJ.x??0)-rzj,y:finite('offsetJ.y',rawJ.y??0)},Lf=g.L+offsetJ.x-offsetI.x;
  if(!(Lf>EPS))throw new Error(`AdvancedElement ${element.id}: zonas rígidas/offsets eliminam o comprimento deformável.`);
  const local=timoshenkoLocalStiffness2D({E,G,A,I,shearArea,shearCorrection:kappa,L:Lf}),R=rigidOffsetTransform2D({offsetI,offsetJ}),T=frameTransform2D(g.c,g.s),RT=matMul(R,T),Kg=quadTransform(local.K,RT);
  return createElementComponent({id:element.id,type:element.type,dofs:dofs2d(element,['ux','uy','rz']),metadata:{dimension:'2d',family:'frame-timoshenko',linear:true,offsets:true},evaluate:({u})=>{const internalForce=matVec(Kg,u);return{tangent:Kg,residual:[...internalForce],internalForce,externalForce:Array(6).fill(0),outputs:{L:g.L,deformableLength:Lf,phi:local.phi,offsetI,offsetJ,G,shearArea,shearCorrection:kappa}}}});
}

function cableKernel({x1,y1,x2,y2,u,EA,L0,pretension=0,compressionStiffnessRatio=0}){
  const X=[x2-x1+u[2]-u[0],y2-y1+u[3]-u[1]],l=Math.hypot(...X);if(!(l>EPS))throw new Error('Cable2D: comprimento atual degenerado.');const n=X.map(v=>v/l),strain=(l-L0)/L0,Ntrial=EA*strain+pretension,taut=Ntrial>0,N=taut?Ntrial:compressionStiffnessRatio*EA*strain,dNdl=(taut?EA:compressionStiffnessRatio*EA)/L0,I=identity(2),nn=outer(n,n),A=addMatrix(scaleMatrix(nn,dNdl),scaleMatrix(subtract(I,nn),N/l)),K=zeros(4);
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){K[i][j]=A[i][j];K[i][j+2]=-A[i][j];K[i+2][j]=-A[i][j];K[i+2][j+2]=A[i][j]}
  const f=[-N*n[0],-N*n[1],N*n[0],N*n[1]];return{K,f,N,l,strain,taut,n};
}

export function createCable2DComponent({element,project}){
  const g=geometry2d(project,element),m=material(project,element.materialId,element.id),E=positive('E',m.E),A=positive('A',element.A),EA=E*A,L0=positive('unstressedLength',element.unstressedLength??g.L),pretension=finite('pretension',element.pretension??0),compressionStiffnessRatio=Math.max(0,finite('compressionStiffnessRatio',element.compressionStiffnessRatio??0));
  return createElementComponent({id:element.id,type:element.type,dofs:dofs2d(element,['ux','uy']),initialState:{taut:pretension>0,lastAxialForce:pretension},metadata:{dimension:'2d',family:'cable',geometricNonlinear:true,tensionOnly:compressionStiffnessRatio===0},evaluate:({u})=>{const r=cableKernel({x1:Number(g.a.x),y1:Number(g.a.y),x2:Number(g.b.x),y2:Number(g.b.y),u,EA,L0,pretension,compressionStiffnessRatio});return{tangent:r.K,residual:[...r.f],internalForce:[...r.f],externalForce:Array(4).fill(0),state:{taut:r.taut,lastAxialForce:r.N,lastLength:r.l},outputs:{axialForce:r.N,currentLength:r.l,unstressedLength:L0,strain:r.strain,taut:r.taut,direction:r.n}}}});
}

export function bilinearLinkState({deformation,k0,yieldForce,postYieldRatio=0,committed={}}={}){
  const d=finite('deformation',deformation),k=positive('k0',k0),Fy=Math.abs(positive('yieldForce',yieldForce)),b=Math.max(0,Math.min(.999999,finite('postYieldRatio',postYieldRatio))),c={plasticDeformation:0,backForce:0,cumulativePlastic:0,...(committed||{})},p=finite('plasticDeformation',c.plasticDeformation),back=finite('backForce',c.backForce),cum=finite('cumulativePlastic',c.cumulativePlastic),H=b<=EPS?0:k*b/(1-b),trial=k*(d-p),xi=trial-back,f=Math.abs(xi)-Fy;
  if(f<=1e-12*Math.max(1,Fy,Math.abs(trial)))return{force:trial,tangent:k,yielded:false,state:{plasticDeformation:p,backForce:back,cumulativePlastic:cum,lastDeformation:d,lastForce:trial}};
  const sign=xi<0?-1:1,dGamma=f/(k+H),plasticDeformation=p+dGamma*sign,backForce=back+H*dGamma*sign,force=trial-k*dGamma*sign,tangent=H>0?k*H/(k+H):0;return{force,tangent,yielded:true,state:{plasticDeformation,backForce,cumulativePlastic:cum+dGamma,lastDeformation:d,lastForce:force}};
}

export function createNonlinearLink1DComponent({element}){
  const label=String(element.dofLabel||'ux'),gap=Math.max(0,finite('gap',element.gap??0)),k0=positive('k0',element.k0),yieldForce=positive('yieldForce',element.yieldForce),postYieldRatio=finite('postYieldRatio',element.postYieldRatio??0),dofs=[{owner:String(element.n1),nodeId:String(element.n1),label},{owner:String(element.n2),nodeId:String(element.n2),label}];
  return createElementComponent({id:element.id,type:element.type,dofs,initialState:{plasticDeformation:0,backForce:0,cumulativePlastic:0,lastDeformation:0,lastForce:0},metadata:{family:'nonlinear-link',nonlinear:true,dofLabel:label},evaluate:({u,committedState})=>{const relative=u[1]-u[0],active=Math.abs(relative)>gap,effective=active?Math.sign(relative)*(Math.abs(relative)-gap):0;if(!active){const force=0,tangent=0;return{tangent:[[tangent,-tangent],[-tangent,tangent]],residual:[-force,force],internalForce:[-force,force],externalForce:[0,0],state:{...committedState,lastDeformation:relative,lastForce:0},outputs:{relativeDeformation:relative,effectiveDeformation:0,force:0,tangent:0,yielded:false,gapActive:true}}}const state=bilinearLinkState({deformation:effective,k0,yieldForce,postYieldRatio,committed:committedState}),kt=state.tangent,F=state.force;return{tangent:[[kt,-kt],[-kt,kt]],residual:[-F,F],internalForce:[-F,F],externalForce:[0,0],state:state.state,outputs:{relativeDeformation:relative,effectiveDeformation:effective,force:F,tangent:kt,yielded:state.yielded,gapActive:false}}}});
}
