import {createElementComponent} from '../core/elementComponent.js';
import {contactPairState,initialContactPairState,CONTACT_PAIR_CONTRACT} from './contactPair.js';

export const NODE_SURFACE_CONTACT_CONTRACT='node-surface-contact/v1';
const EPS=1e-12;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('NodeSurfaceContact: geometria degenerada.');return a.map(v=>v/n)};
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`NodeSurfaceContact: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`NodeSurfaceContact: ${name} deve ser positivo.`);return n};
const nodeById=(project,id)=>{const n=(project?.nodes||[]).find(r=>String(r.id)===String(id));if(!n)throw new Error(`NodeSurfaceContact: nó ${id} ausente.`);return n};
const p2=n=>[Number(n.x)||0,Number(n.y)||0];
const p3=n=>[Number(n.x)||0,Number(n.y)||0,Number(n.z)||0];
const zeros=(r,c=r)=>Array.from({length:r},()=>Array(c).fill(0));
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));

function contactLaw(element){const kn=positive('normalStiffness',element.normalStiffness??element.kn),mu=Math.max(0,finite('frictionCoefficient',element.frictionCoefficient??element.mu??0)),kt=mu>0?positive('tangentialStiffness',element.tangentialStiffness??element.kt??kn*.25):0;return{kn,kt,mu}}
function labels(dim){return dim===2?['ux','uy']:['ux','uy','uz']}
function blockB(weights,dim){const B=zeros(dim,weights.length*dim);for(let a=0;a<weights.length;a++)for(let i=0;i<dim;i++)B[i][a*dim+i]=weights[a];return B}
function dofs(ids,dim){return ids.flatMap(id=>labels(dim).map(label=>({owner:String(id),nodeId:String(id),label})))}
function makeResponse({u,B,normal,initialGap,law,committed,dimension,geometry}){const relative=mv(B,u),r=contactPairState({relative,normal,initialGap,kn:law.kn,kt:law.kt,mu:law.mu,committed,dimension}),Bt=transpose(B),internal=mv(Bt,r.force),tangent=mm(Bt,mm(r.Krel,B));return{tangent,residual:internal,internalForce:internal,externalForce:Array(internal.length).fill(0),state:r.state,outputs:{contract:CONTACT_PAIR_CONTRACT,active:r.state.active,branch:r.branch,gap:r.gap,penetration:r.penetration,normal:[...normal],normalForce:r.normalForce,normalCompression:Math.max(0,-r.normalForce),tangentialForce:[...r.tangentialForce],resultantForce:[...r.force],stick:r.stick,slip:r.slip,plasticSlip:[...r.state.plasticSlip],dissipatedEnergy:r.state.dissipatedEnergy,slipEvents:r.state.slipEvents,normalStiffness:law.kn,tangentialStiffness:law.kt,frictionCoefficient:law.mu,initialGap,...geometry}}}

export function createNodeSegmentContact2DComponent({element,project}={}){
  const slaveId=element?.slaveNode??element?.slave,masterIds=element?.masterNodes||[element?.m1,element?.m2];if(!element?.id||!slaveId||!Array.isArray(masterIds)||masterIds.length!==2||masterIds.some(x=>!x))throw new Error('NodeSegmentContact2D: id, slaveNode e dois masterNodes são obrigatórios.');const s=p2(nodeById(project,slaveId)),a=p2(nodeById(project,masterIds[0])),b=p2(nodeById(project,masterIds[1])),ab=sub(b,a),L2=dot(ab,ab);if(!(L2>EPS))throw new Error('NodeSegmentContact2D: segmento mestre degenerado.');let xi=dot(sub(s,a),ab)/L2;if(xi<-1e-9||xi>1+1e-9)throw new Error('NodeSegmentContact2D: projeção inicial do slave está fora do segmento mestre.');xi=Math.max(0,Math.min(1,xi));const proj=add(a,scale(ab,xi)),t=unit(ab);let n=[-t[1],t[0]],g0=dot(sub(s,proj),n);if(g0<0){n=scale(n,-1);g0=-g0}const initialGap=Math.max(0,Number.isFinite(Number(element.initialGap))?Number(element.initialGap):g0),weights=[-(1-xi),-xi,1],B=blockB(weights,2),law=contactLaw(element),ids=[...masterIds,slaveId];return createElementComponent({id:element.id,type:element.type||'contact-node-segment2d',dofs:dofs(ids,2),initialState:initialContactPairState(2),metadata:{contract:NODE_SURFACE_CONTACT_CONTRACT,family:'contact-node-segment',dimension:'2d',smallSliding:true,friction:law.mu>0},evaluate:({u,committedState})=>makeResponse({u,B,normal:n,initialGap,law,committed:committedState,dimension:2,geometry:{slaveNode:String(slaveId),masterNodes:masterIds.map(String),projectionCoordinate:xi,masterWeights:[1-xi,xi],initialProjection:proj}})});}

function barycentric(p,a,b,c){const v0=sub(b,a),v1=sub(c,a),v2=sub(p,a),d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),d20=dot(v2,v0),d21=dot(v2,v1),den=d00*d11-d01*d01;if(Math.abs(den)<EPS)throw new Error('NodeTriangleContact3D: triângulo mestre degenerado.');const v=(d11*d20-d01*d21)/den,w=(d00*d21-d01*d20)/den,u=1-v-w;return[u,v,w]}
export function createNodeTriangleContact3DComponent({element,project}={}){
  const slaveId=element?.slaveNode??element?.slave,masterIds=element?.masterNodes||[element?.m1,element?.m2,element?.m3];if(!element?.id||!slaveId||!Array.isArray(masterIds)||masterIds.length!==3||masterIds.some(x=>!x))throw new Error('NodeTriangleContact3D: id, slaveNode e três masterNodes são obrigatórios.');const s=p3(nodeById(project,slaveId)),a=p3(nodeById(project,masterIds[0])),b=p3(nodeById(project,masterIds[1])),c=p3(nodeById(project,masterIds[2])),n0=unit(cross(sub(b,a),sub(c,a))),dist=dot(sub(s,a),n0),proj=sub(s,scale(n0,dist)),N=barycentric(proj,a,b,c);if(N.some(v=>v<-1e-8||v>1+1e-8))throw new Error('NodeTriangleContact3D: projeção inicial do slave está fora do triângulo mestre.');let n=n0,g0=dist;if(g0<0){n=scale(n,-1);g0=-g0}const initialGap=Math.max(0,Number.isFinite(Number(element.initialGap))?Number(element.initialGap):g0),weights=[-N[0],-N[1],-N[2],1],B=blockB(weights,3),law=contactLaw(element),ids=[...masterIds,slaveId];return createElementComponent({id:element.id,type:element.type||'contact-node-triangle3d',dofs:dofs(ids,3),initialState:initialContactPairState(3),metadata:{contract:NODE_SURFACE_CONTACT_CONTRACT,family:'contact-node-triangle',dimension:'3d',smallSliding:true,friction:law.mu>0},evaluate:({u,committedState})=>makeResponse({u,B,normal:n,initialGap,law,committed:committedState,dimension:3,geometry:{slaveNode:String(slaveId),masterNodes:masterIds.map(String),masterWeights:N,initialProjection:proj}})});}
