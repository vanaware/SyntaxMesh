# 📘 Blueprint Fase 10: Sistema de Apoio + Logging + Mensagens

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **sistema de apoio** do engine: listas de intervalos, logging, mensagens, e syntax highlighting. Estes são componentes transversais que permeiam todo o sistema.

---

## 📊 1. ANÁLISE DOS 5 ARQUIVOS

### 1.1 ⭐ MessageHandler.rb — Sistema Central de Mensagens

**Responsabilidade:** Gerencia todas as mensagens do sistema (fatal, error, warning, info, debug).

**Estrutura:**
```typescript
class Message {
  type: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  id: string;
  message: string;
  sourceFileInfo: SourceFileInfo | null;
  line: string | null;
  data: any;
  scenario: Scenario | null;
  
  to_s(): string;  // Formata para console (com cores ANSI)
  to_log(): string; // Formata para log file
}

class MessageHandlerInstance {
  static instance: MessageHandlerInstance;  // Singleton
  
  messages: Message[];
  errors: number;
  outputLevel: number;  // 0-5 (none, fatal, error, warning, info, debug)
  logLevel: number;
  logFile: string | null;
  hideScenario: boolean;
  abortOnWarning: boolean;
  
  fatal(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  error(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  warning(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  info(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  debug(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  
  to_s(): string;
}

// Mixin para classes que precisam emitir mensagens
module MessageHandler {
  fatal(...): void;
  error(...): void;
  warning(...): void;
  info(...): void;
  debug(...): void;
}
```

**Integração:**
- Usado por **todas** as classes do engine (Task, Resource, Project, Parser, etc.)
- `error()` lança `TjException` e incrementa contador de erros
- `fatal()` aborta a execução imediatamente
- `warning()` pode abortar se `abortOnWarning = true`
- `baselineSFI` ajusta SourceFileInfo para includes aninhados

**Pontos Críticos:**
1. **Singleton pattern** — apenas uma instância global
2. **Thread safety** — usa Hash para baselineSFI por thread
3. **ANSI colors** — mensagens coloridas no console
4. **Log file** — mensagens podem ser escritas em arquivo

---

### 1.2 ⭐ Log.rb — Sistema de Logging com Segmentos

**Responsabilidade:** Logging segmentado com filtros e progress meter.

**Estrutura:**
```typescript
class Log {
  static instance: Log;  // Singleton
  
  static level: number;  // Nível máximo de aninhamento
  static stack: string[];  // Stack de segmentos abertos
  static segments: string[];  // Lista de segmentos a mostrar
  static silent: boolean;  // Modo silencioso
  static progress: number;  // Progresso atual (0.0-1.0)
  static progressMeter: string;  // Texto do progress meter
  
  static enter(segment: string, message: string): void;
  static exit(segment: string, message?: string): void;
  static msg(block: () => string): void;
  static status(message: string): void;
  
  static startProgressMeter(text: string): void;
  static stopProgressMeter(): void;
  static activity(): void;
  static progress(percent: number): void;
}
```

**Integração:**
- Usado por Project.schedule(), generateReports(), etc.
- `enter()`/`exit()` marcam início/fim de segmentos
- `msg()` avalia bloco apenas se mensagem será mostrada (lazy evaluation)
- Progress meter mostra barra de progresso animada

**Pontos Críticos:**
1. **Segment filtering** — pode limitar output a segmentos específicos
2. **Lazy evaluation** — bloco só é avaliado se mensagem será mostrada
3. **Progress meter** — barra de progresso com porcentagem
4. **Activity indicator** — animação `- \ | /` para operações longas

---

### 1.3 ⭐ Interval.rb — Classes de Intervalo

**Responsabilidade:** Modela intervalos de tempo e scoreboard.

**Estrutura:**
```typescript
// Classe base
class Interval<S, E> {
  start: S;
  end: E;
  
  contains?(arg: Interval | S): boolean;
  overlaps?(arg: Interval | S): boolean;
  intersection(iv: Interval): Interval | null;
  combine(iv: Interval): Interval;
}

// Intervalo de tempo (TjTime)
class TimeInterval extends Interval<TjTime, TjTime> {
  duration: number;  // em segundos
  
  to_s(): string;
}

// Intervalo de scoreboard (índices)
class ScoreboardInterval extends Interval<number, number> {
  sbStart: TjTime;  // Data de início do scoreboard
  slotDuration: number;  // Duração de cada slot em segundos
  
  startDate: TjTime;  // Converte start para TjTime
  endDate: TjTime;  // Converte end para TjTime
  
  private dateToIndex(date: TjTime): number;
  private indexToDate(index: number): TjTime;
}
```

