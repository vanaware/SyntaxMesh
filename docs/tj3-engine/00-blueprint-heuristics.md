# O Motor de Agendamento do TaskJuggler: Time Slots e Algoritmo Heurístico

Vou destrinchar como o coração do TaskJuggler funciona. A base de tudo está documentada no **manual oficial** e no **código-fonte Ruby**, então combinei a explicação conceitual com a implementação real.

---

## 🧩 Por que Time Slots?

O TaskJuggler **não** trabalha com datas contínuas. Ele discretiza o tempo em intervalos fixos chamados **time slots**, porque:

1. **Simplifica a alocação de recursos** — verificar disponibilidade em pontos discretos é mais rápido que calcular intervalos contínuos.
2. **Permite paralelismo controlado** — vários recursos podem ser alocados ao mesmo slot.
3. **Facilita o "placar de recursos"** — cada slot tem um contador de quantos recursos estão livres.

### Granularidade dos Slots

O tamanho do slot é definido pelo atributo `schedulinggranularity` do projeto. Valores válidos:

| Granularidade | Uso típico |
|---|---|
| `60min` | Projetos de longo prazo, pouca precisão |
| `30min` | Padrão razoável |
| `15min` | Equilíbrio precisão/performance |
| `5min` | Projetos curtos e detalhados |
| `1min` | Máxima precisão (muito lento) |

Quanto menor o slot, mais preciso o agendamento — mas o custo computacional cresce **linearmente** com o número de slots. Um projeto de 1 ano com slots de 5min gera ~105.000 slots.

### Como os Slots São Criados

O agendador percorre o intervalo `[project.start, project.end]` e cria um slot para cada intervalo de `schedulinggranularity`. Cada slot conhece:

- **Timestamp de início e fim**
- **Se está dentro do horário de trabalho** (considerando `workinghours`, feriados, férias)
- **Quais recursos estão disponíveis** naquele momento
- **Quais tarefas já estão alocadas**

Isso é definido no código pelos conceitos de `WorkingHours` e `Calendar` (no arquivo `lib/taskjuggler/WorkingHours.rb`).

---

## ⚙️ O Algoritmo Heurístico

O TaskJuggler **não usa programação linear, PERT/CPM puro ou otimização matemática**. Ele usa uma **heurística gananciosa (greedy) com priorização**, porque:

- Projetos reais têm restrições complexas (recursos limitados, dependências, turnos).
- Soluções ótimas são NP-difíceis.
- O usuário quer **um resultado rápido e "bom o suficiente"**, não o ótimo matemático.

### Os 3 Estados de uma Tarefa

Durante o agendamento, cada tarefa passa por estados:

1. **Not Ready** — ainda não pode ser agendada (dependências não resolvidas, recursos indisponíveis, ou está aguardando priorização).
2. **Ready** — todas as dependências resolvidas e recursos potencialmente disponíveis. É candidata a agendamento.
3. **Scheduling Completed** — já tem datas e recursos alocados. Sai da fila.

### O Loop Principal

O algoritmo funciona assim (simplificado):

```
1. Inicializar todos os slots e o ResourceScoreboard
2. Marcar tarefas sem dependências como Ready
3. Enquanto houver tarefas Ready:
   a. Ordenar tarefas Ready por critério de prioridade
   b. Pegar a tarefa de maior prioridade
   c. Tentar alocar recursos e datas para ela
   d. Se conseguir → marcar como Completed
   e. Se não conseguir → deixar em Ready ou marcar como impossível
   f. Atualizar tarefas dependentes (podem virar Ready)
4. Gerar relatórios
```

### Os Critérios de Priorização

A ordenação das tarefas "Ready" usa uma combinação de fatores:

| Critério | Peso | Descrição |
|---|---|---|
| **Priority** | Definido pelo usuário | Atributo `priority` na tarefa (0–1000) |
| **Path Criticalness** | Calculado | Quão crítica é a tarefa para o caminho mais longo do projeto |
| **Start/End constraints** | Definido | Tarefas com `start` ou `end` fixos têm preferência |
| **Dependency depth** | Calculado | Tarefas que "seguram" muitas outras são priorizadas |

O **Path Criticalness** é o conceito mais interessante: o TaskJuggler calcula, para cada tarefa, o comprimento do caminho mais longo até o fim do projeto. Tarefas nesse caminho têm prioridade maior — é uma versão "dinâmica" do CPM clássico.

