const PREF_KEY='astrastruct.workspace.chrome.v1';
const LAYOUT_KEY='astrastruct.ui.layout.v3';

type WorkspacePrefs={grid:boolean;labels:boolean;axes:boolean;highContrast:boolean;lineScale:number};
const defaults:WorkspacePrefs={grid:true,labels:true,axes:true,highContrast:false,lineScale:1};
const svgNS='http://www.w3.org/2000/svg';

function readPrefs():WorkspacePrefs{
  try{return {...defaults,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {...defaults}}
}
function savePrefs(p:WorkspacePrefs){localStorage.setItem(PREF_KEY,JSON.stringify(p));applyPrefs(p)}
function readProject(){try{return JSON.parse(localStorage.getItem('astrastruct.project')||'{}')}catch{return{}}}
function canvasTheme(){try{return JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')?.canvas||document.documentElement.dataset.canvasTheme||'white'}catch{return document.documentElement.dataset.canvasTheme||'white'}}
function setCanvasTheme(theme:'white'|'black'){
  let state:any={};try{state=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')}catch{}
  state.canvas=theme;localStorage.setItem(LAYOUT_KEY,JSON.stringify(state));
  const app=document.querySelector<HTMLElement>('.astra-app');if(app){app.classList.toggle('canvas-white',theme==='white');app.classList.toggle('canvas-black',theme==='black')}
  document.documentElement.dataset.canvasTheme=theme;
  document.querySelectorAll<HTMLElement>('[data-canvas-theme]').forEach(b=>{const on=b.dataset.canvasTheme===theme;b.classList.toggle('active',on);b.setAttribute('aria-checked',String(on))});
  window.dispatchEvent(new CustomEvent('astrastruct:canvas-theme',{detail:{theme}}));
}

function applyPrefs(p=readPrefs()){
  const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return;
  app.classList.toggle('workspace-grid-off',!p.grid);
  app.classList.toggle('workspace-labels-off',!p.labels);
  app.classList.toggle('workspace-high-contrast',p.highContrast);
  app.dataset.lineScale=String(p.lineScale);
  app.style.setProperty('--workspace-line-scale',String(p.lineScale));
  updateAxes(p);
}

function ensureAxesGroup(svg:SVGSVGElement){
  let g=svg.querySelector<SVGGElement>(':scope > g.workspace-axes');
  if(g)return g;
  g=document.createElementNS(svgNS,'g');g.setAttribute('class','workspace-axes');g.setAttribute('aria-hidden','true');g.setAttribute('pointer-events','none');
  const x=document.createElementNS(svgNS,'line'),y=document.createElementNS(svgNS,'line');x.setAttribute('class','workspace-axis axis-x');y.setAttribute('class','workspace-axis axis-y');
  const tx=document.createElementNS(svgNS,'text'),ty=document.createElementNS(svgNS,'text');tx.setAttribute('class','workspace-axis-label');tx.textContent='X';ty.setAttribute('class','workspace-axis-label');ty.textContent='Y';
  g.append(x,y,tx,ty);svg.insertBefore(g,svg.firstChild);return g;
}
function updateAxes(p=readPrefs()){
  const svg=document.querySelector<SVGSVGElement>('svg.model-canvas');if(!svg)return;
  const old=svg.querySelector<SVGGElement>(':scope > g.workspace-axes');if(!p.axes){old?.remove();return}
  const scale=Number(svg.dataset.cameraScale),cx=Number(svg.dataset.cameraCx),cy=Number(svg.dataset.cameraCy);if(!Number.isFinite(scale)||!Number.isFinite(cx)||!Number.isFinite(cy))return;
  const g=ensureAxesGroup(svg),x0=500-cx*scale,y0=340+cy*scale;
  const [x,y]=[g.querySelector<SVGLineElement>('.axis-x')!,g.querySelector<SVGLineElement>('.axis-y')!];
  x.setAttribute('x1','0');x.setAttribute('x2','1000');x.setAttribute('y1',String(y0));x.setAttribute('y2',String(y0));
  y.setAttribute('x1',String(x0));y.setAttribute('x2',String(x0));y.setAttribute('y1','0');y.setAttribute('y2','680');
  const [tx,ty]=g.querySelectorAll<SVGTextElement>('.workspace-axis-label');
  tx.setAttribute('x','976');tx.setAttribute('y',String(Math.max(18,Math.min(670,y0-8))));
  ty.setAttribute('x',String(Math.max(8,Math.min(974,x0+8))));ty.setAttribute('y','20');
}

function toolName(){
  if(document.querySelector('.spatial3d-canvas'))return'Canvas 3D';
  const svg=document.querySelector<SVGSVGElement>('svg.model-canvas');if(!svg)return'—';
  if(svg.classList.contains('tool-node'))return'Criar nó';if(svg.classList.contains('tool-frame2d'))return'Pórtico 2D';if(svg.classList.contains('tool-truss2d'))return'Treliça 2D';return'Seleção';
}
function selectionName(){
  const node=document.querySelector<SVGCircleElement>('.node.selected')?.closest<SVGGElement>('[data-node-id]')?.dataset.nodeId;if(node)return`Nó ${node}`;
  const member=document.querySelector<SVGLineElement>('.member.selected')?.closest<SVGGElement>('[data-entity="element"]');const label=member?.querySelector<SVGTextElement>('.element-label')?.textContent?.trim();return label?`Elemento ${label}`:'Nenhuma seleção';
}
function statusData(){
  const project=readProject(),hud=document.querySelector<HTMLElement>('.canvas-hud'),spans=hud?[...hud.querySelectorAll('span')]:[],zoom=document.querySelector<HTMLElement>('.canvas-nav .zoom-readout')?.textContent?.trim()||'—',scenario=document.querySelector<HTMLSelectElement>('.scenario-box select')?.selectedOptions?.[0]?.textContent?.trim()||project.settings?.analysisScenarioId||'—';
  return{tool:toolName(),selection:selectionName(),nodes:project.nodes?.length||0,elements:project.elements?.length||0,dimension:document.querySelector('.spatial3d-canvas')?'3D':'2D',coords:spans[0]?.textContent?.trim()||'X — · Y —',grid:spans[1]?.textContent?.trim()||`grade ${project.settings?.grid||.25} m`,zoom,scenario};
}
function setText(el:Element|null,text:string){if(el&&el.textContent!==text)el.textContent=text}
function proxyCanvasNav(label:string){const b=document.querySelector<HTMLButtonElement>(`.canvas-nav button[aria-label="${label}"]`);if(b&&!b.disabled)b.click()}

function ensureStatusBar(){
  const app=document.querySelector<HTMLElement>('.astra-app');if(!app)return null;
  let bar=app.querySelector<HTMLElement>('.workspace-statusbar');if(bar)return bar;
  bar=document.createElement('footer');bar.className='workspace-statusbar';bar.setAttribute('aria-label','Barra de status do workspace');bar.innerHTML=`
    <div class="workspace-status-left"><span class="status-tool" data-ws="tool">Seleção</span><span class="status-divider"></span><span data-ws="selection">Nenhuma seleção</span><span class="status-divider"></span><span data-ws="model">2D · 0 nós · 0 elementos</span></div>
    <div class="workspace-status-center"><span data-ws="coords">X — · Y —</span><span class="status-divider"></span><span data-ws="grid">grade —</span><span class="status-divider"></span><span data-ws="scenario">cenário —</span></div>
    <div class="workspace-status-right"><button type="button" data-ws-action="settings" aria-label="Configurar Canvas" title="Configurar Canvas">Canvas…</button><span class="status-divider"></span><button type="button" data-ws-action="zoomout" aria-label="Afastar" title="Afastar">−</button><strong data-ws="zoom">—</strong><button type="button" data-ws-action="zoomin" aria-label="Aproximar" title="Aproximar">+</button><button type="button" data-ws-action="fit" aria-label="Ajustar à vista" title="Ajustar à vista">Ajustar</button></div>`;
  const dock=app.querySelector('.mobile-dock');app.insertBefore(bar,dock||null);
  bar.querySelector('[data-ws-action="settings"]')?.addEventListener('click',openSettings);
  bar.querySelector('[data-ws-action="zoomout"]')?.addEventListener('click',()=>proxyCanvasNav('Afastar'));
  bar.querySelector('[data-ws-action="zoomin"]')?.addEventListener('click',()=>proxyCanvasNav('Aproximar'));
  bar.querySelector('[data-ws-action="fit"]')?.addEventListener('click',()=>proxyCanvasNav('Ajustar à vista'));
  return bar;
}
function syncStatus(){
  const bar=ensureStatusBar();if(!bar)return;const d=statusData();
  setText(bar.querySelector('[data-ws="tool"]'),d.tool);setText(bar.querySelector('[data-ws="selection"]'),d.selection);setText(bar.querySelector('[data-ws="model"]'),`${d.dimension} · ${d.nodes} nós · ${d.elements} elementos`);setText(bar.querySelector('[data-ws="coords"]'),d.coords);setText(bar.querySelector('[data-ws="grid"]'),d.grid);setText(bar.querySelector('[data-ws="scenario"]'),`cenário ${d.scenario}`);setText(bar.querySelector('[data-ws="zoom"]'),d.zoom);
  const disabled=!document.querySelector('.canvas-nav');bar.querySelectorAll<HTMLButtonElement>('[data-ws-action^="zoom"],[data-ws-action="fit"]').forEach(b=>b.disabled=disabled);updateAxes();
}

function closeSettings(){document.querySelector('.workspace-settings-backdrop')?.remove()}
function openSettings(){
  closeSettings();let p=readPrefs();const theme=canvasTheme(),back=document.createElement('div');back.className='workspace-settings-backdrop';back.innerHTML=`<section class="workspace-settings-dialog" role="dialog" aria-modal="true" aria-label="Configurações do Canvas" data-testid="workspace-settings-dialog"><header><div><strong>Canvas e visualização</strong><span>Preferências do workspace</span></div><button type="button" aria-label="Fechar">×</button></header><div class="workspace-settings-body"><fieldset><legend>Fundo do Canvas</legend><label><input type="radio" name="ws-theme" value="white"${theme==='white'?' checked':''}> Branco</label><label><input type="radio" name="ws-theme" value="black"${theme==='black'?' checked':''}> Preto</label></fieldset><fieldset><legend>Elementos visuais</legend><label><input data-pref="grid" type="checkbox"${p.grid?' checked':''}> Grade</label><label><input data-pref="axes" type="checkbox"${p.axes?' checked':''}> Eixos globais X/Y</label><label><input data-pref="labels" type="checkbox"${p.labels?' checked':''}> Rótulos de nós, barras e resultados</label><label><input data-pref="highContrast" type="checkbox"${p.highContrast?' checked':''}> Contraste técnico elevado</label></fieldset><label class="workspace-setting-select">Espessura visual das linhas<select data-pref="lineScale"><option value="1"${p.lineScale===1?' selected':''}>100% · normal</option><option value="1.25"${p.lineScale===1.25?' selected':''}>125% · apresentação</option><option value="1.5"${p.lineScale===1.5?' selected':''}>150% · projeção</option></select></label><div class="workspace-settings-note">Essas opções afetam apenas a visualização do workspace. Geometria, propriedades, cargas e resultados numéricos do projeto não são alterados.</div></div><footer><button type="button" data-action="reset">Restaurar padrão</button><button type="button" class="primary" data-action="close">Concluir</button></footer></section>`;document.body.appendChild(back);
  const dialog=back.querySelector<HTMLElement>('.workspace-settings-dialog')!;
  const sync=()=>{dialog.querySelectorAll<HTMLInputElement>('[data-pref]').forEach(el=>(p as any)[el.dataset.pref!]=el.checked);const scale=dialog.querySelector<HTMLSelectElement>('[data-pref="lineScale"]');if(scale)p.lineScale=Number(scale.value)||1;savePrefs(p)};
  dialog.querySelectorAll<HTMLInputElement>('[data-pref]').forEach(el=>el.addEventListener('change',sync));dialog.querySelector<HTMLSelectElement>('[data-pref="lineScale"]')?.addEventListener('change',sync);
  dialog.querySelectorAll<HTMLInputElement>('input[name="ws-theme"]').forEach(el=>el.addEventListener('change',()=>setCanvasTheme(el.value as 'white'|'black')));
  dialog.querySelector('[aria-label="Fechar"]')?.addEventListener('click',closeSettings);dialog.querySelector('[data-action="close"]')?.addEventListener('click',closeSettings);dialog.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{p={...defaults};savePrefs(p);setCanvasTheme('white');closeSettings();openSettings()});back.addEventListener('pointerdown',e=>{if(e.target===back)closeSettings()});
}

function ensureViewMenuEntry(){
  const menu=[...document.querySelectorAll<HTMLElement>('.modern-menu')].find(m=>m.querySelector('.modern-menu-button')?.textContent?.trim()==='Exibir');const popup=menu?.querySelector<HTMLElement>('.modern-menu-popup');if(!popup||popup.querySelector('[data-workspace-settings]'))return;
  const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.workspaceSettings='1';b.innerHTML='<span>Configurar Canvas…</span><kbd>Ctrl+,</kbd>';b.addEventListener('click',()=>{menu?.classList.remove('open');menu?.querySelector<HTMLElement>('.modern-menu-button')?.setAttribute('aria-expanded','false');openSettings()});
  const before=popup.querySelector('[data-modern-action="figure:svg"]')?.previousElementSibling||popup.querySelector('[data-modern-action="figure:svg"]');if(before)popup.insertBefore(b,before);else popup.appendChild(b);
}

let queued=false;
function sync(){queued=false;ensureStatusBar();ensureViewMenuEntry();applyPrefs();syncStatus()}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(sync)}
function boot(){
  if(!document.querySelector('.astra-app')){setTimeout(boot,40);return}sync();
  const app=document.querySelector('.astra-app')!;new MutationObserver(schedule).observe(app,{subtree:true,childList:true,attributes:true,characterData:true});
  document.addEventListener('pointermove',e=>{if((e.target as Element)?.closest?.('.viewport'))schedule()},{passive:true});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key===','){e.preventDefault();openSettings()}if(e.key==='Escape'&&document.querySelector('.workspace-settings-backdrop'))closeSettings()});
  window.addEventListener('storage',schedule);setInterval(schedule,700);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

export{};
