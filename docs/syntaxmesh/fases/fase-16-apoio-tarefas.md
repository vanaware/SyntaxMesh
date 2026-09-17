# Fase 16 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-16-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-16-apoio.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~195 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Journal,AlertLevelDefinitions,LeaveList,TernarySearchTree,AlgorithmDiff,TextFormatter,FileList,URLParameter,StdIoWrapper,UTF8String,KateSyntax,VimSyntax}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

Esta fase **completa stubs** das Fases 5, 11 e 14. A ordem importa:

1. **Bloco A** — `AlertLevelDefinitions` (usado por `Journal`).
2. **Bloco B** — `Journal` (`JournalEntry`, `JournalEntryList`, `Journal`).
3. **Bloco C** — `Leave` + `LeaveList` + `LeaveAllowance` (substitui stubs da Fase 5).
4. **Bloco D** — utilitários (`TextFormatter`, `FileList`, `URLParameter`, `TernarySearchTree`, `AlgorithmDiff`, `StdIoWrapper`, `UTF8String`).
5. **Bloco E** — dev tools (`KateSyntax`, `VimSyntax`).
6. **Bloco F** — integração: completar 8 queries de `TaskScenario` + `ResourceScenario.query_dashboard` + `LogicalFlag.eval` + `LogicalFunction.hasalert`.
7. **Bloco G** — golden tests.
8. **Bloco H** — verificação final.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 014** — `mode` global.
- **ADR 015** — Metaprogramação em `PropertyTreeNode`.
- **ADR 016** — Pré-carregamento em `*Scenario`.
- **ADR 017** — Scoreboard bit encoding.
- **ADR 018** — Heurística do scheduler.
- **ADR 019** — Modelo financeiro.
- **ADR 020** — Orquestrador e pipeline.
- **ADR 021** — FSM do TextParser.
- **ADR 022** — i18n de keywords.
- **ADR 023** — Expressões lógicas sem precedência.
- **ADR 024** — RichText e function handlers.
- **ADR 025** — Markdown going-forward.
- **ADR 026** — Reports browser-only.
- **ADR 027** — Gantt HTML+CSS.
- **ADR 028** — Journal e AlertLevel (**criado nesta fase**).

### Convenções CRÍTICAS

- **`Journal` é parte do `Project`** (inicializado no construtor — Fase 9).
- **`JournalEntry.property` é `PropertyTreeNode | null`** (entrada global).
- **`AlertLevelDefinitions` default:** 3 níveis (`green`, `yellow`, `red`).
- **`currentEntriesR` usa `DataCache`.**
- **`alertLevel` retorna max dos filhos.**
- **`Leave.typeIdx`** é o índice do tipo (1–7).
- **`LeaveAllowance.slots`** pode ser negativo (expiração).
- **`TextFormatter` com UTF-8.** Usar `[...str]`.
- **`URLParameter` depende de `fflate`.** Fixar versão.
- **`TernarySearchTree`** é opcional (só `tj3man`).
- **`UTF8String` é no-op.** Funções delegate.
- **`StdIoWrapper` em browser** com limitações.
- **`KateSyntax` / `VimSyntax`** em `dev-tools/`.
- **`LogicalFlag`** distingue Query de JournalEntry.
- **`hasalert`** usa `currentEntries`.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não tocar em Fase 14 (reports) — apenas stubs de journal queries.
- ❌ Não tocar em Fase 17 (HTML/XML).
- ❌ Não tocar em Fase 18 (time sheets) — `TimeSheetRecord` é stub aqui.
- ❌ Não implementar `Leave` real na Fase 5 — só aqui.
- ❌ Não usar `Proxy`.
- ❌ Não implementar `KateSyntax`/`VimSyntax` no `src/` público — só em `dev-tools/`.
- ❌ Não tratar `UTF8String` como classe — só funções.

---

## Progresso

```
[ ] 16.0  ADR 028 (Journal e AlertLevel)            —   0/5
[ ] 16.1  AlertLevelDefinition + AlertLevelDefinitions — 0/14
[ ] 16.2  JournalEntry + JournalEntryList           —   0/16
[ ] 16.3  Journal (core + queries)                  —   0/28
[ ] 16.4  Leave + LeaveList + LeaveAllowance        —   0/18
[ ] 16.5  Substituir stubs de LeaveList (Fase 5)    —   0/6
[ ] 16.6  TextFormatter                             —   0/10
[ ] 16.7  FileList + FileRecord                     —   0/8
[ ] 16.8  URLParameter                              —   0/6
[ ] 16.9  TernarySearchTree                         —   0/12
[ ] 16.10 AlgorithmDiff                             —   0/12
[ ] 16.11 StdIoWrapper                              —   0/6
[ ] 16.12 UTF8String (no-op)                        —   0/8
[ ] 16.13 deepClone (revisar)                       —   0/4
[ ] 16.14 KateSyntax                                —   0/6
[ ] 16.15 VimSyntax                                 —   0/6
[ ] 16.16 Completar TaskScenario query_* (8)        —   0/20
[ ] 16.17 Completar ResourceScenario query_dashboard —  0/6
[ ] 16.18 Completar LogicalFlag + hasalert          —   0/8
[ ] 16.19 Golden tests (Journal + Leaves)           —   0/10
[ ] 16.20 Verificação final                         —   0/10
─────────────────────────────────────────────────────────
TOTAL: ~195
```

---

## Bloco A — Fundação

### 16.0 — ADR 028 (Journal e AlertLevel)

**Objetivo:** formalizar o sistema de journal + alert levels.

