import React,{useEffect,useMemo,useRef,useState} from 'react';
// @ts-ignore
import {inspectIfcExchangeReadiness,prepareIfcExchange,safeIfcFilename,createIfcImportStaging} from '../../web/src/interop/index.js';
// @ts-ignore
import {PRODUCT_VERSION} from '../../web/src/core/version.js';
import './ifc-exchange.css';

const PROJECT_KEY='astrastruct.project';
const OWNER_KEY='astrastruct.ifc.owner.v045';
const IMPORT_BACKUP_KEY='astrastruct.ifc.import.backup.v046';
const stateKey=(projectId:string)=>`astrastruct.ifc.v045:${projectId}`;
const readJson=(key:string)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}};
const readProject=()=>{const p=readJson(PROJECT_KEY);if(!p)throw new Error('Nenhum projeto persistido foi encontrado.');return p};
const initialOwner=()=>{const saved=readJson(OWNER_KEY)||{};return{identification:String(saved.identification||''),givenName:String(saved.givenName||''),familyName:String(saved.familyName||''),organizationId:String(saved.organizationId||''),organizationName:String(saved.organizationName||'')}};
const ownerMetadata=(owner:any)=>({person:{identification:owner.identification,givenName:owner.givenName,familyName:owner.familyName},organization:{identification:owner.organizationId,name:owner.organizationName},application:{version:PRODUCT_VERSION,fullName:'AstraStruct',identifier:'ASTRASTRUCT'}});
const personValid=(o:any)=>!!(o.identification.trim()||o.givenName.trim()||o.familyName.trim());

