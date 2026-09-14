# AstraStruct v0.48 — casos, ações e combinações estruturais IFC

## Status

A v0.48 está em desenvolvimento somente no branch `develop`. O produto permanece formalmente em **v0.47.0** até o gate final da v0.48. **Nenhuma promoção para `main`** faz parte deste incremento.

## Objetivo

Transportar casos de carga, ações estruturais e combinações do AstraStruct para IFC4X3 com três camadas explícitas: um mapping canônico auditável, a materialização física no STEP e um parser dedicado ao round-trip dessas entidades. O writer somente serializa entidades quando o mapping está READY; tipos de carga sem semântica inequívoca permanecem bloqueantes.

Contratos experimentais:

- `ifc-structural-loads/v1` — `0.48.0-exp`;
- `ifc-step-loads/v1` — `0.48.0-exp`;
- `ifc-step-load-parse/v1` — `0.48.0-exp`;
- `ifc-step-writer/v1` — `0.48.0-exp`;
- `ifc-exchange-state/v1` — `0.48.0-exp`;
- schema alvo: `IFC4X3_ADD2`;
- sistema de unidades aceito nesta etapa: `kN-m-MPa`.

## Casos de carga

Cada `project.loadCases[]` é mapeado para `IfcStructuralLoadCase` com:

- `PredefinedType = LOAD_CASE`;
- `Coefficient = 1.0`;
- `ActionSource = NOTDEFINED`, porque o modelo nativo ainda não armazena a origem normativa/física da ação;
- `ActionType` conforme o tipo nativo conhecido.

Mapeamento inicial:

| AstraStruct | IFC `IfcActionTypeEnum` |
|---|---|
| `permanent` | `PERMANENT_G` |
| `variable` | `VARIABLE_Q` |
| `extraordinary` | `EXTRAORDINARY_A` |
| `user` ou desconhecido | `NOTDEFINED` |

`USERDEFINED` não é usado por aproximação, pois a semântica IFC exige informação complementar de tipo definido pelo usuário. O contrato não inventa `ObjectType`.

## Ações nodais

As cargas de `project.loads[]` são mapeadas para:

- `IfcStructuralPointAction`;
- `IfcStructuralLoadSingleForce`;
- `GlobalOrLocal = GLOBAL_COORDS`;
- conexão ao `IfcStructuralPointConnection` de destino por `IfcRelConnectsStructuralActivity`;
- associação ao caso por `IfcRelAssignsToGroup`.

Componentes preservados:

- `fx -> ForceX`;
- `fy -> ForceY`;
- `fz -> ForceZ`;
- `mx -> MomentX`;
- `my -> MomentY`;
- `mz -> MomentZ`.

O uso de `GLOBAL_COORDS` foi confirmado contra a montagem do solver AstraStruct: as cargas nodais são inseridas diretamente no vetor global de forças.

## Cargas uniformes em barras

Na v0.48, apenas cargas `kind = uniform` aplicadas a `frame2d` ou `frame3d` são aceitas.

Mapeamento:

- `IfcStructuralLinearAction`;
- `PredefinedType = CONST`;
- `IfcStructuralLoadLinearForce`;
- `GlobalOrLocal = LOCAL_COORDS`;
- `ProjectedOrTrue = $/null` nesta fase, porque o AstraStruct não declara carga por comprimento projetado;
- conexão ao `IfcStructuralCurveMember` por `IfcRelConnectsStructuralActivity`.

Componentes:

- `qx -> LinearForceX`;
- `qy -> LinearForceY`;
- `qz -> LinearForceZ`;
- momentos distribuídos inicialmente iguais a zero.

O uso de `LOCAL_COORDS` foi confirmado no solver 2D/3D: `qx/qy/qz` são montados no sistema local do elemento e somente depois transformados para o sistema global.

Cargas uniformes em `truss3d` são bloqueadas porque o próprio solver atual não as suporta.

## Combinações

Cada `project.loadCombinations[]` é mapeada como `IfcStructuralLoadGroup` com:

- `PredefinedType = LOAD_COMBINATION`;
- `ActionType = NOTDEFINED`;
- `ActionSource = NOTDEFINED`;
- `Coefficient = 1.0`.

Cada termo válido da combinação gera uma relação `IfcRelAssignsToGroupByFactor` entre um `IfcStructuralLoadCase` e a combinação. O fator permanece específico para o par caso-combinação.

Termos repetidos do mesmo caso são somados, reproduzindo a semântica de `resolveScenario()` do solver. Termos cuja soma resulta em zero são omitidos com warning. Referências a casos inexistentes ou fatores não finitos são bloqueantes.

## `LoadedBy` do modelo de análise

O STEP v0.48 preenche `IfcStructuralAnalysisModel.LoadedBy` apenas com grupos de carga de topo, conforme a semântica IFC4X3:

- se existem combinações, `LoadedBy` referencia somente as instâncias `IfcStructuralLoadGroup` de `LOAD_COMBINATION`;
- se não existem combinações, `LoadedBy` referencia os `IfcStructuralLoadCase`;
- ações individuais não são inseridas em `IfcStructuralAnalysisModel.IsGroupedBy`.

A relação estrutural principal do analysis model continua agrupando somente nós/conexões e membros. As cargas são alcançadas pela hierarquia `LoadedBy -> load group/case -> action`.

## Persistência de GlobalIds

