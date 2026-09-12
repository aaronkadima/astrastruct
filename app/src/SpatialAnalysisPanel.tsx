import React,{useMemo,useState} from 'react';
// @ts-ignore
import {normalizeProject} from '../../web/src/core/model.js';

type Props={project:any;onClose:()=>void;onCommit:(project:any)=>void};
type SpatialMode='linear'|'modal'|'pdelta'|'corotational';
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const hasNonzeroPrescribed=(project:any)=>(project.supports||[]).some((s:any)=>['ux','uy','uz','rx','ry','rz'].some(k=>Math.abs(num(s[`${k}Value`]??s[`base${k[0].toUpperCase()}${k.slice(1)}Value`]))>1e-12));
const hasReleases=(project:any)=>(project.elements||[]).some((e:any)=>Object.values(e.releases||{}).some(Boolean)||Object.values(e.rotationalSprings||{}).some(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))));
const hasMaterialNonlinearity=(project:any)=>(project.elements||[]).some((e:any)=>e.distributedPlasticity?.enabled||Object.values(e.fiberHinges||{}).some((h:any)=>h?.enabled));

function spatialIssues(project:any,mode:SpatialMode){
  const issues:string[]=[],elements=project.elements||[],frameOnly=elements.length>0&&elements.every((e:any)=>e.type==='frame3d'),spatialOnly=elements.length>0&&elements.every((e:any)=>['frame3d','truss3d'].includes(e.type));
  if(!elements.length)issues.push('O modelo não possui elementos.');
  if(mode==='modal'){
    if(!spatialOnly)issues.push('Modal 3D aceita apenas frame3d e truss3d.');
    if((project.settlements||[]).length)issues.push('Modal 3D ainda não admite recalques/deslocamentos impostos.');
    if(hasNonzeroPrescribed(project))issues.push('Modal 3D requer apoios homogêneos, com deslocamentos prescritos nulos.');
    if(hasMaterialNonlinearity(project))issues.push('Modal 3D é linear-elástico; desative plasticidade/rótulas de fibras.');
    for(const e of elements){const m=(project.materials||[]).find((x:any)=>x.id===e.materialId);if(!(num(m?.density)>0))issues.push(`${e.id}: material deve possuir density > 0 kN/m³.`)}
  }
  if(mode==='pdelta'){
    if(!frameOnly)issues.push('P‑Delta 3D v0.29 requer modelo composto somente por frame3d.');
    if(hasReleases(project))issues.push('P‑Delta 3D ainda não admite releases ou molas rotacionais de extremidade.');
    if((project.nodeSprings||[]).length)issues.push('P‑Delta 3D ainda não inclui molas nodais.');
    const bad=(project.elementLoads||[]).filter((l:any)=>l.kind!=='uniform');if(bad.length)issues.push(`P‑Delta 3D: cargas de barra ainda não suportadas: ${[...new Set(bad.map((x:any)=>x.kind||'desconhecida'))].join(', ')}.`);
    if(hasMaterialNonlinearity(project))issues.push('P‑Delta 3D v0.29 é elástico.');
  }
  if(mode==='corotational'){
    if(!frameOnly)issues.push('Co‑rotacional 3D v0.30 requer modelo composto somente por frame3d.');
    if(hasReleases(project))issues.push('Co‑rotacional 3D v0.30 ainda não admite releases ou ligações semirrígidas.');
    if((project.nodeSprings||[]).length)issues.push('Co‑rotacional 3D v0.30 ainda não admite molas nodais.');
    if((project.settlements||[]).length||hasNonzeroPrescribed(project))issues.push('Co‑rotacional 3D v0.30 requer apoios homogêneos e ainda não admite recalques.');
    if(hasMaterialNonlinearity(project))issues.push('Co‑rotacional 3D v0.30 é elástico; plasticidade 3D permanece fora do escopo.');
    const allowed=new Set(['uniform','point','selfWeight']),bad=(project.elementLoads||[]).filter((l:any)=>!allowed.has(l.kind));if(bad.length)issues.push(`Co‑rotacional 3D: cargas de barra ainda não suportadas: ${[...new Set(bad.map((x:any)=>x.kind||'desconhecida'))].join(', ')}.`);
  }
  return [...new Set(issues)];
}

