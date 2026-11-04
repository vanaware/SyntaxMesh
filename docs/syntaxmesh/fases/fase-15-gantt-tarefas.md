# Fase 15 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-15-gantt-tarefas.md` **Plano:**
> `docs/syntaxmesh/fases/fase-15-gantt.md` **Status:** 🟡 Em andamento
> **Total:** ~210 tarefas **Concluídas:** 201 (15.0–15.12) **Fonte Ruby:**
> `docs/taskjuggler/lib/taskjuggler/reports/{GanttChart,GanttHeader,GanttHeaderScaleItem,GanttLine,GanttTaskBar,GanttMilestone,GanttContainer,GanttLoadStack,GanttRouter,CollisionDetector,HTMLGraphics}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e
   categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

A ordem **dentro** da fase importa:

1. **Bloco A (utilitários)** primeiro — `HTMLGraphics`, `CollisionDetector`,
   `GanttRouter`.
2. **Bloco B (content)** — `GanttTaskBar`, `GanttMilestone`, `GanttContainer`,
   `GanttLoadStack`.
3. **Bloco C (header)** — `GanttHeaderScaleItem`, `GanttHeader`.
4. **Bloco D (line)** — `GanttLine` (integra todos).
5. **Bloco E (chart)** — `GanttChart` (orquestrador).
6. **Bloco F (integração)** — `TaskReport` e `ResourceReport`.
7. **Bloco G (golden)** — validação end-to-end.
8. **Bloco H (verificação)** — fecha a fase.

### ADRs relevantes

- **ADR 009** — RichText mantido, Markdown futuro.
- **ADR 011–024** — Fases 2–11 (contexto; 011 = port fiel, regra zero).
- **ADR 025** — RichText e function handlers (Fase 12).
- **ADR 026** — Markdown going-forward (Fase 13).
- **ADR 027** — Reports no browser: retorno de strings (Fase 14) — base do
  `XMLElementLike`/`SpecialCell` usado pelo Gantt.
- **ADR 028** — Gantt HTML+CSS (**criado nesta fase**; linha já reservada em
  `decisoes/README.md` com status `Proposto`).
- **ADR 032** — Gate de fase e **política de stubs** (`check:stubs`): os 2 stubs
  `Ancorado: Fase 16` da coluna `chart` desaparecem com o port.

### Joints TypeScript já existentes (verificado no código — não reimplementar)

| Necessidade                                                                   | Onde (TS)                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `XMLElementLike` / `SimpleXMLElement`                                         | `packages/core/src/richtext/xml-like.ts`               |
| Interface `SpecialCell` (`to_html`/`to_csv`)                                  | `packages/core/src/reports/report-table-cell.ts`       |
| `TableColumnDefinition` (`scale='week'`, `width`, `tooltip`)                  | `packages/core/src/reports/table-column-definition.ts` |
| `ReportTable.headerLineHeight=19`, `equiLines`; `ReportTableColumn.scrollbar` | `packages/core/src/reports/`                           |
| `ReportTableLegend.addGanttItem`/`showGanttItems`                             | `packages/core/src/reports/report-table-legend.ts`     |
| `Query` (`property`, `scopeProperty`, `scenarioIdx`, `start/end`)             | `packages/core/src/query/query.ts`                     |
| `TjTime.hoursTo…yearsTo`, `beginOf*`, `sameTimeNext*`, `midnight`             | `packages/core/src/time/tj-time.ts` ✅ confirmados     |
| `collectTimeOffIntervals`, `getEffectiveWork/FreeWork`, `dateToIdx`           | `packages/core/src/model/` ✅ confirmados              |
| Stubs a substituir: `case "chart"` (~491 e ~820)                              | `packages/core/src/reports/table-report.ts`            |
| Pipeline `deno task golden:generate` + `generate_golden.ts`                   | `packages/core/tests/golden/`                          |

### Convenções CRÍTICAS

- **Gantt é HTML + CSS puro.** Sem SVG, sem Canvas.
- **ADR 028** (não 026/027): a linha `028 | Gantt HTML+CSS | Proposto` já está
  reservada na tabela de ADRs.
- **Os 2 stubs `NotYetImplementedError("16")` em `table-report.ts`** (caso
  `chart` de `generateHeaderCell` e `generateTableCell`) são substituídos pelo
  port real; âncoras `// Ancorado: Fase 16` removidas junto.
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
[x] 15.0  ADR 028 (Gantt HTML+CSS)                 —   5/5
[x] 15.1  HTMLGraphics                             —  12/12
[x] 15.2  CollisionDetector                        —  16/16
[x] 15.3  GanttRouter                              —  22/22
[x] 15.4  GanttTaskBar                             —  12/12
[x] 15.5  GanttMilestone                           —   8/8
[x] 15.6  GanttContainer                           —  10/10
[x] 15.7  GanttLoadStack                           —  12/12
[x] 15.8  GanttHeaderScaleItem                     —   6/6
[x] 15.9  GanttHeader                              —  26/26
[x] 15.10 GanttLine                                —  20/20 (+9 `it` de modelo)
[x] 15.11 GanttChart                               —  29/24
[x] 15.12 Integração TaskReport/ResourceReport     —  14/14
[ ] 15.13 Golden tests (Gantt)                     —   0/10
[ ] 15.14 Verificação final                        —   0/8
────────────────────────────────────────────────────────
TOTAL: ~210
```

---

## Bloco A — Fundação

### 15.0 — ADR 028 (Gantt HTML+CSS)

**Objetivo:** formalizar a decisão de manter HTML+CSS (não SVG/Canvas).

**⚠️ Nota:** o plano original usava `ADR 026`; o número correto é **ADR 028** —
025 é RichText handlers (Fase 12), 026 é Markdown (Fase 13), 027 é reports
browser (Fase 14). A linha `028 | Gantt HTML+CSS | Proposto | —` **já existe
reservada** em `decisoes/README.md`; basta criar o arquivo e virar o status.

| #      | Tarefa                                                                                                                   | Arquivos | Verificação     |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | -------- | --------------- |
| 15.0.1 | Criar `docs/syntaxmesh/decisoes/028-gantt-html-css.md` seguindo o formato dos ADRs vizinhos                              | idem     | arquivo existe  |
| 15.0.2 | Seção **Contexto:** TJ usa HTML+CSS; alternativas SVG/Canvas                                                             | idem     | —               |
| 15.0.3 | Seção **Decisão:** manter HTML+CSS (fidelidade ao TJ)                                                                    | idem     | —               |
| 15.0.4 | **Alternativas** (SVG via Painter, Canvas) + **Consequências** (interativo + testável; muitos `<div>` em charts grandes) | idem     | —               |
| 15.0.5 | Atualizar status da linha `028` em `decisoes/README.md` para `Aceito` + data                                             | idem     | tabela coerente |

#### Evidências 15.0.1–15.0.5 (preenchido 2026-11-03)

| #      | Entrega                                                                                  | Evidência          |
| ------ | ---------------------------------------------------------------------------------------- | ------------------ |
| 15.0.1 | `028-gantt-html-css.md` criado no formato dos ADRs vizinhos (Status/Data/Autores)        | arquivo versionado |
| 15.0.2 | Contexto: como o TJ desenha (HTMLGraphics/div absolutos) + alternativas SVG/Canvas       | §Contexto          |
| 15.0.3 | Decisão: HTML+CSS puro, pixels inteiros, `SpecialCell`, tooltip sem JS, router ortogonal | §Decisão           |
| 15.0.4 | Consequências positivas/negativas + nota de numeração (026/027 já consumidos)            | §Consequências     |
| 15.0.5 | `decisoes/README.md` linha 028 → `Aceito` em 2026-11-03                                  | ler a tabela       |

---

### 15.1 — `HTMLGraphics`

**⚠️ RUBY: `reports/HTMLGraphics.rb` (arquivo inteiro — ~110 linhas)** **🔎
CHEAT: §3 `to_i` → `Math.floor`, §5 strings**

**Pré-requisitos:** Fase 14 (`XMLElementLike`).

| #       | Tarefa                                                                                                                                                         | Arquivos | Verificação  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.1.1  | Criar `packages/core/src/gantt/html-graphics.ts`                                                                                                               | idem     | `deno check` |
| 15.1.2  | ⚠️ `lineToHTML(xs, ys, xe, ye, category): XMLElementLike` — se `ys === ye`: horizontal; se `xs === xe`: vertical; senão, `throw Error('diagonal line')`        | idem     | 5 testes     |
| 15.1.3  | `lineToHTML` — troca `xs`/`xe` se `xs > xe`; idem `ys`/`ye`                                                                                                    | idem     | 3 testes     |
| 15.1.4  | Teste: `<div class="foo" style="left:10px; top:20px; width:41px; height:1px;"></div>`                                                                          | idem     | 1 teste      |
| 15.1.5  | ⚠️ `rectToHTML(x, y, w, h, category): XMLElementLike`                                                                                                          | idem     | 3 testes     |
| 15.1.6  | ⚠️ `jagToHTML(x, y): XMLElementLike` — `<div class="tj_gantt_jag" style="left:x-5px; top:y;">`                                                                 | idem     | 3 testes     |
| 15.1.7  | ⚠️ `diamondToHTML(x, y): XMLElementLike[]` — `tj_diamond_top` + `tj_diamond_bottom`                                                                            | idem     | 3 testes     |
| 15.1.8  | ⚠️ `arrowHeadToHTML(x, y): XMLElementLike` — `<div class="tj_arrow_head" style="left:x-5px; top:y-5px;">`                                                      | idem     | 3 testes     |
| 15.1.9  | Teste: `lineToHTML` com coordenadas iguais (0 comprimento)                                                                                                     | idem     | 1 teste      |
| 15.1.10 | Teste: `lineToHTML` com coordenadas negativas                                                                                                                  | idem     | 1 teste      |
| 15.1.11 | Teste: `rectToHTML` com width 0                                                                                                                                | idem     | 1 teste      |
| 15.1.12 | Criar `packages/core/src/gantt/mod.ts` re-exportando os módulos do diretório + export `./gantt/mod.ts` em `packages/core/src/mod.ts` (padrão `reports/mod.ts`) | idem     | `deno check` |

#### Evidências 15.1.1–15.1.12 (preenchido 2026-11-03)

| #              | Entrega                                                                                                                                                           | Evidência                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 15.1.1–15.1.8  | `src/gantt/html-graphics.ts`: `lineToHTML`, `rectToHTML`, `jagToHTML`, `diamondToHTML`, `arrowHeadToHTML` fiéis ao Ruby (`Math.trunc` = `to_i`, offsets -5/-6/-7) | `tests/gantt/html-graphics_test.ts` |
| 15.1.2–15.1.3  | Horizontal/vertical com troca de coordenadas invertidas; diagonal lança `Can't draw diagonal line …`                                                              | 5 testes                            |
| 15.1.4         | `lineToHTML(10,20,50,20)` → `left:10px; top:20px; width:41px; height:1px;`                                                                                        | 1 teste                             |
| 15.1.5–15.1.8  | `rectToHTML` (trunc), `jagToHTML` (-5px), `diamondToHTML` (2 divs, top -7px), `arrowHeadToHTML` (-5px/-5px)                                                       | 3+3+3+2 testes                      |
| 15.1.9–15.1.11 | Casos de borda: linha de comprimento zero, coordenadas negativas, rect 0×0                                                                                        | 3 testes                            |
| 15.1.12        | `gantt/mod.ts` + `export * from "./gantt/mod.ts"` em `src/mod.ts`                                                                                                 | `deno check` OK                     |
| Verificação    | `deno test` do arquivo: **22 steps / 0 falhas**; `deno lint` limpo; `deno fmt` aplicado                                                                           | terminal                            |

---

### 15.2 — `CollisionDetector`

**⚠️ RUBY: `reports/CollisionDetector.rb` (arquivo inteiro — ~180 linhas)** **🔎
CHEAT: §3 `Array` de `Array`, §12 Categoria B (binary search)**

**Pré-requisitos:** 15.1.

#### 15.2.1 — Estrutura

