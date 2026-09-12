from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'anchor not found in {path}: {old[:180]!r}')
    p.write_text(s.replace(old,new,1))

# Version and package gates.
replace_once('web/src/core/version.js', "export const PRODUCT_VERSION = '0.26.0';", "export const PRODUCT_VERSION = '0.26.1';")
p=Path('package.json');s=p.read_text();s=s.replace('"version": "0.26.0"','"version": "0.26.1"',1)
s=s.replace('"test": "node tests/architecture-v0251-smoke.mjs', '"test": "node tests/architecture-v0251-smoke.mjs && node tests/spatial-canvas3d-v0261-smoke.mjs',1)
s=s.replace('node --check web/src/solver/spatial3d.js"', 'node --check web/src/solver/spatial3d.js && node --check web/src/view/spatialView3d.js"',1)
p.write_text(s)

# App integration: switch automatically between 2D editor and 3D viewport.
p=Path('app/src/App.tsx');s=p.read_text()
s=s.replace("import { ModelingCanvas, type ModelTool, type Selection } from './ModelingCanvas';", "import { ModelingCanvas, type ModelTool, type Selection } from './ModelingCanvas';\nimport { SpatialCanvas3D } from './SpatialCanvas3D';\n// @ts-ignore\nimport { inferProjectDimension } from '../../web/src/core/elementRegistry.js';",1)
s=s.replace("const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])];const activeScenario=project.settings?.analysisScenarioId||project.loadCases?.[0]?.id;", "const scenarios=[...(project.loadCases||[]),...(project.loadCombinations||[])];const projectDimension=inferProjectDimension(project);const activeScenario=project.settings?.analysisScenarioId||project.loadCases?.[0]?.id;",1)
s=s.replace("<strong>AstraStruct</strong><small>v0.25.1 · schema/migration core</small>", "<strong>AstraStruct</strong><small>v0.26.1 · Canvas 3D</small>",1)
s=s.replace("<b>Pórtico espacial 3D</b><small>v0.26 · projeção XY</small>", "<b>Pórtico espacial 3D</b><small>v0.26.1 · Canvas 3D</small>",1)
s=s.replace("<div className=\"panel-note\">Fundação 3D linear v0.26. O canvas atual é uma projeção XY; os resultados abaixo são espaciais completos.</div>", "<div className=\"panel-note\">Fundação 3D linear v0.26 com visualização espacial interativa v0.26.1. Use o Canvas 3D para orbitar, inspecionar a deformada e mapear N/V/M/T.</div>",1)
old='<div className="viewport"><ModelingCanvas project={project} result={result} bucklingView={bucklingView} onClearBuckling={()=>setBucklingView(null)} tool={tool} selection={selection} onSelection={setSelection} onCommit={commitProject}/></div>'
new='<div className="viewport">{projectDimension===\'3d\'?<SpatialCanvas3D project={project} result={result} bucklingView={bucklingView} selection={selection} onSelection={setSelection}/>:<ModelingCanvas project={project} result={result} bucklingView={bucklingView} onClearBuckling={()=>setBucklingView(null)} tool={tool} selection={selection} onSelection={setSelection} onCommit={commitProject}/>}</div>'
if old not in s: raise SystemExit('viewport anchor not found')
s=s.replace(old,new,1)
old_status="<div className=\"workspace-status\"><span className=\"status-dot\"></span>{tool==='select'?'Seleção':tool==='node'?'Criar nó':tool==='frame2d'?'Pórtico 2D':'Treliça 2D'}</div>"
new_status="<div className=\"workspace-status\"><span className=\"status-dot\"></span>{projectDimension==='3d'?'Canvas 3D':tool==='select'?'Seleção':tool==='node'?'Criar nó':tool==='frame2d'?'Pórtico 2D':'Treliça 2D'}</div>"
s=s.replace(old_status,new_status,1)
old_tools="{tools.map(([t,icon,label])=><IconButton key={t} icon={icon} label={label} active={tool===t} onClick={()=>setTool(t)}/>) }<span className=\"tool-sep\"/>"
new_tools="{projectDimension==='2d'?tools.map(([t,icon,label])=><IconButton key={t} icon={icon} label={label} active={tool===t} onClick={()=>setTool(t)}/>):<span className=\"spatial3d-mode-label\">Canvas 3D · visualização</span>}<span className=\"tool-sep\"/>"
s=s.replace(old_tools,new_tools,1)
p.write_text(s)

