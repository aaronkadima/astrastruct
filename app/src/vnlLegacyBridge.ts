const isLegacyVnlTrigger=(button:HTMLButtonElement)=>{
  if(button.matches('[data-testid="vnl-v049-launcher"]'))return false;
  const aria=(button.getAttribute('aria-label')||'').trim().toLowerCase();
  const title=(button.getAttribute('title')||'').trim().toLowerCase();
  const text=(button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  return aria==='vnl'||title==='vnl'||text==='vnl';
};

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('button') as HTMLButtonElement|null;
  if(!button||!isLegacyVnlTrigger(button))return;
  event.preventDefault();
  event.stopPropagation();
  window.dispatchEvent(new CustomEvent('astrastruct:vnl-open'));
},true);
