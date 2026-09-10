# 📘 Blueprint Fase 10: Sistema de Apoio + Próximos 5 Arquivos

## 🎯 Objetivo
Analisar os 5 arquivos que formam o **sistema de apoio** do engine (alertas, listas, cache, journal) e sugerir os próximos 5 para completar o **scheduler + financeiro**.

---

## 📊 1. ANÁLISE DOS 5 ARQUIVOS ANEXADOS

### 1.1 AlertLevelDefinitions.rb — Sistema de Alertas

**Responsabilidade:** Gerencia os níveis de alerta (green/yellow/red por padrão).

```typescript
class AlertLevelDefinition {
  id: string;      // 'green', 'yellow', 'red'
  name: string;    // 'Green', 'Yellow', 'Red'
  color: string;   // '#008000', '#BEA800', '#C00000'
}

class AlertLevelDefinitions {
  levels: AlertLevelDefinition[];
  modified: boolean;
  
  add(level: AlertLevelDefinition): void;
  clear(): void;
  indexById(id: string): number;
  indexByName(name: string): number;
  indexByColor(color: string): number;
}
```

**Integração:**
- `Project['alertLevels']` → instância de AlertLevelDefinitions
- `JournalEntry.alertLevel` → índice do nível (0, 1, 2)
- `query_alert()` → retorna nome e cor do nível
- Ícones: `flag-green.png`, `flag-yellow.png`, `flag-red.png`

---

### 1.2 PropertyList.rb — Lista Ordenada de Propriedades

**Responsabilidade:** Lista de propriedades com sorting multi-nível.

```typescript
class PropertyList<T extends PropertyTreeNode> {
  items: T[];
  propertySet: PropertySet<T>;
  query: Query | null;
  sortingLevels: number;
  sortingCriteria: string[];
  sortingUp: boolean[];
  scenarioIdx: number[];
  
  setSorting(modes: [string, boolean, number][]): void;
  sort!(): void;
  treeMode?(): boolean;
  includeAdopted(): void;
  checkForDuplicates(sourceFileInfo: SourceFileInfo): void;
}
```

**Integração:**
- `TaskListRE.generateIntermediateFormat()` → filtra e ordena tasks
- `ResourceListRE.generateIntermediateFormat()` → filtra e ordena resources
- `Project.scheduleScenario()` → ordena tasks por prioridade
- `TableReport.filterTaskList()` / `filterResourceList()` → aplica filtros

**Sorting:**
```typescript
// Exemplo: ordenar por priority (desc), pathcriticalness (desc), seqno (asc)
tasks.setSorting([
  ['priority', false, scIdx],
  ['pathcriticalness', false, scIdx],
  ['seqno', true, -1]
]);
tasks.sort!();
```

---

### 1.3 LeaveList.rb — Listas de Leaves

**Responsabilidade:** Representa leaves (férias, feriados, licenças).

```typescript
class Leave {
  static Types = {
    project: 1,    // menor prioridade
    annual: 2,
    special: 3,
    sick: 4,
    unpaid: 5,
    holiday: 6,
    unemployed: 7  // maior prioridade
  };
  
  type: keyof typeof Leave.Types;
  interval: TimeInterval;
  reason: string | null;
  
  typeIdx(): number;
}

class LeaveList extends Array<Leave> {}

class LeaveAllowance {
  type: keyof typeof Leave.Types;
  date: TjTime;
  slots: number;  // pode ser negativo (expirado)
}

class LeaveAllowanceList extends Array<LeaveAllowance> {
  balance(type: string, startDate: TjTime, endDate: TjTime): number;
}
```

**Integração:**
- `Project['leaves']` → feriados globais
- `Resource['leaves']` → férias do recurso
- `Shift['leaves']` → leaves do shift
- Scoreboard encoding: bits 2-5 = tipo de leave
- `query_annualleave()`, `query_sickleave()`, etc.

**Prioridade de Leaves:**
```
unemployed (7) > holiday (6) > unpaid (5) > sick (4) > special (3) > annual (2) > project (1)
```

---

### 1.4 DataCache.rb — Cache de Resultados

**Responsabilidade:** Cache global para resultados computados caros.

```typescript
class DataCacheEntry {
  unhashedKey: any[];
  value: any;
  hits: number;
}

class DataCache {
  static instance: DataCache;  // Singleton
  
  entries: Map<number, DataCacheEntry>;
  highWaterMark: number;  // 100000
  lowWaterMark: number;   // 90000
  stores: number;
  hits: number;
  misses: number;
  collisions: number;
  
  cached(...args: any[]): any;
  flush(): void;
  resize(size?: number): void;
}
```

