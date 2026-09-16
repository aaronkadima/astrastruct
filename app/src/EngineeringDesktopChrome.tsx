import React,{useEffect,useRef,useState}from'react';
// @ts-ignore
import{nbr6118Baseline,validateNBR6118Baseline}from'../../web/src/core/nbr6118Baseline.js';
// @ts-ignore
import{emptyProject,demoFrame,demoBeamUDL,demoTruss,demoMixed,demoSpatialFrame}from'../../web/src/core/model.js';
// @ts-ignore
import{demoFiveStoreyBuilding3D,demoSteelWarehouse3D,demoWaterTank3D,demoIsolatedBeamLab3D,demoIsolatedColumnLab3D,demoSpringLab3D}from'../../web/src/core/exampleModels.js';
import{openIsolatedLab}from'./labRegistry';

type Props={
  project:any;
  result:any;
  activeScenario?:string;
  onScenarioChange:(id:string)=>void;
  onAnalyze:()=>void;
  onOpenPanel:(name:any)=>void;
  onCommit:(p:any,record?:boolean)=>void;
};

const fmt=(v:any,d=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);
const projectLevels=(p:any)=>{
  const explicit=(p.levels||[])
    .filter((x:any)=>Number.isFinite(Number(x.elevation)))
    .sort((a:any,b:any)=>Number(a.elevation)-Number(b.elevation));
  if(explicit.length)return explicit;
  const zs=[...new Set((p.nodes||[]).map((n:any)=>Number(n.z)||0))].sort((a:number,b:number)=>a-b);
  return zs.map((z:number,i:number)=>({id:`Z${i}`,name:i===0?'Base':`Pav. ${i}`,elevation:z}));
};
const countType=(p:any,type:string)=>(p.elements||[]).filter((e:any)=>e.type===type).length;

