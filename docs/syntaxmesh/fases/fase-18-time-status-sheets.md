# Fase 18 — Time/Status Sheets

> **Arquivo:** `docs/syntaxmesh/fases/fase-18-time-status-sheets.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 8–10 dias
> **Depende de:** Fases 2–17
> **Bloqueia:** Fase 19 (integração), 20

---

## 1. Contexto

O TaskJuggler tem um sistema **email-based** de captura de progresso real:

1. **Time Sheets** — cada recurso reporta horas trabalhadas e status semanalmente.
2. **Status Sheets** — gerentes reportam status consolidado dos seus times.
3. **Templates** são enviados por email; recursos preenchem e devolvem.

Os arquivos `.tji` enviados/recebidos são **arquivos TaskJuggler válidos** com keywords específicas:
- `timesheet <resource> <interval> { ... }` (time sheet).
- `statussheet <resource> <interval> { ... }` (status sheet).
- `task <id> { work X% remaining Yd status green "..." { ... } }`.
- `newtask <id> "..." { ... }` (novas tasks).

O `Project.schedule()` (Fase 9) processa esses `.tji` como entrada, gerando bookings reais.

### Componentes Ruby

| Componente | Função |
|---|---|
| `TimeSheetRecord` | Registro de trabalho em uma task. |
| `TimeSheet` | Conjunto de records de um recurso em um período. |
| `TimeSheets` | Lista de time sheets. |
| `TimeSheetSender` | Gera e envia templates. |
| `TimeSheetReceiver` | Recebe e valida submissões. |
| `TimeSheetSummary` | Resumo consolidado para gerentes. |
| `StatusSheetSender` | Gera templates de status sheet. |
| `StatusSheetReceiver` | Recebe status sheets. |
| `SheetHandlerBase` | Base comuns (email, SCM). |
| `SheetSender` | Base para senders. |
| `SheetReceiver` | Base para receivers. |

### Diferenças no browser

**Crítico:** o TaskJuggler original usa:
- **SMTP** (`Mail` gem) para enviar emails.
- **SCM** (`git`, etc.) para versionar templates.
- **Filesystem** para armazenar templates e submissões.
- **Subprocess** (`tj3client`) para validar arquivos.
- **YAML** para listas de recursos.

No browser, essas capacidades mudam:

| Ruby | Browser (SyntaxMesh) |
|---|---|
| SMTP | Download do `.tji` + Web Share API (futuro) |
| SCM | OPFS via `@syntaxmesh/worker-db` (Fase 19) |
| Filesystem | `FileStore` injetado (Fase 19) |
| `tj3client` | Chamada direta ao `Project` (in-process) |
| YAML | JSON (nativo) |

**Decisão central:** o SyntaxMesh **gera** time sheet templates e **processa** submissões, mas o transporte (email) é responsabilidade do usuário (download/anexar email, ou Web Share API futura). Registrado em ADR 029.

### Injeção de `FileStore` (novo)

O `Core` **não importa** `@syntaxmesh/storage` (ADR 001). Mas `SheetHandlerBase` precisa ler/escrever arquivos (`.tji`, `resources.json`, `all.tji`).

**Solução:** `Core` define a **interface** `FileStore` em `packages/core/src/interfaces/file-store.ts`. `Storage` (Fase 19) fornece a implementação real. Testes usam `fakeOpfs()` do `@syntaxmesh/worker-db`.

`SheetHandlerBase` recebe `FileStore` via `setFileStore(fs)`.

### Validação

Quando um `.tji` é submetido, o parser (Fase 10) o lê, e `Project.checkTimeSheets()` valida:
- Total de trabalho bate com working hours do período.
- `work` + `remaining` = `effort` da task.
- Status obrigatório se `work >= 1 dia`.
- Sem duplicatas de task.

### Integração com `Project`

O `.tji` de time sheet é incluído via `include` (parser) ou parseado separadamente. `Project.timeSheets` (Fase 9, stub) é preenchido nesta fase.

### `TimeSheetRecord.status` é `JournalEntry`

O status de um time sheet record é uma `JournalEntry` (Fase 16). Isso integra time sheets com o journal: submissões alimentam o sistema de tracking.

---

## 2. Objetivo

Ao final desta fase:

- `TimeSheetRecord`, `TimeSheet`, `TimeSheets` completos.
- `SheetHandlerBase`, `SheetSender`, `SheetReceiver`.
- `TimeSheetSender`, `TimeSheetReceiver`, `TimeSheetSummary`.
- `StatusSheetSender`, `StatusSheetReceiver`.
- Adaptações browser: `FileStore` injetado (Fase 19) via interface Core.
- `Project.timeSheets` funcional.
- `Project.checkTimeSheets()` funcional.
- `TaskJuggler.checkTimeSheet` / `checkStatusSheet` completos.
- Parser estendido para `timeSheetFile` / `statusSheetFile` (Fase 10).
- **≥ 140 testes unitários** + **≥ 20 golden tests** (time sheets dos MWEs).
- ADRs 029 e 031 registrados.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `TimeSheets.rb` | ~450 | **Alta** | **Crítica** |
| `TimeSheetSender.rb` | ~120 | Média | Alta |
| `TimeSheetReceiver.rb` | ~40 | Baixa | Alta |
| `TimeSheetSummary.rb` | ~180 | Média | Alta |
| `StatusSheetSender.rb` | ~130 | Média | Alta |
| `StatusSheetReceiver.rb` | ~40 | Baixa | Alta |
| `SheetHandlerBase.rb` | ~300 | **Alta** | **Crítica** |
| `SheetSender.rb` | ~250 | **Alta** | **Crítica** |
| `SheetReceiver.rb` | ~250 | **Alta** | **Crítica** |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/12-blueprint-timesheet.md` | §1 RealFormat | Contexto |
| `docs/tj3-engine/12-blueprint-timesheet.md` | §2 TimeSheets | Estrutura |
| `docs/tj3-engine/12-blueprint-timesheet.md` | §3-5 Sender/Receiver/Summary | Fluxo |

