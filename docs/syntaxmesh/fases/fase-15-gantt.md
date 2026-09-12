# Fase 15 — Gantt

> **Arquivo:** `docs/syntaxmesh/fases/fase-15-gantt.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 12–15 dias
> **Depende de:** Fases 2, 4, 5, 7, 11, 14
> **Bloqueia:** Fases 14 (reports com chart column), 20, 21

---

## 1. Contexto

O Gantt chart do TaskJuggler é um dos componentes mais icônicos do software. É ele que dá "vida visual" aos cronogramas, mostrando barras de tarefas, milestones, containers e setas de dependência.

**Fato crítico:** o Gantt chart do TaskJuggler **NÃO é SVG**. É **HTML + CSS puro**. Cada elemento visual é um `<div>` com `position: absolute`. Isso simplifica a renderização (funciona em qualquer browser) e a interação (eventos nativos).

### Componentes

1. **`GanttChart`** — orquestrador. Renderiza o chart completo com header, linhas, barras e setas.
2. **`GanttHeader`** — header com escalas temporais (2 linhas: ano/mês + dia/semana).
3. **`GanttHeaderScaleItem`** — item individual de escala (`<div>` com texto).
4. **`GanttLine`** — linha do chart. Contém 1+ elementos visuais (task bar, milestone, container, load stack).
5. **`GanttTaskBar`** — barra de tarefa leaf.
6. **`GanttMilestone`** — losango para milestones.
7. **`GanttContainer`** — barra com jags para container tasks.
8. **`GanttLoadStack`** — pilha de alocação de recursos (para nested resources).
9. **`GanttRouter`** — roteia setas de dependência (ortogonais) evitando task bars.
10. **`CollisionDetector`** — detecta colisões entre setas e zonas bloqueadas.
11. **`HTMLGraphics`** — helpers para desenhar linhas, retângulos, jags, diamantes, arrow heads.

### Integração com TableReport

O Gantt chart é **uma coluna** de `TableReport` (Fase 14). O `columnDef.id === 'chart'` aciona a geração. A coluna tem `ReportTableColumn` com `cell1.special = ganttChart`.

### Fluxo

```
TaskReport.generateIntermediateFormat()
    ↓
TableReport.generateHeaderCell(columnDef)  // se id === 'chart'
    ↓
new GanttChart(now, weekStartsMonday, columnDef, table, markdate)
    ↓ generateByScale(start, end, scale)
    ↓ column.cell1.special = ganttChart
    ↓
Para cada task: TableReport.generateTableCell → GanttLine.new(ganttChart, query, ...)
    ↓
GanttChart.to_html()
    ↓ completeChart()
    ↓ ganttHeader.to_html()
    ↓ cada ganttLine.to_html()
    ↓ dependency arrows (via GanttRouter)
```

### Escalas

6 escalas disponíveis:
| Nome | stepSize | Função | minTimeOff |
|---|---|---|---|
| `hour` | 20px | `hoursTo` | 5 min |
| `day` | 20px | `daysTo` | 6h |
| `week` | 20px | `weeksTo` | 1 dia |
| `month` | 35px | `monthsTo` | 5 dias |
| `quarter` | 28px | `quartersTo` | -1 (sempre mostra) |
| `year` | 20px | `yearsTo` | -1 (sempre mostra) |

### Dependências ortogonais

`GanttRouter` implementa roteamento **ortogonal** (apenas horizontais e verticais). Algoritmo:
1. Ordena setas por ângulo.
2. Para cada seta, tenta rota direta (2 pontos).
3. Se falha, rota complexa (4 pontos) com desvio.
4. Bloqueia zonas (task bars, milestones, now line).

### Scrollbar

Se `viewWidth < chart.width`, adiciona scrollbar horizontal (`SCROLLBARHEIGHT = 20px`).

---

## 2. Objetivo

Ao final desta fase:

- `HTMLGraphics` (helpers de `<div>`).
- `CollisionDetector` (zonas bloqueadas).
- `GanttRouter` (roteamento ortogonal de setas).
- `GanttHeader` + `GanttHeaderScaleItem`.
- `GanttLine`.
- `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`.
- `GanttChart` (orquestrador).
- Integração completa com `TaskReport` e `ResourceReport` (via `columnDef.id === 'chart'`).
- Suporte a `rollupTask`, `milestone`, `container`, `load stack` (nested resources).
- Setas de dependência ortogonais.
- Now line e markdate line.
- Time-off zones (férias/feriados).
- **≥ 200 testes unitários** + **≥ 30 golden tests** (Gantt dos MWEs).
- ADR 026 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/reports/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `GanttChart.rb` | ~330 | **Alta** | **Crítica** |
| `GanttHeader.rb` | ~180 | Média | **Crítica** |
| `GanttHeaderScaleItem.rb` | ~30 | Trivial | **Crítica** |
| `GanttLine.rb` | ~350 | **Alta** | **Crítica** |
| `GanttTaskBar.rb` | ~120 | Média | **Crítica** |
| `GanttMilestone.rb` | ~90 | Baixa | **Crítica** |
| `GanttContainer.rb` | ~100 | Média | **Crítica** |
| `GanttLoadStack.rb` | ~120 | Média | **Crítica** |
| `GanttRouter.rb` | ~230 | **Altíssima** | **Crítica** |
| `CollisionDetector.rb` | ~180 | **Alta** | **Crítica** |
| `HTMLGraphics.rb` | ~110 | Baixa | **Crítica** |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/16-blueprint-gantt.md` | Tudo | **Blueprint completo** |
| `docs/tj3-engine/09-blueprint-engine8.md` | §6-7 Gantt components | Estrutura |
| `docs/tj3-engine/14-blueprint-others.md` | §2 GanttRouter | Roteamento |

