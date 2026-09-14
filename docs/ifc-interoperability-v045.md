# AstraStruct v0.45 — interoperabilidade BIM/IFC

## Estado de fechamento

A v0.45 fecha, na branch `develop`, o primeiro fluxo IFC estrutural verificável de ponta a ponta do AstraStruct. A versão de desenvolvimento passa a declarar **PRODUCT_VERSION = 0.45.0** somente após o gate final. A publicação estável em `main` permanece separada e não é promovida automaticamente.

A base normativa adotada é **IFC 4.3 ADD2 / IFC 4.3.2.0 (`IFC4X3_ADD2`)**, publicada como **ISO 16739-1:2024**.

Arquitetura validada:

`AstraStruct project -> IFC canonical model -> STEP writer -> strict STEP parser/round-trip -> IfcOpenShell validation -> Intercâmbio IFC4X3 na interface`

O solver e o contrato persistido do projeto permanecem desacoplados da camada BIM. A v0.45 mantém `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0`.

## Contratos v0.45

O diretório `web/src/interop/` consolida:

- `ifc-interoperability/v1`;
- `ifc-project-context/v1`;
- `ifc-identity-map/v1` / `ifc-identity/v1`;
- `ifc-material-mapping/v1`;
- `ifc-step-material/v1`;
- `ifc-step-owner/v1`;
- `ifc-step-writer/v1`;
- `ifc-step-parser/v1`;
- `ifc-exchange-state/v1`.

Os módulos IFC permanecem versionados como `0.45.0-exp` para deixar explícito que o suporte corresponde ao **subconjunto estrutural documentado**, mesmo quando o produto de desenvolvimento é fechado como `0.45.0`.

## Mapeamento estrutural

| AstraStruct | IFC 4.3 |
|---|---|
| projeto | `IfcProject` |
| modelo de análise | `IfcStructuralAnalysisModel` |
| nó / apoio pontual | `IfcStructuralPointConnection` |
| barra, viga, pilar ou treliça | `IfcStructuralCurveMember` |
| laje, parede, placa ou casca | `IfcStructuralSurfaceMember` |
| ligação membro–nó | `IfcRelConnectsStructuralMember` |
| condição nodal | `IfcBoundaryNodeCondition` |
| material | `IfcMaterial` |
| perfil linear explícito | `IfcProfileDef` + `IfcMaterialProfileSetUsage` |

O modelo canônico continua sendo uma representação intermediária auditável. O campo `exchange.stepWriterReady` desse objeto não é usado como certificação genérica do arquivo STEP; a prontidão real do STEP é decidida pelos gates específicos do writer, material/profile, round-trip e validação externa.

## GlobalIds persistentes

`ifcGuid.js` implementa UUID de 128 bits ↔ `IfcGloballyUniqueId` de 22 caracteres. Os **GlobalIds persistentes** são criados uma vez e reaplicados nas exportações seguintes do mesmo projeto.

O fluxo rejeita:

- GlobalId inválido;
- valor fora do espaço de 128 bits;
- duplicidade;
- ausência de identidade obrigatória em objetos `IfcRoot` emitidos.

A identidade persistida cobre projeto, modelo de análise, nós, membros, relações membro–nó, `IfcRelDeclares`, `IfcRelAssignsToGroup` e relações `IfcRelAssociatesMaterial`.

O estado da interface é armazenado por projeto sob o contrato `ifc-exchange-state/v1`, incluindo os GlobalIds e o `CreationDate`, evitando regeneração a cada download.

## Unidades, contexto e condições de contorno

O sistema de unidades suportado nesta etapa é `kN-m-MPa`. O writer declara unidades SI para comprimento, área, volume, ângulo, massa, tempo, força e pressão, além de:

- `LINEARSTIFFNESSUNIT = FORCE / LENGTH`;
- `ROTATIONALSTIFFNESSUNIT = FORCE · LENGTH / PLANEANGLE`.

O contexto geométrico é tridimensional, com precisão explícita, `WorldCoordinateSystem`, `TrueNorth` e subcontextos Body/Axis.

Apoios e molas seguem a semântica IFC4+ de `IfcBoundaryNodeCondition`:

- `TRUE` = restrição rígida;
- `FALSE` = liberação;
- valor numérico = mola elástica finita.

## Materiais e perfis

A exportação não reconstrói geometria de seção a partir apenas de `A`, `Iy`, `Iz` ou `J`. Esses valores não identificam univocamente um perfil.

Perfis explicitamente suportados:

- `IfcRectangleProfileDef`;
- `IfcCircleProfileDef`;
- `IfcIShapeProfileDef`.

Seções AstraStruct das famílias geométricas reconhecidas (`rect`, `circle`, `i`) podem ser enriquecidas para `section.ifcProfile` usando suas dimensões explícitas. Se houver somente propriedades mecânicas, o membro permanece `PENDING / IFC_PROFILE_MISSING` e a exportação é bloqueada por padrão.

Para membros lineares, a cadeia material/perfil é:

`IfcProfileDef -> IfcMaterialProfile -> IfcMaterialProfileSet -> IfcMaterialProfileSetUsage -> IfcRelAssociatesMaterial`

O `CardinalPoint = 10` representa inserção no centroide geométrico. Superfícies homogêneas usam associação direta de `IfcMaterial`, mantendo a espessura no `IfcStructuralSurfaceMember`.

## OwnerHistory e aplicação

A interface exige metadata de pessoa e organização e não inventa responsável técnico. O STEP emite:

- `IfcPerson`;
- `IfcOrganization`;
- `IfcPersonAndOrganization`;
- `IfcApplication`;
- `IfcOwnerHistory`.

