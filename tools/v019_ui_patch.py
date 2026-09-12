from pathlib import Path

def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old,new,1)
    if new in text:
        return text
    raise SystemExit(f'{label} anchor missing')

# Analysis panel
p=Path('app/src/AnalysisPanelV13.tsx'); t=p.read_text()
t=replace_once(t,
"  const [stabilityMaxDofs,setStabilityMaxDofs]=useState(project.settings?.stabilityMaxDofs??120);\n  const [branchSwitchEnabled,setBranchSwitchEnabled]=useState(!!project.settings?.branchSwitchEnabled);",
"  const [stabilityMaxDofs,setStabilityMaxDofs]=useState(project.settings?.stabilityMaxDofs??120);\n  const [stabilityModeCount,setStabilityModeCount]=useState(project.settings?.stabilityModeCount??4);\n  const [stabilityClusterTolerance,setStabilityClusterTolerance]=useState(project.settings?.stabilityClusterTolerance??0.03);\n  const [stabilityMacThreshold,setStabilityMacThreshold]=useState(project.settings?.stabilityMacThreshold??0.25);\n  const [branchExploreEnabled,setBranchExploreEnabled]=useState(!!project.settings?.branchExploreEnabled);\n  const [branchExploreAmplitude,setBranchExploreAmplitude]=useState(project.settings?.branchExploreAmplitude??0.08);\n  const [branchSwitchEnabled,setBranchSwitchEnabled]=useState(!!project.settings?.branchSwitchEnabled);",
'analysis state')

t=replace_once(t,
"    p.settings.stabilityTracking=!!stabilityTracking;p.settings.stabilityEigenTolerance=Math.max(1e-5,Math.min(1,Math.abs(num(stabilityEigenTolerance,.05))));p.settings.stabilityAsymmetryTolerance=Math.max(1e-12,Math.min(.1,Math.abs(num(stabilityAsymmetryTolerance,1e-6))));p.settings.stabilityMaxDofs=Math.max(6,Math.min(500,Math.round(num(stabilityMaxDofs,120))));p.settings.branchSwitchEnabled=!!branchSwitchEnabled&&!!stabilityTracking;p.settings.branchSwitchSign=num(branchSwitchSign,1)<0?-1:1;p.settings.branchSwitchAmplitude=Math.max(1e-4,Math.min(.45,Math.abs(num(branchSwitchAmplitude,.08))));",
"    p.settings.stabilityTracking=!!stabilityTracking;p.settings.stabilityEigenTolerance=Math.max(1e-5,Math.min(1,Math.abs(num(stabilityEigenTolerance,.05))));p.settings.stabilityAsymmetryTolerance=Math.max(1e-12,Math.min(.1,Math.abs(num(stabilityAsymmetryTolerance,1e-6))));p.settings.stabilityMaxDofs=Math.max(6,Math.min(500,Math.round(num(stabilityMaxDofs,120))));p.settings.stabilityModeCount=Math.max(1,Math.min(12,Math.round(num(stabilityModeCount,4))));p.settings.stabilityClusterTolerance=Math.max(1e-6,Math.min(.5,Math.abs(num(stabilityClusterTolerance,.03))));p.settings.stabilityMacThreshold=Math.max(0,Math.min(1,num(stabilityMacThreshold,.25)));p.settings.branchExploreEnabled=!!branchExploreEnabled&&!!stabilityTracking;p.settings.branchExploreAmplitude=Math.max(1e-4,Math.min(.45,Math.abs(num(branchExploreAmplitude,.08))));p.settings.branchSwitchEnabled=!!branchSwitchEnabled&&!!stabilityTracking;p.settings.branchSwitchSign=num(branchSwitchSign,1)<0?-1:1;p.settings.branchSwitchAmplitude=Math.max(1e-4,Math.min(.45,Math.abs(num(branchSwitchAmplitude,.08))));",
'analysis apply')

t=t.replace('estabilidade e caminhos v0.18.','estabilidade multimodal v0.19.')
t=t.replace('Newton–Raphson incremental · v0.18','Newton–Raphson incremental · v0.19')
t=t.replace('O método v0.18 mantém','O método v0.19 mantém')
t=t.replace('Estabilidade tangente · v0.18','Estabilidade multimodal · v0.19')

