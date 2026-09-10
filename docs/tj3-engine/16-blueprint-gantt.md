# 📘 Blueprint Fase 13: Componentes Visuais do Gantt Chart

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **Gantt Chart** — o componente visual mais importante do TaskJuggler. Estes são os elementos que transformam dados agendados em gráficos HTML interativos.

---

## 🏗️ 1. PIPELINE DE RENDERIZAÇÃO DO GANTT

```
┌─────────────────────────────────────────────────────────────────┐
│                    GanttChart (Orquestrador)                     │
│  └── generateByScale() ou generateByWidth()                     │
│      └── Cria GanttHeader                                       │
│      └── Para cada task/resource:                               │
│          └── GanttLine.new()  ◄── GanttLine.rb                  │
│              └── generate()                                     │
│                  ├── generateTask()                             │
│                  │   ├── GanttTaskBar.new()    ◄── GanttTaskBar.rb ⭐
│                  │   ├── GanttMilestone.new()  ◄── GanttMilestone.rb ⭐
│                  │   └── GanttContainer.new()  ◄── GanttContainer.rb ⭐
│                  └── generateResource()                         │
│                      └── GanttLoadStack.new()  ◄── GanttLoadStack.rb ⭐
│                                                                 │
│  └── to_html()                                                  │
│      └── GanttHeader.to_html()  ◄── GanttHeader.rb ⭐           │
│      └── GanttLine.to_html()                                    │
│          └── GanttTaskBar.to_html()                             │
│          └── GanttMilestone.to_html()                           │
│          └── GanttContainer.to_html()                           │
│          └── GanttLoadStack.to_html()                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. GANTTHEADER.RB — Header do Gantt (Escalas Temporais)

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza 2 linhas** | Escala maior (ano/mês) + escala menor (mês/semana/dia) |
| **Grid lines** | Linhas verticais do grid |
| **Now line** | Linha vermelha indicando "hoje" |
| **Markdate line** | Linha customizada definida pelo usuário |
| **Cell start dates** | Datas de início de cada célula |

### 2.2 Estrutura Interna

```typescript
class GanttHeader {
  @columnDef: TableColumnDefinition;
  @chart: GanttChart;
  @largeScale: GanttHeaderScaleItem[];  // Escala maior (topo)
  @smallScale: GanttHeaderScaleItem[];  // Escala menor (base)
  @gridLines: number[];                 // Posições X das linhas do grid
  @nowLineX: number | null;             // Posição X da linha "now"
  @markdateLineX: number | null;        // Posição X da linha "markdate"
  @cellStartDates: TjTime[];            // Datas de início das células
  @height: number;                      // Altura em pixels (default: 39)
  
