# 📘 Blueprint Fase 9: Estrutura de Tabela + Gantt Components

## 🎯 Objetivo
Analisar os 5 arquivos que implementam a **estrutura completa de tabelas** e os **componentes do Gantt Chart**. Estes arquivos são a base para todos os relatórios tabulares (TaskReport, ResourceReport, AccountReport, etc.) e para a renderização visual do Gantt.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── TaskListRE / ResourceListRE / AccountListRE             │
│          └── TableReport (base)  ◄── TableReport.rb              │
│              ├── generateTaskList() / generateResourceList()     │
│              │   └── Para cada property:                         │
│              │       └── ReportTableLine  ◄── ReportTableLine.rb │
│              │           └── Para cada coluna:                   │
│              │               └── ReportTableCell ◄── ReportTableCell.rb
│              │                   └── text, color, tooltip, icon  │
│              │                                                   │
│              └── generateHeaderCell()                            │
│                  └── ReportTableColumn  ◄── ReportTableColumn.rb │
│                      ├── cell1 (header superior)                 │
│                      ├── cell2 (header inferior)                 │
│                      └── special (GanttChart / ColumnTable)      │
│                                                                  │
│  └── to_html() / to_csv()                                        │
│      └── ReportTable  ◄── ReportTable.rb                         │
│          ├── columns: ReportTableColumn[]                        │
│          ├── lines: ReportTableLine[]                            │
│          └── to_html() → XMLElement tree                         │
│                                                                  │
│  └── GanttChart (se coluna chart)                                │
│      └── GanttLine  ◄── GanttLine.rb                             │
│          ├── GanttTaskBar / GanttMilestone / GanttContainer      │
│          ├── GanttLoadStack (para resources aninhados)           │
│          └── Dependency arrows (via GanttRouter)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. REPORTTABLE.RB — Container de Tabela

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Container de colunas e linhas** | Armazena `ReportTableColumn[]` e `ReportTableLine[]` |
| **Gera HTML/CSV** | `to_html()` e `to_csv()` convertem para formatos de saída |
| **Gerencia header** | 1 ou 2 linhas de header (depende das colunas) |
| **Scrollbar detection** | Detecta se alguma coluna precisa de scrollbar |
| **Indentação** | Calcula `maxIndent` para tree sorting |

### 2.2 Estrutura Interna

```typescript
class ReportTable {
  static readonly SCROLLBARHEIGHT = 20;
  
  @headerLineHeight: number = 19;      // pixels
  @headerFontSize: number = 15;        // pixels
  @columns: ReportTableColumn[] = [];
  @lines: ReportTableLine[] = [];
  @maxIndent: number = 0;
  @equiLines: boolean = false;         // Todas linhas mesma altura?
  @embedded: boolean = false;          // Tabela embutida em outra?
  @selfcontained: boolean = false;     // CSS inline?
  @auxDir: string = '';                // Diretório de assets
  
  addColumn(col: ReportTableColumn): void;
  addLine(line: ReportTableLine): void;
  minWidth(): number | null;
  to_html(): XMLElement;
  to_csv(csv?: any[][], startColumn?: number): any[][] | number;
}
```

### 2.3 to_html() — Geração de HTML

```typescript
to_html(): XMLElement {
  this.determineMaxIndents();
  
  const attr: Record<string, string> = {
    'class': 'tj_table',
    'cellspacing': '1'
  };
  if (this.embedded) {
    attr['style'] = 'width:100%; ';
  }
  
  const table = new XMLElement('table', attr);
  const tbody = new XMLElement('tbody');
  
  // 1. Detecta se todas as cells do header têm 2 rows
  let allCellsHave2Rows = true;
  let lineHeight = this.headerLineHeight;
  
  for (const col of this.columns) {
    if (col.cell1.rows !== 2 && !col.cell1.special) {
      allCellsHave2Rows = false;
      break;
    }
  }
  
  if (allCellsHave2Rows) {
    for (const col of this.columns) {
      col.cell1.rows = 1;
    }
    lineHeight = this.headerLineHeight * 2 + 1;
  }
  
  // 2. Gera 1ª linha do header
  const tr1 = new XMLElement('tr', {
    'class': 'tabhead',
    'style': `height:${lineHeight}px; font-size:${this.headerFontSize}px;`
  });
  for (const col of this.columns) {
    tr1.append(col.to_html(1));
  }
  tbody.append(tr1);
  
  // 3. Gera 2ª linha do header (se necessário)
  if (!allCellsHave2Rows) {
    const tr2 = new XMLElement('tr', {
      'class': 'tabhead',
      'style': `height:${this.headerLineHeight}px; font-size:${this.headerFontSize}px;`
    });
    for (const col of this.columns) {
      tr2.append(col.to_html(2));
    }
    tbody.append(tr2);
  }
  
  // 4. Gera linhas de dados
  for (const line of this.lines) {
    tbody.append(line.to_html());
  }
  
  // 5. Linha extra para scrollbar (se necessário)
  if (this.hasScrollbar()) {
    const tr3 = new XMLElement('tr', {
      'style': `height:${ReportTable.SCROLLBARHEIGHT}px`
    });
    for (const col of this.columns) {
      if (!col.scrollbar) {
        tr3.append(new XMLElement('td'));
      }
    }
    tbody.append(tr3);
  }
  
  table.append(tbody);
  return table;
}
```

### 2.4 Pontos Críticos

1. **allCellsHave2Rows**: Se TODAS as colunas têm header de 2 linhas, o TaskJuggler merge as células para economizar espaço vertical.

