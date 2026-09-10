# 📘 Blueprint Fase 14: Atributos Base + Shifts + Expansão de Queries + Legenda

## 🎯 Objetivo
Analisar os 5 arquivos que completam:
- **Sistema de atributos base** (`AttributeBase.rb`)
- **Entidade Shift completa** (`Shift.rb` + `ShiftScenario.rb`)
- **Expansão de queries em strings** (`SimpleQueryExpander.rb`)
- **Legenda de relatórios** (`ReportTableLegend.rb`)

---

## 🏗️ 1. ATTRIBUTEBASE.RB — Base de Todos os Atributos

### 1.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base** | Superclasse de todos os tipos de atributos |
| **Tracking de origem** | `provided`, `inherited`, `computed` |
| **Modo global** | `@@mode` controla como valores são marcados |
| **Deep copy** | Suporta clonagem profunda |
| **ListAttributeBase** | Subclasse para atributos lista |

### 1.2 Estrutura Interna

```typescript
class AttributeBase {
  @property: PropertyTreeNode;
  @type: AttributeDefinition;
  @container: PropertyTreeNode | ScenarioData;
  @provided: boolean = false;
  @inherited: boolean = false;
  
  // Modo global (compartilhado entre todas as instâncias)
  static mode: 0 | 1 | 2 = 0;
  // 0 = provided (usuário setou)
  // 1 = inherited (herdado)
  // 2 = computed (calculado pelo scheduler)
  
  constructor(property: PropertyTreeNode, type: AttributeDefinition, 
              container: PropertyTreeNode | ScenarioData);
  
  reset(): void;
  inherit(value: any): void;
  set(value: any): void;
  get(): any;
  isList(): boolean;
  to_s(query?: Query): string;
  to_num(): number | null;
  to_sort(): any;
  to_rti(query: Query): RichTextIntermediate | null;
  to_tjp(): string;
}

class ListAttributeBase extends AttributeBase {
  isList(): boolean { return true; }
}

class AttributeOverwrite extends ArgumentError {}
```

### 1.3 Método set() — CRÍTICO

```typescript
set(value: any): void {
  switch (AttributeBase.mode) {
    case 0: this.@provided = true; break;
    case 1: this.@inherited = true; break;
  }
  // Armazena no container (PropertyTreeNode ou ScenarioData)
  this.@container[`@${this.type.id}`] = value;
}
```

### 1.4 Método inherit() — Deep Copy

```typescript
inherit(value: any): void {
  this.@inherited = true;
  // Deep copy para evitar compartilhamento acidental
  this.@container[`@${this.type.id}`] = value.deep_clone();
}
```

### 1.5 Pontos Críticos

1. **`@@mode` é global** — afeta TODOS os atributos simultaneamente
2. **`inherit()` faz deep copy** — essencial para evitar compartilhamento
3. **`ListAttributeBase`** — sempre retorna `isList() = true`
4. **`AttributeOverwrite`** — exceção lançada quando sobrescreve valor não-lista

---

## 🔄 2. SHIFT.RB + SHIFTSCENARIO.RB — Entidade Shift Completa

### 2.1 Shift.rb

```typescript
class Shift extends PropertyTreeNode {
  constructor(project: Project, id: string, name: string, parent: Shift | null) {
    super(project.shifts, id, name, parent);
    project.addShift(this);
    
    // Um ShiftScenario por cenário
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ShiftScenario(this, i, this.scenarioAttributes[i])
    );
  }
  
  // Delegação via method_missing
  method_missing(func: string, scenarioIdx: number, ...args: any[]): any {
    return this.data[scenarioIdx][func](...args);
  }
  
  scenario(scenarioIdx: number): ShiftScenario {
    return this.data[scenarioIdx];
  }
}
```

### 2.2 ShiftScenario.rb

```typescript
class ShiftScenario extends ScenarioData {
  // Retorna true se o shift tem horário de trabalho definido para a data
  onShift?(date: TjTime): boolean {
    return this.a('workinghours').onShift?(date);
  }
  
  // Retorna true se o shift tem substituição de leaves globais
  replace?(): boolean {
    return this.a('replace');
  }
  
  // Retorna true se o shift tem leave definido para a data
  onLeave?(date: TjTime): boolean {
    for (const leave of this.a('leaves')) {
      if (leave.interval.contains?(date)) return true;
    }
    return false;
  }
}
```

