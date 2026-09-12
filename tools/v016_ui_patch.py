from pathlib import Path

# ---------------- Analysis panel ----------------
p=Path('app/src/AnalysisPanelV13.tsx')
s=p.read_text()
s=s.replace('v0.15 aceita somente material steel.','v0.16 aceita somente material steel.')
anchor="""  const [lineSearch,setLineSearch]=useState(project.settings?.nonlinearLineSearch!==false);
"""
extra=anchor+"""  const [controlMode,setControlMode]=useState(project.settings?.nonlinearControlMode==='displacement'?'displacement':'load');
  const [controlNodeId,setControlNodeId]=useState(project.settings?.displacementControlNodeId||project.nodes?.[project.nodes.length-1]?.id||'');
  const [controlDof,setControlDof]=useState(project.settings?.displacementControlDof||'uy');
  const [controlTarget,setControlTarget]=useState(project.settings?.displacementControlTarget??-0.05);
  const [controlTolerance,setControlTolerance]=useState(project.settings?.displacementControlTolerance??1e-7);
"""
if 'const [controlMode,setControlMode]' not in s:
    if anchor not in s: raise SystemExit('analysis control state anchor not found')
    s=s.replace(anchor,extra,1)
s=s.replace("const [materialTol,setMaterialTol]=useState(project.settings?.materialTolerance||1e-5);","const [materialTol,setMaterialTol]=useState(project.settings?.materialTolerance||1e-6);",1)
old="""    p.settings.nonlinearSteps=Math.max(1,Math.min(200,Math.round(num(steps,20))));p.settings.nonlinearMaxIterations=Math.max(3,Math.min(100,Math.round(num(maxIt,35))));p.settings.nonlinearTolerance=Math.max(1e-12,num(tol,1e-8));p.settings.nonlinearLineSearch=!!lineSearch;
    p.settings.materialMaxIterations=Math.max(3,Math.min(80,Math.round(num(materialMaxIt,30))));p.settings.materialTolerance=Math.max(1e-10,num(materialTol,1e-6));p.settings.materialRelaxation=Math.max(.2,Math.min(1,num(materialRelaxation,1)));p.settings.materialCoupling=materialCoupling==='outer'?'outer':'embedded';"""
new="""    p.settings.nonlinearSteps=Math.max(1,Math.min(300,Math.round(num(steps,20))));p.settings.nonlinearMaxIterations=Math.max(3,Math.min(120,Math.round(num(maxIt,35))));p.settings.nonlinearTolerance=Math.max(1e-12,num(tol,1e-8));p.settings.nonlinearLineSearch=!!lineSearch;
    p.settings.nonlinearControlMode=controlMode==='displacement'?'displacement':'load';p.settings.displacementControlNodeId=controlNodeId||null;p.settings.displacementControlDof=['ux','uy','rz'].includes(controlDof)?controlDof:'uy';p.settings.displacementControlTarget=Number.isFinite(Number(controlTarget))&&Math.abs(Number(controlTarget))>1e-12?Number(controlTarget):-0.05;p.settings.displacementControlTolerance=Math.max(1e-10,num(controlTolerance,1e-7));
    p.settings.materialMaxIterations=Math.max(3,Math.min(80,Math.round(num(materialMaxIt,30))));p.settings.materialTolerance=Math.max(1e-10,num(materialTol,1e-6));p.settings.materialRelaxation=Math.max(.2,Math.min(1,num(materialRelaxation,1)));p.settings.materialCoupling=controlMode==='displacement'?'embedded':(materialCoupling==='outer'?'outer':'embedded');"""
