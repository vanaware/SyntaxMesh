# Fase 14 — Relatórios

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-relatorios.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 18–22 dias
> **Depende de:** Fases 2–13
> **Bloqueia:** Fases 15, 17, 20, 21

---

## 1. Contexto

Esta é uma das fases mais extensas do projeto. Ela restaura **todo o sistema de relatórios** do TaskJuggler: TaskReport, ResourceReport, AccountReport, TextReport, ExportReport, ICal, Niku, TraceReport, TagFile, TimeSheetReport, StatusSheetReport.

O sistema tem 3 camadas:

1. **Infraestrutura de tabela** — `ReportTable`, `ReportTableColumn`, `ReportTableLine`, `ReportTableCell`, `ReportTableLegend`. Modelam uma tabela HTML/CSV abstrata.

2. **Reports base** — `Report`, `ReportBase`, `TableReport`, `ColumnTable`. Orquestram a geração, aplicam filtros, dispatching.

3. **Reports específicos** — `TaskListRE`, `ResourceListRE`, `AccountListRE`, `TextReport`, `ExportRE`, `TjpExportRE`, `MspXmlRE`, `ICalReport`, `NikuReport`, `TraceReport`, `TagFile`.

A arquitetura é:

```
Report.generate()
    ↓ generateIntermediateFormat()
    ↓ dispatch por typeSpec
Content (ex: TaskListRE) ← ReportBase
    ↓ popula ReportTable
ReportTable → to_html() / to_csv()
```

### Reuso

- `Report` herda de `PropertyTreeNode` (Fase 4).
- `ReportBase` usa `Query` (Fase 11) para avaliar `LogicalExpression` (Fase 11) em `hidetask`, `hideresource`, etc.
- `ReportBase` usa `RichText` (Fase 12) para `headline`, `caption`, etc.
- `RTFReport` / `RTFReportLink` / `RTFNavigator` (Fase 12, stubs) são **completados** aqui.
- `GanttChart` (Fase 15) será usado como coluna `chart`.
- `XMLElement` (Fase 17) é usado por `HTMLDocument` — mas nesta fase usamos a interface `XMLElementLike` da Fase 12 (a Fase 17 substitui).

### Complexidade

- `TableReport` tem ~600 linhas em Ruby e é o coração.
- `TaskListRE`, `ResourceListRE`, `AccountListRE` são especializações.
- `AccountListRE` tem **modo balance** (com `costaccount`/`revenueaccount`).
- `ReportTable.to_html` tem 2 linhas de header com merge quando todas as colunas têm 2 rows.

### CSV vs HTML vs outros

Cada tipo de report tem `to_html()` e alguns têm `to_csv()`, `to_tjp()`, `to_mspxml()`, `to_niku()`, `to_iCal()`, `to_ctags()`.

### `ReportContext`

`ReportContext` (Fase 9, stub) é completado aqui: mantém `dynamicReportId`, `query`, backup de atributos para relatórios dinâmicos.

### `Navigator`

`Navigator` gera um menu de navegação baseado em hierarquia de reports.

### `RTFReport` / `RTFNavigator` completos

Ao final desta fase, `RTFReport`, `RTFReportLink` e `RTFNavigator` (Fase 12) deixam de lançar `NotYetImplementedError`.

---

## 2. Objetivo

Ao final desta fase:

- **Infraestrutura de tabela:** `ReportTable`, `ReportTableColumn`, `ReportTableLine`, `ReportTableCell`, `PlaceHolderCell`, `ReportTableLegend`, `TableColumnDefinition`, `CellSettingPattern`, `CellSettingPatternList`, `TableColumnSorter`, `ColumnTable`.
- **Reports base:** `Report` (completar), `ReportBase`, `TableReport`.
- **Reports específicos:** `TaskListRE`, `ResourceListRE`, `AccountListRE`, `TextReport`, `ExportRE`, `TjpExportRE`, `MspXmlRE`, `ICalReport`, `NikuReport`, `TraceReport`, `TagFile`.
- **Utilitários:** `CSVFile`, `ReportContext` (completar), `Navigator`, `ChartPlotter`.
- **Completar stubs:** `RTFReport`, `RTFReportLink`, `RTFNavigator` (Fase 12).
- **Integrar `Project.generateReports`** (Fase 9).
- **≥ 350 testes unitários** + **≥ 60 golden tests** (reports dos 9 MWEs + TestSuite).
- ADR 025 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/reports/` (e um em `lib/taskjuggler/`):

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Report.rb` | ~500 | **Alta** | **Crítica** |
| `ReportBase.rb` | ~250 | Média | **Crítica** |
| `TableReport.rb` | ~600 | **Altíssima** | **Crítica** |
| `ReportTable.rb` | ~250 | Alta | **Crítica** |
| `ReportTableColumn.rb` | ~80 | Baixa | **Crítica** |
| `ReportTableLine.rb` | ~130 | Média | **Crítica** |
| `ReportTableCell.rb` | ~400 | **Alta** | **Crítica** |
| `ReportTableLegend.rb` | ~180 | Média | Alta |
| `TableReportColumn.rb` | ~30 | Trivial | **Crítica** |
| `ColumnTable.rb` | ~80 | Média | Alta |
| `ReportContext.rb` | ~90 | Média | **Crítica** |
| `Navigator.rb` | ~250 | Alta | Alta |
| `TaskListRE.rb` | ~80 | Média | **Crítica** |
| `ResourceListRE.rb` | ~90 | Média | **Crítica** |
| `AccountListRE.rb` | ~120 | Média | **Crítica** |
| `TextReport.rb` | ~120 | Média | **Crítica** |
| `ExportRE.rb` | ~40 | Trivial | **Crítica** |
| `TjpExportRE.rb` | ~400 | **Alta** | **Crítica** |
| `MspXmlRE.rb` | ~350 | **Alta** | Alta |
| `ICalReport.rb` | ~200 | Média | Média |
| `NikuReport.rb` | ~350 | **Alta** | Baixa |
| `TraceReport.rb` | ~250 | Média | Média |
| `TagFile.rb` | ~120 | Baixa | Média |
| `ChartPlotter.rb` | ~400 | **Alta** | Média |
| `CSVFile.rb` | ~250 | Média | **Crítica** |
| `lib/taskjuggler/TableColumnDefinition.rb` | ~130 | Média | **Crítica** |
| `lib/taskjuggler/TableColumnSorter.rb` | ~70 | Baixa | Média |

