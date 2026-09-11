import {demoTruss,demoFrame} from '../web/src/core/model.js';
import {solve} from '../web/src/solver/index.js';
for (const p of [demoTruss(),demoFrame()]) {
  const r=solve(p);
  if(!r.displacements.length) throw new Error('no displacements');
  if(r.displacements.some(d=>![d.ux,d.uy,d.rz].every(Number.isFinite))) throw new Error('non-finite result');
  console.log(p.name, 'OK', 'DOFs=',r.dofs);
}
