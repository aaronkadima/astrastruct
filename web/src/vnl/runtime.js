import { solve } from '../solver/index.js';
import { compileVnlGraph } from './compiler.js';
import { VNL_EXECUTION_CONTRACT, VNL_VERSION } from './contracts.js';

function incomingEdge(graph, nodeId, port) {
  return graph.edges.find(edge => edge.to.nodeId === nodeId && edge.to.port === port);
}

function metricSeries(result, metric = 'displacementMagnitude') {
  if (metric === 'frequencyHz') {
    const modes = result?.modal?.modes || result?.modes || [];
    return modes.map(mode => ({ key: `mode-${mode.mode}`, x: Number(mode.mode), value: Number(mode.frequencyHz) || 0 }));
  }
  if (metric === 'loadFactor') {
    const history = result?.nonlinear?.history || [];
    return history.map((step, index) => ({ key: `step-${index + 1}`, x: index + 1, value: Number(step.loadFactor ?? step.lambda ?? 0) || 0 }));
  }
  const displacements = result?.totalDisplacements || result?.displacements || [];
  return displacements.map((item, index) => {
    let value = 0;
    if (metric === 'ux') value = Number(item.ux) || 0;
    else if (metric === 'uy') value = Number(item.uy) || 0;
    else if (metric === 'uz') value = Number(item.uz) || 0;
    else if (metric === 'rz') value = Number(item.rz) || 0;
    else value = Math.hypot(Number(item.ux) || 0, Number(item.uy) || 0, Number(item.uz) || 0);
    return { key: item.nodeId || `node-${index + 1}`, x: index + 1, value };
  });
}

function serializeArtifact(source, descriptor) {
  const format = descriptor.format || 'json';
  if (format !== 'json') throw new Error(`VNL: formato de exportação ainda não suportado pelo runtime: ${format}.`);
  return {
    contract: 'vnl-export-artifact/v1',
    format,
    fileName: descriptor.fileName || 'astrastruct-vnl-result.json',
    mimeType: 'application/json',
    content: JSON.stringify(source, null, 2),
  };
}

export function executeVnlGraph(graph, project) {
  const compiled = compileVnlGraph(graph, project);
  const values = new Map(), results = [], plots = [], artifacts = [], trace = [];
  const nodeMap = new Map(compiled.graph.nodes.map(node => [node.id, node]));

  for (const descriptor of compiled.solvers) {
    const result = solve(descriptor.project, descriptor.scenarioId);
    values.set(`${descriptor.nodeId}:result`, result);
    results.push({
      nodeId: descriptor.nodeId,
      label: descriptor.label,
      scenarioId: descriptor.scenarioId,
      analysisType: descriptor.analysisType,
      result,
    });
    trace.push({ nodeId: descriptor.nodeId, type: 'Solver', status: 'success', analysisType: descriptor.analysisType, scenarioId: descriptor.scenarioId });
  }

  for (const nodeId of compiled.validation.order) {
    const node = nodeMap.get(nodeId);
    if (!node || node.enabled === false || node.type === 'Solver') continue;
    if (node.type === 'Result') {
      const edge = incomingEdge(compiled.graph, node.id, 'result');
      const result = edge ? values.get(`${edge.from.nodeId}:${edge.from.port}`) : undefined;
      values.set(`${node.id}:result`, result);
      trace.push({ nodeId: node.id, type: node.type, status: result ? 'success' : 'empty' });
    } else if (node.type === 'Plot') {
      const edge = incomingEdge(compiled.graph, node.id, 'result');
      const result = edge ? values.get(`${edge.from.nodeId}:${edge.from.port}`) : undefined;
      if (!result) throw new Error(`VNL: Plot ${node.id} não recebeu resultado executado.`);
      const plot = {
        contract: 'vnl-plot/v1',
        nodeId: node.id,
        label: node.params?.label || node.id,
        metric: node.params?.metric || 'displacementMagnitude',
        series: metricSeries(result, node.params?.metric || 'displacementMagnitude'),
        analysisType: result.analysisType || null,
        scenarioId: result.scenario?.id || null,
      };
      values.set(`${node.id}:plot`, plot);
      plots.push(plot);
      trace.push({ nodeId: node.id, type: node.type, status: 'success', metric: plot.metric });
    } else if (node.type === 'Export') {
      const resultEdge = incomingEdge(compiled.graph, node.id, 'result');
      const plotEdge = incomingEdge(compiled.graph, node.id, 'plot');
      const source = resultEdge ? values.get(`${resultEdge.from.nodeId}:${resultEdge.from.port}`) : plotEdge ? values.get(`${plotEdge.from.nodeId}:${plotEdge.from.port}`) : undefined;
      if (!source) throw new Error(`VNL: Export ${node.id} não recebeu dado para serializar.`);
      const artifact = serializeArtifact(source, node.params || {});
      values.set(`${node.id}:artifact`, artifact);
      artifacts.push({ nodeId: node.id, ...artifact });
      trace.push({ nodeId: node.id, type: node.type, status: 'success', format: artifact.format });
    } else {
      trace.push({ nodeId: node.id, type: node.type, status: 'compiled' });
    }
  }

  const resultNodes = compiled.graph.nodes.filter(node => node.enabled !== false && node.type === 'Result');
  const primaryResult = resultNodes.map(node => values.get(`${node.id}:result`)).find(Boolean) || results[0]?.result || null;

  return {
    contract: VNL_EXECUTION_CONTRACT,
    version: VNL_VERSION,
    graphId: compiled.graph.id,
    graphName: compiled.graph.name,
    executionPlan: compiled.executionPlan,
    results,
    primaryResult,
    plots,
    artifacts,
    trace,
  };
}
