# 📘 Blueprint Fase 5: Completando o Scheduler

## 🎯 Objetivo
Analisar os 5 arquivos que completam o algoritmo de agendamento: **Allocation**, **Limits**, **ShiftAssignments**, **Booking** e **TaskDependency**. Estes são os componentes que faltavam para entender completamente como o TaskJuggler aloca recursos, respeita restrições e processa dependências.

---

## 🏗️ 1. VISÃO GERAL DO PIPELINE ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    TaskScenario.schedule()                       │
│  └── scheduleSlot()                                             │
│      └── bookResources()                                        │
│          ├── Verifica: anyResourceAvailable?()                  │
│          ├── Verifica: limitsOk?()         ◄── Limits.rb        │
│          ├── Verifica: shifts.assigned?()  ◄── ShiftAssignments │
│          ├── Processa: mandatories         ◄── Allocation.rb    │
│          └── Para cada allocation:                              │
│              ├── candidates()              ◄── Allocation.rb    │
│              └── bookResource()            ◄── ResourceScenario │
│                  └── resource.book()                            │
│                      └── Scoreboard[idx] = task                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              TaskDependency (Grafo de Dependências)              │
│  └── resolve() → converte taskId em referência Task             │
│  └── 4 listas: startpreds, startsuccs, endpreds, endsuccs       │
│  └── gapDuration (calendar time) + gapLength (working time)     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Booking (Trabalho Manual Registrado)                │
│  └── resource, task, intervals                                  │
│  └── overtime (0, 1, 2) + sloppy (0, 1, 2)                      │
│  └── Processado em TaskScenario.bookBookings()                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. ALLOCATION.RB — A Ponte entre Tasks e Resources

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Lista de candidatos** | Armazena recursos alternativos para uma alocação |
| **Modo de seleção** | Controla a ordem em que candidatos são testados |
| **Persistência** | Trava um recurso após primeira escolha (opcional) |
| **Mandatoriedade** | Força todos os recursos mandatórios disponíveis |
| **Restrições temporais** | Shifts limitam quando a alocação pode ocorrer |

### 2.2 Estrutura Interna

```typescript
class Allocation {
  @candidates: Resource[];              // Recursos alternativos
  @selectionMode: SelectionMode;        // 0-4 (ver abaixo)
  @persistent: boolean;                 // Trava recurso após primeira escolha
  @mandatory: boolean;                  // Todos mandatórios devem estar disponíveis
  @atomic: boolean;                     // Se falhar, faz rollback
  @shifts: ShiftAssignments | null;     // Restrição temporal
  @lockedResource: Resource | null;     // Recurso travado (persistent)
  @staticCandidates: Resource[] | null; // Cache para seleção estática
  
  constructor(candidates: Resource[], selectionMode = 1, 
              persistent = false, mandatory = false, atomic = false);
}
```

### 2.3 Modos de Seleção (CRÍTICO!)

```typescript
enum SelectionMode {
  ORDER = 0,         // Primeira disponível na ordem da lista
  MINALLOCATED = 1,  // Menor probabilidade de alocação (default)
  MINLOADED = 2,     // Menor esforço total alocado
  MAXLOADED = 3,     // Maior esforço total alocado
  RANDOM = 4         // Aleatório
}
```

**Lógica de cada modo:**

```typescript
candidates(scenarioIdx?: number): Resource[] {
  // Modo 0: ordem de declaração
  if (this.selectionMode === 0 || !scenarioIdx) {
    return this.candidates;
  }
  
  // Modo 4: aleatório
  if (this.selectionMode === 4) {
    const hash = new Map<number, Resource>();
    for (const c of this.candidates) {
      hash.set(Math.random(), c);
    }
    return Array.from(hash.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);
  }
  
  // Modos 1, 2, 3: ordenação por métrica
  const sorted = [...this.candidates].sort((x, y) => {
    switch (this.selectionMode) {
      case 1: // MINALLOCATED
        if (this.persistent) {
          // Heurística sofisticada para persistent
          const cmp = x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
          if (cmp !== 0) return cmp;
          return x.get('criticalness', scenarioIdx) - y.get('criticalness', scenarioIdx);
        }
        return x.get('criticalness', scenarioIdx) - y.get('criticalness', scenarioIdx);
        
      case 2: // MINLOADED
        return x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
        
      case 3: // MAXLOADED
        return y.bookedEffort(scenarioIdx) - x.bookedEffort(scenarioIdx);
    }
  });
  
  // Cache para modo 1 não-persistent
  if (this.selectionMode === 1 && !this.persistent) {
    this.staticCandidates = sorted;
  }
  
  return sorted;
}
```

### 2.4 Verificação de Shift

```typescript
onShift?(sbIdx: number): boolean {
  if (this.shifts) {
    return this.shifts.onShift?(sbIdx);
  }
  return true;  // Sem shifts = sempre disponível
}
```

### 2.5 Persistência (Armadilha!)

