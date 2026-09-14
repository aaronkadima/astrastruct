import React,{useEffect,useMemo,useState}from'react';
import{createPortal}from'react-dom';
// @ts-ignore
import{normalizeProject}from'../../web/src/core/model.js';
// @ts-ignore
import{DURABILITY_PROFILE_SKELETONS,WIND_PROFILE_SKELETONS,STRUCTURAL_FAMILIES,engineeringProfilesFromProject,evaluateDurabilityBasis,generateWindLoads,normalizeWindConfig,profileSkeleton,windAuditFromProject,withEngineeringProfiles}from'../../web/src/projectWorkflow/windDurabilityProfiles.js';
import'./wind-durability.css';

const STORAGE_KEY='astrastruct.project';
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const readProject=()=>{try{return normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch{return normalizeProject({});}};
const numeric=(v:string)=>v===''?null:Number(v);
type Tab='durability'|'wind'|'audit';

function Num({label,value,onChange,unit='',step='.01'}:{label:string;value:any;onChange:(v:any)=>void;unit?:string;step?:string}){
  return <label>{label}{unit&&<small> [{unit}]</small>}<input type="number" step={step} value={value??''} onChange={e=>onChange(numeric(e.target.value))}/></label>;
}
function Badge({status}:{status:string}){return <span className={`wd-badge ${String(status).toLowerCase()}`}>{status}</span>}

export function WindDurabilityWorkbench(){
  const[open,setOpen]=useState(false);
  const[tab,setTab]=useState<Tab>('durability');
  const[project,setProject]=useState<any>(()=>readProject());
  const[profiles,setProfiles]=useState<any>(()=>engineeringProfilesFromProject(readProject()));
  const[msg,setMsg]=useState('');

  const refresh=()=>{const p=readProject();setProject(p);setProfiles(engineeringProfilesFromProject(p));setMsg('')};
  useEffect(()=>{const fn=()=>{refresh();setOpen(true)};window.addEventListener('astrastruct:wind-durability-open',fn);return()=>window.removeEventListener('astrastruct:wind-durability-open',fn)},[]);
  const commit=(p:any)=>{const q=normalizeProject(p);setProject(q);window.dispatchEvent(new CustomEvent('astrastruct:project-external-commit',{detail:{project:q}}))};
  const saveProfiles=()=>{const next=withEngineeringProfiles(project,profiles);commit(next);setProfiles(engineeringProfilesFromProject(next));setMsg('Perfis salvos. Tabelas normativas permanecem externas; somente regras explicitamente cadastradas são utilizadas.')};
  const durability=useMemo(()=>evaluateDurabilityBasis(project,profiles.durability),[project,profiles.durability]);
  const wind=useMemo(()=>windAuditFromProject(project,profiles.wind,profiles.windConfig),[project,profiles.wind,profiles.windConfig]);

  const setDurabilitySkeleton=(id:string)=>setProfiles((p:any)=>({...p,durability:profileSkeleton('durability',id)}));
  const setWindSkeleton=(id:string)=>setProfiles((p:any)=>({...p,wind:profileSkeleton('wind',id)}));
  const addRule=()=>setProfiles((p:any)=>({...p,durability:{...p.durability,rules:[...(p.durability.rules||[]),{id:`R${(p.durability.rules||[]).length+1}`,exposureClass:'*',family:'beam',minFckMpa:null,nominalCoverMm:null,note:'',clause:null}]}}));
  const patchRule=(i:number,key:string,value:any)=>setProfiles((p:any)=>{const rules=clone(p.durability.rules||[]);rules[i]={...rules[i],[key]:value};return{...p,durability:{...p.durability,rules}}});
  const removeRule=(i:number)=>setProfiles((p:any)=>({...p,durability:{...p.durability,rules:(p.durability.rules||[]).filter((_:any,j:number)=>j!==i)}}));
  const patchWind=(key:string,value:any)=>setProfiles((p:any)=>({...p,windConfig:normalizeWindConfig({...p.windConfig,[key]:value})}));
  const patchCF=(dir:string,value:any)=>setProfiles((p:any)=>({...p,windConfig:normalizeWindConfig({...p.windConfig,forceCoefficients:{...p.windConfig.forceCoefficients,[dir]:value}})}));
  const patchStory=(levelId:string,dir:string,key:string,value:any)=>setProfiles((p:any)=>{
    const currentLevel=p.windConfig.storyOverrides?.[levelId]||{};
    const currentDirection=currentLevel?.[dir]||{};
    return{...p,windConfig:normalizeWindConfig({...p.windConfig,storyOverrides:{...(p.windConfig.storyOverrides||{}),[levelId]:{...currentLevel,[dir]:{...currentDirection,[key]:value}}}})};
  });
  const generate=()=>{try{if(!wind.summary.rows)throw new Error('Wind: o modelo não possui pavimentos elegíveis acima da base. Cadastre/derive os níveis do edifício antes de gerar ações de vento.');const base=withEngineeringProfiles(project,profiles),next=generateWindLoads(base,wind);commit(next);setProfiles(engineeringProfilesFromProject(next));setMsg(`Casos de vento gerados: ${wind.config.directions.join(', ')}. Forças distribuídas aos nós dos pavimentos com trilha de auditoria.`)}catch(e:any){setMsg(e?.message||String(e))}};

  if(!open)return null;
  const tabs:[Tab,string][]=[['durability','Durabilidade'],['wind','Vento'],['audit','Auditoria']];
  const surface=<div className="wd-backdrop" data-testid="wind-durability-workbench">
    <section className="wd-shell" role="dialog" aria-modal="true" aria-label="Perfis de durabilidade e vento">
      <header><div><h2>Durabilidade + vento auditável · v0.53.2</h2><p>Perfis versionados sem tabelas normativas embutidas · geração rastreável de casos de vento</p></div><button aria-label="Fechar durabilidade e vento" onClick={()=>setOpen(false)}>×</button></header>
      <nav className="wd-tabs">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      {msg&&<div className="wd-message">{msg}</div>}

      {tab==='durability'&&<div className="wd-content">
        <section className="wd-card">
          <h3>Perfil de durabilidade</h3>
          <label>Base normativa<select data-testid="wd-durability-profile" value={profiles.durability.id} onChange={e=>setDurabilitySkeleton(e.target.value)}>{DURABILITY_PROFILE_SKELETONS.map((p:any)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <div className="wd-note">O AstraStruct registra norma e edição, mas não incorpora tabelas protegidas. Preencha as regras aplicáveis a partir da norma licenciada e das decisões do responsável técnico.</div>
          <div className="wd-actions"><button onClick={addRule}>Adicionar regra</button></div>
          <div className="wd-rule-table"><div className="head"><b>Exposição</b><b>Família</b><b>fck mín.</b><b>Cobrimento</b><b>Cláusula</b><b></b></div>{(profiles.durability.rules||[]).map((r:any,i:number)=><div key={r.id||i}><input value={r.exposureClass||'*'} onChange={e=>patchRule(i,'exposureClass',e.target.value)}/><select value={r.family} onChange={e=>patchRule(i,'family',e.target.value)}>{STRUCTURAL_FAMILIES.map((f:any)=><option key={f.id} value={f.id}>{f.label}</option>)}</select><input type="number" step="1" value={r.minFckMpa??''} onChange={e=>patchRule(i,'minFckMpa',numeric(e.target.value))} placeholder="MPa"/><input type="number" step="1" value={r.nominalCoverMm??''} onChange={e=>patchRule(i,'nominalCoverMm',numeric(e.target.value))} placeholder="mm"/><input value={r.clause??''} onChange={e=>patchRule(i,'clause',e.target.value||null)}/><button aria-label={`Excluir regra ${i+1}`} onClick={()=>removeRule(i)}>×</button></div>)}</div>
        </section>
        <section className="wd-card"><h3>Verificação da base do projeto</h3><div className="wd-statusline">Estado global <Badge status={durability.status}/></div>{durability.rows.map((r:any)=><article className={`wd-audit-row ${r.status.toLowerCase()}`} key={r.family}><strong>{r.label}</strong><Badge status={r.status}/><small>{r.message||r.checks?.map((c:any)=>c.ok===true?`${c.id}: OK`:c.ok===false?`${c.id}: NÃO ATENDE`:c.message).join(' · ')}</small></article>)}</section>
      </div>}

      {tab==='wind'&&<div className="wd-content">
        <section className="wd-card">
          <h3>Método de vento</h3>
          <label>Perfil<select data-testid="wd-wind-profile" value={profiles.wind.id} onChange={e=>setWindSkeleton(e.target.value)}>{WIND_PROFILE_SKELETONS.map((p:any)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          {profiles.wind.method==='velocity-factor-force'?<><div className="wd-grid"><Num label="Velocidade básica V0" unit="m/s" value={profiles.windConfig.basicSpeedMS} onChange={v=>patchWind('basicSpeedMS',v)}/><Num label="S1" value={profiles.windConfig.s1} onChange={v=>patchWind('s1',v)}/><Num label="S2" value={profiles.windConfig.s2} onChange={v=>patchWind('s2',v)}/><Num label="S3" value={profiles.windConfig.s3} onChange={v=>patchWind('s3',v)}/><Num label="Fator de vizinhança fv" value={profiles.windConfig.neighborhoodFactor} onChange={v=>patchWind('neighborhoodFactor',v)}/><Num label="Densidade do ar" unit="kg/m³" value={profiles.windConfig.airDensityKgM3} onChange={v=>patchWind('airDensityKgM3',v)}/></div><h4>Coeficiente de força/arrasto por direção</h4><div className="wd-grid">{profiles.windConfig.directions.map((d:string)=><Num key={d} label={d} value={profiles.windConfig.forceCoefficients?.[d]} onChange={v=>patchCF(d,v)}/>)}</div></>:<div className="wd-note">Neste perfil, a pressão característica/de pico é informada por pavimento e direção. O AstraStruct não reproduz mapas, categorias, NDPs ou tabelas da norma.</div>}
          <label className="wd-check"><input data-testid="wd-accept-auto-area" type="checkbox" checked={profiles.windConfig.acceptBoundingBoxArea===true} onChange={e=>patchWind('acceptBoundingBoxArea',e.target.checked)}/><span>Aceito usar a área projetada automática do envelope geométrico como base inicial, sujeita à minha revisão.</span></label>
          <div className="wd-note">Para geometria irregular, fachadas vazadas, recuos, vizinhança ou efeitos dinâmicos, informe áreas/coeficientes específicos e valide o modelo conforme a norma aplicável.</div>
        </section>
        <section className="wd-card">
          <h3>Forças por pavimento</h3>
          <div className="wd-wind-table"><div className="head"><b>Dir.</b><b>Pavimento</b><b>q</b><b>Cf/Ca</b><b>A</b><b>F</b><b>Estado</b></div>{wind.rows.map((r:any)=><div key={r.id}><span>{r.direction}</span><span>{r.levelName}</span>{profiles.wind.method==='direct-story-pressure'?<input aria-label={`Pressão ${r.id}`} type="number" step=".01" value={r.pressureKPa??''} placeholder="q kPa" onChange={e=>patchStory(r.levelId,r.direction,'pressureKPa',numeric(e.target.value))}/>:<span>{r.pressureKPa==null?'—':r.pressureKPa.toFixed(3)}</span>}<input aria-label={`Cf ${r.id}`} type="number" step=".01" value={r.forceCoefficient??''} onChange={e=>patchStory(r.levelId,r.direction,'forceCoefficient',numeric(e.target.value))}/><input aria-label={`Área ${r.id}`} type="number" step=".1" value={r.areaSource==='explicit'?r.projectedAreaM2??'':''} placeholder={r.autoProjectedAreaM2?.toFixed(2)} onChange={e=>patchStory(r.levelId,r.direction,'projectedAreaM2',numeric(e.target.value))}/><span>{r.forceKN==null?'—':r.forceKN.toFixed(2)}</span><span><Badge status={r.status}/></span></div>)}</div>
          <div className="wd-actions"><button onClick={saveProfiles}>Salvar configuração</button><button className="primary" data-testid="wd-generate-wind" onClick={generate} disabled={wind.summary.rows===0||wind.summary.pending>0}>Gerar casos de vento</button></div>
          <small>{wind.summary.rows===0?'Nenhum pavimento elegível acima da base. Cadastre ou derive os níveis do edifício antes de gerar vento.':`${wind.summary.ready}/${wind.summary.rows} linhas prontas. ${wind.summary.pending?`Faltam ${wind.summary.pending} linhas.`:'Pronto para geração.'}`}</small>
        </section>
      </div>}

      {tab==='audit'&&<div className="wd-content">
        <section className="wd-card"><h3>Trilha de auditoria</h3><p><b>Durabilidade:</b> {profiles.durability.standard} {profiles.durability.edition||''} · {profiles.durability.rules?.length||0} regras cadastradas · {durability.status}.</p><p><b>Vento:</b> {profiles.wind.standard} {profiles.wind.edition||''} · método <code>{profiles.wind.method}</code> · {wind.summary.ready}/{wind.summary.rows} linhas prontas.</p><div className="wd-totals">{Object.entries(wind.summary.totalForceByDirection||{}).map(([d,v]:any)=><div key={d}><span>{d}</span><strong>{Number(v).toFixed(2)} kN</strong></div>)}</div><div className="wd-note">Cada carga gerada recebe metadados com perfil, direção, pavimento, pressão, coeficiente, área, fonte da área e número de nós usados na distribuição. Regerar remove apenas cargas previamente criadas por este gerador.</div></section>
        <section className="wd-card"><h3>Governança</h3><p>Perfis são estruturas de dados versionadas, não cópias de normas. Classes de exposição, cobrimentos, fck mínimos, fatores de vento, coeficientes e pressões devem vir do responsável técnico, de ferramentas licenciadas ou de fontes normativas autorizadas.</p><button onClick={saveProfiles}>Salvar perfis no projeto</button></section>
      </div>}
      <footer><button onClick={refresh}>Recarregar</button><span>durability-profile/v1 · wind-method-profile/v1 · wind-audit/v1</span></footer>
    </section>
  </div>;
  return createPortal(surface,document.body);
}
