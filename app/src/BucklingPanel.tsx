import React, { useState } from 'react';
// @ts-ignore
import { solveBuckling2D } from '../../web/src/solver/buckling2d.js';
// @ts-ignore
import { solveBuckling3D } from '../../web/src/solver/modalStability3d.js';
// @ts-ignore
import { inferProjectDimension } from '../../web/src/core/elementRegistry.js';

const fmt=(v:any,d=4)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const clone=(v:any)=>JSON.parse(JSON.stringify(v));

export function BucklingPanel({project,onClose,onVisualize,onCommit}:{project:any;onClose:()=>void;onVisualize:(view:any|null)=>void;onCommit:(project:any)=>void}){
  const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])],existing=project.settings?.imperfection,dimension=inferProjectDimension(project),is3D=dimension==='3d';
  const [scenarioId,setScenarioId]=useState(existing?.scenarioId||project.settings?.analysisScenarioId||project.loadCases?.[0]?.id||'');
  const [modeCount,setModeCount]=useState(Math.max(5,Number(existing?.mode)||1)),[result,setResult]=useState<any>(null),[selected,setSelected]=useState(Math.max(0,(Number(existing?.mode)||1)-1)),[amplitudeMm,setAmplitudeMm]=useState(Number(existing?.amplitudeMm)||10),[error,setError]=useState(''),[running,setRunning]=useState(false);
  const calculate=()=>{
    try{setRunning(true);setError('');const r=is3D?solveBuckling3D(project,scenarioId,{modes:modeCount}):solveBuckling2D(project,scenarioId,{modes:modeCount});const nextIndex=Math.min(selected,Math.max(0,r.modes.length-1));setResult(r);setSelected(nextIndex);onVisualize({result:r,modeIndex:nextIndex})}
    catch(e:any){setResult(null);onVisualize(null);setError(e?.message||String(e))}
    finally{setRunning(false)}
  };
  const selectMode=(index:number)=>{setSelected(index);if(result)onVisualize({result,modeIndex:index})};
  const applyImperfection=(target:'pdelta'|'corotational')=>{
    if(is3D){setError('Imperfeição modal automática 3D será habilitada quando P‑Delta/co‑rotacional 3D estiverem validados.');return}
    if(!result?.modes?.[selected]){setError('Calcule a flambagem e selecione um modo antes de definir a imperfeição.');return}
    if(!(amplitudeMm>0&&Number.isFinite(amplitudeMm))){setError('A amplitude da imperfeição deve ser positiva e finita em mm.');return}
    const mode=result.modes[selected],p=clone(project);p.settings={...(p.settings||{}),analysisType:target,imperfection:{enabled:true,source:'bucklingMode',scenarioId,mode:mode.mode,amplitudeMm}};onCommit(p);setError('');
  };
  const clearImperfection=()=>{const p=clone(project);p.settings={...(p.settings||{}),imperfection:{...(p.settings?.imperfection||{}),enabled:false}};onCommit(p)};
  const active=project.settings?.imperfection?.enabled,activeTarget=project.settings?.analysisType==='corotational'?'co‑rotacional':project.settings?.analysisType==='pdelta'?'P‑Delta':'análise configurada';
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section data-testid="panel-buckling" className="react-modal wide buckling-panel" role="dialog" aria-modal="true" aria-label="Estabilidade e flambagem linear">
      <header className="react-modal-head"><div><h2>Estabilidade · flambagem linear</h2><p>{is3D?'Autovalores espaciais para frame3d, com flexão nos dois planos principais e esforços axiais do cenário de referência.':'Autovalores de bifurcação para pórticos 2D, usando os esforços axiais do cenário de referência.'}</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="panel-warning">λcr multiplica o padrão de cargas de referência. Não é coeficiente de segurança nem verificação normativa. {is3D?'A v0.27 cobre flambagem linear de frame3d; não ativa automaticamente imperfeição, P‑Delta ou co‑rotacional 3D.':'A flambagem 2D v0.11 aceita frame2d com extremidades rígidas; a imperfeição modal segue esse escopo.'}</div>
      <div className="modal-toolbar buckling-toolbar"><label>Cenário de referência<select aria-label="Cenário de flambagem" value={scenarioId} onChange={e=>setScenarioId(e.target.value)}>{scenarios.map((s:any)=><option key={s.id} value={s.id}>{s.name||s.id}</option>)}</select></label><label>Modos<input aria-label="Número de modos" type="number" min="1" max="12" value={modeCount} onChange={e=>setModeCount(Math.max(1,Math.min(12,Math.round(Number(e.target.value)||1))))}/></label><button data-testid="buckling-calculate" className="primary" disabled={running} onClick={calculate}>{running?'Calculando…':'Calcular flambagem'}</button></div>
      {active&&<div data-testid="imperfection-active" className="panel-warning success-note">Imperfeição ativa em <b>{activeTarget}</b>: modo {project.settings.imperfection.mode}, e₀,max = {fmt(project.settings.imperfection.amplitudeMm,2)} mm, referência {project.settings.imperfection.scenarioId||'cenário atual'}.</div>}
      {error&&<div className="error-banner" role="alert">{error}</div>}
      {!result&&!error&&<div className="buckling-empty"><b>Problema generalizado</b><span>K φ = λcr (−Kg,ref) φ</span><small>O estado linear de referência fornece os esforços normais usados em Kg.</small></div>}
      {result&&<>
        <div className="metrics-row buckling-metrics"><div><small>λcr,1</small><b data-testid="buckling-critical-factor">{fmt(result.criticalFactor,5)}</b></div><div><small>DOFs livres</small><b>{result.freeDofs}</b></div><div><small>Modos obtidos</small><b>{result.modes.length}</b></div><div><small>Iterações Jacobi</small><b>{result.eigenIterations}</b></div></div>
        <div className="buckling-layout"><section className="react-card"><h3>Modos críticos</h3><div className="table-scroll"><table><thead><tr><th>Modo</th><th>λcr</th><th>1/λ</th><th>Visualizar</th></tr></thead><tbody>{result.modes.map((m:any,i:number)=><tr key={m.mode} className={selected===i?'selected-row':''}><td>{m.mode}</td><td>{fmt(m.factor,6)}</td><td>{fmt(m.mu,6)}</td><td><button data-testid={`buckling-mode-${m.mode}`} className={selected===i?'primary':''} onClick={()=>selectMode(i)}>Modo {m.mode}</button></td></tr>)}</tbody></table></div></section>
        <section className="react-card"><h3>Esforços axiais de referência</h3><div className="table-scroll"><table><thead><tr><th>Elemento</th><th>Nref [kN]</th><th>Estado</th></tr></thead><tbody>{result.reference.elementAxialForces.map((x:any)=><tr key={x.elementId}><td>{x.elementId}</td><td>{fmt(x.N,3)}</td><td>{Number(x.N)<0?'Compressão':Number(x.N)>0?'Tração':'≈ 0'}</td></tr>)}</tbody></table></div><p className="hint">Convenção AstraStruct: N &gt; 0 em tração; compressão é negativa.</p></section></div>
        <section className="react-card imperfection-card"><div className="section-title"><div><h3>Imperfeição geométrica modal</h3><p className="hint">A forma selecionada é normalizada para que a maior translação seja e₀. O valor é definido pelo usuário; nenhuma razão L/n normativa é assumida.</p></div></div><div className="modal-toolbar"><label>Modo usado<b>{result.modes[selected]?.mode||'—'}</b></label><label>e₀,max [mm]<input data-testid="imperfection-amplitude" aria-label="Amplitude da imperfeição" type="number" min="0.001" step="0.5" value={amplitudeMm} onChange={e=>setAmplitudeMm(Number(e.target.value))}/></label>{!is3D&&<><button data-testid="apply-imperfection" className="primary" onClick={()=>applyImperfection('pdelta')}>Usar no P‑Delta</button><button data-testid="apply-corotational-imperfection" className="primary" onClick={()=>applyImperfection('corotational')}>Usar no co‑rotacional</button></>}{active&&<button data-testid="clear-imperfection" onClick={clearImperfection}>Desativar</button>}</div><div className="panel-note">{is3D?<><b>v0.27 3D:</b> Kφ = λcr(−Kg,ref)φ, com duas famílias de flexão espacial. A forma pode ser inspecionada, mas ainda não é transferida como imperfeição para uma análise não linear 3D.</>:<><b>P‑Delta:</b> usa carga geométrica equivalente, [K+Kg]Δu = F − Kg u₀. <b>Co‑rotacional:</b> usa xᵣ=x₀+u₀ como geometria de referência <b>sem tensões</b>.</>}</div></section>
      </>}
      <div className="commit-bar"><span>Primeiros modos próprios normalizados para visualização; amplitude gráfica do modo não representa deslocamento físico até ser definida como e₀.</span><div className="commit-actions"><button onClick={()=>{onVisualize(null)}}>Limpar modo</button><button className="primary" onClick={onClose}>Fechar</button></div></div>
    </section>
  </div>;
}