# Canvas styles, including compact responsive controls.
p=Path('app/src/styles.css');s=p.read_text()
css=r'''
.spatial3d-shell{position:absolute;inset:0;overflow:hidden;background:#0c121a;touch-action:none}.spatial3d-canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}.spatial3d-canvas:active{cursor:grabbing}.spatial3d-toolbar{position:absolute;left:10px;top:10px;display:flex;gap:7px;flex-wrap:wrap;pointer-events:auto}.spatial3d-group{display:flex;gap:3px;padding:4px;background:rgba(13,19,28,.88);border:1px solid var(--line);border-radius:9px;backdrop-filter:blur(7px)}.spatial3d-toolbar button,.spatial3d-result-controls button{min-height:30px;border:1px solid transparent;border-radius:6px;padding:4px 8px;background:#151f2b;color:#c7d4e6;font-size:10px;cursor:pointer}.spatial3d-toolbar button:hover,.spatial3d-toolbar button.active,.spatial3d-result-controls button.active{border-color:var(--accent);color:#dceaff;background:#19304d}.spatial3d-options{position:absolute;right:10px;top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:min(630px,62%);padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:rgba(13,19,28,.88);backdrop-filter:blur(7px);font-size:9px;color:#aebdd0}.spatial3d-options label{display:flex;align-items:center;gap:4px;white-space:nowrap}.spatial3d-options input{accent-color:var(--accent)}.spatial3d-options select,.spatial3d-result-controls select{height:27px;background:#101822;color:#d6e1ef;border:1px solid var(--line);border-radius:5px;font-size:9px}.spatial3d-result-controls{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(13,19,28,.91);border:1px solid var(--line);border-radius:9px;color:#bdcce0;font-size:9px;white-space:nowrap}.spatial3d-result-controls label{display:flex;align-items:center;gap:5px}.spatial3d-result-controls input[type=range]{width:110px}.spatial3d-help{position:absolute;left:10px;bottom:10px;display:grid;gap:2px;padding:7px 9px;border:1px solid rgba(42,54,72,.8);border-radius:8px;background:rgba(10,16,24,.78);font-size:9px;color:#8fa0b7;pointer-events:none}.spatial3d-help b{color:#d1dbea;font-size:10px}.spatial3d-mode-label{display:inline-flex;align-items:center;height:32px;padding:0 9px;border:1px solid var(--line);border-radius:8px;color:#9fc7ff;background:#14243a;font-size:10px;font-weight:700}
@media(max-width:760px){.spatial3d-toolbar{left:6px;top:6px;max-width:72%}.spatial3d-group{padding:3px}.spatial3d-toolbar button{min-height:32px;padding:4px 7px}.spatial3d-options{right:6px;top:82px;max-width:94%;max-height:86px;overflow:auto;justify-content:flex-start}.spatial3d-help{left:6px;bottom:6px}.spatial3d-help span:first-of-type{display:none}.spatial3d-result-controls{bottom:6px;max-width:92%;overflow-x:auto;justify-content:flex-start}.spatial3d-result-controls input[type=range]{width:78px}}
'''
if '.spatial3d-shell{' not in s:s+='\n'+css
p.write_text(s)

# README status and v0.26.1 section.
p=Path('README.md');s=p.read_text()
intro="""## AstraStruct v0.26.1 — Canvas 3D espacial\n\nA v0.26.1 substitui a projeção XY temporária do núcleo 3D por um Canvas 3D interativo com câmera orbital, perspectiva/ortográfica, vistas ISO/XY/XZ/YZ, cargas, apoios, eixos locais, deformada espacial e mapas N/V/M/T. O contrato visual também está preparado para animar formas modais e de flambagem 3D quando esses solvers forem integrados. Veja `docs/canvas3d-v0261.md`.\n\n"""
if not s.startswith('## AstraStruct v0.26.1'):s=intro+s
s=s.replace('> **Estado atual — v0.25.1 experimental:**','> **Estado atual — v0.26.1 experimental:**',1)
p.write_text(s)

# Remove an intentionally harmless compatibility typo from the E2E source if present.
p=Path('tests/e2e/spatial-canvas3d-v0261.spec.ts');s=p.read_text();s=s.replace("  await page.addInitScript(p=>localStorage.setItem('astrasuct.project',JSON.stringify(p)),project).catch(()=>{});\n",'');p.write_text(s)
print('v0.26.1 Canvas 3D integration patch applied')