2. **embedded**: Tabelas embutidas (ex: calendar columns) têm `width:100%`.

3. **equiLines**: Se true, todas as linhas têm a mesma altura (necessário para Gantt chart).

4. **hasScrollbar()**: Retorna true se alguma coluna tem scrollbar.

---

## 📋 3. REPORTTABLECOLUMN.RB — Coluna da Tabela

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma coluna** | Contém `cell1` (header superior) e `cell2` (header inferior) |
| **Special object** | Pode conter GanttChart ou ColumnTable embutido |
| **Scrollbar flag** | Indica se a coluna precisa de scrollbar |
| **Converte para HTML/CSV** | `to_html(row)` e `to_csv()` |

### 3.2 Estrutura Interna

```typescript
class ReportTableColumn {
  @table: ReportTable;
  @definition: TableColumnDefinition | null;
  @cell1: ReportTableCell;           // Header superior (obrigatório)
  @cell2: ReportTableCell;           // Header inferior (opcional)
  @scrollbar: boolean = false;
  
  constructor(table: ReportTable, definition: TableColumnDefinition | null, title: string) {
    this.table = table;
    this.table.addColumn(this);
    this.definition = definition;
    if (definition) {
      definition.column = this;
    }
    
    this.cell1 = new ReportTableCell(null, null, title, true);
    this.cell1.padding = 5;
    this.cell2 = new ReportTableCell(null, null, '', true);
    
    // Header text sempre em bold
    this.cell1.bold = true;
    this.cell2.bold = true;
  }
  
  minWidth(): number | null;
  to_html(row: 1 | 2): XMLElement;
  to_csv(csv: any[][], startColumn: number): number;
}
```

### 3.3 Special Object (GanttChart / ColumnTable)

```typescript
// No TableReport.generateHeaderCell():
if (columnDef.id === 'chart') {
  const gantt = new GanttChart(
    a('now'),
    a('weekStartsMonday'),
    columnDef,
    this,
    a('markdate')
  );
  gantt.generateByScale(rStart, rEnd, columnDef.scale);
  gantt.header.height = this.table.headerLineHeight * 2 + 1;
  gantt.viewWidth = columnDef.width || 450;
  
  const column = new ReportTableColumn(this.table, columnDef, '');
  column.cell1.special = gantt;  // ← GanttChart embutido!
  column.cell2.hidden = true;
  column.scrollbar = gantt.hasScrollbar();
  this.table.equiLines = true;
}
```

### 3.4 Pontos Críticos

1. **cell1.special**: Se não for null, contém um objeto (GanttChart ou ColumnTable) que substitui TODO o conteúdo da coluna.

2. **cell2.hidden**: Se true, cell1 ocupa toda a altura do header.

3. **scrollbar**: Se true, a tabela gera uma linha extra para o scrollbar.

---

## 📝 4. REPORTTABLECELL.RB — Célula Individual

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Conteúdo da célula** | `text` (String ou RichTextIntermediate) |
| **Estilo visual** | `category`, `cellColor`, `fontColor`, `bold`, `fontSize` |
| **Layout** | `alignment`, `indent`, `width`, `rows`, `columns` |
| **Ícones** | `icon`, `iconTooltip` |
| **Tooltip** | `tooltip`, `showTooltipHint` |
| **Special** | Pode conter objeto embutido (PlaceHolderCell) |

### 4.2 Estrutura Interna

```typescript
class ReportTableCell {
  @line: ReportTableLine | null;
  @headerCell: boolean;
  @query: Query | null;
  
  // Conteúdo
  @text: string | RichTextIntermediate;
  @data: string | null;              // Dados originais (opcional)
  @special: any;                     // Objeto embutido (PlaceHolderCell)
  
  // Estilo
  @category: string | null;          // Classe CSS (taskcell1, resourcecell2, etc.)
  @cellColor: string | null;         // Background color (override category)
  @fontColor: string | null;         // Font color
  @bold: boolean = false;
  @fontSize: number | null;
  
  // Layout
  @alignment: 'left' | 'center' | 'right' = 'center';
  @indent: number | null;            // Nível de indentação (tree mode)
  @width: number | null;             // Largura em pixels
  @rows: number = 1;                 // Rowspan
  @columns: number = 1;              // Colspan
  @padding: number = 3;
  @hidden: boolean = false;
  
  // Ícones e tooltips
  @icon: string | null;              // Nome do ícone (sem .png)
  @iconTooltip: RichTextIntermediate | null;
  @tooltip: RichTextIntermediate | null;
  @showTooltipHint: boolean = true;
  
  // Flags internas
  @force_string: boolean = false;    // Não converter números para string
  
  constructor(line: ReportTableLine | null, query: Query | null, text?: string, headerCell?: boolean);
  
  to_html(): XMLElement | null;
  to_csv(csv: any[][], columnIdx: number, lineIdx: number): number;
}
```

### 4.3 to_html() — Geração de HTML

