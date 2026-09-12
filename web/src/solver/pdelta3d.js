import { zeros, solveConstrained, addSub } from './matrix.js';
import { spatialAxes, frame3DLocalStiffness } from './spatial3d.js';
import { frame3DLocalGeometricStiffness } from './modalStability3d.js';

const EPS = 1e-12;
const transpose = A => A[0].map((_,j) => A.map(r => r[j]));
const matMul = (A,B) => A.map(r => B[0].map((_,j) => r.reduce((s,v,k) => s + v*B[k][j], 0)));
const matVec = (A,x) => A.map(r => r.reduce((s,v,j) => s + v*x[j], 0));
const addMatrices = (A,B) => A.map((r,i) => r.map((v,j) => v + B[i][j]));

function sectionFor(project,e){ return (project.sections || []).find(s => s.id === e.sectionId) || {}; }
function materialFor(project,e){
  const m = (project.materials || []).find(x => x.id === e.materialId);
  if(!m) throw new Error(`P-Delta 3D: material ausente em ${e.id}.`);
  return m;
}
function prop(e,s,key,fallback){
  const v = Number(e?.[key] ?? s?.[key] ?? fallback);
  return Number.isFinite(v) ? v : 0;
}

function transform12(R){
  const T = zeros(12);
  for(const offset of [0,3,6,9]) for(let i=0;i<3;i++) for(let j=0;j<3;j++) T[offset+i][offset+j] = R[i][j];
  return T;
}

function frameUniformLocalLoads(loads,L){
  const p = Array(12).fill(0), summary = [];
  for(const load of loads || []){
    if(load.kind !== 'uniform') continue;
    const qx = Number(load.qx) || 0, qy = Number(load.qy) || 0, qz = Number(load.qz) || 0;
    p[0] += qx*L/2; p[6] += qx*L/2;
    p[1] += qy*L/2; p[7] += qy*L/2; p[5] += qy*L*L/12; p[11] -= qy*L*L/12;
    p[2] += qz*L/2; p[8] += qz*L/2; p[4] -= qz*L*L/12; p[10] += qz*L*L/12;
    summary.push({kind:'uniform',qx,qy,qz});
  }
  return {p,summary};
}

function prepareFrame3D(project,e,a,b){
  const axes = spatialAxes(a,b,e), mat = materialFor(project,e), sec = sectionFor(project,e);
  const E = Number(mat.E), nu = Number(mat.nu), G = Number(mat.G) || (Number.isFinite(nu) ? E/(2*(1+nu)) : 0);
  const A = prop(e,sec,'A'), Iy = prop(e,sec,'Iy',e.I ?? sec.I), Iz = prop(e,sec,'Iz',e.I ?? sec.I), J = prop(e,sec,'J');
  const kl = frame3DLocalStiffness({E,G,A,Iy,Iz,J,L:axes.L}), T = transform12(axes.R);
  const loads = (project.elementLoads || []).filter(l => l.elementId === e.id);
  const unsupported = loads.filter(l => l.kind !== 'uniform');
  if(unsupported.length) throw new Error(`P-Delta 3D v0.29: ${e.id} possui carga de barra ainda não suportada (${unsupported[0].kind || 'tipo desconhecido'}).`);
  const {p:pl,summary} = frameUniformLocalLoads(loads,axes.L), pg = matVec(transpose(T),pl);
  return {axes,kl,T,pl,pg,properties:{E,G,A,Iy,Iz,J},loadSummary:summary};
}

function prescribedSupportDofs(project,map){
  const out = new Map(), fields = ['ux','uy','uz','rx','ry','rz'];
  for(const s of project.supports || []){
    const i = map.get(s.nodeId); if(i == null) continue;
    fields.forEach((f,k) => { if(s[f]) out.set(6*i+k, Number(s[`${f}Value`]) || 0); });
  }
  return out;
}

