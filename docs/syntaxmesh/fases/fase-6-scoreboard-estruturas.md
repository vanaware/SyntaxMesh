# Fase 6 — Scoreboard e Estruturas Base

> **Arquivo:** `docs/syntaxmesh/fases/fase-6-scoreboard-estruturas.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–7 dias
> **Depende de:** Fase 2 — Tempo e Geometria; Fase 3 — Modelo de Atributos; Fase 4 — Árvore de Propriedades; Fase 5 — Entidades Concretas
> **Bloqueia:** Fases 7, 8, 9

---

## 1. Contexto

O `Scoreboard` foi portado como estrutura **genérica** na Fase 2 (`Scoreboard<T>` com `T[]`). Ele armazena qualquer tipo em slots de tempo. **Mas o TaskJuggler usa `Scoreboard` com codificação de bits** para economizar memória e representar múltiplos estados em um único inteiro.

Isso aparece em 3 lugares:

1. **Project scoreboards globais** (`Project.initScoreboards`) — armazenam `nil | 2 | 4` para working time / off-duty / leave.
2. **ResourceScenario scoreboard** — codifica working time + leaves + shift assignments em bits 0–8.
3. **ShiftAssignments scoreboard** — mesmo encoding, com bit 8 para `replace`.

Além disso, duas estruturas-chave do scheduler são implementadas nesta fase:

- **`Limits`** — restrições por período (daily/weekly/monthly max/min), usadas por `TaskScenario` e `ResourceScenario`.
- **`ShiftAssignments`** — atribuições de shifts a intervalos, usadas para substituir working hours por recurso.

E a entidade `ShiftScenario` (que ficou como stub na Fase 5) é **consolidada** aqui: `onShift?`, `onLeave?`, `replace?` ficam completas.

Ao final desta fase, o scheduler tem todas as estruturas de restrição prontas. A Fase 7 implementa o algoritmo de alocação propriamente dito.

---

## 2. Objetivo

Ao final desta fase:

- Convenções de **bit encoding** do `Scoreboard` documentadas (ADR 016) e encapsuladas em helpers.
- `Scoreboard` estendido com métodos utilitários para uso numérico (bit operations).
- `Limits` + `Limit` implementados.
- `ShiftAssignments` + `ShiftAssignment` implementados, com **compartilhamento de scoreboards** (via cache estático).
- `ShiftScenario` consolidado (`onShift?`, `onLeave?`, `replace?`).
- Helper `projectObjectId` para replicar `object_id` do Ruby.
- **≥ 90 testes unitários** + **≥ 25 golden tests** (Limits, ShiftAssignments).
- ADR 016 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Scoreboard.rb` | ~180 | Média | **Crítica** (revisitar) |
| `Limits.rb` | ~250 | Média | **Crítica** |
| `ShiftAssignments.rb` | ~300 | **Alta** | **Crítica** |
| `ShiftScenario.rb` | ~40 | Baixa | Alta |
| `Project.rb` | (seções `initScoreboards`) | Alta | Consultar |
| `ResourceScenario.rb` | (seção `initScoreboard`) | Alta | Consultar |

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.6 Scoreboards | Uso global |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.7 Conversões de Tempo | `idxToDate`, `dateToIdx` |
| `docs/tj3-engine/05-blueprint-engine4.md` | §3 Limits | Descrição detalhada |
| `docs/tj3-engine/05-blueprint-engine4.md` | §4 ShiftAssignments | Encoding de bits |
| `docs/tj3-engine/05-blueprint-engine4.md` | §4.3 Encoding do Scoreboard | Bits exatos |

### 3.3 Golden tests

Scripts Ruby `limits.rb` e `shift-assignments.rb` geram JSON com casos de teste:
- Limits: dailymax 8h, weeklymax 40h, monthlymax 160h, etc.
- ShiftAssignments: 3 shifts atribuídos, verificação de bits, `replace` mode, `hashKey` sharing.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Bit encoding: não é uma classe, é uma convenção

O `Scoreboard.rb` **não tem** método de encoding/decoding. O usuário (Project, ResourceScenario, ShiftAssignments) é quem interpreta os bits. Cada um tem sua própria convenção.

**Decisão:** centralizar as constantes e helpers em `packages/core/src/time/scoreboard-bits.ts`. Nenhuma classe nova. Apenas:

```ts
export const LEAVE_TYPE_PROJECT = 0;  // menor prioridade
export const LEAVE_TYPE_ANNUAL = 1;
export const LEAVE_TYPE_SPECIAL = 2;
export const LEAVE_TYPE_SICK = 3;
export const LEAVE_TYPE_UNPAID = 4;
export const LEAVE_TYPE_HOLIDAY = 5;
export const LEAVE_TYPE_UNEMPLOYED = 6;

export const BIT_ASSIGNED = 1 << 0;       // bit 0
export const BIT_OFF_WORK = 1 << 1;       // bit 1
export const LEAVE_SHIFT = 2;              // bits 2-5
export const LEAVE_MASK = 0x3C;            // 0b00111100
export const BIT_OVERRIDE = 1 << 8;        // bit 8

export function packLeaveType(type: number): number;
export function unpackLeaveType(val: number): number;
export function isWorkingTime(val: number | null): boolean;
export function isTimeOff(val: number | null): boolean;
export function isLeave(val: number | null): boolean;
export function isOnLeave(val: number | null): boolean;
export function hasOverride(val: number | null): boolean;
```

**Justificativa:** documenta as convenções em um único lugar; evita magic numbers espalhados.

Ver ADR 016.

### 4.2 Scoreboard numérico especializado?

Ruby usa `Array` genérico. TS poderia usar `Int32Array` para scoreboards numéricos. **Decisão:** **não** especializar nesta fase. `Scoreboard<number>` com `number[]` é suficiente. Otimização fica para depois se performance exigir. Ver ADR 016.

### 4.3 `Limit` interno: `Scoreboard<number>`

O `Limit.rb` cria `Scoreboard.new(interval.startDate, interval.endDate, period, 0)` — um scoreboard com **períodos maiores** que o projeto (1 dia, 1 semana, 1 mês). O `idxToSbIdx` converte índices do projeto para índices do scoreboard do limite.

Replicamos fielmente, usando `Scoreboard<number>` da Fase 2.

### 4.4 `Limits` é uma coleção; sem herança

Em Ruby, `Limits` não herda de nada. Ele contém `@limits: Limit[]`. Replicamos.

### 4.5 `ShiftAssignments` — sem `Monitor`

Ruby: `class ShiftAssignments < Monitor` (thread safety). JS é single-threaded no worker; sem lock necessário. **Decisão:** remover `Monitor`. Documentar.

### 4.6 `ShiftAssignments.@@scoreboards` — cache estático

Ruby compartilha scoreboards entre `ShiftAssignments` com **o mesmo conteúdo**. Implementação:

- `@@scoreboards: Map<string, [Set<number>, Scoreboard<number>]>` (hashKey → record).
- `newScoreboard()`: se hashKey existe, adiciona `objectId` ao Set e retorna scoreboard compartilhado.
- `define_finalizer` → **`FinalizationRegistry`** em TS para limpar quando a instância for GC'ed.

**Problema:** `FinalizationRegistry` em Deno é suportado mas comportamento não-determinístico. Aceito — o cache cresce, mas em testes é limpo manualmente (`ShiftAssignments.sbClear()`).

### 4.7 `hashKey` — strings determinísticas

Ruby: `hashKey` = `"#{project.object_id}|#{assignment1.hashKey}||#{assignment2.hashKey}||..."`.

Em TS: substituir `object_id` por ID sequencial via `WeakMap<Project, number>`:

```ts
const projectIds = new WeakMap<object, number>();
let nextProjectId = 1;

export function projectObjectId(project: object): number {
  let id = projectIds.get(project);
  if (id === undefined) {
    id = nextProjectId++;
    projectIds.set(project, id);
  }
  return id;
}
```

Análogo ao Ruby; WeakMap permite GC.

### 4.8 Ordenação de `assignments` em `hashKey`

Ruby:
```ruby
@assignments.sort! { |a, b| a.interval.start <=> b.interval.start }
```
Ordena **in-place** as assignments por `interval.start` antes de gerar hashKey. Replicar.

### 4.9 `ShiftAssignment.hashKey`

```ruby
def hashKey
  "#{@shiftScenario.object_id}|#{@interval.start}|#{@interval.end}"
end
```

Replicar com `projectObjectId`. Como `ShiftScenario` é única por `Shift`, precisamos de objectId para `ShiftScenario` também.

### 4.10 `ShiftScenario` — consolidar

A Fase 5 deixou o esqueleto. Aqui implementamos os 3 métodos:
- `onShift?(date: TjTime): boolean`
- `replace?(): boolean`
- `onLeave?(date: TjTime): boolean`

E o `onShift?` do `ResourceScenario` e `TaskScenario` delegam para `ShiftAssignments` (que usa `ShiftScenario`).

### 4.11 Integração de `ResourceScenario.onShift?`

A Fase 5 deixou `ResourceScenario` como esqueleto. Aqui adicionamos **apenas** `onShift?(sbIdx)` (usado por `ShiftAssignments.getSbSlot`). O resto (`initScoreboard`, `book`, etc.) fica para a Fase 7.

### 4.12 Erros

Reutilizamos `TjError`, `TjArgumentError` (Fase 3). Adicionamos `TjInternalError` se necessário (Fase 4 já tem).

---

## 5. Subfases detalhadas

---

### 6.0 — ADR 016 (Scoreboard encoding conventions)

