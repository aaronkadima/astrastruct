from pathlib import Path
import re

def replace_once(t,old,new,label):
    if old in t:return t.replace(old,new,1)
    if new in t:return t
    raise SystemExit(f'{label} anchor missing')

# co-rotational kernel integration
p=Path('web/src/solver/corotational2d.js'); t=p.read_text()
anchor="import { analyzeTangentSpectrum, detectMultimodeTransitions, applyReferenceEigenvalueRatios } from './stabilityMultimode2d.js';\n"
ins="import { distributedSteelFiberBasicState, normalizeDistributedPlasticityConfig, validateDistributedPlasticityModel } from './distributedPlasticity2d.js';\n"
if ins not in t:
    if anchor not in t:raise SystemExit('distributed import anchor missing')
    t=t.replace(anchor,anchor+ins,1)

if 'export function corotationalDistributedPlasticityElementState' not in t:
    marker='function connectionStiffnesses(releases={},rotationalSprings={}){'
    if marker not in t:raise SystemExit('distributed element insertion anchor missing')
    fn=r'''/** v0.20 displacement-based distributed steel fiber element. */
export function corotationalDistributedPlasticityElementState({X1,Y1,X2,Y2,qGlobal,E,A,I,initialBasic=[0,0,0],section,material,distributedPlasticity={}}){
  const q=qGlobal.map(Number),dx0=X2-X1,dy0=Y2-Y1,L0=Math.hypot(dx0,dy0);
  if(!(L0>EPS))throw new Error('Plasticidade distribuída: elemento com comprimento inicial nulo.');
  if(!(E>0&&A>0&&I>0))throw new Error('Plasticidade distribuída: E, A e I devem ser positivos.');
  const alpha0=Math.atan2(dy0,dx0),x1=X1+q[0],y1=Y1+q[1],x2=X2+q[3],y2=Y2+q[4],dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);
  if(!(l>EPS))throw new Error('Plasticidade distribuída: comprimento corrente degenerado.');
  const c=dx/l,s=dy/l,alpha=Math.atan2(dy,dx),dAlpha=wrapAngle(alpha-alpha0),basic=[l-L0,q[2]-dAlpha,q[5]-dAlpha],initial=initialBasic.map(Number),elasticBasic=subVector(basic,initial);
  const distributed=distributedSteelFiberBasicState({elasticBasic,L0,section,material,config:distributedPlasticity}),basicForces=distributed.basicForces,kb=distributed.basicTangent,[N,M1,M2]=basicForces;
  const r=[-c,-s,0,c,s,0],z=[s,-c,0,-s,c,0],e1=[0,0,1,0,0,0],e2=[0,0,0,0,0,1],B=[r,z.map((v,i)=>-v/l+e1[i]),z.map((v,i)=>-v/l+e2[i])],internal=mv(transpose(B),basicForces);
  let tangent=mm(transpose(B),mm(kb,B));tangent=addMatrix(tangent,outer(z,z),N/l);tangent=addMatrix(tangent,addMatrix(outer(r,z),outer(z,r)),(M1+M2)/(l*l));
  const V=(M1+M2)/l;
  return{L0,l,alpha0,alpha,dAlpha,c,s,basic,initialBasic:initial,elasticBasic,basicForces,basicTangent:kb,internal,tangent,endForces:{N1:-N,V1:V,M1,N2:N,V2:-V,M2},distributedPlasticity:distributed};
}

'''
    t=t.replace(marker,fn+marker,1)