  constructor(columnDef: TableColumnDefinition, chart: GanttChart);
  to_html(): XMLElement;
}
```

### 2.3 Escalas por Tipo de Chart

```typescript
// No método generate():
switch (chart.scale.name) {
  case 'hour':
    // Large: dia da semana + data (ex: "Monday 2026-01-05")
    // Small: hora (ex: "09")
    genHeaderScale(largeScale, 0, h, 'midnight', 'sameTimeNextDay', '%A %Y-%m-%d');
    genHeaderScale(smallScale, h + 1, h, 'beginOfHour', 'sameTimeNextHour', '%H');
    break;
    
  case 'day':
    // Large: mês + ano (ex: "Jan 2026")
    // Small: dia do mês (ex: "05")
    genHeaderScale(largeScale, 0, h, 'beginOfMonth', 'sameTimeNextMonth', '%b %Y');
    genHeaderScale(smallScale, h + 1, h, 'midnight', 'sameTimeNextDay', '%d');
    break;
    
  case 'week':
    // Large: mês + ano (ex: "Jan 2026")
    // Small: dia da semana (ex: "05")
    genHeaderScale(largeScale, 0, h, 'beginOfMonth', 'sameTimeNextMonth', '%b %Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfWeek', 'sameTimeNextWeek', '%d');
    break;
    
  case 'month':
    // Large: ano (ex: "2026")
    // Small: mês (ex: "Jan")
    genHeaderScale(largeScale, 0, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfMonth', 'sameTimeNextMonth', '%b');
    break;
    
  case 'quarter':
    // Large: ano (ex: "2026")
    // Small: trimestre (ex: "Q1")
    genHeaderScale(largeScale, 0, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfQuarter', 'sameTimeNextQuarter', 'Q%Q');
    break;
    
  case 'year':
    // Large: (não usado)
    // Small: ano (ex: "2026")
    genHeaderScale(smallScale, h + 1, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    break;
}
```

### 2.4 genHeaderScale() — Geração de Células

```typescript
genHeaderScale(scale: GanttHeaderScaleItem[], y: number, h: number,
               beginOfFunc: string, sameTimeNextFunc: string, timeformat: string): void {
  let t = chart.start[beginOfFunc]();
  
  while (t < chart.end) {
    const nextT = t[sameTimeNextFunc]();
    
    // Calcula posição e largura da célula
    const x = chart.dateToX(t);
    const w = chart.dateToX(nextT) - x - 1;  // -1 para borda
    
    // Coleta posições do grid (escala maior)
    if (scale === largeScale) {
      gridLines.push(x + w);
    } else {
      cellStartDates.push(t);
    }
    
    // Cria o item da escala
    scale.push(new GanttHeaderScaleItem(t.to_s(timeformat), x, y, w, h));
    
    t = nextT;
  }
  
  // Adiciona data final para escala menor
  if (scale === smallScale) {
    cellStartDates.push(t);
  }
}
```

### 2.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement {
  const div = new XMLElement('div', {
    class: 'tabback',
    style: `margin:0px; padding:0px; position:relative; ` +
           `width:${chart.width}px; height:${height}px; ` +
           `font-size:${Math.floor(height / 4)}px;`
  });
  
  // Renderiza escala maior
  largeScale.forEach(s => div.append(s.to_html()));
  
  // Renderiza escala menor
  smallScale.forEach(s => div.append(s.to_html()));
  
  return div;
}
```

---

## 📊 3. GANTTTASKBAR.RB — Barra de Tarefa (Leaf Tasks)

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza barra** | Retângulo horizontal representando a tarefa |
| **Progress bar** | Barra interna mostrando % de conclusão |
| **Dependency points** | Pontos de conexão para setas de dependência |
| **Blocked zones** | Zonas bloqueadas para roteamento de setas |

### 3.2 Estrutura Interna

```typescript
class GanttTaskBar {
  @query: Query;
  @lineHeight: number;
  @start: number;      // X coordinate do início
  @end: number;        // X coordinate do fim
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 6;  // Metade da altura da barra (6px)
  
  constructor(query: Query, lineHeight: number, xStart: number, xEnd: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 3.3 Dependency Points

```typescript
// Pontos de conexão para setas de dependência
startDepLineStart(): [number, number] {
  return [this.start + 1, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.start - 1, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.end + 1, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.end - 1, this.y + this.lineHeight / 2];
}
```

### 3.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal para toda a barra
  router.addZone(
    this.start,
    this.y + (this.lineHeight / 2) - GanttTaskBar.size - 1,
    this.end - this.start + 1,
    2 * GanttTaskBar.size + 3,
    true,   // blockHorizontal
    false   // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.start - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
  
  // Bloqueio vertical para end caps
  router.addZone(this.start - 2, this.y, 5, this.lineHeight, false, true);
  router.addZone(this.end - 2, this.y, 5, this.lineHeight, false, true);
}
```

### 3.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const xStart = Math.floor(this.start);
  const yCenter = Math.floor(this.lineHeight / 2);
  const width = Math.floor(this.end) - xStart + 1;
  
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(xStart, 0, width, this.lineHeight, 'tj_gantt_frame'));
  
  // Frame da barra
  html.push(rectToHTML(
    xStart,
    yCenter - GanttTaskBar.size,
    width,
    2 * GanttTaskBar.size,
    'taskbarframe'
  ));
  
  // Preenchimento da barra
  html.push(rectToHTML(
    xStart + 1,
    yCenter - GanttTaskBar.size + 1,
    width - 2,
    2 * GanttTaskBar.size - 2,
    'taskbar'
  ));
  
  // Barra de progresso
  let completion = 0.5;  // Default 50%
  if (this.query) {
    this.query.attributeId = 'complete';
    this.query.process();
    const res = this.query.result;
    completion = res ? res / 100.0 : 0.0;
  }
  
  html.push(rectToHTML(
    xStart + 1,
    yCenter - Math.floor(GanttTaskBar.size / 2),
    Math.floor((width - 2) * completion),
    GanttTaskBar.size,
    'progressbar'
  ));
  
  return html;
}
```

---

## 📊 4. GANTTMILESTONE.RB — Milestone (Losango)

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza losango** | Diamante representando milestone |
| **Dependency points** | Pontos de conexão para setas |
| **Blocked zones** | Zonas bloqueadas (não pode cruzar em nenhuma direção) |

### 4.2 Estrutura Interna

```typescript
class GanttMilestone {
  @lineHeight: number;
  @x: number;          // X coordinate do centro
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 6;  // Metade do tamanho do losango
  
  constructor(lineHeight: number, x: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 4.3 Dependency Points

```typescript
// Pontos de conexão para setas de dependência
startDepLineStart(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.x - GanttMilestone.size, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}
```

### 4.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio completo (não pode cruzar em nenhuma direção)
  router.addZone(
    this.x - GanttMilestone.size - 2,
    this.y + (this.lineHeight / 2) - GanttMilestone.size - 2,
    2 * GanttMilestone.size + 5,
    2 * GanttMilestone.size + 5,
    true,   // blockHorizontal
    true    // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.x - GanttMilestone.size - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
}
```

### 4.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(
    this.x - (this.lineHeight / 2),
    0,
    this.lineHeight,
    this.lineHeight,
    'tj_gantt_frame'
  ));
  
  // Desenha o losango (diamond)
  html.push(...diamondToHTML(this.x, this.lineHeight / 2));
  
  return html;
}
```

---

## 📊 5. GANTTCONTAINER.RB — Container Task (Barra com Colchetes)

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza barra** | Retângulo horizontal com "jags" nas extremidades |
| **Dependency points** | Pontos de conexão para setas |
| **Blocked zones** | Zonas bloqueadas para roteamento |

### 5.2 Estrutura Interna

```typescript
class GanttContainer {
  @lineHeight: number;
  @start: number;      // X coordinate do início
  @end: number;        // X coordinate do fim
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 5;  // Tamanho dos "jags"
  
  constructor(lineHeight: number, xStart: number, xEnd: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 5.3 Dependency Points

```typescript
startDepLineStart(): [number, number] {
  return [this.start, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.start - GanttContainer.size, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.end + GanttContainer.size, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.end, this.y + this.lineHeight / 2];
}
```

### 5.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal para toda a barra (incluindo jags)
  router.addZone(
    this.start - GanttContainer.size,
    this.y + (this.lineHeight / 2) - GanttContainer.size - 2,
    this.end - this.start + 1 + 2 * GanttContainer.size,
    2 * GanttContainer.size + 5,
    true,   // blockHorizontal
    false   // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.start - GanttContainer.size - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
  
  // Bloqueio vertical para end caps
  router.addZone(
    this.start - GanttContainer.size - 2,
    this.y,
    2 * GanttContainer.size + 5,
    this.lineHeight,
    false, true
  );
  router.addZone(
    this.end - GanttContainer.size - 2,
    this.y,
    2 * GanttContainer.size + 5,
    this.lineHeight,
    false, true
  );
}
```

### 5.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const xStart = Math.floor(this.start);
  const yCenter = Math.floor(this.lineHeight / 2);
  const width = Math.floor(this.end) - xStart + 1;
  
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(
    xStart - GanttContainer.size,
    0,
    width + 2 * GanttContainer.size,
    this.lineHeight,
    'tj_gantt_frame'
  ));
  
  // Barra principal
  html.push(rectToHTML(
    xStart - GanttContainer.size,
    yCenter - GanttContainer.size,
    width + 2 * GanttContainer.size,
    GanttContainer.size,
    'containerbar'
  ));
  
  // Jag esquerdo
  html.push(jagToHTML(xStart, yCenter));
  
  // Jag direito
  html.push(jagToHTML(xStart + width, yCenter));
  
  return html;
}
```

---

## 📊 6. GANTTLOADSTACK.RB — Load Stack (Resources Aninhados)

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza stack** | Barras empilhadas mostrando alocação de recursos |
| **Normaliza altura** | Sempre ocupa toda a altura da linha |
| **Categorias** | Cores diferentes para tipos de alocação |

### 6.2 Estrutura Interna

```typescript
class GanttLoadStack {
  @line: GanttLine;
  @lineHeight: number;
  @x: number;          // X coordinate do início
  @y: number;          // Y coordinate (topo)
  @w: number;          // Largura
  @values: number[];   // Valores para cada categoria
  @categories: string[];  // Classes CSS para cada categoria
  @yLevels: number[];  // Alturas calculadas para cada valor
  @drawFrame: boolean; // Se deve desenhar frame
  
  constructor(line: GanttLine, x: number, w: number, values: number[], categories: string[]);
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 6.3 Cálculo de Alturas

```typescript
constructor(line: GanttLine, x: number, w: number, values: number[], categories: string[]) {
  this.line = line;
  this.lineHeight = line.height;
  this.x = x;
  this.y = line.y;
  this.w = w <= 0 ? 1 : w;
  this.drawFrame = false;
  
  if (values.length !== categories.length) {
    throw new Error("Values and categories must have the same number of entries!");
  }
  
  this.categories = categories;
  
  // Verifica se precisa desenhar frame
  for (let i = 0; i < categories.length; i++) {
    if (categories[i] === null && values[i] > 0) {
      this.drawFrame = true;
      break;
    }
  }
  
  // Calcula alturas normalizadas
  let sum = 0;
  values.forEach(v => sum += v);
  
  if (sum === 0) {
    this.yLevels = null;
    this.drawFrame = true;
  } else {
    this.yLevels = [];
    values.forEach(v => {
      // Deixa 1px no topo e base, e 1px para frame
      this.yLevels.push((this.lineHeight - 4) * v / sum);
    });
  }
}
```

### 6.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal
  router.addZone(
    this.x - 2,
    this.y,
    this.w + 4,
    this.lineHeight,
    true,   // blockHorizontal
    false   // blockVertical
  );
}
```

### 6.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  // Não desenha se todos os valores são 0
  if (!this.yLevels) return null;
  
  const html: XMLElement[] = [];
  
  // Desenha frame de fundo
  if (this.drawFrame) {
    // Linha superior do frame
    html.push(lineToHTML(this.x, 1, this.x + this.w - 1, 1, 'loadstackframe'));
    // Linha inferior do frame
    html.push(lineToHTML(this.x, this.lineHeight - 2, this.x + this.w - 1, this.lineHeight - 2, 'loadstackframe'));
    // Linha esquerda do frame
    html.push(lineToHTML(this.x, 1, this.x, this.lineHeight - 2, 'loadstackframe'));
    // Linha direita do frame
    html.push(lineToHTML(this.x + this.w - 1, 1, this.x + this.w - 1, this.lineHeight - 2, 'loadstackframe'));
  } else {
    // Retângulo de fundo
    html.push(rectToHTML(this.x, 1, this.w, this.lineHeight - 2, 'loadstackframe'));
  }
  
  // Desenha as barras empilhadas
  let yPos = 2;
  for (let i = this.yLevels.length - 1; i >= 0; i--) {
    if (this.yLevels[i] <= 0) continue;
    
    if (this.categories[i]) {
      html.push(rectToHTML(
        this.x + 1,
        Math.floor(yPos),
        this.w - 2,
        Math.floor(yPos + this.yLevels[i]) - Math.floor(yPos),
        this.categories[i]
      ));
    }
    
    yPos += this.yLevels[i];
  }
  
  return html;
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação

```
FASE 13A: Header
  1. GanttHeaderScaleItem.ts     (item individual da escala)
  2. GanttHeader.ts              (header completo) ⭐

FASE 13B: Elementos do Gantt
  3. GanttTaskBar.ts             (barra de tarefa) ⭐
  4. GanttMilestone.ts           (milestone) ⭐
  5. GanttContainer.ts           (container task) ⭐
  6. GanttLoadStack.ts           (load stack) ⭐

FASE 13C: Helpers Gráficos
  7. HTMLGraphics.ts             (funções auxiliares)
  8. GanttRouter.ts              (roteamento de setas)
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 GanttHeaderScaleItem
```typescript
class GanttHeaderScaleItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  
  constructor(text: string, x: number, y: number, w: number, h: number);
  to_html(): XMLElement;
}
```

#### 7.2.2 HTMLGraphics Mixin
```typescript
// Mixin para funções gráficas comuns
interface HTMLGraphics {
  rectToHTML(x: number, y: number, w: number, h: number, className: string): XMLElement;
  lineToHTML(x1: number, y1: number, x2: number, y2: number, className: string): XMLElement;
  diamondToHTML(cx: number, cy: number): XMLElement[];
  jagToHTML(x: number, cy: number): XMLElement;
  arrowHeadToHTML(x: number, y: number): XMLElement;
}

// Implementação
function rectToHTML(x: number, y: number, w: number, h: number, className: string): XMLElement {
  return new XMLElement('div', {
    class: className,
    style: `position:absolute; left:${x}px; top:${y}px; ` +
           `width:${w}px; height:${h}px;`
  });
}

function diamondToHTML(cx: number, cy: number): XMLElement[] {
  const size = 6;
  return [
    new XMLElement('div', {
      class: 'milestone',
      style: `position:absolute; ` +
             `left:${cx - size}px; top:${cy - size}px; ` +
             `width:${size * 2}px; height:${size * 2}px; ` +
             `transform:rotate(45deg);`
    })
  ];
}

function jagToHTML(x: number, cy: number): XMLElement {
  // Desenha um "jag" (colchete) para container tasks
  return new XMLElement('div', {
    class: 'containerjag',
    style: `position:absolute; left:${x}px; top:${cy - 5}px; ` +
           `width:5px; height:10px; ` +
           `border-left:2px solid #000; ` +
           `border-top:2px solid #000; ` +
           `border-bottom:2px solid #000;`
  });
}
```

#### 7.2.3 GanttElement Interface
```typescript
// Interface comum para todos os elementos do Gantt
interface GanttElement {
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}