**Nota:** ~5.000 linhas de Ruby. Dividir em **subfases pequenas**.

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/07-blueprint-engine6.md` | §2-6 Report + TableColumnDefinition | Estrutura |
| `docs/tj3-engine/08-blueprint-engine7.md` | §2-5 TaskListRE + ResourceListRE + TextReport | Reports específicos |
| `docs/tj3-engine/09-blueprint-engine8.md` | §2-6 ReportTable + Gantt components | Estrutura tabela |
| `docs/tj3-engine/10-blueprint-finance.md` | §6 AccountListRE (modo balance) | AccountListRE |

### 3.3 Casos de teste

- `docs/Learning/mwe001-009/` — 9 MWEs com reports.
- `docs/taskjuggler/test/TestSuite/Reports/` — casos.

### 3.4 Golden tests

Scripts Ruby `reports-mwe*.rb` para cada MWE. Extraem HTML/CSV dos reports e serializam. Teste TS compara.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `Report.generate` — dispatch por `typeSpec`

Ordem exata (do Ruby):
1. `generateIntermediateFormat`.
2. Para cada formato em `formats`:
   - Se `name` vazio, `error`.
   - Dispatch: `iCal`, `html`, `csv`, `ctags`, `niku`, `tjp`, `mspxml`.
3. Restaurar timezone.

Replicar.

### 4.2 `Report.generateHTML` usa `HTMLDocument`

Fase 17 implementa `HTMLDocument`. Nesta fase, usar `XMLElementLike` (Fase 12) para construir a árvore. Ou: implementar um `HTMLDocument` **mínimo** local.

**Decisão:** implementar `HTMLDocument` local nesta fase com `XMLElementLike`; Fase 17 substitui por versão completa.

### 4.3 `copyAuxiliaryFiles` — browser

Ruby copia CSS/ícones de `AppConfig.dataDirs`. No browser, não há filesystem. **Decisão:** `copyAuxiliaryFiles` é **no-op** nesta fase. Fase 20 (PWA) gera CSS/ícones via `fetch` + Service Worker.

### 4.4 `TableReport.filterTaskList` — herança de `LogicalFunction`

Usa `hideTask`, `rollupTask`, `openNodes`. `LogicalExpression` (Fase 11) já implementada.

### 4.5 `ReportTable.to_html` — 2 headers

Regra:
- Se **todas** as colunas têm `cell1.rows === 2` e `!cell1.special` → merge: 1 linha de header com `lineHeight * 2 + 1`.
- Senão → 2 linhas de header.

Replicar.

### 4.6 `ReportTableCell.to_html` — `category` default `'tabcell'`

Se `@category` é null, usa `'tabcell'`. Sempre tem `table` interna com `cellspacing=0`.

### 4.7 `TableReport.propertiesById` — mapa estático

Em Ruby, `@@propertiesById` é Hash com `~40` entradas. Replicar como `Map<string, [header, indent, align, scenarioSpecific]>`.

### 4.8 `TableReport.propertiesByType` — mapa por classe

`DateAttribute` → `[false, :left]`, etc. Replicar.

### 4.9 `TaskListRE.adjustColumnPeriod` — margem

Para colunas `chart`/`calendar`, adiciona margem (5% ou mais). Replicar.

### 4.10 `ResourceListRE` — não filtra `taskList` antes

O `taskList` é passado **sem filtro** para `filterTaskList`. Isso preserva o comportamento de `isdutyof()` etc.

### 4.11 `AccountListRE` — modo balance

Se `costaccount` e `revenueaccount` existem:
1. Cria `costAccountList` e `revenueAccountList` filtrando `accountList`.
2. Garante que os top-level estão incluídos.
3. Gera cada lista.
4. Cria `totalAccount` (via `createBalanceAccount` — Fase 8).
5. Gera linha total.
6. Remove `totalAccount`.

Replicar.

### 4.12 `TextReport` — layout de 5 seções

`header`, `left`, `center`, `right`, `footer`. Larguras calculadas conforme presença.

Replicar.

### 4.13 `TjpExportRE` — export TJP

Serializa projeto em `.tjp`. Muito texto. Replicar `to_tjp` fielmente.

### 4.14 `MspXmlRE` — Microsoft Project XML

Serializa em MSP XML. Replicar.

### 4.15 `ICalReport` — iCalendar

`ICalendar` (Fase 17) é implementado lá. Nesta fase, usar `ICalendar` local mínimo ou stub.

**Decisão:** implementar `ICalendar` mínimo nesta fase com `XMLElementLike` + estrutura manual. Fase 17 completa.

### 4.16 `NikuReport` — Clarity XML

Serializa em Niku XOG. Replicar. Depende de `a('title')` como blob XML.

### 4.17 `TraceReport` — ChartPlotter

Escreve CSV, lê CSV, gera SVG. Replicar.

### 4.18 `CSVFile` — parser/writer

Parser CSV completo (`parse`, `write`, `read`). Replicar.

### 4.19 `ReportContext` — completar (Fase 9 stub)

Fase 9 deixou stub. Aqui completamos: `dynamicReportId`, `query`, `tasks`, `resources`, `childReportCounter`, `attributeBackup`.

### 4.20 `Navigator` — completar `RTFNavigator`

`RTFNavigator` (Fase 12) usa `Navigator`. Completar.

### 4.21 `ChartPlotter` — SVG

Gera SVG com eixos, marcadores, legendas. Replicar.

### 4.22 `RTFReport` e `RTFReportLink` — remover stubs

Fase 12 deixou stubs. Aqui completamos.

### 4.23 Browser e `outputDir`

`project.outputDir` existe (Fase 9). `absoluteFileName` no browser não usa filesystem — reports são retornados como strings, não escritos em disco.

**Decisão:** `Report.generate` no browser **retorna** o conteúdo (string) em vez de escrever. API: `generateReport(): string[]` — array de outputs.

**Nota:** isso muda a assinatura do Ruby. Documentar em ADR 025.

---

## 5. Subfases detalhadas

**Bloco A — Infraestrutura** (18.0–18.5)
**Bloco B — Tabela** (18.6–18.10)
**Bloco C — Reports base** (18.11–18.13)
**Bloco D — Reports específicos** (18.14–18.20)
**Bloco E — Navigator** (18.21)
**Bloco F — ChartPlotter** (18.22)
**Bloco G — Golden tests** (18.23)

---

### Bloco A — Infraestrutura

---

### 18.0 — ADR 025 (reports browser-only)

#### Contexto

O Ruby `Report.generate` escreve arquivos em disco. Browser não tem filesystem direto. Precisamos decidir como reports funcionam no browser.

Opções:
- **A)** Retornar strings (sem escrever).
- **B)** Escrever via OPFS (worker-db).
- **C)** Misto: retornar + OPFS opcional.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/025-reports-browser.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/025-reports-browser.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** diferença entre FS em Ruby e browser.
- [ ] **Decisão:** reports **retornam strings**. `outputDir` é mantido para compatibilidade (opcional).
- [ ] **Alternativas:** OPFS (via worker-db), híbrido.
- [ ] **Consequências:** API diferente do Ruby; UI salva via worker-db se necessário.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/Report.rb` — `generateHTML`.
- Fase 19 — Storage.

#### Critério de aceite

- ADR 025 criado.
- Tabela atualizada.

---

### 18.1 — `CSVFile`

#### Contexto

`CSVFile` é parser + writer de CSV. Usado por reports e por `TimeSheets` (Fase 18).

#### Objetivo

Implementar `CSVFile`.

#### Arquivos

- `packages/report/src/csv-file.ts`
- `packages/report/tests/csv-file_test.ts`

#### Requisitos

- [ ] `class CSVFile`:
  - `data: unknown[][] | null`
  - `private separator: string`
  - `private quote: string`
- [ ] Constructor `(data?, separator = ';', quote = '"')`.
- [ ] `write(fileName: string): void` — no browser, `.` = retorna; senão escreve via worker-db (opcional).
- [ ] `read(fileName: string): unknown[][]`.
- [ ] `to_s(): string`.
- [ ] `parse(str: string): unknown[][]`.
- [ ] `static strToNative(str): unknown`.
- [ ] Private `marshal(field): string`.
- [ ] Private `unMarshal(field, quoted): unknown`.
- [ ] Private `detectSeparator(str): string`.

**Nota:** no browser, `write` retorna a string em vez de escrever. Documentar.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/CSVFile.rb` — arquivo completo.

#### Critério de aceite

```ts
const csv = new CSVFile([[1, 2], [3, 4]], ';');
assertEquals(csv.to_s(), '1;2\n3;4\n');

