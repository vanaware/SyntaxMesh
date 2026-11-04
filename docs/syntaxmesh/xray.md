# X-ray — TaskJuggler (Ruby) × SyntaxMesh (TS)

> **Arquivo:** `docs/syntaxmesh/xray.md`
> **Data da varredura:** 2026-11-03
> **Escopo Ruby:** `docs/taskjuggler/lib/taskjuggler/**.rb` (TJ 3.8.4 vendorizado — 191 arquivos)
> **Escopo TS:** `packages/{core,server,ui,service-worker}/src` (código não-teste)
>
> **Objetivo:** mapear a correspondência file-a-file entre o fonte Ruby e o port
> TypeScript, e apontar o que **não foi desenvolvido e não está planejado** em
> nenhuma fase (`docs/syntaxmesh/fases/`).

## Metodologia

1. Inventário completo dos dois lados (`find` + listagem por pacote).
2. Tabela de correspondência file-a-file (Ruby → contraparte TS ou âncora de fase).
3. **Varredura de métodos por classe** (~85 pares Ruby↔TS): extrai todos os
   `def` do Ruby, cameliza e procura no corpus TS; candidatos apontados foram
   verificados individualmente (chamadores reais no Ruby, âncoras no TS,
   tarefas das fases). Aproximadamente **zero métodos órfãos** nos pares
   auditados — exceto os casos listados nas seções 2–4.
4. Confronto de cada candidato com `fase-*.md`/`-tarefas.md` e `CURRENT.md`.

## Legenda de status

| Código | Significado |
|---|---|
| `OK` | Portado e verificado (golden/testes da fase dona) |
| `PAR` | Portado **parcial por decisão** — stub mínimo com âncora `NotYetImplementedError("N")` para a fase dona |
| `PLA` | Não portado, **planejado** (existe tarefa de fase que o possui) |
| `NPL` | Não portado e **NÃO planejado** — candidato a decisão de escopo (seção 3) |
| `NA` | Não aplicável ao runtime browser/PWA (idiomático Ruby) |
| `DEAD` | **Código morto no próprio Ruby** (zero chamadores no upstream) — port não é necessário |
| `EXT` | Extensão SyntaxMesh — sem contraparte no Ruby (§6) |

---

## 1. Tabela de correspondência (Ruby → SyntaxMesh)

### 1.1 Núcleo de modelo (`lib/taskjuggler/*.rb`)