**⚠️ Nota:** o plano usa `ADR 026`, mas ADR 026 é reports (Fase 14), ADR 027 é Gantt (Fase 15). Aqui usamos **ADR 028**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.0.1 | Criar `docs/syntaxmesh/decisoes/028-journal-alertlevel.md` com frontmatter | idem | arquivo existe |
| 16.0.2 | Seção **Contexto:** Journal + AlertLevel; uso em tracking; tracking de projetos | idem | — |
| 16.0.3 | Seção **Decisão 1:** `Journal` é parte do `Project` (Fase 9 já preparou) | idem | — |
| 16.0.4 | Seção **Decisão 2:** `JournalEntry.property` é `PropertyTreeNode \| null` (entrada global); **Decisão 3:** Alert levels configuráveis (default 3) | idem | — |
| 16.0.5 | **Alternativas** + **Consequências** (sistema de tracking completo); atualizar linha `028` em `decisoes/README.md` | idem | 28 linhas |

---

### 16.1 — `AlertLevelDefinition` + `AlertLevelDefinitions`

**⚠️ RUBY: `AlertLevelDefinitions.rb` (arquivo inteiro — ~120 linhas)**
**🔎 CHEAT: §3 `Struct` → `class`, §5 `Array#map`**

**Pré-requisitos:** nenhum.

#### 16.1.1 — `AlertLevelDefinition`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.1.1.1 | Criar `packages/core/src/journal/alert-level.ts` com `class AlertLevelDefinition` | idem | `deno check` |
| 16.1.1.2 | Campos `readonly id: string`, `readonly name: string`, `readonly color: string` | idem | `deno check` |
| 16.1.1.3 | Constructor `(id, name, color)` | idem | 3 testes |
| 16.1.1.4 | ⚠️ `to_s(): string` = `"<id> '<name>' '<color>'"` | idem | 3 testes |

#### 16.1.2 — `AlertLevelDefinitions`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.1.2.1 | Criar `class AlertLevelDefinitions` com `private levels: AlertLevelDefinition[]`, `private _modified: boolean` | idem | `deno check` |
| 16.1.2.2 | ⚠️ Constructor: adiciona `green`, `yellow`, `red` (default); `_modified = false` | idem | 4 testes |
| 16.1.2.3 | ⚠️ `clear(): void` — limpa lista; `_modified = true` | idem | 3 testes |
| 16.1.2.4 | ⚠️ `add(level): void` — valida `id` e `name` únicos (`TjError`); `_modified = true` | idem | 5 testes |
| 16.1.2.5 | ⚠️ `get modified(): boolean` | idem | 2 testes |
| 16.1.2.6 | ⚠️ `indexById(id): number` — retorna `-1` se não existe | idem | 4 testes |
| 16.1.2.7 | ⚠️ `indexByName(name): number` | idem | 3 testes |
| 16.1.2.8 | ⚠️ `indexByColor(color): number` | idem | 3 testes |
| 16.1.2.9 | ⚠️ `get(index): AlertLevelDefinition \| null` | idem | 3 testes |
| 16.1.2.10 | ⚠️ `map(fn): unknown[]` | idem | 2 testes |
| 16.1.2.11 | ⚠️ `to_tjp(): string` = `"alertlevels <level1>,\n<level2>,..."` | idem | 3 testes |
| 16.1.2.12 | Teste: default 3 níveis (`green`, `yellow`, `red`) | idem | 1 teste |
| 16.1.2.13 | Teste: `add` rejeita duplicata de id | idem | 1 teste |
| 16.1.2.14 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco B — Journal

### 16.2 — `JournalEntry` + `JournalEntryList`

**⚠️ RUBY: `Journal.rb` — `JournalEntry` + `JournalEntryList` (~250 linhas do total)**

**Pré-requisitos:** 16.1, Fase 5 (`PropertyTreeNode`, `Resource`), Fase 12 (`RichTextIntermediate`).

#### 16.2.1 — `JournalEntry`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.2.1.1 | Criar `packages/core/src/journal/journal-entry.ts` com `class JournalEntry` | idem | `deno check` |
| 16.2.1.2 | Campos: `readonly journal`, `readonly date: TjTime`, `readonly headline: string`, `readonly property: PropertyTreeNode \| null` | idem | `deno check` |
| 16.2.1.3 | Campos: `sourceFileInfo`, `author: Resource \| null`, `moderators: Resource[]` | idem | `deno check` |
| 16.2.1.4 | Campos: `summary: RichTextIntermediate \| null`, `details: RichTextIntermediate \| null` | idem | `deno check` |
| 16.2.1.5 | Campos: `alertLevel: number`, `flags: string[]`, `timeSheetRecord: unknown \| null` (stub Fase 18) | idem | `deno check` |
| 16.2.1.6 | ⚠️ Constructor `(journal, date, headline, property, sfi?)` — registra em `journal.addEntry(this)` | idem | 3 testes |
| 16.2.1.7 | Teste: campos opcionais iniciam `null`/`[]` | idem | 2 testes |
| 16.2.1.8 | ⚠️ `to_rText(query): string` — serializa em RichText markup | idem | 5 testes |
| 16.2.1.9 | Teste: `to_rText` com `alertLevel` | idem | 1 teste |
| 16.2.1.10 | Teste: `to_rText` com `author` | idem | 1 teste |
| 16.2.1.11 | Teste: `to_rText` com `summary`/`details` | idem | 1 teste |

