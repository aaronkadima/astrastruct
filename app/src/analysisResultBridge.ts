// @ts-ignore
import{buildEngineeringVisualization3D}from'../../web/src/solver/engineeringVisualization3d.js';

type Listener=(result:any)=>void;
let latestResult:any=null;
const listeners=new Set<Listener>();

function currentProject(){try{return JSON.parse(localStorage.getItem('astrastruct.project')||'{}')}catch{return{}}}
function enrich(result:any,project?:any){if(!result||result.dimension!=='3d'||result.engineeringVisualization)return result;try{return{...result,engineeringVisualization:buildEngineeringVisualization3D(project||currentProject(),result),engineeringSolverFacade:'0.54.0-exp'}}catch{return result}}

export function publishAnalysisResult(result:any,project?:any){
  latestResult=enrich(result||null,project);
  for(const listener of listeners)listener(latestResult);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('astrastruct:analysis-result',{detail:{result:latestResult}}));
}

export function currentAnalysisResult(){return latestResult;}

export function subscribeAnalysisResult(listener:Listener){
  listeners.add(listener);
  listener(latestResult);
  return()=>{listeners.delete(listener);};
}

if(typeof window!=='undefined')window.addEventListener('astrastruct:solver-result',((event:CustomEvent)=>{
  publishAnalysisResult(event.detail?.result||null,event.detail?.project||undefined);
}) as EventListener);
