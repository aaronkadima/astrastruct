from pathlib import Path


def rep(s, old, new, label):
    if new in s:
        return s
    if old not in s:
        raise SystemExit(f'{label}: anchor missing')
    return s.replace(old, new)

# -----------------------------------------------------------------------------
# Model defaults / normalization
# -----------------------------------------------------------------------------
p = Path('web/src/core/model.js')
s = p.read_text()
s = rep(
    s,
    "      dynamicMassFormulation: 'consistent', modalModes: 6, dynamicDampingRatio: 0.02, dynamicRayleighMode1: 1, dynamicRayleighMode2: 2, dynamicTimeStep: 0.01, dynamicDuration: 1, dynamicMonitorNodeId: null, dynamicMonitorDof: 'uy', dynamicHistoryPoints: [{t:0,scale:0},{t:0.1,scale:1},{t:1,scale:0}],",
    "      dynamicMassFormulation: 'consistent', modalModes: 6, dynamicDampingRatio: 0.02, dynamicRayleighMode1: 1, dynamicRayleighMode2: 2, dynamicTimeStep: 0.01, dynamicDuration: 1, dynamicMonitorNodeId: null, dynamicMonitorDof: 'uy', dynamicHistoryPoints: [{t:0,scale:0},{t:0.1,scale:1},{t:1,scale:0}], dynamicExcitationType: 'load-pattern', dynamicGroundMotionDirection: 'x', dynamicGroundMotionPoints: [{t:0,accelG:0},{t:0.05,accelG:0.15},{t:0.10,accelG:0},{t:0.15,accelG:-0.10},{t:0.20,accelG:0}], responseSpectrumCombination: 'cqc', responseSpectrumPeriodMin: 0.02, responseSpectrumPeriodMax: 4, responseSpectrumPeriodPoints: 80,",
    'model v024 defaults'
)
s = rep(
    s,
    "  p.settings.analysisType = ['pdelta','corotational','modal','time-history'].includes(analysisType) ? analysisType : 'linear';",
    "  p.settings.analysisType = ['pdelta','corotational','modal','time-history','response-spectrum'].includes(analysisType) ? analysisType : 'linear';",
    'model analysis types'
)
anchor = "  if(p.settings.dynamicHistoryPoints.length<2)p.settings.dynamicHistoryPoints=[{t:0,scale:0},{t:.1,scale:1},{t:1,scale:0}];"
insert = anchor + "\n  p.settings.dynamicExcitationType = p.settings.dynamicExcitationType === 'base-acceleration' ? 'base-acceleration' : 'load-pattern';\n  p.settings.dynamicGroundMotionDirection = p.settings.dynamicGroundMotionDirection === 'y' ? 'y' : 'x';\n  p.settings.dynamicGroundMotionPoints = (Array.isArray(p.settings.dynamicGroundMotionPoints)?p.settings.dynamicGroundMotionPoints:[]).map(x=>({t:Number(x?.t),accelG:Number(x?.accelG??x?.accelerationG??x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.accelG)).sort((a,b)=>a.t-b.t).slice(0,5000);\n  if(p.settings.dynamicGroundMotionPoints.length<2)p.settings.dynamicGroundMotionPoints=[{t:0,accelG:0},{t:.05,accelG:.15},{t:.10,accelG:0},{t:.15,accelG:-.10},{t:.20,accelG:0}];\n  p.settings.responseSpectrumCombination = p.settings.responseSpectrumCombination === 'srss' ? 'srss' : 'cqc';\n  p.settings.responseSpectrumPeriodMin = Math.max(0.001, Number(p.settings.responseSpectrumPeriodMin) || .02);\n  p.settings.responseSpectrumPeriodMax = Math.max(p.settings.responseSpectrumPeriodMin, Number(p.settings.responseSpectrumPeriodMax) || 4);\n  p.settings.responseSpectrumPeriodPoints = Math.max(10, Math.min(300, Math.round(Number(p.settings.responseSpectrumPeriodPoints) || 80)));"
s = rep(s, anchor, insert, 'model v024 normalization')
p.write_text(s)