```typescript
to_html(): XMLElement | null {
  if (this.hidden) return null;
  if (this.special) return this.special.to_html();
  
  const attribs: Record<string, string> = {};
  if (this.rows > 1) attribs['rowspan'] = `${this.rows}`;
  if (this.columns > 1) attribs['colspan'] = `${this.columns}`;
  attribs['class'] = this.category || 'tabcell';
  
  let style = '';
  if (this.cellColor) {
    style += `background-color: ${this.cellColor}; `;
  }
  if (style) attribs['style'] = style;
  
  const cell = new XMLElement('td', attribs);
  
  // Tabela interna para layout
  const table = new XMLElement('table', {
    'class': this.category ? 'tj_table_cell' : 'tj_table_header_cell',
    'cellspacing': '0',
    'style': this.cellStyle()
  });
  
  const row = new XMLElement('tr');
  this.calculateIndentation();
  
  // Padding esquerdo
  if (this.leftIndent && this.leftIndent > 0) {
    row.append(new XMLElement('td', {
      'style': `width:${this.leftIndent}px; `
    }));
  }
  
  // Ícone
  row.append(this.cellIcon(cell));
  
  // Label + tooltip
  const [labelDiv, tooltip] = this.cellLabel();
  row.append(labelDiv);
  
  // Tooltip hint (ícone de detalhes)
  if (tooltip && !tooltip.empty() && !this.selfcontained()) {
    if (this.showTooltipHint) {
      const td = new XMLElement('td');
      td.append(new XMLElement('img', {
        'src': `${this.auxDir()}icons/details.png`,
        'class': 'tj_table_cell_tooltip'
      }));
      this.addHtmlTooltip(tooltip, td, cell);
      row.append(td);
    } else {
      this.addHtmlTooltip(tooltip, cell);
    }
  }
  
  // Padding direito
  if (this.rightIndent && this.rightIndent > 0) {
    row.append(new XMLElement('td', {
      'style': `width:${this.rightIndent}px; `
    }));
  }
  
  table.append(row);
  cell.append(table);
  return cell;
}
```

### 4.4 Categorias CSS

```typescript
// Categorias comuns:
// - taskcell1, taskcell2 (alternating rows para tasks)
// - resourcecell1, resourcecell2 (alternating rows para resources)
// - calconttask1, calconttask2 (container tasks em calendar)
// - caltask1, caltask2 (leaf tasks em calendar)
// - busy1, busy2 (resource fully loaded)
// - loaded1, loaded2 (resource partially loaded)
// - free (resource available)
// - offduty (non-working time)
// - costaccountcell1, costaccountcell2 (cost accounts)
// - revenueaccountcell1, revenueaccountcell2 (revenue accounts)
```

### 4.5 Pontos Críticos

1. **special**: Se não for null, `to_html()` delega para `special.to_html()`. Usado para PlaceHolderCell (tabelas embutidas).

2. **category**: Define a classe CSS. Pode ser sobrescrito por `cellColor`.

3. **indent**: Em tree mode, calcula `leftIndent` ou `rightIndent` baseado no `alignment`.

4. **tooltip**: Pode ser RichTextIntermediate com queries embutidas.

5. **hidden**: Se true, `to_html()` retorna null (usado para cells merged).

---

## 📏 5. REPORTTABLELINE.RB — Linha da Tabela

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha** | Contém `cells: ReportTableCell[]` |
| **Propriedade associada** | `property: PropertyTreeNode` (Task, Resource, Account) |
| **Scope** | `scopeLine: ReportTableLine | null` (para nested lines) |
| **Contadores** | `no`, `lineNo`, `subLineNo` |
| **Estilo** | `height`, `indentation`, `fontSize`, `bold` |

### 5.2 Estrutura Interna

```typescript
class ReportTableLine {
  @table: ReportTable;
  @property: PropertyTreeNode;
  @scopeLine: ReportTableLine | null;
  @cells: ReportTableCell[] = [];
  
  // Estilo
  @height: number = 21;              // pixels
  @indentation: number = 0;          // pixels
  @fontSize: number = 12;            // pixels
  @bold: boolean = false;
  
  // Contadores
  @no: number | null = null;         // Contador primário (reinicia para nested)
  @lineNo: number | null = null;     // Contador de linhas primárias
  @subLineNo: number | null = null;  // Contador de todas as linhas
  
  constructor(table: ReportTable, property: PropertyTreeNode, scopeLine: ReportTableLine | null) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    this.table.addLine(this);
  }
  
  last(count?: number): ReportTableCell | null;
  addCell(cell: ReportTableCell): void;
  scopeProperty(): PropertyTreeNode | null;
  to_html(): XMLElement;
  to_csv(csv: any[][], startColumn: number, lineIdx: number): number;
}
```

### 5.3 Contadores

```typescript
// Exemplo de contadores:
// Task 1 (lineNo=1, subLineNo=1, no=1)
//   └── Resource 1.1 (lineNo=null, subLineNo=2, no=1)
//   └── Resource 1.2 (lineNo=null, subLineNo=3, no=2)
// Task 2 (lineNo=2, subLineNo=4, no=1)
//   └── Resource 2.1 (lineNo=null, subLineNo=5, no=1)

// no: contador que reinicia para cada conjunto nested
// lineNo: contador global de linhas primárias
// subLineNo: contador global de todas as linhas (índice em table.lines)
```

### 5.4 to_html() — Geração de HTML

```typescript
to_html(): XMLElement {
  let style = '';
  if (this.table.equiLines) {
    style += `height:${this.height}px; `;
  }
  if (this.fontSize) {
    style += `font-size:${this.fontSize}px; `;
  }
  
  const tr = new XMLElement('tr', {
    'class': 'tabline',
    'style': style
  });
  
  for (const cell of this.cells) {
    tr.append(cell.to_html());
  }
  
  return tr;
}
```

### 5.5 Pontos Críticos

1. **scopeLine**: Se não for null, esta linha está aninhada dentro de outra (ex: resource aninhado em task).

2. **scopeProperty()**: Retorna `scopeLine.property` ou null.

3. **last(count)**: Retorna a última cell não-hidden, começando a buscar a partir de `count` cells do final.