const parsed = new CSVFile().parse('"a";"b"\n1;2');
assertEquals(parsed, [['a', 'b'], [1, 2]]);
```

#### Testes

- `csv-file_test.ts`:
  - `it("constructor")`.
  - `it("to_s simple")`.
  - `it("to_s com aspas")`.
  - `it("to_s com newlines")`.
  - `it("parse")`.
  - `it("parse com quoted")`.
  - `it("parse com escaped quotes")`.
  - `it("detectSeparator")`.
  - `it("strToNative number")`.
  - `it("strToNative null")`.

---

### 18.2 — `ReportContext` (completar)

#### Contexto

Fase 9 deixou stub. Aqui completamos.

#### Objetivo

Completar `ReportContext`.

#### Arquivos

- `packages/report/src/report-context.ts`
- `packages/report/tests/report-context_test.ts`

#### Requisitos

- [ ] `class ReportContext`:
  - `project: Project`
  - `report: Report`
  - `query: Query`
  - `dynamicReportId: string`
  - `childReportCounter: number`
  - `tasks: PropertyList<Task>`
  - `resources: PropertyList<Resource>`
  - `attributeBackup: [Map<string, AttributeBase>, Map<string, AttributeBase>[]] | null`
- [ ] Constructor `(project, report)`:
  - Cria `Query` com base no report (`loadUnit`, `numberFormat`, `timeFormat`, `currencyFormat`, `start`, `end`, `hideJournalEntry`, `journalMode`, `journalAttributes`, `sortJournalEntries`, `costAccount`, `revenueAccount`).
  - Se parent context: `dynamicReportId = parent.dynamicReportId + '.' + parent.childReportCounter`; `parent.childReportCounter++`; `tasks = parent.tasks.dup()`; `resources = parent.resources.dup()`.
  - Senão: `dynamicReportId = '0'`; `tasks = project.tasks.toArray()`; `resources = project.resources.toArray()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportContext.rb`.

#### Critério de aceite

```ts
const ctx = new ReportContext(project, report);
assertEquals(ctx.dynamicReportId, '0');
assertEquals(ctx.query.project, project);
```

#### Testes

- `report-context_test.ts`:
  - `it("constructor raiz")`.
  - `it("constructor aninhado")`.
  - `it("query tem configs do report")`.
  - `it("dynamicReportId encadeado")`.

---

### 18.3 — `ReportBase`

#### Contexto

Classe abstrata base para todos os reports. Provê `filterTaskList`, `filterResourceList`, `filterAccountList`, `standardFilterOps`, `generateHtmlTableFrame`, `rt_to_html`.

#### Objetivo

Implementar `ReportBase`.

#### Arquivos

- `packages/report/src/report-base.ts`
- `packages/report/tests/report-base_test.ts`

#### Requisitos

- [ ] `abstract class ReportBase`:
  - `report: Report`
  - `project: Project`
- [ ] Constructor `(report)`.
- [ ] `a(attribute): unknown` — atalho.
- [ ] `generateIntermediateFormat(): void`:
  - Seta query em todos os `RichTextIntermediate` (`header`, `left`, `center`, `right`, `footer`, `prolog`, `headline`, `caption`, `epilog`).
- [ ] `filterAccountList(list, hideExpr, rollupExpr, openNodes): PropertyList<Account>`.
- [ ] `filterTaskList(list, resource, hideExpr, rollupExpr, openNodes): PropertyList<Task>`.
- [ ] `filterResourceList(list, task, hideExpr, rollupExpr, openNodes): PropertyList<Resource>`.
- [ ] Private `standardFilterOps(list, hideExpr, rollupExpr, openNodes, scopeProperty, root): PropertyList<T>`:
  - Se `hideExpr`, `list.deleteIf(p => hideExpr.eval(query))`.
  - Se `rollupExpr || openNodes`, `list.deleteIf(...)`.
  - Se `list.treeMode()`, re-adiciona parents.
- [ ] Private `generateHtmlTableFrame(): XMLElementLike`.
- [ ] Private `generateHtmlTableRow(): XMLElementLike`.
- [ ] Private `rt_to_html(name): XMLElementLike | null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportBase.rb` — arquivo completo.
- `docs/tj3-engine/07-blueprint-engine6.md` — §5.6.

#### Critério de aceite

Análogo.

#### Testes

- `report-base_test.ts`:
  - `it("a atalho")`.
  - `it("filterTaskList com hideTask")`.
  - `it("filterTaskList com rollupTask")`.
  - `it("filterTaskList com openNodes")`.
  - `it("filterTaskList tree mode re-adiciona parents")`.
  - `it("filterResourceList")`.
  - `it("filterAccountList")`.
  - `it("generateHtmlTableFrame")`.
  - `it("rt_to_html")`.

---

### 18.4 — `TableColumnDefinition` + `CellSettingPattern`

#### Contexto

`TableColumnDefinition` modela uma coluna de report: `id`, `title`, `cellText`, `cellColor`, `fontColor`, `hAlign`, `tooltip`, `listItem`, `listType`, `scale`, `width`, `content`.

`CellSettingPattern` combina um `LogicalExpression` com um valor.

#### Objetivo

Implementar ambos.

#### Arquivos

- `packages/report/src/table-column-definition.ts`
- `packages/report/src/cell-setting-pattern.ts`
- `packages/report/tests/table-column-definition_test.ts`

#### Requisitos

**`CellSettingPattern`:**

- [ ] `class CellSettingPattern`:
  - `readonly setting: unknown`
  - `readonly logExpr: LogicalExpression`
- [ ] Constructor `(setting, logExpr)`.

**`CellSettingPatternList`:**

- [ ] `class CellSettingPatternList`:
  - `private patterns: CellSettingPattern[]`
- [ ] `addPattern(pattern)`.
- [ ] `getPattern(query): unknown | null` — primeiro que casa.

**`TableColumnDefinition`:**

- [ ] `class TableColumnDefinition`:
  - `readonly id: string`
  - `title: string`
  - `start: TjTime | null`
  - `end: TjTime | null`
  - `cellText: CellSettingPatternList`
  - `cellColor: CellSettingPatternList`
  - `fontColor: CellSettingPatternList`
  - `hAlign: CellSettingPatternList`
  - `tooltip: CellSettingPatternList`
  - `listItem: string | null`
  - `listType: 'comma' | 'bullets' | 'numbered' | null`
  - `scale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'`
  - `width: number | null`
  - `timeformat1: string | null`
  - `timeformat2: string | null`
  - `content: 'load' | string`
  - `column: ReportTableColumn | null`
- [ ] Constructor `(id, title)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TableColumnDefinition.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `table-column-definition_test.ts`:
  - `it("constructor")`.
  - `it("cellText com pattern")`.
  - `it("getPattern")`.
  - `it("getPattern retorna primeiro que casa")`.
  - `it("getPattern sem match retorna null")`.

---

### 18.5 — `TableColumnSorter`

#### Contexto

Reordena colunas de uma tabela segundo um novo header. Usado por `TraceReport` para migração.

#### Objetivo

Implementar `TableColumnSorter`.

#### Arquivos

- `packages/report/src/table-column-sorter.ts`
- `packages/report/tests/table-column-sorter_test.ts`

#### Requisitos

- [ ] `class TableColumnSorter`:
  - `private oldTable: unknown[][]`
  - `discontinuedColumns: number`
- [ ] Constructor `(table)`.
- [ ] `sort(newHeaders: string[]): unknown[][]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TableColumnSorter.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `table-column-sorter_test.ts`:
  - `it("reordena colunas")`.
  - `it("colunas descontinuadas vão ao final")`.
  - `it("colunas novas preenchidas com null")`.

