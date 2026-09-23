# Fase 1 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-1-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-1-fundacao.md`
> **Status:** ✅ Concluída
> **Total:** 63 tarefas
> **Concluídas:** 63 (refrescado 2026-09-23)

---

## 0. Protocolo TDD

1. Escrever teste que falha
2. `deno task test` → falha correta
3. Implementar mínimo
4. `deno task test` → passa
5. `deno task check-all` → verde
6. Commit: `feat(<scope>): <descrição>`
7. Marcar `[x]`

**Regras:**
- 1 verbo, 1 entregável, verificação objetiva
- >2 h = quebre
- `check-all` falha = não commitar

---

## Progresso

```
[x] 1.1  deno.jsonc raiz                    — 10/10 ✅
[x] 1.2  Estrutura de 12 packages           — 13/13 ✅
[x] 1.3  Core isolation test                —  6/6 ✅
[x] 1.4  Padrão BDD                         —  4/4 ✅
[x] 1.5  ADRs 009–012 (renomeação+edição)   —  9/9  ✅
[x] 1.6  Task check-all                     —  3/3 ✅
[x] 1.7  Documentação inicial               —  8/8 ✅
[x] 1.8  Verificação final da fase          — 10/10 ✅
─────────────────────────────────────────────
TOTAL: 63 (63 done)
```

---

## Bloco A — Workspace

### 1.1 — `deno.jsonc` raiz

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.1.1 | Criar/abrir `deno.jsonc` raiz | `deno.jsonc` | `deno fmt --check deno.jsonc` | [x] |
| 1.1.2 | `workspace[]` com 12 packages | idem | `deno check` | [x] |
| 1.1.3 | `catalog` com versões | idem | `deno check` | [x] |
| 1.1.4 | `imports` com prefixos | idem | `deno check` | [x] |
| 1.1.5 | `tasks.test` | idem | `deno task --list` | [x] |
| 1.1.6 | `tasks.lint`, `tasks.fmt`, `tasks.check`, `tasks.tests` | idem | `deno task --list` | [x] |
| 1.1.7 | `tasks.dev`, `tasks.build` | idem | `deno task --list` | [x] |
| 1.1.8 | `tasks.taskjuggler` | idem | `deno task --list` | [x] |
| 1.1.9 | `compilerOptions` | idem | `deno check` | [x] |
| 1.1.10 | `fmt` e `lint` | idem | `deno fmt --check && deno lint` | [x] |

### 1.2 — Estrutura de 12 packages

| # | Tarefa | Verificação | Status |
|---|---|---|---|
| 1.2.1–1.2.12 | Criar 12 packages (core, parser, language, richtext, markdown, report, storage, worker-db, utils, service-worker, ui, server) | `deno check packages/*/mod.ts` | [x] |
| 1.2.13 | Teste de estrutura em `tests/integration/workspace_test.ts` | `deno task test` | [x] |

### 1.3 — Core isolation test

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.3.1 | Criar `tests/integration/core_isolation_test.ts` vazio | idem | `deno test` | [x] |
| 1.3.2 | Scan recursivo de `packages/core/src/**/*.ts` | idem | verde | [x] |
| 1.3.3 | Verificar imports proibidos | idem | 1 teste | [x] |
| 1.3.4 | Verificar globals proibidos | idem | 1 teste | [x] |
| 1.3.5 | Teste smoke com arquivo temporário | idem | 1 teste | [x] |
| 1.3.6 | Reportar arquivo + linha | idem | 1 teste | [x] |

### 1.4 — Padrão BDD

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.4.1 | Verificar `@std/testing/bdd` em `packages/utils/deno.jsonc` | idem | `deno check` | [x] |
| 1.4.2 | Exemplo canônico em `packages/utils/tests/bdd_example_test.ts` | idem | 3 testes verdes | [x] |
| 1.4.3 | Revisar `docs/syntaxmesh/06-testes-e-processo.md` | idem | lido | [x] |
| 1.4.4 | Adicionar nota sobre migração gradual | idem | lido | [x] |

---

### 1.5 — ADRs 009–012 (reorganização) ✅

