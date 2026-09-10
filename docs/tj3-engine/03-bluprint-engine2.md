# 📘 Blueprint Fase 3: Scheduler + Expressões Lógicas + Orquestrador Top-Level

## 🎯 Objetivo
Complementar o blueprint anterior com os arquivos que revelam:
1. **O algoritmo real de agendamento** (`TaskScenario.rb`)
2. **A estrutura central de dados** (`Scoreboard.rb`)
3. **O sistema de expressões lógicas** (`LogicalExpression.rb` + `LogicalOperation.rb`)
4. **O orquestrador top-level** (`TaskJuggler.rb`)

---

## 🏗️ 1. PIPELINE ATUALIZADO (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TaskJuggler (Top-Level)                       │
│  parse(files) → schedule() → generateReports()                  │
│  checkTimeSheet() / checkStatusSheet() / freeze()               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Project.schedule()                            │
│  initScoreboards()                                              │
│  Para cada cenário ativo:                                       │
│    prepareScenario()  → herança + validação                     │
│    scheduleScenario() → loop principal de scheduling            │
│    finishScenario()   → pós-validação                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           TaskScenario.schedule()  ⭐ CORAÇÃO DO ENGINE          │
│  scheduleSlot() → bookResources() → bookResource()              │
│  propagateDate() → dependências                                 │
│  readyForScheduling?()                                          │
│  checkForLoops()                                                │
│  calcCriticalness() / calcPathCriticalness()                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              ResourceScenario.book()                             │
│  Scoreboard[idx] = task                                         │
│  limits.inc()                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Scoreboard (Array de slots)                         │
│  nil = disponível | Task = alocado | int = leave/off            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 2. TASKJUGGLER.RB — Orquestrador Top-Level

### 2.1 Responsabilidades

```typescript
class TaskJuggler {
  project: Project | null;
  parser: ProjectFileParser | null;
  maxCpuCores: number = 1;
  warnTsDeltas: boolean = false;
  generateTraces: boolean = false;
  
  // Pipeline principal
  parse(files: string[], keepParser = false): boolean;
  schedule(): boolean;
  generateReports(outputDir?: string): boolean;
  
  // Operações específicas
  generateReport(reportId, regExpMode, formats?, dynamicAttributes?): boolean;
  freeze(freezeDate: TjTime, taskBookings: boolean): boolean;
  checkTimeSheet(fileName: string): boolean;
  checkStatusSheet(fileName: string): boolean;
}
```

### 2.2 Pipeline Completo

```typescript
async parse(files: string[]): Promise<boolean> {
  MessageHandler.clear();
  this.parser = new ProjectFileParser();
  let master = true;
  
  for (const file of files) {
    this.parser.open(file, master);
    if (master) {
      this.project = this.parser.parse('project');
      master = false;
    } else {
      this.parser.setGlobalMacros();
      this.parser.parse('propertiesFile');
    }
    this.project.inputFiles.push(file);
    this.parser.close();
  }
  
  return MessageHandler.errors === 0;
}

async schedule(): Promise<boolean> {
  this.project.warnTsDeltas = this.warnTsDeltas;
  const result = this.project.schedule();
  this.project.enableTraceReports(this.generateTraces);
  return result;
}

async generateReports(outputDir?: string): Promise<boolean> {
  this.project.checkReports();
  if (outputDir) this.project.outputDir = outputDir;
  this.project.generateReports(this.maxCpuCores);
  return true;
}
```

### 2.3 Modo UTC Padrão

```typescript
constructor() {
  TjTime.setTimeZone('UTC');  // TaskJuggler SEMPRE usa UTC internamente!
}
```

---

## ⭐ 3. TASKSCENARIO.RB — O CORAÇÃO DO SCHEDULER

### 3.1 Estrutura Interna

```typescript
class TaskScenario extends ScenarioData {
  // Estado do scheduling
  isRunAway: boolean = false;
  hasDurationSpec: boolean = false;
  scheduled: boolean = false;
  
  // Contadores de progresso
  doneDuration: number = 0;
  doneLength: number = 0;
  doneEffort: number = 0.0;
  
  // Slot corrente
  currentSlotIdx: number | null = null;
  nowIdx: number;
  
  // Tipo de task (determina o algoritmo)
  durationType: 'effortTask' | 'lengthTask' | 'durationTask' | 'startEndTask';
  
  // Dependências (4 listas)
  startpreds: [Task, onEnd][];
  startsuccs: [Task, onEnd][];
  endpreds: [Task, onEnd][];
  endsuccs: [Task, onEnd][];
  
  // Recursos
  candidates: Resource[];
  mandatories: Allocation[];
  assignedresources: Resource[];
  competitors: Task[];
  contendedResources: Map<Task, Map<Resource, number>>;
  
  // Limites
  allLimits: Limits[];
  
  // Flags de propagação
  startPropagated: boolean = false;
  endPropagated: boolean = false;
}
```

