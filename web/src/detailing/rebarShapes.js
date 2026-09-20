import {createRebarMark} from './core.js';

const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`RebarShapes: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`RebarShapes: ${name} deve ser > 0.`);return n};
const parameter=(profile,path)=>{
  let value=profile?.parameters;
  for(const key of path.split('.'))value=value?.[key];
  if(value==null)throw new Error(`RebarShapes: parâmetro de detalhamento ausente: ${path}.`);
  return positive(path,value);
};

export function rectangularStirrupGeometry({profile,widthMm,heightMm,diameterMm,hookAngleDeg=135}={}){
  const width=positive('widthMm',widthMm),height=positive('heightMm',heightMm),d=positive('diameterMm',diameterMm),angle=positive('hookAngleDeg',hookAngleDeg);
  if(!(angle<180))throw new Error('RebarShapes: hookAngleDeg deve ser < 180°.');
  const bendMultiplier=parameter(profile,'detailing.bend.stirrupMultiplier');
  const tailPhi=parameter(profile,'detailing.hook.stirrupTailPhi');
  const tailMinMm=parameter(profile,'detailing.hook.stirrupTailMinMm');
  const centerlineRadiusMm=bendMultiplier*d,tailMm=Math.max(tailPhi*d,tailMinMm);
  if(centerlineRadiusMm*2>=Math.min(width,height))throw new Error('RebarShapes: raio de dobra incompatível com as dimensões do estribo.');
  const horizontalStraightMm=width-2*centerlineRadiusMm,verticalStraightMm=height-2*centerlineRadiusMm;
  const cornerArcs=Array.from({length:4},(_,i)=>({angleDeg:90,centerlineRadiusMm,label:`canto ${i+1}`}));
  const hookArcs=Array.from({length:2},(_,i)=>({angleDeg:angle,centerlineRadiusMm,label:`gancho ${i+1}`}));
  const segmentsMm=[horizontalStraightMm,verticalStraightMm,horizontalStraightMm,verticalStraightMm,tailMm,tailMm];
  const arcLengthMm=[...cornerArcs,...hookArcs].reduce((sum,a)=>sum+Math.abs(a.angleDeg)*Math.PI/180*a.centerlineRadiusMm,0);
  const straightLengthMm=segmentsMm.reduce((sum,x)=>sum+x,0);
  return{
    contract:'rebar-stirrup/v1',widthMm:width,heightMm:height,diameterMm:d,
    bend:{multiplier:bendMultiplier,centerlineRadiusMm},
    hook:{angleDeg:angle,tailPhi,tailMinMm,tailMm,arc:{angleDeg:angle,centerlineRadiusMm,lengthMm:angle*Math.PI/180*centerlineRadiusMm}},
    horizontalStraightMm,verticalStraightMm,segmentsMm,arcs:[...cornerArcs,...hookArcs],
    straightLengthMm,arcLengthMm,cutLengthMm:straightLengthMm+arcLengthMm,
    legend:`Ø${d} · ${Math.round(width)}×${Math.round(height)} · gancho ${angle}° · cauda ${Math.round(tailMm)} mm`,
    assumptions:[
      'dimensões width/height referem-se à linha de centro do estribo',
      'raio de dobra e comprimento mínimo de cauda provêm exclusivamente do profile de detalhamento',
    ],
  };
}

export function stirrupRebarMark({id,profile,widthMm,heightMm,diameterMm,quantity=1,grade='',hookAngleDeg=135,location='',notes=[],metadata={}}={}){
  const stirrupGeometry=rectangularStirrupGeometry({profile,widthMm,heightMm,diameterMm,hookAngleDeg});
  const mark=createRebarMark({
    id,diameterMm:stirrupGeometry.diameterMm,quantity,segmentsMm:stirrupGeometry.segmentsMm,
    arcs:stirrupGeometry.arcs,grade,shape:'rectangular-stirrup',location,notes,
    metadata:{...metadata,stirrupContract:stirrupGeometry.contract},
  });
  return{...mark,stirrupGeometry};
}
