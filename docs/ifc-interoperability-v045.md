# AstraStruct v0.45 — interoperabilidade BIM/IFC

## Base normativa e arquitetura

A v0.45 adota como referência estável **IFC 4.3 ADD2 / IFC 4.3.2.0 (`IFC4X3_ADD2`)**, publicado como **ISO 16739-1:2024**. Schemas draft posteriores não são usados como contrato de produção.

A interoperabilidade permanece desacoplada do solver:

`AstraStruct project -> IFC canonical model -> STEP writer -> strict STEP parser/round-trip -> IfcOpenShell validation`

O modelo canônico é a camada intermediária auditável. Nenhuma regra de serialização STEP altera a mecânica estrutural, o schema persistido do projeto ou os resultados de análise.

## Contratos v0.45

O módulo `web/src/interop/` expõe:

- `ifc-interoperability/v1`;
- `ifc-project-context/v1`;
- `ifc-identity-map/v1` / `ifc-identity/v1`;
- `ifc-material-mapping/v1`;
- `ifc-step-material/v1`;
- `ifc-step-owner/v1`;
- `ifc-step-writer/v1`;
- `ifc-step-parser/v1`;
- `IFC_INTEROP_VERSION = 0.45.0-exp`;
- `IFC_STEP_WRITER_VERSION = 0.45.0-exp`;
- `IFC_STEP_PARSER_VERSION = 0.45.0-exp`;
- `IFC_SCHEMA = IFC4X3_ADD2`;
- `IFC_STANDARD = ISO 16739-1:2024`.

A implementação não altera `PROJECT_SCHEMA_VERSION`. Enquanto a v0.45 permanecer experimental, `main` continua sendo a publicação estável e o produto publicado não é promovido automaticamente.

## Mapeamento estrutural canônico

| AstraStruct | Conceito IFC 4.3 |
|---|---|
| projeto | `IfcProject` |
| modelo de análise | `IfcStructuralAnalysisModel` |
| nó / apoio pontual | `IfcStructuralPointConnection` |
| barra / viga / pilar / treliça | `IfcStructuralCurveMember` |
| laje / parede / placa / casca | `IfcStructuralSurfaceMember` |
| ligação membro–nó | `IfcRelConnectsStructuralMember` |
| condição de apoio nodal | `IfcBoundaryNodeCondition` |
| material | `IfcMaterial` |
| seção linear explícita | `IfcProfileDef` + material profile set |

Shell/surface/plate/slab/membrane/wall são classificados como membros de superfície; os demais elementos lineares suportados seguem para membros de curva.

## Identidade IFC persistente

`ifcGuid.js` implementa UUID de 128 bits ↔ `IfcGloballyUniqueId` de 22 caracteres. O fluxo não regenera identidade em cada exportação.

`createIfcIdentityMap()` cria um mapa persistível e `assignIfcGlobalIds()` reaplica as identidades. São rejeitados:

- GlobalId sintaticamente inválido;
- valor que exceda o espaço de 128 bits;
- duplicidade;
- ausência de GlobalId em `IfcRoot` antes da emissão STEP.

`IfcRelDeclares`, `IfcRelAssignsToGroup` e cada `IfcRelAssociatesMaterial` também recebem GlobalIds persistentes explícitos.

## Unidades e contexto geométrico

O sistema atualmente suportado é `kN-m-MPa`. O `IfcUnitAssignment` declara unidades SI explícitas para comprimento, área, volume, ângulo, massa, tempo, força e pressão.

O domínio estrutural também declara:

- `LINEARSTIFFNESSUNIT = FORCE / LENGTH`;
- `ROTATIONALSTIFFNESSUNIT = FORCE · LENGTH / PLANEANGLE`.

`IfcGeometricRepresentationContext` é tridimensional, com precisão explícita, `WorldCoordinateSystem` e `TrueNorth`. Sistemas de unidades ainda não suportados são rejeitados; não há conversão implícita.

## Apoios e molas

`ifcBoundary.js` traduz `supports` e `nodeSprings` para `IfcBoundaryNodeCondition` conforme a semântica IFC4+:

- `TRUE` = grau de liberdade restringido / rigidez infinita;
- `FALSE` = liberação / rigidez nula;
- valor numérico = mola linear-elástica finita.

