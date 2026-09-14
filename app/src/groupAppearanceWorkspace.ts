// @ts-ignore
import {normalizeProject} from '../../web/src/core/model.js';
// @ts-ignore
import {
  STRUCTURAL_APPEARANCE_GROUPS,
  appearanceGroupSummary,
  elementAppearance,
  groupAppearance,
  materializeGroupAppearances,
  resetAllGroupAppearances,
  structuralElementGroup,
  withGroupAppearance,
} from '../../web/src/visualization/appearance.js';

const PROJECT_KEY='astrastruct.project';
let currentProject:any=null;
let queued=false;
let internalCommit=false;

function readProject(){
  try{return normalizeProject(JSON.parse(localStorage.getItem(PROJECT_KEY)||'{}'));}
  catch{return normalizeProject({});}
}
function project(){return currentProject||readProject();}
function sameDerived(a:any,b:any){
  return JSON.stringify(a?.visualization?.elementAppearance||{})===JSON.stringify(b?.visualization?.elementAppearance||{});
}
function commit(next:any){
  const normalized=normalizeProject(next);
  currentProject=normalized;
  internalCommit=true;
  window.dispatchEvent(new CustomEvent('astrastruct:project-external-commit',{detail:{project:normalized}}));
  internalCommit=false;
  applyCanvasAppearance(normalized);
}
function pct(v:number){return`${Math.round(v*100)}%`;}
function escapeHtml(v:any){
  return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
}
function rowHtml(p:any,g:any){
  const a=groupAppearance(p,g.id);
  const count=(p.elements||[]).filter((e:any)=>structuralElementGroup(p,e)===g.id).length;
  return `<div class="workspace-group-row" data-appearance-group="${g.id}">
    <div class="workspace-group-name"><span class="workspace-group-swatch" style="--group-color:${a.color}"></span><span><strong>${escapeHtml(g.label)}</strong><small>${count} ${count===1?'elemento':'elementos'}</small></span></div>
    <label class="workspace-group-color" title="Cor do grupo ${escapeHtml(g.label)}"><span>Cor</span><input type="color" data-group-field="color" value="${a.color}" aria-label="Cor de ${escapeHtml(g.label)}"></label>
    <label class="workspace-group-opacity" title="Transparência do grupo ${escapeHtml(g.label)}"><span>Opacidade <b data-group-pct>${pct(a.opacity)}</b></span><input type="range" data-group-field="opacity" min="0" max="1" step=".05" value="${a.opacity}" aria-label="Opacidade de ${escapeHtml(g.label)}"></label>
    <label class="workspace-group-visible"><input type="checkbox" data-group-field="visible"${a.visible!==false?' checked':''} aria-label="Exibir ${escapeHtml(g.label)}"><span>Visível</span></label>
  </div>`;
}
function panelHtml(p:any){
  const summary=appearanceGroupSummary(p);
  return `<fieldset class="workspace-group-appearance" data-group-appearance>
    <legend>Aparência por grupo estrutural</legend>
    <div class="workspace-group-head"><span>Grupo</span><span>Aparência</span><span>Transparência</span><span>Exibir</span></div>
    <div class="workspace-group-list">${STRUCTURAL_APPEARANCE_GROUPS.map((g:any)=>rowHtml(p,g)).join('')}</div>
    <div class="workspace-group-actions"><span>${summary.custom} ${summary.custom===1?'grupo personalizado':'grupos personalizados'} · aplicação automática a todos os elementos do grupo</span><div><button type="button" data-open-engineering-review>Detalhamento e fundações</button><button type="button" data-group-reset>Restaurar grupos</button></div></div>
    <p class="workspace-group-note">A classificação usa função estrutural explícita quando disponível; na ausência dela, usa tipo e orientação geométrica. Cor, opacidade e visibilidade são apenas gráficas e não alteram rigidez, massa, cargas, dimensionamento ou resultados.</p>
  </fieldset>`;
}
function enhanceSettingsDialog(){
  const body=document.querySelector<HTMLElement>('.workspace-settings-body');
  if(!body||body.querySelector('[data-group-appearance]'))return;
  const host=document.createElement('div');
  host.innerHTML=panelHtml(project());
  const panel=host.firstElementChild as HTMLElement;
  const note=body.querySelector('.workspace-settings-note');
  body.insertBefore(panel,note||null);
  body.closest<HTMLElement>('.workspace-settings-dialog')?.classList.add('workspace-settings-dialog-wide');
  wirePanel(panel);
}
function wirePanel(panel:HTMLElement){
  const rows=panel.querySelectorAll<HTMLElement>('[data-appearance-group]');
  rows.forEach(row=>{
    const groupId=row.dataset.appearanceGroup!;
    const color=row.querySelector<HTMLInputElement>('[data-group-field="color"]');
    const opacity=row.querySelector<HTMLInputElement>('[data-group-field="opacity"]');
    const visible=row.querySelector<HTMLInputElement>('[data-group-field="visible"]');
    color?.addEventListener('input',event=>{
      const input=event.currentTarget as HTMLInputElement;
      const swatch=row.querySelector<HTMLElement>('.workspace-group-swatch');
      if(swatch)swatch.style.setProperty('--group-color',input.value);
      commit(withGroupAppearance(project(),groupId,{color:input.value}));
    });
    opacity?.addEventListener('input',event=>{
      const input=event.currentTarget as HTMLInputElement;
      const readout=row.querySelector<HTMLElement>('[data-group-pct]');
      if(readout)readout.textContent=pct(Number(input.value));
      commit(withGroupAppearance(project(),groupId,{opacity:Number(input.value)}));
    });
    visible?.addEventListener('change',event=>{
      const input=event.currentTarget as HTMLInputElement;
      commit(withGroupAppearance(project(),groupId,{visible:input.checked}));
    });
  });
  panel.querySelector<HTMLButtonElement>('[data-open-engineering-review]')?.addEventListener('click',()=>{
    document.querySelector('.workspace-settings-backdrop')?.remove();
    window.dispatchEvent(new CustomEvent('astrastruct:engineering-review-open'));
  });
  panel.querySelector<HTMLButtonElement>('[data-group-reset]')?.addEventListener('click',()=>{
    commit(resetAllGroupAppearances(project()));
    refreshPanel(project());
  });
}
function refreshPanel(p=project()){
  const old=document.querySelector<HTMLElement>('[data-group-appearance]');
  if(!old)return;
  const host=document.createElement('div');
  host.innerHTML=panelHtml(p);
  const replacement=host.firstElementChild as HTMLElement;
  old.replaceWith(replacement);
  wirePanel(replacement);
}
function elementId(group:Element){
  return group.querySelector<SVGTextElement>('.element-label')?.textContent?.trim()||group.querySelector<SVGTextElement>('text')?.textContent?.trim()||'';
}
function applyCanvasAppearance(p=project()){
  document.querySelectorAll<SVGGElement>('svg.model-canvas g[data-entity="element"]').forEach(g=>{
    const id=elementId(g);
    const element=(p.elements||[]).find((x:any)=>String(x.id)===id);
    if(!element)return;
    const appearance=elementAppearance(p,element);
    const groupId=structuralElementGroup(p,element);
    g.dataset.appearanceGroup=groupId;
    g.dataset.appearanceVisible=appearance.visible===false?'false':'true';
    g.style.display=appearance.visible===false?'none':'';
    g.style.opacity=String(appearance.opacity);
    g.querySelectorAll<SVGElement>('.member').forEach(member=>{member.style.stroke=appearance.color;});
  });
  document.querySelectorAll<SVGElement>('[data-element-id]').forEach(el=>{
    const id=el.getAttribute('data-element-id')||'';
    const element=(p.elements||[]).find((x:any)=>String(x.id)===id);
    if(element)el.setAttribute('data-appearance-group',structuralElementGroup(p,element));
  });
  const app=document.querySelector<HTMLElement>('.astra-app');
  const summary=appearanceGroupSummary(p);
  if(app){
    app.dataset.appearanceGroups=String(summary.custom);
    app.dataset.hiddenAppearanceGroups=String(summary.rows.filter((r:any)=>r.visible===false).length);
  }
}
function reconcileProject(p:any){
  const materialized=materializeGroupAppearances(p);
  if(!sameDerived(p,materialized)){
    commit(materialized);
    return materialized;
  }
  return p;
}
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    enhanceSettingsDialog();
    applyCanvasAppearance(project());
  });
}
function boot(){
  currentProject=reconcileProject(readProject());
  schedule();
  new MutationObserver(records=>{
    if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule();
  }).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('astrastruct:project-external-commit',(event:any)=>{
    const incoming=event?.detail?.project?normalizeProject(event.detail.project):readProject();
    currentProject=internalCommit?incoming:reconcileProject(incoming);
    applyCanvasAppearance(currentProject);
    if(!internalCommit)refreshPanel(currentProject);
  });
  window.addEventListener('storage',event=>{
    if(event.key===PROJECT_KEY){
      currentProject=reconcileProject(readProject());
      schedule();
      refreshPanel(currentProject);
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

export{};
