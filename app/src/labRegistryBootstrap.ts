import {getIsolatedLabs,LAB_REGISTRY_CHANGED,openIsolatedLab} from './labRegistry';

const ESC=(v:any)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[ch]||ch);
const MANAGED='[data-registered-isolated-lab]';

function isolatedLabHost(overlay:Element){
  const body=overlay.querySelector<HTMLElement>('[data-lab-body]');
  if(!body||!body.querySelector('[data-model="beam"]'))return null;
  return body.querySelector<HTMLElement>('.astra-lab-grid');
}

function renderRegistry(overlay:Element){
  const host=isolatedLabHost(overlay);if(!host)return;
  const registrations=getIsolatedLabs();
  const wanted=new Set(registrations.map(r=>r.id));
  host.querySelectorAll<HTMLElement>(MANAGED).forEach(card=>{if(!wanted.has(card.dataset.registeredIsolatedLab||''))card.remove()});
  for(const reg of registrations){
    let card=host.querySelector<HTMLElement>(`[data-registered-isolated-lab="${reg.id}"]`);
    if(!card){card=document.createElement('article');card.className='astra-model-card';card.dataset.registeredIsolatedLab=reg.id;host.appendChild(card)}
    card.innerHTML=`<h3>${ESC(reg.title)}</h3><p>${ESC(reg.description)}</p><small>${ESC(reg.meta)}</small><button class="astra-lab-btn primary" data-open-registered-lab="${ESC(reg.id)}"${reg.testId?` data-testid="${ESC(reg.testId)}"`:''}>Abrir laboratório</button>`;
    const button=card.querySelector<HTMLButtonElement>('[data-open-registered-lab]');if(button)button.onclick=()=>openIsolatedLab(reg.id);
  }
}

function patch(){document.querySelectorAll('[data-testid="model-lab-overlay"]').forEach(renderRegistry)}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener(LAB_REGISTRY_CHANGED,schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();

export {};
