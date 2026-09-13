# AstraStruct v0.30 — Lab de ancoragem / pull-out 1D

## Escopo

O módulo `anchorPullout1d` é um solver mecânico especializado para estudar, de forma isolada, a transferência axial de força entre uma barra/haste de ancoragem e um meio de concreto de referência por meio de uma lei de aderência distribuída `τ–s`.

Ele foi criado para o **Lab de elementos isolados** e não é implementado como uma mola equivalente do solver de pórticos. A barra de aço é discretizada axialmente e a aderência atua ao longo de todo o perímetro e comprimento de embutimento.

O módulo **não é**, nesta versão, um verificador normativo de chumbadores. Em particular, não calcula automaticamente resistência de cone de concreto, ruptura de borda, pry-out, splitting, interação de grupos de chumbadores ou verificações de distância à borda.

## Formulação mecânica

Para uma barra de área `A`, módulo `E`, perímetro aderente `p` e deslocamento axial `u(x)`, o equilíbrio contínuo idealizado é

`EA · d²u/dx² - p · τ(u) = 0`.

A discretização utiliza elementos axiais lineares de dois nós. Para um segmento de comprimento `Le`, a rigidez axial é

`k_bar = EA / Le`.

A força de aderência em cada nó é obtida pela integração concentrada sobre o comprimento tributário:

`F_bond,i = p · Ltrib,i · τ(si)`.

O concreto é a referência cinemática fixa nesta primeira formulação; portanto, o deslizamento local `s` coincide com o deslocamento axial da barra no ponto considerado.

## Lei de aderência τ–s

A lei monotônica padrão possui quatro ramos configuráveis:

1. **ascendente linear**, de `τ = 0` até `τmax` em `s1`;
2. **patamar**, `τ = τmax`, entre `s1` e `s2`;
3. **softening linear**, de `τmax` até `τres = rres·τmax`, entre `s2` e `sf`;
4. **residual**, `τ = τres`, para `s > sf`.

Todos os parâmetros são informados pelo usuário. O AstraStruct não atribui automaticamente uma resistência normativa a partir de `fc`, tipo de barra ou condição de fissuração nesta versão.

## Cabeça / placa de ancoragem

Opcionalmente, pode ser adicionada uma contribuição concentrada na extremidade embutida:

`F_head = min(k_head · s_head, F_head,max)`.

Ela representa uma idealização mecânica da transferência de força pela cabeça/placa. A capacidade informada pelo usuário não é derivada automaticamente de uma superfície de ruptura de concreto.

## Estratégia não linear

O ensaio virtual é resolvido em **controle de deslocamento** no extremo carregado. Em cada incremento, o deslocamento imposto é conhecido e o equilíbrio dos graus de liberdade internos é obtido por Newton–Raphson com tangente local e line-search.

Essa escolha permite atravessar o ramo descendente da lei `τ–s`, que pode ser instável em controle puro de força.

O resultado guarda:

- curva força de pull-out × deslizamento imposto;
- carga e deslizamento de pico;
- queda pós-pico;
- tensão de aderência máxima;
- contribuição da cabeça;
- tensão axial máxima no aço e razão `σ/fy`;
- perfil de deslizamento, `τ`, força de aderência e força/tensão na barra ao longo do embutimento;
- trabalho externo aproximado sob a curva;
- número de iterações e resíduo de equilíbrio por incremento.

## Unidades

O kernel usa o sistema interno do AstraStruct `kN–m`:

- comprimentos e deslizamentos: `m`;
- força: `kN`;
- `E`, `fy` e `τ`: `kN/m²`;
- rigidez concentrada de cabeça: `kN/m`.

A interface do Lab converte automaticamente as entradas usuais em `mm`, `MPa`, `GPa` e `kN/mm` para o sistema interno.

## Benchmarks implementados

A suíte `tests/anchor-pullout-v030-smoke.mjs` verifica:

- os quatro ramos da lei `τ–s`;
- o limite elástico de shear-lag contra a solução fechada `P = EA λ tanh(λL) δ`;
- o limite de barra quase rígida, no qual a reação tende à integral da tensão de aderência na superfície cilíndrica;
- a soma da contribuição da cabeça;
- rastreamento do ramo pós-pico por controle de deslocamento;
- equilíbrio entre reação aplicada, aderência distribuída e cabeça.

## Próximas extensões

A arquitetura foi mantida separada para permitir extensões sem misturar fenômenos distintos. Os próximos módulos podem incluir:

- leis `τ–s` com descarregamento/recarregamento cíclico;
- concreto fissurado por parâmetros explicitamente fornecidos ou por modelo calibrado;
- modelos separados para cone/breakout, borda, splitting e pry-out;
- grupo de ancoragens e interação com placa-base;
- acoplamento posterior a um modelo 2D/3D de concreto quando um kernel de contato/fratura estiver disponível.

A interface deve continuar informando claramente qual mecanismo está sendo modelado e qual permanece fora do escopo da formulação selecionada.