---

### Bloco B — Tabela

---

### 18.6 — `ReportTable`

#### Contexto

Container de colunas e linhas.

#### Objetivo

Implementar `ReportTable`.

#### Arquivos

- `packages/report/src/report-table.ts`
- `packages/report/tests/report-table_test.ts`

#### Requisitos

- [ ] `class ReportTable`:
  - `readonly SCROLLBARHEIGHT = 20`
  - `headerLineHeight: number` (default 19)
  - `headerFontSize: number` (default 15)
  - `private columns: ReportTableColumn[]`
  - `private lines: ReportTableLine[]`
  - `maxIndent: number`
  - `equiLines: boolean`
  - `embedded: boolean`
  - `selfcontained: boolean`
  - `auxDir: string`
- [ ] `addColumn(col)`, `addLine(line)`.
- [ ] `lines(): number`.
- [ ] `minWidth(): number`.
- [ ] `to_html(): XMLElementLike`.
- [ ] `to_csv(csv = [[]], startColumn = 0): unknown[][] | number`.
- [ ] Private `determineMaxIndents()`.
- [ ] Private `hasScrollbar(): boolean`.

**Regra de header:**
- Se **todas** as colunas têm `cell1.rows === 2 && !cell1.special` → merge (1 header).
- Senão → 2 headers.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportTable.rb`.
- `docs/tj3-engine/09-blueprint-engine8.md` — §2.

#### Critério de aceite

Análogo.

#### Testes

- `report-table_test.ts`:
  - `it("addColumn/addLine")`.
  - `it("to_html header único quando todas rows=2")`.
  - `it("to_html 2 headers")`.
  - `it("to_html com scrollbar")`.
  - `it("minWidth")`.
  - `it("to_csv")`.

---

### 18.7 — `ReportTableColumn`

#### Contexto

Coluna de uma tabela.

#### Objetivo

Implementar `ReportTableColumn`.

#### Arquivos

- `packages/report/src/report-table-column.ts`
- `packages/report/tests/report-table-column_test.ts`

#### Requisitos

- [ ] `class ReportTableColumn`:
  - `table: ReportTable`
  - `definition: TableColumnDefinition | null`
  - `cell1: ReportTableCell`
  - `cell2: ReportTableCell`
  - `scrollbar: boolean`
- [ ] Constructor `(table, definition, title)`:
  - `cell1 = new ReportTableCell(null, null, title, true)`.
  - `cell1.padding = 5`.
  - `cell2 = new ReportTableCell(null, null, '', true)`.
  - `cell1.bold = cell2.bold = true`.
- [ ] `minWidth(): number`.
- [ ] `to_html(row: 1 | 2): XMLElementLike`.
- [ ] `to_csv(csv, startColumn): number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportTableColumn.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `report-table-column_test.ts`:
  - `it("constructor")`.
  - `it("cell1/cell2")`.
  - `it("to_html row 1 e 2")`.
  - `it("to_csv")`.

---

### 18.8 — `ReportTableLine`

#### Contexto

Linha de uma tabela.

#### Objetivo

Implementar `ReportTableLine`.

#### Arquivos

- `packages/report/src/report-table-line.ts`
- `packages/report/tests/report-table-line_test.ts`

#### Requisitos

- [ ] `class ReportTableLine`:
  - `table: ReportTable`
  - `property: PropertyTreeNode`
  - `scopeLine: ReportTableLine | null`
  - `private cells: ReportTableCell[]`
  - `height: number` (default 21)
  - `indentation: number`
  - `fontSize: number` (default 12)
  - `bold: boolean`
  - `no: number | null`
  - `lineNo: number | null`
  - `subLineNo: number | null`
- [ ] Constructor `(table, property, scopeLine)`.
- [ ] `last(count = 0): ReportTableCell | null`.
- [ ] `addCell(cell): void`.
- [ ] `scopeProperty(): PropertyTreeNode | null`.
- [ ] `to_html(): XMLElementLike`.
- [ ] `to_csv(csv, startColumn, lineIdx): number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLine.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `report-table-line_test.ts`:
  - `it("constructor")`.
  - `it("addCell")`.
  - `it("last")`.
  - `it("scopeProperty")`.
  - `it("to_html")`.
  - `it("to_csv")`.

---

### 18.9 — `ReportTableCell` + `PlaceHolderCell`

#### Contexto

Célula individual. Muitos campos (text, tooltip, cellColor, fontColor, indent, icon, etc.).

`PlaceHolderCell` é célula especial para tabelas embutidas.

#### Objetivo

Implementar ambas.

#### Arquivos

- `packages/report/src/report-table-cell.ts`
- `packages/report/src/placeholder-cell.ts`
- `packages/report/tests/report-table-cell_test.ts`

#### Requisitos

**`ReportTableCell`:**

- [ ] `class ReportTableCell`:
  - `line: ReportTableLine | null`
  - `headerCell: boolean`
  - `query: Query | null`
  - `text: string | RichTextIntermediate`
  - `data: string | null`
  - `special: unknown`
  - `category: string | null`
  - `cellColor: string | null`
  - `fontColor: string | null`
  - `bold: boolean`
  - `fontSize: number | null`
  - `alignment: 'left' | 'center' | 'right'`
  - `indent: number | null`
  - `width: number | null`
  - `rows: number`
  - `columns: number`
  - `padding: number`
  - `hidden: boolean`
  - `icon: string | null`
  - `iconTooltip: RichTextIntermediate | null`
  - `tooltip: RichTextIntermediate | null`
  - `showTooltipHint: boolean`
  - `force_string: boolean`
- [ ] Constructor `(line, query, text?, headerCell = false)`.
- [ ] `equals(other): boolean`.
- [ ] `to_html(): XMLElementLike | null`.
- [ ] `to_csv(csv, columnIdx, lineIdx): number`.
- [ ] Private `calculateIndentation()`.
- [ ] Private `cellStyle(): string`.
- [ ] Private `cellIcon(cell): XMLElementLike | null`.
- [ ] Private `cellLabel(): [XMLElementLike | null, RichTextIntermediate | null]`.
- [ ] Private `shortVersion(text, width): [string, boolean]`.
- [ ] Private `addHtmlTooltip(tooltip, trigger, hook?): void`.

**`PlaceHolderCell`:**

- [ ] `class PlaceHolderCell`:
  - `line: ReportTableLine`
  - `embeddedLine: ReportTableLine`
- [ ] Constructor `(line, embeddedLine)`.
- [ ] `to_csv(csv, columnIdx, lineIdx): number`.
- [ ] `to_html(): null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportTableCell.rb` — arquivo completo.
- `docs/tj3-engine/09-blueprint-engine8.md` — §4.

#### Critério de aceite

Análogo.

#### Testes

- `report-table-cell_test.ts`:
  - `it("constructor defaults")`.
  - `it("to_html simples")`.
  - `it("to_html com indent")`.
  - `it("to_html com icon")`.
  - `it("to_html com tooltip")`.
  - `it("to_html hidden")`.
  - `it("to_html special")`.
  - `it("equals")`.
  - `it("to_csv com indent")`.
  - `it("to_csv strToNative")`.
  - `it("PlaceHolderCell to_csv delega")`.

---

### 18.10 — `ReportTableLegend`

#### Contexto

Legenda com símbolos do Gantt e do calendário.

#### Objetivo

Implementar `ReportTableLegend`.

#### Arquivos

- `packages/report/src/report-table-legend.ts`
- `packages/report/tests/report-table-legend_test.ts`

#### Requisitos

- [ ] `class ReportTableLegend`:
  - `showGanttItems: boolean`
  - `private ganttItems: Array<[string, string]>`
  - `private calendarItems: Array<[string, string]>`
- [ ] `addGanttItem(text, color): void`.
- [ ] `addCalendarItem(text, color): void`.
- [ ] `to_html(): XMLElementLike | null`.
- [ ] Private `headlineToHTML(text)`.
- [ ] Private `ganttItemToHTML(itemRef, name, width)`.
- [ ] Private `itemToHTML(itemRef)`.
- [ ] Private `itemsToHTML(items)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLegend.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `report-table-legend_test.ts`:
  - `it("vazio retorna null")`.
  - `it("addGanttItem deduplica")`.
  - `it("addCalendarItem deduplica")`.
  - `it("to_html com gantt items")`.
  - `it("headline quando ambos")`.

