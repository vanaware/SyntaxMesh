# Fase 15 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-15-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-15-gantt.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~205 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/reports/{GanttChart,GanttHeader,GanttHeaderScaleItem,GanttLine,GanttTaskBar,GanttMilestone,GanttContainer,GanttLoadStack,GanttRouter,CollisionDetector,HTMLGraphics}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

A ordem **dentro** da fase importa:

1. **Bloco A (utilitários)** primeiro — `HTMLGraphics`, `CollisionDetector`, `GanttRouter`.
2. **Bloco B (content)** — `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`.
3. **Bloco C (header)** — `GanttHeaderScaleItem`, `GanttHeader`.
4. **Bloco D (line)** — `GanttLine` (integra todos).
5. **Bloco E (chart)** — `GanttChart` (orquestrador).
6. **Bloco F (integração)** — `TaskReport` e `ResourceReport`.
7. **Bloco G (golden)** — validação end-to-end.
8. **Bloco H (verificação)** — fecha a fase.

### ADRs relevantes

- **ADR 009** — RichText mantido, Markdown futuro.
- **ADR 011–023** — Fases 2–11 (contexto).
- **ADR 024** — RichText e function handlers (Fase 12).
- **ADR 025** — Markdown going-forward (Fase 13).
- **ADR 026** — Reports browser-only (Fase 14).
- **ADR 027** — Gantt HTML+CSS (**criado nesta fase**).

### Convenções CRÍTICAS

- **Gantt é HTML + CSS puro.** Sem SVG, sem Canvas.
- **Coordenadas em pixels inteiros.** `Math.round` em todas.
- **`GanttRouter` é o algoritmo mais complexo.** Replicar fielmente.
- **Ordem de `routeLines` importa.** Bucket de 5 graus.
- **`placeLine` clampa para `[0, max]`.**
- **`completeChart` é lazy.** Só em `to_html`.
- **`arrowHeads` deduplicadas.** Único por endpoint.
- **`GanttLine.y` inclui `chart.header.height + 1`.**
- **`generateTask` distingue 4 casos:** leaf, milestone, container, rollup.
- **`generateResource` distingue 2 casos:** simples, nested em task.
- **`timeOffZones` com `minTimeOff` da escala.**
- **`nowLine` em `chart.now`; `markdateLine` em `chart.markdate`.**
- **`addBlockedZones` de cada content é chamado em `completeChart`.**
- **`to_csv` retorna 0.** Gantt não vai para CSV.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar SVG nem Canvas.
- ❌ Não expandir `GanttRouter` para diagonal (ortogonal é decisão).
- ❌ Não usar `Proxy`.
- ❌ Não reordenar `routeLines`.
- ❌ Não pular `completeChart`.
- ❌ Não duplicar `arrowHeads`.
- ❌ Não simplificar `generateTask`/`generateResource`.
- ❌ Não esquecer `minTimeOff` da escala.
- ❌ Não chamar `completeChart` mais de uma vez (flag `@completed`).

---

## Progresso

```
[ ] 15.0  ADR 027 (Gantt HTML+CSS)                 —   0/5
[ ] 15.1  HTMLGraphics                             —   0/12
[ ] 15.2  CollisionDetector                        —   0/16
[ ] 15.3  GanttRouter                              —   0/22
[ ] 15.4  GanttTaskBar                             —   0/12
[ ] 15.5  GanttMilestone                           —   0/8
[ ] 15.6  GanttContainer                           —   0/10
[ ] 15.7  GanttLoadStack                           —   0/12
[ ] 15.8  GanttHeaderScaleItem                     —   0/4
[ ] 15.9  GanttHeader                              —   0/16
[ ] 15.10 GanttLine                                —   0/24
[ ] 15.11 GanttChart                               —   0/24
[ ] 15.12 Integração TaskReport/ResourceReport     —   0/10
[ ] 15.13 Golden tests (Gantt)                     —   0/10
[ ] 15.14 Verificação final                        —   0/8
────────────────────────────────────────────────────────
TOTAL: ~205
```

---

## Bloco A — Fundação

### 15.0 — ADR 027 (Gantt HTML+CSS)

**Objetivo:** formalizar a decisão de manter HTML+CSS (não SVG/Canvas).

**⚠️ Nota:** o plano usa `ADR 025`, mas ADR 025 é Markdown (Fase 13), ADR 026 é reports (Fase 14). Aqui usamos **ADR 027**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.0.1 | Criar `docs/syntaxmesh/decisoes/027-gantt-html-css.md` com frontmatter | idem | arquivo existe |
| 15.0.2 | Seção **Contexto:** TJ usa HTML+CSS; alternativas SVG/Canvas | idem | — |
| 15.0.3 | Seção **Decisão:** manter HTML+CSS (fidelidade ao TJ) | idem | — |
| 15.0.4 | **Alternativas** (SVG via Painter, Canvas) + **Consequências** (interativo + testável; muitos `<div>` em charts grandes) | idem | — |
| 15.0.5 | Atualizar linha `027` em `decisoes/README.md` | idem | 27 linhas |

---

### 15.1 — `HTMLGraphics`

**⚠️ RUBY: `reports/HTMLGraphics.rb` (arquivo inteiro — ~110 linhas)**
**🔎 CHEAT: §3 `to_i` → `Math.floor`, §5 strings**