### 3.2 Tipos de Task (CRÍTICO!)

```typescript
// Determinado em prepareScheduling():
if (effort > 0)      durationType = 'effortTask';      // esforço fixo
else if (length > 0) durationType = 'lengthTask';      // duração em working time
else if (duration > 0) durationType = 'durationTask';  // duração em calendar time
else if (milestone)  durationType = 'startEndTask';    // milestone
else                 durationType = 'startEndTask';    // start+end fixos
```

### 3.3 O Algoritmo Principal: `schedule()`

```typescript
schedule(): boolean {
  if (this.scheduled) return true;
  
  // 1. Inicializa o slot corrente
  if (this.currentSlotIdx === null) {
    if (this.forward) {
      // ASAP: começa no start (ou 'now' se projection mode)
      this.currentSlotIdx = this.project.dateToIdx(
        this.projectionmode && 
        this.project.now > this.start && 
        !this.allocate.empty
          ? this.project.now 
          : this.start
      );
    } else {
      // ALAP: começa no slot ANTES do end
      this.currentSlotIdx = this.project.dateToIdx(this.end) - 1;
    }
  }
  
  // 2. Loop principal: agenda slot por slot
  const lowerLimit = this.project.dateToIdx(this.project.start);
  const upperLimit = this.project.dateToIdx(this.project.end);
  const delta = this.forward ? 1 : -1;
  
  while (this.scheduleSlot()) {
    this.currentSlotIdx += delta;
    
    // 3. Verifica se saiu do timeframe do projeto
    if (this.currentSlotIdx < lowerLimit || upperLimit < this.currentSlotIdx) {
      this.markAsRunaway();
      return false;
    }
  }
  
  return true;
}
```

### 3.4 O Loop Interno: `scheduleSlot()`

```typescript
scheduleSlot(): boolean {
  // Retorna false quando a task está completa
  
  switch (this.durationType) {
    case 'effortTask':
      // Agenda recursos até atingir o esforço total
      if (this.doneEffort < this.effort) this.bookResources();
      if (this.doneEffort >= this.effort) {
        // Propaga a data final
        if (this.forward) {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx + 1), true, true);
        } else {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx), false, true);
        }
        return false;  // Task completa
      }
      break;
      
    case 'lengthTask':
      // Agenda recursos e conta apenas slots de working time
      this.bookResources();
      if (this.onShift(this.currentSlotIdx)) this.doneLength += 1;
      if (this.doneLength >= this.length) {
        // Propaga data final
        return false;
      }
      break;
      
    case 'durationTask':
      // Agenda recursos e conta TODOS os slots (calendar time)
      this.bookResources();
      this.doneDuration += 1;
      if (this.doneDuration >= this.duration) {
        return false;
      }
      break;
      
    case 'startEndTask':
      // Apenas agenda recursos até atingir o outro extremo
      this.bookResources();
      if ((this.forward && this.currentSlotIdx >= this.endIdx) ||
          (!this.forward && this.currentSlotIdx <= this.startIdx)) {
        this.markAsScheduled();
        return false;
      }
      break;
  }
  
  return true;  // Continua agendando
}
```

### 3.5 Alocação de Recursos: `bookResources()`