### 3.3 Casos de teste

- `docs/Learning/mwe001-009/` — 9 MWEs com Gantt.
- `docs/taskjuggler/test/TestSuite/Reports/` — casos com `chart`.

### 3.4 Golden tests

Scripts Ruby que rodam `tj3` em MWEs, extraem HTML do chart e serializam. Teste TS compara posições e dependências.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 HTML + CSS puro, não SVG

Decisão do TaskJuggler, manter em TS. Cada elemento é `<div>` com `position: absolute`.

**Vantagens:**
- Sem dependência de SVG.
- CSS nativo para cores, fontes.
- Eventos nativos (`onclick` para tooltips).
- Simples de testar (comparar strings HTML).

**Desvantagens:**
- Muitos `<div>` podem pesar em charts grandes.
- Sem anti-aliasing.

### 4.2 Coordenadas em pixels inteiros

Todas as coordenadas arredondadas com `Math.round()` ou `to_i`. Evita subpixel rendering.

### 4.3 `GanttChart.dateToX(date)` — interpolação linear

```ruby
def dateToX(date)
  ((@width / (@end - @start)) * (date - @start)).to_i
end
```

TS: idêntico.

### 4.4 `GanttRouter` — algoritmo greedy ordenado

Não é A*. É um algoritmo greedy:
1. Ordena setas por ângulo (menor para maior, distância como desempate).
2. Para cada seta:
   - Tenta rota direta: X intermediário + 2 vértices (start → X,startY → X,endY → end).
   - Senão, rota complexa: X1 + Y + X2 (4 vértices).
3. Adiciona zona bloqueada a cada segmento.

**Replicar fielmente.**

### 4.5 `CollisionDetector` — array de segmentos por linha

`@hLines[y]` = lista de segmentos horizontais bloqueados em `y`.
`@vLines[x]` = lista de segmentos verticais bloqueados em `x`.

`collision?(pos, segment, horizontal)` usa **binary search**.

Replicar.

### 4.6 `GanttHeader.genHeaderScale` — 2 níveis

Duas escalas:
- **Large scale** (topo): ano, mês.
- **Small scale** (base): dia, semana.

Cada uma é uma lista de `GanttHeaderScaleItem`.

### 4.7 `GanttLine` — depende de `scopeProperty`

Se `scopeProperty` é null (linha primária):
- Task → `GanttTaskBar` / `GanttMilestone` / `GanttContainer`.
- Resource → `GanttLoadStack` (alocação vs disponível).

Se `scopeProperty` não é null (nested):
- Task dentro de resource → `GanttLoadStack` (task work vs overall work).
- Resource dentro de task → `GanttLoadStack` (task work vs other vs free).

### 4.8 Time-off zones

`@timeOffZones` = intervalos onde o recurso está de férias/feriado. Renderizadas como `<div class="offduty">`.

`GanttChart.scale['minTimeOff']` determina o mínimo para mostrar.

### 4.9 Now line e markdate line

- **Now line**: linha vertical vermelha em `@chart.now`.
- **Markdate line**: linha vertical customizada em `@chart.markdate` (se definido).

Renderizadas em cada `GanttLine.to_html()`.

### 4.10 Grid lines

Linhas verticais na escala maior. Renderizadas em cada linha.

### 4.11 Scrollbar

`hasScrollbar?() = viewWidth !== null && viewWidth < width`.

Quando true:
- `div` externo com `overflow: auto`, `width: viewWidth`.
- `div` interno com `width: width`, `position: absolute`.
- `ReportTable` gera linha extra para scrollbar.

### 4.12 `complete` nas task bars

`GanttTaskBar` consulta `task.get('complete', scIdx)` para a barra de progresso. Se null, usa 0.5 (50%).

### 4.13 Tooltips

`addHtmlTooltip` adiciona `onclick="TagToTip(...)"` + `<div>` hidden. Requer `wz_tooltip.js` (Fase 20 carrega).

### 4.14 `HTMLGraphics` — módulo de helpers

Em Ruby é `module HTMLGraphics`. TS: **funções soltas** exportadas de `html-graphics.ts`.

### 4.15 `Line.to_i` em coordenadas

Ruby: `@start.to_i`. TS: `Math.floor(x)`.

### 4.16 `GanttChart.completeChart()` — lazy

Só é chamado em `to_html()`. Faz:
1. Calcula `@height`.
2. Cria `GanttRouter`.
3. Adiciona zonas bloqueadas (task bars, milestones, now line, markdate).
4. Gera setas de dependência.
5. Deduplica arrow heads.

**Não chamar antes.**

### 4.17 `Painter` não é usado

`GanttChart` é HTML puro. `Painter` (Fase 14/17) é para `ChartPlotter`, não Gantt.

### 4.18 Browser: sem `wz_tooltip.js`

Tooltips funcionam via CSS `:hover` ou `TagToTip` (JS externo). **Nesta fase**, gerar o HTML do tooltip mas sem o comportamento interativo. Fase 20 carrega o script.

### 4.19 Erros

`GanttRouter.route` **pode lançar** `Error("Routing failed")` se não encontrar rota. Aceitar como warning e pular a seta.

