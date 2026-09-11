# AstraStruct — Formulação co-rotacional 2D v0.13 (experimental)

## 1. Objetivo

Este documento registra a formulação geométrica não linear implementada no núcleo experimental `web/src/solver/corotational2d.js`.

A implementação não substitui os solvers `linear` e `pdelta` da versão corrente. Seu objetivo é estabelecer um núcleo verificável para grandes rotações de pórticos planos Euler–Bernoulli antes da incorporação de cargas de barra, imperfeições iniciais, ligações flexíveis e não linearidade material.

## 2. Hipóteses da versão v0.13

A versão experimental admite:

- pórticos 2D compostos exclusivamente por elementos `frame2d`;
- comportamento elástico linear no sistema básico do elemento;
- pequenas deformações locais e rotações globais finitas;
- cargas nodais mortas, definidas no sistema global;
- extremidades rígidas;
- apoios nodais clássicos com deslocamento prescrito igual a zero;
- solução incremental por Newton–Raphson com line search.

Ainda não estão incluídos neste kernel:

- cargas distribuídas, pontuais em barra, peso próprio e temperatura;
- deslocamentos impostos não nulos;
- molas nodais;
- releases e ligações semirrígidas;
- imperfeição geométrica inicial;
- material não linear ou seções de fibras;
- cargas seguidoras;
- controle de arco/comprimento de arco;
- contato;
- pórtico 3D, Timoshenko, shell ou solid.

Essas restrições são verificadas explicitamente pelo solver. O kernel não converte silenciosamente recursos não suportados em aproximações.

## 3. Cinemática co-rotacional

Para um elemento com coordenadas iniciais

`(X1,Y1)` e `(X2,Y2)`, define-se

`L0 = sqrt[(X2-X1)^2 + (Y2-Y1)^2]`

`alpha0 = atan2(Y2-Y1, X2-X1)`.

O vetor de graus de liberdade globais é

`q = [u1, v1, theta1, u2, v2, theta2]^T`.

As coordenadas correntes são

`x1 = X1 + u1`, `y1 = Y1 + v1`

`x2 = X2 + u2`, `y2 = Y2 + v2`.

A configuração corrente é caracterizada por

`l = sqrt[(x2-x1)^2 + (y2-y1)^2]`

`alpha = atan2(y2-y1, x2-x1)`.

A rotação rígida da corda é

`Delta alpha = alpha - alpha0`,

normalizada no intervalo principal por `atan2(sin(Delta alpha),cos(Delta alpha))` na versão atual.

As três deformações básicas do elemento são

`db = [l-L0, phi1, phi2]^T`,

com

`phi1 = theta1 - Delta alpha`

`phi2 = theta2 - Delta alpha`.

Assim, uma translação e rotação rígidas do elemento não geram deformação básica.

## 4. Relação constitutiva básica

Para Euler–Bernoulli elástico linear:

`qb = kb db`,

onde

`qb = [N, M1, M2]^T`

e

`kb = [[EA/L0, 0, 0],
       [0, 4EI/L0, 2EI/L0],
       [0, 2EI/L0, 4EI/L0]]`.

A não linearidade desta versão é exclusivamente geométrica. A relação constitutiva local permanece linear.

## 5. Transformação cinemática

Definindo

`c = cos(alpha)` e `s = sin(alpha)`, usam-se os vetores

`r = [-c,-s,0,c,s,0]^T`

`z = [s,-c,0,-s,c,0]^T`.

A matriz cinemática básica é

`B = d(db)/d(q)`.

Suas linhas são

`B1 = r^T`

`B2 = -z^T/l + [0,0,1,0,0,0]`

`B3 = -z^T/l + [0,0,0,0,0,1]`.

As forças internas globais são

`fint = B^T qb`.

## 6. Tangente consistente

A matriz tangente implementada é

`Kt = B^T kb B + Kg,N + Kg,M`,

com

`Kg,N = (N/l) z z^T`

`Kg,M = [(M1+M2)/l^2] (r z^T + z r^T)`.

Portanto, a tangente inclui explicitamente os termos resultantes das derivadas de comprimento e rotação da corda.

A matriz foi verificada numericamente pela diferença central de `fint` em relação aos seis graus de liberdade em um estado já deformado.

Resultado atual do CI:

`erro relativo máximo = 1.7899600937e-9`.

