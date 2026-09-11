# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.8:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A pasta `web/` é publicada automaticamente por GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós e drag-and-drop, com snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz`, deslocamentos impostos e releases rotacionais por condensação estática;
- cargas nodais `Fx`, `Fy`, `Mz`, cargas distribuídas locais `qx`, `qy`, carga pontual por `x/L` e peso próprio automático `w = γA`;
- ações térmicas uniformes `ΔT` em pórticos e treliças;
- gradiente térmico topo−base em pórticos, com curvatura inicial `κT = −αΔTg/h`;
- molas nodais lineares ao solo `kx`, `ky`, `kr`, com recuperação da força resistente `−k·u`;
- múltiplos casos de ação e combinações lineares customizadas, incluindo recalques e ações térmicas;
- solver matricial real, reações, deslocamentos, forças de mola e esforços de extremidade;
- pós-processamento contínuo `N(x)`, `V(x)`, `M(x)` e `v(x)` em 41 seções por elemento;
- tensões elásticas de seção `σ = N/A − My/I`, com `σtop` e `σbase` quando a profundidade geométrica da seção é conhecida;
- envelopes matemáticos entre casos e combinações, incluindo tensões elásticas;
- deformada no canvas e diagramas SVG interativos;
- biblioteca paramétrica editável de materiais e seções;
- seções retangulares, circulares, perfil I genérico, tubo retangular, barra axial e seção customizada;
- cálculo automático de `A` e `I` e sincronização com os elementos;
- visualização no canvas de carga pontual, peso próprio, recalques, ações térmicas e molas;
- gerenciador de ações/combinações, editor `Cargas+`, painel `Molas/Térmica` e painel `Tensões`;
- relatório técnico A4 reproduzível, incluindo ações térmicas, molas e tensões elásticas;
- importação/exportação JSON, exportação SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, com pipeline linear e contratos preparados para solver não linear futuro.

## Formulação linear atual

O núcleo opera em pequenas deformações e material linear elástico. Elementos de pórtico utilizam três graus de liberdade por nó `(Ux, Uy, Rz)` e cinemática Euler–Bernoulli; treliças trabalham axialmente.

O sistema global segue:

`K u = F`

Para deslocamentos prescritos/recalques:

`Kff uf = Ff − Kfc uc`

Para expansão térmica uniforme:

`εT = α ΔT`

`NT = E A εT`

Para gradiente térmico em pórticos:

`κT = −α (Ttop − Tbase) / h`

`MT = E I κT`

As ações térmicas são tratadas como deformações iniciais/equivalentes nodais. O esforço final depende das restrições, continuidade, releases e molas do modelo.

Molas nodais lineares são adicionadas diretamente à diagonal da matriz global de rigidez nos graus de liberdade correspondentes.

## Tensões elásticas de seção

O botão **Tensões** recupera, ao longo de cada elemento:

`σN = N/A`

`σtop = N/A − M c/I`

`σbase = N/A + M c/I`

A convenção é tração positiva. Para pórticos, `M > 0` é sagente e o eixo local `+y` aponta para o topo da seção.

> Para concreto armado, essas tensões correspondem à seção bruta linear elástica. Não representam seção fissurada, tensões de armadura, redistribuição, ELU/ELS ou verificação normativa.

## Casos, combinações e envelopes

O **Scenario Engine** separa o caso editado do cenário analisado. Uma combinação customizada como

`COMB1 = 1.20 G + 1.50 Q`

é resolvida por superposição linear de cargas nodais, cargas de barra, peso próprio, ações térmicas e recalques pertencentes aos casos.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

O módulo **Diagramas** apresenta resposta contínua e envelope mínimo/máximo dos cenários definidos. Esse envelope é matemático e não deve ser confundido com envelope normativo ELU/ELS.

## Biblioteca de propriedades

O botão **Propriedades** gerencia materiais e seções. Materiais incluem `E`, `ν`, `γ`, resistências de referência e coeficiente de dilatação térmica `α`. A v0.8 fornece valores iniciais de `α = 10×10⁻⁶/°C` para concreto/graute e `12×10⁻⁶/°C` para aço, sempre editáveis pelo usuário.

Perfis comerciais oficiais e catálogos de fabricantes ainda não fazem parte da biblioteca atual; quando adicionados, deverão ser versionados e rastreáveis.

## Carregamentos e propriedades avançadas

O botão **Cargas+** permite carga concentrada diretamente em barra, peso próprio e deslocamentos impostos/recalques.

O botão **Molas/Térmica** permite:

- definir `ΔT` uniforme por elemento e caso;
- definir `ΔT topo−base` em elementos de pórtico;
- editar `α` do material usado pelo elemento;
- atribuir `kx`, `ky` e `kr` aos nós.

Gradiente térmico exige profundidade geométrica conhecida da seção. Treliças aceitam apenas temperatura uniforme.

## Relatório técnico

O botão **Relatório** gera uma página A4 independente contendo identificação e rastreabilidade do modelo, geometria, apoios, materiais, `α`, seções, ações, combinações, molas, deslocamentos, reações, esforços e tensões elásticas.

A página pode ser impressa ou salva como PDF pelo navegador. O relatório continua explicitamente identificado como resultado de software em desenvolvimento, sem equivaler a memória de cálculo certificada.

## Validação automatizada

O workflow **AstraStruct CI** executa verificação sintática e testes de regressão em cada push/PR. Entre os problemas canônicos testados estão:

- treliça 2D, pórtico 2D e modelo misto;
- viga biapoiada `L = 6 m`, `q = 20 kN/m`: `RA = RB = 60 kN`, `Mmax = 90 kN·m` e flecha central `3,600 mm`;
- na mesma viga 30 × 50 cm: tensões elásticas extremas `−7,2/+7,2 MPa` no ponto de `Mmax`;
- release rotacional com momento de extremidade aproximadamente nulo;
- carga pontual central `P = 100 kN`: `RA = RB = 50 kN` e `Mmax = 150 kN·m`;
- peso próprio RC: `RA = RB = 11,25 kN`, `Mmax = 16,875 kN·m`;
- barra axial com deslocamento imposto de `1 mm`: `N = 200 kN`;
- expansão térmica livre de barra de aço: `ux = 1,2 mm` e `N ≈ 0`;
- mesma barra termicamente impedida: `N = −1200 kN`;
- gradiente térmico em viga fixo-fixo: momentos `−37,5/+37,5 kN·m`;
- barra com mola axial: `u = 0,1 mm`, `N = 100 kN` e força da mola `−10 kN` sob `P = 110 kN`;
- superposição de casos/combinações e envelopes.

## Executar localmente

```bash
python -m http.server 8080 --directory web
```

Abra `http://localhost:8080`.

Para verificar o código e executar os testes:

```bash
npm run check
npm test
```

Requer Node.js 24 ou superior para o workflow atual.

## Arquitetura-alvo

A interface e o núcleo numérico permanecem desacoplados. A evolução prevista permite JavaScript/TypeScript no navegador, WebAssembly em Rust/C++/Fortran, serviços Python científicos e backend HPC remoto.

A VNL representa o pipeline linear como:

`Geometry → Material → Section → Boundary → Load → Solver → Result → Plot`

E está preparada para evoluir para:

`Geometry → Mesh → Concrete Damage → Reinforcement → Bond-Slip → Contact → Increment → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- offsets e excentricidades rígidas;
- ligações semirrígidas por mola rotacional de extremidade;
- biblioteca versionada de perfis comerciais de aço e seções RC;
- laboratório de elementos isolados: barra, viga, pilar, ancoragem e ligação metálica;
- P-Delta e análise geométrica não linear;
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
