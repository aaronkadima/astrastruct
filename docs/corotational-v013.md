# AstraStruct — Formulação co-rotacional 2D v0.13.2 (experimental)

## 1. Objetivo e status

Este documento registra a formulação geométrica não linear implementada em `web/src/solver/corotational2d.js` e o pós-processamento em `web/src/solver/corotationalPostprocess.js`.

O modo está disponível na interface como **Geom. não linear — experimental v0.13.2**. A promoção para a UI significa que configuração, solução, geometria corrente, pós-processamento, relatório e cargas de referência possuem fluxo próprio e regressões automatizadas. Não significa certificação normativa ou validação universal.

## 2. Escopo da v0.13.2

Admitido atualmente:

- modelos exclusivamente `frame2d`;
- Euler–Bernoulli;
- material elástico linear;
- pequenas deformações locais e rotações globais finitas;
- cargas nodais mortas em eixos globais;
- `uniform` como dead load da configuração de referência;
- `selfWeight` como dead load vertical global da referência;
- `point` como carga pontual de barra convertida em vetor nodal equivalente da referência;
- extremidades rígidas;
- apoios clássicos com deslocamentos prescritos nulos;
- Newton–Raphson incremental com line search opcional;
- até 240 graus de liberdade livres no navegador.

Recusado explicitamente:

- ações térmicas;
- follower loads/cargas seguidoras;
- molas nodais;
- releases e ligações semirrígidas;
- recalques e deslocamentos prescritos não nulos;
- imperfeição modal inicial;
- `truss2d` e modelos mistos.

Não estão implementados material não linear, seções de fibras, arc-length, contato, pórtico 3D, Timoshenko, shell ou solid.

## 3. Cinemática co-rotacional

Para coordenadas iniciais `(X1,Y1)` e `(X2,Y2)`:

`L0 = sqrt[(X2-X1)^2 + (Y2-Y1)^2]`

`alpha0 = atan2(Y2-Y1, X2-X1)`.

O vetor global é:

`q = [u1, v1, theta1, u2, v2, theta2]^T`.

Na configuração corrente:

`x1 = X1 + u1`, `y1 = Y1 + v1`

`x2 = X2 + u2`, `y2 = Y2 + v2`

`l = sqrt[(x2-x1)^2 + (y2-y1)^2]`

`alpha = atan2(y2-y1, x2-x1)`.

A rotação rígida da corda é:

`Delta alpha = alpha - alpha0`,

normalizada por `atan2(sin(Delta alpha),cos(Delta alpha))`.

Deformações básicas:

`db = [l-L0, phi1, phi2]^T`

`phi1 = theta1 - Delta alpha`

`phi2 = theta2 - Delta alpha`.

Movimento rígido puro, portanto, não gera deformação básica.

## 4. Relação constitutiva básica

Para Euler–Bernoulli elástico linear:

`qb = kb db`

`qb = [N, M1, M2]^T`

`kb = [[EA/L0, 0, 0],
       [0, 4EI/L0, 2EI/L0],
       [0, 2EI/L0, 4EI/L0]]`.

A não linearidade da v0.13.2 é exclusivamente geométrica.

## 5. Transformação e força interna

Com `c = cos(alpha)` e `s = sin(alpha)`:

`r = [-c,-s,0,c,s,0]^T`

`z = [s,-c,0,-s,c,0]^T`.

A matriz cinemática básica `B = d(db)/d(q)` usa:

`B1 = r^T`

`B2 = -z^T/l + [0,0,1,0,0,0]`

`B3 = -z^T/l + [0,0,0,0,0,1]`.

A força interna global é:

`fint = B^T qb`.

## 6. Tangente consistente

A tangente implementada é:

`Kt = B^T kb B + Kg,N + Kg,M`

`Kg,N = (N/l) z z^T`

`Kg,M = [(M1+M2)/l^2] (r z^T + z r^T)`.

A derivada analítica foi comparada com diferença central de `fint` em estado deformado. O erro relativo máximo do benchmark atual é:

`1.7899600937e-9`.

## 7. Equilíbrio incremental

