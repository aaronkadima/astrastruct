# AstraStruct v0.53.4 — SSI espacial no Canvas 3D e análises próprias

A v0.53.4 amplia a interação solo–estrutura (SSI) introduzida na v0.53.3 sem alterar o princípio de governança: a fundação fornece ao modelo estrutural apenas rigidezes explicitamente cadastradas no contrato `foundation-ssi-model/v1`. Nenhuma propriedade geotécnica é deduzida automaticamente de SPT/NSPT, classificação do solo, tensão admissível, módulo edométrico ou geometria.

## Solvers integrados

O mesmo contrato `nodeSprings` com até seis componentes (`Kx`, `Ky`, `Kz`, `Kθx`, `Kθy`, `Kθz`) passa a ser utilizado em quatro modos de análise espacial: linear, P-Delta, modal e co-rotacional. Na análise P-Delta as molas são adicionadas à matriz de rigidez em cada iteração e suas forças finais são recuperadas por `R = -K u`.

No modal, as molas participam da matriz elástica `K` e, portanto, afetam frequências e formas próprias. Na flambagem linear 3D executada pelo painel de estabilidade, as molas também entram exclusivamente em `K`; elas não são adicionadas à rigidez geométrica `Kg`. Isso evita atribuir ao solo uma rigidez geométrica fictícia.

As formas modais e de flambagem são normalizadas. Por isso, o pós-processamento SSI as classifica como `MODE_ONLY`: amplitudes próprias não são apresentadas como recalques físicos, não geram reações de mola e não são usadas para calcular pressão média de contato.

## Canvas 3D principal

O renderer 3D validado foi preservado como núcleo e a SSI passou a ser apresentada por uma camada vetorial sincronizada com a mesma câmera. A camada mostra:

- contorno da fundação somente quando B e L existem explicitamente;
- símbolo da mola no nó vinculado;
- vetor de deslocamento/recalque translacional em coordenadas globais;
- vetor de reação translacional da mola em coordenadas globais;
- `uz` em milímetros e `q̄` em kPa para respostas físicas;
- estado da fundação e aviso de forma própria quando o resultado é modal/flambagem.

Os comprimentos gráficos dos vetores são escalados para legibilidade; suas direções vêm dos vetores físicos do solver. A camada pode ser ligada/desligada no próprio Canvas e possui acesso direto à configuração SSI.

## Pós-processamento e pressão média

Para uma fundação superficial com dimensões explícitas, permanece válida a leitura resumida `q̄ = Rz/(B L)`. Trata-se de uma resultante média, não de uma distribuição de tensões de contato. Para fundações profundas, nenhuma reação por estaca é repartida automaticamente; o estado permanece `PENDING_DISTRIBUTION_MODEL` até existir um modelo bloco–estacas–solo explícito.

## Sincronização de resultados

O resultado corrente da análise React é compartilhado com o workbench SSI por uma ponte de estado em memória. Isso evita gravar resultados transitórios no projeto e garante que o painel SSI e o Canvas leiam a mesma execução do solver. Alterações de projeto continuam invalidando o resultado conforme o fluxo normal do AstraStruct.

## Compatibilidade e segurança

A versão do contrato permanece `foundation-ssi-model/v1` e `foundation-ssi-result/v1`; a implementação experimental passa a `0.53.4-exp`. O identificador interno das molas gerenciadas da v0.53.3 é mantido para permitir remoção/restauração compatível de projetos já salvos. Modos não integrados, como história temporal 2D, continuam bloqueados para ativação SSI espacial em vez de ignorar silenciosamente as molas.