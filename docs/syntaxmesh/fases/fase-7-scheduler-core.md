# Fase 7 — Scheduler Core

> **Arquivo:** `docs/syntaxmesh/fases/fase-7-scheduler-core.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 15–20 dias
> **Depende de:** Fases 2–6
> **Bloqueia:** Fases 8, 9, 11, 14, 21

---

## 1. Contexto

Esta é a **fase mais longa e complexa do projeto**. Aqui implementamos o **coração do TaskJuggler**: o algoritmo heurístico de agendamento baseado em slots, com alocação de recursos, propagação de datas, detecção de loops, cálculo de caminho crítico e processamento de bookings.

Os 4 arquivos Ruby principais são:

- `TaskScenario.rb` (~1200 linhas) — o algoritmo de agendamento propriamente dito.
- `ResourceScenario.rb` (~900 linhas) — book, disponibilidade, cálculos de esforço.
- `Allocation.rb` — como recursos são escolhidos (5 modos de seleção).
- `Booking.rb` — trabalho manualmente registrado.
- `TaskDependency.rb` — dependências entre tarefas.

O algoritmo é **heurístico greedy** com priorização dinâmica:
1. Processa tarefas "Ready" em ordem de prioridade.
2. Para cada tarefa, agenda slot-a-slot (`currentSlotIdx` avança).
3. Em cada slot, tenta alocar todos os recursos necessários.
4. Propaga datas para dependentes.
5. Detecta loops, over/underspecification, runaway tasks.

**Nota crítica:** a fidelidade aqui é absoluta. Um bug sutil pode produzir cronogramas errados em projetos complexos. Golden tests são obrigatórios e cobrem todos os 9 MWEs + casos do `docs/taskjuggler/test/TestSuite/`.

Ao final desta fase, o motor é **funcional**. O parser (Fase 10) será apenas a porta de entrada.

---

## 2. Objetivo

Ao final desta fase:

- `TaskDependency`, `Allocation`, `Booking` implementados.
- `TaskScenario` completo (`prepareScheduling`, `Xref`, `preScheduleCheck`, `checkForLoops`, `calcCriticalness`, `calcPathCriticalness`, `schedule`, `scheduleSlot`, `bookResources`, `bookResource`, `propagateDate`, `scheduleContainer`, `earliestStart`, `latestEnd`, `bookBookings`, `finishScheduling`, `postScheduleCheck`, `calcCompletion`, `calcStatus`, `calcGauge`).
- `ResourceScenario` completo (`initScoreboard`, `book`, `bookBooking`, `available?`, `getAllocatedSlots`, `getFreeSlots`, `getWorkSlots`, `getLeaveSlots`, `getTimeOffSlots`, `treeSum`, `getEffectiveWork`, `getEffectiveFreeTime`, `getEffectiveFreeWork`, `getTimeOffDays`, `getLeave`, `collectTimeOffIntervals`, `collectLeaveIntervals`, `getAllocatedTime`, `turnover`, `cost`, `rate`).
- `TaskScenario.turnover`, `getAllocatedTime`, `getEffectiveWork`, `collectTimeOffIntervals`.
- Queries: `query_effort`, `query_duration`, `query_complete`, `query_cost`, `query_revenue`, `query_rate`, `query_status`, `query_activetasks`, `query_closedtasks`, `query_opentasks`, `query_competitorcount`, `query_competitors`, `query_gauge`, `query_priority`, `query_resources`, `query_responsible`, `query_scheduling`, `query_followers`, `query_precursors`, `query_inputs`, `query_targets`, `query_headcount`, `query_effortdone`, `query_effortleft`, `query_annualleave`, `query_annualleavelist`, `query_annualleavebalance`, `query_sickleave`, `query_specialleave`, `query_unpaidleave`, `query_timeoffdays`, `query_duties`, `query_freework`, `query_freetime`, `query_fte`.
- **≥ 250 testes unitários** + **≥ 60 golden tests** (os 9 MWEs + casos de `TestSuite/Scheduler/`).
- ADR 017 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `TaskScenario.rb` | ~1200 | **Altíssima** | **Crítica** |
| `ResourceScenario.rb` | ~900 | **Altíssima** | **Crítica** |
| `Allocation.rb` | ~130 | Média | **Crítica** |
| `Booking.rb` | ~50 | Baixa | **Crítica** |
| `TaskDependency.rb` | ~50 | Baixa | **Crítica** |
| `DataCache.rb` | ~150 | Média | Suporte |
| `Scoreboard.rb` | ~180 | Média | Revisitar |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/03-bluprint-engine2.md` | §3 TaskScenario (coração) | Estrutura completa |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.3 Algoritmo principal `schedule()` | Loop |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.4 `scheduleSlot()` | Loop interno |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.5 `bookResources()` | Alocação |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.6 `bookResource()` | Booking |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.7 `propagateDate()` | Propagação |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.8 `checkForLoops()` | DFS |
| `docs/tj3-engine/03-bluprint-engine2.md` | §3.9 `calcCriticalness` | Heurística |
| `docs/tj3-engine/05-blueprint-engine4.md` | §1-2 Allocation | Seleção |
| `docs/tj3-engine/05-blueprint-engine4.md` | §4 ShiftAssignments | Integração |
| `docs/tj3-engine/05-blueprint-engine4.md` | §5 Booking | Overtime/sloppy |
| `docs/tj3-engine/05-blueprint-engine4.md` | §6 TaskDependency | 4 tipos |
| `docs/tj3-engine/00-blueprint-heuristics.md` | §1-2 Time slots + greedy | Visão geral |

### 3.3 Casos de teste Ruby

- `docs/taskjuggler/test/TestSuite/Scheduler/Correct/*.tjp` — casos de scheduling.
- `docs/Learning/mwe001-009/` — os 9 MWEs progressivos.

### 3.4 Golden tests

Scripts Ruby `scheduler-mwe*.rb` para cada um dos 9 MWEs + casos de `TestSuite/Scheduler/Correct/`. Cada script:
1. Roda `tj3` no arquivo `.tjp`.
2. Extrai datas de início/end de cada task do HTML gerado (via parser HTML).
3. Serializa em JSON.

Teste TS replica o cenário e compara.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Estado mutável em `TaskScenario`/`ResourceScenario`

Ruby mantém muitos `@instance_variables` mutáveis (`@currentSlotIdx`, `@doneEffort`, `@startPropagated`, etc.). Em TS, replicar **fielmente** como campos privados mutáveis. Não tentar "imutabilidade" — o algoritmo depende de mutação.

### 4.2 `DataCache`

`TaskScenario` e `ResourceScenario` usam `DataCache.instance.cached(...args, block)` extensivamente. Precisamos do `DataCache` **antes** de começar o scheduler. A Fase 9 planejava implementá-lo, mas ele é pré-requisito aqui.

**Decisão:** implementar `DataCache` na subfase 11.0 desta fase, com testes. A Fase 9 o referencia.

### 4.3 Delegação via `scenarioData(scIdx)`

Já resolvido na Fase 4 (ADR 014). `Task.get('start', scIdx)` internamente faz `this.scenarioData(scIdx).start`.

Mas: **nas subclasses `*Scenario`, o acesso a atributos é via `this.a(name)`** (ScenarioData.a), que é `attributes.get(name).get()`. Isso é diferente do `Task.get` (que delega).

**Exemplo:**
- `TaskScenario.start` — acessa `this.a('start')` (via ScenarioData).
- `Task.get('start', scIdx)` — acessa `this.scenarioData(scIdx).a('start')` (delega).

Sempre usar `this.a(name)` dentro do `*Scenario`. Nunca `this.property.get(...)`.

### 4.4 `TaskScenario.durationType` — enum

Ruby:
```ruby
@durationType = if @effort > 0 then :effortTask
                elsif @length > 0 then :lengthTask
                elsif @duration > 0 then :durationTask
                else :startEndTask
                end
```

TS: `enum DurationType { Effort, Length, Duration, StartEnd }`.

### 4.5 `bookResources` — verificações em cascata

Ordem exata (do Ruby):
1. Se nenhum recurso disponível globalmente, retorna.
2. Se `projectionmode && now > currentSlotIdx`, retorna.
3. `limitsOk?(currentSlotIdx)`.
4. Se `shifts` e `shifts.assigned?(sbIdx)` e `!shifts.onShift?(sbIdx)`, retorna.
5. Para cada `mandatory`, se não está disponível, retorna.
6. Para cada `allocate`, tenta `lockedResource` primeiro; senão percorre `candidates(scenarioIdx)`.

Replicar **na ordem exata**.

### 4.6 `propagateDate` — shrink only

`propagateDate(date, atEnd)` só encolhe o intervalo: se `date > existing_start` (para `atEnd=false`) ou `date < existing_end` (para `atEnd=true`), ignora. Nunca expande.

Replicar fielmente. Isso é crítico — um erro aqui faz tarefas "esticarem" incorretamente.

### 4.7 `checkForLoops` — DFS com flags

Ruby usa `@deadEndFlags[4]` + `path` para evitar revisitar. O algoritmo percorre o grafo de dependências (4 tipos × forward/backward) e detecta ciclos.

**Complexidade:** alta. Recomendo isolar em subfase separada (11.5) com testes exaustivos.

### 4.8 `calcPathCriticalness` — memoização

Ruby: `@pathcriticalness` é cacheado. Se `null`, computa recursivamente.

Cuidado: para tarefas em container, o cálculo é diferente (percorre children).

### 4.9 `initScoreboard` de `ResourceScenario` — encoding complexo

Múltiplas camadas:
1. Slots não-working = 2.
2. Working time slots = null (nil em Ruby → null em TS).
3. Global leaves → bits 2–5.
4. Resource leaves → bits 2–5 (com prioridade).
5. Shift assignments → bits conforme `replace` mode.

**Não pular etapas.** Ordem importa.

### 4.10 `getEffectiveWork` — cache key

Ruby: `@dCache.cached(self, :ResourceScenarioGetEffectiveWork, startIdx, endIdx, task)`.

