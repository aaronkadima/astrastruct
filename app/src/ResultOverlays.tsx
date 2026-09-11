import React, { useEffect, useMemo, useState } from 'react';

export type DiagramKind='none'|'N'|'V'|'M';
type ToScreen=(x:number,y:number)=>[number,number];
type Probe={response:any;station:any;envStation?:any;screen:[number,number]};

const VIEW={w:1000,h:680};
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const fmt=(v:any,d?:number)=>{
  const n=Number(v);if(!Number.isFinite(n))return '—';const a=Math.abs(n);
  if(a>=1000||(a>0&&a<.01))return n.toExponential(2);
  if(d!=null)return n.toFixed(d);if(a>=100)return n.toFixed(0);if(a>=10)return n.toFixed(1);return n.toFixed(2);
};
const rangeText=(r:any,unit='')=>r&&Number.isFinite(Number(r.min))&&Number.isFinite(Number(r.max))?`${fmt(r.min)}…${fmt(r.max)}${unit?` ${unit}`:''}`:'—';

function pathFrom(points:[number,number][],close=false){
  if(!points.length)return'';
  return points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')+(close?' Z':'');
}
function stressColor(t:number){const z=Math.max(0,Math.min(1,t)),h=215*(1-z);return`hsl(${h.toFixed(1)} 88% 60%)`}

function svgPoint(e:React.PointerEvent<SVGPathElement>){
  const svg=e.currentTarget.ownerSVGElement,ctm=svg?.getScreenCTM();if(!svg||!ctm)return null;
  const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(ctm.inverse());return[q.x,q.y] as [number,number];
}

function nearestProbe(response:any,to:ToScreen,p:[number,number],envResponse?:any):Probe|null{
  const stations=response?.stations||[];if(!stations.length)return null;
  let best=0,bestD=Infinity,bestScreen:[number,number]=[0,0];
  stations.forEach((s:any,i:number)=>{const q=to(num(s.x0),num(s.y0)),d=(q[0]-p[0])**2+(q[1]-p[1])**2;if(d<bestD){best=i;bestD=d;bestScreen=q}});
  return{response,station:stations[best],envStation:envResponse?.stations?.[best],screen:bestScreen};
}

function DeformedShape({result,to,scale}:{result:any;to:ToScreen;scale:number}){
  const responses=result?.elementResponses||[];
  if(!responses.length)return null;
  return <g data-testid="deformed-overlay" className="result-deformed-overlay">{responses.map((r:any)=>{
    const pts=(r.stations||[]).map((s:any)=>to(num(s.x0)+num(s.ux)*scale,num(s.y0)+num(s.uy)*scale));
    if(pts.length<2)return null;
    return <path key={`def-${r.elementId}`} data-element-id={r.elementId} className={`deformed-curve ${r.type==='truss2d'?'truss':'frame'}`} d={pathFrom(pts)}/>;
  })}</g>;
}

function DiagramShape({response,field,to,maxAbs,scale}:{response:any;field:'N'|'V'|'M';to:ToScreen;maxAbs:number;scale:number}){
  const stations=response?.stations||[];
  if(stations.length<2||!(maxAbs>0))return null;
  const c=num(response.c,1),s=num(response.s,0),nx=-s,ny=-c,pxScale=68*scale/maxAbs;
  const baseline:[number,number][]=stations.map((st:any)=>to(num(st.x0),num(st.y0)));
  const diagram:[number,number][]=stations.map((st:any,i:number)=>[baseline[i][0]+nx*num(st[field])*pxScale,baseline[i][1]+ny*num(st[field])*pxScale]);
  const area:[number,number][]=[baseline[0],...diagram,baseline[baseline.length-1]];
  const extreme=stations.reduce((best:any,st:any,index:number)=>Math.abs(num(st[field]))>Math.abs(num(best?.station?.[field]))?{station:st,index}:best,{station:stations[0],index:0});
  const ep=diagram[extreme.index],value=num(extreme.station[field]),unit=field==='M'?'kN·m':'kN';
  const type=field==='N'?'axial':field==='V'?'shear':'moment';
  return <g className={`result-diagram ${type}`} data-element-id={response.elementId}>
    <path className="diagram-area" d={pathFrom(area,true)}/><path className="diagram-line" d={pathFrom(diagram)}/>
    <line className="diagram-baseline" x1={baseline[0][0]} y1={baseline[0][1]} x2={baseline[baseline.length-1][0]} y2={baseline[baseline.length-1][1]}/>
    <circle className="diagram-extreme" cx={ep[0]} cy={ep[1]} r="3.4"/><text className="diagram-value" x={ep[0]+7} y={ep[1]-7}>{field} {fmt(value)} {unit}</text>
  </g>;
}

