from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(s.replace(old,new,1))

# Product version.
replace_once('web/src/core/version.js', "export const PRODUCT_VERSION = '0.25.1';", "export const PRODUCT_VERSION = '0.26.0';")

# Element registry: 3D types and mixed classification.
p=Path('web/src/core/elementRegistry.js'); s=p.read_text()
s=s.replace("  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return 'mixed2d';\n  return 'unsupported';", "  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return 'mixed2d';\n  if (types.size === 1 && types.has('truss3d')) return 'truss3d';\n  if (types.size === 1 && types.has('frame3d')) return 'frame3d';\n  if ([...types].every(t => t === 'frame3d' || t === 'truss3d')) return 'mixed3d';\n  return 'unsupported';",1)
if "type: 'truss3d'" not in s:
    s += """\n\nregisterElementType({\n  type: 'truss3d',\n  label: 'Treliça 3D',\n  dimension: '3d',\n  dofsPerNode: ['ux','uy','uz'],\n  nodeCount: 2,\n  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: false },\n});\n\nregisterElementType({\n  type: 'frame3d',\n  label: 'Frame 3D Euler–Bernoulli',\n  dimension: '3d',\n  dofsPerNode: ['ux','uy','uz','rx','ry','rz'],\n  nodeCount: 2,\n  capabilities: { linear: true, pdelta: false, corotational: false, dynamics: false },\n});\n"""
p.write_text(s)

# Solver registry.
p=Path('web/src/core/solverRegistry.js'); s=p.read_text()
if "linear-frame3d" not in s:
    s += """\nregisterSolver({ id: 'linear-truss3d', analysisType: 'linear', dimensions: ['3d'], elementSets: ['truss3d'] });\nregisterSolver({ id: 'linear-frame3d', analysisType: 'linear', dimensions: ['3d'], elementSets: ['frame3d'] });\nregisterSolver({ id: 'linear-mixed3d', analysisType: 'linear', dimensions: ['3d'], elementSets: ['mixed3d'] });\n"""
p.write_text(s)

# Scenario scaling: 3D nodal/member loads and prescribed support DOFs.
p=Path('web/src/solver/scenario.js'); s=p.read_text()
s=s.replace("fx:(load.fx||0)*factor,fy:(load.fy||0)*factor,mz:(load.mz||0)*factor", "fx:(load.fx||0)*factor,fy:(load.fy||0)*factor,fz:(load.fz||0)*factor,mx:(load.mx||0)*factor,my:(load.my||0)*factor,mz:(load.mz||0)*factor",1)
s=s.replace("if(load.kind==='uniform'){out.qx=(load.qx||0)*factor;out.qy=(load.qy||0)*factor}", "if(load.kind==='uniform'){out.qx=(load.qx||0)*factor;out.qy=(load.qy||0)*factor;out.qz=(load.qz||0)*factor}",1)
s=s.replace("else if(load.kind==='point'||load.kind==='followerEnd'){out.px=(load.px||0)*factor;out.py=(load.py||0)*factor}", "else if(load.kind==='point'||load.kind==='followerEnd'){out.px=(load.px||0)*factor;out.py=(load.py||0)*factor;out.pz=(load.pz||0)*factor}",1)
s=s.replace("if(!acc){acc={ux:0,uy:0,rz:0};settlementByNode.set(st.nodeId,acc)}acc.ux+=(st.ux||0)*factor;acc.uy+=(st.uy||0)*factor;acc.rz+=(st.rz||0)*factor", "if(!acc){acc={ux:0,uy:0,uz:0,rx:0,ry:0,rz:0};settlementByNode.set(st.nodeId,acc)}acc.ux+=(st.ux||0)*factor;acc.uy+=(st.uy||0)*factor;acc.uz+=(st.uz||0)*factor;acc.rx+=(st.rx||0)*factor;acc.ry+=(st.ry||0)*factor;acc.rz+=(st.rz||0)*factor",1)
s=s.replace("const st=settlementByNode.get(s.nodeId)||{ux:0,uy:0,rz:0};return{...clone(s),uxValue:(Number(s.baseUxValue)||0)+st.ux,uyValue:(Number(s.baseUyValue)||0)+st.uy,rzValue:(Number(s.baseRzValue)||0)+st.rz}", "const st=settlementByNode.get(s.nodeId)||{ux:0,uy:0,uz:0,rx:0,ry:0,rz:0};return{...clone(s),uxValue:(Number(s.baseUxValue)||0)+st.ux,uyValue:(Number(s.baseUyValue)||0)+st.uy,uzValue:(Number(s.baseUzValue)||0)+st.uz,rxValue:(Number(s.baseRxValue)||0)+st.rx,ryValue:(Number(s.baseRyValue)||0)+st.ry,rzValue:(Number(s.baseRzValue)||0)+st.rz}",1)
p.write_text(s)

