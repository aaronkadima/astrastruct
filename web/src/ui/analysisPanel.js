import { normalizeProject } from '../core/model.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function read(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p))}
function n(v,f){const x=Number(v);return Number.isFinite(x)?x:f}

function showAnalysisPanel(){
  const p=read();if(!p)return alert('Projeto atual indisponível.');
  const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);
  let mode=p.settings.analysisType||'linear';
  function render(){
    const pureFrame=p.elements.length>0&&p.elements.every(e=>e.type==='frame2d'),last=p.results?.pDelta;
    wrap.innerHTML=`<div class="modal analysis-modal"><div class="row"><div><h2>Tipo de análise · v0.10</h2><div class="hint">Selecione a formulação usada pelo cenário estrutural.</div></div><span class="spacer"></span><button class="btn" id="close-analysis">Fechar</button></div><div class="analysis-choice"><button data-analysis="linear" class="${mode==='linear'?'active':''}"><b>Linear</b><span>K u = F</span><small>Pequenas deformações, rigidez independente dos esforços.</small></button><button data-analysis="pdelta" class="${mode==='pdelta'?'active':''}" ${pureFrame?'':'disabled'}><b>P‑Delta</b><span>[K + Kg(N)] u = F</span><small>Rigidez geométrica iterativa com N atualizado por elemento.</small></button></div>${!pureFrame?'<div class="warning">P‑Delta v0.10 está habilitado apenas para modelos formados exclusivamente por elementos frame2d. Modelos mistos e treliças permanecem no solver linear.</div>':''}<section class="analysis-settings"><h3>Controle iterativo P‑Delta</h3><div class="analysis-fields"><label>Máximo de iterações<input id="pd-max" type="number" min="2" max="100" step="1" value="${p.settings.pDeltaMaxIterations||30}" ${mode!=='pdelta'?'disabled':''}></label><label>Tolerância relativa<input id="pd-tol" type="number" min="1e-12" step="1e-8" value="${p.settings.pDeltaTolerance||1e-8}" ${mode!=='pdelta'?'disabled':''}></label></div><div class="equation-box">K<sub>t</sub> = K<sub>e</sub> + K<sub>g</sub>(N)</div><div class="hint">No AstraStruct, N &gt; 0 é tração. Compressão produz N &lt; 0 e reduz a rigidez tangente por meio de Kg. O esforço normal é atualizado após cada solução global até convergência dos deslocamentos.</div></section>${last?`<div class="analysis-last"><small>Última análise P‑Delta</small><b>${last.converged?'Convergida':'Não convergida'} · ${last.iterations} iterações</b><span>Δu final = ${Number(last.maxDelta||0).toExponential(3)}</span></div>`:''}<div class="warning">P‑Delta v0.10 é uma análise geométrica de segunda ordem por matriz geométrica consistente. Não é análise de flambagem por autovalores, não substitui imperfeições normativas e ainda não inclui grandes rotações/co-rotacionalidade.</div><div class="row advanced-footer"><span class="hint">O modo linear continua sendo o padrão para projetos novos.</span><span class="spacer"></span><button class="btn primary" id="apply-analysis">Aplicar e recarregar</button></div></div>`;
    $('#close-analysis',wrap).onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
    wrap.querySelectorAll('[data-analysis]').forEach(b=>b.onclick=()=>{if(b.disabled)return;mode=b.dataset.analysis;render()});
    $('#apply-analysis',wrap).onclick=()=>{p.settings.analysisType=mode;p.settings.pDeltaMaxIterations=Math.max(2,Math.min(100,Math.round(n($('#pd-max',wrap)?.value,p.settings.pDeltaMaxIterations||30))));p.settings.pDeltaTolerance=Math.max(1e-12,n($('#pd-tol',wrap)?.value,p.settings.pDeltaTolerance||1e-8));p.results=null;p.meta={...(p.meta||{}),solverVersion:'0.10.0',updatedAt:new Date().toISOString()};save(normalizeProject(p));location.reload()};
  }render();
}

function inject(){const top=document.querySelector('.topbar');if(!top)return;const v=top.querySelector('.brand small');if(v)v.textContent=' v0.10';[...top.querySelectorAll('.mode-pill')].forEach(x=>{if(x.textContent.includes('solver '))x.textContent='solver 0.10.0'});if(document.querySelector('#analysis-panel'))return;const b=document.createElement('button');b.id='analysis-panel';b.textContent='Análise';b.title='Selecionar análise linear ou P-Delta';b.onclick=showAnalysisPanel;const ref=top.querySelector('#report')||top.querySelector('.spacer');top.insertBefore(b,ref)}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
