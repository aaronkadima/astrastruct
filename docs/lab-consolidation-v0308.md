# AstraStruct v0.30.8 — P0/P1: Labs centralizados e campos de inspeção

## P0 — consolidação do frontend

A v0.30.8 torna o `LabRegistry` a única via de descoberta dos Labs locais de mecânica. Os módulos de ancoragem, grupo de parafusos, contato circular, furo oblongo, chapa flexível e punção deixam de ser carregados como bootstraps independentes com `MutationObserver`. Um único `coreLocalLabsBootstrap.ts` registra os seis módulos; o furo circular explícito já havia sido migrado na v0.30.6.

O bridge central mantém cards idempotentes por assinatura e também passa a ser a única fonte do texto de capacidades do Model Lab. Os arquivos legados permanecem no repositório apenas para rastreabilidade histórica, mas não são importados pela aplicação.

A camada comum `labUi.ts` concentra shell modal, estilos, parsing/formatação e download. Isso reduz duplicação e impede que cada novo fenômeno crie sua própria infraestrutura de diálogo.

## P1 — inspection-field/v1

O contrato introduzido na v0.30.7 passa a ser consumido pela interface centralizada. `inspectionFieldUi.ts` fornece:

- escala derivada exclusivamente dos valores retornados pelo solver;
- legenda com unidade e faixa numérica;
- renderização de caminho 1D e mapa de pontos 2D;
- tooltip com valor real da amostra;
- provenance do produto/solver;
- compatibilidade com exportação CSV do contrato e exportação SVG do AstraStruct.

São adaptados diretamente:

- tensão de aderência no pull-out;
- demanda de punção no perímetro;
- tensão equivalente de von Mises na chapa;
- bearing equivalente nos grupos de contato circular/oblongo.

Nenhum gradiente de tensão é criado sem dados do solver. Quando o solver fornece pontos discretos, a visualização identifica explicitamente essa discretização.

## Compatibilidade

Os identificadores E2E e os fluxos de exportação existentes são preservados. A suíte adicional `lab-registry-v0308.spec.ts` verifica que cada Lab local possui exatamente um card registrado e que reaberturas/rerenderizações não geram duplicação.

## Limites

Esta versão não altera nenhuma formulação mecânica nem edição normativa. Kernels anteriores mantêm seus `solverVersion`; somente o produto e a infraestrutura visual avançam para v0.30.8.