TS: mesmo padrão com `DataCache.instance.cached(this, 'ResourceScenarioGetEffectiveWork', startIdx, endIdx, task, () => ...)`.

### 4.11 `treeSum` — recursão com cache tag

Ruby: `caller[0][/'.*'/][1..-2]` extrai o nome do método chamador para usar como cache tag. Em TS, **passar explicitamente** o cache tag como primeiro argumento:

```ts
treeSum(cacheTag: string, startIdx: number, endIdx: number, ...args: unknown[], fn: () => number): number
```

Chamada: `this.treeSum('getLeave', startIdx, endIdx, type, () => {...})`.

### 4.12 `TaskDependency.resolve` — referência cruzada

`TaskDependency.taskId` é uma string; `task` é resolvido tardiamente via `project.task(id)`.

### 4.13 `Allocation.selectionMode` — inteiro

Ruby: 0=order, 1=minallocated, 2=minloaded, 3=maxloaded, 4=random. TS: `enum SelectionMode { Order=0, MinAllocated=1, MinLoaded=2, MaxLoaded=3, Random=4 }`.

### 4.14 `Booking.overtime` e `sloppy` — inteiros 0/1/2

TS: `type Overtime = 0 | 1 | 2`, `type Sloppy = 0 | 1 | 2`.

### 4.15 Queries: `query_<attrId>` como métodos

Ruby: o `Query.process` chama `property.send("query_#{attrId}", self)`. Em TS, precisamos de um mecanismo similar.

**Decisão:** `Query.process` faz lookup por `(property.scenarioData(scIdx) as any)[`query_${attrId}`]`. Se existir, chama. Não usar `Proxy`.

Detalhes na subfase 11.15.

### 4.16 Erros: `TjRuntimeError` para runtime

Alguns fluxos (ex: `bookResources` com recurso indisponível) geram warnings, não exceptions. Outros (`not_scheduled`, `task_start_undef`) geram errors, que em Ruby lançam `TjException` → `TjRuntimeError` em TS.

### 4.17 `TaskScenario.finishScheduling` — recursivo

Percorre children primeiro, depois propaga `assignedresources` para parents.

### 4.18 `postScheduleCheck` — retorna boolean

`postScheduleCheck` retorna `true` se OK, `false` se há erros acumulados. Usado recursivamente.

### 4.19 `markAsRunaway` — warning + `@isRunAway = true`

Quando o scheduler sai do timeframe, marca a task e emite warnings. `isRunAway()` é consultado em `postScheduleCheck`.

### 4.20 Simplificações aceitas (com ADR)

Alguns pontos podem ser simplificados no port inicial:

- `Log.enter`/`Log.exit` — implementar como no-op se `Log.level === 0`.
- `MessageHandler` — interface mínima.
- `@dCache.cached` — implementar com `DataCache` real.

Nenhuma simplificação na **lógica de scheduling**.

---

## 5. Subfases detalhadas

Esta fase é grande. As subfases são agrupadas em 5 blocos:

**Bloco A — Estruturas** (11.0–11.3): DataCache, TaskDependency, Allocation, Booking.
**Bloco B — TaskScenario setup** (11.4–11.6): prepareScheduling, Xref, checkForLoops, criticalness.
**Bloco C — TaskScenario scheduling** (11.7–11.10): schedule, book, propagate, bookBookings.
**Bloco D — ResourceScenario** (11.11–11.15): initScoreboard, book, queries.
**Bloco E — TaskScenario queries e finish** (11.16–11.17).
**Golden tests** (11.18).

---

### 7.0 — ADR 017 (heurística e slots)

#### Contexto

O scheduler do TaskJuggler **não é otimização matemática** (nem PERT/CPM clássico). É uma **heurística greedy** com:
- Time slots discretos (granularidade 5–60 min).
- Ordenação por `priority`, `pathCriticalness`, `seqno`.
- Alocação slot-a-slot com 5 modos de seleção de recurso.
- Propagação restritiva (shrink only).

Registrar formalmente antes de implementar.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/017-heuristica-scheduler.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/017-heuristica-scheduler.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar)

#### Requisitos

- [ ] **Contexto:** por que heurística; alternativas (ILP, CPM, constraint solving).
- [ ] **Decisão:** replicar o algoritmo do TaskJuggler **fielmente**, incluindo:
  - Loop slot-a-slot.
  - Heurística de priorização por `priority` + `pathCriticalness` + `seqno`.
  - 5 modos de seleção de recurso.
  - Propagação shrink-only.
- [ ] **Alternativas:** PERT/CPM (não suporta recursos), ILP (lento), constraint solving (complexo demais).
- [ ] **Consequências:**
  - **Positivas:** fidelidade ao TJ; comportamento testável.
  - **Negativas:** não é ótimo; projetos com heurísticas conflitantes podem ter resultados contraintuitivos.
  - **Mitigação:** golden tests contra `tj3` real.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/tj3-engine/00-blueprint-heuristics.md`.
- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb`.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADR 017 criado.
- Tabela atualizada.

---

### Bloco A — Estruturas

---

### 7.1 — `DataCache`

#### Contexto

O `DataCache` é um cache global (singleton) usado por `TaskScenario.getEffectiveWork`, `ResourceScenario.treeSum`, `Journal.currentEntriesR`. Sem ele, o scheduler roda em tempo O(n²) ou pior.

#### Objetivo

Implementar `DataCache` + `DataCacheEntry`.

#### Arquivos

- `packages/core/src/cache/data-cache.ts`
- `packages/core/tests/cache/data-cache_test.ts`

#### Requisitos

- [ ] `class DataCacheEntry`:
  - `readonly unhashedKey: unknown[]`
  - `hits: number`
  - `private value: T`
- [ ] `get value(): T` — incrementa hits, retorna valor.
- [ ] `class DataCache` (singleton via `static instance`):
  - `private entries: Map<number, DataCacheEntry>`
  - `private highWaterMark: number` (default 100000)
  - `private lowWaterMark: number` (default 90000)
  - `private stores: number`, `hits: number`, `misses: number`, `collisions: number`
- [ ] `resize(size = 100000): void`.
- [ ] `flush(): void` — limpa entries, mantém contadores.
- [ ] `cached<T>(...args: unknown[], fn: () => T): T`:
  - Compute `key` via hash dos args.
  - Se existe, verifica `unhashedKey !== args` → collision → recomputa.
  - Senão, computa, armazena, retorna.
- [ ] `private store<T>(value: T, key: number, unhashedKey: unknown[]): T`:
  - Se `entries.size > highWaterMark`, drop até `lowWaterMark` (decrementando `hits` e removendo quando `hits < 0`).
- [ ] `to_s(): string` — estatísticas.

