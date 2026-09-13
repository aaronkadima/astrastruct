# AstraStruct v0.30.3 — lajes, seções reais e inspeção de tensões

## Objetivo

A v0.30.3 consolida a base visual solicitada antes do avanço para novos módulos de dimensionamento. O foco desta revisão é permitir que o usuário veja a estrutura e os mecanismos locais em desenho, sem confundir representação gráfica com grandezas que o kernel mecânico ainda não resolve.

## Edifício predefinido de cinco pavimentos

O exemplo `demoFiveStoreyBuilding3D()` passou a possuir lajes `shell4` reais. Para a malha predefinida com três vãos em X, dois vãos em Y e cinco pavimentos, são gerados:

- 5 pavimentos elevados;
- 6 painéis de laje por pavimento;
- 30 elementos `shell4` no total;
- espessura inicial de laje igual a 0,15 m;
- material `concrete30`;
- conectividade com os mesmos nós das vigas e pilares de contorno.

A geração paramétrica `createGridBuilding3D()` usa `includeSlabs=true` por padrão e aceita `slabThickness`.

### Compatibilidade de carregamento

Nesta revisão, a carga gravitacional do exemplo continua representada pelas cargas nodais que já existiam antes da introdução das lajes. Isso é deliberado para não alterar silenciosamente os resultados históricos do exemplo. A presença dos elementos `shell4` não deve ser interpretada como conversão automática dessas cargas nodais para pressão de superfície.

## Modos de visualização 3D

O `SpatialCanvas3D` oferece quatro modos selecionáveis.

### Esqueleto

Representação por eixos de barras e contornos das lajes. É o modo mais leve para lançamento, conectividade e conferência topológica.

### Frames transparentes

Vigas e pilares são convertidos em prismas com as dimensões reais da seção e exibidos com baixa opacidade. Lajes usam a espessura real. A transparência facilita a inspeção de elementos internos.

### Seções reais

Vigas e pilares são desenhados com `b × h` obtidos da seção cadastrada. A orientação local do elemento define os eixos da seção. Elementos `shell4` são visualizados como sólidos com faces superior e inferior separadas pela espessura real.

### Realista

Usa a mesma geometria de seções reais, acrescentando diferenciação básica por material e sombreamento geométrico das faces. O objetivo é melhorar percepção espacial sem converter o Canvas em um renderizador fotorealista.

## Estrutura original e deformada

A geometria de seção real é independente das coordenadas usadas para renderização. Portanto, o mesmo prisma pode ser gerado com:

- coordenadas originais;
- coordenadas deslocadas da análise;
- fator de ampliação definido pelo usuário;
- fase animada em modos próprios para animação.

Quando existe um resultado 3D, o usuário pode mostrar ou ocultar a geometria original e sobrepor a deformada com seções reais.

Os campos de esforços de barras e os contornos `shell4` continuam usando o mecanismo de visualização científica existente. Quando um campo é selecionado, o Canvas prioriza a leitura do contorno/campo em vez de cobri-lo com faces sólidas opacas.

## Geometria de seção real

O módulo `web/src/view/spatialSectionGeometry3d.js` centraliza a geometria visual.

### Barras

`frameSectionPrism3D()`:

- usa os extremos do elemento;
- determina o eixo local longitudinal;
- usa a orientação local existente quando disponível;
- resolve `b` e `h` da seção;
- constrói seis faces de um prisma retangular;
- aceita extremos deslocados para a configuração deformada.

### Lajes e cascas

`shellSectionPrism3D()`:

- usa os quatro nós do `shell4`;
- calcula a normal da superfície média;
- desloca as faces superior e inferior de `±t/2`;
- cria as quatro faces laterais;
- aceita coordenadas deformadas dos quatro nós.

## Arrancamento aço–concreto

O laboratório de pull-out mantém a curva força–deslizamento e o perfil quantitativo `τ(z)`, e acrescenta um corte técnico da interface.

O desenho mostra:

- barra/chumbador;
- corpo de concreto;
- comprimento embutido;
- faixa colorida de `|τ|` ao longo da interface;
- posição de `τmax`;
- profundidade correspondente;
- slip local no ponto crítico;
- força de pull-out no estado de pico.

Neste caso, a tensão de aderência é uma grandeza diretamente fornecida pelo kernel τ–s e não apenas uma grandeza visual derivada.

## Punção

O laboratório de punção mantém a curva `τ(s)` e acrescenta um mapa em planta do perímetro crítico.

O mapa mostra:

- laje em planta;
- geometria do pilar;
- perímetro crítico analisado;
- segmentos coloridos continuamente por `τ`;
- espessura gráfica da faixa proporcional a `|τ|`;
- pequenos vetores de inspeção do sinal do fluxo;
- posição e valor de `|τ|max`;
- `V`, `Mx` e `My` usados no cálculo.

A distribuição é a mesma calculada pelo kernel `q=a+b·x+c·y`, com `τ=q/d`.

## Contato parafuso–furo circular

O kernel atual resolve contato radial unilateral por parafuso e retorna:

- deslocamento relativo;
- penetração;
- força radial resultante;
- estado de contato;
- equilíbrio do grupo.

Ele não resolve a distribuição local Hertziana/FEM de pressão na borda. Para permitir inspeção sem fabricar um campo local, a interface visual calcula a tensão média equivalente de bearing

`σb,eq = V / (t d)`

onde `V` é a força resultante do parafuso, `t` é a espessura da chapa informada para inspeção e `d` é o diâmetro do parafuso informado para inspeção.

O detalhe gráfico mostra:

- furo;
- parafuso deslocado;
- folga;
- setor/direção ativa do contato;
- resultante;
- penetração;
- `σb,eq`;
- identificação do parafuso crítico.

A interface informa explicitamente que o setor colorido não é uma distribuição de pressão Hertziana ou FEM.

## Contato em furo oblongo

O laboratório de rasgo usa a mesma tensão média equivalente `σb,eq`, mas o desenho preserva a geometria cápsula do kernel.

O detalhe mostra:

- comprimento e orientação do rasgo;
- posição deslocada do parafuso;
- coordenada no rasgo;
- ponto de contato;
- normal de contato;
- penetração;
- força resultante;
- `σb,eq`;
- parafuso crítico.

## Ensaios automatizados

A revisão acrescenta ou amplia regressões para verificar:

- 30 lajes `shell4` no edifício predefinido;
- 6 painéis por pavimento;
- espessura real de 0,15 m;
- geração paramétrica com lajes e modo `includeSlabs=false` para fixtures que exigem apenas barras;
- prismas de barras com `b × h` real;
- sólidos de laje com `±t/2`;
- geometria de seção real na configuração deformada;
- alternância dos quatro modos de visualização no navegador;
- sobreposição original/deformada;
- mapa τ da ancoragem;
- mapa τ do perímetro de punção;
- mapa `σb,eq` em furos circulares;
- mapa `σb,eq` e normal de contato em furos oblongos.

## Limitações mantidas de forma explícita

A v0.30.3 ainda não transforma visualização em dimensionamento normativo automático. Permanecem separados:

- resistências normativas de punção;
- ruptura de cone, borda e pry-out em ancoragens;
- pressão local Hertziana ou contato 2D/3D distribuído na borda do furo;
- plastificação/flexibilidade distribuída da chapa da ligação;
- transferência por atrito/pré-tensão em ligações slip-critical;
- conversão automática das cargas nodais históricas do exemplo de cinco pavimentos em pressões de laje.

Essa separação preserva rastreabilidade entre geometria, demanda mecânica, campo efetivamente calculado e grandezas de inspeção derivadas.
