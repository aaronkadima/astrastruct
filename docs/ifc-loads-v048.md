# AstraStruct v0.48 — casos, ações, combinações e round-trip IFC

## Status

A v0.48 permanece em desenvolvimento somente no branch `develop`. O produto formal continua em **v0.47.0** até o fechamento do gate final. **Nenhuma promoção para `main`** faz parte desta etapa.

## Escopo e contratos

A v0.48 implementa o intercâmbio bidirecional do subconjunto de cargas estruturais já suportado pelo AstraStruct, sem converter entidades IFC desconhecidas por aproximação. Os contratos experimentais são:

- `ifc-structural-loads/v1` — `0.48.0-exp`;
- `ifc-step-loads/v1` — `0.48.0-exp`;
- `ifc-step-load-parse/v1` — `0.48.0-exp`;
- `ifc-step-writer/v1` — `0.48.0-exp`;
- `ifc-exchange-state/v1` — `0.48.0-exp`;
- `ifc-import-staging/v1` — `0.48.0-exp`.

Schema alvo: `IFC4X3_ADD2`, no sistema nativo `kN-m-MPa`.

## Casos de carga

Cada caso nativo é serializado como `IfcStructuralLoadCase` com `PredefinedType = LOAD_CASE` e `Coefficient = 1.0`. O mapeamento de tipo é conservador:

| AstraStruct | IFC |
|---|---|
| `permanent` | `PERMANENT_G` |
| `variable` | `VARIABLE_Q` |
| `extraordinary` | `EXTRAORDINARY_A` |
| `user` ou desconhecido | `NOTDEFINED` |

`ActionSource` permanece `NOTDEFINED` enquanto o modelo nativo não armazenar a origem da ação. `USERDEFINED` não é inventado sem informação complementar.

Na importação, os casos recebem IDs nativos determinísticos (`IFC_LC_1`, `IFC_LC_2`, ...). O `Name` IFC permanece apenas como nome humano; ele não é reinterpretado como identificador interno.

## Ações nodais

As cargas nodais suportadas são:

- `IfcStructuralPointAction`;
- `IfcStructuralLoadSingleForce`;
- `GlobalOrLocal = GLOBAL_COORDS`;
- `fx/fy/fz -> ForceX/ForceY/ForceZ`;
- `mx/my/mz -> MomentX/MomentY/MomentZ`;
- ação -> caso por `IfcRelAssignsToGroup`;
- ação -> `IfcStructuralPointConnection` por `IfcRelConnectsStructuralActivity`.

O uso de `GLOBAL_COORDS` corresponde à montagem do solver AstraStruct, que insere as cargas nodais diretamente no vetor global.

Na importação, uma ação pontual só é aceita se conservar exatamente essa semântica. Alvo não nodal, sistema diferente de `GLOBAL_COORDS`, tipo de AppliedLoad incompatível ou ação sem caso são bloqueantes.

## Cargas uniformes em barras

O subconjunto v0.48 suporta `kind = uniform` em `frame2d` e `frame3d`:

- `IfcStructuralLinearAction`;
- `IfcStructuralLoadLinearForce`;
- `GlobalOrLocal = LOCAL_COORDS`;
- `PredefinedType = CONST`;
- `qx/qy/qz -> LinearForceX/LinearForceY/LinearForceZ`;
- `ProjectedOrTrue = $` porque o modelo nativo não declara carga por comprimento projetado.

O uso de `LOCAL_COORDS` é coerente com os solvers 2D/3D: os componentes são montados no sistema local antes da transformação global.

Na importação, momentos distribuídos diferentes de zero são bloqueados, pois ainda não existe equivalente nativo seguro. Carga uniforme em treliça também permanece bloqueada.

## Combinações

Cada combinação é representada por `IfcStructuralLoadGroup` com `PredefinedType = LOAD_COMBINATION`. Cada caso participa por `IfcRelAssignsToGroupByFactor`.

Termos repetidos do mesmo caso são somados conforme `resolveScenario()`. Fatores não finitos ou referências a casos inexistentes são bloqueantes. Termos cuja soma é zero são omitidos com warning.

Na importação, as combinações recebem IDs determinísticos (`IFC_COMB_1`, ...), mantendo o nome original e os fatores. Combinação sem termo importável gera bloqueio.

## `LoadedBy`

O `IfcStructuralAnalysisModel.LoadedBy` contém somente grupos de topo:

- com combinações: apenas os `IfcStructuralLoadGroup` de `LOAD_COMBINATION`;
- sem combinações: os `IfcStructuralLoadCase`.

As ações individuais não são incluídas no `IsGroupedBy` do analysis model. A hierarquia é `LoadedBy -> caso/combinação -> ação`.

O parser `ifc-step-load-parse/v1` valida essa hierarquia. Se houver combinação e `LoadedBy` apontar para um objeto incompatível, o arquivo não fica READY para importação.

## Persistência de GlobalIds

`ifc-exchange-state/v1` inclui `loadGlobalIds`. As chaves estáveis são:

- `load-case:<id>`;
- `load-combination:<id>`;
- `load-action:<id>`;
- `rel-load-case:<id>`;
- `rel-load-factor:<combinationId>:<caseId>`;
- `rel-load-activity:<id>`.

