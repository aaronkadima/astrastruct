# AstraStruct v0.53.3 — interação solo–estrutura espacial auditável

A v0.53.3 introduz uma camada SSI (soil–structure interaction) explícita entre os itens de fundação e os graus de liberdade do modelo estrutural. A implementação reutiliza o contrato `nodeSprings` já empregado pelo solver co-rotacional 3D e passa a aplicá-lo também no solver linear espacial. Não existe um segundo solver de fundações.

## Contratos e unidades

O contrato `foundation-ssi-model/v1` associa cada fundação a um nó e a até seis rigidezes independentes: `Kx`, `Ky`, `Kz` em kN/m e `Kθx`, `Kθy`, `Kθz` em kN·m/rad. A fonte/método do valor pode ser registrada em cada fundação. A versão experimental é `0.53.3-exp`.

Nenhuma rigidez geotécnica é inferida de SPT/NSPT, módulo do solo, classificação de camada, tensão admissível ou geometria. Os valores devem ser informados pelo responsável técnico ou produzidos por um método geotécnico externo validado. Rigidez negativa é rejeitada.

## Sincronização com apoios

Ao ativar a SSI, somente os graus de liberdade com rigidez positiva substituem restrições fixas coincidentes. O estado anterior desses graus de liberdade é registrado em `managedSupports`. Ao desativar a SSI, as molas geradas pelo AstraStruct são removidas e os vínculos gerenciados são restaurados. Molas criadas manualmente pelo usuário não são removidas.

A primeira integração executável cobre análise linear 3D e co-rotacional 3D. A interface bloqueia a ativação em modos ainda não integrados, em vez de permitir uma análise que ignore silenciosamente a fundação elástica.

## Pós-processamento

O contrato `foundation-ssi-result/v1` recupera deslocamentos da fundação e reações das molas pela relação `R = -K u`. Para fundações superficiais com `B` e `L` explicitamente cadastrados, o painel também apresenta a pressão média `q̄ = Rz/(B L)`. Esse valor é apenas uma resultante média e não representa uma distribuição de tensões de contato.

Para fundações profundas, o sistema não divide automaticamente a reação entre estacas. Reações individuais permanecem `PENDING_DISTRIBUTION_MODEL` até existir um modelo explícito de rigidez/distribuição do bloco–estacas–solo.

## Interface

O menu **Modelo → SSI espacial · solo–fundação…** abre três áreas: configuração das seis rigidezes, resultados com mapa das fundações/recalques/reações e auditoria. O mapa usa apenas coordenadas e dimensões existentes no projeto e não inventa geometria.
