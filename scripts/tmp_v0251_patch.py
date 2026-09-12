from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'anchor not found in {path}: {old[:100]!r}')
    p.write_text(s.replace(old,new,1))

# model.js: schema/migration/analysis synchronization without breaking legacy settings.
p=Path('web/src/core/model.js'); s=p.read_text()
if "./migrations.js" not in s:
    s="import { migrateProject } from './migrations.js';\nimport { analysisConfigFromSettings } from './analysisConfig.js';\nimport { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION, productMetadata } from './version.js';\n\n"+s
s=s.replace("id: uid('project'), name: 'Novo projeto', version: 13, units: 'kN-m-MPa',","id: uid('project'), name: 'Novo projeto', version: 13, schemaVersion: PROJECT_SCHEMA_VERSION, units: 'kN-m-MPa',",1)
s=s.replace("meta: { solverVersion: '0.13.6-exp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }","meta: { solverVersion: PRODUCT_VERSION, productVersion: PRODUCT_VERSION, schemaVersion: PROJECT_SCHEMA_VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }",1)
s=s.replace("const base = emptyProject(), p = { ...base, ...(input || {}) };","const base = emptyProject(), p = { ...base, ...migrateProject(input || {}) };",1)
s=s.replace("p.meta = { ...base.meta, ...(p.meta || {}), solverVersion: '0.13.6-exp' };\n  p.version = 13;","p.analysis = analysisConfigFromSettings(p.settings);\n  p.schemaVersion = PROJECT_SCHEMA_VERSION;\n  p.meta = productMetadata({ ...base.meta, ...(p.meta || {}), solverVersion: PRODUCT_VERSION, updatedAt: new Date().toISOString() });\n  p.version = 13; // legacy compatibility marker; schemaVersion is authoritative.\n",1)
p.write_text(s)

# solver dispatcher: use registries for linear selection and attach stable result contract around every path.
p=Path('web/src/solver/index.js'); s=p.read_text()
if "../core/elementRegistry.js" not in s:
    s=s.replace("import { buildElementResponses } from './postprocess.js';", "import { buildElementResponses } from './postprocess.js';\nimport { classifyElementSet } from '../core/elementRegistry.js';\nimport { attachResultContract } from '../core/contracts.js';",1)
old="""function solveLinearModel(project) {\n  const types = new Set((project.elements || []).map(e => e.type));\n  if (types.size === 1 && types.has('truss2d')) return solveTruss2D(project);\n  if (types.size === 1 && types.has('frame2d')) return solveFrame2D(project);\n  if ([...types].every(t => t === 'frame2d' || t === 'truss2d')) return solveMixed2D(project);\n  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${[...types].join(', ')}`);\n}\n"""
new="""function solveLinearModel(project) {\n  const elementSet = classifyElementSet(project);\n  if (elementSet === 'truss2d') return solveTruss2D(project);\n  if (elementSet === 'frame2d') return solveFrame2D(project);\n  if (elementSet === 'mixed2d') return solveMixed2D(project);\n  const types = [...new Set((project.elements || []).map(e => e.type))];\n  throw new Error(`Tipos de elementos ainda não suportados pelo solver: ${types.join(', ') || 'modelo vazio'}`);\n}\n"""
if old not in s: raise SystemExit('linear solver block anchor not found')
s=s.replace(old,new,1)
s=s.replace("export function solve(project, scenarioId) {","function solveRaw(project, scenarioId) {",1)
if "attachResultContract(project, scenarioId, solveRaw" not in s:
    s += "\n\nexport function solve(project, scenarioId) {\n  return attachResultContract(project, scenarioId, solveRaw(project, scenarioId));\n}\n"
p.write_text(s)

# App: every UI commit/import is normalized, keeping settings and grouped AnalysisConfig synchronized.
replace_once('app/src/App.tsx',
"const commitProject=(next:any,record=true)=>{store.commit(next,{record});setResult(null);setBucklingView(null)};",
"const commitProject=(next:any,record=true)=>{store.commit(normalizeProject(next),{record});setResult(null);setBucklingView(null)};")
replace_once('app/src/App.tsx', 'React/Vite · modeling migration', 'v0.25.1 · schema/migration core')

# Package/version and permanent checks.
p=Path('package.json'); s=p.read_text()
s=s.replace('"version": "1.0.0-alpha.1"','"version": "0.25.1"',1)
s=s.replace('"test": "node tests/solver-smoke.mjs', '"test": "node tests/architecture-v0251-smoke.mjs && node tests/solver-smoke.mjs',1)
s=s.replace('"check": "tsc -p tsconfig.json --noEmit && ', '"check": "tsc -p tsconfig.json --noEmit && node --check web/src/core/version.js && node --check web/src/core/analysisConfig.js && node --check web/src/core/elementRegistry.js && node --check web/src/core/solverRegistry.js && node --check web/src/core/ruleEngine.js && node --check web/src/core/migrations.js && node --check web/src/core/contracts.js && ',1)
p.write_text(s)

# README: current architecture/version, leaving historical method sections intact.
p=Path('README.md'); s=p.read_text()
intro="""## AstraStruct v0.25.1 — consolidação arquitetural\n\nA v0.25.1 consolida schema/migrations, `AnalysisConfig`, `ElementRegistry`, `SolverRegistry`, contratos de análise/resultados e a interface do futuro `RuleEngine`. Não acrescenta novos métodos numéricos; o objetivo é preparar Frame 3D, shells, componentes e regras normativas sem ampliar o acoplamento do núcleo 2D. Veja `docs/architecture-v0251.md`.\n\n"""
if not s.startswith('## AstraStruct v0.25.1'):
    s=intro+s
s=s.replace('> **Estado atual — v0.24.0 experimental:**','> **Estado atual — v0.25.1 experimental:**',1)
s=s.replace('> **v0.24 experimental:** dinâmica estrutural linear com análise modal, Newmark-β/Rayleigh, aceleração sísmica uniforme de base, pseudo-espectros Sa/Sv/Sd e combinação modal SRSS/CQC.', '> **Linha dinâmica v0.23–v0.25:** análise modal, Newmark-β/Rayleigh, aceleração uniforme de base, pseudo-espectros Sa/Sv/Sd, SRSS/CQC e pré-processamento X+Y.',1)
p.write_text(s)

print('v0.25.1 patch applied')

# validation-trigger: 2026-09-12
