# AstraStruct v0.14 — não linearidade material concentrada por fibras

## Estado

Versão experimental do kernel constitutivo e do acoplamento global. Não constitui verificação normativa automática e não deve ser utilizada como única base para decisão profissional sem validação independente do modelo, propriedades, discretização e trajetória de carregamento.

## Objetivo

A v0.14 introduz a primeira camada de não linearidade material do AstraStruct preservando a formulação geométrica co-rotacional validada na série v0.13.x. O primeiro modelo implementado é uma rótula concentrada de aço baseada em integração de fibras de uma seção retangular.

O escopo desta versão é deliberadamente restrito:

- pórticos planos `frame2d`;
- geometria co-rotacional Euler–Bernoulli;
- material de aço bilinear monotônico;
- seção retangular discretizada em fibras;
- rótulas concentradas nas extremidades dos elementos;
- interação axial–flexão local por equilíbrio de `N`;
- encruamento isotrópico simplificado pela tangente pós-escoamento definida como razão de `E`;
- carregamento monotônico.

Não estão incluídos nesta versão: descarregamento/recarregamento cíclico, Bauschinger, plasticidade distribuída, concreto, fissuração, dano, bond-slip, flambagem local, contato ou degradação por ciclos.

## 1. Lei constitutiva uniaxial

Para a fibra de aço, com deformação `ε`, módulo `E`, tensão de escoamento `fy` e razão de encruamento `b`, a deformação de escoamento é

`εy = fy / E`.

O envelope bilinear empregado é simétrico em tração e compressão. Para `|ε| <= εy`,

`σ = E ε`.

Após o escoamento,

`σ = sign(ε) [fy + b E (|ε| - εy)]`.

A tangente é `E` no ramo elástico e `bE` no ramo pós-escoamento.

No modelo de projeto do AstraStruct, `E` é armazenado em `kN/m²` e `fy` em `MPa`; a conversão de unidade é realizada no adaptador constitutivo.

## 2. Seção de fibras 2D

A seção retangular de largura `b` e altura `h` é dividida em `nf` fibras horizontais. Para cada fibra `i`, de área `Ai` e coordenada `yi` relativa ao centro geométrico,

`εi = ε0 - κ yi`.

A tensão `σi` é obtida pela lei constitutiva uniaxial. Os resultantes de seção são

`N = Σ σi Ai`

`M = -Σ σi Ai yi`.

A matriz tangente da seção é montada diretamente pelas tangentes das fibras:

`K11 = Σ Eti Ai`

`K12 = -Σ Eti Ai yi`

`K22 = Σ Eti Ai yi²`.

Portanto,

`[dN dM]^T = [[K11,K12],[K12,K22]] [dε0 dκ]^T`.

## 3. Rótula concentrada

A rótula possui comprimento plástico de referência `Lp`. Para uma rotação relativa `θh`,

`κ = θh / Lp`.

Em flexão pura, `ε0 = 0`. Para interação `N-M`, `ε0` é uma variável local resolvida por Newton–Raphson para satisfazer

`N(ε0, κ) = Ntarget`.

O `Ntarget` é o esforço normal recuperado do elemento co-rotacional, com a convenção AstraStruct `N > 0` em tração.

## 4. Tangente flexional a esforço normal constante

Após o equilíbrio axial, a tangente flexional de seção compatível com `dN = 0` é o complemento de Schur

`D_Mκ|N = K22 - K12²/K11`.

A tangente momento–rotação da rótula é

`kθ,t = D_Mκ|N / Lp`.

Esse valor é armazenado para diagnóstico constitutivo e comparação numérica.

## 5. Acoplamento global da v0.14

Para não alterar o kernel geométrico validado da v0.13.6, a primeira integração global utiliza uma iteração externa de rigidez secante.

Cada rótula de fibras é representada no problema co-rotacional por uma mola rotacional temporária. Em cada iteração externa:

1. o problema co-rotacional completo é resolvido;
2. são recuperados `θn`, `θe`, a rotação relativa `θh = θn - θe`, o momento de extremidade e `N`;
3. a seção de fibras resolve o equilíbrio local `N-M`;
4. é calculado o momento constitutivo `Mh(θh,N)`;
5. a rigidez secante é atualizada por `kθ,s = Mh / θh` quando `|θh|` é significativo; no limite `θh -> 0`, utiliza-se a tangente local;
6. o equilíbrio global é repetido até que o momento do elemento e o momento constitutivo coincidam dentro da tolerância especificada.

A atualização utiliza relaxação configurável para reduzir oscilações do ponto fixo.

### Critério principal

O resíduo monitorado por rótula é

`rM = Melement - Mconstitutivo`.

O critério relativo é

`|rM| / max(1, |Melement|, |Mconstitutivo|) <= tolM`.

Também é monitorada a variação da rotação relativa entre iterações externas.

## 6. Configuração no modelo

A configuração é armazenada no próprio elemento:

```json
{
  "fiberHinges": {
    "rz1": {
      "enabled": true,
      "hingeLength": 0.35,
      "nFibers": 80,
      "hardeningRatio": 0.01
    },
    "rz2": {
      "enabled": false
    }
  }
}
```

Nesta versão uma rótula de fibras não pode ocupar o mesmo extremo simultaneamente com `release` ideal ou mola rotacional linear.

## 7. Metadados de saída

Quando pelo menos uma rótula de fibras está ativa, o dispatcher retorna `solverVersion = 0.14.0-exp` e inclui `materialNonlinearity` com:

- modelo constitutivo;
- número de rótulas;
- número de iterações externas;
- maior resíduo de momento;
- rotação de cada rótula;
- `Ntarget`;
- `ε0` equilibrado;
- momento do elemento;
- momento constitutivo;
- rigidez secante;
- tangente constitutiva;
- número de fibras escoadas;
- número total de fibras;
- resíduo axial.

## 8. Benchmarks obrigatórios

A suíte automatizada da v0.14 inclui:

1. aço bilinear: ramo elástico, ponto de escoamento, ramo pós-escoamento e simetria tração/compressão;
2. seção retangular elástica: `N = 0`, `M = EIκ`, `EA` e `EI` discretos;
3. início e propagação do escoamento das fibras extremas;
4. tangente `dM/dκ` analítica comparada com diferença central;
5. rótula de flexão pura: `M(θ)` e `dM/dθ`;
6. rótula `N-M`: equilíbrio axial e tangente a `N` constante comparada numericamente;
7. benchmark global de cantilever com rótula de fibras e momento aplicado;
8. benchmark global combinado `N-M`.

## 9. Limitações técnicas

A estratégia secante global é adequada como primeira implementação monotônica e modular, mas não substitui uma formulação constitutiva incremental com variáveis internas e tangente material consistente. Em particular:

- não existe memória de plasticidade cíclica;
- o retorno ao domínio elástico após inversão de carga não é modelado;
- a rótula representa plasticidade concentrada e depende de `Lp`;
- a resposta pode depender do número de fibras;
- `hardeningRatio` deve permanecer positivo nesta versão para evitar tangentes degeneradas;
- a seção implementada no acoplamento v0.14 é retangular de aço;
- a interação axial é local à rótula; o restante do elemento continua elástico linear em material;
- combinações de rótula de fibras com `release` ou mola semirrígida no mesmo extremo são recusadas.

## 10. Próximos passos após v0.14

A sequência recomendada é:

1. substituir a iteração secante externa por tangente material consistente condensada no Newton global;
2. introduzir variáveis internas incrementais para aço elastoplástico;
3. suportar seções I/H e discretização arbitrária de fibras;
4. adicionar concreto uniaxial e seções RC de fibras;
5. implementar rótula distribuída/plasticidade distribuída;
6. incorporar pushover e controle de deslocamento;
7. somente depois avaliar descarga cíclica, dano, bond-slip e contato.
