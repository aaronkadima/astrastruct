# AstraStruct v0.27 — Modal + Estabilidade 3D

## Modal 3D
O modelo espacial usa seis DOFs por nó. Para `frame3d`, a massa consistente inclui translação axial e as duas matrizes de massa de flexão de Euler–Bernoulli, além de inércia rotacional torsional baseada em `Ip ≈ Iy + Iz` quando `Ip` não é fornecido. Para `truss3d`, a massa consistente atua nas três translações globais. `material.density` permanece como peso específico [kN/m³], convertido em densidade de massa por `rho = gamma/g`.

O problema generalizado é `K phi = omega² M phi`, resolvido por transformação de Cholesky e decomposição simétrica de Jacobi. Os modos são normalizados por massa e também fornecem vetores normalizados para visualização. A participação modal é calculada separadamente em X, Y e Z.

## Flambagem linear 3D
A análise de estabilidade usa o estado linear espacial do cenário de referência para recuperar o esforço normal `N` de cada `frame3d`. Com a convenção AstraStruct `N > 0` em tração, a compressão negativa reduz a rigidez geométrica. O problema é `K phi = lambda_cr (-Kg,ref) phi`, incluindo matrizes geométricas nos dois planos principais de flexão.

## Escopo protegido
A flambagem v0.27 aceita apenas `frame3d`. A análise modal aceita `frame3d`, `truss3d` e modelos mistos. Ainda não são suportados em 3D: P-Delta iterativo, co-rotacional, imperfeição modal aplicada automaticamente, história temporal, espectro de resposta, plasticidade, releases/offsets espaciais, Timoshenko, warping ou shells/solids.

## Validação
Os testes permanentes incluem: autovalor axial analítico de barra espacial para massas consistente e concentrada; pórtico/cantilever espacial com participação X/Y/Z; simetria das matrizes de massa e geométrica; coluna biapoiada discretizada comparada com `Pcr = pi² EI/L²` nos dois eixos principais; integração com `SolverRegistry`, contratos e dispatcher.
