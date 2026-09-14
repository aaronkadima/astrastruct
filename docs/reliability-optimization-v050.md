# AstraStruct v0.50 — Reliability + Optimization

## Estado
A v0.50 é desenvolvida exclusivamente em `develop` como **0.50.0-exp**. O produto fechado continua em `PRODUCT_VERSION = 0.49.0`; `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0` permanecem inalterados. `main` permanece intocada.

## Arquitetura
A camada probabilística e de otimização reutiliza o `solve()` público: cada amostra/candidato clona o projeto, aplica somente targets explicitamente declarados e executa o mesmo kernel estrutural. Não existe segundo solver nem criação silenciosa de propriedades.

Contratos experimentais: `structural-reliability/v1`, `structural-optimization/v1`, `structural-multiobjective-optimization/v1`, `project-reliability-study/v1` e `project-optimization-study/v1`, todos em `0.50.0-exp` quando aplicável.

## Métodos de confiabilidade
`runMonteCarloReliability()` usa seed reproduzível, retorna `Pf`, `beta`, intervalo de Wilson e estatísticas da demanda. Distribuições explícitas: deterministic, normal, lognormal e uniform.

### Latin Hypercube
`runLatinHypercubeReliability()` implementa Latin Hypercube Sampling com uma estratificação equiprovável por amostra e variável e permutações independentes reproduzíveis por seed. As distribuições são transformadas por quantis explícitos. Nesta etapa o LHS aceita apenas variáveis independentes: `correlationMatrix` é rejeitada, em vez de se aplicar correlação de forma implícita.

`runMvfosmReliability()` implementa MVFOSM no ponto médio por diferenças finitas e não é apresentado como FORM.

### FORM / HL-RF
`runFormReliability()` implementa Hasofer-Lind-Rackwitz-Fiessler no espaço normal padrão. Com `correlationMatrix`, a transformação usa Cholesky. FORM/correlação são normal-only nesta etapa: matrizes não quadradas, assimétricas, com diagonal não unitária ou não positivas definidas são rejeitadas; não há Nataf/Rosenblatt implícito.

### Confiabilidade de sistema
`runSystemMonteCarloReliability()` avalia vários estados limite com uma única chamada ao solver por amostra. `series` falha se qualquer componente falhar; `parallel` exige falha de todos. São preservados `Pf`, `beta` e intervalo de Wilson de cada componente e do sistema.

### Importance sampling
`runImportanceSamplingReliability()` desloca a proposta normal para o design point FORM no espaço `u`, aplica a razão exata de verossimilhança alvo/proposta e reporta `Pf`, `beta`, erro-padrão, coeficiente de variação, intervalo aproximado de 95%, ESS global e ESS das amostras de falha. O smoke inclui um evento raro com referência analítica `beta=4`.

## Respostas e estados limite
Seletores suportados: deslocamento nodal, deslocamento máximo, reação, força de elemento, força máxima de elemento e tensão extrema. O sentido padrão é `demand <= capacity`, com `g = capacity - demand`; `g=0` é falha.

## Otimização determinística
`optimizeProject()` usa `bounded-coordinate-search`, com limites explícitos, objetivo por soma de variáveis, resposta estrutural ou soma ponderada, e constraints avaliadas pelo solver. Factibilidade precede o objetivo; entre soluções inviáveis reduz-se primeiro a violação normalizada.

### RBDO
Constraints com `kind: "reliability"` executam confiabilidade dentro da busca. O usuário deve declarar `method` (`form` ou `mvfosm`), variáveis aleatórias, estado limite e `minBeta` e/ou `maxPf`. Não convergência do FORM invalida a constraint; não é tratada como ponto seguro. O smoke analítico da barra axial exige `beta >= 3` e converge para `A ≈ 0.0065 m²`.

### Pareto
`optimizeParetoProject()` usa scalarização weighted-sum declarada pelo usuário e retorna candidatos e front não dominado. Cada objetivo precisa declarar direção e `scale` positivo; cada execução precisa declarar `weightSets`. Não há normalização implícita de custo, massa, deslocamento, carbono ou confiabilidade. O contrato é `structural-multiobjective-optimization/v1`.

## Persistência e workbenches React
A confiabilidade é persistida aditivamente em `project.reliabilityStudy` sob `project-reliability-study/v1`; a otimização é persistida em `project.optimizationStudy` sob `project-optimization-study/v1`. O schema do projeto permanece 2.

Os dois estudos salvam configuração e somente um **resumo compacto** do último resultado. Amostras Monte Carlo/LHS, histórico completo de avaliações e cópias integrais do melhor projeto não são persistidos dentro do estudo.

Os workbenches React são abertos por comandos nativos inseridos na Biblioteca e em Mais comandos através de React Portal. Não existe launcher fixo sobre o canvas. Salvar um estudo dispara um commit externo consumido pelo `useProjectHistory`, portanto a alteração entra no mesmo estado React/histórico e permanece disponível para exportação do projeto.

No workbench de confiabilidade, `Latin Hypercube` aparece na mesma lista de métodos persistentes. No workbench de otimização, `Executar otimização` não modifica o projeto. `Salvar estudo` persiste configuração + resumo. `Aplicar melhor solução` é uma ação explícita separada e somente fica habilitada quando existe solução factível.

## Verificações do gate
Os smokes cobrem: Monte Carlo reproduzível; Latin Hypercube reproduzível e próximo da referência analítica; guarda explícita contra correlação não implementada no LHS; MVFOSM e FORM com `beta≈2`; FORM correlacionado `rho=0.5`; confiabilidade série/paralelo; importance sampling `beta=4`; otimização determinística analítica `A≈0.005 m²`; round-trip de `project.reliabilityStudy` e `project.optimizationStudy`; RBDO analítico `A≈0.0065 m²`; front Pareto explícito; e regressões VNL/estruturais.

Os E2E verificam os workbenches React em desktop, Android e tablet, incluindo persistência compacta e aplicação explícita da melhor solução de otimização.

## Antes do fechamento
O escopo funcional planejado para a v0.50 está implementado no `develop`: amostragem Monte Carlo e Latin Hypercube, MVFOSM, FORM/correlação normal, confiabilidade de sistema, importance sampling, workbench persistente, otimização determinística, RBDO e Pareto explícito. Resta executar a validação completa do HEAD funcional, criar o release gate dedicado, subir `package.json`/`PRODUCT_VERSION` para 0.50.0 e repetir CI + Pages no commit final. Não iniciar v0.51 antes do fechamento. Nenhuma promoção para `main` será feita sem solicitação explícita.