function normalizeImperfection(options,nd,prescribed){
  const raw = options.initialImperfection;
  if(!raw) return null;
  if(!Array.isArray(raw.vector) || raw.vector.length !== nd) throw new Error(`Imperfeição inicial 3D inválida: vetor deve possuir ${nd} graus de liberdade.`);
  const vector = raw.vector.map((v,i) => {
    const n = Number(v);
    if(!Number.isFinite(n)) throw new Error(`Imperfeição inicial 3D inválida no DOF ${i}.`);
    return n;
  });
  for(const d of prescribed.keys()) if(Math.abs(vector[d]) > 1e-9) throw new Error(`Imperfeição inicial 3D incompatível com apoio no DOF ${d}.`);
  const maxTranslation = Math.max(0,...vector.filter((_,i) => i%6 < 3).map(Math.abs));
  if(!(maxTranslation > 1e-12)) throw new Error('Imperfeição inicial 3D sem componente translacional significativa.');
  return {...raw,vector,maxTranslation};
}

function recoverFrame(prepared,ug){
  const ul = matVec(prepared.T,ug), q = matVec(prepared.kl,ul).map((v,i) => v - prepared.pl[i]);
  return {ul,q};
}
function physicalAxial(force){ return 0.5*((Number(force.N2)||0) - (Number(force.N1)||0)); }

