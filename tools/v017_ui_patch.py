from pathlib import Path


def rep(path,old,new):
    p=Path(path);t=p.read_text()
    if old not in t: raise SystemExit(f'anchor missing {path}: {old[:100]!r}')
    p.write_text(t.replace(old,new,1))

# Analysis controls
path='app/src/AnalysisPanelV13.tsx'
rep(path,
"  const [controlMode,setControlMode]=useState(project.settings?.nonlinearControlMode==='displacement'?'displacement':'load');",
"  const [controlMode,setControlMode]=useState(project.settings?.nonlinearControlMode==='arc-length'?'arc-length':(project.settings?.nonlinearControlMode==='displacement'?'displacement':'load'));" )
rep(path,
"  const [controlTolerance,setControlTolerance]=useState(project.settings?.displacementControlTolerance??1e-7);",
"  const [controlTolerance,setControlTolerance]=useState(project.settings?.displacementControlTolerance??1e-7);\n  const [arcMonitorNodeId,setArcMonitorNodeId]=useState(project.settings?.arcLengthMonitorNodeId||project.settings?.displacementControlNodeId||project.nodes?.[project.nodes.length-1]?.id||'');\n  const [arcMonitorDof,setArcMonitorDof]=useState(project.settings?.arcLengthMonitorDof||'uy');\n  const [arcInitialLoadIncrement,setArcInitialLoadIncrement]=useState(project.settings?.arcLengthInitialLoadIncrement??0.05);\n  const [arcInitialSign,setArcInitialSign]=useState(project.settings?.arcLengthInitialSign??1);\n  const [arcTargetIterations,setArcTargetIterations]=useState(project.settings?.arcLengthTargetIterations??6);\n  const [arcMaxCutbacks,setArcMaxCutbacks]=useState(project.settings?.arcLengthMaxCutbacks??8);\n  const [arcConstraintTolerance,setArcConstraintTolerance]=useState(project.settings?.arcLengthConstraintTolerance??1e-6);" )
rep(path,
"    p.settings.nonlinearControlMode=controlMode==='displacement'?'displacement':'load';p.settings.displacementControlNodeId=controlNodeId||null;p.settings.displacementControlDof=['ux','uy','rz'].includes(controlDof)?controlDof:'uy';p.settings.displacementControlTarget=Number.isFinite(Number(controlTarget))&&Math.abs(Number(controlTarget))>1e-12?Number(controlTarget):-0.05;p.settings.displacementControlTolerance=Math.max(1e-10,num(controlTolerance,1e-7));",
"    p.settings.nonlinearControlMode=controlMode==='arc-length'?'arc-length':(controlMode==='displacement'?'displacement':'load');p.settings.displacementControlNodeId=controlNodeId||null;p.settings.displacementControlDof=['ux','uy','rz'].includes(controlDof)?controlDof:'uy';p.settings.displacementControlTarget=Number.isFinite(Number(controlTarget))&&Math.abs(Number(controlTarget))>1e-12?Number(controlTarget):-0.05;p.settings.displacementControlTolerance=Math.max(1e-10,num(controlTolerance,1e-7));\n    p.settings.arcLengthMonitorNodeId=arcMonitorNodeId||null;p.settings.arcLengthMonitorDof=['ux','uy','rz'].includes(arcMonitorDof)?arcMonitorDof:'uy';p.settings.arcLengthInitialLoadIncrement=Math.max(1e-5,Math.abs(num(arcInitialLoadIncrement,.05)));p.settings.arcLengthInitialSign=num(arcInitialSign,1)<0?-1:1;p.settings.arcLengthTargetIterations=Math.max(2,Math.min(20,Math.round(num(arcTargetIterations,6))));p.settings.arcLengthMaxCutbacks=Math.max(0,Math.min(16,Math.round(num(arcMaxCutbacks,8))));p.settings.arcLengthConstraintTolerance=Math.max(1e-10,num(arcConstraintTolerance,1e-6));" )
rep(path,
"p.settings.materialCoupling=controlMode==='displacement'?'embedded':(materialCoupling==='outer'?'outer':'embedded');",
"p.settings.materialCoupling=controlMode!=='load'?'embedded':(materialCoupling==='outer'?'outer':'embedded');" )
rep(path,
"<small>Núcleo geom. v0.13.6 · material/pushover v0.16.</small>",
"<small>Núcleo geom. v0.13.6 · caminhos não lineares v0.17.</small>" )
rep(path,
"<b>Rótula de fibras v0.16 exige Geom. não linear.</b>",
"<b>Rótula de fibras v0.17 exige Geom. não linear.</b>" )
rep(path,
"<h3>Newton–Raphson incremental · v0.16</h3><div className=\"geometry-grid\"><label>Controle<select data-testid=\"nonlinear-control-mode\" value={controlMode} onChange={e=>{const v=e.target.value==='displacement'?'displacement':'load';setControlMode(v);if(v==='displacement')setMaterialCoupling('embedded')}}><option value=\"load\">Carga · λ prescrito</option><option value=\"displacement\">Deslocamento · pushover</option></select>",
"<h3>Newton–Raphson incremental · v0.17</h3><div className=\"geometry-grid\"><label>Controle<select data-testid=\"nonlinear-control-mode\" value={controlMode} onChange={e=>{const raw=e.target.value;const v=raw==='arc-length'?'arc-length':(raw==='displacement'?'displacement':'load');setControlMode(v);if(v!=='load')setMaterialCoupling('embedded')}}><option value=\"load\">Carga · λ prescrito</option><option value=\"displacement\">Deslocamento · pushover</option><option value=\"arc-length\">Arc-Length / Riks · v0.17</option></select>" )
rep(path,
"Arc-length ainda não está ativo.</div></>}",
"Arc-length/Riks é uma alternativa separada quando o caminho possui ponto-limite.</div></>}{controlMode==='arc-length'&&<><div className=\"section-title\"><h3>Arc-Length / Riks · continuação de caminho</h3><span className=\"chip\">λ + u variáveis</span></div><div className=\"geometry-grid\"><label>Nó monitor<select data-testid=\"arc-length-monitor-node\" value={arcMonitorNodeId} onChange={e=>setArcMonitorNodeId(e.target.value)}>{(project.nodes||[]).map((n:any)=><option key={n.id} value={n.id}>{n.id}</option>)}</select></label><label>DOF monitor<select data-testid=\"arc-length-monitor-dof\" value={arcMonitorDof} onChange={e=>setArcMonitorDof(e.target.value)}><option value=\"ux\">Ux</option><option value=\"uy\">Uy</option><option value=\"rz\">Rz</option></select></label><label>Δλ inicial<input data-testid=\"arc-length-initial-load-increment\" type=\"number\" min=\"0.00001\" step=\"0.01\" value={arcInitialLoadIncrement} onChange={e=>setArcInitialLoadIncrement(Math.abs(num(e.target.value,.05)))}/></label><label>Sentido inicial<select data-testid=\"arc-length-initial-sign\" value={arcInitialSign<0?-1:1} onChange={e=>setArcInitialSign(num(e.target.value,1)<0?-1:1)}><option value={1}>+λ</option><option value={-1}>−λ</option></select></label><label>Iterações alvo<input data-testid=\"arc-length-target-iterations\" type=\"number\" min=\"2\" max=\"20\" value={arcTargetIterations} onChange={e=>setArcTargetIterations(num(e.target.value,6))}/></label><label>Máx. cutbacks<input data-testid=\"arc-length-max-cutbacks\" type=\"number\" min=\"0\" max=\"16\" value={arcMaxCutbacks} onChange={e=>setArcMaxCutbacks(num(e.target.value,8))}/></label><label>Tol. esfera<input data-testid=\"arc-length-constraint-tolerance\" type=\"number\" min=\"1e-10\" step=\"1e-6\" value={arcConstraintTolerance} onChange={e=>setArcConstraintTolerance(num(e.target.value,1e-6))}/></label></div><div data-testid=\"arc-length-control-note\" className=\"panel-note\">O método v0.17 usa uma restrição esférica de Crisfield no espaço generalizado <b>(Δu, Δλ)</b>. O preditor é orientado pela projeção positiva no incremento convergido anterior; o corretor resolve o sistema bordado e o raio é adaptado conforme o número de iterações, com cutback automático em falha de convergência. O nó/DOF acima é apenas <b>monitor</b> para traçar a curva, não um deslocamento imposto.</div></>}" )
rep(path,
"A v0.16 acrescenta <b>controle de deslocamento/pushover</b> ao solver co‑rotacional e mantém rótulas concentradas de fibras de aço bilinear monotônico em seções retangulares, I/H e RHS, com Newton constitutivo local embutido. O pushover resolve simultaneamente deslocamentos e fator do padrão de carga λ.",
"A v0.17 acrescenta <b>Arc-Length/Riks esférico</b> com adaptação automática de raio e cutback, além do pushover por controle de deslocamento da v0.16. Rótulas concentradas de fibras de aço bilinear monotônico em seções retangulares, I/H e RHS permanecem acopladas por Newton constitutivo local embutido. No Arc-Length, deslocamentos e λ evoluem simultaneamente sem impor um DOF de controle." )
rep(path,
"<h3>Material não linear · v0.16</h3>","<h3>Material não linear · v0.17</h3>")
rep(path,
"<option value=\"embedded\">Newton local embutido · v0.16</option><option value=\"outer\" disabled={controlMode==='displacement'}>",
"<option value=\"embedded\">Newton local embutido · v0.17</option><option value=\"outer\" disabled={controlMode!=='load'}>" )

