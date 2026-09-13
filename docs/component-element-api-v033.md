# AstraStruct v0.33 — Component / Element API

## 1. Escopo

A v0.33 introduz uma interface universal entre o núcleo numérico e os elementos estruturais. O objetivo é eliminar a hipótese arquitetural de que cada solver global deve conhecer internamente a formulação de cada família de elemento.

A cadeia desta versão é:

`ElementRegistry → Component factory → DOF descriptors → element response → sparse assembly → state commit/rollback`

Esta versão **não** implementa Section Engine, geração geral de malha, novos elementos físicos, novas leis constitutivas ou novos códigos normativos. Esses blocos permanecem nas versões posteriores do roadmap.

## 2. Contrato universal

Todo componente criado por `createElementComponent()` usa:

`contract = element-component/v1`

O componente fornece:

- `id` e `type`;
- descritores explícitos de graus de liberdade;
- `response(u, context)`;
- `residual(u, context)`;
- `tangent(u, context)`;
- estado `committed` e `trial`;
- `commit()`;
- `rollback()`;
- `resetState()`;
- metadados não físicos de identificação/capacidade.

A resposta elementar usa:

`contract = element-response/v1`.

Ela contém:

- vetor residual;
- matriz tangente;
- força interna, quando disponível;
- força externa equivalente, quando disponível;
- outputs específicos do elemento;
- snapshot do estado transacional.

Todos os vetores e matrizes são validados quanto a dimensão e finitude antes de entrarem no assembly global.

## 3. Convenção de equilíbrio

A convenção universal é

`r_e(u_e, S_n) = f_int,e(u_e, S_n) - f_ext,e`.

A tangente é

`K_e = ∂r_e / ∂u_e`.

Para um elemento linear sem cargas dependentes do estado,

`r_e = K_e u_e - f_ext,e`.

No assembly global, para a matriz booleana/conectividade `A_e`,

`R = Σ A_eᵀ r_e`,

`K = Σ A_eᵀ K_e A_e`.

A v0.33 executa essa montagem diretamente em `SparseMatrixBuilder`, introduzido na v0.32.

## 4. Graus de liberdade

Um componente não assume mais a regra rígida

`globalDof = nodeIndex × dofsPerNode + offset`.

Cada DOF é descrito por

`owner + label`,

por exemplo:

- `N12.ux`;
- `N12.uy`;
- `N12.rz`.

`registerComponentDofs()` conecta esses descritores ao `DofManager` da v0.32. Isso permite que famílias futuras adicionem DOFs internos, rotacionais, de interface ou multiphysics sem alterar o algoritmo de numeração global.

A introdução efetiva de novos tipos de DOF físicos permanece fora do escopo da v0.33.

## 5. Estado trial, commit e rollback

`ElementStateTransaction` formaliza a semântica já utilizada nos kernels cíclicos do AstraStruct.

No início de um passo convergido existe o estado

`S_n = committed`.

Cada avaliação de Newton produz um candidato

`S_trial = G(u_trial, S_n)`.

O estado committed não é modificado durante iterações, line-search ou tentativas que não convergem.

Após convergência global:

`commit(): S_n ← S_trial`.

Em cutback, rejeição de passo ou tentativa não convergida:

`rollback(): S_trial ← S_n`.

Esse contrato é obrigatório para futuros elementos materialmente não lineares, contato e damage/plasticity, mas a v0.33 não introduz nenhuma nova lei constitutiva.

## 6. ElementRegistry e component factories

O `ElementRegistry` mantém sua função original de catalogar:

- tipo;
- dimensão;
- categoria;
- número de nós;
- DOFs por nó;
- capacidades.

A v0.33 acrescenta um registro independente de `componentFactory` por tipo. Assim, metadados e kernel executável permanecem desacoplados, mas vinculados pelo mesmo `type`.

As funções principais são:

- `registerElementComponentFactory(type, factory)`;
- `getElementComponentFactory(type)`;
- `hasElementComponentFactory(type)`;
- `createRegisteredElementComponent(element, context)`.

Não é permitido registrar factory para um tipo de elemento inexistente.

## 7. Adapters reais desta versão

Dois elementos existentes são adaptados sem alterar suas formulações físicas:

### 7.1 `truss2d`

O adapter recupera a mesma rigidez axial linear existente:

`k = EA/L`.

A resposta expõe:

- tangente global 4×4;
- forças internas nodais;
- cargas equivalentes de peso próprio e temperatura já suportadas;
- residual;
- força axial `N`;
- deformação térmica.

### 7.2 `frame2d`

O adapter reutiliza `prepareFrameElement()` e `recoverFrameEndForces()`.

Consequentemente preserva:

- Euler–Bernoulli 2D;
- transformação local/global;
- cargas uniformes e pontuais;
- peso próprio;
- estado térmico linear;
- releases e molas rotacionais já suportados pelo kernel linear.

A API não duplica a formulação; ela apenas cria uma fronteira arquitetural comum em torno do kernel existente.

## 8. Assembly universal

`assembleElementComponents()`:

1. valida cada componente;
2. registra/resolve DOFs via `DofManager`;
3. extrai `u_e` do vetor global;
4. solicita `response()` ao componente;
5. monta `K_e` em CSR;
6. acumula residual, força interna e força externa;
7. preserva a resposta individual para pós-processamento e diagnóstico.

O retorno usa

`contract = element-assembly/v1`.

## 9. Verificação determinística

`tests/component-element-api-v033-smoke.mjs` cobre:

- registro de factories;
- validação do contrato;
- adapter real `truss2d`;
- adapter real `frame2d`;
- simetria da tangente linear;
- equilíbrio nodal;
- assembly CSR pelo `DofManager`;
- estado trial;
- commit;
- rollback;
- rejeição de respostas com dimensão incorreta.

As regressões v0.32 e P2/P3/P4 permanecem obrigatórias no gate de release.

## 10. Limites deliberados

A v0.33 não implementa:

- seção arbitrária/fibras generalizada;
- `N–My–Mz`;
- malha geral;
- shell-frame coupling novo;
- Timoshenko, cabo ou links novos;
- RC não linear;
- contato geral 2D/3D;
- novos objetos de ligação;
- Load/Stage Engine.

Esses itens permanecem, respectivamente, nas etapas posteriores do roadmap. O próximo gate, somente após v0.33 ficar integralmente verde, é **v0.34 — Section Engine**.
