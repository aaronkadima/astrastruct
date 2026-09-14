import{ENGINEERING_ADVISOR_CONTRACT,ENGINEERING_ADVISOR_VERSION}from'./contracts.js';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const severityRank={blocker:0,warning:1,info:2,ok:3};
function item(ruleId,severity,title,message,rationale){return{ruleId,severity,title,message,rationale,provider:'astra-rules-v1'};}
function materialVerification(project){
  const mats=Array.isArray(project?.materials)?project.materials:[];
  const unverified=mats.filter(m=>m?.verified!==true);
  if(!mats.length)return item('MODEL.MATERIALS.EMPTY','warning','Materiais não declarados','O projeto não contém materiais explícitos.','A rastreabilidade de propriedades mecânicas exige materiais identificados no modelo.');
  if(unverified.length)return item('MODEL.MATERIALS.UNVERIFIED','warning','Materiais de exemplo/não verificados',`${unverified.length} material(is) não estão marcados como verificados.`,'AstraStruct não converte propriedades de exemplo em dados normativos ou certificados.');
  return item('MODEL.MATERIALS.VERIFIED','ok','Materiais marcados como verificados','Todos os materiais declarados possuem verified=true.','O status é uma declaração do projeto e não substitui rastreabilidade documental externa.');
}
function resultConvergence(result){
  if(!result)return item('ANALYSIS.RESULT.MISSING','info','Análise ainda não executada','Execute a análise para anexar evidência numérica à revisão.','O assistente não presume resultados estruturais ausentes.');
  const nl=result?.nonlinear;
  if(nl&&nl.converged===false)return item('ANALYSIS.NONLINEAR.NOT_CONVERGED','blocker','Análise não linear sem convergência','O resultado não linear informa converged=false.','Resultados sem convergência não devem ser usados como evidência de dimensionamento.');
  return item('ANALYSIS.RESULT.AVAILABLE','ok','Resultado estrutural disponível',`Resultado ${result.analysisType||result.type||'estrutural'} disponível para revisão.`,'A recomendação confirma apenas a disponibilidade do resultado, não sua adequação normativa.');
}
export function runEngineeringAdvisor(project,{result=null,automation=null}={}){
  if(!project||typeof project!=='object')throw new Error('EngineeringAdvisor: projeto é obrigatório.');
  const nodes=Array.isArray(project.nodes)?project.nodes:[],elements=Array.isArray(project.elements)?project.elements:[],supports=Array.isArray(project.supports)?project.supports:[],loads=Array.isArray(project.loads)?project.loads:[],elementLoads=Array.isArray(project.elementLoads)?project.elementLoads:[];
  const items=[];
  if(nodes.length<2)items.push(item('MODEL.NODES.MINIMUM','blocker','Modelo insuficiente',`O projeto possui ${nodes.length} nó(s).`,'Uma análise estrutural requer topologia explicitamente definida; o assistente não cria geometria silenciosamente.'));
  else items.push(item('MODEL.NODES.READY','ok','Topologia nodal disponível',`${nodes.length} nós disponíveis.`,'Verificação estrutural detalhada continua dependente das conectividades e condições de contorno.'));
  if(!elements.length)items.push(item('MODEL.ELEMENTS.EMPTY','blocker','Sem elementos estruturais','Nenhum elemento estrutural foi declarado.','O solver não deve ser acionado para um modelo sem elementos.'));
  else items.push(item('MODEL.ELEMENTS.READY','ok','Elementos estruturais disponíveis',`${elements.length} elemento(s) disponível(is).`,'O tipo e a formulação de cada elemento permanecem explícitos no projeto.'));
  if(!supports.length)items.push(item('MODEL.SUPPORTS.EMPTY','warning','Sem apoios explícitos','Nenhum apoio foi encontrado no projeto.','Modelos sem restrições podem ser singulares; o solver continuará sendo a autoridade para detectar singularidade.'));
  if(loads.length+elementLoads.length===0)items.push(item('MODEL.LOADS.EMPTY','warning','Sem ações explícitas','Não foram encontradas cargas nodais ou de elemento.','Uma análise sem ações pode ser válida para alguns estudos modais, mas não deve ser interpretada como verificação de demanda.'));
  if(project?.meta?.importedFrom?.format==='IFC'&&project?.meta?.analysisReady===false)items.push(item('IFC.ANALYSIS.READY','blocker','IFC ainda não liberado para análise','O modelo IFC possui propriedades mecânicas pendentes.','O próprio contrato do solver bloqueia análise enquanto analysisReady=false.'));
  items.push(materialVerification(project));
  items.push(resultConvergence(result));
  const beta=Number(project?.reliabilityStudy?.lastResult?.beta);
  if(Number.isFinite(beta))items.push(item('RELIABILITY.RESULT.PRESENT','info','Confiabilidade persistida',`O último estudo persistido reporta β=${beta.toFixed(3)}.`,'Compare β/Pf com o alvo declarado pelo projeto; o assistente não aplica valor-alvo normativo implícito.'));
  const best=project?.optimizationStudy?.lastResult?.best;
  if(best)items.push(item('OPTIMIZATION.RESULT.PRESENT',best.feasible===false?'warning':'info','Otimização persistida',best.feasible===false?'A melhor solução persistida não é factível.':'Há uma solução de otimização persistida para revisão.','A aplicação de uma solução otimizada permanece uma ação explícita do usuário.'));
  if(automation?.errors>0)items.push(item('AUTOMATION.ERRORS','warning','Automação com etapas falhas',`${automation.errors} etapa(s) da automação falharam.`,'A trilha digital preserva falhas em vez de ocultá-las.'));
  items.sort((a,b)=>severityRank[a.severity]-severityRank[b.severity]||a.ruleId.localeCompare(b.ruleId));
  const summary={blockers:items.filter(x=>x.severity==='blocker').length,warnings:items.filter(x=>x.severity==='warning').length,info:items.filter(x=>x.severity==='info').length,ok:items.filter(x=>x.severity==='ok').length};
  return{contract:ENGINEERING_ADVISOR_CONTRACT,version:ENGINEERING_ADVISOR_VERSION,provider:{id:'astra-rules-v1',kind:'deterministic',external:false,explainable:true},summary,items:clone(items)};
}
