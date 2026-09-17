# Decisões Arquitetônicas (ADR)

Este diretório armazena **Architecture Decision Records (ADRs)** — decisões técnicas importantes que afetam a arquitetura, design ou processo do SyntaxMesh.

## Quando criar um ADR

Crie um ADR quando a decisão:

- Afeta múltiplos pacotes ou camadas (Core, Parser, Report, Storage, UI)
- Envolve trade-offs não triviais (performance vs. simplicidade, compatibilidade vs. inovação)
- Define convenções que outros desenvolvedores devem seguir
- Resolve um bug difícil ou comportamento inesperado
- Introduz ou remove uma dependência significativa
- Altera o formato de dados, API pública ou contrato entre módulos

## Formato do arquivo

Nome: `NNN-titulo-kebab-case.md` (ex: `001-core-independente-do-dom.md`)

Estrutura:

```markdown
# Título da Decisão

## Contexto

Qual o problema ou oportunidade que motivou esta decisão?
Quais foram as alternativas consideradas?

## Decisão

O que foi decidido? Seja específico e acionável.

## Consequências

### Positivas
- Benefício 1
- Benefício 2

### Negativas / Riscos
- Custo/Trade-off 1
- Mitigação planejada

### Neutras / Observações
- Detalhe de implementação
- Referência a issues, PRs ou discussões relacionadas

---

**Status:** Aceito / Proposto / Obsoleto / Substituído por NNN
**Data:** YYYY-MM-DD
**Autor(es):** Nome(s)
```

## Lista de ADRs

## Lista de ADRs

| ID | Título | Status | Data |
|---|---|---|---|
| 001 | Core independente de DOM e Storage | Aceito | 2026-09-08 |
| 002 | Parser isolado da lógica de UI | Aceito | 2026-09-08 |
| 003 | Storage não contamina Core | Aceito | 2026-09-08 |
| 004 | Idioma não contamina Core (AST canônica) | Aceito | 2026-09-08 |
| 005 | Stack: TypeScript + Deno + Browser only | Aceito | 2026-09-08 |
| 006 | Build pipeline: deno task build / dev / export / taskjuggler | Aceito | 2026-09-08 |
| 007 | Workspace Deno com packages independentes | Aceito | 2026-09-08 |
| 008 | Biblioteca de testes: `@std/testing/bdd` padrão | Aceito | 2026-09-08 |
| 009 | RichText mantido, Markdown futuro | Aceito | 2026-09-11 |
| 010 | worker-db centraliza storage | Aceito | 2026-09-11 |
| 011 | Port fiel do TaskJuggler | Aceito | 2026-09-11 |
| 012 | TjTime em TypeScript | Aceito | 2026-09-11 |
| 013 | Flag global `compat.keepRubyBugs` para bugs do Ruby | Aceito | 2026-09-12 |
| 014 | Attribute mode global em TypeScript | Aceito | 2026-09-12 |
| 015 | Metaprogramação em PropertyTreeNode | Aceito | 2026-09-12 |
| 016 | Pré-carregamento de atributos em `*Scenario` | Proposto | — |
| 017 | Scoreboard bit encoding em TypeScript | Proposto | — |
| 018 | Heurística do scheduler TaskJuggler | Proposto | — |
| 019 | Modelo financeiro em TypeScript | Proposto | — |
| 020 | Orquestrador e pipeline de scheduling | Proposto | — |
| 021 | FSM do TextParser compilado em runtime | Proposto | — |
| 022 | i18n de keywords via LanguageRegistry | Proposto | — |
| 023 | Expressões lógicas sem precedência | Proposto | — |
| 024 | RichText e function handlers | Proposto | — |
| 025 | Markdown como formato going-forward | Proposto | — |
| 026 | Reports no browser: retorno de strings | Proposto | — |
| 027 | Gantt HTML+CSS | Proposto | — |
| 028 | Journal e AlertLevel em TypeScript | Proposto | — |
| 029 | Substituição de XML/HTML/ICalendar/Painter mínimos | Proposto | — |

> **Nota:** Manter esta tabela atualizada manualmente ou via script ao adicionar novos ADRs.