# -----------------------------------------------------------------------------
# Dynamics core: keep v0.23 matrix/modal foundation; replace high-level dynamics
# with base excitation + response spectrum / SRSS / CQC.
# -----------------------------------------------------------------------------
p = Path('web/src/solver/dynamics2d.js')
s = p.read_text().replace('v0.23', 'v0.24').replace("'0.23.0-exp'", "'0.24.0-exp'").replace("'0.23.0-exp';", "'0.24.0-exp';")
start = s.index('export function solveTimeHistory2D(')
end = s.index("export const DYNAMICS_VERSION=", start)
new_tail = r'''function normalizeGroundMotion(raw){
  const points=(Array.isArray(raw)?raw:[]).map(x=>({t:Number(x?.t),accelG:Number(x?.accelG??x?.accelerationG??x?.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.accelG)).sort((a,b)=>a.t-b.t);
  if(points.length<2)throw new Error('Excitação sísmica v0.24 requer ao menos dois pontos {t, accelG}.');
  if(Math.abs(points[0].t)>1e-12)throw new Error('Acelerograma v0.24 deve iniciar em t=0.');
  for(let i=1;i<points.length;i++)if(!(points[i].t>points[i-1].t))throw new Error('Acelerograma: tempos devem ser estritamente crescentes.');
  if(Math.abs(points[0].accelG)>1e-10)throw new Error('Acelerograma v0.24 deve iniciar com aceleração zero; pré-penda t=0, a=0 após a correção de linha de base.');
  return points;
}
function groundAcceleration(points,t){return interpolateHistory(points.map(x=>({t:x.t,scale:x.accelG*G0})),t)}
function groundAccelerationG(points,t){return interpolateHistory(points.map(x=>({t:x.t,scale:x.accelG})),t)}
function minGroundStep(points){let h=Infinity;for(let i=1;i<points.length;i++)h=Math.min(h,points[i].t-points[i-1].t);return Number.isFinite(h)?h:.01}

export function cqcCorrelation(omegaI,omegaJ,dampingRatio=.05){
  const wi=Math.abs(Number(omegaI)),wj=Math.abs(Number(omegaJ)),z=clamp(Math.abs(Number(dampingRatio)||0),0,.30);if(!(wi>0&&wj>0))return 0;if(Math.abs(wi-wj)<=1e-12*Math.max(wi,wj))return 1;const r=Math.min(wi,wj)/Math.max(wi,wj),num=8*z*z*(1+r)*Math.pow(r,1.5),den=Math.pow(1-r*r,2)+4*z*z*r*Math.pow(1+r,2);return den>EPS?clamp(num/den,0,1):0;
}

function sdofSpectrumPoint(points,period,dampingRatio,timeStep){
  const T=Number(period),z=clamp(Number(dampingRatio)||0,0,.30);if(!(T>0))throw new Error('Espectro: período deve ser positivo.');const omega=2*Math.PI/T,m=1,k=omega*omega,c=2*z*omega,duration=points.at(-1).t,h=Math.min(Math.max(1e-5,Number(timeStep)||minGroundStep(points)),Math.max(1e-5,duration)),steps=Math.max(1,Math.ceil(duration/h)),dt=duration/steps,b=.25,g=.5,A0=1/(b*dt*dt),A1=g/(b*dt),A2=1/(b*dt),A3=1/(2*b)-1,A4=g/b-1,A5=dt*(g/(2*b)-1),keff=k+A0*m+A1*c;let u=0,v=0,a=0,sd=0,absAcc=0;
  for(let step=1;step<=steps;step++){const t=step*dt,ag=groundAcceleration(points,t),p=-ag,rhs=p+m*(A0*u+A2*v+A3*a)+c*(A1*u+A4*v+A5*a),un=rhs/keff,an=A0*(un-u)-A2*v-A3*a,vn=v+dt*((1-g)*a+g*an);u=un;v=vn;a=an;sd=Math.max(sd,Math.abs(u));absAcc=Math.max(absAcc,Math.abs(a+ag))}
  const sv=omega*sd,sa=omega*omega*sd;return{period:T,frequencyHz:1/T,omega,sd,sv,sa,saG:sa/G0,absoluteAcceleration:absAcc,absoluteAccelerationG:absAcc/G0};
}

export function responseSpectrumFromGroundMotion(raw,options={}){
  const points=normalizeGroundMotion(raw),z=clamp(Number(options.dampingRatio??.05)||0,0,.30),timeStep=Math.max(1e-5,Number(options.timeStep)||minGroundStep(points));let periods;
  if(Array.isArray(options.periods)&&options.periods.length)periods=[...new Set(options.periods.map(Number).filter(x=>Number.isFinite(x)&&x>0))].sort((a,b)=>a-b);else{const t0=Math.max(.001,Number(options.periodMin)||.02),t1=Math.max(t0,Number(options.periodMax)||4),n=clamp(Math.round(Number(options.periodCount)||80),10,300);periods=Array.from({length:n},(_,i)=>t0+(t1-t0)*(n===1?0:i/(n-1)))}
  const values=periods.map(T=>sdofSpectrumPoint(points,T,z,timeStep)),pgaG=Math.max(...points.map(x=>Math.abs(x.accelG)));return{dampingRatio:z,timeStep,groundMotionPoints:points,pgaG,pga:pgaG*G0,values,ordinates:{sd:'m',sv:'m/s pseudo',sa:'m/s² pseudo',saG:'g pseudo'}};
}

function combineModalVectors(vectors,omegas,zeta,method){
  if(!vectors.length)return[];const n=vectors[0].length,out=Array(n).fill(0),kind=method==='srss'?'srss':'cqc';for(let d=0;d<n;d++){let sum=0;if(kind==='srss'){for(const v of vectors)sum+=v[d]*v[d]}else for(let i=0;i<vectors.length;i++)for(let j=0;j<vectors.length;j++)sum+=cqcCorrelation(omegas[i],omegas[j],zeta)*vectors[i][d]*vectors[j][d];out[d]=Math.sqrt(Math.max(0,sum))}return out;
}

export function solveResponseSpectrum2D(project,options={}){
  const massFormulation=options.massFormulation==='lumped'?'lumped':'consistent',modesRequested=Math.max(1,Math.min(20,Math.round(Number(options.modes)||6))),modal=solveModal2D(project,{massFormulation,modes:modesRequested}),direction=options.direction==='y'?'y':'x',z=clamp(Number(options.dampingRatio??.05)||0,0,.30),points=normalizeGroundMotion(options.groundMotionPoints),dense=responseSpectrumFromGroundMotion(points,{dampingRatio:z,timeStep:options.timeStep,periodMin:options.periodMin,periodMax:options.periodMax,periodCount:options.periodCount}),atModes=responseSpectrumFromGroundMotion(points,{dampingRatio:z,timeStep:options.timeStep,periods:modal.modes.map(m=>m.period)}),specByPeriod=new Map(atModes.values.map(x=>[x.period,x])),vectors=[],omegas=[],modalContributions=[];
  for(const m of modal.modes){const sp=specByPeriod.get(m.period),participation=Number(m.participation?.[direction])||0,q=participation*sp.sd,vec=m.massNormalizedVector.map(v=>v*q),maxModalTranslational=Math.max(0,...project.nodes.map((n,i)=>Math.hypot(vec[3*i]||0,vec[3*i+1]||0)));vectors.push(vec);omegas.push(m.omega);modalContributions.push({mode:m.mode,period:m.period,frequencyHz:m.frequencyHz,omega:m.omega,participationFactor:participation,effectiveMassRatio:direction==='x'?m.participation?.effectiveMassRatioX:m.participation?.effectiveMassRatioY,sd:sp.sd,sv:sp.sv,sa:sp.sa,saG:sp.saG,generalizedPeak:q,maxModalTranslational})}
  const combination=options.combination==='srss'?'srss':'cqc',combined=combineModalVectors(vectors,omegas,z,combination),displacements=project.nodes.map((n,i)=>({nodeId:n.id,ux:combined[3*i]||0,uy:combined[3*i+1]||0,rz:combined[3*i+2]||0})),peakCombinedDisplacement=Math.max(0,...displacements.map(d=>Math.hypot(d.ux,d.uy))),cum=modal.modes.at(-1)?.participation?.[direction==='x'?'cumulativeMassRatioX':'cumulativeMassRatioY']||0;
  return{type:'dynamic-response-spectrum2d',analysisType:'response-spectrum',solverVersion:'0.24.0-exp',dofs:modal.dofs,freeDofs:modal.freeDofs,massFormulation,densityConvention:modal.densityConvention,modal:{modes:modal.modes,requestedModes:modesRequested},direction,dampingRatio:z,combination,spectrum:dense,modalContributions,combined:{method:combination,peakTranslationalDisplacement:peakCombinedDisplacement,cumulativeEffectiveMassRatio:cum},displacements};
}

export function solveTimeHistory2D(project,scenarioId,options={}){
  const resolved=resolveScenario(project,scenarioId),p=resolved.project,excitationType=options.excitationType==='base-acceleration'?'base-acceleration':'scaled-load-pattern',sys=assembleDynamicSystem2D(p,{massFormulation:options.massFormulation,includeLoadVector:excitationType==='scaled-load-pattern'}),modal=solveModal2D(p,{massFormulation:options.massFormulation,modes:Math.max(2,Number(options.rayleighMode2)||2)}),rayleigh=rayleighFromModes(modal.modes,{dampingRatio:options.dampingRatio,mode1:options.rayleighMode1,mode2:options.rayleighMode2}),C=matAdd(matScale(sys.Mf,rayleigh.alphaM),matScale(sys.Kf,rayleigh.betaK)),raw=Array.isArray(options.historyPoints)?options.historyPoints:[],loadPoints=raw.map(x=>({t:Number(x.t),scale:Number(x.scale)})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.scale)).sort((a,b)=>a.t-b.t),groundPoints=excitationType==='base-acceleration'?normalizeGroundMotion(options.groundMotionPoints):null;
  if(excitationType==='scaled-load-pattern'){if(loadPoints.length<2)throw new Error('História temporal v0.24 requer pelo menos dois pontos {t, scale}.');if(Math.abs(loadPoints[0].t)>1e-12||Math.abs(loadPoints[0].scale)>1e-12)throw new Error('História temporal v0.24 deve iniciar em t=0 com scale=0.');for(let i=1;i<loadPoints.length;i++)if(!(loadPoints[i].t>loadPoints[i-1].t))throw new Error('História temporal: tempos devem ser estritamente crescentes.');}
  const naturalDuration=excitationType==='base-acceleration'?groundPoints.at(-1).t:loadPoints.at(-1).t,duration=Number(options.duration)>0?Number(options.duration):naturalDuration,dt=Number(options.timeStep)||.01;if(!(duration>0&&dt>0))throw new Error('História temporal: duração e passo de tempo devem ser positivos.');if(Math.ceil(duration/dt)>10000)throw new Error('História temporal v0.24 limita a integração a 10.000 passos no navegador.');const nodeId=options.monitorNodeId||p.nodes?.at(-1)?.id,dof=['ux','uy','rz'].includes(options.monitorDof)?options.monitorDof:'uy',monitor=monitorDof(sys,nodeId,dof),peakByNode=new Map(p.nodes.map(n=>[n.id,{nodeId:n.id,ux:0,uy:0,rz:0}])),direction=options.groundMotionDirection==='y'?'y':'x',r=excitationType==='base-acceleration'?influence(sys.free,direction):null,mr=r?mul(sys.Mf,r):null;
  const forceAtTime=t=>excitationType==='base-acceleration'?mr.map(v=>-v*groundAcceleration(groundPoints,t)):(()=>{const scale=interpolateHistory(loadPoints,t);return sys.Ff.map(v=>scale*v)})(),integrated=newmarkLinearSystem({M:sys.Mf,C,K:sys.Kf,forceAtTime,dt,duration,onStep:row=>{for(let ni=0;ni<p.nodes.length;ni++){const rec=peakByNode.get(p.nodes[ni].id);for(const [key,off] of [['ux',0],['uy',1],['rz',2]]){const pos=sys.free.indexOf(3*ni+off),value=pos>=0?Math.abs(row.u[pos]):0;if(value>rec[key])rec[key]=value}}}}),history=integrated.history.map(row=>{const ag=excitationType==='base-acceleration'?groundAcceleration(groundPoints,row.t):0,agG=excitationType==='base-acceleration'?groundAccelerationG(groundPoints,row.t):0,relativeAcceleration=row.a[monitor.freePosition],monitorMatchesGround=(monitor.dof==='ux'&&direction==='x')||(monitor.dof==='uy'&&direction==='y');return{step:row.step,t:row.t,scale:excitationType==='scaled-load-pattern'?interpolateHistory(loadPoints,row.t):null,groundAcceleration:ag,groundAccelerationG:agG,displacement:row.u[monitor.freePosition],velocity:row.v[monitor.freePosition],acceleration:relativeAcceleration,absoluteAcceleration:relativeAcceleration+(monitorMatchesGround?ag:0),kineticEnergy:row.kineticEnergy,strainEnergy:row.strainEnergy,totalMechanicalEnergy:row.totalMechanicalEnergy}}),peak=history.reduce((best,r)=>Math.abs(r.displacement)>Math.abs(best.displacement)?r:best,history[0]),fullFinal=Array(sys.nd).fill(0);sys.free.forEach((d,i)=>{fullFinal[d]=integrated.final.u[i]});
  return{type:'dynamic-time-history2d',analysisType:'time-history',solverVersion:'0.24.0-exp',scenario:resolved.scenario,dofs:sys.nd,freeDofs:sys.free.length,massFormulation:sys.massFormulation,gravity:sys.gravity,densityConvention:'material.density interpreted as unit weight [kN/m³]; mass density = density/g',modal:{modes:modal.modes,usedForDamping:true},rayleigh,newmark:{method:'average-acceleration',beta:integrated.beta,gamma:integrated.gamma,timeStep:integrated.dt,duration:integrated.duration,steps:integrated.steps},excitation:excitationType==='base-acceleration'?{type:'base-acceleration',baseAcceleration:true,direction,groundMotionPoints:groundPoints,pgaG:Math.max(...groundPoints.map(x=>Math.abs(x.accelG)))}:{type:'scaled-load-pattern',historyPoints:loadPoints,referenceScenarioId:scenarioId||resolved.scenario?.id,baseAcceleration:false},monitor,history,peakResponse:{...peak,absDisplacement:Math.abs(peak.displacement)},peakByNode:[...peakByNode.values()],displacements:p.nodes.map((n,i)=>({nodeId:n.id,ux:fullFinal[3*i],uy:fullFinal[3*i+1],rz:fullFinal[3*i+2]}))};
}

export const DYNAMICS_VERSION='0.24.0-exp';'''
s = s[:start] + new_tail + '\n'
p.write_text(s)

