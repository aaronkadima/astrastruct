// Progressive feature shell for v0.30: model examples, isolated-element Lab and
// building launch from a parametric grid or a quick 2D plan sketch.
// It intentionally writes through the same persisted project contract consumed
// by the React application, so generated models immediately open in AstraStruct.
// @ts-ignore
import { createGridBuilding3D, createPlanBuilding3D, demoFiveStoreyBuilding3D, demoSteelWarehouse3D, demoWaterTank3D, demoIsolatedBeamLab3D, demoIsolatedColumnLab3D, demoSpringLab3D } from '../../web/src/core/exampleModels.js';

const STORAGE_KEY='astrastruct.project';
const $=(sel:string,root:ParentNode=document)=>root.querySelector(sel) as HTMLElement|null;
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const parseSpans=(v:string,fallback:number[])=>{const a=v.split(/[,;\s]+/).map(Number).filter(x=>Number.isFinite(x)&&x>0);return a.length?a:fallback};

function openProject(factory:()=>any){try{const p=factory();localStorage.setItem(STORAGE_KEY,JSON.stringify(p));location.reload()}catch(err:any){alert(err?.message||String(err))}}

function installStyle(){if(document.getElementById('astra-model-lab-style'))return;const s=document.createElement('style');s.id='astra-model-lab-style';s.textContent=`
.astra-lab-launch{position:fixed;left:18px;bottom:18px;z-index:1400;border:1px solid #5278aa;background:#13243a;color:#eaf2ff;border-radius:12px;padding:10px 14px;font:700 13px/1.2 Inter,system-ui,sans-serif;box-shadow:0 12px 32px #0007;cursor:pointer}.astra-lab-launch:hover{background:#1a3150}.astra-lab-overlay{position:fixed;inset:0;z-index:1500;background:#05080dcc;display:grid;place-items:center;padding:18px;box-sizing:border-box}.astra-lab-modal{width:min(1040px,96vw);max-height:92vh;overflow:auto;background:#101822;color:#eef4ff;border:1px solid #2c3d55;border-radius:16px;box-shadow:0 24px 80px #000a;font:13px/1.45 Inter,system-ui,sans-serif}.astra-lab-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 18px;background:#101822f5;border-bottom:1px solid #28384e}.astra-lab-head h2{font-size:17px;margin:0}.astra-lab-head p{margin:3px 0 0;color:#95a7bf}.astra-lab-close,.astra-lab-btn{border:1px solid #38516f;background:#17263a;color:#eef4ff;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit}.astra-lab-btn.primary{background:#1e4f83;border-color:#3979b8;font-weight:800}.astra-lab-btn:hover,.astra-lab-close:hover{filter:brightness(1.15)}.astra-lab-tabs{display:flex;gap:7px;padding:12px 18px;border-bottom:1px solid #26364a;flex-wrap:wrap}.astra-lab-tabs button{border:1px solid #31465f;background:#131f2e;color:#b9c8da;border-radius:999px;padding:7px 11px;cursor:pointer}.astra-lab-tabs button.active{background:#234c78;color:#fff;border-color:#4c80b6}.astra-lab-body{padding:18px}.astra-lab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.astra-model-card{border:1px solid #2a3b50;background:#121d2b;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}.astra-model-card h3{font-size:14px;margin:0}.astra-model-card p{margin:0;color:#9dafc5;min-height:38px}.astra-model-card small{color:#7f91a8}.astra-lab-note{margin:0 0 14px;padding:10px 12px;border-left:3px solid #5d8fc5;background:#132033;color:#b7c8da;border-radius:6px}.astra-form-grid{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px}.astra-form-grid label{display:grid;gap:5px;color:#aab9cc}.astra-form-grid input{width:100%;box-sizing:border-box;border:1px solid #334961;background:#0c131d;color:#eef4ff;border-radius:8px;padding:9px}.astra-form-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.astra-plan-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(250px,.7fr);gap:14px}.astra-plan-box{border:1px solid #2e4259;border-radius:12px;background:#0b121b;padding:10px}.astra-plan-svg{width:100%;height:auto;aspect-ratio:16/9;background:#091018;border-radius:8px;cursor:crosshair}.astra-plan-status{display:flex;justify-content:space-between;gap:8px;color:#8da1ba;margin-top:7px;font-size:12px}.astra-plan-help{color:#8fa2ba;margin:8px 0 0}.astra-subtabs{display:flex;gap:8px;margin-bottom:14px}.astra-subtabs button{border:1px solid #31465f;background:#131f2e;color:#b9c8da;border-radius:8px;padding:7px 10px;cursor:pointer}.astra-subtabs button.active{background:#214870;color:#fff}.astra-lab-modal{width:min(1220px,97vw)}.astra-form-grid.three{grid-template-columns:repeat(3,minmax(150px,1fr))}.astra-form-grid.four{grid-template-columns:repeat(4,minmax(130px,1fr))}.astra-form-grid select{width:100%;box-sizing:border-box;border:1px solid #334961;background:#0c131d;color:#eef4ff;border-radius:8px;padding:9px}.astra-launch-summary{position:sticky;top:72px;z-index:2;margin:0 0 12px;padding:9px 12px;border:1px solid #315275;background:#102239;color:#dcecff;border-radius:9px;font-weight:700}.astra-launch-sections{display:grid;gap:10px}.astra-launch-section{border:1px solid #2b4058;border-radius:10px;background:#101b29;overflow:hidden}.astra-launch-section>summary{cursor:pointer;padding:10px 12px;font-weight:800;color:#d9e9fb;background:#142439;border-bottom:1px solid transparent}.astra-launch-section[open]>summary{border-bottom-color:#293e55}.astra-launch-section>.astra-form-grid{padding:12px}.astra-section-note{margin:0;padding:0 12px 12px;color:#8297b1;font-size:12px}.astra-check{align-content:end;padding-bottom:7px}.astra-check span{display:flex;gap:7px;align-items:center}.astra-check input{width:auto}.astra-plan-config{min-width:0}.astra-plan-config .astra-launch-summary{top:72px}@media(max-width:900px){.astra-form-grid.four,.astra-form-grid.three{grid-template-columns:repeat(2,minmax(140px,1fr))}}@media(max-width:720px){.astra-plan-layout{grid-template-columns:1fr}.astra-form-grid,.astra-form-grid.four,.astra-form-grid.three{grid-template-columns:1fr}.astra-lab-launch{left:10px;bottom:64px}.astra-lab-overlay{padding:7px}.astra-lab-modal{width:100%;max-height:96vh}}
`;document.head.appendChild(s)}

