# AstraStruct v0.20 — plasticidade distribuída de aço

## Objetivo

A v0.20 introduz plasticidade distribuída em elementos `frame2d` de aço, mantendo a formulação geométrica co-rotacional já utilizada pelo AstraStruct. Em vez de concentrar a resposta inelástica apenas em rótulas nas extremidades, o elemento integra seções de fibras em múltiplas posições ao longo do seu comprimento de referência.

Esta primeira versão é deliberadamente monotônica. A lei de cada fibra continua sendo o envelope bilinear do aço usado nas versões anteriores; memória de descarga/recarga e histerese pertencem à v0.21.

## Formulação do elemento

O elemento é `displacement-based Euler–Bernoulli` de dois nós. No sistema básico co-rotacional são usadas as deformações generalizadas:

`d = [ΔL, φ1, φ2]^T`.

Após subtrair o estado térmico inicial, a deformação axial é constante:

`ε0 = ΔL/L0`.

A curvatura é interpolada linearmente ao longo do elemento:

`κ(ξ) = Bκ1(ξ) φ1 + Bκ2(ξ) φ2`,

com

`Bκ1 = (-4 + 6ξ)/L0`,

`Bκ2 = (-2 + 6ξ)/L0`,

para `0 ≤ ξ ≤ 1`.

Em cada ponto de integração, a seção de fibras resolve:

`ε(y) = ε0 - κ y`,

`N = Σ σ_i A_i`,

`M = -Σ σ_i A_i y_i`.

A matriz tangente da seção é

`D = [[ΣEt A, -ΣEt A y],[-ΣEt A y, ΣEt A y²]]`.

As forças e a rigidez básicas do elemento são integradas numericamente:

`q_b = ∫ B^T s dx`,

`k_b = ∫ B^T D B dx`,

onde `s=[N,M]^T`.

Quando todas as fibras permanecem elásticas, a integração recupera a matriz básica Euler–Bernoulli clássica:

`k_b = [[EA/L,0,0],[0,4EI/L,2EI/L],[0,2EI/L,4EI/L]]`.

## Integração Gauss–Lobatto

A v0.20 oferece 3 ou 5 pontos Gauss–Lobatto mapeados para `[0,1]`. A inclusão das extremidades é intencional, pois permite capturar diretamente plastificação associada aos maiores momentos em membros usuais.

Configurações por elemento:

- `enabled`;
- `integrationPoints`: 3 ou 5;
- `nFibers`: 8 a 400 fibras por seção;
- `hardeningRatio`: razão `Et/E` pós-escoamento.

## Seções e materiais suportados

Nesta versão:

- material: `steel`;
- seção retangular;
- seção I/H;
- RHS retangular.

A discretização transversal reutiliza o kernel de seções de fibras validado nas versões de rótulas concentradas.

## Compatibilidade de extremidades

Para evitar uma condensação não linear inconsistente, um elemento com plasticidade distribuída v0.20 requer extremidades rígidas. No mesmo elemento são bloqueados:

- releases rotacionais;
- molas rotacionais semirrígidas;
- rótulas concentradas de fibras.

A interface garante exclusividade entre plasticidade distribuída e rótulas concentradas.

## Acoplamento geométrico

A força e a rigidez básicas inelásticas substituem `EA/L` e `EI/L` constantes dentro do mesmo mapeamento co-rotacional. A tangente global conserva:

- parcela constitutiva `B^T k_b B`;
- parcela geométrica associada ao esforço normal;
- termos de transformação associados aos momentos básicos.

Assim, a plasticidade distribuída participa diretamente de carga controlada, controle de deslocamento e Arc-Length por meio do resíduo global comum.

## Resultados

Por elemento são registrados:

- posição `ξ` e `x` de cada seção integrada;
- `ε0` e `κ`;
- `N` e `M`;
- número e fração de fibras escoadas;
- tensões/deformações extremas da seção;
- número de pontos plastificados;
- fração máxima de fibras escoadas;
- estimativa integrada do comprimento plastificado.

A estimativa de comprimento plástico é a soma dos pesos Lobatto correspondentes aos pontos em que pelo menos uma fibra atingiu o ramo pós-escoamento. Ela é um indicador numérico da extensão inelástica do elemento, não um comprimento de rótula prescrito por norma.

## Validação automática

### Limite elástico

Um estado básico arbitrário é integrado com `fy` suficientemente alto para manter todas as fibras elásticas. As forças obtidas são comparadas diretamente com `k_b d` da teoria Euler–Bernoulli clássica.

### Propagação espacial

Um gradiente de curvatura é imposto de modo que a extremidade de maior momento plastifique enquanto a extremidade oposta permaneça elástica. O benchmark verifica redução da rigidez tangente e plastificação apenas em parte dos pontos de integração.

### Cantilever global com pushover

Um cantilever S355 com plasticidade distribuída é resolvido por controle de deslocamento até `uy=-40 mm`. O teste verifica:

- convergência no deslocamento alvo;
- fator de carga finito;
- pontos de integração plastificados;
- exposição correta dos resultados distribuídos.

### Proteção de escopo

Uma tentativa de combinar plasticidade distribuída com release rotacional é recusada explicitamente.

## Limitações

A v0.20 ainda não é um elemento force-based/flexibility-based. A curvatura é interpolada pela cinemática displacement-based do elemento de dois nós, portanto gradientes inelásticos muito localizados podem exigir discretização longitudinal da barra em mais elementos.

Também ainda não estão implementados:

- descarga/recarga;
- Bauschinger;
- encruamento cinemático/isotrópico com variáveis internas;
- pinching e degradação;
- história cíclica por fibra;
- plasticidade distribuída para concreto armado;
- combinação no mesmo elemento com releases ou ligações semirrígidas.

A etapa seguinte, v0.21, introduz história constitutiva e resposta cíclica/histerética para o aço.