import React,{useState}from'react';
// @ts-ignore
import{nbr6118Baseline,validateNBR6118Baseline}from'../../web/src/core/nbr6118Baseline.js';

type Props={
  project:any;
  result:any;
  activeScenario?:string;
  onScenarioChange:(id:string)=>void;
  onAnalyze:()=>void;
  onOpenPanel:(name:any)=>void;
  onCommit:(p:any,record?:boolean)=>void;
};

const fmt=(v:any,d=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);
const projectLevels=(p:any)=>{
  const explicit=(p.levels||[])
    .filter((x:any)=>Number.isFinite(Number(x.elevation)))
    .sort((a:any,b:any)=>Number(a.elevation)-Number(b.elevation));
  if(explicit.length)return explicit;
  const zs=[...new Set((p.nodes||[]).map((n:any)=>Number(n.z)||0))].sort((a:number,b:number)=>a-b);
  return zs.map((z:number,i:number)=>({id:`Z${i}`,name:i===0?'Base':`Pav. ${i}`,elevation:z}));
};
const countType=(p:any,type:string)=>(p.elements||[]).filter((e:any)=>e.type===type).length;

function Ribbon({project,result,activeScenario,onScenarioChange,onAnalyze,onOpenPanel}:Props){
  const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])];
  return <div className="eng-ribbon" data-testid="engineering-ribbon">
    <div className="eng-ribbon-group">
      <button onClick={()=>onOpenPanel('properties')}><b>▱</b><span>Lançamento<small>Modelagem</small></span></button>
      <button data-testid="engineering-ribbon-analyze" onClick={onAnalyze}><b>▷</b><span>Análise<small>Processar</small></span></button>
      <button onClick={()=>onOpenPanel('actions')}><b>▦</b><span>Combinações<small>ELU / ELS</small></span></button>
      <button onClick={()=>onOpenPanel('postprocess')}><b>▥</b><span>Resultados<small>Diagramas / Mapas</small></span></button>
      <button onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:engineering-review-open',{detail:{tab:'foundation',source:'engineering-ribbon'}}))}><b>⌗</b><span>Detalhamento<small>Armaduras</small></span></button>
      <button onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:foundation-dashboard-open',{detail:{source:'engineering-ribbon'}}))}><b>⌂</b><span>Fundação<small>Sapatas / Estacas</small></span></button>
      <button onClick={()=>document.querySelector<HTMLElement>('[data-testid="spatial3d-display-mode"]')?.focus()}><b>▣</b><span>Visualização<small>Vistas / Filtros</small></span></button>
      <button onClick={()=>onOpenPanel('properties')}><b>⚙</b><span>NBR 6118<small>Parâmetros</small></span></button>
    </div>
    <div className="eng-ribbon-scenario">
      <label>Combinação
        <select aria-label="Combinação do ribbon" value={activeScenario||''} onChange={e=>onScenarioChange(e.target.value)}>
          {scenarios.map((s:any)=><option key={s.id} value={s.id}>{s.name||s.id}</option>)}
        </select>
      </label>
      <span className={result?'done':'idle'}>{result?'● Análise disponível':'○ Modelo não analisado'}</span>
    </div>
  </div>;
}

