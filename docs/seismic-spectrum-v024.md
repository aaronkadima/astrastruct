# AstraStruct v0.24 — excitação sísmica e espectro de resposta

## Escopo
A v0.24 amplia o núcleo dinâmico linear-elástico da v0.23 com movimento uniforme da base e análise modal por espectro derivado de um acelerograma. A formulação continua restrita a modelos `frame2d`/`truss2d` compatíveis com o núcleo modal.

## Excitação de base
Para coordenadas relativas, a equação é

`M u¨ + C u˙ + K u = -M r a_g(t)`

onde `r` é o vetor de influência da direção global X ou Y. O acelerograma é informado em `g` e convertido internamente por `g0 = 9.80665 m/s²`. A integração usa Newmark average-acceleration (`β=1/4`, `γ=1/2`) e amortecimento de Rayleigh.

O registro deve iniciar em `t=0` com aceleração zero nesta versão. A interface aceita pares `t:a[g]` e arquivo CSV de duas colunas `tempo, aceleração[g]`.

## Espectro do acelerograma
Para cada período `T`, resolve-se um oscilador SDOF unitário:

`z¨ + 2 ξ ω z˙ + ω² z = -a_g(t)`

com `ω=2π/T`. A ordenada primária é `Sd=max|z|`; a v0.24 reporta os pseudo-espectros

`Sv = ω Sd`

`Sa = ω² Sd`.

`Sa/g0` é mostrado em `g`. O PGA é obtido diretamente do registro e não deve ser confundido com `Sa(T)`.

## Resposta modal estrutural
Os modos são normalizados por massa. Na direção selecionada, cada modo usa o fator de participação `Γ_i` e a demanda espectral no período modal:

`q_i,max = Γ_i Sd(T_i)`.

A contribuição nodal do modo é `u_i = φ_i q_i,max`.

## SRSS e CQC
SRSS usa

`R = sqrt(Σ R_i²)`.

Para CQC com amortecimento modal uniforme, a correlação entre modos `i,j` é

`ρ_ij = 8 ξ² (1+r) r^(3/2) / [(1-r²)² + 4 ξ² r (1+r)²]`,

com `r=min(ω_i,ω_j)/max(ω_i,ω_j)`, e

`R = sqrt(Σ_i Σ_j ρ_ij R_i R_j)`.

CQC é preferível quando há frequências próximas; SRSS é mantido para modos suficientemente separados.

## Validação automática
- equivalência entre movimento de base de um sistema 1DOF e a força inercial `-M r a_g`;
- coerência `Sa=ω²Sd` e `Sv=ωSd`;
- simetria e identidade diagonal do coeficiente CQC;
- coincidência SRSS=CQC em benchmark com um único modo participante;
- regressão completa dos testes v0.11–v0.23;
- E2E do fluxo aceleração de base → pós-processamento → espectro → CQC.

## Limitações
Ainda não estão implementados: espectros normativos de projeto, múltiplos apoios/movimento diferencial, componentes simultâneas X+Y, combinação direcional normativa, correção/baseline/filtering do acelerograma, análise dinâmica não linear, amortecimento histerético, contato e interação solo-estrutura dinâmica. O usuário deve preparar e validar o acelerograma antes da importação.
