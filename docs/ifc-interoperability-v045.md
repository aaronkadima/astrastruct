# AstraStruct v0.45 — interoperabilidade BIM/IFC

## Base normativa

A v0.45 adota como referência estável **IFC 4.3 ADD2 / IFC 4.3.2.0 (`IFC4X3_ADD2`)**, publicado como **ISO 16739-1:2024**. Schemas draft posteriores não são usados como contrato de produção.

A implementação permanece desacoplada do solver:

`AstraStruct project -> IFC canonical interoperability model -> guarded IFC STEP writer -> external validation`

O modelo canônico continua sendo a fonte intermediária auditável. O writer STEP é habilitado somente para o subconjunto cuja topologia e semântica possuem gate próprio.

## Contratos v0.45

O módulo `web/src/interop/` expõe atualmente:

- `ifc-interoperability/v1`;
- `ifc-project-context/v1`;
- `ifc-identity-map/v1` / `ifc-identity/v1`;
- `ifc-step-writer/v1`;
- `IFC_INTEROP_VERSION = 0.45.0-exp`;
- `IFC_STEP_WRITER_VERSION = 0.45.0-exp`;
- `IFC_SCHEMA = IFC4X3_ADD2`;
- `IFC_STANDARD = ISO 16739-1:2024`.

A v0.45 ainda não altera `PROJECT_SCHEMA_VERSION`, não modifica o solver e não promove automaticamente a versão de produto. O pacote permanece em `0.44.0` enquanto a interoperabilidade IFC estiver experimental.

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
| seção | conceito `IfcProfileDef`, a especializar no writer |

O classificador de elemento é conservador: shell/surface/plate/slab/membrane/wall são membros de superfície; os demais elementos lineares seguem para membro de curva.

## GlobalId IFC persistente

`web/src/interop/ifcGuid.js` implementa o codec UUID de 128 bits ↔ `IfcGloballyUniqueId` de 22 caracteres usando o alfabeto IFC oficial.

O fluxo não regenera IDs a cada exportação. `createIfcIdentityMap()` cria um mapa persistível e `assignIfcGlobalIds()` reaplica as mesmas identidades aos objetos `IfcRoot` canônicos. O gate rejeita GlobalId inválido, valor fora do espaço de 128 bits, duplicidade e ausência de identidade quando o writer exigir persistência.

As relações adicionais criadas pelo writer (`IfcRelDeclares` e `IfcRelAssignsToGroup`) também recebem GlobalIds persistentes fornecidos explicitamente pelo chamador.

## Unidades e contexto geométrico

Para o sistema atualmente suportado `kN-m-MPa`, `IfcUnitAssignment` contém unidades SI explícitas para comprimento, área, volume, ângulo, massa, tempo, força e pressão.

O domínio estrutural inclui ainda:

- `LINEARSTIFFNESSUNIT = FORCE / LENGTH`;
- `ROTATIONALSTIFFNESSUNIT = FORCE · LENGTH / PLANEANGLE`.

Essas grandezas são materializadas com `IfcDerivedUnit` + `IfcDerivedUnitElement` e são necessárias para molas nodais.

`IfcGeometricRepresentationContext` é tridimensional, possui precisão explícita, `WorldCoordinateSystem`, `TrueNorth` e subcontextos canônicos `Body`/`Axis`. Sistemas de unidades ainda não suportados são rejeitados; não há conversão implícita.

## Apoios e molas

`web/src/interop/ifcBoundary.js` traduz `supports` e `nodeSprings` para `IfcBoundaryNodeCondition` seguindo a semântica IFC4+:

- `TRUE` = rigidez infinita / grau de liberdade restringido;
- `FALSE` = liberação / rigidez nula;
- valor numérico = mola linear-elástica finita.

A antiga convenção IFC2x3 de representar apoio fixo por `-1` não é usada. No STEP, valores numéricos translacionais são escritos como `IfcLinearStiffnessMeasure` e valores rotacionais como `IfcRotationalStiffnessMeasure`.

## Conectividade e round-trip canônico

O modelo rejeita IDs duplicados, conectividade insuficiente, nós inexistentes e referências inexistentes a material/seção. `IfcRelConnectsStructuralMember` preserva a conexão membro–nó.

`renderIfcInteroperabilityJson()` e `parseIfcInteroperabilityJson()` fornecem serialização determinística do contrato canônico. `restoreStructuralCoreFromIfcModel()` reconstrói identificação, unidades, nós, elementos, materiais e seções para validar o round-trip do núcleo estrutural.

Esse mecanismo não é apresentado como importador genérico de qualquer IFC externo.

## Writer STEP — curvas e superfícies planas

`web/src/interop/ifcStep.js` implementa um writer ISO-10303-21 protegido. O subconjunto atual serializa:

