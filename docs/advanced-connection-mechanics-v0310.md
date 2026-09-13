# AstraStruct v0.31.0 — P3: mecânica avançada de ligações

## Escopo

P3 amplia a mecânica sem introduzir resistências normativas dentro dos solvers. Todos os parâmetros resistentes permanecem mecânicos/experimentais ou definidos pelo usuário. As verificações de norma pertencem ao RuleEngine (P4).

## 1. Slip-critical → bearing

`connectionSlipBearing2d.js` usa placa rígida no plano com três graus de liberdade. Cada parafuso possui uma mola de interface com limite de deslizamento

`R_slip = μ · F_preload · n_slip · h_hole`

seguida de atrito limitado e bearing radial unilateral após `r > gap`. O bearing pode ser elástico ou bilinear. A solução é incremental por Newton-Raphson e registra o primeiro slip e o primeiro contato de bearing.

## 2. T-stub / prying fora do plano

`tstubPrying1d.js` modela uma faixa efetiva da flange por dois elementos de viga de Euler–Bernoulli. A junção com a alma recebe uplift imposto e rotação nula; o parafuso é uma mola axial unilateral bilinear e o toe é contato unilateral por penalidade. O resultado fornece tração aplicada, tração no parafuso, reação de prying e equilíbrio vertical.

## 3. Dano e ovalização permanente

`holeBearingDamage1d.js` é um modelo local cíclico reduzido. O contato bilateral tem folga, plasticidade bilinear por lado e memória plástica separada. A soma das indentações plásticas opostas é reportada como ovalização permanente. Um dano escalar reduz progressivamente a rigidez de bearing no recarregamento. Não representa trinca/rasgamento 2D.

## 4. Interação aço–aderência–concreto

`anchorConcreteInteraction.js` associa em série rigidezes de aço, aderência e concreto. O pico é governado pelo menor limite mecânico informado; após o pico, o componente governante recebe o ramo de amolecimento. O `edgeFactor` é apenas um modificador mecânico de entrada. Nenhum cone/borda normativo é calculado neste solver.

## Interface e regressão

Quatro Labs são registrados pelo `LabRegistry`: **Ligação · slip → bearing**, **Ligação · T-stub / prying**, **Furo · dano / ovalização** e **Chumbador · interação concreto**. As curvas são SVG e derivadas diretamente dos resultados dos kernels.

P3 só é encerrado após smoke tests, typecheck/syntax, build e Playwright no `develop`.