**Executado.** Passos 1–6 dos "próximos passos" concluídos.

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.5.1 | Deletar `009-novos-pacotes-language-richtext-markdown.md` | `decisoes/` | `ls` não mostra | [x] |
| 1.5.2 | Deletar `010-testes-de-integracao-para-valida-o-do-workspace.md` | idem | idem | [x] |
| 1.5.3 | Deletar `011-configura-o-do-deno-jsonc-para-fase-1.md` | idem | idem | [x] |
| 1.5.4 | `git mv 012-richtext-* → 009-richtext-*` e editar título | `decisoes/009-richtext-mantido-markdown-futuro.md` | título `# 009` | [x] |
| 1.5.5 | `git mv 013-worker-db-* → 010-worker-db-*` e editar título | `decisoes/010-worker-db-centraliza-storage.md` | título `# 010` | [x] |
| 1.5.6 | `git mv 014-port-fiel-* → 011-port-fiel-*` e editar título | `decisoes/011-port-fiel-taskjuggler.md` | título `# 011` | [x] |
| 1.5.7 | `git mv 015-tjtime-* → 012-tjtime-*` e editar título | `decisoes/012-tjtime-typescript.md` | título `# 012` | [x] |
| 1.5.8 | Reescrever tabela em `decisoes/README.md` (001–012) | `decisoes/README.md` | 12 linhas | [x] |
| 1.5.9 | Normalizar autor (`Qwen Code` → `Vanaware`) nas ADRs 009–012 | idem | grep zero `Qwen` | [x] |

### 1.6 — Task `check-all`

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.6.1 | Adicionar `tasks.check-all` | `deno.jsonc` | `deno task --list` | [x] |
| 1.6.2 | Documentar em `06-testes-e-processo.md` | idem | lido | [x] |
| 1.6.3 | Rodar `deno task check-all` na raiz | — | exit 0 | [x] |

### 1.7 — Documentação inicial

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 1.7.1 | Revisar `00-index.md` com links novos | `00-index.md` | links válidos | [x] |
| 1.7.2 | Revisar `02-principios.md` | idem | lido | [x] |
| 1.7.3 | `03-arquitetura.md` lista os 12 packages | `03-arquitetura.md` | 12 nomes | [x] |
| 1.7.4 | `05-formato-e-compatibilidade.md` com RichText vs Markdown | idem | seção | [x] |
| 1.7.5 | `07-roadmap.md` com 21 fases | idem | 21 linhas | [x] |
| 1.7.6 | `09-regras-para-ia.md` com regra `sem any` | idem | idem | [x] |
| 1.7.7 | Criar `docs/syntaxmesh/fases/README.md` | idem | existe | [x] |
| 1.7.8 | Criar `docs/syntaxmesh/cheat-sheet-ruby-ts.md` | idem | existe | [x] |

### 1.8 — Verificação final da fase

| # | Tarefa | Verificação | Status |
|---|---|---|---|
| 1.8.1 | `deno task check-all` na raiz | exit 0 | [x] |
| 1.8.2 | `deno task test` isolado | ≥ 8 testes verdes | [x] |
| 1.8.3 | `import { } from "@syntaxmesh/core"` funciona | sem erro | [x] |
| 1.8.4 | `import { } from "@syntaxmesh/parser"` funciona | sem erro | [x] |
| 1.8.5 | 12 packages em `packages/*/deno.jsonc` | 12 arquivos | [x] |
| 1.8.6 | `decisoes/README.md` tem 12 ADRs | tabela completa | [x] |
| 1.8.7 | `core_isolation_test.ts` verde | verde | [x] |
| 1.8.8 | Atualizar status em `fase-1-fundacao.md` para `✅` | lido | [x] |
| 1.8.9 | Mover tarefas para `fase-1-tarefas.md` | arquivo existe | [x] |
| 1.8.10 | Corrigir numeração de subfases em `fase-1-fundacao.md` (`4.x` → `1.x`) | idem | [x] |

---

## Conclusão

Todas as 63 tarefas da Fase 1 foram concluídas e verificadas em `deno task check-all` (109 testes, 0 falhas).

---

**Fim do arquivo.**