# AstraStruct v0.26.1 — Canvas 3D espacial

## Objetivo
Substituir a projeção XY usada temporariamente na v0.26 por um viewport espacial interativo dedicado, sem acoplar renderização às formulações estruturais.

## Câmera e projeções
O Canvas 3D usa uma câmera orbital com alvo, yaw, pitch, distância, zoom e duas projeções:

- perspectiva;
- ortográfica.

Há presets ISO, XY, XZ e YZ, ajuste automático ao modelo, órbita por arraste, pan com Shift/botão secundário e zoom pela roda ou controles `+/-`.

A projeção é calculada no módulo puro `web/src/view/spatialView3d.js`. O componente React `SpatialCanvas3D.tsx` apenas consome a matemática e renderiza no elemento HTML `<canvas>`.

## Modelo visualizado
O viewer representa:

- nós com coordenadas X/Y/Z;
- elementos `frame3d` e `truss3d`;
- apoios espaciais;
- cargas nodais Fx/Fy/Fz;
- cargas uniformes locais qx/qy/qz convertidas para coordenadas globais por eixos locais do elemento;
- eixos locais opcionais dos elementos;
- grade no plano XY inferior;
- seleção visual de nó ou elemento.

## Resultados
Para resultados estáticos 3D, o Canvas mostra a geometria indeformada e a deformada com escala automática e fator ajustável. Também pode colorir os elementos pela magnitude dos resultantes N, V, M ou T recuperados pelo solver.

O contrato visual aceita diretamente resultados futuros de:

- análise modal 3D (`analysisType='modal'` + `modes[].displacements`);
- flambagem 3D (`bucklingView.result.modes[].displacements`).

Quando o campo é modal ou de flambagem, a forma pode ser animada harmonicamente. A amplitude gráfica é apenas de visualização e não representa deslocamento físico, salvo quando o resultado original é uma deformada estática.

## Escopo protegido
A v0.26.1 é um módulo de **visualização**, não um novo solver. Ela não adiciona:

- modelagem gráfica de novos elementos 3D por clique;
- picking de superfícies/shells;
- renderização sólida de seções;
- tensões 3D por superfície;
- P-Delta ou co-rotacional 3D.

Esses recursos permanecem para etapas próprias após a consolidação do viewer.

## Validação
A validação inclui:

- ortogonalidade da base da câmera;
- projeção de nós 3D;
- eixos locais dos elementos;
- extração de campos estático, modal e de flambagem;
- deslocamento escalado;
- magnitudes de N, V, M e T;
- E2E do Canvas 3D com presets, zoom, projeção, análise estática, deformada e mapa de momento;
- regressão completa e testes responsivos antes do merge.
