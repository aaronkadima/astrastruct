import { inferProjectDimension, classifyElementSet } from './elementRegistry.js';
import { findSolver } from './solverRegistry.js';
import { resolveAnalysisConfig } from './analysisConfig.js';
import { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION, RESULT_CONTRACT_VERSION } from './version.js';

export function createAnalysisRequest(project = {}, scenarioId = null) {
  const analysis = resolveAnalysisConfig(project);
  const analysisType = analysis.static?.analysisType || project.settings?.analysisType || 'linear';
  const dimension = inferProjectDimension(project);
  const elementSet = classifyElementSet(project);
  const solver = findSolver({ analysisType, dimension, elementSet });
  return {
    contract: 'analysis-request/v1',
    contractVersion: RESULT_CONTRACT_VERSION,
    productVersion: PRODUCT_VERSION,
    projectSchemaVersion: Number(project.schemaVersion || PROJECT_SCHEMA_VERSION),
    projectId: project.id || null,
    scenarioId: scenarioId || project.settings?.analysisScenarioId || null,
    model: {
      dimension,
      elementSet,
      elementTypes: [...new Set((project.elements || []).map(e => e.type))],
      nodeCount: (project.nodes || []).length,
      elementCount: (project.elements || []).length,
    },
    analysis: {
      type: analysisType,
      solverId: solver?.id || null,
      configuration: analysis,
    },
  };
}

function publishContractedResult(project,result){
  if(typeof globalThis?.dispatchEvent!=='function'||typeof globalThis?.CustomEvent!=='function')return;
  try{globalThis.dispatchEvent(new globalThis.CustomEvent('astrastruct:solver-result',{detail:{project,result}}))}catch{}
}

export function attachResultContract(project, scenarioId, result = {}) {
  const request = createAnalysisRequest(project, scenarioId);
  const contracted={
    ...result,
    contract: {
      name: 'structural-result/v1',
      version: RESULT_CONTRACT_VERSION,
      request: {
        projectId: request.projectId,
        scenarioId: request.scenarioId,
        model: request.model,
        analysisType: request.analysis.type,
        solverId: request.analysis.solverId,
      },
      provenance: {
        product: 'AstraStruct',
        productVersion: PRODUCT_VERSION,
        projectSchemaVersion: request.projectSchemaVersion,
        solverVersion: result.solverVersion || result.version || null,
      },
    },
  };
  publishContractedResult(project,contracted);
  return contracted;
}
