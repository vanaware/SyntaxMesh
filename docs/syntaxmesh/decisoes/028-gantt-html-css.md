# ADR 028 — Gantt HTML+CSS

> **Status:** ✅ Aceito
> **Data:** 2026-11-03
> **Autores:** Qoder

## Resumo

O Gantt chart do TaskJuggler **não é SVG nem Canvas**: cada barra, losango,
colchete, seta e linha de grade é um `<div>` com `position: absolute`. O
SyntaxMesh mantém essa decisão. `GanttChart` produz uma árvore
`XMLElementLike` (Fase 12/14) — sem dependências gráficas, sem path de
renderização próprio — e se pluga em `TableReport` como `cell1.special`
(mesmo mecanismo do `ColumnTable` das colunas de calendário).

> **Nota de numeração:** o plano `fase-15-gantt.md` dizia "ADR 026" e o arquivo
> de tarefas dizia "ADR 027"; ambos já estão consumidos (026 = Markdown,
> 027 = reports no browser). O `decisoes/README.md` já reservava o **028** para
> "Gantt HTML+CSS"; usamos 028.

## Contexto

### Como o TaskJuggler desenha o Gantt

`GanttChart.rb` compõe o chart com `HTMLGraphics` (`lineToHTML`,
`rectToHTML`, `jagToHTML`, `diamondToHTML`, `arrowHeadToHTML`): todas as
funções devolvem `XMLElement` do tipo `div` com `class` de categoria CSS e
`style` de posicionamento absoluto. O roteamento das setas de dependência é
feito em coordenadas inteiras por `GanttRouter` + `CollisionDetector`, com
zonas bloqueadas ("don't-cross-zones") registradas pelas próprias barras.

### Alternativas consideradas

1. **SVG.** Reaproveitaria o `Painter` (ADR 027 / Fase 17), daria
   anti-aliasing e escalabilidade. Mas:
   - o Gantt do TJ não usa `Painter` (é outro subsistema, para
     `ChartPlotter`/calendários);
   - exigiria reescrever geometria e interação, quebrando a paridade com o
     `tj3` (ADR 011 — regra zero);
   - a comparação de golden tests de HTML (posições em `style`) deixaria de
     ser possível.
2. **Canvas.** Ainda mais distante: sem DOM, sem tooltip nativo, sem golden
   de HTML, e sem correspondência com a fonte Ruby.
3. **HTML+CSS (estado atual).** Fiel ao TJ; testável por comparação de
   strings/árvore; interativo via eventos nativos (`onclick` de tooltip).

## Decisão

1. **HTML+CSS puro.** `packages/core/src/gantt/` porta os 11 arquivos Ruby
   (`GanttChart`, `GanttHeader`, `GanttHeaderScaleItem`, `GanttLine`,
   `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`,
   `GanttRouter`, `CollisionDetector`, `HTMLGraphics`). Nenhum `<svg>`,
   `<canvas>` ou biblioteca de desenho.
2. **Coordenadas em pixels inteiros.** Todo cálculo termina em
   `Math.floor`/`Math.round` (fiel a `to_i` do Ruby no `HTMLGraphics` e no
   `dateToX`), evitando subpixel rendering e mantendo o golden estável.
3. **`GanttChart` implementa `SpecialCell`** (`to_html()` →
   `XMLElementLike | null`, `to_csv()` → `0`). A coluna `chart` de
   `TableReport` faz `cell1.special = gantt`, `cell2.hidden = true`,
   `column.scrollbar = gantt.hasScrollbar()` — exatamente como o Ruby.
4. **Sem comportamento JS embutido.** Tooltips geram o HTML
   (`onclick="TagToTip(...)"` + `<div>` oculto), mas a interação depende de
   `scripts/wz_tooltip.js`, carregado pela UI (Fase 20).
5. **`GanttRouter` ortogonal.** Somente segmentos horizontais e verticais;
   `lineToHTML` lança em coordenadas diagonais. O roteamento é o algoritmo
   greedy do TJ (ordenação por ângulo em buckets de 5 graus + `placeLine`),
   não um A*.

## Consequências

### Positivas

- Paridade byte-a-byte possível com o `tj3` nos golden tests (HTML da célula).
- Sem dependência nova; o core permanece DOM-free e browser-only.
- Interação nativa (hover/tooltip) sem código de desenho.
- Testável por árvore `XMLElementLike` (atributos/estilos conferíveis).

### Negativas / Riscos

- Charts grandes geram muitos `<div>` (uma barra = ~4 divs; uma seta = 2–3
  segmentos + cabeça). Aceitável para os tamanhos típicos de relatório.
- Sem anti-aliasing: linhas de 1px podem variar entre browsers (já é o
  comportamento do `tj3`).
- `style` inline é exceção deliberada à preferência BeerCSS do projeto — é
  a técnica do TJ para geometria, não estilização de UI.

## Referências

- `docs/taskjuggler/lib/taskjuggler/reports/{HTMLGraphics,GanttChart,GanttRouter}.rb`
- `docs/tj3-engine/16-blueprint-gantt.md`
- `docs/syntaxmesh/fases/fase-15-gantt.md` / `fase-15-gantt-tarefas.md`
- ADR 011 (port fiel), ADR 027 (reports retornam strings/`XMLElementLike`)
