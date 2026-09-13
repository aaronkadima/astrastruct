# AstraStruct v0.41 — Nonlinear Dynamics / Seismic

## Escopo

A v0.41 introduz o núcleo de integração temporal não linear do AstraStruct sobre a cadeia arquitetural já consolidada:

`Numerical Core 2 -> Component/Element API -> nonlinear restoring model -> implicit dynamics -> seismic excitation`.

O objetivo desta versão é permitir história temporal não linear com elementos stateful, incluindo histerese e outros mecanismos que seguem a semântica `committed -> trial -> commit/rollback`. A v0.41 não implementa combinações normativas de ações; isso permanece reservado à v0.42 — Design Actions & Combinations.

Contratos públicos:

- `nonlinear-dynamics/v1`;
- `ground-motion-history/v1`;
- `component-restoring-model/v1`.

Versão experimental do engine: `0.41.0-exp`.

## Equação de movimento

O problema discreto é escrito como

`M a(t) + C v(t) + f_int(u(t), z(t)) = p(t)`,

onde `z` representa as variáveis internas dos componentes não lineares. Em cada passo, o estado committed do passo anterior permanece imutável durante as iterações de equilíbrio. Cada avaliação produz um estado trial; somente após convergência ele é confirmado por `commit()`.

## Integração Newmark implícita

A implementação usa Newmark com parâmetros configuráveis `beta` e `gamma`. O padrão é Average Acceleration:

- `beta = 1/4`;
- `gamma = 1/2`.

Para um incremento `dt`, a aceleração e a velocidade do passo `n+1` são expressas em função do deslocamento desconhecido `u_(n+1)`. O equilíbrio é resolvido iterativamente por Newton:

`R(u) = f_int(u) + C v(u) + M a(u) - p_(n+1) = 0`.

A tangente efetiva é

`K_eff = K_t + a1 C + a0 M`,

com

`a0 = 1/(beta dt^2)` e `a1 = gamma/(beta dt)`.

O solver reutiliza diretamente o Numerical Core 2 da v0.32, incluindo Newton full, modified Newton, line-search, tolerâncias escaladas e diagnósticos do solver linear.

## Estado não linear e rollback

Antes de cada avaliação iterativa, o restoring model retorna ao último estado committed. Assim, múltiplas avaliações de residual/tangente e tentativas de line-search não acumulam plasticidade artificialmente. Após convergência:

1. a resposta convergida é recalculada;
2. velocidade e aceleração são atualizadas;
3. o estado trial convergido é confirmado por `commit()`;
4. a energia do passo é acumulada.

Se o Newton falhar, `rollback()` é executado antes da exceção ser propagada.

## Adapter para Component/Element API

`createComponentRestoringModel()` conecta diretamente componentes `element-component/v1` ao integrador dinâmico. O adapter:

- registra os DOFs no `DofManager`;
- expande os deslocamentos reduzidos para o vetor global;
- usa `assembleElementComponents()` para obter forças internas e tangente;
- reduz força/tangente aos DOFs livres;
- centraliza `commit()` e `rollback()` dos componentes.

Isso permite, por exemplo, utilizar o `nonlinear-link-2d/3d` bilinear da v0.36 sem criar um solver dinâmico específico para cada tipo de elemento.

## Excitação sísmica de base

Uma história de aceleração é definida por `piecewiseLinearGroundMotion()`, com interpolação linear entre amostras. Para uma influência `r`, a força sísmica efetiva é

`p_g(t) = -M r a_g(t)`.

A aceleração absoluta pode ser recuperada por

`a_abs = a_rel + r a_g`.

A v0.41 mantém a unidade da aceleração explicitamente sob responsabilidade da entrada; não converte automaticamente `g`, `m/s²` ou outras unidades sem declaração do usuário.

## Amortecimento

`rayleighDampingMatrix()` monta

`C = alpha_M M + beta_K K`.

Os coeficientes podem ser obtidos pelo utilitário modal linear existente ou fornecidos diretamente. Valores negativos são rejeitados.

## Balanço de energia

Cada passo registra:

- energia cinética;
- variação da energia cinética desde o estado inicial;
- trabalho interno incremental por regra trapezoidal;
- trabalho externo incremental;
- trabalho dissipado pelo amortecimento viscoso;
- residual de balanço de energia.

Para um oscilador linear não amortecido integrado por Average Acceleration, o benchmark exige conservação de energia mecânica dentro da tolerância numérica.

## Verificação determinística

`tests/nonlinear-dynamics-v041-smoke.mjs` verifica:

1. equivalência do novo integrador com `newmarkLinearSystem()` no limite linear-elástico;
2. conservação de energia de um SDOF não amortecido;
3. interpolação do ground motion, sinal de `-M r a_g`, reconstrução de aceleração absoluta e matriz de Rayleigh;
4. resposta sísmica inelástica de um `nonlinear-link` bilinear usando a Component API;
5. ocorrência de plasticidade, energia histérica positiva e convergência de todos os passos.

## Limitações explícitas da v0.41

- passo de tempo uniforme dentro de uma execução;
- sem substepping/adaptação automática de `dt` nesta versão;
- sem integração generalized-alpha/HHT;
- sem suporte multibase/multi-support excitation;
- sem input/output de formatos sísmicos externos específicos;
- sem geração automática de espectros normativos;
- sem fatores normativos ou combinações de ações da v0.42;
- a estabilidade e a precisão continuam dependentes de discretização temporal, regularização constitutiva e qualidade da tangente dos componentes.

## Próxima etapa

Após o release gate e CI integralmente verdes, a próxima versão permitida pela sequência é **v0.42 — Design Actions & Combinations**. Nenhuma funcionalidade dessa etapa é antecipada na v0.41.