Para fator de carga `lambda`:

`R(q) = lambda Fext - fint(q) = 0`.

Em cada iteração:

`Kt(q_i) Delta q = R(q_i)`

`q_(i+1) = q_i + eta Delta q`,

onde `eta` é o fator do line search.

A interface permite definir incrementos, máximo de iterações, tolerância e uso de line search. O histórico registra fator de carga, número de iterações e norma do resíduo em cada incremento.

## 8. Modelo de cargas mortas da referência

A v0.13.2 trata `uniform`, `selfWeight` e `point` como **dead loads da configuração inicial**. O vetor nodal equivalente é calculado em `L0, alpha0`, transformado para o sistema global inicial e congelado durante Newton–Raphson.

Consequências:

- a ação externa não acompanha a rotação corrente do elemento;
- não existe tangente externa de follower load;
- o recurso não deve ser interpretado como carga seguidora.

### 8.1 Carga uniforme

Para `qx0,qy0` nos eixos locais iniciais:

`pUDL = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, -qy0 L0²/12]^T`.

### 8.2 Peso próprio

Com peso específico `gamma`, área `A` e fator `f`:

`w = gamma A f`.

A força por comprimento é vertical no sistema global. Ela é projetada nos eixos locais iniciais para gerar `qx0,qy0` e, em seguida, o mesmo vetor consistente de UDL.

### 8.3 Carga pontual em barra — v0.13.2

Para uma carga local inicial `(Px,Py)` aplicada em:

`xi = x/L0`, `0 <= xi <= 1`,

o vetor equivalente usa interpolação axial linear e funções de forma Hermite:

`h1 = 1 - 3xi² + 2xi³`

`h2 = L0(xi - 2xi² + xi³)`

`h3 = 3xi² - 2xi³`

`h4 = L0(-xi² + xi³)`.

Então:

`pP = [Px(1-xi), Py h1, Py h2, Px xi, Py h3, Py h4]^T`.

Esse vetor é transformado pela orientação inicial `alpha0` e congelado. A posição relativa `xi` é preservada para a reconstrução dos diagramas na configuração corrente.

## 9. Recuperação física de esforços

O equilíbrio global utiliza as forças internas constitutivas e os vetores externos equivalentes. Para expor esforços físicos de extremidade, o solver recupera:

`fend = fint - peq`.

Depois `fend` é projetado no sistema co-rotante corrente.

Para a parcela uniforme na configuração corrente, a carga global congelada é projetada nos eixos atuais e escalada por `L0/l`, preservando a resultante da referência.

Sem carga pontual:

`N(x) = -N1 - qx x`

`V(x) = V1 + qy x`

`M(x) = -M1 + V1 x + qy x²/2`.

Para cada carga pontual `p` localizada em `a = xi l`, quando `x >= a`:

`N(x) <- N(x) - Px,p`

`V(x) <- V(x) + Py,p`

`M(x) <- M(x) + Py,p (x-a)`.

Assim, o diagrama apresenta o salto físico de `N/V` e a alteração de inclinação de `M` no ponto da carga.

O pós-processador registra `loadRecovery.equilibriumResidual` como diagnóstico entre a integração dos carregamentos e os esforços de extremidade recuperados.

## 10. Pós-processamento na geometria corrente

Cada elemento é reconstruído em 41 estações. A deflexão transversal usa interpolação Hermite das rotações relativas `phi1,phi2` no sistema co-rotante e é transformada para o sistema global.

Cada estação inclui:

- `x0,y0` — posição nominal;
- `xd,yd` — posição corrente;
- `N,V,M`;
- `ux,uy`;
- `uLocal,vLocal`;
- `sigmaAxial`, `sigmaTop`, `sigmaBottom`, `sigmaAbs`.

A interface também registra por elemento:

- `qx0,qy0`;
- peso próprio;
- cargas pontuais `xi, Px0, Py0`;
- projeção local corrente da carga pontual;
- resíduo de recuperação `N/V/M`.

A deformada é exibida em **escala física ×1**. Envelopes não lineares permanecem desabilitados; o pós-processador opera sobre um cenário por vez.

