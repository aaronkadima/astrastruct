import { shellFieldSamples } from './shellPostprocess.js';

const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const shellIds=e=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);

/** Extrapolate the 2x2 Gauss field to the four natural Q4 corners. */
export function extrapolateShellGaussToNodes(response,field){
  const samples=shellFieldSamples(response,field);if(samples.length!==4)return Array(4).fill(finite(samples[0]?.value));
  const ordered=[...samples].sort((a,b)=>Number(a.pointIndex)-Number(b.pointIndex)),q=ordered.map(x=>finite(x.value)),g=1/Math.sqrt(3);
  const a=(q[0]+q[1]+q[2]+q[3])/4,b=(-q[0]+q[1]+q[2]-q[3])/(4*g),c=(-q[0]-q[1]+q[2]+q[3])/(4*g),d=(q[0]-q[1]+q[2]-q[3])/(4*g*g),corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  return corners.map(([xi,eta])=>a+b*xi+c*eta+d*xi*eta);
}

/**
 * Build a display contour field. Each element first extrapolates its Gauss
 * response to its Q4 nodes; shared-node values are then area-weighted. This is
 * visualization smoothing only: element recovery remains unchanged.
 */
export function buildShellNodalContour(project,result,field,{weighting='area'}={}){
  const elements=new Map((project?.elements||[]).filter(e=>e.type==='shell4').map(e=>[String(e.id),e])),responses=(result?.elementForces||[]).filter(r=>r.type==='shell4'&&elements.has(String(r.elementId))),acc=new Map(),elementValues=[];
  for(const response of responses){const e=elements.get(String(response.elementId)),ids=shellIds(e);if(ids.length!==4)continue;const values=extrapolateShellGaussToNodes(response,field),weight=weighting==='equal'?1:Math.max(EPS,finite(response.area,1));elementValues.push({elementId:response.elementId,nodeIds:[...ids],values:[...values],weight});for(let i=0;i<4;i++){const id=String(ids[i]),prev=acc.get(id)||{sum:0,weight:0,contributors:0};prev.sum+=values[i]*weight;prev.weight+=weight;prev.contributors++;acc.set(id,prev)}}
  const nodes=[...acc.entries()].map(([nodeId,x])=>({nodeId,value:x.weight>EPS?x.sum/x.weight:0,contributors:x.contributors})),values=nodes.map(x=>x.value),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0,maxAbs=values.length?Math.max(...values.map(Math.abs)):0;
  return{field,weighting,source:'gauss-2x2-extrapolated',nodes,byNode:Object.fromEntries(nodes.map(x=>[x.nodeId,x.value])),elements:elementValues,range:{min,max,maxAbs},shellCount:responses.length};
}