### 3.3 Casos de teste

- `docs/Learning/mwe006/tutorial.tjp` — tracking (bookings, complete, journalentry).
- `docs/taskjuggler/test/TestSuite/TimeSheets/` — casos (se existir).

### 3.4 Golden tests

Scripts Ruby que rodam `tj3` com `--check-ts` / `--check-ss` em `.tji` de exemplo.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Email → download/upload

**SMTP não existe em browser.** Adaptações:

- **Sender**: gera arquivo `.tji` e oferece para download (via Blob + `<a download>`).
- **Receiver**: aceita upload de arquivo `.tji` (via `<input type="file">`) ou drag-and-drop.
- **Web Share API** (futuro): compartilhar via Web Share Level 2 em browsers suportados.
- **Clipboard**: copiar `.tji` para colar em email manualmente.

Registrado em ADR 029.

### 4.2 SCM → `FileStore` injetado (Fase 19)

`addToScm(message, fileName)` faz `git add` no Ruby. Em browser:

- Se `fileStore === null`, no-op + warning.
- Senão, delega ao `FileStore` injetado (que persiste em OPFS via Fase 19).
- Se `scmCommand !== null`, `warning('scm_not_supported_in_browser')`.

### 4.3 `tj3client` → in-process

Ruby usa `Tj3Client.new.main(command)` para chamar o daemon. Em browser, chamamos `Project` diretamente.

`checkTimeSheet(tji)`: parse do `.tji` → `project.checkTimeSheets()` → retorna `{ ok, warnings, report }`.

### 4.4 YAML → JSON

`resources.yml` vira `resources.json`. Parser JSON nativo.

### 4.5 `cutOut` — extração de seção de email

`cutOut(text)` remove assinaturas de email entre marcadores `# --------8<--------`. Replicar.

### 4.6 `sendEmail` / `sendRichTextEmail`

**Stub nesta fase.** Método existe mas:
- Se `dryRun`, retorna o texto.
- Senão, salva em `outbox/` via `FileStore` injetado para o usuário baixar.

Fase 20 (UI) oferece botão de download.

### 4.7 `SheetHandlerBase.log` → no-op

Log em arquivo não existe. Log fica em memória ou `console.log`.

### 4.8 `TimeSheetRecord.work=` — `Integer | Float`

`Integer` = slots diretos. `Float` = percentual (0.0-1.0).

### 4.9 `TimeSheetRecord.check` — validação completa

Validações:
- `work` não null.
- Task com `effort > 0` requer `remaining`.
- Task sem `effort` requer `expectedEnd`.
- New task requer `remaining` ou `expectedEnd`.
- Status obrigatório se `work >= 1 dia`.
- Alert level 1+ requer summary/detalhes.
- Alert level 2 requer detalhes.

### 4.10 `TimeSheet.check` — total de trabalho

Total de `work` deve bater com `totalNetWorkingSlots` (tolerância ±1).

### 4.11 `TimeSheet.totalGrossWorkingSlots` / `totalNetWorkingSlots`

Cálculos:
- `Gross`: `weeklyWorkingDays * weeksToReport`, em slots.
- `Net`: `getAllocatedSlots + getFreeSlots` do resource.

### 4.12 `TimeSheet.percentToSlots` / `slotsToPercent`

Conversões.

### 4.13 `TimeSheetSummary` — resumo

Lê templates e sheets, envia resumo aos digestRecipients.

### 4.14 `SheetSender.genResourceList` — CSV do projeto

Em Ruby, gera CSV via `tj3client` com `resourcereport`. Em browser, **constrói o report diretamente** e chama `report.generate()`.

### 4.15 `SheetSender.enableSignatureForReporting` — assinatura

Adiciona assinatura ao `acceptable_intervals`. Replicar (JSON).

### 4.16 `SheetReceiver.checkSignature` — valida assinatura

Verifica que a assinatura do sheet está em `acceptable_intervals`.

### 4.17 `SheetReceiver.processSheet` — pipeline

1. `cutOut(sheet)`.
2. Valida header (`@sheetHeader` regex).
3. `checkSignature`.
4. Extrai `@resourceId`, `@date`.
5. `getResourceEmail`.
6. `checkSheet` (via `project.checkTimeSheets`).
7. `fileSheet`.
8. Envia confirmação (ou salva em `outbox/` via `FileStore`).

### 4.18 `TimeSheets.warnOnDelta` — warnings

Compara `work` reportado com `plannedWork`; emite warnings.

### 4.19 Parser: keywords `timesheet` / `statussheet`

Fase 10 implementou `rule_timeSheet`, `rule_statusSheet`, `rule_timeSheetFile`, `rule_statusSheetFile`. **Confirmar** que estão completas.

### 4.20 `Project.checkTimeSheets()` — Fase 9 stub

Fase 9 deixou stub. Aqui completamos.

### 4.21 `TaskJuggler.checkTimeSheet` / `checkStatusSheet` — Fase 9 stub

Idem.

### 4.22 `FileStore` — interface em Core

**Novo:** Core define interface `FileStore` em `packages/core/src/interfaces/file-store.ts`.

```ts
export interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
```

**Storage** (Fase 19) fornece implementação real. **Testes** usam `fakeOpfs()` de `@syntaxmesh/worker-db`.

`SheetHandlerBase.setFileStore(fs)` injeta.

### 4.23 `TimeSheetRecord.task` — `Task | string`

`Task` se existente; `string` (id) se nova task.

### 4.24 Erros

`TimeSheet.error(id, text, sfi)` e `warning(id, text, sfi)` delegam para `MessageHandler`.

---

## 5. Subfases detalhadas