function ForceDiagram({result,to,diagram,scale}:{result:any;to:ToScreen;diagram:DiagramKind;scale:number}){
  if(!result||diagram==='none')return null;
  const responses=(result.elementResponses||[]).filter((r:any)=>diagram==='N'||r.type==='frame2d');
  const values=responses.flatMap((r:any)=>(r.stations||[]).map((s:any)=>Math.abs(num(s[diagram])))),maxAbs=Math.max(0,...values);
  if(!(maxAbs>1e-12))return <g data-testid="result-diagram" data-diagram={diagram}/>;
  return <g data-testid="result-diagram" data-diagram={diagram} className={`result-diagrams diagram-${diagram.toLowerCase()}`}>{responses.map((r:any)=><DiagramShape key={`${diagram}-${r.elementId}`} response={r} field={diagram} to={to} maxAbs={maxAbs} scale={scale}/>)}</g>;
}

function EnvelopeShape({response,envResponse,field,to,maxAbs,scale}:{response:any;envResponse:any;field:'N'|'V'|'M';to:ToScreen;maxAbs:number;scale:number}){
  const stations=response?.stations||[],envStations=envResponse?.stations||[];if(stations.length<2||envStations.length!==stations.length||!(maxAbs>0))return null;
  const s=num(response.s),nx=-s,ny=-num(response.c,1),pxScale=68*scale/maxAbs;
  const baseline:[number,number][]=stations.map((st:any)=>to(num(st.x0),num(st.y0)));
  const minPts:[number,number][]=envStations.map((st:any,i:number)=>[baseline[i][0]+nx*num(st[field]?.min)*pxScale,baseline[i][1]+ny*num(st[field]?.min)*pxScale]);
  const maxPts:[number,number][]=envStations.map((st:any,i:number)=>[baseline[i][0]+nx*num(st[field]?.max)*pxScale,baseline[i][1]+ny*num(st[field]?.max)*pxScale]);
  const area=[...maxPts,...minPts.slice().reverse()];
  let eMin=Infinity,eMax=-Infinity,eIndex=0,eValue=0;envStations.forEach((st:any,i:number)=>{const lo=num(st[field]?.min),hi=num(st[field]?.max);eMin=Math.min(eMin,lo);eMax=Math.max(eMax,hi);if(Math.abs(lo)>Math.abs(eValue)){eValue=lo;eIndex=i}if(Math.abs(hi)>Math.abs(eValue)){eValue=hi;eIndex=i}});
  const ep=eValue===num(envStations[eIndex]?.[field]?.min)?minPts[eIndex]:maxPts[eIndex],unit=field==='M'?'kN·m':'kN';
  return <g className={`envelope-diagram envelope-${field.toLowerCase()}`} data-element-id={response.elementId}>
    <path className="envelope-area" d={pathFrom(area,true)}/><path className="envelope-line min" d={pathFrom(minPts)}/><path className="envelope-line max" d={pathFrom(maxPts)}/>
    <text className="envelope-value" x={ep[0]+7} y={ep[1]-7}>{field} {fmt(eMin)}…{fmt(eMax)} {unit}</text>
  </g>;
}

