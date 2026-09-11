import { normalizeProject, uid, sectionDepth } from '../core/model.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function load(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p))}
function springAt(p,nodeId){return (p.nodeSprings||[]).find(s=>s.nodeId===nodeId)}

function showMechanicsPanel(){
  const p=load();if(!p)return alert('Projeto atual indisponível.');
  let caseId=p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id;
  let elementId=p.elements?.[0]?.id;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);

  function render(){
    const element=p.elements.find(e=>e.id===elementId)||p.elements[0];
    if(element)elementId=element.id;
    const mat=element?p.materials.find(m=>m.id===element.materialId):null;
    const sec=element?p.sections.find(s=>s.id===element.sectionId):null;
    const thermals=(p.elementLoads||[]).filter(l=>l.caseId===caseId&&l.elementId===elementId&&l.kind==='thermal');
    const depth=sectionDepth(sec);
    wrap.innerHTML=`<div class="modal mechanics-modal"><div class="row"><div><h2>Mecânica v0.8 · térmica e molas</h2><div class="hint">Ações térmicas por caso, coeficiente de dilatação do material e molas nodais lineares ao solo.</div></div><span class="spacer"></span><button class="btn" id="close-mech">Fechar</button></div>
      <div class="mechanics-toolbar"><label>Caso <select id="mech-case">${p.loadCases.map(c=>`<option value="${c.id}" ${c.id===caseId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Elemento <select id="mech-element">${p.elements.map(e=>`<option value="${e.id}" ${e.id===elementId?'selected':''}>${esc(e.label||e.id)} · ${e.id}</option>`).join('')}</select></label></div>
      <div class="mechanics-grid">
        <section class="advanced-card"><div class="row"><h3>Ação térmica</h3><span class="spacer"></span><button class="btn small" id="add-thermal" ${element?'':'disabled'}>+ Térmica</button></div>
          ${element?`<div class="thermal-meta"><div><small>Material</small><b>${esc(mat?.name||element.materialId)}</b></div><div><small>α</small><b>${(n(mat?.alpha)*1e6).toFixed(2)} µm/(m·°C)</b></div><div><small>Altura térmica</small><b>${depth>0?`${depth.toFixed(4)} m`:'não definida'}</b></div></div>
          <label class="wide-field">α do material [µm/(m·°C)] <input id="thermal-alpha" type="number" min="0" step="0.1" value="${(n(mat?.alpha)*1e6).toFixed(3)}"></label>
          <div class="thermal-list">${thermals.length?thermals.map(t=>`<div class="thermal-row" data-thermal="${t.id}"><label>ΔT uniforme [°C]<input data-th="dT" type="number" step="1" value="${n(t.dT)}"></label><label>ΔT topo−base [°C]<input data-th="dTGradient" type="number" step="1" value="${n(t.dTGradient)}" ${element.type==='truss2d'?'disabled':''}></label><button class="btn small danger" data-del-thermal="${t.id}">×</button></div>`).join(''):'<div class="hint">Sem ação térmica neste elemento/caso.</div>'}</div>
          <div class="hint">ΔT uniforme gera deformação livre εₜ=αΔT. Para pórticos, o gradiente topo−base gera κₜ=−αΔTg/h nos eixos locais. Treliças aceitam apenas ΔT uniforme.</div>`:'<div class="warning">Modelo sem elementos.</div>'}
        </section>
        <section class="advanced-card"><h3>Formulação</h3><div class="equation-box">εₜ = α·ΔT</div><div class="equation-box">Nₜ = E·A·εₜ</div><div class="equation-box">κₜ = −α·(Ttop−Tbase)/h</div><div class="equation-box">Mₜ = E·I·κₜ</div><div class="hint">As grandezas acima são deformações iniciais. O esforço efetivo depende das restrições, continuidade, releases e molas do modelo.</div></section>
        <section class="advanced-card spring-card"><h3>Molas nodais ao solo</h3>${p.nodes.length?`<table class="table spring-table"><thead><tr><th>Nó</th><th>kx [kN/m]</th><th>ky [kN/m]</th><th>kr [kN·m/rad]</th></tr></thead><tbody>${p.nodes.map(node=>{const s=springAt(p,node.id)||{};return`<tr data-spring-node="${node.id}"><td>${node.id}</td><td><input data-spring="kx" type="number" min="0" step="100" value="${n(s.kx)}"></td><td><input data-spring="ky" type="number" min="0" step="100" value="${n(s.ky)}"></td><td><input data-spring="kr" type="number" min="0" step="100" value="${n(s.kr)}"></td></tr>`}).join('')}</tbody></table>`:'<div class="warning">Modelo sem nós.</div>'}<div class="hint">Molas são propriedades estruturais, portanto não pertencem a um caso de carregamento. A força resistente reportada é −k·u.</div></section>
      </div><div class="row advanced-footer"><div class="warning">Modelo linear elástico. Gradientes térmicos exigem uma altura geométrica de seção conhecida. Tensões elásticas não equivalem a verificação normativa.</div><span class="spacer"></span><button class="btn primary" id="apply-mech">Aplicar e recarregar</button></div></div>`;

    $('#close-mech',wrap).onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
    $('#mech-case',wrap).onchange=e=>{caseId=e.target.value;render()};
    $('#mech-element',wrap).onchange=e=>{elementId=e.target.value;render()};
    const alpha=$('#thermal-alpha',wrap);if(alpha&&mat)alpha.onchange=()=>{mat.alpha=Math.max(0,n(alpha.value)/1e6)};
    const add=$('#add-thermal',wrap);if(add)add.onclick=()=>{p.elementLoads.push({id:uid('TH'),caseId,elementId,kind:'thermal',dT:20,dTGradient:0});render()};
    wrap.querySelectorAll('[data-del-thermal]').forEach(b=>b.onclick=()=>{p.elementLoads=p.elementLoads.filter(l=>l.id!==b.dataset.delThermal);render()});
    wrap.querySelectorAll('[data-thermal]').forEach(row=>row.querySelectorAll('[data-th]').forEach(input=>input.onchange=()=>{const t=p.elementLoads.find(l=>l.id===row.dataset.thermal);if(t)t[input.dataset.th]=n(input.value)}));
    wrap.querySelectorAll('[data-spring-node]').forEach(row=>row.querySelectorAll('[data-spring]').forEach(input=>input.onchange=()=>{
      let s=springAt(p,row.dataset.springNode);if(!s){s={id:uid('SPR'),nodeId:row.dataset.springNode,kx:0,ky:0,kr:0};p.nodeSprings.push(s)}
      s[input.dataset.spring]=Math.max(0,n(input.value));if(!(s.kx||s.ky||s.kr))p.nodeSprings=p.nodeSprings.filter(x=>x.id!==s.id);
    }));
    $('#apply-mech',wrap).onclick=()=>{p.settings={...(p.settings||{}),activeLoadCaseId:caseId};p.results=null;p.meta={...(p.meta||{}),solverVersion:'0.8.0',updatedAt:new Date().toISOString()};save(normalizeProject(p));location.reload()};
  }
  render();
}

function inject(){
  const top=document.querySelector('.topbar');if(!top)return;
  const v=top.querySelector('.brand small');if(v)v.textContent=' v0.8';
  [...top.querySelectorAll('.mode-pill')].forEach(x=>{if(x.textContent.includes('solver '))x.textContent='solver 0.8.0'});
  if(document.querySelector('#mechanics-panel'))return;
  const b=document.createElement('button');b.id='mechanics-panel';b.textContent='Molas/Térmica';b.title='Ações térmicas, dilatação e molas nodais';b.onclick=showMechanicsPanel;
  const ref=top.querySelector('#report')||top.querySelector('#property-library')||top.querySelector('#advanced-loads')||top.querySelector('.spacer');top.insertBefore(b,ref);
}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
