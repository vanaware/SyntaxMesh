# Roadmap — Plano geral

> **Arquivo:** `docs/syntaxmesh/07-roadmap.md`
> **Status:** 🟡 Fases 1–2 em andamento; 3–21 não iniciadas
> **Fonte da verdade:** este arquivo espelha `docs/syntaxmesh/fases/plano.md`.
> Se houver divergência, **o `plano.md` prevalece**.

O desenvolvimento do SyntaxMesh está dividido em **21 fases**. Cada fase é um port fiel de um subconjunto do TaskJuggler 3.8.4, ou uma extensão específica do SyntaxMesh (i18n, Markdown, PWA).

---

## Visão geral

```text
FASE 1  Fundação e Workspace Deno
   ↓
FASE 2  Tempo e Geometria (Core)
   ↓
FASE 3  Modelo de Atributos
   ↓
FASE 4  Árvore de Propriedades
   ↓
FASE 5  Entidades Concretas
   ↓
FASE 6  Scoreboard e Estruturas Base
   ↓
FASE 7  Scheduler Core
   ↓
FASE 8  Sistema Financeiro
   ↓
FASE 9  Orquestrador e Cache
   ↓
FASE 10 Parser e Linguagem
   ↓
FASE 11 Expressões Lógicas e Queries
   ↓
FASE 12 RichText
   ↓
FASE 13 Markdown
   ↓
FASE 14 Relatórios
   ↓
FASE 15 Gantt
   ↓
FASE 16 Apoio
   ↓
FASE 17 HTML/XML
   ↓
FASE 18 Time/Status Sheets
   ↓
FASE 19 Storage
   ↓
FASE 20 PWA + UI
   ↓
FASE 21 Compatibilidade e Qualidade
   ↓
Release 1.0
```

---

## Camadas e dependências

```text
                    SYNTAXMESH
                        │
        ┌───────────────┴────────────────┐
        │                                │
     ENGINE                            APP
        │                                │
   Fases 2–19                       Fases 20–21
   (Core + Parser                    (UI + PWA +
    + Report + Storage)               Release)
        │
        ▼
    deno task check-all  (todas as fases fecham verde)
```

**Regra arquitetural mais importante** (ADR 001):

```text
APP → REPORT → STORAGE → CORE ← PARSER
```

O **Core** nunca importa DOM, Preact, BeerCSS, IndexedDB, OPFS ou qualquer camada superior.

---

## Resumo executivo

| Fase | Pacote principal | Referências Ruby (fonte) | Prioridade | Status |
|---|---|---|---|---|
| 1 | workspace | — (infraestrutura pura) | Alta | ✅ Concluída |
| 2 | core | `TjTime`, `Interval`, `IntervalList`, `Scoreboard`, `WorkingHours`, `RealFormat` | **Crítica** | 🟡 Em andamento |
| 3 | core | `AttributeBase`, `AttributeDefinition`, `Attributes`, `deep_copy` | **Crítica** | ⬜ |
| 4 | core | `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy` | **Crítica** | ⬜ |
| 5 | core | `Task`, `Resource`, `Account`, `Shift`, `Report`, `Project` (AttributeDefinitions) | **Crítica** | ⬜ |
| 6 | core | `Scoreboard` (bits), `Limits`, `ShiftAssignments`, `ShiftScenario` | **Crítica** | ⬜ |
| 7 | core | `TaskScenario`, `ResourceScenario`, `Allocation`, `Booking`, `TaskDependency`, `DataCache` | **Crítica** | ⬜ |
| 8 | core | `Charge`, `ChargeSet`, `AccountCredit`, `AccountScenario` | Alta | ⬜ |
| 9 | core | `Project`, `TaskJuggler`, `PropertyList`, `MessageHandler`, `Log`, `AppConfig` | **Crítica** | ⬜ |
| 10 | parser + language | `TextParser/*`, `ProjectFileScanner`, `ProjectFileParser`, `TjpSyntaxRules` | **Crítica** | ⬜ |
| 11 | core | `LogicalExpression`, `LogicalOperation`, `LogicalFunction`, `Query`, `SimpleQueryExpander` | **Crítica** | ⬜ |
| 12 | richtext | `RichText`, `RichText/*` | Alta | ⬜ |
| 13 | markdown | — (extensão SyntaxMesh) | Baixa | ⬜ |
| 14 | report | `reports/*` (`TaskReport`, `ResourceReport`, `AccountReport`, `TextReport`, etc.) | **Crítica** | ⬜ |
| 15 | report | `GanttChart`, `GanttRouter`, `CollisionDetector`, `HTMLGraphics` | Alta | ⬜ |
| 16 | core | `Journal`, `AlertLevelDefinitions`, `LeaveList`, `TernarySearchTree`, `AlgorithmDiff`, etc. | Alta | ⬜ |
| 17 | core (xml) | `XMLDocument`, `XMLElement`, `HTMLDocument`, `HTMLElements`, `ICalendar`, `Painter` | Média | ⬜ |
| 18 | core (sheets) | `TimeSheets`, `Sheet*`, `TimeSheetSummary` | Média | ⬜ |
| 19 | storage | — (worker-db já pronto na Fase 1) | Alta | ⬜ |
| 20 | ui + service-worker | — (extensão SyntaxMesh) | Média | ⬜ |
| 21 | tests/ | MWEs (`docs/Learning/mwe001–009`), TestSuite | **Crítica** | ⬜ |

