import { emptyProject, normalizeProject } from './model.js';

const EPS=1e-9;
const sumSpans=spans=>{const out=[0];for(const s of spans)out.push(out[out.length-1]+Number(s));return out};
const positiveList=(raw,fallback)=>{const a=(Array.isArray(raw)?raw:String(raw??'').split(/[,;\s]+/)).map(Number).filter(v=>Number.isFinite(v)&&v>EPS);return a.length?a:fallback};
const fixed3d=nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true});
const load3d=(id,caseId,nodeId,{fx=0,fy=0,fz=0,mx=0,my=0,mz=0}={})=>({id,caseId,nodeId,fx,fy,fz,mx,my,mz});
const storeyLevels=(count,height)=>Array.from({length:count+1},(_,k)=>({id:`L${k}`,name:k===0?'Base':`Pavimento ${k}`,elevation:k*height,index:k}));
function ensureSections(p,sections){for(const s of sections)if(!p.sections.some(x=>x.id===s.id))p.sections.push(s)}
function frame(id,n1,n2,{materialId='steel355',sectionId='steel_space_demo',label=id,orientation}={}){return{id,type:'frame3d',n1,n2,materialId,sectionId,label,...(orientation?{orientation}:{})}}
function slabPanel(id,nodeIds,{materialId='concrete30',thickness=.15,label=id,levelId=null}={}){return{id,type:'shell4',nodeIds:[...nodeIds],n1:nodeIds[0],n2:nodeIds[1],n3:nodeIds[2],n4:nodeIds[3],materialId,thickness,label,role:'slab',levelId,visualCategory:'slab-panel'}}

export function createGridBuilding3D({name='Edifício paramétrico 3D',xSpans=[5,5,5],ySpans=[4,4],storeys=5,storeyHeight=3,floorLoadPerNode=-18,includeSlabs=true,slabThickness=.15}={}){
  const xs=sumSpans(positiveList(xSpans,[5,5,5])),ys=sumSpans(positiveList(ySpans,[4,4])),nStoreys=Math.max(1,Math.min(30,Math.round(Number(storeys)||5))),h=Math.max(.5,Number(storeyHeight)||3),tSlab=Math.max(.06,Math.min(.60,Number(slabThickness)||.15));
  const p=emptyProject();p.name=name;p.levels=storeyLevels(nStoreys,h);
  ensureSections(p,[
    {id:'rc3d_col_demo',name:'RC 40×60 cm · demonstrativa 3D',family:'rect3d',b:.40,h:.60,A:.24,Iy:.0072,Iz:.0032,J:.0040,I:.0072},
    {id:'rc3d_beam_demo',name:'RC 30×60 cm · demonstrativa 3D',family:'rect3d',b:.30,h:.60,A:.18,Iy:.0054,Iz:.00135,J:.0016,I:.0054},
    {id:'rc3d_slab_demo',name:'RC laje maciça · demonstrativa 3D',family:'slab',thickness:tSlab,t:tSlab}
  ]);
  const nodeId=(ix,iy,k)=>`N_${ix}_${iy}_${k}`;p.nodes=[];p.elements=[];p.supports=[];p.loads=[];
  for(let k=0;k<=nStoreys;k++)for(let iy=0;iy<ys.length;iy++)for(let ix=0;ix<xs.length;ix++)p.nodes.push({id:nodeId(ix,iy,k),x:xs[ix],y:ys[iy],z:k*h,levelId:`L${k}`});
  let eid=1,sid=1;
  for(let iy=0;iy<ys.length;iy++)for(let ix=0;ix<xs.length;ix++){
    p.supports.push(fixed3d(nodeId(ix,iy,0)));
    for(let k=0;k<nStoreys;k++)p.elements.push(frame(`C${eid++}`,nodeId(ix,iy,k),nodeId(ix,iy,k+1),{materialId:'concrete30',sectionId:'rc3d_col_demo',label:`Pilar ${ix+1}-${iy+1} · P${k+1}`}));
  }
  for(let k=1;k<=nStoreys;k++){
    for(let iy=0;iy<ys.length;iy++)for(let ix=0;ix<xs.length-1;ix++)p.elements.push(frame(`B${eid++}`,nodeId(ix,iy,k),nodeId(ix+1,iy,k),{materialId:'concrete30',sectionId:'rc3d_beam_demo',label:`Viga X · P${k}`}));
    for(let ix=0;ix<xs.length;ix++)for(let iy=0;iy<ys.length-1;iy++)p.elements.push(frame(`B${eid++}`,nodeId(ix,iy,k),nodeId(ix,iy+1,k),{materialId:'concrete30',sectionId:'rc3d_beam_demo',label:`Viga Y · P${k}`,orientation:{up:[0,0,1]}}));
    if(includeSlabs)for(let iy=0;iy<ys.length-1;iy++)for(let ix=0;ix<xs.length-1;ix++)p.elements.push(slabPanel(`S${sid++}`,[nodeId(ix,iy,k),nodeId(ix+1,iy,k),nodeId(ix+1,iy+1,k),nodeId(ix,iy+1,k)],{thickness:tSlab,levelId:`L${k}`,label:`Laje ${ix+1}-${iy+1} · P${k}`}));
    if(Math.abs(Number(floorLoadPerNode)||0)>EPS)for(let iy=0;iy<ys.length;iy++)for(let ix=0;ix<xs.length;ix++)p.loads.push(load3d(`G_${ix}_${iy}_${k}`,'LC1',nodeId(ix,iy,k),{fz:Number(floorLoadPerNode)}));
  }
  const slabCount=includeSlabs?(xs.length-1)*(ys.length-1)*nStoreys:0;
  p.loadCases=[{id:'LC1',name:'Gravidade demonstrativa',type:'permanent'}];p.loadCombinations=[];p.settings.analysisType='linear';p.settings.activeLoadCaseId='LC1';p.settings.analysisScenarioId='LC1';
  p.meta={...(p.meta||{}),exampleKind:'building-grid',storeys:nStoreys,storeyHeight:h,slabPanels:slabCount,slabThickness:tSlab,slabAnalysis:'shell4',floorLoadRepresentation:'nodal-compatible',exampleNote:'Modelo demonstrativo com vigas, pilares e lajes shell4. A carga de pavimento permanece nodal nesta revisão para compatibilidade; seções e ações devem ser verificadas pelo projetista.'};return normalizeProject(p);
}

