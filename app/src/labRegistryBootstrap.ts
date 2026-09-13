import {getIsolatedLabs,LAB_REGISTRY_CHANGED,openIsolatedLab} from './labRegistry';

const ESC=(v:any)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[ch]||ch);
const MANAGED='[data-registered-isolated-lab]';
const CAPABILITY_NOTE='<b>Lab v0.30.8:</b> <b>Ancoragem / pull-out</b> usa aderência distribuída τ–s e <b>inspection-field/v1</b>. <b>Ligação chapa–parafuso</b> reúne placa rígida, contato circular com <b>folga radial</b>, <b>furo oblongo</b> orientável, <b>chapa flexível Q4</b> e <b>furo circular explicitamente vazado</b> por cut-cell. <b>Punção</b> fornece demanda V/Mx/My e mapa τ(s). Resistências normativas permanecem separadas no RuleEngine.';

function isolatedLabHost(overlay:Element){const body=overlay.querySelector<HTMLElement>('[data-lab-body]');if(!body||!body.querySelector('[data-model="beam"]'))return null;return body.querySelector<HTMLElement>('.astra-lab-grid')}
function registrationSignature(reg:ReturnType<typeof getIsolatedLabs>[number]){return JSON.stringify([reg.id,reg.title,reg.description,reg.meta,reg.order??100,reg.testId??''])}
function renderRegistry(overlay:Element){
  const host=isolatedLabHost(overlay);if(!host)return;const note=host.parentElement?.querySelector<HTMLElement>('.astra-lab-note');if(note&&note.dataset.registryCapability!=='0308'){note.dataset.registryCapability='0308';note.innerHTML=CAPABILITY_NOTE}
  const registrations=getIsolatedLabs(),wanted=new Set(registrations.map(r=>r.id));host.querySelectorAll<HTMLElement>(MANAGED).forEach(card=>{if(!wanted.has(card.dataset.registeredIsolatedLab||''))card.remove()});
  for(const reg of registrations){let card=host.querySelector<HTMLElement>(`[data-registered-isolated-lab="${reg.id}"]`),created=false;if(!card){card=document.createElement('article');card.className='astra-model-card';card.dataset.registeredIsolatedLab=reg.id;created=true}const signature=registrationSignature(reg);if(card.dataset.registrySignature!==signature){card.dataset.registrySignature=signature;card.innerHTML=`<h3>${ESC(reg.title)}</h3><p>${ESC(reg.description)}</p><small>${ESC(reg.meta)}</small><button class="astra-lab-btn primary" data-open-registered-lab="${ESC(reg.id)}"${reg.testId?` data-testid="${ESC(reg.testId)}"`:''}>Abrir laboratório</button>`;const button=card.querySelector<HTMLButtonElement>('[data-open-registered-lab]');if(button)button.onclick=()=>openIsolatedLab(reg.id)}if(created)host.appendChild(card)}
}
function patch(){document.querySelectorAll('[data-testid="model-lab-overlay"]').forEach(renderRegistry)}let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener(LAB_REGISTRY_CHANGED,schedule);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
export {};
