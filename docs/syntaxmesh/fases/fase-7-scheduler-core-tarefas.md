# Fase 7 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-7-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-7-scheduler-core.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~215 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{TaskScenario,ResourceScenario,Allocation,Booking,TaskDependency,DataCache}.rb`

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
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (**criado nesta fase**).

### Convenções CRÍTICAS

- **`AttributeBase.setMode(0)` em `beforeEach`** — sem isso, testes vazam estado.
- **Dentro de `*Scenario`, acessar atributos via `this.a(name)`** — nunca `this.property.get(name)`.
- **Fora de `*Scenario`, acessar via `task.get(name, scIdx)` ou `task.scenarioData(scIdx).a(name)`** — escolher um padrão consistente.
- **`propagateDate` é shrink-only** — nunca expandir.
- **`DataCache` é singleton** — sempre `DataCache.instance`.
- **`treeSum` precisa de cacheTag explícito** — não confiar em `caller`.
- **Ordem importa em `bookResources`** — não reordenar.
- **`checkForLoops` usa `deadEndFlags`** — resetar antes.
- **`calcPathCriticalness` memoiza em `pathcriticalness`** — se null, computa.
- **`initScoreboard` é chamado 1× por `ResourceScenario`** — não chamar duas vezes.
- **`bookedTask` retorna `Task | null`** — `booked?` é `bookedTask !== null`.
- **`Scoreboard<number | Task | null>`** para scoreboard de `ResourceScenario` — não forçar tipos.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não simplificar `bookResources` (ordem importa).
- ❌ Não expandir em `propagateDate`.
- ❌ Não confundir `onShift?` de `TaskScenario` (usa `project.isWorkingTime`) com `ResourceScenario.onShift?` (usa shifts/workinghours).
- ❌ Não implementar `query_journal` / `query_alert` nesta fase (é Fase 16).
- ❌ Não implementar `AccountScenario.turnover` nesta fase (é Fase 8).
- ❌ Não usar `Proxy`.
- ❌ Não chamar `MockProject.schedule()` — é mínimo, o `Project` real é Fase 9.

---

## Progresso

```
[ ] 7.0  ADR 018 (heurística scheduler)          —  0/5
[ ] 7.1  DataCache                               —  0/9
[ ] 7.2  TaskDependency                          —  0/6
[ ] 7.3  Allocation                              —  0/14
[ ] 7.4  Booking                                 —  0/6
[ ] 7.5  TaskScenario.prepare + Xref + preCheck  —  0/30
[ ] 7.6  TaskScenario.checkForLoops + criticalness — 0/16
[ ] 7.7  TaskScenario.schedule + scheduleSlot    —  0/14
[ ] 7.8  TaskScenario.bookResources + bookResource — 0/18
[ ] 7.9  TaskScenario.propagateDate + container  —  0/22
[ ] 7.10 TaskScenario.bookBookings + finish + post — 0/24
[ ] 7.11 ResourceScenario.initScoreboard         —  0/16
[ ] 7.12 ResourceScenario.book + bookBooking     —  0/14
[ ] 7.13 ResourceScenario slots + tree           —  0/12
[ ] 7.14 ResourceScenario effective work         —  0/10
[ ] 7.15 ResourceScenario queries + turnover     —  0/18
[ ] 7.16 TaskScenario queries + turnover         —  0/20
[ ] 7.17 MockProject.schedule (mínimo)           —  0/6
[ ] 7.18 Golden tests (scheduler)                —  0/10
[ ] 7.19 Verificação final                       —  0/8
─────────────────────────────────────────────────
TOTAL: ~215
```

---

## Bloco A — Fundação

### 7.0 — ADR 018 (heurística do scheduler)

**Objetivo:** formalizar o algoritmo greedy como decisão de arquitetura.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.0.1 | Criar `docs/syntaxmesh/decisoes/018-heuristica-scheduler.md` com frontmatter | idem | arquivo existe |
| 7.0.2 | Seção **Contexto:** por que heurística; alternativas (PERT/CPM, ILP, constraint solving) | idem | — |
| 7.0.3 | Seção **Decisão:** replicar fielmente — loop slot-a-slot, heurística por `priority` + `pathcriticalness` + `seqno`, 5 modos de seleção, propagação shrink-only | idem | — |
| 7.0.4 | Seções **Alternativas** + **Consequências** (não é ótimo; fidelidade ao TJ; golden tests) | idem | — |
| 7.0.5 | Atualizar linha `018` em `decisoes/README.md` | idem | 18 linhas |

---

### 7.1 — `DataCache`

**⚠️ RUBY: `DataCache.rb` (arquivo inteiro — ~150 linhas)**
**🔎 CHEAT: §3 `Hash` → `Map`, §12 Categoria B (hash collision)**

**Pré-requisitos:** nenhum (independente).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.1.1 | Criar `src/cache/data-cache.ts` com `class DataCacheEntry` vazia | idem | `deno check` |
| 7.1.2 | Campos de `DataCacheEntry`: `readonly unhashedKey: unknown[]`, `hits: number`, `private value: T` | idem | 1 teste |
| 7.1.3 | ⚠️ `get value(): T` — incrementa `hits`, retorna `value` | idem | 2 testes |
| 7.1.4 | Criar `class DataCache` com `static instance`, `private entries: Map<number, DataCacheEntry>`, `highWaterMark`, `lowWaterMark`, `stores`, `hits`, `misses`, `collisions` | idem | `deno check` |
| 7.1.5 | ⚠️ `cached<T>(...args: unknown[], fn: () => T): T` — computa `key` via hash dos args; se existe, verifica `unhashedKey !== args` → collision → recomputa; senão, computa, armazena, retorna | idem | 6 testes |
| 7.1.6 | `private hash(args: unknown[]): number` — função própria para `null`, `number`, `string`, `object` (referência), `TjTime` (via `toSeconds`), `Task` (via `fullId`), `Resource` (via `fullId`) | idem | 8 testes |
| 7.1.7 | ⚠️ `flush(): void` — limpa entries; mantém contadores | idem | 2 testes |
| 7.1.8 | ⚠️ `resize(size = 100000): void` — ajusta `highWaterMark` e `lowWaterMark` | idem | 3 testes |
| 7.1.9 | ⚠️ `private store<T>(value, key, unhashedKey): T` — se `entries.size > highWaterMark`, drop até `lowWaterMark` | idem | 3 testes |

---

## Bloco B — Estruturas

### 7.2 — `TaskDependency`

**⚠️ RUBY: `TaskDependency.rb` (arquivo inteiro — ~50 linhas)**