const RibbonIcon=({name}:{name:string})=>{
  const common={stroke:'#1565c0',strokeWidth:1.5,fill:'none'};
  return <svg className="eng-ribbon-icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
    {name==='launch'&&<><rect x="3" y="3" width="7" height="7" rx="1" {...common}/><rect x="12" y="3" width="7" height="7" rx="1" {...common}/><rect x="3" y="12" width="7" height="7" rx="1" {...common}/><path d="M10 6.5h2M6.5 10v2M15.5 10v9M12 15.5h7" {...common} strokeDasharray="1.5 1.5"/></>}
    {name==='analysis'&&<><polyline points="2,18 7,10 11,14 15,6 20,9" stroke="#1565c0" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" fill="none"/><circle cx="20" cy="9" r="2" fill="#1565c0"/><line x1="2" y1="18" x2="20" y2="18" stroke="#1565c0" strokeWidth="1.2" opacity=".4"/></>}
    {name==='combinations'&&<><rect x="2" y="2" width="18" height="18" rx="2" {...common}/><path d="M2 8h18M2 14h18M8 2v18M14 2v18" stroke="#1565c0"/></>}
    {name==='results'&&<><rect x="2" y="12" width="4" height="8" rx="1" fill="#1565c0" opacity=".7"/><rect x="8" y="7" width="4" height="13" rx="1" fill="#1565c0"/><rect x="14" y="4" width="4" height="16" rx="1" fill="#1565c0" opacity=".85"/><line x1="1" y1="20.5" x2="21" y2="20.5" stroke="#1565c0" strokeWidth="1.2"/></>}
    {name==='detail'&&<><rect x="4" y="4" width="14" height="14" rx="1" {...common}/><path d="M7 4v14M11 4v14M15 4v14" stroke="#1565c0"/><path d="M4 7h14M4 11h14M4 15h14" stroke="#e53935" strokeWidth="1.5"/></>}
    {name==='foundation'&&<><rect x="2" y="14" width="18" height="4" rx="1" fill="#1565c0" opacity=".8"/><path d="M6 14v6M11 14v6M16 14v6" stroke="#1565c0" strokeWidth="1.5"/><rect x="7" y="5" width="8" height="9" rx="1" {...common}/></>}
    {name==='view'&&<><path d="M2 11s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" {...common}/><circle cx="11" cy="11" r="3" {...common}/><circle cx="11" cy="11" r="1.5" fill="#1565c0"/></>}
    {name==='norm'&&<><rect x="3" y="2" width="13" height="18" rx="1.5" {...common}/><path d="M6 7h7M6 10h7M6 13h4" stroke="#1565c0" strokeWidth="1.2"/><circle cx="16" cy="16" r="4" fill="#fff" stroke="#1565c0" strokeWidth="1.5"/><path d="M16 13.5v3" stroke="#1565c0" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="18" r=".8" fill="#1565c0"/></>}
    {name==='ifc'&&<><path d="M11 2 19 6.5v9L11 20 3 15.5v-9L11 2Z" stroke="#0277bd" strokeWidth="1.4" fill="#e1f5fe"/><path d="M11 2v18M3 6.5l8 4.5 8-4.5" stroke="#0277bd" strokeWidth=".85" opacity=".65"/><path d="M7 12v3.5m-1.5-1.5L7 15.5 8.5 14M15 15.5V12m-1.5 1.5L15 12l1.5 1.5" stroke="#0277bd" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></>}
  </svg>;
};

const TreeIcon=({name}:{name:string})=><svg className={`eng-tree-icon ${name}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
  {name==='building'&&<><rect x="2" y="4" width="10" height="9" rx=".5" stroke="#c0822a" strokeWidth="1.2" fill="#fdf0e0"/><rect x="5" y="8" width="2" height="5" fill="#c0822a" opacity=".7"/><path d="M4 6h6M4 8h6" stroke="#c0822a" strokeWidth=".8"/><polygon points="7,1 1,4 13,4" fill="#c0822a"/></>}
  {name==='floors'&&<><rect x="1" y="3" width="11" height="2" rx=".5" fill="#1565c0" opacity=".8"/><rect x="1" y="6.5" width="11" height="2" rx=".5" fill="#1565c0" opacity=".6"/><rect x="1" y="10" width="11" height="2" rx=".5" fill="#1565c0" opacity=".4"/></>}
  {name==='column'&&<><rect x="2" y="1" width="4" height="11" rx=".5" stroke="#1565c0" strokeWidth="1.2" fill="none"/><rect x="7" y="1" width="4" height="11" rx=".5" stroke="#1565c0" strokeWidth="1.2" fill="none"/><path d="M1 1h11v2H1zM1 10h11v2H1z" fill="#1565c0" opacity=".5"/></>}
  {name==='beam'&&<><rect x="1" y="5" width="11" height="3" rx=".5" stroke="#1565c0" strokeWidth="1.2" fill="none"/><path d="M3 8v3M7 8v3M10 8v3" stroke="#1565c0"/></>}
  {name==='slab'&&<><path d="M6.5 2 12 5.5v4L6.5 13 1 9.5v-4L6.5 2z" stroke="#1565c0" strokeWidth="1.2" fill="#e8f0fc"/><path d="M1 5.5h11" stroke="#1565c0" strokeWidth=".8"/></>}
  {name==='wall'&&<><rect x="1" y="2" width="11" height="9" rx=".5" stroke="#1565c0" strokeWidth="1.2" fill="none"/><path d="M1 5.5h11M1 8.5h11M6 2v9" stroke="#1565c0" strokeWidth=".8"/></>}
  {name==='foundation'&&<><rect x="2" y="6" width="9" height="3" rx=".5" fill="#1565c0" opacity=".7"/><path d="M4 9v3M6.5 9v3M9 9v3" stroke="#1565c0" strokeWidth="1.4"/><rect x="4" y="2" width="5" height="4" rx=".5" stroke="#1565c0" strokeWidth="1.2" fill="none"/></>}
  {name==='load'&&<><polygon points="6.5,1 12,11 1,11" stroke="#f5a623" strokeWidth="1.2" fill="#fff3cd"/><path d="M6.5 5v3" stroke="#f5a623" strokeWidth="1.5"/><circle cx="6.5" cy="9.5" r=".8" fill="#f5a623"/></>}
  {name==='combination'&&<><path d="M2 2h9M2 5h9M2 8h6" stroke="#1565c0" strokeWidth="1.2" strokeLinecap="round"/><circle cx="10" cy="10" r="2.5" stroke="#1565c0" strokeWidth="1.2" fill="none"/><path d="M10 8.5v2M9 10.5h2" stroke="#1565c0"/></>}
  {name==='case'&&<><path d="M2 10Q4 3 6.5 6T11 2M1 11h11" stroke="#1565c0" strokeWidth="1.3" fill="none" strokeLinecap="round"/></>}
  {name==='floor'&&<><rect x="1" y="5" width="11" height="3" rx=".5" fill="#1565c0" opacity=".6"/><path d="M3 5v3m7-3v3M6.5 2v3m0 3v3" stroke="#1565c0" strokeWidth=".8" strokeDasharray="1 .8" opacity=".55"/></>}
  {name==='footing'&&<><rect x="1" y="9" width="11" height="3" rx=".5" fill="#1565c0" opacity=".75"/><rect x="4.5" y="4" width="4" height="5" rx=".5" stroke="#1565c0" strokeWidth="1.1" fill="none"/><path d="M6.5 1v3" stroke="#1565c0" strokeWidth="1.2"/></>}
  {name==='pilecap'&&<><rect x="1" y="6" width="11" height="3" rx=".5" fill="#1565c0" opacity=".75"/><path d="M3.5 9v3m6-3v3" stroke="#1565c0" strokeWidth="2" strokeLinecap="round"/><rect x="4" y="2" width="5" height="4" rx=".5" stroke="#1565c0" strokeWidth="1.1" fill="none"/></>}
  {name==='pile'&&<><rect x="5" y="1" width="3" height="9" rx=".5" fill="#1565c0" opacity=".8"/><path d="m5 10 1.5 3L8 10M2 3h3m3 0h3M2 6h3m3 0h3" stroke="#1565c0" strokeWidth=".8" strokeDasharray="1 .8" opacity=".55"/></>}
  {name==='static'&&<><rect x="2" y="8" width="9" height="2" rx=".5" stroke="#1565c0" strokeWidth="1.1" fill="none"/><path d="M4 1v7m2.5-7v7M9 1v7M3 1h7" stroke="#1565c0"/><path d="m3 6 1 2 1-2m.5 0 1 2 1-2m.5 0 1 2 1-2" fill="#1565c0"/></>}
  {name==='modal'&&<><path d="M1 6.5Q2.5 2 4 6.5t3 0t3 0Q11.5 11 12 9" stroke="#1565c0" strokeWidth="1.2" fill="none" strokeLinecap="round"/><path d="M1 6.5h11" stroke="#1565c0" strokeWidth=".7" strokeDasharray="1.5 1" opacity=".3"/><circle cx="4" cy="6.5" r="1" fill="#1565c0" opacity=".6"/><circle cx="10" cy="6.5" r="1" fill="#1565c0" opacity=".6"/></>}
  {name==='spectrum'&&<><path d="M1 11V3Q2 1 3 3t3 6q2 3 6 2M1 11h11M1 1v10M3 3v8" stroke="#1565c0" strokeWidth="1" fill="none" strokeLinecap="round"/></>}
  {name==='nonlinear'&&<><path d="M3 12V2q2 0 5-1M3 12h9M8 1v3" stroke="#1565c0" strokeWidth="1.1" fill="none"/><text x="9" y="4" fontSize="4" fill="#1565c0" fontWeight="bold">P</text><text x="5.5" y="8" fontSize="4" fill="#1565c0">Δ</text></>}
  {name==='steel'&&<><rect x="1" y="6" width="12" height="2" rx=".5" fill="#607d8b"/><rect x="1" y="1" width="2" height="12" rx=".5" fill="#607d8b"/><rect x="11" y="1" width="2" height="12" rx=".5" fill="#607d8b"/><path d="M3 3h8M3 11h8" stroke="#90a4ae" strokeWidth=".8"/></>}
  {name==='shed'&&<><path d="M1 12V6Q6.5 0 12 6v6Z" fill="#e8f4f8" stroke="#607d8b" strokeWidth="1.1"/><rect x="5" y="8" width="3" height="4" fill="#b0bec5" opacity=".6"/></>}
  {name==='mezzanine'&&<><rect x="1" y="1" width="11" height="11" rx=".5" stroke="#607d8b" strokeWidth="1.1" fill="none"/><path d="M1 7h7m0-3v8" stroke="#607d8b" strokeWidth="1.1"/><rect x="2" y="8" width="5" height="4" fill="#607d8b" opacity=".12"/></>}
  {name==='tank'&&<><ellipse cx="6.5" cy="4" rx="5" ry="2" stroke="#607d8b" strokeWidth="1.1" fill="#e8f4f8"/><path d="M1.5 4v6m10-6v6" stroke="#607d8b" strokeWidth="1.1"/><ellipse cx="6.5" cy="10" rx="5" ry="2" fill="#b0bec5" opacity=".4" stroke="#607d8b"/><path d="M6.5 10v3" stroke="#607d8b"/></>}
  {name==='bridge'&&<><path d="M1 9h12M3 9v3m8-3v3M1 9Q3.5 3 7 3t6 6M5 5.5V9m4-3.5V9" stroke="#2e7d32" strokeWidth="1.2" fill="none"/></>}
  {name==='viaduct'&&<><rect x="1" y="5" width="12" height="2.5" rx=".5" fill="#2e7d32"/><rect x="3" y="7.5" width="2" height="5" rx=".5" fill="#2e7d32" opacity=".7"/><rect x="9" y="7.5" width="2" height="5" rx=".5" fill="#2e7d32" opacity=".7"/></>}
  {name==='walkway'&&<><path d="M1 8h12M3 4v8m8-8v8M3 4h8M5 4v4m2-4v4m2-4v4" stroke="#2e7d32" strokeWidth="1"/></>}
  {name==='tunnel'&&<><path d="M1 12V8Q1 2 7 2t6 6v4M1 12h12" stroke="#2e7d32" strokeWidth="1.2" fill="#e8f5e9"/><rect x="3" y="8" width="8" height="4" fill="#2e7d32" opacity=".12"/></>}
  {name==='culvert'&&<><rect x="2" y="3" width="10" height="8" rx=".5" stroke="#2e7d32" strokeWidth="1.2" fill="#e8f5e9"/><rect x="4" y="5" width="6" height="4" rx=".5" fill="#2e7d32" opacity=".15" stroke="#2e7d32"/></>}
  {name==='wallret'&&<><path d="M2 2h3v10l-3 1ZM5 4q4-1 8 0v8H5Z" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="1.1"/></>}
  {name==='lab'&&<><path d="M5 1v5l-3 6h10L9 6V1M5 1h4" stroke="#6a1b9a" strokeWidth="1.2" fill="none"/><circle cx="5" cy="10" r="1" fill="#6a1b9a" opacity=".6"/><circle cx="8" cy="11" r=".8" fill="#6a1b9a" opacity=".4"/></>}
  {name==='isolatedbeam'&&<><rect x="1" y="5" width="11" height="3" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><path d="m1 8 2.5 4h-5m11.5-4v3M8 11h4" stroke="#6a1b9a" strokeWidth="1.1" fill="none"/></>}
  {name==='isolatedcolumn'&&<><rect x="4.5" y="1" width="4" height="9" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><rect x="2" y="10" width="9" height="2" rx=".5" fill="#6a1b9a" opacity=".8"/></>}
  {name==='spring'&&<><rect x="1" y="4" width="5" height="5" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><path d="M6 6.5h1q.5-1.5 1 0t1 0t1 0h1M11 5v3" stroke="#6a1b9a" fill="none"/></>}
  {name==='anchor'&&<><path d="M6.5 1v9M4 8h5m-4.5 2h4M3 11h7m-8 1h9" stroke="#6a1b9a" strokeWidth="1.1"/><path d="m5.5 1 1 2.5L7.5 1" fill="#6a1b9a"/></>}
  {name==='plate'&&<><rect x="1" y="2" width="11" height="9" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><circle cx="6.5" cy="6.5" r="2.5" stroke="#6a1b9a" fill="#fff"/></>}
  {name==='boltplate'&&<><rect x="2" y="4" width="9" height="5" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><path d="M6.5 1v11M5 1h3M5 11h3" stroke="#6a1b9a" strokeWidth="1.3"/></>}
  {name==='bolt'&&<><rect x="1" y="4" width="11" height="5" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><circle cx="6.5" cy="6.5" r="2" fill="#fff" stroke="#6a1b9a"/><circle cx="6.5" cy="6.5" r=".9" fill="#6a1b9a"/><path d="M6.5 1v3m0 5v3" stroke="#6a1b9a" strokeWidth="1.2"/></>}
  {name==='slot'&&<><rect x="1" y="4" width="11" height="5" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><rect x="4" y="5.5" width="5" height="3" rx="1.5" fill="#fff" stroke="#6a1b9a"/><circle cx="6.5" cy="7" r=".9" fill="#6a1b9a"/><path d="M6.5 1v3m0 5v3" stroke="#6a1b9a" strokeWidth="1.2"/></>}
  {name==='q4'&&<><rect x="1" y="1" width="11" height="11" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><path d="M1 4.7h11M1 8.3h11M4.7 1v11M8.3 1v11" stroke="#6a1b9a" strokeWidth=".7" strokeDasharray="1.5 1"/></>}
  {name==='punch'&&<><rect x="4.5" y="4.5" width="4" height="4" rx=".5" fill="#6a1b9a"/><rect x="1.5" y="1.5" width="10" height="10" rx="1" stroke="#6a1b9a" strokeWidth=".9" fill="none" strokeDasharray="2 1.2"/></>}
  {name==='contact'&&<><rect x="1" y="1" width="5" height="10" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><rect x="7" y="1" width="5" height="10" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><path d="M6 3h1M6 5.5h1M6 7.5h1M6 10h1" stroke="#6a1b9a"/></>}
  {name==='slip'&&<><rect x="1" y="5" width="11" height="3" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><circle cx="4" cy="6.5" r="1.2" fill="#fff" stroke="#6a1b9a"/><circle cx="9" cy="6.5" r="1.2" fill="#fff" stroke="#6a1b9a"/><path d="M1 3.5h6l-2-1v2Z" fill="#6a1b9a"/></>}
  {name==='tstub'&&<><rect x="1" y="1" width="11" height="2.5" rx=".5" fill="#6a1b9a"/><rect x="5" y="3.5" width="3" height="8" rx=".5" fill="#ede7f6" stroke="#6a1b9a" strokeWidth="1.1"/><path d="M2 3.5V9m9-5.5V9" stroke="#6a1b9a" strokeDasharray="1 .8"/></>}
  {name==='damage'&&<><rect x="1" y="2" width="11" height="9" rx=".5" stroke="#6a1b9a" strokeWidth="1.1" fill="#ede7f6"/><ellipse cx="6.5" cy="6.5" rx="3" ry="2" fill="#fff" stroke="#6a1b9a"/><path d="M5 5.5q1-1 2.5-.5t.5 1.5" stroke="#c62828" strokeWidth=".8" fill="none" strokeDasharray="1 .8"/></>}
  {name==='anchorconcrete'&&<><rect x="1" y="6" width="11" height="6" rx=".5" fill="#d7ccc8" stroke="#795548"/><path d="M6.5 1v11M5 1h3M5.5 9h2M5 11h3" stroke="#6a1b9a" strokeWidth="1.2"/></>}
  {name==='inspection'&&<><rect x="1" y="3" width="12" height="8" rx="1" stroke="#00695c" strokeWidth="1.2" fill="#e0f2f1"/><circle cx="5" cy="7" r="2" stroke="#00695c" fill="#fff"/><circle cx="5" cy="7" r=".8" fill="#00695c"/><path d="m7 9 2 2M9 5h3M9 7h2" stroke="#00695c"/></>}
  {name==='pathology'&&<><rect x="1" y="2" width="11" height="9" rx=".8" stroke="#00695c" strokeWidth="1.1" fill="#e0f2f1"/><path d="m3 8 2-2 1 1.5L7.5 5 9 7l1-1" stroke="#c62828" fill="none"/><circle cx="10.5" cy="3.5" r="1.2" fill="#00695c"/></>}
  {name==='twin'&&<><rect x="1" y="4" width="6" height="8" rx=".6" fill="#b2dfdb" stroke="#00695c" strokeWidth="1.1"/><rect x="6" y="1" width="6" height="8" rx=".6" fill="#e0f2f1" stroke="#00695c" strokeWidth="1.1" strokeDasharray="2 1.2"/><path d="m3 7 6-2" stroke="#00695c" strokeDasharray="1.2 .8"/></>}
</svg>;

const TreeRow=({icon,label,count,child=false,onActivate,testId}:{icon?:string;label:string;count?:number;child?:boolean;onActivate?:()=>void;testId?:string})=>{
  const activate=(event:React.MouseEvent|React.KeyboardEvent)=>{event.stopPropagation();onActivate?.()};
  return <div className={`eng-tree-row ${child?'child':''} ${onActivate?'interactive':''}`} data-testid={testId} role={onActivate?'button':undefined} tabIndex={onActivate?0:undefined} onClick={onActivate?activate:undefined} onKeyDown={onActivate?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e)}}:undefined}>{icon&&<TreeIcon name={icon}/>}<span>{label}</span>{count!==undefined&&<small>({count})</small>}</div>;
};

function Ribbon({onAnalyze,onOpenPanel,onCommit}:Props){
  const[modelingOpen,setModelingOpen]=useState(false);
  const[modelSection,setModelSection]=useState<'2d'|'3d'|null>(null);
  const triggerRef=useRef<HTMLButtonElement>(null),menuRef=useRef<HTMLDivElement>(null);
  const closeModeling=()=>{setModelingOpen(false);setModelSection(null)};
  useEffect(()=>{
    if(!modelingOpen)return;
    const outside=(event:PointerEvent)=>{const target=event.target as Node;if(!triggerRef.current?.contains(target)&&!menuRef.current?.contains(target))closeModeling()};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){closeModeling();triggerRef.current?.focus()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
  },[modelingOpen]);
  const chooseProject=(factory:()=>any)=>{closeModeling();onCommit(factory(),true)};
  const blankProject=(dimension:'2d'|'3d')=>{const p:any=emptyProject();p.name=`Novo modelo ${dimension.toUpperCase()}`;p.settings.modelDimension=dimension;p.meta.modelKind=dimension;return p};
  const openBuilding=()=>{closeModeling();window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open',{detail:{tab:'building',source:'engineering-ribbon'}}))};
  const openProperties=()=>{closeModeling();onOpenPanel('properties')};
  return <div className={`eng-ribbon ${modelingOpen?'menu-open':''}`} data-testid="engineering-ribbon">
    <div className="eng-ribbon-group">
      <button ref={triggerRef} data-testid="engineering-ribbon-modeling" className={modelingOpen?'active':''} aria-haspopup="menu" aria-expanded={modelingOpen} onClick={()=>{setModelingOpen(open=>!open);if(modelingOpen)setModelSection(null)}}><RibbonIcon name="launch"/><span>Lançamento<small>Modelagem</small></span></button>
      <button data-testid="engineering-ribbon-analyze" onClick={onAnalyze}><RibbonIcon name="analysis"/><span>Análise<small>Processar</small></span></button>
      <button onClick={()=>onOpenPanel('actions')}><RibbonIcon name="combinations"/><span>Combinações<small>ELU / ELS</small></span></button>
      <button className="active" onClick={()=>onOpenPanel('postprocess')}><RibbonIcon name="results"/><span>Resultados<small>Diagramas / Mapas</small></span></button>
      <button onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:engineering-review-open',{detail:{tab:'foundation',source:'engineering-ribbon'}}))}><RibbonIcon name="detail"/><span>Detalhamento<small>Armaduras</small></span></button>
      <button onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:foundation-dashboard-open',{detail:{source:'engineering-ribbon'}}))}><RibbonIcon name="foundation"/><span>Fundação<small>Sapatas / Estacas</small></span></button>
      <button onClick={()=>document.querySelector<HTMLElement>('[data-testid="spatial3d-display-mode"]')?.focus()}><RibbonIcon name="view"/><span>Visualização<small>Vistas / Filtros</small></span></button>
      <button onClick={()=>onOpenPanel('properties')}><RibbonIcon name="norm"/><span>NBR 6118<small>Parâmetros</small></span></button>
      <button data-testid="engineering-ribbon-ifc" onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:ifc-open',{detail:{source:'engineering-ribbon'}}))}><RibbonIcon name="ifc"/><span>IFC<small>Import / Export</small></span></button>
    </div>
    {modelingOpen&&<div ref={menuRef} className="eng-ribbon-menu eng-modeling-menu" data-testid="engineering-modeling-menu" role="menu" aria-label="Lançamento e modelagem">
      <header><strong>Lançamento / Modelagem</strong><small>Escolha como iniciar ou carregar o modelo</small></header>
      <button className="eng-modeling-primary" data-testid="engineering-launch-building" role="menuitem" onClick={openBuilding}><span className="eng-modeling-icon building" aria-hidden="true">▦</span><span><b>Lançar novo Edifício</b><small>Lançador automático por malha ou planta</small></span></button>
      <section className={modelSection==='2d'?'open':''}>
        <button data-testid="engineering-modeling-2d" aria-expanded={modelSection==='2d'} onClick={()=>setModelSection(current=>current==='2d'?null:'2d')}><span className="eng-modeling-icon mode2d" aria-hidden="true">2D</span><span><b>Modelo 2D</b><small>Criar ou abrir um exemplo existente</small></span><i aria-hidden="true">›</i></button>
        {modelSection==='2d'&&<div className="eng-modeling-submenu" data-testid="engineering-modeling-2d-options">
          <button data-testid="engineering-new-2d" onClick={()=>chooseProject(()=>blankProject('2d'))}><b>Criar novo</b><small>Modelo 2D vazio</small></button>
          <p>Exemplos de modelo 2D</p>
          <button data-testid="engineering-example-2d-frame" onClick={()=>chooseProject(demoFrame)}><b>Pórtico 2D</b><small>Pórtico demonstrativo</small></button>
          <button data-testid="engineering-example-2d-beam" onClick={()=>chooseProject(demoBeamUDL)}><b>Viga 2D</b><small>Viga biapoiada com carga distribuída</small></button>
          <button onClick={()=>chooseProject(demoTruss)}><b>Treliça 2D</b><small>Treliça plana demonstrativa</small></button>
          <button onClick={()=>chooseProject(demoMixed)}><b>Modelo misto 2D</b><small>Pórtico contraventado</small></button>
        </div>}
      </section>
      <section className={modelSection==='3d'?'open':''}>
        <button data-testid="engineering-modeling-3d" aria-expanded={modelSection==='3d'} onClick={()=>setModelSection(current=>current==='3d'?null:'3d')}><span className="eng-modeling-icon mode3d" aria-hidden="true">3D</span><span><b>Modelo 3D</b><small>Criar ou abrir um exemplo existente</small></span><i aria-hidden="true">›</i></button>
        {modelSection==='3d'&&<div className="eng-modeling-submenu" data-testid="engineering-modeling-3d-options">
          <button data-testid="engineering-new-3d" onClick={()=>chooseProject(()=>blankProject('3d'))}><b>Criar novo</b><small>Modelo 3D vazio</small></button>
          <p>Exemplos de modelo 3D</p>
          <button data-testid="engineering-example-3d-frame" onClick={()=>chooseProject(demoSpatialFrame)}><b>Pórtico espacial 3D</b><small>Barras em três dimensões</small></button>
          <button onClick={()=>chooseProject(demoFiveStoreyBuilding3D)}><b>Edifício RC · 5 pavimentos</b><small>Estrutura espacial em concreto</small></button>
          <button onClick={()=>chooseProject(demoSteelWarehouse3D)}><b>Galpão metálico</b><small>Pórticos, terças e duas águas</small></button>
          <button onClick={()=>chooseProject(demoWaterTank3D)}><b>Reservatório elevado</b><small>Modelo global de barras</small></button>
        </div>}
      </section>
      <button className="eng-modeling-primary" data-testid="engineering-properties-library" role="menuitem" onClick={openProperties}><span className="eng-modeling-icon library" aria-hidden="true">▤</span><span><b>Biblioteca de propriedades</b><small>Materiais e seções paramétricas</small></span></button>
    </div>}
  </div>;
}

export function EngineeringModelExplorer({project,result,onCommit,onAnalyze,onOpenPanel}:Pick<Props,'project'|'result'|'onCommit'|'onAnalyze'|'onOpenPanel'>){
  const[tab,setTab]=useState('model');
  const[query,setQuery]=useState('');
  const base=project.settings?.normativeBaseline||nbr6118Baseline();
  const validation=validateNBR6118Baseline(project);
  const lvls=projectLevels(project);
  const setExposure=(exposureClass:string)=>onCommit({
    ...project,
    settings:{...(project.settings||{}),normativeBaseline:nbr6118Baseline({...base,exposureClass})}
  },true);
  const patchSettings=(patch:any)=>onCommit({...project,settings:{...(project.settings||{}),...patch}},true);
  const loadLabModel=(factory:()=>any)=>onCommit(factory(),true);
  const openLab=(id:string)=>()=>openIsolatedLab(id);
  const visible=(label:string)=>!query.trim()||label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
  return <div className="eng-model-explorer" data-testid="engineering-model-explorer">
    <div className="eng-side-tabs">
      <button className={tab==='model'?'active':''} onClick={()=>setTab('model')}>Modelo</button>
      <button className={tab==='results'?'active':''} onClick={()=>setTab('results')}>Resultados</button>
      <button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}>Relatórios</button>
    </div>
    {tab==='model'?<>
      <input className="eng-search" aria-label="Buscar no modelo" placeholder="Buscar no modelo…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="eng-tree">
        <details open><summary><TreeRow icon="building" label="Edifício Residencial"/></summary>
          {visible('pavimentos cobertura pavimento térreo subsolo')&&<details open><summary><TreeRow icon="floors" label="Pavimentos" count={lvls.length}/></summary><TreeRow label="Cobertura" child/><details><summary><TreeRow icon="floors" label="Pav. Tipo (1-16)" child/></summary>{Array.from({length:16},(_,i)=><TreeRow key={i} icon="floor" label={`Pav. Tipo ${i+1}`} child/>)}</details><TreeRow label="Pav. Térreo" child/><TreeRow label="Subsolo" child/></details>}
          {visible('elementos pilares vigas lajes paredes núcleos')&&<details open><summary><TreeRow icon="column" label="Elementos"/></summary><TreeRow icon="column" label="Pilares" count={countType(project,'frame3d')+countType(project,'frame2d')} child/><TreeRow icon="beam" label="Vigas" count={countType(project,'frame3d')+countType(project,'frame2d')} child/><TreeRow icon="slab" label="Lajes" count={countType(project,'shell4')} child/><TreeRow icon="wall" label="Paredes / Núcleos" count={0} child/></details>}
          {visible('fundações sapatas blocos estacas')&&<details open><summary><TreeRow icon="foundation" label="Fundações"/></summary><TreeRow icon="footing" label="Sapatas" count={project.foundationReview?.items?.filter((x:any)=>x.type==='footing').length||0} child/><TreeRow icon="pilecap" label="Blocos" count={project.foundationReview?.items?.filter((x:any)=>x.type==='pile-cap').length||0} child/><TreeRow icon="pile" label="Estacas" count={project.foundationReview?.items?.filter((x:any)=>x.type==='pile').length||0} child/></details>}
          {visible('cargas permanentes variáveis vento sismo')&&<details open><summary><TreeRow icon="load" label="Cargas"/></summary><TreeRow label="Permanentes" child/><TreeRow label="Variáveis" child/><TreeRow label="Vento (NBR 6123)" child/><TreeRow label="Sismo (opcional)" child/></details>}
          {visible('combinações nbr 6118 elu els')&&<details open><summary><TreeRow icon="combination" label="Combinações (NBR 6118)"/></summary><TreeRow label="ELU" count={(project.loadCombinations||[]).filter((x:any)=>/elu|uls/i.test(x.name||x.id)).length} child/><TreeRow label="ELS" count={(project.loadCombinations||[]).filter((x:any)=>/els|sls/i.test(x.name||x.id)).length} child/></details>}
          {visible('casos análise estática linear modal espectral não linear')&&<details open><summary><TreeRow icon="case" label="Casos de Análise"/></summary><TreeRow icon="static" label="Estática Linear" child/><TreeRow icon="modal" label="Análise Modal" child/><TreeRow icon="spectrum" label="Análise Espectral" child/><TreeRow icon="nonlinear" label="Análise Não Linear (P-Δ)" child/></details>}
        </details>
        {visible('estruturas metálicas galpão mezanino reservatório')&&<details><summary><TreeRow icon="steel" label="Estruturas Metálicas"/></summary><TreeRow icon="shed" label="Galpão" child/><TreeRow icon="mezzanine" label="Mezanino" child/><TreeRow icon="tank" label="Reservatório" child/></details>}
        {visible('obras arte especiais pontes viadutos passarelas túneis pontilhões galerias muros arrimo')&&<details><summary><TreeRow icon="bridge" label="Obras de Arte Especiais"/></summary><TreeRow icon="bridge" label="Pontes" child/><TreeRow icon="viaduct" label="Viadutos" child/><TreeRow icon="walkway" label="Passarelas" child/><TreeRow icon="tunnel" label="Túneis" child/><TreeRow icon="bridge" label="Pontilhões" child/><TreeRow icon="culvert" label="Galerias" child/><TreeRow icon="wallret" label="Muros de arrimo" child/></details>}
        {visible('lab isolado viga coluna elemento mola ancoragem parafusos chapa punção contato ligação dano chumbador')&&<details><summary><TreeRow icon="lab" label="Lab isolado"/></summary><TreeRow icon="isolatedbeam" label="Viga isolada" child testId="engineering-lab-isolated-beam" onActivate={()=>loadLabModel(demoIsolatedBeamLab3D)}/><TreeRow icon="isolatedcolumn" label="Coluna isolada" child testId="engineering-lab-isolated-column" onActivate={()=>loadLabModel(demoIsolatedColumnLab3D)}/><TreeRow icon="spring" label="Elemento + mola" child testId="engineering-lab-spring" onActivate={()=>loadLabModel(demoSpringLab3D)}/><TreeRow icon="anchor" label="Ancoragem (Pull-out)" child testId="engineering-lab-anchor-pullout" onActivate={openLab('anchor-pullout')}/><TreeRow icon="boltplate" label="Parafusos - Placa rígida" child testId="engineering-lab-bolt-group" onActivate={openLab('bolt-group')}/><TreeRow icon="bolt" label="Parafusos - furo circular" child testId="engineering-lab-bolt-contact" onActivate={openLab('bolt-contact')}/><TreeRow icon="slot" label="Parafusos - furo oblongo" child testId="engineering-lab-slot-contact" onActivate={openLab('slot-contact')}/><TreeRow icon="q4" label="Chapa - flexível Q4" child testId="engineering-lab-connection-plate-flex" onActivate={openLab('connection-plate-flex')}/><TreeRow icon="punch" label="Punção - Perímetro crítico" child testId="engineering-lab-punching-demand" onActivate={openLab('punching-demand')}/><TreeRow icon="plate" label="Chapa - furo explícito" child testId="engineering-lab-plate-hole-contact" onActivate={openLab('connection-plate-hole-contact')}/><TreeRow icon="contact" label="Verificação numérica - contato" child testId="engineering-lab-local-verification" onActivate={openLab('local-verification')}/><TreeRow icon="slip" label="Ligação - Slip (bearing)" child testId="engineering-lab-slip-bearing" onActivate={openLab('slip-bearing')}/><TreeRow icon="tstub" label="Ligação - T-stub/Prying" child testId="engineering-lab-tstub-prying" onActivate={openLab('tstub-prying')}/><TreeRow icon="damage" label="Furo - dano/ovalização" child testId="engineering-lab-hole-damage" onActivate={openLab('hole-damage')}/><TreeRow icon="anchorconcrete" label="Chumbador - interação concreto" child testId="engineering-lab-anchor-concrete" onActivate={openLab('anchor-concrete-interaction')}/></details>}
        {visible('inspeção remota detecção automática manifestações patológicas gêmeos digitais digital twins')&&<details><summary><TreeRow icon="inspection" label="Inspeção remota"/></summary><TreeRow icon="pathology" label="Detecção Automática de Manifestações Patológicas" child/><TreeRow icon="twin" label="Gêmeos Digitais (Digital Twins)" child/></details>}
      </div>
      <div className="eng-launch">
        <h4>Parâmetros de lançamento</h4>
        <label>Norma:<input readOnly value="NBR 6118:2014"/></label>
        <label>Unidades<select value={project.settings?.units||'kN-m'} onChange={e=>patchSettings({units:e.target.value})}><option value="kN-m">kN, m, °C</option><option value="N-mm">N, mm, °C</option></select></label>
        <label>Malha de Lajes:<select value={String(project.settings?.grid||base.slabMeshM||.5)} onChange={e=>patchSettings({grid:Number(e.target.value)})}><option value="0.1">0,10 m</option><option value="0.25">0,25 m</option><option value="0.5">0,50 m</option><option value="1">1,00 m</option></select></label>
        <label>Tipo de Análise:<select value={project.settings?.analysisType||'linear'} onChange={e=>patchSettings({analysisType:e.target.value})}><option value="linear">Linear (1ª ordem)</option><option value="pdelta">P-Delta</option><option value="modal">Modal</option><option value="corotational">Não linear geométrica</option></select></label>
        <div className={validation.ok?'eng-check ok':'eng-check warn'}>{validation.ok?'✓ Baseline de lançamento atendido':`⚠ ${validation.issues.length} pendência(s) no baseline`}</div>
        <button className="eng-run" data-testid="engineering-sidebar-analyze" onClick={onAnalyze}>▷ Executar Análise</button>
      </div>
    </>:tab==='results'?<div className="eng-tab-empty">{result?'Resultados disponíveis. Use a tabela inferior e os mapas 3D.':'Execute a análise para preencher resultados.'}<button onClick={onAnalyze}>Executar análise</button></div>:<div className="eng-tab-empty">Relatórios técnicos permanecem disponíveis no módulo de relatório.<button onClick={()=>onOpenPanel('report')}>Abrir relatório técnico</button></div>}
  </div>;
}

function LateralDiagram({result}:{result:any}){
  const vis=result?.engineeringVisualization;
  const floors=vis?.floors?.levels||[];
  const drifts=vis?.floors?.storyDrifts||[];
  const max=Math.max(1,...floors.map((f:any)=>Math.abs(Number(f.uxMm)||0)));
  const h=188,w=260,pad=22;
  const zs=floors.map((f:any)=>Number(f.elevation)||0),zmin=Math.min(0,...zs),zmax=Math.max(1,...zs);
  const pts=floors.map((f:any)=>{
    const y=h-pad-(Number(f.elevation)-zmin)/(zmax-zmin)*(h-2*pad);
    const x=w*.46+(Number(f.uxMm)||0)/max*w*.26;
    return{x,y,label:f.label||f.id,value:f.uxMm};
  });
  return <svg viewBox={`0 0 ${w} ${h}`} className="eng-lateral-svg" aria-label="Vista lateral de deslocamentos">
    <line x1={w*.46} y1={pad} x2={w*.46} y2={h-pad} stroke="#808c96" strokeDasharray="4 3"/>
    {pts.map((p:any,i:number)=><g key={i}><line x1={w*.42} y1={p.y} x2={w*.78} y2={p.y} stroke="#d2dae0"/><text x={w*.80} y={p.y+3} fontSize="8" fill="#44515d">{p.label}</text></g>)}
    {pts.length>1&&<polyline points={pts.map((p:any)=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#d4493f" strokeWidth="3"/>}
    {pts.map((p:any,i:number)=><circle key={`c${i}`} cx={p.x} cy={p.y} r="2.5" fill={i===pts.length-1?'#d4493f':'#1f8d74'}/>)}
    {!pts.length&&<text x="20" y="95" fontSize="11" fill="#71808d">Execute a análise para a deformada lateral.</text>}
    <text x="8" y="14" fontSize="9" fontWeight="700" fill="#31546d">Deslocamento global X · mm</text>
    <text x="8" y={h-6} fontSize="8" fill="#6f7d88">drift máx.: {fmt(Math.max(0,...drifts.map((d:any)=>100*Math.abs(Number(d.driftRatio)||0))),3)}%</text>
  </svg>;
}

function FoundationDiagram({project}:{project:any}){
  const supports=(project.supports||[]).slice(0,12);
  const cols=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,supports.length))));
  return <svg viewBox="0 0 260 118" className="eng-foundation-svg" aria-label="Vista inferior das fundações">
    <rect x="18" y="12" width="224" height="72" fill="#eef1f3" stroke="#9aa5ad"/>
    {supports.map((s:any,i:number)=>{
      const c=i%cols,r=Math.floor(i/cols);
      const denominator=Math.max(1,cols-1),x=cols===1?130:42+c*(176/denominator),y=30+r*28;
      return <g key={i}><rect x={x-10} y={y-7} width="20" height="14" fill="#aab0b4" stroke="#656e74"/><line x1={x-5} y1={y+7} x2={x-5} y2={y+31} stroke="#70787e" strokeWidth="3"/><line x1={x+5} y1={y+7} x2={x+5} y2={y+31} stroke="#70787e" strokeWidth="3"/></g>;
    })}
    <text x="20" y="108" fontSize="9" fill="#53616d">{supports.length} apoio(s) · fundação visível no workspace</text>
  </svg>;
}

type ResultLegendState={field:string;min:number;max:number;unit:string;kind:'none'|'sequential'|'diverging';phase:number;intensity:number;live:boolean};
const RESULT_FIELD_LABELS:Record<string,string>={none:'Sem mapa de resultados',Ux:'Laje Ux',Uy:'Laje Uy',Uz:'Laje Uz',Umag:'Laje |u| total',Nx:'Laje Nx',Ny:'Laje Ny',Nxy:'Laje Nxy',Mx:'Laje Mx',My:'Laje My',Mxy:'Laje Mxy',Qx:'Laje Qx',Qy:'Laje Qy',N:'Barras N',V:'Barras V',M:'Barras M',T:'Barras T'};
const legendNumber=(value:number)=>{const a=Math.abs(value);return a>=1000||(a>0&&a<.001)?value.toExponential(2):a>=100?value.toFixed(1):a>=1?value.toFixed(2):value.toFixed(3)};
const legendBlend=(neutral:number[],target:number[],amount:number)=>`rgb(${neutral.map((value,index)=>Math.round(value+(target[index]-value)*amount)).join(',')})`;
function ResultLegend({maxDisp,shells}:{maxDisp:number;shells:number}){
  const[state,setState]=useState<ResultLegendState>({field:'none',min:0,max:0,unit:'',kind:'none',phase:1,intensity:1,live:false});
  useEffect(()=>{
    const read=()=>{const canvas=document.querySelector<HTMLElement>('[data-testid="spatial-canvas-3d"]'),field=canvas?.dataset.forceMode||'none',min=Number(canvas?.dataset.resultMapMin||0),max=Number(canvas?.dataset.resultMapMax||0),unit=canvas?.dataset.resultMapUnit||'',kind=(canvas?.dataset.resultMapKind||'none') as ResultLegendState['kind'],phase=Number(canvas?.dataset.resultMapPhase??1),intensity=Number(canvas?.dataset.resultMapIntensity??1),live=canvas?.dataset.resultMapLive==='true';const next={field,min:Number.isFinite(min)?min:0,max:Number.isFinite(max)?max:0,unit,kind,phase:Number.isFinite(phase)?phase:1,intensity:Number.isFinite(intensity)?intensity:1,live};setState(current=>current.field===next.field&&current.min===next.min&&current.max===next.max&&current.unit===next.unit&&current.kind===next.kind&&current.phase===next.phase&&current.intensity===next.intensity&&current.live===next.live?current:next)};
    read();const root=document.querySelector('.astra-app');if(!root)return;const observer=new MutationObserver(read);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-force-mode','data-result-map-min','data-result-map-max','data-result-map-unit','data-result-map-kind','data-result-map-phase','data-result-map-intensity','data-result-map-live']});return()=>observer.disconnect();
  },[]);
  const active=state.field!=='none'&&state.kind!=='none',factor=state.unit==='m'?1000:1,unit=state.unit==='m'?'mm':state.unit,min=state.min*factor,max=state.max*factor,ticks=Array.from({length:9},(_,index)=>max-(max-min)*index/8),intensity=Math.max(0,Math.min(1,state.intensity)),neutral=[235,241,246],gradient=state.kind==='diverging'?`linear-gradient(to bottom,${legendBlend(neutral,[199,71,77],intensity)} 0%,rgb(235,241,246) 50%,${legendBlend(neutral,[92,150,204],intensity)} 100%)`:'linear-gradient(to bottom,rgb(235,77,85) 0%,rgb(55,132,190) 100%)',animatedField=/^U(?:x|y|z|mag)$/.test(state.field);
  const changeField=(field:string)=>{const core=document.querySelector<HTMLSelectElement>('select[aria-label="Campo de esforço 3D"]');if(core){core.value=field;core.dispatchEvent(new Event('change',{bubbles:true}))}};
  return <>
    <select aria-label="Campo visual rápido" value={RESULT_FIELD_LABELS[state.field]?state.field:'none'} onChange={e=>changeField(e.target.value)}>
      <option value="none">Deslocamento / deformada</option>
      <optgroup label="Laje · deslocamentos"><option value="Ux">Laje Ux</option><option value="Uy">Laje Uy</option><option value="Uz">Laje Uz</option><option value="Umag">Laje |u| total</option></optgroup>
      <optgroup label="Laje · esforços"><option value="Nx">Laje Nx</option><option value="Ny">Laje Ny</option><option value="Nxy">Laje Nxy</option><option value="Mx">Laje Mx</option><option value="My">Laje My</option><option value="Mxy">Laje Mxy</option><option value="Qx">Laje Qx</option><option value="Qy">Laje Qy</option></optgroup>
      <optgroup label="Barras"><option value="N">Barras N</option><option value="V">Barras V</option><option value="M">Barras M</option><option value="T">Barras T</option></optgroup>
    </select>
    <div className={`eng-legend-scale ${active?'active':'inactive'} ${state.live?'live':''}`} data-testid="engineering-result-legend" data-result-field={state.field} data-result-unit={unit} data-result-phase={state.phase.toFixed(3)} data-result-intensity={intensity.toFixed(3)} data-result-live={state.live?'true':'false'}>
      <div className="eng-legend-ticks" aria-label={active?`Escala de ${legendNumber(min)} a ${legendNumber(max)} ${unit}`:'Mapa de resultados inativo'}>{active?ticks.map((value,index)=><span key={index}>{legendNumber(value)}</span>):<span>—</span>}</div>
      <div className="eng-gradient" style={{background:active?gradient:'linear-gradient(to bottom,#d8dee5,#eef1f4,#d8dee5)'}}/>
    </div>
    <small><b>{RESULT_FIELD_LABELS[state.field]||state.field}</b>{active?<><span>Unidade: {unit||'—'}</span><span>mín. {legendNumber(min)} · máx. {legendNumber(max)}</span>{animatedField&&<span data-testid="engineering-result-phase" className={state.live?'live':''}>{state.live?'Animação':'Estado final'} · fase {Math.round(state.phase*100)}%</span>}</>:<span>u máx. {fmt(maxDisp,3)} mm · {shells} shell(s)</span>}</small>
  </>;
}

export function EngineeringRightRail({project,result}:Pick<Props,'project'|'result'>){
  const vis=result?.engineeringVisualization;
  const maxDisp=vis?.displacement?.maxMagnitudeMm||0;
  const shells=vis?.shells?.elementCount||0;
  const analysisReady=!!vis?.detailReadiness?.analysisComplete;
  const foundationCount=vis?.foundation?.foundationCount||project.supports?.length||0;
  return <div className="eng-right-rail" data-testid="engineering-right-rail">
    <section><header>Vista Lateral - Deslocamento Global (Direção X)<button aria-label="Fechar vista lateral">×</button></header><LateralDiagram result={result}/></section>
    <section><header>Vista Inferior - Fundação<button aria-label="Fechar vista inferior">×</button></header><div className="eng-foundation-tools"><button aria-label="Ampliar">＋</button><button aria-label="Rotacionar">↻</button><button aria-label="Reduzir">−</button><button aria-label="Vista inicial">⌂</button></div><FoundationDiagram project={project}/></section>
    <section className="eng-legend">
      <header>Legenda de resultados</header>
      <ResultLegend maxDisp={maxDisp} shells={shells}/>
    </section>
    <section className="eng-detail">
      <header>Detalhamento</header><div className="eng-detail-sketch"><span>▦</span><span>▥</span></div>
      <b>{analysisReady?'Detalhamento após análise':'Aguardando análise'}</b>
      <small>{analysisReady?'Resultados físicos disponíveis para iniciar desenho e revisão de armaduras.':'O detalhamento permanece bloqueado até existir um resultado físico do solver.'}</small>
      <button disabled={!analysisReady} onClick={()=>window.dispatchEvent(new CustomEvent('astrastruct:engineering-review-open',{detail:{tab:'foundation',source:'engineering-right-rail'}}))}>Visualizar detalhamento ›</button>
    </section>
    <section className="eng-status"><header>Status do projeto</header><div>✓ Baseline NBR 6118:2023 ativo</div><div>✓ Fundação visível ({foundationCount})</div><div className={analysisReady?'ok':'pending'}>{analysisReady?'✓':'○'} Detalhamento condicionado à análise</div><div className={result?'ok':'pending'}>{result?'✓':'○'} Deformada / tensões / deslocamentos</div></section>
  </div>;
}

export function EngineeringResultsStrip({result}:Pick<Props,'project'|'result'>){
  const[tab,setTab]=useState('Resultados');
  const vis=result?.engineeringVisualization,rows=vis?.floors?.levels||[];
  const reactions=result?.reactions||[];const forces=result?.elementForces||[];const displacements=result?.totalDisplacements||result?.displacements||[];const checks=result?.designChecks||result?.detailing?.reinforcement||[];
  return <div className="eng-results-strip" data-testid="engineering-results-strip">
    <div className="eng-result-tabs">{['Resultados','Reações de apoio','Esforços em elementos','Deslocamentos em nós','Armaduras (Resumo)'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div>
    {tab==='Resultados'&&<div className="eng-result-table"><table><thead><tr><th>Pavimento</th><th>Desloc. X (mm)</th><th>Desloc. Y (mm)</th><th>Desloc. Z (mm)</th><th>|u| (mm)</th><th>Drift X (%)</th><th>Drift Y (%)</th></tr></thead><tbody>
      {rows.length?rows.slice().reverse().map((r:any)=>{
        const drift=(vis?.floors?.storyDrifts||[]).find((d:any)=>d.levelId===r.id);
        return <tr key={r.id}><td>{r.label||r.id}</td><td>{fmt(r.uxMm,3)}</td><td>{fmt(r.uyMm,3)}</td><td>{fmt(r.uzMm,3)}</td><td>{fmt(r.resultantMm,3)}</td><td>{fmt(100*(drift?.driftX||0),3)}</td><td>{fmt(100*(drift?.driftY||0),3)}</td></tr>;
      }):<tr><td colSpan={7}>Execute uma análise 3D para preencher deslocamentos e drifts por pavimento.</td></tr>}
    </tbody></table></div>}
    {tab==='Reações de apoio'&&<div className="eng-result-table"><table><thead><tr><th>Nó</th><th>Fx [kN]</th><th>Fy [kN]</th><th>Fz [kN]</th><th>Mx [kN·m]</th><th>My [kN·m]</th><th>Mz [kN·m]</th></tr></thead><tbody>{reactions.length?reactions.map((r:any,i:number)=><tr key={r.nodeId||i}><td>{r.nodeId||'—'}</td><td>{fmt(r.fx??r.Fx,3)}</td><td>{fmt(r.fy??r.Fy,3)}</td><td>{fmt(r.fz??r.Fz,3)}</td><td>{fmt(r.mx??r.Mx,3)}</td><td>{fmt(r.my??r.My,3)}</td><td>{fmt(r.mz??r.Mz,3)}</td></tr>):<tr><td colSpan={7}>Nenhuma reação disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Esforços em elementos'&&<div className="eng-result-table"><table><thead><tr><th>Elemento</th><th>Tipo</th><th>N</th><th>V / Vy</th><th>Vz</th><th>M / My</th><th>Mz</th><th>T</th></tr></thead><tbody>{forces.length?forces.map((f:any,i:number)=><tr key={f.elementId||i}><td>{f.elementId||'—'}</td><td>{f.type||'barra'}</td><td>{fmt(f.N1??f.axialForce??f.Nx,3)}</td><td>{fmt(f.V1??f.Vy1??f.Qx,3)}</td><td>{fmt(f.Vz1??f.Qy,3)}</td><td>{fmt(f.M1??f.My1??f.Mx,3)}</td><td>{fmt(f.Mz1??f.My,3)}</td><td>{fmt(f.T1??f.Mxy,3)}</td></tr>):<tr><td colSpan={8}>Nenhum esforço disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Deslocamentos em nós'&&<div className="eng-result-table"><table><thead><tr><th>Nó</th><th>Ux [mm]</th><th>Uy [mm]</th><th>Uz [mm]</th><th>Rx [rad]</th><th>Ry [rad]</th><th>Rz [rad]</th></tr></thead><tbody>{displacements.length?displacements.map((d:any,i:number)=><tr key={d.nodeId||i}><td>{d.nodeId||'—'}</td><td>{fmt(1000*Number(d.ux||0),4)}</td><td>{fmt(1000*Number(d.uy||0),4)}</td><td>{fmt(1000*Number(d.uz||0),4)}</td><td>{fmt(d.rx,6)}</td><td>{fmt(d.ry,6)}</td><td>{fmt(d.rz,6)}</td></tr>):<tr><td colSpan={7}>Nenhum deslocamento disponível no resultado atual.</td></tr>}</tbody></table></div>}
    {tab==='Armaduras (Resumo)'&&<div className="eng-result-table"><table><thead><tr><th>Elemento</th><th>Verificação</th><th>Estado</th><th>Utilização</th><th>Armadura / detalhe</th></tr></thead><tbody>{checks.length?checks.map((c:any,i:number)=><tr key={c.id||i}><td>{c.elementId||c.id||'—'}</td><td>{c.limitState||c.category||c.type||'—'}</td><td>{c.status||'—'}</td><td>{fmt(c.utilization,3)}</td><td>{c.reinforcement||c.summary||c.detail||'—'}</td></tr>):<tr><td colSpan={5}>O resultado atual não contém detalhamento de armaduras. Abra Detalhamento após a análise.</td></tr>}</tbody></table></div>}
  </div>;
}

export function EngineeringRibbon(props:Props){return <Ribbon {...props}/>;}
