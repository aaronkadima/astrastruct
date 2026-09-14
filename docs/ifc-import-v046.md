# AstraStruct v0.46 — importação IFC estrutural controlada

## Status

A v0.46 foi fechada formalmente no branch `develop` como **AstraStruct 0.46.0** após validação do núcleo, schema IFC4X3/EXPRESS e regressão de aplicação. `main` continua sendo o canal estável publicado e não é alterado por este fechamento.

`PRODUCT_VERSION = 0.46.0`

`PROJECT_SCHEMA_VERSION = 2`

`RESULT_CONTRACT_VERSION = 1.0`

Nenhuma promoção para `main` ocorre automaticamente.

## Objetivo

A v0.46 transforma a leitura IFC da v0.45 em uma **importação estrutural auditável**, sem inferências silenciosas. O fluxo é:

`arquivo IFC4X3 -> parser estrito -> staging de importação -> validação geométrica -> validação mecânica -> confirmação explícita -> backup local -> substituição do projeto`

Selecionar um arquivo não altera o projeto aberto. A substituição somente ocorre após a pré-importação e uma ação explícita do usuário.

## Contratos v0.46

- `ifc-import-staging/v1` — implementação `0.46.0-exp`;
- `ifc-mechanical-exchange/v1` — implementação `0.46.0-exp`;
- schema de troca: `IFC4X3_ADD2`;
- referência normativa: ISO 16739-1:2024.

Os contratos canônicos, writer, parser e estado persistente da v0.45 permanecem em `v1` e retrocompatíveis. A v0.46 estende conteúdo e fluxo sem migração desnecessária desses contratos.

## Readiness em duas camadas

O staging separa dois estados.

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

`IfcStructuralSurfaceMember` é mapeado inicialmente para `shell4` quando o `PredefinedType` é `SHELL`, `BENDING_ELEMENT` ou `MEMBRANE_ELEMENT`.

A v0.46 exige quatro nós por superfície para compatibilidade direta com o solver `shell4`. Polígonos com outras cardinalidades não são triangulados nem projetados silenciosamente.

## Apoios e molas

`IfcBoundaryNodeCondition` é recuperado conforme a semântica IFC4+:

- `IfcBoolean(TRUE)` -> grau de liberdade fixo;
- `IfcBoolean(FALSE)` -> grau de liberdade liberado;
- `IfcLinearStiffnessMeasure` -> mola translacional finita;
- `IfcRotationalStiffnessMeasure` -> mola rotacional finita.

A importação gera `supports` e `nodeSprings` separadamente. Restrições e molas não são inferidas da geometria.

## Perfis e propriedades geométricas

Perfis suportados:

- `IfcRectangleProfileDef`;
- `IfcCircleProfileDef`;
- `IfcIShapeProfileDef`.

O importador reconstrói `A`, `Iy`, `Iz` e `J` a partir das **dimensões explícitas do perfil**. Ele não reconstrói uma geometria de seção a partir somente de `A/I/J`, mantendo a regra conservadora adotada na v0.45.

## Propriedades mecânicas IFC

O writer materializa propriedades estruturais em `IfcMaterialProperties` com o nome `Pset_MaterialMechanical`.

As propriedades emitidas e recuperadas são:

- `YoungModulus` — `IfcModulusOfElasticityMeasure`;
- `ShearModulus` — `IfcModulusOfElasticityMeasure`, quando `G` é explicitamente armazenado no projeto;
- `PoissonRatio` — `IfcPositiveRatioMeasure`;
- `ThermalExpansionCoefficient` — `IfcThermalExpansionCoefficientMeasure`.

Cada valor é representado por `IfcPropertySingleValue` e o conjunto referencia diretamente o `IfcMaterial`.

### Conversão de unidades

O AstraStruct trabalha internamente com `kN-m-MPa`, mas o módulo elástico está armazenado em `kN/m²`. O IFC usa a unidade global de pressão `MPa` neste contrato:

`E_IFC[MPa] = E_AstraStruct[kN/m²] / 1000`

Na importação:

`E_AstraStruct[kN/m²] = E_IFC[MPa] × 1000`

A mesma conversão é aplicada a `G`. `ν` permanece adimensional e o coeficiente de expansão térmica permanece por unidade de temperatura.

## Contrato estrito de unidades

A v0.46 aceita somente:

- comprimento: `METRE`;
- força: `KILO NEWTON`;
- pressão: `MEGA PASCAL`;
- ângulo plano: `RADIAN`.

Um IFC que declare, por exemplo, `KILO PASCAL` como `PRESSUREUNIT` é rejeitado. Não há conversão parcial implícita, evitando corrupção de módulos, molas, coordenadas ou grandezas derivadas.

## Densidade

O campo legado `density` do AstraStruct contém atualmente valores como 25 para concreto e 78,5 para aço, que representam **peso específico aproximado em kN/m³**, e não massa específica em kg/m³. Por isso a v0.46 não o exporta como `MassDensity` até existir um contrato interno inequívoco de unidade.

## Fluxo na interface

O painel IFC possui `Pré-importar arquivo IFC` e apresenta:

- projeto identificado no arquivo;
- número de nós, elementos, materiais e seções;
- estado `Geometria READY/PENDING`;
- estado `Análise READY/PENDING`;
- pendências estruturais detectadas.

Quando a geometria está pronta, o usuário pode confirmar `Importar projeto IFC` ou `Importar geometria (análise pendente)`.

Antes da substituição, o projeto aberto é preservado em:

`astrastruct.ifc.import.backup.v046`

O arquivo selecionado não modifica o projeto antes dessa confirmação.

## Identidade

Os `IfcGloballyUniqueId` dos nós e membros importados são preservados no projeto de staging. O fluxo continua compatível com o mapa de identidade persistente da v0.45 para exportações subsequentes.

## Cobertura de testes e validação

`tests/ifc-import-staging-v046-smoke.mjs` verifica:

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
- rejeição de unidades incompatíveis;
- rejeição de `PredefinedType` não suportado.

A validação independente por **IfcOpenShell 0.8.5** verifica sintaxe STEP, schema IFC4X3 e regras EXPRESS do fixture produzido pelo writer, incluindo as propriedades mecânicas.

A regressão Playwright verifica o fluxo de interface exportar -> pré-importar -> confirmar -> criar backup -> recarregar o projeto, além do modo geometry-only, em **desktop, Android e tablet**.

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

A v0.46.0 está fechada em `develop`. O fechamento usa `tests/release-gate-v046-smoke.mjs`, validação IfcOpenShell e regressão completa em desktop, Android e tablet. O canal `main` permanece separado e intocado. Nenhuma promoção para `main` deve ocorrer sem solicitação explícita de publicação.