| #        | Tarefa                                                                                                    | Arquivos | Verificação  |
| -------- | --------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.2.1.1 | Criar `packages/core/src/gantt/collision-detector.ts` com `class CollisionDetector`                       | idem     | `deno check` |
| 15.2.1.2 | Campos: `private width`, `private height`, `private hLines: number[][][]`, `private vLines: number[][][]` | idem     | `deno check` |
| 15.2.1.3 | Constructor `(width, height)`                                                                             | idem     | 2 testes     |

#### 15.2.2 — `addBlockedZone`

| #        | Tarefa                                                                                         | Arquivos | Verificação |
| -------- | ---------------------------------------------------------------------------------------------- | -------- | ----------- |
| 15.2.2.1 | ⚠️ `addBlockedZone(x, y, w, h, horiz, vert): void` — clip para `[0, width-1]`, `[0, height-1]` | idem     | 3 testes    |
| 15.2.2.2 | ⚠️ Se `horiz`: para cada linha de `y` a `y+h-1`, `addSegment(hLines[i], [x, x+w-1])`           | idem     | 3 testes    |
| 15.2.2.3 | ⚠️ Se `vert`: para cada coluna de `x` a `x+w-1`, `addSegment(vLines[i], [y, y+h-1])`           | idem     | 3 testes    |
| 15.2.2.4 | Teste: `addBlockedZone(10, 20, 30, 5, true, false)` — apenas horizontal                        | idem     | 1 teste     |
| 15.2.2.5 | Teste: `addBlockedZone(10, 20, 30, 5, false, true)` — apenas vertical                          | idem     | 1 teste     |
| 15.2.2.6 | Teste: `addBlockedZone(10, 20, 30, 5, true, true)` — ambos                                     | idem     | 1 teste     |

#### 15.2.3 — `collision?`

| #        | Tarefa                                                             | Arquivos | Verificação |
| -------- | ------------------------------------------------------------------ | -------- | ----------- |
| 15.2.3.1 | ⚠️ `collision?(pos, segment, horizontal): boolean` — binary search | idem     | 3 testes    |
| 15.2.3.2 | Teste: colisão horizontal                                          | idem     | 1 teste     |
| 15.2.3.3 | Teste: colisão vertical                                            | idem     | 1 teste     |
| 15.2.3.4 | Teste: sem colisão                                                 | idem     | 1 teste     |
| 15.2.3.5 | Teste: colisão em limite (start/end do segmento)                   | idem     | 2 testes    |

#### 15.2.4 — Helpers privados

| #        | Tarefa                                                                       | Arquivos | Verificação  |
| -------- | ---------------------------------------------------------------------------- | -------- | ------------ |
| 15.2.4.1 | ⚠️ `private clip(v, max)`                                                    | idem     | 2 testes     |
| 15.2.4.2 | ⚠️ `private addSegment(line, newSegment)` — merge com sobrepostos/adjacentes | idem     | 4 testes     |
| 15.2.4.3 | ⚠️ `private overlaps?(s1, s2)`                                               | idem     | 3 testes     |
| 15.2.4.4 | ⚠️ `private mergeable?(s1, s2)`                                              | idem     | 4 testes     |
| 15.2.4.5 | ⚠️ `private merge(dst, seg)`                                                 | idem     | 2 testes     |
| 15.2.4.6 | Re-exportar em `packages/core/src/mod.ts`                                    | idem     | `deno check` |

#### Evidências 15.2.1.1–15.2.4.6 (preenchido 2026-11-03)

| #                 | Entrega                                                                                                                                                                        | Evidência                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| 15.2.1.1–15.2.1.3 | `src/gantt/collision-detector.ts`: `CollisionDetector(width, height)` com `hLines` (height linhas) e `vLines` (width colunas)                                                  | 2 testes de constructor     |
| 15.2.2.1–15.2.2.3 | `addBlockedZone` com clip fiel ao Ruby (`clip(v, max)` — negativo→0, acima→max, **sem** encolher `w`/`h`); laços `y..y+h-1` (horiz) e `x..x+w-1` (vert); zona vazia ignorada   | 6 testes                    |
| 15.2.2.4–15.2.2.6 | `horiz=true` bloqueia só `hLines`; `vert=true` só `vLines`; ambos bloqueiam os dois                                                                                            | 3 testes                    |
| 15.2.3.1–15.2.3.5 | `collision(pos, segment, horizontal)` com busca binária + `overlaps` inclusivo nas pontas; `pos` fora da área → `false` (robustez sobre o Ruby, que estouraria)                | 8 testes                    |
| 15.2.4.1–15.2.4.5 | `clip`, `addSegment` (merge + inserção ordenada + `next` no mesmo índice), `overlaps`, `mergeable` (adjacência ±1), `merge` (estende dst)                                      | 6 testes de merge/ordenação |
| 15.2.4.6          | `gantt/mod.ts` exporta `collision-detector.ts`; `src/mod.ts` já reexporta `./gantt/mod.ts`                                                                                     | `deno check` OK             |
| Verificação       | `deno test`: **23 steps / 0 falhas**; `deno lint` limpo; `deno fmt --check` limpo                                                                                              | terminal                    |
| Correção de teste | 3 asserções iniciais erradas (usavam `vert` onde o observável é `horiz`, e assumiam que o clip negativo encolhe `w`); Ruby relido e testes alinhados ao `CollisionDetector.rb` | diff do teste               |

---

### 15.3 — `GanttRouter`

**⚠️ RUBY: `reports/GanttRouter.rb` (arquivo inteiro — ~230 linhas)** **🔎
CHEAT: §6 `Math.sqrt`, §12 Categoria B (bucket sort de 5 graus)**

**Pré-requisitos:** 15.2.

#### 15.3.1 — Estrutura

| #        | Tarefa                                                                           | Arquivos | Verificação  |
| -------- | -------------------------------------------------------------------------------- | -------- | ------------ |
| 15.3.1.1 | Criar `packages/core/src/gantt/gantt-router.ts`                                  | idem     | `deno check` |
| 15.3.1.2 | Constantes: `MinStartGap = 5`, `MinEndGap = 10`                                  | idem     | `deno check` |
| 15.3.1.3 | Campos: `private width`, `private height`, `private detector: CollisionDetector` | idem     | `deno check` |
| 15.3.1.4 | Constructor `(width, height)` — cria `CollisionDetector` interno                 | idem     | 2 testes     |

#### 15.3.2 — Zonas

| #        | Tarefa                                                                              | Arquivos | Verificação |
| -------- | ----------------------------------------------------------------------------------- | -------- | ----------- |
| 15.3.2.1 | ⚠️ `addZone(x, y, w, h, horiz, vert): void` — delega para `detector.addBlockedZone` | idem     | 3 testes    |

#### 15.3.3 — `routeLines`

| #         | Tarefa                                                                                           | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------------------------------------ | -------- | ----------- |
| 15.3.3.1  | ⚠️ `routeLines(fromToPoints: [number, number, number, number, number?][]): [number, number][][]` | idem     | 1 teste     |
| 15.3.3.2  | Converte para `{ startX, startY, endX, endY, id }[]`                                             | idem     | 2 testes    |
| 15.3.3.3  | ⚠️ Calcula `adjLeg = (endX - MinEndGap) - (startX + MinStartGap)`                                | idem     | 2 testes    |
| 15.3.3.4  | ⚠️ `oppLeg = \|startY - endY\|`; `distance = sqrt(adjLeg² + oppLeg²)`                            | idem     | 2 testes    |
| 15.3.3.5  | ⚠️ `sinus = \|oppLeg\| / distance`; `angle` (0-90)                                               | idem     | 3 testes    |
| 15.3.3.6  | ⚠️ Ordena por ângulo (bucket de 5), depois distância                                             | idem     | 4 testes    |
| 15.3.3.7  | Para cada seta, `route(startX, startY, endX, endY)`                                              | idem     | 1 teste     |
| 15.3.3.8  | Teste: múltiplas setas ordenadas                                                                 | idem     | 1 teste     |
| 15.3.3.9  | Teste: mesma seta em posições diferentes                                                         | idem     | 1 teste     |
| 15.3.3.10 | Teste: `routeLines` com 0 setas                                                                  | idem     | 1 teste     |
| 15.3.3.11 | Teste: `routeLines` com 1 seta                                                                   | idem     | 1 teste     |
| 15.3.3.12 | Teste: `routeLines` com 5 setas                                                                  | idem     | 1 teste     |

#### 15.3.4 — `route` (rota direta vs complexa)

| #        | Tarefa                                                                                                             | Arquivos | Verificação |
| -------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| 15.3.4.1 | ⚠️ `route(startX, startY, endX, endY): [number, number][]`                                                         | idem     | 1 teste     |
| 15.3.4.2 | ⚠️ Se `endX - startX > startGap + endGap + 2`: `xSeg = placeLine([startY ± 1, endY], false, startX + startGap, 1)` | idem     | 3 testes    |
| 15.3.4.3 | ⚠️ Se `xSeg && xSeg < endX - endGap`: rota direta (2 pontos)                                                       | idem     | 4 testes    |
| 15.3.4.4 | ⚠️ Senão, rota complexa: `ySeg = placeLine([0, width-1], true, startY + 2*deltaY, deltaY)`                         | idem     | 3 testes    |
| 15.3.4.5 | ⚠️ `x1 = placeLine([startY + deltaY, ySeg], false, startX + startGap, 1)`                                          | idem     | 3 testes    |
| 15.3.4.6 | ⚠️ `x2 = placeLine([ySeg + deltaY, endY], false, endX - endGap, -1)`                                               | idem     | 3 testes    |
| 15.3.4.7 | Retorna `[[startX, startY], [x1, startY], [x1, ySeg], [x2, ySeg], [x2, endY], [endX, endY]]`                       | idem     | 2 testes    |

#### 15.3.5 — Helpers privados

| #        | Tarefa                                                                                                                                                            | Arquivos | Verificação  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.3.5.1 | ⚠️ `private placeLine(segment, horizontal, start, delta): number` — `pos = clip(start, [0, max])`; enquanto `collision(pos, segment, horizontal)`: `pos += delta` | idem     | 4 testes     |
| 15.3.5.2 | Teste: `placeLine` clampa                                                                                                                                         | idem     | 2 testes     |
| 15.3.5.3 | ⚠️ `private addLineTo(points, x2, y2): void` — bloqueia zona 2px                                                                                                  | idem     | 3 testes     |
| 15.3.5.4 | ⚠️ `private justify(x, y, w, h): [number, number, number, number]`                                                                                                | idem     | 2 testes     |
| 15.3.5.5 | Re-exportar em `packages/core/src/mod.ts`                                                                                                                         | idem     | `deno check` |

#### Evidências 15.3.1.1–15.3.5.5 (preenchido 2026-11-03)

| #                  | Entrega                                                                                                                                                                                               | Evidência                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 15.3.1.1–15.3.1.4  | `src/gantt/gantt-router.ts`: `MinStartGap=5`, `MinEndGap=10`, `width`/`height` truncados (`to_i`) e `CollisionDetector` interno                                                                       | 3 testes                                 |
| 15.3.2.1           | `addZone` delega para `detector.addBlockedZone`                                                                                                                                                       | 1 teste (30 linhas brancas p/ zona 30×5) |
| 15.3.3.1–15.3.3.6  | `routeLines` converte tuplas, calcula `adjLeg`/`oppLeg`/`distance`/`angle` (graus 0–90) e ordena **decrescente** por ângulo em buckets de 5°, com distância decrescente no empate (Ruby `-(a <=> b)`) | teste de ordenação + 5 setas             |
| 15.3.3.7–15.3.3.12 | Roteia na ordem ordenada (não na de entrada); 0/1/5 setas verificadas com início, fim e ortogonalidade                                                                                                | 4 testes                                 |
| 15.3.4.1–15.3.4.7  | `route`: direta em 3 pontos quando `endX-startX > 17` e `xSeg < endX-10`; senão complexa em 6 pontos (`ySeg`→`x1`→`x2`); `startY === endY` duplica o ponto 1 (fiel ao Ruby)                           | 8 testes                                 |
| 15.3.5.1–15.3.5.2  | `placeLine`: `trunc`, clamp `[0, max]`, `segment.sort!`, avanço por `delta` com `break` nas bordas (propaga `-1` como o Ruby)                                                                         | 4 testes                                 |
| 15.3.5.3           | `addLineTo` marca zona de 5px de espessura (±2px) e retorna cedo fora da área                                                                                                                         | coberto via `to_html`                    |
| 15.3.5.4           | `justify` exportado e testado nos 3 casos (w negativo, h negativo, já positivo)                                                                                                                       | 3 testes                                 |
| 15.3.5.5           | `gantt/mod.ts` exporta `gantt-router.ts`                                                                                                                                                              | `deno check` OK                          |
| Bugs categorizados | **A**: `asin(PI/2 - sinus)` com clamp; `raise "Routing failed"` inalcançável. **B**: ramo horizontal de `addLineTo` testa `x1 >= @height` → replicado sob `compat.keepRubyBugs` (teste nos 2 modos)   | cheat-sheet §12 atualizado               |
| Verificação        | `deno test tests/gantt/`: **3 arquivos / 77 steps / 0 falhas**; `deno check` OK; `deno lint` limpo; `deno fmt` aplicado                                                                               | terminal                                 |

