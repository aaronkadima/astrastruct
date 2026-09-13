import assert from 'node:assert/strict';
import {
  SparseMatrixBuilder,csrFromDense,solveSparseDirect,solveConjugateGradient,NumericalSingularityError,
  DofManager,ConstraintManager,solveConstrainedSystem,convertUnit,assertUnitDimension,
  newtonSolve,newtonStrategies,relativeResidual
} from '../web/src/numerics/index.js';
import {solveLinear as legacySolveLinear,solveConstrained as legacySolveConstrained} from '../web/src/solver/matrix.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);

// CSR assembly + deterministic SPD system.
const builder=new SparseMatrixBuilder(3);
builder.addSymmetricBlock([0,1],[[4,-1],[-1,4]]).add(1,2,-1).add(2,1,-1).add(2,2,3);
const A=builder.build();
assert.equal(A.nnz,7);assert.deepEqual(A.matVec([1,2,3]),[2,4,7]);
const direct=solveSparseDirect(A,[2,4,7]);direct.x.forEach((v,i)=>close(v,[1,2,3][i],1e-11,'direct'));
assert.ok(direct.diagnostics.residual.relative<1e-12);assert.equal(direct.diagnostics.rankEstimate,3);
const cg=solveConjugateGradient(A,[2,4,7],{relativeTolerance:1e-12,absoluteTolerance:1e-14});
cg.x.forEach((v,i)=>close(v,[1,2,3][i],1e-10,'CG'));assert.equal(cg.diagnostics.converged,true);
assert.ok(relativeResidual(A,cg.x,[2,4,7]).relative<1e-10);

// Singularity must be explicit and diagnostic, never NaN/Infinity propagation.
assert.throws(()=>solveSparseDirect(csrFromDense([[1,2],[2,4]]),[3,6]),error=>{
  assert.ok(error instanceof NumericalSingularityError);assert.equal(error.code,'ASTRA_NUMERICAL_SINGULARITY');assert.equal(error.diagnostics.rankEstimate,1);return true;
});

// Generic DOF manager.
const dofs=new DofManager();const n1=dofs.registerNode('N1',['ux','uy']),n2=dofs.registerNode('N2',['ux','uy']);
assert.deepEqual(n1,{ux:0,uy:1});assert.deepEqual(n2,{ux:2,uy:3});assert.equal(dofs.count,4);assert.equal(dofs.get('N2','uy'),3);

// Exact master-slave constraint: u2 = u1, u0=u3=0.
const K=csrFromDense([[10,0,0,0],[0,20,0,0],[0,0,30,0],[0,0,0,40]]),F=[0,20,30,0];
const constraints=new ConstraintManager().prescribe(0,0).equalDOF(2,1).prescribe(3,0);
const transformed=solveConstrainedSystem(K,F,constraints,{enforcement:'transformation',linearSolver:{method:'direct'}});
assert.equal(transformed.reduced.roots.length,1);close(transformed.u[0],0);close(transformed.u[1],1);close(transformed.u[2],1);close(transformed.u[3],0);
const lagrange=solveConstrainedSystem(K,F,constraints,{enforcement:'lagrange'});lagrange.u.forEach((v,i)=>close(v,[0,1,1,0][i],1e-10,'Lagrange'));
assert.equal(lagrange.multipliers.length,3);

// Legacy matrix API must now route through the same numerical core without changing its result shape.
legacySolveLinear(A.toDense(),[2,4,7]).forEach((v,i)=>close(v,[1,2,3][i],1e-11,'legacy direct'));
const legacy=legacySolveConstrained([[10,0],[0,20]],[0,40],new Map([[0,0]]));
close(legacy.u[0],0);close(legacy.u[1],2);assert.deepEqual(legacy.free,[1]);assert.equal(legacy.numericalDiagnostics.enforcement,'transformation');

// Dimensional unit layer.
close(convertUnit(30,'MPa','Pa'),30e6);close(convertUnit(12.5,'kN*m','N*m'),12500);close(convertUnit(1,'g','m/s2'),9.80665,1e-12);
assert.equal(assertUnitDimension('mm','length'),true);assert.throws(()=>convertUnit(1,'m','kN'),/dimensional inválida/);

// Newton with sparse-compatible tangent and explicit convergence policy.
const sqrt2=newtonSolve({
  initial:[1],residual:([x])=>[x*x-2],tangent:([x])=>[[2*x]],strategy:'full',
  tolerances:{absoluteResidual:1e-12,relativeResidual:1e-12,absoluteIncrement:1e-12,relativeIncrement:1e-12,maxIterations:12},
  linearSolver:{method:'direct'}
});
close(sqrt2.x[0],Math.SQRT2,1e-11,'Newton sqrt(2)');assert.equal(sqrt2.converged,true);assert.ok(sqrt2.iterations<=8);
assert.deepEqual(newtonStrategies(),['full','modified','line-search']);

console.log('AstraStruct v0.32 Numerical Core 2 smoke: CSR, direct/CG, singularity, DOF, MPC, units, Newton and legacy bridge OK.');
