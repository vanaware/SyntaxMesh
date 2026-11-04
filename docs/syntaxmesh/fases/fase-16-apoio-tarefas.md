# Fase 16 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-16-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-16-apoio.md`
> **Status:** 🟢 Concluída (2026-11-03; escopo ajustado pela varredura xray: 16.10 cancelada, 16.9/16.14/16.15 movidas para a Fase 22)
> **Total:** ~191 tarefas
> **Concluídas:** 16 subfases (16.0–16.8, 16.11–16.13, 16.17–16.20) + 16.6 e 16.16 herdadas prontas
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Journal,AlertLevelDefinitions,LeaveList,TernarySearchTree,AlgorithmDiff,TextFormatter,FileList,URLParameter,StdIoWrapper,UTF8String,KateSyntax,VimSyntax}.rb`

> **📌 Âncora — Complemento Fase 11 (2ª onda, §6.5/§6.6 de `fase-11-logical-complemento.md`):**
> ao implementar Journal, desenvolver: ramo **Journal do `LogicalFlag.eval`**
> (hoje só Query; `JournalEntry.flags: string[]` já existe no modelo),
> **`hasalert`** real (substitui o stub `NotYetImplementedError("16")`) e
> validação de flags de journalentry no `LogicalOperation`.

---

## 📋 Registro de progresso

> Registro das micro-etapas efetivamente executadas (teste a cada execução).
> Divergência de caminho: o subsistema de journal vive em
> `packages/core/src/model/` (convenção já usada por `journal.ts`,
> `alert-levels.ts` e `leave.ts` desde as Fases 10/12/14C), **não** em
> `packages/core/src/journal/` como o plano original previa. As células
> “arquivo” abaixo seguem o caminho real.

| Subfase | Estado | Evidência |
|---|---|---|
| 16.0 — ADR 029 | ✅ 2026-11-03 | `decisoes/029-journal-alertlevel.md` (Resumo/Contexto/5 Decisões/Alternativas/Consequências); `decisoes/README.md` 029 → Aceito |
| 16.1 — `AlertLevelDefinition`/`AlertLevelDefinitions` | ✅ 2026-11-03 | `model/alert-levels.ts` reescrito como classes (`to_s`, `clear`, `add` com unicidade, `indexById/Name/Color`, `map`, `to_tjp`, iterador); `parser/rules/project.ts` instancia `AlertLevelDefinition`; **7 passed (25 steps)** em `tests/model/alert-level-classes_test.ts` + `alert-levels_14c_test.ts` |
| 16.2 — `JournalEntryList` | ✅ 2026-11-03 | `model/journal-entry-list.ts` (`setSorting` validado, `get/first/last/uniq/sort`, `unsorted()` para preservar ordem de chegada nos relatórios); **22 steps** em `tests/model/journal-entry-list_test.ts` |
| 16.3 — `Journal` (queries + `to_rti`) | ✅ 2026-11-03 | `model/journal.ts`: `entryList`+`propertyToEntries`, `entriesByTask/TaskR/Resource/Material/Account`, `rangeEntries`, `to_rti` com 9 modos; índices renomeados para `indexBy*` e `entriesFor()` adicionado (`reports/rdo-report.ts` ajustado); **7 passed (31 steps)** em `tests/model/journal-queries_16_test.ts`; regressão `tests/reports/ tests/model/` → **152 passed (1242 steps)** |
| 16.16 — `TaskScenario.query_*` | ✅ herdada | `property-tree-node.ts` já expõe `query_journal/alert/alerttrend/alertmessages/alertsummaries/journalmessages/journalsummaries` |
| 16.4/16.5 — `Leave` + listas + atributos | ✅ 2026-11-03 | `model/leave.ts` reescrito (`LeaveTypes as const`, `LeaveType`/`isLeaveType`, `Leave.Types`, `typeIdx()` **método**, `to_s` usando `interval.to_s`, `LeaveAllowance#to_s`, `LeaveAllowanceList#to_tjp`); `LeaveListAttribute` tipado com `Leave`; `LeaveAllowanceListAttribute#to_tjp` real (removeu o stub de Fase 16); defaults `new LeaveList()`/`new LeaveAllowanceList()` em resource/shift; `resource-scenario.ts` troca a interface local por `Leave` + helper `leaveBoundIdx`; `deep-clone` preserva protótipo de subclasses de Array/Map/Set; **24 steps** em `tests/model/leave_test.ts` + 9 steps novos em `shift_test`/`resource_test`/`time-interval-attributes`; regressão `tests/model tests/attributes` → **97 passed (937 steps)** |
| 16.6 — `TextFormatter` | ✅ herdada | `utils/text-formatter.ts` (Fase 12) — sem pendências |
| 16.7 — `FileList`/`FileRecord` | ✅ 2026-11-03 | `utils/file-list.ts` (`add` ignora `.` e duplicatas, `push`, `has`, `get`, `records`, `masterFile` = primeiro nome `.tjp` com `length >= 4`, `modified()` **sempre `false`** — Category B); **2 passed (16 steps)** em `tests/utils/file-list_test.ts` |
| 16.8 — `URLParameter.decode` | ✅ 2026-11-03 | `deno.jsonc` do core ganhou `fflate@^0.8`; `utils/url-parameter.ts` mantém `encode` (stored-deflate determinístico + adler32) e ganhou `static decode` com `unzlibSync` + Base64 tolerante a espaços/quebras do `pack('m')`; fixtures geradas pelo Ruby real; **2 passed (10 steps)** em `tests/utils/url-parameter_test.ts` (decode de level-9 do Ruby, vazio, longa UTF-8) |
| 16.11 — `StdIoWrapper` | ✅ 2026-11-03 | `utils/std-io-wrapper.ts` (`interface Results<T>`, `stdIoWrapper(stdIn, fn)` troca `console.log`/`console.error`, restaura em `finally`, `returnValue = 1` em exceção, `stdIn` aceito e ignorado — Category B); **4 passed (12 steps)** em `tests/utils/std-io-wrapper_test.ts` |
| 16.12 — `UTF8String` (no-op) | ✅ 2026-11-03 | `utils/utf8.ts` com as 5 funções do plano (`eachUtf8Char`, `lengthUtf8`, `reverseUtf8`, `ljust`, `forceUTF8Encoding`); extras não previstos (`toBase64`/`unix2dos`/`toQuotedPrintable`) descartados por não terem consumidor e por `btoa` divergir do `pack64` UTF-8 do Ruby; **6 passed (14 steps)** em `tests/utils/utf8_test.ts` |
| 16.13 — `deepClone` (revisão) | ✅ 2026-11-03 | `Leave`/`LeaveAllowance`/`AlertLevelDefinition`/`JournalEntry` ganharam `deepClone(): this` (objetos-valor imutáveis; a entrada de journal é objeto de identidade que referencia o `Journal`, copiar arrastaria o grafo inteiro). `LeaveList` continua clonada como `LeaveList` (ramo de `Array` antes do método) compartilhando os `Leave`; **2 passed (18 steps)** em `tests/attributes/deep-clone_test.ts` |
| 16.17 — `query_dashboard` + 7 consultas de licença | ✅ 2026-11-03 | `resource-scenario.ts`: `collectLeaveIntervals(iv, type)` (folha, máscara `(v & 0x3E) === typeIdx << 2`), `query_annualleave`, `query_annualleavelist` (data + fração do dia), `query_annualleavebalance` (provisões − tomados), `query_sickleave`, `query_specialleave`, `query_timeoffdays`, `query_unpaidleave`; stubs de Fase 16 removidos (só `query_fte` segue ancorado na 18). **RUBY-COMPAT-FIX (Cat. A):** a tabela legada `LEAVE_TYPES` (`vacation:3` etc.) foi substituída por `Leave::Types` — ela não casava com o encoding `typeIdx() << 2` do scoreboard e zerava toda consulta por nome. `Resource#query_dashboard` porta `Resource.rb:45-99` (mensagem de `trackingscenario` ausente agora **é devolvida**, Cat. A: no Ruby era sobrescrita pelo ramo de lista vazia); **6 passed (22 steps)** em `tests/model/resource-queries_16_test.ts` + 2 steps novos em `tests/logic/query-resources_14c_test.ts` |
| 16.18 — `LogicalFlag` (journal) + `hasalert` | ✅ 2026-11-03 | `logic/logical-flag.ts`: ramo de journal implementado por duck-typing (`expr.query.flags` — o `LogicalExpression` recebe a `JournalEntry` em `journal.hideJournalEntry`), `to_s` idem; `NotYetImplementedError` removido. `logic/logical-function.ts`: `hasalert` usa `project.journal.currentEntries(query.end, property, Number(args[0]), query.start, query.hideJournalEntry)` e devolve `length > 0`. **5 passed (44 steps)** em `tests/logic/logical-attribute-flag_test.ts` + `logical-function_test.ts` (inclui `LogicalFlag` ocultando entrada real via `journal.rangeEntries`) |
| 16.19 — Golden tests (journal + leaves) | ✅ 2026-11-03 | `scripts/golden/journal.rb` (oracle: `Project` mínimo + 6 `JournalEntry`, `to_rti` por `journalMode`, texto plano do RTI) → `tests/golden/journal.golden.json` (**17 casos**, cobre os 7 modos, `selfContained`, `hideJournalEntry` e atributos compactos); `scripts/golden/leaves.rb` → `tests/golden/leaves.golden.json` (**19 casos**: 7 `typeIdx`, 3 `to_s`, ordem da `LeaveList`, 7 `balance`, 2 erros de tipo); registrados em `generate_golden.ts` (task `golden:generate`); `tests/golden/journal_golden_test.ts` compara texto plano com whitespace colapsado (tolerância 12.19.8) e `leaves_golden_test.ts` fixa UTC em `beforeAll`/`afterAll`. **2 passed (40 steps)**; **36 casos** no total (≥ 25 exigidos). README dos goldens ganhou as seções 16.19 |
| 16.20 — Verificação final | ✅ 2026-11-03 | `deno task check:all` exit 0 · `deno fmt --check` (642 arquivos) · `deno lint` (600 arquivos, 0 problemas) · `check:stubs` OK · **suíte 559 testes / 5542 passos / 0 falhas**. `NotYetImplementedError`: 0 em `model/journal.ts` — **não existe `src/journal/`** (desvio de caminho já registrado no topo) — e 0 em `task-scenario.ts`. ADR 029 commitada. Exports de `packages/core/mod.ts` verificados por `deno check`; duas colisões resolvidas no caminho: o `Journal` de `reports/i-calendar.ts` virou **`ICalJournal`** (o `Journal` do topo é o modelo da ADR 029) e o predicado numérico de `time/scoreboard-bits.ts` virou **`isScoreboardLeaveType`** (convive com `model/leave.ts#isLeaveType`). `StdIoWrapper` **não** existe como classe no port: o Ruby é módulo, então saem `stdIoWrapper` + `Results<T>` (16.20.6 atendido com esse nome). Smoke `tests/integration/smoke_after_phase_16_test.ts` — **3 passos**: entrada indexada + `alertLevel` 2 + nível default `red`; `TaskScenario.query_journal` devolve RTI `tj_journal` com `sectionNumbers=false` e o texto da entrada (16.20.10); Gantt da Fase 15 intacto (tabela + `taskbar`, sem SVG/Canvas). Auditoria 16.20.8: 16.0–16.19 têm seção correspondente no plano e a 16.20 só existe aqui. 16.20.9: `fase-16-apoio.md` já usa `### 16.X` e `ADR 029`. `deno task golden:generate` idempotente (12 goldens + extensões). **Dois flakes herdados corrigidos na verificação:** (a) `attribute-definitions` passou a comparar `LeaveList`/`LeaveAllowanceList` (subclasses de `Array` da 16.4) com o `[]` do Ruby via visão plana (`plainValue`); (b) **G10 da Fase 15** — `header.nowLineX` do golden de Gantt era o relógio da máquina (`TjTime.now().align(3600)`) e `depArrows` falhava sozinho horas após a geração; `gantt-common.rb` agora fixa `FROZEN_NOW = '2026-01-01'` (`report.set('now', …)`) e o teste reaplica o mesmo valor. `src/reports/rdo-report.ts` formatado e o alias `LeaveTypeLike` ajustado para `string & Record<never, never>` (regra `ban-types` do `deno lint`) |

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
2. **Bloco B** — `Journal` (`JournalEntry`, `JournalEntryList`, `Journal`). ⚠️ Incluir suporte ao elemento novo `picture`/`format` em `JournalEntry` — ver adendo **16.21**.
3. **Bloco C** — `Leave` + `LeaveList` + `LeaveAllowance` (substitui stubs da Fase 5).
4. **Bloco D** — utilitários (`TextFormatter`, `FileList`, `URLParameter`, `StdIoWrapper`, `UTF8String`). ⚠️ Escopo reduzido: desenvolver **apenas o core** de `URLParameter` e `StdIoWrapper`. **Adendo 2026-11-03 (xray):** `TernarySearchTree` (16.9) foi **MOVIDO** para a Fase 22 (`doc-core` 22.1b); `AlgorithmDiff` (16.10) foi **CANCELADO** (DEAD no upstream); `FileList` (16.7), `StdIoWrapper` (16.11) e `UTF8String` (16.12) permanecem no core e têm como **consumidor a Fase 24** (CLI — `fase-24-cli.md` §5.4; `StdIoWrapper` também F18).
5. **Bloco E** — núcleo de sintaxe para ferramentas externas (`SyntaxCore`). ⚠️ **Adendo 2026-11-03: MOVIDO inteiro para a Fase 22** (subfase 22.1b `doc-core`, que passa a possuir `SyntaxReference`/`KeywordDocumentation`/`TjpExample`/`UserManual` + este núcleo + o TST). Geradores finais `KateSyntax`/`VimSyntax` continuam **CANCELADOS**.
6. **Bloco F** — integração: completar 8 queries de `TaskScenario` + `ResourceScenario.query_dashboard` (**dono único: Fase 16** — âncora do código reancorada de 15 para 16 em 2026-11-03, xray §5.2) + `LogicalFlag.eval` + `LogicalFunction.hasalert`.
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
- **ADR 021** — Orquestrador e pipeline.
- **ADR 022** — FSM do TextParser.
- **ADR 023** — i18n de keywords.
- **ADR 024** — Expressões lógicas sem precedência.
- **ADR 025** — RichText e function handlers.
- **ADR 026** — Markdown going-forward.
- **ADR 027** — Reports no browser (strings).
- **ADR 028** — Gantt HTML+CSS.
- **ADR 029** — Journal e AlertLevel (**criado nesta fase**; já reservado no
  `decisoes/README.md`). Renumerado em 2026-11-03 — xray §5.3: o plano dizia
  “ADR 026/027/028” para esta decisão, mas esses números já pertencem a
  Markdown, Reports e Gantt. O ADR das **sheets** (email → texto/download) é
  **036** e o da injeção de `FileStore` é **037** (Fase 18).

