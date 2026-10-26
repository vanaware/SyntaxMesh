# SyntaxMesh — Documentação

> **Fonte da verdade:** o escopo, especificação e andamento do projeto vivem em `docs/syntaxmesh/fases/` (planos `fase-N-*.md` + tarefas `fase-N-*-tarefas.md` + `plano.md`) e `docs/syntaxmesh/decisoes/` (ADRs). Os demais arquivos deste diretório são documentação de referência (visão, princípios, arquitetura) e podem estar **defasados** — em caso de conflito, vale o conteúdo de `fases/` e `decisoes/`. Em especial, a estrutura de pacotes descrita em `03-arquitetura.md` foi simplificada pela **ADR 030** (todo o código em `packages/core`; apoio: `server`, `ui`, `service-worker`).

## Visão geral

O SyntaxMesh é um port em TypeScript do TaskJuggler, mantendo a essência e os cálculos existentes enquanto introduz melhorias e novas funcionalidades.

## Fases de desenvolvimento

| Fase | Descrição | Status |
|---|---|---|
| **Fase 1 — Fundação e Workspace Deno** | Esqueleto do monorepo, quality pipeline, ADRs | ✅ Concluída |
| **Fase 2 — Tempo e Geometria** | Base temporal do motor. Tudo depende disso. | ✅ Concluída |
| **Fase 3 — Modelo de Atributos** | Sistema de tipos de atributos com herança e scenario-specific. | ✅ Concluída |
| **Fase 4 — Árvore de Propriedades** | `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy`. | ✅ Concluída |
| **Fase 5 — Entidades Concretas** | `Task`, `Resource`, `Account`, `Shift`, `Report` (esqueleto). | ✅ Concluída |
| **Fase 6 — Scoreboard e Estruturas Base** | Scoreboard bit-encoded + limites + shifts. | ✅ Concluída |
| **Fase 7 — Scheduler Core** | O coração. Loop slot-a-slot. | ✅ Concluída (gap de datas em `Project.schedule()` — ver CURRENT.md) |
| **Fase 8 — Sistema Financeiro** | Custos, receitas, balanço. **Alta prioridade.** | ✅ Concluída |
| **Fase 8.1 — Nova funcionalidade de custos** | Material, charge estendido, booking estendido, tracking scenario (redefinido). | ✅ Concluída (parser de `material` pendente → complemento) |
| **Fase 8.2 — Modelo Contábil Estendido** | Reescrita da agregação contábil (CostEvent, chargesets múltiplos, precedência). | ✅ Concluída |
| **Fase 9 — Orquestrador e Cache** | `Project`, `TaskJuggler`, `DataCache`, `PropertyList`, `MessageHandler`, `Log`. | ✅ Concluída |
| **Fase 10 — Parser e Linguagem** | Lexer, parser FSM, gramática TJP, i18n. | ✅ Concluída (2026-10-26) |
| **Fase 10 Complemento** | Extensões RDO/orçamento (`material` no parser, `note`/`journal` estendidos, `picture`/`format`/`rdoreport`/`breakdownreport`, `timebasis` #6/#6a) | ⬜ Não iniciada |
| **Fase 11 — Expressões Lógicas e Queries** | Motor de expressões lógicas e ponte para reports. | ⬜ Não iniciada |
| **Fase 12 — RichText (compatibilidade TJP)** | Manter Markup MediaWiki para compatibilidade total com `.tjp`. | ⬜ Não iniciada |
| **Fase 13 — Markdown (novo, futuro)** | Formato going-forward. Wrapper sobre `@deno/gfm` + extensões. | ⬜ Não iniciada |
| **Fase 14 — Relatórios** | Pipeline completo de relatórios. | ⬜ Não iniciada |
| **Fase 15 — Gantt** | Gantt chart completo em HTML+CSS. | ⬜ Não iniciada |
| **Fase 16 — Apoio** | Estruturas auxiliares. | ⬜ Não iniciada |
| **Fase 17 — HTML/XML** | Geradores de HTML/XML. | ⬜ Não iniciada |
| **Fase 18 — Time/Status Sheets** | Time sheets e status sheets. | ⬜ Não iniciada |
| **Fase 19 — Storage** | Persistência local via `@vanaware/workerdb` (ADR 030). | ⬜ Não iniciada |
| **Fase 20 — PWA + UI** | Service Worker, manifest, Preact + Signals + BeerCSS. | ⬜ Não iniciada |
| **Fase 21 — Compatibilidade e Qualidade** | Golden tests, corpus multilíngue, performance, release. | ⬜ Não iniciada |

## Documentação de referência

- `01-visao.md` — visão do produto.
- `02-principios.md` — regras técnicas e processo.
- `03-arquitetura.md` — arquitetura geral (histórica; vale ADR 030).
- `04-linguagem-multilingue.md` — idiomas e keywords canônicas.
- `05-formato-e-compatibilidade.md` — gramática do TaskJuggler.
- `06-testes-e-processo.md` — desenvolvimento incremental.
- `08-mvp.md` — conteúdo da primeira versão estável.
- `09-regras-para-ia.md` — regras de ouro.
- `10-futuro.md` — planos de melhorias.
- `fases/` — **planejamento canônico** (21 fases + complementos).
- `decisoes/` — ADRs (Architecture Decision Records).
- `cheat-sheet-ruby-ts.md` — dicas de conversão Ruby → TypeScript.

## Referências externas

- `docs/taskjuggler/` — gema original do TaskJuggler (tj3) em Ruby.
- `docs/webjuggler/` — app TypeScript visualizador de arquivos tjp.
- `docs/Learning/` — Minimal Working Examples (MWEs) do TaskJuggler.

## Plano canônico

O plano de desenvolvimento detalhado e atualizado está em `docs/syntaxmesh/fases/plano.md` (21 fases). Use este arquivo como referência para o estado atual e as próximas tarefas.

## Fase 8.1 — Nova funcionalidade de custos

A fase 8.1 estende o modelo financeiro do SyntaxMesh com quatro funcionalidades integradas:

1. **Material** — entidade de primeira classe representando insumos físicos (aço, concreto, tinta), com quantidade, preço unitário e distribuição temporal.
2. **Charge estendido** — o atributo `charge` ganha novas formas de distribuição temporal (não-linear), consistente com `material`.
3. **Booking estendido** — o atributo `booking` registra não apenas esforço, mas também **charge** e **material** efetivamente incorridos, permitindo projeção e comparação plan-vs-actual.
4. **Tracking scenario (redefinido)** — não mais um requisito técnico para projeção, mas um **papel designado** indicando qual cenário representa a realidade oficial do projeto.

### Arquivos da fase 8.1

- `fase-8.1-nova-funcionalidade-custos.md` — plano da funcionalidade (especificação completa).
- `fase-8.1-tarefas.md` — tarefas atômicas com testes unitários.

### Princípios de implementação

- **Core independente** — a lógica de materiais, charge, booking e tracking scenario reside em `src/core/accounting/` ou `src/core/model/`, sem dependência de UI, Storage ou Parser.
- **chargeset reutilizado** — o material usa o mesmo `chargeset` que Resource/Task. Não criar um sistema paralelo.
- **Testes obrigatórios** — toda nova funcionalidade tem testes unitários (regra 12).
- **Incompatibilidade controlada** — a sintaxe de material/charge/booking não precisa ser compatível com o TaskJuggler original. Arquivos `.tjp` sem essas funcionalidades continuam funcionando.
- **Inglês apenas (por enquanto)** — todas as novas keywords estão em inglês.