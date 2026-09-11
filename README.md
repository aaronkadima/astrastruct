# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.3:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A pasta `web/` é publicada automaticamente por GitHub Actions após cada atualização da branch `main`.

## Funcionalidades implementadas

### Modelagem interativa

- biblioteca de elementos para concreto armado, aço e barras genéricas;
- montagem por dois pontos/nós e drag-and-drop;
- snap de nós e grid configurável;
- edição paramétrica de coordenadas, material, área e inércia;
- apoios por graus de liberdade `Ux`, `Uy` e `Rz`;
- liberação rotacional independente nas duas extremidades de elementos de pórtico;
- cargas nodais `Fx`, `Fy`, `Mz`;
- cargas uniformemente distribuídas `qx` e `qy` nos eixos locais;
- undo/redo, autosave, importação/exportação JSON e exportação SVG.

### Solver linear 2D

- treliças planas;
- pórticos Euler–Bernoulli;
- modelos mistos pórtico + treliça no mesmo sistema global;
- matriz global de rigidez;
- transformação local/global;
- condensação estática para releases rotacionais;
- vetor consistente de cargas distribuídas;
- deslocamentos, reações e esforços de extremidade;
- detecção de singularidade/mecanismo;
- deformada curva baseada nas funções de forma Euler–Bernoulli.

### Casos e combinações — v0.3

- múltiplos casos de carregamento;
- tipos de caso configuráveis;
- seleção independente do caso visível/editado e do cenário analisado;
- combinações lineares customizadas por fatores definidos pelo usuário;
- rastreamento do cenário nos resultados;
- demonstração `G + Q` com combinação customizada;
- princípio da superposição verificado automaticamente no CI.

> Os fatores de combinação atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib.

### Qualidade e validação

O workflow `AstraStruct CI` verifica sintaxe do frontend e executa testes de regressão do solver em cada push/PR. Os casos atuais incluem:

- treliça 2D;
- pórtico 2D;
- modelo misto;
- viga biapoiada de 6 m com `q = 20 kN/m`, validada contra reação `60 + 60 kN` e flecha analítica de `3,600 mm`;
- liberação rotacional, validada por momento de extremidade aproximadamente nulo;
- superposição de uma combinação `1,2·G + 1,5·Q`.

## Interface

A aplicação oferece:

- inspector contextual;
- painel de diagnósticos do modelo;
- tabelas de deslocamentos, reações e esforços;
- deformada com fator de escala;
- gerenciador de casos e combinações;
- command palette (`Ctrl/Cmd+K`);
- VNL — **Visual Nonlinear Language**.

## VNL — Visual Nonlinear Language

A VNL é a DSL visual própria do AstraStruct. O pipeline linear atual pode ser representado como:

`Geometry → Material → Section → Boundary → Load → Solver → Result → Plot`

A arquitetura está preparada para:

`Geometry → Mesh → Concrete Damage → Reinforcement → Bond-Slip → Contact → Increment → Newton Solver → Convergence → Result`

Os blocos não lineares permanecem explicitamente identificados como **solver avançado em desenvolvimento**.

## Executar localmente

```bash
python -m http.server 8080 --directory web
```

Abra `http://localhost:8080`.

## Testes

Requer Node.js 24 ou superior:

```bash
npm run check
npm test
```

## Arquitetura numérica-alvo

A interface e o núcleo numérico são desacoplados. O backend poderá evoluir para:

- solver browser JavaScript/TypeScript para análises leves;
- WebAssembly em Rust/C++/Fortran;
- serviço Python científico;
- serviço HPC remoto.

## Próximas etapas

- diagramas contínuos `N(x)`, `V(x)` e `M(x)`;
- envelope de resultados entre casos/combinações;
- peso próprio, temperatura, recalque e carga pontual em barra;
- offsets, excentricidades e ligações semirrígidas;
- biblioteca de perfis de aço e seções RC paramétricas;
- laboratório de elementos: barra axial, viga, pilar, ancoragem e ligação de aço;
- P-Delta e análise geométrica não linear;
- Newton–Raphson incremental-iterativo;
- plasticidade do aço;
- concreto fissurado/dano/plasticidade;
- bond-slip e pull-out de ancoragens;
- contato;
- elementos 3D, Timoshenko, shell e solid;
- malha adaptativa;
- pushover, modal e dinâmica transiente;
- staged construction e reliability;
- detalhamento e relatórios SVG/DXF/PDF;
- backend WebAssembly/HPC.

## Política normativa

Nenhuma regra normativa oficial deve ser considerada implementada sem edição identificada, cláusula rastreável, controle dimensional/unidades, casos de validação independentes, testes de regressão e revisão técnica documentada. Os futuros packs ABNT NBR, ACI, Eurocodes e fib Model Code serão versionados separadamente do solver estrutural.
