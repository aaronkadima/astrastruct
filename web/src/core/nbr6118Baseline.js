export const NBR6118_BASELINE_CONTRACT='nbr6118-launch-baseline/v1';
export const NBR6118_EDITION='ABNT NBR 6118:2023';

const TABLE={
  I:{minFckMpa:20,maxWaterCement:0.65,coverMm:{slab:20,beamColumn:25,soilContact:30}},
  II:{minFckMpa:25,maxWaterCement:0.60,coverMm:{slab:25,beamColumn:30,soilContact:30}},
  III:{minFckMpa:30,maxWaterCement:0.55,coverMm:{slab:35,beamColumn:40,soilContact:40}},
  IV:{minFckMpa:40,maxWaterCement:0.45,coverMm:{slab:45,beamColumn:50,soilContact:50}}
};

export function nbr6118Baseline(input={}){
  const exposure=TABLE[input.exposureClass]?input.exposureClass:'II',row=TABLE[exposure];
  return{
    contract:NBR6118_BASELINE_CONTRACT,
    code:NBR6118_EDITION,
    concreteType:'CA',
    exposureClass:exposure,
    minFckMpa:row.minFckMpa,
    maxWaterCement:row.maxWaterCement,
    nominalCoverMm:{...row.coverMm},
    slabMeshM:Number.isFinite(Number(input.slabMeshM))?Math.max(.10,Math.min(2,Number(input.slabMeshM))):.50,
    defaultAnalysis:'linear',
    requireFoundationVisible:true,
    requirePostAnalysisDetailing:true,
    requireDeformedShape:true,
    requireShellContours:true,
    provenance:{source:'ABNT NBR 6118:2023 Tables 7.1 and 7.2',executionToleranceMm:10,note:'Baseline de lançamento. Dimensionamento final continua dependente da tipologia, exposição, materiais, ações, combinações e verificações aplicáveis.'}
  };
}

export function withNBR6118Baseline(project={},input={}){
  const current=project?.settings?.normativeBaseline||{},baseline=nbr6118Baseline({...current,...input});
  return{
    ...project,
    settings:{...(project.settings||{}),normativeBaseline:baseline,grid:Number(project?.settings?.grid)||baseline.slabMeshM},
    meta:{...(project.meta||{}),normativeBaseline:{code:baseline.code,contract:baseline.contract,exposureClass:baseline.exposureClass}}
  };
}

export function validateNBR6118Baseline(project={}){
  const baseline=nbr6118Baseline(project?.settings?.normativeBaseline||{}),issues=[];
  const concretes=(project.materials||[]).filter(m=>String(m?.type||'').toLowerCase()==='concrete');
  for(const m of concretes){const fck=Number(m?.fck);if(Number.isFinite(fck)&&fck<baseline.minFckMpa)issues.push({kind:'material',id:String(m.id||''),field:'fck',value:fck,minimum:baseline.minFckMpa,message:`fck ${fck} MPa abaixo do baseline ${baseline.minFckMpa} MPa para CAA ${baseline.exposureClass}.`})}
  return{contract:'nbr6118-baseline-validation/v1',code:baseline.code,baseline,ok:issues.length===0,issues,governance:{launchGuardrailOnly:true,noAutomaticNormativeApproval:true,requiresEngineerReview:true}};
}
