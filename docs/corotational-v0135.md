# AstraStruct — Nota técnica co-rotacional v0.13.5

## 1. Escopo desta revisão

A v0.13.5 mantém a formulação co-rotacional 2D Euler–Bernoulli da série v0.13 e acrescenta **rótulas ideais e ligações rotacionais semirrígidas** no kernel geometricamente não linear. O recurso permanece experimental e não normativo.

O elemento continua usando grandes rotações globais e pequenas deformações locais, com solução incremental por Newton–Raphson. As extensões anteriores — dead loads de referência, temperatura como estado inicial e `followerEnd` com tangente externa consistente — permanecem ativas.

## 2. Graus de liberdade de ligação

Para cada extremidade flexível são distinguidas:

- `θn`: rotação nodal global do nó estrutural;
- `θe`: rotação interna da extremidade do elemento;
- `Δθ = θn − θe`: rotação relativa da ligação.

A energia armazenada na mola rotacional é

`Uθ = 1/2 kθ (θn − θe)^2`.

O momento transmitido é

`M = kθ (θn − θe)`.

A classificação é:

- extremidade rígida: `kθ = ∞` — não é criado DOF interno;
- semirrígida: `0 < kθ < ∞`;
- rótula: `kθ = 0`.

O schema mantém releases e molas sincronizados: um release rotacional força `kθ=0`.

## 3. Equilíbrio interno

Se `q` contém os DOFs nodais externos e `r` as rotações internas de extremidade, a energia incremental ampliada produz o Hessiano particionado

`H = [[Hqq, Hqr], [Hrq, Hrr]]`.

As rotações internas satisfazem o equilíbrio local antes da montagem global. Para dead loads com momentos nodais equivalentes, os termos de carga participam do vetor de equilíbrio das rotações internas.

A temperatura entra pela deformação básica inicial `db,T`, portanto modifica o estado constitutivo e os momentos usados no equilíbrio da ligação.

## 4. Condensação estática de Schur

Depois de resolver as rotações internas, a tangente externa usada no sistema global é

`Kcond = Hqq − Hqr Hrr^-1 Hrq`.

Essa condensação é executada no estado corrente do elemento. Para problemas conservativos de mola rotacional, a tangente condensada preserva a simetria dentro do erro numérico.

Quando existe `followerEnd`, a tangente global de Newton continua sendo

`Ktan = Kint,cond − λ Kext`.

A parcela `Kext` pode ser não simétrica porque a carga seguidora é não conservativa; isso não deve ser confundido com erro da condensação da ligação.

## 5. Recuperação de resultados

O resultado de cada elemento inclui `connectionRotations`, com:

- `end`;
- `type` (`release` ou `semirigid`);
- `k`;
- `nodeRotation = θn`;
- `elementRotation = θe`;
- `relativeRotation = Δθ`;
- `moment`;
- `springMoment`;
- `residual`.

Também é registrado `connectionCondensation.internalResidual`, usado como diagnóstico do equilíbrio das rotações internas eliminadas.

O pós-processador e o relatório React exibem essas grandezas sem transformar a ligação em uma rigidez equivalente não documentada.

## 6. Benchmarks automatizados

### 6.1 Tangente condensada

Duas ligações semirrígidas em um elemento deformado, com dead loads e estado inicial, são comparadas contra diferença central da força condensada.

Resultado atual:

- erro relativo máximo: `2.2044576443e-9`;
- resíduo interno: aproximadamente `9.09e-13`;
- perda relativa de simetria abaixo do limite de teste.

### 6.2 Console semirrígido

Balanço `L=4 m`, `P=10 kN`, `E=30 GPa`, `I=0.003125 m4`, `kθ=10000 kN·m/rad` na base.

Resultados atuais:

- deslocamento vertical de ponta: `18.275301604 mm`;
- momento transmitido na base: `39.999582926 kN·m`;
- rotação relativa da mola: `0.003999958293 rad`;
- resíduo interno da condensação abaixo de `1e-7`.

O benchmark usa tolerância relativa `1e-9`, ainda dez vezes mais rigorosa que a tolerância padrão da interface, para evitar exigir resíduos abaixo do piso numérico observado nesse problema.

### 6.3 Viga com duas rótulas + UDL

Viga biapoiada `L=6 m`, `q=20 kN/m`, releases nas duas extremidades.

Resultados:

- `RA = RB = 60 kN`;
- `M1 = M2 = 0`;
- `Mmax = 90 kN·m`;
- duas rotações internas de tipo `release` registradas;
- momento residual de rótula abaixo da tolerância do teste.

## 7. Interface e rastreabilidade

O painel **Tipo de análise** conta extremidades flexíveis e distingue rótulas de semirrígidas. O painel **Ligações** continua sendo o local de edição de `kθ` e releases.

Após a solução, Diagramas/Resultados mostra `θn`, `θe`, `Δθ`, `kθ`, momento transmitido e resíduo interno. O relatório técnico possui seção própria para ligações de extremidade.

O kernel, o dispatcher e o schema usam `solverVersion = 0.13.5-exp`.

## 8. Escopo ainda recusado

A v0.13.5 continua recusando explicitamente:

- molas nodais no solver co-rotacional;
- recalques/deslocamentos prescritos não nulos;
- imperfeição modal inicial no kernel co-rotacional;
- `truss2d` e modelos mistos;
- follower na extremidade 1;
- follower distribuída, follower moment e follower em ponto interior;
- envelopes não lineares.

Também ainda não há offsets rígidos, arc-length, material não linear, plasticidade, fissuração/dano ou contato.

## 9. Próxima extensão recomendada

A próxima extensão prioritária é a **imperfeição geométrica inicial diretamente na configuração co-rotacional**, preservando coordenadas nominais do projeto e permitindo comparar geometria perfeita, imperfeita, P‑Delta e grandes rotações no mesmo fluxo. Antes de promoção para a UI, ela deve reproduzir o benchmark de coluna imperfeita e ser validada em conjunto com releases/semirrígidas.