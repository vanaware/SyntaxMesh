# Fase 16 — Apoio

> **Arquivo:** `docs/syntaxmesh/fases/fase-16-apoio.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 8–10 dias
> **Depende de:** Fases 2–15
> **Bloqueia:** Fases 14 (Journal em reports), 21

---

## 1. Contexto

Esta fase completa **estruturas de apoio** que ficaram pendentes em fases anteriores:

1. **`Journal`** — sistema de entradas (journal entries) com alertas, resumos e detalhes. **Fase 14** deixou `query_journal`, `query_alert`, etc. como stubs. Aqui completamos.

2. **`AlertLevelDefinitions`** — níveis de alerta (green/yellow/red por padrão). Usado por `Journal` e por `query_alert`.

3. **`LeaveList`** — substitui os stubs da Fase 5 (`class LeaveList extends Array<unknown>`). Contém `Leave` e `LeaveAllowance`.

4. **`TernarySearchTree`** — árvore de busca ternária. Usada por `tj3man` (CLI) para busca de keywords.

5. **`AlgorithmDiff`** — algoritmo de diff (tipo UNIX `diff`). Usado em debugging e testes.

6. **`TextFormatter`** — formatação de texto (indentação, largura). Usada por `RichText` (Fase 12) e `KeywordDocumentation`.

7. **`FileList`** — lista de arquivos com mtime. No browser, mantém apenas os nomes (sem mtime).

8. **`URLParameter`** — encode/decode de strings para URLs. Usado pelo daemon (fora de escopo) e por `RTFReportLink` (Fase 14).

9. **`StdIoWrapper`** — captura de stdout/stderr. Adaptado para browser (limitação).

10. **`UTF8String`** — extensões de String. Em TS, usar nativo (`for (const c of str)`).

11. **`KateSyntax`** — gerador de syntax highlighting para Kate editor. Dev tool.

12. **`VimSyntax`** — gerador de syntax highlighting para Vim. Dev tool.

### Prioridade

- **Crítico:** `Journal`, `AlertLevelDefinitions`, `LeaveList`, `TextFormatter`, `FileList`.
- **Médio:** `URLParameter`, `TernarySearchTree`, `AlgorithmDiff`.
- **Baixa:** `StdIoWrapper`, `UTF8String`, `KateSyntax`, `VimSyntax`.

### Journal — Completação de stubs

A Fase 14 deixou 8 queries de `TaskScenario` como stubs:
- `query_journal`, `query_alert`, `query_alerttrend`, `query_alertmessages`, `query_alertsummaries`, `query_journalmessages`, `query_journalsummaries`, `query_dashboard` (ResourceScenario).

Esta fase as completa. Também completa `LogicalFlag.eval` para Journal (Fase 11) e `LogicalFunction.hasalert` (Fase 11).

### LeaveList — Substituição de stubs

A Fase 5 deixou `LeaveList` e `LeaveAllowanceList` como stubs. Aqui implementamos de verdade.

### Browser e UTF8String

Em Ruby, `UTF8String` estende `String` com `each_utf8_char`, `length_utf8`, `reverse`, `ljust`, `forceUTF8Encoding`. Em TS moderno, isso é nativo:
- `for (const c of str)` itera por code points.
- `[...str].length` conta code points.
- `[...str].reverse().join('')` reverte.
- `str.padEnd(n)` para padding.

**Decisão:** `UTF8String` é **no-op**. Adaptações inline onde necessário.

---

## 2. Objetivo

Ao final desta fase:

- `JournalEntry` + `JournalEntryList` + `Journal` completos.
- `AlertLevelDefinition` + `AlertLevelDefinitions` completos.
- `Leave` + `LeaveList` + `LeaveAllowance` + `LeaveAllowanceList` completos.
- Stubs de `LeaveList` (Fase 5) substituídos.
- `TaskScenario.query_journal`, `query_alert`, etc. completos.
- `ResourceScenario.query_dashboard` completo.
- `LogicalFlag.eval` para Journal completo (Fase 11).
- `LogicalFunction.hasalert` completo (Fase 11).
- `TextFormatter` implementado.
- `FileList` adaptado.
- `URLParameter` implementado.
- `TernarySearchTree` implementado.
- `AlgorithmDiff` implementado.
- `StdIoWrapper` adaptado (browser: no-op ou limitação documentada).
- `UTF8String` no-op (nativo).
- `KateSyntax` + `VimSyntax` implementados (dev tools).
- **≥ 180 testes unitários** + **≥ 25 golden tests** (journal entries, leaves).
- ADR 027 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Journal.rb` | ~500 | **Alta** | **Crítica** |
| `AlertLevelDefinitions.rb` | ~120 | Baixa | **Crítica** |
| `LeaveList.rb` | ~120 | Baixa | **Crítica** |
| `TextFormatter.rb` | ~180 | Média | Alta |
| `FileList.rb` | ~80 | Baixa | Alta |
| `URLParameter.rb` | ~30 | Trivial | Média |
| `TernarySearchTree.rb` | ~180 | Média | Média |
| `AlgorithmDiff.rb` | ~250 | **Alta** | Média |
| `StdIoWrapper.rb` | ~60 | Baixa | Baixa |
| `UTF8String.rb` | ~150 | Trivial | Baixa (no-op) |
| `KateSyntax.rb` | ~250 | Média | Baixa |
| `VimSyntax.rb` | ~300 | Média | Baixa |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/10-blueprint-finance.md` | §1 AlertLevelDefinitions | Sistema de alerta |
| `docs/tj3-engine/11-blueprint-apoio.md` | §1.1 AlertLevelDefinitions | Detalhes |
| `docs/tj3-engine/11-blueprint-apoio.md` | §1.5 Journal | Journal completo |
| `docs/tj3-engine/11-blueprint-apoio.md` | §1.3 LeaveList | Leaves |
| `docs/tj3-engine/15-blueprint-others.md` | §2 TernarySearchTree | Árvore |
| `docs/tj3-engine/15-blueprint-others.md` | §3 deep_copy | — |

### 3.3 Casos de teste

- `docs/Learning/mwe006/tutorial.tjp` — journal entries.
- `docs/Learning/mwe005/tutorial.tjp` — vacation (leaves).
- `docs/taskjuggler/test/TestSuite/` — casos de tracking.

### 3.4 Golden tests

Scripts Ruby que rodam `tj3` em MWEs com journal/leaves e extraem valores.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `Journal` é parte do `Project`

`project['journal']` é uma instância de `Journal`. Já inicializado (Fase 9 — `Project` construtor).

### 4.2 `JournalEntry` — property é `PropertyTreeNode | null`

Em Ruby, `@property` pode ser `nil` (entrada global). Em TS, `PropertyTreeNode | null`.

### 4.3 `JournalEntryList` — Array com sorting

`JournalEntryList` é Array de entradas com sorting configurável. `sortBy: [attr, direction][]`.

**Sorting attributes:** `alert`, `date`, `seqno`.

### 4.4 `Journal.entriesByTaskR` — recursivo

Entradas da task + todas as sub-tasks.

### 4.5 `Journal.currentEntriesR` — recursivo com cache

Usa `DataCache` (Fase 7). Retorna as últimas entradas antes da data, considerando hierarquia e dependências.

**Importante:** comportamento diferente conforme `journalMode`:
- `status_down`: não considera dependências.
- `status_dep` / `alerts_dep`: considera `startpreds` com `onEnd = true`.

### 4.6 `TaskScenario.query_journal` — via `journal.to_rti`

`Journal.to_rti(query)` retorna `RichTextIntermediate`. `TaskScenario.query_journal` só delega.

### 4.7 `TaskScenario.query_alert` — via `journal.alertLevel`

`alertLevel = journal.alertLevel(query.end, property, query)`.

**Stub Fase 11:** `LogicalFunction.hasalert` retornava `false`. Fase 16 completa.

### 4.8 `TaskScenario.query_alerttrend` — compara 2 alertLevel

Compara `alertLevel(start)` com `alertLevel(end)`. Retorna `Up`/`Down`/`Flat`.

### 4.9 `TaskScenario.query_alertmessages` / `alertsummaries`

Via `journal.alertEntries(date, property, minLevel=1, start, query)`.

### 4.10 `TaskScenario.query_journalmessages` / `journalsummaries`

Via `journal.currentEntries(date, property, minLevel=0, start, hideJournalEntry)`.

### 4.11 `ResourceScenario.query_dashboard`

Para cada task onde resource é `responsible` e tem entradas currentes, gera dashboard.

### 4.12 `AlertLevelDefinition` — `Struct.new(:id, :name, :color)`

Em TS, `class AlertLevelDefinition` com 3 readonly fields.

### 4.13 `AlertLevelDefinitions` — lista com defaults

3 níveis por padrão (`green`, `yellow`, `red`). `modified` flag.

### 4.14 `Leave.Types` — mapa com 7 tipos

```
project: 1, annual: 2, special: 3, sick: 4, unpaid: 5, holiday: 6, unemployed: 7
```

Maior índice = maior prioridade.

### 4.15 `LeaveList` — Array<Leave>

Sem lógica especial.

### 4.16 `LeaveAllowance` — `Struct.new(:type, :date, :slots)`

`slots` pode ser negativo (expiração).

### 4.17 `TextFormatter` — formatação de texto

`indent(str)` e `format(str)`. Algoritmo de quebra de linha + indentação.

**Uso:** `RichText.to_s`, `KeywordDocumentation`.

### 4.18 `FileList` — browser

Em Ruby, `FileRecord` guarda `mtime`. Browser não tem. **Decisão:** `FileRecord` guarda só o nome; `modified?` retorna `false`.

### 4.19 `URLParameter` — Zlib + Base64

Ruby: `Zlib::Deflate` + Base64. TS: usar `pako` ou `fflate` para zlib + `btoa`/`atob`.

**Decisão:** usar `fflate` (leve, TS-native).

### 4.20 `TernarySearchTree` — Array de strings

Estrutura de dados. Implementar fielmente.

### 4.21 `AlgorithmDiff` — algoritmo de diff

Implementar `Diff`, `Hunk`, `Diffable`. Algoritmo LCS-like.

### 4.22 `StdIoWrapper` — browser

Em Ruby, redireciona `$stdout`, `$stderr`, `$stdin`. Browser não tem. **Decisão:** implementar mas com limitações (só captura `console.log`).

**Uso real:** apenas `TimeSheetSummary.getResourceJournal` (Fase 18). Pode ser ajustado.

### 4.23 `UTF8String` — no-op

Em TS, usar nativo. Sem classe.

**Alternativa:** exportar funções `eachUtf8Char`, `lengthUtf8`, `reverseUtf8` que delegam para nativo.

### 4.24 `KateSyntax` + `VimSyntax` — dev tools

Geradores de arquivos de syntax highlighting. Não são parte do engine. **Decisão:** implementar em `packages/core/src/dev-tools/`.

### 4.25 `deep_copy` — `deepClone` utility

Já implementado na Fase 3 (`deep-clone.ts`).

---

## 5. Subfases detalhadas

**Bloco A — Journal** (20.0–20.5)
**Bloco B — Leaves** (20.6–20.7)
**Bloco C — Utilitários** (20.8–20.13)
**Bloco D — Dev tools** (20.14–20.15)
**Bloco E — Integração e stubs** (20.16–20.18)
**Bloco F — Golden tests** (20.19)

---

### Bloco A — Journal

---

### 20.0 — ADR 027 (Journal e AlertLevel)

#### Contexto

O `Journal` é central para tracking de projetos. Registra entradas com data, autor, alert level, resumo, detalhes. Combinado com `AlertLevelDefinitions`, forma o sistema de alertas (green/yellow/red).

Três decisões importantes:

1. **`Journal` é parte de `Project`** (inicializado no construtor).
2. **`JournalEntry.property` pode ser `null`** (entrada global).
3. **Alert levels são configuráveis** (default: 3).

#### Objetivo

Criar `docs/syntaxmesh/decisoes/027-journal-alertlevel.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/027-journal-alertlevel.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** Journal + AlertLevel; uso em tracking.
- [ ] **Decisões:**
  - `Journal` no `Project` (Fase 9 já preparou).
  - `JournalEntry.property` é `PropertyTreeNode | null`.
  - Alert levels configuráveis.
