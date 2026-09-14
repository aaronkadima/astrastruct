# AstraStruct v0.49 — VNL completa

## Estado

A v0.49 está em desenvolvimento exclusivamente no branch `develop` como **0.49.0-exp**. Enquanto o gate final não for fechado, `PRODUCT_VERSION` e `package.json` permanecem em **0.48.0** e `main` não é alterado.

Esta versão é a recuperação explícita do roadmap: **v0.49 = VNL completa**. Nenhuma ampliação funcional de IFC/BIM faz parte deste ciclo.

## Objetivo

Transformar a VNL — Visual Nonlinear Language — de um painel declarativo em uma linguagem visual executável, persistente e validável, reutilizando o kernel estrutural existente em vez de duplicar solvers.

Pipeline de referência:

`Geometry -> Material/Section/Boundary/Load -> Analysis modifiers -> Solver -> Result -> Plot/Export`

O runtime compila o grafo para `analysis-config/v1` e chama exclusivamente o `solve()` público do AstraStruct.

## Contratos experimentais v0.49

- `visual-nonlinear-language/v2` — `0.49.0-exp`;
- `vnl-compiled-plan/v1`;
- `vnl-execution/v1`;
- `project-vnl/v1`;
- `vnl-plot/v1`;
- `vnl-export-artifact/v1`.

## Grafo tipado

A VNL v0.49 usa um DAG explícito com:

- nós com ID, tipo, parâmetros, estado habilitado e posição visual;
- arestas com origem/destino e portas nomeadas;
- tipos de porta `structural-model`, `analysis-result`, `plot-descriptor` e `export-artifact`;
- validação de IDs duplicados;
- validação de existência e tipo das portas;
- uma única ligação por porta de entrada;
- entradas obrigatórias;
- detecção de ciclos;
- detecção de blocos desconectados;
- garantia de que cada `Solver` alimenta ao menos um `Result`;
- uma única fonte `Geometry` por execução.

O branching é permitido por múltiplas arestas de saída. Um mesmo modelo pode alimentar mais de um `Solver`, e um `Result` pode alimentar diferentes blocos de pós-processamento.

## Catálogo de blocos

O catálogo v0.49 inclui:

- Geometry;
- Mesh;
- Material;
- Section;
- Reinforcement;
- Boundary;
- Connection;
- Load;
- Combination;
- Material Nonlinearity;
- Geometric Nonlinearity;
- Increment;
- Convergence;
- Contact;
- Solver;
- Result;
- Plot;
- Export.

Blocos de modelagem/engenharia passam o `structural-model` adiante. Eles não fabricam capacidades numéricas inexistentes: o solver público continua sendo a autoridade para aceitar ou rejeitar uma combinação de modelo/análise.

## Compilação para AnalysisConfig

Os modificadores VNL escrevem somente configurações já reconhecidas pelo núcleo:

- `Geometric Nonlinearity` -> `linear`, `pdelta` ou `corotational`;
- `Material Nonlinearity` -> execução co-rotacional quando habilitado, deixando o próprio solver verificar se há constitutivos compatíveis;
- `Increment` -> passos, controle de carga/deslocamento/arc-length e parâmetros relacionados;
- `Convergence` -> iterações, tolerância e line search;
- `Solver` -> tipo de análise e cenário.

O resultado é sincronizado com `analysis-config/v1` antes da execução.

## Runtime

`executeVnlGraph()`:

1. normaliza e valida o DAG;
2. compila o plano;
3. executa cada `Solver` usando `solve()`;
4. propaga resultados pelos blocos `Result`;
5. produz séries determinísticas em `Plot`;
6. serializa `Export` em artefato JSON quando solicitado;
7. retorna trace, resultados, plots, artefatos e `primaryResult`.

A VNL não contém uma segunda implementação de análise estrutural.

## Persistência

O grafo validado pode ser armazenado no próprio projeto sob:

`project.vnl = { contract: 'project-vnl/v1', version: '0.49.0-exp', graph }`

Projetos sem esse campo recebem um grafo padrão. O campo é aditivo durante o gate experimental e não altera ainda `PROJECT_SCHEMA_VERSION = 2`.

## Critérios para considerar a VNL completa

O fechamento v0.49 somente poderá ocorrer quando todos os itens abaixo estiverem atendidos no mesmo commit final:

1. DAG tipado e validação estrutural;
2. compilação para `analysis-config/v1`;
3. execução real pelo `solve()` público;
4. suporte aos modos Linear, P-Delta, co-rotacional, modal, time-history e response-spectrum já existentes no kernel;
5. parâmetros de incremento e convergência editáveis;
6. branching com múltiplos Solver/Result;
7. Plot e Export executáveis;
8. persistência no projeto e round-trip JSON;
9. editor React conectado ao runtime, sem painel meramente demonstrativo;
10. possibilidade de criar, remover, ordenar/conectar blocos e editar seus parâmetros;
11. apresentação de erros de compilação/execução na interface;
12. resultado VNL reutilizável pelo painel principal de resultados;
13. smoke tests determinísticos;
14. regressão Playwright desktop, Android e tablet;
15. toda a suíte estrutural histórica verde.

## Gate atual

O primeiro smoke da v0.49 cobre:

- grafo padrão válido;
- execução linear real;
- compilação co-rotacional com Increment/Convergence;
- branching com dois solvers;
- Plot;
- Export JSON;
- persistência/reabertura do grafo;
- rejeição de incompatibilidade de portas;
- rejeição de ciclos.

A versão **não deve ser marcada como 0.49.0** até que o editor React e os demais critérios acima estejam concluídos e validados.

## Regra de roadmap

Após o fechamento da v0.49, a próxima versão planejada é **v0.50 — Reliability + Optimization**. IA/automation/digital engineering permanece reservada para **v0.51+**. Não iniciar esses módulos antes do gate final da VNL.

## Regra de publicação

Todo o trabalho ocorre em `develop`. `main` permanece estável e intocada até solicitação explícita de promoção/publicação.
