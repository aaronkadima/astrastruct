# AstraStruct v0.15 — Newton constitutivo embutido no equilíbrio co-rotacional

## Estado

Versão experimental. A v0.15 elimina, no modo padrão, a iteração **material global externa** usada nas versões v0.14.x. A compatibilização da rótula de fibras passa a ser executada dentro de cada avaliação do resíduo e da tangente do Newton–Raphson geométrico global.

O modo v0.14 é preservado como `materialCoupling = "outer"` exclusivamente para regressão e comparação.

## Formulação

Para cada rótula concentrada, a variável cinemática continua sendo a rotação relativa de extremidade

`Δθ = θn - θe`

com curvatura equivalente

`κ = Δθ / Lp`.

A seção de fibras resolve o equilíbrio axial local

`N(ε0,κ) = Ntarget`

por Newton em `ε0`. A resultante de momento é

`M = -Σ σi Ai yi`.

A rigidez flexional a esforço normal constante é obtida pela condensação seccional

`D_Mκ|N = K22 - K12²/K11`

e a tangente momento–rotação é

`kt = D_Mκ|N / Lp`.

Em torno do estado corrente, a lei da rótula é linearizada como

`M(Δθ) ≈ kt Δθ + M0`

com

`M0 = M - kt Δθ`.

O par `(kt, M0)` é atualizado pelo Newton constitutivo local e usado na mesma condensação de Schur das rotações internas de extremidade já validada no núcleo co-rotacional.

## Acoplamento v0.15

Para cada estado de tentativa `u` do Newton global:

1. o elemento co-rotacional calcula sua geometria corrente;
2. para cada extremidade com rótula de fibras, inicia-se a compatibilização local;
3. a ligação condensada fornece `Δθ` e o esforço axial do elemento;
4. a seção de fibras resolve `ε0` para fechar `N`;
5. são obtidos `M`, `kt` e `M0`;
6. a ligação é reavaliada com a nova linearização tangente-afim;
7. o ciclo local continua até compatibilizar momento e linearização;
8. a força interna e a tangente condensada resultantes entram imediatamente no resíduo global;
9. o Newton global atualiza os deslocamentos nodais e repete o processo.

Consequentemente, não é necessário resolver toda a estrutura várias vezes em um laço material externo. O metadado de resultado apresenta `outerIterations = 0` no modo padrão e registra `maxLocalIterations`.

## O que a v0.15 melhora

Em relação à v0.14.2:

- elimina a iteração constitutiva externa no modo padrão;
- atualiza a rótula em cada tentativa do Newton global e também durante o line search;
- mantém a tangente constitutiva pós-escoamento dentro da condensação da ligação;
- atualiza a interação N–M a cada estado global de tentativa;
- permite comparação direta com o caminho legado `outer` para regressão;
- mantém suporte às seções de aço `rect`, `i`/I-H e `rhs`.

## Limite metodológico importante

A v0.15 **não deve ser descrita como um sistema monolítico aumentado completo**. O esforço axial utilizado pela seção é atualizado em cada estado global, porém a derivada cruzada completa da lei constitutiva da rótula em relação aos graus de liberdade axiais não é introduzida como um bloco adicional de variáveis seccionais globais.

Assim, a denominação tecnicamente adequada desta versão é **Newton constitutivo local embutido / return-mapping embutido no equilíbrio global co-rotacional**.

Uma futura formulação monolítica poderá tratar explicitamente variáveis internas da seção e os blocos acoplados `∂N/∂u`, `∂M/∂u`, eliminando essa aproximação.

## Validação

A v0.15 mantém toda a suíte anterior e acrescenta regressão entre:

- modo padrão `embedded-local-newton`;
- modo legado `outer-compatibility`.

Para o mesmo problema não linear são comparados momento constitutivo, rotação relativa da rótula e rotação nodal. Permanecem também os benchmarks de equilíbrio global, interação N–M, plastificação de perfil I/H, conservação de área, convergência de `I`, consistência da tangente seccional e resposta co-rotacional.

## Limitações atuais

Ainda não são contemplados:

- história cíclica, descarga e recarregamento;
- efeito Bauschinger;
- tensões residuais de fabricação;
- flambagem local de mesa/alma ou paredes de RHS;
- plasticidade distribuída ao longo do elemento;
- flexão biaxial, torção e empenamento;
- concreto armado e fissuração;
- dano, bond-slip e degradação;
- controle de deslocamento ou arc-length.

## Próxima etapa recomendada

Com a integração material-geometria mais fechada, a sequência natural é implementar **controle de deslocamento e pushover**, incluindo histórico `λ–u`, detecção de formação/evolução de rótulas e capacidade de atravessar trechos de rigidez muito reduzida. Depois disso, a evolução pode seguir para arc-length e plasticidade distribuída.
