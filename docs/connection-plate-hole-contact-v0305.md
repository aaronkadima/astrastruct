# AstraStruct v0.30.5 — chapa flexível com furo explícito e bearing distribuído

## Escopo

A v0.30.5 adiciona um módulo experimental para inspeção mecânica de uma chapa de aço plana com furos circulares e parafusos rígidos. O objetivo é superar a representação de bearing por uma única força concentrada e disponibilizar uma distribuição espacial de pressão ao longo do contorno do furo.

O módulo é separado do cálculo normativo. Ele não substitui verificações de resistência de parafusos, block shear, rasgamento de borda, seção líquida, prying ou ligação por atrito.

## Domínio da chapa

A chapa é discretizada por elementos quadrilaterais Q4 de membrana em estado plano de tensões. O domínio geométrico base é retangular e cada furo circular é definido por

- centro `(xc, yc)`;
- diâmetro do parafuso `db`;
- folga radial `g`;
- raio do furo `rh = db/2 + g`.

A área interior a `rh` não participa da resposta resistente da chapa. Nos elementos Q4 atravessados pelo círculo, a integração de volume é substituída por quadratura composta. Pontos de integração localizados dentro do furo recebem apenas uma rigidez fictícia muito pequena (`voidStiffnessRatio`, padrão `1e-7`) para condicionamento numérico. Essa contribuição não é contabilizada como área resistente, tensão ou plastificação.

Portanto, o método é um **embedded/cut-cell domain**, não uma malha conformada ao círculo. O círculo usado para o contato, entretanto, permanece geometricamente circular e independente da discretização retangular.

## Material da chapa

O estado elástico usa a matriz de estado plano de tensões

`D = E/(1-ν²) [[1,ν,0],[ν,1,0],[0,0,(1-ν)/2]]`.

A tensão equivalente é avaliada por von Mises

`σvm = sqrt(σx² - σx σy + σy² + 3 τxy²)`.

A plastificação disponível nesta versão é monotônica, bilinear e secante. Para `σvm > fy`, a tensão trial é reduzida radialmente por um fator escalar de forma que a tensão equivalente alvo seja

`σtarget = fy + h (σvm,trial - fy)`,

onde `h` é a razão de rigidez pós-escoamento informada pelo usuário.

Esse recurso permite observar perda de rigidez e redistribuição na chapa, mas ainda não constitui integração constitutiva J2 incremental completa com memória plástica, retorno radial consistente e carregamento cíclico.

## Contato parafuso–furo

O contorno circular é dividido em `Nθ` segmentos. Para um segmento de ângulo `θ`, usa-se

`n(θ) = [cos θ, sin θ]`.

O deslocamento da chapa no ponto do contorno é interpolado a partir do Q4 que contém o ponto. A abertura normal linearizada é

`c(θ) = g + u(θ) · n(θ)`.

A penetração unilateral é

`δ(θ) = max(0, -c(θ))`.

O contato é sem atrito. A pressão normal de penalidade é

`p(θ) = kn δ(θ)`,

com `kn` em força por volume. Na interface, o Lab recebe `kn` em MPa/mm e converte para o sistema interno.

A força transferida em cada segmento é integrada na superfície cilíndrica da espessura da chapa:

`dF = -p(θ) n(θ) t ds`,

com

`ds = rh dθ`.

A soma dos segmentos fornece a resultante de bearing do furo. O solver também retorna:

- pressão máxima `pmax`;
- arco ativo total;
- centro angular ponderado da pressão;
- força resultante `Fx, Fy`;
- tensão média equivalente `σb,eq = V/(t db)`.

`σb,eq` é apenas uma grandeza de inspeção comparável à representação média do Lab anterior; ela não substitui `p(θ)` e não é uma resistência normativa.

## Ovalização

O deslocamento médio do contorno é removido antes de medir deformação radial, evitando confundir translação rígida da chapa com mudança de forma do furo.

Para cada segmento:

`ur(θ) = [u(θ) - ū] · n(θ)`.

A medida de ovalização usada no Lab é

`Δoval = max ur(θ) - min ur(θ)`.

Também é reportada a razão `Δoval/(2 rh)`.

Essa métrica é geométrica e adequada para inspeção comparativa. Ela não representa, por si só, um critério de ruptura ou limite normativo.

## Condição de contorno do caso atual

O bordo `x=L` é tratado como uma linha rígida no plano:

- `ux = Δ` uniforme ao longo do bordo;
- `uy = 0` ao longo do mesmo bordo.

Isso representa um bordo de acionamento ligado a um corpo rígido e evita deriva transversal espúria no benchmark simétrico de cisalhamento direto.

O parafuso é rígido e permanece fixo no centro inicial do furo. Não há rotação, pré-tensão ou deslizamento por atrito do parafuso nesta versão.

## Visualização do Lab

O laboratório **Chapa · furo explícito** apresenta:

1. mapa `σvm/fy` da chapa;
2. círculo geométrico real do furo;
3. círculo do parafuso;
4. arco do contorno colorido de acordo com `p(θ)`;
5. contorno deformado do furo com escala configurável;
6. vetor de resultante de bearing;
7. curva pressão–ângulo do furo crítico;
8. tabela por furo com `V`, `pmax`, arco ativo, `θc`, ovalização e `σb,eq`;
9. exportação CSV de cada segmento de contato;
10. exportação SVG do mapa de inspeção.

## Verificações de regressão

O smoke test da v0.30.5 verifica:

- área vazada numérica contra `Σ π rh²`;
- ausência de pressão antes do fechamento da folga;
- ativação distribuída do contato após o fechamento;
- equilíbrio entre força aplicada e resultantes dos furos;
- centro de pressão no lado de bearing esperado para carregamento em `+x`;
- simetria superior/inferior do grupo;
- redistribuição entre colunas de parafusos quando a chapa é flexível;
- ovalização não nula após contato;
- plastificação da chapa para `fy` reduzido;
- finitude dos campos de pressão exportados.

A regressão Playwright verifica o fluxo completo do Lab, mapa, curva `p(θ)`, tabela e exportações CSV/SVG.

## Limitações deliberadas

Ainda não estão incluídos:

- contato tangencial/fricção;
- pré-tensão e ligação slip-critical;
- contato 3D entre haste e espessura do furo;
- pressão Hertziana/local 3D;
- flexão fora do plano e prying;
- plasticidade J2 incremental completa e carregamento reverso;
- crescimento permanente do furo após descarregamento;
- dano/rasgamento da chapa;
- block shear e ruptura de seção líquida;
- rasgamento de borda;
- resistência normativa automática;
- cone/borda de concreto ou interação aço–concreto.

## Próxima evolução recomendada

A sequência física natural após esta versão é:

1. adicionar contato tangencial opcional e pré-tensão/slip-critical;
2. introduzir critérios locais de chapa — seção líquida, bearing/tear-out e block shear — como módulos normativos separados do solver mecânico;
3. implementar formulação de dano/plasticidade local que permita ovalização permanente;
4. estender a ligação para chapa flexível fora do plano e prying;
5. acoplar a ligação metálica a mecanismos de ancoragem/concreto quando a conexão envolver chumbadores.
