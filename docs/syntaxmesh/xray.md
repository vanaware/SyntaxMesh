# X-ray — TaskJuggler (Ruby) × SyntaxMesh (TS)

> **Arquivo:** `docs/syntaxmesh/xray.md`
> **Data da varredura:** 2026-11-03
> **Escopo Ruby:** `docs/taskjuggler/lib/taskjuggler/**.rb` (TJ 3.8.4 vendorizado — 191 arquivos)
> **Escopo TS:** `packages/{core,server,ui,service-worker}/src` (código não-teste)
>
> **Objetivo:** mapear a correspondência file-a-file entre o fonte Ruby e o port
> TypeScript, e apontar o que **não foi desenvolvido e não está planejado** em
> nenhuma fase (`docs/syntaxmesh/fases/`).
>
> **Resolução (2026-11-03):** todas as lacunas de §3 e todas as inconsistências de
> §5 receberam dono e foram propagadas nos docs de fase + código. Ver **§8** ao fim
> deste arquivo. As seções 2–5 permanecem como registro da varredura original.

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
| `DataCache.rb` | `scheduling/data-cache.ts` | OK | F9 (`flush()` implementado **e chamado** por `Project#generateReports` desde 2026-11-03 — §5.4 resolvido) |
| `Journal.rb` | `model/journal.ts` | PAR | `to_rti(mode)` ancorado **F16**; índices C0 OK |
| `LeaveList.rb` | `model/leave.ts` + `attributes/time-interval/leave-list-attribute.ts` | OK | F6/F16 (leave-allowance `to_tjp` ancorado F16) |
| `Limits.rb` | `scheduling/limits.ts` | OK | F6 |
| `Log.rb` | `log.ts` | OK | F9 |
| `MessageHandler.rb` | `message-handler.ts` | OK | F9 · **micro-divergência**: validação `checkLevel` (0–5) dos setters não portada → §3.4.1 / **F18 18.20** |
| `PTNProxy.rb` | `model/ptn-proxy.ts` | OK | F4 |
| `Project.rb` | `model/project.ts` | PAR | F9; pipeline `dynamicAttributes` → §3.4 |
| `PropertyList.rb` | `model/property-list.ts` | OK | F4 (`includeAdoptedR` portado via `adoptees`) |
| `PropertySet.rb` / `PropertyTreeNode.rb` | `model/property-set.ts` / `model/property-tree-node.ts` | OK | F4 (backup/restore OK G20; adoção OK) |
| `Query.rb` | `query/query.ts` | PAR | F11 + 14-C B (42 `query_*`); leave-queries → F16, `fte` → F18, `dashboard` → **F16** (§5.2 resolvido) |
| `Resource.rb` / `ResourceScenario.rb` | `model/resource.ts` / `resource-scenario.ts` | PAR | F5/7/8; `collectLeaveIntervals` (chamado só por queries de leave) → F16 |
| `RealFormat.rb` | `format/real-format.ts` | OK | F2/F3 |
| `Scenario.rb` / `ScenarioData.rb` | `model/scenario.ts` / `scenario-data.ts` | OK | F4 + C17 |
| `Scoreboard.rb` | `time/scoreboard.ts` (+bits/interval) | OK | F6 |
| `Shift.rb` / `ShiftAssignments.rb` / `ShiftScenario.rb` | `model/shift.ts` / `scheduling/shift-assignments.ts` / `model/shift-scenario.ts` | OK | F5/F6/F7 |
| `Task.rb` / `TaskScenario.rb` | `model/task.ts` / `model/task-scenario.ts` | OK | F5/F7 + 14-C Onda A (finishScheduling fiel) |
| `TaskDependency.rb` | `scheduling/task-dependency.ts` | OK | F7 (Xref/checkDependency corrigidos G1) |
| `TaskJuggler.rb` | `taskjuggler.ts` | PAR | F9; `parse/parseFile/parseContent/freeze` ancorados **F24** (re-ancorado 2026-11-03 — §8); `checkTimeSheet/checkStatusSheet` → F18 |
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
| Gantt: `GanttChart/Header/HeaderScaleItem/Line/LoadStack/Milestone/Router/TaskBar/CollisionDetector/HTMLGraphics/GanttContainer` | `gantt/**` (11 arquivos) + `tests/gantt/**` | OK | **Fase 15 concluída em 2026-11-03 (15.0–15.14)** — golden dos 12 charts + verificação final; §5.1 resolvido |