```typescript
bookResources(): void {
  // 1. Verifica se algum recurso está disponível globalmente
  if (!this.project.anyResourceAvailable(this.currentSlotIdx)) return;
  
  // 2. Respeita projection mode (não aloca antes de 'now')
  if (this.projectionmode && this.nowIdx > this.currentSlotIdx) return;
  
  // 3. Verifica limites da task
  if (!this.limitsOk(this.currentSlotIdx)) return;
  
  // 4. Verifica shifts da task
  if (this.shifts && this.shifts.assigned(this.currentSlotIdx)) {
    if (!this.shifts.onShift(this.currentSlotIdx)) return;
  }
  
  // 5. Verifica recursos MANDATÓRIOS (todos devem estar disponíveis)
  const takenMandatories: Resource[] = [];
  for (const allocation of this.mandatories) {
    if (!allocation.onShift(this.currentSlotIdx)) return;
    
    let found = false;
    for (const candidate of allocation.candidates(this.scenarioIdx)) {
      let allAvailable = true;
      for (const resource of candidate.allLeaves) {
        if (!this.limitsOk(this.currentSlotIdx, resource) ||
            !resource.available(this.scenarioIdx, this.currentSlotIdx) ||
            takenMandatories.includes(resource)) {
          allAvailable = false;
          break;
        }
        takenMandatories.push(resource);
      }
      if (allAvailable) { found = true; break; }
    }
    if (!found) return;  // Mandatório não disponível → aborta slot
  }
  
  // 6. Para cada allocation, tenta alocar o primeiro candidato disponível
  for (const allocation of this.allocate) {
    if (!allocation.onShift(this.currentSlotIdx)) continue;
    
    // Verifica persistência (recurso travado)
    const locked = allocation.lockedResource;
    if (locked) {
      if (this.bookResource(locked)) continue;
      // Persistência quebrada → libera e tenta outro
      allocation.lockedResource = null;
    }
    
    // Tenta cada candidato na ordem (definida por selectionMode)
    for (const candidate of allocation.candidates(this.scenarioIdx)) {
      if (this.bookResource(candidate)) {
        if (allocation.persistent) allocation.lockedResource = candidate;
        break;
      }
    }
  }
}
```

### 3.6 Booking Individual: `bookResource()`

```typescript
bookResource(resource: Resource): boolean {
  let booked = false;
  
  for (const r of resource.allLeaves) {
    // Evita overbooking de effort
    if (this.effort > 0 && r.efficiency > 0 && this.doneEffort >= this.effort) break;
    if (!this.limitsOk(this.currentSlotIdx, r)) break;
    
    // Tenta bookar
    if (r.book(this.scenarioIdx, this.currentSlotIdx, this.property)) {
      // PRIMEIRO booking de task effort-based → ajusta start/end
      if (this.effort > 0 && this.doneEffort === 0) {
        if (this.forward) {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx), false, true);
        } else {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx + 1), true, true);
        }
      }
      
      this.doneEffort += r.efficiency;
      if (!this.assignedresources.includes(r)) {
        this.assignedresources.push(r);
      }
      booked = true;
    } else {
      // Recurso já está bookado para outra task → é um competidor!
      const competitor = r.bookedTask(this.scenarioIdx, this.currentSlotIdx);
      if (competitor && !this.competitors.includes(competitor)) {
        this.competitors.push(competitor);
        if (!this.contendedResources.has(competitor)) {
          this.contendedResources.set(competitor, new Map());
        }
        const map = this.contendedResources.get(competitor)!;
        map.set(r, (map.get(r) || 0) + 1);
      }
    }
  }
  
  return booked;
}
```

### 3.7 Propagação de Datas: `propagateDate()`

```typescript
propagateDate(date: TjTime, atEnd: boolean, ignoreEffort = false): void {
  // 1. Atualiza a data da task (se leaf)
  if (this.property.leaf) {
    const thisEnd = atEnd ? 'end' : 'start';
    const existing = this[thisEnd];
    
    // Só encolhe, nunca expande
    if (existing && (atEnd ? date > existing : date < existing)) return;
    
    this[thisEnd] = date;
  }
  
  // 2. Milestone: start = end
  if (this.milestone) {
    this.markAsScheduled();
    if (!this[atEnd ? 'start' : 'end']) {
      this.propagateDate(this[atEnd ? 'end' : 'start'], !atEnd);
    }
  }
  
  // 3. Propaga para tasks dependentes
  if (atEnd) {
    if (ignoreEffort || this.effort === 0) {
      for (const [task, onEnd] of this.endpreds) {
        this.propagateDateToDep(task, onEnd);
      }
    }
    for (const [task, onEnd] of this.endsuccs) {
      this.propagateDateToDep(task, onEnd);
    }
  } else {
    // ... simétrico para start
  }
  
  // 4. Propaga para sub-tasks que podem herdar
  for (const task of this.property.children) {
    if (task.canInheritDate(this.scenarioIdx, atEnd)) {
      task.propagateDate(this.scenarioIdx, date, atEnd);
    }
  }
  
  // 5. Tenta agendar o container pai
  for (const parent of this.property.parents) {
    parent.scheduleContainer(this.scenarioIdx);
  }
}
```

