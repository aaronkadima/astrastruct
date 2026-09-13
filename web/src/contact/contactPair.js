import {createElementComponent} from '../core/elementComponent.js';

export const CONTACT_PAIR_CONTRACT='contact-pair/v1';
const EPS=1e-14;
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const scale=(a,s)=>a.map(v=>v*s);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const outer=(a,b)=>a.map(x=>b.map(y=>x*y));
const zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
const matAdd=(A,B)=>A.map((r,i)=>r.map((v,j)=>v+B[i][j]));
const matScale=(A,s)=>A.map(r=>r.map(v=>v*s));
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`ContactPair: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`ContactPair: ${name} deve ser positivo.`);return n};

export function initialContactPairState(dimension=2){return{active:false,branch:'open',plasticSlip:Array(dimension).fill(0),lastGap:null,lastNormalForce:0,lastTangentialForce:Array(dimension).fill(0),dissipatedEnergy:0,slipEvents:0}}
function unitNormal(element,project,dimension){
  const raw=Array.from(element?.normal||[],Number);if(raw.length===dimension&&raw.every(Number.isFinite)){const n=norm(raw);if(n>EPS)return raw.map(v=>v/n)}
  const a=(project?.nodes||[]).find(n=>String(n.id)===String(element?.n1)),b=(project?.nodes||[]).find(n=>String(n.id)===String(element?.n2));if(a&&b){const d=dimension===2?[Number(b.x)-Number(a.x),Number(b.y)-Number(a.y)]:[Number(b.x)-Number(a.x),Number(b.y)-Number(a.y),Number(b.z||0)-Number(a.z||0)],n=norm(d);if(n>EPS)return d.map(v=>v/n)}
  throw new Error(`ContactPair ${element?.id||'(sem id)'}: forneça normal ${dimension}D ou nós geometricamente distintos.`);
}
function projector(n){const I=identity(n.length),nn=outer(n,n);return I.map((r,i)=>r.map((v,j)=>v-nn[i][j]))}
function matVec(A,x){return A.map(r=>dot(r,x))}
function blockPair(Krel){const n=Krel.length,K=zeros(2*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=Krel[i][j];K[i][j]+=v;K[i][n+j]-=v;K[n+i][j]-=v;K[n+i][n+j]+=v}return K}

function evaluateContact({relative,normal,initialGap,kn,kt,mu,committed,dimension}){
  const gap=initialGap+dot(relative,normal),pCommitted=Array.from(committed?.plasticSlip||Array(dimension).fill(0),Number),base={...initialContactPairState(dimension),...(committed||{}),plasticSlip:pCommitted};
  if(gap>=0){return{gap,penetration:0,force:Array(dimension).fill(0),normalForce:0,tangentialForce:Array(dimension).fill(0),Krel:zeros(dimension),state:{...clone(base),active:false,branch:'open',lastGap:gap,lastNormalForce:0,lastTangentialForce:Array(dimension).fill(0)},branch:'open',stick:false,slip:false}}
  const penetration=-gap,qn=kn*gap,P=projector(normal),dt=matVec(P,relative),pProj=matVec(P,pCommitted),elasticSlip=sub(dt,pProj),trial=scale(elasticSlip,kt),trialNorm=norm(trial),limit=Math.max(0,mu*(-qn)),Knormal=matScale(outer(normal,normal),kn);let qt=Array(dimension).fill(0),Krel=Knormal,pNew=[...pCommitted],branch=mu>0?'stick':'frictionless',stick=mu>0,slip=false,energy=Number(base.dissipatedEnergy)||0,slipEvents=Number(base.slipEvents)||0;
  if(mu>0&&kt>0){
    if(trialNorm<=limit+1e-12*Math.max(1,limit)){qt=trial;Krel=matAdd(Knormal,matScale(P,kt));branch='stick'}
    else if(trialNorm>EPS){const dir=trial.map(v=>v/trialNorm);qt=scale(dir,limit);pNew=sub(dt,scale(qt,1/kt));const tangential=matScale(matAdd(P,matScale(outer(dir,dir),-1)),limit*kt/trialNorm),coupling=matScale(outer(dir,normal),-mu*kn);Krel=matAdd(Knormal,matAdd(tangential,coupling));const dp=sub(pNew,pCommitted);energy+=limit*norm(dp);slipEvents+=1;branch='slip';stick=false;slip=true}
  }
  const fn=scale(normal,qn),force=add(fn,qt),state={...clone(base),active:true,branch,plasticSlip:pNew,lastGap:gap,lastNormalForce:qn,lastTangentialForce:[...qt],dissipatedEnergy:energy,slipEvents};
  return{gap,penetration,force,normalForce:qn,tangentialForce:qt,Krel,state,branch,stick,slip};
}

function createContactPairComponent({element,project,dimension}){
  if(!element?.id||!element?.n1||!element?.n2)throw new Error(`ContactPair${dimension}D: id, n1 e n2 são obrigatórios.`);const labels=dimension===2?['ux','uy']:['ux','uy','uz'],normal=unitNormal(element,project,dimension),initialGap=Math.max(0,finite('initialGap',element.initialGap??element.gap??0)),kn=positive('normalStiffness',element.normalStiffness??element.kn),mu=Math.max(0,finite('frictionCoefficient',element.frictionCoefficient??element.mu??0)),kt=mu>0?positive('tangentialStiffness',element.tangentialStiffness??element.kt??kn*.25):0,dofs=[element.n1,element.n2].flatMap(nodeId=>labels.map(label=>({owner:String(nodeId),nodeId:String(nodeId),label}))),initialState=initialContactPairState(dimension);
  return createElementComponent({id:element.id,type:element.type||`contact${dimension}d`,dofs,initialState,metadata:{contract:CONTACT_PAIR_CONTRACT,family:'contact-pair',dimension:`${dimension}d`,smallSliding:true,friction:mu>0},evaluate:({u,committedState})=>{const ua=u.slice(0,dimension),ub=u.slice(dimension),relative=sub(ub,ua),r=evaluateContact({relative,normal,initialGap,kn,kt,mu,committed:committedState,dimension}),internal=[...scale(r.force,-1),...r.force];return{tangent:blockPair(r.Krel),residual:internal,internalForce:internal,externalForce:Array(2*dimension).fill(0),state:r.state,outputs:{gap:r.gap,penetration:r.penetration,active:r.state.active,branch:r.branch,normal:[...normal],normalForce:r.normalForce,normalCompression:Math.max(0,-r.normalForce),tangentialForce:[...r.tangentialForce],resultantForce:[...r.force],stick:r.stick,slip:r.slip,plasticSlip:[...r.state.plasticSlip],dissipatedEnergy:r.state.dissipatedEnergy,slipEvents:r.state.slipEvents,normalStiffness:kn,tangentialStiffness:kt,frictionCoefficient:mu,initialGap}}}});
}

export const createContactPair2DComponent=args=>createContactPairComponent({...args,dimension:2});
export const createContactPair3DComponent=args=>createContactPairComponent({...args,dimension:3});
export {evaluateContact as contactPairState};