export function createPlanBuilding3D({name='Edifício por traçado de planta',planNodes=[],planEdges=[],storeys=3,storeyHeight=3,floorLoadPerNode=-12}={}){
  const cleanNodes=(planNodes||[]).map((n,i)=>({id:String(n.id||`P${i+1}`),x:Number(n.x)||0,y:Number(n.y)||0}));if(cleanNodes.length<2)throw new Error('A planta precisa de pelo menos dois nós.');
  const ids=new Set(cleanNodes.map(n=>n.id)),edges=(planEdges||[]).map((e,i)=>({id:String(e.id||`L${i+1}`),n1:String(e.n1),n2:String(e.n2)})).filter(e=>ids.has(e.n1)&&ids.has(e.n2)&&e.n1!==e.n2);if(!edges.length)throw new Error('A planta precisa de pelo menos uma linha/viga.');
  const nStoreys=Math.max(1,Math.min(30,Math.round(Number(storeys)||3))),h=Math.max(.5,Number(storeyHeight)||3),p=emptyProject();p.name=name;p.levels=storeyLevels(nStoreys,h);
  ensureSections(p,[{id:'rc3d_col_demo',name:'RC 40×60 cm · demonstrativa 3D',family:'rect3d',b:.40,h:.60,A:.24,Iy:.0072,Iz:.0032,J:.0040,I:.0072},{id:'rc3d_beam_demo',name:'RC 30×60 cm · demonstrativa 3D',family:'rect3d',b:.30,h:.60,A:.18,Iy:.0054,Iz:.00135,J:.0016,I:.0054}]);
  const nid=(id,k)=>`${id}_Z${k}`;p.nodes=[];p.elements=[];p.supports=[];p.loads=[];let eid=1;
  for(let k=0;k<=nStoreys;k++)for(const n of cleanNodes)p.nodes.push({id:nid(n.id,k),x:n.x,y:n.y,z:k*h,levelId:`L${k}`});
  for(const n of cleanNodes){p.supports.push(fixed3d(nid(n.id,0)));for(let k=0;k<nStoreys;k++)p.elements.push(frame(`C${eid++}`,nid(n.id,k),nid(n.id,k+1),{materialId:'concrete30',sectionId:'rc3d_col_demo',label:`Pilar ${n.id} · P${k+1}`}))}
  for(let k=1;k<=nStoreys;k++){for(const e of edges)p.elements.push(frame(`B${eid++}`,nid(e.n1,k),nid(e.n2,k),{materialId:'concrete30',sectionId:'rc3d_beam_demo',label:`${e.id} · P${k}`}));if(Math.abs(Number(floorLoadPerNode)||0)>EPS)for(const n of cleanNodes)p.loads.push(load3d(`G_${n.id}_${k}`,'LC1',nid(n.id,k),{fz:Number(floorLoadPerNode)}))}
  p.loadCases=[{id:'LC1',name:'Gravidade demonstrativa',type:'permanent'}];p.loadCombinations=[];p.settings.analysisType='linear';p.settings.analysisScenarioId='LC1';p.settings.activeLoadCaseId='LC1';p.meta={...(p.meta||{}),exampleKind:'building-plan',storeys:nStoreys,storeyHeight:h,plan:{nodes:cleanNodes,edges},exampleNote:'Gerado a partir de traçado 2D extrudado por pavimentos.'};return normalizeProject(p);
}

