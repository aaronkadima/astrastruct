const EPS=1e-12;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const p3=n=>[finite(n?.x),finite(n?.y),finite(n?.z)];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);return n>EPS?a.map(v=>v/n):null};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const idsOf=e=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);
function derivatives(xi,eta){return{xi:[-.25*(1-eta),.25*(1-eta),.25*(1+eta),-.25*(1+eta)],eta:[-.25*(1-xi),-.25*(1+xi),.25*(1+xi),.25*(1-xi)]}}
function jacobian(coords,xi,eta){const d=derivatives(xi,eta);let xXi=0,yXi=0,xEta=0,yEta=0;for(let i=0;i<4;i++){xXi+=d.xi[i]*coords[i][0];yXi+=d.xi[i]*coords[i][1];xEta+=d.eta[i]*coords[i][0];yEta+=d.eta[i]*coords[i][1]}const det=xXi*yEta-xEta*yXi,den=Math.hypot(xXi,yXi)*Math.hypot(xEta,yEta);return{det,scaled:den>EPS?det/den:0,xXi,yXi,xEta,yEta}}
function angle(a,b,c){const u=sub(a,b),v=sub(c,b),nu=norm(u),nv=norm(v);if(!(nu>EPS&&nv>EPS))return 0;return Math.acos(clamp(dot(u,v)/(nu*nv),-1,1))*180/Math.PI}

export function evaluateShell4Quality(project,element,{aspectWarning=4,minAngleWarning=30,maxAngleWarning=150,minScaledJacobianWarning=.35,minJacobianRatioWarning=.25,planarityRelativeTolerance=1e-6,planarityAbsoluteTolerance=1e-8}={}){
  const id=String(element?.id||''),nodeMap=new Map((project?.nodes||[]).map(n=>[String(n.id),n])),ids=idsOf(element),issues=[];
  if(ids.length!==4||new Set(ids.map(String)).size!==4)return{id,status:'invalid',issues:['Quatro nós distintos são obrigatórios.'],nodeIds:ids};
  const nodes=ids.map(x=>nodeMap.get(String(x)));if(nodes.some(n=>!n))return{id,status:'invalid',issues:['O elemento referencia nó inexistente.'],nodeIds:ids};
  const p=nodes.map(p3),e1=unit(sub(p[1],p[0])),normal=unit(cross(sub(p[1],p[0]),sub(p[3],p[0])));if(!e1||!normal)return{id,status:'invalid',issues:['Geometria degenerada no plano do shell.'],nodeIds:ids};const e2=unit(cross(normal,e1));if(!e2)return{id,status:'invalid',issues:['Base local degenerada.'],nodeIds:ids};
  const local=p.map(q=>{const r=sub(q,p[0]);return[dot(r,e1),dot(r,e2),dot(r,normal)]}),xy=local.map(q=>[q[0],q[1]]),edges=p.map((q,i)=>norm(sub(p[(i+1)%4],q))),minEdge=Math.min(...edges),maxEdge=Math.max(...edges),aspectRatio=minEdge>EPS?maxEdge/minEdge:Infinity,span=Math.max(maxEdge,1),warpage=Math.max(...local.map(q=>Math.abs(q[2]))),warpageRatio=warpage/span,planarityLimit=Math.max(Math.abs(finite(planarityAbsoluteTolerance,1e-8)),span*Math.abs(finite(planarityRelativeTolerance,1e-6)));
  const angles=p.map((q,i)=>angle(p[(i+3)%4],q,p[(i+1)%4])),minAngle=Math.min(...angles),maxAngle=Math.max(...angles),g=1/Math.sqrt(3),samples=[[-g,-g],[g,-g],[g,g],[-g,g],[0,0]].map(([xi,eta])=>jacobian(xy,xi,eta)),dets=samples.map(x=>x.det),scaled=samples.map(x=>x.scaled),minDet=Math.min(...dets),maxDet=Math.max(...dets),minScaledJacobian=Math.min(...scaled),jacobianRatio=maxDet>EPS?minDet/maxDet:0;
  let status='good';
  if(!(minEdge>EPS)){status='invalid';issues.push('Existe aresta de comprimento nulo.')}if(warpage>planarityLimit){status='invalid';issues.push(`Não planar: desvio ${warpage.toExponential(3)} m > limite ${planarityLimit.toExponential(3)} m.`)}if(!(minDet>EPS)){status='invalid';issues.push('Jacobiano não positivo: ordem cruzada, concavidade ou degeneração.')}if(!(minScaledJacobian>0)){status='invalid';issues.push('Jacobiano escalado não positivo.')}
  if(status!=='invalid'){
    if(aspectRatio>aspectWarning){status='warning';issues.push(`Aspect ratio ${aspectRatio.toFixed(2)} > ${aspectWarning}.`)}
    if(minAngle<minAngleWarning||maxAngle>maxAngleWarning){status='warning';issues.push(`Ângulos internos ${minAngle.toFixed(1)}°–${maxAngle.toFixed(1)}° fora da faixa recomendada.`)}
    if(minScaledJacobian<minScaledJacobianWarning){status='warning';issues.push(`Jacobiano escalado mínimo ${minScaledJacobian.toFixed(3)} < ${minScaledJacobianWarning}.`)}
    if(jacobianRatio<minJacobianRatioWarning){status='warning';issues.push(`Razão Jmin/Jmax ${jacobianRatio.toFixed(3)} < ${minJacobianRatioWarning}.`)}
  }
  return{id,nodeIds:ids,status,issues,edgeLengths:edges,aspectRatio,minAngle,maxAngle,angles,warpage,warpageRatio,planarityLimit,minJacobian:minDet,maxJacobian:maxDet,jacobianRatio,minScaledJacobian,scaledJacobians:scaled,localCoordinates:xy};
}

export function evaluateShellMeshQuality(project,options={}){
  const elements=(project?.elements||[]).filter(e=>e.type==='shell4'),items=elements.map(e=>evaluateShell4Quality(project,e,options)),counts={good:0,warning:0,invalid:0};for(const q of items)counts[q.status]=(counts[q.status]||0)+1;const valid=items.filter(q=>q.status!=='invalid');return{items,counts,total:items.length,worst:{aspectRatio:valid.length?Math.max(...valid.map(q=>q.aspectRatio)):null,minAngle:valid.length?Math.min(...valid.map(q=>q.minAngle)):null,maxAngle:valid.length?Math.max(...valid.map(q=>q.maxAngle)):null,minScaledJacobian:valid.length?Math.min(...valid.map(q=>q.minScaledJacobian)):null,jacobianRatio:valid.length?Math.min(...valid.map(q=>q.jacobianRatio)):null,warpage:items.length?Math.max(...items.map(q=>q.warpage||0)):null},ok:counts.invalid===0};
}
