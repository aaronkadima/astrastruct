# AstraStruct v0.42 — Design Actions & Combinations

## Escopo

A v0.42 introduz uma camada independente de normas para classificar ações, gerar combinações determinísticas, compilar cada combinação no **Load/Stage Engine v0.40** e construir envelopes de resultados.

Contratos públicos:

- `design-actions/v1`;
- `load-combinations/v1`;
- `combination-envelope/v1`;
- `compiled-design-combination/v1`.

Versão experimental do engine: `0.42.0-exp`.

A responsabilidade desta versão é **combinar ações**, e não calcular resistências ou verificações normativas de elementos. O dimensionamento RC/Steel/Foundation permanece reservado à **v0.43**.

## Princípio de rastreabilidade

O engine não contém coeficientes normativos embutidos. Toda regra de combinação deve fornecer `provenance` explícita e os fatores devem chegar por:

1. entrada direta do usuário;
2. conjunto de parâmetros verificado;
3. plugin normativo autorizado.

Se um fator necessário estiver ausente, a combinação falha explicitamente. O engine não substitui ausência de dado por zero, um ou outro valor implícito.

## Definição das ações

Cada ação física já aceita pelo Load/Stage Engine pode receber metadados de projeto:

- `id` — identificador único;
- `designCategory` — categoria conceitual, por exemplo `permanent`, `variable`, `accidental`, `seismic` ou outra definida externamente;
- `factorClass` — classe opcional com precedência sobre a categoria na seleção do fator;
- `exclusiveGroup` — grupo de alternativas que não podem atuar simultaneamente;
- `leadingEligible` — informa se a ação pode assumir o papel de ação líder;
- `scale` — escala física original da ação.

Esses campos não mudam a natureza da carga. A aplicação efetiva continua sendo executada pelo `load-action/v1` da v0.40.

## Resolução de fatores

A precedência é:

`byAction -> byClass -> byCategory -> default`.

A definição selecionada pode ser um número único ou um objeto por papel:

- `leading`;
- `accompanying`;
- `default`.

O fator efetivo aplicado ao Load/Stage Engine é:

`effectiveScale = baseScale * combinationFactor`.

A distinção favorável/desfavorável não é inferida automaticamente nesta versão, porque ela depende do efeito estrutural analisado e não apenas do nome da ação. Quando necessária, deve ser representada por `factorClass`, regra explícita ou geração externa de regras.

## Ação líder e acompanhantes

`leadingCategories` define quais categorias participam da seleção de líder. Para cada variante válida de simultaneidade:

1. cada ação elegível é tomada, uma vez, como líder;
2. as demais ações pertencentes às categorias líderes recebem papel `accompanying`;
3. ações de outras categorias recebem papel `default`.

Uma ação com `leadingEligible:false` nunca é escolhida como líder, mas continua sendo acompanhante quando sua categoria pertence a `leadingCategories`.

## Exclusividade

Ações com o mesmo `exclusiveGroup` são expandidas deterministicamente conforme a regra:

- `one-of` — exatamente uma alternativa do grupo participa;
- `zero-or-one` — nenhuma ou exatamente uma alternativa participa.

Isso permite representar, por exemplo, direções mutuamente exclusivas de uma ação sem criar combinações fisicamente impossíveis.

## Identificadores determinísticos

Cada combinação recebe identificador derivado de:

- `rule.id`;
- variante de exclusividade;
- ação líder;
- lista ordenada de ações e fatores.

A mesma entrada produz os mesmos identificadores e a mesma ordem de combinações, favorecendo auditoria, cache e reprodutibilidade.

## Compilação para a v0.40

`compileDesignCombination()` transforma os termos da combinação em cópias escaladas das ações originais e chama `compileActionSet()`.

Com isso são preservados os mecanismos existentes de:

- cargas nodais;
- cargas de barra;
- settlements;
- prestress;
- moving loads.

O projeto original não é mutado.

## Envelope

`envelopeCombinationResults()` recebe resultados previamente calculados por combinação e caminhos numéricos, como:

- `forces.N`;
- `forces.My`;
- `displacements.uz`.

Para cada caminho são registrados:

- mínimo;
- máximo;
- `combinationId` governante;
- `caseId`, quando existente.

O contrato é `combination-envelope/v1`.

## Verificação determinística

`tests/design-actions-combinations-v042-smoke.mjs` verifica:

1. unicidade e classificação das ações;
2. precedência por `factorClass`;
3. ação líder e acompanhante;
4. grupos `one-of` e `zero-or-one`;
5. rejeição de regra sem `provenance`;
6. rejeição de fator ausente;
7. compilação efetiva no `load-action/v1` da v0.40;
8. não mutação do projeto original;
9. envelope min/max com rastreabilidade da combinação governante.

## Limitações explícitas

- não há fatores normativos embutidos;
- não há inferência automática de ação favorável/desfavorável a partir do resultado estrutural;
- não há pruning combinatório baseado em heurísticas de resistência;
- combinações são geradas a partir das regras explicitamente fornecidas;
- o engine não executa verificações de resistência, detalhamento ou dimensionamento normativo.

## Próxima etapa

Com o release gate e CI final verdes, a próxima versão permitida é **v0.43 — RC/Steel/Foundation code design**. A v0.42 fornece as ações e combinações de projeto que essa etapa poderá consumir, mas não antecipa seus cálculos de resistência.
