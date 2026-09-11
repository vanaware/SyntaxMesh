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
| 009 | Novos pacotes: language, richtext, markdown | Aceito | 2026-09-10 |
| 010 | Testes de integração para validação do workspace | Aceito | 2026-09-10 |
| 011 | Configuração do deno.jsonc para Fase 1 | Aceito | 2026-09-10 |
| 012 | RichText mantido, Markdown futuro | Aceito | 2026-09-11 |
| 013 | worker-db centraliza storage | Aceito | 2026-09-11 |
| 014 | Port fiel do TaskJuggler | Aceito | 2026-09-11 |

> **Nota:** Manter esta tabela atualizada manualmente ou via script ao adicionar novos ADRs.