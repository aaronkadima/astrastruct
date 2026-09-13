// DXF building-launch adapter for the progressive Lab & Modelos shell.
// @ts-ignore
import { dxfToPlan, inspectDxfPlan } from '../../web/src/core/dxfPlan.js';
// @ts-ignore
import { createPlanBuilding3D } from '../../web/src/core/exampleModels.js';

const STORAGE_KEY='astrastruct.project';
const $=<T extends Element=HTMLElement>(sel:string,root:ParentNode=document)=>root.querySelector(sel) as T|null;
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]||ch));

type Parsed={planNodes:any[];planEdges:any[];layers:string[];unitsCode:number;unitsLabel:string;unitScale:number;manualScale:number;tolerance:number;bounds:any;stats:any};

function persistProject(project:any,meta:any){project.meta={...(project.meta||{}),dxfImport:meta};localStorage.setItem(STORAGE_KEY,JSON.stringify(project));location.reload()}

function previewSvg(host:HTMLElement,parsed:Parsed|null){
  const svg=$<SVGSVGElement>('[data-dxf-preview]',host);if(!svg)return;while(svg.firstChild)svg.removeChild(svg.firstChild);if(!parsed)return;
  const ns='http://www.w3.org/2000/svg',W=720,H=400,pad=24,b=parsed.bounds,w=Math.max(1e-9,b.width),h=Math.max(1e-9,b.height),scale=Math.min((W-2*pad)/w,(H-2*pad)/h),cx=(W-w*scale)/2,cy=(H-h*scale)/2;
  const pos=(n:any)=>[cx+(n.x-b.minX)*scale,H-(cy+(n.y-b.minY)*scale)];
  for(const e of parsed.planEdges){const a=parsed.planNodes.find(n=>n.id===e.n1),b2=parsed.planNodes.find(n=>n.id===e.n2);if(!a||!b2)continue;const [x1,y1]=pos(a),[x2,y2]=pos(b2),l=document.createElementNS(ns,'line');l.setAttribute('x1',String(x1));l.setAttribute('y1',String(y1));l.setAttribute('x2',String(x2));l.setAttribute('y2',String(y2));l.setAttribute('stroke','#75b7f2');l.setAttribute('stroke-width','3');l.setAttribute('vector-effect','non-scaling-stroke');svg.appendChild(l)}
  for(const n of parsed.planNodes){const [x,y]=pos(n),c=document.createElementNS(ns,'circle');c.setAttribute('cx',String(x));c.setAttribute('cy',String(y));c.setAttribute('r','4');c.setAttribute('fill','#f4f8ff');c.setAttribute('stroke','#2b69a5');svg.appendChild(c)}
}