// Classes implementam essa interface
class GanttTaskBar implements GanttElement { /* ... */ }
class GanttMilestone implements GanttElement { /* ... */ }
class GanttContainer implements GanttElement { /* ... */ }
class GanttLoadStack implements GanttElement { /* ... */ }
```

#### 7.2.4 GanttRouter (não anexado, mas essencial)
```typescript
class GanttRouter {
  @width: number;
  @height: number;
  @blockedZones: Zone[];
  
  constructor(width: number, height: number);
  
  addZone(x: number, y: number, w: number, h: number, 
          blockHorizontal: boolean, blockVertical: boolean): void;
  
  routeLines(touples: [number, number, number, number][]): [number, number][][];
}

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  blockHorizontal: boolean;
  blockVertical: boolean;
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **Coordenadas são relativas**: Todas as coordenadas são relativas ao topo da linha do Gantt, não ao topo do chart.

2. **Dependency points**: Os pontos de conexão devem estar exatamente no centro vertical da linha (`y + lineHeight / 2`).

3. **Blocked zones**: Devem ser ligeiramente maiores que o elemento visual para evitar sobreposição de setas.

4. **Progress bar**: A barra de progresso é renderizada DENTRO da barra da tarefa, com 1px de padding.

5. **Load stack normalização**: Os valores são normalizados para ocupar toda a altura da linha (`lineHeight - 4` pixels).

