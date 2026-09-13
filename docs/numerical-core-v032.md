# AstraStruct v0.32 — Numerical Core 2

## 1. Escopo

A v0.32 substitui a fundação numérica densa e implícita por um núcleo explícito, diagnosticável e reutilizável. Esta versão **não** cria a interface universal de elementos, Section Engine, malha geral, novos elementos físicos ou novas verificações normativas. Esses blocos permanecem reservados às versões posteriores do roadmap.

A cadeia implementada nesta versão é:

`CSR/assembly → linear solver/diagnostics → DOF manager → constraints/MPC → units → Newton/tolerances → legacy compatibility`

## 2. Matriz esparsa CSR

O módulo `web/src/numerics/sparseMatrix.js` implementa:

- `SparseMatrixBuilder`: montagem incremental por pares `(i,j)` e blocos locais;
- `SparseMatrixCSR`: armazenamento `rowPtr`, `colIdx`, `values`;
- produto matriz-vetor sem materializar matriz densa;
- acesso à diagonal, transposição, identidade e conversão denso→CSR;
- descarte opcional controlado por tolerância na montagem.

Para uma matriz com `nnz` termos não nulos, o produto matriz-vetor tem custo proporcional a `O(nnz)`.

## 3. Solver linear direto

`solveSparseDirect()` usa eliminação com pivotamento parcial escalonado sobre linhas esparsas mutáveis. Para a coluna `k`, a linha pivô maximiza

`|a_ik| / s_i`,

onde `s_i` é a escala da linha. Um pivô é considerado inadequado quando

`|p_k| <= max(tol_abs, tol_rel * S)`,

em que `S` representa a escala global da matriz.

A solução retorna, além de `x`:

- método utilizado;
- resíduo absoluto e relativo;
- menor e maior pivô;
- razão entre pivôs;
- estimativa de posto quando a solução é concluída;
- diagnóstico estrutural da matriz.

Singularidade ou quase-singularidade não propaga `NaN` ou `Infinity`: é lançada `NumericalSingularityError`, com `code = ASTRA_NUMERICAL_SINGULARITY`, índice do pivô, limiar e estimativa de posto.

## 4. Conjugate Gradient

`solveConjugateGradient()` é disponibilizado para sistemas simétricos definidos positivos, com precondicionamento diagonal de Jacobi. O critério é

`||r||_2 <= max(tol_abs, tol_rel ||b||_2)`.

Curvatura não positiva (`p^T A p <= 0`) é tratada como condição incompatível com CG/SPD e produz diagnóstico explícito.

O modo `auto` pode selecionar CG para matrizes simétricas suficientemente grandes e mantém o solver direto como caminho robusto geral.

## 5. Diagnóstico matricial

`web/src/numerics/diagnostics.js` fornece:

- `normInf`, `norm2`, `dot`;
- resíduo relativo de equilíbrio;
- erro relativo de simetria;
- linhas nulas;
- amplitudes diagonal/matriz;
- razão de escala diagonal;
- erros tipados de singularidade e não convergência.

O objetivo é substituir mensagens genéricas por informação utilizável para distinguir mecanismo estrutural, restrição insuficiente, mau condicionamento e incompatibilidade do algoritmo.

## 6. DOF Manager

`DofManager` desacopla a numeração global da hipótese fixa `nó × número de DOFs`.

Cada grau de liberdade é identificado por:

`owner + label → globalIndex`.

O gerenciador suporta registro genérico, registro nodal, consulta por proprietário, descrição reversa e validação do tamanho de vetores globais. Isso prepara o núcleo para futuras famílias de elementos sem introduzir a API de elementos da v0.33.

## 7. Restrições e MPC

`ConstraintManager` representa:

- deslocamentos prescritos;
- `equalDOF` mestre–escravo;
- MPC linear genérica

`u_s = c + Σ a_j u_j`.

### 7.1 Transformação exata

O método padrão resolve recursivamente as relações e monta