### 4.20 `dependency arrows` — 4 pontos de conexão

Cada `GanttContent` (TaskBar, Milestone, Container) expõe 4 pontos:
- `startDepLineStart` — onde setas que chegam no start começam.
- `startDepLineEnd` — onde setas que chegam no start terminam.
- `endDepLineStart` — onde setas que saem do end começam.
- `endDepLineEnd` — onde setas que saem do end terminam.

Replicar.

---

## 5. Subfases detalhadas

**Bloco A — Utilitários** (19.0–19.3)
**Bloco B — Content** (19.4–19.7)
**Bloco C — Header** (19.8–19.9)
**Bloco D — Line** (19.10)
**Bloco E — Chart** (19.11)
**Bloco F — Integração** (19.12)
**Bloco G — Golden tests** (19.13)

---

### Bloco A — Utilitários

---

### 15.0 — ADR 026 (Gantt HTML+CSS)

#### Contexto

O Gantt chart do TaskJuggler é HTML + CSS puro. Nada de SVG ou Canvas. Precisamos registrar essa decisão e suas consequências.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/026-gantt-html-css.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/026-gantt-html-css.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** HTML+CSS vs SVG vs Canvas.
- [ ] **Decisão:** manter HTML+CSS (fidelidade ao TJ).
- [ ] **Alternativas:** SVG (via Painter), Canvas.
- [ ] **Consequências:**
  - **Positivas:** sem dependências, interativo, testável.
  - **Negativas:** muitos `<div>` em charts grandes; sem anti-aliasing.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb`.
- `docs/tj3-engine/16-blueprint-gantt.md`.

#### Critério de aceite

- ADR 026 criado.
- Tabela atualizada.

---

### 15.1 — `HTMLGraphics`

#### Contexto

Helpers para gerar `<div>` com `position: absolute`. Usado por todos os `GanttContent` e `GanttLine`.

#### Objetivo

Implementar as 5 funções.

#### Arquivos

- `packages/report/src/gantt/html-graphics.ts`
- `packages/report/tests/gantt/html-graphics_test.ts`

#### Requisitos

- [ ] `lineToHTML(xs, ys, xe, ye, category): XMLElementLike`:
  - Se `ys === ye`: horizontal (troca se necessário).
  - Se `xs === xe`: vertical.
  - Senão, `throw Error('diagonal line')`.
  - `<div class="category" style="left:..;top:..;width:..;height:1px;">`.
- [ ] `rectToHTML(x, y, w, h, category): XMLElementLike`.
- [ ] `jagToHTML(x, y): XMLElementLike`:
  - `<div class="tj_gantt_jag" style="left:x-5px; top:y;">`.
- [ ] `diamondToHTML(x, y): XMLElementLike[]`:
  - `tj_diamond_top` + `tj_diamond_bottom`.
- [ ] `arrowHeadToHTML(x, y): XMLElementLike`:
  - `<div class="tj_arrow_head" style="left:x-5px; top:y-5px;">`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/HTMLGraphics.rb`.

#### Critério de aceite

```ts
const div = lineToHTML(10, 20, 50, 20, 'foo');
// <div class="foo" style="left:10px; top:20px; width:41px; height:1px;"></div>
```

#### Testes

- `html-graphics_test.ts`:
  - `it("horizontal line")`.
  - `it("vertical line")`.
  - `it("diagonal lança")`.
  - `it("rect")`.
  - `it("jag")`.
  - `it("diamond 2 divs")`.
  - `it("arrow head")`.

---

### 15.2 — `CollisionDetector`

#### Contexto

Detecta se um segmento (horizontal ou vertical) colide com uma zona bloqueada.

#### Objetivo

Implementar `CollisionDetector`.

#### Arquivos

- `packages/report/src/gantt/collision-detector.ts`
- `packages/report/tests/gantt/collision-detector_test.ts`

#### Requisitos

- [ ] `class CollisionDetector`:
  - `private width: number`
  - `private height: number`
  - `private hLines: number[][][]` — por `y`, lista de `[start, end]`.
  - `private vLines: number[][][]` — por `x`, lista de `[start, end]`.
- [ ] Constructor `(width, height)`.
- [ ] `addBlockedZone(x, y, w, h, horiz, vert): void`:
  - Clip para `[0, width-1]`, `[0, height-1]`.
  - Se `horiz`: para cada linha de `y` a `y+h-1`, `addSegment(hLines[i], [x, x+w-1])`.
  - Se `vert`: para cada coluna de `x` a `x+w-1`, `addSegment(vLines[i], [y, y+h-1])`.
- [ ] `collision?(pos, segment, horizontal): boolean`:
  - `line = horizontal ? hLines[pos] : vLines[pos]`.
  - Binary search por overlap.
- [ ] `to_html(): XMLElementLike[]` — debug.
- [ ] Private `clip(v, max)`.
- [ ] Private `addSegment(line, newSegment)`:
  - Merge com segmentos sobrepostos/adjacentes.
  - Insere ordenado.
- [ ] Private `overlaps?(s1, s2)`.
- [ ] Private `mergeable?(s1, s2)`.
- [ ] Private `merge(dst, seg)`.