4. **subLineNo**: É o índice da linha em `table.lines`. Usado para GanttChart (cada linha do Gantt corresponde a um `subLineNo`).

---

## 🎯 6. TABLEREPORT.RB — Base para Relatórios Tabulares

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base** | Superclasse de TaskListRE, ResourceListRE, AccountListRE |
| **Mapeamento de colunas** | `@@propertiesById` e `@@propertiesByType` |
| **Geração de header** | `generateHeaderCell()` para cada tipo de coluna |
| **Geração de linhas** | `generateTaskList()`, `generateResourceList()`, `generateAccountList()` |
| **Calendar columns** | `genCalChartHeader()`, `genCalChartTaskCell()`, etc. |
| **Ajuste de período** | `adjustColumnPeriod()` para colunas time-variant |

### 6.2 Mapeamento de Colunas

```typescript
// Colunas pré-definidas (hardcoded)
const propertiesById: Record<string, [string, boolean, 'left' | 'right', boolean]> = {
  // ID                   Header                   Indent  Align   Scen Spec.
  'activetasks':       [ 'Active Tasks',         true,   'right', true ],
  'alert':             [ 'Alert',                true,   'left',  false ],
  'bsi':               [ 'BSI',                  false,  'left',  false ],
  'complete':          [ 'Completion',           false,  'right', true ],
  'cost':              [ 'Cost',                 true,   'right', true ],
  'duration':          [ 'Duration',             true,   'right', true ],
  'effort':            [ 'Effort',               true,   'right', true ],
  'end':               [ 'End',                  false,  'left',  false ],
  'id':                [ 'Id',                   false,  'left',  false ],
  'name':              [ 'Name',                 true,   'left',  false ],
  'priority':          [ 'Priority',             false,  'right', true ],
  'start':             [ 'Start',                false,  'left',  false ],
  // ... (60+ colunas)
};

// Colunas por tipo de atributo
const propertiesByType: Record<string, [boolean, 'left' | 'right']> = {
  'DateAttribute':         [ false,  'left' ],
  'IntegerAttribute':      [ false,  'right' ],
  'FloatAttribute':        [ false,  'right' ],
  'ResourceListAttribute': [ false,  'left' ],
  'RichTextAttribute':     [ false,  'left' ],
  'StringAttribute':       [ false,  'left' ],
};
```

### 6.3 generateHeaderCell() — Geração de Header

```typescript
generateHeaderCell(columnDef: TableColumnDefinition): void {
  const rStart = this.columns[columnDef].start;
  const rEnd = this.columns[columnDef].end;
  
  switch (columnDef.id) {
    case 'chart':
      // GanttChart embutido
      const gantt = new GanttChart(
        this.a('now'),
        this.a('weekStartsMonday'),
        columnDef,
        this,
        this.a('markdate')
      );
      gantt.generateByScale(rStart, rEnd, columnDef.scale);
      gantt.header.height = this.table.headerLineHeight * 2 + 1;
      gantt.viewWidth = columnDef.width || 450;
      
      const column = new ReportTableColumn(this.table, columnDef, '');
      column.cell1.special = gantt;
      column.cell2.hidden = true;
      column.scrollbar = gantt.hasScrollbar();
      this.table.equiLines = true;
      break;
      
    case 'hourly':
      this.genCalChartHeader(columnDef, rStart.midnight(), rEnd, 'sameTimeNextHour',
        '%A %Y-%m-%d', '%H');
      break;
      
    case 'daily':
      this.genCalChartHeader(columnDef, rStart.midnight(), rEnd, 'sameTimeNextDay',
        '%b %Y', '%d');
      break;
      
    case 'weekly':
      this.genCalChartHeader(columnDef,
        rStart.beginOfWeek(this.a('weekStartsMonday')), rEnd,
        'sameTimeNextWeek', '%b %Y', '%d');
      break;
      
    case 'monthly':
      this.genCalChartHeader(columnDef, rStart.beginOfMonth(), rEnd,
        'sameTimeNextMonth', '%Y', '%b');
      break;
      
    case 'quarterly':
      this.genCalChartHeader(columnDef, rStart.beginOfQuarter(), rEnd,
        'sameTimeNextQuarter', '%Y', 'Q%Q');
      break;
      
    case 'yearly':
      this.genCalChartHeader(columnDef, rStart.beginOfYear(), rEnd,
        'sameTimeNextYear', null, '%Y');
      break;
      
    default:
      // Coluna padrão (text, number, date, etc.)
      const column = new ReportTableColumn(this.table, columnDef, columnDef.title);
      column.cell1.rows = 2;
      column.cell2.hidden = true;
      if (columnDef.width) {
        column.cell1.width = columnDef.width;
      }
      break;
  }
}
```

### 6.4 generateTaskList() — Geração de Linhas de Tasks

