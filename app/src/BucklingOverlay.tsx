import React from 'react';

type ToScreen=(x:number,y:number)=>[number,number];
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function hermite(local:number[],L:number,xi:number){
  const x2=xi*xi,x3=x2*xi,h1=1-3*x2+2*x3,h2=L*(xi-2*x2+x3),h3=3*x2-2*x3,h4=L*(-x2+x3);
  return{u:(1-xi)*local[0]+xi*local[3],v:h1*local[1]+h2*local[2]+h3*local[4]+h4*local[5]};
}
function path(points:[number,number][]){return points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')}

export function BucklingOverlay({project,view,to,scale}:{project:any;view:any;to:ToScreen;scale:number}){
  const result=view?.result,mode=result?.modes?.[view?.modeIndex??0];if(!mode)return null;
  const map=new Map((mode.displacements||[]).map((d:any)=>[d.nodeId,d]));
  return <g data-testid="buckling-mode-overlay" data-mode={mode.mode} data-factor={mode.factor} className="buckling-mode-overlay">
    {(project.elements||[]).filter((e:any)=>e.type==='frame2d').map((e:any)=>{
      const a=project.nodes.find((n:any)=>n.id===e.n1),b=project.nodes.find((n:any)=>n.id===e.n2),da:any=map.get(e.n1),db:any=map.get(e.n2);if(!a||!b||!da||!db)return null;
      const dx=num(b.x)-num(a.x),dy=num(b.y)-num(a.y),L=Math.hypot(dx,dy);if(!(L>1e-12))return null;const c=dx/L,s=dy/L;
      const local=[c*num(da.ux)+s*num(da.uy),-s*num(da.ux)+c*num(da.uy),num(da.rz),c*num(db.ux)+s*num(db.uy),-s*num(db.ux)+c*num(db.uy),num(db.rz)];
      const pts:[number,number][]=[];for(let i=0;i<=32;i++){const xi=i/32,d=hermite(local,L,xi),ux=(c*d.u-s*d.v)*scale,uy=(s*d.u+c*d.v)*scale;pts.push(to(num(a.x)+xi*dx+ux,num(a.y)+xi*dy+uy))}
      return <path key={e.id} className="buckling-mode-curve" d={path(pts)} data-element-id={e.id}/>;
    })}
    <g className="buckling-mode-badge" transform="translate(18 102)"><rect width="210" height="42" rx="7"/><text x="10" y="17">Modo {mode.mode} · λcr = {Number(mode.factor).toFixed(4)}</text><text x="10" y="33">padrão: {result.scenario?.name||result.scenario?.id||'referência'}</text></g>
  </g>;
}