```typescript
// No TaskScenario.bookResources():
const locked = allocation.lockedResource;
if (locked) {
  // Tenta usar o recurso travado
  if (this.bookResource(locked)) {
    continue;  // Sucesso, continua
  }
  
  // Recurso travado não disponível
  if (allocation.atomic && locked.bookedTask(scenarioIdx, sbIdx)) {
    this.rollbackBookings();  // Rollback completo
    return;
  }
  
  // Verifica se o recurso ainda existe no projeto
  if (this.forward && sbIdx < locked.getMaxSlot(scenarioIdx)) {
    continue;  // Ainda não chegou no slot do recurso
  }
  if (!this.forward && sbIdx > locked.getMinSlot(scenarioIdx)) {
    continue;
  }
  
  // Persistência quebrada!
  warning('broken_persistence', 
    `Persistence broken for Task ${this.property.fullId} ` +
    `- resource ${locked.name} is gone`);
  allocation.lockedResource = null;
}

// Tenta cada candidato
for (const candidate of allocation.candidates(scenarioIdx)) {
  if (this.bookResource(candidate)) {
    if (allocation.persistent) {
      allocation.lockedResource = candidate;  // Trava!
    }
    break;
  }
}
```

### 2.6 Mandatoriedade

```typescript
// No TaskScenario.bookResources():
const takenMandatories: Resource[] = [];
for (const allocation of this.mandatories) {
  if (!allocation.onShift?(sbIdx)) return;  // Aborta slot
  
  let found = false;
  for (const candidate of allocation.candidates(scenarioIdx)) {
    let allAvailable = true;
    for (const resource of candidate.allLeaves) {
      if (!this.limitsOk?(sbIdx, resource) ||
          !resource.available?(scenarioIdx, sbIdx) ||
          takenMandatories.includes(resource)) {
        allAvailable = false;
        break;
      }
      takenMandatories.push(resource);
    }
    if (allAvailable) {
      found = true;
      break;
    }
  }
  
  if (!found) return;  // Mandatório não disponível → aborta slot
}
```

---

## 📊 3. LIMITS.RB — Restrições de Alocação

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Limites temporais** | dailymax, weeklymax, monthlymax, maximum |
| **Limites mínimos** | dailymin, weeklymin, monthlymin, minimum |
| **Limites por recurso** | Restringe alocação de recurso específico |
| **Contadores por período** | Scoreboard com contadores por dia/semana/mês |

### 3.2 Estrutura Interna

```typescript
class Limits {
  @project: Project;
  @limits: Limit[];
  
  setLimit(name: string, value: number, interval?: ScoreboardInterval, 
           resource?: Resource): void;
  ok?(sbIdx?: number, upper?: boolean, resource?: Resource): boolean;
  inc(sbIdx: number, resource?: Resource): void;
  dec(sbIdx: number, resource?: Resource): void;
  reset(): void;
}

class Limit {
  @name: string;              // 'dailymax', 'weeklymax', etc.
  @interval: ScoreboardInterval;
  @period: number;            // Duração do período em segundos
  @value: number;             // Valor do limite
  @upper: boolean;            // true = máximo, false = mínimo
  @resource: Resource | null; // null = todos recursos
  @scoreboard: Scoreboard;    // Contadores por período
  @dirty: boolean;            // Flag para lazy reset
  
  constructor(name: string, interval: ScoreboardInterval, period: number,
              value: number, upper: boolean, resource: Resource | null);
}
```

### 3.3 Tipos de Limites

```typescript
// No Limits.setLimit():
switch (name) {
  case 'dailymax':
  case 'dailymin':
    period = 60 * 60 * 24;  // 1 dia
    upper = name === 'dailymax';
    break;
    
  case 'weeklymax':
  case 'weeklymin':
    iv.start = iv.startDate.beginOfWeek(project['weekStartsMonday']);
    iv.end = iv.endDate.beginOfWeek(project['weekStartsMonday']);
    period = 60 * 60 * 24 * 7;  // 1 semana
    upper = name === 'weeklymax';
    break;
    
  case 'monthlymax':
  case 'monthlymin':
    iv.start = iv.startDate.beginOfMonth;
    iv.end = iv.endDate.beginOfMonth;
    period = 60 * 60 * 24 * 30;  // 30 dias (aproximação!)
    upper = name === 'monthlymax';
    break;
    
  case 'maximum':
  case 'minimum':
    period = iv.duration;  // Duração do intervalo
    upper = name === 'maximum';
    break;
}
```

### 3.4 Conversão de Índices (CRÍTICO!)

```typescript
// O scoreboard do Limit tem granularidade diferente do projeto!
private idxToSbIdx(index: number): number {
  return (index - this.interval.start) * this.interval.slotDuration / this.period;
}

// Exemplo:
// Projeto: granularity = 3600s (1h)
// Limit: period = 86400s (1 dia)
// index = 24 (24h desde início do projeto)
// idxToSbIdx(24) = (24 - 0) * 3600 / 86400 = 1 (segundo dia)
```

### 3.5 Verificação de Limites

```typescript
ok?(index?: number, upper?: boolean, resource?: Resource): boolean {
  // Se upper não bate, ignora
  if (this.upper !== upper) return true;
  
  // Se resource não bate, ignora
  if (this.resource && this.resource !== resource) return true;
  
  if (index === null || index === undefined) {
    // Verifica todos os contadores
    for (const i of this.scoreboard) {
      if (this.upper ? i >= this.value : i < this.value) {
        return false;
      }
    }
    return true;
  } else {
    // Verifica contador específico
    if (!this.interval.contains?(index)) return true;
    const sbVal = this.scoreboard[this.idxToSbIdx(index)];
    return this.upper ? (sbVal < this.value) : (sbVal >= this.value);
  }
}
```

### 3.6 Incremento/Decremento