**Integração:**
- `TaskScenario.getEffectiveWork()` → cache por (task, startIdx, endIdx, resource)
- `TaskScenario.getAllocatedTime()` → cache
- `TaskScenario.collectTimeOffIntervals()` → cache
- `ResourceScenario.getEffectiveWork()` → cache
- `ResourceScenario.treeSum()` → cache

**Padrão de Uso:**
```typescript
getEffectiveWork(startIdx: number, endIdx: number, resource?: Resource): number {
  return DataCache.instance.cached(
    this, 
    'ResourceScenarioGetEffectiveWork', 
    startIdx, 
    endIdx, 
    resource
  )(() => {
    // Cálculo caro aqui
    return work;
  });
}
```

---

### 1.5 Journal.rb — Sistema de Journal e Alertas

**Responsabilidade:** Gerencia entradas de journal e alertas.

```typescript
class JournalEntry {
  date: TjTime;
  headline: string;
  property: PropertyTreeNode;
  author: Resource | null;
  moderators: Resource[];
  summary: RichTextIntermediate | null;
  details: RichTextIntermediate | null;
  alertLevel: number;
  flags: string[];
  timeSheetRecord: TimeSheetRecord | null;
  
  to_rText(query: Query): string;
}

class JournalEntryList extends Array<JournalEntry> {
  entries: JournalEntry[];
  sorted: boolean;
  sortBy: [string, number][];
  
  setSorting(by: [string, number][]): void;
  sort!(): void;
  last(date?: TjTime): JournalEntryList;
}

class Journal {
  entries: JournalEntryList;
  propertyToEntries: Map<PropertyTreeNode, JournalEntryList>;
  
  addEntry(entry: JournalEntry): void;
  getEntries(property: PropertyTreeNode): JournalEntryList;
  entriesByTask(task: Task, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  entriesByTaskR(task: Task, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  entriesByResource(resource: Resource, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  alertLevel(date: TjTime, property: PropertyTreeNode, query: Query): number;
  alertEntries(date: TjTime, property: PropertyTreeNode, minLevel: number): JournalEntryList;
  currentEntries(date: TjTime, property: PropertyTreeNode, minLevel: number): JournalEntryList;
  currentEntriesR(date: TjTime, property: PropertyTreeNode, minLevel: number, query: Query): JournalEntryList;
  to_rti(query: Query): RichTextIntermediate;
}
```

**Integração:**
- `Project['journal']` → instância de Journal
- `query_alert()`, `query_alerttrend()`, `query_journal()`, etc.
- `ResourceScenario.query_dashboard()` → dashboard de alertas
- `TaskScenario.journalText()` → texto de journal para tasks
- Modos: `:journal`, `:journal_sub`, `:status_up`, `:status_down`, `:status_dep`, `:alerts_down`, `:alerts_dep`

**Fluxo de Alertas:**
```typescript
// 1. Parser cria JournalEntry
const entry = new JournalEntry(journal, date, headline, task);
entry.alertLevel = 2;  // red

// 2. Report calcula alert level
query_alert(query): void {
  const alertLevel = journal.alertLevel(query.end, property, query);
  const levelRecord = project['alertLevels'][alertLevel];
  query.string = levelRecord.name;
  query.rti = RichText.new(`<fcol:${levelRecord.color}>${levelRecord.name}</fcol>`);
}

// 3. Dashboard de resource
query_dashboard(query): void {
  const taskList = [];
  for (const task of project.tasks) {
    if (task['responsible', scenarioIdx].includes(resource) &&
        !journal.currentEntries(query.end, task, 0, query.start).isEmpty()) {
      taskList.push(task);
    }
  }
  // Gera texto RichText com alertas
}
```

---

## 🎯 2. PRÓXIMOS 5 ARQUIVOS PARA COMPLETAR SCHEDULER + FINANCEIRO

Para fechar completamente o engine, estes são os 5 arquivos **mais críticos** que faltam:

### 1. ⭐ `lib/taskjuggler/TimeSheets.rb`
**Gerenciador de apontamentos de horas** — essencial para:
- `Project['timeSheets']` → coleção de TimeSheet
- `TaskJuggler.checkTimeSheet()` → valida time sheets
- `Project.schedule()` → processa time sheets antes do scheduling
- Conversão de time sheets em bookings

> **Por que é essencial:** Sem ele, não há como processar `timesheet` keyword. O tracking de progresso real não funciona.

---

### 2. ⭐ `lib/taskjuggler/TimeSheet.rb` + `TimeSheetRecord.rb`
**TimeSheet individual e registros** — essencial para:
- `TimeSheet.new(resource, interval, scenarioIdx)` → cria time sheet
- `TimeSheetRecord.new(timeSheet, task)` → registro por task
- `work`, `remaining`, `expectedEnd`, `priority`, `status` → atributos
- Conversão em bookings internos

