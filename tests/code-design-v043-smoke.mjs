import assert from 'node:assert/strict';
import {
  CODE_DESIGN_CONTRACT,CODE_DESIGN_VERSION,createCodeDesignProfile,designCheck,summarizeCodeDesign,governingAcrossCombinations,
  rcRectangularFlexureDesign,rcShearDesign,steelGrossYieldStrengths,steelMemberDesign,
  rectangularFootingContact,foundationSlidingDesign,foundationOverturningDesign,foundationPunchingDesign,foundationOneWayShearDesign,foundationFlexureStripDesign
} from '../web/src/codeDesign/index.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const profile=createCodeDesignProfile({
  id:'user-v043-benchmark',code:'USER-PARAMETERIZED',edition:'2026',
  provenance:{source:'benchmark parameters supplied explicitly',requiresLicensedParameters:true,automaticResistance:false},
  parameters:{
    rc:{
      flexure:{phi:.90,alpha1:.85,beta1:.80,epsCu:.003},
      shear:{phi:.75,vcCoefficient:.17,steelCoefficient:1}
    },
    steel:{phiTension:.90,phiBending:.90,phiShear:.90,shearCoefficient:.60,interaction:{axialExponent:1,bendingExponent:1,limit:1}},
    foundation:{
      sliding:{frictionCoefficient:.50,cohesionKPa:0,resistanceFactor:.90},
      stability:{requiredOverturningFS:1.50},
      punching:{phi:.75,concreteCoefficient:.17},
      oneWayShear:{phi:.75,concreteCoefficient:.17},
      flexure:{phi:.90,leverArmRatio:.90}
    }
  },
  clauses:{foundationBearing:'user-profile',foundationSliding:'user-profile',foundationOverturning:'user-profile',foundationPunching:'user-profile',foundationOneWayShear:'user-profile',foundationFlexure:'user-profile'}
});
assert.equal(CODE_DESIGN_VERSION,'0.43.0-exp');
assert.equal(profile.contract,'code-design-profile/v1');
assert.equal(profile.provenance.automaticResistance,false);

const rcFlex=rcRectangularFlexureDesign({profile,demand:{Mu:100},section:{b:300,d:450},reinforcement:{As:1500},materials:{fc:30,fy:500,Es:200000}});
assert.equal(rcFlex.ok,true);assert.ok(rcFlex.resistance>100);assert.ok(rcFlex.details.c>0&&rcFlex.details.c<450);
const rcShear=rcShearDesign({profile,demand:{Vu:180},section:{bw:300,d:450},reinforcement:{Av:200,s:150},materials:{fc:30,fy:500,lambda:1}});
assert.equal(rcShear.ok,true);assert.ok(rcShear.details.Vc>0&&rcShear.details.Vs>0);

const gross=steelGrossYieldStrengths({profile,section:{Ag:5000,Zy:500000,Zz:250000,Aw:2000},materials:{Fy:350}});
near(gross.design.tension,1575);near(gross.design.momentY,157.5);near(gross.design.momentZ,78.75);near(gross.design.shear,378);
const steel=steelMemberDesign({profile,demand:{Pu:300,Muy:70,Muz:20,Vu:100,axialMode:'compression'},resistances:{compression:1200,tension:gross.design.tension,momentY:gross.design.momentY,momentZ:gross.design.momentZ,shear:gross.design.shear}});
assert.equal(steel.length,5);assert.ok(steel.every(c=>c.ok===true));

const bearing=rectangularFootingContact({profile,demand:{N:600,Mx:60,My:30},footing:{B:2,L:3},soil:{qDesign:150}});
assert.equal(bearing.ok,true);near(bearing.details.qmax,135);near(bearing.details.qmin,65);near(bearing.utilization,.9);assert.equal(bearing.details.fullContact,true);
const uplift=rectangularFootingContact({profile,demand:{N:600,Mx:500,My:0},footing:{B:2,L:3},soil:{qDesign:150}});
assert.ok(uplift.details.qmin<0);assert.equal(uplift.ok,null);assert.equal(uplift.resistance,null);assert.equal(uplift.utilization,null);

const sliding=foundationSlidingDesign({profile,demand:{N:600,Hx:30,Hy:40},footing:{B:2,L:3}});
near(sliding.demand,50);near(sliding.resistance,270);assert.equal(sliding.ok,true);
const overturning=foundationOverturningDesign({profile,stabilizingMoment:300,overturningMoment:100});
near(overturning.demand,150);near(overturning.resistance,300);near(overturning.utilization,.5);assert.equal(overturning.ok,true);
const punching=foundationPunchingDesign({profile,demand:{Vu:700},geometry:{b0:4000,d:400},materials:{fc:25,lambda:1}});
near(punching.resistance,1020);assert.equal(punching.ok,true);
const oneWay=foundationOneWayShearDesign({profile,demand:{Vu:400},geometry:{bw:2000,d:400},materials:{fc:25,lambda:1}});
near(oneWay.resistance,510);assert.equal(oneWay.ok,true);
const footingFlex=foundationFlexureStripDesign({profile,demand:{Mu:200},strip:{d:450},reinforcement:{As:2000},materials:{fy:500}});
near(footingFlex.resistance,364.5);assert.equal(footingFlex.ok,true);

const pending=designCheck({id:'licensed-coefficient-pending',discipline:'Foundation',limitState:'Parâmetro normativo ausente',demand:1,resistance:null,profile});
assert.equal(pending.ok,null);assert.equal(pending.utilization,null);
const result=summarizeCodeDesign({profile,combinationId:'ULS-1',checks:[rcFlex,rcShear,...steel,bearing,sliding,overturning,punching,oneWay,footingFlex,pending]});
assert.equal(result.contract,CODE_DESIGN_CONTRACT);assert.equal(result.summary.fail,0);assert.equal(result.summary.pending,1);assert.ok(result.summary.pass>=14);
const result2=summarizeCodeDesign({profile,combinationId:'ULS-2',checks:[designCheck({id:'governing-demo',discipline:'Steel',limitState:'benchmark',demand:95,resistance:100,profile})]});
const envelope=governingAcrossCombinations([{combinationId:'ULS-1',result},{combinationId:'ULS-2',result:result2}]);
assert.equal(envelope.contract,'code-design-envelope/v1');assert.ok(envelope.governing.utilization>=.95-1e-12);

console.log('AstraStruct v0.43 code design smoke: RC, steel and foundation checks, explicit provenance, pending licensed data and combination envelope coherent.');
