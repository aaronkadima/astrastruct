# AstraStruct v0.43 — RC / Steel / Foundation Code Design

A v0.43 introduz a camada de dimensionamento por código sobre resultados mecânicos e combinações já produzidos pelas versões anteriores. A arquitetura mantém separação explícita entre **mecânica**, **ações/combinações**, **dados normativos** e **verificações de dimensionamento**.

## Contratos

- `code-design-profile/v1`: perfil de dimensionamento com identificação do código, edição, provenance, parâmetros e referências de cláusulas.
- `code-design-check/v1`: uma verificação individual, com demanda, resistência, utilização, estado (`true`, `false` ou `null`) e rastreabilidade.
- `code-design/v1`: conjunto de verificações para uma combinação.
- `code-design-envelope/v1`: envoltória governante entre combinações.
- implementação experimental: `CODE_DESIGN_VERSION = 0.43.0-exp`.

A v0.43 não altera `PROJECT_SCHEMA_VERSION = 2` nem `structural-result/v1` (`RESULT_CONTRACT_VERSION = 1.0`).

## Provenance e parâmetros normativos

Todo `profile` exige `provenance` e `parameters` explícitos. O AstraStruct não deve inferir silenciosamente coeficientes de documentos licenciados. Para perfis em que os parâmetros normativos precisam ser fornecidos pelo usuário/plugin, a provenance pode declarar:

- `requiresLicensedParameters: true`
- `automaticResistance: false`

Quando uma resistência depende de informação normativa ausente, a verificação deve permanecer **PENDENTE** (`ok = null`, `utilization = null`) em vez de assumir zero, inventar coeficientes ou declarar aprovação.

Esta regra é particularmente importante para adapters ABNT/NBR: fórmulas, coeficientes, limites e cláusulas que não estejam publicamente verificáveis devem ser fornecidos pelo profile normativo autorizado.

## RC — concreto armado

### Flexão retangular simplesmente armada

A função `rcRectangularFlexureDesign` resolve o eixo neutro por equilíbrio:

`C = alpha1 * fc * b * beta1 * c = As * fs`

com compatibilidade de deformações até `epsCu`. A resistência nominal é:

`Mn = T * (d - a/2)`

seguida pelo fator de resistência informado no profile. `alpha1`, `beta1`, `epsCu` e `phi` não são inferidos automaticamente.

Escopo atual: flexão simples, seção retangular e armadura tracionada concentrada em `d`. Seções gerais e resposta N–My–Mz continuam disponíveis no Section Engine, mas a tradução normativa completa dessas seções depende de plugins específicos.

### Cisalhamento

A formulação parametrizada é:

`Rn = Cc * lambda * sqrt(fc) * bw * d + Cs * Av * fy * d / s`

com `Cc`, `Cs` e `phi` fornecidos pelo profile. Limites máximos, mínimos de armadura, size effect e demais condições normativas não são inventados nesta camada.

## Steel — aço estrutural

`steelGrossYieldStrengths` fornece resistências básicas parametrizadas de escoamento para:

- tração na seção bruta;
- flexão plástica em y e z;
- cisalhamento da área resistente informada.

`steelMemberDesign` verifica:

- axial de tração ou compressão;
- flexão y;
- flexão z;
- cisalhamento;
- interação axial–flexão biaxial parametrizada.

Para compressão, flambagem global/local, LTB, ruptura líquida, block shear e outros estados limites devem já estar incorporados nas resistências fornecidas pelo plugin/perfil normativo aplicável. A camada v0.43 não transforma escoamento bruto em resistência normativa completa sem os dados necessários.

## Foundation — fundações superficiais

### Pressão de contato

Para uma base retangular rígida em contato integral:

`q(x,y) = N/A + Mx*y/Ix + My*x/Iy`

onde:

- `A = B*L`
- `Ix = B*L^3/12`
- `Iy = L*B^3/12`

São calculados `qmin`, `qmax`, excentricidades e o kern central. Se `qmin < 0`, a hipótese de contato integral é inválida; nesse caso a verificação de bearing fica **PENDENTE** e exige análise de contato parcial/não linear. O AstraStruct não redistribui artificialmente a tração do solo como compressão.

Quando existe contato integral, `qmax` é comparado com `soil.qDesign`, que deve ser informado a partir do modelo geotécnico/perfil aplicável.

### Deslizamento

`R = phi_r * (mu*N + c*A)`

`mu`, `c` e `phi_r` são parâmetros explícitos. Empuxo passivo não é adicionado automaticamente.

### Tombamento

A condição é expressa como:

`M_stabilizing >= FS_required * M_overturning`

com `FS_required` fornecido pelo profile.

### Punção e cisalhamento unidirecional

As resistências de concreto usam formulações parametrizadas do tipo:

`Vn = C * lambda * sqrt(fc) * b * d`

O coeficiente `C`, o fator `phi` e a definição da seção/perímetro crítico devem vir do profile normativo aplicável.

### Flexão de faixa

A verificação simplificada usa:

`Mn = As * fy * z`, com `z = kappa_z * d`

onde `kappa_z` e `phi` são explícitos. Quando uma norma exigir compatibilidade de deformações ou regras adicionais, o plugin normativo deve fornecê-las.

## Integração com v0.42

A v0.42 gera ações classificadas, combinações determinísticas e envoltórias. A v0.43 recebe as demandas dessas combinações e produz `code-design/v1` por combinação. `governingAcrossCombinations()` então identifica a verificação governante sem alterar a combinação original ou perder sua identificação.

Isso preserva a cadeia:

`Analysis Results -> Design Actions -> Load Combinations -> Code Design Checks -> Governing Envelope`

## Validação determinística

`tests/code-design-v043-smoke.mjs` verifica, com parâmetros explicitamente fornecidos:

- flexão e cisalhamento RC;
- resistências brutas e interação de membro de aço;
- distribuição de pressão `q(x,y)` em fundação;
- perda de contato retornando PENDENTE;
- deslizamento e tombamento;
- punção, cisalhamento unidirecional e flexão de faixa;
- ausência de falso OK quando dados licenciados estão ausentes;
- envoltória governante entre combinações.

O gate principal continua determinístico e explicitamente enumerado; descoberta automática `run-smoke.mjs` permanece proibida.

## Limites da v0.43

A v0.43 não pretende substituir o texto oficial das normas. Não contém catálogo integral de cláusulas ABNT/AISC/ACI/EN, não inventa parâmetros protegidos e não executa detalhamento executivo. O resultado é uma camada de dimensionamento auditável, extensível por profiles/plugins com provenance explícita.

A próxima etapa permitida pelo roadmap, somente após CI final verde da v0.43, é **v0.44 — Detailing + professional calculation reports**.