- [ ] **Consequências:** sistema de tracking completo; queries de journal.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/tj3-engine/11-blueprint-apoio.md` — §1.1, §1.5.

#### Critério de aceite

- ADR 027 criado.
- Tabela atualizada.

---

### 20.1 — `AlertLevelDefinitions`

#### Contexto

Níveis de alerta configuráveis. Default: green, yellow, red.

#### Objetivo

Implementar `AlertLevelDefinition` + `AlertLevelDefinitions`.

#### Arquivos

- `packages/core/src/journal/alert-level.ts`
- `packages/core/tests/journal/alert-level_test.ts`

#### Requisitos

**`AlertLevelDefinition`:**

- [ ] `class AlertLevelDefinition`:
  - `readonly id: string`
  - `readonly name: string`
  - `readonly color: string`
- [ ] Constructor `(id, name, color)`.
- [ ] `to_s(): string` → `"<id> '<name>' '<color>'"`.

**`AlertLevelDefinitions`:**

- [ ] `class AlertLevelDefinitions`:
  - `private levels: AlertLevelDefinition[]`
  - `private _modified: boolean`
- [ ] Constructor:
  - Adiciona `green`, `yellow`, `red` (default).
  - `_modified = false`.
- [ ] `clear(): void` — `_modified = true`.
- [ ] `add(level): void`:
  - Valida que `id` e `name` são únicos.
  - `_modified = true`.
- [ ] `get modified(): boolean`.
- [ ] `indexById(id): number` — retorna `-1` se não existe.
- [ ] `indexByName(name): number`.
- [ ] `indexByColor(color): number`.
- [ ] `get(index): AlertLevelDefinition | null`.
- [ ] `map(fn): unknown[]`.
- [ ] `to_tjp(): string` → `"alertlevels <level1>,\n<level2>,..."`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.1.

#### Critério de aceite

```ts
const al = new AlertLevelDefinitions();
assertEquals(al.get(0)?.id, 'green');
assertEquals(al.get(1)?.id, 'yellow');
assertEquals(al.get(2)?.id, 'red');
assertEquals(al.modified, false);
assertEquals(al.indexById('yellow'), 1);
```

#### Testes

- `alert-level_test.ts`:
  - `describe("AlertLevelDefinition")`
    - `it("constructor")`.
    - `it("to_s")`.
  - `describe("AlertLevelDefinitions")`
    - `it("default 3 níveis")`.
    - `it("modified false por padrão")`.
    - `it("clear")`.
    - `it("add")`.
    - `it("add rejeita duplicata")`.
    - `it("indexById")`.
    - `it("indexByName")`.
    - `it("indexByColor")`.
    - `it("get")`.
    - `it("map")`.
    - `it("to_tjp")`.

---

### 20.2 — `JournalEntry` + `JournalEntryList`

#### Contexto

`JournalEntry` é uma entrada. `JournalEntryList` é lista ordenável.

#### Objetivo

Implementar ambos.

#### Arquivos

- `packages/core/src/journal/journal-entry.ts`
- `packages/core/src/journal/journal-entry-list.ts`
- `packages/core/tests/journal/journal-entry_test.ts`

#### Requisitos

**`JournalEntry`:**

- [ ] `class JournalEntry`:
  - `readonly journal: Journal`
  - `readonly date: TjTime`
  - `readonly headline: string`
  - `readonly property: PropertyTreeNode | null`
  - `sourceFileInfo: SourceFileInfo | null`
  - `author: Resource | null`
  - `moderators: Resource[]`
  - `summary: RichTextIntermediate | null`
  - `details: RichTextIntermediate | null`
  - `alertLevel: number`
  - `flags: string[]`
  - `timeSheetRecord: TimeSheetRecord | null` (stub Fase 18)
- [ ] Constructor `(journal, date, headline, property, sfi?)`:
  - Registra em `journal.addEntry(this)`.
- [ ] `to_rText(query): string` — serializa em RichText markup.

**`JournalEntryList`:**

- [ ] `class JournalEntryList`:
  - `private entries: JournalEntry[]`
  - `private sorted: boolean`
  - `private sortBy: [string, number][]`
- [ ] `count()`, `length()`, `empty()`, `include(entry)`, `delete(entry)`, `deleteIf(pred)`.
- [ ] `push(entry)`, `add(list)`.
- [ ] `get(index)` — sorted.
- [ ] `[Symbol.iterator]()` — sorted.
- [ ] `first()` — sorted.
- [ ] `last(date?)` — última entrada antes de `date`.
- [ ] `setSorting(by)`.
- [ ] `sort()`.
- [ ] `unique()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Journal.rb` — `JournalEntry`, `JournalEntryList`.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.5.

#### Critério de aceite

Análogo.

#### Testes

- `journal-entry_test.ts`:
  - `describe("JournalEntry")`
    - `it("constructor registra em journal")`.
    - `it("to_rText com alert level")`.
    - `it("to_rText com author")`.
    - `it("to_rText com summary/details")`.
  - `describe("JournalEntryList")`
    - `it("push")`.
    - `it("sort por date")`.
    - `it("sort por alert desc")`.
    - `it("last date")`.
    - `it("last sem date")`.

---

### 20.3 — `Journal` (core)

#### Contexto

Container de entradas. Provê métodos de consulta.

#### Objetivo

Implementar `Journal` core.

#### Arquivos

- `packages/core/src/journal/journal.ts`
- `packages/core/tests/journal/journal_test.ts`

#### Requisitos

- [ ] `class Journal`:
  - `private entries: JournalEntryList`
  - `private propertyToEntries: Map<PropertyTreeNode, JournalEntryList>`
- [ ] `addEntry(entry): void`:
  - Se já está, retorna.
  - Push em `entries` e em `propertyToEntries[entry.property.ptn]` (se não null).
- [ ] `getEntries(property): JournalEntryList | null`.
- [ ] `deleteIf(pred): void`.
- [ ] `entriesByResource(resource, startDate?, endDate?, logExp?, task?, alertLevel?): JournalEntryList`.
- [ ] `entriesByTask(task, startDate?, endDate?, logExp?, resource?, alertLevel?): JournalEntryList`.
- [ ] `entriesByTaskR(task, startDate?, endDate?, logExp?, resource?, alertLevel?): JournalEntryList`:
  - Chama `entriesByTask` + recursivo em children.
- [ ] `entries(startDate?, endDate?, logExp?, property?, alertLevel?): JournalEntryList`.
- [ ] `alertLevel(date, property, query): number`:
  - `currentEntriesR(date, property, 0, null, query)`.
  - Max `alertLevel`.
- [ ] `alertEntries(date, property, minLevel, minDate, query): JournalEntry[]`:
  - `currentEntriesR(...)`.
  - Filtra por `maxLevel`.
- [ ] `currentEntries(date, property, minLevel, minDate, logExp): JournalEntryList`:
  - `getEntries(property).last(date)`.
  - Filtra por minLevel/minDate.
  - Checa parents com data mais recente.
  - Aplica `logExp`.
- [ ] `currentEntriesR(date, property, minLevel, minDate, query): JournalEntryList`:
  - Cache via `DataCache`.
  - Recurso: pega de `getEntries(property).last(date)`.
  - Filtra.
  - Reúne `children.currentEntriesR` + `startpreds` (se `journalMode` deps).
  - Escolhe entre `pEntries` e `cEntries`.
  - Aplica `query.hideJournalEntry`.
- [ ] `to_rti(query): RichTextIntermediate | null`:
  - Dispatch por `journalMode`.
  - `journal`: `entriesByTask` ou `entriesByResource` ou `entries`.
  - `journal_sub`: `entriesByTaskR`.
  - `status_up`: `currentEntries`.
  - `status_down` / `status_dep`: `currentEntriesR`.
  - `alerts_down` / `alerts_dep`: `alertEntries`.
  - Sort + `to_rText` de cada entrada.
  - Concatena.
  - Converte em `RichTextIntermediate`.
- [ ] Private `hidden(entry, logExp): boolean` — `logExp.eval(entry)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Journal.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.5.