export function EngineeringModelExplorer({project,result,onCommit,onAnalyze,onOpenPanel}:Pick<Props,'project'|'result'|'onCommit'|'onAnalyze'|'onOpenPanel'>){
  const[tab,setTab]=useState('model');
  const[query,setQuery]=useState('');
  const base=project.settings?.normativeBaseline||nbr6118Baseline();
  const validation=validateNBR6118Baseline(project);
  const lvls=projectLevels(project);
  const setExposure=(exposureClass:string)=>onCommit({
    ...project,
    settings:{...(project.settings||{}),normativeBaseline:nbr6118Baseline({...base,exposureClass})}
  },true);
  const patchSettings=(patch:any)=>onCommit({...project,settings:{...(project.settings||{}),...patch}},true);
  const visible=(label:string)=>!query.trim()||label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
  return <div className="eng-model-explorer" data-testid="engineering-model-explorer">
    <div className="eng-side-tabs">
      <button className={tab==='model'?'active':''} onClick={()=>setTab('model')}>Modelo</button>
      <button className={tab==='results'?'active':''} onClick={()=>setTab('results')}>Resultados</button>
      <button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}>Relatórios</button>
    </div>
    {tab==='model'?<>
      <input className="eng-search" aria-label="Buscar no modelo" placeholder="Buscar no modelo…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="eng-tree">
        <details open><summary>▣ {project.name||'Projeto'}</summary>
          {visible('pavimentos')&&<details open><summary>▾ Pavimentos ({lvls.length})</summary>{lvls.slice().reverse().filter((l:any)=>visible(l.name||l.id)).map((l:any)=><div key={l.id}>└ {l.name||l.id}</div>)}</details>}
          {visible('elementos pilares vigas treliças lajes paredes')&&<details open><summary>▾ Elementos</summary><div>├ Pilares / vigas ({countType(project,'frame3d')+countType(project,'frame2d')})</div><div>├ Treliças ({countType(project,'truss3d')+countType(project,'truss2d')})</div><div>└ Lajes / paredes ({countType(project,'shell4')})</div></details>}
          {visible('fundações fundações apoios estacas sapatas')&&<details open><summary>▾ Fundações</summary><div>├ Itens explícitos ({project.foundationReview?.items?.length||0})</div><div>└ Apoios ({project.supports?.length||0})</div></details>}
          {visible('cargas permanentes variáveis vento')&&<details><summary>▸ Cargas</summary><div>Permanentes / variáveis / vento</div></details>}
          {visible('combinações elu els')&&<details><summary>▸ Combinações</summary><div>ELU / ELS: {project.loadCombinations?.length||0}</div></details>}
          {visible('casos análise linear modal espectral não linear')&&<details><summary>▸ Casos de análise</summary><div>{project.settings?.analysisType||'linear'}</div></details>}
        </details>
      </div>
      <div className="eng-launch">
        <h4>Parâmetros de lançamento</h4>
        <label>Norma<input readOnly value="NBR 6118:2023"/></label>
        <label>CAA<select value={base.exposureClass||'II'} onChange={e=>setExposure(e.target.value)}><option>I</option><option>II</option><option>III</option><option>IV</option></select></label>
        <label>fck mínimo<input readOnly value={`${base.minFckMpa} MPa`}/></label>
        <label>Cobrimento laje<input readOnly value={`${base.nominalCoverMm?.slab} mm`}/></label>
        <label>Unidades<select value={project.settings?.units||'kN-m'} onChange={e=>patchSettings({units:e.target.value})}><option value="kN-m">kN, m, °C</option><option value="N-mm">N, mm, °C</option></select></label>
        <label>Malha de lajes<select value={String(project.settings?.grid||base.slabMeshM||.5)} onChange={e=>patchSettings({grid:Number(e.target.value)})}><option value="0.1">0,10 m</option><option value="0.25">0,25 m</option><option value="0.5">0,50 m</option><option value="1">1,00 m</option></select></label>
        <label>Tipo de análise<select value={project.settings?.analysisType||'linear'} onChange={e=>patchSettings({analysisType:e.target.value})}><option value="linear">Linear (1ª ordem)</option><option value="pdelta">P-Delta</option><option value="modal">Modal</option><option value="corotational">Não linear geométrica</option></select></label>
        <div className={validation.ok?'eng-check ok':'eng-check warn'}>{validation.ok?'✓ Baseline de lançamento atendido':`⚠ ${validation.issues.length} pendência(s) no baseline`}</div>
        <button className="eng-run" data-testid="engineering-sidebar-analyze" onClick={onAnalyze}>▷ Executar análise</button>
      </div>
    </>:tab==='results'?<div className="eng-tab-empty">{result?'Resultados disponíveis. Use a tabela inferior e os mapas 3D.':'Execute a análise para preencher resultados.'}<button onClick={onAnalyze}>Executar análise</button></div>:<div className="eng-tab-empty">Relatórios técnicos permanecem disponíveis no módulo de relatório.<button onClick={()=>onOpenPanel('report')}>Abrir relatório técnico</button></div>}
  </div>;
}