```typescript
generateTaskList(taskList: PropertyList<Task>, resourceList: PropertyList<Resource> | null,
                 scopeLine: ReportTableLine | null): number {
  const query = this.project.reportContexts.last.query.dup();
  query.scopeProperty = scopeLine ? scopeLine.property : null;
  taskList.sort();
  
  let no = 0;
  let lineNo = scopeLine ? scopeLine.lineNo : 0;
  let line: ReportTableLine | null = null;
  
  for (const task of taskList) {
    query.property = task;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    no++;
    lineNo++;
    
    for (const scenarioIdx of this.a('scenarios')) {
      query.scenarioIdx = scenarioIdx;
      
      // Gera linha para cada task
      line = new ReportTableLine(this.table, task, scopeLine);
      if (!scopeLine) line.no = no;
      line.lineNo = lineNo;
      line.subLineNo = this.table.lines.length;
      this.setIndent(line, this.a('taskroot'), taskList.treeMode());
      
      // Gera cell para cada coluna
      for (const columnDef of this.a('columns')) {
        this.generateTableCell(line, columnDef, query);
      }
    }
    
    // Se temos resourceList, gera linhas aninhadas para resources atribuídos
    if (resourceList) {
      resourceList.setSorting(this.a('sortResources'));
      const assignedResourceList = this.filterResourceList(
        resourceList, task,
        this.a('hideResource'),
        this.a('rollupResource'),
        this.a('openNodes')
      );
      assignedResourceList.sort();
      lineNo = this.generateResourceList(assignedResourceList, null, line);
    }
  }
  
  return lineNo;
}
```

### 6.5 generateTableCell() — Geração de Célula

```typescript
generateTableCell(line: ReportTableLine, columnDef: TableColumnDefinition,
                  query: Query): boolean {
  query = query.dup();
  query.attributeId = columnDef.id;
  query.start = this.columns[columnDef].start;
  query.end = this.columns[columnDef].end;
  query.listType = columnDef.listType;
  query.listItem = columnDef.listItem;
  
  switch (columnDef.id) {
    case 'chart':
      // Gera cell hidden. O GanttChart é gerado via column.cell1.special
      const cell = new ReportTableCell(line, query, '');
      cell.hidden = true;
      cell.text = null;
      
      const chart = columnDef.column!.cell1.special as GanttChart;
      new GanttLine(chart, query,
        (line.subLineNo! - 1) * (line.height + 1),
        line.height,
        line.subLineNo!,
        this.a('selfcontained') ? null : columnDef.tooltip);
      return true;
      
    case 'hourly':
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'quarterly':
    case 'yearly':
      // Calendar cells são geradas por funções específicas
      const tcLine = new ReportTableLine(
        columnDef.column!.cell1.special as ColumnTable,
        line.property,
        line.scopeLine
      );
      new PlaceHolderCell(line, tcLine);
      tcLine.subLineNo = line.subLineNo;
      
      if (query.property instanceof Task) {
        this.genCalChartTaskCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      } else if (query.property instanceof Resource) {
        this.genCalChartResourceCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      } else if (query.property instanceof Account) {
        this.genCalChartAccountCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      }
      return true;
      
    default:
      if (TableReport.calculated(columnDef.id)) {
        return this.genCalculatedCell(query, line, columnDef);
      } else {
        return this.genStandardCell(query, line, columnDef);
      }
  }
}
```

### 6.6 genStandardCell() vs genCalculatedCell()

```typescript
// genStandardCell(): Atributo direto da property
genStandardCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition): boolean {
  const cell = this.newCell(query, line);
  this.setScenarioSettings(cell, query.scenarioIdx,
    propertyList.scenarioSpecific(columnDef.id));
  this.setStandardCellAttributes(query, cell, columnDef,
    propertyList.attributeType(columnDef.id), line);
  
  // celltext customizado tem prioridade
  const cdText = columnDef.cellText.getPattern(query);
  if (cdText) {
    cell.text = cdText;
  } else if (query.process()) {
    cell.text = query.to_rti() || query.to_s();
  }
  
  this.setCustomCellAttributes(cell, columnDef, query);
  this.checkCellText(cell);
  return true;
}

// genCalculatedCell(): Atributo calculado (effort, duration, etc.)
genCalculatedCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition): boolean {
  const cell = this.newCell(query, line);
  if (columnDef.id === 'bsi') cell.force_string = true;
  
  this.setScenarioSettings(cell, query.scenarioIdx,
    TableReport.scenarioSpecific(columnDef.id));
  this.setStandardCellAttributes(query, cell, columnDef, null, line);
  
  if (query.process()) {
    cell.text = query.to_rti() || query.to_s();
  }
  
  // Tratamentos especiais
  switch (columnDef.id) {
    case 'alert':
      cell.icon = `flag-${this.project.alertLevels[query.to_sort()].id}`;
      cell.fontColor = this.project.alertLevels[query.to_sort()].color;
      break;
    case 'alerttrend':
      cell.icon = `trend-${['up', 'flat', 'down'][query.to_sort()]}`;
      break;
    case 'line':
      cell.text = line.lineNo!.toString();
      break;
    case 'name':
      cell.icon = this.getPropertyIcon(query.property);
      break;
    case 'no':
      cell.text = line.no!.toString();
      break;
    case 'bsi':
      if (line.scopeLine) cell.indent = 2;
      break;
    case 'scenario':
      cell.text = this.project.scenario(query.scenarioIdx).name;
      break;
  }
  
  // celltext customizado tem prioridade
  const cdText = columnDef.cellText.getPattern(query);
  if (cdText) cell.text = cdText;
  
  this.setCustomCellAttributes(cell, columnDef, query);
  this.checkCellText(cell);
  return true;
}
```

### 6.7 genCalChartTaskCell() — Células de Calendar para Tasks