### 3.8 Detecção de Loops: `checkForLoops()`

```typescript
// Algoritmo DFS que detecta ciclos no grafo de dependências
checkForLoops(path: [Task, atEnd][], atEnd: boolean, 
              fromOutside: boolean, forward: boolean): void {
  // 1. Verifica se já visitamos este nó no path atual
  if (path.includes([this.property, atEnd])) {
    this.error('loop_detected', ...);
  }
  
  path.push([this.property, atEnd]);
  
  // 2. Navegação no grafo (4 casos: atEnd × fromOutside)
  if (!atEnd) {
    if (fromOutside) {
      if (this.property.container) {
        // Desce para os filhos
        for (const child of this.property.children) {
          child.checkForLoops(path, false, true, forward);
        }
      } else {
        if ((forward && this.forward) || this.milestone) {
          // Atravessa a task (start → end)
          this.checkForLoops(path, true, false, true);
        }
      }
    } else {
      // Vem de dentro → sobe para pais ou segue preds
      if (this.startpreds.empty) {
        if (this.property.parent) {
          this.property.parent.checkForLoops(path, false, false, forward);
        }
      } else {
        for (const [task, targetEnd] of this.startpreds) {
          task.checkForLoops(path, targetEnd, true, forward);
        }
      }
    }
  } else {
    // ... simétrico para atEnd = true
  }
  
  path.pop();
}
```

### 3.9 Cálculo de Criticalness

```typescript
// Criticalness individual: esforço × criticalness médio dos recursos
calcCriticalness(): void {
  if (this.milestone) {
    this.criticalness = this.priority / 500.0;  // 0-2 baseado em priority
  }
  if (this.effort <= 0 || this.candidates.empty) return;
  
  let avg = 0;
  for (const resource of this.candidates) {
    avg += resource.criticalness;
  }
  avg /= this.candidates.length;
  this.criticalness = this.effort * avg;
}

// Path criticalness: soma ao longo do caminho de dependências
calcPathCriticalness(atEnd = false): number {
  if (this.pathcriticalness !== null) {
    return this.pathcriticalness - (atEnd ? 0 : this.criticalness);
  }
  
  let max = 0;
  if (atEnd) {
    max = Math.max(max, this.calcPathCriticalnessEndSuccs());
  } else {
    if (this.property.container) {
      for (const task of this.property.children) {
        max = Math.max(max, task.calcPathCriticalness(false));
      }
    } else {
      for (const [task, onEnd] of this.startsuccs) {
        max = Math.max(max, task.calcPathCriticalness(onEnd));
      }
      max = Math.max(max, this.calcPathCriticalnessEndSuccs());
      max += this.criticalness;
    }
  }
  
  this.pathcriticalness = max;
  return max;
}
```

### 3.10 Processamento de Bookings Manuais: `bookBookings()`

```typescript
bookBookings(): void {
  // 1. Trata effortdone/effortleft
  if (this.effortdone || this.effortleft) {
    this.forward = true;  // Força ASAP
    if (this.effortdone) this.doneEffort = this.effortdone;
    else this.doneEffort = this.effort - this.effortleft;
  }
  
  // 2. Processa cada booking statement
  for (const booking of this.findBookings()) {
    for (const interval of booking.intervals) {
      const startIdx = this.project.dateToIdx(interval.start, false);
      const endIdx = this.project.dateToIdx(interval.end, false);
      
      for (let idx = startIdx; idx < endIdx; idx++) {
        if (booking.resource.bookBooking(this.scenarioIdx, idx, booking)) {
          this.doneEffort += booking.resource.efficiency;
          // Atualiza firstSlotIdx/lastSlotIdx
        }
      }
    }
  }
  
  // 3. Ajusta start/end baseado nos bookings
  if (this.start === null && firstSlotIdx !== null) {
    this.start = this.project.idxToDate(firstSlotIdx);
  }
  
  // 4. Verifica overbooking (warning)
  if (this.effort > 0 && this.doneEffort > this.effort) {
    this.warning('overbooked_effort', ...);
  }
}
```

---

## 📊 4. SCOREBOARD.RB — Estrutura Central

### 4.1 Estrutura

```typescript
class Scoreboard {
  private sb: (Task | number | null)[];
  readonly startDate: TjTime;
  readonly endDate: TjTime;
  readonly resolution: number;  // em segundos
  readonly size: number;
  
  constructor(start: TjTime, end: TjTime, resolution: number, initVal: any = null) {
    this.startDate = start;
    this.endDate = end;
    this.resolution = resolution;
    this.size = Math.ceil((end - start) / resolution) + 1;
    this.clear(initVal);
  }
  
  clear(initVal: any = null): void {
    this.sb = new Array(this.size).fill(initVal);
  }
}
```

