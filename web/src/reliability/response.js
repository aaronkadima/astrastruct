function magnitude(record,keys){return Math.hypot(...keys.map(k=>Number(record?.[k])||0));}
function scalar(record,component,vectorKeys){if(component==='magnitude')return magnitude(record,vectorKeys);const value=Number(record?.[component]);if(!Number.isFinite(value))throw new Error(`Componente de resposta ausente ou não finita: ${component}.`);return value;}
function maybeAbs(value,selector){return selector.absolute===false?value:Math.abs(value);}
export function extractResponse(result,selector={}){
  const type=selector.type;
  if(type==='node-displacement'){
    const row=(result.displacements||result.totalDisplacements||[]).find(x=>String(x.nodeId)===String(selector.nodeId));if(!row)throw new Error(`Deslocamento do nó ${selector.nodeId} não encontrado.`);return maybeAbs(scalar(row,selector.component||'magnitude',['ux','uy','uz']),selector);
  }
  if(type==='max-node-displacement'){
    const rows=result.displacements||result.totalDisplacements||[];if(!rows.length)throw new Error('Resultado sem deslocamentos nodais.');return Math.max(...rows.map(row=>maybeAbs(scalar(row,selector.component||'magnitude',['ux','uy','uz']),selector)));
  }
  if(type==='reaction'){
    const row=(result.reactions||[]).find(x=>String(x.nodeId)===String(selector.nodeId));if(!row)throw new Error(`Reação do nó ${selector.nodeId} não encontrada.`);return maybeAbs(scalar(row,selector.component||'fy',['fx','fy','fz']),selector);
  }
  if(type==='element-force'){
    const row=(result.elementForces||[]).find(x=>String(x.elementId)===String(selector.elementId));if(!row)throw new Error(`Força do elemento ${selector.elementId} não encontrada.`);return maybeAbs(scalar(row,selector.component||'N',[]),selector);
  }
  if(type==='max-element-force'){
    const rows=result.elementForces||[];if(!rows.length)throw new Error('Resultado sem forças de elementos.');return Math.max(...rows.map(row=>maybeAbs(scalar(row,selector.component||'N',[]),selector)));
  }
  if(type==='stress-extreme'){
    const responses=result.elementResponses||[];const stations=responses.filter(r=>!selector.elementId||String(r.elementId)===String(selector.elementId)).flatMap(r=>r.stations||[]);if(!stations.length)throw new Error('Resultado sem estações de tensão compatíveis.');
    const components=selector.component==='sigmaExtreme'||!selector.component?['sigmaTop','sigmaBottom','sigmaAxial']:[selector.component];let max=0;for(const s of stations)for(const c of components){const v=Number(s?.[c]);if(Number.isFinite(v))max=Math.max(max,Math.abs(v));}return max;
  }
  throw new Error(`Seletor de resposta não suportado: ${type}.`);
}
export function evaluateLimitState(result,limitState={}){
  const demand=extractResponse(result,limitState.selector),capacity=Number(limitState.capacity);if(!Number.isFinite(capacity))throw new Error('Estado limite exige capacity numérica finita.');
  const sense=limitState.sense||'demand<=capacity',g=sense==='demand>=capacity'?demand-capacity:capacity-demand;if(!['demand<=capacity','demand>=capacity'].includes(sense))throw new Error(`Sentido de estado limite não suportado: ${sense}.`);
  return{demand,capacity,g,failure:g<=0,sense};
}