export function demoFiveStoreyBuilding3D(){return createGridBuilding3D({name:'Exemplo · edifício RC de 5 pavimentos',xSpans:[5,5,5],ySpans:[4,4],storeys:5,storeyHeight:3,floorLoadPerNode:-20,includeSlabs:true,slabThickness:.15})}

export function demoSteelWarehouse3D(){
  const p=emptyProject();p.name='Exemplo · galpão metálico 3D';ensureSections(p,[{id:'steel3d_portal_demo',name:'Aço · pórtico de galpão demonstrativo',family:'steel3d',A:.018,Iy:.00075,Iz:.00115,J:.00008,I:.00115},{id:'steel3d_tie_demo',name:'Aço · travamento demonstrativo',family:'steel3d',A:.008,Iy:.00008,Iz:.00008,J:.00002,I:.00008}]);
  const bays=5,dx=6,span=20,eave=6,ridge=8;const n=(i,side)=>`N_${i}_${side}`;p.nodes=[];p.elements=[];p.supports=[];p.loads=[];let eid=1;
  for(let i=0;i<=bays;i++){const x=i*dx;p.nodes.push({id:n(i,'L0'),x,y:0,z:0},{id:n(i,'R0'),x,y:span,z:0},{id:n(i,'LE'),x,y:0,z:eave},{id:n(i,'RE'),x,y:span,z:eave},{id:n(i,'RG'),x,y:span/2,z:ridge});p.supports.push(fixed3d(n(i,'L0')),fixed3d(n(i,'R0')));p.elements.push(frame(`P${eid++}`,n(i,'L0'),n(i,'LE'),{sectionId:'steel3d_portal_demo',label:`Pilar E · eixo ${i+1}`}),frame(`P${eid++}`,n(i,'R0'),n(i,'RE'),{sectionId:'steel3d_portal_demo',label:`Pilar D · eixo ${i+1}`}),frame(`R${eid++}`,n(i,'LE'),n(i,'RG'),{sectionId:'steel3d_portal_demo',label:`Rafter E · eixo ${i+1}`}),frame(`R${eid++}`,n(i,'RG'),n(i,'RE'),{sectionId:'steel3d_portal_demo',label:`Rafter D · eixo ${i+1}`}));p.loads.push(load3d(`W${i}`,'LC1',n(i,'RG'),{fy:4,fz:-12}))}
  for(let i=0;i<bays;i++)for(const side of ['LE','RE','RG'])p.elements.push(frame(`L${eid++}`,n(i,side),n(i+1,side),{sectionId:'steel3d_tie_demo',label:`Longitudinal ${side}`}));
  p.loadCases=[{id:'LC1',name:'Cobertura + vento demonstrativos',type:'user'}];p.loadCombinations=[];p.settings.analysisType='linear';p.settings.analysisScenarioId='LC1';p.settings.activeLoadCaseId='LC1';p.meta={...(p.meta||{}),exampleKind:'steel-warehouse',exampleNote:'Geometria demonstrativa de galpão; não representa dimensionamento normativo.'};return normalizeProject(p);
}

