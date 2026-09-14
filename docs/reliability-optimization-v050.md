# AstraStruct v0.50 — Reliability + Optimization

## Estado

A v0.50 inicia exclusivamente no branch `develop` como **0.50.0-exp**. O produto fechado continua em `PRODUCT_VERSION = 0.49.0`; `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0` permanecem inalterados. `main` permanece intocada.

## Objetivo

Adicionar uma camada probabilística e de otimização sobre o kernel estrutural já validado. A implementação não contém um segundo solver: cada amostra ou candidato cria uma cópia controlada do projeto, aplica somente targets declarados e chama o `solve()` público do AstraStruct.

## Contratos experimentais

- `structural-reliability/v1` — `0.50.0-exp`;
- `structural-optimization/v1` — `0.50.0-exp`.

## Variáveis aleatórias

O núcleo inicial aceita variáveis explicitamente declaradas como deterministic, normal, lognormal ou uniform. Cada variável possui um target inequívoco no projeto: uma propriedade por caminho raiz ou uma entidade identificada por `collection + id + property`. Nenhuma propriedade de material, geometria, carga ou resistência é inferida automaticamente.

Nesta primeira etapa as variáveis são tratadas como **independentes**. Correlação, cópulas, transformações Nataf/Rosenblatt e calibração estatística ficam bloqueadas até serem implementadas e testadas explicitamente.

## Monte Carlo

`runMonteCarloReliability()` usa gerador pseudoaleatório reproduzível por seed, executa o solver real para cada amostra, avalia a função de estado limite `g` e retorna número de amostras/falhas, `Pf`, `beta`, intervalo de Wilson de 95%, média/desvio da demanda e proveniência. A igualdade `g = 0` é classificada como falha. Erros do solver não são descartados.

## MVFOSM

`runMvfosmReliability()` implementa Mean-Value First-Order Second-Moment por diferenças finitas centrais no ponto médio. Retorna média e desvio de `g`, `beta`, `Pf` e sensibilidades. Não é rotulado como FORM.

## FORM / HL-RF e correlação normal

`runFormReliability()` implementa Hasofer-Lind-Rackwitz-Fiessler no espaço normal padrão independente. Com `correlationMatrix`, usa Cholesky para mapear `u` em variáveis normais correlacionadas antes de aplicar os targets físicos. FORM e correlação são deliberadamente normal-only nesta etapa. Matrizes não quadradas, assimétricas, diagonal não unitária ou não positivas definidas são rejeitadas. Não há conversão silenciosa Nataf/Rosenblatt.

O Monte Carlo aceita a mesma `correlationMatrix` sob essa regra. O smoke contém duas cargas normais com `rho=0.5` e referência analítica `beta=20/sqrt(300)`.

## Confiabilidade de sistema

`runSystemMonteCarloReliability()` avalia vários estados limite com **uma única chamada ao solver por amostra**. O modo `series` classifica falha do sistema quando qualquer componente falha; o modo `parallel` exige falha simultânea de todos. O resultado preserva `Pf`, `beta` e intervalo de Wilson por componente e pelo sistema. IDs de estados limite duplicados são rejeitados.

## Importance sampling para eventos raros

`runImportanceSamplingReliability()` usa uma proposta normal unitária deslocada para o design point FORM no espaço `u`. O estimador aplica a razão exata de verossimilhança entre a densidade normal padrão alvo e a proposta deslocada. Retorna `Pf`, `beta`, erro-padrão, coeficiente de variação, intervalo aproximado de 95%, ESS global e ESS das amostras de falha. Pode usar um `centerU` explícito; caso contrário exige FORM convergido.

A implementação continua restrita a variáveis normais quando há transformação por correlação. O smoke de evento raro usa `beta=4` como referência analítica e verifica que a proposta centrada observa número suficiente de falhas sem confundir frequência bruta da proposta com `Pf` ponderada.

## Seletores de resposta

Estados limite e constraints podem consultar deslocamento de nó, deslocamento nodal máximo, reação, força de elemento, força máxima de elemento e tensão extrema nas estações. O sentido padrão é `demand <= capacity`, com `g = capacity - demand`.

## Otimização

`optimizeProject()` inicia com `bounded-coordinate-search`, pattern search determinístico com limites explícitos. Variáveis apontam para targets numéricos existentes; objetivo pode ser soma de variáveis ou resposta estrutural. Constraints reutilizam os seletores e são avaliadas pelo solver. Factibilidade tem prioridade sobre o objetivo.

## Gate inicial v0.50

Os smokes determinísticos verificam Monte Carlo reproduzível, MVFOSM `beta≈2`, FORM `beta≈2`, correlação normal `rho=0.5`, otimização analítica de área `A≈0.005 m²`, confiabilidade de sistema com eventos aninhados e importance sampling para `beta=4`.

## Próximas etapas antes do fechamento

Persistência controlada dos estudos, integração React para configuração/revisão, regression browser desktop/Android/tablet e um gate final dedicado ainda são obrigatórios. Não iniciar v0.51 antes disso.

Nenhuma promoção para `main` será feita sem solicitação explícita.