if old not in s: raise SystemExit('analysis apply settings anchor not found')
s=s.replace(old,new,1)
s=s.replace('Núcleo geom. v0.13.6 · material v0.15.','Núcleo geom. v0.13.6 · material/pushover v0.16.',1)
s=s.replace('Rótula de fibras v0.15 exige Geom. não linear.','Rótula de fibras v0.16 exige Geom. não linear.',1)
s=s.replace('A v0.15 acrescenta <b>rótulas concentradas de fibras de aço bilinear monotônico</b> em seções retangulares, I/H e RHS, com Newton constitutivo local embutido no equilíbrio global.','A v0.16 acrescenta <b>controle de deslocamento/pushover</b> ao solver co‑rotacional e mantém rótulas concentradas de fibras de aço bilinear monotônico em seções retangulares, I/H e RHS, com Newton constitutivo local embutido. O pushover resolve simultaneamente deslocamentos e fator do padrão de carga λ.',1)
s=s.replace('<h3>Material não linear · v0.15</h3>','<h3>Material não linear · v0.16</h3>',1)
s=s.replace('Newton local embutido · v0.15','Newton local embutido · v0.16')
old="""{mode==='corotational'&&<section className="react-card" data-testid="corotational-controls"><h3>Newton–Raphson incremental</h3><div className="geometry-grid"><label>Incrementos<input data-testid="nonlinear-steps" type="number" min="1" max="200" value={steps} onChange={e=>setSteps(num(e.target.value,20))}/></label>"""
new="""{mode==='corotational'&&<section className="react-card" data-testid="corotational-controls"><h3>Newton–Raphson incremental · v0.16</h3><div className="geometry-grid"><label>Controle<select data-testid="nonlinear-control-mode" value={controlMode} onChange={e=>{const v=e.target.value==='displacement'?'displacement':'load';setControlMode(v);if(v==='displacement')setMaterialCoupling('embedded')}}><option value="load">Carga · λ prescrito</option><option value="displacement">Deslocamento · pushover</option></select></label><label>Incrementos<input data-testid="nonlinear-steps" type="number" min="1" max="300" value={steps} onChange={e=>setSteps(num(e.target.value,20))}/></label>"""
if old not in s: raise SystemExit('analysis corotational controls anchor not found')
s=s.replace(old,new,1)
anchor="""<label className="checkbox-line"><input data-testid="nonlinear-line-search" type="checkbox" checked={lineSearch} onChange={e=>setLineSearch(e.target.checked)}/><span>Line search</span></label></div>"""
extra=anchor+"""{controlMode==='displacement'&&<><div className="section-title"><h3>Controle de deslocamento · pushover</h3><span className="chip">λ variável</span></div><div className="geometry-grid"><label>Nó de controle<select data-testid="displacement-control-node" value={controlNodeId} onChange={e=>setControlNodeId(e.target.value)}>{(project.nodes||[]).map((n:any)=><option key={n.id} value={n.id}>{n.id}</option>)}</select></label><label>DOF<select data-testid="displacement-control-dof" value={controlDof} onChange={e=>setControlDof(e.target.value)}><option value="ux">Ux</option><option value="uy">Uy</option><option value="rz">Rz</option></select></label><label>{controlDof==='rz'?'Alvo [rad]':'Alvo [mm]'}<input data-testid="displacement-control-target" type="number" step={controlDof==='rz'?'0.001':'1'} value={controlDof==='rz'?controlTarget:controlTarget*1000} onChange={e=>setControlTarget(controlDof==='rz'?num(e.target.value,-.05):num(e.target.value,-50)/1000)}/></label><label>Tol. controle relativa<input data-testid="displacement-control-tolerance" type="number" min="1e-10" step="1e-7" value={controlTolerance} onChange={e=>setControlTolerance(num(e.target.value,1e-7))}/></label></div><div data-testid="pushover-control-note" className="panel-note">O padrão do cenário é escalado pelo fator <b>λ</b>, que passa a ser incógnita do sistema aumentado. Em cada incremento o solver impõe o deslocamento-alvo em {controlNodeId||'—'}/{controlDof.toUpperCase()} e resolve simultaneamente o equilíbrio global. Para rótulas de fibras, o acoplamento material embutido é obrigatório. Arc-length ainda não está ativo.</div></>}"""
if 'data-testid="pushover-control-note"' not in s:
    if anchor not in s: raise SystemExit('analysis line search anchor not found')
    s=s.replace(anchor,extra,1)
s=s.replace('<option value="outer">Compatibilidade externa · v0.14</option>','<option value="outer" disabled={controlMode===\'displacement\'}>Compatibilidade externa · v0.14</option>',1)
p.write_text(s)