O `IfcOwnerHistory` é reutilizado nos objetos raiz emitidos, inclusive relações de material. `IfcApplication` identifica o AstraStruct e sua versão do módulo de intercâmbio.

## Writer STEP

`ifcStep.js` emite ISO-10303-21 para o subconjunto estrutural suportado. Entre as entidades principais estão:

- `IfcProject`;
- `IfcStructuralAnalysisModel`;
- `IfcStructuralPointConnection`;
- `IfcStructuralCurveMember`;
- `IfcStructuralSurfaceMember`;
- `IfcBoundaryNodeCondition`;
- `IfcRelConnectsStructuralMember`;
- `IfcRelDeclares`;
- `IfcRelAssignsToGroup`;
- `IfcRelAssociatesMaterial`;
- contexto, unidades, owner/application e recursos de material/profile.

Barras usam topologia `IfcEdge` sobre vértices compartilhados. Superfícies usam `IfcPolyLoop`, `IfcFaceOuterBound`, `IfcPlane` e `IfcFaceSurface`.

Superfícies são aceitas somente quando são planas dentro da precisão do contexto. Geometria degenerada/colinear, não planicidade e espessura não positiva são rejeitadas. Não existe triangulação, projeção ou ajuste silencioso.

## Parser e round-trip

`ifcStepParse.js` é um parser estrito do **subconjunto STEP produzido pelo AstraStruct**, não um parser IFC universal.

Ele recupera:

- projeto e modelo de análise;
- owner/application;
- GlobalIds;
- nós e coordenadas;
- barras por `Edge`;
- superfícies por `FaceSurface`/`PolyLoop`;
- conectividade estrutural;
- material direto ou `IfcMaterialProfileSetUsage`.

O benchmark de round-trip executa:

`canonical model -> STEP -> parser -> comparação estrutural`

com modelo misto barra + casca. Adulterações de coordenadas, referências STEP inexistentes e GlobalId duplicado são rejeitadas.

## Validação externa

O job `ifc-external-validation`, exclusivo de `develop`, usa **IfcOpenShell 0.8.5** e `pytest` fixados no CI.

O gate:

1. gera fixture IFC4X3 determinístico com barra e casca;
2. valida a sintaxe física SPF;
3. abre o arquivo por implementação independente;
4. verifica entidades estruturais esperadas;
5. executa validação de schema e regras EXPRESS;
6. verifica application/owner metadata;
7. verifica presença, sintaxe e unicidade dos GlobalIds.

O fixture validado contém quatro nós, um `IfcStructuralCurveMember`, um `IfcStructuralSurfaceMember`, duas associações de material e owner/application metadata. O gate conclui sem findings de schema/EXPRESS para o subconjunto coberto.

Essa aprovação não equivale a certificação buildingSMART e não deve ser apresentada como compatibilidade universal com qualquer ferramenta IFC.

## Intercâmbio IFC4X3 na aplicação

A interface de desenvolvimento possui painel dedicado **Intercâmbio IFC4X3**. O fluxo JSON original permanece independente e não foi substituído.

O painel:

- lê o projeto persistido atual;
- apresenta `READY` ou `PENDING` por membro;
- mostra a estratégia de associação de material;
- exige pessoa e organização para o `OwnerHistory`;
- preserva identidades entre exportações;
- gera download `.ifc`;
- permite validar/inspecionar um arquivo IFC pelo parser AstraStruct;
- não sobrescreve o projeto atual durante a inspeção.

Em telas móveis, o acesso IFC ocupa um slot próprio do dock, sem sobrepor os controles de modelagem, Canvas 3D ou o launcher Lab & Modelos.

## Cobertura e release gate

A cadeia determinística da v0.45 inclui:

- `tests/release-gate-v045-smoke.mjs`;
- `tests/ifc-interop-v045-smoke.mjs`;
- `tests/ifc-units-v045-smoke.mjs`;
- `tests/ifc-material-v045-smoke.mjs`;
- `tests/ifc-step-v045-smoke.mjs`;
- `tests/ifc-step-roundtrip-v045-smoke.mjs`;
- `tests/ifc-exchange-ui-v045-smoke.mjs`;
- `tests/e2e/ifc-exchange-v045.spec.ts`;
- fixture `scripts/generate-ifc-v045-validation-fixture.mjs`;
- validação independente `scripts/validate-ifc-v045-ifcopenshell.py`.

A regressão integral continua cobrindo os gates estruturais anteriores e a aplicação em **desktop, Android e tablet**. O fechamento exige simultaneamente:

1. typecheck;
2. todos os smoke/solver tests;
3. smoke de persistência do intercâmbio IFC;
4. build React/Vite;
5. IfcOpenShell SPF + IFC4X3 schema/EXPRESS;
6. regressão Playwright multidispositivo.

## Limitações remanescentes

Mesmo com o fechamento v0.45, permanecem explicitamente fora do escopo atual:

1. catálogo IFC de perfis além de retangular, circular e I/H;
2. `IfcMaterialLayerSetUsage` para superfícies multicamadas/compostas;
3. structural curve/surface connections dedicadas para topologias mais avançadas;
4. IDS/MVD de troca específico do AstraStruct;
5. importação IFC genérica e reconstrução completa de qualquer modelo BIM;
6. testes de abrir/editar/salvar em múltiplos authoring/analysis tools independentes;
7. certificação buildingSMART.

## Regra de publicação

O fechamento da v0.45 ocorre primeiro em `develop`. **Nenhuma promoção para `main`** é automática. `main` continua sendo a publicação estável anterior até uma decisão explícita de promoção após o gate final da branch de desenvolvimento.