### O ResourceScoreboard

Cada slot de tempo tem um **placar de recursos**. Quando o agendador tenta alocar uma tarefa:

1. Para cada slot necessário, verifica se há recursos livres do tipo exigido.
2. Se sim, "debita" do placar.
3. Se não, tenta o próximo slot disponível ou falha.

O placar é atualizado a cada alocação. Isso evita que duas tarefas peguem o mesmo recurso no mesmo slot.

### Alocação de Esforço vs. Duração

O TaskJuggler distingue:

- **`duration`** — tempo de calendário que a tarefa ocupa.
- **`effort`** — quantidade de trabalho (em pessoa-dias/horas).
- **`length`** — número de slots que a tarefa ocupa.

Se você define `effort 10d` e aloca 2 recursos, a duração será ~5 dias. O agendador distribui o esforço entre os recursos disponíveis nos slots.

### Tratamento de Conflitos

Quando não há recursos suficientes:

- **`allocation`** pode ter `mandatory` (falha se não alocar) ou `alternative` (tenta outro recurso).
- O agendador pode **atrasar** a tarefa para um slot futuro com recursos livres.
- Pode **dividir** a tarefa em partes (se `scheduling` permitir).

---

## 🔬 Detalhes Avançados

### Scheduler e ResourceScoreboard

No código-fonte Ruby, os arquivos centrais são:

- `lib/taskjuggler/Scheduler.rb` — o loop principal
- `lib/taskjuggler/ResourceScoreboard.rb` — o placar de recursos
- `lib/taskjuggler/TaskScenario.rb` — estado da tarefa durante agendamento
- `lib/taskjuggler/WorkingHours.rb` — cálculo de horários úteis
- `lib/taskjuggler/Booking.rb` — alocação efetiva

### Forward vs. Backward Scheduling

- **Forward** (padrão): parte do início do projeto e agenda para frente.
- **Backward**: parte do fim e agenda para trás (usado quando você fixa `end`).

### Cenários Múltiplos

O TaskJuggler suporta **múltiplos cenários** no mesmo projeto (ex: otimista, pessimista, realista). Cada cenário tem seu próprio agendamento — útil para análise de risco.

---

## 📚 Fontes para Aprofundar

### Documentação Oficial
1. **TaskJuggler Manual — Seção "Scheduling"**  
   https://taskjuggler.org/tj3/manual/index.html  
   A referência definitiva. Procure os capítulos sobre "Scheduling", "Time Slots" e "Resource Allocation".

2. **TaskJuggler Tutorial**  
   https://taskjuggler.org/tj3/tutorial/index.html  
   Mostra o agendador em ação com exemplos práticos.

3. **Referência de Atributos**  
   https://taskjuggler.org/tj3/manual/task.html  
   Detalha `effort`, `duration`, `length`, `scheduling`, `priority`, etc.

### Código-Fonte (Ruby)
4. **Repositório no GitHub**  
   https://github.com/taskjuggler/TaskJuggler  
   Leia `lib/taskjuggler/Scheduler.rb` e `lib/taskjuggler/ResourceScoreboard.rb` — é a verdade última sobre o algoritmo.

5. **Documentação interna do código**  
   O código tem comentários extensos em inglês explicando cada decisão heurística.

### Livros e Artigos
6. **"Project Management with TaskJuggler"** — Chris Schläger (autor do TJ)  
   Explica a filosofia por trás do agendador.

7. **Artigos sobre heurísticas de scheduling de projetos com recursos restritos (RCPSP)**  
   - "Resource-Constrained Project Scheduling: Models, Algorithms, Extensions and Applications" — Artigues, Demassey, Neron  
   - A busca por "RCPSP heuristics" no Google Scholar traz centenas de papers.

8. **Comparação CPM vs. Heurísticas**  
   - "Critical Chain Project Management" — Lawrence Leach  
   - Explica por que CPM puro não funciona com recursos limitados.


### Papers Acadêmicos
12. **"A Survey of Resource-Constrained Project Scheduling"** — Hartmann & Briskorn (2010)  
    Revisão clássica de algoritmos RCPSP.

13. **"Heuristic Algorithms for RCPSP"** — Kolisch & Hartmann  
    Compara heurísticas gulosas, busca local e metaheurísticas.

---

## 💡 Resumo para sua Reescrita em TypeScript

Se você for implementar isso:

1. **Comece com slots de 60min** e um único recurso — valida a lógica básica.
2. **Implemente o ResourceScoreboard** como um `Map<number, ResourceAvailability>` (timestamp → disponibilidade).
3. **Use o Path Criticalness** como critério principal de priorização — é o que dá "inteligência" ao algoritmo.
4. **Trate `effort` vs `duration`** desde o início — é fonte comum de bugs.
5. **Não tente otimizar** — a heurística greedy já produz resultados aceitáveis.

---

# Estrutura de Classes em TypeScript: `Scheduler` e `ResourceScoreboard`

Abaixo está um rascunho completo e comentado. Ele segue os conceitos do Ruby original, mas adaptado para TypeScript idiomático (imutabilidade onde faz sentido, tipos fortes, e `Map` em vez de arrays esparsos).

---

## 📦 Tipos Base

```typescript
// types.ts

/** Granularidade do slot em minutos. */
export type Granularity = 1 | 5 | 10 | 15 | 30 | 60;

/** Timestamp em minutos desde a epoch do projeto (não Unix). */
export type Tick = number;

/** Identificador único de tarefa ou recurso. */
export type TaskId = string;
export type ResourceId = string;

/** Estado de uma tarefa durante o agendamento. */
export enum TaskState {
  NotReady = 'not_ready',
  Ready = 'ready',
  Completed = 'completed',
  Failed = 'failed',
}

/** Modo de agendamento. */
export enum SchedulingMode {
  ASAP = 'asap',       // As Soon As Possible
  ALAP = 'alap',       // As Late As Possible
}

/** Como o esforço é distribuído entre recursos. */
export enum EffortMode {
  /** Todos os recursos trabalham juntos até terminar. */
  Continuous = 'continuous',
  /** Recursos trabalham em turnos (ex: 2 pessoas × 4h). */
  Discrete = 'discrete',
}
```

---

## 🕐 `TimeSlot` e `Calendar`

O `TimeSlot` é a unidade atômica do agendamento. O `Calendar` decide quais slots são "úteis".

```typescript
// TimeSlot.ts

export interface TimeSlot {
  /** Índice do slot (0 = primeiro slot do projeto). */
  readonly index: number;
  /** Timestamp de início em minutos desde a epoch do projeto. */
  readonly start: Tick;
  /** Timestamp de fim em minutos desde a epoch do projeto. */
  readonly end: Tick;
  /** Se o slot está dentro de horário de trabalho. */
  isWorking: boolean;
  /** Recursos disponíveis neste slot (IDs). */
  availableResources: Set<ResourceId>;
}
```

```typescript
// Calendar.ts

import { Granularity, Tick, TimeSlot } from './types';

/**
 * Responsável por gerar a linha do tempo de slots e decidir
 * quais são "úteis" (working hours, feriados, férias).
 *
 * Equivalente Ruby: lib/taskjuggler/WorkingHours.rb + Calendar.rb
 */
export class Calendar {
  private slots: TimeSlot[] = [];

  constructor(
    private readonly projectStart: Date,
    private readonly projectEnd: Date,
    private readonly granularity: Granularity,
    /** Ex: { mon: ['09:00-12:00', '13:00-18:00'], ... } */
    private readonly workingHours: Map<string, string[]>,
    private readonly holidays: Set<string>, // 'YYYY-MM-DD'
  ) {}

  /** Constrói todos os slots do projeto. Chamado uma vez no início. */
  build(): void {
    const granMs = this.granularity * 60_000;
    const startMs = this.projectStart.getTime();
    const endMs = this.projectEnd.getTime();

    let index = 0;
    for (let t = startMs; t < endMs; t += granMs) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + granMs);
      const isWorking = this.isWithinWorkingHours(slotStart, slotEnd);

      this.slots.push({
        index: index++,
        start: Math.floor((t - startMs) / 60_000),
        end: Math.floor((t + granMs - startMs) / 60_000),
        isWorking,
        availableResources: new Set(),
      });
    }
  }

  getSlots(): readonly TimeSlot[] {
    return this.slots;
  }

  getSlot(index: number): TimeSlot | undefined {
    return this.slots[index];
  }

  /** Converte um Date para o índice do slot correspondente. */
  tickToSlotIndex(tick: Tick): number {
    return Math.floor(tick / this.granularity);
  }

  private isWithinWorkingHours(start: Date, end: Date): boolean {
    const dayKey = start.toISOString().slice(0, 10);
    if (this.holidays.has(dayKey)) return false;

    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][start.getDay()];
    const ranges = this.workingHours.get(weekday);
    if (!ranges) return false;

    // Simplificação: assume que o slot inteiro cabe em um range.
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return ranges.some((r) => {
      const [from, to] = r.split('-');
      const [fh, fm] = from.split(':').map(Number);
      const [th, tm] = to.split(':').map(Number);
      return startMin >= fh * 60 + fm && endMin <= th * 60 + tm;
    });
  }
}
```

