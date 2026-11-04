# Fase 18 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-18-time-status-sheets.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~185 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{TimeSheets,TimeSheetSender,TimeSheetReceiver,TimeSheetSummary,StatusSheetSender,StatusSheetReceiver,SheetHandlerBase,SheetSender,SheetReceiver}.rb`

> **📌 Âncora — Complemento Fase 11 (2ª onda, §6.6 de `fase-11-logical-complemento.md`):**
> a função lógica **`istaskstatus(id, status)`** permanece stub
> (`NotYetImplementedError("7")`) até existir o enum de status derivado de
> tracking (notstarted/inprogress/finished/…). Implementar junto das status
> sheets e reclassificar `FUNCTIONS_EXT` (feasible) + testes.

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md` (seção relevante)
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

Esta fase depende de **Fases 2–17 completas**. Em particular:

- `Task`, `Resource`, `Project` (Fase 5, 9)
- `JournalEntry`, `Journal` (Fase 16)
- `TimeSheetReport`, `StatusSheetReport` (Fase 14)
- `MessageHandlerInstance` (Fase 9)
- `RichText` (Fase 12)
- `TjTime` (Fase 2)
- `fakeOpfs()` de `@syntaxmesh/worker-db` (Fase 1)

A ordem **dentro** da fase importa:

1. **Bloco 0 (numeração de ADRs)** primeiro — corrige referências cruzadas.
2. **Bloco A (interface + TimeSheets)** — FileStore, TimeSheetRecord, TimeSheet.
3. **Bloco B (Sheets base)** — SheetHandlerBase, SheetSender, SheetReceiver.
4. **Bloco C (senders/receivers específicos)** — Time, Status.
5. **Bloco D (Summary)** — TimeSheetSummary.
6. **Bloco E (integração)** — TaskJuggler.checkTimeSheet, warnOnDelta.
7. **Bloco F (golden tests)**.
8. **Bloco G (verificação final)**.

### ADRs relevantes (numeração final)

- **ADR 001** — Core independente de DOM/Storage.
- **ADR 003** — Storage não contamina Core.
- **ADR 010** — worker-db centraliza storage.
- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 036** — Sheets no browser: email → download/**texto de email**. **Criado nesta fase.**
  (Renumerado em 2026-11-03; o plano chamava 029, que pertence a Journal/AlertLevel — xray §5.3.)
- **ADR 037** — FileStore injection no Core. **Criado nesta fase.**
  (Renumerado em 2026-11-03; o plano chamava 031, que já é Modelo Contábil Estendido.)
- **ADR 029** — *Journal e AlertLevel em TypeScript* (Fase 16, subfase 16.0). **Não usar aqui.**

### Convenções CRÍTICAS

- **Core define `FileStore` em `src/interfaces/`.** Storage implementa.
- **Core não importa `@syntaxmesh/worker-db`.** Só em testes.
- **Testes usam `fakeOpfs()`** de `@syntaxmesh/worker-db`.
- **`SheetHandlerBase.setFileStore(fs)`** injeta.
- **`addToScm`** delega ao `FileStore` (se `scmCommand !== null` → warning).
- **Email → download/upload.** SMTP não existe em browser. **Política (2026-11-03):**
  o sender entrega o **texto do email** (cabeçalhos + corpo + anexo base64) e **não**
  se conecta a app de envio; o receiver consome **texto de mensagem** (arquivo/stdin),
  não a mensagem inteira.
- **Núcleo dos apps de sheet mora aqui (18.18); empacotamento CLI mora na Fase 24.**
- **`tj3client` → in-process.** Chamar `Project` diretamente.
- **YAML → JSON.** `resources.yml` vira `resources.json`.
- **`TimeSheetRecord.work=`** aceita `Integer` (slots) ou `Float` (percentual).
- **`TimeSheet.check`** total deve bater com `totalNetWorkingSlots` (±1).
- **`TimeSheetRecord.status`** é `JournalEntry` (Fase 16).
- **`SheetHandlerBase.cutOut`** extrai entre `# --------8<--------`.
- **`SheetSender.genResourceList`** chama `project.generateReport` in-process.
- **`SheetReceiver.processEmail`** aceita anexo ou corpo.
- **`TimeSheetSummary.getResourceJournal`** chama report in-process.
- **`TaskJuggler.checkTimeSheet`** limpa `timeSheets` e `journal` antes.
- **`warnOnDelta`** chamado em `Project.schedule` se `warnTsDeltas`.
- **Todos os métodos que tocam FS são `async`.**
- **Parser `timeSheetFile` / `statusSheetFile`** — verificar Fase 10.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não introduzir SMTP no browser.
- ❌ Não chamar app/lib de envio de email a partir do sender — só produzir texto.
- ❌ Não fazer o receiver ler mailbox/IMAP — recebe texto de mensagem.
- ❌ Não importar `@syntaxmesh/worker-db` em `packages/core/src/`.
- ❌ Não confundir `TimeSheet` (singular) com `TimeSheets` (plural).
- ❌ Não usar `fs.write` síncrono (não existe em OPFS).
- ❌ Não assumir que `TimeSheetRecord.status` é `string` — é `JournalEntry`.
- ❌ Não fazer `Map<string, string>` como fallback de FS.
- ❌ Não colocar lógica de UI no Core.
- ❌ Não usar `Proxy`.

---

## Progresso