No STEP, molas translacionais usam `IfcLinearStiffnessMeasure` e molas rotacionais usam `IfcRotationalStiffnessMeasure`.

## Materiais e perfis

`ifcMaterial.js` possui um gate de readiness separado da geometria estrutural.

### Superfícies homogêneas

Uma superfície com material explícito é mapeada como `READY / DIRECT_MATERIAL` e associada por `IfcRelAssociatesMaterial`. A espessura continua no `IfcStructuralSurfaceMember`.

### Membros lineares

Membros lineares exigem geometria de perfil explícita em `section.ifcProfile`. O AstraStruct **não tenta reconstruir o perfil apenas a partir de A, Iy, Iz ou J**, pois essas propriedades não identificam uma geometria única.

Perfis explicitamente suportados neste incremento:

- `IfcRectangleProfileDef`;
- `IfcCircleProfileDef`;
- `IfcIShapeProfileDef`.

Para perfis I/H são verificados, entre outros requisitos geométricos:

- `WebThickness < OverallWidth`;
- `2 × FlangeThickness < OverallDepth`;
- `FilletRadius` dentro das dimensões disponíveis.

O encadeamento STEP é:

`IfcProfileDef -> IfcMaterialProfile -> IfcMaterialProfileSet -> IfcMaterialProfileSetUsage -> IfcRelAssociatesMaterial`

`IfcMaterialProfileSetUsage.CardinalPoint = 10` representa inserção pelo centroide geométrico.

Se o membro possuir apenas propriedades mecânicas da seção, o estado permanece `PENDING / IFC_PROFILE_MISSING` e, por padrão, a exportação STEP é bloqueada.

## Owner/Application metadata

`ifcStepOwner.js` exige metadata explícita e não inventa responsável técnico. O writer emite:

- `IfcPerson`;
- `IfcOrganization`;
- `IfcPersonAndOrganization`;
- `IfcApplication`;
- `IfcOwnerHistory`.

O mesmo `IfcOwnerHistory` é referenciado pelos objetos `IfcRoot` emitidos no subconjunto suportado, incluindo relações de material. `CreationDate` é um `IfcTimeStamp` explícito ou derivado de timestamp ISO válido.

## Writer STEP — curvas e superfícies planas

`ifcStep.js` emite ISO-10303-21 para o subconjunto estrutural validado.

### Entidades principais

- `IfcProject`;
- `IfcStructuralAnalysisModel` com placement compartilhado;
- `IfcStructuralPointConnection`;
- `IfcStructuralCurveMember`;
- `IfcStructuralSurfaceMember`;
- `IfcBoundaryNodeCondition`;
- `IfcRelConnectsStructuralMember`;
- `IfcRelDeclares`;
- `IfcRelAssignsToGroup`;
- `IfcRelAssociatesMaterial`;
- unidades, contexto, owner/application e recursos de material/profile necessários.

### Membros lineares

A topologia de referência usa `IfcEdge` compartilhando os `IfcVertexPoint` dos nós. O eixo local é calculado a partir de uma direção não paralela à tangente e ortogonalizado antes de criar `IfcDirection`.

### Membros de superfície

A superfície é emitida somente quando os nós formam uma face plana válida:

1. seleção de três pontos não colineares;
2. cálculo da normal;
3. teste de planicidade de todos os nós;
4. `IfcPolyLoop` com os mesmos `IfcCartesianPoint` nodais;
5. `IfcFaceOuterBound`;
6. `IfcAxis2Placement3D` + `IfcPlane`;
7. uma `IfcFaceSurface` de referência;
8. `IfcStructuralSurfaceMember` com `PredefinedType` e espessura, quando disponível.

Mapeamento inicial de `PredefinedType`:

- `membrane*` -> `MEMBRANE_ELEMENT`;
- `plate*` / `slab*` -> `BENDING_ELEMENT`;
- demais shell/surface/wall -> `SHELL`.

O writer rejeita face colinear/degenerada, face não planar além da tolerância e espessura informada menor ou igual a zero. Não há triangulação, projeção ou ajuste silencioso.

## Parser STEP e round-trip estrutural

`ifcStepParse.js` implementa um parser **estrito do subconjunto emitido pelo AstraStruct**; ele não é apresentado como parser IFC universal.

O parser:

- indexa entidades STEP e verifica referências;
- decodifica strings SPF, inclusive `\X2\...\X0\`;
- valida GlobalIds dos `IfcRoot` suportados;
- reconstrói owner/application;
- recupera coordenadas dos nós por `Vertex`;
- recupera barras por `Edge`;
- recupera superfícies por `FaceSurface`/`PolyLoop`;
- recupera `IfcRelConnectsStructuralMember`;
- lê material direto ou `IfcMaterialProfileSetUsage`.

`validateIfcStructuralRoundTrip()` verifica que projeto/modelo de análise, GlobalIds, coordenadas e conectividade do modelo canônico sobrevivem a:

`canonical model -> STEP -> parser`

O benchmark contém também adulterações controladas: coordenada modificada, referência STEP inexistente e GlobalId duplicado devem ser rejeitados.

## Validação independente com IfcOpenShell

O workflow `AstraStruct CI` possui, em `develop`, o job `ifc-external-validation`.

Ele usa **IfcOpenShell 0.8.5** e `pytest` fixados no ambiente de CI. O job:

1. gera um fixture IFC4X3 determinístico com uma barra e uma casca;
2. passa o arquivo por `ifcopenshell.simple_spf`;
3. abre o arquivo de forma independente do parser AstraStruct;
4. verifica a população esperada de entidades estruturais;
5. executa validação de schema com regras EXPRESS;
6. valida header/application metadata;
7. valida presença, sintaxe e unicidade dos GlobalIds de `IfcRoot`.

O fixture corrente contém quatro nós, um `IfcStructuralCurveMember`, um `IfcStructuralSurfaceMember`, duas associações de material e owner/application metadata. O gate externo concluiu com sucesso após a instalação explícita da dependência de validação `pytest`.

A aprovação desse fixture demonstra conformidade de schema/EXPRESS do **subconjunto atualmente coberto**. Ela não equivale a certificação buildingSMART nem garante interoperabilidade perfeita com todos os authoring/analysis tools.

## Cobertura de testes v0.45

A cadeia principal em `develop` inclui:

- `tests/ifc-interop-v045-smoke.mjs` — modelo canônico, contexto, identidade e conectividade;
- `tests/ifc-units-v045-smoke.mjs` — unidades estruturais derivadas;
- `tests/ifc-material-v045-smoke.mjs` — material direto, profiles explícitos e estados PENDING;
- `tests/ifc-step-v045-smoke.mjs` — writer, owner/application, materiais, barras, superfícies, apoios e guards geométricos;
- `tests/ifc-step-roundtrip-v045-smoke.mjs` — round-trip misto barra + casca, Unicode SPF e detecção de adulterações;
- fixture independente `scripts/generate-ifc-v045-validation-fixture.mjs`;
- validação externa `scripts/validate-ifc-v045-ifcopenshell.py`.

Além dos testes IFC, a cadeia mantém todos os gates estruturais anteriores e o build React/Vite. Em `develop`, a regressão Playwright continua verificando desktop, Android e tablet.

## Limitações remanescentes

O campo canônico `exchange.stepWriterReady` permanece `false` até o fechamento formal da v0.45. As principais limitações restantes são:

1. catálogo de perfis IFC ainda restrito a retangular, circular e I/H;
2. superfícies compostas/multicamadas ainda não usam `IfcMaterialLayerSetUsage`;
3. conexões de superfícies permanecem representadas pela conectividade membro–point connection do subconjunto atual; casos que exijam structural curve/surface connections dedicadas precisam de extensão;
4. ausência, nesta etapa, de IDS/MVD específico para definir requisitos de troca além do schema IFC4X3;
5. necessidade de testes de interoperabilidade de aplicação com arquivos abertos/salvos por ferramentas BIM/estruturais independentes, além da validação de schema pelo IfcOpenShell;
6. integração completa do fluxo Importar/Exportar IFC na interface do aplicativo;
7. gate final da v0.45 e atualização de `PRODUCT_VERSION` apenas após a página `develop` concluir todos os testes previstos.

## Regra de publicação

Toda a v0.45 permanece em `develop`. `main` continua sendo a publicação estável. Nenhuma promoção para `main` deve ocorrer somente porque o schema IFC passou: o gate final também exige regressão da aplicação de desenvolvimento e validação explícita do fluxo de interface.