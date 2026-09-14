# AstraStruct v0.53.8 — Combinações, envoltórias e drift

## Escopo

A v0.53.8 adiciona o contrato `combination-envelope-explorer/v1` e uma interface dedicada em **Resultados → Combinações & envoltórias…**.

O explorador não cria um segundo solver. Cada `loadCombination` é resolvida pelo mesmo `solve(project, scenarioId)` usado pelo restante do AstraStruct. O cálculo é iniciado explicitamente pelo usuário e cada combinação pode terminar em `READY`, `ERROR`, `PENDING` ou `MODE_ONLY`.

## Classificação ELU/ELS

A classificação usa, nesta ordem:

1. metadados explícitos (`limitStateCategory`, `limitStateType`, `category` ou `designSituation`);
2. semântica inequívoca em id/nome/tipo (`ELU`, `ULS`, `ultimate`, `ELS`, `SLS`, `serviceability`);
3. caso contrário, `UNKNOWN`.

`UNKNOWN` nunca é promovido automaticamente a ELU ou ELS.

## Envoltórias

Somente resultados físicos `READY` entram nas envoltórias. Para barras são indexadas as famílias N, V, M e T; para shells são indexados resultantes de membrana N, cortantes transversais V e momentos M. Para cada família são mantidos mínimo, máximo, máximo absoluto, componente governante e combinação governante.

As unidades permanecem ligadas à natureza do elemento. O sistema não mistura, por exemplo, kN com kN/m ou kN·m com kN·m/m em uma grandeza única.

## Drift por pavimento

O drift é derivado dos deslocamentos horizontais médios dos nós associados a pavimentos consecutivos e dividido pela altura entre os níveis. São reportados `driftX`, `driftY`, magnitude, deslocamento horizontal equivalente em mm e combinação governante.

O drift é apenas pós-processamento geométrico. A v0.53.8 não presume limites normativos e não emite PASS/FAIL sem uma verificação ELS explícita.

## Prévia 3D

Uma combinação resolvida pode ser enviada ao Canvas 3D por `astrastruct:result-preview`. A prévia é transitória e não substitui `project.results` nem o resultado principal da análise.

O Canvas 3D mantém o controle existente de escala da deformada. Para a prévia de combinação, o botão **Animar deformada** varia apenas a forma exibida de 0 a 100% e retorna a 0, sem inverter o sinal físico da resposta. Esforços/resultantes continuam provenientes do resultado integral da combinação.

## Governança

- nenhuma resposta sintética entra nas envoltórias;
- combinações que falham no solver são preservadas como `ERROR`;
- formas modais/flambagem são `MODE_ONLY` e ficam excluídas de deslocamentos e drifts físicos;
- ausência de resultado não equivale a zero nem a aprovação;
- a prévia gráfica não altera cargas, rigidez, dimensionamento ou resultados persistidos.
