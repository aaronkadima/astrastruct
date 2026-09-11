# AstraStruct — Formulação co-rotacional 2D v0.13.4 (experimental)

## 1. Objetivo e status

Este documento registra a formulação geometricamente não linear implementada em `web/src/solver/corotational2d.js` e o pós-processamento em `web/src/solver/corotationalPostprocess.js`.

O modo está disponível na interface como **Geom. não linear — experimental v0.13.4**. A versão atual reúne cinemática co-rotacional, Newton–Raphson incremental, cargas mecânicas mortas de referência, estado térmico inicial e força seguidora concentrada na extremidade 2 com tangente externa consistente. O rótulo experimental permanece obrigatório: estes recursos não constituem certificação normativa ou validação universal.

## 2. Escopo da v0.13.4

Admitido atualmente:

- modelos exclusivamente `frame2d`;
- Euler–Bernoulli;
- material elástico linear;
- pequenas deformações locais e rotações globais finitas;
- cargas nodais em eixos globais;
- `uniform`, `selfWeight` e `point` como dead loads da configuração de referência;
- `thermal` como deformação axial e curvatura iniciais;
- `followerEnd` como força concentrada na extremidade 2, definida nos eixos locais da corda corrente;
- extremidades rígidas;
- apoios clássicos com deslocamentos prescritos nulos;
- Newton–Raphson incremental com line search opcional;
- até 240 graus de liberdade livres no navegador.

Recusado explicitamente:

- follower na extremidade 1;
- follower distribuída;
- follower aplicada em ponto interior da barra;
- follower moment;
- molas nodais;
- releases e ligações semirrígidas;
- recalques e deslocamentos prescritos não nulos;
- imperfeição modal inicial;
- `truss2d` e modelos mistos.

Também não estão implementados material não linear, seções de fibras, arc-length, contato, pórtico 3D, Timoshenko, shell ou solid.

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

A rotação rígida da corda é `Delta alpha = alpha-alpha0`, normalizada por `atan2(sin(Delta alpha),cos(Delta alpha))`.

As deformações básicas são:

`db = [l-L0, phi1, phi2]^T`

`phi1 = theta1 - Delta alpha`

`phi2 = theta2 - Delta alpha`.

Movimento rígido puro não gera deformação básica.

## 4. Relação constitutiva básica e temperatura

Para Euler–Bernoulli elástico linear:

`kb = [[EA/L0, 0, 0],
       [0, 4EI/L0, 2EI/L0],
       [0, 2EI/L0, 4EI/L0]]`.

Sem estado inicial:

`qb = kb db`.

Para temperatura uniforme e gradiente térmico:

`epsilonT = alphaT DeltaT`

`kappaT = -alphaT DeltaTg/h`.

O vetor de deformação básica livre é:

`db,T = [epsilonT L0, -kappaT L0/2, +kappaT L0/2]^T`.

Assim:

`qb = kb (db-db,T)`.

O estado térmico é aplicado incrementalmente:

`db,T(lambda) = lambda db,T`.

Ele não é convertido em força externa. A profundidade `h` deve ser conhecida para gradiente térmico; caso contrário, o solver emite erro explícito.

## 5. Transformação cinemática e força interna

Com `c=cos(alpha)` e `s=sin(alpha)`:

`r = [-c,-s,0,c,s,0]^T`

`z = [s,-c,0,-s,c,0]^T`.

A matriz cinemática `B=d(db)/dq` usa:

`B1 = r^T`

`B2 = -z^T/l + [0,0,1,0,0,0]`

`B3 = -z^T/l + [0,0,0,0,0,1]`.

A força interna global é:

`fint = B^T qb`.

## 6. Tangente interna consistente

A tangente interna é:

`Kint = B^T kb B + Kg,N + Kg,M`

com:

`Kg,N = (N/l) z z^T`

`Kg,M = [(M1+M2)/l^2] (r z^T + z r^T)`.

A derivada analítica de `fint` foi comparada com diferença central em estado deformado. O benchmark principal apresenta erro relativo máximo:

`1.7899600937e-9`.

O estado térmico inicial não cria uma matriz tangente independente, mas modifica `N`, `M1` e `M2`, que entram nos termos geométricos da tangente interna.

## 7. Cargas mecânicas mortas da configuração de referência

`uniform`, `selfWeight` e `point` são calculadas na geometria inicial e congeladas em eixos globais durante Newton–Raphson. Elas não acompanham a rotação da barra e não possuem tangente externa.

### 7.1 Carga uniforme

Para `qx0,qy0` nos eixos locais iniciais:

`pUDL = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, -qy0 L0²/12]^T`.

### 7.2 Peso próprio

Para peso específico `gamma`, área `A` e fator `f`:

`w = gamma A f`.

A força gravitacional global é projetada nos eixos locais iniciais e convertida para o vetor consistente de UDL.

### 7.3 Carga pontual de barra