**Hash de args:** Função própria para lidar com `null`, `number`, `string`, `object` (referência), `TjTime` (via `toSeconds`), `Task` (via `fullId`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/DataCache.rb` — arquivo completo.
- `docs/tj3-engine/11-blueprint-apoio.md` — §1.4.

#### Fora de escopo

- Uso por fases anteriores — retroativamente, se necessário.

#### Critério de aceite

```ts
const dc = DataCache.instance;
let calls = 0;
const fn = () => { calls++; return 42; };

assertEquals(dc.cached('a', 1, fn), 42);
assertEquals(dc.cached('a', 1, fn), 42);
assertEquals(calls, 1); // 2ª chamada usa cache
```

#### Testes

- `data-cache_test.ts`:
  - `describe("DataCache")`
    - `it("cached computa 1x")`.
    - `it("cached com args diferentes computa 2x")`.
    - `it("flush limpa")`.
    - `it("hit counter incrementa")`.
    - `it("resize ajusta marks")`.
    - `it("high water mark drop")`.
    - `it("collision detection")`.

---

### 7.2 — `TaskDependency`

#### Contexto

Representa uma dependência entre tasks. Armazena `taskId` (string, resolvida tarde), `onEnd`, `gapDuration` (calendário, segundos), `gapLength` (working time, slots).

#### Objetivo

Implementar `TaskDependency`.

#### Arquivos

- `packages/core/src/scheduling/task-dependency.ts`
- `packages/core/tests/scheduling/task-dependency_test.ts`

#### Requisitos

- [ ] `class TaskDependency`:
  - `readonly taskId: string`
  - `task: Task | null`
  - `onEnd: boolean`
  - `gapDuration: number` (segundos)
  - `gapLength: number` (slots)
- [ ] Constructor `(taskId: string, onEnd: boolean)`.
- [ ] `equals(other: TaskDependency): boolean`.
- [ ] `resolve(project: ProjectLike): Task | null` — busca `project.task(this.taskId)`, atribui a `this.task`, retorna.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskDependency.rb`.

#### Fora de escopo

- Uso — subfase 11.4.

#### Critério de aceite

```ts
const dep = new TaskDependency('t1', true);
dep.gapDuration = 3600;
dep.resolve(mockProject);
assertEquals(dep.task?.id, 't1');
```

#### Testes

- `task-dependency_test.ts`:
  - `describe("TaskDependency")`
    - `it("constructor")`.
    - `it("equals")`.
    - `it("resolve")`.
    - `it("resolve retorna null se não existe")`.

---

### 7.3 — `Allocation` + `SelectionMode`

#### Contexto

`Allocation` representa uma alocação de recursos a uma task. Pode ter múltiplos candidatos; a seleção entre eles depende do modo.

#### Objetivo

Implementar `Allocation` com os 5 modos de seleção.

#### Arquivos

- `packages/core/src/scheduling/allocation.ts`
- `packages/core/tests/scheduling/allocation_test.ts`

#### Requisitos

- [ ] `enum SelectionMode { Order=0, MinAllocated=1, MinLoaded=2, MaxLoaded=3, Random=4 }`.
- [ ] `class Allocation`:
  - `private candidates: Resource[]`
  - `private selectionMode: SelectionMode`
  - `atomic: boolean`
  - `persistent: boolean`
  - `mandatory: boolean`
  - `shifts: ShiftAssignments | null`
  - `lockedResource: Resource | null`
  - `private staticCandidates: Resource[] | null`
- [ ] Constructor `(candidates, selectionMode = MinAllocated, persistent = false, mandatory = false, atomic = false)`.
- [ ] `setSelectionMode(str: string): void` — `order|minallocated|minloaded|maxloaded|random`.
- [ ] `addCandidate(candidate): void`.
- [ ] `onShift?(sbIdx: number): boolean`:
  - Se `shifts`, retorna `shifts.onShift?(sbIdx)`.
  - Senão, `true`.
- [ ] `candidatesList(scenarioIdx?: number): Resource[]`:
  - Se `staticCandidates`, retorna cache.
  - Se `selectionMode === Order || scenarioIdx === undefined`, retorna `candidates`.
  - Se `Random`, ordena com `Math.random`.
  - Se `MinAllocated`, ordena por `criticalness` (ou `bookedEffort` se `persistent`).
  - Se `MinLoaded`, ordena por `bookedEffort`.
  - Se `MaxLoaded`, ordena por `bookedEffort` desc.
  - Cacheia se `MinAllocated && !persistent`.

**Nota:** `ResourceScenario.bookedEffort(scIdx)` é da subfase 11.13. Aqui usamos um getter genérico `resource.bookedEffort(scIdx)` que delega para o `ResourceScenario`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Allocation.rb` — arquivo completo.
- `docs/tj3-engine/05-blueprint-engine4.md` — §1.

#### Fora de escopo

- Uso por `TaskScenario` — subfase 11.7.

#### Critério de aceite

```ts
const r1 = { fullId: 'a', bookedEffort: () => 10, get: () => 0.5 };
const r2 = { fullId: 'b', bookedEffort: () => 5, get: () => 0.5 };
const al = new Allocation([r1, r2], SelectionMode.MinLoaded);
assertEquals(al.candidatesList(0)[0].fullId, 'b');
```

#### Testes

- `allocation_test.ts`:
  - `describe("Allocation")`
    - `it("constructor")`.
    - `it("setSelectionMode")`.
    - `it("setSelectionMode inválido lança")`.
    - `it("addCandidate")`.
    - `it("onShift? sem shifts = true")`.
    - `it("onShift? com shifts")`.
    - `it("candidatesList Order")`.
    - `it("candidatesList MinAllocated")`.
    - `it("candidatesList MinLoaded")`.
    - `it("candidatesList MaxLoaded")`.
    - `it("candidatesList Random")`.
    - `it("cache em MinAllocated não-persistent")`.

---

### 7.4 — `Booking`

#### Contexto

`Booking` representa trabalho manual registrado (tracking). Usado em `TaskScenario.bookBookings()`.

#### Objetivo

Implementar `Booking`.

#### Arquivos

- `packages/core/src/scheduling/booking.ts`
- `packages/core/tests/scheduling/booking_test.ts`

#### Requisitos

- [ ] `type Overtime = 0 | 1 | 2`.
- [ ] `type Sloppy = 0 | 1 | 2`.
- [ ] `class Booking`:
  - `readonly resource: Resource`
  - `readonly task: Task`
  - `readonly intervals: TimeInterval[]`
  - `sourceFileInfo: SourceFileInfo | null`
  - `overtime: Overtime` (default 0)
  - `sloppy: Sloppy` (default 0)
- [ ] Constructor `(resource, task, intervals)`.
- [ ] `to_s(): string` — `"${resource.fullId} ${iv.start} + Xh, ..."`.
- [ ] `to_tjp(taskMode: boolean): string` — serialização TJP.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Booking.rb`.
- `docs/tj3-engine/05-blueprint-engine4.md` — §5.

#### Fora de escopo

- Uso — subfase 11.10.

#### Critério de aceite

Análogo.

#### Testes

- `booking_test.ts`:
  - `describe("Booking")`
    - `it("constructor")`.
    - `it("to_s")`.
    - `it("to_tjp task mode")`.
    - `it("to_tjp resource mode")`.

---

### Bloco B — TaskScenario setup

---

### 7.5 — `TaskScenario.prepareScheduling` + `Xref` + `preScheduleCheck`

#### Contexto

Antes de agendar, cada `TaskScenario` precisa:
1. Resetar listas de dependências.
2. Determinar `durationType`.
3. Auto-promover milestones.
4. Coletar limites da task e dos pais.
5. Coletar allocations mandatórias.
6. Resolver dependências (`Xref`).
7. Pré-validações.

#### Objetivo

Implementar `prepareScheduling`, `Xref`, `preScheduleCheck`, `markAsMilestone`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender muito)
- `packages/core/tests/model/task-scenario-prepare_test.ts`

#### Requisitos

**Campos adicionados em `TaskScenario`:**

- [ ] `isRunAway: boolean`
- [ ] `hasDurationSpec: boolean`
- [ ] `scheduled: boolean`
- [ ] `doneDuration: number`
- [ ] `doneLength: number`
- [ ] `doneEffort: number`
- [ ] `currentSlotIdx: number | null`
- [ ] `nowIdx: number`
- [ ] `durationType: DurationType`
- [ ] `startpreds: Array<[Task, boolean]>`
- [ ] `startsuccs: Array<[Task, boolean]>`
- [ ] `endpreds: Array<[Task, boolean]>`
- [ ] `endsuccs: Array<[Task, boolean]>`
- [ ] `candidates: Resource[]`
- [ ] `mandatories: Allocation[]`
- [ ] `assignedresources: Resource[]`
- [ ] `competitors: Task[]`
- [ ] `contendedResources: Map<Task, Map<Resource, number>>`
- [ ] `allLimits: Limits[]`
- [ ] `startPropagated: boolean`
- [ ] `endPropagated: boolean`

**`enum DurationType`:**

- [ ] `Effort`, `Length`, `Duration`, `StartEnd`.

**`prepareScheduling()`:**

- [ ] Reset `startpreds`, `startsuccs`, `endpreds`, `endsuccs`.
- [ ] `isRunAway = false`.
- [ ] `currentSlotIdx = null`.
- [ ] `doneDuration = doneLength = 0`, `doneEffort = 0.0`.
- [ ] `nowIdx = project.dateToIdx(project.get('now'))`.
- [ ] Reset `startPropagated = endPropagated = false`.
- [ ] Determinar `durationType`:
  - `effort > 0` → `Effort`.
  - `length > 0` → `Length`.
  - `duration > 0` → `Duration`.
  - Senão → `StartEnd`.
- [ ] `hasDurationSpec = (durationType !== StartEnd) || milestone`.
- [ ] `markAsMilestone()`.
- [ ] Se `StartEnd && start && end && allocate empty`, `markAsScheduled()`.
- [ ] Coletar `allLimits` (task + parents). Reset limites da task.
- [ ] Reset `contendedResources`.
- [ ] Coletar `mandatories` (de `allocate`).
- [ ] Reset `lockedResource` de cada `allocation`.
- [ ] `bookBookings()` (subfase 11.10).
- [ ] Se `StartEnd`, setar `startIdx`, `endIdx`.

**`Xref()`:**

- [ ] Para cada `dependency` em `depends`:
  - `checkDependency(dependency, 'depends')` → `depTask`.
  - `startpreds.push([depTask, dependency.onEnd])`.
  - `depTask.scenarioData(scIdx)[dependency.onEnd ? 'endsuccs' : 'startsuccs'].push([this.property, false])`.
- [ ] Para cada `precedes`, análogo (mas com `endsuccs`, `startpreds`).

**`checkDependency(dependency, depType)`:**

- [ ] `depTask = dependency.resolve(project)`.
- [ ] Se null → `error('task_depend_unknown', ...)`, remove do list.
- [ ] Se `depTask === this.property` → `error('task_depend_self', ...)`.
- [ ] Se `depTask.isChildOf(this.property)` → `error('task_depend_child', ...)`.
- [ ] Se `this.property.isChildOf(depTask)` → `error('task_depend_parent', ...)`.
- [ ] Se duplicata → `error('task_depend_multi', ...)`.
- [ ] Retorna `depTask`.

**`preScheduleCheck()`:**

- [ ] Validar chargesets (contas leaf).
- [ ] Converter `responsible` IDs → Resource references.
- [ ] Se container && booking não vazio → erro.
- [ ] Se milestone && booking não vazio → erro.
- [ ] Se scheduled && (start null || end null) → erro.
- [ ] Se effort > 0 && allocate empty → erro.
- [ ] Contar `durationSpecs` (effort, length, duration, milestone).
- [ ] Validações específicas:
  - Container: `container_duration` se durationSpecs > 0.
  - Milestone: start == end se ambos setados.
  - Leaf: `task_underspecified`, `task_overspecified`.
- [ ] Se booking não vazio && !forward && !scheduled → `alap_booking`.
- [ ] Validar direções de dependências (onstart/onend).

**`markAsMilestone()`:**

- [ ] Container não pode ser milestone.
- [ ] Se container || hasDurationSpec || booking || allocate → retorna.
- [ ] Determinar se promove: `(hasStartSpec && forward && !hasEndSpec) || (!hasStartSpec && !forward && hasEndSpec) || (!hasStartSpec && !hasEndSpec)`.
- [ ] Se promove, setar `milestone = true`, ajustar `start`/`end`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — `prepareScheduling`, `Xref`, `preScheduleCheck`, `markAsMilestone`, `checkDependency`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.1, §3.2, §3.9.

#### Fora de escopo

- `schedule()` real — subfase 11.7.

#### Critério de aceite

```ts
const t = new Task(mp, 't1', 'Task 1', null);
t.setForScenario('effort', 8 * 3600, 0);
const ts = t.scenarioData(0);
ts.prepareScheduling();
assertEquals(ts.durationType, DurationType.Effort);
assert(ts.hasDurationSpec);
```

#### Testes

