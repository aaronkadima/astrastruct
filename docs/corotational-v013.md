# AstraStruct — Formulação co-rotacional 2D v0.13 (experimental)

## 1. Objetivo e status

Este documento registra a formulação geométrica não linear implementada em `web/src/solver/corotational2d.js` e o pós-processamento em `web/src/solver/corotationalPostprocess.js`.

O modo está disponível na interface como **Geom. não linear — experimental v0.13**, sem substituir os solvers Linear e P‑Delta. A promoção para a UI significa que configuração, solução, geometria corrente, pós-processamento e relatório já possuem fluxo próprio e testes E2E; não significa certificação normativa ou validação universal.

## 2. Hipóteses e limites

A v0.13 admite:

- pórticos 2D exclusivamente `frame2d`;
- Euler–Bernoulli;
- material elástico linear no sistema básico;
- pequenas deformações locais e rotações globais finitas;
- cargas nodais mortas em eixos globais;
- extremidades rígidas;
- apoios clássicos com deslocamento prescrito nulo;
- Newton–Raphson incremental com line search opcional;
- até 240 graus de liberdade livres no navegador.

O kernel recusa explicitamente:

- cargas distribuídas, pontuais em barra, peso próprio automático e temperatura;
- molas nodais;
- releases e ligações semirrígidas;
- recalques e deslocamentos prescritos não nulos;
- imperfeição modal inicial;
- elementos `truss2d` ou modelos mistos.

Também não estão implementados material não linear, seções de fibras, cargas seguidoras, arc-length, contato, pórtico 3D, Timoshenko, shell ou solid.

## 3. Cinemática co-rotacional

Para coordenadas iniciais `(X1,Y1)` e `(X2,Y2)`:

`L0 = sqrt[(X2-X1)^2 + (Y2-Y1)^2]`

`alpha0 = atan2(Y2-Y1, X2-X1)`.

O vetor global é:

`q = [u1, v1, theta1, u2, v2, theta2]^T`.

Coordenadas correntes:

`x1 = X1 + u1`, `y1 = Y1 + v1`

`x2 = X2 + u2`, `y2 = Y2 + v2`.

Configuração corrente:

`l = sqrt[(x2-x1)^2 + (y2-y1)^2]`

`alpha = atan2(y2-y1, x2-x1)`.

A rotação rígida da corda é:

`Delta alpha = alpha - alpha0`,

normalizada por `atan2(sin(Delta alpha),cos(Delta alpha))`.

Deformações básicas:

`db = [l-L0, phi1, phi2]^T`

`phi1 = theta1 - Delta alpha`

`phi2 = theta2 - Delta alpha`.

Logo, movimento rígido não gera deformação básica.

## 4. Relação constitutiva básica

Para Euler–Bernoulli elástico linear:

`qb = kb db`

`qb = [N, M1, M2]^T`

`kb = [[EA/L0, 0, 0],
       [0, 4EI/L0, 2EI/L0],
       [0, 2EI/L0, 4EI/L0]]`.

A não linearidade da v0.13 é exclusivamente geométrica.

## 5. Transformação cinemática

Com `c = cos(alpha)` e `s = sin(alpha)`:

`r = [-c,-s,0,c,s,0]^T`

`z = [s,-c,0,-s,c,0]^T`.

A matriz cinemática `B = d(db)/d(q)` possui:

`B1 = r^T`

`B2 = -z^T/l + [0,0,1,0,0,0]`

`B3 = -z^T/l + [0,0,0,0,0,1]`.

Forças internas globais:

`fint = B^T qb`.

## 6. Tangente consistente

A tangente implementada é:

`Kt = B^T kb B + Kg,N + Kg,M`

`Kg,N = (N/l) z z^T`

`Kg,M = [(M1+M2)/l^2] (r z^T + z r^T)`.

Ela foi comparada com a derivada numérica central de `fint` em um estado deformado. Erro relativo máximo do benchmark atual:

`1.7899600937e-9`.

## 7. Equilíbrio incremental

Para fator de carga `lambda`:

`R(q) = lambda Fext - fint(q) = 0`.

Newton–Raphson:

`Kt(q_i) Delta q = R(q_i)`

`q_(i+1) = q_i + eta Delta q`,

onde `eta` é o fator do line search.

Controles disponíveis na UI:

- número de incrementos;
- máximo de iterações por incremento;
- tolerância de resíduo;
- line search ligado/desligado.