**Bloco A — Interface e TimeSheets** (22.0–22.4)
**Bloco B — Sheets base** (22.5–22.7)
**Bloco C — Senders/Receivers** (22.8–22.11)
**Bloco D — Summary** (22.12)
**Bloco E — Integração** (22.13–22.15)
**Bloco F — Golden tests** (22.16)

---

### Bloco A — Interface e TimeSheets

---

### 22.0 — ADRs 029 e 031

#### Contexto

Duas decisões críticas:

1. **ADR 029:** Email → download/upload em browser.
2. **ADR 031:** Injeção de `FileStore` no Core (interface, sem importar Storage).

#### Objetivo

Criar ambos.

#### Arquivos

- `docs/syntaxmesh/decisoes/029-timesheet-browser.md` (novo)
- `docs/syntaxmesh/decisoes/031-filestore-injection.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

**ADR 029 — Time sheets no browser:**

- [ ] **Contexto:** SMTP vs browser.
- [ ] **Decisões:**
  - **Sender**: gera `.tji` + download + Web Share API (futuro).
  - **Receiver**: aceita upload ou drag-and-drop.
  - **SCM**: `FileStore` injetado (Fase 19).
  - **tj3client**: chamada in-process.
  - **YAML** → JSON.
- [ ] **Consequências:** fluxo manual.

**ADR 031 — FileStore injection no Core:**

- [ ] **Contexto:** Core não pode importar Storage (ADR 001). Precisa escrever arquivos.
- [ ] **Decisões:**
  - Core define interface `FileStore` em `packages/core/src/interfaces/file-store.ts`.
  - Storage (Fase 19) implementa.
  - Testes usam `fakeOpfs()` de `@syntaxmesh/worker-db`.
  - Injeção via `setFileStore(fs)` em `SheetHandlerBase`.
- [ ] **Alternativas:** Core importar Storage (viola ADR 001).
- [ ] **Consequências:** desacoplamento; testes rápidos com fake.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`.
- `docs/taskjuggler/lib/taskjuggler/SheetSender.rb`.

#### Critério de aceite

- ADRs 029 e 031 criados.
- Tabela atualizada.

---

### 22.1 — Interface `FileStore` em Core

#### Contexto

Core precisa de acesso a arquivos sem importar Storage.

#### Objetivo

Definir interface.

#### Arquivos

- `packages/core/src/interfaces/file-store.ts`
- `packages/core/tests/interfaces/file-store_test.ts`

#### Requisitos

- [ ] `interface FileStore`:
  - `read(path: string): Promise<string>`.
  - `write(path: string, content: string): Promise<void>`.
  - `delete(path: string): Promise<void>`.
  - `list(dir: string): Promise<string[]>`.
  - `exists(path: string): Promise<boolean>`.
  - `mkdir(path: string): Promise<void>`.
- [ ] `interface KeyValueStore`:
  - `get<T>(key: string): Promise<T | undefined>`.
  - `set<T>(key: string, value: T): Promise<void>`.
  - `del(key: string): Promise<void>`.
  - `keys(): Promise<string[]>`.

**Nota:** essas interfaces são **estruturais** — qualquer objeto que as satisfaça é aceito (TypeScript nominal). `fakeOpfs()` de `worker-db` satisfaz `FileStore`.

#### Referências

- ADR 001, ADR 010, ADR 031.

#### Critério de aceite

```ts
import type { FileStore } from "./interfaces/file-store.ts";
const fs: FileStore = createFakeFileStore();
await fs.write("foo.txt", "bar");
```

#### Testes

- `file-store_test.ts`:
  - `it("interface é estrutural")` — verificar que `fakeOpfs()` satisfaz.

---

### 22.2 — `TimeSheetRecord`

#### Contexto

Registro de trabalho em uma task. Coração das time sheets.

#### Objetivo

Implementar `TimeSheetRecord`.

#### Arquivos

- `packages/core/src/timesheet/time-sheet-record.ts`
- `packages/core/tests/timesheet/time-sheet-record_test.ts`

#### Requisitos

- [ ] `class TimeSheetRecord`:
  - `readonly timeSheet: TimeSheet`
  - `readonly task: Task | string`
  - `work: number | null`
  - `remaining: number | null`
  - `expectedEnd: TjTime | null`
  - `status: JournalEntry | null`
  - `priority: number` (default 0)
  - `name: string | null`
  - `sourceFileInfo: SourceFileInfo | null`
- [ ] Constructor `(timeSheet, task)`:
  - Registra em `timeSheet.push(this)`.
- [ ] `setWork(value: number): void`:
  - Se `Number.isInteger(value)`: slots diretos.
  - Senão: `timeSheet.percentToSlots(value)`.
- [ ] `check(): void`:
  - `work` não null.
  - Se task existente com effort > 0: `remaining` obrigatório.
  - Senão: `expectedEnd` obrigatório.
  - New task: `remaining` ou `expectedEnd`.
  - Status obrigatório se `work >= 1 dia`.
  - Status validações (headline, summary, alertLevel).
- [ ] `warnOnDelta(startIdx, endIdx): void`:
  - Ignora entradas pessoais (task null).
  - Se task é string (new task): warning `ts_res_new_task`.
  - Senão: compara `work` com `plannedWork`; se diferente, warning `ts_res_work_delta`.
  - Se effort task: compara `remaining` com `remainingWork`.
  - Senão: compara `expectedEnd` com `task.end`.
- [ ] `get taskId(): string`.
- [ ] `actualWorkPercent(): number`.
- [ ] `planWorkPercent(): number`.
- [ ] `actualRemaining(): number`.
- [ ] `planRemaining(): number`.
- [ ] `actualEnd(): TjTime | null`.
- [ ] `planEnd(): TjTime`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — `TimeSheetRecord`.
- `docs/tj3-engine/12-blueprint-timesheet.md` — §2.

#### Critério de aceite

