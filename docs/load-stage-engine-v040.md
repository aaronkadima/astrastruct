# AstraStruct v0.40 — Load/Stage Engine

## Escopo

A v0.40 introduz o contrato **`load-stage-engine/v1`** como camada explícita entre o modelo estrutural e os solvers. O objetivo é organizar ações, cargas móveis, estágios construtivos, protensão e efeitos dependentes do tempo sem embutir coeficientes normativos ou combinações de projeto.

A arquitetura opera sobre snapshots do projeto e preserva o schema persistido existente. As ações compiladas alimentam os campos já suportados (`loads`, `elementLoads` e `settlements`) e carregam `actionId`/`caseId` para rastreabilidade.

> Importante: fatores normativos e combinações de ações não pertencem à v0.40. Eles permanecem reservados à v0.42 — Design Actions & Combinations.

## Contratos

- `load-stage-engine/v1` — facade do engine;
- `load-action/v1` — compilação de ações;
- `moving-load/v1` — trajetória e posicionamento de veículos/cargas móveis;
- `construction-stages/v1` — snapshots cumulativos de construção;
- `prestress-action/v1` — estado inicial de protensão;
- `time-dependent-effects/v1` — fluência, retração, relaxação e módulo efetivo parametrizados pelo usuário.

A versão interna do engine é `0.40.0-exp`.

## Action Engine

`compileActionSet()` recebe um projeto, uma lista de ações e o conjunto de ações ativas. A compilação é imutável: o projeto de entrada não é modificado.

Tipos de ação suportados:

- `nodal`: forças e momentos nodais;
- `element`: ações de elemento já reconhecidas pelos kernels (`uniform`, `point`, `selfWeight`, `thermal`, `followerEnd` e `prestress`);
- `settlement`: deslocamentos/recalques prescritos;
- `prestress`: protensão tratada como deformação inicial generalizada;
- `moving`: veículo/carga móvel avaliado numa posição da trajetória.

O atributo `scale` é apenas um multiplicador explícito de cenário. Ele não representa fator parcial de segurança nem combinação normativa.

## Moving Load Engine

Uma trajetória é uma sequência ordenada de elementos `frame2d` ou `frame3d`. O engine calcula a estação acumulada e mapeia cada eixo do veículo para o elemento e a coordenada adimensional `xi`.

A posição do veículo corresponde à estação do eixo de referência/dianteiro. Um `axle.offset > 0` posiciona o eixo atrás do eixo de referência.

Para cada eixo ativo, o engine gera uma carga pontual de elemento. Quando o usuário fornece somente o escalar `load`, a direção padrão é vertical global:

- `frame2d`: direção global `-Y`;
- `frame3d`: direção global `-Z`.

Também é possível informar `globalForce=[Fx,Fy,Fz]`, que é convertido ao sistema local do elemento.

O benchmark verifica conservação da carga total, transição entre elementos e a convenção de estação no nó comum entre dois trechos.

## Construction Stage Engine

`buildConstructionStageSnapshots()` mantém conjuntos cumulativos de:

- elementos ativos;
- apoios ativos;
- ações ativas.

Cada estágio pode ativar ou desativar qualquer um desses conjuntos e possui `durationDays`. O snapshot resultante contém um projeto filtrado e as ações compiladas naquele estado.

A construção do snapshot não executa automaticamente um solver nem transfere tensões residuais entre kernels. Essa separação é intencional: o engine define estados de análise reproduzíveis; a estratégia de solução incremental utiliza esses snapshots explicitamente.

## Protensão

A protensão é tratada como **deformação inicial**, não como um par artificial de forças externas.

### Frame 2D

Para força efetiva `P` e excentricidade `e`:

`eps0 = -P/(E A)`

`kappa0 = P e/(E I)`

O vetor local equivalente conjugado é construído a partir de `N0=EA eps0` e `M0=EI kappa0` e integrado diretamente em `prepareFrameElement()`.

### Frame 3D co-rotacional

Para excentricidades locais `ey` e `ez`:

`eps0 = -P/(EA)`

`My = P ez`

`Mz = -P ey`

`kappaY = My/(E Iy)`

`kappaZ = Mz/(E Iz)`.

O kernel co-rotacional 3D já possuía variáveis de deformação inicial térmica (`eps0`, `kappaY`, `kappaZ`). Para evitar duplicação constitutiva, a v0.40 mapeia a protensão exatamente para essas mesmas variáveis internas por equivalência cinemática. O resultado é a mesma deformação inicial generalizada, mantendo a protensão separada e rastreável via `sourceKind:'prestress'`.

O parâmetro `effectiveFactor` permite ao usuário informar uma força já reduzida por perdas conhecidas. Nenhuma perda normativa é calculada implicitamente.

## Efeitos dependentes do tempo

O contrato `time-dependent-effects/v1` fornece leis genéricas, explícitas e parametrizadas pelo usuário. Nenhum coeficiente de ACI, Eurocode, fib ou ABNT é embutido.

### Fluência

A evolução adotada é uma função assintótica configurável:

`phi(t) = phi_inf [1-exp(-Delta t/tau)]^m`.

### Retração

A mesma família assintótica é usada para a deformação de retração, preservando o sinal informado pelo usuário:

`eps_sh(t) = eps_sh,inf [1-exp(-Delta t/tau)]^m`.

### Relaxação da protensão

A perda relativa é parametrizada por um limite assintótico:

`loss(t) = loss_inf [1-exp(-Delta t/tau)]^m`

`P_eff(t) = P0 [1-loss(t)]`.

### Módulo efetivo ajustado pela idade

Como utilitário mecânico:

`E_eff = E / (1 + chi phi)`

com `chi` fornecido explicitamente pelo usuário.

Essas relações são modelos de engenharia configuráveis, não prescrições normativas automáticas.

## Verificação determinística

`tests/load-stage-engine-v040-smoke.mjs` verifica:

- conservação e localização de cargas móveis em trajetória com múltiplos elementos;
- compilação imutável e escalonamento explícito de ações;
- ativação/desativação cumulativa de elementos, apoios e ações;
- evolução correta do tempo entre estágios;
- deformações iniciais de protensão 2D;
- integração da protensão no kernel `frame2d`;
- equivalência exata da protensão 3D com as variáveis de deformação inicial do kernel co-rotacional;
- origem, monotonicidade e limite assintótico das leis de fluência/retração/relaxação;
- módulo efetivo ajustado pela idade.

## Limitações declaradas

- o Stage Engine produz snapshots; não transfere automaticamente tensões/históricos entre solvers ainda não stage-aware;
- ativação/desativação de elementos não simula, por si só, operações de birth/death dentro de uma única matriz global incremental;
- carga móvel é avaliada em posições discretas; envelope e otimização de posição são camadas consumidoras;
- veículos não possuem interação dinâmica veículo–estrutura nesta versão;
- protensão utiliza excentricidade constante por elemento; perfil parabólico/cabo discretizado deve ser representado por elementos/ações sucessivos;
- perdas de protensão dependentes do tempo são fornecidas por modelo genérico parametrizado; nenhuma norma é aplicada silenciosamente;
- fluência e retração não substituem um modelo viscoelástico integral de Kelvin/Maxwell;
- combinações normativas continuam fora do engine e pertencem à v0.42;
- **v0.41 — Nonlinear Dynamics/Seismic** é a próxima etapa e não é antecipada nesta versão.
