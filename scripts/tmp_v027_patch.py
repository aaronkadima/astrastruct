from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'anchor not found in {path}: {old[:140]!r}')
    p.write_text(s.replace(old,new,1))

# version
replace_once('web/src/core/version.js', "export const PRODUCT_VERSION = '0.26.0';", "export const PRODUCT_VERSION = '0.27.0';")

# registry
p=Path('web/src/core/solverRegistry.js'); s=p.read_text()
if "modal-3d" not in s:
    s += "\nregisterSolver({ id: 'modal-3d', analysisType: 'modal', dimensions: ['3d'], elementSets: ['truss3d','frame3d','mixed3d'], dynamic: true });\n"
p.write_text(s)

# fix small kernel expression
p=Path('web/src/solver/modalStability3d.js'); s=p.read_text()
s=s.replace("const rho=gamma/G0,total=rho*prep.properties?.A*prep.axes.L||rho*prep.A*prep.axes.L;", "const rho=gamma/G0;",1)
p.write_text(s)

# dispatcher
p=Path('web/src/solver/index.js'); s=p.read_text()
if "./modalStability3d.js" not in s:
    s=s.replace("import { solveSpatial3D } from './spatial3d.js';", "import { solveSpatial3D } from './spatial3d.js';\nimport { solveModal3D } from './modalStability3d.js';",1)
s=s.replace("  if(dimension==='3d'&&analysisType!=='linear')throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.26; use análise linear.`);", "  if(dimension==='3d'&&!['linear','modal'].includes(analysisType))throw new Error(`Análise ${analysisType} ainda não é suportada em 3D na v0.27; use análise linear ou modal.`);",1)
s=s.replace("    const result=solveModal2D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation});", "    const result=dimension==='3d'?solveModal3D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation}):solveModal2D(project,{modes:s.modalModes,massFormulation:s.dynamicMassFormulation});",1)
p.write_text(s)

# package
p=Path('package.json'); s=p.read_text()
s=s.replace('"version": "0.26.0"','"version": "0.27.0"',1)
s=s.replace('"test": "node tests/architecture-v0251-smoke.mjs', '"test": "node tests/architecture-v0251-smoke.mjs && node tests/modal-stability3d-v027-smoke.mjs && node tests/modal-stability3d-integration-v027-smoke.mjs',1)
s=s.replace('node --check web/src/solver/spatial3d.js"', 'node --check web/src/solver/spatial3d.js && node --check web/src/solver/modalStability3d.js"',1)
p.write_text(s)

# integration smoke
Path('tests/modal-stability3d-integration-v027-smoke.mjs').write_text(r'''import assert from 'node:assert/strict';
import { demoSpatialFrame } from '../web/src/core/model.js';
import { findSolver } from '../web/src/core/solverRegistry.js';
import { solve } from '../web/src/solver/index.js';
import { solveBuckling3D } from '../web/src/solver/modalStability3d.js';

const modal=demoSpatialFrame();modal.settings={...modal.settings,analysisType:'modal',modalModes:4,dynamicMassFormulation:'consistent'};
const def=findSolver({analysisType:'modal',dimension:'3d',elementSet:'frame3d'});assert.equal(def?.id,'modal-3d');
const r=solve(modal,'LC1');assert.equal(r.analysisType,'modal');assert.equal(r.dimension,'3d');assert.equal(r.contract.request.solverId,'modal-3d');assert.equal(r.contract.provenance.productVersion,'0.27.0');assert.ok(r.modes.length>=1);assert.ok(r.modes[0].frequencyHz>0);assert.ok('cumulativeMassRatioZ' in r.modes[0].participation);

const p=demoSpatialFrame();p.loads=[{id:'P',caseId:'LC1',nodeId:'N4',fz:-100}];
// The demo is not a pure column benchmark, but the direct buckling API must return a spatial result when compression exists.
const b=solveBuckling3D(p,'LC1',{modes:2});assert.equal(b.dimension,'3d');assert.ok(b.criticalFactor>0);assert.ok(b.modes[0].displacements[0] && 'uz' in b.modes[0].displacements[0]);
console.log('v0.27 3D modal/stability integration: OK',{f1:r.modes[0].frequencyHz,lambda1:b.criticalFactor});
''')

