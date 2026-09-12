from pathlib import Path


def rep(s, old, new, label):
    if new in s:
        return s
    if old not in s:
        raise SystemExit(f'{label}: anchor missing')
    return s.replace(old, new)

# Inspector: cyclic concentrated-hinge controls.
p=Path('app/src/InspectorPanel.tsx'); s=p.read_text()
s=rep(s,
"const defaultFiberHinge={enabled:false,hingeLength:.35,nFibers:80,hardeningRatio:.01};",
"const defaultFiberHinge={enabled:false,hingeLength:.35,nFibers:80,hardeningRatio:.01,cyclic:false,kinematicFraction:1};",
'inspector default hinge')
s=rep(s,
"const normalizedHinge=(raw:any)=>({enabled:!!raw?.enabled,hingeLength:Math.max(1e-4,num(raw?.hingeLength,.35)),nFibers:Math.max(8,Math.min(400,Math.round(num(raw?.nFibers,80)))),hardeningRatio:Math.max(1e-6,Math.min(.25,num(raw?.hardeningRatio,.01)))});",
"const normalizedHinge=(raw:any)=>({enabled:!!raw?.enabled,hingeLength:Math.max(1e-4,num(raw?.hingeLength,.35)),nFibers:Math.max(8,Math.min(400,Math.round(num(raw?.nFibers,80)))),hardeningRatio:Math.max(1e-6,Math.min(.25,num(raw?.hardeningRatio,.01))),cyclic:!!raw?.cyclic,kinematicFraction:Math.max(0,Math.min(1,num(raw?.kinematicFraction,1)))});",
'inspector normalize hinge')
s=rep(s,
"if(distributedPlasticity.cyclic)p.settings={...(p.settings||{}),analysisType:'corotational',nonlinearControlMode:'displacement',cyclicProtocolEnabled:true};p.elementLoads=",
"const cyclicHinge=(fiberHinges.rz1.enabled&&fiberHinges.rz1.cyclic)||(fiberHinges.rz2.enabled&&fiberHinges.rz2.cyclic);if(distributedPlasticity.cyclic||cyclicHinge)p.settings={...(p.settings||{}),analysisType:'corotational',nonlinearControlMode:'displacement',cyclicProtocolEnabled:true};p.elementLoads=",
'inspector cyclic settings')
old_hinge="""  const hingeEditor=(key:'rz1'|'rz2',label:string)=>{const h=draft.fiberHinges[key];return <div className=\"react-card\" data-testid={`fiber-hinge-${key}`}><label className=\"checkbox-line\"><input data-testid={`fiber-hinge-${key}-enabled`} type=\"checkbox\" disabled={!fiberEligible} checked={!!h.enabled} onChange={e=>patchHinge(key,{enabled:e.target.checked})}/><span><b>{label}</b> · fibras</span></label>{h.enabled&&<div className=\"inspector-grid\"><label>Lp [m]<input data-testid={`fiber-hinge-${key}-lp`} type=\"number\" min=\"0.0001\" step=\"0.01\" value={h.hingeLength} onChange={e=>patchHinge(key,{hingeLength:e.target.value})}/></label><label>Fibras<input data-testid={`fiber-hinge-${key}-fibers`} type=\"number\" min=\"8\" max=\"400\" step=\"4\" value={h.nFibers} onChange={e=>patchHinge(key,{nFibers:e.target.value})}/></label><label>Et/E<input data-testid={`fiber-hinge-${key}-hardening`} type=\"number\" min=\"0.000001\" max=\"0.25\" step=\"0.005\" value={h.hardeningRatio} onChange={e=>patchHinge(key,{hardeningRatio:e.target.value})}/></label></div>}</div>};"""
new_hinge="""  const hingeEditor=(key:'rz1'|'rz2',label:string)=>{const h=draft.fiberHinges[key];return <div className=\"react-card\" data-testid={`fiber-hinge-${key}`}><label className=\"checkbox-line\"><input data-testid={`fiber-hinge-${key}-enabled`} type=\"checkbox\" disabled={!fiberEligible} checked={!!h.enabled} onChange={e=>patchHinge(key,{enabled:e.target.checked})}/><span><b>{label}</b> · fibras</span></label>{h.enabled&&<div className=\"inspector-grid\"><label>Lp [m]<input data-testid={`fiber-hinge-${key}-lp`} type=\"number\" min=\"0.0001\" step=\"0.01\" value={h.hingeLength} onChange={e=>patchHinge(key,{hingeLength:e.target.value})}/></label><label>Fibras<input data-testid={`fiber-hinge-${key}-fibers`} type=\"number\" min=\"8\" max=\"400\" step=\"4\" value={h.nFibers} onChange={e=>patchHinge(key,{nFibers:e.target.value})}/></label><label>Et/E<input data-testid={`fiber-hinge-${key}-hardening`} type=\"number\" min=\"0.000001\" max=\"0.25\" step=\"0.005\" value={h.hardeningRatio} onChange={e=>patchHinge(key,{hardeningRatio:e.target.value})}/></label><label className=\"checkbox-line\"><input data-testid={`fiber-hinge-${key}-cyclic`} type=\"checkbox\" checked={!!h.cyclic} onChange={e=>patchHinge(key,{cyclic:e.target.checked})}/><span>História cíclica · v0.22</span></label>{h.cyclic&&<label>Fração cinemática η<input data-testid={`fiber-hinge-${key}-kinematic`} type=\"number\" min=\"0\" max=\"1\" step=\"0.05\" value={h.kinematicFraction} onChange={e=>patchHinge(key,{kinematicFraction:e.target.value})}/></label>}</div>}</div>};"""
s=rep(s,old_hinge,new_hinge,'inspector hinge editor')
s=s.replace('<h4>Rótulas de fibras · concentradas</h4>','<h4>Rótulas de fibras · concentradas · v0.22</h4>')
s=s.replace('As rótulas concentradas continuam disponíveis como alternativa. Ao ativá-las, a plasticidade distribuída é desligada. Modelo monotônico bilinear com equilíbrio N–M; não representa resposta cíclica.','As rótulas concentradas continuam disponíveis como alternativa à plasticidade distribuída. A v0.22 permite história cíclica por fibra com endurecimento combinado e Bauschinger; η=1 corresponde à parcela cinemática linear. O estado é comprometido somente após convergência global. Sem História cíclica, permanece o envelope bilinear monotônico v0.17.')
p.write_text(s)

