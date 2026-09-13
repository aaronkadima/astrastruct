import { emptyProject, normalizeProject } from './model.js';

const EPS=1e-10;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clampInt=(v,a,b,f)=>Math.max(a,Math.min(b,Math.round(finite(v,f))));
const fixed3d=nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true});
const key=(x,y,z)=>`${x.toFixed(9)}|${y.toFixed(9)}|${z.toFixed(9)}`;
function pressureAverage(gamma,depth,z0,z1){if(depth<=z0+EPS)return 0;const top=Math.min(z1,depth),dz=Math.max(EPS,z1-z0),integral=gamma*(depth*(top-z0)-.5*(top*top-z0*z0));return Math.max(0,integral/dz)}

/**
 * Rectangular open water tank modeled entirely with shell4 panels. Walls use
 * outward normals and piecewise-uniform pressures whose resultant is the exact
 * integral of the linear hydrostatic law over each vertical strip.
 */
export function demoRectangularWaterTankShell3D({length=6,width=4,height=3,waterDepth=3,divX=3,divY=2,divZ=3,thickness=.20,gammaWater=9.81}={}){
  const L=Math.max(.5,finite(length,6)),W=Math.max(.5,finite(width,4)),H=Math.max(.5,finite(height,3)),D=Math.max(0,Math.min(H,finite(waterDepth,H))),nx=clampInt(divX,1,20,3),ny=clampInt(divY,1,20,2),nz=clampInt(divZ,1,20,3),t=Math.max(.02,finite(thickness,.20)),gamma=Math.max(0,finite(gammaWater,9.81)),p=emptyProject();p.name='Exemplo · reservatório retangular Shell4';p.nodes=[];p.elements=[];p.supports=[];p.loads=[];p.elementLoads=[];p.levels=Array.from({length:nz+1},(_,k)=>({id:`Z${k}`,name:k===0?'Fundo':`Faixa Z${k}`,elevation:H*k/nz,index:k}));
  const nodeMap=new Map(),usedIds=new Set();let nodeSeq=1,shellSeq=1,loadSeq=1;
  const addNode=(x,y,z)=>{const k=key(x,y,z);if(nodeMap.has(k))return nodeMap.get(k);let id=`T${nodeSeq++}`;while(usedIds.has(id))id=`T${nodeSeq++}`;usedIds.add(id);const levelIndex=Math.round(z/H*nz),node={id,x,y,z,levelId:`Z${Math.max(0,Math.min(nz,levelIndex))}`};p.nodes.push(node);nodeMap.set(k,id);return id};
  const addShell=(ids,surface,z0=0,z1=0)=>{const id=`S${shellSeq++}`,e={id,type:'shell4',nodeIds:[...ids],n1:ids[0],n2:ids[1],n3:ids[2],n4:ids[3],materialId:'concrete30',thickness:t,shearCorrection:5/6,drillingFactor:1e-6,label:`Reservatório · ${surface}`,surface};p.elements.push(e);let pressure=0;if(surface==='bottom')pressure=-gamma*D;else pressure=pressureAverage(gamma,D,z0,z1);if(Math.abs(pressure)>EPS)p.elementLoads.push({id:`HP${loadSeq++}`,caseId:'WATER',elementId:id,kind:'surface',pressure,source:'hydrostatic',surface,z0,z1,waterDepth:D,gammaWater:gamma});return e};
  const xs=Array.from({length:nx+1},(_,i)=>L*i/nx),ys=Array.from({length:ny+1},(_,i)=>W*i/ny),zs=Array.from({length:nz+1},(_,i)=>H*i/nz);
  // Bottom: +Z normal, so water pressure is negative (downward).
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)addShell([addNode(xs[i],ys[j],0),addNode(xs[i+1],ys[j],0),addNode(xs[i+1],ys[j+1],0),addNode(xs[i],ys[j+1],0)],'bottom');
  // South y=0, outward -Y.
  for(let k=0;k<nz;k++)for(let i=0;i<nx;i++)addShell([addNode(xs[i],0,zs[k]),addNode(xs[i+1],0,zs[k]),addNode(xs[i+1],0,zs[k+1]),addNode(xs[i],0,zs[k+1])],'south',zs[k],zs[k+1]);
  // North y=W, outward +Y.
  for(let k=0;k<nz;k++)for(let i=0;i<nx;i++)addShell([addNode(xs[i+1],W,zs[k]),addNode(xs[i],W,zs[k]),addNode(xs[i],W,zs[k+1]),addNode(xs[i+1],W,zs[k+1])],'north',zs[k],zs[k+1]);
  // West x=0, outward -X.
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)addShell([addNode(0,ys[j+1],zs[k]),addNode(0,ys[j],zs[k]),addNode(0,ys[j],zs[k+1]),addNode(0,ys[j+1],zs[k+1])],'west',zs[k],zs[k+1]);
  // East x=L, outward +X.
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)addShell([addNode(L,ys[j],zs[k]),addNode(L,ys[j+1],zs[k]),addNode(L,ys[j+1],zs[k+1]),addNode(L,ys[j],zs[k+1])],'east',zs[k],zs[k+1]);
  // Continuous foundation idealization for the demonstration: every bottom-grid
  // node is fixed. This makes the example stable and keeps attention on shell
  // hydrostatic response rather than soil-structure interaction.
  p.supports=p.nodes.filter(n=>Math.abs(n.z)<=EPS).map(n=>fixed3d(n.id));p.loadCases=[{id:'WATER',name:'Pressão hidrostática da água',type:'user'}];p.loadCombinations=[];p.settings.analysisType='linear';p.settings.activeLoadCaseId='WATER';p.settings.analysisScenarioId='WATER';
  const wallShells=2*(nx+ny)*nz,bottomShells=nx*ny;p.meta={...(p.meta||{}),exampleKind:'rectangular-water-tank-shell4',exampleNote:'Exemplo mecânico Shell4. Pressão hidrostática integrada por faixa; fundação idealizada como engaste contínuo nos nós do fundo.',tank:{length:L,width:W,height:H,waterDepth:D,divX:nx,divY:ny,divZ:nz,thickness:t,gammaWater:gamma,wallShells,bottomShells,totalShells:wallShells+bottomShells}};return normalizeProject(p);
}
