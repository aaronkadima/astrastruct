// Storey/level manager injected into Lab & Modelos without duplicating the React shell.
// @ts-ignore
import { assignLevels, deriveLevels, duplicateLevel, levelSummary } from '../../web/src/core/levels.js';

const STORAGE_KEY='astrastruct.project';
const $=<T extends Element=HTMLElement>(sel:string,root:ParentNode=document)=>root.querySelector(sel) as T|null;
function current(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function save(p:any){localStorage.setItem(STORAGE_KEY,JSON.stringify(p));location.reload()}
function fmt(v:any){return Number(v||0).toFixed(3)}

function renderLevels(body:HTMLElement){
  const raw=current();if(!raw){body.innerHTML='<p class="astra-lab-note">Nenhum projeto carregado.</p>';return}
  const p=assignLevels(raw),summary=levelSummary(p),levels=deriveLevels(p),last=levels[levels.length-1],prev=levels[levels.length-2],step=prev?Math.max(.1,last.elevation-prev.elevation):3,nextZ=(last?.elevation||0)+step;
  body.innerHTML=`<p class="astra-lab-note"><b>Níveis e pavimentos:</b> níveis são associados pela coordenada Z. É possível duplicar toda a malha horizontal de um pavimento e criar automaticamente os pilares até o novo nível.</p>
  <div class="table-wrap"><table><thead><tr><th>Nível</th><th>Elevação [m]</th><th>Nós</th><th>Elementos horizontais</th></tr></thead><tbody>${summary.map((l:any)=>`<tr><td>${l.name}</td><td>${fmt(l.elevation)}</td><td>${l.nodeCount}</td><td>${l.horizontalElementCount}</td></tr>`).join('')}</tbody></table></div>
  <div class="astra-form-grid" style="margin-top:14px"><label>Pavimento de origem<select data-level-source>${levels.map((l:any)=>`<option value="${l.id}" ${l.id===last?.id?'selected':''}>${l.name} · Z=${fmt(l.elevation)} m</option>`).join('')}</select></label><label>Nome do novo nível<input data-level-name value="Pavimento ${levels.length}"></label><label>Elevação do novo nível [m]<input data-level-z type="number" step="0.1" value="${nextZ}"></label><label style="align-content:end"><span><input data-level-columns type="checkbox" checked> Criar pilares entre os níveis</span></label><label style="align-content:end"><span><input data-level-loads type="checkbox" checked> Copiar cargas do pavimento</span></label></div>
  <div class="astra-form-actions"><button class="astra-lab-btn primary" data-testid="duplicate-level">Duplicar pavimento</button><button class="astra-lab-btn" data-testid="rebuild-levels">Recalcular níveis por Z</button></div>
  <p class="astra-plan-help">Na duplicação, vigas/elementos inteiramente contidos no nível de origem são copiados. Os pilares novos usam como referência o primeiro elemento vertical frame3d existente; seções continuam editáveis no Inspector.</p>`;
  ($<HTMLButtonElement>('[data-testid="rebuild-levels"]',body)!).onclick=()=>save(assignLevels(raw));
  ($<HTMLButtonElement>('[data-testid="duplicate-level"]',body)!).onclick=()=>{try{const next=duplicateLevel(raw,{sourceLevelId:($<HTMLSelectElement>('[data-level-source]',body)!).value,targetElevation:Number(($<HTMLInputElement>('[data-level-z]',body)!).value),targetName:($<HTMLInputElement>('[data-level-name]',body)!).value,connectVertical:($<HTMLInputElement>('[data-level-columns]',body)!).checked,copyLoads:($<HTMLInputElement>('[data-level-loads]',body)!).checked});save(next)}catch(err:any){alert(err?.message||String(err))}};
}

function patch(){document.querySelectorAll<HTMLElement>('[data-testid="model-lab-overlay"]').forEach(overlay=>{const tabs=$<HTMLElement>('.astra-lab-tabs',overlay),body=$<HTMLElement>('[data-lab-body]',overlay);if(!tabs||!body||tabs.querySelector('[data-tab="levels"]'))return;const b=document.createElement('button');b.textContent='Pavimentos';b.dataset.tab='levels';b.setAttribute('data-testid','levels-tab');b.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderLevels(body)};tabs.appendChild(b)})}
const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
