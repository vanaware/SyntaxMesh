# 📘 Blueprint Fase 15: Sistema de Relatórios Completo

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **sistema de relatórios**: roteamento de setas, helpers gráficos, contexto de relatórios, navegação e base de relatórios. Estes são os componentes estruturais que sustentam todos os relatórios específicos.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── TaskListRE / ResourceListRE / AccountListRE             │
│          └── TableReport (base)                                  │
│              └── ReportBase  ◄── ReportBase.rb ⭐                │
│                  ├── filterTaskList() / filterResourceList()     │
│                  ├── generateHtmlTableFrame()                    │
│                  └── rt_to_html()                                │
│                                                                  │
│  └── generateHTML()                                              │
│      └── HTMLDocument                                            │
│      └── ReportContext  ◄── ReportContext.rb ⭐                  │
│          └── Preserva contexto em relatórios aninhados           │
│      └── Navigator  ◄── Navigator.rb ⭐                          │
│          └── Gera menu de navegação entre relatórios             │
│      └── ReportTable                                             │
│          └── GanttChart                                          │
│              └── GanttRouter  ◄── GanttRouter.rb ⭐              │
│                  └── Roteia dependency arrows                    │
│              └── HTMLGraphics  ◄── HTMLGraphics.rb ⭐            │
│                  └── rectToHTML(), lineToHTML(), etc.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. GANTTROUTER.RB — Roteamento de Dependency Arrows

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Roteamento ortogonal** | Encontra caminhos sem cruzar zonas bloqueadas |
| **Minimização de cruzamentos** | Ordena setas por ângulo para reduzir sobreposições |
| **Zonas bloqueadas** | Task bars, milestones, now line bloqueiam rotas |
| **Arrow heads** | Garante exatamente uma seta por endpoint |

### 2.2 Estrutura Interna

```typescript
class GanttRouter {
  static readonly MinStartGap = 5;   // Gap mínimo antes do primeiro turno
  static readonly MinEndGap = 10;    // Gap mínimo antes da ponta da seta
  
  @width: number;
  @height: number;
  @detector: CollisionDetector;  // Detecta colisões com zonas bloqueadas
  
  constructor(width: number, height: number);
  
  addZone(x: number, y: number, w: number, h: number, 
          horiz: boolean, vert: boolean): void;
  
  routeLines(fromToPoints: [number, number, number, number][]): [number, number][][];
  route(startX: number, startY: number, endX: number, endY: number): [number, number][];
  
  to_html(): XMLElement;  // Debug only
}
```

### 2.3 Algoritmo de Roteamento

```typescript
routeLines(fromToPoints: [number, number, number, number][]): [number, number][][] {
  // 1. Converte para lista de objetos com metadados
  const routes = fromToPoints.map(([startX, startY, endX, endY, id]) => ({
    startX, startY, endX, endY, id,
    distance: 0,
    angle: 0
  }));
  
  // 2. Calcula ângulo e distância para ordenação
  routes.forEach(r => {
    const adjLeg = (r.endX - MinEndGap) - (r.startX + MinStartGap);
    const oppLeg = Math.abs(r.startY - r.endY);
    r.distance = Math.sqrt(adjLeg ** 2 + oppLeg ** 2);
    
    const sinus = Math.abs(oppLeg) / r.distance;
    r.angle = (adjLeg < 0 
      ? Math.PI / 2 + Math.asin(Math.PI / 2 - sinus)
      : Math.asin(sinus)) / (Math.PI / (2 * 90));
  });
  
  // 3. Ordena por ângulo (menor para maior)
  routes.sort((r1, r2) => {
    const angleDiff = Math.floor(r1.angle / 5) - Math.floor(r2.angle / 5);
    if (angleDiff === 0) {
      return r2.distance - r1.distance;  // Maior distância primeiro
    }
    return r2.angle - r1.angle;  // Maior ângulo primeiro
  });
  
  // 4. Roteia cada seta individualmente
  return routes.map(r => this.route(r.startX, r.startY, r.endX, r.endY));
}

route(startX: number, startY: number, endX: number, endY: number): [number, number][] {
  const points: [number, number][] = [[startX, startY]];
  const startGap = MinStartGap;
  const endGap = MinEndGap;
  
  // Tenta rota direta se houver espaço horizontal suficiente
  if (endX - startX > startGap + endGap + 2) {
    const xSeg = this.placeLine(
      [startY + (startY < endY ? 1 : -1), endY],
      false,  // vertical
      startX + startGap,
      1
    );
    
    if (xSeg && xSeg < endX - endGap) {
      // Rota direta funciona
      this.addLineTo(points, xSeg, startY);  // Point 1
      this.addLineTo(points, xSeg, endY);    // Point 2
      this.addLineTo(points, endX, endY);
      return points;
    }
  }
  
  // Rota complexa com 4 pontos
  const deltaY = startY < endY ? 1 : -1;
  
  // Segmento horizontal
  const ySeg = this.placeLine([0, this.width - 1], true, startY + 2 * deltaY, deltaY);
  if (!ySeg) throw new Error("Routing failed");
  
  // Primeira vertical
  const x1 = this.placeLine([startY + deltaY, ySeg], false, startX + startGap, 1);
  if (!x1) throw new Error("Routing failed");
  
  // Segunda vertical
  const x2 = this.placeLine([ySeg + deltaY, endY], false, endX - endGap, -1);
  if (!x2) throw new Error("Routing failed");
  
  // Adiciona pontos
  this.addLineTo(points, x1, startY);  // Point 1
  if (x1 !== x2) {
    this.addLineTo(points, x1, ySeg);  // Point 2
    this.addLineTo(points, x2, ySeg);  // Point 3
  }
  this.addLineTo(points, x2, endY);    // Point 4
  this.addLineTo(points, endX, endY);
  
  return points;
}
```

