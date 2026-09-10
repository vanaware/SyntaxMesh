# Fase 9 — Orquestrador e Cache

> **Arquivo:** `docs/syntaxmesh/fases/fase-9-orquestrador-cache.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 8–10 dias
> **Depende de:** Fases 2–8
> **Bloqueia:** Fases 10, 11, 14, 16, 20, 21

---

## 1. Contexto

Até aqui temos **componentes isolados**:
- `TjTime`, `Scoreboard`, `WorkingHours` (Fase 2).
- `AttributeBase` + subclasses (Fase 3).
- `PropertyTreeNode`, `PropertySet`, `Scenario` (Fase 4).
- `Task`, `Resource`, `Account`, `Shift`, `Report` (Fase 5).
- `Limits`, `ShiftAssignments`, `scoreboard-bits` (Fase 6).
- `TaskScenario`, `ResourceScenario`, `Allocation`, `Booking` (Fase 7).
- `Charge`, `ChargeSet`, `AccountScenario` (Fase 8).

O que falta é **colar tudo**: o `Project` que orquestra o pipeline completo (`prepare → schedule → finish`), o `TaskJuggler` top-level que expõe a API, e as infraestruturas de suporte:

- **`PropertyList`** — lista ordenada de propriedades com tree sorting em 2 passes. Usada por reports (Fase 14) e por `Project.schedule` (ordenação das tarefas por prioridade).
- **`MessageHandler`** — coleta de mensagens (fatal, error, warning, info, debug) com níveis de output, log em arquivo, e `abortOnWarning`.
- **`Log`** — logging segmentado com progress meter.
- **`SourceFileInfo`** — referência a posição em arquivo (linha, coluna) para mensagens de erro.
- **`TjException`, `TjRuntimeError`** — hierarquia de exceções.
- **`AppConfig`, `Tj3Config`, `version`** — metadados da aplicação.

Ao final desta fase, o motor **roda de ponta a ponta**: dado um conjunto de `Task`, `Resource`, `Account` etc. (construídos programaticamente ou pelo parser — Fase 10), o `Project.schedule()` produz um cronograma completo.

**Nota:** `DataCache` foi movido para Fase 7 (é pré-requisito do scheduler). Aqui apenas referenciamos.

---

## 2. Objetivo

Ao final desta fase:

- `SourceFileInfo`, `TjException`, `TjRuntimeError`, `AttributeOverwrite` (revisitar).
- `MessageHandler` + `MessageHandlerInstance` (singleton).
- `Log` (segmentação + progress meter).
- `PropertyList` com tree sorting completo.
- `AppConfig`, `Tj3Config`, `version`.
- `Project` — a classe central com **todos** os métodos (schedule, generateReports, idxToDate, dateToIdx, isWorkingTime, etc.).
- `TaskJuggler` top-level — `parse`, `schedule`, `generateReports`, `generateReport`, `checkTimeSheet`, `checkStatusSheet`, `freeze`.
- `MockProject` removido (substituído por `Project` real).
- **≥ 180 testes unitários** + **≥ 30 golden tests** (schedule end-to-end dos 9 MWEs).
- ADR 019 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Project.rb` | ~900 | **Altíssima** | **Crítica** |
| `TaskJuggler.rb` | ~330 | Alta | **Crítica** |
| `PropertyList.rb` | ~250 | Alta | **Crítica** |
| `MessageHandler.rb` | ~280 | Média | **Crítica** |
| `Log.rb` | ~180 | Média | Alta |
| `TjException.rb` | ~30 | Trivial | Alta |
| `TextParser/SourceFileInfo.rb` | ~40 | Trivial | Alta |
| `AppConfig.rb` | ~150 | Baixa | Média |
| `Tj3Config.rb` | ~30 | Trivial | Média |
| `version.rb` | ~1 | Trivial | Baixa |
| `FileList.rb` | ~60 | Baixa | Suporte |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §2 Project (todas as seções) | Estrutura de `Project` |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.5 Pipeline de Scheduling | `schedule()` |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.7 Conversões de Tempo | `idxToDate`/`dateToIdx` |
| `docs/tj3-engine/03-bluprint-engine2.md` | §2 TaskJuggler (top-level) | API |
| `docs/tj3-engine/11-blueprint-apoio.md` | §1 MessageHandler | Sistema de mensagens |
| `docs/tj3-engine/11-blueprint-apoio.md` | §2 Log | Segmentação |
| `docs/tj3-engine/06-blueprint-engine5.md` | §5.3 PropertySet (revisitar) | Container |

### 3.3 Golden tests

Script Ruby `project-schedule.rb` que roda os 9 MWEs **end-to-end** (parse + schedule + generateReports) e extrai:
- Datas de cada task.
- Total effort.
- Valores financeiros (do mwe004).

Teste TS replica programaticamente, chama `Project.schedule()`, compara.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `Project` — `@attributes` como `Map<string, unknown>`

Ruby tem um Hash com defaults específicos. TS: `Map<string, unknown>` inicializado com todos os atributos.

### 4.2 `Project.scenarioCount` como getter

Ruby: `@scenarios.items`. TS: `get scenarioCount(): number { return this.scenarios.items(); }`.

### 4.3 `scenario(arg)` polimórfico

Ruby aceita `Integer` ou `String`. TS: `scenario(arg: number | string): Scenario | null`.

### 4.4 `schedule()` — pipeline exato

O pipeline é crítico:

```
initScoreboards()
↓
para cada PropertySet: index()
↓
para cada cenário ativo:
  AttributeBase.setMode(1)
  prepareScenario(scIdx)
  AttributeBase.setMode(2)
  scheduleScenario(scIdx)
  finishScenario(scIdx)
↓
resources.checkFailsAndWarnings()
tasks.checkFailsAndWarnings()
timeSheets.warnOnDelta()
```

Replicar **exatamente**. Não reordenar, não pular.

### 4.5 `prepareScenario` / `scheduleScenario` / `finishScenario`

Cada um tem uma sequência específica. Ver blueprint §2.5.

### 4.6 `BatchProcessor` — fora de escopo

O Ruby usa `BatchProcessor` (com `fork`) para gerar reports em paralelo. **Browser-only não tem `fork`.** Decisão: gerar reports sequencialmente. Se performance exigir, Web Worker pool em fase futura.

