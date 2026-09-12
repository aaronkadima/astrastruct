# AstraStruct v0.29 — imperfeição modal no P-Delta 3D

## Objetivo

A v0.29 estende o solver P-Delta espacial da v0.28 para considerar imperfeição geométrica inicial baseada em um modo de flambagem linear 3D. O recurso permanece restrito a modelos puros `frame3d` e mantém comportamento material linear-elástico.

## Fluxo de cálculo

1. O cenário de referência é resolvido para flambagem linear 3D.
2. O modo solicitado `φ` é normalizado pelo maior componente translacional.
3. A amplitude definida pelo usuário, em mm, gera o vetor inicial `u0 = e0 φ`.
4. Em cada iteração P-Delta, o esforço normal atualizado produz a matriz geométrica consistente `Kg(N)` nos dois planos de flexão.
5. A imperfeição entra como força geométrica equivalente:

`Fimp = -Kg(N) u0`

6. O solver calcula o incremento `Δu` em torno da configuração imperfeita e reporta separadamente:

`u0` — imperfeição inicial;

`Δu` — deslocamento incremental devido às ações;

`utotal = u0 + Δu` — deslocamento total.

A equação iterativa é, conceitualmente,

`[Ke + Kg(N)] Δu = F + Fimp`.

Com a convenção do AstraStruct, `N > 0` é tração e `N < 0` é compressão. Portanto, a compressão reduz a rigidez tangente automaticamente pelo sinal de `Kg`.

## Relação de amplificação modal

Para um sistema ideal cuja imperfeição coincide exatamente com um autovetor de flambagem e cujo carregamento axial corresponde a uma fração do carregamento crítico, a resposta total esperada segue aproximadamente

`utotal = u0 / (1 - P/Pcr)`.

Como `λcr = Pcr/P`, também pode ser escrita como

`utotal = u0 λcr/(λcr - 1)`.

Esse relacionamento é usado como benchmark da implementação v0.29, dentro de tolerância numérica compatível com a discretização por elemento finito e a atualização iterativa dos esforços normais.

## Validações implementadas

O solver rejeita:

- vetor de imperfeição com tamanho diferente de `6 × número de nós`;
- componentes não finitas;
- imperfeição não nula em graus de liberdade prescritos;
- vetor sem componente translacional significativa;
- modelos contendo elementos diferentes de `frame3d` no modo P-Delta 3D.

O resultado inclui `initialDisplacements`, `displacements`, `totalDisplacements` e metadados em `pDelta.imperfection`, incluindo modo, amplitude, cenário de referência e fator crítico.

## Escopo e limitações

A v0.29 não é uma análise geometricamente não linear completa. Ela é uma análise de segunda ordem elástica baseada em matriz geométrica consistente e atualização iterativa de esforço normal. Permanecem fora deste escopo:

- co-rotacional 3D com grandes rotações;
- plasticidade material 3D;
- rótulas plásticas espaciais;
- plasticidade distribuída 3D;
- forças seguidoras espaciais;
- imperfeições arbitrárias dependentes de múltiplos modos;
- atualização da geometria local dos elementos durante as iterações.

Esses itens constituem a sequência natural após a consolidação da v0.29.
