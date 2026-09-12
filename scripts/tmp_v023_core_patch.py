from pathlib import Path

def rep(s, old, new, label):
    if new in s: return s
    if old not in s: raise SystemExit(f'{label}: anchor missing')
    return s.replace(old,new)

p=Path('web/src/core/model.js');s=p.read_text()
s=rep(s,
"    nodes: [], elements: [], materials: clone(MATERIALS), sections: clone(SECTIONS), supports: [],\n    loads: [], elementLoads: [], settlements: [], nodeSprings: [],",
"    nodes: [], elements: [], materials: clone(MATERIALS), sections: clone(SECTIONS), supports: [],\n    loads: [], elementLoads: [], settlements: [], nodeSprings: [], nodalMasses: [],",
'model nodal masses')
s=rep(s,
"      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',\n      imperfection:",
"      materialMaxIterations: 30, materialTolerance: 1e-6, materialRelaxation: 1, materialCoupling: 'embedded',\n      dynamicMassFormulation: 'consistent', modalModes: 6, dynamicDampingRatio: 0.02, dynamicRayleighMode1: 1, dynamicRayleighMode2: 2, dynamicTimeStep: 0.01, dynamicDuration: 1, dynamicMonitorNodeId: null, dynamicMonitorDof: 'uy', dynamicHistoryPoints: [{t:0,scale:0},{t:0.1,scale:1},{t:1,scale:0}],\n      imperfection:",
'model dynamic defaults')
s=rep(s,
"  p.nodeSprings = Array.isArray(p.nodeSprings) ? p.nodeSprings : [];",
"  p.nodeSprings = Array.isArray(p.nodeSprings) ? p.nodeSprings : [];\n  p.nodalMasses = Array.isArray(p.nodalMasses) ? p.nodalMasses : [];",
'model mass array normalize')
s=rep(s,
"  p.settings.analysisType = analysisType==='pdelta'||analysisType==='corotational' ? analysisType : 'linear';",
"  p.settings.analysisType = ['pdelta','corotational','modal','time-history'].includes(analysisType) ? analysisType : 'linear';",
'model analysis type')
s=rep(s,
"  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';\n  p.settings.imperfection.enabled",
"  p.settings.materialCoupling = p.settings.materialCoupling === 'outer' ? 'outer' : 'embedded';\n  p.settings.dynamicMassFormulation = p.settings.dynamicMassFormulation === 'lumped' ? 'lumped' : 'consistent';\n  p.settings.modalModes = Math.max(1, Math.min(20, Math.round(Number(p.settings.modalModes) || 6)));\n  p.settings.dynamicDampingRatio = Math.max(0, Math.min(.30, Number(p.settings.dynamicDampingRatio) || 0));\n  p.settings.dynamicRayleighMode1 = Math.max(1, Math.min(20, Math.round(Number(p.settings.dynamicRayleighMode1) || 1)));\n  p.settings.dynamicRayleighMode2 = Math.max(1, Math.min(20, Math.round(Number(p.settings.dynamicRayleighMode2) || 2)));\n  p.settings.dynamicTimeStep = Math.max(1e-5, Number(p.settings.dynamicTimeStep) || .01);\n  p.settings.dynamicDuration = Math.max(p.settings.dynamicTimeStep, Number(p.settings.dynamicDuration) || 1);\n  p.settings.dynamicMonitorNodeId = p.settings.dynamicMonitorNodeId || null;\n  p.settings.dynamicMonitorDof = ['ux','uy','rz'].includes(p.settings.dynamicMonitorDof) ? p.settings.dynamicMonitorDof : 'uy';\n  p.settings.dynamicHistoryPoints = (Array.isArray(p.settings.dynamicHistoryPoints)?p.settings.dynamicHistoryPoints:[]).map(x=>({t:Number(x?.t),scale:Number(x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.scale)).sort((a,b)=>a.t-b.t).slice(0,200);\n  if(p.settings.dynamicHistoryPoints.length<2)p.settings.dynamicHistoryPoints=[{t:0,scale:0},{t:.1,scale:1},{t:1,scale:0}];\n  p.settings.imperfection.enabled",
'model dynamic normalization')
s=rep(s,
"  p.nodeSprings = p.nodeSprings.map(s => ({ ...s, id: s.id || uid('SPR'), kx: Math.max(0, Number(s.kx)||0), ky: Math.max(0, Number(s.ky)||0), kr: Math.max(0, Number(s.kr)||0) }));",
"  p.nodeSprings = p.nodeSprings.map(s => ({ ...s, id: s.id || uid('SPR'), kx: Math.max(0, Number(s.kx)||0), ky: Math.max(0, Number(s.ky)||0), kr: Math.max(0, Number(s.kr)||0) }));\n  p.nodalMasses = p.nodalMasses.map(m => ({ ...m, id: m.id || uid('MASS'), mx: Math.max(0, Number(m.mx)||0), my: Math.max(0, Number(m.my)||0), mr: Math.max(0, Number(m.mr)||0) })).filter(m=>m.nodeId&&(m.mx>0||m.my>0||m.mr>0));",
'model nodal mass values')
p.write_text(s)

p=Path('web/src/solver/index.js');s=p.read_text()
s=rep(s,
"import { activeFiberHinges, solveFrameCorotationalFiberHinges2D } from './materialNonlinear2d.js';",
"import { activeFiberHinges, solveFrameCorotationalFiberHinges2D } from './materialNonlinear2d.js';\nimport { solveModal2D, solveTimeHistory2D } from './dynamics2d.js';",
'index import dynamics')
anchor="export function solve(project, scenarioId) {\n  const analysisType=project.settings?.analysisType||'linear',fiberHinges=activeFiberHinges(project);"
new="""export function solve(project, scenarioId) {
  const analysisType=project.settings?.analysisType||'linear',fiberHinges=activeFiberHinges(project),s=project.settings||{};
  if(analysisType==='modal'){
    if(fiberHinges.length)throw new Error('Dinâmica modal v0.23 é linear-elástica; desative as rótulas de fibras.');
    const result=solveModal2D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation});
    const resolved=resolveScenario(project,scenarioId);return{...result,scenario:resolved.scenario,analysisType:'modal'};
  }
  if(analysisType==='time-history'){
    if(fiberHinges.length)throw new Error('História temporal v0.23 é linear-elástica; desative as rótulas de fibras.');
    return solveTimeHistory2D(project,scenarioId,{massFormulation:s.dynamicMassFormulation,dampingRatio:s.dynamicDampingRatio,rayleighMode1:s.dynamicRayleighMode1,rayleighMode2:s.dynamicRayleighMode2,timeStep:s.dynamicTimeStep,duration:s.dynamicDuration,monitorNodeId:s.dynamicMonitorNodeId,monitorDof:s.dynamicMonitorDof,historyPoints:s.dynamicHistoryPoints});
  }"""
s=rep(s,anchor,new,'index dispatcher')
s=s.replace("    const s=project.settings||{},initialImperfection=", "    const initialImperfection=")
p.write_text(s)

p=Path('package.json');s=p.read_text()
s=s.replace('node --check web/src/solver/distributedPlasticity2d.js && node --check web/src/solver/materialNonlinear2d.js', 'node --check web/src/solver/distributedPlasticity2d.js && node --check web/src/solver/materialNonlinear2d.js && node --check web/src/solver/dynamics2d.js')
s=s.replace('node tests/cyclic-hinge-smoke.mjs\",', 'node tests/cyclic-hinge-smoke.mjs && node tests/dynamics-smoke.mjs\",')
p.write_text(s)
