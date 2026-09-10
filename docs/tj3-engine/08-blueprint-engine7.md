# 📘 Blueprint Fase 8: Relatórios Específicos + Gantt Chart

## 🎯 Objetivo
Analisar os 5 arquivos que implementam os **relatórios específicos** (TaskListRE, ResourceListRE, TextReport), a **estrutura de linhas de tabela** (ReportTableLine) e o **gráfico Gantt** (GanttChart). Estes completam o pipeline final de geração de relatórios.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── dispatch por typeSpec:                                  │
│          ├── :taskreport     → TaskListRE    ◄── TaskListRE.rb   │
│          ├── :resourcereport → ResourceListRE ◄── ResourceListRE.rb
│          ├── :textreport     → TextReport    ◄── TextReport.rb   │
│          ├── :accountreport  → AccountListRE                     │
│          ├── :export         → ExportRE                          │
│          ├── :tracereport    → TraceReport                       │
│          ├── :iCal           → ICalReport                        │
│          ├── :niku           → NikuReport                        │
│          └── :tagfile        → TagFile                           │
│                                                                  │
│  └── generateHTML()                                              │
│      └── content.to_html()                                       │
│          └── ReportTable                                         │
│              └── ReportTableLine  ◄── ReportTableLine.rb         │
│                  └── ReportTableCell                             │
│                      └── GanttChart (se coluna chart) ◄── GanttChart.rb
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. TASKLISTRE.RB — Relatório de Tarefas

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de TableReport** | Implementa listagem de tarefas |
| **Prepara listas** | TaskList + ResourceList com sorting |
| **Filtra tarefas** | Aplica hideTask, rollupTask, openNodes |
| **Gera header** | Uma coluna por atributo |
| **Gera linhas** | Para cada task + resources aninhados |

### 2.2 Estrutura Interna

```typescript
class TaskListRE extends TableReport {
  @table: ReportTable;
  
  constructor(report: Report) {
    super(report);
    this.table = new ReportTable();
    this.table.selfcontained = report.get('selfcontained');
    this.table.auxDir = report.get('auxdir');
  }
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // 1. Prepara lista de tarefas
    const taskList = new PropertyList(this.project.tasks);
    taskList.includeAdopted();
    taskList.setSorting(this.report.get('sortTasks'));
    taskList.query = this.report.project.reportContexts.last.query;
    
    taskList = this.filterTaskList(
      taskList, 
      null, 
      this.report.get('hideTask'),
      this.report.get('rollupTask'),
      this.report.get('openNodes')
    );
    taskList.sort();
    taskList.checkForDuplicates(this.report.sourceFileInfo);
    
    // 2. Prepara lista de recursos (NÃO filtra ainda!)
    const resourceList = new PropertyList(this.project.resources);
    resourceList.setSorting(this.report.get('sortResources'));
    resourceList.query = this.report.project.reportContexts.last.query;
    resourceList.sort();
    
    // 3. Gera header da tabela
    for (const columnDescr of this.report.get('columns')) {
      this.adjustColumnPeriod(columnDescr, taskList, this.report.get('scenarios'));
      this.generateHeaderCell(columnDescr);
    }
    
    // 4. Gera lista
    this.generateTaskList(taskList, resourceList, null);
  }
}
```

### 2.3 Pontos Críticos

1. **ResourceList NÃO é filtrado antes!** Isso quebraria as funções lógicas `isdutyof()`, `isresponsibilityof()`, etc.

2. **includeAdopted()** inclui tarefas adotadas via `adopt` keyword.

3. **checkForDuplicates()** detecta tarefas duplicadas em relatórios (importante quando há `adopt`).

4. **generateTaskList()** é herdado de `TableReport` e recursivamente aninha resources.

---

## 📋 3. RESOURCELISTRE.RB — Relatório de Recursos

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de TableReport** | Implementa listagem de recursos |
| **Filtra recursos** | Aplica hideResource, rollupResource, openNodes |
| **Coleta tarefas atribuídas** | Para cada recurso, quais tasks ele está alocado |
| **Gera linhas** | Para cada resource + tasks aninhados |

### 3.2 Estrutura Interna