```
[ ] 18.0  ADRs 036/037 (numeração corrigida)         —   0/8
[ ] 18.1  Interface FileStore em Core                    —   0/8
[ ] 18.2  TimeSheetRecord                                —   0/24
[ ] 18.3  TimeSheet + TimeSheets                         —   0/22
[ ] 18.4  Project.timeSheets + checkTimeSheets           —   0/6
[ ] 18.5  SheetHandlerBase (com FileStore injetado)      —   0/22
[ ] 18.6  SheetSender                                    —   0/20
[ ] 18.7  SheetReceiver                                  —   0/22
[ ] 18.8  TimeSheetSender                                —   0/6
[ ] 18.9  TimeSheetReceiver                              —   0/6
[ ] 18.10 StatusSheetSender + StatusSheetReceiver        —   0/10
[ ] 18.11 TimeSheetSummary                               —   0/14
[ ] 18.12 Completar TaskJuggler.checkTimeSheet/StatusSheet — 0/8
[ ] 18.13 Integração warnOnDelta                         —   0/4
[ ] 18.14 Verificar conformidade FileStore               —   0/4
[ ] 18.15 Golden tests (timesheets)                      —   0/8
[ ] 18.16 Verificação final                              —   0/10
[ ] 18.17 Adendo F10-C: material + picture em sheets     —   0/10
[ ] 18.18 Núcleo dos apps de sheet (xray §3.3)           —   0/9
[ ] 18.19 Pipeline dynamicAttributes (xray §3.4)         —   0/8
[ ] 18.20 MessageHandler#checkLevel (xray §3.4.1)        —   0/4
─────────────────────────────────────────────────────────
TOTAL: ~206
```

---

## Bloco 0 — ADRs 036/037

### 18.0 — Criação dos ADRs 036/037

**Objetivo:** registrar as duas decisões desta fase com a numeração correta.

#### 18.0.1 — Varredura de referências (escopo reduzido em 2026-11-03)

> **CANCELADO:** a varredura original (18.0.1.1–18.0.1.7), que shiftava "ADR 025→026→027→028→030/031→032→033→034" em cascata, **não será executada** — os números que ela propunha já estão ocupados por arquivos reais (`027-reports-browser`, `028-gantt-html-css`, `030-arquitetura-simplificada`, `031-modelo-contabil-estendido`, `032-gate-fase-13`) e as fases 14/15 já usam a numeração correta no README. Renumerar em cascata agora quebraria todas as referências históricas e os commits já feitos.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.0.1.1 | Confirmar que `fase-14-relatorios.md` usa ADR **027** (reports no browser) e corrigir se divergir | `fase-14-relatorios.md` | `grep "ADR 027"` |
| 18.0.1.2 | Confirmar que `fase-15-gantt*.md` usa ADR **028** (Gantt HTML+CSS) | `fase-15-gantt.md`, `-tarefas.md` | `grep "ADR 028"` |
| 18.0.1.3 | Corrigir `fase-16-apoio*.md`: o ADR de Journal/AlertLevel é **029** (não 027) | `fase-16-apoio.md`, `-tarefas.md` | `grep "ADR 029"` |
| 18.0.1.4 | Atualizar `decisoes/README.md`: 029 = Journal e AlertLevel; **reservar 036 (sheets) e 037 (`FileStore`)**; registrar a cadeia 033–035 como reivindicada por F21/F22/F23/F24, a reconciliar na Fase 21 | `decisoes/README.md` | linhas presentes |
| 18.0.1.5 | ~~Substituir ADRs em cascata nas fases 19/20/21~~ **CANCELADO** (ver acima) | — | — |

#### 18.0.2 — ADR 036 (Sheets no browser: email → texto/download)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.0.2.1 | Criar `docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md` com frontmatter | idem | arquivo existe |
| 18.0.2.2 | **Contexto:** SMTP/SCM/filesystem vs browser | idem | — |
| 18.0.2.3 | **Decisões:** Sender = **texto do email** (To/Subject/corpo + anexo base64) + download + Web Share API (futuro); Receiver = **texto de mensagem** (arquivo/stdin) ou upload/drag-and-drop; SCM = `FileStore` injetado; `tj3client` = in-process; YAML → JSON | idem | — |
| 18.0.2.4 | **Alternativas:** SMTP em browser (inviável), servidor backend (viola ADR 005), leitura de mailbox (inviável no browser). **Consequências:** fluxo manual; UI/CLI precisam botão de download e entrada de texto | idem | — |
| 18.0.2.5 | Atualizar linha `036` em `decisoes/README.md` | idem | linha presente |

#### 18.0.3 — ADR 037 (FileStore injection)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.0.3.1 | Criar `docs/syntaxmesh/decisoes/037-filestore-injection.md` com frontmatter | idem | arquivo existe |
| 18.0.3.2 | **Contexto:** Core não pode importar Storage (ADR 001, 003). `SheetHandlerBase` precisa ler/escrever arquivos | idem | — |
| 18.0.3.3 | **Decisões:** Core define interface `FileStore` em `src/interfaces/file-store.ts`; Storage implementa; testes usam `fakeOpfs()`; injeção via `setFileStore(fs)` | idem | — |
| 18.0.3.4 | **Alternativas:** Core importar Storage (viola ADR 001). **Consequências:** desacoplamento; testes rápidos | idem | — |
| 18.0.3.5 | Atualizar linha `037` em `decisoes/README.md` | idem | linha presente |

#### 18.0.4 — Nota em `fase-18-time-status-sheets.md`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.0.4.1 | Confirmar a nota de renumeração já registrada no plano (036 sheets / 037 FileStore; 029 = Journal) | `fase-18-time-status-sheets.md` | bloco 18.0 presente |

---

## Bloco A — Interface e TimeSheets

### 18.1 — Interface `FileStore` em Core

**⚠️ RUBY: N/A (extensão SyntaxMesh).**
**📎 ADR 037.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.1.1 | Criar `packages/core/src/interfaces/file-store.ts` com `interface FileStore` | idem | `deno check` |
| 18.1.2 | `interface FileStore`: `read`, `write`, `delete`, `list`, `exists`, `mkdir` | idem | `deno check` |
| 18.1.3 | Criar `packages/core/src/interfaces/key-value-store.ts` com `interface KeyValueStore` | idem | `deno check` |
| 18.1.4 | `interface KeyValueStore`: `get<T>`, `set<T>`, `del`, `keys` | idem | `deno check` |
| 18.1.5 | Criar `packages/core/src/interfaces/mod.ts` | idem | `deno check` |
| 18.1.6 | Re-exportar de `packages/core/src/mod.ts` | `src/mod.ts` | `deno check` |
| 18.1.7 | Teste de conformidade estrutural: `fakeOpfs()` satisfaz `FileStore` | `tests/interfaces/file-store_test.ts` | 1 teste |
| 18.1.8 | Teste: `read`/`write`/`mkdir`/`list` em `fakeOpfs()` | idem | 3 testes |

