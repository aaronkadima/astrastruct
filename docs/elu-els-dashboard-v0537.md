# AstraStruct v0.53.7 — dashboard ELU/ELS do edifício

A v0.53.7 consolida a leitura de verificações e resultados do edifício inteiro sem criar um segundo motor de dimensionamento. O painel indexa os elementos existentes por nível e categoria estrutural, reutiliza os contratos de verificação já produzidos pelo AstraStruct e relaciona essas evidências com a resposta física corrente do solver.

## Contrato

O contrato principal é `building-elu-els-dashboard/v1`, versão experimental `0.53.7-exp`. Cada linha usa `building-elu-els-row/v1`.

O dashboard cobre vigas, pilares, lajes/placas, paredes, contraventamentos e fundações. A classificação de grupo utiliza o mesmo `structuralElementGroup` já adotado pela aparência e pelo inventário do edifício. A associação a pavimentos reutiliza `building-level-inventory/v1`.

## ELU e ELS

Verificações `code-design-check/v1` e estruturas compatíveis são apenas indexadas; resistências não são recalculadas pelo dashboard. A categoria ELU/ELS é lida primeiro de metadados explícitos (`limitStateCategory`, `limitStateType`). Quando esses metadados não existem, o painel classifica apenas termos de engenharia reconhecíveis, como resistência/flexão/cisalhamento/flambagem para ELU e flecha/fissuração/drift/vibração/recalque para ELS. Verificações que continuam ambíguas permanecem `UNKNOWN` e não são usadas para preencher artificialmente a cobertura ELU/ELS.

Estados por categoria:

- `PASS`: existem verificações da categoria e todas estão aprovadas;
- `FAIL`: ao menos uma verificação da categoria falhou;
- `INVALID`: existe dado/verificação inválida;
- `PENDING`: a categoria está ausente ou contém verificação pendente.

Um elemento só chega a `READY_FOR_REVIEW` no painel integrado quando ELU e ELS estão `PASS`, existe resposta física nodal corrente e não há evidência bloqueadora. `READY_FOR_REVIEW` não significa aprovação, emissão ou liberação de projeto.

## Deformações e resposta estrutural

Para resultados físicos, o dashboard calcula apenas métricas derivadas de deslocamentos nodais já resolvidos:

- `u nodal máx.`: maior magnitude translacional entre os nós do elemento;
- `Δ extremos`: diferença vetorial de deslocamento entre primeiro e último nó para elementos com dois ou mais nós.

Essas métricas não substituem uma verificação normativa de flecha. Para formas modais ou de flambagem, o estado é `MODE_ONLY` e os vetores normalizados não são tratados como deslocamentos físicos em milímetros.

Os esforços/resultantes são mostrados por famílias de unidade, sem combinar axial, cortante, momento e torção em um único máximo dimensionalmente inconsistente. Para `shell4`, membrana, flexão e cortante transversal permanecem separados.

## Fundações

As fundações entram como categoria própria, reaproveitando `foundation-decision-dashboard/v1`. O status normativo é apresentado como evidência ELU. A existência de recalque ou reação SSI, por si só, não gera `PASS ELS`: sem um critério de serviço explícito, a célula ELS permanece `PENDING`.

## Navegação 3D

O botão **Selecionar no Canvas 3D** usa o evento `astrastruct:select-entity`. O `SpatialCanvas3D` valida se o nó/elemento existe antes de atualizar a seleção e publica `astrastruct:selection-changed` quando a seleção muda. Assim, a tabela e o modelo 3D usam a mesma seleção da aplicação.

## Interface

O painel é acessado por **Dashboard ELU/ELS · edifício…** no menu Resultados quando disponível, com fallback para o menu Modelo. Ele oferece:

- árvore por nível e categoria;
- filtros por estado e texto;
- tabela ELU/ELS com governante e utilização;
- deslocamentos/deformações nodais;
- evidência global de estabilidade;
- detalhes das verificações associadas;
- exportação CSV;
- seleção sincronizada com o Canvas 3D.

## Governança

A v0.53.7 mantém as seguintes regras: dado ausente nunca gera `PASS`; ausência de ELS nunca é mascarada por resposta SSI; formas próprias não são deformações físicas; o dashboard não recalcula resistências normativas; e nenhum estado integrado equivale à aprovação profissional do projeto.
