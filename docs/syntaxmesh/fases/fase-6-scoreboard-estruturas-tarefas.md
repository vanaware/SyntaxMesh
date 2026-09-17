# Fase 6 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-6-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-6-scoreboard-estruturas.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~110 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Scoreboard,Limits,ShiftAssignments,ShiftScenario,ResourceScenario}.rb`

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
- **ADR 017** — Scoreboard bit encoding (**criado nesta fase**).

### Convenções

- `AttributeBase.setMode(0)` em `beforeEach`.
- **Bit encoding é convenção** — não criar classe nova; usar helpers de `scoreboard-bits.ts`.
- **`Scoreboard<number | null>`** para scoreboards internos de `ShiftAssignments` (null = slot não computado).
- **`@@scoreboards`** é `Map` **estático**; sempre `sbClear()` em `beforeEach`.
- **`FinalizationRegistry`** é opcional; se causar problemas em testes, desabilitar.
- **`hashKey`** deve ser determinístico (sem `Math.random`, sem `Date.now`).
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar `Proxy` (ADR 015).
- ❌ Não especializar `Scoreboard` com `Int32Array` nesta fase (decisão ADR 017).
- ❌ Não reordenar `hashKey`.
- ❌ Não remover `FinalizationRegistry` sem documentar.
- ❌ Não compartilhar `scoreboard` entre instâncias com `hashKey` diferente.

---

## Progresso

```
[ ] 6.0  ADR 017 (Scoreboard encoding)       —  0/5
[ ] 6.1  scoreboard-bits                     —  0/12
[ ] 6.2  Limits + Limit                      —  0/26
[ ] 6.3  ShiftAssignments + ShiftAssignment  —  0/28
[ ] 6.4  ShiftScenario consolidado           —  0/6
[ ] 6.5  ResourceScenario.onShift?           —  0/6
[ ] 6.6  Golden tests                        —  0/9
[ ] 6.7  Verificação final                   —  0/8
─────────────────────────────────────────────
TOTAL: ~110
```

---

## Bloco A — Fundação

### 6.0 — ADR 017 (Scoreboard encoding conventions)

**Objetivo:** formalizar o encoding de bits do `Scoreboard` como decisão de arquitetura.

**⚠️ Nota:** o plano usa `ADR 016`, mas o ADR 016 foi alocado para `pre-carregamento-atributos-scenario` (Fase 5). Aqui usamos **ADR 017**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.0.1 | Criar `docs/syntaxmesh/decisoes/017-scoreboard-encoding.md` com frontmatter | idem | arquivo existe |
| 6.0.2 | Seção **Contexto**: `Scoreboard` é genérico; encoding é convenção espalhada em `Project.rb`, `ResourceScenario.rb`, `ShiftAssignments.rb` | idem | — |
| 6.0.3 | Seção **Encoding completo**: `nil`, bit 0 (assigned), bit 1 (off-work), bits 2–5 (leave types: 1=holiday, 2=annual, 3=special, 4=sick, 5=unpaid, 6=blocked), bits 6–7 (reserved), bit 8 (override global) | idem | — |
| 6.0.4 | Seção **Decisão**: centralizar constantes e helpers em `scoreboard-bits.ts`; não especializar `Scoreboard` com `Int32Array` nesta fase; revisitar se performance exigir | idem | — |
| 6.0.5 | Seções **Alternativas** (enum com flags, classe `ScoreboardValue`, sem helpers) + **Consequências** + atualizar linha `017` em `decisoes/README.md` | idem | 17 linhas |

---

## Bloco B — Scoreboard bits

### 6.1 — `scoreboard-bits.ts`