| Ruby | SyntaxMesh | Status | Dona / observação |
|---|---|---|---|
| `Account.rb` | `model/account.ts` | OK | F5 |
| `AccountCredit.rb` | `finance/account-credit.ts` | OK | F8 |
| `AccountScenario.rb` | `model/account-scenario.ts` | OK | F8/8.2; buckets `charge` (14-C D1) |
| `AlertLevelDefinitions.rb` | `model/alert-levels.ts` | PAR | versão mínima (14C.0.7); completude → **F16** |
| `Allocation.rb` | `scheduling/allocation.ts` | OK | F7 |
| `AppConfig.rb` | `app-config.ts` | OK | F9 (dataDirs `[]` no browser — decisão F9) |
| `AttributeBase.rb` | `attributes/attribute-base.ts` | OK | F3 |
| `AttributeDefinition.rb` | `attributes/attribute-definition.ts` | OK | F3 |
| `Attributes.rb` (38 classes) | `attributes/**` (todas as 38) | OK | F3; auditar classes: cobertura confirmada 1:1 |
| `Booking.rb` | `scheduling/booking.ts` + `model/charge-booking.ts` | OK | F7 + 14-C C11/C15 |
| `Charge.rb` / `ChargeSet.rb` | `finance/charge.ts` / `finance/charge-set.ts` (+ `charge-set-collection.ts`) | OK | F8/8.2 |
| `DataCache.rb` | `scheduling/data-cache.ts` | OK | F9 (`flush()` implementado; comentário "stub" residual em `project.ts:648` é cosmético) |
| `Journal.rb` | `model/journal.ts` | PAR | `to_rti(mode)` ancorado **F16**; índices C0 OK |
| `LeaveList.rb` | `model/leave.ts` + `attributes/time-interval/leave-list-attribute.ts` | OK | F6/F16 (leave-allowance `to_tjp` ancorado F16) |
| `Limits.rb` | `scheduling/limits.ts` | OK | F6 |
| `Log.rb` | `log.ts` | OK | F9 |
| `MessageHandler.rb` | `message-handler.ts` | OK | F9 · **micro-divergência**: validação `checkLevel` (0–5) dos setters não portada → §4.4 |
| `PTNProxy.rb` | `model/ptn-proxy.ts` | OK | F4 |
| `Project.rb` | `model/project.ts` | PAR | F9; pipeline `dynamicAttributes` → §3.4 |
| `PropertyList.rb` | `model/property-list.ts` | OK | F4 (`includeAdoptedR` portado via `adoptees`) |
| `PropertySet.rb` / `PropertyTreeNode.rb` | `model/property-set.ts` / `model/property-tree-node.ts` | OK | F4 (backup/restore OK G20; adoção OK) |
| `Query.rb` | `query/query.ts` | PAR | F11 + 14-C B (42 `query_*`); leave-queries → F16, `fte` → F18, `dashboard` → §5.2 |
| `Resource.rb` / `ResourceScenario.rb` | `model/resource.ts` / `resource-scenario.ts` | PAR | F5/7/8; `collectLeaveIntervals` (chamado só por queries de leave) → F16 |
| `RealFormat.rb` | `format/real-format.ts` | OK | F2/F3 |
| `Scenario.rb` / `ScenarioData.rb` | `model/scenario.ts` / `scenario-data.ts` | OK | F4 + C17 |
| `Scoreboard.rb` | `time/scoreboard.ts` (+bits/interval) | OK | F6 |
| `Shift.rb` / `ShiftAssignments.rb` / `ShiftScenario.rb` | `model/shift.ts` / `scheduling/shift-assignments.ts` / `model/shift-scenario.ts` | OK | F5/F6/F7 |
| `Task.rb` / `TaskScenario.rb` | `model/task.ts` / `model/task-scenario.ts` | OK | F5/F7 + 14-C Onda A (finishScheduling fiel) |
| `TaskDependency.rb` | `scheduling/task-dependency.ts` | OK | F7 (Xref/checkDependency corrigidos G1) |
| `TaskJuggler.rb` | `taskjuggler.ts` | PAR | F9; `parse/parseFile/parseContent/freeze` ancorados **F19/14** (G7/G11) |
| `TjTime.rb` | `time/tj-time.ts` | OK | F2 (`leapYear?` = `isLeapYear`) |
| `Interval.rb` / `IntervalList.rb` | `time/interval.ts` / `time/interval-list.ts` | OK | F2 |
| `WorkingHours.rb` | `calendar/working-hours.ts` | OK | F2/F7 |
| `ICalendar.rb` | `reports/i-calendar.ts` | PAR | mínimo (F14); completo → **F17** |
| `TjException.rb` | `model/errors.ts` (+ `attributes/errors.ts`) | OK | F1+ |
| `Tj3Config.rb` | `tj3-config.ts` | OK | F1 |
| `TextFormatter.rb` | `utils/text-formatter.ts` | OK | pull-in F12 (tarefa 16.6 antecipada) |
| `URLParameter.rb` | `utils/url-parameter.ts` | OK | F14 (encode zlib) |
| `deep_copy.rb` | `utils/deep-clone.ts` | OK | F1 |
| `version.rb` | `version.ts` | OK | F1 |
| `compat` (UTF8/rbugs) | `compat.ts` | OK | ADR `keepRubyBugs` |

