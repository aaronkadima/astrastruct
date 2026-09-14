import React,{useMemo,useRef,useState} from 'react';
// @ts-ignore
import {inspectIfcExchangeReadiness,prepareIfcExchange,safeIfcFilename,parseIfcStructuralStep} from '../../web/src/interop/index.js';
import './ifc-exchange.css';

const PROJECT_KEY='astrastruct.project';
const OWNER_KEY='astrastruct.ifc.owner.v045';
const stateKey=(projectId:string)=>`astrastruct.ifc.v045:${projectId}`;
const readJson=(key:string)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}};
const readProject=()=>{const p=readJson(PROJECT_KEY);if(!p)throw new Error('Nenhum projeto persistido foi encontrado.');return p};
const initialOwner=()=>{const saved=readJson(OWNER_KEY)||{};return{identification:String(saved.identification||''),givenName:String(saved.givenName||''),familyName:String(saved.familyName||''),organizationId:String(saved.organizationId||''),organizationName:String(saved.organizationName||'')}};
const ownerMetadata=(owner:any)=>({person:{identification:owner.identification,givenName:owner.givenName,familyName:owner.familyName},organization:{identification:owner.organizationId,name:owner.organizationName},application:{version:'0.45.0-exp',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}});
const personValid=(o:any)=>!!(o.identification.trim()||o.givenName.trim()||o.familyName.trim());