#### Critério de aceite

Análogo.

#### Testes

- `journal_test.ts`:
  - `describe("Journal")`
    - `it("addEntry")`.
    - `it("deleteIf")`.
    - `it("entriesByResource")`.
    - `it("entriesByTask")`.
    - `it("entriesByTaskR recursivo")`.
    - `it("entries com filtros")`.
    - `it("alertLevel retorna max")`.
    - `it("alertEntries com minLevel")`.
    - `it("currentEntries pega último")`.
    - `it("currentEntries considera parents")`.
    - `it("currentEntriesR com cache")`.
    - `it("currentEntriesR com dependências")`.
    - `it("to_rti journalMode journal")`.
    - `it("to_rti journalMode status_down")`.
    - `it("to_rti journalMode alerts_down")`.

---

### 20.4 — `Leave` + `LeaveList` + `LeaveAllowance`

#### Contexto

Substitui os stubs da Fase 5.

#### Objetivo

Implementar as 4 classes.

#### Arquivos

- `packages/core/src/calendar/leave.ts`
- `packages/core/tests/calendar/leave_test.ts`

#### Requisitos

**`Leave`:**

- [ ] `class Leave`:
  - `static readonly Types = { project: 1, annual: 2, special: 3, sick: 4, unpaid: 5, holiday: 6, unemployed: 7 }`.
  - `readonly type: keyof typeof Types`
  - `readonly interval: TimeInterval`
  - `readonly reason: string | null`
