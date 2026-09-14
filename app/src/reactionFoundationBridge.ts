let reactionView:any=null;

function reactionStatus(){return document.querySelector<HTMLElement>('[data-testid="spatial3d-envelope-status"][data-envelope-domain="reaction"]')}
function focusedReaction(){const status=reactionStatus(),nodeId=status?.dataset.focusId;if(!nodeId||!reactionView?.items)return null;return reactionView.items.find((x:any)=>String(x.nodeId)===String(nodeId))||null}
function patch(){
  const status=reactionStatus();if(!status)return;
  const actions=status.querySelector<HTMLElement>('.spatial3d-envelope-actions');if(!actions||actions.querySelector('[data-reaction-foundation-open]'))return;
  const button=document.createElement('button');button.type='button';button.dataset.reactionFoundationOpen='true';button.dataset.testid='reaction-open-foundation';button.textContent='Abrir fundação vinculada';
  button.addEventListener('click',()=>{const reaction=focusedReaction(),nodeId=status.dataset.focusId||reaction?.nodeId;if(!nodeId)return;window.dispatchEvent(new CustomEvent('astrastruct:foundation-dashboard-open',{detail:{source:'reaction-map',nodeId:String(nodeId),reaction:reaction||{nodeId:String(nodeId)}}}))});
  actions.insertBefore(button,actions.lastElementChild||null);
}

window.addEventListener('astrastruct:envelope-3d',(ev:Event)=>{const d=(ev as CustomEvent)?.detail;if(d?.clear){reactionView=null;return}if(d?.domain==='reaction'&&Array.isArray(d.items))reactionView=d;queueMicrotask(patch)});
const observer=new MutationObserver(()=>patch());observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-focus-id','data-envelope-domain']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
export{};