```ts
const record = new TimeSheetRecord(timeSheet, task);
record.work = 40 * 3600 / project.get('scheduleGranularity');
record.remaining = 10 * 3600 / project.get('scheduleGranularity');
record.status = new JournalEntry(...);
record.check(); // não lança
```

#### Testes

- `time-sheet-record_test.ts`:
  - `describe("TimeSheetRecord")`
    - `it("constructor registra em timeSheet")`.
    - `it("setWork Integer")`.
    - `it("setWork Float = percentToSlots")`.
    - `it("check sem work lança")`.
    - `it("check effort task sem remaining lança")`.
    - `it("check duration task sem expectedEnd lança")`.
    - `it("check new task sem remaining nem expectedEnd lança")`.
    - `it("check work >= 1 dia sem status lança")`.
    - `it("check status alertLevel 1 sem summary lança")`.
    - `it("check status alertLevel 2 sem details lança")`.
    - `it("warnOnDelta work diferente warning")`.
    - `it("warnOnDelta new task warning")`.
    - `it("actualWorkPercent")`.
    - `it("actualRemaining")`.

---

### 22.3 — `TimeSheet` + `TimeSheets`

#### Contexto

Conjunto de records. Validação total.

#### Objetivo

Implementar `TimeSheet` + `TimeSheets`.

#### Arquivos

- `packages/core/src/timesheet/time-sheet.ts`
- `packages/core/src/timesheet/time-sheets.ts`
- `packages/core/tests/timesheet/time-sheet_test.ts`

#### Requisitos

**`TimeSheet`:**

- [ ] `class TimeSheet`:
  - `readonly resource: Resource`
  - `readonly interval: TimeInterval`
  - `readonly scenarioIdx: number`
  - `sourceFileInfo: SourceFileInfo | null`
  - `private percentageUsed: boolean`
  - `private records: TimeSheetRecord[]`
  - `private messageHandler: MessageHandlerInstance`
- [ ] Constructor `(resource, interval, scenarioIdx)`.
- [ ] `push(record): void` — verifica duplicatas.
- [ ] `check(): void`:
  - Cada record: `check()`.
  - Total `work` = `totalNetWorkingSlots` (±1).
  - Se `efficiency === 0`, total deve ser 0.
- [ ] `warnOnDelta(): void`.
- [ ] `totalGrossWorkingSlots(): number`.
- [ ] `totalNetWorkingSlots(): number`.
- [ ] `percentToSlots(value): number`.
- [ ] `slotsToPercent(slots): number`.
- [ ] `slotsToDays(slots): number`.
- [ ] `daysToSlots(days): number`.
- [ ] `error(id, text, sfi?)`, `warning(id, text, sfi?)`.

**`TimeSheets`:**

- [ ] `class TimeSheets extends Array<TimeSheet>`:
  - `check(): void`.
  - `warnOnDelta(): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — classes `TimeSheet`, `TimeSheets`.

#### Critério de aceite

Análogo.

#### Testes

- `time-sheet_test.ts`:
  - `describe("TimeSheet")`
    - `it("constructor")`.
    - `it("push")`.
    - `it("push duplicata lança")`.
    - `it("check total bate")`.
    - `it("check total muito baixo lança")`.
    - `it("check total muito alto lança")`.
    - `it("check efficiency 0")`.
    - `it("totalGrossWorkingSlots")`.
    - `it("totalNetWorkingSlots")`.
    - `it("percentToSlots")`.
    - `it("slotsToDays")`.
    - `it("daysToSlots")`.
  - `describe("TimeSheets")`
    - `it("check todos")`.
    - `it("warnOnDelta todos")`.

---

### 22.4 — `Project.timeSheets` + `checkTimeSheets`

#### Contexto

Fase 9 deixou stubs.

#### Objetivo

Completar.

#### Arquivos

- `packages/core/src/model/project.ts` (completar)
- `packages/core/tests/model/project-timesheets_test.ts`

#### Requisitos

- [ ] `timeSheets: TimeSheets` — preenchido pelo parser (Fase 10 — `rule_timeSheet`).
- [ ] `checkTimeSheets(): void`:
  - `timeSheets.check()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb`.

#### Critério de aceite

```ts
project.timeSheets.check();
```

#### Testes

- `project-timesheets_test.ts`:
  - `it("checkTimeSheets vazio")`.
  - `it("checkTimeSheets com sheets")`.

---

### Bloco B — Sheets base

---

### 22.5 — `SheetHandlerBase` (com `FileStore` injetado)

#### Contexto

Base de senders e receivers. Configurações de email, working dir, SCM. **Usa `FileStore` injetado.**

#### Objetivo

Implementar `SheetHandlerBase`.

#### Arquivos

- `packages/core/src/sheets/sheet-handler-base.ts`
- `packages/core/tests/sheets/sheet-handler-base_test.ts`

#### Requisitos

- [ ] `class SheetHandlerBase`:
  - `protected appName: string`
  - `emailDeliveryMethod: 'smtp' | 'sendmail' | 'disabled'`
  - `smtpServer: string | null`
  - `senderEmail: string | null`
  - `workingDir: string | null`
  - `scmCommand: string | null`
  - `projectId: string` (default `'prj'`)
  - `outputLevel: 0 | 1 | 2 | 3` (default 2)
  - `logLevel: 0 | 1 | 2 | 3` (default 3)
  - `dryRun: boolean`
  - `logFile: string` (default `'timesheets.log'`)
  - `emailFailure: boolean`
  - `protected fileStore: FileStore | null` — **novo**
- [ ] Constructor `(appName)`.
- [ ] `setFileStore(fs: FileStore): void` — **novo**.
- [ ] `getFileStore(): FileStore | null` — **novo**.
- [ ] `cutOut(text: string): string`:
  - Regex `mark1 = /(.*)# --------8<--------8<--------/`.
  - Regex `mark2 = /# -------->8-------->8--------/`.
  - Extrai entre marcadores.
  - Remove prefixos de quote de email.