### 2.3 Atributos do Shift (definidos em Project.rb)

```typescript
const shiftAttributes = [
  ['bsi',          'BSI',           StringAttribute,        false, false, false, ""],
  ['id',           'ID',            StringAttribute,        false, false, false, null],
  ['index',        'Index',         IntegerAttribute,       false, false, false, -1],
  ['leaves',       'Leaves',        LeaveListAttribute,     true,  true,  true,  LeaveList.new],
  ['name',         'Name',          StringAttribute,        false, false, false, null],
  ['replace',      'Replace',       BooleanAttribute,       true,  false, true,  false],
  ['seqno',        'No',            IntegerAttribute,       false, false, false, null],
  ['timezone',     'Time Zone',     StringAttribute,        true,  true,  true,  TjTime.timeZone],
  ['tree',         'Tree Index',    StringAttribute,        false, false, false, ""],
  ['workinghours', 'Working Hours', WorkingHoursAttribute,  true,  true,  true,  null],
];
```

### 2.4 Integração com ShiftAssignments

```typescript
// Em ShiftAssignments.rb (já analisado):
// ShiftAssignment usa ShiftScenario para verificar:
// - assigned?(date) → intervalo de atribuição
// - onShift?(date) → horário de trabalho
// - onLeave?(date) → leave definido
// - replace?(date) → substitui leaves globais
```

---

## 🔍 3. SIMPLEQUERYEXPANDER.RB — Expansão de Queries em Strings

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Expansão de queries** | Substitui `<-name->` pelo valor do atributo |
| **Uso em templates** | Usado em títulos de colunas, legendas, etc. |
| **Contexto via Query** | Usa Query para avaliar atributos |

### 3.2 Estrutura Interna

```typescript
class SimpleQueryExpander {
  @inputStr: string;
  @query: Query;
  @sourceFileInfo: SourceFileInfo;
  
  constructor(inputStr: string, query: Query, sourceFileInfo: SourceFileInfo);
  
  expand(): string;
}
```

### 3.3 Método expand() — CRÍTICO

```typescript
expand(): string {
  let str = this.@inputStr.dup();
  
  // Substitui <-scenario-> pelo nome do cenário
  if (this.@query.scenarioIdx) {
    str = str.replace(/<-scenario->/g,
      this.@query.project.scenario(this.@query.scenarioIdx).id);
  }
  
  // Substitui <-name-> pelo valor do atributo
  str = str.replace(/<-[a-zA-Z][_a-zA-Z]*->/g, (match) => {
    const attribute = match.slice(2, -2);
    this.@query.attributeId = attribute;
    this.@query.process();
    
    if (this.@query.ok) {
      return this.@query.to_s();
    } else {
      this.error('sqe_expand_failed', 
        `Unknown attribute ${attribute}`, this.@sourceFileInfo);
      return '';
    }
  });
  
  return str;
}
```

### 3.4 Uso no TraceReport

```typescript
// No TraceReport (não analisado ainda):
// Títulos de colunas podem conter queries:
// "<-id->:<-scenario->.effort" → "t1:plan.effort"
```

### 3.5 Pontos Críticos

1. **Sintaxe `<-name->`** — delimitadores específicos do TaskJuggler
2. **`<-scenario->`** — caso especial tratado separadamente
3. **Erros geram warning** — não aborta a expansão
4. **Usa Query.process()** — herda todo o sistema de queries

---

## 📋 4. REPORTTABLELEGEND.RB — Legenda de Relatórios

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Legenda do Gantt** | Símbolos do Gantt chart (container, task, milestone) |
| **Legenda do Calendar** | Cores de calendário (busy, loaded, free, offduty) |
| **HTML rendering** | Gera tabela HTML com símbolos e descrições |

### 4.2 Estrutura Interna

```typescript
class ReportTableLegend {
  @showGanttItems: boolean = false;
  @ganttItems: [string, string][] = [];   // [text, color]
  @calendarItems: [string, string][] = []; // [text, color]
  
  addGanttItem(text: string, color: string): void;
  addCalendarItem(text: string, color: string): void;
  to_html(): XMLElement;
}
```

### 4.3 Método to_html() — CRÍTICO

