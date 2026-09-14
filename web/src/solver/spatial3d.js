import { zeros, addSub } from './matrix.js';
import { condenseEndConnections3D, recoverEndConnections3D } from './endConnections3d.js';
import { solveRigidDiaphragmSystem3D } from './diaphragm3d.js';
import { shell4Element, recoverShell4 } from './shell4.js';
import { addSpatialNodalSprings, recoverSpatialSpringForces } from './springs.js';

const EPS=1e-12;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(a[0],a[1],a[2]);
const unit=a=>{const n=norm(a);if(!(n>EPS))throw new Error('Vetor de orientação 3D degenerado.');return a.map(v=>v/n)};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const matMul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const matVec=(A,x)=>A.map(r=>r.reduce((s,v,j)=>s+v*x[j],0));

function sectionFor(project,e){return (project.sections||[]).find(s=>s.id===e.sectionId)||{};}
function materialFor(project,e){const m=(project.materials||[]).find(x=>x.id===e.materialId);if(!m)throw new Error(`Material ausente em ${e.id}.`);return m;}
function prop(e,s,key,fallback){const v=Number(e?.[key]??s?.[key]??fallback);return Number.isFinite(v)?v:0;}

export function spatialAxes(a,b,e={}){
  const dx=[Number(b.x)-Number(a.x),Number(b.y)-Number(a.y),Number(b.z||0)-Number(a.z||0)],L=norm(dx);
  if(!(L>1e-10))throw new Error(`Elemento ${e.id||''} possui comprimento nulo.`);
  const ex=unit(dx);
  const raw=e.orientation?.up||e.localY||null;
  let ref=Array.isArray(raw)&&raw.length>=3?[Number(raw[0]),Number(raw[1]),Number(raw[2])]:null;
  if(!ref||!ref.every(Number.isFinite)||norm(ref)<EPS)ref=Math.abs(ex[2])<.90?[0,0,1]:(Math.abs(ex[1])<.90?[0,1,0]:[1,0,0]);
  let eyCandidate=sub(ref,scale(ex,dot(ref,ex)));
  if(norm(eyCandidate)<1e-9){ref=Math.abs(ex[0])<.90?[1,0,0]:(Math.abs(ex[1])<.90?[0,1,0]:[0,0,1]);eyCandidate=sub(ref,scale(ex,dot(ref,ex)))}
  const ey=unit(eyCandidate),ez=unit(cross(ex,ey));
  return {L,ex,ey,ez,R:[ex,ey,ez]};
}

function transform12(R){const T=zeros(12);for(const offset of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[offset+i][offset+j]=R[i][j];return T;}

export function frame3DLocalStiffness({E,G,A,Iy,Iz,J,L}){
  for(const [name,v] of Object.entries({E,G,A,Iy,Iz,J,L}))if(!(Number(v)>0))throw new Error(`frame3d: propriedade ${name} deve ser positiva.`);
  const k=zeros(12),EA=E*A/L,GJ=G*J/L;
  k[0][0]=k[6][6]=EA;k[0][6]=k[6][0]=-EA;
  k[3][3]=k[9][9]=GJ;k[3][9]=k[9][3]=-GJ;
  const az=12*E*Iz/L**3,bz=6*E*Iz/L**2,cz=4*E*Iz/L,dz=2*E*Iz/L,iv=[1,5,7,11],kv=[[az,bz,-az,bz],[bz,cz,-bz,dz],[-az,-bz,az,-bz],[bz,dz,-bz,cz]];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)k[iv[i]][iv[j]]+=kv[i][j];
  const ay=12*E*Iy/L**3,by=6*E*Iy/L**2,cy=4*E*Iy/L,dy=2*E*Iy/L,iw=[2,4,8,10],kw=[[ay,-by,-ay,-by],[-by,cy,by,dy],[-ay,by,ay,by],[-by,dy,by,cy]];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)k[iw[i]][iw[j]]+=kw[i][j];
  return k;
}

function frameUniformLocalLoads(loads,L){
  const p=Array(12).fill(0),summary=[];
  for(const load of loads||[]){
    if(load.kind!=='uniform')continue;
    const qx=Number(load.qx)||0,qy=Number(load.qy)||0,qz=Number(load.qz)||0;
    p[0]+=qx*L/2;p[6]+=qx*L/2;p[1]+=qy*L/2;p[7]+=qy*L/2;p[5]+=qy*L*L/12;p[11]-=qy*L*L/12;p[2]+=qz*L/2;p[8]+=qz*L/2;p[4]-=qz*L*L/12;p[10]+=qz*L*L/12;
    summary.push({kind:'uniform',qx,qy,qz});
  }
  return {p,summary};
}

