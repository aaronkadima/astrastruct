# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.13.4 experimental:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A interface React/Vite é construída, testada e publicada automaticamente em `dist/` pelo GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós, snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais;
- ligações rígidas, semirrígidas e rotuladas com `kθ` explícito nos solvers compatíveis;
- cargas nodais, uniformes, pontuais em barra, peso próprio, recalques e ações térmicas no solver Linear/P‑Delta;
- **carga uniforme, peso próprio e carga pontual em barra como dead loads da configuração de referência no solver co‑rotacional**;
- **temperatura uniforme e gradiente térmico como deformação/curvatura iniciais no solver co‑rotacional**;
- **força seguidora concentrada na extremidade 2 de `frame2d`, com tangente externa consistente, no co‑rotacional v0.13.4**;
- molas nodais `kx`, `ky`, `kr` no solver Linear/P‑Delta;
- casos de ação e combinações customizadas, incluindo escalonamento de `followerEnd` antes da solução não linear;
- análise Linear, P‑Delta ou Geometricamente Não Linear co‑rotacional selecionável;
- flambagem linear por autovalores para pórticos 2D;
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

## Geometricamente não linear — v0.13.4 experimental

O terceiro modo do painel **Tipo de análise** usa formulação **co‑rotacional 2D Euler–Bernoulli**, grandes rotações globais, pequenas deformações locais e equilíbrio incremental por Newton–Raphson.

Para cada barra:

`ubar = l − L0`

`φ1 = θ1 − (α − α0)`

`φ2 = θ2 − (α − α0)`

onde `L0, α0` definem a configuração inicial e `l, α` a configuração corrente. A tangente interna é consistente e contém as parcelas constitutiva e geométrica derivadas da transformação co‑rotacional.

### Cargas mecânicas mortas da referência

`uniform`, `selfWeight` e `point` são tratadas como **dead loads da configuração inicial**. Seus vetores nodais equivalentes são calculados usando `L0` e `α0` e permanecem congelados durante Newton–Raphson.

Para UDL local inicial:

`p0 = [qx0 L0/2, qy0 L0/2, qy0 L0²/12, qx0 L0/2, qy0 L0/2, −qy0 L0²/12]`.

Para uma força pontual local em `xi=x/L0`, são usadas interpolação axial linear e funções de forma Hermite de flexão. Essas ações **não são follower loads**.

### Estado térmico inicial

Temperatura não é convertida em vetor de força externo. Ela entra no sistema básico como deformação inicial:

`εT = α ΔT`

`κT = −α ΔTg / h`

`db,T = [εT L0, −κT L0/2, +κT L0/2]^T`

`qb = kb (db − db,T)`.

Uma barra livre pode expandir/curvar sem força espúria; restrições produzem esforços correspondentes. O estado térmico é incrementado por `λ` junto ao caminho de Newton. A escala de convergência térmica usa grandezas mecanicamente dimensionais, incluindo `EA|εT|` e `EI|κT|`.

### Força seguidora de extremidade — v0.13.4

A v0.13.4 acrescenta `followerEnd`, atualmente restrita a uma **força concentrada na extremidade 2**. As componentes `(Px,Py)` permanecem constantes nos eixos locais da **corda corrente**; portanto, a força global gira com `α(q)`:

`Fx = c Px − s Py`

`Fy = s Px + c Py`.

Com:

`g = dα/dq = [s/l, −c/l, 0, −s/l, c/l, 0]`,

as derivadas em relação a `α` são:

`dFx/dα = −s Px − c Py`

`dFy/dα = c Px − s Py`.

O kernel monta explicitamente:

`Kext = dPf/dq`.

Como o resíduo é:

`R(q) = λ [Fref + Pf(q)] − fint(q,λ)`,

o passo de Newton usa:

`(Kint − λ Kext) Δq = R`.

`Kext` é, em geral, **não simétrica**, comportamento compatível com a natureza não conservativa da força seguidora. O Scenario Engine aplica os fatores de caso/combinação a `Px/Py` antes da trajetória não linear.

A interface permite criar, editar e remover `followerEnd`, selecionando elemento e caso ativo. A presença dessa ação impede aplicar os modos Linear/P‑Delta para evitar tratamento incorreto de uma força dependente da configuração.

### Geometria corrente e pós-processamento

A deformada co‑rotacional é exibida por padrão em **escala física ×1**. Cada elemento é reconstruído em 41 estações, fornecendo:

- coordenadas correntes `xd, yd`;
- `N(x)`, `V(x)`, `M(x)`;
- deslocamentos globais e locais;
- tensões elásticas `N/A ± Mc/I` quando a profundidade da seção é conhecida;
- dados das cargas mortas de referência e resíduo de recuperação;
- estado térmico `ΔT`, `ΔTg`, `α`, `εT`, `κT`;
- follower local `Px/Py`, componentes globais atuais `Fx/Fy` e `max|Kext|`.

O pós-processador co‑rotacional trabalha por cenário. **Envelopes não lineares permanecem desabilitados**, pois respostas pertencentes a caminhos de equilíbrio distintos não são combinadas automaticamente.

