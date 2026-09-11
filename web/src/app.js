import {
  emptyProject, normalizeProject, demoFrame, demoTruss, demoBeamUDL, demoMixed,
  uid, makeFrameElement, makeTrussElement
} from './core/model.js';
import { solve } from './solver/index.js';
import { checkDisplacement } from './rules/ruleEngine.js';
import { validateProject } from './core/validate.js';
import { VNL_BLOCKS, defaultGraph, validateGraph } from './vnl/graph.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'astrastruct.project';
const VIEW = { w: 900, h: 600, p: 80 };

let project = normalizeProject(loadProject() || demoFrame());
let selected = null;
let tool = 'select';
let bottomTab = 'results';
let vnl = defaultGraph();
let draft = null;
let undoStack = [];
let redoStack = [];
let deformationScale = project.settings?.deformationScale || 1;

const LIB = [
  { name: 'Viga RC', group: 'Concreto armado', type: 'frame2d', materialId: 'concrete30', sectionId: 'rc_30x50' },
  { name: 'Pilar RC', group: 'Concreto armado', type: 'frame2d', materialId: 'concrete30', sectionId: 'rc_30x60' },
  { name: 'Tirante / biela', group: 'Concreto armado', type: 'truss2d', materialId: 'steel355', sectionId: 'truss_generic' },
  { name: 'Viga de aço', group: 'Aço', type: 'frame2d', materialId: 'steel355', sectionId: 'steel_generic' },
  { name: 'Coluna de aço', group: 'Aço', type: 'frame2d', materialId: 'steel355', sectionId: 'steel_generic' },
  { name: 'Contraventamento', group: 'Aço', type: 'truss2d', materialId: 'steel355', sectionId: 'truss_generic' },
  { name: 'Laje / shell', group: 'Roadmap', roadmap: true },
  { name: 'Parede / shell', group: 'Roadmap', roadmap: true },
  { name: 'Chumbador / ancoragem', group: 'Roadmap', roadmap: true },
  { name: 'Ligação parafusada', group: 'Roadmap', roadmap: true },
  { name: 'Placa de base', group: 'Roadmap', roadmap: true },
  { name: 'Contato', group: 'Roadmap', roadmap: true }
];

function loadProject() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
}