#### Contexto

O `Scoreboard` é genérico, mas o TaskJuggler usa convenções específicas de bits para codificar working time, leaves, e overrides. Essas convenções não estão documentadas em um lugar único no Ruby — estão espalhadas em `Project.rb`, `ResourceScenario.rb` e `ShiftAssignments.rb`.

Antes de implementar, precisamos registrá-las formalmente.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/016-scoreboard-encoding.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/016-scoreboard-encoding.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** explicar que `Scoreboard` é genérico; encoding é por convenção.
- [ ] **Encoding completo (documentado):**
  ```
  nil: Value has not been determined yet.

  Bit 0:      0: No assignment
              1: Has assignment
  Bit 1:      0: Work time (as defined by working hours)
              1: No work time (as defined by working hours)
  Bit 2-5:    0: No holiday or leave
              1: Public holiday
              2: Annual leave
              3: Special leave
              4: Sick leave
              5: Unpaid leave
              6: Blocked for other projects
              7-15: Reserved
  Bit 6-7:    Reserved
  Bit 8:      0: No global override
              1: Override global setting
  ```
- [ ] **Decisão:** centralizar constantes e helpers em `packages/core/src/time/scoreboard-bits.ts`.
- [ ] **Alternativas:** `enum` com flags, classe `ScoreboardValue`, sem helpers.
- [ ] **Consequências:** legibilidade, um único ponto de verdade; pequeno overhead de import.
- [ ] **Nota sobre performance:** não especializar `Scoreboard` com `Int32Array` nesta fase; revisitar se performance exigir.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb` — comentários do encoding.
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — `initScoreboard`.
- `docs/tj3-engine/05-blueprint-engine4.md` — §4.3.

#### Fora de escopo

- Implementação — subfases 10.1+.

#### Critério de aceite

- ADR 016 criado com encoding completo.
- Tabela atualizada.

---

### 6.1 — `scoreboard-bits.ts` (constantes + helpers)

#### Contexto

Centralizar o encoding documentado no ADR 016.

#### Objetivo

Criar módulo com constantes e funções puras para leitura/escrita de bits.

#### Arquivos

- `packages/core/src/time/scoreboard-bits.ts`
- `packages/core/tests/time/scoreboard-bits_test.ts`

#### Requisitos

**Constantes:**

- [ ] `LEAVE_TYPES` — mapa de `{ project: 0, annual: 1, special: 2, sick: 3, unpaid: 4, holiday: 5, unemployed: 6 }`.
- [ ] `BIT_ASSIGNED = 1 << 0`.
- [ ] `BIT_OFF_WORK = 1 << 1`.
- [ ] `LEAVE_SHIFT = 2`.
- [ ] `LEAVE_MASK = 0x3C`.
- [ ] `BIT_OVERRIDE = 1 << 8`.

**Funções:**

- [ ] `packLeaveType(type: number): number` — `type << LEAVE_SHIFT`.
- [ ] `unpackLeaveType(val: number): number` — `(val & LEAVE_MASK) >> LEAVE_SHIFT`.
- [ ] `isAssigned(val: number | null): boolean` — bit 0.
- [ ] `isWorkingTime(val: number | null): boolean` — bit 1 igual a 0.
- [ ] `isTimeOff(val: number | null): boolean` — bit 1 igual a 1.
- [ ] `isOnLeave(val: number | null): boolean` — bits 2–5 não zero.
- [ ] `isLeaveType(val: number | null, type: number): boolean` — bits 2–5 iguais ao tipo.
- [ ] `hasOverride(val: number | null): boolean` — bit 8.
- [ ] `packWorkTime(isWorking: boolean, leaveType?: number, override?: boolean): number` — monta um inteiro completo.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb` — comentários do encoding.
- ADR 016.

#### Fora de escopo

- Uso — subfases 10.2+.

#### Critério de aceite

```ts
assertEquals(packLeaveType(2), 8);
assertEquals(unpackLeaveType(8), 2);
assertEquals(isAssigned(1), true);
assertEquals(isWorkingTime(0), true);
assertEquals(isTimeOff(2), true);
assertEquals(isOnLeave(8), true);
assertEquals(hasOverride(256), true);
```

#### Testes

- `scoreboard-bits_test.ts`:
  - `describe("scoreboard-bits")`
    - `it("packLeaveType")`.
    - `it("unpackLeaveType")`.
    - `it("isAssigned")`.
    - `it("isWorkingTime / isTimeOff")`.
    - `it("isOnLeave")`.
    - `it("isLeaveType")`.
    - `it("hasOverride")`.
    - `it("packWorkTime combina bits")`.

---

### 6.2 — `Limits` + `Limit`

#### Contexto

`Limits` representa restrições por período. Cada `Limit` tem um `Scoreboard<number>` com contadores por período (daily, weekly, monthly). `setLimit` cria ou substitui um limite.

