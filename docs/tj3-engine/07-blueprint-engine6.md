# 📘 Blueprint Fase 7: Sistema de Relatórios + Expressões Lógicas + RichText

## 🎯 Objetivo
Complementar o blueprint com os 5 arquivos que formam o **sistema de relatórios**, as **funções lógicas** e o **parser de RichText**. Estes arquivos completam o pipeline final: do dado agendado até a saída HTML/CSV/TJP.

---

## 🏗️ 1. PIPELINE ATUALIZADO (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project.generateReports()                     │
│  └── Para cada Report:                                          │
│      └── report.generate()                                      │
│          ├── generateIntermediateFormat()  ◄── Report.rb        │
│          │   └── TaskListRE / ResourceListRE / TextReport / ... │
│          │       └── Query.process()       ◄── Query.rb         │
│          │           └── LogicalExpression.eval()  ◄── LogicalExpression.rb
│          │               └── LogicalOperation.eval() ◄── LogicalOperation.rb
│          │                   └── LogicalFunction.eval() ◄── LogicalFunction.rb ⭐
│          │               └── LogicalAttribute.eval()
│          │                   └── query_<attributeId>()
│          │
│          └── generateHTML() / generateCSV() / ...
│              └── HTMLDocument            ◄── HTMLDocument.rb ⭐
│              └── RichText.to_html()      ◄── RichText.rb ⭐
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              TableColumnDefinition (Colunas de Relatórios)       │
│  └── CellSettingPatternList (celltext, cellcolor, tooltip)      │
│  └── LogicalExpression para cada pattern                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. REPORT.RB — Classe Base de Relatórios

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Herda de PropertyTreeNode** | Usa o mesmo sistema de atributos |
| **Orquestrador de geração** | `generate()` → `generateIntermediateFormat()` → `generateHTML/CSV/TJP/...` |
| **Gerencia formatos** | html, csv, tjp, niku, iCal, mspxml, ctags |
| **Copia arquivos auxiliares** | CSS, JS, ícones |

### 2.2 Estrutura Interna

```typescript
class Report extends PropertyTreeNode {
  typeSpec: ReportType;  // :taskreport | :resourcereport | :accountreport | ...
  content: ReportContent | null;
  
  constructor(project: Project, id: string, name: string, parent: Report | null) {
    super(project.reports, id, name, parent);
    project.addReport(this);
    this.checkFileName(name);
    
    // Report tem um ReportScenario (dummy) para flags
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ReportScenario(this, i, this.scenarioAttributes[i])
    );
  }
}
```

### 2.3 Pipeline de Geração

```typescript
generate(requestedFormats?: OutputFormat[]): number {
  const oldTimeZone = TjTime.setTimeZone(this.get('timezone'));
  this.generateIntermediateFormat();
  
  const formats = requestedFormats || this.get('formats');
  for (const format of formats) {
    if (this.name === '') {
      this.error('empty_report_file_name',
        `Report ${this.id} has output formats requested, but the ` +
        `file name is empty.`);
    }
    
    switch (format) {
      case 'iCal': this.generateICal(); break;
      case 'html': this.generateHTML(); this.copyAuxiliaryFiles(); break;
      case 'csv': this.generateCSV(); break;
      case 'ctags': this.generateCTags(); break;
      case 'niku': this.generateNiku(); break;
      case 'tjp': this.generateTJP(); break;
      case 'mspxml': this.generateMspXml(); break;
      default:
        throw new Error(`Unknown report output format ${format}`);
    }
  }
  
  TjTime.setTimeZone(oldTimeZone);
  return 0;
}
```

### 2.4 generateIntermediateFormat()

```typescript
generateIntermediateFormat(): void {
  if (this.get('scenarios').length === 0) {
    this.warning('all_scenarios_disabled',
      `The report ${this.fullId} has only disabled scenarios. The ` +
      `report will possibly be empty.`);
  }
  
  this.content = null;
  
  switch (this.typeSpec) {
    case 'accountreport': this.content = new AccountListRE(this); break;
    case 'export': this.content = new ExportRE(this); break;
    case 'iCal': this.content = new ICalReport(this); break;
    case 'niku': this.content = new NikuReport(this); break;
    case 'resourcereport': this.content = new ResourceListRE(this); break;
    case 'tagfile': this.content = new TagFile(this); break;
    case 'textreport': this.content = new TextReport(this); break;
    case 'taskreport': this.content = new TaskListRE(this); break;
    case 'tracereport': this.content = new TraceReport(this); break;
    case 'statusSheet': this.content = new StatusSheetReport(this); break;
    case 'timeSheet': this.content = new TimeSheetReport(this); break;
    default:
      throw new Error(`Unknown report type`);
  }
  
  if (this.content) {
    this.content.generateIntermediateFormat();
  }
}
```

