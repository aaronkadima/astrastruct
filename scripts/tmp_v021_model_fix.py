from pathlib import Path
p=Path('web/src/core/model.js'); s=p.read_text()
settings="nonlinearControlMode: 'load', displacementControlNodeId: null, displacementControlDof: 'uy', displacementControlTarget: -0.05, displacementControlTolerance: 1e-7,"
if 'cyclicProtocolEnabled:' not in s:
    s=s.replace(settings,settings+"\n      cyclicProtocolEnabled: false, cyclicProtocolTargets: [-0.02,0.02,-0.04,0.04,0], cyclicStepsPerSegment: 6,")
anchor="p.settings.displacementControlTolerance = Math.max(1e-10, Number(p.settings.displacementControlTolerance) || 1e-7);"
if 'p.settings.cyclicProtocolEnabled' not in s:
    s=s.replace(anchor,anchor+"\n  p.settings.cyclicProtocolEnabled = !!p.settings.cyclicProtocolEnabled;\n  p.settings.cyclicProtocolTargets = (Array.isArray(p.settings.cyclicProtocolTargets)?p.settings.cyclicProtocolTargets:[]).map(Number).filter(Number.isFinite).slice(0,30);\n  if(!p.settings.cyclicProtocolTargets.length)p.settings.cyclicProtocolTargets=[-0.02,0.02,-0.04,0.04,0];\n  p.settings.cyclicStepsPerSegment = Math.max(2, Math.min(60, Math.round(Number(p.settings.cyclicStepsPerSegment) || 6)));")
old="const rawDp=e.distributedPlasticity||{},integrationPoints=[3,5].includes(Math.round(Number(rawDp.integrationPoints)))?Math.round(Number(rawDp.integrationPoints)):5,distributedPlasticity={enabled:!!rawDp.enabled,integrationPoints,nFibers:Math.max(8,Math.min(400,Math.round(Number(rawDp.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(rawDp.hardeningRatio)||.01)))};"
new="const rawDp=e.distributedPlasticity||{},integrationPoints=[3,5].includes(Math.round(Number(rawDp.integrationPoints)))?Math.round(Number(rawDp.integrationPoints)):5,distributedPlasticity={enabled:!!rawDp.enabled,integrationPoints,nFibers:Math.max(8,Math.min(400,Math.round(Number(rawDp.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(rawDp.hardeningRatio)||.01))),cyclic:!!rawDp.cyclic,kinematicFraction:Math.max(0,Math.min(1,Number.isFinite(Number(rawDp.kinematicFraction))?Number(rawDp.kinematicFraction):1))};"
if old not in s and 'kinematicFraction:' not in s: raise SystemExit('v0.20 distributedPlasticity normalization anchor missing')
s=s.replace(old,new)
p.write_text(s)