```typescript
class ResourceListRE extends TableReport {
  @table: ReportTable;
  
  constructor(report: Report) {
    super(report);
    this.table = new ReportTable();
    this.table.selfcontained = report.get('selfcontained');
    this.table.auxDir = report.get('auxdir');
  }
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // 1. Prepara lista de recursos
    const resourceList = new PropertyList(this.project.resources);
    resourceList.setSorting(this.report.get('sortResources'));
    resourceList.query = this.report.project.reportContexts.last.query;
    
    resourceList = this.filterResourceList(
      resourceList, 
      null,
      this.report.get('hideResource'),
      this.report.get('rollupResource'),
      this.report.get('openNodes')
    );
    resourceList.sort();
    
    // 2. Prepara lista de tarefas (NÃO filtra ainda!)
    const taskList = new PropertyList(this.project.tasks);
    taskList.setSorting(this.report.get('sortTasks'));
    taskList.query = this.report.project.reportContexts.last.query;
    taskList.sort();
    
    // 3. Coleta tarefas atribuídas a cada resource
    const assignedTaskList: Task[] = [];
    for (const resource of resourceList) {
      const tasks = this.filterTaskList(
        taskList, 
        resource,
        this.report.get('hideTask'),
        this.report.get('rollupTask'),
        this.report.get('openNodes')
      );
      assignedTaskList.push(...tasks);
    }
    assignedTaskList.unique();
    
    // 4. Gera header
    for (const columnDescr of this.report.get('columns')) {
      this.adjustColumnPeriod(columnDescr, assignedTaskList, this.report.get('scenarios'));
      this.generateHeaderCell(columnDescr);
    }
    
    // 5. Gera lista
    this.generateResourceList(resourceList, taskList, null);
  }
}
```

### 3.3 Diferença Chave vs TaskListRE

```
TaskListRE:
  - Filtra tasks ANTES
  - Para cada task, mostra resources atribuídos
  - Usa filterTaskList() primeiro

ResourceListRE:
  - Filtra resources ANTES
  - Para cada resource, mostra tasks atribuídas
  - Usa filterResourceList() primeiro
  - assignedTaskList é usado apenas para ajustar período das colunas
```

---

## 📝 4. TEXTREPORT.RB — Relatório de Texto

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Relatório mais simples** | 5 seções RichText: header, left, center, right, footer |
| **Layout flexível** | Larguras calculadas baseado em quais seções existem |
| **Suporta HTML** | Gera tabela com colunas left/center/right |
| **CSV não suportado** | Emite warning |

### 4.2 Estrutura Interna

```typescript
class TextReport extends ReportBase {
  @header: RichTextIntermediate | null;
  @left: RichTextIntermediate | null;
  @center: RichTextIntermediate | null;
  @right: RichTextIntermediate | null;
  @footer: RichTextIntermediate | null;
  
  @lWidth: number = 0;
  @cWidth: number = 0;
  @rWidth: number = 0;
  @lPadding: number = 0;
  @cPadding: number = 0;
  @rPadding: number = 0;
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // Calcula larguras baseado em quais seções existem
    if (this.a('center')) {
      if (this.a('left') && this.a('right')) {
        this.lWidth = this.rWidth = 20;
        this.cWidth = 60;
        this.lPadding = this.cPadding = 2;
      } else if (this.a('left') && !this.a('right')) {
        this.lWidth = 25;
        this.cWidth = 75;
        this.lPadding = 2;
      } else if (!this.a('left') && this.a('right')) {
        this.cWidth = 75;
        this.rWidth = 25;
        this.cPadding = 2;
      } else {
        this.cWidth = 100;
      }
    } else {
      if (this.a('left') && this.a('right')) {
        this.lWidth = this.rWidth = 50;
        this.lPadding = 2;
      } else if (this.a('left') && !this.a('right')) {
        this.lWidth = 100;
      } else if (!this.a('left') && this.a('right')) {
        this.rWidth = 100;
      }
    }
  }
  
  to_html(): XMLElement[] {
    const html: XMLElement[] = [];
    
    html.push(this.rt_to_html('header'));
    
    if (this.a('left') || this.a('center') || this.a('right')) {
      const table = new XMLElement('table', {
        class: 'tj_text_page',
        cellspacing: '0'
      });
      const row = new XMLElement('tr', { class: 'tj_text_row' });
      
      for (const section of ['left', 'center', 'right']) {
        const width = this[`${section[0]}Width`];
        const padding = this[`${section[0]}Padding`];
        
        if (this.a(section)) {
          const col = new XMLElement('td', {
            class: `tj_column_${section}`
          });
          let style = '';
          if (width > 0) style += `width:${width}%; `;
          if (padding > 0) style += `padding-right:${padding}%; `;
          col.attrs.style = style;
          col.append(this.rt_to_html(section));
          row.append(col);
        }
      }
      
      table.append(row);
      html.push(table);
    }
    
    html.push(this.rt_to_html('footer'));
    return html;
  }
  
  to_csv(): any[][] | null {
    this.report.warning('text_report_no_csv',
      `textreport '${this.report.fullId}' cannot be converted into CSV format`);
    return null;
  }
}
```