---

### Bloco C — Reports base

---

### 18.11 — `Report` (completar)

#### Contexto

`Report` foi deixado como esqueleto na Fase 5. Aqui completamos com dispatch de geração.

#### Objetivo

Completar `Report`.

#### Arquivos

- `packages/report/src/report.ts` (completar)
- `packages/report/tests/report_test.ts`

#### Requisitos

- [ ] `generate(requestedFormats?: string[]): number`:
  - `oldTimeZone = TjTime.setTimeZone(this.get('timezone'))`.
  - `generateIntermediateFormat()`.
  - Para cada `format` em `(requestedFormats || formats)`:
    - Se `name === ''`, `error('empty_report_file_name')`.
    - Dispatch: `iCal`, `html`, `csv`, `ctags`, `niku`, `tjp`, `mspxml`.
  - `TjTime.setTimeZone(oldTimeZone)`.
  - Retorna `0`.
- [ ] `generateIntermediateFormat(): void`:
  - Se `scenarios.empty`, `warning('all_scenarios_disabled')`.
  - Dispatch por `typeSpec`:
    - `accountreport` → `AccountListRE`.
    - `export` → `ExportRE`.
    - `iCal` → `ICalReport`.
    - `niku` → `NikuReport`.
    - `resourcereport` → `ResourceListRE`.
    - `tagfile` → `TagFile`.
    - `textreport` → `TextReport`.
    - `taskreport` → `TaskListRE`.
    - `tracereport` → `TraceReport`.
    - `statusSheet` → `StatusSheetReport` (stub Fase 18).
    - `timeSheet` → `TimeSheetReport` (stub Fase 18).
  - `content.generateIntermediateFormat()`.
- [ ] `to_html(): XMLElementLike | null`.
- [ ] `interactive?(): boolean`.
- [ ] Private `generateHTML(): string | null` — retorna HTML como string (ADR 025).
- [ ] Private `generateCSV(): unknown[][] | null`.
- [ ] Private `generateTJP(): string | null`.
- [ ] Private `generateMspXml(): string | null`.
- [ ] Private `generateNiku(): string | null`.
- [ ] Private `generateICal(): string | null`.
- [ ] Private `generateCTags(): string | null`.
- [ ] Private `copyAuxiliaryFiles(): void` — no-op no browser.
- [ ] Private `absoluteFileName(name): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/Report.rb` — arquivo completo.
- `docs/tj3-engine/07-blueprint-engine6.md` — §2.

#### Critério de aceite

Análogo.

#### Testes

- `report_test.ts`:
  - `it("generateIntermediateFormat dispatch")`.
  - `it("generate com 1 formato")`.
  - `it("generate com formato desconhecido lança")`.
  - `it("name vazio com formats lança")`.
  - `it("interactive?")`.
  - `it("absoluteFileName")`.

---

### 18.12 — `TableReport`

#### Contexto

Classe base abstrata para TaskReport, ResourceReport, AccountReport.

#### Objetivo

Implementar `TableReport`.

#### Arquivos

- `packages/report/src/table-report.ts`
- `packages/report/tests/table-report_test.ts`

#### Requisitos

- [ ] `abstract class TableReport extends ReportBase`:
  - `legend: ReportTableLegend`
  - `protected table: ReportTable`
  - `protected columns: Map<TableColumnDefinition, TableReportColumn>`
  - `static propertiesById: Map<string, [string, boolean, 'left'|'right', boolean]>`
  - `static propertiesByType: Map<AttributeType, [boolean, 'left'|'right']>`
- [ ] `to_html(): XMLElementLike[]`.
- [ ] `to_csv(): unknown[][]`.
- [ ] `static defaultColumnTitle(id): string`.
- [ ] `static indent(colId, propertyType): boolean`.
- [ ] `static alignment(colId, attrType): 'left' | 'center' | 'right'`.
- [ ] `static calculated?(colId): boolean`.
- [ ] `static scenarioSpecific?(colId): boolean`.
- [ ] Protected `adjustColumnPeriod(columnDef, tasks, scenarios): void`.
- [ ] Protected `generateHeaderCell(columnDef): void`.
- [ ] Protected `generateAccountList(accountList, lineOffset, mode): number`.
- [ ] Protected `generateTaskList(taskList, resourceList, scopeLine): number`.
- [ ] Protected `generateResourceList(resourceList, taskList, scopeLine): number`.
- [ ] Private `genCalChartHeader(columnDef, t, rEnd, sameTimeNextFunc, timeformat1, timeformat2): void`.
- [ ] Private `generateTableCell(line, columnDef, query): boolean`.
- [ ] Private `genStandardCell(query, line, columnDef): boolean`.
- [ ] Private `genCalculatedCell(query, line, columnDef): boolean`.
- [ ] Private `genCalChartAccountCell(query, line, columnDef, t, sameTimeNextFunc): void`.
- [ ] Private `genCalChartTaskCell(query, line, columnDef, t, sameTimeNextFunc): void`.
- [ ] Private `genCalChartResourceCell(query, line, columnDef, t, sameTimeNextFunc): void`.
- [ ] Private `setStandardCellAttributes(query, cell, columnDef, attrType, line): void`.
- [ ] Private `setCustomCellAttributes(cell, columnDef, query): void`.
- [ ] Private `setScenarioSettings(cell, scenarioIdx, scenarioSpecific): boolean`.
- [ ] Private `newCell(query, line): ReportTableCell`.
- [ ] Private `setIndent(line, propertyRoot, treeMode): void`.
- [ ] Private `setAccountCellBgColor(query, line, cell): void`.
- [ ] Private `checkCellText(cell): void`.
- [ ] Private `tryCellMerging(cell, line, firstCell): void`.

**`propertiesById`** — ~40 entradas:
```
activetasks, annualleave, annualleavebalance, annualleavelist, alert,
alertmessages, alertsummaries, alerttrend, balance, bsi, children,
closedtasks, competitorcount, competitors, complete, cost, duration,
effort, effortdone, effortleft, freetime, freework, followers, fte,
headcount, id, inputs, journal, journal_sub, journalmessages,
journalsummaries, line, name, no, opentasks, precursors, rate,
resources, responsible, revenue, scenario, scheduling, sickleave,
specialleave, status, targets, unpaidleave
```