- [ ] Constructor `(type, interval, reason?)`:
  - Valida `type` em `Types`.
- [ ] `typeIdx(): number`.
- [ ] `to_s(): string`.

**`LeaveList`:**

- [ ] `class LeaveList extends Array<Leave>`.

**`LeaveAllowance`:**

- [ ] `class LeaveAllowance`:
  - `readonly type: keyof typeof Types`
  - `readonly date: TjTime`
  - `readonly slots: number`
- [ ] Constructor `(type, date, slots)`:
  - Valida `type`.
- [ ] `to_s()`.

**`LeaveAllowanceList`:**

- [ ] `class LeaveAllowanceList extends Array<LeaveAllowance>`.
- [ ] `balance(type, startDate, endDate): number`:
  - Soma `slots` onde `type` casa e `date` em `[start, end)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LeaveList.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.3.

#### Critério de aceite

```ts
const l = new Leave('holiday', new TimeInterval(t1, t2), 'Christmas');
assertEquals(l.typeIdx(), 6);

const list = new LeaveList();
list.push(l);

const allowances = new LeaveAllowanceList();
allowances.push(new LeaveAllowance('annual', t1, 10));
assertEquals(allowances.balance('annual', t1.minus(1), t2.plus(1)), 10);
```

#### Testes

- `leave_test.ts`:
  - `describe("Leave")`
    - `it("constructor")`.
    - `it("typeIdx")`.
    - `it("rejeita type inválido")`.
    - `it("to_s com reason")`.
  - `describe("LeaveList")`
    - `it("push")`.
  - `describe("LeaveAllowance")`
    - `it("constructor")`.
    - `it("rejeita type inválido")`.
  - `describe("LeaveAllowanceList")`
    - `it("balance soma slots")`.
    - `it("balance filtra por tipo")`.
    - `it("balance filtra por data")`.
    - `it("slots negativo subtrai")`.

---

### 20.5 — Substituir stubs de `LeaveList`

#### Contexto

Fase 5 deixou `LeaveList` e `LeaveAllowanceList` como `class extends Array<unknown>`. Agora substituímos.

#### Objetivo

Substituir stubs.

#### Arquivos

- `packages/core/src/model/attributes/time/leave-list-attribute.ts` (atualizar)
- `packages/core/src/model/attributes/time/leave-allowance-list-attribute.ts` (atualizar)
- `packages/core/src/model/attributes/resource-attributes.ts` (atualizar)
- `packages/core/src/model/attributes/shift-attributes.ts` (atualizar)
- Testes existentes (Fase 5) — re-rodar.

#### Requisitos

- [ ] `LeaveListAttribute` usa `LeaveList` real.
- [ ] `LeaveAllowanceListAttribute` usa `LeaveAllowanceList` real.
- [ ] `Resource.leaves` retorna `LeaveList`.
- [ ] `Shift.leaves` idem.
- [ ] `ShiftScenario.onLeave?` funciona com `Leave` real.

#### Referências

- Fase 5.

#### Critério de aceite

- `deno task test` verde.

#### Testes

- Testes existentes da Fase 5.

---

### Bloco B — Utilitários

---

### 20.6 — `TextFormatter`

#### Contexto

Formatação de texto com indentação e largura.

#### Objetivo

Implementar `TextFormatter`.

#### Arquivos

- `packages/core/src/utils/text-formatter.ts`
- `packages/core/tests/utils/text-formatter_test.ts`

#### Requisitos

- [ ] `class TextFormatter`:
  - `width: number`
  - `indentation: number`
  - `firstLineIndent: number`
- [ ] Constructor `(width = 80, indentation = 0, firstLineIndent?)`.
- [ ] `indent(str: string): string`.
- [ ] `format(str: string): string`.
- [ ] Private `appendWord(): void`.

**Algoritmo `format`:**
- Máquina de estados: `beginOfParagraph`, `inWord`, `betweenWords`, `betweenWordsOrLines`.
- Quebra palavras que excedem `width`.
- Adiciona `firstLineIndent` no início, `indentation` nas demais linhas.

**`indent`:**
- Adiciona `firstLineIndent` na primeira linha, `indentation` nas demais.
- Trunca linhas maiores que `width`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextFormatter.rb` — arquivo completo.