### 4.7 `Log.enter`/`Log.exit` com estado global

Ruby usa `@@stack`, `@@level`. TS: classe estática `Log` com campos estáticos.

### 4.8 `MessageHandler` — singleton via `static instance`

`MessageHandlerInstance` é singleton em Ruby. TS: `static instance` privado com getter.

### 4.9 `MessageHandler` — trap setup

Ruby usa `Thread.current.object_id` para `trapSetup`. Em TS single-threaded, um único `boolean`.

### 4.10 `MessageHandler.baselineSFI`

Ruby usa Hash por thread. TS: um único `SourceFileInfo | null`.

### 4.11 `PropertyList` — `method_missing` delegando para `@items`

Ruby: subclasse de `Array`? Não — composição com `method_missing`. Em TS: **composição explícita**. Métodos delegados implementados manualmente (`length`, `[Symbol.iterator]`, `push`, etc.).

**Alternativa:** estender `Array` mas sobrescrever `map`/`filter`. Complexo. **Decisão:** composição com métodos explícitos.

### 4.12 `PropertyList.sort!` — tree sorting em 2 passes

Ruby:
1. Remove o primeiro critério (`tree`).
2. Ordena pelos demais.
3. Atualiza `index` e `tree`.
4. Re-adiciona `tree` no início.
5. Ordena de novo.

Replicar **exatamente**. Ordem altera resultado.

### 4.13 `PropertyList.addSortingCriteria` valida

Valida que `criteria` é `knownAttribute` ou `hasQuery?`. Também valida `scenarioSpecific` vs `scIdx`.

### 4.14 `TaskJuggler.parse` — multi-file

Ruby aceita múltiplos arquivos. O primeiro é o "master" (contém `project`). Os demais são "properties files" (properties globais).

Em TS: mesmo padrão.

### 4.15 `TaskJuggler.freeze`

Gera arquivo `<master>-bookings.tji`. Depende de reports (`Report` com `export`). **Fase 14**. Nesta fase, stub que lança `NotYetImplementedError`.

### 4.16 `TaskJuggler.checkTimeSheet` / `checkStatusSheet`

Dependem de `TimeSheets` (Fase 18). **Stubs nesta fase.**

### 4.17 `AppConfig` — estático ou instância?

Ruby usa `@@classVariables`. TS: **classe estática** com getters/setters.

### 4.18 `AppConfig.dataDirs` — browser-only

Ruby procura em filesystem. Browser não tem. **Decisão:** `AppConfig.dataDirs(baseDir)` retorna `[]` no browser; o caller (Reports) busca via `fetch()` de assets estáticos. Documentar.

### 4.19 `FileList` — simplificado

Ruby tem `FileList` para detectar modificação de arquivos. No browser, o projeto está em memória. **Decisão:** `FileList` mantém apenas a lista de nomes (sem `mtime`). `modified?` retorna sempre `false`.

### 4.20 `Project.outputDir` — string com barra final

Manter.

### 4.21 `TaskJuggler.parse` — `keepParser` para daemon mode

Browser não tem daemon. **Decisão:** aceitar `keepParser` mas ignorar.

### 4.22 Erros: `TjException` vs `TjRuntimeError`

- `TjException` — erro de aplicação (usado em parser, validações).
- `TjRuntimeError` — erro que **interrompe** o pipeline (fatal em `MessageHandler.error`).

`AttributeOverwrite` estende `TjArgumentError` (Fase 3).

### 4.23 `Project.generateReports` — versão sequencial

Sem `BatchProcessor`. Loop simples.

### 4.24 `Project.schedule()` retorna boolean

`true` se sucesso. `false` em erros fatais.

---

## 5. Subfases detalhadas

---

### 13.0 — ADR 019 (orquestrador e ciclo de modos)

#### Contexto

O `Project.schedule()` tem um detalhe sutil: **alterna o modo global** de `AttributeBase` entre `prepareScenario` (mode 1 = inherited) e `scheduleScenario` (mode 2 = computed). Isso afeta **todos** os atributos globalmente.

Precisamos registrar:
1. A decisão de manter esse padrão (herdado do ADR 013).
2. O pipeline exato do `Project.schedule()`.
3. A ausência de `BatchProcessor` (browser-only).

#### Objetivo

Criar `docs/syntaxmesh/decisoes/019-orquestrador-pipeline.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/019-orquestrador-pipeline.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** explicar `AttributeBase.setMode` e o pipeline.
- [ ] **Decisões:**
  - Manter `mode` global (reforça ADR 013).
  - `Project.schedule()` segue ordem exata do Ruby.
  - Sem `BatchProcessor`; reports sequenciais.
  - `AppConfig.dataDirs` retorna `[]` no browser.
- [ ] **Alternativas:** paralelismo com Web Workers (futuro), `AsyncLocalStorage` para mode.
- [ ] **Consequências:** fidelidade; sem paralelismo de reports.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.5.
- `docs/tj3-engine/03-bluprint-engine2.md` — §2.
- ADR 013, ADR 017.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADR 019 criado.
- Tabela atualizada.

---

### 13.1 — `SourceFileInfo`, `TjException`, `TjRuntimeError`

#### Contexto

Estruturas de suporte. `SourceFileInfo` é usado por `MessageHandler`, `AttributeBase`, `TaskScenario`, etc.

#### Objetivo

Implementar as 3 classes + reorganizar erros.

#### Arquivos

- `packages/core/src/errors.ts` (revisar)
- `packages/core/src/source-file-info.ts`
- `packages/core/tests/source-file-info_test.ts`
- `packages/core/tests/errors_test.ts`

#### Requisitos

**`SourceFileInfo`:**

- [ ] `class SourceFileInfo`:
  - `readonly fileName: string`
  - `readonly lineNo: number`
  - `readonly columnNo: number`
- [ ] Constructor `(fileName, lineNo, columnNo)`.
- [ ] `to_s(): string` → `"${fileName}:${lineNo}:"`.

**`errors.ts`:**

- [ ] `class TjError extends Error`.
- [ ] `class TjArgumentError extends TjError`.
- [ ] `class TjRuntimeError extends TjError`.
- [ ] `class TjInternalError extends TjError`.
- [ ] `class AttributeOverwrite extends TjArgumentError`.
- [ ] `class NotYetImplementedError extends TjError`.

**Nota:** revisar se `TjArgumentError`, etc., já existem em Fase 3; consolidar.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjException.rb`.
- `docs/taskjuggler/lib/taskjuggler/TextParser/SourceFileInfo.rb`.