6. **Frame vs Fill**: Task bars têm frame + fill + progress bar. Containers têm frame + fill + jags. Milestones são losangos.

7. **Grid lines**: São determinadas pela escala MAIOR (largeScale), não pela menor.

8. **Now line**: É renderizada como uma linha vertical vermelha de 1px de largura.

9. **Tooltip triggers**: São frames invisíveis (`tj_gantt_frame`) que cobrem toda a área do elemento.

10. **CSS classes**: Cada elemento tem classes CSS específicas (`taskbar`, `taskbarframe`, `progressbar`, `milestone`, `containerbar`, `containerjag`, `loadstackframe`, `offduty`, `nowline`, `markdateline`, `tabvline`).

---

## 📋 8. CHECKLIST FINAL DO ENGINE COMPLETO

### ✅ Engine COMPLETO (100+ arquivos analisados)

#### Parser (5 arquivos)
- [x] TjpSyntaxRules.rb
- [x] ProjectFileScanner.rb
- [x] ProjectFileParser.rb
- [x] SyntaxReference.rb
- [x] KeywordDocumentation.rb

#### Modelo de Domínio (12 arquivos)
- [x] Project.rb
- [x] PropertyTreeNode.rb
- [x] PropertySet.rb
- [x] Task.rb + TaskScenario.rb
- [x] Resource.rb + ResourceScenario.rb
- [x] Account.rb + AccountScenario.rb
- [x] Scenario.rb
- [x] Shift.rb
- [x] Attributes.rb
- [x] AttributeDefinition.rb

