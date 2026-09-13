# AstraStruct v0.34 — Section Engine

## 1. Escopo

A v0.34 introduz um motor seccional independente dos elementos estruturais. Ele fornece geometria, discretização de fibras, leis constitutivas uniaxiais, resposta seccional biaxial e equilíbrio inverso para seções de aço, concreto armado, compósitas e arbitrárias.

A cadeia desta versão é:

`geometry → section properties → fibers/cells → material laws → N–My–Mz response → inverse equilibrium → steel/RC/composite builders`

A v0.34 **não** introduz malha estrutural geral, novos shells, shell-frame coupling, novos elementos de barra, contato ou Load/Stage Engine. Esses blocos permanecem reservados às versões posteriores.

## 2. Sistema de eixos e deformação generalizada

A seção ocupa o plano local `y-z`. O eixo longitudinal do elemento é `x`.

A deformação axial é assumida afim no plano:

`ε(y,z) = ε0 - κy z + κz y`.

O vetor de deformações generalizadas é

`e = [ε0, κy, κz]^T`.

Para uma fibra localizada em `(y,z)`, define-se

`B = [1, -z, y]`,

portanto

`ε = B e`.

A convenção de resultantes é

`S = [N, My, Mz]^T = ∫A B^T σ dA`.

Assim:

- `N = ∫A σ dA`;
- `My = ∫A (-z) σ dA`;
- `Mz = ∫A y σ dA`.

## 3. Propriedades geométricas

`web/src/sections/geometry.js` fornece propriedades exatas por integração poligonal para área, centróide e inércias:

- `A`;
- `cy`, `cz`;
- `Iy = ∫ z² dA`;
- `Iz = ∫ y² dA`;
- `Iyz = ∫ yz dA`;
- eixos e momentos principais;
- raios de giração;
- módulos elásticos em relação aos eixos de referência quando os extremos são conhecidos.

Para retângulo, perfil I/H duplamente simétrico e RHS também são fornecidos módulos plásticos geométricos.

### 3.1 Torção e empenamento

O engine não inventa propriedades para geometrias sem formulação implementada.

- retângulo sólido: `J` por aproximação clássica de retângulo;
- I/H aberto: `J = Σ b t³ / 3` no modelo de parede fina;
- I/H duplamente simétrico: `Cw = b³ tf (h - tf)² / 24` no modelo de Vlasov adotado;
- RHS uniforme de parede fina: `J` por Bredt–Batho na linha média;
- polígono arbitrário: `J` e `Cw` permanecem `null` até existir solução específica de torção/empenamento;
- RHS: `Cw` permanece `null` nesta versão.

O modelo utilizado é registrado em `torsionModel` e `warpingModel`.

### 3.2 Centro de cisalhamento e áreas de cisalhamento

Para seções duplamente simétricas padrão, o centro de cisalhamento coincide com o centróide. Para geometria arbitrária ele não é inferido.

A área de cisalhamento do retângulo usa `5A/6`. Para o perfil I/H é fornecida somente a aproximação explícita baseada na alma para a direção principal correspondente; valores não implementados permanecem `null`.

## 4. Discretização por fibras/células

`web/src/sections/fibers.js` implementa:

- grade retangular;
- perfil I/H;
- RHS;
- polígono arbitrário por células cujo centróide pertence ao domínio;
- fibras discretas para barras de armadura e inclusões;
- subtração de área de armadura da matriz de concreto;
- recuperação das propriedades geométricas da discretização.

Uma célula de área finita armazena:

- `A_f`;
- centróide `(y_f,z_f)`;
- `IyLocal`, `IzLocal`, `IyzLocal`.

Esses momentos locais evitam que uma célula retangular seja reduzida matematicamente a um ponto para resposta elástica.

## 5. Integração consistente da célula

A tensão e a tangente constitutiva são avaliadas no centróide da célula. A continuação afim da deformação dentro da célula é integrada analiticamente usando seus momentos locais.

Para material linear, isso reproduz exatamente os termos geométricos da célula:

`K00 = Et A`

`K01 = -Et A zc`

`K02 = Et A yc`

`K11 = Et (A zc² + IyLocal)`

`K22 = Et (A yc² + IzLocal)`

`K12 = -Et (A yc zc + IyzLocal)`.

Os momentos resistentes da célula recebem as correções

`ΔMy = Et (κy IyLocal - κz IyzLocal)`

`ΔMz = Et (-κy IyzLocal + κz IzLocal)`.

