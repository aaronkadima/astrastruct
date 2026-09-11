import React, { useMemo, useState } from 'react';
// @ts-ignore
import { normalizeProject } from '../../web/src/core/model.js';

const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const explicitSpring=(v:any)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

type Props={project:any;onClose:()=>void;onCommit:(project:any)=>void};

function incompatibilities(project:any){
  const issues:string[]=[];
  if(!project.elements?.length)issues.push('O modelo não possui elementos.');
  if((project.elements||[]).some((e:any)=>e.type!=='frame2d'))issues.push('Somente elementos frame2d são aceitos nesta versão.');
  if((project.elements||[]).some((e:any)=>e.releases?.rz1||e.releases?.rz2||explicitSpring(e.rotationalSprings?.rz1)||explicitSpring(e.rotationalSprings?.rz2)))issues.push('Releases e ligações semirrígidas ainda não são aceitos.');
  if((project.elementLoads||[]).length)issues.push('Cargas de barra, peso próprio e ações térmicas ainda não são aceitos; use apenas cargas nodais.');
  if((project.nodeSprings||[]).length)issues.push('Molas nodais ainda não são aceitas.');
  if((project.settlements||[]).length)issues.push('Recalques/deslocamentos impostos ainda não são aceitos.');
  return issues;
}

export function AnalysisPanelV13({project,onClose,onCommit}:Props){
  const [mode,setMode]=useState(project.settings?.analysisType||'linear');
  const [pMaxIt,setPMaxIt]=useState(project.settings?.pDeltaMaxIterations||30);
  const [pTol,setPTol]=useState(project.settings?.pDeltaTolerance||1e-8);
  const [steps,setSteps]=useState(project.settings?.nonlinearSteps||20);
  const [maxIt,setMaxIt]=useState(project.settings?.nonlinearMaxIterations||35);
  const [tol,setTol]=useState(project.settings?.nonlinearTolerance||1e-8);
  const [lineSearch,setLineSearch]=useState(project.settings?.nonlinearLineSearch!==false);
  const pureFrame=project.elements?.length>0&&project.elements.every((e:any)=>e.type==='frame2d');
  const issues=useMemo(()=>incompatibilities(project),[project]);
  const nonlinearOk=pureFrame&&!issues.length;
  const apply=()=>{
    const p=clone(project);
    p.settings.analysisType=mode;
    p.settings.pDeltaMaxIterations=Math.max(2,Math.min(100,Math.round(num(pMaxIt,30))));
    p.settings.pDeltaTolerance=Math.max(1e-12,num(pTol,1e-8));
    p.settings.nonlinearSteps=Math.max(1,Math.min(200,Math.round(num(steps,20))));
    p.settings.nonlinearMaxIterations=Math.max(3,Math.min(100,Math.round(num(maxIt,35))));
    p.settings.nonlinearTolerance=Math.max(1e-12,num(tol,1e-8));
    p.settings.nonlinearLineSearch=!!lineSearch;
    onCommit(normalizeProject(p));onClose();
  };
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section data-testid="panel-analysis" className="react-modal" role="dialog" aria-modal="true" aria-label="Tipo de análise">
      <header className="react-modal-head"><div><h2>Tipo de análise</h2><p>Formulação usada pelo cenário estrutural.</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="analysis-choices analysis-choices-v13">
        <button data-testid="analysis-linear" className={mode==='linear'?'active':''} onClick={()=>setMode('linear')}><b>Linear</b><span>K u = F</span><small>Pequenas deformações.</small></button>
        <button data-testid="analysis-pdelta" disabled={!pureFrame} className={mode==='pdelta'?'active':''} onClick={()=>setMode('pdelta')}><b>P‑Delta</b><span>[K + Kg(N)] u = F</span><small>Segunda ordem iterativa.</small></button>
        <button data-testid="analysis-corotational" disabled={!nonlinearOk} className={mode==='corotational'?'active':''} onClick={()=>setMode('corotational')}><b>Geom. não linear</b><span>Co‑rotacional + Newton–Raphson</span><small>Grandes rotações · experimental v0.13.</small></button>
      </div>
      {!pureFrame&&<div className="panel-warning">P‑Delta e co‑rotacional exigem modelos formados somente por frame2d.</div>}
      {pureFrame&&issues.length>0&&<div data-testid="corotational-incompatibilities" className="panel-warning"><b>Co‑rotacional indisponível neste modelo:</b><ul>{issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      {mode==='pdelta'&&<section className="react-card"><h3>Controle P‑Delta</h3><div className="geometry-grid"><label>Máx. iterações<input data-testid="pdelta-max-iterations" type="number" min="2" max="100" value={pMaxIt} onChange={e=>setPMaxIt(num(e.target.value,30))}/></label><label>Tolerância<input data-testid="pdelta-tolerance" type="number" value={pTol} onChange={e=>setPTol(num(e.target.value,1e-8))}/></label></div></section>}
      {mode==='corotational'&&<section className="react-card" data-testid="corotational-controls"><h3>Newton–Raphson incremental</h3><div className="geometry-grid"><label>Incrementos<input data-testid="nonlinear-steps" type="number" min="1" max="200" value={steps} onChange={e=>setSteps(num(e.target.value,20))}/></label><label>Máx. iterações<input data-testid="nonlinear-max-iterations" type="number" min="3" max="100" value={maxIt} onChange={e=>setMaxIt(num(e.target.value,35))}/></label><label>Tolerância<input data-testid="nonlinear-tolerance" type="number" value={tol} onChange={e=>setTol(num(e.target.value,1e-8))}/></label><label className="checkbox-line"><input data-testid="nonlinear-line-search" type="checkbox" checked={lineSearch} onChange={e=>setLineSearch(e.target.checked)}/><span>Line search</span></label></div><div className="panel-warning">Escopo v0.13: frame2d Euler–Bernoulli, extremidades rígidas, cargas nodais e apoios clássicos. Sem não linearidade material, contato, cargas de barra, molas ou recalques.</div></section>}
      <div className="commit-bar"><span>{mode==='corotational'?'Modo experimental: valide independentemente antes de uso profissional.':'Linear permanece o padrão; P‑Delta não substitui análise de flambagem/autovalores.'}</span><div className="commit-actions"><button onClick={onClose}>Cancelar</button><button data-testid="analysis-apply" className="primary" disabled={mode==='corotational'&&!nonlinearOk} onClick={apply}>Aplicar</button></div></div>
    </section>
  </div>;
}
