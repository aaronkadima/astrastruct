import React from'react';
import{createRoot,Root}from'react-dom/client';
import{EngineeringRibbon,EngineeringModelExplorer,EngineeringRightRail}from'./EngineeringDesktopChrome';
import{EngineeringResultsWorkbench}from'./EngineeringResultsWorkbench';
import'./engineering-results-workbench.css';
// @ts-ignore
import{normalizeProject}from'../../web/src/core/model.js';
// @ts-ignore
import{withNBR6118Baseline}from'../../web/src/core/nbr6118Baseline.js';
import{currentAnalysisResult,subscribeAnalysisResult}from'./analysisResultBridge';

const STORAGE_KEY='astrastruct.project',PREVIEW_KEY='astrastruct.engineeringDesktopPreview';
const roots=new Map<string,Root>();let project:any=null,result:any=null,started=false;
function previewEnabled(){try{return new URLSearchParams(location.search).get('engineeringDesktop')==='1'||localStorage.getItem(PREVIEW_KEY)==='true'}catch{return false}}
function readProject(){try{return withNBR6118Baseline(normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')))}catch{return withNBR6118Baseline(normalizeProject({}))}}
function commitProject(next:any){project=withNBR6118Baseline(normalizeProject(next));localStorage.setItem(STORAGE_KEY,JSON.stringify(project));window.dispatchEvent(new CustomEvent('astrastruct:project-external-commit',{detail:{project,source:'engineering-desktop'}}));renderAll()}
function clickAria(label:string){const b=[...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(x=>x.getAttribute('aria-label')===label);b?.click()}
function openPanel(name:any){const labels:any={actions:'Casos/combinações',postprocess:'Diagramas/envelopes',properties:'Materiais e seções',analysis:'Tipo de análise',report:'Relatório técnico'};clickAria(labels[name]||String(name))}
function changeScenario(id:string){commitProject({...project,settings:{...(project.settings||{}),analysisScenarioId:id}})}
function analyze(){clickAria('Executar análise')}
function rootFor(id:string,host:Element){let root=roots.get(id);if(!root){root=createRoot(host as HTMLElement);roots.set(id,root)}return root}
function ensureHost(parent:Element,cls:string){let host=parent.querySelector<HTMLElement>(`:scope > .${cls}`);if(host)return host;host=document.createElement('div');host.className=cls;parent.prepend(host);return host}
function ensureRibbon(app:HTMLElement){let host=app.querySelector<HTMLElement>(':scope > .engineering-ribbon-host');if(host)return host;host=document.createElement('div');host.className='engineering-ribbon-host';const top=app.querySelector('.topbar');top?.insertAdjacentElement('afterend',host);return host}
function ensureTopbarActions(app:HTMLElement){
  const top=app.querySelector<HTMLElement>('.topbar');if(!top)return;
  let host=top.querySelector<HTMLElement>(':scope > .engineering-top-actions');
  if(!host){host=document.createElement('div');host.className='engineering-top-actions';top.append(host)}
  host.innerHTML=`<label class="engineering-project-picker"><span>Projeto</span><select aria-label="Projeto atual"><option>${String(project?.name||'Projeto estrutural')}</option></select></label><button type="button" data-eng-top="save"><b>▣</b><span>Salvar</span></button><button type="button" data-eng-top="share"><b>⌯</b><span>Compartilhar</span></button><button type="button" data-eng-top="settings"><b>⚙</b><span>Configurações</span></button><button type="button" data-eng-top="help"><b>?</b><span>Ajuda</span></button><span class="engineering-avatar">AS</span>`;
  host.querySelector<HTMLButtonElement>('[data-eng-top="save"]')?.addEventListener('click',e=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(project));const b=e.currentTarget as HTMLButtonElement;b.dataset.saved='true';setTimeout(()=>delete b.dataset.saved,900)});
  host.querySelector<HTMLButtonElement>('[data-eng-top="share"]')?.addEventListener('click',async()=>{const data={title:`AstraStruct · ${project?.name||'Projeto'}`,text:'Projeto estrutural AstraStruct',url:location.href};try{if(navigator.share)await navigator.share(data);else await navigator.clipboard?.writeText(location.href)}catch{}});
  host.querySelector<HTMLButtonElement>('[data-eng-top="settings"]')?.addEventListener('click',()=>{const b=document.querySelector<HTMLButtonElement>('[aria-label="Configurar Canvas"]');if(b)b.click();else window.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true,bubbles:true}))});
  host.querySelector<HTMLButtonElement>('[data-eng-top="help"]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('astrastruct:help-open',{detail:{source:'engineering-topbar'}})));
}
function renderAll(){const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return;app.classList.add('engineering-desktop');app.dataset.engineeringDesktopPreview='true';project=project||readProject();result=result??currentAnalysisResult();ensureTopbarActions(app);
  const ribbon=ensureRibbon(app),left=app.querySelector('.library-panel'),right=app.querySelector('.inspector-panel'),results=app.querySelector('.results-panel');
  rootFor('ribbon',ribbon).render(<EngineeringRibbon project={project} result={result} activeScenario={project.settings?.analysisScenarioId||project.loadCases?.[0]?.id} onScenarioChange={changeScenario} onAnalyze={analyze} onOpenPanel={openPanel} onCommit={commitProject}/>);
  if(left){const h=ensureHost(left,'engineering-left-host');rootFor('left',h).render(<EngineeringModelExplorer project={project} result={result} onCommit={commitProject}/>)}
  if(right){const h=ensureHost(right,'engineering-right-host');rootFor('right',h).render(<EngineeringRightRail project={project} result={result}/>)}
  if(results){const h=ensureHost(results,'engineering-results-host');rootFor('results',h).render(<EngineeringResultsWorkbench project={project} result={result}/>)}
}
function boot(){if(started||!previewEnabled())return;const app=document.querySelector<HTMLElement>('.astra-app');if(!app){requestAnimationFrame(boot);return}started=true;project=readProject();renderAll();subscribeAnalysisResult(next=>{result=next;renderAll()});window.addEventListener('astrastruct:project-external-commit',(ev:any)=>{project=ev?.detail?.project?withNBR6118Baseline(normalizeProject(ev.detail.project)):readProject();renderAll()});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){project=readProject();renderAll()}});const mo=new MutationObserver(()=>renderAll());mo.observe(app,{childList:true,subtree:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else requestAnimationFrame(boot);
