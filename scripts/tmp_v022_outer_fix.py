from pathlib import Path
p=Path('web/src/solver/materialNonlinear2d.js'); s=p.read_text()
a=s.index('function decorateOuterResult'); b=s.index('function solveOuterCompatibility',a); seg=s[a:b]
cyclic_law="constitutiveLaw: hinges.some(h=>h.config.cyclic)?'incremental cyclic bilinear steel fibers with combined hardening and local N-M equilibrium':'monotonic bilinear steel fibers with local N-M equilibrium',"
seg=seg.replace(cyclic_law,"constitutiveLaw: 'monotonic bilinear steel fibers with local N-M equilibrium',")
cyclic_block="historyDependent: hinges.some(h=>h.config.cyclic),\n    cyclic: hinges.some(h=>h.config.cyclic),\n    cumulativeDissipatedEnergy: records.reduce((a,r)=>a+(Number(r.cumulativeDissipatedEnergy)||0),0),\n    maxEquivalentPlasticStrain: Math.max(0,...records.map(r=>Number(r.maxEquivalentPlasticStrain)||0)),\n    maxReversalCount: Math.max(0,...records.map(r=>Number(r.maxReversalCount)||0)),"
seg=seg.replace(cyclic_block,"historyDependent: false,\n    cyclic: false,")
s=s[:a]+seg+s[b:]; p.write_text(s)