```typescript
inc(index: number, resource?: Resource): void {
  if (this.interval.contains?(index) &&
      (this.resource === null || this.resource === resource)) {
    this.dirty = true;
    this.scoreboard[this.idxToSbIdx(index)] += 1;
  }
}

dec(index: number, resource?: Resource): void {
  if (this.interval.contains?(index) &&
      (this.resource === null || this.resource === resource)) {
    this.dirty = true;
    this.scoreboard[this.idxToSbIdx(index)] -= 1;
  }
}
```

### 3.7 Integração com TaskScenario

```typescript
// No TaskScenario:
@allLimits: Limits[];  // Limites da task + limites dos pais

prepareScheduling(): void {
  this.allLimits = [];
  let task: Task | null = this.property;
  
  // Reseta contadores dos limites da task
  if (task.get('limits', scenarioIdx)) {
    task.get('limits', scenarioIdx).reset();
  }
  
  // Coleta limites da task e todos os pais
  while (task) {
    if (task.get('limits', scenarioIdx)) {
      this.allLimits.push(task.get('limits', scenarioIdx));
    }
    task = task.parent;
  }
}

limitsOk?(sbIdx: number, resource?: Resource): boolean {
  for (const limit of this.allLimits) {
    if (!limit.ok?(sbIdx, true, resource)) return false;
  }
  return true;
}

incLimits(sbIdx: number, resource?: Resource): void {
  for (const limit of this.allLimits) {
    limit.inc(sbIdx, resource);
  }
}
```

### 3.8 Integração com ResourceScenario

```typescript
// No ResourceScenario.book():
book(sbIdx: number, task: Task, force = false): boolean {
  if (!force && !this.available?(sbIdx)) return false;
  
  this.scoreboard[sbIdx] = task;
  this.effort += this.efficiency;
  
  // Incrementa limites do recurso
  if (this.limits) {
    this.limits.inc(sbIdx);
  }
  
  // Incrementa limites da task (passando o recurso!)
  task.incLimits(scenarioIdx, sbIdx, this.property);
  
  return true;
}
```

---

## 🔄 4. SHIFTASSIGNMENTS.RB — Controle Temporal de Shifts

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Lista de atribuições** | Shift + intervalo de tempo |
| **Scoreboard cacheado** | Evita recálculo de onShift/onLeave |
| **Compartilhamento** | Scoreboards idênticos são compartilhados |
| **Modo replace** | Shift substitui leaves globais |

### 4.2 Estrutura Interna

```typescript
class ShiftAssignments extends Monitor {
  @project: Project;
  @assignments: ShiftAssignment[];  // Ordenados por intervalo
  @scoreboard: Scoreboard | null;   // Cache
  @hashKey: string | null;          // Para compartilhamento
  
  static @@scoreboards: Map<string, [number[], Scoreboard]>;
  
  addAssignment(assignment: ShiftAssignment): boolean;
  getSbSlot(idx: number): number;
  assigned?(idx: number): boolean;
  onShift?(idx: number): boolean;
  timeOff?(idx: number): boolean;
  onLeave?(idx: number): boolean;
}

class ShiftAssignment {
  @shiftScenario: ShiftScenario;
  @interval: TimeInterval;
  
  assigned?(date: TjTime): boolean;
  onShift?(date: TjTime): boolean;
  onLeave?(date: TjTime): boolean;
  replace?(date: TjTime): boolean;
}
```

### 4.3 Encoding do Scoreboard (CRÍTICO!)

```typescript
// Bits do Scoreboard:
// Bit 0:      0 = sem atribuição | 1 = tem atribuição
// Bit 1:      0 = work time | 1 = no work time
// Bit 2-5:    Tipo de leave (0-15)
//   0 = none
//   1 = holiday
//   2 = annual
//   3 = special
//   4 = sick
//   5 = unpaid
//   6 = blocked (other project)
// Bit 6-7:    Reservado
// Bit 8:      0 = no override | 1 = override global

// Exemplos:
// 0b000000001 = 1  → atribuído, work time, sem leave
// 0b000000010 = 2  → atribuído, no work time
// 0b000001001 = 9  → atribuído, work time, holiday
// 0b100000001 = 257 → atribuído, work time, override global
```

### 4.4 Cálculo Lazy do Scoreboard

```typescript
getSbSlot(idx: number): number {
  // Retorna valor cacheado se disponível
  if (this.scoreboard[idx] !== null) {
    return this.scoreboard[idx];
  }
  
  const date = this.scoreboard.idxToDate(idx);
  
  // Calcula valor para este slot
  for (const sa of this.assignments) {
    if (!sa.assigned?(date)) continue;
    
    // Marca como atribuído
    this.scoreboard[idx] = 1;
    
    // Bit 1: no work time
    if (!sa.onShift?(date)) {
      this.scoreboard[idx] |= 1 << 1;
    }
    
    // Bits 2-5: leave
    if (sa.onLeave?(date)) {
      this.scoreboard[idx] |= 1 << 3;  // Simplificado!
    }
    
    // Bit 8: override global
    if (sa.replace?(date)) {
      this.scoreboard[idx] |= 1 << 8;
    }
    
    return this.scoreboard[idx];
  }
  
  // Slot não coberto por nenhuma atribuição
  this.scoreboard[idx] = 0;
  return 0;
}
```

### 4.5 Compartilhamento de Scoreboards

