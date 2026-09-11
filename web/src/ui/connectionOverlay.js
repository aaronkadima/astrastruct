import { normalizeProject } from '../core/model.js';

const KEY='astrastruct.project',NS='http://www.w3.org/2000/svg';
function read(){try{return normalizeProject(JSON.parse(localStorage.getItem(KEY)))}catch{return null}}
function make(tag,attrs={},text=''){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;return el}
function mode(e,key){if(e.releases?.[key]||e.rotationalSprings?.[key]===0)return'hinge';const k=e.rotationalSprings?.[key];return Number.isFinite(Number(k))&&Number(k)>0?'semi':'rigid'}
function fmt(v){const n=Number(v)||0;return Math.abs(n)>=10000?n.toExponential(2):n.toFixed(0)}

function draw(){
  const svg=document.querySelector('#model-svg');if(!svg||svg.querySelector('#connection-overlay'))return;const p=read();if(!p)return;const layer=make('g',{id:'connection-overlay','pointer-events':'none'});
  for(const e of p.elements.filter(x=>x.type==='frame2d')){
    const group=svg.querySelector(`[data-element="${CSS.escape(e.id)}"]`),line=group?.querySelector('line.member');if(!line)continue;
    const ends=[{key:'rz1',x:+line.getAttribute('x1'),y:+line.getAttribute('y1')},{key:'rz2',x:+line.getAttribute('x2'),y:+line.getAttribute('y2')}];
    ends.forEach((pt,i)=>{
      const m=mode(e,pt.key);if(m==='rigid')return;
      if(m==='hinge')layer.append(make('circle',{cx:pt.x,cy:pt.y,r:7,class:'connection-hinge'}));
      else{
        layer.append(make('circle',{cx:pt.x,cy:pt.y,r:9,class:'connection-semi'}));
        layer.append(make('circle',{cx:pt.x,cy:pt.y,r:4,class:'connection-semi-core'}));
        layer.append(make('text',{x:pt.x+11,y:pt.y-10,class:'advanced-load-label connection-label'},`kθ${i+1}=${fmt(e.rotationalSprings[pt.key])}`));
      }
    });
  }
  svg.append(layer);
}
const observer=new MutationObserver(()=>requestAnimationFrame(draw));observer.observe(document.getElementById('app'),{childList:true,subtree:true});draw();