### 2.5 generateHTML()

```typescript
private generateHTML(): void {
  if (!this.content) return;
  
  if (typeof this.content.to_html !== 'function') {
    this.warning('html_not_supported',
      `HTML format is not supported for report ${this.id} of ` +
      `type ${this.typeSpec}.`);
    return;
  }
  
  const html = new HTMLDocument();
  const head = html.generateHead(
    `${this.project.get('name')} - ${this.get('title') || this.name}`,
    {
      'description': 'TaskJuggler Report',
      'keywords': 'taskjuggler, project, management'
    },
    this.get('rawHtmlHead')
  );
  
  if (this.get('selfcontained')) {
    // CSS inline
    const cssFile = await Deno.readTextFile(cssFileName);
    head.append(new XMLElement('style', { type: 'text/css' }, cssFile));
  } else {
    // CSS externo
    head.append(new XMLElement('link', {
      rel: 'stylesheet',
      type: 'text/css',
      href: `${this.get('auxdir')}css/tjreport.css`
    }));
  }
  
  const body = new XMLElement('body');
  const frame = new XMLElement('div', { class: 'tj_page' });
  frame.append(this.content.to_html());
  
  // Footer com copyright
  const footer = new XMLElement('div', { class: 'copyright' });
  if (this.project.get('copyright')) {
    footer.append(new XMLText(this.project.get('copyright') + ' - '));
  }
  footer.append(new XMLText(
    `Project: ${this.project.get('name')} ` +
    `Version: ${this.project.get('version')} - ` +
    `Created on ${new TjTime().to_s('%Y-%m-%d %H:%M:%S')} with `
  ));
  
  body.append(frame);
  html.html.append(body);
  
  const fileName = this.get('interactive') || this.name === '.'
    ? '.'
    : this.absoluteFileName(this.name) + '.html';
  
  await Deno.writeTextFile(fileName, html.toString());
}
```

### 2.6 Tipos de Report (typeSpec)

```typescript
enum ReportType {
  ACCOUNT_REPORT = 'accountreport',
  EXPORT = 'export',
  I_CAL = 'iCal',
  NIKU = 'niku',
  RESOURCE_REPORT = 'resourcereport',
  TAG_FILE = 'tagfile',
  TEXT_REPORT = 'textreport',
  TASK_REPORT = 'taskreport',
  TRACE_REPORT = 'tracereport',
  STATUS_SHEET = 'statusSheet',
  TIME_SHEET = 'timeSheet',
}
```

---

## 📋 3. TABLECOLUMNDEFINITION.RB — Definição de Colunas

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Define uma coluna** | ID, título, largura, alinhamento |
| **CellSettingPatternList** | Lista de padrões para celltext, cellcolor, tooltip |
| **Avaliação condicional** | LogicalExpression determina qual padrão usar |

### 3.2 Estrutura Interna

```typescript
class TableColumnDefinition {
  readonly id: string;
  title: string;
  start: TjTime | null = null;
  end: TjTime | null = null;
  cellText: CellSettingPatternList;
  cellColor: CellSettingPatternList;
  fontColor: CellSettingPatternList;
  hAlign: CellSettingPatternList;
  tooltip: CellSettingPatternList;
  listItem: string | null = null;
  listType: 'comma' | 'bullets' | 'numbered' | null = null;
  scale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'week';
  width: number | null = null;
  timeformat1: string | null = null;
  timeformat2: string | null = null;
  column: ReportTableColumn | null = null;  // Referência gerada
  content: 'load' | string = 'load';
  
  constructor(id: string, title: string) {
    this.id = id;
    this.title = title;
    this.cellText = new CellSettingPatternList();
    this.cellColor = new CellSettingPatternList();
    this.fontColor = new CellSettingPatternList();
    this.hAlign = new CellSettingPatternList();
    this.tooltip = new CellSettingPatternList();
  }
}
```

### 3.3 CellSettingPattern

```typescript
class CellSettingPattern {
  readonly setting: RichTextIntermediate | string;
  readonly logExpr: LogicalExpression;
  
  constructor(setting: any, logExpr: LogicalExpression) {
    this.setting = setting;
    this.logExpr = logExpr;
  }
}
```