```typescript
private newScoreboard(): Scoreboard {
  const key = this.hashKey();
  
  // Verifica se já existe scoreboard idêntico
  const record = ShiftAssignments.scoreboards.get(key);
  if (record) {
    // Reutiliza scoreboard existente
    record[0].push(this.objectId);
    return record[1];
  }
  
  // Cria novo scoreboard
  const newSb = new Scoreboard(
    this.project.get('start'),
    this.project.get('end'),
    this.project.get('scheduleGranularity')
  );
  
  // Registra no cache
  ShiftAssignments.scoreboards.set(key, [[this.objectId], newSb]);
  
  return newSb;
}

private hashKey(): string {
  if (this.hashKey) return this.hashKey;
  
  this.hashKey = `${this.project.objectId}|`;
  this.assignments.sort((a, b) => a.interval.start - b.interval.start);
  for (const a of this.assignments) {
    this.hashKey += a.hashKey() + '||';
  }
  
  return this.hashKey;
}

// Finalizer para limpar cache quando objeto é destruído
static deleteScoreboard(objId: number): void {
  for (const [key, record] of ShiftAssignments.scoreboards) {
    if (record[0].includes(objId)) {
      record[0] = record[0].filter(id => id !== objId);
      break;
    }
  }
  
  // Remove registros vazios
  for (const [key, record] of ShiftAssignments.scoreboards) {
    if (record[0].length === 0) {
      ShiftAssignments.scoreboards.delete(key);
    }
  }
}
```

### 4.6 Verificação de Sobreposição

```typescript
addAssignment(shiftAssignment: ShiftAssignment): boolean {
  // Verifica sobreposição
  if (this.overlaps?(shiftAssignment.interval)) {
    return false;
  }
  
  this.assignments.push(shiftAssignment);
  this.scoreboard = this.newScoreboard();  // Invalida cache!
  return true;
}

private overlaps?(iv: TimeInterval): boolean {
  for (const sa of this.assignments) {
    if (sa.overlaps?(iv)) return true;
  }
  return false;
}
```

### 4.7 Integração com ResourceScenario

```typescript
// No ResourceScenario.initScoreboard():
if (this.shifts) {
  for (let i = 0; i < this.project.scoreboardSize; i++) {
    const v = this.shifts.getSbSlot(i);
    
    // Verifica se shift está atribuído
    if ((v & 1) === 0) continue;
    
    if ((v & (1 << 8)) !== 0) {
      // Modo replace: substitui leaves globais
      this.scoreboard[i] = ((v & 0x3E) === 0) ? null : (v & 0x3D);
    } else if ((this.scoreboard[i] === null || 
                (this.scoreboard[i] & 0x3C) < (v & 0x3C)) &&
               (v & 0x3C) !== 0) {
      // Modo merge: apenas leaves com tipo maior
      this.scoreboard[i] = v & 0x3E;
    }
  }
}
```

---

## 📝 5. BOOKING.RB — Registro de Trabalho Manual

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Registro de trabalho** | Armazena intervalos de trabalho já realizado |
| **Controle de overtime** | Permite booking fora do horário |
| **Controle de sloppy** | Relaxa verificação de conflitos |
| **Export/Import** | Serializa para TJP format |

### 5.2 Estrutura Interna

```typescript
class Booking {
  @resource: Resource;
  @task: Task;
  @intervals: TimeInterval[];
  @sourceFileInfo: SourceFileInfo | null;
  @overtime: 0 | 1 | 2;    // 0=working only, 1=+offhours, 2=+vacation
  @sloppy: 0 | 1 | 2;      // 0=strict, 1=+offhours, 2=+vacation
  
  constructor(resource: Resource, task: Task, intervals: TimeInterval[]);
  
  to_s(): string;
  to_tjp(taskMode: boolean): string;
}
```

### 5.3 Modos de Overtime e Sloppy

```typescript
// overtime: controla QUANDO pode bookar
// 0 = apenas working time (default)
// 1 = working time + off-hours
// 2 = working time + off-hours + vacation

// sloppy: controla QUÃO ESTRITO é a verificação
// 0 = strict (erro se violar)
// 1 = warning se violar off-hours
// 2 = warning se violar vacation
```

### 5.4 Processamento no ResourceScenario

```typescript
// No ResourceScenario.bookBooking():
bookBooking(sbIdx: number, booking: Booking): void {
  if (this.scoreboard === null) this.initScoreboard();
  
  const val = this.scoreboard[sbIdx];
  
  if (val !== null) {
    if (this.booked?(sbIdx)) {
      // Conflito com outra task
      error('booking_conflict',
        `Resource ${this.property.fullId} has multiple conflicting ` +
        `bookings for ${this.scoreboard.idxToDate(sbIdx)}. The ` +
        `conflicting tasks are ${this.scoreboard[sbIdx].fullId} and ` +
        `${booking.task.fullId}.`, booking.sourceFileInfo);
    }
    
    // Verifica overtime
    if ((val & 2) !== 0 && booking.overtime < 1) {
      // Slot é off-hours
      if (booking.sloppy < 1) {
        error('booking_no_duty',
          `Resource ${this.property.fullId} has no duty at ` +
          `${this.scoreboard.idxToDate(sbIdx)}.`,
          booking.sourceFileInfo);
      }
      return false;
    }
    
    if ((val & 0x3C) !== 0 && booking.overtime < 2) {
      // Slot é vacation/leave
      if (booking.sloppy < 2) {
        error('booking_on_vacation',
          `Resource ${this.property.fullId} is on vacation at ` +
          `${this.scoreboard.idxToDate(sbIdx)}.`,
          booking.sourceFileInfo);
      }
      return false;
    }
  }
  
  // Booking válido
  this.book(sbIdx, booking.task, true);  // force = true
}
```

