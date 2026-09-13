import { zeros, solveConstrained, mul } from './matrix.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));

function activeDefinitions(project){return(project.diaphragms||[]).filter(d=>d&&d.enabled!==false&&d.rigid!==false)}
function nodesForDefinition(def,nodes){
  const ids=Array.isArray(def.nodeIds)&&def.nodeIds.length?new Set(def.nodeIds.map(String)):null;
  return nodes.filter(n=>ids?ids.has(String(n.id)):(def.levelId!=null&&String(n.levelId)===String(def.levelId)));
}
function masterFor(def,group){
  if(def.masterNodeId){const found=group.find(n=>String(n.id)===String(def.masterNodeId));if(!found)throw new Error(`Diafragma ${def.id||''}: nó mestre ${def.masterNodeId} não pertence ao grupo.`);return found}
  const cx=group.reduce((s,n)=>s+finite(n.x),0)/group.length,cy=group.reduce((s,n)=>s+finite(n.y),0)/group.length;
  return group.reduce((best,n)=>!best||Math.hypot(finite(n.x)-cx,finite(n.y)-cy)<Math.hypot(finite(best.x)-cx,finite(best.y)-cy)?n:best,null);
}

/**
 * Builds the exact linear kinematic transformation for rigid XY diaphragms.
 * For each slave i relative to master m:
 *   ux_i = ux_m - (y_i-y_m) rz_m
 *   uy_i = uy_m + (x_i-x_m) rz_m
 *   rz_i = rz_m
 * while uz/rx/ry remain independent. No penalty stiffness is introduced.
 */
export function buildRigidDiaphragmTransform3D(project,nodes,{tolerance=1e-6}={}){
  const defs=activeDefinitions(project),nd=6*nodes.length;if(!defs.length){const T=zeros(nd);for(let i=0;i<nd;i++)T[i][i]=1;return{active:false,T,retained:Array.from({length:nd},(_,i)=>i),eliminated:new Set(),groups:[],fullToReduced:new Map(Array.from({length:nd},(_,i)=>[i,i]))}}
  const nodeMap=new Map(nodes.map((n,i)=>[String(n.id),{node:n,index:i}])),claimed=new Set(),groups=[],eliminated=new Set(),tol=Math.max(1e-9,Math.abs(finite(tolerance,1e-6)));
  for(let k=0;k<defs.length;k++){
    const def=defs[k];if((def.plane||'xy').toLowerCase()!=='xy')throw new Error(`Diafragma ${def.id||k+1}: somente o plano XY é suportado nesta versão.`);
    const group=nodesForDefinition(def,nodes);if(group.length<2)throw new Error(`Diafragma ${def.id||k+1}: são necessários pelo menos dois nós.`);
    const zs=group.map(n=>finite(n.z));if(Math.max(...zs)-Math.min(...zs)>tol)throw new Error(`Diafragma ${def.id||k+1}: nós não são coplanares em Z dentro da tolerância ${tol}.`);
    for(const n of group){const id=String(n.id);if(claimed.has(id))throw new Error(`Nó ${id} pertence a mais de um diafragma rígido.`);claimed.add(id)}
    const master=masterFor(def,group),masterInfo=nodeMap.get(String(master.id)),slaves=group.filter(n=>String(n.id)!==String(master.id));
    for(const n of slaves){const info=nodeMap.get(String(n.id));for(const d of [0,1,5])eliminated.add(6*info.index+d)}
    groups.push({id:String(def.id||`D${k+1}`),levelId:def.levelId??null,masterNodeId:String(master.id),masterIndex:masterInfo.index,nodeIds:group.map(n=>String(n.id)),slaveIds:slaves.map(n=>String(n.id)),z:zs.reduce((s,v)=>s+v,0)/zs.length});
  }
  const retained=Array.from({length:nd},(_,i)=>i).filter(i=>!eliminated.has(i)),fullToReduced=new Map(retained.map((d,i)=>[d,i])),T=zeros(nd,retained.length);
  for(const d of retained)T[d][fullToReduced.get(d)]=1;
  for(const g of groups){const m=nodes[g.masterIndex],mux=fullToReduced.get(6*g.masterIndex),muy=fullToReduced.get(6*g.masterIndex+1),mrz=fullToReduced.get(6*g.masterIndex+5);if(mux==null||muy==null||mrz==null)throw new Error(`Diafragma ${g.id}: DOFs mestres inválidos.`);
    for(const id of g.slaveIds){const s=nodeMap.get(id),dx=finite(s.node.x)-finite(m.x),dy=finite(s.node.y)-finite(m.y),o=6*s.index;T[o][mux]=1;T[o][mrz]=-dy;T[o+1][muy]=1;T[o+1][mrz]=dx;T[o+5][mrz]=1}
  }
  return{active:true,T,retained,eliminated,groups,fullToReduced};
}

function reducePrescribed(prescribed,transform){
  const out=new Map();for(const [d,value] of prescribed||new Map()){
    if(transform.eliminated.has(d))throw new Error(`Diafragma rígido: apoio/deslocamento prescrito no DOF escravo ${d} exige formulação MPC geral e não é permitido nesta versão.`);
    const r=transform.fullToReduced.get(d);if(r==null)throw new Error(`Diafragma rígido: DOF prescrito ${d} não pôde ser mapeado.`);
    if(out.has(r)&&Math.abs(Number(out.get(r))-Number(value))>1e-10)throw new Error(`Diafragma rígido: prescrições incompatíveis no DOF reduzido ${r}.`);out.set(r,value)
  }return out;
}

export function solveRigidDiaphragmSystem3D(K,F,prescribed,project,nodes,options={}){
  const transform=buildRigidDiaphragmTransform3D(project,nodes,options);if(!transform.active)return{...solveConstrained(K,F,prescribed),diaphragms:{active:false,count:0,groups:[],constraintForces:[]}};
  const T=transform.T,Tt=transpose(T),Kr=mm(Tt,mm(K,T)),Fr=mv(Tt,F),pr=reducePrescribed(prescribed,transform),solved=solveConstrained(Kr,Fr,pr),u=mv(T,solved.u),R=mul(K,u).map((v,i)=>v-F[i]);
  const constraintForces=[];for(const g of transform.groups){for(const nodeId of g.slaveIds){const i=nodes.findIndex(n=>String(n.id)===nodeId),o=6*i;constraintForces.push({diaphragmId:g.id,nodeId,fx:R[o],fy:R[o+1],mz:R[o+5]})}}
  return{u,R,free:solved.free,constrained:solved.constrained,reducedDofs:T[0]?.length||0,diaphragms:{active:true,count:transform.groups.length,groups:transform.groups,constraintForces,formulation:'exact linear kinematic transformation; rigid XY diaphragm; no penalty stiffness'}};
}
