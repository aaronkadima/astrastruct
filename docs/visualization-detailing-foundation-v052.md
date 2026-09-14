# AstraStruct v0.52 — Visualization, Reinforcement Sheets & Foundation Review

## Escopo

A v0.52 adiciona uma camada de revisão visual e executiva sem criar um segundo solver:

1. **Aparência do modelo** — configurada diretamente em **Canvas e visualização**. Os **Nós** possuem visibilidade global e opacidade de 0 a 100%, enquanto os elementos estruturais possuem cor RGB/HEX, opacidade de 0 a 100% e visibilidade por grupos `Lajes`, `Vigas`, `Pilares`, `Paredes`, `Treliças / contraventamentos / cabos`, `Fundações` e `Outros`. A aplicação dos elementos é coletiva: alterar um grupo atualiza todos os elementos classificados naquele grupo. Não existe nova edição visual individual na v0.52.
2. **Pranchas editáveis de armadura** — geração a partir de `rebar-schedule/v1`, com folhas A0–A4, escala, revisão, entidades vetoriais editáveis, reposicionamento e exportação SVG. Marcas, diâmetros, quantidades, comprimentos e massa permanecem vinculados ao schedule de detalhamento.
3. **Foundation Review** — planta global das fundações, classificação `PASS / FAIL / PENDING`, verificação governante, utilização e recomendações determinísticas por mecanismo.

## Nós

O contrato global de visualização de nós é `node-appearance/v1`, persistido em `project.visualization.nodeAppearance`. Ele contém apenas propriedades gráficas: `opacity` e `visible`.

A configuração é global, e não individual por nó. `opacity = 1` representa marcadores opacos; valores intermediários tornam os marcadores e seus rótulos transparentes; `visible = false` oculta os marcadores e rótulos. Os símbolos de apoio permanecem independentes: ocultar os nós **não** oculta apoios. A mesma regra é aplicada aos canvases 2D e 3D.

Estas propriedades não alteram coordenadas, restrições, conectividade, massa nodal, carregamentos, rigidez, dimensionamento ou resultados numéricos.

## Aparência e classificação dos grupos

O contrato canônico de grupo é `structural-appearance-group/v1`. O contrato `element-appearance/v1` é mantido como representação derivada/compatibilidade para o canvas e projetos experimentais anteriores.

A identificação do grupo é determinística. A prioridade é:

1. função estrutural explícita do elemento, quando disponível (`structuralRole`, `role`, `category`, `structuralGroup` ou equivalente);
2. semântica do tipo/nome do elemento;
3. tipo e orientação geométrica: frames predominantemente verticais são classificados como pilares; frames não verticais como vigas; shells horizontais como lajes; shells verticais como paredes; elementos `truss`/`cable` como treliças, contraventamentos ou cabos;
4. elementos não reconhecidos permanecem em `Outros`.

As propriedades de aparência são estritamente gráficas. Elas não participam da matriz de rigidez, massa, carregamentos, combinações, dimensionamento ou pós-processamento numérico. Em contornos científicos de esforços/tensões, a escala científica mantém prioridade de cor; visibilidade e opacidade continuam sendo respeitadas.

## Contratos

- `node-appearance/v1`
- `structural-appearance-group/v1`
- `element-appearance/v1` (derivado/compatibilidade)
- `engineering-drawing-sheet/v1`
- `foundation-review/v1`
- `foundation-item-review/v1`
- `foundation-project-review/v1`

## Governança normativa

O Foundation Review reutiliza `web/src/codeDesign/foundation.js` para pressão de contato, deslizamento, tombamento, punção, cisalhamento unidirecional e flexão. Coeficientes normativos não são inferidos.

O usuário deve fornecer no profile os parâmetros de sua edição normativa aplicável/licenciada. Se faltarem geometria, ações, solo, material ou parâmetros do profile, a verificação correspondente fica `PENDING`; ela nunca é convertida em aprovação.

As sugestões não alteram automaticamente o modelo. Elas apontam alternativas de engenharia — por exemplo, aumento de dimensões em planta, altura útil ou armadura — que exigem nova análise e validação pelo responsável técnico.

## Pranchas

A geração da prancha depende de `rebar-schedule/v1`. O desenho vetorial é editável, mas não inventa comprimentos de ancoragem, emendas, cobrimentos, espaçamentos, ganchos ou diâmetros de dobra. Esses requisitos devem vir do detalhamento/profile normativo aplicável.

## Persistência

A aparência global dos nós é persistida em `project.visualization.nodeAppearance`. As configurações por grupo são persistidas em `project.visualization.groupAppearance`. Para compatibilidade com o canvas atual, estilos efetivos dos elementos também são materializados em `project.visualization.elementAppearance` com `derivedFromGroup`.

O modal de Canvas e o workbench utilizam o mesmo fluxo `astrastruct:project-external-commit`; portanto, alterações visuais, folhas e Foundation Review permanecem no projeto AstraStruct e participam do histórico normal do documento.
