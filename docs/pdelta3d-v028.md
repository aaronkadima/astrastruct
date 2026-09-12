# AstraStruct v0.28 — P-Delta espacial 3D

A v0.28 introduz a primeira análise geométrica de segunda ordem para pórticos espaciais `frame3d`. O solver mantém a formulação elástica linear do elemento espacial da v0.26 e adiciona, iterativamente, a matriz geométrica consistente associada ao esforço normal corrente em ambos os planos de flexão.

## Formulação

Em cada iteração, o equilíbrio é resolvido na forma

`[Ke + Kg(N)] u = F`,

com a convenção do AstraStruct `N > 0` para tração e `N < 0` para compressão. Assim, a compressão reduz a rigidez tangente e produz a amplificação de deslocamentos esperada em efeitos P-Delta.

A matriz geométrica local atua nos pares de flexão `(v, rz)` e `(w, ry)` do `frame3d`. O esforço normal é recuperado a partir das forças de extremidade elásticas e atualizado até que a variação máxima de deslocamento satisfaça a tolerância configurada.

## Escopo validado

- elementos `frame3d` puros;
- 6 graus de liberdade por nó;
- flexão biaxial, axial e torção elástica;
- cargas nodais 3D;
- cargas distribuídas uniformes locais `qx/qy/qz`;
- apoios e deslocamentos prescritos já disponíveis no kernel espacial;
- iteração de esforço normal com `pDeltaMaxIterations` e `pDeltaTolerance`;
- recuperação de `N/Vy/Vz/T/My/Mz`, reações e metadados de convergência.

## Limites intencionais da v0.28

- `truss3d` e modelos mistos não participam do P-Delta 3D nesta versão;
- imperfeição geométrica modal 3D ainda não é aplicada ao caminho P-Delta;
- releases/semirrigidez espaciais, plasticidade material, co-rotacional 3D e dinâmica transitória não linear permanecem fora do escopo;
- a formulação é de segunda ordem elástica e não substitui uma análise geometricamente exata para grandes rotações.

## Verificação mínima

Os testes de regressão verificam: coincidência com a solução linear quando `N = 0`, amplificação lateral sob compressão nos dois planos principais, preservação da convenção de sinal do esforço normal, integração pelo dispatcher principal e rejeição explícita de escopos ainda não suportados.
