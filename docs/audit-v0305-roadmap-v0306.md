# AstraStruct — auditoria v0.30.5 e reorganização a partir da v0.30.6

## Marco auditado

A v0.30.5 fecha a sequência de visualização e mecânica local iniciada na série v0.30.x com um kernel de chapa de aço flexível contendo furos circulares explícitos por integração embedded/cut-cell e contato normal distribuído no contorno. O produto permanece experimental e a branch `main` não é alterada por esta consolidação.

O gate de encerramento da v0.30.5 exige simultaneamente:

- typecheck;
- validação sintática dos módulos numéricos;
- smoke tests estruturais;
- build React/Vite;
- regressão Playwright desktop/Android/tablet.

## Avaliação do solver

### Pontos fortes

1. **Separação por fenômeno** — os kernels de pórtico, treliça, P-Delta, co-rotacional, dinâmica, casca, estabilidade, materiais, ancoragem, parafusos, chapa e punção permanecem separados.
2. **Contratos centrais** — schema/migrations, `AnalysisConfig`, `ElementRegistry`, `SolverRegistry`, `structural-result/v1` e contrato de `RuleEngine` reduzem o acoplamento entre mecânica, persistência e futura verificação normativa.
3. **Cobertura de regressão** — há benchmarks determinísticos para os principais kernels, além de testes E2E da interface.
4. **Separação entre mecânica e norma** — resistência normativa não é embutida nos solvers de elementos finitos/contato.
5. **Inspeção espacial** — os Labs mais recentes retornam campos distribuídos, e não somente escalares máximos.

### Riscos e dívida técnica

1. `corotational2d.js` tornou-se grande demais para continuar crescendo com segurança; cinemática, montagem, controle de caminho, materiais e pós-processamento precisam de decomposição gradual.
2. A álgebra linear atual é essencialmente densa e própria. Para modelos maiores será necessário introduzir matriz esparsa, ordenação e solução robusta sem alterar os contratos externos.
3. Os resultados de Labs especializados ainda possuem formatos heterogêneos. Falta um contrato comum para campos como tensão, contato, aderência e demanda em perímetro.
4. A plasticidade da chapa da v0.30.5 é monotônica bilinear/secante com tangente consistente da própria lei; não é integração J2 incremental com memória plástica.
5. Ainda faltam estudos sistemáticos de convergência de malha/penalidade/segmentação para os contatos locais.

## Avaliação do frontend

### Pontos fortes

1. O aplicativo React/Vite já possui canvas 2D/3D, inspeção, resultados, histórico, importação/exportação e ampla cobertura Playwright.
2. Os Labs especializados oferecem visualização técnica editável/exportável e expõem hipóteses/limitações.
3. A interface preserva continuidade com o projeto persistido e com os contratos numéricos existentes.

### Riscos e dívida técnica

1. A expansão incremental gerou muitos módulos `*Bootstrap.ts` baseados em efeitos colaterais, `MutationObserver`, `innerHTML` e ordem de importação.
2. Vários Labs repetem shell modal, estilos, download, formatação, cards, legendas e exportadores.
3. Alguns painéis React e módulos de bootstrap já têm tamanho elevado, aumentando risco de regressão e custo de manutenção.
4. O texto de capacidade do Model Lab era corrigido por um segundo bootstrap, evidenciando duas fontes de verdade para a mesma UI.
5. O README e alguns textos de estado ficaram defasados em relação ao produto efetivamente executável.

## Decisão de arquitetura v0.30.6

A próxima prioridade não é acrescentar mais uma formulação física, mas reduzir o custo marginal de todas as próximas formulações.

A v0.30.6 introduz um **registry central de Labs isolados**:

- `registerIsolatedLab()` registra metadados e a função `open()`;
- `getIsolatedLabs()` fornece catálogo ordenado;
- `openIsolatedLab()` centraliza a abertura;
- um único bridge atualiza o Model Lab legado;
- novos Labs não devem criar `MutationObserver` próprio apenas para inserir cards;
- a migração é incremental e não exige reescrever todo o Model Lab de uma vez.

O primeiro caso migrado é **Chapa · furo explícito**. Seu kernel permanece `solverVersion = 0.30.5`; apenas a arquitetura de produto avança para v0.30.6.

## Prioridades reorganizadas

### P0 — consolidar frontend de Labs

- migrar ancoragem, grupo de parafusos, contato circular, furo oblongo, chapa flexível e punção para o registry;
- remover observers e patchers específicos à medida que cada Lab for migrado;
- extrair shell modal, controles, cards, download e mensagens comuns;
- eliminar textos de capacidade duplicados.

### P1 — contrato comum de inspeção mecânica

Definir um `inspection-field/v1` independente do solver, contendo no mínimo:

- `fieldType` (`stress`, `contact-pressure`, `bond-stress`, `perimeter-demand`, etc.);
- geometria/amostragem;
- unidade;
- escala min/max;
- valores e coordenadas;
- estado ativo/inativo quando aplicável;
- provenance do solver e do incremento;
- metadados de legenda/exportação.

Esse contrato deve alimentar uma única infraestrutura de legenda, tooltip, escala e CSV/SVG.

### P2 — verificação numérica dos Labs locais

Antes de ampliar a física do contato:

- estudo de convergência de malha Q4;
- convergência da quadratura cut-cell;
- convergência angular do contorno;
- sensibilidade a `kn`;
- balanço de energia/força;
- benchmarks simétricos e assimétricos;
- critérios automáticos para avisar discretização insuficiente.

### P3 — ampliar a mecânica das ligações

Depois dos gates P0–P2:

- contato tangencial/fricção;
- pré-tensão e transição slip-critical → bearing;
- chapa fora do plano e prying;
- dano/ovalização permanente;
- interação com chumbadores e concreto.

### P4 — módulos normativos via RuleEngine

Implementar regras como plugins independentes do solver mecânico:

- parafuso ao cisalhamento/tração/interação;
- bearing/tear-out;
- seção líquida e block shear;
- punção;
- ancoragem e cone/borda de concreto;
- edições específicas de NBR/ACI/AISC/Eurocode com provenance explícita.

## Critério de qualidade para próximas versões

Nenhuma nova capacidade deve ser considerada concluída apenas porque aparece na interface. Cada incremento deve incluir, conforme aplicável:

1. formulação e hipóteses documentadas;
2. benchmark determinístico;
3. equilíbrio/convergência numérica;
4. contrato de resultado;
5. visualização coerente com os dados do solver;
6. regressão E2E;
7. build e CI verdes no `develop`;
8. promoção para `main` somente após validação e aprovação explícita.