### 3.4 CellSettingPatternList

```typescript
class CellSettingPatternList {
  private patterns: CellSettingPattern[] = [];
  
  addPattern(pattern: CellSettingPattern): void {
    this.patterns.push(pattern);
  }
  
  getPattern(query: Query): any | null {
    for (const pattern of this.patterns) {
      if (pattern.logExpr.eval(query)) {
        return pattern.setting;
      }
    }
    return null;
  }
}
```

### 3.5 Uso em Parser (TjpSyntaxRules)

```typescript
// No rule_columnOptions():
pattern(['_celltext', '!logicalExpression', '$STRING'], () => {
  this.column.cellText.addPattern(
    new CellSettingPattern(
      this.newRichText(this.val[2], this.sourceFileInfo[2]),
      this.val[1]
    )
  );
});

pattern(['_cellcolor', '!logicalExpression', '!color'], () => {
  this.column.cellColor.addPattern(
    new CellSettingPattern(this.val[2], this.val[1])
  );
});

pattern(['_tooltip', '!logicalExpression', '$STRING'], () => {
  this.column.tooltip.addPattern(
    new CellSettingPattern(
      this.newRichText(this.val[2], this.sourceFileInfo[2]),
      this.val[1]
    )
  );
});
```

---

## 🔧 4. LOGICALFUNCTION.RB — Funções Lógicas

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de LogicalOperation** | Modela chamadas de função em expressões lógicas |
| **14 funções pré-definidas** | isleaf, istask, isresource, etc. |
| **Inversão de propriedades** | Sufixo `_` inverte property/scopeProperty |

### 4.2 Estrutura Interna

```typescript
class LogicalFunction {
  name: string;
  arguments: any[];
  invertProperties: boolean;
  
  // Mapa de funções suportadas e número de argumentos
  static readonly functions: Map<string, number> = new Map([
    ['hasalert', 1],
    ['isactive', 1],
    ['ischildof', 1],
    ['isdependencyof', 3],
    ['isdutyof', 2],
    ['isfeatureof', 2],
    ['isleaf', 0],
    ['ismilestone', 1],
    ['isongoing', 1],
    ['isresource', 0],
    ['isresponsibilityof', 2],
    ['istask', 0],
    ['isvalid', 1],
    ['treelevel', 0],
  ]);
  
  constructor(opnd: string) {
    if (opnd.endsWith('_')) {
      // Função com _ inverte property e scopeProperty
      this.name = opnd.slice(0, -1);
      this.invertProperties = true;
    } else {
      this.name = opnd;
      this.invertProperties = false;
    }
    this.arguments = [];
  }
  
  setArgumentsAndCheck(args: any[]): [string, string] | null {
    if (!LogicalFunction.functions.has(this.name)) {
      return ['unknown_function',
        `Unknown function ${this.name} used in logical expression.`];
    }
    
    if (LogicalFunction.functions.get(this.name) !== args.length) {
      return ['wrong_no_func_arguments',
        `Wrong number of arguments for function ${this.name}. Got ` +
        `${args.length} instead of ${LogicalFunction.functions.get(this.name)}.`];
    }
    
    this.arguments = args;
    return null;
  }
  
  eval(expr: LogicalExpression): any {
    // Chama o método correspondente
    return (this as any)[this.name](expr, this.arguments);
  }
  
  toString(): string {
    return `${this.name}(${this.arguments.join(', ')})`;
  }
  
  private properties(expr: LogicalExpression): [PropertyTreeNode, PropertyTreeNode | null] {
    if (this.invertProperties) {
      return [expr.query.scopeProperty!, null];
    }
    return [expr.query.property!, expr.query.scopeProperty || null];
  }
}
```

### 4.3 Implementação das Funções