function prepareFrame3D(project,e,a,b){
  const axes=spatialAxes(a,b,e),mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),nu=Number(mat.nu),G=Number(mat.G)||(Number.isFinite(nu)?E/(2*(1+nu)):0),A=prop(e,sec,'A'),Iy=prop(e,sec,'Iy',e.I??sec.I),Iz=prop(e,sec,'Iz',e.I??sec.I),J=prop(e,sec,'J');
  const kl=frame3DLocalStiffness({E,G,A,Iy,Iz,J,L:axes.L}),loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id),{p:pl,summary}=frameUniformLocalLoads(loads,axes.L),connection=condenseEndConnections3D(kl,pl,e.releases,e.rotationalSprings),T=transform12(axes.R),kg=matMul(transpose(T),matMul(connection.kEff,T)),pg=matVec(transpose(T),connection.pEff);
  return {axes,kl,T,kg,pl,pg,connectionData:connection.connectionData,properties:{E,G,A,Iy,Iz,J},loadSummary:summary};
}

function prepareTruss3D(project,e,a,b){
  const axes=spatialAxes(a,b,e),mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),A=prop(e,sec,'A');
  if(!(E>0&&A>0))throw new Error(`truss3d ${e.id}: E e A devem ser positivos.`);
  const k=zeros(12),d=axes.ex,coef=E*A/axes.L;
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){const v=coef*d[r]*d[c];k[r][c]+=v;k[r][6+c]-=v;k[6+r][c]-=v;k[6+r][6+c]+=v}
  const unsupported=(project.elementLoads||[]).filter(l=>l.elementId===e.id&&Math.abs(Number(l.qx)||0)+Math.abs(Number(l.qy)||0)+Math.abs(Number(l.qz)||0)>EPS);if(unsupported.length)throw new Error(`truss3d ${e.id}: cargas distribuídas de barra não são suportadas na v0.30.`);
  return {axes,kg:k,properties:{E,A}};
}

function shellNodeIds(e){const ids=Array.isArray(e.nodeIds)?e.nodeIds:[e.n1,e.n2,e.n3,e.n4];if(ids.length!==4||ids.some(x=>!x)||new Set(ids).size!==4)throw new Error(`shell4 ${e.id}: informe quatro nós distintos em nodeIds ou n1..n4.`);return ids;}
function prepareShell4(project,e,shellNodes){
  const mat=materialFor(project,e),sec=sectionFor(project,e),E=Number(mat.E),nu=Number(mat.nu),thickness=Number(e.thickness??e.t??sec.thickness??sec.t),loads=(project.elementLoads||[]).filter(l=>l.elementId===e.id),supported=loads.filter(l=>l.kind==='surface'||l.kind==='pressure'),unsupported=loads.filter(l=>!['surface','pressure'].includes(l.kind));if(unsupported.length)throw new Error(`shell4 ${e.id}: carga '${unsupported[0].kind||'desconhecida'}' não suportada; use surface/pressure.`);const pressure=supported.reduce((sum,l)=>sum+(Number(l.pressure??l.pz??l.qz)||0),0),prepared=shell4Element({nodes:shellNodes,E,nu,thickness,pressure,shearCorrection:Number(e.shearCorrection??5/6),drillingFactor:Number(e.drillingFactor??1e-6),element:e});return{...prepared,loadSummary:supported.map(l=>({kind:'surface',pressure:Number(l.pressure??l.pz??l.qz)||0})),properties:{E,nu,thickness}};
}

function dofIndex(nodeIndex,local){return 6*nodeIndex+local;}
function prescribedSupportDofs(project,map,rotationalNodes){
  const out=new Map(),fields=['ux','uy','uz','rx','ry','rz'];
  for(const s of project.supports||[]){const i=map.get(s.nodeId);if(i==null)continue;fields.forEach((f,k)=>{if(s[f])out.set(dofIndex(i,k),Number(s[`${f}Value`])||0)})}
  for(const [nodeId,i] of map){if(rotationalNodes.has(nodeId))continue;for(let k=3;k<6;k++)if(!out.has(dofIndex(i,k)))out.set(dofIndex(i,k),0)}return out;
}

function recoverFrame(prepared,ug){const ul=matVec(prepared.T,ug),recovered=recoverEndConnections3D(prepared.kl,prepared.pl,ul,prepared.connectionData);return {ul,q:recovered.q,connectionRotations:recovered.connectionRotations,elementLocalDisplacements:recovered.uElement};}

