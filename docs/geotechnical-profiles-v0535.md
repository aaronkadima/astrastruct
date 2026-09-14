# AstraStruct v0.53.5 — perfis geotécnicos explícitos e visualização 3D

A v0.53.5 adiciona uma camada geotécnica rastreável ao projeto estrutural sem transformar dados de sondagem em rigidez SSI de forma automática. O objetivo é registrar perfis de solo, associá-los explicitamente às fundações e visualizá-los junto aos resultados de interação solo–estrutura sem criar geologia ou campos contínuos inexistentes.

## Contratos

O contrato principal é `foundation-geotechnical-model/v1`. Cada perfil usa `foundation-geotechnical-profile/v1` e cada camada usa `foundation-geotechnical-layer/v1`. A versão experimental é `0.53.5-exp`.

Cada perfil possui coordenadas `x`, `y`, cota do terreno `groundZ`, fonte/identificação, método e camadas. As camadas armazenam profundidade superior e inferior, descrição/classificação e, quando disponíveis, parâmetros como NSPT, peso específico, Es, ν, módulo de reação e pressão admissível.

Esses parâmetros são apenas dados geotécnicos explícitos e auditáveis. A v0.53.5 não converte NSPT, Es, ν, k, qadm ou qualquer outro parâmetro em `Kx`, `Ky`, `Kz`, `Kθx`, `Kθy` ou `Kθz`. As molas SSI continuam exigindo rigidezes explicitamente fornecidas ou obtidas por método externo validado.

## Estados

Dados ausentes permanecem `PENDING`. Dados fisicamente ou geometricamente impossíveis, como profundidade negativa, base acima do topo, ν fora de `0 ≤ ν < 0,5` ou camadas sobrepostas, ficam `INVALID`. Um perfil somente chega a `READY` quando possui localização, fonte e camadas válidas.

## Vínculo com fundações

O vínculo fundação ↔ perfil é manual. O sistema não escolhe automaticamente a sondagem mais próxima, porque proximidade geométrica não prova representatividade geotécnica.

## Visualização 3D

No Canvas 3D, o modo **Perfis** representa cada sondagem como uma coluna pontual na coordenada cadastrada. As camadas não são estendidas lateralmente e não formam volumes fictícios entre perfis.

Os modos **Recalque uz** e **Pressão q̄** usam somente fundações vinculadas a perfis e resultados físicos SSI disponíveis. Os valores são exibidos como amostras discretas sobre as fundações. Não há triangulação, krigagem, IDW, spline ou qualquer outra interpolação espacial nesta etapa.

Para análise modal ou flambagem, formas próprias permanecem sem interpretação de recalque ou pressão física, em conformidade com a governança SSI v0.53.4.

## Interface

O menu **Modelo → Geotecnia · perfis de solo…** abre o editor de perfis, camadas, vínculos e auditoria. O Canvas 3D recebe controles próprios para ativar a geotecnia e alternar entre perfis, recalques e pressão média.