Usado em:
- `TaskScenario.limitsOk?` — verifica antes de alocar.
- `TaskScenario.incLimits` — incrementa após book.
- `ResourceScenario.book` — idem.

#### Objetivo

Implementar `Limit` + `Limits` com:
- 8 tipos de limite (`dailymax/min`, `weeklymax/min`, `monthlymax/min`, `maximum/minimum`).
- `ok?`, `inc`, `dec`, `reset`.
- `idxToSbIdx` (conversão de índice).
- Integração com `project.scheduleGranularity` e `weekStartsMonday`.

#### Arquivos

- `packages/core/src/scheduling/limits.ts`
- `packages/core/tests/scheduling/limits_test.ts`

#### Requisitos

**`Limit`:**

- [ ] `class Limit`:
  - `readonly name: string`
  - `readonly interval: ScoreboardInterval`
  - `readonly period: number` (segundos)
  - `readonly value: number`
  - `readonly upper: boolean`
  - `resource: Resource | null` (mutável — setado por `setLimit` quando `limitResources` está presente)
  - `private scoreboard: Scoreboard<number>`
  - `private dirty: boolean`
- [ ] Constructor `(name, interval, period, value, upper, resource)`.
- [ ] `copy(): Limit` — deep copy.
- [ ] `reset(index?: number): void`:
  - Se `index === undefined`, recria `scoreboard` com 0.
  - Senão, se `interval.contains(index)`, reseta o slot.
  - `dirty = false`.
- [ ] `inc(index: number, resource: Resource | null): void`:
  - Se `interval.contains(index)` e (`this.resource === null || this.resource === resource`), `dirty = true`, `scoreboard[idxToSbIdx(index)] += 1`.
- [ ] `dec(index: number, resource: Resource | null): void` — análogo.
- [ ] `ok?(index: number | null, upper: boolean, resource: Resource | null): boolean`:
  - Se `upper !== this.upper` ou `this.resource !== null && this.resource !== resource`, retorna `true`.
  - Se `index === null`, verifica todos os slots: se `upper` e algum `>= value` → `false`; senão se algum `< value` → `false`.
  - Se `index` fora do intervalo, retorna `true`.
  - Senão, verifica o slot: `upper ? sbVal < value : sbVal >= value`.
- [ ] `private idxToSbIdx(index: number): number` — `(index - interval.start) * interval.slotDuration / period`.

**`Limits`:**

- [ ] `class Limits`:
  - `readonly limits: Limit[]`
  - `private project: ProjectLike | null`
- [ ] Constructor `(limits?: Limits)` — copy ou vazio.
- [ ] `setProject(project: ProjectLike): void` — lança se `limits` não vazio.
- [ ] `reset(): void` — chama `limit.reset()` para todos.
- [ ] `setLimit(name, value, interval?, resource?)`:
  - Se `interval === undefined`, cria um `ScoreboardInterval` do projeto (`project.get('start')`, `project.get('end')`, `scheduleGranularity`).
  - Ajusta `iv.start` / `iv.end` com `midnight()`, e com `beginOfWeek`/`beginOfMonth` para weekly/monthly.
  - Define `period` e `upper` conforme `name`.
  - Remove limite existente com mesma `(name, startDate, endDate, resource)`.
  - Cria `new Limit(...)`.
- [ ] `inc(index, resource?)`, `dec(index, resource?)`, `ok?(index?, upper?, resource?)`.

**Tipos de limite:**

| Nome | Period | Upper | Ajuste do intervalo |
|---|---|---|---|
| `dailymax` | 86400 | true | `iv.start = startDate.midnight()`, `iv.end = endDate.midnight()` |
| `dailymin` | 86400 | false | idem |
| `weeklymax` | 604800 | true | `iv.start = startDate.beginOfWeek(weekStartsMonday)` |
| `weeklymin` | 604800 | false | idem |
| `monthlymax` | 2592000 (30d) | true | `iv.start = startDate.beginOfMonth` |
| `monthlymin` | 2592000 | false | idem |
| `maximum` | `iv.duration` | true | sem ajuste |
| `minimum` | `iv.duration` | false | idem |

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Limits.rb` — arquivo completo.
- `docs/tj3-engine/05-blueprint-engine4.md` — §3.

#### Fora de escopo

- Uso por `TaskScenario` — Fase 7.
- Uso por `ResourceScenario` — Fase 7.

#### Critério de aceite

```ts
const limits = new Limits();
limits.setProject(mockProject);
limits.setLimit("dailymax", 8 * 3600, undefined, undefined);
assertEquals(limits.limits.length, 1);