```typescript
genCalChartTaskCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition,
                    t: TjTime, sameTimeNextFunc: string): void {
  const task = line.property;
  const taskStart = task.get('start', query.scenarioIdx) || this.project.get('start');
  const taskEnd = task.get('end', query.scenarioIdx) || this.project.get('end');
  const taskIv = new TimeInterval(taskStart, taskEnd);
  
  query = query.dup();
  let firstCell: ReportTableCell | null = null;
  const endDate = query.end;
  
  while (t < endDate) {
    const nextT = (t as any)[sameTimeNextFunc]();
    const cellIv = new TimeInterval(t, nextT);
    
    switch (columnDef.content) {
      case 'empty':
        const cell = this.newCell(query, line);
        break;
        
      case 'load':
        query.attributeId = 'effort';
        query.start = t;
        query.end = nextT;
        query.process();
        
        const cell = this.newCell(query, line);
        if (query.to_num() !== 0.0) {
          cell.text = query.to_s();
        }
        break;
    }
    
    const cdText = columnDef.cellText.getPattern(query);
    if (cdText) cell.text = cdText;
    cell.showTooltipHint = false;
    
    // Determina categoria (background color)
    if (cellIv.overlaps(taskIv)) {
      cell.category = task.container() ? 'calconttask' : 'caltask';
    } else if (!this.project.isWorkingTime(cellIv)) {
      cell.category = 'offduty';
    } else {
      cell.category = 'taskcell';
    }
    cell.category += (line.subLineNo! % 2 === 1) ? '1' : '2';
    
    this.setCustomCellAttributes(cell, columnDef, query);
    this.tryCellMerging(cell, line, firstCell);
    
    t = nextT;
    if (!firstCell) firstCell = cell;
  }
}
```

### 6.8 Pontos Críticos

1. **@@propertiesById**: Mapeamento estático de colunas pré-definidas. Usado para determinar indent, align, scenario-specific.

2. **calculated?()**: Retorna true se a coluna é calculada (effort, duration, etc.) vs. atributo direto (name, id, etc.).

3. **adjustColumnPeriod()**: Ajusta start/end da coluna baseado nas tasks incluídas. Adiciona margem de 5% para chart/calendar columns.

4. **tryCellMerging()**: Tenta merge de cells vazias consecutivas em calendar columns.

5. **PlaceHolderCell**: Cell especial que delega `to_csv()` para uma linha embutida (ColumnTable).

---

## 📊 7. GANTTLINE.RB — Linha do Gantt Chart

### 7.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha do Gantt** | Representa uma property (Task ou Resource) |
| **Gera conteúdo visual** | GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack |
| **Time-off zones** | Marca períodos de leave/vacation |
| **Dependency arrows** | Registra blocked zones para o GanttRouter |
| **Tooltips** | Adiciona tooltips interativos |

### 7.2 Estrutura Interna

```typescript
class GanttLine {
  @chart: GanttChart;
  @query: Query;
  @tooltip: CellSettingPatternList | null;
  @category: string | null;          // Background color class
  @y: number;                        // Y coordinate (top pixel)
  @height: number;                   // Height in pixels
  @lineIndex: number;                // Line index (0-based)
  @timeOffZones: [number, number][]; // [startX, width] pairs
  @content: (GanttTaskBar | GanttMilestone | GanttContainer | GanttLoadStack)[];
  
  constructor(chart: GanttChart, query: Query, y: number, height: number,
              lineIndex: number, tooltip: CellSettingPatternList | null);
  
  to_html(): XMLElement;
  getTask(): GanttTaskBar | GanttMilestone | GanttContainer | null;
  addBlockedZones(router: GanttRouter): void;
}
```

### 7.3 generate() — Geração de Conteúdo

```typescript
private generate(): void {
  this.content = [];
  this.generateTimeOffZones();
  
  if (this.query.property instanceof Task) {
    this.generateTask();
  } else {
    this.generateResource();
  }
}

private generateTask(): void {
  this.category = `taskcell${(this.lineIndex + 1) % 2 + 1}`;
  
  const project = this.query.project;
  const property = this.query.property;
  const scopeProperty = this.query.scopeProperty;
  
  const taskStart = property.get('start', this.query.scenarioIdx) || project.get('start');
  const taskEnd = property.get('end', this.query.scenarioIdx) || project.get('end');
  
  if (scopeProperty) {
    // Task aninhada em resource → GanttLoadStack
    this.generateTaskLoadStacks(property, scopeProperty, taskStart, taskEnd);
  } else {
    // Task primária → GanttTaskBar / GanttMilestone / GanttContainer
    const xStart = this.chart.dateToX(taskStart);
    const xEnd = this.chart.dateToX(taskEnd);
    
    this.chart.addTask(property, this);
    
    if (property.get('milestone', this.query.scenarioIdx)) {
      this.content.push(new GanttMilestone(this.height, xStart, this.y));
    } else if (property.container() && !this.shouldRollup()) {
      this.content.push(new GanttContainer(this.height, xStart, xEnd, this.y));
    } else {
      this.content.push(new GanttTaskBar(this.query, this.height, xStart, xEnd, this.y));
    }
  }
}

private generateResource(): void {
  this.category = `resourcecell${(this.lineIndex + 1) % 2 + 1}`;
  
  const property = this.query.property;
  const scopeProperty = this.query.scopeProperty;
  
  // Resource lines sempre usam GanttLoadStack
  this.generateResourceLoadStacks(property, scopeProperty);
}
```

### 7.4 to_html() — Renderização HTML

