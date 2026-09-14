type Listener=(result:any)=>void;
let latestResult:any=null;
const listeners=new Set<Listener>();

export function publishAnalysisResult(result:any){
  latestResult=result||null;
  for(const listener of listeners)listener(latestResult);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('astrastruct:analysis-result',{detail:{result:latestResult}}));
}

export function currentAnalysisResult(){return latestResult;}

export function subscribeAnalysisResult(listener:Listener){
  listeners.add(listener);
  listener(latestResult);
  return()=>{listeners.delete(listener);};
}
