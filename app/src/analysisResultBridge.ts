// @ts-ignore
import{buildEngineeringVisualization3D}from'../../web/src/solver/engineeringVisualization3d.js';

type Listener=(result:any)=>void;
let latestResult:any=null;
const listeners=new Set<Listener>();

function currentProject(){try{return JSON.parse(localStorage.getItem('astrastruct.project')||'{}')}catch{return{}}}
function enrich(result:any){if(!result||result.dimension!=='3d'||result.engineeringVisualization)return result;try{return{...result,engineeringVisualization:buildEngineeringVisualization3D(currentProject(),result),engineeringSolverFacade:'0.54.0-exp'}}catch{return result}}

export function publishAnalysisResult(result:any){
  latestResult=enrich(result||null);
  for(const listener of listeners)listener(latestResult);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('astrastruct:analysis-result',{detail:{result:latestResult}}));
}

export function currentAnalysisResult(){return latestResult;}

export function subscribeAnalysisResult(listener:Listener){
  listeners.add(listener);
  listener(latestResult);
  return()=>{listeners.delete(listener);};
}
