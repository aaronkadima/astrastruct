export {};

const ROOT='.inspector-panel';

type InspectorEntity={panel:HTMLElement;id:string;type:string;isNode:boolean;is3d:boolean};

const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function directText(label:Element){return [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent||'').join(' ').replace(/\s+/g,' ').trim()}
function field(panel:HTMLElement,prefix:string){return [...panel.querySelectorAll<HTMLLabelElement>('label')].find(l=>directText(l).toLowerCase().startsWith(prefix.toLowerCase()))?.querySelector<HTMLInputElement|HTMLSelectElement>('input,select')||null}
function check(panel:HTMLElement,name:string){const target=name.toLowerCase();return [...panel.querySelectorAll<HTMLLabelElement>('label')].find(l=>l.textContent?.replace(/\s+/g,' ').trim().toLowerCase()===target)?.querySelector<HTMLInputElement>('input[type=checkbox]')||null}
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
  const spatial=panel.classList.contains('spatial-inspector')||!!document.querySelector('.spatial3d-canvas');
  return{panel,id,type,isNode:type.toLowerCase().startsWith('nó'),is3d:spatial};
}
function supportValue2D(panel:HTMLElement){
  const ux=!!check(panel,'Ux')?.checked,uy=!!check(panel,'Uy')?.checked,rz=!!check(panel,'Rz')?.checked;
  if(!ux&&!uy&&!rz)return'free';if(!ux&&uy&&!rz)return'roller-y';if(ux&&uy&&!rz)return'pinned';if(ux&&uy&&rz)return'fixed';return'custom';
}
function supportValue3D(panel:HTMLElement){
  const values=['ux','uy','uz','rx','ry','rz'].map(k=>!!check(panel,k)?.checked);
  if(values.every(v=>!v))return'free';
  if(values.slice(0,3).every(Boolean)&&values.slice(3).every(v=>!v))return'pinned3d';
  if(values.every(Boolean))return'fixed3d';
  return'custom';
}
function esc(v:any){return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function selectOptions(source:HTMLSelectElement|null){return source?[...source.options].map(o=>`<option value="${esc(o.value)}"${o.selected?' selected':''}>${esc(o.textContent||o.value)}</option>`).join(''):''}
function numberField(name:string,label:string,value:any,secondary=false){return`<label class="context-field${secondary?' context-secondary':''}"><span>${label}</span><input data-context-${name} type="number" step="any" value="${esc(value)}"></label>`}
function ensureHost(){
  const topbar=document.querySelector<HTMLElement>('.topbar'),tools=topbar?.querySelector<HTMLElement>('.modern-unified-tools');if(!topbar||!tools)return null;
  let host=topbar.querySelector<HTMLElement>('.context-toolbar');if(!host){host=document.createElement('div');host.className='context-toolbar';host.setAttribute('aria-label','Propriedades contextuais');host.setAttribute('data-testid','context-toolbar');tools.insertAdjacentElement('afterend',host)}return host;
}
async function applyFreshInspector(){await nextFrame();await nextFrame();document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)?.querySelector<HTMLButtonElement>('.inspector-apply')?.click()}
async function applyNode(host:HTMLElement,e:InspectorEntity){
  const x=host.querySelector<HTMLInputElement>('[data-context-x]'),y=host.querySelector<HTMLInputElement>('[data-context-y]'),z=host.querySelector<HTMLInputElement>('[data-context-z]'),fx=host.querySelector<HTMLInputElement>('[data-context-fx]'),fy=host.querySelector<HTMLInputElement>('[data-context-fy]'),fz=host.querySelector<HTMLInputElement>('[data-context-fz]'),preset=host.querySelector<HTMLSelectElement>('[data-context-support]');
  await setField(field(e.panel,'X [m]'),x?.value||'0');await setField(field(e.panel,'Y [m]'),y?.value||'0');if(e.is3d&&z)await setField(field(e.panel,'Z [m]'),z.value||'0');
  if(preset&&preset.value!=='custom'){
    if(e.is3d){
      const map:Record<string,[boolean,boolean,boolean,boolean,boolean,boolean]>={free:[false,false,false,false,false,false],pinned3d:[true,true,true,false,false,false],fixed3d:[true,true,true,true,true,true]},v=map[preset.value];
      if(v){for(const [i,k] of ['ux','uy','uz','rx','ry','rz'].entries())await setCheck(check(document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||e.panel,k),v[i])}
    }else{
      const fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||e.panel,map:Record<string,[boolean,boolean,boolean]>={free:[false,false,false],'roller-y':[false,true,false],pinned:[true,true,false],fixed:[true,true,true]},v=map[preset.value];
      if(v){await setCheck(check(fresh,'Ux'),v[0]);await setCheck(check(fresh,'Uy'),v[1]);await setCheck(check(fresh,'Rz'),v[2])}
    }
  }
  const fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||e.panel;
  if(fx)await setField(field(fresh,'Fx [kN]'),fx.value);if(fy)await setField(field(fresh,'Fy [kN]'),fy.value);if(e.is3d&&fz)await setField(field(fresh,'Fz [kN]'),fz.value);
  await applyFreshInspector();
}
async function applyElement(host:HTMLElement,e:InspectorEntity){
  const name=host.querySelector<HTMLInputElement>('[data-context-name]'),material=host.querySelector<HTMLSelectElement>('[data-context-material]'),section=host.querySelector<HTMLSelectElement>('[data-context-section]'),qy=host.querySelector<HTMLInputElement>('[data-context-qy]'),qz=host.querySelector<HTMLInputElement>('[data-context-qz]');
  let fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||e.panel;
  if(name)await setField(field(fresh,'Nome'),name.value);fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||fresh;if(material)await setField(field(fresh,'Material'),material.value);fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||fresh;if(section)await setField(field(fresh,'Seção'),section.value);fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||fresh;if(qy)await setField(field(fresh,'qy [kN/m]'),qy.value);fresh=document.querySelector<HTMLElement>(`${ROOT} .react-inspector`)||fresh;if(e.is3d&&qz)await setField(field(fresh,'qz [kN/m]'),qz.value);
  await applyFreshInspector();
}
function signature(e:InspectorEntity|null){
  if(!e)return'none';
  if(e.isNode){
    const support=e.is3d?supportValue3D(e.panel):supportValue2D(e.panel);
    return`${e.is3d?'node3d':'node'}:${e.id}:${field(e.panel,'X [m]')?.value}:${field(e.panel,'Y [m]')?.value}:${e.is3d?field(e.panel,'Z [m]')?.value:''}:${support}:${field(e.panel,'Fx [kN]')?.value}:${field(e.panel,'Fy [kN]')?.value}:${e.is3d?field(e.panel,'Fz [kN]')?.value:''}`;
  }
  return`${e.is3d?'element3d':'element'}:${e.id}:${field(e.panel,'Nome')?.value}:${field(e.panel,'Material')?.value}:${field(e.panel,'Seção')?.value}:${field(e.panel,'qy [kN/m]')?.value}:${e.is3d?field(e.panel,'qz [kN/m]')?.value:''}`;
}
function render(){
  const host=ensureHost();if(!host)return;const e=entity(),sig=signature(e);if(host.dataset.signature===sig)return;host.dataset.signature=sig;
  if(!e){host.hidden=true;host.innerHTML='';return}host.hidden=false;host.dataset.contextKind=e.isNode?'node':'element';host.dataset.contextId=e.id;host.dataset.contextDimension=e.is3d?'3d':'2d';
  if(e.isNode){
    const x=field(e.panel,'X [m]')?.value??'',y=field(e.panel,'Y [m]')?.value??'',z=field(e.panel,'Z [m]')?.value??'',fx=field(e.panel,'Fx [kN]')?.value??0,fy=field(e.panel,'Fy [kN]')?.value??0,fz=field(e.panel,'Fz [kN]')?.value??0,support=e.is3d?supportValue3D(e.panel):supportValue2D(e.panel);
    const options=e.is3d?'<option value="free">Livre</option><option value="pinned3d">Articulado 3D</option><option value="fixed3d">Engastado 3D</option><option value="custom">Personalizado</option>':'<option value="free">Livre</option><option value="roller-y">Rolete · Uy</option><option value="pinned">Articulado</option><option value="fixed">Engastado</option><option value="custom">Personalizado</option>';
    host.innerHTML=`<span class="context-badge"><b>${esc(e.id)}</b><small>${e.is3d?'Nó 3D':'Nó'}</small></span>${numberField('x','X [m]',x)}${numberField('y','Y [m]',y)}${e.is3d?numberField('z','Z [m]',z):''}<label class="context-field context-support"><span>Apoio</span><select data-context-support>${options}</select></label>${numberField('fx','Fx',fx,true)}${numberField('fy','Fy',fy,true)}${e.is3d?numberField('fz','Fz',fz,true):''}<button type="button" class="context-apply" data-testid="context-apply">Aplicar</button>`;
    (host.querySelector('[data-context-support]') as HTMLSelectElement).value=support;
  }else{
    const name=field(e.panel,'Nome') as HTMLInputElement|null,material=field(e.panel,'Material') as HTMLSelectElement|null,section=field(e.panel,'Seção') as HTMLSelectElement|null,qy=field(e.panel,'qy [kN/m]') as HTMLInputElement|null,qz=field(e.panel,'qz [kN/m]') as HTMLInputElement|null;
    host.innerHTML=`<span class="context-badge"><b>${esc(e.id)}</b><small>${esc(e.type)}</small></span><label class="context-field context-secondary"><span>Nome</span><input data-context-name type="text" value="${esc(name?.value||e.id)}"></label><label class="context-field"><span>Material</span><select data-context-material>${selectOptions(material)}</select></label><label class="context-field"><span>Seção</span><select data-context-section>${selectOptions(section)}</select></label>${qy?numberField('qy','qy',qy.value,true):''}${e.is3d&&qz?numberField('qz','qz',qz.value,true):''}<button type="button" class="context-apply" data-testid="context-apply">Aplicar</button>`;
  }
  host.querySelector<HTMLButtonElement>('.context-apply')?.addEventListener('click',async()=>{host.classList.add('is-applying');try{if(e.isNode)await applyNode(host,e);else await applyElement(host,e)}finally{setTimeout(()=>{host.classList.remove('is-applying');schedule()},0)}});
  host.querySelectorAll<HTMLInputElement>('input').forEach(i=>i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();host.querySelector<HTMLButtonElement>('.context-apply')?.click()}}));
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
new MutationObserver(schedule).observe(document.getElementById('root')!,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
document.addEventListener('change',ev=>{const t=ev.target as Node|null,p=document.querySelector(ROOT);if(t&&p?.contains(t))schedule()});
window.addEventListener('DOMContentLoaded',render);schedule();