# -----------------------------------------------------------------------------
# Dispatcher
# -----------------------------------------------------------------------------
p = Path('web/src/solver/index.js')
s = p.read_text()
s = rep(s,
    "import { solveModal2D, solveTimeHistory2D } from './dynamics2d.js';",
    "import { solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D } from './dynamics2d.js';",
    'dispatcher dynamics import')
s = s.replace("Dinâmica modal v0.23", "Dinâmica modal v0.24").replace("História temporal v0.23", "História temporal v0.24")
anchor = "  if(analysisType==='time-history'){\n    if(fiberHinges.length)throw new Error('História temporal v0.24 é linear-elástica; desative as rótulas de fibras.');\n    return solveTimeHistory2D(project,scenarioId,{massFormulation:s.dynamicMassFormulation,dampingRatio:s.dynamicDampingRatio,rayleighMode1:s.dynamicRayleighMode1,rayleighMode2:s.dynamicRayleighMode2,timeStep:s.dynamicTimeStep,duration:s.dynamicDuration,monitorNodeId:s.dynamicMonitorNodeId,monitorDof:s.dynamicMonitorDof,historyPoints:s.dynamicHistoryPoints});\n  }"
replacement = "  if(analysisType==='response-spectrum'){\n    if(fiberHinges.length)throw new Error('Espectro de resposta v0.24 é linear-elástico; desative as rótulas de fibras.');\n    return solveResponseSpectrum2D(project,{massFormulation:s.dynamicMassFormulation,modes:s.modalModes,dampingRatio:s.dynamicDampingRatio,timeStep:s.dynamicTimeStep,direction:s.dynamicGroundMotionDirection,groundMotionPoints:s.dynamicGroundMotionPoints,combination:s.responseSpectrumCombination,periodMin:s.responseSpectrumPeriodMin,periodMax:s.responseSpectrumPeriodMax,periodCount:s.responseSpectrumPeriodPoints});\n  }\n  if(analysisType==='time-history'){\n    if(fiberHinges.length)throw new Error('História temporal v0.24 é linear-elástica; desative as rótulas de fibras.');\n    return solveTimeHistory2D(project,scenarioId,{massFormulation:s.dynamicMassFormulation,dampingRatio:s.dynamicDampingRatio,rayleighMode1:s.dynamicRayleighMode1,rayleighMode2:s.dynamicRayleighMode2,timeStep:s.dynamicTimeStep,duration:s.dynamicDuration,monitorNodeId:s.dynamicMonitorNodeId,monitorDof:s.dynamicMonitorDof,historyPoints:s.dynamicHistoryPoints,excitationType:s.dynamicExcitationType,groundMotionDirection:s.dynamicGroundMotionDirection,groundMotionPoints:s.dynamicGroundMotionPoints});\n  }"
s = rep(s, anchor, replacement, 'dispatcher response spectrum')
p.write_text(s)