**Algoritmo `addSegment`:**
- Itera a lista.
- Se `mergeable(new, existing)`: merge + remove existing + retry.
- Se `existing[0] > new[1]`: insere antes.
- Se nenhum, append.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/CollisionDetector.rb` — arquivo completo.

#### Critério de aceite

```ts
const cd = new CollisionDetector(100, 100);
cd.addBlockedZone(10, 20, 30, 5, true, false);
assert(cd.collision(20, [15, 35], true));
assert(!cd.collision(20, [50, 60], true));
```

#### Testes

- `collision-detector_test.ts`:
  - `it("addBlockedZone horizontal")`.
  - `it("addBlockedZone vertical")`.
  - `it("collision horizontal")`.
  - `it("collision vertical")`.
  - `it("no collision")`.
  - `it("merge segments")`.
  - `it("clip")`.

---

### 15.3 — `GanttRouter`

#### Contexto

Roteia setas ortogonais. O algoritmo mais complexo da fase.

#### Objetivo

Implementar `GanttRouter`.

#### Arquivos

- `packages/report/src/gantt/gantt-router.ts`
- `packages/report/tests/gantt/gantt-router_test.ts`

#### Requisitos

- [ ] Constantes: `MinStartGap = 5`, `MinEndGap = 10`.
- [ ] `class GanttRouter`:
  - `private width: number`
  - `private height: number`
  - `private detector: CollisionDetector`
- [ ] Constructor `(width, height)`.
- [ ] `addZone(x, y, w, h, horiz, vert): void`.
- [ ] `routeLines(fromToPoints: [number, number, number, number, number?][]): [number, number][][]`:
  - Converte para `{ startX, startY, endX, endY, id }[]`.
  - Calcula `adjLeg = (endX - MinEndGap) - (startX + MinStartGap)`.
  - `oppLeg = |startY - endY|`.
  - `distance = sqrt(adjLeg² + oppLeg²)`.
  - `sinus = |oppLeg| / distance`.
  - `angle` (0-90).
  - Ordena por ângulo (bucket de 5), depois distância.
  - Para cada, `route(startX, startY, endX, endY)`.
- [ ] `route(startX, startY, endX, endY): [number, number][]`:
  - Se `endX - startX > startGap + endGap + 2`:
    - `xSeg = placeLine([startY ± 1, endY], false, startX + startGap, 1)`.
    - Se `xSeg && xSeg < endX - endGap`: rota direta.
  - Senão, rota complexa:
    - `ySeg = placeLine([0, width-1], true, startY + 2*deltaY, deltaY)`.
    - `x1 = placeLine([startY + deltaY, ySeg], false, startX + startGap, 1)`.
    - `x2 = placeLine([ySeg + deltaY, endY], false, endX - endGap, -1)`.
- [ ] Private `placeLine(segment, horizontal, start, delta): number`:
  - `pos = clip(start, [0, max])`.
  - Enquanto `collision(pos, segment, horizontal)`: `pos += delta`.
  - Retorna `pos`.
- [ ] Private `addLineTo(points, x2, y2): void`:
  - Adiciona zona bloqueada 2px ao redor do segmento.
- [ ] Private `justify(x, y, w, h): [number, number, number, number]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttRouter.rb` — arquivo completo.
- `docs/tj3-engine/16-blueprint-gantt.md` — §2.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-router_test.ts`:
  - `describe("GanttRouter")`
    - `it("rota simples direta")`.
    - `it("rota complexa com bloqueio")`.
    - `it("ordenação por ângulo")`.
    - `it("placeLine horizontal")`.
    - `it("placeLine vertical")`.
    - `it("addLineTo bloqueia zona")`.
    - `it("routeLines múltiplas setas")`.

---

### Bloco B — Content

---

### 15.4 — `GanttTaskBar`

#### Contexto

Barra de tarefa leaf. Retângulo com frame, fill e progress bar.

#### Objetivo

Implementar `GanttTaskBar`.

#### Arquivos

- `packages/report/src/gantt/gantt-task-bar.ts`
- `packages/report/tests/gantt/gantt-task-bar_test.ts`

#### Requisitos

- [ ] Constante: `@@size = 6` (half-height da barra).
- [ ] `class GanttTaskBar`:
  - `private query: Query | null`
  - `private lineHeight: number`
  - `private start: number`
  - `private end: number`
  - `private y: number`
- [ ] Constructor `(query, lineHeight, xStart, xEnd, y)`.
- [ ] `startDepLineStart(): [number, number]` → `[start + 1, y + lineHeight/2]`.
- [ ] `startDepLineEnd(): [number, number]` → `[start - 1, y + lineHeight/2]`.
- [ ] `endDepLineStart(): [number, number]` → `[end + 1, y + lineHeight/2]`.
- [ ] `endDepLineEnd(): [number, number]` → `[end - 1, y + lineHeight/2]`.
- [ ] `addBlockedZones(router): void`:
  - Horizontal block para toda a barra.
  - Block para arrowhead (start - 9).
  - Vertical blocks para end caps.