#### Critério de aceite

```ts
const fmt = new TextFormatter(20, 2);
const result = fmt.format("Hello world this is a long text that wraps.");
assert(result.includes('\n'));
```

#### Testes

- `text-formatter_test.ts`:
  - `it("indent")`.
  - `it("indent com firstLineIndent")`.
  - `it("indent trunca")`.
  - `it("format simples")`.
  - `it("format com quebra")`.
  - `it("format com parágrafos")`.
  - `it("format com firstLineIndent")`.

---

### 20.7 — `FileList` + `FileRecord`

#### Contexto

Lista de arquivos com detecção de modificação. No browser, simplificado.

#### Objetivo

Implementar com limitações.

#### Arquivos

- `packages/core/src/utils/file-list.ts`
- `packages/core/tests/utils/file-list_test.ts`

#### Requisitos

- [ ] `class FileRecord`:
  - `readonly name: string`
- [ ] Constructor `(fileName)`.
- [ ] `modified?(): boolean` — sempre `false` (browser).
- [ ] `class FileList`:
  - `private files: Map<string, FileRecord>`
- [ ] `add(fileName): void`.
- [ ] `get masterFile(): string | null` — primeiro `.tjp`.
- [ ] `modified?(): boolean` — sempre `false`.
- [ ] `[Symbol.iterator]()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/FileList.rb`.

#### Critério de aceite

```ts
const fl = new FileList();
fl.add("proj.tjp");
fl.add("sub.tji");
assertEquals(fl.masterFile, "proj.tjp");
assertEquals(fl.modified?, false);
```

#### Testes

- `file-list_test.ts`:
  - `it("add")`.
  - `it("não duplica")`.
  - `it("masterFile pega .tjp")`.
  - `it("masterFile null se só .tji")`.
  - `it("modified? sempre false")`.

---

### 20.8 — `URLParameter`

#### Contexto

Encode/decode de strings para URLs. Usado por `RTFReportLink` (Fase 14).

#### Objetivo

Implementar `URLParameter`.

#### Arquivos

- `packages/core/src/utils/url-parameter.ts`
- `packages/core/tests/utils/url-parameter_test.ts`

#### Requisitos

- [ ] `URLParameter.encode(data: string): string`:
  - `zlib.deflate` (via `fflate`).
  - Base64 encode.
- [ ] `URLParameter.decode(data: string): string`:
  - Base64 decode.
  - `zlib.inflate`.

**Nota:** `fflate` é dependência.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/URLParameter.rb`.

#### Critério de aceite

```ts
const encoded = URLParameter.encode("Hello world");
const decoded = URLParameter.decode(encoded);
assertEquals(decoded, "Hello world");
```

#### Testes

- `url-parameter_test.ts`:
  - `it("encode/decode round-trip")`.
  - `it("encode de string longa")`.
  - `it("decode de base64 inválido lança")`.

---

### 20.9 — `TernarySearchTree`

#### Contexto

Estrutura de dados para strings com prefixos comuns. Usada por `tj3man`.

#### Objetivo

Implementar `TernarySearchTree`.

#### Arquivos

- `packages/core/src/utils/ternary-search-tree.ts`
- `packages/core/tests/utils/ternary-search-tree_test.ts`

#### Requisitos

- [ ] `class TernarySearchTree`:
  - `private smaller: TernarySearchTree | null`
  - `private equal: TernarySearchTree | null`
  - `private larger: TernarySearchTree | null`
  - `private value: string | null`
  - `private last: boolean`
- [ ] Constructor `(arg?: string | string[])`.
- [ ] `insert(str, index = 0): void`.
- [ ] `find(str, partialMatch = false, index = 0): string | string[] | null`.
- [ ] `length(): number`.
- [ ] `maxDepth(depth = 0): number`.
- [ ] `collect(str = null, fn): unknown[]`.
- [ ] `toArray(): string[]`.
- [ ] `balance(): void`.
- [ ] Private `clear()`.
- [ ] Private `split(str)`.
- [ ] Private `sortForBalancedTree(list)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TernarySearchTree.rb` — arquivo completo.

#### Critério de aceite

```ts
const tree = new TernarySearchTree(['hello', 'help', 'world']);
assertEquals(tree.length(), 3);
assertEquals(tree.find('hello'), 'hello');
assertEquals(tree.find('hel', true), ['hello', 'help']);
```

#### Testes

- `ternary-search-tree_test.ts`:
  - `it("insert single")`.
  - `it("insert array")`.
  - `it("find exact")`.
  - `it("find partial")`.
  - `it("find não existe")`.
  - `it("length")`.
  - `it("toArray")`.
  - `it("balance")`.
  - `it("maxDepth")`.

---

### 20.10 — `AlgorithmDiff`

#### Contexto

Algoritmo de diff (UNIX-style). Usado em debugging.

#### Objetivo

Implementar `Diff`, `Hunk`, `Diffable`.

#### Arquivos

- `packages/core/src/utils/diff.ts`
- `packages/core/tests/utils/diff_test.ts`

#### Requisitos

- [ ] `class Hunk`:
  - `aIdx`, `bIdx`, `insertValues`, `deleteValues`.
  - `insert?()`, `delete?()`, `to_s()`.
- [ ] `class Diff`:
  - `constructor(a, b)`.
  - `patch(values): unknown[]`.
  - `editScript(): string[]`.
  - `to_s(): string`.
  - Private `diff(a, b)`.
  - Private `computeIndexTranslations(a, b)`.
- [ ] `Diffable` interface (`diff(b)`, `patch(diff)`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AlgorithmDiff.rb` — arquivo completo.

