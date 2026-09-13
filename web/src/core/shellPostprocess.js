const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export const SHELL_RESULT_FIELDS={
  Nx:['membraneResultants','Nx'],Ny:['membraneResultants','Ny'],Nxy:['membraneResultants','Nxy'],
  Mx:['bendingMoments','Mx'],My:['bendingMoments','My'],Mxy:['bendingMoments','Mxy'],
  Qx:['transverseShear','Qx'],Qy:['transverseShear','Qy'],
  sx:['membraneStress','sx'],sy:['membraneStress','sy'],txy:['membraneStress','txy']
};
const readPath=(obj,path)=>path.reduce((v,k)=>v?.[k],obj);
const samplesOf=response=>Array.isArray(response?.gaussPoints)&&response.gaussPoints.length?response.gaussPoints:[{index:0,naturalCoordinates:{xi:0,eta:0},...response}];

export function shellFieldSamples(response,field){
  const path=SHELL_RESULT_FIELDS[field];if(!path)throw new Error(`Pós-processamento shell4: campo '${field}' desconhecido.`);return samplesOf(response).map((p,i)=>({elementId:response.elementId,pointIndex:Number(p.index??i+1),naturalCoordinates:p.naturalCoordinates||{xi:0,eta:0},value:finite(readPath(p,path))}));
}

export function shellFieldEnvelope(response,field){
  const samples=shellFieldSamples(response,field);if(!samples.length)return null;let min=samples[0],max=samples[0],maxAbs=samples[0];for(const p of samples.slice(1)){if(p.value<min.value)min=p;if(p.value>max.value)max=p;if(Math.abs(p.value)>Math.abs(maxAbs.value))maxAbs=p}return{field,min,max,maxAbs,samples};
}

export function buildShellGaussEnvelopes(result,{fields=Object.keys(SHELL_RESULT_FIELDS)}={}){
  const shellResponses=(result?.elementForces||[]).filter(x=>x?.type==='shell4'),items=shellResponses.map(response=>({elementId:response.elementId,fields:Object.fromEntries(fields.map(field=>[field,shellFieldEnvelope(response,field)]))})),global={};
  for(const field of fields){const envs=items.map(x=>({elementId:x.elementId,envelope:x.fields[field]})).filter(x=>x.envelope);if(!envs.length){global[field]=null;continue}let min={elementId:envs[0].elementId,...envs[0].envelope.min},max={elementId:envs[0].elementId,...envs[0].envelope.max},maxAbs={elementId:envs[0].elementId,...envs[0].envelope.maxAbs};for(const x of envs.slice(1)){const a={elementId:x.elementId,...x.envelope.min},b={elementId:x.elementId,...x.envelope.max},c={elementId:x.elementId,...x.envelope.maxAbs};if(a.value<min.value)min=a;if(b.value>max.value)max=b;if(Math.abs(c.value)>Math.abs(maxAbs.value))maxAbs=c}global[field]={min,max,maxAbs}}
  return{source:shellResponses.some(x=>Array.isArray(x.gaussPoints)&&x.gaussPoints.length)?'gauss':'center-fallback',fields:[...fields],items,global,shellCount:shellResponses.length};
}

export function shellMaxAbsValue(response,field){return Math.abs(shellFieldEnvelope(response,field)?.maxAbs?.value||0)}