### 5.5 Processamento no TaskScenario

```typescript
// No TaskScenario.bookBookings():
bookBookings(): void {
  let firstSlotIdx: number | null = null;
  let lastSlotIdx: number | null = null;
  
  // Trata effortdone/effortleft
  if (this.effortdone || this.effortleft) {
    this.forward = true;  // Força ASAP
    
    if (!this.start) {
      error('effort_done_left_start_missing',
        `Task ${this.property.fullId} has 'effortdone' or 'effortleft' ` +
        `attribute but no start date specified.`);
    }
    
    if (!this.effort) {
      error('effort_missing',
        `Task ${this.property.fullId} has 'effortdone' or 'effortleft' ` +
        `attribute but no 'effort'.`);
    }
    
    if (this.effortdone) {
      if (this.effortdone > this.effort) {
        error('effort_done_larger_effort',
          `Task ${this.property.fullId} has larger 'effortdone' ` +
          `than 'effort'.`);
      }
      this.doneEffort = this.effortdone;
      
      if (this.effortleft) {
        error('effort_done_and_left',
          `A task cannot have the 'effortdone' and 'effortleft' attribute.`);
      }
    } else {
      if (this.effortleft > this.effort) {
        error('effort_left_larger_effort',
          `Task ${this.property.fullId} has larger 'effortleft' ` +
          `than 'effort'.`);
      }
      this.doneEffort = this.effort - this.effortleft;
    }
    
    firstSlotIdx = this.project.dateToIdx(this.start);
    lastSlotIdx = this.project.dateToIdx(this.project.get('now'));
  }
  
  // Processa bookings
  const bookings = this.findBookings();
  if (bookings.length > 0) {
    if (this.effortdone || this.effortleft) {
      error('bookings_and_effort',
        `Bookings cannot be used together with 'effortdone' or ` +
        `'effortleft' attributes.`);
    }
    
    for (const booking of bookings) {
      if (!booking.resource.leaf?) {
        error('booking_resource_not_leaf',
          `Booked resources may not be group resources`,
          booking.sourceFileInfo);
      }
      
      if (!this.forward && !this.scheduled) {
        error('booking_forward_only',
          `Only forward scheduled tasks may have booking statements.`);
      }
      
      let booked = false;
      for (const interval of booking.intervals) {
        const startIdx = this.project.dateToIdx(interval.start, false);
        const endIdx = this.project.dateToIdx(interval.end, false);
        
        for (let idx = startIdx; idx < endIdx; idx++) {
          if (booking.resource.bookBooking(scenarioIdx, idx, booking)) {
            this.doneEffort += booking.resource.get('efficiency', scenarioIdx);
            booked = true;
            
            // Track first/last slots
            if (firstSlotIdx === null || firstSlotIdx > idx) {
              firstSlotIdx = idx;
            }
            if (lastSlotIdx === null || lastSlotIdx < idx) {
              lastSlotIdx = idx;
            }
          }
        }
      }
      
      if (booked && !this.assignedresources.includes(booking.resource)) {
        this.assignedresources.push(booking.resource);
      }
    }
  }
  
  // Ajusta start/end baseado nos bookings
  if ((this.start === null || (this.doneEffort > 0 && this.effort > 0)) &&
      !this.scheduled && firstSlotIdx !== null) {
    const firstSlotDate = this.project.idxToDate(firstSlotIdx);
    if (this.start === null || firstSlotDate > this.start) {
      this.start = firstSlotDate;
    }
  }
  
  // Verifica se duration criteria foi atingido
  if (lastSlotIdx !== null && !this.scheduled) {
    const tentativeEnd = this.project.idxToDate(lastSlotIdx + 1);
    const slotDuration = this.project.get('scheduleGranularity');
    
    if (this.effort > 0) {
      if (this.doneEffort >= this.effort) {
        this.end = tentativeEnd;
        this.markAsScheduled();
      }
    } else if (this.length > 0) {
      this.doneLength = 0;
      const startIdx = this.project.dateToIdx(this.start);
      const endIdx = this.project.dateToIdx(this.project.get('now'));
      let date = this.start;
      
      for (let idx = startIdx; idx <= endIdx; idx++) {
        if (this.onShift?(idx)) this.doneLength += 1;
        date = date.plus(slotDuration);
        
        if (this.doneLength >= this.length && date >= tentativeEnd) {
          const endDate = this.project.idxToDate(idx + 1);
          this.end = endDate > tentativeEnd ? endDate : tentativeEnd;
          this.markAsScheduled();
          break;
        }
      }
    } else if (this.duration > 0) {
      this.doneDuration = Math.floor((tentativeEnd - this.start) / slotDuration);
      if (this.doneDuration >= this.duration) {
        this.end = tentativeEnd;
        this.markAsScheduled();
      } else if (this.duration * slotDuration < (this.project.get('now') - this.start)) {
        this.end = this.start.plus(this.duration * slotDuration);
        this.markAsScheduled();
      }
    }
  }
  
  // Ajusta currentSlotIdx para 'now' se há bookings
  if (this.doneEffort > 0) {
    this.currentSlotIdx = this.project.dateToIdx(this.project.get('now'));
  }
  
  // Warnings de overbooking
  if (this.effort > 0) {
    const effort = this.project.slotsToDays(this.doneEffort);
    const effortHours = effort * this.project.get('dailyworkinghours');
    const requestedEffort = this.project.slotsToDays(this.effort);
    const requestedEffortHours = requestedEffort * this.project.get('dailyworkinghours');
    
    if (effort > requestedEffort) {
      warning('overbooked_effort',
        `The total effort (${effort}d or ${effortHours}h) of the ` +
        `provided bookings for task ${this.property.fullId} exceeds ` +
        `the specified effort of ${requestedEffort}d or ` +
        `${requestedEffortHours}h.`);
    }
  }
  
  // Similar para length e duration...
}
```

