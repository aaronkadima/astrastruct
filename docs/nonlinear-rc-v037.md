# AstraStruct v0.37 — Nonlinear RC

## Escopo

A v0.37 introduz a camada constitutiva e seccional não linear para concreto armado sobre os contratos já consolidados nas versões v0.32–v0.36. O contrato de topo é `nonlinear-rc/v1`.

O incremento contém:

- concreto uniaxial com fissuração, fechamento unilateral, esmagamento e softening regularizado por crack-band;
- aço de armadura cíclico com endurecimento cinemático/isotrópico combinado, reaproveitando o return mapping validado da v0.21;
- bond-slip local stateful com envelope, unloading/reloading e reversões;
- seção RC de fibras `N–My–Mz` com históricos committed/trial por fibra;
- componente `bond-slip-link` compatível com a Component/Element API e `commit/rollback`.

A v0.37 deliberadamente permanece no nível **uniaxial + seção + interface local de aderência**. Shear retention, aggregate interlock orientado por fissuras e leis constitutivas 2D/3D para shells dependem de cinemática continuum e pertencem à **v0.38 — Advanced shells/contact**; não são simulados artificialmente como parâmetros escalares nesta etapa.

## 1. Convenções e unidades

O núcleo estrutural usa:

- força: kN;
- comprimento: m;
- tensão/módulo: kN/m²;
- resistência do material cadastrada em MPa é convertida por `1 MPa = 1000 kN/m²`;
- energia de fratura `Gf` e `Gc`: kN/m;
- comprimento característico `lch`: m.

Consequentemente,

`G = lch ∫ sigma d epsilon`

possui unidade kN/m e pode ser preservado quando a discretização muda.

## 2. Concreto — `rc-concrete-1d/v1`

### 2.1 Tração e crack-band

A resistência à tração é `ft` e

`epsilon_cr = ft / E`.

Até `epsilon_cr`, a resposta é elástica. Depois da fissuração é adotado softening linear até tensão nula. A deformação terminal não é um parâmetro arbitrário: é derivada da energia de fratura e do comprimento característico:

`epsilon_tu = epsilon_cr + 2 Gf / (ft lch)`.

Assim,

`0.5 ft (epsilon_tu - epsilon_cr) lch = Gf`.

Logo, ao reduzir `lch`, aumenta-se a faixa de deformação de softening de modo que a energia dissipada por área de fissura permaneça constante.

A história armazena `maxTensionStrain`, `tensionDamage`, estado fissurado e energia de fratura consumida. Para descarregamento/recarga abaixo do máximo histórico é usada a rigidez secante associada ao dano já atingido. O estado committed nunca é mutado durante uma avaliação trial.

### 2.2 Fechamento unilateral

O dano de tração não degrada automaticamente a resposta em compressão. Quando uma fibra previamente fissurada entra em `epsilon < 0`, `crackClosed=true` e a resposta compressiva é calculada pelo ramo de compressão independente. Isso representa recuperação unilateral da capacidade normal ao fechamento da fissura no modelo 1D.

Essa recuperação não deve ser confundida com aggregate interlock ou shear retention: esses mecanismos exigem componentes de cisalhamento e orientação de fissura, ausentes numa lei uniaxial.

### 2.3 Compressão e esmagamento

A pré-pico utiliza uma parábola com máximo `fc` em `epsilon_c0`:

`sigma_c = -fc [2 eta - eta^2]`,

com `eta = |epsilon|/epsilon_c0`.

Após o pico é usado softening linear. Quando `Gc` é informado, a deformação terminal é regularizada:

`epsilon_cu = epsilon_c0 + 2 Gc / (fc lch)`.

A tangente pós-pico é negativa em termos de `d sigma/d epsilon`, coerente com `kappa_c=-epsilon`. Ao atingir `epsilon_cu`, a fibra é marcada como `crushed` e a tensão de envelope cai a zero.

Quando `Gc` não é fornecido, pode ser usado um `epsilon_cu` explícito; nesse caso a compressão pós-pico é strain-based e não é declarada mesh-objective.

### 2.4 Natureza do modelo

O concreto da v0.37 é um **modelo escalar uniaxial de dano/crack-band**, transparente e rastreável. Não é um modelo plástico-dano multiaxial do tipo CDP/Lee–Fenves. Isso evita atribuir ao modelo capacidades multiaxiais que ele ainda não possui.

## 3. Armadura — `rc-rebar-1d/v1`

A armadura reutiliza o return mapping 1D cíclico já validado no núcleo de aço:

- superfície de escoamento transladada por backstress;
- partição de encruamento cinemático/isotrópico;
- Bauschinger;
- deformação plástica acumulada;
- energia dissipada;
- contador de reversões.

A razão de encruamento `b` é convertida para módulo plástico equivalente:

`H = E b/(1-b)`.

A fração cinemática controla a partição entre `Hkin` e `Hiso`. O wrapper RC preserva integralmente o histórico committed/trial.

## 4. Bond-slip — `rc-bond-slip-1d/v1`

A relação local é simétrica em relação ao sinal do escorregamento `s`. Em módulo:

1. `0 ≤ |s| ≤ s1`: ramo ascendente `tau=tau_max (|s|/s1)^alpha`;
2. `s1 < |s| ≤ s2`: plateau `tau=tau_max`;
3. `s2 < |s| ≤ s3`: softening linear até `tau_res`;
4. `|s| > s3`: residual `tau=tau_res`.

Na v0.37, unloading/reloading abaixo do maior escorregamento histórico usa secante até a origem. O histórico registra máximo absoluto, direção de carregamento, número de reversões e escorregamento acumulado.

O componente `bond-slip-link` transforma tração de aderência em força por

`F = tau A_bond`

e a tangente por

`Kt = (d tau/ds) A_bond`.

Ele é um elemento local de interface; não representa contato geral aço–concreto em 3D.

## 5. Seção RC stateful — `rc-section-response/v1`

A geometria e a discretização são fornecidas pelo Section Engine v0.34. Para cada fibra:

`epsilon(y,z) = epsilon0 - kappaY z + kappaZ y`.

Fibra de concreto → `concreteDamageState()`.

Fibra de armadura → `rebarState()`.

Os resultantes são integrados como

`N = ∫ sigma dA`,

`My = ∫ (-z) sigma dA`,

`Mz = ∫ y sigma dA`.

A tangente seccional é

`Ks = ∫ B^T Et B dA`,

com `B=[1,-z,y]`.

As células finitas de concreto preservam seus momentos locais `IyLocal`, `IzLocal`, `IyzLocal`, mantendo a mesma correção de integração da v0.34. Barras discretas possuem momentos locais nulos.

A resposta fornece contagens de fibras fissuradas, fissuras fechadas, fibras esmagadas e barras escoadas, além do histórico trial completo por fibra.

## 6. Transação de estado

`createRCSectionTransaction()` usa `ElementStateTransaction` da v0.33. Cada chamada `response()` parte exclusivamente do último estado committed. Somente `commit()` atualiza a história permanente; `rollback()` restaura o committed.

Esse comportamento é obrigatório para integração futura em Newton global: iterações que não convergem não podem acumular dano, plasticidade ou energia de forma espúria.

## 7. Comprimento característico

Para concreto, o `characteristicLength` pode ser fornecido explicitamente. Na seção discretizada, se ele não for informado, a v0.37 usa `sqrt(A_fibra)` como medida local da célula de integração. Essa alternativa é reportável e determinística, mas a escolha explícita de `lch` é preferível em estudos de regularização e convergência.

A v0.37 não assume que `sqrt(A)` seja um comprimento universal para elementos continuum; essa decisão deverá ser revista pela cinemática do elemento quando o modelo for acoplado a shells/continuum.

## 8. Verificação determinística

`tests/nonlinear-rc-v037-smoke.mjs` verifica:

- invariância de `Gf` para dois comprimentos característicos;
- tensão no ponto médio do softening;
- energia total de fratura ao completar a fissuração;
- fechamento unilateral e recuperação da resposta compressiva;
- pico, softening e esmagamento compressivo regularizado por `Gc`;
- plastificação e reversão da armadura;
- ramos ascendente, plateau, softening e residual de bond-slip;
- unloading/reloading e reversão de aderência;
- rigidez axial RC pré-fissuração;
- fissuração, escoamento e esmagamento em flexão da seção;
- simetria da tangente seccional;
- `commit/rollback` da seção e do bond link.

## 9. Limitações deliberadas e próximo gate

Não estão sendo declarados nesta versão:

- plasticidade/dano multiaxial de concreto;
- rotating/fixed smeared crack em 2D/3D;
- shear retention e aggregate interlock em shells;
- contato geral 2D/3D;
- pull-out espacial distribuído de barras;
- confinamento tridimensional dependente de pressão lateral;
- SFRC com orientação/distribuição espacial de fibras.

Esses itens exigem cinemática e estados multiaxiais e não serão antecipados artificialmente. O próximo estágio permitido, após o CI final verde da v0.37, é **v0.38 — Advanced shells/contact**.
