# AstraStruct v0.51 — Automation + Digital Engineering

## Release
A v0.51 está formalmente fechada no branch `develop` com `PRODUCT_VERSION = 0.51.0`. O `PROJECT_SCHEMA_VERSION = 2` e o `RESULT_CONTRACT_VERSION = 1.0` permanecem inalterados. Após aprovação do release gate completo, esta release está pronta para promoção para `main`.

## Objetivo
A v0.51 introduz uma camada de automação e engenharia digital auditável que reutiliza o mesmo kernel estrutural público do AstraStruct. Não existe segundo solver. A camada de automação coordena operações existentes e preserva entradas, proveniência e evidências; ela não cria geometria, materiais, cargas, propriedades normativas, estados limite ou resultados por inferência implícita.

## Contratos
A release introduz os contratos experimentais `engineering-automation/v1`, `project-automation-study/v1`, `digital-engineering-record/v1` e `engineering-advisor/v1`, todos identificados internamente como `0.51.0-exp`. A versão experimental do contrato permite evoluir o formato sem alterar o schema persistido global do projeto.

## Pipelines explícitos
Os presets disponíveis são `analysis-review`, `analysis-reliability`, `analysis-optimization` e `digital-audit`. As etapas disponíveis são `solve`, `advisor`, `reliability`, `optimization` e `snapshot`. Cada etapa declara `id`, `type`, `enabled` e `options`; o usuário controla cenário, sequência habilitada e comportamento de parada em erro.

A etapa `solve` chama o mesmo `solve()` usado pelo restante da plataforma. As etapas `reliability` e `optimization` reutilizam as configurações v0.50 já declaradas em `project.reliabilityStudy` e `project.optimizationStudy`. Não há geração silenciosa de variáveis aleatórias, targets, objetivos, constraints ou valores normativos.

## Engineering Advisor explicável
O provider local `astra-rules-v1` é determinístico, explicável e não utiliza serviço externo. Cada recomendação contém `ruleId`, severidade, título, mensagem e justificativa. As regras inspecionam somente fatos presentes no projeto e nos resultados: topologia mínima, elementos, apoios, ações, materiais marcados como verificados, bloqueio de IFC com `analysisReady=false`, disponibilidade/convergência de resultado e existência de estudos persistidos.

O advisor não substitui revisão de engenharia, verificação normativa, validação independente ou responsabilidade profissional. A v0.51 estabelece apenas uma interface segura para futuros providers, exigindo proveniência e sem alteração silenciosa do modelo.

## Digital Engineering Record
Cada execução pode gerar um `digital-engineering-record/v1` contendo identificação e resumo do projeto, cenário/análise declarados, sequência e status das etapas, erros preservados, resumo do advisor, fingerprint do projeto e fingerprint da evidência. O identificador do projeto usa canonicalização determinística e FNV-1a de 32 bits para rastreabilidade interna; não é apresentado como assinatura criptográfica.

O registro pode ser exportado em JSON. Resultados estruturais completos, amostras Monte Carlo/LHS e históricos integrais de otimização não são duplicados dentro do estudo de automação.

## Persistência e interface
`project.automationStudy` preserva a configuração do pipeline e um resumo compacto da última execução. O workbench React **Automation + Digital Engineering · v0.51** é acessível pela Biblioteca e por Mais comandos. Ele permite escolher preset e cenário, habilitar/desabilitar etapas, executar, salvar o estudo e exportar o Digital Engineering Record.

## Invariantes de engenharia
A v0.51 mantém quatro invariantes: o mesmo kernel estrutural é reutilizado; entradas técnicas permanecem explícitas; nenhuma propriedade normativa é introduzida por inferência; e nenhuma etapa aplica alteração silenciosa ao projeto. Soluções de otimização continuam exigindo ação explícita para aplicação.

## Verificações de release
O fechamento é condicionado a: TypeScript e sintaxe JS; smokes de automação, advisor e registro digital; regressão completa da v0.50 e versões anteriores; validação IFC externa com IfcOpenShell e regras EXPRESS IFC4X3; build Vite; validação do artefato GitHub Pages; e Playwright em desktop, Android e tablet.

A promoção para `main` deve utilizar exatamente o commit aprovado por esses gates, preservando o canal `/astrastruct/dev/` para desenvolvimento e `/astrastruct/` para produção.
