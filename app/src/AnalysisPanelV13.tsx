import React, { useMemo, useState } from 'react';
// @ts-ignore
import { normalizeProject, uid } from '../../web/src/core/model.js';

const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const explicitSpring=(v:any)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const supportedLoad=(kind:any)=>kind==='uniform'||kind==='selfWeight'||kind==='point'||kind==='thermal'||kind==='followerEnd';
const referenceDeadLoad=(kind:any)=>kind==='uniform'||kind==='selfWeight'||kind==='point';
const endState=(e:any,key:'rz1'|'rz2')=>{
  if(e.releases?.[key])return{kind:'release',k:0};
  const raw=e.rotationalSprings?.[key];
  if(explicitSpring(raw))return{kind:Number(raw)===0?'release':'semirigid',k:Number(raw)};
  return{kind:'rigid',k:Infinity};
};
const hasFlexibleEnds=(project:any)=>(project.elements||[]).some((e:any)=>e.releases?.rz1||e.releases?.rz2||explicitSpring(e.rotationalSprings?.rz1)||explicitSpring(e.rotationalSprings?.rz2));

type Props={project:any;onClose:()=>void;onCommit:(project:any)=>void};

function incompatibilities(project:any){
  const issues:string[]=[];
  if(!project.elements?.length)issues.push('O modelo não possui elementos.');
  if((project.elements||[]).some((e:any)=>e.type!=='frame2d'))issues.push('Somente elementos frame2d são aceitos nesta versão.');
  for(const e of project.elements||[])for(const key of ['rz1','rz2'] as const){const raw=e.rotationalSprings?.[key];if(explicitSpring(raw)&&Number(raw)<0)issues.push(`Ligação ${e.id}/${key}: kθ deve ser não negativo.`)}
  const unsupported=[...new Set((project.elementLoads||[]).filter((l:any)=>!supportedLoad(l.kind)).map((l:any)=>String(l.kind||'desconhecida')))];
  if(unsupported.length)issues.push(`Cargas de barra ainda não suportadas no co‑rotacional: ${unsupported.join(', ')}.`);
  if((project.elementLoads||[]).some((l:any)=>l.kind==='followerEnd'&&Number(l.end??2)!==2))issues.push('A força seguidora concentrada está disponível somente na extremidade 2 nesta versão.');
  if((project.nodeSprings||[]).length)issues.push('Molas nodais ainda não são aceitas.');
  if((project.settlements||[]).length)issues.push('Recalques/deslocamentos impostos ainda não são aceitos.');
  if((project.supports||[]).some((s:any)=>[s.baseUxValue,s.baseUyValue,s.baseRzValue,s.uxValue,s.uyValue,s.rzValue].some(v=>Math.abs(num(v))>1e-12)))issues.push('Deslocamentos prescritos diretamente nos apoios ainda não são aceitos.');
  if(project.settings?.imperfection?.enabled&&hasFlexibleEnds(project))issues.push('Imperfeição modal co‑rotacional ainda requer extremidades rígidas, pois o solver de flambagem linear usado para obter o modo ainda não foi generalizado para releases/semirrígidas. Desative a imperfeição ou use P‑Delta para este modelo.');
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
  const [elementLoads,setElementLoads]=useState<any[]>(()=>clone(project.elementLoads||[]));
  const frames=(project.elements||[]).filter((e:any)=>e.type==='frame2d');
  const [followerElementId,setFollowerElementId]=useState(frames[0]?.id||'');
  const activeCaseId=project.settings?.activeLoadCaseId||project.loadCases?.[0]?.id;
  const effectiveProject=useMemo(()=>({...project,elementLoads}),[project,elementLoads]);
  const pureFrame=project.elements?.length>0&&project.elements.every((e:any)=>e.type==='frame2d');
  const referenceLoads=elementLoads.filter((l:any)=>referenceDeadLoad(l.kind));
  const thermalLoads=elementLoads.filter((l:any)=>l.kind==='thermal');
  const followerLoads=elementLoads.filter((l:any)=>l.kind==='followerEnd');
  const selectedFollowers=followerLoads.filter((l:any)=>l.caseId===activeCaseId&&l.elementId===followerElementId);
  const pointCount=referenceLoads.filter((l:any)=>l.kind==='point').length;
  const distributedCount=referenceLoads.length-pointCount;
  const connectionStates=frames.flatMap((e:any)=>(['rz1','rz2'] as const).map(key=>({elementId:e.id,key,...endState(e,key)})));
  const semirigidCount=connectionStates.filter(c=>c.kind==='semirigid').length,releaseCount=connectionStates.filter(c=>c.kind==='release').length,flexibleEndCount=semirigidCount+releaseCount;
  const imperfection=project.settings?.imperfection,hasImperfection=!!imperfection?.enabled;
  const issues=useMemo(()=>incompatibilities(effectiveProject),[effectiveProject]);
  const nonlinearOk=pureFrame&&!issues.length;
  const followerRequiresCorotational=mode!=='corotational'&&followerLoads.length>0;
  const addFollower=()=>{if(!followerElementId)return;setMode('corotational');setElementLoads(old=>[...old,{id:uid('FOL'),caseId:activeCaseId,elementId:followerElementId,kind:'followerEnd',end:2,px:0,py:-10}])};
  const patchFollower=(id:string,key:'px'|'py',value:number)=>setElementLoads(old=>old.map((l:any)=>l.id===id?{...l,[key]:value}:l));
  const removeFollower=(id:string)=>setElementLoads(old=>old.filter((l:any)=>l.id!==id));
  const apply=()=>{
    const p=clone(project);p.elementLoads=clone(elementLoads);p.settings.analysisType=mode;
    p.settings.pDeltaMaxIterations=Math.max(2,Math.min(100,Math.round(num(pMaxIt,30))));p.settings.pDeltaTolerance=Math.max(1e-12,num(pTol,1e-8));
    p.settings.nonlinearSteps=Math.max(1,Math.min(200,Math.round(num(steps,20))));p.settings.nonlinearMaxIterations=Math.max(3,Math.min(100,Math.round(num(maxIt,35))));p.settings.nonlinearTolerance=Math.max(1e-12,num(tol,1e-8));p.settings.nonlinearLineSearch=!!lineSearch;
    onCommit(normalizeProject(p));onClose();
  };
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section data-testid="panel-analysis" className="react-modal" role="dialog" aria-modal="true" aria-label="Tipo de análise">
      <header className="react-modal-head"><div><h2>Tipo de análise</h2><p>Formulação usada pelo cenário estrutural.</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="analysis-choices analysis-choices-v13">
        <button data-testid="analysis-linear" className={mode==='linear'?'active':''} onClick={()=>setMode('linear')}><b>Linear</b><span>K u = F</span><small>Pequenas deformações.</small></button>
        <button data-testid="analysis-pdelta" disabled={!pureFrame} className={mode==='pdelta'?'active':''} onClick={()=>setMode('pdelta')}><b>P‑Delta</b><span>[K + Kg(N)] u = F</span><small>Segunda ordem iterativa.</small></button>
        <button data-testid="analysis-corotational" disabled={!nonlinearOk} className={mode==='corotational'?'active':''} onClick={()=>setMode('corotational')}><b>Geom. não linear</b><span>Co‑rotacional + Newton–Raphson</span><small>Grandes rotações · experimental v0.13.6.</small></button>
      </div>
      {!pureFrame&&<div className="panel-warning">P‑Delta e co‑rotacional exigem modelos formados somente por frame2d.</div>}
      {pureFrame&&issues.length>0&&<div data-testid="corotational-incompatibilities" className="panel-warning"><b>Co‑rotacional indisponível neste modelo:</b><ul>{issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      {followerRequiresCorotational&&<div data-testid="follower-mode-warning" className="panel-warning"><b>Força seguidora exige Geom. não linear.</b> Remova as ações follower ou selecione o solver co‑rotacional para evitar que uma ação dependente da configuração seja tratada incorretamente.</div>}
      {mode==='pdelta'&&<section className="react-card"><h3>Controle P‑Delta</h3><div className="geometry-grid"><label>Máx. iterações<input data-testid="pdelta-max-iterations" type="number" min="2" max="100" value={pMaxIt} onChange={e=>setPMaxIt(num(e.target.value,30))}/></label><label>Tolerância<input data-testid="pdelta-tolerance" type="number" value={pTol} onChange={e=>setPTol(num(e.target.value,1e-8))}/></label></div></section>}
      {mode==='corotational'&&<section className="react-card" data-testid="corotational-controls"><h3>Newton–Raphson incremental</h3><div className="geometry-grid"><label>Incrementos<input data-testid="nonlinear-steps" type="number" min="1" max="200" value={steps} onChange={e=>setSteps(num(e.target.value,20))}/></label><label>Máx. iterações<input data-testid="nonlinear-max-iterations" type="number" min="3" max="100" value={maxIt} onChange={e=>setMaxIt(num(e.target.value,35))}/></label><label>Tolerância<input data-testid="nonlinear-tolerance" type="number" value={tol} onChange={e=>setTol(num(e.target.value,1e-8))}/></label><label className="checkbox-line"><input data-testid="nonlinear-line-search" type="checkbox" checked={lineSearch} onChange={e=>setLineSearch(e.target.checked)}/><span>Line search</span></label></div><div className="panel-warning">Escopo v0.13.6: frame2d Euler–Bernoulli com extremidades rígidas, <b>rótulas e molas rotacionais semirrígidas</b>. Cargas nodais, uniforme, peso próprio e pontual em barra são aceitas; ações térmicas entram como εT/κT; força seguidora concentrada é aceita somente na extremidade 2. A imperfeição modal é aceita como <b>geometria de referência sem tensões</b> quando o modo de flambagem pode ser calculado. Sem não linearidade material, contato, follower distribuída, molas nodais ou recalques.</div>
        {hasImperfection&&<div data-testid="corotational-imperfection-config-note" className="panel-note"><b>Imperfeição modal ativa:</b> modo {imperfection.mode}, e₀,max={fmtNumber(imperfection.amplitudeMm,2)} mm, referência {imperfection.scenarioId||project.settings?.analysisScenarioId||'cenário atual'}. No co‑rotacional, xᵣ=x₀+u₀ é uma referência <b>sem tensões</b>; Newton calcula apenas Δu a partir dela. A obtenção modal ainda exige extremidades rígidas.</div>}
        {flexibleEndCount>0&&<div data-testid="corotational-connection-note" className="panel-note"><b>{flexibleEndCount} extremidade(s) flexível(is):</b> {semirigidCount} semirrígida(s) e {releaseCount} rótula(s). O kernel introduz a rotação interna θe da extremidade e condensa esses DOFs por <b>Schur</b>; a mola obedece M=kθ(θn−θe). Configure as ligações no painel <b>Ligações</b>.</div>}
        {referenceLoads.length>0&&<div data-testid="reference-dead-load-note" className="panel-note">{distributedCount>0?`${distributedCount} carga(s) uniforme(s)/peso próprio`:''}{distributedCount>0&&pointCount>0?' + ':''}{pointCount>0?`${pointCount} carga(s) pontual(is) em barra`:''} serão convertidas em vetores nodais equivalentes e congeladas na configuração inicial. Elas não são cargas seguidoras.</div>}{thermalLoads.length>0&&<div data-testid="thermal-initial-state-note" className="panel-note"><b>{thermalLoads.length} ação(ões) térmica(s):</b> ΔT gera εT=αΔT e o gradiente gera κT=−αΔTg/h. Essas grandezas são deformações iniciais do elemento, não forças externas.</div>}{followerLoads.length>0&&<div data-testid="follower-load-note" className="panel-note"><b>{followerLoads.length} força(s) seguidora(s):</b> Px/Py permanecem constantes nos eixos locais da corda corrente. O equilíbrio usa <b>Kint − λKext</b>, com Kext=dP/dq; a matriz externa pode ser não simétrica por se tratar de ação não conservativa.</div>}
        <div className="section-title"><h3>Força seguidora · extremidade 2</h3><button data-testid="follower-add" disabled={!followerElementId} onClick={addFollower}>+ Follower</button></div>
        <div className="geometry-grid"><label>Elemento<select data-testid="follower-element" value={followerElementId} onChange={e=>setFollowerElementId(e.target.value)}>{frames.map((e:any)=><option key={e.id} value={e.id}>{e.label||e.id} · {e.id}</option>)}</select></label><label>Caso ativo<input value={activeCaseId||''} disabled/></label></div>
        {selectedFollowers.length?selectedFollowers.map((f:any)=><div className="point-editor" key={f.id}><label>Px local [kN]<input data-testid="follower-px" type="number" value={num(f.px)} onChange={e=>patchFollower(f.id,'px',num(e.target.value))}/></label><label>Py local [kN]<input data-testid="follower-py" type="number" value={num(f.py)} onChange={e=>patchFollower(f.id,'py',num(e.target.value))}/></label><span className="chip">ext. 2</span><button className="danger" aria-label="Remover follower" onClick={()=>removeFollower(f.id)}>×</button></div>):<div data-testid="follower-empty" className="empty-state">Sem força seguidora neste elemento/caso.</div>}
        <div className="panel-note">A direção é ligada à <b>corda corrente</b>, não à rotação nodal de extremidade. Nesta versão não há follower moment, follower distribuída nem aplicação em ponto interior.</div>
      </section>}
      <div className="commit-bar"><span>{mode==='corotational'?'Modo experimental: valide independentemente antes de uso profissional.':'Linear permanece o padrão; P‑Delta não substitui análise de flambagem/autovalores.'}</span><div className="commit-actions"><button onClick={onClose}>Cancelar</button><button data-testid="analysis-apply" className="primary" disabled={(mode==='corotational'&&!nonlinearOk)||followerRequiresCorotational} onClick={apply}>Aplicar</button></div></div>
    </section>
  </div>;
}

function fmtNumber(v:any,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
