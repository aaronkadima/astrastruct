# Escopo de engenharia da v0.16

O recurso implementado é um solucionador geral de caminho de equilíbrio por controle de um único grau de liberdade para o padrão de carga do cenário. Ele fornece `λ`, deslocamentos, reações, esforços e eventos de plastificação no caminho calculado.

A presença da expressão “curva de capacidade” na interface refere-se à curva numérica `λ–u` do modelo e do padrão de carga escolhidos. A v0.16 não aplica, por si só, procedimentos FEMA, ASCE 41, N2, Capacity Spectrum Method ou critérios sísmicos equivalentes. Esses procedimentos deverão ser módulos posteriores e explicitamente identificados quando implementados.