# -----------------------------------------------------------------------------
# Analysis UI
# -----------------------------------------------------------------------------
p = Path('app/src/AnalysisPanelV13.tsx')
s = p.read_text()
s = rep(s, "const explicitSpring=(v:any)=>", "const parseGroundMotionCsv=(raw:string)=>raw.split(/\\r?\\n/).map(line=>line.trim()).filter(Boolean).map(line=>line.split(/[;,\\t ]+/).map(Number)).filter(x=>x.length>=2&&Number.isFinite(x[0])&&Number.isFinite(x[1])).map(x=>({t:x[0],accelG:x[1]}));\nconst explicitSpring=(v:any)=>", 'analysis csv helper')
s = s.replace('dinâmica v0.23', 'dinâmica v0.24').replace('Dinâmica v0.23', 'Dinâmica v0.24')
state_anchor = "  const [dynamicHistoryText,setDynamicHistoryText]=useState((project.settings?.dynamicHistoryPoints||[{t:0,scale:0},{t:.1,scale:1},{t:1,scale:0}]).map((x:any)=>`${num(x.t)}:${num(x.scale)}`).join(', '));"
state_new = state_anchor + "\n  const [dynamicExcitationType,setDynamicExcitationType]=useState(project.settings?.dynamicExcitationType==='base-acceleration'?'base-acceleration':'load-pattern');\n  const [dynamicGroundMotionDirection,setDynamicGroundMotionDirection]=useState(project.settings?.dynamicGroundMotionDirection==='y'?'y':'x');\n  const [dynamicGroundMotionText,setDynamicGroundMotionText]=useState((project.settings?.dynamicGroundMotionPoints||[{t:0,accelG:0},{t:.05,accelG:.15},{t:.10,accelG:0},{t:.15,accelG:-.10},{t:.20,accelG:0}]).map((x:any)=>`${num(x.t)}:${num(x.accelG)}`).join(', '));\n  const [responseSpectrumCombination,setResponseSpectrumCombination]=useState(project.settings?.responseSpectrumCombination==='srss'?'srss':'cqc');\n  const [responseSpectrumPeriodMin,setResponseSpectrumPeriodMin]=useState(project.settings?.responseSpectrumPeriodMin??.02);\n  const [responseSpectrumPeriodMax,setResponseSpectrumPeriodMax]=useState(project.settings?.responseSpectrumPeriodMax??4);\n  const [responseSpectrumPeriodPoints,setResponseSpectrumPeriodPoints]=useState(project.settings?.responseSpectrumPeriodPoints??80);"
s = rep(s, state_anchor, state_new, 'analysis v024 states')
logic_old = "  const dynamicMode=mode==='modal'||mode==='time-history',dynamicIssues=useMemo(()=>dynamicIncompatibilities(effectiveProject,mode==='time-history'),[effectiveProject,mode]);"
logic_new = "  const dynamicMode=mode==='modal'||mode==='time-history'||mode==='response-spectrum',dynamicIssues=useMemo(()=>dynamicIncompatibilities(effectiveProject,mode==='time-history'&&dynamicExcitationType==='load-pattern'),[effectiveProject,mode,dynamicExcitationType]);"
s = rep(s, logic_old, logic_new, 'analysis dynamic mode')
remove_anchor = "  const removeFollower=(id:string)=>setElementLoads(old=>old.filter((l:any)=>l.id!==id));"
remove_new = remove_anchor + "\n  const importGroundMotion=(file:File)=>{const reader=new FileReader();reader.onload=()=>{const pts=parseGroundMotionCsv(String(reader.result||''));if(pts.length>=2)setDynamicGroundMotionText(pts.map(x=>`${x.t}:${x.accelG}`).join(', '))};reader.readAsText(file)};"
s = rep(s, remove_anchor, remove_new, 'analysis import accelerogram')
apply_anchor = "    p.settings.dynamicMassFormulation=dynamicMassFormulation==='lumped'?'lumped':'consistent';p.settings.modalModes=Math.max(1,Math.min(20,Math.round(num(modalModes,6))));p.settings.dynamicDampingRatio=Math.max(0,Math.min(.30,num(dynamicDampingRatio,.02)));p.settings.dynamicRayleighMode1=Math.max(1,Math.min(20,Math.round(num(dynamicRayleighMode1,1))));p.settings.dynamicRayleighMode2=Math.max(1,Math.min(20,Math.round(num(dynamicRayleighMode2,2))));p.settings.dynamicTimeStep=Math.max(1e-5,num(dynamicTimeStep,.01));p.settings.dynamicDuration=Math.max(p.settings.dynamicTimeStep,num(dynamicDuration,1));p.settings.dynamicMonitorNodeId=dynamicMonitorNodeId||null;p.settings.dynamicMonitorDof=['ux','uy','rz'].includes(dynamicMonitorDof)?dynamicMonitorDof:'uy';const parsedDynamic=String(dynamicHistoryText).split(/[,;]+/).map(x=>x.trim()).filter(Boolean).map(x=>{const [t,scale]=x.split(':').map(Number);return{t,scale}}).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.scale)).sort((a,b)=>a.t-b.t);p.settings.dynamicHistoryPoints=parsedDynamic.length>=2?parsedDynamic:[{t:0,scale:0},{t:.1,scale:1},{t:1,scale:0}];"
apply_new = apply_anchor + "p.settings.dynamicExcitationType=dynamicExcitationType==='base-acceleration'?'base-acceleration':'load-pattern';p.settings.dynamicGroundMotionDirection=dynamicGroundMotionDirection==='y'?'y':'x';const parsedGround=String(dynamicGroundMotionText).split(/[,;]+/).map(x=>x.trim()).filter(Boolean).map(x=>{const [t,accelG]=x.split(':').map(Number);return{t,accelG}}).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.accelG)).sort((a,b)=>a.t-b.t);p.settings.dynamicGroundMotionPoints=parsedGround.length>=2?parsedGround:[{t:0,accelG:0},{t:.05,accelG:.15},{t:.10,accelG:0},{t:.15,accelG:-.10},{t:.20,accelG:0}];p.settings.responseSpectrumCombination=responseSpectrumCombination==='srss'?'srss':'cqc';p.settings.responseSpectrumPeriodMin=Math.max(.001,num(responseSpectrumPeriodMin,.02));p.settings.responseSpectrumPeriodMax=Math.max(p.settings.responseSpectrumPeriodMin,num(responseSpectrumPeriodMax,4));p.settings.responseSpectrumPeriodPoints=Math.max(10,Math.min(300,Math.round(num(responseSpectrumPeriodPoints,80))));"
s = rep(s, apply_anchor, apply_new, 'analysis apply v024 settings')
# Add response-spectrum choice after time-history button.
choice = '<button data-testid="analysis-time-history" className={mode===\'time-history\'?\'active\':\'\'} onClick={()=>setMode(\'time-history\')}><b>Hist. temporal · v0.23</b><span>Mü + Ců + Ku = p(t)</span><small>Newmark-β + Rayleigh.</small></button>'
choice_new = '<button data-testid="analysis-time-history" className={mode===\'time-history\'?\'active\':\'\'} onClick={()=>setMode(\'time-history\')}><b>Hist. temporal · v0.24</b><span>Mü + Ců + Ku = p(t)</span><small>Padrão de carga ou aceleração de base.</small></button><button data-testid="analysis-response-spectrum" className={mode===\'response-spectrum\'?\'active\':\'\'} onClick={()=>setMode(\'response-spectrum\')}><b>Espectro · v0.24</b><span>Sa · Sv · Sd</span><small>Resposta modal combinada por SRSS/CQC.</small></button>'
s = rep(s, choice, choice_new, 'analysis v024 choices')
# Replace dynamic controls block by index slicing.
start = s.index('      {dynamicMode&&<section className="react-card" data-testid="dynamic-controls">')
end = s.index("      {mode==='pdelta'&&", start)
new_dynamic = r'''      {dynamicMode&&<section className="react-card" data-testid="dynamic-controls"><div className="section-title"><h3>Dinâmica linear · v0.24</h3><span className="chip">M + C + K</span></div><div className="geometry-grid"><label>Matriz de massa<select data-testid="dynamic-mass-formulation" value={dynamicMassFormulation} onChange={e=>setDynamicMassFormulation(e.target.value)}><option value="consistent">Consistente</option><option value="lumped">Concentrada</option></select></label><label>Nº de modos<input data-testid="modal-mode-count" type="number" min="1" max="20" value={modalModes} onChange={e=>setModalModes(num(e.target.value,6))}/></label></div><div className="panel-note">`density` é peso específico [kN/m³]; a massa volumétrica é ρm=γ/g. Massas nodais adicionais permanecem no Inspector.</div>{mode==='time-history'&&<><h3>Integração temporal</h3><div className="geometry-grid"><label>Excitação<select data-testid="dynamic-excitation-type" value={dynamicExcitationType} onChange={e=>setDynamicExcitationType(e.target.value)}><option value="load-pattern">Padrão de cargas × história</option><option value="base-acceleration">Aceleração de base</option></select></label><label>Amortecimento ζ<input data-testid="dynamic-damping-ratio" type="number" min="0" max="0.30" step="0.005" value={dynamicDampingRatio} onChange={e=>setDynamicDampingRatio(num(e.target.value,.02))}/></label><label>Modo Rayleigh 1<input data-testid="dynamic-rayleigh-mode-1" type="number" min="1" max="20" value={dynamicRayleighMode1} onChange={e=>setDynamicRayleighMode1(num(e.target.value,1))}/></label><label>Modo Rayleigh 2<input data-testid="dynamic-rayleigh-mode-2" type="number" min="1" max="20" value={dynamicRayleighMode2} onChange={e=>setDynamicRayleighMode2(num(e.target.value,2))}/></label><label>Δt [s]<input data-testid="dynamic-time-step" type="number" min="0.00001" step="0.001" value={dynamicTimeStep} onChange={e=>setDynamicTimeStep(num(e.target.value,.01))}/></label><label>Duração [s]<input data-testid="dynamic-duration" type="number" min="0.00001" step="0.1" value={dynamicDuration} onChange={e=>setDynamicDuration(num(e.target.value,1))}/></label><label>Nó monitor<select data-testid="dynamic-monitor-node" value={dynamicMonitorNodeId} onChange={e=>setDynamicMonitorNodeId(e.target.value)}>{(project.nodes||[]).map((n:any)=><option key={n.id} value={n.id}>{n.id}</option>)}</select></label><label>DOF monitor<select data-testid="dynamic-monitor-dof" value={dynamicMonitorDof} onChange={e=>setDynamicMonitorDof(e.target.value)}><option value="ux">Ux</option><option value="uy">Uy</option><option value="rz">Rz</option></select></label></div>{dynamicExcitationType==='load-pattern'?<div className="geometry-grid"><label>História t:escala<input data-testid="dynamic-history-points" value={dynamicHistoryText} onChange={e=>setDynamicHistoryText(e.target.value)}/></label></div>:<><div className="geometry-grid"><label>Direção da base<select data-testid="ground-motion-direction" value={dynamicGroundMotionDirection} onChange={e=>setDynamicGroundMotionDirection(e.target.value)}><option value="x">X global</option><option value="y">Y global</option></select></label><label>Acelerograma t:a[g]<input data-testid="ground-motion-points" value={dynamicGroundMotionText} onChange={e=>setDynamicGroundMotionText(e.target.value)}/></label><label>CSV tempo, a[g]<input data-testid="ground-motion-file" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)importGroundMotion(f);e.currentTarget.value='' }}/></label></div><div className="panel-note">Equação relativa: <b>Mü + Ců + Ku = −Mr a<sub>g</sub>(t)</b>. O acelerograma deve iniciar em t=0 com a=0; valores são informados em g.</div></>}</>}{mode==='response-spectrum'&&<><h3>Espectro de resposta do acelerograma</h3><div className="geometry-grid"><label>Amortecimento ζ<input data-testid="spectrum-damping-ratio" type="number" min="0" max="0.30" step="0.005" value={dynamicDampingRatio} onChange={e=>setDynamicDampingRatio(num(e.target.value,.05))}/></label><label>Direção<select data-testid="spectrum-direction" value={dynamicGroundMotionDirection} onChange={e=>setDynamicGroundMotionDirection(e.target.value)}><option value="x">X global</option><option value="y">Y global</option></select></label><label>Combinação<select data-testid="spectrum-combination" value={responseSpectrumCombination} onChange={e=>setResponseSpectrumCombination(e.target.value)}><option value="cqc">CQC</option><option value="srss">SRSS</option></select></label><label>T mín. [s]<input data-testid="spectrum-period-min" type="number" min="0.001" step="0.01" value={responseSpectrumPeriodMin} onChange={e=>setResponseSpectrumPeriodMin(num(e.target.value,.02))}/></label><label>T máx. [s]<input data-testid="spectrum-period-max" type="number" min="0.001" step="0.1" value={responseSpectrumPeriodMax} onChange={e=>setResponseSpectrumPeriodMax(num(e.target.value,4))}/></label><label>Pontos<input data-testid="spectrum-period-points" type="number" min="10" max="300" value={responseSpectrumPeriodPoints} onChange={e=>setResponseSpectrumPeriodPoints(num(e.target.value,80))}/></label><label>Δt integração [s]<input data-testid="spectrum-time-step" type="number" min="0.00001" step="0.001" value={dynamicTimeStep} onChange={e=>setDynamicTimeStep(num(e.target.value,.01))}/></label><label>Acelerograma t:a[g]<input data-testid="spectrum-ground-motion-points" value={dynamicGroundMotionText} onChange={e=>setDynamicGroundMotionText(e.target.value)}/></label><label>CSV tempo, a[g]<input data-testid="spectrum-ground-motion-file" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)importGroundMotion(f);e.currentTarget.value='' }}/></label></div><div className="panel-note">A v0.24 calcula <b>Sd</b>, <b>Sv=ωSd</b> e <b>Sa=ω²Sd</b> (pseudo-espectros) com osciladores SDOF por Newmark-β. A resposta estrutural usa fatores de participação modal e combinação SRSS/CQC com amortecimento modal uniforme.</div></>}</section>}
'''
s = s[:start] + new_dynamic + s[end:]
s = s.replace('<b>Dinâmica v0.23 indisponível neste modelo:</b>', '<b>Dinâmica v0.24 indisponível neste modelo:</b>')
p.write_text(s)

