# Fase 9 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-9-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-9-orquestrador-cache.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~195 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Project,TaskJuggler,PropertyList,MessageHandler,Log,TjException,AppConfig,Tj3Config,version,FileList}.rb` + `TextParser/SourceFileInfo.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (Fase 7).
- **ADR 019** — Modelo financeiro (Fase 8).
- **ADR 020** — Orquestrador e pipeline (**criado nesta fase**).

### Convenções CRÍTICAS

- **`AttributeBase.setMode(0)` em `beforeEach`** — sem isso, testes vazam estado.
- **`Project.schedule` é o método mais importante do projeto.** Não simplificar.
- **Ordem de `prepareScenario` importa.** Seguir blueprint §2.5.
- **`AttributeBase.setMode(1)` antes de `prepareScenario`, `setMode(2)` antes de `scheduleScenario`.**
- **`initScoreboards` precisa rodar antes de qualquer cenário.**
- **`PropertyList.sort!` tree mode é 2 passes.**
- **`MessageHandler.error` sempre lança (`TjRuntimeError`).** Sem `exit(1)`.
- **`Log` é estático.** Sem instanciar.
- **`BatchProcessor` removido.** Reports sequenciais.
- **`MockProject` será removido.** Todos os testes usarão `Project` real.
- **`TaskJuggler.parse` é stub nesta fase.** Fase 10 implementa.
- **`Project.get('start')` retorna `TjTime | null`.** Cuidado com null em cálculos.
- **`AppConfig.dataDirs` retorna `[]`.** Fase 14 adapta.
- **`FileList.modified?` retorna `false` sempre.** Sem filesystem.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar `Proxy` (ADR 015).
- ❌ Não usar `AsyncLocalStorage` (a decisão é `static` — ADR 014).
- ❌ Não implementar `BatchProcessor`.
- ❌ Não usar `Deno.exit` — sempre `throw TjRuntimeError`.
- ❌ Não criar `Log` como instância.
- ❌ Não pular `initScoreboards`.
- ❌ Não reordenar o pipeline de `schedule`.

---

## Progresso

```
[ ] 9.0  ADR 020 (orquestrador e pipeline)         —  0/5
[ ] 9.1  SourceFileInfo + erros                    —  0/10
[ ] 9.2  MessageHandler + MessageHandlerInstance   —  0/20
[ ] 9.3  Log                                       —  0/12
[ ] 9.4  AppConfig + Tj3Config + version           —  0/10
[ ] 9.5  PropertyList                              —  0/28
[ ] 9.6  Project — estrutura e atributos           —  0/24
[ ] 9.7  Project.schedule                          —  0/26
[ ] 9.8  Project — generateReports + utils         —  0/18
[ ] 9.9  TaskJuggler top-level                     —  0/14
[ ] 9.10 Migrar MockProject → Project              —  0/8
[ ] 9.11 Golden tests end-to-end                   —  0/10
[ ] 9.12 Verificação final                         —  0/10
────────────────────────────────────────────────────
TOTAL: ~195
```

---

## Bloco A — Fundação

### 9.0 — ADR 020 (orquestrador e pipeline)

**Objetivo:** formalizar o pipeline de `Project.schedule()` e a decisão de manter `mode` global.

**⚠️ Nota:** o plano usa `ADR 019`, mas o ADR 019 foi alocado para `modelo-financeiro` (Fase 8). Aqui usamos **ADR 020**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.0.1 | Criar `docs/syntaxmesh/decisoes/020-orquestrador-pipeline.md` com frontmatter | idem | arquivo existe |
| 9.0.2 | Seção **Contexto:** `Project.schedule()` é o pipeline central; alterna `mode` global (ADR 014) | idem | — |
| 9.0.3 | Seção **Decisão 1:** manter `mode` global (reforça ADR 014) | idem | — |
| 9.0.4 | Seção **Decisão 2:** pipeline exato do Ruby (`initScoreboards` → `index` → por cenário: `setMode(1) → prepareScenario → setMode(2) → scheduleScenario → finishScenario`); **Decisão 3:** sem `BatchProcessor`; reports sequenciais; **Decisão 4:** `AppConfig.dataDirs` retorna `[]` no browser | idem | — |
| 9.0.5 | Seções **Alternativas** (`AsyncLocalStorage`, Web Workers) + **Consequências**; atualizar linha `020` em `decisoes/README.md` | idem | 20 linhas |

---

### 9.1 — `SourceFileInfo` + erros

**⚠️ RUBY: `TjException.rb` (~30 linhas), `TextParser/SourceFileInfo.rb` (~40 linhas)**
**🔎 CHEAT: §7 (exceções), §2 (classes)**

