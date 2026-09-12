# Equações do controle de deslocamento v0.16

Convenção de resíduo do núcleo co-rotacional:

`R(u, λ) = Pext(u, λ) − Fint(u, λ)`.

A tangente usada pelo solver satisfaz, a `λ` fixo,

`K Δu = R`.

Para o controle de deslocamento, lineariza-se também em relação a `λ`:

`K Δu − R,λ Δλ = R`,

com a restrição cinemática

`cᵀ Δu = ualvo − uc`.

Assim, a correção é obtida do sistema bordado

```
| K   −R,λ | | Δu |   | R |
| cᵀ    0  | | Δλ | = | g |
```

onde `g = ualvo − uc`. Na v0.16, `R,λ` é avaliada por diferença central do resíduo global completo. A mesma correção `(Δu, Δλ)` é escalada pelo line search.