# Analysis panel: expose cyclic-hinge path requirement and version language.
p=Path('app/src/AnalysisPanelV13.tsx'); s=p.read_text()
s=rep(s,
"const fiberHinges=activeFiberHinges(project),fiberHingeCount=fiberHinges.length,hasFiberHinges=fiberHingeCount>0;",
"const fiberHinges=activeFiberHinges(project),fiberHingeCount=fiberHinges.length,hasFiberHinges=fiberHingeCount>0,cyclicFiberHingeCount=fiberHinges.filter((h:any)=>!!h.config?.cyclic).length;",
'analysis cyclic count')
s=s.replace('<b>Rótula de fibras v0.17 exige Geom. não linear.</b>','<b>Rótula de fibras v0.17/v0.22 exige Geom. não linear.</b>')
warn_anchor="{materialRequiresCorotational&&<div data-testid=\"material-mode-warning\" className=\"panel-warning\"><b>Rótula de fibras v0.17/v0.22 exige Geom. não linear.</b> O modo Linear/P‑Delta não pode representar a atualização constitutiva M–Δθ com equilíbrio local N–M.</div>}"
warn_new=warn_anchor+"{cyclicFiberHingeCount>0&&(controlMode!=='displacement'||!cyclicProtocolEnabled)&&<div data-testid=\"cyclic-hinge-path-warning\" className=\"panel-warning\"><b>Rótula cíclica v0.22 requer controle de deslocamento com protocolo cíclico ativo.</b> O estado constitutivo é comprometido passo a passo; carga prescrita e Arc-Length permanecem disponíveis para rótulas monotônicas.</div>}"
if 'cyclic-hinge-path-warning' not in s:
    if warn_anchor not in s: raise SystemExit('analysis warning anchor missing')
    s=s.replace(warn_anchor,warn_new)
