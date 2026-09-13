export const CONNECTION_OBJECT_CONTRACT='connection-object/v1';

const EPS=1e-12;
const finite=(name,v,f=0)=>{const n=Number(v??f);if(!Number.isFinite(n))throw new Error(`ConnectionObject: ${name} deve ser finito.`);return n};
const positive=(name,v,f)=>{const n=finite(name,v,f);if(!(n>0))throw new Error(`ConnectionObject: ${name} deve ser positivo.`);return n};
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const zeros=(n,m=n)=>Array.from({length:n},()=>Array(m).fill(0));
const norm=v=>Math.hypot(...v);

function addVector(target,source){for(let i=0;i<target.length;i++)target[i]+=source[i]}
function addMatrix(target,source){for(let i=0;i<target.length;i++)for(let j=0;j<target[i].length;j++)target[i][j]+=source[i][j]}
function outer(v,w=v){return v.map(a=>w.map(b=>a*b))}
function scaled(v,s){return v.map(x=>x*s)}
function addRankOne(K,g,k){const O=outer(g);for(let i=0;i<K.length;i++)for(let j=0;j<K.length;j++)K[i][j]+=k*O[i][j]}

function scalarBilinear(extension,m){
  const k=positive('stiffness',m.stiffness),fy=Math.max(0,finite('yieldForce',m.yieldForce,0)),h=Math.max(0,finite('postYieldRatio',m.postYieldRatio,0));
  if(!(extension>0))return{force:0,tangent:0,branch:'slack'};
  if(!(fy>0)||k*extension<=fy)return{force:k*extension,tangent:k,branch:'elastic'};
  const ey=fy/k;return{force:fy+h*k*(extension-ey),tangent:h*k,branch:h>EPS?'postyield':'capped'};
}

function anchorLaw(extension,a){
  if(!(extension>0))return{force:0,tangent:0,branch:'slack'};
  const ks=positive('anchor.steelStiffness',a.steelStiffness),kb=positive('anchor.bondStiffness',a.bondStiffness),kc=positive('anchor.concreteStiffness',a.concreteStiffness),k=1/(1/ks+1/kb+1/kc),steel=Math.min(positive('anchor.steelYield',a.steelYield),positive('anchor.steelUltimate',a.steelUltimate??a.steelYield)),bond=positive('anchor.bondPeak',a.bondPeak),concrete=positive('anchor.concretePeak',a.concretePeak)*Math.max(0,Math.min(1,finite('anchor.edgeFactor',a.edgeFactor,1))),peak=Math.min(steel,bond,concrete),ep=peak/k;
  if(extension<=ep)return{force:k*extension,tangent:k,branch:'pre-peak',equivalentStiffness:k,peakForce:peak,capacities:{steel,bond,concrete}};
  const residualRatio=Math.max(0,Math.min(1,finite('anchor.postPeakResidualRatio',a.postPeakResidualRatio,.15))),soft=positive('anchor.softeningDisplacement',a.softeningDisplacement,.004),residual=peak*residualRatio,x=extension-ep,decay=Math.exp(-x/soft),force=residual+(peak-residual)*decay,tangent=-(peak-residual)/soft*decay;
  return{force,tangent,branch:'post-peak',equivalentStiffness:k,peakForce:peak,capacities:{steel,bond,concrete}};
}

function pointNormalGradient(x,y){return[0,0,1,y,-x,0]}

function tensionRow(q,m,previous={}){
  const x=finite('tension-row.x',m.x),y=finite('tension-row.y',m.y),g=pointNormalGradient(x,y),extension=g.reduce((s,v,i)=>s+v*q[i],0),law=scalarBilinear(extension,m),force=scaled(g,law.force),K=zeros(6);addRankOne(K,g,law.tangent);
  const state={maxOpening:Math.max(Number(previous.maxOpening)||0,extension),yielded:!!previous.yielded||law.branch==='postyield'||law.branch==='capped',lastOpening:extension,lastForce:law.force};
  return{force,tangent:K,state,output:{id:m.id,type:m.type,point:{x,y},extension,axialForce:law.force,branch:law.branch,yielded:state.yielded}};
}

