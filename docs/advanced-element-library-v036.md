# AstraStruct v0.36 — Advanced Element Library

## Escopo

A v0.36 amplia a `Component/Element API` sem criar um solver monolítico. Os novos kernels são componentes independentes, montáveis pelo `element-assembly/v1` sobre o `Numerical Core 2`. O contrato público desta biblioteca é `advanced-element-library/v1`.

O incremento contém:

- frame Timoshenko 2D e 3D;
- cable co-rotacional 2D e 3D, com força inicial e comportamento tension-only;
- links não lineares 2D e 3D, com estado trial/committed e `commit/rollback`;
- frames Euler–Bernoulli 2D e 3D com offsets rígidos e rigid zones;
- factories registradas no `ElementRegistry` e compatíveis com o assembler esparso da v0.33/v0.32.

A v0.36 não introduz modelos constitutivos de concreto armado não linear. Esse bloco permanece reservado à **v0.37 — Nonlinear RC**.

## 1. Timoshenko 2D

Para uma barra prismática de comprimento deformável `L`, a deformação por cisalhamento é incorporada por

`phi = 12 E I / (kappa G As L^2)`

com `As` a área efetiva de cisalhamento e `kappa` o fator de correção. Os termos de flexão são

- `k11 = 12 E I / ((1+phi)L^3)`;
- `k12 = 6 E I / ((1+phi)L^2)`;
- `k22 = (4+phi) E I / ((1+phi)L)`;
- `k24 = (2-phi) E I / ((1+phi)L)`.

O termo axial continua `EA/L`. Quando `kappa G As -> infinito`, `phi -> 0` e a matriz converge para Euler–Bernoulli. O benchmark da v0.36 verifica diretamente esse limite e a deflexão de um balanço sob força transversal:

`delta = P L^3/(3 E I) + P L/(kappa G As)`.

## 2. Timoshenko 3D

A formulação espacial usa 12 DOFs e duas flexibilidades de cisalhamento independentes. Para os planos locais de flexão:

`phiZ = 12 E Iz / (kappaY G Ay L^2)`

`phiY = 12 E Iy / (kappaZ G Az L^2)`.

O axial é `EA/L` e a torção de Saint-Venant é `GJ/L`. A transformação global usa os eixos locais robustos já empregados pelo núcleo espacial do AstraStruct. O gate verifica simetria da tangente e invariância para movimento de corpo rígido.

## 3. Cable 2D/3D

O cable é um elemento de dois nós com cinemática co-rotacional. A cada avaliação, o vetor corrente `d`, o comprimento `l=||d||` e a direção `n=d/l` são recalculados. A deformação axial é

`epsilon = (l - L0)/L0`

com força tentativa

`Ntrial = N0 + EA epsilon`.

No modo tension-only, `N=max(0,Ntrial)`. Se o cabo perde tração, a rigidez é anulada. Quando ativo, a tangente contém parcela material e geométrica:

`Kt = (EA/L0) g g^T + (N/l) Kg`

em que `g=[-n,+n]` e `Kg` projeta as perturbações transversais ao eixo corrente. Assim, força inicial/prestress produz rigidez geométrica transversal mesmo sem alongamento adicional.

O elemento é objetivo a rotações espaciais do cabo, mas **não é um elemento catenário**: nesta versão não há forma inicial por peso próprio, sag analítico, carga distribuída ao longo da configuração corrente ou busca de forma. Essas extensões não são inferidas silenciosamente.

## 4. Nonlinear links

Os links podem ter componentes independentes nos DOFs permitidos em 2D/3D. As leis disponíveis nesta versão são:

- `elastic`;
- `gap-tension`;
- `gap-compression`;
- `bilinear-kinematic`.

Na lei bilinear, com rigidez inicial `k`, força de escoamento `Fy` e razão pós-escoamento `b`, o módulo de encruamento equivalente é

`H = k b/(1-b)`.

A atualização plástica usa estado committed somente leitura e produz um estado trial. O `ElementStateTransaction` da v0.33 controla `commit/rollback`, evitando contaminação do histórico quando uma iteração global não converge. São armazenados deformação plástica, back-force, deformação plástica acumulada e energia dissipada.

## 5. Offsets e rigid zones

Os componentes `frame2d-offset` e `frame3d-offset` separam os nós estruturais das extremidades deformáveis da barra. Primeiro são aplicados os offsets vetoriais de cada extremidade; em seguida as rigid zones avançam para dentro do vão ao longo da linha entre offsets.

A cinemática do braço rígido inclui o termo de rotação:

`u_end = u_node + theta x r`.

Por trabalho virtual, a rigidez nodal é obtida pela cadeia de transformações

`K = O^T T^T k_local T O`,

onde `O` é a transformação dos braços rígidos e `T` a transformação local/global. Os benchmarks 2D/3D impõem movimento infinitesimal de corpo rígido e exigem força interna praticamente nula.

As rigid zones devem deixar comprimento deformável estritamente positivo; configurações que ocupam todo o membro são rejeitadas.

## 6. Integração arquitetural

As famílias avançadas são registradas por `registerAdvancedElementComponents()` e são criadas por `createRegisteredElementComponent()`. A montagem global usa `assembleElementComponents()` e `DofManager`; elementos diferentes podem compartilhar DOFs sem um dispatcher físico único.

O solver legado `solve()` continua restrito às famílias historicamente suportadas. A v0.36 não altera esse dispatcher para evitar roteamento implícito de elementos não lineares por um solver linear incompatível.

## 7. Limitações deliberadas

Os novos frames Timoshenko e frames com offsets/zonas rígidas não recebem cargas de barra diretamente nesta versão; quando usados pela Component API, devem ser fornecidas cargas nodais equivalentes. O comportamento de cabo não inclui catenária/peso próprio. Links não são modelos de contato 3D geral. Materiais RC não lineares, bond-slip, fissuração, esmagamento e regularização por energia de fratura pertencem à v0.37.

## 8. Verificação e gate

`tests/advanced-element-library-v036-smoke.mjs` verifica deterministicamente:

- deflexão de Timoshenko 2D por solução fechada flexão + cisalhamento;
- simetria e modo rígido de Timoshenko 3D;
- prestress, alongamento, slackening e objetividade do cable;
- plastificação, reversão, energia e `commit/rollback` dos nonlinear links;
- offsets/rigid zones 2D e 3D por conservação do modo de corpo rígido;
- montagem conjunta via `element-assembly/v1` e matriz global esparsa.

A v0.36 só pode ser considerada fechada com release gate, regressões anteriores, build e Playwright desktop/Android/tablet verdes. O próximo estágio permitido é **v0.37 — Nonlinear RC**.