---

## Fases em detalhe

### FASE 1 — Fundação e Workspace Deno

**Objetivo:** esqueleto do monorepo, quality pipeline, ADRs.

**Referências TJ:** nenhuma (infraestrutura pura).

**Entregáveis:**
- `deno.jsonc` raiz com `workspace`, `catalog`, `imports`, `tasks`.
- 12 packages: `core`, `parser`, `language`, `richtext`, `markdown`, `report`, `storage`, `worker-db`, `utils`, `service-worker`, `ui`, `server`.
- Cada package com `deno.jsonc` próprio e `mod.ts`.
- `@std/testing/bdd` + `@std/assert` como padrão.
- ADRs 001–012.
- CI local: `deno task check-all`.

**Critério de aceite:** `deno task check-all` verde.

**Plano:** `fases/fase-1-fundacao.md` · **Tarefas:** `fases/fase-1-tarefas.md`

---

### FASE 2 — Tempo e Geometria

**Objetivo:** base temporal do motor. Tudo depende disso.

**Referências TJ:**
- `TjTime.rb` ← **fonte primária**
- `Interval.rb`, `IntervalList.rb`, `Scoreboard.rb`, `WorkingHours.rb`, `RealFormat.rb`

**Entregáveis:**
- `TjTime` (representação em segundos, parsing, normalizações, avanços, diferenças, timezone, `strftime` mínimo).
- `Interval`, `TimeInterval`, `ScoreboardInterval`.
- `IntervalList`, `Scoreboard`.
- `WorkingHours`, `RealFormat`.
- ADR 012.
- Infraestrutura de golden tests (`scripts/golden/*.rb`).

**Critério de aceite:** `deno task check-all` + `deno task golden:generate` verdes.

**Plano:** `fases/fase-2-tempo-geometria.md` · **Tarefas:** `fases/fase-2-tarefas.md` · **Revisão:** `fases/fase-2-tarefas-complementar1.md`

---

### FASE 3 — Modelo de Atributos

**Objetivo:** sistema de tipos de atributos com herança e scenario-specific.

**Referências TJ:**
- `AttributeBase.rb`, `AttributeDefinition.rb`, `Attributes.rb`, `deep_copy.rb`

**Entregáveis:**
- `AttributeBase`, `ListAttributeBase`, `AttributeDefinition`, `AttributeOverwrite`.
- ~40 subclasses de atributo (escalares, referências, listas, dependências, financeiro, alocação, lógicas, tempo complexo, formatação, ricos).
- `deepClone` utility.
- Interface `PropertyLike` (R2 — ver `fase-3-modelo-atributos.md` §4.11).
- Interface `RichTextIntermediate` (port para Fase 12).
- ADR 014.

**Critério de aceite:** `deno task check-all` + golden tests verdes.

**Plano:** `fases/fase-3-modelo-atributos.md` · **Tarefas:** `fases/fase-3-tarefas.md`

---

### FASE 4 — Árvore de Propriedades

**Objetivo:** `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy`.

**Referências TJ:**
- `PropertyTreeNode.rb` ← **central**
- `PropertySet.rb`, `ScenarioData.rb`, `Scenario.rb`, `PTNProxy.rb`

