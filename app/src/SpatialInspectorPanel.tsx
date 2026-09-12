import React, { useEffect, useMemo, useState } from 'react';
// @ts-ignore
import { uid, normalizeProject } from '../../web/src/core/model.js';
import type { Selection } from './ModelingCanvas';

const clone=(v:any)=>JSON.parse(JSON.stringify(v));
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const positive=(v:any,f=0)=>Math.max(0,num(v,f));

export function SpatialInspectorPanel({project,selection,onCommit}:{project:any;selection:Selection;onCommit:(p:any)=>void}){
  const activeCase=project.settings?.activeLoadCaseId||project.loadCases?.[0]?.id;
  const entity=useMemo(()=>selection?.kind==='node'?project.nodes.find((n:any)=>n.id===selection.id):selection?.kind==='element'?project.elements.find((e:any)=>e.id===selection.id):null,[project,selection]);
  const [draft,setDraft]=useState<any>(null);

  useEffect(()=>{
    if(!entity){setDraft(null);return}
    if(selection?.kind==='node'){
      const support=project.supports.find((s:any)=>s.nodeId===entity.id)||{nodeId:entity.id,ux:false,uy:false,uz:false,rx:false,ry:false,rz:false};
      const load=project.loads.find((l:any)=>l.caseId===activeCase&&l.nodeId===entity.id)||{id:null,caseId:activeCase,nodeId:entity.id,fx:0,fy:0,fz:0,mx:0,my:0,mz:0};
      const nodalMass=(project.nodalMasses||[]).find((m:any)=>m.nodeId===entity.id)||{id:null,nodeId:entity.id,mx:0,my:0,mz:0,mrx:0,mry:0,mrz:0};
      setDraft({x:entity.x,y:entity.y,z:entity.z||0,support:clone(support),load:clone(load),nodalMass:clone(nodalMass)});
      return;
    }
    const uniform=(project.elementLoads||[]).find((l:any)=>l.caseId===activeCase&&l.elementId===entity.id&&l.kind==='uniform')||{id:null,caseId:activeCase,elementId:entity.id,kind:'uniform',qx:0,qy:0,qz:0};
    const up=entity.orientation?.up||entity.localY||[0,0,0];
    setDraft({
      label:entity.label||entity.id,
      materialId:entity.materialId,
      sectionId:entity.sectionId,
      A:entity.A,
      Iy:entity.Iy,
      Iz:entity.Iz,
      J:entity.J,
      orientation:{x:num(up?.[0]),y:num(up?.[1]),z:num(up?.[2])},
      uniform:clone(uniform)
    });
  },[entity?.id,selection?.kind,activeCase,project]);

  if(!entity||!draft)return <div className="empty-state">Selecione um nó ou elemento espacial no modelo.</div>;

  const applyNode=()=>{
    const p=clone(project),n=p.nodes.find((x:any)=>x.id===entity.id);
    n.x=num(draft.x);n.y=num(draft.y);n.z=num(draft.z);
    p.supports=(p.supports||[]).filter((s:any)=>s.nodeId!==entity.id);
    const s={...draft.support,nodeId:entity.id};
    if(['ux','uy','uz','rx','ry','rz'].some(k=>!!s[k]))p.supports.push(s);
    p.loads=(p.loads||[]).filter((l:any)=>!(l.caseId===activeCase&&l.nodeId===entity.id));
    const load={...draft.load,id:draft.load.id||uid('L3D'),caseId:activeCase,nodeId:entity.id,fx:num(draft.load.fx),fy:num(draft.load.fy),fz:num(draft.load.fz),mx:num(draft.load.mx),my:num(draft.load.my),mz:num(draft.load.mz)};
    if(['fx','fy','fz','mx','my','mz'].some(k=>Math.abs(num(load[k]))>1e-12))p.loads.push(load);
    p.nodalMasses=(p.nodalMasses||[]).filter((m:any)=>m.nodeId!==entity.id);
    const mass={...draft.nodalMass,id:draft.nodalMass?.id||uid('MASS3D'),nodeId:entity.id,mx:positive(draft.nodalMass?.mx),my:positive(draft.nodalMass?.my),mz:positive(draft.nodalMass?.mz),mrx:positive(draft.nodalMass?.mrx),mry:positive(draft.nodalMass?.mry),mrz:positive(draft.nodalMass?.mrz??draft.nodalMass?.mr)};
    if(['mx','my','mz','mrx','mry','mrz'].some(k=>mass[k]>0))p.nodalMasses.push(mass);
    onCommit(normalizeProject(p));
  };

  const applyElement=()=>{
    const p=clone(project),e=p.elements.find((x:any)=>x.id===entity.id);
    e.label=draft.label;e.materialId=draft.materialId;e.sectionId=draft.sectionId;e.A=Math.max(1e-12,num(draft.A));
    const section=p.sections.find((s:any)=>s.id===draft.sectionId)||{};
    if(Number(section.A)>0)e.A=Number(section.A);
    if(e.type==='frame3d'){
      e.Iy=Math.max(1e-16,num(draft.Iy,section.Iy??section.I));
      e.Iz=Math.max(1e-16,num(draft.Iz,section.Iz??section.I));
      e.J=Math.max(1e-16,num(draft.J,section.J));
      if(Number(section.Iy??section.I)>0)e.Iy=Number(section.Iy??section.I);
      if(Number(section.Iz??section.I)>0)e.Iz=Number(section.Iz??section.I);
      if(Number(section.J)>0)e.J=Number(section.J);
      const up=[num(draft.orientation?.x),num(draft.orientation?.y),num(draft.orientation?.z)];
      if(Math.hypot(...up)>1e-10)e.orientation={...(e.orientation||{}),up};else delete e.orientation;
      p.elementLoads=(p.elementLoads||[]).filter((l:any)=>!(l.caseId===activeCase&&l.elementId===entity.id&&l.kind==='uniform'));
      const q={...draft.uniform,id:draft.uniform.id||uid('UDL3D'),caseId:activeCase,elementId:entity.id,kind:'uniform',qx:num(draft.uniform.qx),qy:num(draft.uniform.qy),qz:num(draft.uniform.qz)};
      if(Math.abs(q.qx)+Math.abs(q.qy)+Math.abs(q.qz)>1e-12)p.elementLoads.push(q);
    }else{
      p.elementLoads=(p.elementLoads||[]).filter((l:any)=>!(l.caseId===activeCase&&l.elementId===entity.id&&l.kind==='uniform'));
    }
    onCommit(normalizeProject(p));
  };

  const remove=()=>{
    const p=clone(project);
    if(selection?.kind==='node'){
      const connected=p.elements.filter((e:any)=>e.n1===entity.id||e.n2===entity.id).map((e:any)=>e.id);
      p.nodes=p.nodes.filter((n:any)=>n.id!==entity.id);
      p.elements=p.elements.filter((e:any)=>!connected.includes(e.id));
      p.supports=p.supports.filter((s:any)=>s.nodeId!==entity.id);
      p.loads=p.loads.filter((l:any)=>l.nodeId!==entity.id);
      p.nodalMasses=(p.nodalMasses||[]).filter((m:any)=>m.nodeId!==entity.id);
      p.settlements=(p.settlements||[]).filter((s:any)=>s.nodeId!==entity.id);
      p.nodeSprings=(p.nodeSprings||[]).filter((s:any)=>s.nodeId!==entity.id);
      p.elementLoads=p.elementLoads.filter((l:any)=>!connected.includes(l.elementId));
    }else{
      p.elements=p.elements.filter((e:any)=>e.id!==entity.id);
      p.elementLoads=p.elementLoads.filter((l:any)=>l.elementId!==entity.id);
    }
    onCommit(normalizeProject(p));
  };

  if(selection?.kind==='node')return <div className="react-inspector spatial-inspector" data-testid="spatial-inspector-node">
    <div className="inspector-title"><div><b>{entity.id}</b><small>Nó 3D · 6 DOFs</small></div><button className="danger small" onClick={remove}>Excluir</button></div>
    <div className="inspector-grid spatial-three"><label>X [m]<input data-testid="spatial-node-x" type="number" step=".05" value={draft.x} onChange={e=>setDraft({...draft,x:e.target.value})}/></label><label>Y [m]<input data-testid="spatial-node-y" type="number" step=".05" value={draft.y} onChange={e=>setDraft({...draft,y:e.target.value})}/></label><label>Z [m]<input data-testid="spatial-node-z" type="number" step=".05" value={draft.z} onChange={e=>setDraft({...draft,z:e.target.value})}/></label></div>
    <h4>Apoio / restrições espaciais</h4>
    <div className="check-grid spatial-six">{(['ux','uy','uz','rx','ry','rz'] as const).map(k=><label key={k}><input data-testid={`spatial-support-${k}`} type="checkbox" checked={!!draft.support[k]} onChange={e=>setDraft({...draft,support:{...draft.support,[k]:e.target.checked}})}/> {k.toUpperCase()}</label>)}</div>
    <h4>Carga nodal · {activeCase}</h4>
    <div className="inspector-grid spatial-three"><label>Fx [kN]<input type="number" value={draft.load.fx??0} onChange={e=>setDraft({...draft,load:{...draft.load,fx:e.target.value}})}/></label><label>Fy [kN]<input type="number" value={draft.load.fy??0} onChange={e=>setDraft({...draft,load:{...draft.load,fy:e.target.value}})}/></label><label>Fz [kN]<input data-testid="spatial-load-fz" type="number" value={draft.load.fz??0} onChange={e=>setDraft({...draft,load:{...draft.load,fz:e.target.value}})}/></label><label>Mx [kN·m]<input type="number" value={draft.load.mx??0} onChange={e=>setDraft({...draft,load:{...draft.load,mx:e.target.value}})}/></label><label>My [kN·m]<input type="number" value={draft.load.my??0} onChange={e=>setDraft({...draft,load:{...draft.load,my:e.target.value}})}/></label><label>Mz [kN·m]<input type="number" value={draft.load.mz??0} onChange={e=>setDraft({...draft,load:{...draft.load,mz:e.target.value}})}/></label></div>
    <h4>Massa nodal adicional</h4>
    <div className="inspector-grid spatial-three"><label>mx [t]<input type="number" min="0" value={draft.nodalMass?.mx??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,mx:e.target.value}})}/></label><label>my [t]<input type="number" min="0" value={draft.nodalMass?.my??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,my:e.target.value}})}/></label><label>mz [t]<input type="number" min="0" value={draft.nodalMass?.mz??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,mz:e.target.value}})}/></label><label>Jx [t·m²]<input type="number" min="0" value={draft.nodalMass?.mrx??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,mrx:e.target.value}})}/></label><label>Jy [t·m²]<input type="number" min="0" value={draft.nodalMass?.mry??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,mry:e.target.value}})}/></label><label>Jz [t·m²]<input type="number" min="0" value={draft.nodalMass?.mrz??draft.nodalMass?.mr??0} onChange={e=>setDraft({...draft,nodalMass:{...draft.nodalMass,mrz:e.target.value}})}/></label></div>
    <button className="inspector-apply" data-testid="spatial-node-apply" onClick={applyNode}>Aplicar alterações</button>
    <p className="hint">O kernel espacial usa Ux, Uy, Uz, Rx, Ry e Rz por nó. Massas translacionais e rotacionais são consideradas na análise modal 3D.</p>
  </div>;

  const isFrame=entity.type==='frame3d';
  return <div className="react-inspector spatial-inspector" data-testid="spatial-inspector-element">
    <div className="inspector-title"><div><b>{entity.id}</b><small>{entity.type}</small></div><button className="danger small" onClick={remove}>Excluir</button></div>
    <label className="wide-label">Nome<input value={draft.label} onChange={e=>setDraft({...draft,label:e.target.value})}/></label>
    <label className="wide-label">Material<select data-testid="spatial-material" value={draft.materialId} onChange={e=>setDraft({...draft,materialId:e.target.value})}>{project.materials.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label className="wide-label">Seção<select data-testid="spatial-section" value={draft.sectionId} onChange={e=>setDraft({...draft,sectionId:e.target.value})}>{project.sections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="inspector-grid spatial-three"><label>A [m²]<input type="number" value={draft.A??0} onChange={e=>setDraft({...draft,A:e.target.value})}/></label>{isFrame&&<><label>Iy [m⁴]<input data-testid="spatial-iy" type="number" value={draft.Iy??0} onChange={e=>setDraft({...draft,Iy:e.target.value})}/></label><label>Iz [m⁴]<input data-testid="spatial-iz" type="number" value={draft.Iz??0} onChange={e=>setDraft({...draft,Iz:e.target.value})}/></label><label>J [m⁴]<input data-testid="spatial-j" type="number" value={draft.J??0} onChange={e=>setDraft({...draft,J:e.target.value})}/></label></>}</div>
    {isFrame&&<><h4>Orientação local · vetor de referência</h4><div className="inspector-grid spatial-three"><label>up X<input type="number" step=".1" value={draft.orientation.x} onChange={e=>setDraft({...draft,orientation:{...draft.orientation,x:e.target.value}})}/></label><label>up Y<input type="number" step=".1" value={draft.orientation.y} onChange={e=>setDraft({...draft,orientation:{...draft.orientation,y:e.target.value}})}/></label><label>up Z<input type="number" step=".1" value={draft.orientation.z} onChange={e=>setDraft({...draft,orientation:{...draft.orientation,z:e.target.value}})}/></label></div><p className="hint">Vetor zero usa a orientação automática robusta do kernel espacial.</p><h4>Carga uniforme local · {activeCase}</h4><div className="inspector-grid spatial-three"><label>qx [kN/m]<input type="number" value={draft.uniform.qx??0} onChange={e=>setDraft({...draft,uniform:{...draft.uniform,qx:e.target.value}})}/></label><label>qy [kN/m]<input type="number" value={draft.uniform.qy??0} onChange={e=>setDraft({...draft,uniform:{...draft.uniform,qy:e.target.value}})}/></label><label>qz [kN/m]<input data-testid="spatial-qz" type="number" value={draft.uniform.qz??0} onChange={e=>setDraft({...draft,uniform:{...draft.uniform,qz:e.target.value}})}/></label></div></>}
    {!isFrame&&<div className="panel-note">Treliças 3D usam somente rigidez axial A·E. Cargas distribuídas de barra permanecem desabilitadas pelo kernel espacial atual.</div>}
    <button className="inspector-apply" data-testid="spatial-element-apply" onClick={applyElement}>Aplicar alterações</button>
    <p className="hint">Ao escolher uma seção espacial, A, Iy, Iz e J são sincronizados com a biblioteca quando disponíveis.</p>
  </div>;
}
