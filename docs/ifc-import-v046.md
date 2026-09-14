# AstraStruct v0.46 — importação IFC estrutural controlada

## Status

A v0.46 está em desenvolvimento somente no branch `develop`. O produto permanece formalmente em **v0.45.0** até o gate final da v0.46. Nenhuma promoção para `main` faz parte deste incremento.

## Objetivo

A v0.46 transforma a leitura IFC da v0.45 em uma **importação estrutural auditável**, sem inferências silenciosas. O fluxo é:

`arquivo IFC4X3 -> parser estrito -> staging de importação -> validação geométrica -> validação mecânica -> confirmação explícita -> backup local -> substituição do projeto`

Selecionar um arquivo não altera o projeto aberto. A substituição somente ocorre após a pré-importação e uma ação explícita do usuário.

## Contratos experimentais

- `ifc-import-staging/v1` — `0.46.0-exp`;
- `ifc-mechanical-exchange/v1` — `0.46.0-exp`;
- schema de troca: `IFC4X3_ADD2`;
- referência normativa: ISO 16739-1:2024.

O `PROJECT_SCHEMA_VERSION` permanece 2 e o `RESULT_CONTRACT_VERSION` permanece `1.0`.

## Readiness em duas camadas

O staging separa dois estados:

### `geometryReady`

Indica que a topologia suportada pode ser reconstruída sem ambiguidade. O estado exige, entre outros pontos:

- nós estruturais tridimensionais válidos;
- conectividade resolvida;
- `IfcStructuralCurveMember` com exatamente dois nós;
- superfícies compatíveis com `shell4`, atualmente com exatamente quatro nós;
- `PredefinedType` reconhecido;
- perfil linear explícito compatível quando necessário;
- espessura de superfície positiva quando aplicável;
- unidades de troca suportadas.

### `analysisReady`

Indica que, além da geometria, as propriedades mínimas necessárias ao solver estão disponíveis. O staging não inventa propriedades mecânicas. Se `E`, `G/ν`, `ν`, área, inércias, torção ou espessura necessários estiverem ausentes, a geometria pode ser importada, mas o cálculo permanece bloqueado.

O solver possui um guard próprio: qualquer projeto importado de IFC com `meta.analysisReady === false` é rejeitado antes da análise, mesmo que seja carregado por um caminho diferente da interface.

## Semântica de membros lineares

O writer e o importador preservam a semântica estrutural IFC:

| AstraStruct | IFC4X3 | Retorno |
|---|---|---|
| `frame3d` | `IfcStructuralCurveMember / RIGID_JOINED_MEMBER` | `frame3d` |
| `truss3d` | `IfcStructuralCurveMember / PIN_JOINED_MEMBER` | `truss3d` |

Enums de curva fora do subconjunto reconhecido são tratados como bloqueio geométrico em vez de serem convertidos por heurística.

## Superfícies

`IfcStructuralSurfaceMember` é mapeado inicialmente para `shell4` quando o `PredefinedType` é:

- `SHELL`;
- `BENDING_ELEMENT`;
- `MEMBRANE_ELEMENT`.

A v0.46 inicial exige quatro nós por superfície para compatibilidade direta com o solver `shell4`. Polígonos com outras cardinalidades não são triangulados nem projetados silenciosamente.

## Apoios e molas

`IfcBoundaryNodeCondition` é recuperado conforme a semântica IFC4+:

- `IfcBoolean(TRUE)` -> grau de liberdade fixo;
- `IfcBoolean(FALSE)` -> grau de liberdade liberado;
- `IfcLinearStiffnessMeasure` -> mola translacional finita;
- `IfcRotationalStiffnessMeasure` -> mola rotacional finita.

A importação gera `supports` e `nodeSprings` separadamente. Restrições e molas não são inferidas da geometria.

## Perfis e propriedades geométricas

Perfis suportados no staging:

- `IfcRectangleProfileDef`;
- `IfcCircleProfileDef`;
- `IfcIShapeProfileDef`.

O importador reconstrói `A`, `Iy`, `Iz` e `J` a partir das **dimensões explícitas do perfil**. Ele não reconstrói uma geometria de seção a partir somente de `A/I/J`, mantendo a regra conservadora adotada na v0.45.

## Propriedades mecânicas IFC

O writer materializa propriedades estruturais em `IfcMaterialProperties` com o nome:

`Pset_MaterialMechanical`

As propriedades atualmente emitidas e recuperadas são:

- `YoungModulus` — `IfcModulusOfElasticityMeasure`;
- `ShearModulus` — `IfcModulusOfElasticityMeasure`, quando `G` é explicitamente armazenado no projeto;
- `PoissonRatio` — `IfcPositiveRatioMeasure`;
- `ThermalExpansionCoefficient` — `IfcThermalExpansionCoefficientMeasure`.

