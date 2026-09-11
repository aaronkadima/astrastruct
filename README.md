# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.13.1 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A interface React/Vite é construída, testada e publicada automaticamente em `dist/` pelo GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós e drag-and-drop, com snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais;
- ligações de extremidade rígidas, semirrígidas e rotuladas, com `kθ` explícito;
- cargas nodais, distribuídas, pontuais em barra, peso próprio, recalques e ações térmicas no solver linear/P‑Delta;
- **carga uniforme e peso próprio como dead loads da configuração de referência no solver co‑rotacional v0.13.1**;
- molas nodais `kx`, `ky`, `kr` no solver linear/P‑Delta;
- casos de ação e combinações lineares customizadas;
- **análise Linear, P‑Delta ou Geometricamente Não Linear co‑rotacional selecionável**;
- **flambagem linear por autovalores para pórticos 2D**;
- **imperfeição geométrica inicial baseada em modo de flambagem**, aplicada ao P‑Delta por carga geométrica equivalente;
- pós-processamento `N(x)`, `V(x)`, `M(x)`, deformada e tensões elásticas;
- envelopes matemáticos para os modos Linear/P‑Delta;
- pós-processamento específico na **geometria corrente** para o modo co‑rotacional;
- sonda interativa de seção com esforços, deslocamentos e tensões;
- mapa contínuo de `|σ|max` elástico em MPa;
- biblioteca paramétrica de materiais e seções;
- relatório técnico A4 reproduzível, incluindo relatório específico da análise co‑rotacional;
- importação/exportação JSON, SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, com contratos preparados para extensões não lineares.

## P‑Delta — v0.12

O painel **Tipo de análise** permite selecionar P‑Delta com:

`[Ke + Kg(N)] u = F`.

A análise usa uma **matriz geométrica consistente de viga-coluna 2D**. O esforço normal é recuperado após cada solução global e usado para reconstruir a rigidez geométrica até a convergência dos deslocamentos.

Convenção do AstraStruct:

- `N > 0`: tração;
- `N < 0`: compressão.

Assim, a compressão reduz automaticamente a rigidez tangente por meio de `Kg(N)`.

Para o elemento de pórtico, a matriz geométrica local é baseada em:

`Kg = N/(30L) · G`

onde `G` é a matriz consistente de estabilidade do elemento Euler–Bernoulli 2D.

O processo iterativo é:

1. montar/solucionar o sistema com a estimativa atual de `N`;
2. recuperar o esforço normal médio de cada elemento;
3. reconstruir `Kg(N)`;
4. resolver novamente o sistema;
5. verificar `max|u(i) − u(i−1)|` contra a tolerância definida;
6. repetir até convergir ou atingir o limite de iterações.

### Escopo atual do P‑Delta

A v0.12 habilita P‑Delta apenas para modelos formados exclusivamente por elementos `frame2d`.

A formulação inclui:

- rigidez geométrica por esforço normal;
- cargas nodais e de barra já implementadas;
- peso próprio;
- temperatura;
- recalques;
- molas nodais;
- ligações rígidas, rotuladas e semirrígidas no processo P‑Delta sem imperfeição modal;
- imperfeição geométrica modal para modelos com extremidades rígidas.

O P‑Delta não é análise materialmente não linear, não substitui verificação normativa de estabilidade e não escolhe automaticamente imperfeições prescritas por norma.

## Geometricamente não linear — v0.13.1 experimental

O terceiro modo do painel **Tipo de análise** usa uma formulação **co‑rotacional 2D Euler–Bernoulli** com grandes rotações e equilíbrio incremental-iterativo por Newton–Raphson.

Para cada barra, as deformações básicas são:

`ubar = l − L0`

`φ1 = θ1 − (α − α0)`

`φ2 = θ2 − (α − α0)`

onde `L0, α0` definem a configuração inicial e `l, α` a configuração corrente.

O vetor de forças internas é obtido a partir das deformações básicas e a matriz tangente é **consistente**, contendo a parcela material e os termos geométricos derivados da transformação co‑rotacional. O equilíbrio de cada incremento é resolvido por:

`Kt(qi) Δq = Fext − Fint(qi)`

com atualização iterativa até o critério de resíduo ser satisfeito. O usuário pode definir:

- número de incrementos de carga;
- máximo de iterações por incremento;
- tolerância;
- uso ou não de line search.

### Carga uniforme e peso próprio de referência

A v0.13.1 aceita `uniform` e `selfWeight` como **dead loads referenciadas na geometria inicial**.

