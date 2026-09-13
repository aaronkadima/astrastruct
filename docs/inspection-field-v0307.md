# AstraStruct v0.30.7 — `inspection-field/v1`

## Objetivo

A v0.30.7 introduz um contrato comum de pós-processamento para campos mecânicos espacialmente distribuídos. O objetivo é impedir que cada Lab invente uma estrutura própria de legenda, escala, amostragem e exportação.

O contrato **não modifica a formulação nem a montagem dos solvers**. Ele atua após a solução e preserva a `solverVersion` original em `provenance`.

## Contrato

Um campo possui:

- `contract = inspection-field/v1`;
- `id` — identificador estável do campo;
- `fieldType` — semântica mecânica, por exemplo `bond-stress`, `contact-pressure`, `punching-shear-stress`, `von-mises-stress`;
- `label`;
- `unit` explícita;
- `geometry.kind` — topologia da amostragem;
- `samples[]` — valor e coordenadas disponíveis (`x`, `y`, `z`, `s`, `angle`, `depth`), além de `entityId` e estado `active` quando aplicável;
- `scale` — min, max, maxAbs, modo e indicação de escala simétrica;
- `provenance` — versão do produto, tipo de resultado de origem e versão do solver;
- `meta` — dados auxiliares que não alteram a semântica do campo.

## Adapters iniciais

`web/src/view/inspectionFieldAdapters.js` converte resultados existentes sem duplicar a mecânica:

1. **Ancoragem aço–concreto** — perfil de `bondStressMPa` ao longo da profundidade de embutimento.
2. **Punção** — `tau/1000` em MPa ao longo da coordenada curvilínea e da geometria do perímetro crítico.
3. **Contato parafuso–furo** — pressão normal `p(θ)` por segmento, com ângulo, estado ativo, penetração e deformação radial.
4. **Chapa flexível** — tensão equivalente de von Mises nos estados de elemento disponíveis.

## Exportação

`inspectionFieldCsv()` gera um CSV independente do Lab. As colunas espaciais são incluídas somente quando existem e os metadados específicos de amostra são preservados.

## Regras de uso

- unidade é obrigatória;
- todas as amostras devem conter valores finitos;
- coordenadas presentes devem ser finitas;
- o adapter deve converter unidades explicitamente; não se admite inferência silenciosa;
- `productVersion` e `solverVersion` são conceitos diferentes e ambos devem permanecer rastreáveis;
- o campo não pode introduzir dados sintéticos para preencher regiões sem resultados do solver.

## Próxima etapa

A infraestrutura de UI deve consumir `inspection-field/v1` para construir uma legenda/escala comum, tooltips e exportadores reutilizáveis. Depois disso, os Labs de ancoragem, punção e contato podem abandonar suas implementações duplicadas de escalas e CSV sem alterar seus kernels.