**`propertiesByType`**:
```
DateAttribute         → [false, 'left']
IntegerAttribute      → [false, 'right']
FloatAttribute        → [false, 'right']
ResourceListAttribute → [false, 'left']
RichTextAttribute     → [false, 'left']
StringAttribute       → [false, 'left']
```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/TableReport.rb` — arquivo completo (maior da fase).
- `docs/tj3-engine/09-blueprint-engine8.md` — §6.

#### Critério de aceite

Análogo.

#### Testes

- `table-report_test.ts`:
  - `it("propertiesById default titles")`.
  - `it("propertiesByType indent/align")`.
  - `it("calculated?")`.
  - `it("scenarioSpecific?")`.
  - `it("newCell container bold")`.
  - `it("setScenarioSettings 1 cenário")`.
  - `it("setScenarioSettings 2 cenários")`.
  - `it("checkCellText erro")`.
  - `it("tryCellMerging")`.

---

### 18.13 — `ColumnTable`

#### Contexto

Wrapper de `ReportTable` que pode ser embutido em uma coluna de outro `ReportTable`. Usado por colunas `calendar`.

#### Objetivo

Implementar `ColumnTable`.

#### Arquivos

- `packages/report/src/column-table.ts`
- `packages/report/tests/column-table_test.ts`

#### Requisitos

- [ ] `class ColumnTable extends ReportTable`:
  - `viewWidth: number | null`
- [ ] Constructor:
  - `headerFontSize = 10`.
  - `embedded = true`.
- [ ] `to_html(): XMLElementLike`:
  - `td` com `rowspan = 2 + lines.length + 1`.
  - Div com overflow auto.
  - Div interna com `super.to_html()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ColumnTable.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `column-table_test.ts`:
  - `it("embedded true")`.
  - `it("to_html com scrollbar")`.

---

### Bloco D — Reports específicos

---

### 18.14 — `TaskListRE`

#### Contexto

Report de tarefas. Coração dos reports de task.

#### Objetivo

Implementar `TaskListRE`.

#### Arquivos

- `packages/report/src/task-list-re.ts`
- `packages/report/tests/task-list-re_test.ts`

#### Requisitos

- [ ] `class TaskListRE extends TableReport`:
  - `constructor(report)`.
- [ ] `generateIntermediateFormat(): void`:
  - `super.generateIntermediateFormat()`.
  - Prepara `taskList`: `PropertyList`, `includeAdopted`, `setSorting(sortTasks)`, `filterTaskList`, `sort`, `checkForDuplicates`.
  - Prepara `resourceList`: **sem filtro** (para `isdutyof()`).
  - Para cada coluna: `adjustColumnPeriod`, `generateHeaderCell`.
  - `generateTaskList(taskList, resourceList, null)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/TaskListRE.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `task-list-re_test.ts`:
  - `it("generateIntermediateFormat básico")`.
  - `it("includeAdopted")`.
  - `it("checkForDuplicates")`.
  - `it("resourceList não filtrado")`.
  - `it("columns com chart")`.

---

### 18.15 — `ResourceListRE`

#### Contexto

Report de recursos.

#### Objetivo

Implementar `ResourceListRE`.

#### Arquivos

- `packages/report/src/resource-list-re.ts`
- `packages/report/tests/resource-list-re_test.ts`

#### Requisitos

- [ ] `class ResourceListRE extends TableReport`.
- [ ] `generateIntermediateFormat()`:
  - `resourceList` filtrado.
  - `taskList` **sem filtro**.
  - `assignedTaskList`: para cada resource, `filterTaskList(taskList, resource, ...)`; união.
  - Para cada coluna: `adjustColumnPeriod(columnDef, assignedTaskList, scenarios)`, `generateHeaderCell`.
  - `generateResourceList(resourceList, taskList, null)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ResourceListRE.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `resource-list-re_test.ts`:
  - `it("generateIntermediateFormat básico")`.
  - `it("assignedTaskList")`.
  - `it("taskList não filtrado")`.

---

### 18.16 — `AccountListRE`

#### Contexto

Report de contas. Modo balance.

#### Objetivo

Implementar `AccountListRE`.

#### Arquivos

- `packages/report/src/account-list-re.ts`
- `packages/report/tests/account-list-re_test.ts`

#### Requisitos

- [ ] `class AccountListRE extends TableReport`.
- [ ] `generateIntermediateFormat()`:
  - `accountList` filtrado.
  - Para cada coluna: `adjustColumnPeriod(columnDef)`, `generateHeaderCell`.
  - Se `costAccount && revenueAccount` (modo balance):
    - Split em `costAccountList` e `revenueAccountList`.
    - Garantir que top-level estão inclusos.
    - `generateAccountList(costAccountList, 0, null)`.
    - `generateAccountList(revenueAccountList, costAccountList.length, null)`.
    - Cria `totalAccount` via `createBalanceAccount`.
    - `generateAccountList([totalAccount], cost + revenue length, null)`.
    - `removeBalanceAccount`.
  - Senão, `generateAccountList(accountList, 0, null)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb`.
- Fase 8 — `createBalanceAccount`.

#### Critério de aceite

Análogo.

#### Testes

- `account-list-re_test.ts`:
  - `it("sem balance")`.
  - `it("com balance")`.
  - `it("totalAccount criado e removido")`.

---

### 18.17 — `TextReport`

#### Contexto

Report de 5 seções RichText.

#### Objetivo

Implementar `TextReport`.

#### Arquivos

- `packages/report/src/text-report.ts`
- `packages/report/tests/text-report_test.ts`

#### Requisitos

- [ ] `class TextReport extends ReportBase`:
  - `header`, `left`, `center`, `right`, `footer`.
  - `lWidth`, `cWidth`, `rWidth`, `lPadding`, `cPadding`, `rPadding`.
- [ ] `generateIntermediateFormat()`:
  - Calcula larguras conforme presença de seções.
- [ ] `to_html(): XMLElementLike[]`:
  - Header.
  - Tabela com left/center/right.
  - Footer.
- [ ] `to_csv(): null` — warning `text_report_no_csv`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/TextReport.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `text-report_test.ts`:
  - `it("só center")`.
  - `it("left + center")`.
  - `it("left + center + right")`.
  - `it("left + right sem center")`.
  - `it("to_html")`.
  - `it("to_csv retorna null + warning")`.

---

### 18.18 — `ExportRE` + `TjpExportRE` + `MspXmlRE`

#### Contexto

3 reports de export.

#### Objetivo

Implementar os 3.

#### Arquivos

- `packages/report/src/export-re.ts`
- `packages/report/src/tjp-export-re.ts`
- `packages/report/src/msp-xml-re.ts`
- `packages/report/tests/export-re_test.ts`
- `packages/report/tests/tjp-export-re_test.ts`
- `packages/report/tests/msp-xml-re_test.ts`

#### Requisitos

**`ExportRE`:**

- [ ] `generateIntermediateFormat()` — vazio.
- [ ] `to_tjp(): string` — delega para `TjpExportRE`.
- [ ] `to_mspxml(): string` — delega para `MspXmlRE`.

**`TjpExportRE`:**

- [ ] Constructor `(report)`.
- [ ] `to_tjp(): string`:
  - Prepara `resourceList` e `taskList` filtrados.
  - `getBookings()` — coleta bookings por cenário.
  - `generateProjectProperty()` se `definitions` inclui `'project'`.
  - `generateFlagDeclaration()`, `generateProjectIDs()`, `generateShiftList()`.
  - `generateResourceList()`, `generateTaskList()`.
  - `generateTaskAttributes()`, `generateResourceAttributes()`.

