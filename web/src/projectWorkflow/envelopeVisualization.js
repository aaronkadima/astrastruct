export const ENVELOPE_VISUALIZATION_CONTRACT='combination-envelope-visualization/v1';
export const ENVELOPE_VISUALIZATION_VERSION='0.53.9-exp';

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
  const items=raw.map(item=>({...item,ratio:scales[item.kind].maxAbs>1e-15?item.magnitude/scales[item.kind].maxAbs:0}));
  const criticalByKind={};
  for(const kind of ['bar','shell']){const list=items.filter(i=>i.kind===kind);criticalByKind[kind]=list.sort((a,b)=>b.magnitude-a.magnitude)[0]||null}
  return{contract:ENVELOPE_VISUALIZATION_CONTRACT,version:ENVELOPE_VISUALIZATION_VERSION,field:selected,label:meta.label,items,scales,criticalByKind,summary:{items:items.length,bars:scales.bar.count,shells:scales.shell.count},governance:{separateBarShellScales:true,noUnitMixing:true,noSyntheticValues:true,sourceContract:explorer.contract||null}};
}
