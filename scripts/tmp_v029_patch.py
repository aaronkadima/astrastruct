from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(s.replace(old,new,1))

replace_once('package.json','"version": "0.28.0"','"version": "0.29.0"')
replace_once('package.json','"test": "node tests/pdelta3d-v028-smoke.mjs','"test": "node tests/corotational3d-v029-smoke.mjs && node tests/pdelta3d-v028-smoke.mjs')
replace_once('package.json','node --check web/src/solver/corotational2d.js && node --check web/src/solver/stabilityMultimode2d.js','node --check web/src/solver/corotational2d.js && node --check web/src/solver/corotational3d.js && node --check web/src/solver/stabilityMultimode2d.js')
replace_once('web/src/core/version.js',"export const PRODUCT_VERSION = '0.28.0';","export const PRODUCT_VERSION = '0.29.0';")

replace_once(
    'web/src/core/solverRegistry.js',
    "registerSolver({ id: 'pdelta-frame3d', analysisType: 'pdelta', dimensions: ['3d'], elementSets: ['frame3d'], nonlinear: true });\n\nregisterSolver({ id: 'modal-3d'",
    "registerSolver({ id: 'pdelta-frame3d', analysisType: 'pdelta', dimensions: ['3d'], elementSets: ['frame3d'], nonlinear: true });\nregisterSolver({ id: 'corotational-frame3d', analysisType: 'corotational', dimensions: ['3d'], elementSets: ['frame3d'], nonlinear: true, experimental: true });\n\nregisterSolver({ id: 'modal-3d'"
)

replace_once(
    'web/src/solver/index.js',
    "import { solveFramePDelta3D } from './pdelta3d.js';\nimport { solveModal3D } from './modalStability3d.js';",
    "import { solveFramePDelta3D } from './pdelta3d.js';\nimport { solveFrameCorotational3D } from './corotational3d.js';\nimport { solveModal3D } from './modalStability3d.js';"
)
replace_once(
    'web/src/solver/index.js',
    "if(dimension==='3d'&&!['linear','modal','pdelta'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.28; use análise linear, modal ou P-Delta.`);",
    "if(dimension==='3d'&&!['linear','modal','pdelta','corotational'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.29; use análise linear, modal, P-Delta ou co-rotacional.`);"
)
old_prefix="    const initialImperfection=buildModalImperfection(project,scenarioId),controlMode=s.nonlinearControlMode==='arc-length'?'arc-length':(s.nonlinearControlMode==='displacement'?'displacement':'load'),options={"
new_prefix="    const controlMode=s.nonlinearControlMode==='arc-length'?'arc-length':(s.nonlinearControlMode==='displacement'?'displacement':'load');\n    if(dimension==='3d'){\n      if(fiberHinges.length)throw new Error('Co-rotacional 3D v0.29 é elástico; rótulas de fibras ainda não são suportadas.');\n      if(controlMode!=='load')throw new Error('Co-rotacional 3D v0.29 suporta somente controle por carga; controle por deslocamento e Arc-Length permanecem 2D.');\n      const result=solveFrameCorotational3D(project,scenarioId,{steps:s.nonlinearSteps,maxIterations:s.nonlinearMaxIterations,tolerance:s.nonlinearTolerance,lineSearch:s.nonlinearLineSearch});\n      return{...result,analysisType:'corotational',solverVersion:result.solverVersion||'0.29.0-exp'};\n    }\n    const initialImperfection=buildModalImperfection(project,scenarioId),options={"
replace_once('web/src/solver/index.js',old_prefix,new_prefix)

replace_once(
    'README.md',
    '## AstraStruct v0.28 — P-Delta espacial 3D',
    '## AstraStruct v0.29 — co-rotacional espacial 3D experimental\n\nA v0.29 introduz grandes deslocamentos e rotações rígidas para pórticos `frame3d`, com triedro co-rotacional transportado, rotações relativas por Rodrigues/log SO(3), Newton-Raphson incremental e tangente numérica consistente. O escopo é elástico e deliberadamente protegido: `frame3d` puro, controle por carga e cargas nodais/uniformes de referência. Veja `docs/corotational3d-v029.md`.\n\n## AstraStruct v0.28 — P-Delta espacial 3D'
)
replace_once(
    'README.md',
    '> **Estado atual — v0.28 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.',
    '> **Estado atual — v0.29 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.'
)

# UI metadata and 3D result note must track the active solver generation.
replace_once('app/src/App.tsx','<small>v0.27 · modal + estabilidade 3D</small>','<small>v0.29 · co-rotacional 3D</small>')
replace_once(
    'app/src/App.tsx',
    '<div className="panel-note">Fundação 3D linear v0.26 com visualização espacial interativa v0.26.1. Use o Canvas 3D para orbitar, inspecionar a deformada e mapear N/V/M/T.</div>',
    '<div className="panel-note">{result.analysisType===\'corotational\'?\'Co-rotacional 3D experimental v0.29: grandes deslocamentos/rotações com recuperação N/V/M/T na configuração corrente.\':result.analysisType===\'pdelta\'?\'P-Delta espacial 3D v0.28: segunda ordem elástica com rigidez geométrica biaxial.\':\'Fundação 3D linear v0.26 com visualização espacial interativa v0.26.1.\'} Use o Canvas 3D para orbitar, inspecionar a deformada e mapear N/V/M/T.</div>'
)

# Mobile 3D UX: keep Stability reachable and result controls above the floating results drawer.
css=Path('app/src/styles.css')
s=css.read_text()
mobile_fix='\n@media(max-width:760px){.top-actions .icon-btn[aria-label="Estabilidade"]{display:grid!important}.spatial3d-result-controls{z-index:45}}\n'
if mobile_fix.strip() not in s:
    css.write_text(s+mobile_fix)

print('v0.29 integration patch applied')