# Postprocess: generic arc-length path chart and summaries
path='app/src/NonlinearPostprocessPanel.tsx'
insert=r'''
function ArcLengthChart({arc}:{arc:any}){
  const rows=arc?.curve||[];if(!rows.length)return null;
  const rotational=arc?.monitor?.dof==='rz',factor=rotational?1:1000,unit=rotational?'rad':'mm',W=650,H=250,L=58,R=18,T=28,B=38,xs=rows.map((r:any)=>num(r.monitoredDisplacement)*factor),ys=rows.map((r:any)=>num(r.loadFactor)),xmin=Math.min(...xs,0),xmax=Math.max(...xs,0),ymin=Math.min(...ys,0),ymax=Math.max(...ys,0),dx=Math.max(xmax-xmin,1e-12),dy=Math.max(ymax-ymin,1e-12),xlo=xmin-.06*dx,xhi=xmax+.06*dx,ylo=ymin-.08*dy,yhi=ymax+.08*dy,sx=(x:number)=>L+(x-xlo)/Math.max(xhi-xlo,1e-12)*(W-L-R),sy=(y:number)=>T+(yhi-y)/Math.max(yhi-ylo,1e-12)*(H-T-B),path=rows.map((r:any,i:number)=>`${i?'L':'M'} ${sx(num(r.monitoredDisplacement)*factor).toFixed(1)} ${sy(num(r.loadFactor)).toFixed(1)}`).join(' '),turning=(arc.turningPoints||[]).filter((e:any)=>e.type==='load-factor-turning');
  return <div className="chart-card" data-testid="arc-length-path-chart"><div className="chart-title"><b>Caminho de equilíbrio · λ × {arc.monitor?.nodeId}/{String(arc.monitor?.dof||'').toUpperCase()}</b><span>{rows.length} passos · {turning.length} ponto(s)-limite · raio adaptativo</span></div><svg viewBox={`0 0 ${W} ${H}`} className="react-chart"><line x1={L} y1={T} x2={L} y2={H-B}/><line x1={L} y1={H-B} x2={W-R} y2={H-B}/>{xlo<=0&&xhi>=0&&<line className="zero" x1={sx(0)} y1={T} x2={sx(0)} y2={H-B}/>} {ylo<=0&&yhi>=0&&<line className="zero" x1={L} y1={sy(0)} x2={W-R} y2={sy(0)}/>}<path className="line" d={path}/>{turning.map((e:any,i:number)=><circle data-testid="arc-length-turning-marker" key={`turn-${i}-${e.step}`} cx={sx(num(e.monitoredDisplacement)*factor)} cy={sy(num(e.loadFactor))} r="5"><title>{`Ponto-limite · passo ${e.step} · λ=${fmt(e.loadFactor,5)}`}</title></circle>)}{rows.filter((r:any)=>r.newlyYieldedHinges?.length).map((r:any)=><circle key={`yield-arc-${r.step}`} cx={sx(num(r.monitoredDisplacement)*factor)} cy={sy(num(r.loadFactor))} r="3"><title>{`Nova plastificação · passo ${r.step}`}</title></circle>)}</svg><div className="panel-note">O caminho pode inverter o sentido de λ e/ou do deslocamento monitorado. Os círculos maiores marcam reversões locais de λ identificadas na sequência convergida.</div></div>;
}

'''
t=Path(path).read_text();anchor='function extrema(points:any[],field:string)'
if 'function ArcLengthChart' not in t:
    if anchor not in t: raise SystemExit('postprocess insertion anchor missing')
    t=t.replace(anchor,insert+anchor,1);Path(path).write_text(t)