- [ ] `to_html(): XMLElementLike[]`:
  - Frame invisível para tooltip.
  - Frame da barra (`taskbarframe`).
  - Preenchimento (`taskbar`).
  - Progress bar (`progressbar`) com `complete` do Query.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttTaskBar.rb`.

#### Critério de aceite

```ts
const bar = new GanttTaskBar(null, 20, 100, 200, 10);
const html = bar.to_html();
assertEquals(html.length, 4); // frame invisível, frame, fill, progress
```

#### Testes

- `gantt-task-bar_test.ts`:
  - `it("dependency points")`.
  - `it("addBlockedZones")`.
  - `it("to_html sem query")`.
  - `it("to_html com query complete")`.
  - `it("to_html complete 100%")`.

---

### 15.5 — `GanttMilestone`

#### Contexto

Losango para milestones.

#### Objetivo

Implementar `GanttMilestone`.

#### Arquivos

- `packages/report/src/gantt/gantt-milestone.ts`
- `packages/report/tests/gantt/gantt-milestone_test.ts`

#### Requisitos

- [ ] Constante: `@@size = 6`.
- [ ] `class GanttMilestone`:
  - `private lineHeight: number`
  - `private x: number`
  - `private y: number`
- [ ] Constructor `(lineHeight, x, y)`.
- [ ] `startDepLineStart`, `startDepLineEnd`, `endDepLineStart`, `endDepLineEnd`.
- [ ] `addBlockedZones(router)`.
- [ ] `to_html(): XMLElementLike[]`:
  - Frame invisível.
  - `diamondToHTML(x, lineHeight/2)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttMilestone.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-milestone_test.ts`:
  - `it("to_html")`.
  - `it("dependency points")`.
  - `it("addBlockedZones")`.

---

### 15.6 — `GanttContainer`

#### Contexto

Container task (com children). Barra com jags.

#### Objetivo

Implementar `GanttContainer`.

#### Arquivos

- `packages/report/src/gantt/gantt-container.ts`
- `packages/report/tests/gantt/gantt-container_test.ts`

#### Requisitos

- [ ] Constante: `@@size = 5`.
- [ ] `class GanttContainer`:
  - `private lineHeight: number`
  - `private start: number`
  - `private end: number`
  - `private y: number`
- [ ] Constructor `(lineHeight, xStart, xEnd, y)`.
- [ ] Dependency points.
- [ ] `addBlockedZones(router)`.
- [ ] `to_html(): XMLElementLike[]`:
  - Frame invisível.
  - `containerbar`.
  - `jagToHTML(start, yCenter)`.
  - `jagToHTML(start + width, yCenter)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttContainer.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-container_test.ts`:
  - `it("to_html")`.
  - `it("dependency points")`.
  - `it("addBlockedZones")`.

---

### 15.7 — `GanttLoadStack`

#### Contexto

Pilha de alocação. Usada quando task está dentro de resource, ou resource dentro de task.

#### Objetivo

Implementar `GanttLoadStack`.

#### Arquivos

- `packages/report/src/gantt/gantt-load-stack.ts`
- `packages/report/tests/gantt/gantt-load-stack_test.ts`

#### Requisitos

- [ ] `class GanttLoadStack`:
  - `private line: GanttLine`
  - `private lineHeight: number`
  - `private x: number`
  - `private y: number`
  - `private w: number`
  - `private values: number[]`
  - `private categories: (string | null)[]`
  - `private yLevels: number[] | null`
  - `private drawFrame: boolean`
- [ ] Constructor `(line, x, w, values, categories)`:
  - Se `values.length !== categories.length`, `throw`.
  - `drawFrame = true` se algum `category === null && value > 0`.
  - Calcula `yLevels`: `((lineHeight - 4) * v / sum)`.
- [ ] `addBlockedZones(router)`.
- [ ] `to_html(): XMLElementLike[] | null`:
  - Se `!yLevels`, retorna null.
  - Frame ou rect de fundo (`loadstackframe`).
  - Barras empilhadas (de baixo para cima).
  - Categorias como classes CSS.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttLoadStack.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-load-stack_test.ts`:
  - `it("valores iguais")`.
  - `it("valores variados")`.
  - `it("sum 0 retorna null")`.
  - `it("drawFrame com null category")`.
  - `it("to_html com 3 níveis")`.

---

### Bloco C — Header

---

### 15.8 — `GanttHeaderScaleItem`

#### Contexto

Item individual de escala.

#### Objetivo

Implementar `GanttHeaderScaleItem`.

#### Arquivos

- `packages/report/src/gantt/gantt-header-scale-item.ts`
- `packages/report/tests/gantt/gantt-header-scale-item_test.ts`

#### Requisitos

- [ ] `class GanttHeaderScaleItem`:
  - `label: string`
  - `x: number`
  - `y: number`
  - `width: number`
  - `height: number`