#### 16.2.2 — `JournalEntryList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.2.2.1 | Criar `packages/core/src/journal/journal-entry-list.ts` com `class JournalEntryList` | idem | `deno check` |
| 16.2.2.2 | Campos: `private entries: JournalEntry[]`, `private sorted: boolean`, `private sortBy: [string, number][]` | idem | `deno check` |
| 16.2.2.3 | ⚠️ `count()`, `length()`, `empty()` | idem | 3 testes |
| 16.2.2.4 | ⚠️ `include(entry)`, `delete(entry)`, `deleteIf(pred)` | idem | 4 testes |
| 16.2.2.5 | ⚠️ `push(entry)`, `add(list)` | idem | 3 testes |
| 16.2.2.6 | ⚠️ `get(index)` — sorted | idem | 3 testes |
| 16.2.2.7 | ⚠️ `[Symbol.iterator]()` — sorted | idem | 2 testes |
| 16.2.2.8 | ⚠️ `first()` — sorted | idem | 2 testes |
| 16.2.2.9 | ⚠️ `last(date?)` — última entrada antes de `date` | idem | 4 testes |
| 16.2.2.10 | ⚠️ `setSorting(by)`, `sort()` | idem | 4 testes |
| 16.2.2.11 | Teste: sort por `date` | idem | 1 teste |
| 16.2.2.12 | Teste: sort por `alert` desc | idem | 1 teste |
| 16.2.2.13 | ⚠️ `unique()` | idem | 2 testes |
| 16.2.2.14 | Teste: `last()` sem data | idem | 1 teste |
| 16.2.2.15 | Teste: `last(date)` com data | idem | 1 teste |
| 16.2.2.16 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.3 — `Journal` (core + queries)

**⚠️ RUBY: `Journal.rb` — classe `Journal` (~250 linhas)**
**🔎 CHEAT: §3 `Hash.new { }`, §12 Categoria B (cache)**

**Pré-requisitos:** 16.2, Fase 7 (`DataCache`), Fase 11 (`Query`, `LogicalExpression`).

#### 16.3.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.3.1.1 | Criar `packages/core/src/journal/journal.ts` com `class Journal` | idem | `deno check` |
| 16.3.1.2 | Campos: `private entries: JournalEntryList`, `private propertyToEntries: Map<PropertyTreeNode, JournalEntryList>` | idem | `deno check` |
| 16.3.1.3 | ⚠️ `addEntry(entry): void` — se já está, retorna; senão, push em `entries` e em `propertyToEntries[entry.property]` (se não null) | idem | 4 testes |
| 16.3.1.4 | ⚠️ `getEntries(property): JournalEntryList \| null` | idem | 3 testes |
| 16.3.1.5 | ⚠️ `deleteIf(pred): void` | idem | 3 testes |

#### 16.3.2 — Consultas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.3.2.1 | ⚠️ `entriesByResource(resource, startDate?, endDate?, logExp?, task?, alertLevel?): JournalEntryList` | idem | 5 testes |
| 16.3.2.2 | ⚠️ `entriesByTask(task, startDate?, endDate?, logExp?, resource?, alertLevel?): JournalEntryList` | idem | 5 testes |
| 16.3.2.3 | ⚠️ `entriesByTaskR(task, startDate?, endDate?, logExp?, resource?, alertLevel?): JournalEntryList` — recursivo em children | idem | 4 testes |
| 16.3.2.4 | ⚠️ `entries(startDate?, endDate?, logExp?, property?, alertLevel?): JournalEntryList` | idem | 5 testes |

#### 16.3.3 — Alert level + current entries

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.3.3.1 | ⚠️ `alertLevel(date, property, query): number` — `currentEntriesR(date, property, 0, null, query)`; retorna max `alertLevel` | idem | 4 testes |
| 16.3.3.2 | Teste: `alertLevel` retorna max dos filhos | idem | 1 teste |
| 16.3.3.3 | ⚠️ `alertEntries(date, property, minLevel, minDate, query): JournalEntry[]` — filtra por `maxLevel` | idem | 4 testes |
| 16.3.3.4 | ⚠️ `currentEntries(date, property, minLevel, minDate, logExp): JournalEntryList` | idem | 4 testes |
| 16.3.3.5 | `currentEntries` — `getEntries(property).last(date)`; filtra por `minLevel`/`minDate` | idem | 3 testes |
| 16.3.3.6 | `currentEntries` — checa parents com data mais recente | idem | 3 testes |
| 16.3.3.7 | `currentEntries` — aplica `logExp` | idem | 2 testes |

#### 16.3.4 — `currentEntriesR` (recursivo com cache)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.3.4.1 | ⚠️ `currentEntriesR(date, property, minLevel, minDate, query): JournalEntryList` | idem | 1 teste |
| 16.3.4.2 | ⚠️ Cache via `DataCache.instance.cached(this, 'JournalCurrentEntriesR', date, property, minLevel, minDate, () => ...)` | idem | 3 testes |
| 16.3.4.3 | Recurso: pega de `getEntries(property).last(date)` | idem | 2 testes |
| 16.3.4.4 | Filtra por `minLevel`/`minDate` | idem | 2 testes |
| 16.3.4.5 | ⚠️ Reúne `children.currentEntriesR` + `startpreds` (se `journalMode` deps) | idem | 4 testes |
| 16.3.4.6 | Escolhe entre `pEntries` e `cEntries` (o mais recente) | idem | 3 testes |
| 16.3.4.7 | Aplica `query.hideJournalEntry` | idem | 2 testes |
| 16.3.4.8 | Teste: `currentEntriesR` com dependências | idem | 1 teste |
| 16.3.4.9 | Teste: `currentEntriesR` sem dependências (`status_down`) | idem | 1 teste |