## 11. Benchmarks automatizados

### 11.1 Objetividade

Elemento `L=3.7 m` submetido a translação rígida `(1.25,-0.62) m` e rotação `0.83 rad`:

- `max|db| < 1e-12`;
- `max|fint| < 1e-6`.

### 11.2 Tangente consistente

Erro relativo máximo contra diferença central:

`1.7899600937e-9`.

### 11.3 Limite linear

Balanço `L=4 m`, `E=30 GPa`, `I=0.003125 m4`, `P=10 kN`:

- referência: `2.2755555556 mm`;
- co-rotacional: `2.2755550703 mm`.

### 11.4 Grande rotação — arco circular

Para `theta=1 rad`, `L=4 m`:

`xL = L sin(theta)/theta`

`yL = L[1-cos(theta)]/theta`.

Referência:

- `xL = 3.3658839392 m`;
- `yL = 1.8387907765 m`.

Com 16 elementos:

- `xL = 3.3664318343 m`;
- `yL = 1.8390900930 m`.

Erro vetorial de ponta:

- 4 elementos: `0.01000626945 m`;
- 8 elementos: `0.00249814644 m`;
- 16 elementos: `0.00062432313 m`.

### 11.5 Momento puro

Erro máximo de `M(x)` no benchmark refinado:

`≈ 2.25e-9 kN.m`.

### 11.6 UDL de referência

Viga biapoiada `L=6 m`, `q=20 kN/m`:

- `RA = 59.999999999999844 kN`;
- `RB = 59.99999999999985 kN`;
- flecha central `-3.599997114 mm`;
- `Mmax = 89.999935920 kN.m`;
- resíduo de recuperação `2.842170943e-14`.

### 11.7 Peso próprio

Para `gamma=25 kN/m³`, `A=0.15 m²`:

- `w = 3.75 kN/m`;
- `RA = RB = 11.25 kN`;
- `Mmax = 16.875 kN.m`.

### 11.8 Carga pontual de referência — v0.13.2

Viga biapoiada `L=6 m` com `P=100 kN` em `xi=0.5`:

- `RA = 50 kN`;
- `RB = 50 kN`;
- `Mmax = 150 kN.m`;
- salto de cortante no ponto da carga: `-100 kN`;
- resíduo de recuperação: `0`;
- rotações nodais coincidem com o mesmo modelo discreto linear dentro da tolerância de regressão.

### 11.9 Proteção de escopo

A suíte confirma erro explícito para:

- recalques ativos;
- deslocamentos prescritos não nulos;
- imperfeição modal ativa;
- ação térmica no modo co-rotacional.

Nenhum desses estados é descartado silenciosamente.

## 12. Relação com o P-Delta

O P‑Delta atualiza a rigidez geométrica por esforço normal mantendo a cinemática global de pequenas rotações. O co‑rotacional atualiza posição, comprimento, orientação da corda, rotações relativas e tangente a cada iteração.

O P‑Delta continua mais abrangente quanto a temperatura, molas, recalques, releases/semirrígidas e imperfeição modal. O co‑rotacional v0.13.2 acrescenta grandes rotações e aceita UDL, peso próprio e carga pontual como dead loads de referência.

## 13. Promoção para a interface

A v0.13.2 inclui:

1. terceiro modo no painel **Tipo de análise**;
2. controles de incrementos, iterações, tolerância e line search;
3. validação de compatibilidade antes da seleção;
4. solução pelo dispatcher principal;
5. deformada física ×1;
6. pós-processamento na geometria corrente;
7. UDL, peso próprio e carga pontual identificados como cargas mortas de referência;
8. relatório técnico com `xi, Px0, Py0`, modelo de carga e resíduo de recuperação;
9. bloqueio explícito de envelopes não lineares;
10. regressões estruturais e E2E em desktop, Android e tablet.

O rótulo **experimental** permanece obrigatório. Próximas extensões numéricas prioritárias: ações térmicas no co‑rotacional, follower loads com tangente externa consistente, releases/ligações semirrígidas, imperfeição inicial e arc-length/path-following.