- `task-scenario-prepare_test.ts`:
  - `describe("TaskScenario.prepareScheduling")`
    - `it("reset listas de dependências")`.
    - `it("determina durationType Effort")`.
    - `it("determina durationType Length")`.
    - `it("determina durationType Duration")`.
    - `it("determina durationType StartEnd")`.
    - `it("coleta mandatories")`.
    - `it("coleta allLimits")`.
    - `it("auto-promove milestone")`.
  - `describe("TaskScenario.Xref")`
    - `it("resolve depends")`.
    - `it("resolve precedes")`.
    - `it("rejeita self-dependency")`.
    - `it("rejeita child dependency")`.
    - `it("rejeita parent dependency")`.
    - `it("rejeita duplicatas")`.
  - `describe("TaskScenario.preScheduleCheck")`
    - `it("rejeita container com duration")`.
    - `it("rejeita milestone com start != end")`.
    - `it("rejeita underspecified leaf")`.
    - `it("rejeita overspecified leaf")`.
    - `it("rejeita ALAP com booking")`.

---

### 7.6 — `TaskScenario.checkForLoops` + `calcCriticalness` + `calcPathCriticalness`

#### Contexto

Detecção de ciclos no grafo de dependências e cálculo de heurísticas de priorização.

#### Objetivo

Implementar `checkForLoops`, `resetLoopFlags`, `calcCriticalness`, `calcPathCriticalness`, `calcPathCriticalnessEndSuccs`, `countResourceAllocations`, `candidates`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-loops_test.ts`
- `packages/core/tests/model/task-scenario-criticalness_test.ts`

#### Requisitos

**`resetLoopFlags(): void`:**

- [ ] `deadEndFlags = [false, false, false, false]`.

**`checkForLoops(path: Array<[Task, boolean]>, atEnd: boolean, fromOutside: boolean, forward: boolean): void`:**

- [ ] Se `path` contém `[this.property, atEnd]`, emite warning + info por cada item + error.
- [ ] Se `deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)]`, retorna.
- [ ] Push `[this.property, atEnd]` em `path`.
- [ ] Se `!atEnd`:
  - Se `fromOutside`:
    - Se container: `children.each(c => c.scenarioData(scIdx).checkForLoops(path, false, true, forward))`.
    - Senão, se `(forward && forwardFlag) || milestone`: `checkForLoops(path, true, false, true)`.
  - Senão:
    - Se `startpreds` vazio: se parent, `parent.scenarioData(scIdx).checkForLoops(path, false, false, forward)`.
    - Senão, para cada `[task, targetEnd]`: `task.scenarioData(scIdx).checkForLoops(path, targetEnd, true, forward)`.
- [ ] Se `atEnd`, simétrico (usando `endsuccs`, `children`, etc.).
- [ ] Pop `path`.
- [ ] `deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)] = true`.

**`calcCriticalness(): void`:**

- [ ] `criticalness = 0.0`.
- [ ] `pathcriticalness = null`.
- [ ] Se `milestone`: `criticalness = priority / 500.0`.
- [ ] Se `effort <= 0 || candidates empty`: retorna.
- [ ] Média de `resource.get('criticalness', scIdx)` sobre `candidates`.
- [ ] `criticalness = effort * media`.

**`calcPathCriticalness(atEnd = false): number`:**

- [ ] Se `pathcriticalness !== null`, retorna `pathcriticalness - (atEnd ? 0 : criticalness)`.
- [ ] Se `atEnd`, `max = calcPathCriticalnessEndSuccs()`.
- [ ] Senão:
  - Se container: `max` sobre `children.calcPathCriticalness(false)`.
  - Senão: `max` sobre `startsuccs`, `calcPathCriticalnessEndSuccs`, + `criticalness`.
- [ ] `pathcriticalness = max`, retorna.

**`countResourceAllocations(): void`:**

- [ ] Se `candidates empty || effort <= 0`, retorna.
- [ ] `avgEffort = effort / candidates.length`.
- [ ] Para cada candidate: `resource.set('alloctdeffort', scIdx, resource.get('alloctdeffort', scIdx) + avgEffort)`.

**`candidates(): Resource[]`:**

- [ ] Coleta todos leaf resources de todos `allocation.candidates`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — seções correspondentes.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.8, §3.9.

#### Fora de escopo

- `schedule()` — subfase 11.7.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-loops_test.ts`:
  - `describe("TaskScenario.checkForLoops")`
    - `it("não detecta em grafo acíclico")`.
    - `it("detecta loop simples")`.
    - `it("detecta loop entre milestones")`.
    - `it("detecta loop via parent")`.
    - `it("múltiplas chamadas resetam flags")`.
- `task-scenario-criticalness_test.ts`:
  - `describe("TaskScenario.calcCriticalness")`
    - `it("milestone = priority / 500")`.
    - `it("leaf com effort = effort × media")`.
    - `it("leaf sem effort = 0")`.
  - `describe("TaskScenario.calcPathCriticalness")`
    - `it("leaf isolada")`.
    - `it("cadeia de 3")`.
    - `it("container")`.
    - `it("memoização")`.

---

### Bloco C — TaskScenario scheduling

---

### 7.7 — `TaskScenario.schedule` + `scheduleSlot`

#### Contexto

O loop principal de agendamento. `schedule()` avança `currentSlotIdx` até a task estar completa.

#### Objetivo

Implementar `schedule`, `scheduleSlot`, `markAsScheduled`, `markAsRunaway`, `readyForScheduling?`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-schedule_test.ts`

#### Requisitos

**`markAsScheduled(): void`:**

- [ ] Se `scheduled`, retorna.
- [ ] `scheduled = true`.
- [ ] (Opcional) log.

**`markAsRunaway(): void`:**

- [ ] `isRunAway = true`.
- [ ] `remainingEffort = project.convertToDailyLoad(project.get('scheduleGranularity') * (effort - doneEffort))`.
- [ ] Warning `runaway`.
- [ ] Para cada `competitor`, warning `runaway_competitor` com recursos contestados.

**`readyForScheduling?(): boolean`:**

- [ ] Se `scheduled`, retorna `true`.
- [ ] Se `isRunAway`, retorna `false`.
- [ ] Se `forward`: `start != null && (hasDurationSpec || end != null)`.
- [ ] Senão: `end != null && (hasDurationSpec || start != null)`.

**`schedule(): boolean`:**

- [ ] Se `scheduled`, retorna `true`.
- [ ] Determinar `currentSlotIdx` inicial:
  - `forward`: `project.dateToIdx(projectionmode && now > start && allocate não vazio ? now : start)`.
  - `!forward`: `project.dateToIdx(end) - 1`.
- [ ] `lowerLimit = project.dateToIdx(project.get('start'))`.
- [ ] `upperLimit = project.dateToIdx(project.get('end'))`.
- [ ] `delta = forward ? 1 : -1`.
- [ ] Loop: enquanto `scheduleSlot()`:
  - `currentSlotIdx += delta`.
  - Se `currentSlotIdx < lowerLimit || upperLimit < currentSlotIdx`:
    - `markAsRunaway()`, retorna `false`.
- [ ] Retorna `true`.

**`scheduleSlot(): boolean`:**

- [ ] Dispatch por `durationType`:
  - `Effort`: se `doneEffort < effort`, `bookResources()`. Se `doneEffort >= effort`, `propagateDate(idxToDate(currentSlotIdx + (forward ? 1 : 0)), forward, true)`, retorna `false`.
  - `Length`: `bookResources()`. Se `onShift(currentSlotIdx)`, `doneLength += 1`. Se `doneLength >= length`, `propagateDate(...)`, retorna `false`.
  - `Duration`: `bookResources()`. `doneDuration += 1`. Se `doneDuration >= duration`, `propagateDate(...)`, retorna `false`.
  - `StartEnd`: `bookResources()`. Se `(forward && currentSlotIdx >= endIdx) || (!forward && currentSlotIdx <= startIdx)`, `markAsScheduled()`, para cada parent `scheduleContainer()`, retorna `false`.
- [ ] Retorna `true` (continua).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — `schedule`, `scheduleSlot`, `markAsScheduled`, `markAsRunaway`, `readyForScheduling?`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.3, §3.4.

#### Fora de escopo

- `bookResources` real — subfase 11.8.
- `propagateDate` real — subfase 11.9.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-schedule_test.ts`:
  - `describe("TaskScenario.schedule")`
    - `it("task já scheduled retorna true")`.
    - `it("task ASAP sem recursos avança doneDuration")`.
    - `it("runaway quando sai do timeframe")`.
  - `describe("TaskScenario.scheduleSlot")`
    - `it("Effort incrementa doneEffort")`.
    - `it("Length incrementa doneLength só em working time")`.
    - `it("Duration incrementa sempre")`.
    - `it("StartEnd termina em endIdx")`.

---

### 7.8 — `TaskScenario.bookResources` + `bookResource`

#### Contexto

O coração da alocação. `bookResources()` tenta alocar recursos para o slot corrente.

#### Objetivo