#### Fora de escopo

- Uso — subfases seguintes.

#### Critério de aceite

```ts
const sfi = new SourceFileInfo("proj.tjp", 42, 5);
assertEquals(sfi.to_s(), "proj.tjp:42:");

const err = new TjArgumentError("invalid");
assert(err instanceof TjArgumentError);
assert(err instanceof TjError);
assert(err instanceof Error);
```

#### Testes

- `source-file-info_test.ts`:
  - `describe("SourceFileInfo")`
    - `it("armazena campos")`.
    - `it("to_s")`.
- `errors_test.ts`:
  - `describe("TjError hierarchy")`
    - `it("TjArgumentError extends TjError")`.
    - `it("TjRuntimeError extends TjError")`.
    - `it("AttributeOverwrite extends TjArgumentError")`.

---

### 13.2 — `MessageHandler` + `MessageHandlerInstance`

#### Contexto

Sistema central de mensagens. Coleta, formata e emite mensagens de 5 tipos. `error` incrementa contador e (em Ruby) chama `exit(1)`; em TS, **lança `TjRuntimeError`**.

#### Objetivo

Implementar `Message` + `MessageHandlerInstance` + mixin/helper.

#### Arquivos

- `packages/core/src/message-handler.ts`
- `packages/core/src/message.ts`
- `packages/core/tests/message-handler_test.ts`

#### Requisitos

**`Message`:**

- [ ] `class Message`:
  - `readonly type: 'fatal' | 'error' | 'warning' | 'info' | 'debug'`
  - `readonly id: string`
  - `readonly message: string`
  - `sourceFileInfo: SourceFileInfo | null`
  - `readonly line: string | null`
  - `readonly data: unknown`
  - `readonly scenario: Scenario | null`
- [ ] `to_s(): string` — formatação colorida (ANSI) para console.
- [ ] `to_log(): string` — formatação para arquivo.

**`MessageHandlerInstance`:**

- [ ] `static instance: MessageHandlerInstance` (getter).
- [ ] `messages: Message[]`.
- [ ] `errors: number` (contador).
- [ ] `outputLevel: number` (0–5).
- [ ] `logLevel: number`.
- [ ] `logFile: string | null`.
- [ ] `hideScenario: boolean`.
- [ ] `abortOnWarning: boolean`.
- [ ] `baselineSFI: SourceFileInfo | null`.
- [ ] `trapSetup: boolean`.
- [ ] `reset(): void`.
- [ ] `clear(): void` — só limpa mensagens e erros.
- [ ] `fatal(id, message, sfi?, line?, data?, scenario?): never` — lança `TjRuntimeError`.
- [ ] `error(id, message, sfi?, line?, data?, scenario?): never` — incrementa errors; se `trapSetup`, lança `TjRuntimeError`; senão, também lança (o Ruby faz `exit(1)`; em TS, sempre lança).
- [ ] `critical(id, message, ...): void` — erro sem lançar.
- [ ] `warning(id, message, ...): void` — se `abortOnWarning`, lança.
- [ ] `info(id, message, ...): void`.
- [ ] `debug(id, message, ...): void`.
- [ ] `to_s(): string` — concatenação.
- [ ] Private `addMessage(type, ...)`.

**Mixin/Helper:**

- [ ] `MessageHandlerLike` interface.
- [ ] Função `createMessageHandler()` que retorna um objeto com `fatal`, `error`, `warning`, `info`, `debug` que delegam para a instância.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/MessageHandler.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.

#### Fora de escopo

- Log em arquivo (`File.open`) — no browser, sem FS. Aceitar `logFile` mas **não escrever**. Log fica em memória.

#### Critério de aceite

```ts
const mh = MessageHandlerInstance.instance;
mh.reset();
mh.warning("w1", "Warning message");
assertEquals(mh.messages.length, 1);
assertEquals(mh.errors, 0);

mh.error("e1", "Error message"); // lança TjRuntimeError
```

#### Testes

- `message-handler_test.ts`:
  - `describe("MessageHandlerInstance")`
    - `it("reset limpa")`.
    - `it("clear mantém config")`.
    - `it("warning não incrementa errors")`.
    - `it("error lança TjRuntimeError")`.
    - `it("fatal lança TjRuntimeError")`.
    - `it("critical incrementa errors sem lançar")`.
    - `it("info não incrementa errors")`.
    - `it("debug não incrementa errors")`.
    - `it("abortOnWarning faz warning lançar")`.
    - `it("baselineSFI ajusta SourceFileInfo")`.
  - `describe("Message")`
    - `it("to_s")`.
    - `it("to_log")`.

---

### 13.3 — `Log`

#### Contexto

`Log` implementa logging segmentado com progress meter. Usado por `Project.schedule()` (via `Log.enter`/`Log.exit`) e por `Log.startProgressMeter`.

#### Objetivo

Implementar `Log` com estado estático.

#### Arquivos

- `packages/core/src/log.ts`
- `packages/core/tests/log_test.ts`

#### Requisitos

- [ ] `class Log` com campos estáticos:
  - `level: number` (0 = desabilitado).
  - `stack: string[]`.
  - `segments: string[]`.
  - `silent: boolean`.
  - `progress: number`.
  - `progressMeter: string`.
- [ ] `enter(segment: string, message: string): void`.
- [ ] `exit(segment: string, message?: string): void`.
- [ ] `msg(block: () => string): void` — só avalia se mensagem vai aparecer.
- [ ] `status(message: string): void`.
- [ ] `startProgressMeter(text: string): void`.
- [ ] `stopProgressMeter(): void`.
- [ ] `activity(): void`.
- [ ] `progress(percent: number): void`.
- [ ] `reset(): void` — para testes.