#### Critério de aceite

```ts
const d = new Diff([1, 2, 3], [1, 4, 3]);
const patched = d.patch([1, 2, 3]);
assertEquals(patched, [1, 4, 3]);
```

#### Testes

- `diff_test.ts`:
  - `it("diff igual")`.
  - `it("diff insert")`.
  - `it("diff delete")`.
  - `it("diff replace")`.
  - `it("patch")`.
  - `it("editScript")`.
  - `it("to_s formato UNIX")`.

---

### 20.11 — `StdIoWrapper`

#### Contexto

Captura de stdout/stderr. Limitado em browser.

#### Objetivo

Implementar com limitações documentadas.

#### Arquivos

- `packages/core/src/utils/std-io-wrapper.ts`
- `packages/core/tests/utils/std-io-wrapper_test.ts`

#### Requisitos

- [ ] `interface Results<T>`:
  - `returnValue: T`
  - `stdOut: string`
  - `stdErr: string`
- [ ] `stdIoWrapper<T>(stdIn: string | null, fn: () => T): Results<T>`:
  - Salva `console.log` e `console.error` originais.
  - Substitui por captura.
  - Se `stdIn`, injeta (no-op em browser).
  - Roda `fn`.
  - Restaura.
  - Retorna `{ returnValue, stdOut, stdErr }`.

**Limitação:** só captura `console.log`/`console.error` diretos. `console.info`/`warn` idem.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb`.

#### Critério de aceite

```ts
const results = stdIoWrapper(null, () => {
  console.log("hello");
  return 42;
});
assertEquals(results.returnValue, 42);
assertEquals(results.stdOut, "hello\n");
```

#### Testes

- `std-io-wrapper_test.ts`:
  - `it("captura console.log")`.
  - `it("captura console.error")`.
  - `it("restaura console após")`.
  - `it("returnValue")`.

---

### 20.12 — `UTF8String` (no-op)

#### Contexto

Em TS, UTF-8 é nativo. Não precisamos de `UTF8String`.

#### Objetivo

Exportar funções utilitárias que delegam para nativo.

#### Arquivos

- `packages/core/src/utils/utf8.ts`
- `packages/core/tests/utils/utf8_test.ts`

#### Requisitos

- [ ] `eachUtf8Char(str: string): IterableIterator<string>`:
  - `for (const c of str) yield c`.
- [ ] `lengthUtf8(str: string): number`:
  - `[...str].length`.
- [ ] `reverseUtf8(str: string): string`:
  - `[...str].reverse().join('')`.
- [ ] `ljust(str, len, pad = ' '): string`:
  - `str.padEnd(len, pad)`.
- [ ] `forceUTF8Encoding(str: string): string`:
  - `str.normalize('NFC').replace(/\r\n/g, '\n')`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/UTF8String.rb` — adaptação.

#### Critério de aceite

```ts
assertEquals(lengthUtf8("abc"), 3);
assertEquals(lengthUtf8("👍"), 1);
assertEquals(reverseUtf8("a👍b"), "b👍a");
```

#### Testes

- `utf8_test.ts`:
  - `it("eachUtf8Char")`.
  - `it("lengthUtf8 ASCII")`.
  - `it("lengthUtf8 emoji")`.
  - `it("reverseUtf8")`.
  - `it("ljust")`.
  - `it("forceUTF8Encoding")`.

---

### 20.13 — `deepClone` (revisitar)

#### Contexto

Já implementado na Fase 3. Revisar.

#### Objetivo

Garantir cobertura.

#### Arquivos

- `packages/core/src/utils/deep-clone.ts` (revisar)
- `packages/core/tests/utils/deep-clone_test.ts` (revisar)

#### Requisitos

- [ ] Verificar que `Leave`, `AlertLevelDefinition`, `JournalEntry` são clonados corretamente (ou retornam `this` se imutáveis).

#### Referências

- Fase 3.

#### Critério de aceite

- Testes passam.

---

### Bloco C — Dev tools

---

### 20.14 — `KateSyntax`

#### Contexto

Gerador de syntax highlighting para Kate editor. Dev tool.

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/dev-tools/kate-syntax.ts`
- `packages/core/tests/dev-tools/kate-syntax_test.ts`

#### Requisitos

- [ ] `class KateSyntax`:
  - `private reference: SyntaxReference`
  - `private properties: KeywordDocumentation[]`
  - `private attributes: KeywordDocumentation[]`
- [ ] Constructor:
  - Cria `SyntaxReference` (Fase 14).
  - Separa properties de attributes.
- [ ] `generate(file: string): void`:
  - Gera XML.
- [ ] Private `header()`, `footer()`, `keywords()`, `contexts()`, `highlights()`.

**Nota:** em browser, `generate` retorna string em vez de escrever arquivo.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/KateSyntax.rb`.