export function SpatialAnalysisPanel({project,onClose,onCommit}:Props){
  const raw=String(project.settings?.analysisType||'linear'),initial:SpatialMode=(['linear','modal','pdelta','corotational'] as string[]).includes(raw)?raw as SpatialMode:'linear';
  const[mode,setMode]=useState<SpatialMode>(initial);
  const[modalModes,setModalModes]=useState(num(project.settings?.modalModes,6));
  const[massFormulation,setMassFormulation]=useState(project.settings?.dynamicMassFormulation==='lumped'?'lumped':'consistent');
  const[pMaxIt,setPMaxIt]=useState(num(project.settings?.pDeltaMaxIterations,30));
  const[pTol,setPTol]=useState(num(project.settings?.pDeltaTolerance,1e-8));
  const[steps,setSteps]=useState(num(project.settings?.nonlinearSteps,12));
  const[maxIt,setMaxIt]=useState(num(project.settings?.nonlinearMaxIterations,35));
  const[tol,setTol]=useState(num(project.settings?.nonlinearTolerance,1e-8));
  const[lineSearch,setLineSearch]=useState(project.settings?.nonlinearLineSearch!==false);
  const issues=useMemo(()=>spatialIssues(project,mode),[project,mode]);
  const imperfection=project.settings?.imperfection,hasImperfection=!!imperfection?.enabled;
  const choice=(value:SpatialMode,title:string,equation:string,note:string,version:string)=>{const disabled=value!=='linear'&&spatialIssues(project,value).length>0;return <button data-testid={`analysis-${value}`} disabled={disabled} className={mode===value?'active':''} onClick={()=>setMode(value)}><b>{title}</b><span>{equation}</span><small>{version} · {note}</small></button>};
  const apply=()=>{
    if(issues.length)return;const p=clone(project);p.settings={...(p.settings||{}),analysisType:mode};
    if(mode==='modal'){p.settings.modalModes=Math.max(1,Math.min(20,Math.round(num(modalModes,6))));p.settings.dynamicMassFormulation=massFormulation==='lumped'?'lumped':'consistent'}
    if(mode==='pdelta'){p.settings.pDeltaMaxIterations=Math.max(2,Math.min(100,Math.round(num(pMaxIt,30))));p.settings.pDeltaTolerance=Math.max(1e-12,num(pTol,1e-8))}
    if(mode==='corotational'){p.settings.nonlinearControlMode='load';p.settings.nonlinearSteps=Math.max(1,Math.min(100,Math.round(num(steps,12))));p.settings.nonlinearMaxIterations=Math.max(3,Math.min(80,Math.round(num(maxIt,35))));p.settings.nonlinearTolerance=Math.max(1e-10,num(tol,1e-8));p.settings.nonlinearLineSearch=!!lineSearch}
    onCommit(normalizeProject(p));onClose();
  };
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section data-testid="panel-spatial-analysis" className="react-modal" role="dialog" aria-modal="true" aria-label="Tipo de análise espacial 3D">
      <header className="react-modal-head"><div><h2>Análise espacial 3D</h2><p>Formulações disponíveis para modelos com seis graus de liberdade por nó.</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="analysis-choices analysis-choices-v13">
        {choice('linear','Linear 3D','K u = F','pequenos deslocamentos','v0.26')}
        {choice('modal','Modal 3D','Kφ = ω²Mφ','frequências e participação modal','v0.27')}
        {choice('pdelta','P‑Delta 3D','[K + Kg(N)] Δu = F','segunda ordem + imperfeição modal','v0.29')}
        {choice('corotational','Geom. não linear 3D','R(u) = Fext − Fint','SO(3) + Newton–Raphson','v0.30 exp')}
      </div>
      {issues.length>0&&<div data-testid="spatial-analysis-incompatibilities" className="panel-warning"><b>{mode==='corotational'?'Co‑rotacional 3D':mode==='pdelta'?'P‑Delta 3D':mode==='modal'?'Modal 3D':'Análise'} indisponível neste modelo:</b><ul>{issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      {hasImperfection&&['pdelta','corotational'].includes(mode)&&<div data-testid="spatial-imperfection-note" className="panel-note"><b>Imperfeição modal ativa:</b> modo {imperfection.mode||1}, e₀,max={num(imperfection.amplitudeMm,0).toFixed(2)} mm, referência {imperfection.scenarioId||project.settings?.analysisScenarioId||'cenário atual'}. {mode==='corotational'?'A v0.30 usa a forma como geometria inicial sem tensões e resolve somente Δu.':'A v0.29 usa a carga geométrica equivalente para amplificar u₀.'}</div>}
      {mode==='modal'&&<section className="react-card" data-testid="spatial-modal-controls"><div className="section-title"><h3>Dinâmica modal 3D</h3><span className="chip">linear-elástica</span></div><div className="geometry-grid"><label>Nº de modos<input data-testid="modal-mode-count" type="number" min="1" max="20" value={modalModes} onChange={e=>setModalModes(num(e.target.value,6))}/></label><label>Matriz de massa<select data-testid="dynamic-mass-formulation" value={massFormulation} onChange={e=>setMassFormulation(e.target.value)}><option value="consistent">Consistente</option><option value="lumped">Concentrada</option></select></label></div></section>}
      {mode==='pdelta'&&<section className="react-card" data-testid="spatial-pdelta-controls"><div className="section-title"><h3>Controle P‑Delta 3D · v0.29</h3><span className="chip">Kg espacial</span></div><div className="geometry-grid"><label>Máx. iterações<input data-testid="pdelta-max-iterations" type="number" min="2" max="100" value={pMaxIt} onChange={e=>setPMaxIt(num(e.target.value,30))}/></label><label>Tolerância<input data-testid="pdelta-tolerance" type="number" min="1e-12" step="1e-8" value={pTol} onChange={e=>setPTol(num(e.target.value,1e-8))}/></label></div><div className="panel-note">A rigidez geométrica atua nos dois planos principais. A imperfeição modal, quando ativa, é reportada separadamente como u₀, Δu e u_total.</div></section>}
      {mode==='corotational'&&<section className="react-card" data-testid="spatial-corotational-controls"><div className="section-title"><h3>Co‑rotacional 3D · v0.30 experimental</h3><span className="chip">SO(3)</span></div><div className="geometry-grid"><label>Incrementos<input data-testid="nonlinear-steps" type="number" min="1" max="100" value={steps} onChange={e=>setSteps(num(e.target.value,12))}/></label><label>Máx. iterações<input data-testid="nonlinear-max-iterations" type="number" min="3" max="80" value={maxIt} onChange={e=>setMaxIt(num(e.target.value,35))}/></label><label>Tolerância<input data-testid="nonlinear-tolerance" type="number" min="1e-10" step="1e-8" value={tol} onChange={e=>setTol(num(e.target.value,1e-8))}/></label><label className="checkbox-line"><input data-testid="nonlinear-line-search" type="checkbox" checked={lineSearch} onChange={e=>setLineSearch(e.target.checked)}/><span>Line search</span></label></div><div className="panel-note">Escopo validado: frame3d elástico Euler–Bernoulli, grandes rotações/translações, cargas nodais, uniforme local, pontual local e peso próprio global −Z. A tangente é uma aproximação central da Jacobiana consistente. A imperfeição modal é uma referência geométrica sem tensões.</div><div className="panel-warning">Ainda fora do escopo v0.30: plasticidade 3D, ligações semirrígidas/releases, molas nodais, recalques, follower 3D e ações térmicas 3D. Use validação independente antes de emprego profissional.</div></section>}
      <div className="commit-bar"><span>{mode==='corotational'?'Solver experimental validado contra o limite linear, P‑Delta, objetividade e equilíbrio.':mode==='pdelta'?'Segunda ordem elástica espacial.':mode==='modal'?'Autovalores lineares com massa consistente/concentrada.':'Análise elástica linear espacial.'}</span><div className="commit-actions"><button onClick={onClose}>Cancelar</button><button data-testid="analysis-apply" className="primary" disabled={issues.length>0} onClick={apply}>Aplicar</button></div></div>
    </section>
  </div>;
}