function compressionRow(q,m,previous={}){
  const x=finite('compression-row.x',m.x),y=finite('compression-row.y',m.y),g=pointNormalGradient(x,y),gap=Math.max(0,finite('compression-row.gap',m.gap,0)),extension=g.reduce((s,v,i)=>s+v*q[i],0),penetration=Math.max(0,-extension-gap),k=positive('compression-row.stiffness',m.stiffness),scalar=penetration>0?-k*penetration:0,kt=penetration>0?k:0,force=scaled(g,scalar),K=zeros(6);addRankOne(K,g,kt);
  const state={maxPenetration:Math.max(Number(previous.maxPenetration)||0,penetration),everActive:!!previous.everActive||penetration>0,lastPenetration:penetration,lastForce:scalar};
  return{force,tangent:K,state,output:{id:m.id,type:m.type,point:{x,y},extension,penetration,normalForce:scalar,active:penetration>0}};
}

function anchorGroup(q,m,previous={}){
  const force=Array(6).fill(0),K=zeros(6),states={},anchors=[];
  for(let i=0;i<(m.anchors||[]).length;i++){
    const a={...m.defaults,...m.anchors[i]},id=String(a.id||`A${i+1}`),x=finite(`${id}.x`,a.x),y=finite(`${id}.y`,a.y),g=pointNormalGradient(x,y),extension=g.reduce((s,v,j)=>s+v*q[j],0),law=anchorLaw(extension,a),f=scaled(g,law.force);addVector(force,f);addRankOne(K,g,law.tangent);
    const old=previous.anchors?.[id]||{},state={maxOpening:Math.max(Number(old.maxOpening)||0,extension),everPostPeak:!!old.everPostPeak||law.branch==='post-peak',lastOpening:extension,lastForce:law.force};states[id]=state;anchors.push({id,x,y,extension,tension:law.force,branch:law.branch,everPostPeak:state.everPostPeak,equivalentStiffness:law.equivalentStiffness,peakForce:law.peakForce,capacities:law.capacities});
  }
  for(let i=0;i<(m.compressionPoints||[]).length;i++){
    const p=m.compressionPoints[i],id=String(p.id||`C${i+1}`),r=compressionRow(q,{...p,id,type:'compression-row',stiffness:p.stiffness??m.compressionStiffness},previous.compression?.[id]||{});addVector(force,r.force);addMatrix(K,r.tangent);states[`compression:${id}`]=r.state;anchors.push({...r.output,role:'compression'});
  }
  return{force,tangent:K,state:{anchors:states},output:{id:m.id,type:m.type,anchors,activeAnchors:anchors.filter(a=>a.tension>0).length,totalTension:anchors.reduce((s,a)=>s+(a.tension||0),0)}};
}

function boltForceAt(q,m){
  const [ux,uy,,, ,rz]=q,force=Array(6).fill(0),items=[];
  for(let i=0;i<(m.bolts||[]).length;i++){
    const b={...m.defaults,...m.bolts[i]},id=String(b.id||`B${i+1}`),x=finite(`${id}.x`,b.x),y=finite(`${id}.y`,b.y),dx=ux-rz*y,dy=uy+rz*x,r=Math.hypot(dx,dy),nx=r>EPS?dx/r:0,ny=r>EPS?dy/r:0,mu=Math.max(0,finite(`${id}.mu`,b.mu,.3)),preload=Math.max(0,finite(`${id}.preload`,b.preload,0)),planes=Math.max(1,finite(`${id}.slipPlanes`,b.slipPlanes,1)),holeFactor=Math.max(0,finite(`${id}.holeFactor`,b.holeFactor,1)),ks=positive(`${id}.slipStiffness`,b.slipStiffness,8e5),cap=mu*preload*planes*holeFactor,friction=cap>0?Math.min(ks*r,cap):0,slipped=cap>0&&ks*r>=cap-EPS,gap=Math.max(0,finite(`${id}.gap`,b.gap,0)),penetration=Math.max(0,r-gap),kb=positive(`${id}.bearingStiffness`,b.bearingStiffness,2.5e5),fy=Math.max(0,finite(`${id}.bearingYieldForce`,b.bearingYieldForce,0)),h=Math.max(0,finite(`${id}.postYieldRatio`,b.postYieldRatio,.02));let bearing=0,bearingBranch='gap';
    if(penetration>0){if(!(fy>0)||kb*penetration<=fy){bearing=kb*penetration;bearingBranch='bearing-elastic'}else{const py=fy/kb;bearing=fy+h*kb*(penetration-py);bearingBranch=h>EPS?'bearing-postyield':'bearing-capped'}}
    const F=friction+bearing,fx=F*nx,fyv=F*ny,mz=-y*fx+x*fyv;force[0]+=fx;force[1]+=fyv;force[5]+=mz;items.push({id,x,y,relativeDisplacement:{x:dx,y:dy,magnitude:r},frictionForce:friction,slipResistance:cap,slipped,gap,penetration,bearingForce:bearing,bearingActive:bearing>0,bearingBranch,force:{fx,fy:fyv,magnitude:F,moment:mz}});
  }
  return{force,items};
}

