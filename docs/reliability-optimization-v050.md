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

`runMonteCarloReliability()` usa gerador pseudoaleatório reproduzível por seed, executa o solver real para cada amostra, avalia a função de estado limite `g` e retorna:

- número de amostras e falhas;
- probabilidade de falha `Pf`;
- índice `beta = -Phi^-1(Pf)` quando `0 < Pf < 1`;
- intervalo de Wilson de 95% para `Pf`;
- média e desvio padrão da demanda;
- proveniência das variáveis e do estado limite.

A igualdade `g = 0` é classificada como falha. Amostras inválidas não são silenciosamente descartadas: erros do solver são propagados.

## MVFOSM

`runMvfosmReliability()` implementa **Mean-Value First-Order Second-Moment (MVFOSM)** por diferenças finitas centrais no ponto médio. O método retorna média de `g`, desvio padrão de `g`, `beta`, `Pf` aproximada e sensibilidades normalizadas. Ele não é rotulado como FORM: a busca do design point no espaço normal ainda não faz parte deste incremento.

## Seletores de resposta

O estado limite e as constraints podem consultar respostas escalares reais:

- deslocamento de nó;
- deslocamento nodal máximo;
- reação;
- força de elemento;
- força máxima de elemento;
- tensão extrema nas estações de pós-processamento.

O sentido padrão é `demand <= capacity`, com `g = capacity - demand`.

## Otimização

`optimizeProject()` inicia com `bounded-coordinate-search`, um pattern search determinístico com limites explícitos. Variáveis de projeto apontam para targets numéricos existentes. O objetivo pode ser soma de variáveis de projeto ou uma resposta estrutural. Constraints usam os mesmos seletores do módulo de confiabilidade e são avaliadas pelo solver real.

O comparador privilegia factibilidade antes do objetivo; entre soluções inviáveis, reduz primeiro a violação normalizada. Isso evita esconder violações por penalidades arbitrárias.

## Gate inicial v0.50

O smoke determinístico usa uma barra axial linear para verificar:

1. Monte Carlo com carga normal e seed reproduzível;
2. `Pf` consistente com o problema analítico de referência;
3. MVFOSM com `beta ≈ 2` no caso linear univariado;
4. otimização da área com restrição de deslocamento, cuja solução analítica é aproximadamente `A = 0.005 m²`;
5. manutenção da v0.49.0 como versão pública durante o desenvolvimento.

## Próximas etapas antes do fechamento

O gate de release v0.50 só poderá ser criado após ampliar a camada com, no mínimo, FORM/HL-RF ou equivalente validado, tratamento explícito de correlação, amostragem mais eficiente para eventos raros, múltiplos estados limite, integração React para configuração/revisão dos estudos, persistência controlada no projeto e regressão browser desktop/Android/tablet.

Nenhuma promoção para `main` será feita sem solicitação explícita.
