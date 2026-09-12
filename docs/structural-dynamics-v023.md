# AstraStruct v0.23 — dinâmica estrutural linear

## Escopo

A v0.23 introduz a primeira fundação dinâmica do AstraStruct sem reutilizar indevidamente a análise cíclica quase-estática. O núcleo aceita modelos 2D formados por `frame2d` e `truss2d`, com comportamento linear-elástico e extremidades rígidas nos elementos de pórtico.

## Massa

`material.density` mantém a convenção existente do projeto: peso específico `gamma` em kN/m³. A densidade de massa usada na equação dinâmica é `rho_m = gamma/g`, com `g = 9.80665 m/s²`. Massas nodais adicionais usam kN·s²/m, numericamente equivalentes a toneladas para translação, e kN·s²·m para inércia rotacional.

A formulação consistente usa a matriz clássica Euler–Bernoulli para `frame2d` e a matriz consistente translacional para `truss2d`. A opção lumped concentra metade da massa do elemento em cada nó translacional; DOFs rotacionais podem permanecer sem massa, pois o problema modal é resolvido pela transformação baseada em Cholesky de K, sem exigir M positiva definida.

## Análise modal

O problema `K phi = omega² M phi` é transformado em um problema simétrico para `mu = 1/omega²`. Os modos são normalizados por massa, e são calculados frequência, período, fatores de participação e massas modais efetivas nas direções globais X e Y, incluindo somatórios acumulados.

## Amortecimento de Rayleigh

`C = alpha_M M + beta_K K`. Para um amortecimento alvo `zeta`, os coeficientes são calibrados em dois modos escolhidos. Se ambos coincidirem, a implementação usa apenas a parcela proporcional à massa.

## História temporal

A v0.23 usa Newmark average-acceleration (`beta=1/4`, `gamma=1/2`) para `M u_ddot + C u_dot + K u = p(t)`. O vetor do cenário selecionado é tratado como padrão espacial e multiplicado por uma história escalar linearmente interpolada. A integração parte do repouso e a escala deve ser zero em `t=0`.

A implementação foi validada contra: (1) autovalor fechado do modelo discreto axial de uma barra, com massa consistente e concentrada; (2) solução discreta exata do Newmark para vibração livre SDOF; (3) conservação de energia sem amortecimento; e (4) calibração exata do amortecimento de Rayleigh nos modos-alvo.

## Limitações

Ainda não há aceleração de base, espectro de resposta, combinação modal SRSS/CQC, dinâmica não linear, amortecimento histerético, releases/semirrigidez dinâmica, contato, integração constitutiva cíclica no tempo ou análise sísmica normativa. A história cíclica v0.21/v0.22 permanece uma análise quase-estática separada.
