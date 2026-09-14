export const ENGINEERING_DESKTOP_RESULTS_CONTRACT='engineering-desktop-results/v1';
export const ENGINEERING_DESKTOP_RESULTS_VERSION='0.54.0-exp';

const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const mag3=(a,b,c)=>Math.hypot(Number(a)||0,Number(b)||0,Number(c)||0);
const pickRows=result=>result?.totalDisplacements||result?.displacements||result?.combined?.displacements||[];
const reactionRows=result=>Array.isArray(result?.reactions)?result.reactions:[];
const forceRows=result=>Array.isArray(result?.elementForces)?result.elementForces:[];

function rebarSchedule(project={}){
  const candidates=[project?.detailing?.reinforcement,project?.detailingPackage?.reinforcement,project?.detailing?.package?.reinforcement,...(project?.detailingPackages||[]).map(x=>x?.reinforcement)];
  return candidates.find(x=>x?.contract==='rebar-schedule/v1')||null;
}
function supportMap(project={}){return new Map((project.supports||[]).map(s=>[String(s.nodeId),s]));}
function elementMap(project={}){return new Map((project.elements||[]).map(e=>[String(e.id),e]));}
function nodeMap(project={}){return new Map((project.nodes||[]).map(n=>[String(n.id),n]));}

function buildReactions(project,result){
  const supports=supportMap(project),nodes=nodeMap(project),rows=[];
  for(const r of reactionRows(result)){
    const id=String(r?.nodeId||'');if(!id||!supports.has(id))continue;
    const n=nodes.get(id),fx=finite(r.fx)??0,fy=finite(r.fy)??0,fz=finite(r.fz)??0,mx=finite(r.mx)??0,my=finite(r.my)??0,mz=finite(r.mz)??0;
    rows.push({nodeId:id,label:text(n?.label||n?.name,id),Fx:fx,Fy:fy,Fz:fz,Mx:mx,My:my,Mz:mz,resultantKN:mag3(fx,fy,fz),resultantMomentKNm:mag3(mx,my,mz),restraints:{...supports.get(id)}});
  }
  return rows.sort((a,b)=>b.resultantKN-a.resultantKN||a.nodeId.localeCompare(b.nodeId));
}
function buildDisplacements(project,result){
  const nodes=nodeMap(project),rows=[];
  for(const d of pickRows(result)){
    const id=String(d?.nodeId||'');if(!id||!nodes.has(id))continue;
    const ux=finite(d.ux)??0,uy=finite(d.uy)??0,uz=finite(d.uz)??0,rx=finite(d.rx)??0,ry=finite(d.ry)??0,rz=finite(d.rz)??0,n=nodes.get(id);
    rows.push({nodeId:id,label:text(n?.label||n?.name,id),uxMm:1000*ux,uyMm:1000*uy,uzMm:1000*uz,resultantMm:1000*mag3(ux,uy,uz),rx,ry,rz});
  }
  return rows.sort((a,b)=>b.resultantMm-a.resultantMm||a.nodeId.localeCompare(b.nodeId));
}
function buildForces(project,result){
  const elements=elementMap(project),bars=[],shells=[];
  for(const f of forceRows(result)){
    const id=String(f?.elementId||'');if(!id)continue;const e=elements.get(id),type=text(f?.type||e?.type,'unknown'),label=text(e?.label||e?.name,id);
    if(type==='shell4'){
      shells.push({elementId:id,label,type,Nx:finite(f?.membraneResultants?.Nx),Ny:finite(f?.membraneResultants?.Ny),Nxy:finite(f?.membraneResultants?.Nxy),Mx:finite(f?.bendingMoments?.Mx),My:finite(f?.bendingMoments?.My),Mxy:finite(f?.bendingMoments?.Mxy),Qx:finite(f?.transverseShear?.Qx),Qy:finite(f?.transverseShear?.Qy)});continue;
    }
    bars.push({elementId:id,label,type,N1:finite(f.N1??(f.axialForce!=null?-f.axialForce:null)),Vy1:finite(f.Vy1),Vz1:finite(f.Vz1),T1:finite(f.T1),My1:finite(f.My1),Mz1:finite(f.Mz1),N2:finite(f.N2??f.axialForce),Vy2:finite(f.Vy2),Vz2:finite(f.Vz2),T2:finite(f.T2),My2:finite(f.My2),Mz2:finite(f.Mz2)});
  }
  return{bars:bars.sort((a,b)=>a.elementId.localeCompare(b.elementId)),shells:shells.sort((a,b)=>a.elementId.localeCompare(b.elementId))};
}
function buildRebar(project){
  const schedule=rebarSchedule(project);if(!schedule)return{schedule:null,rows:[],summary:{marks:0,totalMassKg:null,totalLengthM:null}};
  const rows=(schedule.marks||[]).map(m=>({id:text(m.id),location:text(m.location,'—'),grade:text(m.grade,'—'),diameterMm:finite(m.diameterMm),quantity:finite(m.quantity),cutLengthMm:finite(m.cutLengthMm),totalLengthM:finite(m.totalLengthM),totalMassKg:finite(m.totalMassKg)}));
  const totalMassKg=rows.every(r=>r.totalMassKg!=null)?rows.reduce((s,r)=>s+r.totalMassKg,0):null,totalLengthM=rows.every(r=>r.totalLengthM!=null)?rows.reduce((s,r)=>s+r.totalLengthM,0):null;
  return{schedule,rows,summary:{marks:rows.length,totalMassKg,totalLengthM}};
}

export function buildEngineeringDesktopResults(project={},result={}){
  const forces=buildForces(project,result),rebar=buildRebar(project),reactions=buildReactions(project,result),displacements=buildDisplacements(project,result),overview=result?.engineeringVisualization?.floors?.levels||[];
  return{contract:ENGINEERING_DESKTOP_RESULTS_CONTRACT,version:ENGINEERING_DESKTOP_RESULTS_VERSION,scenarioId:result?.scenario?.id||project?.settings?.analysisScenarioId||null,analysisType:result?.analysisType||null,overview,reactions,barForces:forces.bars,shellForces:forces.shells,displacements,rebar,summary:{overviewRows:overview.length,reactions:reactions.length,bars:forces.bars.length,shells:forces.shells.length,nodes:displacements.length,rebarMarks:rebar.rows.length},governance:{sameSolverResult:true,supportReactionsOnly:true,noSyntheticResponses:true,barShellUnitsSeparated:true,rebarScheduleOnly:true,noNormativePassFailInference:true}};
}