**Nota:** em browser, o progress meter escreve em `console.error` ou é **no-op**. Decisão: escrever em `console.error` apenas se `Deno.stderr.isTerminal()`. Senão, no-op.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Log.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §2.

#### Fora de escopo

- Progress bar visual (UI) — Fase 20.

#### Critério de aceite

```ts
Log.level = 2;
Log.enter("test", "entering");
Log.msg(() => "message");
Log.exit("test");
// Nenhum throw
```

#### Testes

- `log_test.ts`:
  - `describe("Log")`
    - `it("enter/exit empilha")`.
    - `it("msg não avalia se level 0")`.
    - `it("level limita profundidade")`.
    - `it("segments filtra")`.
    - `it("silent suprime progress")`.
    - `it("reset limpa estado")`.

---

### 13.4 — `PropertyList`

#### Contexto

`PropertyList` é uma lista ordenada de `PropertyTreeNode` com tree sorting em 2 passes. Usada por reports e por `Project.scheduleScenario`.

#### Objetivo

Implementar `PropertyList` completo.

#### Arquivos

- `packages/core/src/model/property-list.ts`
- `packages/core/tests/model/property-list_test.ts`

#### Requisitos

- [ ] `class PropertyList<T extends PropertyTreeNode>`:
  - `private items: T[]`
  - `readonly propertySet: PropertySet<T>`
  - `query: Query | null`
  - `private sortingLevels: number`
  - `private sortingCriteria: string[]`
  - `private sortingUp: boolean[]`
  - `private scenarioIdx: number[]`
- [ ] Constructor `(arg: PropertySet<T> | PropertyList<T>, copyItems = true)`.
- [ ] `toArray(): T[]`.
- [ ] `length(): number`.
- [ ] `get(index: number): T | undefined`.
- [ ] `[Symbol.iterator](): Iterator<T>`.
- [ ] `includes(node: T): boolean`.
- [ ] `find(node: T): T | undefined`.
- [ ] `push(...items: T[]): number`.
- [ ] `append(list: PropertyList<T> | T[]): void`.
- [ ] `delete(index: number): void`.
- [ ] `deleteIf(predicate: (item: T) => boolean): void`.
- [ ] `unique(): void`.
- [ ] `clear(): void`.
- [ ] `includeAdopted(): void`.
- [ ] `checkForDuplicates(sfi: SourceFileInfo): void`.
- [ ] `setSorting(modes: Array<[string, boolean, number]>): void`.
- [ ] `resetSorting(): void`.
- [ ] `treeMode?(): boolean`.
- [ ] `sort!(): void` — **2 passes se tree mode**.
- [ ] `itemIndex(item: T): number`.
- [ ] `index(): void` — atualiza `index` de cada item.
- [ ] `private sortInternal(): void`.
- [ ] `private addSortingCriteria(criteria, up, scIdx): void`.
- [ ] `private indexTree(): void`.

**Algoritmo `sort!` (tree mode):**

1. Remover o primeiro critério (`tree`).
2. `sortInternal()`.
3. `index()` — atualiza `index` de cada item.
4. `indexTree()` — atualiza `tree` de cada item (string de 6 dígitos por nível).
5. Re-adicionar `tree` no início.
6. `sortInternal()`.

**`indexTree`:** `treeIdcs = property.getIndicies()`; concatenar cada `idx.toString().padStart(6, '0')`.

**Validação em `addSortingCriteria`:**

- `knownAttribute(criteria) || hasQuery(criteria, scIdx)`.
- Se `scenarioSpecific(criteria)`, valida `scenario(scIdx)` existe.
- Senão, `scIdx === -1`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyList.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.2.

#### Fora de escopo

- Uso em reports — Fase 14.

#### Critério de aceite

```ts
const list = new PropertyList(project.tasks);
list.setSorting([["tree", true, -1], ["seqno", true, -1]]);
list.sort!();
// Ordem: breakdown structure
```

#### Testes

- `property-list_test.ts`:
  - `describe("PropertyList")`
    - `it("constructor copia items")`.
    - `it("sort! por seqno")`.
    - `it("sort! por priority desc")`.
    - `it("tree mode preserva hierarquia")`.
    - `it("tree mode 2 passes")`.
    - `it("includeAdopted")`.
    - `it("checkForDuplicates detecta duplicatas")`.
    - `it("addSortingCriteria rejeita desconhecido")`.
    - `it("addSortingCriteria valida scenario")`.
    - `it("itemIndex")`.
    - `it("deleteIf")`.

---

### 13.5 — `AppConfig`, `Tj3Config`, `version`

#### Contexto

Metadados da aplicação. `AppConfig` é usado por `HTMLDocument` (Fase 17) para incluir versão nos rodapés.

#### Objetivo

Implementar as 3 classes/arquivos.

#### Arquivos

- `packages/core/src/app-config.ts`
- `packages/core/src/tj3-config.ts`
- `packages/core/src/version.ts`
- `packages/core/tests/app-config_test.ts`

#### Requisitos

**`version.ts`:**

- [ ] `export const VERSION = '0.0.0';` (ou versão atual).

**`AppConfig`:**

- [ ] Classe estática com campos:
  - `version`, `packageName`, `softwareName`, `packageInfo`, `appName`, `authors`, `copyright`, `contact`, `license`.
- [ ] Getters/setters estáticos.
- [ ] `dataDirs(baseDir: string): string[]` — retorna `[]` no browser.
- [ ] `dataSearchDirs(baseDir: string): string[]` — retorna `[]`.
- [ ] `dataFiles(fileName: string): string[]` — retorna `[]`.
- [ ] `dataFile(fileName: string): string | null` — retorna `null`.

**`Tj3Config`:**

- [ ] Inicializa `AppConfig` com valores do TaskJuggler (nome, versão, license, etc.).
- [ ] Exporta uma função `initTj3Config(): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AppConfig.rb`.
- `docs/taskjuggler/lib/taskjuggler/Tj3Config.rb`.
- `docs/taskjuggler/lib/taskjuggler/version.rb`.

#### Fora de escopo

- Uso em HTMLDocument — Fase 17.

#### Critério de aceite

```ts
initTj3Config();
assertEquals(AppConfig.appName, "tj3");
assertEquals(AppConfig.softwareName, "TaskJuggler");
assertEquals(AppConfig.dataDirs("data"), []);
```