### Escopo estrito da v0.13.4

Aceito:

- somente `frame2d` Euler–Bernoulli;
- material elástico linear;
- extremidades rígidas;
- cargas nodais;
- `uniform`, `selfWeight` e `point` como dead loads de referência;
- `thermal` como deformação/curvatura inicial;
- `followerEnd` como força concentrada na extremidade 2 com tangente externa consistente;
- apoios clássicos sem deslocamentos impostos;
- até 240 DOFs livres no navegador.

Recusado explicitamente:

- `truss2d` e modelos mistos;
- releases e ligações semirrígidas;
- follower na extremidade 1;
- follower distribuída;
- follower aplicada em ponto interior da barra;
- follower moment;
- molas nodais;
- recalques/deslocamentos impostos;
- imperfeição modal inicial no kernel co‑rotacional;
- envelopes não lineares.

Ainda não há não linearidade material, plasticidade, fissuração/dano, contato ou arc-length/path-following.

### Validação do kernel co‑rotacional

A suíte automática inclui, entre outros:

- **objetividade:** movimento rígido com rotação `0,83 rad` sem força interna espúria;
- **tangente interna consistente:** erro relativo `1,78996×10⁻9` contra diferença central;
- **limite linear:** `uy = −2,275555070 mm` contra `−2,275555556 mm`;
- **grande rotação:** arco circular com `θ=1 rad` e convergência de malha;
- **UDL de referência:** `RA≈RB≈60 kN`, `Mmax≈89,999936 kN·m`;
- **peso próprio:** `w=3,75 kN/m`, `RA=RB=11,25 kN`, `Mmax=16,875 kN·m`;
- **carga pontual:** `P=100 kN`, `RA=RB=50 kN`, `Mmax=150 kN·m`, salto de `V=-100 kN`;
- **expansão térmica livre:** `ux=1,000000000 mm`, `N≈7,5×10⁻10 kN`;
- **expansão térmica impedida:** `N=-2250 kN`;
- **gradiente térmico livre:** `θ=-0,0016 rad`, erro geométrico `6,67×10⁻9 m`;
- **tangente externa follower:** erro relativo `7,63×10⁻10` contra diferença central no benchmark principal;
- **transformação follower sob rotação:** componentes globais acompanham a corda corrente;
- **combinação follower:** `Px=100 kN` com fator `1,4` resulta em `Px=140 kN`, `ux=0,0622222222 mm` e reação `−140 kN` no caso axial;
- **proteção de escopo:** follower fora da extremidade 2, recalques, deslocamentos prescritos e imperfeição modal geram erro explícito.

Esses benchmarks validam propriedades específicas da implementação; não constituem certificação normativa ou validação universal.

## Flambagem linear — v0.11+

O painel **Estabilidade** resolve:

`K φ = λcr (−Kg,ref) φ`.

Fornece fatores críticos `λcr`, modos próprios, forma modal, forças axiais de referência e seleção do cenário. `λcr` é multiplicador do padrão de carga de referência para a bifurcação linear idealizada, não fator de segurança ou resistência de projeto.

Benchmark de Euler:

- referência: `λcr,1 = 98,69604401`;
- AstraStruct: `λcr,1 = 98,69668565`;
- `λcr,2/λcr,1 = 4,00039`.

## Imperfeição geométrica modal — v0.12

Um modo de flambagem pode definir a forma inicial do P‑Delta:

`u0 = e0 · φ / max|φtrans|`.

No benchmark atual, para `e0=10 mm` e `λcr=11,1036687631`, a solução teórica e a numérica fornecem `etotal=10,9897394931 mm`.

## Ligações semirrígidas, molas e tensões

Nos solvers compatíveis, cada extremidade pode ser rígida, semirrígida ou rotulada:

`M = kθ (θn − θe)`.

Molas nodais lineares usam `Fspring = −k u` nos solvers atualmente compatíveis.

Tensões elásticas de seção:

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`.

Para concreto armado, são tensões da seção bruta linear-elástica; não representam seção fissurada, tensões de armadura, ELU/ELS ou verificação normativa.

## Casos, combinações e envelopes

O **Scenario Engine** resolve casos e combinações customizadas. Ele escala também `followerEnd.px/py` pelo fator do cenário antes da solução co‑rotacional. Nos modos Linear/P‑Delta, Diagramas pode formar envelopes mínimo/máximo. No co‑rotacional, cada cenário é resolvido e pós-processado isoladamente e o envelope permanece bloqueado.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

## Validação automatizada

O workflow **AstraStruct CI** verifica TypeScript, módulos do engine e regressões estruturais a cada push/PR. O workflow de Pages adiciona build Vite e Playwright em desktop, Android e tablet antes do deploy.

A cobertura co‑rotacional inclui cinemática, tangente interna, cargas mortas de referência, térmica, tangente externa follower, transformação da follower com a rotação, combinações, proteção de escopo, editor da follower, pós-processamento e relatório técnico.

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

- follower distribuída, follower em ponto interior e follower moment com tangentes externas consistentes;
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
