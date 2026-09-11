import { normalizeProject, uid } from '../core/model.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function load(){try{const p=normalizeProject(JSON.parse(localStorage.getItem(KEY)));p.settlements=Array.isArray(p.settlements)?p.settlements:[];return p}catch{return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p))}
function settlementAt(p,nodeId,caseId){return p.settlements.find(s=>s.nodeId===nodeId&&s.caseId===caseId)}

function showAdvancedLoads(){
  const p=load();if(!p)return alert('Projeto atual indisponível.');
  let caseId=p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id;
  let elementId=(p.elements||[]).find(e=>e.type==='frame2d')?.id||p.elements?.[0]?.id;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);

  function render(){
    const frames=(p.elements||[]).filter(e=>e.type==='frame2d'),points=(p.elementLoads||[]).filter(l=>l.caseId===caseId&&l.kind==='point'&&l.elementId===elementId),selfWeights=(p.elementLoads||[]).filter(l=>l.caseId===caseId&&l.kind==='selfWeight');
    wrap.innerHTML=`<div class="modal advanced-load-modal"><div class="row"><div><h2>Cargas+ · carregamentos avançados</h2><div class="hint">Carga concentrada na barra, peso próprio automático e deslocamentos impostos. Eixos da carga pontual são locais do elemento.</div></div><span class="spacer"></span><button class="btn" id="close-advanced">Fechar</button></div>
    <div class="advanced-toolbar"><label>Caso <select id="adv-case">${p.loadCases.map(c=>`<option value="${c.id}" ${c.id===caseId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><span class="hint">Todas as ações desta janela pertencem ao caso selecionado.</span></div>
    <div class="advanced-grid">
      <section class="advanced-card"><div class="row"><h3>Carga pontual em barra</h3><span class="spacer"></span><button class="btn small" id="add-point" ${frames.length?'':'disabled'}>+ Carga</button></div>
        ${frames.length?`<label class="wide-field">Elemento <select id="adv-element">${frames.map(e=>`<option value="${e.id}" ${e.id===elementId?'selected':''}>${esc(e.label||e.id)} · ${e.id}</option>`).join('')}</select></label>`:'<div class="warning">Nenhum elemento de pórtico 2D disponível.</div>'}
        <div class="point-list">${points.length?points.map(l=>`<div class="point-row" data-point="${l.id}"><label>x/L<input data-p="xi" type="number" min="0" max="1" step="0.05" value="${l.xi??0.5}"></label><label>Px [kN]<input data-p="px" type="number" step="1" value="${l.px||0}"></label><label>Py [kN]<input data-p="py" type="number" step="1" value="${l.py||0}"></label><button class="btn small danger" data-del-point="${l.id}">×</button></div>`).join(''):'<div class="hint">Sem cargas pontuais neste elemento/caso.</div>'}</div>
        <div class="hint">0 ≤ x/L ≤ 1. A carga é convertida em vetor nodal consistente pelas funções de forma do elemento Euler–Bernoulli.</div>
      </section>
      <section class="advanced-card"><h3>Peso próprio</h3><div class="metric-line"><span>Elementos ativos neste caso</span><b>${selfWeights.length}/${p.elements.length}</b></div><div class="row"><button class="btn" id="self-all">Aplicar a todos</button><button class="btn danger" id="self-none">Remover do caso</button></div><div class="hint">w = γA. O valor γ é lido do material em kN/m³ e a gravidade atua no eixo global −Y. Em barras inclinadas, o solver transforma o peso para os eixos locais.</div></section>
      <section class="advanced-card settlements"><h3>Recalques / deslocamentos impostos · ${esc(p.loadCases.find(c=>c.id===caseId)?.name||caseId)}</h3>${(p.supports||[]).length?`<table class="table"><thead><tr><th>Nó</th><th>Ux [mm]</th><th>Uy [mm]</th><th>Rz [mrad]</th></tr></thead><tbody>${p.supports.map(s=>{const st=settlementAt(p,s.nodeId,caseId)||{ux:0,uy:0,rz:0};return `<tr data-support="${s.nodeId}"><td>${s.nodeId}</td><td>${s.ux?`<input data-settle="ux" type="number" step="0.1" value="${(st.ux||0)*1000}">`:'—'}</td><td>${s.uy?`<input data-settle="uy" type="number" step="0.1" value="${(st.uy||0)*1000}">`:'—'}</td><td>${s.rz?`<input data-settle="rz" type="number" step="0.1" value="${(st.rz||0)*1000}">`:'—'}</td></tr>`}).join('')}</tbody></table>`:'<div class="warning">Defina ao menos um apoio no modelo.</div>'}<div class="hint">O recalque é uma ação do caso selecionado. Em uma combinação, seus valores prescritos são superpostos pelos fatores do Scenario Engine.</div></section>
    </div><div class="row advanced-footer"><div class="warning">Análise linear. Cargas e recalques participam das combinações customizadas; packs normativos permanecem independentes.</div><span class="spacer"></span><button class="btn primary" id="apply-advanced">Aplicar e recarregar</button></div></div>`;

    $('#close-advanced',wrap).onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
    $('#adv-case',wrap).onchange=e=>{caseId=e.target.value;render()};
    if($('#adv-element',wrap))$('#adv-element',wrap).onchange=e=>{elementId=e.target.value;render()};
    if($('#add-point',wrap))$('#add-point',wrap).onclick=()=>{p.elementLoads.push({id:uid('PL'),caseId,elementId,kind:'point',xi:0.5,px:0,py:-10});render()};
    wrap.querySelectorAll('[data-del-point]').forEach(b=>b.onclick=()=>{p.elementLoads=p.elementLoads.filter(l=>l.id!==b.dataset.delPoint);render()});
    wrap.querySelectorAll('[data-point]').forEach(row=>row.querySelectorAll('input[data-p]').forEach(input=>input.onchange=()=>{const l=p.elementLoads.find(x=>x.id===row.dataset.point);if(!l)return;const value=Number(input.value)||0;l[input.dataset.p]=input.dataset.p==='xi'?Math.max(0,Math.min(1,value)):value}));
    $('#self-all',wrap).onclick=()=>{for(const e of p.elements){if(!p.elementLoads.some(l=>l.kind==='selfWeight'&&l.caseId===caseId&&l.elementId===e.id))p.elementLoads.push({id:uid('SW'),caseId,elementId:e.id,kind:'selfWeight',factor:1})}render()};
    $('#self-none',wrap).onclick=()=>{p.elementLoads=p.elementLoads.filter(l=>!(l.kind==='selfWeight'&&l.caseId===caseId));render()};
    wrap.querySelectorAll('[data-support]').forEach(row=>row.querySelectorAll('[data-settle]').forEach(input=>input.onchange=()=>{let st=settlementAt(p,row.dataset.support,caseId);if(!st){st={id:uid('SET'),caseId,nodeId:row.dataset.support,ux:0,uy:0,rz:0};p.settlements.push(st)}st[input.dataset.settle]=(Number(input.value)||0)/1000;if(Math.abs(st.ux)<1e-15&&Math.abs(st.uy)<1e-15&&Math.abs(st.rz)<1e-15)p.settlements=p.settlements.filter(x=>x.id!==st.id)}));
    $('#apply-advanced',wrap).onclick=()=>{p.settings={...(p.settings||{}),activeLoadCaseId:caseId};p.results=null;p.meta={...(p.meta||{}),solverVersion:'0.5.0',updatedAt:new Date().toISOString()};save(p);location.reload()};
  }
  render();
}

function updateVersion(topbar){const v=topbar?.querySelector('.brand small');if(v)v.textContent=' v0.5';[...(topbar?.querySelectorAll('.mode-pill')||[])].forEach(x=>{if(x.textContent.includes('solver '))x.textContent='solver 0.5.0'})}
function inject(){const topbar=document.querySelector('.topbar');if(!topbar)return;updateVersion(topbar);if(document.querySelector('#advanced-loads'))return;const b=document.createElement('button');b.id='advanced-loads';b.textContent='Cargas+';b.title='Carga pontual, peso próprio e recalques';b.onclick=showAdvancedLoads;const ref=topbar.querySelector('#postprocess')||topbar.querySelector('#vnl')||topbar.querySelector('.spacer');topbar.insertBefore(b,ref)}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