old="    const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2],c0=dx0/L0,s0=dy0/L0,referenceLoads=prepareReferenceElementLoads(project,e,mat,L0,c0,s0),thermal=prepareThermalInitialState(project,e,mat,section,L0),followers=prepareFollowerElementLoads(project,e);\n    elements.push({e,i,j,a,b,aNominal,bNominal,E,A,I,idx,c0,s0,thermal,followers,...referenceLoads});"
new="    const idx=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2],c0=dx0/L0,s0=dy0/L0,referenceLoads=prepareReferenceElementLoads(project,e,mat,L0,c0,s0),thermal=prepareThermalInitialState(project,e,mat,section,L0),followers=prepareFollowerElementLoads(project,e),distributedPlasticity=normalizeDistributedPlasticityConfig(e.distributedPlasticity||{});\n    validateDistributedPlasticityModel({element:e,section,material:mat,config:distributedPlasticity});\n    elements.push({e,i,j,a,b,aNominal,bNominal,E,A,I,material:mat,section,distributedPlasticity,idx,c0,s0,thermal,followers,...referenceLoads});"
t=replace_once(t,old,new,'prepare distributed')

old="    const connected=typeof options.connectionResolver==='function'?options.connectionResolver({item,qNode,initialBasic,loadFactor,connectionArgs,solveConnected:(overrides={})=>corotationalConnectedElementState({...connectionArgs,...overrides})}):corotationalConnectedElementState(connectionArgs),state=connected?.state;"
new="    const connected=item.distributedPlasticity?.enabled?(()=>{const state=corotationalDistributedPlasticityElementState({X1:Number(item.a.x),Y1:Number(item.a.y),X2:Number(item.b.x),Y2:Number(item.b.y),qGlobal:qNode,E:item.E,A:item.A,I:item.I,initialBasic,section:item.section,material:item.material,distributedPlasticity:item.distributedPlasticity});return{state,qElement:qNode,gradient:state.internal.map((v,i)=>v-loadFactor*item.pGlobal[i]),tangent:state.tangent,connectionRotations:[],internalConnectionResidual:0,stiffnesses:[Infinity,Infinity],distributedPlasticity:state.distributedPlasticity}})():(typeof options.connectionResolver==='function'?options.connectionResolver({item,qNode,initialBasic,loadFactor,connectionArgs,solveConnected:(overrides={})=>corotationalConnectedElementState({...connectionArgs,...overrides})}):corotationalConnectedElementState(connectionArgs)),state=connected?.state;"
t=replace_once(t,old,new,'assemble distributed')

if 'function distributedPlasticityResult(states=[]){' not in t:
    marker='function baseReactionAt(prepared,current,dof){'
    if marker not in t:raise SystemExit('distributed result helper anchor missing')
    helper=r'''function distributedPlasticityResult(states=[]){
  const records=[];
  for(const entry of states||[]){const d=entry.state?.distributedPlasticity||entry.connected?.distributedPlasticity;if(!d)continue;records.push({elementId:entry.item.e.id,sectionFamily:d.sectionFamily,integrationPoints:d.integrationPoints,nFibers:d.nFibers,hardeningRatio:d.hardeningRatio,yieldedPointCount:d.yieldedPointCount,yieldedFiberCount:d.yieldedFiberCount,totalFiberCount:d.totalFiberCount,maxYieldFraction:d.maxYieldFraction,plasticLengthEstimate:d.plasticLengthEstimate,sections:(d.sections||[]).map(s=>({xi:s.xi,x:s.x,epsilon0:s.epsilon0,kappa:s.kappa,N:s.N,M:s.M,yieldedFibers:s.yieldedFibers,fiberCount:s.fiberCount,yieldFraction:s.yieldFraction,minStress:s.minStress,maxStress:s.maxStress,minStrain:s.minStrain,maxStrain:s.maxStrain}))})}
  return{enabled:records.length>0,version:'0.20.0-exp',model:'displacement-based Euler-Bernoulli with Gauss-Lobatto steel fiber sections',integration:'Gauss-Lobatto including member ends',monotonic:true,cyclicHistory:false,records,yieldedPointCount:records.reduce((s,r)=>s+r.yieldedPointCount,0),yieldedFiberCount:records.reduce((s,r)=>s+r.yieldedFiberCount,0),plasticLengthEstimate:records.reduce((s,r)=>s+r.plasticLengthEstimate,0)};
}
function hasDistributedPlasticity(prepared){return(prepared?.elements||[]).some(x=>x.distributedPlasticity?.enabled)}

'''
    t=t.replace(marker,helper+marker,1)

