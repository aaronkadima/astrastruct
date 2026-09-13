# AstraStruct v0.39 — Connections & Anchors 2

## Escopo

A v0.39 introduz o contrato **`connections-anchors/v1`** para representar ligações estruturais como objetos mecânicos compostos e acoplá-los à estrutura global pela Component/Element API. A versão não substitui os Labs históricos de parafusos, chapas, T-stub ou arrancamento; esses kernels permanecem disponíveis como modelos locais especializados. O novo nível organiza esses mecanismos numa interface de conexão reutilizável.

A coordenada local da conexão possui seis deformações generalizadas

`q = [ux, uy, uz, rx, ry, rz]`

e o objeto retorna o wrench conjugado

`f = [Fx, Fy, Fz, Mx, My, Mz]`

e sua tangente local 6×6.

## Acoplamento local–global

Uma conexão entre dois nós expõe 12 DOFs globais, seis em cada extremidade. Os offsets são definidos no sistema local. Para cada extremidade, a translação do ponto de ligação inclui o braço rígido `theta × r`. A relação cinemática é escrita como

`q = B u`.

Pelo princípio dos trabalhos virtuais,

`f_global = B^T f_local`

`K_global = B^T K_local B`.

Essa formulação preserva ação–reação e os momentos produzidos pelos offsets. O sistema local pode ser definido explicitamente por `localAxes` ou construído pela linha entre os nós e um `localYHint`. Vetores degenerados ou colineares são rejeitados.

## Objeto de conexão composto

O contrato **`connection-object/v1`** permite somar mecanismos independentes no mesmo objeto. A v0.39 implementa:

- `spring6`: rigidezes generalizadas locais;
- `tension-row`: fileira unilateral à tração, bilinear, localizada em `(x,y)`;
- `compression-row`: contato unilateral à compressão localizado em `(x,y)`;
- `bolt-group-slip-bearing`: grupo de parafusos com atrito por pré-tensão, folga e bearing radial;
- `anchor-group`: grupo de chumbadores à tração com interação aço–aderência–cone de concreto e pontos opcionais de contato de compressão.

Para uma fileira normal situada em `r=[x,y,0]`, a abertura é

`delta = uz + rx*y - ry*x`.

O wrench da força normal é obtido diretamente de `r × F`, de modo que a força axial da fileira participa também de `Mx` e `My`.

## Slip → bearing

O mecanismo de cisalhamento mantém a mesma hipótese física do kernel v0.31:

`F_slip,max = mu * preload * n_planes * holeFactor`.

Antes do limite de atrito há rigidez tangencial. Após o deslizamento, o atrito fica limitado e o bearing só entra quando o deslocamento radial supera a folga. O bearing pode ser elástico ou bilinear. A tangente local do grupo é obtida numericamente em `[ux,uy,rz]` e projetada analiticamente ao sistema global por `B^T K B`.

## Grupo de chumbadores 3D

O builder **`anchor-group-3d/v1`** cria um objeto que pode combinar, no mesmo componente:

1. chumbadores tension-only distribuídos em `(x,y)`;
2. contato de compressão da placa/base;
3. cisalhamento slip→bearing;
4. fileiras adicionais de tração ou compressão.

Para cada chumbador, a rigidez inicial axial é a associação em série

`k_eq = 1 / (1/k_steel + 1/k_bond + 1/k_concrete)`.

A força de pico é governada pelo menor valor entre aço, aderência e concreto, com `edgeFactor` tratado somente como modificador mecânico de entrada. Após o pico, o ramo exponencial residual é o mesmo conceito do modelo de interação aço–aderência–concreto já existente. Isso é um modelo mecânico; resistência normativa continua no RuleEngine.

A distribuição do grupo responde diretamente a uplift e rotações biaxiais. Assim, `uz`, `rx` e `ry` produzem aberturas diferentes em cada chumbador sem necessidade de resolver o grupo externamente.

## Component/Element API

São registrados dois novos tipos:

- `connection3d`;
- `anchor-group-3d`.

Ambos usam `element-component/v1`, têm 12 DOFs, suportam `commit/rollback` e podem participar do assembler genérico. O estado registra eventos como máximo deslizamento, ocorrência de slip/bearing, máximo uplift e pós-pico de chumbadores/fileiras.

## Verificação determinística

`tests/connections-anchors-v039-smoke.mjs` verifica:

- invariância a movimento de corpo rígido com offsets;
- transformação de eixos local–global;
- equilíbrio global de forças e momentos;
- cinemática e wrench de fileiras de tração;
- sequência stick → slip → bearing;
- uplift simétrico e flexão biaxial de grupo de chumbadores;
- composição de tração, compressão e cisalhamento em um único objeto;
- registro na Component API;
- `commit/rollback`;
- tangente global contra diferença finita fora de descontinuidades de estado.

## Limitações declaradas

- pequena rotação na transformação local–global da própria conexão;
- slip/bearing usa placa local rígida para distribuir deslocamentos entre parafusos;
- a tangente do submecanismo slip/bearing é numérica nas três coordenadas locais ativas;
- `tension-row` é um componente equivalente; o solver detalhado T-stub/prying v0.31 permanece disponível para calibração/inspeção local;
- o grupo de chumbadores não substitui um modelo sólido 3D de cone de concreto;
- `edgeFactor` não é resistência normativa;
- fadiga, fratura, perda temporal de pré-tensão e efeitos dependentes do tempo não são automáticos;
- ações, combinações, estágios construtivos, protensão e efeitos reológicos pertencem à **v0.40 — Load/Stage Engine** e não são antecipados aqui.