### 2.4 placeLine() — O Coração do Algoritmo

```typescript
private placeLine(
  segment: [number, number],
  horizontal: boolean,
  start: number,
  delta: number
): number {
  if (delta === 0) throw new Error("delta may not be 0");
  
  let pos = Math.round(start);
  pos = Math.max(0, pos);
  const max = (horizontal ? this.height : this.width) - 1;
  pos = Math.min(max, pos);
  
  // Ordena segmento
  segment.sort((a, b) => a - b);
  
  // Busca posição livre
  while (this.detector.collision(pos, segment, horizontal)) {
    pos += delta;
    
    // Verifica limites
    if (delta < 0) {
      if (pos < 0) break;
    } else {
      if (pos >= (horizontal ? this.height : this.width)) break;
    }
  }
  
  return pos;
}
```

### 2.5 addLineTo() — Adiciona Waypoint e Bloqueia Zona

```typescript
private addLineTo(points: [number, number][], x2: number, y2: number): void {
  if (points.length === 0) throw new Error("Point list may not be empty");
  
  const [x1, y1] = points[points.length - 1];
  points.push([x2, y2]);
  
  if (x1 === x2) {
    // Linha vertical
    if (x1 < 0 || x1 >= this.width) return;
    const [x, y, w, h] = this.justify(x1 - 2, y1, 5, y2 - y1 + 1);
    this.addZone(x, y, w, h, false, true);  // Bloqueia vertical
  } else {
    // Linha horizontal
    if (y1 < 0 || x1 >= this.height) return;
    const [x, y, w, h] = this.justify(x1, y1 - 2, x2 - x1 + 1, 5);
    this.addZone(x, y, w, h, true, false);  // Bloqueia horizontal
  }
}

private justify(x: number, y: number, w: number, h: number): [number, number, number, number] {
  if (w < 0) {
    w = -w;
    x = x - w + 1;
  }
  if (h < 0) {
    h = -h;
    y = y - h + 1;
  }
  return [x, y, w, h];
}
```

### 2.6 Pontos Críticos

1. **CollisionDetector** — Não foi anexado, mas é essencial. Detecta colisões com zonas bloqueadas.

2. **Ordenação por ângulo** — Reduz cruzamentos de setas. Setas com ângulos similares são roteadas juntas.

3. **Zonas de 5 pixels** — Cada linha adicionada bloqueia uma zona de 5 pixels de largura para evitar linhas paralelas muito próximas.

4. **Rota direta vs complexa** — Tenta primeiro rota direta (2 turnos), se falhar usa rota complexa (4 turnos).

5. **MinStartGap/MinEndGap** — Garante espaço mínimo antes do primeiro turno e antes da ponta da seta.

---

## 🎨 3. HTMLGRAPHICS.RB — Helpers Gráficos

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderização HTML** | Converte primitivas gráficas em elementos HTML |
| **Linhas** | Horizontal e vertical (não diagonal) |
| **Retângulos** | Preenchidos com classe CSS |
| **Jags** | Colchetes para container tasks |
| **Diamantes** | Milestones |
| **Arrow heads** | Pontas de setas |

