# AstraStruct v0.51 — Automation + Digital Engineering

## Estado de desenvolvimento
A v0.51 é implementada exclusivamente em `develop` sob contratos `0.51.0-exp`. Durante este estágio, `package.json` e `PRODUCT_VERSION` permanecem em 0.50.0; `main` permanece na release publicada até que o gate completo da v0.51 seja aprovado.

## Objetivo
A v0.51 introduz uma camada de automação de engenharia que **reutiliza o mesmo solver público** e os estudos já existentes. Não existe segundo solver, mecanismo paralelo de cálculo ou alteração silenciosa de geometria, materiais, cargas, propriedades normativas ou resultados.

## Contratos
- `engineering-automation/v1`: execução auditável de pipelines explícitos;
- `project-automation-study/v1`: configuração persistente e resumo compacto da última execução;
- `digital-engineering-record/v1`: registro portátil da execução, fingerprint do projeto e evidências;
- `engineering-advisor/v1`: recomendações explicáveis do provider determinístico `astra-rules-v1`.

Todos esses contratos usam versão `0.51.0-exp` enquanto a release não estiver fechada.

## Pipelines explícitos
Os presets são: `analysis-review`, `analysis-reliability`, `analysis-optimization` e `digital-audit`. As etapas disponíveis são `solve`, `advisor`, `reliability`, `optimization` e `snapshot`. Cada etapa declara `id`, `type`, `enabled` e `options`. O usuário pode escolher parar no primeiro erro ou preservar falhas e continuar quando aplicável.

A etapa `solve` chama o mesmo `solve()` do AstraStruct. As etapas `reliability` e `optimization` reutilizam os estudos v0.50 previamente declarados no projeto. A automação não cria variáveis aleatórias, estados limite, objetivos, constraints ou targets por inferência.

## Engineering Advisor explicável
O advisor local `astra-rules-v1` é determinístico, sem chamada externa e sem alegação de decisão normativa autônoma. Cada recomendação contém `ruleId`, severidade, mensagem e justificativa. O provider verifica somente fatos rastreáveis no projeto, como topologia mínima, presença de elementos/apoios/ações, materiais marcados como verificados, bloqueio IFC `analysisReady=false`, disponibilidade de resultado e presença de estudos persistidos.

Essa camada estabelece o contrato de integração para futuros providers de IA, mantendo proveniência e explicabilidade obrigatórias. A v0.51 não envia dados do projeto para serviços externos.

## Digital Engineering Record
Cada execução gera um `digital-engineering-record/v1` contendo:
- identificação e contagens principais do projeto;
- análise/cenário declarados;
- fingerprint determinístico FNV-1a de 32 bits sobre o modelo canônico, excluindo resultados e histórico de automação;
- sequência de etapas, status, erros e resumos compactos;
- provider e resumo do advisor;
- fingerprint da evidência e `recordId`.

O fingerprint é um identificador de integridade leve para rastreabilidade interna, não uma assinatura criptográfica. O registro pode ser exportado como JSON.

## Persistência e interface
`project.automationStudy` preserva a configuração e apenas um resumo compacto da última execução. Resultados estruturais completos, históricos de otimização e amostras probabilísticas não são duplicados dentro do estudo de automação.

O workbench React **Automation + Digital Engineering · v0.51** é acessível pela Biblioteca e por Mais comandos. Ele permite escolher preset/cenário, ativar/desativar etapas, executar, salvar o estudo e exportar o Digital Engineering Record.

## Segurança de engenharia
A automação mantém quatro invariantes: mesmo kernel estrutural; entradas explícitas; nenhuma propriedade normativa implícita; e nenhuma alteração silenciosa do projeto. O advisor é suporte à revisão e não substitui validação independente, responsabilidade profissional ou verificação normativa aplicável.

## Gate antes do fechamento
Antes de promover para `main`, a v0.51 deve passar: check TypeScript/JS; smokes de automação/advisor/registro digital; toda a regressão histórica v0.50 e anteriores; validação IFC externa; build Vite; e Playwright em desktop, Android e tablet. Somente depois o `package.json`, `PRODUCT_VERSION`, bootstrap e health page poderão ser elevados para 0.51.0 e o `release-gate-v051` substituirá o development gate.