- [ ] `setWorkingDir(): void`:
  - Valida SMTP config (warning se não configurado).
  - Valida `senderEmail`.
  - Se `fileStore`, `mkdir(workingDir)` (via FileStore).
- [ ] `addToScm(message, fileName): void`:
  - **NO-OP nesta fase se `scmCommand === null`**.
  - **Se `scmCommand !== null`**, `warning('scm_not_supported_in_browser')`.
  - **Não escreve** (o arquivo já foi escrito via `fileStore.write`).
- [ ] `info(message)`, `warning(message)`, `error(message)`.
- [ ] `log(type, message)` — no-op em browser (ou `console.log`).
- [ ] `sendRichTextEmail(to, subject, message, attachment?, from?, inReplyTo?): Promise<void>`:
  - Se `dryRun`, loga.
  - Senão, salva em `outbox/<to>_<date>.eml` **via `fileStore`**.
  - Se `fileStore === null`, `warning('no_filestore')`.
- [ ] `sendEmail(to, subject, message, attachment?, from?, inReplyTo?): Promise<void>`:
  - Idem.
- [ ] `htmlMailBody(message): string`.
- [ ] **Promise-based:** métodos que tocam `fileStore` retornam `Promise`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb` — arquivo completo.
- `docs/tj3-engine/12-blueprint-timesheet.md` — §1.
- ADR 031.

#### Critério de aceite

```ts
import { fakeOpfs } from "@syntaxmesh/worker-db";

const handler = new SheetHandlerBase("test");
handler.setFileStore(fakeOpfs());
await handler.sendEmail("a@b.com", "Hi", "Body");
// outbox/a@b.com_<date>.eml existe
```

#### Testes

- `sheet-handler-base_test.ts`:
  - `describe("SheetHandlerBase")`
    - `it("constructor defaults")`.
    - `it("setFileStore/getFileStore")`.
    - `it("cutOut extrai entre marcadores")`.
    - `it("cutOut sem marcadores retorna original")`.
    - `it("cutOut remove quote markers")`.
    - `it("setWorkingDir valida config")`.
    - `it("setWorkingDir cria dir via FileStore")`.
    - `it("addToScm no-op sem scmCommand")`.
    - `it("addToScm warning se scmCommand")`.
    - `it("sendEmail em dryRun")`.
    - `it("sendEmail com fakeOpfs escreve em outbox")`.
    - `it("sendEmail sem fileStore warning")`.
    - `it("htmlMailBody")`.

---

### 22.6 — `SheetSender`

#### Contexto

Base para senders. Gera templates.

#### Objetivo

Implementar `SheetSender`.

#### Arquivos

- `packages/core/src/sheets/sheet-sender.ts`
- `packages/core/tests/sheets/sheet-sender_test.ts`

#### Requisitos

- [ ] `class SheetSender extends SheetHandlerBase`:
  - `protected sheetType: 'time' | 'status'`
  - `protected hideResource: string`
  - `protected signatureFile: string`
  - `protected templateDir: string`
  - `force: boolean`
  - `protected signatureFilter: RegExp`
  - `protected mailSubject: string`
  - `protected introText: string`
  - `date: string`
  - `intervalDuration: string` (default `'1w'`)
  - `private timeStamp: Date`
- [ ] Constructor `(appName, type)`.
- [ ] `sendTemplates(resourceList: string[]): Promise<void>`:
  - `setWorkingDir`.
  - `createDirectories` (via `fileStore.mkdir`).
  - `genResourceList(resourceList)`.
  - `genTemplates(resources)`.
  - `sendReportTemplates(resources)`.
- [ ] Private `createDirectories(): Promise<void>`:
  - `fileStore.mkdir('TimeSheetTemplates/<date>')`.
- [ ] Private `genResourceList(resourceList): Promise<Array<[id, name, email, effort, free]>>`:
  - Constrói `resourcereport` com colunas `id, name, email, effort, freework, efficiency`.
  - `hideresource`, `sortresources id.up`, `loadunit days`, `period %{date - 1w} +1w`.
  - Chama `project.generateReport` **in-process**.
  - Parse CSV.
  - Filtra por `email` vazio, `effort === 0 && free === 0`.
  - Salva `resources.json` em `templateDir` **via `fileStore.write`**.
- [ ] Private `genTemplates(resources): Promise<void>`:
  - Para cada resource:
    - Constrói `timesheetreport` ou `statussheetreport`.
    - `hideresource ~(plan.id = "res")`.
    - `period %{date - intervalDuration} +intervalDuration`.
    - `sorttasks id.up`.
    - Chama `project.generateReport` **in-process**.
    - Salva `.tji` **via `fileStore.write`**.
- [ ] Private `sendReportTemplates(resources): Promise<void>`:
  - Para cada resource: lê `.tji` via `fileStore.read`; envia via `sendEmail`.
- [ ] Private `enableSignatureForReporting(templateFile): Promise<void>`.
- [ ] Private `generateReport(id, reportDef): Promise<string>`.
- [ ] **Promise-based.**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/SheetSender.rb` — arquivo completo.
- `docs/tj3-engine/12-blueprint-timesheet.md` — §3.

#### Critério de aceite

Análogo.

#### Testes

- `sheet-sender_test.ts`:
  - `it("sendTemplates")`.
  - `it("genResourceList com 2 resources")`.
  - `it("genResourceList ignora sem email")`.
  - `it("genResourceList salva resources.json")`.
  - `it("genTemplates")`.
  - `it("sendReportTemplates")`.
  - `it("enableSignatureForReporting")`.
  - `it("generateReport")`.

---

### 22.7 — `SheetReceiver`

#### Contexto

Base para receivers. Processa submissões.

#### Objetivo

Implementar `SheetReceiver`.

#### Arquivos

- `packages/core/src/sheets/sheet-receiver.ts`
- `packages/core/tests/sheets/sheet-receiver_test.ts`