**Integração:**
- `TimeInterval` usado em Booking, Leave, Charge, etc.
- `ScoreboardInterval` usado em Limits, ShiftAssignments
- Conversão automática entre datas e índices

**Pontos Críticos:**
1. **Type safety** — Interval é genérico sobre tipos S e E
2. **Conversão automática** — ScoreboardInterval converte datas/índices
3. **Operações** — contains, overlaps, intersection, combine
4. **Validação** — end deve ser >= start

---

### 1.4 ⭐ IntervalList.rb — Lista de Intervalos

**Responsabilidade:** Lista ordenada de intervalos não-sobrepostos.

**Estrutura:**
```typescript
class IntervalList<T extends Interval> extends Array<T> {
  // Interseção de duas listas (O(n+m))
  &(list: IntervalList<T>): IntervalList<T>;
  
  // Append com merge automático se adjacente
  <<(iv: T): this;
}
```

**Algoritmo de Interseção:**
```typescript
&(list: IntervalList<T>): IntervalList<T> {
  const res = new IntervalList<T>();
  let si = 0, li = 0;
  
  while (si < this.length && li < list.length) {
    if (this[si].start < list[li].start) {
      if (this[si].end <= list[li].start) {
        si++;  // Não sobrepõe
      } else if (this[si].end < list[li].end) {
        res.push(new this[si].constructor(list[li].start, this[si].end));
        si++;
      } else {
        res.push(new this[si].constructor(list[li].start, list[li].end));
        li++;
      }
    } else if (list[li].start < this[si].start) {
      // ... simétrico
    } else {
      // Starts iguais
      if (this[si].end === list[li].end) {
        res.push(this[si]);
        si++; li++;
      } else if (this[si].end < list[li].end) {
        res.push(this[si]);
        si++;
      } else {
        res.push(list[li]);
        li++;
      }
    }
  }
  
  return res;
}
```

**Integração:**
- Usado em `collectTimeOffIntervals()` do ResourceScenario
- Usado em `collectIntervals()` do Scoreboard
- Merge automático de intervalos adjacentes

**Pontos Críticos:**
1. **Ordenação** — intervalos devem ser adicionados em ordem ascendente
2. **Não-sobreposição** — raise se intervalos sobrepõem
3. **Merge automático** — se end == start do próximo, merge
4. **Complexidade** — interseção é O(n+m)

---

### 1.5 KateSyntax.rb — Syntax Highlighting para Kate

**Responsabilidade:** Gera arquivo de syntax highlighting para Kate editor.

**Estrutura:**
```typescript
class KateSyntax {
  reference: SyntaxReference;
  properties: KeywordDocumentation[];
  attributes: KeywordDocumentation[];
  
  generate(file: string): void;
  
  private header(): void;
  private footer(): void;
  private keywords(): void;
  private contexts(): void;
  private highlights(): void;
}
```

**Integração:**
- Usa `SyntaxReference` para extrair keywords
- Gera arquivo XML no formato do Kate
- Separa properties (blocos) de attributes (keywords)

**Pontos Críticos:**
1. **Gerador de código** — não é parte do engine, é ferramenta de desenvolvimento
2. **XML output** — formato específico do Kate
3. **Regex patterns** — define padrões para datas, números, strings, etc.

---

## 🎯 2. PRÓXIMOS 5 ARQUIVOS SUGERIDOS

Para completar o engine, os 5 arquivos mais críticos que faltam são os **componentes do Gantt Chart**:

### 1. ⭐ `lib/taskjuggler/reports/GanttTaskBar.rb`
**Barra de tarefa no Gantt** — representa tasks leaf no chart.

> **Por que é essencial:** Sem ele, tasks não aparecem no Gantt Chart. É o elemento visual mais importante.

**Conteúdo esperado:**
```typescript
class GanttTaskBar {
  query: Query;
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
  
  startDepLineStart: [number, number];
  endDepLineStart: [number, number];
  startDepLineEnd: [number, number];
  endDepLineEnd: [number, number];
}
```

---

### 2. ⭐ `lib/taskjuggler/reports/GanttMilestone.rb`
**Milestone no Gantt** — representa milestones como losangos.

