# ADR 018 — Heurística do scheduler

> **Status:** ✅ Concluído
> **Data:** 2026-10-05
> **Autores:** Qwen Code

## Resumo

Documenta o algoritmo greedy de scheduling do TaskJuggler como decisão de arquitetura. O algoritmo é baseado em slots, processa tarefas "Ready" em ordem de prioridade, agenda slot-a-slot e propaga datas para dependentes.

## Contexto

O algoritmo de scheduling do TaskJuggler é **heurístico greedy** com priorização dinâmica:

1. **Processa tarefas "Ready"** em ordem de `priority` + `pathcriticalness` + `seqno`.
2. **Para cada tarefa**, agenda slot-a-slot (`currentSlotIdx` avança).
3. **Em cada slot**, tenta alocar todos os recursos necessários (`bookResources`).
4. **Propaga datas** para dependentes (`propagateDate`).
5. **Detecta loops** (`checkForLoops`).

**Por que esta decisão:**
- **Fiel ao Ruby:** replica o algoritmo original sem atalhos.
- **Determinístico:** sem aleatoriedade, essencial para testes.
- **Slot-a-slot:** garante consistência com o modelo de tempo do TaskJuggler.
- **Heurística:** balanceia completude vs. criticidade.

## Problema

- O algoritmo está espalhado em comentários em `TaskScenario.rb`, `ResourceScenario.rb`, `Allocation.rb`.
- Não há documentação formal; mudanças podem quebrar a compatibilidade.
- Os helpers para leitura/escrita de bits estão dispersos.

## Solução

Centralizar as convenções em um único ADR e um módulo TypeScript (`scheduler-heuristics.ts`) com constantes e funções puras.

## Decisão

- **Documentar o algoritmo completo** em um único ADR.
- **Centralizar as constantes** em `scheduler-heuristics.ts`.
- **Fornecer funções de leitura/escrita de bits** (`isAssigned`, `isWorkingTime`, `isOnLeave`, etc.).
- **Não especializar** `Scoreboard` com `Int32Array` nesta fase; otimizações futuras podem adicionar um `Scoreboard<number>` especializado.

## Algoritmo completo (documentado)

### Loop principal (TaskScenario.schedule)

```ts
for (each task in readyTasks sorted by priority + pathcriticalness + seqno) {
  // 1. Agendar tarefa (slot-a-slot)
  schedule(task);
  // 2. Para cada slot da tarefa
  for (slotIdx = task.currentSlotIdx; slotIdx < task.slotCount; slotIdx++) {
    // 3. Tentar alocar recursos
    bookResources(task, slotIdx);
    // 4. Propagar datas para dependentes
    propagateDate(task, slotIdx);
  }
}
```

### bookResources ordem (CRÍTICA)

```ts
for (each resource in task.requiredResources) {
  bookResource(task, resource, slotIdx);
}
```

### bookResource (Allocation)

```ts
for (each mode in Allocation.modes) {
  if (mode.check(resource, task, slotIdx)) {
    allocate(resource, task, slotIdx);
    break;
  }
}
```

### propagateDate (shrink-only)

```ts
for (each dependent in task.followers) {
  if (dependent.earliestStart > task.latestEnd) {
    dependent.earliestStart = task.latestEnd;
    propagateDate(dependent);
  }
}
```

### checkForLoops (DFS com deadEndFlags)

```ts
function checkForLoops(task, visited, deadEndFlags) {
  if (deadEndFlags.has(task)) return true;
  if (visited.has(task)) return false;
  visited.add(task);
  for (each follower in task.followers) {
    if (checkForLoops(follower, visited, deadEndFlags)) return true;
  }
  deadEndFlags.add(task);
  return false;
}
```

### calcPathCriticalness (memoização)

```ts
function calcPathCriticalness(task) {
  if (task.pathcriticalness !== null) return task.pathcriticalness;
  // computar via DFS de seguidores
  // pathcriticalness = max(follower.pathcriticalness) + task.duration
  return task.pathcriticalness;
}
```

## Decisão

### 7.1 Algoritmo greedy de scheduling: não é uma classe, é uma convenção

O `TaskScenario.rb` **não tem** método de scheduling. O usuário (TaskScenario, ResourceScenario, Allocation) é quem interpreta os bits. Cada um tem sua própria convenção.

**Decisão:** centralizar as constantes e helpers em `packages/core/src/scheduling/scheduler-heuristics.ts`. Nenhuma classe nova. Apenas:

```ts
export const PRIORITY_HIGH = 1;
export const PRIORITY_NORMAL = 2;
export const PRIORITY_LOW = 3;

export const PATHCRITICALNESS_NONE = 0;
export const PATHCRITICALNESS_NORMAL = 1;
export const PATHCRITICALNESS_HIGH = 2;

export function isReady(task): boolean;
export function isScheduled(task): boolean;
export function isCompleted(task): boolean;
export function getSlotStart(task, slotIdx): TjTime;
export function getSlotEnd(task, slotIdx): TjTime;
```

**Justificativa:** documenta as convenções em um único lugar; evita magic numbers espalhados.

### 7.2 Scoreboard numérico especializado?

Ruby usa `Array` genérico. TS poderia usar `Int32Array` para scoreboards numéricos. **Decisão:** **não** especializar nesta fase. `Scoreboard<number>` com `number[]` é suficiente. Otimização fica para depois se performance exigir.

### 7.3 `TaskDependency` é um wrapper para `Task.followers`

Ruby: `TaskDependency` é um wrapper para `Task.followers` (dependências de precedência). **Decisão:** em TS, usar `Task.followers` diretamente; `TaskDependency` é um helper para leitura/escrita.

### 7.4 `Allocation` é um enumerador de modos de seleção

Ruby: `Allocation` é um enumerador de modos de seleção (`mode: 'resource', 'responsible', 'responsible-resource', 'resource-type', 'resource-type-responsible'`). **Decisão:** em TS, usar `AllocationMode` enum + `AllocationStrategy` interface.

### 7.5 `Booking` é um wrapper para `Resource.booking`

Ruby: `Booking` é um wrapper para `Resource.booking` (trabalho manualmente registrado). **Decisão:** em TS, usar `Resource.booking` diretamente; `Booking` é um helper para leitura/escrita.

### 7.6 `DataCache` é singleton com cacheTag explícito

Ruby: `DataCache` é um singleton com cacheTag explícito. **Decisão:** em TS, usar `WeakMap<object, number>` + contador global.

### 7.7 `treeSum` precisa de cacheTag explícito

Ruby: `treeSum` precisa de cacheTag explícito — não confiar em `caller`. **Decisão:** em TS, exigir `cacheTag` explícito em `treeSum`.

### 7.8 `propagateDate` é shrink-only

Ruby: `propagateDate` é shrink-only — nunca expandir. **Decisão:** em TS, implementar `propagateDate` como shrink-only.

### 7.9 `initScoreboard` é chamado 1× por `ResourceScenario`

Ruby: `initScoreboard` é chamado 1× por `ResourceScenario`. **Decisão:** em TS, garantir que `initScoreboard` é chamado 1×.

### 7.10 `bookedTask` retorna `Task | null`

Ruby: `bookedTask` retorna `Task | null`. **Decisão:** em TS, implementar `bookedTask` retornando `Task | null`.

### 7.11 `Scoreboard<number | Task | null>` para scoreboard de `ResourceScenario`

Ruby: `Scoreboard` de `ResourceScenario` armazena `Task` (alocado) ou `null` (livre). **Decisão:** em TS, usar `Scoreboard<Task | null>`.

## Consequências

- **Legibilidade:** um único ponto de verdade para o algoritmo.
- **Manutenção:** mudanças no algoritmo requerem apenas uma atualização.
- **Testes:** golden tests contra Ruby garantem compatibilidade.

## Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — algoritmo principal.
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — `initScoreboard`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §3.3 Algoritmo principal `schedule()`.
- `docs/tj3-engine/00-blueprint-heuristics.md` — §1-2 Time slots + greedy.

## Fora de escopo

- Implementação — subfases 7.1+.

## Critério de aceite

- ADR 018 criado com algoritmo completo.
- Tabela em `docs/syntaxmesh/decisoes/README.md` atualizada.

---

## Tabela de decisões

| Decisão | Justificativa |
|---|---|
| Centralizar algoritmo em `scheduler-heuristics.ts` | Evita magic numbers, um único ponto de verdade |
| Não especializar `Scoreboard` com `Int32Array` | Otimização futura; suficiente por enquanto |
| `TaskDependency` é um wrapper para `Task.followers` | Simpler, mais direto |
| `Allocation` é um enumerador de modos de seleção | Análogo ao Ruby |
| `Booking` é um wrapper para `Resource.booking` | Análogo ao Ruby |
| `DataCache` é singleton com cacheTag explícito | Análogo ao Ruby; mais seguro |
| `treeSum` precisa de cacheTag explícito | Evita bugs de caller |
| `propagateDate` é shrink-only | Análogo ao Ruby |
| `initScoreboard` é chamado 1× | Garantir consistência |
| `bookedTask` retorna `Task | null` | Análogo ao Ruby |
| `Scoreboard<Task | null>` para `ResourceScenario` | Análogo ao Ruby |

---

## Histórico

- **2026-10-05:** criado como parte da Fase 7.