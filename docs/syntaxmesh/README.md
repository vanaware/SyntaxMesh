# SyntaxMesh — Documentação

## Visão geral

O SyntaxMesh é um port em TypeScript do TaskJuggler, mantendo a essência e os cálculos existentes enquanto introduz melhorias e novas funcionalidades.

## Fases de desenvolvimento

| Fase | Descrição | Status |
|---|---|---|
| Fase 8 — Financeiro | Contabilidade, contas, charges, créditos | ✅ Concluída |
| **Fase 8.1 — Nova funcionalidade de custos** | **Materiais, charge estendido, booking estendido e tracking scenario** | ✅ Concluída |
| Fase 9 — Modelos do Core | Modelos centrais do Core | ⬜ Não iniciada |
| Fase 10 — Calendário e tempo | Calendário e manipulação de tempo | ⬜ Não iniciada |
| Fase 11 — Scheduling | Agendamento de tarefas | ⬜ Não iniciada |
| Fase 12 — Recursos e contabilidade | Recursos e contabilidade do Core | ⬜ Não iniciada |
| Fase 13 — Cenários | Cenários e validação do Core | ⬜ Não iniciada |

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

## Documentação de referência

- `00-index.md` — índice de contexto.
- `01-visao.md` — visão do produto.
- `02-principios.md` — regras técnicas e processo.
- `03-arquitetura.md` — arquitetura geral.
- `04-linguagem-multilingue.md` — idiomas e keywords canônicas.
- `05-formato-e-compatibilidade.md` — gramática do TaskJuggler.
- `06-testes-e-processo.md` — desenvolvimento incremental.
- `07-roadmap.md` — fases e prioridades.
- `08-mvp.md` — conteúdo da primeira versão estável.
- `09-regras-para-ia.md` — regras de ouro.
- `10-futuro.md` — planos de melhorias.
- `decisoes/` — ADRs (Architecture Decision Records).
- `cheat-sheet-ruby-ts.md` — dicas de conversão Ruby → TypeScript.

## Referências externas

- `docs/taskjuggler/` — gema original do TaskJuggler (tj3) em Ruby.
- `docs/webjuggler/` — app TypeScript visualizador de arquivos tjp.
- `docs/Learning/` — Minimal Working Examples (MWEs) do TaskJuggler.
