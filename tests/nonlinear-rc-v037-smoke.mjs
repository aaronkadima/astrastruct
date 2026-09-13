import assert from 'node:assert/strict';
import {
  NONLINEAR_RC_CONTRACT,NONLINEAR_RC_VERSION,RC_CONCRETE_1D_CONTRACT,RC_REBAR_1D_CONTRACT,RC_BOND_SLIP_1D_CONTRACT,RC_SECTION_RESPONSE_CONTRACT,
  concreteDamageState,concreteCrackBandParameters,rebarState,bondSlipState,createRCSectionTransaction,createBondSlipLinkComponent
} from '../web/src/rc/index.js';
import {createRCSection} from '../web/src/sections/index.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const symmetric=(A,tol=1e-9)=>A.every((row,i)=>row.every((v,j)=>Math.abs(v-A[j][i])<=tol*Math.max(1,Math.abs(v),Math.abs(A[j][i]))));

assert.equal(NONLINEAR_RC_CONTRACT,'nonlinear-rc/v1');assert.equal(NONLINEAR_RC_VERSION,'0.37.0-exp');
const concrete={id:'C30',type:'concrete',E:30e6,fck:30,fctm:3,Gf:.1},rebar={id:'CA500',type:'rebar',E:200e6,fy:500};

// Crack-band tension: characteristic length changes terminal strain, never fracture energy.
const p10=concreteCrackBandParameters({material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3}),p05=concreteCrackBandParameters({material:concrete,characteristicLength:.05,fractureEnergy:.1,compressionFractureEnergy:3});
assert.ok(p05.epsTu>p10.epsTu);close(.5*p10.ft*(p10.epsTu-p10.epsCr)*p10.lch,p10.Gf,1e-12,'Gf lch=.10');close(.5*p05.ft*(p05.epsTu-p05.epsCr)*p05.lch,p05.Gf,1e-12,'Gf lch=.05');
const mid=.5*(p10.epsCr+p10.epsTu),tension=concreteDamageState({strain:mid,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});assert.equal(tension.contract,RC_CONCRETE_1D_CONTRACT);close(tension.stress,p10.ft/2,1e-12,'tension mid-softening');assert.ok(tension.tangent<0);assert.equal(tension.cracked,true);assert.ok(tension.history.tensileFractureEnergy>0&&tension.history.tensileFractureEnergy<p10.Gf);
const fullyCracked=concreteDamageState({strain:p10.epsTu,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});close(fullyCracked.stress,0,1e-12);close(fullyCracked.history.tensileFractureEnergy,p10.Gf,1e-12,'fracture energy at complete crack');

// Unilateral closure: committed tensile damage must not degrade the independent compression envelope.
const closed=concreteDamageState({strain:-.001,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3,committed:tension.history});assert.equal(closed.cracked,true);assert.equal(closed.crackClosed,true);close(closed.stress,-22500,1e-12,'compression after crack closure');assert.ok(closed.tangent>0);
const peak=concreteDamageState({strain:-.002,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});close(peak.stress,-30000,1e-12,'compression peak');
const postPeak=concreteDamageState({strain:-.003,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});close(postPeak.stress,-15000,1e-12,'compression softening');assert.ok(postPeak.tangent<0);
const crushed=concreteDamageState({strain:-.004,material:concrete,characteristicLength:.1,fractureEnergy:.1,compressionFractureEnergy:3});assert.equal(crushed.crushed,true);close(crushed.stress,0,1e-12);close(crushed.history.compressiveFractureEnergy,3,1e-12,'compression fracture energy');

// Cyclic reinforcement reuses the validated combined hardening return mapping.
const steel1=rebarState({strain:.004,material:rebar,hardeningRatio:.02,kinematicFraction:1});assert.equal(steel1.contract,RC_REBAR_1D_CONTRACT);assert.equal(steel1.yielded,true);assert.ok(steel1.history.plasticStrain>0&&steel1.history.dissipatedEnergyDensity>0);
const steel2=rebarState({strain:-.004,material:rebar,committed:steel1.history,hardeningRatio:.02,kinematicFraction:1});assert.equal(steel2.yielded,true);assert.ok(steel2.history.reversalCount>=1);assert.ok(steel2.history.dissipatedEnergyDensity>steel1.history.dissipatedEnergyDensity);

