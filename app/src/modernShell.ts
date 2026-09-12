const STORAGE_KEY='astrastruct.project';
const LAYOUT_KEY='astrastruct.ui.layout.v3';

type CanvasTheme='white'|'black';
type LayoutState={left:boolean;right:boolean;results:boolean;focus:boolean;canvas:CanvasTheme};
const defaults:LayoutState={left:true,right:true,results:true,focus:false,canvas:'white'};

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
  app.classList.toggle('canvas-white',state.canvas==='white');app.classList.toggle('canvas-black',state.canvas==='black');
  document.documentElement.dataset.canvasTheme=state.canvas;
  document.querySelectorAll<HTMLElement>('[data-layout-toggle]').forEach(b=>{
    const key=b.dataset.layoutToggle as keyof LayoutState;const on=key==='focus'?state.focus:Boolean(state[key]);b.classList.toggle('active',!!on);b.setAttribute('aria-pressed',String(!!on));
  });
  document.querySelectorAll<HTMLElement>('[data-canvas-theme]').forEach(b=>{
    const on=b.dataset.canvasTheme===state.canvas;b.classList.toggle('active',on);b.setAttribute('aria-checked',String(on));
  });
  window.dispatchEvent(new CustomEvent('astrastruct:canvas-theme',{detail:{theme:state.canvas}}));
}
function toggleLayout(key:'left'|'right'|'results'|'focus'){const s=readLayout();s[key]=!s[key];storeLayout(s)}
function setCanvasTheme(theme:CanvasTheme){const s=readLayout();s.canvas=theme;storeLayout(s)}
function resetLayout(){storeLayout({...defaults})}

function slug(value:any){return String(value||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'projeto'}
function saveBlob(name:string,blob:Blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},500)}
function download(name:string,text:string,type:string){saveBlob(name,new Blob([text],{type}))}
function currentProject(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function saveNz(){
  const project=currentProject();if(!project){alert('Nenhum projeto AstraStruct disponível para salvar.');return}
  const payload={format:'AstraStruct NZ',formatVersion:1,application:'AstraStruct',savedAt:new Date().toISOString(),units:project.units||'kN-m-MPa',project};
  download(`${slug(project.name)}.nz`,JSON.stringify(payload,null,2),'application/x-astrastruct+json');
}
function exportJson(){const p=currentProject();if(p)download(`${slug(p.name)}.json`,JSON.stringify(p,null,2),'application/json')}
function openFile(file:File){const r=new FileReader();r.onload=()=>{try{const raw=JSON.parse(String(r.result||''));const project=raw?.format==='AstraStruct NZ'&&raw.project?raw.project:raw;if(!project||!Array.isArray(project.nodes)||!Array.isArray(project.elements))throw new Error('estrutura de projeto inválida');localStorage.setItem(STORAGE_KEY,JSON.stringify(project));location.reload()}catch(e:any){alert(`Não foi possível abrir o arquivo: ${e?.message||e}`)}};r.readAsText(file)}

function visible<T extends Element>(nodes:NodeListOf<T>|T[]){return [...nodes].find(el=>{const r=(el as HTMLElement|SVGElement).getBoundingClientRect();const s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden'})||null}
function inlineSvgStyles(source:Element,clone:Element){
  const props=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','text-anchor','paint-order'];
  const walk=(s:Element,c:Element)=>{const cs=getComputedStyle(s);for(const p of props){const v=cs.getPropertyValue(p);if(v)c.setAttribute(p,v)}const sa=[...s.children],ca=[...c.children];for(let i=0;i<Math.min(sa.length,ca.length);i++)walk(sa[i],ca[i])};walk(source,clone)
}
function scientificSvg(){
  const source=visible(document.querySelectorAll<SVGSVGElement>('.react-modal svg.react-chart, svg.model-canvas'));
  if(!source)return null;
  const clone=source.cloneNode(true) as SVGSVGElement;inlineSvgStyles(source,clone);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const box=source.viewBox?.baseVal;const rect=source.getBoundingClientRect();const vb=box&&box.width>0?`${box.x} ${box.y} ${box.width} ${box.height}`:`0 0 ${Math.max(1,rect.width)} ${Math.max(1,rect.height)}`;clone.setAttribute('viewBox',vb);clone.removeAttribute('width');clone.removeAttribute('height');
  const nums=vb.split(/\s+/).map(Number),bg=document.documentElement.dataset.canvasTheme==='black'?'#111214':'#ffffff';
  const back=document.createElementNS('http://www.w3.org/2000/svg','rect');back.setAttribute('x',String(nums[0]||0));back.setAttribute('y',String(nums[1]||0));back.setAttribute('width',String(nums[2]||rect.width||1));back.setAttribute('height',String(nums[3]||rect.height||1));back.setAttribute('fill',bg);clone.insertBefore(back,clone.firstChild);
  const meta=document.createElementNS('http://www.w3.org/2000/svg','metadata');meta.textContent='AstraStruct scientific figure export · vector SVG · publication-ready geometry · 180 mm reference width';clone.insertBefore(meta,clone.firstChild);
  return {svg:clone,ratio:(nums[3]||rect.height||1)/(nums[2]||rect.width||1)};
}
function exportScientificSvg(){
  const fig=scientificSvg();if(!fig){if(visible(document.querySelectorAll<HTMLCanvasElement>('.spatial3d-canvas')))alert('O Canvas 3D é rasterizado. Use “PNG científico · 600 dpi”.');else alert('Nenhuma figura SVG visível para exportar.');return}
  const p=currentProject(),text='<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(fig.svg);download(`${slug(p?.name)}-figura-cientifica.svg`,text,'image/svg+xml;charset=utf-8')
}
async function exportScientificPng(){
  const p=currentProject(),targetWidth=4252; // 180 mm a 600 dpi
  const fig=scientificSvg();
  if(fig){const xml=new XMLSerializer().serializeToString(fig.svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'})),img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Falha ao rasterizar SVG'));img.src=url});const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=Math.max(1,Math.round(targetWidth*fig.ratio));const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(b=>{if(b)saveBlob(`${slug(p?.name)}-figura-cientifica-600dpi.png`,b)},'image/png');return}
  const source=visible(document.querySelectorAll<HTMLCanvasElement>('.spatial3d-canvas'));if(!source){alert('Nenhuma figura visível para exportar.');return}const ratio=source.height/Math.max(1,source.width),canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=Math.max(1,Math.round(targetWidth*ratio));const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,canvas.width,canvas.height);canvas.toBlob(b=>{if(b)saveBlob(`${slug(p?.name)}-figura-cientifica-600dpi.png`,b)},'image/png')
}