function renderDxf(host:HTMLElement){
  host.innerHTML=`<p class="astra-lab-note"><b>Importação DXF:</b> leitura vetorial de LINE, LWPOLYLINE e POLYLINE/VERTEX. Selecione apenas as layers que representam eixos/vigas estruturais; o arquivo original não é alterado.</p>
  <div class="astra-plan-layout"><div class="astra-plan-box"><svg class="astra-plan-svg" data-dxf-preview viewBox="0 0 720 400" aria-label="Pré-visualização DXF"></svg><div class="astra-plan-status"><span data-dxf-status>Nenhum DXF carregado</span><span data-dxf-units>—</span></div></div>
  <div><div class="astra-form-grid" style="grid-template-columns:1fr"><label>Arquivo DXF<input data-testid="dxf-plan-file" data-dxf-file type="file" accept=".dxf,text/plain,application/dxf"></label><label>Escala adicional<input data-dxf-scale type="number" min="0.0000001" step="0.001" value="1"></label><label>Tolerância de união [m]<input data-dxf-tol type="number" min="0.000001" step="0.001" value="0.01"></label><label>Nome do projeto<input data-dxf-name value="Edifício importado de DXF"></label><label>Pavimentos<input data-dxf-storeys type="number" min="1" max="30" value="3"></label><label>Pé-direito [m]<input data-dxf-height type="number" min="0.5" step="0.1" value="3"></label><label>Carga nodal vertical/piso [kN]<input data-dxf-load type="number" step="1" value="-12"></label></div><div data-dxf-layers style="margin-top:12px"></div><div class="astra-form-actions"><button class="astra-lab-btn primary" data-testid="generate-dxf-building" data-dxf-generate disabled>Gerar edifício 3D a partir do DXF</button></div><p class="astra-plan-help">$INSUNITS é respeitado quando presente. Para DXF sem unidade, use “Escala adicional” para converter a geometria para metros. Arcos/bulges não são convertidos automaticamente nesta etapa.</p></div></div>`;
  let text='',fileName='',inspection:any=null,parsed:Parsed|null=null;
  const status=$('[data-dxf-status]',host)!,units=$('[data-dxf-units]',host)!,layersHost=$('[data-dxf-layers]',host)!,generate=$<HTMLButtonElement>('[data-dxf-generate]',host)!;
  const selectedLayers=()=>[...layersHost.querySelectorAll<HTMLInputElement>('input[type=checkbox][data-layer]:checked')].map(x=>x.dataset.layer!);
  const recalc=()=>{if(!text||!inspection)return;try{parsed=dxfToPlan(text,{layers:selectedLayers(),manualScale:Number(($<HTMLInputElement>('[data-dxf-scale]',host)!).value)||1,tolerance:Number(($<HTMLInputElement>('[data-dxf-tol]',host)!).value)||.01,shiftToOrigin:true});status.textContent=`${parsed.stats.nodes} nós · ${parsed.stats.edges} linhas · ${parsed.stats.selectedSegments} segmentos`;units.textContent=`DXF: ${inspection.unitsLabel} → metros`;generate.disabled=false;previewSvg(host,parsed)}catch(err:any){parsed=null;generate.disabled=true;status.textContent=err?.message||String(err);previewSvg(host,null)}};
  const renderLayers=()=>{layersHost.innerHTML=`<b>Layers estruturais</b><div class="check-grid" style="margin-top:7px">${inspection.layers.map((l:string)=>`<label><input type="checkbox" data-layer="${esc(l)}" checked> ${esc(l)}</label>`).join('')}</div><small style="display:block;margin-top:7px;color:#8397af">Entidades suportadas: ${inspection.stats.supportedEntities}; segmentos: ${inspection.stats.segments}${Object.keys(inspection.stats.unsupported||{}).length?` · ignoradas: ${esc(JSON.stringify(inspection.stats.unsupported))}`:''}</small>`;layersHost.querySelectorAll('input[data-layer]').forEach(x=>x.addEventListener('change',recalc));recalc()};
  ($<HTMLInputElement>('[data-dxf-file]',host)!).addEventListener('change',async e=>{const f=(e.currentTarget as HTMLInputElement).files?.[0];if(!f)return;fileName=f.name;text=await f.text();try{inspection=inspectDxfPlan(text);if(!inspection.stats.supportedEntities)throw new Error('DXF sem LINE/LWPOLYLINE/POLYLINE suportadas.');renderLayers()}catch(err:any){inspection=null;parsed=null;generate.disabled=true;status.textContent=err?.message||String(err);layersHost.innerHTML='';previewSvg(host,null)}});
  ($<HTMLInputElement>('[data-dxf-scale]',host)!).addEventListener('change',recalc);($<HTMLInputElement>('[data-dxf-tol]',host)!).addEventListener('change',recalc);
  generate.onclick=()=>{if(!parsed)return;const p=createPlanBuilding3D({name:($<HTMLInputElement>('[data-dxf-name]',host)!).value,planNodes:parsed.planNodes,planEdges:parsed.planEdges,storeys:Number(($<HTMLInputElement>('[data-dxf-storeys]',host)!).value),storeyHeight:Number(($<HTMLInputElement>('[data-dxf-height]',host)!).value),floorLoadPerNode:Number(($<HTMLInputElement>('[data-dxf-load]',host)!).value)});persistProject(p,{fileName,unitsCode:inspection.unitsCode,unitsLabel:inspection.unitsLabel,unitScale:inspection.unitScale,manualScale:parsed.manualScale,tolerance:parsed.tolerance,layers:selectedLayers(),bounds:parsed.bounds,stats:parsed.stats})};
}

function patchLauncher(){
  document.querySelectorAll<HTMLElement>('[data-testid="model-lab-overlay"] .astra-subtabs').forEach(tabs=>{
    if(tabs.querySelector('[data-build-mode="dxf"]'))return;
    const host=tabs.parentElement?.querySelector<HTMLElement>('[data-build-content]');if(!host)return;
    const button=document.createElement('button');button.textContent='Importar DXF';button.dataset.buildMode='dxf';button.setAttribute('data-testid','dxf-import-mode');
    button.addEventListener('click',()=>{tabs.querySelectorAll('button').forEach(b=>b.classList.remove('active'));button.classList.add('active');renderDxf(host)});tabs.appendChild(button);
  });
}
const observer=new MutationObserver(patchLauncher);observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchLauncher,{once:true});else patchLauncher();
