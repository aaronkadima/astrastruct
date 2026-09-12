from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

# Product/package version and test/check gates.
replace_once('package.json', '"version": "0.27.0"', '"version": "0.28.0"')
replace_once(
    'package.json',
    '"test": "node tests/architecture-v0251-smoke.mjs',
    '"test": "node tests/pdelta3d-v028-smoke.mjs && node tests/architecture-v0251-smoke.mjs'
)
replace_once(
    'package.json',
    'node --check web/src/solver/mixed2d.js && node --check web/src/solver/spatial3d.js',
    'node --check web/src/solver/mixed2d.js && node --check web/src/solver/pdelta3d.js && node --check web/src/solver/spatial3d.js'
)
replace_once('web/src/core/version.js', "export const PRODUCT_VERSION = '0.27.0';", "export const PRODUCT_VERSION = '0.28.0';")

# Solver registry.
replace_once(
    'web/src/core/solverRegistry.js',
    "registerSolver({ id: 'linear-mixed3d', analysisType: 'linear', dimensions: ['3d'], elementSets: ['mixed3d'] });\n\nregisterSolver({ id: 'modal-3d'",
    "registerSolver({ id: 'linear-mixed3d', analysisType: 'linear', dimensions: ['3d'], elementSets: ['mixed3d'] });\nregisterSolver({ id: 'pdelta-frame3d', analysisType: 'pdelta', dimensions: ['3d'], elementSets: ['frame3d'], nonlinear: true });\n\nregisterSolver({ id: 'modal-3d'"
)

# Main dispatcher integration.
replace_once(
    'web/src/solver/index.js',
    "import { solveSpatial3D } from './spatial3d.js';\nimport { solveModal3D } from './modalStability3d.js';",
    "import { solveSpatial3D } from './spatial3d.js';\nimport { solveFramePDelta3D } from './pdelta3d.js';\nimport { solveModal3D } from './modalStability3d.js';"
)
replace_once(
    'web/src/solver/index.js',
    "  if (resolvedProject.settings?.analysisType === 'pdelta') {\n    const initialImperfection=buildModalImperfection(sourceProject,scenarioId);\n    return solveFramePDelta2D(resolvedProject,{initialImperfection});\n  }",
    "  if (resolvedProject.settings?.analysisType === 'pdelta') {\n    if(inferProjectDimension(resolvedProject)==='3d') return solveFramePDelta3D(resolvedProject);\n    const initialImperfection=buildModalImperfection(sourceProject,scenarioId);\n    return solveFramePDelta2D(resolvedProject,{initialImperfection});\n  }"
)
replace_once(
    'web/src/solver/index.js',
    "  if(dimension==='3d'&&!['linear','modal'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.27; use análise linear ou modal.`);",
    "  if(dimension==='3d'&&!['linear','modal','pdelta'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.28; use análise linear, modal ou P-Delta.`);"
)
replace_once(
    'web/src/solver/index.js',
    "  if(result.dimension==='3d')return{...result,scenario:resolved.scenario,analysisType:'linear',solverVersion:result.solverVersion||'0.26.0'};",
    "  if(result.dimension==='3d')return{...result,scenario:resolved.scenario,analysisType:result.analysisType||analysisType,solverVersion:result.solverVersion||(analysisType==='pdelta'?'0.28.0':'0.26.0')};"
)

# README release header and current-state marker.
replace_once(
    'README.md',
    '## AstraStruct v0.27 — modal + estabilidade 3D',
    '## AstraStruct v0.28 — P-Delta espacial 3D\n\nA v0.28 acrescenta análise de segunda ordem elástica para pórticos `frame3d`, com iteração do esforço normal e matriz geométrica consistente nos dois planos de flexão. O escopo permanece deliberadamente limitado a `frame3d` puro; imperfeição modal, plasticidade e co-rotacional 3D ficam para etapas posteriores. Veja `docs/pdelta3d-v028.md`.\n\n## AstraStruct v0.27 — modal + estabilidade 3D'
)
replace_once(
    'README.md',
    '> **Estado atual — v0.26.1 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.',
    '> **Estado atual — v0.28 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.'
)

print('v0.28 integration patch applied')