#### Testes

- `app-config_test.ts`:
  - `describe("AppConfig")`
    - `it("getters/setters")`.
    - `it("dataDirs retorna [] no browser")`.
  - `describe("initTj3Config")`
    - `it("inicializa metadados")`.

---

### 13.6 — `Project` — estrutura e atributos

#### Contexto

O `Project` é o orquestrador central. Tem ~30 atributos + 6 `PropertySet`s. É o container de tudo.

#### Objetivo

Implementar o **construtor** e **atributos** do `Project`, incluindo os 6 `PropertySet`s e a inicialização das `AttributeDefinition`s.

#### Arquivos

- `packages/core/src/model/project.ts`
- `packages/core/tests/model/project-structure_test.ts`

#### Requisitos

**`Project`:**

- [ ] `class Project implements ProjectLike`.
- [ ] Campos:
  - `id: string`, `name: string`, `version: string`
  - `private attributes: Map<string, unknown>`
  - `scenarios: PropertySet<Scenario>`
  - `shifts: PropertySet<Shift>`
  - `accounts: PropertySet<Account>`
  - `resources: PropertySet<Resource>`
  - `tasks: PropertySet<Task>`
  - `reports: PropertySet<Report>`
  - `inputFiles: string[]`
  - `timeSheets: TimeSheets` (stub nesta fase)
  - `reportContexts: ReportContext[]` (stub)
  - `outputDir: string`
  - `warnTsDeltas: boolean`
  - `scoreboard: Scoreboard<number | null> | null`
  - `scoreboardNoLeaves: Scoreboard<number | null> | null`
  - `resourceAvailability: Scoreboard<boolean> | null`
- [ ] Constructor `(id, name, version)`:
  - `AttributeBase.setMode(0)`.
  - Inicializa `attributes` com todos os defaults (ver `Project.rb`).
  - Cria `scenarios` (flat), registra `registerScenarioAttributes`.
  - Cria `shifts`, `accounts`, `resources`, `tasks`, `reports` (reports é hierárquico).
  - Registra `registerShiftAttributes`, `registerAccountAttributes`, `registerResourceAttributes`, `registerTaskAttributes`, `registerReportAttributes`.
  - Cria `Scenario` inicial `plan`.
- [ ] `get scenarioCount(): number`.
- [ ] `scenario(arg: number | string): Scenario | null`.
- [ ] `scenarioIdx(sc: Scenario | string): number | undefined`.
- [ ] `shift(id)`, `account(id)`, `task(id)`, `resource(id)`, `report(id)`, `reportByName(name)`.
- [ ] `get(name: string): unknown`, `set(name: string, value: unknown): void`.
- [ ] `dailyWorkingHours(): number`.
- [ ] `weeklyWorkingDays(): number`.
- [ ] `monthlyWorkingDays(): number`.
- [ ] `yearlyWorkingDays(): number`.
- [ ] `slotsToDays(slots: number): number`.
- [ ] `convertToDailyLoad(seconds: number): number`.
- [ ] `scoreboardSize(): number`.
- [ ] `idxToDate(idx: number): TjTime`.
- [ ] `dateToIdx(date: TjTime, forceIntoProject = true): number`.
- [ ] `isWorkingTime(...args): boolean`.
- [ ] `hasWorkingTime(...args): boolean`.
- [ ] `workingDays(interval): number`.
- [ ] `getWorkSlots(startIdx, endIdx): number`.
- [ ] `anyResourceAvailable?(sbIdx): boolean`.
- [ ] `collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>`.
- [ ] `attributeName(id): string | undefined`.
- [ ] `journal(query)` — stub (Fase 16).
- [ ] `to_s(): string`.
- [ ] **Registro:** `addScenario`, `addShift`, `addAccount`, `addTask`, `addResource`, `addReport`, `removeAccount`.
- [ ] `static maxScheduleGranularity(): number`.

**Nota:** `Project.get`/`set` sobrescrevem `Map`. Ao `set('start'|'end'|'scheduleGranularity'|'timezone')`, re-inicializa `workinghours`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — construtor + atributos.
- `docs/tj3-engine/02-bluprint-engine1.md` — §2.2.

#### Fora de escopo

- `schedule()` — subfase 13.7.
- `generateReports()` — subfase 13.8.

#### Critério de aceite

```ts
const p = new Project("prj", "Test", "1.0");
assertEquals(p.scenarioCount, 1);
assert(p.scenario(0) !== null);
assertEquals(p.tasks.knownAttribute("effort"), true);
assertEquals(p.reports.knownAttribute("novevents"), true);
```

#### Testes

- `project-structure_test.ts`:
  - `describe("Project")`
    - `it("constrói com cenário inicial")`.
    - `it("registra todos os AttributeDefinitions")`.
    - `it("get/set de atributos")`.
    - `it("set('start') reinicializa workinghours")`.
    - `it("addTask registra em tasks")`.
    - `it("scenarioIdx por id e por cenário")`.
    - `it("dailyWorkingHours")`.
    - `it("maxScheduleGranularity")`.
    - `it("slotsToDays")`.

---

### 13.7 — `Project.schedule`

#### Contexto

O método **mais importante** do projeto. Executa o pipeline completo.

#### Objetivo

Implementar `schedule`, `initScoreboards`, `computeResourceAvailabilities`, `prepareScenario`, `scheduleScenario`, `finishScenario`.

#### Arquivos

- `packages/core/src/model/project.ts` (estender)
- `packages/core/tests/model/project-schedule_test.ts`

#### Requisitos

**`schedule(): boolean`:**

- [ ] `initScoreboards()`.
- [ ] Para cada `PropertySet`: `index()`.
- [ ] Se `tasks.empty()`, error `'no_tasks'`.
- [ ] Para cada cenário em `scenarios`:
  - Se `!scenario.get('active')`, `continue`.
  - `scIdx = scenarioIdx(sc)`.
  - `AttributeBase.setMode(1); this.prepareScenario(scIdx);`
  - `AttributeBase.setMode(2); this.scheduleScenario(scIdx);`
  - `this.finishScenario(scIdx);`
