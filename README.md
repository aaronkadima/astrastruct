# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.13.2 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A interface React/Vite é construída, testada e publicada automaticamente em `dist/` pelo GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós, snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais;
- ligações rígidas, semirrígidas e rotuladas com `kθ` explícito nos solvers compatíveis;
- cargas nodais, uniformes, pontuais em barra, peso próprio, recalques e ações térmicas no solver linear/P‑Delta;
- **carga uniforme, peso próprio e carga pontual em barra como dead loads da configuração de referência no solver co‑rotacional v0.13.2**;
- molas nodais `kx`, `ky`, `kr` no solver linear/P‑Delta;
- casos de ação e combinações lineares customizadas;
- **análise Linear, P‑Delta ou Geometricamente Não Linear co‑rotacional selecionável**;
- **flambagem linear por autovalores para pórticos 2D**;
- imperfeição geométrica inicial baseada em modo de flambagem aplicada ao P‑Delta;
- pós-processamento `N(x)`, `V(x)`, `M(x)`, deformada e tensões elásticas;
- envelopes matemáticos para Linear/P‑Delta e pós-processamento específico na **geometria corrente** para o co‑rotacional;
- sonda de seção, mapa de `|σ|max`, biblioteca paramétrica de materiais/seções e relatório técnico A4;
- importação/exportação JSON e SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, com contratos preparados para extensões não lineares.

## P‑Delta — v0.12

O modo P‑Delta resolve iterativamente:

`[Ke + Kg(N)] u = F`.

A compressão (`N < 0`) reduz a rigidez tangente por meio da matriz geométrica consistente do elemento Euler–Bernoulli. O esforço normal é atualizado após cada solução global até convergência dos deslocamentos.

A formulação P‑Delta atual aceita cargas nodais/de barra, peso próprio, temperatura, recalques, molas nodais, ligações rígidas/rotuladas/semirrígidas e imperfeição modal em modelos compatíveis. Não é análise materialmente não linear nem substitui verificação normativa de estabilidade.

## Geometricamente não linear — v0.13.2 experimental

O terceiro modo do painel **Tipo de análise** usa formulação **co‑rotacional 2D Euler–Bernoulli**, grandes rotações globais, pequenas deformações locais e equilíbrio incremental por Newton–Raphson.

Para cada barra:

`ubar = l − L0`

`φ1 = θ1 − (α − α0)`

`φ2 = θ2 − (α − α0)`

onde `L0, α0` definem a configuração inicial e `l, α` a configuração corrente. A tangente é consistente e contém as parcelas constitutiva e geométrica derivadas da transformação co‑rotacional.

O equilíbrio de cada incremento é resolvido por:

`Kt(qi) Δq = Fext − Fint(qi)`

com número de incrementos, máximo de iterações, tolerância e line search configuráveis.

### Cargas mortas da configuração de referência

A v0.13.2 aceita três ações de barra no modo co‑rotacional:

- `uniform` — carga uniforme local inicial;
- `selfWeight` — peso próprio vertical global;
- `point` — carga pontual local em `xi = x/L0`.

Para UDL, o vetor nodal consistente é calculado com `L0` e `α0`:

`p0 = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, −qy0 L0²/12]`.

Para carga pontual, são usadas as funções de forma axial linear e Hermite de flexão no ponto `xi`, produzindo o vetor nodal equivalente:

`pP = [Px(1−xi), Py h1, Py h2, Px xi, Py h3, Py h4]`.

Os vetores equivalentes são transformados pela **orientação inicial** e congelados durante Newton–Raphson. Portanto, essas ações são **dead loads de referência**, não follower loads; a v0.13.2 não inclui tangente externa de carga seguidora.

No pós-processamento, a carga global congelada é projetada no sistema co‑rotante corrente para recuperar `N(x)`, `V(x)` e `M(x)`. Para carga pontual, o diagrama apresenta os saltos de `N/V` e a mudança de inclinação de `M` em `x = xi·l`. O solver também registra um resíduo de recuperação dos esforços de extremidade.

### Geometria corrente

A deformada co‑rotacional é exibida por padrão em **escala física ×1**. Cada elemento é reconstruído em 41 estações, fornecendo:

- coordenadas correntes `xd, yd`;
- `N(x)`, `V(x)`, `M(x)`;
- deslocamentos globais e locais;
- tensões elásticas `N/A ± Mc/I` quando a profundidade da seção é conhecida;
- `qx0`, `qy0`, peso próprio, cargas pontuais `Px0/Py0`, posição `x/L` e resíduo de recuperação.

O pós-processador co‑rotacional trabalha por cenário. **Envelopes não lineares permanecem desabilitados**, pois respostas pertencentes a caminhos de equilíbrio distintos não são combinadas automaticamente.

### Escopo estrito da v0.13.2

Aceito:

- somente `frame2d` Euler–Bernoulli;
- material elástico linear;
- extremidades rígidas;
- cargas nodais;
- `uniform`, `selfWeight` e `point` como dead loads de referência;
- apoios clássicos sem deslocamentos impostos;
- até 240 DOFs livres no navegador.

Recusado explicitamente:

- `truss2d` e modelos mistos;
- releases e ligações semirrígidas;
- ações térmicas;
- cargas seguidoras/follower loads;
- molas nodais;
- recalques/deslocamentos impostos;
- imperfeição modal inicial no kernel co‑rotacional;
- envelopes não lineares.

Ainda não há não linearidade material, plasticidade, fissuração/dano, contato ou arc-length/path-following.

### Validação do kernel co‑rotacional

A suíte automática inclui:

- **objetividade:** movimento rígido com rotação `0,83 rad` sem força interna espúria;
- **tangente consistente:** erro relativo `1,79 × 10⁻9` contra derivada numérica central;
- **limite linear:** `uy = −2,275555070 mm` contra `−2,275555556 mm`;
- **grande rotação:** arco circular com `θ = 1 rad`;
- **convergência de malha:** erro de ponta `10,006 → 2,498 → 0,624 mm` para `4 → 8 → 16` elementos;
- **momento puro:** erro máximo de pós-processamento ≈ `2,25 × 10⁻9 kN·m`;
- **UDL de referência:** `RA ≈ RB ≈ 60 kN`, `uy,meio = −3,599997 mm`, `Mmax = 89,999936 kN·m`, resíduo `2,84 × 10⁻14`;
- **peso próprio:** `w = 3,75 kN/m`, `RA = RB = 11,25 kN`, `Mmax = 16,875 kN·m`;
- **carga pontual de referência:** `P = 100 kN` em `x/L=0,5`, `RA = RB = 50 kN`, `Mmax = 150 kN·m`, salto de cortante `−100 kN` e resíduo de recuperação `0`;
- **proteção de escopo:** recalques, deslocamentos prescritos, imperfeição modal e ação térmica geram erro explícito.

Esses benchmarks validam propriedades específicas da implementação; não constituem certificação normativa ou validação universal.

## Flambagem linear — v0.11+

O painel **Estabilidade** resolve:

`K φ = λcr (−Kg,ref) φ`.

Fornece fatores críticos `λcr`, modos próprios, forma modal, forças axiais de referência e seleção do cenário de referência. `λcr` é multiplicador do padrão de carga de referência para a bifurcação linear idealizada, não fator de segurança ou resistência de projeto.

A validação de Euler fornece:

- referência: `λcr,1 = 98,69604401`;
- AstraStruct: `λcr,1 = 98,69668565`;
- `λcr,2/λcr,1 = 4,00039`.

## Imperfeição geométrica modal — v0.12

Um modo de flambagem pode definir a forma inicial do P‑Delta:

`u0 = e0 · φ / max|φtrans|`.

A amplitude é definida pelo usuário; o AstraStruct não escolhe automaticamente uma razão normativa `L/n`.

No benchmark atual, para `e0 = 10 mm` e `λcr = 11,1036687631`, a solução teórica e a numérica fornecem `etotal = 10,9897394931 mm`.

## Validação canônica do P‑Delta

Para coluna em balanço com `L=6 m`, `E=30 GPa`, `I=0,0054 m⁴`, `P=4000 kN` e `H=10 kN`:

`δ = H/P · [tan(kL)/k − L]`, `k = sqrt(P/EI)`.

- analítico: `δ = 6,913363 mm`;
- AstraStruct: `δ = 6,913317 mm`;
- convergência: `3 iterações`.

## Ligações semirrígidas

Nos solvers compatíveis, cada extremidade pode ser rígida, semirrígida ou rotulada:

`M = kθ (θn − θe)`

com parâmetro informativo:

`ρ = kθ L/(EI)`.

Ainda não há classificação normativa automática da ligação.

## Formulação térmica, molas e tensões

Expansão térmica uniforme:

`εT = α ΔT`

Gradiente térmico:

`κT = −α (Ttop − Tbase)/h`.

Molas nodais lineares usam `Fspring = −k u`.

Tensões elásticas de seção:

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`.

Para concreto armado, são tensões da seção bruta linear-elástica; não representam seção fissurada, tensões de armadura, ELU/ELS ou verificação normativa.

## Casos, combinações e envelopes

O **Scenario Engine** resolve casos e combinações customizadas. Nos modos Linear/P‑Delta, o módulo de Diagramas pode formar envelopes mínimo/máximo. No modo co‑rotacional v0.13.2, cada cenário é resolvido e pós-processado isoladamente e o envelope permanece bloqueado.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

## Validação automatizada

O workflow **AstraStruct CI** verifica TypeScript, módulos do engine e regressões estruturais a cada push/PR. O workflow de Pages adiciona build Vite e Playwright em desktop, Android e tablet antes do deploy.

A cobertura inclui treliça, pórtico, modelo misto, cargas de barra, temperatura, molas, recalques, P‑Delta, flambagem, imperfeição modal e toda a cadeia experimental co‑rotacional. A interface co‑rotacional é testada para configuração, solução, deformada física ×1, pós-processamento, relatório e cargas de referência.

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

Pipeline VNL:

`Geometry → Material → Section → Boundary → Connection → Load → Analysis → Solver → Result → Plot`

Pipeline não linear:

`Geometry → Mesh → Initial State → Material State → Increment → Tangent → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- ações térmicas no co‑rotacional;
- follower loads com tangente externa consistente;
- releases, ligações semirrígidas e offsets no co‑rotacional;
- imperfeição inicial diretamente na configuração co‑rotacional;
- arc-length/path-following para pontos-limite;
- plasticidade do aço e modelos constitutivos de concreto;
- concrete damage/cracking, bond-slip e pull-out de ancoragens;
- generalização da flambagem/imperfeição para releases e ligações semirrígidas;
- biblioteca versionada de perfis comerciais e seções RC;
- laboratório de elementos isolados, contato, pórtico 3D, Timoshenko, shell e solid;
- pushover, modal, dinâmica transiente, staged construction e reliability;
- detalhamento RC/aço, exportação DXF e packs normativos versionados;
- backend WebAssembly/HPC.

## Política normativa

Nenhuma regra normativa oficial deve ser considerada implementada sem edição identificada, cláusula rastreável, controle dimensional/unidades, casos de validação independentes, testes de regressão e revisão técnica documentada. Os futuros packs ABNT NBR, ACI, Eurocodes e fib Model Code serão versionados separadamente do solver estrutural.
