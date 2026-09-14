# AstraStruct v0.53 experimental — benchmark de mercado e base completa do projeto

## Objetivo

Esta etapa estabelece uma **linha de paridade funcional** antes de concentrar o produto em recursos exclusivos. O levantamento é representativo das plataformas de referência para edifícios, análise geral, lajes/fundações e interação solo–estrutura; não pretende afirmar que enumera literalmente todo software estrutural existente no mundo e não reproduz interfaces proprietárias.

A lógica consolidada observada no mercado é:

1. novo projeto, normas, unidades e metadados;
2. níveis/pavimentos, grelhas e referências BIM/CAD;
3. materiais e durabilidade: classe ambiental/exposição, vida útil, fck/fyk, cobrimentos e fogo;
4. tipologias e dimensões iniciais de vigas, pilares, paredes, lajes e diafragmas;
5. fundações e geotecnia: sapatas, blocos, estacas, radier, vigas de fundação, solo, molas/SSI, sondagens, nível d'água, capacidade e recalques;
6. ações: peso próprio, permanentes, uso, vento, sismo, temperatura, água/empuxos, dinâmica e etapas construtivas;
7. análise: linear, segunda ordem/P-Delta, modal, espectro, história no tempo, não linear, flambagem, rigidez fissurada e malha FEM;
8. dimensionamento/verificações por elemento em ELU/ELS e revisão iterativa;
9. resultados: deformada 2D/3D, diagramas, contornos de placas/cascas, reações, drifts, estabilidade, pressões/recalques e utilização;
10. detalhamento de armaduras e quantitativos;
11. documentação: pranchas por disciplina/categoria, pavimento, revisão e relatórios de cálculo.

## Plataformas brasileiras e de uso corrente no Brasil

| Plataforma | Fluxo/capacidades observadas nas fontes oficiais | Implicação para AstraStruct |
|---|---|---|
| AltoQi Eberick | Lançamento estrutural integrado ao BIM 3D; dimensionamento específico de lajes, vigas, pilares, fundações, reservatórios e muros; ELU/ELS; vento segundo NBR; fundações como sapatas, blocos, estacas, radier e tubulões; detalhamento automático e pranchas | Base do projeto deve anteceder análise e deve permanecer ligada aos elementos, resultados e documentação |
| TQS | Organização por edifício/pavimentos; critérios e durabilidade por grupos; materiais/cobrimentos; ações e combinações; estabilidade global; dimensionamento/detalhamento; SISEs para interação solo–estrutura, fundações e recalques | Critérios precisam ser hierárquicos e fundação/solo devem participar de um ciclo de reanálise auditável |
| CYPECAD | Dados gerais no início da obra; normas, materiais, opções de cálculo/armadura, vento/sismo/fogo; ampla biblioteca de lajes; fundações superficiais/profundas e Winkler; deformada 3D, isovalores, editor de armaduras, desenhos e listagens | O fluxo completo deve ser navegável sem depender de telas desconectadas; resultados e pranchas devem refletir o mesmo modelo |

## Plataformas internacionais de referência

| Plataforma | Padrão observado | Implicação para AstraStruct |
|---|---|---|
| ETABS | Modelo de edifício por stories, geração/definição de ações, análise estática/dinâmica/não linear, design de frames/paredes/lajes e visualização de resultados/contornos | Stories, ações e análise devem ser parte do mesmo contexto de edifício |
| SAFE | Lajes e fundações FEM; basemats/footings, apoio de solo, uplift, estacas, PT, strips, punção e geometria deformada | Lajes/fundações precisam de resultados de campo e solo além de verificações escalares |
| Tekla Structural Designer | Edifício integrado aço/concreto, análises de 1ª/2ª ordem, modal, deflexão de lajes, pad bases, pile caps, mats e piled mats | Verificação de serviço e fundações devem ser visíveis no fluxo principal |
| Autodesk Robot Structural Analysis | BIM, FEM, vento, análise estática/modal/não linear, dimensionamento por normas e mapas/tabelas de resultados | Interoperabilidade e exploração gráfica de resultados são requisitos basais |
| Dlubal RFEM 6 | Barras/superfícies/sólidos, building stories, assistentes de cargas, geotecnia/fundações, resultados e relatórios/folhas | Modelo geral e edifício devem coexistir; relatórios devem derivar dos mesmos contratos |
| Bentley STAAD.Pro / RAM | Análise 3D geral, cargas estáticas/dinâmicas/vento/sismo, RC/steel, footings/pile caps/walls/slabs, relatórios, quantitativos e desenhos | Manter análise geral sem restringir AstraStruct exclusivamente a edifícios |
| MIDAS Gen/nGen | Material/seção → modelo → vínculos → cargas → análise → design/output; vento/sismo, P-Delta, modal/espectro e elementos de edifício | Preservar pipeline explícito e rastreável até o output |
| SCIA Engineer | FEM 1D/2D, análise linear/não linear/dinâmica/flambagem e verificações normativas; BIM/documentação | Separar claramente solver, recuperação de resultados e plugins normativos |