- [ ] Constructor `(label, x, y, width, height)`.
- [ ] `to_html(): XMLElementLike`:
  - `<div class="tabhead" style="font-weight:bold; position:absolute; left:X; top:Y; width:W; height:H;">`.
  - `<div style="padding:3px;">label</div>`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttHeaderScaleItem.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-header-scale-item_test.ts`:
  - `it("constructor")`.
  - `it("to_html")`.

---

### 15.9 — `GanttHeader`

#### Contexto

Header com 2 linhas de escala (large + small).

#### Objetivo

Implementar `GanttHeader`.

#### Arquivos

- `packages/report/src/gantt/gantt-header.ts`
- `packages/report/tests/gantt/gantt-header_test.ts`

#### Requisitos

- [ ] `class GanttHeader`:
  - `private columnDef: TableColumnDefinition`
  - `private chart: GanttChart`
  - `private largeScale: GanttHeaderScaleItem[]`
  - `private smallScale: GanttHeaderScaleItem[]`
  - `gridLines: number[]`
  - `nowLineX: number | null`
  - `markdateLineX: number | null`
  - `cellStartDates: TjTime[]`
  - `height: number` (default 39)
- [ ] Constructor `(columnDef, chart)`.
- [ ] `to_html(): XMLElementLike`:
  - `<div class="tabback" style="...">`.
  - Append large + small items.
- [ ] Private `generate(): void`:
  - `h = (height - 1) / 2`.
  - Dispatch por `chart.scale.name`:
    - `hour`: `midnight` + `sameTimeNextDay` + `beginOfHour` + `sameTimeNextHour`.
    - `day`: `beginOfMonth` + `sameTimeNextMonth` + `midnight` + `sameTimeNextDay`.
    - `week`: `beginOfMonth` + `sameTimeNextMonth` + `beginOfWeek` + `sameTimeNextWeek`.
    - `month`: `beginOfYear` + `sameTimeNextYear` + `beginOfMonth` + `sameTimeNextMonth`.
    - `quarter`: `beginOfYear` + `sameTimeNextYear` + `beginOfQuarter` + `sameTimeNextQuarter`.
    - `year`: só small (`beginOfYear` + `sameTimeNextYear`).
  - Calcula `nowLineX`, `markdateLineX`.
- [ ] Private `genHeaderScale(scale, y, h, beginOfFunc, sameTimeNextFunc, timeformat)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttHeader.rb`.

#### Critério de aceite

```ts
const header = new GanttHeader(columnDef, chart);
assertEquals(header.height, 39);
assert(header.gridLines.length > 0);
```

#### Testes

- `gantt-header_test.ts`:
  - `it("hour scale")`.
  - `it("day scale")`.
  - `it("week scale")`.
  - `it("month scale")`.
  - `it("quarter scale")`.
  - `it("year scale")`.
  - `it("gridLines")`.
  - `it("nowLineX")`.
  - `it("markdateLineX")`.
  - `it("cellStartDates")`.
  - `it("to_html")`.

---

### Bloco D — Line

---

### 15.10 — `GanttLine`

#### Contexto

Linha do chart. Contém 1+ `GanttContent`.

#### Objetivo

Implementar `GanttLine`.

#### Arquivos

- `packages/report/src/gantt/gantt-line.ts`
- `packages/report/tests/gantt/gantt-line_test.ts`

#### Requisitos

- [ ] `class GanttLine`:
  - `private chart: GanttChart`
  - `query: Query`
  - `private tooltip: CellSettingPatternList | null`
  - `private category: string | null`
  - `y: number`
  - `height: number`
  - `private lineIndex: number`
  - `private timeOffZones: [number, number][]`
  - `private content: GanttContent[]`
- [ ] Constructor `(chart, query, y, height, lineIndex, tooltip)`:
  - `this.y = y + chart.header.height + 1`.
  - `generate()`.
- [ ] `to_html(): XMLElementLike`:
  - Div com category.
  - Time-off zones (`offduty`).
  - Grid lines (`tabvline`).
  - Content (task bars, milestones, load stacks).
  - Now line (`nowline`).
  - Markdate line (`markdateline`).
- [ ] `getTask(): GanttContent | null` — se `content.length === 1`.
- [ ] `addBlockedZones(router): void` — delega aos content.
- [ ] Private `generate(): void`:
  - `generateTimeOffZones()`.
  - Se `query.property instanceof Task`: `generateTask()`.
  - Senão: `generateResource()`.
- [ ] Private `generateTask(): void`:
  - `category = taskcell{(lineIndex+1)%2+1}`.
  - Se `scopeProperty`: `GanttLoadStack` para cada `cellStartDate`.
  - Senão:
    - Se milestone: `GanttMilestone`.
    - Senão se container && !rollup: `GanttContainer`.
    - Senão: `GanttTaskBar`.
- [ ] Private `generateResource(): void`:
  - `category = resourcecell{(lineIndex+1)%2+1}`.
  - Se `scopeProperty`: `GanttLoadStack` com 3 categorias (assigned/busy/free).
  - Senão: `GanttLoadStack` com 2 categorias (busy/free).
- [ ] Private `generateTimeOffZones(): void`:
  - Pega `minTimeOff` de `chart.scale`.
  - Se `<= 0`, retorna.
  - `property.collectTimeOffIntervals(iv, minTimeOff)`.
  - Converte para `[x, w]`.
- [ ] Private `addHtmlTooltip(tooltip, query, trigger, hook?)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttLine.rb` — arquivo completo.
- `docs/tj3-engine/16-blueprint-gantt.md` — §7.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-line_test.ts`:
  - `it("generateTask leaf")`.
  - `it("generateTask milestone")`.
  - `it("generateTask container")`.
  - `it("generateTask com rollup")`.
  - `it("generateTask nested em resource")`.
  - `it("generateResource simples")`.
  - `it("generateResource nested em task")`.
  - `it("to_html com grid lines")`.
  - `it("to_html com now line")`.
  - `it("generateTimeOffZones")`.

---

### Bloco E — Chart

---

### 15.11 — `GanttChart`

#### Contexto

Orquestrador. Junta header + lines + setas de dependência.

#### Objetivo

Implementar `GanttChart`.

#### Arquivos

- `packages/report/src/gantt/gantt-chart.ts`
- `packages/report/tests/gantt/gantt-chart_test.ts`

#### Requisitos