export function IfcExchangeShell({children}:{children:React.ReactNode}){
  const[open,setOpen]=useState(false),[project,setProject]=useState<any>(null),[owner,setOwner]=useState(initialOwner),[message,setMessage]=useState(''),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false);const fileRef=useRef<HTMLInputElement|null>(null);
  const inspection:any=useMemo(()=>{if(!project)return null;try{return inspectIfcExchangeReadiness(project)}catch(e:any){return{error:e?.message||String(e),ready:false,summary:null,mapping:{entries:[]}}}},[project]);
  const refresh=()=>{try{setProject(readProject());setMessage('');setPreview(null)}catch(e:any){setMessage(e?.message||String(e))}};
  const show=()=>{setOpen(true);refresh()};
  const change=(key:string,value:string)=>{const next={...owner,[key]:value};setOwner(next);localStorage.setItem(OWNER_KEY,JSON.stringify(next))};
  const canExport=!!project&&!busy&&!inspection?.error&&inspection?.ready&&personValid(owner)&&owner.organizationName.trim();
  const exportIfc=()=>{if(!canExport)return;setBusy(true);setMessage('');try{
    const filename=safeIfcFilename(project),existing=readJson(stateKey(project.id));
    const prepared=prepareIfcExchange(project,{state:existing,ownerMetadata:ownerMetadata(owner),timestamp:new Date().toISOString(),fileName:filename});
    localStorage.setItem(stateKey(project.id),JSON.stringify(prepared.state));
    const blob=new Blob([prepared.step],{type:'application/x-step'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    setMessage(`IFC4X3 gerado: ${prepared.envelope.entities} entidades · ${prepared.readiness.curveMembers} barras · ${prepared.readiness.surfaceMembers} superfícies.`);
  }catch(e:any){setMessage(e?.message||String(e))}finally{setBusy(false)}};
  const inspectFile=(file:File)=>{const reader=new FileReader();reader.onload=()=>{try{const parsed=parseIfcStructuralStep(String(reader.result));setPreview(parsed);setMessage(`IFC lido: ${parsed.nodes.length} nós · ${parsed.members.length} membros · ${parsed.materials.length} associações de material.`)}catch(e:any){setPreview(null);setMessage(e?.message||String(e))}};reader.readAsText(file)};
  return <>
    {children}
    <button className="ifc-exchange-trigger" aria-label="Intercâmbio IFC" onClick={show}><span>IFC</span><small>4.3</small></button>
    {open&&<div className="ifc-exchange-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="ifc-exchange-panel" role="dialog" aria-modal="true" aria-label="Intercâmbio IFC4X3" data-testid="ifc-exchange-panel">
        <header><div><strong>Intercâmbio IFC4X3</strong><span>v0.45 experimental · ISO 16739-1:2024</span></div><button aria-label="Fechar intercâmbio IFC" onClick={()=>setOpen(false)}>×</button></header>
        <div className="ifc-exchange-body">
          <div className="ifc-exchange-status">
            <div><span>Projeto</span><b>{project?.name||'—'}</b></div><div><span>Schema</span><b>IFC4X3_ADD2</b></div><div><span>Readiness</span><b data-testid="ifc-readiness" className={inspection?.ready?'ok':'pending'}>{inspection?.ready?'READY':'PENDING'}</b></div><div><span>Mapeamento</span><b>{inspection?.summary?`${inspection.summary.ready}/${inspection.summary.total}`:'—'}</b></div>
          </div>
          {inspection?.error&&<div className="ifc-exchange-alert error">{inspection.error}</div>}
          {!!inspection?.summary?.pending&&<div className="ifc-exchange-alert"><b>Exportação bloqueada:</b> {inspection.mapping.entries.filter((x:any)=>x.status==='PENDING').map((x:any)=>`${x.memberId} — ${x.reason}`).join('; ')}. Perfis não são inferidos de A/I/J.</div>}
          <fieldset><legend>Autoria e aplicação</legend><div className="ifc-form-grid"><label>Identificação da pessoa<input value={owner.identification} onChange={e=>change('identification',e.target.value)} placeholder="ex.: nome, ORCID ou ID interno"/></label><label>Nome<input value={owner.givenName} onChange={e=>change('givenName',e.target.value)}/></label><label>Sobrenome<input value={owner.familyName} onChange={e=>change('familyName',e.target.value)}/></label><label>ID da organização<input value={owner.organizationId} onChange={e=>change('organizationId',e.target.value)}/></label><label className="wide">Organização *<input value={owner.organizationName} onChange={e=>change('organizationName',e.target.value)} placeholder="obrigatório"/></label></div><small>AstraStruct v0.45.0-exp será registrado como IfcApplication. O sistema não inventa responsável técnico.</small></fieldset>
          <div className="ifc-mapping-table"><div className="head"><span>Membro</span><span>IFC</span><span>Material</span><span>Status</span></div>{(inspection?.mapping?.entries||[]).map((x:any)=><div className="row" key={x.memberKey}><span>{x.memberId}</span><span>{x.memberClass==='IfcStructuralSurfaceMember'?'SurfaceMember':'CurveMember'}</span><span>{x.mode==='MATERIAL_PROFILE_SET'?'ProfileSet':x.mode==='DIRECT_MATERIAL'?'Material direto':'—'}</span><span className={x.status==='READY'?'ok':'pending'}>{x.status}</span></div>)}</div>
          <div className="ifc-exchange-actions"><button onClick={refresh}>Reavaliar projeto</button><button onClick={()=>fileRef.current?.click()}>Validar arquivo IFC</button><button className="primary" data-testid="ifc-export-button" disabled={!canExport} onClick={exportIfc}>{busy?'Gerando…':'Exportar IFC4X3'}</button></div>
          <input ref={fileRef} hidden type="file" accept=".ifc,.ifcspf,application/x-step" onChange={e=>{const f=e.target.files?.[0];if(f)inspectFile(f);e.currentTarget.value=''}}/>
          {!personValid(owner)&&<div className="ifc-exchange-hint">Informe ao menos uma identificação da pessoa para habilitar a exportação.</div>}
          {!owner.organizationName.trim()&&<div className="ifc-exchange-hint">Informe a organização para habilitar a exportação.</div>}
          {preview&&<div className="ifc-preview" data-testid="ifc-preview"><b>Arquivo validado pelo parser AstraStruct</b><span>{preview.project.name}</span><span>{preview.nodes.length} nós · {preview.members.length} membros · {preview.materials.length} materiais associados</span><small>Esta etapa inspeciona o subconjunto IFC suportado; não substitui o projeto aberto.</small></div>}
          {message&&<div className="ifc-exchange-message" role="status">{message}</div>}
          <div className="ifc-exchange-note">O exportador usa GlobalIds persistentes por projeto. “Validar arquivo IFC” faz leitura/inspeção do subconjunto estrutural suportado e não sobrescreve o modelo atual.</div>
        </div>
      </section>
    </div>}
  </>;
}