limits.inc(0, null);
limits.inc(0, null);
assertEquals(limits.ok?(0, true, null), true);
for (let i = 0; i < 30; i++) limits.inc(0, null);
assertEquals(limits.ok?(0, true, null), false);
```

#### Testes

- `limits_test.ts`:
  - `describe("Limit")`
    - `it("constructor")`.
    - `it("copy")`.
    - `it("reset sem index")`.
    - `it("reset com index")`.
    - `it("inc dentro do intervalo")`.
    - `it("inc fora do intervalo")`.
    - `it("inc filtra por resource")`.
    - `it("dec")`.
    - `it("ok? dailymax")`.
    - `it("ok? dailymin")`.
    - `it("ok? com resource")`.
    - `it("ok? com index null verifica todos")`.
    - `it("idxToSbIdx converte corretamente")`.
  - `describe("Limits")`
    - `it("setProject")`.
    - `it("setProject lança se já tem limites")`.
    - `it("setLimit dailymax")`.
    - `it("setLimit weeklymax")`.
    - `it("setLimit monthlymax")`.
    - `it("setLimit maximum")`.
    - `it("setLimit substitui existente")`.
    - `it("reset")`.
    - `it("inc/dec/ok? delegam")`.
    - `it("copy constructor")`.

---

### 6.3 — `ShiftAssignments` + `ShiftAssignment`

#### Contexto

`ShiftAssignments` gerencia atribuições de shifts a intervalos. O `scoreboard` interno armazena o encoding de bits. **Compartilha scoreboards** entre instâncias com conteúdo idêntico (economia de memória).

Usado por:
- `ResourceScenario.onShift?` — se tem shifts atribuídos, delega.
- `TaskScenario.bookResources` — se tem shifts, restringe alocação.
- `Allocation.onShift?` — Fase 7.

#### Objetivo

Implementar `ShiftAssignment` + `ShiftAssignments` com:
- `addAssignment` (validação de não-sobreposição).
- `getSbSlot` (lazy computation com encoding).
- `assigned?`, `onShift?`, `timeOff?`, `onLeave?`.
- `collectTimeOffIntervals`.
- **Compartilhamento** de scoreboards via `@@scoreboards` (Map estático + FinalizationRegistry).
- `hashKey()` determinístico.

#### Arquivos

- `packages/core/src/scheduling/shift-assignments.ts`
- `packages/core/src/utils/project-object-id.ts`
- `packages/core/tests/scheduling/shift-assignments_test.ts`

#### Requisitos

**`project-object-id.ts`:**

- [ ] `projectObjectId(project: object): number` — usando `WeakMap<object, number>` e contador global.

**`ShiftAssignment`:**

- [ ] `class ShiftAssignment`:
  - `readonly shiftScenario: ShiftScenario`
  - `interval: TimeInterval`
- [ ] Constructor `(shiftScenario, interval)`.
- [ ] `hashKey(): string` — `${projectObjectId(shiftScenario.property.project)}|${shiftScenario.scenarioIdx}|${interval.start.toSeconds()}|${interval.end.toSeconds()}`.
- [ ] `copy(): ShiftAssignment`.
- [ ] `overlaps(iv: TimeInterval): boolean`.
- [ ] `replace?(date: TjTime): boolean` — `interval.start <= date < interval.end && shiftScenario.replace?()`.
- [ ] `assigned?(date: TjTime): boolean` — `interval.start <= date < interval.end`.
- [ ] `onShift?(date: TjTime): boolean` — `shiftScenario.onShift?(date)`.
- [ ] `onLeave?(date: TjTime): boolean` — `shiftScenario.onLeave?(date)`.
- [ ] `to_s(): string`.

**`ShiftAssignments`:**

- [ ] `class ShiftAssignments`:
  - `project: ProjectLike | null` (mutável)
  - `readonly assignments: ShiftAssignment[]`
  - `private scoreboard: Scoreboard<number> | null`
  - `private hashKeyCache: string | null`
- [ ] Constructor `(sa?: ShiftAssignments)`:
  - Se `sa` presente, deep copy (`assignments.map(a => a.copy())`), `project = sa.project`, e cria/compartilha scoreboard.
  - Senão, vazio.
  - Registra em `FinalizationRegistry` para limpar cache.
- [ ] `addAssignment(sa: ShiftAssignment): boolean`:
  - Se `overlaps?(sa.interval)`, retorna `false`.
  - `assignments.push(sa)`, `scoreboard = newScoreboard()`, retorna `true`.
- [ ] `getSbSlot(idx: number): number`:
  - Se `scoreboard[idx] !== null` (valor determinado), retorna.
  - Senão, computa:
    - Para cada `sa` em `assignments`:
      - Se `!sa.assigned?(date)`, continua.
      - `val = BIT_ASSIGNED`.
      - Se `!sa.onShift?(date)`, `val |= BIT_OFF_WORK`.
      - Se `sa.onLeave?(date)`, `val |= packLeaveType(LEAVE_TYPE_HOLIDAY)` (aproximação — Ruby usa tipo genérico).
      - Se `sa.replace?(date)`, `val |= BIT_OVERRIDE`.
      - `scoreboard[idx] = val`, retorna.
    - Se nenhum atribuído, `scoreboard[idx] = 0`.
- [ ] `assigned?(idx: number): boolean` — `isAssigned(getSbSlot(idx))`.
- [ ] `onShift?(idx: number): boolean` — `isWorkingTime(getSbSlot(idx))`.
- [ ] `timeOff?(idx: number): boolean` — `isTimeOff(getSbSlot(idx))`.
- [ ] `onLeave?(idx: number): boolean` — `isOnLeave(getSbSlot(idx))`.
- [ ] `collectTimeOffIntervals(iv: TimeInterval, minDuration: number): IntervalList<TimeInterval>` — usa `scoreboard.collectIntervals` com `isTimeOff`.
- [ ] `hashKey(): string`:
  - Se cache, retorna.
  - Senão, `assignments.sort()` por `interval.start`, concatena `hashKey()` de cada.
- [ ] `private newScoreboard(): Scoreboard<number>`:
  - Computa `hashKey`.
  - Se existe record no cache estático, adiciona `objectId` ao Set e retorna o scoreboard.
  - Senão, cria `new Scoreboard<number>(project.get('start'), project.get('end'), project.get('scheduleGranularity'), null)` — **initVal null** para lazy computation, e registra.
- [ ] Static `scoreboards: Map<string, [Set<number>, Scoreboard<number>]>`.
- [ ] Static `sbClear(): void` — limpa cache (usado em testes).
- [ ] Static `deleteScoreboard(objId: number): void` — remove referência, deleta entry se vazia.

**Nota:** `Scoreboard<number>` aceita `number | null`? A Fase 2 definiu `T` genérico. Precisamos de `Scoreboard<number | null>`. Ajustar tipo.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb` — arquivo completo.
- `docs/tj3-engine/05-blueprint-engine4.md` — §4.

