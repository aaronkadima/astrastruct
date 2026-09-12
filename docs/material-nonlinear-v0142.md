# AstraStruct v0.14.2 — rótulas de fibras para seções retangulares, I/H e RHS

## Objetivo

A v0.14.2 amplia a não linearidade material concentrada da série v0.14 para perfis de aço usuais, mantendo o acoplamento tangente-afim introduzido na v0.14.1.

As rótulas de fibras podem agora ser associadas a seções paramétricas das famílias:

- `rect`: seção retangular maciça;
- `i`: perfil I/H simétrico, definido por `h`, `b`, `tw` e `tf`;
- `rhs`: seção tubular retangular, definida por `h`, `b` e `t`.

O modelo continua restrito à flexão no plano do `frame2d`, isto é, ao eixo forte representado pela coordenada seccional `y`.

## Discretização I/H

O perfil I/H é dividido em três regiões verticais independentes:

1. mesa inferior, largura `b` e espessura `tf`;
2. alma, largura `tw` e altura `h - 2tf`;
3. mesa superior, largura `b` e espessura `tf`.

Cada região recebe fibras por faixas horizontais. Para uma fibra `i`, a área é

`Ai = bi · Δyi`.

Como a hipótese de Bernoulli fornece a mesma deformação longitudinal para todos os pontos de uma mesma coordenada `y`, a integração da largura em `Ai` é suficiente para a resposta uniaxial N–M do elemento 2D.

As propriedades geométricas analíticas usadas para verificação são

`A = 2 b tf + (h - 2tf) tw`

`I = [b h³ - (b - tw)(h - 2tf)³] / 12`.

A malha preserva a área exatamente; `I` converge para a expressão analítica conforme aumenta o número de fibras.

## Discretização RHS

O RHS é também dividido em três regiões equivalentes:

1. parede inferior, largura `b` e espessura `t`;
2. duas paredes laterais, combinadas como largura equivalente `2t` na altura `h - 2t`;
3. parede superior, largura `b` e espessura `t`.

As propriedades de referência são

`A = b h - (b - 2t)(h - 2t)`

`I = [b h³ - (b - 2t)(h - 2t)³] / 12`.

A combinação das duas paredes laterais em uma fibra equivalente na mesma coordenada `y` é exata para a formulação uniaxial de flexão forte adotada nesta versão.

## Integração constitutiva

Para todas as famílias, a deformação longitudinal da fibra é

`εi = ε0 - κ yi`,

com

`κ = Δθ / Lp`.

O solver ajusta `ε0` para satisfazer o esforço normal proveniente do equilíbrio global. As resultantes são

`N = Σ σi Ai`

`M = -Σ σi Ai yi`.

A tangente seccional é

`Ksec = [[Σ Et Ai, -Σ Et Ai yi], [-Σ Et Ai yi, Σ Et Ai yi²]]`.

A rigidez flexional a esforço normal constante é obtida por

`D_Mκ|N = K22 - K12²/K11`,

seguida de

`kt = D_Mκ|N / Lp`.

No equilíbrio global, a rótula permanece representada pela linearização afim

`M ≈ kt Δθ + M0`,

`M0 = M - kt Δθ`,

condensada juntamente com a rotação interna de extremidade.

## Validação adicionada

A suíte v0.14.2 verifica:

- conservação exata da área de perfis I/H e RHS;
- convergência do segundo momento de área discreto para o valor analítico;
- resposta elástica `M = EIκ`;
- identificação separada de mesas, alma e paredes;
- início de plastificação em perfil I/H;
- equilíbrio local N–M;
- tangente `dM/dθ` comparada com diferença central após reequilíbrio axial;
- equilíbrio global de um console I/H com rótula de fibras plastificada;
- rastreabilidade da família de seção nos resultados da rótula.

## Limitações

Esta versão não representa flambagem local de mesa/alma, empenamento, torção, flexão biaxial, interação com cisalhamento, tensões residuais de fabricação, imperfeições locais, descarga/recarregamento cíclico, Bauschinger, plasticidade distribuída ou degradação por dano.

Perfis assimétricos e geometrias arbitrárias ainda não são discretizados automaticamente. A próxima generalização prevista é uma malha de fibras baseada em regiões/polígonos arbitrários, que permitirá seções T, U/C, L, chapas compostas e seções mistas antes da introdução de seções de concreto armado.
