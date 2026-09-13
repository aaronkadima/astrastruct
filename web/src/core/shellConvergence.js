import { refineShell4Mesh } from './shellRefinement.js';
import { evaluateShellMeshQuality } from './shellQuality.js';

const EPS=1e-12;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const shellIds=e=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);
const uniqueSortedInts=(values,min=1,max=12)=>[...new Set((values||[]).map(v=>Math.max(min,Math.min(max,Math.round(finite(v,min))))))].sort((a,b)=>a-b);

function scopedShells(project,{elementIds=null,levelId=null}={}){
  const selected=Array.isArray(elementIds)&&elementIds.length?new Set(elementIds.map(String)):null,nodeMap=new Map((project?.nodes||[]).map(n=>[String(n.id),n]));
  return(project?.elements||[]).filter(e=>{
    if(e.type!=='shell4')return false;
    const source=String(e.parentShellId||e.meshRefinement?.sourceElementId||e.id);
    if(selected&&!selected.has(String(e.id))&&!selected.has(source))return false;
    if(levelId!=null){const first=nodeMap.get(String(shellIds(e)[0]));if(String(e.levelId??first?.levelId??'')!==String(levelId))return false}
    return true;
  });
}

export function shellResponseMetrics(project,result,scope={}){
  const shells=scopedShells(project,scope),shellSet=new Set(shells.map(e=>String(e.id))),nodeSet=new Set(shells.flatMap(shellIds).map(String)),disp=(result?.totalDisplacements||result?.displacements||[]).filter(d=>nodeSet.has(String(d.nodeId))),forces=(result?.elementForces||[]).filter(f=>f.type==='shell4'&&shellSet.has(String(f.elementId)));
  const max=(arr,fn)=>arr.length?Math.max(...arr.map(x=>Math.abs(finite(fn(x))))):0;
  return{
    shellCount:shells.length,nodeCount:nodeSet.size,
    maxAbsUz:max(disp,d=>d.uz),
    maxAbsU:max(disp,d=>Math.hypot(finite(d.ux),finite(d.uy),finite(d.uz))),
    maxAbsNx:max(forces,f=>f.membraneResultants?.Nx),maxAbsNy:max(forces,f=>f.membraneResultants?.Ny),maxAbsNxy:max(forces,f=>f.membraneResultants?.Nxy),
    maxAbsMx:max(forces,f=>f.bendingMoments?.Mx),maxAbsMy:max(forces,f=>f.bendingMoments?.My),maxAbsMxy:max(forces,f=>f.bendingMoments?.Mxy),
    maxAbsQx:max(forces,f=>f.transverseShear?.Qx),maxAbsQy:max(forces,f=>f.transverseShear?.Qy)
  };
}

export function runShellMeshConvergence(project,{solveModel,scenarioId=null,elementIds=null,levelId=null,divisions=[1,2,3,4],tolerance=.03,metric='maxAbsUz',qualityOptions={},maxDivisions=8}={}){
  if(typeof solveModel!=='function')throw new Error('Convergência shell4: informe a função solveModel(project, scenarioId).');
  const base=clone(project),sequence=uniqueSortedInts(divisions,1,Math.max(2,Math.round(finite(maxDivisions,8))));if(sequence.length<2)throw new Error('Convergência shell4: use pelo menos duas malhas.');
  const analysisType=String(base.settings?.analysisType||'linear');if(analysisType!=='linear')throw new Error('Convergência shell4: nesta etapa use análise linear estática.');
  const tol=Math.max(1e-6,Math.min(.5,Math.abs(finite(tolerance,.03)))),steps=[];let previous=null,finalProject=base,converged=false;
  for(const n of sequence){
    const trial=n===1?clone(base):refineShell4Mesh(base,{elementIds,levelId,divisionsX:n,divisionsY:n,maxDivisions}).project,quality=evaluateShellMeshQuality(trial,qualityOptions);if(!quality.ok)throw new Error(`Convergência shell4: a malha ${n}×${n} contém ${quality.counts.invalid} elemento(s) inválido(s).`);
    const result=solveModel(trial,scenarioId),metrics=shellResponseMetrics(trial,result,{elementIds,levelId}),value=finite(metrics[metric],NaN);if(!Number.isFinite(value))throw new Error(`Convergência shell4: métrica '${metric}' não disponível.`);
    const relativeChange=previous==null?null:Math.abs(value-previous)/Math.max(EPS,Math.abs(value),Math.abs(previous)),step={divisions:n,metric,value,relativeChange,metrics,quality:{counts:quality.counts,worst:quality.worst},nodes:(trial.nodes||[]).length,shells:metrics.shellCount};steps.push(step);finalProject=trial;
    if(relativeChange!=null&&relativeChange<=tol){converged=true;break}previous=value;
  }
  const last=steps.at(-1),report={metric,tolerance:tol,scenarioId:scenarioId??base.settings?.analysisScenarioId??base.settings?.activeLoadCaseId??null,levelId:levelId??null,steps,converged,recommendedDivisions:last?.divisions??1,finalRelativeChange:last?.relativeChange??null};
  finalProject.meta={...(finalProject.meta||{}),shellConvergenceUpdatedAt:new Date().toISOString(),lastShellConvergenceReport:report};return{project:finalProject,report};
}