### Convenções CRÍTICAS

- **`Journal` é parte do `Project`** (inicializado no construtor — Fase 9).
- **`JournalEntry.property` é `PropertyTreeNode | null`** (entrada global). . ver observação feita no arquivo fase-16-apoio.md
- **`AlertLevelDefinitions` default:** 3 níveis (`green`, `yellow`, `red`).
- **`currentEntriesR` usa `DataCache`.**
- **`alertLevel` retorna max dos filhos.**
- **`Leave.typeIdx`** é o índice do tipo (1–7).
- **`LeaveAllowance.slots`** pode ser negativo (expiração).
- **`TextFormatter` com UTF-8.** Usar `[...str]`.
- **`URLParameter` depende de `fflate`.** Fixar versão. Implementar **apenas o core** (encode/decode) — a Fase 22 usará funcionalidade parecida.
- **`TernarySearchTree`**: **MOVIDO para a Fase 22** (22.1b `doc-core`) em 2026-11-03 — não desenvolver nesta fase.
- **`UTF8String` é no-op.** Funções delegate. Consumidor: Fase 24 (CLI).
- **`StdIoWrapper`** implementar **apenas a função core** (captura de stdout/stderr); sem UI de browser. Consumidores: **Fase 18** (`TimeSheetSummary.getResourceJournal`) e **Fase 24** (apps de sheet — `ts/ss send`, 24.10.6).
- **`FileList`** (16.7): core no `utils/`; **consumidor a Fase 24** (rastreio de arquivos de entrada da CLI — xray §3, adendo 2026-11-03).
- **`KateSyntax` / `VimSyntax`**: geradores finais **CANCELADOS**; o núcleo (`SyntaxCore`, 16.14) foi **MOVIDO para a Fase 22** (22.1b `doc-core`).
- **`LogicalFlag`** distingue Query de JournalEntry.
- **`hasalert`** usa `currentEntries`.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ se precisar pode tocar em Fase 14 (reports) e ajustar
- ❌ Não tocar em Fase 17 (HTML/XML).
- ❌ Não tocar em Fase 18 (time sheets) — `TimeSheetRecord` é stub aqui.
- ❌ Não implementar `Leave` real na Fase 5 — só aqui.
- ❌ Não usar `Proxy`.
- ❌ Não implementar os **geradores finais** Kate/Vim (escrita de `.xml`/`.vim`) — CANCELADOS; só o núcleo `SyntaxCore` em `dev-tools/`.
- ❌ Não tratar `UTF8String` como classe — só funções.