- `IfcProject`;
- `IfcUnitAssignment`, `IfcSIUnit` e `IfcDerivedUnit`;
- `IfcGeometricRepresentationContext`;
- `IfcStructuralAnalysisModel` e `IfcLocalPlacement` compartilhado;
- `IfcCartesianPoint`, `IfcVertexPoint` e topologia `Vertex`;
- `IfcEdge` e topologia `Edge`;
- `IfcPolyLoop`, `IfcFaceOuterBound`, `IfcPlane` e `IfcFaceSurface`;
- `IfcStructuralPointConnection`;
- `IfcBoundaryNodeCondition`;
- `IfcStructuralCurveMember`;
- `IfcStructuralSurfaceMember`;
- `IfcRelConnectsStructuralMember`;
- `IfcRelDeclares`;
- `IfcRelAssignsToGroup`.

### Membros lineares

A representação usa `IfcEdge` compartilhando os `IfcVertexPoint` dos nós. O eixo local é derivado de uma direção não paralela à tangente e ortogonalizado antes de criar `IfcDirection`.

### Membros de superfície

A superfície de referência é emitida somente quando os nós formam uma face plana válida. O writer:

1. encontra três pontos não colineares;
2. calcula e normaliza a normal da superfície;
3. verifica todos os nós contra a tolerância de planicidade do contexto IFC;
4. cria `IfcPolyLoop` usando os mesmos `IfcCartesianPoint` dos nós;
5. cria `IfcFaceOuterBound`;
6. define o plano por `IfcAxis2Placement3D` + `IfcPlane`;
7. cria uma única `IfcFaceSurface` para a topologia `Face`;
8. emite `IfcStructuralSurfaceMember` com `PredefinedType` e espessura quando disponível.

O mapeamento inicial de `PredefinedType` é:

- `membrane*` -> `MEMBRANE_ELEMENT`;
- `plate*` / `slab*` -> `BENDING_ELEMENT`;
- demais shell/surface/wall -> `SHELL`.

A espessura é obtida do elemento (`thickness`/`t`) ou da seção associada (`thickness`/`t`) e, quando informada, deve ser estritamente positiva.

### Gate geométrico de superfícies

O writer recusa:

- menos de três nós;
- face colinear/degenerada;
- face não planar além da precisão definida no contexto;
- espessura informada menor ou igual a zero.

Não há triangulação, ajuste por mínimos quadrados ou projeção automática que possa mascarar erro geométrico.

## Gate geral do writer

`validateIfcStepReadiness()` recusa a exportação quando:

- o contrato canônico é inválido;
- GlobalIds persistentes estão ausentes ou duplicados;
- o schema não é `IFC4X3_ADD2`;
- a classe de membro está fora do subconjunto suportado;
- a geometria de curva/superfície viola o respectivo gate;
- os GlobalIds persistentes de `IfcRelDeclares` e `IfcRelAssignsToGroup` não foram fornecidos.

`validateIfcStepEnvelope()` verifica envelope ISO-10303-21, schema declarado, entidades emitidas e referências STEP não resolvidas, além de sinalizar a presença de membros de curva, membros de superfície e `IfcFaceSurface`. Essa verificação interna não substitui um validador IFC externo.

## Cobertura de testes

A cadeia de `npm test` em `develop` inclui:

- `tests/ifc-interop-v045-smoke.mjs` — mapeamento canônico, conectividade, GlobalId, contexto e round-trip;
- `tests/ifc-units-v045-smoke.mjs` — unidades derivadas de rigidez;
- `tests/ifc-step-v045-smoke.mjs` — emissão STEP de curvas e superfícies planas, topologias Vertex/Edge/Face, apoio fixo, molas, espessura, relações e rejeição de faces não planares/degeneradas.

Os benchmarks STEP usam timestamp controlado para manter os testes determinísticos.

## Limitações ainda abertas antes do writer de produção

Apesar de existir um writer STEP executável para curvas e superfícies planas, o campo canônico `exchange.stepWriterReady` permanece `false`. Isso é intencional: `false` significa **não promover o writer experimental como exportador IFC de produção**.

Ainda são necessários:

1. associações normativamente coerentes de materiais: `IfcMaterialProfileSetUsage` para membros lineares e `IfcMaterialLayerSetUsage` para membros de superfície;
2. mapeamento geométrico/semântico completo de perfis e seções;
3. refinamento da conectividade de superfície por borda/face onde exigido pelo caso de intercâmbio;
4. owner/application metadata e política de revisão;
5. parser/round-trip STEP do subconjunto suportado;
6. validação externa automatizada contra schema IFC4X3 e/ou IfcOpenShell;
7. testes com arquivos de referência e intercâmbio com ferramentas BIM/estruturais;
8. gate final v0.45 antes de qualquer atualização de `PRODUCT_VERSION`.

## Regra de publicação

Toda implementação v0.45 permanece exclusivamente em `develop`. A branch `main` continua sendo a publicação estável e não deve receber esta versão enquanto o gate da v0.45, a validação IFC externa e a página de desenvolvimento não estiverem verdes e aprovados.