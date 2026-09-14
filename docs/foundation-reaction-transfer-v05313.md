# AstraStruct v0.53.13 — transferência revisada de reação para demanda de fundação

## Objetivo

A v0.53.13 evolui o vínculo somente leitura da v0.53.12 para uma transferência explícita, auditável e bloqueável entre a reação estrutural de um apoio e os campos de demanda da fundação vinculada por `nodeId`.

A transferência **não** usa máximos de envelope de componentes diferentes como se fossem um único estado físico. O vetor `Fx, Fy, Fz, Mx, My, Mz` é recuperado de uma única combinação resolvida: a mesma combinação governante da grandeza selecionada no mapa de reações.

## Fluxo de engenharia

1. O mapa de reações identifica a combinação governante da grandeza exibida.
2. `supportReactionAtCombination()` recupera as seis componentes do mesmo apoio e da mesma combinação.
3. Graus de liberdade não restringidos são zerados; componentes restringidas ausentes permanecem inválidas e bloqueiam a transferência.
4. O vínculo com a fundação continua exclusivamente por `nodeId` explícito; não há casamento por proximidade geométrica.
5. O usuário confirma o mapeamento global `X/Y/Z → Hx/Hy/N` e `Mx/My`.
6. O usuário escolhe explicitamente a convenção de sinal: manter o sinal da reação do solver ou aplicar o sinal oposto para representar a ação transmitida à fundação.
7. Se `Mz` for diferente de zero, a operação é bloqueada, porque o modelo atual da fundação não possui campo de demanda torsional `Mz`.
8. Somente o estado `READY` habilita `Aplicar demanda revisada`.
9. A aplicação persiste `N`, `Hx`, `Hy`, `Mx` e `My`, preserva os demais campos de demanda e grava a rastreabilidade em `metadata.reactionDemandTransfer`.

## Estados de transferência

- `BLOCKED_LINK`: vínculo inexistente ou ambíguo entre apoio e fundação.
- `BLOCKED_SOURCE`: não existe vetor físico correspondente ao mesmo nó e combinação governante.
- `BLOCKED_INCOMPLETE`: componente restringida ausente ou não numérica.
- `BLOCKED_MZ`: há torção `Mz` que o modelo atual de demanda da fundação não representa.
- `REVIEW_AXES`: mapeamento de eixos ainda não confirmado.
- `REVIEW_SIGN`: convenção de sinal ainda não selecionada.
- `READY`: transferência revisada e apta à aplicação explícita.

## Mapeamento persistido

| Reação do solver | Demanda da fundação |
|---|---|
| `Fx` | `Hx` |
| `Fy` | `Hy` |
| `Fz` | `N` |
| `Mx` | `Mx` |
| `My` | `My` |
| `Mz` | não representado — bloqueia se não nulo |

A versão não assume que `N > 0` significa compressão ou tração. O sinal final depende da convenção explicitamente escolhida e deve ser conferido em conjunto com o modelo geotécnico e com a convenção adotada pelo projeto.

## Auditoria

A persistência inclui:

- contrato e versão da transferência;
- `nodeId`;
- `combinationId`;
- mapeamento de componentes;
- modo de sinal escolhido;
- seis componentes originais da reação;
- unidades de força e momento.

Não são inferidas capacidades, resistências geotécnicas, aprovações normativas ou verificações adicionais a partir da reação transferida.
