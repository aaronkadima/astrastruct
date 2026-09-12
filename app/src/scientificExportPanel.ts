const PREF_KEY='astrastruct.figure.export.v1';
const LAYOUT_KEY='astrastruct.ui.layout.v3';

type Background='canvas'|'white'|'black'|'transparent';
type SourceKind='svg'|'canvas';
type FigurePrefs={widthMm:number;dpi:number;background:Background;fontPt:number;strokePt:number;paddingPct:number;includeGrid:boolean;includeLoads:boolean;includeLabels:boolean;filename:string};
type FigureSource={kind:SourceKind;element:SVGSVGElement|HTMLCanvasElement;label:string;ratio:number};

const defaults:FigurePrefs={widthMm:180,dpi:600,background:'canvas',fontPt:8,strokePt:.5,paddingPct:2,includeGrid:false,includeLoads:true,includeLabels:true,filename:''};
const svgNS='http://www.w3.org/2000/svg';

function readPrefs():FigurePrefs{
  try{return {...defaults,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return {...defaults}}
}
function savePrefs(p:FigurePrefs){localStorage.setItem(PREF_KEY,JSON.stringify(p))}
function slug(v:any){return String(v||'astrastruct').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'astrastruct'}
function projectName(){try{return JSON.parse(localStorage.getItem('astrastruct.project')||'{}')?.name||'astrastruct'}catch{return'astrastruct'}}
function downloadBlob(name:string,blob:Blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},500)}
function visible<T extends Element>(els:NodeListOf<T>){return[...els].find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>2&&r.height>2&&s.display!=='none'&&s.visibility!=='hidden'})||null}
function currentCanvasTheme(){try{return JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')?.canvas||document.documentElement.dataset.canvasTheme||'white'}catch{return document.documentElement.dataset.canvasTheme||'white'}}
function resolveBackground(p:FigurePrefs){return p.background==='canvas'?currentCanvasTheme():p.background}
function source():FigureSource|null{
  const chart=visible(document.querySelectorAll<SVGSVGElement>('.react-modal svg.react-chart'));
  if(chart){const vb=chart.viewBox?.baseVal,r=chart.getBoundingClientRect();return{kind:'svg',element:chart,label:'Gráfico de resultados',ratio:(vb?.height||r.height||1)/Math.max(1,vb?.width||r.width||1)}}
  const model=visible(document.querySelectorAll<SVGSVGElement>('svg.model-canvas'));
  if(model){const vb=model.viewBox?.baseVal,r=model.getBoundingClientRect();return{kind:'svg',element:model,label:'Canvas estrutural 2D',ratio:(vb?.height||r.height||1)/Math.max(1,vb?.width||r.width||1)}}
  const spatial=visible(document.querySelectorAll<HTMLCanvasElement>('.spatial3d-canvas'));
  if(spatial)return{kind:'canvas',element:spatial,label:'Canvas estrutural 3D',ratio:spatial.height/Math.max(1,spatial.width)};
  return null;
}
function inlineStyles(src:Element,clone:Element){
  const props=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','text-anchor','paint-order'];
  const walk=(a:Element,b:Element)=>{const cs=getComputedStyle(a);for(const p of props){const v=cs.getPropertyValue(p);if(v)b.setAttribute(p,v)}const ac=[...a.children],bc=[...b.children];for(let i=0;i<Math.min(ac.length,bc.length);i++)walk(ac[i],bc[i])};walk(src,clone)
}
function parseRgb(v:string){const m=v.match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/i);return m?[+m[1],+m[2],+m[3]]:null}
function luminance(v:string){const rgb=parseRgb(v);if(!rgb)return.5;return(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255}
function improveContrast(svg:SVGSVGElement,bg:Background){
  if(bg==='transparent'||bg==='canvas')return;
  const dark=bg==='black';
  svg.querySelectorAll<SVGElement>('text').forEach(t=>{const fill=t.getAttribute('fill')||'';const lum=luminance(fill);if((dark&&lum<.38)||(!dark&&lum>.72))t.setAttribute('fill',dark?'#f4f5f6':'#20242a');t.setAttribute('paint-order','stroke');t.setAttribute('stroke',dark?'#101113':'#ffffff');t.setAttribute('stroke-width','2')});
}
function applyPublicationStyle(svg:SVGSVGElement,p:FigurePrefs,viewWidth:number){
  const minFont=(p.fontPt*25.4/72)/p.widthMm*viewWidth,minStroke=(p.strokePt*25.4/72)/p.widthMm*viewWidth;
  svg.querySelectorAll<SVGElement>('text').forEach(el=>{const n=parseFloat(el.getAttribute('font-size')||'0');if(!Number.isFinite(n)||n<minFont)el.setAttribute('font-size',minFont.toFixed(3));el.setAttribute('font-family','Arial, Helvetica, sans-serif')});
  svg.querySelectorAll<SVGElement>('line,path,polyline,polygon,circle,rect').forEach(el=>{const stroke=el.getAttribute('stroke');if(!stroke||stroke==='none')return;const n=parseFloat(el.getAttribute('stroke-width')||'0');if(!Number.isFinite(n)||n<minStroke)el.setAttribute('stroke-width',minStroke.toFixed(3))});
}
function buildSvg(p:FigurePrefs){
  const s=source();if(!s||s.kind!=='svg')return null;const src=s.element as SVGSVGElement,clone=src.cloneNode(true) as SVGSVGElement;inlineStyles(src,clone);clone.setAttribute('xmlns',svgNS);
  if(!p.includeGrid)clone.querySelectorAll('.grid-lines').forEach(el=>el.remove());
  if(!p.includeLoads)clone.querySelectorAll('.load,.element-load,[data-testid="nodal-loads"],[data-testid="element-loads"]').forEach(el=>el.remove());
  if(!p.includeLabels)clone.querySelectorAll('.node-label,.element-label,.load-label,.reaction-label,.diagram-label').forEach(el=>el.remove());
  const base=src.viewBox?.baseVal,r=src.getBoundingClientRect(),x=base?.x||0,y=base?.y||0,w=base?.width||r.width||1000,h=base?.height||r.height||680,pad=Math.max(0,p.paddingPct)/100*Math.max(w,h),vx=x-pad,vy=y-pad,vw=w+2*pad,vh=h+2*pad;
  clone.setAttribute('viewBox',`${vx} ${vy} ${vw} ${vh}`);clone.setAttribute('width',`${p.widthMm}mm`);clone.setAttribute('height',`${(p.widthMm*vh/vw).toFixed(3)}mm`);
  clone.removeAttribute('style');
  const bg=resolveBackground(p);if(bg!=='transparent'){const back=document.createElementNS(svgNS,'rect');back.setAttribute('x',String(vx));back.setAttribute('y',String(vy));back.setAttribute('width',String(vw));back.setAttribute('height',String(vh));back.setAttribute('fill',bg==='black'?'#101113':'#ffffff');back.setAttribute('data-scientific-background','true');clone.insertBefore(back,clone.firstChild)}
  applyPublicationStyle(clone,p,vw);improveContrast(clone,bg);
  const meta=document.createElementNS(svgNS,'metadata');meta.textContent=JSON.stringify({generator:'AstraStruct',profile:'scientific-figure',widthMm:p.widthMm,dpi:p.dpi,fontPt:p.fontPt,minStrokePt:p.strokePt,background:bg,exportedAt:new Date().toISOString()});clone.insertBefore(meta,clone.firstChild);
  return{svg:clone,ratio:vh/vw,source:s};
}
function filename(p:FigurePrefs,ext:'svg'|'png'){const base=slug(p.filename||projectName());return`${base}-figura-cientifica-${p.widthMm}mm-${p.dpi}dpi.${ext}`}
function exportSvg(p:FigurePrefs){const built=buildSvg(p);if(!built){alert('A visualização atual é rasterizada. Para o Canvas 3D, utilize PNG.');return}const text='<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(built.svg);downloadBlob(filename(p,'svg'),new Blob([text],{type:'image/svg+xml;charset=utf-8'}))}
function raf(){return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))}
async function exportPng(p:FigurePrefs){
  const s=source();if(!s){alert('Nenhuma figura visível para exportar.');return}const px=Math.max(300,Math.round(p.widthMm/25.4*p.dpi));
  if(s.kind==='svg'){
    const built=buildSvg(p);if(!built)return;const xml=new XMLSerializer().serializeToString(built.svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'})),img=new Image();await new Promise<void>((ok,fail)=>{img.onload=()=>ok();img.onerror=()=>fail(new Error('Falha ao rasterizar SVG'));img.src=url});
    const canvas=document.createElement('canvas');canvas.width=px;canvas.height=Math.max(1,Math.round(px*built.ratio));const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(b=>{if(b)downloadBlob(filename(p,'png'),b)},'image/png');return;
  }
  const canvas3d=s.element as HTMLCanvasElement,current=String(currentCanvasTheme()),requested=resolveBackground(p);if((requested==='white'||requested==='black')&&requested!==current){window.dispatchEvent(new CustomEvent('astrastruct:canvas-theme',{detail:{theme:requested}}));await raf()}
  const out=document.createElement('canvas');out.width=px;out.height=Math.max(1,Math.round(px*s.ratio));const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas3d,0,0,out.width,out.height);if((requested==='white'||requested==='black')&&requested!==current){window.dispatchEvent(new CustomEvent('astrastruct:canvas-theme',{detail:{theme:current}}))}out.toBlob(b=>{if(b)downloadBlob(filename(p,'png'),b)},'image/png')
}
function pixelSummary(p:FigurePrefs,s:FigureSource|null){const w=Math.round(p.widthMm/25.4*p.dpi),h=Math.round(w*(s?.ratio||.68));return`${w.toLocaleString('pt-BR')} × ${h.toLocaleString('pt-BR')} px`}
function option(v:string,label:string,current:any){return`<option value="${v}"${String(current)===v?' selected':''}>${label}</option>`}
function closeDialog(){document.querySelector('.scientific-export-backdrop')?.remove()}
function openDialog(){
  closeDialog();let p=readPrefs();const s=source(),backdrop=document.createElement('div');backdrop.className='scientific-export-backdrop';backdrop.innerHTML=`<section class="scientific-export-dialog" role="dialog" aria-modal="true" aria-label="Exportação de figura científica" data-testid="scientific-export-dialog"><header><div><strong>Figura científica</strong><span>SVG vetorial e PNG de alta resolução</span></div><button type="button" class="scientific-close" aria-label="Fechar">×</button></header><div class="scientific-export-body"><div class="scientific-source"><b>Fonte detectada</b><span data-scientific-source>${s?.label||'Nenhuma figura visível'}</span><small>${s?.kind==='canvas'?'Canvas 3D: exportação raster PNG.':'SVG: exportação vetorial preservada.'}</small></div><div class="scientific-presets"><b>Preset editorial</b><div><button type="button" data-width="90">1 coluna · 90 mm</button><button type="button" data-width="120">Intermediária · 120 mm</button><button type="button" data-width="180">2 colunas · 180 mm</button></div></div><div class="scientific-grid"><label>Largura final [mm]<input data-field="widthMm" data-testid="scientific-width" type="number" min="50" max="220" step="1" value="${p.widthMm}"></label><label>Resolução PNG<select data-field="dpi" data-testid="scientific-dpi">${option('300','300 dpi',p.dpi)}${option('600','600 dpi',p.dpi)}${option('1200','1200 dpi',p.dpi)}</select></label><label>Fundo<select data-field="background" data-testid="scientific-background">${option('canvas','Igual ao Canvas',p.background)}${option('white','Branco',p.background)}${option('black','Preto',p.background)}${option('transparent','Transparente (SVG/2D)',p.background)}</select></label><label>Fonte mínima<select data-field="fontPt">${option('8','8 pt',p.fontPt)}${option('9','9 pt',p.fontPt)}${option('10','10 pt',p.fontPt)}</select></label><label>Traço mínimo<select data-field="strokePt">${option('0.5','0,50 pt',p.strokePt)}${option('0.75','0,75 pt',p.strokePt)}${option('1','1,00 pt',p.strokePt)}</select></label><label>Margem<select data-field="paddingPct">${option('0','0%',p.paddingPct)}${option('2','2%',p.paddingPct)}${option('5','5%',p.paddingPct)}</select></label></div><div class="scientific-toggles"><label><input type="checkbox" data-field="includeGrid"${p.includeGrid?' checked':''}> Grade</label><label><input type="checkbox" data-field="includeLoads"${p.includeLoads?' checked':''}> Cargas</label><label><input type="checkbox" data-field="includeLabels"${p.includeLabels?' checked':''}> Rótulos</label></div><label class="scientific-filename">Nome-base do arquivo<input data-field="filename" type="text" value="${p.filename||slug(projectName())}" placeholder="nome-da-figura"></label><div class="scientific-summary"><span>Saída PNG</span><strong data-scientific-pixels>${pixelSummary(p,s)}</strong><span>Largura física</span><strong data-scientific-mm>${p.widthMm} mm</strong></div><div class="scientific-note">Padrão aplicado: tipografia Arial/Helvetica, fonte mínima configurável, espessura mínima de traço, metadados de exportação e dimensão física em milímetros. Para publicação, 600 dpi é o preset recomendado para linhas e diagramas rasterizados.</div></div><footer><button type="button" data-action="svg" data-testid="scientific-export-svg"${s?.kind==='canvas'||!s?' disabled':''}>Exportar SVG</button><button type="button" data-action="png" data-testid="scientific-export-png"${!s?' disabled':''}>Exportar PNG</button></footer></section>`;document.body.appendChild(backdrop);
  const dialog=backdrop.querySelector<HTMLElement>('.scientific-export-dialog')!,pixels=dialog.querySelector<HTMLElement>('[data-scientific-pixels]')!,mm=dialog.querySelector<HTMLElement>('[data-scientific-mm]')!;
  const sync=()=>{dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-field]').forEach(el=>{const k=el.dataset.field as keyof FigurePrefs;if(el instanceof HTMLInputElement&&el.type==='checkbox')(p as any)[k]=el.checked;else if(['widthMm','dpi','fontPt','strokePt','paddingPct'].includes(String(k)))(p as any)[k]=Number(el.value);else(p as any)[k]=el.value});p.widthMm=Math.max(50,Math.min(220,p.widthMm||180));p.dpi=[300,600,1200].includes(p.dpi)?p.dpi:600;savePrefs(p);pixels.textContent=pixelSummary(p,s);mm.textContent=`${p.widthMm} mm`};
  dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-field]').forEach(el=>el.addEventListener('change',sync));dialog.querySelector<HTMLInputElement>('[data-field="filename"]')?.addEventListener('input',sync);
  dialog.querySelectorAll<HTMLButtonElement>('[data-width]').forEach(b=>b.addEventListener('click',()=>{const input=dialog.querySelector<HTMLInputElement>('[data-field="widthMm"]')!;input.value=b.dataset.width||'180';sync()}));
  dialog.querySelector('.scientific-close')?.addEventListener('click',closeDialog);backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)closeDialog()});
  dialog.querySelector<HTMLButtonElement>('[data-action="svg"]')?.addEventListener('click',()=>{sync();exportSvg(p)});dialog.querySelector<HTMLButtonElement>('[data-action="png"]')?.addEventListener('click',()=>{sync();void exportPng(p)});
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){closeDialog();window.removeEventListener('keydown',esc)}};window.addEventListener('keydown',esc);dialog.querySelector<HTMLElement>('input,select,button')?.focus()
}
function installMenuItem(){
  const menu=[...document.querySelectorAll<HTMLButtonElement>('.modern-menu-button')].find(b=>b.textContent?.trim()==='Exibir'),popup=menu?.parentElement?.querySelector<HTMLElement>('.modern-menu-popup');if(!popup||popup.querySelector('[data-scientific-config]'))return false;
  const firstDirect=[...popup.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('Exportar figura científica'));
  const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.scientificConfig='1';button.innerHTML='<span>Configurar/exportar figura científica…</span><kbd>Ctrl+Shift+E</kbd>';button.addEventListener('click',()=>{popup.parentElement?.classList.remove('open');menu?.setAttribute('aria-expanded','false');openDialog()});if(firstDirect)popup.insertBefore(button,firstDirect);else popup.appendChild(button);return true
}
function install(){if(installMenuItem())return;const obs=new MutationObserver(()=>{if(installMenuItem())obs.disconnect()});obs.observe(document.documentElement,{subtree:true,childList:true});setTimeout(()=>obs.disconnect(),15000)}
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='e'){e.preventDefault();openDialog()}});
install();

export {openDialog as openScientificExportDialog};
