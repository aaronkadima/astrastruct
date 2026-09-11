import {solveTruss2D} from './truss2d.js';
import {solveFrame2D} from './frame2d.js';
export function solve(project){
  const types=new Set(project.elements.map(e=>e.type));
  if(types.size===1&&types.has('truss2d'))return solveTruss2D(project);
  if(types.size===1&&types.has('frame2d'))return solveFrame2D(project);
  throw new Error('O MVP atual resolve modelos compostos exclusivamente por treliça 2D ou exclusivamente por pórtico 2D. Solver misto está no roadmap.');
}
