import assert from 'node:assert/strict';
import {spatialAxes} from '../web/src/solver/spatial3d.js';
import {corotationalFrame3DInternalForce,followerExternalVector3D,numericalCorotational3DTangent,numericalFollower3DTangent} from '../web/src/solver/corotational3d.js';

const E=200e6,nu=.3,A=.015,Iy=8e-5,Iz=1.1e-4,J=2.2e-5;
const project={
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:3,y:.3,z:.2},{id:'N3',x:5.2,y:1.1,z:.8}],
  elements:[
    {id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,0,1]}},
    {id:'E2',type:'frame3d',n1:'N2',n2:'N3',materialId:'S',sectionId:'SEC',orientation:{up:[0,0,1]}}
  ],
  materials:[{id:'S',type:'steel',E,nu,alpha:1.2e-5,density:78.5}],
  sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz,h:.30,b:.20}],
  elementLoads:[
    {id:'T1',elementId:'E1',kind:'thermal',dT:8,dTGradientY:3,dTGradientZ:-2},
    {id:'F1',elementId:'E2',kind:'followerEnd',end:2,px:.4,py:-1.1,pz:.6},
    {id:'F2',elementId:'E2',kind:'followerEnd',end:2,px:-.1,py:.2,pz:.15}
  ]
};
const u=[0,0,0,0,0,0,.012,-.018,.009,.014,-.021,.017,.025,-.031,.022,.026,-.012,.019];
const map=new Map(project.nodes.map((n,i)=>[n.id,i]));
const dofs=(i,j)=>[0,1,2,3,4,5].map(k=>6*i+k).concat([0,1,2,3,4,5].map(k=>6*j+k));
const char=Math.max(1,...project.elements.map(e=>spatialAxes(project.nodes[map.get(e.n1)],project.nodes[map.get(e.n2)],e).L));
const hFor=(j,fd=.2e-6)=>Math.max(1e-9,fd*Math.max(1,j%6>=3?Math.abs(u[j]):char,Math.abs(u[j])));

function internalVector(q){
  const F=Array(q.length).fill(0);
  for(const e of project.elements){const i=map.get(e.n1),j=map.get(e.n2),idx=dofs(i,j),ue=idx.map(k=>q[k]),r=corotationalFrame3DInternalForce(project,e,project.nodes[i],project.nodes[j],ue);idx.forEach((g,k)=>F[g]+=r.global[k])}
  return F;
}
function brute(fn,scheme='central'){
  const n=u.length,K=Array.from({length:n},()=>Array(n).fill(0)),f0=scheme==='forward'?fn(u):null;
  for(let j=0;j<n;j++){
    const h=hFor(j),up=[...u];up[j]+=h;const fp=fn(up);
    if(scheme==='forward'){for(let i=0;i<n;i++)K[i][j]=(fp[i]-f0[i])/h;continue}
    const um=[...u];um[j]-=h;const fm=fn(um);for(let i=0;i<n;i++)K[i][j]=(fp[i]-fm[i])/(2*h);
  }
  return K;
}
function matrixClose(actual,expected,label,rtol=2e-7,atol=2e-7){
  let maxErr=0,maxRef=0,where='';
  for(let i=0;i<actual.length;i++)for(let j=0;j<actual.length;j++){const err=Math.abs(actual[i][j]-expected[i][j]);if(err>maxErr){maxErr=err;where=`[${i},${j}]`}maxRef=Math.max(maxRef,Math.abs(expected[i][j]))}
  assert.ok(maxErr<=atol+rtol*Math.max(1,maxRef),`${label}: max error ${maxErr} at ${where}; reference scale ${maxRef}`);
}

// The sparse element-wise central tangent must match the previous global finite-difference definition.
matrixClose(numericalCorotational3DTangent(project,u,{fdStep:.2e-6,scheme:'central'}),brute(internalVector),'internal central tangent');

// Forward mode remains available and mathematically equivalent as well.
matrixClose(numericalCorotational3DTangent(project,u,{fdStep:.2e-6,scheme:'forward'}),brute(internalVector,'forward'),'internal forward tangent',5e-7,5e-7);

// Only follower-loaded elements are differentiated, but the assembled external Jacobian must equal the global reference derivative.
matrixClose(numericalFollower3DTangent(project,u,{fdStep:.2e-6,map}),brute(q=>followerExternalVector3D(project,q,map)),'follower tangent',2e-7,2e-7);

console.log('v0.30 co-rotational 3D element-wise tangent assembly smoke: OK');