# Buckling panel integration
p=Path('app/src/BucklingPanel.tsx'); s=p.read_text()
s=s.replace("import { solveBuckling2D } from '../../web/src/solver/buckling2d.js';", "import { solveBuckling2D } from '../../web/src/solver/buckling2d.js';\n// @ts-ignore\nimport { solveBuckling3D } from '../../web/src/solver/modalStability3d.js';\n// @ts-ignore\nimport { inferProjectDimension } from '../../web/src/core/elementRegistry.js';",1)
s=s.replace("  const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])],existing=project.settings?.imperfection;", "  const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])],existing=project.settings?.imperfection,dimension=inferProjectDimension(project),is3D=dimension==='3d';",1)
s=s.replace("const r=solveBuckling2D(project,scenarioId,{modes:modeCount});", "const r=is3D?solveBuckling3D(project,scenarioId,{modes:modeCount}):solveBuckling2D(project,scenarioId,{modes:modeCount});",1)
s=s.replace("    if(!result?.modes?.[selected]){setError('Calcule a flambagem e selecione um modo antes de definir a imperfeição.');return}", "    if(is3D){setError('Imperfeição modal automática 3D será habilitada quando P‑Delta/co‑rotacional 3D estiverem validados.');return}\n    if(!result?.modes?.[selected]){setError('Calcule a flambagem e selecione um modo antes de definir a imperfeição.');return}",1)
s=s.replace("<header className=\"react-modal-head\"><div><h2>Estabilidade · flambagem linear</h2><p>Autovalores de bifurcação para pórticos 2D, usando os esforços axiais do cenário de referência.</p></div>", "<header className=\"react-modal-head\"><div><h2>Estabilidade · flambagem linear</h2><p>{is3D?'Autovalores espaciais para frame3d, com flexão nos dois planos principais e esforços axiais do cenário de referência.':'Autovalores de bifurcação para pórticos 2D, usando os esforços axiais do cenário de referência.'}</p></div>",1)
s=s.replace("<div className=\"panel-warning\">λcr multiplica o padrão de cargas de referência. Não é coeficiente de segurança nem verificação normativa. A flambagem v0.11 ainda aceita somente frame2d com extremidades rígidas; por isso a imperfeição modal co‑rotacional também requer extremidades rígidas nesta etapa.</div>", "<div className=\"panel-warning\">λcr multiplica o padrão de cargas de referência. Não é coeficiente de segurança nem verificação normativa. {is3D?'A v0.27 cobre flambagem linear de frame3d; não ativa automaticamente imperfeição, P‑Delta ou co‑rotacional 3D.':'A flambagem 2D v0.11 aceita frame2d com extremidades rígidas; a imperfeição modal segue esse escopo.'}</div>",1)
s=s.replace("<button data-testid=\"apply-imperfection\" className=\"primary\" onClick={()=>applyImperfection('pdelta')}>Usar no P‑Delta</button><button data-testid=\"apply-corotational-imperfection\" className=\"primary\" onClick={()=>applyImperfection('corotational')}>Usar no co‑rotacional</button>", "{!is3D&&<><button data-testid=\"apply-imperfection\" className=\"primary\" onClick={()=>applyImperfection('pdelta')}>Usar no P‑Delta</button><button data-testid=\"apply-corotational-imperfection\" className=\"primary\" onClick={()=>applyImperfection('corotational')}>Usar no co‑rotacional</button></>}",1)
s=s.replace("<div className=\"panel-note\"><b>P‑Delta:</b> usa carga geométrica equivalente, [K+Kg]Δu = F − Kg u₀. <b>Co‑rotacional:</b> usa xᵣ=x₀+u₀ como geometria de referência <b>sem tensões</b>; Newton calcula o incremento Δu a partir dessa referência. Ambos preservam u₀, Δu e u total separadamente.</div>", "<div className=\"panel-note\">{is3D?<><b>v0.27 3D:</b> Kφ = λcr(−Kg,ref)φ, com duas famílias de flexão espacial. A forma pode ser inspecionada, mas ainda não é transferida como imperfeição para uma análise não linear 3D.</>:<><b>P‑Delta:</b> usa carga geométrica equivalente, [K+Kg]Δu = F − Kg u₀. <b>Co‑rotacional:</b> usa xᵣ=x₀+u₀ como geometria de referência <b>sem tensões</b>.</>}</div>",1)
p.write_text(s)