O histórico armazena, por incremento, fator de carga, iterações e norma do resíduo.

## 8. Convenção de esforços

- `N > 0`: tração;
- `M1`, `M2`: momentos básicos.

Para a estrutura de resultados:

`N1 = -N`

`N2 = N`

`V1 = (M1+M2)/l`

`V2 = -V1`.

## 9. Pós-processamento na geometria corrente

Cada elemento é reconstruído em 41 estações. A deflexão transversal no sistema co-rotante usa interpolação Hermite das rotações relativas `phi1` e `phi2`, depois é transformada para o sistema global.

Cada estação contém, entre outros:

- posição nominal `x0,y0`;
- posição corrente `xd,yd`;
- `N,V,M`;
- `ux,uy`;
- `uLocal,vLocal`;
- tensões elásticas `sigmaAxial`, `sigmaTop`, `sigmaBottom`, `sigmaAbs`.

Na interface:

- a deformada co-rotacional é exibida em **escala física ×1**;
- o amplificador automático de deformação é ocultado;
- diagramas, sonda e mapa de tensões seguem a geometria corrente;
- o painel de pós-processamento é **somente por cenário**;
- envelopes não lineares ficam explicitamente desabilitados.

O relatório técnico próprio registra formulação, parâmetros de Newton, histórico de convergência, deslocamentos, extremos por elemento e limitações.

## 10. Benchmarks automatizados

### 10.1 Objetividade

Elemento `L = 3.7 m` com translação rígida `(1.25,-0.62) m` e rotação rígida `0.83 rad`:

- `max|db| < 1e-12`;
- `max|fint| < 1e-6`.

### 10.2 Tangente consistente

Diferença central em estado deformado:

`erro relativo máximo = 1.7899600937e-9`.

### 10.3 Limite linear

Console `L = 4 m`, `E = 30 GPa`, `I = 0.003125 m4`, `P = 10 kN`:

- referência: `2.2755555556 mm`;
- co-rotacional: `2.2755550703 mm`.

### 10.4 Grande rotação — arco circular

Console sob momento puro com `theta = 1 rad`:

`xL = L sin(theta)/theta`

`yL = L [1-cos(theta)]/theta`.

Referência para `L = 4 m`:

- `xL = 3.3658839392 m`;
- `yL = 1.8387907765 m`.

Com 16 elementos:

- `xL = 3.3664318343 m`;
- `yL = 1.8390900930 m`.

Erro vetorial de ponta:

- 4 elementos: `0.01000626945 m`;
- 8 elementos: `0.00249814644 m`;
- 16 elementos: `0.00062432313 m`.

### 10.5 Pós-processamento

No mesmo caso de momento puro, o erro máximo de `M(x)` ao longo das estações fica em aproximadamente:

`2.25e-9 kN.m`.

A última estação do último elemento coincide com a coordenada deformada do nó final dentro da tolerância de regressão.

### 10.6 Proteção de escopo

Testes verificam que o kernel gera erro explícito para:

- recalque ativo convertido pelo Scenario Engine;
- deslocamento-base prescrito em apoio;
- imperfeição modal ativa.

Nenhum desses estados é descartado silenciosamente.

## 11. Relação com o P‑Delta v0.12

O P‑Delta atualiza a rigidez geométrica por esforço normal mantendo a cinemática global de pequenas rotações. O co‑rotacional atualiza explicitamente posição, comprimento, orientação da corda, rotações relativas e tangente a cada iteração.

O P‑Delta continua mais abrangente quanto a tipos de ações e recursos de elemento. O co‑rotacional v0.13 é a base para grandes rotações, porém com escopo propositalmente mais restrito.

## 12. Estado da promoção para a interface

A promoção experimental foi concluída com:

1. terceiro modo no painel **Tipo de análise**;
2. controles de incrementos, iterações, tolerância e line search;
3. verificação de compatibilidade antes da seleção;
4. solução pelo dispatcher principal;
5. deformada física ×1 e geometria corrente;
6. diagramas/sonda/mapa de tensão na geometria corrente;
7. pós-processador de cenário específico sem envelope não linear;
8. relatório técnico específico;
9. testes E2E em desktop, Android e tablet.

O rótulo **experimental** permanece obrigatório. A próxima evolução numérica prioritária é ampliar a formulação, com validação independente, para cargas de barra/peso próprio, releases/ligações semirrígidas, imperfeição inicial e seguimento de caminho próximo a pontos-limite.
