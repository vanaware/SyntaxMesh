# Fase 14 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-14-relatorios.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~350 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/reports/*.rb` + `TableColumnDefinition.rb` + `TableColumnSorter.rb` + `ICalendar.rb` + `Painter/*.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

Esta é a **maior fase do projeto** (~5.000 linhas de Ruby). Ela depende de Fases 2–13 completas. A ordem **dentro** da fase importa:

1. **Bloco A (infraestrutura)** primeiro — CSVFile, ReportContext, ReportBase, TableColumnDefinition, TableColumnSorter.
2. **Bloco B (tabela)** depois — ReportTable, ReportTableCell.
3. **Bloco C (reports base)** — Report (completar), TableReport (o mais complexo), ColumnTable.
4. **Bloco D (reports específicos)** — TaskListRE, ResourceListRE, AccountListRE, TextReport, exports, ICal, Niku, Trace, TagFile.
5. **Bloco E (Navigator)** — completa `RTFNavigator` (stub da Fase 12).
6. **Bloco F (ChartPlotter)** — `Painter` mínimo local (Fase 17 substitui).
7. **Bloco G (golden)** — validação end-to-end.
8. **Bloco H (verificação)** — fecha a fase.

### ADRs relevantes

- **ADR 009** — RichText mantido, Markdown futuro.
- **ADR 011–022** — Fases 2–10 (contexto).
- **ADR 023** — Expressões lógicas sem precedência (Fase 11).
- **ADR 024** — RichText e function handlers (Fase 12).
- **ADR 025** — Markdown going-forward (Fase 13).
- **ADR 026** — Reports browser-only (**criado nesta fase**).

### Convenções CRÍTICAS

- **`TableReport` é o mais complexo.** Dividir em métodos testáveis.
- **Ordem de `generateIntermediateFormat`** importa: prepara listas → header → lista.
- **`resourceList` NÃO filtrado em `TaskListRE`.** Idem para `taskList` em `ResourceListRE`.
- **`adjustColumnPeriod`** com chart/calendar: margem.
- **`AccountListRE` balance mode:** criar `totalAccount`, remover depois.
- **`ReportTable.to_html`:** header merge só se **todas** têm 2 rows.
- **`ReportTableCell.to_html`:** `category` default `'tabcell'`.
- **`CSVFile`:** `strToNative` para Integer/Float.
- **`TjpExportRE`:** fidelidade textual.
- **`MspXmlRE`:** usar `XMLElementLike` + serializer.
- **`ICalendar.foldLines`:** linhas de 75 chars.
- **Browser reports retornam strings.** ADR 026.
- **`ChartPlotter`:** implementar `Painter` mínimo nesta fase.
- **`RTFNavigator`, `RTFReport`, `RTFReportLink`:** completar stubs da Fase 12.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não tocar em Fase 15 (Gantt) — `GanttChart` é coluna `chart`.
- ❌ Não tocar em Fase 17 (HTML/XML) — `XMLElementLike` é a interface atual.
- ❌ Não usar `BatchProcessor` (não existe em browser).
- ❌ Não escrever em disco — reports retornam strings.
- ❌ Não usar `Proxy`.
- ❌ Não simplificar `TableReport` — cada linha tem razão.
- ❌ Não reordenar `generateIntermediateFormat`.
- ❌ Não filtrar `resourceList` em `TaskListRE` antes da hora.

---

## Progresso

```
[ ] 14.0  ADR 026 (reports browser-only)          —   0/5
[ ] 14.1  CSVFile                                  —   0/12
[ ] 14.2  ReportContext (completar)                —   0/10
[ ] 14.3  ReportBase                               —   0/14
[ ] 14.4  TableColumnDefinition + CellSettingPattern — 0/12
[ ] 14.5  TableColumnSorter                        —   0/6
[ ] 14.6  ReportTable                              —   0/18
[ ] 14.7  ReportTableColumn                        —   0/6
[ ] 14.8  ReportTableLine                          —   0/10
[ ] 14.9  ReportTableCell + PlaceHolderCell        —   0/24
[ ] 14.10 ReportTableLegend                        —   0/10
[ ] 14.11 Report (completar)                       —   0/18
[ ] 14.12 TableReport                              —   0/32
[ ] 14.13 ColumnTable                              —   0/6
[ ] 14.14 TaskListRE                               —   0/10
[ ] 14.15 ResourceListRE                           —   0/10
[ ] 14.16 AccountListRE                            —   0/12
[ ] 14.17 TextReport                               —   0/10
[ ] 14.18 ExportRE + TjpExportRE + MspXmlRE        —   0/22
[ ] 14.19 ICalReport + ICalendar (mínimo)          —   0/14
[ ] 14.20 NikuReport + TraceReport + TagFile       —   0/20
[ ] 14.21 Navigator + completar RTFNavigator       —   0/14
[ ] 14.22 ChartPlotter + Painter (mínimo)          —   0/18
[ ] 14.23 Golden tests (reports)                   —   0/12
[ ] 14.24 Verificação final                        —   0/10
─────────────────────────────────────────────────────────
TOTAL: ~350
```

---

## Bloco A — Infraestrutura

### 14.0 — ADR 026 (reports browser-only)

**Objetivo:** formalizar a decisão de reports retornarem strings em vez de escrever arquivos.

**⚠️ Nota:** o plano usa `ADR 024`, mas ADR 024 é RichText (Fase 12), ADR 025 é Markdown (Fase 13). Aqui usamos **ADR 026**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.0.1 | Criar `docs/syntaxmesh/decisoes/026-reports-browser.md` com frontmatter | idem | arquivo existe |
| 14.0.2 | Seção **Contexto:** Ruby `Report.generate` escreve em disco; browser não tem FS direto | idem | — |
| 14.0.3 | Seção **Decisão:** reports **retornam strings**; `outputDir` mantido por compatibilidade (opcional); API muda para `generateReport(): string[]` | idem | — |
| 14.0.4 | **Alternativas** (OPFS via worker-db, híbrido) + **Consequências** (API diferente do Ruby; UI salva via worker-db se necessário) | idem | — |
| 14.0.5 | Atualizar linha `026` em `decisoes/README.md` | idem | 26 linhas |

---

### 14.1 — `CSVFile`

**⚠️ RUBY: `reports/CSVFile.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Array` bidimensional, §5 strings, §12 Categoria B (float format)**

**Pré-requisitos:** nenhum.

#### 14.1.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.1.1.1 | Criar `packages/report/src/csv-file.ts` com `class CSVFile` | idem | `deno check` |
| 14.1.1.2 | Campos: `data: unknown[][] \| null`, `private separator: string`, `private quote: string` | idem | `deno check` |
| 14.1.1.3 | Constructor `(data?, separator = ';', quote = '"')` | idem | 3 testes |

#### 14.1.2 — Serialização (`to_s`)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.1.2.1 | ⚠️ `to_s(): string` — itera linhas, chama `marshal(field)` | idem | 2 testes |
| 14.1.2.2 | ⚠️ `private marshal(field): string` — se contém separator/quote/newline, envolve em quote e escapa | idem | 6 testes |
| 14.1.2.3 | Teste: linha simples `[[1, 2], [3, 4]]` → `'1;2\n3;4\n'` | idem | 1 teste |
| 14.1.2.4 | Teste: campo com `;` → entre quotes | idem | 1 teste |
| 14.1.2.5 | Teste: campo com `"` → escapado como `""` | idem | 1 teste |
| 14.1.2.6 | Teste: campo com `\n` → entre quotes | idem | 1 teste |

#### 14.1.3 — Parse

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.1.3.1 | ⚠️ `parse(str: string): unknown[][]` — máquina de estados | idem | 2 testes |
| 14.1.3.2 | ⚠️ `private detectSeparator(str): string` — heurística (`,` vs `;`) | idem | 3 testes |
| 14.1.3.3 | ⚠️ `private unMarshal(field, quoted): unknown` — converte string → native | idem | 3 testes |
| 14.1.3.4 | ⚠️ `static strToNative(str): unknown` — `number` (Integer/Float), `null`, `string` | idem | 6 testes |
| 14.1.3.5 | Teste: `'"a";"b"\n1;2'` → `[['a', 'b'], [1, 2]]` | idem | 1 teste |
| 14.1.3.6 | Teste: quoted com separador interno | idem | 1 teste |
| 14.1.3.7 | Teste: quoted com escaped quotes | idem | 1 teste |

