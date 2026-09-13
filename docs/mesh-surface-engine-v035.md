# AstraStruct v0.35 — Mesh & Surface Engine

## Escopo

A v0.35 separa a **topologia e a geometria de malha** da física do elemento `shell4`. O objetivo é fornecer uma infraestrutura reutilizável para superfícies estruturais sem antecipar os elementos avançados da v0.36 nem os shells material/geometricamente não lineares da v0.38.

Contratos públicos principais:

- `mesh-surface/v1` — identificação do engine;
- `surface-mesh/v1` — nós e células `tri3`/`quad4`;
- `surface-topology/v1` — arestas, adjacência, componentes e fronteiras;
- `surface-cell-geometry/v1` — geometria e métricas locais;
- `surface-mesh-quality/v1` — agregação de qualidade;
- `surface-refinement-report/v1` — refinamento conforme;
- `shell-frame-coupling/v1` — acoplamento cinemático por MPC;
- `project-surface-refinement-report/v1` — integração com o projeto AstraStruct.

O schema persistido do projeto permanece na versão 2 e `structural-result/v1` permanece inalterado.

## 1. Modelo de malha

`web/src/mesh/meshModel.js` define uma malha de superfície independente do solver:

```text
SurfaceMesh
  nodes: {id, x, y, z, group?, meta?}[]
  cells: {id, type: tri3|quad4, nodeIds, group?, sourceElementId?, meta?}[]
```

A validação rejeita ids duplicados, células com cardinalidade incorreta e referências a nós inexistentes. O adapter `surfaceMeshFromProject()` converte os `shell4` existentes para `quad4`, preservando o vínculo `sourceElementId`.

## 2. Topologia e manifold

`web/src/mesh/topology.js` constrói as arestas canônicas por pares de nós e classifica:

- aresta de fronteira: 1 uso;
- aresta interior manifold: 2 usos;
- aresta não-manifold: mais de 2 usos.

Também são gerados:

- adjacência célula–célula;
- componentes conexos;
- loops de fronteira fechados;
- nós de fronteira aberta;
- orientação consistente entre células adjacentes;
- detecção de nós coincidentes dentro de tolerância.

Uma malha não-manifold é rejeitada pelas operações que dependem de vizinhança física inequívoca, como o refinamento conforme.

## 3. Geometria e qualidade

`web/src/mesh/surfaceGeometry.js` calcula, em 3D:

- área;
- centróide;
- vetor normal;
- comprimentos das arestas;
- ângulos internos;
- aspect ratio;
- warpage e warpage relativo;
- Jacobiano escalado nos cantos.

Para cada canto, a métrica de orientação é baseada em

```text
J_s = [(a × b) · n] / (|a| |b|)
```

onde `a` e `b` são as arestas incidentes e `n` é a normal orientada da célula. Valores não positivos invalidam a célula; os demais limites são reportados como `warning` sem alterar silenciosamente a geometria.

## 4. Geração de malha

`web/src/mesh/generators.js` fornece duas rotas independentes:

### Patch bilinear `quad4`

Para quatro cantos `P00, P10, P11, P01`, o ponto paramétrico é

```text
P(u,v) = (1-u)(1-v)P00 + u(1-v)P10 + uvP11 + (1-u)vP01
```

com subdivisões estruturadas `divisionsU × divisionsV`.

### Polígono planar `tri3`

Polígonos simples planares são triangulados por **ear clipping**. A rotina verifica degeneração e não-planaridade antes da triangulação e não tenta corrigir automaticamente polígonos inválidos.

## 5. Refinamento conforme

`web/src/mesh/refinement.js` implementa refinamento `h` de um nível:

```text
tri3  -> 4 tri3
quad4 -> 4 quad4
```

Os pontos médios de arestas compartilhadas são criados **uma única vez** por chave topológica. Para `quad4`, acrescenta-se um nó de centro da célula.

O padrão `scope='component'` expande uma seleção parcial para todo o componente conexo. Essa decisão é deliberada: não são introduzidos hanging nodes sem uma formulação MPC específica. `scope='selected'` só é aceito quando não existe interface interior refinada/não refinada; caso contrário a operação falha explicitamente.

O relatório compara área antes/depois, contagem de nós/células e estado manifold. `group`/`levelId` é preservado nos nós gerados quando a origem é inequívoca.

## 6. Coupling shell–frame por MPC

`web/src/mesh/shellFrameCoupling.js` projeta cada nó shell selecionado no segmento de frame mais próximo. Para coordenada paramétrica `t`:

```text
N1 = 1 - t
N2 = t
u_f = N1 u_1 + N2 u_2
θ_f = N1 θ_1 + N2 θ_2
```

Quando o nó shell está deslocado do eixo do frame por um vetor `r`, a translação compatível inclui o braço rígido:

```text
u_s = u_f + θ_f × r
```

Logo, por exemplo:

```text
u_x,s = N1 u_x,1 + N2 u_x,2
      + r_z (N1 θ_y,1 + N2 θ_y,2)
      - r_y (N1 θ_z,1 + N2 θ_z,2)
```

As equações são escritas no `ConstraintManager` da v0.32 e podem ser impostas pelos métodos de transformação, penalty ou multiplicadores de Lagrange já existentes no Numerical Core 2. As rotações shell podem ser interpoladas também (`tieRotations=true`).

Este coupling é **cinemático**. Não introduz automaticamente offset estrutural normativo, rigidez de ligação, contato, liberação local ou comportamento não linear de interface.

## 7. Integração com `shell4`

`web/src/mesh/projectAdapter.js` usa a malha genérica como camada intermediária:

```text
Projeto shell4 -> surface-mesh/v1 -> refinamento -> Projeto shell4
```

Cada filho herda as propriedades físicas do shell de origem (`materialId`, espessura, fatores do elemento etc.). Cargas `surface`/`pressure` mantêm a **mesma intensidade de pressão** em cada filho. Tipos de carga sem regra de redistribuição explícita são rejeitados, em vez de serem transferidos por hipótese implícita.

## 8. Verificação determinística

`tests/mesh-surface-engine-v035-smoke.mjs` cobre:

1. patch estruturado com área exata;
2. aresta interior e loop de fronteira;
3. correção de orientação de células vizinhas;
4. detecção de aresta não-manifold;
5. proibição de refinamento parcial com hanging node;
6. refinamento conforme `quad4` com conservação de área;
7. triangulação de polígono côncavo e refinamento `tri3`;
8. coupling shell–frame com interpolação e termo `θ × r`;
9. retorno ao projeto `shell4`, preservando propriedades e intensidade da pressão.

## 9. Limitações deliberadas da v0.35

A v0.35 não implementa:

- elementos Timoshenko, cabos ou links avançados;
- remalhamento adaptativo por estimador de erro;
- hanging nodes gerais;
- shells não lineares;
- contato 2D/3D;
- malha volumétrica tetra/hexa;
- geração CAD/B-rep;
- transferência conservativa geral de qualquer tipo de carga ou variável de estado.

Esses itens pertencem a etapas posteriores e não são antecipados.

## Próximo gate

Somente após a v0.35 passar integralmente por benchmarks, regressões estruturais, build e Playwright, a sequência permite iniciar **v0.36 — Advanced Element Library**.
