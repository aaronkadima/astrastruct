# AstraStruct — Formulação co-rotacional 2D v0.13.1 (experimental)

## 1. Objetivo e status

Este documento registra a formulação geométrica não linear implementada em `web/src/solver/corotational2d.js` e o pós-processamento em `web/src/solver/corotationalPostprocess.js`.

O modo está disponível na interface como **Geom. não linear — experimental v0.13.1**, sem substituir os solvers Linear e P‑Delta. A promoção para a UI significa que configuração, solução, geometria corrente, pós-processamento e relatório possuem fluxo próprio e testes E2E; não significa certificação normativa ou validação universal.

## 2. Hipóteses e limites

A v0.13.1 admite:

- pórticos 2D exclusivamente `frame2d`;
- Euler–Bernoulli;
- material elástico linear no sistema básico;
- pequenas deformações locais e rotações globais finitas;
- cargas nodais mortas em eixos globais;
- carga uniforme `uniform` como **dead load da configuração de referência**;
- peso próprio `selfWeight` como **dead load vertical global da configuração de referência**;
- extremidades rígidas;
- apoios clássicos com deslocamento prescrito nulo;
- Newton–Raphson incremental com line search opcional;
- até 240 graus de liberdade livres no navegador.

O kernel recusa explicitamente:

- carga pontual em barra;
- ações térmicas;
- cargas seguidoras/follower loads;
- molas nodais;
- releases e ligações semirrígidas;
- recalques e deslocamentos prescritos não nulos;
- imperfeição modal inicial;
- elementos `truss2d` ou modelos mistos.

Também não estão implementados material não linear, seções de fibras, arc-length, contato, pórtico 3D, Timoshenko, shell ou solid.

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

A não linearidade da v0.13.1 é exclusivamente geométrica.

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

## 8. Cargas distribuídas mortas de referência — v0.13.1

A v0.13.1 introduz `uniform` e `selfWeight` sem tratá-las como cargas seguidoras.

Para uma carga uniforme definida nos eixos locais iniciais por `qx0, qy0`, o vetor nodal consistente é calculado **uma única vez** com o comprimento e a orientação iniciais `L0, alpha0`:

`p0 = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, -qy0 L0²/12]^T`.

Esse vetor é transformado para o sistema global usando a orientação inicial e permanece congelado durante as iterações de Newton. Portanto:

- a magnitude/direção global da carga externa não acompanha a rotação corrente da barra;
- não existe tangente externa de follower load nesta versão;
- a formulação representa uma **dead load da configuração de referência**.

Para `selfWeight`, com peso específico `gamma`, área `A` e fator `f`:

`w = gamma A f`.

A ação gravitacional global é vertical para baixo. O solver projeta essa ação nos eixos locais iniciais para formar `qx0, qy0`, calcula o mesmo vetor consistente e o mantém congelado.

Cargas pontuais em barra e ações térmicas continuam recusadas no modo co‑rotacional.

## 9. Convenção e recuperação de esforços

- `N > 0`: tração;
- `M1`, `M2`: momentos básicos constitutivos.

Sem carga de barra, a conversão básica é:

`N1 = -N`

`N2 = N`

`V1 = (M1+M2)/l`

`V2 = -V1`.

Com `uniform/selfWeight`, os esforços físicos de extremidade são recuperados a partir do vetor interno e do vetor nodal equivalente da carga. A ideia é separar:

`força física de extremidade = força interna nodal - carga nodal equivalente`.

No pós-processamento, a carga global de referência é projetada sobre o sistema co-rotante corrente somente para reconstruir os diagramas de seção. O fator geométrico `L0/l` preserva a resultante total da dead load de referência ao longo do elemento corrente.

Com `qx, qy` recuperados na configuração corrente:

`N(x) = -N1 - qx x`

`V(x) = V1 + qy x`

`M(x) = -M1 + V1 x + qy x²/2`.

O pós-processador registra `loadRecovery.equilibriumResidual` como diagnóstico da compatibilidade entre esforços de extremidade e integração de `qx,qy`.

## 10. Pós-processamento na geometria corrente

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
- `uniform/selfWeight` são identificados como **carga morta de referência**;
- `qx0`, `qy0`, peso próprio e resíduo de recuperação são expostos no pós-processamento/relatório;
- o painel de pós-processamento é **somente por cenário**;
- envelopes não lineares ficam explicitamente desabilitados.

