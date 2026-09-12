# AstraStruct v0.25.1 — Architecture Consolidation

## Objetivo
A v0.25.1 interrompe deliberadamente a expansão de métodos numéricos para consolidar contratos necessários às próximas famílias 3D, shell/solid, componentes e verificação normativa. O objetivo é reduzir acoplamento sem invalidar JSONs, UI ou solvers v0.11–v0.25.

## Project schema e migrations
- `PRODUCT_VERSION = 0.25.1`;
- `PROJECT_SCHEMA_VERSION = 2`;
- projetos sem `schemaVersion` são tratados como schema legado v1;
- a migração v1→v2 preserva o bloco `settings`, cria `analysis-config/v1`, registra a migração em `meta.migrations` e adiciona provenance de produto/schema;
- projetos de schema futuro são recusados explicitamente em vez de serem interpretados silenciosamente.

O campo histórico `version: 13` permanece somente por compatibilidade temporária com arquivos existentes e não é mais a fonte de verdade do schema.

## AnalysisConfig
As configurações passam a possuir representação agrupada em cinco domínios:
- `modeling`;
- `static`;
- `nonlinear`;
- `dynamics`;
- `seismic`.

Durante a migração da interface, `settings` continua aceito. O normalizador sincroniza a representação agrupada, permitindo que os painéis React atuais continuem funcionando enquanto novos módulos podem consumir um contrato estável.

## ElementRegistry
O registry descreve tipos de elementos independentemente do solver. Na v0.25.1 são registrados:
- `truss2d`;
- `frame2d`.

Cada definição declara dimensão, DOFs por nó, número de nós e capacidades. A v0.26 pode registrar `truss3d` e `frame3d` sem inserir condicionais de tipo no modelo central.

## SolverRegistry
Os solvers existentes são descritos por `id`, tipo de análise, dimensão, conjunto de elementos e capacidades. A seleção linear deixa de depender de uma lista implícita espalhada pelo dispatcher e passa a ter um catálogo consultável.

## Analysis/Result contracts
`createAnalysisRequest()` registra dimensão, conjunto/tipos de elementos, cenário, AnalysisConfig e solver selecionado.

Todo resultado entregue pelo dispatcher recebe `structural-result/v1` com:
- versão do contrato;
- identificação de projeto/cenário;
- dimensão e element set;
- solver selecionado;
- `productVersion`;
- `projectSchemaVersion`;
- versão numérica do solver quando disponível.

Isso prepara persistência, auditoria, exportadores e futura execução remota sem acoplar esses consumidores ao formato interno de cada kernel.

## RuleEngineRegistry
A v0.25.1 cria somente o contrato de plugins normativos. Nenhuma NBR/ACI/AISC/Eurocode é implementada nesta versão. Um rule set deve declarar `id`, código, edição, escopo, provenance e `evaluate(input, context)`, retornando `rule-result/v1`.

A separação é intencional: fórmulas normativas não devem entrar nos solvers de elementos finitos nem ficar distribuídas pela UI.

## Compatibilidade
A arquitetura consolidada não altera as formulações v0.11–v0.25. A regressão completa permanece o gate de aceitação. A próxima versão planejada, v0.26, adicionará uma fundação estrutural 3D **linear** sobre esses contratos antes de transportar P-Delta, co-rotacional, plasticidade ou dinâmica não linear para 3D.