### 4.2 Conversões

```typescript
idxToDate(idx: number, forceIntoProject = false): TjTime {
  if (forceIntoProject) {
    if (idx < 0) return this.startDate;
    if (idx >= this.size) return this.endDate;
  } else if (idx < 0 || idx >= this.size) {
    throw new Error(`Index ${idx} out of range`);
  }
  return this.startDate.plus(idx * this.resolution);
}

dateToIdx(date: TjTime, forceIntoProject = true): number {
  const idx = Math.floor((date - this.startDate) / this.resolution);
  if (forceIntoProject) {
    if (idx < 0) return 0;
    if (idx >= this.size) return this.size - 1;
  } else if (idx < 0 || idx >= this.size) {
    throw new Error(`Date ${date} out of range`);
  }
  return idx;
}
```

### 4.3 Encoding dos Valores (CRÍTICO!)

```typescript
// Valores possíveis no Scoreboard:
// - null          → slot disponível (working time, sem booking)
// - Task          → slot alocado para esta task
// - Integer (bits):
//   Bit 0:      Reservado
//   Bit 1:      0 = work time | 1 = no work time
//   Bit 2-5:    Tipo de leave (0-15)
//   Bit 6-7:    Reservado
//   Bit 8:      Override global setting

// Tipos de leave (Leave::Types):
// :project   = 0  (menor prioridade)
// :annual    = 1
// :special   = 2
// :sick      = 3
// :unpaid    = 4
// :holiday   = 5
// :unemployed = 6 (maior prioridade)

// Exemplos:
// 2          = não-working time (bit 1 setado)
// 4          = holiday (tipo 1 << 2)
// 8          = annual leave (tipo 2 << 2)
// 6          = não-working + holiday
```

### 4.4 Coleta de Intervalos: `collectIntervals()`

```typescript
// Coleta intervalos contíguos que satisfazem o predicado
collectIntervals(iv: TimeInterval, minDuration: number, 
                 predicate: (val: any) => boolean): IntervalList {
  const startIdx = this.dateToIdx(iv.start);
  const endIdx = this.dateToIdx(iv.end);
  const minSlots = Math.max(1, Math.floor(minDuration / this.resolution));
  
  // Expande busca para não perder intervalos nas bordas
  const sIdx = Math.max(0, startIdx - minSlots);
  const eIdx = Math.min(this.size - 1, endIdx + minSlots);
  
  const intervals = new IntervalList();
  let duration = 0;
  let start = 0;
  
  for (let idx = sIdx; idx <= eIdx; idx++) {
    if (predicate(this.sb[idx]) && idx < endIdx) {
      if (start === 0) start = idx;
      duration++;
    } else {
      if (duration > 0 && duration >= minSlots) {
        const realStart = Math.max(start, startIdx);
        const realEnd = Math.min(idx, endIdx);
        intervals.push(new TimeInterval(
          this.idxToDate(realStart),
          this.idxToDate(realEnd)
        ));
      }
      duration = 0;
      start = 0;
    }
  }
  
  return intervals;
}
```

### 4.5 Otimização com TypedArray

```typescript
// Para performance, use TypedArray quando possível:
class Scoreboard {
  private sb: (Task | number | null)[];  // Array heterogêneo
  
  // Alternativa para scoreboard global (só números):
  private globalSb: Int32Array;  // Muito mais rápido!
}
```

---

## 🔗 5. SISTEMA DE EXPRESSÕES LÓGICAS

### 5.1 Hierarquia

```
LogicalExpression
  └── operation: LogicalOperation
        ├── operand1: LogicalOperation | valor fixo | referência
        ├── operand2: LogicalOperation | valor fixo | referência (opcional)
        └── operator: '~' | '>' | '>=' | '=' | '<' | '<=' | '!=' | '&' | '|'

Subclasses de LogicalOperation:
  ├── LogicalAttribute  → acessa atributo de property (scenario.attribute)
  ├── LogicalFlag       → verifica flag
  └── LogicalFunction   → função como isleaf(), isactive(), etc.
```

### 5.2 LogicalExpression