s=s.replace('<b>Protocolo cíclico · v0.21</b>','<b>Protocolo cíclico · v0.21/v0.22</b>')
s=s.replace('Rótulas concentradas de fibras de aço bilinear monotônico em seções retangulares, I/H e RHS permanecem acopladas por Newton constitutivo local embutido.','Rótulas concentradas de fibras de aço em seções retangulares, I/H e RHS permanecem acopladas por Newton constitutivo local embutido; a v0.22 acrescenta história cíclica, Bauschinger, energia dissipada e demanda plástica acumulada.')
s=s.replace('<h3>Material não linear · v0.17</h3>','<h3>Material não linear · v0.17 / v0.22</h3>')
p.write_text(s)

# Corotational metadata: generic material commit hook must be reported as active.
p=Path('web/src/solver/corotational2d.js'); s=p.read_text()
s=s.replace("commitRollback:cyclicMaterial?'committed after converged global step; trial states discarded on Newton/line-search rejection':'not active'","commitRollback:(cyclicMaterial||typeof analysisOptions.commitMaterialHistory==='function')?'committed after converged global step; trial states discarded on Newton/line-search rejection':'not active'")
p.write_text(s)

# Solver exported version.
p=Path('web/src/solver/materialNonlinear2d.js'); s=p.read_text()
s=s.replace("export const MATERIAL_NONLINEAR_VERSION = '0.17.0-exp';","export const MATERIAL_NONLINEAR_VERSION = '0.22.0-exp';")
p.write_text(s)