# -----------------------------------------------------------------------------
# Main result summary
# -----------------------------------------------------------------------------
p = Path('app/src/App.tsx')
s = p.read_text()
anchor = "  if(result.analysisType==='time-history'){return <div className=\"results-content\" data-testid=\"dynamic-results-time\"><div className=\"metrics\"><div><span>Solver</span><strong>{result.type}</strong></div><div><span>Monitor</span><strong>{result.monitor?.nodeId}/{String(result.monitor?.dof||'').toUpperCase()}</strong></div><div><span>|u| pico</span><strong>{(1000*Number(result.peakResponse?.absDisplacement||0)).toFixed(4)} mm</strong></div><div><span>Δt</span><strong>{Number(result.newmark?.timeStep||0).toFixed(5)} s</strong></div></div><div className=\"panel-note\">História temporal linear por Newmark average-acceleration com amortecimento de Rayleigh. Abra Diagramas/envelopes para o gráfico completo.</div></div>}"
replacement = anchor + "\n  if(result.analysisType==='response-spectrum'){return <div className=\"results-content\" data-testid=\"dynamic-results-spectrum\"><div className=\"metrics\"><div><span>Solver</span><strong>{result.type}</strong></div><div><span>Direção</span><strong>{String(result.direction||'x').toUpperCase()}</strong></div><div><span>Combinação</span><strong>{String(result.combination||'cqc').toUpperCase()}</strong></div><div><span>PGA</span><strong>{Number(result.spectrum?.pgaG||0).toFixed(4)} g</strong></div><div><span>|u| comb.</span><strong>{(1000*Number(result.combined?.peakTranslationalDisplacement||0)).toFixed(4)} mm</strong></div></div><div className=\"panel-note\">Pseudo-espectros Sa/Sv/Sd derivados do acelerograma e resposta modal combinada. Abra Diagramas/envelopes para a curva espectral e contribuições modais.</div></div>}"
s = rep(s, anchor, replacement, 'app spectrum result summary')
p.write_text(s)

