# AstraStruct v0.44 — Detailing + professional calculation reports

## Objetivo

A v0.44 fecha a cadeia de engenharia iniciada nas etapas de análise, ações/combinações e dimensionamento com dois artefatos rastreáveis:

1. **detalhamento geométrico e quantitativo**, sem inferir requisitos normativos que não tenham sido fornecidos explicitamente; e
2. **memória de cálculo profissional determinística**, capaz de consolidar identificação do projeto, revisões, modelo, combinações, análises, verificações, quantitativos, hipóteses, limitações, proveniência e anexos.

A cadeia consolidada passa a ser:

`Analysis Results -> Design Actions -> Load Combinations -> Code Design Checks -> Detailing -> Calculation Report`

## Contratos públicos

### Detalhamento

O módulo `web/src/detailing/` expõe:

- `detailing-model/v1`;
- `rebar-schedule/v1`;
- `steel-schedule/v1`;
- `DETAILING_VERSION = 0.44.0-exp`.

O modelo trabalha com marcas explícitas e auditáveis para armaduras, chapas, chumbadores e soldas. Os quantitativos são calculados a partir da geometria fornecida e não de regras ocultas.

### Memória de cálculo

O módulo `web/src/reports/` expõe:

- `calculation-report/v1`;
- `CALCULATION_REPORT_VERSION = 0.44.0-exp`;
- criação e validação do relatório;
- renderização determinística em Markdown;
- renderização HTML A4 com comando de impressão/PDF.

O relatório não recalcula a estrutura. Ele consolida entradas, resultados e metadados rastreáveis recebidos dos motores anteriores, preservando a provenance dos dados.

## Detalhamento de armaduras

`layoutBarsBySpacing()` determina quantidade, espaçamento efetivo e posições a partir de comprimento livre, espaçamento máximo e offsets de borda.

`createRebarMark()` registra, entre outros campos:

- diâmetro e classe;
- quantidade;
- segmentos retos;
- arcos informados explicitamente;
- comprimento de corte na linha de centro;
- massa linear, massa por barra e massa total;
- forma, localização, notas e metadados.

A v0.44 **não inventa** deduções de dobra, ganchos, ancoragens ou emendas. Se uma geometria não foi informada, ela não é acrescentada automaticamente.

## Detalhamento metálico

O `steel-schedule/v1` agrega:

- chapas, com dimensões, espessura, quantidade, volume e massa;
- chumbadores, com diâmetro, embutimento, projeção, comprimento adicional/total e massa;
- soldas, com garganta efetiva, comprimento, quantidade e quantitativo geométrico equivalente.

Resistência normativa, diâmetros mínimos, distâncias de borda, comprimentos de ancoragem, dimensionamento de solda e outros requisitos de código permanecem responsabilidade dos profiles/plugins normativos aplicáveis.

## Memória de cálculo e rastreabilidade

`createCalculationReport()` organiza dez seções obrigatórias:

1. controle do documento;
2. identificação e base do projeto;
3. modelo estrutural;
4. ações e combinações;
5. análises e resultados;
6. verificações de dimensionamento;
7. detalhamento e quantitativos;
8. hipóteses, limitações e provenance;
9. anexos e rastreabilidade;
10. responsabilidade e revisão.

Cada verificação conserva status `OK`, `NÃO ATENDE` ou `PENDENTE`. Dados normativos/licenciados ausentes continuam sendo reportados como PENDENTE; a camada de relatório não converte ausência de informação em aprovação.

A saída HTML escapa conteúdo fornecido pelo usuário antes da renderização, evitando inserir marcação HTML arbitrária no documento gerado.

## Compatibilidade e versionamento

A v0.44 atualiza apenas a versão do produto para `0.44.0`.

- `PROJECT_SCHEMA_VERSION` permanece `2`;
- `RESULT_CONTRACT_VERSION` permanece `1.0`;
- `code-design/v1`, `design-actions/v1` e os contratos estruturais anteriores permanecem compatíveis;
- os novos contratos de detailing/report são experimentais em `0.44.0-exp`.

Isso evita migração desnecessária de projetos persistidos e mantém compatibilidade retroativa com a cadeia v0.43.

## Validação determinística

`tests/detailing-report-v044-smoke.mjs` verifica:

- distribuição de barras por espaçamento;
- comprimento de corte com arcos explícitos;
- massa linear e quantitativos de armaduras;
- quantitativos de chapas, chumbadores e soldas;
- agregação do pacote de detalhamento;
- integração com verificações `code-design/v1`;
- preservação de resultados PENDENTE;
- estrutura das dez seções do relatório;
- renderização Markdown;
- renderização HTML A4;
- escape de conteúdo HTML fornecido pelo usuário.

`tests/release-gate-v044-smoke.mjs` é o gate de versão e impede promover a v0.44 se package, metadados, contratos, documentação e cadeia mínima de testes não estiverem coerentes.

## Limites da v0.44

A v0.44 entrega um **modelo de detalhamento geométrico/quantitativo e memória de cálculo rastreável**, mas ainda não constitui um modelo BIM de fabricação nem um fluxo IFC completo. Também não substitui revisão independente, responsabilidade técnica, normas oficiais ou parâmetros licenciados.

Não são objetivos desta versão:

- gerar automaticamente todos os detalhes construtivos exigidos por qualquer norma;
- inferir cobrimento, espaçamento, ancoragem, emendas, dobras ou soldas sem profile aplicável;
- emitir ART/RRT ou assumir responsabilidade profissional;
- prometer equivalência a um modelo BIM autoritativo;
- exportar/importar IFC com mapeamento semântico completo.

## Próxima etapa autorizada

Com a v0.44 fechada e CI verde em `develop`, a próxima etapa do roadmap é **v0.45 — interoperabilidade BIM/IFC**.

A v0.45 deverá ser implementada como camada explícita de interoperabilidade sobre os contratos existentes, com IDs estáveis, unidades, provenance, mapeamento de elementos/materiais/seções, propriedades de análise/dimensionamento/detalhamento e validação round-trip. Nenhuma promoção para `main` deve ocorrer antes da validação do ambiente de desenvolvimento.