### 18.2 — `TimeSheetRecord`

**⚠️ RUBY: `TimeSheets.rb` — classe `TimeSheetRecord` (linhas ~1–250).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.2.1 | Criar `packages/core/src/timesheet/time-sheet-record.ts` com classe vazia | idem | `deno check` |
| 18.2.2 | Constructor `(timeSheet, task)` — registra em `timeSheet.push(this)` | idem | 2 testes |
| 18.2.3 | Campos: `work: number \| null`, `remaining: number \| null`, `expectedEnd: TjTime \| null` | idem | `deno check` |
| 18.2.4 | Campos: `status: JournalEntry \| null`, `priority: number` (default 0), `name: string \| null`, `sourceFileInfo` | idem | `deno check` |
| 18.2.5 | `get taskId(): string` — `Task.fullId` ou string | idem | 2 testes |
| 18.2.6 | Setter `set work(value)` — Integer = slots diretos; Float = `percentToSlots` | idem | 4 testes |
| 18.2.7 | `check()` — `work` não null | idem | 2 testes |
| 18.2.8 | `check()` — task existente com effort > 0: `remaining` obrigatório | idem | 3 testes |
| 18.2.9 | `check()` — task existente sem effort: `expectedEnd` obrigatório | idem | 3 testes |
| 18.2.10 | `check()` — nova task: `remaining` ou `expectedEnd` | idem | 3 testes |
| 18.2.11 | `check()` — status obrigatório se `work >= 1 dia` | idem | 2 testes |
| 18.2.12 | `check()` — status headline vazio lança | idem | 1 teste |
| 18.2.13 | `check()` — alertLevel > 0 sem summary/details lança | idem | 2 testes |
| 18.2.14 | `check()` — alertLevel > 1 sem details lança | idem | 1 teste |
| 18.2.15 | `check()` — summary default "A summary text" lança | idem | 1 teste |
| 18.2.16 | `warnOnDelta(startIdx, endIdx)` — nova task: warning `ts_res_new_task` | idem | 2 testes |
| 18.2.17 | `warnOnDelta` — work diferente de plannedWork: warning `ts_res_work_delta` | idem | 3 testes |
| 18.2.18 | `warnOnDelta` — effort task: compara `remaining` com `remainingWork` | idem | 2 testes |
| 18.2.19 | `warnOnDelta` — duration task: compara `expectedEnd` com `task.end` | idem | 2 testes |
| 18.2.20 | `actualWorkPercent(): number` | idem | 2 testes |
| 18.2.21 | `planWorkPercent(): number` | idem | 2 testes |
| 18.2.22 | `actualRemaining(): number` | idem | 2 testes |
| 18.2.23 | `planRemaining(): number` | idem | 2 testes |
| 18.2.24 | `actualEnd(): TjTime \| null`, `planEnd(): TjTime` | idem | 2 testes |

### 18.3 — `TimeSheet` + `TimeSheets`

**⚠️ RUBY: `TimeSheets.rb` — classes `TimeSheet` e `TimeSheets` (linhas ~250–450).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.3.1 | Criar `packages/core/src/timesheet/time-sheet.ts` com classe vazia | idem | `deno check` |
| 18.3.2 | Campos: `resource`, `interval`, `scenarioIdx`, `sourceFileInfo`, `percentageUsed`, `records`, `messageHandler` | idem | `deno check` |
| 18.3.3 | Constructor `(resource, interval, scenarioIdx)` — valida cada | idem | 4 testes |
| 18.3.4 | `push(record)` — verifica duplicatas de task | idem | 3 testes |
| 18.3.5 | `check()` — chama `record.check()` para cada record | idem | 2 testes |
| 18.3.6 | `check()` — soma `work` e compara com `totalNetWorkingSlots` (±1) | idem | 4 testes |
| 18.3.7 | `check()` — `efficiency === 0` exige total 0 | idem | 2 testes |
| 18.3.8 | `check()` — sem `trackingScenarioIdx` lança `ts_no_tracking_scenario` | idem | 1 teste |
| 18.3.9 | `check()` — total muito baixo lança `ts_work_too_low` | idem | 1 teste |
| 18.3.10 | `check()` — total muito alto lança `ts_work_too_high` | idem | 1 teste |
| 18.3.11 | `warnOnDelta()` — delega para `record.warnOnDelta` | idem | 2 testes |
| 18.3.12 | `totalGrossWorkingSlots(): number` | idem | 2 testes |
| 18.3.13 | `totalNetWorkingSlots(): number` | idem | 3 testes |
| 18.3.14 | `percentToSlots(value): number` — seta `percentageUsed` | idem | 3 testes |
| 18.3.15 | `slotsToPercent(slots): number` | idem | 2 testes |
| 18.3.16 | `slotsToDays(slots): number` | idem | 3 testes |
| 18.3.17 | `daysToSlots(days): number` | idem | 3 testes |
| 18.3.18 | `error(id, text, sfi?)` / `warning(id, text, sfi?)` | idem | 2 testes |
| 18.3.19 | Criar `packages/core/src/timesheet/time-sheets.ts` com `class TimeSheets extends Array<TimeSheet>` | idem | `deno check` |
| 18.3.20 | `TimeSheets.check()` | idem | 1 teste |
| 18.3.21 | `TimeSheets.warnOnDelta()` | idem | 1 teste |
| 18.3.22 | Criar `packages/core/src/timesheet/mod.ts` | idem | `deno check` |

### 18.4 — `Project.timeSheets` + `checkTimeSheets`

**⚠️ RUBY: `Project.rb` — `checkTimeSheets` + `@timeSheets` (Fase 9 stub).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.4.1 | Adicionar `readonly timeSheets: TimeSheets` em `Project` | `src/model/project.ts` | `deno check` |
| 18.4.2 | Constructor: `this.timeSheets = new TimeSheets()` | idem | 1 teste |
| 18.4.3 | `checkTimeSheets(): void` — `this.timeSheets.check()` | idem | 2 testes |
| 18.4.4 | `checkTimeSheets` — vazio passa | idem | 1 teste |
| 18.4.5 | `checkTimeSheets` — com sheets válidos passa | idem | 1 teste |
| 18.4.6 | Remover stub `NotYetImplementedError` de `checkTimeSheets` | idem | grep retorna 0 |

