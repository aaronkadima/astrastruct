# AstraStruct v0.30 — Lab de elementos e lançamento de modelos

## Implementado nesta etapa

A branch `develop` passa a incluir uma primeira camada funcional de **Lab & Modelos** sobre o contrato de projeto existente. O objetivo é permitir abrir modelos demonstrativos e gerar estruturas espaciais sem desenhar cada barra manualmente.

### Modelos 3D prontos

- edifício de concreto armado com 5 pavimentos, malha 3 × 2 vãos, pilares contínuos e vigas em todos os níveis;
- galpão metálico com seis pórticos transversais, pilares, rafters de duas águas, cumeeira e barras longitudinais;
- reservatório elevado de água representado por modelo global de barras com oito colunas, montantes e anéis inferior/superior.

Os três são **modelos demonstrativos**, não modelos normativamente dimensionados. As seções e ações devem ser revisadas pelo projetista.

### Lab de elementos isolados — v1

Presets iniciais:

- viga espacial isolada em balanço, preparada para análise co-rotacional 3D;
- coluna espacial isolada com compressão + força lateral, preparada para análise P-Delta 3D;
- elemento isolado com mola translacional e rotacional 3D.

A infraestrutura existente já permite editar materiais, seções, apoios, cargas nodais, ações de barra, molas, recalques e o tipo de análise. Portanto, o Lab de elementos de barra está mais próximo de uma camada de produto/UX do que de um novo solver.

### Lançamento de edifício

Dois modos estão disponíveis:

1. **Malha paramétrica**: vãos em X, vãos em Y, número de pavimentos e pé-direito geram automaticamente nós, pilares, vigas e apoios de base.
2. **Desenhar planta**: o usuário lança nós e segmentos em um editor 2D com snap; o traçado é extrudido para o número de pavimentos informado, criando pilares nos nós e vigas nos segmentos em cada nível.

O projeto gerado usa exatamente o mesmo schema persistido do AstraStruct e abre diretamente no Canvas 3D/Inspector.

## O que ainda falta no Lab

### Próximo nível — sem novo tipo de elemento

- releases e ligações semirrígidas espaciais `rx/ry/rz` nas extremidades de `frame3d`;
- presets adicionais: viga biapoiada, pórtico plano isolado, treliça espacial, coluna com imperfeição, viga com recalque, barra térmica, consoles e ligações por molas;
- comparação automática entre solução analítica e solução numérica para benchmarks clássicos;
- painel de curvas carga × deslocamento, força × deformação, energia e rigidez secante/tangente;
- exportação de um ensaio do Lab como relatório técnico reproduzível.

### Requer novos kernels físicos

- arrancamento de ancoragem/chumbador com cone de concreto, aderência, ruptura do aço e interação;
- punção de laje, incluindo perímetros críticos e armadura de punção;
- ligação chapa–parafuso/solda com componentes não lineares;
- placas/cascas para lajes, paredes, reservatórios e chapas;
- contato, apoio unilateral, gap e atrito;
- elementos sólidos/continuum quando necessários para análises locais.

Esses casos não devem ser representados apenas por uma barra ou uma mola e rotulados como se fossem o fenômeno real.

## Lançamento a partir de planta — próximas etapas

A etapa atual cobre lançamento paramétrico e desenho vetorial interno. Para um fluxo de planta real, a sequência recomendada é:

1. importação DXF/DWG convertida para linhas/eixos e layers selecionáveis;
2. underlay PDF/SVG/imagem com escala e dois pontos de calibração;
3. snapping em interseções/linhas da planta;
4. reconhecimento assistido de eixos, pilares e paredes, sempre com confirmação do usuário;
5. associação de níveis/pavimentos e repetição de plantas típicas;
6. geração de pilares, vigas e, quando existir elemento de placa/casca, lajes e paredes;
7. regras de conectividade e detecção de nós coincidentes/elementos sobrepostos.

A extração automática nunca deve eliminar a etapa de revisão do modelo estrutural antes da análise.

## Critério para considerar o Lab de barras "completo"

O Lab de barras pode ser considerado funcionalmente completo quando houver: presets, editor dedicado de condições de contorno e ações, todos os solvers de barra compatíveis, gráficos de resposta, comparação analítica, histórico reproduzível e relatório. A maior parte do kernel necessário já existe; o principal trabalho restante é integração e UX.
