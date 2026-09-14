# AstraStruct v0.53.11 — Envoltórias de reações de apoio

## Escopo

A v0.53.11 estende o explorador de combinações com envoltórias auditáveis das reações de apoio e visualização no Canvas 3D. A fonte é exclusivamente `result.reactions` devolvido pelo solver já utilizado pelo modelo; não existe um segundo solver e nenhuma reação é estimada a partir da geometria.

## Nós e graus de liberdade elegíveis

Somente nós presentes em `project.supports` entram em `supportReactionEnvelopes`. Para cada apoio, apenas componentes associadas a graus de liberdade realmente restringidos são consideradas:

- `Ux`, `Uy`, `Uz` → `Fx`, `Fy`, `Fz` [kN];
- `Rx`, `Ry`, `Rz` → `Mx`, `My`, `Mz` [kN·m].

Uma reação eventualmente presente em um grau de liberdade não restringido não é promovida para a envoltória. Nós sem apoio são excluídos, mesmo que um resultado externo contenha valores de reação para eles.

## Envoltórias e combinação governante

Para cada componente assinada são preservados mínimo, máximo, máximo absoluto, componente e combinação governante. Também são calculadas duas grandezas vetoriais, sempre a partir das componentes físicas da mesma combinação:

- `R = √(Fx² + Fy² + Fz²)` [kN];
- `M = √(Mx² + My² + Mz²)` [kN·m].

A combinação governante da resultante guarda o vetor que a produziu. Isso permite representar no Canvas 3D a direção real da reação governante, sem recombinar máximos provenientes de combinações diferentes.

## Explorador e Canvas 3D

Em **Combinações & envoltórias → Reações de apoio**, o usuário pode selecionar `R`, `Fx`, `Fy`, `Fz`, `M`, `Mx`, `My` ou `Mz` e abrir o mapa 3D. O apoio crítico é destacado, o painel mostra valor, vetor e combinação governante e oferece:

- seleção do apoio crítico no modelo;
- abertura direta da combinação governante;
- limpeza da camada gráfica.

A seleção do apoio permanece compatível com o Inspector 3D e não desmonta a camada de resultados.

## Unidades e escalas

Campos de força usam kN e campos de momento usam kN·m. Cada mapa representa apenas um campo por vez; forças e momentos nunca compartilham escala numérica. A intensidade cromática é relativa ao máximo absoluto do campo atualmente visualizado.

## Governança

- somente combinações realmente resolvidas e de natureza física entram nas envoltórias;
- formas modais, flambagem e outras formas próprias não geram reações físicas;
- dados ausentes permanecem ausentes; não são convertidos em zero para criar uma verificação;
- nenhuma capacidade de sapata, bloco, radier, estaca, ancoragem ou solo é presumida;
- não há PASS/FAIL de fundação sem um critério ou módulo de dimensionamento explicitamente aplicável;
- o mapa é transitório e não altera geometria, rigidez, carregamentos, resultados persistidos nem o projeto estrutural.