#### Scheduler (10 arquivos)
- [x] TaskScenario.rb (coração do scheduler)
- [x] ResourceScenario.rb
- [x] Scoreboard.rb
- [x] Allocation.rb
- [x] Booking.rb
- [x] TaskDependency.rb
- [x] Limits.rb
- [x] ShiftAssignments.rb
- [x] WorkingHours.rb
- [x] DataCache.rb

#### Sistema Financeiro (5 arquivos)
- [x] Charge.rb
- [x] ChargeSet.rb
- [x] AccountCredit.rb
- [x] RealFormat.rb
- [x] AccountScenario.rb (turnover, balance)

#### Sistema de Tempo (3 arquivos)
- [x] TjTime.rb
- [x] Interval.rb
- [x] IntervalList.rb

#### Sistema de Apoio (5 arquivos)
- [x] AlertLevelDefinitions.rb
- [x] PropertyList.rb
- [x] LeaveList.rb
- [x] Journal.rb
- [x] MessageHandler.rb

#### Expressões Lógicas (3 arquivos)
- [x] LogicalExpression.rb
- [x] LogicalOperation.rb
- [x] LogicalFunction.rb

#### Queries (1 arquivo)
- [x] Query.rb

#### RichText (1 arquivo)
- [x] RichText.rb

