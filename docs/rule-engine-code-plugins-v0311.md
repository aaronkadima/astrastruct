# AstraStruct v0.31.1 — P4: RuleEngine normativo versionado

## Princípio de arquitetura

Os solvers mecânicos e as regras normativas permanecem desacoplados. O solver fornece demanda, estados e campos; o `RuleEngine` calcula verificações de norma e sempre retorna edição, provenance, equação, parâmetros, demanda, resistência, utilização e status.

Contrato: `rule-result/v1`.

## Pacotes registrados

### ANSI/AISC 360-22

ID: `aisc-360-22-connections`.

Escopo implementado: cisalhamento e tração de parafusos, interação cisalhamento–tração, bearing, tear-out, ruptura de seção líquida e block shear. O perfil usa LRFD por padrão e mantém fatores/coeficientes que dependem da condição do furo explicitamente configuráveis.

A edição 2022 é a especificação corrente indicada pela página de Current Standards da AISC; errata da primeira impressão emitida em janeiro de 2025 deve ser considerada pelo usuário/projeto.

### EN 1993-1-8:2024

ID: `en-1993-1-8-2024-connections`.

Escopo: resistência de parafusos ao cisalhamento e à tração, bearing, interação cisalhamento–tração e block tearing. `γM2`, `γM0`, `αv`, `k2`, `k1`, `αb` e fatores de caso permanecem explícitos para permitir National Annex/perfil de projeto.

A BSI lista BS EN 1993-1-8:2024 como atual e publicada em março de 2024. Existe projeto de emenda A1 em 2026; ele não é incorporado silenciosamente neste plugin.

### ACI CODE-318-25

ID: `aci-318-25-punching-anchors`.

Escopo: punção sem armadura transversal pela menor das três expressões de `vc`; verificação opcional da tensão máxima no perímetro; ruptura do cone de concreto em tração; ruptura do aço do chumbador; e adaptador de breakout de borda em cisalhamento.

Para breakout em tração no sistema SI, o perfil usa `Nb = kc λa sqrt(f'c) hef^1.5`, com `kc` explícito/ajustável. Fatores ψ, áreas projetadas e φ permanecem no input. Para breakout de borda em cisalhamento, `Vb` básico deve ser fornecido pelo perfil geométrico aplicável quando a equação completa/licenciada não foi verificada publicamente.

ACI CODE-318-25 foi publicado em 2025 e inclui requisitos de ancoragem mecânica/adesiva.

### ABNT NBR 8800:2024 Versão Corrigida:2025

ID: `nbr-8800-2024vc2025-connections`.

Escopo de integração: parafuso em cisalhamento/tração, bearing, tear-out, seção líquida e block shear.

A ABNT comercializa a edição vigente. Como o texto técnico completo é licenciado, o plugin **não copia nem inventa coeficientes**. Ele aceita: (a) resistência de cálculo obtida pelo perfil/cópia licenciada; ou (b) coeficiente, resistência do material, área, número de planos e γ transcritos pelo usuário. Sem esses dados, o check retorna `PENDENTE`.

### ABNT NBR 6118:2026

ID: `nbr-6118-2026-punching`.

Escopo inicial P4: punção. O plugin recebe `vRd` + perímetro efetivo + `d`, ou diretamente a resistência de cálculo obtida conforme a edição licenciada. Sem parâmetro normativo, o status é `PENDENTE`.

O catálogo ABNT identifica ABNT NBR 6118:2026 e ABNT NBR 8800:2024 Versão Corrigida:2025 como edições atuais.

## Regra de segurança normativa

`PENDENTE` é semanticamente distinto de `NÃO OK` e `OK`. Ausência de coeficiente/cláusula licenciada nunca é convertida em aprovação. Esse comportamento faz parte do teste automatizado.

## Benchmarks determinísticos

- AISC block shear: `Fy=345 MPa`, `Fu=450 MPa`, `Agv=1800 mm²`, `Anv=1200 mm²`, `Ant=400 mm²`, `Ubs=1`, `φ=0.75` → `φRn=378 kN`.
- EN 1993 M20 8.8 em um plano roscado: `fub=800 MPa`, `As=245 mm²`, `αv=0.6`, `γM2=1.25` → `Fv,Rd=94.08 kN`.
- ACI punching: `fc'=25 MPa`, `b0=3468 mm`, `d=417 mm`, `β=1`, `αs=40`, `φ=0.75` → `vc=1.65 MPa`, `φVc=1789.61805 kN`.
- ACI concrete breakout: benchmark verifica diretamente a expressão SI de `Nb`.
- NBR: testes verificam tanto resistência parametrizada quanto estado `PENDENTE`.

## Fontes de edição/status

- AISC Current Standards — ANSI/AISC 360-22 e página de Revisions and Errata.
- American Concrete Institute — ACI CODE-318-25, publicação 2025.
- BSI Knowledge — BS EN 1993-1-8:2024 e BS EN 1992-1-1:2023.
- ABNT Catálogo — ABNT NBR 6118:2026 e ABNT NBR 8800:2024 Versão Corrigida:2025.

## Limitações deliberadas

O RuleEngine ainda não é um substituto da leitura integral da norma, do National Annex ou da responsabilidade do projetista. Tabelas proprietárias, categorias específicas de furos, fatores dependentes de fabricação/instalação, condições sísmicas e exceções de cláusula devem ser fornecidos por perfis normativos rastreáveis. Novas edições deverão ser adicionadas como novos RuleSets em vez de alterar silenciosamente os resultados das edições existentes.