```typescript
to_html(): XMLElement {
  if (!this.@showGanttItems && this.@ganttItems.empty() && 
      this.@calendarItems.empty()) {
    return null;
  }
  
  const frame = new XMLElement('div', { class: 'tj_table_legend_frame' });
  const legend = new XMLElement('table', { 
    class: 'tj_table_legend', 
    cellspacing: '1' 
  });
  
  // Headline "Gantt Chart Symbols:"
  legend.append(this.headlineToHTML('Gantt Chart Symbols:'));
  
  // Símbolos do Gantt (se showGanttItems)
  if (this.@showGanttItems) {
    const row = new XMLElement('tr', { class: 'tj_legend_row' });
    row.append(this.ganttItemToHTML(
      new GanttContainer(15, 10, 35, 0), 'Container Task', 40));
    row.append(this.ganttItemToHTML(
      new GanttTaskBar(null, 15, 5, 35, 0), 'Normal Task', 40));
    row.append(this.ganttItemToHTML(
      new GanttMilestone(15, 10, 0), 'Milestone', 20));
    row.append(new XMLElement('td', { class: 'tj_legend_spacer' }));
    legend.append(row);
  }
  
  // Itens customizados do Gantt
  legend.append(this.itemsToHTML(this.@ganttItems));
  
  // Headline "Calendar Symbols:"
  legend.append(this.headlineToHTML('Calendar Symbols:'));
  
  // Itens do calendário
  legend.append(this.itemsToHTML(this.@calendarItems));
  
  frame.append(legend);
  return frame;
}
```

### 4.4 Integração com GanttLine e TableReport

```typescript
// Em GanttLine.rb (já analisado):
// Adiciona itens à legenda:
this.@chart.table.legend.addGanttItem('Off-duty period', 'offduty');
this.@chart.table.legend.addGanttItem('Resource assigned to task(s)', 'busy');

// Em TableReport.rb (já analisado):
// A legenda é renderizada após a tabela:
html.append(this.@legend.to_html());
```

### 4.5 Pontos Críticos

1. **`showGanttItems`** — flag para mostrar símbolos padrão do Gantt
2. **Deduplicação** — `addGanttItem` e `addCalendarItem` evitam duplicatas
3. **Layout em grid** — 3 itens por linha na legenda
4. **Usa GanttContainer/TaskBar/Milestone** — renderiza símbolos reais

---

## 📊 5. PIPELINE ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    AttributeBase (Base)                          │
│  └── Todos os atributos herdam dele                             │
│  └── Mode: provided (0) | inherited (1) | computed (2)          │
│  └── ListAttributeBase para atributos lista                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shift + ShiftScenario                         │
│  └── Shift: PropertyTreeNode com ShiftScenario por cenário      │
│  └── ShiftScenario: onShift?(), onLeave?(), replace?()          │
│  └── Usado por ShiftAssignments para controlar horários         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SimpleQueryExpander                           │
│  └── Expande <-name-> em strings                                │
│  └── Usa Query para avaliar atributos                           │
│  └── Usado em títulos de colunas, legendas, etc.                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ReportTableLegend                             │
│  └── Legenda do Gantt chart e calendário                        │
│  └── Renderiza símbolos (container, task, milestone)            │
│  └── Renderiza cores (busy, loaded, free, offduty)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 6. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 6.1 AttributeBase com Generics

```typescript
abstract class AttributeBase<T = any> {
  protected @property: PropertyTreeNode;
  protected @type: AttributeDefinition;
  protected @container: PropertyTreeNode | ScenarioData;
  protected @provided: boolean = false;
  protected @inherited: boolean = false;
  
  static mode: 0 | 1 | 2 = 0;
  
  abstract get(): T;
  abstract set(value: T): void;
  abstract isList(): boolean;
  
  inherit(value: T): void {
    this.@inherited = true;
    this.set(value.deep_clone());
  }
}
```

### 6.2 Shift com Generics

```typescript
class Shift extends PropertyTreeNode<PropertySet<Shift>, ShiftScenario> {
  constructor(project: Project, id: string, name: string, parent: Shift | null) {
    super(project.shifts, id, name, parent);
    project.addShift(this);
    
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ShiftScenario(this, i, this.scenarioAttributes[i])
    );
  }
}
```