```typescript
to_html(): XMLElement {
  const div = new XMLElement('div', {
    'class': this.category,
    'style': `margin:0px; padding:0px; position:absolute; ` +
             `left:0px; top:${this.y}px; ` +
             `width:${this.chart.width}px; ` +
             `height:${this.height}px; ` +
             `font-size:10px;`
  });
  
  // Time-off zones
  for (const zone of this.timeOffZones) {
    div.append(this.rectToHTML(zone[0], 0, zone[1], this.height, 'offduty'));
  }
  
  // Grid lines
  for (const line of this.chart.header.gridLines) {
    div.append(this.rectToHTML(line, 0, 1, this.height, 'tabvline'));
  }
  
  // Content (task bars, milestones, load stacks)
  for (const c of this.content) {
    const html = c.to_html();
    if (html && html[0]) {
      this.addHtmlTooltip(this.tooltip, this.query, html[0], div);
      div.append(html);
    }
  }
  
  // Now line
  if (this.chart.header.nowLineX) {
    div.append(this.rectToHTML(this.chart.header.nowLineX, 0, 1, this.height, 'nowline'));
  }
  
  // Markdate line
  if (this.chart.header.markdateLineX) {
    div.append(this.rectToHTML(this.chart.header.markdateLineX, 0, 1, this.height, 'markdateline'));
  }
  
  return div;
}
```

### 7.5 Pontos Críticos

1. **scopeProperty**: Se não for null, a task está aninhada em um resource → usa GanttLoadStack.

2. **timeOffZones**: Períodos de leave/vacation são renderizados como retângulos cinza.

3. **gridLines**: Linhas verticais do grid (determinadas pela escala maior).

4. **nowLine**: Linha vertical vermelha indicando a data atual.

5. **markdateLine**: Linha vertical customizada (se definida pelo usuário).

6. **addBlockedZones()**: Registra áreas bloqueadas para o GanttRouter (dependency arrows não cruzam task bars).

---

## 🎯 8. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 8.1 Ordem de Implementação (Fase 9)

```
FASE 9A: Estrutura de Célula
  1. ReportTableCell.ts        ⭐ (célula individual)
  2. ReportTableLine.ts        ⭐ (linha da tabela)
  3. ReportTableColumn.ts      ⭐ (coluna da tabela)

FASE 9B: Container de Tabela
  4. ReportTable.ts            ⭐ (tabela completa)

FASE 9C: Base para Relatórios
  5. TableReport.ts            ⭐ (base para task/resource reports)

FASE 9D: Gantt Components
  6. GanttLine.ts              ⭐ (linha do Gantt)
  7. GanttTaskBar.ts           (barra de tarefa)
  8. GanttMilestone.ts         (milestone)
  9. GanttContainer.ts         (container task)
  10. GanttLoadStack.ts        (load stack para resources)
  11. GanttHeader.ts           (header do Gantt)
  12. GanttRouter.ts           (roteamento de arrows)
  13. GanttChart.ts            (chart completo)
  14. HTMLGraphics.ts          (helpers SVG/HTML)
  15. ColumnTable.ts           (tabela embutida para calendar)
  16. PlaceHolderCell.ts       (cell placeholder para tabelas embutidas)
```

### 8.2 Decisões de Design TypeScript

#### 8.2.1 ReportTableCell com Union Types
```typescript
type CellText = string | RichTextIntermediate;

class ReportTableCell {
  text: CellText;
  special: any | null;  // PlaceHolderCell ou outro objeto
  
  to_html(): XMLElement | null {
    if (this.hidden) return null;
    if (this.special) return this.special.to_html();
    // ...
  }
}
```

#### 8.2.2 ReportTableColumn com Optional Special
```typescript
class ReportTableColumn {
  cell1: ReportTableCell;
  cell2: ReportTableCell;
  special: GanttChart | ColumnTable | null;
  
  to_html(row: 1 | 2): XMLElement {
    if (row === 1) return this.cell1.to_html();
    return this.cell2.to_html();
  }
}
```

#### 8.2.3 TableReport com Static Maps
```typescript
class TableReport extends ReportBase {
  static readonly propertiesById = new Map<string, [string, boolean, 'left' | 'right', boolean]>([
    ['activetasks', ['Active Tasks', true, 'right', true]],
    ['alert', ['Alert', true, 'left', false]],
    // ...
  ]);
  
  static calculated(colId: string): boolean {
    return TableReport.propertiesById.has(colId);
  }
  
  static indent(colId: string, propertyType: string): boolean {
    // ...
  }
  
  static alignment(colId: string, attributeType: string): 'left' | 'center' | 'right' {
    // ...
  }
}
```

#### 8.2.4 GanttLine com Strategy Pattern
```typescript
abstract class GanttContent {
  abstract to_html(): XMLElement[];
  abstract addBlockedZones(router: GanttRouter): void;
}

class GanttTaskBar extends GanttContent { /* ... */ }
class GanttMilestone extends GanttContent { /* ... */ }
class GanttContainer extends GanttContent { /* ... */ }
class GanttLoadStack extends GanttContent { /* ... */ }

class GanttLine {
  content: GanttContent[] = [];
  
  private generate(): void {
    if (this.query.property instanceof Task) {
      if (this.query.scopeProperty) {
        this.content.push(new GanttLoadStack(/* ... */));
      } else {
        if (this.query.property.get('milestone', this.query.scenarioIdx)) {
          this.content.push(new GanttMilestone(/* ... */));
        } else if (this.query.property.container()) {
          this.content.push(new GanttContainer(/* ... */));
        } else {
          this.content.push(new GanttTaskBar(/* ... */));
        }
      }
    } else {
      this.content.push(new GanttLoadStack(/* ... */));
    }
  }
}
```

### 8.3 Pontos de Atenção (Armadilhas)

1. **ReportTableCell.special**: Se não for null, `to_html()` delega completamente. Não tenta renderizar `text`.

2. **ReportTableColumn.cell2.hidden**: Se true, cell1 ocupa toda a altura. Não gera segunda linha do header.

