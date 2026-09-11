import React, { useState } from 'react';
// @ts-ignore
import { solveBuckling2D } from '../../web/src/solver/buckling2d.js';

const fmt=(v:any,d=4)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';

export function BucklingPanel({project,onClose,onVisualize}:{project:any;onClose:()=>void;onVisualize:(view:any|null)=>void}){
  const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])];
  const [scenarioId,setScenarioId]=useState(project.settings?.analysisScenarioId||project.loadCases?.[0]?.id||'');
  const [modeCount,setModeCount]=useState(5),[result,setResult]=useState<any>(null),[selected,setSelected]=useState(0),[error,setError]=useState(''),[running,setRunning]=useState(false);
  const calculate=()=>{
    try{setRunning(true);setError('');const r=solveBuckling2D(project,scenarioId,{modes:modeCount});setResult(r);setSelected(0);onVisualize({result:r,modeIndex:0})}
    catch(e:any){setResult(null);onVisualize(null);setError(e?.message||String(e))}
    finally{setRunning(false)}
  };
  const selectMode=(index:number)=>{setSelected(index);if(result)onVisualize({result,modeIndex:index})};
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section data-testid="panel-buckling" className="react-modal wide buckling-panel" role="dialog" aria-modal="true" aria-label="Estabilidade e flambagem linear">
      <header className="react-modal-head"><div><h2>Estabilidade · flambagem linear</h2><p>Autovalores de bifurcação para pórticos 2D, usando os esforços axiais do cenário de referência.</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="panel-warning">λcr multiplica o padrão de cargas de referência. Não é coeficiente de segurança nem verificação normativa. A v0.11 aceita somente frame2d com extremidades rígidas.</div>
      <div className="modal-toolbar buckling-toolbar"><label>Cenário de referência<select aria-label="Cenário de flambagem" value={scenarioId} onChange={e=>setScenarioId(e.target.value)}>{scenarios.map((s:any)=><option key={s.id} value={s.id}>{s.name||s.id}</option>)}</select></label><label>Modos<input aria-label="Número de modos" type="number" min="1" max="12" value={modeCount} onChange={e=>setModeCount(Math.max(1,Math.min(12,Math.round(Number(e.target.value)||1))))}/></label><button data-testid="buckling-calculate" className="primary" disabled={running} onClick={calculate}>{running?'Calculando…':'Calcular flambagem'}</button></div>
      {error&&<div className="error-banner" role="alert">{error}</div>}
      {!result&&!error&&<div className="buckling-empty"><b>Problema generalizado</b><span>K φ = λcr (−Kg,ref) φ</span><small>O estado linear de referência fornece os esforços normais usados em Kg.</small></div>}
      {result&&<>
        <div className="metrics-row buckling-metrics"><div><small>λcr,1</small><b data-testid="buckling-critical-factor">{fmt(result.criticalFactor,5)}</b></div><div><small>DOFs livres</small><b>{result.freeDofs}</b></div><div><small>Modos obtidos</small><b>{result.modes.length}</b></div><div><small>Iterações Jacobi</small><b>{result.eigenIterations}</b></div></div>
        <div className="buckling-layout"><section className="react-card"><h3>Modos críticos</h3><div className="table-scroll"><table><thead><tr><th>Modo</th><th>λcr</th><th>1/λ</th><th>Visualizar</th></tr></thead><tbody>{result.modes.map((m:any,i:number)=><tr key={m.mode} className={selected===i?'selected-row':''}><td>{m.mode}</td><td>{fmt(m.factor,6)}</td><td>{fmt(m.mu,6)}</td><td><button data-testid={`buckling-mode-${m.mode}`} className={selected===i?'primary':''} onClick={()=>selectMode(i)}>Modo {m.mode}</button></td></tr>)}</tbody></table></div></section>
        <section className="react-card"><h3>Esforços axiais de referência</h3><div className="table-scroll"><table><thead><tr><th>Elemento</th><th>Nref [kN]</th><th>Estado</th></tr></thead><tbody>{result.reference.elementAxialForces.map((x:any)=><tr key={x.elementId}><td>{x.elementId}</td><td>{fmt(x.N,3)}</td><td>{Number(x.N)<0?'Compressão':Number(x.N)>0?'Tração':'≈ 0'}</td></tr>)}</tbody></table></div><p className="hint">Convenção AstraStruct: N &gt; 0 em tração; compressão é negativa.</p></section></div>
      </>}
      <div className="commit-bar"><span>Primeiros modos próprios normalizados para visualização; amplitude não representa deslocamento físico.</span><div className="commit-actions"><button onClick={()=>{onVisualize(null)}}>Limpar modo</button><button className="primary" onClick={onClose}>Fechar</button></div></div>
    </section>
  </div>;
}
