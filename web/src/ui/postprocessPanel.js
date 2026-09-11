import { normalizeProject } from '../core/model.js';
import { solve } from '../solver/index.js';
import { solveEnvelope } from '../solver/envelope.js';
import { listScenarios } from '../solver/scenario.js';

const STORAGE_KEY = 'astrastruct.project';
const $ = (s, root = document) => root.querySelector(s);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function fmt(v, digits = 3) {
  const x = Number(v) || 0;
  if (Math.abs(x) >= 1e4 || (Math.abs(x) > 0 && Math.abs(x) < 1e-3)) return x.toExponential(3);
  return x.toFixed(digits);
}

function loadProject() {
  try { return normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return null; }
}

function currentResult(project) {
  const scenarioId = project.settings?.analysisScenarioId || project.loadCases?.[0]?.id;
  if (project.results?.elementResponses?.length && project.results?.scenario?.id === scenarioId) return project.results;
  return solve(project, scenarioId);
}

function svgLineChart({ title, unit, points, field, factor = 1 }) {
  const W = 620, H = 185, L = 54, R = 16, T = 25, B = 35;
  const xs = points.map(p => p.x), ys = points.map(p => (Number(p[field]) || 0) * factor);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), rawMin = Math.min(...ys), rawMax = Math.max(...ys);
  const span = Math.max(Math.abs(rawMax - rawMin), Math.max(Math.abs(rawMin), Math.abs(rawMax)) * 0.08, 1e-9);
  const ymin = rawMin - span * 0.12, ymax = rawMax + span * 0.12;
  const sx = x => L + (x - xmin) / Math.max(xmax - xmin, 1e-12) * (W - L - R);
  const sy = y => T + (ymax - y) / Math.max(ymax - ymin, 1e-12) * (H - T - B);
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x).toFixed(2)} ${sy((Number(p[field]) || 0) * factor).toFixed(2)}`).join(' ');
  const y0 = sy(0);
  const imax = ys.reduce((best, y, i) => Math.abs(y) > Math.abs(ys[best]) ? i : best, 0);
  return `<div class="diagram-card"><div class="diagram-head"><b>${escapeHtml(title)}</b><span>min ${fmt(rawMin)} · max ${fmt(rawMax)} ${unit}</span></div><svg viewBox="0 0 ${W} ${H}" class="diagram-svg"><line class="chart-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H-B}"/><line class="chart-axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>${y0 >= T && y0 <= H-B ? `<line class="chart-zero" x1="${L}" y1="${y0}" x2="${W-R}" y2="${y0}"/>` : ''}<path class="chart-line" d="${d}"/><circle class="chart-point" cx="${sx(xs[imax])}" cy="${sy(ys[imax])}" r="3.5"/><text class="chart-label" x="${L}" y="${H-10}">0</text><text class="chart-label" x="${W-R-28}" y="${H-10}">${fmt(xmax)} m</text><text class="chart-label" x="${Math.min(W-R-80, sx(xs[imax])+6)}" y="${Math.max(T+12, sy(ys[imax])-7)}">${fmt(ys[imax])} ${unit}</text></svg></div>`;
}

function svgEnvelopeChart({ title, unit, stations, field, factor = 1 }) {
  const W = 620, H = 185, L = 54, R = 16, T = 25, B = 35;
  const xs = stations.map(p => p.x);
  const mins = stations.map(p => (Number(p[field]?.min) || 0) * factor), maxs = stations.map(p => (Number(p[field]?.max) || 0) * factor);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), rawMin = Math.min(...mins), rawMax = Math.max(...maxs);
  const span = Math.max(Math.abs(rawMax - rawMin), Math.max(Math.abs(rawMin), Math.abs(rawMax)) * 0.08, 1e-9);
  const ymin = rawMin - span * 0.12, ymax = rawMax + span * 0.12;
  const sx = x => L + (x - xmin) / Math.max(xmax - xmin, 1e-12) * (W - L - R);
  const sy = y => T + (ymax - y) / Math.max(ymax - ymin, 1e-12) * (H - T - B);
  const upper = stations.map((p,i)=>`${i?'L':'M'} ${sx(p.x).toFixed(2)} ${sy((p[field]?.max||0)*factor).toFixed(2)}`).join(' ');
  const lower = [...stations].reverse().map(p=>`L ${sx(p.x).toFixed(2)} ${sy((p[field]?.min||0)*factor).toFixed(2)}`).join(' ');
  const dmax = stations.map((p,i)=>`${i?'L':'M'} ${sx(p.x).toFixed(2)} ${sy((p[field]?.max||0)*factor).toFixed(2)}`).join(' ');
  const dmin = stations.map((p,i)=>`${i?'L':'M'} ${sx(p.x).toFixed(2)} ${sy((p[field]?.min||0)*factor).toFixed(2)}`).join(' ');
  const y0 = sy(0);
  return `<div class="diagram-card"><div class="diagram-head"><b>${escapeHtml(title)} — envelope</b><span>min ${fmt(rawMin)} · max ${fmt(rawMax)} ${unit}</span></div><svg viewBox="0 0 ${W} ${H}" class="diagram-svg"><line class="chart-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H-B}"/><line class="chart-axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>${y0 >= T && y0 <= H-B ? `<line class="chart-zero" x1="${L}" y1="${y0}" x2="${W-R}" y2="${y0}"/>` : ''}<path class="chart-band" d="${upper} ${lower} Z"/><path class="chart-line max" d="${dmax}"/><path class="chart-line min" d="${dmin}"/><text class="chart-label" x="${L}" y="${H-10}">0</text><text class="chart-label" x="${W-R-28}" y="${H-10}">${fmt(xmax)} m</text></svg></div>`;
}