# Nonlinear postprocess: cyclic hinge demand.
p=Path('app/src/NonlinearPostprocessPanel.tsx'); s=p.read_text()
s=s.replace("function PushoverChart({pushover}:{pushover:any}){","function PushoverChart({pushover,materialEnergy=0}:{pushover:any;materialEnergy?:number}){")
s=s.replace('v0.21: caminho reversível por controle de deslocamento; a área do laço λ–u evidencia a resposta histerética global. Energia material dissipada acumulada={fmt(pushover.cumulativeDissipatedEnergy,4)} kN·m.','v0.21/v0.22: caminho reversível por controle de deslocamento; a área do laço λ–u evidencia a resposta histerética global. Energia material dissipada acumulada={fmt(materialEnergy,4)} kN·m.')
old_mat="const materialText=materialRecords.map((r:any)=>`ext.${r.end}: Lp=${fmt(r.hingeLength,3)} m, Δθ=${fmt(r.rotation,6)} rad, N=${fmt(r.targetAxialForce)} kN, M=${fmt(r.constitutiveMoment)} kN·m, kt=${fmtStiffness(r.tangent)} kN·m/rad, ksec=${fmtStiffness(r.secantStiffness)} kN·m/rad, fibras escoadas=${r.yieldedFibers}/${r.fiberCount}, rM=${Number(r.momentResidual||0).toExponential(2)}, rN=${Number(r.axialResidual||0).toExponential(2)} kN`).join('; ');"
new_mat="const materialText=materialRecords.map((r:any)=>`ext.${r.end}: Lp=${fmt(r.hingeLength,3)} m, Δθ=${fmt(r.rotation,6)} rad, N=${fmt(r.targetAxialForce)} kN, M=${fmt(r.constitutiveMoment)} kN·m, kt=${fmtStiffness(r.tangent)} kN·m/rad, ksec=${fmtStiffness(r.secantStiffness)} kN·m/rad, fibras escoadas=${r.yieldedFibers}/${r.fiberCount}${r.cyclic?`, η=${fmt(r.kinematicFraction,2)}, Edis=${fmt(r.cumulativeDissipatedEnergy,5)} kN·m, εp,eq,max=${Number(r.maxEquivalentPlasticStrain||0).toExponential(2)}, reversões,max=${r.maxReversalCount||0}`:''}, rM=${Number(r.momentResidual||0).toExponential(2)}, rN=${Number(r.axialResidual||0).toExponential(2)} kN`).join('; ');"
s=rep(s,old_mat,new_mat,'postprocess material text')
s=s.replace("{hasMaterial&&<span className=\"chip\">material não linear</span>}","{hasMaterial&&<span className=\"chip\">material não linear</span>}{material?.cyclic&&<span className=\"chip\">rótula cíclica v0.22</span>}")
old_note='<b>Não linearidade material v0.17:</b> rótulas concentradas de seção de fibras com aço bilinear monotônico e equilíbrio local N–M.'
new_note="<b>Não linearidade material {material?.cyclic?'cíclica v0.22':'v0.17'}:</b> rótulas concentradas de seção de fibras com {material?.cyclic?'aço bilinear incremental, endurecimento combinado e Bauschinger':'aço bilinear monotônico'} e equilíbrio local N–M."
s=rep(s,old_note,new_note,'postprocess material note')
s=s.replace('Na rótula de fibras v0.17, a tangente constitutiva','Na rótula de fibras, a tangente constitutiva')
s=s.replace("{hasMaterial&&<><div><small>Newton material local</small><b>{material.maxLocalIterations??material.outerIterations??'—'}</b></div><div><small>Resíduo M material</small><b>{Number(material.maxMomentResidual||0).toExponential(2)}</b></div></>}","{hasMaterial&&<><div><small>Newton material local</small><b>{material.maxLocalIterations??material.outerIterations??'—'}</b></div><div><small>Resíduo M material</small><b>{Number(material.maxMomentResidual||0).toExponential(2)}</b></div>{material?.cyclic&&<><div data-testid=\"cyclic-hinge-energy\"><small>Energia dissipada</small><b>{fmt(material.cumulativeDissipatedEnergy,5)} kN·m</b></div><div data-testid=\"cyclic-hinge-plastic-demand\"><small>εp,eq máx.</small><b>{Number(material.maxEquivalentPlasticStrain||0).toExponential(2)}</b></div><div><small>Reversões fibra máx.</small><b>{material.maxReversalCount||0}</b></div></>}</>}")
s=s.replace('<PushoverChart pushover={pushover}/>','<PushoverChart pushover={pushover} materialEnergy={material?.cyclic?num(material?.cumulativeDissipatedEnergy):num(pushover?.cumulativeDissipatedEnergy)}/>')
p.write_text(s)