**⚠️ RUBY: `ShiftAssignments.rb` (comentários do encoding), `ResourceScenario.rb` (`initScoreboard`), `Project.rb` (`initScoreboards`)**
**🔎 CHEAT: §2 (classes/enums), §6 (números)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.1.1 | Criar `src/time/scoreboard-bits.ts` com `LEAVE_TYPES` (objeto constante com 7 tipos: `project: 0`, `annual: 1`, `special: 2`, `sick: 3`, `unpaid: 4`, `holiday: 5`, `unemployed: 6`) | idem | 1 teste (contagem 7) |
| 6.1.2 | Constantes `BIT_ASSIGNED = 1 << 0`, `BIT_OFF_WORK = 1 << 1`, `LEAVE_SHIFT = 2`, `LEAVE_MASK = 0x3C`, `BIT_OVERRIDE = 1 << 8` | idem | 5 testes |
| 6.1.3 | ⚠️ `packLeaveType(type: number): number` = `type << LEAVE_SHIFT` | idem | 3 testes |
| 6.1.4 | ⚠️ `unpackLeaveType(val: number): number` = `(val & LEAVE_MASK) >> LEAVE_SHIFT` | idem | 3 testes |
| 6.1.5 | ⚠️ `isAssigned(val: number \| null): boolean` = bit 0 set | idem | 3 testes (null, 0, 1) |
| 6.1.6 | ⚠️ `isWorkingTime(val: number \| null): boolean` = bit 1 **não** set | idem | 3 testes |
| 6.1.7 | ⚠️ `isTimeOff(val: number \| null): boolean` = bit 1 **set** | idem | 3 testes |
| 6.1.8 | ⚠️ `isOnLeave(val: number \| null): boolean` = bits 2–5 **não zero** | idem | 4 testes |
| 6.1.9 | ⚠️ `isLeaveType(val: number \| null, type: number): boolean` = `unpackLeaveType(val) === type` | idem | 4 testes |
| 6.1.10 | ⚠️ `hasOverride(val: number \| null): boolean` = bit 8 set | idem | 3 testes |
| 6.1.11 | ⚠️ `packWorkTime(isWorking: boolean, leaveType?: number, override?: boolean): number` combina bits | idem | 5 testes (todas as combinações) |
| 6.1.12 | Re-exportar em `src/time/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — Limits

### 6.2 — `Limits` + `Limit`

**⚠️ RUBY: `Limits.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Struct` → `interface`, §12 Categoria B (`Integer#round`)**