**Entregáveis:**
- `PropertyTreeNode` (estrutura, IDs, atributos lazy, herança, adoção, backup/restore).
- `PropertySet` (namespace, blueprint, índices).
- `ScenarioData`, `Scenario`, `PTNProxy`.
- `AttributeContainer`, `ProjectLike`, `MockContainer`, `MockProject`.
- ADR 015 (metaprogramação — **sem `Proxy`**).

**Critério de aceite:** `deno task check-all` + golden tests verdes.

**Plano:** `fases/fase-4-arvore-propriedades.md` · **Tarefas:** `fases/fase-4-tarefas.md`

---

### FASE 5 — Entidades Concretas

**Objetivo:** `Task`, `Resource`, `Account`, `Shift`, `Report` + ~141 `AttributeDefinition`s.

**Referências TJ:**
- `Task.rb`, `TaskScenario.rb` (construtor), `Resource.rb`, `ResourceScenario.rb` (construtor).
- `Account.rb`, `AccountScenario.rb`, `Shift.rb`, `ShiftScenario.rb`, `Report.rb`.
- `Project.rb` (seções 200–420) ← **fonte das `AttributeDefinition`s**.

**Entregáveis:**
- Entidades como wrappers finos de `PropertyTreeNode`.
- `*Scenario` como esqueletos (lógica vai para Fase 7).
- `registerScenarioAttributes`, `registerShiftAttributes`, `registerAccountAttributes`, `registerResourceAttributes`, `registerTaskAttributes`, `registerReportAttributes`.
- `ScenarioData.preloadAttributes`.
- ADR 015 (pré-carregamento).

**Critério de aceite:** golden tests comparam as ~141 `AttributeDefinition`s com o `Project.rb` real.

**Plano:** `fases/fase-5-entidades-concretas.md`

---

### FASE 6 — Scoreboard e Estruturas Base

**Objetivo:** bit-encoding do `Scoreboard`, `Limits`, `ShiftAssignments`.

**Referências TJ:**
- `Scoreboard.rb` (revisitar), `Limits.rb`, `ShiftAssignments.rb`, `ShiftScenario.rb`.

**Entregáveis:**
- `scoreboard-bits.ts` (constantes + helpers).
- `Limits` + `Limit`.
- `ShiftAssignments` + `ShiftAssignment` (com compartilhamento via `@@scoreboards`).
- `ShiftScenario` consolidado.
- `ResourceScenario.onShift?`.
- `projectObjectId` helper.
- ADR 016 (encoding).

**Critério de aceite:** golden tests de `getSbSlot` em ~20 índices.

**Plano:** `fases/fase-6-scoreboard-estruturas.md`

---

### FASE 7 — Scheduler Core

**Objetivo:** o **coração**. Algoritmo heurístico slot-a-slot.

**Referências TJ:**
- `TaskScenario.rb` ← **central (~1200 linhas)**
- `ResourceScenario.rb` ← **central (~900 linhas)**
- `Allocation.rb`, `Booking.rb`, `TaskDependency.rb`, `DataCache.rb`.

**Entregáveis:**
- `TaskDependency`, `Allocation`, `Booking`, `DataCache`.
- `TaskScenario` completo (`prepareScheduling`, `Xref`, `preScheduleCheck`, `checkForLoops`, `calcCriticalness`, `schedule`, `bookResources`, `propagateDate`, `bookBookings`, `finishScheduling`, `postScheduleCheck`, queries).
- `ResourceScenario` completo (`initScoreboard`, `book`, `available?`, `treeSum`, `getEffectiveWork`, queries).
- ADR 017 (heurística).

**Critério de aceite:** golden tests end-to-end dos 9 MWEs + `TestSuite/Scheduler/`.

**Plano:** `fases/fase-7-scheduler-core.md`

---

### FASE 8 — Sistema Financeiro

**Objetivo:** custos, receitas, balanço.

**Referências TJ:**
- `Charge.rb`, `ChargeSet.rb`, `AccountCredit.rb`, `AccountScenario.rb`.
- `TaskScenario.turnover`, `ResourceScenario.turnover`.
- `reports/AccountListRE.rb` (modo balance).