**Pré-requisitos:** nenhum (mas consolidar com Fase 3 `errors.ts`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.1.1 | Criar `src/source-file-info.ts` com `class SourceFileInfo` vazia | idem | `deno check` |
| 9.1.2 | Campos `readonly fileName: string`, `readonly lineNo: number`, `readonly columnNo: number` | idem | `deno check` |
| 9.1.3 | Constructor `(fileName, lineNo, columnNo)` — valida `lineNo >= 0`, `columnNo >= 0` | idem | 3 testes |
| 9.1.4 | ⚠️ `to_s(): string` = `"${fileName}:${lineNo}:"` | idem | 3 testes |
| 9.1.5 | Revisar `src/attributes/errors.ts` (Fase 3) — garantir hierarquia completa | idem | `deno check` |
| 9.1.6 | ⚠️ `class TjError extends Error` — base | idem | 1 teste |
| 9.1.7 | ⚠️ `class TjArgumentError extends TjError` — validação | idem | 1 teste |
| 9.1.8 | ⚠️ `class TjRuntimeError extends TjError` — erro que interrompe pipeline | idem | 1 teste |
| 9.1.9 | ⚠️ `class TjInternalError extends TjError` — situações impossíveis | idem | 1 teste |
| 9.1.10 | Re-exportar `SourceFileInfo` e erros em `packages/core/mod.ts` | `src/mod.ts` | `deno check` |

---

### 9.2 — `MessageHandler` + `MessageHandlerInstance` + `Message`

**⚠️ RUBY: `MessageHandler.rb` (arquivo inteiro — ~280 linhas)**
**🔎 CHEAT: §3 `@@classvar` → `static`, §7 (exceções)**

**Pré-requisitos:** 9.1.

#### 9.2.1 — `Message`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.2.1.1 | Criar `src/message.ts` com `type MessageType = 'fatal' \| 'error' \| 'warning' \| 'info' \| 'debug'` | idem | `deno check` |
| 9.2.1.2 | Criar `class Message` com campos `readonly type`, `readonly id`, `readonly message`, `sourceFileInfo`, `readonly line`, `readonly data`, `readonly scenario` | idem | `deno check` |
| 9.2.1.3 | Constructor `(type, id, message, sfi?, line?, data?, scenario?)` | idem | 3 testes |
| 9.2.1.4 | ⚠️ `to_s(): string` — formatação colorida (ANSI) para console | idem | 4 testes (por tipo) |
| 9.2.1.5 | ⚠️ `to_log(): string` — formatação para arquivo | idem | 4 testes |
| 9.2.1.6 | Teste: `to_s` inclui `baselineSFI` se houver | idem | 1 teste |

#### 9.2.2 — `MessageHandlerInstance` — campos e config

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.2.2.1 | Criar `src/message-handler.ts` com `class MessageHandlerInstance` | idem | `deno check` |
| 9.2.2.2 | ⚠️ `static instance: MessageHandlerInstance` (getter, singleton) | idem | 2 testes |
| 9.2.2.3 | Campos `messages: Message[]`, `errors: number`, `outputLevel`, `logLevel`, `logFile`, `hideScenario`, `abortOnWarning`, `baselineSFI`, `trapSetup` | idem | `deno check` |
| 9.2.2.4 | ⚠️ `reset(): void` — reseta **todos** os campos para defaults | idem | 3 testes |
| 9.2.2.5 | ⚠️ `clear(): void` — limpa `messages` e zera `errors`, mantém config | idem | 3 testes |

#### 9.2.3 — `MessageHandlerInstance` — métodos de mensagem

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.2.3.1 | ⚠️ `fatal(id, message, sfi?, line?, data?, scenario?): never` — cria `Message` + lança `TjRuntimeError` | idem | 3 testes |
| 9.2.3.2 | ⚠️ `error(id, message, sfi?, line?, data?, scenario?): never` — incrementa `errors` + **sempre** lança `TjRuntimeError` | idem | 4 testes |
| 9.2.3.3 | ⚠️ `critical(id, message, ...): void` — incrementa `errors` mas **não lança** | idem | 3 testes |
| 9.2.3.4 | ⚠️ `warning(id, message, ...): void` — incrementa count de warnings (não `errors`); se `abortOnWarning`, lança `TjRuntimeError` | idem | 4 testes |
| 9.2.3.5 | ⚠️ `info(id, message, ...): void` — não incrementa `errors` | idem | 2 testes |
| 9.2.3.6 | ⚠️ `debug(id, message, ...): void` — não incrementa `errors` | idem | 2 testes |
| 9.2.3.7 | ⚠️ `private addMessage(type, id, message, sfi, line, data, scenario)` — cria `Message`, push em `messages` | idem | 3 testes |
| 9.2.3.8 | ⚠️ `to_s(): string` — concatena `messages` | idem | 2 testes |
| 9.2.3.9 | ⚠️ `baselineSFI` ajusta `sourceFileInfo` das mensagens | idem | 3 testes |

#### 9.2.4 — Mixin / Helper

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.2.4.1 | Criar `interface MessageHandlerLike` (usado em Fase 4/5 como contrato) | idem | `deno check` |
| 9.2.4.2 | Criar `createMessageHandler(): MessageHandlerLike` que delega para a instância singleton | idem | 3 testes |
| 9.2.4.3 | Re-exportar `Message`, `MessageType`, `MessageHandlerInstance`, `MessageHandlerLike`, `createMessageHandler` em `packages/core/mod.ts` | idem | `deno check` |

---

### 9.3 — `Log`

**⚠️ RUBY: `Log.rb` (arquivo inteiro — ~180 linhas)**

**Pré-requisitos:** 9.2 (usa `MessageHandler` internamente).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.3.1 | Criar `src/log.ts` com `class Log` com campos **estáticos** | idem | `deno check` |
| 9.3.2 | Campos estáticos: `level: number = 0`, `stack: string[] = []`, `segments: string[] = []`, `silent: boolean = false`, `progress: number = 0`, `progressMeter: string = ''` | idem | `deno check` |
| 9.3.3 | ⚠️ `enter(segment: string, message: string): void` — push em `stack`; loga se `level` permite | idem | 4 testes |
| 9.3.4 | ⚠️ `exit(segment: string, message?): void` — pop de `stack`; loga | idem | 3 testes |
| 9.3.5 | ⚠️ `msg(block: () => string): void` — só avalia `block` se mensagem vai aparecer | idem | 3 testes (level 0 → não avalia) |
| 9.3.6 | ⚠️ `status(message: string): void` | idem | 2 testes |
| 9.3.7 | ⚠️ `startProgressMeter(text: string): void` — em browser: no-op se não terminal | idem | 3 testes |
| 9.3.8 | ⚠️ `stopProgressMeter(): void` | idem | 2 testes |
| 9.3.9 | ⚠️ `activity(): void` — no-op se `silent` | idem | 2 testes |
| 9.3.10 | ⚠️ `progress(percent: number): void` | idem | 3 testes |
| 9.3.11 | ⚠️ `reset(): void` — reseta todos os campos estáticos (para testes) | idem | 3 testes |
| 9.3.12 | Re-exportar `Log` em `packages/core/mod.ts` | idem | `deno check` |

---

### 9.4 — `AppConfig` + `Tj3Config` + `version`

**⚠️ RUBY: `AppConfig.rb` (~150 linhas), `Tj3Config.rb` (~30 linhas), `version.rb` (~1 linha)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.4.1 | Criar `src/version.ts` com `export const VERSION = '0.0.0'` | idem | 1 teste |
| 9.4.2 | Criar `src/app-config.ts` com `class AppConfig` (campos **estáticos**) | idem | `deno check` |
| 9.4.3 | Campos estáticos: `version`, `packageName`, `softwareName`, `packageInfo`, `appName`, `authors`, `copyright`, `contact`, `license` | idem | `deno check` |
| 9.4.4 | Getters/setters estáticos para cada campo | idem | 3 testes |
| 9.4.5 | ⚠️ `dataDirs(baseDir: string): string[]` — retorna `[]` no browser | idem | 2 testes |
| 9.4.6 | ⚠️ `dataSearchDirs(baseDir: string): string[]` — retorna `[]` | idem | 2 testes |
| 9.4.7 | ⚠️ `dataFiles(fileName: string): string[]` — retorna `[]` | idem | 2 testes |
| 9.4.8 | ⚠️ `dataFile(fileName: string): string | null` — retorna `null` | idem | 2 testes |
| 9.4.9 | Criar `src/tj3-config.ts` com `export function initTj3Config(): void` que seta os campos de `AppConfig` com valores do TJ | idem | 5 testes |
| 9.4.10 | Re-exportar `AppConfig`, `initTj3Config`, `VERSION` em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco B — `PropertyList`

### 9.5 — `PropertyList`

**⚠️ RUBY: `PropertyList.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Array` + `method_missing` → composição com métodos explícitos, §12 Categoria B (tree sort)**

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`, `PropertySet`), 5 (`PropertyLike`).

#### 9.5.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.1.1 | Criar `src/model/property-list.ts` com `class PropertyList<T extends PropertyTreeNode>` | idem | `deno check` |
| 9.5.1.2 | Campos: `private items: T[]`, `readonly propertySet: PropertySet<T>`, `query: Query \| null`, `private sortingLevels: number`, `private sortingCriteria: string[]`, `private sortingUp: boolean[]`, `private scenarioIdx: number[]` | idem | `deno check` |
| 9.5.1.3 | ⚠️ Constructor `(arg: PropertySet<T> \| PropertyList<T>, copyItems = true)` — se `PropertyList`, copia items | idem | 3 testes |

#### 9.5.2 — Métodos básicos (delegação explícita)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.2.1 | `toArray(): T[]` | idem | 1 teste |
| 9.5.2.2 | `length(): number` | idem | 1 teste |
| 9.5.2.3 | `get(index: number): T \| undefined` | idem | 2 testes |
| 9.5.2.4 | `[Symbol.iterator](): Iterator<T>` | idem | 2 testes |
| 9.5.2.5 | `includes(node: T): boolean` | idem | 2 testes |
| 9.5.2.6 | `find(node: T): T \| undefined` — retorna o item equivalente ou `undefined` | idem | 3 testes |
| 9.5.2.7 | `push(...items: T[]): number` | idem | 2 testes |
| 9.5.2.8 | `append(list: PropertyList<T> \| T[]): void` | idem | 3 testes |
| 9.5.2.9 | `delete(index: number): void` | idem | 2 testes |
| 9.5.2.10 | `deleteIf(predicate: (item: T) => boolean): void` | idem | 3 testes |
| 9.5.2.11 | `unique(): void` | idem | 2 testes |
| 9.5.2.12 | `clear(): void` | idem | 2 testes |

#### 9.5.3 — Adoção e duplicatas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.3.1 | ⚠️ `includeAdopted(): void` — adiciona todos os `adoptees` recursivamente | idem | 4 testes |
| 9.5.3.2 | ⚠️ `checkForDuplicates(sfi: SourceFileInfo): void` — se duplicata, `error('pl_duplicate')` | idem | 3 testes |
| 9.5.3.3 | Teste: árvore com adopted task aparece 2× → `checkForDuplicates` detecta | idem | 1 teste |

#### 9.5.4 — Sorting

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.4.1 | ⚠️ `setSorting(modes: Array<[string, boolean, number]>): void` — cada tupla é `(criteria, up, scIdx)` | idem | 3 testes |
| 9.5.4.2 | `setSorting` — adiciona critérios via `addSortingCriteria` | idem | 2 testes |
| 9.5.4.3 | ⚠️ `addSortingCriteria(criteria, up, scIdx): void` — valida que `criteria` é `knownAttribute` ou `hasQuery?`; se `scenarioSpecific`, valida `scenario(scIdx)` existe; senão, `scIdx === -1` | idem | 6 testes |
| 9.5.4.4 | `resetSorting(): void` — limpa sorting | idem | 2 testes |
| 9.5.4.5 | ⚠️ `treeMode?(): boolean` — `true` se o primeiro critério é `tree` | idem | 3 testes |

#### 9.5.5 — `sort!` (tree mode 2 passes)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.5.1 | ⚠️ `sort!(): void` — se tree mode: 2 passes; senão, 1 pass | idem | 1 teste |
| 9.5.5.2 | ⚠️ **Pass 1:** remove o primeiro critério (`tree`); `sortInternal()` | idem | 2 testes |
| 9.5.5.3 | ⚠️ **Pass 1:** `index()` — atualiza `index` de cada item (contador sequencial) | idem | 3 testes |
| 9.5.5.4 | ⚠️ **Pass 1:** `indexTree()` — atualiza `tree` de cada item (string de 6 dígitos por nível, concatenados) | idem | 4 testes |
| 9.5.5.5 | ⚠️ **Pass 2:** re-adiciona `tree` no início; `sortInternal()` | idem | 2 testes |
| 9.5.5.6 | ⚠️ `private sortInternal(): void` — usa `sortingCriteria`, `sortingUp`, `scenarioIdx` | idem | 3 testes |
| 9.5.5.7 | Teste agregado: 5 tasks com hierarquia 2 níveis + `seqno` → ordem correta | idem | 1 teste |

#### 9.5.6 — Índices

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.5.6.1 | ⚠️ `itemIndex(item: T): number` — retorna índice de `item` ou `-1` | idem | 3 testes |
| 9.5.6.2 | ⚠️ `index(): void` — atualiza `index` de cada item no container | idem | 2 testes |
| 9.5.6.3 | ⚠️ `private indexTree(): void` — `treeIdcs = property.getIndicies()`; concatena cada `idx.toString().padStart(6, '0')` | idem | 4 testes |
| 9.5.6.4 | Re-exportar `PropertyList` em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — `Project`

### 9.6 — `Project` — estrutura e atributos

**⚠️ RUBY: `Project.rb` (linhas 1–200 aprox. — construtor + atributos)**
**🔎 CHEAT: §3 `Hash` → `Map`, §12 Categoria B (workinghours reinit)**

**Pré-requisitos:** Fases 2–8 completas.

#### 9.6.1 — Construtor

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.6.1.1 | Criar `src/model/project.ts` com `class Project implements ProjectLike` | idem | `deno check` |
| 9.6.1.2 | Campos: `readonly id`, `readonly name`, `readonly version`, `private attributes: Map<string, unknown>` | idem | `deno check` |
| 9.6.1.3 | Campos `PropertySet`: `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports` | idem | `deno check` |
| 9.6.1.4 | Campos auxiliares: `inputFiles: string[]`, `timeSheets: TimeSheets`, `reportContexts: ReportContext[]`, `outputDir: string`, `warnTsDeltas: boolean` | idem | `deno check` |
| 9.6.1.5 | Campos scoreboard: `scoreboard`, `scoreboardNoLeaves`, `resourceAvailability` | idem | `deno check` |
| 9.6.1.6 | ⚠️ Constructor `(id, name, version)`: `AttributeBase.setMode(0)` | idem | 1 teste |
| 9.6.1.7 | Constructor: inicializa `attributes` com todos os defaults (ver `Project.rb`) | idem | 3 testes |
| 9.6.1.8 | Constructor: cria `scenarios` (flat) + `registerScenarioAttributes` | idem | 2 testes |
| 9.6.1.9 | Constructor: cria `shifts`, `accounts`, `resources` (flat) + `registerShiftAttributes`, `registerAccountAttributes`, `registerResourceAttributes` | idem | 3 testes |
| 9.6.1.10 | Constructor: cria `tasks` (flat) + `registerTaskAttributes` | idem | 2 testes |
| 9.6.1.11 | Constructor: cria `reports` (hierárquico) + `registerReportAttributes` | idem | 2 testes |
| 9.6.1.12 | Constructor: cria `Scenario` inicial `plan` | idem | 2 testes |

#### 9.6.2 — Acessores

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.6.2.1 | `get scenarioCount(): number` = `scenarios.items()` | idem | 2 testes |
| 9.6.2.2 | ⚠️ `scenario(arg: number \| string): Scenario \| null` — aceita índice ou id | idem | 5 testes |
| 9.6.2.3 | ⚠️ `scenarioIdx(sc: Scenario \| string): number \| undefined` | idem | 4 testes |
| 9.6.2.4 | `shift(id)`, `account(id)`, `task(id)`, `resource(id)`, `report(id)`, `reportByName(name)` | idem | 6 testes |
| 9.6.2.5 | ⚠️ `get(name: string): unknown`, `set(name: string, value: unknown): void` — acessores de atributos de projeto | idem | 4 testes |
| 9.6.2.6 | ⚠️ `set` — se `name === 'start' \| 'end' \| 'scheduleGranularity' \| 'timezone'`, re-inicializa `workinghours` | idem | 4 testes |

#### 9.6.3 — Cálculos de tempo

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.6.3.1 | ⚠️ `dailyWorkingHours(): number` — `workinghours.weeklyWorkingHours() / weeklyWorkingDays` | idem | 3 testes |
| 9.6.3.2 | ⚠️ `weeklyWorkingDays(): number` — conta dias da semana com working hours | idem | 3 testes |
| 9.6.3.3 | ⚠️ `monthlyWorkingDays(): number` = `weeklyWorkingDays * 4.348` | idem | 3 testes |
| 9.6.3.4 | ⚠️ `yearlyWorkingDays(): number` = `weeklyWorkingDays * 52.1786` | idem | 3 testes |
| 9.6.3.5 | ⚠️ `slotsToDays(slots: number): number` = `slots / 1440` (1440 min/dia) | idem | 3 testes |
| 9.6.3.6 | ⚠️ `convertToDailyLoad(seconds: number): number` = `seconds / (24*3600)` | idem | 3 testes |
| 9.6.3.7 | ⚠️ `scoreboardSize(): number` = `scoreboard.size` | idem | 2 testes |
| 9.6.3.8 | ⚠️ `idxToDate(idx: number): TjTime` = `scoreboard.idxToDate(idx)` | idem | 3 testes |
| 9.6.3.9 | ⚠️ `dateToIdx(date: TjTime, forceIntoProject = true): number` = `scoreboard.dateToIdx(date, forceIntoProject)` | idem | 4 testes |

#### 9.6.4 — Working time helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.6.4.1 | ⚠️ `isWorkingTime(...args): boolean` — delega para `workinghours` ou `scoreboard` | idem | 4 testes |
| 9.6.4.2 | ⚠️ `hasWorkingTime(...args): boolean` | idem | 3 testes |
| 9.6.4.3 | ⚠️ `workingDays(interval: TimeInterval): number` | idem | 3 testes |
| 9.6.4.4 | ⚠️ `getWorkSlots(startIdx, endIdx): number` | idem | 3 testes |
| 9.6.4.5 | ⚠️ `anyResourceAvailable?(sbIdx): boolean` — verifica `resourceAvailability` | idem | 3 testes |
| 9.6.4.6 | ⚠️ `collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>` | idem | 3 testes |
| 9.6.4.7 | ⚠️ `attributeName(id): string \| undefined` | idem | 3 testes |
| 9.6.4.8 | ⚠️ `journal(query): RichTextIntermediate \| null` — stub (`NotYetImplementedError`, Fase 16) | idem | 1 teste |
| 9.6.4.9 | ⚠️ `to_s(): string` — serialização de debug | idem | 2 testes |

#### 9.6.5 — Registro

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.6.5.1 | ⚠️ `addScenario(s): void` — registra em `scenarios` | idem | 2 testes |
| 9.6.5.2 | ⚠️ `addShift(s)`, `addAccount(a)`, `addTask(t)`, `addResource(r)`, `addReport(r)` | idem | 5 testes |
| 9.6.5.3 | ⚠️ `removeAccount(a): void` — remove e propaga referências | idem | 3 testes |
| 9.6.5.4 | ⚠️ `static maxScheduleGranularity(): number` = `3600` | idem | 1 teste |
| 9.6.5.5 | Teste: `addTask` incrementa `tasks.items()` | idem | 1 teste |

---

### 9.7 — `Project.schedule`

**⚠️ RUBY: `Project.rb` (linhas 200–500 aprox. — `schedule`, `initScoreboards`, `computeResourceAvailabilities`, `prepareScenario`, `scheduleScenario`, `finishScenario`)**
**🔎 CHEAT: §3 `each` → `for-of`, §12 Categoria B (`idxToDate`)**

**Pré-requisitos:** subfase 9.6 + Fases 2–8.

#### 9.7.1 — `schedule` (pipeline principal)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.1.1 | ⚠️ `schedule(): boolean` — chama `initScoreboards()` primeiro | idem | 1 teste |
| 9.7.1.2 | `schedule` — para cada `PropertySet`, chama `index()` | idem | 2 testes |
| 9.7.1.3 | `schedule` — se `tasks.empty()`, `error('no_tasks')` | idem | 2 testes |
| 9.7.1.4 | ⚠️ `schedule` — para cada cenário em `scenarios` (se `scenario.get('active')`): `scIdx = scenarioIdx(sc)` | idem | 3 testes |
| 9.7.1.5 | ⚠️ `schedule` — `AttributeBase.setMode(1); this.prepareScenario(scIdx)` | idem | 2 testes |
| 9.7.1.6 | ⚠️ `schedule` — `AttributeBase.setMode(2); this.scheduleScenario(scIdx)` | idem | 2 testes |
| 9.7.1.7 | ⚠️ `schedule` — `this.finishScenario(scIdx)` | idem | 2 testes |
| 9.7.1.8 | `schedule` — para cada resource: `resource.scenarioData(scIdx).checkFailsAndWarnings()` | idem | 2 testes |
| 9.7.1.9 | `schedule` — para cada task: `task.scenarioData(scIdx).checkFailsAndWarnings()` | idem | 2 testes |
| 9.7.1.10 | `schedule` — se `warnTsDeltas`, `timeSheets.warnOnDelta()` | idem | 2 testes |
| 9.7.1.11 | `schedule` — retorna `true` | idem | 1 teste |

#### 9.7.2 — `initScoreboards`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.2.1 | ⚠️ `initScoreboards(): void` — `scoreboard = new Scoreboard(start, end, granularity, 2)` | idem | 2 testes |
| 9.7.2.2 | ⚠️ `scoreboardNoLeaves = new Scoreboard(start, end, granularity, 2)` | idem | 2 testes |
| 9.7.2.3 | ⚠️ Para cada slot: se `workinghours.onShift(date)`, ambos = `null` | idem | 3 testes |
| 9.7.2.4 | ⚠️ Para cada leave global em `project.get('leaves')`: marca bits | idem | 3 testes |
| 9.7.2.5 | Teste agregado: working hours 9-17 seg-sex → verificar bits em ~10 slots | idem | 1 teste |

#### 9.7.3 — `computeResourceAvailabilities`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.3.1 | ⚠️ `computeResourceAvailabilities(scIdx, usedResources): void` — cria `Scoreboard<boolean>` | idem | 2 testes |
| 9.7.3.2 | ⚠️ Para cada idx: se algum `usedResource.available(scIdx, idx)`, `true` | idem | 4 testes |
| 9.7.3.3 | Teste: 2 resources com working hours diferentes → disponibilidade correta | idem | 1 teste |

#### 9.7.4 — `prepareScenario`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.4.1 | ⚠️ `prepareScenario(scIdx): void` — `Log.enter('prepareScenario', ...)` | idem | 1 teste |
| 9.7.4.2 | `resources = new PropertyList(resources)`; `tasks = new PropertyList(tasks)` | idem | 2 testes |
| 9.7.4.3 | ⚠️ Coletar `usedResources` (candidatos de todas as tasks) | idem | 3 testes |
| 9.7.4.4 | ⚠️ Para cada `usedResource`: `prepareScheduling(scIdx)`, `preScheduleCheck(scIdx)` | idem | 3 testes |
| 9.7.4.5 | Para cada resource: `setDirectReports`, `setReports` | idem | 2 testes |
| 9.7.4.6 | `computeResourceAvailabilities(scIdx, usedResources)` | idem | 1 teste |
| 9.7.4.7 | ⚠️ Para cada task: `prepareScheduling(scIdx)` | idem | 2 testes |
| 9.7.4.8 | ⚠️ Para cada task: `Xref(scIdx)` | idem | 2 testes |
| 9.7.4.9 | ⚠️ Para cada task: `propagateInitialValues(scIdx)` | idem | 2 testes |
| 9.7.4.10 | ⚠️ Para cada task: `preScheduleCheck(scIdx)` | idem | 2 testes |
| 9.7.4.11 | ⚠️ `resetLoopFlags` para todas; `checkForLoops` para top-level (2 passes) | idem | 4 testes |
| 9.7.4.12 | ⚠️ `countResourceAllocations` para todas | idem | 2 testes |
| 9.7.4.13 | ⚠️ `calcCriticalness` para resources | idem | 2 testes |
| 9.7.4.14 | ⚠️ `calcCriticalness` para tasks | idem | 2 testes |
| 9.7.4.15 | ⚠️ `calcPathCriticalness` para tasks | idem | 2 testes |
| 9.7.4.16 | `Log.exit` | idem | 1 teste |

#### 9.7.5 — `scheduleScenario`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.5.1 | ⚠️ `scheduleScenario(scIdx): void` — `tasks = new PropertyList(tasks)` | idem | 2 testes |
| 9.7.5.2 | ⚠️ `deleteIf(!leaf \|\| milestone \|\| scheduled)` | idem | 3 testes |
| 9.7.5.3 | ⚠️ `setSorting([[priority, false, scIdx], [pathcriticalness, false, scIdx], [seqno, true, -1]])` | idem | 3 testes |
| 9.7.5.4 | ⚠️ `sort!()` | idem | 2 testes |
| 9.7.5.5 | ⚠️ Loop: para cada task em `tasks`, se `readyForScheduling`, `task.schedule(scIdx)`; remove da lista; `break` | idem | 4 testes |
| 9.7.5.6 | ⚠️ Se nenhuma task está ready, `warning('deadlock')`, `failedTasks = tasks`, `break` | idem | 3 testes |
| 9.7.5.7 | Warnings de `unscheduled_tasks` para as restantes | idem | 2 testes |

#### 9.7.6 — `finishScenario`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.7.6.1 | ⚠️ `finishScenario(scIdx): void` — para cada top-level task: `finishScheduling(scIdx)` | idem | 3 testes |
| 9.7.6.2 | Para cada top-level resource: `finishScheduling(scIdx)` | idem | 2 testes |
| 9.7.6.3 | Para cada top-level task: `postScheduleCheck(scIdx)` | idem | 2 testes |
| 9.7.6.4 | `computeResourceAvailabilities` é chamada antes (durante `prepareScenario`) | idem | 1 teste |

---

### 9.8 — `Project` — `generateReports` + utils

**⚠️ RUBY: `Project.rb` (linhas 500–900 aprox.)**

**Pré-requisitos:** subfase 9.7.

#### 9.8.1 — `generateReports`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.8.1.1 | ⚠️ `generateReports(maxCpuCores: number): void` — ignora `maxCpuCores` (browser) | idem | 1 teste |
| 9.8.1.2 | `reports.index()` | idem | 1 teste |
| 9.8.1.3 | ⚠️ Para cada report: se `formats.empty`, `continue` | idem | 2 testes |
| 9.8.1.4 | `Log.startProgressMeter`; `reportContexts.push(new ReportContext(this, report))` | idem | 2 testes |
| 9.8.1.5 | ⚠️ `report.generate()` — chamada stub para Fase 14 | idem | 1 teste |
| 9.8.1.6 | `reportContexts.pop()`; `Log.stopProgressMeter` | idem | 2 testes |
| 9.8.1.7 | `DataCache.instance.flush()` | idem | 1 teste |

#### 9.8.2 — `generateReport` + `listReports` + `checkReports`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.8.2.1 | ⚠️ `generateReport(reportId, regExpMode, formats?, dynamicAttributes?): void` — `reportList = regExpMode ? matchingReports(reportId) : [reportId]` | idem | 3 testes |
| 9.8.2.2 | Se não existe, `error('unknown_report_id')` | idem | 2 testes |
| 9.8.2.3 | Se `formats === null && formats.empty`, `error('formats_empty')` | idem | 2 testes |
| 9.8.2.4 | Se `dynamicAttributes`: `context.attributeBackup = report.backupAttributes(); parseReportAttributes(report, dynamicAttributes)` | idem | 3 testes |
| 9.8.2.5 | `report.generate(formats)`; se `dynamicAttributes`, `report.restoreAttributes(...)` | idem | 3 testes |
| 9.8.2.6 | ⚠️ `listReports(reportId, regExpMode): void` — apenas `console.log` | idem | 2 testes |
| 9.8.2.7 | ⚠️ `checkReports(): void` — se `reports.empty()`, `warning('no_report_defined')` | idem | 2 testes |
| 9.8.2.8 | Se `!accounts.empty()`, para cada report sem `balance`, `warning('report_without_balance')` | idem | 3 testes |

#### 9.8.3 — Trace + TimeSheets

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.8.3.1 | ⚠️ `enableTraceReports(enable: boolean): void` | idem | 2 testes |
| 9.8.3.2 | ⚠️ `checkTimeSheets(): void` — `timeSheets.check()` | idem | 2 testes |
| 9.8.3.3 | Re-exportar `Project` em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco D — `TaskJuggler` top-level

### 9.9 — `TaskJuggler` top-level

**⚠️ RUBY: `TaskJuggler.rb` (arquivo inteiro — ~330 linhas)**

**Pré-requisitos:** subfase 9.8.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.9.1 | Criar `src/taskjuggler.ts` com `class TaskJuggler` | idem | `deno check` |
| 9.9.2 | Campos: `project: Project \| null`, `parser: ProjectFileParser \| null`, `maxCpuCores: number`, `warnTsDeltas: boolean`, `generateTraces: boolean` | idem | `deno check` |
| 9.9.3 | ⚠️ Constructor: `TjTime.setTimeZone("UTC")` | idem | 1 teste |
| 9.9.4 | ⚠️ `parse(files: string[], keepParser = false): boolean` — **stub** nesta fase: `throw NotYetImplementedError("Fase 10")` + comentário `// TODO Fase 10: parse real` | idem | 2 testes |
| 9.9.5 | `parseFile(fileName, rule): unknown` — stub | idem | 1 teste |
| 9.9.6 | ⚠️ `parseContent(content: string): boolean` — **variante** (adicionada nesta fase para Fase 19): aceita conteúdo direto em vez de arquivos | idem | 2 testes |
| 9.9.7 | ⚠️ `schedule(): boolean` — `project.warnTsDeltas = this.warnTsDeltas`; `res = project.schedule()`; `project.enableTraceReports(this.generateTraces)`; retorna `res` | idem | 4 testes |
| 9.9.8 | ⚠️ `generateReports(outputDir?: string): boolean` — `project.checkReports()`; se `outputDir`, `project.outputDir = outputDir + '/'`; `project.generateReports(this.maxCpuCores)`; retorna `true` | idem | 4 testes |
| 9.9.9 | ⚠️ `generateReport(reportId, regExpMode, formats?, dynamicAttributes?): boolean` — delega para `project.generateReport` | idem | 2 testes |
| 9.9.10 | ⚠️ `listReports(reportId, regExpMode): boolean` — delega | idem | 2 testes |
| 9.9.11 | ⚠️ `freeze(freezeDate, taskBookings): boolean` — stub (`NotYetImplementedError`, Fase 14) | idem | 1 teste |
| 9.9.12 | ⚠️ `checkTimeSheet(fileName): boolean` — stub (`NotYetImplementedError`, Fase 18) | idem | 1 teste |
| 9.9.13 | ⚠️ `checkStatusSheet(fileName): boolean` — stub | idem | 1 teste |
| 9.9.14 | Getters `projectId`, `projectName`, `errors`; re-exportar em `packages/core/mod.ts` | idem | 4 testes |

---

## Bloco E — Migração e integração

### 9.10 — Migrar `MockProject` → `Project` real

**⚠️ Objetivo:** remover `MockProject` de `src/` e adaptar todos os testes existentes.

**Pré-requisitos:** subfase 9.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.10.1 | Criar `tests/fixtures/create-test-project.ts` com `createTestProject(scenarioCount = 1)` que instancia `Project` real | idem | `deno check` |
| 9.10.2 | Marcar `tests/model/mock-project.ts` como deprecated (não deletar ainda) | idem | — |
| 9.10.3 | Migrar testes de Fase 4 (`property-tree-node-*`, `property-set_*`, `scenario-data_*`, `scenario_*`, `ptn-proxy_*`) para `Project` real | idem | testes passam |
| 9.10.4 | Migrar testes de Fase 5 (`task_*`, `resource_*`, `account_*`, `shift_*`, `report_*`, `attributes/*`) | idem | testes passam |
| 9.10.5 | Migrar testes de Fase 6 (`limits_*`, `shift-assignments_*`, `shift-scenario_*`, `resource-scenario-onshift_*`) | idem | testes passam |
| 9.10.6 | Migrar testes de Fase 7 (`task-scenario-*`, `resource-scenario-*`, `data-cache_*`, `allocation_*`, `booking_*`, `task-dependency_*`) | idem | testes passam |
| 9.10.7 | Migrar testes de Fase 8 (`account-credit_*`, `charge_*`, `charge-set_*`, `account-scenario-turnover_*`, `finance/*`) | idem | testes passam |
| 9.10.8 | Deletar `tests/model/mock-project.ts` (após confirmar zero usos) | idem | `grep -r "MockProject"` retorna 0 |

---

### 9.11 — Golden tests (end-to-end)

**⚠️ RUBY: `docs/Learning/mwe001–009/`**
**Usa:** `tj3` real

**Objetivo:** rodar os 9 MWEs end-to-end e comparar cronogramas.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 9.11.1 | Atualizar `scripts/golden/README.md` com seção de `project-schedule` | idem | existe |
| 9.11.2 | Criar `scripts/golden/project-schedule-mwe001.rb` — roda `tj3 mwe001/tutorial.tjp`; extrai datas de início/end e effort de cada task do HTML | idem | roda |
| 9.11.3 | Repetir para `mwe002.rb` a `mwe009.rb` (9 scripts) | idem | 9 JSONs |
| 9.11.4 | Serializar em `project-schedule.golden.json` | idem | ≥ 30 casos |
| 9.11.5 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 9.11.6 | Criar `tests/golden/project-schedule_golden_test.ts` que itera os casos | idem | verde |
| 9.11.7 | Comparação byte-a-byte com tolerância de 1s em datas | idem | 3 testes |
| 9.11.8 | Teste: projetos construídos programaticamente (parse é Fase 10) | idem | 1 teste |
| 9.11.9 | Cobertura ≥ 30 casos; commitar JSON | idem | versionado |
| 9.11.10 | Teste de regressão: rodar novamente os golden de Fases 2–8 (TjTime, WorkingHours, Limits, ShiftAssignments, Attributes, PropertyTreeNode, Scheduler, Financeiro) | idem | verde |

---

## Bloco F — Verificação final

### 9.12 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 9.12.1 | `deno task check-all` verde | exit 0 |
| 9.12.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 9.12.3 | `grep -r "NotYetImplementedError" packages/core/src/` — apenas `TaskJuggler.parse/freeze/checkTimeSheet/checkStatusSheet` e `Project.journal` | ≤ 5 ocorrências |
| 9.12.4 | ADR 020 criada e commitada | git log |
| 9.12.5 | `SourceFileInfo`, `MessageHandlerInstance`, `Log`, `PropertyList`, `AppConfig`, `Project`, `TaskJuggler` exportados em `packages/core/mod.ts` | `deno check` |
| 9.12.6 | `MockProject` removido (`grep -r "MockProject" packages/core/src/` retorna 0) | grep |
| 9.12.7 | `tests/integration/smoke_after_phase_9_test.ts` — cria `Project`, adiciona 1 task, roda `schedule()`, verifica `scheduled`; verifica Fase 8 (`ChargeSet`) | 1 teste |
| 9.12.8 | Auditoria: cada subfase do plano `fase-9-orquestrador-cache.md` tem tarefas correspondentes | grep |
| 9.12.9 | Corrigir numeração em `fase-9-orquestrador-cache.md` (`### 13.X` → `### 9.X`, `ADR 019` → `ADR 020`) | grep |
| 9.12.10 | Teste agregado: `TaskJuggler.schedule()` end-to-end em projeto de 3 tasks em cadeia | 1 teste |

---

## Notas para a IA

1. **Ordem:** 9.0 → 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9 → 9.10 → 9.11 → 9.12.
   - Exceção: 9.5 (`PropertyList`) pode rodar em paralelo com 9.1–9.4.
2. **`Project.schedule` é o método mais importante do projeto.** Não simplificar.
3. **Ordem de `prepareScenario` importa.** Seguir blueprint §2.5 do `docs/tj3-engine/02-bluprint-engine1.md`.
4. **`AttributeBase.setMode(1)` antes de `prepareScenario`; `setMode(2)` antes de `scheduleScenario`.**
5. **`initScoreboards` precisa rodar antes de qualquer cenário.** Sem exceção.
6. **`PropertyList.sort!` tree mode é 2 passes.** Sem simplificar.
7. **`MessageHandler.error` sempre lança.** Sem `exit(1)`.
8. **`Log` é estático.** Sem instanciar.
9. **`BatchProcessor` removido.** Reports sequenciais.
10. **`MockProject` removido.** Todos os testes usam `Project` real.
11. **`TaskJuggler.parse` é stub nesta fase.** Fase 10 implementa.
12. **`Project.get('start')` retorna `TjTime | null`.** Cuidado com null em cálculos.
13. **`AppConfig.dataDirs` retorna `[]`.** Fase 14 adapta para `fetch()`.
14. **`FileList.modified?` retorna `false` sempre.** Sem filesystem.
15. **Sem `any`.** Use `unknown` + narrowing.
16. **Commit por subfase.** `feat(core): message-handler`, `feat(core): project-schedule`, etc.
17. **`TaskJuggler.parseContent`** é variante nova (não existe no Ruby) — adicionada para Fase 19 (`ProjectLoader`).
18. **`AttributeBase.setMode(0)` em `beforeEach`.**
19. **ADR 020** (não 019). **ADR 019** é modelo financeiro (Fase 8).
20. **Golden tests contra `tj3` são a prova.** Se divergir, corrigir TS, não golden.

---

## Notas específicas por subfase

### 9.1 — SourceFileInfo + erros

- **`SourceFileInfo.to_s`** formato: `file.tjp:42:` (sem coluna).
- **Hierarquia de erros** deve ser consolidada com Fase 3.
- **`AttributeOverwrite`** (Fase 3) já existe.

### 9.2 — MessageHandler

- **Singleton via `static instance`.**
- **`error` sempre lança.** Não `exit(1)`.
- **`critical` incrementa mas não lança** — para erros que não interrompem.
- **`abortOnWarning`** — flag que faz `warning` lançar.
- **`baselineSFI`** — ajusta `sourceFileInfo` quando mensagem não tem.

### 9.3 — Log

- **Estático, sem instância.**
- **`msg` só avalia `block` se level permite** — importante para performance.
- **`progressMeter` no-op** em browser (sem terminal).
- **`silent`** — flag global.

### 9.4 — AppConfig

- **`dataDirs` retorna `[]`** no browser.
- **`initTj3Config`** preenche com valores do TJ.
- **`VERSION`** é constante estática.

### 9.5 — PropertyList

- **Composição, não herança de `Array`.** Métodos delegados explicitamente.
- **`sort!` tree mode é 2 passes.** Índices 6 dígitos.
- **`checkForDuplicates`** detecta tasks adotadas.
- **`setSorting`** valida critérios.

### 9.6 — Project estrutura

- **~30 atributos + 6 `PropertySet`s.**
- **`set('start')` etc. re-inicializa `workinghours`.**
- **`scenario(arg)`** aceita índice ou id.
- **`static maxScheduleGranularity = 3600`.**

### 9.7 — Project.schedule

- **Pipeline exato.**
- **`initScoreboards` antes de tudo.**
- **`setMode(1) → prepareScenario`; `setMode(2) → scheduleScenario`.**
- **`scheduleScenario` ordena por `priority`, `pathcriticalness`, `seqno`.**
- **Deadlock se nenhuma task ready.**

### 9.8 — Project utils

- **`generateReports` sequencial.**
- **`generateReport` com `dynamicAttributes`** faz backup/restore.
- **`checkReports`** valida consistência.

### 9.9 — TaskJuggler

- **`parse` é stub** (Fase 10).
- **`parseContent`** é variante nova para Fase 19.
- **`schedule` delega para `Project.schedule`.**
- **`freeze`, `checkTimeSheet`, `checkStatusSheet`** são stubs.

### 9.10 — Migração MockProject → Project

- **Fazer arquivo por arquivo.** Pode quebrar muitos testes.
- **`createTestProject`** é o novo helper canônico.
- **Deletar `MockProject`** só após zero usos.

### 9.11 — Golden tests end-to-end

- **9 MWEs + já rodados nas Fases 2–8.**
- **Comparação de `start`, `end`, `effort`.**
- **Tolerância de 1s em datas.**

### 9.12 — Verificação

- **Sem stubs além de `parse`, `freeze`, `checkTimeSheet`, `checkStatusSheet`, `journal`.**
- **`MockProject` removido.**
- **Smoke test cobre Fase 8.**

---

**Fim do arquivo de tarefas da Fase 9.**