Implementar `bookResources`, `bookResource`, `rollbackBookings`, `limitsOk?`, `incLimits`, `onShift?`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-book_test.ts`

#### Requisitos

**`bookResources(): void`:**

- [ ] Se `!project.anyResourceAvailable(currentSlotIdx) || (projectionmode && nowIdx > currentSlotIdx)`, retorna.
- [ ] Se `!limitsOk(currentSlotIdx, undefined)`, retorna.
- [ ] Se `shifts && shifts.assigned?(currentSlotIdx) && !shifts.onShift?(currentSlotIdx)`, retorna.
- [ ] `takenMandatories: Resource[] = []`.
- [ ] Para cada `allocation` em `mandatories`:
  - Se `!allocation.onShift(currentSlotIdx)`, retorna.
  - Para cada candidate: se todos os leaves estão disponíveis (limits, available, not in taken), `found = true`, push em taken, break.
  - Se `!found`, retorna.
- [ ] Para cada `allocation` em `allocate`:
  - Se `!allocation.onShift(currentSlotIdx)`, `continue`.
  - Se `lockedResource`, tenta `bookResource(locked)`:
    - Se sucesso, `continue`.
    - Se `allocation.atomic && locked.bookedTask(scIdx, sbIdx)` → `rollbackBookings()`, retorna.
    - Se `forward && currentSlotIdx < locked.getMaxSlot(scIdx)`, `continue`.
    - Se `!forward && currentSlotIdx > locked.getMinSlot(scIdx)`, `continue`.
    - Warning `broken_persistence`, `allocation.lockedResource = null`.
  - Para cada candidate em `allocation.candidatesList(scIdx)`:
    - Se `bookResource(candidate)`:
      - Se `allocation.persistent`, `allocation.lockedResource = candidate`.
      - `break`.

**`bookResource(resource): boolean`:**

- [ ] `booked = false`.
- [ ] Para cada `r` em `resource.allLeaves`:
  - Se `effort > 0 && r.get('efficiency', scIdx) > 0 && doneEffort >= effort`, `break`.
  - Se `!limitsOk(currentSlotIdx, r)`, `break`.
  - Se `r.book(scIdx, currentSlotIdx, property)`:
    - Se `effort > 0 && doneEffort === 0`, `propagateDate(idxToDate(currentSlotIdx + (forward ? 0 : 1)), !forward, true)`.
    - `doneEffort += r.get('efficiency', scIdx)`.
    - Se `!assignedresources.includes(r)`, push.
    - `booked = true`.
  - Senão, se `competitor = r.bookedTask(scIdx, currentSlotIdx)`:
    - Se `!competitors.includes(competitor)`, push.
    - `contendedResources.get(competitor).set(r, (count || 0) + 1)`.
- [ ] Retorna `booked`.

**`limitsOk?(sbIdx: number, resource?: Resource): boolean`:**

- [ ] Para cada `limit` em `allLimits`: se `!limit.ok(sbIdx, true, resource)`, retorna `false`.
- [ ] Retorna `true`.

**`incLimits(sbIdx: number, resource?: Resource): void`:**

- [ ] Para cada `limit`: `limit.inc(sbIdx, resource)`.

**`onShift?(sbIdx: number): boolean`:**

- [ ] Se `shifts && shifts.assigned?(sbIdx)`, retorna `shifts.onShift?(sbIdx)`.
- [ ] Senão, `project.isWorkingTime(sbIdx)`.

**`rollbackBookings(): void`:**

- [ ] `doneEffort = 0`.
- [ ] Para cada allocation: `allocation.lockedResource = null`; para cada candidate e leaf, `r.rollbackBookings(scIdx, property)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — `bookResources`, `bookResource`, `limitsOk?`, `incLimits`, `rollbackBookings`, `onShift?`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.5, §3.6.

#### Fora de escopo

- `propagateDate` real — subfase 11.9.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-book_test.ts`:
  - `describe("TaskScenario.bookResources")`
    - `it("aloca recurso disponível")`.
    - `it("não aloca se none available")`.
    - `it("não aloca em projection mode antes de now")`.
    - `it("respeita limits")`.
    - `it("respeita shifts")`.
    - `it("mandatory sem recurso aborta")`.
    - `it("persistent trava recurso")`.
    - `it("atomic faz rollback")`.
  - `describe("TaskScenario.bookResource")`
    - `it("sucesso incrementa doneEffort")`.
    - `it("múltiplas efficiency")`.
    - `it("limita por effort")`.
    - `it("marca competitors")`.

---

### 7.9 — `TaskScenario.propagateDate` + `scheduleContainer` + `earliestStart` + `latestEnd`

#### Contexto

Propagação de datas para dependentes e container tasks.

#### Objetivo

Implementar `propagateDate`, `propagateDateToDep`, `scheduleContainer`, `earliestStart`, `latestEnd`, `calcLength`, `canInheritDate?`, `hasDependencies`, `hasStrongDeps?`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-propagate_test.ts`

#### Requisitos

**`propagateDate(date: TjTime, atEnd: boolean, ignoreEffort = false): void`:**

- [ ] `thisEnd = atEnd ? 'end' : 'start'`, `otherEnd = atEnd ? 'start' : 'end'`.
- [ ] Setar flag `atEnd ? endPropagated = true : startPropagated = true`.
- [ ] Se `leaf`:
  - Se `date > existing_end` (para atEnd) ou `date < existing_start`, retorna (shrink only).
  - Setar `this[thisEnd] = date`.
  - Se `StartEnd`, atualizar `startIdx`/`endIdx`.
- [ ] Se `milestone`:
  - `markAsScheduled()`.
  - Se `this.a(otherEnd) === null`, `propagateDate(this.a(thisEnd), !atEnd)`.
- [ ] Senão se `!scheduled && start && end && !(length === 0 && duration === 0 && effort === 0 && allocate não vazio)`, `markAsScheduled()`.
- [ ] Se `atEnd`:
  - Se `ignoreEffort || effort === 0`, para cada `[task, onEnd]` em `endpreds`: `propagateDateToDep(task, onEnd)`.
  - Para cada `[task, onEnd]` em `endsuccs`: `propagateDateToDep(task, onEnd)`.
- [ ] Senão, simétrico com `startsuccs`, `startpreds`.
- [ ] Para cada child em `property.children`: se `child.scenarioData(scIdx).canInheritDate(atEnd)`, `child.scenarioData(scIdx).propagateDate(date, atEnd)`.
- [ ] Para cada parent: `parent.scenarioData(scIdx).scheduleContainer()`.

**`propagateDateToDep(task: Task, atEnd: boolean): void`:**

- [ ] Se `task.get('scheduled', scIdx) || task.container()`, retorna.
- [ ] Se `task.get(atEnd ? 'end' : 'start', scIdx) !== null`, retorna.
- [ ] Se `task.hasDurationSpec(scIdx) && !(atEnd !== task.get('forward', scIdx))`, retorna.
- [ ] `nDate = atEnd ? task.latestEnd() : task.earliestStart()`. Se null, retorna.
- [ ] `task.propagateDate(nDate, atEnd)`.

**`scheduleContainer(): void`:**

- [ ] Se `scheduled || !container`, retorna.
- [ ] `nStart = nEnd = null`.
- [ ] Para cada child:
  - Se `!child.scheduled || child.start === null || child.end === null`, retorna.
  - `nStart = min(nStart, child.start)`, `nEnd = max(nEnd, child.end)`.
- [ ] `startSet = endSet = false`.
- [ ] Se `start === null || start > nStart`, `start = nStart`, `startSet = true`.
- [ ] Se `end === null || end < nEnd`, `end = nEnd`, `endSet = true`.
- [ ] `markAsScheduled()`.
- [ ] Se `startSet`, `propagateDate(nStart, false)`.
- [ ] Se `endSet`, `propagateDate(nEnd, true)`.

**`earliestStart(): TjTime | null`:**

- [ ] `startDate = null`.
- [ ] Para cada `dependency`:
  - `potentialStart = dep.task.get(dep.onEnd ? 'end' : 'start', scIdx)`. Se null, retorna null.
  - Loop `gapLength`: enquanto `gapLength > 0 && potentialStart < project.get('end')`: se `isWorkingTime`, `gapLength -= 1`; `potentialStart += scheduleGranularity`.
  - Ajustar com `gapDuration`.
  - `startDate = max(startDate, potentialStart)`.
- [ ] Se parent tem start, `startDate = max(startDate, parent.start)`.
- [ ] Se `end && startDate > end`, error `impossible_start_dep`.
- [ ] Retorna `startDate`.

**`latestEnd(): TjTime | null`:**

- [ ] Simétrico (usando `precedes`, `gapLength`, `gapDuration`).
- [ ] Se `start && endDate < start`, error `impossible_end_dep`.

**`calcLength(d1: TjTime, d2: TjTime): number`:**

- [ ] Conta slots working time entre d1 e d2.

**`canInheritDate?(atEnd: boolean): boolean`:**

- [ ] Se `this[thisEnd] != null || hasStrongDeps(atEnd)`, retorna `false`.
- [ ] Se container, retorna `true`.
- [ ] `hasThatSpec = this.a(thatEnd) != null || hasStrongDeps(!atEnd)`.
- [ ] Se `hasThatSpec && !hasDurationSpec && allocate não vazio`, `true`.
- [ ] Se `forward ^ atEnd`: `true` se `hasDurationSpec || booking não vazio`; senão `hasThatSpec`.
- [ ] Senão: `this.a(thatEnd) != null && !hasDurationSpec && booking vazio`.

**`hasDependencies(atEnd): boolean`:**

- [ ] `this.a(thisEnd + 'succs') não vazio || this.a(thisEnd + 'preds') não vazio`.

**`hasStrongDeps?(atEnd): boolean`:**

- [ ] Se `atEnd`: `!endsuccs.empty`.
- [ ] Senão: `!startpreds.empty`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — `propagateDate`, `propagateDateToDep`, `scheduleContainer`, `earliestStart`, `latestEnd`, `calcLength`, `canInheritDate?`, `hasDependencies`, `hasStrongDeps?`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.7.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-propagate_test.ts`:
  - `describe("TaskScenario.propagateDate")`
    - `it("seta start em leaf")`.
    - `it("shrink only (não expande)")`.
    - `it("milestone propaga other end")`.
    - `it("propaga para endpreds/endsuccs")`.
    - `it("propaga para children")`.
    - `it("chama scheduleContainer em parents")`.
  - `describe("TaskScenario.scheduleContainer")`
    - `it("aborta se child não scheduled")`.
    - `it("min/max dos children")`.
  - `describe("TaskScenario.earliestStart")`
    - `it("maior end dos depends")`.
    - `it("com gapLength")`.
    - `it("com gapDuration")`.
  - `describe("TaskScenario.latestEnd")`
    - `it("menor start dos precedes")`.

---

### 7.10 — `TaskScenario.bookBookings` + `finishScheduling` + `postScheduleCheck` + completion/status/gauge

#### Contexto

Processamento de bookings manuais, finalização e pós-validação.

#### Objetivo

Implementar `bookBookings`, `rollbackBookings` (já feito em 11.8), `findBookings`, `finishScheduling`, `postScheduleCheck`, `calcCompletion`, `calcTaskCompletion`, `calcStatus`, `calcGauge`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-bookings_test.ts`
- `packages/core/tests/model/task-scenario-finish_test.ts`