O estado `ifc-exchange-state/v1` foi ampliado com `loadGlobalIds`.

As chaves persistentes incluem:

- `load-case:<id>`;
- `load-combination:<id>`;
- `load-action:<id>`;
- `rel-load-case:<id>`;
- `rel-load-factor:<combinationId>:<caseId>`;
- `rel-load-activity:<id>`.

Ao reexportar o mesmo projeto, esses GlobalIds são reutilizados. O writer também verifica colisões entre identidades de projeto, analysis model, nós, membros, relações estruturais, associações de material, casos, combinações, ações e relações de carga.

## Parser STEP de cargas

`ifc-step-load-parse/v1` lê a hierarquia de cargas diretamente das referências STEP, sem reinterpretar `Name` como ID interno. O parser resolve:

- `IfcStructuralLoadCase` e seus `ActionType`, `ActionSource` e `Coefficient`;
- `IfcStructuralLoadGroup` de `LOAD_COMBINATION`;
- `IfcStructuralPointAction` + `IfcStructuralLoadSingleForce`;
- `IfcStructuralLinearAction` + `IfcStructuralLoadLinearForce`;
- ação -> caso por `IfcRelAssignsToGroup`;
- ação -> alvo estrutural por `IfcRelConnectsStructuralActivity`;
- caso -> combinação por `IfcRelAssignsToGroupByFactor`;
- grupos de topo por `IfcStructuralAnalysisModel.LoadedBy`.

A identidade primária do round-trip é o `GlobalId`. O nome IFC permanece descrição humana; a etapa de importação deverá criar IDs nativos determinísticos e conservar os GlobalIds originais no seed do estado de intercâmbio.

O parser marca como bloqueantes ações sem caso, ações sem alvo, combinações sem termos válidos, relações fatoradas com tipo incorreto e hierarquias `LoadedBy` incompatíveis com a presença de combinações.

## Caso implícito

O solver nativo interpreta cargas sem `caseId` como pertencentes ao primeiro caso de carga. O mapping v0.48 preserva exatamente essa regra, mas registra `IMPLICIT_FIRST_LOAD_CASE` como warning para tornar a decisão auditável.

## Cargas nulas

Uma ação cujos componentes são todos zero é omitida e gera `ZERO_LOAD_OMITTED`. Ela não cria uma entidade IFC sem efeito físico.

## Escopo adiado

Os seguintes tipos permanecem bloqueantes/pending nesta versão:

- carga pontual ao longo da barra (`point`);
- `followerEnd`;
- `surface` / `pressure`;
- `selfWeight`;
- `thermal`;
- `prestress`;
- assentamentos prescritos.

Eles não serão convertidos por aproximação. Cada família será adicionada somente depois de a direção, sistema de coordenadas, localização e entidade IFC correspondente estarem definidos de forma inequívoca.

## Relações IFC

O contrato produz três grupos de relações:

1. `IfcRelAssignsToGroup`: ação estrutural -> caso de carga;
2. `IfcRelAssignsToGroupByFactor`: caso de carga -> combinação, com fator;
3. `IfcRelConnectsStructuralActivity`: ação -> nó/membro estrutural de destino.

A emissão STEP mantém exatamente essas relações e atribui `IfcOwnerHistory` e GlobalIds persistentes a todas elas.

## Readiness

`mapping.ready = true` somente quando não existem issues bloqueantes. Warnings documentam decisões compatíveis com a semântica nativa, como caso implícito ou omissão de uma carga nula.

`validateIfcStepReadiness()` adiciona um segundo gate: todos os registros `IfcRoot` do mapping de cargas precisam possuir GlobalId válido, único e sem colisão com os demais objetos IFC antes da serialização.

O parser possui seu próprio `ready`, que só fica verdadeiro quando cada ação pode ser associada inequivocamente a um caso e a um alvo estrutural e quando a hierarquia das combinações é consistente.

## Validação externa

O fixture de CI inclui G/Q, ações nodais, uma ação uniforme e uma combinação ULS. O IfcOpenShell valida:

- sintaxe STEP;
- schema IFC4X3 e regras EXPRESS;
- população esperada de casos e ações;
- `GLOBAL_COORDS` para ações nodais;
- `LOCAL_COORDS` e `CONST` para ação linear uniforme;
- fatores 1,2 e 1,5;
- uma única conexão ação -> alvo;
- `LoadedBy` apontando apenas para a combinação de topo.

## Testes

`tests/ifc-load-mapping-v048-smoke.mjs` cobre o mapping canônico, casos, ações, relações, combinações, warnings e bloqueios conservadores.

`tests/ifc-step-loads-v048-smoke.mjs` cobre emissão STEP, `LoadedBy`, persistência de `loadGlobalIds` e coexistência com as identidades estruturais.

`tests/ifc-load-parse-v048-smoke.mjs` cobre o round-trip STEP de casos, ações, alvos, fatores, `LoadedBy` e GlobalIds persistentes.

O gate experimental é `tests/development-gate-v048-smoke.mjs`.

## Próxima etapa

A saída do parser será conectada ao `createIfcImportStaging()` para reconstruir `loadCases`, `loads`, `elementLoads` e `loadCombinations` sem heurísticas silenciosas. O staging deverá bloquear substituição se existirem cargas IFC não suportadas e deverá preparar um seed de identidades para preservar os GlobalIds ao reexportar o projeto importado.
