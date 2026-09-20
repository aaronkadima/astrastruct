import assert from 'node:assert/strict';
import {autoElementRebarCage3d} from '../web/src/detailing/autoRebarCage.js';
import {rcRectangularFlexureDesign,rcShearDesign} from '../web/src/codeDesign/rc.js';

const rcProfile={parameters:{rc:{flexure:{phi:.9,alpha1:.85,beta1:.85,epsCu:.003},shear:{phi:.85,vcCoefficient:.17,steelCoefficient:1.0}}}};
const detailingProfile={parameters:{detailing:{bend:{mainBarMultiplier:8,stirrupMultiplier:4},hook:{stirrupTailPhi:5,stirrupTailMinMm:50}}}};
const project={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:5,y:0,z:0}],elements:[{id:'V1',type:'frame3d',n1:'N1',n2:'N2',orientation:{up:[0,0,1]}}]};
const materials={fc:30,fy:500,Es:200000,lambda:1};

const result=autoElementRebarCage3d({
  project,element:project.elements[0],demand:{Mu:180,Vu:220},
  section:{widthMm:300,heightMm:500,effectiveDepthMm:460},materials,
  rcProfile,detailingProfile,
  coverMm:30,stirrupDiameterMm:8,stirrupLegs:2,hookAngleDeg:135,
  longitudinal:{minBars:4,maxBars:10},spacing:{sMinMm:50,sMaxMm:400,roundToMm:25},
  asBounds:{asMinMm2:50,asMaxMm2:5000},cage:{startCoverMm:30,endCoverMm:30},
});

assert.equal(result.contract,'auto-rebar-cage-3d/v1');
assert.equal(result.elementId,'V1');

// --- Every piece of the chain is internally consistent (not just each stage's own claim) ---
assert.equal(result.layout.positions.length,result.flexureSizing.barPick.barCount);
assert.equal(result.cage.barCount,result.flexureSizing.barPick.barCount);
assert.equal(result.cage.stirrupCount>0,true);
assert.equal(result.stirrup.diameterMm,8);

// --- THE actual proof of closure: feed the automatically-chosen reinforcement
// back into the ORIGINAL, independent design checks (not anything this
// orchestrator computed) and confirm both the flexure and shear demands that
// started the whole chain are genuinely satisfied. ---
const flex=rcRectangularFlexureDesign({profile:rcProfile,demand:{Mu:180},section:{b:300,d:460},reinforcement:{As:result.flexureSizing.barPick.totalAreaMm2},materials});
assert.ok(flex.ok,'the automatically chosen longitudinal steel must satisfy the original Mu demand');
assert.ok(flex.utilization<=1&&flex.utilization>=0.85);

const shear=rcShearDesign({profile:rcProfile,demand:{Vu:220},section:{bw:300,d:460},reinforcement:{Av:result.shearSizing.Av,s:result.shearSizing.spacingMm},materials});
assert.ok(shear.ok,'the automatically chosen stirrup spacing must satisfy the original Vu demand');
assert.ok(shear.utilization<=1&&shear.utilization>=0.85);

// --- A larger Mu/Vu must drive a heavier/tighter design (monotonicity sanity, catches a wrong-direction bug). ---
const heavier=autoElementRebarCage3d({
  project,element:project.elements[0],demand:{Mu:280,Vu:320},
  section:{widthMm:300,heightMm:500,effectiveDepthMm:460},materials,
  rcProfile,detailingProfile,
  coverMm:30,stirrupDiameterMm:8,stirrupLegs:2,hookAngleDeg:135,
  longitudinal:{minBars:4,maxBars:12},spacing:{sMinMm:50,sMaxMm:400,roundToMm:25},
  asBounds:{asMinMm2:50,asMaxMm2:8000},cage:{startCoverMm:30,endCoverMm:30},
});
assert.ok(heavier.flexureSizing.requiredAsMm2>result.flexureSizing.requiredAsMm2,'a bigger Mu must require more steel');
assert.ok(heavier.shearSizing.spacingMm<=result.shearSizing.spacingMm,'a bigger Vu must require tighter (or equal) stirrup spacing');

// --- Refuses rather than silently producing an infeasible cage when bounds cannot satisfy the demand. ---
assert.throws(()=>autoElementRebarCage3d({
  project,element:project.elements[0],demand:{Mu:180,Vu:220},
  section:{widthMm:300,heightMm:500,effectiveDepthMm:460},materials,
  rcProfile,detailingProfile,coverMm:30,stirrupDiameterMm:8,stirrupLegs:2,hookAngleDeg:135,
  longitudinal:{minBars:4,maxBars:6},spacing:{sMinMm:50,sMaxMm:400,roundToMm:25},
  asBounds:{asMinMm2:50,asMaxMm2:200},cage:{startCoverMm:30,endCoverMm:30}, // asMaxMm2 too small for Mu=180
}));

console.log('auto rebar cage orchestrator (Mu,Vu -> 3D cage, independently re-verified) smoke: OK',{bars:`${result.flexureSizing.barPick.barCount}xØ${result.flexureSizing.barPick.diameterMm}`,spacingMm:result.shearSizing.spacingMm,flexUtil:flex.utilization.toFixed(3),shearUtil:shear.utilization.toFixed(3)});