O writer verifica colisões entre GlobalIds do projeto, analysis model, nós, membros, relações estruturais, associações de material e todos os objetos de carga.

Na importação, o staging cria `project.ifcImport.exchangeStateSeed`. Esse `exchangeStateSeed` contém:

- GlobalIds de `IfcProject` e `IfcStructuralAnalysisModel`;
- GlobalIds de nós, membros e `IfcRelConnectsStructuralMember` reconstruíveis;
- `materialAssociationGlobalIds` por elemento nativo;
- `loadGlobalIds` usando os novos IDs nativos determinísticos;
- `declarationGlobalId` e `groupGlobalId` quando presentes;
- `creationDate` do `IfcOwnerHistory`.

A UI usa esse seed quando ainda não existe estado em `localStorage` e também o persiste no momento do commit da importação. Assim, importar e reexportar o mesmo IFC preserva as identidades globais sempre que o objeto possui equivalente nativo.

## Parser STEP

`ifc-step-load-parse/v1` resolve as entidades por referências STEP e GlobalIds, e não por nomes. Ele lê:

- `IfcStructuralLoadCase`;
- `IfcStructuralLoadGroup / LOAD_COMBINATION`;
- `IfcStructuralPointAction` + `IfcStructuralLoadSingleForce`;
- `IfcStructuralLinearAction` + `IfcStructuralLoadLinearForce`;
- `IfcRelAssignsToGroup`;
- `IfcRelAssignsToGroupByFactor`;
- `IfcRelConnectsStructuralActivity`;
- `IfcStructuralAnalysisModel.LoadedBy`.

São bloqueantes: ação sem caso, ação sem alvo, múltiplos casos/alvos para a mesma ação, combinação vazia, relação fatorada incompatível, AppliedLoad não suportado e hierarquia `LoadedBy` incoerente.

## Import staging e `commitReady`

`ifc-import-staging/v1` `0.48.0-exp` reconstrói:

- `project.loadCases`;
- `project.loads`;
- `project.elementLoads` uniformes;
- `project.loadCombinations`;
- propriedades estruturais já suportadas pelas versões anteriores.

O staging expõe quatro estados:

- `geometryReady`: não existem bloqueios de estrutura/topologia nem perda de conteúdo de carga;
- `loadReady`: todas as cargas presentes no subconjunto lido podem ser reconstruídas sem perda;
- `commitReady`: o projeto pode substituir com segurança o projeto aberto;
- `analysisReady`: além do commit seguro, o modelo possui as propriedades mecânicas necessárias à análise.

Uma carga IFC não suportada torna `commitReady = false`. Portanto, um arquivo com geometria válida mas cargas que seriam descartadas não pode substituir o projeto aberto silenciosamente.

A ausência de `E`, `G/ν` ou propriedades geométricas pode manter `analysisReady = false` sem necessariamente bloquear o commit, desde que o conteúdo estrutural e as cargas tenham sido preservados. O usuário pode completar as propriedades depois.

## UI de intercâmbio

A pré-importação apresenta:

- nós, elementos, materiais e seções;
- quantidade de casos e combinações;
- cargas nodais e de barra;
- readiness de geometria, cargas, importação e análise;
- issues bloqueantes.

O botão de importação só é habilitado quando `commitReady` é verdadeiro. O projeto atual é salvo em backup antes da substituição. O estado IFC importado é persistido antes do reload para garantir reexportação com identidade estável.

Na exportação, a UI também mostra o resumo de casos/ações e bloqueia arquivos que contenham tipos de carga ainda fora do contrato v0.48.

## Tipos adiados

Permanecem fora deste incremento:

- `point` ao longo da barra;
- `followerEnd`;
- `surface` / `pressure`;
- `selfWeight`;
- `thermal`;
- `prestress`;
- assentamentos prescritos;
- momentos distribuídos lineares.

Esses casos não são convertidos por aproximação.

## Validação externa

O fixture de CI contém G/Q, duas ações nodais, uma ação uniforme e ULS = 1,2G + 1,5Q. O IfcOpenShell valida:

- sintaxe STEP;
- schema IFC4X3 e regras EXPRESS;
- população de casos e ações;
- `GLOBAL_COORDS` para ações nodais;
- `LOCAL_COORDS` e `CONST` para ação uniforme;
- fatores 1,2 e 1,5;
- uma única ligação ação -> alvo;
- `LoadedBy` apontando exclusivamente para a combinação de topo.

## Testes

- `tests/ifc-load-mapping-v048-smoke.mjs`: mapping canônico e bloqueios;
- `tests/ifc-step-loads-v048-smoke.mjs`: emissão STEP, `LoadedBy` e persistência de `loadGlobalIds`;
- `tests/ifc-load-parse-v048-smoke.mjs`: parser de casos, ações, alvos, fatores e GlobalIds;
- `tests/ifc-load-import-v048-smoke.mjs`: reconstrução nativa e reexportação preservando as identidades IFC de origem;
- `tests/development-gate-v048-smoke.mjs`: gate frontal experimental.

O produto permanece em **0.47.0** até todos os gates finais da v0.48 ficarem verdes e o release gate substituir o development gate. `main` permanece intocada.