function buttonByAria(label:string){return document.querySelector<HTMLButtonElement>(`.topbar button[aria-label="${CSS.escape(label)}"], .command-grid button[aria-label="${CSS.escape(label)}"], .workspace-bar button[aria-label="${CSS.escape(label)}"]`)}
function buttonByText(label:string){return [...document.querySelectorAll<HTMLButtonElement>('.library-tools button')].find(b=>b.textContent?.trim()===label)||null}
function clickCommand(label:string){const b=buttonByAria(label)||buttonByText(label);if(b)b.click();else console.warn('AstraStruct menu: comando não localizado',label)}

const fileItems=[['Novo projeto','command:New','Ctrl+N'],['Abrir projeto .nz','file:open','Ctrl+O'],['Salvar projeto .nz','file:save','Ctrl+S'],['separator'],['Importar JSON legado','file:import'],['Exportar JSON','file:json']] as const;
const menuGroups=[
  ['Editar',[[ 'Desfazer','command:Undo','Ctrl+Z'],['Refazer','command:Redo','Ctrl+Y']]],
  ['Exibir',[[ 'Biblioteca','layout:left','Alt+1'],['Inspector','layout:right','Alt+2'],['Painel de resultados','layout:results','Alt+3'],['Canvas ampliado','layout:focus','Alt+0'],['Restaurar painéis','layout:reset'],['separator'],['Canvas · fundo branco','canvas:white'],['Canvas · fundo preto','canvas:black'],['separator'],['Exportar figura científica · SVG vetorial','figure:svg'],['Exportar figura científica · PNG 600 dpi · 180 mm','figure:png']]],
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
  if(action==='figure:svg')return exportScientificSvg();
  if(action==='figure:png'){void exportScientificPng();return}
  if(action.startsWith('canvas:'))return setCanvasTheme(action.slice(7) as CanvasTheme);
  if(action.startsWith('layout:')){const key=action.slice(7);if(key==='reset')return resetLayout();return toggleLayout(key as 'left'|'right'|'results'|'focus')}
}
function closeMenus(bar:HTMLElement){bar.querySelectorAll('.modern-menu.open,.brand.open').forEach(m=>{m.classList.remove('open');m.querySelector<HTMLElement>('[aria-expanded]')?.setAttribute('aria-expanded','false')})}
function menuItems(items:readonly (readonly string[])[]){return items.map(item=>item[0]==='separator'?'<div class="modern-menu-separator"></div>':`<button role="menuitem" data-modern-action="${item[1]}"${String(item[1]).startsWith('canvas:')?` data-canvas-theme="${String(item[1]).slice(7)}" role="menuitemradio"`:''}><span>${item[0]}</span>${item[2]?`<kbd>${item[2]}</kbd>`:''}</button>`).join('')}
function buildMenu(){
  const topbar=document.querySelector<HTMLElement>('.topbar');if(!topbar)return;
  let bar=topbar.querySelector<HTMLElement>('.modern-menubar');
  if(!bar){bar=document.createElement('nav');bar.className='modern-menubar';bar.setAttribute('aria-label','Menus AstraStruct');const groups=menuGroups.map(([title,items],i)=>`<div class="modern-menu"><button class="modern-menu-button" data-menu="${i}" aria-haspopup="true" aria-expanded="false">${title}</button><div class="modern-menu-popup" role="menu">${menuItems(items as any)}</div></div>`).join('');bar.innerHTML=`<div class="modern-menu-groups">${groups}</div><input class="modern-open-file" type="file" accept=".nz,.json,application/json,application/x-astrastruct+json" hidden>`;topbar.insertBefore(bar,topbar.querySelector('.top-actions'))}
  const brand=topbar.querySelector<HTMLElement>('.brand'),mark=brand?.querySelector<HTMLElement>('.brand-mark');if(brand&&mark&&!brand.querySelector('.modern-file-popup')){mark.classList.add('modern-app-menu');mark.setAttribute('role','button');mark.setAttribute('tabindex','0');mark.setAttribute('aria-label','Arquivo');mark.setAttribute('aria-haspopup','true');mark.setAttribute('aria-expanded','false');const popup=document.createElement('div');popup.className='modern-menu-popup modern-file-popup';popup.setAttribute('role','menu');popup.innerHTML=menuItems(fileItems as any);brand.appendChild(popup);const open=()=>{const should=!brand.classList.contains('open');closeMenus(topbar);if(should){brand.classList.add('open');mark.setAttribute('aria-expanded','true')}};mark.addEventListener('click',e=>{e.stopPropagation();open()});mark.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})}
  const input=bar.querySelector<HTMLInputElement>('.modern-open-file')!;
  if(!bar.dataset.bound){bar.dataset.bound='1';bar.querySelectorAll<HTMLButtonElement>('.modern-menu-button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const menu=b.parentElement!;const open=!menu.classList.contains('open');closeMenus(topbar);if(open){menu.classList.add('open');b.setAttribute('aria-expanded','true')}}));input.addEventListener('change',()=>{if(input.files?.[0])openFile(input.files[0]);input.value=''});document.addEventListener('pointerdown',e=>{if(!topbar.contains(e.target as Node))closeMenus(topbar)})}
  topbar.querySelectorAll<HTMLButtonElement>('[data-modern-action]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>{runAction(b.dataset.modernAction!,input);closeMenus(topbar)})});applyLayout();
}

function buildUnifiedTools(){
  const topbar=document.querySelector<HTMLElement>('.topbar'),source=document.querySelector<HTMLElement>('.workspace-bar .model-tools');if(!topbar||!source)return;
  let group=topbar.querySelector<HTMLElement>('.modern-unified-tools');if(!group){group=document.createElement('div');group.className='modern-unified-tools model-tools';group.setAttribute('aria-label','Ferramentas de modelagem e edição');const anchor=topbar.querySelector('.modern-menubar');anchor?.insertAdjacentElement('afterend',group)}
  const signature=[...source.querySelectorAll<HTMLButtonElement>('button')].map(b=>`${b.getAttribute('aria-label')}:${b.classList.contains('active')}`).join('|');if(group.dataset.signature===signature)return;group.dataset.signature=signature;group.innerHTML='';
  const originals=[...source.querySelectorAll<HTMLButtonElement>('button')];originals.forEach((original,index)=>{const clone=original.cloneNode(true) as HTMLButtonElement;clone.removeAttribute('disabled');clone.classList.add('modern-proxy-tool');if(index===4)clone.classList.add('modern-group-start');clone.addEventListener('click',()=>{if(!original.disabled)original.click();setTimeout(schedule,0)});group!.appendChild(clone)});
  if(!originals.length){const badge=document.createElement('span');badge.className='spatial3d-mode-label';badge.textContent='3D';group.appendChild(badge)}
}
function groupPrimaryToolbar(){
  const topbar=document.querySelector<HTMLElement>('.topbar');if(!topbar)return;const actions=topbar.querySelector<HTMLElement>('.top-actions');if(actions){const buttons=[...actions.querySelectorAll<HTMLButtonElement>(':scope > button')];buttons.slice(0,3).forEach(b=>b.classList.add('modern-superseded'));buttons[3]?.classList.add('modern-group-start');buttons[8]?.classList.add('modern-group-start')}
  topbar.querySelector<HTMLButtonElement>(':scope > button[aria-label="Executar análise"]')?.classList.add('modern-group-start');
}
function removeRedundancy(){
  const brand=document.querySelector<HTMLElement>('.brand');brand?.querySelector('div')?.classList.add('modern-brand-copy');
  document.querySelector<HTMLElement>('.workspace-bar')?.classList.add('modern-workspace-bar-retired');
  groupPrimaryToolbar();
}
function enhance(){buildMenu();buildUnifiedTools();applyLayout();removeRedundancy()}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})};
new MutationObserver(schedule).observe(document.getElementById('root')!,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
window.addEventListener('DOMContentLoaded',enhance);schedule();

document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&key==='s'){e.preventDefault();saveNz()}
  else if((e.ctrlKey||e.metaKey)&&key==='o'){e.preventDefault();document.querySelector<HTMLInputElement>('.modern-open-file')?.click()}
  else if(e.altKey&&['0','1','2','3'].includes(e.key)){e.preventDefault();toggleLayout(({0:'focus',1:'left',2:'right',3:'results'} as any)[e.key])}
  else if(e.key==='F5'){e.preventDefault();clickCommand('Executar análise')}
  else if(e.key==='Escape'){const topbar=document.querySelector<HTMLElement>('.topbar');if(topbar)closeMenus(topbar)}
});