### 3.2 Estrutura Interna

```typescript
module HTMLGraphics {
  lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement;
  rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement;
  jagToHTML(x: number, y: number): XMLElement;
  diamondToHTML(x: number, y: number): XMLElement[];
  arrowHeadToHTML(x: number, y: number): XMLElement;
}
```

### 3.3 Implementação

```typescript
// Linha horizontal ou vertical
lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement {
  xs = Math.round(xs);
  ys = Math.round(ys);
  xe = Math.round(xe);
  ye = Math.round(ye);
  
  let style: string;
  if (ys === ye) {
    // Horizontal
    if (xe < xs) [xs, xe] = [xe, xs];
    style = `left:${xs}px; top:${ys}px; width:${xe - xs + 1}px; height:1px;`;
  } else if (xs === xe) {
    // Vertical
    if (ye < ys) [ys, ye] = [ye, ys];
    style = `left:${xs}px; top:${ys}px; width:1px; height:${ye - ys + 1}px;`;
  } else {
    throw new Error(`Can't draw diagonal line ${xs}/${ys} to ${xe}/${ye}!`);
  }
  
  return new XMLElement('div', { class: category, style });
}

// Retângulo preenchido
rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement {
  const style = `left:${Math.round(x)}px; top:${Math.round(y)}px; ` +
                `width:${Math.round(w)}px; height:${Math.round(h)}px;`;
  return new XMLElement('div', { class: category, style });
}

// Jag (colchete) para container tasks
jagToHTML(x: number, y: number): XMLElement {
  return new XMLElement('div', {
    class: 'tj_gantt_jag',
    style: `left:${Math.round(x) - 5}px; top:${Math.round(y)}px;`
  });
}

// Diamante para milestones (2 divs: topo e base)
diamondToHTML(x: number, y: number): XMLElement[] {
  return [
    new XMLElement('div', {
      class: 'tj_diamond_top',
      style: `left:${Math.round(x) - 6}px; top:${Math.round(y) - 7}px;`
    }),
    new XMLElement('div', {
      class: 'tj_diamond_bottom',
      style: `left:${Math.round(x) - 6}px; top:${Math.round(y)}px;`
    })
  ];
}

// Arrow head (ponta de seta)
arrowHeadToHTML(x: number, y: number): XMLElement {
  return new XMLElement('div', {
    class: 'tj_arrow_head',
    style: `left:${Math.round(x) - 5}px; top:${Math.round(y) - 5}px;`
  });
}
```

### 3.4 Pontos Críticos

1. **Sem diagonais** — Apenas linhas horizontais e verticais.

2. **Coordenadas inteiras** — Usa `Math.round()` para evitar subpixel rendering.

3. **CSS classes** — Cada elemento tem uma classe CSS que define cor e estilo.

4. **Diamante em 2 partes** — Topo e base são divs separados para criar efeito de losango.

5. **Mixin pattern** — Em TypeScript, usar interface ou mixin para adicionar esses métodos a GanttTaskBar, GanttMilestone, etc.

---

## 📋 4. REPORTCONTEXT.RB — Contexto de Relatórios

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Preserva contexto** | Mantém configurações de relatórios aninhados |
| **Query template** | Cria Query com configurações do relatório |
| **Dynamic Report ID** | ID único para relatórios incluídos múltiplas vezes |
| **Backup de atributos** | Permite modificar e restaurar atributos dinamicamente |

### 4.2 Estrutura Interna

```typescript
class ReportContext {
  @project: Project;
  @report: Report;
  @query: Query;
  @dynamicReportId: string;
  @childReportCounter: number = 0;
  @tasks: PropertyList<Task>;
  @resources: PropertyList<Resource>;
  @attributeBackup: [Map<string, Attribute>, Map<string, Attribute>[]] | null = null;
  
