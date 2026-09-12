from pathlib import Path

p=Path('app/src/NonlinearReportPanel.tsx')
s=p.read_text()
s=s.replace('v0.15','v0.16')
old="""material=r?.materialNonlinearity,materialRecords=material?.records||[],hasMaterial=!!material?.enabled;"""
new="""material=r?.materialNonlinearity,materialRecords=material?.records||[],hasMaterial=!!material?.enabled,pushover=r?.pushover,hasPushover=!!pushover?.enabled,controlFactor=pushover?.control?.dof==='rz'?1:1000,controlUnit=pushover?.control?.dof==='rz'?'rad':'mm';"""
if old not in s: raise SystemExit('report state anchor not found')
s=s.replace(old,new,1)
old="""<div><small>DOFs ativos</small><b>{r?.activeDofs??'—'}</b></div><div><small>{hasImperfection?'u total máx.':'Deslocamento máx.'}</small><b>{fmt(maxTotal,3)} mm</b></div>"""
new="""<div><small>DOFs ativos</small><b>{r?.activeDofs??'—'}</b></div>{hasPushover&&<><div><small>Controle</small><b>{pushover.control?.nodeId}/{String(pushover.control?.dof||'').toUpperCase()}</b></div><div><small>λ final / pico</small><b>{fmt(pushover.finalLoadFactor,4)} / {fmt(pushover.peakLoadFactor,4)}</b></div></>}<div><small>{hasImperfection?'u total máx.':'Deslocamento máx.'}</small><b>{fmt(maxTotal,3)} mm</b></div>"""
if old not in s: raise SystemExit('report main metrics anchor not found')
s=s.replace(old,new,1)
anchor="""      <div className="table-scroll"><table><thead><tr><th>Passo</th><th>Fator de carga</th><th>Iterações</th><th>‖r‖∞</th></tr></thead><tbody>{history.map((h:any)=><tr key={h.step}><td>{h.step}</td><td>{fmt(h.loadFactor,4)}</td><td>{h.iterations}</td><td>{Number(h.residualNorm).toExponential(3)}</td></tr>)}</tbody></table></div>
"""
extra=anchor+"""      {hasPushover&&<section data-testid="pushover-report"><h3>2.1. Pushover por controle de deslocamento</h3><p>O fator do padrão de carga <b>λ</b> é tratado como incógnita adicional e a restrição cinemática impõe o deslocamento de {pushover.control?.nodeId}/{String(pushover.control?.dof||'').toUpperCase()} em cada incremento. A correção de Newton usa um sistema aumentado bordado; ∂R/∂λ é avaliada sobre o resíduo global completo. O caminho calculado possui {pushover.curve?.length||0} pontos. Arc-length não está ativo nesta versão.</p><div className="metrics-row"><div><small>Alvo</small><b>{fmt(Number(pushover.control?.targetDisplacement||0)*controlFactor,3)} {controlUnit}</b></div><div><small>λ final</small><b>{fmt(pushover.finalLoadFactor,5)}</b></div><div><small>λ pico</small><b>{fmt(pushover.peakLoadFactor,5)}</b></div><div><small>u no pico</small><b>{fmt(Number(pushover.peakControlledDisplacement||0)*controlFactor,3)} {controlUnit}</b></div><div><small>Primeiro escoamento</small><b>{pushover.firstYield?`passo ${pushover.firstYield.step}`:'não detectado'}</b></div></div><div className="table-scroll"><table><thead><tr><th>Passo</th><th>u controlado [{controlUnit}]</th><th>λ</th><th>Reação base</th><th>Rótulas escoadas</th><th>Novas rótulas</th></tr></thead><tbody>{(pushover.curve||[]).map((h:any)=><tr key={`push-${h.step}`}><td>{h.step}</td><td>{fmt(Number(h.controlledDisplacement)*controlFactor,4)}</td><td>{fmt(h.loadFactor,5)}</td><td>{fmt(h.baseReaction,4)}</td><td>{h.yieldedHingeCount||0}</td><td>{(h.newlyYieldedHinges||[]).map((x:any)=>`${x.elementId}/ext.${x.end}`).join(', ')||'—'}</td></tr>)}</tbody></table></div></section>}
"""
if anchor not in s: raise SystemExit('report convergence table anchor not found')
s=s.replace(anchor,extra,1)
# Explicitly record control mode in section 2 text area through the metrics row.
s=s.replace("<h3>2. Controle incremental e convergência</h3><div className=\"metrics-row\">","<h3>2. Controle incremental e convergência</h3>{hasPushover&&<p><b>Modo:</b> controle de deslocamento com λ variável. Piso absoluto de equilíbrio do algoritmo: {Number(r?.nonlinear?.absoluteTolerance||0).toExponential(2)} kN; tolerância relativa: {Number(r?.nonlinear?.tolerance||0).toExponential(2)}.</p>}<div className=\"metrics-row\">",1)
p.write_text(s)