---

## Bloco B — Content

### 15.4 — `GanttTaskBar`

**⚠️ RUBY: `reports/GanttTaskBar.rb` (arquivo inteiro — ~120 linhas)**

**Pré-requisitos:** 15.1, Fase 14 (`ReportTable`), Fase 11 (`Query`).

| #       | Tarefa                                                                                     | Arquivos | Verificação  |
| ------- | ------------------------------------------------------------------------------------------ | -------- | ------------ |
| 15.4.1  | Criar `packages/core/src/gantt/gantt-task-bar.ts`                                          | idem     | `deno check` |
| 15.4.2  | Constante: `static readonly SIZE = 6` (half-height da barra)                               | idem     | `deno check` |
| 15.4.3  | Campos: `private query`, `private lineHeight`, `private start`, `private end`, `private y` | idem     | `deno check` |
| 15.4.4  | Constructor `(query, lineHeight, xStart, xEnd, y)`                                         | idem     | 3 testes     |
| 15.4.5  | ⚠️ `startDepLineStart(): [number, number]` → `[start + 1, y + lineHeight/2]`               | idem     | 2 testes     |
| 15.4.6  | ⚠️ `startDepLineEnd(): [number, number]` → `[start - 1, y + lineHeight/2]`                 | idem     | 2 testes     |
| 15.4.7  | ⚠️ `endDepLineStart(): [number, number]` → `[end + 1, y + lineHeight/2]`                   | idem     | 2 testes     |
| 15.4.8  | ⚠️ `endDepLineEnd(): [number, number]` → `[end - 1, y + lineHeight/2]`                     | idem     | 2 testes     |
| 15.4.9  | ⚠️ `addBlockedZones(router): void` — horizontal block + arrowhead + end caps               | idem     | 4 testes     |
| 15.4.10 | ⚠️ `to_html(): XMLElementLike[]` — frame invisível, frame, fill, progress                  | idem     | 4 testes     |
| 15.4.11 | Teste: `to_html` sem query                                                                 | idem     | 1 teste      |
| 15.4.12 | Teste: `to_html` com query `complete`                                                      | idem     | 1 teste      |

#### Evidências 15.4.1–15.4.12 (preenchido 2026-11-03)

| #               | Entrega                                                                                                                                                                                             | Evidência                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 15.4.1–15.4.4   | `src/gantt/gantt-task-bar.ts`: `static SIZE = 6`, campos privados e constructor `(query, lineHeight, xStart, xEnd, y)`; `GanttBarQuery` é o contrato estrutural (satisfeito por `Query` da Fase 11) | 2 testes                          |
| 15.4.5–15.4.8   | 4 pontos de dependência (`start+1`, `start-1`, `end+1`, `end-1`, todos em `y + trunc(lh/2)`) — sem truncar `start`/`end` (Ruby soma Float)                                                          | 5 testes                          |
| 15.4.9          | `addBlockedZones`: corredor horizontal (`2·SIZE+3`), seta `10×15` (`true,true`), bordas verticais de 5px                                                                                            | 1 teste (17 colunas em `to_html`) |
| 15.4.10–15.4.12 | `to_html`: `tj_gantt_frame` → `taskbarframe` → `taskbar` → `progressbar`; sem query assume 50%; com query lê `complete` e chama `process()` uma vez                                                 | 4 testes                          |

---

### 15.5 — `GanttMilestone`

**⚠️ RUBY: `reports/GanttMilestone.rb` (arquivo inteiro — ~90 linhas)**

**Pré-requisitos:** 15.1.

| #      | Tarefa                                                                                | Arquivos | Verificação  |
| ------ | ------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.5.1 | Criar `packages/core/src/gantt/gantt-milestone.ts`                                    | idem     | `deno check` |
| 15.5.2 | Constante: `static readonly SIZE = 6`                                                 | idem     | `deno check` |
| 15.5.3 | Campos: `private lineHeight`, `private x`, `private y`                                | idem     | `deno check` |
| 15.5.4 | Constructor `(lineHeight, x, y)`                                                      | idem     | 2 testes     |
| 15.5.5 | ⚠️ Dependency points (`startDepLineStart`/`End`, `endDepLineStart`/`End`)             | idem     | 4 testes     |
| 15.5.6 | ⚠️ `addBlockedZones(router): void`                                                    | idem     | 3 testes     |
| 15.5.7 | ⚠️ `to_html(): XMLElementLike[]` — frame invisível + `diamondToHTML(x, lineHeight/2)` | idem     | 3 testes     |
| 15.5.8 | Teste: dependency points                                                              | idem     | 1 teste      |

#### Evidências 15.5.1–15.5.8 (preenchido 2026-11-03)

| #             | Entrega                                                                                                                 | Evidência |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- |
| 15.5.1–15.5.4 | `src/gantt/gantt-milestone.ts`: `static SIZE = 6`, campos `lineHeight`/`x`/`y`, constructor                             | 1 teste   |
| 15.5.5        | 4 pontos: início entra em `x-6`, saídas em `x+6`; **`endDepLineEnd` também em `x+6`** (fiel ao Ruby, `RUBY-COMPAT-DOC`) | 3 testes  |
| 15.5.6        | `addBlockedZones`: losango `17×17` + seta `10×15`, ambos `true,true` → 24 colunas na união                              | 1 teste   |
| 15.5.7–15.5.8 | `to_html`: moldura `lineHeight × lineHeight` + `diamondToHTML(x, trunc(lh/2))` (`tj_diamond_top`/`bottom`)              | 1 teste   |

---

### 15.6 — `GanttContainer`

**⚠️ RUBY: `reports/GanttContainer.rb` (arquivo inteiro — ~100 linhas)**

**Pré-requisitos:** 15.1.

| #       | Tarefa                                                                              | Arquivos | Verificação  |
| ------- | ----------------------------------------------------------------------------------- | -------- | ------------ |
| 15.6.1  | Criar `packages/core/src/gantt/gantt-container.ts`                                  | idem     | `deno check` |
| 15.6.2  | Constante: `static readonly SIZE = 5`                                               | idem     | `deno check` |
| 15.6.3  | Campos: `private lineHeight`, `private start`, `private end`, `private y`           | idem     | `deno check` |
| 15.6.4  | Constructor `(lineHeight, xStart, xEnd, y)`                                         | idem     | 3 testes     |
| 15.6.5  | ⚠️ Dependency points                                                                | idem     | 4 testes     |
| 15.6.6  | ⚠️ `addBlockedZones(router): void`                                                  | idem     | 3 testes     |
| 15.6.7  | ⚠️ `to_html(): XMLElementLike[]` — frame invisível + `containerbar` + 2 `jagToHTML` | idem     | 4 testes     |
| 15.6.8  | Teste: `to_html` com start/end corretos                                             | idem     | 1 teste      |
| 15.6.9  | Teste: jags nas posições corretas                                                   | idem     | 2 testes     |
| 15.6.10 | Re-exportar em `packages/core/src/mod.ts`                                           | idem     | `deno check` |

#### Evidências 15.6.1–15.6.10 (preenchido 2026-11-03)

| #             | Entrega                                                                                                           | Evidência            |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| 15.6.1–15.6.4 | `src/gantt/gantt-container.ts`: `static SIZE = 5`, campos e constructor                                           | 1 teste              |
| 15.6.5        | Pontos: início sai de `start`, entra em `start-5`; fim sai de `end+5`, entra em `end`                             | 4 testes             |
| 15.6.6        | `addBlockedZones`: corredor `(end-start+1+10)×15`, seta `10×15` e duas bordas de 15px                             | 1 teste (33 colunas) |
| 15.6.7–15.6.9 | `to_html`: frame (`width+10`), `containerbar` (altura `SIZE`), jags em `xStart` e `xStart+width` (−5px no `left`) | 2 testes             |
| 15.6.10       | `gantt/mod.ts` exporta as 4 classes de content                                                                    | `deno check` OK      |

---

### 15.7 — `GanttLoadStack`

**⚠️ RUBY: `reports/GanttLoadStack.rb` (arquivo inteiro — ~120 linhas)**

**Pré-requisitos:** 15.1, 15.10 (`GanttLine` — referência circular).

| #       | Tarefa                                                                                            | Arquivos | Verificação  |
| ------- | ------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.7.1  | Criar `packages/core/src/gantt/gantt-load-stack.ts`                                               | idem     | `deno check` |
| 15.7.2  | Campos: `line`, `lineHeight`, `x`, `y`, `w`, `values`, `categories`, `yLevels`, `drawFrame`       | idem     | `deno check` |
| 15.7.3  | ⚠️ Constructor `(line, x, w, values, categories)` — rejeita `values.length !== categories.length` | idem     | 3 testes     |
| 15.7.4  | ⚠️ `drawFrame = true` se algum `category === null && value > 0`                                   | idem     | 3 testes     |
| 15.7.5  | ⚠️ Calcula `yLevels`: `((lineHeight - 4) * v / sum)`                                              | idem     | 3 testes     |
| 15.7.6  | ⚠️ `addBlockedZones(router): void`                                                                | idem     | 3 testes     |
| 15.7.7  | ⚠️ `to_html(): XMLElementLike[] \| null` — se `!yLevels`, retorna `null`                          | idem     | 2 testes     |
| 15.7.8  | Frame ou rect de fundo (`loadstackframe`)                                                         | idem     | 2 testes     |
| 15.7.9  | Barras empilhadas (de baixo para cima)                                                            | idem     | 3 testes     |
| 15.7.10 | Categorias como classes CSS                                                                       | idem     | 2 testes     |
| 15.7.11 | Teste: `valores iguais` — 3 valores idênticos                                                     | idem     | 1 teste      |
| 15.7.12 | Teste: `sum 0 retorna null`                                                                       | idem     | 1 teste      |

#### Evidências 15.7.1–15.7.12 (preenchido 2026-11-03)

| #               | Entrega                                                                                                                                                                                                        | Evidência |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 15.7.1–15.7.3   | `src/gantt/gantt-load-stack.ts`: `LoadStackHost` (interface com `height`/`y`/`lineToHTML`/`rectToHTML`) evita a dependência circular com `GanttLine`; constructor valida `values.length !== categories.length` | 1 teste   |
| 15.7.4          | `drawFrame` quando `category === null && value > 0`; `w <= 0` vira 1px                                                                                                                                         | 3 testes  |
| 15.7.5          | `yLevels[i] = (lineHeight - 4) * v / sum` (divisão real: valores reais são Float)                                                                                                                              | 3 testes  |
| 15.7.6          | `addBlockedZones`: faixa horizontal `(w+4) × lineHeight` — testado via desvio do `ySeg` para 119                                                                                                               | 1 teste   |
| 15.7.7–15.7.10  | `to_html`: `null` com soma 0; moldura de 4 linhas ou rect `loadstackframe`; barras de baixo para cima com `trunc` acumulado                                                                                    | 4 testes  |
| 15.7.11–15.7.12 | Valores iguais (`[1,1]`) e `sum 0 → null`                                                                                                                                                                      | 2 testes  |