### 4.3 Lógica de Layout

```
┌─────────────────────────────────────────────────────────┐
│                         HEADER                           │
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│  LEFT    │         CENTER               │    RIGHT      │
│ (20-50%) │        (60-100%)             │   (20-50%)    │
│          │                              │               │
├──────────┴──────────────────────────────┴───────────────┤
│                         FOOTER                           │
└─────────────────────────────────────────────────────────┘
```

**Regras de largura:**
- Se tem center: center domina (60-100%)
- Se tem left+right: dividem 20-50% cada
- Se só center: 100%
- Se só left ou só right: 100%

---

## 📏 5. REPORTTABLELINE.RB — Linhas da Tabela

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha** | Cada linha da tabela é um ReportTableLine |
| **Contém cells** | Lista de ReportTableCell |
| **Gerencia estilo** | height, fontSize, bold, indentation |
| **Contadores** | no, lineNo, subLineNo |
| **Converte para HTML/CSV** | to_html(), to_csv() |

### 5.2 Estrutura Interna

```typescript
class ReportTableLine {
  @table: ReportTable;
  @property: PropertyTreeNode;
  @scopeLine: ReportTableLine | null;
  @cells: ReportTableCell[];
  
  // Estilo
  @height: number = 21;           // pixels
  @indentation: number = 0;       // pixels
  @fontSize: number = 12;         // pixels
  @bold: boolean = false;
  
  // Contadores
  @no: number | null = null;      // contador primário + nested
  @lineNo: number | null = null;  // contador de linhas primárias
  @subLineNo: number | null = null; // contador de todas as linhas
  
  constructor(table: ReportTable, property: PropertyTreeNode, 
              scopeLine: ReportTableLine | null) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    this.cells = [];
    
    // Registra a linha na tabela
    this.table.addLine(this);
  }
  
  // Retorna a última cell não-hidden
  last(count = 0): ReportTableCell | null {
    for (let i = 1 + count; i <= this.cells.length; i++) {
      if (!this.cells[this.cells.length - i].hidden) {
        return this.cells[this.cells.length - i];
      }
    }
    return null;
  }
  
  // Adiciona uma cell à linha
  addCell(cell: ReportTableCell): void {
    this.cells.push(cell);
  }
  
  // Retorna a scope property (para nested lines)
  scopeProperty(): PropertyTreeNode | null {
    return this.scopeLine ? this.scopeLine.property : null;
  }
  
  // Converte para HTML
  to_html(): XMLElement {
    let style = '';
    if (this.table.equiLines) style += `height:${this.height}px; `;
    if (this.fontSize) style += `font-size:${this.fontSize}px; `;
    
    const tr = new XMLElement('tr', {
      class: 'tabline',
      style: style
    });
    
    for (const cell of this.cells) {
      tr.append(cell.to_html());
    }
    
    return tr;
  }
  
  // Converte para CSV
  to_csv(csv: any[][], startColumn: number, lineIdx: number): number {
    let columnIdx = startColumn;
    for (const cell of this.cells) {
      columnIdx += cell.to_csv(csv, columnIdx, lineIdx);
    }
    return columnIdx - startColumn;
  }
}
```

### 5.3 Hierarquia de Linhas