rep(path,
"materialRecords=(material?.records||[]).filter((r:any)=>r.elementId===response?.elementId),pushover=solved.value?.pushover,hasPushover=!!pushover?.enabled,firstYield=pushover?.firstYield,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm',controlFactor=pushover?.control?.dof==='rz'?1:1000;",
"materialRecords=(material?.records||[]).filter((r:any)=>r.elementId===response?.elementId),pushover=solved.value?.pushover,hasPushover=!!pushover?.enabled,firstYield=pushover?.firstYield,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm',controlFactor=pushover?.control?.dof==='rz'?1:1000,arc=solved.value?.arcLength,hasArc=!!arc?.enabled,arcUnit=arc?.monitor?.dof==='rz'?'rad':'mm',arcFactor=arc?.monitor?.dof==='rz'?1:1000;" )
rep(path,
"{hasPushover&&<span className=\"chip\">pushover · deslocamento controlado</span>}",
"{hasPushover&&<span className=\"chip\">pushover · deslocamento controlado</span>}{hasArc&&<span className=\"chip\">Arc-Length / Riks</span>}" )
rep(path,
"{hasImperfection&&<div data-testid=\"corotational-imperfection-note\"",
"{hasArc&&<div data-testid=\"arc-length-summary\" className=\"panel-note\"><b>Arc-Length/Riks v0.17:</b> monitor {arc.monitor?.nodeId}/{String(arc.monitor?.dof||'').toUpperCase()}, λ final={fmt(arc.finalLoadFactor,5)}, λ pico={fmt(arc.peakLoadFactor,5)}, Δλ inicial={fmt(arc.initialLoadIncrement,4)}, raio inicial={Number(arc.initialRadius||0).toExponential(3)}, escala λ={Number(arc.loadScale||0).toExponential(3)} m. Foram detectados <b>{(arc.turningPoints||[]).filter((e:any)=>e.type==='load-factor-turning').length}</b> ponto(s)-limite de λ. O raio é adaptado por esforço iterativo e pode sofrer cutback. O monitor não é uma restrição cinemática.</div>}{hasImperfection&&<div data-testid=\"corotational-imperfection-note\"" )
rep(path,
"<b>Não linearidade material v0.16:</b>","<b>Não linearidade material v0.17:</b>")
rep(path,
"Na rótula de fibras v0.16,", "Na rótula de fibras v0.17,")
rep(path,
"{hasPushover&&<><div><small>λ final</small>",
"{hasArc&&<><div><small>λ final · arc</small><b>{fmt(arc.finalLoadFactor,5)}</b></div><div><small>Pontos-limite</small><b>{(arc.turningPoints||[]).filter((e:any)=>e.type==='load-factor-turning').length}</b></div><div><small>Raio final</small><b>{Number(arc.finalRadius||0).toExponential(2)}</b></div></>}{hasPushover&&<><div><small>λ final</small>" )
rep(path,
"{hasPushover&&<PushoverChart pushover={pushover}/>}<div className=\"charts-grid\">",
"{hasPushover&&<PushoverChart pushover={pushover}/>} {hasArc&&<ArcLengthChart arc={arc}/>}<div className=\"charts-grid\">" )