### 5.6 Herança de Bookings entre Cenários

```typescript
// No TaskScenario.findBookings():
findBookings(): Booking[] {
  let scenario = this.property.project.scenario(scenarioIdx);
  
  // Se cenário não tem bookings próprios, herda do pai
  while (!scenario.get('ownbookings')) {
    scenario = scenario.parent;
  }
  
  // Retorna bookings do cenário encontrado
  return this.property.get('booking', this.property.project.scenarioIdx(scenario));
}
```

---

## 🔗 6. TASKDEPENDENCY.RB — Grafo de Dependências

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Representação de dependência** | taskId + onEnd + gaps |
| **Resolução de IDs** | Converte string em referência Task |
| **4 tipos de dependência** | start-start, start-end, end-start, end-end |
| **Gaps** | gapDuration (calendar) + gapLength (working) |

### 6.2 Estrutura Interna

```typescript
class TaskDependency {
  @taskId: string;          // ID absoluto ou relativo
  @task: Task | null;       // Referência resolvida
  @onEnd: boolean;          // true = alvo é end, false = start
  @gapDuration: number;     // Gap em segundos (calendar time)
  @gapLength: number;       // Gap em slots (working time)
  
  constructor(taskId: string, onEnd: boolean);
  
  resolve(project: Project): void;
}
```

### 6.3 Resolução de IDs

```typescript
// No TaskScenario.Xref():
Xref(): void {
  // Processa 'depends'
  for (const dependency of this.depends) {
    const depTask = this.checkDependency(dependency, 'depends');
    
    // Adiciona à lista de predecessores do start
    this.startpreds.push([depTask, dependency.onEnd]);
    
    // Adiciona à lista de sucessores do predecessor
    depTask.get(dependency.onEnd ? 'endsuccs' : 'startsuccs', scenarioIdx)
      .push([this.property, false]);
  }
  
  // Processa 'precedes'
  for (const dependency of this.precedes) {
    const predTask = this.checkDependency(dependency, 'precedes');
    
    // Adiciona à lista de sucessores do end
    this.endsuccs.push([predTask, dependency.onEnd]);
    
    // Adiciona à lista de predecessores do sucessor
    predTask.get(dependency.onEnd ? 'endpreds' : 'startpreds', scenarioIdx)
      .push([this.property, true]);
  }
}

private checkDependency(dependency: TaskDependency, depType: string): Task {
  const depList = this[depType];
  
  // Resolve ID → Task
  const depTask = dependency.resolve(this.project);
  if (depTask === null) {
    depList.delete(dependency);
    error('task_depend_unknown',
      `Task ${this.property.fullId} has unknown ${depType} ${dependency.taskId}`);
  }
  
  // Verifica dependência de si mesmo
  if (depTask === this.property) {
    depList.delete(dependency);
    error('task_depend_self',
      `Task ${this.property.fullId} cannot depend on self`);
  }
  
  // Verifica dependência de filho
  if (depTask.isChildOf?(this.property)) {
    depList.delete(dependency);
    error('task_depend_child',
      `Task ${this.property.fullId} cannot depend on child ${depTask.fullId}`);
  }
  
  // Verifica dependência de pai
  if (this.property.isChildOf?(depTask)) {
    depList.delete(dependency);
    error('task_depend_parent',
      `Task ${this.property.fullId} cannot depend on parent ${depTask.fullId}`);
  }
  
  // Verifica duplicatas
  for (const dep of depList) {
    if (dep.task === depTask && dep !== dependency) {
      depList.delete(dependency);
      error('task_depend_multi',
        `No need to specify dependency ${depTask.fullId} multiple ` +
        `times for task ${this.property.fullId}.`);
    }
  }
  
  return depTask;
}
```

### 6.4 Cálculo de earliestStart/latestEnd