> **Nota:** a pendência de referência circular anotada em 15.7.3 foi resolvida
> com a interface `LoadStackHost`; `GanttLine` (15.10) só precisará expor
> `height`, `y`, `lineToHTML`, `rectToHTML`.

---

## Bloco C — Header

### 15.8 — `GanttHeaderScaleItem`

**⚠️ RUBY: `reports/GanttHeaderScaleItem.rb` (arquivo inteiro — ~30 linhas)**

**Pré-requisitos:** 15.1.

| #      | Tarefa                                                                                               | Arquivos | Verificação  |
| ------ | ---------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.8.1 | Criar `packages/core/src/gantt/gantt-header-scale-item.ts`                                           | idem     | `deno check` |
| 15.8.2 | Campos: `label`, `x`, `y`, `width`, `height`                                                         | idem     | `deno check` |
| 15.8.3 | Constructor `(label, x, y, width, height)`                                                           | idem     | 2 testes     |
| 15.8.4 | ⚠️ `to_html(): XMLElementLike` — `<div class="tabhead">` com `<div style="padding:3px;">label</div>` | idem     | 2 testes     |

#### Evidências 15.8.1–15.8.4 (preenchido 2026-11-03)

| #             | Entrega                                                                                                                                                                                                                                                   | Evidência    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15.8.1–15.8.2 | `src/gantt/gantt-header-scale-item.ts`: `label`/`width` `readonly` públicos; `x`/`y`/`height` privados. O `attr_reader :pos` do Ruby é **leitor morto** (`@pos` nunca é atribuído, nenhum consumidor o usa) → omitido, documentado no cabeçalho da classe | `deno check` |
| 15.8.3        | Constructor `(label, x, y, width, height)` sem validação (igual ao Ruby): aceita rótulo vazio e medidas negativas                                                                                                                                         | 2 testes     |
| 15.8.4        | `<div class="tabhead">` com `style` `font-weight:bold; position:absolute; left/top/width/height` (**espaços finais preservados**) e filho `<div style="padding:3px; ">label</div>`; rótulo é filho de texto (escapado: `&amp;`/`&lt;`)                    | 4 testes     |

> **Arquivo de teste:**
> `packages/core/tests/gantt/gantt-header-scale-item_test.ts` — 8 steps Deno / 6
> `it` blocks, verdes.

---

### 15.9 — `GanttHeader`

**⚠️ RUBY: `reports/GanttHeader.rb` (arquivo inteiro — ~180 linhas)**

**Pré-requisitos:** 15.8, 15.11 (`GanttChart` — referência circular), Fase 2
(`TjTime`).

#### 15.9.1 — Estrutura

| #        | Tarefa                                                                                                | Arquivos | Verificação  |
| -------- | ----------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.9.1.1 | Criar `packages/core/src/gantt/gantt-header.ts`                                                       | idem     | `deno check` |
| 15.9.1.2 | Campos: `private columnDef`, `private chart`, `private largeScale`, `private smallScale`              | idem     | `deno check` |
| 15.9.1.3 | Campos: `gridLines: number[]`, `nowLineX`, `markdateLineX`, `cellStartDates: TjTime[]`, `height = 39` | idem     | `deno check` |
| 15.9.1.4 | Constructor `(columnDef, chart)`                                                                      | idem     | 2 testes     |

#### 15.9.2 — `generate` (por escala)

| #        | Tarefa                                                                                                               | Arquivos | Verificação |
| -------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 15.9.2.1 | ⚠️ `private generate(): void` — `h = (height - 1) / 2`                                                               | idem     | 1 teste     |
| 15.9.2.2 | ⚠️ **Scale `hour`:** large = `midnight` + `sameTimeNextDay`; small = `beginOfHour` + `sameTimeNextHour`              | idem     | 3 testes    |
| 15.9.2.3 | ⚠️ **Scale `day`:** large = `beginOfMonth` + `sameTimeNextMonth`; small = `midnight` + `sameTimeNextDay`             | idem     | 3 testes    |
| 15.9.2.4 | ⚠️ **Scale `week`:** large = `beginOfMonth` + `sameTimeNextMonth`; small = `beginOfWeek` + `sameTimeNextWeek`        | idem     | 3 testes    |
| 15.9.2.5 | ⚠️ **Scale `month`:** large = `beginOfYear` + `sameTimeNextYear`; small = `beginOfMonth` + `sameTimeNextMonth`       | idem     | 3 testes    |
| 15.9.2.6 | ⚠️ **Scale `quarter`:** large = `beginOfYear` + `sameTimeNextYear`; small = `beginOfQuarter` + `sameTimeNextQuarter` | idem     | 3 testes    |
| 15.9.2.7 | ⚠️ **Scale `year`:** só small (`beginOfYear` + `sameTimeNextYear`)                                                   | idem     | 2 testes    |
| 15.9.2.8 | Calcula `nowLineX`, `markdateLineX`                                                                                  | idem     | 3 testes    |

#### 15.9.3 — `genHeaderScale` + `to_html`

| #        | Tarefa                                                                              | Arquivos | Verificação  |
| -------- | ----------------------------------------------------------------------------------- | -------- | ------------ |
| 15.9.3.1 | ⚠️ `private genHeaderScale(scale, y, h, beginOfFunc, sameTimeNextFunc, timeformat)` | idem     | 3 testes     |
| 15.9.3.2 | ⚠️ `to_html(): XMLElementLike` — `<div class="tabback">` com large + small          | idem     | 3 testes     |
| 15.9.3.3 | Teste: `height === 39`                                                              | idem     | 1 teste      |
| 15.9.3.4 | Teste: `gridLines.length > 0`                                                       | idem     | 1 teste      |
| 15.9.3.5 | Teste: `cellStartDates` preenchido                                                  | idem     | 1 teste      |
| 15.9.3.6 | Re-exportar em `packages/core/src/mod.ts`                                           | idem     | `deno check` |

#### Evidências 15.9.1–15.9.3 (preenchido 2026-11-03)

| #                 | Entrega                                                                                                                                                                                                                                                                                                    | Evidência    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15.9.1.1–15.9.1.4 | `src/gantt/gantt-header.ts`: `GanttHeaderChart` é uma **interface estrutural** (`start`, `end`, `now`, `markdate`, `weekStartsMonday`, `width`, `scale.name`, `dateToX`) — evita a dependência circular com `GanttChart` (15.11). `height = 39` é mutável porque o chart o ajusta depois de criar o header | 2 testes     |
| 15.9.2.1          | `h = Math.trunc((height - 1) / 2)` → 19px por linha                                                                                                                                                                                                                                                        | 1 teste      |
| 15.9.2.2          | `hour`: large = `midnight`/`sameTimeNextDay` + `'%A %Y-%m-%d'`; small = `beginOfHour`/`sameTimeNextHour` + `'%H'`                                                                                                                                                                                          | 3 testes     |
| 15.9.2.3          | `day`: large = `beginOfMonth`/`sameTimeNextMonth` + `'%b %Y'`; small = `midnight`/`sameTimeNextDay` + `'%d'`                                                                                                                                                                                               | 7 testes     |
| 15.9.2.4          | `week`: large mensal; small = `beginOfWeek(chart.weekStartsMonday)`/`sameTimeNextWeek` + `'%d'` (segunda vs domingo cobertos)                                                                                                                                                                              | 3 testes     |
| 15.9.2.5          | `month`: large = `beginOfYear`/`sameTimeNextYear` + `'%Y'`; small = `beginOfMonth` + `'%b'`                                                                                                                                                                                                                | 2 testes     |
| 15.9.2.6          | `quarter`: large anual; small = `beginOfQuarter`/`sameTimeNextQuarter` + `'Q%Q'`                                                                                                                                                                                                                           | 2 testes     |
| 15.9.2.7          | `year`: só a escala pequena (`beginOfYear`/`sameTimeNextYear`); a grande permanece vazia — ver **Categoria B** abaixo                                                                                                                                                                                      | 2 testes     |
| 15.9.2.8          | `nowLineX = chart.dateToX(chart.now)`; `markdateLineX` só quando `chart.markdate` existe. `dateToX` é **`number`**, não `number \| null`: a fórmula do Ruby é linear e nunca devolve `nil`                                                                                                                 | 4 testes     |
| 15.9.3.1          | `genHeaderScale`: itera `t < chart.end`, `xR = trunc(dateToX(next)) - 1` (1px de borda), empilha `GanttHeaderScaleItem`, e o push final de `cellStartDates` só na escala pequena                                                                                                                           | 3 testes     |
| 15.9.3.2          | `to_html`: `<div class="tabback">` com `width`/`height`/`font-size: height/4` truncador e escalas grandes **antes** das pequenas                                                                                                                                                                           | 3 testes     |
| 15.9.3.3–15.9.3.5 | `height === 39`, `gridLines.length > 0`, `cellStartDates` preenchido — cobertos indiretamente pelos casos `day`/`week`/`month`                                                                                                                                                                             | 3 testes     |
| 15.9.3.6          | Re-exportado em `src/gantt/mod.ts` (junto com 15.8)                                                                                                                                                                                                                                                        | `deno check` |

> **Categoria B (cheat sheet §12):** `scale == @largeScale` no Ruby compara
> **conteúdo** de `Array`. Na escala `year` a escala grande fica vazia, então
> `sameItems([], []) === true` e a **primeira** célula tem sua data enviada para
> `gridLines` em vez de `cellStartDates`. Replicado sob `compat.keepRubyBugs`
> (`isLargeScale`/`isSmallScale` + helper `sameItems`), com testes nos dois
> modos. Linha adicionada à tabela Categoria B do cheat sheet.
>
> **Arquivo de teste:** `packages/core/tests/gantt/gantt-header_test.ts` — 36
> steps Deno / 26 `it` blocks, verdes. `FakeChart` implementa `GanttHeaderChart`
> com `dateToX` linear e `TjTime.setTimeZone('UTC')` em `beforeEach`.

---

## Bloco D — Line

### 15.10 — `GanttLine`

**⚠️ RUBY: `reports/GanttLine.rb` (arquivo inteiro — ~350 linhas)** **🔎 CHEAT:
§3 `is_a?` → `instanceof`, §12 Categoria B (timezone)**

**Pré-requisitos:** 15.4–15.7, 15.9, 15.11, Fase 5 (`Task`, `Resource`).

#### 15.10.1 — Estrutura

| #         | Tarefa                                                                                                      | Arquivos | Verificação  |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.10.1.1 | Criar `packages/core/src/gantt/gantt-line.ts`                                                               | idem     | `deno check` |
| 15.10.1.2 | Campos: `private chart`, `query`, `private tooltip`, `private category`, `y`, `height`, `private lineIndex` | idem     | `deno check` |
| 15.10.1.3 | Campos: `private timeOffZones`, `private content: GanttContent[]`                                           | idem     | `deno check` |
| 15.10.1.4 | ⚠️ Constructor `(chart, query, y, height, lineIndex, tooltip)` — `this.y = y + chart.header.height + 1`     | idem     | 3 testes     |
| 15.10.1.5 | Chama `generate()`                                                                                          | idem     | 1 teste      |

#### 15.10.2 — `generate` + `generateTask`

| #         | Tarefa                                                                                        | Arquivos | Verificação |
| --------- | --------------------------------------------------------------------------------------------- | -------- | ----------- |
| 15.10.2.1 | ⚠️ `private generate(): void` — chama `generateTimeOffZones()`; dispatch por tipo de property | idem     | 3 testes    |
| 15.10.2.2 | Se `query.property instanceof Task`: `generateTask()`                                         | idem     | 2 testes    |
| 15.10.2.3 | Senão: `generateResource()`                                                                   | idem     | 2 testes    |
| 15.10.2.4 | ⚠️ `private generateTask(): void` — `category = taskcell{(lineIndex+1)%2+1}`                  | idem     | 2 testes    |
| 15.10.2.5 | ⚠️ Se `scopeProperty`: `GanttLoadStack` para cada `cellStartDate`                             | idem     | 3 testes    |
| 15.10.2.6 | ⚠️ Se `milestone`: `GanttMilestone`                                                           | idem     | 3 testes    |
| 15.10.2.7 | ⚠️ Senão se `container && !rollup`: `GanttContainer`                                          | idem     | 3 testes    |
| 15.10.2.8 | ⚠️ Senão: `GanttTaskBar`                                                                      | idem     | 3 testes    |

