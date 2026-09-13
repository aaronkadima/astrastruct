// Automatic shell4 panel fill for the Shell Lab tab.
// @ts-ignore
import { assignLevels } from '../../web/src/core/levels.js';
// @ts-ignore
import { detectRectangularShellCells, addRectangularShellPanels } from '../../web/src/core/shellMesh.js';

const STORAGE_KEY='astrastruct.project';
const $=<T extends Element=HTMLElement>(sel:string,root:ParentNode=document)=>root.querySelector(sel) as T|null;
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function current(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function save(p:any,report:any){p.meta={...(p.meta||{}),lastShellMeshReport:{...report,createdAt:new Date().toISOString()}};localStorage.setItem(STORAGE_KEY,JSON.stringify(p));location.reload()}

function patchButton(create:HTMLButtonElement){
  if(create.parentElement?.querySelector('[data-testid="auto-shell4-panels"]'))return;const body=create.closest<HTMLElement>('[data-lab-body]');if(!body)return;const button=document.createElement('button');button.className='astra-lab-btn';button.setAttribute('data-testid','auto-shell4-panels');button.textContent='Auto preencher vãos';create.parentElement?.insertBefore(button,create.nextSibling);
  const count=()=>{const raw=current(),level=$<HTMLSelectElement>('[data-shell-level]',body);if(!raw||!level)return 0;const p=assignLevels(raw);return detectRectangularShellCells(p,{levelId:level.value,requireBoundaryElements:true}).length};
  const refresh=()=>{const n=count();button.textContent=n?`Auto preencher ${n} vão${n===1?'':'s'}`:'Nenhum vão retangular livre';button.disabled=n===0};refresh();
  $<HTMLSelectElement>('[data-shell-level]',body)?.addEventListener('change',()=>setTimeout(refresh,0));
  button.onclick=()=>{try{const raw=current();if(!raw)throw new Error('Nenhum projeto carregado.');const p=assignLevels(raw),level=$<HTMLSelectElement>('[data-shell-level]',body),material=$<HTMLSelectElement>('[data-shell-material]',body),t=$<HTMLInputElement>('[data-shell-t]',body),pressure=$<HTMLInputElement>('[data-shell-p]',body),kappa=$<HTMLInputElement>('[data-shell-kappa]',body);if(!level||!material||!t||!pressure||!kappa)throw new Error('Controles de laje indisponíveis.');const result=addRectangularShellPanels(p,{levelId:level.value,materialId:material.value,thickness:Math.max(1e-5,num(t.value,.18)),pressure:num(pressure.value),caseId:p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id,shearCorrection:Math.max(.05,Math.min(1,num(kappa.value,5/6))),requireBoundaryElements:true,labelPrefix:'Laje'});save(result.project,result.report)}catch(err:any){alert(err?.message||String(err))}};
}
function patch(){document.querySelectorAll<HTMLButtonElement>('[data-testid="create-shell4"]').forEach(patchButton)}
const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