#### Requisitos

**`bookBookings(): void`:**

- [ ] `firstSlotIdx = lastSlotIdx = null`.
- [ ] Se `effortdone || effortleft`:
  - Forçar `forward = true`.
  - Validar: start existe, effort existe, effortdone <= effort, não ambos effortdone/effortleft.
  - Calcular `doneEffort`.
  - `firstSlotIdx = project.dateToIdx(start)`, `lastSlotIdx = project.dateToIdx(now)`.
- [ ] `bookings = findBookings()`:
  - Para cada `booking`:
    - Validar resource leaf, forward ou scheduled.
    - Para cada `interval`:
      - Calcular `startIdx`, `endIdx`.
      - Para cada `idx`: se `booking.resource.bookBooking(scIdx, idx, booking)`, incrementa `doneEffort`, atualiza first/last.
    - Marcar em `assignedresources`.
- [ ] Se `start === null || (doneEffort > 0 && effort > 0)`, setar `start = idxToDate(firstSlotIdx)`.
- [ ] Se `lastSlotIdx !== null && !scheduled`:
  - Tentar satisfazer durationSpec com base em bookings.
- [ ] Se `doneEffort > 0`, `currentSlotIdx = project.dateToIdx(now)`.
- [ ] Warnings de overbooking.

**`findBookings(): Booking[]`:**

- [ ] Encontra cenário com `ownbookings` (sobe até achar).
- [ ] Retorna `property.get('booking', cenárioEncontrado.scenarioIdx)`.

**`finishScheduling(): void`:**

- [ ] Recursivo em children.
- [ ] Para cada parent: `parent.assignedresources += this.assignedresources`.
- [ ] `candidates = mandatories = allLimits = null` (liberar memória).

**`postScheduleCheck(): boolean`:**

- [ ] `errors = 0`.
- [ ] Para cada child: `errors += child.postScheduleCheck(scIdx) ? 0 : 1`.
- [ ] Se errors > 0, retorna `false`.
- [ ] Se `isRunAway`, error `sched_runaway`.
- [ ] Se `!scheduled`, error `not_scheduled`.
- [ ] Checagens de dependentes runaway.
- [ ] Start/end definidos e dentro do timeframe.
- [ ] `minstart`, `maxstart`, `minend`, `maxend` — warnings.
- [ ] Start <= end.
- [ ] Task dentro do parent.
- [ ] Predecessores antes, sucessores depois (com gaps).
- [ ] Milestone com start == end.
- [ ] Se `leaf && effort === 0 && !milestone && allocate não vazio && assignedresources vazio`, warning `allocate_no_assigned`.
- [ ] Warnings de priority inversion.
- [ ] Retorna `errors === 0`.

**`calcCompletion(): number | null`:**

- [ ] Se já cacheado, retorna.
- [ ] Se start/end null, `complete = 0.0`, retorna.
- [ ] `complete = calcTaskCompletion()`.

**`calcTaskCompletion(): number | null`:**

- [ ] Container: média de children.
- [ ] Leaf:
  - Se `end <= now`, retorna 100.
  - Se `now <= start`, retorna 0.
  - Se `effort > 0`, `done / total * 100`.
  - Senão, `(now - start) / (end - start) * 100`.

**`calcStatus(): void`:**

- [ ] Calcular `complete` se não.
- [ ] Determinar status: `not reached`/`not started`, `done`, `in progress`, `unknown`.

**`calcGauge(): string`:**

- [ ] Container: max de gauges dos children.
- [ ] Leaf: comparar `complete` com `calcTaskCompletion()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — seções correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-bookings_test.ts`:
  - `describe("TaskScenario.bookBookings")`
    - `it("processa bookings")`.
    - `it("effortdone")`.
    - `it("effortleft")`.
    - `it("herda bookings de parent cenário")`.
    - `it("overbooking warning")`.
- `task-scenario-finish_test.ts`:
  - `describe("TaskScenario.finishScheduling")`
    - `it("recursivo")`.
    - `it("propaga assignedresources para parents")`.
  - `describe("TaskScenario.postScheduleCheck")`
    - `it("runaway")`.
    - `it("not_scheduled")`.
    - `it("start_after_end")`.
    - `it("task_start_in_parent")`.
    - `it("allocate_no_assigned warning")`.
  - `describe("TaskScenario.calcCompletion")`
    - `it("100% se end <= now")`.
    - `it("0% se now <= start")`.
    - `it("effort based")`.
  - `describe("TaskScenario.calcStatus")`
    - `it("not started")`, `it("in progress")`, `it("done")`.

---

### Bloco D — ResourceScenario

---

### 7.11 — `ResourceScenario.initScoreboard`

#### Contexto

O scoreboard de um recurso é construído em camadas:
1. Slots não-working = 2.
2. Working hours → null.
3. Global leaves → bits 2–5.
4. Resource leaves → bits 2–5 (com prioridade).
5. Shifts → bits conforme `replace`.

#### Objetivo

Implementar `initScoreboard` e `prepareScheduling` de `ResourceScenario`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender muito)
- `packages/core/tests/model/resource-scenario-init_test.ts`

#### Requisitos

**Campos adicionados:**

- [ ] `scoreboard: Scoreboard<number | null> | null`.
- [ ] `firstBookedSlot: number | null`.
- [ ] `lastBookedSlot: number | null`.
- [ ] `firstBookedSlots: Map<Task, number>`.
- [ ] `lastBookedSlots: Map<Task, number>`.
- [ ] `minslot: number | null`.
- [ ] `maxslot: number | null`.

**`prepareScheduling(): void`:**

- [ ] `effort = 0`.
- [ ] Se `leaf`, `initScoreboard()`.

**`calcCriticalness(): void`:**

- [ ] Se `scoreboard === null`, `criticalness = 0`.
- [ ] Senão, `freeSlots = count(null)`, `criticalness = freeSlots === 0 ? 1.0 : alloctdeffort / freeSlots`.

**`initScoreboard(): void`:**

- [ ] Criar `Scoreboard<number | null>` com initVal `2`.
- [ ] Para cada i em `[0, project.scoreboardSize)`:
  - Se `onShift(i)`, `scoreboard.set(i, null)`.
- [ ] Global leaves: para cada `leave` em `project.get('leaves')`:
  - Para cada slot no intervalo: `val = scoreboard.get(i)`; `scoreboard.set(i, (val === null ? 0 : 2) | packLeaveType(leave.typeIdx))`.
- [ ] Resource leaves: para cada `leave` em `this.a('leaves')`:
  - Se `val !== null && val !== 0`:
    - `oldType = unpackLeaveType(val)`.
    - Se `leave.typeIdx > oldType`, `scoreboard.set(i, (val & 0x2) | packLeaveType(leave.typeIdx))`.
  - Senão: `scoreboard.set(i, packLeaveType(leave.typeIdx))`.
- [ ] Shifts (se `!shifts === null`):
  - Para cada i:
    - `v = shifts.getSbSlot(i)`.
    - Se `hasOverride(v)`: `scoreboard.set(i, (v & 0x3E) === 0 ? null : (v & 0x3D))`.
    - Senão se `(scoreboard.get(i) === null || unpackLeaveType(scoreboard.get(i)) < unpackLeaveType(v)) && unpackLeaveType(v) !== 0`: `scoreboard.set(i, v & 0x3E)`.
- [ ] Determinar `minslot` e `maxslot`.

**`available?(sbIdx: number): boolean`:**

- [ ] Se `!leaf`, retorna true.
- [ ] Se `initScoreboard` ainda não rodou, roda.
- [ ] `!scoreboard.get(sbIdx) !== null` (slot não-working) → `false`.
- [ ] Se `limits && !limits.ok(sbIdx, true, this.property)`, `false`.
- [ ] Retorna `true`.

**`getMinSlot()`, `getMaxSlot()`:**