---

## Bloco B — Sheets base

### 18.5 — `SheetHandlerBase` (com `FileStore` injetado)

**⚠️ RUBY: `SheetHandlerBase.rb` (arquivo inteiro — ~300 linhas).**
**📎 ADR 037.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.5.1 | Criar `packages/core/src/sheets/sheet-handler-base.ts` | idem | `deno check` |
| 18.5.2 | Campos: `appName`, `emailDeliveryMethod`, `smtpServer`, `senderEmail`, `workingDir`, `scmCommand` | idem | `deno check` |
| 18.5.3 | Campos: `projectId` (default `'prj'`), `outputLevel`, `logLevel`, `dryRun`, `logFile`, `emailFailure` | idem | `deno check` |
| 18.5.4 | Campo `protected fileStore: FileStore \| null` | idem | `deno check` |
| 18.5.5 | Constructor `(appName)` com defaults | idem | 3 testes |
| 18.5.6 | `setFileStore(fs)` e `getFileStore()` | idem | 3 testes |
| 18.5.7 | `cutOut(text)` — regex `mark1` e `mark2` | idem | 4 testes |
| 18.5.8 | `cutOut` — sem marcadores retorna original | idem | 1 teste |
| 18.5.9 | `cutOut` — remove quote markers de email | idem | 2 testes |
| 18.5.10 | `cutOut` — trata empty lines com quote | idem | 2 testes |
| 18.5.11 | `setWorkingDir()` — valida SMTP config | idem | 2 testes |
| 18.5.12 | `setWorkingDir()` — valida `senderEmail` | idem | 1 teste |
| 18.5.13 | `setWorkingDir()` — `mkdir(workingDir)` via FileStore | idem | 1 teste |
| 18.5.14 | `addToScm(message, fileName)` — no-op se `scmCommand === null` | idem | 2 testes |
| 18.5.15 | `addToScm` — warning se `scmCommand !== null` | idem | 1 teste |
| 18.5.16 | `info/warning/error` | idem | 3 testes |
| 18.5.17 | `log(type, message)` — no-op em browser | idem | 1 teste |
| 18.5.18 | `sendRichTextEmail(to, subject, message, ...)` — dryRun | idem | 2 testes |
| 18.5.19 | `sendRichTextEmail` — com `fakeOpfs()` escreve em `outbox/` | idem | 2 testes |
| 18.5.20 | `sendRichTextEmail` — sem `fileStore` warning | idem | 1 teste |
| 18.5.21 | `sendEmail` — análogo | idem | 2 testes |
| 18.5.22 | `htmlMailBody(message)` — HTML inline com CSS | idem | 2 testes |

### 18.6 — `SheetSender`