- [ ] Para cada resource: `resource.scenarioData(scIdx).checkFailsAndWarnings()`.
- [ ] Para cada task: `task.scenarioData(scIdx).checkFailsAndWarnings()`.
- [ ] `timeSheets.warnOnDelta()` se `warnTsDeltas`.
- [ ] Retorna `true`.

**`initScoreboards(): void`:**

- [ ] `scoreboard = new Scoreboard(start, end, granularity, 2)`.
- [ ] `scoreboardNoLeaves = new Scoreboard(start, end, granularity, 2)`.
- [ ] Para cada slot: se `workinghours.onShift(date)`, ambos = `null`.
- [ ] Para cada leave global: marca bits.

**`computeResourceAvailabilities(scIdx, usedResources): void`:**

- [ ] Cria `Scoreboard<boolean>`.
- [ ] Para cada idx: se algum `usedResource.available(scIdx, idx)`, `true`.

**`prepareScenario(scIdx): void`:**

- [ ] `Log.enter('prepareScenario', ...)`.
- [ ] `resources = PropertyList(resources)`.
- [ ] `tasks = PropertyList(tasks)`.
- [ ] Coletar `usedResources` (candidatos de todas as tasks).
- [ ] Para cada `usedResource`: `prepareScheduling(scIdx)`, `preScheduleCheck(scIdx)`.
- [ ] Para cada resource: `setDirectReports`, `setReports`.
- [ ] `computeResourceAvailabilities`.
- [ ] Para cada task: `prepareScheduling(scIdx)`.
- [ ] Para cada task: `Xref(scIdx)`.
- [ ] Para cada task: `propagateInitialValues(scIdx)`.
- [ ] Para cada task: `preScheduleCheck(scIdx)`.
- [ ] `resetLoopFlags` para todas, depois `checkForLoops` para top-level (2 passes).
- [ ] `countResourceAllocations` para todas.
- [ ] `calcCriticalness` para resources.
- [ ] `calcCriticalness` para tasks.
- [ ] `calcPathCriticalness` para tasks.
- [ ] `Log.exit`.

**`scheduleScenario(scIdx): void`:**

- [ ] `tasks = PropertyList(tasks)`.
- [ ] `deleteIf(!leaf || milestone || scheduled)`.
- [ ] `setSorting([[priority, false, scIdx], [pathcriticalness, false, scIdx], [seqno, true, -1]])`.
- [ ] `sort!`.
- [ ] Loop:
  - Para cada task em `tasks`: se `readyForScheduling`, `task.schedule(scIdx)`; `taskToRemove = task`; `break`.
  - Se `taskToRemove`, `tasks.delete(taskToRemove)`.
  - Senão, `warning('deadlock')`, `failedTasks = tasks`, `break`.
- [ ] Warnings de `unscheduled_tasks`.

**`finishScenario(scIdx): void`:**

