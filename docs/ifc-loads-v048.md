# AstraStruct v0.48 — casos, ações, combinações e round-trip IFC

## Status de fechamento

A v0.48 está formalmente fechada no branch `develop`, com `PRODUCT_VERSION = 0.48.0` e `package.json = 0.48.0`. O schema persistido continua em versão 2 e o contrato de resultados permanece `structural-result/v1`.

A validação de fechamento exige suíte estrutural completa, build, IfcOpenShell/IFC4X3/EXPRESS e regressão Playwright em desktop, Android e tablet. **Nenhuma promoção para `main`** faz parte deste fechamento; a publicação de produção continua separada da página de desenvolvimento.

## Contratos IFC v0.48

- `ifc-structural-loads/v1` — `0.48.0-exp`;
- `ifc-step-loads/v1` — `0.48.0-exp`;
- `ifc-step-load-parse/v1` — `0.48.0-exp`;
- `ifc-step-writer/v1` — `0.48.0-exp`;
- `ifc-exchange-state/v1` — `0.48.0-exp`;
- `ifc-import-staging/v1` — `0.48.0-exp`;
- schema: `IFC4X3_ADD2`;
- unidades suportadas neste intercâmbio: `kN-m-MPa`.

## Casos de carga

Cada caso nativo é representado por `IfcStructuralLoadCase`, com `PredefinedType = LOAD_CASE` e `Coefficient = 1.0`.

| AstraStruct | IFC ActionType |
|---|---|
| `permanent` | `PERMANENT_G` |
| `variable` | `VARIABLE_Q` |
| `extraordinary` | `EXTRAORDINARY_A` |
| `user`/desconhecido | `NOTDEFINED` |

`ActionSource` permanece `NOTDEFINED` enquanto não houver informação nativa específica. O importador cria IDs nativos determinísticos (`IFC_LC_1`, `IFC_LC_2`, ...); o `Name` IFC permanece descrição humana e não é usado como identidade interna.

## Ações nodais

O subconjunto nodal usa `IfcStructuralPointAction` + `IfcStructuralLoadSingleForce`, em `GLOBAL_COORDS`:

- `fx/fy/fz -> ForceX/ForceY/ForceZ`;
- `mx/my/mz -> MomentX/MomentY/MomentZ`;
- ação → caso via `IfcRelAssignsToGroup`;
- ação → nó via `IfcRelConnectsStructuralActivity`.

O sistema global é coerente com a montagem nativa do solver, que insere essas forças diretamente no vetor global.

## Cargas uniformes em barras

Para `frame2d`/`frame3d`, `kind = uniform` é serializado como `IfcStructuralLinearAction` + `IfcStructuralLoadLinearForce`, com:

- `GlobalOrLocal = LOCAL_COORDS`;
- `PredefinedType = CONST`;
- `qx/qy/qz -> LinearForceX/LinearForceY/LinearForceZ`;
- `ProjectedOrTrue = $`.

A importação rejeita momentos distribuídos não nulos e alvos/tipos de ação sem equivalente nativo seguro.

## Combinações e `LoadedBy`

Cada combinação é um `IfcStructuralLoadGroup` de `LOAD_COMBINATION`. Cada termo caso–combinação é relacionado por `IfcRelAssignsToGroupByFactor`, preservando o fator.

`IfcStructuralAnalysisModel.LoadedBy` referencia apenas os grupos de topo:

- existindo combinações: somente as combinações;
- sem combinações: os `IfcStructuralLoadCase`.

As ações individuais não são inseridas no agrupamento estrutural principal do analysis model.

## Persistência de GlobalIds

O estado `ifc-exchange-state/v1` inclui `loadGlobalIds` para:

- `load-case:<id>`;
- `load-combination:<id>`;
- `load-action:<id>`;
- `rel-load-case:<id>`;
- `rel-load-factor:<combinationId>:<caseId>`;
- `rel-load-activity:<id>`.

O writer verifica colisões entre GlobalIds do projeto, analysis model, nós, membros, relações, associações de material e cargas.

Na importação, `project.ifcImport.exchangeStateSeed` preserva, quando reconstruíveis:

- identidade de projeto e analysis model;
- nós, membros e relações membro–nó;
- `materialAssociationGlobalIds`;
- `loadGlobalIds`;
- `declarationGlobalId` e `groupGlobalId`;
- `creationDate`.

A UI reutiliza o `exchangeStateSeed` no primeiro reexport após importação e grava esse estado antes do reload. Assim, o round-trip preserva as identidades IFC mesmo quando os IDs nativos são regenerados.

## Parser e import staging

`ifc-step-load-parse/v1` resolve a hierarquia por referências STEP/GlobalId, lendo:

- `IfcStructuralLoadCase`;
- `IfcStructuralLoadGroup / LOAD_COMBINATION`;
- `IfcStructuralPointAction`;
- `IfcStructuralLinearAction`;
- `IfcRelAssignsToGroup`;
- `IfcRelAssignsToGroupByFactor`;
- `IfcRelConnectsStructuralActivity`;
- `IfcStructuralAnalysisModel.LoadedBy`.

`ifc-import-staging/v1` reconstrói `loadCases`, `loads`, cargas uniformes em `elementLoads` e `loadCombinations`.

O staging expõe:

- `geometryReady`;
- `loadReady`;
- `commitReady`;
- `analysisReady`.

Uma carga que seria descartada torna `commitReady = false`; portanto, geometria válida não basta para substituir o projeto quando o arquivo contém uma ação IFC fora do subconjunto suportado. Propriedades mecânicas ausentes podem manter `analysisReady = false` sem impedir um commit seguro, desde que estrutura e cargas tenham sido preservadas.

## Escopo conservador

Permanecem bloqueados nesta versão, sem aproximação silenciosa:

- carga pontual ao longo da barra;
- `followerEnd`;
- `surface` / `pressure`;
- `selfWeight`;
- `thermal`;
- `prestress`;
- assentamentos prescritos;
- momentos distribuídos lineares.

## Validação externa

O fixture do CI contém casos G/Q, duas ações nodais, uma ação uniforme e ULS = 1,2G + 1,5Q. O IfcOpenShell confirma:

- sintaxe STEP;
- schema IFC4X3 e regras EXPRESS;
- `GLOBAL_COORDS` para as ações nodais;
- `LOCAL_COORDS` e `CONST` para a ação linear;
- fatores 1,2 e 1,5;
- uma única conexão ação → alvo;
- `LoadedBy` apontando somente para a combinação de topo.

## Gates de fechamento

O release gate `tests/release-gate-v048-smoke.mjs` exige, entre outros:

- `tests/ifc-load-mapping-v048-smoke.mjs`;
- `tests/ifc-step-loads-v048-smoke.mjs`;
- `tests/ifc-load-parse-v048-smoke.mjs`;
- `tests/ifc-load-import-v048-smoke.mjs`;
- histórico de materiais, importação estrutural, solver e dimensionamento;
- validação externa IfcOpenShell;
- regressão desktop, Android e tablet.

A v0.48 somente é considerada fechada após uma CI completa no commit final com `PRODUCT_VERSION = 0.48.0`. `main` permanece intocada até uma promoção explicitamente solicitada.