### 1.6 Sheets (time/status)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `TimeSheet.rb`/`TimeSheetRecord` (dentro `TimeSheets.rb`) | `scheduling/time-sheet.ts` | PAR | esqueleto p/ parser (10.14.1); conversão em bookings → **F18** |
| `TimeSheets.rb` (classe `TimeSheets`) | `scheduling/time-sheets.ts` | PAR | stub F9 (`push/check/warnOnDelta`); **F18** |
| `SheetHandlerBase/SheetSender/SheetReceiver.rb` | — | PLA | **F18** Bloco B (18.6–18.9) |
| `TimeSheetSender/Receiver/Summary`, `StatusSheetSender/Receiver` | — | PLA | **F18** (18.10–18.11 + núcleo de apps **18.18**); transporte email→**texto do email/texto da mensagem** (ADR **036**) |

### 1.7 Ferramentas de documentos e sintaxe (tj3man)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `SyntaxReference.rb` | — | PLA | **✅ dono definido 2026-11-03 (§8): F22 `doc-core` (22.1b)** — o pointer "pré-requisito da Fase 14" era falso e foi corrigido em 16.14 |
| `KeywordDocumentation.rb` | — | PLA | idem — **F22 22.1b** (consumida pela CLI `wz man` da F24) |
| `TjpExample.rb` | — | PLA | **F22 22.1b** (§8) |
| `UserManual.rb` | — | PLA | **F22 22.1b** (§8); saída HTML via `wz man --format html` na F24 |
| `TernarySearchTree.rb` | — | PLA | **MOVIDO 16.9 → F22 22.1b** (o core de busca vive no `doc-core`; F24 consome) |
| `KateSyntax.rb` / `VimSyntax.rb` | — | PLA | **MOVIDOS 16.14/16.15 → F22 22.1b**: núcleo de highlight (`docgen/`) no core; os geradores de arquivo (`.xml` do Kate, `.vim` do Vim) ficam como saída opcional da F24 |
| `AlgorithmDiff.rb` | — | **CANCELADO** | DEAD no upstream — **port cancelado e registrado na tarefa 16.10** (§8); nada a portar |
| `FileList.rb` | — | PLA | núcleo **16.7** (F16); consumidores declarados: **F24** (rastreio de inputs) e F19 |
| `StdIoWrapper.rb` | — | PLA | núcleo **16.11** (F16); consumidores: **F18** (`TimeSheetSummary`) e **F24** |
| `UTF8String.rb` | — | PLA | núcleo **16.12** (F16, em grande parte no-op em TS); consumidor: **F24** |

### 1.8 Apps e daemon (`apps/`, `daemon/`, `lib/tj3*.rb`)

| Ruby | SyntaxMesh | Status | Observação |
|---|---|---|---|
| `apps/Tj3.rb` + `Tj3AppBase.rb` + `lib/tj3.rb` | planejado **F24** (CLI `packages/cli`, mapa de opções §5.2 do plano) | PLA | ADR 034 reservada |
| `apps/Tj3Man.rb` + `lib/tj3man.rb` | **F22 `doc-core` (22.1b)** + comando `wz man` na **F24 (24.9)** | PLA | §3.2 resolvido (§8) |
| `apps/Tj3Client.rb` + `lib/tj3client.rb` | equivalente funcional na **F22** (comandos de gerenciamento do servidor da extensão, §3.2 do plano da fase) | NA | "algo parecido com tj3client/tj3daemon/tj3webd" — decisão 2026-11-03 (§8) |
| `apps/Tj3Daemon.rb`, `apps/Tj3WebD.rb`, `daemon/*` (9 arquivos), `lib/tj3d.rb`, `lib/tj3webd.rb` | equivalente funcional na **F22** (lsp-core + cache de projeto residente + camada de relatórios §3.3) | NA | §3.1 resolvido (§8); sockets/SMTP/processos fora de escopo |
| `apps/Tj3SsSender/Receiver`, `Tj3TsSender/Receiver/Summary`, `Tj3SheetAppBase.rb`, `lib/tj3ss_*.rb`/`tj3ts_*.rb` | núcleo no core **F18 (18.18)**; subcomandos `wz ts/ss …` na **F24 (24.10)** | PLA | §3.3 resolvido (§8); ADR **036** |

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
| `AlgorithmDiff` (arquivo inteiro) | sem uso — **port CANCELADO na tarefa 16.10 (2026-11-03, §8)**; registro de cancelamento na própria seção |
| `TaskScenario#period_to_s` | só interpolado em `Log.msg` internos; logs TS usam outra formatação — sem consequência funcional |