# Nonlinear report: correct v0.22 scope, demand metrics and limitations.
p=Path('app/src/NonlinearReportPanel.tsx'); s=p.read_text()
s=s.replace("hasMaterial?'. A resposta material inclui rótulas concentradas de seção de fibras de aço com lei bilinear monotônica e equilíbrio local N–M.'","hasMaterial?(material?.cyclic?'. A resposta material inclui rótulas concentradas de fibras de aço com história incremental, endurecimento combinado, Bauschinger e equilíbrio local N–M.':'. A resposta material inclui rótulas concentradas de seção de fibras de aço com lei bilinear monotônica e equilíbrio local N–M.')")
s=s.replace('Protocolo v0.21:','Protocolo v0.21/v0.22:')
s=s.replace('Energia dissipada acumulada={fmt(pushover.cumulativeDissipatedEnergy,5)} kN·m.','Energia dissipada acumulada={fmt(material?.cyclic?material?.cumulativeDissipatedEnergy:pushover.cumulativeDissipatedEnergy,5)} kN·m.')
s=s.replace("Modelo concentrado v0.17: seções retangulares, I/H e RHS discretizadas em fibras de {distributed?.cyclicHistory?'aço bilinear incremental com endurecimento combinado e efeito Bauschinger':'aço bilinear monotônico'}.","Modelo concentrado {material?.cyclic?'v0.22':'v0.17'}: seções retangulares, I/H e RHS discretizadas em fibras de {material?.cyclic?'aço bilinear incremental com endurecimento combinado e efeito Bauschinger':'aço bilinear monotônico'}.")
s=s.replace('No modo padrão, a compatibilização M–Δθ ocorre dentro de cada avaliação global; não há história cíclica e a derivada cruzada axial-material ainda é congelada em cada avaliação da tangente.','No modo padrão, a compatibilização M–Δθ ocorre dentro de cada avaliação global. {material?.cyclic?<>Na v0.22, estados de tentativa são descartados em Newton/line search e o histórico por fibra é comprometido somente após convergência global.</>:<>Na lei monotônica não há memória constitutiva.</>} A derivada cruzada axial-material ainda é congelada em cada avaliação da tangente.')
s=s.replace("<div><small>Lei</small><b>{distributed?.cyclicHistory?'aço bilinear incremental com endurecimento combinado e efeito Bauschinger':'aço bilinear monotônico'}</b></div>","<div><small>Lei</small><b>{material?.cyclic?'incremental + Bauschinger':'aço bilinear monotônico'}</b></div>{material?.cyclic&&<><div data-testid=\"material-cyclic-energy\"><small>Energia dissipada</small><b>{fmt(material?.cumulativeDissipatedEnergy,5)} kN·m</b></div><div><small>εp,eq máx.</small><b>{Number(material?.maxEquivalentPlasticStrain||0).toExponential(2)}</b></div><div><small>Reversões fibra máx.</small><b>{material?.maxReversalCount||0}</b></div></>}")
old_lim="{hasMaterial?'Escopo material v0.14: rótula concentrada apenas em seção retangular de material steel, fibras com envelope bilinear monotônico, encruamento positivo, equilíbrio local N–M e atualização secante externa. Não estão incluídos descarga/recarregamento, Bauschinger, plasticidade cíclica, deterioração, flambagem local, plasticidade distribuída, concreto fissurado/danificado ou interação constitutiva térmica da rótula.':'Não linearidade material não está ativa neste cenário.'}"
new_lim="{hasMaterial?(material?.cyclic?'Escopo material v0.22: rótulas concentradas de fibras de aço em seções rect/I-H/RHS com retorno plástico 1D, endurecimento combinado linear, Bauschinger, energia dissipada e demanda plástica acumulada. Ainda não estão incluídos Armstrong–Frederick, pinching, degradação, fratura, flambagem local, fadiga de baixo ciclo, concreto cíclico ou interação constitutiva térmica da rótula.':'Escopo material monotônico: rótulas concentradas de fibras de aço com envelope bilinear, encruamento positivo e equilíbrio local N–M; sem memória cíclica.'):'Não linearidade material não está ativa neste cenário.'}"
s=rep(s,old_lim,new_lim,'report limitations')
p.write_text(s)

# Permanent structural suite includes the v0.22 smoke.
p=Path('package.json'); s=p.read_text()
s=s.replace('node tests/cyclic-hysteresis-smoke.mjs\",','node tests/cyclic-hysteresis-smoke.mjs && node tests/cyclic-hinge-smoke.mjs\",')
p.write_text(s)