function tableForResponse(response) {
  const sample = response.stations.filter((_, i, arr) => i === 0 || i === arr.length-1 || i === Math.floor((arr.length-1)/4) || i === Math.floor((arr.length-1)/2) || i === Math.floor(3*(arr.length-1)/4));
  return `<table class="table diagram-table"><thead><tr><th>x [m]</th><th>N [kN]</th><th>V [kN]</th><th>M [kN·m]</th><th>v local [mm]</th></tr></thead><tbody>${sample.map(p=>`<tr><td>${fmt(p.x)}</td><td>${fmt(p.N)}</td><td>${fmt(p.V)}</td><td>${fmt(p.M)}</td><td>${fmt(p.vLocal*1000)}</td></tr>`).join('')}</tbody></table>`;
}

export function showPostprocessPanel() {
  const project = loadProject();
  if (!project) return alert('Não foi possível carregar o projeto atual.');
  let result;
  try { result = currentResult(project); }
  catch (err) { return alert(`Analise o modelo antes de abrir os diagramas. ${err.message || err}`); }
  if (!result.elementResponses?.length) return alert('O cenário atual não possui respostas de elementos.');

  let selectedId = result.elementResponses[0].elementId;
  let mode = 'scenario';
  let envelope = null;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  document.body.appendChild(wrap);

  function render() {
    const response = result.elementResponses.find(r => r.elementId === selectedId) || result.elementResponses[0];
    selectedId = response.elementId;
    let charts;
    if (mode === 'envelope') {
      if (!envelope) {
        try { envelope = solveEnvelope(project); }
        catch (err) { mode = 'scenario'; alert(`Não foi possível calcular o envelope: ${err.message || err}`); return render(); }
      }
      const env = envelope.elementResponses.find(r => r.elementId === selectedId);
      charts = env ? `${svgEnvelopeChart({title:'N(x)',unit:'kN',stations:env.stations,field:'N'})}${response.type==='frame2d'?`${svgEnvelopeChart({title:'V(x)',unit:'kN',stations:env.stations,field:'V'})}${svgEnvelopeChart({title:'M(x)',unit:'kN·m',stations:env.stations,field:'M'})}${svgEnvelopeChart({title:'v(x)',unit:'mm',stations:env.stations,field:'vLocal',factor:1000})}`:''}` : '<div class="warning">Elemento sem envelope.</div>';
    } else {
      charts = `${svgLineChart({title:'N(x)',unit:'kN',points:response.stations,field:'N'})}${response.type==='frame2d'?`${svgLineChart({title:'V(x)',unit:'kN',points:response.stations,field:'V'})}${svgLineChart({title:'M(x)',unit:'kN·m',points:response.stations,field:'M'})}${svgLineChart({title:'v(x)',unit:'mm',points:response.stations,field:'vLocal',factor:1000})}`:''}`;
    }
    const scenarios = listScenarios(project);
    wrap.innerHTML = `<div class="modal post-modal"><div class="row"><div><h2>Diagramas e resposta contínua</h2><div class="hint">Convenção: N positivo = tração; M positivo = sagente. V positivo segue +y local do elemento.</div></div><span class="spacer"></span><button class="btn" id="close-post">Fechar</button></div><div class="post-toolbar"><label>Elemento <select id="post-element">${result.elementResponses.map(r=>{const e=project.elements.find(e=>e.id===r.elementId);return `<option value="${r.elementId}" ${r.elementId===selectedId?'selected':''}>${escapeHtml(e?.label||r.elementId)} · ${r.elementId}</option>`}).join('')}</select></label><div class="segmented"><button class="${mode==='scenario'?'active':''}" data-post-mode="scenario">Cenário atual</button><button class="${mode==='envelope'?'active':''}" data-post-mode="envelope">Envelope (${scenarios.length})</button></div><span class="scenario-chip">${escapeHtml(result.scenario?.name||'cenário')}</span></div><div class="post-summary"><div><small>Elemento</small><b>${escapeHtml(project.elements.find(e=>e.id===selectedId)?.label||selectedId)}</b></div><div><small>Comprimento</small><b>${fmt(response.L)} m</b></div><div><small>Tipo</small><b>${response.type}</b></div><div><small>Amostragem</small><b>${response.stations.length} seções</b></div></div><div class="diagram-grid">${charts}</div>${mode==='scenario'?`<div class="sep"></div><h3 class="post-subtitle">Seções de referência</h3>${tableForResponse(response)}`:`<div class="warning envelope-note">Envelope matemático de todos os casos e combinações definidos no projeto. Não equivale, por si só, a envelope normativo de ELU/ELS.</div>`}</div>`;
    $('#close-post',wrap).onclick=()=>wrap.remove();
    $('#post-element',wrap).onchange=e=>{selectedId=e.target.value;render()};
    wrap.querySelectorAll('[data-post-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.postMode;render()});
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
  }
  render();
}

function inject() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || document.querySelector('#postprocess')) return;
  const btn = document.createElement('button');
  btn.id = 'postprocess';
  btn.textContent = 'Diagramas';
  btn.title = 'Diagramas N, V, M, deformada contínua e envelopes';
  btn.onclick = showPostprocessPanel;
  const vnl = topbar.querySelector('#vnl');
  topbar.insertBefore(btn, vnl || topbar.querySelector('.spacer'));
  const brandVersion = topbar.querySelector('.brand small');
  if (brandVersion) brandVersion.textContent = ' v0.4';
  [...topbar.querySelectorAll('.mode-pill')].forEach(p=>{if(p.textContent.includes('solver '))p.textContent='solver 0.4.0'});
}

const observer = new MutationObserver(inject);
observer.observe(document.getElementById('app'), { childList: true, subtree: true });
inject();