```typescript
// hasalert(level, date)
private hasalert(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const query = expr.query;
  const project = property.project;
  
  return !project.get('journal').currentEntries(
    query.end, property, args[0], query.start, query.hideJournalEntry
  ).isEmpty();
}

// isactive(scenarioId)
private isactive(expr: LogicalExpression, args: any[]): boolean {
  const [property, scopeProperty] = this.properties(expr);
  
  if (!(property instanceof Task) && !(property instanceof Resource)) {
    return false;
  }
  
  const project = property.project;
  const scenarioIdx = project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) {
    expr.error(`Unknown scenario '${args[0]}' used for function isactive()`);
  }
  
  const query = expr.query;
  return property.getAllocatedTime(scenarioIdx, query.startIdx, query.endIdx, scopeProperty) > 0.0;
}

// ischildof(parentId)
private ischildof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const parent = property.propertySet.get(args[0]);
  if (!parent) return false;
  return property.isChildOf(parent);
}

// isdependencyof(taskId, scenarioId, distance)
private isdependencyof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const task = project.task(args[0]);
  if (!task) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  if (typeof args[2] !== 'number') return false;
  
  return property.isDependencyOf(scenarioIdx, task, args[2]);
}

// isdutyof(resourceId, scenarioId)
private isdutyof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const resource = project.resource(args[0]);
  if (!resource) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.get('assignedresources', scenarioIdx).includes(resource);
}

// isfeatureof(taskId, scenarioId)
private isfeatureof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const task = project.task(args[0]);
  if (!task) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.isFeatureOf(scenarioIdx, task);
}

// isleaf()
private isleaf(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property.leaf();
}

// ismilestone(scenarioId)
private ismilestone(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  
  const scenarioIdx = property.project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) return false;
  
  return property instanceof Task && property.get('milestone', scenarioIdx);
}

// isongoing(scenarioId)
private isongoing(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const scenarioIdx = project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) {
    expr.error(`Unknown scenario '${args[0]}' used for function isongoing()`);
  }
  
  const query = expr.query;
  const iv1 = new TimeInterval(query.start, query.end);
  const tStart = property.get('start', scenarioIdx);
  const tEnd = property.get('end', scenarioIdx);
  
  // Mostra tasks com erros de scheduling
  if (!tStart || !tEnd) return true;
  
  const iv2 = new TimeInterval(tStart, tEnd);
  return iv1.overlaps(iv2);
}

// isresource()
private isresource(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property instanceof Resource;
}

// isresponsibilityof(resourceId, scenarioId)
private isresponsibilityof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const resource = project.resource(args[0]);
  if (!resource) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.get('responsible', scenarioIdx).includes(resource);
}

// istask()
private istask(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property instanceof Task;
}

// isvalid(scenario.attribute)
private isvalid(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const project = property.project;
  
  let [scenario, attr] = args[0].split('.');
  if (attr === undefined) {
    attr = scenario;
    scenario = undefined;
  }
  
  if (!attr) expr.error('Argument must not be empty');
  
  let scenarioIdx: number | undefined;
  if (scenario) {
    scenarioIdx = project.scenarioIdx(scenario);
    if (scenarioIdx === undefined) {
      expr.error(`Unknown scenario '${scenario}' used for function isvalid()`);
    }
  }
  
  if (!property.propertySet.knownAttribute(attr)) {
    expr.error(`Unknown attribute '${attr}' used for function isvalid()`);
  }
  
  if (scenario) {
    if (!property.attributeDefinition(attr).scenarioSpecific) {
      expr.error(`Attribute '${attr}' of property '${property.fullId}' ` +
        `is not scenario specific. Don't provide a scenario ID!`);
    }
    return property.get(attr, scenarioIdx!) !== null;
  } else {
    if (property.attributeDefinition(attr).scenarioSpecific) {
      expr.error(`Attribute '${attr}' of property '${property.fullId}' ` +
        `is scenario specific. Please provide a scenario ID!`);
    }
    return property.get(attr) !== null;
  }
}

// treelevel()
private treelevel(expr: LogicalExpression, args: any[]): number {
  const [property] = this.properties(expr);
  if (!property) return 0;
  return property.level() + 1;
}
```

### 4.4 Exemplos de Uso em TJP

```tjp
# Esconder tasks que não são leaf
hidetask ~isleaf()

# Esconder resources que não são leaf
hideresource ~isleaf()

# Combinar: mostrar apenas resources leaf para tasks leaf
hideresource ~(isleaf() & isleaf_())

# Mostrar tasks em progresso
hidetask plan.complete = 0 | plan.complete = 100

# Verificar se atributo é válido antes de comparar
hidetask ~isvalid(plan.maxend) | (plan.end > plan.maxend)
```

---

## 📝 5. RICHTEXT.RB — Parser de RichText (MediaWiki Markup)

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Parser de MediaWiki markup** | Converte markup em árvore de elementos |
| **Gera múltiplos formatos** | HTML, texto puro, tagged |
| **Funções customizadas** | Suporta handlers de função |

### 5.2 Markup Suportado

```markdown
== Headline 1 ==
=== Headline 2 ===
==== Headline 3 ====