### 1.2 Parser / lexer / linguagem

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `ProjectFileParser.rb` | `parser/project-file-parser.ts` | OK | F10 (diff: 0 métodos faltando) |
| `ProjectFileScanner.rb` | `lexer/project-file-scanner.ts` | OK | F10 |
| `TjpSyntaxRules.rb` | `parser/rules/**` (348 regras) | OK | F10 — 380 registradas, 0 placeholders; AST-equivalence 9 MWE × 3 idiomas |
| `TextParser.rb` + `TextParser/*` | `parser/text-parser.ts`, `parser/{state,rule,pattern,stack-element}.ts`, `lexer/{macro-table,scanner,token-doc}.ts`, `source-file-info.ts` | OK | F10 (diff: 0 faltando) |
| `KeywordArray.rb` | absorvido por `i18n/{registry,canonical,en,pt-BR,es}.ts` | OK | F10.15+ — estrutura TS ≠ Ruby (registro i18n), funcional OK |

### 1.3 RichText / Markdown

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `RichText.rb` + `RichText/{Document,Element,Parser,Scanner,Snip,SyntaxRules,TableOfContents,TOCEntry,FunctionHandler,FunctionExample,RTFHandlers,RTFQuery,RTFReport,RTFReportLink,RTFNavigator,RTFWithQuerySupport}.rb` | `richtext/**` completo | OK | F12 + F14 (RTFReport/Link/Navigator desancorados 14.24.6). Diff de métodos: **0 faltando** (`textBlockIndent` é DEAD) |
| — (sem Ruby) | `markdown/**` | EXT | Extensão SyntaxMesh (F13, ADR 026) |

### 1.4 Motor lógico / queries

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `LogicalExpression.rb` / `LogicalFunction.rb` / `LogicalOperation.rb` | `logic/**` (14 funções fiéis) | OK | F11; extensões LC com âncoras válidas |
| `Query.rb` / `SimpleQueryExpander.rb` | `query/**` | PAR | ver 1.1 |

### 1.5 Relatórios (`lib/taskjuggler/reports/`)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `Report.rb` | `model/report.ts` | PAR | F14; helpers de disco (`copyDirectory`, `directoryUpToDate?`, `dataDirError`, `windowsOS?`) → escrita de arquivos é **F24/F19** (ADR 027: reports devolvem strings) |
| `ReportBase.rb` / `ReportContext.rb` | `reports/report-base.ts` / `report-context.ts` | OK | F14 |
| `TableReport*.rb` / `ReportTable*.rb` / `TableColumn*.rb` / `ColumnTable.rb` | `reports/table-report*.ts`, `report-table*.ts`, `table-column-*.ts`, `column-table.ts` | OK | F14 (diff: 0 faltando) |
| `TaskListRE` / `ResourceListRE` / `AccountListRE` / `TextReport` / `ExportRE` / `TjpExportRE` / `MspXmlRE` / `NikuReport` / `TagFile` / `TraceReport` / `ICalReport` / `CSVFile` / `Navigator` / `ChartPlotter` | homônimos em `reports/` + `chart-plotter.ts` | OK | F14; `MspXmlRE#findRolledUpParent` DEAD (sem chamadores no upstream) |
| `TimeSheetReport.rb` / `StatusSheetReport.rb` | — | PLA | **F18** planejada (NYI ancorado em `model/report.ts:223`) |
| `BreakdownReport` / `RdoReport` / `MaterialListRE` / `gallery` | `reports/breakdown-report.ts`, `rdo-report.ts`, `material-list-re.ts`, `gallery.ts` | EXT | Extensões SyntaxMesh (F10 Complemento/14-C), sem par Ruby |
| Gantt: `GanttChart/Header/HeaderScaleItem/Line/LoadStack/Milestone/Router/TaskBar/CollisionDetector/HTMLGraphics/GanttContainer` | `gantt/**` (11 arquivos) + `tests/gantt/**` | OK | **Fase 15 está EM ANDAMENTO na prática (15.0–15.12)** — ver §5.1; restante: 15.13 golden + 15.14 verificação |

### 1.6 Sheets (time/status)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `TimeSheet.rb`/`TimeSheetRecord` (dentro `TimeSheets.rb`) | `scheduling/time-sheet.ts` | PAR | esqueleto p/ parser (10.14.1); conversão em bookings → **F18** |
| `TimeSheets.rb` (classe `TimeSheets`) | `scheduling/time-sheets.ts` | PAR | stub F9 (`push/check/warnOnDelta`); **F18** |
| `SheetHandlerBase/SheetSender/SheetReceiver.rb` | — | PLA | **F18** Bloco B (18.6–18.9) |
| `TimeSheetSender/Receiver/Summary`, `StatusSheetSender/Receiver` | — | PLA | **F18** (18.10–18.11); transporte email→download (ADR 029 **proposto**) |