**Entregáveis:**
- `AccountCredit`, `Charge`, `ChargeSet`.
- `AccountScenario.turnover` + `query_balance` + `query_turnover`.
- `TaskScenario.turnover` e `ResourceScenario.turnover` completos.
- Meta-account (`createBalanceAccount` / `removeBalanceAccount`).
- ADR 018 (modelo financeiro).

**Critério de aceite:** golden tests do `mwe004` + variações.

**Plano:** `fases/fase-8-financeiro.md`

---

### FASE 9 — Orquestrador e Cache

**Objetivo:** colar tudo. `Project.schedule()` funciona end-to-end.

**Referências TJ:**
- `Project.rb` ← **central**
- `TaskJuggler.rb`, `PropertyList.rb`, `MessageHandler.rb`, `Log.rb`, `TjException.rb`, `SourceFileInfo.rb`, `AppConfig.rb`, `Tj3Config.rb`.

**Entregáveis:**
- `SourceFileInfo`, `MessageHandler`, `Log`.
- `PropertyList` (tree sort em 2 passes).
- `AppConfig`, `Tj3Config`.
- `Project` completo (`schedule`, `prepareScenario`, `scheduleScenario`, `finishScenario`, `generateReports`).
- `TaskJuggler` top-level.
- `MockProject` removido; testes migrados para `Project` real.
- ADR 019 (orquestrador).

**Critério de aceite:** golden tests end-to-end dos 9 MWEs.

**Plano:** `fases/fase-9-orquestrador-cache.md`

---

### FASE 10 — Parser e Linguagem

**Objetivo:** lexer, parser FSM, gramática TJP, i18n.

**Referências TJ:**
- `TextParser.rb` + `TextParser/*` (Pattern, Rule, State, StateTransition, StackElement, MacroTable, TokenDoc, SourceFileInfo).
- `ProjectFileScanner.rb`, `ProjectFileParser.rb`, `TjpSyntaxRules.rb` (**~300 regras**).

**Entregáveis:**
- `TextParser` FSM.
- `Scanner` + `ProjectFileScanner`.
- `ProjectFileParser`.
- `TjpSyntaxRules` completo (dividido em 4 subfases).
- `LanguageRegistry` + 3 idiomas (`en`, `pt-BR`, `es`).
- Diretiva `language "pt-BR"` funcional.
- ADRs 020 (FSM), 021 (i18n).

**Critério de aceite:** golden tests com `TestSuite/Syntax/Correct/` + `Syntax/Errors/` + AST equivalente entre idiomas.

**Plano:** `fases/fase-10-parser-linguagem.md`

---

### FASE 11 — Expressões Lógicas e Queries

**Objetivo:** motor de expressões lógicas + ponte para reports.

**Referências TJ:**
- `LogicalExpression.rb`, `LogicalOperation.rb`, `LogicalFunction.rb`, `Query.rb`, `SimpleQueryExpander.rb`.

**Entregáveis:**
- `LogicalOperation`, `LogicalAttribute`, `LogicalFlag`, `LogicalFunction`, `LogicalExpression`.
- 14 funções lógicas (`hasalert`, `isactive`, `ischildof`, etc.).
- `Query` completo (`process`, accessors, `scaleDuration`/`scaleLoad`, `resolvePropertyId`, `setCustomData`).
- `SimpleQueryExpander`.
- ADR 022 (expressões sem precedência).

**Critério de aceite:** golden tests de expressões + queries dos MWEs.

**Plano:** `fases/fase-11-logica-queries.md`

---

### FASE 12 — RichText

**Objetivo:** markup MediaWiki para compatibilidade `.tjp`.

**Referências TJ:**
- `RichText.rb`, `RichText/*` (Element, Parser, Scanner, SyntaxRules, Snip, Document, TOCEntry, TableOfContents, FunctionHandler, FunctionExample, RTFHandlers, RTFNavigator, RTFQuery, RTFReport, RTFReportLink).

**Entregáveis:**
- `RichText`, `RichTextIntermediate`, `RichTextElement`.
- `RichTextScanner`, `RichTextParser`, `RichTextSyntaxRules`.
- `RichTextSnip`, `RichTextDocument`, `TOCEntry`, `TableOfContents`.
- `RichTextFunctionHandler` + subclasses (com stubs para `RTFReport`, `RTFReportLink`, `RTFNavigator`).
- `RichTextFactory` implementado e integrado com `ProjectFileParser`.
- ADR 023 (RichText e handlers).