---

## 📊 `ResourceScoreboard`

O placar rastreia quantos recursos de cada tipo estão livres em cada slot. É a estrutura mais consultada durante o agendamento — por isso precisa ser **rápida**.

```typescript
// ResourceScoreboard.ts

import { ResourceId, Tick, TimeSlot } from './types';

/**
 * Representa uma "reserva" de recurso em um intervalo de slots.
 */
export interface Booking {
  readonly taskId: string;
  readonly resourceId: ResourceId;
  readonly slotIndex: number;
  /** Esforço consumido neste slot (em minutos). */
  readonly effort: number;
}

/**
 * Placar de disponibilidade de recursos por slot.
 *
 * Conceito central: para cada slot e cada recurso, sabemos quanto
 * ainda está livre. O agendador "debita" ao alocar e "credita" ao
 * desalocar (backtracking).
 *
 * Equivalente Ruby: lib/taskjuggler/ResourceScoreboard.rb
 */
export class ResourceScoreboard {
  /**
   * Mapa: slotIndex → (resourceId → minutos disponíveis).
   * Usamos Map (não array) porque a maioria dos slots tem poucos recursos ativos.
   */
  private availability: Map<number, Map<ResourceId, number>> = new Map();

  /**
   * Histórico de bookings, para permitir rollback.
   * Indexado por taskId para desalocação rápida.
   */
  private bookings: Map<string, Booking[]> = new Map();

  constructor(
    private readonly slots: readonly TimeSlot[],
    /** Capacidade máxima de cada recurso por slot (em minutos). */
    private readonly resourceCapacity: Map<ResourceId, number>,
  ) {
    this.initialize();
  }

  /** Inicializa todos os slots com a capacidade total de cada recurso. */
  private initialize(): void {
    for (const slot of this.slots) {
      const slotMap = new Map<ResourceId, number>();
      if (slot.isWorking) {
        for (const [resId, cap] of this.resourceCapacity) {
          slotMap.set(resId, cap);
        }
      }
      this.availability.set(slot.index, slotMap);
    }
  }

  /**
   * Consulta se um recurso tem pelo menos `minutes` livres no slot.
   */
  canBook(slotIndex: number, resourceId: ResourceId, minutes: number): boolean {
    const slotMap = this.availability.get(slotIndex);
    if (!slotMap) return false;
    const free = slotMap.get(resourceId) ?? 0;
    return free >= minutes;
  }

  /**
   * Debita `minutes` do recurso no slot. Retorna false se não houver espaço.
   * NÃO faz rollback automático — o chamador deve usar `release` em caso de falha.
   */
  book(booking: Booking): boolean {
    const { slotIndex, resourceId, effort, taskId } = booking;
    if (!this.canBook(slotIndex, resourceId, effort)) return false;

    const slotMap = this.availability.get(slotIndex)!;
    slotMap.set(resourceId, slotMap.get(resourceId)! - effort);

    // Registra no histórico
    if (!this.bookings.has(taskId)) this.bookings.set(taskId, []);
    this.bookings.get(taskId)!.push(booking);

    return true;
  }

  /**
   * Libera todos os bookings de uma tarefa (rollback).
   * Usado quando o agendador desiste de uma alocação.
   */
  release(taskId: string): void {
    const taskBookings = this.bookings.get(taskId);
    if (!taskBookings) return;

    for (const b of taskBookings) {
      const slotMap = this.availability.get(b.slotIndex);
      if (slotMap) {
        slotMap.set(b.resourceId, (slotMap.get(b.resourceId) ?? 0) + b.effort);
      }
    }
    this.bookings.delete(taskId);
  }

  /**
   * Retorna o primeiro slot a partir de `fromIndex` onde o recurso
   * tem `minutes` disponíveis.
   */
  findFirstAvailable(
    fromIndex: number,
    resourceId: ResourceId,
    minutes: number,
  ): number | null {
    for (let i = fromIndex; i < this.slots.length; i++) {
      if (this.canBook(i, resourceId, minutes)) return i;
    }
    return null;
  }

  /** Snapshot para debug/análise. */
  snapshot(slotIndex: number): ReadonlyMap<ResourceId, number> {
    return this.availability.get(slotIndex) ?? new Map();
  }
}
```