## Fontes oficiais consultadas

- AltoQi Eberick: https://www.altoqi.com.br/produtos/eberick ; https://www.altoqi.com.br/produtos/eberick/recursos ; https://www.altoqi.com.br/recursos/dimensionamento-dos-elementos ; https://www.altoqi.com.br/recursos/detalhamentos-completos-e-otimizados
- TQS Docs / ações e SISEs: https://docs.tqs.com.br/Docs/Details?id=2144750538&language=pt-br e documentação oficial em https://docs.tqs.com.br/
- CYPECAD: https://info.cype.com/br/software/cypecad/ ; https://info.cype.com/pt/produto/cypecad-dados-gerais-opcoes-de-calculo-e-gerais/ ; https://info.cype.com/pt/tema/cypecad-documentacao-obtida/
- CSI ETABS: https://www.csiamerica.com/products/etabs/ ; https://www.csiamerica.com/products/etabs/enhancements
- CSI SAFE: https://www.csiamerica.com/products/safe ; https://www.csiamerica.com/products/safe/features
- Tekla Structural Designer: https://support.tekla.com/doc/tekla-structural-designer/2026/tsd_configurations ; https://support.tekla.com/doc/tekla-structural-designer/2026/sda_slabdeflectioncalculationsindepth
- Autodesk Robot Structural Analysis: https://www.autodesk.com/products/robot-structural-analysis/product-details
- Dlubal RFEM 6: https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-building-model ; https://www.dlubal.com/pt/download-e-informacao/documentos/manuais-online/rfem-6
- Bentley STAAD.Pro: https://www.bentley.com/products/staad-pro
- MIDAS Gen: https://www.midasstructure.com/tutorial/seismic-design_for_rcbuilding0-0-0-0

## Implementação v0.53 — `building-design-basis/v1`

A primeira implementação da paridade cria uma base unificada e persistente para:

- norma/edição, unidades e vida útil;
- exposição/agressividade, fogo, fck por família estrutural, fyk e cobrimentos por família;
- dimensões padrão de vigas/pilares/paredes e tipologia/espessura de laje;
- sistema de fundação, modelo de solo, q, módulo de reação, água, estacas e perfil de camadas de solo;
- ações gravitacionais, vento, sismo, temperatura e etapas construtivas;
- tipo de análise, P-Delta, rigidez fissurada, malha e interação solo–estrutura;
- seleção dos resultados que deverão compor a revisão final;
- índice de pranchas por categoria, nível e revisão.

Valores críticos que dependem de norma/local/geotecnia são iniciados como `null`. A interface **não inventa** fck, cobrimento, velocidade de vento, tensão admissível, coeficientes de solo ou fatores normativos. A sincronização com o kernel nesta etapa é deliberadamente conservadora: apenas configurações já compatíveis, como `settings.analysisType`, são atualizadas.

## Recursos já reutilizados

A v0.53 não duplica recursos que já existem:

- níveis e pavimentos: `web/src/core/levels.js`;
- análises linear, P-Delta, co-rotacional, modal, espectral e história no tempo: kernel existente;
- deformada 3D de `frame3d` (vigas/pilares) e `shell4` (lajes/placas): `app/src/SpatialCanvas3D.tsx`;
- resultantes/contornos de cascas e diagramas de barras: pós-processamento existente;
- revisão de fundações PASS/FAIL/PENDING: `web/src/foundation/review.js`;
- pranchas vetoriais de armadura: `engineering-drawing-sheet/v1`;
- casos/combinações: `web/src/designActions` e contratos existentes;
- IFC e interoperabilidade: módulos `web/src/interop`.

## Próximos fechamentos de paridade

1. perfis normativos versionados para durabilidade/cobrimento/materiais e geração auditável de ações de vento;
2. gerador de tipologias de edifício que aplique as dimensões padrão na criação de elementos, sem alterar elementos existentes sem confirmação;
3. modelo geotécnico espacial com sondagens, camadas, molas e iteração SSI;
4. visualização 3D explícita de sapatas, blocos, estacas, radier e superfícies/camadas de solo vinculadas aos resultados;
5. pranchas adicionais de formas, fundações, vigas, pilares, lajes, locação/cargas e resultados;
6. dashboard global de verificação ELU/ELS e filtros por pavimento/categoria;
7. somente após essa paridade: diferenciais próprios AstraStruct (assembly-first, simulações locais, conexões automáticas, VLM/DT/SHM e workflows exclusivos).