```typescript
class LogicalExpression {
  operation: LogicalOperation;
  query: Query | null = null;
  sourceFileInfo: SourceFileInfo | null;
  
  eval(query: Query): boolean {
    this.query = query;
    const res = this.operation.eval(this);
    
    // Resultado deve ser boolean ou string
    if (typeof res === 'boolean') return res;
    if (typeof res === 'string') return res !== '';
    
    // Em TJP, "non-zero" = true
    return res !== 0;
  }
  
  error(text: string): never {
    throw new TjException(`${this.toString()}\nLogical expression error: ${text}`);
  }
}
```

### 5.3 LogicalOperation (CORE)

```typescript
class LogicalOperation {
  operand1: any;
  operand2: any;
  operator: string | null;
  
  eval(expr: LogicalExpression): any {
    switch (this.operator) {
      case null:
        // Operando único
        return this.operand1.eval 
          ? this.operand1.eval(expr) 
          : this.operand1;
          
      case '~':
        // NOT
        return !this.coerceBoolean(this.operand1.eval(expr), expr);
        
      case '>': case '>=': case '=': case '<': case '<=': case '!=':
        // Comparação binária com coerção de tipo
        const opnd1 = this.operand1.eval(expr);
        const opnd2 = this.operand2.eval(expr);
        
        if (opnd1 instanceof TjTime) {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceTime(o, expr));
        } else if (typeof opnd1 === 'number') {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceNumber(o, expr));
        } else if (typeof opnd1 === 'string') {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceString(o, expr));
        }
        expr.error(`Invalid operand type: ${typeof opnd1}`);
        
      case '&':
        // AND (lazy)
        return this.coerceBoolean(this.operand1.eval(expr), expr) &&
               this.coerceBoolean(this.operand2.eval(expr), expr);
               
      case '|':
        // OR (lazy)
        return this.coerceBoolean(this.operand1.eval(expr), expr) ||
               this.coerceBoolean(this.operand2.eval(expr), expr);
    }
  }
  
  private evalBinary(op1: any, op: string, op2: any, coerce: (v: any) => any): boolean {
    const a = coerce(op1);
    const b = coerce(op2);
    switch (op) {
      case '>':  return a > b;
      case '>=': return a >= b;
      case '=':  return a === b;
      case '<':  return a < b;
      case '<=': return a <= b;
      case '!=': return a !== b;
    }
  }
  
  private coerceBoolean(val: any, expr: LogicalExpression): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val !== '';
    if (typeof val === 'number') return val !== 0;
    expr.error(`Cannot coerce ${val} to boolean`);
  }
  
  private coerceNumber(val: any, expr: LogicalExpression): number {
    if (typeof val !== 'number') {
      expr.error(`Operand ${val} must be a number`);
    }
    return val;
  }
  
  private coerceString(val: any, expr: LogicalExpression): string {
    if (val === null || val === undefined) {
      expr.error(`Cannot convert ${val} to string`);
    }
    return String(val);
  }
  
  private coerceTime(val: any, expr: LogicalExpression): TjTime {
    if (!(val instanceof TjTime)) {
      expr.error(`Cannot convert ${val} to date`);
    }
    return val;
  }
}
```

### 5.4 LogicalAttribute (Acesso a Atributos)

```typescript
class LogicalAttribute extends LogicalOperation {
  scenario: Scenario;
  
  constructor(attributeId: string, scenario: Scenario) {
    super(attributeId);
    this.scenario = scenario;
  }
  
  eval(expr: LogicalExpression): any {
    const query = expr.query!.dup();
    query.scenarioIdx = this.scenario.sequenceNo - 1;
    query.attributeId = this.operand1;
    query.process();
    
    if (query.ok) {
      // Usa sortableResult para comparações numéricas
      return query.result ?? '';
    } else {
      expr.error(query.errorMessage);
    }
  }
}
```

### 5.5 LogicalFlag (Verificação de Flag)

```typescript
class LogicalFlag extends LogicalOperation {
  eval(expr: LogicalExpression): boolean {
    if (expr.query instanceof Query) {
      // Project/Property context
      return expr.query.property['flags', 0].includes(this.operand1);
    } else {
      // Journal context
      return expr.query.flags.includes(this.operand1);
    }
  }
}
```

### 5.6 Funções Lógicas Disponíveis