# -----------------------------------------------------------------------------
# Dynamics postprocess rewritten for v0.24
# -----------------------------------------------------------------------------
Path('app/src/DynamicsPostprocessPanel.tsx').write_text(r'''import React from 'react';

type Props={result:any;onClose:()=>void};
const num=(v:any,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const fmt=(v:any,d=4)=>{const n=Number(v);if(!Number.isFinite(n))return'—';return Math.abs(n)>=1e4||(Math.abs(n)>0&&Math.abs(n)<1e-3)?n.toExponential(3):n.toFixed(d)};

function PolyChart({rows,xKey,yKey,title,xUnit,yUnit,testId}:{rows:any[];xKey:string;yKey:string;title:string;xUnit:string;yUnit:string;testId:string}){
  if(!rows?.length)return <div className="empty-state">Sem dados.</div>;const W=720,H=270,L=58,R=18,T=28,B=38,xs=rows.map(r=>num(r[xKey])),ys=rows.map(r=>num(r[yKey])),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys,0),ymax=Math.max(...ys,0),dx=Math.max(xmax-xmin,1e-12),dy=Math.max(ymax-ymin,1e-12),ylo=ymin-.08*dy,yhi=ymax+.08*dy,sx=(x:number)=>L+(x-xmin)/Math.max(dx,1e-12)*(W-L-R),sy=(y:number)=>T+(yhi-y)/Math.max(yhi-ylo,1e-12)*(H-T-B),path=rows.map((r,i)=>`${i?'L':'M'} ${sx(num(r[xKey])).toFixed(1)} ${sy(num(r[yKey])).toFixed(1)}`).join(' ');return <div className="chart-card" data-testid={testId}><div className="chart-title"><b>{title}</b><span>{fmt(xmin,3)} … {fmt(xmax,3)} {xUnit} · {fmt(ymin,3)} … {fmt(ymax,3)} {yUnit}</span></div><svg viewBox={`0 0 ${W} ${H}`} className="react-chart"><line x1={L} y1={T} x2={L} y2={H-B}/><line x1={L} y1={H-B} x2={W-R} y2={H-B}/>{ylo<=0&&yhi>=0&&<line className="zero" x1={L} y1={sy(0)} x2={W-R} y2={sy(0)}/>}<path className="line" d={path}/></svg></div>;
}

export function DynamicsPostprocessPanel({result,onClose}:Props){
  const modal=result?.analysisType==='modal'?result:null,time=result?.analysisType==='time-history'?result:null,spectrum=result?.analysisType==='response-spectrum'?result:null,modes=(result?.modal?.modes||result?.modes||[]) as any[],specRows=(spectrum?.spectrum?.values||[]) as any[];
  return <div className="react-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section data-testid="panel-dynamics-postprocess" className="react-modal wide" role="dialog" aria-modal="true" aria-label="Dinâmica estrutural"><header className="react-modal-head"><div><h2>Dinâmica estrutural · v0.24</h2><p>Modal, história temporal, excitação sísmica de base e espectro de resposta linear-elástico.</p></div><button className="plain-icon" aria-label="Fechar" onClick={onClose}>×</button></header>{!result||(!modal&&!time&&!spectrum)?<div className="empty-state">Execute uma análise Modal, História temporal ou Espectro para visualizar estes resultados.</div>:<>
    <div className="metrics"><div><span>Solver</span><strong>{result.type}</strong></div><div><span>Massa</span><strong>{result.massFormulation}</strong></div><div><span>DOFs livres</span><strong>{result.freeDofs}</strong></div>{modal&&modes[0]&&<><div data-testid="dynamic-first-frequency"><span>f₁</span><strong>{fmt(modes[0].frequencyHz,4)} Hz</strong></div><div><span>T₁</span><strong>{fmt(modes[0].period,5)} s</strong></div></>}{time&&<><div data-testid="dynamic-peak-displacement"><span>|u| pico</span><strong>{fmt(num(time.peakResponse?.absDisplacement)*1000,4)} mm</strong></div><div><span>Δt</span><strong>{fmt(time.newmark?.timeStep,5)} s</strong></div></>}{spectrum&&<><div data-testid="spectrum-pga"><span>PGA</span><strong>{fmt(spectrum.spectrum?.pgaG,4)} g</strong></div><div data-testid="spectrum-combined-displacement"><span>|u| comb.</span><strong>{fmt(1000*num(spectrum.combined?.peakTranslationalDisplacement),4)} mm</strong></div></>}</div>
    <div className="panel-note"><b>Convenção de massa:</b> `material.density` é peso específico em kN/m³ e ρm=γ/g. A v0.24 permanece linear-elástica e não mistura excitação sísmica com as leis plásticas cíclicas quase-estáticas.</div>
    <section className="react-card" data-testid="dynamic-modal-table"><div className="section-title"><h3>Modos próprios</h3><span className="chip">Kφ = ω²Mφ</span></div><div className="table-wrap"><table><thead><tr><th>Modo</th><th>f [Hz]</th><th>T [s]</th><th>ω [rad/s]</th><th>Mef,X</th><th>ΣMef,X</th><th>Mef,Y</th><th>ΣMef,Y</th></tr></thead><tbody>{modes.map((m:any)=><tr key={m.mode}><td>{m.mode}</td><td>{fmt(m.frequencyHz,5)}</td><td>{fmt(m.period,5)}</td><td>{fmt(m.omega,4)}</td><td>{fmt(100*num(m.participation?.effectiveMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioX),2)}%</td><td>{fmt(100*num(m.participation?.effectiveMassRatioY),2)}%</td><td>{fmt(100*num(m.participation?.cumulativeMassRatioY),2)}%</td></tr>)}</tbody></table></div></section>
    {time&&<><PolyChart rows={(time.history||[]).map((r:any)=>({...r,dispMm:1000*num(r.displacement)}))} xKey="t" yKey="dispMm" title="Resposta temporal · deslocamento monitorado" xUnit="s" yUnit="mm" testId="dynamic-time-chart"/>{time.excitation?.baseAcceleration&&<PolyChart rows={time.history||[]} xKey="t" yKey="groundAccelerationG" title="Acelerograma aplicado à base" xUnit="s" yUnit="g" testId="ground-motion-chart"/>}<section className="react-card" data-testid="dynamic-time-summary"><div className="section-title"><h3>Newmark-β + Rayleigh</h3><span className="chip">β={fmt(time.newmark?.beta,2)} · γ={fmt(time.newmark?.gamma,2)}</span></div><div className="metrics"><div><span>Monitor</span><strong>{time.monitor?.nodeId}/{String(time.monitor?.dof||'').toUpperCase()}</strong></div><div><span>Duração</span><strong>{fmt(time.newmark?.duration,4)} s</strong></div><div><span>Passos</span><strong>{time.newmark?.steps}</strong></div><div><span>Amortecimento alvo</span><strong>{fmt(100*num(time.rayleigh?.dampingRatio),2)}%</strong></div><div><span>αM</span><strong>{fmt(time.rayleigh?.alphaM,6)}</strong></div><div><span>βK</span><strong>{fmt(time.rayleigh?.betaK,8)}</strong></div></div><div className="panel-note">Excitação: <b>{time.excitation?.baseAcceleration?`aceleração de base ${String(time.excitation?.direction||'x').toUpperCase()} · PGA ${fmt(time.excitation?.pgaG,4)} g`:'vetor de cargas do cenário × história escalar'}</b>.</div></section></>}
    {spectrum&&<><PolyChart rows={specRows} xKey="period" yKey="saG" title={`Pseudo-espectro Sa · ζ=${fmt(100*spectrum.dampingRatio,2)}%`} xUnit="s" yUnit="g" testId="response-spectrum-chart"/><section className="react-card" data-testid="response-spectrum-summary"><div className="section-title"><h3>Combinação modal · {String(spectrum.combination).toUpperCase()}</h3><span className="chip">{String(spectrum.direction).toUpperCase()} global</span></div><div className="metrics"><div><span>PGA</span><strong>{fmt(spectrum.spectrum?.pgaG,4)} g</strong></div><div><span>ζ</span><strong>{fmt(100*spectrum.dampingRatio,2)}%</strong></div><div><span>Massa efetiva acumulada</span><strong>{fmt(100*spectrum.combined?.cumulativeEffectiveMassRatio,2)}%</strong></div><div><span>|u| combinado</span><strong>{fmt(1000*spectrum.combined?.peakTranslationalDisplacement,4)} mm</strong></div></div><div className="table-wrap"><table><thead><tr><th>Modo</th><th>T [s]</th><th>Γ</th><th>Sd [mm]</th><th>Sv [m/s]</th><th>Sa [g]</th><th>|u| modal máx. [mm]</th></tr></thead><tbody>{(spectrum.modalContributions||[]).map((m:any)=><tr key={m.mode}><td>{m.mode}</td><td>{fmt(m.period,5)}</td><td>{fmt(m.participationFactor,5)}</td><td>{fmt(1000*m.sd,4)}</td><td>{fmt(m.sv,5)}</td><td>{fmt(m.saG,5)}</td><td>{fmt(1000*m.maxModalTranslational,4)}</td></tr>)}</tbody></table></div><div className="panel-note">Sa e Sv são pseudo-ordenadas derivadas de Sd. CQC usa correlação modal para amortecimento uniforme; SRSS permanece disponível para modos bem separados.</div></section></>}
    <section className="react-card"><h3>Limitações v0.24</h3><p>Formulação linear-elástica em frame2d/truss2d com extremidades rígidas. A excitação sísmica usa movimento uniforme da base em X ou Y. Ainda não há múltiplos apoios, componentes simultâneas X+Y, espectro normativo de projeto, combinação direcional normativa, dinâmica geometricamente/materialmente não linear, contato ou amortecimento histerético.</p></section>
  </>}</section></div>;
}
''')

