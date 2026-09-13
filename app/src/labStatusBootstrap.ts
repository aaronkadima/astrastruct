// Keep progressive Lab capability notes aligned with the kernels actually loaded.
function patchLabStatus(){
  document.querySelectorAll<HTMLElement>('[data-testid="model-lab-overlay"]').forEach(overlay=>{
    const body=overlay.querySelector<HTMLElement>('[data-lab-body]');
    if(!body||!body.querySelector('[data-model="beam"]'))return;
    const note=body.querySelector<HTMLElement>('.astra-lab-note');
    if(!note||note.dataset.capabilitiesV030==='1')return;
    note.dataset.capabilitiesV030='1';
    note.innerHTML='<b>Lab v0.30:</b> vigas, pilares e barras isoladas usam os solvers estruturais do AstraStruct. <b>Ancoragem / pull-out</b> possui kernel dedicado de aderência τ–s com pós-pico. <b>Ligação chapa–parafuso</b> possui tanto distribuição elástica Fx/Fy/Mz por placa rígida quanto um kernel não linear de <b>folga radial + contato unilateral/bearing</b> com lei elástica ou bilinear. <b>Punção</b> possui kernel de demanda V/Mx/My no perímetro crítico, com distribuição de τ e extremos. Resistências normativas, flexibilidade/plastificação explícita da chapa e ruptura de cone/borda de concreto permanecem como módulos separados em desenvolvimento.';
  });
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patchLabStatus()})};
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchLabStatus,{once:true});else patchLabStatus();

export {};