```typescript
// No TaskScenario:
earliestStart(): TjTime | null {
  let startDate: TjTime | null = null;
  
  for (const dependency of this.depends) {
    const potentialStartDate = dependency.task.get(
      dependency.onEnd ? 'end' : 'start', scenarioIdx
    );
    
    if (potentialStartDate === null) return null;
    
    // Calcula data após gapLength (working time)
    let dateAfterLengthGap = potentialStartDate;
    let gapLength = dependency.gapLength;
    
    while (gapLength > 0 && dateAfterLengthGap < this.project.get('end')) {
      if (this.project.isWorkingTime(dateAfterLengthGap)) {
        gapLength -= 1;
      }
      dateAfterLengthGap = dateAfterLengthGap.plus(
        this.project.get('scheduleGranularity')
      );
    }
    
    // Calcula data após gapDuration (calendar time)
    if (dateAfterLengthGap > potentialStartDate.plus(dependency.gapDuration)) {
      potentialStartDate = dateAfterLengthGap;
    } else {
      potentialStartDate = potentialStartDate.plus(dependency.gapDuration);
    }
    
    if (startDate === null || startDate < potentialStartDate) {
      startDate = potentialStartDate;
    }
  }
  
  // Respeita start do pai
  let task: Task | null = this.property;
  while ((task = task.parent)) {
    if (task.get('start', scenarioIdx) &&
        (startDate === null || task.get('start', scenarioIdx) > startDate)) {
      startDate = task.get('start', scenarioIdx);
      break;
    }
  }
  
  // Verifica conflito com end
  if (this.end && (startDate === null || startDate > this.end)) {
    error('impossible_start_dep',
      `Task ${this.property.fullId} has start date dependencies ` +
      `that conflict with the end date ${this.end}.`);
  }
  
  return startDate;
}

latestEnd(): TjTime | null {
  let endDate: TjTime | null = null;
  
  for (const dependency of this.precedes) {
    const potentialEndDate = dependency.task.get(
      dependency.onEnd ? 'end' : 'start', scenarioIdx
    );
    
    if (potentialEndDate === null) return null;
    
    // Calcula data antes de gapLength (working time)
    let dateBeforeLengthGap = potentialEndDate;
    let gapLength = dependency.gapLength;
    
    while (gapLength > 0 && dateBeforeLengthGap > this.project.get('start')) {
      if (this.project.isWorkingTime(
        dateBeforeLengthGap.minus(this.project.get('scheduleGranularity'))
      )) {
        gapLength -= 1;
      }
      dateBeforeLengthGap = dateBeforeLengthGap.minus(
        this.project.get('scheduleGranularity')
      );
    }
    
    // Calcula data antes de gapDuration (calendar time)
    if (dateBeforeLengthGap < potentialEndDate.minus(dependency.gapDuration)) {
      potentialEndDate = dateBeforeLengthGap;
    } else {
      potentialEndDate = potentialEndDate.minus(dependency.gapDuration);
    }
    
    if (endDate === null || endDate > potentialEndDate) {
      endDate = potentialEndDate;
    }
  }
  
  // Respeita end do pai
  let task: Task | null = this.property;
  while ((task = task.parent)) {
    if (task.get('end', scenarioIdx) &&
        (endDate === null || task.get('end', scenarioIdx) < endDate)) {
      endDate = task.get('end', scenarioIdx);
      break;
    }
  }
  
  // Verifica conflito com start
  if (this.start && (endDate === null || endDate < this.start)) {
    error('impossible_end_dep',
      `Task ${this.property.fullId} has end date dependencies ` +
      `that conflict with the start date ${this.start}.`);
  }
  
  return endDate;
}
```

### 6.5 Detecção de Loops

```typescript
// No TaskScenario.checkForLoops():
checkForLoops(path: [Task, boolean][], atEnd: boolean, 
              fromOutside: boolean, forward: boolean): void {
  // Verifica se já visitamos este nó
  if (path.some(([t, e]) => t === this.property && e === atEnd)) {
    warning('loop_detected',
      `Dependency loop detected at ${atEnd ? 'end' : 'start'} ` +
      `of task ${this.property.fullId}`, false);
    
    // Reporta loop completo
    let skip = true;
    for (const [t, e] of path) {
      if (t === this.property && e === atEnd) {
        skip = false;
        continue;
      }
      if (skip) continue;
      info(`loop_at_${e ? 'end' : 'start'}`,
        `Loop ctnd. at ${e ? 'end' : 'start'} of task ${t.fullId}`,
        t.sourceFileInfo);
    }
    
    error('loop_end', 'Aborting');
  }
  
  // Marca como visitado
  path.push([this.property, atEnd]);
  
  // Navegação no grafo (4 casos: atEnd × fromOutside)
  if (!atEnd) {
    if (fromOutside) {
      if (this.property.container?) {
        // Desce para filhos
        for (const child of this.property.children) {
          child.checkForLoops(scenarioIdx, path, false, true, forward);
        }
      } else {
        if ((forward && this.forward) || this.milestone) {
          // Atravessa a task (start → end)
          this.checkForLoops(path, true, false, true);
        }
      }
    } else {
      if (this.startpreds.length === 0) {
        if (this.property.parent) {
          this.property.parent.checkForLoops(scenarioIdx, path, false, false, forward);
        }
      } else {
        for (const [task, targetEnd] of this.startpreds) {
          task.checkForLoops(scenarioIdx, path, targetEnd, true, forward);
        }
      }
    }
  } else {
    // Simétrico para atEnd = true
    // ...
  }
  
  path.pop();
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 5)

```
FASE 5A: Dependências
  1. TaskDependency.ts
     - resolve() para converter IDs
     - gapDuration + gapLength
     - onEnd flag

FASE 5B: Restrições
  2. Limits.ts + Limit.ts
     - Scoreboard com contadores
     - idxToSbIdx() para conversão
     - ok?() / inc() / dec()
  3. ShiftAssignments.ts + ShiftAssignment.ts
     - Scoreboard cacheado
     - Compartilhamento via hashKey
     - Encoding de bits

FASE 5C: Alocação
  4. Allocation.ts
     - candidates() com selectionMode
     - persistent + mandatory + atomic
     - onShift?()
  5. Booking.ts
     - overtime + sloppy
     - to_tjp() para export