#### Fora de escopo

- Uso por `ResourceScenario` — Fase 7.
- Uso por `Allocation` — Fase 7.

#### Critério de aceite

```ts
const sa = new ShiftAssignments();
sa.project = mockProject;

const shift = new Shift(project, "morning", "Morning", null);
const ss = shift.scenarioData(0);
const interval = new TimeInterval(
  TjTime.fromString("2026-01-01"),
  TjTime.fromString("2026-02-01"),
);
sa.addAssignment(new ShiftAssignment(ss, interval));
assert(sa.assigned?(0)); // sbIdx 0 dentro do intervalo
```

#### Testes

- `shift-assignments_test.ts`:
  - `describe("ShiftAssignment")`
    - `it("hashKey determinístico")`.
    - `it("copy")`.
    - `it("overlaps")`.
    - `it("assigned? dentro/fora do intervalo")`.
    - `it("replace? delega para ShiftScenario")`.
    - `it("onShift? / onLeave? delegam")`.
  - `describe("ShiftAssignments")`
    - `it("addAssignment adiciona")`.
    - `it("addAssignment rejeita sobreposição")`.
    - `it("getSbSlot lazy")`.
    - `it("getSbSlot encoding correto")`.
    - `it("assigned? / onShift? / timeOff? / onLeave?")`.
    - `it("collectTimeOffIntervals")`.
    - `it("hashKey agrupa iguais")`.
    - `it("compartilha scoreboard entre instâncias idênticas")`.
    - `it("copy constructor não compartilha assignments")`.
    - `it("sbClear limpa cache")`.

---

### 6.4 — `ShiftScenario` consolidado

#### Contexto

A Fase 5 deixou `ShiftScenario` como stub. Aqui implementamos os 3 métodos.

#### Objetivo

Consolidar `ShiftScenario`.

#### Arquivos

- `packages/core/src/model/shift-scenario.ts` (estender)
- `packages/core/tests/model/shift-scenario_test.ts`

#### Requisitos

- [ ] `onShift?(date: TjTime): boolean`:
  - `const wh = this.a('workinghours') as WorkingHours | null;`
  - Se null, retorna `true` (sem restrição).
  - Senão, `wh.onShift(date)`.
- [ ] `replace?(): boolean` — `this.a('replace') as boolean`.
- [ ] `onLeave?(date: TjTime): boolean`:
  - `const leaves = this.a('leaves') as LeaveList;`
  - Para cada `leave`, se `leave.interval.contains(date)` retorna `true`.
  - Senão, `false`.

**Nota:** `Leave` é stub (Fase 16). A interface mínima é `{ interval: TimeInterval }`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb` — arquivo completo.

#### Fora de escopo

- `Leave` real — Fase 16.

#### Critério de aceite

```ts
const shift = new Shift(mp, "morning", "Morning", null);
const ss = shift.scenarioData(0);

