# AstraStruct v0.53.9 — Mapas 3D de envoltórias governantes

## Escopo

A v0.53.9 estende o explorador de combinações v0.53.8 com o contrato visual `combination-envelope-visualization/v1`. O objetivo é levar as envoltórias N/V/M/T já calculadas ao Canvas 3D sem criar resultados novos nem modificar `project.results`.

## Escalas e unidades

A visualização é construída a partir de `elementEnvelopes`. Cada item mantém valor assinado, magnitude, componente governante, combinação governante e unidade. Barras e shells recebem escalas independentes por campo, pois as unidades são diferentes:

- N: barras [kN], shells [kN/m];
- V: barras [kN], shells [kN/m];
- M: barras [kN·m], shells [kN·m/m];
- T: barras [kN·m]; não é criado valor de torção para shell quando o pós-processador não o fornece.

Nenhuma normalização combina grandezas de unidades incompatíveis.

## Canvas 3D

Em **Resultados → Combinações & envoltórias → Envoltórias N/V/M/T**, o usuário escolhe N, V, M ou T e envia o mapa ao Canvas 3D. O mapa é uma camada gráfica transitória sobre a geometria estrutural.

A escala cromática usa a magnitude relativa dentro da própria família (barra ou shell), preservando o sinal no sentido azul/negativo e vermelho/positivo. O elemento de maior magnitude de cada família é marcado como crítico.

A camada não altera geometria, propriedades, rigidez, carregamentos, solver, verificações ou resultados persistidos.

## Seleção e combinação governante

Com o mapa ativo, a seleção normal do Canvas continua disponível. Ao selecionar um elemento com envelope, o painel mostra:

- elemento e rótulo;
- componente governante;
- valor e unidade;
- combinação governante.

O comando **Abrir combinação governante** reabre o explorador diretamente na combinação correspondente. Também existem atalhos para selecionar a barra crítica e, quando aplicável, o shell crítico.

## Governança

- a fonte exclusiva é `combination-envelope-explorer/v1`;
- nenhum valor ausente é convertido em zero;
- barras e shells nunca compartilham escala numérica;
- não há PASS/FAIL normativo implícito;
- o mapa é descartado quando o projeto ativo muda;
- limpar o mapa não altera qualquer resultado estrutural.