```
ReportTable
├── ReportTableLine (header)
│   └── cells: ReportTableCell[]
├── ReportTableLine (primary task 1)
│   ├── cells: ReportTableCell[]
│   └── ReportTableLine (nested resource 1.1)
│       └── cells: ReportTableCell[]
│           └── scopeLine → primary task 1
├── ReportTableLine (primary task 2)
│   └── cells: ReportTableCell[]
└── ...
```

### 5.4 Contadores

```typescript
// no: contador que reinicia para cada conjunto nested
// lineNo: contador global de linhas primárias
// subLineNo: contador global de todas as linhas

// Exemplo:
// Task 1 (lineNo=1, subLineNo=1, no=1)
//   └── Resource 1.1 (lineNo=null, subLineNo=2, no=1)
//   └── Resource 1.2 (lineNo=null, subLineNo=3, no=2)
// Task 2 (lineNo=2, subLineNo=4, no=1)
//   └── Resource 2.1 (lineNo=null, subLineNo=5, no=1)
```

---

## 📊 6. GANTTCHART.RB — Gráfico Gantt

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela Gantt chart** | Abstração independente de formato |
| **Gerencia escalas** | hour, day, week, month, quarter, year |
| **Renderiza barras** | Task bars + milestones |
| **Renderiza dependências** | Dependency arrows |
| **Renderiza header** | Escala temporal no topo |
| **Suporta scrollbar** | Se viewWidth < width |

### 6.2 Estrutura Interna