function LateralDiagram({result}:{result:any}){
  const vis=result?.engineeringVisualization;
  const floors=vis?.floors?.levels||[];
  const drifts=vis?.floors?.storyDrifts||[];
  const max=Math.max(1,...floors.map((f:any)=>Math.abs(Number(f.uxMm)||0)));
  const h=188,w=260,pad=22;
  const zs=floors.map((f:any)=>Number(f.elevation)||0),zmin=Math.min(0,...zs),zmax=Math.max(1,...zs);
  const pts=floors.map((f:any)=>{
    const y=h-pad-(Number(f.elevation)-zmin)/(zmax-zmin)*(h-2*pad);
    const x=w*.46+(Number(f.uxMm)||0)/max*w*.26;
    return{x,y,label:f.label||f.id,value:f.uxMm};
  });
  return <svg viewBox={`0 0 ${w} ${h}`} className="eng-lateral-svg" aria-label="Vista lateral de deslocamentos">
    <line x1={w*.46} y1={pad} x2={w*.46} y2={h-pad} stroke="#808c96" strokeDasharray="4 3"/>
    {pts.map((p:any,i:number)=><g key={i}><line x1={w*.42} y1={p.y} x2={w*.78} y2={p.y} stroke="#d2dae0"/><text x={w*.80} y={p.y+3} fontSize="8" fill="#44515d">{p.label}</text></g>)}
    {pts.length>1&&<polyline points={pts.map((p:any)=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#d4493f" strokeWidth="3"/>}
    {pts.map((p:any,i:number)=><circle key={`c${i}`} cx={p.x} cy={p.y} r="2.5" fill={i===pts.length-1?'#d4493f':'#1f8d74'}/>)}
    {!pts.length&&<text x="20" y="95" fontSize="11" fill="#71808d">Execute a análise para a deformada lateral.</text>}
    <text x="8" y="14" fontSize="9" fontWeight="700" fill="#31546d">Deslocamento global X · mm</text>
    <text x="8" y={h-6} fontSize="8" fill="#6f7d88">drift máx.: {fmt(Math.max(0,...drifts.map((d:any)=>100*Math.abs(Number(d.driftRatio)||0))),3)}%</text>
  </svg>;
}

function FoundationDiagram({project}:{project:any}){
  const supports=(project.supports||[]).slice(0,12);
  const cols=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,supports.length))));
  return <svg viewBox="0 0 260 118" className="eng-foundation-svg" aria-label="Vista inferior das fundações">
    <rect x="18" y="12" width="224" height="72" fill="#eef1f3" stroke="#9aa5ad"/>
    {supports.map((s:any,i:number)=>{
      const c=i%cols,r=Math.floor(i/cols);
      const denominator=Math.max(1,cols-1),x=cols===1?130:42+c*(176/denominator),y=30+r*28;
      return <g key={i}><rect x={x-10} y={y-7} width="20" height="14" fill="#aab0b4" stroke="#656e74"/><line x1={x-5} y1={y+7} x2={x-5} y2={y+31} stroke="#70787e" strokeWidth="3"/><line x1={x+5} y1={y+7} x2={x+5} y2={y+31} stroke="#70787e" strokeWidth="3"/></g>;
    })}
    <text x="20" y="108" fontSize="9" fill="#53616d">{supports.length} apoio(s) · fundação visível no workspace</text>
  </svg>;
}

