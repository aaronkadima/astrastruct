# AstraStruct v0.22 — rótulas concentradas cíclicas de fibras

## Escopo

A v0.22 estende as rótulas concentradas de seção de fibras de aço para análise quase-estática reversível por controle de deslocamento. As famílias suportadas permanecem `rect`, `i`/`h` e `rhs`. O caminho cíclico exige o protocolo de deslocamentos e o acoplamento constitutivo embutido.

## Lei por fibra

Cada fibra usa plasticidade uniaxial incremental bilinear com retorno plástico e endurecimento combinado linear. A fração `eta` (`kinematicFraction`) reparte o módulo de endurecimento entre componentes cinemática e isotrópica; `eta=1` representa endurecimento cinemático linear e reproduz o efeito Bauschinger sem introduzir degradação.

Variáveis internas comprometidas incluem deformação plástica, backstress, deformação plástica equivalente, energia dissipada e contador diagnóstico de reversões da própria fibra. O contador de reversões não é equivalente ao número de reversões do deslocamento global.

## Equilíbrio N–M

Para a rotação relativa da rótula `theta`, a curvatura é `kappa=theta/Lp`. A deformação axial de referência `epsilon0` é iterada até reproduzir o esforço normal do elemento. A tangente rotacional a N constante é obtida pelo complemento de Schur da matriz tangente seccional e inserida na ligação por linearização tangente-afim.

## Commit / rollback

Durante Newton, derivadas de carga e line search, todas as avaliações consultam o histórico comprometido do último incremento convergido. O `historyTrial` calculado em estados tentativos não altera a memória. Somente após convergência global o histórico de cada rótula é promovido; em seguida o resíduo é reavaliado com o estado comprometido.

Esse mecanismo foi validado comparando um ciclo com reversões a uma única excursão que termina no mesmo deslocamento: o ciclo deve acumular energia dissipada superior, demonstrando persistência da trajetória entre incrementos.

## Saídas

A resposta v0.22 reporta, por rótula, energia dissipada acumulada, máxima deformação plástica equivalente, backstress máximo e reversões máximas por fibra, além dos resíduos locais N–M. O laço global `lambda-u` continua sendo apresentado como trajetória numérica do padrão de carga.

## Limitações

Não estão implementados Armstrong–Frederick, pinching, degradação de rigidez ou resistência, dano, fratura, flambagem local, fadiga de baixo ciclo, concreto cíclico ou dinâmica no domínio do tempo. Portanto, a v0.22 não deve ser interpretada como modelo calibrado de fadiga ou procedimento normativo sísmico.
