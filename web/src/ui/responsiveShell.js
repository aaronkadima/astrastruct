const host=document.getElementById('app');
const STORAGE_KEY='astrastruct.project';
const LAYOUT_KEY='astrastruct.ui.layout.v1';

const GLYPHS={
  new:'<path d="M7 3.5h8l4 4V20.5H7z"/><path d="M15 3.5v4h4M13 11v6M10 14h6"/>',
  undo:'<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h8a5 5 0 0 1 5 5v1"/>',
  redo:'<path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5h-8a5 5 0 0 0-5 5v1"/>',
  frame:'<path d="M5 20V6h14v14M5 9h14"/><circle cx="5" cy="20" r="1.5"/><circle cx="19" cy="20" r="1.5"/>',
  beam:'<path d="M4 16h16M6 19l-2 2M18 19l2 2"/><path d="M8 4v7m0 0-2-3m2 3 2-3M12 4v7m0 0-2-3m2 3 2-3M16 4v7m0 0-2-3m2 3 2-3"/>',
  truss:'<path d="M4 19 12 5l8 14H4Z M4 19l8-6 8 6M12 5v8"/><circle cx="4" cy="19" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="20" cy="19" r="1.2"/>',
  mixed:'<path d="M5 20V5h14v15M5 9h14M5 20 19 9"/><circle cx="5" cy="20" r="1.3"/><circle cx="19" cy="20" r="1.3"/>',
  cases:'<path d="M5 6h10l4 4v8H5z"/><path d="M8 3h8l4 4v8M8 10h7M8 14h7"/>',
  loads:'<path d="M4 18h16"/><path d="M7 4v9m0 0-2.5-3M7 13l2.5-3M12 4v9m0 0-2.5-3m2.5 3 2.5-3M17 4v9m0 0-2.5-3m2.5 3 2.5-3"/>',
  import:'<path d="M5 4h9l4 4v12H5zM14 4v4h4"/><path d="M12 10v7m0-7-3 3m3-3 3 3"/>',
  export:'<path d="M5 4h9l4 4v12H5zM14 4v4h4"/><path d="M12 17v-7m0 7-3-3m3 3 3-3"/>',
  vector:'<path d="M5 18 9 6l10 5-5 8z"/><circle cx="5" cy="18" r="1.7"/><circle cx="9" cy="6" r="1.7"/><circle cx="19" cy="11" r="1.7"/><circle cx="14" cy="19" r="1.7"/>',
  vnl:'<rect x="3.5" y="5" width="6" height="5" rx="1"/><rect x="14.5" y="14" width="6" height="5" rx="1"/><path d="M9.5 7.5h4a4 4 0 0 1 4 4V14M12 7.5l2-2m-2 2 2 2"/>',
  play:'<path d="M8 5.5 18 12 8 18.5Z"/><path d="M4 4v16"/>',
  chart:'<path d="M4 19h16M5 16c3-1 4-8 7-7s3 6 7 2"/><circle cx="12" cy="9" r="1.2"/>',
  pointload:'<path d="M4 18h16M12 4v9m0 0-3-3m3 3 3-3"/><circle cx="12" cy="18" r="1.4"/>',
  properties:'<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/>',
  report:'<path d="M6 3.5h9l4 4V21H6zM15 3.5v4h4"/><path d="M9 17v-4m3 4V9m3 8v-6"/>',
  stress:'<path d="M5 7h14M5 17h14"/><path d="M8 3v7m0 0-2-3m2 3 2-3M16 21v-7m0 0-2 3m2-3 2 3"/><path d="M11 12h2"/>',
  spring:'<path d="M4 12h3l1.5-4 3 8 3-8 1.5 4h4"/><path d="M18 4v5M18 15v5"/><circle cx="18" cy="12" r="1.5"/>',
  connection:'<path d="M3 12h6M15 12h6"/><circle cx="11" cy="12" r="2"/><circle cx="13" cy="12" r="2"/><path d="m9 7 2 2 2-4 2 4 2-2"/>',
  analysis:'<path d="M4 18h16M6 16V8M10 16v-5M14 16V5M18 16v-8"/><path d="M5 6c4 1 6-3 9-2s3 4 5 3"/>',
  select:'<path d="m5 3 12 9-6 1.5L8.5 19z"/><path d="m11 13.5 4 6"/>',
  node:'<circle cx="12" cy="12" r="4"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  library:'<path d="M4 5.5h5v13H4zM10 5.5h5v13h-5zM16 5.5h4v13h-4z"/><path d="M5 9h3m3 4h3m3-3h2"/>',
  inspector:'<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h7"/><circle cx="17" cy="12" r="1.5"/>',
  results:'<path d="M4 19V9M9 19V5M14 19v-7M19 19V3"/><path d="M3 19h18"/>',
  more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  canvas:'<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><circle cx="16.5" cy="15.5" r="1.5"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>'
};