`u = T q + c`.

O sistema original

`K u = F`

é reduzido para

`K_r = T^T K T`,

`F_r = T^T (F - K c)`.

Após a solução de `q`, os DOFs físicos são reconstruídos por `u = Tq + c`. Dependências cíclicas são rejeitadas explicitamente.

### 7.2 Penalty

Para uma equação de restrição

`C u = d`,

o método penalty acrescenta

`K_p = K + α C^T C`,

`F_p = F + α C^T d`.

O valor `α` pode ser informado; caso contrário é escalado a partir da diagonal da matriz.

### 7.3 Multiplicadores de Lagrange

O sistema aumentado é

`[ K  C^T ] [u] = [F]`

`[ C   0  ] [λ]   [d]`.

O método preserva a imposição exata e retorna os multiplicadores separadamente.

## 8. Sistema dimensional

`web/src/numerics/units.js` introduz validação dimensional e conversão explícita para grandezas estruturais recorrentes: comprimento, área, inércia, força, tensão, momento, força por comprimento, tempo, temperatura, velocidade e aceleração.

A conversão só é aceita quando os vetores dimensionais coincidem. Por exemplo:

- `30 MPa = 30×10^6 Pa`;
- `12.5 kN·m = 12 500 N·m`;
- `1 g = 9.80665 m/s²`.

Uma tentativa de converter comprimento em força é rejeitada antes de alcançar o solver.

## 9. Newton e tolerâncias

`newtonSolve()` implementa três estratégias:

1. `full`: tangente atualizada a cada iteração;
2. `modified`: tangente reutilizada, com atualização opcional periódica;
3. `line-search`: Newton completo com redução de passo baseada na norma do resíduo.

Para o estado `x_k`, resolve-se

`K_t(x_k) Δx = -R(x_k)`

seguido de

`x_{k+1} = x_k + η Δx`,

com `η=1` nos modos full/modified e `0<η<=1` no line-search.

O critério combinado exige convergência de resíduo e incremento, com tolerâncias absolutas e relativas independentes e limite explícito de iterações. Falhas produzem `NonlinearConvergenceError` com histórico completo.

## 10. Compatibilidade com os solvers existentes

`web/src/solver/matrix.js` mantém as funções públicas históricas `zeros`, `solveLinear`, `mul`, `addSub` e `solveConstrained`.

Entretanto:

- `solveLinear()` é encaminhado ao solver direto pivotado do Numerical Core 2;
- `solveConstrained()` transforma o `Map<dof,value>` legado em `ConstraintManager` e usa a transformação exata;
- o formato histórico `{u,R,free,constrained}` é preservado;
- `numericalDiagnostics` é acrescentado de forma aditiva.

Assim, os solvers atuais recebem a nova fundação sem uma migração prematura para a Component/Element API da v0.33.

## 11. Benchmarks determinísticos

`tests/numerical-core-v032-smoke.mjs` cobre:

- montagem CSR de matriz tridiagonal SPD;
- solução direta de um sistema com solução conhecida `[1,2,3]`;
- solução CG do mesmo sistema e verificação do resíduo;
- matriz singular de posto 1 com erro tipado;
- numeração genérica de DOFs;
- `equalDOF` e deslocamentos prescritos por transformação exata;
- solução equivalente por Lagrange;
- conversões dimensionais e rejeição de dimensões incompatíveis;
- Newton para `x²-2=0`;
- ponte de compatibilidade de `matrix.js`.

## 12. Limites deliberados

Ficam explicitamente fora da v0.32:

- interface universal `Element -> residual/tangent/state/commit/rollback` — v0.33;
- propriedades e fibras de seção — v0.34;
- malha/superfície geral — v0.35;
- novos elementos físicos — v0.36+;
- modelos constitutivos novos — v0.37+;
- novas regras normativas — v0.42–v0.43.

Esse limite é parte do gate arquitetural e impede que a v0.32 se transforme em um solver monolítico.