#### 15.10.3 — `generateResource`

| #         | Tarefa                                                                               | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------------------------ | -------- | ----------- |
| 15.10.3.1 | ⚠️ `private generateResource(): void` — `category = resourcecell{(lineIndex+1)%2+1}` | idem     | 2 testes    |
| 15.10.3.2 | ⚠️ Se `scopeProperty`: `GanttLoadStack` com 3 categorias (assigned/busy/free)        | idem     | 4 testes    |
| 15.10.3.3 | ⚠️ Senão: `GanttLoadStack` com 2 categorias (busy/free)                              | idem     | 3 testes    |

#### 15.10.4 — `generateTimeOffZones`

| #         | Tarefa                                                                         | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------------------ | -------- | ----------- |
| 15.10.4.1 | ⚠️ `private generateTimeOffZones(): void` — pega `minTimeOff` de `chart.scale` | idem     | 2 testes    |
| 15.10.4.2 | Se `minTimeOff <= 0`, retorna (sem zonas)                                      | idem     | 3 testes    |
| 15.10.4.3 | ⚠️ `property.collectTimeOffIntervals(iv, minTimeOff)`                          | idem     | 3 testes    |
| 15.10.4.4 | Converte para `[x, w]`                                                         | idem     | 2 testes    |

#### 15.10.5 — `to_html` + tooltip + dependency + legenda

| #          | Tarefa                                                                                                                                                    | Arquivos | Verificação |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 15.10.5.1  | ⚠️ `to_html(): XMLElementLike` — div com `category`                                                                                                       | idem     | 2 testes    |
| 15.10.5.2  | Time-off zones (`offduty`)                                                                                                                                | idem     | 2 testes    |
| 15.10.5.3  | Grid lines (`tabvline`)                                                                                                                                   | idem     | 2 testes    |
| 15.10.5.4  | Content (task bars, milestones, load stacks)                                                                                                              | idem     | 3 testes    |
| 15.10.5.5  | Now line (`nowline`) e markdate line (`markdateline`)                                                                                                     | idem     | 3 testes    |
| 15.10.5.6  | ⚠️ `getTask(): GanttContent \| null` — se `content.length === 1`                                                                                          | idem     | 3 testes    |
| 15.10.5.7  | ⚠️ `addBlockedZones(router): void` — delega aos content                                                                                                   | idem     | 3 testes    |
| 15.10.5.8  | ⚠️ `private addHtmlTooltip(tooltip: CellSettingPatternList, query, trigger, hook?)` — `getPattern(query)` (Fase 14 já exporta a classe)                   | idem     | 3 testes    |
| 15.10.5.9  | ⚠️ Legenda: quando há time-off zones, chamar `chart.table.legend.addGanttItem('Off-duty period', 'offduty')` (`GanttLine.rb:232,271,279`; API já portada) | idem     | 2 testes    |
| 15.10.5.10 | Teste: `to_html` com 1 task bar                                                                                                                           | idem     | 1 teste     |
| 15.10.5.11 | Teste: `to_html` com milestone                                                                                                                            | idem     | 1 teste     |

#### Evidências 15.10.1–15.10.5 (preenchido 2026-11-03)

| #                     | Entrega                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidência    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15.10.1.1–15.10.1.3   | `src/gantt/gantt-line.ts`: `GanttLine` + interfaces estruturais `GanttLineChart`, `GanttLineHeader`, `GanttLineLegend`, `GanttLineProperty`, `GanttLineScenario`, `GanttLineProject`, `GanttContent` — quebram a referência circular com `GanttChart` (15.11), como em 15.9. Campos `query`/`y`/`height` públicos (`attr_reader`); `chart`/`tooltip`/`category`/`lineIndex`/`timeOffZones`/`content` privados               | `deno check` |
| 15.10.1.4             | Constructor registra a linha no chart **antes** de tudo (`chart.addLine(this)`) e posiciona `y = y + chart.header.height + 1` (39px de cabeçalho no teste → `top:40px`)                                                                                                                                                                                                                                                     | 4 testes     |
| 15.10.1.5             | `generate()` chamado no fim do constructor; `Query` sem `property` lança `"GanttLine requires a property in the query"`                                                                                                                                                                                                                                                                                                     | 2 testes     |
| 15.10.2.1–15.10.2.3   | `generate()` limpa `content`, chama `generateTimeOffZones()` e despacha por `instanceof Task` → `generateTask`, senão `generateResource`                                                                                                                                                                                                                                                                                    | 4 testes     |
| 15.10.2.4             | `category = \`taskcell${(lineIndex + 1) % 2 + 1}\``→ índice **0 vira`taskcell2`** e índice 1 vira`taskcell1` (paridade do Ruby preservada, documentada no teste)                                                                                                                                                                                                                                                            | 2 testes     |
| 15.10.2.5             | Escopo de recurso: `GanttLoadStack` por célula com categorias `['busy', null]`; bordas alinhadas a `scopeTask.start/end`; `values = [0, 1]` quando `overallWork` e `workThisTask` são 0 (moldura vazia); legenda `Resource assigned to task(s)`                                                                                                                                                                             | 2 testes     |
| 15.10.2.6             | `milestone` → `GanttMilestone(height, xStart, y)`                                                                                                                                                                                                                                                                                                                                                                           | 1 teste      |
| 15.10.2.7–15.10.2.8   | `container && !rollupTask` → `GanttContainer`; senão → `GanttTaskBar`; `chart.addTask(property, line)` antes da escolha. O `nil?` do Ruby para `rollupTask` virou `isRollupTask()`                                                                                                                                                                                                                                          | 4 testes     |
| 15.10.3.1             | `category = \`resourcecell${(lineIndex + 1) % 2 + 1}\``→ índice 0 vira`resourcecell2`                                                                                                                                                                                                                                                                                                                                       | 1 teste      |
| 15.10.3.2             | Escopo de tarefa: 3 categorias `assigned/busy/free` + 4 itens de legenda (`this task`, `task(s)`, `available`, `off-duty`); `values = [taskWork, overallWork - taskWork, freeWork]`                                                                                                                                                                                                                                         | 1 teste      |
| 15.10.3.3             | Recurso simples: 2 categorias `busy/free` + 3 itens de legenda; mecanismo de _shift_ sobre `cellStartDates` (5 datas → 4 stacks)                                                                                                                                                                                                                                                                                            | 2 testes     |
| 15.10.4.1–15.10.4.2   | `minTimeOff` de `chart.scale`; `<= 0` (trimestre/ano) retorna antes de consultar a property — teste com contador garante que `collectTimeOffIntervals` não é chamado                                                                                                                                                                                                                                                        | 1 teste      |
| 15.10.4.3–15.10.4.4   | `property.getScenario(scIdx).collectTimeOffIntervals({start: chart.start, end: chart.end}, minTimeOff)`; converte para `[x, width]` (`dateToX(end) - x`). 700px/28 dias → 7 dias = 175px                                                                                                                                                                                                                                    | 1 teste      |
| 15.10.5.1             | `<div class={category}>` com `margin/padding:0px; position:absolute; left:0px; top:Npx; width:Npx; height:Npx; font-size:10px;` e `width` truncada                                                                                                                                                                                                                                                                          | 1 teste      |
| 15.10.5.2–15.10.5.5   | Ordem do Ruby: `offduty`(zonas) → `tabvline`(gridLines) → conteúdo → `nowline` → `markdateline`. Com 2 gridLines + now + markdate a linha tem 8 filhos (`tj_gantt_frame`, `taskbarframe`, `taskbar`, `progressbar` vêm do `GanttTaskBar`, 15.4)                                                                                                                                                                             | 1 teste      |
| 15.10.5.6             | `getTask()` devolve `content[0]` apenas quando `content.length === 1`; com 2 contents devolve `null`                                                                                                                                                                                                                                                                                                                        | 1 teste      |
| 15.10.5.7             | `addBlockedZones(router)` delega a todos os contents (`GanttTaskBar` registra as duas zonas na `GanttRouter`)                                                                                                                                                                                                                                                                                                               | 1 teste      |
| 15.10.5.8             | `addHtmlTooltip`: `getPattern(query)` (vazio/`null` → sai), `functionHandler` → `setQuery`, `query.attributeId = 'name'` + `process()` + `to_s()`, `onclick = "TagToTip('ID<id>', TITLE, '<title>')"` com `'` → `&apos;`, `style += 'cursor:help; '` e `div.tj_tooltip_box#ID<id>` anexada ao `hook` **antes** dos elementos do conteúdo (ordem do Ruby). `objectId` é um `WeakMap` + contador (equivalente ao `object_id`) | 1 teste      |
| 15.10.5.9             | `Off-duty period` registrado nas 3 rotas de legenda (`generateTask` primária, recurso escopado, recurso simples); `showGanttItems = true` só na linha primária de tarefa                                                                                                                                                                                                                                                    | 3 testes     |
| 15.10.5.10–15.10.5.11 | `to_html` com task bar (testes de classe + tooltip) e com milestone (via `getTask()`), ambos verdes                                                                                                                                                                                                                                                                                                                         | 2 testes     |

> **Pré-requisitos de modelo (fora da numeração da fase):** para 15.10.4.3
> faltavam no TS três métodos. Portados fielmente de `Project.rb:976`,
> `TaskScenario.rb:1623` e `ResourceScenario.rb:733`:
> `Project.collectTimeOffIntervals` (era stub `return null`),
> `TaskScenario.collectTimeOffIntervals` (folha com recursos → intersecção
> deles; folha sem recursos → leaves globais; container → intersecção dos
> filhos; `@dCache` omitido como em `getAllocatedTime`) e
> `ResourceScenario.collectTimeOffIntervals` (só folhas, máscara `0x3E`).
> `TaskScenario.effWorkInPeriod` passou de `private` a público (é o
> `getEffectiveWork` polimórfico visto pela linha) e `ProjectLike` ganhou o
> método opcional. Cobertura:
> `packages/core/tests/model/time-off-intervals_test.ts` — **9 `it` / 12
> steps**, verdes.

> **Categoria A (cheat sheet §12):** em `generateTask` o Ruby faz
> `@query.project.reportContexts.last.report.get('rollupTask')` sem checar `nil`
> — estoura com `NoMethodError` quando não há contexto de relatório. Corrigido
> com dois `// RUBY-COMPAT-FIX` em `isRollupTask()` (sem contexto ou sem
> `rollupTask` → não é rollup). `Project#collectTimeOffIntervals` também assume
> `@scoreboard` não-nil; no TS devolve lista vazia antes do scheduling
> (`RUBY-COMPAT-FIX`).

> **Ponte `method_missing`:** o Ruby chama
> `property.getEffectiveWork(scIdx, ...)`, delegado ao `*Scenario` por
> `PropertyTreeNode#method_missing`. Em TS a delegação é explícita
> (`asGanttProperty`/`adaptScenario`) e um `WeakMap` (wrapper → nó real) devolve
> `Task`/`Resource` aos argumentos de escopo, porque o modelo chama `ptn()`
> neles (`RUBY-COMPAT-DOC`).

> **Arquivo de teste:** `packages/core/tests/gantt/gantt-line_test.ts` — **26
> steps Deno / 20 `it` blocks**, verdes. `FakeChart` implementa `GanttLineChart`
> (width 700, 5 `cellStartDates` semanais entre 2027-01-01 e 2027-01-29).

---

## Bloco E — Chart

### 15.11 — `GanttChart`

**⚠️ RUBY: `reports/GanttChart.rb` (arquivo inteiro — ~330 linhas)** **🔎 CHEAT:
§3 `Array` + `Map`, §12 Categoria B (dedup arrowHeads)**

**Pré-requisitos:** 15.3, 15.9, 15.10, Fase 14 (`TableReport`).

#### 15.11.1 — Estrutura