# Technical report
path='app/src/NonlinearReportPanel.tsx'
rep(path,
"material=r?.materialNonlinearity,materialRecords=material?.records||[],hasMaterial=!!material?.enabled,pushover=r?.pushover,hasPushover=!!pushover?.enabled,controlFactor=pushover?.control?.dof==='rz'?1:1000,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm';",
"material=r?.materialNonlinearity,materialRecords=material?.records||[],hasMaterial=!!material?.enabled,pushover=r?.pushover,hasPushover=!!pushover?.enabled,controlFactor=pushover?.control?.dof==='rz'?1:1000,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm',arc=r?.arcLength,hasArc=!!arc?.enabled,arcFactor=arc?.monitor?.dof==='rz'?1:1000,arcUnit=arc?.monitor?.dof==='rz'?'rad':'mm';" )
rep(path,"{hasMaterial?' com rótulas de fibras v0.16':''}","{hasMaterial?' com rótulas de fibras v0.17':''}")
rep(path,
"{hasPushover&&<><div><small>Controle</small>",
"{hasArc&&<><div><small>Arc monitor</small><b>{arc.monitor?.nodeId}/{String(arc.monitor?.dof||'').toUpperCase()}</b></div><div><small>Pontos-limite λ</small><b>{(arc.turningPoints||[]).filter((e:any)=>e.type==='load-factor-turning').length}</b></div></>}{hasPushover&&<><div><small>Controle</small>" )
rep(path,
"<h3>2. Controle incremental e convergência</h3>{hasPushover&&<p>",
"<h3>2. Controle incremental e convergência</h3>{hasArc&&<p><b>Modo:</b> Arc-Length/Riks esférico de Crisfield com λ e deslocamentos como incógnitas. Raio inicial={Number(arc.initialRadius||0).toExponential(3)}, raio final={Number(arc.finalRadius||0).toExponential(3)}, alvo iterativo={arc.targetIterations} e até {arc.maxCutbacks} cutbacks por passo.</p>}{hasPushover&&<p>" )
rep(path,
"      <h3>3. Imperfeição geométrica inicial</h3>",
"      {hasArc&&<section data-testid=\"arc-length-report\"><h3>2.2. Arc-Length / Riks</h3><p>O caminho de equilíbrio é obtido por continuação esférica no espaço generalizado (Δu, Δλ). O preditor satisfaz a tangente de equilíbrio e é orientado pela projeção positiva sobre o incremento convergido anterior; o corretor resolve diretamente o sistema bordado, que permanece utilizável nas proximidades de uma tangente estrutural singular. Rotações são convertidas à métrica translacional pelo comprimento característico Lc={fmt(arc.characteristicLength,4)} m. A escala automática do parâmetro de carga é α={Number(arc.loadScale||0).toExponential(3)} m.</p><div className=\"metrics-row\"><div><small>Monitor</small><b>{arc.monitor?.nodeId}/{String(arc.monitor?.dof||'').toUpperCase()}</b></div><div><small>λ final</small><b>{fmt(arc.finalLoadFactor,5)}</b></div><div><small>λ pico |·|</small><b>{fmt(arc.peakLoadFactor,5)}</b></div><div><small>Pontos-limite λ</small><b>{(arc.turningPoints||[]).filter((e:any)=>e.type==='load-factor-turning').length}</b></div><div><small>Primeiro escoamento</small><b>{arc.firstYield?`passo ${arc.firstYield.step}`:'não detectado'}</b></div></div><div className=\"table-scroll\"><table><thead><tr><th>Passo</th><th>u monitor [{arcUnit}]</th><th>λ</th><th>Δλ</th><th>Raio</th><th>Iter.</th><th>Cutbacks</th></tr></thead><tbody>{(arc.curve||[]).map((h:any)=><tr key={`arc-${h.step}`}><td>{h.step}</td><td>{fmt(Number(h.monitoredDisplacement)*arcFactor,4)}</td><td>{fmt(h.loadFactor,5)}</td><td>{fmt(h.loadIncrement,5)}</td><td>{Number(h.arcRadius||0).toExponential(3)}</td><td>{h.iterations}</td><td>{h.cutbacks||0}</td></tr>)}</tbody></table></div><p><b>Limitação:</b> a continuação geométrica pode atravessar snap-through e, dependendo da parametrização, snap-back; entretanto as rótulas de fibras atuais continuam usando uma lei monotônica sem história cíclica. Reversões constitutivas não devem ser interpretadas como histerese física.</p></section>}\n      <h3>3. Imperfeição geométrica inicial</h3>" )
rep(path,"Modelo concentrado v0.15:","Modelo concentrado v0.17:")

