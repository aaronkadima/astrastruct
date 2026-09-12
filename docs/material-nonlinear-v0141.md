# AstraStruct v0.14.1 — linearização tangente afim das rótulas de fibras

## Estado

Versão experimental e monotônica. A v0.14.1 evolui o acoplamento das rótulas concentradas de fibras de aço sem alterar a formulação geométrica co-rotacional validada da série v0.13.x.

## Motivação

Na v0.14.0, cada rótula de fibras era representada no equilíbrio global por uma mola secante atualizada externamente,

`k_s = M_h / theta_h`.

Essa estratégia fecha o equilíbrio constitutivo, porém a rigidez usada na condensação não é a derivada local da lei momento–rotação após o escoamento.

A v0.14.1 passa a linearizar a relação constitutiva no estado corrente `i`:

`M_h(theta) ≈ M_i + k_t,i (theta - theta_i)`

ou, de forma afim,

`M_h(theta) ≈ k_t,i theta + M0_i`,

com

`k_t,i = dM_h/dtheta`

`M0_i = M_i - k_t,i theta_i`.

A tangente `k_t,i` é obtida da seção de fibras com equilíbrio axial `N-M` e condição `dN=0`:

`D_Mk|N = K22 - K12^2/K11`

`k_t = D_Mk|N / Lp`.

## Acoplamento com a ligação co-rotacional

O kernel de ligação passa a aceitar a lei afim

`M = k (theta_n - theta_e) + M0`.

O termo constante `M0` participa do vetor de equilíbrio interno, mas não altera a Hessiana. Assim, a condensação de Schur existente continua sendo aplicada com `k = k_t`:

`Kcond = Hqq - Hqr Hrr^-1 Hrq`.

Isso preserva a estrutura numérica já validada para rotações internas de extremidade e permite que a tangente constitutiva pós-escoamento participe diretamente da matriz condensada.

## Algoritmo da v0.14.1

Para cada iteração material externa:

1. resolve-se o problema co-rotacional completo com a linearização afim corrente;
2. recuperam-se `theta_h`, `N` e o momento transmitido em cada rótula;
3. resolve-se o equilíbrio local da seção de fibras para `N`;
4. calculam-se `M_h`, `k_t` e `M0`;
5. `k_t` e `M0` são atualizados com relaxação configurável;
6. repete-se até que `M_elemento` e `M_h` coincidam dentro da tolerância material e a rotação da rótula estabilize.

O modo legado `materialStrategy = "secant"` permanece disponível internamente para regressão numérica.

## Limite metodológico

A v0.14.1 ainda não é um Newton monolítico material-geométrico completo. O esforço axial usado no equilíbrio constitutivo é recuperado da solução global e atualizado entre iterações materiais. Portanto, o acoplamento `N-M` constitutivo continua sendo resolvido em uma camada externa, embora a rigidez flexional da rótula usada na condensação seja agora a tangente constitutiva local.

Ainda não são contemplados: descarga/recarregamento cíclico, Bauschinger, plasticidade distribuída, concreto, fissuração, dano, bond-slip, flambagem local, contato ou degradação cíclica.

## Próxima evolução

A etapa seguinte é incorporar as variáveis constitutivas e o equilíbrio `N-M` diretamente no Newton global, eliminando a iteração material externa. Depois disso, a sequência prevista é: seções I/H e fibras arbitrárias, concreto e seções RC, plasticidade distribuída, pushover/controle de deslocamento e, por fim, modelos cíclicos e de dano.