Para uma carga uniforme local inicial `qx0,qy0`, o vetor consistente é calculado com `L0` e `α0` e permanece congelado durante Newton:

`p0 = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, −qy0 L0²/12]`.

No peso próprio:

`w = γ A f`.

A ação gravitacional global é projetada nos eixos locais da **configuração inicial**, convertida em vetor nodal equivalente e mantida fixa. Portanto, essas ações **não são cargas seguidoras** e não incluem tangente externa de follower load.

Na recuperação física dos esforços de extremidade, o solver separa a contribuição constitutiva do vetor nodal equivalente. O pós-processamento registra ainda um resíduo de equilíbrio para `N/V/M`.

### Geometria corrente e pós-processamento

A deformada do modo co‑rotacional é exibida por padrão em **escala física ×1**; o amplificador automático usado em análises de pequenas deformações é ocultado.

Cada elemento é reconstruído em 41 estações no sistema co‑rotante e transformado para o sistema global, fornecendo:

- coordenadas correntes `xd, yd`;
- `N(x)`, `V(x)`, `M(x)`;
- deslocamentos globais e locais;
- tensões elásticas `N/A ± Mc/I` quando a profundidade da seção é conhecida;
- `qx0`, `qy0`, peso próprio e resíduo de recuperação quando existe carga de referência.

Diagramas, sonda e mapa de tensões acompanham a **configuração corrente**. O painel de pós-processamento co‑rotacional trabalha somente com o cenário resolvido; **envelopes não lineares permanecem desabilitados** até existir uma definição consistente para combinar caminhos de equilíbrio distintos.

### Escopo estrito da v0.13.1

Aceito atualmente:

- exclusivamente elementos `frame2d` Euler–Bernoulli;
- material elástico linear;
- extremidades rígidas;
- cargas nodais;
- carga uniforme `uniform` como dead load da referência;
- peso próprio `selfWeight` como dead load vertical global da referência;
- apoios clássicos sem deslocamento prescrito;
- até 240 graus de liberdade livres no navegador.

O kernel recusa explicitamente, em vez de ignorar:

- `truss2d` e modelos mistos;
- releases e ligações semirrígidas;
- carga pontual em barra;
- ações térmicas;
- cargas seguidoras/follower loads;
- molas nodais;
- recalques/deslocamentos impostos;
- imperfeição geométrica modal inicial;
- envelopes não lineares.

Não há ainda não linearidade material, plasticidade, fissuração, dano, contato ou seguimento de caminho pós-crítico por arc-length.

### Validação do kernel co‑rotacional

A suíte automática inclui verificações independentes de:

- **objetividade:** translação + rotação rígida de `0,83 rad` produzem deformações/forças internas praticamente nulas;
- **tangente consistente:** erro relativo contra derivada numérica central `1,79 × 10⁻9`;
- **limite linear:** balanço recupera `uy = −2,275555070 mm` contra `−2,275555556 mm` da solução linear;
- **grande rotação:** arco circular de `θ = 1 rad`;
- **convergência de malha:** erro de ponta `10,006 mm → 2,498 mm → 0,624 mm` para `4 → 8 → 16` elementos;
- **pós-processamento:** erro do momento puro ao longo da malha de aproximadamente `2,25 × 10⁻9 kN·m`;
- **UDL de referência:** `RA ≈ RB ≈ 60 kN`, `uy,meio = −3,599997 mm`, `Mmax = 89,999936 kN·m` e resíduo de recuperação `2,84 × 10⁻14` para `q = 20 kN/m` em viga de `6 m`;
- **peso próprio de referência:** `w = 3,75 kN/m`, `RA = RB = 11,25 kN` e `Mmax = 16,875 kN·m`;
- **proteção de escopo:** recalques, deslocamentos prescritos, imperfeição modal ativa e carga pontual em barra geram erro explícito.

Esses benchmarks validam propriedades específicas da implementação; não constituem certificação normativa ou validação universal do solver.

## Flambagem linear — v0.11+

O painel **Estabilidade** resolve o problema generalizado de autovalores:

`K φ = λcr (−Kg,ref) φ`

onde `Kg,ref` é construído a partir dos esforços axiais do cenário linear de referência.

O resultado fornece:

- fatores críticos `λcr` ordenados;
- primeiros modos próprios de flambagem;
- visualização da forma modal diretamente no canvas;
- esforços axiais de referência usados em `Kg`;
- seleção do cenário de referência;
- até 12 modos por análise.