**Pré-requisitos:** Fase 5 (`Task`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.2.1 | Criar `src/scheduling/task-dependency.ts` com `class TaskDependency` vazia | idem | `deno check` |
| 7.2.2 | Campos: `readonly taskId: string`, `task: Task \| null`, `onEnd: boolean`, `gapDuration: number`, `gapLength: number` | idem | 1 teste |
| 7.2.3 | Constructor `(taskId, onEnd)` — inicializa `gapDuration = gapLength = 0` | idem | 3 testes |
| 7.2.4 | ⚠️ `equals(other: TaskDependency): boolean` — compara `taskId`, `onEnd`, `gapDuration`, `gapLength` | idem | 4 testes |
| 7.2.5 | ⚠️ `resolve(project: ProjectLike): Task \| null` — busca `project.task(this.taskId)`; atribui a `this.task`; retorna | idem | 4 testes |
| 7.2.6 | Re-exportar em `src/scheduling/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

### 7.3 — `Allocation` + `SelectionMode`

**⚠️ RUBY: `Allocation.rb` (arquivo inteiro — ~130 linhas)**
**🔎 CHEAT: §2 (enum), §3 `arr.sort_by` → `[...arr].sort()`**

**Pré-requisitos:** Fase 5 (`Resource`), Fase 6 (`ShiftAssignments`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.3.1 | Criar `src/scheduling/allocation.ts` com `enum SelectionMode { Order=0, MinAllocated=1, MinLoaded=2, MaxLoaded=3, Random=4 }` | idem | 1 teste (contagem 5) |
| 7.3.2 | Criar `class Allocation` com campos `candidates`, `selectionMode`, `atomic`, `persistent`, `mandatory`, `shifts`, `lockedResource`, `staticCandidates` | idem | `deno check` |
| 7.3.3 | Constructor `(candidates, selectionMode = MinAllocated, persistent = false, mandatory = false, atomic = false)` | idem | 3 testes |
| 7.3.4 | ⚠️ `setSelectionMode(str: string): void` — `order\|minallocated\|minloaded\|maxloaded\|random` | idem | 6 testes |
| 7.3.5 | `setSelectionMode` rejeita string inválida (`TjArgumentError`) | idem | 1 teste |
| 7.3.6 | ⚠️ `addCandidate(candidate): void` | idem | 2 testes |
| 7.3.7 | ⚠️ `onShift?(sbIdx: number): boolean` — se `shifts`, retorna `shifts.onShift?(sbIdx)`; senão `true` | idem | 3 testes |
| 7.3.8 | ⚠️ `candidatesList(scenarioIdx?: number): Resource[]` — se `staticCandidates`, retorna cache | idem | 2 testes |
| 7.3.9 | `candidatesList` — se `selectionMode === Order \|\| scenarioIdx === undefined`, retorna `candidates` como estão | idem | 2 testes |
| 7.3.10 | `candidatesList` — se `Random`, ordena com `Math.random` | idem | 2 testes |
| 7.3.11 | `candidatesList` — se `MinAllocated`, ordena por `criticalness`; se `persistent`, por `bookedEffort` | idem | 3 testes |
| 7.3.12 | `candidatesList` — se `MinLoaded` / `MaxLoaded`, ordena por `bookedEffort` asc/desc | idem | 4 testes |
| 7.3.13 | `candidatesList` — cacheia se `MinAllocated && !persistent` | idem | 1 teste |
| 7.3.14 | Re-exportar em `src/scheduling/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

### 7.4 — `Booking`

**⚠️ RUBY: `Booking.rb` (arquivo inteiro — ~50 linhas)**

**Pré-requisitos:** Fase 5 (`Task`, `Resource`), Fase 2 (`TimeInterval`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.4.1 | Criar `src/scheduling/booking.ts` com `type Overtime = 0 \| 1 \| 2` e `type Sloppy = 0 \| 1 \| 2` | idem | `deno check` |
| 7.4.2 | Criar `class Booking` com campos `resource`, `task`, `intervals`, `sourceFileInfo`, `overtime`, `sloppy` | idem | `deno check` |
| 7.4.3 | Constructor `(resource, task, intervals)` — `overtime = 0`, `sloppy = 0` | idem | 3 testes |
| 7.4.4 | ⚠️ `to_s(): string` — formato `${resource.fullId} ${iv.start} + Xh, ...` | idem | 3 testes |
| 7.4.5 | ⚠️ `to_tjp(taskMode: boolean): string` — serialização TJP | idem | 4 testes |
| 7.4.6 | Re-exportar em `src/scheduling/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — TaskScenario setup

### 7.5 — `TaskScenario.prepareScheduling` + `Xref` + `preScheduleCheck`

**⚠️ RUBY: `TaskScenario.rb` (linhas 1–300 aprox.) — `prepareScheduling`, `Xref`, `preScheduleCheck`, `markAsMilestone`, `checkDependency`**
**🔎 CHEAT: §3 `each` → `for-of`, §5 strings**

**Pré-requisitos:** Fases 3–6 completas.

#### 7.5.1 — Campos + helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.5.1.1 | Adicionar `enum DurationType { Effort, Length, Duration, StartEnd }` em `task-scenario.ts` | `src/model/task-scenario.ts` | 1 teste |
| 7.5.1.2 | Adicionar campos de estado: `isRunAway`, `hasDurationSpec`, `scheduled`, `doneDuration`, `doneLength`, `doneEffort`, `currentSlotIdx`, `nowIdx` | idem | `deno check` |
| 7.5.1.3 | Adicionar campos de dependência: `startpreds`, `startsuccs`, `endpreds`, `endsuccs` (arrays de `[Task, boolean]`) | idem | `deno check` |
| 7.5.1.4 | Adicionar campos de alocação: `candidates`, `mandatories`, `assignedresources`, `competitors`, `contendedResources` | idem | `deno check` |
| 7.5.1.5 | Adicionar campos de limites/propagação: `allLimits`, `startPropagated`, `endPropagated` | idem | `deno check` |
| 7.5.1.6 | Adicionar campos de criticalness: `criticalness`, `pathcriticalness` | idem | `deno check` |

#### 7.5.2 — `prepareScheduling`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.5.2.1 | ⚠️ `prepareScheduling(): void` — reset `startpreds`, `startsuccs`, `endpreds`, `endsuccs` para `[]` | idem | 2 testes |
| 7.5.2.2 | Reset `isRunAway = false`, `currentSlotIdx = null`, `doneDuration = doneLength = 0`, `doneEffort = 0.0` | idem | 2 testes |
| 7.5.2.3 | `nowIdx = project.dateToIdx(project.get('now'))` | idem | 1 teste |
| 7.5.2.4 | Reset `startPropagated = endPropagated = false` | idem | 1 teste |
| 7.5.2.5 | ⚠️ Determinar `durationType`: `effort > 0` → `Effort`; `length > 0` → `Length`; `duration > 0` → `Duration`; senão → `StartEnd` | idem | 5 testes |
| 7.5.2.6 | `hasDurationSpec = (durationType !== StartEnd) \|\| milestone` | idem | 3 testes |
| 7.5.2.7 | Chamar `markAsMilestone()` | idem | 1 teste |
| 7.5.2.8 | Se `StartEnd && start && end && allocate empty`, `markAsScheduled()` | idem | 2 testes |
| 7.5.2.9 | ⚠️ Coletar `allLimits` (task + parents). Reset limites da task | idem | 3 testes |
| 7.5.2.10 | Reset `contendedResources` (novo Map) | idem | 1 teste |
| 7.5.2.11 | ⚠️ Coletar `mandatories` (de `allocate` — só os `mandatory`) | idem | 3 testes |
| 7.5.2.12 | Reset `lockedResource` de cada `allocation` para `null` | idem | 2 testes |
| 7.5.2.13 | Chamar `bookBookings()` (subfase 7.10) | idem | 1 teste |
| 7.5.2.14 | Se `StartEnd`, setar `startIdx`/`endIdx` a partir de `start`/`end` | idem | 2 testes |

#### 7.5.3 — `markAsMilestone`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.5.3.1 | ⚠️ `markAsMilestone(): void` — container não pode ser milestone (retorna) | idem | 2 testes |
| 7.5.3.2 | Se `container \|\| hasDurationSpec \|\| booking \|\| allocate`, retorna | idem | 4 testes |
| 7.5.3.3 | ⚠️ Determinar se promove: `(hasStartSpec && forward && !hasEndSpec) \|\| (!hasStartSpec && !forward && hasEndSpec) \|\| (!hasStartSpec && !hasEndSpec)` | idem | 5 testes |
| 7.5.3.4 | Se promove, setar `milestone = true`; ajustar `start`/`end` (se um é null, o outro é cópia) | idem | 4 testes |

#### 7.5.4 — `Xref` + `checkDependency`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.5.4.1 | ⚠️ `Xref(): void` — para cada `dependency` em `depends`: `checkDependency(dependency, 'depends')` → `depTask` | idem | 2 testes |
| 7.5.4.2 | `Xref` — `startpreds.push([depTask, dependency.onEnd])` | idem | 2 testes |
| 7.5.4.3 | `Xref` — no `depTask`, `scenarioData(scIdx)[dependency.onEnd ? 'endsuccs' : 'startsuccs'].push([this.property, false])` | idem | 3 testes |
| 7.5.4.4 | `Xref` — para cada `precedes`, análogo (mas com `endsuccs`, `startpreds`) | idem | 3 testes |
| 7.5.4.5 | ⚠️ `checkDependency(dependency, depType): Task \| null` — `depTask = dependency.resolve(project)` | idem | 2 testes |
| 7.5.4.6 | Se `depTask === null` → `error('task_depend_unknown', ...)`, remove do list, retorna null | idem | 2 testes |
| 7.5.4.7 | Se `depTask === this.property` → `error('task_depend_self', ...)`, retorna null | idem | 1 teste |
| 7.5.4.8 | Se `depTask.isChildOf(this.property)` → `error('task_depend_child', ...)` | idem | 2 testes |
| 7.5.4.9 | Se `this.property.isChildOf(depTask)` → `error('task_depend_parent', ...)` | idem | 2 testes |
| 7.5.4.10 | Se duplicata em `depends` ou `precedes` → `error('task_depend_multi', ...)` | idem | 3 testes |
| 7.5.4.11 | Retorna `depTask` se todas validações passam | idem | 1 teste |

#### 7.5.5 — `preScheduleCheck`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.5.5.1 | ⚠️ `preScheduleCheck(): void` — validar chargesets (contas devem ser leaf) | idem | 3 testes |
| 7.5.5.2 | Converter `responsible` IDs → Resource references | idem | 2 testes |
| 7.5.5.3 | Se container && `booking` não vazio → erro `container_booking` | idem | 2 testes |
| 7.5.5.4 | Se milestone && `booking` não vazio → erro `milestone_booking` | idem | 2 testes |
| 7.5.5.5 | Se `scheduled && (start null \|\| end null)` → erro | idem | 3 testes |
| 7.5.5.6 | Se `effort > 0 && allocate empty` → erro `task_effort_alloc` | idem | 2 testes |
| 7.5.5.7 | Contar `durationSpecs` (effort > 0, length > 0, duration > 0, milestone) | idem | 4 testes |
| 7.5.5.8 | Container com `durationSpecs > 0` → erro `container_duration` | idem | 2 testes |
| 7.5.5.9 | Milestone com start != end (ambos setados) → erro `milestone_duration` | idem | 2 testes |
| 7.5.5.10 | Leaf com `durationSpecs > 1` → erro `task_overspecified` | idem | 3 testes |
| 7.5.5.11 | Leaf com `durationSpecs === 0 && !milestone && allocate empty && booking empty` → erro `task_underspecified` | idem | 3 testes |
| 7.5.5.12 | Se `booking` não vazio && `!forward && !scheduled` → erro `alap_booking` | idem | 2 testes |
| 7.5.5.13 | Validar direções: em `startpreds`, dependência deve ter `onEnd=false`; em `endpreds`, `onEnd=true` | idem | 4 testes |

---

### 7.6 — `TaskScenario.checkForLoops` + `calcCriticalness` + `calcPathCriticalness`

**⚠️ RUBY: `TaskScenario.rb` (linhas 300–450 aprox.)**
**🔎 CHEAT: §3 `arr.include?` → `arr.includes()`, §12 Categoria B (DFS flags)**

**Pré-requisitos:** subfase 7.5.

#### 7.6.1 — `checkForLoops`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.6.1.1 | Adicionar campo `deadEndFlags: [boolean, boolean, boolean, boolean]` (4 flags) | idem | `deno check` |
| 7.6.1.2 | ⚠️ `resetLoopFlags(): void` — `deadEndFlags = [false, false, false, false]` | idem | 2 testes |
| 7.6.1.3 | ⚠️ `checkForLoops(path: Array<[Task, boolean]>, atEnd: boolean, fromOutside: boolean, forward: boolean): void` — se `path` contém `[this.property, atEnd]`, emite warning + error | idem | 3 testes |
| 7.6.1.4 | Se `deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)]`, retorna | idem | 3 testes |
| 7.6.1.5 | Push `[this.property, atEnd]` em `path`; processa; pop no final | idem | 2 testes |
| 7.6.1.6 | ⚠️ Se `!atEnd && fromOutside`: se container, itera `children.checkForLoops(path, false, true, forward)`; senão, se `(forward && forwardFlag) \|\| milestone`, `checkForLoops(path, true, false, true)` | idem | 4 testes |
| 7.6.1.7 | Se `!atEnd && !fromOutside`: se `startpreds` vazio e tem parent, sobe para parent; senão, para cada `[task, targetEnd]`, `task.scenarioData(scIdx).checkForLoops(path, targetEnd, true, forward)` | idem | 4 testes |
| 7.6.1.8 | Se `atEnd`, simétrico com `endsuccs`/`children`/`endpreds` | idem | 4 testes |
| 7.6.1.9 | Setar `deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)] = true` após processar | idem | 2 testes |

#### 7.6.2 — `calcCriticalness`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.6.2.1 | ⚠️ `calcCriticalness(): void` — `criticalness = 0.0`; `pathcriticalness = null` | idem | 2 testes |
| 7.6.2.2 | Se `milestone`, `criticalness = priority / 500.0` | idem | 3 testes |
| 7.6.2.3 | Se `effort <= 0 \|\| candidates empty`, retorna (mantém 0) | idem | 3 testes |
| 7.6.2.4 | ⚠️ Média de `resource.get('criticalness', scIdx)` sobre `candidates` | idem | 3 testes |
| 7.6.2.5 | `criticalness = effort * media` | idem | 3 testes |

#### 7.6.3 — `calcPathCriticalness`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.6.3.1 | ⚠️ `calcPathCriticalness(atEnd = false): number` — se `pathcriticalness !== null`, retorna `pathcriticalness - (atEnd ? 0 : criticalness)` | idem | 3 testes |
| 7.6.3.2 | Se `atEnd`, `max = calcPathCriticalnessEndSuccs()` | idem | 2 testes |
| 7.6.3.3 | Se container, `max` sobre `children.calcPathCriticalness(false)` | idem | 3 testes |
| 7.6.3.4 | Senão, `max` sobre `startsuccs` + `calcPathCriticalnessEndSuccs` + `criticalness` | idem | 4 testes |
| 7.6.3.5 | `pathcriticalness = max`, retorna | idem | 2 testes |
| 7.6.3.6 | `calcPathCriticalnessEndSuccs(): number` — análogo para `endsuccs` | idem | 3 testes |

#### 7.6.4 — `countResourceAllocations` + `candidates`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.6.4.1 | ⚠️ `countResourceAllocations(): void` — se `candidates empty \|\| effort <= 0`, retorna | idem | 2 testes |
| 7.6.4.2 | `avgEffort = effort / candidates.length` | idem | 2 testes |
| 7.6.4.3 | Para cada candidate: `resource.set('alloctdeffort', scIdx, resource.get('alloctdeffort', scIdx) + avgEffort)` | idem | 3 testes |
| 7.6.4.4 | ⚠️ `candidates(): Resource[]` — coleta todos os leaf resources de todos `allocation.candidates` | idem | 3 testes |

---

## Bloco D — TaskScenario scheduling

### 7.7 — `TaskScenario.schedule` + `scheduleSlot`

**⚠️ RUBY: `TaskScenario.rb` (linhas 450–600 aprox.)**

**Pré-requisitos:** subfase 7.6.

#### 7.7.1 — Helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.7.1.1 | ⚠️ `markAsScheduled(): void` — se `scheduled`, retorna; senão `scheduled = true` | idem | 2 testes |
| 7.7.1.2 | ⚠️ `markAsRunaway(): void` — `isRunAway = true`; `remainingEffort`; warnings | idem | 4 testes |
| 7.7.1.3 | `markAsRunaway` — para cada `competitor`, warning `runaway_competitor` | idem | 2 testes |
| 7.7.1.4 | ⚠️ `readyForScheduling?(): boolean` — se `scheduled`, retorna `true`; se `isRunAway`, `false` | idem | 3 testes |
| 7.7.1.5 | `readyForScheduling?` — se `forward`: `start != null && (hasDurationSpec \|\| end != null)`; senão `end != null && (hasDurationSpec \|\| start != null)` | idem | 4 testes |

#### 7.7.2 — `schedule` (loop principal)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.7.2.1 | ⚠️ `schedule(): boolean` — se `scheduled`, retorna `true` | idem | 2 testes |
| 7.7.2.2 | Determinar `currentSlotIdx` inicial: `forward` → `dateToIdx(projectionmode && now > start && allocate não vazio ? now : start)`; `!forward` → `dateToIdx(end) - 1` | idem | 4 testes |
| 7.7.2.3 | `lowerLimit = project.dateToIdx(project.get('start'))`; `upperLimit = dateToIdx(project.get('end'))` | idem | 1 teste |
| 7.7.2.4 | `delta = forward ? 1 : -1` | idem | 1 teste |
| 7.7.2.5 | ⚠️ Loop: enquanto `scheduleSlot()`: `currentSlotIdx += delta`; se saiu do range, `markAsRunaway()`, retorna `false` | idem | 4 testes |
| 7.7.2.6 | Retorna `true` (sucesso) | idem | 1 teste |

#### 7.7.3 — `scheduleSlot` (dispatch)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.7.3.1 | ⚠️ `scheduleSlot(): boolean` — dispatch por `durationType` | idem | 1 teste |
| 7.7.3.2 | `Effort`: se `doneEffort < effort`, `bookResources()`; se `doneEffort >= effort`, `propagateDate(idxToDate(currentSlotIdx + (forward ? 1 : 0)), forward, true)`, retorna `false` | idem | 4 testes |
| 7.7.3.3 | `Length`: `bookResources()`; se `onShift(currentSlotIdx)`, `doneLength += 1`; se `doneLength >= length`, propaga, retorna `false` | idem | 4 testes |
| 7.7.3.4 | `Duration`: `bookResources()`; `doneDuration += 1`; se `doneDuration >= duration`, propaga, retorna `false` | idem | 4 testes |
| 7.7.3.5 | `StartEnd`: `bookResources()`; se `(forward && currentSlotIdx >= endIdx) \|\| (!forward && currentSlotIdx <= startIdx)`, `markAsScheduled()`, para cada parent `scheduleContainer()`, retorna `false` | idem | 4 testes |
| 7.7.3.6 | Retorna `true` (continua) por padrão | idem | 1 teste |

---

### 7.8 — `TaskScenario.bookResources` + `bookResource`

**⚠️ RUBY: `TaskScenario.rb` (linhas 600–750 aprox.)**

**Pré-requisitos:** subfase 7.7.

#### 7.8.1 — `bookResources`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.8.1.1 | ⚠️ `bookResources(): void` — se `!project.anyResourceAvailable(currentSlotIdx) \|\| (projectionmode && nowIdx > currentSlotIdx)`, retorna | idem | 3 testes |
| 7.8.1.2 | Se `!limitsOk(currentSlotIdx, undefined)`, retorna | idem | 2 testes |
| 7.8.1.3 | Se `shifts && shifts.assigned?(currentSlotIdx) && !shifts.onShift?(currentSlotIdx)`, retorna | idem | 3 testes |
| 7.8.1.4 | ⚠️ `takenMandatories: Resource[] = []` | idem | 1 teste |
| 7.8.1.5 | Para cada `allocation` em `mandatories`: se `!allocation.onShift(currentSlotIdx)`, retorna | idem | 3 testes |
| 7.8.1.6 | Para cada candidate: se todos os leaves estão disponíveis (limits, available, not in taken), `found = true`, push em taken, break | idem | 4 testes |
| 7.8.1.7 | Se `!found` para alguma mandatory, retorna (aborta) | idem | 2 testes |
| 7.8.1.8 | ⚠️ Para cada `allocation` em `allocate`: se `!allocation.onShift(currentSlotIdx)`, `continue` | idem | 2 testes |
| 7.8.1.9 | Se `lockedResource`, tenta `bookResource(locked)`; se sucesso, `continue` | idem | 3 testes |
| 7.8.1.10 | Se `allocation.atomic && locked.bookedTask(scIdx, sbIdx)` → `rollbackBookings()`, retorna | idem | 3 testes |
| 7.8.1.11 | Se `forward && currentSlotIdx < locked.getMaxSlot(scIdx)`, `continue` | idem | 2 testes |
| 7.8.1.12 | Se `!forward && currentSlotIdx > locked.getMinSlot(scIdx)`, `continue` | idem | 2 testes |
| 7.8.1.13 | Warning `broken_persistence`; `allocation.lockedResource = null` | idem | 2 testes |
| 7.8.1.14 | Para cada candidate em `allocation.candidatesList(scIdx)`: se `bookResource(candidate)`, se `persistent`, `lockedResource = candidate`, `break` | idem | 4 testes |

#### 7.8.2 — `bookResource`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.8.2.1 | ⚠️ `bookResource(resource): boolean` — `booked = false` | idem | 1 teste |
| 7.8.2.2 | Para cada `r` em `resource.allLeaves`: se `effort > 0 && r.get('efficiency', scIdx) > 0 && doneEffort >= effort`, `break` | idem | 3 testes |
| 7.8.2.3 | Se `!limitsOk(currentSlotIdx, r)`, `break` | idem | 2 testes |
| 7.8.2.4 | Se `r.book(scIdx, currentSlotIdx, property)`: se `effort > 0 && doneEffort === 0`, `propagateDate(idxToDate(currentSlotIdx + (forward ? 0 : 1)), !forward, true)` | idem | 3 testes |
| 7.8.2.5 | `doneEffort += r.get('efficiency', scIdx)` | idem | 2 testes |
| 7.8.2.6 | Se `!assignedresources.includes(r)`, push | idem | 2 testes |
| 7.8.2.7 | `booked = true` | idem | 1 teste |
| 7.8.2.8 | Senão, se `competitor = r.bookedTask(scIdx, currentSlotIdx)`: se `!competitors.includes(competitor)`, push; incrementar `contendedResources` | idem | 4 testes |
| 7.8.2.9 | Retorna `booked` | idem | 2 testes |

#### 7.8.3 — `limitsOk` + `incLimits` + `onShift` + `rollbackBookings`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.8.3.1 | ⚠️ `limitsOk?(sbIdx: number, resource?: Resource): boolean` — para cada `limit` em `allLimits`, se `!limit.ok(sbIdx, true, resource)`, retorna `false` | idem | 3 testes |
| 7.8.3.2 | `incLimits(sbIdx: number, resource?: Resource): void` — para cada limit, `limit.inc(sbIdx, resource)` | idem | 2 testes |
| 7.8.3.3 | ⚠️ `onShift?(sbIdx: number): boolean` — se `shifts && shifts.assigned?(sbIdx)`, retorna `shifts.onShift?(sbIdx)`; senão `project.isWorkingTime(sbIdx)` | idem | 4 testes |
| 7.8.3.4 | ⚠️ `rollbackBookings(): void` — `doneEffort = 0`; para cada allocation, `lockedResource = null`; para cada candidate e leaf, `r.rollbackBookings(scIdx, property)` | idem | 4 testes |

---

### 7.9 — `TaskScenario.propagateDate` + `scheduleContainer` + `earliestStart` + `latestEnd`

**⚠️ RUBY: `TaskScenario.rb` (linhas 750–950 aprox.)**

**Pré-requisitos:** subfase 7.8.

#### 7.9.1 — `propagateDate`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.9.1.1 | ⚠️ `propagateDate(date: TjTime, atEnd: boolean, ignoreEffort = false): void` — `thisEnd = atEnd ? 'end' : 'start'`, `otherEnd = atEnd ? 'start' : 'end'` | idem | 2 testes |
| 7.9.1.2 | Setar flag `atEnd ? endPropagated = true : startPropagated = true` | idem | 2 testes |
| 7.9.1.3 | ⚠️ Se `leaf`: se `date > existing_end` (atEnd) ou `date < existing_start`, retorna (**shrink only**) | idem | 4 testes |
| 7.9.1.4 | Senão, setar `this[thisEnd] = date`; se `StartEnd`, atualizar `startIdx`/`endIdx` | idem | 3 testes |
| 7.9.1.5 | ⚠️ Se `milestone`: `markAsScheduled()`; se `this.a(otherEnd) === null`, `propagateDate(this.a(thisEnd), !atEnd)` | idem | 4 testes |
| 7.9.1.6 | Senão se `!scheduled && start && end && !(length === 0 && duration === 0 && effort === 0 && allocate não vazio)`, `markAsScheduled()` | idem | 3 testes |
| 7.9.1.7 | ⚠️ Se `atEnd`: se `ignoreEffort \|\| effort === 0`, para cada `[task, onEnd]` em `endpreds`, `propagateDateToDep(task, onEnd)` | idem | 3 testes |
| 7.9.1.8 | Para cada `[task, onEnd]` em `endsuccs`, `propagateDateToDep(task, onEnd)` | idem | 3 testes |
| 7.9.1.9 | Senão, simétrico com `startsuccs`, `startpreds` | idem | 4 testes |
| 7.9.1.10 | Para cada child em `property.children`: se `child.scenarioData(scIdx).canInheritDate(atEnd)`, `child.propagateDate(date, atEnd)` | idem | 3 testes |
| 7.9.1.11 | Para cada parent: `parent.scenarioData(scIdx).scheduleContainer()` | idem | 2 testes |

#### 7.9.2 — `propagateDateToDep`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.9.2.1 | ⚠️ `propagateDateToDep(task: Task, atEnd: boolean): void` — se `task.get('scheduled', scIdx) \|\| task.container()`, retorna | idem | 3 testes |
| 7.9.2.2 | Se `task.get(atEnd ? 'end' : 'start', scIdx) !== null`, retorna | idem | 2 testes |
| 7.9.2.3 | Se `task.hasDurationSpec(scIdx) && !(atEnd !== task.get('forward', scIdx))`, retorna | idem | 3 testes |
| 7.9.2.4 | `nDate = atEnd ? task.latestEnd() : task.earliestStart()`; se null, retorna | idem | 3 testes |
| 7.9.2.5 | `task.propagateDate(nDate, atEnd)` | idem | 1 teste |

#### 7.9.3 — `scheduleContainer`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.9.3.1 | ⚠️ `scheduleContainer(): void` — se `scheduled \|\| !container`, retorna | idem | 2 testes |
| 7.9.3.2 | `nStart = nEnd = null`; para cada child: se `!child.scheduled \|\| start null \|\| end null`, retorna | idem | 3 testes |
| 7.9.3.3 | `nStart = min(nStart, child.start)`; `nEnd = max(nEnd, child.end)` | idem | 3 testes |
| 7.9.3.4 | `startSet = endSet = false`; se `start === null \|\| start > nStart`, `start = nStart`, `startSet = true`; análogo para end | idem | 4 testes |
| 7.9.3.5 | `markAsScheduled()`; se `startSet`, `propagateDate(nStart, false)`; se `endSet`, `propagateDate(nEnd, true)` | idem | 3 testes |

#### 7.9.4 — `earliestStart` + `latestEnd` + `calcLength`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.9.4.1 | ⚠️ `earliestStart(): TjTime \| null` — `startDate = null`; para cada `dependency`: `potentialStart = dep.task.get(dep.onEnd ? 'end' : 'start', scIdx)`; se null, retorna null | idem | 4 testes |
| 7.9.4.2 | Loop `gapLength`: enquanto `gapLength > 0 && potentialStart < project.get('end')`, se `isWorkingTime`, `gapLength -= 1`; `potentialStart += scheduleGranularity` | idem | 4 testes |
| 7.9.4.3 | Ajustar com `gapDuration` (adiciona seconds) | idem | 3 testes |
| 7.9.4.4 | `startDate = max(startDate, potentialStart)` | idem | 2 testes |
| 7.9.4.5 | Se parent tem start, `startDate = max(startDate, parent.start)` | idem | 2 testes |
| 7.9.4.6 | Se `end && startDate > end`, error `impossible_start_dep` | idem | 2 testes |
| 7.9.4.7 | ⚠️ `latestEnd(): TjTime \| null` — simétrico (usando `precedes`, `gapLength`, `gapDuration`) | idem | 5 testes |
| 7.9.4.8 | Se `start && endDate < start`, error `impossible_end_dep` | idem | 2 testes |
| 7.9.4.9 | ⚠️ `calcLength(d1: TjTime, d2: TjTime): number` — conta slots working time entre d1 e d2 | idem | 3 testes |

#### 7.9.5 — `canInheritDate` + `hasDependencies` + `hasStrongDeps`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.9.5.1 | ⚠️ `canInheritDate?(atEnd: boolean): boolean` — se `this[thisEnd] != null \|\| hasStrongDeps(atEnd)`, retorna `false` | idem | 3 testes |
| 7.9.5.2 | Se container, retorna `true` | idem | 2 testes |
| 7.9.5.3 | `hasThatSpec = this.a(thatEnd) != null \|\| hasStrongDeps(!atEnd)` | idem | 2 testes |
| 7.9.5.4 | Se `hasThatSpec && !hasDurationSpec && allocate não vazio`, `true` | idem | 2 testes |
| 7.9.5.5 | Se `forward ^ atEnd`: `true` se `hasDurationSpec \|\| booking não vazio`; senão `hasThatSpec` | idem | 4 testes |
| 7.9.5.6 | Senão: `this.a(thatEnd) != null && !hasDurationSpec && booking vazio` | idem | 3 testes |
| 7.9.5.7 | ⚠️ `hasDependencies(atEnd): boolean` — `this.a(thisEnd + 'succs') não vazio \|\| this.a(thisEnd + 'preds') não vazio` | idem | 3 testes |
| 7.9.5.8 | ⚠️ `hasStrongDeps?(atEnd): boolean` — se `atEnd`, `!endsuccs.empty`; senão `!startpreds.empty` | idem | 3 testes |

---

### 7.10 — `TaskScenario.bookBookings` + `finishScheduling` + `postScheduleCheck` + completion/status/gauge

**⚠️ RUBY: `TaskScenario.rb` (linhas 950–1200 aprox.)**

**Pré-requisitos:** subfase 7.9.

#### 7.10.1 — `bookBookings` + `findBookings`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.10.1.1 | ⚠️ `bookBookings(): void` — `firstSlotIdx = lastSlotIdx = null` | idem | 1 teste |
| 7.10.1.2 | Se `effortdone \|\| effortleft`: forçar `forward = true`; validar start, effort, effortdone <= effort, não ambos effortdone/effortleft | idem | 5 testes |
| 7.10.1.3 | Calcular `doneEffort`; `firstSlotIdx = dateToIdx(start)`; `lastSlotIdx = dateToIdx(now)` | idem | 3 testes |
| 7.10.1.4 | ⚠️ `bookings = findBookings()` — para cada booking: validar resource leaf, forward ou scheduled | idem | 3 testes |
| 7.10.1.5 | Para cada `interval`: calcular `startIdx`, `endIdx`; para cada `idx`: se `booking.resource.bookBooking(scIdx, idx, booking)`, incrementa `doneEffort`, atualiza first/last | idem | 4 testes |
| 7.10.1.6 | Marcar resource em `assignedresources` | idem | 2 testes |
| 7.10.1.7 | Se `start === null \|\| (doneEffort > 0 && effort > 0)`, setar `start = idxToDate(firstSlotIdx)` | idem | 3 testes |
| 7.10.1.8 | Se `lastSlotIdx !== null && !scheduled`, tentar satisfazer durationSpec com base em bookings | idem | 3 testes |
| 7.10.1.9 | Se `doneEffort > 0`, `currentSlotIdx = project.dateToIdx(now)` | idem | 1 teste |
| 7.10.1.10 | Warnings de overbooking (se `doneEffort > effort`) | idem | 2 testes |
| 7.10.1.11 | ⚠️ `findBookings(): Booking[]` — encontra cenário com `ownbookings` (sobe até achar); retorna `property.get('booking', cenárioEncontrado.scenarioIdx)` | idem | 4 testes |

#### 7.10.2 — `finishScheduling`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.10.2.1 | ⚠️ `finishScheduling(): void` — recursivo em `children` | idem | 2 testes |
| 7.10.2.2 | Para cada parent: `parent.assignedresources += this.assignedresources` | idem | 3 testes |
| 7.10.2.3 | `candidates = mandatories = allLimits = null` (liberar memória) | idem | 1 teste |

#### 7.10.3 — `postScheduleCheck`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.10.3.1 | ⚠️ `postScheduleCheck(): boolean` — `errors = 0`; para cada child: `errors += child.postScheduleCheck(scIdx) ? 0 : 1` | idem | 3 testes |
| 7.10.3.2 | Se errors > 0, retorna `false` | idem | 2 testes |
| 7.10.3.3 | Se `isRunAway`, error `sched_runaway` | idem | 2 testes |
| 7.10.3.4 | Se `!scheduled`, error `not_scheduled` | idem | 2 testes |
| 7.10.3.5 | Checagens de dependentes runaway | idem | 3 testes |
| 7.10.3.6 | Start/end definidos e dentro do timeframe | idem | 3 testes |
| 7.10.3.7 | `minstart`, `maxstart`, `minend`, `maxend` — warnings | idem | 4 testes |
| 7.10.3.8 | Start <= end | idem | 2 testes |
| 7.10.3.9 | Task dentro do parent | idem | 2 testes |
| 7.10.3.10 | Predecessores antes, sucessores depois (com gaps) | idem | 3 testes |
| 7.10.3.11 | Milestone com `start == end` | idem | 2 testes |
| 7.10.3.12 | Se `leaf && effort === 0 && !milestone && allocate não vazio && assignedresources vazio`, warning `allocate_no_assigned` | idem | 3 testes |
| 7.10.3.13 | Warnings de priority inversion | idem | 2 testes |
| 7.10.3.14 | Retorna `errors === 0` | idem | 1 teste |

#### 7.10.4 — `calcCompletion` + `calcStatus` + `calcGauge`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.10.4.1 | ⚠️ `calcCompletion(): number \| null` — se cacheado, retorna | idem | 1 teste |
| 7.10.4.2 | Se start/end null, `complete = 0.0`, retorna | idem | 2 testes |
| 7.10.4.3 | Senão `complete = calcTaskCompletion()` | idem | 2 testes |
| 7.10.4.4 | ⚠️ `calcTaskCompletion(): number \| null` — container: média de children | idem | 3 testes |
| 7.10.4.5 | Leaf: se `end <= now`, retorna 100; se `now <= start`, retorna 0 | idem | 4 testes |
| 7.10.4.6 | Leaf: se `effort > 0`, `done / total * 100`; senão `(now - start) / (end - start) * 100` | idem | 4 testes |
| 7.10.4.7 | ⚠️ `calcStatus(): void` — calcular `complete` se não; determinar status (`not reached`, `done`, `in progress`, `unknown`) | idem | 4 testes |
| 7.10.4.8 | ⚠️ `calcGauge(): string` — container: max de gauges dos children; leaf: comparar `complete` com `calcTaskCompletion()` | idem | 4 testes |

---

## Bloco E — ResourceScenario

### 7.11 — `ResourceScenario.initScoreboard`

**⚠️ RUBY: `ResourceScenario.rb` (linhas 1–200 aprox.) — `prepareScheduling`, `calcCriticalness`, `initScoreboard`, `available?`, `getMinSlot`, `getMaxSlot`**
**🔎 CHEAT: §12 Categoria B (`idxToDate`)**

**Pré-requisitos:** Fases 2–6.

#### 7.11.1 — Campos + `prepareScheduling` + `calcCriticalness`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.11.1.1 | Adicionar campos `scoreboard: Scoreboard<number \| Task \| null> \| null`, `firstBookedSlot`, `lastBookedSlot`, `firstBookedSlots: Map<Task, number>`, `lastBookedSlots: Map<Task, number>`, `minslot`, `maxslot` | `src/model/resource-scenario.ts` | `deno check` |
| 7.11.1.2 | Adicionar campos `effort`, `criticalness`, `duties`, `limits` | idem | `deno check` |
| 7.11.1.3 | ⚠️ `prepareScheduling(): void` — `effort = 0`; se leaf, `initScoreboard()` | idem | 3 testes |
| 7.11.1.4 | ⚠️ `calcCriticalness(): void` — se `scoreboard === null`, `criticalness = 0` | idem | 2 testes |
| 7.11.1.5 | Senão: `freeSlots = count(null)`; `criticalness = freeSlots === 0 ? 1.0 : alloctdeffort / freeSlots` | idem | 3 testes |

#### 7.11.2 — `initScoreboard` (5 camadas)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.11.2.1 | ⚠️ `initScoreboard(): void` — criar `Scoreboard<number \| Task \| null>` com initVal `2` | idem | 2 testes |
| 7.11.2.2 | Para cada i em `[0, project.scoreboardSize)`: se `onShift(i)`, `scoreboard.set(i, null)` | idem | 3 testes |
| 7.11.2.3 | ⚠️ Global leaves (camada 3): para cada `leave` em `project.get('leaves')`, para cada slot no intervalo: `val = scoreboard.get(i)`; `scoreboard.set(i, (val === null ? 0 : 2) \| packLeaveType(leave.typeIdx))` | idem | 4 testes |
| 7.11.2.4 | ⚠️ Resource leaves (camada 4): para cada `leave` em `this.a('leaves')`: se `val !== null && val !== 0`, `oldType = unpackLeaveType(val)`; se `leave.typeIdx > oldType`, `scoreboard.set(i, (val & 0x2) \| packLeaveType(leave.typeIdx))`; senão `scoreboard.set(i, packLeaveType(leave.typeIdx))` | idem | 5 testes |
| 7.11.2.5 | ⚠️ Shifts (camada 5): se `shifts !== null`, para cada i: `v = shifts.getSbSlot(i)`; se `hasOverride(v)`, `scoreboard.set(i, (v & 0x3E) === 0 ? null : (v & 0x3D))`; senão se `(scoreboard.get(i) === null \|\| unpackLeaveType(scoreboard.get(i)) < unpackLeaveType(v)) && unpackLeaveType(v) !== 0`, `scoreboard.set(i, v & 0x3E)` | idem | 5 testes |
| 7.11.2.6 | Determinar `minslot` e `maxslot` | idem | 2 testes |
| 7.11.2.7 | Teste agregado: scoreboard com working hours, global leaves, resource leaves e shifts — verificar bits em ~10 índices | idem | 1 teste |

#### 7.11.3 — `available?` + `getMinSlot` + `getMaxSlot`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.11.3.1 | ⚠️ `available?(sbIdx: number): boolean` — se `!leaf`, retorna `true` | idem | 2 testes |
| 7.11.3.2 | Se `initScoreboard` ainda não rodou, roda | idem | 1 teste |
| 7.11.3.3 | Se `scoreboard.get(sbIdx) !== null`, `false` (slot não-working) | idem | 2 testes |
| 7.11.3.4 | Se `limits && !limits.ok(sbIdx, true, this.property)`, `false` | idem | 2 testes |
| 7.11.3.5 | Retorna `true` | idem | 1 teste |
| 7.11.3.6 | ⚠️ `getMinSlot()`, `getMaxSlot()` — lazy | idem | 4 testes |

---

### 7.12 — `ResourceScenario.book` + `bookBooking` + `bookedEffort`

**⚠️ RUBY: `ResourceScenario.rb` (linhas 200–400 aprox.)**

**Pré-requisitos:** subfase 7.11.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.12.1 | ⚠️ `book(sbIdx: number, task: Task, force = false): boolean` — se `!force && !available?(sbIdx)`, `false` | idem | 3 testes |
| 7.12.2 | `duties += task` se não estiver | idem | 2 testes |
| 7.12.3 | `scoreboard.set(sbIdx, task)` (Task é armazenada no slot) | idem | 3 testes |
| 7.12.4 | `effort += efficiency` | idem | 2 testes |
| 7.12.5 | `limits.inc(sbIdx)` se existir | idem | 2 testes |
| 7.12.6 | `task.scenarioData(scIdx).incLimits(sbIdx, this.property)` | idem | 2 testes |
| 7.12.7 | Atualizar `firstBookedSlot`/`lastBookedSlot` + maps | idem | 3 testes |
| 7.12.8 | Retorna `true` | idem | 1 teste |
| 7.12.9 | ⚠️ `bookBooking(sbIdx, booking): boolean` — se `scoreboard === null`, `initScoreboard()` | idem | 1 teste |
| 7.12.10 | `val = scoreboard.get(sbIdx)`; se `val !== null`: se `booked?(sbIdx)`, error `booking_conflict` | idem | 3 testes |
| 7.12.11 | Se `(val & 2) !== 0 && booking.overtime < 1`, warning/error `booking_no_duty`, retorna `false` | idem | 3 testes |
| 7.12.12 | Se `(val & 0x3C) !== 0 && booking.overtime < 2`, warning/error `booking_on_vacation`, retorna `false` | idem | 3 testes |
| 7.12.13 | `book(sbIdx, booking.task, true)` | idem | 1 teste |
| 7.12.14 | ⚠️ `booked?(sbIdx): boolean` = `scoreboard.get(sbIdx) instanceof Task` | idem | 3 testes |
| 7.12.15 | ⚠️ `bookedTask(sbIdx): Task \| null` — retorna task ou null | idem | 3 testes |
| 7.12.16 | ⚠️ `bookedEffort(scIdx): number` — se leaf, `effort`; senão, soma de `children.bookedEffort(scIdx)` | idem | 3 testes |
| 7.12.17 | ⚠️ `treeSum(cacheTag: string, startIdx, endIdx, ...args, fn): number` — usa `DataCache.instance.cached(this, cacheTag, startIdx, endIdx, ...args, () => ...)` | idem | 4 testes |
| 7.12.18 | `treeSum` — se container, soma de children; senão `fn()` | idem | 3 testes |
| 7.12.19 | ⚠️ `rollbackBookings(scIdx, task): void` — para cada slot de `firstBookedSlots[task]` a `lastBookedSlots[task]`, restaurar `null` se o slot contém `task` | idem | 4 testes |

---

### 7.13 — `ResourceScenario` slots + tree

**⚠️ RUBY: `ResourceScenario.rb` (linhas 400–550 aprox.)**

**Pré-requisitos:** subfase 7.12.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.13.1 | ⚠️ `getAllocatedSlots(startIdx, endIdx, task = null): number` — se `scoreboard === null`, `0`; `fitIndicies`; conta slots com `Task` e (task null ou `task.all().includes(slot)`) | idem | 5 testes |
| 7.13.2 | ⚠️ `getFreeSlots(startIdx, endIdx): number` — conta slots com `null` | idem | 3 testes |
| 7.13.3 | ⚠️ `getWorkSlots(startIdx, endIdx): number` — conta `null \|\| Task` | idem | 3 testes |
| 7.13.4 | ⚠️ `getLeaveSlots(startIdx, endIdx, type): number` — conta `isLeaveType(val, type)` | idem | 3 testes |
| 7.13.5 | ⚠️ `getTimeOffSlots(startIdx, endIdx): number` — conta `(val & 2) === 0 && (val & 0x3C) !== 0` | idem | 3 testes |
| 7.13.6 | ⚠️ `countSlots(startIdx, endIdx, predicate): number` — helper | idem | 2 testes |
| 7.13.7 | ⚠️ `fitIndicies(startIdx, endIdx, task?): [number, number]` — clampa aos bookedSlots | idem | 4 testes |
| 7.13.8 | ⚠️ `collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>` — se `!leaf`, `[]`; senão `scoreboard.collectIntervals(iv, minDuration, isTimeOff)` | idem | 4 testes |
| 7.13.9 | ⚠️ `collectLeaveIntervals(iv, type): IntervalList<TimeInterval>` — análogo com `isLeaveType` | idem | 3 testes |
| 7.13.10 | Teste agregado: recurso com bookings + leaves + shifts, verificar contagens de cada tipo de slot | idem | 1 teste |

---

### 7.14 — `ResourceScenario` effective work

**⚠️ RUBY: `ResourceScenario.rb` (linhas 550–700 aprox.)**

**Pré-requisitos:** subfase 7.13.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.14.1 | ⚠️ `getEffectiveWork(startIdx, endIdx, task = null): number` — se `startIdx >= endIdx \|\| (task && !duties.includes(task))`, `0.0` | idem | 3 testes |
| 7.14.2 | Cache: `cached(this, 'ResourceScenarioGetEffectiveWork', startIdx, endIdx, task, () => ...)` | idem | 1 teste (cache hit) |
| 7.14.3 | Se container: soma de children | idem | 3 testes |
| 7.14.4 | Senão: `convertToDailyLoad(getAllocatedSlots(...) * scheduleGranularity) * efficiency` | idem | 3 testes |
| 7.14.5 | ⚠️ `getAllocatedTime(startIdx, endIdx, task = null): number` — `treeSum('getAllocatedTime', ..., () => convertToDailyLoad(...))` | idem | 3 testes |
| 7.14.6 | ⚠️ `getEffectiveFreeTime(startIdx, endIdx): number` — `treeSum('getEffectiveFreeTime', ..., () => getFreeSlots(...) * scheduleGranularity)` | idem | 3 testes |
| 7.14.7 | ⚠️ `getEffectiveFreeWork(startIdx, endIdx): number` — `treeSum('getEffectiveFreeWork', ..., () => convertToDailyLoad(getFreeSlots(...) * scheduleGranularity) * efficiency)` | idem | 3 testes |
| 7.14.8 | ⚠️ `getTimeOffDays(startIdx, endIdx): number` — `treeSum('getTimeOffDays', ..., () => convertToDailyLoad(getTimeOffSlots(...) * scheduleGranularity) * efficiency)` | idem | 3 testes |
| 7.14.9 | ⚠️ `getLeave(startIdx, endIdx, type): number` — `treeSum('getLeave', ..., () => convertToDailyLoad(scheduleGranularity * getLeaveSlots(...)))` | idem | 4 testes |
| 7.14.10 | Teste agregado: `getEffectiveWork` em container soma children | idem | 1 teste |

---

### 7.15 — `ResourceScenario` queries + turnover + cost

**⚠️ RUBY: `ResourceScenario.rb` (linhas 700–900 aprox.)**

**Pré-requisitos:** subfase 7.14.

#### 7.15.1 — `turnover` + `cost` + `rate`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.15.1.1 | ⚠️ `turnover(startIdx, endIdx, account, task = null, includeKids = false): number` — se container && includeKids: soma children | idem | 3 testes |
| 7.15.1.2 | Se `task`: `task.turnover(scIdx, startIdx, endIdx, account, this.property)` (chamada **parcial**; Fase 8 completa) | idem | 2 testes |
| 7.15.1.3 | Senão: `totalResourceCost = cost(startIdx, endIdx)`; itera `chargeset` shares | idem | 3 testes |
| 7.15.1.4 | ⚠️ `cost(startIdx, endIdx, task = null): number` = `getAllocatedTime(startIdx, endIdx, task) * rate` | idem | 4 testes |
| 7.15.1.5 | ⚠️ `get rate(): number` — container: soma de children; leaf: `this.a('rate')` | idem | 3 testes |

#### 7.15.2 — Queries (18)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.15.2.1 | ⚠️ `query_annualleave(query): void` | idem | 2 testes |
| 7.15.2.2 | ⚠️ `query_annualleavelist(query): void` | idem | 2 testes |
| 7.15.2.3 | ⚠️ `query_annualleavebalance(query): void` | idem | 2 testes |
| 7.15.2.4 | ⚠️ `query_cost(query): void` | idem | 2 testes |
| 7.15.2.5 | ⚠️ `query_duties(query): void` | idem | 2 testes |
| 7.15.2.6 | ⚠️ `query_effort(query): void` | idem | 2 testes |
| 7.15.2.7 | ⚠️ `query_effortdone(query): void` | idem | 2 testes |
| 7.15.2.8 | ⚠️ `query_effortleft(query): void` | idem | 2 testes |
| 7.15.2.9 | ⚠️ `query_freetime(query): void` | idem | 2 testes |
| 7.15.2.10 | ⚠️ `query_freework(query): void` | idem | 2 testes |
| 7.15.2.11 | ⚠️ `query_fte(query): void` | idem | 2 testes |
| 7.15.2.12 | ⚠️ `query_headcount(query): void` | idem | 2 testes |
| 7.15.2.13 | ⚠️ `query_rate(query): void` | idem | 2 testes |
| 7.15.2.14 | ⚠️ `query_revenue(query): void` | idem | 2 testes |
| 7.15.2.15 | ⚠️ `query_sickleave(query): void` | idem | 2 testes |
| 7.15.2.16 | ⚠️ `query_specialleave(query): void` | idem | 2 testes |
| 7.15.2.17 | ⚠️ `query_timeoffdays(query): void` | idem | 2 testes |
| 7.15.2.18 | ⚠️ `query_unpaidleave(query): void` | idem | 2 testes |

---

## Bloco F — TaskScenario queries

### 7.16 — `TaskScenario` queries + turnover + effective work

**⚠️ RUBY: `TaskScenario.rb` (linhas 1200–1500 aprox. — queries)**

**Pré-requisitos:** subfase 7.10.

#### 7.16.1 — Queries implementadas nesta fase

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.16.1.1 | ⚠️ `query_activetasks(query): void` | idem | 2 testes |
| 7.16.1.2 | ⚠️ `query_closedtasks(query): void` | idem | 2 testes |
| 7.16.1.3 | ⚠️ `query_competitorcount(query): void` | idem | 2 testes |
| 7.16.1.4 | ⚠️ `query_complete(query): void` | idem | 2 testes |
| 7.16.1.5 | ⚠️ `query_cost(query): void` | idem | 2 testes |
| 7.16.1.6 | ⚠️ `query_duration(query): void` | idem | 2 testes |
| 7.16.1.7 | ⚠️ `query_effort(query): void` | idem | 2 testes |
| 7.16.1.8 | ⚠️ `query_effortdone(query): void` | idem | 2 testes |
| 7.16.1.9 | ⚠️ `query_effortleft(query): void` | idem | 2 testes |
| 7.16.1.10 | ⚠️ `query_followers(query): void` | idem | 2 testes |
| 7.16.1.11 | ⚠️ `query_gauge(query): void` | idem | 2 testes |
| 7.16.1.12 | ⚠️ `query_headcount(query): void` | idem | 2 testes |
| 7.16.1.13 | ⚠️ `query_inputs(query): void` | idem | 2 testes |
| 7.16.1.14 | ⚠️ `query_maxend`, `query_maxstart`, `query_minend`, `query_minstart` (usando `queryDateLimit`) | idem | 8 testes |
| 7.16.1.15 | ⚠️ `query_opentasks(query): void` | idem | 2 testes |
| 7.16.1.16 | ⚠️ `query_precursors(query): void` | idem | 2 testes |
| 7.16.1.17 | ⚠️ `query_resources(query): void` | idem | 2 testes |
| 7.16.1.18 | ⚠️ `query_revenue(query): void` | idem | 2 testes |
| 7.16.1.19 | ⚠️ `query_scheduling(query): void` | idem | 2 testes |
| 7.16.1.20 | ⚠️ `query_status(query): void` | idem | 2 testes |
| 7.16.1.21 | ⚠️ `query_targets(query): void` | idem | 2 testes |

#### 7.16.2 — Queries stub (Fase 16)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.16.2.1 | `query_journal(query)` — lança `NotYetImplementedError("Fase 16")` | idem | 1 teste |
| 7.16.2.2 | `query_alert(query)` — lança | idem | 1 teste |
| 7.16.2.3 | `query_alerttrend(query)` — lança | idem | 1 teste |
| 7.16.2.4 | `query_alertmessages`, `query_alertsummaries` — lançam | idem | 2 testes |
| 7.16.2.5 | `query_journalmessages`, `query_journalsummaries` — lançam | idem | 2 testes |

#### 7.16.3 — `turnover` + `getAllocatedTime` + `getEffectiveWork` + `collectTimeOffIntervals`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.16.3.1 | ⚠️ `turnover(startIdx, endIdx, account, resource = null, includeKids = true): number` — se container && includeKids, soma children | idem | 3 testes |
| 7.16.3.2 | Determinar `chargeset = resource ? resource.chargeset : this.chargeset`; se vazio, retorna 0 | idem | 3 testes |
| 7.16.3.3 | `resourceCost = resource ? resource.cost(...) : sum over assignedresources` | idem | 3 testes |
| 7.16.3.4 | `otherCost` = sum de `charge.turnover(iv)` | idem | 2 testes |
| 7.16.3.5 | Distribuir `(resourceCost + otherCost) * share` | idem | 3 testes |
| 7.16.3.6 | ⚠️ `getAllocatedTime(startIdx, endIdx, resource = null): number` — cache `TaskScenarioAllocatedTime` | idem | 4 testes |
| 7.16.3.7 | Container: soma children; leaf: soma over assignedresources | idem | 3 testes |
| 7.16.3.8 | ⚠️ `getEffectiveWork(startIdx, endIdx, resource = null): number` — cache `TaskScenarioEffectiveWork` | idem | 4 testes |
| 7.16.3.9 | ⚠️ `collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>` — cache `TaskScenarioCollectTimeOffIntervals` | idem | 4 testes |
| 7.16.3.10 | Container: interseção de children; leaf: se tem assignedresources, interseção deles; senão, global | idem | 4 testes |

#### 7.16.4 — Helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.16.4.1 | ⚠️ `isDependencyOf(task, depth, list = []): boolean` — recursivo, sem limite se `depth === 0` | idem | 4 testes |
| 7.16.4.2 | ⚠️ `isFeatureOf(task): boolean` — `sources = property.all()`, `destinations = task.all()` | idem | 3 testes |
| 7.16.4.3 | ⚠️ `hasResourceAllocated?(interval, resource): boolean` | idem | 3 testes |
| 7.16.4.4 | ⚠️ `assignedResources(interval?): Resource[]` | idem | 4 testes |

---

## Bloco G — Integração + Golden tests

### 7.17 — `MockProject.schedule` (versão mínima)

**⚠️ Objetivo:** permitir testes end-to-end sem depender do `Project` real (Fase 9).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.17.1 | Adicionar `MockProject.schedule(): boolean` — pipeline mínimo: `AttributeBase.setMode(1); prepareScenario(scIdx)` | `tests/model/mock-project.ts` | 1 teste |
| 7.17.2 | `AttributeBase.setMode(2); scheduleScenario(scIdx)` | idem | 1 teste |
| 7.17.3 | `finishScenario(scIdx)` | idem | 1 teste |
| 7.17.4 | `prepareScenario(scIdx)` — chama `prepareScheduling` + `Xref` + `preScheduleCheck` para cada task/resource | idem | 3 testes |
| 7.17.5 | `scheduleScenario(scIdx)` — loop de `Task.schedule(scIdx)` ordenado por `priority`, `pathcriticalness`, `seqno` | idem | 3 testes |
| 7.17.6 | `finishScenario(scIdx)` — chama `finishScheduling` + `postScheduleCheck` para tasks | idem | 2 testes |

---

### 7.18 — Golden tests (scheduler)

**⚠️ RUBY: 9 MWEs + `TestSuite/Scheduler/Correct/*.tjp`**

**Objetivo:** rodar `tj3` em cada MWE/testcase e comparar cronogramas.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 7.18.1 | Atualizar `scripts/golden/README.md` com seção de `scheduler` | idem | existe |
| 7.18.2 | Criar `scripts/golden/scheduler-mwe001.rb` — roda `tj3 mwe001/tutorial.tjp`, lê HTML, extrai `id`, `start`, `end`, `effort` de cada task | idem | JSON válido |
| 7.18.3 | Repetir para `mwe002.rb` a `mwe009.rb` (9 scripts) | idem | 9 JSONs |
| 7.18.4 | Criar `scripts/golden/scheduler-testcases.rb` — itera `TestSuite/Scheduler/Correct/*.tjp` e extrai cronogramas | idem | JSON válido |
| 7.18.5 | Serializar em `scheduler.golden.json` (agrega todos) | idem | ≥ 60 casos |
| 7.18.6 | Task `golden:generate` atualizada | `deno.jsonc` | roda |
| 7.18.7 | Criar `tests/golden/scheduler_golden_test.ts` — para cada caso: constrói `MockProject`, chama `schedule()`, compara `start`/`end`/`effort` | idem | verde |
| 7.18.8 | Se divergência: mostrar input, expected, actual | idem | 3 testes |
| 7.18.9 | Cobertura ≥ 60 casos (9 MWEs + ~50 testcases) | idem | verde |
| 7.18.10 | Commitar `scheduler.golden.json` em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco H — Verificação final

### 7.19 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 7.19.1 | `deno task check-all` verde | exit 0 |
| 7.19.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 7.19.3 | `grep -r "NotYetImplementedError" packages/core/src/model/task-scenario.ts` — apenas queries de Journal (Fase 16) | ≤ 8 ocorrências |
| 7.19.4 | ADR 018 criada e commitada | git log |
| 7.19.5 | Todos os métodos de `TaskScenario` e `ResourceScenario` implementados (exceto stubs de Journal) | `deno check` |
| 7.19.6 | `tests/integration/smoke_after_phase_7_test.ts` — cria `MockProject`, roda `schedule()` com 1 task, verifica `scheduled === true`; verifica Fase 6 (`ShiftAssignments`) | 1 teste |
| 7.19.7 | Auditoria: cada subfase do plano `fase-7-scheduler-core.md` tem tarefas correspondentes | grep |
| 7.19.8 | Corrigir numeração em `fase-7-scheduler-core.md` (`### 11.X` → `### 7.X`, `ADR 017` → `ADR 018`) | grep |

---

## Notas para a IA

1. **Ordem:** 7.0 → 7.1 → 7.2 → 7.3 → 7.4 → 7.11 → 7.12 → 7.13 → 7.14 → 7.5 → 7.6 → 7.7 → 7.8 → 7.9 → 7.10 → 7.15 → 7.16 → 7.17 → 7.18 → 7.19.
   - **Por quê:** `ResourceScenario` é pré-requisito de `TaskScenario.bookResource`.
   - Exceção: 7.1 (DataCache) pode rodar primeiro, é independente.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura.
3. **Fidelidade absoluta.** Cada linha tem razão. Não simplificar.
4. **Ordem importa em `bookResources`.** Não reordenar.
5. **`propagateDate` shrink-only.** Nunca expandir.
6. **`markAsMilestone` pode ser chamado múltiplas vezes.** Idempotente.
7. **`DataCache` é singleton.** Sempre `DataCache.instance`.
8. **`treeSum` precisa de cacheTag explícito.**
9. **`checkForLoops` usa `deadEndFlags`.** Resetar antes de rodar.
10. **`calcPathCriticalness` memoiza em `pathcriticalness`.**
11. **`MockProject.schedule()` é mínimo.** Não confundir com `Project.schedule()`.
12. **Queries que dependem de Journal lançam `NotYetImplementedError`.** Fase 16 completa.
13. **`initScoreboard` é chamado 1× por `ResourceScenario`.**
14. **`onShift?` de `TaskScenario` usa `project.isWorkingTime`.** Não confundir com `ResourceScenario.onShift?`.
15. **`AttributeBase.setMode(0)` em `beforeEach`** — sem isso, testes vazam.
16. **`bookedTask` retorna `Task \| null`.**
17. **Scoreboard de `ResourceScenario` aceita `number \| Task \| null`.** Não forçar tipos.
18. **Golden tests são a prova.** Se divergir, corrigir TS, não golden.
19. **Sem `any`.** Use `unknown` + narrowing.
20. **Commit por subfase.** `feat(core): task-scenario-schedule`, etc.
21. **ADR 018** (não 017). **ADR 017** é scoreboard encoding (Fase 6).
22. **Não tocar em Fase 8/9/16.** Stubs e comentários `// TODO Fase N: <razão>`.

---

## Notas específicas por subfase

### 7.1 — DataCache

- **Coração da performance.** Sem cache, scheduler O(n²).
- **`hash` deve lidar com todos os tipos** que aparecem como args: `TjTime`, `Task`, `Resource`, primitivos.
- **`flush` mantém contadores** (hits/misses) para debug.

### 7.2–7.4 — Estruturas

- **`TaskDependency.resolve`** é tardio — `taskId` é string, `task` é resolvido depois.
- **`Allocation.candidatesList`** tem 5 modos. Ordenação diferente por modo.
- **`Booking`** é praticamente uma struct.

### 7.5 — `prepareScheduling`

- **`markAsMilestone`** é a parte mais sutil. Seguir a condição exata.
- **`Xref` + `checkDependency`** populam 4 listas. Ordem importa.
- **`preScheduleCheck`** tem ~14 validações. Cada uma é um teste.

### 7.6 — `checkForLoops` + criticalness

- **DFS com 4 flags.** Resetar antes de cada top-level.
- **`calcPathCriticalness`** memoiza. Container vs leaf.
- **`countResourceAllocations`** distribui effort médio.

### 7.7–7.10 — `TaskScenario` scheduling

- **`scheduleSlot`** é o loop principal. Dispatch por `durationType`.
- **`bookResources`** tem ~14 verificações em cascata. Não reordenar.
- **`propagateDate` shrink-only.** Testar shrink-only explicitamente.
- **`bookBookings`** processa bookings manuais.
- **`postScheduleCheck`** tem ~14 validações.

### 7.11–7.15 — `ResourceScenario`

- **`initScoreboard`** tem 5 camadas. Ordem importa.
- **`book`** armazena `Task` no slot do scoreboard.
- **`booked?`** = `scoreboard.get(sbIdx) instanceof Task`.
- **`treeSum`** precisa de `cacheTag` explícito.
- **Queries** seguem padrão: `query.<field> = valor`.
- **`turnover`** é parcial (Fase 8 completa com `ChargeSet`).

### 7.16 — `TaskScenario` queries

- **Queries de Journal são stubs** (`NotYetImplementedError`).
- **`turnover`** integra `resourceCost + otherCost`.
- **`collectTimeOffIntervals`** usa `DataCache`.

### 7.17 — `MockProject.schedule`

- **Pipeline mínimo:** `setMode(1) → prepareScenario` → `setMode(2) → scheduleScenario` → `finishScenario`.
- **Não é o `Project` real.** Fase 9 substitui.

### 7.18 — Golden tests

- **9 MWEs + TestSuite/Scheduler/Correct/.** ≥ 60 casos.
- **Comparação de `start`, `end`, `effort` de cada task.**
- **Se divergir, corrigir TS.**

### 7.19 — Verificação

- **Sem stubs além dos de Journal.**
- **Smoke test cobre Fase 6.**

---

**Fim do arquivo de tarefas da Fase 7.**