- [ ] Para cada top-level task: `finishScheduling(scIdx)`.
- [ ] Para cada top-level resource: `finishScheduling(scIdx)`.
- [ ] Para cada top-level task: `postScheduleCheck(scIdx)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — `schedule`, `initScoreboards`, `computeResourceAvailabilities`, `prepareScenario`, `scheduleScenario`, `finishScenario`.
- `docs/tj3-engine/02-bluprint-engine1.md` — §2.5, §2.6.

#### Critério de aceite

```ts
const p = new Project("prj", "Test", "1.0");
p.set("start", TjTime.fromString("2026-01-01"));
p.set("end", TjTime.fromString("2026-12-31"));
// ... add tasks, resources ...
assertEquals(p.schedule(), true);
```

#### Testes

- `project-schedule_test.ts`:
  - `describe("Project.schedule")`
    - `it("sem tasks lança erro")`.
    - `it("com 1 task trivial")`.
    - `it("cadeia de 3 tasks ASAP")`.
    - `it("recurso único compartilhado")`.
    - `it("milestone")`.
    - `it("2 cenários")`.
    - `it("mwe001 end-to-end")`.
  - `describe("Project.initScoreboards")`
    - `it("working hours = null")`.
    - `it("global leaves = 4")`.
  - `describe("Project.prepareScenario")`
    - `it("coleta usedResources")`.
    - `it("executa checkForLoops")`.
  - `describe("Project.scheduleScenario")`
    - `it("ordena por priority, pathcriticalness, seqno")`.
    - `it("detecta deadlock")`.

---

### 13.8 — `Project.generateReports` + `generateReport` + `listReports`

#### Contexto

Geração de relatórios. **Simplificado:** sem `BatchProcessor`, sem paralelismo.

#### Objetivo

Implementar `generateReports`, `generateReport`, `listReports`, `checkReports`.

#### Arquivos

- `packages/core/src/model/project.ts` (estender)
- `packages/core/tests/model/project-reports_test.ts`

#### Requisitos

**`generateReports(maxCpuCores: number): void`:**

- [ ] Ignorar `maxCpuCores` (browser).
- [ ] `reports.index()`.
- [ ] Para cada report:
  - Se `formats.empty`, `continue`.
  - `Log.startProgressMeter`.
  - `reportContexts.push(new ReportContext(this, report))`.
  - `report.generate()` (Fase 14).
  - `reportContexts.pop()`.
  - `Log.stopProgressMeter`.
- [ ] `DataCache.instance.flush()`.

**`generateReport(reportId, regExpMode, formats?, dynamicAttributes?): void`:**

- [ ] `reportList = regExpMode ? matchingReports(reportId) : [reportId]`.
- [ ] Para cada id:
  - `report = reports[id]`.
  - Se não existe, `error('unknown_report_id')`.
  - Se `formats === null && formats.empty`, `error('formats_empty')`.
  - `reportContexts.push(context)`.
  - Se `dynamicAttributes`, `context.attributeBackup = report.backupAttributes(); parseReportAttributes(report, dynamicAttributes)`.
  - `report.generate(formats)`.
  - Se `dynamicAttributes`, `report.restoreAttributes(...)`.
  - `reportContexts.pop()`.

**`listReports(reportId, regExpMode): void`:**

- [ ] Similar, apenas `console.log`.

**`checkReports(): void`:**

- [ ] Se `reports.empty()`, `warning('no_report_defined')`.
- [ ] Se `!accounts.empty()`, para cada report sem `balance`, `warning('report_without_balance')`.

**Nota:** `report.generate()` é Fase 14. Aqui, chamamos e esperamos que funcione.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — `generateReports`, `generateReport`, `listReports`, `checkReports`.

#### Fora de escopo

- `Report.generate` real — Fase 14.

#### Critério de aceite

Análogo.

#### Testes

- `project-reports_test.ts`:
  - `describe("Project.checkReports")`
    - `it("warning sem reports")`.
    - `it("warning sem balance")`.
  - `describe("Project.generateReports")`
    - `it("itera reports com formats")`.

---

### 13.9 — `Project` — eventos e utilitários

#### Contexto

`Project` tem métodos utilitários usados por reports e scheduler.

#### Objetivo

Implementar métodos restantes.

#### Arquivos

- `packages/core/src/model/project.ts` (estender)
- `packages/core/tests/model/project-utils_test.ts`

#### Requisitos

- [ ] `enableTraceReports(enable: boolean): void`.
- [ ] `checkTimeSheets(): void`.
- [ ] `isWorkingTime(...args): boolean`.
- [ ] `hasWorkingTime(...args): boolean`.
- [ ] `workingDays(interval: TimeInterval): number`.
- [ ] `getWorkSlots(startIdx, endIdx): number`.
- [ ] `anyResourceAvailable?(sbIdx): boolean`.
- [ ] `collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>`.
- [ ] `attributeName(id): string | undefined`.
- [ ] `journal(query): RichTextIntermediate | null` — stub (Fase 16).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — seções correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- `project-utils_test.ts`:
  - `it("isWorkingTime em working hours")`.
  - `it("hasWorkingTime")`.
  - `it("workingDays")`.
  - `it("getWorkSlots")`.
  - `it("attributeName")`.

---

### 13.10 — `TaskJuggler` (top-level)

#### Contexto

`TaskJuggler` expõe a API pública para CLI/apps. É a fachada.

#### Objetivo

Implementar `TaskJuggler` top-level.

#### Arquivos

- `packages/core/src/taskjuggler.ts`
- `packages/core/tests/taskjuggler_test.ts`

#### Requisitos

- [ ] `class TaskJuggler`:
  - `project: Project | null`
  - `parser: ProjectFileParser | null` (stub nesta fase)
  - `maxCpuCores: number`
  - `warnTsDeltas: boolean`
  - `generateTraces: boolean`
- [ ] Constructor:
  - `TjTime.setTimeZone("UTC")`.
- [ ] `parse(files: string[], keepParser = false): boolean`:
  - **Stub** nesta fase: `throw NotYetImplementedError("Parser vem na Fase 10")`.
- [ ] `parseFile(fileName, rule): unknown` — stub.
- [ ] `schedule(): boolean`:
  - `project.warnTsDeltas = this.warnTsDeltas`.
  - `res = project.schedule()`.
  - `project.enableTraceReports(this.generateTraces)`.
  - Retorna `res`.
- [ ] `generateReports(outputDir?: string): boolean`:
  - `project.checkReports()`.
  - Se `outputDir`, `project.outputDir = outputDir + '/'`.
  - `project.generateReports(this.maxCpuCores)`.
  - Retorna `true`.
- [ ] `generateReport(reportId, regExpMode, formats?, dynamicAttributes?): boolean`:
  - Delega para `project.generateReport`.
- [ ] `listReports(reportId, regExpMode): boolean`:
  - Delega.
- [ ] `freeze(freezeDate: TjTime, taskBookings: boolean): boolean`:
  - **Stub** (`NotYetImplementedError`) — depende de `Report` com `export`.
- [ ] `checkTimeSheet(fileName: string): boolean`:
  - **Stub** — Fase 18.
- [ ] `checkStatusSheet(fileName: string): boolean`:
  - **Stub** — Fase 18.
- [ ] `get projectId(): string | null`.
- [ ] `get projectName(): string | null`.
- [ ] `get errors(): number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §2.

#### Fora de escopo

- `parse` real — Fase 10.
- `freeze`, `checkTimeSheet`, `checkStatusSheet` — Fases 14, 18.

#### Critério de aceite

```ts
const tj = new TaskJuggler();
tj.project = new Project("prj", "Test", "1.0");
// ... setup ...
assertEquals(tj.schedule(), true);
```

#### Testes

- `taskjuggler_test.ts`:
  - `describe("TaskJuggler")`
    - `it("constructor seta UTC")`.
    - `it("parse lança NotYetImplemented")`.
    - `it("schedule delega")`.
    - `it("generateReports delega")`.
    - `it("projectId/projectName")`.

---

### 13.11 — `MockProject` → `Project` real

#### Contexto

A Fase 4 introduziu `MockProject`. Agora que `Project` real existe, todos os testes devem migrar.

#### Objetivo

Remover `MockProject`; adaptar todos os testes existentes.

#### Arquivos

- `packages/core/tests/model/mock-project.ts` — **DELETAR** ou mover para `tests/fixtures/` como wrapper minimal.
- Todos os testes que usam `MockProject` — adaptar.

#### Requisitos

- [ ] `MockProject` **removido** de `src/`.
- [ ] Opcional: `tests/fixtures/create-test-project(scenarioCount)` que instancia `Project` real com config mínima.
- [ ] Todos os testes existentes passam.

**Nota:** este passo é **crítico** — pode quebrar muitos testes. Fazer com cuidado, um arquivo por vez.

#### Referências

- Fases 4, 5, 6, 7, 8.

#### Fora de escopo

- Nada.

#### Critério de aceite

```bash
deno task test
```

- 100% dos testes passam com `Project` real.

#### Testes

- Todos os testes existentes.

---

### 13.12 — Golden tests (end-to-end)

#### Contexto

Validar o pipeline completo (parse? não — `schedule` end-to-end com projetos construídos programaticamente).

#### Objetivo

Rodar os 9 MWEs end-to-end.

#### Arquivos