> **Por que é essencial:** Sem ele, milestones não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttMilestone {
  height: number;
  x: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 3. ⭐ `lib/taskjuggler/reports/GanttContainer.rb`
**Container task no Gantt** — representa tasks com sub-tasks como barras com colchetes.

> **Por que é essencial:** Sem ele, tasks container não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttContainer {
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 4. ⭐ `lib/taskjuggler/reports/GanttLoadStack.rb`
**Load stack no Gantt** — representa alocação de resources em tasks aninhadas.

> **Por que é essencial:** Sem ele, não há visualização de carga de recursos em tasks aninhadas.

**Conteúdo esperado:**
```typescript
class GanttLoadStack {
  line: GanttLine;
  x: number;
  width: number;
  values: number[];
  categories: string[];
  
  to_html(): XMLElement[];
}
```

---

### 5. ⭐ `lib/taskjuggler/reports/GanttHeader.rb`
**Header do Gantt Chart** — renderiza as escalas temporais no topo.

> **Por que é essencial:** Sem ele, o Gantt Chart não tem header com datas.

**Conteúdo esperado:**
```typescript
class GanttHeader {
  columnDef: TableColumnDefinition;
  chart: GanttChart;
  height: number;
  gridLines: number[];
  cellStartDates: TjTime[];
  nowLineX: number;
  markdateLineX: number | null;
  
  to_html(): XMLElement;
}
```

---

## 📋 3. CHECKLIST ATUALIZADO

### ✅ Já analisados (65+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Fase 10**: MessageHandler, Log, Interval, IntervalList, KateSyntax ⭐

### 🎯 Próximos 5 (Fase 11 - Componentes do Gantt)
- [ ] **GanttTaskBar.rb** ⭐
- [ ] **GanttMilestone.rb** ⭐
- [ ] **GanttContainer.rb** ⭐
- [ ] **GanttLoadStack.rb** ⭐
- [ ] **GanttHeader.rb** ⭐

### 🔮 Futuros (Fase 12 - Final)
- [ ] `GanttRouter.rb` — roteamento de dependency arrows
- [ ] `HTMLGraphics.rb` — helpers SVG/HTML
- [ ] `AccountListRE.rb` — relatório de contas
- [ ] `ExportRE.rb`, `TraceReport.rb` — outros tipos de relatórios
- [ ] `BatchProcessor.rb` — paralelismo

---

## 🎁 4. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. MessageHandler em ação
const handler = MessageHandlerInstance.instance;
handler.outputLevel = 4;  // info
handler.logFile = 'taskjuggler.log';

try {
  task.schedule(scenarioIdx);
} catch (e) {
  handler.error('schedule_failed', e.message, task.sourceFileInfo);
}

// 2. Log em ação
Log.level = 2;
Log.segments = ['scheduler'];
Log.startProgressMeter('Scheduling scenario plan');

Log.enter('scheduleTask', `Scheduling task ${task.fullId}`);
task.schedule(scenarioIdx);
Log.exit('scheduleTask', 'Task scheduled');

Log.progress(0.5);  // 50% completo
Log.activity();  // Mostra animação

Log.stopProgressMeter();

// 3. Interval em ação
const interval = new TimeInterval(new TjTime('2026-01-01'), new TjTime('2026-01-31'));
console.log(interval.duration);  // 2592000 segundos (30 dias)

const sbInterval = new ScoreboardInterval(
  project.get('start'),
  project.get('scheduleGranularity'),
  0,  // start index
  100  // end index
);
console.log(sbInterval.startDate);  // Converte para TjTime
console.log(sbInterval.endDate);

// 4. IntervalList em ação
const list1 = new IntervalList<TimeInterval>();
list1.push(new TimeInterval(new TjTime('2026-01-01'), new TjTime('2026-01-10')));
list1.push(new TimeInterval(new TjTime('2026-01-15'), new TjTime('2026-01-20')));

const list2 = new IntervalList<TimeInterval>();
list2.push(new TimeInterval(new TjTime('2026-01-05'), new TjTime('2026-01-18')));

const intersection = list1 & list2;
// Resultado: [2026-01-05, 2026-01-10], [2026-01-15, 2026-01-18]

// 5. KateSyntax (ferramenta de desenvolvimento)
const kate = new KateSyntax();
kate.generate('taskjuggler.xml');
// Gera arquivo XML para Kate editor
```

---

**Resumo:** Anexe `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb` e `GanttHeader.rb` para completar os **componentes visuais do Gantt Chart**. 🚀