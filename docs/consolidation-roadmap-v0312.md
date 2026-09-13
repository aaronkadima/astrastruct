# AstraStruct v0.31.2 — consolidação e sequência obrigatória

## Objetivo

A v0.31.2 é uma versão de consolidação. Ela **não introduz uma nova formulação física** e não antecipa nenhuma capacidade da v0.32 ou posterior. O objetivo é encerrar de forma reproduzível a linha v0.30.9–v0.31.1 antes da troca do núcleo numérico.

## Escopo fechado da v0.31.2

1. manter o gate de smoke tests determinístico, sem descoberta automática de arquivos;
2. recolocar explicitamente no gate obrigatório os benchmarks de:
   - v0.30.9 — verificação numérica local;
   - v0.31.0 — mecânica avançada de ligações;
   - v0.31.1 — RuleEngine e plugins normativos;
3. garantir coerência entre `package.json` e `web/src/core/version.js`;
4. preservar `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0`;
5. consolidar o catálogo central de Labs e remover texto de capacidade desatualizado;
6. manter a separação entre kernels mecânicos e regras normativas;
7. manter dados normativos ausentes como `PENDENTE`, nunca convertidos implicitamente em zero ou aprovação;
8. exigir CI completo verde no `develop` antes de qualquer código v0.32.

## Gate determinístico

O `npm test` deve listar explicitamente os testes obrigatórios. O teste `tests/release-gate-v0312-smoke.mjs` impede que o gate volte a depender de `tests/run-smoke.mjs` ou que P2/P3/P4 desapareçam silenciosamente da validação.

A descoberta automática de todo `*-smoke.mjs` não é usada como critério de release. Testes novos entram no gate somente por inclusão explícita e revisão consciente.

## Contratos congelados

Nesta versão permanecem congelados:

- schema persistido: `2`;
- resultado estrutural: `1.0`;
- `inspection-field/v1`;
- contrato de plugins do RuleEngine da v0.31.1;
- interfaces externas dos solvers existentes.

Mudanças incompatíveis nesses contratos são proibidas na v0.31.2.

## Política das normas

O RuleEngine continua separado da mecânica. AISC/EN/ACI podem executar somente regras cujos parâmetros implementados estejam documentados e testados. Adaptadores ABNT permanecem parametrizados quando coeficientes, equações ou cláusulas não puderem ser verificados publicamente. Nesses casos:

- `resistance = null` quando a resistência não puder ser formada;
- `ok = null`;
- estado apresentado como `PENDENTE`;
- nenhuma resistência normativa é inventada pelo software.

## Cadeia arquitetural obrigatória

A evolução a partir desta consolidação segue a cadeia:

`Numerical Core → DOF/Constraints → Section Engine → Component API → Mesh Engine → Load/Stage Engine → physical solvers → standards → detailing/report → BIM/VNL → AI`

Nenhum bloco posterior deve ser usado para contornar uma lacuna de um bloco anterior.

## Sequência estrita de versões

### v0.31.2–v0.31.x — consolidação

CI, contratos, Labs, RuleEngine, documentação e dívida de frontend. Nenhuma nova família de solver.

### v0.32 — Numerical Core 2

Matriz esparsa, gerenciador de DOFs, constraints/MPC, unidades, estratégias de Newton, tolerâncias e diagnóstico de singularidade.

### v0.33 — Component/Element API

Interface universal de elemento com DOFs, residual, tangente, estado, `commit()` e `rollback()`.

### v0.34 — Section Engine

Seções arbitrárias, fibras, aço, concreto armado e compostas; propriedades geométricas e interação `N–My–Mz`.

### v0.35 — Mesh & Surface Engine

Malha geral, shell, refinamento e acoplamento shell-frame.

### v0.36 — Advanced Element Library

Timoshenko, cabos, links não lineares, offsets e rigid zones.

### v0.37 — Nonlinear RC

Concreto, barras, bond-slip, fissuração, esmagamento e regularização energética.

### v0.38 — Advanced Shells & Contact

Shell não linear e contato geral 2D/3D.

### v0.39 — Connections & Anchors 2

Objetos completos de ligação e acoplamento local-global.

### v0.40 — Load/Stage Engine

Ações, cargas móveis, etapas construtivas, protensão e efeitos dependentes do tempo.

### v0.41 — Nonlinear Dynamics / Seismic

Dinâmica não linear, históricos no tempo, múltiplos apoios e métricas de desempenho.

### v0.42 — Design Actions & Combinations

Gerador de ações, casos e combinações antes das verificações normativas.

### v0.43 — RC / Steel / Foundation Code Design

Dimensionamento normativo por material e fundações, sobre ações já consolidadas.

### v0.44 — Detailing & Professional Reports

Detalhamento e memórias de cálculo profissionais.

### v0.45 — BIM / Interoperability / Professional 3D

Interoperabilidade e visualização profissional.

### v0.46 — Full VNL

Runtime completo do grafo `Geometry → Material → Section → Element → Connection → Boundary → Load → Analysis → Result → RuleCheck`.

### v0.47 — Reliability & Optimization

Confiabilidade, propagação de incerteza e otimização estrutural.

### v0.48+ — AI / Automation / Digital Engineering

Automação, agentes, engenharia digital e integração com Digital Twins somente após os blocos anteriores.

## Gate obrigatório por incremento

Cada versão deve ter, conforme aplicável:

1. formulação e hipóteses documentadas;
2. benchmark determinístico;
3. equilíbrio e/ou convergência;
4. contrato de resultado;
5. visualização coerente com o solver;
6. regressão E2E;
7. `npm run check`, `npm test`, build e Playwright verdes no `develop`;
8. nenhuma promoção automática para `main`.

## Critério de saída da v0.31.2

A v0.31.2 só pode ser considerada encerrada quando o CI do commit final estiver totalmente verde, incluindo `app-and-solver-tests` e `development-browser-regression`.

Somente depois desse gate é permitido iniciar código identificado como v0.32.
