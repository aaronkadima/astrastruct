import { normalizeProject } from '../core/model.js';
import { solve } from '../solver/index.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(v,d=3){const n=Number(v);if(!Number.isFinite(n))return'—';return Math.abs(n)>=1e4||Math.abs(n)>0&&Math.abs(n)<1e-3?n.toExponential(3):n.toFixed(d)}
function load(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}

function stressChart(response){
  const pts=response.stations.filter(p=>Number.isFinite(Number(p.sigmaTop))&&Number.isFinite(Number(p.sigmaBottom)));
  if(!pts.length)return '<div class="warning">A seção não possui profundidade geométrica suficiente para recuperar tensões de flexão. Defina h, d, depth ou cY na seção.</div>';
  const W=720,H=250,L=58,R=20,T=25,B=38,xmax=Math.max(...pts.map(p=>p.x)),ys=pts.flatMap(p=>[p.sigmaTop,p.sigmaBottom]),ymin=Math.min(...ys,0),ymax=Math.max(...ys,0),span=Math.max(ymax-ymin,1e-9),lo=ymin-.12*span,hi=ymax+.12*span;
  const sx=x=>L+x/Math.max(xmax,1e-12)*(W-L-R),sy=y=>T+(hi-y)/Math.max(hi-lo,1e-12)*(H-T-B);
  const path=field=>pts.map((p,i)=>`${i?'L':'M'} ${sx(p.x).toFixed(2)} ${sy(p[field]).toFixed(2)}`).join(' '),y0=sy(0);
  return `<svg class="stress-chart" viewBox="0 0 ${W} ${H}"><line class="chart-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H-B}"/><line class="chart-axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>${y0>=T&&y0<=H-B?`<line class="chart-zero" x1="${L}" y1="${y0}" x2="${W-R}" y2="${y0}"/>`:''}<path class="stress-top" d="${path('sigmaTop')}"/><path class="stress-bottom" d="${path('sigmaBottom')}"/><text class="chart-label" x="${L}" y="${H-12}">0</text><text class="chart-label" x="${W-R-42}" y="${H-12}">${fmt(xmax)} m</text><text class="stress-legend top" x="${L+10}" y="${T+15}">σ topo</text><text class="stress-legend bottom" x="${L+85}" y="${T+15}">σ base</text></svg>`;
}

function showStressPanel(){
  const p=load();if(!p)return alert('Projeto atual indisponível.');let r;
  try{r=solve(p,p.settings?.analysisScenarioId||p.loadCases?.[0]?.id)}catch(err){return alert(`Não foi possível recuperar tensões: ${err.message||err}`)}
  if(!r.elementResponses?.length)return alert('O modelo não possui respostas de elementos.');let id=r.elementResponses[0].elementId;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);
  function render(){
    const response=r.elementResponses.find(x=>x.elementId===id)||r.elementResponses[0];id=response.elementId;const e=p.elements.find(x=>x.id===id),mat=p.materials.find(x=>x.id===e?.materialId),sec=p.sections.find(x=>x.id===e?.sectionId),sample=response.stations.filter((_,i,a)=>i===0||i===a.length-1||i===Math.floor((a.length-1)/4)||i===Math.floor((a.length-1)/2)||i===Math.floor(3*(a.length-1)/4));
    const finite=response.stations.flatMap(s=>[s.sigmaTop,s.sigmaBottom,s.sigmaAxial]).filter(x=>Number.isFinite(Number(x))),peak=finite.length?Math.max(...finite.map(x=>Math.abs(Number(x)))):null;
    wrap.innerHTML=`<div class="modal stress-modal"><div class="row"><div><h2>Tensões elásticas de seção</h2><div class="hint">σ = N/A − M·y/I. Tração positiva; eixo y local positivo para o topo da seção.</div></div><span class="spacer"></span><button class="btn" id="close-stress">Fechar</button></div><div class="post-toolbar"><label>Elemento <select id="stress-element">${r.elementResponses.map(x=>{const el=p.elements.find(e=>e.id===x.elementId);return`<option value="${x.elementId}" ${x.elementId===id?'selected':''}>${esc(el?.label||x.elementId)} · ${x.elementId}</option>`}).join('')}</select></label><span class="scenario-chip">${esc(r.scenario?.name||r.scenario?.id)}</span></div><div class="post-summary"><div><small>Material</small><b>${esc(mat?.name||'—')}</b></div><div><small>Seção</small><b>${esc(sec?.name||'—')}</b></div><div><small>σ abs. máx.</small><b>${fmt(peak)} MPa</b></div><div><small>Modelo</small><b>${response.stress?.axialOnly?'axial':'N + M'}</b></div></div><div class="stress-formulas"><span>σN = N/A</span><span>σtop = N/A − M·c/I</span><span>σbase = N/A + M·c/I</span></div>${stressChart(response)}<h3 class="post-subtitle">Seções de referência</h3><table class="table diagram-table"><thead><tr><th>x [m]</th><th>N [kN]</th><th>M [kN·m]</th><th>σN [MPa]</th><th>σtop [MPa]</th><th>σbase [MPa]</th></tr></thead><tbody>${sample.map(s=>`<tr><td>${fmt(s.x)}</td><td>${fmt(s.N)}</td><td>${fmt(s.M)}</td><td>${fmt(s.sigmaAxial)}</td><td>${fmt(s.sigmaTop)}</td><td>${fmt(s.sigmaBottom)}</td></tr>`).join('')}</tbody></table><div class="warning">Estas são tensões de seção bruta em regime linear elástico. Para concreto armado, não representam distribuição fissurada, tensões na armadura, ELU/ELS ou verificação normativa. Resistências do material são apenas dados de entrada nesta versão.</div></div>`;
    $('#close-stress',wrap).onclick=()=>wrap.remove();$('#stress-element',wrap).onchange=e=>{id=e.target.value;render()};wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
  }render();
}

function inject(){const top=document.querySelector('.topbar');if(!top||document.querySelector('#stress-panel'))return;const b=document.createElement('button');b.id='stress-panel';b.textContent='Tensões';b.title='Tensões elásticas N/A ± Mc/I';b.onclick=showStressPanel;const ref=top.querySelector('#report')||top.querySelector('#postprocess')||top.querySelector('.spacer');top.insertBefore(b,ref)}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
