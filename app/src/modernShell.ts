const STORAGE_KEY='astrastruct.project';
const LAYOUT_KEY='astrastruct.ui.layout.v2';

type LayoutState={left:boolean;right:boolean;results:boolean;focus:boolean};
const defaults:LayoutState={left:true,right:true,results:true,focus:false};

const icon=(kind:string)=>{
  const paths:Record<string,string>={
    left:'<path d="M3.5 4.5h17v15h-17zM8 4.5v15"/>',
    right:'<path d="M3.5 4.5h17v15h-17zM16 4.5v15"/>',
    results:'<path d="M3.5 4.5h17v15h-17zM3.5 14h17"/>',
    focus:'<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/>'
  };
  return `<svg class="modern-glyph" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.focus}</svg>`;
};

function readLayout():LayoutState{
  try{return {...defaults,...JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')}}catch{return {...defaults}}
}
function storeLayout(state:LayoutState){localStorage.setItem(LAYOUT_KEY,JSON.stringify(state));applyLayout(state)}
function applyLayout(state=readLayout()){
  const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return;
  app.classList.toggle('ui-hide-left',!state.left);app.classList.toggle('ui-hide-right',!state.right);app.classList.toggle('ui-hide-results',!state.results);app.classList.toggle('ui-canvas-focus',state.focus);
  document.querySelectorAll<HTMLElement>('[data-layout-toggle]').forEach(b=>{
    const key=b.dataset.layoutToggle as keyof LayoutState;const on=key==='focus'?state.focus:state[key];b.classList.toggle('active',!!on);b.setAttribute('aria-pressed',String(!!on));
  });
}
function toggleLayout(key:keyof LayoutState){const s=readLayout();s[key]=!s[key];storeLayout(s)}
function resetLayout(){storeLayout({...defaults})}

function slug(value:any){return String(value||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'projeto'}
function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},400)}
function currentProject(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function saveNz(){
  const project=currentProject();if(!project){alert('Nenhum projeto AstraStruct disponível para salvar.');return}
  const payload={format:'AstraStruct NZ',formatVersion:1,application:'AstraStruct',savedAt:new Date().toISOString(),units:project.units||'kN-m-MPa',project};
  download(`${slug(project.name)}.nz`,JSON.stringify(payload,null,2),'application/x-astrastruct+json');
}
function exportJson(){const p=currentProject();if(p)download(`${slug(p.name)}.json`,JSON.stringify(p,null,2),'application/json')}
function openFile(file:File){const r=new FileReader();r.onload=()=>{try{const raw=JSON.parse(String(r.result||''));const project=raw?.format==='AstraStruct NZ'&&raw.project?raw.project:raw;if(!project||!Array.isArray(project.nodes)||!Array.isArray(project.elements))throw new Error('estrutura de projeto inválida');localStorage.setItem(STORAGE_KEY,JSON.stringify(project));location.reload()}catch(e:any){alert(`Não foi possível abrir o arquivo: ${e?.message||e}`)}};r.readAsText(file)}

function buttonByAria(label:string){return document.querySelector<HTMLButtonElement>(`.topbar button[aria-label="${CSS.escape(label)}"], .command-grid button[aria-label="${CSS.escape(label)}"]`)}
function buttonByText(label:string){return [...document.querySelectorAll<HTMLButtonElement>('.library-tools button')].find(b=>b.textContent?.trim()===label)||null}
function clickCommand(label:string){const b=buttonByAria(label)||buttonByText(label);if(b)b.click();else console.warn('AstraStruct menu: comando não localizado',label)}

const menuGroups=[
  ['Arquivo',[
    ['Novo projeto','command:New','Ctrl+N'],['Abrir projeto .nz','file:open','Ctrl+O'],['Salvar projeto .nz','file:save','Ctrl+S'],['separator'],['Importar JSON legado','file:import'],['Exportar JSON','file:json']]],
  ['Editar',[[ 'Desfazer','command:Undo','Ctrl+Z'],['Refazer','command:Redo','Ctrl+Y']]],
  ['Exibir',[[ 'Biblioteca','layout:left','Alt+1'],['Inspector','layout:right','Alt+2'],['Painel de resultados','layout:results','Alt+3'],['Canvas ampliado','layout:focus','Alt+0'],['Restaurar painéis','layout:reset']]],
  ['Modelo',[[ 'Casos/combinações','panel:Casos/combinações'],['Cargas avançadas','panel:Cargas avançadas'],['Materiais e seções','panel:Materiais e seções'],['Molas e térmica','panel:Molas e térmica'],['Ligações','panel:Ligações'],['VNL','panel:VNL']]],
  ['Análise',[[ 'Executar análise','command:Analyze','F5'],['Tipo de análise','panel:Tipo de análise'],['Estabilidade','command:Stability']]],
  ['Resultados',[[ 'Diagramas/envelopes','panel:Diagramas/envelopes'],['Tensões','panel:Tensões'],['Relatório técnico','panel:Relatório técnico']]],
  ['Exemplos',[[ 'Pórtico demonstrativo','command:Frame'],['Viga com carga distribuída','command:Beam'],['Treliça demonstrativa','command:Truss'],['Modelo misto','command:Mixed'],['Pórtico 3D demonstrativo','command:Frame3D']]]
] as const;

const commandLabels:Record<string,string>={New:'Novo projeto',Undo:'Desfazer',Redo:'Refazer',Analyze:'Executar análise',Stability:'Estabilidade',Frame:'Pórtico demonstrativo',Beam:'Viga com carga distribuída',Truss:'Treliça demonstrativa',Mixed:'Modelo misto',Frame3D:'Pórtico 3D demonstrativo'};
function runAction(action:string,input:HTMLInputElement){
  if(action.startsWith('command:'))return clickCommand(commandLabels[action.slice(8)]||action.slice(8));
  if(action.startsWith('panel:'))return clickCommand(action.slice(6));
  if(action==='file:open')return input.click();
  if(action==='file:save')return saveNz();
  if(action==='file:import'){const legacy=document.querySelector<HTMLInputElement>('.topbar input[type=file]');legacy?.click();return}
  if(action==='file:json')return exportJson();
  if(action.startsWith('layout:')){const key=action.slice(7);if(key==='reset')return resetLayout();return toggleLayout(key as keyof LayoutState)}
}
function closeMenus(bar:HTMLElement){bar.querySelectorAll('.modern-menu.open').forEach(m=>{m.classList.remove('open');m.querySelector('button')?.setAttribute('aria-expanded','false')})}
function buildMenu(){
  if(document.querySelector('.modern-menubar'))return;
  const bar=document.createElement('nav');bar.className='modern-menubar';bar.setAttribute('aria-label','Menu principal AstraStruct');
  const groups=menuGroups.map(([title,items],i)=>`<div class="modern-menu"><button class="modern-menu-button" data-menu="${i}" aria-haspopup="true" aria-expanded="false">${title}</button><div class="modern-menu-popup" role="menu">${items.map(item=>item[0]==='separator'?'<div class="modern-menu-separator"></div>':`<button role="menuitem" data-modern-action="${item[1]}"><span>${item[0]}</span>${item[2]?`<kbd>${item[2]}</kbd>`:''}</button>`).join('')}</div></div>`).join('');
  bar.innerHTML=`<div class="modern-menu-groups">${groups}</div><div class="modern-menu-spacer"></div><div class="modern-layout-actions"><button data-layout-toggle="left" title="Mostrar/ocultar biblioteca" aria-label="Mostrar/ocultar biblioteca">${icon('left')}</button><button data-layout-toggle="right" title="Mostrar/ocultar Inspector" aria-label="Mostrar/ocultar Inspector">${icon('right')}</button><button data-layout-toggle="results" title="Mostrar/ocultar resultados" aria-label="Mostrar/ocultar resultados">${icon('results')}</button><button data-layout-toggle="focus" title="Canvas ampliado" aria-label="Canvas ampliado">${icon('focus')}</button></div><span class="modern-dev-label">DESENVOLVIMENTO</span><input class="modern-open-file" type="file" accept=".nz,.json,application/json,application/x-astrastruct+json" hidden>`;
  document.body.appendChild(bar);const input=bar.querySelector<HTMLInputElement>('.modern-open-file')!;
  bar.querySelectorAll<HTMLButtonElement>('.modern-menu-button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const menu=b.parentElement!;const open=!menu.classList.contains('open');closeMenus(bar);if(open){menu.classList.add('open');b.setAttribute('aria-expanded','true')}}));
  bar.querySelectorAll<HTMLButtonElement>('[data-modern-action]').forEach(b=>b.addEventListener('click',()=>{runAction(b.dataset.modernAction!,input);closeMenus(bar)}));
  bar.querySelectorAll<HTMLButtonElement>('[data-layout-toggle]').forEach(b=>b.addEventListener('click',()=>toggleLayout(b.dataset.layoutToggle as keyof LayoutState)));
  input.addEventListener('change',()=>{if(input.files?.[0])openFile(input.files[0]);input.value=''});applyLayout();
  document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target as Node))closeMenus(bar)});
}