function EnvelopeDiagram({result,envelope,to,diagram,scale}:{result:any;envelope:any;to:ToScreen;diagram:DiagramKind;scale:number}){
  if(!result||!envelope||diagram==='none')return null;
  const responses=(result.elementResponses||[]).filter((r:any)=>diagram==='N'||r.type==='frame2d');
  const envMap=new Map((envelope.elementResponses||[]).map((r:any)=>[r.elementId,r]));
  const values:number[]=[];responses.forEach((r:any)=>{const er:any=envMap.get(r.elementId);(er?.stations||[]).forEach((s:any)=>{values.push(Math.abs(num(s[diagram]?.min)),Math.abs(num(s[diagram]?.max)))})});
  const maxAbs=Math.max(0,...values);if(!(maxAbs>1e-12))return <g data-testid="envelope-diagram" data-diagram={diagram}/>;
  return <g data-testid="envelope-diagram" data-diagram={diagram} className={`envelope-diagrams envelope-${diagram.toLowerCase()}`}>{responses.map((r:any)=>{const er=envMap.get(r.elementId);return er?<EnvelopeShape key={`${diagram}-${r.elementId}`} response={r} envResponse={er} field={diagram} to={to} maxAbs={maxAbs} scale={scale}/>:null})}</g>;
}

function StressMap({result,envelope,to,useEnvelope}:{result:any;envelope:any;to:ToScreen;useEnvelope:boolean}){
  const responses=result?.elementResponses||[],envMap=new Map((envelope?.elementResponses||[]).map((r:any)=>[r.elementId,r]));
  const valueAt=(r:any,i:number)=>{
    if(useEnvelope){const er:any=envMap.get(r.elementId),v=er?.stations?.[i]?.sigmaAbs?.max;if(Number.isFinite(Number(v)))return Math.abs(Number(v))}
    const v=r?.stations?.[i]?.sigmaAbs;return Number.isFinite(Number(v))?Math.abs(Number(v)):null;
  };
  const values:number[]=[];responses.forEach((r:any)=>(r.stations||[]).forEach((_:any,i:number)=>{const v=valueAt(r,i);if(v!=null)values.push(v)}));
  const maxStress=Math.max(0,...values);if(!(maxStress>1e-12))return <g data-testid="stress-map" data-mode={useEnvelope?'envelope':'scenario'} data-max-stress="0"/>;
  return <g data-testid="stress-map" data-mode={useEnvelope?'envelope':'scenario'} data-max-stress={maxStress.toFixed(6)} className="stress-map">
    <defs><linearGradient id="astra-stress-gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={stressColor(0)}/><stop offset="50%" stopColor={stressColor(.5)}/><stop offset="100%" stopColor={stressColor(1)}/></linearGradient></defs>
    {responses.map((r:any)=>{const stations=r.stations||[];return <g key={`stress-${r.elementId}`} data-element-id={r.elementId}>{stations.slice(0,-1).map((st:any,i:number)=>{const v1=valueAt(r,i),v2=valueAt(r,i+1);if(v1==null||v2==null)return null;const a=to(num(st.x0),num(st.y0)),b=to(num(stations[i+1].x0),num(stations[i+1].y0)),v=(v1+v2)/2,t=v/maxStress;return <line key={i} className="stress-segment" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} style={{stroke:stressColor(t)}} data-stress={v.toFixed(5)}/>})}</g>})}
    <g className="stress-legend" transform="translate(18 52)"><rect className="stress-legend-bg" x="0" y="0" width="174" height="39" rx="6"/><text x="8" y="13">|σ| elástico {useEnvelope?'· envelope':'· cenário'} [MPa]</text><rect x="8" y="19" width="112" height="8" rx="3" fill="url(#astra-stress-gradient)"/><text x="8" y="36">0</text><text x="123" y="28">{fmt(maxStress,2)}</text></g>
  </g>;
}

