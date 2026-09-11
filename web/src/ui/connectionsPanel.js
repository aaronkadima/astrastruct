import { normalizeProject } from '../core/model.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function read(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p))}
function mode(e,end){const key=end===1?'rz1':'rz2';if(e.releases?.[key]||e.rotationalSprings?.[key]===0)return'hinge';const k=e.rotationalSprings?.[key];return Number.isFinite(Number(k))&&Number(k)>0?'semi':'rigid'}
function length(p,e){const a=p.nodes.find(x=>x.id===e.n1),b=p.nodes.find(x=>x.id===e.n2);return a&&b?Math.hypot(b.x-a.x,b.y-a.y):0}
function rigidity(p,e){const m=p.materials.find(x=>x.id===e.materialId);return (Number(m?.E)||0)*(Number(e.I)||0)}
function ratio(p,e,end){const key=end===1?'rz1':'rz2',k=Number(e.rotationalSprings?.[key]),EI=rigidity(p,e),L=length(p,e);return Number.isFinite(k)&&k>0&&EI>0&&L>0?k*L/EI:null}
function suggestedK(p,e){const EI=rigidity(p,e),L=length(p,e);return EI>0&&L>0?4*EI/L:10000}

function setMode(p,e,end,value){
  const key=end===1?'rz1':'rz2';e.releases={rz1:false,rz2:false,...(e.releases||{})};e.rotationalSprings={rz1:null,rz2:null,...(e.rotationalSprings||{})};
  if(value==='rigid'){e.releases[key]=false;e.rotationalSprings[key]=null}
  else if(value==='hinge'){e.releases[key]=true;e.rotationalSprings[key]=0}
  else{e.releases[key]=false;if(!(Number(e.rotationalSprings[key])>0))e.rotationalSprings[key]=suggestedK(p,e)}
}

function showConnectionsPanel(){
  const p=read();if(!p)return alert('Projeto atual indisponível.');const frames=p.elements.filter(e=>e.type==='frame2d');if(!frames.length)return alert('Nenhum elemento de pórtico 2D disponível.');
  let elementId=frames[0].id;const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);
  function endCard(e,end){
    const key=end===1?'rz1':'rz2',node=end===1?e.n1:e.n2,m=mode(e,end),k=e.rotationalSprings?.[key],rho=ratio(p,e,end);
    return `<section class="connection-end"><div class="row"><div><h3>Extremidade ${end} · ${esc(node)}</h3><div class="hint">DOF rotacional local ${key}</div></div><span class="spacer"></span><span class="connection-state ${m}">${m==='rigid'?'Rígida':m==='hinge'?'Rótula':'Semirrígida'}</span></div><div class="connection-modes"><button data-mode="rigid" data-end="${end}" class="${m==='rigid'?'active':''}">Rígida</button><button data-mode="semi" data-end="${end}" class="${m==='semi'?'active':''}">Semirrígida</button><button data-mode="hinge" data-end="${end}" class="${m==='hinge'?'active':''}">Rótula</button></div><label class="connection-k">kθ [kN·m/rad]<input data-k-end="${end}" type="number" min="0" step="100" value="${m==='rigid'?'':n(k)}" ${m!=='semi'?'disabled':''}></label><div class="connection-metrics"><div><small>ρ = kθL/EI</small><b>${rho==null?(m==='rigid'?'∞':'0'):rho.toFixed(3)}</b></div><div><small>Rotação relativa</small><b>${m==='rigid'?'0':m==='hinge'?'livre':'M/kθ'}</b></div></div></section>`;
  }
  function render(){
    const e=frames.find(x=>x.id===elementId)||frames[0];elementId=e.id;const L=length(p,e),EI=rigidity(p,e);
    wrap.innerHTML=`<div class="modal connections-modal"><div class="row"><div><h2>Ligações de extremidade · v0.9</h2><div class="hint">Rigidez rotacional explícita entre a rotação nodal e a rotação da extremidade da barra.</div></div><span class="spacer"></span><button class="btn" id="close-connections">Fechar</button></div><div class="connections-toolbar"><label>Elemento <select id="connection-element">${frames.map(x=>`<option value="${x.id}" ${x.id===elementId?'selected':''}>${esc(x.label||x.id)} · ${x.id}</option>`).join('')}</select></label><span class="scenario-chip">L=${L.toFixed(3)} m · EI=${EI.toExponential(3)} kN·m²</span></div><div class="connections-grid">${endCard(e,1)}${endCard(e,2)}</div><div class="connection-formulation"><div><b>Equilíbrio interno da ligação</b><span>(Krr + Kθ) θe = pr − Kra ua + Kθ θn</span></div><div><b>Momento transmitido</b><span>M = kθ(θn − θe)</span></div></div><div class="warning">kθ → ∞ reproduz ligação rígida; kθ = 0 reproduz rótula. A opção semirrígida usa condensação estática com rotação interna da extremidade, não redução empírica de EI.</div><div class="row advanced-footer"><span class="hint">Referência adimensional exibida: ρ=kθL/EI. A classificação normativa da ligação ainda não é aplicada.</span><span class="spacer"></span><button class="btn primary" id="apply-connections">Aplicar e recarregar</button></div></div>`;
    $('#close-connections',wrap).onclick=()=>wrap.remove();wrap.onclick=ev=>{if(ev.target===wrap)wrap.remove()};$('#connection-element',wrap).onchange=ev=>{elementId=ev.target.value;render()};
    wrap.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(p,e,Number(b.dataset.end),b.dataset.mode);render()});
    wrap.querySelectorAll('[data-k-end]').forEach(input=>input.onchange=()=>{const end=Number(input.dataset.kEnd),key=end===1?'rz1':'rz2';e.releases[key]=false;e.rotationalSprings[key]=Math.max(1e-9,n(input.value,suggestedK(p,e)));render()});
    $('#apply-connections',wrap).onclick=()=>{p.results=null;p.meta={...(p.meta||{}),solverVersion:'0.9.0',updatedAt:new Date().toISOString()};save(normalizeProject(p));location.reload()};
  }render();
}

function inject(){const top=document.querySelector('.topbar');if(!top)return;const v=top.querySelector('.brand small');if(v)v.textContent=' v0.9';[...top.querySelectorAll('.mode-pill')].forEach(x=>{if(x.textContent.includes('solver '))x.textContent='solver 0.9.0'});if(document.querySelector('#connections-panel'))return;const b=document.createElement('button');b.id='connections-panel';b.textContent='Ligações';b.title='Ligações rígidas, semirrígidas e rotuladas';b.onclick=showConnectionsPanel;const ref=top.querySelector('#report')||top.querySelector('.spacer');top.insertBefore(b,ref)}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