```typescript
class GanttChart {
  static readonly SCROLLBARHEIGHT = 20;
  
  // Datas
  @start: TjTime | null;
  @end: TjTime | null;
  @now: TjTime;
  @markdate: TjTime | null;
  
  // Configuração
  @weekStartsMonday: boolean;
  @columnDef: TableColumnDefinition;
  @table: TableReport | null;
  
  // Escalas disponíveis
  static readonly scales = [
    { name: 'hour',    stepSize: 20, stepsToFunc: 'hoursTo',    minTimeOff: 5 * 60 },
    { name: 'day',     stepSize: 20, stepsToFunc: 'daysTo',     minTimeOff: 6 * 60 * 60 },
    { name: 'week',    stepSize: 20, stepsToFunc: 'weeksTo',    minTimeOff: 24 * 60 * 60 },
    { name: 'month',   stepSize: 35, stepsToFunc: 'monthsTo',   minTimeOff: 5 * 24 * 60 * 60 },
    { name: 'quarter', stepSize: 28, stepsToFunc: 'quartersTo', minTimeOff: -1 },
    { name: 'year',    stepSize: 20, stepsToFunc: 'yearsTo',    minTimeOff: -1 },
  ];
  
  @scale: Scale | null;
  @stepSize: number;
  
  // Dimensões
  @height: number = 0;
  @width: number = 0;
  @viewWidth: number | null;
  
  // Componentes
  @header: GanttHeader | null;
  @lines: GanttLine[];
  @router: GanttRouter | null;
  
  // Tasks indexed para dependency arrows
  @tasks: Map<Task, GanttLine[]>;
  @depArrows: [number, number][][];
  @arrowHeads: [number, number][];
  
  constructor(now: TjTime, weekStartsMonday: boolean, 
              columnDef: TableColumnDefinition, 
              table: TableReport | null = null,
              markdate: TjTime | null = null) {
    // ... inicialização
    this.tasks = new Map();
    this.lines = [];
    this.depArrows = [];
    this.arrowHeads = [];
  }
  
  // Adiciona task para dependency tracking
  addTask(task: Task, line: GanttLine): void {
    if (this.tasks.has(task)) {
      this.tasks.get(task)!.push(line);
    } else {
      this.tasks.set(task, [line]);
    }
  }
  
  // Gera chart baseado em escala
  generateByScale(periodStart: TjTime, periodEnd: TjTime, scaleName: string): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.scale = this.scaleByName(scaleName);
    this.stepSize = this.scale.stepSize;
    
    const steps = (this.start as any)[this.scale.stepsToFunc](this.end);
    this.width = this.stepSize * steps;
    
    this.header = new GanttHeader(this.columnDef, this);
  }
  
  // Gera chart baseado em largura
  generateByWidth(periodStart: TjTime, periodEnd: TjTime, width: number): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.width = width;
    // TODO: calcular scale automaticamente
  }
  
  // Converte para HTML
  to_html(): XMLElement {
    this.completeChart();
    
    const td = new XMLElement('td', {
      rowspan: `${2 + this.lines.length + (this.hasScrollbar() ? 1 : 0)}`,
      style: 'padding:0px; vertical-align:top;'
    });
    
    // Div externo com scrollbar
    const scrollDiv = new XMLElement('div', {
      class: 'tabback',
      style: `position:relative; overflow:auto; ` +
             `width:${this.hasScrollbar() ? this.viewWidth : this.width}px; ` +
             `height:${this.height + (this.hasScrollbar() ? GanttChart.SCROLLBARHEIGHT : 0)}px;`
    });
    
    // Div interno (conteúdo)
    const div = new XMLElement('div', {
      style: `margin:0px; padding:0px; position:absolute; overflow:hidden; ` +
             `top:0px; left:0px; width:${this.width}px; height:${this.height}px; ` +
             `font-size:10px;`
    });
    
    // Header
    div.append(this.header!.to_html());
    
    // Linhas do chart
    for (const line of this.lines) {
      div.append(line.to_html());
    }
    
    // Dependency arrows
    for (const arrow of this.depArrows) {
      let xx: number | null = null;
      let yy: number | null = null;
      
      for (const [x, y] of arrow) {
        if (xx !== null && yy !== null) {
          div.append(this.lineToHTML(xx, yy, x, y, 'depline'));
        }
        xx = x;
        yy = y;
      }
    }
    
    // Arrow heads
    for (const [x, y] of this.arrowHeads) {
      div.append(this.arrowHeadToHTML(x, y));
    }
    
    scrollDiv.append(div);
    td.append(scrollDiv);
    
    return td;
  }
  
  // Converte data para X position
  dateToX(date: TjTime): number {
    return Math.floor((this.width / (this.end! - this.start!)) * (date - this.start!));
  }
  
  // Verifica se precisa scrollbar
  hasScrollbar(): boolean {
    return this.viewWidth !== null && this.viewWidth < this.width;
  }
  
  // Calcula altura total e gera dependency arrows
  private completeChart(): void {
    // Calcula altura
    for (const line of this.lines) {
      if (line.y + line.height > this.height) {
        this.height = line.y + line.height;
      }
    }
    
    // Cria router para dependency lines
    this.router = new GanttRouter(this.width, this.height);
    
    // Bloqueia zonas (task bars, milestones, now line)
    for (const line of this.lines) {
      line.addBlockedZones(this.router);
    }
    
    // Protege linha "now"
    this.router.addZone(
      this.header!.nowLineX - 1, 0, 
      3, this.height - 1, 
      false, true
    );
    
    // Protege linha "markdate"
    if (this.header!.markdateLineX) {
      this.router.addZone(
        this.header!.markdateLineX - 1, 0,
        3, this.height - 1,
        false, true
      );
    }
    
    // Gera dependency arrows
    for (const [task, lines] of this.tasks) {
      this.generateDepLines(task, lines);
    }
    
    // Garante arrow heads únicos
    for (const line of this.depArrows) {
      const endPoint = line[line.length - 1];
      if (!this.arrowHeads.some(([x, y]) => x === endPoint[0] && y === endPoint[1])) {
        this.arrowHeads.push(endPoint);
      }
    }
  }
  
  // Gera dependency lines para uma task
  private generateDepLines(task: Task, lines: GanttLine[]): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const scenarioIdx = line.query.scenarioIdx;
      
      // Dependencies do start
      this.generateTaskDepLines(
        'startsuccs', task, scenarioIdx, lineIndex,
        ...line.getTask().startDepLineStart
      );
      
      // Dependencies do end
      this.generateTaskDepLines(
        'endsuccs', task, scenarioIdx, lineIndex,
        ...line.getTask().endDepLineStart
      );
    }
  }
  
  // Gera dependency lines de um tipo específico
  private generateTaskDepLines(
    kind: 'startsuccs' | 'endsuccs',
    task: Task, 
    scenarioIdx: number,
    lineIndex: number,
    startX: number, 
    startY: number
  ): void {
    const touples: [number, number, number, number][] = [];
    
    for (const [t, onEnd] of task[kind][scenarioIdx]) {
      // Pula dependencies herdadas e tasks fora do chart
      if ((t.parent && task.hasDependency(scenarioIdx, kind, t.parent, onEnd)) ||
          !this.tasks.has(t)) {
        continue;
      }
      
      const [endX, endY] = this.tasks.get(t)![lineIndex].getTask()
        [onEnd ? 'endDepLineEnd' : 'startDepLineEnd'];
      
      touples.push([startX, startY, endX, endY]);
    }
    
    if (touples.length > 0) {
      this.depArrows.push(...this.router!.routeLines(touples));
    }
  }
  
  private scaleByName(name: string): Scale {
    for (const scale of GanttChart.scales) {
      if (scale.name === name) return scale;
    }
    throw new Error(`Unknown scale ${name}`);
  }
}
```

