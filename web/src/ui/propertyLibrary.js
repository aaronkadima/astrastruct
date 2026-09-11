import { normalizeProject, uid } from '../core/model.js';

const KEY='astrastruct.project';
const $=(s,r=document)=>r.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p))}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}

function calcSection(s){
  const family=s.family||'custom';let A=n(s.A),I=n(s.I);
  if(family==='rect'){
    const b=Math.max(0,n(s.b)),h=Math.max(0,n(s.h));A=b*h;I=b*h**3/12;
  }else if(family==='circle'){
    const d=Math.max(0,n(s.d));A=Math.PI*d*d/4;I=Math.PI*d**4/64;
  }else if(family==='i'){
    const h=Math.max(0,n(s.h)),b=Math.max(0,n(s.b)),tw=Math.max(0,n(s.tw)),tf=Math.max(0,n(s.tf));
    const hi=Math.max(0,h-2*tf),bi=Math.max(0,b-tw);A=2*b*tf+hi*tw;I=(b*h**3-bi*hi**3)/12;
  }else if(family==='rhs'){
    const h=Math.max(0,n(s.h)),b=Math.max(0,n(s.b)),t=Math.max(0,n(s.t)),hi=Math.max(0,h-2*t),bi=Math.max(0,b-2*t);A=b*h-bi*hi;I=(b*h**3-bi*hi**3)/12;
  }else if(family==='truss'){
    A=Math.max(0,n(s.A));I=0;
  }
  s.A=A;s.I=I;return s;
}

function geometryFields(s){
  if(s.family==='rect')return `<label>b [m]<input data-sec-field="b" type="number" min="0" step="0.01" value="${n(s.b,.3)}"></label><label>h [m]<input data-sec-field="h" type="number" min="0" step="0.01" value="${n(s.h,.5)}"></label>`;
  if(s.family==='circle')return `<label>d [m]<input data-sec-field="d" type="number" min="0" step="0.01" value="${n(s.d,.3)}"></label>`;
  if(s.family==='i')return `<label>h [m]<input data-sec-field="h" type="number" min="0" step="0.01" value="${n(s.h,.4)}"></label><label>b [m]<input data-sec-field="b" type="number" min="0" step="0.01" value="${n(s.b,.2)}"></label><label>tw [m]<input data-sec-field="tw" type="number" min="0" step="0.001" value="${n(s.tw,.01)}"></label><label>tf [m]<input data-sec-field="tf" type="number" min="0" step="0.001" value="${n(s.tf,.016)}"></label>`;
  if(s.family==='rhs')return `<label>h [m]<input data-sec-field="h" type="number" min="0" step="0.01" value="${n(s.h,.2)}"></label><label>b [m]<input data-sec-field="b" type="number" min="0" step="0.01" value="${n(s.b,.12)}"></label><label>t [m]<input data-sec-field="t" type="number" min="0" step="0.001" value="${n(s.t,.008)}"></label>`;
  return `<label>A [m²]<input data-sec-field="A" type="number" min="0" step="0.0001" value="${n(s.A)}"></label><label>I [m⁴]<input data-sec-field="I" type="number" min="0" step="0.000001" value="${n(s.I)}"></label>`;
}