#### 16.3.5 — `to_rti`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.3.5.1 | ⚠️ `to_rti(query): RichTextIntermediate \| null` — dispatch por `journalMode` | idem | 1 teste |
| 16.3.5.2 | ⚠️ Modo `journal`: `entriesByTask` ou `entriesByResource` ou `entries` | idem | 4 testes |
| 16.3.5.3 | ⚠️ Modo `journal_sub`: `entriesByTaskR` | idem | 2 testes |
| 16.3.5.4 | ⚠️ Modo `status_up`: `currentEntries` | idem | 2 testes |
| 16.3.5.5 | ⚠️ Modo `status_down` / `status_dep`: `currentEntriesR` | idem | 3 testes |
| 16.3.5.6 | ⚠️ Modo `alerts_down` / `alerts_dep`: `alertEntries` | idem | 3 testes |
| 16.3.5.7 | Sort + `to_rText` de cada entrada | idem | 3 testes |
| 16.3.5.8 | Concatena em `RichTextIntermediate` | idem | 2 testes |
| 16.3.5.9 | ⚠️ `private hidden(entry, logExp): boolean` | idem | 3 testes |
| 16.3.5.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — Leaves

### 16.4 — `Leave` + `LeaveList` + `LeaveAllowance`

**⚠️ RUBY: `LeaveList.rb` (arquivo inteiro — ~120 linhas)**
**🔎 CHEAT: §3 `Struct` → `class`, §12 Categoria B (priority)**

**Pré-requisitos:** Fase 2 (`TimeInterval`, `TjTime`).

#### 16.4.1 — `Leave`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.4.1.1 | Criar `packages/core/src/calendar/leave.ts` com `class Leave` | idem | `deno check` |
| 16.4.1.2 | ⚠️ `static readonly Types = { project: 1, annual: 2, special: 3, sick: 4, unpaid: 5, holiday: 6, unemployed: 7 }` | idem | 1 teste |
| 16.4.1.3 | Campos `readonly type: keyof typeof Types`, `readonly interval: TimeInterval`, `readonly reason: string \| null` | idem | `deno check` |
| 16.4.1.4 | ⚠️ Constructor `(type, interval, reason?)` — valida `type` em `Types` | idem | 4 testes |
| 16.4.1.5 | ⚠️ `typeIdx(): number` | idem | 3 testes |
| 16.4.1.6 | ⚠️ `to_s(): string` | idem | 2 testes |

#### 16.4.2 — `LeaveList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.4.2.1 | ⚠️ `class LeaveList extends Array<Leave>` | idem | `deno check` |
| 16.4.2.2 | Teste: `push` funciona | idem | 1 teste |

#### 16.4.3 — `LeaveAllowance` + `LeaveAllowanceList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.4.3.1 | Criar `class LeaveAllowance` com `type`, `date: TjTime`, `slots: number` | idem | `deno check` |
| 16.4.3.2 | ⚠️ Constructor `(type, date, slots)` — valida `type` | idem | 3 testes |
| 16.4.3.3 | `to_s()` | idem | 1 teste |
| 16.4.3.4 | ⚠️ `class LeaveAllowanceList extends Array<LeaveAllowance>` | idem | `deno check` |
| 16.4.3.5 | ⚠️ `balance(type, startDate, endDate): number` — soma `slots` onde `type` casa e `date` em `[start, end)` | idem | 5 testes |
| 16.4.3.6 | Teste: `balance` filtra por tipo | idem | 1 teste |
| 16.4.3.7 | Teste: `balance` filtra por data | idem | 1 teste |
| 16.4.3.8 | Teste: `slots` negativo subtrai | idem | 1 teste |
| 16.4.3.9 | Teste: `balance` soma múltiplos | idem | 1 teste |
| 16.4.3.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.5 — Substituir stubs de `LeaveList` (Fase 5)

**⚠️ Contexto:** Fase 5 deixou `LeaveList` e `LeaveAllowanceList` como `class extends Array<unknown>`. Agora substituímos.

**Pré-requisitos:** 16.4.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.5.1 | Atualizar `LeaveListAttribute` para usar `LeaveList` real | `packages/core/src/attributes/time/leave-list-attribute.ts` | `deno check` |
| 16.5.2 | Atualizar `LeaveAllowanceListAttribute` para usar `LeaveAllowanceList` real | `packages/core/src/attributes/time/leave-allowance-list-attribute.ts` | `deno check` |
| 16.5.3 | Atualizar `registerResourceAttributes` — `leaves` retorna `LeaveList` real; `leaveallowances` retorna `LeaveAllowanceList` real | `packages/core/src/model/attributes/resource-attributes.ts` | 3 testes |
| 16.5.4 | Atualizar `registerShiftAttributes` — `leaves` retorna `LeaveList` real | `packages/core/src/model/attributes/shift-attributes.ts` | 2 testes |
| 16.5.5 | ⚠️ `ShiftScenario.onLeave?` funciona com `Leave` real | `packages/core/src/model/shift-scenario.ts` | 4 testes |
| 16.5.6 | Re-rodar testes da Fase 5 | idem | verde |

---

## Bloco D — Utilitários

### 16.6 — `TextFormatter`

