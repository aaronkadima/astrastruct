# AstraStruct v0.30 — Lab de punção: demanda no perímetro crítico

## Escopo

O módulo `punchingPerimeter` calcula a **distribuição mecânica de demanda** ao longo de um perímetro crítico fechado submetido a força cortante vertical `V` e momentos não balanceados `Mx` e `My`.

O objetivo desta etapa é separar claramente dois problemas diferentes:

1. determinar como as ações globais são distribuídas ao longo do perímetro;
2. verificar a resistência do concreto, fibras ou armadura de punção segundo um modelo ou norma.

A versão atual implementa apenas o primeiro problema. Portanto, o resultado `τ` é uma **demanda**, e não uma razão de segurança nem uma resistência normativa.

## Perímetro

A interface inicial utiliza um perímetro retangular obtido a partir das dimensões do pilar e de um afastamento configurável expresso em múltiplos da profundidade efetiva `d`.

O kernel, entretanto, recebe uma poligonal fechada genérica, permitindo futuramente perímetros de borda, canto, aberturas ou formas arbitrárias.

Para cada segmento do perímetro são calculadas analiticamente as integrais de linha:

- `I0 = ∮ ds`;
- `Ix = ∮ x ds`;
- `Iy = ∮ y ds`;
- `Ixx = ∮ x² ds`;
- `Ixy = ∮ xy ds`;
- `Iyy = ∮ y² ds`.

Não é utilizada discretização numérica para montar essas propriedades geométricas em segmentos retos.

## Distribuição de fluxo cortante

A hipótese cinemática/mecânica adotada é um fluxo cortante linear no plano:

`q(x,y) = a + b x + c y`

com unidades de força por comprimento.

Os coeficientes `a`, `b` e `c` são obtidos impondo exatamente os três resultantes:

`V  = ∮ q ds`

`Mx = ∮ y q ds`

`My = -∮ x q ds`.

Isso produz o sistema simétrico

`G [a b c]^T = [V -My Mx]^T`

com

`G = [[I0, Ix, Iy], [Ix, Ixx, Ixy], [Iy, Ixy, Iyy]]`.

A tensão de cisalhamento de demanda é então

`τ(x,y) = q(x,y) / d`.

Para `Mx = My = 0`, o resultado reduz exatamente a

`τ = V / (u d)`

em que `u` é o comprimento do perímetro crítico.

## Convenção de sinais

A implementação usa:

- `V > 0`: fluxo positivo uniforme;
- `Mx = ∮ y q ds`;
- `My = -∮ x q ds`.

A interface apresenta a curva de `τ` em função da coordenada curvilínea `s` e um mapa em planta do perímetro.

## Resultados

O módulo retorna:

- comprimento `u` do perímetro;
- tensão média `V/(u d)`;
- distribuição `q(s)` e `τ(s)`;
- `τmin`, `τmax` e `|τ|max`;
- posição `(x,y)` do extremo crítico;
- fator de amplificação `|τ|max / |τmédia|`, quando definido;
- coeficientes `a`, `b`, `c`;
- recuperação dos resultantes `V`, `Mx`, `My`;
- resíduo de equilíbrio numérico.

A interface permite exportar a amostragem para CSV. O gráfico SVG utiliza o mesmo fluxo de exportação científica vetorial do AstraStruct.

## Unidades

Na interface:

- dimensões do pilar, `d` e afastamentos: `mm`;
- `V`: `kN`;
- `Mx`, `My`: `kN·m`;
- resultado `τ`: `MPa`.

Internamente são utilizados `m`, `kN`, `kN·m` e `kN/m²`.

## Benchmarks

A suíte `tests/punching-perimeter-v030-smoke.mjs` verifica:

1. `V` centrado → tensão uniforme `V/(u d)`;
2. momento puro `Mx` → distribuição antissimétrica proporcional a `y`;
3. momento puro `My` → distribuição proporcional a `-x` com a convenção adotada;
4. carregamento combinado `V + Mx + My` → recuperação exata dos três resultantes;
5. rejeição de perímetro degenerado.

## Limitações deliberadas

Esta versão **não** calcula:

- resistência do concreto sem armadura de punção;
- contribuição de fibras;
- contribuição de studs/estribos;
- perímetros normativos automáticos de ACI, Eurocode, NBR ou fib Model Code;
- redução de perímetro por bordas ou aberturas;
- redistribuição não linear após fissuração;
- interação explícita com momento transferido por flexão da laje.

Esses itens devem ser implementados como camadas separadas sobre o kernel de demanda para preservar rastreabilidade e permitir comparar diferentes normas/modelos sem alterar a mecânica de distribuição das ações.

## Próxima extensão recomendada

A próxima etapa pode adicionar um **gerador de perímetros normativos** (ACI / EC2 / NBR / fib) e módulos de resistência independentes. Dessa forma, o mesmo campo de demanda pode ser confrontado com diferentes critérios sem esconder as hipóteses de cada norma.