old="<label>Máx. DOFs espectrais<input data-testid=\"stability-max-dofs\" type=\"number\" min=\"6\" max=\"500\" value={stabilityMaxDofs} onChange={e=>setStabilityMaxDofs(num(e.target.value,120))}/></label><label className=\"checkbox-line\"><input data-testid=\"branch-switch-enabled\""
new="<label>Máx. DOFs espectrais<input data-testid=\"stability-max-dofs\" type=\"number\" min=\"6\" max=\"500\" value={stabilityMaxDofs} onChange={e=>setStabilityMaxDofs(num(e.target.value,120))}/></label><label>Modos rastreados<input data-testid=\"stability-mode-count\" type=\"number\" min=\"1\" max=\"12\" value={stabilityModeCount} onChange={e=>setStabilityModeCount(num(e.target.value,4))}/></label><label>Tol. agrupamento modal<input data-testid=\"stability-cluster-tolerance\" type=\"number\" min=\"0.000001\" max=\"0.5\" step=\"0.01\" value={stabilityClusterTolerance} onChange={e=>setStabilityClusterTolerance(num(e.target.value,.03))}/></label><label>MAC mínimo<input data-testid=\"stability-mac-threshold\" type=\"number\" min=\"0\" max=\"1\" step=\"0.05\" value={stabilityMacThreshold} onChange={e=>setStabilityMacThreshold(num(e.target.value,.25))}/></label><label className=\"checkbox-line\"><input data-testid=\"branch-explore-enabled\" type=\"checkbox\" disabled={!stabilityTracking} checked={branchExploreEnabled} onChange={e=>setBranchExploreEnabled(e.target.checked)}/><span>Explorar ± modo crítico</span></label>{branchExploreEnabled&&<label>Amplitude dos probes / raio<input data-testid=\"branch-explore-amplitude\" type=\"number\" min=\"0.0001\" max=\"0.45\" step=\"0.01\" value={branchExploreAmplitude} onChange={e=>setBranchExploreAmplitude(num(e.target.value,.08))}/></label>}<label className=\"checkbox-line\"><input data-testid=\"branch-switch-enabled\""
t=replace_once(t,old,new,'analysis multimode controls')

old="<div data-testid=\"stability-control-note\" className=\"panel-note\">A estabilidade é rastreada pelo autovalor de menor módulo da <b>parte simétrica da tangente escalada</b>. Cruzamento de zero com reversão de Δλ é classificado como ponto‑limite; sem reversão, como <b>candidato a bifurcação</b> apenas quando a tangente é suficientemente simétrica. Com forças follower/não conservativas, o diagnóstico é somente candidato a singularidade. A troca de ramo, desativada por padrão, usa um único passo de semeadura com amplitude no modo crítico e depois retorna ao Arc‑Length.</div>"
new="<div data-testid=\"stability-control-note\" className=\"panel-note\">A v0.19 rastreia os primeiros <b>{Math.round(num(stabilityModeCount,4))} modos críticos</b> da parte simétrica da tangente escalada. O <b>MAC</b> associa modos entre passos e autovalores próximos são agrupados em subespaços para reduzir trocas artificiais de identidade. A exploração ±φ resolve dois estados de equilíbrio locais independentes e <b>não altera</b> o caminho principal; a troca de ramo, separada e opcional, semeia apenas o sentido escolhido e depois retorna ao Arc‑Length. Com forças follower/não conservativas, a classificação continua limitada a candidato a singularidade.</div>"
t=replace_once(t,old,new,'analysis stability note')
t=t.replace('A v0.18 acrescenta <b>diagnóstico espectral de estabilidade</b>, classificação experimental de ponto‑limite/bifurcação e semeadura modal opcional de ramo sobre o Arc-Length/Riks esférico da v0.17','A v0.19 acrescenta <b>rastreamento multimodal por MAC</b>, agrupamento de modos quase degenerados, exploração bilateral ±φ e mantém a classificação experimental de ponto‑limite/bifurcação e a semeadura modal opcional de ramo sobre o Arc-Length/Riks esférico')
p.write_text(t)

