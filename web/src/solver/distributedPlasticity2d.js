import { sectionFibersFromModel, sectionFiberFamily } from './fiberSection2d.js';
import { bilinearSteelFromModelMaterial, cyclicSteelFromModelMaterial } from './material1d.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const zeros=(r,c=r)=>Array.from({length:r},()=>Array(c).fill(0));
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Plasticidade distribuída: ${name} deve ser finito.`);return n};

/** Gauss–Lobatto rules mapped to xi in [0,1]. End points are retained so yielding at member ends is observable. */
export function lobattoRule(points=5){
  const n=Math.round(Number(points)||5);
  if(n===3)return[{xi:0,weight:1/6},{xi:.5,weight:4/6},{xi:1,weight:1/6}];
  if(n===5){const a=Math.sqrt(3/7);return[{xi:0,weight:1/20},{xi:(1-a)/2,weight:49/180},{xi:.5,weight:16/45},{xi:(1+a)/2,weight:49/180},{xi:1,weight:1/20}];}
  throw new Error('Plasticidade distribuída: integrationPoints deve ser 3 ou 5 nesta versão.');
}

export function normalizeDistributedPlasticityConfig(raw={}){
  const integrationPoints=[3,5].includes(Math.round(Number(raw.integrationPoints)))?Math.round(Number(raw.integrationPoints)):5;
  return{enabled:!!raw.enabled,integrationPoints,nFibers:clamp(Math.round(Number(raw.nFibers)||80),8,400),hardeningRatio:clamp(Math.abs(Number(raw.hardeningRatio)??.01)||.01,1e-6,.25),cyclic:!!raw.cyclic,kinematicFraction:clamp(Number.isFinite(Number(raw.kinematicFraction))?Number(raw.kinematicFraction):1,0,1)};
}

export function validateDistributedPlasticityModel({element,section,material,config}){
  if(!config?.enabled)return;
  if(element?.type!=='frame2d')throw new Error(`Plasticidade distribuída: ${element?.id||'elemento'} deve ser frame2d.`);
  const type=String(material?.type||'').toLowerCase();
  if(type!=='steel')throw new Error(`Plasticidade distribuída v0.21: ${element?.id||'elemento'} requer material steel.`);
  const family=sectionFiberFamily(section);
  if(!['rect','i','rhs'].includes(family))throw new Error(`Plasticidade distribuída v0.21: família de seção "${family}" não suportada; use rect, I/H ou RHS.`);
  const releases=element?.releases||{},springs=element?.rotationalSprings||{},hinges=element?.fiberHinges||{};
  if(releases.rz1||releases.rz2||springs.rz1!=null||springs.rz2!=null)throw new Error(`Plasticidade distribuída v0.21: ${element.id} requer extremidades rígidas; releases e molas semirrígidas ainda não são combinados com integração distribuída.`);
  if(hinges.rz1?.enabled||hinges.rz2?.enabled)throw new Error(`Plasticidade distribuída v0.21: ${element.id} não pode combinar rótula concentrada de fibras e plasticidade distribuída.`);
}

function sectionB(xi,L){return[[1/L,0,0],[0,(-4+6*xi)/L,(-2+6*xi)/L]];}
function addBtS(q,B,s,scale){for(let i=0;i<3;i++)q[i]+=scale*(B[0][i]*s[0]+B[1][i]*s[1]);}
function addBtDB(K,B,D,scale){for(let i=0;i<3;i++)for(let j=0;j<3;j++){let v=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)v+=B[a][i]*D[a][b]*B[b][j];K[i][j]+=scale*v;}}

function fiberSectionStateWithHistory({fibers,epsilon0,kappa,material,config,committedFibers=[]}){
  let N=0,M=0,k11=0,k12=0,k22=0,yieldedFibers=0,minStress=Infinity,maxStress=-Infinity,minStrain=Infinity,maxStrain=-Infinity,dissipatedEnergy=0,plasticIncrement=0;
  const rows=fibers.map((fiber,index)=>{
    const y=finite(`y da fibra ${index+1}`,fiber.y),area=finite(`área da fibra ${index+1}`,fiber.area),strain=epsilon0-kappa*y;
    const state=config.cyclic?cyclicSteelFromModelMaterial(material,strain,{hardeningRatio:config.hardeningRatio,kinematicFraction:config.kinematicFraction,committed:committedFibers[index]||null}):bilinearSteelFromModelMaterial(material,strain,{hardeningRatio:config.hardeningRatio});
    const stress=finite(`tensão da fibra ${index+1}`,state.stress),Et=finite(`tangente da fibra ${index+1}`,state.tangent);N+=stress*area;M-=stress*area*y;k11+=Et*area;k12-=Et*area*y;k22+=Et*area*y*y;if(state.yielded)yieldedFibers++;
    minStress=Math.min(minStress,stress);maxStress=Math.max(maxStress,stress);minStrain=Math.min(minStrain,strain);maxStrain=Math.max(maxStrain,strain);dissipatedEnergy+=Number(state.dissipationIncrement||0)*area;plasticIncrement+=Math.abs(Number(state.plasticMultiplier||0))*area;
    return{...fiber,strain,stress,tangent:Et,yielded:!!state.yielded,branch:state.branch||null,plasticStrain:Number(state.plasticStrain||0),backstress:Number(state.backstress||0),equivalentPlasticStrain:Number(state.equivalentPlasticStrain||0),dissipatedEnergyDensity:Number(state.dissipatedEnergyDensity||0),plasticMultiplier:Number(state.plasticMultiplier||0),history:state.history||null};
  });
  return{epsilon0,kappa,N,M,tangent:[[k11,k12],[k12,k22]],yieldedFibers,fiberCount:rows.length,minStress,maxStress,minStrain,maxStrain,fibers:rows,dissipatedEnergy,plasticIncrement};
}

/**
 * Displacement-based Euler–Bernoulli beam-column section integration.
 * v0.21 optionally evaluates each fiber with incremental cyclic return mapping.
 * committedHistory is read-only; historyTrial is committed only after the global
 * equilibrium step converges, providing rollback safety for Newton/line search.
 */
export function distributedSteelFiberBasicState({elasticBasic,L0,section,material,config={},committedHistory=null}){
  const L=finite('L0',L0);if(!(L>0))throw new Error('Plasticidade distribuída: L0 deve ser positivo.');
  const d=(elasticBasic||[]).map(Number);if(d.length!==3||d.some(v=>!Number.isFinite(v)))throw new Error('Plasticidade distribuída: vetor basic inválido.');
  const cfg=normalizeDistributedPlasticityConfig({...config,enabled:true}),rule=lobattoRule(cfg.integrationPoints),q=[0,0,0],K=zeros(3),sections=[],historySections=[],fibers=sectionFibersFromModel({section,nFibers:cfg.nFibers});
  let yieldedPointCount=0,yieldedFiberCount=0,totalFiberCount=0,plasticLengthEstimate=0,maxYieldFraction=0,dissipatedEnergyIncrement=0,plasticIncrement=0;
  const epsilon0=d[0]/L;
  for(let gpIndex=0;gpIndex<rule.length;gpIndex++){
    const gp=rule[gpIndex],B=sectionB(gp.xi,L),kappa=B[1][1]*d[1]+B[1][2]*d[2],committedFibers=committedHistory?.sections?.[gpIndex]?.fibers||[],state=fiberSectionStateWithHistory({fibers,epsilon0,kappa,material,config:cfg,committedFibers}),scale=L*gp.weight;
    addBtS(q,B,[state.N,state.M],scale);addBtDB(K,B,state.tangent,scale);
    const fraction=state.fiberCount?state.yieldedFibers/state.fiberCount:0;if(state.yieldedFibers>0){yieldedPointCount++;plasticLengthEstimate+=scale}yieldedFiberCount+=state.yieldedFibers;totalFiberCount+=state.fiberCount;maxYieldFraction=Math.max(maxYieldFraction,fraction);dissipatedEnergyIncrement+=state.dissipatedEnergy*scale;plasticIncrement+=state.plasticIncrement*scale;
    sections.push({xi:gp.xi,weight:gp.weight,x:gp.xi*L,epsilon0,kappa,N:state.N,M:state.M,tangent:state.tangent,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount,yieldFraction:fraction,minStress:state.minStress,maxStress:state.maxStress,minStrain:state.minStrain,maxStrain:state.maxStrain,sectionFamily:sectionFiberFamily(section),dissipatedEnergyIncrement:state.dissipatedEnergy*scale,plasticIncrement:state.plasticIncrement*scale,maxEquivalentPlasticStrain:Math.max(0,...state.fibers.map(f=>Math.abs(f.equivalentPlasticStrain||0))),maxBackstress:Math.max(0,...state.fibers.map(f=>Math.abs(f.backstress||0)))});
    historySections.push({xi:gp.xi,fibers:state.fibers.map(f=>f.history||{plasticStrain:0,backstress:0,equivalentPlasticStrain:0,dissipatedEnergyDensity:0,stress:f.stress,strain:f.strain,loadingDirection:0,yielded:f.yielded})});
  }
  const previousDissipation=Number(committedHistory?.cumulativeDissipatedEnergy||0),historyTrial={version:'0.21.0-exp',cyclic:cfg.cyclic,sections:historySections,cumulativeDissipatedEnergy:previousDissipation+dissipatedEnergyIncrement};
  return{type:'distributed-steel-fiber-basic',basicDeformation:[...d],basicForces:q,basicTangent:K,sectionFamily:sectionFiberFamily(section),integrationPoints:cfg.integrationPoints,nFibers:cfg.nFibers,hardeningRatio:cfg.hardeningRatio,cyclic:cfg.cyclic,kinematicFraction:cfg.kinematicFraction,sections,yieldedPointCount,yieldedFiberCount,totalFiberCount,maxYieldFraction,plasticLengthEstimate,dissipatedEnergyIncrement,cumulativeDissipatedEnergy:historyTrial.cumulativeDissipatedEnergy,plasticIncrement,historyTrial};
}

export const DISTRIBUTED_PLASTICITY_VERSION='0.21.0-exp';