export function IfcExchangeShell({children}:{children:React.ReactNode}){
  const[open,setOpen]=useState(false),[project,setProject]=useState<any>(null),[owner,setOwner]=useState(initialOwner),[message,setMessage]=useState(''),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false);const fileRef=useRef<HTMLInputElement|null>(null);
  const inspection:any=useMemo(()=>{if(!project)return null;try{return inspectIfcExchangeReadiness(project)}catch(e:any){return{error:e?.message||String(e),ready:false,summary:null,mapping:{entries:[]},loadMapping:{issues:[]},loadSummary:null}}},[project]);
  const refresh=()=>{try{setProject(readProject());setMessage('');setPreview(null)}catch(e:any){setMessage(e?.message||String(e))}};
  const show=()=>{setOpen(true);refresh()};
  useEffect(()=>{const openIfc=()=>show();window.addEventListener('astrastruct:ifc-open',openIfc);return()=>window.removeEventListener('astrastruct:ifc-open',openIfc)},[]);
  const change=(key:string,value:string)=>{const next={...owner,[key]:value};setOwner(next);localStorage.setItem(OWNER_KEY,JSON.stringify(next))};
  const canExport=!!project&&!busy&&!inspection?.error&&inspection?.ready&&personValid(owner)&&owner.organizationName.trim();
  const canImport=!!preview&&!busy&&!!preview.readiness?.commitReady;
  const exportIfc=()=>{if(!canExport)return;setBusy(true);setMessage('');try{
    const filename=safeIfcFilename(project),existing=readJson(stateKey(project.id))||project?.ifcImport?.exchangeStateSeed||null;
    const prepared=prepareIfcExchange(project,{state:existing,ownerMetadata:ownerMetadata(owner),timestamp:new Date().toISOString(),fileName:filename});
    localStorage.setItem(stateKey(project.id),JSON.stringify(prepared.state));
    const blob=new Blob([prepared.step],{type:'application/x-step'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    const loadText=prepared.readiness.loadSummary?` · ${prepared.readiness.loadSummary.loadCases} casos · ${prepared.readiness.loadSummary.actions} ações`:'';
    setMessage(`IFC4X3 gerado: ${prepared.envelope.entities} entidades · ${prepared.readiness.curveMembers} barras · ${prepared.readiness.surfaceMembers} superfícies${loadText}.`);
  }catch(e:any){setMessage(e?.message||String(e))}finally{setBusy(false)}};
  const inspectFile=(file:File)=>{setBusy(true);setMessage('');const reader=new FileReader();reader.onload=()=>{try{const staged=createIfcImportStaging(String(reader.result));setPreview(staged);setMessage(`IFC preparado: ${staged.summary.nodes} nós · ${staged.summary.elements} elementos · ${staged.summary.loadCases} casos · ${staged.summary.nodalLoads+staged.summary.elementLoads} ações · importação ${staged.readiness.commitReady?'READY':'PENDING'} · análise ${staged.readiness.analysisReady?'READY':'PENDING'}.`)}catch(e:any){setPreview(null);setMessage(e?.message||String(e))}finally{setBusy(false)}};reader.onerror=()=>{setPreview(null);setBusy(false);setMessage('Não foi possível ler o arquivo IFC selecionado.')};reader.readAsText(file)};
  const importIfc=()=>{if(!canImport)return;setBusy(true);setMessage('');try{
    const current=readProject(),backup={createdAt:new Date().toISOString(),sourceProjectId:current.id||null,incomingProjectGlobalId:preview.project?.ifcImport?.projectGlobalId||null,project:current};
    localStorage.setItem(IMPORT_BACKUP_KEY,JSON.stringify(backup));
    const seed=preview.project?.ifcImport?.exchangeStateSeed;if(seed)localStorage.setItem(stateKey(preview.project.id),JSON.stringify(seed));
    localStorage.setItem(PROJECT_KEY,JSON.stringify(preview.project));
    location.reload();
  }catch(e:any){setMessage(e?.message||String(e));setBusy(false)}};
  return <>
    {children}
    {open&&<div className="ifc-exchange-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="ifc-exchange-panel" role="dialog" aria-modal="true" aria-label="Intercâmbio IFC4X3" data-testid="ifc-exchange-panel">
        <header><div><strong>Intercâmbio IFC4X3</strong><span>v{PRODUCT_VERSION} · importação controlada · ISO 16739-1:2024</span></div><button aria-label="Fechar intercâmbio IFC" onClick={()=>setOpen(false)}>×</button></header>
        <div className="ifc-exchange-body">
          <div className="ifc-exchange-status">
            <div><span>Projeto</span><b>{project?.name||'—'}</b></div><div><span>Schema</span><b>IFC4X3_ADD2</b></div><div><span>Readiness</span><b data-testid="ifc-readiness" className={inspection?.ready?'ok':'pending'}>{inspection?.ready?'READY':'PENDING'}</b></div><div><span>Mapeamento</span><b>{inspection?.summary?`${inspection.summary.ready}/${inspection.summary.total}`:'—'}</b></div>
          </div>
          {inspection?.error&&<div className="ifc-exchange-alert error">{inspection.error}</div>}
          {!!inspection?.summary?.pending&&<div className="ifc-exchange-alert"><b>Exportação bloqueada:</b> {inspection.mapping.entries.filter((x:any)=>x.status==='PENDING').map((x:any)=>`${x.memberId} — ${x.reason}`).join('; ')}. Perfis não são inferidos de A/I/J.</div>}
          {!!inspection?.loadMapping?.issues?.length&&<div className="ifc-exchange-alert"><b>Cargas IFC pendentes:</b> {inspection.loadMapping.issues.slice(0,8).map((x:any)=>`${x.code} — ${x.message}`).join('; ')}</div>}
          {inspection?.loadSummary&&<div className="ifc-exchange-hint">Cargas: {inspection.loadSummary.cases} casos · {inspection.loadSummary.combinations} combinações · {inspection.loadSummary.actions} ações · {inspection.loadSummary.ready?'READY':'PENDING'}.</div>}
          <fieldset><legend>Autoria e aplicação</legend><div className="ifc-form-grid"><label>Identificação da pessoa<input value={owner.identification} onChange={e=>change('identification',e.target.value)} placeholder="ex.: nome, ORCID ou ID interno"/></label><label>Nome<input value={owner.givenName} onChange={e=>change('givenName',e.target.value)}/></label><label>Sobrenome<input value={owner.familyName} onChange={e=>change('familyName',e.target.value)}/></label><label>ID da organização<input value={owner.organizationId} onChange={e=>change('organizationId',e.target.value)}/></label><label className="wide">Organização *<input value={owner.organizationName} onChange={e=>change('organizationName',e.target.value)} placeholder="obrigatório"/></label></div><small>AstraStruct v{PRODUCT_VERSION} será registrado como IfcApplication. O sistema não inventa responsável técnico.</small></fieldset>
          <div className="ifc-mapping-table"><div className="head"><span>Membro</span><span>IFC</span><span>Material</span><span>Status</span></div>{(inspection?.mapping?.entries||[]).map((x:any)=><div className="row" key={x.memberKey}><span>{x.memberId}</span><span>{x.memberClass==='IfcStructuralSurfaceMember'?'SurfaceMember':'CurveMember'}</span><span>{x.mode==='MATERIAL_PROFILE_SET'?'ProfileSet':x.mode==='DIRECT_MATERIAL'?'Material direto':'—'}</span><span className={x.status==='READY'?'ok':'pending'}>{x.status}</span></div>)}</div>
          <div className="ifc-exchange-actions"><button onClick={refresh}>Reavaliar projeto</button><button onClick={()=>fileRef.current?.click()}>Pré-importar arquivo IFC</button><button className="primary" data-testid="ifc-export-button" disabled={!canExport} onClick={exportIfc}>{busy?'Processando…':'Exportar IFC4X3'}</button></div>
          <input ref={fileRef} hidden type="file" accept=".ifc,.ifcspf,application/x-step" onChange={e=>{const f=e.target.files?.[0];if(f)inspectFile(f);e.currentTarget.value=''}}/>
          {!personValid(owner)&&<div className="ifc-exchange-hint">Informe ao menos uma identificação da pessoa para habilitar a exportação.</div>}
          {!owner.organizationName.trim()&&<div className="ifc-exchange-hint">Informe a organização para habilitar a exportação.</div>}
          {preview&&<div className="ifc-preview" data-testid="ifc-preview">
            <b>Pré-importação estrutural IFC</b><span>{preview.project.name}</span><span>{preview.summary.nodes} nós · {preview.summary.elements} elementos · {preview.summary.materials} materiais · {preview.summary.sections} seções</span><span>{preview.summary.loadCases} casos · {preview.summary.loadCombinations} combinações · {preview.summary.nodalLoads} cargas nodais · {preview.summary.elementLoads} cargas de barra</span>
            <div className="ifc-preview-readiness"><span>Geometria <b className={preview.readiness.geometryReady?'ok':'pending'}>{preview.readiness.geometryReady?'READY':'PENDING'}</b></span><span>Cargas <b className={preview.readiness.loadReady?'ok':'pending'}>{preview.readiness.loadReady?'READY':'PENDING'}</b></span><span>Importação <b className={preview.readiness.commitReady?'ok':'pending'}>{preview.readiness.commitReady?'READY':'PENDING'}</b></span><span>Análise <b className={preview.readiness.analysisReady?'ok':'pending'}>{preview.readiness.analysisReady?'READY':'PENDING'}</b></span></div>
            {!!preview.readiness.analysisIssues?.length&&<div className="ifc-import-issues">{preview.readiness.analysisIssues.slice(0,10).map((x:any,i:number)=><span key={`${x.code}-${i}`}>{x.code}: {x.message}</span>)}</div>}
            <small>O arquivo ainda não substituiu o projeto aberto. A importação só ocorre se geometria e cargas suportadas estiverem completas, cria um backup local e preserva GlobalIds para reexportação.</small>
            <div className="ifc-exchange-actions"><button className="primary" data-testid="ifc-import-button" disabled={!canImport} onClick={importIfc}>{preview.readiness.analysisReady?'Importar projeto IFC':'Importar projeto (análise pendente)'}</button></div>
          </div>}
          {message&&<div className="ifc-exchange-message" role="status">{message}</div>}
          <div className="ifc-exchange-note">A exportação preserva GlobalIds de estrutura, materiais e cargas. A pré-importação valida unidades, topologia, perfis, apoios/molas, casos, ações, combinações e propriedades mecânicas antes de permitir a substituição do modelo.</div>
        </div>
      </section>
    </div>}
  </>;
}