function ProbeLayer({result,envelope,to,enabled,showEnvelope}:{result:any;envelope:any;to:ToScreen;enabled:boolean;showEnvelope:boolean}){
  const [probe,setProbe]=useState<Probe|null>(null);useEffect(()=>setProbe(null),[result,envelope,enabled]);
  if(!enabled||!result?.elementResponses?.length)return null;
  const envMap=new Map((envelope?.elementResponses||[]).map((r:any)=>[r.elementId,r]));
  const setFromEvent=(e:React.PointerEvent<SVGPathElement>,response:any)=>{const p=svgPoint(e);if(!p)return;const next=nearestProbe(response,to,p,envMap.get(response.elementId));if(next)setProbe(next)};
  const card=probe?(()=>{
    const st=probe.station,env=probe.envStation,w=276,h=showEnvelope&&env?176:132,x=Math.min(VIEW.w-w-8,Math.max(8,probe.screen[0]+18)),y=Math.min(VIEW.h-h-8,Math.max(8,probe.screen[1]-h/2));
    return <g data-testid="result-probe-card" className="result-probe-card" transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="8"/><text className="probe-title" x="12" y="20">{probe.response.elementId} · x={fmt(st.x,3)} m · x/L={fmt(st.xi,3)}</text>
      <text x="12" y="43">N {fmt(st.N)} kN</text><text x="102" y="43">V {fmt(st.V)} kN</text><text x="190" y="43">M {fmt(st.M)} kN·m</text>
      <text x="12" y="65">Ux {fmt(num(st.ux)*1000,3)} mm</text><text x="118" y="65">Uy {fmt(num(st.uy)*1000,3)} mm</text>
      <text x="12" y="87">σa {fmt(st.sigmaAxial,3)} MPa</text><text x="118" y="87">σsup {fmt(st.sigmaTop,3)} MPa</text>
      <text x="12" y="109">σinf {fmt(st.sigmaBottom,3)} MPa</text><text x="118" y="109">|σ|max {fmt(st.sigmaAbs,3)} MPa</text>
      {showEnvelope&&env&&<><line className="probe-sep" x1="10" y1="122" x2={w-10} y2="122"/><text className="probe-env" x="12" y="142">Env N {rangeText(env.N,'kN')}</text><text className="probe-env" x="12" y="158">Env V {rangeText(env.V,'kN')}</text><text className="probe-env" x="140" y="158">M {rangeText(env.M,'kN·m')}</text></>}
    </g>;
  })():null;
  return <g data-testid="result-probe-layer" className="result-probe-layer">{result.elementResponses.map((r:any)=>{const pts=(r.stations||[]).map((s:any)=>to(num(s.x0),num(s.y0)));if(pts.length<2)return null;return <path key={`probe-${r.elementId}`} data-element-id={r.elementId} className="result-probe-hit" d={pathFrom(pts)} onPointerMove={e=>{if(e.pointerType!=='touch')setFromEvent(e,r)}} onPointerDown={e=>{e.stopPropagation();setFromEvent(e,r)}}/>})}{probe&&<><circle className="probe-point" cx={probe.screen[0]} cy={probe.screen[1]} r="5"/>{card}</>}</g>;
}

export function ResultOverlays({result,envelope,to,showDeformed,deformationScale,diagram,diagramScale,showEnvelope=false,probeEnabled=false,showStressMap=false}:{result:any;envelope?:any;to:ToScreen;showDeformed:boolean;deformationScale:number;diagram:DiagramKind;diagramScale:number;showEnvelope?:boolean;probeEnabled?:boolean;showStressMap?:boolean}){
  const hasResult=!!result?.elementResponses?.length;
  const maxDisp=useMemo(()=>Math.max(0,...(result?.displacements||[]).map((d:any)=>Math.hypot(num(d.ux),num(d.uy)))),[result]);
  if(!hasResult)return null;
  return <g className="result-overlays" data-max-displacement={maxDisp}>
    {showStressMap&&<StressMap result={result} envelope={envelope} to={to} useEnvelope={showEnvelope}/>} 
    {showDeformed&&<DeformedShape result={result} to={to} scale={deformationScale}/>} 
    {showEnvelope?<EnvelopeDiagram result={result} envelope={envelope} to={to} diagram={diagram} scale={diagramScale}/>:<ForceDiagram result={result} to={to} diagram={diagram} scale={diagramScale}/>} 
    <ProbeLayer result={result} envelope={envelope} to={to} enabled={probeEnabled} showEnvelope={showEnvelope}/>
  </g>;
}