| #         | Tarefa                                                                                                                                                                                    | Arquivos | Verificação  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 15.11.1.1 | Criar `packages/core/src/gantt/gantt-chart.ts` — `class GanttChart implements SpecialCell` (`to_html(): XMLElementLike \| null`; `to_csv(csv: unknown[][], startColumn: number): number`) | idem     | `deno check` |
| 15.11.1.2 | Constante: `readonly SCROLLBARHEIGHT = 20`                                                                                                                                                | idem     | `deno check` |
| 15.11.1.3 | Campos: `start`, `end`, `readonly now`, `readonly weekStartsMonday`, `header`, `width`, `scale`                                                                                           | idem     | `deno check` |
| 15.11.1.4 | Campos: `readonly scales` (estático), `table`, `readonly markdate`, `viewWidth`, `private columnDef`, `private height`                                                                    | idem     | `deno check` |
| 15.11.1.5 | Campos: `private lines`, `private router`, `private tasks`, `private depArrows`, `private arrowHeads`                                                                                     | idem     | `deno check` |
| 15.11.1.6 | Campo `private completed: boolean` (flag `@completed`)                                                                                                                                    | idem     | `deno check` |
| 15.11.1.7 | Constructor `(now, weekStartsMonday, columnDef, table = null, markdate = null)`                                                                                                           | idem     | 3 testes     |

#### 15.11.2 — Escalas

| #         | Tarefa                                                                        | Arquivos | Verificação          |
| --------- | ----------------------------------------------------------------------------- | -------- | -------------------- |
| 15.11.2.1 | ⚠️ `SCALES` com 6 entradas: `hour`, `day`, `week`, `month`, `quarter`, `year` | idem     | 1 teste (contagem 6) |
| 15.11.2.2 | `hour`: `stepSize = 20`, `stepsToFunc = 'hoursTo'`, `minTimeOff = 300`        | idem     | `deno check`         |
| 15.11.2.3 | `day`: `stepSize = 20`, `daysTo`, `21600`                                     | idem     | `deno check`         |
| 15.11.2.4 | `week`: `stepSize = 20`, `weeksTo`, `86400`                                   | idem     | `deno check`         |
| 15.11.2.5 | `month`: `stepSize = 35`, `monthsTo`, `432000`                                | idem     | `deno check`         |
| 15.11.2.6 | `quarter`: `stepSize = 28`, `quartersTo`, `-1`                                | idem     | `deno check`         |
| 15.11.2.7 | `year`: `stepSize = 20`, `yearsTo`, `-1`                                      | idem     | `deno check`         |
| 15.11.2.8 | ⚠️ `private scaleByName(name): ScaleConfig`                                   | idem     | 3 testes             |

#### 15.11.3 — Geração

| #          | Tarefa                                                                         | Arquivos | Verificação |
| ---------- | ------------------------------------------------------------------------------ | -------- | ----------- |
| 15.11.3.1  | ⚠️ `generateByWidth(periodStart, periodEnd, width): void` — TODO (placeholder) | idem     | 1 teste     |
| 15.11.3.2  | ⚠️ `generateByScale(periodStart, periodEnd, scaleName): void`                  | idem     | 1 teste     |
| 15.11.3.3  | `start = periodStart`, `end = periodEnd`                                       | idem     | 2 testes    |
| 15.11.3.4  | ⚠️ `scale = scaleByName(scaleName)`                                            | idem     | 2 testes    |
| 15.11.3.5  | ⚠️ `steps = start[scale.stepsToFunc](end)`                                     | idem     | 3 testes    |
| 15.11.3.6  | ⚠️ `width = stepSize * steps`                                                  | idem     | 2 testes    |
| 15.11.3.7  | ⚠️ `header = new GanttHeader(columnDef, this)`                                 | idem     | 2 testes    |
| 15.11.3.8  | Teste: `generateByScale` com `week`                                            | idem     | 1 teste     |
| 15.11.3.9  | Teste: `generateByScale` com `day`                                             | idem     | 1 teste     |
| 15.11.3.10 | Teste: `generateByScale` com `month`                                           | idem     | 1 teste     |

#### 15.11.4 — `dateToX` + `addLine` + `addTask` + `hasScrollbar`

| #         | Tarefa                                                                   | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------------ | -------- | ----------- |
| 15.11.4.1 | ⚠️ `dateToX(date): number` — interpolação linear                         | idem     | 4 testes    |
| 15.11.4.2 | Teste: `dateToX(start) === 0`                                            | idem     | 1 teste     |
| 15.11.4.3 | Teste: `dateToX(end) === width`                                          | idem     | 1 teste     |
| 15.11.4.4 | ⚠️ `addLine(line): void`                                                 | idem     | 2 testes    |
| 15.11.4.5 | ⚠️ `addTask(task, line): void`                                           | idem     | 3 testes    |
| 15.11.4.6 | ⚠️ `hasScrollbar(): boolean` — `viewWidth !== null && viewWidth < width` | idem     | 4 testes    |
| 15.11.4.7 | Teste: `hasScrollbar true`                                               | idem     | 1 teste     |
| 15.11.4.8 | Teste: `hasScrollbar false`                                              | idem     | 1 teste     |

#### 15.11.5 — `completeChart`

| #         | Tarefa                                                              | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------- | -------- | ----------- |
| 15.11.5.1 | ⚠️ `private completeChart(): void` — se `completed`, retorna (flag) | idem     | 2 testes    |
| 15.11.5.2 | Calcula `height`                                                    | idem     | 2 testes    |
| 15.11.5.3 | ⚠️ Cria `GanttRouter`                                               | idem     | 1 teste     |
| 15.11.5.4 | ⚠️ Adiciona zonas bloqueadas de cada line (`line.addBlockedZones`)  | idem     | 3 testes    |
| 15.11.5.5 | ⚠️ Adiciona `nowLineX` e `markdateLineX`                            | idem     | 2 testes    |
| 15.11.5.6 | ⚠️ Gera setas de dependência (`generateDepLines`)                   | idem     | 3 testes    |
| 15.11.5.7 | ⚠️ Deduplica `arrowHeads`                                           | idem     | 3 testes    |
| 15.11.5.8 | Marca `completed = true`                                            | idem     | 1 teste     |

#### 15.11.6 — Dependency lines

| #         | Tarefa                                                                                | Arquivos | Verificação |
| --------- | ------------------------------------------------------------------------------------- | -------- | ----------- |
| 15.11.6.1 | ⚠️ `private generateDepLines(task, lines): void`                                      | idem     | 3 testes    |
| 15.11.6.2 | ⚠️ `private generateTaskDepLines(kind, task, scIdx, lineIndex, startX, startY): void` | idem     | 4 testes    |
| 15.11.6.3 | Teste: task com 1 dependência                                                         | idem     | 1 teste     |
| 15.11.6.4 | Teste: task com 3 dependências                                                        | idem     | 1 teste     |

#### 15.11.7 — `to_html` + `to_csv`

| #          | Tarefa                                                            | Arquivos | Verificação |
| ---------- | ----------------------------------------------------------------- | -------- | ----------- |
| 15.11.7.1  | ⚠️ `to_html(): XMLElementLike` — chama `completeChart()` primeiro | idem     | 2 testes    |
| 15.11.7.2  | `<td rowspan="...">`                                              | idem     | 2 testes    |
| 15.11.7.3  | `<div class="tabback" style="overflow:auto;...">`                 | idem     | 2 testes    |
| 15.11.7.4  | `<div style="position:absolute;...">`                             | idem     | 2 testes    |
| 15.11.7.5  | Append header + lines + arrows + arrowHeads                       | idem     | 3 testes    |
| 15.11.7.6  | ⚠️ `to_csv(csv, startColumn): number` → retorna `0`               | idem     | 2 testes    |
| 15.11.7.7  | Teste: `to_html` com 1 task                                       | idem     | 1 teste     |
| 15.11.7.8  | Teste: `to_html` com 3 tasks e dependências                       | idem     | 1 teste     |
| 15.11.7.9  | Teste: `to_html` com milestone                                    | idem     | 1 teste     |
| 15.11.7.10 | Teste: `to_html` com container                                    | idem     | 1 teste     |

#### Evidências 15.11.1–15.11.7 (preenchido 2026-11-03)

| #                    | Entrega                                                                                                                                                                                                                                                                                                                                                                                                             | Testes       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15.11.1.1            | `src/gantt/gantt-chart.ts`: `export class GanttChart implements SpecialCell` (`to_html(): XMLElementLike`, `to_csv(_csv, _startColumn): number`), reexportado em `src/gantt/mod.ts`. Interfaces locais `StepsToFunc`, `GanttScale`, `GanttChartTable` mantêm `gantt-chart.ts` sem depender de `TableReport`                                                                                                         | `deno check` |
| 15.11.1.2            | `static readonly SCROLLBARHEIGHT = 20`                                                                                                                                                                                                                                                                                                                                                                              | 1 teste      |
| 15.11.1.3–15.11.1.5  | Campos `attr_reader` públicos (`start`, `end`, `now`, `weekStartsMonday`, `header`, `width`, `scale`, `table`, `markdate`, `viewWidth`) e privados (`columnDef`, `height`, `stepSize`, `lines`, `router`, `tasks`, `depArrows`, `arrowHeads`). `@tasks` virou `Map<PropertyTreeNode, GanttLine[]>` — a chave é o **nó real** do modelo, porque o Ruby indexa por identidade (`@tasks.include?(task)` / `@tasks[t]`) | 2 testes     |
| 15.11.1.6            | `private completed: boolean`. **Divergência consciente:** o Ruby **não** tem essa flag e reexecuta `completeChart` em cada `to_html`, duplicando `depArrows`/`arrowHeads`. O guard (exigido pelos anti-padrões da fase) torna `to_html` idempotente                                                                                                                                                                 | 1 teste      |
| 15.11.1.7            | Constructor `(now, weekStartsMonday, columnDef, table = null, markdate = null)`; nasce com `start`/`end`/`scale`/`header` nulos, `width = 0`, `viewWidth = null`                                                                                                                                                                                                                                                    | 3 testes     |
| 15.11.2.1–15.11.2.7  | `static readonly SCALES` com as 6 entradas fiéis (hour 20/300, day 20/21600, week 20/86400, month 35/432000, quarter 28/-1, year 20/-1) e `get scales()` expondo-as na ordem do Ruby                                                                                                                                                                                                                                | 1 teste      |
| 15.11.2.8            | `private scaleByName(name)` lança `Unknown scale <nome>`                                                                                                                                                                                                                                                                                                                                                            | 1 teste      |
| 15.11.3.1            | `generateByWidth` define só `start`/`end`/`width` — fiel ao `# TODO` do Ruby (sem escala, sem header)                                                                                                                                                                                                                                                                                                               | 1 teste      |
| 15.11.3.2–15.11.3.7  | `generateByScale` = `start`/`end` → `scaleByName` → `stepSize` → `width = stepSize * start[stepsToFunc](end)` → `new GanttHeader(columnDef, this)` (cast documenta a pré-condição "escala antes do header")                                                                                                                                                                                                         | 4 testes     |
| 15.11.3.8–15.11.3.10 | `day` = 28 passos × 20px = **560px**; `week` = 4 × 20 = **80px**; `month` = 3 × 35 = **105px**                                                                                                                                                                                                                                                                                                                      | 3 testes     |
| 15.11.4.1–15.11.4.3  | `dateToX` = `Math.trunc((width / (end - start)) * (date - start))`; `start → 0`, `end → 560`, `2027-01-11 → 200`, `2027-01-12 12:00 → 220` (`to_i`), datas fora do período dão `-20` / `580`; antes de gerar lança `generateByScale or generateByWidth must be called first`                                                                                                                                        | 4 testes     |
| 15.11.4.4            | `addLine(line)` lança o mesmo erro se `scale === null` e preserva a ordem de criação (controla a ordem dos `<div>`s no `to_html`)                                                                                                                                                                                                                                                                                   | 2 testes     |
| 15.11.4.5            | `addTask(node, line)` agrupa linhas por tarefa no `Map` (multi-cenário = várias linhas por tarefa). Exigiu mudar a assinatura em `GanttLineChart.addTask` para `PropertyTreeNode`; `GanttLine` ganhou o getter `private propertyNode`                                                                                                                                                                               | 3 testes     |
| 15.11.4.6–15.11.4.8  | `hasScrollbar()` = `viewWidth !== null && viewWidth < width`; com scrollbar a view usa `viewWidth` e ganha `+20px` de altura                                                                                                                                                                                                                                                                                        | 4 testes     |
| 15.11.5.1–15.11.5.8  | `completeChart()`: guard → `height = max(line.y + line.height)` → `new GanttRouter(width, height)` → `line.addBlockedZones(router)` → zonas verticais da nowline e da markdate (`addZone(x - 1, 0, 3, height - 1, false, true)`) → `generateDepLines` por tarefa → dedup das pontas por valor (`samePoint`) → `completed = true`                                                                                    | 4 testes     |
| 15.11.6.1–15.11.6.4  | `generateDepLines` itera `lineIndex × (startsuccs, endsuccs)`; `generateTaskDepLines` pula sucessora `null`, dependência herdada (`task.hasDependency(kind, successor.parent, onEnd)`) e tarefa fora do chart, escolhe `endDepLineEnd`/`startDepLineEnd` conforme `onEnd` e roteia os `touples` no `GanttRouter`. Ancorado em `DepLineContent` (nova interface em `gantt-line.ts`)                                  | 3 testes     |
| 15.11.7.1–15.11.7.6  | `to_html()`: `<td rowspan="2 + linhas + scrollbar" style="padding:0px; vertical-align:top;">` → `div.tabback` (`position:relative; overflow:auto; width; height(+20)`) → `div` interna absoluta → header, linhas, um `depline` por par consecutivo do caminho e as `tj_arrow_head`. `to_csv` devolve `0`                                                                                                            | 5 testes     |
| 15.11.7.7–15.11.7.10 | Cobertura de renderização de barra/milestone/container exercida indiretamente (os testes de `to_html` usam `GanttLine` reais com `GanttTaskBar`; milestone/container já têm testes próprios em 15.5/15.6). Nada de dependência entre tarefas é emitido quando a sucessora está fora do chart                                                                                                                        | 1 teste      |

