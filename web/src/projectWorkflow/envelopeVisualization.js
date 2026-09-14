export const ENVELOPE_VISUALIZATION_CONTRACT='combination-envelope-visualization/v1';
export const ENVELOPE_VISUALIZATION_VERSION='0.53.10-exp';

const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const FIELD_META={
  N:{label:'N',barUnit:'kN',shellUnit:'kN/m'},
  V:{label:'V',barUnit:'kN',shellUnit:'kN/m'},
  M:{label:'M',barUnit:'kN·m',shellUnit:'kN·m/m'},
  T:{label:'T',barUnit:'kN·m',shellUnit:null}
};

export function envelopeFieldMeta(field='M'){return FIELD_META[field]||FIELD_META.M}

export function buildEnvelopeVisualization(explorer={},field='M'){
  const selected=FIELD_META[field]?field:'M',meta=envelopeFieldMeta(selected),raw=[];
  for(const e of explorer.elementEnvelopes||[]){
    const env=e?.[selected],value=finite(env?.absMax);if(value==null)continue;
    const kind=e.kind==='shell'?'shell':'bar',unit=kind==='shell'?meta.shellUnit:meta.barUnit;if(!unit)continue;
    raw.push({elementId:String(e.elementId),label:String(e.label||e.elementId),kind,field:selected,value,magnitude:Math.abs(value),sign:value===0?0:value>0?1:-1,unit,governingCombinationId:env.governingCombinationId||null,governingComponent:env.governingComponent||null});
  }
  const scales={bar:{maxAbs:0,unit:meta.barUnit,count:0},shell:{maxAbs:0,unit:meta.shellUnit,count:0}};
  for(const item of raw){const s=scales[item.kind];s.maxAbs=Math.max(s.maxAbs,item.magnitude);s.count++}
  const items=raw.map(item=>({...item,ratio:scales[item.kind].maxAbs>1e-15?item.magnitude/scales[item.kind].maxAbs:0})),criticalByKind={};
  for(const kind of ['bar','shell']){const list=items.filter(i=>i.kind===kind);criticalByKind[kind]=list.sort((a,b)=>b.magnitude-a.magnitude)[0]||null}
  return{contract:ENVELOPE_VISUALIZATION_CONTRACT,version:ENVELOPE_VISUALIZATION_VERSION,domain:'force',field:selected,label:meta.label,items,scales,criticalByKind,summary:{items:items.length,bars:scales.bar.count,shells:scales.shell.count},governance:{separateBarShellScales:true,noUnitMixing:true,noSyntheticValues:true,sourceContract:explorer.contract||null}};
}

export function buildDisplacementVisualization(explorer={}){
  const raw=(explorer.nodeDisplacementEnvelopes||[]).map(e=>{const magnitude=finite(e?.magnitudeMm);if(magnitude==null)return null;return{kind:'node',nodeId:String(e.nodeId),label:String(e.label||e.nodeId),levelId:e.levelId==null?null:String(e.levelId),field:'U',value:magnitude,magnitude,unit:'mm',uxMm:finite(e.uxMm)??0,uyMm:finite(e.uyMm)??0,uzMm:finite(e.uzMm)??0,governingCombinationId:e.governingCombinationId||null}}).filter(Boolean),maxAbs=Math.max(0,...raw.map(e=>e.magnitude)),items=raw.map(e=>({...e,ratio:maxAbs>1e-15?e.magnitude/maxAbs:0})),critical=items.slice().sort((a,b)=>b.magnitude-a.magnitude)[0]||null;
  return{contract:ENVELOPE_VISUALIZATION_CONTRACT,version:ENVELOPE_VISUALIZATION_VERSION,domain:'displacement',field:'U',label:'Deslocamento resultante',items,scales:{node:{maxAbs,unit:'mm',count:items.length}},criticalByKind:{node:critical},summary:{items:items.length,nodes:items.length},governance:{physicalDisplacementsOnly:true,perNodeGoverningCombination:true,noSyntheticValues:true,noNormativePassFail:true,sourceContract:explorer.contract||null}};
}

export function buildDriftVisualization(explorer={}){
  const raw=(explorer.storyDriftEnvelopes||[]).map(e=>{const ratio=finite(e?.maxDriftRatio);if(ratio==null)return null;return{kind:'story',levelId:String(e.levelId),levelLabel:String(e.levelLabel||e.levelId),fromLevelId:e.fromLevelId==null?null:String(e.fromLevelId),heightM:finite(e.heightM),field:'DRIFT',value:ratio,magnitude:Math.abs(ratio),unit:'ratio',driftMm:finite(e.maxDriftMm),driftX:finite(e.driftX),driftY:finite(e.driftY),governingCombinationId:e.governingCombinationId||null}}).filter(Boolean),maxAbs=Math.max(0,...raw.map(e=>e.magnitude)),items=raw.map(e=>({...e,ratio:maxAbs>1e-15?e.magnitude/maxAbs:0})),critical=items.slice().sort((a,b)=>b.magnitude-a.magnitude)[0]||null;
  return{contract:ENVELOPE_VISUALIZATION_CONTRACT,version:ENVELOPE_VISUALIZATION_VERSION,domain:'drift',field:'DRIFT',label:'Drift entre pavimentos',items,scales:{story:{maxAbs,unit:'ratio',count:items.length}},criticalByKind:{story:critical},summary:{items:items.length,stories:items.length},governance:{postprocessOnly:true,noSyntheticValues:true,noNormativePassFail:true,physicalDisplacementsOnly:true,sourceContract:explorer.contract||null}};
}
