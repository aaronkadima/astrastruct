# AstraStruct v0.53.1 experimental — explorador de edifício, fundações 3D e cobertura de resultados

## Escopo desta continuação

A v0.53.1 fecha uma segunda camada de paridade funcional observada nas plataformas estruturais de referência: leitura do edifício por pavimentos e famílias, visualização conjunta de fundações/estacas/solo, catálogo de resultados e matriz explícita do que está configurado, disponível ou ainda planejado. O objetivo continua sendo atingir uma base comparável ao mercado antes de concentrar o produto nos diferenciais exclusivos do AstraStruct.

## Evidência de mercado usada nesta etapa

A documentação oficial do TQS mostra que as ações são tratadas no contexto do edifício, incluindo permanentes, uso, vento, dinâmica, água, temperatura e sismo, com vento definido por parâmetros do edifício e combinações ELU/ELS. O SISEs trata superestrutura, fundações e solo no mesmo problema, incluindo esforços nos elementos de fundação e recalques, e admite sapatas isoladas/associadas, radier, tubulões, estacas circulares/quadradas/retangulares e vigas entre elementos.

O CYPECAD declara modelagem e dimensionamento de pilares, paredes, vigas e múltiplas tipologias de lajes, além de ações horizontais, verticais e fogo. O SAFE usa apoios de solo por pontos, linhas e áreas, inclusive somente compressão, e apresenta verificação de punção e contornos de tensões/demanda em lajes e fundações. O Tekla Structural Designer organiza projeto de membros de aço/concreto, paredes, lajes, mats e fundações isoladas, e disponibiliza pad bases, strip bases, pile caps, mats e piled mats; também possui verificações de drift, sway e deslocamentos globais.

O ETABS mantém a lógica de stories e resultados por pavimento, além de ações automáticas de vento e análise/design de edifícios. O Robot Structural Analysis oferece geração/simulação de vento em modelos de edifício/3D e workflows de dimensionamento de vigas, pilares e fundações. Esses padrões reforçam que deformadas, diagramas, contornos, fundações e resultados por nível devem ser navegáveis sem duplicar o solver.

## Novos contratos

### `building-level-inventory/v1`

Agrupa os elementos existentes por nível e papel estrutural (`beam`, `column`, `slab`, `wall`, `brace`, `foundation`, `other`). A associação usa `levelId` quando explícito e, de forma secundária, a elevação média dos nós para relacionar o elemento ao nível mais próximo. Nenhuma geometria é modificada.

### `foundation-soil-scene/v1`

Monta uma cena cadastral 3D a partir de:

- `building-design-basis/v1` para sistema de fundação, modelo de solo, nível d'água e camadas;
- `foundationReview.items` para posição, tipo e geometria de sapatas/blocos/radier;
- layout de estacas somente quando ele existe explicitamente no item;
- `foundation-project-review/v1` para estado PASS/FAIL/PENDING.

A cena não cria diâmetro, comprimento, quantidade ou posição de estacas que não estejam cadastrados. Para sistemas profundos sem layout explícito, o item é marcado como `pileLayoutPending`.

### `market-parity-result-dashboard/v1`

Indexa a cobertura de:

- deformada 3D de barras e cascas;
- diagramas N/V/M/T;
- contornos de `shell4`;
- deslocamentos/drifts por pavimento;
- revisão global de fundações;
- pressão de solo;
- reações por estaca;
- dashboard ELU/ELS;
- pranchas organizadas.

O estado de cada linha é `ready`, `available` ou `configure`. A ausência de um resultado de runtime nunca é convertida em resultado aprovado.

### `market-parity-coverage/v1`

Expõe, de forma explícita, o que já está configurado, o que a arquitetura já suporta e o que permanece planejado. Isso evita a impressão de que a simples existência de um campo de interface equivale a uma implementação normativa completa.

## Interface

O menu **Modelo** passa a oferecer **Explorador do edifício + fundações 3D…**. A janela possui quatro vistas:

1. **Modelo por nível** — inventário de elementos por pavimento e família estrutural;
2. **Fundação 3D + solo** — cena axonométrica com rotação, zoom e transparência das camadas do solo, fundações e estacas explicitamente cadastradas;
3. **Resultados** — status de deformadas, diagramas, contornos, drifts, fundações, solo e pranchas;
4. **Cobertura** — matriz de paridade para orientar a sequência de implementação.

A deformada física continua sendo exibida pelo `SpatialCanvas3D`, que já usa o mesmo resultado do solver para `frame3d` e `shell4`. A nova interface não cria um renderizador concorrente de resultados estruturais; apenas organiza o acesso e acrescenta a cena cadastral de fundações/solo.

## Próximos fechamentos de paridade

A ordem recomendada permanece:

1. geração auditável de vento por perfil normativo versionado;
2. perfis normativos completos de durabilidade, cobrimento, materiais e combinações;
3. tipologias de edifício parametrizadas aplicáveis somente mediante confirmação;
4. SSI espacial iterativo com molas/impedâncias derivadas de dados geotécnicos;
5. campos de pressão/recalque e reações de estacas na cena 3D;
6. dashboard ELU/ELS unificado por nível, família e elemento;
7. pranchas de formas, locação, lajes, vigas, pilares, fundações, cargas e resultados;
8. somente depois, concentração nos diferenciais AstraStruct.

## Fontes oficiais de referência consultadas

- TQS — ações do edifício e vento: https://docs.tqs.com.br/Docs/Details?id=2144750538&language=pt-br
- TQS SISEs — interação solo–estrutura: https://docs.tqs.com.br/Docs/Details?id=3450&language=pt-BR
- TQS SISEs — critérios e métodos: https://docs.tqs.com.br/Docs/Details?id=3451&language=pt-BR
- TQS SISEs — tipos de fundação: https://docs.tqs.com.br/Docs/Details?id=3947&language=pt-BR
- CYPECAD: https://info.cype.com/br/software/cypecad/
- CSI SAFE — features: https://www.csiamerica.com/products/safe/features
- CSI ETABS — enhancements: https://www.csiamerica.com/products/etabs/enhancements
- Tekla Structural Designer — create the model: https://support.tekla.com/doc/tekla-structural-designer/2026/mod_create_the_model
- Tekla Structural Designer — design models: https://support.tekla.com/doc/tekla-structural-designer/2026/des_designlandingpage
- Tekla Structural Designer — wind loading: https://support.tekla.com/doc/tekla-structural-designer/2026/loa_wind_loads
- Autodesk Robot — wind load simulation: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Robot-How-Wind-Load-Simulation-Works.html