#### Requisitos

- [ ] `class SheetReceiver extends SheetHandlerBase`:
  - `protected sheetType: 'time' | 'status'`
  - `protected tj3clientOption: string`
  - `protected sheetDir: string`
  - `protected templateDir: string`
  - `protected failedMailsDir: string`
  - `protected failedSheetsDir: string`
  - `protected signatureFile: string`
  - `protected emailSubject: string`
  - `protected sheetHeader: RegExp`
  - `protected signatureFilter: RegExp`
  - `protected submitter: string | null`
  - `protected resourceId: string | null`
  - `protected date: string | null`
  - `protected sheet: string | null`
  - `protected sheetWasAttached: boolean`
  - `protected messageId: string | null`
- [ ] Constructor `(appName, type)`.
- [ ] `processEmail(rawMail: string): Promise<boolean>`:
  - Parse do email (header + body + attachments).
  - Identifica `submitter`, `messageId`.
  - Tenta anexos `.tji`.
  - Senão, tenta corpo.
- [ ] Private `processSheet(sheet): Promise<boolean>`:
  - `cutOut`.
  - Valida `sheetHeader`.
  - `checkSignature`.
  - Extrai `resourceId`, `date`.
  - `getResourceEmail`.
  - `checkSheet`.
  - `fileSheet`.
- [ ] Private `checkSheet(sheet): Promise<boolean>`:
  - Salva em `failedSheetsDir` via `fileStore.write`.
  - Parse `.tji`.
  - Chama `project.checkTimeSheets()`.
  - Se ok, retorna true; senão, `error(warnings)`.
- [ ] Private `fileSheet(sheet): Promise<void>`:
  - Salva em `sheetDir/<date>/<resourceId>_<date>.tji` via `fileStore.write`.
  - Gera `all.tji` na pasta.
  - Envia confirmação.
- [ ] Private `checkSignature(sheet): Promise<void>`.
- [ ] Private `createDirectories(): Promise<void>`.
- [ ] Private `getResourceList(): Promise<Array<[id, name, email]>>` — lê `resources.json` via `fileStore.read`.
- [ ] Private `getResourceEmail(id)`, `getResourceName(id)`.
- [ ] **Promise-based.**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/SheetReceiver.rb` — arquivo completo.
- `docs/tj3-engine/12-blueprint-timesheet.md` — §4.

#### Critério de aceite

Análogo.

#### Testes

- `sheet-receiver_test.ts`:
  - `it("processEmail com anexo")`.
  - `it("processEmail com body")`.
  - `it("processEmail sem sheet lança")`.
  - `it("checkSignature válido")`.
  - `it("checkSignature inválido lança")`.
  - `it("checkSheet ok")`.
  - `it("checkSheet erros lança")`.
  - `it("fileSheet via fileStore")`.
  - `it("createDirectories via fileStore")`.

---

### Bloco C — Senders/Receivers específicos

---

### 22.8 — `TimeSheetSender`

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/sheets/time-sheet-sender.ts`
- `packages/core/tests/sheets/time-sheet-sender_test.ts`

#### Requisitos

- [ ] `class TimeSheetSender extends SheetSender`:
  - Constructor `(appName)`:
    - `super(appName, 'time')`.
    - `hideResource = '0'`.
    - `templateDir = 'TimeSheetTemplates'`.
    - `signatureFile = '<templateDir>/acceptable_intervals'`.
    - `logFile = 'timesheets.log'`.
    - `signatureFilter = /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/`.
    - `introText = ...`.
    - `mailSubject = 'Your weekly time sheet template for %s'`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TimeSheetSender.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `time-sheet-sender_test.ts`:
  - `it("constructor defaults")`.
  - `it("signatureFilter")`.
  - `it("mailSubject")`.

---

### 22.9 — `TimeSheetReceiver`

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/sheets/time-sheet-receiver.ts`
- `packages/core/tests/sheets/time-sheet-receiver_test.ts`

#### Requisitos

- [ ] `class TimeSheetReceiver extends SheetReceiver`:
  - Constructor `(appName)`:
    - `super(appName, 'time')`.
    - `tj3clientOption = 'check-ts'`.
    - `sheetDir = 'TimeSheets'`.
    - `templateDir = 'TimeSheetTemplates'`.
    - `failedMailsDir = 'TimeSheets/FailedMails'`.
    - `failedSheetsDir = 'TimeSheets/FailedSheets'`.
    - `signatureFile = 'TimeSheetTemplates/acceptable_intervals'`.
    - `logFile = 'timesheets.log'`.
    - `sheetHeader = /^[ ]*timesheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/`.
    - `signatureFilter = /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/`.
    - `emailSubject = 'Report from %s for %s'`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `time-sheet-receiver_test.ts`:
  - `it("constructor defaults")`.
  - `it("sheetHeader matches")`.

---

### 22.10 — `StatusSheetSender` + `StatusSheetReceiver`

#### Objetivo

Implementar ambos.

#### Arquivos

- `packages/core/src/sheets/status-sheet-sender.ts`
- `packages/core/src/sheets/status-sheet-receiver.ts`
- `packages/core/tests/sheets/status-sheet-sender_test.ts`

#### Requisitos

**`StatusSheetSender`:**

- [ ] Constructor `(appName)`:
  - `super(appName, 'status')`.
  - `hideResource = '0'`.
  - `templateDir = 'StatusSheetTemplates'`.
  - `timeSheetDir = 'TimeSheets'`.
  - `signatureFile = 'StatusSheetTemplates/acceptable_intervals'`.
  - `signatureFilter = /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/`.
  - `introText = ...`.
  - `mailSubject = 'Your weekly status report template for %s'`.
- [ ] `defaulterList(): Promise<string[]>`:
  - Glob via `fileStore.list('TimeSheets')`.
  - Encontra último `< repDate`.
  - Lê `missing-reports`.
  - Filtra os que já submeteram.

**`StatusSheetReceiver`:**

- [ ] Constructor `(appName)`:
  - Análogo a `TimeSheetReceiver`, mas com regex de `statussheet`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb`.