> **Por que é essencial:** Sem ele, não há como capturar progresso real. O `effortdone`/`effortleft` depende disso.

---

### 3. ⭐ `lib/taskjuggler/RealFormat.rb`
**Formatação de números e moedas** — essencial para:
- `Project['currencyFormat']` → formato de moeda
- `Project['numberFormat']` → formato de números
- `query_cost()`, `query_revenue()`, `query_balance()` → formatação
- `query_rate()` → formatação de rate

> **Por que é essencial:** Sem ele, os relatórios financeiros não formatam corretamente os valores.

---

### 4. ⭐ `lib/taskjuggler/reports/ReportContext.rb`
**Contexto de relatório** — essencial para:
- `Project.reportContexts` → stack de contextos
- `ReportContext.new(project, report)` → cria contexto
- Backup/restore de atributos para relatórios dinâmicos
- Query template para relatórios

> **Por que é essencial:** Sem ele, relatórios aninhados não funcionam. O contexto se perde.

---

### 5. ⭐ `lib/taskjuggler/reports/ReportBase.rb`
**Base para todos os relatórios** — essencial para:
- `ReportBase.new(report)` → construtor base
- `rt_to_html(section)` → converte RichText para HTML
- `generateHtmlTableFrame()` → gera frame de tabela
- `generateHtmlTableRow()` → gera linha de tabela
- `filterTaskList()`, `filterResourceList()` → filtros

> **Por que é essencial:** Sem ele, TableReport, TextReport e outros não têm base comum.

---

## 📋 3. CHECKLIST ATUALIZADO

### ✅ Já analisados (55+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal ⭐

### 🎯 Próximos 5 (Fase 11 - Completar Engine)
- [ ] **TimeSheets.rb** ⭐
- [ ] **TimeSheet.rb** + **TimeSheetRecord.rb** ⭐
- [ ] **RealFormat.rb** ⭐
- [ ] **ReportContext.rb** ⭐
- [ ] **ReportBase.rb** ⭐

### 🔮 Futuros (Fase 12 - Final)
- [ ] `BatchProcessor.rb` (paralelismo)
- [ ] `MessageHandler.rb` (erros/warnings)
- [ ] `Log.rb` (logging)
- [ ] `PTNProxy.rb` (proxy para adopted tasks)
- [ ] `AttributeBase.rb` (base dos atributos)

---

## 🎁 4. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria JournalEntry
const entry = new JournalEntry(project['journal'], new TjTime('2026-09-10'), 'Task delayed', task);
entry.alertLevel = 2;  // red
entry.author = resource;

// 2. Report calcula alert level
const query = new Query({
  project: project,
  property: task,
  attributeId: 'alert',
  start: project.get('start'),
  end: project.get('end'),
});
query.process();
console.log(`Alert: ${query.to_s()}`);  // "Red"

// 3. Dashboard de resource
const dashboardQuery = new Query({
  project: project,
  property: resource,
  attributeId: 'dashboard',
  start: project.get('start'),
  end: project.get('end'),
});
dashboardQuery.process();
console.log(dashboardQuery.to_s());
// "=== [Red] Task: Task 1 (t1) ===\nReported on 2026-09-10 by John\nTask delayed"

// 4. PropertyList sorting
const taskList = new PropertyList(project.tasks);
taskList.setSorting([
  ['priority', false, 0],
  ['pathcriticalness', false, 0],
  ['seqno', true, -1]
]);
taskList.sort!();

// 5. DataCache
const work = DataCache.instance.cached(
  taskScenario,
  'TaskScenarioGetEffectiveWork',
  startIdx,
  endIdx,
  resource
)(() => {
  // Cálculo caro
  return 10.5;
});

// 6. LeaveList
const leaves = new LeaveList();
leaves.push(new Leave('holiday', new TimeInterval(new TjTime('2026-12-25'), new TjTime('2026-12-26')), 'Christmas'));
leaves.push(new Leave('annual', new TimeInterval(new TjTime('2026-07-01'), new TjTime('2026-07-15')), 'Vacation'));

// 7. AlertLevelDefinitions
const levels = new AlertLevelDefinitions();
levels.add(new AlertLevelDefinition('green', 'Green', '#008000'));
levels.add(new AlertLevelDefinition('yellow', 'Yellow', '#BEA800'));
levels.add(new AlertLevelDefinition('red', 'Red', '#C00000'));
```

---

**Resumo:** Anexe `TimeSheets.rb`, `TimeSheet.rb`, `TimeSheetRecord.rb`, `RealFormat.rb`, `ReportContext.rb` e `ReportBase.rb` para completar o **engine scheduler + financeiro**. 🚀