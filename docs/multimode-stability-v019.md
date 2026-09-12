# AstraStruct v0.19 — estabilidade multimodal e exploração de ramos

## Objetivo

A v0.19 amplia o diagnóstico de estabilidade tangente da v0.18 para estruturas em que mais de um modo crítico pode coexistir, aproximar-se ou trocar de ordem numérica durante a continuação Arc-Length/Riks.

A implementação não transforma a análise em um solucionador exaustivo de bifurcações. O objetivo é fornecer diagnóstico multimodal rastreável, reduzir trocas artificiais de identidade modal e permitir sondagens locais independentes dos sentidos `+φ` e `−φ` associados a uma bifurcação candidata.

## Espectro tangente multimodal

Para cada estado convergido do Arc-Length, a matriz tangente reduzida aos graus de liberdade livres é escalada para uma métrica generalizada. Rotações são convertidas pela escala característica `Lc` já usada na esfera de Crisfield. Para manter compatibilidade com o diagnóstico conservativo da v0.18, o autoproblema é resolvido sobre a parte simétrica da tangente escalada.

A v0.19 retém os primeiros `nModes` autovalores ordenados por `|μ|`, com `nModes` configurável entre 1 e 12. O valor padrão é 4.

Para tangentes materialmente não simétricas, como pode ocorrer com forças follower, o espectro da parte simétrica continua sendo apenas um indicador de singularidade. Não é feita afirmação de bifurcação conservativa.

## Rastreamento modal por MAC

Entre dois estados convergidos consecutivos, os autovetores são associados pelo Modal Assurance Criterion:

`MAC(φa,φb) = |φaᵀ φb|² / [(φaᵀφa)(φbᵀφb)]`.

O modo atual é associado ao modo anterior de maior MAC ainda disponível quando o valor supera o limiar configurado `stabilityMacThreshold`.

O sinal do autovetor é orientado de forma consistente pela projeção sobre o modo anterior. Isso evita que uma simples mudança arbitrária de sinal do autossolver seja interpretada como mudança física de ramo.

## Modos quase degenerados

Autovalores próximos segundo a tolerância relativa `stabilityClusterTolerance` são agrupados em um mesmo cluster. Para esses grupos, a identidade física é melhor representada pelo subespaço do que por um único autovetor.

A continuidade entre dois clusters consecutivos é estimada pelas projeções quadráticas entre suas bases modais. Essa medida é registrada como `subspaceContinuity`.

Essa abordagem é importante em sistemas simétricos ou com modos repetidos, nos quais pequenas perturbações numéricas podem rotacionar livremente a base dentro de um mesmo subespaço crítico.

## Detecção de eventos

Cada modo rastreado é verificado individualmente para cruzamento de zero do autovalor crítico entre estados convergidos.

A classificação segue a lógica da v0.18:

- `limit-point`: cruzamento espectral acompanhado por reversão do incremento de fator de carga;
- `bifurcation-candidate`: cruzamento sem reversão de `Δλ`, desde que a tangente seja suficientemente simétrica;
- `nonconservative-singularity-candidate`: cruzamento detectado com assimetria tangente acima da tolerância.

Cada evento registra `modeId`, `clusterId`, tamanho do cluster, MAC, continuidade do subespaço, modo dominante, fator de carga crítico interpolado e deslocamento monitorado interpolado.

## Exploração bilateral `+φ / −φ`

A exploração bilateral é opcional e desativada por padrão.

Após uma `bifurcation-candidate`, o solver pode executar dois problemas locais independentes a partir do estado convergido próximo ao cruzamento. Para cada sinal é imposta temporariamente uma restrição de amplitude modal:

`φᵀ W Δu = s β Δs`,

onde:

- `s = +1` ou `−1`;
- `β` é a razão de amplitude configurada;
- `Δs` é o raio Arc-Length vigente;
- `W` é a métrica generalizada usada no Arc-Length.

O equilíbrio global e o fator de carga são resolvidos simultaneamente por um sistema bordado. Esses dois estados são chamados de **probes de ramo**.

Os probes:

- não modificam o estado do caminho Arc-Length principal;
- não substituem a troca de ramo da v0.18;
- indicam se existem estados de equilíbrio locais alcançáveis em ambos os sentidos do modo crítico;
- registram convergência, `λ`, deslocamento monitorado, resíduo e projeção modal.

A opção de troca de ramo continua separada. Quando habilitada, ela semeia o caminho principal em apenas um sinal escolhido e depois retorna à esfera de Crisfield.

## Validação

### Subespaço degenerado sintético

Um problema espectral com dois autovalores idênticos e uma base modal anterior rotacionada verifica que:

- os dois modos são preservados;
- ambos são agrupados no mesmo cluster;
- a continuidade do subespaço permanece praticamente unitária apesar da rotação da base.

### Duas colunas de Euler idênticas

Duas colunas biarticuladas independentes, geometricamente e mecanicamente idênticas, geram modos críticos coincidentes. O benchmark verifica:

- rastreamento de múltiplos modos;
- agrupamento de modos degenerados;
- mais de uma travessia modal de zero;
- classificação dos eventos como bifurcações candidatas para a tangente conservativa.

### Exploração bilateral de uma coluna de Euler

No benchmark de uma coluna biarticulada, a exploração local resolve os dois sinais do modo lateral crítico. Os probes `+φ` e `−φ` convergem para estados em lados opostos do ramo fundamental, sem modificar o caminho Arc-Length principal.

## Interface

No painel de análise Arc-Length são configuráveis:

- número de modos rastreados;
- tolerância de agrupamento modal;
- MAC mínimo;
- exploração bilateral `±φ`;
- amplitude dos probes;
- troca de ramo opcional já existente.

O pós-processamento distingue o caminho principal, pontos-limite, bifurcações candidatas, semeadura do caminho principal e probes bilaterais. O relatório técnico registra eventos, modo/cluster, MAC e os resultados de cada probe.

## Limitações

A v0.19 ainda não implementa:

- autovalores complexos de tangentes não simétricas;
- acompanhamento rigoroso de subespaços por decomposição de Schur/SVD para grandes multiplicidades;
- continuação automática e exaustiva de todos os ramos encontrados;
- árvore global de bifurcações persistente entre múltiplas análises;
- instabilidade dinâmica;
- contato;
- plasticidade distribuída.

A próxima etapa planejada é a v0.20, dedicada à plasticidade distribuída em elementos de pórtico.