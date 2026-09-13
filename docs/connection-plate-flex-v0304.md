# AstraStruct v0.30.4 — chapa flexível em ligações aparafusadas

## Objetivo

A v0.30.4 remove, em um laboratório dedicado, a hipótese de **chapa rígida no plano** usada pelos kernels anteriores de grupos de parafusos. A chapa passa a possuir um campo distribuído de deslocamentos e tensões, permitindo observar redistribuição de bearing entre parafusos e início/propagação de plastificação.

O módulo é de **mecânica**, não de verificação normativa.

## Formulação da chapa

A chapa retangular é discretizada por elementos quadrilaterais Q4 de membrana com dois graus de liberdade por nó (`ux`, `uy`). A cinemática é de pequenas deformações e o material trabalha em **estado plano de tensões**.

Para cada ponto de Gauss 2×2:

- `epsilon = B u_e`
- `sigma_trial = D epsilon`
- `sigma_vm = sqrt(sx² - sx sy + sy² + 3 txy²)`

A matriz elástica em estado plano de tensões é:

`D = E/(1-nu²) [[1, nu, 0], [nu, 1, 0], [0, 0, (1-nu)/2]]`.

## Plastificação monotônica

Quando `sigma_vm <= fy`, a resposta permanece elástica.

Quando `sigma_vm > fy`, o módulo usa uma relação bilinear secante monotônica controlada por `sigma_vm`:

`sigma_vm,target = fy + r_h (sigma_vm,trial - fy)`

onde `r_h` é a razão de rigidez pós-escoamento informada pelo usuário. O tensor de tensão de tentativa é escalado para o nível alvo e a rigidez secante correspondente é usada na iteração global.

Esta formulação representa **redistribuição e perda de rigidez associadas à plastificação monotônica**, mas ainda não é uma integração J2 de fluxo plástico com histórico cíclico. A interface e a documentação deixam essa distinção explícita.

## Contato dos parafusos

Cada parafuso é localizado no interior de um elemento da malha e seu deslocamento relativo é interpolado pelas funções de forma Q4.

Para um deslocamento relativo `u_b` e folga radial `g`:

- `r = ||u_b||`
- `p = max(0, r - g)`

Enquanto `r <= g`, o parafuso permanece em `gap` e não transmite força.

Após fechar a folga, entra a lei radial de bearing já usada no AstraStruct:

- elástica: `F = k_b p`
- opcionalmente bilinear após `Fy,bearing`

A tangente radial completa é montada na matriz global e distribuída aos quatro nós do Q4 através das funções de forma.

## Controle por deslocamento

A borda `x=L` recebe `ux = delta` uniforme. Um único `uy=0` de referência elimina o modo rígido transversal.

Esse controle é deliberado: antes do fechamento da folga a chapa pode transladar quase rigidamente, sem gerar reação espúria. Quando os parafusos entram em bearing, a chapa passa a deformar e o campo de tensões emerge naturalmente.

## Resultados disponíveis

O laboratório fornece:

- curva força requerida × deslocamento imposto;
- primeiro fechamento de contato;
- primeira plastificação;
- `sigma_vm` por elemento e pontos de Gauss;
- fração de área plastificada aproximada;
- deformação plástica equivalente proxy da lei secante;
- estado, penetração e força em cada parafuso;
- `sigma_b,eq = V/(t d)` por parafuso;
- resíduo de equilíbrio entre reação da borda e transferência pelos parafusos;
- exportação CSV e mapa SVG editável.

## Mapa de tensões

A visualização em planta colore cada Q4 de acordo com `sigma_vm/fy` e sobrepõe os parafusos e vetores de bearing. A intenção é permitir inspeção imediata de concentração e propagação de plastificação sem confundir `sigma_b,eq` com uma pressão local Hertziana.

## Benchmarks de regressão

A suíte `connection-plate-membrane-v0304-smoke.mjs` cobre:

1. reação praticamente nula antes de fechar a folga;
2. ativação dos quatro parafusos após contato;
3. equilíbrio entre reação da borda e resultante de bearing;
4. simetria das linhas espelhadas em `y`;
5. redistribuição de força entre colunas em `x`, que deve ocorrer numa chapa flexível;
6. surgimento de zona plastificada para `fy` reduzido;
7. redução da força/tangente em comparação com o caso essencialmente elástico;
8. consistência dos campos de `sigma_vm` e `sigma_b,eq`.

O Playwright também executa o fluxo completo do laboratório, exportações e mapa de tensões.

## Limitações atuais

Ainda não estão incluídos neste kernel:

- geometria explícita do vazio do furo na malha da chapa;
- distribuição Hertziana/FEM da pressão no arco de contato;
- plasticidade J2 incremental com retorno radial e histórico cíclico;
- grandes deformações da chapa;
- prying e flexão fora do plano;
- block shear;
- rasgamento de borda;
- ruptura líquida;
- pré-tensão e atrito slip-critical;
- resistências normativas automáticas.

Esses fenômenos devem permanecer separados da mecânica já validada para evitar inserir resistência de código ou campos locais que o modelo ainda não resolve.
