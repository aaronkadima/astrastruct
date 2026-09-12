from pathlib import Path

# model settings
p=Path('web/src/core/model.js'); t=p.read_text()
old="      stabilityTracking: true, stabilityEigenTolerance: 0.05, stabilityAsymmetryTolerance: 1e-6, stabilityMaxDofs: 120, branchSwitchEnabled: false, branchSwitchSign: 1, branchSwitchAmplitude: 0.08,"
new="      stabilityTracking: true, stabilityEigenTolerance: 0.05, stabilityAsymmetryTolerance: 1e-6, stabilityMaxDofs: 120, stabilityModeCount: 4, stabilityClusterTolerance: 0.03, stabilityMacThreshold: 0.25, branchExploreEnabled: false, branchExploreAmplitude: 0.08, branchExploreMaxIterations: 30, branchExploreMaxEvents: 3, branchSwitchEnabled: false, branchSwitchSign: 1, branchSwitchAmplitude: 0.08,"
if old not in t: raise SystemExit('model defaults anchor missing')
t=t.replace(old,new,1)
old="  p.settings.stabilityMaxDofs = Math.max(6, Math.min(500, Math.round(Number(p.settings.stabilityMaxDofs) || 120)));\n  p.settings.branchSwitchEnabled = !!p.settings.branchSwitchEnabled;"
new="  p.settings.stabilityMaxDofs = Math.max(6, Math.min(500, Math.round(Number(p.settings.stabilityMaxDofs) || 120)));\n  p.settings.stabilityModeCount = Math.max(1, Math.min(12, Math.round(Number(p.settings.stabilityModeCount) || 4)));\n  p.settings.stabilityClusterTolerance = Math.max(1e-6, Math.min(0.5, Math.abs(Number(p.settings.stabilityClusterTolerance) || 0.03)));\n  p.settings.stabilityMacThreshold = Math.max(0, Math.min(1, Number(p.settings.stabilityMacThreshold) || 0.25));\n  p.settings.branchExploreEnabled = !!p.settings.branchExploreEnabled;\n  p.settings.branchExploreAmplitude = Math.max(1e-4, Math.min(0.45, Math.abs(Number(p.settings.branchExploreAmplitude) || 0.08)));\n  p.settings.branchExploreMaxIterations = Math.max(5, Math.min(80, Math.round(Number(p.settings.branchExploreMaxIterations) || 30)));\n  p.settings.branchExploreMaxEvents = Math.max(1, Math.min(12, Math.round(Number(p.settings.branchExploreMaxEvents) || 3)));\n  p.settings.branchSwitchEnabled = !!p.settings.branchSwitchEnabled;"
if old not in t: raise SystemExit('model normalization anchor missing')
t=t.replace(old,new,1);p.write_text(t)

# dispatcher options
p=Path('web/src/solver/index.js'); t=p.read_text()
old="stabilityTracking:s.stabilityTracking,stabilityEigenTolerance:s.stabilityEigenTolerance,stabilityAsymmetryTolerance:s.stabilityAsymmetryTolerance,stabilityMaxDofs:s.stabilityMaxDofs,branchSwitchEnabled:s.branchSwitchEnabled,branchSwitchSign:s.branchSwitchSign,branchSwitchAmplitude:s.branchSwitchAmplitude"
new="stabilityTracking:s.stabilityTracking,stabilityEigenTolerance:s.stabilityEigenTolerance,stabilityAsymmetryTolerance:s.stabilityAsymmetryTolerance,stabilityMaxDofs:s.stabilityMaxDofs,stabilityModeCount:s.stabilityModeCount,stabilityClusterTolerance:s.stabilityClusterTolerance,stabilityMacThreshold:s.stabilityMacThreshold,branchExploreEnabled:s.branchExploreEnabled,branchExploreAmplitude:s.branchExploreAmplitude,branchExploreMaxIterations:s.branchExploreMaxIterations,branchExploreMaxEvents:s.branchExploreMaxEvents,branchSwitchEnabled:s.branchSwitchEnabled,branchSwitchSign:s.branchSwitchSign,branchSwitchAmplitude:s.branchSwitchAmplitude"
if old not in t: raise SystemExit('index options anchor missing')
t=t.replace(old,new,1);p.write_text(t)

# material wrapper arc-length version
p=Path('web/src/solver/materialNonlinear2d.js'); t=p.read_text()
t=t.replace("solverVersion: options.controlMode === 'arc-length' ? '0.18.0-exp' : '0.16.0-exp'","solverVersion: options.controlMode === 'arc-length' ? '0.19.0-exp' : '0.16.0-exp'",1)
p.write_text(t)

# package test suite
p=Path('package.json'); t=p.read_text()
old="node tests/stability-bifurcation-smoke.mjs\""
new="node tests/stability-bifurcation-smoke.mjs && node tests/multimode-stability-smoke.mjs\""
if old not in t: raise SystemExit('package test anchor missing')
t=t.replace(old,new,1);p.write_text(t)
