# AstraStruct v0.47 — propriedades resistentes de materiais no IFC

## Status

A v0.47 está **formalmente fechada no branch `develop`** como AstraStruct **0.47.0**. `PRODUCT_VERSION = 0.47.0`, `PROJECT_SCHEMA_VERSION = 2` e `RESULT_CONTRACT_VERSION = 1.0`. **Nenhuma promoção para `main`** faz parte deste fechamento.

## Objetivo

Preservar propriedades resistentes já existentes no modelo nativo durante o intercâmbio IFC4X3, usando apenas property sets oficiais de material e sem inferir o tipo do material a partir dos valores numéricos.

## Contrato

- `ifc-material-strength/v1` — `0.47.0-exp`;
- `ifc-step-material/v1` — `0.47.0-exp`;
- `ifc-import-staging/v1` — `0.47.0-exp`;
- schema: `IFC4X3_ADD2`;
- referência: ISO 16739-1:2024 / buildingSMART IFC 4.3.2.

## Aço e armadura

Materiais explicitamente tipados como `steel` ou `rebar` podem gerar `Pset_MaterialSteel` no `IfcMaterial`.

| AstraStruct | IFC4X3 | Tipo STEP | Unidade |
|---|---|---|---|
| `fy` | `YieldStress` | `IFCPRESSUREMEASURE` | MPa |
| `fu` | `UltimateStress` | `IFCPRESSUREMEASURE` | MPa |

Regras:

- apenas valores positivos são serializados;
- `fu < fy` é rejeitado;
- materiais `imported`, sem tipo explícito, não são promovidos automaticamente a aço somente porque possuem `fy`/`fu`;
- valores importados retornam diretamente a `fy` e `fu` em MPa.

## Concreto e graute

Materiais explicitamente tipados como `concrete` ou `grout` podem gerar `Pset_MaterialConcrete`.

| AstraStruct | IFC4X3 | Tipo STEP | Unidade |
|---|---|---|---|
| `fck` | `CompressiveStrength` | `IFCPRESSUREMEASURE` | MPa |

O valor é armazenado diretamente em MPa, portanto não há a conversão aplicada a `E` e `G` no `Pset_MaterialMechanical`.

## `fctm`

O campo nativo `fctm` permanece no projeto AstraStruct, porém **não é exportado nesta etapa**. `Pset_MaterialConcrete` não possui uma propriedade material direta equivalente para a resistência média à tração `fctm`; o writer não a força em `TensileStrength` de outro property set nem cria propriedade proprietária silenciosa.

## Importação

O parser de strength exchange lê:

- `Pset_MaterialSteel.YieldStress`;
- `Pset_MaterialSteel.UltimateStress`;
- `Pset_MaterialConcrete.CompressiveStrength`.

Cada propriedade deve ser `IfcPropertySingleValue` contendo `IFCPRESSUREMEASURE`. Tipos STEP incompatíveis são rejeitados.

O staging conserva também os identificadores das entidades `IfcMaterialProperties` de origem para auditoria:

- `steelPropertySetEntityId`;
- `concretePropertySetEntityId`.

## Relação com readiness

`fy`, `fu` e `fck` são propriedades de resistência/dimensionamento. Elas não substituem `E`, `G`, `ν`, seção ou espessura e, por isso, não tornam um modelo mecanicamente analisável por si só.

O estado `analysisReady` continua sendo determinado pelo contrato mecânico da v0.46. A ausência de resistências não impede análise elástica; ela pode, porém, impedir verificações de dimensionamento que exijam essas propriedades.

## Regras conservadoras

1. não inferir aço/concreto pelo nome ou pelo valor de resistência;
2. não converter `fctm` para outra propriedade IFC por aproximação semântica;
3. não aceitar `fu < fy`;
4. não aceitar valores de resistência não positivos;
5. não aceitar `YieldStress`, `UltimateStress` ou `CompressiveStrength` com tipo STEP diferente de `IFCPRESSUREMEASURE`;
6. manter unidades de resistência em MPa dentro do contrato `kN-m-MPa`.

## Cobertura de validação

`tests/ifc-material-strength-v047-smoke.mjs` verifica:

- emissão de `Pset_MaterialSteel`;
- emissão de `Pset_MaterialConcrete`;
- round-trip de `fy`, `fu` e `fck`;
- ausência de mapeamento impróprio de `fctm`;
- ausência de promoção de material sem tipo explícito;
- rejeição de `fu < fy`;
- rejeição de tipo STEP incorreto.

O fixture IFC4X3 de CI contém aço S355 (`fy=355 MPa`, `fu=510 MPa`) e concreto C30 (`fck=30 MPa`). O validador **IfcOpenShell 0.8.5** exige, além da sintaxe STEP e das regras EXPRESS, exatamente dois `Pset_MaterialMechanical`, um `Pset_MaterialSteel` e um `Pset_MaterialConcrete` com as propriedades previstas.

A regressão de aplicação permanece validada em **desktop, Android e tablet**. O gate formal é `tests/release-gate-v047-smoke.mjs`.

## Limitações remanescentes

- `fctm` continua sem mapeamento IFC material direto;
- densidade/peso específico ainda aguarda contrato interno inequívoco de unidade;
- propriedades plásticas/constitutivas avançadas de aço e concreto ainda não são serializadas;
- cargas, casos de carga e combinações IFC ainda não são reconstruídos;
- interoperabilidade com aplicações independentes continua necessária além da validação de schema/EXPRESS.

## Regra de publicação

O fechamento 0.47.0 ocorre somente em `develop`. `main` permanece estável e intocada até solicitação explícita de publicação/promoção.