- `docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `status-sheet-sender_test.ts`:
  - `it("constructor defaults")`.
  - `it("defaulterList vazio")`.
  - `it("defaulterList com missing-reports")`.

---

### Bloco D — Summary

---

### 22.11 — `TimeSheetSummary`

#### Objetivo

Implementar.

#### Arquivos

- `packages/core/src/sheets/time-sheet-summary.ts`
- `packages/core/tests/sheets/time-sheet-summary_test.ts`

#### Requisitos

- [ ] `class TimeSheetSummary extends SheetReceiver`:
  - `date: string`
  - `sheetRecipients: string[]`
  - `digestRecipients: string[]`
  - `hideResource: string`
  - `templateDir: string`
  - `sheetDir: string`
  - `logFile: string`
  - `resourceIntro: string`
  - `resourceSheetSubject: string`
  - `summarySubject: string`
  - `reminderSubject: string`
  - `reminderText: string`
  - `defaulterHeader: string`
- [ ] Constructor.
- [ ] `sendSummary(resourceIds: string[]): Promise<void>`:
  - Para cada resource em `getResourceList()`:
    - Se não em `resourceIds`, skip.
    - Se template existe (via `fileStore.exists`):
      - Se sheet existe: `getResourceJournal(sheetFile)` + append ao summary + envia para sheetRecipients.
      - Senão: adiciona à defaulterList.
  - Prepend defaulter list ao summary.
  - Salva `missing-reports` via `fileStore.write`.
  - Envia summary para digestRecipients.
  - Envia reminder para defaulters.
- [ ] Private `sendReminder(id, name, email): Promise<void>`.
- [ ] Private `getResourceJournal(sheetFile): Promise<string>`:
  - Parse `.tji`.
  - Query journal.
  - Retorna RichText string.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb` — arquivo completo.
- `docs/tj3-engine/12-blueprint-timesheet.md` — §5.

#### Critério de aceite

Análogo.

#### Testes

- `time-sheet-summary_test.ts`:
  - `it("constructor defaults")`.
  - `it("sendSummary sem sheets")`.
  - `it("sendSummary com sheet")`.
  - `it("sendSummary gera missing-reports")`.
  - `it("sendReminder")`.
  - `it("getResourceJournal")`.

---

### Bloco E — Integração

---

### 22.12 — Completar `TaskJuggler.checkTimeSheet` / `checkStatusSheet`

#### Contexto

Fase 9 deixou stubs.

#### Objetivo

Completar.

#### Arquivos

- `packages/core/src/taskjuggler.ts` (completar)
- `packages/core/tests/taskjuggler-timesheet_test.ts`

#### Requisitos

- [ ] `checkTimeSheet(fileName: string): Promise<boolean>`:
  - `project.timeSheets.clear()`.
  - `project.journal = new Journal()`.
  - `ts = await parseFile(fileName, 'timeSheetFile')`.
  - `project.checkTimeSheets()`.
  - Query journal com `trackingScenarioIdx`.
  - Retorna true se ok.
- [ ] `checkStatusSheet(fileName: string): Promise<boolean>`.
- [ ] **Promise-based.**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `taskjuggler-timesheet_test.ts`:
  - `it("checkTimeSheet ok")`.
  - `it("checkTimeSheet erro")`.
  - `it("checkStatusSheet ok")`.

---

### 22.13 — `TimeSheetRecord.warnOnDelta` — integração

#### Objetivo

Verificar integração com `Project.schedule`.

#### Arquivos

- `packages/core/src/model/project.ts` (verificar).
- `packages/core/tests/model/project-warn-ts-deltas_test.ts`

#### Requisitos

- [ ] `Project.warnTsDeltas` setado por `TaskJuggler.schedule()`.
- [ ] `timeSheets.warnOnDelta()` chamado ao final de `schedule()`.

#### Critério de aceite

Análogo.

#### Testes

- `project-warn-ts-deltas_test.ts`:
  - `it("warnTsDeltas true")`.
  - `it("warnTsDeltas false")`.

---

### 22.14 — Verificar interface `FileStore`

#### Contexto

Confirmar que a interface `FileStore` de Core satisfaz `fakeOpfs()`.

#### Objetivo

Testes de conformidade.

#### Arquivos

- `packages/core/tests/interfaces/file-store_test.ts`

#### Requisitos

- [ ] `describe("FileStore")`
  - `it("fakeOpfs satisfaz FileStore")`.
  - `it("fakeOpfs write/read")`.
  - `it("fakeOpfs mkdir/list")`.

#### Referências

- ADR 031.

#### Critério de aceite

Análogo.

---

### Bloco F — Golden tests

---

### 22.15 — Golden tests (timesheets)

#### Contexto

Validar contra `tj3`.

#### Objetivo

Scripts Ruby.

#### Arquivos

- `scripts/golden/timesheets.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/timesheets.golden.json`
- `packages/core/tests/golden/timesheets_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Script Ruby:**

- [ ] Cria projeto com 1 recurso, 1 task.
- [ ] Cria `TimeSheet` com 3 records.
- [ ] `timeSheet.check()`.
- [ ] Serializa `records`, `total`, `status`.
- [ ] Testa `warnOnDelta` com bookings.

**Teste TS:**

- [ ] Compara.
- [ ] ≥ 20 casos.

#### Referências

- `docs/Learning/mwe006/tutorial.tjp`.
- Fase 2, subfase 5.14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 20 casos.
- Todos passam.

#### Testes

- `timesheets_golden_test.ts`:
  - `describe("Golden TimeSheets")` — itera.

---

## 6. Ordem de execução sugerida

```text
22.0  ADRs 029 e 031
22.1  Interface FileStore em Core
      ↓
