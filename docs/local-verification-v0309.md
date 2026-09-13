# AstraStruct v0.30.9 — verificação numérica dos Labs locais (P2)

## Objetivo

A prioridade P2 introduz um *verification harness* independente do kernel mecânico de chapa com furo explícito. O objetivo é impedir que um resultado local seja tratado como convergido apenas porque o Newton-Raphson convergiu. O verificador repete o mesmo problema com discretizações controladas e reporta sensibilidade observável.

## Estudos automáticos

O módulo `web/src/solver/localVerification.js` executa:

1. convergência de malha Q4 (`meshX`, `meshY`);
2. convergência da integração cut-cell (`cutIntegrationOrder`);
3. convergência da discretização angular do contorno (`boundarySegments`);
4. sensibilidade à penalidade normal `k_n`;
5. resíduo de equilíbrio em força;
6. erro de área vazada frente à área circular analítica;
7. erro de simetria para pares espelhados;
8. contabilidade de trabalho externo e energia armazenada nas penalidades de contato.

A energia restante não é rotulada como erro: o kernel atual reúne energia elástica da chapa e dissipação plástica sem separá-las. O relatório declara explicitamente essa limitação.

## Critérios padrão de aviso

Os critérios de qualidade são avisos, não filtros que alteram os resultados: 5% para malha, 2,5% para quadratura cut-cell, 2,5% para discretização angular, 15% para sensibilidade a `k_n`, 0,2% para equilíbrio, 5% para área vazada e 2% para simetria. Todos podem ser sobrescritos pelo chamador.

## Contrato e UI

`runHoleContactVerification()` retorna `local-verification-hole-contact`, versão `0.30.9`, mantendo provenance do solver `connection-plate-hole-contact-2d` v0.30.5. O Lab **Verificação numérica · contato** apresenta indicadores, avisos e tabela de estudos e exporta CSV.

## Gate P2

P2 é considerado fechado quando: smoke test determinístico, typecheck/syntax check, build e regressão de navegador no `develop` estiverem verdes. O módulo não modifica `main` nem altera os kernels v0.30.5.