---

## Progresso

```
[ ] 16.0  ADR 029 (Journal e AlertLevel)            —   0/5
[ ] 16.1  AlertLevelDefinition + AlertLevelDefinitions — 0/14
[ ] 16.2  JournalEntry + JournalEntryList           —   0/16
[ ] 16.3  Journal (core + queries)                  —   0/28
[ ] 16.4  Leave + LeaveList + LeaveAllowance        —   0/18
[ ] 16.5  Substituir stubs de LeaveList (Fase 5)    —   0/6
[x] 16.6  TextFormatter                             —  10/10  ✅ ANTECIPADA na Fase 12 (2026-10-28): dependência pura de `RichTextElement#to_s`; port fiel de `TextFormatter.rb:21-184` (`indent`/`format` FSM/`appendWord`, code points UTF-8), expectations conferidas contra o Ruby real; 15 testes em `tests/utils/text-formatter_test.ts`; exportado via `utils/mod.ts`
[ ] 16.7  FileList + FileRecord                     —   0/8   (consumidor: Fase 24 — §5.4)
[ ] 16.8  URLParameter                              —   0/6
[x] 16.9  TernarySearchTree (MOVIDO → F22 22.1b)    —   n/a   — decisão 2026-11-03 (xray §3.2): o núcleo de docs/sintaxe inteiro vive na Fase 22
[x] 16.10 AlgorithmDiff (CANCELADO — DEAD)          —   n/a   — decisão 2026-11-03 (xray §2.2): zero chamadores no upstream; ver §16.10
[ ] 16.11 StdIoWrapper                              —   0/6   (consumidores: Fase 18 + Fase 24)
[ ] 16.12 UTF8String (no-op)                        —   0/8   (consumidor: Fase 24)
[ ] 16.13 deepClone (revisar)                       —   0/4
[x] 16.14 SyntaxCore (MOVIDO → F22 22.1b)           —   n/a   — decisão 2026-11-03; 16.15 permanece CANCELADO
[x] 16.15 VimSyntax (CANCELADO → geradores finais)  —   n/a
[ ] 16.16 Completar TaskScenario query_* (8)        —   0/20
[x] 16.17 Completar ResourceScenario query_dashboard —  0/6   (dono único: F16; âncora em `resource.ts` reancorada de 15→16)
[x] 16.18 Completar LogicalFlag + hasalert          —   0/8
[x] 16.19 Golden tests (Journal + Leaves)           —   0/10
[x] 16.20 Verificação final                         —   0/10
─────────────────────────────────────────────────────────
TOTAL: ~191
```

---

## Bloco A — Fundação

### 16.0 — ADR 029 (Journal e AlertLevel)

**Objetivo:** formalizar o sistema de journal + alert levels.

**⚠️ Nota (corrigida 2026-11-03):** o plano usava `ADR 026`/`ADR 027`/`ADR 028` para
esta decisão em momentos diferentes. Na numeração real do repositório: **026** é
Markdown (Fase 13), **027** é reports no browser (Fase 14), **028** é Gantt (Fase 15)
e **029** está reservado a Journal e AlertLevel no `decisoes/README.md`. Aqui usamos
**ADR 029** (arquivo `decisoes/029-journal-alertlevel.md`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.0.1 | Criar `docs/syntaxmesh/decisoes/029-journal-alertlevel.md` com frontmatter | idem | arquivo existe |
| 16.0.2 | Seção **Contexto:** Journal + AlertLevel; uso em tracking; tracking de projetos | idem | — |
| 16.0.3 | Seção **Decisão 1:** `Journal` é parte do `Project` (Fase 9 já preparou) | idem | — |
| 16.0.4 | Seção **Decisão 2:** `JournalEntry.property` é `PropertyTreeNode \| null` (entrada global); **Decisão 3:** Alert levels configuráveis (default 3) | idem | — |
| 16.0.5 | **Alternativas** + **Consequências** (sistema de tracking completo); atualizar a linha `029` em `decisoes/README.md` (de “Proposto” para Aceito + data) | idem | linha 029 atualizada |

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

> **Escopo (anotação do plano, item 1):** além dos campos clássicos, `JournalEntry`
> deve prever suporte ao elemento novo **`picture`** (e `format`). Ver adendo **16.21**.

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

> **Escopo (anotação do plano, item 8):** desenvolver **apenas o core**
> (`encode`/`decode`). A Fase 22 reutilizará funcionalidade parecida (encoding de
> parâmetros para LSP / URLs).

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

> **MOVIDO (2026-11-03 — decisão do usuário sobre o xray §3.2):** desenvolvido
> na **Fase 22**, subfase **22.1b `doc-core`** (`@vanaware/syntaxmesh/doc-core`),
> junto com `SyntaxReference`/`KeywordDocumentation`/`TjpExample`/`UserManual`
> e o `SyntaxCore`. As 12 tarefas abaixo movem-se com a subfase (referência
> histórica mantida).

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

### 16.10 — `AlgorithmDiff` — **CANCELADO (2026-11-03)**

> **Registro de cancelamento (decisão do usuário sobre a varredura
> `docs/syntaxmesh/xray.md` §2.2):** `AlgorithmDiff.rb` é **DEAD no próprio
> TaskJuggler** — `class Diff` não tem **nenhum chamador** em todo
> `docs/taskjuggler/lib` (verificado por grep na varredura). O port foi
> **cancelado**: nenhuma tarefa desta fase o desenvolve.
> Se um dia vier a ser necessário (ex.: diff de status sheets na Fase 18),
> reabrir como task própria da fase consumidora, com justificativa.
>
> ~~Tarefas 16.10.1–16.10.12 (`utils/diff.ts`: `Hunk`, `Diff`, `patch`,
> `editScript`, `to_s` UNIX-diff, `Diffable`)~~ — removidas com o cancelamento.

---

### 16.11 — `StdIoWrapper`

**⚠️ RUBY: `StdIoWrapper.rb` (~60 linhas)**
**🔎 CHEAT: §7 `$stdout` → `console.log`, §12 Categoria B (limitações)**

> **Escopo (anotação do plano, item 9 + adendo 2026-11-03):** desenvolver **apenas
> a função core** de captura de stdout/stderr. Sem integração de UI de browser.
> Consumidores previstos: **Fase 18** (`TimeSheetSummary.getResourceJournal`) e
> **Fase 24** (apps de sheet `ts/ss send` — 24.10.6; captura de saída para anexos).

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

## Bloco E — Núcleo de sintaxe para ferramentas externas (Fase 22)

> **Escopo (anotação do plano, itens 11 e 12):** os **geradores finais** Kate
> (`KateSyntax.rb`) e Vim (`VimSyntax.rb`) estão **CANCELADOS** — nada de escrever
> arquivos `.xml`/`.vim`. Implementar **apenas as funções core** (extração e
> classificação de keywords/contexts/highlights a partir de `SyntaxReference`), que a
> **Fase 22** reutilizará no servidor LSP / help e manual da extensão VSCode.

### 16.14 — `SyntaxCore` (núcleo de realce e autocomplete)

> **MOVIDO (2026-11-03 — decisão do usuário sobre o xray §3.2):** esta subfase
> integra-se ao **`doc-core` da Fase 22 (22.1b)**, que passa a possuir também
> `SyntaxReference`, `KeywordDocumentation`, `TjpExample` e `UserManual`.
> As tarefas abaixo executam sob a F22 (referência histórica mantida na F16).

**⚠️ RUBY: `KateSyntax.rb` (constructor `initialize` + `keywords`) e `VimSyntax.rb` (`prepareSyntax`) — só a lógica de coleta, NÃO a escrita de arquivo**
**🔎 CHEAT: §3 `Hash#each_value` → `for...of`; §12 Categoria B (filtragem de keywords)**

