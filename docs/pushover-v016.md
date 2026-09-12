# AstraStruct v0.16 — pushover por controle de deslocamento

## Escopo

A v0.16 introduz um caminho de equilíbrio não linear por **controle de deslocamento** para modelos `frame2d` resolvidos pelo núcleo co-rotacional. O fator do padrão de carga, `λ`, deixa de ser prescrito e passa a ser uma incógnita escalar adicional. A cada incremento é imposto um valor-alvo para um grau de liberdade livre `u_c` e o solver determina simultaneamente os deslocamentos globais e `λ`.

A implementação é compatível com as rótulas concentradas de fibras da série v0.15/v0.16, desde que o acoplamento material seja o modo embutido. O modo externo legado permanece disponível apenas no controle de carga.

## Sistema aumentado

Com o resíduo global adotado pelo AstraStruct,

`R(u,λ) = P_ext(u,λ) - F_int(u,λ)`,

o Newton de controle de carga usa, a `λ` fixo,

`K Δu = R`.

No controle de deslocamento, a correção passa a satisfazer simultaneamente

`K Δu - (∂R/∂λ) Δλ = R`

e

`cᵀ Δu = u_alvo - u_c`,

onde `c` seleciona o grau de liberdade controlado. O sistema bordado resolvido em cada iteração é

```
[ K   -∂R/∂λ ] [Δu]   [R]
[ cᵀ      0   ] [Δλ] = [g]
```

com `g = u_alvo - u_c`.

## Derivada em relação ao fator de carga

Nesta versão, `∂R/∂λ` é calculada por diferença central sobre o **resíduo completo**. Isso mantém no mesmo caminho numérico:

- cargas nodais;
- cargas distribuídas e pontuais de referência;
- peso próprio;
- deformações/curvaturas térmicas iniciais;
- forças follower e sua dependência da configuração;
- rótulas de fibras com equilíbrio local N–M e Newton constitutivo embutido.

A estratégia evita introduzir uma derivada parcial simplificada que poderia omitir termos de ações dependentes da configuração. O custo é a existência de um piso de ruído de ponto flutuante. Por isso o critério de equilíbrio do pushover combina a tolerância relativa solicitada com um piso absoluto padrão de `1e-9 kN`, aproximadamente `1e-6 N` no sistema padrão do projeto.

## Caminho e curva de capacidade

Para `n` incrementos, o alvo é aplicado linearmente:

`u_alvo,i = (i/n) u_alvo,final`.

Em cada ponto convergido são registrados:

- deslocamento controlado;
- fator de carga `λ`;
- reação de base na direção do DOF controlado;
- iterações de Newton;
- resíduo de equilíbrio e resíduo da restrição cinemática;
- número de rótulas de fibras com fibras escoadas;
- novas rótulas que iniciaram plastificação naquele passo;
- máximo número de iterações constitutivas locais.

O pós-processamento apresenta a curva `λ–u`, marca a primeira plastificação e identifica o maior `|λ|` obtido no caminho calculado.

## Recuperação de resultados no estado final

Como o estado final do pushover pode ocorrer em `λ != 1`, a recuperação de cargas de referência e os diagramas finais usam o `λ` convergido. O resultado registra explicitamente `finalLoadFactor`, evitando interpretar os esforços finais como se o padrão estivesse aplicado com fator unitário.

## Validação da v0.16

A regressão inclui:

1. cantilever elástico com solução analítica de pequena deformação, verificando o deslocamento imposto, `λ`, reação e número de pontos da curva;
2. cantilever de aço com rótula concentrada de fibras, verificando passagem pelo início de escoamento, rastreamento da primeira plastificação e acoplamento material embutido;
3. rejeição explícita de um grau de liberdade controlado que esteja restringido;
4. preservação integral dos benchmarks anteriores de análise linear, P-Delta, co-rotacional, follower, imperfeição geométrica e rótulas de fibras.

## Limitações atuais

A v0.16 ainda não implementa:

- arc-length / Riks;
- continuação automática por comprimento de arco em pontos-limite;
- controle adaptativo do tamanho do incremento;
- leis cíclicas/histeréticas;
- plasticidade distribuída;
- seções de concreto armado não lineares;
- flambagem local, empenamento e torção 3D.

O controle de deslocamento pode atravessar trechos em que o controle de carga seria inadequado, mas **não substitui arc-length em todos os casos de snap-through ou snap-back**. O próximo passo natural é usar a infraestrutura do sistema aumentado para um método de comprimento de arco com seleção automática de sinal e incremento adaptativo.
