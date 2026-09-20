import assert from 'node:assert/strict';
import {rcFlexureRequiredAs} from '../web/src/codeDesign/rcSizing.js';
import {rcRectangularFlexureDesign} from '../web/src/codeDesign/rc.js';
import {pickBarCountAndDiameter,autoRectangularSectionBarLayout,STANDARD_BAR_DIAMETERS_MM} from '../web/src/detailing/rebarLayout.js';

const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

const profile={parameters:{rc:{flexure:{phi:.9,alpha1:.85,beta1:.85,epsCu:.003}}}};
const section={b:300,d:460},materials={fc:30,fy:500,Es:200000},demand={Mu:180};

// --- rcFlexureRequiredAs: the found As must make the check land exactly on the demand ---
const sizing=rcFlexureRequiredAs({profile,demand,section,materials,asMinMm2:50,asMaxMm2:5000});
near(sizing.resistance,180,1e-4);
const verify=rcRectangularFlexureDesign({profile,demand,section,reinforcement:{As:sizing.requiredAsMm2},materials});
near(verify.resistance,sizing.resistance,1e-9); // literally the same underlying check, must agree exactly
near(verify.utilization,1,1e-3);

// --- If asMinMm2 already suffices, no search is needed and that's reported honestly. ---
const trivial=rcFlexureRequiredAs({profile,demand:{Mu:1},section,materials,asMinMm2:2000,asMaxMm2:5000});
assert.equal(trivial.iterations,0);
assert.ok(trivial.resistance>=1);

// --- If even asMaxMm2 cannot reach the demand, refuse rather than return a false answer. ---
assert.throws(()=>rcFlexureRequiredAs({profile,demand:{Mu:100000},section,materials,asMinMm2:50,asMaxMm2:500}),/não atinge a demanda/);

// --- pickBarCountAndDiameter: exact area must be >= required, and be the least-waste option. ---
const pick=pickBarCountAndDiameter({requiredAsMm2:931.2,minBars:4,maxBars:10});
assert.ok(pick.totalAreaMm2>=931.2);
// Brute-force check: no other (diameter,count) pair in range should waste less.
let bestWaste=Infinity;
for(const d of STANDARD_BAR_DIAMETERS_MM){const area=Math.PI*d*d/4;for(let n=4;n<=10;n++){const total=n*area;if(total>=931.2)bestWaste=Math.min(bestWaste,total-931.2);}}
near(pick.waste,bestWaste,1e-6);

// A tiny As with a low minBars floor must still respect the 4-bar structural minimum
// (a rectangular cage needs at least one bar per corner).
const tiny=pickBarCountAndDiameter({requiredAsMm2:10,minBars:1,maxBars:6});
assert.ok(tiny.barCount>=4);

// An impossible request (too few bars/small diameters for a huge As) must refuse, not silently under-supply steel.
assert.throws(()=>pickBarCountAndDiameter({requiredAsMm2:1e7,minBars:4,maxBars:6,diametersMm:[8,10]}),/nenhuma combinação/);

// --- autoRectangularSectionBarLayout: full chain, including geometric feasibility ---
const layout=autoRectangularSectionBarLayout({widthMm:300,heightMm:500,coverMm:30,stirrupDiameterMm:8,requiredAsMm2:sizing.requiredAsMm2,minBars:4,maxBars:10});
assert.equal(layout.positions.length,layout.sizing.barCount);
assert.ok(layout.positions.every(p=>p.diameterMm===layout.sizing.diameterMm));

// --- Close the full loop: the AUTOMATICALLY chosen bar layout's total area,
// fed back into the ORIGINAL flexure check, must satisfy the ORIGINAL Mu
// demand — this is the actual "elo fechado" the whole chain exists to prove,
// not just that each stage individually returns plausible-looking numbers.
const finalCheck=rcRectangularFlexureDesign({profile,demand,section,reinforcement:{As:layout.sizing.totalAreaMm2},materials});
assert.ok(finalCheck.ok,`chosen bar layout (${layout.sizing.barCount}xØ${layout.sizing.diameterMm}) must satisfy the original Mu=180 demand`);
assert.ok(finalCheck.utilization<=1);
// and it must not be absurdly oversized either (sanity bound on the rounding margin).
assert.ok(finalCheck.utilization>=0.85,`utilization ${finalCheck.utilization} suspiciously low for a least-waste pick`);

console.log('RC sizing -> bar pick -> layout closed-loop smoke: OK',{requiredAsMm2:sizing.requiredAsMm2.toFixed(1),picked:`${layout.sizing.barCount}xØ${layout.sizing.diameterMm}`,finalUtilization:finalCheck.utilization.toFixed(3)});
