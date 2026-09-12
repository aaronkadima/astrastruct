# AstraStruct v0.30 — fundação co-rotacional 3D

## Estado

A v0.30 inicia a análise geometricamente não linear espacial para elementos `frame3d`. Nesta etapa, o kernel é **experimental** e permanece na branch de desenvolvimento. A produção continua usando os solvers 3D consolidados linear, modal/flambagem e P-Delta v0.29.

## Cinemática co-rotacional

Para cada elemento, a formulação separa movimento rígido e deformação local:

1. a configuração inicial fornece o triedro local `C0 = [ex0 ey0 ez0]`;
2. translações nodais atualizam a corda `x2 - x1`;
3. rotações nodais globais são convertidas por Rodrigues para matrizes em SO(3);
4. o novo eixo `ex` acompanha a corda corrente;
5. `ey` é obtido pela projeção da média dos eixos `ey0` rotacionados nas duas extremidades sobre o plano normal à corda;
6. `ez = ex × ey` completa o triedro ortonormal corrente `C`;
7. as rotações deformacionais de extremidade são extraídas de

`Rrel,i = C^T Qi C0`

`Rrel,j = C^T Qj C0`

pela aplicação logarítmica de SO(3).

Com isso, uma translação ou rotação rígida comum aos dois nós não produz deformações básicas espúrias.

O vetor básico experimental é

`vb = [ΔL, θix, θiy, θiz, θjx, θjy, θjz]`.

## Lei elástica inicial

O estágio atual usa Euler-Bernoulli elástico:

`N = EA/L0 · ΔL`

`Ti = GJ/L0 (θix - θjx)`

com momentos de extremidade nos dois planos obtidos pela matriz clássica `4EI/L0 – 2EI/L0`. As forças cortantes são recuperadas pelo equilíbrio no comprimento corrente.

As forças locais são transformadas para o sistema global usando o triedro co-rotacionado corrente.

## Equilíbrio global

Foi acrescentado um Newton-Raphson incremental de carga para modelos puros `frame3d`. Nesta fundação, a tangente global é obtida por diferenciação numérica das forças internas:

`Kt ≈ ∂Fint/∂q`.

Essa opção é deliberadamente mais lenta, porém reduz o risco de introduzir uma tangente analítica incorreta antes de validar a cinemática espacial. A substituição por uma tangente consistente fechada é a próxima etapa de desempenho e robustez.

## Validações já implementadas

- objetividade a translação rígida;
- objetividade a rotação rígida finita arbitrária;
- ida e volta Rodrigues/log de SO(3);
- extensão axial pura;
- rotação de corda com flexão local;
- torção relativa entre extremidades;
- limite axial `u = PL/EA`;
- convergência para a solução linear 3D sob carga transversal pequena em ambos os planos;
- equilíbrio de reações para carregamento espacial moderado;
- integração experimental ao dispatcher e ao SolverRegistry.

## Escopo protegido atual

Aceito:

- elementos puros `frame3d`;
- elasticidade linear de material;
- cargas nodais globais;
- apoios homogêneos com valores prescritos nulos;
- controle incremental de carga;
- Newton-Raphson com line search;
- grandes deslocamentos/rotações no nível cinemático.

Ainda rejeitado explicitamente:

- cargas distribuídas/de barra;
- peso próprio no co-rotacional 3D;
- follower loads 3D;
- molas nodais e recalques;
- releases e ligações semirrígidas espaciais;
- imperfeição modal no co-rotacional 3D;
- controle de deslocamento e Arc-Length 3D;
- plasticidade material, rótulas e plasticidade distribuída 3D.

## Próxima sequência

1. substituir/validar a tangente numérica pela tangente co-rotacional consistente;
2. adicionar vetor de cargas de barra de referência e peso próprio;
3. incorporar imperfeição modal v0.29 como geometria inicial sem tensões;
4. follower loads espaciais e matriz externa não conservativa;
5. liberar o modo 3D no painel de análise somente após os benchmarks anteriores permanecerem verdes;
6. posteriormente introduzir controle de deslocamento/Arc-Length e não linearidade material 3D.