# Add distributed metadata to all three base result families.
t=t.replace("elementForces,imperfection:imperfectionMeta,nonlinear:","elementForces,imperfection:imperfectionMeta,distributedPlasticity:distributedPlasticityResult(last.states),nonlinear:")
t=t.replace("elementForces,imperfection:imperfectionMeta,pushover,nonlinear:","elementForces,imperfection:imperfectionMeta,distributedPlasticity:distributedPlasticityResult(last.states),pushover,nonlinear:")
t=t.replace("elementForces,imperfection:imperfectionMeta,arcLength,nonlinear:","elementForces,imperfection:imperfectionMeta,distributedPlasticity:distributedPlasticityResult(last.states),arcLength,nonlinear:")
# Select v0.20 only when at least one distributed element participates.
t=t.replace("solverVersion:'0.13.6-exp'","solverVersion:hasDistributedPlasticity(prepared)?'0.20.0-exp':'0.13.6-exp'",1)
t=t.replace("solverVersion:'0.16.0-exp'","solverVersion:hasDistributedPlasticity(prepared)?'0.20.0-exp':'0.16.0-exp'",1)
t=t.replace("solverVersion:'0.19.0-exp'","solverVersion:hasDistributedPlasticity(prepared)?'0.20.0-exp':'0.19.0-exp'",1)
p.write_text(t)

# Model normalization for element-level distributed-plasticity config.
p=Path('web/src/core/model.js'); t=p.read_text()
old="    if (releases.rz1) rotationalSprings.rz1 = 0;\n    if (releases.rz2) rotationalSprings.rz2 = 0;\n    return { ...e, releases, rotationalSprings };"
new="    if (releases.rz1) rotationalSprings.rz1 = 0;\n    if (releases.rz2) rotationalSprings.rz2 = 0;\n    const rawDp=e.distributedPlasticity||{},integrationPoints=[3,5].includes(Math.round(Number(rawDp.integrationPoints)))?Math.round(Number(rawDp.integrationPoints)):5,distributedPlasticity={enabled:!!rawDp.enabled,integrationPoints,nFibers:Math.max(8,Math.min(400,Math.round(Number(rawDp.nFibers)||80))),hardeningRatio:Math.max(1e-6,Math.min(.25,Math.abs(Number(rawDp.hardeningRatio)||.01)))};\n    return { ...e, releases, rotationalSprings, distributedPlasticity };"
t=replace_once(t,old,new,'model distributed normalization');p.write_text(t)

# Material wrapper must not downgrade a mixed distributed+concentrated result version.
p=Path('web/src/solver/materialNonlinear2d.js'); t=p.read_text()
old="solverVersion: options.controlMode === 'arc-length' ? '0.19.0-exp' : '0.16.0-exp'"
new="solverVersion: result?.distributedPlasticity?.enabled ? '0.20.0-exp' : (options.controlMode === 'arc-length' ? '0.19.0-exp' : '0.16.0-exp')"
if old in t:t=t.replace(old,new,1)
elif new not in t:raise SystemExit('material wrapper version anchor missing')
p.write_text(t)

# Package checks/tests.
p=Path('package.json'); t=p.read_text()
old="node --check web/src/solver/fiberSection2d.js && node --check web/src/solver/materialNonlinear2d.js"
new="node --check web/src/solver/fiberSection2d.js && node --check web/src/solver/distributedPlasticity2d.js && node --check web/src/solver/materialNonlinear2d.js"
t=replace_once(t,old,new,'package check distributed')
old="node tests/multimode-stability-smoke.mjs\""
new="node tests/multimode-stability-smoke.mjs && node tests/distributed-plasticity-smoke.mjs\""
t=replace_once(t,old,new,'package test distributed')
p.write_text(t)