export function solveFramePDelta3D(project,options={}){
  const nodes = project.nodes || [], elements = project.elements || [];
  if(!nodes.length) throw new Error('P-Delta 3D: modelo sem nós.');
  if(!elements.length) throw new Error('P-Delta 3D: modelo sem elementos.');
  if(elements.some(e => e.type !== 'frame3d')) throw new Error('P-Delta 3D v0.29 suporta somente modelos compostos por elementos frame3d.');

  const maxIterations = Math.max(2,Math.min(100,Math.round(Number(options.maxIterations ?? project.settings?.pDeltaMaxIterations ?? 30))));
  const tolerance = Math.max(1e-12,Number(options.tolerance ?? project.settings?.pDeltaTolerance ?? 1e-8));
  const nd = nodes.length*6, map = new Map(nodes.map((n,i) => [n.id,i])), cache = [];

  for(const e of elements){
    const i = map.get(e.n1), j = map.get(e.n2);
    if(i == null || j == null) throw new Error(`P-Delta 3D: elemento ${e.id} referencia nó inexistente.`);
    const idx = [0,1,2,3,4,5,6,7,8,9,10,11].map(k => k < 6 ? 6*i+k : 6*j+(k-6));
    cache.push({e,idx,prepared:prepareFrame3D(project,e,nodes[i],nodes[j])});
  }

  const prescribed = prescribedSupportDofs(project,map), imperfection = normalizeImperfection(options,nd,prescribed), u0 = imperfection?.vector || Array(nd).fill(0);
  let axial = new Map(cache.map(x => [x.e.id,0])), uPrev = Array(nd).fill(0), last = null, converged = false, maxDelta = Infinity;

  for(let iteration=1; iteration<=maxIterations; iteration++){
    const K = zeros(nd), F = Array(nd).fill(0);
    for(const item of cache){
      const N = axial.get(item.e.id) || 0;
      const kgLocal = frame3DLocalGeometricStiffness(N,item.prepared.axes.L);
      const ktLocal = addMatrices(item.prepared.kl,kgLocal);
      const ktGlobal = matMul(transpose(item.prepared.T),matMul(ktLocal,item.prepared.T));
      addSub(K,ktGlobal,item.idx);
      item.prepared.pg.forEach((v,k) => { F[item.idx[k]] += v; });
      if(imperfection && Math.abs(N) > 1e-15){
        const kgOnly = matMul(transpose(item.prepared.T),matMul(kgLocal,item.prepared.T));
        const u0e = item.idx.map(i => u0[i]), fImp = matVec(kgOnly,u0e).map(v => -v);
        fImp.forEach((v,k) => { F[item.idx[k]] += v; });
      }
    }
    for(const l of project.loads || []){
      const i = map.get(l.nodeId); if(i == null) continue;
      const values = [l.fx,l.fy,l.fz,l.mx,l.my,l.mz];
      for(let k=0;k<6;k++) F[6*i+k] += Number(values[k]) || 0;
    }

    const solved = solveConstrained(K,F,prescribed), u = solved.u;
    maxDelta = Math.max(...u.map((v,i) => Math.abs(v-uPrev[i])));
    const scale = Math.max(1,Math.max(...u.map(Math.abs)));
    const forces = cache.map(item => {
      const ug = item.idx.map(i => u[i]), {ul,q} = recoverFrame(item.prepared,ug), u0g = item.idx.map(i => u0[i]), u0l = imperfection ? matVec(item.prepared.T,u0g) : Array(12).fill(0);
      return {elementId:item.e.id,type:'frame3d',N1:q[0],Vy1:q[1],Vz1:q[2],T1:q[3],My1:q[4],Mz1:q[5],N2:q[6],Vy2:q[7],Vz2:q[8],T2:q[9],My2:q[10],Mz2:q[11],localDisplacements:ul,localDisplacementsTotal:ul.map((v,i)=>v+u0l[i]),localAxes:item.prepared.axes,properties:item.prepared.properties,loadSummary:item.prepared.loadSummary};
    });
    const newAxial = new Map(forces.map(f => [f.elementId,physicalAxial(f)]));
    last = {iteration,K,F,u,R:solved.R,free:solved.free,forces,axial:newAxial};
    if(iteration > 1 && maxDelta <= tolerance*scale){ converged = true; break; }
    if(u.some(v => !Number.isFinite(v) || Math.abs(v) > 1e3)) throw new Error('P-Delta 3D divergiu: deslocamentos não físicos indicam instabilidade ou modelo inadequado.');
    axial = newAxial; uPrev = [...u];
  }

  if(!converged) throw new Error(`P-Delta 3D não convergiu em ${maxIterations} iterações (Δu=${maxDelta.toExponential(3)}).`);

  const displacements = nodes.map((n,i) => ({nodeId:n.id,ux:last.u[6*i],uy:last.u[6*i+1],uz:last.u[6*i+2],rx:last.u[6*i+3],ry:last.u[6*i+4],rz:last.u[6*i+5]}));
  const initialDisplacements = nodes.map((n,i) => ({nodeId:n.id,ux:u0[6*i],uy:u0[6*i+1],uz:u0[6*i+2],rx:u0[6*i+3],ry:u0[6*i+4],rz:u0[6*i+5]}));
  const totalDisplacements = nodes.map((n,i) => ({nodeId:n.id,ux:last.u[6*i]+u0[6*i],uy:last.u[6*i+1]+u0[6*i+1],uz:last.u[6*i+2]+u0[6*i+2],rx:last.u[6*i+3]+u0[6*i+3],ry:last.u[6*i+4]+u0[6*i+4],rz:last.u[6*i+5]+u0[6*i+5]}));
  const reactions = nodes.map((n,i) => ({nodeId:n.id,fx:last.R[6*i],fy:last.R[6*i+1],fz:last.R[6*i+2],mx:last.R[6*i+3],my:last.R[6*i+4],mz:last.R[6*i+5]}));
  return {type:'frame3d-pdelta',dimension:'3d',analysisType:'pdelta',solverVersion:'0.29.0',dofs:nd,activeDofs:last.free.length,displacements,initialDisplacements:imperfection?initialDisplacements:null,totalDisplacements:imperfection?totalDisplacements:null,reactions,elementForces:last.forces,pDelta:{converged:true,iterations:last.iteration,tolerance,maxDelta,axialForces:[...last.axial].map(([elementId,N]) => ({elementId,N})),imperfection:imperfection?{enabled:true,source:imperfection.source||'bucklingMode',mode:imperfection.mode||null,referenceScenarioId:imperfection.referenceScenarioId||null,amplitude:imperfection.maxTranslation,amplitudeMm:imperfection.maxTranslation*1000,criticalFactor:imperfection.criticalFactor||null}:null,formulation:'elastic-frame3d + consistent geometric stiffness in both bending planes + equivalent modal imperfection load',convention:'N>0 tension; compression negative'}};
}