**⚠️ RUBY: `TextFormatter.rb` (arquivo inteiro — ~180 linhas)**
**🔎 CHEAT: §5 strings UTF-8, §12 Categoria B (width)**

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.6.1 | Criar `packages/core/src/utils/text-formatter.ts` com `class TextFormatter` | idem | `deno check` |
| 16.6.2 | Campos: `width`, `indentation`, `firstLineIndent` | idem | `deno check` |
| 16.6.3 | Constructor `(width = 80, indentation = 0, firstLineIndent?)` | idem | 3 testes |
| 16.6.4 | ⚠️ `indent(str): string` — adiciona `firstLineIndent` + `indentation`; trunca linhas maiores que `width` | idem | 5 testes |
| 16.6.5 | ⚠️ `format(str): string` — máquina de estados; quebra palavras | idem | 5 testes |
| 16.6.6 | Teste: `format` com parágrafos (`\n\n`) | idem | 1 teste |
| 16.6.7 | Teste: `format` com firstLineIndent | idem | 1 teste |
| 16.6.8 | Teste: `format` com UTF-8 (emoji) | idem | 2 testes |
| 16.6.9 | ⚠️ `private appendWord(): void` | idem | 2 testes |
| 16.6.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.7 — `FileList` + `FileRecord`

**⚠️ RUBY: `FileList.rb` (~80 linhas)**
**🔎 CHEAT: §12 Categoria B (`modified?` sempre `false`)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.7.1 | Criar `packages/core/src/utils/file-list.ts` com `class FileRecord` | idem | `deno check` |
| 16.7.2 | Campos: `readonly name: string` | idem | `deno check` |
| 16.7.3 | Constructor `(fileName)` | idem | 1 teste |
| 16.7.4 | ⚠️ `modified?(): boolean` — sempre `false` (browser) | idem | 2 testes |
| 16.7.5 | Criar `class FileList` com `private files: Map<string, FileRecord>` | idem | `deno check` |
| 16.7.6 | ⚠️ `add(fileName): void` — não duplica | idem | 3 testes |
| 16.7.7 | ⚠️ `get masterFile(): string \| null` — primeiro `.tjp` | idem | 3 testes |
| 16.7.8 | ⚠️ `[Symbol.iterator]()` | idem | 2 testes |

---

### 16.8 — `URLParameter`

**⚠️ RUBY: `URLParameter.rb` (~30 linhas)**
**🔎 CHEAT: §3 `Zlib::Deflate` → `fflate`, §5 Base64**

**Pré-requisitos:** `fflate` adicionado ao `deno.jsonc`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.8.1 | Adicionar `fflate` em `imports` (`npm:fflate@^0.8`) | `packages/core/deno.jsonc` | `deno check` |
| 16.8.2 | Criar `packages/core/src/utils/url-parameter.ts` com `class URLParameter` | idem | `deno check` |
| 16.8.3 | ⚠️ `static encode(data: string): string` — `zlib.deflate` + Base64 | idem | 3 testes |
| 16.8.4 | ⚠️ `static decode(data: string): string` — Base64 + `zlib.inflate` | idem | 3 testes |
| 16.8.5 | Teste: round-trip `encode` + `decode` | idem | 1 teste |
| 16.8.6 | Teste: string longa | idem | 1 teste |

---

### 16.9 — `TernarySearchTree`

**⚠️ RUBY: `TernarySearchTree.rb` (~180 linhas)**
**🔎 CHEAT: §3 recursão, §12 Categoria B (partial match)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.9.1 | Criar `packages/core/src/utils/ternary-search-tree.ts` com `class TernarySearchTree` | idem | `deno check` |
| 16.9.2 | Campos: `smaller`, `equal`, `larger`, `value`, `last` | idem | `deno check` |
| 16.9.3 | Constructor `(arg?: string \| string[])` | idem | 2 testes |
| 16.9.4 | ⚠️ `insert(str, index = 0): void` | idem | 3 testes |
| 16.9.5 | ⚠️ `find(str, partialMatch = false, index = 0): string \| string[] \| null` | idem | 5 testes |
| 16.9.6 | ⚠️ `length(): number` | idem | 2 testes |
| 16.9.7 | ⚠️ `maxDepth(depth = 0): number` | idem | 2 testes |
| 16.9.8 | ⚠️ `collect(str = null, fn): unknown[]` | idem | 3 testes |
| 16.9.9 | ⚠️ `toArray(): string[]` | idem | 2 testes |
| 16.9.10 | ⚠️ `balance(): void` | idem | 3 testes |
| 16.9.11 | ⚠️ `private clear()`, `private split(str)`, `private sortForBalancedTree(list)` | idem | 4 testes |
| 16.9.12 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.10 — `AlgorithmDiff`

**⚠️ RUBY: `AlgorithmDiff.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Array`, §12 Categoria B (LCS)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.10.1 | Criar `packages/core/src/utils/diff.ts` com `class Hunk` | idem | `deno check` |
| 16.10.2 | Campos: `aIdx`, `bIdx`, `insertValues`, `deleteValues` | idem | `deno check` |
| 16.10.3 | ⚠️ `insert?()`, `delete?()`, `to_s()` | idem | 3 testes |
| 16.10.4 | Criar `class Diff` com `constructor(a, b)` | idem | 2 testes |
| 16.10.5 | ⚠️ `private diff(a, b)` — LCS-like | idem | 3 testes |
| 16.10.6 | ⚠️ `private computeIndexTranslations(a, b)` | idem | 2 testes |
| 16.10.7 | ⚠️ `patch(values): unknown[]` | idem | 4 testes |
| 16.10.8 | ⚠️ `editScript(): string[]` | idem | 3 testes |
| 16.10.9 | ⚠️ `to_s(): string` — formato UNIX diff | idem | 3 testes |
| 16.10.10 | `interface Diffable` (`diff(b)`, `patch(diff)`) | idem | `deno check` |
| 16.10.11 | Teste: `diff` replace | idem | 1 teste |
| 16.10.12 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.11 — `StdIoWrapper`