### 1.7 Ferramentas de documentos e sintaxe (tj3man)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `SyntaxReference.rb` | — | NPL | **não portado e sem tarefa dona**; é chamado de "pré-requisito da Fase 14" por 16.14 — mas a Fase 14 nunca o possuiu → §3.2 |
| `KeywordDocumentation.rb` | — | NPL | idem §3.2 |
| `TjpExample.rb` | — | NPL | §3.2 |
| `UserManual.rb` | — | NPL | gerador de manual; tied a tj3man → §3.1 |
| `TernarySearchTree.rb` | — | PLA | planejado **16.9** (core only, reuso F22) |
| `KateSyntax.rb` / `VimSyntax.rb` | — | PLA/NA | geradores finais **CANCELADOS** (16.15); núcleo → `SyntaxCore` **16.14** |
| `AlgorithmDiff.rb` | — | PLA/DEAD | planejado **16.10**, mas DEAD **nenhum chamador no upstream** — revalidar utilidade antes de portar |
| `FileList.rb` | — | PLA | planejado **16.7** (adaptar a OPFS/F19) |
| `StdIoWrapper.rb` | — | PLA | planejado **16.11** (core only) |
| `UTF8String.rb` | — | PLA | planejado **16.12** (no-op em TS) |

### 1.8 Apps e daemon (`apps/`, `daemon/`, `lib/tj3*.rb`)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `apps/Tj3.rb` + `Tj3AppBase.rb` + `lib/tj3.rb` | planejado **F24** (CLI `packages/cli`, mapa de opções §5.2 do plano) | PLA | ADR 034 reservada |
| `apps/Tj3Man.rb` + `lib/tj3man.rb` | — | NPL | §3.1 |
| `apps/Tj3Client.rb` + `lib/tj3client.rb` | substituído por chamada in-process (F18 §4.3 documenta) | NA | sem port próprio — decisão já registrada em F18 |
| `apps/Tj3Daemon.rb`, `apps/Tj3WebD.rb`, `daemon/*` (9 arquivos), `lib/tj3d.rb`, `lib/tj3webd.rb` | — | NPL | §3.1 |
| `apps/Tj3SsSender/Receiver`, `Tj3TsSender/Receiver/Summary`, `Tj3SheetAppBase.rb`, `lib/tj3ss_*.rb`/`tj3ts_*.rb` | — | NPL | §3.3 (núcleo das classes sim é F18) |

---

## 2. Varredura de métodos: resultado consolidado

Diff automático de `def`s Ruby → corpus TS (nome camelizado buscado globalmente)
sobre ~85 pares de arquivos. Saída bruta em `.tmp/xray-diff.py` / `.tmp/xray-diff2.py`.

- **98% dos métodos encontrados no TS**, inclusive áreas de alto risco
  (`Project.rb`, `TaskScenario.rb`, `Query.rb`, `RichText/*`, `TextParser/*`,
  `TableReport*`, `Gantt*`).
- Todos os "faltantes" foram triados abaixo. **Nenhum revela funcionalidade
  silenciosamente não portada nas Fases concluídas (2–14C)** — os reais
  candidatos sem dono estão nas seções 3 e 4.

### 2.1 Falsos positivos (portado com outro nome / absorvido)

| Ruby | Realidade TS |
|---|---|
| `PropertyList#includeAdoptedR` | recursão via `adoptees` em `property-list.ts:132` + `property-tree-node.ts` |
| `TjTime#leapYear?` | `TjTime.isLeapYear` |
| `KeywordArray` (tradução/indexação de keywords) | subsistema `i18n/` (F10.15+) |
| `RichText/SyntaxRules#rule_*` (30 métodos) | declarados como patterns/arrays no `rich-text-syntax-rules.ts` (mesma FSM da F10) |
| `ResourceScenario#setReports_i` | artefato de regex do script (loop interno do Ruby) |

