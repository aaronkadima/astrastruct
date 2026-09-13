import assert from 'node:assert/strict';
import {evaluateRuleSet,listRuleSets} from '../web/src/rules/registerStructuralCodePlugins.js';

const ids=listRuleSets().map(r=>r.id);
for(const id of ['aisc-360-22-connections','en-1993-1-8-2024-connections','aci-318-25-punching-anchors','nbr-8800-2024vc2025-connections','nbr-6118-2026-punching'])assert.ok(ids.includes(id),`ruleset ${id} ausente`);

const aisc=evaluateRuleSet('aisc-360-22-connections',{blockShear:{demand:300,Fy:345,Fu:450,Agv:1800,Anv:1200,Ant:400,Ubs:1,phi:.75},bearing:{Vu:100,Fu:450,t:10,d:20,Lc:35}});
const block=aisc.checks.find(c=>c.id==='block-shear');assert.ok(block);assert.ok(Math.abs(block.resistance-378)<1e-9);assert.ok(block.ok);assert.equal(aisc.contract,'rule-result/v1');assert.equal(aisc.edition,'2022');

const en=evaluateRuleSet('en-1993-1-8-2024-connections',{bolt:{VEd:45,TEd:0,fub:800,A:245,As:245,planes:1,alphaV:.6,k2:.9,gammaM2:1.25}});
const ens=en.checks.find(c=>c.id==='bolt-shear');assert.ok(ens);assert.ok(Math.abs(ens.resistance-94.08)<1e-9);assert.ok(ens.ok);assert.equal(en.edition,'2024');

const aci=evaluateRuleSet('aci-318-25-punching-anchors',{punching:{Vu:1000,fc:25,b0:3468,d:417,beta:1,alphaS:40,lambda:1,lambdaS:1,phi:.75},anchorTension:{Nu:80,fc:27.6,hef:170,anchorType:'cast-in',phi:.70}});
const punch=aci.checks.find(c=>c.id==='punching-two-way');assert.ok(punch);assert.ok(Math.abs(punch.parameters.vc-1.65)<1e-12);assert.ok(Math.abs(punch.resistance-1789.61805)<1e-5);assert.ok(punch.ok);
const anchor=aci.checks.find(c=>c.id==='anchor-concrete-breakout-tension');assert.ok(anchor);const expectedNb=10*Math.sqrt(27.6)*170**1.5/1000;assert.ok(Math.abs(anchor.parameters.Nb-expectedNb)<1e-9);assert.equal(aci.edition,'2025');

const nbrPending=evaluateRuleSet('nbr-8800-2024vc2025-connections',{boltShear:{demand:90}});assert.equal(nbrPending.checks[0].ok,null);assert.equal(nbrPending.checks[0].resistance,null);assert.equal(nbrPending.provenance.requiresLicensedParameters,true);
const nbrResolved=evaluateRuleSet('nbr-8800-2024vc2025-connections',{boltShear:{demand:90,designResistance:120}});assert.equal(nbrResolved.checks[0].ok,true);assert.equal(nbrResolved.checks[0].utilization,.75);
const nbrPunch=evaluateRuleSet('nbr-6118-2026-punching',{punching:{Vu:500,designPunchingResistanceMPa:1.2,b0:3000,d:200}});assert.equal(nbrPunch.checks[0].resistance,720);assert.equal(nbrPunch.checks[0].ok,true);assert.equal(nbrPunch.provenance.requiresLicensedParameters,true);

console.log('rule-engine-code-plugins-v0311-smoke: ok');