// Bond-slip envelope + history-aware unloading/reversal.
const bond={tauMax:10,s1:.001,s2:.002,s3:.004,tauResidual:2,alpha:1};
const b1=bondSlipState({slip:.0005,...bond});assert.equal(b1.contract,RC_BOND_SLIP_1D_CONTRACT);close(b1.traction,5,1e-12,'bond ascending');close(b1.tangent,10000,1e-12);
close(bondSlipState({slip:.0015,...bond}).traction,10,1e-12,'bond plateau');close(bondSlipState({slip:.003,...bond}).traction,6,1e-12,'bond softening');close(bondSlipState({slip:.005,...bond}).traction,2,1e-12,'bond residual');
const committedBond=bondSlipState({slip:.003,...bond}),unload=bondSlipState({slip:.001,committed:committedBond.history,...bond});close(unload.traction,2,1e-12,'bond secant unloading');const reverseBond=bondSlipState({slip:-.001,committed:committedBond.history,...bond});assert.ok(reverseBond.history.reversalCount>=1);

// RC section: exact pre-cracking axial stiffness, then cracking/yielding/crushing with transactional state.
const bars=[[-.1,-.2],[.1,-.2],[-.1,.2],[.1,.2]].map(([y,z],i)=>({id:`B${i+1}`,y,z,diameter:.016})),section=createRCSection({id:'RC1',width:.3,height:.5,concreteMaterial:concrete,rebarMaterial:rebar,bars,ny:12,nz:20}),sectionTx=createRCSectionTransaction({section,options:{characteristicLength:.05,concrete:{fractureEnergy:.1,compressionFractureEnergy:3},rebar:{hardeningRatio:.02,kinematicFraction:1}}});
const axial=sectionTx.response({epsilon0:1e-5,kappaY:0,kappaZ:0}),As=section.metadata.rebarArea,expectedEA=concrete.E*(section.geometry.area-As)+rebar.E*As;assert.equal(axial.contract,RC_SECTION_RESPONSE_CONTRACT);close(axial.resultants.N,expectedEA*1e-5,1e-10,'RC elastic axial');assert.equal(axial.crackedFibers,0);assert.equal(symmetric(axial.tangent),true);
const crackedSection=sectionTx.response({epsilon0:0,kappaY:.004,kappaZ:0});assert.ok(crackedSection.crackedFibers>0);assert.equal(crackedSection.crushedFibers,0);sectionTx.commit();const committedSection=sectionTx.committedHistory();
const severe=sectionTx.response({epsilon0:0,kappaY:.02,kappaZ:0});assert.ok(severe.crackedFibers>0);assert.ok(severe.crushedFibers>0);assert.ok(severe.yieldedBars>0);assert.equal(symmetric(severe.tangent),true);assert.notDeepEqual(sectionTx.trialHistory(),committedSection);sectionTx.rollback();assert.deepEqual(sectionTx.trialHistory(),committedSection);
const reverseSection=sectionTx.response({epsilon0:-.0005,kappaY:0,kappaZ:0});assert.ok(reverseSection.closedCrackFibers>0,'fissuras committed devem fechar em compressão');

// Bond component maps traction to force and honors ElementStateTransaction rollback.
const bondLink=createBondSlipLinkComponent({element:{id:'BL1',type:'bond-slip-link',n1:'C',n2:'S',dofLabel:'ux',bondArea:.01,...bond}}),link1=bondLink.response([0,.0005]);close(link1.outputs.force,.05,1e-12,'bond link force');close(link1.outputs.tangent,100,1e-12,'bond link tangent');bondLink.commit();const linkCommitted=bondLink.committedState();bondLink.response([0,-.001]);assert.notDeepEqual(bondLink.trialState(),linkCommitted);bondLink.rollback();assert.deepEqual(bondLink.trialState(),linkCommitted);

console.log('AstraStruct v0.37 Nonlinear RC smoke: crack-band concrete, cyclic rebar, bond-slip and stateful N-My-Mz RC section OK.');