**Pré-requisitos:** Fase 14 (`XMLElementLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.1.1 | Criar `packages/report/src/gantt/html-graphics.ts` | idem | `deno check` |
| 15.1.2 | ⚠️ `lineToHTML(xs, ys, xe, ye, category): XMLElementLike` — se `ys === ye`: horizontal; se `xs === xe`: vertical; senão, `throw Error('diagonal line')` | idem | 5 testes |
| 15.1.3 | `lineToHTML` — troca `xs`/`xe` se `xs > xe`; idem `ys`/`ye` | idem | 3 testes |
| 15.1.4 | Teste: `<div class="foo" style="left:10px; top:20px; width:41px; height:1px;"></div>` | idem | 1 teste |
| 15.1.5 | ⚠️ `rectToHTML(x, y, w, h, category): XMLElementLike` | idem | 3 testes |
| 15.1.6 | ⚠️ `jagToHTML(x, y): XMLElementLike` — `<div class="tj_gantt_jag" style="left:x-5px; top:y;">` | idem | 3 testes |
| 15.1.7 | ⚠️ `diamondToHTML(x, y): XMLElementLike[]` — `tj_diamond_top` + `tj_diamond_bottom` | idem | 3 testes |
| 15.1.8 | ⚠️ `arrowHeadToHTML(x, y): XMLElementLike` — `<div class="tj_arrow_head" style="left:x-5px; top:y-5px;">` | idem | 3 testes |
| 15.1.9 | Teste: `lineToHTML` com coordenadas iguais (0 comprimento) | idem | 1 teste |
| 15.1.10 | Teste: `lineToHTML` com coordenadas negativas | idem | 1 teste |
| 15.1.11 | Teste: `rectToHTML` com width 0 | idem | 1 teste |
| 15.1.12 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 15.2 — `CollisionDetector`

**⚠️ RUBY: `reports/CollisionDetector.rb` (arquivo inteiro — ~180 linhas)**
**🔎 CHEAT: §3 `Array` de `Array`, §12 Categoria B (binary search)**

**Pré-requisitos:** 15.1.

#### 15.2.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.2.1.1 | Criar `packages/report/src/gantt/collision-detector.ts` com `class CollisionDetector` | idem | `deno check` |
| 15.2.1.2 | Campos: `private width`, `private height`, `private hLines: number[][][]`, `private vLines: number[][][]` | idem | `deno check` |
| 15.2.1.3 | Constructor `(width, height)` | idem | 2 testes |

#### 15.2.2 — `addBlockedZone`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.2.2.1 | ⚠️ `addBlockedZone(x, y, w, h, horiz, vert): void` — clip para `[0, width-1]`, `[0, height-1]` | idem | 3 testes |
| 15.2.2.2 | ⚠️ Se `horiz`: para cada linha de `y` a `y+h-1`, `addSegment(hLines[i], [x, x+w-1])` | idem | 3 testes |
| 15.2.2.3 | ⚠️ Se `vert`: para cada coluna de `x` a `x+w-1`, `addSegment(vLines[i], [y, y+h-1])` | idem | 3 testes |
| 15.2.2.4 | Teste: `addBlockedZone(10, 20, 30, 5, true, false)` — apenas horizontal | idem | 1 teste |
| 15.2.2.5 | Teste: `addBlockedZone(10, 20, 30, 5, false, true)` — apenas vertical | idem | 1 teste |
| 15.2.2.6 | Teste: `addBlockedZone(10, 20, 30, 5, true, true)` — ambos | idem | 1 teste |

#### 15.2.3 — `collision?`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.2.3.1 | ⚠️ `collision?(pos, segment, horizontal): boolean` — binary search | idem | 3 testes |
| 15.2.3.2 | Teste: colisão horizontal | idem | 1 teste |
| 15.2.3.3 | Teste: colisão vertical | idem | 1 teste |
| 15.2.3.4 | Teste: sem colisão | idem | 1 teste |
| 15.2.3.5 | Teste: colisão em limite (start/end do segmento) | idem | 2 testes |

#### 15.2.4 — Helpers privados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.2.4.1 | ⚠️ `private clip(v, max)` | idem | 2 testes |
| 15.2.4.2 | ⚠️ `private addSegment(line, newSegment)` — merge com sobrepostos/adjacentes | idem | 4 testes |
| 15.2.4.3 | ⚠️ `private overlaps?(s1, s2)` | idem | 3 testes |
| 15.2.4.4 | ⚠️ `private mergeable?(s1, s2)` | idem | 4 testes |
| 15.2.4.5 | ⚠️ `private merge(dst, seg)` | idem | 2 testes |
| 15.2.4.6 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 15.3 — `GanttRouter`

**⚠️ RUBY: `reports/GanttRouter.rb` (arquivo inteiro — ~230 linhas)**
**🔎 CHEAT: §6 `Math.sqrt`, §12 Categoria B (bucket sort de 5 graus)**

**Pré-requisitos:** 15.2.

#### 15.3.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.3.1.1 | Criar `packages/report/src/gantt/gantt-router.ts` | idem | `deno check` |
| 15.3.1.2 | Constantes: `MinStartGap = 5`, `MinEndGap = 10` | idem | `deno check` |
| 15.3.1.3 | Campos: `private width`, `private height`, `private detector: CollisionDetector` | idem | `deno check` |
| 15.3.1.4 | Constructor `(width, height)` — cria `CollisionDetector` interno | idem | 2 testes |

#### 15.3.2 — Zonas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.3.2.1 | ⚠️ `addZone(x, y, w, h, horiz, vert): void` — delega para `detector.addBlockedZone` | idem | 3 testes |

#### 15.3.3 — `routeLines`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.3.3.1 | ⚠️ `routeLines(fromToPoints: [number, number, number, number, number?][]): [number, number][][]` | idem | 1 teste |
| 15.3.3.2 | Converte para `{ startX, startY, endX, endY, id }[]` | idem | 2 testes |
| 15.3.3.3 | ⚠️ Calcula `adjLeg = (endX - MinEndGap) - (startX + MinStartGap)` | idem | 2 testes |
| 15.3.3.4 | ⚠️ `oppLeg = \|startY - endY\|`; `distance = sqrt(adjLeg² + oppLeg²)` | idem | 2 testes |
| 15.3.3.5 | ⚠️ `sinus = \|oppLeg\| / distance`; `angle` (0-90) | idem | 3 testes |
| 15.3.3.6 | ⚠️ Ordena por ângulo (bucket de 5), depois distância | idem | 4 testes |
| 15.3.3.7 | Para cada seta, `route(startX, startY, endX, endY)` | idem | 1 teste |
| 15.3.3.8 | Teste: múltiplas setas ordenadas | idem | 1 teste |
| 15.3.3.9 | Teste: mesma seta em posições diferentes | idem | 1 teste |
| 15.3.3.10 | Teste: `routeLines` com 0 setas | idem | 1 teste |
| 15.3.3.11 | Teste: `routeLines` com 1 seta | idem | 1 teste |
| 15.3.3.12 | Teste: `routeLines` com 5 setas | idem | 1 teste |

#### 15.3.4 — `route` (rota direta vs complexa)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.3.4.1 | ⚠️ `route(startX, startY, endX, endY): [number, number][]` | idem | 1 teste |
| 15.3.4.2 | ⚠️ Se `endX - startX > startGap + endGap + 2`: `xSeg = placeLine([startY ± 1, endY], false, startX + startGap, 1)` | idem | 3 testes |
| 15.3.4.3 | ⚠️ Se `xSeg && xSeg < endX - endGap`: rota direta (2 pontos) | idem | 4 testes |
| 15.3.4.4 | ⚠️ Senão, rota complexa: `ySeg = placeLine([0, width-1], true, startY + 2*deltaY, deltaY)` | idem | 3 testes |
| 15.3.4.5 | ⚠️ `x1 = placeLine([startY + deltaY, ySeg], false, startX + startGap, 1)` | idem | 3 testes |
| 15.3.4.6 | ⚠️ `x2 = placeLine([ySeg + deltaY, endY], false, endX - endGap, -1)` | idem | 3 testes |
| 15.3.4.7 | Retorna `[[startX, startY], [x1, startY], [x1, ySeg], [x2, ySeg], [x2, endY], [endX, endY]]` | idem | 2 testes |

#### 15.3.5 — Helpers privados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.3.5.1 | ⚠️ `private placeLine(segment, horizontal, start, delta): number` — `pos = clip(start, [0, max])`; enquanto `collision(pos, segment, horizontal)`: `pos += delta` | idem | 4 testes |
| 15.3.5.2 | Teste: `placeLine` clampa | idem | 2 testes |
| 15.3.5.3 | ⚠️ `private addLineTo(points, x2, y2): void` — bloqueia zona 2px | idem | 3 testes |
| 15.3.5.4 | ⚠️ `private justify(x, y, w, h): [number, number, number, number]` | idem | 2 testes |
| 15.3.5.5 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco B — Content

### 15.4 — `GanttTaskBar`

**⚠️ RUBY: `reports/GanttTaskBar.rb` (arquivo inteiro — ~120 linhas)**

**Pré-requisitos:** 15.1, Fase 14 (`ReportTable`), Fase 11 (`Query`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.4.1 | Criar `packages/report/src/gantt/gantt-task-bar.ts` | idem | `deno check` |
| 15.4.2 | Constante: `static readonly SIZE = 6` (half-height da barra) | idem | `deno check` |
| 15.4.3 | Campos: `private query`, `private lineHeight`, `private start`, `private end`, `private y` | idem | `deno check` |
| 15.4.4 | Constructor `(query, lineHeight, xStart, xEnd, y)` | idem | 3 testes |
| 15.4.5 | ⚠️ `startDepLineStart(): [number, number]` → `[start + 1, y + lineHeight/2]` | idem | 2 testes |
| 15.4.6 | ⚠️ `startDepLineEnd(): [number, number]` → `[start - 1, y + lineHeight/2]` | idem | 2 testes |
| 15.4.7 | ⚠️ `endDepLineStart(): [number, number]` → `[end + 1, y + lineHeight/2]` | idem | 2 testes |
| 15.4.8 | ⚠️ `endDepLineEnd(): [number, number]` → `[end - 1, y + lineHeight/2]` | idem | 2 testes |
| 15.4.9 | ⚠️ `addBlockedZones(router): void` — horizontal block + arrowhead + end caps | idem | 4 testes |
| 15.4.10 | ⚠️ `to_html(): XMLElementLike[]` — frame invisível, frame, fill, progress | idem | 4 testes |
| 15.4.11 | Teste: `to_html` sem query | idem | 1 teste |
| 15.4.12 | Teste: `to_html` com query `complete` | idem | 1 teste |

---

### 15.5 — `GanttMilestone`

**⚠️ RUBY: `reports/GanttMilestone.rb` (arquivo inteiro — ~90 linhas)**

**Pré-requisitos:** 15.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.5.1 | Criar `packages/report/src/gantt/gantt-milestone.ts` | idem | `deno check` |
| 15.5.2 | Constante: `static readonly SIZE = 6` | idem | `deno check` |
| 15.5.3 | Campos: `private lineHeight`, `private x`, `private y` | idem | `deno check` |
| 15.5.4 | Constructor `(lineHeight, x, y)` | idem | 2 testes |
| 15.5.5 | ⚠️ Dependency points (`startDepLineStart`/`End`, `endDepLineStart`/`End`) | idem | 4 testes |
| 15.5.6 | ⚠️ `addBlockedZones(router): void` | idem | 3 testes |
| 15.5.7 | ⚠️ `to_html(): XMLElementLike[]` — frame invisível + `diamondToHTML(x, lineHeight/2)` | idem | 3 testes |
| 15.5.8 | Teste: dependency points | idem | 1 teste |

---

### 15.6 — `GanttContainer`

**⚠️ RUBY: `reports/GanttContainer.rb` (arquivo inteiro — ~100 linhas)**

**Pré-requisitos:** 15.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.6.1 | Criar `packages/report/src/gantt/gantt-container.ts` | idem | `deno check` |
| 15.6.2 | Constante: `static readonly SIZE = 5` | idem | `deno check` |
| 15.6.3 | Campos: `private lineHeight`, `private start`, `private end`, `private y` | idem | `deno check` |
| 15.6.4 | Constructor `(lineHeight, xStart, xEnd, y)` | idem | 3 testes |
| 15.6.5 | ⚠️ Dependency points | idem | 4 testes |
| 15.6.6 | ⚠️ `addBlockedZones(router): void` | idem | 3 testes |
| 15.6.7 | ⚠️ `to_html(): XMLElementLike[]` — frame invisível + `containerbar` + 2 `jagToHTML` | idem | 4 testes |
| 15.6.8 | Teste: `to_html` com start/end corretos | idem | 1 teste |
| 15.6.9 | Teste: jags nas posições corretas | idem | 2 testes |
| 15.6.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 15.7 — `GanttLoadStack`

**⚠️ RUBY: `reports/GanttLoadStack.rb` (arquivo inteiro — ~120 linhas)**

**Pré-requisitos:** 15.1, 15.10 (`GanttLine` — referência circular).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.7.1 | Criar `packages/report/src/gantt/gantt-load-stack.ts` | idem | `deno check` |
| 15.7.2 | Campos: `line`, `lineHeight`, `x`, `y`, `w`, `values`, `categories`, `yLevels`, `drawFrame` | idem | `deno check` |
| 15.7.3 | ⚠️ Constructor `(line, x, w, values, categories)` — rejeita `values.length !== categories.length` | idem | 3 testes |
| 15.7.4 | ⚠️ `drawFrame = true` se algum `category === null && value > 0` | idem | 3 testes |
| 15.7.5 | ⚠️ Calcula `yLevels`: `((lineHeight - 4) * v / sum)` | idem | 3 testes |
| 15.7.6 | ⚠️ `addBlockedZones(router): void` | idem | 3 testes |
| 15.7.7 | ⚠️ `to_html(): XMLElementLike[] \| null` — se `!yLevels`, retorna `null` | idem | 2 testes |
| 15.7.8 | Frame ou rect de fundo (`loadstackframe`) | idem | 2 testes |
| 15.7.9 | Barras empilhadas (de baixo para cima) | idem | 3 testes |
| 15.7.10 | Categorias como classes CSS | idem | 2 testes |
| 15.7.11 | Teste: `valores iguais` — 3 valores idênticos | idem | 1 teste |
| 15.7.12 | Teste: `sum 0 retorna null` | idem | 1 teste |

---

## Bloco C — Header

### 15.8 — `GanttHeaderScaleItem`

**⚠️ RUBY: `reports/GanttHeaderScaleItem.rb` (arquivo inteiro — ~30 linhas)**

**Pré-requisitos:** 15.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.8.1 | Criar `packages/report/src/gantt/gantt-header-scale-item.ts` | idem | `deno check` |
| 15.8.2 | Campos: `label`, `x`, `y`, `width`, `height` | idem | `deno check` |
| 15.8.3 | Constructor `(label, x, y, width, height)` | idem | 2 testes |
| 15.8.4 | ⚠️ `to_html(): XMLElementLike` — `<div class="tabhead">` com `<div style="padding:3px;">label</div>` | idem | 2 testes |

---

### 15.9 — `GanttHeader`

**⚠️ RUBY: `reports/GanttHeader.rb` (arquivo inteiro — ~180 linhas)**

**Pré-requisitos:** 15.8, 15.11 (`GanttChart` — referência circular), Fase 2 (`TjTime`).

#### 15.9.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.9.1.1 | Criar `packages/report/src/gantt/gantt-header.ts` | idem | `deno check` |
| 15.9.1.2 | Campos: `private columnDef`, `private chart`, `private largeScale`, `private smallScale` | idem | `deno check` |
| 15.9.1.3 | Campos: `gridLines: number[]`, `nowLineX`, `markdateLineX`, `cellStartDates: TjTime[]`, `height = 39` | idem | `deno check` |
| 15.9.1.4 | Constructor `(columnDef, chart)` | idem | 2 testes |

#### 15.9.2 — `generate` (por escala)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.9.2.1 | ⚠️ `private generate(): void` — `h = (height - 1) / 2` | idem | 1 teste |
| 15.9.2.2 | ⚠️ **Scale `hour`:** large = `midnight` + `sameTimeNextDay`; small = `beginOfHour` + `sameTimeNextHour` | idem | 3 testes |
| 15.9.2.3 | ⚠️ **Scale `day`:** large = `beginOfMonth` + `sameTimeNextMonth`; small = `midnight` + `sameTimeNextDay` | idem | 3 testes |
| 15.9.2.4 | ⚠️ **Scale `week`:** large = `beginOfMonth` + `sameTimeNextMonth`; small = `beginOfWeek` + `sameTimeNextWeek` | idem | 3 testes |
| 15.9.2.5 | ⚠️ **Scale `month`:** large = `beginOfYear` + `sameTimeNextYear`; small = `beginOfMonth` + `sameTimeNextMonth` | idem | 3 testes |
| 15.9.2.6 | ⚠️ **Scale `quarter`:** large = `beginOfYear` + `sameTimeNextYear`; small = `beginOfQuarter` + `sameTimeNextQuarter` | idem | 3 testes |
| 15.9.2.7 | ⚠️ **Scale `year`:** só small (`beginOfYear` + `sameTimeNextYear`) | idem | 2 testes |
| 15.9.2.8 | Calcula `nowLineX`, `markdateLineX` | idem | 3 testes |

#### 15.9.3 — `genHeaderScale` + `to_html`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.9.3.1 | ⚠️ `private genHeaderScale(scale, y, h, beginOfFunc, sameTimeNextFunc, timeformat)` | idem | 3 testes |
| 15.9.3.2 | ⚠️ `to_html(): XMLElementLike` — `<div class="tabback">` com large + small | idem | 3 testes |
| 15.9.3.3 | Teste: `height === 39` | idem | 1 teste |
| 15.9.3.4 | Teste: `gridLines.length > 0` | idem | 1 teste |
| 15.9.3.5 | Teste: `cellStartDates` preenchido | idem | 1 teste |
| 15.9.3.6 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco D — Line

### 15.10 — `GanttLine`

**⚠️ RUBY: `reports/GanttLine.rb` (arquivo inteiro — ~350 linhas)**
**🔎 CHEAT: §3 `is_a?` → `instanceof`, §12 Categoria B (timezone)**

**Pré-requisitos:** 15.4–15.7, 15.9, 15.11, Fase 5 (`Task`, `Resource`).

#### 15.10.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.10.1.1 | Criar `packages/report/src/gantt/gantt-line.ts` | idem | `deno check` |
| 15.10.1.2 | Campos: `private chart`, `query`, `private tooltip`, `private category`, `y`, `height`, `private lineIndex` | idem | `deno check` |
| 15.10.1.3 | Campos: `private timeOffZones`, `private content: GanttContent[]` | idem | `deno check` |
| 15.10.1.4 | ⚠️ Constructor `(chart, query, y, height, lineIndex, tooltip)` — `this.y = y + chart.header.height + 1` | idem | 3 testes |
| 15.10.1.5 | Chama `generate()` | idem | 1 teste |

#### 15.10.2 — `generate` + `generateTask`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.10.2.1 | ⚠️ `private generate(): void` — chama `generateTimeOffZones()`; dispatch por tipo de property | idem | 3 testes |
| 15.10.2.2 | Se `query.property instanceof Task`: `generateTask()` | idem | 2 testes |
| 15.10.2.3 | Senão: `generateResource()` | idem | 2 testes |
| 15.10.2.4 | ⚠️ `private generateTask(): void` — `category = taskcell{(lineIndex+1)%2+1}` | idem | 2 testes |
| 15.10.2.5 | ⚠️ Se `scopeProperty`: `GanttLoadStack` para cada `cellStartDate` | idem | 3 testes |
| 15.10.2.6 | ⚠️ Se `milestone`: `GanttMilestone` | idem | 3 testes |
| 15.10.2.7 | ⚠️ Senão se `container && !rollup`: `GanttContainer` | idem | 3 testes |
| 15.10.2.8 | ⚠️ Senão: `GanttTaskBar` | idem | 3 testes |

#### 15.10.3 — `generateResource`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.10.3.1 | ⚠️ `private generateResource(): void` — `category = resourcecell{(lineIndex+1)%2+1}` | idem | 2 testes |
| 15.10.3.2 | ⚠️ Se `scopeProperty`: `GanttLoadStack` com 3 categorias (assigned/busy/free) | idem | 4 testes |
| 15.10.3.3 | ⚠️ Senão: `GanttLoadStack` com 2 categorias (busy/free) | idem | 3 testes |

#### 15.10.4 — `generateTimeOffZones`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.10.4.1 | ⚠️ `private generateTimeOffZones(): void` — pega `minTimeOff` de `chart.scale` | idem | 2 testes |
| 15.10.4.2 | Se `minTimeOff <= 0`, retorna (sem zonas) | idem | 3 testes |
| 15.10.4.3 | ⚠️ `property.collectTimeOffIntervals(iv, minTimeOff)` | idem | 3 testes |
| 15.10.4.4 | Converte para `[x, w]` | idem | 2 testes |

#### 15.10.5 — `to_html` + tooltip + dependency

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.10.5.1 | ⚠️ `to_html(): XMLElementLike` — div com `category` | idem | 2 testes |
| 15.10.5.2 | Time-off zones (`offduty`) | idem | 2 testes |
| 15.10.5.3 | Grid lines (`tabvline`) | idem | 2 testes |
| 15.10.5.4 | Content (task bars, milestones, load stacks) | idem | 3 testes |
| 15.10.5.5 | Now line (`nowline`) e markdate line (`markdateline`) | idem | 3 testes |
| 15.10.5.6 | ⚠️ `getTask(): GanttContent \| null` — se `content.length === 1` | idem | 3 testes |
| 15.10.5.7 | ⚠️ `addBlockedZones(router): void` — delega aos content | idem | 3 testes |
| 15.10.5.8 | ⚠️ `private addHtmlTooltip(tooltip, query, trigger, hook?)` | idem | 3 testes |
| 15.10.5.9 | Teste: `to_html` com 1 task bar | idem | 1 teste |
| 15.10.5.10 | Teste: `to_html` com milestone | idem | 1 teste |

---

## Bloco E — Chart

### 15.11 — `GanttChart`

**⚠️ RUBY: `reports/GanttChart.rb` (arquivo inteiro — ~330 linhas)**
**🔎 CHEAT: §3 `Array` + `Map`, §12 Categoria B (dedup arrowHeads)**

**Pré-requisitos:** 15.3, 15.9, 15.10, Fase 14 (`TableReport`).

#### 15.11.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.1.1 | Criar `packages/report/src/gantt/gantt-chart.ts` | idem | `deno check` |
| 15.11.1.2 | Constante: `readonly SCROLLBARHEIGHT = 20` | idem | `deno check` |
| 15.11.1.3 | Campos: `start`, `end`, `readonly now`, `readonly weekStartsMonday`, `header`, `width`, `scale` | idem | `deno check` |
| 15.11.1.4 | Campos: `readonly scales` (estático), `table`, `readonly markdate`, `viewWidth`, `private columnDef`, `private height` | idem | `deno check` |
| 15.11.1.5 | Campos: `private lines`, `private router`, `private tasks`, `private depArrows`, `private arrowHeads` | idem | `deno check` |
| 15.11.1.6 | Campo `private completed: boolean` (flag `@completed`) | idem | `deno check` |
| 15.11.1.7 | Constructor `(now, weekStartsMonday, columnDef, table = null, markdate = null)` | idem | 3 testes |

#### 15.11.2 — Escalas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.2.1 | ⚠️ `SCALES` com 6 entradas: `hour`, `day`, `week`, `month`, `quarter`, `year` | idem | 1 teste (contagem 6) |
| 15.11.2.2 | `hour`: `stepSize = 20`, `stepsToFunc = 'hoursTo'`, `minTimeOff = 300` | idem | `deno check` |
| 15.11.2.3 | `day`: `stepSize = 20`, `daysTo`, `21600` | idem | `deno check` |
| 15.11.2.4 | `week`: `stepSize = 20`, `weeksTo`, `86400` | idem | `deno check` |
| 15.11.2.5 | `month`: `stepSize = 35`, `monthsTo`, `432000` | idem | `deno check` |
| 15.11.2.6 | `quarter`: `stepSize = 28`, `quartersTo`, `-1` | idem | `deno check` |
| 15.11.2.7 | `year`: `stepSize = 20`, `yearsTo`, `-1` | idem | `deno check` |
| 15.11.2.8 | ⚠️ `private scaleByName(name): ScaleConfig` | idem | 3 testes |

#### 15.11.3 — Geração

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.3.1 | ⚠️ `generateByWidth(periodStart, periodEnd, width): void` — TODO (placeholder) | idem | 1 teste |
| 15.11.3.2 | ⚠️ `generateByScale(periodStart, periodEnd, scaleName): void` | idem | 1 teste |
| 15.11.3.3 | `start = periodStart`, `end = periodEnd` | idem | 2 testes |
| 15.11.3.4 | ⚠️ `scale = scaleByName(scaleName)` | idem | 2 testes |
| 15.11.3.5 | ⚠️ `steps = start[scale.stepsToFunc](end)` | idem | 3 testes |
| 15.11.3.6 | ⚠️ `width = stepSize * steps` | idem | 2 testes |
| 15.11.3.7 | ⚠️ `header = new GanttHeader(columnDef, this)` | idem | 2 testes |
| 15.11.3.8 | Teste: `generateByScale` com `week` | idem | 1 teste |
| 15.11.3.9 | Teste: `generateByScale` com `day` | idem | 1 teste |
| 15.11.3.10 | Teste: `generateByScale` com `month` | idem | 1 teste |

#### 15.11.4 — `dateToX` + `addLine` + `addTask` + `hasScrollbar`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.4.1 | ⚠️ `dateToX(date): number` — interpolação linear | idem | 4 testes |
| 15.11.4.2 | Teste: `dateToX(start) === 0` | idem | 1 teste |
| 15.11.4.3 | Teste: `dateToX(end) === width` | idem | 1 teste |
| 15.11.4.4 | ⚠️ `addLine(line): void` | idem | 2 testes |
| 15.11.4.5 | ⚠️ `addTask(task, line): void` | idem | 3 testes |
| 15.11.4.6 | ⚠️ `hasScrollbar(): boolean` — `viewWidth !== null && viewWidth < width` | idem | 4 testes |
| 15.11.4.7 | Teste: `hasScrollbar true` | idem | 1 teste |
| 15.11.4.8 | Teste: `hasScrollbar false` | idem | 1 teste |

#### 15.11.5 — `completeChart`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.5.1 | ⚠️ `private completeChart(): void` — se `completed`, retorna (flag) | idem | 2 testes |
| 15.11.5.2 | Calcula `height` | idem | 2 testes |
| 15.11.5.3 | ⚠️ Cria `GanttRouter` | idem | 1 teste |
| 15.11.5.4 | ⚠️ Adiciona zonas bloqueadas de cada line (`line.addBlockedZones`) | idem | 3 testes |
| 15.11.5.5 | ⚠️ Adiciona `nowLineX` e `markdateLineX` | idem | 2 testes |
| 15.11.5.6 | ⚠️ Gera setas de dependência (`generateDepLines`) | idem | 3 testes |
| 15.11.5.7 | ⚠️ Deduplica `arrowHeads` | idem | 3 testes |
| 15.11.5.8 | Marca `completed = true` | idem | 1 teste |

#### 15.11.6 — Dependency lines

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.6.1 | ⚠️ `private generateDepLines(task, lines): void` | idem | 3 testes |
| 15.11.6.2 | ⚠️ `private generateTaskDepLines(kind, task, scIdx, lineIndex, startX, startY): void` | idem | 4 testes |
| 15.11.6.3 | Teste: task com 1 dependência | idem | 1 teste |
| 15.11.6.4 | Teste: task com 3 dependências | idem | 1 teste |

#### 15.11.7 — `to_html` + `to_csv`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.11.7.1 | ⚠️ `to_html(): XMLElementLike` — chama `completeChart()` primeiro | idem | 2 testes |
| 15.11.7.2 | `<td rowspan="...">` | idem | 2 testes |
| 15.11.7.3 | `<div class="tabback" style="overflow:auto;...">` | idem | 2 testes |
| 15.11.7.4 | `<div style="position:absolute;...">` | idem | 2 testes |
| 15.11.7.5 | Append header + lines + arrows + arrowHeads | idem | 3 testes |
| 15.11.7.6 | ⚠️ `to_csv(csv, startColumn): number` → retorna `0` | idem | 2 testes |
| 15.11.7.7 | Teste: `to_html` com 1 task | idem | 1 teste |
| 15.11.7.8 | Teste: `to_html` com 3 tasks e dependências | idem | 1 teste |
| 15.11.7.9 | Teste: `to_html` com milestone | idem | 1 teste |
| 15.11.7.10 | Teste: `to_html` com container | idem | 1 teste |

---

## Bloco F — Integração

### 15.12 — Integração com `TaskReport` e `ResourceReport`

**⚠️ Contexto:** conectar `GanttChart` com `TableReport` (Fase 14).

**Pré-requisitos:** 15.11, Fase 14 (`TaskListRE`, `ResourceListRE`, `TableReport`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.12.1 | Criar `packages/report/tests/gantt/integration_test.ts` | idem | `deno check` |
| 15.12.2 | ⚠️ `TaskReport` com coluna `chart`: `columnDef.id === 'chart'` → `GanttChart` no header | idem | 3 testes |
| 15.12.3 | ⚠️ `generateTableCell` cria `GanttLine` para cada task | idem | 4 testes |
| 15.12.4 | `to_html()` retorna HTML completo com barras e setas | idem | 3 testes |
| 15.12.5 | ⚠️ `ResourceReport` com coluna `chart`: idem, mas `GanttLine` gera `GanttLoadStack` | idem | 4 testes |
| 15.12.6 | ⚠️ `rollupTask` esconde children | idem | 2 testes |
| 15.12.7 | ⚠️ `milestone` gera losango | idem | 2 testes |
| 15.12.8 | ⚠️ Nested resources geram load stacks | idem | 3 testes |
| 15.12.9 | Teste: `taskreport` com 1 task | idem | 1 teste |
| 15.12.10 | Teste: `taskreport` com cadeia de 3 tasks e dependências | idem | 1 teste |

---

## Bloco G — Golden tests

### 15.13 — Golden tests (Gantt)

**⚠️ RUBY: 9 MWEs com `chart` column**
**Usa:** `tj3` real

**Pré-requisitos:** 15.12, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 15.13.1 | Atualizar `scripts/golden/README.md` com seção de `gantt` | idem | existe |
| 15.13.2 | Criar `scripts/golden/gantt-mwe001.rb` a `gantt-mwe009.rb` (9 scripts) — roda `tj3`, extrai `chartcell` do HTML | idem | 9 arquivos |
| 15.13.3 | Normaliza (remove whitespace, ordena atributos) | idem | 2 testes |
| 15.13.4 | Serializa `{ taskBars: [...], milestones: [...], containers: [...], depArrows: [...] }` | idem | JSON válido |
| 15.13.5 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 15.13.6 | Criar `packages/report/tests/golden/gantt_golden_test.ts` | idem | verde |
| 15.13.7 | Para cada caso: constrói `Project`, gera Gantt | idem | ≥ 30 casos |
| 15.13.8 | Comparação com tolerância de 1px em posições X/Y | idem | 3 testes |
| 15.13.9 | Verifica: número de task bars, posições X, número de setas, Y de cada linha | idem | 4 testes |
| 15.13.10 | Cobertura ≥ 30 casos; commitar JSON em `packages/report/tests/golden/` | idem | versionado |

---

## Bloco H — Verificação final

### 15.14 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 15.14.1 | `deno task check-all` verde | exit 0 |
| 15.14.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 15.14.3 | `grep -rE "(svg\|canvas)" packages/report/src/gantt/` retorna 0 (HTML puro) | grep |
| 15.14.4 | ADR 027 criada e commitada | git log |
| 15.14.5 | `HTMLGraphics`, `CollisionDetector`, `GanttRouter`, `GanttChart`, `GanttHeader`, `GanttLine`, `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack` exportados em `packages/report/mod.ts` | `deno check` |
| 15.14.6 | `tests/integration/smoke_after_phase_15_test.ts` — cria `Project`, gera `TaskReport` com coluna `chart`; verifica Fase 14 (reports HTML) | 1 teste |
| 15.14.7 | Auditoria: cada subfase do plano `fase-15-gantt.md` tem tarefas correspondentes | grep |
| 15.14.8 | Corrigir numeração em `fase-15-gantt.md` (`### 19.X` → `### 15.X`, `ADR 025` → `ADR 027`) | grep |

---

## Notas para a IA

1. **Ordem:** 15.0 → 15.1 → 15.2 → 15.3 → 15.4 → 15.5 → 15.6 → 15.7 → 15.8 → 15.9 → 15.10 → 15.11 → 15.12 → 15.13 → 15.14.
2. **`GanttRouter` é o algoritmo mais complexo.** Replicar fielmente.
3. **Ordem de `routeLines`** importa. Bucket de 5 graus.
4. **`placeLine` clampa** para `[0, max]`.
5. **`completeChart` é lazy.** Só em `to_html`.
6. **`arrowHeads` deduplicadas.** Único por endpoint.
7. **`GanttLine.y`** inclui `chart.header.height + 1`.
8. **`generateTask`** distingue 4 casos: leaf, milestone, container, rollup.
9. **`generateResource`** distingue 2 casos: simples, nested em task.
10. **`timeOffZones`** com `minTimeOff` da escala.
11. **`nowLine`** em `chart.now`; **`markdateLine`** em `chart.markdate`.
12. **`addBlockedZones`** de cada content é chamado em `completeChart`.
13. **`to_csv` retorna 0.** Gantt não vai para CSV.
14. **Sem `any`.** Use `unknown` + type guards.
15. **Commit por subfase.** `feat(report): gantt-chart`, etc.
16. **Nunca expandir `GanttRouter` para diagonal.** Ortogonal é decisão.
17. **ADR 027** (não 025). **ADR 025** é Markdown (Fase 13), **ADR 026** é reports (Fase 14).
18. **`SCALES` estático com 6 entradas.**
19. **`completed` flag** evita duplicação em `completeChart`.
20. **`GanttLoadStack`** tem `drawFrame = true` se algum `category === null && value > 0`.
21. **`HTMLGraphics.lineToHTML`** lança se coordenadas são diagonais.
22. **Coordenas em pixels inteiros** via `Math.round`.
23. **`GanttChart.to_html`** retorna `XMLElementLike` (Fase 14).
24. **Golden tests com `tj3`** normalizam HTML.
25. **`addBlockedZones`** deve ser chamado em `completeChart` para todas as lines.

---

## Notas específicas por subfase

### 15.0 — ADR 027

- **HTML+CSS puro. Sem SVG/Canvas.**

### 15.1 — HTMLGraphics

- **5 helpers de `<div>` com `position: absolute`.**
- **Coordenadas em pixels.**

### 15.2 — CollisionDetector

- **Array de segmentos por linha.**
- **Binary search em `collision?`.**

### 15.3 — GanttRouter

- **Algoritmo greedy ordenado.**
- **Bucket de 5 graus.**
- **Rota direta (2 pontos) vs complexa (6 pontos).**
- **`placeLine` clampa.**

### 15.4–15.7 — Content

- **`GanttTaskBar` com 4 pontos de conexão.**
- **`GanttMilestone` com losango.**
- **`GanttContainer` com jags.**
- **`GanttLoadStack` com pilha.**

### 15.8–15.9 — Header

- **2 níveis de escala.**
- **Por escala (`hour`, `day`, `week`, `month`, `quarter`, `year`).**

### 15.10 — GanttLine

- **`scopeProperty` distingue 4 casos de task + 2 de resource.**
- **`timeOffZones` com `minTimeOff`.**
- **`nowLine` + `markdateLine`.**

### 15.11 — GanttChart

- **`completeChart` lazy.**
- **`SCALES` estático.**
- **`to_html` retorna `XMLElementLike`.**

### 15.12 — Integração

- **Coluna `chart` de `TaskReport` e `ResourceReport`.**

### 15.13 — Golden tests

- **9 MWEs.**
- **~30 casos.**
- **Tolerância de 1px.**

### 15.14 — Verificação

- **Sem SVG/Canvas.**
- **ADR 027.**

---

**Fim do arquivo de tarefas da Fase 15.**