# E2E test
Path('tests/e2e/arc-length.spec.ts').write_text(r'''import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null})}
async function openCommand(page:Page,label:string){const width=page.viewportSize()?.width||1280;if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return}const direct=page.locator(`button[aria-label="${label}"]:visible`).first();if(await direct.isVisible().catch(()=>false)){await direct.click();return}const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click()}
async function installCantilever(page:Page){await page.goto('./');await page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');const p=JSON.parse(raw),A=.02,I=.00006666666666666667;p.name='E2E — arc-length v0.17';p.materials=[{id:'S',name:'Steel',type:'steel',E:200e6,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'Rect',family:'rect',b:.1,h:.2,A,I}];p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',nonlinearSteps:8,nonlinearMaxIterations:40,nonlinearTolerance:1e-9,nonlinearLineSearch:true,imperfection:{...(p.settings?.imperfection||{}),enabled:false}};localStorage.setItem('astrastruct.project',JSON.stringify(p))});await page.reload()}

test('v0.17 configures Arc-Length/Riks and renders equilibrium path',async({page})=>{await installCantilever(page);await expect(page.getByTestId('astra-app')).toBeVisible();await openCommand(page,'Tipo de análise');await page.getByTestId('analysis-corotational').click();await page.getByTestId('nonlinear-control-mode').selectOption('arc-length');await expect(page.getByTestId('arc-length-control-note')).toBeVisible();await page.getByTestId('arc-length-monitor-node').selectOption('N2');await page.getByTestId('arc-length-monitor-dof').selectOption('uy');await page.getByTestId('arc-length-initial-load-increment').fill('0.05');await page.getByTestId('arc-length-target-iterations').fill('5');await page.getByTestId('arc-length-max-cutbacks').fill('6');await page.getByTestId('nonlinear-steps').fill('8');await page.getByTestId('analysis-apply').click();await expect.poll(async()=>{const p=await storedProject(page);return [p?.settings?.analysisType,p?.settings?.nonlinearControlMode,p?.settings?.arcLengthMonitorNodeId,p?.settings?.arcLengthMonitorDof,Number(p?.settings?.arcLengthInitialLoadIncrement),Number(p?.settings?.arcLengthTargetIterations)]}).toEqual(['corotational','arc-length','N2','uy',.05,5]);await page.getByTestId('analyze-button').click();const results=page.locator('.results-content');await expect(results).toBeVisible();await expect(results).toContainText('frame2d-corotational-arc-length-experimental');await expect(page.locator('[role="alert"]')).toHaveCount(0);await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess');await expect(post).toBeVisible();await expect(post).toContainText('0.17.0-exp');await expect(page.getByTestId('arc-length-summary')).toContainText('raio inicial');await expect(page.getByTestId('arc-length-path-chart')).toBeVisible();await post.locator('button[aria-label="Fechar"]').click();await openCommand(page,'Relatório técnico');const report=page.getByTestId('panel-nonlinear-report');await expect(report).toBeVisible();await expect(report).toContainText('0.17.0-exp');await expect(page.getByTestId('arc-length-report')).toContainText('Arc-Length / Riks');await expect(page.locator('[role="alert"]')).toHaveCount(0)});
''')

# README version note
path='README.md';t=Path(path).read_text()
if 'v0.17' not in t[:1200]:
    t=t.replace('v0.16.0', 'v0.17.0', 1) if 'v0.16.0' in t else t
    marker='## '
    # Add a compact current-state note near top without restructuring historical docs.
    pos=t.find('\n', t.find('\n')+1)
    t=t[:pos+1]+"\n> **v0.17 experimental:** Arc-Length/Riks esférico de Crisfield com raio adaptativo, cutback, detecção de pontos-limite e integração ao solver co-rotacional/material.\n"+t[pos+1:]
    Path(path).write_text(t)
