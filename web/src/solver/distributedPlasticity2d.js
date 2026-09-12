import { steelFiberSectionFromModel, sectionFiberFamily } from './fiberSection2d.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const zeros=(r,c=r)=>Array.from({length:r},()=>Array(c).fill(0));
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`Plasticidade distribuída: ${name} deve ser finito.`);return n};

/** Gauss–Lobatto rules mapped to xi in [0,1]. End points are retained so yielding at member ends is observable. */
export function lobattoRule(points=5){
  const n=Math.round(Number(points)||5);
  if(n===3)return[
    {xi:0,weight:1/6},{xi:.5,weight:4/6},{xi:1,weight:1/6}
  ];
  if(n===5){
    const a=Math.sqrt(3/7);
    return[
      {xi:0,weight:1/20},
      {xi:(1-a)/2,weight:49/180},
      {xi:.5,weight:16/45},
      {xi:(1+a)/2,weight:49/180},
      {xi:1,weight:1/20}
    ];
  }
  throw new Error('Plasticidade distribuída: integrationPoints deve ser 3 ou 5 nesta versão.');
}

export function normalizeDistributedPlasticityConfig(raw={}){
  const integrationPoints=[3,5].includes(Math.round(Number(raw.integrationPoints)))?Math.round(Number(raw.integrationPoints)):5;
  return{
    enabled:!!raw.enabled,
    integrationPoints,
    nFibers:clamp(Math.round(Number(raw.nFibers)||80),8,400),
    hardeningRatio:clamp(Math.abs(Number(raw.hardeningRatio)??.01)||.01,1e-6,.25)
  };
}

export function validateDistributedPlasticityModel({element,section,material,config}){
  if(!config?.enabled)return;
  if(element?.type!=='frame2d')throw new Error(`Plasticidade distribuída: ${element?.id||'elemento'} deve ser frame2d.`);
  const type=String(material?.type||'').toLowerCase();
  if(type!=='steel')throw new Error(`Plasticidade distribuída v0.20: ${element?.id||'elemento'} requer material steel.`);
  const family=sectionFiberFamily(section);
  if(!['rect','i','rhs'].includes(family))throw new Error(`Plasticidade distribuída v0.20: família de seção "${family}" não suportada; use rect, I/H ou RHS.`);
  const releases=element?.releases||{},springs=element?.rotationalSprings||{},hinges=element?.fiberHinges||{};
  if(releases.rz1||releases.rz2||springs.rz1!=null||springs.rz2!=null)throw new Error(`Plasticidade distribuída v0.20: ${element.id} requer extremidades rígidas; releases e molas semirrígidas ainda não são combinados com integração distribuída.`);
  if(hinges.rz1?.enabled||hinges.rz2?.enabled)throw new Error(`Plasticidade distribuída v0.20: ${element.id} não pode combinar rótula concentrada de fibras e plasticidade distribuída.`);
}

function sectionB(xi,L){
  return[[1/L,0,0],[0,(-4+6*xi)/L,(-2+6*xi)/L]];
}

function addBtS(q,B,s,scale){
  for(let i=0;i<3;i++)q[i]+=scale*(B[0][i]*s[0]+B[1][i]*s[1]);
}

function addBtDB(K,B,D,scale){
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    let v=0;
    for(let a=0;a<2;a++)for(let b=0;b<2;b++)v+=B[a][i]*D[a][b]*B[b][j];
    K[i][j]+=scale*v;
  }
}

/**
 * Displacement-based Euler–Bernoulli beam-column section integration.
 * elasticBasic=[deltaL,phi1,phi2] is the co-rotational basic deformation after
 * subtraction of thermal initial deformation. Axial strain is constant and
 * curvature is linear along the member, exactly reproducing the elastic
 * 2-node Euler–Bernoulli basic stiffness when every fiber remains elastic.
 */
export function distributedSteelFiberBasicState({elasticBasic,L0,section,material,config={}}){
  const L=finite('L0',L0);if(!(L>0))throw new Error('Plasticidade distribuída: L0 deve ser positivo.');
  const d=(elasticBasic||[]).map(Number);if(d.length!==3||d.some(v=>!Number.isFinite(v)))throw new Error('Plasticidade distribuída: vetor basic inválido.');
  const cfg=normalizeDistributedPlasticityConfig({...config,enabled:true}),rule=lobattoRule(cfg.integrationPoints),q=[0,0,0],K=zeros(3),sections=[];
  let yieldedPointCount=0,yieldedFiberCount=0,totalFiberCount=0,plasticLengthEstimate=0,maxYieldFraction=0;
  const epsilon0=d[0]/L;
  for(const gp of rule){
    const B=sectionB(gp.xi,L),kappa=B[1][1]*d[1]+B[1][2]*d[2],state=steelFiberSectionFromModel({section,material,nFibers:cfg.nFibers,epsilon0,kappa,hardeningRatio:cfg.hardeningRatio}),scale=L*gp.weight;
    addBtS(q,B,[state.N,state.M],scale);addBtDB(K,B,state.tangent,scale);
    const fraction=state.fiberCount?state.yieldedFibers/state.fiberCount:0;if(state.yieldedFibers>0){yieldedPointCount++;plasticLengthEstimate+=scale}yieldedFiberCount+=state.yieldedFibers;totalFiberCount+=state.fiberCount;maxYieldFraction=Math.max(maxYieldFraction,fraction);
    sections.push({xi:gp.xi,weight:gp.weight,x:gp.xi*L,epsilon0,kappa,N:state.N,M:state.M,tangent:state.tangent,yieldedFibers:state.yieldedFibers,fiberCount:state.fiberCount,yieldFraction:fraction,minStress:state.minStress,maxStress:state.maxStress,minStrain:state.minStrain,maxStrain:state.maxStrain,sectionFamily:state.sectionFamily});
  }
  return{type:'distributed-steel-fiber-basic',basicDeformation:[...d],basicForces:q,basicTangent:K,sectionFamily:sectionFiberFamily(section),integrationPoints:cfg.integrationPoints,nFibers:cfg.nFibers,hardeningRatio:cfg.hardeningRatio,sections,yieldedPointCount,yieldedFiberCount,totalFiberCount,maxYieldFraction,plasticLengthEstimate};
}

export const DISTRIBUTED_PLASTICITY_VERSION='0.20.0-exp';