### 2.2 DEAD Código morto no próprio Ruby (não portado — e não precisa ser)

Zero chamadores em todo o `lib/` vendorizado. Auditar na F21 se algum se torna
vivo via `method_missing`/dispatch dinâmico; até então, **não criar task**:

| Ruby | Nota |
|---|---|
| `AlertLevelDefinitions#indexByColor` | sem uso |
| `Task#journalText` | sem uso (o caminho real de journal nos reports é F16) |
| `TaskScenario#setDetermination` | sem uso |
| `RichText::Element#textBlockIndent` | sem uso |
| `MspXmlRE#findRolledUpParent` | sem uso — o rollup do MSPDI TS é feito por `rollupTask.eval` direto (`msp-xml-re.ts:591`) |
| `AlgorithmDiff` (arquivo inteiro) | sem uso — mas planejado em 16.10; revalidar (§1.7) |
| `TaskScenario#period_to_s` | só interpolado em `Log.msg` internos; logs TS usam outra formatação — sem consequência funcional |

---

## 3. NPL Lacunas sem dono — não desenvolvidas **e não planejadas**

Estas são as respostas diretas ao objetivo do x-ray. Para cada uma, a
recomendação é: **descrever explicitamente no `plano.md` (rejeição de escopo
com justificativa) OU criar tarefa numa fase dona.** Hoje existem como "vazio
de plano".

| # | Item (fontes Ruby) | O que faz no TJ3 | Situação no plano | Recomendação |
|---|---|---|---|---|
| 3.1 | **Daemon/web server**: `apps/Tj3Daemon.rb`, `apps/Tj3WebD.rb`, `apps/Tj3Client.rb`, `daemon/{Daemon,DaemonConnector,ProcessIntercom,ProjectBroker,ProjectServer,ReportServer,ReportServlet,WebServer,WelcomePage}.rb`, `lib/tj3d.rb`, `lib/tj3webd.rb` | TCP-socket multi-processo: projeta `.tjp` residente, gera reports sob demanda via URL, cache entre requisições | **Nenhuma menção** em `plano.md`/fases (só F18/F16 citam "daemon fora de escopo" de passagem; F22 cita como *inspiração* do relatório-layer) | Registrar decisão explícita de descarte (arquitetura browser PWA não tem processo-residente; o equivalente funcional = `Project.generateReports` in-process — F14 — + UI F20 + relatório embutido F22 §3.3). Sugere ADR curto ou seção "Fora de escopo" no plano canônico |
| 3.2 | **Cadeia de documentação tj3man**: `apps/Tj3Man.rb`, `UserManual.rb`, `KeywordDocumentation.rb`, `SyntaxReference.rb`, `TjpExample.rb`, `lib/tj3man.rb` | Gera manuais HTML/RTF e **banco de referência de sintaxe/keywords** (usado por Kate/Vim e pelo help) | `SyntaxReference`/`KeywordDocumentation` aparecem só como *"Pré-requisitos: Fase 14"* da tarefa **16.14 (SyntaxCore)** — mas a Fase 14 **nunca os portou** (0 ocorrências em `packages/core/src`). Dependência órfã: 16.14 não-executável como escrita. `TjpExample`/`UserManual`/`Tj3Man` sem nenhuma referência | Decidir onde vivem: (a) portar `SyntaxReference`+`KeywordDocumentation` como tarefas **próprias do Bloco E da F16** (16.14 passa a possuí-las, removendo o pointer falso à F14); ou (b) ancorar na **F22** (que é a consumidora real — LSP help/manual, usando o `SyntaxCore` da 16.14) |
| 3.3 | **Apps CLI de sheets**: `apps/Tj3SsSender/Receiver.rb`, `Tj3TsSender/Receiver/Summary.rb`, `Tj3SheetAppBase.rb`, `lib/tj3ss_*.rb`, `lib/tj3ts_*.rb` | Front-ends de linha de comando que empacotam `SheetSender/Receiver` (transporte por email/SMTP) | Classes centres **são** planejadas (F18 blocos B–D); os **wrappers CLI** não — a F24 se limita ao `tj3` (plano §5, fonte `man/tj3.1` + `Tj3.rb`) | Decidir na abertura da F18/F24: estender a F24 com subcomandos (`wz ss-send`, `wz ts-recv`…) reusando as classes da F18, ou declarar os apps descartados (a F18 já substitui SMTP por download/upload via UI). Baixo custo, mas precisa de registro explícito |
| 3.4 | **Pipeline `dynamicAttributes`**: `Project.rb:778-812` (`generateReport(..., dynamicAttributes)`), `ProjectFileParser#parseReportAttributes`, regra `rule_dynamicAttributes` (`TjpSyntaxRules.rb:1034`) | Injeta atributos/colunas extras em um report na geração via string (usado pelo ReportServer/ReportServlet do daemon e pelo `SheetSender` para colunas de timesheet) | No TS o parâmetro existe mas os três passos estão **comentados como `// stub`** (`project.ts:681-686`) **sem âncora** (política ADR 032 exige `// Ancorado: Fase N`). A regra de parser está registrada (`rules/common.ts:784`) mas sem consumidor. O lado daemon não tem dono (3.1); o lado **F18 existe e precisa dele** (colunas dinâmicas do timesheet template) | **Anexar à F18** (novo adendo: entregar `backupAttributes`(OK já existe) + `parseReportAttributes` + restore no `generateReport`) e adicionar a âncora `// Ancorado: Fase 18` nos três stubs, para o `check:stubs` cobrir |
| 3.5 | **`Painter/*` completo vs mínimo**: `Painter/{FontMetrics,FontMetricsData,Text,BasicShapes,Primitives,Group,SVGSupport,...}.rb` | Desenho vetorial com métricas de fonte reais (usada por ChartPlotter e Gantt-PNG do tj3) | **Está planejado** (F17 bloco de substituição + fontes listadas) — sem lacuna. `Painter/Element.rb` e `Color/Points` cobertos conceitualmente pelo `painter-min.ts` | Nada a decidir; registrar apenas que F17 substituirá `painter-min.ts`/`chart-plotter.ts` (SVG completo) |

