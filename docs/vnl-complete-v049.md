# AstraStruct v0.49 — VNL completa

## Estado final

A v0.49 está formalmente fechada no branch `develop` como **AstraStruct 0.49.0**. O fechamento atualiza `package.json` e `PRODUCT_VERSION = 0.49.0`, mantendo `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0`.

Este ciclo foi dedicado exclusivamente à conclusão da **VNL — Visual Nonlinear Language**. Nenhuma nova ampliação funcional IFC/BIM foi incluída. Nenhuma promoção para `main` foi realizada.

## Arquitetura

A VNL v0.49 usa o contrato `visual-nonlinear-language/v2` com versão interna `0.49.0-exp`. O grafo é um DAG tipado, persistente e validável, com nós, portas nomeadas e arestas explícitas. Os tipos de porta distinguem modelo estrutural, resultado de análise, descritor de plot e artefato de exportação.

O pipeline de referência é:

`Geometry -> Material/Section/Boundary/Load -> modificadores de análise -> Solver -> Result -> Plot/Export`

A VNL não implementa um solver estrutural paralelo. O compilador produz configuração compatível com `analysis-config/v1` e `executeVnlGraph()` chama exclusivamente o `solve()` público do AstraStruct.

## Validação do grafo

Antes da execução são bloqueados IDs duplicados, portas inexistentes, tipos incompatíveis, entradas obrigatórias ausentes, múltiplas ligações na mesma entrada, ciclos, blocos desconectados e Solver sem Result. A execução só é habilitada quando o DAG está estruturalmente válido.

O branching é suportado explicitamente: um mesmo modelo pode alimentar múltiplos Solver/Result e um Result pode alimentar diferentes blocos Plot/Export.

## Catálogo executável

O catálogo final inclui Geometry, Mesh, Material, Section, Reinforcement, Boundary, Connection, Load, Combination, Material Nonlinearity, Geometric Nonlinearity, Increment, Convergence, Contact, Solver, Result, Plot e Export.

Os blocos de análise alteram apenas parâmetros reconhecidos pelo kernel. Eles não inventam propriedades constitutivas, contatos ou capacidades numéricas ausentes no modelo; a autoridade final continua sendo o solver público.

## Modos de análise

O gate determinístico comprova execução pela VNL dos seis modos já existentes no kernel: **Linear, P-Delta, co-rotacional, modal, time-history e response-spectrum**. Parâmetros de incremento, controle e convergência são compilados para a configuração estrutural existente.

## Runtime e resultados

`executeVnlGraph()` normaliza e valida o DAG, compila o plano, executa cada Solver, propaga Results, produz séries Plot e serializa Export JSON. O retorno contém trace, resultados, plots, artefatos e `primaryResult`.

O `primaryResult` é reutilizado pela área principal **Resultados** da aplicação, portanto a VNL não mantém uma visualização isolada do restante do produto.

## Persistência

O grafo validado é salvo no projeto em:

`project.vnl = { contract: 'project-vnl/v1', version: '0.49.0-exp', graph }`

Projetos sem o campo recebem um grafo padrão. A extensão continua aditiva e, por isso, o schema persistido permanece na versão 2.

## Editor React

O editor React é a superfície oficial da VNL. Ele permite criar, remover e ordenar blocos, editar parâmetros, construir conexões tipadas, restaurar o pipeline padrão, criar ramos paralelos, salvar o grafo, executar e apresentar erros de compilação/runtime.

O acesso ocorre pelo comando **VNL** já integrado à interface do AstraStruct. O launcher flutuante experimental foi retirado da camada de interação para evitar sobreposição com comandos de canvas, IFC ou navegação em diferentes viewports.

## Verificação de fechamento

O fechamento exige, no mesmo estado do código:

- release gate v0.49, runtime smoke e multi-mode smoke;
- toda a suíte estrutural histórica preservada;
- typecheck e build Vite;
- intercâmbio IFC persistente sem regressão;
- validação externa IFC4X3/EXPRESS com IfcOpenShell;
- regressão Playwright em **desktop, Android e tablet**;
- VNL executável, branching, Plot/Export, persistência e integração com Resultados.

O commit funcional imediatamente anterior ao release gate passou integralmente esses gates. O commit formal 0.49.0 é submetido novamente à mesma matriz antes de ser considerado fechado para desenvolvimento.

## Roadmap bloqueado

Com a VNL concluída, a próxima versão planejada é **v0.50 — Reliability + Optimization**. Recursos de IA, automation e digital engineering permanecem reservados para **v0.51+** e não fazem parte da v0.49.

## Publicação

Todo o fechamento ocorre em `develop`. `main` permanece como canal estável/publicado e não será alterada sem solicitação explícita do usuário. **Nenhuma promoção para `main`** faz parte deste gate.