# Model additions: 3D section, support values, makers, demo.
p=Path('web/src/core/model.js'); s=p.read_text()
s=s.replace("  { id: 'steel_generic', name: 'Aço — seção genérica', family: 'steel', A: 0.012, I: 0.000220 },", "  { id: 'steel_generic', name: 'Aço — seção genérica', family: 'steel', A: 0.012, I: 0.000220 },\n  { id: 'steel_space_demo', name: 'Aço — seção espacial demonstrativa', family: 'steel3d', A: 0.012, Iy: 0.000180, Iz: 0.000220, J: 0.000030, I: 0.000220 },",1)
s=s.replace("p.settlements = p.settlements.map(s => ({ ...s, caseId: s.caseId || firstCaseId, ux: Number(s.ux)||0, uy: Number(s.uy)||0, rz: Number(s.rz)||0 }));", "p.settlements = p.settlements.map(s => ({ ...s, caseId: s.caseId || firstCaseId, ux: Number(s.ux)||0, uy: Number(s.uy)||0, uz: Number(s.uz)||0, rx: Number(s.rx)||0, ry: Number(s.ry)||0, rz: Number(s.rz)||0 }));",1)
s=s.replace("baseUyValue: Number(s.baseUyValue) || 0,\n    baseRzValue: Number(s.baseRzValue) || 0", "baseUyValue: Number(s.baseUyValue) || 0,\n    baseUzValue: Number(s.baseUzValue) || 0,\n    baseRxValue: Number(s.baseRxValue) || 0,\n    baseRyValue: Number(s.baseRyValue) || 0,\n    baseRzValue: Number(s.baseRzValue) || 0",1)
anchor="""export function makeTrussElement({ id = uid('E'), n1, n2, materialId = 'steel355', sectionId = 'truss_generic', label = 'Treliça 2D', A } = {}) {\n  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS.find(s => s.id === 'truss_generic');\n  return { id, type: 'truss2d', n1, n2, materialId, sectionId, A: A ?? section.A, I: 0, releases: { rz1: true, rz2: true }, rotationalSprings: { rz1: 0, rz2: 0 }, label };\n}\n"""
addition=anchor+"""\nexport function makeFrame3DElement({ id = uid('E'), n1, n2, materialId = 'steel355', sectionId = 'steel_space_demo', label = 'Frame 3D', A, Iy, Iz, J, orientation } = {}) {\n  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS.find(s => s.id === 'steel_space_demo') || SECTIONS[0];\n  return { id, type: 'frame3d', n1, n2, materialId, sectionId, A: A ?? section.A, Iy: Iy ?? section.Iy ?? section.I, Iz: Iz ?? section.Iz ?? section.I, J: J ?? section.J, orientation: orientation || undefined, label };\n}\n\nexport function makeTruss3DElement({ id = uid('E'), n1, n2, materialId = 'steel355', sectionId = 'truss_generic', label = 'Treliça 3D', A } = {}) {\n  const section = SECTIONS.find(s => s.id === sectionId) || SECTIONS.find(s => s.id === 'truss_generic') || SECTIONS[0];\n  return { id, type: 'truss3d', n1, n2, materialId, sectionId, A: A ?? section.A, label };\n}\n"""
if "makeFrame3DElement" not in s:
    if anchor not in s: raise SystemExit('makeTrussElement anchor missing')
    s=s.replace(anchor,addition,1)
if "export function demoSpatialFrame()" not in s:
    s += """\n\nexport function demoSpatialFrame() {\n  const p=emptyProject();p.name='Pórtico espacial 3D demonstrativo';\n  p.nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3},{id:'N3',x:4,y:0,z:3},{id:'N4',x:4,y:2.5,z:3}];\n  p.elements=[\n    makeFrame3DElement({id:'E1',n1:'N1',n2:'N2',label:'Pilar espacial'}),\n    makeFrame3DElement({id:'E2',n1:'N2',n2:'N3',label:'Viga X'}),\n    makeFrame3DElement({id:'E3',n1:'N3',n2:'N4',label:'Viga Y',orientation:{up:[0,0,1]}})\n  ];\n  p.supports=[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}];\n  p.loads=[{id:'L3D',caseId:'LC1',nodeId:'N4',fx:12,fy:-8,fz:-25,mx:2,my:0,mz:1}];\n  p.settings.analysisType='linear';p.settings.analysisScenarioId='LC1';return normalizeProject(p);\n}\n"""