function showPropertyLibrary(){
  const source=load();if(!source)return alert('Projeto atual indisponível.');
  const p=clone(source);let tab='sections',selectedSection=p.sections?.[0]?.id,selectedMaterial=p.materials?.[0]?.id;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';document.body.appendChild(wrap);

  function render(){
    const s=p.sections.find(x=>x.id===selectedSection)||p.sections[0],m=p.materials.find(x=>x.id===selectedMaterial)||p.materials[0];
    if(s)calcSection(s);
    wrap.innerHTML=`<div class="modal property-modal"><div class="row"><div><h2>Biblioteca de propriedades</h2><div class="hint">Materiais e seções paramétricas do projeto. Propriedades geométricas são calculadas em SI e alimentam diretamente o solver.</div></div><span class="spacer"></span><button class="btn" id="cancel-props">Cancelar</button><button class="btn primary" id="apply-props">Aplicar</button></div>
      <div class="property-tabs"><button class="${tab==='sections'?'active':''}" data-prop-tab="sections">Seções</button><button class="${tab==='materials'?'active':''}" data-prop-tab="materials">Materiais</button></div>
      ${tab==='sections'?sectionsView(s):materialsView(m)}
    </div>`;
    $('#cancel-props',wrap).onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};wrap.querySelectorAll('[data-prop-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.propTab;render()});
    $('#apply-props',wrap).onclick=()=>{for(const sec of p.sections)calcSection(sec);for(const e of p.elements){const sec=p.sections.find(s=>s.id===e.sectionId);if(sec){e.A=sec.A;if(e.type==='frame2d')e.I=sec.I}}p.results=null;p.meta={...(p.meta||{}),updatedAt:new Date().toISOString()};save(normalizeProject(p));location.reload()};
    bindSections();bindMaterials();
  }

  function sectionsView(s){
    return `<div class="property-layout"><aside class="property-list"><div class="row"><h3>Seções</h3><span class="spacer"></span></div>${p.sections.map(x=>`<button class="property-item ${x.id===selectedSection?'active':''}" data-section="${x.id}"><b>${esc(x.name)}</b><small>${x.family||'custom'} · A=${n(x.A).toExponential(3)} m²</small></button>`).join('')}<div class="property-add"><button data-add-section="rect">+ Retangular</button><button data-add-section="circle">+ Circular</button><button data-add-section="i">+ Perfil I</button><button data-add-section="rhs">+ Tubo ret.</button><button data-add-section="custom">+ Custom</button></div></aside><section class="property-editor">${s?`<div class="row"><h3>${esc(s.name)}</h3><span class="spacer"></span><button class="btn small danger" id="delete-section" ${p.sections.length<=1?'disabled':''}>Excluir</button></div><label class="prop-wide">Nome<input id="section-name" value="${esc(s.name)}"></label><label class="prop-wide">Família<select id="section-family"><option value="rect" ${s.family==='rect'?'selected':''}>Retangular</option><option value="circle" ${s.family==='circle'?'selected':''}>Circular</option><option value="i" ${s.family==='i'?'selected':''}>Perfil I genérico</option><option value="rhs" ${s.family==='rhs'?'selected':''}>Tubo retangular</option><option value="truss" ${s.family==='truss'?'selected':''}>Barra axial</option><option value="custom" ${s.family==='custom'||s.family==='steel'?'selected':''}>Custom A/I</option></select></label><div class="geometry-fields">${geometryFields(s)}</div><div class="property-results"><div><small>Área A</small><b>${n(s.A).toExponential(6)} m²</b></div><div><small>Inércia I</small><b>${n(s.I).toExponential(6)} m⁴</b></div></div><div class="section-preview">${sectionPreview(s)}</div><div class="hint">I corresponde ao eixo principal de flexão do pórtico plano. Perfis comerciais reais serão adicionados futuramente em bibliotecas versionadas.</div>`:'<div class="hint">Nenhuma seção.</div>'}</section></div>`;
  }

  function materialsView(m){
    return `<div class="property-layout"><aside class="property-list"><div class="row"><h3>Materiais</h3><span class="spacer"></span><button class="btn small" id="add-material">+ Material</button></div>${p.materials.map(x=>`<button class="property-item ${x.id===selectedMaterial?'active':''}" data-material="${x.id}"><b>${esc(x.name)}</b><small>${x.type} · E=${n(x.E)/1e6} GPa</small></button>`).join('')}</aside><section class="property-editor">${m?`<div class="row"><h3>${esc(m.name)}</h3><span class="spacer"></span><button class="btn small danger" id="delete-material" ${p.materials.length<=1?'disabled':''}>Excluir</button></div><label class="prop-wide">Nome<input id="material-name" value="${esc(m.name)}"></label><label class="prop-wide">Tipo<select id="material-type"><option value="concrete" ${m.type==='concrete'?'selected':''}>Concreto</option><option value="steel" ${m.type==='steel'?'selected':''}>Aço estrutural</option><option value="rebar" ${m.type==='rebar'?'selected':''}>Armadura</option><option value="grout" ${m.type==='grout'?'selected':''}>Graute</option><option value="custom" ${m.type==='custom'?'selected':''}>Custom</option></select></label><div class="material-fields"><label>E [GPa]<input data-mat-field="E" data-scale="1000000" type="number" min="0" step="1" value="${n(m.E)/1e6}"></label><label>ν [-]<input data-mat-field="nu" type="number" min="0" max="0.5" step="0.01" value="${n(m.nu)}"></label><label>γ [kN/m³]<input data-mat-field="density" type="number" min="0" step="0.1" value="${n(m.density)}"></label><label>fy [MPa]<input data-mat-field="fy" type="number" min="0" step="5" value="${n(m.fy)}"></label><label>fu [MPa]<input data-mat-field="fu" type="number" min="0" step="5" value="${n(m.fu)}"></label><label>fck/fc' [MPa]<input data-mat-field="fck" type="number" min="0" step="1" value="${n(m.fck)}"></label></div><div class="warning">Resistências são propriedades de entrada e ainda não representam verificação normativa. O solver linear utiliza atualmente E e γ (no peso próprio).</div>`:'<div class="hint">Nenhum material.</div>'}</section></div>`;
  }

  function sectionPreview(s){
    if(s.family==='circle')return `<svg viewBox="0 0 180 120"><circle cx="90" cy="60" r="43" class="sec-shape"/></svg>`;
    if(s.family==='i')return `<svg viewBox="0 0 180 120"><path d="M45 18 H135 V35 H102 V85 H135 V102 H45 V85 H78 V35 H45 Z" class="sec-shape"/></svg>`;
    if(s.family==='rhs')return `<svg viewBox="0 0 180 120"><rect x="42" y="20" width="96" height="80" class="sec-shape"/><rect x="54" y="32" width="72" height="56" class="sec-hole"/></svg>`;
    return `<svg viewBox="0 0 180 120"><rect x="45" y="20" width="90" height="80" class="sec-shape"/></svg>`;
  }

  function bindSections(){
    wrap.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{selectedSection=b.dataset.section;render()});
    wrap.querySelectorAll('[data-add-section]').forEach(b=>b.onclick=()=>{const family=b.dataset.addSection,id=uid('SEC'),base={id,name:`Nova seção ${p.sections.length+1}`,family,A:.01,I:.0001};if(family==='rect')Object.assign(base,{b:.3,h:.5});if(family==='circle')Object.assign(base,{d:.3});if(family==='i')Object.assign(base,{h:.4,b:.2,tw:.01,tf:.016});if(family==='rhs')Object.assign(base,{h:.2,b:.12,t:.008});calcSection(base);p.sections.push(base);selectedSection=id;render()});
    if(!s)return;$('#section-name',wrap).oninput=e=>{s.name=e.target.value};$('#section-family',wrap).onchange=e=>{s.family=e.target.value;if(s.family==='rect'){s.b=s.b||.3;s.h=s.h||.5}else if(s.family==='circle')s.d=s.d||.3;else if(s.family==='i'){s.h=s.h||.4;s.b=s.b||.2;s.tw=s.tw||.01;s.tf=s.tf||.016}else if(s.family==='rhs'){s.h=s.h||.2;s.b=s.b||.12;s.t=s.t||.008}calcSection(s);render()};
    wrap.querySelectorAll('[data-sec-field]').forEach(input=>input.oninput=()=>{s[input.dataset.secField]=n(input.value);calcSection(s);const out=wrap.querySelector('.property-results');if(out)out.innerHTML=`<div><small>Área A</small><b>${n(s.A).toExponential(6)} m²</b></div><div><small>Inércia I</small><b>${n(s.I).toExponential(6)} m⁴</b></div>`});
    const del=$('#delete-section',wrap);if(del)del.onclick=()=>{if(p.elements.some(e=>e.sectionId===s.id))return alert('A seção está em uso por um ou mais elementos. Troque a seção desses elementos antes de excluir.');p.sections=p.sections.filter(x=>x.id!==s.id);selectedSection=p.sections[0]?.id;render()};
  }

  function bindMaterials(){
    wrap.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>{selectedMaterial=b.dataset.material;render()});
    const add=$('#add-material',wrap);if(add)add.onclick=()=>{const id=uid('MAT');p.materials.push({id,name:`Material ${p.materials.length+1}`,type:'custom',E:200e6,nu:.3,density:78.5,fy:0,fu:0,fck:0,unit:'kN/m²',verified:false});selectedMaterial=id;render()};
    if(!m)return;$('#material-name',wrap).oninput=e=>{m.name=e.target.value};$('#material-type',wrap).onchange=e=>{m.type=e.target.value};wrap.querySelectorAll('[data-mat-field]').forEach(input=>input.oninput=()=>{m[input.dataset.matField]=n(input.value)*(n(input.dataset.scale,1)||1)});
    const del=$('#delete-material',wrap);if(del)del.onclick=()=>{if(p.elements.some(e=>e.materialId===m.id))return alert('O material está em uso por um ou mais elementos. Troque o material desses elementos antes de excluir.');p.materials=p.materials.filter(x=>x.id!==m.id);selectedMaterial=p.materials[0]?.id;render()};
  }
  render();
}

function inject(){const top=document.querySelector('.topbar');if(!top)return;const v=top.querySelector('.brand small');if(v)v.textContent=' v0.6';if(document.querySelector('#property-library'))return;const b=document.createElement('button');b.id='property-library';b.textContent='Propriedades';b.title='Biblioteca de materiais e seções';b.onclick=showPropertyLibrary;const ref=top.querySelector('#advanced-loads')||top.querySelector('#postprocess')||top.querySelector('#vnl')||top.querySelector('.spacer');top.insertBefore(b,ref)}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app'),{childList:true,subtree:true});inject();