### 3.4.1 Achado correlato (bônus da varredura)

`MessageHandler#checkLevel` (validação de nível 0–5 nos setters de
`outputLevel`/`logLevel`) não tem equivalente: o TS expõe campos públicos
sem validação (`message-handler.ts:9-10`). Micro-dívida — corrigir ao tocar o
arquivo (regra "fix technical debt immediately"), sem fase própria.

---

## 4. PAR Gaps âncora-plano: portado como stub **com** fase dona (nada a decidir)

Registrados por completude — cada um já tem âncora verificada por
`scripts/check-stubs.ts` e/ou linha na `completude-matrix.md`:

| Stub TS | Âncora | Dona |
|---|---|---|
| `Resource#query_dashboard` | `Ancorado: Fase 15` (código) **⚠️ colisão: a tarefa 16.17 também o declara** — ver §5.2 | F15 ou F16 (decidir) |
| `query_annualleave*`/`sickleave`/`specialleave`/`timeoffdays`/`unpaidleave`, leave-allowance `to_tjp`, `hasalert`, `Journal#to_rti(mode)` | Fase 16 | F16 |
| `query_fte`, `checkTimeSheet/checkStatusSheet`, `istaskstatus`, report types `timesheetreport/statussheetreport` | Fase 18 | F18 |
| `TaskJuggler#parse/parseFile/parseContent/freeze` (transporte de arquivo) | Fase 19 | F19 |
| Escrita a disco de reports (`Report.rb` file I/O) | ADR 027 (strings) + F24 (CLI escreve) | F24 |
| 13.14.3/13.14.4 (imagens: `objectURL`, `format richtext` no parser de report) | Fases 19/14-adendo | F19/F14-C |

---

## 5. Inconsistências de documentação detectadas na varredura