---

## 3. NPL Lacunas sem dono — não desenvolvidas **e não planejadas**

Estas são as respostas diretas ao objetivo do x-ray. Para cada uma, a
recomendação é: **descrever explicitamente no `plano.md` (rejeição de escopo
com justificativa) OU criar tarefa numa fase dona.** Hoje existem como "vazio
de plano".

| # | Item (fontes Ruby) | O que faz no TJ3 | Situação no plano | Recomendação |
|---|---|---|---|---|
| 3.1 | **Daemon/web server**: `apps/Tj3Daemon.rb`, `apps/Tj3WebD.rb`, `apps/Tj3Client.rb`, `daemon/{Daemon,DaemonConnector,ProcessIntercom,ProjectBroker,ProjectServer,ReportServer,ReportServlet,WebServer,WelcomePage}.rb`, `lib/tj3d.rb`, `lib/tj3webd.rb` | TCP-socket multi-processo: projeta `.tjp` residente, gera reports sob demanda via URL, cache entre requisições | **Nenhuma menção** em `plano.md`/fases (só F18/F16 citam "daemon fora de escopo" de passagem; F22 cita como *inspiração* do relatório-layer) | **✅ Resolvido (§8):** equivalente funcional fica na **Fase 22** (lsp-core + servidor da extensão + camada de relatórios §3.2/§3.3 de `fase-22-vscode-extension.md`) — "mesma entrega parecida, funcionalidade diferente"; transporte de socket/SMTP/processos fica **fora de escopo** |
| 3.2 | **Cadeia de documentação tj3man**: `apps/Tj3Man.rb`, `UserManual.rb`, `KeywordDocumentation.rb`, `SyntaxReference.rb`, `TjpExample.rb`, `lib/tj3man.rb` | Gera manuais HTML/RTF e **banco de referência de sintaxe/keywords** (usado por Kate/Vim e pelo help) | `SyntaxReference`/`KeywordDocumentation` aparecem só como *"Pré-requisitos: Fase 14"* da tarefa **16.14 (SyntaxCore)** — pointer falso; `TjpExample`/`UserManual`/`Tj3Man` sem referência | **✅ Resolvido (§8):** núcleo **inteiro** vai para a **Fase 22** como **`doc-core`** (subfase **22.1b**), junto de `TernarySearchTree` e do núcleo Kate/Vim (16.9/16.14/16.15 movidos); a **Fase 24** empacota como `wz man` (subfase 24.9) |
| 3.3 | **Apps CLI de sheets**: `apps/Tj3SsSender/Receiver.rb`, `Tj3TsSender/Receiver/Summary.rb`, `Tj3SheetAppBase.rb`, `lib/tj3ss_*.rb`, `lib/tj3ts_*.rb` | Front-ends de linha de comando que empacotam `SheetSender/Receiver` (transporte por email/SMTP) | Classes centres **são** planejadas (F18 blocos B–D); os **wrappers CLI** não — a F24 se limita ao `tj3` (plano §5, fonte `man/tj3.1` + `Tj3.rb`) | **✅ Resolvido (§8):** núcleo das classes de app no **core da Fase 18** (subfase **18.18**); equivalentes CLI na **Fase 24** (subfase **24.10**). Política: sender devolve o **texto do email** (sem SMTP), receiver consome **texto de mensagem** (ADR 036) |
| 3.4 | **Pipeline `dynamicAttributes`**: `Project.rb:778-812` (`generateReport(..., dynamicAttributes)`), `ProjectFileParser#parseReportAttributes`, regra `rule_dynamicAttributes` (`TjpSyntaxRules.rb:1034`) | Injeta atributos/colunas extras em um report na geração via string (usado pelo ReportServer/ReportServlet do daemon e pelo `SheetSender` para colunas de timesheet) | No TS o parâmetro existe mas os três passos estavam **comentados como `// stub`** (`project.ts:681-686`) **sem âncora** (política ADR 032 exige `// Ancorado: Fase N`). A regra de parser está registrada (`rules/common.ts:784`) mas sem consumidor | **✅ Resolvido (§8):** núcleo na **Fase 18** (subfase **18.19**) e uso na **Fase 24** (`--report … --attr`); âncoras `// Ancorado: Fase 18` já aplicadas no código em 2026-11-03. `backupAttributes`/`restoreAttributes` **já existem** em `property-tree-node.ts` — só ligar as chamadas |
| 3.5 | **`Painter/*` completo vs mínimo**: `Painter/{FontMetrics,FontMetricsData,Text,BasicShapes,Primitives,Group,SVGSupport,...}.rb` | Desenho vetorial com métricas de fonte reais (usada por ChartPlotter e Gantt-PNG do tj3) | **Está planejado** (F17 bloco de substituição + fontes listadas) — sem lacuna. `Painter/Element.rb` e `Color/Points` cobertos conceitualmente pelo `painter-min.ts` | Nada a decidir; registrar apenas que F17 substituirá `painter-min.ts`/`chart-plotter.ts` (SVG completo) |

