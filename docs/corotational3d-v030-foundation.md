# AstraStruct v0.30 — co-rotacional 3D experimental

## Estado

A v0.30 implementa a primeira análise geometricamente não linear espacial do AstraStruct para elementos `frame3d`. O kernel permanece **experimental** na branch `develop`; a produção em `main` continua preservando os solvers 3D consolidados linear, modal/flambagem e P-Delta.

O estágio atual já ultrapassou a fundação cinemática inicial: há equilíbrio global incremental, cargas de barra conservativas, peso próprio, ações térmicas, imperfeição modal sem tensões, força seguidora concentrada espacial e montagem numérica da Jacobiana por elemento.

## Cinemática co-rotacional

Para cada elemento, a formulação separa movimento rígido e deformação local:

1. a configuração inicial fornece o triedro local `C0 = [ex0 ey0 ez0]`;
2. translações nodais atualizam a corda `x2 - x1`;
3. rotações nodais globais são convertidas por Rodrigues para matrizes em SO(3);
4. o eixo `ex` acompanha a corda corrente;
5. `ey` é obtido pela projeção da média dos eixos `ey0` rotacionados nas duas extremidades no plano normal à corda;
6. `ez = ex × ey` completa o triedro ortonormal corrente `C`;
7. as rotações deformacionais são extraídas de `Rrel,i = C^T Qi C0` e `Rrel,j = C^T Qj C0` pelo logaritmo de SO(3).

Assim, translação e rotação rígidas comuns aos dois nós não geram deformações básicas espúrias. O vetor básico é

`vb = [ΔL, θix, θiy, θiz, θjx, θjy, θjz]`.

## Lei elástica e ações térmicas

O estágio atual usa viga espacial Euler-Bernoulli elástica:

`N = EA/L0 · (ΔL - εT L0)`

`Ti = GJ/L0 (θix - θjx)`

com flexão nos dois planos principais pela relação clássica `4EI/L0 – 2EI/L0`. As forças cortantes são recuperadas por equilíbrio no comprimento corrente.

A ação térmica é tratada como deformação inicial. O incremento uniforme produz `εT = α ΔT`; gradientes nos eixos locais produzem curvaturas iniciais nos planos correspondentes. Durante o carregamento incremental, o estado térmico avança com o mesmo fator de carga `λ`.

## Equilíbrio global e montagem da Jacobiana

A solução usa Newton-Raphson incremental de carga. A Jacobiana interna continua sendo uma aproximação por diferenças finitas,

`Kint ≈ ∂Fint/∂q`,

mas a v0.30 não precisa mais reprocessar o modelo completo para cada grau de liberdade global. Cada `frame3d` é diferenciado em seus 12 graus de liberdade e a matriz 12×12 resultante é montada diretamente na Jacobiana global.

Para diferença central, o custo dominante passa de uma reassemblagem global repetida, aproximadamente proporcional a `2 · ndof · nelem`, para `24 · nelem` avaliações de força elementar. Em estruturas com muitos nós essa alteração reduz substancialmente o custo sem mudar a definição matemática da derivada.

O mesmo passo de perturbação usado anteriormente é preservado, e existe um teste de regressão que compara a nova montagem elemento a elemento com a definição global por diferenças finitas, tanto no esquema central quanto no forward.

O line search é aplicado ao incremento de Newton e os resíduos são avaliados somente nos graus de liberdade livres.

## Cargas conservativas de barra

O pré-processador `corotational3dLoads.js` transforma ações conservativas na configuração de referência em vetores nodais equivalentes globais fixos:

- carga uniforme local `qx/qy/qz`;
- carga pontual local interior `px/py/pz` em `xi`;
- peso próprio global `-Z`, calculado por `γ A`.

A recuperação de esforços de extremidade desconta os vetores de forças fixas correspondentes, preservando cortantes e momentos de engastamento para pós-processamento.

## Imperfeição modal sem tensões

A imperfeição geométrica proveniente da flambagem linear 3D pode ser usada como geometria inicial de referência. A forma modal selecionada é escalada para a amplitude `e0` definida pelo usuário e não introduz tensões iniciais artificiais.

O resultado distingue a geometria imperfeita inicial, o incremento `Δu` e a configuração total usada para visualização.

## Força seguidora espacial

A v0.30 aceita `followerEnd` concentrada na **extremidade 2** do `frame3d`, com componentes locais `Px/Py/Pz`.

A força permanece ligada ao triedro co-rotacionado corrente. Portanto,

`Ff(q) = C(q) · Pf,local`

é dependente da configuração. Sua Jacobiana externa é obtida por diferença central,

`Kext ≈ ∂Ff/∂q`,

mas somente os elementos que possuem carga follower são diferenciados. Cargas follower coincidentes no mesmo elemento são agrupadas antes da diferenciação.

O Newton usa a tangente efetiva não conservativa

`Keff = Kint - λ Kext`

para o resíduo

`R(q,λ) = λ [Fdead + Ff(q)] - Fint(q)`.

Como esperado para uma ação não conservativa, `Keff` não precisa ser simétrica. Momentos seguidores e follower distribuída permanecem explicitamente fora do escopo.

## Validações implementadas

- objetividade a translação rígida;
- objetividade a rotação rígida finita arbitrária;
- ida e volta Rodrigues/log de SO(3);
- extensão axial pura e limite `u = PL/EA`;
- flexão nos dois planos e torção relativa;
- convergência para a solução linear 3D sob cargas pequenas;
- resposta de segunda ordem comparada com o P-Delta em regime compatível;
- equilíbrio de reações em carregamento espacial;
- carga uniforme e pontual de barra com recuperação de esforços;
- peso próprio e resultados de teoria de vigas no limite linear;
- ações térmicas uniformes e gradientes, inclusive em combinações de carga;
- imperfeição modal como referência sem tensões;
- força follower sob rotação rígida finita;
- limite de pequena carga follower;
- não simetria da Jacobiana externa follower;
- equivalência da Jacobiana interna elemento a elemento com a definição global por diferenças finitas;
- equivalência da Jacobiana follower esparsa com a definição global;
- integração ao dispatcher, SolverRegistry, painel 3D e regressão E2E desktop/Android/tablet.

## Escopo aceito atualmente

- modelos puros `frame3d`;
- material linear-elástico;
- grandes translações e rotações;
- cargas nodais globais;
- cargas uniformes e pontuais locais de barra;
- peso próprio global `-Z`;
- ações térmicas uniformes e gradientes locais;
- imperfeição modal 3D sem tensões;
- follower concentrada na extremidade 2, `Px/Py/Pz` local;
- apoios homogêneos com valores prescritos nulos;
- controle incremental de carga;
- Newton-Raphson com line search.

## Escopo ainda protegido

- momentos seguidores e follower distribuída;
- molas nodais e recalques;
- releases e ligações semirrígidas espaciais;
- controle de deslocamento e Arc-Length 3D;
- plasticidade material, rótulas e plasticidade distribuída 3D;
- contato, flambagem local e dano/fadiga.

## Próxima sequência

1. comparar a Jacobiana numérica elemento a elemento com uma tangente co-rotacional analítica/consistente e introduzir a versão analítica somente após equivalência de benchmarks;
2. adicionar reutilização/caching seguro de propriedades invariantes por elemento para reduzir custo por iteração;
3. generalizar releases e ligações semirrígidas espaciais;
4. implementar controle de deslocamento e Arc-Length 3D;
5. posteriormente introduzir não linearidade material 3D e estabilidade pós-crítica mais completa;
6. somente promover a v0.30 para `main` após benchmarks e regressões de produção permanecerem verdes.
