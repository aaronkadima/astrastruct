# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.12:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A interface React/Vite é construída, testada e publicada automaticamente em `dist/` pelo GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós e drag-and-drop, com snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais;
- ligações de extremidade rígidas, semirrígidas e rotuladas, com `kθ` explícito;
- cargas nodais, distribuídas, pontuais em barra, peso próprio, recalques e ações térmicas;
- molas nodais `kx`, `ky`, `kr`;
- casos de ação e combinações lineares customizadas;
- **análise linear ou P‑Delta selecionável**;
- **flambagem linear por autovalores para pórticos 2D**;
- **imperfeição geométrica inicial baseada em modo de flambagem**, aplicada ao P‑Delta por carga geométrica equivalente;
- pós-processamento `N(x)`, `V(x)`, `M(x)`, deformada, tensões elásticas e envelopes;
- sonda interativa de seção com esforços, deslocamentos e tensões;
- mapa contínuo de `|σ|max` elástico em MPa;
- biblioteca paramétrica de materiais e seções;
- relatório técnico A4 reproduzível;
- importação/exportação JSON, SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, com contratos preparados para extensões não lineares.

## P‑Delta — v0.12

O painel **Análise** permite escolher entre:

- **Linear:** `K u = F`;
- **P‑Delta:** `[Ke + Kg(N)] u = F`.

A análise P‑Delta usa uma **matriz geométrica consistente de viga-coluna 2D**. O esforço normal é recuperado após cada solução global e usado para reconstruir a rigidez geométrica até a convergência dos deslocamentos.

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

O painel permite configurar:

- máximo de iterações, de 2 a 100;
- tolerância de convergência;
- modo Linear/P‑Delta.

### Escopo atual do P‑Delta

A v0.12 habilita P‑Delta apenas para modelos formados exclusivamente por elementos `frame2d`. Modelos mistos e treliças permanecem no solver linear.

A formulação inclui:

- rigidez geométrica por esforço normal;
- cargas nodais e de barra já implementadas;
- peso próprio;
- temperatura;
- recalques;
- molas nodais;
- ligações rígidas, rotuladas e semirrígidas no processo P‑Delta sem imperfeição modal;
- imperfeição geométrica modal para modelos com extremidades rígidas.

A formulação **não** é, ainda:

- análise co-rotacional de grandes rotações;
- análise de grandes deformações;
- análise materialmente não linear;
- verificação normativa automática de estabilidade global;
- substituto de imperfeições prescritas por norma sem definição explícita do usuário.

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

Interpretação:

`λcr` é o multiplicador do **padrão de cargas de referência** necessário para atingir a bifurcação linear idealizada. Não é fator de segurança, coeficiente normativo nem resistência de projeto.

### Escopo atual da flambagem

A v0.11/v0.12 aceita:

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

A deformada gráfica usa a cinemática total quando a imperfeição está ativa.

### Validação da imperfeição modal

Foi implementado um benchmark de coluna biarticulada discretizada sob compressão pura, com imperfeição coincidente com o primeiro autovetor.

Para um modo próprio puro, a teoria fornece:

`etotal = e0 / (1 − P/Pcr) = e0 / (1 − 1/λcr)`.

Caso de regressão:

- `e0 = 10 mm`;
- `λcr = 11,1036687631`;
- valor teórico: `etotal = 10,9897394931 mm`;
- AstraStruct: `etotal = 10,9897394931 mm`.

A diferença numérica nesse benchmark é inferior à precisão exibida acima.

## Validação canônica do P‑Delta

Foi incluído um ensaio independente de viga-coluna em balanço:

- altura `L = 6 m`;
- `E = 30 GPa`;
- `I = 0,0054 m⁴`;
- compressão de topo `P = 4000 kN`;
- força horizontal `H = 10 kN`;
- discretização em 4 elementos.

A solução contínua usada como referência é:

`δ = H/P · [tan(kL)/k − L]`

com:

`k = sqrt(P/EI)`.

Resultados do CI:

- solução analítica: `δ = 6,913363 mm`;
- AstraStruct P‑Delta: `δ = 6,913317 mm`;
- convergência: `3 iterações`.

Outro teste confirma que, quando `N = 0`, o modo P‑Delta reproduz a solução linear.

## Validação da flambagem de Euler

A flambagem linear foi verificada em uma coluna biarticulada contra:

`Pcr = π² EI / L²`.

Resultados do CI para o benchmark atual:

- referência de Euler: `λcr,1 = 98,69604401`;
- AstraStruct: `λcr,1 = 98,69668565`;
- `λcr,2 / λcr,1 = 4,00039`, próximo da razão teórica `4`.

## Ligações semirrígidas

Cada extremidade de um elemento de pórtico pode ser configurada como:

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

## Tensões elásticas de seção

O painel **Tensões** recupera:

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`.

Para concreto armado, essas tensões correspondem à seção bruta linear elástica. Não representam seção fissurada, tensões na armadura, ELU/ELS ou verificação normativa.

O canvas também oferece um mapa de `|σ|max` em MPa. Com envelope ativo, o mapa usa o maior valor absoluto encontrado entre os cenários avaliados.

## Casos, combinações e envelopes

O **Scenario Engine** resolve casos e combinações customizadas, incluindo cargas nodais, cargas de barra, peso próprio, ações térmicas e recalques.

O módulo **Diagramas** fornece resposta contínua e envelopes mínimo/máximo. Se o projeto está no modo P‑Delta, cada cenário do envelope é resolvido pelo solver P‑Delta.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

## Interface principal

- **Análise** — Linear/P‑Delta, tolerância e número máximo de iterações;
- **Estabilidade** — `λcr`, modos críticos, forma modal e definição de `e0` para o P‑Delta;
- **Ligações** — rígida, semirrígida ou rótula por extremidade;
- **Cargas+** — carga pontual em barra, peso próprio e recalques;
- **Molas/Térmica** — `ΔT`, gradiente térmico, `α`, `kx`, `ky`, `kr`;
- **Tensões** — `N/A ± Mc/I`;
- **Diagramas** — `N(x)`, `V(x)`, `M(x)`, deformada e envelopes;
- **Sonda** — resultados por seção diretamente no elemento;
- **Mapa |σ|** — tensão elástica máxima ao longo do modelo;
- **Propriedades** — materiais e seções paramétricas;
- **Relatório** — memória técnica A4 do modelo e dos resultados.

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
- amplificação de imperfeição modal contra solução fechada.

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

Pipeline não linear-alvo:

`Geometry → Mesh → Initial Imperfection → Material State → Increment → Tangent → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- offsets e excentricidades rígidas;
- formulação co-rotacional / grandes rotações;
- Newton–Raphson incremental-iterativo geral;
- generalização da flambagem/imperfeição para releases e ligações semirrígidas;
- plasticidade do aço e modelos constitutivos de concreto;
- concrete damage/cracking, bond-slip e pull-out de ancoragens;
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