# App: modal precedence and v0.27 Z participation
p=Path('app/src/App.tsx'); s=p.read_text()
s=s.replace("  if(result.dimension==='3d'){", "  if(result.dimension==='3d'&&result.analysisType!=='modal'){",1)
s=s.replace("<th>ΣMef,Y</th></tr></thead><tbody>{modes.map((x:any)=><tr key={x.mode}><td>{x.mode}</td><td>{Number(x.frequencyHz).toFixed(5)}</td><td>{Number(x.period).toFixed(5)}</td><td>{(100*Number(x.participation?.cumulativeMassRatioX||0)).toFixed(2)}%</td><td>{(100*Number(x.participation?.cumulativeMassRatioY||0)).toFixed(2)}%</td></tr>)}</tbody>", "<th>ΣMef,Y</th>{result.dimension==='3d'&&<th>ΣMef,Z</th>}</tr></thead><tbody>{modes.map((x:any)=><tr key={x.mode}><td>{x.mode}</td><td>{Number(x.frequencyHz).toFixed(5)}</td><td>{Number(x.period).toFixed(5)}</td><td>{(100*Number(x.participation?.cumulativeMassRatioX||0)).toFixed(2)}%</td><td>{(100*Number(x.participation?.cumulativeMassRatioY||0)).toFixed(2)}%</td>{result.dimension==='3d'&&<td>{(100*Number(x.participation?.cumulativeMassRatioZ||0)).toFixed(2)}%</td>}</tr>)}</tbody>",1)
s=s.replace("<strong>AstraStruct</strong><small>v0.25.1 · schema/migration core</small>", "<strong>AstraStruct</strong><small>v0.27 · modal + estabilidade 3D</small>",1)
p.write_text(s)

# Dynamics postprocess: make modal 3D explicit without altering 2D behavior.
p=Path('app/src/DynamicsPostprocessPanel.tsx'); s=p.read_text()
s=s.replace("<header className=\"react-modal-head\"><div><h2>Dinâmica estrutural · v0.25</h2><p>Modal, história temporal, excitação sísmica de base e espectro de resposta linear-elástico.</p></div>", "<header className=\"react-modal-head\"><div><h2>Dinâmica estrutural · {result?.dimension==='3d'?'v0.27':'v0.25'}</h2><p>{result?.dimension==='3d'?'Análise modal espacial linear-elástica com 6 DOFs por nó.':'Modal, história temporal, excitação sísmica de base e espectro de resposta linear-elástico.'}</p></div>",1)
s=s.replace("<th>Mef,Y</th><th>ΣMef,Y</th></tr></thead><tbody>{modes.map((m:any)=><tr key={m.mode}><td>{m.mode}</td><td>{fmt(m.frequencyHz,5)}</td><td>{fmt(m.period,5)}</td><td>{fmt(m.omega,4)}</td><td>{fmt(100*num(m.participation?.effectiveMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.effectiveMassRatioY),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioY),2)}%</td></tr>)}</tbody>", "<th>Mef,Y</th><th>ΣMef,Y</th>{result?.dimension==='3d'&&<><th>Mef,Z</th><th>ΣMef,Z</th></>}</tr></thead><tbody>{modes.map((m:any)=><tr key={m.mode}><td>{m.mode}</td><td>{fmt(m.frequencyHz,5)}</td><td>{fmt(m.period,5)}</td><td>{fmt(m.omega,4)}</td><td>{fmt(100*num(m.participation?.effectiveMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.effectiveMassRatioY),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioY),2)}%</td>{result?.dimension==='3d'&&<><td>{fmt(100*num(m.participation?.effectiveMassRatioZ),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioZ),2)}%</td></>}</tr>)}</tbody>",1)
s=s.replace("<section className=\"react-card\"><h3>Limitações v0.25</h3><p>Formulação linear-elástica em frame2d/truss2d", "<section className=\"react-card\"><h3>Limitações {result?.dimension==='3d'?'v0.27':'v0.25'}</h3><p>{result?.dimension==='3d'?'A v0.27 habilita apenas análise modal 3D linear-elástica em frame3d/truss3d. História temporal, espectro de resposta, P‑Delta, co‑rotacional e plasticidade 3D permanecem fora deste escopo.':'Formulação linear-elástica em frame2d/truss2d",1)
s=s.replace("A opção 100/30 é um envelope direcional genérico e não constitui verificação normativa automática.</p></section>", "A opção 100/30 é um envelope direcional genérico e não constitui verificação normativa automática.'}</p></section>",1)
p.write_text(s)

