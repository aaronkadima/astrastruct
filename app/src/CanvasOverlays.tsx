import React from 'react';

type ToScreen=(x:number,y:number)=>[number,number];
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const abs=(v:any)=>Math.abs(num(v));
const fmt=(v:any,d=1)=>{const n=num(v);return Math.abs(n)>=1000?n.toExponential(2):n.toFixed(d)};

function MomentGlyph({x,y,value,kind}:{x:number;y:number;value:number;kind:'load'|'reaction'}){
  if(Math.abs(value)<1e-10)return null;
  const positive=value>0,r=25,cls=kind==='load'?'load-vector':'reaction-vector',marker=kind==='load'?'url(#astra-load-arrow)':'url(#astra-reaction-arrow)';
  const start=positive?`${x+20} ${y+15}`:`${x+20} ${y-15}`,end=positive?`${x+20} ${y-15}`:`${x+20} ${y+15}`,sweep=positive?0:1;
  return <g className={`${kind}-moment`}><path className={cls} d={`M ${start} A ${r} ${r} 0 1 ${sweep} ${end}`} markerEnd={marker}/><text className={`${kind}-label`} x={x+30} y={y-29}>{kind==='load'?'M':'Rₘ'} {fmt(value)} kN·m</text></g>;
}

function NodalLoads({project,displayProject,activeCase,to}:{project:any;displayProject:any;activeCase:string;to:ToScreen}){
  const loads=(project.loads||[]).filter((l:any)=>l.caseId===activeCase);
  return <g data-testid="nodal-loads" className="overlay-loads">{loads.map((l:any)=>{
    const n=displayProject.nodes.find((x:any)=>x.id===l.nodeId);if(!n)return null;const[x,y]=to(n.x,n.y),fx=num(l.fx),fy=num(l.fy),mz=num(l.mz),L=58;
    return <g key={l.id||`${l.nodeId}-${fx}-${fy}-${mz}`} className="nodal-load">
      {Math.abs(fx)>1e-10&&(()=>{const s=Math.sign(fx),ex=x-s*9,sx=ex-s*L;return <><line className="load-vector" x1={sx} y1={y} x2={ex} y2={y} markerEnd="url(#astra-load-arrow)"/><text className="load-label" x={sx+s*3} y={y-9}>Fx {fmt(fx)} kN</text></>})()}
      {Math.abs(fy)>1e-10&&(()=>{const s=Math.sign(fy),dir=-s,ey=y+dir*-9,sy=ey-dir*L;return <><line className="load-vector" x1={x} y1={sy} x2={x} y2={ey} markerEnd="url(#astra-load-arrow)"/><text className="load-label" x={x+9} y={sy+dir*3}>Fy {fmt(fy)} kN</text></>})()}
      <MomentGlyph x={x} y={y} value={mz} kind="load"/>
    </g>;
  })}</g>;
}

function ElementLoads({project,displayProject,activeCase,to}:{project:any;displayProject:any;activeCase:string;to:ToScreen}){
  return <g data-testid="element-loads" className="overlay-loads">{(displayProject.elements||[]).map((e:any)=>{
    const a=displayProject.nodes.find((n:any)=>n.id===e.n1),b=displayProject.nodes.find((n:any)=>n.id===e.n2);if(!a||!b)return null;
    const loads=(project.elementLoads||[]).filter((l:any)=>l.caseId===activeCase&&l.elementId===e.id);if(!loads.length)return null;
    const dx=num(b.x)-num(a.x),dy=num(b.y)-num(a.y),Lw=Math.hypot(dx,dy);if(!(Lw>1e-12))return null;
    const c=dx/Lw,s=dy/Lw,[x1,y1]=to(a.x,a.y),[x2,y2]=to(b.x,b.y),Ls=Math.max(1,Math.hypot(x2-x1,y2-y1)),tx=(x2-x1)/Ls,ty=(y2-y1)/Ls,nx=ty,ny=-tx;
    let qx=0,qy=0,hasSelfWeight=false,dT=0,dTg=0;const points:any[]=[];
    const mat=(project.materials||[]).find((m:any)=>m.id===e.materialId);
    for(const l of loads){
      if(l.kind==='uniform'){qx+=num(l.qx);qy+=num(l.qy)}
      else if(l.kind==='point')points.push(l);
      else if(l.kind==='selfWeight'){
        const gamma=num(l.gamma,num(mat?.density)),factor=Number.isFinite(Number(l.weightFactor))?Number(l.weightFactor):(Number.isFinite(Number(l.factor))?Number(l.factor):1),w=gamma*num(e.A)*factor;
        qx+=-s*w;qy+=-c*w;hasSelfWeight=true;
      } else if(l.kind==='thermal'){dT+=num(l.dT);dTg+=num(l.dTGradient)}
    }
    const samples=[.12,.31,.50,.69,.88],midX=(x1+x2)/2,midY=(y1+y2)/2;
    return <g key={`loads-${e.id}`} className="element-load">
      {Math.abs(qy)>1e-10&&<g>{samples.map((r,i)=>{const px=x1+(x2-x1)*r,py=y1+(y2-y1)*r,sg=Math.sign(qy),dirX=nx*sg,dirY=ny*sg,len=42;return <line key={`qy-${i}`} className="load-vector distributed" x1={px-dirX*len} y1={py-dirY*len} x2={px-dirX*7} y2={py-dirY*7} markerEnd="url(#astra-load-arrow)"/>})}<text className="load-label" x={midX-nx*Math.sign(qy)*50+7} y={midY-ny*Math.sign(qy)*50-5}>qy {fmt(qy)} kN/m{hasSelfWeight?' · incl. PP':''}</text></g>}
      {Math.abs(qx)>1e-10&&<g>{samples.slice(1,4).map((r,i)=>{const px=x1+(x2-x1)*r+nx*18,py=y1+(y2-y1)*r+ny*18,sg=Math.sign(qx),dirX=tx*sg,dirY=ty*sg,len=32;return <line key={`qx-${i}`} className="load-vector distributed axial" x1={px-dirX*len} y1={py-dirY*len} x2={px} y2={py} markerEnd="url(#astra-load-arrow)"/>})}<text className="load-label" x={midX+nx*27} y={midY+ny*27}>qx {fmt(qx)} kN/m</text></g>}
      {points.map((p:any)=>{const r=Math.max(0,Math.min(1,num(p.xi,.5))),px=x1+(x2-x1)*r,py=y1+(y2-y1)*r,Px=num(p.px),Py=num(p.py);return <g key={p.id||`${r}-${Px}-${Py}`} className="point-load">{Math.abs(Py)>1e-10&&(()=>{const sg=Math.sign(Py),dirX=nx*sg,dirY=ny*sg,len=54;return <><line className="load-vector point" x1={px-dirX*len} y1={py-dirY*len} x2={px-dirX*8} y2={py-dirY*8} markerEnd="url(#astra-load-arrow)"/><text className="load-label" x={px-dirX*(len+5)+7} y={py-dirY*(len+5)-5}>Py {fmt(Py)} kN</text></>})()}{Math.abs(Px)>1e-10&&(()=>{const sg=Math.sign(Px),dirX=tx*sg,dirY=ty*sg,len=48,ox=nx*13,oy=ny*13;return <><line className="load-vector point" x1={px+ox-dirX*len} y1={py+oy-dirY*len} x2={px+ox} y2={py+oy} markerEnd="url(#astra-load-arrow)"/><text className="load-label" x={px+ox-dirX*(len+4)} y={py+oy-dirY*(len+4)-5}>Px {fmt(Px)} kN</text></>})()}</g>})}
      {(Math.abs(dT)>1e-10||Math.abs(dTg)>1e-10)&&<text className="thermal-label" x={midX-nx*24} y={midY-ny*24}>{Math.abs(dT)>1e-10?`ΔT ${fmt(dT)}°C`:''}{Math.abs(dT)>1e-10&&Math.abs(dTg)>1e-10?' · ':''}{Math.abs(dTg)>1e-10?`ΔTg ${fmt(dTg)}°C`:''}</text>}
    </g>;
  })}</g>;
}

