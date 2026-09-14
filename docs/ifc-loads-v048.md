# AstraStruct v0.48 — casos, ações e combinações estruturais IFC

## Status

A v0.48 está em desenvolvimento somente no branch `develop`. O produto permanece formalmente em **v0.47.0** até o gate final da v0.48. **Nenhuma promoção para `main`** faz parte deste incremento.

## Objetivo

Introduzir um contrato canônico e auditável para transportar casos de carga, ações estruturais e combinações do AstraStruct para IFC4X3 antes da serialização STEP. A primeira etapa deliberadamente separa a semântica estrutural da emissão física do arquivo.

Contrato experimental:

- `ifc-structural-loads/v1` — `0.48.0-exp`;
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

Na primeira etapa v0.48, apenas cargas `kind = uniform` aplicadas a `frame2d` ou `frame3d` são aceitas.

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

## Caso implícito

O solver nativo interpreta cargas sem `caseId` como pertencentes ao primeiro caso de carga. O mapping v0.48 preserva exatamente essa regra, mas registra `IMPLICIT_FIRST_LOAD_CASE` como warning para tornar a decisão auditável.

## Cargas nulas

Uma ação cujos componentes são todos zero é omitida e gera `ZERO_LOAD_OMITTED`. Ela não cria uma entidade IFC sem efeito físico.

## Escopo adiado

Os seguintes tipos permanecem bloqueantes/pending na primeira etapa do contrato:

- carga pontual ao longo da barra (`point`);
- `followerEnd`;
- `surface` / `pressure`;
- `selfWeight`;
- `thermal`;
- `prestress`;
- assentamentos prescritos.

Eles não serão convertidos por aproximação. Cada família será adicionada somente depois de a direção, sistema de coordenadas, localização e entidade IFC correspondente estarem definidos de forma inequívoca.

## Relações IFC canônicas

O contrato produz três grupos de relações:

1. `IfcRelAssignsToGroup`: ação estrutural -> caso de carga;
2. `IfcRelAssignsToGroupByFactor`: caso de carga -> combinação, com fator;
3. `IfcRelConnectsStructuralActivity`: ação -> nó/membro estrutural de destino.

## Readiness

`mapping.ready = true` somente quando não existem issues bloqueantes. Warnings documentam decisões compatíveis com a semântica nativa, como caso implícito ou omissão de uma carga nula.

## Testes

`tests/ifc-load-mapping-v048-smoke.mjs` cobre:

- `PERMANENT_G`, `VARIABLE_Q` e fallback `NOTDEFINED`;
- ações nodais globais;
- ações uniformes locais em barras;
- `IfcRelAssignsToGroup`;
- `IfcRelAssignsToGroupByFactor`;
- `IfcRelConnectsStructuralActivity`;
- agregação de termos duplicados em combinação;
- caso de carga implícito;
- omissão de carga totalmente nula;
- bloqueio de carga pontual ainda não suportada;
- bloqueio de carga distribuída em treliça;
- bloqueio de assentamentos;
- rejeição de casos duplicados.

O gate experimental é `tests/development-gate-v048-smoke.mjs`.

## Próxima etapa

Depois do gate canônico, a emissão STEP receberá GlobalIds persistentes para casos, combinações, ações e relações. Somente então o parser/importador será ampliado para reconstruir esses objetos a partir de um IFC externo.