```typescript
// Implementadas em LogicalFunction.rb (não anexado ainda)
const FUNCTIONS = {
  hasalert: (level: number, date: TjTime) => boolean,
  isactive: (scenarioId: string) => boolean,
  ischildof: (parentId: string) => boolean,
  isdependencyof: (taskId: string, scenarioId: string, distance: number) => boolean,
  isdutyof: (resourceId: string, scenarioId: string) => boolean,
  isfeatureof: (taskId: string, scenarioId: string) => boolean,
  isleaf: () => boolean,
  ismilestone: (scenarioId: string) => boolean,
  isongoing: (scenarioId: string) => boolean,
  isresource: () => boolean,
  isresponsibilityof: (resourceId: string, scenarioId: string) => boolean,
  istask: () => boolean,
  isvalid: (scenarioId: string) => boolean,
  treelevel: () => number,
};
```

### 5.7 Regras de Avaliação

```
1. Operadores são avaliados LEFT-TO-RIGHT (sem precedência!)
   'a | b & c' === '(a | b) & c'
   
2. AND/OR são LAZY (short-circuit)

3. Coerção de tipos:
   - TjTime + TjTime → comparação temporal
   - number + number → comparação numérica
   - string + string → comparação lexicográfica
   
4. Constantes especiais:
   @all → sempre true
   @none → sempre false
   
5. Atributos inválidos (nil) → string vazia
```

---

## 🎯 6. ORDEM DE IMPLEMENTAÇÃO ATUALIZADA

```
FASE 1: Fundação (já coberta)
  1. TjTime.ts
  2. MessageHandler.ts
  3. TextParser (scanner/parser genérico)
  4. ProjectFileScanner.ts
  5. ProjectFileParser.ts + TjpSyntaxRules.ts

FASE 2: Modelo de Domínio (já coberta)
  6. AttributeBase.ts + Attribute.ts + subclasses
  7. AttributeDefinition.ts
  8. PropertySet.ts
  9. PropertyTreeNode.ts
  10. ScenarioData.ts + TaskScenario.ts + ResourceScenario.ts + ...
  11. Task.ts, Resource.ts, Account.ts, Shift.ts, Scenario.ts
  12. Interval.ts + IntervalList.ts
  13. WorkingHours.ts
  14. Project.ts

FASE 3: Scheduler (AGORA!)
  15. Scoreboard.ts ⭐
  16. Allocation.ts + Booking.ts
  17. TaskDependency.ts
  18. Limits.ts + ShiftAssignments.ts
  19. TaskScenario.ts ⭐ (coração do scheduler)
  20. ResourceScenario.ts (completar book/available)

FASE 4: Expressões Lógicas (AGORA!)
  21. LogicalOperation.ts ⭐
  22. LogicalExpression.ts ⭐
  23. LogicalFunction.ts (isleaf, isactive, etc.)
  24. LogicalAttribute.ts + LogicalFlag.ts

FASE 5: Orquestrador Top-Level (AGORA!)
  25. TaskJuggler.ts ⭐
  26. BatchProcessor.ts (paralelismo de reports)

FASE 6: Relatórios
  27. Report.ts + subclasses
  28. TableColumnDefinition.ts
  29. Query.ts (usado por expressões lógicas)

FASE 7: CLI + Documentação
  30. tj3.ts (CLI)
  31. SyntaxReference.ts + KeywordDocumentation.ts
```

---

## ⚠️ 7. PONTOS CRÍTICOS DE ATENÇÃO

### 7.1 Scheduler

1. **Slot Contíguo**: Tasks DEVEM ser agendadas em slots contíguos. O `currentSlotIdx` avança sempre em 1 (forward) ou -1 (backward).

2. **Effort vs Duration vs Length**:
   - `effort`: conta apenas slots com recurso alocado × efficiency
   - `length`: conta apenas slots de working time (mesmo sem recurso)
   - `duration`: conta TODOS os slots (calendar time)

3. **Projection Mode**: Se `projectionmode = true` e `now > currentSlot`, NÃO aloca recursos antes de `now`.

4. **Mandatory Resources**: Se UM mandatório falha, TODO o slot é abortado.

5. **Persistent Allocation**: Uma vez escolhido, o recurso é "travado" para toda a task. Se desaparecer, emite warning e tenta outro.

6. **Competitors**: Quando um recurso já está bookado por outra task, essa task vira "competidor" — usado para warnings de priority inversion.

7. **Runaway Detection**: Se o scheduler sai do timeframe do projeto, a task é marcada como runaway e emite warning.

### 7.2 Scoreboard