`λcr` é o multiplicador do **padrão de cargas de referência** necessário para atingir a bifurcação linear idealizada. Não é fator de segurança, coeficiente normativo nem resistência de projeto.

### Escopo atual da flambagem

A análise aceita:

- modelos exclusivamente `frame2d`;
- extremidades rígidas dos elementos;
- apoios nodais usuais;
- molas nodais lineares;
- até 240 graus de liberdade livres no navegador.

Releases e ligações semirrígidas na análise de autovalores permanecem desabilitados até validação específica da formulação condensada.

## Imperfeição geométrica modal — v0.12

Um modo de flambagem calculado pode ser usado como forma inicial do P‑Delta.

O modo é normalizado para que a maior translação tenha amplitude definida pelo usuário:

`u0 = e0 · φ / max|φtrans|`

A amplitude `e0` é informada em milímetros. O AstraStruct **não escolhe automaticamente** uma razão `L/n` normativa.

A imperfeição entra no equilíbrio por carga geométrica equivalente:

`[K + Kg(N)] Δu = F − Kg(N) u0`

O resultado mantém separadas:

- `u0`: imperfeição inicial prescrita;
- `Δu`: incremento devido às ações;
- `utotal = u0 + Δu`: posição total relativa à geometria nominal.

### Validação da imperfeição modal

Para uma coluna biarticulada discretizada sob compressão pura, com imperfeição coincidente com o primeiro autovetor:

`etotal = e0 / (1 − P/Pcr) = e0 / (1 − 1/λcr)`.

Caso de regressão:

- `e0 = 10 mm`;
- `λcr = 11,1036687631`;
- valor teórico: `etotal = 10,9897394931 mm`;
- AstraStruct: `etotal = 10,9897394931 mm`.

## Validação canônica do P‑Delta

Caso independente de viga-coluna em balanço:

- `L = 6 m`;
- `E = 30 GPa`;
- `I = 0,0054 m⁴`;
- `P = 4000 kN`;
- `H = 10 kN`;
- 4 elementos.

Referência contínua:

`δ = H/P · [tan(kL)/k − L]`, com `k = sqrt(P/EI)`.

Resultados:

- analítico: `δ = 6,913363 mm`;
- AstraStruct: `δ = 6,913317 mm`;
- convergência: `3 iterações`.

Outro teste confirma que, quando `N = 0`, o P‑Delta reproduz a solução linear.

## Validação da flambagem de Euler

A flambagem linear foi verificada contra:

`Pcr = π² EI / L²`.

Resultados do benchmark atual:

- Euler: `λcr,1 = 98,69604401`;
- AstraStruct: `λcr,1 = 98,69668565`;
- `λcr,2 / λcr,1 = 4,00039`, próximo da razão teórica `4`.

## Ligações semirrígidas

Cada extremidade de um elemento de pórtico pode ser configurada no solver linear/P‑Delta como:

- rígida: `kθ → ∞`;
- semirrígida: `0 < kθ < ∞`;
- rótula: `kθ = 0`.

Momento transmitido:

`M = kθ (θn − θe)`.

A ligação usa rotação interna de extremidade e condensação estática generalizada. A interface apresenta também:

`ρ = kθ L / (EI)`.

Esse parâmetro é informativo e ainda não constitui classificação normativa automática da ligação.

## Formulação térmica e molas

Expansão térmica uniforme:

`εT = α ΔT`

Gradiente térmico em pórticos:

`κT = −α (Ttop − Tbase)/h`

Molas nodais lineares são inseridas diretamente na matriz global e a força resistente é recuperada como:

`Fspring = −k u`.

Esses recursos pertencem atualmente aos solvers Linear/P‑Delta; o co‑rotacional v0.13.1 aceita somente cargas nodais e `uniform/selfWeight` dentro do modelo de dead load de referência descrito acima.