function icon(name){return `<svg class="astra-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GLYPHS[name]||GLYPHS.more}</svg>`}

const TOP={
  new:['new','Novo projeto'],undo:['undo','Desfazer'],redo:['redo','Refazer'],
  'demo-frame':['frame','Exemplo: pórtico'],'demo-beam':['beam','Exemplo: viga com carga distribuída'],
  'demo-truss':['truss','Exemplo: treliça'],'demo-mixed':['mixed','Exemplo: modelo misto'],'demo-cases':['cases','Exemplo: casos de ação'],
  'load-manager':['loads','Casos de ação e combinações'],import:['import','Importar projeto JSON'],export:['export','Exportar projeto JSON'],
  'export-svg':['vector','Exportar SVG'],vnl:['vnl','Visual Nonlinear Language'],analyze:['play','Executar análise'],
  postprocess:['chart','Diagramas e envelopes'],'advanced-loads':['pointload','Cargas avançadas'],'property-library':['properties','Materiais e seções'],
  report:['report','Relatório técnico'],'stress-panel':['stress','Tensões elásticas'],'mechanics-panel':['spring','Molas e temperatura'],
  'connections-panel':['connection','Ligações de extremidade'],'analysis-panel':['analysis','Tipo de análise']
};
const TOOL={select:['select','Selecionar'],node:['node','Criar nó'],frame2d:['frame','Criar elemento de pórtico'],truss2d:['truss','Criar elemento de treliça']};

function decorate(el,name,label){
  if(!el||el.dataset.astraIcon===name)return;
  el.dataset.astraIcon=name;el.dataset.astraLabel=label;el.setAttribute('aria-label',label);el.setAttribute('title',label);
  el.innerHTML=icon(name)+`<span class="sr-only">${label}</span>`;el.classList.add('icon-control');
}
function decorateControls(){
  for(const [id,[name,label]] of Object.entries(TOP))decorate(document.getElementById(id),name,label);
  document.querySelectorAll('.toolbar [data-tool]').forEach(el=>{const meta=TOOL[el.dataset.tool];if(meta)decorate(el,meta[0],meta[1])});
  const v=document.querySelector('.brand small');if(v)v.textContent=' v0.28 · dev';
}