function removeRedundancy(){
  const brand=document.querySelector('.brand small');if(brand)brand.textContent='v0.28 · interface moderna';
  const title=document.querySelector('.workspace-title span');if(title)title.classList.add('modern-readable-meta');
  // The global top bar already exposes undo/redo; keep the modeling bar contextual rather than duplicating them.
  const modeling=document.querySelector('.modeling-bar .model-tools');if(modeling){
    const duplicateButtons=[...modeling.querySelectorAll<HTMLButtonElement>('button[aria-label="Desfazer"],button[aria-label="Refazer"]')];duplicateButtons.forEach(b=>b.classList.add('modern-duplicate-control'));
  }
}
function enhance(){buildMenu();applyLayout();removeRedundancy()}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})};
new MutationObserver(schedule).observe(document.getElementById('root')!,{subtree:true,childList:true});
window.addEventListener('DOMContentLoaded',enhance);schedule();

document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&key==='s'){e.preventDefault();saveNz()}
  else if((e.ctrlKey||e.metaKey)&&key==='o'){e.preventDefault();document.querySelector<HTMLInputElement>('.modern-open-file')?.click()}
  else if(e.altKey&&['0','1','2','3'].includes(e.key)){e.preventDefault();toggleLayout(({0:'focus',1:'left',2:'right',3:'results'} as any)[e.key])}
  else if(e.key==='F5'){e.preventDefault();clickCommand('Executar análise')}
  else if(e.key==='Escape'){const bar=document.querySelector<HTMLElement>('.modern-menubar');if(bar)closeMenus(bar)}
});