# docs + README
Path('docs/modal-stability3d-v027.md').write_text(r'''# AstraStruct v0.27 — Modal + Estabilidade 3D

## Modal 3D
O modelo espacial usa seis DOFs por nó. Para `frame3d`, a massa consistente inclui translação axial e as duas matrizes de massa de flexão de Euler–Bernoulli, além de inércia rotacional torsional baseada em `Ip ≈ Iy + Iz` quando `Ip` não é fornecido. Para `truss3d`, a massa consistente atua nas três translações globais. `material.density` permanece como peso específico [kN/m³], convertido em densidade de massa por `rho = gamma/g`.

O problema generalizado é `K phi = omega² M phi`, resolvido por transformação de Cholesky e decomposição simétrica de Jacobi. Os modos são normalizados por massa e também fornecem vetores normalizados para visualização. A participação modal é calculada separadamente em X, Y e Z.

## Flambagem linear 3D
A análise de estabilidade usa o estado linear espacial do cenário de referência para recuperar o esforço normal `N` de cada `frame3d`. Com a convenção AstraStruct `N > 0` em tração, a compressão negativa reduz a rigidez geométrica. O problema é `K phi = lambda_cr (-Kg,ref) phi`, incluindo matrizes geométricas nos dois planos principais de flexão.

## Escopo protegido
A flambagem v0.27 aceita apenas `frame3d`. A análise modal aceita `frame3d`, `truss3d` e modelos mistos. Ainda não são suportados em 3D: P-Delta iterativo, co-rotacional, imperfeição modal aplicada automaticamente, história temporal, espectro de resposta, plasticidade, releases/offsets espaciais, Timoshenko, warping ou shells/solids.

## Validação
Os testes permanentes incluem: autovalor axial analítico de barra espacial para massas consistente e concentrada; pórtico/cantilever espacial com participação X/Y/Z; simetria das matrizes de massa e geométrica; coluna biapoiada discretizada comparada com `Pcr = pi² EI/L²` nos dois eixos principais; integração com `SolverRegistry`, contratos e dispatcher.
''')
p=Path('README.md'); s=p.read_text(); intro="""## AstraStruct v0.27 — modal + estabilidade 3D\n\nA v0.27 amplia a fundação espacial com análise modal linear (`Kφ=ω²Mφ`) e flambagem linear 3D (`Kφ=λcr(-Kg)φ`) em dois planos de flexão. A participação modal é reportada em X/Y/Z. O escopo não linear/dinâmico transitório 3D continua protegido. Veja `docs/modal-stability3d-v027.md`.\n\n"""; p.write_text(intro+s if not s.startswith('## AstraStruct v0.27') else s)

# E2E: use injected modal 3D project and exercise generic analyze/result path.
Path('tests/e2e/modal3d-v027.spec.ts').write_text(r'''import { test, expect } from '@playwright/test';

test('v0.27 executes modal analysis for a spatial frame',async({page})=>{
 const p={id:'modal3d',name:'Modal 3D',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:3,y:1,z:1}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.012,Iy:7e-5,Iz:9e-5,J:2e-5,orientation:{up:[0,0,1]}}],materials:[{id:'S',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A:.012,Iy:7e-5,Iz:9e-5,J:2e-5,I:9e-5}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1'}],loadCombinations:[],connections:[],settings:{analysisType:'modal',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',modalModes:4,dynamicMassFormulation:'consistent',grid:.25,snap:true},meta:{}};
 await page.addInitScript(x=>localStorage.setItem('astrastruct.project',JSON.stringify(x)),p);await page.goto('./');await page.getByTestId('analyze-button').click();const r=page.getByTestId('dynamic-results-modal');await expect(r).toBeVisible();await expect(r).toContainText('dynamic-modal3d');await expect(r).toContainText('ΣMef,Z');
});
''')
print('v0.27 integration patch applied')