| # | Achado | Evidência | Ação sugerida |
|---|---|---|---|
| 5.1 | **Fase 15 não é "Não iniciada" (PLA)** como afirmam `AGENTS.md` e `CURRENT.md` | `packages/core/src/gantt/**` (11 módulos fiel-portados) + `tests/gantt/**` (10 suites) + ADR 028 existente + `fase-15-gantt-tarefas.md`: **Status: Em andamento, 201/~210 (15.0–15.12)**; restam 15.13 (golden) e 15.14 (verificação final) | Atualizar a tabela de fases no `AGENTS.md`/`CURRENT.md` para "Em andamento" (PAR) |
| 5.2 | **Dono duplicado de `query_dashboard`**: âncora no código diz Fase 15; tarefa 16.17 diz Fase 16 | `resource.ts:93-95` vs `fase-16-apoio-tarefas.md:595` | Unificar (sugestão: o stub menciona "trackingscenario + alertas" — ambos são F16; mover a âncora para 16 e riscar a referência da 15) |
| 5.3 | **ADR 029 referenciada mas inexistente** (README lista "029 — Journal e AlertLevel em TypeScript — Proposto"; a F18 cita "ADR 029" para a decisão email→download) | `ls decisoes/` não tem 029; `fase-18-time-status-sheets.md:62` | Criar/renumerar: confirmar se 029 é (a) journal/alert ou (b) sheets; hoje há duas reivindicações para o mesmo número |
| 5.4 | Comentário residual `// stub` no `DataCache.flush()` de `project.ts:648` — o flush **está implementado** (`data-cache.ts:55`) | visto na varredura | Remover o comentário enganoso |
| 5.5 | `completude-matrix.md` cobre F2–F12 apenas; gaps de F13–F14C estão espalhados em `CURRENT.md` | cabeçalho da matriz | Opcional: estender a matriz pós-F14 (a F21 vai regenerar anyway) |

---

## 6. Extensões TS sem par Ruby (registro, mão inversa)

Não são lacunas — materializam requisitos fora do TJ 3.8.4 e estão todas ancoradas em plano/ADR:

`material/**` + `materialreport`/`breakdownreport`/`rdoreport`/`gallery` (F8.1/10-C/14/14-C) ·
`picture`/`format`/`flags` (F10-C) · `markdown/**` (F13, ADR 026) · `i18n` multilíngue de diretivas (F10) ·
`model/booking-period.ts` + tails temporais (`onstart|perhour|…`) (14-C D3) ·
`chargebookings`/`stockbookings`/`materialbookings` + unit price por composição (14-C C13–C16) ·
`defaultaccount` + variantes (14-C C9) · MSPDI estendido (recursos material/custo, `<Baseline>`, `<Exceptions>`) (14-C C4/C10) ·
`timezone.ts` · cenários `MaterialScenario`/`TrackingScenario` completos.

---

## 7. Conclusão

- **Superfície funcional do TJ3 processada (parser→scheduler→finance→reports→gantt): sem buracos.** A varredura método-a-método não encontrou nenhum comportamento do Ruby silenciosamente esquecido nas fases concluídas; os stubs remanescentes têm todos fase dona (§4), exceto um único caso sem âncora (§3.4).
- **As 5 lacunas reais "não feitas e não planejadas" estão em §3** — e concentram-se na periferia do TJ3 que a arquitetura browser-PWA descarta por natureza (daemon/webd, tj3man, wrappers CLI de sheets) **mais** dois pontos operacionais: (1) a dependência órfã `SyntaxReference`/`KeywordDocumentation` da tarefa 16.14 (bloqueia a F16 como escrita) e (2) o pipeline `dynamicAttributes`, silenciosamente stubado, de que a F18 vai precisar.
- Documentação de status: **Fase 15 está 95% realizada mas registrada como **não iniciada** (PLA)** (§5.1) — corrigir antes de retomar o plano, para não re-portar o que existe.

### Como reproduzir esta varredura

```sh
python3 .tmp/xray-diff.py    # tabela principal (Fases 2–15)
python3 .tmp/xray-diff2.py   # richtext/textparser/report-tables
```