**`MspXmlRE`:**

- [ ] `to_mspxml(): string`:
  - `XMLDocument` com header, `Project` com `xmlns`.
  - `generateProjectAttributes`, `generateTasks`, `generateResources`, `generateAssignments`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ExportRE.rb`.
- `docs/taskjuggler/lib/taskjuggler/reports/TjpExportRE.rb`.
- `docs/taskjuggler/lib/taskjuggler/reports/MspXmlRE.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `export-re_test.ts`:
  - `it("to_tjp delega")`.
  - `it("to_mspxml delega")`.
- `tjp-export-re_test.ts`:
  - `it("project minimal")`.
  - `it("com projectid")`.
  - `it("com flags")`.
  - `it("com bookings")`.
- `msp-xml-re_test.ts`:
  - `it("project attributes")`.
  - `it("tasks")`.
  - `it("resources")`.
  - `it("assignments")`.

---

### 18.19 — `ICalReport`

#### Contexto

Report iCalendar.

#### Objetivo

Implementar `ICalReport`.

#### Arquivos

- `packages/report/src/i-cal-report.ts`
- `packages/report/src/i-calendar.ts`
- `packages/report/tests/i-cal-report_test.ts`

#### Requisitos

**`ICalendar`** (mínimo nesta fase; Fase 17 completa):

- [ ] `class Person`.
- [ ] `class Component`: `description`, `relatedTo`, `organizer`, `attendees`, `to_s()`.
- [ ] `class Todo extends Component`: `priority`, `percentComplete`.
- [ ] `class Event extends Component`.
- [ ] `class Journal extends Component`.
- [ ] `class ICalendar`: `uid`, `creationDate`, `lastModified`, `to_s()`, `dateTime(date)`, `foldLines(str)`.

**`ICalReport`:**

- [ ] `generateIntermediateFormat()`:
  - `taskList` filtrado.
  - Para cada task: cria `Todo`; se milestone, pula? Não.
  - Se tem responsible com email, `setOrganizer`.
  - `assignedresources` viram `attendees`.
  - `Event` para leaf não-milestone (se `novevents === false`).
  - `Journal` para journal entries.
- [ ] `to_iCal(): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ICalReport.rb`.
- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `i-cal-report_test.ts`:
  - `it("todo para cada task")`.
  - `it("event para leaf")`.
  - `it("novevents skip event")`.
  - `it("organizer")`.
  - `it("foldLines")`.

---

### 18.20 — `NikuReport` + `TraceReport` + `TagFile`

#### Contexto

3 reports específicos.

#### Objetivo

Implementar os 3.

#### Arquivos

- `packages/report/src/niku-report.ts`
- `packages/report/src/trace-report.ts`
- `packages/report/src/tag-file.ts`
- `packages/report/tests/niku-report_test.ts`
- `packages/report/tests/trace-report_test.ts`
- `packages/report/tests/tag-file_test.ts`

#### Requisitos

**`NikuReport`:**

- [ ] `generateIntermediateFormat()`:
  - `computeResourceTotals()`, `collectProjects()`, `computeProjectAllocations()`.
- [ ] `to_html()`, `to_niku()`, `to_csv()`.

**`TraceReport`:**

- [ ] `generateIntermediateFormat()`:
  - `headers = ['Date', ...]`.
  - Se arquivo existe, lê.
  - Se headers mudaram, `TableColumnSorter`.
  - Adiciona linha atual.
  - Ordena.
- [ ] `to_html()` (SVG via `ChartPlotter`).
- [ ] `to_csv()`.

**`TagFile`:**

- [ ] `generateIntermediateFormat()`:
  - Adiciona resources, tasks, reports como `TagFileEntry`.
- [ ] `to_ctags()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/NikuReport.rb`.
- `docs/taskjuggler/lib/taskjuggler/reports/TraceReport.rb`.
- `docs/taskjuggler/lib/taskjuggler/reports/TagFile.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `niku-report_test.ts`:
  - `it("computeResourceTotals")`.
  - `it("collectProjects")`.
  - `it("to_niku")`.
- `trace-report_test.ts`:
  - `it("headers iniciais")`.
  - `it("adiciona linha")`.
  - `it("TableColumnSorter em migração")`.
- `tag-file_test.ts`:
  - `it("coleta resources/tasks/reports")`.
  - `it("to_ctags")`.

---

### Bloco E — Navigator

---

### 18.21 — `Navigator` + completar `RTFNavigator`

#### Contexto

`Navigator` gera menu de navegação.

#### Objetivo

Implementar `Navigator` e completar `RTFNavigator`.

#### Arquivos

- `packages/report/src/navigator.ts`
- `packages/report/tests/navigator_test.ts`
- `packages/richtext/src/handlers/rtf-navigator.ts` (completar)

#### Requisitos

**`NavigatorElement`:**

- [ ] `class NavigatorElement`:
  - `parent: NavigatorElement | null`
  - `label: string | null`
  - `url: string | null`
  - `elements: NavigatorElement[]`
  - `current: boolean`
- [ ] Constructor `(parent, label?, url?)`.
- [ ] `to_html(html?: XMLElementLike): XMLElementLike`.
- [ ] `to_s(indent = 0): void`.

**`Navigator`:**

- [ ] `class Navigator`:
  - `readonly id: string`
  - `private project: Project`
  - `hideReport: LogicalExpression`
- [ ] Constructor `(id, project)`.
- [ ] `generate(allReports, currentReports, reportDef, parentElement): void`.
- [ ] `to_html(): XMLElementLike | null`.
- [ ] Private `filterReports(): PropertyList<Report>`.
- [ ] Private `normalizeURL(url1, url2): string`.
- [ ] Private `findReportURL(report, allReports, reportDef): string | null`.

**`RTFNavigator` (completar):**

- [ ] `to_html(args)`:
  - `id = args.id` obrigatório.
  - `navigator = project.navigators[id]`.
  - Se não existe, `error`.
  - Retorna `navigator.to_html()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/Navigator.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `navigator_test.ts`:
  - `it("generate simples")`.
  - `it("hideReport filtra")`.
  - `it("to_html")`.
  - `it("normalizeURL")`.
  - `it("findReportURL")`.
- `rtf-navigator_test.ts` (estender):
  - `it("to_html com navigator")`.

---

### Bloco F — ChartPlotter

---

### 18.22 — `ChartPlotter`

#### Contexto

Gera SVG de gráficos de linha para `TraceReport`.

#### Objetivo

Implementar `ChartPlotter`.

#### Arquivos

- `packages/report/src/chart-plotter.ts`
- `packages/report/tests/chart-plotter_test.ts`

#### Requisitos

- [ ] `class ChartPlotter`:
  - `width`, `height`, `data`.
  - Margens (`topMargin`, `bottomMargin`, `leftMargin`, `rightMargin`).
  - `legendGap`, `markerWidth`, `markerX`, `markerGap`, `labelX`, `labelHeight`.
  - `x0`, `y0`.
  - `labels`, `yData`, `xData`, `dataType`.
  - `xMinDate`, `xMaxDate`, `yMinDate`, `yMaxDate`, `yMinVal`, `yMaxVal`.