8. **Encoding de Bits**: Respeite rigorosamente a codificação:
   - `null` = disponível
   - `Task` = alocado
   - `int` = leave/off (bits 2-5 = tipo)

9. **Lazy Initialization**: O scoreboard só é criado quando necessário (projetos grandes com muitos resources não usados economizam memória).

10. **Copy-on-Write**: WorkingHours compartilha scoreboard entre instâncias idênticas.

### 7.3 Expressões Lógicas

11. **Sem Precedência**: `a | b & c` = `(a | b) & c`. Documente isso claramente!

12. **Lazy Evaluation**: AND/OR não avaliam o segundo operando se o resultado já é conhecido.

13. **Coerção Automática**: O tipo do PRIMEIRO operando determina a coerção dos outros.

14. **Atributos Inválidos**: `isvalid(scenario.attr)` deve ser usado antes de comparar atributos que podem ser nil.

### 7.4 TaskJuggler Top-Level

15. **UTC Forçado**: `TjTime.setTimeZone('UTC')` no construtor.

16. **Parser Reutilizável**: Para daemon mode, o parser pode ser mantido vivo entre requisições.

17. **BatchProcessor**: Reports podem ser gerados em paralelo (maxCpuCores).

---

## 📋 8. CHECKLIST FINAL

### Arquivos já analisados ✅
- [x] `TjpSyntaxRules.rb` — gramática completa
- [x] `ProjectFileScanner.rb` — lexer
- [x] `ProjectFileParser.rb` — parser
- [x] `SyntaxReference.rb` — documentação
- [x] `KeywordDocumentation.rb` — docs por keyword
- [x] `Project.rb` — orquestrador central
- [x] `PropertyTreeNode.rb` — base da árvore
- [x] `Task.rb` + `TaskScenario.rb` ⭐ — scheduler real
- [x] `Resource.rb` + `ResourceScenario.rb` — scoreboard do recurso
- [x] `AttributeDefinition.rb` — sistema de tipos
- [x] `TjTime.rb` — tempo interno
- [x] `Interval.rb` + `IntervalList.rb` — intervalos
- [x] `WorkingHours.rb` — horários de trabalho
- [x] `Scoreboard.rb` ⭐ — estrutura central
- [x] `LogicalExpression.rb` + `LogicalOperation.rb` ⭐ — expressões
- [x] `TaskJuggler.rb` ⭐ — orquestrador top-level

### Arquivos recomendados para a FASE 4 (Reports + Queries)
- [ ] `Query.rb` — contexto de avaliação de expressões
- [ ] `LogicalFunction.rb` — implementação das funções (isleaf, etc.)
- [ ] `Allocation.rb` — seleção de recursos
- [ ] `Booking.rb` — registro de trabalho manual
- [ ] `TaskDependency.rb` — dependências entre tasks
- [ ] `Limits.rb` + `ShiftAssignments.rb` — restrições
- [ ] `Report.rb` + subclasses — geração de relatórios
- [ ] `TableColumnDefinition.rb` — colunas de relatórios

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Cria o orquestrador
const tj = new TaskJuggler();

// 2. Parse do projeto
await tj.parse(['projeto.tjp']);

// 3. Scheduling
await tj.schedule();
// → Project.schedule()
//   → initScoreboards()
//   → Para cada cenário:
//     → prepareScenario()
//       → resource.prepareScheduling()
//       → task.prepareScheduling()
//       → task.Xref() (resolve dependências)
//       → task.propagateInitialValues()
//       → task.checkForLoops()
//       → resource.calcCriticalness()
//       → task.calcCriticalness()
//       → task.calcPathCriticalness()
//     → scheduleScenario()
//       → Loop: task.readyForScheduling?() → task.schedule()
//         → scheduleSlot()
//           → bookResources()
//             → bookResource(resource)
//               → resource.book() → Scoreboard[idx] = task
//     → finishScenario()
//       → task.finishScheduling()
//       → task.postScheduleCheck()

// 4. Geração de relatórios
await tj.generateReports('./output/');
// → Project.generateReports()
//   → Report.generate()
//     → Query.eval()
//       → LogicalExpression.eval()
//         → LogicalOperation.eval()
//           → LogicalAttribute.eval() → Query.process()

// 5. Freeze (opcional)
await tj.freeze(new TjTime('2026-09-10'), true);
```

---

**Fim da Fase 3.** O engine do TaskJuggler está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `Query.rb` → `LogicalFunction.rb` → `Allocation.rb` → `Booking.rb` → `Report.rb`. 🚀