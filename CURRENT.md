# Arquivo `CURRENT.md`

Leia os arquivos:

- docs/syntaxmesh/fases/plano.md (plano canônico de 21 fases — fonte da verdade de escopo e andamento)
- docs/syntaxmesh/fases/README.md (convenções de arquivos, protocolo TDD, mapa de fases)
- docs/syntaxmesh/09-regras-para-ia.md (regras de ouro)

Tenha conhecimento da lista de ADR em : docs/syntaxmesh/decisoes/README.md
Reuna dicas e analise-as do arquivo: docs/syntaxmesh/cheat-sheet-ruby-ts.md

Desenvolvimento atual (docs/syntaxmesh/fases/):

- **Fase 10 Complemento** — `fase-10-complemento1.md` + `fase-10-complemento2.md` (especificações) → executar `fase-10-complemento-tarefas.md` (Blocos C0–C4, toca Fases 5/7/8.1/10) e os adendos "Adendo Fase 10 Complemento" nos `-tarefas.md` das Fases 13/14/16/18/19/20/21.
- Fase 11 (`fase-11-logica-queries-tarefas.md`), Fase 12 (`fase-12-richtext-tarefas.md`), Fase 13 (`fase-13-markdown-tarefas.md`), Fase 14 (`fase-14-relatorios-tarefas.md`, núcleo 14.0–14.24) e **Fase 14 Complemento** (`fase-14-relatorios-complemento.md` + `-tarefas.md`, Blocos C0–C12: materiais/RDO/breakdown nos relatórios, MspXml→MSPDI, markdown em reports, hide/rollup de material/picture, saída markdown `.md`, `defaultaccount`, `<Baseline>` do MSPDI, unit price por alocação/booking e auditoria G1.4 — absorve os adendos 14.25/14.26) — **todas concluídas**; **C0–C12 ✅** na Fase 14 Complemento (2026-11-01).

IMPORTANTE

- os arquivos TaskJuggler Ruby fonte estão em docs/taskjuggler/lib/taskjuggler
- para testes veja a decisão de qual biblioteca e estilo de teste fazer no arquivo: docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md
- arquivos de documentação na raiz da pasta docs/syntaxmesh, podem estar desatualizados, e podem ser atualizados para manter coerencia com o plano em docs/syntaxmesh/fases
- arquivos da pasta docs/tj3-engine foram usados para elaborar o plano em docs/syntaxmesh/fases mas podem estar desatualizados também por conta da evolução do projeto e podem ser atualizados se precisar tambem

## Resumo do estado atual (2026-10-26)

**Arquitetura de pacotes (ADR 030 — aceita):** todo código principal vive em
`packages/core`. Não criar pacotes `parser`, `language`, `richtext`, `markdown`,
`report`, `storage`. Pacotes de apoio: apenas `server`, `service-worker`, `ui`.
Parser/lexer da Fase 10 em `packages/core/src/parser/` e `packages/core/src/lexer/`;
i18n (10.15+) em `packages/core/src/i18n/`.

**Fases concluídas:**

- Fase 1 — Fundação e Workspace Deno ✅ (63/63 tarefas)
- Fase 2 — Tempo e Geometria ✅ (142 + 52 tarefas complementares)
- Fase 3 — Modelo de Atributos ✅ (140 tarefas atômicas)
- Fase 4 — Árvore de Propriedades ✅ (118 tarefas atômicas)
- Fase 5 — Entidades Concretas ✅ (108 tarefas atômicas)
- Fase 6 — Scoreboard e Estruturas Base ✅ (145 testes)
- Fase 7 — Scheduler Core ✅ (215 tarefas; arquivo de tarefas concluído).
  **Placement de agenda consertado (2026-10-28):** quatro bugs de port faziam
  o scheduler nunca colocar datas/reservas em nenhum modelo. Corrigidos
  fielmente (ver §"Gap conhecido" abaixo) e validados contra o `tj3` real no
  mwe001 (t1→2024-06-03, t2→06-05, t3→06-10). Suíte: **307 / 3273 / 0**.
- Fase 8 — Sistema Financeiro ✅ (125 tarefas)
- Fase 8.1 — Nova funcionalidade de custos ✅ (163 testes core, 37 tarefas atômicas)
- Fase 8.2 — Modelo Contábil Estendido ✅ (130 tarefas)
- Fase 9 — Orquestrador e Cache ✅ (~195 tarefas)
- Fase 10 — Parser e Linguagem ✅ (10.0–10.20 concluídas em 2026-10-26): `TextParser` FSM,
  `Scanner`/`ProjectFileScanner`, `ProjectFileParser`, `TjpSyntaxRules` com as
  348 regras do Ruby portadas (380 registradas, 0 placeholders), i18n
  (`LanguageRegistry` + en/pt-BR/es + diretiva `language`), AST equivalence
  9 MWEs × 3 idiomas, golden parser com 178 casos (5 skipped — dependem de
  RichText, Fase 12). Suíte core: **225 testes / 2828 passos, 0 falhas**;
  `deno task check:all` e `deno fmt --check` verdes. Verificação final em
  `fase-10-parser-linguagem-tarefas.md` (10.20) e smoke test
  `tests/integration/smoke_after_phase_10_test.ts`.