---

## 🧠 `Scheduler`

O orquestrador. Ele mantém a fila de tarefas "Ready", ordena por prioridade e tenta alocar cada uma.

```typescript
// Scheduler.ts

import { Calendar } from './Calendar';
import { ResourceScoreboard, Booking } from './ResourceScoreboard';
import {
  EffortMode,
  SchedulingMode,
  TaskId,
  TaskState,
  Tick,
  TimeSlot,
} from './types';

/** Definição de uma tarefa (vinda do parser). */
export interface TaskDefinition {
  id: TaskId;
  /** Duração em minutos (opcional se `effort` for definido). */
  duration?: number;
  /** Esforço total em minutos (opcional se `duration` for definido). */
  effort?: number;
  /** Tarefas das quais esta depende. */
  depends?: TaskId[];
  /** Recursos alocados (IDs). */
  allocate?: string[];
  /** Prioridade definida pelo usuário (0–1000). */
  priority?: number;
  /** Data de início fixa (tick). */
  startConstraint?: Tick;
  /** Data de fim fixa (tick). */
  endConstraint?: Tick;
  /** Modo de agendamento. */
  scheduling?: SchedulingMode;
  /** Modo de distribuição de esforço. */
  effortMode?: EffortMode;
}

/** Estado mutável de uma tarefa durante o agendamento. */
interface TaskRuntime {
  def: TaskDefinition;
  state: TaskState;
  /** Slot onde a tarefa efetivamente começa. */
  scheduledStart?: number;
  /** Slot onde termina. */
  scheduledEnd?: number;
  /** Recursos efetivamente alocados. */
  assignedResources: string[];
  /** Comprimento do caminho mais longo até o fim (path criticalness). */
  pathCriticalness: number;
}

/**
 * Motor de agendamento heurístico do TaskJuggler.
 *
 * Equivalente Ruby: lib/taskjuggler/Scheduler.rb
 */
export class Scheduler {
  private tasks: Map<TaskId, TaskRuntime> = new Map();
  private readyQueue: TaskId[] = [];

  constructor(
    private readonly calendar: Calendar,
    private readonly scoreboard: ResourceScoreboard,
    private readonly taskDefs: TaskDefinition[],
  ) {
    for (const def of taskDefs) {
      this.tasks.set(def.id, {
        def,
        state: TaskState.NotReady,
        assignedResources: [],
        pathCriticalness: 0,
      });
    }
  }

  /** Ponto de entrada. Executa o loop principal de agendamento. */
  run(): void {
    this.computePathCriticalness();
    this.seedReadyQueue();

    let iterations = 0;
    const maxIterations = this.tasks.size * 100; // guarda contra loop infinito

    while (this.readyQueue.length > 0) {
      if (++iterations > maxIterations) {
        throw new Error('Scheduler: possível loop infinito detectado');
      }

      this.sortReadyQueue();
      const taskId = this.readyQueue.shift()!;
      const task = this.tasks.get(taskId)!;

      const success = this.tryScheduleTask(task);

      if (success) {
        task.state = TaskState.Completed;
        this.unlockDependents(taskId);
      } else {
        task.state = TaskState.Failed;
        // Em produção: registrar warning, tentar fallback (ex: atrasar)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priorização
  // ─────────────────────────────────────────────────────────────

  /**
   * Calcula o "path criticalness": comprimento do caminho mais longo
   * desta tarefa até o fim do projeto. Tarefas com valor alto são
   * priorizadas porque atrasá-las atrasa o projeto inteiro.
   *
   * Implementação: DFS com memoização (ordenação topológica reversa).
   */
  private computePathCriticalness(): void {
    const memo = new Map<TaskId, number>();

    const visit = (id: TaskId): number => {
      if (memo.has(id)) return memo.get(id)!;
      const task = this.tasks.get(id)!;
      const duration = this.estimateDuration(task.def);

      let maxChild = 0;
      for (const other of this.tasks.values()) {
        if (other.def.depends?.includes(id)) {
          maxChild = Math.max(maxChild, visit(other.def.id));
        }
      }

      const value = duration + maxChild;
      memo.set(id, value);
      return value;
    };

    for (const id of this.tasks.keys()) {
      this.tasks.get(id)!.pathCriticalness = visit(id);
    }
  }

  /**
   * Ordena a fila de tarefas Ready por:
   *   1. priority (usuário) — decrescente
   *   2. pathCriticalness — decrescente
   *   3. startConstraint — crescente (tarefas com data fixa primeiro)
   */
  private sortReadyQueue(): void {
    this.readyQueue.sort((aId, bId) => {
      const a = this.tasks.get(aId)!;
      const b = this.tasks.get(bId)!;

      const pa = a.def.priority ?? 0;
      const pb = b.def.priority ?? 0;
      if (pa !== pb) return pb - pa;

      if (a.pathCriticalness !== b.pathCriticalness) {
        return b.pathCriticalness - a.pathCriticalness;
      }

      const sa = a.def.startConstraint ?? Infinity;
      const sb = b.def.startConstraint ?? Infinity;
      return sa - sb;
    });
  }

  /** Marca como Ready todas as tarefas sem dependências. */
  private seedReadyQueue(): void {
    for (const task of this.tasks.values()) {
      if (!task.def.depends || task.def.depends.length === 0) {
        task.state = TaskState.Ready;
        this.readyQueue.push(task.def.id);
      }
    }
  }

  /** Após concluir uma tarefa, verifica quais dependentes ficaram prontos. */
  private unlockDependents(completedId: TaskId): void {
    for (const task of this.tasks.values()) {
      if (task.state !== TaskState.NotReady) continue;
      if (!task.def.depends?.includes(completedId)) continue;

      const allDone = task.def.depends.every(
        (dep) => this.tasks.get(dep)?.state === TaskState.Completed,
      );

      if (allDone) {
        task.state = TaskState.Ready;
        this.readyQueue.push(task.def.id);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Alocação
  // ─────────────────────────────────────────────────────────────

  /**
   * Tenta agendar uma tarefa. Retorna true se conseguiu alocar todos
   * os recursos necessários em slots contíguos.
   *
   * Estratégia:
   *   1. Determinar o slot inicial (ASAP ou ALAP).
   *   2. Para cada recurso necessário, encontrar slots livres.
   *   3. Se todos os recursos couberem, efetivar os bookings.
   *   4. Se algum falhar, fazer rollback de todos.
   */
  private tryScheduleTask(task: TaskRuntime): boolean {
    const { def } = task;
    const requiredResources = def.allocate ?? [];
    if (requiredResources.length === 0) {
      // Tarefa sem recursos: apenas marca datas.
      task.scheduledStart = def.startConstraint ?? 0;
      task.scheduledEnd = task.scheduledStart + this.estimateDuration(def);
      return true;
    }

    const durationSlots = Math.ceil(
      this.estimateDuration(def) / this.calendar.getSlots()[1].start,
    );

    const startSlot = this.findStartSlot(task, durationSlots);
    if (startSlot === null) return false;

    // Tenta alocar cada recurso
    const stagedBookings: Booking[] = [];
    for (const resId of requiredResources) {
      const success = this.stageResource(
        task,
        resId,
        startSlot,
        durationSlots,
        stagedBookings,
      );
      if (!success) {
        // Rollback parcial
        this.rollbackStaged(stagedBookings);
        return false;
      }
    }

    // Efetiva todos os bookings
    for (const b of stagedBookings) {
      this.scoreboard.book(b);
    }

    task.scheduledStart = startSlot;
    task.scheduledEnd = startSlot + durationSlots;
    task.assignedResources = [...requiredResources];
    return true;
  }

  /** Encontra o slot inicial conforme o modo (ASAP/ALAP/constraint). */
  private findStartSlot(task: TaskRuntime, durationSlots: number): number | null {
    const { def } = task;

    if (def.startConstraint !== undefined) {
      return this.calendar.tickToSlotIndex(def.startConstraint);
    }

    // Maior slot de término entre as dependências
    let earliest = 0;
    for (const depId of def.depends ?? []) {
      const dep = this.tasks.get(depId);
      if (dep?.scheduledEnd !== undefined) {
        earliest = Math.max(earliest, dep.scheduledEnd);
      }
    }

    return earliest;
  }

  /**
   * Tenta reservar UM recurso em `durationSlots` slots contíguos.
   * Acumula os bookings em `staged` para rollback posterior.
   */
  private stageResource(
    task: TaskRuntime,
    resourceId: string,
    startSlot: number,
    durationSlots: number,
    staged: Booking[],
  ): boolean {
    const slots = this.calendar.getSlots();
    const minutesPerSlot = slots[1].start - slots[0].start;

    for (let i = 0; i < durationSlots; i++) {
      const slotIndex = startSlot + i;
      const slot = slots[slotIndex];
      if (!slot || !slot.isWorking) continue;

      const minutes = minutesPerSlot; // simplificação: 100% do slot
      if (!this.scoreboard.canBook(slotIndex, resourceId, minutes)) {
        return false;
      }

      staged.push({
        taskId: task.def.id,
        resourceId,
        slotIndex,
        effort: minutes,
      });
    }
    return true;
  }

  private rollbackStaged(staged: Booking[]): void {
    // Nada foi efetivado ainda — apenas limpa o array.
    staged.length = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Estima a duração em minutos.
   * Se `duration` existe, usa diretamente.
   * Se `effort` existe, divide pelo número de recursos.
   */
  private estimateDuration(def: TaskDefinition): number {
    if (def.duration !== undefined) return def.duration;
    if (def.effort !== undefined) {
      const n = def.allocate?.length ?? 1;
      return def.effort / n;
    }
    return 0;
  }
}
```