export function solveSpatial3D(project){
  const nodes=project.nodes||[],elements=(project.elements||[]).filter(e=>['frame3d','truss3d','shell4'].includes(e.type));if(!nodes.length)throw new Error('Modelo 3D sem nós.');if(!elements.length)throw new Error('Modelo sem elementos frame3d/truss3d/shell4.');
  const nd=nodes.length*6,K=zeros(nd),F=Array(nd).fill(0),map=new Map(nodes.map((n,i)=>[n.id,i])),cache=[],rotationalNodes=new Set();
  for(const e of elements){
    if(e.type==='shell4'){
      const ids=shellNodeIds(e),indices=ids.map(id=>map.get(id));if(indices.some(i=>i==null))throw new Error(`shell4 ${e.id} referencia nó inexistente.`);const shellNodes=indices.map(i=>nodes[i]),idx=indices.flatMap(i=>[0,1,2,3,4,5].map(d=>6*i+d));ids.forEach(id=>rotationalNodes.add(id));const prepared=prepareShell4(project,e,shellNodes);addSub(K,prepared.kg,idx);prepared.pg.forEach((v,k)=>{F[idx[k]]+=v});cache.push({e,idx,prepared});continue;
    }
    const i=map.get(e.n1),j=map.get(e.n2);if(i==null||j==null)throw new Error(`Elemento ${e.id} referencia nó inexistente.`);const a=nodes[i],b=nodes[j],idx=[0,1,2,3,4,5,6,7,8,9,10,11].map(k=>k<6?6*i+k:6*j+(k-6));
    if(e.type==='frame3d'){rotationalNodes.add(e.n1);rotationalNodes.add(e.n2);const prepared=prepareFrame3D(project,e,a,b);addSub(K,prepared.kg,idx);prepared.pg.forEach((v,k)=>{F[idx[k]]+=v});cache.push({e,idx,prepared})}
    else{const prepared=prepareTruss3D(project,e,a,b);addSub(K,prepared.kg,idx);cache.push({e,idx,prepared})}
  }
  for(const l of project.loads||[]){const i=map.get(l.nodeId);if(i==null)continue;const values=[l.fx,l.fy,l.fz,l.mx,l.my,l.mz];for(let k=0;k<6;k++)F[6*i+k]+=Number(values[k])||0}
  addSpatialNodalSprings(K,project,map,6);
  const prescribed=prescribedSupportDofs(project,map,rotationalNodes),solved=solveRigidDiaphragmSystem3D(K,F,prescribed,project,nodes),{u,R,free,diaphragms}=solved,displacements=nodes.map((n,i)=>({nodeId:n.id,ux:u[6*i],uy:u[6*i+1],uz:u[6*i+2],rx:u[6*i+3],ry:u[6*i+4],rz:u[6*i+5]})),reactions=nodes.map((n,i)=>({nodeId:n.id,fx:R[6*i],fy:R[6*i+1],fz:R[6*i+2],mx:R[6*i+3],my:R[6*i+4],mz:R[6*i+5]})),springForces=recoverSpatialSpringForces(project,displacements);
  const elementForces=cache.map(({e,idx,prepared})=>{
    const ug=idx.map(d=>u[d]);if(e.type==='truss3d'){const du=[ug[6]-ug[0],ug[7]-ug[1],ug[8]-ug[2]],N=prepared.properties.E*prepared.properties.A/prepared.axes.L*dot(prepared.axes.ex,du);return {elementId:e.id,type:'truss3d',axialForce:N,N1:-N,N2:N,localAxes:prepared.axes}}
    if(e.type==='shell4'){const r=recoverShell4(prepared,ug);return{elementId:e.id,type:'shell4',...r,area:prepared.area,thickness:prepared.thickness,localAxes:prepared.axes,properties:prepared.properties,loadSummary:prepared.loadSummary}}
    const {ul,q,connectionRotations,elementLocalDisplacements}=recoverFrame(prepared,ug);return {elementId:e.id,type:'frame3d',N1:q[0],Vy1:q[1],Vz1:q[2],T1:q[3],My1:q[4],Mz1:q[5],N2:q[6],Vy2:q[7],Vz2:q[8],T2:q[9],My2:q[10],Mz2:q[11],localDisplacements:ul,elementLocalDisplacements,connectionRotations,localAxes:prepared.axes,properties:prepared.properties,loadSummary:prepared.loadSummary};
  });
  const types=new Set(elements.map(e=>e.type)),type=types.size===1?[...types][0]:'mixed3d';return {type,dimension:'3d',solverVersion:'0.30.0',dofs:nd,reducedDofs:solved.reducedDofs??nd,activeDofs:free.length,displacements,reactions,springForces,elementForces,diaphragms};
}