## Fases ativas/próximas

- **Fase 10 Complemento — Extensões RDO/orçamento ✅ Concluída (2026-10-27):** Blocos C0–C4 de `fase-10-complemento-tarefas.md` implementados e testadas (material no parser + modelo registrado, `note`/`journal` estendidos a resource/account/material, `picture`/`format`, `timebasis` #6/#6a com `distribution.ts`, `breakdownreport`/`rdoreport`, colunas novas + `hidejournalentry`, i18n en/pt-BR/es com AST equivalente, golden parser idêntico + fixtures de extensão). Adendos de fases futuras (13/14/16/18/19/20/21) permanecem pendentes nessas fases. Suíte core: **279 testes / 2994 passos, 0 falhas**.
- **Fase 11 — Expressões Lógicas e Queries ✅ Concluída (2026-10-27):** Motor lógico em `packages/core/src/logic/` (`LogicalOperation`/`LogicalAttribute`/`LogicalFlag`/`LogicalFunction` com 14 funções/`LogicalExpression` + type-guards), `Query` completa em `src/query/` (estrutura, `process` pipeline a–j, accessors, scale, `assignList`, `resolvePropertyId`, `setCustomData`) e `SimpleQueryExpander`. Shim `src/logical/` reconectado ao parser (Fase 10). ADR 024 (expressões sem precedência, `&`/`|` lazy, coerção pelo `operand1`). Golden de **expressões lógicas** do Ruby (25 casos) + smoke `tests/integration/smoke_after_phase_11_test.ts`. **Bloqueado por pré-requisito de modelo:** métodos concretos `query_*` (effort/duration/complete/cost/…) ainda não existem no modelo (só `query_balance`/`query_turnover`), então 11.12 (integração) e 11.13 (golden de queries) foram validados só por duck-typing e ficam a cargo das Fases de scheduling/finance. `hasalert` e `LogicalFlag`-Journal permanecem stubs sancionados (Fase 16). Suíte core: **295 testes / 3155 passos, 0 falhas** (via `deno task test`, que roda com `--no-check`); `deno check` nos arquivos da Fase 11 + `mod.ts`, `deno lint` e `deno fmt --check` verdes. Obs.: os **24 erros pré-existentes** de `deno task check:all` em `tests/accounting/extended-charge-timebasis_test.ts` e `tests/golden/timebasis-parity_golden_test.ts` foram **corrigidos (2026-10-27)** — os testes escreviam campos internos inexistentes de `TaskScenario` (`scheduledStart`/`actualEnd`/`duration`/`durationType`) e usavam assinaturas antigas de `Project`/`Account`/`Material`; como `Charge`/`ExtendedCharge`/`MaterialAllocation` leem apenas os atributos de cenário `start`/`end`, os writes internos foram removidos e os construtores alinhados à API real (`createTestProject()`). `deno task check:all` agora verde.
- **Fase 12 — RichText (compatibilidade TJP) ✅ Concluída (2026-10-29, 12.0–12.20):** subsistema RichText portado fielmente (ADR 025 — ⚠️ o plano pedia "ADR 024", já alocado às expressões lógicas da Fase 11; README já reservava 025). Em `packages/core/src/richtext/`: `XMLElementLike`+`SimpleXMLElement` (`xml-like.ts`), `RichTextElement`/`RichTextIntermediate` (`to_s`/`to_tagged`/`to_html` conferidos contra harness Ruby real), `RichTextScanner`+`RichTextParser`+`RichTextSyntaxRules` (FSM herdado de `Scanner`/`TextParser` da Fase 10, 7 modos/~40 patterns), `TOCEntry`/`TableOfContents`, `RichTextSnip`+`RichTextDocument` (geram HTML via seam `html-shell.ts` — sem `HTMLDocument`/`XMLElement` da Fase 17, sem escrita a disco), `RichTextFunctionHandler`/`RichTextFunctionExample`/`RTFWithQuerySupport`/`RTFQuery` (handler `[[query:…]]` real sobre a Query da Fase 11) e `RTFReport`/`RTFReportLink`/`RTFNavigator` (stubs NYI ancorados Fase 14). **12.18**: `RichText`+`RichTextFactoryImpl` injetados no `ProjectFileParser` via `setRichTextFactory` — stub `newRichText` da Fase 10 substituído pela fábrica real. **Pull-in**: `TextFormatter` (tarefa 16.6) em `src/utils/text-formatter.ts`. **12.19 golden**: `scripts/golden/richtext.rb` (oracle Ruby: `RichText.rb` real, `trapSetup`, reset de `@@parser` por caso) → `packages/core/tests/richtext/golden/richtext.golden.json` (32 casos `plain`/`tagged`/`html`, idempotente; 2 casos em que o próprio Ruby lança erro ficam de fora → Fase 21). Bug de href corrigido em `rich-text-element.ts` (`hrefUrl()` — `data` é subárvore richtext, não string). **12.20**: `deno task check:all` exit 0 · suíte core **335/3586/0** · NYI richtext = 3 (relatórios → Fase 14) · smoke `tests/integration/smoke_after_phase_12_test.ts`. RichText: 204 testes / 280 passos unit + 32 golden + 3 smoke. **G5 (`to_rti`/`to_tjp` por atributo) re-ancorado Fase 14** — dependem de `query.listItem`/`ReportContext` (reports), fora dos 215 critérios de 12; ver `completude-matrix.md`.
- **Fase 11 (Gaps) — Fechamento e Auditoria ✅ Concluída (2026-10-28):**
  `fase-11-logical-gaps.md` + `fase-11-logical-gaps-tarefas.md`. Fase de
  auditoria sem features novas; fecha G1–G4, ancora G6–G12, varre G21 e
  libera o gate da Fase 13.
  - **G1 (placement)** — destravado além dos 4 bugs anteriores: mais três
    fixes encadeados (a) `TaskScenario#preScheduleCheck` iterando chargeset
    com `for…of` em vez de `ChargeSet#each(cb)`; (b) guard **invertido**
    em `markAsMilestone` (`!booking.length` quando Ruby faz `!booking.empty?`)
    — milestones `AcSo.deliveries.start`/`.beta` só aparecem agora;
    (c) `project.ts vacation` gravava tuplas cruas `[type, name, start, end]`
    em vez de `Leave` objects com `.interval.start/.end` —
    `Project#initScoreboards` estourava em mwe005.
  - **G2 (sentinela)** — `tests/integration/logical-scheduler-driven_test.ts`
    reabilitado com 3 asserts fortes (start/end/effort != null, bookings > 0,
    `isallocated`/`startsafter` contra agenda real).
  - **G3/G4 (e2e + golden)** — `tests/integration/parser-scheduler_e2e_test.ts`
    com 22 passos: 9 MWEs en agendam sem exceção, mwe004 com 8 datas
    hard-coded iguais ao `tj3`, mwe001 em pt-BR/es equivalem ao en, milestones
    mwe003/mwe007 verificados. Golden .rb completo adiado para Fase 21.
  - **G14/G16/G17/G18/G19/G20** — `tests/integration/gaps_verification_test.ts`
    prova com testes cada verificação da auditoria.
  - **G5–G12 ancorados** — 14 stubs com `// Ancorado: Fase N — <razão>`;
    `scripts/check-stubs.ts` garante a política.
  - **Invariantes + fuzz** — `tests/invariants/scheduler_invariants_test.ts`
    (7 invariantes sobre modelo rico) +
    `tests/fuzz/scheduler_fuzz_test.ts` (20 projetos Mulberry32 seed=42,
    todos verdes).
  - **Infraestrutura** — `debug/schedule_probe.ts` (ferramenta de diagnóstico
    commitada), `scripts/check-stubs.ts`, `scripts/gaps/audit.ts`,
    `scripts/gaps/deferred.ts`, `docs/syntaxmesh/fases/completude-matrix.md`.
  - **Gate** — `deno task gate:phase-13` composto de
    `check:all && test:integration && test:invariants && test:fuzz &&
    test:golden:scheduler && check:stubs && gaps:audit && test:deferred`.
    `gate:phase-13:partial` = `check:stubs + gaps:audit + test:deferred`
    disponível durante a Fase 12.
  - **ADR 032** — Gate de saída para Fase 13 e política de stubs (Aceito,
    2026-10-28). G5 (to_rti × 5) fica ancorado em Fase 12 — 12.18 entrega;
    G21 (sweep dos deferidos) fecha vazio: nenhum teste com
    `// Gate: fase-11-logical-gaps` sobrou.
  - **Suite core: 319 passed / 3333 steps / 0 failed** (invariante desde a
    2ª leva da Fase 12).
- **Fase 11 Complemento — Funções/atributos/flags lógicas ✅ Concluída (2026-10-27):** `fase-11-logical-complemento.md`. Conciliação: `LogicalFunction.rb` tem exatamente as 14 funções já portadas (fiel, ADR 011); as demais da documentação são **extensões** (0 ocorrências no TJ vendorizado). 1ª onda: LC-A/LC-B/LC-D + LF.1 (isParentOf/isAn*/isAccount/isMaterial/isTaskOfProject + flags declarados + stubs). **2ª onda (§6.9): G1–G5 executadas** — `TaskScenario.getAllocatedTime` portado fiel (Ruby 1562–1588; cache omitido c/ ResourceScenario), `isactive` tipado, args-data validados (`TjTime.fromString` não lança p/ lixo → validação NaN explícita), 10 funções implementadas (startsafter/startsbefore/endsafter/endsbefore, isallocated(ToProject), hasassignment, isusedat/isused/isusedatproject via `materialallocations`+`quantityIn`+`CostEvent`), FUNCTIONS_EXT 10× blocked→feasible, **LF.5a**: parser de material agora aceita `flags` (antes `unexpctd_token`), LF.4/LF.6 testados; LA.1–LA.5 auditados (nada faltando). Restam só bloqueios reais com âncora: isoncriticalpath (sem slack/float nem no Ruby) → Fase 14/15, istaskstatus → Fase 18, ramo-Journal/hasalert → Fase 16, golden/i18n round-trip → Fase 21, aplicação hidematerial/rollup → 14.26. **Pós-onda (§6.10): G1.4 fechado com âncora** — `tests/integration/logical-scheduler-driven_test.ts` fixa por regression que o scheduler atual não coloca agenda nem bookings (gap núcleo da Fase 7; metade pós-Fase-7 comentada no arquivo) — e **review (a)–(g) aplicado**: limiar meia-slot (`hasAllocatedTime`), agenda parcial não superavalia `hasassignment`/`materialUsedIn`, id inválido agora lança (`targetForId`), `Project#dateToIdx` corrigido fiel ao Ruby (`forceIntoProject` clampava nada → índices negativos vazavam; beneficia todo scheduler/queries), recursão de container filtra `instanceof Task`, regressões dateArg/`unit` quoted travadas. Suíte core: **302 testes / 3242 passos, 0 falhas**; `deno task check:all` exit 0. **§6.11 (auditoria final de gaps Fases 2–11, 2026-10-27)**: varredura de `NotYetImplementedError`/`TODO` no `src`, cada candidato contra o Ruby. **Desenvolvido agora** — (1) `ScenarioData#error/warning/info` agora roteia ao `MessageHandlerInstance` (raiz do G1.4 / sobra da Fase 9); (2) `TaskJuggler#errors` reflete o handler (era `0` hardcoded); (3) `AllocationAttribute#to_s` fiel ao Ruby; (4) `LogicalExpression`/`…List` `to_tjp` fiel (herdado de `AttributeBase`). **Não-gaps (fiéis ao Ruby, comentados)**: `ColumnList#to_s`="TODO", `Allocation#to_tjp` (incompleto no upstream), `Date#to_s` (formato via pipeline de Query), `project.defaultAccount`=`null` (extensão SyntaxMesh). **Ancorados nas fases donas (dependem de 12–21)**: `to_rti`→F12; `isoncriticalpath`/`freeze`→F14; `defaultAccount`→F8.2; `parse/parseFile/parseContent`→F19; `checkTimeSheet`/`checkStatusSheet`/`istaskstatus`→F18; `hasalert`/`Journal`/leave-allowance→F16 (estes já ancorados, verificados). Suíte: **303 testes / 3248 passos, 0 falhas**.
- **Fase 13 — Markdown (going-forward) ✅ Concluída (2026-10-29, 13.0–13.13; 13.14 parcial):** subsistema Markdown aditivo (ADR 026 — ⚠️ o plano pedia "ADR 024/025", já alocados; Markdown = 026). Markdown vira formato nativo; RichText (Fase 12) permanece para `.tjp` (ADR 009). **Unificação de AST:** `MarkdownFactory implements RichTextFactory` produz o mesmo `RichTextIntermediate` da Fase 12. Em `packages/core/src/markdown/`: base sobre `micromark`+`mdast-util-from-markdown`+GFM (não `@deno/gfm`) → `parse-mdast.ts`; pipeline de extensões `extensions/` com placeholders (`§COLOR_n§`/`§FUNC_n§`/`§MINIQ_n§`) e ordem color→functions→mini-query (`pipeline.ts`), sanitizador HTML OWASP allow/block-list (`html-sanitizer.ts`, 2 bugs de regex/text-emission corrigidos), cores (`color.ts`), funções `[[func:…]]` (`functions.ts`), mini-queries `<-attr->` (`mini-query.ts`); `mdast-to-richtext.ts` (AST→`RichTextElement[]`, headings/lists/link/img/html/inline + extension nodes); `convert-rich-to-md.ts` (`richTextToMarkdown`, one-way). `to_markdown()`/`children_markdown()`/`formatFuncArgs()` adicionados a `RichTextElement`+`RichTextIntermediate` (one-way; `appendSpace` respeitado no round-trip). Barrel `mod.ts`. **Adendo 13.14 (imagens, parcial):** `extensions/images.ts` com `isExternalImageRef`+`resolveImageRef` (URL externa intacta; relativo → OPFS via `ImageStore` injetável [contrato Fase 19] com fallback `dataDirs`); core DOM-free devolve descritor (ADR 001). 13.14.3 (`objectURL`) e 13.14.4 (`render.ts` roteamento `format richtext`) adiados — dependem de Fases 19/14/10-Complemento. **Verificação:** `deno task check:all` exit 0 · `deno lint`/`deno fmt --check` verdes · suíte core **352 testes / 3999 passos / 0 falhas** (`deno task test`). Markdown: ~274 passos unit (extensions/parse/factory/mdast/to-markdown/convert/integration) + **24 snapshots** (`golden/markdown-snapshots.json` gerado por `generate_snapshots.ts`; `to_tagged`/`to_markdown` sempre, `to_s`/`to_html` onde há `Query`) + smoke `tests/integration/smoke_after_phase_13_test.ts`. Docs corrigidos: referências "ADR 025"→"026" em `fase-13-markdown.md`/`-tarefas.md`; ADR 026 registrado no README de decisoes.
- **Fase 14 — Relatórios ✅ Concluída (2026-10-31, 14.0–14.24):** pipeline completo de relatórios portado (ADR **027** — o plano pedia "ADR 026", já alocado ao Markdown; reports retornam **strings**, sem disco/DOM — `decisoes/027-reports-browser.md`). Em `packages/core/src/reports/` + arquivos de modelo: `CSVFile`, `ReportContext`, `ReportBase`, `TableColumnDefinition`/`CellSettingPattern`, `TableColumnSorter`, `ReportTable`/`ReportTableColumn`/`ReportTableLine`/`ReportTableCell`+`PlaceHolderCell`/`ReportTableLegend`, `Report` (ciclo `generate` → string), `TableReport`, `ColumnTable` (calendários), conteúdos `TaskListRE`/`ResourceListRE`/`AccountListRE`/`TextReport`/`ExportRE`+`TjpExportRE`+`MspXmlRE` (XML em seam própria `src/xml/`), `ICalReport`+`ICalendar` (mínimo), `NikuReport`/`TraceReport`+`TagFile`, `Navigator`+`NavigatorElement`, `ChartPlotter`+`PainterMin` (mínimos, SVG-string). **RTF completo (14.24.6):** `RTFReport`/`RTFReportLink`/`RTFNavigator` entregues — stubs NYI da Fase 12 desancorados; `URLParameter.encode` (zlib stored síncrono) com round-trip validado contra o `Zlib` do Ruby. **Golden (14.23):** `reports.golden.json` — 61 relatórios em 49 `.tjp` (≥60 ✓), gerado por `scripts/golden/reports-mwe001..009.rb` + `reports-syntax-correct.rb` (oracle tj3 real, `golden:generate` reproduzível byte-a-byte); comparação por **digest estrutural do formato intermediário** (colunas/linhas/kinds de célula — walkers espelhados Ruby↔`tests/golden/extract-table.ts`), não por HTML valor-a-valor: paridade de valores depende de integrações pendentes (`query_*` concretos — Fase 11; `chart` = GanttChart — Fases 15/16; geometria de calendário). Divergências **rastreadas, não xfails**: `PENDING_DIVERGENCES` + `PENDING_SCHEDULER_FILES` (`CSV-Reports/alert.tjp` — `toSeconds` null em `TaskScenario.propagateDateToDep`, gap de scheduler; **fechado em 2026-11-01 pela 14C.12.3**, a lista ficou vazia) + pendências sancionadas por classe de erro; `check:stubs` OK (zero NYI des-ancorado; NYI restantes pertencem a Fases 16/18/19). Testes de engine adicionados: `Task.hasResourceAllocated`, `Resource.allocated`, `Resource.getBookings`, `Task.assignedResources`. **Adendos 14.25/14.26 transferidos p/ a Fase 14 Complemento** (BreakdownReport/RdoReport + hide/rollup — ver bloco abaixo). Verificação: `deno task check:all` exit 0 · suíte core **395 testes / 4638 passos / 0 falhas** · smoke `tests/integration/smoke_after_phase_14_test.ts` (inclui e2e `Project.generateReports` e verificação Fase 13).
- **Fase 14 Complemento — Materiais/RDO/MspXml/Markdown nos relatórios ✅ Concluída (C0–C12, 2026-11-01):** `fase-14-relatorios-complemento.md` + `fase-14-relatorios-complemento-tarefas.md` (Blocos C0–C12, 145 tarefas). **C0** fundação (`format json` de 1ª classe, índices `entriesBy*` do Journal, alert-levels mínimo, `Picture`→HTML, dispatch das extensões) · **C1** materiais + `materialreport` · **C2** `BreakdownReport` (groupby account/task, html/csv/json) · **C3** `RdoReport` (`groupby date|task|resource|material|account`, `journalmode`/`journalattributes`, galeria `picture` + imagens do `details` com `maxpictures`, `setImageResolver` para `ImageStore`, html/json) + `picturesFromDetails`. **C4** MspXml→MSPDI: oracle Ruby real (`scripts/golden/mspdi-tj3.rb` → `mspdi.golden.json`, paridade campo a campo no subconjunto que o tj3 exporta) + extensões SyntaxMesh sem oracle — recursos material (`<Type>`0) e custo (`<Type>`2), `<Assignment>` de material/custo com série `TimephasedData` `Type`6, `<DurationFormat>` 7/8 (`ed` nunca 9), `<ActualWork>`/`<RemainingWork>`/`<ActualCost>`/`<RemainingCost>`, `<Notes>`, `<Exceptions>` de calendário (leaves de recurso) e `<LinkLag>`/`<LagFormat>`; **correção do `docs/tj3-engine/mspdi.md` §3.1** (ordem oficial: 0 material / 1 trabalho / 2 custo); limitações registradas (sem `<Baseline>`/`<ExtendedAttribute>`; `Project` sem store `leaves`; `hideMaterial` inerte até C6); armadilha de unidade documentada (`effort`/`effortdone`/`gapLength` são **slots**) e snapshot em `reports-extensions.golden.json` → `mspdi`. **C5** markdown nos relatórios: atributo `format` (`richtext` default, `inheritedFromParent`) em `report-attributes.ts` + roteamento `MarkdownFactory` no parser (`newRichText(..., format)`), com `Report.richTextSources`/`applyReportFormat()` para independência de ordem (via `force()`); `TableReport`/`TextReport` sem mudança de API (as duas fábricas produzem o mesmo `RichTextIntermediate`) — só reinterpretação do que nasce MediaWiki (`ReportBase#rtiForReport`/`#cellTextForReport` para `note` e `celltext`); handlers `[[query:]]`/`[[report:]]`/`[[reportlink:]]`/`[[navigator:]]` e o açúcar `<-attr->` verificados dentro de markdown; galeria do RDO é agnóstica de dialeto (`![alt](path)` e `[[Image:…]]`); sanitização é por nó mdast (tag bloqueada e `onerror` fora, corpo de `<script>` fica como texto inerte); **adendo na ADR 027** (§14C.5.12) fixando default-richtext/opt-in-markdown e os limites (`name`/`projectid`/`version` não são consultáveis por query). **C6** `hidematerial`/`rollupmaterial`/`hidepicture`: três atributos de relatório (`LogicalExpression`, `inheritedFromParent`) + regras no corpo compartilhado `reportAttributes` (materialreport/task/resource/account/export/ical/niku/tagfile) + i18n en/pt-BR/es (negação lógica do TJP é `~`, não `!`); `Query`/`ReportContext` ganham os três campos e `ReportBase#hiddenBy()` (promovido do RDO) avalia a expressão contra a propriedade, com `filterMaterialList()` para as listas (materiais não têm `materialroot`). Aplicação: materialreport (lista hierárquica), RDO `groupby material`, colunas `materials`/`materialcost` do taskreport, breakdown (contribuintes de conta/tarefa + `replaceContributorCost`), export TJP (declarações, sub-materiais e alocações) e MSPDI (o wiring de 14C.4.10 deixa de ser inerte). `hidepicture` é avaliado no **dono** da entrada de journal, então imagem filtrada não consome `maxpictures`. `rollupmaterial` consolida: descendentes fora das listas hierárquicas e contribuinte sem linha própria no breakdown (valor preservado em `totals`; `rolledUp` só entra no JSON quando verdadeiro, preservando o shape de quem não usa a diretiva). Auditoria (14C.6.1) prova por teste que `hidetask`/`hideresource`/`hideaccount`/`rollup*` são **avaliados** (não só parseados) e que `hidejournalentry` fica ancorado na Fase 16 (avaliação por entrada). Divergência registrada: `Material#name` espelha o id (14C.1.14), então TJP/MSPDI mostram `aco` em vez do texto do cabeçalho. **C7** verificação final: `check:all` exit 0 · `check:stubs` OK · `deno fmt --check` limpo (571 arquivos) · `deno lint` restrito aos arquivos do complemento limpo (36 arquivos; os 116 problemas do repo são pré-existentes) · `golden:generate:extensions` idempotente 2× (mesmo md5) com `reports.golden.json`/`parser.golden.json`/`mspdi.golden.json` byte-idênticos ao HEAD · smoke `tests/integration/smoke_after_phase_14c_test.ts` + fixture `fixtures/ext/14c-smoke.tjp` (materialreport/breakdown/RDO/MSPDI como strings com `outputDir` em tmpdir vazio) · tabela de rastreabilidade do pedido original na 14C.7.6. **Achado corrigido:** as colunas padrão do `materialreport` saíam sem título (`columnTitle` → `attributeName` não conhece `no`/`unit`/`unitprice`/`totalcost`) — o parser agora usa `MATERIAL_COLUMN_TITLES`. Verificação: suíte core **450 testes / 4841 passos / 0 falhas**. **Pendências herdadas:** (1) `columns unit|unitprice|totalcost` declarados em `.tjp` seguem rejeitados por `reportableAttributes` (exige keywords canônicas novas). Absorve os adendos 14.25/14.26 (viram ponteiro histórico na Fase 14). Não toca Gantt (15/16), sheets (18) nem storage (19). **C8–C12 (adendo §10, 2026-11-01):** **C8** markdown como formato de arquivo (`formats markdown` → `.md`, `Report#generateMarkdown` puro preservando a ADR 027) + aliases `mdtaskreport`/`mdresourcereport`/`mdmaterialreport`/`mdaccountreport` com `markdownReportDefaults()` e i18n en/pt-BR/es; **C9** `defaultaccount` universal + variantes `material|resource|charge` (extensão SyntaxMesh: o parser guarda o ID e `Project#defaultAccountFor` resolve; conta inexistente → `null`) aplicado na regra 4 de `resolveAccount`, mais `to_rti` de `ReferenceAttribute`/`ListAttributeBase` e `Query#assignList`; **C10** MSPDI `<Baseline>` via `baseline <scenario_id>` (atributo de report `IntegerAttribute` com índice do cenário) no projeto e por tarefa, sem `baseline` o documento segue byte-idêntico ao oracle; **C11** unit price por alocação/booking com precedência **booking → alocação → material**, `MaterialBooking` + `materialbookings`, parser nas duas formas (tarefa e material, com `Project#pendingBookings` para referência futura), custo realizado (`actualcost`) e custo de tarefa somando bookings, export TJP + round-trip, e **`totalquantity` removido** (quantidade derivada de Σ alocações; token reservado só para emitir `totalquantity_removed`); o requisito de `unitprice` no timesheet virou **18.17.9/18.17.10** da Fase 18. **C12** auditoria do G1.4: probe de modelo à mão virou âncora (`scheduler-g1_4-audit_14c_test.ts`), null-deref de `propagateDateToDep()` corrigido e — como efeito colateral — `PENDING_SCHEDULER_FILES` ficou **vazio** (`CSV-Reports/alert.tjp` agora é comparado contra o oracle Ruby, 112 passos). A divergência de `finishScheduling` (o port não mescla `assignedresources` no pai) ficou registrada no adendo 2026-11-01 da Fase 7, sem reescrever o scheduler. Verificação: suíte core **472 testes / 4909 passos / 0 falhas** · `deno task check:all` exit 0.
- Fase 15 — Gantt ⬜ Não iniciada
- Fase 16 — Apoio ⬜ Não iniciada
- Fase 17 — HTML/XML ⬜ Não iniciada
- Fase 18 — Time/Status Sheets ⬜ Não iniciada
- Fase 19 — Storage ⬜ Não iniciada
- Fase 20 — PWA + UI ⬜ Não iniciada
- Fase 21 — Compatibilidade e Qualidade ⬜ Não iniciada

## Arquivos de tarefas atômicas (TDD)

Cada fase tem um arquivo de tarefas atômicas separado:

- `docs/syntaxmesh/fases/fase-N-descricao-tarefas.md` — tarefas atômicas com testes unitários
- `docs/syntaxmesh/fases/fase-N-descricao.md` — plano da funcionalidade

## Decisões arquitetônicas (ADR)

Todas as decisões arquitetônicas importantes estão documentadas em `docs/syntaxmesh/decisoes/` (ADRs 001–032). Consulte `docs/syntaxmesh/decisoes/README.md` para a lista completa.

## Regras de ouro para IA

As regras de ouro para desenvolvimento estão em `docs/syntaxmesh/09-regras-para-ia.md`. Estas incluem:

- Uma tarefa de cada vez
- Sem Node.js/npm (puro Deno)
- Core não pode importar DOM/Preact/BeerCSS/IndexedDB/OPFS/UI
- Parser não conhece idiomas finais depois da normalização
- Idioma do projeto é diferente do idioma da interface
- Storage usa IndexedDB via idb-keyval e OPFS, através do pacote @syntaxmesh/worker-db
- UI (@syntaxmesh/ui) usa Preact, Signals e BeerCSS
- PWA offline com Service Worker (@syntaxmesh/service-worker)
- Testes obrigatórios (regra 12)
- ADRs para decisões arquitetônicas
- TJ Ruby sources em `docs/taskjuggler/lib/taskjuggler`

## Pipeline de qualidade

Execute `deno task check-all` para validação completa:

- `deno check` (type check)
- `deno lint` (lint)
- `deno fmt --check` (formatação)
- `deno test` (testes)

## Comando tj3

O ambiente está pré-configurado para rodar TaskJuggler. Execute `tj3` diretamente via shell para processar arquivos `.tjp`.

## Observações sobre o repositório

- `deno task --list` retorna `error: unexpected argument '--list'` — Deno 2.x lista tarefas executando `deno task` sem argumentos.
- O nome real da task de validação completa é `deno task check:all` (dois-pontos), não `check-all`.
- A Fase 2 está genuinamente implementada (9 arquivos em `packages/core/src/time/`, 14 arquivos de teste em `packages/core/tests/time/`).
- A Fase 8.1 está implementada com 163 testes core e 37 tarefas atômicas — mas **apenas o modelo** de `material`; o parser não conhece `material` (correção no Bloco C3 de `fase-10-complemento-tarefas.md`).
- **Gap RESOLVIDO (Fase 7 — placement, 2026-10-28):** `Project.schedule()` já
  colocava `start`/`end` + reservas em modelos do parser e construídos à mão.
  Quatro bugs de port encadeados foram a causa-raiz, todos corrigidos fiéis ao
  Ruby (`docs/taskjuggler/lib/taskjuggler/`):
  1. **`PropertyList(PropertySet)`** populava `this.items = []` em vez de
     `arg.to_ary` (PropertyList.rb:37-39) — `prepareScenario`/`scheduleScenario`
     iteravam listas **vazias**; nenhuma task/resource era jamais vista.
  2. **`TaskScenario.doneEffort()`** lia o atributo de usuário `effortdone`
     (sempre `0` no scheduling) em vez do contador interno `_doneEffort`
     (TaskScenario.rb:1761-1762, 1944) — effortTasks não encerravam, nunca
     propagavam `end` (`task_end_undef`). `calcCompletion` mantém `effortdone`
     (semântica de tracking, Ruby 2425-2437).
  3. **`propagateDate`** era stub que gravava só `@startIdx`/`@endIdx`; agora é
     port fiel (TaskScenario.rb:980-1074): escreve `start`/`end` no bag (via
     `forceForScenario`, o `instance_variable_set` do Ruby), propaga a
     dependentes/filhos herdeiros/containers. `canInheritDate` implementado
     (era `return true`).
  4. **`Xref`/`checkDependency`**: sucessores iam sempre para `_startsuccs`/
     `_endpreds` ignorando `onEnd` (Ruby 166-180), e `dependency.task` nunca
     era atribuído (Ruby `TaskDependency#resolve`) — a cadeia t1→t2→t3 não
     propagava start. `earliestStart`/`latestEnd` dependem de `dependency.task`.
     Teste âncora `tests/integration/logical-scheduler-driven_test.ts` reescrito
     para fixar o COMPORTAMENTO PÓS-Fase-7 (start/end reais, bookings, `effort`
     em horas-slot = 16 e não 57600). `console.log` de debug do scheduler
     removidos (Ruby usa `Log.*`, silencioso por padrão). As mensagens do
     scheduler já roteavam ao `MessageHandlerInstance` (§6.11).
- **Semântica do MessageHandler:** `error()` só lança `TjRuntimeError` com
  `trapSetup = true` (Ruby MessageHandler.rb l.291-298); drivers golden e
  testes que esperam abort precisam ativar o trap explicitamente.
- Golden do parser exige fuso UTC por caso (Ruby `TaskJuggler.new` reseta via
  `TjTime.setTimeZone('UTC')`).