const wh = new WorkingHours(3600, start, end, "UTC");
wh.setWorkingHours(1, [[32400, 61200]]); // Monday 9-17
shift.setForScenario("workinghours", wh, 0);

assert(ss.onShift(TjTime.fromString("2026-01-05-10:00"))); // Monday
assert(!ss.onShift(TjTime.fromString("2026-01-05-20:00")));
```

#### Testes

- `shift-scenario_test.ts`:
  - `describe("ShiftScenario")`
    - `it("onShift? com workinghours")`.
    - `it("onShift? sem workinghours retorna true")`.
    - `it("replace? lê atributo")`.
    - `it("onLeave? com leaves")`.
    - `it("onLeave? sem leaves retorna false")`.

---

### 6.5 — Integração com `ResourceScenario`

#### Contexto

O `ShiftAssignments` é usado por `ResourceScenario.onShift?`. Como `ResourceScenario` foi stub na Fase 5, adicionamos **apenas** `onShift?` aqui. O resto (`initScoreboard`, `book`) fica para a Fase 7.

#### Objetivo

Adicionar `onShift?` a `ResourceScenario`.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (estender)
- `packages/core/tests/model/resource-scenario-onshift_test.ts`

#### Requisitos

- [ ] `onShift?(sbIdx: number): boolean`:
  - `const shifts = this.a('shifts') as ShiftAssignments | null;`
  - Se `shifts && shifts.assigned?(sbIdx)`, retorna `shifts.onShift?(sbIdx)`.
  - Senão, retorna `(this.a('workinghours') as WorkingHours).onShift(sbIdx)`.

**Nota:** `workinghours` do recurso herda do projeto se não setado. Isso é responsabilidade de `inheritAttributes` (Fase 4). Aqui só usamos o que está lá.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — `onShift?`.

#### Fora de escopo

- `initScoreboard` — Fase 7.
- `book`, `available?` — Fase 7.

#### Critério de aceite

```ts
const r = new Resource(mp, "alice", "Alice", null);
const rs = r.scenarioData(0);

const wh = new WorkingHours(3600, start, end, "UTC");
wh.setWorkingHours(1, [[32400, 61200]]); // Monday 9-17
r.setForScenario("workinghours", wh, 0);

assert(rs.onShift(/* sbIdx correspondente a Monday 10h */));
assert(!rs.onShift(/* sbIdx correspondente a Monday 20h */));
```

#### Testes

- `resource-scenario-onshift_test.ts`:
  - `describe("ResourceScenario.onShift?")`
    - `it("usa workinghours do recurso")`.
    - `it("usa shifts se assigned")`.
    - `it("prioriza shifts sobre workinghours")`.

---

### 6.6 — Golden tests (Limits, ShiftAssignments)

#### Contexto

Validar comportamento contra Ruby.

#### Objetivo

Scripts Ruby `limits.rb` e `shift-assignments.rb`.

#### Arquivos

- `scripts/golden/limits.rb`
- `scripts/golden/shift-assignments.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/limits.golden.json`
- `packages/core/tests/golden/shift-assignments.golden.json`
- `packages/core/tests/golden/limits_golden_test.ts`
- `packages/core/tests/golden/shift-assignments_golden_test.ts`
- `deno.jsonc` — atualizar task `golden:generate`

#### Requisitos

**Script Ruby `limits.rb`:**

- [ ] Cria `Project.new("prj", "Test", "1.0")` com `start`, `end`, `scheduleGranularity=3600`.
- [ ] Para cada tipo de limite (dailymax, weeklymax, monthlymax, maximum):
  - Cria `Limits`, chama `setLimit`.
  - Incrementa N vezes.
  - Verifica `ok?` em vários índices.
  - Serializa: `{ name, period, upper, checks: [{ index, upper, resource, expected }] }`.

**Script Ruby `shift-assignments.rb`:**

- [ ] Cria `Project` com `start`, `end`, `scheduleGranularity=3600`.
- [ ] Cria `Shift` com `workinghours` Monday 9-17.
- [ ] Cria `ShiftAssignments`, adiciona 2 assignments.
- [ ] Para vários `idx`, serializa `getSbSlot`, `assigned?`, `onShift?`, `timeOff?`, `onLeave?`.
- [ ] Testa `hashKey` para 2 instâncias idênticas.

**Testes TS:**

- [ ] Leem os JSONs.
- [ ] Reconstroem o cenário.
- [ ] Comparam.

**Task `golden:generate`:**

- [ ] Adicionar os 2 scripts.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Limits.rb`.
- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb`.
- Fase 2, subfase 5.14 — infraestrutura base.

#### Fora de escopo

- Golden tests de `ResourceScenario.book` — Fase 7.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 25 casos.
- Todos passam.

#### Testes

- `limits_golden_test.ts`:
  - `describe("Golden Limits")` — itera casos.
- `shift-assignments_golden_test.ts`:
  - `describe("Golden ShiftAssignments")` — itera casos.

---

## 6. Ordem de execução sugerida

```text
10.0 ADR 016
      ↓
