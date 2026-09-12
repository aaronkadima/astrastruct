# Metadados de resultado v0.16

Resultados de controle de deslocamento expõem `result.pushover` com, no mínimo:

- `enabled`;
- `method = "displacement-control"`;
- `control` (`nodeId`, `dof`, `targetDisplacement`, unidade);
- `finalLoadFactor`;
- `curve[]`;
- `peakLoadFactor`;
- `peakControlledDisplacement`;
- `firstYield`;
- estratégia usada para `∂R/∂λ`;
- `arcLength = false`.

Cada ponto de `curve` contém o passo, deslocamento controlado, `λ`, reação de base, número de rótulas escoadas e eventos de novas plastificações. O histórico detalhado também permanece em `result.nonlinear.history`.