p.write_text(s)

# Dispatcher 3D route and protected scope.
p=Path('web/src/solver/index.js'); s=p.read_text()
if "./spatial3d.js" not in s:
    s=s.replace("import { solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D } from './dynamics2d.js';", "import { solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D } from './dynamics2d.js';\nimport { solveSpatial3D } from './spatial3d.js';",1)
s=s.replace("import { classifyElementSet } from '../core/elementRegistry.js';", "import { classifyElementSet, inferProjectDimension } from '../core/elementRegistry.js';",1)
s=s.replace("  if (elementSet === 'mixed2d') return solveMixed2D(project);", "  if (elementSet === 'mixed2d') return solveMixed2D(project);\n  if (elementSet === 'truss3d' || elementSet === 'frame3d' || elementSet === 'mixed3d') return solveSpatial3D(project);",1)
s=s.replace("  const analysisType=project.settings?.analysisType||'linear',fiberHinges=activeFiberHinges(project),s=project.settings||{};", "  const analysisType=project.settings?.analysisType||'linear',dimension=inferProjectDimension(project),fiberHinges=activeFiberHinges(project),s=project.settings||{};\n  if(dimension==='3d'&&analysisType!=='linear')throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.26; use análise linear.`);",1)
old="""  const result = solveStructuralModel(project,resolved.project,scenarioId||resolved.scenario?.id);\n  const elementResponses = buildElementResponses(resolved.project, result, 41);\n  return {\n    ...result,\n    elementResponses,\n    scenario: resolved.scenario,\n    analysisType: resolved.project.settings?.analysisType || 'linear',\n    solverVersion: analysisType==='pdelta'?'0.12.0':'0.13.4-exp'\n  };"""
new="""  const result = solveStructuralModel(project,resolved.project,scenarioId||resolved.scenario?.id);\n  if(result.dimension==='3d')return{...result,scenario:resolved.scenario,analysisType:'linear',solverVersion:result.solverVersion||'0.26.0'};\n  const elementResponses = buildElementResponses(resolved.project, result, 41);\n  return {\n    ...result,\n    elementResponses,\n    scenario: resolved.scenario,\n    analysisType: resolved.project.settings?.analysisType || 'linear',\n    solverVersion: analysisType==='pdelta'?'0.12.0':'0.13.4-exp'\n  };"""
if old not in s: raise SystemExit('dispatcher result anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# Package: permanent checks and regression.
p=Path('package.json'); s=p.read_text()
s=s.replace('"version": "0.25.1"','"version": "0.26.0"',1)
s=s.replace('"test": "node tests/architecture-v0251-smoke.mjs', '"test": "node tests/architecture-v0251-smoke.mjs && node tests/spatial3d-v026-smoke.mjs && node tests/spatial3d-integration-v026-smoke.mjs',1)
s=s.replace('node --check web/src/solver/mixed2d.js"', 'node --check web/src/solver/mixed2d.js && node --check web/src/solver/spatial3d.js"',1)
p.write_text(s)

# README header.
p=Path('README.md'); s=p.read_text()
intro="""## AstraStruct v0.26 — fundação estrutural 3D\n\nA v0.26 introduz o primeiro kernel espacial linear: `truss3d` e `frame3d`, 6 DOFs por nó, transformação local/global robusta, axial, torção e flexão biaxial, cargas nodais 3D e distribuídas locais, cenários/combinações e recuperação `N/Vy/Vz/T/My/Mz`. Recursos não lineares e dinâmicos 3D permanecem fora do escopo desta versão. Veja `docs/spatial3d-v026.md`.\n\n"""
if not s.startswith('## AstraStruct v0.26'):
    s=intro+s
p.write_text(s)

# App: demo factory, 3D result table, demo button.
p=Path('app/src/App.tsx'); s=p.read_text()
s=s.replace("demoFrame, demoBeamUDL, demoTruss, demoMixed, demoLoadCases", "demoFrame, demoBeamUDL, demoTruss, demoMixed, demoSpatialFrame, demoLoadCases",1)
marker="function ResultsPanel({result}:{result:any}){\n  if(!result)return <div className=\"empty-state\">Execute a análise para visualizar deslocamentos, reações e esforços.</div>;"
insert=marker+"\n  if(result.dimension==='3d'){const disps=result.displacements||[],forces=result.elementForces||[],maxT=Math.max(0,...disps.map((d:any)=>Math.hypot(Number(d.ux)||0,Number(d.uy)||0,Number(d.uz)||0)))*1000;return <div className=\"results-content\" data-testid=\"spatial3d-results\"><div className=\"metrics\"><div><span>Solver</span><strong>{result.type}</strong></div><div><span>Dimensão</span><strong>3D · 6 DOFs/nó</strong></div><div><span>|u| máx.</span><strong>{maxT.toFixed(4)} mm</strong></div><div><span>Kernel</span><strong>{result.solverVersion}</strong></div></div><div className=\"panel-note\">Fundação 3D linear v0.26. O canvas atual é uma projeção XY; os resultados abaixo são espaciais completos.</div><div className=\"table-wrap\"><table><thead><tr><th>Nó</th><th>Ux [mm]</th><th>Uy [mm]</th><th>Uz [mm]</th><th>Rx</th><th>Ry</th><th>Rz</th></tr></thead><tbody>{disps.map((d:any)=><tr key={d.nodeId}><td>{d.nodeId}</td><td>{(1000*Number(d.ux||0)).toFixed(4)}</td><td>{(1000*Number(d.uy||0)).toFixed(4)}</td><td>{(1000*Number(d.uz||0)).toFixed(4)}</td><td>{Number(d.rx||0).toExponential(3)}</td><td>{Number(d.ry||0).toExponential(3)}</td><td>{Number(d.rz||0).toExponential(3)}</td></tr>)}</tbody></table></div><div className=\"table-wrap\" data-testid=\"spatial3d-forces\"><table><thead><tr><th>Elemento</th><th>N1</th><th>Vy1</th><th>Vz1</th><th>T1</th><th>My1</th><th>Mz1</th></tr></thead><tbody>{forces.map((f:any)=><tr key={f.elementId}><td>{f.elementId}</td><td>{Number(f.N1??-f.axialForce??0).toFixed(3)}</td><td>{Number(f.Vy1||0).toFixed(3)}</td><td>{Number(f.Vz1||0).toFixed(3)}</td><td>{Number(f.T1||0).toFixed(3)}</td><td>{Number(f.My1||0).toFixed(3)}</td><td>{Number(f.Mz1||0).toFixed(3)}</td></tr>)}</tbody></table></div></div>}"
if marker not in s: raise SystemExit('ResultsPanel marker missing')
s=s.replace(marker,insert,1)
s=s.replace("<IconButton icon=\"mixed\" label=\"Modelo misto\" onClick={()=>useDemo(demoMixed)}/>", "<IconButton icon=\"mixed\" label=\"Modelo misto\" onClick={()=>useDemo(demoMixed)}/><IconButton icon=\"frame\" label=\"Pórtico 3D demonstrativo\" onClick={()=>useDemo(demoSpatialFrame)}/>",1)
s=s.replace("<button onClick={()=>useDemo(demoLoadCases)}><Glyph name=\"cases\"/><span><b>Exemplo de ações</b><small>casos + combinação</small></span></button>", "<button onClick={()=>useDemo(demoLoadCases)}><Glyph name=\"cases\"/><span><b>Exemplo de ações</b><small>casos + combinação</small></span></button><button onClick={()=>useDemo(demoSpatialFrame)}><Glyph name=\"frame\"/><span><b>Pórtico espacial 3D</b><small>v0.26 · projeção XY</small></span></button>",1)
p.write_text(s)

# Integration smoke test.
Path('tests/spatial3d-integration-v026-smoke.mjs').write_text(r'''import assert from 'node:assert/strict';
import { demoSpatialFrame, normalizeProject } from '../web/src/core/model.js';
import { classifyElementSet, inferProjectDimension, getElementDefinition } from '../web/src/core/elementRegistry.js';
import { findSolver } from '../web/src/core/solverRegistry.js';
import { solve } from '../web/src/solver/index.js';

const p=demoSpatialFrame();
assert.equal(inferProjectDimension(p),'3d');
assert.equal(classifyElementSet(p),'frame3d');
assert.equal(getElementDefinition('frame3d').dofsPerNode.length,6);
assert.equal(findSolver({analysisType:'linear',dimension:'3d',elementSet:'frame3d'}).id,'linear-frame3d');
const r=solve(p,'LC1');
assert.equal(r.dimension,'3d');
assert.equal(r.contract.request.model.dimension,'3d');
assert.equal(r.contract.request.solverId,'linear-frame3d');
assert.equal(r.elementForces.length,3);
assert.ok(r.displacements.some(d=>Math.abs(d.uz)>1e-12));

const c=normalizeProject({...p,loadCases:[{id:'G',name:'G'},{id:'Q',name:'Q'}],loadCombinations:[{id:'U',name:'U',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}],loads:[{id:'G1',caseId:'G',nodeId:'N4',fz:-10},{id:'Q1',caseId:'Q',nodeId:'N4',fy:-4}],settings:{...p.settings,analysisScenarioId:'U'}});
const rc=solve(c,'U');
const rr=rc.reactions.find(x=>x.nodeId==='N1');
assert.ok(Math.abs(rr.fz-12)<1e-8,`combination Fz reaction ${rr.fz}`);
assert.ok(Math.abs(rr.fy-6)<1e-8,`combination Fy reaction ${rr.fy}`);
assert.throws(()=>solve({...p,settings:{...p.settings,analysisType:'pdelta'}},'LC1'),/ainda não é suportada em 3D/);
console.log('v0.26 3D integration smoke: OK',{solver:r.type,maxUz:Math.max(...r.displacements.map(d=>Math.abs(d.uz)))})
''')

# E2E project is inserted through localStorage so it works identically on desktop/mobile/tablet.
Path('tests/e2e/spatial3d-v026.spec.ts').write_text(r'''import { test, expect } from '@playwright/test';

test('v0.26 solves a 3D frame and exposes spatial DOFs and forces',async({page})=>{
  const project={id:'p3d',name:'E2E frame 3D',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:3,y:1,z:2}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.01,Iy:7e-5,Iz:9e-5,J:2e-5,orientation:{up:[0,0,1]}}],materials:[{id:'S',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A:.01,Iy:7e-5,Iz:9e-5,J:2e-5,I:9e-5}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'L',caseId:'LC1',nodeId:'N2',fx:5,fy:-7,fz:-11,mx:2,my:0,mz:0}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{solverVersion:'0.13.6-exp'}};
  await page.addInitScript(p=>localStorage.setItem('astrastruct.project',JSON.stringify(p)),project);
  await page.goto('./');
  await page.getByTestId('analyze-button').click();
  const result=page.getByTestId('spatial3d-results');await expect(result).toBeVisible();
  await expect(result).toContainText('3D · 6 DOFs/nó');await expect(result).toContainText('0.26.0');
  await expect(page.getByTestId('spatial3d-forces')).toContainText('E1');
});
''')

# Documentation.
Path('docs/spatial3d-v026.md').write_text(r'''# AstraStruct v0.26 — 3D Structural Foundation

## Scope
The v0.26 kernel is linear-elastic and supports `frame3d`, `truss3d`, and mixed assemblies of those two element types. Each node owns the six global DOFs `[Ux, Uy, Uz, Rx, Ry, Rz]`.

## Local axes and transformation
For an element joining points **x1** and **x2**, local `ex` follows the chord. A user `orientation.up` vector may define the local-y reference; otherwise a robust global fallback is selected and orthogonalized. `ez = ex × ey`. The block transformation maps global translations and rotations to the local triad and the element stiffness is transformed as `Kg = Tᵀ Kl T`.

## Frame stiffness
The 12×12 Euler–Bernoulli local matrix contains axial `EA/L`, Saint-Venant torsion `GJ/L`, bending about local z with `EIz`, and bending about local y with `EIy`. Shear deformation and warping torsion are outside v0.26.

## Loading and scenarios
Nodal actions support `[Fx,Fy,Fz,Mx,My,Mz]`. Frame members support uniform local `[qx,qy,qz]`. Existing load cases/combinations are resolved before the spatial solver, so all 3D load components are scaled by scenario factors. Truss-member distributed loading remains intentionally unsupported.

## Recovery
`frame3d` returns the two-end local generalized forces `N, Vy, Vz, T, My, Mz`; `truss3d` returns its axial force. Reactions are recovered in global axes.

## Protected scope
v0.26 does not claim 3D P-Delta, co-rotational analysis, material nonlinearity, dynamics, shells, solids, contact, member releases, rigid offsets, shear deformation, or warping. Those capabilities must be introduced and validated separately.

## Validation
Permanent tests cover two orthogonal cantilever bending planes, torsion, arbitrary spatial orientation, 3D truss axial response, uniform member load equilibrium, stiffness symmetry, registries/contracts, load combinations, and browser delivery of 3D results.
''')

print('v0.26 integration patch applied')
