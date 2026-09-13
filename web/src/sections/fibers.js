import {pointInPolygon,polygonSectionProperties} from './geometry.js';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SectionFibers: ${name} deve ser finito.`);return n};
const count=(name,value,min=1,max=200)=>{const n=Math.round(finite(name,value));if(n<min||n>max)throw new Error(`SectionFibers: ${name} deve estar entre ${min} e ${max}.`);return n};

export function rectangularFiberGrid({width,height,ny=8,nz=8,cy=0,cz=0,materialId='material',region='rect'}={}){
  const b=finite('width',width),h=finite('height',height),nY=count('ny',ny),nZ=count('nz',nz),yc=finite('cy',cy),zc=finite('cz',cz);if(!(b>0&&h>0))throw new Error('SectionFibers: width e height devem ser positivos.');
  const dy=b/nY,dz=h/nZ,area=dy*dz,IyLocal=dy*dz**3/12,IzLocal=dz*dy**3/12,fibers=[];
  for(let iz=0;iz<nZ;iz++)for(let iy=0;iy<nY;iy++)fibers.push({id:`${region}-${iy}-${iz}`,y:yc-b/2+(iy+.5)*dy,z:zc-h/2+(iz+.5)*dz,area,materialId,region,sizeY:dy,sizeZ:dz,IyLocal,IzLocal,IyzLocal:0});
  return fibers;
}

export function iSectionFiberGrid({height,width,webThickness,flangeThickness,ny=12,nz=16,materialId='steel'}={}){
  const h=finite('height',height),b=finite('width',width),tw=finite('webThickness',webThickness),tf=finite('flangeThickness',flangeThickness),nY=count('ny',ny,2),nZ=count('nz',nz,4);if(!(h>0&&b>0&&tw>0&&tf>0&&2*tf<h&&tw<=b))throw new Error('SectionFibers: geometria I/H inválida.');
  const flangeNz=Math.max(1,Math.round(nZ*tf/h)),webNz=Math.max(2,nZ-2*flangeNz),webNy=Math.max(1,Math.round(nY*tw/b));
  return[
    ...rectangularFiberGrid({width:b,height:tf,ny:nY,nz:flangeNz,cz:-(h-tf)/2,materialId,region:'flange-bottom'}),
    ...rectangularFiberGrid({width:tw,height:h-2*tf,ny:webNy,nz:webNz,materialId,region:'web'}),
    ...rectangularFiberGrid({width:b,height:tf,ny:nY,nz:flangeNz,cz:(h-tf)/2,materialId,region:'flange-top'})
  ];
}

export function rhsFiberGrid({height,width,thickness,ny=12,nz=16,materialId='steel'}={}){
  const h=finite('height',height),b=finite('width',width),t=finite('thickness',thickness),nY=count('ny',ny,2),nZ=count('nz',nz,4);if(!(h>0&&b>0&&t>0&&2*t<h&&2*t<b))throw new Error('SectionFibers: geometria RHS inválida.');
  const wallNy=Math.max(1,Math.round(nY*t/b)),wallNz=Math.max(1,Math.round(nZ*t/h)),sideNz=Math.max(2,nZ-2*wallNz);
  return[
    ...rectangularFiberGrid({width:b,height:t,ny:nY,nz:wallNz,cz:-(h-t)/2,materialId,region:'wall-bottom'}),
    ...rectangularFiberGrid({width:t,height:h-2*t,ny:wallNy,nz:sideNz,cy:-(b-t)/2,materialId,region:'wall-left'}),
    ...rectangularFiberGrid({width:t,height:h-2*t,ny:wallNy,nz:sideNz,cy:(b-t)/2,materialId,region:'wall-right'}),
    ...rectangularFiberGrid({width:b,height:t,ny:nY,nz:wallNz,cz:(h-t)/2,materialId,region:'wall-top'})
  ];
}

export function polygonFiberGrid({vertices,ny=20,nz=20,materialId='material',region='polygon'}={}){
  const props=polygonSectionProperties(vertices),nY=count('ny',ny,2),nZ=count('nz',nz,2),{yMin,yMax,zMin,zMax}=props.bounds,dy=(yMax-yMin)/nY,dz=(zMax-zMin)/nZ,area=dy*dz,IyLocal=dy*dz**3/12,IzLocal=dz*dy**3/12,fibers=[];
  for(let iz=0;iz<nZ;iz++)for(let iy=0;iy<nY;iy++){
    const y=yMin+(iy+.5)*dy,z=zMin+(iz+.5)*dz;if(pointInPolygon(y,z,vertices))fibers.push({id:`${region}-${iy}-${iz}`,y,z,area,materialId,region,sizeY:dy,sizeZ:dz,IyLocal,IzLocal,IyzLocal:0});
  }
  if(!fibers.length)throw new Error('SectionFibers: discretização poligonal não gerou fibras.');return fibers;
}

export function discreteFiber({y,z,area,materialId='material',region='discrete',id=null}={}){
  const a=finite('area',area);if(!(a>0))throw new Error('SectionFibers: área discreta deve ser positiva.');return{id:id||`${region}-${y}-${z}`,y:finite('y',y),z:finite('z',z),area:a,materialId,region,IyLocal:0,IzLocal:0,IyzLocal:0,discrete:true};
}

export function subtractDiscreteAreas(matrixFibers,discreteFibers,{materialId=null}={}){
  const fibers=matrixFibers.map(f=>({...f}));
  for(const bar of discreteFibers){
    let remaining=Number(bar.area)||0;if(!(remaining>0))continue;
    const candidates=fibers.map((fiber,index)=>({index,d2:(fiber.y-bar.y)**2+(fiber.z-bar.z)**2})).sort((a,b)=>a.d2-b.d2);
    for(const candidate of candidates){
      if(remaining<=1e-15)break;const fiber=fibers[candidate.index];if(materialId&&fiber.materialId!==materialId)continue;const take=Math.min(fiber.area,remaining);fiber.area-=take;remaining-=take;
    }
    if(remaining>1e-12*Math.max(1,bar.area))throw new Error(`SectionFibers: área discreta ${bar.id||''} excede matriz disponível para subtração.`);
  }
  return fibers.filter(f=>f.area>1e-15);
}

export function fiberGeometryProperties(fibers){
  const rows=Array.from(fibers||[]);if(!rows.length)throw new Error('SectionFibers: lista vazia.');const area=rows.reduce((s,f)=>s+finite('fiber area',f.area),0);if(!(area>0))throw new Error('SectionFibers: área total deve ser positiva.');
  const cy=rows.reduce((s,f)=>s+f.area*finite('fiber y',f.y),0)/area,cz=rows.reduce((s,f)=>s+f.area*finite('fiber z',f.z),0)/area;
  let Iy=0,Iz=0,Iyz=0;for(const f of rows){const dy=f.y-cy,dz=f.z-cz;Iy+=(Number(f.IyLocal)||0)+f.area*dz*dz;Iz+=(Number(f.IzLocal)||0)+f.area*dy*dy;Iyz+=(Number(f.IyzLocal)||0)+f.area*dy*dz}
  const mean=(Iy+Iz)/2,r=Math.hypot((Iy-Iz)/2,Iyz);return{contract:'section-geometry/v1',shape:'fiber',area,centroid:{y:cy,z:cz},Iy,Iz,Iyz,principal:{I1:mean+r,I2:mean-r,thetaRad:.5*Math.atan2(-2*Iyz,Iz-Iy)}};
}