O relatório técnico próprio registra formulação, parâmetros de Newton, modelo de carga, histórico de convergência, deslocamentos, extremos por elemento e limitações.

## 11. Benchmarks automatizados

### 11.1 Objetividade

Elemento `L = 3.7 m` com translação rígida `(1.25,-0.62) m` e rotação rígida `0.83 rad`:

- `max|db| < 1e-12`;
- `max|fint| < 1e-6`.

### 11.2 Tangente consistente

Diferença central em estado deformado:

`erro relativo máximo = 1.7899600937e-9`.

### 11.3 Limite linear

Console `L = 4 m`, `E = 30 GPa`, `I = 0.003125 m4`, `P = 10 kN`:

- referência: `2.2755555556 mm`;
- co-rotacional: `2.2755550703 mm`.

### 11.4 Grande rotação — arco circular

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

### 11.5 Pós-processamento de momento puro

No caso de momento puro, o erro máximo de `M(x)` ao longo das estações fica em aproximadamente:

`2.25e-9 kN.m`.

A última estação do último elemento coincide com a coordenada deformada do nó final dentro da tolerância de regressão.

### 11.6 Viga biapoiada com UDL de referência

Caso de regressão:

- `L = 6 m` em dois elementos;
- `qy0 = -20 kN/m`;
- seção `A = 0.15 m²`, `I = 0.003125 m4`;
- concreto `E = 30 GPa`.

Referência linear:

- `RA = RB = 60 kN`;
- `Mmax = 90 kN.m`;
- flecha no meio `-3.600000 mm`.

AstraStruct co‑rotacional v0.13.1:

- `RA = 59.999999999999844 kN`;
- `RB = 59.99999999999985 kN`;
- flecha no meio `-3.599997114 mm`;
- `Mmax = 89.999935920 kN.m`;
- resíduo de recuperação `2.842170943e-14`.

### 11.7 Peso próprio de referência

Para a mesma viga, com:

- `gamma = 25 kN/m³`;
- `A = 0.15 m²`;
- `w = gamma A = 3.75 kN/m`.

O benchmark fornece:

- `RA = RB = 11.25 kN`;
- `Mmax = 16.875 kN.m`.

### 11.8 Proteção de escopo

Testes verificam que o kernel gera erro explícito para:

- recalque ativo convertido pelo Scenario Engine;
- deslocamento-base prescrito em apoio;
- imperfeição modal ativa;
- carga pontual em barra.

Nenhum desses estados é descartado silenciosamente.

## 12. Relação com o P‑Delta v0.12

O P‑Delta atualiza a rigidez geométrica por esforço normal mantendo a cinemática global de pequenas rotações. O co‑rotacional atualiza explicitamente posição, comprimento, orientação da corda, rotações relativas e tangente a cada iteração.

O P‑Delta continua mais abrangente quanto a tipos de ações e recursos de elemento. O co‑rotacional v0.13.1 passa a aceitar UDL/peso próprio como dead loads de referência, mas permanece mais restrito quanto a cargas pontuais de barra, temperatura, molas, ligações e imperfeições iniciais.

## 13. Estado da promoção para a interface

A promoção experimental inclui:

1. terceiro modo no painel **Tipo de análise**;
2. controles de incrementos, iterações, tolerância e line search;
3. verificação de compatibilidade antes da seleção;
4. solução pelo dispatcher principal;
5. deformada física ×1 e geometria corrente;
6. diagramas/sonda/mapa de tensão na geometria corrente;
7. UDL e peso próprio explicitamente identificados como cargas mortas de referência;
8. pós-processador de cenário específico sem envelope não linear;
9. relatório técnico específico com rastreabilidade do modelo de carga;
10. testes unitários/regressivos e E2E em desktop, Android e tablet.

O rótulo **experimental** permanece obrigatório. As próximas evoluções numéricas prioritárias são: carga pontual em barra, ações térmicas no co‑rotacional, cargas seguidoras com tangente externa consistente, releases/ligações semirrígidas, imperfeição inicial e seguimento de caminho próximo a pontos-limite.
