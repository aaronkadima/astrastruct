import { normalizeProject } from '../core/model.js';

const KEY='astrastruct.project';
const NS='http://www.w3.org/2000/svg';

function readProject(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function make(tag,attrs={},text=''){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;return el}
function num(v,d=1){const n=Number(v)||0;return Number(n.toFixed(d)).toString()}

function renderOverlay(){
  const svg=document.querySelector('#model-svg');if(!svg||svg.querySelector('#advanced-load-overlay'))return;
  const p=readProject();if(!p)return;const caseId=p.settings?.activeLoadCaseId||p.loadCases?.[0]?.id;
  const layer=make('g',{id:'advanced-load-overlay','pointer-events':'none'});

  for(const load of (p.elementLoads||[]).filter(l=>l.caseId===caseId)){
    const group=svg.querySelector(`[data-element="${CSS.escape(load.elementId)}"]`),line=group?.querySelector('line.member');if(!line)continue;
    const x1=+line.getAttribute('x1'),y1=+line.getAttribute('y1'),x2=+line.getAttribute('x2'),y2=+line.getAttribute('y2');
    if(load.kind==='point'){
      const xi=Math.max(0,Math.min(1,Number(load.xi??.5))),x=x1+(x2-x1)*xi,y=y1+(y2-y1)*xi;
      layer.append(make('circle',{cx:x,cy:y,r:8,class:'point-load-marker'}));
      layer.append(make('text',{x:x+10,y:y-12,class:'advanced-load-label'},`P @ ${num(xi,2)} · Px=${num(load.px)} · Py=${num(load.py)} kN`));
    }
    if(load.kind==='selfWeight'){
      const x=(x1+x2)/2,y=(y1+y2)/2;
      layer.append(make('path',{d:`M ${x} ${y-34} L ${x} ${y-10} M ${x-5} ${y-16} L ${x} ${y-10} L ${x+5} ${y-16}`,class:'selfweight-arrow'}));
      layer.append(make('text',{x:x+8,y:y-23,class:'advanced-load-label selfweight-label'},'PP'));
    }
    if(load.kind==='thermal'){
      const x=(x1+x2)/2,y=(y1+y2)/2;
      layer.append(make('rect',{x:x-14,y:y-10,width:28,height:20,rx:5,class:'thermal-marker'}));
      const parts=[`ΔT=${num(load.dT,1)}°C`];if(Math.abs(Number(load.dTGradient)||0)>1e-12)parts.push(`ΔTg=${num(load.dTGradient,1)}°C`);
      layer.append(make('text',{x:x+18,y:y+4,class:'advanced-load-label thermal-label'},parts.join(' · ')));
    }
  }

  for(const st of (p.settlements||[]).filter(s=>s.caseId===caseId)){
    if(Math.abs(st.ux||0)<1e-15&&Math.abs(st.uy||0)<1e-15&&Math.abs(st.rz||0)<1e-15)continue;
    const group=svg.querySelector(`[data-node="${CSS.escape(st.nodeId)}"]`),node=group?.querySelector('circle.node');if(!node)continue;
    const x=+node.getAttribute('cx'),y=+node.getAttribute('cy');
    layer.append(make('circle',{cx:x,cy:y,r:12,class:'settlement-marker'}));
    const parts=[];if(Math.abs(st.ux||0)>1e-15)parts.push(`Δx=${num(st.ux*1000,2)} mm`);if(Math.abs(st.uy||0)>1e-15)parts.push(`Δy=${num(st.uy*1000,2)} mm`);if(Math.abs(st.rz||0)>1e-15)parts.push(`Δθ=${num(st.rz*1000,2)} mrad`);
    layer.append(make('text',{x:x+14,y:y+30,class:'advanced-load-label settlement-label'},parts.join(' · ')));
  }

  for(const spring of p.nodeSprings||[]){
    const group=svg.querySelector(`[data-node="${CSS.escape(spring.nodeId)}"]`),node=group?.querySelector('circle.node');if(!node)continue;
    const x=+node.getAttribute('cx'),y=+node.getAttribute('cy');
    layer.append(make('path',{d:`M ${x+8} ${y} l 7 -5 l 7 10 l 7 -10 l 7 10 l 7 -5`,class:'spring-marker'}));
    const parts=[];if(spring.kx)parts.push(`kx=${num(spring.kx,0)}`);if(spring.ky)parts.push(`ky=${num(spring.ky,0)}`);if(spring.kr)parts.push(`kr=${num(spring.kr,0)}`);
    layer.append(make('text',{x:x+12,y:y-12,class:'advanced-load-label spring-label'},`k · ${parts.join(' / ')}`));
  }

  svg.append(layer);
}

const observer=new MutationObserver(()=>requestAnimationFrame(renderOverlay));
observer.observe(document.getElementById('app'),{childList:true,subtree:true});
renderOverlay();
