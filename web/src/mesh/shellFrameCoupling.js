import {createSurfaceMesh,meshNodeMap} from './meshModel.js';
import {meshBoundaryNodeIds} from './topology.js';
import {ConstraintManager} from '../numerics/constraints.js';

const EPS=1e-14;
const point=node=>[Number(node.x),Number(node.y),Number(node.z)];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function projectPointToSegment(p,a,b){const ab=sub(b,a),l2=dot(ab,ab);if(!(l2>EPS))throw new Error('ShellFrameCoupling: segmento de frame com comprimento nulo.');const t=clamp(dot(sub(p,a),ab)/l2,0,1),q=add(a,scale(ab,t)),r=sub(p,q);return{t,point:q,offset:r,distance:norm(r),length:Math.sqrt(l2)}}
function owner(prefix,id){return `${prefix||''}${String(id)}`}
function dof(dofManager,ownerId,label,registerMissing){const existing=dofManager.maybe(ownerId,label);if(existing!=null)return existing;if(!registerMissing)throw new Error(`ShellFrameCoupling: DOF ${ownerId}.${label} não registrado.`);return dofManager.register(ownerId,label,{kind:'coupling'})}
function addTerm(terms,dofIndex,coefficient){if(Math.abs(coefficient)<=1e-15)return;const found=terms.find(term=>term.dof===dofIndex);if(found)found.coefficient+=coefficient;else terms.push({dof:dofIndex,coefficient})}

function translationalMasterTerms({component,N1,N2,r,masterDofs}){
  const terms=[];const addPair=(label,c1,c2)=>{addTerm(terms,masterDofs.a[label],N1*c1);addTerm(terms,masterDofs.b[label],N2*c2)};
  if(component==='ux'){
    addPair('ux',1,1);addPair('ry',r[2],r[2]);addPair('rz',-r[1],-r[1]);
  }else if(component==='uy'){
    addPair('uy',1,1);addPair('rz',r[0],r[0]);addPair('rx',-r[2],-r[2]);
  }else if(component==='uz'){
    addPair('uz',1,1);addPair('rx',r[1],r[1]);addPair('ry',-r[0],-r[0]);
  }else throw new Error(`ShellFrameCoupling: componente translacional desconhecida ${component}.`);
  return terms.filter(term=>Math.abs(term.coefficient)>1e-15);
}

/**
 * Builds exact linear MPC equations between shell boundary nodes and the closest
 * frame segment. Frame translations/rotations are interpolated linearly along
 * the segment. When the shell node is offset from the frame centerline, the
 * rigid-arm term theta x r is included in the translational constraints.
 */
export function createShellFrameCouplingConstraints({mesh,frameNodes=[],frameSegments=[],dofManager,constraints=new ConstraintManager(),shellNodeIds=null,tolerance=1e-6,tieRotations=true,registerMissing=true,shellOwnerPrefix='',frameOwnerPrefix=''}={}){
  if(!dofManager)throw new Error('ShellFrameCoupling: dofManager é obrigatório.');const normalized=createSurfaceMesh(mesh),shellMap=meshNodeMap(normalized),frameMap=new Map(Array.from(frameNodes||[],node=>[String(node.id),node]));if(!frameSegments.length)throw new Error('ShellFrameCoupling: informe ao menos um segmento de frame.');
  const candidates=frameSegments.map((segment,index)=>{const id=String(segment.id??`frame-segment-${index+1}`),a=frameMap.get(String(segment.n1)),b=frameMap.get(String(segment.n2));if(!a||!b)throw new Error(`ShellFrameCoupling: segmento ${id} referencia nó de frame inexistente.`);const pa=point(a),pb=point(b);if(norm(sub(pb,pa))<=EPS)throw new Error(`ShellFrameCoupling: segmento ${id} possui comprimento nulo.`);return{id,n1:String(segment.n1),n2:String(segment.n2),a,b,pa,pb}}),ids=shellNodeIds?Array.from(shellNodeIds,String):meshBoundaryNodeIds(normalized),tol=Math.max(0,Number(tolerance)||0),matches=[],unmatched=[];
  for(const shellId of ids){const shellNode=shellMap.get(String(shellId));if(!shellNode)throw new Error(`ShellFrameCoupling: nó shell ${shellId} inexistente.`);const p=point(shellNode);let best=null;for(const segment of candidates){const projection=projectPointToSegment(p,segment.pa,segment.pb),row={segment,...projection};if(!best||row.distance<best.distance)best=row}if(!best||best.distance>tol){unmatched.push({shellNodeId:String(shellId),distance:best?.distance??null,closestSegmentId:best?.segment.id??null});continue}
    const {segment,t,offset:rigidArm,distance}=best,N1=1-t,N2=t,shellOwner=owner(shellOwnerPrefix,shellId),frameOwnerA=owner(frameOwnerPrefix,segment.n1),frameOwnerB=owner(frameOwnerPrefix,segment.n2),masterDofs={a:{},b:{}};
    for(const label of ['ux','uy','uz','rx','ry','rz']){masterDofs.a[label]=dof(dofManager,frameOwnerA,label,registerMissing);masterDofs.b[label]=dof(dofManager,frameOwnerB,label,registerMissing)}
    let equations=0,skippedShared=0;
    for(const label of ['ux','uy','uz']){
      const slave=dof(dofManager,shellOwner,label,registerMissing),masters=translationalMasterTerms({component:label,N1,N2,r:rigidArm,masterDofs});if(masters.length===1&&masters[0].dof===slave&&Math.abs(masters[0].coefficient-1)<=1e-14){skippedShared++;continue}if(constraints.has(slave))throw new Error(`ShellFrameCoupling: DOF dependente duplicado ${shellOwner}.${label}.`);constraints.addMPC(slave,masters,0,'shell-frame-rigid-arm');equations++
    }
    if(tieRotations)for(const label of ['rx','ry','rz']){const slave=dof(dofManager,shellOwner,label,registerMissing),masters=[];addTerm(masters,masterDofs.a[label],N1);addTerm(masters,masterDofs.b[label],N2);if(masters.length===1&&masters[0].dof===slave&&Math.abs(masters[0].coefficient-1)<=1e-14){skippedShared++;continue}if(constraints.has(slave))throw new Error(`ShellFrameCoupling: DOF dependente duplicado ${shellOwner}.${label}.`);constraints.addMPC(slave,masters,0,'shell-frame-rotation');equations++}
    matches.push({shellNodeId:String(shellId),segmentId:segment.id,n1:segment.n1,n2:segment.n2,t,N1,N2,distance,rigidArm:{x:rigidArm[0],y:rigidArm[1],z:rigidArm[2]},equations,skippedShared});
  }
  return{contract:'shell-frame-coupling/v1',constraints,matches,unmatched,report:{requestedNodes:ids.length,matchedNodes:matches.length,unmatchedNodes:unmatched.length,equationsAdded:matches.reduce((s,m)=>s+m.equations,0),tolerance:tol,tieRotations}};
}