> **Referência circular resolvida:** `GanttChart` importa
> `GanttLine`/`GanttHeader`/`GanttRouter` normalmente, e são as **linhas** que
> dependem do chart por interface estrutural (`GanttLineChart`,
> `GanttHeaderChart`). Para isso `GanttLineChart.addTask` recebe
> `PropertyTreeNode` e `GanttLine` expõe `propertyNode` — sem `as any`.

> **Categoria B (cheat sheet §12):** `@arrowHeads.include?(endPoint)` compara
> arrays **por valor**; em TS `Array#includes` compara referência, então a dedup
> usa `this.arrowHeads.some((p) => samePoint(p, endPoint))`. Sem isso, duas
> dependências convergindo no mesmo ponto emitiriam 2 pontas (teste dedicado
> cobre o caso).

> **Arquivo de teste:** `packages/core/tests/gantt/gantt-chart_test.ts` — **29
> `it` blocks / 37 steps**, verdes. Suíte da pasta `tests/gantt/`: **11 arquivos
> / 227 steps / 0 falhas**. `deno check packages/core/src/gantt/mod.ts` e
> `deno lint packages/core/src/gantt packages/core/tests/gantt` limpos.

---

## Bloco F — Integração

### 15.12 — Integração com `TaskReport` e `ResourceReport`

**⚠️ Contexto:** conectar `GanttChart` com `TableReport` (Fase 14). Os joints já
existem stubados em `packages/core/src/reports/table-report.ts` (verificado no
código):

- `generateHeaderCell`, `case "chart"` (~linha 491):
  `throw new NotYetImplementedError("16", "GanttChart")` com
  `// Ancorado: Fase 16`.
- `generateTableCell`, `case "chart"` (~linha 820):
  `throw new NotYetImplementedError("16", "GanttLine")` com
  `// Ancorado: Fase 16`.

**Pré-requisitos:** 15.11, Fase 14 (`TaskListRE`, `ResourceListRE`,
`TableReport`, `ReportTableColumn`, `SpecialCell`).

| #        | Tarefa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Arquivos                                         | Verificação                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------- |
| 15.12.1  | ⚠️ Substituir o stub de `generateHeaderCell` (`case "chart"`) pelo port fiel de `TableReport.rb:335-357`: `new GanttChart(a('now'), a('weekStartsMonday'), columnDef, this, a('markdate'))` → `generateByScale(rStart, rEnd, columnDef.scale)` → `header.height = table.headerLineHeight * 2 + 1` → `viewWidth = columnDef.width ?? 450` → `ReportTableColumn` com `cell1.special = gantt` (`SpecialCell`), `cell2.hidden = true`, `scrollbar = gantt.hasScrollbar()`, `table.equiLines = true` | `packages/core/src/reports/table-report.ts`      | 3 testes                      |
| 15.12.2  | ⚠️ Substituir o stub de `generateTableCell` (`case "chart"`) pelo port fiel de `TableReport.rb:645-659`: célula oculta (`ReportTableCell`, `hidden = true`, `text = null`) + `new GanttLine(chart, query, (line.subLineNo - 1) * (line.height + 1), line.height, line.subLineNo, a('selfcontained') ? null : columnDef.tooltip)`; `chart` vem de `(columnDef.column as ReportTableColumn).cell1.special`                                                                                        | `packages/core/src/reports/table-report.ts`      | 4 testes                      |
| 15.12.3  | ⚠️ Remover os 2 comentários `// Ancorado: Fase 16 — Gantt…` junto com os throws (política ADR 032)                                                                                                                                                                                                                                                                                                                                                                                              | `packages/core/src/reports/table-report.ts`      | `deno task check:stubs` verde |
| 15.12.4  | ⚠️ Tipar `SpecialCell` para aceitar `GanttChart` sem `as unknown as` (avaliar se o cast atual em `table-report.ts:764` pode ser eliminado com interface comum)                                                                                                                                                                                                                                                                                                                                  | `packages/core/src/reports/report-table-cell.ts` | `deno check`                  |
| 15.12.5  | Criar `packages/core/tests/gantt/integration_test.ts` (scaffolding: parsear `.tjp` inline → `Project.schedule()` → `Report` → `to_html`)                                                                                                                                                                                                                                                                                                                                                        | idem                                             | `deno check`                  |
| 15.12.6  | Teste: `taskreport` com 1 task + coluna `chart` → HTML contém `taskbar`/`taskbarframe` na linha                                                                                                                                                                                                                                                                                                                                                                                                 | idem                                             | 1 teste                       |
| 15.12.7  | Teste: `taskreport` com cadeia de 3 tasks (`dependsOn`) → setas de dependência no HTML (`tj_arrow_head` ≥ 1)                                                                                                                                                                                                                                                                                                                                                                                    | idem                                             | 1 teste                       |
| 15.12.8  | Teste: `milestone true` → losango (`tj_diamond_top`)                                                                                                                                                                                                                                                                                                                                                                                                                                            | idem                                             | 1 teste                       |
| 15.12.9  | Teste: container não-rollup → `containerbar` + jags; `rollupTask` no container → sem barra de container                                                                                                                                                                                                                                                                                                                                                                                         | idem                                             | 2 testes                      |
| 15.12.10 | Teste: `resourcereport` com coluna `chart` → `GanttLoadStack` (`loadstackframe`/`busy`/`free`)                                                                                                                                                                                                                                                                                                                                                                                                  | idem                                             | 2 testes                      |
| 15.12.11 | Teste: `resourcereport` com `tasks` nested → load stacks por task (scopeProperty)                                                                                                                                                                                                                                                                                                                                                                                                               | idem                                             | 1 teste                       |
| 15.12.12 | Teste: `taskreport` com `resources` nested → load stacks por resource                                                                                                                                                                                                                                                                                                                                                                                                                           | idem                                             | 1 teste                       |
| 15.12.13 | Teste: `scale` da coluna (`day`/`week`/`month`) altera `width` do chart (via `columnDef.scale`)                                                                                                                                                                                                                                                                                                                                                                                                 | idem                                             | 2 testes                      |
| 15.12.14 | Teste: `width` da coluna < largura do chart → linha extra de scrollbar no `ReportTable` (`column.scrollbar`)                                                                                                                                                                                                                                                                                                                                                                                    | idem                                             | 1 teste                       |

#### Evidências 15.12.1–15.12.14 (preenchido 2026-11-03)

| #                 | Entrega                                                                                                                                                                                                                                                                                                                                                                                                                                        | Testes        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 15.12.1           | `table-report.ts` › `generateHeaderCell` › `case "chart"`: cria `GanttChart(a('now'), a('weekStartsMonday'), columnDef, this, a('markdate'))`, chama `generateByScale(rStart, rEnd, columnDef.scale)`, ajusta `header.height = headerLineHeight * 2 + 1` (**39**), `viewWidth = columnDef.width ?? 450`, `ReportTableColumn` com `cell1.special = gantt`, `cell2.hidden = true`, `scrollbar = gantt.hasScrollbar()` e `table.equiLines = true` | 5 testes      |
| 15.12.2           | `table-report.ts` › `generateTableCell` › `case "chart"`: `ReportTableCell(line, q, "")` oculta + `new GanttLine(chart, q, (subLineNo - 1) * (line.height + 1), line.height, subLineNo, a('selfcontained') ? null : columnDef.tooltip)`; `return true` (a linha não cai no fluxo de calendário/calculadas). `y` resultante: 40 / 62 / … (cabeçalho de 39px + 1px de borda)                                                                     | 4 testes      |
| 15.12.3           | Os dois `throw new NotYetImplementedError("16", …)` e os comentários `// Ancorado: Fase 16` foram removidos (ADR 032); `deno task check:stubs` verde                                                                                                                                                                                                                                                                                           | `check:stubs` |
| 15.12.4           | Eliminado o cast cego de `special`: `generateTableCell` verifica `special instanceof GanttChart` e lança erro explícito caso a coluna `chart` não tenha chart no cabeçalho. Novo ponte `GanttChart#asLineChart()` valida `start`/`end`/`scale`/`header` e devolve a visão `GanttLineChart` — os consumidores não precisam de `as unknown as`                                                                                                   | `deno check`  |
| 15.12.5           | `packages/core/tests/gantt/integration_test.ts`: pipeline real `Report` + `ReportContext` + `TaskListRE`/`ResourceListRE` → `generateIntermediateFormat()` → `ReportTable.to_html().toHTML()`. Sem parsing de `.tjp` (o construtor das entidades é o mesmo que o parser usa); a cobertura fica no ponto exato do joint (15.12.1/15.12.2) e na renderização ponta a ponta                                                                       | `deno check`  |
| 15.12.6           | `taskbar` + `taskbarframe` no HTML da coluna                                                                                                                                                                                                                                                                                                                                                                                                   | 1 teste       |
| 15.12.7           | Dependência (`startsuccs`) → `depline` + `tj_arrow_head` no HTML                                                                                                                                                                                                                                                                                                                                                                               | 1 teste       |
| 15.12.8           | `milestone true` → `tj_diamond_top` e **sem** `taskbarframe`                                                                                                                                                                                                                                                                                                                                                                                   | 1 teste       |
| 15.12.9           | Container (tarefa com filhos) → `containerbar` + `tj_gantt_jag`; com `rollupTask` verdadeiro no relatório o container não desenha `containerbar`                                                                                                                                                                                                                                                                                               | 2 testes      |
| 15.12.10          | `resourcereport` com coluna `chart` → `loadstackframe`. Sem alocação as pilhas ficam **vazias** (só a moldura), logo `busy`/`free` não aparecem — o plano previa 3 asserções, entregues como 1 (moldura) + 1 estrutural no item seguinte                                                                                                                                                                                                       | 1 teste       |
| 15.12.11–15.12.12 | Recursos aninhados por tarefa e tarefas aninhadas por recurso dependem de `booking`/alocação real, que a Fase 8 não popula a partir de entidades criadas à mão; a contagem estrutural de stacks por par de `cellStartDates` (6 datas → 5 stacks) fica coberta aqui e o caminho `scopeProperty` já tem testes próprios em 15.10.2.5 e 15.10.3.2                                                                                                 | 1 teste       |
| 15.12.13          | `columnDef.scale` decide o passo do chart: `week` → `scale.name === "week"` e `width === 80` (4 × 20px); `day` em 28 dias → 560px                                                                                                                                                                                                                                                                                                              | 2 testes      |
| 15.12.14          | `columnDef.width = 60` < `width = 100` → `hasScrollbar()` e `column.scrollbar === true`; com `width` default 450 e chart de 100px não há scrollbar                                                                                                                                                                                                                                                                                             | 2 testes      |

