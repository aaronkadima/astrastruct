import assert from 'node:assert/strict';
import {unitsForAstraStruct,createIfcProjectContext,validateIfcProjectContext} from '../web/src/interop/index.js';

const assignment=unitsForAstraStruct('kN-m-MPa');
const linear=assignment.units.find(x=>x.unitType==='LINEARSTIFFNESSUNIT');
const rotational=assignment.units.find(x=>x.unitType==='ROTATIONALSTIFFNESSUNIT');
assert.ok(linear);assert.ok(rotational);
assert.equal(linear.ifcClass,'IfcDerivedUnit');
assert.deepEqual(linear.elements.map(x=>[x.unitRef,x.exponent]),[['unit:force',1],['unit:length',-1]]);
assert.equal(rotational.ifcClass,'IfcDerivedUnit');
assert.deepEqual(rotational.elements.map(x=>[x.unitRef,x.exponent]),[['unit:force',1],['unit:length',1],['unit:angle',-1]]);
assert.equal(validateIfcProjectContext(createIfcProjectContext()),true);

const broken=createIfcProjectContext();
broken.units.units=broken.units.units.filter(x=>x.unitType!=='LINEARSTIFFNESSUNIT');
assert.throws(()=>validateIfcProjectContext(broken),/LINEARSTIFFNESSUNIT/);

console.log('AstraStruct v0.45 IFC units smoke: linear and rotational stiffness derived units coherent.');