  constructor(project: Project, report: Report);
}
```

### 4.3 Construtor

```typescript
constructor(project: Project, report: Report) {
  this.project = project;
  this.report = report;
  this.childReportCounter = 0;
  this.attributeBackup = null;
  
  // Cria Query com configurações do relatório
  const queryAttrs = {
    project: this.project,
    loadUnit: this.report.get('loadUnit'),
    numberFormat: this.report.get('numberFormat'),
    timeFormat: this.report.get('timeFormat'),
    currencyFormat: this.report.get('currencyFormat'),
    start: this.report.get('start'),
    end: this.report.get('end'),
    hideJournalEntry: this.report.get('hideJournalEntry'),
    journalMode: this.report.get('journalMode'),
    journalAttributes: this.report.get('journalAttributes'),
    sortJournalEntries: this.report.get('sortJournalEntries'),
    costAccount: this.report.get('costaccount'),
    revenueAccount: this.report.get('revenueaccount')
  };
  
  this.query = new Query(queryAttrs);
  
  // Verifica se há contexto pai
  const parent = this.project.reportContexts[this.project.reportContexts.length - 1];
  
  if (parent) {
    // Contexto aninhado
    this.dynamicReportId = `${parent.dynamicReportId}.${parent.childReportCounter}`;
    parent.childReportCounter++;
    
    // Copia tasks e resources do pai
    this.tasks = parent.tasks.slice();
    this.resources = parent.resources.slice();
  } else {
    // Contexto raiz
    this.dynamicReportId = "0";
    this.tasks = this.project.tasks.to_ary();
    this.resources = this.project.resources.to_ary();
  }
}
```

### 4.4 Uso no Project

```typescript
// No Project.generateReports():
generateReports(maxCpuCores: number): void {
  this.reports.index();
  
  if (maxCpuCores === 1) {
    // Modo sequencial
    for (const report of this.reports) {
      if (report.get('formats').length === 0) continue;
      
      Log.startProgressMeter(`Report ${report.name}`);
      this.reportContexts.push(new ReportContext(this, report));
      report.generate();
      this.reportContexts.pop();
      Log.stopProgressMeter();
    }
  } else {
    // Modo paralelo
    const bp = new BatchProcessor(maxCpuCores);
    
    for (const report of this.reports) {
      if (report.get('formats').length === 0) continue;
      
      bp.queue(report, () => {
        this.reportContexts.push(new ReportContext(this, report));
        const res = report.generate();
        this.reportContexts.pop();
        return res;
      });
    }
    
    bp.wait((job) => {
      Log.startProgressMeter(`Report ${job.tag.name}`);
      console.log(job.stdout);
      console.error(job.stderr);
      Log.stopProgressMeter();
    });
  }
  
  DataCache.instance.flush();
}
```

### 4.5 Pontos Críticos

1. **Stack de contextos** — `project.reportContexts` é uma stack. O último elemento é o contexto atual.

2. **Dynamic Report ID** — Formato "0.1.2" indica hierarquia de relatórios aninhados.

3. **Query compartilhada** — Todos os relatórios usam a mesma Query template, mas com configurações diferentes.

4. **Backup de atributos** — Permite modificar atributos dinamicamente e restaurar depois (usado em `generateReport()`).

5. **Tasks/Resources copiados** — Cada contexto tem sua própria cópia para evitar interferência entre relatórios.

---

## 🧭 5. NAVIGATOR.RB — Navegação entre Relatórios

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Menu de navegação** | Gera menu HTML para navegar entre relatórios |
| **Estrutura hierárquica** | Reutiliza estrutura de relatórios aninhados |
| **Filtragem** | `hideReport` controla quais relatórios aparecem |
| **URLs relativas** | Calcula URLs relativas entre relatórios |

### 5.2 Estrutura Interna

```typescript
class NavigatorElement {
  @parent: NavigatorElement | null;
  @label: string;
  @url: string | null;
  @elements: NavigatorElement[] = [];
  @current: boolean = false;
  
  constructor(parent: NavigatorElement | null, label?: string, url?: string);
  
  to_html(html?: XMLElement): XMLElement;
  to_s(indent?: number): void;
}

class Navigator {
  @id: string;
  @project: Project;
  @hideReport: LogicalExpression;
  @elements: NavigatorElement[] = [];
  
  constructor(id: string, project: Project);
  