## Tensões elásticas de seção

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`.

Para concreto armado, essas tensões correspondem à seção bruta linear elástica. Não representam seção fissurada, tensões na armadura, ELU/ELS ou verificação normativa.

## Casos, combinações e envelopes

O **Scenario Engine** resolve casos e combinações customizadas. Nos modos Linear/P‑Delta, o módulo de Diagramas pode formar envelopes mínimo/máximo. No modo co‑rotacional v0.13.1, cada cenário é resolvido e pós-processado isoladamente e o envelope permanece bloqueado.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

## Interface principal

- **Tipo de análise** — Linear, P‑Delta ou Geom. não linear; parâmetros de convergência próprios;
- **Estabilidade** — `λcr`, modos críticos, forma modal e definição de `e0` para o P‑Delta;
- **Ligações** — rígida, semirrígida ou rótula por extremidade nos solvers compatíveis;
- **Cargas+** — carga pontual em barra, peso próprio e recalques, respeitando o escopo de cada solver;
- **Molas/Térmica** — `ΔT`, gradiente térmico, `α`, `kx`, `ky`, `kr`;
- **Tensões** — `N/A ± Mc/I`;
- **Diagramas** — respostas por cenário; envelopes apenas nos modos compatíveis;
- **Sonda** — resultados por seção diretamente no elemento;
- **Mapa |σ|** — tensão elástica máxima ao longo do modelo;
- **Propriedades** — materiais e seções paramétricas;
- **Relatório** — memória técnica A4, com relatório específico para o modo co‑rotacional.

## Validação automatizada

O workflow **AstraStruct CI** verifica TypeScript, sintaxe dos módulos do engine e regressões estruturais a cada push/PR. O workflow de Pages adiciona build Vite e Playwright em desktop, Android e tablet antes do deploy.

Casos atuais incluem:

- treliça, pórtico e modelo misto;
- viga UDL: `RA = RB = 60 kN`, `Mmax = 90 kN·m`, flecha `3,600 mm`;
- tensões extremas `−7,2/+7,2 MPa`;
- rótula com momento aproximadamente nulo;
- console semirrígido: `18,2756 mm`, `40 kN·m`, rotação relativa `0,004 rad`;
- carga pontual central: `RA = RB = 50 kN`, `Mmax = 150 kN·m`;
- peso próprio RC: `RA = RB = 11,25 kN`, `Mmax = 16,875 kN·m`;
- recalque axial: `N = 200 kN`;
- expansão térmica livre: `ux = 1,2 mm`, `N ≈ 0`;
- expansão térmica impedida: `N = −1200 kN`;
- gradiente térmico: `M = −37,5/+37,5 kN·m`;
- barra com mola axial: `u = 0,1 mm`, `N = 100 kN`, força da mola `−10 kN`;
- superposição de casos e envelopes;
- viga-coluna P‑Delta contra solução contínua analítica;
- coluna de Euler por autovalores;
- amplificação de imperfeição modal contra solução fechada;
- objetividade, tangente consistente, limite linear, grande rotação e convergência de malha do solver co‑rotacional;
- UDL e peso próprio co‑rotacionais como dead loads de referência, com reações, flechas, momentos e resíduo de recuperação verificados;
- fluxo de interface co‑rotacional em Playwright desktop, Android e tablet, incluindo configuração, solução, geometria física ×1, pós-processamento, relatório e cargas de referência.

## Executar localmente

```bash
npm install
npm run dev
```

Build e testes:

```bash
npm run check
npm test
npm run test:e2e
npm run build
```

Requer Node.js 24 ou superior no workflow atual.

## Arquitetura-alvo

A interface React/Vite e o núcleo numérico em `web/src/` permanecem desacoplados. A evolução pode incorporar WebAssembly, serviços Python científicos e backend HPC.

Pipeline VNL atual:

`Geometry → Material → Section → Boundary → Connection → Load → Analysis → Solver → Result → Plot`

Pipeline não linear:

`Geometry → Mesh → Initial State → Material State → Increment → Tangent → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- carga pontual em barra e ações térmicas no co‑rotacional;
- cargas seguidoras/follower loads com tangente externa consistente;
- releases, ligações semirrígidas e offsets no co‑rotacional;
- imperfeição inicial diretamente na configuração co‑rotacional;
- estratégia arc-length/path-following para proximidade de pontos limites;
- plasticidade do aço e modelos constitutivos de concreto;
- concrete damage/cracking, bond-slip e pull-out de ancoragens;
- generalização da flambagem/imperfeição para releases e ligações semirrígidas;
- biblioteca versionada de perfis comerciais de aço e seções RC;
- laboratório de elementos isolados;
- contato;
- pórtico 3D, Timoshenko, shell e solid;
- pushover, modal e dinâmica transiente;
- staged construction e reliability;
- detalhamento RC/aço e exportação DXF;
- packs normativos versionados ABNT NBR, ACI, Eurocodes e fib Model Code;
- backend WebAssembly/HPC.

## Política normativa

Nenhuma regra normativa oficial deve ser considerada implementada sem edição identificada, cláusula rastreável, controle dimensional/unidades, casos de validação independentes, testes de regressão e revisão técnica documentada. Os futuros packs ABNT NBR, ACI, Eurocodes e fib Model Code serão versionados separadamente do solver estrutural.