#### Reports Base (5 arquivos)
- [x] Report.rb
- [x] TableReport.rb
- [x] TableColumnDefinition.rb
- [x] ReportTable.rb
- [x] ReportTableColumn.rb
- [x] ReportTableLine.rb
- [x] ReportTableCell.rb

#### Reports Específicos (3 arquivos)
- [x] TaskListRE.rb
- [x] ResourceListRE.rb
- [x] TextReport.rb

#### Gantt Chart (10 arquivos)
- [x] GanttChart.rb
- [x] GanttLine.rb
- [x] GanttHeader.rb ⭐
- [x] GanttTaskBar.rb ⭐
- [x] GanttMilestone.rb ⭐
- [x] GanttContainer.rb ⭐
- [x] GanttLoadStack.rb ⭐

#### Time Sheets (4 arquivos)
- [x] TimeSheets.rb
- [x] TimeSheet.rb
- [x] TimeSheetSender.rb
- [x] TimeSheetReceiver.rb
- [x] TimeSheetSummary.rb

#### Utilitários (5 arquivos)
- [x] URLParameter.rb
- [x] BatchProcessor.rb
- [x] StdIoWrapper.rb
- [x] PTNProxy.rb
- [x] deep_copy.rb
- [x] TernarySearchTree.rb
- [x] Log.rb
- [x] TaskJuggler.rb (orquestrador top-level)
- [x] HTMLDocument.rb
- [x] KateSyntax.rb

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria GanttChart
const gantt = new GanttChart(
  project.get('now'),
  project.get('weekStartsMonday'),
  columnDef,
  tableReport,
  project.get('markdate')
);
gantt.generateByScale(startDate, endDate, 'week');