#### Critério de aceite

- Gera XML válido.

#### Testes

- `kate-syntax_test.ts`:
  - `it("generate retorna XML")`.
  - `it("XML contém properties")`.

---

### 20.15 — `VimSyntax`

#### Contexto

Gerador de syntax highlighting para Vim. Dev tool.

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/dev-tools/vim-syntax.ts`
- `packages/core/tests/dev-tools/vim-syntax_test.ts`

#### Requisitos

- [ ] `class VimSyntax`:
  - Análogo a KateSyntax.
- [ ] `generate(file: string): void`.
- [ ] Private `header()`, `setLocal()`, `keywords()`, `matches()`, `regions()`, `highlights()`.

**Nota:** em browser, retorna string.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/VimSyntax.rb`.

#### Critério de aceite

- Gera `.vim` válido.

#### Testes

- `vim-syntax_test.ts`:
  - `it("generate retorna conteúdo")`.
  - `it("contém syn keyword")`.

---

### Bloco D — Integração e stubs

---

### 20.16 — Completar `TaskScenario.query_journal` + `query_alert` + etc.

#### Contexto

Fase 14 deixou stubs. Agora completamos com Journal.

#### Objetivo

Substituir os 8 stubs.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (completar)
- `packages/core/tests/model/task-scenario-journal_test.ts`

#### Requisitos

- [ ] `query_journal(query)`:
  - `journal = project.get('journal') as Journal`.
  - `query.rti = journal.to_rti(query)`.
- [ ] `query_alert(query)`:
  - `alertLevel = journal.alertLevel(query.end, property, query)`.
  - `query.sortable = query.numerical = alertLevel`.
  - `levelRecord = project.get('alertLevels')[alertLevel]`.
  - `query.string = levelRecord.name`.
  - `query.rti = RichText.new('<fcol:cor>name</fcol>').generateIntermediateFormat()`.
- [ ] `query_alerttrend(query)`:
  - `startAlert = journal.alertLevel(query.start, property, query)`.
  - `endAlert = journal.alertLevel(query.end, property, query)`.
  - `startAlert < endAlert` → `Up`; `>` → `Down`; `==` → `Flat`.
- [ ] `query_alertmessages(query)`:
  - `journal.alertEntries(query.end, property, 1, query.start, query)`.
  - `journalMessages(entries, query, true)`.
- [ ] `query_alertsummaries(query)`:
  - Idem, com `journalMessages(..., false)`.
- [ ] `query_journalmessages(query)`:
  - `journal.currentEntries(query.end, property, 0, query.start, query.hideJournalEntry)`.
- [ ] `query_journalsummaries(query)`:
  - Idem, `longVersion = false`.