FASE 5D: Integração
  6. Atualizar TaskScenario.ts
     - Xref() para resolver dependências
     - bookBookings() para processar bookings
     - earliestStart() / latestEnd()
     - checkForLoops()
  7. Atualizar ResourceScenario.ts
     - bookBooking() com overtime/sloppy
     - initScoreboard() com shifts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 Allocation com Generics
```typescript
class Allocation {
  private candidates: Resource[];
  private selectionMode: SelectionMode;
  private persistent: boolean;
  private mandatory: boolean;
  private atomic: boolean;
  private shifts: ShiftAssignments | null;
  private lockedResource: Resource | null;
  private staticCandidates: Resource[] | null;
  
  candidates(scenarioIdx?: number): Resource[] {
    // Implementação conforme descrito acima
  }
}
```

#### 7.2.2 Limits com TypedArray
```typescript
class Limit {
  private scoreboard: Int32Array;  // Performance!
  
  constructor(name: string, interval: ScoreboardInterval, period: number,
              value: number, upper: boolean, resource: Resource | null) {
    const size = Math.ceil(interval.duration / period);
    this.scoreboard = new Int32Array(size);
  }
}
```

#### 7.2.3 ShiftAssignments com WeakMap
```typescript
class ShiftAssignments {
  private static scoreboards = new Map<string, [Set<number>, Scoreboard]>();
  
  // Em TypeScript, usar FinalizationRegistry para cleanup
  private static registry = new FinalizationRegistry((objId: number) => {
    ShiftAssignments.deleteScoreboard(objId);
  });
  
  constructor() {
    ShiftAssignments.registry.register(this, this.objectId);
  }
}
```

#### 7.2.4 TaskDependency com Union Types
```typescript
type DependencyTarget = 'start' | 'end';

class TaskDependency {
  taskId: string;
  task: Task | null;
  onEnd: boolean;
  gapDuration: number;
  gapLength: number;
  
  resolve(project: Project): Task {
    this.task = project.task(this.taskId);
    return this.task!;
  }
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **Allocation.selectionMode é inteiro!** Não usar enum string.

2. **Limits.idxToSbIdx() é crítico!** Erro aqui quebra todos os limites.

3. **ShiftAssignments.scoreboard é compartilhado!** Não modificar diretamente.

4. **Booking.overtime/sloppy são independentes!** overtime controla QUANDO, sloppy controla QUÃO ESTRITO.

5. **TaskDependency.resolve() pode falhar!** Sempre verificar se task !== null.

6. **gapDuration é calendar time, gapLength é working time!** Não confundir.

7. **Persistent allocation trava recurso!** Se recurso desaparecer, emite warning.

8. **Mandatory allocation aborta slot inteiro!** Se UM mandatório falha, TODO slot é abortado.

9. **Bookings são herdados entre cenários!** Usar findBookings() para encontrar cenário correto.

10. **Loops são detectados via DFS!** Manter path e verificar revisit.

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (25 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, AttributeDefinition, TjTime
- [x] **Scheduler Core**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Lógica**: LogicalExpression, LogicalOperation
- [x] **Fase 5**: Allocation, Limits, ShiftAssignments, Booking, TaskDependency ⭐

### 🎯 Próximos 5 (Fase 6)
- [ ] ScenarioData.rb
- [ ] Attributes.rb
- [ ] PropertySet.rb
- [ ] Scenario.rb
- [ ] Query.rb

### 🔮 Futuros (Fase 7 - Reports)
- [ ] Report.rb + subclasses
- [ ] TableColumnDefinition.rb
- [ ] LogicalFunction.rb
- [ ] RichText.rb
- [ ] HTMLDocument.rb

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Allocation
const allocation = new Allocation([resource1, resource2], SelectionMode.MINALLOCATED);
allocation.persistent = true;
allocation.mandatory = false;

// 2. Parser cria TaskDependency
const dep = new TaskDependency('task2', true);  // onEnd = true
dep.gapDuration = 86400;  // 1 dia
dep.gapLength = 0;
task1.get('depends', 0).push(dep);

// 3. Parser cria Booking
const booking = new Booking(resource, task, [interval1, interval2]);
booking.overtime = 1;  // Permite off-hours
booking.sloppy = 0;    // Strict

// 4. Parser cria Limits
const limits = new Limits();
limits.setProject(project);
limits.setLimit('dailymax', 8 * 3600, interval, null);  // 8h/dia

// 5. Parser cria ShiftAssignments
const shifts = new ShiftAssignments();
shifts.project = project;
shifts.addAssignment(new ShiftAssignment(shiftScenario, interval));

// 6. Scheduler usa tudo junto
taskScenario.schedule();
// → scheduleSlot()
//   → bookResources()
//     → Verifica limits.ok?()
//     → Verifica shifts.assigned?()
//     → Para cada allocation:
//       → candidates() ordena por selectionMode
//       → bookResource() tenta cada candidato
//         → resource.book() → Scoreboard[idx] = task
//         → limits.inc()
//         → task.incLimits()

// 7. Pós-scheduling verifica dependências
taskScenario.postScheduleCheck();
// → Verifica se depends/precedes foram respeitados
// → Verifica gapDuration/gapLength
// → Emite warnings se violado
```

---

**Fim da Fase 5.** O scheduler está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ScenarioData.rb` → `Attributes.rb` → `PropertySet.rb` → `Scenario.rb` → `Query.rb`. 🚀