- [ ] Lazy.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — `prepareScheduling`, `calcCriticalness`, `initScoreboard`, `available?`, `getMinSlot`, `getMaxSlot`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.10 (ResourceScenario).

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-init_test.ts`:
  - `describe("ResourceScenario.initScoreboard")`
    - `it("slots não-working = 2")`.
    - `it("working hours = null")`.
    - `it("global leaves")`.
    - `it("resource leaves com prioridade")`.
    - `it("shifts replace mode")`.
    - `it("shifts merge mode")`.
  - `describe("ResourceScenario.available?")`
    - `it("true em slot livre")`.
    - `it("false em off-hours")`.
    - `it("false em limite")`.

---

### 7.12 — `ResourceScenario.book` + `bookBooking` + `bookedEffort`

#### Contexto

Booking de recursos em slots.

#### Objetivo

Implementar `book`, `bookBooking`, `booked?`, `bookedTask`, `bookedEffort`, `treeSum`, `treeSumR`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender)
- `packages/core/tests/model/resource-scenario-book_test.ts`

#### Requisitos

**`book(sbIdx: number, task: Task, force = false): boolean`:**

- [ ] Se `!force && !available?(sbIdx)`, `false`.
- [ ] `duties += task` se não estiver.
- [ ] `scoreboard.set(sbIdx, task as unknown as number)`. **Nota:** `Scoreboard` é `Scoreboard<number | Task | null>`.
- [ ] `effort += efficiency`.
- [ ] `limits.inc(sbIdx)` se existir.
- [ ] `task.scenarioData(scIdx).incLimits(sbIdx, this.property)`.
- [ ] Atualizar `firstBookedSlot`/`lastBookedSlot` + maps.
- [ ] `true`.

**`bookBooking(sbIdx, booking): boolean`:**

- [ ] Se `scoreboard === null`, `initScoreboard()`.
- [ ] `val = scoreboard.get(sbIdx)`.
- [ ] Se `val !== null`:
  - Se `booked?(sbIdx)`, error `booking_conflict`.
  - Se `(val & 2) !== 0 && booking.overtime < 1`: warning/error `booking_no_duty` (sloppy check), retorna `false`.
  - Se `(val & 0x3C) !== 0 && booking.overtime < 2`: warning/error `booking_on_vacation`, retorna `false`.
- [ ] `book(sbIdx, booking.task, true)`.

**`booked?(sbIdx): boolean`** — `scoreboard.get(sbIdx) instanceof Task` (checagem de tipo).

**`bookedTask(sbIdx): Task | null`** — retorna task ou null.

**`bookedEffort(scIdx): number`:**

- [ ] Se leaf, `effort`.
- [ ] Senão, soma de `children.bookedEffort(scIdx)`.

**`treeSum(cacheTag: string, startIdx, endIdx, ...args, fn): number`:**

- [ ] `DataCache.instance.cached(this, cacheTag, startIdx, endIdx, ...args, () => ...)`.
- [ ] Se container: soma de children.
- [ ] Senão, `fn()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — seções correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-book_test.ts`:
  - `describe("ResourceScenario.book")`
    - `it("book em slot disponível")`.
    - `it("não book em off-hours sem force")`.
    - `it("book com force")`.
    - `it("incrementa limits")`.
  - `describe("ResourceScenario.bookBooking")`
    - `it("conflict error")`.
    - `it("overtime check")`.
    - `it("sloppy check")`.

---

### 7.13 — `ResourceScenario` — cálculos de slots e tree

#### Contexto

Métodos que contam slots em intervalos.

#### Objetivo

Implementar `getAllocatedSlots`, `getFreeSlots`, `getWorkSlots`, `getLeaveSlots`, `getTimeOffSlots`, `countSlots`, `fitIndicies`, `collectTimeOffIntervals`, `collectLeaveIntervals`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender)
- `packages/core/tests/model/resource-scenario-slots_test.ts`

#### Requisitos

**`getAllocatedSlots(startIdx, endIdx, task = null): number`:**

- [ ] Se `scoreboard === null`, `0`.
- [ ] `fitIndicies`.
- [ ] Conta slots com `Task` e (task null ou `task.all().includes(slot)`).

**`getFreeSlots(startIdx, endIdx): number`** — conta slots com `null`.

**`getWorkSlots(startIdx, endIdx): number`** — conta `null || Task`.

**`getLeaveSlots(startIdx, endIdx, type): number`** — conta `isLeaveType(val, type)`.

**`getTimeOffSlots(startIdx, endIdx): number`** — conta `(val & 2) === 0 && (val & 0x3C) !== 0`.

**`countSlots(startIdx, endIdx, predicate): number`** — helper.

**`fitIndicies(startIdx, endIdx, task?): [number, number]`** — clampa aos bookedSlots.

**`collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>`:**

- [ ] Se `!leaf`, `[]`.
- [ ] `scoreboard.collectIntervals(iv, minDuration, isTimeOff)`.

**`collectLeaveIntervals(iv, type): IntervalList<TimeInterval>`:**

- [ ] Idem, com predicado `isLeaveType(val, type)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — seções correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-slots_test.ts`:
  - `it("getAllocatedSlots")`.
  - `it("getFreeSlots")`.
  - `it("getWorkSlots")`.
  - `it("getLeaveSlots")`.
  - `it("getTimeOffSlots")`.
  - `it("fitIndicies clampa")`.
  - `it("collectTimeOffIntervals")`.

---

### 7.14 — `ResourceScenario` — getEffectiveWork + getLeave + getTimeOffDays

#### Contexto

Cálculos de trabalho efetivo, com cache.

#### Objetivo

Implementar `getEffectiveWork`, `getAllocatedTime`, `getEffectiveFreeTime`, `getEffectiveFreeWork`, `getTimeOffDays`, `getLeave`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender)
- `packages/core/tests/model/resource-scenario-effective_test.ts`

#### Requisitos

**`getEffectiveWork(startIdx, endIdx, task = null): number`:**

- [ ] Se `startIdx >= endIdx || (task && !duties.includes(task))`, `0.0`.
- [ ] Cache: `cached(this, 'ResourceScenarioGetEffectiveWork', startIdx, endIdx, task, () => ...)`.
- [ ] Se container: soma children.
- [ ] Senão: `convertToDailyLoad(getAllocatedSlots(...) * scheduleGranularity) * efficiency`.

**`getAllocatedTime(startIdx, endIdx, task = null): number`:**

- [ ] `treeSum('getAllocatedTime', ..., () => convertToDailyLoad(...))`.

**`getEffectiveFreeTime(startIdx, endIdx): number`:**

- [ ] `treeSum('getEffectiveFreeTime', ..., () => getFreeSlots(...) * scheduleGranularity)`.

**`getEffectiveFreeWork(startIdx, endIdx): number`:**

- [ ] `treeSum('getEffectiveFreeWork', ..., () => convertToDailyLoad(getFreeSlots(...) * scheduleGranularity) * efficiency)`.

**`getTimeOffDays(startIdx, endIdx): number`:**

- [ ] `treeSum('getTimeOffDays', ..., () => convertToDailyLoad(getTimeOffSlots(...) * scheduleGranularity) * efficiency)`.

**`getLeave(startIdx, endIdx, type): number`:**

- [ ] `treeSum('getLeave', ..., () => convertToDailyLoad(scheduleGranularity * getLeaveSlots(...)))`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — seções correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-effective_test.ts`:
  - `it("getEffectiveWork 0 se task não em duties")`.
  - `it("cache hit")`.
  - `it("container soma children")`.
  - `it("getLeave annual")`.

---

### 7.15 — `ResourceScenario` — queries + turnover + cost

#### Contexto

Métodos `query_<attrId>` são chamados por `Query.process`. Aqui implementamos todos os que `ResourceScenario` expõe.

#### Objetivo

Implementar ~20 queries + `turnover` + `cost` + `rate`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender)
- `packages/core/tests/model/resource-scenario-queries_test.ts`

#### Requisitos

**Queries (recebem `query: Query`):**

- [ ] `query_annualleave(query)`.
- [ ] `query_annualleavelist(query)`.
- [ ] `query_annualleavebalance(query)`.
- [ ] `query_cost(query)`.
- [ ] `query_duties(query)`.
- [ ] `query_effort(query)`.
- [ ] `query_effortdone(query)`.
- [ ] `query_effortleft(query)`.
- [ ] `query_freetime(query)`.
- [ ] `query_freework(query)`.
- [ ] `query_fte(query)`.
- [ ] `query_headcount(query)`.
- [ ] `query_rate(query)`.
- [ ] `query_revenue(query)`.
- [ ] `query_sickleave(query)`.
- [ ] `query_specialleave(query)`.
- [ ] `query_timeoffdays(query)`.
- [ ] `query_unpaidleave(query)`.

**`turnover(startIdx, endIdx, account, task = null, includeKids = false): number`:**

- [ ] Se container && includeKids: soma children.
- [ ] Senão, se task: `task.turnover(scIdx, startIdx, endIdx, account, this.property)`.
- [ ] Senão: `totalResourceCost = cost(startIdx, endIdx)`; itera chargeset shares.

**`cost(startIdx, endIdx, task = null): number`:**

- [ ] `getAllocatedTime(startIdx, endIdx, task) * rate`.

**`rate`:**

- [ ] Container: soma de children.
- [ ] Leaf: `this.a('rate')`.

**`treeSum` (já em 11.12).**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — seções `query_*`.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-queries_test.ts`:
  - Para cada query, 1–2 testes.
  - `turnover` com chargeset.
  - `cost` com rate.

---

### Bloco E — TaskScenario queries e finish

---

### 7.16 — `TaskScenario` — queries + turnover + getAllocatedTime + getEffectiveWork + collectTimeOffIntervals

#### Contexto

Simétrico a `ResourceScenario` mas para tasks. Também implementa `query_journal`, `query_alert`, etc. que dependem de `Journal` (Fase 16).

**Nota:** queries que dependem de `Journal`, `alert`, `journalMessages` são **stubs** nesta fase (`NotYetImplementedError`), completadas na Fase 16.

#### Objetivo

Implementar as queries de TaskScenario que **não dependem** de `Journal`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (estender)
- `packages/core/tests/model/task-scenario-queries_test.ts`

#### Requisitos

**Queries implementadas nesta fase:**

- [ ] `query_activetasks(query)`.
- [ ] `query_closedtasks(query)`.
- [ ] `query_competitorcount(query)`.
- [ ] `query_complete(query)`.
- [ ] `query_cost(query)`.
- [ ] `query_duration(query)`.
- [ ] `query_effort(query)`.
- [ ] `query_effortdone(query)`.
- [ ] `query_effortleft(query)`.
- [ ] `query_followers(query)`.
- [ ] `query_gauge(query)`.
- [ ] `query_headcount(query)`.
- [ ] `query_inputs(query)`.
- [ ] `query_maxend`, `query_maxstart`, `query_minend`, `query_minstart` (usando `queryDateLimit`).
- [ ] `query_opentasks(query)`.
- [ ] `query_precursors(query)`.
- [ ] `query_resources(query)`.
- [ ] `query_revenue(query)`.
- [ ] `query_scheduling(query)`.
- [ ] `query_status(query)`.
- [ ] `query_targets(query)`.

**Queries stub (Fase 16):**

- [ ] `query_journal(query)` — lança.
- [ ] `query_alert(query)` — lança.
- [ ] `query_alerttrend(query)` — lança.
- [ ] `query_alertmessages`, `query_alertsummaries` — lança.
- [ ] `query_journalmessages`, `query_journalsummaries` — lança.

**`turnover(startIdx, endIdx, account, resource = null, includeKids = true): number`:**

- [ ] Se container && includeKids: soma children.
- [ ] Determinar `chargeset = resource ? resource.chargeset : this.chargeset`.
- [ ] Se vazio, retorna 0.
- [ ] `resourceCost = resource ? resource.cost(...) : sum over assignedresources`.
- [ ] `otherCost` = sum de `charge.turnover(iv)`.
- [ ] Distribuir `(resourceCost + otherCost) * share`.

**`getAllocatedTime(startIdx, endIdx, resource = null): number`:**

- [ ] Cache: `TaskScenarioAllocatedTime`.
- [ ] Container: soma children.
- [ ] Leaf: soma over assignedresources.

**`getEffectiveWork(startIdx, endIdx, resource = null): number`:**

- [ ] Cache: `TaskScenarioEffectiveWork`.
- [ ] Similar.

**`collectTimeOffIntervals(iv, minDuration): IntervalList<TimeInterval>`:**

- [ ] Cache: `TaskScenarioCollectTimeOffIntervals`.
- [ ] Container: interseção de children.
- [ ] Leaf: se tem assignedresources, interseção das collectTimeOffIntervals deles; senão, global.

**`isDependencyOf(task, depth, list = []): boolean`:**

- [ ] Recursivo, sem limite se `depth === 0`.

**`isFeatureOf(task): boolean`:**

- [ ] `sources = property.all()`, `destinations = task.all()`.

**`hasResourceAllocated?(interval, resource): boolean`.**

**`assignedResources(interval?): Resource[]`.**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — seções `query_*`, `turnover`, `getAllocatedTime`, `getEffectiveWork`, `collectTimeOffIntervals`, `isDependencyOf`, `isFeatureOf`, `hasResourceAllocated?`, `assignedResources`.

#### Fora de escopo

- Journal queries — Fase 16.

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-queries_test.ts`:
  - Para cada query implementada, 1–2 testes.
  - `turnover` com chargeset.
  - `isDependencyOf` em grafo.
  - `assignedResources`.

