// Opens the v0.53 project-design-basis workbench from the existing desktop Model menu.
function patch(){
  document.querySelectorAll<HTMLElement>('.modern-menu').forEach(menu=>{
    const trigger=menu.querySelector<HTMLElement>('.modern-menu-button');
    if(trigger?.textContent?.trim()!=='Modelo')return;
    const popup=menu.querySelector<HTMLElement>('.modern-menu-popup');
    if(!popup||popup.querySelector('[data-market-parity-open]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.marketParityOpen='true';button.setAttribute('data-testid','market-parity-open');button.innerHTML='<span>Base completa do projeto…</span><kbd>v0.53</kbd>';
    button.addEventListener('click',()=>{menu.classList.remove('open');window.dispatchEvent(new CustomEvent('astrastruct:market-parity-open'))});
    const sep=document.createElement('div');sep.className='modern-menu-separator';sep.dataset.marketParitySeparator='true';popup.prepend(sep);popup.prepend(button);
  });
}
const observer=new MutationObserver(patch);observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
export{};