  generate(allReports: Report[], currentReports: Report[], 
           reportDef: Report, parentElement: NavigatorElement): void;
  to_html(): XMLElement | null;
}
```

### 5.3 generate() — Construção da Árvore

```typescript
generate(allReports: Report[], currentReports: Report[], 
         reportDef: Report, parentElement: NavigatorElement): void {
  let element: NavigatorElement | null = null;
  let nextParentElement: NavigatorElement | null = null;
  let nextParentReport: Report | null = null;
  
  for (const report of currentReports) {
    const hasURL = report.get('formats').includes('html');
    
    // Pula relatórios folha sem HTML
    if ((report.leaf() && !hasURL) || !allReports.includes(report)) continue;
    
    // Label do menu
    const label = report.get('title') || report.name;
    
    // URL do relatório
    const url = this.findReportURL(report, allReports, reportDef);
    
    // Cria elemento do menu
    parentElement.elements.push(
      element = new NavigatorElement(parentElement, label, url)
    );
    
    // Verifica se este é o relatório atual
    if (reportDef === report || reportDef.isChildOf(report)) {
      nextParentReport = report;
      nextParentElement = element;
      element.current = true;
    }
  }
  
  // Recursivamente gera sub-menu se necessário
  if (nextParentReport && nextParentReport.container()) {
    this.generate(allReports, nextParentReport.kids(), reportDef, nextParentElement!);
  }
}
```

### 5.4 to_html() — Renderização HTML

```typescript
to_html(): XMLElement | null {
  const reportDef = this.project.reportContexts[this.project.reportContexts.length - 1].report;
  if (!reportDef) throw new Error("Report context missing");
  
  // Filtra relatórios
  const reports = this.filterReports();
  if (reports.length === 0) return null;
  
  // Verifica se o relatório atual está na lista
  if (!reports.includes(reportDef)) {
    this.project.warning('nav_in_hidden_rep',
      "Navigator requested for a report that is not included in the navigator list.",
      reportDef.sourceFileInfo);
    return null;
  }
  
  // Encontra relatórios top-level
  let topLevelReports: Report[] = [reportDef];
  let report = reportDef;
  while (report.parent) {
    report = report.parent;
    topLevelReports = report.kids();
  }
  
  // Gera árvore
  const content = new NavigatorElement(null);
  this.generate(reports, topLevelReports, reportDef, content);
  
  return content.to_html();
}
```

### 5.5 NavigatorElement.to_html()

```typescript
to_html(html?: XMLElement): XMLElement {
  let first = true;
  const topLevel = !html;
  
  // Container do menu
  html = html || new XMLElement('div', { class: 'navbar_container' });
  if (topLevel) {
    html.append(new XMLElement('hr', { class: 'navbar_topruler' }));
  }
  
  // Container deste (sub-)menu
  html.append(new XMLElement('div', { class: 'navbar' }));
  const div = html.children[html.children.length - 1] as XMLElement;
  
  for (const element of this.elements) {
    // Separador vertical
    if (first) {
      first = false;
    } else {
      div.append(new XMLText('|'));
    }
    
    if (element.current) {
      // Entry atual (highlight)
      const span = new XMLElement('span', { class: 'navbar_current' });
      span.append(new XMLText(element.label));
      div.append(span);
    } else {
      // Link para outro relatório
      const span = new XMLElement('span', { class: 'navbar_other' });
      const a = new XMLElement('a', { href: element.url });
      a.append(new XMLText(element.label));
      span.append(a);
      div.append(span);
    }
  }
  
  // Sub-menu se necessário
  for (const element of this.elements) {
    if (element.current && element.elements.length > 0) {
      if (!first) {
        html.append(new XMLElement('hr', { class: 'navbar_midruler' }));
      }
      element.to_html(html);
      break;
    }
  }
  
  if (topLevel) {
    html.append(new XMLElement('hr', { class: 'navbar_bottomruler' }));
  }
  
  return html;
}
```

### 5.6 Pontos Críticos

1. **filterReports()** — Usa `hideReport` LogicalExpression para filtrar relatórios.

2. **normalizeURL()** — Remove prefixo comum entre URLs para gerar URLs relativas.

3. **findReportURL()** — Para relatórios container, usa URL do primeiro filho com URL.

4. **Interactive mode** — Em modo interativo, URLs apontam para `/taskjuggler?project=...;report=...`.

5. **CSS classes** — `navbar_container`, `navbar`, `navbar_current`, `navbar_other`, `navbar_topruler`, `navbar_midruler`, `navbar_bottomruler`.

---

## 🏛️ 6. REPORTBASE.RB — Base de Todos os Relatórios

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base abstrata** | Superclasse de todos os relatórios |
| **Filtros genéricos** | `filterTaskList()`, `filterResourceList()`, `filterAccountList()` |
| **HTML helpers** | `generateHtmlTableFrame()`, `rt_to_html()` |
| **Acesso a atributos** | `a(attribute)` como atalho para `report.get(attribute)` |

### 6.2 Estrutura Interna

```typescript
abstract class ReportBase {
  @report: Report;
  @project: Project;
  
  constructor(report: Report);
  