### 3.4.1 Achado correlato (bônus da varredura)

`MessageHandler#checkLevel` (validação de nível 0–5 nos setters de
`outputLevel`/`logLevel`) não tem equivalente: o TS expõe campos públicos
sem validação (`message-handler.ts:9-10`). Micro-dívida.

**✅ Resolvido (2026-11-03, §8):** dono definido — **Fase 18, subfase 18.20**
(setters validando 0–5 com `TjArgumentError`), conforme pedido explícito do usuário.

---

## 4. PAR Gaps âncora-plano: portado como stub **com** fase dona (nada a decidir)

Registrados por completude — cada um já tem âncora verificada por
`scripts/check-stubs.ts` e/ou linha na `completude-matrix.md`:

| Stub TS | Âncora | Dona |
|---|---|---|
| `Resource#query_dashboard` | **`Ancorado: Fase 16`** (código atualizado 2026-11-03 — era Fase 15; §5.2) | **F16 (dono único — decisão do usuário)** |
| `query_annualleave*`/`sickleave`/`specialleave`/`timeoffdays`/`unpaidleave`, leave-allowance `to_tjp`, `hasalert`, `Journal#to_rti(mode)` | Fase 16 | F16 |
| `query_fte`, `checkTimeSheet/checkStatusSheet`, `istaskstatus`, report types `timesheetreport/statussheetreport` | Fase 18 | F18 |
| `TaskJuggler#parse/parseFile/parseContent/freeze` (transporte de arquivo) | **Fase 24** (re-ancorado 2026-11-03 — era Fase 19; o core não toca em disco). `parseFile` era **stub silencioso** `return null` sem âncora — virou âncora NYI (§5.4) | **F24** |
| Escrita a disco de reports (`Report.rb` file I/O) | ADR 027 (strings) + F24 (CLI escreve) | F24 |
| 13.14.3 (imagens: `objectURL`/materialização do arquivo) | **Fase 24 (24.10.8) + Fase 19 (24.16.2/OPFS)** — reancorado 2026-11-03 | F24 / F19 |
| 13.14.4 (`format richtext` no roteador de reports) | **Fase 14-C — núcleo já entregue (`14C.5.1–5.12`)**; regressão de CLI em 24.10.9 | F14-C |

---

## 5. Inconsistências de documentação detectadas na varredura

