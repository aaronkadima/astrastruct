# AstraStruct v0.53.2 experimental — durabilidade e vento auditáveis

## Objetivo

Esta etapa implementa duas capacidades recorrentes nas plataformas estruturais de mercado antes do desenvolvimento dos diferenciais exclusivos do AstraStruct: (1) critérios de durabilidade/materiais/cobrimentos associados a uma norma e edição, e (2) geração de ações de vento por pavimento e direção com trilha de auditoria.

A implementação evita embutir ou reproduzir tabelas normativas protegidas. O usuário deve parametrizar as regras e coeficientes a partir da norma licenciada, decisões do responsável técnico ou conectores autorizados. Ausência de dados produz `PENDING`; nunca é convertida em aprovação automática.

## Benchmark que orientou o fluxo

A documentação oficial do TQS mostra a lógica típica brasileira de configuração do vento no nível do edifício: velocidade básica `V0`, fatores `S1`, `S2` e `S3` e coeficiente de arrasto por direção, gerando forças no modelo espacial. A documentação atual do TQS também lista suporte a ABNT NBR 6123:2023 e a normas internacionais, além de fator de vizinhança e resposta dinâmica. Isso reforça que o gerador precisa ser normativamente identificável e auditável, mas não deve esconder os parâmetros adotados.

Para os Estados Unidos, a ASCE identifica ASCE/SEI 7-22 como a edição corrente de referência para ações mínimas e disponibiliza guia específico de vento. Na linha europeia, EN 1991-1-4 trata as ações do vento e utiliza parâmetros nacionalmente determinados por meio dos Anexos Nacionais. Por isso os perfis ASCE/Eurocode do AstraStruct usam, nesta etapa, pressão por pavimento informada pelo responsável em vez de incorporar tabelas ou mapas.

Quanto ao concreto, ACI CODE-318-25 é a edição publicada em 2025 e cobre resistência, serviço, durabilidade, análise e detalhamento. A segunda geração do Eurocode 2 reforça abordagem baseada em desempenho para durabilidade, com Exposure Resistance Classes e parâmetros nacionais. No Brasil, plataformas como TQS trabalham com fck e cobrimentos diferenciados por elemento e agressividade. O AstraStruct modela essa lógica por regras versionadas, sem copiar tabelas da norma.

## Contratos

### `durability-profile/v1`

Contém:

- jurisdição;
- norma e edição;
- regras explicitamente cadastradas pelo responsável;
- classe de exposição/agressividade;
- família estrutural;
- `fck` mínimo;
- cobrimento nominal;
- referência/cláusula opcional;
- proveniência indicando que tabelas normativas não estão embutidas.

Esqueletos disponíveis:

- `BR-NBR6118-2023`;
- `US-ACI318-25`;
- `EU-EN1992-1-1` + Anexo Nacional.

### `durability-audit/v1`

Compara a base do projeto com as regras cadastradas e retorna `PASS`, `FAIL` ou `PENDING` por família: vigas, lajes, pilares, paredes e fundações. A auditoria não altera automaticamente `fck` nem cobrimento.

### `wind-method-profile/v1`

Esqueletos disponíveis:

- `BR-NBR6123-2023`: método com `V0`, `S1`, `S2`, `S3`, fator de vizinhança opcional e coeficiente de força/arrasto informado;
- `US-ASCE7-22`: pressão por pavimento + coeficiente informado;
- `EU-EN1991-1-4`: pressão por pavimento + coeficiente informado, com necessidade de Anexo Nacional.

No perfil brasileiro, a pressão dinâmica é calculada a partir da relação física `q = 0,5 ρ V²`, usando a densidade do ar registrada no projeto. Os fatores e coeficientes normativos são sempre entradas explícitas.

### `wind-audit/v1`

Para cada pavimento e direção X+/X-/Y+/Y- registra:

- pressão em kPa;
- coeficiente de força/arrasto;
- área projetada;
- origem da área (`explicit` ou `axis-aligned-bounds`);
- força do pavimento;
- nós que receberão a distribuição;
- pendências.

A área automática por envelope retangular somente é usada após aceite explícito do usuário. Edificações irregulares, recuadas, vazadas ou com efeitos de vizinhança/dinâmicos exigem revisão específica.

### `generated-wind-loads/v1`

Quando todas as linhas estão prontas, o gerador cria casos de vento separados por direção e cargas nodais equivalentes distribuídas aos nós dos pavimentos. Cada carga contém metadados de auditoria. Reprocessar remove apenas cargas produzidas pelo próprio gerador e não toca nos carregamentos manuais.

## Interface

O menu **Modelo** passa a oferecer **Durabilidade + vento auditável…** com três abas:

1. **Durabilidade** — seleção do esqueleto normativo, criação/edição das regras e auditoria PASS/FAIL/PENDING;
2. **Vento** — parâmetros, coeficientes, áreas/pressões por pavimento e geração dos casos;
3. **Auditoria** — resumo do perfil, forças totais por direção e governança.

## Limitações intencionais

- não há mapas normativos de velocidade embutidos;
- não há tabelas de cobrimento/fck copiadas de normas;
- não há escolha automática de S1/S2/S3, categorias, classes ou coeficientes;
- a área automática é apenas um envelope geométrico inicial e exige aceite;
- resposta dinâmica do vento e efeitos aeroelásticos continuam separados;
- o módulo não substitui a leitura da norma nem a responsabilidade técnica.

## Próxima etapa de paridade

O próximo bloco é a interação solo–estrutura espacial: modelo de molas/impedâncias por fundação, vínculo aos nós da superestrutura, resultados de recalques/pressões/reações e visualização 3D no explorador de fundações, novamente sem inventar parâmetros geotécnicos.

## Referências públicas consultadas

- TQS — Ações / vento no edifício: https://docs.tqs.com.br/Docs/Details?id=2144750538&language=pt-br
- TQS — normas de vento suportadas: https://docs.tqs.com.br/Docs/Details?id=1875344659&language=pt-BR
- TQS — fator de vizinhança: https://docs.tqs.com.br/Docs/Details?id=1600746665&language=pt-BR
- TQS — resposta dinâmica NBR 6123:2023: https://docs.tqs.com.br/Docs/Details?id=2043718140&language=pt-BR
- ASCE — ASCE/SEI 7-22: https://www.asce.org/publications-and-news/asce-7
- Eurocodes JRC — EN 1991-1-4: https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-1-actions-structures
- ACI — ACI CODE-318-25: https://www.concrete.org/publications/typesofpublications/standards%28codesandspecs%29/suiteofcodes.aspx
- Eurocodes JRC — Eurocode 2: https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-2-design-concrete-structures