  a(attribute: string): any;
  abstract generateIntermediateFormat(): void;
  
  filterAccountList(list: PropertyList<Account>, hideExpr: LogicalExpression | null,
                    rollupExpr: LogicalExpression | null, 
                    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Account>;
  
  filterTaskList(list: PropertyList<Task>, resource: Resource | null,
                 hideExpr: LogicalExpression | null,
                 rollupExpr: LogicalExpression | null,
                 openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Task>;
  
  filterResourceList(list: PropertyList<Resource>, task: Task | null,
                     hideExpr: LogicalExpression | null,
                     rollupExpr: LogicalExpression | null,
                     openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Resource>;
}
```

### 6.3 Filtros Genéricos

```typescript
filterTaskList(list_: PropertyList<Task>, resource: Resource | null,
               hideExpr: LogicalExpression | null,
               rollupExpr: LogicalExpression | null,
               openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Task> {
  const list = new PropertyList(list_);
  
  // Remove tasks que não são descendentes de taskroot
  const taskRoot = this.a('taskroot');
  if (taskRoot) {
    list.deleteIf(task => !task.isChildOf(taskRoot));
  }
  
  // Se temos um resource, verifica se está alocado à task
  if (resource) {
    list.deleteIf(task => {
      let delete_ = true;
      for (const scenarioIdx of this.a('scenarios')) {
        const iv = new TimeInterval(this.a('start'), this.a('end'));
        if (task.hasResourceAllocated(scenarioIdx, iv, resource)) {
          delete_ = false;
          break;
        }
      }
      return delete_;
    });
  }
  
  // Aplica filtros padrão
  this.standardFilterOps(list, hideExpr, rollupExpr, openNodes, resource, taskRoot);
  
  return list;
}

filterResourceList(list_: PropertyList<Resource>, task: Task | null,
                   hideExpr: LogicalExpression | null,
                   rollupExpr: LogicalExpression | null,
                   openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Resource> {
  const list = new PropertyList(list_);
  
  // Remove resources que não são descendentes de resourceroot
  const resourceRoot = this.a('resourceroot');
  if (resourceRoot) {
    list.deleteIf(resource => !resource.isChildOf(resourceRoot));
  }
  
  // Se temos uma task, verifica se o resource está alocado
  if (task) {
    const iv = new TimeInterval(this.a('start'), this.a('end'));
    list.deleteIf(resource => {
      let delete_ = true;
      for (const scenarioIdx of this.a('scenarios')) {
        if (task.hasResourceAllocated(scenarioIdx, iv, resource)) {
          delete_ = false;
          break;
        }
      }
      return delete_;
    });
  }
  
  // Aplica filtros padrão
  this.standardFilterOps(list, hideExpr, rollupExpr, openNodes, task, resourceRoot);
  
  return list;
}
```

### 6.4 standardFilterOps() — Filtro Padrão

```typescript
private standardFilterOps(
  list: PropertyList<any>,
  hideExpr: LogicalExpression | null,
  rollupExpr: LogicalExpression | null,
  openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null,
  scopeProperty: PropertyTreeNode | null,
  root: PropertyTreeNode | null
): void {
  // Cria cópia da Query atual
  const query = this.project.reportContexts[this.project.reportContexts.length - 1].query.dup();
  query.scopeProperty = scopeProperty;
  
  // Remove properties que o usuário quer esconder
  if (hideExpr) {
    list.deleteIf(property => {
      query.property = property;
      return hideExpr.eval(query);
    });
  }
  
  // Remove filhos de properties que o usuário fez rollup
  if (rollupExpr || openNodes) {
    list.deleteIf(property => {
      let parent = property.parent;
      let delete_ = false;
      
      while (parent) {
        query.property = parent;
        
        // Se openNodes não é null, apenas os nodes listados serão expandidos
        // Se openNodes é null, apenas os nodes que matcham rollupExpr não serão expandidos
        if ((openNodes && !openNodes.some(([p, sp]) => p === parent && sp === scopeProperty)) ||
            (!openNodes && rollupExpr && rollupExpr.eval(query))) {
          delete_ = true;
          break;
        }
        
        parent = parent.parent;
      }
      
      return delete_;
    });
  }
  
  // Re-adiciona pais em tree mode
  if (list.treeMode()) {
    const parents: PropertyTreeNode[] = [];
    
    for (const property of list) {
      let parent = property;
      while ((parent = parent.parent)) {
        if (!list.includes(parent) && !parents.includes(parent)) {
          parents.push(parent);
        }
        if (parent === root) break;
      }
    }
    
    list.append(parents);
  }
}
```

### 6.5 HTML Helpers

```typescript
protected generateHtmlTableFrame(): XMLElement {
  const table = new XMLElement('table', {
    class: 'tj_table_frame',
    cellspacing: '1'
  });
  
  // Headline box
  if (this.a('headline')) {
    table.append(this.generateHtmlTableRow(() => {
      const td = new XMLElement('td');
      const div = new XMLElement('div', { class: 'tj_table_headline' });
      div.append(this.a('headline').to_html());
      td.append(div);
      return td;
    }));
  }
  
  return table;
}

protected generateHtmlTableRow(content: () => XMLElement): XMLElement {
  return new XMLElement('tr').append(content());
}

protected rt_to_html(name: string): XMLElement | null {
  const text = this.a(name);
  if (!text) return null;
  
  text.sectionNumbers = false;
  return text.to_html();
}
```

### 6.6 Pontos Críticos

1. **Abstract class** — `ReportBase` é abstrata. Subclasses devem implementar `generateIntermediateFormat()`.

2. **Filtros composáveis** — `hideExpr`, `rollupExpr`, `openNodes` podem ser combinados.

3. **Tree mode** — Em tree mode, pais são re-adicionados automaticamente para manter hierarquia.

4. **Query compartilhada** — Usa a Query do contexto atual para avaliar expressões lógicas.

5. **Resource/Task allocation check** — Verifica se resource está alocado à task em qualquer cenário reportado.

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação

```
FASE 15A: Helpers e Contexto
  1. HTMLGraphics.ts (mixin) ⭐
  2. ReportContext.ts ⭐
  3. ReportBase.ts ⭐

FASE 15B: Roteamento e Navegação
  4. CollisionDetector.ts (necessário para GanttRouter)
  5. GanttRouter.ts ⭐
  6. Navigator.ts ⭐

FASE 15C: Integração
  7. Atualizar TableReport.ts para usar ReportBase
  8. Atualizar GanttChart.ts para usar GanttRouter
  9. Atualizar Report.ts para usar ReportContext e Navigator
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 HTMLGraphics como Mixin
```typescript
// Mixin pattern
function HTMLGraphicsMixin<T extends { constructor: Function }>(Base: T) {
  return class extends Base {
    lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement {
      // Implementação
    }
    
    rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement {
      // Implementação
    }
    
    // ... outros métodos
  };
}

// Uso
class GanttTaskBar extends HTMLGraphicsMixin(Object) {
  // Agora tem acesso a lineToHTML, rectToHTML, etc.
}
```

#### 7.2.2 ReportContext com Stack
```typescript
class Project {
  reportContexts: ReportContext[] = [];
  
  get currentReportContext(): ReportContext | null {
    return this.reportContexts[this.reportContexts.length - 1] || null;
  }
  
  pushReportContext(report: Report): void {
    this.reportContexts.push(new ReportContext(this, report));
  }
  
  popReportContext(): void {
    this.reportContexts.pop();
  }
}
```

#### 7.2.3 GanttRouter com CollisionDetector
```typescript
class CollisionDetector {
  private zones: Zone[] = [];
  
  addBlockedZone(x: number, y: number, w: number, h: number, 
                 blockHorizontal: boolean, blockVertical: boolean): void {
    this.zones.push({ x, y, w, h, blockHorizontal, blockVertical });
  }
  
  collision(pos: number, segment: [number, number], horizontal: boolean): boolean {
    // Verifica se pos cruza alguma zona bloqueada
    for (const zone of this.zones) {
      if (horizontal && zone.blockHorizontal) {
        if (pos >= zone.y && pos < zone.y + zone.h) {
          if (segment[1] >= zone.x && segment[0] < zone.x + zone.w) {
            return true;
          }
        }
      } else if (!horizontal && zone.blockVertical) {
        if (pos >= zone.x && pos < zone.x + zone.w) {
          if (segment[1] >= zone.y && segment[0] < zone.y + zone.h) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

class GanttRouter {
  private detector: CollisionDetector;
  
  constructor(width: number, height: number) {
    this.detector = new CollisionDetector();
  }
  
  addZone(x: number, y: number, w: number, h: number, 
          horiz: boolean, vert: boolean): void {
    this.detector.addBlockedZone(x, y, w, h, horiz, vert);
  }
  
  // ... resto da implementação
}
```

#### 7.2.4 ReportBase como Abstract Class
```typescript
abstract class ReportBase {
  protected report: Report;
  protected project: Project;
  
  constructor(report: Report) {
    this.report = report;
    this.project = report.project;
  }
  
  protected a(attribute: string): any {
    return this.report.get(attribute);
  }
  
  abstract generateIntermediateFormat(): void;
  
  protected filterTaskList(
    list: PropertyList<Task>,
    resource: Resource | null,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Task> {
    // Implementação
  }
  
  // ... outros métodos
}

class TaskListRE extends ReportBase {
  generateIntermediateFormat(): void {
    // Implementação específica
  }
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **CollisionDetector não foi anexado** — É essencial para GanttRouter. Precisa ser implementado.

2. **HTMLGraphics é um mixin** — Em TypeScript, usar mixin pattern ou interface.

3. **ReportContext é uma stack** — Sempre usar `project.reportContexts[project.reportContexts.length - 1]` para acessar contexto atual.

4. **Navigator usa URLs relativas** — `normalizeURL()` remove prefixo comum entre URLs.

5. **ReportBase é abstrata** — Subclasses devem implementar `generateIntermediateFormat()`.

6. **Filtros são composáveis** — `hideExpr`, `rollupExpr`, `openNodes` podem ser combinados.

7. **Tree mode re-adiciona pais** — Em tree mode, pais são re-adicionados automaticamente.

8. **Dynamic Report ID** — Formato "0.1.2" indica hierarquia de relatórios aninhados.

9. **Query template** — Todos os relatórios usam a mesma Query template, mas com configurações diferentes.

10. **Backup de atributos** — Permite modificar atributos dinamicamente e restaurar depois.

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (90+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation, TextParser
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes, AttributeBase
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query, SimpleQueryExpander
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition, ReportTableLegend
- [x] **Gantt**: GanttChart, GanttLine, GanttHeader, GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack, GanttRouter ⭐, HTMLGraphics ⭐
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal, MessageHandler, Log
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Utilitários**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy, deep_copy, TernarySearchTree, KateSyntax
- [x] **Fase 15**: GanttRouter, HTMLGraphics, ReportContext ⭐, Navigator ⭐, ReportBase ⭐

### 🔮 Próximos 5 (Fase 16 - Reports Específicos)
- [ ] **AccountListRE.rb** ⭐ — Relatório de contas (balance)
- [ ] **ExportRE.rb** ⭐ — Export em formato TJP
- [ ] **TraceReport.rb** ⭐ — Relatório de trace
- [ ] **ICalReport.rb** ⭐ — Export iCalendar
- [ ] **NikuReport.rb** ⭐ — Integração com Clarity

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. GanttRouter em ação
const router = new GanttChart(1000, 500);
router.addZone(100, 50, 200, 20, true, false);  // Bloqueia horizontal
router.addZone(300, 100, 20, 100, false, true); // Bloqueia vertical

const arrows = router.routeLines([
  [50, 60, 400, 150],   // Setas de dependência
  [100, 80, 350, 200]
]);

// 2. HTMLGraphics em ação
const ganttTaskBar = new GanttTaskBar(query, 20, 100, 300, 50);
const html = ganttTaskBar.to_html();
// Usa rectToHTML(), lineToHTML(), etc. internamente

// 3. ReportContext em ação
const project = new Project('prj', 'My Project', '1.0');
const report = new Report(project, 'r1', 'My Report', null);

project.pushReportContext(report);
const context = project.currentReportContext;
console.log(context.dynamicReportId);  // "0"
console.log(context.query);  // Query com configurações do relatório
project.popReportContext();

// 4. Navigator em ação
const navigator = new Navigator('nav1', project);
navigator.hideReport = new LogicalExpression(new LogicalOperation(0));
const navHtml = navigator.to_html();
// Gera menu HTML com links para todos os relatórios

// 5. ReportBase em ação
class MyReport extends ReportBase {
  generateIntermediateFormat(): void {
    const taskList = this.filterTaskList(
      new PropertyList(this.project.tasks),
      null,
      this.a('hideTask'),
      this.a('rollupTask'),
      this.a('openNodes')
    );
    // ... gera relatório
  }
}
```

---

**Fim da Fase 15.** O sistema de relatórios está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `AccountListRE.rb` → `ExportRE.rb` → `TraceReport.rb` → `ICalReport.rb` → `NikuReport.rb`. 🚀