# Postprocess
p=Path('app/src/NonlinearPostprocessPanel.tsx'); t=p.read_text()
t=t.replace("switches=stability.branchSwitch?.switches||[],rotational=arc?.monitor?.dof==='rz'","switches=stability.branchSwitch?.switches||[],explorations=stability.branchExploration?.explorations||[],probes=explorations.flatMap((x:any)=>x.probes||[]).filter((x:any)=>x.success),rotational=arc?.monitor?.dof==='rz'",1)
old="{switches.map((s:any,i:number)=>{const row=rows.find((r:any)=>r.step===s.appliedStep);if(!row)return null;const x=sx(num(row.monitoredDisplacement)*factor),y=sy(num(row.loadFactor));return <polygon data-testid=\"branch-switch-marker\" key={`sw-${i}`} points={`${x},${y-7} ${x+7},${y} ${x},${y+7} ${x-7},${y}`}><title>{`Semeadura modal · passo ${s.appliedStep} · retenção=${s.retained?'sim':'não'}`}</title></polygon>})}"
new="{switches.map((s:any,i:number)=>{const row=rows.find((r:any)=>r.step===s.appliedStep);if(!row)return null;const x=sx(num(row.monitoredDisplacement)*factor),y=sy(num(row.loadFactor));return <polygon data-testid=\"branch-switch-marker\" key={`sw-${i}`} points={`${x},${y-7} ${x+7},${y} ${x},${y+7} ${x-7},${y}`}><title>{`Semeadura modal · passo ${s.appliedStep} · retenção=${s.retained?'sim':'não'}`}</title></polygon>})}{probes.map((q:any,i:number)=>{const x=sx(num(q.monitoredDisplacement)*factor),y=sy(num(q.loadFactor));return <polygon data-testid=\"branch-probe-marker\" key={`probe-${i}`} points={`${x},${y-5} ${x+5},${y+5} ${x-5},${y+5}`}><title>{`Probe ${q.sign>0?'+φ':'−φ'} · λ=${fmt(q.loadFactor,5)} · equilíbrio local`}</title></polygon>})}"
t=replace_once(t,old,new,'postprocess probe markers')
t=t.replace('v0.18: círculos maiores = pontos‑limite espectrais; quadrados = bifurcações candidatas; losangos = passo de semeadura modal.','v0.19: círculos maiores = pontos‑limite; quadrados = bifurcações candidatas; losangos = semeadura do caminho principal; triângulos = probes independentes ±φ. Os probes não alteram o caminho principal.')
t=t.replace("branchSwitches=stability?.branchSwitch?.switches||[];","branchSwitches=stability?.branchSwitch?.switches||[],branchExplorations=stability?.branchExploration?.explorations||[],finalClusters=stability?.finalClusters||[];",1)
t=t.replace('<b>Arc-Length/Riks v0.18:</b>','<b>Arc-Length/Riks v0.19:</b>')
old="<b>Estabilidade tangente v0.18:</b> {limitEvents.length} ponto(s)-limite, {bifurcationEvents.length} bifurcação(ões) candidata(s) e {nonConservativeEvents.length} singularidade(s) não conservativa(s) candidata(s)."
new="<b>Estabilidade multimodal v0.19:</b> até {stability.modeCount||1} modo(s) rastreado(s), {finalClusters.filter((c:any)=>c.size>1).length} grupo(s) quase degenerado(s), {limitEvents.length} ponto(s)-limite, {bifurcationEvents.length} bifurcação(ões) candidata(s), {nonConservativeEvents.length} singularidade(s) não conservativa(s) candidata(s) e {branchExplorations.length} exploração(ões) bilateral(is)."
t=replace_once(t,old,new,'postprocess summary')
p.write_text(t)