- [ ] Constante: `SCROLLBARHEIGHT = 20`.
- [ ] `class GanttChart`:
  - `start: TjTime | null`
  - `end: TjTime | null`
  - `readonly now: TjTime`
  - `readonly weekStartsMonday: boolean`
  - `header: GanttHeader | null`
  - `width: number`
  - `scale: ScaleConfig | null`
  - `readonly scales: ScaleConfig[]` (estático)
  - `table: TableReport | null`
  - `readonly markdate: TjTime | null`
  - `viewWidth: number | null`
  - `private columnDef: TableColumnDefinition`
  - `private height: number`
  - `private lines: GanttLine[]`
  - `private router: GanttRouter | null`
  - `private tasks: Map<Task, GanttLine[]>`
  - `private depArrows: [number, number][][]`
  - `private arrowHeads: [number, number][]`
- [ ] Constructor `(now, weekStartsMonday, columnDef, table = null, markdate = null)`.
- [ ] `addTask(task, line): void`.
- [ ] `generateByWidth(periodStart, periodEnd, width): void` — TODO.
- [ ] `generateByScale(periodStart, periodEnd, scaleName): void`:
  - `start = periodStart`, `end = periodEnd`.
  - `scale = scaleByName(scaleName)`.
  - `stepSize = scale.stepSize`.
  - `steps = start[scale.stepsToFunc](end)`.
  - `width = stepSize * steps`.
  - `header = new GanttHeader(columnDef, this)`.
- [ ] `to_html(): XMLElementLike`:
  - `completeChart()`.
  - `<td rowspan="...">`.
  - `<div class="tabback" style="overflow:auto;...">`.
  - `<div style="position:absolute;...">`.
  - Append header + lines + arrows + arrowHeads.
- [ ] `to_csv(csv, startColumn): number` → retorna 0.
- [ ] `dateToX(date): number`.
- [ ] `addLine(line): void`.
- [ ] `hasScrollbar(): boolean`.
- [ ] Private `scaleByName(name): ScaleConfig`.
- [ ] Private `completeChart(): void`:
  - Calcula `height`.
  - Cria `GanttRouter`.
  - Adiciona zonas bloqueadas de cada line.
  - Adiciona `nowLineX` e `markdateLineX`.
  - Gera setas de dependência.
  - Deduplica arrow heads.
- [ ] Private `generateDepLines(task, lines): void`.
- [ ] Private `generateTaskDepLines(kind, task, scIdx, lineIndex, startX, startY): void`.

**Escalas:**
```ts
const SCALES = [
  { name: 'hour', stepSize: 20, stepsToFunc: 'hoursTo', minTimeOff: 300 },
  { name: 'day', stepSize: 20, stepsToFunc: 'daysTo', minTimeOff: 21600 },
  { name: 'week', stepSize: 20, stepsToFunc: 'weeksTo', minTimeOff: 86400 },
  { name: 'month', stepSize: 35, stepsToFunc: 'monthsTo', minTimeOff: 432000 },
  { name: 'quarter', stepSize: 28, stepsToFunc: 'quartersTo', minTimeOff: -1 },
  { name: 'year', stepSize: 20, stepsToFunc: 'yearsTo', minTimeOff: -1 },
];
```

**Escolha de escala automática** (não no Ruby; deixar para futuro).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb` — arquivo completo.
- `docs/tj3-engine/16-blueprint-gantt.md` — §2.

#### Critério de aceite

Análogo.

#### Testes

- `gantt-chart_test.ts`:
  - `describe("GanttChart")`
    - `it("constructor")`.
    - `it("generateByScale")`.
    - `it("dateToX")`.
    - `it("hasScrollbar true")`.
    - `it("hasScrollbar false")`.
    - `it("completeChart calcula height")`.
    - `it("completeChart gera arrowHeads únicos")`.
    - `it("to_html com 1 task")`.
    - `it("to_html com 3 tasks e dependências")`.
    - `it("to_html com milestone")`.
    - `it("to_html com container")`.
    - `it("to_csv retorna 0")`.

---

### Bloco F — Integração

---

### 15.12 — Integração com `TaskReport` e `ResourceReport`

#### Contexto

Conectar `GanttChart` com `TableReport`.

#### Objetivo

Testes end-to-end.

#### Arquivos

- `packages/report/tests/gantt/integration_test.ts`

#### Requisitos

- [ ] `TaskReport` com coluna `chart`:
  - `columnDef.id === 'chart'` → `GanttChart` no header.
  - `generateTableCell` cria `GanttLine` para cada task.
  - `to_html()` retorna HTML completo com barras e setas.
- [ ] `ResourceReport` com coluna `chart`:
  - Idem, mas `GanttLine` gera `GanttLoadStack`.
- [ ] `rollupTask` esconde children.
- [ ] `milestone` gera losango.
- [ ] Nested resources geram load stacks.

#### Referências

- Fases 14, 15.

#### Critério de aceite

Análogo.

#### Testes

- `integration_test.ts`:
  - `it("taskreport com 1 task")`.
  - `it("taskreport com cadeia de 3 tasks e dependências")`.
  - `it("taskreport com milestone")`.
  - `it("taskreport com container")`.
  - `it("resourcereport com 1 resource")`.
  - `it("taskreport nested em resourcereport")`.
  - `it("rollupTask")`.

---

### Bloco G — Golden tests

---

### 15.13 — Golden tests (Gantt)

#### Contexto

Validar Gantt contra `tj3`.

#### Objetivo

Scripts Ruby que rodam `tj3` nos MWEs e extraem HTML do chart.

#### Arquivos

- `scripts/golden/gantt-mwe001.rb` a `gantt-mwe009.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/report/tests/golden/gantt.golden.json`
- `packages/report/tests/golden/gantt_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Scripts Ruby:**