function readLayout(){try{return {...{left:true,right:true,results:true,focus:false},...JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')}}catch{return{left:true,right:true,results:true,focus:false}}}
function writeLayout(next){localStorage.setItem(LAYOUT_KEY,JSON.stringify(next));applyLayout()}
function applyLayout(){
  const app=document.querySelector('.app');if(!app)return;const s=readLayout();
  app.classList.toggle('astra-left-hidden',!s.left);app.classList.toggle('astra-right-hidden',!s.right);app.classList.toggle('astra-results-hidden',!s.results);app.classList.toggle('astra-canvas-focus',!!s.focus);
  document.querySelectorAll('[data-layout]').forEach(b=>{const k=b.dataset.layout;const pressed=k==='focus'?!!s.focus:!!s[k];b.setAttribute('aria-pressed',String(pressed));b.classList.toggle('active',pressed)});
}
function toggleLayout(key){const s=readLayout();if(key==='focus')s.focus=!s.focus;else s[key]=!s[key];writeLayout(s)}
function resetLayout(){writeLayout({left:true,right:true,results:true,focus:false})}

function safeName(v){return String(v||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'projeto'}
function downloadBlob(name,text,type='application/json'){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function saveNZ(){
  try{
    const project=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!project)throw new Error('Projeto atual indisponível.');
    const nz={format:'AstraStruct NZ',formatVersion:1,application:'AstraStruct',savedAt:new Date().toISOString(),units:project.units||'kN-m-MPa',project};
    downloadBlob(`${safeName(project.name)}.nz`,JSON.stringify(nz,null,2),'application/x-astrastruct+json');
  }catch(err){alert(`Não foi possível salvar o projeto .nz: ${err.message||err}`)}
}
function loadProjectFile(file){
  const reader=new FileReader();reader.onload=()=>{try{
    const raw=JSON.parse(String(reader.result||''));const project=raw?.format==='AstraStruct NZ'&&raw.project?raw.project:raw;
    if(!project||typeof project!=='object'||!Array.isArray(project.nodes)||!Array.isArray(project.elements))throw new Error('Arquivo não contém um projeto AstraStruct válido.');
    localStorage.setItem(STORAGE_KEY,JSON.stringify(project));location.reload();
  }catch(err){alert(`Não foi possível abrir o arquivo: ${err.message||err}`)}};reader.readAsText(file);
}
function trigger(id){const el=document.getElementById(id);if(el)el.click()}

const MENU_GROUPS=[
  ['Arquivo',[
    ['Novo projeto','new','Ctrl+N'],['Abrir projeto .nz','open-nz','Ctrl+O'],['Salvar projeto .nz','save-nz','Ctrl+S'],['sep'],['Importar JSON legado','import'],['Exportar JSON','export'],['Exportar SVG','export-svg']]],
  ['Editar',[[ 'Desfazer','undo','Ctrl+Z'],['Refazer','redo','Ctrl+Y']]],
  ['Exibir',[[ 'Biblioteca lateral','layout-left','Alt+1'],['Inspector lateral','layout-right','Alt+2'],['Painel de resultados','layout-results','Alt+3'],['Canvas ampliado','layout-focus','Alt+0'],['Restaurar painéis','layout-reset']]],
  ['Modelo',[[ 'Casos e combinações','load-manager'],['Cargas avançadas','advanced-loads'],['Materiais e seções','property-library'],['Molas e temperatura','mechanics-panel'],['Ligações','connections-panel'],['VNL','vnl']]],
  ['Análise',[[ 'Executar análise','analyze','F5'],['Configuração da análise','analysis-panel'],['Tensões elásticas','stress-panel'],['Diagramas e envelopes','postprocess']]],
  ['Resultados',[[ 'Mapa / gráfico de tensões','stress-panel'],['Diagramas e envelopes','postprocess'],['Relatório técnico','report']]],
  ['Exemplos',[[ 'Pórtico','demo-frame'],['Viga com carga distribuída','demo-beam'],['Treliça','demo-truss'],['Modelo misto','demo-mixed'],['Casos de ação','demo-cases']]]
];
function menuHtml(){return MENU_GROUPS.map(([title,items],i)=>`<div class="astra-menu"><button class="astra-menu-button" aria-haspopup="true" aria-expanded="false" data-menu="${i}">${title}</button><div class="astra-menu-popup" role="menu">${items.map(item=>item[0]==='sep'?'<div class="astra-menu-sep"></div>':`<button role="menuitem" data-menu-action="${item[1]}"><span>${item[0]}</span>${item[2]?`<kbd>${item[2]}</kbd>`:''}</button>`).join('')}</div></div>`).join('')}
function closeMenus(bar){bar?.querySelectorAll('.astra-menu.open').forEach(x=>{x.classList.remove('open');x.querySelector('.astra-menu-button')?.setAttribute('aria-expanded','false')})}
function menuAction(action,input){
  const map={new:'new',undo:'undo',redo:'redo',import:'import',export:'export','export-svg':'export-svg','load-manager':'load-manager','advanced-loads':'advanced-loads','property-library':'property-library','mechanics-panel':'mechanics-panel','connections-panel':'connections-panel',vnl:'vnl',analyze:'analyze','analysis-panel':'analysis-panel','stress-panel':'stress-panel',postprocess:'postprocess',report:'report','demo-frame':'demo-frame','demo-beam':'demo-beam','demo-truss':'demo-truss','demo-mixed':'demo-mixed','demo-cases':'demo-cases'};
  if(action==='open-nz')return input.click();if(action==='save-nz')return saveNZ();if(action==='layout-left')return toggleLayout('left');if(action==='layout-right')return toggleLayout('right');if(action==='layout-results')return toggleLayout('results');if(action==='layout-focus')return toggleLayout('focus');if(action==='layout-reset')return resetLayout();if(map[action])trigger(map[action]);
}
function ensureMenuBar(app){
  if(app.querySelector('.astra-menubar'))return;
  const bar=document.createElement('nav');bar.className='astra-menubar';bar.setAttribute('aria-label','Menu principal AstraStruct');
  bar.innerHTML=`<div class="astra-menu-left">${menuHtml()}</div><div class="astra-menu-spacer"></div><div class="astra-layout-switches"><button data-layout="left" title="Mostrar/ocultar biblioteca">${icon('library')}</button><button data-layout="right" title="Mostrar/ocultar Inspector">${icon('inspector')}</button><button data-layout="results" title="Mostrar/ocultar resultados">${icon('results')}</button><button data-layout="focus" title="Canvas ampliado">${icon('canvas')}</button></div><span class="astra-dev-badge">DESENVOLVIMENTO</span><input class="astra-open-file" type="file" accept=".nz,.json,application/json,application/x-astrastruct+json" hidden>`;
  app.prepend(bar);const input=bar.querySelector('.astra-open-file');
  bar.querySelectorAll('.astra-menu-button').forEach(b=>b.onclick=e=>{e.stopPropagation();const menu=b.parentElement,open=!menu.classList.contains('open');closeMenus(bar);if(open){menu.classList.add('open');b.setAttribute('aria-expanded','true')}});
  bar.querySelectorAll('[data-menu-action]').forEach(b=>b.onclick=()=>{menuAction(b.dataset.menuAction,input);closeMenus(bar)});
  bar.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>toggleLayout(b.dataset.layout));
  input.onchange=()=>{if(input.files?.[0])loadProjectFile(input.files[0]);input.value=''};
  applyLayout();
}
function relocateCanvasControls(){
  const controls=document.querySelector('.viewport [data-testid="spatial3d-result-controls"]');const toolbar=document.querySelector('.toolbar');
  if(controls&&toolbar&&!controls.dataset.astraRelocated){controls.dataset.astraRelocated='true';controls.classList.add('astra-context-controls');toolbar.appendChild(controls)}
}

function closeMobile(app){app.classList.remove('mobile-library-open','mobile-inspector-open','mobile-results-open','mobile-menu-open')}
function ensureMobileShell(){
  const app=document.querySelector('.app');if(!app)return;
  let scrim=document.getElementById('mobile-scrim');if(!scrim){scrim=document.createElement('button');scrim.id='mobile-scrim';scrim.className='mobile-scrim';scrim.setAttribute('aria-label','Fechar painel');scrim.onclick=()=>closeMobile(app);app.appendChild(scrim)}
  let dock=document.getElementById('mobile-dock');if(!dock){dock=document.createElement('nav');dock.id='mobile-dock';dock.className='mobile-dock';dock.setAttribute('aria-label','Navegação móvel AstraStruct');dock.innerHTML=`<button data-mobile="library" aria-label="Biblioteca" title="Biblioteca">${icon('library')}</button><button data-mobile="canvas" aria-label="Modelo" title="Modelo">${icon('canvas')}</button><button data-mobile="inspector" aria-label="Inspector" title="Inspector">${icon('inspector')}</button><button data-mobile="results" aria-label="Resultados" title="Resultados">${icon('results')}</button><button data-mobile="more" aria-label="Mais comandos" title="Mais comandos">${icon('more')}</button>`;app.appendChild(dock);dock.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>{const action=b.dataset.mobile;if(action==='canvas'){closeMobile(app);return}if(action==='library'){const on=!app.classList.contains('mobile-library-open');closeMobile(app);if(on)app.classList.add('mobile-library-open')}if(action==='inspector'){const on=!app.classList.contains('mobile-inspector-open');closeMobile(app);if(on)app.classList.add('mobile-inspector-open')}if(action==='results'){const on=!app.classList.contains('mobile-results-open');closeMobile(app);if(on)app.classList.add('mobile-results-open')}if(action==='more'){const on=!app.classList.contains('mobile-menu-open');closeMobile(app);if(on)app.classList.add('mobile-menu-open')}updateDock(app)})}
  ensureCommandSheet(app);updateDock(app);
}
function updateDock(app){const states={library:'mobile-library-open',inspector:'mobile-inspector-open',results:'mobile-results-open',more:'mobile-menu-open'};document.querySelectorAll('#mobile-dock [data-mobile]').forEach(b=>b.classList.toggle('active',!!states[b.dataset.mobile]&&app.classList.contains(states[b.dataset.mobile])))}
function ensureCommandSheet(app){
  let sheet=document.getElementById('mobile-command-sheet');if(!sheet){sheet=document.createElement('section');sheet.id='mobile-command-sheet';sheet.className='mobile-command-sheet';sheet.setAttribute('aria-label','Comandos AstraStruct');app.appendChild(sheet)}
  const commands=[...document.querySelectorAll('.topbar button[id]')].filter(b=>TOP[b.id]);const signature=commands.map(b=>b.id).join('|');if(sheet.dataset.signature===signature)return;sheet.dataset.signature=signature;
  sheet.innerHTML=`<div class="mobile-sheet-head"><strong>Comandos</strong><button id="mobile-sheet-close" aria-label="Fechar" title="Fechar">${icon('close')}</button></div><div class="mobile-command-grid">${commands.map(b=>{const [name,label]=TOP[b.id];return `<button data-trigger="${b.id}" aria-label="${label}" title="${label}">${icon(name)}<span class="sr-only">${label}</span></button>`}).join('')}</div>`;
  sheet.querySelector('#mobile-sheet-close').onclick=()=>{app.classList.remove('mobile-menu-open');updateDock(app)};sheet.querySelectorAll('[data-trigger]').forEach(b=>b.onclick=()=>{trigger(b.dataset.trigger);app.classList.remove('mobile-menu-open');updateDock(app)});
}

let queued=false,globalBound=false;
function bindGlobal(){if(globalBound)return;globalBound=true;document.addEventListener('pointerdown',e=>{const bar=document.querySelector('.astra-menubar');if(bar&&!bar.contains(e.target))closeMenus(bar)});document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveNZ();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();document.querySelector('.astra-open-file')?.click();return}
  if(e.altKey&&['0','1','2','3'].includes(e.key)){e.preventDefault();const k={0:'focus',1:'left',2:'right',3:'results'}[e.key];toggleLayout(k);return}
  if(e.key==='F5'){e.preventDefault();trigger('analyze')}
  if(e.key==='Escape'){closeMenus(document.querySelector('.astra-menubar'))}
})}
function enhance(){const app=document.querySelector('.app');if(!app)return;decorateControls();ensureMenuBar(app);ensureMobileShell();relocateCanvasControls();applyLayout();bindGlobal()}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
if(host){new MutationObserver(schedule).observe(host,{childList:true,subtree:true});enhance()}
window.addEventListener('resize',()=>{const app=document.querySelector('.app');if(app&&innerWidth>1100)closeMobile(app)});