3. **ReportTable.allCellsHave2Rows**: Se TODAS as colunas têm 2 rows no header, merge para economizar espaço.

4. **ReportTableLine.subLineNo**: É o índice em `table.lines`. Usado para calcular Y coordinate no GanttChart.

5. **TableReport.propertiesById**: Mapeamento estático. Não confundir com `propertySet.attributeDefinitions`.

6. **TableReport.calculated()**: Colunas calculadas (effort, duration) vs. atributos diretos (name, id).

7. **GanttLine.scopeProperty**: Se não for null, task está aninhada em resource → usa GanttLoadStack, não GanttTaskBar.

8. **GanttLine.timeOffZones**: São `[startX, width]`, não `[startX, endX]`.

9. **GanttChart.equiLines**: Se true, todas as linhas têm mesma altura (necessário para Gantt).

10. **PlaceHolderCell**: Cell especial que delega `to_csv()` para linha embutida. `to_html()` retorna null.

11. **ColumnTable**: Tabela embutida dentro de calendar columns. Cada cell representa um período (hora, dia, semana, etc.).

12. **tryCellMerging()**: Tenta merge de cells vazias consecutivas. Usado em calendar columns para reduzir HTML.

13. **addHtmlTooltip()**: Adiciona tooltip interativo via JavaScript (TagToTip).

14. **category CSS**: Define background color. Pode ser sobrescrito por `cellColor`.

15. **indent**: Em tree mode, calcula `leftIndent` ou `rightIndent` baseado no `alignment`.

---

## 📋 9. CHECKLIST ATUALIZADO

### ✅ Já analisados (45 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableColumnDefinition, HTMLDocument
- [x] **Fase 8**: TaskListRE, ResourceListRE, TextReport, ReportTableLine, GanttChart
- [x] **Fase 9**: ReportTable, ReportTableColumn, ReportTableCell, TableReport, GanttLine ⭐

### 🔮 Próximos 5 (Fase 10 - Gantt Components Específicos)
- [ ] `lib/taskjuggler/reports/GanttTaskBar.rb` — Barra de tarefa
- [ ] `lib/taskjuggler/reports/GanttMilestone.rb` — Milestone
- [ ] `lib/taskjuggler/reports/GanttContainer.rb` — Container task
- [ ] `lib/taskjuggler/reports/GanttLoadStack.rb` — Load stack para resources
- [ ] `lib/taskjuggler/reports/GanttHeader.rb` — Header do Gantt

---

## 🎁 10. EXEMPLO DE FLUXO COMPLETO (TypeScript)

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

// 2. Schedule
await project.schedule();

// 3. Generate Reports
await report.generate();
// → Report.generate()
//   → generateIntermediateFormat()
//     → TaskListRE.generateIntermediateFormat()
//       → filterTaskList()
//       → Para cada coluna:
//         → generateHeaderCell(columnDef)
//           → Se columnDef.id === 'chart':
//             → GanttChart.new()
//             → gantt.generateByScale()
//             → column.cell1.special = gantt
//           → Senão:
//             → ReportTableColumn.new()
//       → generateTaskList()
//         → Para cada task:
//           → ReportTableLine.new()
//           → Para cada coluna:
//             → generateTableCell(line, columnDef, query)
//               → Se columnDef.id === 'chart':
//                 → GanttLine.new()
//                   → generate()
//                     → generateTask()
//                       → GanttTaskBar.new() / GanttMilestone.new() / GanttContainer.new()
//               → Senão:
//                 → ReportTableCell.new()
//                 → query.process()
//                 → cell.text = query.to_s()
//   → generateHTML()
//     → HTMLDocument.new()
//     → report.content.to_html()
//       → ReportTable.to_html()
//         → Para cada coluna:
//           → column.to_html(1) → ReportTableCell.to_html()
//           → column.to_html(2) → ReportTableCell.to_html()
//         → Para cada linha:
//           → line.to_html()
//             → Para cada cell:
//               → cell.to_html()
//                 → Se cell.special:
//                   → special.to_html() (GanttChart ou PlaceHolderCell)
//                 → Senão:
//                   → XMLElement('td', ...)
//     → Deno.writeTextFile()
```

---

## 🚀 11. PRÓXIMOS PASSOS

### Fase 10: Gantt Components Específicos (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/GanttTaskBar.rb`** — Barra de tarefa (leaf task)
2. **`lib/taskjuggler/reports/GanttMilestone.rb`** — Milestone (losango)
3. **`lib/taskjuggler/reports/GanttContainer.rb`** — Container task (barra com colchetes)
4. **`lib/taskjuggler/reports/GanttLoadStack.rb`** — Load stack (para resources aninhados)
5. **`lib/taskjuggler/reports/GanttHeader.rb`** — Header do Gantt (duas linhas temporais)

### Ordem de Leitura Sugerida

```
1. GanttHeader.rb        ← Header do Gantt (mais simples)
2. GanttTaskBar.rb       ← Barra de tarefa (leaf task)
3. GanttMilestone.rb     ← Milestone (losango)
4. GanttContainer.rb     ← Container task (barra com colchetes)
5. GanttLoadStack.rb     ← Load stack (para resources aninhados)
```

---

**Fim da Fase 9.** A estrutura completa de tabelas e os componentes básicos do Gantt estão agora **completamente mapeados**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `GanttHeader.rb` → `GanttTaskBar.rb` → `GanttMilestone.rb` → `GanttContainer.rb` → `GanttLoadStack.rb`. 🚀