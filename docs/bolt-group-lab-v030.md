# AstraStruct v0.30 — Lab de ligação chapa–parafuso

## Escopo

O módulo `boltGroup2d` é um kernel mecânico especializado para distribuição elástica de ações em um grupo de parafusos conectado a uma **placa rígida no plano**. Ele foi criado para o Lab de elementos isolados e resolve diretamente o equilíbrio entre as ações aplicadas à placa e as forças transmitidas pelos parafusos.

Esta primeira formulação considera três graus de liberdade da placa: `ux`, `uy` e `θz`. Cada parafuso é representado por duas molas translacionais independentes `kx` e `ky`.

O módulo não é um verificador normativo de ligações metálicas. Nesta versão ele não calcula automaticamente resistência de parafuso, bearing, rasgamento, bloco de cisalhamento, plastificação da chapa, atrito/escorregamento, prying ou contato entre chapas. Uma capacidade cortante opcional pode ser informada pelo usuário apenas para obter uma razão demanda/capacidade.

## Cinemática

Para um parafuso `i` localizado em `(xi, yi)`, a placa rígida impõe

`ux,i = ux - θz yi`

`uy,i = uy + θz xi`.

As forças elásticas transferidas pelo parafuso são

`Fx,i = kx,i ux,i`

`Fy,i = ky,i uy,i`.

A contribuição de momento em torno da origem é

`Mz,i = xi Fy,i - yi Fx,i`.

## Matriz de rigidez do grupo

Para cada parafuso são definidos os vetores cinemáticos

`Bx = [1, 0, -yi]`

`By = [0, 1, xi]`.

A rigidez global 3×3 da placa é montada por

`K = Σ (kx Bxᵀ Bx + ky Byᵀ By)`.

O sistema linear

`K q = P`

fornece `q = [ux, uy, θz]ᵀ`.

Ações aplicadas com excentricidade são convertidas de forma consistente. Para um ponto `(ex, ey)`,

`Mz,total = Mz + ex Fy - ey Fx`.

## Centro de rigidez

O Lab também informa o centro de rigidez translacional equivalente:

`xCR = Σ(ky xi) / Σky`

`yCR = Σ(kx yi) / Σkx`.

Para padrões simétricos com rigidezes iguais, o centro coincide com o centro geométrico do grupo.

## Resultados

O kernel retorna:

- deslocamentos `ux`, `uy` e rotação `θz` da placa;
- `Fx`, `Fy`, resultante `V` e contribuição de momento de cada parafuso;
- razão demanda/capacidade quando uma capacidade de usuário é informada;
- parafuso mais solicitado;
- centro de rigidez;
- matriz de rigidez 3×3;
- equilíbrio global e resíduo numérico;
- energia elástica externa.

A interface apresenta mapa vetorial do grupo, setas de força por parafuso, tabela de demandas e exportação CSV. O SVG do diagrama também participa da exportação científica vetorial do AstraStruct.

## Unidades

O solver é dimensionalmente genérico desde que todas as grandezas sejam consistentes. Na interface do AstraStruct são usadas:

- coordenadas e espaçamentos: entrada em `mm`, convertida internamente para `m`;
- rigidez de parafuso: entrada em `kN/mm`, convertida para `kN/m`;
- forças: `kN`;
- momentos: `kN·m`;
- capacidade cortante de usuário: `kN`.

## Benchmarks

`tests/bolt-group-v030-smoke.mjs` verifica:

1. distribuição uniforme de cisalhamento direto em grupo simétrico de quatro parafusos;
2. solução fechada de rotação para momento puro, `θ = M / Σ(k r²)`;
3. equivalência entre força excêntrica e força no centro acrescida do momento correspondente;
4. razão demanda/capacidade definida pelo usuário;
5. detecção de configuração singular sem rigidez rotacional.

## Próximas extensões

A arquitetura permite incorporar, sem alterar o kernel elástico básico:

- coordenadas individuais e rigidezes distintas por parafuso na interface;
- folga inicial de furo e contato unilateral;
- ligação por atrito com transição para bearing;
- lei não linear força–deslizamento por parafuso;
- tração axial e interação cisalhamento–tração;
- flexibilidade real da chapa por elemento de placa/casca;
- verificadores normativos de aço, bearing, bloco de cisalhamento e rasgamento como módulos separados.
