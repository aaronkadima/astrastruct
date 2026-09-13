const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SectionGeometry: ${name} deve ser finito.`);return n};

function normalizeVertices(vertices){
  const pts=Array.from(vertices||[],(p,i)=>({y:finite(`y[${i}]`,p?.y),z:finite(`z[${i}]`,p?.z)}));
  if(pts.length<3)throw new Error('SectionGeometry: polígono requer ao menos 3 vértices.');
  if(pts.length>3&&pts[0].y===pts.at(-1).y&&pts[0].z===pts.at(-1).z)pts.pop();
  return pts;
}

function signedPolygonIntegrals(vertices){
  let A2=0,Cy6=0,Cz6=0,Iy12=0,Iz12=0,Iyz24=0;
  for(let i=0;i<vertices.length;i++){
    const p=vertices[i],q=vertices[(i+1)%vertices.length],cross=p.y*q.z-q.y*p.z;
    A2+=cross;Cy6+=(p.y+q.y)*cross;Cz6+=(p.z+q.z)*cross;
    Iy12+=(p.z*p.z+p.z*q.z+q.z*q.z)*cross;
    Iz12+=(p.y*p.y+p.y*q.y+q.y*q.y)*cross;
    Iyz24+=(2*p.y*p.z+p.y*q.z+q.y*p.z+2*q.y*q.z)*cross;
  }
  const area=A2/2;if(Math.abs(area)<=1e-18)throw new Error('SectionGeometry: polígono degenerado com área nula.');
  return{area,cy:Cy6/(6*area),cz:Cz6/(6*area),Iy0:Iy12/12,Iz0:Iz12/12,Iyz0:Iyz24/24};
}

function principalData(Iy,Iz,Iyz){
  const mean=(Iy+Iz)/2,radius=Math.hypot((Iy-Iz)/2,Iyz),I1=mean+radius,I2=mean-radius,theta=.5*Math.atan2(-2*Iyz,Iz-Iy);
  return{I1,I2,thetaRad:theta,thetaDeg:theta*180/Math.PI};
}

export function polygonSectionProperties(vertices){
  let pts=normalizeVertices(vertices),raw=signedPolygonIntegrals(pts);
  if(raw.area<0){pts=[...pts].reverse();raw=signedPolygonIntegrals(pts)}
  const {area,cy,cz,Iy0,Iz0,Iyz0}=raw,Iy=Iy0-area*cz*cz,Iz=Iz0-area*cy*cy,Iyz=Iyz0-area*cy*cz;
  return{contract:'section-geometry/v1',shape:'polygon',area,centroid:{y:cy,z:cz},Iy,Iz,Iyz,principal:principalData(Iy,Iz,Iyz),bounds:{yMin:Math.min(...pts.map(p=>p.y)),yMax:Math.max(...pts.map(p=>p.y)),zMin:Math.min(...pts.map(p=>p.z)),zMax:Math.max(...pts.map(p=>p.z))},vertices:pts,J:null,Cw:null};
}

export function rectangleSectionProperties({width,height,cy=0,cz=0}={}){
  const b=finite('width',width),h=finite('height',height),y=finite('cy',cy),z=finite('cz',cz);if(!(b>0&&h>0))throw new Error('SectionGeometry: width e height devem ser positivos.');
  const area=b*h,Iy=b*h**3/12,Iz=h*b**3/12,Iyz=0;
  return{contract:'section-geometry/v1',shape:'rectangle',area,centroid:{y,z},Iy,Iz,Iyz,principal:principalData(Iy,Iz,Iyz),bounds:{yMin:y-b/2,yMax:y+b/2,zMin:z-h/2,zMax:z+h/2},J:null,Cw:null};
}

function shiftedInertias(properties,cy,cz,factor){
  const A=factor*properties.area,dy=properties.centroid.y-cy,dz=properties.centroid.z-cz;
  return{Iy:factor*properties.Iy+A*dz*dz,Iz:factor*properties.Iz+A*dy*dy,Iyz:factor*properties.Iyz+A*dy*dz};
}

export function combineSectionProperties(parts){
  const rows=Array.from(parts||[]).map((part,i)=>{const properties=part?.properties||part,factor=Number(part?.factor??1);if(!properties||!Number.isFinite(factor)||factor===0)throw new Error(`SectionGeometry: parte ${i+1} inválida.`);return{properties,factor}});
  if(!rows.length)throw new Error('SectionGeometry: nenhuma parte para combinar.');
  const area=rows.reduce((s,r)=>s+r.factor*r.properties.area,0);if(!(area>1e-18))throw new Error('SectionGeometry: área composta resultante deve ser positiva.');
  const cy=rows.reduce((s,r)=>s+r.factor*r.properties.area*r.properties.centroid.y,0)/area,cz=rows.reduce((s,r)=>s+r.factor*r.properties.area*r.properties.centroid.z,0)/area;
  let Iy=0,Iz=0,Iyz=0;for(const row of rows){const shifted=shiftedInertias(row.properties,cy,cz,row.factor);Iy+=shifted.Iy;Iz+=shifted.Iz;Iyz+=shifted.Iyz}
  return{contract:'section-geometry/v1',shape:'composite',area,centroid:{y:cy,z:cz},Iy,Iz,Iyz,principal:principalData(Iy,Iz,Iyz),parts:rows.map(r=>({factor:r.factor,shape:r.properties.shape,area:r.properties.area,centroid:{...r.properties.centroid}})),J:null,Cw:null};
}

export function iSectionProperties({height,width,webThickness,flangeThickness}={}){
  const h=finite('height',height),b=finite('width',width),tw=finite('webThickness',webThickness),tf=finite('flangeThickness',flangeThickness);if(!(h>0&&b>0&&tw>0&&tf>0&&2*tf<h&&tw<=b))throw new Error('SectionGeometry: geometria I/H inválida.');
  return{...combineSectionProperties([
    rectangleSectionProperties({width:b,height:tf,cz:-(h-tf)/2}),
    rectangleSectionProperties({width:tw,height:h-2*tf}),
    rectangleSectionProperties({width:b,height:tf,cz:(h-tf)/2})
  ]),shape:'i-section',dimensions:{height:h,width:b,webThickness:tw,flangeThickness:tf}};
}

export function rhsSectionProperties({height,width,thickness}={}){
  const h=finite('height',height),b=finite('width',width),t=finite('thickness',thickness);if(!(h>0&&b>0&&t>0&&2*t<h&&2*t<b))throw new Error('SectionGeometry: geometria RHS inválida.');
  return{...combineSectionProperties([{properties:rectangleSectionProperties({width:b,height:h}),factor:1},{properties:rectangleSectionProperties({width:b-2*t,height:h-2*t}),factor:-1}]),shape:'rhs',dimensions:{height:h,width:b,thickness:t}};
}

export function pointInPolygon(y,z,vertices){
  const pts=normalizeVertices(vertices);let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const pi=pts[i],pj=pts[j],intersect=((pi.z>z)!==(pj.z>z))&&(y<(pj.y-pi.y)*(z-pi.z)/(pj.z-pi.z)+pi.y);if(intersect)inside=!inside;
  }
  return inside;
}