export function EngineeringRightRail({project,result}:Pick<Props,'project'|'result'>){
  const vis=result?.engineeringVisualization;
  const maxDisp=vis?.displacement?.maxMagnitudeMm||0;
  const shells=vis?.shells?.elementCount||0;
  const analysisReady=!!vis?.detailReadiness?.analysisComplete;
  const foundationCount=vis?.foundation?.foundationCount||project.supports?.length||0;
  return <div className="eng-right-rail" data-testid="engineering-right-rail">
    <section><header>Vista lateral · deformada global</header><LateralDiagram result={result}/></section>
    <section><header>Vista inferior · Fundação</header><FoundationDiagram project={project}/></section>
    <section className="eng-legend">
      <header>Legenda de resultados</header>
      <select aria-label="Campo visual rápido" onChange={e=>{
        const core=document.querySelector<HTMLSelectElement>('select[aria-label="Campo de esforço 3D"]');
        if(core){core.value=e.target.value;core.dispatchEvent(new Event('change',{bubbles:true}));}
      }}>
        <option value="none">Deslocamento / deformada</option><option value="Mx">Laje Mx</option><option value="My">Laje My</option><option value="Nx">Laje Nx</option><option value="N">Barras N</option><option value="M">Barras M</option>
      </select>
      <div className="eng-gradient"/><div className="eng-legend-values"><span>−máx.</span><span>0</span><span>+máx.</span></div><small>u máx. {fmt(maxDisp,3)} mm · {shells} shell(s)</small>
    </section>
    <section className="eng-detail">
      <header>Detalhamento</header><div className="eng-detail-sketch"><span>▦</span><span>▥</span></div>
      <b>{analysisReady?'Detalhamento após análise':'Aguardando análise'}</b>
      <small>{analysisReady?'Resultados físicos disponíveis para iniciar desenho e revisão de armaduras.':'O detalhamento permanece bloqueado até existir um resultado físico do solver.'}</small>
      <button disabled={!analysisReady} onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:engineering-review-open',{detail:{tab:'foundation',source:'engineering-right-rail'}}))}>Visualizar detalhamento ›</button>
    </section>
    <section className="eng-status"><header>Status do projeto</header><div>✓ Baseline NBR 6118:2023 ativo</div><div>✓ Fundação visível ({foundationCount})</div><div className={analysisReady?'ok':'pending'}>{analysisReady?'✓':'○'} Detalhamento condicionado à análise</div><div className={result?'ok':'pending'}>{result?'✓':'○'} Deformada / tensões / deslocamentos</div></section>
  </div>;
}