# Report
p=Path('app/src/NonlinearReportPanel.tsx'); t=p.read_text()
t=t.replace("branchSwitches=stability?.branchSwitch?.switches||[];","branchSwitches=stability?.branchSwitch?.switches||[],branchExplorations=stability?.branchExploration?.explorations||[],finalClusters=stability?.finalClusters||[];",1)
t=t.replace('Singularidades e bifurcações · v0.18','Estabilidade multimodal e ramos · v0.19')
old="A cada estado convergido do Arc-Length, a v0.18 calcula o autovalor de menor módulo da <b>parte simétrica da matriz tangente escalada</b>, com rotações convertidas por Lc."
new="A cada estado convergido do Arc-Length, a v0.19 calcula os primeiros <b>{stability?.modeCount||1} modos</b> da parte simétrica da matriz tangente escalada, com rotações convertidas por Lc. A identidade modal é rastreada pelo <b>Modal Assurance Criterion (MAC)</b> e autovalores próximos são agrupados em subespaços quase degenerados com medida de continuidade entre passos."
t=replace_once(t,old,new,'report stability intro')
old="<div><small>Semeaduras de ramo</small><b>{branchSwitches.length}</b></div></div>"
new="<div><small>Modos rastreados</small><b>{stability?.modeCount||1}</b></div><div><small>Grupos degenerados</small><b>{finalClusters.filter((c:any)=>c.size>1).length}</b></div><div><small>MAC mínimo</small><b>{fmt(stability?.macThreshold,3)}</b></div><div><small>Explorações ±φ</small><b>{branchExplorations.length}</b></div><div><small>Semeaduras de ramo</small><b>{branchSwitches.length}</b></div></div>"
t=replace_once(t,old,new,'report metrics')
old="<th>Modo dominante</th><th>Assimetria Kt</th>"
new="<th>Modo / grupo</th><th>MAC</th><th>Modo dominante</th><th>Assimetria Kt</th>"
t=replace_once(t,old,new,'report event header')
old="<td>{e.dominant?`${e.dominant.nodeId}/${String(e.dominant.dof||'').toUpperCase()}`:'—'}</td><td>{Number(e.tangentAsymmetry||0).toExponential(3)}</td>"
new="<td>{e.modeId||'—'} / {e.clusterId||'—'}{e.clusterSize>1?` (${e.clusterSize})`:''}</td><td>{Number.isFinite(Number(e.mac))?fmt(e.mac,3):'—'}</td><td>{e.dominant?`${e.dominant.nodeId}/${String(e.dominant.dof||'').toUpperCase()}`:'—'}</td><td>{Number(e.tangentAsymmetry||0).toExponential(3)}</td>"
t=replace_once(t,old,new,'report event cells')
marker="{stability?.branchSwitch?.enabled&&<p><b>Troca de ramo experimental:</b>"
insert="{branchExplorations.length>0&&<><p><b>Exploração bilateral experimental:</b> cada bifurcação selecionada é sondada localmente nos sentidos +φ e −φ por uma restrição de amplitude modal, sem substituir o caminho Arc-Length principal. Esses pontos são probes de equilíbrio próximos ao cruzamento detectado, não continuações exaustivas de ramo.</p><div className=\"table-scroll\" data-testid=\"branch-exploration-table\"><table><thead><tr><th>Evento</th><th>Modo</th><th>Sinal</th><th>Status</th><th>λ probe</th><th>u monitor [{arcUnit}]</th><th>Projeção/raio</th></tr></thead><tbody>{branchExplorations.flatMap((x:any,ei:number)=>(x.probes||[]).map((q:any,qi:number)=><tr key={`probe-${ei}-${qi}`}><td>{x.sourceEventStep}</td><td>{x.modeId||'—'}</td><td>{q.sign>0?'+φ':'−φ'}</td><td>{q.success?'convergiu':'falhou'}</td><td>{q.success?fmt(q.loadFactor,6):'—'}</td><td>{q.success?fmt(Number(q.monitoredDisplacement)*arcFactor,4):'—'}</td><td>{q.success?fmt(q.projectionRatio,4):(q.error||'—')}</td></tr>))}</tbody></table></div></>}"
if marker not in t: raise SystemExit('report branch switch marker missing')
t=t.replace(marker,insert+marker,1)
t=t.replace('Esse procedimento não resolve multiplicidade modal, autovalores complexos nem garante a descoberta de todos os ramos.','A v0.19 reduz ambiguidades por MAC e agrupamento modal, mas esse procedimento ainda não resolve autovalores complexos nem garante a descoberta ou continuação exaustiva de todos os ramos.')
p.write_text(t)

# E2E stability
p=Path('tests/e2e/stability-bifurcation.spec.ts'); t=p.read_text()
t=t.replace("await page.getByTestId('stability-asymmetry-tolerance').fill('0.0000001');await page.getByTestId('branch-switch-enabled').check();","await page.getByTestId('stability-asymmetry-tolerance').fill('0.0000001');await page.getByTestId('stability-mode-count').fill('4');await page.getByTestId('stability-cluster-tolerance').fill('0.03');await page.getByTestId('stability-mac-threshold').fill('0.2');await page.getByTestId('branch-explore-enabled').check();await page.getByTestId('branch-explore-amplitude').fill('0.08');await page.getByTestId('branch-switch-enabled').check();",1)
t=t.replace("return [p?.settings?.analysisType,p?.settings?.nonlinearControlMode,p?.settings?.stabilityTracking,p?.settings?.branchSwitchEnabled,Number(p?.settings?.branchSwitchAmplitude)]}).toEqual(['corotational','arc-length',true,true,.12])","return [p?.settings?.analysisType,p?.settings?.nonlinearControlMode,p?.settings?.stabilityTracking,Number(p?.settings?.stabilityModeCount),p?.settings?.branchExploreEnabled,p?.settings?.branchSwitchEnabled,Number(p?.settings?.branchSwitchAmplitude)]}).toEqual(['corotational','arc-length',true,4,true,true,.12])",1)
t=t.replace("await expect(post).toContainText('0.18.0-exp');","await expect(post).toContainText('0.19.0-exp');",1)
t=t.replace("await expect(page.getByTestId('branch-switch-marker')).toHaveCount(1);","await expect(page.getByTestId('branch-switch-marker')).toHaveCount(1);await expect(page.getByTestId('branch-probe-marker')).toHaveCount(2);",1)
t=t.replace("await expect(page.getByTestId('stability-report')).toContainText('Troca de ramo experimental');","await expect(page.getByTestId('stability-report')).toContainText('Troca de ramo experimental');await expect(page.getByTestId('stability-report')).toContainText('Modal Assurance Criterion');await expect(page.getByTestId('branch-exploration-table')).toBeVisible();",1)
p.write_text(t)

# Existing arc-length UI version
p=Path('tests/e2e/arc-length.spec.ts'); t=p.read_text().replace("'0.18.0-exp'","'0.19.0-exp'"); p.write_text(t)