**Critério de aceite:** golden tests de markup (`TestSuite/RichText/`).

**Plano:** `fases/fase-12-richtext.md`

---

### FASE 13 — Markdown

**Objetivo:** formato going-forward. Aditivo, não substitui RichText.

**Referências TJ:** nenhuma (extensão SyntaxMesh).

**Entregáveis:**
- `MarkdownFactory` (implementa `RichTextFactory`).
- `micromark` + `mdast-util-from-markdown` + `mdast-util-gfm`.
- Extensões: cor, HTML inline, funções customizadas, mini-queries.
- `to_markdown()` em `RichTextIntermediate`.
- `richTextToMarkdown` (one-way).
- ADR 024.

**Critério de aceite:** snapshot tests.

**Plano:** `fases/fase-13-markdown.md`

---

### FASE 14 — Relatórios

**Objetivo:** pipeline completo de relatórios.

**Referências TJ:**
- `reports/Report.rb`, `ReportBase.rb`, `TableReport.rb`, `ReportTable*.rb`, `TableColumnDefinition.rb`.
- `TaskListRE.rb`, `ResourceListRE.rb`, `AccountListRE.rb`, `TextReport.rb`.
- `ExportRE.rb`, `TjpExportRE.rb`, `MspXmlRE.rb`, `ICalReport.rb`, `NikuReport.rb`, `TraceReport.rb`, `TagFile.rb`.
- `Navigator.rb`, `ChartPlotter.rb`, `CSVFile.rb`.

**Entregáveis:**
- Infraestrutura de tabela completa.
- `Report` + `ReportBase` + `TableReport` + `ColumnTable`.
- 11 reports específicos.
- `Navigator`, `ChartPlotter`.
- `RTFReport`, `RTFReportLink`, `RTFNavigator` completos (stubs da Fase 12 removidos).
- ADR 025 (reports browser-only — retornam strings).

**Critério de aceite:** golden tests de reports dos 9 MWEs + `TestSuite/Reports/`.

**Plano:** `fases/fase-14-relatorios.md`

---

### FASE 15 — Gantt

**Objetivo:** Gantt chart completo em **HTML+CSS** (não SVG).

**Referências TJ:**
- `GanttChart.rb`, `GanttHeader.rb`, `GanttHeaderScaleItem.rb`, `GanttLine.rb`.
- `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb`.
- `GanttRouter.rb`, `CollisionDetector.rb`, `HTMLGraphics.rb`.

**Entregáveis:**
- `HTMLGraphics`, `CollisionDetector`, `GanttRouter`.
- `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`.
- `GanttHeader` + `GanttHeaderScaleItem`.
- `GanttLine`, `GanttChart`.
- Integração com `TaskReport` e `ResourceReport` (coluna `chart`).
- ADR 026 (Gantt HTML+CSS).

**Critério de aceite:** golden tests de Gantt dos MWEs.

**Plano:** `fases/fase-15-gantt.md`

---

### FASE 16 — Apoio

**Objetivo:** estruturas auxiliares + completar stubs da Fase 14.

**Referências TJ:**
- `Journal.rb`, `AlertLevelDefinitions.rb`, `LeaveList.rb`.
- `TernarySearchTree.rb`, `AlgorithmDiff.rb`, `TextFormatter.rb`.
- `FileList.rb`, `URLParameter.rb`, `StdIoWrapper.rb`, `UTF8String.rb`.
- `KateSyntax.rb`, `VimSyntax.rb`.

**Entregáveis:**
- `Journal` + `JournalEntry` + `JournalEntryList`.
- `AlertLevelDefinition` + `AlertLevelDefinitions`.
- `Leave` + `LeaveList` + `LeaveAllowance` + `LeaveAllowanceList` (substituem stubs da Fase 5).
- `TextFormatter`, `FileList`, `URLParameter`, `TernarySearchTree`, `AlgorithmDiff`.
- `StdIoWrapper` (adaptado), `UTF8String` (no-op).
- Completar 8 queries de `TaskScenario` + `ResourceScenario.query_dashboard`.
- Completar `LogicalFlag.eval` (Journal) e `LogicalFunction.hasalert`.
- `KateSyntax`, `VimSyntax`.
- ADR 027 (Journal e AlertLevel).