---

### 7.17 — `TaskScenario` — `finishScheduling` (já feito em 11.10) + `postScheduleCheck` (já feito em 11.10)

Duplicação — referência apenas. `finishScheduling` e `postScheduleCheck` estão em 11.10.

---

### 7.18 — Golden tests (scheduler)

#### Contexto

Validar o scheduler completo contra `tj3` real.

#### Objetivo

Rodar cada um dos 9 MWEs e comparar cronogramas.

#### Arquivos

- `scripts/golden/scheduler-mwe001.rb`
- `scripts/golden/scheduler-mwe002.rb`
- ...
- `scripts/golden/scheduler-mwe009.rb`
- `scripts/golden/scheduler-testcases.rb` — para `TestSuite/Scheduler/Correct/*.tjp`
- `packages/core/tests/golden/scheduler.golden.json`
- `packages/core/tests/golden/scheduler_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Scripts Ruby:**

- [ ] Cada um:
  - Roda `tj3 <arquivo>.tjp` (via `system` ou `Open3`).
  - Lê o HTML gerado (`Plan.html`, `tasks.html`, etc.).
  - Extrai `id`, `start`, `end`, `effort` de cada task via parsing HTML simples (regex).
  - Serializa em JSON.
- [ ] `scheduler.golden.json` agrega todos os MWEs e testcases.

**Teste TS:**

- [ ] Lê o JSON.
- [ ] Para cada caso:
  - Constrói `MockProject` com tasks/resources/scenarios do MWE.
  - Chama `MockProject.schedule()` (implementado nesta fase? ver nota).
  - Compara `start`, `end`, `effort` de cada task.
- [ ] Cobertura: ≥ 60 casos (9 MWEs + ~50 testcases).

**Nota:** o `MockProject.schedule()` precisa implementar o pipeline mínimo:
1. `AttributeBase.setMode(1)`, `prepareScenario(scIdx)`.
2. `AttributeBase.setMode(2)`, `scheduleScenario(scIdx)`.
3. `finishScenario(scIdx)`.

O `Project` real (Fase 9) implementará isso. Nesta fase, o `MockProject` ganha uma versão mínima.

#### Referências

- `docs/Learning/mwe001-009/`.
- `docs/taskjuggler/test/TestSuite/Scheduler/Correct/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- Golden tests de parser — Fase 10.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 60 casos.
- Todos passam.

#### Testes

- `scheduler_golden_test.ts`:
  - Para cada MWE: `describe("Golden MWE001")` — itera casos.

---

## 6. Ordem de execução sugerida

```text
11.0  ADR 017
      ↓
11.1  DataCache
      ↓
11.2  TaskDependency
      ↓
11.3  Allocation
      ↓
11.4  Booking
      ↓
11.5  TaskScenario prepare + Xref + preScheduleCheck
      ↓
11.6  TaskScenario checkForLoops + criticalness
      ↓
11.11 ResourceScenario initScoreboard           ← pode rodar em paralelo com 11.7
11.12 ResourceScenario book + bookBooking
11.13 ResourceScenario slots
11.14 ResourceScenario effective work
      ↓
11.7  TaskScenario.schedule + scheduleSlot
      ↓
11.8  TaskScenario bookResources + bookResource
      ↓
11.9  TaskScenario propagateDate + scheduleContainer + earliestStart/latestEnd
      ↓
11.10 TaskScenario bookBookings + finishScheduling + postScheduleCheck
      ↓
11.15 ResourceScenario queries
      ↓
11.16 TaskScenario queries
      ↓
11.18 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 7 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `DataCache`, `TaskDependency`, `Allocation`, `Booking` implementados.
- [ ] `TaskScenario` completo (todos os métodos).
- [ ] `ResourceScenario` completo (todos os métodos, exceto queries que dependem de Journal).
- [ ] `MockProject.schedule()` funciona (versão mínima).
- [ ] **≥ 250 testes unitários**.
- [ ] **≥ 60 golden tests** (9 MWEs + TestSuite/Scheduler).
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 017 criado.
- [ ] Scripts `scheduler-mwe*.rb` funcionais.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Lógica de `bookResources` divergir do Ruby | **Altíssimo** | Golden tests em 60+ cenários |
| `propagateDate` expandir em vez de encolher | **Altíssimo** | Testes de shrink-only |
| `checkForLoops` não detectar ciclo | Alto | Testes com 4 tipos de loop |
| `calcPathCriticalness` mal calculado | Alto | Comparar com Ruby em 10 cenários |
| `initScoreboard` ordem errada | Alto | Golden test de bits |
| `bookBookings` com `effortdone/effortleft` | Alto | Testes dedicados |
| `DataCache` memory leak | Médio | Testes com high water mark |
| `MockProject.schedule()` diverge do `Project` | Médio | Fase 9 valida |
| `treeSum` com cache tag errado | Médio | Passar tag explícito |
| Perf degrada em projetos grandes | Médio | Benchmarks; otimizar se > 5s |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/Allocation.rb`
- `docs/taskjuggler/lib/taskjuggler/Booking.rb`
- `docs/taskjuggler/lib/taskjuggler/TaskDependency.rb`
- `docs/taskjuggler/lib/taskjuggler/DataCache.rb`

### Blueprints

- `docs/tj3-engine/00-blueprint-heuristics.md`
- `docs/tj3-engine/03-bluprint-engine2.md`
- `docs/tj3-engine/05-blueprint-engine4.md`

### Documentos do projeto

- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/016-scoreboard-encoding.md`
- `docs/syntaxmesh/decisoes/017-heuristica-scheduler.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/Learning/mwe001-009/`
- `docs/taskjuggler/test/TestSuite/Scheduler/Correct/`

### Fases dependentes

- **Fase 8 — Financeiro** (usa `turnover`, `cost`).
- **Fase 9 — Orquestrador** (`Project.schedule()` chama tudo).
- **Fase 11 — Queries** (usa `query_*` de TaskScenario/ResourceScenario).
- **Fase 14 — Reports** (usa `getEffectiveWork`, `getAllocatedTime`).

---

## 10. Notas para a IA

1. **Fidelidade absoluta.** Cada linha do Ruby tem uma razão. Não simplificar.
2. **Ordem importa em `bookResources`.** Não reordenar.
3. **`propagateDate` shrink-only.** Nunca expandir.
4. **`markAsMilestone` pode ser chamado múltiplas vezes.** Idempotente.
5. **`DataCache` é singleton.** Sempre `DataCache.instance`.
6. **`treeSum` precisa de cacheTag explícito.** Não confiar em `caller`.
7. **`checkForLoops` usa `deadEndFlags`.** Resetar antes de rodar.
8. **`calcPathCriticalness` memoiza em `pathcriticalness`.** Se null, computa.
9. **`MockProject.schedule()` é mínimo.** Não confundir com `Project.schedule()`.
10. **Queries que dependem de Journal lançam `NotYetImplementedError`.** Fase 16 completa.
11. **`initScoreboard` é chamado 1x por `ResourceScenario`.** Não chamar duas vezes.
12. **`onShift?` de `TaskScenario` usa `project.isWorkingTime`.** Não confundir com `ResourceScenario.onShift?`.
13. **Commit por subfase.** `feat(core): task-scenario-schedule`, etc.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **`bookedTask` retorna `Task | null`.** `booked?` é `bookedTask !== null`.
16. **Scoreboard de ResourceScenario aceita `number | Task | null`.** Não forçar tipos.
17. **`prevSlot` e `nextSlot` são acessores opcionais.** Se não usados, ignorar.
18. **Golden tests são a prova.** Se divergir, corrigir TS, não golden.

---

## 11. ADR 017 (referência rápida)

Criado como subfase 11.0. Conteúdo esperado:

- **Título:** Heurística do scheduler TaskJuggler
- **Contexto:** algoritmo não é ótimo; é greedy com slots.
- **Decisão:** replicar fielmente.
- **Alternativas:** CPM, ILP, constraint solving.
- **Consequências:** fidelidade + testabilidade; resultado não-ótimo.

---

**Fim da Fase 7.**