# -----------------------------------------------------------------------------
# Core smoke tests v0.24
# -----------------------------------------------------------------------------
Path('tests/seismic-spectrum-smoke.mjs').write_text(r'''import assert from 'node:assert/strict';
import { assembleDynamicSystem2D, solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D, responseSpectrumFromGroundMotion, cqcCorrelation, newmarkLinearSystem } from '../web/src/solver/dynamics2d.js';

const g=9.80665,L=2,E=200e6,A=.01,gamma=78.5;
const project={nodes:[{id:'N1',x:0,y:0},{id:'N2',x:L,y:0}],elements:[{id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'TR',A,I:0}],materials:[{id:'S',name:'Steel',type:'steel',E,density:gamma,alpha:12e-6,fy:355}],sections:[{id:'TR',name:'Truss',family:'truss',A,I:0}],supports:[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:10,fy:0,mz:0}],elementLoads:[],nodeSprings:[],nodalMasses:[],settlements:[],loadCases:[{id:'LC1',name:'Dynamic',type:'user'}],loadCombinations:[],settings:{activeLoadCaseId:'LC1',analysisScenarioId:'LC1'}};
const gm=[{t:0,accelG:0},{t:.04,accelG:.20},{t:.08,accelG:0},{t:.12,accelG:-.10},{t:.20,accelG:0}];

const modal=solveModal2D(project,{modes:3,massFormulation:'consistent'});assert.equal(modal.solverVersion,'0.24.0-exp');
const th=solveTimeHistory2D(project,'LC1',{massFormulation:'consistent',dampingRatio:.02,rayleighMode1:1,rayleighMode2:1,timeStep:.001,duration:.20,monitorNodeId:'N2',monitorDof:'ux',excitationType:'base-acceleration',groundMotionDirection:'x',groundMotionPoints:gm});
assert.equal(th.excitation.baseAcceleration,true);assert.equal(th.excitation.direction,'x');assert(Math.abs(th.excitation.pgaG-.20)<1e-12);assert(th.peakResponse.absDisplacement>0);assert(th.history.some(r=>Math.abs(r.groundAccelerationG)>.19));
const sys=assembleDynamicSystem2D(project,{massFormulation:'consistent'}),m=sys.Mf[0][0],k=sys.Kf[0][0],ray=th.rayleigh,c=ray.alphaM*m+ray.betaK*k,interp=t=>{for(let i=0;i<gm.length-1;i++){const a=gm[i],b=gm[i+1];if(t>=a.t&&t<=b.t)return (a.accelG+(b.accelG-a.accelG)*(t-a.t)/(b.t-a.t))*g}return 0},eq=newmarkLinearSystem({M:[[m]],C:[[c]],K:[[k]],forceAtTime:t=>[-m*interp(t)],dt:.001,duration:.20});
assert(Math.abs(eq.final.u[0]-th.history.at(-1).displacement)<1e-12,'base excitation must match equivalent inertial force in 1DOF benchmark');

const sp=responseSpectrumFromGroundMotion(gm,{dampingRatio:.05,timeStep:.001,periods:[modal.modes[0].period]});assert.equal(sp.values.length,1);assert(sp.values[0].sd>0);assert(Math.abs(sp.values[0].sa-sp.values[0].omega**2*sp.values[0].sd)<1e-12);assert(Math.abs(sp.pgaG-.20)<1e-12);
assert(Math.abs(cqcCorrelation(10,10,.05)-1)<1e-12);assert(Math.abs(cqcCorrelation(10,20,.05)-cqcCorrelation(20,10,.05))<1e-12);
const srss=solveResponseSpectrum2D(project,{massFormulation:'consistent',modes:3,dampingRatio:.05,timeStep:.001,direction:'x',groundMotionPoints:gm,combination:'srss',periodMin:.01,periodMax:.5,periodCount:30}),cqc=solveResponseSpectrum2D(project,{massFormulation:'consistent',modes:3,dampingRatio:.05,timeStep:.001,direction:'x',groundMotionPoints:gm,combination:'cqc',periodMin:.01,periodMax:.5,periodCount:30});
assert.equal(srss.solverVersion,'0.24.0-exp');assert(srss.combined.peakTranslationalDisplacement>0);assert(Math.abs(srss.combined.peakTranslationalDisplacement-cqc.combined.peakTranslationalDisplacement)<1e-12,'one-mode SRSS and CQC must coincide');assert.equal(srss.modalContributions.length,1);
console.log('v0.24 seismic base-motion / response-spectrum smoke: OK',{pgaG:sp.pgaG,peakTH:th.peakResponse.absDisplacement,peakSpectrum:srss.combined.peakTranslationalDisplacement});
''')

