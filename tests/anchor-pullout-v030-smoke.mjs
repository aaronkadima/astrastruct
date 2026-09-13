import assert from 'node:assert/strict';
import {anchorBondLaw,solveAnchorPulloutAtDisplacement,solveBondedAnchorPullout} from '../web/src/solver/anchorPullout1d.js';

// Piecewise monotonic bond law: ascending, plateau, softening and residual.
{
  const c={tauMax:5000,s1:.001,s2:.002,sf:.006,residualRatio:.2};
  const a=anchorBondLaw(.0005,c),b=anchorBondLaw(.0015,c),d=anchorBondLaw(.004,c),e=anchorBondLaw(.010,c);
  assert.ok(Math.abs(a.tau-2500)<1e-10&&a.tangent>0);assert.equal(b.tau,5000);assert.equal(b.tangent,0);assert.ok(d.tau<5000&&d.tau>1000&&d.tangent<0);assert.equal(e.tau,1000);assert.equal(e.tangent,0);
}

// Small-slip elastic benchmark against the closed-form shear-lag solution
// P = EA*lambda*tanh(lambda*L)*delta, lambda² = p*k_tau/(EA).
{
  const c={embedment:.20,diameter:.016,E:200e6,segments:120,tauMax:4000,s1:.001,s2:.002,sf:.010,residualRatio:.2,headEnabled:false},delta=1e-5,sol=solveAnchorPulloutAtDisplacement(c,delta);assert.ok(sol.converged,`elastic anchor did not converge: ${sol.error||sol.residualNorm}`);
  const A=Math.PI*c.diameter**2/4,p=Math.PI*c.diameter,lambda=Math.sqrt(p*(c.tauMax/c.s1)/(c.E*A)),exact=c.E*A*lambda*Math.tanh(lambda*c.embedment)*delta,reaction=sol.state.f[0],rel=Math.abs(reaction-exact)/exact;assert.ok(rel<.012,`elastic shear-lag ${reaction} vs ${exact}, rel=${rel}`);
}

// Nearly rigid bar: the pull-out reaction tends to the integral of bond stress
// over the cylindrical interface. Optional head spring adds directly to it.
{
  const base={embedment:.10,diameter:.012,E:2e12,segments:30,tauMax:5000,s1:.001,s2:.002,sf:.006,residualRatio:.2},delta=.0002,tau=1000,bond=Math.PI*base.diameter*base.embedment*tau;
  const free=solveAnchorPulloutAtDisplacement(base,delta);assert.ok(free.converged);assert.ok(Math.abs(free.state.f[0]-bond)/bond<.01,`rigid-bar bond ${free.state.f[0]} vs ${bond}`);
  const headed=solveAnchorPulloutAtDisplacement({...base,headEnabled:true,headStiffness:10000,headCapacity:10},delta);assert.ok(headed.converged);const expected=bond+2;assert.ok(Math.abs(headed.state.f[0]-expected)/expected<.012,`headed reaction ${headed.state.f[0]} vs ${expected}`);
}

// Displacement control must follow the descending bond branch and preserve
// global equilibrium between the applied reaction, distributed bond and head.
{
  const r=solveBondedAnchorPullout({embedment:.10,diameter:.012,E:2e12,segments:24,tauMax:5000,s1:.0005,s2:.001,sf:.003,residualRatio:.1,displacementMax:.006,steps:36,headEnabled:false,maxIterations:80});assert.ok(r.diagnostics.converged,`post-peak failed at step ${r.diagnostics.failedAt}`);assert.ok(r.peak.load>r.final.load*1.5,`expected post-peak drop ${r.peak.load} -> ${r.final.load}`);assert.equal(r.diagnostics.governing,'bond-pullout-softening');assert.ok(r.peak.displacement>=.0005&&r.peak.displacement<=.0015);
  const bondSum=r.profiles.final.reduce((s,x)=>s+x.bondForce,0);assert.ok(Math.abs(r.final.load-bondSum)<1e-5,`equilibrium load ${r.final.load}, bond ${bondSum}`);assert.ok(r.diagnostics.work>0);
}

console.log('anchor-pullout-v030-smoke: OK');