**⚠️ RUBY: `SheetSender.rb` (arquivo inteiro — ~250 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.6.1 | Criar `packages/core/src/sheets/sheet-sender.ts` com `class SheetSender extends SheetHandlerBase` | idem | `deno check` |
| 18.6.2 | Campos: `sheetType`, `hideResource`, `signatureFile`, `templateDir`, `force`, `signatureFilter`, `mailSubject`, `introText`, `date`, `intervalDuration`, `timeStamp` | idem | `deno check` |
| 18.6.3 | Constructor `(appName, type)` — defaults | idem | 3 testes |
| 18.6.4 | `sendTemplates(resourceList)` — pipeline: setWorkingDir → createDirectories → genResourceList → genTemplates → sendReportTemplates | idem | 2 testes |
| 18.6.5 | `createDirectories()` via `fileStore.mkdir` | idem | 2 testes |
| 18.6.6 | `genResourceList(resourceList)` — constrói `resourcereport` | idem | 2 testes |
| 18.6.7 | `genResourceList` — `hideresource`, `sortresources id.up`, `loadunit days`, `period` | idem | 4 testes |
| 18.6.8 | `genResourceList` — chama `project.generateReport` **in-process** | idem | 1 teste |
| 18.6.9 | `genResourceList` — parse CSV | idem | 2 testes |
| 18.6.10 | `genResourceList` — filtra email vazio | idem | 2 testes |
| 18.6.11 | `genResourceList` — filtra `effort === 0 && free === 0` | idem | 2 testes |
| 18.6.12 | `genResourceList` — salva `resources.json` via `fileStore.write` | idem | 2 testes |
| 18.6.13 | `genTemplates(resources)` — constrói `timesheetreport`/`statussheetreport` | idem | 2 testes |
| 18.6.14 | `genTemplates` — `hideresource ~(plan.id = "res")` | idem | 1 teste |
| 18.6.15 | `genTemplates` — chama `project.generateReport` in-process | idem | 1 teste |
| 18.6.16 | `genTemplates` — salva `.tji` via `fileStore.write` | idem | 1 teste |
| 18.6.17 | `sendReportTemplates(resources)` — lê `.tji` e envia | idem | 2 testes |
| 18.6.18 | `sendReportTemplates` — pula template não modificado | idem | 1 teste |
| 18.6.19 | `enableSignatureForReporting(templateFile)` — regex + adiciona em `acceptable_intervals` | idem | 3 testes |
| 18.6.20 | `generateReport(id, reportDef)` — wrapper in-process | idem | 1 teste |

### 18.7 — `SheetReceiver`

**⚠️ RUBY: `SheetReceiver.rb` (arquivo inteiro — ~250 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.7.1 | Criar `packages/core/src/sheets/sheet-receiver.ts` com `class SheetReceiver extends SheetHandlerBase` | idem | `deno check` |
| 18.7.2 | Campos: `sheetType`, `tj3clientOption`, `sheetDir`, `templateDir`, `failedMailsDir`, `failedSheetsDir`, `signatureFile`, `emailSubject`, `sheetHeader`, `signatureFilter` | idem | `deno check` |
| 18.7.3 | Campos: `submitter`, `resourceId`, `date`, `sheet`, `sheetWasAttached`, `messageId` | idem | `deno check` |
| 18.7.4 | Constructor `(appName, type)` — defaults | idem | 3 testes |
| 18.7.5 | `processEmail(rawMail)` — parse header + body + attachments | idem | 3 testes |
| 18.7.6 | `processEmail` — identifica submitter + messageId | idem | 2 testes |
| 18.7.7 | `processEmail` — tenta anexos `.tji` primeiro | idem | 2 testes |
| 18.7.8 | `processEmail` — senão tenta corpo | idem | 2 testes |
| 18.7.9 | `processEmail` — sem sheet lança erro claro | idem | 1 teste |
| 18.7.10 | `processSheet(sheet)` — `cutOut` + valida `sheetHeader` | idem | 2 testes |
| 18.7.11 | `processSheet` — `checkSignature` | idem | 2 testes |
| 18.7.12 | `processSheet` — extrai `resourceId`, `date` | idem | 2 testes |
| 18.7.13 | `processSheet` — `getResourceEmail` | idem | 1 teste |
| 18.7.14 | `processSheet` — `checkSheet` | idem | 2 testes |
| 18.7.15 | `processSheet` — `fileSheet` | idem | 2 testes |
| 18.7.16 | `checkSignature(sheet)` — valida contra `acceptable_intervals` | idem | 3 testes |
| 18.7.17 | `checkSheet(sheet)` — salva em `failedSheetsDir` via `fileStore.write` | idem | 1 teste |
| 18.7.18 | `checkSheet` — parse `.tji` + `project.checkTimeSheets()` | idem | 2 testes |
| 18.7.19 | `fileSheet(sheet)` — salva via `fileStore.write` | idem | 2 testes |
| 18.7.20 | `fileSheet` — gera `all.tji` na pasta | idem | 1 teste |
| 18.7.21 | `createDirectories()` via `fileStore.mkdir` | idem | 1 teste |
| 18.7.22 | `getResourceList()`, `getResourceEmail(id)`, `getResourceName(id)` — leem `resources.json` via `fileStore.read` | idem | 3 testes |

---

## Bloco C — Senders/Receivers específicos

### 18.8 — `TimeSheetSender`

**⚠️ RUBY: `TimeSheetSender.rb` (~120 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.8.1 | Criar `packages/core/src/sheets/time-sheet-sender.ts` | idem | `deno check` |
| 18.8.2 | Constructor `(appName)` — `super('time')`, `hideResource='0'`, `templateDir='TimeSheetTemplates'`, `logFile='timesheets.log'` | idem | 3 testes |
| 18.8.3 | `signatureFile = '<templateDir>/acceptable_intervals'` | idem | 1 teste |
| 18.8.4 | `signatureFilter = /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/` | idem | 1 teste |
| 18.8.5 | `introText` com o texto Ruby | idem | 1 teste |
| 18.8.6 | `mailSubject = 'Your weekly time sheet template for %s'` | idem | 1 teste |

### 18.9 — `TimeSheetReceiver`

**⚠️ RUBY: `TimeSheetReceiver.rb` (~40 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.9.1 | Criar `packages/core/src/sheets/time-sheet-receiver.ts` | idem | `deno check` |
| 18.9.2 | Constructor `(appName)` — `super('time')`, `tj3clientOption='check-ts'` | idem | 2 testes |
| 18.9.3 | `sheetDir='TimeSheets'`, `templateDir='TimeSheetTemplates'`, `failedMailsDir`, `failedSheetsDir` | idem | 2 testes |
| 18.9.4 | `signatureFile='TimeSheetTemplates/acceptable_intervals'`, `logFile='timesheets.log'` | idem | 1 teste |
| 18.9.5 | `sheetHeader` regex | idem | 1 teste (match) |
| 18.9.6 | `signatureFilter` regex + `emailSubject = 'Report from %s for %s'` | idem | 2 testes |

### 18.10 — `StatusSheetSender` + `StatusSheetReceiver`

**⚠️ RUBY: `StatusSheetSender.rb` (~130 linhas), `StatusSheetReceiver.rb` (~40 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.10.1 | Criar `packages/core/src/sheets/status-sheet-sender.ts` | idem | `deno check` |
| 18.10.2 | Constructor `(appName)` — `super('status')`, `templateDir='StatusSheetTemplates'`, `timeSheetDir='TimeSheets'` | idem | 2 testes |
| 18.10.3 | `hideResource='0'`, `signatureFile`, `signatureFilter`, `introText`, `mailSubject` | idem | 3 testes |
| 18.10.4 | `defaulterList()` — `fileStore.list('TimeSheets')` + glob + leitura de `missing-reports` | idem | 4 testes |
| 18.10.5 | `defaulterList` — filtra os que já submeteram | idem | 2 testes |
| 18.10.6 | Criar `packages/core/src/sheets/status-sheet-receiver.ts` | idem | `deno check` |
| 18.10.7 | Constructor análogo com regex `statussheet` | idem | 2 testes |
| 18.10.8 | `tj3clientOption='check-ss'`, `sheetDir='StatusSheets'` | idem | 1 teste |
| 18.10.9 | `sheetHeader` e `signatureFilter` com `statussheet` | idem | 2 testes |
| 18.10.10 | Criar `packages/core/src/sheets/mod.ts` com todos os exports | idem | `deno check` |

---

## Bloco D — Summary

### 18.11 — `TimeSheetSummary`

**⚠️ RUBY: `TimeSheetSummary.rb` (~180 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.11.1 | Criar `packages/core/src/sheets/time-sheet-summary.ts` | idem | `deno check` |
| 18.11.2 | Campos: `date`, `sheetRecipients`, `digestRecipients`, `hideResource`, `templateDir`, `sheetDir`, `logFile` | idem | `deno check` |
| 18.11.3 | Campos: `resourceIntro`, `resourceSheetSubject`, `summarySubject`, `reminderSubject`, `reminderText`, `defaulterHeader` | idem | `deno check` |
| 18.11.4 | Constructor — `super('tj3ts_summary', 'summary')` | idem | 2 testes |
| 18.11.5 | `sendSummary(resourceIds)` — itera `getResourceList()` | idem | 2 testes |
| 18.11.6 | `sendSummary` — skip se não em `resourceIds` | idem | 1 teste |
| 18.11.7 | `sendSummary` — checa template via `fileStore.exists` | idem | 2 testes |
| 18.11.8 | `sendSummary` — se sheet existe: `getResourceJournal` + append | idem | 2 testes |
| 18.11.9 | `sendSummary` — senão adiciona à `defaulterList` | idem | 2 testes |
| 18.11.10 | `sendSummary` — prepend defaulter list | idem | 1 teste |
| 18.11.11 | `sendSummary` — salva `missing-reports` via `fileStore.write` | idem | 1 teste |
| 18.11.12 | `sendSummary` — envia summary + reminder | idem | 2 testes |
| 18.11.13 | `getResourceJournal(sheetFile)` — parse `.tji` + query journal | idem | 2 testes |
| 18.11.14 | `sendReminder(id, name, email)` | idem | 2 testes |

---

## Bloco E — Integração

### 18.12 — Completar `TaskJuggler.checkTimeSheet` / `checkStatusSheet`

**⚠️ RUBY: `TaskJuggler.rb` — `checkTimeSheet` e `checkStatusSheet` (Fase 9 stub).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.12.1 | Completar `checkTimeSheet(fileName)` | `src/taskjuggler.ts` | `deno check` |
| 18.12.2 | `checkTimeSheet` — limpa `project.timeSheets` + `project.journal` | idem | 2 testes |
| 18.12.3 | `checkTimeSheet` — `parseFile(fileName, 'timeSheetFile')` | idem | 1 teste |
| 18.12.4 | `checkTimeSheet` — `project.checkTimeSheets()` + query journal com `trackingScenarioIdx` | idem | 2 testes |
| 18.12.5 | Completar `checkStatusSheet(fileName)` | idem | 1 teste |
| 18.12.6 | `checkStatusSheet` — `parseFile(fileName, 'statusSheetFile')` | idem | 1 teste |
| 18.12.7 | Remover `NotYetImplementedError` de ambos | idem | grep retorna 0 |
| 18.12.8 | Teste agregado: `checkTimeSheet` ok + erro | idem | 2 testes |

### 18.13 — Integração `warnOnDelta`

**⚠️ RUBY: `Project.rb` — `@warnTsDeltas` + `@timeSheets.warnOnDelta`.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.13.1 | Verificar que `Project.warnTsDeltas` é setado por `TaskJuggler.schedule()` | `src/model/project.ts` | 2 testes |
| 18.13.2 | Verificar que `Project.schedule()` chama `timeSheets.warnOnDelta()` se `warnTsDeltas` | idem | 2 testes |
| 18.13.3 | Teste: `warnTsDeltas = true` dispara warnings | idem | 1 teste |
| 18.13.4 | Teste: `warnTsDeltas = false` não dispara | idem | 1 teste |

### 18.14 — Verificar conformidade `FileStore`

**📎 ADR 037.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.14.1 | Teste: `fakeOpfs()` satisfaz `FileStore` (tipos) | `packages/core/tests/interfaces/file-store_test.ts` | 1 teste |
| 18.14.2 | Teste: `fakeOpfs().write` + `.read` round-trip | idem | 1 teste |
| 18.14.3 | Teste: `fakeOpfs().mkdir` + `.list` | idem | 1 teste |
| 18.14.4 | Teste: nenhum import de `@syntaxmesh/worker-db` em `packages/core/src/` | grep | retorna 0 |

---

## Bloco F — Golden tests

### 18.15 — Golden tests (timesheets)

**⚠️ RUBY: `TimeSheets.rb` + `Project.checkTimeSheets`.**
**Usa:** `tj3 --check-ts` + `docs/Learning/mwe006/tutorial.tjp`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.15.1 | Criar `scripts/golden/timesheets.rb` | idem | roda |
| 18.15.2 | Cria projeto com 1 recurso, 1 task | idem | JSON válido |
| 18.15.3 | Cria `TimeSheet` com 3 records | idem | ≥ 3 casos |
| 18.15.4 | `timeSheet.check()` — serializa `records`, `total`, `status` | idem | JSON válido |
| 18.15.5 | Testa `warnOnDelta` com bookings | idem | ≥ 5 casos |
| 18.15.6 | Atualizar `deno.jsonc` com `golden:generate` (timesheets) | `deno.jsonc` | roda |
| 18.15.7 | Criar `packages/core/tests/golden/timesheets_golden_test.ts` | idem | verde |
| 18.15.8 | Cobertura ≥ 20 casos; commitar JSON | idem | versionado |

---

## Bloco G — Verificação final

### 18.16 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 18.16.1 | `deno task check-all` verde | exit 0 |
| 18.16.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 18.16.3 | `grep -r "NotYetImplementedError" packages/core/src/timesheet/ packages/core/src/sheets/` = 0 | grep |
| 18.16.4 | `grep -r "NotYetImplementedError" packages/core/src/model/project.ts` — apenas stubs de fases 19+ | ≤ 2 ocorrências |
| 18.16.5 | `grep -r "@syntaxmesh/worker-db" packages/core/src/` = 0 | grep |
| 18.16.6 | ADRs 036 e 037 criados e commitados | git log |
| 18.16.7 | `TimeSheet`, `TimeSheetRecord`, `TimeSheets`, `SheetHandlerBase`, `SheetSender`, `SheetReceiver`, `TimeSheetSender`, `TimeSheetReceiver`, `TimeSheetSummary`, `StatusSheetSender`, `StatusSheetReceiver`, `FileStore` exportados em `packages/core/mod.ts` | `deno check` |
| 18.16.8 | `tests/integration/smoke_after_phase_18_test.ts` — cria `TimeSheet`, adiciona 1 record, verifica `check()`; verifica Fase 17 (`XMLElement`) | 1 teste |
| 18.16.9 | Auditoria: cada subfase do plano `fase-18-time-status-sheets.md` tem tarefas correspondentes | grep |
| 18.16.10 | Corrigir numeração em `fase-18-time-status-sheets.md` (`### 22.X` → `### 18.X`) | grep |

---

## Notas para a IA

1. **Ordem:** 18.0 → 18.1 → 18.2 → 18.3 → 18.4 → 18.5 → 18.6 → 18.7 → 18.8 → 18.9 → 18.10 → 18.11 → 18.12 → 18.13 → 18.14 → 18.15 → 18.16 → (adendos) 18.17 → 18.18 → 18.19 → 18.20.
2. **ADR 036 (sheets browser: texto de email/download)** e **ADR 037 (FileStore injection)** —
   **não** usar 029 (Journal e AlertLevel, Fase 16) nem 031 (Modelo Contábil Estendido).
3. **Core define `FileStore` em `src/interfaces/`.** Storage implementa (Fase 19).
4. **Core não importa `@syntaxmesh/worker-db`** — só em testes.
5. **`fakeOpfs()`** em todos os testes que tocam FS.
6. **`SheetHandlerBase.setFileStore(fs)`** injeta.
7. **`addToScm`** delega ou no-op com warning.
8. **Email → download/upload.** SMTP não existe em browser.
9. **`tj3client` → in-process.** Chamar `Project` diretamente.
10. **YAML → JSON.**
11. **`TimeSheetRecord.work=`** aceita Integer (slots) ou Float (percentual).
12. **`TimeSheet.check`** total deve bater (±1).
13. **`TimeSheetRecord.status`** é `JournalEntry` (Fase 16).
14. **`cutOut`** extrai entre `# --------8<--------`.
15. **`genResourceList`** chama `project.generateReport` in-process.
16. **`processEmail`** aceita anexo ou corpo.
17. **`TaskJuggler.checkTimeSheet`** limpa `timeSheets` e `journal` antes.
18. **`warnOnDelta`** chamado em `Project.schedule` se `warnTsDeltas`.
19. **Parser `timeSheetFile`/`statusSheetFile`** — verificar Fase 10.
20. **Todos os métodos que tocam FS são `async`.**
21. **Sem `any`.** Use `unknown` + narrowing.
22. **Commit por subfase.** `feat(core): time-sheet`, etc.

---

## 18.17 — Adendo Fase 10 Complemento: `material` em sheets + `picture` em `status`

> **Origem:** `fase-10-complemento1.md` §2.5 (impacto Sheets #1) e §6.3 (`picture` em `status`). O parser já aceita `picture`/`format` dentro de `status` (Bloco C3.3.4 de `fase-10-complemento-tarefas.md`); aqui as sheets consomem.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.17.1 | `TimeSheetRecord` aceita `material` como alvo de `work` (→ `MaterialScenario.effortdone`) e `remaining` (→ `effortleft`) — validação individual | `sheets/time-sheet-record.ts` | 3 testes |
| 18.17.2 | Material **NÃO** entra em `totalNetWorkingSlots` (material não tem working hours) — asserir na validação de deltas | `sheets/time-sheet.ts`, `sheets/time-sheets.ts` | 1 teste |
| 18.17.3 | `status` de material via timesheet/statussheet cria `JournalEntry` com `property = Material` (adendo Fase 16) | `sheets/time-sheet-record.ts` | 2 testes |
| 18.17.4 | `SheetSender` lista `material` entre as propriedades que recebem `work`/`remaining`/`status` no template; `SheetReceiver` faz o parse de volta | `sheets/sheet-sender.ts`, `sheets/sheet-receiver.ts` | 2 testes |
| 18.17.5 | `TimeSheetSummary` agrega status de material (contagem, alertas) | `sheets/time-sheet-summary.ts` | 1 teste |
| 18.17.6 | `picture` (e `format`) em `status`: `JournalEntry` do status recebe `pictures`/`format` (modelo C3.3.5); `picture` ausente → comportamento atual inalterado | `sheets/time-sheet-record.ts` | 2 testes |
| 18.17.7 | **Regressão:** timesheets sem material/picture geram resultado idêntico ao atual | testes existentes | verde |
| 18.17.8 | **Status sheet lista materiais** (requisito registrado pela Fase 14 Complemento, 14C.1.18): `StatusSheetReport` emite, por tarefa, as alocações de material e os `MaterialScenario.effortdone`/`effortleft` do cenário de tracking — análogo às linhas de recurso de hoje | `reports/status-sheet-report.ts` | 2 testes (fixture 14c com material + status) |
| 18.17.9 | **`unitprice` no registro de material** (requisito registrado pela Fase 14 Complemento, 14C.11.12): `TimeSheetRecord` de material aceita `unitprice` opcional ao lado de `work`/`remaining`; o registro gera um `MaterialBooking` (14C.11.3) com quantidade, data do record, tarefa dona e o preço informado, anexado a `materialbookings` do cenário. Sem `unitprice` o booking fica com `unitPrice` indefinido e o custo cai para a alocação → material (precedência de `MaterialBooking#unitPriceFor`) | `sheets/time-sheet-record.ts` | 3 testes (com preço, sem preço + precedência, tarefa dona) |
| 18.17.10 | **Parser de sheet com bloco de material completo**: `timeSheetFile`/`statusSheetFile` reconhecem `material "<id>" { work/remaining/unitprice }` (hoje só `work`/`remaining` são previstos) e o `SheetSender` reemite `unitprice` apenas quando presente, preservando o round-trip dos sheets sem preço | `parser/rules/sheet.ts`, `sheets/sheet-sender.ts` | 2 testes (parse do bloco + round-trip) |

**Critério de aceite do adendo:** um `.tjp`/timesheet pode reportar `work`/`remaining` de material sem quebrar a validação de slots; `status` com `picture` chega ao Journal intacto; o status sheet mostra materiais por tarefa; um registro de material com `unitprice` vira `MaterialBooking` e o custo realizado aparece no `materialreport` (`actualcost`).

> **Origem de 18.17.9/18.17.10 (Fase 14 Complemento, 14C.11.12):** a 14C.11 levou o preço unitário para a alocação (`material <id> <q> [modificador] unitprice <p>`) e para o booking (`booking material <id> quantity <q> [unitprice <p>] on <data>`), com precedência booking → alocação → material. O consumo **realizado** chega pelo timesheet, então o preço do booking precisa ser declarável no sheet — caso contrário o `actualcost` do `materialreport` só herda o preço planejado e a variação de preço real fica invisível. Ver `docs/syntaxmesh/fases/fase-14-relatorios-complemento.md` §11.4.

---

## Bloco H — Adendo 2026-11-03 (varredura xray): apps de sheet, `dynamicAttributes`, `checkLevel`

> **Origem:** `docs/syntaxmesh/xray.md` §3.3, §3.4, §3.4.1. Escopo decidido em
> 2026-11-03: o **núcleo** destas três lacunas vive no core **nesta fase**; a
> **Fase 24** empacota para a CLI (subfases 24.9/24.10).

### 18.18 — Núcleo dos apps de sheet (`SheetAppBase` + 5 apps)

**⚠️ RUBY: `Tj3SheetAppBase.rb` + `apps/Tj3Ts{Sender,Receiver,Summary}.rb` + `apps/Tj3Ss{Sender,Receiver}.rb`.**
**📎 ADR 036.** **Consumidor: Fase 24** (não implementar parsing de argv/OptionParser aqui).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.18.1 | `class SheetAppBase` com opções tipadas (`workingDir`, `dryRun`, `config`, `endDate`) e `configureTarget(sheet)` aplicando `AppConfig` em `global` / `timesheets` / `timesheets.<app>` | `sheets/apps/app-base.ts` | 3 testes |
| 18.18.2 | Default de `date` = `TjTime.now().nextDayOfWeek(1).toString('%Y-%m-%d')` (fiel a `Tj3TsSender#initialize`) | `sheets/apps/app-base.ts` | 1 teste |
| 18.18.3 | `TsSenderApp` (`-r/--resource`, `-f/--force`, `intervalDuration`) → devolve `EmailMessage { to, subject, text, html, attachment }` com anexo `.tji` em base64; **sem** qualquer chamada de envio | `sheets/apps/ts-sender-app.ts` | 3 testes |
| 18.18.4 | `TsReceiverApp` consome **texto de mensagem** (string vinda de arquivo/stdin) e extrai o anexo/corpo via `cutOut`/`processEmail` de 18.7 | `sheets/apps/ts-receiver-app.ts` | 3 testes |
| 18.18.5 | `TsSummaryApp` (`-r`, `-t/--to`, `--sheet`, `--digest`) produzindo **textos** de email (um por recurso + digest) | `sheets/apps/ts-summary-app.ts` | 2 testes |
| 18.18.6 | `SsSenderApp` / `SsReceiverApp` análogos para status sheets (`.tjs`) | `sheets/apps/ss-sender-app.ts`, `ss-receiver-app.ts` | 3 testes |
| 18.18.7 | Corpo do email usa `htmlMailBody`/`textMailBody` de `SheetHandlerBase`; onde o Ruby captura stdout com `stdIoWrapper`, usar **16.11** | `sheets/apps/*.ts` | 1 teste |
| 18.18.8 | Códigos de saída fiéis a `Tj3AppBase` (`0`/`1`) expostos como retorno, sem `Deno.exit` no core | `sheets/apps/app-base.ts` | 2 testes |
| 18.18.9 | Exportar os apps em `packages/core/mod.ts` e registrar na F24 que o empacotamento é CLI-only | `mod.ts`, `fase-24-cli.md` §5.4 | `deno check` |

### 18.19 — Pipeline `dynamicAttributes` + `parseReportAttributes`

**⚠️ RUBY: `Project.rb:778-812` + `ProjectFileParser#parseReportAttributes` + `rule_dynamicAttributes` (`TjpSyntaxRules.rb:1034`).**
**📎 xray §3.4.** **Consumidores:** `SheetSender` (18.6) e `wz --report` da **Fase 24**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.19.1 | **Ligar** `report.backupAttributes()` / `report.restoreAttributes(backup)` no pipeline — os métodos **já existem** em `model/property-tree-node.ts` (l.609/619) e `Report` os herda; extrair o alias `AttributeBackup` se quiser nome de tipo (verificado 2026-11-03) | `model/project.ts` (chamadas) | 2 testes de round-trip |
| 18.19.2 | `ProjectFileParser#parseReportAttributes(report, attributes: string)` usando a regra já registrada em `rules/common.ts:784` | `parser/project-file-parser.ts` | 3 testes |
| 18.19.3 | `Project#generateReport(id, regExpMode?, outputDir?, dynamicAttributes?: string)` executando backup → parse → gera → restore quando o argumento existe | `model/project.ts` | 3 testes |
| 18.19.4 | `SheetSender` passa a usar o 4º argumento para as colunas do template (substitui o caminho ad-hoc atual) | `sheets/sheet-sender.ts` | 2 testes |
| 18.19.5 | **Âncoras ADR 032 — feitas em 2026-11-03:** os três `// stub` de `project.ts` já são `// Ancorado: Fase 18 — pipeline dynamicAttributes (xray §3.4)`; ao implementar 18.19.3, remover os comentários | `model/project.ts` | `deno task check:stubs` verde |
| 18.19.6 | Erro de sintaxe em `dynamicAttributes` vira mensagem do `MessageHandler` (não exceção crua) | `parser/project-file-parser.ts` | 1 teste |
| 18.19.7 | Golden: mesmo report com/sem `dynamicAttributes` (comparar com `tj3 -A`) | `scripts/golden/`, `tests/golden/` | ≥ 4 casos |
| 18.19.8 | Registrar na F24 a flag equivalente a `-A` (`wz --report … --attr …`) | `fase-24-cli.md`, `-tarefas.md` | linha presente |

### 18.20 — `MessageHandler#checkLevel`

**⚠️ RUBY: `MessageHandler.rb#checkLevel`.** **📎 xray §3.4.1.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 18.20.1 | Transformar `outputLevel`/`logLevel` em setters com validação `0..5` | `base/message-handler.ts` | `deno check` |
| 18.20.2 | Lançar `TjArgumentError` com a mensagem do Ruby fora do intervalo | idem | 2 testes |
| 18.20.3 | Callers (incl. F18 summary) passam a usar o setter | `sheets/*.ts` | `grep "\.outputLevel ="` só em testes |
| 18.20.4 | `deno task check-all` verde após a mudança | — | exit 0 |

---

**Fim do arquivo de tarefas da Fase 18.**