**Critério de aceite:** golden tests de journal + leaves.

**Plano:** `fases/fase-16-apoio.md`

---

### FASE 17 — HTML/XML

**Objetivo:** substituir implementações mínimas de XML/HTML/ICalendar/Painter por versões completas.

**Referências TJ:**
- `XMLElement.rb`, `XMLDocument.rb`, `HTMLDocument.rb`, `HTMLElements.rb`.
- `ICalendar.rb`.
- `Painter.rb` + `Painter/*` (Color, Points, Element, Group, Primitives, BasicShapes, Text, SVGSupport, FontMetrics, FontMetricsData, FontData).

**Entregáveis:**
- `XMLElement` (substitui `SimpleXMLElement` da Fase 12).
- `XMLDocument`, `HTMLDocument`, `HTMLElements`.
- `ICalendar`, `Todo`, `Event`, `Journal`, `Person` completos.
- `Painter` completo (SVG).
- Substituição transparente em RichText (Fase 12), Reports (Fase 14), Gantt (Fase 15).
- ADR 028.

**Critério de aceite:** golden tests byte-a-byte de HTML/XML/SVG.

**Plano:** `fases/fase-17-html-xml.md`

---

### FASE 18 — Time/Status Sheets

**Objetivo:** time sheets e status sheets (captura de progresso).

**Referências TJ:**
- `TimeSheets.rb`, `TimeSheetSender.rb`, `TimeSheetReceiver.rb`, `TimeSheetSummary.rb`.
- `StatusSheetSender.rb`, `StatusSheetReceiver.rb`.
- `SheetHandlerBase.rb`, `SheetSender.rb`, `SheetReceiver.rb`.

**Entregáveis:**
- `TimeSheetRecord`, `TimeSheet`, `TimeSheets`.
- `SheetHandlerBase` (com `FileStore` injetado via interface Core).
- `SheetSender`, `SheetReceiver`.
- `TimeSheetSender`, `TimeSheetReceiver`, `TimeSheetSummary`.
- `StatusSheetSender`, `StatusSheetReceiver`.
- `Project.timeSheets` + `checkTimeSheets`.
- `TaskJuggler.checkTimeSheet` / `checkStatusSheet`.
- ADRs 029 (time sheets no browser), 031 (FileStore injection).

**Critério de aceite:** golden tests de timesheets.

**Plano:** `fases/fase-18-time-status-sheets.md`

---

### FASE 19 — Storage

**Objetivo:** persistência local via `@syntaxmesh/worker-db`.

**Referências TJ:** nenhuma (extensão SyntaxMesh).

**Entregáveis:**
- `ProjectService` (CRUD).
- `Autosave` (debounced).
- `Recovery` (após crash).
- `ImportExport` (`.tjp`, `.tji`, `.json`).
- `SettingsService`.
- `ProjectLoader` (usa `TaskJuggler.parseContent` da Fase 10).
- Schema versionado (`DATA_SCHEMA_VERSION = 1`).
- Fase 18 corrigida para usar `fakeOpfs()`.
- ADR 030 (schema versionado).

**Critério de aceite:** snapshot tests byte-a-byte.

**Plano:** `fases/fase-19-storage.md`

---

### FASE 20 — PWA + UI

**Objetivo:** Service Worker, manifest, Preact + Signals + BeerCSS.

**Referências TJ:** `docs/BeerCSS/`.

**Entregáveis:**
- PWA instalável (`manifest.json` + Service Worker + offline).
- Shell + Toolbar + Sidebar + StatusBar.
- Editor de `.tjp` (com syntax highlight básico).
- ProjectExplorer (CRUD).
- ReportView, GanttView, SettingsView, SheetsView.
- `engine.worker.ts` (parser + scheduler + reports).
- Serviços (`engine-service`, `parser-service`, `scheduler-service`, `report-service`, `storage-service`).
- Signals por domínio.
- i18n de UI (separado de i18n de keywords).
- Download/upload de `.tji`.
- ADR 032.

**Critério de aceite:** Lighthouse ≥ 90 (PWA, Performance, Accessibility, Best Practices).

**Plano:** `fases/fase-20-pwa-ui.md`

---

### FASE 21 — Compatibilidade e Qualidade

