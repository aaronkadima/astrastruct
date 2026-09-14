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
function previewEnabled(){try{return new URLSearchParams(location.search).get('engineeringDesktop')!=='0'&&localStorage.getItem(PREVIEW_KEY)!=='false'}catch{return true}}
function readProject(){try{return withNBR6118Baseline(normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')))}catch{return withNBR6118Baseline(normalizeProject({}))}}
function commitProject(next:any){project=withNBR6118Baseline(normalizeProject(next));localStorage.setItem(STORAGE_KEY,JSON.stringify(project));window.dispatchEvent(new CustomEvent('astrastruct:project-external-commit',{detail:{project,source:'engineering-desktop'}}));renderAll()}
function clickAria(label:string){const b=[...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(x=>x.getAttribute('aria-label')===label);b?.click()}
function openPanel(name:any){const labels:any={actions:'Casos/combinações',postprocess:'Diagramas/envelopes',properties:'Materiais e seções',analysis:'Tipo de análise',report:'Relatório técnico'};clickAria(labels[name]||String(name))}
function changeScenario(id:string){commitProject({...project,settings:{...(project.settings||{}),analysisScenarioId:id}})}
function analyze(){clickAria('Executar análise')}
function ensureHelp(){
  let dialog=document.querySelector<HTMLDialogElement>('[data-eng-help]');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.dataset.engHelp='true';dialog.className='engineering-help';
  dialog.innerHTML='<form method="dialog"><header><strong>Ajuda · AstraStruct</strong><button aria-label="Fechar ajuda">×</button></header><p><b>Modelagem:</b> escolha uma ferramenta no canvas e clique nos pontos da malha.</p><p><b>Análise:</b> selecione o cenário ou combinação e use “Executar análise”.</p><p><b>Resultados:</b> consulte mapas 3D, reações, esforços, deslocamentos e detalhamento nas abas inferiores.</p><p><b>Atalhos:</b> Ctrl+S salva; Ctrl+Z desfaz; Ctrl+Y refaz; Delete remove a seleção; Ctrl+, configura o canvas.</p><footer><button>Fechar</button></footer></form>';
  document.body.append(dialog);return dialog;
}
function rootFor(id:string,host:Element){let root=roots.get(id);if(!root){root=createRoot(host as HTMLElement);roots.set(id,root)}return root}
function ensureHost(parent:Element,cls:string){let host=parent.querySelector<HTMLElement>(`:scope > .${cls}`);if(host)return host;host=document.createElement('div');host.className=cls;parent.prepend(host);return host}
function ensureRibbon(app:HTMLElement){let host=app.querySelector<HTMLElement>(':scope > .engineering-ribbon-host');if(host)return host;host=document.createElement('div');host.className='engineering-ribbon-host';const top=app.querySelector('.topbar');top?.insertAdjacentElement('afterend',host);return host}
function ensureTopbarActions(app:HTMLElement){
  const top=app.querySelector<HTMLElement>('.topbar');if(!top)return;
  let host=top.querySelector<HTMLElement>(':scope > .engineering-top-actions');
  if(!host){host=document.createElement('div');host.className='engineering-top-actions';top.append(host)}
  const save='<svg viewBox="0 0 18 18"><path d="M3 2h9l3 3v11H3V2zM6 10h6v5H6zM6 2v4h6"/></svg>',share='<svg viewBox="0 0 18 18"><circle cx="14" cy="4" r="2"/><circle cx="4" cy="9" r="2"/><circle cx="14" cy="14" r="2"/><path d="m6 8 6-3M6 10l6 3"/></svg>',settings='<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="3"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42"/></svg>',help='<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="7"/><path d="M6.5 6.5C6.5 5.1 7.6 4 9 4s2.5 1.1 2.5 2.5c0 1.5-2.5 2-2.5 3.5"/><circle class="fill" cx="9" cy="13" r=".9"/></svg>';
  host.innerHTML=`<label class="engineering-project-picker"><span>Projeto</span><select aria-label="Projeto atual"><option>${String(project?.name||'Edifício Residencial')}</option></select></label><i class="eng-top-divider"></i><button type="button" data-eng-top="save">${save}<span>Salvar</span></button><button type="button" data-eng-top="share">${share}<span>Compartilhar</span></button><button type="button" data-eng-top="settings">${settings}<span>Configurações</span></button><button type="button" data-eng-top="help">${help}<span>Ajuda</span></button><span class="engineering-avatar">AS</span>`;
  host.querySelector<HTMLButtonElement>('[data-eng-top="save"]')?.addEventListener('click',e=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(project));const b=e.currentTarget as HTMLButtonElement;b.dataset.saved='true';setTimeout(()=>delete b.dataset.saved,900)});
  host.querySelector<HTMLButtonElement>('[data-eng-top="share"]')?.addEventListener('click',async()=>{const data={title:`AstraStruct · ${project?.name||'Projeto'}`,text:'Projeto estrutural AstraStruct',url:location.href};try{if(navigator.share)await navigator.share(data);else await navigator.clipboard?.writeText(location.href)}catch{}});
  host.querySelector<HTMLButtonElement>('[data-eng-top="settings"]')?.addEventListener('click',()=>{const b=document.querySelector<HTMLButtonElement>('[aria-label="Configurar Canvas"]');if(b)b.click();else window.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true,bubbles:true}))});
  host.querySelector<HTMLButtonElement>('[data-eng-top="help"]')?.addEventListener('click',()=>ensureHelp().showModal());
}
function renderAll(){const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return;app.classList.add('engineering-desktop');app.dataset.engineeringDesktopPreview='true';project=project||readProject();result=result??currentAnalysisResult();ensureTopbarActions(app);
  const ribbon=ensureRibbon(app),left=app.querySelector('.library-panel'),right=app.querySelector('.inspector-panel'),results=app.querySelector('.results-panel');
  rootFor('ribbon',ribbon).render(<EngineeringRibbon project={project} result={result} activeScenario={project.settings?.analysisScenarioId||project.loadCases?.[0]?.id} onScenarioChange={changeScenario} onAnalyze={analyze} onOpenPanel={openPanel} onCommit={commitProject}/>);
  if(left){const h=ensureHost(left,'engineering-left-host');rootFor('left',h).render(<EngineeringModelExplorer project={project} result={result} onCommit={commitProject} onAnalyze={analyze} onOpenPanel={openPanel}/>)}
  if(right){const h=ensureHost(right,'engineering-right-host');rootFor('right',h).render(<EngineeringRightRail project={project} result={result}/>)}
  if(results){const h=ensureHost(results,'engineering-results-host');rootFor('results',h).render(<EngineeringResultsWorkbench project={project} result={result}/>)}
}
function boot(){if(started||!previewEnabled())return;const app=document.querySelector<HTMLElement>('.astra-app');if(!app){requestAnimationFrame(boot);return}started=true;project=readProject();renderAll();subscribeAnalysisResult(next=>{result=next;renderAll()});window.addEventListener('astrastruct:project-external-commit',(ev:any)=>{project=ev?.detail?.project?withNBR6118Baseline(normalizeProject(ev.detail.project)):readProject();renderAll()});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){project=readProject();renderAll()}});const mo=new MutationObserver(()=>renderAll());mo.observe(app,{childList:true,subtree:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else requestAnimationFrame(boot);
