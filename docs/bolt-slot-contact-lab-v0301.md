# AstraStruct Lab v0.30.1 — contato em furo oblongo

## Objetivo

O módulo `boltGroupSlottedContact2d.js` estende o laboratório de ligações chapa–parafuso para furos oblongos orientáveis sem substituir o kernel circular já validado. O foco é a **demanda mecânica** em uma placa rígida no plano, com movimento livre dentro do furo, fechamento da folga e contato unilateral de bearing.

O módulo não calcula resistência normativa de parafusos, chapas ou concreto.

## Geometria do furo

Cada furo é idealizado como uma **cápsula**: um segmento reto de comprimento `Lslot` com uma região circular de folga radial `g` em torno do segmento. O eixo do rasgo é definido pelo ângulo `alpha`.

Para `Lslot = 0`, a geometria degenera exatamente em um furo circular com folga radial `g`.

Para o deslocamento relativo do parafuso `d = [dx, dy]`, usa-se o eixo unitário do rasgo

`u = [cos(alpha), sin(alpha)]`.

A projeção sobre o segmento central é limitada por

`s = clamp(d · u, -Lslot/2, +Lslot/2)`.

O ponto mais próximo do eixo do rasgo é

`q = s u`.

A distância normal ao segmento é

`rho = ||d - q||`.

A penetração mecânica que ativa o bearing é

`p = max(0, rho - g)`.

Enquanto `p = 0`, não há transferência de força pelo contato. Quando `p > 0`, a força atua na direção normal local

`n = (d - q) / rho`.

## Lei de bearing

O usuário pode adotar uma lei elástica ou bilinear:

- ramo elástico: `F = k p`;
- transição opcional em `Fy`;
- ramo pós-transição: `F = Fy + rpost k (p - py)`;
- `py = Fy / k`.

`Fy`, `k`, `rpost` e a capacidade de referência `V` são parâmetros mecânicos informados pelo usuário. Eles **não são obtidos automaticamente por norma**.

## Equilíbrio da placa rígida

A placa possui três graus de liberdade no plano:

- `ux`;
- `uy`;
- `theta_z`.

Para cada parafuso de coordenadas `(x, y)`, o deslocamento relativo é

`dx = ux - theta_z y`

`dy = uy + theta_z x`.

As forças normais de contato de todos os parafusos são somadas em `Fx`, `Fy` e `Mz`. O equilíbrio não linear é resolvido incrementalmente por Newton–Raphson com tangente numérica e busca linear.

## Preditor direcional

A v0.30.1 introduz um preditor específico para rasgos. Em vez de ultrapassar a folga por uma fração fixa do comprimento total do furo, o algoritmo determina a distância livre até o contorno **na direção real do deslocamento previsto**. Isso reduz penetrações artificiais, especialmente em rasgos longos e leis bilineares com baixa rigidez pós-transição.

## Benchmarks automatizados

`tests/bolt-group-slotted-contact-v0301-smoke.mjs` cobre:

1. limite `Lslot = 0` contra o solver circular existente;
2. cisalhamento longitudinal em rasgo horizontal;
3. resposta transversal com rasgo rotacionado a 90°;
4. entrada no ramo bilinear após consumir o deslocamento livre;
5. equilíbrio sob força excêntrica.

Para quatro parafusos idênticos sob `Fx`, rasgo horizontal, comportamento elástico e simetria, o deslocamento esperado é

`ux = Lslot/2 + g + Fx/(4k)`.

Esse resultado é usado como referência física tanto no smoke test quanto na regressão de navegador.

## Interface

No `Model Lab`, o cartão **Parafusos · furo oblongo** permite definir:

- número de colunas e linhas;
- espaçamentos `X` e `Y`;
- rigidez de bearing;
- folga radial;
- comprimento reto do rasgo;
- ângulo do rasgo;
- força de transição `Fy`;
- razão de rigidez pós-`Fy`;
- capacidade de referência do usuário;
- `Fx`, `Fy`, `Mz` e excentricidades `ex`, `ey`;
- número de incrementos.

Os resultados incluem deslocamentos da placa, número de parafusos ativos, força máxima, resíduo de equilíbrio, estado de cada parafuso, coordenada no rasgo, distância normal, penetração e utilização de referência. O laboratório exporta CSV e SVG.

## Limitações atuais

Ainda não estão incluídos neste kernel:

- atrito e transferência por pré-tensão;
- slip-critical connections;
- prying;
- deformação explícita/flexibilidade da chapa;
- plastificação distribuída da chapa;
- deformação do corpo do parafuso e contato 3D;
- ovalização local do furo além da lei constitutiva de bearing;
- rasgos com geometria diferente de cápsula;
- resistência normativa automática;
- verificações de borda, bloco de cisalhamento, esmagamento ou ruptura do concreto.

Esses mecanismos permanecem separados para que demanda mecânica, constitutivo e regras normativas não sejam misturados no mesmo kernel.