export function demoWaterTank3D(){
  const p=emptyProject();p.name='Exemplo · reservatório elevado de água';ensureSections(p,[{id:'rc3d_tank_col_demo',name:'RC · coluna reservatório demonstrativa',family:'rect3d',A:.30,Iy:.010,Iz:.010,J:.006,I:.010},{id:'rc3d_tank_ring_demo',name:'RC · anel reservatório demonstrativo',family:'rect3d',A:.20,Iy:.004,Iz:.004,J:.0025,I:.004}]);
  const m=8,r=4,zRing=7,zTop=10;const base=i=>`B${i}`,ring=i=>`R${i}`,top=i=>`T${i}`;p.nodes=[];p.elements=[];p.supports=[];p.loads=[];let eid=1;
  for(let i=0;i<m;i++){const a=2*Math.PI*i/m,x=r*Math.cos(a),y=r*Math.sin(a);p.nodes.push({id:base(i),x,y,z:0},{id:ring(i),x,y,z:zRing},{id:top(i),x,y,z:zTop});p.supports.push(fixed3d(base(i)));p.elements.push(frame(`C${eid++}`,base(i),ring(i),{materialId:'concrete30',sectionId:'rc3d_tank_col_demo',label:`Coluna ${i+1}`}),frame(`W${eid++}`,ring(i),top(i),{materialId:'concrete30',sectionId:'rc3d_tank_ring_demo',label:`Montante cuba ${i+1}`}));p.loads.push(load3d(`H${i}`,'LC1',ring(i),{fz:-35}))}
  for(let i=0;i<m;i++){const j=(i+1)%m;p.elements.push(frame(`A${eid++}`,ring(i),ring(j),{materialId:'concrete30',sectionId:'rc3d_tank_ring_demo',label:'Anel inferior'}),frame(`A${eid++}`,top(i),top(j),{materialId:'concrete30',sectionId:'rc3d_tank_ring_demo',label:'Anel superior'}))}
  p.loadCases=[{id:'LC1',name:'Peso da água equivalente · demonstrativo',type:'permanent'}];p.loadCombinations=[];p.settings.analysisType='linear';p.settings.analysisScenarioId='LC1';p.settings.activeLoadCaseId='LC1';p.meta={...(p.meta||{}),exampleKind:'elevated-water-tank',exampleNote:'Modelo de barras para estudo global. Pressão hidrostática de casca não é representada nesta versão.'};return normalizeProject(p);
}

export function demoIsolatedBeamLab3D(){const p=emptyProject();p.name='Lab · viga isolada 3D';p.nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:6,y:0,z:0}];p.elements=[frame('E1','N1','N2',{sectionId:'steel_space_demo',label:'Viga isolada'})];p.supports=[fixed3d('N1')];p.loads=[load3d('L1','LC1','N2',{fz:-10})];p.settings.analysisType='corotational';p.meta={...(p.meta||{}),labKind:'isolated-beam'};return normalizeProject(p)}
export function demoIsolatedColumnLab3D(){const p=emptyProject();p.name='Lab · coluna isolada 3D';p.nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:4}];p.elements=[frame('E1','N1','N2',{sectionId:'steel_space_demo',label:'Coluna isolada'})];p.supports=[fixed3d('N1')];p.loads=[load3d('L1','LC1','N2',{fx:2,fz:-80})];p.settings.analysisType='pdelta';p.meta={...(p.meta||{}),labKind:'isolated-column'};return normalizeProject(p)}
export function demoSpringLab3D(){const p=demoIsolatedBeamLab3D();p.name='Lab · elemento + mola nodal 3D';p.nodeSprings=[{id:'SPR1',nodeId:'N2',kz:2500,kry:800}];p.settings.analysisType='corotational';p.meta={...(p.meta||{}),labKind:'spring-node'};return normalizeProject(p)}