**⚠️ RUBY: `StdIoWrapper.rb` (~60 linhas)**
**🔎 CHEAT: §7 `$stdout` → `console.log`, §12 Categoria B (limitações)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.11.1 | Criar `packages/core/src/utils/std-io-wrapper.ts` com `interface Results<T>` | idem | `deno check` |
| 16.11.2 | ⚠️ `stdIoWrapper<T>(stdIn: string \| null, fn: () => T): Results<T>` | idem | 1 teste |
| 16.11.3 | Salva `console.log` e `console.error` originais | idem | 2 testes |
| 16.11.4 | Substitui por captura | idem | 3 testes |
| 16.11.5 | ⚠️ `stdIn` injeta (no-op em browser) | idem | 1 teste |
| 16.11.6 | Restaura `console` após `fn()` | idem | 2 testes |

---

### 16.12 — `UTF8String` (no-op)

**⚠️ RUBY: `UTF8String.rb` (~150 linhas)**
**🔎 CHEAT: §5 strings UTF-8 nativas**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.12.1 | Criar `packages/core/src/utils/utf8.ts` | idem | `deno check` |
| 16.12.2 | ⚠️ `eachUtf8Char(str): IterableIterator<string>` = `for (const c of str) yield c` | idem | 2 testes |
| 16.12.3 | ⚠️ `lengthUtf8(str): number` = `[...str].length` | idem | 3 testes |
| 16.12.4 | ⚠️ `reverseUtf8(str): string` = `[...str].reverse().join('')` | idem | 3 testes |
| 16.12.5 | ⚠️ `ljust(str, len, pad = ' '): string` = `str.padEnd(len, pad)` | idem | 2 testes |
| 16.12.6 | ⚠️ `forceUTF8Encoding(str): string` = `str.normalize('NFC').replace(/\r\n/g, '\n')` | idem | 2 testes |
| 16.12.7 | Teste: UTF-8 com emoji | idem | 1 teste |
| 16.12.8 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 16.13 — `deepClone` (revisar)

**⚠️ Contexto:** Fase 3 implementou. Revisar cobertura com novos tipos.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.13.1 | Verificar `deepClone` em `Leave` (imutável → retorna `this`) | `packages/core/src/utils/deep-clone.ts` | 2 testes |
| 16.13.2 | Verificar `deepClone` em `AlertLevelDefinition` (imutável → retorna `this`) | idem | 1 teste |
| 16.13.3 | Verificar `deepClone` em `JournalEntry` (imutável → retorna `this`) | idem | 1 teste |
| 16.13.4 | Re-rodar testes da Fase 3 | idem | verde |

---

## Bloco E — Dev tools

### 16.14 — `KateSyntax`

**⚠️ RUBY: `KateSyntax.rb` (~250 linhas)**
**🔎 CHEAT: §3 `class_eval` → métodos explícitos**

**Pré-requisitos:** Fase 14 (`SyntaxReference` — stub).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.14.1 | Criar `packages/core/src/dev-tools/kate-syntax.ts` com `class KateSyntax` | idem | `deno check` |
| 16.14.2 | Campos: `private reference: SyntaxReference`, `private properties`, `private attributes` | idem | `deno check` |
| 16.14.3 | Constructor: cria `SyntaxReference` (Fase 14); separa properties de attributes | idem | 2 testes |
| 16.14.4 | ⚠️ `generate(file: string): void` — em browser: retorna XML em vez de escrever | idem | 3 testes |
| 16.14.5 | ⚠️ `private header()`, `footer()`, `keywords()`, `contexts()`, `highlights()` | idem | 5 testes |
| 16.14.6 | Teste: `generate` retorna XML com `<language>` | idem | 1 teste |

---

### 16.15 — `VimSyntax`

