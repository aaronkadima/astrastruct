# AstraStruct v0.21 — História constitutiva cíclica e histerese

## Escopo

A v0.21 estende a plasticidade distribuída de aço da v0.20 para trajetórias com reversão de deformação. A formulação geométrica permanece co-rotacional Euler–Bernoulli e a integração espacial permanece displacement-based com 3 ou 5 pontos Gauss–Lobatto. A novidade é a memória constitutiva incremental em cada fibra.

Esta versão é experimental e deve ser validada independentemente antes de qualquer uso profissional.

## Lei constitutiva 1D

Para cada fibra, o estado comprometido contém deformação plástica `εp`, backstress `α`, deformação plástica equivalente `p`, tensão/deformação anteriores e energia dissipada acumulada.

O preditor elástico é

`σtr = E (ε - εp_n)`

`ξtr = σtr - α_n`

com função de escoamento

`ftr = |ξtr| - (fy + Hiso p_n)`.

Se `ftr <= 0`, a resposta é elástica e a tangente é `E`.

Quando `ftr > 0`, aplica-se retorno plástico 1D:

`Δγ = ftr / (E + Hkin + Hiso)`

`εp_(n+1) = εp_n + Δγ sign(ξtr)`

`α_(n+1) = α_n + Hkin Δγ sign(ξtr)`

`p_(n+1) = p_n + Δγ`

`σ_(n+1) = σtr - E Δγ sign(ξtr)`.

A razão de encruamento `b = Et/E` é convertida no módulo plástico equivalente

`H = E b / (1-b)`.

O parâmetro `η` distribui esse módulo entre endurecimento cinemático e isotrópico:

`Hkin = η H`

`Hiso = (1-η) H`.

O valor padrão `η=1` corresponde a endurecimento cinemático linear puro e produz translação da superfície de escoamento, permitindo representar o efeito Bauschinger de forma explícita e simples.

## Integração distribuída

Em cada ponto Gauss–Lobatto são calculados `ε0` e `κ`; a deformação de cada fibra é

`ε(y) = ε0 - κ y`.

Cada fibra consulta apenas seu estado comprometido. O estado resultante da avaliação é um estado de tentativa. As resultantes seccionais e a tangente são integradas normalmente para produzir

`q = ∫ Bᵀ s dx`

`kb = ∫ Bᵀ D B dx`.

Os resultados passam a incluir, por seção integrada, deformação plástica equivalente máxima, backstress máximo e incremento de energia dissipada.

## Commit / rollback

A consistência do histórico material é tratada explicitamente:

1. todas as avaliações de Newton, derivada de carga e line search partem do mesmo estado material comprometido do último incremento convergido;
2. estados de tentativa não modificam a memória permanente;
3. somente após convergência do equilíbrio global o `historyTrial` é promovido a estado comprometido;
4. uma tentativa rejeitada por line search, uma iteração intermediária ou um passo não convergido não deixa deformação plástica residual artificial.

Essa separação é necessária para que a resposta histerética seja independente da sequência interna de tentativas numéricas.

## Protocolo cíclico de deslocamento

A v0.21 reutiliza o sistema aumentado do controle de deslocamento. O usuário fornece uma sequência de picos, por exemplo

`-20 mm → +20 mm → -40 mm → +40 mm → 0`.

Cada trecho é subdividido linearmente pelo número configurado de passos. O fator do padrão de carga `λ` continua sendo incógnita e o deslocamento selecionado é imposto em cada incremento.

O caminho `λ-u` passa a representar um laço histerético global quando há dissipação material.

## Energia dissipada

A dissipação plástica incremental de cada fibra é acumulada de forma não negativa. A integração por área e por comprimento fornece um indicador energético agregado por elemento e pelo modelo. Na v0.21 essa grandeza é diagnóstica; não é usada ainda como variável de dano ou critério de fadiga.

## Validação

A regressão v0.21 inclui:

- ciclo uniaxial com plastificação, descarga, tensão residual e plastificação reversa;
- verificação de backstress e efeito Bauschinger;
- integração distribuída com memória entre reversões de curvatura;
- energia dissipada positiva após ciclo plástico;
- cantilever S355 com protocolo de deslocamento reversível, retorno final próximo de `u=0` e memória material preservada;
- toda a regressão estrutural das versões anteriores.

## Limitações

A v0.21 não implementa Armstrong–Frederick, degradação de rigidez/resistência, pinching, fratura, flambagem local, dano acumulado, fadiga de baixo ciclo, concreto cíclico, dinâmica/inércia ou análise no domínio do tempo. Também não aplica ainda a história cíclica às rótulas concentradas de fibras; o recurso é implementado inicialmente na plasticidade distribuída de aço.
