import assert from 'node:assert/strict';
import {rcShearRequiredSpacing,roundSpacingDownMm,autoStirrupSpacing} from '../web/src/codeDesign/rcSizing.js';
import {rcShearDesign} from '../web/src/codeDesign/rc.js';

const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

const profile={parameters:{rc:{shear:{phi:.85,vcCoefficient:.17,steelCoefficient:1.0}}}};
const section={bw:300,d:460},materials={fc:30,fy:500,lambda:1},demand={Vu:220};

// --- rcShearRequiredSpacing: found spacing must land resistance exactly on demand ---
const raw=rcShearRequiredSpacing({profile,demand,section,materials,stirrupDiameterMm:8,legs:2,sMinMm:50,sMaxMm:400});
near(raw.resistance,220,1e-4);
const verify=rcShearDesign({profile,demand,section,reinforcement:{Av:raw.Av,s:raw.spacingMm},materials});
near(verify.resistance,raw.resistance,1e-9);
near(verify.utilization,1,1e-3);
near(raw.Av,2*Math.PI*8*8/4,1e-9);

// --- Monotonicity sanity: a bigger diameter must allow a wider (looser) spacing for the same Vu. ---
const rawBigger=rcShearRequiredSpacing({profile,demand,section,materials,stirrupDiameterMm:10,legs:2,sMinMm:50,sMaxMm:400});
assert.ok(rawBigger.spacingMm>raw.spacingMm,'a larger stirrup diameter should permit a looser spacing for the same shear demand');

// --- If sMaxMm alone already satisfies demand, no search is needed and that's reported honestly. ---
const trivial=rcShearRequiredSpacing({profile,demand:{Vu:1},section,materials,stirrupDiameterMm:8,legs:2,sMinMm:50,sMaxMm:400});
assert.equal(trivial.iterations,0);
assert.equal(trivial.spacingMm,400);

// --- If even sMinMm cannot reach the demand, refuse rather than return an unsafe spacing. ---
assert.throws(()=>rcShearRequiredSpacing({profile,demand:{Vu:100000},section,materials,stirrupDiameterMm:8,legs:2,sMinMm:50,sMaxMm:400}),/não atinge a demanda/);

// --- roundSpacingDownMm: always rounds toward MORE steel (safe direction), never below the floor. ---
near(roundSpacingDownMm(177.4,25,50),175);
near(roundSpacingDownMm(52,25,50),50);
near(roundSpacingDownMm(47,25,10),25);

// --- autoStirrupSpacing: full chain, rounded value re-verified against the ORIGINAL demand ---
const auto=autoStirrupSpacing({profile,demand,section,materials,stirrupDiameterMm:8,legs:2,sMinMm:50,sMaxMm:400,roundToMm:25});
assert.equal(auto.spacingMm%25,0,'rounded spacing must be a clean 25mm increment');
assert.ok(auto.spacingMm<=raw.spacingMm,'rounding down must never exceed the raw (unrounded) result');
const finalCheck=rcShearDesign({profile,demand,section,reinforcement:{Av:auto.Av,s:auto.spacingMm},materials});
assert.ok(finalCheck.ok,`rounded spacing (${auto.spacingMm}mm) must satisfy the original Vu=220 demand`);
near(finalCheck.utilization,auto.finalUtilization,1e-9);
assert.ok(finalCheck.utilization<=1&&finalCheck.utilization>=0.85,`utilization ${finalCheck.utilization} out of the expected close-but-safe range for a 25mm rounding step`);

console.log('RC shear sizing -> spacing rounding closed-loop smoke: OK',{rawSpacingMm:raw.spacingMm.toFixed(2),roundedSpacingMm:auto.spacingMm,finalUtilization:finalCheck.utilization.toFixed(3)});