| # | Achado | Evidência | Resolução (2026-11-03) |
|---|---|---|---|
| 5.1 | **Fase 15 não é "Não iniciada" (PLA)** como afirmam `AGENTS.md` e `CURRENT.md` | `packages/core/src/gantt/**` (11 módulos fiel-portados) + `tests/gantt/**` (10 suites) + ADR 028 existente + `fase-15-gantt-tarefas.md`: **Status: Em andamento, 201/~210 (15.0–15.12)**; restam 15.13 (golden) e 15.14 (verificação final) | **✅ Resolvido:** a Fase 15 foi **concluída em 2026-11-03 (15.0–15.14)** — golden dos 12 charts + verificação final; `CURRENT.md` já a registra como ✅ Concluída. Resta alinhar a tabela de `AGENTS.md` (F15 ✅ e linhas das Fases 22–24) na próxima atualização daquele arquivo |
| 5.2 | **Dono duplicado de `query_dashboard`**: âncora no código diz Fase 15; tarefa 16.17 diz Fase 16 | `resource.ts:93-95` vs `fase-16-apoio-tarefas.md:595` | **✅ Resolvido — decisão do usuário: dono único é a Fase 16.** Âncora em `resource.ts` movida 15→16; 16.17 declara a posse; F15 não é mais citada |
| 5.3 | **ADR 029 referenciada mas inexistente** (README lista "029 — Journal e AlertLevel"; a F18 cita "ADR 029" para a decisão email→download) | `ls decisoes/` não tem 029; `fase-18-time-status-sheets.md:62` | **✅ Resolvido — decisão do usuário: 029 fica com (a) Journal e AlertLevel (Fase 16); (b) sheets ganha outro número = ADR 036**, e a injeção de provedor de conteúdo = **037**. A varredura de renumeração de ADRs existentes foi **cancelada** na tarefa 18.0 do `-tarefas.md`; README de decisoes agora reserva 033–037 e anota que 029 só ganha arquivo em 16.0.1 |
| 5.4 | Comentário residual `// stub` no `DataCache.flush()` de `project.ts` — o flush **está implementado** (`data-cache.ts:55`) | visto na varredura | **✅ Resolvido:** `Project#generateReports` volta a chamar `DataCache.instance.flush()` fiel a `Project.rb:774` (import adicionado, comentário enganoso removido); suíte completa verde após a mudança. `parseFile` tratado no §4 |
| 5.5 | `completude-matrix.md` cobre F2–F12 apenas; gaps de F13–F14C estão espalhados em `CURRENT.md` | cabeçalho da matriz | **✅ Registrado:** **regenerar a matriz na Fase 21** (nota adicionada ao topo de `completude-matrix.md`; tarefa da F21). Não re-escrever a matriz à mão agora |
| 5.6 | **Drift de numeração nos `-tarefas.md`** de fases futuras: arquivos usam o esquema antigo (F19 → tarefas `24.x`, F21 → tarefas `26.x`; o plano da F16 tinha blocos rotulados `20.x`) | `fase-19-storage-tarefas.md`, `fase-21-compatibilidade-qualidade-tarefas.md`, `fase-16-apoio.md` | **Não renumerar agora** (quebraria referências cruzadas já feitas — ex.: `24.16.2` citado neste arquivo). A F16 foi corrigida em 2026-11-03 só onde foi reescrita; F19/F21 normalizar na sua abertura, com nota no preâmbulo de cada arquivo |
| 5.7 | **`AGENTS.md` desatualizado quanto ao pipeline e ao plano**: citava `deno task check-all` (não existe — a task é `check:all`), dizia que `npm run lint` roda `deno check` (roda só `deno lint`), parava a tabela de fases na 21 e listava ADRs só até 031 | saída de `deno task` + `package.json` (`"lint": "… deno task lint"`) | **✅ Corrigido em 2026-11-03:** §7/§8/§10/§12 do `AGENTS.md` alinhados (gate real = `deno task tests`, âncora `check:stubs`, tabela com as Fases 22–24, ADRs 001–032 + reservados 033–037) |

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

- **Superfície funcional do TJ3 processada (parser→scheduler→finance→reports→gantt): sem buracos.** A varredura método-a-método não encontrou nenhum comportamento do Ruby silenciosamente esquecido nas fases concluídas; os stubs remanescentes têm todos fase dona (§4), exceto um único caso sem âncora (§3.4 — âncoras aplicadas no código em 2026-11-03).
- **As 5 lacunas reais "não feitas e não planejadas" estão em §3** — e concentram-se na periferia do TJ3 que a arquitetura browser-PWA descarta por natureza (daemon/webd, tj3man, wrappers CLI de sheets) **mais** dois pontos operacionais: (1) a dependência órfã `SyntaxReference`/`KeywordDocumentation` da tarefa 16.14 (bloqueia a F16 como escrita) e (2) o pipeline `dynamicAttributes`, silenciosamente stubado, de que a F18 vai precisar. **Todas receberam dono em 2026-11-03 — ver §8.**
- Documentação de status: **Fase 15 estava 95% realizada mas registrada como não iniciada (PLA)** (§5.1) — foi **concluída em 2026-11-03 (15.0–15.14)**; o §8 aponta o que resta alinhar em `AGENTS.md`.

### Como reproduzir esta varredura

```sh
python3 .tmp/xray-diff.py    # tabela principal (Fases 2–15)
python3 .tmp/xray-diff2.py   # richtext/textparser/report-tables
```

---

## 8. Resolução — decisões do usuário (2026-11-03)
> Cada linha abaixo é o **destino** de um achado de §2–§5. Todas já estão
> propagadas nos docs de fase (`fase-16`, `fase-18`, `fase-22`, `fase-24`,
> `fase-13`, `fase-14-C`, `fase-19`, `plano.md`), em `CURRENT.md`, no README de
> ADRs e — onde havia código — no próprio fonte.

