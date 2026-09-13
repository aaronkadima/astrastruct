import {rectangleSectionProperties,iSectionProperties,rhsSectionProperties,polygonSectionProperties} from './geometry.js';
import {rectangularFiberGrid,iSectionFiberGrid,rhsFiberGrid,polygonFiberGrid,discreteFiber,subtractDiscreteAreas,fiberGeometryProperties} from './fibers.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SectionBuilder: ${name} deve ser finito.`);return n};
const requireMaterial=(material,label)=>{if(!material?.id)throw new Error(`SectionBuilder: ${label} deve possuir id.`);return material};

function definition({id='section',kind='fiber',family='arbitrary',geometry,fibers,materials,metadata={}}){
  const rows=Array.from(fibers||[]);if(!rows.length)throw new Error('SectionBuilder: seção sem fibras.');const mats=Array.from(materials||[]);if(!mats.length)throw new Error('SectionBuilder: seção sem materiais.');
  const ids=new Set(mats.map(m=>m.id));for(const fiber of rows)if(!ids.has(fiber.materialId))throw new Error(`SectionBuilder: material ${fiber.materialId} da fibra ${fiber.id} não pertence à seção.`);
  return{contract:'section-definition/v1',id:String(id),kind,family,geometry,discreteGeometry:fiberGeometryProperties(rows),fibers:rows,materials:mats,metadata:{...metadata}};
}

export function createSteelSection({id='steel-section',family='rect',material,width,height,webThickness,flangeThickness,thickness,vertices,ny=12,nz=16}={}){
  const mat=requireMaterial(material,'material de aço'),f=String(family||'rect').toLowerCase();let geometry,fibers;
  if(['rect','rectangle'].includes(f)){geometry=rectangleSectionProperties({width,height});fibers=rectangularFiberGrid({width,height,ny,nz,materialId:mat.id,region:'steel'})}
  else if(['i','h','i/h'].includes(f)){geometry=iSectionProperties({height,width,webThickness,flangeThickness});fibers=iSectionFiberGrid({height,width,webThickness,flangeThickness,ny,nz,materialId:mat.id})}
  else if(['rhs','box','hss'].includes(f)){geometry=rhsSectionProperties({height,width,thickness});fibers=rhsFiberGrid({height,width,thickness,ny,nz,materialId:mat.id})}
  else if(f==='polygon'||f==='arbitrary'){geometry=polygonSectionProperties(vertices);fibers=polygonFiberGrid({vertices,ny,nz,materialId:mat.id,region:'steel-polygon'})}
  else throw new Error(`SectionBuilder: família de aço não suportada ${family}.`);
  return definition({id,kind:'steel',family:f,geometry,fibers,materials:[mat]});
}

export function createRCSection({id='rc-section',width,height,concreteMaterial,rebarMaterial,bars=[],ny=12,nz=16,subtractRebar=true}={}){
  const concrete=requireMaterial(concreteMaterial,'concreto'),rebar=requireMaterial(rebarMaterial,'armadura'),geometry=rectangleSectionProperties({width,height});let matrix=rectangularFiberGrid({width,height,ny,nz,materialId:concrete.id,region:'concrete'});
  const steelFibers=Array.from(bars||[]).map((bar,index)=>{
    const area=bar.area!=null?finite(`bars[${index}].area`,bar.area):Math.PI*finite(`bars[${index}].diameter`,bar.diameter)**2/4;
    return discreteFiber({id:bar.id||`bar-${index+1}`,y:bar.y,z:bar.z,area,materialId:rebar.id,region:'rebar'});
  });
  if(subtractRebar&&steelFibers.length)matrix=subtractDiscreteAreas(matrix,steelFibers,{materialId:concrete.id});
  return definition({id,kind:'rc',family:'rect-rc',geometry,fibers:[...matrix,...steelFibers],materials:[concrete,rebar],metadata:{grossArea:geometry.area,rebarArea:steelFibers.reduce((s,f)=>s+f.area,0),subtractRebar:!!subtractRebar}});
}

function regionFibers(region,index){
  const material=requireMaterial(region.material,`material da região ${index+1}`),shape=String(region.shape||'rect').toLowerCase(),common={materialId:material.id,region:region.id||`region-${index+1}`};let fibers,geometry;
  if(shape==='rect'||shape==='rectangle'){
    geometry=rectangleSectionProperties({width:region.width,height:region.height,cy:region.cy||0,cz:region.cz||0});fibers=rectangularFiberGrid({width:region.width,height:region.height,ny:region.ny||8,nz:region.nz||8,cy:region.cy||0,cz:region.cz||0,...common});
  }else if(shape==='polygon'){
    geometry=polygonSectionProperties(region.vertices);fibers=polygonFiberGrid({vertices:region.vertices,ny:region.ny||20,nz:region.nz||20,...common});
  }else throw new Error(`SectionBuilder: shape composto não suportado ${region.shape}.`);
  return{material,geometry,fibers};
}

export function createCompositeSection({id='composite-section',regions=[],discrete=[]}={}){
  const built=Array.from(regions||[]).map(regionFibers),materials=[],materialIds=new Set(),fibers=[];
  for(const row of built){if(!materialIds.has(row.material.id)){materials.push(row.material);materialIds.add(row.material.id)}fibers.push(...row.fibers)}
  for(let i=0;i<(discrete||[]).length;i++){
    const item=discrete[i],material=requireMaterial(item.material,`material discreto ${i+1}`);if(!materialIds.has(material.id)){materials.push(material);materialIds.add(material.id)}
    fibers.push(discreteFiber({id:item.id||`discrete-${i+1}`,y:item.y,z:item.z,area:item.area,materialId:material.id,region:item.region||'discrete'}));
  }
  if(!fibers.length)throw new Error('SectionBuilder: seção composta sem regiões/fibras.');return definition({id,kind:'composite',family:'composite-fiber',geometry:fiberGeometryProperties(fibers),fibers,materials,metadata:{regionCount:built.length,discreteCount:(discrete||[]).length}});
}

export function createArbitraryFiberSection({id='fiber-section',fibers,materials,metadata={}}={}){
  return definition({id,kind:'fiber',family:'arbitrary-fiber',geometry:fiberGeometryProperties(fibers),fibers,materials,metadata});
}
