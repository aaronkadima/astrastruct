// Progressive shell4 mesh refinement controls for Lab & Modelos.
// The numerical operation lives in web/src/core/shellRefinement.js; this file only
// connects it to the persisted React project contract.
// @ts-ignore
import {refineShell4Mesh} from '../../web/src/core/shellRefinement.js';

const STORAGE_KEY='astrastruct.project';
const $=<T extends Element=HTMLElement>(sel:string,root:ParentNode=document)=>root.querySelector(sel) as T|null;
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function current(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function save(p:any){localStorage.setItem(STORAGE_KEY,JSON.stringify(p));location.reload()}
function reportText(r:any){if(!r)return'';const err=100*num(r.areaRelativeError);return`${r.sourceShells} shell(s) → ${r.childShells} subelementos · ${r.createdNodes} nós novos · erro de área ${err.toExponential(2)}%`}

function patch(){
  document.querySelectorAll<HTMLElement>('[data-testid="model-lab-overlay"]').forEach(overlay=>{
    const body=$<HTMLElement>('[data-lab-body]',overlay);if(!body||!body.querySelector('[data-shell-create]')||body.querySelector('[data-shell-refinement]'))return;
    const action=body.querySelector<HTMLElement>('[data-shell-create]')?.closest('.astra-form-actions'),host=document.createElement('section');host.setAttribute('data-shell-refinement','');host.setAttribute('data-testid','shell4-refinement-controls');host.className='astra-model-card';host.style.marginTop='14px';
    const last=current()?.meta?.lastShellRefinementReport;
    host.innerHTML=`<h3>Refinamento de malha shell4</h3><p>Subdivide cada laje do nível selecionado em uma malha Q4 conformante. Nós coincidentes nas bordas entre painéis são compartilhados automaticamente.</p><div class="astra-form-grid"><label>Divisões direção 1<input data-shell-refine-x type="number" min="1" max="20" step="1" value="2"></label><label>Divisões direção 2<input data-shell-refine-y type="number" min="1" max="20" step="1" value="2"></label></div><div class="astra-form-actions"><button class="astra-lab-btn primary" data-testid="refine-shell4-level" data-shell-refine>Refinar lajes do nível</button></div><small data-shell-refine-status>${last?reportText(last):'Pressões superficiais são preservadas como intensidade [kN/m²] em cada subelemento.'}</small>`;
    (action||body).insertAdjacentElement('afterend',host);
    ($<HTMLButtonElement>('[data-shell-refine]',host)!).onclick=()=>{try{const p=current();if(!p)throw new Error('Projeto não carregado.');const levelId=$<HTMLSelectElement>('[data-shell-level]',body)?.value||null,nx=Math.max(1,Math.min(20,Math.round(num($<HTMLInputElement>('[data-shell-refine-x]',host)?.value,2)))),ny=Math.max(1,Math.min(20,Math.round(num($<HTMLInputElement>('[data-shell-refine-y]',host)?.value,2)))),out=refineShell4Mesh(p,{levelId,divisionsX:nx,divisionsY:ny});save(out.project)}catch(err:any){alert(err?.message||String(err))}};
  });
}

const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