# -----------------------------------------------------------------------------
# E2E: update v0.23 wording and add seismic/spectrum workflow.
# -----------------------------------------------------------------------------
p=Path('tests/e2e/dynamics.spec.ts');s=p.read_text().replace('Dinâmica estrutural · v0.23','Dinâmica estrutural · v0.24').replace("await expect(timePost).toContainText('Aceleração de base ainda não está implementada');", "await expect(timePost).toContainText('vetor de cargas do cenário');")
p.write_text(s)
Path('tests/e2e/seismic-spectrum.spec.ts').write_text(r'''import { expect, test, type Page } from '@playwright/test';
async function openCommand(page:Page,label:string){const width=page.viewportSize()?.width||1280;if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return}const direct=page.locator(`button[aria-label="${label}"]:visible`).first();if(await direct.isVisible().catch(()=>false)){await direct.click();return}const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click()}
async function install(page:Page){await page.goto('./');await page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');const p=JSON.parse(raw);p.name='E2E — seismic v0.24';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'TR',A:.01,I:0}];p.materials=[{id:'S',name:'Steel',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355}];p.sections=[{id:'TR',name:'Truss',family:'truss',A:.01,I:0}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[];p.elementLoads=[];p.nodeSprings=[];p.nodalMasses=[];p.settlements=[];p.loadCases=[{id:'LC1',name:'Seismic',type:'user'}];p.loadCombinations=[];p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',dynamicMassFormulation:'consistent',modalModes:3,dynamicDampingRatio:.05,dynamicRayleighMode1:1,dynamicRayleighMode2:1,dynamicTimeStep:.001,dynamicDuration:.20,dynamicMonitorNodeId:'N2',dynamicMonitorDof:'ux',dynamicExcitationType:'base-acceleration',dynamicGroundMotionDirection:'x',dynamicGroundMotionPoints:[{t:0,accelG:0},{t:.04,accelG:.2},{t:.08,accelG:0},{t:.12,accelG:-.1},{t:.2,accelG:0}],responseSpectrumCombination:'cqc',responseSpectrumPeriodMin:.01,responseSpectrumPeriodMax:.5,responseSpectrumPeriodPoints:30,imperfection:{...(p.settings?.imperfection||{}),enabled:false}};localStorage.setItem('astrastruct.project',JSON.stringify(p))});await page.reload()}

test('v0.24 base acceleration and response spectrum workflow',async({page})=>{await install(page);await openCommand(page,'Tipo de análise');await page.getByTestId('analysis-time-history').click();await page.getByTestId('dynamic-excitation-type').selectOption('base-acceleration');await page.getByTestId('ground-motion-direction').selectOption('x');await page.getByTestId('ground-motion-points').fill('0:0, 0.04:0.20, 0.08:0, 0.12:-0.10, 0.20:0');await page.getByTestId('dynamic-time-step').fill('0.001');await page.getByTestId('dynamic-duration').fill('0.20');await page.getByTestId('dynamic-monitor-node').selectOption('N2');await page.getByTestId('dynamic-monitor-dof').selectOption('ux');await page.getByTestId('analysis-apply').click();await page.getByTestId('analyze-button').click();await expect(page.getByTestId('dynamic-results-time')).toContainText('N2/UX');await openCommand(page,'Diagramas/envelopes');await expect(page.getByTestId('ground-motion-chart')).toBeVisible();await expect(page.getByTestId('dynamic-time-summary')).toContainText('PGA 0.2000 g');await page.getByTestId('panel-dynamics-postprocess').locator('button[aria-label="Fechar"]').click();
await openCommand(page,'Tipo de análise');await page.getByTestId('analysis-response-spectrum').click();await page.getByTestId('spectrum-direction').selectOption('x');await page.getByTestId('spectrum-combination').selectOption('cqc');await page.getByTestId('spectrum-period-min').fill('0.01');await page.getByTestId('spectrum-period-max').fill('0.5');await page.getByTestId('spectrum-period-points').fill('30');await page.getByTestId('spectrum-time-step').fill('0.001');await page.getByTestId('spectrum-ground-motion-points').fill('0:0, 0.04:0.20, 0.08:0, 0.12:-0.10, 0.20:0');await page.getByTestId('analysis-apply').click();await page.getByTestId('analyze-button').click();await expect(page.getByTestId('dynamic-results-spectrum')).toContainText('CQC');await expect(page.getByTestId('dynamic-results-spectrum')).toContainText('0.2000 g');await openCommand(page,'Diagramas/envelopes');await expect(page.getByTestId('response-spectrum-chart')).toBeVisible();await expect(page.getByTestId('response-spectrum-summary')).toContainText('CQC');await expect(page.getByTestId('response-spectrum-summary')).toContainText('Sd [mm]');await expect(page.locator('[role="alert"]')).toHaveCount(0)});
''')

# -----------------------------------------------------------------------------
# package, docs, README
# -----------------------------------------------------------------------------
p=Path('package.json');s=p.read_text();s=s.replace('node tests/dynamics-smoke.mjs\",','node tests/dynamics-smoke.mjs && node tests/seismic-spectrum-smoke.mjs\",');p.write_text(s)
Path('docs/seismic-spectrum-v024.md').write_text(r'''# AstraStruct v0.24 — excitação sísmica e espectro de resposta

## Escopo
A v0.24 amplia o núcleo dinâmico linear-elástico da v0.23 com movimento uniforme da base e análise modal por espectro derivado de um acelerograma. A formulação continua restrita a modelos `frame2d`/`truss2d` compatíveis com o núcleo modal.

## Excitação de base
Para coordenadas relativas, a equação é

`M u¨ + C u˙ + K u = -M r a_g(t)`

onde `r` é o vetor de influência da direção global X ou Y. O acelerograma é informado em `g` e convertido internamente por `g0 = 9.80665 m/s²`. A integração usa Newmark average-acceleration (`β=1/4`, `γ=1/2`) e amortecimento de Rayleigh.

O registro deve iniciar em `t=0` com aceleração zero nesta versão. A interface aceita pares `t:a[g]` e arquivo CSV de duas colunas `tempo, aceleração[g]`.

## Espectro do acelerograma
Para cada período `T`, resolve-se um oscilador SDOF unitário:

`z¨ + 2 ξ ω z˙ + ω² z = -a_g(t)`

com `ω=2π/T`. A ordenada primária é `Sd=max|z|`; a v0.24 reporta os pseudo-espectros

`Sv = ω Sd`

`Sa = ω² Sd`.

`Sa/g0` é mostrado em `g`. O PGA é obtido diretamente do registro e não deve ser confundido com `Sa(T)`.

## Resposta modal estrutural
Os modos são normalizados por massa. Na direção selecionada, cada modo usa o fator de participação `Γ_i` e a demanda espectral no período modal:

`q_i,max = Γ_i Sd(T_i)`.

A contribuição nodal do modo é `u_i = φ_i q_i,max`.

## SRSS e CQC
SRSS usa

`R = sqrt(Σ R_i²)`.

Para CQC com amortecimento modal uniforme, a correlação entre modos `i,j` é

`ρ_ij = 8 ξ² (1+r) r^(3/2) / [(1-r²)² + 4 ξ² r (1+r)²]`,

com `r=min(ω_i,ω_j)/max(ω_i,ω_j)`, e

`R = sqrt(Σ_i Σ_j ρ_ij R_i R_j)`.

CQC é preferível quando há frequências próximas; SRSS é mantido para modos suficientemente separados.

## Validação automática
- equivalência entre movimento de base de um sistema 1DOF e a força inercial `-M r a_g`;
- coerência `Sa=ω²Sd` e `Sv=ωSd`;
- simetria e identidade diagonal do coeficiente CQC;
- coincidência SRSS=CQC em benchmark com um único modo participante;
- regressão completa dos testes v0.11–v0.23;
- E2E do fluxo aceleração de base → pós-processamento → espectro → CQC.

## Limitações
Ainda não estão implementados: espectros normativos de projeto, múltiplos apoios/movimento diferencial, componentes simultâneas X+Y, combinação direcional normativa, correção/baseline/filtering do acelerograma, análise dinâmica não linear, amortecimento histerético, contato e interação solo-estrutura dinâmica. O usuário deve preparar e validar o acelerograma antes da importação.
''')
p=Path('README.md');s=p.read_text();s=s.replace('> **v0.23 experimental:** fundação de dinâmica estrutural linear com massas consistente/concentrada, análise modal, participação de massa, amortecimento de Rayleigh e integração temporal Newmark-β.','> **v0.24 experimental:** dinâmica estrutural linear com análise modal, Newmark-β/Rayleigh, aceleração sísmica uniforme de base, pseudo-espectros Sa/Sv/Sd e combinação modal SRSS/CQC.').replace('> **Estado atual — v0.23.0 experimental:**','> **Estado atual — v0.24.0 experimental:**').replace('- documentação do núcleo dinâmico em `docs/structural-dynamics-v023.md`;','- documentação do núcleo dinâmico em `docs/structural-dynamics-v023.md`;\n- **excitação sísmica de base e análise espectral v0.24**, com importação CSV de acelerograma, resposta relativa por `-Mr a_g(t)`, pseudo-espectros Sa/Sv/Sd e combinação modal SRSS/CQC;\n- documentação metodológica sísmica em `docs/seismic-spectrum-v024.md`;');p.write_text(s)
