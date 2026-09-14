export const DETAILING_MODEL_CONTRACT='detailing-model/v1';
export const REBAR_SCHEDULE_CONTRACT='rebar-schedule/v1';
export const STEEL_SCHEDULE_CONTRACT='steel-schedule/v1';
export const DETAILING_VERSION='0.44.0-exp';

const PI=Math.PI;
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`Detailing: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`Detailing: ${name} deve ser > 0.`);return n};
const nonnegative=(name,v)=>{const n=finite(name,v);if(n<0)throw new Error(`Detailing: ${name} deve ser >= 0.`);return n};
const countValue=(name,v)=>{const n=Math.round(positive(name,v));if(Math.abs(n-Number(v))>1e-9)throw new Error(`Detailing: ${name} deve ser inteiro positivo.`);return n};
const idValue=(name,v)=>{const s=String(v??'').trim();if(!s)throw new Error(`Detailing: ${name} é obrigatório.`);return s};
const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const round=(v,d=9)=>Number(v.toFixed(d));

export function steelMassPerMeter(diameterMm,densityKgM3=7850){
  const d=positive('diameterMm',diameterMm)/1000,rho=positive('densityKgM3',densityKgM3);
  return rho*PI*d*d/4;
}

export function layoutBarsBySpacing({clearLengthMm,maxSpacingMm,edgeOffsetStartMm=0,edgeOffsetEndMm=0}={}){
  const clear=positive('clearLengthMm',clearLengthMm),smax=positive('maxSpacingMm',maxSpacingMm),a=nonnegative('edgeOffsetStartMm',edgeOffsetStartMm),b=nonnegative('edgeOffsetEndMm',edgeOffsetEndMm);
  const available=clear-a-b;if(available<0)throw new Error('Detailing: offsets excedem o comprimento livre.');
  if(available===0)return{contract:'bar-layout/v1',clearLengthMm:clear,availableLengthMm:0,count:1,intervals:0,maxSpacingMm:smax,actualSpacingMm:0,positionsMm:[a],edgeOffsetStartMm:a,edgeOffsetEndMm:b};
  const intervals=Math.max(1,Math.ceil(available/smax)),spacing=available/intervals,positions=Array.from({length:intervals+1},(_,i)=>a+i*spacing);
  return{contract:'bar-layout/v1',clearLengthMm:clear,availableLengthMm:available,count:intervals+1,intervals,maxSpacingMm:smax,actualSpacingMm:spacing,positionsMm:positions,edgeOffsetStartMm:a,edgeOffsetEndMm:b};
}

function normalizedArc(arc,index){
  const angleDeg=finite(`arcs[${index}].angleDeg`,arc?.angleDeg),centerlineRadiusMm=positive(`arcs[${index}].centerlineRadiusMm`,arc?.centerlineRadiusMm);
  return{angleDeg,centerlineRadiusMm,lengthMm:Math.abs(angleDeg)*PI/180*centerlineRadiusMm,label:String(arc?.label??'')};
}

export function createRebarMark({id,diameterMm,quantity=1,segmentsMm=[],arcs=[],grade='',densityKgM3=7850,shape='custom',location='',notes=[],metadata={}}={}){
  const mark=idValue('rebar.id',id),d=positive('rebar.diameterMm',diameterMm),q=countValue('rebar.quantity',quantity),rho=positive('rebar.densityKgM3',densityKgM3),segments=Array.from(segmentsMm||[],(v,i)=>positive(`segmentsMm[${i}]`,v)),arcList=Array.from(arcs||[],normalizedArc);
  if(!segments.length&&!arcList.length)throw new Error(`Detailing: barra ${mark} requer ao menos um segmento ou arco.`);
  const straightLengthMm=segments.reduce((s,v)=>s+v,0),arcLengthMm=arcList.reduce((s,v)=>s+v.lengthMm,0),cutLengthMm=straightLengthMm+arcLengthMm,massPerMeter=steelMassPerMeter(d,rho),massEachKg=cutLengthMm/1000*massPerMeter,totalMassKg=massEachKg*q;
  return{contract:'rebar-mark/v1',id:mark,shape:String(shape||'custom'),grade:String(grade||''),diameterMm:d,quantity:q,segmentsMm:segments,arcs:arcList,straightLengthMm,arcLengthMm,cutLengthMm,massPerMeterKg:massPerMeter,massEachKg,totalLengthM:cutLengthMm*q/1000,totalMassKg,location:String(location||''),notes:Array.from(notes||[],String),metadata:copy(metadata||{}),assumptions:['comprimento de corte calculado na linha de centro: soma de trechos retos + arcos informados','nenhuma dedução/acréscimo normativo de dobra ou gancho é inferido; geometrias devem ser fornecidas explicitamente']};
}

export function createRebarSchedule(marks=[]){
  const list=Array.from(marks||[]),ids=new Set();for(const m of list){if(m?.contract!=='rebar-mark/v1')throw new Error('Detailing: schedule requer rebar-mark/v1.');if(ids.has(m.id))throw new Error(`Detailing: marca de barra duplicada ${m.id}.`);ids.add(m.id)}
  const byDiameter={};for(const m of list){const key=String(m.diameterMm);byDiameter[key]??={diameterMm:m.diameterMm,totalLengthM:0,totalMassKg:0,marks:0};byDiameter[key].totalLengthM+=m.totalLengthM;byDiameter[key].totalMassKg+=m.totalMassKg;byDiameter[key].marks++}
  const totalLengthM=list.reduce((s,m)=>s+m.totalLengthM,0),totalMassKg=list.reduce((s,m)=>s+m.totalMassKg,0);
  return{contract:REBAR_SCHEDULE_CONTRACT,version:DETAILING_VERSION,marks:copy(list),summary:{markCount:list.length,barCount:list.reduce((s,m)=>s+m.quantity,0),totalLengthM,totalMassKg,byDiameter:Object.values(byDiameter).sort((a,b)=>a.diameterMm-b.diameterMm)}};
}

export function createPlateMark({id,widthMm,lengthMm,thicknessMm,quantity=1,material='steel',densityKgM3=7850,location='',notes=[]}={}){
  const mark=idValue('plate.id',id),w=positive('plate.widthMm',widthMm),l=positive('plate.lengthMm',lengthMm),t=positive('plate.thicknessMm',thicknessMm),q=countValue('plate.quantity',quantity),rho=positive('plate.densityKgM3',densityKgM3),volumeEachM3=w*l*t*1e-9,massEachKg=volumeEachM3*rho;
  return{contract:'plate-mark/v1',id:mark,widthMm:w,lengthMm:l,thicknessMm:t,quantity:q,material:String(material||'steel'),densityKgM3:rho,volumeEachM3,massEachKg,totalMassKg:massEachKg*q,location:String(location||''),notes:Array.from(notes||[],String)};
}

export function createAnchorMark({id,diameterMm,quantity=1,embedmentMm=0,projectionMm=0,additionalLengthMm=0,totalLengthMm=null,grade='',densityKgM3=7850,location='',notes=[]}={}){
  const mark=idValue('anchor.id',id),d=positive('anchor.diameterMm',diameterMm),q=countValue('anchor.quantity',quantity),hef=nonnegative('anchor.embedmentMm',embedmentMm),proj=nonnegative('anchor.projectionMm',projectionMm),extra=nonnegative('anchor.additionalLengthMm',additionalLengthMm),rho=positive('anchor.densityKgM3',densityKgM3),length=totalLengthMm==null?hef+proj+extra:positive('anchor.totalLengthMm',totalLengthMm);
  if(!(length>0))throw new Error(`Detailing: chumbador ${mark} requer comprimento total > 0.`);
  const massPerMeter=steelMassPerMeter(d,rho),massEachKg=length/1000*massPerMeter;
  return{contract:'anchor-mark/v1',id:mark,diameterMm:d,quantity:q,embedmentMm:hef,projectionMm:proj,additionalLengthMm:extra,totalLengthMm:length,grade:String(grade||''),massPerMeterKg:massPerMeter,massEachKg,totalMassKg:massEachKg*q,location:String(location||''),notes:Array.from(notes||[],String),assumptions:['massa considera o fuste cilíndrico nominal; porcas, arruelas, cabeça/placa e rosca detalhada não são adicionadas automaticamente']};
}

export function createWeldMark({id,effectiveThroatMm,lengthMm,quantity=1,process='',densityKgM3=7850,location='',notes=[]}={}){
  const mark=idValue('weld.id',id),a=positive('weld.effectiveThroatMm',effectiveThroatMm),l=positive('weld.lengthMm',lengthMm),q=countValue('weld.quantity',quantity),rho=positive('weld.densityKgM3',densityKgM3),equivalentAreaMm2=a*a,volumeEachM3=equivalentAreaMm2*l*1e-9,massEachKg=volumeEachM3*rho;
  return{contract:'weld-mark/v1',id:mark,effectiveThroatMm:a,lengthMm:l,quantity:q,process:String(process||''),equivalentAreaMm2,volumeEachM3,massEachKg,totalLengthM:l*q/1000,totalMassKg:massEachKg*q,location:String(location||''),notes:Array.from(notes||[],String),assumptions:['quantitativo geométrico equivalente de filete usa área a²; resistência e tamanho normativo do cordão permanecem externos']};
}

export function createSteelSchedule({plates=[],anchors=[],welds=[]}={}){
  const P=Array.from(plates||[]),A=Array.from(anchors||[]),W=Array.from(welds||[]),all=[...P,...A,...W],ids=new Set();for(const item of all){if(ids.has(item.id))throw new Error(`Detailing: marca metálica duplicada ${item.id}.`);ids.add(item.id)}
  return{contract:STEEL_SCHEDULE_CONTRACT,version:DETAILING_VERSION,plates:copy(P),anchors:copy(A),welds:copy(W),summary:{plateCount:P.reduce((s,x)=>s+x.quantity,0),anchorCount:A.reduce((s,x)=>s+x.quantity,0),weldCount:W.reduce((s,x)=>s+x.quantity,0),weldLengthM:W.reduce((s,x)=>s+x.totalLengthM,0),plateMassKg:P.reduce((s,x)=>s+x.totalMassKg,0),anchorMassKg:A.reduce((s,x)=>s+x.totalMassKg,0),weldMassKg:W.reduce((s,x)=>s+x.totalMassKg,0),totalMassKg:all.reduce((s,x)=>s+(Number(x.totalMassKg)||0),0)}};
}

export function createDetailingPackage({projectId,revision='R0',reinforcement=null,steel=null,notes=[],provenance={},units='mm, kg'}={}){
  const pid=idValue('projectId',projectId),rev=idValue('revision',revision);if(reinforcement&&reinforcement.contract!==REBAR_SCHEDULE_CONTRACT)throw new Error('Detailing: reinforcement deve ser rebar-schedule/v1.');if(steel&&steel.contract!==STEEL_SCHEDULE_CONTRACT)throw new Error('Detailing: steel deve ser steel-schedule/v1.');
  const rebarMass=Number(reinforcement?.summary?.totalMassKg)||0,steelMass=Number(steel?.summary?.totalMassKg)||0;
  return{contract:DETAILING_MODEL_CONTRACT,version:DETAILING_VERSION,projectId:pid,revision:rev,units:String(units),reinforcement:copy(reinforcement),steel:copy(steel),summary:{rebarMassKg:rebarMass,steelDetailingMassKg:steelMass,totalScheduledMassKg:rebarMass+steelMass},notes:Array.from(notes||[],String),provenance:copy(provenance||{}),limitations:['detalhamento geométrico e quantitativo; requisitos normativos de cobrimento, espaçamento, ancoragem, emenda, dobra e solda devem ser fornecidos por profile/plugin aplicável','não constitui modelo BIM e não contém interoperabilidade IFC; essa etapa pertence à v0.45']};
}