**⚠️ RUBY: `VimSyntax.rb` (~300 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.15.1 | Criar `packages/core/src/dev-tools/vim-syntax.ts` com `class VimSyntax` | idem | `deno check` |
| 16.15.2 | Análogo a `KateSyntax` | idem | 3 testes |
| 16.15.3 | ⚠️ `generate(file: string): void` — retorna conteúdo Vim | idem | 3 testes |
| 16.15.4 | ⚠️ `private header()`, `setLocal()`, `keywords()`, `matches()`, `regions()`, `highlights()` | idem | 6 testes |
| 16.15.5 | Teste: contém `syn keyword` | idem | 1 teste |
| 16.15.6 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco F — Integração (completar stubs)

### 16.16 — Completar `TaskScenario.query_*` (8 queries)

**⚠️ Contexto:** Fase 7 deixou stubs. Agora completamos com `Journal` (16.3).

**Pré-requisitos:** 16.3, Fase 7 (`TaskScenario`), Fase 11 (`Query`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.16.1 | ⚠️ `query_journal(query)` — `journal = project.get('journal') as Journal`; `query.rti = journal.to_rti(query)` | `packages/core/src/model/task-scenario.ts` | 3 testes |
| 16.16.2 | Remover `NotYetImplementedError` | idem | 1 teste |
| 16.16.3 | ⚠️ `query_alert(query)` — `alertLevel = journal.alertLevel(query.end, property, query)` | idem | 4 testes |
| 16.16.4 | `query.sortable = query.numerical = alertLevel` | idem | 2 testes |
| 16.16.5 | `levelRecord = project.get('alertLevels')[alertLevel]`; `query.string = levelRecord.name` | idem | 2 testes |
| 16.16.6 | `query.rti = RichText.new('<fcol:cor>name</fcol>').generateIntermediateFormat()` | idem | 2 testes |
| 16.16.7 | ⚠️ `query_alerttrend(query)` — compara 2 `alertLevel` | idem | 4 testes |
| 16.16.8 | `Up` / `Down` / `Flat` | idem | 3 testes |
| 16.16.9 | ⚠️ `query_alertmessages(query)` — `journal.alertEntries(query.end, property, 1, query.start, query)` | idem | 4 testes |
| 16.16.10 | `journalMessages(entries, query, true)` | idem | 2 testes |
| 16.16.11 | ⚠️ `query_alertsummaries(query)` — idem com `longVersion = false` | idem | 2 testes |
| 16.16.12 | ⚠️ `query_journalmessages(query)` — `journal.currentEntries(query.end, property, 0, query.start, query.hideJournalEntry)` | idem | 4 testes |
| 16.16.13 | ⚠️ `query_journalsummaries(query)` — idem com `longVersion = false` | idem | 2 testes |
| 16.16.14 | ⚠️ `private journalMessages(entries, query, longVersion): void` | idem | 3 testes |
| 16.16.15 | ⚠️ `private journalText(query, longVersion, recursive): void` | idem | 3 testes |
| 16.16.16 | Teste: `query_journal retorna rti` | idem | 1 teste |
| 16.16.17 | Teste: `query_alert green/yellow/red` | idem | 1 teste |
| 16.16.18 | Teste: `query_alerttrend Up/Down/Flat` | idem | 1 teste |
| 16.16.19 | Teste: `query_journalmessages` com entradas | idem | 1 teste |
| 16.16.20 | Teste: `query_journalsummaries` com entradas | idem | 1 teste |

---

### 16.17 — Completar `ResourceScenario.query_dashboard`

**⚠️ Contexto:** Fase 7 deixou stub.

**Pré-requisitos:** 16.3, Fase 7.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.17.1 | ⚠️ `query_dashboard(query)` — `scenarioIdx = project.get('trackingScenarioIdx')` | `packages/core/src/model/resource-scenario.ts` | 2 testes |
| 16.17.2 | Se `null`, retorna texto "No trackingscenario defined" | idem | 2 testes |
| 16.17.3 | Itera `project.tasks`; se `task.get('responsible', scIdx).includes(property)` e `journal.currentEntries(...)` não vazio, adiciona à lista | idem | 4 testes |
| 16.17.4 | Se lista vazia, retorna "no current status" | idem | 2 testes |
| 16.17.5 | Monta RichText com `task.query_alert` + `task.query_journalmessages` | idem | 3 testes |
| 16.17.6 | Remover `NotYetImplementedError` | idem | 1 teste |

---

### 16.18 — Completar `LogicalFlag.eval` e `LogicalFunction.hasalert`

**⚠️ Contexto:** Fase 11 deixou stubs.

**Pré-requisitos:** 16.3, Fase 11 (`LogicalFlag`, `LogicalFunction`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.18.1 | ⚠️ `LogicalFlag.eval(expr)` — se `query instanceof Query`: `query.property.get('flags', 0).includes(operand1)` | `packages/core/src/logic/logical-flag.ts` | 3 testes |
| 16.18.2 | ⚠️ Senão (JournalEntry): `expr.query.flags.includes(operand1)` | idem | 2 testes |
| 16.18.3 | Remover branch de `NotYetImplementedError` | idem | 1 teste |
| 16.18.4 | ⚠️ `LogicalFunction.hasalert(expr, args)` — `journal = project.get('journal')` | `packages/core/src/logic/logical-function.ts` | 2 testes |
| 16.18.5 | `entries = journal.currentEntries(query.end, property, args[0], query.start, query.hideJournalEntry)` | idem | 3 testes |
| 16.18.6 | Retorna `!entries.empty` | idem | 2 testes |
| 16.18.7 | Teste: `hasalert` com entrada | idem | 1 teste |
| 16.18.8 | Teste: `hasalert` sem entrada | idem | 1 teste |

---

## Bloco G — Golden tests

### 16.19 — Golden tests (Journal + Leaves)

**⚠️ RUBY: `Journal.rb` + `LeaveList.rb`**
**Usa:** `tj3` real via `docs/taskjuggler/`

**Pré-requisitos:** 16.3, 16.4.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.19.1 | Atualizar `scripts/golden/README.md` com seções de `journal` e `leaves` | idem | existe |
| 16.19.2 | Criar `scripts/golden/journal.rb` — cria `Journal`, adiciona entradas com alert levels, datas, autores, summary/details | idem | roda |
| 16.19.3 | Para cada `journalMode`, computa `to_rti` e extrai string | idem | 6 testes |
| 16.19.4 | Serializa em `journal.golden.json` | idem | JSON válido |
| 16.19.5 | Criar `scripts/golden/leaves.rb` — cria `Leave` com vários tipos | idem | roda |
| 16.19.6 | Testa `typeIdx`; testa `LeaveAllowanceList.balance` | idem | 4 testes |
| 16.19.7 | Serializa em `leaves.golden.json` | idem | JSON válido |
| 16.19.8 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 16.19.9 | Criar `packages/core/tests/golden/journal_golden_test.ts` e `leaves_golden_test.ts` | idem | verde |
| 16.19.10 | Cobertura ≥ 25 casos; commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco H — Verificação final

### 16.20 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 16.20.1 | `deno task check-all` verde | exit 0 |
| 16.20.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 16.20.3 | `grep -r "NotYetImplementedError" packages/core/src/journal/` = 0 | grep |
| 16.20.4 | `grep -r "NotYetImplementedError" packages/core/src/model/task-scenario.ts` — apenas queries de Fase 8/18 | ≤ 2 ocorrências |
| 16.20.5 | ADR 028 criada e commitada | git log |
| 16.20.6 | `Journal`, `JournalEntry`, `AlertLevelDefinitions`, `Leave`, `LeaveList`, `LeaveAllowance`, `TextFormatter`, `FileList`, `URLParameter`, `TernarySearchTree`, `AlgorithmDiff`, `StdIoWrapper`, `KateSyntax`, `VimSyntax` exportados em `packages/core/mod.ts` | `deno check` |
| 16.20.7 | `tests/integration/smoke_after_phase_16_test.ts` — cria `Journal`, adiciona 1 entrada, verifica `alertLevel`; verifica Fase 15 (Gantt HTML) | 1 teste |
| 16.20.8 | Auditoria: cada subfase do plano `fase-16-apoio.md` tem tarefas correspondentes | grep |
| 16.20.9 | Corrigir numeração em `fase-16-apoio.md` (`### 20.X` → `### 16.X`, `ADR 026` → `ADR 028`) | grep |
| 16.20.10 | Teste agregado: `TaskScenario.query_journal` retorna `RichTextIntermediate` com entradas | 1 teste |

---

## Notas para a IA

1. **Ordem:** 16.0 → 16.1 → 16.2 → 16.3 → 16.4 → 16.5 → 16.6 → 16.7 → 16.8 → 16.9 → 16.10 → 16.11 → 16.12 → 16.13 → 16.14 → 16.15 → 16.16 → 16.17 → 16.18 → 16.19 → 16.20.
2. **`Journal` completa stubs da Fase 14.** 8 queries + dashboard.
3. **`LeaveList` substitui stubs da Fase 5.** Re-rodar testes antigos.
4. **`currentEntriesR` usa cache.** `DataCache.cached`.
5. **`alertLevel` retorna max dos filhos.** Com hierarquia.
6. **`AlertLevelDefinition.to_s`** formato: `<id> '<name>' '<color>'`.
7. **`Leave.typeIdx`** é o índice do tipo (1–7).
8. **`LeaveAllowance.slots`** pode ser negativo (expiração).
9. **`TextFormatter` com UTF-8.** Usar `[...str]`.
10. **`URLParameter` depende de `fflate`.** Fixar versão.
11. **`TernarySearchTree`** é opcional (só `tj3man`).
12. **`UTF8String` é no-op.** Funções delegate.
13. **`StdIoWrapper` em browser** com limitações.
14. **`KateSyntax` / `VimSyntax`** em `dev-tools/`.
15. **`LogicalFlag`** distingue Query de JournalEntry.
16. **`hasalert`** usa `currentEntries`.
17. **Sem `any`.** Use `unknown` + narrowing.
18. **Commit por subfase.** `feat(core): journal`, etc.
19. **ADR 028** (não 026). **ADR 026** é reports (Fase 14), **ADR 027** é Gantt (Fase 15).
20. **Não tocar em Fase 14 (reports) além dos stubs de journal.**
21. **Não tocar em Fase 17 (HTML/XML).**
22. **Não tocar em Fase 18 (time sheets).** `TimeSheetRecord` é stub aqui.
23. **`JournalEntry.timeSheetRecord`** é `unknown | null` (stub).
24. **Não usar `Proxy`.**
25. **`AlertLevelDefinitions.add` valida `id` e `name` únicos.**

---

## Notas específicas por subfase

### 16.0 — ADR 028

- **Journal + AlertLevel.**
- **`Journal` no `Project`.**
- **Alert levels configuráveis.**

### 16.1 — AlertLevel

- **3 níveis default: green/yellow/red.**
- **`add` valida único.**

### 16.2 — JournalEntry

- **~10 campos.**
- **`to_rText` serializa markup.**
- **`JournalEntryList` ordenável.**

### 16.3 — Journal

- **`addEntry`, `getEntries`.**
- **`entriesByResource`, `entriesByTask`, `entriesByTaskR`, `entries`.**
- **`alertLevel`, `alertEntries`.**
- **`currentEntries`, `currentEntriesR` (recursivo com cache).**
- **`to_rti` com dispatch por `journalMode`.**

### 16.4 — Leave

- **7 tipos.**
- **`typeIdx` retorna o índice.**
- **`LeaveAllowanceList.balance` soma `slots`.**

### 16.5 — Substituir stubs

- **Re-rodar testes da Fase 5.**

### 16.6 — TextFormatter

- **`indent` + `format`.**
- **UTF-8.**

### 16.7 — FileList

- **`modified?` sempre `false`.**

### 16.8 — URLParameter

- **`fflate` para zlib.**
- **Base64.**

### 16.9 — TernarySearchTree

- **Inserção + find + balance.**

### 16.10 — AlgorithmDiff

- **LCS-like.**
- **`patch` + `editScript`.**

### 16.11 — StdIoWrapper

- **`console.log` + `console.error`.**
- **Browser: limitações.**

### 16.12 — UTF8String

- **Funções nativas.**

### 16.13 — deepClone

- **Revisar cobertura.**

### 16.14–16.15 — KateSyntax + VimSyntax

- **Dev tools.**
- **Em `dev-tools/`.**

### 16.16–16.18 — Integração

- **Completar 8 queries de `TaskScenario`.**
- **Completar `ResourceScenario.query_dashboard`.**
- **Completar `LogicalFlag` + `hasalert`.**

### 16.19 — Golden tests

- **Journal + Leaves.**
- **~25 casos.**

### 16.20 — Verificação

- **Sem stubs em `journal/`.**
- **ADR 028.**

---

**Fim do arquivo de tarefas da Fase 16.**