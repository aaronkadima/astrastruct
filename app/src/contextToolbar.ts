export {};

const ROOT='.inspector-panel';

type InspectorEntity={panel:HTMLElement;id:string;type:string;isNode:boolean;is3d:boolean};

const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function directText(label:Element){return [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent||'').join(' ').replace(/\s+/g,' ').trim()}
function field(panel:HTMLElement,prefix:string){return [...panel.querySelectorAll<HTMLLabelElement>('label')].find(l=>directText(l).toLowerCase().startsWith(prefix.toLowerCase()))?.querySelector<HTMLInputElement|HTMLSelectElement>('input,select')||null}
function check(panel:HTMLElement,name:string){return [...panel.querySelectorAll<HTMLLabelElement>('label')].find(l=>l.textContent?.replace(/\s+/g,' ').trim()===name)?.querySelector<HTMLInputElement>('input[type=checkbox]')||null}
function setNativeValue(el:HTMLInputElement|HTMLSelectElement,value:string){
  const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
}
async function setField(el:HTMLInputElement|HTMLSelectElement|null,value:string){if(!el||el.disabled||String(el.value)===String(value))return;setNativeValue(el,value);await nextFrame()}
async function setCheck(el:HTMLInputElement|null,on:boolean){if(!el||el.disabled||el.checked===on)return;el.click();await nextFrame()}
function entity():InspectorEntity|null{
  const panel=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`);if(!panel)return null;
  const id=panel.querySelector<HTMLElement>('.inspector-title b')?.textContent?.trim()||'';
  const type=panel.querySelector<HTMLElement>('.inspector-title small')?.textContent?.trim()||'';
  if(!id||!type)return null;
  const spatial=!!document.querySelector('.spatial3d-canvas');
  return{panel,id,type,isNode:type.toLowerCase()==='nó',is3d:spatial};
}
function supportValue(panel:HTMLElement){
  const ux=!!check(panel,'Ux')?.checked,uy=!!check(panel,'Uy')?.checked,rz=!!check(panel,'Rz')?.checked;
  if(!ux&&!uy&&!rz)return'free';if(!ux&&uy&&!rz)return'roller-y';if(ux&&uy&&!rz)return'pinned';if(ux&&uy&&rz)return'fixed';return'custom';
}
function esc(v:any){return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function selectOptions(source:HTMLSelectElement|null){return source?[...source.options].map(o=>`<option value="${esc(o.value)}"${o.selected?' selected':''}>${esc(o.textContent||o.value)}</option>`).join(''):''}
function numberField(name:string,label:string,value:any,secondary=false){return`<label class="context-field${secondary?' context-secondary':''}"><span>${label}</span><input data-context-${name} type="number" step="any" value="${esc(value)}"></label>`}
function ensureHost(){
  const topbar=document.querySelector<HTMLElement>('.topbar'),tools=topbar?.querySelector<HTMLElement>('.modern-unified-tools');if(!topbar||!tools)return null;
  let host=topbar.querySelector<HTMLElement>('.context-toolbar');if(!host){host=document.createElement('div');host.className='context-toolbar';host.setAttribute('aria-label','Propriedades contextuais');host.setAttribute('data-testid','context-toolbar');tools.insertAdjacentElement('afterend',host)}return host;
}
async function applyNode(host:HTMLElement,e:InspectorEntity){
  const x=host.querySelector<HTMLInputElement>('[data-context-x]'),y=host.querySelector<HTMLInputElement>('[data-context-y]'),fx=host.querySelector<HTMLInputElement>('[data-context-fx]'),fy=host.querySelector<HTMLInputElement>('[data-context-fy]'),preset=host.querySelector<HTMLSelectElement>('[data-context-support]');
  await setField(field(e.panel,'X [m]'),x?.value||'0');await setField(field(e.panel,'Y [m]'),y?.value||'0');
  if(preset&&preset.value!=='custom'){
    const map:Record<string,[boolean,boolean,boolean]>={free:[false,false,false],'roller-y':[false,true,false],pinned:[true,true,false],fixed:[true,true,true]},v=map[preset.value];
    if(v){await setCheck(check(e.panel,'Ux'),v[0]);await setCheck(check(e.panel,'Uy'),v[1]);await setCheck(check(e.panel,'Rz'),v[2])}
  }
  if(fx)await setField(field(e.panel,'Fx [kN]'),fx.value);if(fy)await setField(field(e.panel,'Fy [kN]'),fy.value);
  e.panel.querySelector<HTMLButtonElement>('.inspector-apply')?.click();
}
async function applyElement(host:HTMLElement,e:InspectorEntity){
  const name=host.querySelector<HTMLInputElement>('[data-context-name]'),material=host.querySelector<HTMLSelectElement>('[data-context-material]'),section=host.querySelector<HTMLSelectElement>('[data-context-section]'),qy=host.querySelector<HTMLInputElement>('[data-context-qy]');
  if(name)await setField(field(e.panel,'Nome'),name.value);if(material)await setField(field(e.panel,'Material'),material.value);if(section)await setField(field(e.panel,'Seção'),section.value);if(qy)await setField(field(e.panel,'qy [kN/m]'),qy.value);
  e.panel.querySelector<HTMLButtonElement>('.inspector-apply')?.click();
}
function signature(e:InspectorEntity|null){
  if(!e)return'none';if(e.is3d)return`3d:${e.id}:${e.type}`;
  if(e.isNode)return`node:${e.id}:${field(e.panel,'X [m]')?.value}:${field(e.panel,'Y [m]')?.value}:${supportValue(e.panel)}:${field(e.panel,'Fx [kN]')?.value}:${field(e.panel,'Fy [kN]')?.value}`;
  return`element:${e.id}:${field(e.panel,'Nome')?.value}:${field(e.panel,'Material')?.value}:${field(e.panel,'Seção')?.value}:${field(e.panel,'qy [kN/m]')?.value}`;
}
function render(){
  const host=ensureHost();if(!host)return;const e=entity(),sig=signature(e);if(host.dataset.signature===sig)return;host.dataset.signature=sig;
  if(!e){host.hidden=true;host.innerHTML='';return}host.hidden=false;host.dataset.contextKind=e.isNode?'node':'element';host.dataset.contextId=e.id;
  if(e.is3d){host.innerHTML=`<span class="context-badge"><b>${esc(e.id)}</b><small>${esc(e.type)}</small></span><span class="context-readonly">3D · edição detalhada no Inspector</span>`;return}
  if(e.isNode){
    const x=field(e.panel,'X [m]')?.value??'',y=field(e.panel,'Y [m]')?.value??'',fx=field(e.panel,'Fx [kN]')?.value??0,fy=field(e.panel,'Fy [kN]')?.value??0,support=supportValue(e.panel);
    host.innerHTML=`<span class="context-badge"><b>${esc(e.id)}</b><small>Nó</small></span>${numberField('x','X [m]',x)}${numberField('y','Y [m]',y)}<label class="context-field context-support"><span>Apoio</span><select data-context-support><option value="free">Livre</option><option value="roller-y">Rolete · Uy</option><option value="pinned">Articulado</option><option value="fixed">Engastado</option><option value="custom">Personalizado</option></select></label>${numberField('fx','Fx',fx,true)}${numberField('fy','Fy',fy,true)}<button type="button" class="context-apply" data-testid="context-apply">Aplicar</button>`;
    (host.querySelector('[data-context-support]') as HTMLSelectElement).value=support;
  }else{
    const name=field(e.panel,'Nome') as HTMLInputElement|null,material=field(e.panel,'Material') as HTMLSelectElement|null,section=field(e.panel,'Seção') as HTMLSelectElement|null,qy=field(e.panel,'qy [kN/m]') as HTMLInputElement|null;
    host.innerHTML=`<span class="context-badge"><b>${esc(e.id)}</b><small>${esc(e.type)}</small></span><label class="context-field context-secondary"><span>Nome</span><input data-context-name type="text" value="${esc(name?.value||e.id)}"></label><label class="context-field"><span>Material</span><select data-context-material>${selectOptions(material)}</select></label><label class="context-field"><span>Seção</span><select data-context-section>${selectOptions(section)}</select></label>${qy?numberField('qy','qy',qy.value,true):''}<button type="button" class="context-apply" data-testid="context-apply">Aplicar</button>`;
  }
  host.querySelector<HTMLButtonElement>('.context-apply')?.addEventListener('click',async()=>{host.classList.add('is-applying');try{if(e.isNode)await applyNode(host,e);else await applyElement(host,e)}finally{setTimeout(()=>{host.classList.remove('is-applying');schedule()},0)}});
  host.querySelectorAll<HTMLInputElement>('input').forEach(i=>i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();host.querySelector<HTMLButtonElement>('.context-apply')?.click()}}));
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
new MutationObserver(schedule).observe(document.getElementById('root')!,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
document.addEventListener('change',ev=>{const t=ev.target as Node|null,p=document.querySelector(ROOT);if(t&&p?.contains(t))schedule()});
window.addEventListener('DOMContentLoaded',render);schedule();