type PlanNode={id:string,x:number,y:number};type PlanEdge={id:string,n1:string,n2:string};
function renderModal(event?:Event){
  if(document.querySelector('[data-testid="model-lab-overlay"]'))return;
  const requested=String((event as CustomEvent)?.detail?.tab||'examples');
  const overlay=document.createElement('div');overlay.className='astra-lab-overlay';overlay.setAttribute('data-testid','model-lab-overlay');
  overlay.innerHTML=`<section class="astra-lab-modal"><header class="astra-lab-head"><div><h2>Lab & Modelos estruturais</h2><p>Exemplos 3D, ensaios isolados e lançamento rápido de edifícios.</p></div><button class="astra-lab-close" aria-label="Fechar Lab">×</button></header><div class="astra-lab-tabs"><button data-tab="examples" class="active">Modelos 3D</button><button data-tab="lab">Lab isolado</button><button data-tab="building">Lançar edifício</button></div><div class="astra-lab-body" data-lab-body></div></section>`;
  document.body.appendChild(overlay);const body=$('[data-lab-body]',overlay)!;let tab=['examples','lab','building'].includes(requested)?requested:'examples';
  const close=()=>overlay.remove();$('.astra-lab-close',overlay)?.addEventListener('click',close);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close()});
  const setTab=(next:string)=>{tab=next;overlay.querySelectorAll('[data-tab]').forEach((b:any)=>b.classList.toggle('active',b.dataset.tab===tab));render()};overlay.querySelectorAll('[data-tab]').forEach((b:any)=>b.addEventListener('click',()=>setTab(b.dataset.tab)));

  function card(title:string,desc:string,meta:string,id:string){return `<article class="astra-model-card"><h3>${esc(title)}</h3><p>${esc(desc)}</p><small>${esc(meta)}</small><button class="astra-lab-btn primary" data-model="${id}">Abrir modelo</button></article>`}
  function bindModels(){const factories:any={five:demoFiveStoreyBuilding3D,warehouse:demoSteelWarehouse3D,tank:demoWaterTank3D,beam:demoIsolatedBeamLab3D,column:demoIsolatedColumnLab3D,spring:demoSpringLab3D};body.querySelectorAll('[data-model]').forEach((b:any)=>b.addEventListener('click',()=>openProject(factories[b.dataset.model])))}

  function renderExamples(){body.innerHTML=`<p class="astra-lab-note">Os modelos são demonstrativos para exercitar o kernel e a interface. Geometrias, seções e ações devem ser revisadas antes de qualquer uso de engenharia.</p><div class="astra-lab-grid">${card('Edifício RC · 5 pavimentos','Pórtico espacial com 4 linhas em X, 3 em Y, pilares contínuos e vigas em todos os níveis.','5 pavimentos · 60 nós · frame3d','five')}${card('Galpão metálico','Seis pórticos transversais com pilares, duas águas, cumeeira e barras longitudinais.','Aço · 30 m de comprimento · 20 m de vão','warehouse')}${card('Reservatório elevado','Modelo global de barras com oito colunas, montantes e anéis inferior/superior.','RC · ação vertical equivalente da água','tank')}</div>`;bindModels()}
  function renderLab(){body.innerHTML=`<p class="astra-lab-note"><b>Lab v1:</b> já permite estudar elementos isolados com apoios, cargas, molas, recalques e análises linear/P‑Delta/co‑rotacional. Arrancamento de ancoragem, punção, chapa‑parafuso, contato e cascas ainda precisam de kernels especializados.</p><div class="astra-lab-grid">${card('Viga isolada 3D','Viga em balanço para força transversal, grandes deslocamentos e pós-processamento.','Co-rotacional 3D','beam')}${card('Coluna isolada 3D','Coluna com esforço normal + ação lateral para comparar linear e segunda ordem.','P‑Delta 3D','column')}${card('Elemento + mola','Viga isolada com mola translacional e rotacional no nó livre.','Co-rotacional + molas 3D','spring')}</div>`;bindModels()}
  function renderBuilding(){
    body.innerHTML=`<div class="astra-subtabs"><button data-build-mode="grid" class="active">Malha paramétrica</button><button data-build-mode="sketch">Desenhar planta</button></div><div data-build-content></div>`;
    let mode='grid';
    const host=$('[data-build-content]',body);
    const control=(prefix='g',key='name')=>host?.querySelector('[data-'+prefix+'-'+key+']')||null;
    const textValue=(prefix='g',key='name',fallback='')=>String(Reflect.get(control(prefix,key)||{},'value')??fallback).trim();
    const numberValue=(prefix='g',key='value',fallback=0)=>{const n=Number(Reflect.get(control(prefix,key)||{},'value'));return Number.isFinite(n)?n:fallback};
    const checkedValue=(prefix='g',key='enabled',fallback=false)=>{const el=control(prefix,key);return el?Boolean(Reflect.get(el,'checked')):fallback};
    const buildingFields=(prefix='g',options={grid:true,slabs:true,directional:true,name:'Edifício paramétrico 3D',storeys:5,load:-18})=>{
      const p=prefix,beamY=options.directional?`<label>Viga Y · b [cm]<input data-launch-field data-${p}-beam-y-b type="number" min="8" step="1" value="30"></label><label>Viga Y · h [cm]<input data-launch-field data-${p}-beam-y-h type="number" min="8" step="1" value="60"></label>`:'';
      const grid=options.grid?`<label>Vãos em X [m]<input data-launch-field data-${p}-x value="5, 5, 5"></label><label>Vãos em Y [m]<input data-launch-field data-${p}-y value="4, 4"></label>`:'';
      const slabs=options.slabs?`<details class="astra-launch-section" open><summary>Lajes</summary><div class="astra-form-grid three"><label class="astra-check"><span><input data-launch-field data-${p}-slabs type="checkbox" checked> Gerar lajes shell4</span></label><label>Espessura [cm]<input data-launch-field data-${p}-slab-t type="number" min="6" max="60" step="1" value="15"></label></div></details>`:'';
      return `<div class="astra-launch-summary" data-${p}-summary></div>
      <div class="astra-launch-sections">
        <details class="astra-launch-section" open><summary>Projeto, malha e pavimentos</summary><div class="astra-form-grid three">
          <label>Nome do edifício<input data-launch-field data-${p}-name value="${esc(options.name)}"></label>
          <label>Pavimentos<input data-launch-field data-${p}-storeys type="number" min="1" max="30" value="${options.storeys}"></label>
          <label>Pé-direito padrão [m]<input data-launch-field data-${p}-h type="number" min="0.5" max="20" step="0.1" value="3"></label>
          <label>Alturas por pavimento [m]<input data-launch-field data-${p}-heights placeholder="opcional: 3.2, 3.0, 2.8"></label>
          ${grid}
          <label>Modelo de análise<select data-launch-field data-${p}-analysis><option value="linear">Linear</option><option value="pdelta">P-Delta</option><option value="corotational">Co-rotacional 3D</option></select><small data-${p}-analysis-note>Com lajes shell4 ativas, o lançamento usa análise Linear 3D.</small></label>
        </div></details>
        <details class="astra-launch-section" open><summary>Condições de contorno e pavimentos</summary><div class="astra-form-grid four">
          <label>Base dos pilares<select data-launch-field data-${p}-support><option value="fixed">Engastada · UX UY UZ RX RY RZ</option><option value="pinned">Articulada · UX UY UZ</option><option value="elastic">Elástica · molas 6 GDL</option></select><small data-${p}-support-note>Engastamento restringe os seis graus de liberdade na base.</small></label>
          <label>Topo do edifício<select disabled><option>Livre · sem restrição global</option></select><small>O topo deve responder às ações laterais; não é travado artificialmente.</small></label>
          <label>Diafragma de pavimento<select data-launch-field data-${p}-diaphragm><option value="semiRigid" ${options.slabs?'selected':''}>Semi-rígido · laje shell4</option><option value="rigid" ${options.slabs?'':'selected'}>Rígido XY · UX/UY/RZ compatíveis</option><option value="none">Nenhum vínculo de diafragma</option></select><small data-${p}-diaphragm-note>O diafragma não fixa o pavimento: ele compatibiliza o movimento em planta.</small></label>
          <label>Referência global<select disabled><option>X/Y horizontais · Z vertical</option></select><small>Os apoios são definidos nos eixos globais do modelo.</small></label>
          <label data-boundary-elastic>Kx [kN/m]<input data-launch-field data-${p}-spring-kx type="number" min="0" step="1000" value="0"></label>
          <label data-boundary-elastic>Ky [kN/m]<input data-launch-field data-${p}-spring-ky type="number" min="0" step="1000" value="0"></label>
          <label data-boundary-elastic>Kz [kN/m]<input data-launch-field data-${p}-spring-kz type="number" min="0" step="1000" value="0"></label>
          <label data-boundary-elastic>Krx [kN·m/rad]<input data-launch-field data-${p}-spring-krx type="number" min="0" step="1000" value="0"></label>
          <label data-boundary-elastic>Kry [kN·m/rad]<input data-launch-field data-${p}-spring-kry type="number" min="0" step="1000" value="0"></label>
          <label data-boundary-elastic>Krz [kN·m/rad]<input data-launch-field data-${p}-spring-krz type="number" min="0" step="1000" value="0"></label>
        </div><p class="astra-section-note">Base fixa e articulada seguem a convenção usual de programas de edifícios. Para base elástica, Kx/Ky/Kz devem ser informados pelo modelo geotécnico/SSI; qDesign da fundação não é convertido automaticamente em rigidez.</p></details>
        <details class="astra-launch-section" open><summary>Material estrutural</summary><div class="astra-form-grid four">
          <label>fck [MPa]<input data-launch-field data-${p}-fck type="number" min="1" max="150" step="1" value="30"></label>
          <label>E [GPa]<input data-launch-field data-${p}-E type="number" min="1" step="0.5" value="30"></label>
          <label>Poisson ν<input data-launch-field data-${p}-nu type="number" min="0" max="0.49" step="0.01" value="0.20"></label>
          <label>Peso específico [kN/m³]<input data-launch-field data-${p}-density type="number" min="0.1" step="0.5" value="25"></label>
        </div><p class="astra-section-note">As propriedades são gravadas no material do edifício; o módulo E é informado explicitamente e não é inferido automaticamente de uma norma.</p></details>
        <details class="astra-launch-section" open><summary>Seções de pilares e vigas</summary><div class="astra-form-grid four">
          <label>Pilar · b [cm]<input data-launch-field data-${p}-col-b type="number" min="10" step="1" value="40"></label>
          <label>Pilar · h [cm]<input data-launch-field data-${p}-col-h type="number" min="10" step="1" value="60"></label>
          <label>Viga${options.directional?' X':''} · b [cm]<input data-launch-field data-${p}-beam-b type="number" min="8" step="1" value="30"></label>
          <label>Viga${options.directional?' X':''} · h [cm]<input data-launch-field data-${p}-beam-h type="number" min="8" step="1" value="60"></label>
          ${beamY}
        </div><p class="astra-section-note">A, Iy, Iz e J são recalculados a partir das dimensões informadas e usados no modelo 3D.</p></details>
        ${slabs}
        <details class="astra-launch-section"><summary>Ações iniciais</summary><div class="astra-form-grid three">
          <label>G · Fz por nó/pavimento [kN]<input data-launch-field data-${p}-load-z type="number" step="1" value="${options.load}"></label>
          <label>HX · Fx por nó/pavimento [kN]<input data-launch-field data-${p}-load-x type="number" step="1" value="0"></label>
          <label>HY · Fy por nó/pavimento [kN]<input data-launch-field data-${p}-load-y type="number" step="1" value="0"></label>
        </div><p class="astra-section-note" data-${p}-load-note>G, HX e HY são separados em casos independentes. Com HX = 0, um edifício simétrico sob gravidade deve apresentar Ux ≈ 0. Vento normativo automático será tratado em módulo próprio.</p></details>
        <details class="astra-launch-section" open><summary>Fundação</summary><div class="astra-form-grid four">
          <label>Tipo<select data-launch-field data-${p}-foundation><option value="footing">Sapata isolada</option><option value="pileCap">Bloco sobre estacas</option><option value="none">Somente vínculo / sem sólido</option></select></label>
          <label data-foundation-block>B [m]<input data-launch-field data-${p}-foundation-b type="number" min="0.2" step="0.05" value="1.50"></label>
          <label data-foundation-block>L [m]<input data-launch-field data-${p}-foundation-l type="number" min="0.2" step="0.05" value="1.50"></label>
          <label data-foundation-block>h [m]<input data-launch-field data-${p}-foundation-h type="number" min="0.15" step="0.05" value="0.50"></label>
          <label data-foundation-block>qDesign do solo [kPa]<input data-launch-field data-${p}-soil-q type="number" min="1" step="10" value="250"></label>
          <label data-foundation-pile>Nº de estacas<select data-launch-field data-${p}-pile-count><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></label>
          <label data-foundation-pile>Ø estaca [cm]<input data-launch-field data-${p}-pile-d type="number" min="10" step="5" value="40"></label>
          <label data-foundation-pile>Comprimento estaca [m]<input data-launch-field data-${p}-pile-len type="number" min="0.5" step="0.5" value="12"></label>
          <label data-foundation-pile>Espaçamento entre eixos [m]<input data-launch-field data-${p}-pile-spacing type="number" min="0.2" step="0.05" value="1.20"></label>
        </div><p class="astra-section-note">A geometria definida aqui gera sólidos 3D e registros de revisão de fundação. As verificações normativas permanecem pendentes até receber reações, solo e profile aplicável.</p></details>
      </div>`;
    };
    const readCommon=(prefix='g',directional=true)=>{
      const foundationType=textValue(prefix,'foundation','footing');
      const base={
        name:textValue(prefix,'name','Edifício 3D'),storeys:numberValue(prefix,'storeys',5),storeyHeight:numberValue(prefix,'h',3),storeyHeights:parseSpans(textValue(prefix,'heights',''),[]),
        floorLoadPerNode:numberValue(prefix,'load-z',-18),floorLoadXPerNode:numberValue(prefix,'load-x',0),floorLoadYPerNode:numberValue(prefix,'load-y',0),
        columnWidth:numberValue(prefix,'col-b',40)/100,columnHeight:numberValue(prefix,'col-h',60)/100,
        concreteFck:numberValue(prefix,'fck',30),concreteE:numberValue(prefix,'E',30)*1e6,concreteNu:numberValue(prefix,'nu',.2),concreteDensity:numberValue(prefix,'density',25),
        analysisType:textValue(prefix,'analysis','linear'),baseSupport:textValue(prefix,'support','fixed'),diaphragmMode:textValue(prefix,'diaphragm',prefix==='g'?'semiRigid':'rigid'),
        baseSpring:{kx:numberValue(prefix,'spring-kx',0),ky:numberValue(prefix,'spring-ky',0),kz:numberValue(prefix,'spring-kz',0),krx:numberValue(prefix,'spring-krx',0),kry:numberValue(prefix,'spring-kry',0),krz:numberValue(prefix,'spring-krz',0)},
        foundation:{type:foundationType,B:numberValue(prefix,'foundation-b',1.5),L:numberValue(prefix,'foundation-l',1.5),h:numberValue(prefix,'foundation-h',.5),qDesign:numberValue(prefix,'soil-q',250),pileCount:numberValue(prefix,'pile-count',4),pileDiameter:numberValue(prefix,'pile-d',40)/100,pileLength:numberValue(prefix,'pile-len',12),pileSpacing:numberValue(prefix,'pile-spacing',1.2)}
      };
      return directional?{...base,beamXWidth:numberValue(prefix,'beam-b',30)/100,beamXHeight:numberValue(prefix,'beam-h',60)/100,beamYWidth:numberValue(prefix,'beam-y-b',30)/100,beamYHeight:numberValue(prefix,'beam-y-h',60)/100}:{...base,beamWidth:numberValue(prefix,'beam-b',30)/100,beamHeight:numberValue(prefix,'beam-h',60)/100};
    };
    const bindForm=(prefix='g')=>{
      const sync=()=>{
        const type=textValue(prefix,'foundation','footing'),none=type==='none',pile=type==='pileCap',slabToggle=control(prefix,'slabs') as HTMLInputElement|null,slabs=slabToggle?Boolean(slabToggle.checked):false,base=textValue(prefix,'support','fixed'),elastic=base==='elastic';
        host?.querySelectorAll('[data-foundation-block] input,[data-foundation-block] select').forEach(el=>Reflect.set(el,'disabled',none));
        host?.querySelectorAll('[data-foundation-pile] input,[data-foundation-pile] select').forEach(el=>Reflect.set(el,'disabled',!pile));
        host?.querySelectorAll('[data-boundary-elastic] input').forEach(el=>Reflect.set(el,'disabled',!elastic));
        const slabThickness=control(prefix,'slab-t');if(slabThickness)Reflect.set(slabThickness,'disabled',!slabs);
        const analysis=control(prefix,'analysis') as HTMLSelectElement|null;if(analysis){for(const option of [...analysis.options])if(['pdelta','corotational'].includes(option.value))option.disabled=slabs;if(slabs&&['pdelta','corotational'].includes(analysis.value))analysis.value='linear'}
        const note=control(prefix,'analysis-note');if(note)note.textContent=slabs?'Com lajes shell4 ativas, P-Delta e co-rotacional ficam indisponíveis; use Linear 3D ou desative as lajes.':'Sem lajes shell4, P-Delta e co-rotacional 3D ficam disponíveis para o pórtico de barras.';
        const supportNote=control(prefix,'support-note');if(supportNote)supportNote.textContent=elastic?'Base elástica: Kx, Ky e Kz devem ser positivos; rotações podem permanecer livres ou receber Kr.':base==='pinned'?'Base articulada: UX, UY e UZ impedidos; RX, RY e RZ livres.':'Base engastada: UX, UY, UZ, RX, RY e RZ impedidos.';
        const diaphragm=control(prefix,'diaphragm') as HTMLSelectElement|null;if(diaphragm){const semi=[...diaphragm.options].find(o=>o.value==='semiRigid');if(semi)semi.disabled=!slabs;if(!slabs&&diaphragm.value==='semiRigid')diaphragm.value='rigid'}
        const diaphragmNote=control(prefix,'diaphragm-note');if(diaphragmNote)diaphragmNote.textContent=diaphragm?.value==='rigid'?'Rígido XY: nós do pavimento compartilham UX, UY e RZ de corpo rígido; UZ/RX/RY continuam independentes.':diaphragm?.value==='semiRigid'?'Semi-rígido: a rigidez em planta vem dos elementos shell4 da laje.':'Sem MPC de pavimento; use somente quando a conectividade estrutural representar o comportamento desejado.';
        const loadNote=control(prefix,'load-note'),fx=numberValue(prefix,'load-x',0),fy=numberValue(prefix,'load-y',0);if(loadNote)loadNote.textContent=Math.abs(fx)<1e-12&&Math.abs(fy)<1e-12?'Sem HX/HY: em modelo simétrico sob gravidade, Ux e Uy horizontais são esperados próximos de zero.':'Casos laterais serão criados separadamente e o cenário de visualização combinará G com as direções horizontais informadas.';
        const summary=control(prefix,'summary'),storeys=numberValue(prefix,'storeys',0),cb=numberValue(prefix,'col-b',0),ch=numberValue(prefix,'col-h',0),bb=numberValue(prefix,'beam-b',0),bh=numberValue(prefix,'beam-h',0),foundation=type==='footing'?'Sapata':type==='pileCap'?'Bloco sobre estacas':'Sem sólido',analysisLabel=analysis?.selectedOptions?.[0]?.textContent||'Linear',baseLabel=base==='elastic'?'Base elástica':base==='pinned'?'Base articulada':'Base engastada',diaLabel=diaphragm?.selectedOptions?.[0]?.textContent||'Sem diafragma';
        if(summary)summary.textContent=storeys+' pav. · Pilar '+cb+'×'+ch+' cm · Viga '+bb+'×'+bh+' cm · '+baseLabel+' · '+diaLabel+' · '+foundation+' · '+analysisLabel;
      };
      host?.querySelectorAll('[data-launch-field]').forEach(el=>{el.addEventListener('input',sync);el.addEventListener('change',sync)});sync();
    };
    body.querySelectorAll('[data-build-mode]').forEach(b=>b.addEventListener('click',()=>{mode=String(Reflect.get(b,'dataset')?.buildMode||'grid');body.querySelectorAll('[data-build-mode]').forEach(x=>x.classList.toggle('active',String(Reflect.get(x,'dataset')?.buildMode||'')===mode));drawBuild()}));
  
    const drawGrid=()=>{
      if(!host)return;
      host.innerHTML=`<p class="astra-lab-note"><b>Lançamento paramétrico completo:</b> defina a malha, pavimentos, materiais, seções, lajes, ações, vínculo e fundações antes de gerar o modelo.</p>${buildingFields('g',{grid:true,slabs:true,directional:true,name:'Edifício paramétrico 3D',storeys:5,load:-18})}<div class="astra-form-actions"><button class="astra-lab-btn primary" data-generate-grid data-testid="generate-grid-building">Gerar edifício 3D</button><button class="astra-lab-btn" data-five>Usar exemplo de 5 pavimentos</button></div>`;
      bindForm('g');
      const generate=$('[data-generate-grid]',host);if(generate)generate.addEventListener('click',()=>{const cfg=readCommon('g',true);openProject(()=>createGridBuilding3D({...cfg,xSpans:parseSpans(textValue('g','x'),[5,5,5]),ySpans:parseSpans(textValue('g','y'),[4,4]),includeSlabs:checkedValue('g','slabs',true),slabThickness:numberValue('g','slab-t',15)/100}))});
      const five=$('[data-five]',host);if(five)five.addEventListener('click',()=>openProject(demoFiveStoreyBuilding3D));
    };
    const drawSketch=()=>{
      if(!host)return;
      host.innerHTML=`<p class="astra-lab-note"><b>Planta + parâmetros estruturais:</b> lance os eixos graficamente e configure as propriedades que serão aplicadas à extrusão vertical.</p><div class="astra-plan-layout"><div class="astra-plan-box"><svg class="astra-plan-svg" data-plan-svg viewBox="0 0 600 340" role="img" aria-label="Editor de planta estrutural"></svg><div class="astra-plan-status"><span data-plan-count>0 nós · 0 linhas</span><span>snap 1,0 m · área 20×12 m</span></div><div class="astra-form-actions"><button class="astra-lab-btn" data-plan-break>Nova linha</button><button class="astra-lab-btn" data-plan-undo>Desfazer</button><button class="astra-lab-btn" data-plan-rect>Retângulo 10×8 m</button><button class="astra-lab-btn" data-plan-clear>Limpar</button></div></div><div class="astra-plan-config">${buildingFields('p',{grid:false,slabs:false,directional:false,name:'Edifício por planta desenhada',storeys:3,load:-12})}<div class="astra-form-actions"><button class="astra-lab-btn primary" data-plan-generate data-testid="generate-sketch-building">Extrudir planta em 3D</button></div></div></div>`;
      bindForm('p');
      const svg=$('[data-plan-svg]',host);let nodes=[],edges=[],last=null;const ns='http://www.w3.org/2000/svg';
      const renderPlan=()=>{if(!svg)return;while(svg.firstChild)svg.removeChild(svg.firstChild);for(let x=0;x<=20;x++){const l=document.createElementNS(ns,'line');l.setAttribute('x1',String(30+x*27));l.setAttribute('x2',String(30+x*27));l.setAttribute('y1','8');l.setAttribute('y2','332');l.setAttribute('stroke',x%5===0?'#27394e':'#172536');l.setAttribute('stroke-width',x%5===0?'1':'0.6');svg.appendChild(l)}for(let y=0;y<=12;y++){const l=document.createElementNS(ns,'line');l.setAttribute('x1','30');l.setAttribute('x2','570');l.setAttribute('y1',String(332-y*27));l.setAttribute('y2',String(332-y*27));l.setAttribute('stroke',y%4===0?'#27394e':'#172536');l.setAttribute('stroke-width',y%4===0?'1':'0.6');svg.appendChild(l)}for(const e of edges){const a=nodes.find(n=>n.id===e.n1),b=nodes.find(n=>n.id===e.n2);if(!a||!b)continue;const l=document.createElementNS(ns,'line');l.setAttribute('x1',String(30+a.x*27));l.setAttribute('y1',String(332-a.y*27));l.setAttribute('x2',String(30+b.x*27));l.setAttribute('y2',String(332-b.y*27));l.setAttribute('stroke','#69a9e8');l.setAttribute('stroke-width','4');svg.appendChild(l)}for(const n of nodes){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(30+n.x*27));dot.setAttribute('cy',String(332-n.y*27));dot.setAttribute('r','6');dot.setAttribute('fill',n.id===last?'#ffd27d':'#dcecff');dot.setAttribute('stroke','#234d78');dot.setAttribute('stroke-width','2');svg.appendChild(dot)}const count=$('[data-plan-count]',host);if(count)count.textContent=nodes.length+' nós · '+edges.length+' linhas'};
      const addPoint=(x=0,y=0)=>{x=Math.max(0,Math.min(20,Math.round(x)));y=Math.max(0,Math.min(12,Math.round(y)));let n=nodes.find(q=>q.x===x&&q.y===y);if(!n){n={id:'P'+(nodes.length+1),x,y};nodes.push(n)}if(last&&last!==n.id&&!edges.some(e=>(e.n1===last&&e.n2===n.id)||(e.n2===last&&e.n1===n.id)))edges.push({id:'L'+(edges.length+1),n1:last,n2:n.id});last=n.id;renderPlan()};
      svg?.addEventListener('click',ev=>{const rect=svg.getBoundingClientRect(),vx=(ev.clientX-rect.left)/rect.width*600,vy=(ev.clientY-rect.top)/rect.height*340;addPoint((vx-30)/27,(332-vy)/27)});
      const br=$('[data-plan-break]',host);if(br)br.addEventListener('click',()=>{last=null;renderPlan()});const clear=$('[data-plan-clear]',host);if(clear)clear.addEventListener('click',()=>{nodes=[];edges=[];last=null;renderPlan()});const undo=$('[data-plan-undo]',host);if(undo)undo.addEventListener('click',()=>{if(edges.length){const e=edges.pop();last=e?.n1||null}else if(nodes.length){nodes.pop();last=nodes.at(-1)?.id||null}renderPlan()});const rect=$('[data-plan-rect]',host);if(rect)rect.addEventListener('click',()=>{nodes=[{id:'P1',x:2,y:2},{id:'P2',x:12,y:2},{id:'P3',x:12,y:10},{id:'P4',x:2,y:10}];edges=[{id:'L1',n1:'P1',n2:'P2'},{id:'L2',n1:'P2',n2:'P3'},{id:'L3',n1:'P3',n2:'P4'},{id:'L4',n1:'P4',n2:'P1'}];last=null;renderPlan()});
      const generate=$('[data-plan-generate]',host);if(generate)generate.addEventListener('click',()=>{const cfg=readCommon('p',false);openProject(()=>createPlanBuilding3D({...cfg,planNodes:nodes,planEdges:edges}))});renderPlan();
    };
    const drawBuild=()=>mode==='grid'?drawGrid():drawSketch();drawBuild();
  }
  function render(){if(tab==='examples')renderExamples();else if(tab==='lab')renderLab();else renderBuilding()}setTab(tab);
}

let installed=false;
function install(){
  document.querySelectorAll('.astra-lab-launch,[data-testid="model-lab-launch"]').forEach(node=>node.remove());
  if(installed)return;
  installed=true;
  installStyle();
  window.addEventListener('astrastruct:model-lab-open',renderModal);
}

const start=()=>install();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