Para material linear e campo de deformações afim, a integração é exata em cada célula. Para lei não linear, essa é a linearização tangente de primeira ordem ao redor do estado no centróide; refinamento da malha de fibras continua sendo necessário quando uma célula atravessa regiões constitutivas fortemente diferentes.

## 6. Leis constitutivas

`web/src/sections/materialLaws.js` fornece:

- material elástico uniaxial;
- aço/rebar bilinear reutilizando o kernel histórico `material1d.js`;
- concreto em compressão por lei parábola-retângulo simplificada;
- cutoff de tração por padrão;
- tração elástica limitada ou softening linear opcional.

Os estados informam, quando aplicável:

- escoamento;
- fissuração;
- esmagamento;
- ramo constitutivo;
- tensão e tangente.

Essas leis são modelos mecânicos do Section Engine e não constituem, por si, verificações normativas ACI/EN/ABNT.

## 7. Resposta N–My–Mz

`fiberSectionResponse3D()` retorna

`contract = section-response/v1`.

O resultado contém:

- `N`, `My`, `Mz`;
- matriz tangente 3×3;
- deformações generalizadas;
- estado de cada fibra;
- contagem de fibras escoadas, fissuradas e esmagadas;
- extremos de tensão/deformação;
- identificação do método de integração.

A tangente é

`Dsec = ∫A Et B^T B dA`.

Ela inclui acoplamentos axial-flexão e flexão biaxial quando a geometria/materialização não é simétrica.

## 8. Equilíbrio inverso

`solveSectionEquilibrium3D()` resolve o problema inverso:

`S(e) = Starget`,

com Newton e o solver linear do Numerical Core 2.

Em cada iteração:

`Dsec Δe = -(S(e) - Starget)`.

A rotina fornece histórico de convergência e lança `NonlinearConvergenceError` em estagnação ou não convergência, em vez de retornar estado silenciosamente inválido.

## 9. Builders

### 9.1 Aço

`createSteelSection()` suporta nesta versão:

- retângulo;
- I/H;
- RHS;
- polígono arbitrário.

### 9.2 Concreto armado

`createRCSection()` cria matriz de concreto retangular e barras discretas. Por padrão, a área geométrica das armaduras é retirada da matriz de concreto para preservar a área física total e evitar dupla contagem de material.

### 9.3 Compósito

`createCompositeSection()` aceita múltiplas regiões retangulares/poligonais com materiais distintos e inclusões discretas.

### 9.4 Arbitrário por fibras

`createArbitraryFiberSection()` aceita diretamente fibras e materiais definidos pelo chamador.

Todos os builders retornam

`contract = section-definition/v1`.

## 10. Contratos

A versão define:

- `section-engine/v1`;
- `section-geometry/v1`;
- `section-definition/v1`;
- `section-response/v1`;
- `section-equilibrium/v1`.

Esses contratos permanecem independentes do `element-component/v1` da v0.33. A integração plena entre Section Engine e novas famílias de elementos será realizada nas etapas de elementos previstas pelo roadmap, sem acoplar prematuramente o engine de seções aos solvers históricos.

## 11. Verificação determinística

`tests/section-engine-v034-smoke.mjs` cobre:

- polígono retangular contra solução analítica de `A`, `Iy`, `Iz`;
- módulos elástico e plástico do retângulo;
- propriedades de I/H e RHS;
- `J` e `Cw` somente nos modelos explicitamente implementados;
- conservação de área em seção RC;
- resposta elástica axial e biaxial `EA`, `EIy`, `EIz`;
- simetria da tangente elástica;
- recuperação inversa de `ε0`, `κy`, `κz`;
- compressão, fissuração e esmagamento do modelo de concreto;
- seção compósita com módulos diferentes.

O gate de release também preserva obrigatoriamente v0.33, v0.32 e as regressões P2/P3/P4.

## 12. Limites deliberados

Ficam fora da v0.34:

- solução geral de Saint-Venant para polígono arbitrário;
- `Cw` geral de seção aberta/fechada arbitrária;
- centro de cisalhamento geral;
- refinamento adaptativo da discretização da seção;
- biaxialidade constitutiva 2D/3D do material — as fibras usam leis uniaxiais;
- confinamento avançado de concreto, damage-plasticity e bond-slip;
- geração de superfícies normativas de resistência;
- malha estrutural geral e coupling shell-frame.

A próxima etapa somente após o gate integralmente verde desta versão é **v0.35 — Mesh & Surface Engine**.