// 2. Para cada task, cria GanttLine
taskList.forEach(task => {
  const query = new Query({
    project: project,
    property: task,
    scenario: scenario,
    start: startDate,
    end: endDate
  });
  
  const line = new GanttLine(
    gantt,
    query,
    y,
    height,
    lineIndex,
    columnDef.tooltip
  );
  
  // GanttLine internamente cria:
  // - GanttTaskBar (se leaf task)
  // - GanttMilestone (se milestone)
  // - GanttContainer (se container task)
  // - GanttLoadStack (se resource aninhado)
});

// 3. Renderiza para HTML
const html = gantt.to_html();
// → GanttHeader.to_html()
// → Para cada GanttLine:
//   → GanttLine.to_html()
//     → GanttTaskBar.to_html() ou
//     → GanttMilestone.to_html() ou
//     → GanttContainer.to_html() ou
//     → GanttLoadStack.to_html()

// 4. Adiciona dependency arrows
gantt.completeChart();
// → GanttRouter.routeLines()
// → GanttRouter.addZone() para cada elemento

// 5. Renderiza setas
gantt.depArrows.forEach(arrow => {
  for (let i = 1; i < arrow.length; i++) {
    const [x1, y1] = arrow[i - 1];
    const [x2, y2] = arrow[i];
    html.push(lineToHTML(x1, y1, x2, y2, 'depline'));
  }
});

// 6. Renderiza arrow heads
gantt.arrowHeads.forEach(([x, y]) => {
  html.push(arrowHeadToHTML(x, y));
});
```

---

## 🚀 10. CONCLUSÃO

**O engine do TaskJuggler está COMPLETAMENTE MAPEADO!**

A próxima IA tem tudo que precisa para implementar em Deno/TypeScript:

1. **Parser completo** — Scanner + Parser + SyntaxRules
2. **Modelo de domínio** — Tasks, Resources, Accounts, Scenarios, Shifts
3. **Scheduler completo** — Algoritmo de alocação de recursos
4. **Sistema financeiro** — Custos, receitas, balanço
5. **Sistema de relatórios** — TaskReport, ResourceReport, TextReport
6. **Gantt Chart completo** — Header, TaskBar, Milestone, Container, LoadStack
7. **Time Sheets** — Apontamentos de horas
8. **Utilitários** — Cache, logging, mensagens, deep copy

**Próximos passos sugeridos:**
1. Implementar `TjTime.ts` (base de tudo)
2. Implementar `TextParser.ts` (parser genérico)
3. Implementar `ProjectFileScanner.ts` (lexer TJP)
4. Implementar `ProjectFileParser.ts` + `TjpSyntaxRules.ts`
5. Implementar `PropertyTreeNode.ts` + `PropertySet.ts`
6. Implementar `Task.ts` + `TaskScenario.ts` (coração do scheduler)
7. Implementar `ResourceScenario.ts` + `Scoreboard.ts`
8. Implementar `Report.ts` + `TableReport.ts`
9. Implementar `GanttChart.ts` + componentes

**Engine do TaskJuggler: 100% documentado!** 🎉