22.2  TimeSheetRecord
22.3  TimeSheet + TimeSheets
22.4  Project.timeSheets + checkTimeSheets
      ↓
22.5  SheetHandlerBase (com FileStore injetado)
22.6  SheetSender
22.7  SheetReceiver
      ↓
22.8  TimeSheetSender
22.9  TimeSheetReceiver
22.10 StatusSheetSender + StatusSheetReceiver
      ↓
22.11 TimeSheetSummary
      ↓
22.12 Completar TaskJuggler.checkTimeSheet / checkStatusSheet
22.13 Integração warnOnDelta
22.14 Verificar interface FileStore
      ↓
22.15 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 18 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `TimeSheetRecord`, `TimeSheet`, `TimeSheets` completos.
- [ ] `SheetHandlerBase`, `SheetSender`, `SheetReceiver`.
- [ ] `TimeSheetSender`, `TimeSheetReceiver`, `TimeSheetSummary`.
- [ ] `StatusSheetSender`, `StatusSheetReceiver`.
- [ ] Interface `FileStore` em Core (ADR 031).
- [ ] Adaptações browser (`FileStore` injetado, in-process, JSON).
- [ ] `Project.timeSheets` + `checkTimeSheets` completos.
- [ ] `TaskJuggler.checkTimeSheet` / `checkStatusSheet` completos.
- [ ] **≥ 140 testes unitários**.
- [ ] **≥ 20 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADRs 029 e 031 criados.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| `FileStore` de Core não bate com `fakeOpfs()` | Alto | Teste de conformidade (22.14) |
| Core importar `@syntaxmesh/worker-db` por engano | **Alto** | Só interface; `fakeOpfs` só em testes |
| SMTP não disponível | Alto | Stub + download (ADR 029) |
| `checkSheet` in-process divergir do `tj3client` | Médio | Golden tests |
| `TimeSheet.check` com total errado | Alto | Golden tests |
| `warnOnDelta` com bookings | Médio | Testes específicos |
| Parser `timeSheetFile` incompleto | Alto | Verificar Fase 10 |
| `TimeSheetRecord.status` como `JournalEntry` | Médio | Fase 16 completa |
| `defaulterList` com datas | Médio | Testes com glob |
| `htmlMailBody` sem CSS externo | Baixo | Inline CSS |
| `sendEmail` sem SMTP | Alto | Stub documentado |
| `addToScm` sem `FileStore` | Médio | Warning claro |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb`
- `docs/taskjuggler/lib/taskjuggler/TimeSheetSender.rb`
- `docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb`
- `docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb`
- `docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb`
- `docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb`
- `docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb`
- `docs/taskjuggler/lib/taskjuggler/SheetSender.rb`
- `docs/taskjuggler/lib/taskjuggler/SheetReceiver.rb`

### Blueprints

- `docs/tj3-engine/12-blueprint-timesheet.md` — §1-5

### Documentos do projeto

- `docs/syntaxmesh/decisoes/029-timesheet-browser.md` (novo)
- `docs/syntaxmesh/decisoes/031-filestore-injection.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/Learning/mwe006/tutorial.tjp`

### Fases dependentes

- **Fase 19 — Storage** (implementa `FileStore` real).
- **Fase 20 — UI** (download/upload de `.tji`).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **Core define `FileStore` em `interfaces/`.** Storage implementa.
2. **Core não importa `@syntaxmesh/worker-db`.** Só em testes.
3. **`fakeOpfs()` de `worker-db`** em todos os testes que tocam FS.
4. **`SheetHandlerBase.setFileStore(fs)`** injeta.
5. **`addToScm`** delega (se `scmCommand`) ou no-op com warning.
6. **Email → download/upload.** SMTP não existe em browser.
7. **`tj3client` → in-process.** Chamar `Project` diretamente.
8. **YAML → JSON.**
9. **`TimeSheetRecord.work=`** aceita `Integer` (slots) ou `Float` (percentual).
10. **`TimeSheet.check`** total deve bater com net working slots (±1).
11. **`TimeSheetRecord.status`** é `JournalEntry` (Fase 16).
12. **`SheetHandlerBase.cutOut`** extrai entre `# --------8<--------`.
13. **`SheetSender.genResourceList`** chama report in-process; salva `resources.json` via `fileStore`.
14. **`SheetReceiver.processEmail`** aceita anexo ou corpo.
15. **`TimeSheetSummary.getResourceJournal`** chama report in-process.
16. **`TaskJuggler.checkTimeSheet`** limpa journal antes.
17. **`warnOnDelta`** chamado em `Project.schedule` se `warnTsDeltas`.
18. **Parser `timeSheetFile` / `statusSheetFile`** — verificar Fase 10.
19. **Todos os métodos que tocam FS são `async`.**
20. **Sem `any`.** Use `unknown` + narrowing.
21. **Commit por subfase.** `feat(core): time-sheet`, etc.

---

## 11. ADRs (referência rápida)

**ADR 029 — Time sheets no browser: download/upload em vez de SMTP:**

- **Contexto:** SMTP não existe em browser.
- **Decisões:**
  - Sender: download + Web Share API (futuro).
  - Receiver: upload ou drag-and-drop.
  - SCM: `FileStore` injetado.
  - tj3client: in-process.
  - YAML → JSON.
- **Consequências:** fluxo manual.

**ADR 031 — FileStore injection no Core:**

- **Contexto:** Core não pode importar Storage (ADR 001). Precisa escrever arquivos.
- **Decisões:**
  - Core define interface `FileStore`.
  - Storage implementa.
  - Testes usam `fakeOpfs()`.
  - Injeção via `setFileStore(fs)`.
- **Alternativas:** Core importar Storage (viola ADR 001).
- **Consequências:** desacoplamento; testes rápidos.

---

**Fim da Fase 18 (corrigida).**