- `scripts/golden/project-schedule-mwe001.rb`
- ...
- `scripts/golden/project-schedule-mwe009.rb`
- `packages/core/tests/golden/project-schedule.golden.json`
- `packages/core/tests/golden/project-schedule_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Scripts Ruby:**

- [ ] Cada um roda `tj3 mweXXX/tutorial.tjp`.
- [ ] Extrai datas de início/end, effort de cada task do HTML.
- [ ] Serializa.

**Teste TS:**

- [ ] Constrói `Project` programaticamente (parse é Fase 10).
- [ ] Chama `project.schedule()`.
- [ ] Compara.
- [ ] ≥ 30 casos.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/Learning/mwe001-009/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- Parser — Fase 10.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 30 casos.
- Todos passam.

#### Testes

- `project-schedule_golden_test.ts`:
  - `describe("Golden project schedule")` — itera.

---

## 6. Ordem de execução sugerida

```text
13.0  ADR 019
      ↓
13.1  SourceFileInfo + errors
      ↓
13.2  MessageHandler
      ↓
13.3  Log
      ↓
13.5  AppConfig + Tj3Config + version
      ↓
13.4  PropertyList
      ↓
13.6  Project — estrutura e atributos
      ↓
13.7  Project.schedule
      ↓
13.9  Project — eventos e utilitários
      ↓
13.8  Project.generateReports (stub para Fase 14)
      ↓
13.10 TaskJuggler
      ↓
13.11 Migrar MockProject → Project
      ↓
13.12 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 9 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `SourceFileInfo`, `MessageHandler`, `Log` implementados.
- [ ] `PropertyList` completo.
- [ ] `AppConfig`, `Tj3Config`, `version`.
- [ ] `Project` completo (exceto reports reais).
- [ ] `TaskJuggler` top-level.
- [ ] `MockProject` removido.
- [ ] **≥ 180 testes unitários**.
- [ ] **≥ 30 golden tests** end-to-end.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 019 criado.
- [ ] Scripts `project-schedule-mwe*.rb` funcionais.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `Project.schedule` divergir na ordem | **Altíssimo** | Golden tests end-to-end |
| `AttributeBase.setMode` esquecido | Alto | Testes verificam `provided`/`inherited` |
| `PropertyList.sort!` com tree mode 2 passes errado | Alto | Comparar com Ruby |
| Migração `MockProject → Project` quebra testes | Médio | Fazer arquivo por arquivo |
| `MessageHandler.error` lançando em fluxo esperado | Médio | Testes de cada caller |
| `Log` poluindo stdout | Baixo | `silent` em testes |
| `BatchProcessor` removido causa regressão de perf | Médio | Aceitável; Web Worker pool futuro |
| `AppConfig.dataDirs` retornar `[]` quebra reports | Alto | Fase 14 adapta para `fetch()` |
| `checkReports` warning em tests sem accounts | Baixo | Configurar reports com balance |
| `TaskJuggler.parse` stub quebra `schedule` | Médio | Testes usam `project.schedule()` direto |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Project.rb`
- `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb`
- `docs/taskjuggler/lib/taskjuggler/PropertyList.rb`
- `docs/taskjuggler/lib/taskjuggler/MessageHandler.rb`
- `docs/taskjuggler/lib/taskjuggler/Log.rb`
- `docs/taskjuggler/lib/taskjuggler/TjException.rb`
- `docs/taskjuggler/lib/taskjuggler/TextParser/SourceFileInfo.rb`
- `docs/taskjuggler/lib/taskjuggler/AppConfig.rb`
- `docs/taskjuggler/lib/taskjuggler/Tj3Config.rb`
- `docs/taskjuggler/lib/taskjuggler/version.rb`
- `docs/taskjuggler/lib/taskjuggler/FileList.rb`

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §2
- `docs/tj3-engine/03-bluprint-engine2.md` — §2
- `docs/tj3-engine/11-blueprint-apoio.md` — §1, §2

### Documentos do projeto

- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/013-attribute-mode-global.md`
- `docs/syntaxmesh/decisoes/019-orquestrador-pipeline.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/Learning/mwe001-009/`

### Fases dependentes

- **Fase 10 — Parser** (`TaskJuggler.parse` real).
- **Fase 11 — Query** (`Query` usa `MessageHandler`).
- **Fase 14 — Reports** (`Project.generateReports`).
- **Fase 16 — Journal** (`Project.journal`).
- **Fase 21 — Compatibilidade** (golden tests end-to-end).

---

## 10. Notas para a IA

1. **`Project.schedule` é o método mais importante.** Não simplificar.
2. **Ordem de `prepareScenario` importa.** Seguir blueprint §2.5.
3. **`AttributeBase.setMode(1)` antes de prepare, `setMode(2)` antes de schedule.** Sem esquecer.
4. **`initScoreboards` precisa rodar antes de qualquer cenário.** Sem exceção.
5. **`PropertyList.sort!` tree mode é 2 passes.** Sem simplificar.
6. **`MessageHandler.error` sempre lança.** Sem `exit(1)`.
7. **`Log` é estático.** Sem instanciar.
8. **`BatchProcessor` removido.** Reports sequenciais.
9. **`MockProject` removido.** Todos os testes usam `Project` real.
10. **`TaskJuggler.parse` é stub nesta fase.** Fase 10 implementa.
11. **`Project.get('start')` retorna `TjTime | null`.** Cuidado com null em cálculos.
12. **`AppConfig.dataDirs` retorna `[]`.** Fase 14 adapta.
13. **`FileList.modified?` retorna `false` sempre.** Sem filesystem.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **Commit por subfase.** `feat(core): project-schedule`, `feat(core): taskjuggler`, etc.

---

## 11. ADR 019 (referência rápida)

Criado como subfase 13.0. Conteúdo esperado:

- **Título:** Orquestrador e pipeline de scheduling
- **Contexto:** `Project.schedule()` é o pipeline central; alterna `mode` global.
- **Decisões:**
  - Manter `mode` global (reforça ADR 013).
  - Pipeline exato do Ruby.
  - Sem `BatchProcessor`.
  - `AppConfig.dataDirs` retorna `[]` no browser.
- **Alternativas:** `AsyncLocalStorage`, Web Workers.
- **Consequências:** fidelidade + simplicidade; sem paralelismo.

---

**Fim da Fase 9.**