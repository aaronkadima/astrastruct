import{solve as solveKernel}from'./index.js';
import{inferProjectDimension}from'../core/elementRegistry.js';
import{buildEngineeringVisualization3D}from'./engineeringVisualization3d.js';

export const ENGINEERING_SOLVER_FACADE_VERSION='0.54.0-exp';

export function solveEngineering(project,scenarioId){
  const result=solveKernel(project,scenarioId);
  if(inferProjectDimension(project)!=='3d')return result;
  return{...result,engineeringVisualization:buildEngineeringVisualization3D(project,result),engineeringSolverFacade:ENGINEERING_SOLVER_FACADE_VERSION};
}