**Pré-requisito:** Fase 2 (`Scoreboard`, `ScoreboardInterval`, `TjTime`), Fase 4 (`ProjectLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.2.1 | Criar `src/scheduling/limits.ts` com classe `Limit` vazia | idem | `deno check` |
| 6.2.2 | Campos de `Limit`: `readonly name`, `readonly interval: ScoreboardInterval`, `readonly period: number`, `readonly value: number`, `readonly upper: boolean`, `resource: Resource \| null`, `private scoreboard: Scoreboard<number>`, `private dirty: boolean` | idem | 1 teste |
| 6.2.3 | ⚠️ Constructor `(name, interval, period, value, upper, resource)`: cria `scoreboard = new Scoreboard(interval.startDate, interval.endDate, period, 0)` | idem | 3 testes |
| 6.2.4 | ⚠️ `copy(): Limit` — deep copy: cria novo `Limit` com os mesmos parâmetros e copia o `scoreboard` (novo `Scoreboard`, não compartilhado) | idem | 3 testes |
| 6.2.5 | ⚠️ `reset(index?: number): void` — se `index === undefined`, recria `scoreboard` com 0; senão, se `interval.contains(index)`, reseta slot. `dirty = false` | idem | 4 testes |
| 6.2.6 | ⚠️ `inc(index: number, resource: Resource \| null): void` — se `interval.contains(index)` e (`this.resource === null \|\| this.resource === resource`), `dirty = true`, `scoreboard.set(idxToSbIdx(index), get + 1)` | idem | 4 testes |
| 6.2.7 | ⚠️ `dec(index: number, resource: Resource \| null): void` — análogo a `inc` com `-1` | idem | 3 testes |
| 6.2.8 | ⚠️ `ok?(index: number \| null, upper: boolean, resource: Resource \| null): boolean` — se `upper !== this.upper` ou `resource !== this.resource` (quando `this.resource !== null`), retorna `true` | idem | 3 testes |
| 6.2.9 | `ok?` com `index === null`: verifica **todos** os slots — se `upper` e algum `>= value` → `false`; se `!upper` e algum `< value` → `false` | idem | 3 testes |
| 6.2.10 | `ok?` com `index` fora do intervalo → retorna `true` | idem | 1 teste |
| 6.2.11 | `ok?` com `index` dentro do intervalo: `upper ? sbVal < value : sbVal >= value` | idem | 3 testes |
| 6.2.12 | ⚠️ `private idxToSbIdx(index: number): number` = `(index - interval.start) * interval.slotDuration / period` | idem | 3 testes |
| 6.2.13 | Criar classe `Limits` vazia com campos `readonly limits: Limit[]` e `private project: ProjectLike \| null` | idem | `deno check` |
| 6.2.14 | ⚠️ Constructor `(limits?: Limits)` — copy ou vazio | idem | 2 testes |
| 6.2.15 | ⚠️ `setProject(project: ProjectLike): void` — rejeita se `limits` não vazio (`TjArgumentError`) | idem | 2 testes |
| 6.2.16 | ⚠️ `reset(): void` — chama `limit.reset()` para todos os limites | idem | 2 testes |
| 6.2.17 | ⚠️ `setLimit(name, value, interval?, resource?)` — se `interval === undefined`, cria `ScoreboardInterval` com `project.get('start')`, `project.get('end')`, `scheduleGranularity` | idem | 3 testes |
| 6.2.18 | `setLimit` — ajusta `iv.start` e `iv.end` com `midnight()` para limites daily; `beginOfWeek(weekStartsMonday)` para weekly; `beginOfMonth` para monthly | idem | 4 testes |
| 6.2.19 | `setLimit` — define `period` (`86400`, `604800`, `2592000`, ou `iv.duration`) e `upper` (`true` para max, `false` para min) conforme o `name` | idem | 8 testes (1 por tipo) |
| 6.2.20 | `setLimit` — remove limite existente com mesma `(name, startDate, endDate, resource)` antes de adicionar | idem | 2 testes |
| 6.2.21 | ⚠️ `inc(index, resource?)`, `dec(index, resource?)` — delegam para cada `Limit` | idem | 3 testes |
| 6.2.22 | ⚠️ `ok?(index?, upper?, resource?)` — retorna `true` se **todos** os limites retornam `true` | idem | 4 testes |
| 6.2.23 | Teste agregado: `Limits` com `dailymax` 8h + `inc` 30 vezes → `ok?` retorna `false` | idem | 1 teste |
| 6.2.24 | Teste: `setLimit` com `resource` filtra `inc`/`dec` por resource | idem | 2 testes |
| 6.2.25 | Teste: copy constructor de `Limits` cria limites novos (não compartilha `scoreboard`) | idem | 2 testes |
| 6.2.26 | Re-exportar `Limits`, `Limit` em `src/scheduling/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco D — ShiftAssignments

### 6.3 — `ShiftAssignments` + `ShiftAssignment`

**⚠️ RUBY: `ShiftAssignments.rb` (arquivo inteiro — ~300 linhas)**
**🔎 CHEAT: §3 `Monitor` → N/A, §8 `define_finalizer` → `FinalizationRegistry`, §12 Categoria B (bug de hash)**

**Pré-requisitos:** Fase 2 (`TimeInterval`, `Scoreboard`, `scoreboard-bits`), Fase 4 (`PropertyTreeNode`), Fase 5 (`Shift`, `ShiftScenario`).

#### 6.3.1 — `projectObjectId` helper

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.3.1.1 | Criar `src/utils/project-object-id.ts` com `WeakMap<object, number>` + contador global | idem | `deno check` |
| 6.3.1.2 | ⚠️ `projectObjectId(project: object): number` — retorna ID único estável | idem | 3 testes |
| 6.3.1.3 | Teste: projetos diferentes têm IDs diferentes; mesmo projeto retorna mesmo ID | idem | 2 testes |
| 6.3.1.4 | Teste: `WeakMap` permite GC (não trava memória) | idem | 1 teste |
| 6.3.1.5 | Re-exportar em `src/utils/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

#### 6.3.2 — `ShiftAssignment`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.3.2.1 | Criar `src/scheduling/shift-assignments.ts` com classe `ShiftAssignment` vazia | idem | `deno check` |
| 6.3.2.2 | Campos: `readonly shiftScenario: ShiftScenario`, `readonly interval: TimeInterval` | idem | 1 teste |
| 6.3.2.3 | Constructor `(shiftScenario, interval)` | idem | 1 teste |
| 6.3.2.4 | ⚠️ `hashKey(): string` = `${projectObjectId(project)}\|${scenarioIdx}\|${start.toSeconds()}\|${end.toSeconds()}` | idem | 3 testes |
| 6.3.2.5 | ⚠️ `copy(): ShiftAssignment` — cria nova instância com mesmos parâmetros | idem | 2 testes |
| 6.3.2.6 | ⚠️ `overlaps(iv: TimeInterval): boolean` — `interval.start < iv.end && interval.end > iv.start` | idem | 3 testes |
| 6.3.2.7 | ⚠️ `assigned?(date: TjTime): boolean` — `start <= date < end` | idem | 3 testes |
| 6.3.2.8 | ⚠️ `replace?(date: TjTime): boolean` — `assigned?(date) && shiftScenario.replace?()` | idem | 3 testes |
| 6.3.2.9 | ⚠️ `onShift?(date: TjTime): boolean` — delega a `shiftScenario.onShift?(date)` | idem | 2 testes |
| 6.3.2.10 | ⚠️ `onLeave?(date: TjTime): boolean` — delega a `shiftScenario.onLeave?(date)` | idem | 2 testes |
| 6.3.2.11 | ⚠️ `to_s(): string` — formato `<scenarioId> <start> - <end>` | idem | 1 teste |

#### 6.3.3 — `ShiftAssignments` core

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.3.3.1 | Criar classe `ShiftAssignments` com campos `project`, `assignments: ShiftAssignment[]`, `private scoreboard: Scoreboard<number \| null> \| null`, `private hashKeyCache: string \| null` | idem | `deno check` |
| 6.3.3.2 | ⚠️ Constructor `(sa?: ShiftAssignments)` — se `sa` presente, deep copy (`assignments.map(a => a.copy())`), `project = sa.project`, cria/compartilha scoreboard; senão, vazio | idem | 3 testes |
| 6.3.3.3 | Constructor: registra instância em `FinalizationRegistry` para limpar cache ao GC | idem | 1 teste (verifica registro) |
| 6.3.3.4 | ⚠️ `addAssignment(sa): boolean` — se `overlaps?(sa.interval)`, retorna `false`; senão `assignments.push(sa)`, `scoreboard = newScoreboard()`, retorna `true` | idem | 4 testes |
| 6.3.3.5 | ⚠️ `hashKey(): string` — cache; senão, ordena `assignments` por `interval.start`, concatena `hashKey()` de cada | idem | 3 testes |
| 6.3.3.6 | Teste: `hashKey` é determinístico para 2 instâncias com conteúdo idêntico | idem | 1 teste |
| 6.3.3.7 | ⚠️ Static `scoreboards: Map<string, [Set<number>, Scoreboard<number \| null>]>` — hashKey → record | idem | `deno check` |
| 6.3.3.8 | ⚠️ `private newScoreboard(): Scoreboard<number \| null>` — computa hashKey; se existe no cache, adiciona `objectId` ao `Set` e retorna o scoreboard compartilhado; senão, cria `new Scoreboard(start, end, granularity, null)` e registra no cache | idem | 4 testes |
| 6.3.3.9 | Teste: duas instâncias com `hashKey` igual compartilham **o mesmo** `Scoreboard` | idem | 1 teste |
| 6.3.3.10 | Teste: instâncias com `hashKey` diferente têm `Scoreboard` diferente | idem | 1 teste |
| 6.3.3.11 | ⚠️ Static `sbClear(): void` — limpa o cache (usado em testes) | idem | 1 teste |
| 6.3.3.12 | ⚠️ Static `deleteScoreboard(objId: number): void` — remove `objectId` do `Set`; se `Set` vazio, deleta a entrada do Map | idem | 3 testes |

#### 6.3.4 — `ShiftAssignments.getSbSlot` (encoding lazy)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.3.4.1 | ⚠️ `getSbSlot(idx: number): number` — se `scoreboard[idx] !== null`, retorna o valor (cache hit) | idem | 2 testes |
| 6.3.4.2 | `getSbSlot` — se `null`, computa: para cada `sa`, se `!sa.assigned?(date)`, continua | idem | 2 testes |
| 6.3.4.3 | `getSbSlot` — computa encoding: `val = BIT_ASSIGNED`; se `!sa.onShift?(date)`, `val \|= BIT_OFF_WORK`; se `sa.onLeave?(date)`, `val \|= packLeaveType(LEAVE_TYPE_HOLIDAY)`; se `sa.replace?(date)`, `val \|= BIT_OVERRIDE` | idem | 4 testes |
| 6.3.4.4 | `getSbSlot` — se nenhum `sa` cobre `idx`, `scoreboard[idx] = 0` | idem | 1 teste |
| 6.3.4.5 | `getSbSlot` — armazena o valor computado em `scoreboard[idx]` (lazy memoization) | idem | 1 teste |
| 6.3.4.6 | ⚠️ `assigned?(idx): boolean` = `isAssigned(getSbSlot(idx))` | idem | 2 testes |
| 6.3.4.7 | ⚠️ `onShift?(idx): boolean` = `isWorkingTime(getSbSlot(idx))` | idem | 3 testes |
| 6.3.4.8 | ⚠️ `timeOff?(idx): boolean` = `isTimeOff(getSbSlot(idx))` | idem | 3 testes |
| 6.3.4.9 | ⚠️ `onLeave?(idx): boolean` = `isOnLeave(getSbSlot(idx))` | idem | 3 testes |
| 6.3.4.10 | ⚠️ `collectTimeOffIntervals(iv: TimeInterval, minDuration: number): IntervalList<TimeInterval>` — usa `scoreboard.collectIntervals` com predicado `isTimeOff` | idem | 3 testes |
| 6.3.4.11 | Teste agregado: 3 assignments com working hours diferentes → verifica encoding correto em ~10 índices | idem | 1 teste |
| 6.3.4.12 | Re-exportar `ShiftAssignments`, `ShiftAssignment` em `src/scheduling/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco E — Integração

### 6.4 — `ShiftScenario` consolidado

**⚠️ RUBY: `ShiftScenario.rb` (arquivo inteiro — ~40 linhas)**

**Pré-requisito:** Fase 5 (esqueleto de `ShiftScenario`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.4.1 | ⚠️ `onShift?(date: TjTime): boolean` — `const wh = this.a('workinghours') as WorkingHours \| null`; se null, retorna `true`; senão, `wh.onShift(date)` | `src/model/shift-scenario.ts` | 4 testes |
| 6.4.2 | Teste: `onShift?` com `workinghours` Monday 9-17: segunda 10h → `true`, segunda 20h → `false`, domingo 10h → `false` | idem | 3 testes |
| 6.4.3 | ⚠️ `replace?(): boolean` — `this.a('replace') as boolean` | idem | 2 testes |
| 6.4.4 | ⚠️ `onLeave?(date: TjTime): boolean` — itera `this.a('leaves') as LeaveList`; se algum `leave.interval.contains(date)`, retorna `true`; senão `false` | idem | 4 testes |
| 6.4.5 | Teste: `onLeave?` sem `leaves` retorna `false` | idem | 1 teste |
| 6.4.6 | Re-exportar em `model/mod.ts` | idem | `deno check` |

---

### 6.5 — `ResourceScenario.onShift?`

**⚠️ RUBY: `ResourceScenario.rb` — método `onShift?` (seção isolada)**

**Pré-requisito:** Fase 5 (esqueleto de `ResourceScenario`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.5.1 | ⚠️ `onShift?(sbIdx: number): boolean` em `ResourceScenario` — `const shifts = this.a('shifts') as ShiftAssignments \| null` | `src/model/resource-scenario.ts` | `deno check` |
| 6.5.2 | Se `shifts && shifts.assigned?(sbIdx)`, retorna `shifts.onShift?(sbIdx)` | idem | 3 testes |
| 6.5.3 | Senão, retorna `(this.a('workinghours') as WorkingHours).onShift(sbIdx)` | idem | 3 testes |
| 6.5.4 | Teste: recurso com `workinghours` 9-17 seg-sex: segunda 10h → `true`, sábado 10h → `false` | idem | 2 testes |
| 6.5.5 | Teste: recurso com `shifts` atribuído: prioriza `shifts` sobre `workinghours` | idem | 1 teste |
| 6.5.6 | Teste: herança do `workinghours` do project (via `inheritAttributes`) — recurso sem `workinghours` próprio usa o do project | idem | 1 teste |

---

## Bloco F — Golden tests

### 6.6 — Golden tests (Limits, ShiftAssignments)

**⚠️ RUBY: `Limits.rb`, `ShiftAssignments.rb`**
**Usa:** `tj3` real via `docs/taskjuggler/`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 6.6.1 | Atualizar `scripts/golden/README.md` com seção de `limits` e `shift-assignments` | idem | existe |
| 6.6.2 | Criar `scripts/golden/limits.rb` — cria `Project.new("prj", "Test", "1.0")` com `start`, `end`, `scheduleGranularity=3600` | idem | roda |
| 6.6.3 | `limits.rb` — para cada tipo (`dailymax`, `weeklymax`, `monthlymax`, `maximum`), cria `Limits`, `setLimit`, incrementa N vezes, verifica `ok?` | idem | JSON válido |
| 6.6.4 | Serializar `{ name, period, upper, checks: [{ index, upper, resource, expected }] }` | idem | ≥ 25 casos |
| 6.6.5 | Criar `scripts/golden/shift-assignments.rb` — `Project` + `Shift` com `workinghours` Monday 9-17 + `ShiftAssignments` com 2 assignments | idem | roda |
| 6.6.6 | `shift-assignments.rb` — serializa `getSbSlot`, `assigned?`, `onShift?`, `timeOff?`, `onLeave?` em ~10 índices; testa `hashKey` para 2 instâncias idênticas | idem | ≥ 20 casos |
| 6.6.7 | Task `golden:generate` atualizada em `deno.jsonc` para incluir os 2 scripts | `deno.jsonc` | roda |
| 6.6.8 | Criar `tests/golden/limits_golden_test.ts` e `tests/golden/shift-assignments_golden_test.ts` que iteram os casos | idem | verde |
| 6.6.9 | Commitar JSONs em `packages/core/tests/golden/limits.golden.json` e `shift-assignments.golden.json` | idem | versionado |

---

## Bloco G — Verificação final

### 6.7 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 6.7.1 | `deno task check-all` verde | exit 0 |
| 6.7.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 6.7.3 | `grep -r "NotYetImplementedError" packages/core/src/scheduling/` = 0 (não deixar stubs nesta fase) | grep |
| 6.7.4 | ADR 017 criada e commitada | git log |
| 6.7.5 | `scoreboard-bits`, `Limits`, `Limit`, `ShiftAssignments`, `ShiftAssignment`, `projectObjectId` exportados em `packages/core/mod.ts` | `deno check` |
| 6.7.6 | `tests/integration/smoke_after_phase_6_test.ts` — cria `ShiftAssignments`, adiciona 1 assignment, verifica `assigned?(0)`, verifica `sbClear()`; verifica Fase 5 (`Task` cria `TaskScenario`) | 1 teste |
| 6.7.7 | Auditoria: cada subfase do plano `fase-6-scoreboard-estruturas.md` tem tarefas correspondentes | grep |
| 6.7.8 | Corrigir numeração em `fase-6-scoreboard-estruturas.md` (`### 10.X` → `### 6.X`, `ADR 016` → `ADR 017`) | grep |

---

## Notas para a IA

1. **Ordem:** 6.0 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7.
   - Exceção: 6.1 (scoreboard-bits) pode rodar antes de 6.0.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura do arquivo inteiro.
3. **`AttributeBase.setMode(0)` em `beforeEach`.**
4. **`sbClear()` em `beforeEach`** — `@@scoreboards` é estático e vaza entre testes.
5. **`FinalizationRegistry`** — se causar flakiness em Deno, desabilitar e confiar em `sbClear`.
6. **`hashKey` deve ser determinístico.** Sem `Math.random`, sem `Date.now`. Apenas dados da instância.
7. **`Limits.setProject` lança se `limits` não vazio.**
8. **`Limit.resource` é mutável** (setado por `setLimit` com `limitResources`). Não torne `readonly`.
9. **`Scoreboard<number \| null>`** — `null` = slot não computado. Fase 2 definiu `T` genérico; garantir que aceita `null`.
10. **`projectObjectId` usa `WeakMap`.** Permite GC de projetos.
11. **`ShiftScenario.onShift?` sem `workinghours` retorna `true`.** Sem restrição = sempre disponível.
12. **Sem `any`.** Use `unknown` + narrowing.
13. **Commit por subfase.** `feat(core): scoreboard-bits`, `feat(core): limits`, `feat(core): shift-assignments`.
14. **Golden tests contra Ruby são obrigatórios.**
15. **Não tocar em Fase 7.** `ResourceScenario.book` continua stub.
16. **ADR 017** (não 016). **ADR 016** é `pre-carregamento` (Fase 5).
17. **`LEAVE_TYPES` do Ruby e do TS devem ter os mesmos valores.** Verificar com golden test.
18. **`isWorkingTime`** é bit 1 = 0 (não `!isTimeOff`). Cuidado com `null`.

---

## Notas específicas por subfase

### 6.0 — ADR 017

- O encoding completo (bit 0 a 8) precisa ser documentado. É a "fonte da verdade" para todos os helpers de `scoreboard-bits.ts`.

### 6.1 — `scoreboard-bits.ts`

- **Constantes primeiro, funções depois.** Sem lógica de negócio — só bit operations.
- `LEAVE_TYPES` é um objeto `Record<string, number>` (não `enum`), para espelhar o `Hash` do Ruby.
- **9 funções de leitura/escrita.** Cada uma tem 3–5 testes cobrindo os casos de borda (`null`, `0`, valores parciais).

### 6.2 — Limits

- **`Limit` e `Limits` são classes simples mas com muitas validações.**
- **`idxToSbIdx`** é a conversão crítica. Erro aqui quebra tudo.
- **`setLimit`** é o método mais complexo. Seguir a ordem exata de ajuste do intervalo.
- **`ok?` com `index === null`** percorre todos os slots — é o caso mais lento.
- **`copy` do `Limit`** cria `scoreboard` novo. Não compartilha.

### 6.3 — ShiftAssignments

- **`projectObjectId`** é helper **obrigatório** — sem ele, `hashKey` fica instável.
- **`ShiftAssignment.hashKey`** usa `projectObjectId(project)`, `scenarioIdx`, `start`, `end`.
- **`ShiftAssignments.hashKey`** ordena assignments **in-place** e concatena. Cuidado com mutação.
- **`newScoreboard`** é o coração do compartilhamento. Duas instâncias idênticas → mesmo scoreboard.
- **`getSbSlot`** é lazy. Se já computou, retorna cache; senão, computa e armazena.
- **Encoding no `getSbSlot`**: `BIT_ASSIGNED | (offWork ? BIT_OFF_WORK : 0) | (onLeave ? packLeaveType : 0) | (replace ? BIT_OVERRIDE : 0)`.

### 6.4 — ShiftScenario

- **`onShift?`** é a única lógica real de `ShiftScenario` (o resto é herança de `ScenarioData`).
- **`replace?`** e **`onLeave?`** são triviais.
- **Sem `Leave` real** (Fase 16) — usa stub `{ interval: TimeInterval }`.

### 6.5 — ResourceScenario.onShift?

- **Adicionar SÓ `onShift?`** — o resto de `ResourceScenario` (book, initScoreboard) é Fase 7.
- **Prioridade:** `shifts` > `workinghours`. Se `shifts.assigned?(sbIdx)`, usa `shifts.onShift?`.

### 6.6 — Golden tests

- **`limits.rb`** cobre 4 tipos de limite × ~5 incrementos = ~20 verificações.
- **`shift-assignments.rb`** cobre encoding em ~10 índices + `hashKey` sharing = ~20 verificações.
- **Zero divergências** é o critério.

### 6.7 — Verificação

- **Sem stubs nesta fase** — tudo é implementado de verdade.
- **`sbClear()` em `beforeEach`** é crítico para os testes passarem consistentemente.

---

**Fim do arquivo de tarefas da Fase 6.**