# AstraStruct v0.17 — Arc-Length / Riks

## Objetivo

A v0.17 adiciona continuação não linear por comprimento de arco ao solver co-rotacional 2D. O objetivo é rastrear caminhos de equilíbrio que apresentam pontos-limite de carga e que podem não ser percorridos de forma robusta por controle puro de carga ou de deslocamento.

A implementação mantém os mecanismos existentes de grandes deslocamentos, cargas mortas de referência, ações térmicas, força seguidora concentrada, ligações condensadas e rótulas concentradas de fibras com Newton constitutivo local embutido.

## Formulação

O equilíbrio global segue a convenção já usada pelo núcleo:

`R(u, λ) = Pext(u, λ) - fint(u, λ) = 0`.

A cada passo de continuação são desconhecidos o incremento dos graus de liberdade livres `Δu` e o incremento do fator do padrão de carga `Δλ`.

A restrição esférica é escrita como:

`g = Δuᵀ W Δu + α² Δλ² - Δs² = 0`,

onde `Δs` é o raio de comprimento de arco, `W` é uma matriz diagonal de pesos e `α` converte o incremento de fator de carga para a métrica do caminho.

Para compatibilizar translações e rotações, graus de liberdade rotacionais recebem peso `Lchar²`, em que `Lchar` é um comprimento característico obtido da geometria global do modelo. Assim, a métrica permanece dimensionalmente equivalente a comprimento.

## Preditor

No primeiro passo é resolvida a direção tangente:

`K_t û = ∂R/∂λ`.

O incremento preditor é escalado para satisfazer a esfera. O usuário define apenas o sentido inicial de `λ`.

Nos passos seguintes, o ramo é selecionado pela orientação com o incremento convergido anterior. Isso evita a troca arbitrária de sinal do preditor quando o caminho cruza um ponto-limite.

## Corretor de Newton

O corretor resolve o sistema bordado:

`[ K_t   -∂R/∂λ ] [δu]   = [ R ]`

`[ ∂g/∂u  ∂g/∂λ ] [δλ]     [-g]`.

A derivada `∂R/∂λ` é avaliada por diferença central do resíduo global completo. Portanto, a linearização em relação ao fator de carga incorpora as ações atualmente suportadas pelo kernel sem criar uma formulação paralela para cada tipo de carga.

O line search considera simultaneamente o resíduo de equilíbrio e o erro da restrição esférica.

## Raio adaptativo e cutback

Após cada passo convergido, o raio do passo seguinte é atualizado conforme o número de iterações de Newton. Passos que convergem rapidamente podem aumentar o raio; passos mais difíceis o reduzem.

Quando um passo falha, ocorre cutback: o estado retorna ao último ponto convergido e o raio é reduzido. O processo é repetido até o limite configurado ou até atingir o raio mínimo admissível.

Parâmetros principais:

- incremento inicial aproximado de `λ`;
- sentido inicial `+λ` ou `-λ`;
- número alvo de iterações;
- máximo de cutbacks;
- fatores mínimo e máximo do raio;
- tolerância da restrição esférica.

## Monitoramento e eventos

O nó/DOF escolhido na interface é somente um monitor do caminho; ele não é imposto cinematicamente.

A saída registra, por passo:

- `λ`;
- deslocamento monitorado;
- reação de base associada;
- número de iterações;
- norma do resíduo;
- erro da restrição de arco;
- raio utilizado;
- incremento de `λ`;
- número de cutbacks;
- estado das rótulas de fibras.

Reversões locais do sinal de `Δλ` são registradas como `load-factor-turning`. Reversões do incremento do deslocamento monitorado são registradas como `displacement-turning`.

## Não linearidade material

No Arc-Length, rótulas de fibras usam exclusivamente o acoplamento `embedded-local-newton` introduzido na v0.15. A linearização constitutiva tangente-afim é atualizada dentro de cada avaliação global do resíduo/tangente.

O modelo material continua monotônico, sem história cíclica. A derivada cruzada axial-material completa ainda não é montada como bloco monolítico global.

## Validação v0.17

A suíte automática inclui:

1. um arco raso com resposta snap-through, verificando a passagem por um ponto-limite de `λ`;
2. um caso Arc-Length com rótula concentrada de fibras, verificando a integração entre continuação geométrica e material;
3. regressões completas das versões anteriores: linear, P-Delta, co-rotacional, follower, imperfeição modal, ligações semirrígidas, pushover por deslocamento e interação N-M das rótulas.

No benchmark automático do arco raso, a trajetória detecta uma reversão de `λ` aproximadamente no passo 9, confirmando que o solver consegue continuar o caminho depois do máximo local de carga.

## Limitações

A implementação é uma continuação esférica do tipo Crisfield/Riks, mas não deve ser interpretada como um solucionador universal de bifurcação. A v0.17:

- não realiza branch switching automático em pontos de bifurcação;
- não executa análise dinâmica;
- não inclui plasticidade distribuída ou cíclica;
- não inclui contato;
- não oferece controle multiparâmetro de carga;
- não substitui procedimentos normativos FEMA, ASCE 41, N2 ou Capacity Spectrum Method.

O próximo avanço natural é aprimorar detecção/classificação de singularidades e bifurcações, incluindo escolha explícita de ramo e estratégias de continuação mais especializadas.