# ---------------- Postprocess panel ----------------
p=Path('app/src/NonlinearPostprocessPanel.tsx')
s=p.read_text()
if 'function PushoverChart' not in s:
    marker='''function extrema(points:any[],field:string){const a=points.map(p=>Number(p[field])).filter(Number.isFinite);return a.length?{min:Math.min(...a),max:Math.max(...a),abs:Math.max(...a.map(Math.abs))}:{min:NaN,max:NaN,abs:NaN}}'''
    chart=r'''function PushoverChart({pushover}:{pushover:any}){
  const rows=pushover?.curve||[];if(!rows.length)return null;
  const rotational=pushover?.control?.dof==='rz',factor=rotational?1:1000,unit=rotational?'rad':'mm',W=650,H=250,L=58,R=18,T=28,B=38,xs=rows.map((r:any)=>num(r.controlledDisplacement)*factor),ys=rows.map((r:any)=>num(r.loadFactor)),xmin=Math.min(...xs,0),xmax=Math.max(...xs,0),ymin=Math.min(...ys,0),ymax=Math.max(...ys,0),dx=Math.max(xmax-xmin,1e-12),dy=Math.max(ymax-ymin,1e-12),xlo=xmin-.06*dx,xhi=xmax+.06*dx,ylo=ymin-.08*dy,yhi=ymax+.08*dy,sx=(x:number)=>L+(x-xlo)/Math.max(xhi-xlo,1e-12)*(W-L-R),sy=(y:number)=>T+(yhi-y)/Math.max(yhi-ylo,1e-12)*(H-T-B),path=rows.map((r:any,i:number)=>`${i?'L':'M'} ${sx(num(r.controlledDisplacement)*factor).toFixed(1)} ${sy(num(r.loadFactor)).toFixed(1)}`).join(' '),peak=rows.reduce((a:any,b:any)=>!a||Math.abs(num(b.loadFactor))>Math.abs(num(a.loadFactor))?b:a,null);
  return <div className="chart-card" data-testid="pushover-capacity-chart"><div className="chart-title"><b>Curva de capacidade · λ × {pushover.control?.nodeId}/{String(pushover.control?.dof||'').toUpperCase()}</b><span>u: {fmt(xmin,3)} … {fmt(xmax,3)} {unit} · λpico={fmt(peak?.loadFactor,4)}</span></div><svg viewBox={`0 0 ${W} ${H}`} className="react-chart"><line x1={L} y1={T} x2={L} y2={H-B}/><line x1={L} y1={H-B} x2={W-R} y2={H-B}/>{xlo<=0&&xhi>=0&&<line className="zero" x1={sx(0)} y1={T} x2={sx(0)} y2={H-B}/>} {ylo<=0&&yhi>=0&&<line className="zero" x1={L} y1={sy(0)} x2={W-R} y2={sy(0)}/>}<path className="line" d={path}/>{rows.filter((r:any)=>r.newlyYieldedHinges?.length).map((r:any)=><circle key={`yield-${r.step}`} cx={sx(num(r.controlledDisplacement)*factor)} cy={sy(num(r.loadFactor))} r="4"><title>{`Passo ${r.step}: nova plastificação · λ=${fmt(r.loadFactor,4)} · u=${fmt(num(r.controlledDisplacement)*factor,3)} ${unit}`}</title></circle>)}{peak&&<circle data-testid="pushover-peak-marker" cx={sx(num(peak.controlledDisplacement)*factor)} cy={sy(num(peak.loadFactor))} r="5"><title>{`Pico |λ| · passo ${peak.step}`}</title></circle>}</svg><div className="panel-note">Marcadores indicam início de plastificação de novas rótulas; o marcador de pico identifica o maior |λ| calculado no caminho.</div></div>;
}

'''
    if marker not in s: raise SystemExit('postprocess chart insertion anchor not found')
    s=s.replace(marker,chart+marker,1)