- [ ] Private `journalMessages(entries, query, longVersion): void`.
- [ ] Private `journalText(query, longVersion, recursive): void` (usado por `query_journal`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Task.rb` — `journalText`.
- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — `query_journal`, `query_alert`, etc.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-journal_test.ts`:
  - `it("query_journal retorna rti")`.
  - `it("query_alert green/yellow/red")`.
  - `it("query_alerttrend Up/Down/Flat")`.
  - `it("query_alertmessages")`.
  - `it("query_journalmessages")`.

---

### 20.17 — Completar `ResourceScenario.query_dashboard`

#### Contexto

Fase 14 deixou stub.

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (completar)
- `packages/core/tests/model/resource-scenario-dashboard_test.ts`

#### Requisitos

- [ ] `query_dashboard(query)`:
  - `scenarioIdx = project.get('trackingScenarioIdx')`.
  - Se null, retorna texto "No trackingscenario defined".
  - Itera `project.tasks`:
    - Se `task.get('responsible', scIdx).includes(property)` e `journal.currentEntries(...)` não vazio:
      - Adiciona à lista.
  - Se lista vazia, retorna "no current status".
  - Senão, monta RichText com `task.query_alert` + `task.query_journalmessages`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Resource.rb` — `dashboard`.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-dashboard_test.ts`:
  - `it("sem trackingScenario")`.
  - `it("sem entradas")`.
  - `it("com entradas")`.

---

### 20.18 — Completar `LogicalFlag.eval` e `LogicalFunction.hasalert`

#### Contexto

Fase 11 deixou stubs.

#### Objetivo

Completar.

#### Arquivos

- `packages/core/src/logic/logical-flag.ts` (completar)
- `packages/core/src/logic/logical-function.ts` (completar)
- `packages/core/tests/logic/logical-flag-journal_test.ts`

#### Requisitos

- [ ] `LogicalFlag.eval(expr)`:
  - Se `query instanceof Query`: `query.property.get('flags', 0).includes(operand1)`.
  - Senão (JournalEntry): `expr.query.flags.includes(operand1)`.
- [ ] `LogicalFunction.hasalert(expr, args)`:
  - `journal = project.get('journal')`.
  - `entries = journal.currentEntries(query.end, property, args[0], query.start, query.hideJournalEntry)`.
  - `!entries.empty`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb` — `LogicalFlag`.
- `docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb` — `hasalert`.

#### Critério de aceite

Análogo.

#### Testes

- `logical-flag-journal_test.ts`:
  - `it("LogicalFlag com Query")`.
  - `it("LogicalFlag com JournalEntry")`.
  - `it("hasalert com entrada")`.
  - `it("hasalert sem entrada")`.

---

### Bloco E — Golden tests

---

### 20.19 — Golden tests (journal + leaves)

#### Contexto

Validar contra `tj3`.

#### Objetivo

Scripts Ruby.

#### Arquivos

- `scripts/golden/journal.rb`
- `scripts/golden/leaves.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/journal.golden.json`
- `packages/core/tests/golden/leaves.golden.json`
- `packages/core/tests/golden/journal_golden_test.ts`
- `packages/core/tests/golden/leaves_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**`journal.rb`:**

- [ ] Cria `Journal`, adiciona entradas com alert levels, datas, autores, summary/details.
- [ ] Para cada `journalMode`, computa `to_rti` e extrai string.
- [ ] Serializa.

**`leaves.rb`:**

- [ ] Cria `Leave` com vários tipos.
- [ ] Testa `typeIdx`.
- [ ] Testa `LeaveAllowanceList.balance`.
- [ ] Serializa.

**Testes TS:**

- [ ] Compara.
- [ ] ≥ 25 casos.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/Learning/mwe005/`, `docs/Learning/mwe006/`.
- Fase 2, subfase 5.14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 25 casos.
- Todos passam.

#### Testes

- `journal_golden_test.ts`:
  - `describe("Golden Journal")` — itera.
- `leaves_golden_test.ts`:
  - `describe("Golden Leaves")` — itera.

---

## 6. Ordem de execução sugerida

```text
20.0  ADR 027
      ↓
20.1  AlertLevelDefinitions
20.2  JournalEntry + JournalEntryList
20.3  Journal
      ↓
20.4  Leave + LeaveList + LeaveAllowance
20.5  Substituir stubs de LeaveList
      ↓
20.6  TextFormatter
20.7  FileList
20.8  URLParameter
20.9  TernarySearchTree
20.10 AlgorithmDiff
20.11 StdIoWrapper
20.12 UTF8String
20.13 deepClone (revisar)
      ↓
20.14 KateSyntax
20.15 VimSyntax
      ↓
20.16 Completar TaskScenario query_*
20.17 Completar ResourceScenario query_dashboard
20.18 Completar LogicalFlag + hasalert
      ↓
20.19 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 16 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `Journal`, `AlertLevelDefinitions` completos.
- [ ] `Leave`, `LeaveList`, `LeaveAllowance` completos.
- [ ] Stubs de `LeaveList` substituídos.
- [ ] 8 queries de `TaskScenario` completadas.
- [ ] `ResourceScenario.query_dashboard` completo.
- [ ] `LogicalFlag.eval` para Journal completo.
- [ ] `LogicalFunction.hasalert` completo.
- [ ] `TextFormatter`, `FileList`, `URLParameter`, `TernarySearchTree`, `AlgorithmDiff`, `StdIoWrapper`, `UTF8String` completos.
- [ ] `KateSyntax`, `VimSyntax` completos.
- [ ] **≥ 180 testes unitários**.
- [ ] **≥ 25 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 027 criado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `Journal.currentEntriesR` com ciclos | Alto | Testes com grafos complexos |
| `Journal.to_rti` com many entries | Médio | Cache em `currentEntriesR` |
| `AlertLevelDefinitions` com redefinição | Médio | Testes com levels custom |
| `TextFormatter.format` com UTF-8 | Médio | Usar `[...str]` em vez de `str[i]` |
| `URLParameter` dependência `fflate` | Baixo | Fixar versão |
| `AlgorithmDiff` com listas grandes | Médio | Benchmarks |
| `StdIoWrapper` em browser | Baixo | Documentar limitações |
| `UTF8String` no-op | Baixo | Delegar para nativo |
| `KateSyntax`/`VimSyntax` sem `SyntaxReference` | Médio | Fase 14 implementa |
| `TaskScenario.query_journal` com property null | Médio | Aceitar entrada global |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Journal.rb`
- `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb`
- `docs/taskjuggler/lib/taskjuggler/LeaveList.rb`
- `docs/taskjuggler/lib/taskjuggler/TextFormatter.rb`
- `docs/taskjuggler/lib/taskjuggler/FileList.rb`
- `docs/taskjuggler/lib/taskjuggler/URLParameter.rb`
- `docs/taskjuggler/lib/taskjuggler/TernarySearchTree.rb`
- `docs/taskjuggler/lib/taskjuggler/AlgorithmDiff.rb`
- `docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb`
- `docs/taskjuggler/lib/taskjuggler/UTF8String.rb`
- `docs/taskjuggler/lib/taskjuggler/KateSyntax.rb`
- `docs/taskjuggler/lib/taskjuggler/VimSyntax.rb`

### Blueprints

- `docs/tj3-engine/11-blueprint-apoio.md` — §1
- `docs/tj3-engine/15-blueprint-others.md` — §2, §3

### Documentos do projeto

- `docs/syntaxmesh/decisoes/027-journal-alertlevel.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 14 — Reports** (`query_journal`, `query_alert`).
- **Fase 18 — Time/Status Sheets** (usa `Journal`).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **Journal completa stubs da Fase 14.** 8 queries + dashboard.
2. **LeaveList substitui stubs da Fase 5.** Re-rodar testes antigos.
3. **`currentEntriesR` usa cache.** `DataCache.cached`.
4. **`alertLevel` retorna max dos filhos.** Com hierarquia.
5. **`AlertLevelDefinition.to_s`** formato: `<id> '<name>' '<color>'`.
6. **`Leave.typeIdx`** é o índice do tipo (1-7).
7. **`LeaveAllowance.slots`** pode ser negativo (expiração).
8. **`TextFormatter` com UTF-8.** Usar `[...str]`.
9. **`URLParameter` depende de `fflate`.** Fixar versão.
10. **`TernarySearchTree`** é opcional (só `tj3man`).
11. **`UTF8String` é no-op.** Funções delegate.
12. **`StdIoWrapper` em browser** com limitações.
13. **`KateSyntax` / `VimSyntax`** em `dev-tools/`.
14. **`LogicalFlag`** distingue Query de JournalEntry.
15. **`hasalert`** usa `currentEntries`.
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(core): journal`, etc.

---

## 11. ADR 027 (referência rápida)

Criado como subfase 20.0. Conteúdo esperado:

- **Título:** Journal e AlertLevel
- **Contexto:** tracking de projetos; alertas green/yellow/red.
- **Decisões:**
  - `Journal` no `Project`.
  - `JournalEntry.property` é `PropertyTreeNode | null`.
  - Alert levels configuráveis.
- **Consequências:** sistema de tracking completo.

---

**Fim da Fase 16.**