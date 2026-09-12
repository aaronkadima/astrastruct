# Notas de continuidade após v0.16

A infraestrutura do sistema aumentado introduzida na v0.16 deve ser reutilizada na próxima etapa para **arc-length/Riks**. A extensão não deve ser implementada como simples variação do controle de deslocamento: será necessária uma equação de restrição de comprimento de arco, seleção consistente do sinal de `Δλ`, controle adaptativo do incremento e benchmarks específicos de ponto-limite, snap-through e, posteriormente, snap-back.

A curva `λ–u` da v0.16 é uma curva de caminho de equilíbrio para o padrão de carga selecionado. Não deve ser interpretada automaticamente como curva normativa de capacidade sísmica, nem convertida em ponto de desempenho sem uma metodologia específica de demanda/capacidade e critérios normativos adicionais.