export function EngineeringResultsStrip({result}:Pick<Props,'project'|'result'>){
  const[tab,setTab]=useState('Resultados');
  const vis=result?.engineeringVisualization,rows=vis?.floors?.levels||[];
  const reactions=result?.reactions||[];const forces=result?.elementForces||[];const displacements=result?.totalDisplacements||result?.displacements||[];const checks=result?.designChecks||result?.detailing?.reinforcement||[];
  return <div className="eng-results-strip" data-testid="engineering-results-strip">
    <div className="eng-result-tabs">{['Resultados','Reações de apoio','Esforços em elementos','Deslocamentos em nós','Armaduras (Resumo)'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div>
    {tab==='Resultados'&&<div className="eng-result-table"><table><thead><tr><th>Pavimento</th><th>Desloc. X (mm)</th><th>Desloc. Y (mm)</th><th>Desloc. Z (mm)</th><th>|u| (mm)</th><th>Drift X (%)</th><th>Drift Y (%)</th></tr></thead><tbody>
      {rows.length?rows.slice().reverse().map((r:any)=>{
        const drift=(vis?.floors?.storyDrifts||[]).find((d:any)=>d.levelId===r.id);
        return <tr key={r.id}><td>{r.label||r.id}</td><td>{fmt(r.uxMm,3)}</td><td>{fmt(r.uyMm,3)}</td><td>{fmt(r.uzMm,3)}</td><td>{fmt(r.resultantMm,3)}</td><td>{fmt(100*(drift?.driftX||0),3)}</td><td>{fmt(100*(drift?.driftY||0),3)}</td></tr>;
      }):<tr><td colSpan={7}>Execute uma análise 3D para preencher deslocamentos e drifts por pavimento.</td></tr>}
    </tbody></table></div>}
    {tab==='Reações de apoio'&&<div className="eng-result-table"><table><thead><tr><th>Nó</th><th>Fx [kN]</th><th>Fy [kN]</th><th>Fz [kN]</th><th>Mx [kN·m]</th><th>My [kN·m]</th><th>Mz [kN·m]</th></tr></thead><tbody>{reactions.length?reactions.map((r:any,i:number)=><tr key={r.nodeId||i}><td>{r.nodeId||'—'}</td><td>{fmt(r.fx??r.Fx,3)}</td><td>{fmt(r.fy??r.Fy,3)}</td><td>{fmt(r.fz??r.Fz,3)}</td><td>{fmt(r.mx??r.Mx,3)}</td><td>{fmt(r.my??r.My,3)}</td><td>{fmt(r.mz??r.Mz,3)}</td></tr>):<tr><td colSpan={7}>Nenhuma reação disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Esforços em elementos'&&<div className="eng-result-table"><table><thead><tr><th>Elemento</th><th>Tipo</th><th>N</th><th>V / Vy</th><th>Vz</th><th>M / My</th><th>Mz</th><th>T</th></tr></thead><tbody>{forces.length?forces.map((f:any,i:number)=><tr key={f.elementId||i}><td>{f.elementId||'—'}</td><td>{f.type||'barra'}</td><td>{fmt(f.N1??f.axialForce??f.Nx,3)}</td><td>{fmt(f.V1??f.Vy1??f.Qx,3)}</td><td>{fmt(f.Vz1??f.Qy,3)}</td><td>{fmt(f.M1??f.My1??f.Mx,3)}</td><td>{fmt(f.Mz1??f.My,3)}</td><td>{fmt(f.T1??f.Mxy,3)}</td></tr>):<tr><td colSpan={8}>Nenhum esforço disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Deslocamentos em nós'&&<div className="eng-result-table"><table><thead><tr><th>Nó</th><th>Ux [mm]</th><th>Uy [mm]</th><th>Uz [mm]</th><th>Rx [rad]</th><th>Ry [rad]</th><th>Rz [rad]</th></tr></thead><tbody>{displacements.length?displacements.map((d:any,i:number)=><tr key={d.nodeId||i}><td>{d.nodeId||'—'}</td><td>{fmt(1000*Number(d.ux||0),4)}</td><td>{fmt(1000*Number(d.uy||0),4)}</td><td>{fmt(1000*Number(d.uz||0),4)}</td><td>{fmt(d.rx,6)}</td><td>{fmt(d.ry,6)}</td><td>{fmt(d.rz,6)}</td></tr>):<tr><td colSpan={7}>Nenhum deslocamento disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Armaduras (Resumo)'&&<div className="eng-result-table"><table><thead><tr><th>Elemento</th><th>Verificação</th><th>Estado</th><th>Utilização</th><th>Armadura / detalhe</th></tr></thead><tbody>{checks.length?checks.map((c:any,i:number)=><tr key={c.id||i}><td>{c.elementId||c.id||'—'}</td><td>{c.limitState||c.category||c.type||'—'}</td><td>{c.status||'—'}</td><td>{fmt(c.utilization,3)}</td><td>{c.reinforcement||c.summary||c.detail||'—'}</td></tr>):<tr><td colSpan={5}>O resultado atual não contém detalhamento de armaduras. Abra Detalhamento após a análise.</td></tr>}</tbody></table></div>}
  </div>;
}

export function EngineeringRibbon(props:Props){return <Ribbon {...props}/>;}
