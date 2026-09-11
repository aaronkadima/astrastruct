# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual — v0.7:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## Executar online

**Aplicativo:** https://aaronkadima.github.io/astrastruct/

A pasta `web/` é publicada automaticamente por GitHub Actions após cada atualização da branch `main`.

## O que já é executável

- modelagem 2D por dois pontos/nós e drag-and-drop, com snap, grid, seleção e edição paramétrica;
- elementos `frame2d` Euler–Bernoulli, `truss2d` e modelos mistos pórtico + treliça;
- apoios `Ux`, `Uy`, `Rz` e releases rotacionais de extremidade por condensação estática;
- cargas nodais `Fx`, `Fy`, `Mz`;
- cargas distribuídas locais `qx`, `qy`;
- carga pontual diretamente sobre barra, parametrizada por `x/L` e eixos locais;
- peso próprio automático `w = γA`, com gravidade global `−Y` e transformação para os eixos locais;
- recalques/deslocamentos impostos como ações pertencentes a casos de carregamento;
- múltiplos casos de ação e combinações lineares customizadas;
- solver matricial real, reações, deslocamentos e esforços de extremidade;
- pós-processamento contínuo `N(x)`, `V(x)`, `M(x)` e `v(x)` em 41 seções por elemento;
- envelopes matemáticos entre casos e combinações;
- deformada no canvas e diagramas SVG interativos;
- biblioteca paramétrica editável de materiais;
- seções retangulares, circulares, perfil I genérico, tubo retangular, barra axial e seção customizada;
- cálculo automático de `A` e `I` e sincronização com elementos que usam a seção;
- visualização no canvas de carga pontual, peso próprio e recalques do caso ativo;
- gerenciador de ações/combinações e editor `Cargas+`;
- relatório técnico A4 reproduzível, print-friendly/PDF pelo navegador;
- importação/exportação JSON, exportação SVG, autosave, undo/redo e command palette;
- VNL — **Visual Nonlinear Language**, com pipeline linear e contratos preparados para solver não linear futuro.

## Solver e formulação atual

O núcleo atual opera em pequenas deformações e material linear elástico. Elementos de pórtico utilizam três graus de liberdade por nó `(Ux, Uy, Rz)` e cinemática Euler–Bernoulli; treliças trabalham axialmente.

O sistema global segue:

`K u = F`

Para deslocamentos prescritos/recalques, a partição utilizada é:

`Kff uf = Ff − Kfc uc`

Releases rotacionais são tratados por condensação estática no nível do elemento. Cargas distribuídas e concentradas em barras são convertidas em vetores nodais consistentes antes da montagem global.

## Casos, combinações e envelopes

O **Scenario Engine** separa o caso que está sendo editado do cenário que será analisado. Uma combinação customizada como

`COMB1 = 1.20 G + 1.50 Q`

é resolvida pela superposição linear dos vetores de ações, inclusive recalques prescritos pertencentes a cada caso.

> Os fatores atuais são **Custom/User-defined**. Não representam combinações oficiais da ABNT NBR, ACI, Eurocodes ou fib Model Code.

O módulo **Diagramas** apresenta resposta contínua por elemento e pode gerar envelope mínimo/máximo de todos os cenários definidos no projeto. Esse envelope é matemático e não deve ser confundido com um envelope normativo ELU/ELS.

## Biblioteca de propriedades

O botão **Propriedades** abre a biblioteca de materiais e seções. Os materiais permitem editar, entre outros, `E`, `ν`, `γ`, `fy`, `fu` e `fck/fc'`. As seções geométricas paramétricas calculam automaticamente área e momento de inércia para uso pelo solver.

Perfis comerciais oficiais e catálogos de fabricantes ainda não fazem parte da biblioteca atual; quando adicionados, deverão ser versionados e rastreáveis.

## Carregamentos avançados

O botão **Cargas+** permite definir:

- carga concentrada diretamente em uma barra por `x/L`;
- peso próprio por caso de carregamento;
- deslocamentos impostos/recalques nos DOFs restringidos.

As ações avançadas aparecem também no canvas do caso ativo.

## Relatório técnico

O botão **Relatório** abre uma página A4 independente contendo:

- identificação e rastreabilidade do modelo;
- geometria esquemática;
- apoios e graus de liberdade;
- materiais e seções;
- ações e combinações;
- hipóteses de análise;
- deslocamentos e reações;
- esforços nas extremidades;
- versão do schema, solver e cenário.

A página pode ser impressa ou salva como PDF pelo próprio navegador. O relatório permanece explicitamente identificado como resultado de software em desenvolvimento, sem equivaler a memória de cálculo certificada.

## Validação automatizada

O workflow **AstraStruct CI** executa verificação sintática do frontend e testes de regressão do solver em cada push/PR. Entre os problemas canônicos atualmente testados estão:

- treliça 2D;
- pórtico 2D;
- modelo misto pórtico + treliça;
- viga biapoiada `L = 6 m`, `q = 20 kN/m`: `RA = RB = 60 kN`, `Mmax = 90 kN·m` e flecha central `3,600 mm`;
- release rotacional com momento de extremidade aproximadamente nulo;
- viga `L = 6 m` com carga pontual central `P = 100 kN`: `RA = RB = 50 kN` e `Mmax = 150 kN·m`;
- peso próprio de seção RC `A = 0,15 m²`, `γ = 25 kN/m³`: `RA = RB = 11,25 kN`, `Mmax = 16,875 kN·m`;
- barra axial com deslocamento imposto de `1 mm`: esforço normal `200 kN` no caso de referência;
- superposição de casos/combinações e geração de envelopes.

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

A interface e o núcleo numérico permanecem desacoplados. A evolução prevista permite utilizar:

- JavaScript/TypeScript no navegador para análises leves;
- WebAssembly em Rust/C++/Fortran para kernels numéricos de alto desempenho;
- serviços Python científicos;
- backend HPC remoto.

A VNL representa pipelines como:

`Geometry → Material → Section → Boundary → Load → Solver → Result → Plot`

E está preparada para evoluir para:

`Geometry → Mesh → Concrete Damage → Reinforcement → Bond-Slip → Contact → Increment → Newton Solver → Convergence → Result`

## Próximas etapas prioritárias

- carga térmica e gradiente térmico;
- offsets, excentricidades, molas e ligações semirrígidas;
- biblioteca versionada de perfis comerciais de aço e seções RC;
- resposta elástica de tensões na seção;
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
