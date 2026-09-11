import React, { useMemo } from 'react';

export type DiagramKind='none'|'N'|'V'|'M';
type ToScreen=(x:number,y:number)=>[number,number];

const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const fmt=(v:number)=>{
  const a=Math.abs(v);
  if(a>=1000||(a>0&&a<.01))return v.toExponential(2);
  if(a>=100)return v.toFixed(0);
  if(a>=10)return v.toFixed(1);
  return v.toFixed(2);
};

function pathFrom(points:[number,number][],close=false){
  if(!points.length)return'';
  return points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')+(close?' Z':'');
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
    <path className="diagram-area" d={pathFrom(area,true)}/>
    <path className="diagram-line" d={pathFrom(diagram)}/>
    <line className="diagram-baseline" x1={baseline[0][0]} y1={baseline[0][1]} x2={baseline[baseline.length-1][0]} y2={baseline[baseline.length-1][1]}/>
    <circle className="diagram-extreme" cx={ep[0]} cy={ep[1]} r="3.4"/>
    <text className="diagram-value" x={ep[0]+7} y={ep[1]-7}>{field} {fmt(value)} {unit}</text>
  </g>;
}

function ForceDiagram({result,to,diagram,scale}:{result:any;to:ToScreen;diagram:DiagramKind;scale:number}){
  if(!result||diagram==='none')return null;
  const responses=(result.elementResponses||[]).filter((r:any)=>diagram==='N'||r.type==='frame2d');
  const values=responses.flatMap((r:any)=>(r.stations||[]).map((s:any)=>Math.abs(num(s[diagram]))));
  const maxAbs=Math.max(0,...values);
  if(!(maxAbs>1e-12))return <g data-testid="result-diagram" data-diagram={diagram}/>;
  return <g data-testid="result-diagram" data-diagram={diagram} className={`result-diagrams diagram-${diagram.toLowerCase()}`}>
    {responses.map((r:any)=><DiagramShape key={`${diagram}-${r.elementId}`} response={r} field={diagram} to={to} maxAbs={maxAbs} scale={scale}/>)}
  </g>;
}

export function ResultOverlays({result,to,showDeformed,deformationScale,diagram,diagramScale}:{result:any;to:ToScreen;showDeformed:boolean;deformationScale:number;diagram:DiagramKind;diagramScale:number}){
  const hasResult=!!result?.elementResponses?.length;
  const maxDisp=useMemo(()=>Math.max(0,...(result?.displacements||[]).map((d:any)=>Math.hypot(num(d.ux),num(d.uy)))),[result]);
  if(!hasResult)return null;
  return <g className="result-overlays" data-max-displacement={maxDisp}>
    {showDeformed&&<DeformedShape result={result} to={to} scale={deformationScale}/>} 
    <ForceDiagram result={result} to={to} diagram={diagram} scale={diagramScale}/>
  </g>;
}
