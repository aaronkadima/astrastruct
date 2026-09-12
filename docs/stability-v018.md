# AstraStruct v0.18 — estabilidade tangente, singularidades e bifurcações

## Escopo

A v0.18 acrescenta diagnóstico espectral de estabilidade ao caminho co-rotacional Arc-Length/Riks da v0.17. O objetivo é localizar mudanças de sinal de um autovalor crítico da tangente, distinguir numericamente pontos-limite de candidatos a bifurcação conservativa e, opcionalmente, semear um ramo bifurcado por uma restrição modal de um único incremento.

O recurso é experimental. Ele não substitui uma análise geral de bifurcação não conservativa, não trata autovalores complexos e não garante descoberta de todos os ramos quando há modos múltiplos ou quase coincidentes.

## Tangente escalada

Se `K_t` é a tangente reduzida aos graus de liberdade livres, utiliza-se uma transformação diagonal de escala `S`. Translações têm escala unitária e rotações usam o comprimento característico `L_c` do modelo. A matriz analisada é a parte simétrica da tangente escalada:

`K_s = 1/2 [ S^-T K_t S^-1 + (S^-T K_t S^-1)^T ]`.

O comprimento característico é o máximo entre a diagonal da caixa envolvente, o comprimento médio dos elementos e um piso numérico. Isso coloca rotações e translações em uma métrica generalizada compatível com a utilizada no Arc-Length.

## Extração do modo crítico

Para modelos até o limite configurado de graus de liberdade espectrais, a v0.18 calcula o espectro de `K_s` com um algoritmo de Jacobi para matrizes reais simétricas. No primeiro estado é selecionado o autovalor de menor módulo. Nos estados seguintes o modo é rastreado por maior projeção com o autovetor generalizado anteriormente selecionado, reduzindo trocas espúrias entre modos vizinhos.

O sinal do autovetor é orientado para continuidade. O resultado registra o vetor modal completo e, para apresentação, o deslocamento translacional dominante (`Ux` ou `Uy`) quando existe.

## Detecção de singularidade

Se o autovalor crítico muda de sinal entre dois estados convergidos, a v0.18 interpola linearmente o fator de carga e o deslocamento monitorado no cruzamento:

`lambda_cr ~= lambda_i + eta (lambda_{i+1} - lambda_i)`

com

`eta = |mu_i| / (|mu_i| + |mu_{i+1}|)`.

O mesmo fator de interpolação é utilizado para o deslocamento monitorado.

## Classificação

Para tangentes suficientemente simétricas, a regra experimental é:

- cruzamento de `mu = 0` acompanhado por reversão do incremento de carga `Delta lambda`: **ponto-limite**;
- cruzamento de `mu = 0` sem reversão de `Delta lambda`: **candidato a bifurcação**.

A classificação depende da discretização e do tamanho dos incrementos; por isso o termo “candidato” é deliberado.

### Tangentes não conservativas

A presença de forças follower pode tornar a tangente global não simétrica. A v0.18 mede

`rho_asym = ||K - K^T||_max / max(1, ||K||_max)`.

Quando `rho_asym` excede a tolerância configurada, o espectro da parte simétrica continua sendo registrado como indicador, mas o evento recebe a classificação **candidato a singularidade não conservativa**. A implementação não afirma que esse evento seja uma bifurcação conservativa e não executa troca automática de ramo a partir dele.

## Troca de ramo experimental

A troca de ramo é desativada por padrão. Quando habilitada e a primeira bifurcação candidata é detectada, o autovetor crítico é normalizado na métrica do Arc-Length. No incremento seguinte, somente para semear o ramo, a restrição esférica é temporariamente substituída por uma restrição de amplitude modal:

`phi_cr^T W Delta u = s_b beta Delta s`,

onde `s_b` é o sinal selecionado pelo usuário e `beta` é a razão de amplitude modal configurada.

O sistema de Newton desse passo utiliza:

`[ K_t   -dR/dlambda ] [delta u     ] = [R ]`

`[ phi^T W      0    ] [delta lambda]   [-g]`.

Após a convergência do passo de semeadura, a continuação volta à restrição esférica de Crisfield. O histórico identifica explicitamente esse incremento como `critical-mode-seed` e registra a projeção modal obtida.

Esse procedimento é uma técnica numérica de seleção de ramo, não uma imperfeição geométrica permanente e não uma prova de unicidade do ramo pós-crítico.

## Validação v0.18

O benchmark principal é uma coluna de Euler biarticulada discretizada com oito elementos de pórtico. A análise linear de flambagem fornece `lambda_cr ~= 0.986993`, enquanto o rastreamento espectral no caminho co-rotacional identifica `lambda_cr ~= 1.004727`. O modo dominante é lateral no nó central (`N4/Ux`).

Com a troca de ramo habilitada, a bifurcação é detectada entre os passos 11 e 12, o passo modal é aplicado no passo seguinte e a solução passa ao ramo lateral, atingindo deslocamento transversal da ordem de 10 mm no benchmark automático.

Um segundo benchmark de arco raso verifica que a singularidade associada ao snap-through é classificada como ponto-limite, em vez de bifurcação.

Toda a suíte anterior de análise linear, P-Delta, co-rotacional, follower, imperfeições, rótulas de fibras, pushover e Arc-Length permanece como regressão obrigatória.

## Limitações atuais

- análise espectral real da parte simétrica da tangente;
- não resolve autovalores complexos de problemas não conservativos;
- não trata multiplicidade exata ou clusters modais com subespaços invariantes;
- branch switching automático limitado à primeira bifurcação candidata;
- não há busca sistemática de todos os ramos;
- não há dinâmica, flambagem dinâmica, contato ou plasticidade distribuída;
- o aço de fibras continua bilinear monotônico, sem história cíclica;
- o custo espectral é limitado pelo parâmetro `stabilityMaxDofs`, padrão 120.

Para esses motivos, os resultados v0.18 devem ser tratados como diagnóstico e continuação não linear experimental, com auditoria do caminho, malha, tolerâncias e sensibilidade ao incremento.
