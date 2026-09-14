# AstraStruct v0.53.12 — Vínculo auditável reação → fundação

## Escopo

A v0.53.12 conecta a envoltória de reações de apoio da v0.53.11 ao dashboard integrado de fundações sem transformar automaticamente a reação estrutural em ações persistidas de dimensionamento.

O contrato `foundation-reaction-link/v1` usa exclusivamente o `nodeId` explícito da fundação em `foundationReview.items[]`. Não há associação por proximidade geométrica, coordenadas, nome semelhante ou inferência de topologia.

## Fluxo

1. O explorador resolve as combinações pelo solver principal.
2. A envoltória de reações preserva o apoio, componentes restringidos e combinação governante.
3. No mapa 3D de reações, **Abrir fundação vinculada** envia ao dashboard apenas o contexto transitório da reação selecionada.
4. O dashboard procura fundações com o mesmo `nodeId` explícito e classifica o vínculo como `LINKED`, `UNLINKED`, `AMBIGUOUS` ou `INVALID`.
5. Quando existe um único vínculo, a fundação correspondente é destacada e a reação/combinação governante aparece como evidência de somente leitura.

## Governança da demanda

A reação do solver está no sistema global do modelo. A v0.53.12 não presume automaticamente como `Fx/Fy/Fz/Mx/My/Mz` devem ser convertidos para `N`, `Hx`, `Hy`, `Mx`, `My`, momentos estabilizantes, momentos de tombamento ou ações locais de uma fundação.

Por isso:

- nenhum campo de `foundationReview.items[].demand` é alterado pelo bridge;
- nenhuma capacidade geotécnica ou estrutural é inferida;
- nenhuma reação é convertida em punção, cisalhamento unidirecional ou momento resistente;
- nenhum `PASS/FAIL` é criado a partir da reação isolada;
- a combinação governante é preservada como proveniência;
- vínculos múltiplos no mesmo nó são reportados como ambíguos em vez de escolher uma fundação arbitrariamente.

## Interface

O dashboard **Fundação · SSI · Geotecnia · v0.53.12** apresenta um cartão de **Demanda estrutural por combinação · somente leitura** quando aberto a partir do mapa 3D de reações. O cartão mostra apoio, campo, valor, unidade, vetor quando disponível, combinação governante e estado do vínculo.

O projeto persistido permanece inalterado. Para usar a reação no dimensionamento da fundação, a convenção de sinais/eixos e a combinação de projeto devem ser revisadas explicitamente antes de gravar ações de cálculo.