Cada valor é representado por `IfcPropertySingleValue` e o conjunto referencia diretamente o `IfcMaterial`.

### Conversão de unidades

O AstraStruct trabalha internamente com `kN-m-MPa`, mas o módulo elástico dos materiais está armazenado em `kN/m²`. O IFC usa a unidade de pressão global `MPa` neste contrato. Portanto:

`E_IFC[MPa] = E_AstraStruct[kN/m²] / 1000`

Na importação:

`E_AstraStruct[kN/m²] = E_IFC[MPa] × 1000`

A mesma conversão é aplicada a `G`. `ν` permanece adimensional e o coeficiente de expansão térmica permanece por unidade de temperatura.

## Contrato estrito de unidades

A v0.46 inicial aceita somente o sistema já usado pelo projeto:

- comprimento: `METRE`;
- força: `KILO NEWTON`;
- pressão: `MEGA PASCAL`;
- ângulo plano: `RADIAN`.

Um IFC que declare, por exemplo, `KILO PASCAL` como `PRESSUREUNIT` é rejeitado. Não há conversão implícita nesta etapa, porque uma conversão parcial poderia corromper módulos, molas, coordenadas ou outras grandezas derivadas.

## Densidade

O campo legado `density` do AstraStruct contém atualmente valores como 25 para concreto e 78,5 para aço, que representam **peso específico aproximado em kN/m³**, e não massa específica em kg/m³. Por isso a v0.46 não o exporta como `MassDensity` até existir um contrato interno inequívoco de unidade.

## Fluxo na interface

O painel IFC possui agora `Pré-importar arquivo IFC`.

A pré-importação apresenta:

- projeto identificado no arquivo;
- número de nós, elementos, materiais e seções;
- estado `Geometria READY/PENDING`;
- estado `Análise READY/PENDING`;
- primeiras pendências estruturais detectadas.

Quando a geometria está pronta, o usuário pode confirmar:

- `Importar projeto IFC`, se a análise também estiver pronta; ou
- `Importar geometria (análise pendente)`, se faltarem propriedades mecânicas.

Antes da substituição, o projeto aberto é preservado em:

`astrastruct.ifc.import.backup.v046`

O arquivo selecionado não modifica o projeto antes dessa confirmação.

## Identidade

Os `IfcGloballyUniqueId` dos nós e membros importados são preservados no projeto de staging. O fluxo continua compatível com o mapa de identidade persistente da v0.45 para exportações subsequentes.

## Cobertura de testes

`tests/ifc-import-staging-v046-smoke.mjs` verifica, entre outros pontos:

- round-trip de barra + casca;
- `frame3d <-> RIGID_JOINED_MEMBER`;
- `truss3d <-> PIN_JOINED_MEMBER`;
- GlobalIds;
- perfis explícitos;
- apoios e molas;
- espessura de casca;
- `Pset_MaterialMechanical`;
- conversão `kN/m² <-> MPa` de `E`;
- recuperação de `ν`;
- modo geometry-only sem propriedades mecânicas;
- bloqueio do solver para imports com análise pendente;
- rejeição de unidades de pressão incompatíveis;
- rejeição de `PredefinedType` não suportado.

A regressão Playwright cobre também o fluxo de interface exportar -> pré-importar -> confirmar -> criar backup -> recarregar o projeto, além do caminho de geometria com propriedades mecânicas removidas.

A validação independente IfcOpenShell permanece obrigatória para o fixture IFC4X3 gerado pelo writer.

## Limitações remanescentes

1. parser deliberadamente restrito ao subconjunto estrutural coberto; não é um parser IFC universal;
2. superfícies importáveis diretamente pelo solver ainda limitadas a quatro nós;
3. perfis lineares restritos a retangular, circular e I/H;
4. ausência de `IfcMaterialLayerSetUsage` para superfícies multicamadas;
5. cargas, combinações e casos de carga IFC ainda não são reconstruídos no projeto importado;
6. `Pset_MaterialSteel` (`YieldStress`, `UltimateStress`) e propriedades específicas de concreto ainda não fazem parte deste incremento;
7. densidade/peso específico aguardam contrato de unidade interno explícito;
8. conversão arbitrária entre sistemas de unidades ainda não é permitida;
9. interoperabilidade de aplicação com authoring/analysis tools independentes continua necessária além da validação de schema/EXPRESS.

## Regra de publicação

A v0.46 permanece experimental no `develop`. O `PRODUCT_VERSION` e o `package.json` continuam em `0.45.0` durante esta etapa. O fechamento da v0.46 exigirá gate próprio, documentação consolidada, validação IfcOpenShell e regressão completa desktop/Android/tablet. `main` permanece intocada até solicitação explícita de promoção.