### 6.3 Escalas do Gantt

| Escala | Step Size | Função | Min Time Off |
|---|---|---|---|
| hour | 20px | hoursTo | 5 min |
| day | 20px | daysTo | 6 hours |
| week | 20px | weeksTo | 1 day |
| month | 35px | monthsTo | 5 days |
| quarter | 28px | quartersTo | -1 (sempre mostra) |
| year | 20px | yearsTo | -1 (sempre mostra) |

### 6.4 Componentes do Gantt

```
┌─────────────────────────────────────────────────────────────┐
│  GanttHeader                                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  2026  |  2026  |  2026  |  2026  |  2026  |  2026   │  │
│  │  Q1    |  Q2    |  Q3    |  Q4    |  Q1    |  Q2     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Task 1  ██████████████████                            │  │
│  │  Task 2       ████████████████████                     │  │
│  │  Task 3                  ████████████                  │  │
│  │           ↑ now line                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Dependency arrows:                                         │
│  Task 1 ───────────────────┐                                │
│                            ↓                                │
│                          Task 3                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Dependency Arrow Routing

O `GanttRouter` é responsável por rotear as setas de dependência evitando sobreposição com task bars:

```typescript
// GanttRouter (não anexado, mas essencial)
class GanttRouter {
  @width: number;
  @height: number;
  @blockedZones: Zone[];
  
  // Rota linhas evitando zonas bloqueadas
  routeLines(touples: [number, number, number, number][]): [number, number][][] {
    // Algoritmo de roteamento ortogonal
    // Retorna array de polylines
  }
  
  // Adiciona zona bloqueada
  addZone(x: number, y: number, width: number, height: number, 
          blockHorizontal: boolean, blockVertical: boolean): void {
    this.blockedZones.push({ x, y, width, height, blockHorizontal, blockVertical });
  }
}
```

### 6.6 Pontos Críticos

1. **completeChart() é lazy!** Só é chamado em `to_html()`.

2. **viewWidth vs width**: Se `viewWidth < width`, mostra scrollbar horizontal.

3. **multiple scenarios**: Cada task pode ter múltiplas linhas (uma por cenário).

4. **dependency arrows são ortogonais**: Só linhas horizontais e verticais.

5. **blocked zones**: Task bars, milestones, now line, markdate line são zonas bloqueadas.

6. **dateToX() é linear**: Usa interpolação linear entre start e end.

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 8)

```
FASE 8A: Estrutura de Tabela
  1. ReportTableCell.ts        (célula individual)
  2. ReportTableLine.ts        (linha da tabela) ⭐
  3. ReportTable.ts            (tabela completa)
  4. TableReport.ts            (base para task/resource reports)

FASE 8B: Relatórios Específicos
  5. TextReport.ts             (mais simples) ⭐
  6. TaskListRE.ts             (relatório de tarefas) ⭐
  7. ResourceListRE.ts         (relatório de recursos) ⭐
  8. AccountListRE.ts          (relatório de contas)

FASE 8C: Gantt Chart
  9. GanttHeader.ts            (header do Gantt)
  10. GanttLine.ts             (linha do Gantt)
  11. GanttTaskBar.ts          (barra de tarefa)
  12. GanttMilestone.ts        (milestone)
  13. GanttRouter.ts           (roteamento de arrows)
  14. GanttChart.ts            (chart completo) ⭐
  15. HTMLGraphics.ts          (helpers SVG/HTML)

