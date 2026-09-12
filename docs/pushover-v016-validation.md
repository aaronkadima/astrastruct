# AstraStruct v0.16 — matriz de validação

A implementação do pushover por controle de deslocamento foi validada antes da integração com a `main` pelos seguintes gates:

- `npm run check`: TypeScript e validação sintática dos módulos do solver;
- `npm test`: toda a regressão estrutural histórica mais `tests/pushover-smoke.mjs`;
- `npm run build`: build React/Vite;
- Playwright desktop para o fluxo material não linear existente e para o novo fluxo de pushover;
- benchmark elástico de cantilever com deslocamento controlado e fator `λ` comparado à solução analítica de pequena deformação;
- benchmark material com rótula de fibras atravessando a primeira plastificação;
- teste de proteção para DOF controlado restringido;
- regressão do modo de força controlada, incluindo interação N–M, seções I/H e equivalência embedded/outer.

O deploy em GitHub Pages continua condicionado pelo workflow principal, que repete `check`, testes estruturais, build, validação do artefato e toda a suíte Playwright em desktop, Android e tablet após a integração na `main`.
