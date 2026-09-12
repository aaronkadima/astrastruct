# AstraStruct v0.29 — co-rotacional espacial 3D experimental

A v0.29 introduz a primeira formulação geometricamente não linear espacial do AstraStruct para elementos `frame3d`. O objetivo desta etapa é permitir grandes deslocamentos e rotações rígidas do membro mantendo pequenas deformações locais elásticas, sem ainda introduzir plasticidade material ou recursos avançados de ligações espaciais.

## Cinemática

Cada elemento conserva a geometria de referência `(X1,X2)` e um triedro local inicial. A configuração corrente é obtida a partir das translações nodais e de vetores de rotação globais. O eixo local corrente `ex` coincide com a corda deformada. Os eixos `ey/ez` são transportados a partir das orientações nodais e ortogonalizados em relação à corda, evitando que rotações rígidas sejam interpretadas como deformação.

As rotações nodais são convertidas por Rodrigues para matrizes de rotação. A rotação deformacional de cada extremidade é calculada pela rotação relativa entre o triedro nodal e o triedro co-rotacional corrente. Dessa forma, um movimento rígido tridimensional comum aos dois nós produz, idealmente, deformações e forças internas nulas.

## Lei constitutiva local

A deformação local contém:

- alongamento axial `ΔL = l - L0`;
- rotações relativas de extremidade em torno dos eixos locais `x`, `y` e `z`.

A resposta elástica local utiliza o mesmo operador de viga espacial Euler-Bernoulli da fundação 3D, com `EA`, `GJ`, `EIy` e `EIz`. As forças nodais locais são transformadas de volta para o sistema global corrente.

## Tangente e solução incremental

A tangente global experimental é obtida por derivada central do vetor de forças internas em relação aos 12 graus de liberdade do elemento. Essa estratégia prioriza consistência entre cinemática e resíduo nesta primeira implementação, ao custo de desempenho superior ao de uma tangente analítica futura.

O equilíbrio é resolvido incrementalmente por Newton-Raphson:

`R(u,λ) = λ Fref - fint(u) = 0`.

A solução suporta subdivisão do carregamento, tolerância configurável e line search.

## Escopo validado da v0.29

- `frame3d` puro, 6 DOFs por nó;
- grandes deslocamentos e rotações rígidas;
- axial, torção e flexão biaxial elástica;
- cargas nodais globais de referência;
- cargas uniformes locais `qx/qy/qz` tratadas como dead loads da configuração de referência;
- recuperação de `N/Vy/Vz/T/My/Mz` na configuração corrente;
- visualização pela infraestrutura Canvas 3D já existente.

## Limites intencionais

Ainda não são suportados nesta etapa: `truss3d` misto, releases, ligações semirrígidas, molas nodais, recalques/deslocamentos impostos, imperfeição inicial, cargas follower, cargas pontuais de barra, peso próprio, ação térmica, controle por deslocamento, Arc-Length, plasticidade e dinâmica não linear 3D.

A v0.29 permanece **experimental** e requer validação independente antes de qualquer uso profissional.