function boltGroup(q,m,previous={}){
  const base=boltForceAt(q,m),K=zeros(6),active=[0,1,5];
  for(const j of active){const h=Math.max(1e-9,1e-7*Math.max(1,Math.abs(q[j]))),qp=[...q],qm=[...q];qp[j]+=h;qm[j]-=h;const fp=boltForceAt(qp,m).force,fm=boltForceAt(qm,m).force;for(const i of active)K[i][j]=(fp[i]-fm[i])/(2*h)}
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const v=.5*(K[i][j]+K[j][i]);K[i][j]=v;K[j][i]=v}
  const state={bolts:{}};for(const item of base.items){const old=previous.bolts?.[item.id]||{};state.bolts[item.id]={maxSlip:Math.max(Number(old.maxSlip)||0,item.relativeDisplacement.magnitude),everSlipped:!!old.everSlipped||item.slipped,everBearing:!!old.everBearing||item.bearingActive}}
  return{force:base.force,tangent:K,state,output:{id:m.id,type:m.type,bolts:base.items,slippedBolts:base.items.filter(b=>b.slipped).length,bearingBolts:base.items.filter(b=>b.bearingActive).length}};
}

function spring6(q,m,previous={}){
  const force=Array(6).fill(0),K=zeros(6),k=Array.isArray(m.stiffness)?m.stiffness:Array(6).fill(Number(m.stiffness)||0);for(let i=0;i<6;i++){const ki=Math.max(0,finite(`spring6.k${i}`,k[i],0));force[i]=ki*q[i];K[i][i]=ki}return{force,tangent:K,state:{lastDeformation:[...q]},output:{id:m.id,type:m.type,force:[...force]}};
}

export function initialConnectionObjectState(){return{mechanisms:{},revision:0}}

export function evaluateConnectionObject({connection,deformation,committedState=null}={}){
  if(!connection||typeof connection!=='object')throw new Error('ConnectionObject: connection ausente.');const q=Array.from(deformation||[],Number);if(q.length!==6||q.some(v=>!Number.isFinite(v)))throw new Error('ConnectionObject: deformation deve conter [ux,uy,uz,rx,ry,rz].');
  const force=Array(6).fill(0),K=zeros(6),outputs=[],next={...initialConnectionObjectState(),...(clone(committedState||{})),mechanisms:{...(clone(committedState?.mechanisms||{}))}};
  for(let i=0;i<(connection.mechanisms||[]).length;i++){
    const m=connection.mechanisms[i],id=String(m.id||`M${i+1}`),type=String(m.type||''),old=next.mechanisms[id]||{};let r;
    if(type==='tension-row')r=tensionRow(q,{...m,id},old);else if(type==='compression-row')r=compressionRow(q,{...m,id},old);else if(type==='anchor-group')r=anchorGroup(q,{...m,id},old);else if(type==='bolt-group-slip-bearing')r=boltGroup(q,{...m,id},old);else if(type==='spring6')r=spring6(q,{...m,id},old);else throw new Error(`ConnectionObject: mecanismo não suportado: ${type||'(ausente)'}.`);
    addVector(force,r.force);addMatrix(K,r.tangent);next.mechanisms[id]=r.state;outputs.push(r.output);
  }
  next.revision=(Number(committedState?.revision)||0)+1;next.lastDeformation=[...q];next.lastWrench=[...force];
  return{contract:CONNECTION_OBJECT_CONTRACT,id:String(connection.id||''),deformation:q,wrench:force,tangent:K,state:next,mechanisms:outputs,equilibrium:{localWrenchNorm:norm(force)}};
}