# README/version and permanent documentation.
p=Path('README.md'); s=p.read_text()
s=s.replace('> **v0.21 experimental:** história constitutiva cíclica por fibra sobre a plasticidade distribuída de aço, com retorno plástico, endurecimento combinado, efeito Bauschinger, protocolo reversível de deslocamento e commit/rollback material.','> **v0.22 experimental:** história constitutiva cíclica agora também nas rótulas concentradas de fibras de aço, com retorno plástico, endurecimento combinado, efeito Bauschinger, commit/rollback e demanda plástica acumulada.')
s=s.replace('> **Estado atual — v0.21.0 experimental:**','> **Estado atual — v0.22.0 experimental:**')
s=s.replace('- **rótulas concentradas de fibras de aço v0.16 para seções retangulares, I/H e RHS, com equilíbrio local N–M, linearização tangente-afim e Newton constitutivo embutido em cada avaliação do equilíbrio global**;','- **rótulas concentradas de fibras de aço v0.16/v0.22 para seções retangulares, I/H e RHS, com equilíbrio local N–M, Newton constitutivo embutido e, na v0.22, história cíclica por fibra, Bauschinger, energia dissipada e demanda plástica acumulada**;')
s=s.replace('- documentação da história constitutiva cíclica, Bauschinger e commit/rollback em `docs/cyclic-hysteresis-v021.md`;','- documentação da história constitutiva cíclica, Bauschinger e commit/rollback distribuídos em `docs/cyclic-hysteresis-v021.md`;\n- documentação das rótulas concentradas cíclicas e demanda acumulada em `docs/cyclic-hinges-v022.md`;')
p.write_text(s)

doc=Path('docs/cyclic-hinges-v022.md')
if not doc.exists():
    doc.write_text('''# AstraStruct v0.22 — rótulas concentradas cíclicas de fibras\n\n## Escopo\n\nA v0.22 estende as rótulas concentradas de seção de fibras de aço para análise quase-estática reversível por controle de deslocamento. As famílias suportadas permanecem `rect`, `i`/`h` e `rhs`. O caminho cíclico exige o protocolo de deslocamentos e o acoplamento constitutivo embutido.\n\n## Lei por fibra\n\nCada fibra usa plasticidade uniaxial incremental bilinear com retorno plástico e endurecimento combinado linear. A fração `eta` (`kinematicFraction`) reparte o módulo de endurecimento entre componentes cinemática e isotrópica; `eta=1` representa endurecimento cinemático linear e reproduz o efeito Bauschinger sem introduzir degradação.\n\nVariáveis internas comprometidas incluem deformação plástica, backstress, deformação plástica equivalente, energia dissipada e contador diagnóstico de reversões da própria fibra. O contador de reversões não é equivalente ao número de reversões do deslocamento global.\n\n## Equilíbrio N–M\n\nPara a rotação relativa da rótula `theta`, a curvatura é `kappa=theta/Lp`. A deformação axial de referência `epsilon0` é iterada até reproduzir o esforço normal do elemento. A tangente rotacional a N constante é obtida pelo complemento de Schur da matriz tangente seccional e inserida na ligação por linearização tangente-afim.\n\n## Commit / rollback\n\nDurante Newton, derivadas de carga e line search, todas as avaliações consultam o histórico comprometido do último incremento convergido. O `historyTrial` calculado em estados tentativos não altera a memória. Somente após convergência global o histórico de cada rótula é promovido; em seguida o resíduo é reavaliado com o estado comprometido.\n\nEsse mecanismo foi validado comparando um ciclo com reversões a uma única excursão que termina no mesmo deslocamento: o ciclo deve acumular energia dissipada superior, demonstrando persistência da trajetória entre incrementos.\n\n## Saídas\n\nA resposta v0.22 reporta, por rótula, energia dissipada acumulada, máxima deformação plástica equivalente, backstress máximo e reversões máximas por fibra, além dos resíduos locais N–M. O laço global `lambda-u` continua sendo apresentado como trajetória numérica do padrão de carga.\n\n## Limitações\n\nNão estão implementados Armstrong–Frederick, pinching, degradação de rigidez ou resistência, dano, fratura, flambagem local, fadiga de baixo ciclo, concreto cíclico ou dinâmica no domínio do tempo. Portanto, a v0.22 não deve ser interpretada como modelo calibrado de fadiga ou procedimento normativo sísmico.\n''')
