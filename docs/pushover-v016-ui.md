# Interface do pushover v0.16

No painel **Tipo de análise → Geom. não linear**, o usuário pode selecionar:

- **Carga · λ prescrito**: mantém o caminho incremental de controle de carga existente;
- **Deslocamento · pushover**: ativa `λ` como incógnita.

No modo pushover são configurados:

- nó de controle;
- DOF `Ux`, `Uy` ou `Rz`;
- deslocamento/rotação final alvo;
- tolerância relativa da restrição de controle;
- número de incrementos, máximo de iterações, tolerância de equilíbrio e line search.

O pós-processamento apresenta a curva de capacidade `λ × u`, o ponto de maior `|λ|`, o primeiro passo com plastificação de uma rótula de fibras e os eventos de novas rótulas plastificadas. O relatório técnico registra também a tabela completa do caminho de equilíbrio.