Para `(Px,Py)` em `xi=x/L0`, com `0<=xi<=1`:

`h1 = 1 - 3xi² + 2xi³`

`h2 = L0(xi - 2xi² + xi³)`

`h3 = 3xi² - 2xi³`

`h4 = L0(-xi² + xi³)`

`pP = [Px(1-xi), Py h1, Py h2, Px xi, Py h3, Py h4]^T`.

O vetor é transformado pela orientação inicial `alpha0` e congelado. A posição relativa `xi` é preservada para reconstruir saltos nos diagramas na geometria corrente.

## 8. Força seguidora concentrada — v0.13.4

A ação `followerEnd` representa uma força concentrada na **extremidade 2**. Suas componentes locais `(Px,Py)` permanecem constantes nos eixos da corda corrente.

O vetor externo elementar é:

`Pf(q) = [0,0,0,Fx,Fy,0]^T`

com:

`Fx = c Px - s Py`

`Fy = s Px + c Py`.

Como `alpha` depende de `q`, esta ação possui derivada externa. Para a corda corrente:

`g = d(alpha)/dq = [s/l, -c/l, 0, -s/l, c/l, 0]`.

As derivadas direcionais são:

`dFx/dalpha = -s Px - c Py`

`dFy/dalpha = c Px - s Py`.

Logo, as linhas translacionais da extremidade 2 da tangente externa são:

`Kext[ux2,:] = (dFx/dalpha) g`

`Kext[uy2,:] = (dFy/dalpha) g`.

As demais linhas são nulas nesta formulação. Em geral, `Kext` é **não simétrica**. Isso é esperado para uma ação seguidora não conservativa e não deve ser artificialmente simetrizado.

### 8.1 Equilíbrio e Newton com follower

Definindo `Fref` como cargas nodais e dead loads de referência, o resíduo é:

`R(q,lambda) = lambda [Fref + Pf(q)] - fint(q,lambda)`.

A derivada do resíduo leva a:

`(Kint - lambda Kext) Deltaq = R`.

Portanto, o solver não trata follower como vetor congelado: tanto sua direção global quanto `Kext` são atualizados na configuração corrente a cada iteração.

### 8.2 Casos e combinações

O Scenario Engine aplica o fator do caso/combinação às componentes locais `Px/Py` antes da trajetória não linear. Assim, por exemplo, uma ação `Px=100 kN` em um caso com fator `1.4` entra no solver como `Px=140 kN`.

A combinação continua sendo **custom/user-defined**; isso não representa automaticamente combinações normativas.

### 8.3 Limites atuais da follower

A v0.13.4 não generaliza esta formulação para:

- extremidade 1;
- momento seguidor;
- carga distribuída seguidora;
- carga seguidora em ponto interior;
- dependências adicionais de orientação além da corda corrente.

Esses estados devem ganhar formulações e tangentes externas próprias antes de serem habilitados.

## 9. Equilíbrio incremental e convergência

Para cada incremento `lambda`, o solver atualiza a geometria, `Kint`, forças internas, estado térmico, follower e `Kext`.

O passo é:

`Ktan Deltaq = R`

com:

`Ktan = Kint - lambda Kext`.

A atualização usa:

`q_(i+1) = q_i + eta Deltaq`,

onde `eta` é o fator do line search quando habilitado.

O critério usa norma infinita do resíduo. A escala é construída com as forças externas mecânicas e, na presença de temperatura, também com:

`EA |epsilonT|`

`EI |kappaT|`.

Essa escala é dimensionalmente compatível com o resíduo de força/momento.

## 10. Recuperação física e pós-processamento

Para as cargas mecânicas mortas de referência, os esforços físicos de extremidade são recuperados separando a força interna do vetor nodal equivalente:

`fend = fint - peq`.

Na configuração corrente, a componente uniforme global congelada é projetada nos eixos atuais e escalada por `L0/l`, preservando a resultante.

Sem carga pontual:

`N(x) = -N1 - qx x`

`V(x) = V1 + qy x`

`M(x) = -M1 + V1 x + qy x²/2`.

Para uma carga pontual em `a=xi l`, quando `x>=a`:

`N(x) <- N(x) - Px`

`V(x) <- V(x) + Py`

`M(x) <- M(x) + Py(x-a)`.

O pós-processador registra separadamente:

- `referenceLoad` e resíduo de recuperação `N/V/M`;
- `thermal` com `DeltaT`, `DeltaTg`, `alphaT`, `epsilonT`, `kappaT`;
- `followerEnds` com `Px/Py`, `Fx/Fy` atuais, `alpha` e `max|Kext|`.

Cada elemento possui 41 estações na geometria corrente. A deformada é exibida em escala física ×1. Envelopes não lineares permanecem desabilitados.

## 11. Benchmarks automatizados

### 11.1 Objetividade

Movimento rígido com rotação `0.83 rad`:

- `max|db| < 1e-12`;
- `max|fint| < 1e-6`.

### 11.2 Tangente interna

Erro relativo máximo contra diferença central:

`1.7899600937e-9`.

### 11.3 Limite linear

Balanço `L=4 m`, `P=10 kN`:

- referência `uy=-2.2755555556 mm`;
- co-rotacional `uy=-2.2755550703 mm`.

### 11.4 Grande rotação e convergência de malha

Arco circular sob momento puro, `theta=1 rad`, `L=4 m`:

- erro de ponta com 4 elementos: `0.01000626945 m`;
- 8 elementos: `0.00249814644 m`;
- 16 elementos: `0.00062432313 m`;
- erro máximo de `M(x)` no caso refinado: aproximadamente `2.25e-9 kN.m`.

### 11.5 UDL, peso próprio e carga pontual

UDL `q=20 kN/m`, `L=6 m`:

- `RA≈RB≈60 kN`;
- flecha central `-3.599997114 mm`;
- `Mmax=89.999935920 kN.m`;
- resíduo de recuperação `2.84e-14`.

Peso próprio `gamma=25 kN/m³`, `A=0.15 m²`:

- `w=3.75 kN/m`;
- `RA=RB=11.25 kN`;
- `Mmax=16.875 kN.m`.

Carga pontual `P=100 kN`, `L=6 m`, `xi=0.5`:

- `RA=RB=50 kN`;
- `Mmax=150 kN.m`;
- salto de cortante `-100 kN`;
- resíduo de recuperação `0`.

### 11.6 Temperatura

Expansão livre:

- `DeltaL=1.0 mm`;
- AstraStruct `1.0000000000002203 mm`;
- `N=7.5135e-10 kN`.

Expansão impedida:

- `N=-2250 kN`.

Gradiente livre:

- `theta=-0.0016 rad`;
- erro geométrico `6.6667e-9 m`;
- força residual máxima aproximadamente `3.0e-9`.

### 11.7 Tangente externa follower

No benchmark principal, `Kext` é comparado à diferença central de `Pf(q)` em um estado deformado com `Px=13 kN`, `Py=-7 kN`:

- erro relativo `7.6273e-10`;
- `max|Kext|=4.1089271687`;
- assimetria não nula confirmada.

Uma suíte follower independente também verifica a derivada com erro relativo da ordem de `1.11e-9` e testa a transformação da força para `alpha=0.63 rad`.

### 11.8 Follower no solver global

Um balanço com `Py=-10 kN` na extremidade 2 verifica que a direção global acompanha a corda corrente e que reações equilibram a força seguidora atualizada.

### 11.9 Combinação follower

No benchmark axial:

- `Px base=100 kN`;
- fator da combinação `1.4`;
- `Px resolvido=140 kN`;
- deslocamento de ponta `ux=0.0622222222 mm`;
- reação axial aproximadamente `-140 kN`.

Isso congela a integração entre Scenario Engine e solver co-rotacional.

### 11.10 Proteção de escopo

A suíte confirma erro explícito para:

- follower na extremidade 1;
- recalques ativos;
- deslocamentos prescritos não nulos;
- imperfeição modal ativa.

Nenhum desses estados é descartado silenciosamente.

## 12. Interface, relatório e rastreabilidade

A v0.13.4 inclui:

1. seleção do modo co-rotacional no painel **Tipo de análise**;
2. controles de incrementos, iterações, tolerância e line search;
3. editor de força seguidora com seleção do elemento e caso ativo;
4. criação/edição de `Px/Py` na extremidade 2;
5. bloqueio de aplicação do modo Linear/P‑Delta quando existe follower;
6. solução pelo dispatcher principal com `solverVersion=0.13.4-exp`;
7. deformada física ×1;
8. pós-processamento na geometria corrente;
9. rastreabilidade separada para dead loads, temperatura e follower;
10. relatório técnico com `Kext`, força local/global atual e limitações;
11. bloqueio explícito de envelopes não lineares;
12. regressões estruturais e E2E em desktop, Android e tablet.

## 13. Relação com o P‑Delta e próximos passos

O P‑Delta atualiza a rigidez geométrica por esforço normal mantendo cinemática global de pequenas rotações. O co-rotacional atualiza posição, comprimento, orientação da corda, rotações relativas, tangente interna e, quando aplicável, tangente externa da follower.

O P‑Delta continua mais abrangente quanto a molas, recalques, releases/semirrígidas e imperfeição modal. O co‑rotacional v0.13.4 acrescenta grandes rotações, ações térmicas como estado inicial e uma primeira ação não conservativa com tangente externa consistente.

Próximas extensões numéricas prioritárias:

- follower distribuída, interior e follower moment;
- releases, ligações semirrígidas e offsets no co‑rotacional;
- imperfeição inicial na geometria co‑rotacional;
- arc-length/path-following;
- material não linear e seções de fibras.