#### 14.1.4 — Read/Write

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.1.4.1 | ⚠️ `read(fileName): unknown[][]` — no browser: `NotYetImplementedError` ou via `FileStore` | idem | 1 teste |
| 14.1.4.2 | ⚠️ `write(fileName): void` — no browser: se `fileName === '.'`, retorna; senão, no-op + warning | idem | 2 testes |
| 14.1.4.3 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.2 — `ReportContext` (completar)

**⚠️ RUBY: `reports/ReportContext.rb` (arquivo inteiro — ~90 linhas)**
**🔎 CHEAT: §3 `Hash` → `Map`, §12 Categoria B (`attributeBackup`)**

**Pré-requisitos:** Fases 5 (`Project`), 11 (`Query`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.2.1 | Criar/estender `packages/report/src/report-context.ts` | idem | `deno check` |
| 14.2.2 | Campos: `project: Project`, `report: Report`, `query: Query`, `dynamicReportId: string` | idem | `deno check` |
| 14.2.3 | Campos: `childReportCounter: number`, `tasks: PropertyList<Task>`, `resources: PropertyList<Resource>` | idem | `deno check` |
| 14.2.4 | Campo: `attributeBackup: [Map<string, AttributeBase>, Map<string, AttributeBase>[]] \| null` | idem | `deno check` |
| 14.2.5 | ⚠️ Constructor `(project, report)` — cria `Query` com `loadUnit`, `numberFormat`, `timeFormat`, `currencyFormat`, `start`, `end`, `hideJournalEntry`, `journalMode`, `journalAttributes`, `sortJournalEntries`, `costAccount`, `revenueAccount` | idem | 6 testes |
| 14.2.6 | ⚠️ Se parent context: `dynamicReportId = parent.dynamicReportId + '.' + parent.childReportCounter`; `parent.childReportCounter++`; `tasks = parent.tasks.dup()`; `resources = parent.resources.dup()` | idem | 4 testes |
| 14.2.7 | ⚠️ Senão: `dynamicReportId = '0'`; `tasks = project.tasks.toArray()`; `resources = project.resources.toArray()` | idem | 3 testes |
| 14.2.8 | Teste: `query.project === project` | idem | 1 teste |
| 14.2.9 | Teste: `dynamicReportId` encadeado (0, 0.1, 0.2, 0.2.1, ...) | idem | 2 testes |
| 14.2.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.3 — `ReportBase`

**⚠️ RUBY: `reports/ReportBase.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Array` + `PropertyList`, §5 strings**

**Pré-requisitos:** 14.2, Fases 5, 11, 12.

#### 14.3.1 — Estrutura + helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.3.1.1 | Criar `packages/report/src/report-base.ts` com `abstract class ReportBase` | idem | `deno check` |
| 14.3.1.2 | Campos: `report: Report`, `project: Project` | idem | `deno check` |
| 14.3.1.3 | Constructor `(report)` — seta `project = report.project` | idem | 2 testes |
| 14.3.1.4 | ⚠️ `a(attribute): unknown` — atalho para `report.get(attribute)` | idem | 2 testes |

#### 14.3.2 — `generateIntermediateFormat`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.3.2.1 | ⚠️ `generateIntermediateFormat(): void` — seta query em todos os `RichTextIntermediate` (`header`, `left`, `center`, `right`, `footer`, `prolog`, `headline`, `caption`, `epilog`) | idem | 8 testes |
| 14.3.2.2 | Se `RichTextIntermediate` ausente, ignora | idem | 1 teste |

#### 14.3.3 — Filtros

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.3.3.1 | ⚠️ `filterAccountList(list, hideExpr, rollupExpr, openNodes): PropertyList<Account>` | idem | 3 testes |
| 14.3.3.2 | ⚠️ `filterTaskList(list, resource, hideExpr, rollupExpr, openNodes): PropertyList<Task>` | idem | 4 testes |
| 14.3.3.3 | ⚠️ `filterResourceList(list, task, hideExpr, rollupExpr, openNodes): PropertyList<Resource>` | idem | 3 testes |
| 14.3.3.4 | ⚠️ `private standardFilterOps(list, hideExpr, rollupExpr, openNodes, scopeProperty, root): PropertyList<T>` | idem | 4 testes |
| 14.3.3.5 | Se `hideExpr`, `list.deleteIf(p => hideExpr.eval(query))` | idem | 3 testes |
| 14.3.3.6 | Se `rollupExpr \|\| openNodes`, `list.deleteIf(...)` | idem | 3 testes |
| 14.3.3.7 | ⚠️ Se `list.treeMode()`, re-adiciona parents | idem | 3 testes |

#### 14.3.4 — HTML helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.3.4.1 | ⚠️ `private generateHtmlTableFrame(): XMLElementLike` | idem | 3 testes |
| 14.3.4.2 | ⚠️ `private generateHtmlTableRow(): XMLElementLike` | idem | 2 testes |
| 14.3.4.3 | ⚠️ `private rt_to_html(name): XMLElementLike \| null` | idem | 4 testes |
| 14.3.4.4 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.4 — `TableColumnDefinition` + `CellSettingPattern`

**⚠️ RUBY: `TableColumnDefinition.rb` (~130 linhas) + `reports/TableReportColumn.rb` (parcial)**

**Pré-requisitos:** Fase 11 (`Query`, `LogicalExpression`), 14.3.

#### 14.4.1 — `CellSettingPattern` + `CellSettingPatternList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.4.1.1 | Criar `packages/report/src/cell-setting-pattern.ts` com `class CellSettingPattern` | idem | `deno check` |
| 14.4.1.2 | Campos: `readonly setting: unknown`, `readonly logExpr: LogicalExpression` | idem | `deno check` |
| 14.4.1.3 | Constructor `(setting, logExpr)` | idem | 2 testes |
| 14.4.1.4 | Criar `class CellSettingPatternList` com `private patterns: CellSettingPattern[]` | idem | `deno check` |
| 14.4.1.5 | ⚠️ `addPattern(pattern): void` | idem | 2 testes |
| 14.4.1.6 | ⚠️ `getPattern(query): unknown \| null` — primeiro que casa | idem | 4 testes |

#### 14.4.2 — `TableColumnDefinition`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.4.2.1 | Criar `packages/report/src/table-column-definition.ts` com `class TableColumnDefinition` | idem | `deno check` |
| 14.4.2.2 | Campos: `readonly id: string`, `title: string`, `start: TjTime \| null`, `end: TjTime \| null` | idem | `deno check` |
| 14.4.2.3 | Campos: `cellText`, `cellColor`, `fontColor`, `hAlign`, `tooltip` (todos `CellSettingPatternList`) | idem | `deno check` |
| 14.4.2.4 | Campos: `listItem: string \| null`, `listType`, `scale`, `width`, `timeformat1`, `timeformat2`, `content`, `column: ReportTableColumn \| null` | idem | `deno check` |
| 14.4.2.5 | Constructor `(id, title)` | idem | 3 testes |
| 14.4.2.6 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.5 — `TableColumnSorter`

**⚠️ RUBY: `TableColumnSorter.rb` (arquivo inteiro — ~70 linhas)**

**Pré-requisitos:** 14.1 (`CSVFile`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.5.1 | Criar `packages/report/src/table-column-sorter.ts` com `class TableColumnSorter` | idem | `deno check` |
| 14.5.2 | Campos: `private oldTable: unknown[][]`, `discontinuedColumns: number` | idem | `deno check` |
| 14.5.3 | Constructor `(table)` | idem | 2 testes |
| 14.5.4 | ⚠️ `sort(newHeaders: string[]): unknown[][]` — reordena colunas | idem | 4 testes |
| 14.5.5 | Colunas descontinuadas vão ao final | idem | 2 testes |
| 14.5.6 | Colunas novas preenchidas com `null` | idem | 2 testes |

---

## Bloco B — Tabela

### 14.6 — `ReportTable`

**⚠️ RUBY: `reports/ReportTable.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `Array` de `Array`, §12 Categoria B (header merge)**

**Pré-requisitos:** 14.7 (`ReportTableColumn`), 14.8 (`ReportTableLine`), 12.1 (`XMLElementLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.6.1 | Criar `packages/report/src/report-table.ts` com `class ReportTable` | idem | `deno check` |
| 14.6.2 | Constante `readonly SCROLLBARHEIGHT = 20` | idem | `deno check` |
| 14.6.3 | Campos: `headerLineHeight = 19`, `headerFontSize = 15`, `private columns`, `private lines` | idem | `deno check` |
| 14.6.4 | Campos: `maxIndent`, `equiLines`, `embedded`, `selfcontained`, `auxDir` | idem | `deno check` |
| 14.6.5 | ⚠️ `addColumn(col)` | idem | 2 testes |
| 14.6.6 | ⚠️ `addLine(line)` | idem | 2 testes |
| 14.6.7 | ⚠️ `lines(): number` | idem | 1 teste |
| 14.6.8 | ⚠️ `minWidth(): number` | idem | 3 testes |
| 14.6.9 | ⚠️ `private determineMaxIndents()` | idem | 3 testes |
| 14.6.10 | ⚠️ `private hasScrollbar(): boolean` | idem | 3 testes |
| 14.6.11 | ⚠️ `to_html(): XMLElementLike` — **regra de header:** se **todas** as colunas têm `cell1.rows === 2 && !cell1.special`, merge (1 header); senão, 2 headers | idem | 8 testes |
| 14.6.12 | Teste: header merge | idem | 1 teste |
| 14.6.13 | Teste: 2 headers | idem | 1 teste |
| 14.6.14 | Teste: scrollbar | idem | 2 testes |
| 14.6.15 | ⚠️ `to_csv(csv = [[]], startColumn = 0): unknown[][] \| number` | idem | 5 testes |
| 14.6.16 | Teste: `to_csv` com 2 linhas | idem | 1 teste |
| 14.6.17 | Teste: `to_csv` com startColumn > 0 | idem | 1 teste |
| 14.6.18 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.7 — `ReportTableColumn`

**⚠️ RUBY: `reports/ReportTableColumn.rb` (~80 linhas)**

**Pré-requisitos:** 14.6, 14.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.7.1 | Criar `packages/report/src/report-table-column.ts` com `class ReportTableColumn` | idem | `deno check` |
| 14.7.2 | Campos: `table`, `definition: TableColumnDefinition \| null`, `cell1: ReportTableCell`, `cell2: ReportTableCell`, `scrollbar: boolean` | idem | `deno check` |
| 14.7.3 | ⚠️ Constructor `(table, definition, title)` — cria `cell1` e `cell2` com `bold = true`, `padding = 5` | idem | 5 testes |
| 14.7.4 | ⚠️ `minWidth(): number` | idem | 3 testes |
| 14.7.5 | ⚠️ `to_html(row: 1 \| 2): XMLElementLike` | idem | 4 testes |
| 14.7.6 | ⚠️ `to_csv(csv, startColumn): number` | idem | 3 testes |

---

### 14.8 — `ReportTableLine`

**⚠️ RUBY: `reports/ReportTableLine.rb` (~130 linhas)**

**Pré-requisitos:** 14.6, 14.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.8.1 | Criar `packages/report/src/report-table-line.ts` com `class ReportTableLine` | idem | `deno check` |
| 14.8.2 | Campos: `table`, `property`, `scopeLine`, `private cells`, `height = 21`, `indentation = 0` | idem | `deno check` |
| 14.8.3 | Campos: `fontSize = 12`, `bold`, `no`, `lineNo`, `subLineNo` | idem | `deno check` |
| 14.8.4 | Constructor `(table, property, scopeLine)` | idem | 3 testes |
| 14.8.5 | ⚠️ `last(count = 0): ReportTableCell \| null` | idem | 4 testes |
| 14.8.6 | ⚠️ `addCell(cell): void` | idem | 2 testes |
| 14.8.7 | ⚠️ `scopeProperty(): PropertyTreeNode \| null` | idem | 2 testes |
| 14.8.8 | ⚠️ `to_html(): XMLElementLike` | idem | 4 testes |
| 14.8.9 | ⚠️ `to_csv(csv, startColumn, lineIdx): number` | idem | 3 testes |
| 14.8.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.9 — `ReportTableCell` + `PlaceHolderCell`

**⚠️ RUBY: `reports/ReportTableCell.rb` (arquivo inteiro — ~400 linhas)**
**🔎 CHEAT: §5 strings, §12 Categoria B (escape, tooltip)**

**Pré-requisitos:** 14.6, 12.4 (`RichTextIntermediate`).

#### 14.9.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.9.1.1 | Criar `packages/report/src/report-table-cell.ts` com `class ReportTableCell` | idem | `deno check` |
| 14.9.1.2 | Campos: `line`, `headerCell`, `query`, `text`, `data`, `special`, `category` | idem | `deno check` |
| 14.9.1.3 | Campos: `cellColor`, `fontColor`, `bold`, `fontSize`, `alignment`, `indent`, `width`, `rows`, `columns`, `padding` | idem | `deno check` |
| 14.9.1.4 | Campos: `hidden`, `icon`, `iconTooltip`, `tooltip`, `showTooltipHint`, `force_string` | idem | `deno check` |
| 14.9.1.5 | Constructor `(line, query, text?, headerCell = false)` — `rows = 1`, `columns = 1`, `alignment = 'left'` | idem | 5 testes |

#### 14.9.2 — Métodos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.9.2.1 | ⚠️ `equals(other): boolean` | idem | 5 testes |
| 14.9.2.2 | ⚠️ `to_html(): XMLElementLike \| null` — dispatch por `special` | idem | 2 testes |
| 14.9.2.3 | Teste: `category` default `'tabcell'` | idem | 1 teste |
| 14.9.2.4 | Teste: `to_html` simples | idem | 1 teste |
| 14.9.2.5 | Teste: `to_html` com indent | idem | 1 teste |
| 14.9.2.6 | Teste: `to_html` com icon | idem | 1 teste |
| 14.9.2.7 | Teste: `to_html` com tooltip | idem | 1 teste |
| 14.9.2.8 | Teste: `to_html` hidden | idem | 1 teste |
| 14.9.2.9 | Teste: `to_html` special | idem | 1 teste |
| 14.9.2.10 | ⚠️ `to_csv(csv, columnIdx, lineIdx): number` | idem | 4 testes |
| 14.9.2.11 | Teste: `to_csv` com indent | idem | 1 teste |
| 14.9.2.12 | Teste: `to_csv` com `strToNative` | idem | 1 teste |

#### 14.9.3 — Helpers privados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.9.3.1 | ⚠️ `private calculateIndentation()` | idem | 3 testes |
| 14.9.3.2 | ⚠️ `private cellStyle(): string` | idem | 4 testes |
| 14.9.3.3 | ⚠️ `private cellIcon(cell): XMLElementLike \| null` | idem | 3 testes |
| 14.9.3.4 | ⚠️ `private cellLabel(): [XMLElementLike \| null, RichTextIntermediate \| null]` | idem | 3 testes |
| 14.9.3.5 | ⚠️ `private shortVersion(text, width): [string, boolean]` | idem | 4 testes |
| 14.9.3.6 | ⚠️ `private addHtmlTooltip(tooltip, trigger, hook?): void` | idem | 3 testes |

#### 14.9.4 — `PlaceHolderCell`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.9.4.1 | Criar `packages/report/src/placeholder-cell.ts` com `class PlaceHolderCell` | idem | `deno check` |
| 14.9.4.2 | Campos: `line`, `embeddedLine` | idem | `deno check` |
| 14.9.4.3 | Constructor `(line, embeddedLine)` | idem | 2 testes |
| 14.9.4.4 | ⚠️ `to_csv(csv, columnIdx, lineIdx): number` — delega para `embeddedLine` | idem | 3 testes |
| 14.9.4.5 | `to_html(): null` | idem | 1 teste |
| 14.9.4.6 | Teste: `PlaceHolderCell.to_csv` delega corretamente | idem | 1 teste |
| 14.9.4.7 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.10 — `ReportTableLegend`

**⚠️ RUBY: `reports/ReportTableLegend.rb` (~180 linhas)**

**Pré-requisitos:** 12.1 (`XMLElementLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.10.1 | Criar `packages/report/src/report-table-legend.ts` com `class ReportTableLegend` | idem | `deno check` |
| 14.10.2 | Campos: `showGanttItems`, `private ganttItems`, `private calendarItems` | idem | `deno check` |
| 14.10.3 | ⚠️ `addGanttItem(text, color): void` — dedup | idem | 3 testes |
| 14.10.4 | ⚠️ `addCalendarItem(text, color): void` — dedup | idem | 3 testes |
| 14.10.5 | ⚠️ `to_html(): XMLElementLike \| null` — `null` se vazio | idem | 3 testes |
| 14.10.6 | ⚠️ `private headlineToHTML(text)` | idem | 2 testes |
| 14.10.7 | ⚠️ `private ganttItemToHTML(itemRef, name, width)` | idem | 3 testes |
| 14.10.8 | ⚠️ `private itemToHTML(itemRef)` | idem | 2 testes |
| 14.10.9 | ⚠️ `private itemsToHTML(items)` | idem | 2 testes |
| 14.10.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco C — Reports base

### 14.11 — `Report` (completar)

**⚠️ RUBY: `reports/Report.rb` (arquivo inteiro — ~500 linhas)**

**Pré-requisitos:** 14.2, 14.3, 14.6–14.10, Fase 5 (`Report`), Fase 9 (`PropertyTreeNode`).

#### 14.11.1 — `generateIntermediateFormat`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.11.1.1 | ⚠️ `generateIntermediateFormat(): void` — se `scenarios.empty`, `warning('all_scenarios_disabled')` | `packages/report/src/report.ts` | 2 testes |
| 14.11.1.2 | ⚠️ Dispatch por `typeSpec`: `accountreport` → `AccountListRE` | idem | 1 teste |
| 14.11.1.3 | `export` → `ExportRE`; `iCal` → `ICalReport`; `niku` → `NikuReport` | idem | 3 testes |
| 14.11.1.4 | `resourcereport` → `ResourceListRE`; `tagfile` → `TagFile`; `textreport` → `TextReport` | idem | 3 testes |
| 14.11.1.5 | `taskreport` → `TaskListRE`; `tracereport` → `TraceReport` | idem | 2 testes |
| 14.11.1.6 | `statusSheet` / `timeSheet` → stubs (Fase 18) | idem | 2 testes |
| 14.11.1.7 | `content.generateIntermediateFormat()` | idem | 1 teste |

#### 14.11.2 — `generate`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.11.2.1 | ⚠️ `generate(requestedFormats?: string[]): number` — `oldTimeZone = TjTime.setTimeZone(this.get('timezone'))` | idem | 2 testes |
| 14.11.2.2 | `generateIntermediateFormat()` | idem | 1 teste |
| 14.11.2.3 | ⚠️ Para cada `format`: se `name === ''`, `error('empty_report_file_name')` | idem | 2 testes |
| 14.11.2.4 | ⚠️ Dispatch: `iCal`, `html`, `csv`, `ctags`, `niku`, `tjp`, `mspxml` | idem | 7 testes |
| 14.11.2.5 | `TjTime.setTimeZone(oldTimeZone)` no final | idem | 1 teste |
| 14.11.2.6 | Retorna `0` | idem | 1 teste |

#### 14.11.3 — Saídas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.11.3.1 | ⚠️ `to_html(): XMLElementLike \| null` | idem | 3 testes |
| 14.11.3.2 | ⚠️ `interactive?(): boolean` | idem | 2 testes |
| 14.11.3.3 | ⚠️ `private generateHTML(): string \| null` — retorna string (ADR 026) | idem | 3 testes |
| 14.11.3.4 | ⚠️ `private generateCSV(): unknown[][] \| null` | idem | 2 testes |
| 14.11.3.5 | ⚠️ `private generateTJP(): string \| null` | idem | 2 testes |
| 14.11.3.6 | ⚠️ `private generateMspXml(): string \| null` | idem | 2 testes |
| 14.11.3.7 | ⚠️ `private generateNiku(): string \| null` | idem | 2 testes |
| 14.11.3.8 | ⚠️ `private generateICal(): string \| null` | idem | 2 testes |
| 14.11.3.9 | ⚠️ `private generateCTags(): string \| null` | idem | 2 testes |
| 14.11.3.10 | ⚠️ `private copyAuxiliaryFiles(): void` — no-op no browser | idem | 1 teste |
| 14.11.3.11 | ⚠️ `private absoluteFileName(name): string` — prepend `outputDir` | idem | 3 testes |
| 14.11.3.12 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.12 — `TableReport`

**⚠️ RUBY: `reports/TableReport.rb` (arquivo inteiro — ~600 linhas)**
**🔎 CHEAT: §3 `Array` de `Array`, §12 Categoria B (float format)**

**Pré-requisitos:** 14.3, 14.4, 14.6–14.11.

#### 14.12.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.1.1 | Criar `packages/report/src/table-report.ts` com `abstract class TableReport extends ReportBase` | idem | `deno check` |
| 14.12.1.2 | Campos: `legend: ReportTableLegend`, `protected table: ReportTable`, `protected columns: Map<TableColumnDefinition, TableReportColumn>` | idem | `deno check` |
| 14.12.1.3 | Static `propertiesById: Map<string, [string, boolean, 'left' \| 'right', boolean]>` — ~40 entradas | idem | 1 teste (contagem ≥ 40) |
| 14.12.1.4 | Static `propertiesByType: Map<AttributeType, [boolean, 'left' \| 'right']>` | idem | `deno check` |

#### 14.12.2 — Métodos estáticos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.2.1 | ⚠️ `static defaultColumnTitle(id): string` | idem | 4 testes |
| 14.12.2.2 | ⚠️ `static indent(colId, propertyType): boolean` | idem | 4 testes |
| 14.12.2.3 | ⚠️ `static alignment(colId, attrType): 'left' \| 'center' \| 'right'` | idem | 4 testes |
| 14.12.2.4 | ⚠️ `static calculated?(colId): boolean` | idem | 3 testes |
| 14.12.2.5 | ⚠️ `static scenarioSpecific?(colId): boolean` | idem | 3 testes |

#### 14.12.3 — Saídas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.3.1 | ⚠️ `to_html(): XMLElementLike[]` | idem | 3 testes |
| 14.12.3.2 | ⚠️ `to_csv(): unknown[][]` | idem | 3 testes |

#### 14.12.4 — Protected helpers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.4.1 | ⚠️ `protected adjustColumnPeriod(columnDef, tasks, scenarios): void` | idem | 4 testes |
| 14.12.4.2 | ⚠️ `protected generateHeaderCell(columnDef): void` | idem | 3 testes |
| 14.12.4.3 | ⚠️ `protected generateAccountList(accountList, lineOffset, mode): number` | idem | 4 testes |
| 14.12.4.4 | ⚠️ `protected generateTaskList(taskList, resourceList, scopeLine): number` | idem | 5 testes |
| 14.12.4.5 | ⚠️ `protected generateResourceList(resourceList, taskList, scopeLine): number` | idem | 4 testes |

#### 14.12.5 — Private helpers (parte 1)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.5.1 | ⚠️ `private genCalChartHeader(columnDef, t, rEnd, sameTimeNextFunc, timeformat1, timeformat2): void` | idem | 3 testes |
| 14.12.5.2 | ⚠️ `private generateTableCell(line, columnDef, query): boolean` | idem | 4 testes |
| 14.12.5.3 | ⚠️ `private genStandardCell(query, line, columnDef): boolean` | idem | 3 testes |
| 14.12.5.4 | ⚠️ `private genCalculatedCell(query, line, columnDef): boolean` | idem | 3 testes |
| 14.12.5.5 | ⚠️ `private genCalChartAccountCell(query, line, columnDef, t, sameTimeNextFunc): void` | idem | 3 testes |
| 14.12.5.6 | ⚠️ `private genCalChartTaskCell(query, line, columnDef, t, sameTimeNextFunc): void` | idem | 3 testes |
| 14.12.5.7 | ⚠️ `private genCalChartResourceCell(query, line, columnDef, t, sameTimeNextFunc): void` | idem | 3 testes |

#### 14.12.6 — Private helpers (parte 2)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.6.1 | ⚠️ `private setStandardCellAttributes(query, cell, columnDef, attrType, line): void` | idem | 4 testes |
| 14.12.6.2 | ⚠️ `private setCustomCellAttributes(cell, columnDef, query): void` | idem | 3 testes |
| 14.12.6.3 | ⚠️ `private setScenarioSettings(cell, scenarioIdx, scenarioSpecific): boolean` | idem | 4 testes |
| 14.12.6.4 | ⚠️ `private newCell(query, line): ReportTableCell` | idem | 3 testes |
| 14.12.6.5 | ⚠️ `private setIndent(line, propertyRoot, treeMode): void` | idem | 3 testes |
| 14.12.6.6 | ⚠️ `private setAccountCellBgColor(query, line, cell): void` | idem | 3 testes |
| 14.12.6.7 | ⚠️ `private checkCellText(cell): void` | idem | 3 testes |
| 14.12.6.8 | ⚠️ `private tryCellMerging(cell, line, firstCell): void` | idem | 4 testes |

#### 14.12.7 — Testes agregados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.12.7.1 | Teste: `propertiesById` tem ~40 entradas | idem | 1 teste |
| 14.12.7.2 | Teste: `setScenarioSettings` com 1 cenário | idem | 1 teste |
| 14.12.7.3 | Teste: `setScenarioSettings` com 2 cenários | idem | 1 teste |
| 14.12.7.4 | Teste: `newCell` container bold | idem | 1 teste |
| 14.12.7.5 | Teste: `checkCellText` com erro | idem | 1 teste |
| 14.12.7.6 | Teste: `tryCellMerging` | idem | 1 teste |

---

### 14.13 — `ColumnTable`

**⚠️ RUBY: `reports/ColumnTable.rb` (~80 linhas)**

**Pré-requisitos:** 14.6.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.13.1 | Criar `packages/report/src/column-table.ts` com `class ColumnTable extends ReportTable` | idem | `deno check` |
| 14.13.2 | Campo: `viewWidth: number \| null` | idem | `deno check` |
| 14.13.3 | ⚠️ Constructor: `headerFontSize = 10`, `embedded = true` | idem | 3 testes |
| 14.13.4 | ⚠️ `to_html(): XMLElementLike` — `td` com `rowspan = 2 + lines.length + 1` | idem | 4 testes |
| 14.13.5 | Teste: `embedded === true` | idem | 1 teste |
| 14.13.6 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco D — Reports específicos

### 14.14 — `TaskListRE`

**⚠️ RUBY: `reports/TaskListRE.rb` (~80 linhas)**
**🔎 CHEAT: §3 `PropertyList` + `filterTaskList`**

**Pré-requisitos:** 14.12.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.14.1 | Criar `packages/report/src/task-list-re.ts` com `class TaskListRE extends TableReport` | idem | `deno check` |
| 14.14.2 | Constructor `(report)` | idem | 1 teste |
| 14.14.3 | ⚠️ `generateIntermediateFormat(): void` — chama `super.generateIntermediateFormat()` | idem | 1 teste |
| 14.14.4 | ⚠️ Prepara `taskList`: `PropertyList`, `includeAdopted`, `setSorting(sortTasks)`, `filterTaskList`, `sort`, `checkForDuplicates` | idem | 5 testes |
| 14.14.5 | ⚠️ Prepara `resourceList`: **sem filtro** (para `isdutyof()`) | idem | 2 testes |
| 14.14.6 | ⚠️ Para cada coluna: `adjustColumnPeriod`, `generateHeaderCell` | idem | 2 testes |
| 14.14.7 | ⚠️ `generateTaskList(taskList, resourceList, null)` | idem | 2 testes |
| 14.14.8 | Teste: `generateIntermediateFormat` básico | idem | 1 teste |
| 14.14.9 | Teste: `columns` com `chart` | idem | 1 teste |
| 14.14.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.15 — `ResourceListRE`

**⚠️ RUBY: `reports/ResourceListRE.rb` (~90 linhas)**

**Pré-requisitos:** 14.12.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.15.1 | Criar `packages/report/src/resource-list-re.ts` com `class ResourceListRE extends TableReport` | idem | `deno check` |
| 14.15.2 | Constructor `(report)` | idem | 1 teste |
| 14.15.3 | ⚠️ `generateIntermediateFormat(): void` — `resourceList` filtrado | idem | 2 testes |
| 14.15.4 | ⚠️ `taskList` **sem filtro** | idem | 2 testes |
| 14.15.5 | ⚠️ `assignedTaskList`: para cada resource, `filterTaskList(taskList, resource, ...)`; união | idem | 4 testes |
| 14.15.6 | ⚠️ Para cada coluna: `adjustColumnPeriod(columnDef, assignedTaskList, scenarios)`, `generateHeaderCell` | idem | 2 testes |
| 14.15.7 | ⚠️ `generateResourceList(resourceList, taskList, null)` | idem | 2 testes |
| 14.15.8 | Teste: `generateIntermediateFormat` básico | idem | 1 teste |
| 14.15.9 | Teste: `assignedTaskList` correto | idem | 1 teste |
| 14.15.10 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

### 14.16 — `AccountListRE`

**⚠️ RUBY: `reports/AccountListRE.rb` (~120 linhas)**
**🔎 CHEAT: §3 `createBalanceAccount` (Fase 8)**

**Pré-requisitos:** 14.12, Fase 8 (`createBalanceAccount`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.16.1 | Criar `packages/report/src/account-list-re.ts` com `class AccountListRE extends TableReport` | idem | `deno check` |
| 14.16.2 | Constructor `(report)` | idem | 1 teste |
| 14.16.3 | ⚠️ `generateIntermediateFormat(): void` — `accountList` filtrado | idem | 2 testes |
| 14.16.4 | ⚠️ Para cada coluna: `adjustColumnPeriod(columnDef)`, `generateHeaderCell` | idem | 2 testes |
| 14.16.5 | ⚠️ Se `costAccount && revenueAccount` (modo balance): split em `costAccountList` e `revenueAccountList` | idem | 3 testes |
| 14.16.6 | Garantir que top-level estão inclusos | idem | 2 testes |
| 14.16.7 | ⚠️ `generateAccountList(costAccountList, 0, null)` | idem | 1 teste |
| 14.16.8 | ⚠️ `generateAccountList(revenueAccountList, costAccountList.length, null)` | idem | 1 teste |
| 14.16.9 | ⚠️ Cria `totalAccount` via `createBalanceAccount` | idem | 1 teste |
| 14.16.10 | ⚠️ `generateAccountList([totalAccount], cost + revenue length, null)` | idem | 1 teste |
| 14.16.11 | ⚠️ `removeBalanceAccount` | idem | 1 teste |
| 14.16.12 | ⚠️ Senão, `generateAccountList(accountList, 0, null)` | idem | 1 teste |

---

### 14.17 — `TextReport`

**⚠️ RUBY: `reports/TextReport.rb` (~120 linhas)**

**Pré-requisitos:** 14.3.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.17.1 | Criar `packages/report/src/text-report.ts` com `class TextReport extends ReportBase` | idem | `deno check` |
| 14.17.2 | Campos: `header`, `left`, `center`, `right`, `footer` (RichTextIntermediate) | idem | `deno check` |
| 14.17.3 | Campos: `lWidth`, `cWidth`, `rWidth`, `lPadding`, `cPadding`, `rPadding` | idem | `deno check` |
| 14.17.4 | ⚠️ `generateIntermediateFormat()` — calcula larguras conforme presença de seções | idem | 5 testes |
| 14.17.5 | Teste: só `center` | idem | 1 teste |
| 14.17.6 | Teste: `left + center` | idem | 1 teste |
| 14.17.7 | Teste: `left + center + right` | idem | 1 teste |
| 14.17.8 | Teste: `left + right` sem `center` | idem | 1 teste |
| 14.17.9 | ⚠️ `to_html(): XMLElementLike[]` | idem | 3 testes |
| 14.17.10 | ⚠️ `to_csv(): null` — warning `text_report_no_csv` | idem | 2 testes |

---

### 14.18 — `ExportRE` + `TjpExportRE` + `MspXmlRE`

**⚠️ RUBY: `reports/ExportRE.rb` (~40 linhas), `TjpExportRE.rb` (~400 linhas), `MspXmlRE.rb` (~350 linhas)**

**Pré-requisitos:** 14.3, Fases 5 (`Project`), 7 (`TaskScenario`), 8 (`Charge`).

#### 14.18.1 — `ExportRE`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.18.1.1 | Criar `packages/report/src/export-re.ts` com `class ExportRE extends ReportBase` | idem | `deno check` |
| 14.18.1.2 | `generateIntermediateFormat()` — vazio | idem | 1 teste |
| 14.18.1.3 | ⚠️ `to_tjp(): string` — delega para `TjpExportRE` | idem | 2 testes |
| 14.18.1.4 | ⚠️ `to_mspxml(): string` — delega para `MspXmlRE` | idem | 2 testes |

#### 14.18.2 — `TjpExportRE`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.18.2.1 | Criar `packages/report/src/tjp-export-re.ts` com `class TjpExportRE` | idem | `deno check` |
| 14.18.2.2 | Constructor `(report)` | idem | 1 teste |
| 14.18.2.3 | ⚠️ `to_tjp(): string` — prepara `resourceList` e `taskList` filtrados | idem | 3 testes |
| 14.18.2.4 | ⚠️ `getBookings()` — coleta bookings por cenário | idem | 3 testes |
| 14.18.2.5 | ⚠️ `generateProjectProperty()` se `definitions` inclui `'project'` | idem | 2 testes |
| 14.18.2.6 | ⚠️ `generateFlagDeclaration()` | idem | 2 testes |
| 14.18.2.7 | ⚠️ `generateProjectIDs()` | idem | 2 testes |
| 14.18.2.8 | ⚠️ `generateShiftList()` | idem | 2 testes |
| 14.18.2.9 | ⚠️ `generateResourceList()` | idem | 2 testes |
| 14.18.2.10 | ⚠️ `generateTaskList()` | idem | 2 testes |
| 14.18.2.11 | ⚠️ `generateTaskAttributes()`, `generateResourceAttributes()` | idem | 4 testes |
| 14.18.2.12 | Teste: project minimal | idem | 1 teste |
| 14.18.2.13 | Teste: com `projectid` | idem | 1 teste |
| 14.18.2.14 | Teste: com flags | idem | 1 teste |
| 14.18.2.15 | Teste: com bookings | idem | 1 teste |

#### 14.18.3 — `MspXmlRE`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.18.3.1 | Criar `packages/report/src/msp-xml-re.ts` com `class MspXmlRE` | idem | `deno check` |
| 14.18.3.2 | Constructor `(report)` | idem | 1 teste |
| 14.18.3.3 | ⚠️ `to_mspxml(): string` — `XMLDocument` com header, `Project` com `xmlns` | idem | 3 testes |
| 14.18.3.4 | ⚠️ `generateProjectAttributes`, `generateTasks`, `generateResources`, `generateAssignments` | idem | 6 testes |
| 14.18.3.5 | Teste: project attributes | idem | 1 teste |
| 14.18.3.6 | Teste: tasks | idem | 1 teste |
| 14.18.3.7 | Teste: resources | idem | 1 teste |
| 14.18.3.8 | Teste: assignments | idem | 1 teste |

---

### 14.19 — `ICalReport` + `ICalendar` (mínimo)

**⚠️ RUBY: `reports/ICalReport.rb` (~200 linhas) + `ICalendar.rb` (~330 linhas)**

**Nota:** `ICalendar` **completo** é Fase 17. Aqui implementamos versão **mínima** com `XMLElementLike` + estrutura manual.

**Pré-requisitos:** 14.3, Fase 5 (`Task`, `Resource`).

#### 14.19.1 — `ICalendar` mínimo

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.19.1.1 | Criar `packages/report/src/i-calendar.ts` com `class Person` | idem | `deno check` |
| 14.19.1.2 | `class Component` com `to_s()`, `dateTime`, `foldLines` | idem | `deno check` |
| 14.19.1.3 | `class Todo extends Component` — `priority`, `percentComplete` | idem | `deno check` |
| 14.19.1.4 | `class Event extends Component` | idem | `deno check` |
| 14.19.1.5 | `class Journal extends Component` | idem | `deno check` |
| 14.19.1.6 | ⚠️ `class ICalendar` — `uid`, `creationDate`, `to_s()`, `dateTime(date)`, `foldLines(str)` | idem | 6 testes |
| 14.19.1.7 | Teste: `to_s` com 1 todo | idem | 1 teste |
| 14.19.1.8 | Teste: `foldLines` (linhas de 75 chars) | idem | 2 testes |
| 14.19.1.9 | Teste: CRLF | idem | 1 teste |

#### 14.19.2 — `ICalReport`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.19.2.1 | Criar `packages/report/src/i-cal-report.ts` com `class ICalReport extends ReportBase` | idem | `deno check` |
| 14.19.2.2 | ⚠️ `generateIntermediateFormat()` — `taskList` filtrado | idem | 3 testes |
| 14.19.2.3 | Para cada task: cria `Todo` | idem | 2 testes |
| 14.19.2.4 | Se tem responsible com email, `setOrganizer` | idem | 2 testes |
| 14.19.2.5 | `assignedresources` viram `attendees` | idem | 2 testes |
| 14.19.2.6 | `Event` para leaf não-milestone (se `novevents === false`) | idem | 3 testes |
| 14.19.2.7 | `Journal` para journal entries (stub Fase 16) | idem | 1 teste |
| 14.19.2.8 | ⚠️ `to_iCal(): string` | idem | 2 testes |

---

### 14.20 — `NikuReport` + `TraceReport` + `TagFile`

**⚠️ RUBY: `reports/NikuReport.rb` (~350 linhas), `TraceReport.rb` (~250 linhas), `TagFile.rb` (~120 linhas)**

**Pré-requisitos:** 14.3, 14.22 (`ChartPlotter`).

#### 14.20.1 — `NikuReport`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.20.1.1 | Criar `packages/report/src/niku-report.ts` com `class NikuReport extends ReportBase` | idem | `deno check` |
| 14.20.1.2 | ⚠️ `generateIntermediateFormat()` — `computeResourceTotals()`, `collectProjects()`, `computeProjectAllocations()` | idem | 5 testes |
| 14.20.1.3 | ⚠️ `to_html()`, `to_niku()`, `to_csv()` | idem | 4 testes |
| 14.20.1.4 | Teste: `computeResourceTotals` | idem | 1 teste |
| 14.20.1.5 | Teste: `collectProjects` | idem | 1 teste |
| 14.20.1.6 | Teste: `to_niku` | idem | 1 teste |

#### 14.20.2 — `TraceReport`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.20.2.1 | Criar `packages/report/src/trace-report.ts` com `class TraceReport extends ReportBase` | idem | `deno check` |
| 14.20.2.2 | ⚠️ `generateIntermediateFormat()` — `headers = ['Date', ...]` | idem | 2 testes |
| 14.20.2.3 | Se arquivo existe, lê | idem | 2 testes |
| 14.20.2.4 | ⚠️ Se headers mudaram, `TableColumnSorter` (Fase 14.5) | idem | 3 testes |
| 14.20.2.5 | Adiciona linha atual | idem | 2 testes |
| 14.20.2.6 | Ordena | idem | 1 teste |
| 14.20.2.7 | ⚠️ `to_html()` — SVG via `ChartPlotter` | idem | 3 testes |
| 14.20.2.8 | ⚠️ `to_csv()` | idem | 2 testes |

#### 14.20.3 — `TagFile`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.20.3.1 | Criar `packages/report/src/tag-file.ts` com `class TagFile extends ReportBase` | idem | `deno check` |
| 14.20.3.2 | ⚠️ `generateIntermediateFormat()` — adiciona resources, tasks, reports como `TagFileEntry` | idem | 4 testes |
| 14.20.3.3 | ⚠️ `to_ctags(): string` | idem | 2 testes |
| 14.20.3.4 | Teste: coleta resources/tasks/reports | idem | 1 teste |
| 14.20.3.5 | Teste: `to_ctags` | idem | 1 teste |
| 14.20.3.6 | Re-exportar `NikuReport`, `TraceReport`, `TagFile` em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco E — Navigator

### 14.21 — `Navigator` + completar `RTFNavigator`

**⚠️ RUBY: `reports/Navigator.rb` (~250 linhas) + `RichText/RTFNavigator.rb` (~50 linhas)**

**Pré-requisitos:** 14.3, Fase 12 (`RTFNavigator` stub).

#### 14.21.1 — `NavigatorElement`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.21.1.1 | Criar `packages/report/src/navigator.ts` com `class NavigatorElement` | idem | `deno check` |
| 14.21.1.2 | Campos: `parent`, `label`, `url`, `elements: NavigatorElement[]`, `current: boolean` | idem | `deno check` |
| 14.21.1.3 | Constructor `(parent, label?, url?)` | idem | 3 testes |
| 14.21.1.4 | ⚠️ `to_html(html?: XMLElementLike): XMLElementLike` | idem | 3 testes |
| 14.21.1.5 | ⚠️ `to_s(indent = 0): void` — debug | idem | 2 testes |

#### 14.21.2 — `Navigator`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.21.2.1 | Criar `class Navigator` com campos `id`, `project`, `hideReport` | idem | `deno check` |
| 14.21.2.2 | Constructor `(id, project)` | idem | 2 testes |
| 14.21.2.3 | ⚠️ `generate(allReports, currentReports, reportDef, parentElement): void` | idem | 4 testes |
| 14.21.2.4 | ⚠️ `to_html(): XMLElementLike \| null` | idem | 3 testes |
| 14.21.2.5 | ⚠️ `private filterReports(): PropertyList<Report>` | idem | 3 testes |
| 14.21.2.6 | ⚠️ `private normalizeURL(url1, url2): string` | idem | 3 testes |
| 14.21.2.7 | ⚠️ `private findReportURL(report, allReports, reportDef): string \| null` | idem | 3 testes |

#### 14.21.3 — Completar `RTFNavigator`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.21.3.1 | ⚠️ Completar `to_html(args)` em `RTFNavigator` — `id = args.id` obrigatório | `packages/richtext/src/handlers/rtf-navigator.ts` | 3 testes |
| 14.21.3.2 | `navigator = project.navigators[id]`; se não existe, `error` | idem | 2 testes |
| 14.21.3.3 | Retorna `navigator.to_html()` | idem | 2 testes |
| 14.21.3.4 | Remover `NotYetImplementedError` | idem | 1 teste |

---

## Bloco F — ChartPlotter

### 14.22 — `ChartPlotter` + `Painter` (mínimo)

**⚠️ RUBY: `reports/ChartPlotter.rb` (~400 linhas) + `Painter/*.rb`**

**Nota:** `Painter` completo é Fase 17. Aqui implementamos versão **mínima** local com `group`, `line`, `rect`, `text`, `circle`, `polyline`, `color`, `to_svg()`.

**Pré-requisitos:** 14.1, 12.1 (`XMLElementLike`).

#### 14.22.1 — `Painter` mínimo

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.22.1.1 | Criar `packages/report/src/painter-min.ts` com `class PainterMin` | idem | `deno check` |
| 14.22.1.2 | Campos: `width`, `height`, `private elements` | idem | `deno check` |
| 14.22.1.3 | ⚠️ `group(attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.4 | ⚠️ `line(x1, y1, x2, y2, attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.5 | ⚠️ `rect(x, y, w, h, attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.6 | ⚠️ `text(x, y, str, attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.7 | ⚠️ `circle(cx, cy, r, attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.8 | ⚠️ `polyline(points, attrs): XMLElementLike` | idem | 2 testes |
| 14.22.1.9 | ⚠️ `color(r, g, b): string` | idem | 2 testes |
| 14.22.1.10 | ⚠️ `to_svg(): XMLElementLike` | idem | 3 testes |

#### 14.22.2 — `ChartPlotter`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.22.2.1 | Criar `packages/report/src/chart-plotter.ts` com `class ChartPlotter` | idem | `deno check` |
| 14.22.2.2 | Campos: `width`, `height`, `data`, margens, `legendGap`, `markerWidth`, ... | idem | `deno check` |
| 14.22.2.3 | Campos: `labels`, `yData`, `xData`, `dataType`, `xMinDate`, `xMaxDate`, `yMinDate`, `yMaxDate`, `yMinVal`, `yMaxVal` | idem | `deno check` |
| 14.22.2.4 | ⚠️ `generate(): void` | idem | 2 testes |
| 14.22.2.5 | ⚠️ `to_svg(): string` | idem | 3 testes |
| 14.22.2.6 | ⚠️ `private analyzeData()` — datas inválidas lançam | idem | 4 testes |
| 14.22.2.7 | ⚠️ `private calcChartGeometry()` | idem | 3 testes |
| 14.22.2.8 | ⚠️ `private xLabels(painter)`, `private yLabels(painter)` | idem | 4 testes |
| 14.22.2.9 | ⚠️ `private x2c(x)`, `y2c(y)`, `xDate2c(date)`, `yDate2c(date)`, `yNum2c(number)` | idem | 5 testes |
| 14.22.2.10 | ⚠️ `private drawGrid(painter)` | idem | 2 testes |
| 14.22.2.11 | ⚠️ `private drawDataGraph(painter, ci, color)` | idem | 3 testes |
| 14.22.2.12 | ⚠️ `private drawLegendEntry(painter, ci, color)` | idem | 3 testes |
| 14.22.2.13 | ⚠️ `private setMarker(p, type, x, y)` | idem | 3 testes |
| 14.22.2.14 | Teste: `analyzeData` simple | idem | 1 teste |
| 14.22.2.15 | Teste: `to_svg` com 1 série | idem | 1 teste |
| 14.22.2.16 | Teste: `to_svg` com 2 séries | idem | 1 teste |
| 14.22.2.17 | Teste: `to_svg` com datas | idem | 1 teste |
| 14.22.2.18 | Re-exportar em `packages/report/mod.ts` | idem | `deno check` |

---

## Bloco G — Golden tests

### 14.23 — Golden tests (reports)

**⚠️ RUBY: 9 MWEs + `TestSuite/Reports/`**
**Usa:** `tj3` real

**Pré-requisitos:** 14.1–14.22, Fases 2–13.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 14.23.1 | Atualizar `scripts/golden/README.md` com seção de `reports` | idem | existe |
| 14.23.2 | Criar `scripts/golden/reports-mwe001.rb` a `reports-mwe009.rb` (9 scripts) — roda `tj3`, lê HTML gerado, extrai tabela principal | idem | 9 arquivos |
| 14.23.3 | Serializar em `reports.golden.json` | idem | JSON válido |
| 14.23.4 | Criar `scripts/golden/reports-syntax-correct.rb` — itera `TestSuite/Reports/` | idem | roda |
| 14.23.5 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 14.23.6 | Criar `packages/report/tests/golden/reports_golden_test.ts` | idem | verde |
| 14.23.7 | Para cada caso: constrói `Project`, cria `Report` equivalente, chama `report.generate()` | idem | ≥ 60 casos |
| 14.23.8 | Comparação HTML (normalizado, sem whitespace) | idem | 3 testes |
| 14.23.9 | Normalização: ordenar atributos, colapsar whitespace, substituir IDs gerados | idem | 4 testes |
| 14.23.10 | Cobertura ≥ 60 casos; commitar JSON em `packages/report/tests/golden/` | idem | versionado |
| 14.23.11 | Teste de regressão: rodar novamente e comparar | idem | 1 teste |
| 14.23.12 | Smoke test: `Report.generate()` retorna string (ADR 026) | idem | 1 teste |

---

## Bloco H — Verificação final

### 14.24 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 14.24.1 | `deno task check-all` verde | exit 0 |
| 14.24.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 14.24.3 | `grep -r "NotYetImplementedError" packages/report/src/` — apenas stubs de StatusSheet/TimeSheet (Fase 18) | ≤ 2 ocorrências |
| 14.24.4 | ADR 026 criada e commitada | git log |
| 14.24.5 | `Report`, `ReportBase`, `TableReport`, `TaskListRE`, `ResourceListRE`, `AccountListRE`, `TextReport`, `ExportRE`, `TjpExportRE`, `MspXmlRE`, `ICalReport`, `NikuReport`, `TraceReport`, `TagFile`, `Navigator`, `ChartPlotter`, `CSVFile`, `ReportContext` exportados em `packages/report/mod.ts` | `deno check` |
| 14.24.6 | `RTFNavigator`, `RTFReport`, `RTFReportLink` completos (stubs Fase 12 removidos) | 3 testes |
| 14.24.7 | `tests/integration/smoke_after_phase_14_test.ts` — cria `Project`, gera `Report` HTML; verifica Fase 13 (Markdown) | 1 teste |
| 14.24.8 | Auditoria: cada subfase do plano `fase-14-relatorios.md` tem tarefas correspondentes | grep |
| 14.24.9 | Corrigir numeração em `fase-14-relatorios.md` (`### 18.X` → `### 14.X`, `ADR 024` → `ADR 026`) | grep |
| 14.24.10 | Teste agregado: `Project.generateReports` end-to-end com 1 report | 1 teste |

---

## Notas para a IA

1. **Ordem:** 14.0 → 14.1 → 14.2 → 14.3 → 14.4 → 14.5 → 14.6 → 14.7 → 14.8 → 14.9 → 14.10 → 14.11 → 14.12 → 14.13 → 14.14 → 14.15 → 14.16 → 14.17 → 14.18 → 14.19 → 14.20 → 14.21 → 14.22 → 14.23 → 14.24.
2. **`TableReport` é o mais complexo.** Dividir em métodos testáveis.
3. **Ordem de `generateIntermediateFormat`** importa: prepara listas → header → lista.
4. **`resourceList` NÃO filtrado em `TaskListRE`.** Idem para `taskList` em `ResourceListRE`.
5. **`adjustColumnPeriod`** com chart/calendar: margem.
6. **`AccountListRE` balance mode:** criar `totalAccount`, remover depois.
7. **`ReportTable.to_html`:** header merge só se **todas** têm 2 rows.
8. **`ReportTableCell.to_html`:** `category` default `'tabcell'`.
9. **`CSVFile`:** `strToNative` para Integer/Float.
10. **`TjpExportRE`:** fidelidade textual.
11. **`MspXmlRE`:** usar `XMLElementLike` + serializer.
12. **`ICalendar.foldLines`:** linhas de 75 chars.
13. **Browser reports retornam strings.** ADR 026.
14. **`ChartPlotter`:** implementar `PainterMin` nesta fase (Fase 17 substitui).
15. **`RTFNavigator`, `RTFReport`, `RTFReportLink`:** completar stubs da Fase 12.
16. **Sem `any`.** Use `unknown` + type guards.
17. **Commit por subfase.** `feat(report): table-report`, etc.
18. **ADR 026** (não 024). **ADR 024** é RichText (Fase 12), **ADR 025** é Markdown (Fase 13).
19. **Não tocar em Fase 15 (Gantt).** `GanttChart` é coluna `chart`.
20. **Não tocar em Fase 17 (HTML/XML).** `XMLElementLike` é a interface atual.
21. **`copyAuxiliaryFiles` é no-op no browser.**
22. **`outputDir` mantido por compatibilidade, mas não escreve.**
23. **`TableReport.propertiesById`** tem ~40 entradas — preservar ordem.
24. **`PainterMin` é local** — não confundir com `Painter` real (Fase 17).
25. **Não usar `BatchProcessor`.**

---

## Notas específicas por subfase

### 14.0 — ADR 026

- **Reports retornam strings.**
- **`outputDir` é opcional.**

### 14.1 — CSVFile

- **Parser + writer.**
- **`marshal` escapa `;`, `"`, `\n`.**
- **`strToNative` converte para number.**

### 14.2 — ReportContext

- **Completar stub da Fase 9.**
- **`dynamicReportId` encadeado.**
- **`tasks`/`resources` são `PropertyList`.**

### 14.3 — ReportBase

- **`filterTaskList`, `filterResourceList`, `filterAccountList`.**
- **`standardFilterOps` com tree mode.**

### 14.4 — TableColumnDefinition

- **`CellSettingPattern` + `CellSettingPatternList`.**
- **~15 campos.**

### 14.5 — TableColumnSorter

- **Reordena colunas.**
- **Usado por TraceReport.**

### 14.6 — ReportTable

- **Header merge só se todas as colunas têm 2 rows.**
- **Scrollbar.**

### 14.7 — ReportTableColumn

- **`cell1` e `cell2`.**
- **`minWidth`.**

### 14.8 — ReportTableLine

- **`cells`, `height`, `indentation`.**
- **`scopeProperty`.**

### 14.9 — ReportTableCell

- **~25 campos.**
- **`to_html` com tooltip, icon, indent.**
- **`PlaceHolderCell` para tabela embutida.**

### 14.10 — ReportTableLegend

- **Símbolos do Gantt + calendário.**
- **Dedup.**

### 14.11 — Report (completar)

- **Dispatch por `typeSpec`.**
- **`generate()` percorre formats.**
- **Saídas retornam strings.**

### 14.12 — TableReport

- **~40 `propertiesById`.**
- **~25 métodos** (protected + private).
- **`generateTaskList`, `generateResourceList`, `generateAccountList`.**

### 14.13 — ColumnTable

- **Wrapper de `ReportTable`.**
- **Embutido em coluna `calendar`.**

### 14.14–14.16 — Reports específicos

- **`TaskListRE`, `ResourceListRE`, `AccountListRE`.**
- **`AccountListRE` tem modo balance.**

### 14.17 — TextReport

- **5 seções: header, left, center, right, footer.**
- **Larguras calculadas.**

### 14.18 — Exports

- **`ExportRE` delega.**
- **`TjpExportRE` (~400 linhas).**
- **`MspXmlRE` (~350 linhas).**

### 14.19 — ICalReport

- **`ICalendar` mínimo.**
- **RFC 5545 básico.**

### 14.20 — Niku, Trace, TagFile

- **`NikuReport` Clarity XML.**
- **`TraceReport` CSV + SVG via `ChartPlotter`.**
- **`TagFile` ctags.**

### 14.21 — Navigator

- **`NavigatorElement` + `Navigator`.**
- **Completar `RTFNavigator` stub.**

### 14.22 — ChartPlotter + PainterMin

- **`PainterMin` local (Fase 17 substitui).**
- **ChartPlotter gera SVG.**

### 14.23 — Golden tests

- **9 MWEs + `TestSuite/Reports/`.**
- **~60 casos.**
- **HTML normalizado.**

### 14.24 — Verificação

- **Sem stubs além de StatusSheet/TimeSheet (Fase 18).**
- **RTFReport, RTFReportLink, RTFNavigator completos.**
- **ADR 026 (não 024).**

---

**Fim do arquivo de tarefas da Fase 14.**