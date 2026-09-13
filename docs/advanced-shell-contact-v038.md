# AstraStruct v0.38 — Advanced Shells & Contact

## Escopo

A v0.38 introduz comportamento material não linear para shells de concreto armado e contato unilateral/friccional 2D/3D sobre a Component/Element API. O contrato de topo é `advanced-shell-contact/v1`.

## 1. Shell RC não linear

O elemento `shell4-nonlinear` preserva a cinemática Q4 Mindlin–Reissner já validada no `shell4` linear e substitui a lei constitutiva por uma seção em camadas stateful.

A deformação generalizada é

`e = [ex, ey, gxy, kx, ky, kxy, gxz, gyz]`.

Em cada camada na coordenada `z`:

`eps(z) = [ex + z kx, ey + z ky, gxy + z kxy]`.

A resposta de concreto usa `shell-concrete-plane-stress/v1` com fissura fixa ortotrópica. Antes da fissuração, a relação é plano-tensão isotrópica. Depois que o critério principal é atingido, a orientação da fissura fica armazenada no estado committed.

Cada direção principal reutiliza a lei crack-band da v0.37, preservando `Gf/lch`, fechamento unilateral, esmagamento e `Gc/lch`. O cisalhamento no plano é reduzido por fator de shear retention dependente do dano. Quando existe compressão normal através da fissura, a tensão tangencial é limitada por um cap tipo Coulomb para representar aggregate interlock em nível constitutivo.

A integração ao longo da espessura utiliza camadas midpoint e é verificada por convergência para `D t^3/12`. Armaduras distribuídas podem ser informadas como camadas com `areaPerWidth`, `z`, direção e material; sua lei cíclica reutiliza o aço stateful da v0.37.

O estado constitutivo de cada Gauss point é transacional: avaliações trial partem apenas do último committed state e só se tornam permanentes após `commit()`.

## 2. Contato geral 2D/3D

A v0.38 fornece quatro interfaces:

- `contact2d` e `contact3d`: contato par-a-par;
- `contact-node-segment2d`: nó–segmento;
- `contact-node-triangle3d`: nó–triângulo.

A condição normal usa gap unilateral por penalty:

`g = g0 + n · Δu`.

Se `g >= 0`, o contato está aberto. Se `g < 0`,

`Fn = kn g`.

A resposta tangencial utiliza rigidez `kt` no stick e cap de Coulomb no slip:

`||Ft|| <= μ |Fn|`.

Durante slip, o estado armazena plastic slip, eventos de escorregamento e energia dissipada. Para interfaces nó–superfície, as forças e a tangente são distribuídas aos nós mestres pelas funções de interpolação da projeção inicial, garantindo equilíbrio nodal.

## 3. Verificação

`tests/advanced-shell-contact-v038-smoke.mjs` verifica:

- limite plano-tensão isotrópico;
- fissuração fixa, fechamento e shear retention;
- aggregate interlock limitado pela compressão normal;
- convergência da integração em espessura;
- `commit/rollback` da seção;
- equivalência do `shell4-nonlinear` com o `shell4` linear no limite elástico;
- abertura/fechamento, stick/slip e equilíbrio de contato 2D/3D.

`tests/node-surface-contact-v038-smoke.mjs` verifica:

- projeção nó–segmento 2D;
- coordenadas baricêntricas nó–triângulo 3D;
- distribuição equilibrada de forças aos nós mestres;
- cap de Coulomb;
- `commit/rollback` do estado de contato.

## 4. Limitações deliberadas

A v0.38 usa small strain no shell e small sliding no contato. Não são declarados nesta versão:

- shell de grande rotação materialmente não linear;
- contato mortar, segment-to-segment ou surface-to-surface de large sliding;
- auto-contato;
- concrete plastic-damage multiaxial completo;
- conexão/âncora local-global completa.

Esses limites são explícitos para evitar atribuir capacidades não implementadas. O próximo estágio permitido após CI final verde é **v0.39 — Connections & Anchors 2**.