FASE 8D: Outros Relatórios
  16. ExportRE.ts
  17. TraceReport.ts
  18. ICalReport.ts
  19. NikuReport.ts
  20. TagFile.ts
  21. StatusSheetReport.ts
  22. TimeSheetReport.ts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 ReportTableLine Genérico
```typescript
class ReportTableLine {
  protected cells: ReportTableCell[] = [];
  
  addCell(cell: ReportTableCell): void {
    this.cells.push(cell);
  }
  
  // Template method para subclasses
  abstract to_html(): XMLElement;
  abstract to_csv(csv: any[][], startColumn: number, lineIdx: number): number;
}
```

#### 7.2.2 TableReport com Strategy Pattern
```typescript
abstract class TableReport extends ReportBase {
  protected table: ReportTable;
  
  // Template method
  abstract generateIntermediateFormat(): void;
  
  // Helpers compartilhados
  protected filterTaskList(
    taskList: PropertyList<Task>,
    resource: Resource | null,
    hideTask: LogicalExpression | null,
    rollupTask: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Task> {
    // Implementação de filtro
  }
  
  protected filterResourceList(
    resourceList: PropertyList<Resource>,
    task: Task | null,
    hideResource: LogicalExpression | null,
    rollupResource: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Resource> {
    // Implementação de filtro
  }
  
  protected adjustColumnPeriod(
    columnDescr: TableColumnDefinition,
    propertyList: PropertyList<PropertyTreeNode>,
    scenarios: Scenario[]
  ): void {
    // Ajusta período da coluna baseado nas propriedades
  }
  
  protected generateHeaderCell(columnDescr: TableColumnDefinition): void {
    // Gera cell do header
  }
}
```

#### 7.2.3 GanttChart com Builder Pattern
```typescript
class GanttChartBuilder {
  private chart: GanttChart;
  
  constructor(now: TjTime, weekStartsMonday: boolean, columnDef: TableColumnDefinition) {
    this.chart = new GanttChart(now, weekStartsMonday, columnDef);
  }
  
  period(start: TjTime, end: TjTime): this {
    this.chart.start = start;
    this.chart.end = end;
    return this;
  }
  
  scale(name: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'): this {
    this.chart.generateByScale(this.chart.start!, this.chart.end!, name);
    return this;
  }
  
  viewWidth(width: number): this {
    this.chart.viewWidth = width;
    return this;
  }
  
  addLine(line: GanttLine): this {
    this.chart.addLine(line);
    return this;
  }
  
  addTask(task: Task, line: GanttLine): this {
    this.chart.addTask(task, line);
    return this;
  }
  
  build(): GanttChart {
    return this.chart;
  }
}
```