function Reactions({displayProject,result,to}:{displayProject:any;result:any;to:ToScreen}){
  const reactions=result?.reactions||[],max=Math.max(0,...reactions.flatMap((r:any)=>[abs(r.fx),abs(r.fy),abs(r.mz)])),tol=Math.max(1e-7,max*1e-7);
  if(!reactions.length)return null;
  return <g data-testid="reactions-overlay" className="overlay-reactions">{reactions.map((r:any)=>{
    const n=displayProject.nodes.find((x:any)=>x.id===r.nodeId);if(!n)return null;const[x,y]=to(n.x,n.y),fx=num(r.fx),fy=num(r.fy),mz=num(r.mz),L=52;
    if(abs(fx)<=tol&&abs(fy)<=tol&&abs(mz)<=tol)return null;
    return <g key={`reaction-${r.nodeId}`} className="reaction">
      {abs(fx)>tol&&(()=>{const s=Math.sign(fx),sx=x+s*9,ex=sx+s*L;return <><line className="reaction-vector" x1={sx} y1={y+4} x2={ex} y2={y+4} markerEnd="url(#astra-reaction-arrow)"/><text className="reaction-label" x={ex+s*5} y={y+19}>Rx {fmt(fx)} kN</text></>})()}
      {abs(fy)>tol&&(()=>{const s=Math.sign(fy),dir=-s,sy=y+dir*9,ey=sy+dir*L;return <><line className="reaction-vector" x1={x+4} y1={sy} x2={x+4} y2={ey} markerEnd="url(#astra-reaction-arrow)"/><text className="reaction-label" x={x+12} y={ey+dir*5}>Ry {fmt(fy)} kN</text></>})()}
      {abs(mz)>tol&&<MomentGlyph x={x} y={y} value={mz} kind="reaction"/>}
    </g>;
  })}</g>;
}

export function CanvasOverlays({project,displayProject,result,activeCase,to,showLoads=true,showReactions=true}:{project:any;displayProject:any;result:any;activeCase:string;to:ToScreen;showLoads?:boolean;showReactions?:boolean}){
  return <>
    <defs>
      <marker id="astra-load-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path className="load-arrowhead" d="M0,0 L0,6 L6,3 z"/></marker>
      <marker id="astra-reaction-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path className="reaction-arrowhead" d="M0,0 L0,6 L6,3 z"/></marker>
    </defs>
    {showLoads&&<><ElementLoads project={project} displayProject={displayProject} activeCase={activeCase} to={to}/><NodalLoads project={project} displayProject={displayProject} activeCase={activeCase} to={to}/></>}
    {showReactions&&<Reactions displayProject={displayProject} result={result} to={to}/>} 
    {(showLoads||(showReactions&&result))&&<g className="canvas-svg-legend" transform="translate(18 28)">{showLoads&&<><line className="load-vector" x1="0" y1="0" x2="24" y2="0"/><text x="31" y="4">ações</text></>}{showReactions&&result&&<><line className="reaction-vector" x1={showLoads?84:0} y1="0" x2={showLoads?108:24} y2="0"/><text x={showLoads?115:31} y="4">reações</text></>}</g>}
  </>;
}
