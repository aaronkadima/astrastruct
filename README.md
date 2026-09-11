# AstraStruct

AstraStruct é uma plataforma web **assembly-first** para modelagem, análise, dimensionamento e futura verificação/detalhamento de estruturas de concreto armado e aço.

> **Estado atual:** ambiente de engenharia em desenvolvimento. Resultados requerem validação independente antes de qualquer uso profissional.

## MVP atual

- aplicação web estática, independente de Lovable;
- biblioteca de elementos arrastáveis;
- canvas SVG 2D interativo;
- nós, elementos paramétricos, apoios e cargas nodais;
- snap simples de nós;
- solver matricial real para **treliças 2D**;
- solver matricial real para **pórticos 2D Euler–Bernoulli**;
- matriz global de rigidez, transformação local/global, restrições, deslocamentos, reações e esforços locais;
- detecção de matriz singular/mecanismo;
- deformada e tabelas de resultados;
- Rule Engine demonstrativo para verificações definidas pelo usuário;
- **VNL — Visual Nonlinear Language**, arquitetura visual própria para pipelines de análise;
- autosave local e exportação JSON;
- modelos demonstrativos;
- workflow de GitHub Pages.

## Executar localmente

```bash
python -m http.server 8080 --directory web
```

Abra `http://localhost:8080`.

## Testar solver

```bash
node tests/solver-smoke.mjs
```

## Publicação

O workflow `.github/workflows/pages.yml` publica a pasta `web/` no GitHub Pages. Configure **Settings → Pages → Source: GitHub Actions** no repositório.

A URL esperada é:

`https://aaronkadima.github.io/astrastruct/`

## Arquitetura-alvo

A interface e o núcleo numérico são desacoplados. O backend do solver poderá evoluir por uma interface estável para:

- solver browser TypeScript/JavaScript;
- WebAssembly em Rust/C++/Fortran;
- serviço Python científico;
- serviço HPC remoto.

A VNL é uma DSL visual tipada, sem copiar a sintaxe ou interface do CAST3M:

`Geometry → Mesh → Material → Section → Boundary → Load → Solver → Result`

Futuro:

`Geometry → Mesh → Concrete Damage → Reinforcement → Bond-Slip → Contact → Increment → Newton Solver → Convergence → Result`

## Roadmap

- modelos mistos pórtico/treliça;
- elementos 3D e Timoshenko;
- releases, offsets e excentricidades;
- cargas distribuídas, térmicas, recalques e peso próprio;
- combinações de ações;
- P-Delta e grandes deslocamentos;
- Newton–Raphson incremental-iterativo;
- plasticidade do aço;
- concreto fissurado/dano/plasticidade;
- bond-slip e pull-out de ancoragens;
- contato;
- ligações parafusadas/soldadas;
- shell/solid e malha adaptativa;
- pushover, modal e dinâmica transiente;
- staged construction e reliability;
- packs normativos versionados ABNT NBR, ACI, Eurocodes e fib Model Code;
- detalhamento e relatórios SVG/DXF/PDF;
- backend WebAssembly/HPC.

## Política normativa

Nenhuma regra normativa oficial deve ser considerada implementada sem edição identificada, cláusula rastreável, controle de unidades, casos de validação independentes, testes de regressão e revisão técnica documentada.