**Pré-requisitos:** ~~Fase 14~~ — **corrigido 2026-11-03**: `SyntaxReference` e
`KeywordDocumentation` **não** foram entregues na Fase 14; tornam-se conteúdo
da própria subfase 22.1b (`doc-core`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.14.1 | Criar `packages/core/src/dev-tools/syntax-core.ts` com `class SyntaxCore` | idem | `deno check` |
| 16.14.2 | Campos: `private reference: SyntaxReference`, `private properties: KeywordDocumentation[]`, `private attributes: KeywordDocumentation[]` | idem | `deno check` |
| 16.14.3 | ⚠️ Constructor: cria `SyntaxReference(null, true)`; separa `keywords` em `properties` (`isProperty()`) vs `attributes` — fiel a `KateSyntax.rb:24-40` | idem | 3 testes |
| 16.14.4 | ⚠️ `keywordList(): string[]` — nomes de property (ignora `supplement`) e nomes de attribute (ignora `%`, `(`, `~`, `include`, `macro`, `project`, `supplement` e os `*report`) — reutiliza a filtragem de `KateSyntax#keywords` (`KateSyntax.rb:160-190`) | idem | 4 testes |
| 16.14.5 | ⚠️ `categories(): { builtin: string[]; types: string[]; keywords: string[] }` — agrupa por categoria de realce (Builtin Function / Data Types / Keyword) | idem | 3 testes |
| 16.14.6 | ⚠️ `contexts()` — devolve a definição **estrutural** de tokens (date, time, duration, string, comment, braces) como dados (objeto/array), **não** como XML/Vim | idem | 2 testes |
| 16.14.7 | Teste: `keywordList` contém `task`, `resource`, `journal` | idem | 1 teste |
| 16.14.8 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

> **Não implementar:** `generate(file)`, `header()`, `footer()`, `highlights()` como
> escrita de arquivo, nem qualquer saída `.xml` (Kate) / `.vim` (Vim). Fica para a
> Fase 22 (LSP / VSCode).

---

### 16.15 — (CANCELADO) Geradores Kate/Vim finais

> Anotado no plano (itens 11 e 12): os geradores de arquivos Kate e Vim estão
> **cancelados**. Toda a lógica reutilizável já está em `SyntaxCore` (16.14).
> Nenhuma tarefa de implementação aqui — mantido apenas como registro de escopo.

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
| 16.20.5 | ADR 029 criada e commitada | git log |
| 16.20.6 | `Journal`, `JournalEntry`, `AlertLevelDefinitions`, `Leave`, `LeaveList`, `LeaveAllowance`, `TextFormatter`, `FileList`, `URLParameter`, `StdIoWrapper` exportados em `packages/core/mod.ts` — **não** `TernarySearchTree`/`SyntaxCore` (movidos para a F22) nem `AlgorithmDiff` (cancelado) | `deno check` |
| 16.20.7 | `tests/integration/smoke_after_phase_16_test.ts` — cria `Journal`, adiciona 1 entrada, verifica `alertLevel`; verifica Fase 15 (Gantt HTML) | 1 teste |
| 16.20.8 | Auditoria: cada subfase do plano `fase-16-apoio.md` tem tarefas correspondentes | grep |
| 16.20.9 | Corrigir numeração em `fase-16-apoio.md` (`### 20.X` → `### 16.X`, `ADR 027` → **`ADR 029`** para Journal/AlertLevel) | grep |
| 16.20.10 | Teste agregado: `TaskScenario.query_journal` retorna `RichTextIntermediate` com entradas | 1 teste |

---

## Notas para a IA

1. **Ordem:** 16.0 → 16.1 → 16.2 → 16.3 → 16.4 → 16.5 → 16.6 → 16.7 → 16.8 → 16.11 → 16.12 → 16.13 → 16.16 → 16.17 → 16.18 → 16.19 → 16.20. **16.9/16.14/16.15 foram movidas para a Fase 22 (`doc-core`) e 16.10 (AlgorithmDiff) foi cancelada** (xray 2026-11-03) — os números antigos ficam como registro, sem tarefa a executar.
2. **`Journal` completa stubs da Fase 14.** 8 queries + dashboard.
3. **`LeaveList` substitui stubs da Fase 5.** Re-rodar testes antigos.
4. **`currentEntriesR` usa cache.** `DataCache.cached`.
5. **`alertLevel` retorna max dos filhos.** Com hierarquia.
6. **`AlertLevelDefinition.to_s`** formato: `<id> '<name>' '<color>'`.
7. **`Leave.typeIdx`** é o índice do tipo (1–7).
8. **`LeaveAllowance.slots`** pode ser negativo (expiração).
9. **`TextFormatter` com UTF-8.** Usar `[...str]`.
10. **`URLParameter` depende de `fflate`.** Fixar versão.
11. **`TernarySearchTree`** é core only (reuso Fase 22; não ligar a `tj3man`).
12. **`UTF8String` é no-op.** Funções delegate.
13. **`StdIoWrapper` em browser** com limitações.
14. **`KateSyntax` / `VimSyntax`**: geradores finais **CANCELADOS**; só o núcleo `SyntaxCore` em `dev-tools/` (reuso Fase 22 / LSP).
15. **`LogicalFlag`** distingue Query de JournalEntry.
16. **`hasalert`** usa `currentEntries`.
17. **Sem `any`.** Use `unknown` + narrowing.
18. **Commit por subfase.** `feat(core): journal`, etc.
19. **ADR 029** para Journal/AlertLevel. Na numeração real: **026** Markdown, **027**
    reports no browser, **028** Gantt, **029** Journal (este), **036/037** Fase 18.
20. **Não tocar em Fase 14 (reports) além dos stubs de journal.**
21. **Não tocar em Fase 17 (HTML/XML).**
22. **Não tocar em Fase 18 (time sheets).** `TimeSheetRecord` é stub aqui.
23. **`JournalEntry.timeSheetRecord`** é `unknown | null` (stub).
24. **Não usar `Proxy`.**
25. **`AlertLevelDefinitions.add` valida `id` e `name` únicos.**

---

## Notas específicas por subfase

### 16.0 — ADR 029

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

- **MOVIDO → F22 (22.1b `doc-core`)** — 2026-11-03.
- **Inserção + find + balance.**

### 16.10 — AlgorithmDiff

- **CANCELADO (DEAD no upstream)** — 2026-11-03; ver §16.10.
- ~~**LCS-like.**~~
- ~~**`patch` + `editScript`.**~~

### 16.11 — StdIoWrapper

- **`console.log` + `console.error`.**
- **Browser: limitações.**

### 16.12 — UTF8String

- **Funções nativas.**

### 16.13 — deepClone

- **Revisar cobertura.**

### 16.14–16.15 — SyntaxCore (MOVIDO → F22 22.1b `doc-core`)

- **MOVIDO para a Fase 22** (decisão 2026-11-03; xray §3.2).
- **Geradores finais Kate/Vim CANCELADOS** (itens 11 e 12 do plano).
- **Só funções core** (extração/classificação de keywords/contexts/highlights).
- **Em `dev-tools/`** (`syntax-core.ts`); consumo na Fase 22 (LSP / VSCode).

### 16.16–16.18 — Integração

- **Completar 8 queries de `TaskScenario`.**
- **Completar `ResourceScenario.query_dashboard`.**
- **Completar `LogicalFlag` + `hasalert`.**

### 16.19 — Golden tests

- **Journal + Leaves.**
- **~25 casos.**

### 16.20 — Verificação

- **Sem stubs em `journal/`.**
- **ADR 029.**

---

## 16.21 — Adendo Fase 10 Complemento: Journal aceita `Material`/`Account` + `pictures`/`format`

> **Origem:** `fase-10-complemento1.md` §2.5 (impacto Journal #1), §4.5 (#3) e §6.6 (#5). O modelo `Picture` e os campos `pictures`/`format` em `JournalEntry` já nascem no Bloco C3.3.5 de `fase-10-complemento-tarefas.md`; aqui o subsistema `journal/` os consome por completo.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 16.21.1 | `JournalEntry.property` aceita `Material` e `Account` (uniões de tipo já abertas pelo Bloco C1/C0) | `journal/journal-entry.ts` | `deno check` |
| 16.21.2 | `Journal.entriesByMaterial(material, startDate?, endDate?, logExp?, alertLevel?): JournalEntryList` | `journal/journal.ts` | 2 testes |
| 16.21.3 | `Journal.entriesByAccount(account, …)` com a mesma assinatura | `journal/journal.ts` | 2 testes |
| 16.21.4 | `currentEntries`/`currentEntriesR`/`alertLevel`/`alertEntries` tratam `Material` e `Account` como **folha** (sem `journal_sub`); `journalentry` de account/material **contribui** para `alertLevel` | `journal/journal.ts` | 3 testes |
| 16.21.5 | `Journal.to_rti` aceita material/account nos modos `journal`, `status_up`, `status_down`, `alerts_*`; para material `journal_sub` vira `journal` | `journal/journal.ts` (RTI) | 2 testes |
| 16.21.6 | `JournalEntry.pictures: Picture[]` e `format: 'markdown'|'richtext'` (default `markdown`) propagados na consulta e no RTI | `journal/journal.ts`, `journal/journal-entry.ts` | 2 testes |
| 16.21.7 | **Regressão:** journal em `task`/`resource`/`project` idêntico ao comportamento atual | testes existentes | verde |

**Critério de aceite do adendo:** `entriesByMaterial`/`entriesByAccount` funcionam com filtros de data/alerta; `alertLevel` agrega account/material; nenhum teste existente de journal quebra.

---

**Fim do arquivo de tarefas da Fase 16.**