**Objetivo:** provar fidelidade ao TJ, robustez e prontidão para release.

**Referências TJ:**
- `docs/Learning/mwe001–mwe009/`.
- `docs/taskjuggler/test/TestSuite/`.

**Entregáveis:**
- Corpus de fixtures (`tests/fixtures/`).
- Golden tests end-to-end (`tj3` vs `tj3-ts`) em ≥ 200 fixtures.
- AST equivalence (en ↔ pt-BR ↔ es) em ≥ 30 fixtures.
- Regression snapshots em ≥ 100 pontos.
- Benchmarks em ≥ 10 cenários.
- Security tests (OWASP vectors).
- Cross-browser (Playwright: Chromium, Firefox, WebKit).
- A11y (`axe-core`).
- Lighthouse ≥ 90 em 5 categorias.
- Relatório de conformidade.
- CHANGELOG + release notes + tag `v1.0.0`.
- ADR 033 (estratégia de validação).

**Critério de aceite:** todos os alvos acima atingidos; release 1.0 publicado.

**Plano:** `fases/fase-21-compatibilidade-qualidade.md`

---

## Prioridade

### 🔴 Prioridade 1 — Fundação
```
Fase 1  Fundação
Fase 2  Tempo e Geometria
Fase 3  Modelo de Atributos
Fase 4  Árvore de Propriedades
Fase 5  Entidades Concretas
```
Sem essas, nada funciona.

### 🔴 Prioridade 2 — Motor
```
Fase 6  Scoreboard e Estruturas Base
Fase 7  Scheduler Core
Fase 9  Orquestrador e Cache
Fase 10 Parser e Linguagem
Fase 11 Expressões Lógicas e Queries
```

### 🟠 Prioridade 3 — Relatórios
```
Fase 8  Sistema Financeiro
Fase 12 RichText
Fase 14 Relatórios
Fase 15 Gantt
```

### 🟡 Prioridade 4 — Complementos
```
Fase 13 Markdown
Fase 16 Apoio
Fase 17 HTML/XML
Fase 18 Time/Status Sheets
Fase 19 Storage
```

### 🟢 Prioridade 5 — Aplicação e Validação
```
Fase 20 PWA + UI
Fase 21 Compatibilidade e Qualidade
```

---

## Regras de execução

1. **Uma tarefa por vez.** Não avançar sem fechar a atual.
2. **TDD obrigatório.** Teste antes da implementação.
3. **Fechar cada subfase com `deno task check-all` verde.**
4. **Commit atômico** por subfase (ver `fases/README.md`).
5. **Golden tests são o critério final.** Se divergir do `tj3`, corrigir o TS (ou documentar divergência).
6. **Não corrigir bugs de outras fases.** Abrir issue no arquivo competente.
7. **Sem `any` em `src/`.** Usar `unknown` + narrowing.
8. **Nenhum import proibido no Core** (ADR 001).
9. **Ler `cheat-sheet-ruby-ts.md` antes de portar** qualquer construção Ruby.
10. **Consultar ADR 013 (`compat.keepRubyBugs`)** ao encontrar comportamento estranho no Ruby.

---

## Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/01-visao.md` — visão geral.
- `docs/syntaxmesh/03-arquitetura.md` — arquitetura em camadas.
- `docs/syntaxmesh/04-linguagem-multilingue.md` — i18n de keywords.
- `docs/syntaxmesh/06-testes-e-processo.md` — protocolo TDD.
- `docs/syntaxmesh/09-regras-para-ia.md` — regras para IA.
- `docs/syntaxmesh/10-futuro.md` — features não portadas.
- `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — mapeamento Ruby→TS + bugs.
- `docs/syntaxmesh/decisoes/` — ADRs 001–033.
- `docs/syntaxmesh/fases/plano.md` — **fonte da verdade** deste roadmap.
- `docs/syntaxmesh/fases/README.md` — guia das fases.

### Fontes de referência externa

- `docs/taskjuggler/` — código-fonte Ruby (referência primária).
- `docs/tj3-engine/` — blueprints (00–16).
- `docs/Learning/mwe001–009/` — 9 MWEs progressivos.
- `docs/BeerCSS/` — framework CSS.

---

**Última atualização:** 2026-09-12
**Fonte da verdade:** `docs/syntaxmesh/fases/plano.md`