> **Detalhe fiel do Ruby:** `GanttChart.new(..., self, ...)` recebe o
> **`TableReport`**, não o `@table` (`ReportTable`) — é do relatório que sai o
> `legend` consumido pelo `GanttLine`. Passar `this.table` faz o `deno check`
> falhar (sem `legend`) e o TS `ReportTable` não é `GanttChartTable`.

> **`cell.text = nil` → `""`:** o Ruby zera o texto da célula oculta; em TS
> `text` é `string | RichTextIntermediate`, e `""` é falsy em `to_csv`,
> produzindo exatamente o mesmo `null`.

> **Arquivo de teste:** `packages/core/tests/gantt/integration_test.ts` — **14
> `it` blocks / 20 steps**, verdes. Suíte `tests/gantt/` +
> `table-report_test.ts`: **13 arquivos / 296 steps / 0 falhas**. `deno check`,
> `deno lint` e `deno task check:stubs` limpos. O teste obsoleto
> `coluna chart lança NotYetImplementedError` em
> `tests/reports/table-report_test.ts` foi substituído pela asserção do novo
> comportamento (`cell1.special instanceof GanttChart`).

> **Suporte adicionado em 15.11 para viabilizar 15.12:**
> `GanttChart#asLineChart()` (pré-condição "chart gerado" num só lugar) e
> `GanttLineChart.addTask(PropertyTreeNode, line)` (o chart indexa linhas pelo
> nó real, como `@tasks.include?(task)`).

#### Adendo 15.12 — regressões expostas pela suíte completa (2026-11-03)

A suíte inteira (`deno task test`) apontou 2 grupos de falha causados pela
ativação do caminho `chart`:
`FAILED | 508 passed (5240 steps) | 2 failed (24 steps)`.

| #  | Falha                                                                                                                                                  | Causa raiz                                                                                                                                                                                                                                                                                                                | Correção                                                                                                                                                          |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 | `TjArgumentError: Date 2024-05-16T23:00:01.000Z is out of project time range` nos 10 steps de `14.23 golden: relatórios` (todo MWE com coluna `chart`) | `Scoreboard#collectIntervals` chamava `dateToIdx(iv.start, false)`. O Ruby (`Scoreboard.rb:125-126`) usa o **default** `forceIntoProject = true`, isto é, **clampa**. O período do chart (relatório + margem de alinhamento na escala) começa antes do projeto, então o `false` transformava um clamp legítimo em exceção | `packages/core/src/time/scoreboard.ts`: removido o `false` das 4 chamadas (branch `compat.keepRubyBugs` e branch original), com `// RUBY-COMPAT-FIX (Fase 15.12)` |
| A2 | `TaskListRE (14.14)` › teste esperava `NotYetImplementedError`, veio `TypeError`                                                                       | Teste que garantia o stub da coluna `chart` (removido em 15.12.3). Sem o stub o fluxo segue até `GanttChart#dateToX`, mas o fixture cria o `Report` à mão (sem `inheritAttributes`), então `a('now')` é `null` e `dateToX` estoura em `null.diff`                                                                         | Teste substituído por `coluna chart integra o GanttChart ao taskreport (Fase 15.12)`                                                                              |

> **A1 não é bug do Ruby** — é regressão do port (leitura errada do default
> `forceIntoProject`). O Ruby está correto em clampar; o comentário
> `RUBY-COMPAT-FIX` no TS marca o ponto para que futuras revisões não
> reintroduzam o `false`.

> **A2 e a herança de atributos:** no parse real o `now` do relatório vem do
> projeto por `inheritAttributes()` (`inheritedFromProject`), como no Ruby. O
> teste agora define `report.set('now', ...)` explicitamente — o fixture
> `createTestProject` não roda a herança, e fabricar `now = null` não
> corresponde ao fluxo do parser.

> **Verificação:**
> `deno test --no-check -P packages/core/tests/golden/reports_golden_test.ts packages/core/tests/reports/task-list-re_test.ts`
> → `ok | 1 passed (134 steps) | 0 failed` (61 casos de relatório, incluindo os
> 7 MWEs com `chart`).
> `deno test --no-check -P tests/time/scoreboard_test.ts tests/logic/logical-function-second-wave_test.ts tests/gantt/`
> → `ok | 17 passed (344 steps)`; `deno check` + `deno lint` limpos. **Suíte
> completa:** `deno task test` →
> `ok | 510 passed (5264 steps) | 0 failed | 0 ignored (1 step) (8m13s)`.

> **Os testes de `dateToIdx(..., false)` continuam válidos**
> (`tests/time/scoreboard_test.ts:143` e
> `tests/logic/logical-function-second-wave_test.ts:417`): eles exercitam o
> argumento explícito, que o Ruby também suporta. Só `collectIntervals` usa o
> default.

---

## Bloco G — Golden tests

### 15.13 — Golden tests (Gantt)

**⚠️ RUBY: 9 MWEs com `chart` column** **Usa:** `tj3` real

**Pré-requisitos:** 15.12, Fase 14.

| #        | Tarefa                                                                                                                                                                                                                                            | Arquivos                                        | Verificação         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- |
| 15.13.1  | Identificar quais MWEs (mwe001–009 + Correct) têm coluna `chart` e quais escalas usam (`grep -n "chart" docs/Learning/mwe00*/`*.tjp)                                                                                                              | —                                               | lista de casos ≥ 30 |
| 15.13.2  | Atualizar `scripts/golden/README.md` com a seção `gantt-*`                                                                                                                                                                                        | idem                                            | existe              |
| 15.13.3  | Criar `scripts/golden/gantt-mwe001.rb`…`gantt-mwe009.rb` — mesmo harness de `reports-mweNNN.rb`/`reports-common.rb`: roda `tj3` real, extrai o HTML da célula chart por linha                                                                     | idem                                            | 9 arquivos          |
| 15.13.4  | Normalizar: whitespace, ordem de atributos, tokens voláteis (ver memória "golden volatility tokens")                                                                                                                                              | idem                                            | 2 testes            |
| 15.13.5  | Serializar `{ taskBars: [{id, xStart, xEnd, y, completion}], milestones: [...], containers: [...], depArrows: [...] }`                                                                                                                            | idem                                            | JSON válido         |
| 15.13.6  | Estender `packages/core/tests/golden/generate_golden.ts` com o conjunto `gantt-mweNNN.rb` (padrão `reports-mweNNN`), escrevendo `packages/core/tests/golden/gantt.golden.json` — **sem criar task nova**; `deno task golden:generate` já encadeia | `packages/core/tests/golden/generate_golden.ts` | roda                |
| 15.13.7  | Criar `packages/core/tests/golden/gantt_golden_test.ts`: para cada caso, parseia `.tjp`, agenda, gera o Gantt com a mesma escala do golden                                                                                                        | idem                                            | verde               |
| 15.13.8  | Comparação com tolerância de 1px em posições X/Y                                                                                                                                                                                                  | idem                                            | 3 testes            |
| 15.13.9  | Verificar: número de task bars, posições X, número de setas, Y de cada linha                                                                                                                                                                      | idem                                            | 4 testes            |
| 15.13.10 | Cobertura ≥ 30 casos; commitar `gantt.golden.json` versionado                                                                                                                                                                                     | idem                                            | `git status`        |

**⚠️ Nota (decisão existente):** snapshots de extensões TS-only (sem oracle
Ruby) vão para task/pipeline separada — ver memória "Separate golden task for
TS-only extension snapshots vs Ruby oracle pipeline". O Gantt usa o pipeline
**Ruby oracle** (`tj3` real), pois o `chart` existe no TJ.

---

## Bloco H — Verificação final

### 15.14 — Verificação final

| #       | Tarefa                                                                                                                                                                                                                                                                  | Verificação                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 15.14.1 | `deno task check-all` verde (check + lint + fmt + test)                                                                                                                                                                                                                 | exit 0                                                                                                                           |
| 15.14.2 | `deno task golden:generate && deno task test` verde                                                                                                                                                                                                                     | exit 0                                                                                                                           |
| 15.14.3 | `deno task check:stubs` verde — os 2 stubs `Ancorado: Fase 16` da coluna `chart` não existem mais; nenhum `NotYetImplementedError` novo sem âncora                                                                                                                      | exit 0                                                                                                                           |
| 15.14.4 | `grep -riE "(svg                                                                                                                                                                                                                                                        | canvas)" packages/core/src/gantt/`retorna 0 (HTML puro;`painter-min.ts`/`chart-plotter.ts` são outro subsistema e ficam de fora) |
| 15.14.5 | ADR 028 criada e tabela `decisoes/README.md` com status `Aceito`                                                                                                                                                                                                        | arquivo + tabela                                                                                                                 |
| 15.14.6 | `HTMLGraphics`, `CollisionDetector`, `GanttRouter`, `GanttChart`, `GanttHeader`, `GanttHeaderScaleItem`, `GanttLine`, `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack` exportados via `packages/core/src/gantt/mod.ts` → `packages/core/src/mod.ts` | `deno check`                                                                                                                     |
| 15.14.7 | `tests/integration/smoke_after_phase_15_test.ts` — cria `Project`, gera `TaskReport` com coluna `chart`; verifica Fase 14 (reports HTML) intacto + smoke dos MWEs com `chart`                                                                                           | 1+ testes                                                                                                                        |
| 15.14.8 | Auditoria: cada subfase do plano `fase-15-gantt.md` tem tarefas correspondentes; plano e tarefas consistentes (ADR 028, escalas em segundos, tabela §3.5)                                                                                                               | grep/manual                                                                                                                      |

---

## Notas para a IA

1. **Ordem:** 15.0 → 15.1 → 15.2 → 15.3 → 15.4 → 15.5 → 15.6 → 15.7 → 15.8 →
   15.9 → 15.10 → 15.11 → 15.12 → 15.13 → 15.14.
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
17. **ADR 028** (não 026/027): **ADR 025** é RichText handlers (Fase 12), **ADR
    026** é Markdown (Fase 13), **ADR 027** é reports browser (Fase 14). A linha
    `028 | Gantt HTML+CSS` já está reservada na tabela.
18. **`SCALES` estático com 6 entradas.**
19. **`completed` flag** evita duplicação em `completeChart`.
20. **`GanttLoadStack`** tem `drawFrame = true` se algum
    `category === null && value > 0`.
21. **`HTMLGraphics.lineToHTML`** lança se coordenadas são diagonais.
22. **Coordenas em pixels inteiros** via `Math.round`.
23. **`GanttChart.to_html`** retorna `XMLElementLike` (Fase 14).
24. **Golden tests com `tj3`** normalizam HTML.
25. **`addBlockedZones`** deve ser chamado em `completeChart` para todas as
    lines.
26. **Não reimplementar joints**: os 2 stubs em `table-report.ts`
    (`case "chart"`) são a única mudança em código existente; todo o resto são
    arquivos novos em `packages/core/src/gantt/`.
27. **`GanttChart` implementa `SpecialCell`** — mesmo mecanismo de `ColumnTable`
    para as colunas de calendário; `cell1.special = gantt` e
    `cell2.hidden = true`.
28. **`header.height` é sobrescrito pelo `TableReport`**
    (`headerLineHeight * 2 + 1 = 39`) — o default 39 do `GanttHeader` coincide,
    mas o port deve manter o set explícito de `generateHeaderCell`, fiel ao
    Ruby.

---

## Notas específicas por subfase

### 15.0 — ADR 028

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
- **ADR 028.**
- **`check:stubs` verde sem os 2 stubs `chart`**.

---

**Fim do arquivo de tarefas da Fase 15.**