old="""material=solved.value?.materialNonlinearity,hasMaterial=!!material?.enabled,materialRecords=(material?.records||[]).filter((r:any)=>r.elementId===response?.elementId);"""
new="""material=solved.value?.materialNonlinearity,hasMaterial=!!material?.enabled,materialRecords=(material?.records||[]).filter((r:any)=>r.elementId===response?.elementId),pushover=solved.value?.pushover,hasPushover=!!pushover?.enabled,firstYield=pushover?.firstYield,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm',controlFactor=pushover?.control?.dof==='rz'?1:1000;"""
if old not in s: raise SystemExit('postprocess computed state anchor not found')
s=s.replace(old,new,1)
s=s.replace("<span className=\"chip\">{history.length} incrementos</span>","<span className=\"chip\">{history.length} incrementos</span>{hasPushover&&<span className=\"chip\">pushover · deslocamento controlado</span>}",1)
anchor='''    <div className="panel-warning" data-testid="nonlinear-envelope-note"><b>Envelope não linear desabilitado nesta versão.</b> Os gráficos abaixo pertencem somente ao cenário resolvido. A combinação de respostas de caminhos de equilíbrio distintos exige tratamento próprio e não é inferida automaticamente.</div>'''
extra=anchor+'''\n    {hasPushover&&<div data-testid="pushover-summary" className="panel-note"><b>Pushover v0.16 · controle de deslocamento:</b> {pushover.control?.nodeId}/{String(pushover.control?.dof||'').toUpperCase()} → alvo {fmt(num(pushover.control?.targetDisplacement)*controlFactor,3)} {controlUnit}; λ final={fmt(pushover.finalLoadFactor,5)}, λ pico={fmt(pushover.peakLoadFactor,5)} em u={fmt(num(pushover.peakControlledDisplacement)*controlFactor,3)} {controlUnit}. {firstYield?<>Primeira plastificação no passo <b>{firstYield.step}</b>, λ={fmt(firstYield.loadFactor,5)}, u={fmt(num(firstYield.controlledDisplacement)*controlFactor,3)} {controlUnit}, em {(firstYield.hinges||[]).map((h:any)=>`${h.elementId}/ext.${h.end}`).join(', ')}.</>:<>Nenhuma rótula de fibras plastificou no caminho calculado.</>} Derivada de carga: {pushover.loadFactorDerivative}. Arc-length: não ativo.</div>}'''
if anchor not in s: raise SystemExit('postprocess pushover summary anchor not found')
s=s.replace(anchor,extra,1)
s=s.replace('Não linearidade material v0.15:','Não linearidade material v0.16:',1)
s=s.replace('Na rótula de fibras v0.15,','Na rótula de fibras v0.16,',1)
old='''<div><small>Newton final</small><b>{last?.iterations??'—'} it.</b></div>'''
new='''{hasPushover&&<><div><small>λ final</small><b>{fmt(pushover.finalLoadFactor,5)}</b></div><div><small>λ pico</small><b>{fmt(pushover.peakLoadFactor,5)}</b></div><div><small>u controlado final</small><b>{fmt(num(pushover.curve?.at(-1)?.controlledDisplacement)*controlFactor,3)} {controlUnit}</b></div></>}<div><small>Newton final</small><b>{last?.iterations??'—'} it.</b></div>'''
if old not in s: raise SystemExit('postprocess metric anchor not found')
s=s.replace(old,new,1)
old='''    <div className="charts-grid"><MiniChart points={points} field="N" label="N(x)" unit="kN"/>'''
new='''    {hasPushover&&<PushoverChart pushover={pushover}/>}<div className="charts-grid"><MiniChart points={points} field="N" label="N(x)" unit="kN"/>'''
if old not in s: raise SystemExit('postprocess charts anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

# ---------------- Inspector/version copy ----------------
p=Path('app/src/InspectorPanel.tsx');s=p.read_text().replace('Rótulas de fibras · v0.15','Rótulas de fibras · v0.16').replace('rótula de fibras v0.15','rótula de fibras v0.16');p.write_text(s)

# ---------------- README ----------------
p=Path('README.md');s=p.read_text()
s=s.replace('**Estado atual — v0.15.0 experimental:**','**Estado atual — v0.16.0 experimental:**',1)
needle='- **rótulas concentradas de fibras de aço v0.15 para seções retangulares, I/H e RHS, com equilíbrio local N–M, linearização tangente-afim e Newton constitutivo embutido em cada avaliação do equilíbrio global**;'
replacement='- **rótulas concentradas de fibras de aço v0.16 para seções retangulares, I/H e RHS, com equilíbrio local N–M, linearização tangente-afim e Newton constitutivo embutido em cada avaliação do equilíbrio global**;\n- **pushover por controle de deslocamento v0.16, com fator de carga λ como incógnita, curva capacidade λ–u, rastreamento da sequência de plastificação e recuperação do estado final no fator de carga convergido**;'
if needle in s:s=s.replace(needle,replacement,1)
p.write_text(s)
