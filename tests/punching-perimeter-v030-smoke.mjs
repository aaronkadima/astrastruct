import assert from 'node:assert/strict';
import {perimeterLineIntegrals,rectangularCriticalPerimeter,solvePunchingPerimeterDemand} from '../web/src/solver/punchingPerimeter.js';
const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b}`);
const d=.20,perimeter=rectangularCriticalPerimeter({columnX:.30,columnY:.40,offset:.40}),ints=perimeterLineIntegrals(perimeter);

// Centered shear produces uniform demand V/(u*d).
{
  const V=600,r=solvePunchingPerimeterDemand({perimeter,effectiveDepth:d,V,Mx:0,My:0,samplesPerEdge:12}),expected=V/(ints.I0*d);close(r.averageStress,expected,1e-10);for(const p of r.samples)close(p.tau,expected,1e-8,'uniform tau');close(r.equilibrium.recovered.V,V,1e-9);close(r.equilibrium.recovered.Mx,0,1e-9);close(r.equilibrium.recovered.My,0,1e-9);
}

// Pure Mx is anti-symmetric in y and follows q=(Mx/Iyy)*y.
{
  const Mx=90,r=solvePunchingPerimeterDemand({perimeter,effectiveDepth:d,V:0,Mx,My:0,samplesPerEdge:16}),c=Mx/ints.Iyy;close(r.coefficients.a,0,1e-10);close(r.coefficients.b,0,1e-10);close(r.coefficients.c,c,1e-9);const top=r.samples.filter(p=>p.y>0).sort((a,b)=>b.y-a.y)[0],bottom=r.samples.filter(p=>p.y<0).sort((a,b)=>a.y-b.y)[0];close(top.tau,c*top.y/d,1e-8);close(bottom.tau,c*bottom.y/d,1e-8);assert.ok(top.tau>0&&bottom.tau<0);close(r.equilibrium.recovered.Mx,Mx,1e-9);
}

// Positive My uses the physical sign convention My=-integral(x*q ds).
{
  const My=55,r=solvePunchingPerimeterDemand({perimeter,effectiveDepth:d,V:0,Mx:0,My,samplesPerEdge:16}),b=-My/ints.Ixx;close(r.coefficients.b,b,1e-9);close(r.equilibrium.recovered.My,My,1e-9);const right=r.samples.reduce((m,p)=>p.x>m.x?p:m,r.samples[0]);assert.ok(right.tau<0);
}

// Combined loading must recover all resultants to numerical precision.
{
  const actions={V:730,Mx:42,My:-37},r=solvePunchingPerimeterDemand({perimeter,effectiveDepth:.18,...actions,samplesPerEdge:30});close(r.equilibrium.recovered.V,actions.V,1e-8);close(r.equilibrium.recovered.Mx,actions.Mx,1e-8);close(r.equilibrium.recovered.My,actions.My,1e-8);assert.ok(r.extrema.maxAbs&&Number.isFinite(r.extrema.maxAbs.tau));assert.ok((r.amplification??0)>1);
}

assert.throws(()=>solvePunchingPerimeterDemand({perimeter:[{x:0,y:0},{x:0,y:0},{x:0,y:0}],effectiveDepth:d,V:1}),/degenerado/i);
console.log('punching-perimeter-v030-smoke: OK');