function saveProject() {
  project.meta = { ...(project.meta || {}), updatedAt: new Date().toISOString(), solverVersion: '0.2.0' };
  project.settings = { ...(project.settings || {}), deformationScale };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

function snapshot() { return JSON.stringify(project); }

function remember() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function mutate(fn, { keepResults = false } = {}) {
  remember();
  fn();
  if (!keepResults) project.results = null;
  saveProject();
  render();
}

function replaceProject(next) {
  remember();
  project = normalizeProject(next);
  selected = null;
  draft = null;
  deformationScale = project.settings?.deformationScale || 1;
  saveProject();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  project = normalizeProject(JSON.parse(undoStack.pop()));
  selected = null;
  draft = null;
  deformationScale = project.settings?.deformationScale || 1;
  saveProject();
  render();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  project = normalizeProject(JSON.parse(redoStack.pop()));
  selected = null;
  draft = null;
  deformationScale = project.settings?.deformationScale || 1;
  saveProject();
  render();
}

function scaleInfo() {
  if (!project.nodes.length) return { minX: 0, minY: 0, maxX: 10, maxY: 8 };
  const xs = project.nodes.map(n => n.x), ys = project.nodes.map(n => n.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function viewScale() {
  const b = scaleInfo();
  const dx = Math.max(4, b.maxX - b.minX), dy = Math.max(3, b.maxY - b.minY);
  return Math.min((VIEW.w - 2 * VIEW.p) / dx, (VIEW.h - 2 * VIEW.p) / dy);
}

function worldToSvg(x, y) {
  const b = scaleInfo(), s = viewScale();
  return [VIEW.p + (x - b.minX) * s, VIEW.h - VIEW.p - (y - b.minY) * s];
}

function svgToWorld(x, y, rect) {
  const sx = VIEW.w / rect.width, sy = VIEW.h / rect.height;
  const X = x * sx, Y = y * sy, b = scaleInfo(), s = viewScale();
  return [(X - VIEW.p) / s + b.minX, (VIEW.h - VIEW.p - Y) / s + b.minY];
}

function snapValue(v) {
  const g = project.settings?.grid || 0.25;
  return project.settings?.snap === false ? v : Math.round(v / g) * g;
}

function eventWorld(e, svg) {
  const r = svg.getBoundingClientRect();
  const [x, y] = svgToWorld(e.clientX - r.left, e.clientY - r.top, r);
  return [snapValue(x), snapValue(y)];
}

function nodeById(id) { return project.nodes.find(n => n.id === id); }
function elementById(id) { return project.elements.find(e => e.id === id); }
function supportAt(id) { return project.supports.find(s => s.nodeId === id); }
function nodalLoadAt(id) { return project.loads.find(l => l.nodeId === id); }
function elementLoadAt(id) { return project.elementLoads.find(l => l.elementId === id && l.kind === 'uniform'); }

function nearNode(x, y, tolerance = 0.26) {
  return project.nodes.find(n => Math.hypot(n.x - x, n.y - y) <= tolerance);
}

function nextNodeId() {
  let i = 1;
  while (project.nodes.some(n => n.id === `N${i}`)) i++;
  return `N${i}`;
}

function addNodeRaw(x, y) {
  const n = { id: nextNodeId(), x: +snapValue(x).toFixed(4), y: +snapValue(y).toFixed(4) };
  project.nodes.push(n);
  return n;
}

function makeElementFromTemplate(template, n1, n2) {
  if (template.type === 'truss2d') {
    return makeTrussElement({ n1, n2, materialId: template.materialId || 'steel355', sectionId: template.sectionId || 'truss_generic', label: template.name || 'Treliça 2D' });
  }
  const section = project.sections.find(s => s.id === (template.sectionId || 'rc_30x50'));
  return makeFrameElement({
    n1, n2,
    materialId: template.materialId || 'concrete30',
    sectionId: template.sectionId || 'rc_30x50',
    A: section?.A,
    I: section?.I,
    label: template.name || 'Pórtico 2D'
  });
}

function defaultTemplate(type) {
  return type === 'truss2d'
    ? LIB.find(x => x.type === 'truss2d' && !x.roadmap)
    : LIB.find(x => x.type === 'frame2d' && !x.roadmap);
}

function beginMember(x, y, nodeId = null, template = null) {
  draft = { type: template?.type || tool, template: template || defaultTemplate(tool), start: { x, y, nodeId } };
  render();
}

function finishMember(x, y, nodeId = null) {
  if (!draft) return;
  const start = draft.start;
  const candidateStart = start.nodeId ? nodeById(start.nodeId) : nearNode(start.x, start.y);
  const candidateEnd = nodeId ? nodeById(nodeId) : nearNode(x, y);
  const sx = candidateStart?.x ?? start.x, sy = candidateStart?.y ?? start.y;
  const ex = candidateEnd?.x ?? x, ey = candidateEnd?.y ?? y;
  if (Math.hypot(ex - sx, ey - sy) < 1e-8) {
    alert('O elemento precisa ter comprimento diferente de zero.');
    return;
  }
  const draftCopy = draft;
  draft = null;
  mutate(() => {
    const n1 = candidateStart || addNodeRaw(sx, sy);
    const n2 = candidateEnd || addNodeRaw(ex, ey);
    project.elements.push(makeElementFromTemplate(draftCopy.template, n1.id, n2.id));
  });
}

function supportShape(n) {
  const [x, y] = worldToSvg(n.x, n.y), s = supportAt(n.id);
  if (!s || !(s.ux || s.uy || s.rz)) return '';
  if (s.ux && s.uy && s.rz) {
    return `<g class="support"><line x1="${x-18}" y1="${y+12}" x2="${x+18}" y2="${y+12}"/><line x1="${x-16}" y1="${y+16}" x2="${x-8}" y2="${y+24}"/><line x1="${x-6}" y1="${y+16}" x2="${x+2}" y2="${y+24}"/><line x1="${x+4}" y1="${y+16}" x2="${x+12}" y2="${y+24}"/></g>`;
  }
  if (s.ux && s.uy) {
    return `<path class="support" d="M ${x-14} ${y+18} L ${x+14} ${y+18} L ${x} ${y+3} Z M ${x-18} ${y+22} H ${x+18}"/>`;
  }
  if (s.uy) {
    return `<path class="support" d="M ${x-12} ${y+16} L ${x+12} ${y+16} L ${x} ${y+3} Z"/><circle class="support" cx="${x-7}" cy="${y+20}" r="3"/><circle class="support" cx="${x+7}" cy="${y+20}" r="3"/>`;
  }
  if (s.ux) {
    return `<path class="support" d="M ${x-16} ${y-12} L ${x-16} ${y+12} L ${x-3} ${y} Z"/><circle class="support" cx="${x-20}" cy="${y-7}" r="3"/><circle class="support" cx="${x-20}" cy="${y+7}" r="3"/>`;
  }
  return `<circle class="support rotational" cx="${x}" cy="${y}" r="11"/>`;
}

function nodalLoadShape(n) {
  const [x, y] = worldToSvg(n.x, n.y);
  return project.loads.filter(l => l.nodeId === n.id).map(l => {
    const out = [];
    if (Math.abs(l.fx || 0) > 1e-12) {
      const sign = Math.sign(l.fx), tailX = x - sign * 48;
      out.push(`<line class="force" x1="${tailX}" y1="${y}" x2="${x}" y2="${y}" marker-end="url(#arrow-force)"/><text class="force-label" x="${tailX}" y="${y-8}">Fx=${fmt(l.fx)} kN</text>`);
    }
    if (Math.abs(l.fy || 0) > 1e-12) {
      const sign = Math.sign(l.fy), tailY = y + sign * 48;
      out.push(`<line class="force" x1="${x}" y1="${tailY}" x2="${x}" y2="${y}" marker-end="url(#arrow-force)"/><text class="force-label" x="${x+8}" y="${tailY}">Fy=${fmt(l.fy)} kN</text>`);
    }
    if (Math.abs(l.mz || 0) > 1e-12) out.push(`<text class="force-label" x="${x+10}" y="${y+28}">Mz=${fmt(l.mz)} kN·m</text>`);
    return out.join('');
  }).join('');
}

function distributedLoadShape(e) {
  if (e.type !== 'frame2d') return '';
  const load = elementLoadAt(e.id);
  if (!load || (Math.abs(load.qx || 0) < 1e-12 && Math.abs(load.qy || 0) < 1e-12)) return '';
  const a = nodeById(e.n1), b = nodeById(e.n2);
  if (!a || !b) return '';
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), c = dx / L, s = dy / L;
  const qy = load.qy || 0;
  const arrows = [];
  if (Math.abs(qy) > 1e-12) {
    const sign = Math.sign(qy), nx = -s * sign, ny = c * sign;
    for (const t of [0.12, 0.31, 0.50, 0.69, 0.88]) {
      const px = a.x + t * dx, py = a.y + t * dy;
      const tail = worldToSvg(px - nx * 0.45, py - ny * 0.45), head = worldToSvg(px, py);
      arrows.push(`<line class="dist-load" x1="${tail[0]}" y1="${tail[1]}" x2="${head[0]}" y2="${head[1]}" marker-end="url(#arrow-dist)"/>`);
    }
  }
  const mid = worldToSvg((a.x + b.x) / 2 - (-s * Math.sign(qy || 1)) * 0.55, (a.y + b.y) / 2 - (c * Math.sign(qy || 1)) * 0.55);
  const label = [Math.abs(load.qx || 0) > 1e-12 ? `qx=${fmt(load.qx)}` : '', Math.abs(qy) > 1e-12 ? `qy=${fmt(qy)}` : ''].filter(Boolean).join(' · ');
  return `${arrows.join('')}<text class="dist-label" x="${mid[0]}" y="${mid[1]}">${label} kN/m</text>`;
}

function releaseShape(e) {
  if (e.type !== 'frame2d') return '';
  const a = nodeById(e.n1), b = nodeById(e.n2);
  if (!a || !b) return '';
  const p1 = worldToSvg(a.x, a.y), p2 = worldToSvg(b.x, b.y);
  return `${e.releases?.rz1 ? `<circle class="hinge" cx="${p1[0]}" cy="${p1[1]}" r="9"/>` : ''}${e.releases?.rz2 ? `<circle class="hinge" cx="${p2[0]}" cy="${p2[1]}" r="9"/>` : ''}`;
}

function deformationAmplification() {
  if (!project.results) return 1;
  const max = Math.max(...project.results.displacements.map(d => Math.hypot(d.ux, d.uy)), 1e-9);
  return Math.min(250, 0.45 / max) * deformationScale;
}

function deformedShape() {
  if (!project.results) return '';
  const disp = new Map(project.results.displacements.map(d => [d.nodeId, d]));
  const forceMap = new Map(project.results.elementForces.map(f => [f.elementId, f]));
  const amp = deformationAmplification();
  return project.elements.map(e => {
    const a = nodeById(e.n1), b = nodeById(e.n2);
    if (!a || !b) return '';
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), c = dx / L, s = dy / L;
    const da = disp.get(a.id) || { ux: 0, uy: 0, rz: 0 };
    const db = disp.get(b.id) || { ux: 0, uy: 0, rz: 0 };
    let local = forceMap.get(e.id)?.localDisplacements;
    if (!local) {
      local = [
        c * da.ux + s * da.uy, -s * da.ux + c * da.uy, da.rz || 0,
        c * db.ux + s * db.uy, -s * db.ux + c * db.uy, db.rz || 0
      ];
    }
    const pts = [];
    const samples = e.type === 'frame2d' ? 16 : 2;
    for (let k = 0; k < samples; k++) {
      const xi = k / (samples - 1);
      const uLocal = (1 - xi) * local[0] + xi * local[3];
      let vLocal;
      if (e.type === 'frame2d') {
        const n1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
        const n2 = L * (xi - 2 * xi * xi + xi * xi * xi);
        const n3 = 3 * xi * xi - 2 * xi * xi * xi;
        const n4 = L * (-xi * xi + xi * xi * xi);
        vLocal = n1 * local[1] + n2 * local[2] + n3 * local[4] + n4 * local[5];
      } else {
        vLocal = (1 - xi) * local[1] + xi * local[4];
      }
      const x0 = a.x + xi * dx, y0 = a.y + xi * dy;
      const du = c * uLocal - s * vLocal, dv = s * uLocal + c * vLocal;
      pts.push(worldToSvg(x0 + amp * du, y0 + amp * dv));
    }
    return `<path class="deformed" d="${pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ')}"/>`;
  }).join('');
}

function renderCanvas() {
  const draftSvg = draft ? (() => {
    const p = worldToSvg(draft.start.x, draft.start.y);
    return `<line id="draft-line" class="draft-line" x1="${p[0]}" y1="${p[1]}" x2="${p[0]}" y2="${p[1]}"/>`;
  })() : '';
  return `<svg id="model-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" aria-label="Modelo estrutural">
    <defs>
      <marker id="arrow-force" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z"/></marker>
      <marker id="arrow-dist" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"/></marker>
    </defs>
    ${deformedShape()}
    ${project.elements.map(e => {
      const a = nodeById(e.n1), b = nodeById(e.n2);
      if (!a || !b) return '';
      const p1 = worldToSvg(a.x, a.y), p2 = worldToSvg(b.x, b.y);
      const sel = selected?.kind === 'element' && selected.id === e.id ? 'selected-line' : '';
      return `<g data-element="${e.id}"><line class="member ${e.type === 'truss2d' ? 'truss-member' : ''} ${sel}" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>${releaseShape(e)}${distributedLoadShape(e)}<text class="element-label" x="${(p1[0]+p2[0])/2+6}" y="${(p1[1]+p2[1])/2-7}">${escapeHtml(e.label || e.id)}</text></g>`;
    }).join('')}
    ${project.nodes.map(n => {
      const [x, y] = worldToSvg(n.x, n.y), sel = selected?.kind === 'node' && selected.id === n.id ? 'selected' : '';
      return `<g data-node="${n.id}">${supportShape(n)}${nodalLoadShape(n)}<circle class="node ${sel}" cx="${x}" cy="${y}" r="6"/><text class="node-label" x="${x+9}" y="${y-8}">${n.id}</text></g>`;
    }).join('')}
    ${draftSvg}
  </svg>`;
}

function library() {
  let lastGroup = '';
  return LIB.map((x, i) => {
    const head = x.group !== lastGroup ? `<div class="library-group">${x.group}</div>` : '';
    lastGroup = x.group;
    return `${head}<div class="card ${x.roadmap ? 'roadmap-card' : ''}" ${x.roadmap ? '' : 'draggable="true"'} data-lib="${i}" data-search="${(x.name + ' ' + x.group).toLowerCase()}"><strong>${x.name}</strong><small>${x.roadmap ? 'em desenvolvimento' : `${x.type} · paramétrico`}</small></div>`;
  }).join('');
}

function nodeInspector(n) {
  const s = supportAt(n.id) || { ux: false, uy: false, rz: false };
  const l = nodalLoadAt(n.id);
  return `<div class="section"><h3>Nó ${n.id}</h3>
    <div class="field"><label>X [m]</label><input id="nx" type="number" step="${project.settings.grid || .25}" value="${n.x}"></div>
    <div class="field"><label>Y [m]</label><input id="ny" type="number" step="${project.settings.grid || .25}" value="${n.y}"></div>
  </div>
  <div class="section"><h3>Apoio / graus de liberdade</h3>
    <label class="checkline"><input class="sup" data-d="ux" type="checkbox" ${s.ux ? 'checked' : ''}> restringir Ux</label>
    <label class="checkline"><input class="sup" data-d="uy" type="checkbox" ${s.uy ? 'checked' : ''}> restringir Uy</label>
    <label class="checkline"><input class="sup" data-d="rz" type="checkbox" ${s.rz ? 'checked' : ''}> restringir Rz</label>
  </div>
  <div class="section"><h3>Carga nodal · Caso 1</h3>
    ${l ? `<div class="field"><label>Fx [kN]</label><input id="lfx" type="number" step="1" value="${l.fx || 0}"></div>
    <div class="field"><label>Fy [kN]</label><input id="lfy" type="number" step="1" value="${l.fy || 0}"></div>
    <div class="field"><label>Mz [kN·m]</label><input id="lmz" type="number" step="1" value="${l.mz || 0}"></div>
    <button class="btn danger" id="remove-load">Remover carga</button>` : `<button class="btn" id="add-load">+ Adicionar carga nodal</button>`}
  </div>`;
}

function elementInspector(e) {
  const a = nodeById(e.n1), b = nodeById(e.n2), L = a && b ? Math.hypot(b.x-a.x, b.y-a.y) : 0;
  const load = elementLoadAt(e.id) || { qx: 0, qy: 0 };
  return `<div class="section"><h3>${escapeHtml(e.label || e.id)}</h3>
    <div class="field"><label>Nome</label><input id="elabel" value="${escapeAttr(e.label || '')}"></div>
    <div class="field"><label>Tipo</label><select id="etype"><option value="frame2d" ${e.type==='frame2d'?'selected':''}>Pórtico 2D</option><option value="truss2d" ${e.type==='truss2d'?'selected':''}>Treliça 2D</option></select></div>
    <div class="field"><label>Comprimento</label><output>${L.toFixed(3)} m</output></div>
    <div class="field"><label>Seção</label><select id="esection"><option value="">Customizada</option>${project.sections.map(s => `<option value="${s.id}" ${e.sectionId===s.id?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Área A [m²]</label><input id="eA" type="number" step="0.0001" value="${e.A}"></div>
    ${e.type==='frame2d' ? `<div class="field"><label>Inércia I [m⁴]</label><input id="eI" type="number" step="0.000001" value="${e.I}"></div>` : ''}
    <div class="field"><label>Material</label><select id="emat">${project.materials.map(m => `<option value="${m.id}" ${m.id===e.materialId?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}</select></div>
  </div>
  ${e.type==='frame2d' ? `<div class="section"><h3>Carga distribuída · eixos locais</h3>
    <div class="field"><label>qx [kN/m]</label><input id="eqx" type="number" step="1" value="${load.qx || 0}"></div>
    <div class="field"><label>qy [kN/m]</label><input id="eqy" type="number" step="1" value="${load.qy || 0}"></div>
    <div class="hint">Convenção: +x ao longo de ${e.n1}→${e.n2}; +y local é perpendicular à esquerda do eixo.</div>
  </div>
  <div class="section"><h3>Liberações de extremidade</h3>
    <label class="checkline"><input class="release" data-r="rz1" type="checkbox" ${e.releases?.rz1?'checked':''}> liberar momento em ${e.n1}</label>
    <label class="checkline"><input class="release" data-r="rz2" type="checkbox" ${e.releases?.rz2?'checked':''}> liberar momento em ${e.n2}</label>
    <div class="hint">Implementado por condensação estática no elemento.</div>
  </div>` : ''}
  <div class="section"><h3>Conectividade</h3><div class="hint">${e.n1} → ${e.n2}. Nós existentes são detectados por snap na montagem.</div></div>`;
}

function inspector() {
  if (!selected) return `<div class="section"><h3>Inspector</h3><div class="hint">Selecione um nó ou elemento. Para criar barras: escolha Pórtico/Treliça, clique no primeiro nó e depois no segundo.</div></div>`;
  if (selected.kind === 'node') return nodeInspector(nodeById(selected.id));
  return elementInspector(elementById(selected.id));
}

function resultsPane() {
  if (!project.results) return `<div class="warning">Modelo ainda não analisado. Clique em <b>Analisar</b>.</div>`;
  const max = Math.max(...project.results.displacements.map(d => Math.hypot(d.ux, d.uy))) * 1000;
  return `<div class="grid4">
    <div class="metric"><small>Solver</small><strong>${project.results.type}</strong></div>
    <div class="metric"><small>DOFs totais</small><strong>${project.results.dofs}</strong></div>
    <div class="metric"><small>DOFs ativos</small><strong>${project.results.activeDofs ?? '—'}</strong></div>
    <div class="metric"><small>Desloc. nodal máx.</small><strong>${max.toFixed(3)} mm</strong></div>
  </div><div class="result-tools"><label>Deformada × <input id="def-scale" type="range" min="0.2" max="3" step="0.2" value="${deformationScale}"> <b>${deformationScale.toFixed(1)}</b></label><button class="btn small" id="copy-disp">Copiar CSV</button></div>
  <table class="table"><thead><tr><th>Nó</th><th>Ux [mm]</th><th>Uy [mm]</th><th>Rz [rad]</th></tr></thead><tbody>${project.results.displacements.map(d => `<tr><td>${d.nodeId}</td><td>${(d.ux*1000).toFixed(5)}</td><td>${(d.uy*1000).toFixed(5)}</td><td>${d.rz.toExponential(3)}</td></tr>`).join('')}</tbody></table>`;
}

function forcesPane() {
  if (!project.results) return '<div class="hint">Sem resultados.</div>';
  return `<table class="table"><thead><tr><th>Elemento</th><th>Tipo</th><th>Esforços de extremidade [kN / kN·m]</th></tr></thead><tbody>${project.results.elementForces.map(f => {
    const values = f.type === 'truss2d'
      ? `N=${fmt(f.N)}`
      : `N1=${fmt(f.N1)} · V1=${fmt(f.V1)} · M1=${fmt(f.M1)} · N2=${fmt(f.N2)} · V2=${fmt(f.V2)} · M2=${fmt(f.M2)}`;
    return `<tr><td>${f.elementId}</td><td>${f.type}</td><td>${values}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function reactionsPane() {
  if (!project.results) return '<div class="hint">Sem resultados.</div>';
  const supported = new Set(project.supports.map(s => s.nodeId));
  const rows = project.results.reactions.filter(r => supported.has(r.nodeId) || Math.hypot(r.fx, r.fy, r.mz) > 1e-8);
  return `<div class="row"><button class="btn small" id="copy-react">Copiar CSV</button></div><table class="table"><thead><tr><th>Nó</th><th>Rx [kN]</th><th>Ry [kN]</th><th>Mz [kN·m]</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.nodeId}</td><td>${r.fx.toFixed(4)}</td><td>${r.fy.toFixed(4)}</td><td>${r.mz.toFixed(4)}</td></tr>`).join('')}</tbody></table>`;
}

function checksPane() {
  const checks = checkDisplacement(project, 20);
  if (!checks.length) return '<div class="hint">Execute a análise para ativar as verificações.</div>';
  return `<div class="warning">Pack demonstrativo <b>Custom/User-defined</b>. Não representa uma verificação normativa oficial.</div><div class="sep"></div><table class="table"><thead><tr><th>Verificação</th><th>Demanda</th><th>Limite</th><th>Util.</th></tr></thead><tbody>${checks.map(c => `<tr><td>${c.title}</td><td>${c.demand.toFixed(3)} ${c.unit}</td><td>${c.capacity} ${c.unit}</td><td class="${c.pass?'status-ok':'status-bad'}">${c.utilization.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function modelPane() {
  const report = validateProject(project);
  return `<div class="grid4"><div class="metric"><small>Nós</small><strong>${report.stats.nodes}</strong></div><div class="metric"><small>Pórticos</small><strong>${report.stats.frameElements}</strong></div><div class="metric"><small>Treliças</small><strong>${report.stats.trussElements}</strong></div><div class="metric"><small>Componentes</small><strong>${report.stats.components}</strong></div></div><div class="sep"></div>${report.issues.length ? report.issues.map(i => `<div class="diagnostic ${i.level}"><b>${i.level === 'error' ? 'Erro' : 'Aviso'} · ${i.code}</b><span>${escapeHtml(i.message)}</span></div>`).join('') : '<div class="success">Nenhuma inconsistência básica detectada.</div>'}`;
}

function bottomContent() {
  if (bottomTab === 'forces') return forcesPane();
  if (bottomTab === 'reactions') return reactionsPane();
  if (bottomTab === 'checks') return checksPane();
  if (bottomTab === 'model') return modelPane();
  return resultsPane();
}

function render() {
  const diagnostics = validateProject(project);
  const draftText = draft ? `Montagem: escolha a extremidade final de ${draft.template?.name || draft.type} · Esc cancela` : 'Assembly-first · grid e snap ativos';
  $('#app').innerHTML = `<div class="app">
    <header class="topbar">
      <div class="brand">Astra<span>Struct</span><small> v0.2</small></div>
      <button id="new">Novo</button><button id="undo" ${undoStack.length?'':'disabled'}>↶</button><button id="redo" ${redoStack.length?'':'disabled'}>↷</button>
      <button id="demo-frame">Pórtico</button><button id="demo-beam">Viga q</button><button id="demo-truss">Treliça</button><button id="demo-mixed">Misto</button>
      <button id="import">Importar</button><input id="import-file" type="file" accept="application/json,.json" hidden>
      <button id="export">JSON</button><button id="export-svg">SVG</button><button id="vnl">VNL</button>
      <span class="spacer"></span><span class="mode-pill ${diagnostics.ok?'ok':'warn'}">${diagnostics.ok?'modelo consistente':'verificar modelo'}</span><span class="mode-pill">solver 0.2.0</span><button id="analyze" class="btn primary">▶ Analisar</button>
    </header>
    <main class="main">
      <aside class="sidebar"><div class="section"><h3>Biblioteca de elementos</h3><input id="library-search" class="search" placeholder="Buscar elemento…"></div><div class="section"><div class="cards">${library()}</div></div><div class="section"><h3>Materiais</h3>${project.materials.map(m => `<div class="card material-card"><strong>${escapeHtml(m.name)}</strong><small>E=${(m.E/1e6).toFixed(0)} GPa · ${m.verified?'validado':'exemplo editável'}</small></div>`).join('')}</div></aside>
      <section class="workspace"><div class="toolbar"><button data-tool="select" class="${tool==='select'?'active':''}">Selecionar</button><button data-tool="node" class="${tool==='node'?'active':''}">+ Nó</button><button data-tool="frame2d" class="${tool==='frame2d'?'active':''}">+ Pórtico</button><button data-tool="truss2d" class="${tool==='truss2d'?'active':''}">+ Treliça</button><span class="spacer"></span><span class="hint">${draftText}</span></div>
        <div class="viewport" id="viewport"><div class="hud">${escapeHtml(project.name)} · ${project.nodes.length} nós · ${project.elements.length} elementos</div><div class="banner">Ambiente de engenharia em desenvolvimento — resultados requerem validação independente.</div>${renderCanvas()}</div>
        <div class="bottom"><div class="tabs"><div class="tab ${bottomTab==='results'?'active':''}" data-tab="results">Deslocamentos</div><div class="tab ${bottomTab==='forces'?'active':''}" data-tab="forces">Esforços</div><div class="tab ${bottomTab==='reactions'?'active':''}" data-tab="reactions">Reações</div><div class="tab ${bottomTab==='checks'?'active':''}" data-tab="checks">Verificações</div><div class="tab ${bottomTab==='model'?'active':''}" data-tab="model">Modelo ${diagnostics.issues.length?`(${diagnostics.issues.length})`:''}</div></div><div class="pane">${bottomContent()}</div></div>
      </section>
      <aside class="inspector">${inspector()}<div class="section"><h3>Estado do modelo</h3><div class="grid2"><div class="metric"><small>Nós</small><strong>${project.nodes.length}</strong></div><div class="metric"><small>Elementos</small><strong>${project.elements.length}</strong></div></div><div class="sep"></div><label class="checkline"><input id="snap-toggle" type="checkbox" ${project.settings?.snap!==false?'checked':''}> snap no grid</label><div class="field"><label>Grid [m]</label><input id="grid-size" type="number" min="0.01" step="0.05" value="${project.settings?.grid || .25}"></div><div class="hint">Autosave local ativo. Unidades internas: kN, m, rad.</div></div></aside>
    </main>
    <footer class="statusbar"><span>${draftText}</span><span><span class="kbd">Del</span> excluir</span><span><span class="kbd">Esc</span> cancelar</span><span><span class="kbd">Ctrl+Z</span> desfazer</span><span><span class="kbd">Ctrl+K</span> comandos</span></footer>
  </div>`;
  bind();
}

function bind() {
  $('#new').onclick = () => replaceProject(emptyProject());
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  $('#demo-frame').onclick = () => replaceProject(demoFrame());
  $('#demo-beam').onclick = () => replaceProject(demoBeamUDL());
  $('#demo-truss').onclick = () => replaceProject(demoTruss());
  $('#demo-mixed').onclick = () => replaceProject(demoMixed());
  $('#analyze').onclick = analyze;
  $('#vnl').onclick = showVNL;
  $('#export').onclick = exportJSON;
  $('#export-svg').onclick = exportSVG;
  $('#import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = importJSON;
  $('#library-search').oninput = e => {
    const term = e.target.value.trim().toLowerCase();
    $$('[data-search]').forEach(card => { card.style.display = card.dataset.search.includes(term) ? '' : 'none'; });
  };

  $$('[data-tool]').forEach(b => b.onclick = () => {
    tool = b.dataset.tool;
    draft = null;
    render();
  });
  $$('[data-tab]').forEach(b => b.onclick = () => { bottomTab = b.dataset.tab; render(); });
  $$('[data-lib]').forEach(card => {
    const item = LIB[Number(card.dataset.lib)];
    if (item.roadmap) {
      card.onclick = () => alert(`${item.name}: módulo previsto no roadmap do solver avançado.`);
      return;
    }
    card.ondragstart = e => e.dataTransfer.setData('text/astrastruct-library', card.dataset.lib);
  });

  const vp = $('#viewport'), svg = $('#model-svg');
  vp.ondragover = e => e.preventDefault();
  vp.ondrop = e => {
    e.preventDefault();
    const idx = Number(e.dataTransfer.getData('text/astrastruct-library'));
    const item = LIB[idx];
    if (!item || item.roadmap) return;
    const [x, y] = eventWorld(e, svg);
    tool = item.type;
    const near = nearNode(x, y);
    beginMember(near?.x ?? x, near?.y ?? y, near?.id || null, item);
  };

  svg.onmousemove = e => {
    if (!draft) return;
    const [x, y] = eventWorld(e, svg), p = worldToSvg(x, y), line = $('#draft-line');
    if (line) { line.setAttribute('x2', p[0]); line.setAttribute('y2', p[1]); }
  };
  svg.onclick = e => {
    if (e.target !== svg) return;
    const [x, y] = eventWorld(e, svg);
    if (tool === 'node') mutate(() => addNodeRaw(x, y));
    else if (tool === 'frame2d' || tool === 'truss2d') {
      if (draft) finishMember(x, y);
      else beginMember(x, y);
    } else { selected = null; render(); }
  };

  $$('[data-node]').forEach(g => g.onclick = e => {
    e.stopPropagation();
    const n = nodeById(g.dataset.node);
    if (tool === 'frame2d' || tool === 'truss2d') {
      if (draft) finishMember(n.x, n.y, n.id);
      else beginMember(n.x, n.y, n.id);
    } else {
      selected = { kind: 'node', id: n.id };
      render();
    }
  });
  $$('[data-element]').forEach(g => g.onclick = e => {
    e.stopPropagation();
    if (tool !== 'select') return;
    selected = { kind: 'element', id: g.dataset.element };
    render();
  });

  $('#snap-toggle').onchange = e => mutate(() => { project.settings.snap = e.target.checked; }, { keepResults: true });
  $('#grid-size').onchange = e => mutate(() => { project.settings.grid = Math.max(0.01, +e.target.value || .25); }, { keepResults: true });
  bindInspector();
  bindResultActions();
}

function bindInspector() {
  if (!selected) return;
  if (selected.kind === 'node') {
    const n = nodeById(selected.id);
    $('#nx').onchange = e => mutate(() => { n.x = +e.target.value; });
    $('#ny').onchange = e => mutate(() => { n.y = +e.target.value; });
    $$('.sup').forEach(c => c.onchange = () => mutate(() => {
      let s = supportAt(n.id);
      if (!s) { s = { nodeId: n.id, ux: false, uy: false, rz: false }; project.supports.push(s); }
      s[c.dataset.d] = c.checked;
    }));
    if ($('#add-load')) $('#add-load').onclick = () => mutate(() => project.loads.push({ id: uid('L'), caseId: 'LC1', nodeId: n.id, fx: 0, fy: -10, mz: 0 }));
    if ($('#remove-load')) $('#remove-load').onclick = () => mutate(() => { project.loads = project.loads.filter(l => l.nodeId !== n.id); });
    const load = nodalLoadAt(n.id);
    if (load) {
      $('#lfx').onchange = e => mutate(() => { load.fx = +e.target.value || 0; });
      $('#lfy').onchange = e => mutate(() => { load.fy = +e.target.value || 0; });
      $('#lmz').onchange = e => mutate(() => { load.mz = +e.target.value || 0; });
    }
    return;
  }

  const e = elementById(selected.id);
  $('#elabel').onchange = x => mutate(() => { e.label = x.target.value; });
  $('#etype').onchange = x => mutate(() => {
    e.type = x.target.value;
    if (e.type === 'truss2d') { e.I = 0; e.releases = { rz1: true, rz2: true }; }
    else if (!(e.I > 0)) { const s = project.sections.find(s => s.id === 'rc_30x50'); e.I = s.I; e.A = s.A; e.sectionId = s.id; e.releases = { rz1: false, rz2: false }; }
  });
  $('#esection').onchange = x => mutate(() => {
    const s = project.sections.find(s => s.id === x.target.value);
    e.sectionId = x.target.value || null;
    if (s) { e.A = s.A; if (e.type === 'frame2d') e.I = s.I || e.I; }
  });
  $('#eA').onchange = x => mutate(() => { e.A = +x.target.value; e.sectionId = null; });
  if ($('#eI')) $('#eI').onchange = x => mutate(() => { e.I = +x.target.value; e.sectionId = null; });
  $('#emat').onchange = x => mutate(() => { e.materialId = x.target.value; });
  if ($('#eqx')) $('#eqx').onchange = () => updateElementLoadFromInputs(e);
  if ($('#eqy')) $('#eqy').onchange = () => updateElementLoadFromInputs(e);
  $$('.release').forEach(c => c.onchange = () => mutate(() => { e.releases = { ...(e.releases || {}), [c.dataset.r]: c.checked }; }));
}

function updateElementLoadFromInputs(e) {
  const qx = +$('#eqx').value || 0, qy = +$('#eqy').value || 0;
  mutate(() => {
    let l = elementLoadAt(e.id);
    if (Math.abs(qx) < 1e-12 && Math.abs(qy) < 1e-12) {
      project.elementLoads = project.elementLoads.filter(x => !(x.elementId === e.id && x.kind === 'uniform'));
      return;
    }
    if (!l) {
      l = { id: uid('EL'), caseId: 'LC1', elementId: e.id, kind: 'uniform', qx: 0, qy: 0 };
      project.elementLoads.push(l);
    }
    l.qx = qx; l.qy = qy;
  });
}

function bindResultActions() {
  if ($('#def-scale')) $('#def-scale').oninput = e => {
    deformationScale = +e.target.value;
    project.settings.deformationScale = deformationScale;
    saveProject();
    render();
  };
  if ($('#copy-disp')) $('#copy-disp').onclick = () => copyCSV(
    ['nodeId','ux_mm','uy_mm','rz_rad'],
    project.results.displacements.map(d => [d.nodeId, d.ux*1000, d.uy*1000, d.rz])
  );
  if ($('#copy-react')) $('#copy-react').onclick = () => copyCSV(
    ['nodeId','Rx_kN','Ry_kN','Mz_kNm'],
    project.results.reactions.map(r => [r.nodeId, r.fx, r.fy, r.mz])
  );
}

function analyze() {
  const diagnostics = validateProject(project);
  if (!diagnostics.ok) {
    bottomTab = 'model';
    render();
    alert('O modelo possui inconsistências que precisam ser corrigidas antes da análise. Consulte a aba Modelo.');
    return;
  }
  try {
    project.results = solve(project);
    project.meta.solverVersion = project.results.solverVersion || '0.2.0';
    saveProject();
    bottomTab = 'results';
    render();
  } catch (err) {
    bottomTab = 'model';
    render();
    alert(err.message || String(err));
  }
}

function exportJSON() {
  downloadBlob(`${safeName(project.name)}.json`, 'application/json', JSON.stringify(project, null, 2));
}

function exportSVG() {
  const svg = $('#model-svg');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  downloadBlob(`${safeName(project.name)}.svg`, 'image/svg+xml', new XMLSerializer().serializeToString(clone));
}

async function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try { replaceProject(normalizeProject(JSON.parse(await file.text()))); }
  catch (err) { alert(`Arquivo inválido: ${err.message}`); }
  e.target.value = '';
}

function downloadBlob(name, type, content) {
  const blob = new Blob([content], { type }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyCSV(headers, rows) {
  const text = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  try { await navigator.clipboard.writeText(text); }
  catch { prompt('Copie o CSV:', text); }
}

function showVNL() {
  const val = validateGraph(vnl), hasRoadmap = vnl.some(b => b.status === 'roadmap');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal wide"><div class="row"><h2 style="margin-right:auto">VNL — Visual Nonlinear Language</h2><button class="btn" id="close-vnl">Fechar</button></div>
    <div class="warning">A VNL é a DSL visual própria do AstraStruct. O pipeline linear usa o solver atual; não linearidade permanece explicitamente como roadmap.</div><div class="sep"></div>
    <div class="vnl-grid"><div><h3>Blocos</h3><div class="block-list">${VNL_BLOCKS.map(b => `<div class="vnl-block" data-add-block="${b}">${b}</div>`).join('')}</div></div><div><div class="vnl-canvas">${vnl.map((b,i) => `<div class="vnode ${b.status==='roadmap'?'roadmap-node':''}"><strong><span class="port"></span>${b.type}</strong><small>${b.status==='roadmap'?'solver avançado em desenvolvimento':'pronto'}</small>${i<vnl.length-1?'<small>→ saída tipada</small>':''}</div>`).join('')}</div><div class="sep"></div><div class="${val.ok?'success':'warning'}">${val.ok?'Grafo contém as dependências mínimas.':'Dependências ausentes: '+val.missing.join(', ')}</div><div class="row vnl-actions"><button class="btn primary" id="run-vnl" ${!val.ok||hasRoadmap?'disabled':''}>Executar pipeline linear</button><button class="btn" id="reset-vnl">Restaurar pipeline</button></div></div></div></div>`;
  document.body.appendChild(wrap);
  $('#close-vnl').onclick = () => wrap.remove();
  $('#reset-vnl').onclick = () => { vnl = defaultGraph(); wrap.remove(); showVNL(); };
  if ($('#run-vnl')) $('#run-vnl').onclick = () => { wrap.remove(); analyze(); };
  wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
  wrap.querySelectorAll('[data-add-block]').forEach(b => b.onclick = () => {
    const type = b.dataset.addBlock;
    const roadmap = ['Increment','Convergence','Material Nonlinearity','Geometric Nonlinearity','Contact'].includes(type);
    vnl.push({ id: uid('B'), type, status: roadmap ? 'roadmap' : 'ready' });
    wrap.remove(); showVNL();
  });
}

function showCommands() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop command-backdrop';
  wrap.innerHTML = `<div class="modal command-modal"><h2>Comandos</h2><button data-cmd="analyze">▶ Analisar modelo</button><button data-cmd="frame">Criar pórtico 2D</button><button data-cmd="truss">Criar treliça 2D</button><button data-cmd="beam">Abrir demo de viga distribuída</button><button data-cmd="model">Validar modelo</button></div>`;
  document.body.appendChild(wrap);
  wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
  wrap.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => {
    const cmd = b.dataset.cmd; wrap.remove();
    if (cmd === 'analyze') analyze();
    if (cmd === 'frame') { tool = 'frame2d'; draft = null; render(); }
    if (cmd === 'truss') { tool = 'truss2d'; draft = null; render(); }
    if (cmd === 'beam') replaceProject(demoBeamUDL());
    if (cmd === 'model') { bottomTab = 'model'; render(); }
  });
}

function deleteSelected() {
  if (!selected) return;
  mutate(() => {
    if (selected.kind === 'element') {
      project.elements = project.elements.filter(x => x.id !== selected.id);
      project.elementLoads = project.elementLoads.filter(x => x.elementId !== selected.id);
    } else {
      project.elements = project.elements.filter(x => x.n1 !== selected.id && x.n2 !== selected.id);
      const live = new Set(project.elements.map(x => x.id));
      project.elementLoads = project.elementLoads.filter(x => live.has(x.elementId));
      project.nodes = project.nodes.filter(x => x.id !== selected.id);
      project.supports = project.supports.filter(x => x.nodeId !== selected.id);
      project.loads = project.loads.filter(x => x.nodeId !== selected.id);
    }
    selected = null;
  });
}

window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const editing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); showCommands(); }
  if (e.key === 'Escape') { if (draft) { draft = null; render(); } }
  if (e.key === 'Delete' && !editing) deleteSelected();
});

function fmt(v) { return Number(v || 0).toFixed(2); }
function safeName(v) { return (v || 'astrastruct').replace(/[^a-z0-9_-]+/gi, '_'); }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(v) { return escapeHtml(v); }

saveProject();
render();