- [ ] `generate(): void`.
- [ ] `to_svg(): string`.
- [ ] Private `analyzeData()`.
- [ ] Private `calcChartGeometry()`.
- [ ] Private `xLabels(painter)`.
- [ ] Private `yLabels(painter)`.
- [ ] Private `x2c(x)`, `y2c(y)`, `xDate2c(date)`, `yDate2c(date)`, `yNum2c(number)`.
- [ ] Private `drawGrid(painter)`.
- [ ] Private `drawDataGraph(painter, ci, color)`.
- [ ] Private `drawLegendEntry(painter, ci, color)`.
- [ ] Private `setMarker(p, type, x, y)`.

**Nota:** usa `Painter` (Fase 17) que ainda não existe. **Nesta fase**, implementar um `Painter` mínimo local com `group`, `line`, `rect`, `text`, `circle`, `polyline`, `color`, `to_svg()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/ChartPlotter.rb` — arquivo completo.
- `docs/taskjuggler/lib/taskjuggler/Painter/*.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `chart-plotter_test.ts`:
  - `it("analyzeData simple")`.
  - `it("analyzeData datas inválidas lança")`.
  - `it("calcChartGeometry")`.
  - `it("to_svg com 1 série")`.
  - `it("to_svg com 2 séries")`.
  - `it("to_svg com datas")`.
  - `it("drawLegendEntry")`.

---

### Bloco G — Golden tests

---

### 18.23 — Golden tests (reports)

#### Contexto

Validar reports contra `tj3`.

#### Objetivo

Scripts Ruby que rodam `tj3` em MWEs e extraem HTML/CSV.

#### Arquivos

- `scripts/golden/reports-mwe001.rb` a `reports-mwe009.rb`
- `scripts/golden/reports-syntax-correct.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/report/tests/golden/reports.golden.json`
- `packages/report/tests/golden/reports_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Scripts Ruby:**

- [ ] Para cada MWE:
  - Roda `tj3 mweXXX/tutorial.tjp`.
  - Lê `*.html` gerados.
  - Extrai tabela principal (por tag).
  - Serializa HTML limpo (sem whitespace).

**Teste TS:**

- [ ] Para cada caso:
  - Constrói `Project`.
  - Cria `Report` equivalente.
  - `report.generate()`.
  - Compara HTML (normalizado).

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/Learning/mwe001-009/`.
- `docs/taskjuggler/test/TestSuite/Reports/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- Parser — Fase 10.
- Gantt — Fase 15.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 60 casos.
- Todos passam.

#### Testes

- `reports_golden_test.ts`:
  - `describe("Golden reports")` — itera MWEs.

---

## 6. Ordem de execução sugerida

```text
18.0  ADR 025
      ↓
18.1  CSVFile
18.2  ReportContext (completar)
18.3  ReportBase
18.4  TableColumnDefinition + CellSettingPattern
18.5  TableColumnSorter
      ↓
18.6  ReportTable
18.7  ReportTableColumn
18.8  ReportTableLine
18.9  ReportTableCell + PlaceHolderCell
18.10 ReportTableLegend
      ↓
18.11 Report (completar)
18.12 TableReport         ← mais complexo
18.13 ColumnTable
      ↓
18.14 TaskListRE
18.15 ResourceListRE
18.16 AccountListRE
18.17 TextReport
18.18 ExportRE + TjpExportRE + MspXmlRE
18.19 ICalReport
18.20 NikuReport + TraceReport + TagFile
      ↓
18.21 Navigator + completar RTFNavigator
      ↓
18.22 ChartPlotter
      ↓
18.23 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 14 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] Infraestrutura de tabela completa.
- [ ] Reports base completos.
- [ ] 11 reports específicos.
- [ ] `Navigator` funcional; `RTFNavigator` completo.
- [ ] `ChartPlotter` funcional.
- [ ] `RTFReport` e `RTFReportLink` completos (Fase 12 stubs removidos).
- [ ] **≥ 350 testes unitários**.
- [ ] **≥ 60 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 025 criado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `TableReport` tem 600 linhas | **Altíssimo** | Dividir em subfases; testes por método |
| `ReportTable.to_html` 2 headers merge | Alto | Golden tests |
| `AccountListRE` balance mode | Alto | Golden tests com mwe004 |
| `TjpExportRE` serialização | Alto | Golden tests texto-a-texto |
| `MspXmlRE` estrutura XML | Alto | Golden tests com XML diff |
| `ChartPlotter` SVG | Médio | Snapshot |
| `Navigator` URLs relativas | Médio | Testes com hierarquia |
| `ICalendar.foldLines` com UTF-8 | Médio | Testes com emojis/acentos |
| `filterTaskList` com `isdutyof()` | Alto | Teste com recursos aninhados |
| `copyAuxiliaryFiles` no-op | Médio | Aceito; Fase 20 |
| `outputDir` no browser | Médio | ADR 025 |
| `Painter` mínimo vs real | Médio | Fase 17 substitui |
| Performance de `generateHTML` | Médio | Benchmarks |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/reports/*.rb`
- `docs/taskjuggler/lib/taskjuggler/TableColumnDefinition.rb`
- `docs/taskjuggler/lib/taskjuggler/TableColumnSorter.rb`
- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb`
- `docs/taskjuggler/lib/taskjuggler/Painter/*.rb`

### Blueprints

- `docs/tj3-engine/07-blueprint-engine6.md`
- `docs/tj3-engine/08-blueprint-engine7.md`
- `docs/tj3-engine/09-blueprint-engine8.md`
- `docs/tj3-engine/10-blueprint-finance.md`

### Documentos do projeto

- `docs/syntaxmesh/decisoes/025-reports-browser.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 15 — Gantt** (GanttChart é coluna de TaskReport).
- **Fase 17 — HTML/XML** (substitui `HTMLDocument` mínimo).
- **Fase 20 — UI** (exibe reports).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **`TableReport` é o mais complexo.** Dividir em métodos testáveis.
2. **Ordem de `generateIntermediateFormat`** importa: prepara listas → header → lista.
3. **`resourceList` NÃO filtrado em TaskListRE.** Idem para `taskList` em ResourceListRE.
4. **`adjustColumnPeriod`** com chart/calendar: margem.
5. **`AccountListRE` balance mode:** criar `totalAccount`, remover depois.
6. **`ReportTable.to_html`:** header merge só se TODAS têm 2 rows.
7. **`ReportTableCell.to_html`:** `category` default `'tabcell'`.
8. **`CSVFile`:** `strToNative` para Integer/Float.
9. **`TjpExportRE`:** fidelidade textual.
10. **`MspXmlRE`:** usar `XMLElementLike` + serializer.
11. **`ICalendar.foldLines`:** linhas de 75 chars.
12. **Browser reports retornam strings.** ADR 025.
13. **`ChartPlotter`:** implementar `Painter` mínimo nesta fase.
14. **`RTFNavigator`, `RTFReport`, `RTFReportLink`:** completar stubs da Fase 12.
15. **Sem `any`.** Use `unknown` + type guards.
16. **Commit por subfase.** `feat(report): table-report`, etc.

---

## 11. ADR 025 (referência rápida)

Criado como subfase 18.0. Conteúdo esperado:

- **Título:** Reports no browser: retorno de strings
- **Contexto:** Ruby escreve arquivos; browser não tem FS.
- **Decisão:** `generateReport()` retorna string; `outputDir` opcional.
- **Alternativas:** OPFS, híbrido.
- **Consequências:** API diferente; UI salva via worker-db.

---

**Fim da Fase 14.**