Esse teste é uma regressão obrigatória do kernel.

## 7. Equilíbrio incremental

Para um fator de carga `lambda`, o equilíbrio é

`R(q) = lambda Fext - fint(q) = 0`.

Em cada iteração de Newton–Raphson:

`Kt(q_i) Delta q = R(q_i)`

`q_(i+1) = q_i + eta Delta q`,

onde `eta` é o fator do line search.

A implementação atual usa:

- número definido de incrementos de carga;
- máximo de iterações por incremento;
- tolerância no resíduo dos graus de liberdade livres;
- line search por redução sucessiva de `eta` até melhora do resíduo ou limite `1/64`.

O estado convergido de um incremento é usado como estimativa inicial do incremento seguinte.

## 8. Convenção de esforços

O vetor básico usa

- `N > 0`: tração;
- `M1`, `M2`: momentos básicos nas extremidades.

Para exposição compatível com a estrutura de resultados do AstraStruct:

`N1 = -N`

`N2 = N`

`V1 = (M1+M2)/l`

`V2 = -V1`.

Essa conversão não altera o sistema básico usado pelo equilíbrio não linear.

## 9. Benchmarks automatizados

### 9.1 Objetividade

Um elemento de comprimento `3.7 m` recebe:

- translação rígida `(1.25,-0.62) m`;
- rotação rígida `0.83 rad`.

As rotações nodais são iguais à rotação da corda.

Critérios:

- `max|db| < 1e-12`;
- `max|fint| < 1e-6`.

O teste passa no CI.

### 9.2 Limite linear

Console horizontal:

- `L = 4 m`;
- `E = 30 GPa`;
- `I = 0.003125 m4`;
- `P = 10 kN` vertical na extremidade.

Referência linear:

`delta = PL^3/(3EI) = 2.2755555556 mm`.

AstraStruct co-rotacional:

`delta = 2.2755550703 mm`.

A diferença é inferior a `5e-7 mm` no benchmark atual.

### 9.3 Grande rotação — arco circular

Console sob momento puro, com:

- `L = 4 m`;
- rotação final de extremidade `theta = 1 rad`;
- `M = EI theta/L`.

A solução contínua inextensível é

`xL = L sin(theta)/theta`

`yL = L [1-cos(theta)]/theta`.

Para `theta = 1 rad`:

`xL = 3.3658839392 m`

`yL = 1.8387907765 m`.

Com 16 elementos, o AstraStruct fornece

`xL = 3.3664318343 m`

`yL = 1.8390900930 m`.

Erro vetorial de ponta:

- 4 elementos: `0.01000626945 m`;
- 8 elementos: `0.00249814644 m`;
- 16 elementos: `0.00062432313 m`.

A redução é aproximadamente por fator 4 a cada duplicação da malha, coerente com convergência quadrática nesse benchmark.

A reação de momento na base também é verificada contra o momento externo aplicado.

## 10. Relação com o P-Delta v0.12

O P-Delta v0.12 resolve um problema de segunda ordem baseado em rigidez geométrica atualizada pelos esforços normais, mantendo a cinemática global de pequenas rotações.

O kernel co-rotacional v0.13 atualiza explicitamente:

- posição dos nós;
- comprimento do elemento;
- orientação da corda;
- rotações locais relativas à corda;
- matriz tangente em cada iteração.

Portanto, ele é a base planejada para análise geometricamente não linear com grandes rotações.

O P-Delta continua sendo o solver estável de produção do AstraStruct para segunda ordem dentro do escopo atualmente validado.

## 11. Próxima evolução necessária antes de promoção para a interface principal

A promoção do modo co-rotacional para a interface de análise exige, no mínimo:

1. pós-processamento não linear específico usando geometria corrente;
2. representação da deformada sem reutilizar a interpolação linear de pequenas rotações;
3. suporte a cargas de barra mortas e definição inequívoca de cargas seguidoras;
4. adaptação de imperfeições iniciais como geometria de referência sem tensão espúria;
5. estratégia para releases e ligações semirrígidas;
6. controle adaptativo de incrementos;
7. testes adicionais próximos a instabilidade e pontos-limite;
8. integração ao VNL e histórico de convergência.

Até que esses itens sejam implementados e validados, o solver permanece classificado como **experimental** e não aparece como substituto do modo Linear ou P-Delta na interface principal.
