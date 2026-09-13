# AstraStruct v0.32 — Numerical Core 2

## Escopo

A v0.32 substitui a fundação numérica densa e implícita por um núcleo explícito, diagnosticável e reutilizável. Ela não cria a interface universal de elementos, Section Engine, malha geral, novos elementos físicos ou novas regras normativas. Esses blocos permanecem nas versões posteriores do roadmap.

Cadeia desta versão:

`CSR/assembly → linear solver/diagnostics → DOF manager → constraints/MPC → units → Newton/tolerances → legacy compatibility`

## Matriz esparsa CSR

`web/src/numerics/sparseMatrix.js` fornece `SparseMatrixBuilder` e `SparseMatrixCSR`, com montagem incremental de termos e blocos, armazenamento `rowPtr/colIdx/values`, produto matriz-vetor, diagonal, transposição, identidade e conversão denso→CSR. Para `nnz` termos não nulos, o produto matriz-vetor é `O(nnz)`.

## Solver linear direto

`solveSparseDirect()` usa eliminação com pivotamento parcial escalonado sobre linhas esparsas mutáveis. Na coluna `k`, a seleção de linha maximiza

`|a_ik| / s_i`,

onde `s_i` é a escala original da linha.

### Singularidade versus mau condicionamento

Sistemas estruturais misturam DOFs translacionais e rotacionais e, por isso, podem apresentar rigidezes com ordens de grandeza muito diferentes sem constituir mecanismo. A v0.32 separa duas situações:

1. **singularidade numérica efetiva:** o pivô cai abaixo da tolerância absoluta configurada; a solução é interrompida com `NumericalSingularityError`;
2. **mau condicionamento/escala heterogênea:** razões de pivôs ou pivôs escalonados ficam pequenas, mas o pivô continua resolvível; a solução prossegue e `diagnostics.illConditioned=true` é reportado.

A tolerância relativa é, portanto, um **indicador diagnóstico** e não um limiar global que compare cada pivô à maior rigidez da matriz. Isso evita falsos mecanismos em modelos com escalas físicas mistas.

O retorno inclui resíduo absoluto/relativo, menor e maior pivô, `pivotRatio`, `minScaledPivot`, estimativa de posto e diagnóstico matricial. Singularidade não é propagada como `NaN` ou `Infinity`.

## Conjugate Gradient

`solveConjugateGradient()` atende sistemas simétricos definidos positivos com precondicionamento diagonal de Jacobi. O critério é

`||r||₂ <= max(tol_abs, tol_rel ||b||₂)`.

Curvatura não positiva (`pᵀAp <= 0`) é rejeitada explicitamente. O modo `auto` pode preferir CG em matrizes simétricas grandes, mantendo o solver direto como caminho geral.

## Diagnósticos

`web/src/numerics/diagnostics.js` fornece normas, produto escalar, resíduo relativo, erro de simetria, linhas nulas, amplitudes da diagonal/matriz e erros tipados:

- `ASTRA_NUMERICAL_SINGULARITY`;
- `ASTRA_NONLINEAR_NONCONVERGENCE`.

O diagnóstico permite distinguir mecanismo/restrição insuficiente de um sistema apenas mal escalonado.

## DOF Manager

`DofManager` abandona a premissa rígida `nó × número fixo de DOFs` e registra

`owner + label → globalIndex`.

Há registro genérico/nodal, consulta por proprietário, descrição reversa e validação de vetores globais. Isso prepara a infraestrutura sem antecipar a Component/Element API da v0.33.

## Restrições e MPC

`ConstraintManager` representa deslocamentos prescritos, `equalDOF` mestre–escravo e MPC linear

`u_s = c + Σ a_j u_j`.

### Transformação exata

As relações são resolvidas recursivamente na forma

`u = Tq + c`.

Para `Ku=F`:

`K_r = Tᵀ K T`

`F_r = Tᵀ(F - Kc)`.

Após resolver `q`, reconstrói-se `u`. Dependências cíclicas são rejeitadas.

### Penalty

Para `Cu=d`:

`K_p = K + αCᵀC`

`F_p = F + αCᵀd`.

### Multiplicadores de Lagrange

O sistema aumentado é

`[K Cᵀ; C 0] [u; λ] = [F; d]`.

A transformação é o método padrão; penalty e Lagrange ficam disponíveis como estratégias explícitas.

## Sistema dimensional

`web/src/numerics/units.js` valida e converte comprimento, área, inércia, força, tensão, momento, força por comprimento, tempo, temperatura, velocidade e aceleração. Conversões entre dimensões incompatíveis são rejeitadas antes do solver.

Exemplos:

- `30 MPa = 30×10⁶ Pa`;
- `12.5 kN·m = 12 500 N·m`;
- `1 g = 9.80665 m/s²`.

## Newton e tolerâncias

`newtonSolve()` implementa:

- `full`: tangente atualizada a cada iteração;
- `modified`: tangente reutilizada, com atualização periódica opcional;
- `line-search`: Newton completo com redução controlada do passo.

Em cada iteração:

`K_t(x_k) Δx = -R(x_k)`

`x_(k+1) = x_k + ηΔx`.

O critério combinado exige convergência de resíduo e incremento, com tolerâncias absolutas/relativas independentes e máximo de iterações explícito. Não convergência gera `NonlinearConvergenceError` com histórico.

## Compatibilidade legada

`web/src/solver/matrix.js` mantém `zeros`, `solveLinear`, `mul`, `addSub` e `solveConstrained`. Internamente:

- `solveLinear()` usa o solver direto pivotado v0.32;
- `solveConstrained()` converte `Map<dof,value>` em `ConstraintManager` e aplica transformação exata;
- `{u,R,free,constrained}` é preservado;
- `numericalDiagnostics` é acrescentado de forma aditiva.

Assim os kernels existentes recebem a nova fundação sem migração prematura para a API de elementos da v0.33.

## Benchmarks determinísticos

`tests/numerical-core-v032-smoke.mjs` verifica:

- CSR tridiagonal SPD e solução conhecida `[1,2,3]`;
- solução direta e CG com resíduo;
- matriz singular de posto 1 com erro tipado;
- sistema fortemente multiescala resolvível, marcado como `illConditioned` e não como singular;
- DOF manager;
- `equalDOF`, prescrições e transformação exata;
- solução equivalente por Lagrange;
- unidades e rejeição dimensional;
- Newton para `x²-2=0`;
- compatibilidade de `matrix.js`.

## Limites deliberados

Ficam fora da v0.32:

- `Element -> DOFs + residual + tangent + state + commit/rollback` — v0.33;
- Section Engine — v0.34;
- Mesh & Surface Engine — v0.35;
- elementos físicos avançados — v0.36+;
- concreto armado não linear — v0.37+;
- shells/contato avançado — v0.38+;
- novas verificações normativas e combinações — v0.42–v0.43.

## Gate de saída

A v0.32 só é encerrada quando `npm run check`, `npm test`, build Vite e regressão Playwright completa estiverem verdes no `develop`, com `tests/release-gate-v032-smoke.mjs` ativo e sem descoberta automática de testes.
