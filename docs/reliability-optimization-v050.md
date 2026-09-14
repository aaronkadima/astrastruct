# AstraStruct v0.50 — Reliability + Optimization

## Estado
A v0.50 é desenvolvida exclusivamente em `develop` como **0.50.0-exp**. O produto fechado continua em `PRODUCT_VERSION = 0.49.0`; `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0` permanecem inalterados. `main` permanece intocada.

## Arquitetura
A camada probabilística reutiliza o `solve()` público: cada amostra/candidato clona o projeto, aplica somente targets explicitamente declarados e executa o mesmo kernel estrutural. Não existe segundo solver nem criação silenciosa de propriedades.

Contratos experimentais: `structural-reliability/v1`, `structural-optimization/v1` e `project-reliability-study/v1`, todos em `0.50.0-exp` quando aplicável.

## Métodos de confiabilidade
`runMonteCarloReliability()` usa seed reproduzível, retorna `Pf`, `beta`, intervalo de Wilson e estatísticas da demanda. Distribuições explícitas: deterministic, normal, lognormal e uniform. `runMvfosmReliability()` implementa MVFOSM no ponto médio por diferenças finitas e não é apresentado como FORM.

### FORM / HL-RF
`runFormReliability()` implementa Hasofer-Lind-Rackwitz-Fiessler no espaço normal padrão. Com `correlationMatrix`, a transformação usa Cholesky. FORM/correlação são normal-only nesta etapa: matrizes não quadradas, assimétricas, com diagonal não unitária ou não positivas definidas são rejeitadas; não há Nataf/Rosenblatt implícito.

### Confiabilidade de sistema
`runSystemMonteCarloReliability()` avalia vários estados limite com uma única chamada ao solver por amostra. `series` falha se qualquer componente falhar; `parallel` exige falha de todos. São preservados `Pf`, `beta` e intervalo de Wilson de cada componente e do sistema.

### Importance sampling
`runImportanceSamplingReliability()` desloca a proposta normal para o design point FORM no espaço `u`, aplica a razão exata de verossimilhança alvo/proposta e reporta `Pf`, `beta`, erro-padrão, coeficiente de variação, intervalo aproximado de 95%, ESS global e ESS das amostras de falha. O smoke inclui um evento raro com referência analítica `beta=4`.

## Respostas e estados limite
Seletores suportados: deslocamento nodal, deslocamento máximo, reação, força de elemento, força máxima de elemento e tensão extrema. O sentido padrão é `demand <= capacity`, com `g = capacity - demand`; `g=0` é falha.

## Otimização
`optimizeProject()` usa `bounded-coordinate-search`, com limites explícitos, objetivo por soma de variáveis ou resposta estrutural e constraints avaliadas pelo solver. Factibilidade precede o objetivo; entre soluções inviáveis reduz-se primeiro a violação normalizada.

## Persistência e workbench React
A configuração é persistida aditivamente em `project.reliabilityStudy` sob `project-reliability-study/v1`, sem alterar o schema 2. O projeto salva variáveis, targets, estados limite, método, seed, correlação e apenas um **resumo compacto** do último resultado; amostras brutas não são incorporadas ao projeto.

O workbench React é aberto por comandos nativos inseridos na Biblioteca e em Mais comandos através de React Portal. Não existe launcher fixo sobre o canvas. Salvar o estudo dispara um commit externo consumido pelo `useProjectHistory`, portanto a alteração entra no mesmo estado React/histórico e permanece disponível para exportação do projeto.

## Verificações do gate
Os smokes cobrem: Monte Carlo reproduzível; MVFOSM e FORM com `beta≈2`; FORM correlacionado `rho=0.5`; otimização analítica `A≈0.005 m²`; confiabilidade série/paralelo; importance sampling `beta=4`; round-trip `project.reliabilityStudy`; e regressões VNL/estruturais. O E2E do workbench é executado em desktop, Android e tablet.

## Antes do fechamento
Ainda faltam editor React de otimização, integração de resultados de otimização no projeto, validação browser final e release gate dedicado v0.50. Não iniciar v0.51 antes do fechamento. Nenhuma promoção para `main` será feita sem solicitação explícita.
