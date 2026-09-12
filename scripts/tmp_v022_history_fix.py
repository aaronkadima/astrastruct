from pathlib import Path

p=Path('web/src/solver/materialNonlinear2d.js')
s=p.read_text()
old="  const connectionResolver = embeddedConnectionResolver(project, hinges, options);\n  const result = solveGlobal(project, scenarioId, { ...options, connectionResolver });"
new="  const connectionResolver = embeddedConnectionResolver(project, hinges, effectiveOptions);\n  const result = solveGlobal(project, scenarioId, { ...effectiveOptions, connectionResolver });"
if old not in s:
    if new not in s:
        raise SystemExit('embedded effective-options anchor missing')
else:
    s=s.replace(old,new)
p.write_text(s)

p=Path('tests/cyclic-hinge-smoke.mjs')
s=p.read_text()
anchor="assert(result.materialNonlinearity.maxEquivalentPlasticStrain>0,'global cyclic hinge should accumulate plastic demand');\n"
virgin_line="const virgin=solveFrameCorotationalFiberHinges2D(project,'LC1',{controlMode:'displacement',steps:5,maxIterations:100,tolerance:1e-8,absoluteTolerance:1e-9,lineSearch:true,displacementTolerance:1e-7,displacementControl:{nodeId:'N2',dof:'uy',targetDisplacement:-.06},cyclicProtocol:{enabled:true,targets:[-.06],stepsPerSegment:5},materialMaxIterations:50,materialTolerance:1e-5,materialRelaxation:.75});\n"
energy_line="assert(result.materialNonlinearity.cumulativeDissipatedEnergy>virgin.materialNonlinearity.cumulativeDissipatedEnergy,'prior reversals must increase committed dissipated energy');\n"
if "cyclic hinge final equilibrium must depend on committed prior history" in s:
    s=s.replace("assert(Math.abs(result.pushover.finalLoadFactor-virgin.pushover.finalLoadFactor)>1e-4,'cyclic hinge final equilibrium must depend on committed prior history');\n","")
if "prior reversals must increase committed dissipated energy" not in s:
    if anchor not in s: raise SystemExit('benchmark anchor missing')
    s=s.replace(anchor,anchor+virgin_line+energy_line)
elif "const virgin=" not in s:
    if anchor not in s: raise SystemExit('benchmark anchor missing')
    s=s.replace(anchor,anchor+virgin_line)
p.write_text(s)
