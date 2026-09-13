// Keep progressive Lab capability notes aligned with the kernels actually loaded.
function patchLabStatus(){
  document.querySelectorAll<HTMLElement>('[data-testid="model-lab-overlay"]').forEach(overlay=>{
    const body=overlay.querySelector<HTMLElement>('[data-lab-body]');
    if(!body||!body.querySelector('[data-model="beam"]'))return;
    const note=body.querySelector<HTMLElement>('.astra-lab-note');
    if(!note||note.dataset.capabilitiesV0305==='1')return;
    note.dataset.capabilitiesV0305='1';
    note.innerHTML='<b>Lab v0.30.5:</b> vigas, pilares e barras isoladas usam os solvers estruturais do AstraStruct. <b>Ancoragem / pull-out</b> possui aderência τ–s com pós-pico e mapa espacial de τ na interface aço–concreto. <b>Ligação chapa–parafuso</b> inclui distribuição elástica Fx/Fy/Mz, contato não linear em furo circular com <b>folga radial</b>, <b>furo oblongo orientável</b>, <b>chapa flexível Q4</b> e, agora, <b>furo circular explicitamente vazado</b> por integração cut-cell com pressão normal distribuída p(θ), arco ativo, σb,eq e medida de ovalização do contorno. <b>Punção</b> possui demanda V/Mx/My no perímetro crítico, curva τ(s) e mapa contínuo em planta. Resistências normativas, atrito/pré-tensão, pressão Hertziana 3D, block shear, rasgamento de borda, prying fora do plano e ruptura de cone/borda de concreto permanecem como módulos separados em desenvolvimento.';
  });
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patchLabStatus()})};
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchLabStatus,{once:true});else patchLabStatus();

export {};
