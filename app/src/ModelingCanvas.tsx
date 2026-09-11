import React, { useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore
import { makeFrameElement, makeTrussElement, uid } from '../../web/src/core/model.js';
// @ts-ignore
import { solveEnvelope } from '../../web/src/solver/envelope.js';
import { CanvasOverlays } from './CanvasOverlays';
import { ResultOverlays, type DiagramKind } from './ResultOverlays';
import { BucklingOverlay } from './BucklingOverlay';
import { Glyph } from './AstraIcons';

export type ModelTool='select'|'node'|'frame2d'|'truss2d';
export type Selection={kind:'node'|'element';id:string}|null;
type Camera={cx:number;cy:number;scale:number};
type WorldPoint={x:number;y:number;nodeId?:string};
type DragState={id:string;startX:number;startY:number};
type PanState={pointerId:number;clientX:number;clientY:number;camera:Camera};

const VIEW={w:1000,h:680,p:90};
const MIN_SCALE=8;
const MAX_SCALE=5000;
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
const makeFrame:any=makeFrameElement;
const makeTruss:any=makeTrussElement;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));

function bounds(project:any){
  if(!project.nodes?.length)return{minX:0,maxX:10,minY:0,maxY:6};
  const xs=project.nodes.map((n:any)=>Number(n.x)||0),ys=project.nodes.map((n:any)=>Number(n.y)||0);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function fitCamera(project:any):Camera{
  const b=bounds(project),dx=Math.max(2,b.maxX-b.minX),dy=Math.max(2,b.maxY-b.minY);
  return{cx:(b.minX+b.maxX)/2,cy:(b.minY+b.maxY)/2,scale:clamp(Math.min((VIEW.w-2*VIEW.p)/dx,(VIEW.h-2*VIEW.p)/dy),MIN_SCALE,MAX_SCALE)};
}
function transform(camera:Camera){
  return{
    to:(x:number,y:number):[number,number]=>[VIEW.w/2+(x-camera.cx)*camera.scale,VIEW.h/2-(y-camera.cy)*camera.scale],
    from:(X:number,Y:number):[number,number]=>[camera.cx+(X-VIEW.w/2)/camera.scale,camera.cy-(Y-VIEW.h/2)/camera.scale],
    scale:camera.scale
  };
}
function snap(project:any,v:number){const g=Number(project.settings?.grid)||.25;return project.settings?.snap===false?v:Math.round(v/g)*g}
function nearest(project:any,x:number,y:number,t:number,excludeId?:string){return project.nodes.find((n:any)=>n.id!==excludeId&&Math.hypot(Number(n.x)-x,Number(n.y)-y)<=t)}
function nextNodeId(project:any){let i=1;while(project.nodes.some((n:any)=>n.id===`N${i}`))i++;return`N${i}`}
function screenPoint(svg:SVGSVGElement|null,clientX:number,clientY:number){
  if(!svg)return{X:0,Y:0};const r=svg.getBoundingClientRect();return{X:r.width?(clientX-r.left)*VIEW.w/r.width:0,Y:r.height?(clientY-r.top)*VIEW.h/r.height:0};
}
function isEditableTarget(target:EventTarget|null){const el=target as HTMLElement|null;return !!el?.closest?.('input,textarea,select,button,[contenteditable="true"]')}

function mergeNodeInto(project:any,sourceId:string,targetId:string){
  if(sourceId===targetId)return project;
  project.nodes=project.nodes.filter((n:any)=>n.id!==sourceId);
  project.elements=(project.elements||[]).map((e:any)=>({...e,n1:e.n1===sourceId?targetId:e.n1,n2:e.n2===sourceId?targetId:e.n2}));
  const duplicateToKept=new Map<string,string>(),keptByKey=new Map<string,string>();
  project.elements=project.elements.filter((e:any)=>{
    if(e.n1===e.n2)return false;const pair=[e.n1,e.n2].sort().join('|'),key=`${e.type}|${pair}`,kept=keptByKey.get(key);
    if(kept){duplicateToKept.set(e.id,kept);return false}keptByKey.set(key,e.id);return true;
  });
  project.elementLoads=(project.elementLoads||[]).map((l:any)=>({...l,elementId:duplicateToKept.get(l.elementId)||l.elementId}));
  const supportMap=new Map<string,any>();
  for(const raw of project.supports||[]){
    const s={...raw,nodeId:raw.nodeId===sourceId?targetId:raw.nodeId},prev=supportMap.get(s.nodeId);
    if(!prev){supportMap.set(s.nodeId,s);continue}
    supportMap.set(s.nodeId,{...prev,...s,ux:!!(prev.ux||s.ux),uy:!!(prev.uy||s.uy),rz:!!(prev.rz||s.rz),baseUxValue:Number(prev.baseUxValue)||Number(s.baseUxValue)||0,baseUyValue:Number(prev.baseUyValue)||Number(s.baseUyValue)||0,baseRzValue:Number(prev.baseRzValue)||0});
  }
  project.supports=[...supportMap.values()];
  project.loads=(project.loads||[]).map((l:any)=>({...l,nodeId:l.nodeId===sourceId?targetId:l.nodeId}));
  project.settlements=(project.settlements||[]).map((s:any)=>({...s,nodeId:s.nodeId===sourceId?targetId:s.nodeId}));
  project.nodeSprings=(project.nodeSprings||[]).map((s:any)=>({...s,nodeId:s.nodeId===sourceId?targetId:s.nodeId}));
  project.connections=(project.connections||[]).map((c:any)=>({...c,nodeId:c.nodeId===sourceId?targetId:c.nodeId,nodes:Array.isArray(c.nodes)?c.nodes.map((id:string)=>id===sourceId?targetId:id):c.nodes,elementIds:Array.isArray(c.elementIds)?c.elementIds.map((id:string)=>duplicateToKept.get(id)||id):c.elementIds}));
  return project;
}

function Support({node,project,to}:{node:any;project:any;to:(x:number,y:number)=>[number,number]}){
  const s=project.supports?.find((x:any)=>x.nodeId===node.id);if(!s||!(s.ux||s.uy||s.rz))return null;const[x,y]=to(node.x,node.y);
  if(s.ux&&s.uy&&s.rz)return <g className="support"><line x1={x-16} y1={y+14} x2={x+16} y2={y+14}/><line x1={x-13} y1={y+18} x2={x-5} y2={y+26}/><line x1={x-2} y1={y+18} x2={x+6} y2={y+26}/><line x1={x+9} y1={y+18} x2={x+17} y2={y+26}/></g>;
  if(s.uy)return <g className="support"><path d={`M ${x-13} ${y+17} L ${x+13} ${y+17} L ${x} ${y+3} Z`}/><circle cx={x-7} cy={y+22} r="3"/><circle cx={x+7} cy={y+22} r="3"/></g>;
  return <g className="support"><path d={`M ${x-13} ${y+17} L ${x+13} ${y+17} L ${x} ${y+3} Z`}/><line x1={x-18} y1={y+22} x2={x+18} y2={y+22}/></g>;
}

export function ModelingCanvas({project,result,bucklingView,onClearBuckling,tool,selection,onSelection,onCommit}:{project:any;result:any;bucklingView?:any;onClearBuckling?:()=>void;tool:ModelTool;selection:Selection;onSelection:(s:Selection)=>void;onCommit:(p:any)=>void}){
  const svgRef=useRef<SVGSVGElement|null>(null),spacePressed=useRef(false),touchesRef=useRef(new Map<number,{x:number;y:number}>()),pinchRef=useRef<{distance:number;world:{x:number;y:number};scale:number}|null>(null);
  const [camera,setCamera]=useState<Camera>(()=>fitCamera(project));
  const [draft,setDraft]=useState<WorldPoint|null>(null),[cursor,setCursor]=useState<WorldPoint|null>(null),[drag,setDrag]=useState<DragState|null>(null),[dragPoint,setDragPoint]=useState<WorldPoint|null>(null),[panDrag,setPanDrag]=useState<PanState|null>(null);
  const [showLoads,setShowLoads]=useState(true),[showReactions,setShowReactions]=useState(true),[showDeformed,setShowDeformed]=useState(true),[diagram,setDiagram]=useState<DiagramKind>('none');
  const [showEnvelope,setShowEnvelope]=useState(false),[probeEnabled,setProbeEnabled]=useState(false),[showStressMap,setShowStressMap]=useState(false);
  const [deformMultiplier,setDeformMultiplier]=useState(1),[diagramScale,setDiagramScale]=useState(1),[bucklingMultiplier,setBucklingMultiplier]=useState(1);

  useEffect(()=>{setDraft(null);setCursor(null);setDrag(null);setDragPoint(null);setPanDrag(null)},[tool]);
  useEffect(()=>{setCamera(fitCamera(project))},[project.id]);
  useEffect(()=>{if(!result){setShowEnvelope(false);setProbeEnabled(false);setShowStressMap(false)}},[result]);
  useEffect(()=>{setBucklingMultiplier(1)},[bucklingView?.modeIndex,bucklingView?.result]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(e.code==='Escape'){setDraft(null);setDrag(null);setDragPoint(null);setPanDrag(null);return}if(e.code==='Space'&&!isEditableTarget(e.target)){spacePressed.current=true;e.preventDefault()}};
    const up=(e:KeyboardEvent)=>{if(e.code==='Space')spacePressed.current=false};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
  },[]);

  const tf=useMemo(()=>transform(camera),[camera]),fitScale=useMemo(()=>fitCamera(project).scale,[project]);
  const displayProject=useMemo(()=>{if(!drag||!dragPoint)return project;const p=clone(project),n=p.nodes.find((x:any)=>x.id===drag.id);if(n){n.x=dragPoint.x;n.y=dragPoint.y}return p},[project,drag,dragPoint]);
  const activeCase=project.settings?.activeLoadCaseId||project.loadCases?.[0]?.id,resultAvailable=!!result?.elementResponses?.length;
  const maxDisp=useMemo(()=>Math.max(0,...(result?.displacements||[]).map((d:any)=>Math.hypot(Number(d.ux)||0,Number(d.uy)||0))),[result]);
  const characteristicLength=useMemo(()=>{const b=bounds(project);return Math.max(2,b.maxX-b.minX,b.maxY-b.minY)},[project]);
  const autoDefScale=maxDisp>1e-15?clamp(characteristicLength*.08/maxDisp,1,5000):1,deformationScale=autoDefScale*deformMultiplier,bucklingScale=characteristicLength*.12*bucklingMultiplier;
  const envelope=useMemo(()=>{if(!showEnvelope||!resultAvailable)return null;try{return solveEnvelope(project)}catch{return null}},[showEnvelope,resultAvailable,project]);

  const gridData=useMemo(()=>{
    const base=Math.max(1e-6,Number(project.settings?.grid)||.25);let step=base;while(step*tf.scale<24)step*=2;
    const[left,top]=tf.from(0,0),[right,bottom]=tf.from(VIEW.w,VIEW.h),minX=Math.min(left,right),maxX=Math.max(left,right),minY=Math.min(top,bottom),maxY=Math.max(top,bottom),xs:number[]=[],ys:number[]=[];
    let x=Math.floor(minX/step)*step,guard=0;for(;x<=maxX+step*.5&&guard<180;x+=step,guard++)xs.push(x);let y=Math.floor(minY/step)*step;guard=0;for(;y<=maxY+step*.5&&guard<180;y+=step,guard++)ys.push(y);return{xs,ys,step};
  },[project.settings?.grid,tf]);

  const eventWorld=(e:React.PointerEvent<SVGSVGElement>,excludeId?:string):WorldPoint=>{
    const pt=screenPoint(svgRef.current,e.clientX,e.clientY),[rawX,rawY]=tf.from(pt.X,pt.Y),tolerance=Math.max(12/tf.scale,(Number(project.settings?.grid)||.25)*.20),hit=nearest(project,rawX,rawY,tolerance,excludeId);
    if(hit)return{x:Number(hit.x),y:Number(hit.y),nodeId:hit.id};return{x:+snap(project,rawX).toFixed(5),y:+snap(project,rawY).toFixed(5)};
  };
  const ensureNode=(p:any,x:number,y:number,nodeId?:string)=>{const existing=nodeId?p.nodes.find((n:any)=>n.id===nodeId):nearest(p,x,y,1e-7);if(existing)return existing;const n={id:nextNodeId(p),x:+x.toFixed(5),y:+y.toFixed(5)};p.nodes.push(n);return n};
  const finishMember=(x:number,y:number,nodeId?:string)=>{
    if(!draft)return;const startNode=draft.nodeId?project.nodes.find((n:any)=>n.id===draft.nodeId):nearest(project,draft.x,draft.y,1e-7),endNode=nodeId?project.nodes.find((n:any)=>n.id===nodeId):nearest(project,x,y,1e-7),sx=startNode?.x??draft.x,sy=startNode?.y??draft.y,ex=endNode?.x??x,ey=endNode?.y??y;
    if(Math.hypot(ex-sx,ey-sy)<1e-8){setDraft(null);return}
    const p=clone(project),n1=ensureNode(p,sx,sy,startNode?.id),n2=ensureNode(p,ex,ey,endNode?.id),targetType=tool==='truss2d'?'truss2d':'frame2d',duplicate=p.elements.find((e:any)=>e.type===targetType&&((e.n1===n1.id&&e.n2===n2.id)||(e.n1===n2.id&&e.n2===n1.id)));
    if(duplicate){setDraft(null);onSelection({kind:'element',id:duplicate.id});return}
    const created=tool==='truss2d'?makeTruss({id:uid('E'),n1:n1.id,n2:n2.id,label:'Treliça 2D'}):makeFrame({id:uid('E'),n1:n1.id,n2:n2.id,label:'Pórtico 2D'});p.elements.push(created);onCommit(p);setDraft(null);onSelection({kind:'element',id:created.id});
  };

  const startPan=(e:React.PointerEvent<SVGSVGElement>)=>{setPanDrag({pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,camera:{...camera}});svgRef.current?.setPointerCapture?.(e.pointerId)};
  const backgroundPointer=(e:React.PointerEvent<SVGSVGElement>)=>{
    if((e.target as Element).closest?.('[data-entity],.result-probe-hit'))return;if(e.button===1||spacePressed.current)return;if(e.pointerType==='touch'&&touchesRef.current.size>=2)return;if(e.button!==0)return;
    if(tool==='select'){onSelection(null);startPan(e);return}
    const point=eventWorld(e);if(tool==='node'){if(point.nodeId)return;const p=clone(project),n=ensureNode(p,point.x,point.y);onCommit(p);onSelection({kind:'node',id:n.id});return}if(tool==='frame2d'||tool==='truss2d'){if(!draft)setDraft(point);else finishMember(point.x,point.y,point.nodeId)};
  };
  const nodePointerDown=(e:React.PointerEvent,id:string)=>{
    if(spacePressed.current||e.button!==0||pinchRef.current)return;e.stopPropagation();const n=project.nodes.find((x:any)=>x.id===id);
    if(tool==='select'){onSelection({kind:'node',id});if(n){setDrag({id,startX:n.x,startY:n.y});setDragPoint({x:n.x,y:n.y});(e.currentTarget as Element).setPointerCapture?.(e.pointerId)}}else if(tool==='frame2d'||tool==='truss2d'){if(!draft)setDraft({x:n.x,y:n.y,nodeId:id});else finishMember(n.x,n.y,id)};
  };
  const pointerCaptureDown=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.button===1||(e.button===0&&spacePressed.current)){startPan(e);return}if(e.pointerType!=='touch')return;touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchesRef.current.size===2){const[a,b]=[...touchesRef.current.values()],distance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),midClient={x:(a.x+b.x)/2,y:(a.y+b.y)/2},mid=screenPoint(svgRef.current,midClient.x,midClient.y),[wx,wy]=tf.from(mid.X,mid.Y);pinchRef.current={distance,world:{x:wx,y:wy},scale:camera.scale};setPanDrag(null);setDrag(null);setDragPoint(null)};
  };
  const pointerCaptureMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.pointerType!=='touch'||!touchesRef.current.has(e.pointerId))return;touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchesRef.current.size<2||!pinchRef.current)return;
    const[a,b]=[...touchesRef.current.values()],distance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),midClient={x:(a.x+b.x)/2,y:(a.y+b.y)/2},mid=screenPoint(svgRef.current,midClient.x,midClient.y),nextScale=clamp(pinchRef.current.scale*(distance/pinchRef.current.distance),MIN_SCALE,MAX_SCALE),world=pinchRef.current.world;setCamera({scale:nextScale,cx:world.x-(mid.X-VIEW.w/2)/nextScale,cy:world.y+(mid.Y-VIEW.h/2)/nextScale});
  };
  const pointerCaptureUp=(e:React.PointerEvent<SVGSVGElement>)=>{if(e.pointerType==='touch')touchesRef.current.delete(e.pointerId);if(touchesRef.current.size<2)pinchRef.current=null};
  const pointerMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(pinchRef.current)return;if(panDrag){const r=svgRef.current?.getBoundingClientRect(),dx=r?.width?(e.clientX-panDrag.clientX)*VIEW.w/r.width:0,dy=r?.height?(e.clientY-panDrag.clientY)*VIEW.h/r.height:0;setCamera({...panDrag.camera,cx:panDrag.camera.cx-dx/panDrag.camera.scale,cy:panDrag.camera.cy+dy/panDrag.camera.scale});return}const point=eventWorld(e,drag?.id);setCursor(point);if(drag)setDragPoint(point);
  };
  const pointerUp=()=>{
    if(panDrag){setPanDrag(null);return}if(drag&&dragPoint){const moved=Math.abs(dragPoint.x-drag.startX)>1e-12||Math.abs(dragPoint.y-drag.startY)>1e-12;if(moved){const p=clone(project);if(dragPoint.nodeId&&dragPoint.nodeId!==drag.id){mergeNodeInto(p,drag.id,dragPoint.nodeId);onCommit(p);onSelection({kind:'node',id:dragPoint.nodeId})}else{const n=p.nodes.find((x:any)=>x.id===drag.id);if(n){n.x=dragPoint.x;n.y=dragPoint.y;onCommit(p)}}}}setDrag(null);setDragPoint(null);
  };
  const wheel=(e:React.WheelEvent<SVGSVGElement>)=>{e.preventDefault();const pt=screenPoint(svgRef.current,e.clientX,e.clientY),factor=Math.exp(-e.deltaY*.0015);setCamera(prev=>{const old=transform(prev),[wx,wy]=old.from(pt.X,pt.Y),nextScale=clamp(prev.scale*factor,MIN_SCALE,MAX_SCALE);return{scale:nextScale,cx:wx-(pt.X-VIEW.w/2)/nextScale,cy:wy+(pt.Y-VIEW.h/2)/nextScale}})};
  const zoomBy=(factor:number)=>setCamera(prev=>({...prev,scale:clamp(prev.scale*factor,MIN_SCALE,MAX_SCALE)})),fitView=()=>setCamera(fitCamera(project));
  const toggleDiagram=(kind:Exclude<DiagramKind,'none'>)=>setDiagram(d=>d===kind?'none':kind);
  const toggleEnvelope=()=>setShowEnvelope(v=>{const next=!v;if(next&&diagram==='none')setDiagram('M');return next});

  const draftEnd=cursor&&draft?tf.to(cursor.x,cursor.y):null,draftStart=draft?tf.to(draft.x,draft.y):null,zoomPercent=Math.round((camera.scale/Math.max(1e-9,fitScale))*100);
  return <div className="canvas-shell">
    <svg ref={svgRef} data-testid="model-canvas" data-camera-scale={camera.scale.toFixed(4)} data-camera-cx={camera.cx.toFixed(5)} data-camera-cy={camera.cy.toFixed(5)} className={`model-canvas modeling tool-${tool} ${panDrag?'is-panning':''}`} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label="Modelo estrutural 2D" onPointerDownCapture={pointerCaptureDown} onPointerMoveCapture={pointerCaptureMove} onPointerUpCapture={pointerCaptureUp} onPointerCancelCapture={pointerCaptureUp} onPointerDown={backgroundPointer} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={e=>{if(e.buttons===0)pointerUp()}} onWheel={wheel} onContextMenu={e=>e.preventDefault()}>
      <g className="grid-lines">{gridData.xs.map((x:number)=><line key={`v${x}`} x1={tf.to(x,0)[0]} y1="0" x2={tf.to(x,0)[0]} y2={VIEW.h}/>)}{gridData.ys.map((y:number)=><line key={`h${y}`} x1="0" y1={tf.to(0,y)[1]} x2={VIEW.w} y2={tf.to(0,y)[1]}/>)}</g>
      {displayProject.elements?.map((e:any)=>{const a=displayProject.nodes.find((n:any)=>n.id===e.n1),b=displayProject.nodes.find((n:any)=>n.id===e.n2);if(!a||!b)return null;const[x1,y1]=tf.to(a.x,a.y),[x2,y2]=tf.to(b.x,b.y);return <g data-entity="element" key={e.id} className="clickable" onPointerDown={ev=>{if(spacePressed.current||ev.button!==0)return;ev.stopPropagation();if(tool==='select')onSelection({kind:'element',id:e.id})}}><line className={`member ${e.type==='truss2d'?'truss':''} ${selection?.kind==='element'&&selection.id===e.id?'selected':''}`} x1={x1} y1={y1} x2={x2} y2={y2}/><text className="element-label" x={(x1+x2)/2+8} y={(y1+y2)/2-8}>{e.id}</text></g>})}
      <ResultOverlays result={result} envelope={envelope} to={tf.to} showDeformed={showDeformed} deformationScale={deformationScale} diagram={diagram} diagramScale={diagramScale} showEnvelope={showEnvelope} probeEnabled={probeEnabled} showStressMap={showStressMap}/>
      {bucklingView&&<BucklingOverlay project={project} view={bucklingView} to={tf.to} scale={bucklingScale}/>} 
      <CanvasOverlays project={project} displayProject={displayProject} result={result} activeCase={activeCase} to={tf.to} showLoads={showLoads} showReactions={showReactions}/>
      {displayProject.nodes?.map((n:any)=>{const[x,y]=tf.to(n.x,n.y);return <g data-entity="node" data-node-id={n.id} key={n.id} className="clickable" onPointerDown={e=>nodePointerDown(e,n.id)}><Support node={n} project={displayProject} to={tf.to}/><circle className={`node ${selection?.kind==='node'&&selection.id===n.id?'selected':''}`} cx={x} cy={y} r={selection?.kind==='node'&&selection.id===n.id?9:6}/><text className="node-label" x={x+10} y={y-10}>{n.id}</text></g>})}
      {draftStart&&draftEnd&&<line className="draft-member" x1={draftStart[0]} y1={draftStart[1]} x2={draftEnd[0]} y2={draftEnd[1]}/>} {cursor&&tool!=='select'&&<circle className={`cursor-snap ${cursor.nodeId?'node-hit':''}`} cx={tf.to(cursor.x,cursor.y)[0]} cy={tf.to(cursor.x,cursor.y)[1]} r={cursor.nodeId?8:5}/>} 
    </svg>

    <div className="canvas-result-tools" role="group" aria-label="Camadas de visualização">
      <button data-testid="toggle-loads" className={showLoads?'active':''} aria-label="Mostrar ou ocultar ações" title="Ações" onClick={()=>setShowLoads(v=>!v)}><Glyph name="loads"/></button>
      <button data-testid="toggle-reactions" className={showReactions?'active':''} aria-label="Mostrar ou ocultar reações" title="Reações" disabled={!result} onClick={()=>setShowReactions(v=>!v)}><Glyph name="reactions"/></button>
      <button data-testid="toggle-deformed" className={showDeformed?'active':''} aria-label="Mostrar ou ocultar deformada" title="Deformada" disabled={!resultAvailable} onClick={()=>setShowDeformed(v=>!v)}><Glyph name="deformed"/></button>
      <button data-testid="toggle-probe" className={probeEnabled?'active':''} aria-label="Sonda de resultados" title="Inspecionar resultados na barra" disabled={!resultAvailable} onClick={()=>setProbeEnabled(v=>!v)}><Glyph name="probe"/></button>
      <button data-testid="toggle-envelope" className={showEnvelope?'active':''} aria-label="Envelope no modelo" title="Envelope mínimo/máximo" disabled={!resultAvailable} onClick={toggleEnvelope}><Glyph name="envelope"/></button>
      <button data-testid="toggle-stress-map" className={showStressMap?'active':''} aria-label="Mapa de tensão elástica" title="Mapa |σ| elástico [MPa]" disabled={!resultAvailable} onClick={()=>setShowStressMap(v=>!v)}><Glyph name="stress"/></button>
      {bucklingView&&<button data-testid="toggle-buckling-mode" className="active" aria-label="Ocultar modo de flambagem" title="Ocultar modo de flambagem" onClick={onClearBuckling}><Glyph name="stability"/></button>}
      <span className="result-tool-sep"/>
      <button data-testid="diagram-N" className={diagram==='N'?'active':''} aria-label="Diagrama de esforço normal" title="N(x)" disabled={!resultAvailable} onClick={()=>toggleDiagram('N')}><Glyph name="axial"/></button>
      <button data-testid="diagram-V" className={diagram==='V'?'active':''} aria-label="Diagrama de esforço cortante" title="V(x)" disabled={!resultAvailable} onClick={()=>toggleDiagram('V')}><Glyph name="shear"/></button>
      <button data-testid="diagram-M" className={diagram==='M'?'active':''} aria-label="Diagrama de momento fletor" title="M(x)" disabled={!resultAvailable} onClick={()=>toggleDiagram('M')}><Glyph name="moment"/></button>
    </div>

    {(resultAvailable&&(showDeformed||diagram!=='none')||bucklingView)&&<div className="canvas-result-scales">
      {showDeformed&&resultAvailable&&<label title="Escala gráfica da deformada"><Glyph name="deformed"/><input aria-label="Escala da deformada" type="range" min="0.1" max="4" step="0.1" value={deformMultiplier} onChange={e=>setDeformMultiplier(Number(e.target.value))}/><span>×{deformationScale>=100?deformationScale.toFixed(0):deformationScale.toFixed(1)}</span></label>}
      {diagram!=='none'&&resultAvailable&&<label title={showEnvelope?'Escala gráfica do envelope':'Escala gráfica do diagrama'}><Glyph name={showEnvelope?'envelope':diagram==='N'?'axial':diagram==='V'?'shear':'moment'}/><input aria-label="Escala do diagrama" type="range" min="0.4" max="2.5" step="0.1" value={diagramScale} onChange={e=>setDiagramScale(Number(e.target.value))}/><span>{showEnvelope?'ENV ':''}{diagram} ×{diagramScale.toFixed(1)}</span></label>}
      {bucklingView&&<label title="Escala gráfica do modo de flambagem"><Glyph name="stability"/><input aria-label="Escala do modo de flambagem" type="range" min="0.25" max="3" step="0.05" value={bucklingMultiplier} onChange={e=>setBucklingMultiplier(Number(e.target.value))}/><span>modo ×{bucklingMultiplier.toFixed(2)}</span></label>}
    </div>}

    <div className="canvas-nav" role="group" aria-label="Navegação do canvas"><button type="button" aria-label="Aproximar" title="Aproximar" onClick={()=>zoomBy(1.25)}><Glyph name="zoomIn"/></button><button type="button" aria-label="Afastar" title="Afastar" onClick={()=>zoomBy(.8)}><Glyph name="zoomOut"/></button><button type="button" aria-label="Ajustar à vista" title="Ajustar modelo à vista" onClick={fitView}><Glyph name="fit"/></button><span className="zoom-readout">{zoomPercent}%</span></div>
    <div className="canvas-hud"><span>{cursor?`X ${cursor.x.toFixed(3)} · Y ${cursor.y.toFixed(3)}`:'X — · Y —'}</span><span>grade {gridData.step.toFixed(gridData.step<1?3:2)} m</span><span className="desktop-hint">arraste nó · fundo = pan · roda/pinça = zoom · Espaço = pan{probeEnabled?' · sonda ativa':''}{showStressMap?' · mapa |σ|':''}{bucklingView?' · modo crítico':''}</span></div>
  </div>;
}
