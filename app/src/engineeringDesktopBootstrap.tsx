import React from'react';
import{createRoot,Root}from'react-dom/client';
import{EngineeringRibbon,EngineeringModelExplorer,EngineeringRightRail,EngineeringResultsStrip}from'./EngineeringDesktopChrome';
// @ts-ignore
import{normalizeProject}from'../../web/src/core/model.js';
// @ts-ignore
import{withNBR6118Baseline}from'../../web/src/core/nbr6118Baseline.js';
import{currentAnalysisResult,subscribeAnalysisResult}from'./analysisResultBridge';

const STORAGE_KEY='astrastruct.project';
const roots=new Map<string,Root>();let project:any=null,result:any=null,started=false;
function readProject(){try{return withNBR6118Baseline(normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')))}catch{return withNBR6118Baseline(normalizeProject({}))}}
function commitProject(next:any){project=withNBR6118Baseline(normalizeProject(next));localStorage.setItem(STORAGE_KEY,JSON.stringify(project));window.dispatchEvent(new CustomEvent('astrastruct:project-external-commit',{detail:{project,source:'engineering-desktop'}}));renderAll()}
function clickAria(label:string){const b=[...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(x=>x.getAttribute('aria-label')===label);b?.click()}
function openPanel(name:any){const labels:any={actions:'Casos/combinações',postprocess:'Diagramas/envelopes',properties:'Materiais e seções',analysis:'Tipo de análise',report:'Relatório técnico'};clickAria(labels[name]||String(name))}
function changeScenario(id:string){commitProject({...project,settings:{...(project.settings||{}),analysisScenarioId:id}})}
function analyze(){clickAria('Executar análise')}
function rootFor(id:string,host:Element){let root=roots.get(id);if(!root){root=createRoot(host as HTMLElement);roots.set(id,root)}return root}
function ensureHost(parent:Element,cls:string){let host=parent.querySelector<HTMLElement>(`:scope > .${cls}`);if(host)return host;host=document.createElement('div');host.className=cls;parent.prepend(host);return host}
function ensureRibbon(app:HTMLElement){let host=app.querySelector<HTMLElement>(':scope > .engineering-ribbon-host');if(host)return host;host=document.createElement('div');host.className='engineering-ribbon-host';const top=app.querySelector('.topbar');top?.insertAdjacentElement('afterend',host);return host}
function renderAll(){const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return;app.classList.add('engineering-desktop');project=project||readProject();result=result??currentAnalysisResult();
  const ribbon=ensureRibbon(app),left=app.querySelector('.library-panel'),right=app.querySelector('.inspector-panel'),results=app.querySelector('.results-panel');
  rootFor('ribbon',ribbon).render(<EngineeringRibbon project={project} result={result} activeScenario={project.settings?.analysisScenarioId||project.loadCases?.[0]?.id} onScenarioChange={changeScenario} onAnalyze={analyze} onOpenPanel={openPanel} onCommit={commitProject}/>);
  if(left){const h=ensureHost(left,'engineering-left-host');rootFor('left',h).render(<EngineeringModelExplorer project={project} result={result} onCommit={commitProject}/>)}
  if(right){const h=ensureHost(right,'engineering-right-host');rootFor('right',h).render(<EngineeringRightRail project={project} result={result}/>)}
  if(results){const h=ensureHost(results,'engineering-results-host');rootFor('results',h).render(<EngineeringResultsStrip project={project} result={result}/>)}
}
function boot(){if(started)return;const app=document.querySelector<HTMLElement>('.astra-app');if(!app){requestAnimationFrame(boot);return}started=true;project=readProject();renderAll();subscribeAnalysisResult(next=>{result=next;renderAll()});window.addEventListener('astrastruct:project-external-commit',(ev:any)=>{project=ev?.detail?.project?withNBR6118Baseline(normalizeProject(ev.detail.project)):readProject();renderAll()});window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){project=readProject();renderAll()}});const mo=new MutationObserver(()=>renderAll());mo.observe(app,{childList:true,subtree:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else requestAnimationFrame(boot);