| Achado | Dono / decisão | Onde ficou registrado |
|---|---|---|
| §3.2 tj3man + cadeia de documentação | **Fase 22 — `doc-core`** (subfase **22.1b**): `SyntaxReference`, `KeywordDocumentation`, `TjpExample`, `UserManual`, `TernarySearchTree` e o **núcleo de highlight Kate/Vim** (`docgen/`). A CLI da **Fase 24** consome esse core como `wz man` (24.9) — o equivalente do `tj3man` | `fase-22-vscode-extension.md` §2/22.1b; `fase-24-cli.md` §2/§5.4 + 24.9; `fase-16-apoio.md` (16.9/16.14/16.15 MOVIDOS) |
| §3.1 daemon/webd/client | **Fase 22** entrega "algo parecido com tj3client/tj3daemon/tj3webd" (lsp-core + servidor da extensão + camada de relatórios) — mesma entrega, outra funcionalidade; sockets/SMTP/processos ficam fora | `fase-22-vscode-extension.md` §3.2/§3.3 |
| §3.3 apps de sheets | Núcleo no **core da Fase 18 (18.18)**: `Tj3SheetAppBase` + sender/receiver/summary de TS e SS como classes puras. Empacotamento CLI na **Fase 24 (24.10)**. **Sem SMTP**: sender devolve o **texto do email**; receiver consome **texto de mensagem** (arquivo/stdin) — **ADR 036** | `fase-18-time-status-sheets.md` §18.18 + `-tarefas.md` Bloco H; `fase-24-cli.md` §5.4; `decisoes/README.md` |
| §3.4 `dynamicAttributes` + `parseReportAttributes` | Núcleo na **Fase 18 (18.19)**; uso na **Fase 24** (`--report … --attr`, 24.10.5). `backupAttributes`/`restoreAttributes` já existem em `property-tree-node.ts` — tarefa é ligar as chamadas | `fase-18-…​.md` §18.19 + `-tarefas.md`; âncoras `// Ancorado: Fase 18` em `model/project.ts` |
| §3.4.1 `MessageHandler#checkLevel` | **Fase 18 (18.20)** — setters de `outputLevel`/`logLevel` validam 0–5 com `TjArgumentError` | `fase-18-…​.md` §18.20 + `-tarefas.md` |
| §2.2 `AlgorithmDiff` (DEAD) | **Port CANCELADO** — registrado como cancelamento na própria tarefa **16.10** (Ação/Consequência/Reabertura); riscado dos riscos e do checklist da F16 | `fase-16-apoio.md` §16.10 + §8/§9/§10 |
| §4 `query_dashboard` | **Fase 16 = dono único** (código re-ancorado 15→16) | `model/resource.ts`; `fase-16-apoio.md` 16.17 |
| §4 `parse/parseFile/parseContent/freeze` | **Fase 24** (re-ancorado 19→24; `parseFile` deixou de ser stub silencioso) | `taskjuggler.ts`; `fase-24-cli.md` §5.4/24.9 |
| §4 13.14.3 / 13.14.4 | **13.14.3 → Fase 24 (24.10.8) + Fase 19 (OPFS/blob na PWA)**; **13.14.4 → Fase 14-C** (núcleo já entregue por C5; regressão de CLI em 24.10.9) | `fase-13-markdown-tarefas.md` 13.14; `fase-14-relatorios-complemento-tarefas.md` 14C.5; `fase-19-storage-tarefas.md` 24.16.2; `fase-24-cli-tarefas.md` |
| §5.3 ADRs | **029 = (a) Journal/AlertLevel** (Fase 16, arquivo criado em 16.0.1); **(b) sheets = ADR 036**; injeção de provedor de conteúdo = **ADR 037**; proibida a renumeração de ADRs já commitados | `decisoes/README.md`; `fase-16-apoio-tarefas.md`; `fase-18-…​.md`/`-tarefas.md` |
| §5.4 flush do `DataCache` | Chamada restaurada em `Project#generateReports` (fiel a `Project.rb:774`); comentário `// stub` removido | `model/project.ts` |
| §5.5 matriz de completude | **Regenerar na Fase 21** | `completude-matrix.md` (nota no topo); `plano.md` |

**Verificação desta resolução:** `deno task check:stubs` OK · `deno task check:all`
e `deno task lint` verdes (585 arquivos) · `deno fmt --check` limpo (625 arquivos) ·
suíte completa **513 testes / 5305 passos / 0 falhas**.