#### 7.2.4 Escalas como Enum
```typescript
enum GanttScale {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

interface ScaleConfig {
  name: GanttScale;
  stepSize: number;
  stepsToFunc: keyof TjTime;
  minTimeOff: number;
}

const SCALES: ScaleConfig[] = [
  { name: GanttScale.HOUR, stepSize: 20, stepsToFunc: 'hoursTo', minTimeOff: 5 * 60 },
  { name: GanttScale.DAY, stepSize: 20, stepsToFunc: 'daysTo', minTimeOff: 6 * 60 * 60 },
  { name: GanttScale.WEEK, stepSize: 20, stepsToFunc: 'weeksTo', minTimeOff: 24 * 60 * 60 },
  { name: GanttScale.MONTH, stepSize: 35, stepsToFunc: 'monthsTo', minTimeOff: 5 * 24 * 60 * 60 },
  { name: GanttScale.QUARTER, stepSize: 28, stepsToFunc: 'quartersTo', minTimeOff: -1 },
  { name: GanttScale.YEAR, stepSize: 20, stepsToFunc: 'yearsTo', minTimeOff: -1 },
];
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **TaskListRE NÃO filtra ResourceList antes!** Filtrar quebraria `isdutyof()` e similares.

2. **ResourceListRE NÃO filtra TaskList antes!** Mesmo motivo.

3. **assignedTaskList** em ResourceListRE é só para ajustar período das colunas.

4. **TextReport não suporta CSV!** Emite warning e retorna null.

5. **GanttChart.completeChart() é lazy!** Só executa em to_html().

6. **GanttRouter** é crítico para dependency arrows não sobrepor task bars.

7. **viewWidth < width** → scrollbar horizontal.

8. **multiple scenarios** → múltiplas linhas por task.

9. **dateToX()** usa interpolação linear (não considera working hours).

10. **dependency arrows** são ortogonais (só horizontal/vertical).

11. **blocked zones** incluem task bars, milestones, now line, markdate line.

12. **arrow heads** são únicos por endpoint (evita duplicação).

13. **GanttHeader** tem duas linhas: superior (ano) e inferior (mês/semana/dia).

14. **now line** é renderizada como linha vertical vermelha.

15. **markdate line** é linha vertical customizada (se definida).

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (40 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableColumnDefinition, HTMLDocument
- [x] **Fase 8**: TaskListRE, ResourceListRE, TextReport, ReportTableLine, GanttChart ⭐

### 🔮 Próximos 5 (Fase 9 - Estrutura de Tabela + Gantt Components)
- [ ] `lib/taskjuggler/reports/ReportTable.rb` — Tabela completa
- [ ] `lib/taskjuggler/reports/ReportTableCell.rb` — Célula individual
- [ ] `lib/taskjuggler/reports/TableReport.rb` — Base para task/resource reports
- [ ] `lib/taskjuggler/reports/GanttHeader.rb` — Header do Gantt
- [ ] `lib/taskjuggler/reports/GanttLine.rb` — Linha do Gantt

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Report
const report = new Report(project, 'r1', 'My Report', null);
report.typeSpec = 'taskreport';
report.set('formats', ['html']);
report.set('columns', [
  new TableColumnDefinition('bsi', 'BSI'),
  new TableColumnDefinition('name', 'Name'),
  new TableColumnDefinition('start', 'Start'),
  new TableColumnDefinition('end', 'End'),
  new TableColumnDefinition('effort', 'Effort'),
  new TableColumnDefinition('chart', 'Chart'),
]);

// 2. Parser cria LogicalExpression para hideTask
const hideTask = new LogicalExpression(
  new LogicalOperation(
    new LogicalFunction('isleaf'),
    '~',
    null
  )
);
report.set('hideTask', hideTask);

// 3. Schedule
await project.schedule();

// 4. Generate Reports
await report.generate();
// → Report.generate()
//   → generateIntermediateFormat()
//     → TaskListRE.generateIntermediateFormat()
//       → filterTaskList()
//       → generateHeaderCell() × 6
//       → generateTaskList()
//         → Para cada task:
//           → ReportTableLine
//             → ReportTableCell × 6
//               → Para coluna 'chart':
//                 → GanttChart.generateByScale()
//                 → GanttLine
//                   → GanttTaskBar
//                 → GanttRouter.routeLines()
//   → generateHTML()
//     → HTMLDocument
//     → ReportTable.to_html()
//       → ReportTableLine.to_html()
//         → ReportTableCell.to_html()
//           → GanttChart.to_html()
//     → Deno.writeTextFile()
```

---

## 🚀 10. PRÓXIMOS PASSOS

### Fase 9: Estrutura de Tabela + Gantt Components (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/ReportTable.rb`** — Tabela completa (container de linhas)
2. **`lib/taskjuggler/reports/ReportTableCell.rb`** — Célula individual (text, color, tooltip)
3. **`lib/taskjuggler/reports/TableReport.rb`** — Base para task/resource reports (filterTaskList, etc.)
4. **`lib/taskjuggler/reports/GanttHeader.rb`** — Header do Gantt (duas linhas temporais)
5. **`lib/taskjuggler/reports/GanttLine.rb`** — Linha do Gantt (task bar + milestone)

### Ordem de Leitura Sugerida

```
1. ReportTableCell.rb    ← Célula individual (mais simples)
2. ReportTable.rb        ← Container de linhas
3. TableReport.rb        ← Base para task/resource reports
4. GanttHeader.rb        ← Header do Gantt
5. GanttLine.rb          ← Linha do Gantt (task bar + milestone)
```

---

**Fim da Fase 8.** Os relatórios específicos estão agora **completamente mapeados**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ReportTableCell.rb` → `ReportTable.rb` → `TableReport.rb` → `GanttHeader.rb` → `GanttLine.rb`. 🚀