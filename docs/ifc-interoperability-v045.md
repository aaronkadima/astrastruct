# AstraStruct v0.45 — interoperabilidade BIM/IFC

## Base normativa

A v0.45 adota como referência estável **IFC 4.3 ADD2 / IFC 4.3.2.0 (`IFC4X3_ADD2`)**, publicado como **ISO 16739-1:2024**. Schemas draft posteriores não são usados como contrato de produção.

A implementação é dividida em duas camadas para impedir que detalhes de serialização contaminem o solver:

`AstraStruct project -> IFC canonical interoperability model -> IFC serializer/parser -> external validation`

O primeiro incremento desta versão implementa o **modelo canônico**. A serialização STEP `.ifc` somente será ativada após a implementação e validação dos requisitos de identidade, contexto geométrico, unidades, relações e subconjunto de entidades suportado.

## Contrato

O módulo `web/src/interop/` expõe:

- `ifc-interoperability/v1`;
- `IFC_INTEROP_VERSION = 0.45.0-exp`;
- `IFC_SCHEMA = IFC4X3_ADD2`;
- `IFC_STANDARD = ISO 16739-1:2024`.

O contrato não altera `PROJECT_SCHEMA_VERSION` e não modifica o solver. Ele é uma projeção rastreável do modelo estrutural existente para conceitos IFC.

## Mapeamento estrutural inicial

A camada canônica adota o domínio de análise estrutural do IFC:

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

O classificador de elemento é deliberadamente conservador: tipos reconhecidos como shell/surface/plate/slab/membrane/wall são mapeados como membros de superfície; os demais elementos lineares seguem para membro de curva.

## Identidade e provenance

Cada registro preserva:

- `sourceId` original do AstraStruct;
- chave interna estável por domínio (`node:`, `member:`, `material:`, `section:` etc.);
- propriedades de origem necessárias ao round-trip do núcleo estrutural;
- versão do contrato de interoperabilidade;
- schema IFC alvo;
- provenance da geração.

As chaves internas **não são apresentadas como `IfcGloballyUniqueId`**. O codec de GlobalId IFC será responsabilidade do writer STEP e deverá possuir benchmark próprio antes de qualquer emissão `.ifc`.

## Conectividade

Para cada membro são obtidas referências aos nós do modelo. O exportador rejeita:

- IDs duplicados;
- elementos com menos de dois nós;
- referências a nós inexistentes;
- referências a materiais inexistentes;
- referências a seções inexistentes;
- relações estruturais com endpoints inválidos.

As relações canônicas são representadas como `IfcRelConnectsStructuralMember`, preservando a posição do nó no elemento de origem.

## Apoios

Quando o projeto contém um apoio associado ao nó, o registro `IfcStructuralPointConnection` recebe uma condição canônica `IfcBoundaryNodeCondition` com os dados de origem preservados. A tradução exata de graus de liberdade translacionais/rotacionais para os tipos IFC será materializada pelo writer.

## Round-trip canônico

`renderIfcInteroperabilityJson()` gera JSON determinístico e auditável do contrato canônico.

`parseIfcInteroperabilityJson()` valida novamente o contrato na leitura.

`restoreStructuralCoreFromIfcModel()` reconstrói o núcleo composto por:

- projeto/identificação;
- unidades e schema do AstraStruct;
- nós e coordenadas;
- elementos e topologia;
- materiais;
- seções.

Esse round-trip é um mecanismo de teste do mapeamento, não um importador genérico de arquivos IFC externos.

## Validação da etapa

`tests/ifc-interop-v045-smoke.mjs` cobre um benchmark com uma barra `frame3d` e uma casca `shell4`, verificando:

- identificação de IFC 4.3 ADD2 / ISO 16739-1:2024;
- classes `IfcProject` e `IfcStructuralAnalysisModel`;
- quatro `IfcStructuralPointConnection`;
- um `IfcStructuralCurveMember`;
- um `IfcStructuralSurfaceMember`;
- seis relações `IfcRelConnectsStructuralMember`;
- material e seção associados;
- `IfcBoundaryNodeCondition` no nó apoiado;
- serialização/parsing JSON;
- round-trip de IDs, topologia, material e seção;
- rejeição de nó ou material inexistente.

## Estado do writer STEP

Neste incremento:

`stepWriterReady = false`

Isso é um gate de segurança. Um arquivo com extensão `.ifc` não será emitido enquanto não existirem, no mínimo:

1. codec testado para `IfcGloballyUniqueId`;
2. `IfcProject` com owner/application metadata apropriados;
3. `IfcUnitAssignment` coerente com as unidades do projeto;
4. `IfcGeometricRepresentationContext` e placements;
5. topologia/representação para pontos, curvas e superfícies;
6. material/profile associations;
7. `IfcStructuralAnalysisModel` e assignments;
8. condições de contorno e conectividade;
9. parser/round-trip do subconjunto suportado;
10. validação externa contra schema/serviço buildingSMART antes de declarar conformidade.

## Regra de publicação

Toda implementação v0.45 permanece exclusivamente em `develop`. A branch `main` continua sendo a publicação estável e não deve receber esta versão enquanto o gate da v0.45 e a validação da página de desenvolvimento não estiverem verdes e aprovados.