10.1 scoreboard-bits + helpers
      ↓
10.2 Limits + Limit
      ↓
10.3 ShiftAssignments + ShiftAssignment     ← precisa de projectObjectId
      ↓
10.4 ShiftScenario consolidado
      ↓
10.5 ResourceScenario.onShift?
      ↓
10.6 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 6 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `scoreboard-bits.ts` implementado com encoding completo.
- [ ] `Limits` + `Limit` implementados.
- [ ] `ShiftAssignments` + `ShiftAssignment` implementados com compartilhamento de scoreboards.
- [ ] `ShiftScenario` consolidado.
- [ ] `ResourceScenario.onShift?` implementado.
- [ ] `projectObjectId` helper implementado.
- [ ] **≥ 90 testes unitários**.
- [ ] **≥ 25 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 016 criado.
- [ ] Scripts `limits.rb` e `shift-assignments.rb` funcionais.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Encoding de bits divergir do Ruby | Alto | Golden tests validam `getSbSlot` em ~20 índices |
| `ShiftAssignments.@@scoreboards` compartilhado causar bug | Alto | Testes verificam que instâncias idênticas compartilham; `sbClear` entre testes |
| `FinalizationRegistry` não-determinístico em Deno | Médio | Aceito; `sbClear` limpa manualmente |
| `projectObjectId` vazar memória | Baixo | `WeakMap` permite GC |
| `Limits.setLimit` com `interval` mal formado | Médio | Validações + testes |
| `Scoreboard<number \| null>` (Fase 2) não suportar null | Médio | Ajustar tipo genérico |
| `ShiftScenario.onLeave?` com `Leave` stub | Baixo | Interface mínima `{ interval }` |
| `Limits` copy constructor compartilhar `scoreboard` | Médio | `Limit.copy` cria scoreboard novo |
| Ordenação in-place em `hashKey` muta `assignments` | Baixo | Aceito — mesmo comportamento do Ruby |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Scoreboard.rb` (revisitar)
- `docs/taskjuggler/lib/taskjuggler/Limits.rb`
- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb`
- `docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` (seção `onShift?`)

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.6, §2.7
- `docs/tj3-engine/05-blueprint-engine4.md` — §3, §4

### Documentos do projeto

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/016-scoreboard-encoding.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 7 — Scheduler** (usa `Limits`, `ShiftAssignments`, `Scoreboard`).
- **Fase 8 — Financeiro** (Limits aparecem em reports).
- **Fase 9 — Orquestrador** (Project usa `Scoreboard` global).

---

## 10. Notas para a IA

1. **Encoding de bits é convenção.** Não crie classe nova. Use os helpers de `scoreboard-bits.ts`.
2. **`Scoreboard<number | null>`.** A Fase 2 definiu `T` genérico. Para `ShiftAssignments`, use `number | null` (null = slot não computado).
3. **`@@scoreboards` é Map estático.** Compartilha entre instâncias. Sempre `sbClear()` em `beforeEach`.
4. **`FinalizationRegistry` é opcional.** Se causar problemas em testes, desabilitar e confiar em `sbClear`.
5. **`hashKey` deve ser determinístico.** Sem `Math.random`, sem `Date.now`. Apenas dados da instância.
6. **`Limits` copy constructor cria limites novos.** Não compartilha scoreboards internos.
7. **`Limit.resource` é mutável** (setado por `setLimit` com `limitResources`). Não torne readonly.
8. **`projectObjectId` usa `WeakMap`.** Permite GC de projetos.
9. **`ShiftScenario.onShift?` sem `workinghours` retorna `true`.** Sem restrição = sempre disponível.
10. **Sem `any`.** Use `unknown` + narrowing.
11. **Commit por subfase.** `feat(core): limits`, `feat(core): shift-assignments`.
12. **Golden tests contra Ruby são obrigatórios.**
13. **Não tocar em Fase 7.** `ResourceScenario.book` continua stub.

---

## 11. ADR 016 (referência rápida)

Criado como subfase 10.0. Conteúdo esperado:

- **Título:** Scoreboard bit encoding em TypeScript
- **Contexto:** `Scoreboard` é genérico; encoding é por convenção espalhada no Ruby.
- **Decisão:**
  - Centralizar constantes em `scoreboard-bits.ts`.
  - Não criar classe nova.
  - Não especializar com `Int32Array` nesta fase.
- **Alternativas:** `enum` com flags, classe `ScoreboardValue`.
- **Consequências:** legibilidade; um ponto de verdade; overhead mínimo.

---

**Fim da Fase 6.**