- [ ] Para cada MWE com `chart` column:
  - Roda `tj3`.
  - Extrai `chartcell` do HTML.
  - Normaliza (remove whitespace, ordena atributos).
  - Serializa: `{ taskBars: [{id, xStart, xEnd, y, completion}], milestones: [...], containers: [...], depArrows: [...] }`.

**Teste TS:**

- [ ] Compara com tolerância de 1px.
- [ ] Verifica:
  - Número de task bars.
  - Posições X.
  - Número de setas.
  - Y de cada linha.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/Learning/mwe001-009/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- Visual diff (comparação de pixels) — Fase 21.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 30 casos.
- Todos passam.

#### Testes

- `gantt_golden_test.ts`:
  - `describe("Golden Gantt")` — itera MWEs.

---

## 6. Ordem de execução sugerida

```text
19.0  ADR 026
      ↓
19.1  HTMLGraphics
19.2  CollisionDetector
19.3  GanttRouter           ← complexo
      ↓
19.4  GanttTaskBar
19.5  GanttMilestone
19.6  GanttContainer
19.7  GanttLoadStack
      ↓
19.8  GanttHeaderScaleItem
19.9  GanttHeader
      ↓
19.10 GanttLine             ← integra todos
      ↓
19.11 GanttChart            ← orquestrador
      ↓
19.12 Integração TaskReport/ResourceReport
      ↓
19.13 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 15 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `HTMLGraphics`, `CollisionDetector`, `GanttRouter`.
- [ ] `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`.
- [ ] `GanttHeader` + `GanttHeaderScaleItem`.
- [ ] `GanttLine`, `GanttChart`.
- [ ] Integração com `TaskReport` e `ResourceReport`.
- [ ] Setas de dependência ortogonais funcionando.
- [ ] Now line + markdate line.
- [ ] Time-off zones.
- [ ] **≥ 200 testes unitários**.
- [ ] **≥ 30 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 026 criado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `GanttRouter.route` com muitos bloqueios falha | Alto | Testes com charts densos; warning em falha |
| Coordenadas com subpixel | Médio | `Math.round` em todos |
| `completeChart` chamado 2x | Médio | Flag `@completed` |
| `GanttLine.generateTask` com rollup | Médio | Teste específico |
| `addBlockedZones` de `GanttTaskBar` sobrepor | Alto | Golden tests com 3+ tasks |
| `arrowHeads` duplicadas | Médio | Dedup no `completeChart` |
| `hasScrollbar` com viewWidth null | Médio | Teste com/sem |
| `timeOffZones` com minTimeOff = -1 | Médio | Teste com cada escala |
| `GanttRouter` com X negativo | Médio | `placeLine` clampa |
| `HTMLGraphics.lineToHTML` com coordenadas iguais | Baixo | Teste |
| `GanttHeader` com scale `year` sem large | Médio | Teste específico |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttHeader.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttHeaderScaleItem.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttLine.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttTaskBar.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttMilestone.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttContainer.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttLoadStack.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/GanttRouter.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/CollisionDetector.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/HTMLGraphics.rb`

### Blueprints

- `docs/tj3-engine/16-blueprint-gantt.md` — **blueprint completo**
- `docs/tj3-engine/09-blueprint-engine8.md`
- `docs/tj3-engine/14-blueprint-others.md`

### Documentos do projeto

- `docs/syntaxmesh/decisoes/026-gantt-html-css.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 14 — Reports** (coluna `chart`).
- **Fase 20 — UI** (exibe Gantt).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **HTML+CSS puro.** Sem SVG. Sem Canvas.
2. **Coordenadas em pixels inteiros.** `Math.round` em todas.
3. **`GanttRouter` é o algoritmo mais complexo.** Replicar fielmente.
4. **Ordem de `routeLines`** importa. Bucket de 5 graus.
5. **`placeLine` clampa** para `[0, max]`.
6. **`completeChart` é lazy.** Só em `to_html`.
7. **`arrowHeads` deduplicadas.** Único por endpoint.
8. **`GanttLine.y`** inclui `chart.header.height + 1`.
9. **`generateTask`** distingue 4 casos: leaf, milestone, container, rollup.
10. **`generateResource`** distingue 2 casos: simples, nested em task.
11. **`timeOffZones`** com `minTimeOff` da escala.
12. **`nowLine`** em `chart.now`. **`markdateLine`** em `chart.markdate`.
13. **`addBlockedZones`** de cada content é chamado em `completeChart`.
14. **`to_csv` retorna 0.** Gantt não vai para CSV.
15. **Sem `any`.** Use `unknown` + type guards.
16. **Commit por subfase.** `feat(report): gantt-chart`, etc.
17. **Nunca expandir `GanttRouter` para diagonal.** Ortogonal é decisão.

---

## 11. ADR 026 (referência rápida)

Criado como subfase 19.0. Conteúdo esperado:

- **Título:** Gantt HTML+CSS
- **Contexto:** TJ usa HTML+CSS; alternativas SVG/Canvas.
- **Decisão:** manter HTML+CSS.
- **Alternativas:** SVG (via Painter), Canvas.
- **Consequências:** interativo + testável; muitos `<div>` em charts grandes.

---

**Fim da Fase 15.**