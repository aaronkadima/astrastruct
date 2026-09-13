# AstraStruct v0.30 — Lab de parafusos com folga e contato

## Escopo

O módulo `boltGroupContact2d` representa um grupo de parafusos ligado a uma placa rígida no plano, incluindo **folga radial de furo**, contato unilateral e uma lei radial de bearing elástica ou bilinear definida pelo usuário.

A formulação é mecânica e não normativa. Ela não calcula automaticamente resistência de parafuso, bearing de chapa, rasgamento, bloco de cisalhamento, prying ou resistência de código.

## Cinemática

A placa possui `ux`, `uy` e `θz`. Para o parafuso `i` em `(xi,yi)`:

`dx = ux - θz yi`

`dy = uy + θz xi`

`r = sqrt(dx² + dy²)`.

Com folga radial `g`, a penetração de contato é

`p = max(0, r-g)`.

Antes de `r>g`, o parafuso não transmite força. Após o fechamento da folga, a força atua na direção radial da deformação relativa.

## Lei de bearing

No ramo elástico:

`F = k p`.

Opcionalmente pode ser definida uma força de transição `Fy`. Para `p > Fy/k`:

`F = Fy + α k (p-Fy/k)`

em que `α` é a razão de rigidez pós-transição. `α=0` fornece patamar ideal; valores positivos fornecem encruamento.

## Equilíbrio não linear

As forças de todos os parafusos são reunidas nos três resultantes da placa `[Fx,Fy,Mz]`. A solução é incremental em fator de carga e usa Newton–Raphson com tangente numérica e busca linear. A condição de equilíbrio é verificada ao final de cada incremento.

## Resultados

O Lab apresenta:

- número de parafusos em contato;
- `ux`, `uy` e `θz` da placa;
- estado de cada parafuso: `gap`, `bearing-elastic`, `bearing-postyield` ou `bearing-capped`;
- deslocamento relativo e penetração de contato;
- `Fx`, `Fy` e força resultante por parafuso;
- razão demanda/capacidade quando o usuário informa uma capacidade;
- histórico incremental de força máxima;
- resíduo de equilíbrio;
- exportação CSV e figura SVG científica.

## Benchmarks

`tests/bolt-group-contact-v030-smoke.mjs` verifica:

1. folga zero reproduz o grupo elástico linear;
2. cisalhamento direto fecha a folga e distribui igualmente a força em grupo simétrico;
3. momento puro em grupo simétrico reproduz a solução fechada de rotação;
4. lei bilinear entra no ramo pós-transição mantendo equilíbrio;
5. força excêntrica reproduz o momento correspondente e redistribui a demanda.

## Limitações

A placa permanece rígida. Não são representados flexibilidade local da chapa, ovalização do furo, atrito antes do bearing, contato chapa–chapa, pré-tensão, prying ou ruptura normativa. Esses mecanismos devem permanecer módulos separados para preservar rastreabilidade das hipóteses.