---- (linha horizontal)

* Bullet 1
** Bullet 2
*** Bullet 3

# Enumeration Level 1
## Enumeration Level 2

   Preformatted text (começa com espaço)

''italic''
'''bold'''
''''monospaced''''
'''''italic and bold'''''

[http://example.com] Link
[http://example.com Text] Link com texto

[[item]] Referência interna
[[item Texto]] Referência com texto
[[function:path arg1 arg2]] Função

<nowiki> ... </nowiki> Desabilita markup
```

### 5.3 Estrutura Interna

```typescript
class RichText {
  inputText: string;
  functionHandlers: Map<string, RichTextFunctionHandler>;
  
  // Parser compartilhado entre instâncias
  static parser: RichTextParser | null = null;
  
  constructor(text: string, functionHandlers: RichTextFunctionHandler[] = []) {
    this.inputText = text;
    this.functionHandlers = new Map();
    for (const h of functionHandlers) {
      this.functionHandlers.set(h.function, h);
    }
  }
  
  generateIntermediateFormat(
    sectionCounter: number[] = [0, 0, 0],
    tokenSet?: TokenType[]
  ): RichTextIntermediate | null {
    const rti = new RichTextIntermediate(this);
    
    // Copia function handlers
    for (const [name, handler] of this.functionHandlers) {
      rti.registerFunctionHandler(handler);
    }
    
    if (RichText.parser) {
      RichText.parser.reuse(rti, sectionCounter, tokenSet);
    } else {
      RichText.parser = new RichTextParser(rti, sectionCounter, tokenSet);
    }
    
    RichText.parser.open(this.inputText);
    const tree = RichText.parser.parse('richtext');
    if (tree === false) return null;
    
    if (!tree) {
      tree = new RichTextElement(rti, 'richtext', null);
    }
    
    tree.cleanUp();
    rti.tree = tree;
    return rti;
  }
}
```

### 5.4 RichTextIntermediate

```typescript
class RichTextIntermediate {
  richText: RichText;
  tree: RichTextElement | null = null;
  blockMode: boolean = true;
  sectionNumbers: boolean = true;
  lineWidth: number = 80;
  indent: number = 0;
  titleIndent: number = 0;
  parIndent: number = 0;
  listIndent: number = 1;
  preIndent: number = 0;
  linkTarget: string | null = null;
  cssClass: string | null = null;
  functionHandlers: Map<string, RichTextFunctionHandler> = new Map();
  
  constructor(richText: RichText) {
    this.richText = richText;
  }
  
  registerFunctionHandler(handler: RichTextFunctionHandler): void {
    this.functionHandlers.set(handler.function, handler.dup());
  }
  
  empty(): boolean {
    return this.tree!.empty();
  }
  
  tableOfContents(toc: TableOfContents, fileName: string): void {
    this.tree!.tableOfContents(toc, fileName);
  }
  
  internalReferences(): string[] {
    return this.tree!.internalReferences();
  }
  
  to_s(): string {
    let str = this.tree!.to_s();
    while (str.endsWith('\n')) {
      str = str.slice(0, -1);
    }
    return str;
  }
  
  to_html(): string {
    let html = this.tree!.to_html();
    while (html.endsWith('\n')) {
      html = html.slice(0, -1);
    }
    return html;
  }
  
  to_tagged(): string {
    return this.tree!.to_tagged();
  }
}
```

### 5.5 Uso no Parser

```typescript
// No ProjectFileParser.newRichText():
newRichText(text: string, sfi: SourceFileInfo, tokenSet?: TokenType[]): RichTextIntermediate {
  const rText = new RichText(text, RTFHandlers.create(this.project, sfi));
  
  const mh = MessageHandlerInstance.instance;
  mh.baselineSFI = sfi;
  
  const rti = rText.generateIntermediateFormat([0, 0, 0], tokenSet);
  
  mh.baselineSFI = null;
  if (rti) {
    rti.sectionNumbers = false;
  }
  
  return rti!;
}
```

---

## 🌐 6. HTMLDOCUMENT.RB — Geração de HTML

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de XMLDocument** | Adiciona elementos HTML obrigatórios |
| **Suporta múltiplos doctypes** | html5, strict, transitional, frameset |
| **Gera head com meta tags** | Título, charset, compatibilidade |

### 6.2 Estrutura Interna

```typescript
class HTMLDocument extends XMLDocument {
  html: HTMLElement;
  
  constructor(docType: 'html5' | 'strict' | 'transitional' | 'frameset' = 'html5') {
    super();
    
    if (docType !== 'html5') {
      this.elements.push(new XMLBlob('<?xml version="1.0" encoding="UTF-8"?>'));
      
      let dtdRef: string, url: string;
      switch (docType) {
        case 'strict':
          dtdRef = 'Strict';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd';
          break;
        case 'transitional':
          dtdRef = 'Transitional';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd';
          break;
        case 'frameset':
          dtdRef = 'Frameset';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd';
          break;
      }
      
      this.elements.push(new XMLBlob(
        `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 ${dtdRef}//EN" "${url}">`
      ));
    } else {
      this.elements.push(new XMLBlob('<!DOCTYPE html>'));
    }
    
    this.elements.push(new XMLComment(
      `This file has been generated by ${AppConfig.appName} v${AppConfig.version}`
    ));
    
    const attrs: Record<string, string> = {
      'xml:lang': 'en',
      'lang': 'en'
    };
    if (docType !== 'html5') {
      attrs['xmlns'] = 'http://www.w3.org/1999/xhtml';
    }
    
    this.html = new HTMLElement('html', attrs);
    this.elements.push(this.html);
  }
  
  generateHead(
    title: string,
    metaTags: Record<string, string> = {},
    blob?: string
  ): HTMLElement {
    const head = new HTMLElement('head');
    
    const elements: XMLElement[] = [
      new HTMLElement('title', {}, title),
      new HTMLElement('meta', {
        'http-equiv': 'Content-Type',
        'content': 'text/html; charset=utf-8'
      }),
      new HTMLElement('meta', {
        'http-equiv': 'X-UA-Compatible',
        'content': 'IE=9'
      }),
    ];
    
    for (const [name, content] of Object.entries(metaTags)) {
      elements.push(new HTMLElement('meta', { name, content }));
    }
    
    if (blob) {
      elements.push(new XMLBlob(blob));
    }
    
    head.append(...elements);
    this.html.append(head);
    
    return head;
  }
}
```

### 6.3 Uso em Reports

```typescript
// Em Report.generateHTML():
const html = new HTMLDocument();
const head = html.generateHead(
  `${project.get('name')} - ${report.get('title') || report.name}`,
  {
    'description': 'TaskJuggler Report',
    'keywords': 'taskjuggler, project, management'
  },
  report.get('rawHtmlHead')
);

// Adiciona CSS
if (report.get('selfcontained')) {
  const cssFile = await Deno.readTextFile(cssFileName);
  head.append(new HTMLElement('style', { type: 'text/css' }, cssFile));
} else {
  head.append(new HTMLElement('link', {
    rel: 'stylesheet',
    type: 'text/css',
    href: `${report.get('auxdir')}css/tjreport.css`
  }));
}

// Adiciona body
const body = new HTMLElement('body');
const frame = new HTMLElement('div', { class: 'tj_page' });
frame.append(report.content!.to_html());
body.append(frame);

html.html.append(body);
await Deno.writeTextFile(fileName, html.toString());
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 7)

```
FASE 7A: Expressões Lógicas
  1. LogicalFunction.ts
     - Mapa de funções (14 funções)
     - Método eval() com dispatch
     - Inversão de propriedades (sufixo _)
  
  2. Atualizar LogicalOperation.ts
     - Integrar LogicalFunction
  
  3. Atualizar LogicalExpression.ts
     - Integrar LogicalFunction

FASE 7B: RichText
  4. RichText.ts
     - Parser de MediaWiki markup
     - RichTextIntermediate
     - RichTextElement (árvore)
     - to_html(), to_s(), to_tagged()
  
  5. RichText/Parser.ts
     - Scanner de markup
     - Regras de parsing
  
  6. RichText/Element.ts
     - Elementos da árvore
     - Conversão para HTML/texto

FASE 7C: Reports
  7. TableColumnDefinition.ts
     - CellSettingPattern
     - CellSettingPatternList
  
  8. Report.ts (classe base)
     - generate()
     - generateIntermediateFormat()
     - generateHTML/CSV/TJP/...
  
  9. HTMLDocument.ts
     - Especialização de XMLDocument
     - generateHead()
  
  10. HTMLDocument/Elements.ts
      - HTMLElement, XMLText, XMLBlob, etc.

FASE 7D: Reports Específicos
  11. TaskListRE.ts (TaskReport)
  12. ResourceListRE.ts (ResourceReport)
  13. AccountListRE.ts (AccountReport)
  14. TextReport.ts
  15. ExportRE.ts
  16. TraceReport.ts
  17. ICalReport.ts
  18. NikuReport.ts
  19. TagFile.ts
  20. StatusSheetReport.ts
  21. TimeSheetReport.ts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 LogicalFunction com Registry
```typescript
class LogicalFunction {
  private static readonly registry = new Map<string, FunctionImpl>([
    ['hasalert', hasalertImpl],
    ['isactive', isactiveImpl],
    ['ischildof', ischildofImpl],
    // ...
  ]);
  
  eval(expr: LogicalExpression): any {
    const impl = LogicalFunction.registry.get(this.name);
    if (!impl) {
      throw new Error(`Unknown function ${this.name}`);
    }
    return impl(this, expr, this.arguments);
  }
}

type FunctionImpl = (
  func: LogicalFunction,
  expr: LogicalExpression,
  args: any[]
) => any;
```

#### 7.2.2 RichText com Parser Combinator
```typescript
class RichTextParser {
  private rules: Map<string, Rule> = new Map();
  
  constructor() {
    this.rules.set('richtext', this.richtextRule());
    this.rules.set('headline', this.headlineRule());
    this.rules.set('bold', this.boldRule());
    // ...
  }
  
  private richtextRule(): Rule {
    return new Rule([
      this.zeroOrMore(this.alternatives(
        this.headlineRule(),
        this.paragraphRule(),
        this.listRule(),
        this.preformattedRule()
      ))
    ]);
  }
}
```

#### 7.2.3 TableColumnDefinition com Builder
```typescript
class TableColumnBuilder {
  private column: TableColumnDefinition;
  
  constructor(id: string, title: string) {
    this.column = new TableColumnDefinition(id, title);
  }
  
  cellText(expr: LogicalExpression, text: string): this {
    this.column.cellText.addPattern(
      new CellSettingPattern(text, expr)
    );
    return this;
  }
  
  cellColor(expr: LogicalExpression, color: string): this {
    this.column.cellColor.addPattern(
      new CellSettingPattern(color, expr)
    );
    return this;
  }
  
  width(w: number): this {
    this.column.width = w;
    return this;
  }
  
  build(): TableColumnDefinition {
    return this.column;
  }
}
```

#### 7.2.4 Report com Strategy Pattern
```typescript
abstract class ReportContent {
  protected report: Report;
  
  constructor(report: Report) {
    this.report = report;
  }
  
  abstract generateIntermediateFormat(): void;
  abstract to_html(): XMLElement | null;
  abstract to_csv(): any[][] | null;
  abstract to_tjp(): string | null;
}

class TaskListRE extends ReportContent {
  generateIntermediateFormat(): void {
    // Implementação específica para task reports
  }
  
  to_html(): XMLElement {
    // Gera tabela HTML com tasks
  }
}

// Factory no Report:
generateIntermediateFormat(): void {
  switch (this.typeSpec) {
    case 'taskreport':
      this.content = new TaskListRE(this);
      break;
    case 'resourcereport':
      this.content = new ResourceListRE(this);
      break;
    // ...
  }
  this.content!.generateIntermediateFormat();
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **LogicalFunction com sufixo `_` inverte propriedades!**
   ```typescript
   // isleaf() opera em property
   // isleaf_() opera em scopeProperty
   ```

2. **RichText parser é compartilhado!**
   ```typescript
   // Usar static parser para evitar recriação
   // Chamar reuse() para resetar estado
   ```

3. **CellSettingPatternList avalia na ordem!**
   ```typescript
   // Primeiro pattern que matcha é usado
   // Ordem de adição importa
   ```

4. **Report.generateHTML() copia arquivos auxiliares!**
   ```typescript
   // CSS, JS, ícones são copiados para outputDir
   // A menos que selfcontained = true
   ```

5. **RichTextIntermediate.blockMode afeta parsing!**
   ```typescript
   // blockMode = true: interpreta como bloco
   // blockMode = false: interpreta como linha
   ```

6. **HTMLDocument suporta múltiplos doctypes!**
   ```typescript
   // html5 (default): <!DOCTYPE html>
   // strict/transitional/frameset: XHTML 1.0
   ```

7. **LogicalFunction.isvalid() valida atributos!**
   ```typescript
   // Verifica se atributo existe
   // Verifica se scenario-specific bate com scenario ID
   // Retorna false se atributo é nil
   ```

8. **TableColumnDefinition tem dois formatos de tempo!**
   ```typescript
   // timeformat1: header superior (ex: "2026")
   // timeformat2: header inferior (ex: "Jan")
   ```

9. **Report.typeSpec determina o content!**
   ```typescript
   // taskreport → TaskListRE
   // resourcereport → ResourceListRE
   // textreport → TextReport
   // etc.
   ```

10. **RichText suporta funções customizadas!**
    ```typescript
    // [[function:path arg1 arg2]]
    // functionHandlers processam essas chamadas
    ```

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (35 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, AttributeDefinition, TjTime
- [x] **Scheduler Core**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Lógica**: LogicalExpression, LogicalOperation
- [x] **Fase 5**: Allocation, Limits, ShiftAssignments, Booking, TaskDependency
- [x] **Fase 6**: PropertySet, Scenario, ScenarioData, Query, Attributes
- [x] **Fase 7**: Report, TableColumnDefinition, LogicalFunction, RichText, HTMLDocument ⭐

### 🔮 Próximos 5 (Fase 8 - Reports Específicos)
- [ ] `lib/taskjuggler/reports/TaskListRE.rb` — TaskReport
- [ ] `lib/taskjuggler/reports/ResourceListRE.rb` — ResourceReport
- [ ] `lib/taskjuggler/reports/ReportTable.rb` — Tabela de relatório
- [ ] `lib/taskjuggler/reports/GanttChart.rb` — Gráfico Gantt
- [ ] `lib/taskjuggler/reports/TextReport.rb` — TextReport

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Report
const report = new Report(project, 'r1', 'My Report', null);
report.typeSpec = 'taskreport';
report.set('formats', ['html', 'csv']);
report.set('columns', [
  new TableColumnDefinition('bsi', 'BSI'),
  new TableColumnDefinition('name', 'Name'),
  new TableColumnDefinition('start', 'Start'),
  new TableColumnDefinition('end', 'End'),
  new TableColumnDefinition('effort', 'Effort'),
  new TableColumnDefinition('chart', 'Chart'),
]);

// 2. Adiciona celltext condicional
const col = report.get('columns')[4];  // effort column
col.cellText.addPattern(new CellSettingPattern(
  new RichText('<fcol:red><-effort-></fcol>').generateIntermediateFormat(),
  new LogicalExpression(new LogicalOperation(
    new LogicalAttribute('effort', project.scenario(0)),
    '>',
    new LogicalOperation(100)
  ))
));

// 3. Parser cria LogicalFunction
const func = new LogicalFunction('isleaf');
func.setArgumentsAndCheck([]);

// 4. Parser cria hidetask
const hideTask = new LogicalExpression(
  new LogicalOperation(
    new LogicalFunction('isleaf'),
    '~',
    null
  )
);
report.set('hideTask', hideTask);

// 5. Gera relatório
await project.schedule();
await report.generate();
// → generateIntermediateFormat()
//   → TaskListRE.generateIntermediateFormat()
//     → Para cada task:
//       → Query.process()
//         → LogicalExpression.eval()
//           → LogicalFunction.eval()
//             → isleaf()
//       → cellText.getPattern(query)
//         → LogicalExpression.eval()
// → generateHTML()
//   → HTMLDocument.generateHead()
//   → report.content.to_html()
//   → Deno.writeTextFile()
```

---

## 🚀 10. PRÓXIMOS PASSOS

### Fase 8: Reports Específicos (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/TaskListRE.rb`** — TaskReport (o mais complexo!)
2. **`lib/taskjuggler/reports/ResourceListRE.rb`** — ResourceReport
3. **`lib/taskjuggler/reports/ReportTable.rb`** — Tabela base
4. **`lib/taskjuggler/reports/GanttChart.rb`** — Gráfico Gantt (SVG)
5. **`lib/taskjuggler/reports/TextReport.rb`** — TextReport

### Ordem de Leitura Sugerida

```
1. ReportTable.rb        ← Base de todas as tabelas
2. TaskListRE.rb         ← TaskReport (mais usado)
3. ResourceListRE.rb     ← ResourceReport
4. GanttChart.rb         ← Gráfico Gantt (SVG)
5. TextReport.rb         ← TextReport (mais simples)
```

---

**Fim da Fase 7.** O sistema de relatórios está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ReportTable.rb` → `TaskListRE.rb` → `ResourceListRE.rb` → `GanttChart.rb` → `TextReport.rb`. 🚀