### 6.3 SimpleQueryExpander com Regex

```typescript
class SimpleQueryExpander {
  expand(): string {
    let str = this.inputStr;
    
    // Substitui <-scenario->
    if (this.query.scenarioIdx !== undefined) {
      str = str.replace(/<-scenario->/g,
        this.query.project.scenario(this.query.scenarioIdx).id);
    }
    
    // Substitui <-name->
    str = str.replace(/<-[a-zA-Z][_a-zA-Z]*->/g, (match) => {
      const attribute = match.slice(2, -2);
      this.query.attributeId = attribute;
      this.query.process();
      
      if (this.query.ok) {
        return this.query.to_s();
      } else {
        this.error('sqe_expand_failed', 
          `Unknown attribute ${attribute}`, this.sourceFileInfo);
        return '';
      }
    });
    
    return str;
  }
}
```

### 6.4 ReportTableLegend com Builder

```typescript
class ReportTableLegend {
  private ganttItems: [string, string][] = [];
  private calendarItems: [string, string][] = [];
  private showGanttItems: boolean = false;
  
  addGanttItem(text: string, color: string): void {
    if (!this.ganttItems.some(([t, c]) => t === text && c === color)) {
      this.ganttItems.push([text, color]);
    }
  }
  
  addCalendarItem(text: string, color: string): void {
    if (!this.calendarItems.some(([t, c]) => t === text && c === color)) {
      this.calendarItems.push([text, color]);
    }
  }
}
```

---

## 📋 7. CHECKLIST ATUALIZADO

### ✅ Já analisados (80+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation, TextParser
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift ⭐, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes, AttributeBase ⭐
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query, SimpleQueryExpander ⭐
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition, ReportTableLegend ⭐
- [x] **Gantt**: GanttChart, GanttLine, GanttHeader, GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal, MessageHandler, Log
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Utilitários**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy, deep_copy, TernarySearchTree, KateSyntax

### 🔮 Próximos 5 (Fase 15 - Completar Reports)
- [ ] **`reports/ReportBase.rb`** ⭐ — Base de todos os relatórios
- [ ] **`reports/ReportContext.rb`** ⭐ — Contexto de relatórios
- [ ] **`reports/GanttRouter.rb`** ⭐ — Roteamento de dependency arrows
- [ ] **`reports/HTMLGraphics.rb`** ⭐ — Helpers gráficos (rectToHTML, lineToHTML, etc.)
- [ ] **`reports/AccountListRE.rb`** ⭐ — Relatório de contas (balance)

---

## 🎁 8. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. AttributeBase em ação
const attr = new StringAttribute(property, attrDef, container);
AttributeBase.setMode(0);  // provided
attr.set('value');  // attr.provided = true

AttributeBase.setMode(1);  // inherited
attr.inherit('inherited_value');  // attr.inherited = true, deep copy

AttributeBase.setMode(2);  // computed
attr.set('computed_value');  // modo computed

// 2. Shift em ação
const shift = new Shift(project, 'morning', 'Morning Shift', null);
shift['workinghours', 0].setWorkingHours(1, [[6 * 3600, 14 * 3600]]);
shift['leaves', 0] += [new Leave('holiday', interval, 'Christmas')];

// ShiftScenario verifica:
const scenario = shift.scenario(0);
console.log(scenario.onShift?(new TjTime('2026-01-05-10:00')));  // true
console.log(scenario.onLeave?(new TjTime('2026-12-25')));  // true

// 3. SimpleQueryExpander em ação
const expander = new SimpleQueryExpander(
  '<-id->:<-scenario->.effort',
  query,
  sourceFileInfo
);
console.log(expander.expand());  // "t1:plan.effort"

// 4. ReportTableLegend em ação
const legend = new ReportTableLegend();
legend.showGanttItems = true;
legend.addGanttItem('Off-duty period', 'offduty');
legend.addCalendarItem('Resource is busy', 'busy1');

const html = legend.to_html();
// Gera tabela HTML com símbolos e descrições
```

---

**Fim da Fase 14.** Anexe `ReportBase.rb`, `ReportContext.rb`, `GanttRouter.rb`, `HTMLGraphics.rb` e `AccountListRE.rb` para completar o **sistema de relatórios**. 🚀