# AstraStruct v0.53.6 — dashboard integrado de fundações

A v0.53.6 reúne, em uma única visão, as evidências de revisão normativa da fundação, a resposta de interação solo–estrutura (SSI) e o modelo geotécnico explícito.

O contrato `foundation-decision-dashboard/v1` não substitui os contratos de origem. Cada disciplina mantém seu próprio estado, fonte e governança. O objetivo é impedir que um `PASS` normativo isolado seja interpretado como aprovação global quando geotecnia, SSI, distribuição de estacas ou resultados físicos ainda estiverem incompletos.

## Estados de decisão

- `FAIL`: existe falha normativa.
- `INVALID`: existe dado inválido em SSI ou geotecnia.
- `PENDING`: faltam dados, perfil geotécnico, resposta física SSI ou outra evidência necessária.
- `READY_FOR_REVIEW`: os módulos configurados possuem evidência suficiente para revisão humana integrada. Este estado não representa aprovação, emissão ou responsabilidade técnica automática.

## Evidências por fundação

Cada linha apresenta estado normativo, utilização governante, estado SSI, recalque `uz`, reação vertical da mola, pressão média `q̄`, perfil geotécnico vinculado, quantidade de camadas e parâmetros geotécnicos explicitamente registrados.

As recomendações normativas são preservadas e complementadas por pendências de integração. Fundações profundas continuam exigindo modelo explícito bloco–estacas–solo para reações individuais; não é aplicada divisão igualitária automática.

## Governança

Dados ausentes nunca geram aprovação. Perfis geotécnicos não são interpolados, parâmetros de solo não geram automaticamente rigidezes SSI e os estados normativo/geotécnico/SSI permanecem separados e auditáveis.

A interface está disponível em **Modelo → Dashboard · fundações/SSI/geotecnia…** e permite filtrar por estado, pesquisar fundações, abrir os módulos de origem e exportar um CSV de auditoria.
