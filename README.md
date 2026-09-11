# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.9:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A pasta `web/` é publicada automaticamente por GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós e drag-and-drop, com snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais;
- **ligações de extremidade rígidas, semirrígidas e rotuladas**, com rigidez `kθ` em kN·m/rad;
- cargas nodais, cargas distribuídas locais, carga pontual por `x/L`, peso próprio, recalques e ações térmicas;
- gradiente térmico topo−base em pórticos e temperatura uniforme em pórticos/treliças;
- molas nodais lineares ao solo `kx`, `ky`, `kr`;
- múltiplos casos de ação e combinações lineares customizadas;
- solver matricial, reações, deslocamentos, forças de mola e esforços de extremidade;
- pós-processamento contínuo `N(x)`, `V(x)`, `M(x)` e `v(x)`;
- tensões elásticas de seção `σ = N/A − My/I` e envelopes de resultados;
- biblioteca paramétrica editável de materiais e seções;
- relatório técnico A4 reproduzível;
- importação/exportação JSON, exportação SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, preparada para a evolução do solver.

## Ligações semirrígidas — v0.9

O botão **Ligações** permite configurar independentemente cada extremidade de um elemento de pórtico como:

- **Rígida:** `kθ → ∞`;
- **Semirrígida:** `0 < kθ < ∞`;
- **Rótula:** `kθ = 0`.

A ligação não é implementada por redução empírica de `EI`. O elemento possui rotação interna de extremidade `θe`, conectada à rotação nodal `θn` por uma mola rotacional:

`M = kθ (θn − θe)`

A equação interna condensada é:

`(Krr + Kθ) θe = pr − Kra ua + Kθ θn`

Os graus de liberdade internos são eliminados por **condensação estática generalizada**, resultando em uma matriz nodal equivalente simétrica. A recuperação de resultados mantém separadas:

- rotação nodal;
- rotação da extremidade da barra;
- rotação relativa da ligação;
- momento transmitido pela ligação.

A interface também exibe o parâmetro adimensional:

`ρ = kθ L / (EI)`

Esse parâmetro é informativo nesta versão e **não é usado para classificação normativa automática** da ligação.

## Formulação linear atual

O núcleo opera em pequenas deformações e material linear elástico. Elementos de pórtico utilizam `(Ux, Uy, Rz)` por nó e cinemática Euler–Bernoulli; treliças trabalham axialmente.

Sistema global:

`K u = F`

Deslocamentos prescritos/recalques:

`Kff uf = Ff − Kfc uc`

Expansão térmica uniforme:

`εT = α ΔT`

Gradiente térmico em pórticos:

`κT = −α (Ttop − Tbase) / h`

Molas nodais entram diretamente na matriz global. Releases são o caso limite `kθ = 0` do mesmo framework de ligações de extremidade.

## Tensões elásticas de seção

O painel **Tensões** recupera:

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`

Tração é positiva. Para concreto armado, são tensões da **seção bruta linear elástica** e não representam seção fissurada, tensões de armadura, ELU/ELS ou verificação normativa.

## Casos, combinações e envelopes

O **Scenario Engine** resolve casos e combinações lineares customizadas por superposição de cargas nodais, cargas de barra, peso próprio, ações térmicas e recalques. O módulo **Diagramas** gera resposta contínua e envelope matemático mínimo/máximo.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

## Interface principal

- **Cargas+** — carga pontual em barra, peso próprio e recalques;
- **Molas/Térmica** — `ΔT`, gradiente térmico, `α`, `kx`, `ky`, `kr`;
- **Ligações** — rígida, semirrígida ou rótula por extremidade;
- **Tensões** — distribuição elástica `N/A ± Mc/I`;
- **Diagramas** — `N(x)`, `V(x)`, `M(x)`, deformada e envelopes;
- **Propriedades** — materiais e seções paramétricas;
- **Relatório** — memória técnica A4 do modelo e dos resultados.

As ligações semirrígidas são também identificadas graficamente no canvas.

## Relatório técnico

O relatório v0.9 inclui geometria, apoios, materiais, seções, ações, combinações, molas nodais, **tipo e rigidez das ligações de extremidade**, parâmetro `ρ`, rotação relativa, momento transmitido, deslocamentos, reações, esforços e tensões elásticas.

A página pode ser impressa ou salva como PDF pelo navegador. Ela continua explicitamente identificada como resultado de software em desenvolvimento.

## Validação automatizada

O workflow **AstraStruct CI** executa verificação sintática e testes de regressão em cada push/PR. Casos canônicos incluem:

- treliça 2D, pórtico 2D e modelo misto;
- viga biapoiada `L = 6 m`, `q = 20 kN/m`: `RA = RB = 60 kN`, `Mmax = 90 kN·m`, flecha `3,600 mm`;
- tensões extremas `−7,2/+7,2 MPa` na viga RC 30 × 50 cm;
- rótula com momento de extremidade aproximadamente nulo;
- **console com ligação semirrígida `kθ = 10000 kN·m/rad`**: flecha `18,2756 mm`, momento transmitido `40 kN·m` e rotação relativa `0,004 rad`;
- carga pontual central `P = 100 kN`: `RA = RB = 50 kN`, `Mmax = 150 kN·m`;
- peso próprio RC: `RA = RB = 11,25 kN`, `Mmax = 16,875 kN·m`;
- barra axial com deslocamento imposto: `N = 200 kN`;
- expansão térmica livre: `ux = 1,2 mm`, `N ≈ 0`;
- expansão térmica impedida: `N = −1200 kN`;
- gradiente térmico fixo-fixo: `M = −37,5/+37,5 kN·m`;
- barra com mola axial: `u = 0,1 mm`, `N = 100 kN`, força da mola `−10 kN`;
- superposição de casos/combinações e envelopes.

## Executar localmente

```bash
python -m http.server 8080 --directory web
```

Abra `http://localhost:8080`.

Testes:

```bash
npm run check
npm test
```

Requer Node.js 24 ou superior no workflow atual.

## Arquitetura-alvo

A interface e o núcleo numérico permanecem desacoplados, permitindo evolução para JavaScript/TypeScript no navegador, WebAssembly, serviços Python científicos e backend HPC.

Pipeline VNL linear:

`Geometry → Material → Section → Boundary → Connection → Load → Solver → Result → Plot`

Evolução prevista:

`Geometry → Mesh → Concrete Damage → Reinforcement → Bond-Slip → Contact → Increment → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- offsets e excentricidades rígidas;
- biblioteca versionada de perfis comerciais de aço e seções RC;
- laboratório de elementos isolados: barra, viga, pilar, ancoragem e ligação metálica;
- **P-Delta e análise geométrica não linear**;
- Newton–Raphson incremental-iterativo;
- plasticidade do aço e modelos constitutivos de concreto;
- concrete damage/cracking, bond-slip e pull-out de ancoragens;
- contato;
- pórtico 3D, Timoshenko, shell e solid;
- pushover, análise modal e dinâmica transiente;
- staged construction e reliability;
- detalhamento RC/aço e exportação DXF;
- packs normativos versionados ABNT NBR, ACI, Eurocodes e fib Model Code;
- backend WebAssembly/HPC.

## Política normativa

Nenhuma regra normativa oficial deve ser considerada implementada sem edição identificada, cláusula rastreável, controle dimensional/unidades, casos de validação independentes, testes de regressão e revisão técnica documentada. Os futuros packs ABNT NBR, ACI, Eurocodes e fib Model Code serão versionados separadamente do solver estrutural.
