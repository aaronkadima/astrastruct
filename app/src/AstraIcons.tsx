import React from 'react';

const ICONS:Record<string,React.ReactNode>={
  new:<><path d="M7 3.5h8l4 4V20.5H7z"/><path d="M15 3.5v4h4M13 11v6M10 14h6"/></>,
  undo:<><path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h8a5 5 0 0 1 5 5v1"/></>,
  redo:<><path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5h-8a5 5 0 0 0-5 5v1"/></>,
  select:<><path d="m5 3 12 9-6 1.5L8.5 19z"/><path d="m11 13.5 4 6"/></>,
  node:<><circle cx="12" cy="12" r="4"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></>,
  frame:<><path d="M5 20V6h14v14M5 9h14"/><circle cx="5" cy="20" r="1.5"/><circle cx="19" cy="20" r="1.5"/></>,
  beam:<><path d="M4 16h16M6 19l-2 2M18 19l2 2"/><path d="M8 4v7m0 0-2-3m2 3 2-3M12 4v7m0 0-2-3m2 3 2-3M16 4v7m0 0-2-3m2 3 2-3"/></>,
  truss:<><path d="M4 19 12 5l8 14H4Z M4 19l8-6 8 6M12 5v8"/><circle cx="4" cy="19" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="20" cy="19" r="1.2"/></>,
  mixed:<><path d="M5 20V5h14v15M5 9h14M5 20 19 9"/><circle cx="5" cy="20" r="1.3"/><circle cx="19" cy="20" r="1.3"/></>,
  cases:<><path d="M5 6h10l4 4v8H5z"/><path d="M8 3h8l4 4v8M8 10h7M8 14h7"/></>,
  play:<><path d="M8 5.5 18 12 8 18.5Z"/><path d="M4 4v16"/></>,
  import:<><path d="M5 4h9l4 4v12H5zM14 4v4h4"/><path d="M12 10v7m0-7-3 3m3-3 3 3"/></>,
  export:<><path d="M5 4h9l4 4v12H5zM14 4v4h4"/><path d="M12 17v-7m0 7-3-3m3 3 3-3"/></>,
  library:<path d="M4 5.5h5v13H4zM10 5.5h5v13h-5zM16 5.5h4v13h-4z"/>,
  inspector:<><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h7"/></>,
  results:<><path d="M4 19V9M9 19V5M14 19v-7M19 19V3"/><path d="M3 19h18"/></>,
  model:<><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><circle cx="16.5" cy="15.5" r="1.5"/></>,
  more:<><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  close:<path d="M6 6l12 12M18 6 6 18"/>,
  chart:<><path d="M4 19h16M5 16c3-1 4-8 7-7s3 6 7 2"/><circle cx="12" cy="9" r="1.2"/></>,
  advanced:<><path d="M4 18h16M12 4v9m0 0-3-3m3 3 3-3"/><circle cx="12" cy="18" r="1.4"/></>,
  properties:<><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></>,
  mechanics:<><path d="M4 12h3l1.5-4 3 8 3-8 1.5 4h4"/><path d="M18 4v5M18 15v5"/></>,
  connection:<><path d="M3 12h6M15 12h6"/><circle cx="11" cy="12" r="2"/><circle cx="13" cy="12" r="2"/></>,
  stress:<><path d="M5 7h14M5 17h14"/><path d="M8 3v7m0 0-2-3m2 3 2-3M16 21v-7m0 0-2 3m2-3 2 3"/></>,
  analysis:<><path d="M4 18h16M6 16V8M10 16v-5M14 16V5M18 16v-8"/><path d="M5 6c4 1 6-3 9-2s3 4 5 3"/></>,
  report:<><path d="M6 3.5h9l4 4V21H6zM15 3.5v4h4"/><path d="M9 17v-4m3 4V9m3 8v-6"/></>,
  vnl:<><rect x="3.5" y="5" width="6" height="5" rx="1"/><rect x="14.5" y="14" width="6" height="5" rx="1"/><path d="M9.5 7.5h4a4 4 0 0 1 4 4V14"/></>,
  support:<><path d="M12 5 5 16h14zM4 20h16"/><circle cx="12" cy="5" r="1.5"/></>,
  delete:<><path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14"/></>,
  zoomIn:<><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M7.5 10.5h6M10.5 7.5v6"/></>,
  zoomOut:<><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M7.5 10.5h6"/></>,
  fit:<><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M8 12h8"/></>,
  loads:<><path d="M5 5v10m0 0-3-4m3 4 3-4M12 4v13m0 0-3-4m3 4 3-4M19 7v8m0 0-3-4m3 4 3-4"/><path d="M3 20h18"/></>,
  reactions:<><path d="M5 19V9m0 0-3 4m3-4 3 4M12 20V7m0 0-3 4m3-4 3 4M19 17V9m0 0-3 4m3-4 3 4"/><path d="M3 4h18"/></>,
  deformed:<><path d="M4 17h16"/><path d="M4 17c4 0 4-8 8-8s4 8 8 8"/><circle cx="4" cy="17" r="1.2"/><circle cx="20" cy="17" r="1.2"/></>,
  axial:<><path d="M4 12h16M4 12l4-3m-4 3 4 3M20 12l-4-3m4 3-4 3"/><path d="M12 5v14"/></>,
  shear:<><path d="M5 5v14M19 5v14"/><path d="M5 8h14M5 16h14M9 5 5 8l4 3M15 13l4 3-4 3"/></>,
  moment:<><path d="M6 16a7 7 0 1 1 12-5"/><path d="m18 7 .5 4-4-.5"/><path d="M12 6v12"/></>,
  probe:<><circle cx="10" cy="10" r="5"/><path d="M13.5 13.5 20 20M10 6v8M6 10h8"/></>,
  envelope:<><path d="M4 17c3-6 5-8 8-5s4 7 8 2"/><path d="M4 9c3 2 5 1 8-2s4 0 8-2"/><path d="M4 9v8M20 5v9"/></>
};

export function Glyph({name}:{name:string}){return <svg className="glyph" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]||ICONS.more}</svg>}

export function IconButton({icon,label,onClick,active=false,disabled=false,testId,className=''}:{icon:string;label:string;onClick?:()=>void;active?:boolean;disabled?:boolean;testId?:string;className?:string}){
  return <button data-testid={testId} className={`icon-btn ${active?'active':''} ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Glyph name={icon}/></button>
}
