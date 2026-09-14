# AstraStruct v0.52 — Visualization, Reinforcement Sheets & Foundation Review

## Escopo

A v0.52 adiciona uma camada de revisão visual e executiva sem criar um segundo solver:

1. **Aparência por elemento** — cor RGB/HEX, opacidade de 0 a 100% e visibilidade, persistidas em `project.visualization.elementAppearance`. Essas propriedades são estritamente gráficas e não participam da análise estrutural.
2. **Pranchas editáveis de armadura** — geração a partir de `rebar-schedule/v1`, com folhas A0–A4, escala, revisão, entidades vetoriais editáveis, reposicionamento e exportação SVG. Marcas, diâmetros, quantidades, comprimentos e massa permanecem vinculados ao schedule de detalhamento.
3. **Foundation Review** — planta global das fundações, classificação `PASS / FAIL / PENDING`, verificação governante, utilização e recomendações determinísticas por mecanismo.

## Contratos

- `element-appearance/v1`
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

O workbench usa o mesmo fluxo de commit externo do projeto utilizado pelos módulos de automação da v0.51. Portanto, alterações de aparência, folhas e Foundation Review permanecem no projeto AstraStruct e participam do histórico normal do documento.