---

## 🚀 Exemplo de Uso

```typescript
// main.ts

import { Calendar } from './Calendar';
import { ResourceScoreboard } from './ResourceScoreboard';
import { Scheduler, TaskDefinition } from './Scheduler';

const projectStart = new Date('2025-01-06T09:00:00');
const projectEnd = new Date('2025-03-31T18:00:00');

const workingHours = new Map([
  ['mon', ['09:00-12:00', '13:00-18:00']],
  ['tue', ['09:00-12:00', '13:00-18:00']],
  ['wed', ['09:00-12:00', '13:00-18:00']],
  ['thu', ['09:00-12:00', '13:00-18:00']],
  ['fri', ['09:00-12:00', '13:00-18:00']],
]);

const calendar = new Calendar(projectStart, projectEnd, 60, workingHours, new Set());
calendar.build();

const resourceCapacity = new Map([
  ['alice', 60 * 8],
  ['bob', 60 * 8],
]);

const scoreboard = new ResourceScoreboard(calendar.getSlots(), resourceCapacity);

const tasks: TaskDefinition[] = [
  {
    id: 'design',
    effort: 60 * 16, // 2 dias
    allocate: ['alice'],
    priority: 100,
  },
  {
    id: 'implement',
    effort: 60 * 40, // 5 dias
    allocate: ['alice', 'bob'],
    depends: ['design'],
    priority: 100,
  },
  {
    id: 'test',
    effort: 60 * 16,
    allocate: ['bob'],
    depends: ['implement'],
  },
];

const scheduler = new Scheduler(calendar, scoreboard, tasks);
scheduler.run();

console.log('Agendamento concluído.');
```

---

## ⚠️ Limitações Deste Rascunho

1. **`EffortMode.Discrete`** não implementado — assume-se `Continuous`.
2. **Backward scheduling (ALAP)** — só o modo ASAP está completo.
3. **Múltiplos cenários** — omitidos para simplificar.
4. **Turnos complexos** (`shift`, `booking`) — o `Calendar` só lida com horários semanais simples.
5. **`allocate` com `alternative`** — só aceita recursos fixos.
6. **Feriados e férias** — o `Set` de holidays é simplificado.
7. **Otimização** — `findFirstAvailable` é O(n), poderia usar uma árvore de intervalos.

---

## 🔧 Próximos Passos Sugeridos

1. **Testes unitários** para `ResourceScoreboard` — é onde bugs de alocação se escondem.
2. **Implementar `effortMode: Discrete`** — distribui esforço em turnos.
3. **Adicionar backtracking** — se uma tarefa falha, tentar movê-la para frente.
4. **Parser de `.tjp`** — sem isso, você só tem a API interna.
5. **Relatórios** — exportar para CSV/HTML usando os dados dos bookings.

Se quiser, posso detalhar alguma parte específica (ex: o `Calendar` com suporte a feriados complexos, ou o parser do `.tjp`). É só pedir.