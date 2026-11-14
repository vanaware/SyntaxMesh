# Arquivo `CURRENT.md`

Leia os arquivos:

- docs/syntaxmesh/fases/plano.md (plano canônico de 21 fases + complementares 22–24 — fonte da verdade de escopo, andamento e **ordem de execução**)
- docs/syntaxmesh/fases/README.md (convenções de arquivos, protocolo TDD, mapa de fases)
- docs/syntaxmesh/09-regras-para-ia.md (regras de ouro)

Tenha conhecimento da lista de ADR em : docs/syntaxmesh/decisoes/README.md
Reuna dicas e analise-as do arquivo: docs/syntaxmesh/cheat-sheet-ruby-ts.md

Desenvolvimento atual (docs/syntaxmesh/fases/):

- **Fase 23 — Template (Vento) ✅ CONCLUÍDA (2026-11-06, fecho estendido 2026-11-07)**:
  `fase-23-template.md` (plano) + `fase-23-template-tarefas.md` (23.0–23.10) +
  ADR 033 + referência normativa `docs/syntaxmesh/11-referencia-template.md`.
  Próxima da ordem oficial: **Fase 24 (CLI)** — plano `fase-24-cli.md` +
  `fase-24-cli-tarefas.md`. Única pendência que restava da 23 era **23.7.7**
  (smoke `syntaxmesh template-fixture.tjp`), **fechada em 2026-11-08** pela
  24.8 — a fixture usada é `templates/reports.tjp` (a `basic.tjp` tem `effort`
  sem `allocate` e o scheduler erra de propósito).
  **23.9** corrigiu a colocação: `template` segue a condição da `macro` (prolog
  ou nível de propriedades, **nunca** dentro do `{ }` do cabeçalho — regra do
  Ruby em `TjpSyntaxRules.rb:3486`). **23.10** fixou listas como argumento e as
  três formas de `{{ for }}` (fixture `tests/fixtures/templates/lists-for.tjp`
  e suíte `tests/lexer/template-lists_test.ts`). **23.11** corrigiu o helper
  `producedByMarkdown` do teste 14C.5.1 (lia `rti.richText` em vez de
  `rti.richText.factory`; era a única falha pré-existente do `deno task tests`).

- **Fase 10 Complemento** — `fase-10-complemento1.md` + `fase-10-complemento2.md` (especificações) → executar `fase-10-complemento-tarefas.md` (Blocos C0–C4, toca Fases 5/7/8.1/10) e os adendos "Adendo Fase 10 Complemento" nos `-tarefas.md` das Fases 13/14/16/18/19/20/21. **Adendo 2026-11-06 (PLANEJADA, não executada):** `fase-10-complemento3.md` — tipo `markdown` em `extend` (ADR 039); tarefas no **Bloco C5** (`fase-10-complemento-tarefas.md`) + **14C.19** (`fase-14-relatorios-complemento-tarefas.md`); inclui o fix fiel ao Ruby do tipo `richtext` em `extend` (C5.1). **✅ Executado (2026-11-06):** C5.1–C5.8 + 14C.19.1–14C.19.4 verdes (fixture `10c-extend-markdown.tjp`, testes `extend-markdown_test.ts`/`extend-markdown_14c_test.ts` + golden C5.8); ADR 039 aceita. Dois fixes de produção fora do plano, achados no round-trip C5.7: `MarkdownFactory` grava `inputText` no back-pointer do RTI; `tjp-export-re` usa os campos `id/name/version` do projeto como fallback.
- Fase 11 (`fase-11-logica-queries-tarefas.md`), Fase 12 (`fase-12-richtext-tarefas.md`), Fase 13 (`fase-13-markdown-tarefas.md`), Fase 14 (`fase-14-relatorios-tarefas.md`, núcleo 14.0–14.24) e **Fase 14 Complemento** (`fase-14-relatorios-complemento.md` + `-tarefas.md`, Blocos C0–C18: materiais/RDO/breakdown nos relatórios, MspXml→MSPDI, markdown em reports, hide/rollup de material/picture, saída markdown `.md`, `defaultaccount`, `<Baseline>` do MSPDI, unit price por alocação/booking e auditoria G1.4, booking de estoque ±, unit price calculado por composição, keywords opcionais em booking + `booking charge` no material, turnover com precedência de preço, registro do comportamento de cenários e colunas de estoque `stockquantity`/`stockcost` nos conteúdos de material — absorve os adendos 14.25/14.26) — **todas concluídas**; **C0–C12 ✅** (2026-11-01) e **C13–C17 ✅** (2026-11-02, adendo extra §12) e **C18 ✅** (2026-11-02, pendência §13.7 — colunas de estoque `stockquantity`/`stockcost` + limpeza do órfão `ExtendedBooking` apagado, `ChargeBooking` como fonte única) na Fase 14 Complemento.

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
- **Fase 13 — Markdown (going-forward) ✅ Concluída (2026-10-29, 13.0–13.13; 13.14 parcial):** subsistema Markdown aditivo (ADR 026 — ⚠️ o plano pedia "ADR 024/025", já alocados; Markdown = 026). Markdown vira formato nativo; RichText (Fase 12) permanece para `.tjp` (ADR 009). **Unificação de AST:** `MarkdownFactory implements RichTextFactory` produz o mesmo `RichTextIntermediate` da Fase 12. Em `packages/core/src/markdown/`: base sobre `micromark`+`mdast-util-from-markdown`+GFM (não `@deno/gfm`) → `parse-mdast.ts`; pipeline de extensões `extensions/` com placeholders (`§COLOR_n§`/`§FUNC_n§`/`§MINIQ_n§`) e ordem color→functions→mini-query (`pipeline.ts`), sanitizador HTML OWASP allow/block-list (`html-sanitizer.ts`, 2 bugs de regex/text-emission corrigidos), cores (`color.ts`), funções `[[func:…]]` (`functions.ts`), mini-queries `<-attr->` (`mini-query.ts`); `mdast-to-richtext.ts` (AST→`RichTextElement[]`, headings/lists/link/img/html/inline + extension nodes); `convert-rich-to-md.ts` (`richTextToMarkdown`, one-way). `to_markdown()`/`children_markdown()`/`formatFuncArgs()` adicionados a `RichTextElement`+`RichTextIntermediate` (one-way; `appendSpace` respeitado no round-trip). Barrel `mod.ts`. **Adendo 13.14 (imagens, parcial):** `extensions/images.ts` com `isExternalImageRef`+`resolveImageRef` (URL externa intacta; relativo → OPFS via `ImageStore` injetável [contrato Fase 19] com fallback `dataDirs`); core DOM-free devolve descritor (ADR 001). 13.14.3 (`objectURL`) e 13.14.4 (`render.ts` roteamento `format richtext`) **re-ancoradas em 2026-11-03 (xray §4)**: 13.14.3 → **Fase 24** (CLI: imagem do disco via `io`) + **Fase 19** (OPFS/blob na PWA); 13.14.4 → **Fase 14 Complemento**, já entregue por C5 (`14C.5.1–5.12`). **Verificação:** `deno task check:all` exit 0 · `deno lint`/`deno fmt --check` verdes · suíte core **352 testes / 3999 passos / 0 falhas** (`deno task test`). Markdown: ~274 passos unit (extensions/parse/factory/mdast/to-markdown/convert/integration) + **24 snapshots** (`golden/markdown-snapshots.json` gerado por `generate_snapshots.ts`; `to_tagged`/`to_markdown` sempre, `to_s`/`to_html` onde há `Query`) + smoke `tests/integration/smoke_after_phase_13_test.ts`. Docs corrigidos: referências "ADR 025"→"026" em `fase-13-markdown.md`/`-tarefas.md`; ADR 026 registrado no README de decisoes.
- **Fase 14 — Relatórios ✅ Concluída (2026-10-31, 14.0–14.24):** pipeline completo de relatórios portado (ADR **027** — o plano pedia "ADR 026", já alocado ao Markdown; reports retornam **strings**, sem disco/DOM — `decisoes/027-reports-browser.md`). Em `packages/core/src/reports/` + arquivos de modelo: `CSVFile`, `ReportContext`, `ReportBase`, `TableColumnDefinition`/`CellSettingPattern`, `TableColumnSorter`, `ReportTable`/`ReportTableColumn`/`ReportTableLine`/`ReportTableCell`+`PlaceHolderCell`/`ReportTableLegend`, `Report` (ciclo `generate` → string), `TableReport`, `ColumnTable` (calendários), conteúdos `TaskListRE`/`ResourceListRE`/`AccountListRE`/`TextReport`/`ExportRE`+`TjpExportRE`+`MspXmlRE` (XML em seam própria `src/xml/`), `ICalReport`+`ICalendar` (mínimo), `NikuReport`/`TraceReport`+`TagFile`, `Navigator`+`NavigatorElement`, `ChartPlotter`+`PainterMin` (mínimos, SVG-string). **RTF completo (14.24.6):** `RTFReport`/`RTFReportLink`/`RTFNavigator` entregues — stubs NYI da Fase 12 desancorados; `URLParameter.encode` (zlib stored síncrono) com round-trip validado contra o `Zlib` do Ruby. **Golden (14.23):** `reports.golden.json` — 61 relatórios em 49 `.tjp` (≥60 ✓), gerado por `scripts/golden/reports-mwe001..009.rb` + `reports-syntax-correct.rb` (oracle tj3 real, `golden:generate` reproduzível byte-a-byte); comparação por **digest estrutural do formato intermediário** (colunas/linhas/kinds de célula — walkers espelhados Ruby↔`tests/golden/extract-table.ts`), não por HTML valor-a-valor: paridade de valores depende de integrações pendentes (`query_*` concretos — Fase 11; `chart` = GanttChart — Fases 15/16; geometria de calendário). Divergências **rastreadas, não xfails**: `PENDING_DIVERGENCES` + `PENDING_SCHEDULER_FILES` (`CSV-Reports/alert.tjp` — `toSeconds` null em `TaskScenario.propagateDateToDep`, gap de scheduler; **fechado em 2026-11-01 pela 14C.12.3**, a lista ficou vazia) + pendências sancionadas por classe de erro; `check:stubs` OK (zero NYI des-ancorado; NYI restantes pertencem a Fases 16/18/19). Testes de engine adicionados: `Task.hasResourceAllocated`, `Resource.allocated`, `Resource.getBookings`, `Task.assignedResources`. **Adendos 14.25/14.26 transferidos p/ a Fase 14 Complemento** (BreakdownReport/RdoReport + hide/rollup — ver bloco abaixo). Verificação: `deno task check:all` exit 0 · suíte core **395 testes / 4638 passos / 0 falhas** · smoke `tests/integration/smoke_after_phase_14_test.ts` (inclui e2e `Project.generateReports` e verificação Fase 13).
- **Fase 14 Complemento — Materiais/RDO/MspXml/Markdown nos relatórios ✅ Concluída (C0–C12, 2026-11-01):** `fase-14-relatorios-complemento.md` + `fase-14-relatorios-complemento-tarefas.md` (Blocos C0–C12, 145 tarefas). **C0** fundação (`format json` de 1ª classe, índices `entriesBy*` do Journal, alert-levels mínimo, `Picture`→HTML, dispatch das extensões) · **C1** materiais + `materialreport` · **C2** `BreakdownReport` (groupby account/task, html/csv/json) · **C3** `RdoReport` (`groupby date|task|resource|material|account`, `journalmode`/`journalattributes`, galeria `picture` + imagens do `details` com `maxpictures`, `setImageResolver` para `ImageStore`, html/json) + `picturesFromDetails`. **C4** MspXml→MSPDI: oracle Ruby real (`scripts/golden/mspdi-tj3.rb` → `mspdi.golden.json`, paridade campo a campo no subconjunto que o tj3 exporta) + extensões SyntaxMesh sem oracle — recursos material (`<Type>`0) e custo (`<Type>`2), `<Assignment>` de material/custo com série `TimephasedData` `Type`6, `<DurationFormat>` 7/8 (`ed` nunca 9), `<ActualWork>`/`<RemainingWork>`/`<ActualCost>`/`<RemainingCost>`, `<Notes>`, `<Exceptions>` de calendário (leaves de recurso) e `<LinkLag>`/`<LagFormat>`; **correção do `docs/tj3-engine/mspdi.md` §3.1** (ordem oficial: 0 material / 1 trabalho / 2 custo); limitações registradas (sem `<Baseline>`/`<ExtendedAttribute>`; `Project` sem store `leaves`; `hideMaterial` inerte até C6); armadilha de unidade documentada (`effort`/`effortdone`/`gapLength` são **slots**) e snapshot em `reports-extensions.golden.json` → `mspdi`. **C5** markdown nos relatórios: atributo `format` (`richtext` default, `inheritedFromParent`) em `report-attributes.ts` + roteamento `MarkdownFactory` no parser (`newRichText(..., format)`), com `Report.richTextSources`/`applyReportFormat()` para independência de ordem (via `force()`); `TableReport`/`TextReport` sem mudança de API (as duas fábricas produzem o mesmo `RichTextIntermediate`) — só reinterpretação do que nasce MediaWiki (`ReportBase#rtiForReport`/`#cellTextForReport` para `note` e `celltext`); handlers `[[query:]]`/`[[report:]]`/`[[reportlink:]]`/`[[navigator:]]` e o açúcar `<-attr->` verificados dentro de markdown; galeria do RDO é agnóstica de dialeto (`![alt](path)` e `[[Image:…]]`); sanitização é por nó mdast (tag bloqueada e `onerror` fora, corpo de `<script>` fica como texto inerte); **adendo na ADR 027** (§14C.5.12) fixando default-richtext/opt-in-markdown e os limites (`name`/`projectid`/`version` não são consultáveis por query). **C6** `hidematerial`/`rollupmaterial`/`hidepicture`: três atributos de relatório (`LogicalExpression`, `inheritedFromParent`) + regras no corpo compartilhado `reportAttributes` (materialreport/task/resource/account/export/ical/niku/tagfile) + i18n en/pt-BR/es (negação lógica do TJP é `~`, não `!`); `Query`/`ReportContext` ganham os três campos e `ReportBase#hiddenBy()` (promovido do RDO) avalia a expressão contra a propriedade, com `filterMaterialList()` para as listas (materiais não têm `materialroot`). Aplicação: materialreport (lista hierárquica), RDO `groupby material`, colunas `materials`/`materialcost` do taskreport, breakdown (contribuintes de conta/tarefa + `replaceContributorCost`), export TJP (declarações, sub-materiais e alocações) e MSPDI (o wiring de 14C.4.10 deixa de ser inerte). `hidepicture` é avaliado no **dono** da entrada de journal, então imagem filtrada não consome `maxpictures`. `rollupmaterial` consolida: descendentes fora das listas hierárquicas e contribuinte sem linha própria no breakdown (valor preservado em `totals`; `rolledUp` só entra no JSON quando verdadeiro, preservando o shape de quem não usa a diretiva). Auditoria (14C.6.1) prova por teste que `hidetask`/`hideresource`/`hideaccount`/`rollup*` são **avaliados** (não só parseados) e que `hidejournalentry` fica ancorado na Fase 16 (avaliação por entrada). Divergência registrada: `Material#name` espelha o id (14C.1.14), então TJP/MSPDI mostram `aco` em vez do texto do cabeçalho. **C7** verificação final: `check:all` exit 0 · `check:stubs` OK · `deno fmt --check` limpo (571 arquivos) · `deno lint` restrito aos arquivos do complemento limpo (36 arquivos; os 116 problemas do repo são pré-existentes) · `golden:generate:extensions` idempotente 2× (mesmo md5) com `reports.golden.json`/`parser.golden.json`/`mspdi.golden.json` byte-idênticos ao HEAD · smoke `tests/integration/smoke_after_phase_14c_test.ts` + fixture `fixtures/ext/14c-smoke.tjp` (materialreport/breakdown/RDO/MSPDI como strings com `outputDir` em tmpdir vazio) · tabela de rastreabilidade do pedido original na 14C.7.6. **Achado corrigido:** as colunas padrão do `materialreport` saíam sem título (`columnTitle` → `attributeName` não conhece `no`/`unit`/`unitprice`/`totalcost`) — o parser agora usa `MATERIAL_COLUMN_TITLES`. Verificação: suíte core **450 testes / 4841 passos / 0 falhas**. **Pendências herdadas:** (1) `columns unit|unitprice|totalcost` declarados em `.tjp` seguem rejeitados por `reportableAttributes` (exige keywords canônicas novas). Absorve os adendos 14.25/14.26 (viram ponteiro histórico na Fase 14). Não toca Gantt (15/16), sheets (18) nem storage (19). **C8–C12 (adendo §10, 2026-11-01):** **C8** markdown como formato de arquivo (`formats markdown` → `.md`, `Report#generateMarkdown` puro preservando a ADR 027) + aliases `mdtaskreport`/`mdresourcereport`/`mdmaterialreport`/`mdaccountreport` com `markdownReportDefaults()` e i18n en/pt-BR/es; **C9** `defaultaccount` universal + variantes `material|resource|charge` (extensão SyntaxMesh: o parser guarda o ID e `Project#defaultAccountFor` resolve; conta inexistente → `null`) aplicado na regra 4 de `resolveAccount`, mais `to_rti` de `ReferenceAttribute`/`ListAttributeBase` e `Query#assignList`; **C10** MSPDI `<Baseline>` via `baseline <scenario_id>` (atributo de report `IntegerAttribute` com índice do cenário) no projeto e por tarefa, sem `baseline` o documento segue byte-idêntico ao oracle; **C11** unit price por alocação/booking com precedência **booking → alocação → material**, `MaterialBooking` + `materialbookings`, parser nas duas formas (tarefa e material, com `Project#pendingBookings` para referência futura), custo realizado (`actualcost`) e custo de tarefa somando bookings, export TJP + round-trip, e **`totalquantity` removido** (quantidade derivada de Σ alocações; token reservado só para emitir `totalquantity_removed`); o requisito de `unitprice` no timesheet virou **18.17.9/18.17.10** da Fase 18. **C12** auditoria do G1.4: probe de modelo à mão virou âncora (`scheduler-g1_4-audit_14c_test.ts`), null-deref de `propagateDateToDep()` corrigido e — como efeito colateral — `PENDING_SCHEDULER_FILES` ficou **vazio** (`CSV-Reports/alert.tjp` agora é comparado contra o oracle Ruby, 112 passos). A divergência de `finishScheduling` (o port não mescla `assignedresources` no pai) ficou registrada no adendo 2026-11-01 da Fase 7, sem reescrever o scheduler. Verificação: suíte core **472 testes / 4909 passos / 0 falhas** · `deno task check:all` exit 0. **C13–C17 (adendo extra §12, 2026-11-02):** **C13** booking de estoque — `MaterialBooking` sem tarefa (`taskId`/`task` nulls) com quantidade ± e o atributo de cenário `stockbookings` no material; nova regra `signedNumber` usada só pela gramática de estoque (o scanner fiel a `ProjectFileScanner.rb:95-98` não produz número com sinal); conta de destino obrigatória — sem `chargeset` nem `defaultaccount material` o parser erro (`stock_booking_without_chargeset`); `AccountScenario#addStockBookings` emite `CostEvent` `material_usage` (modo `actual`, idempotente) com filtro de datas no período. **C14** unit price calculado por composição — `MaterialComponent` + atributo `materialcomponents`; `Material#unitPriceValue()` = preço fornecido → Σ(componente × preço do componente, recursivo, com guarda de ciclo `material_composition_cycle`) → campo do construtor; `unitprice` junto de componentes é erro (`unitprice_with_components`, nas duas ordens); a declaração aninhada de sub-material sai do corpo do material (o espaço passa a significar composição). **C15** `effort`/`quantity`/`value` opcionais em booking (forma curta canônica do TJ, `TjpSyntaxRules.rb:6001`/`:4771`) e `booking charge` implementado do zero nas três origens — modelo `ChargeBooking` com montante ±, gravado no atributo de cenário `chargebookings` da **tarefa**, com a fila `pendingBookings` para referência futura. **Revisão 2026-11-02 (decisão do usuário):** no corpo da tarefa a referência de recurso **não existe** (booking de charge não consome esforço); a gramática aceita descrição opcional `$STRING` nas três origens (`booking charge ["<desc>"] [value] <montante> on <data>`; no recurso/material, depois da referência de tarefa). **C16** turnover com precedência de preço auditada por rota (booking → alocação → material explícito ou calculado), com teste-âncora de que booking **com** tarefa não entra no turnover de estoque (não duplica custo). **C17** cenários: a tabela do §12 estava errada (escrita da documentação, não do código) — verificada contra a fonte Ruby, **não há divergência** (namespace flat, `fullId` = `real` e não `plan.real`, top-level único via `clearProperties`, aninhamento recursivo com herança); tabela corrigida + testes de caracterização. Pendências registradas no §13.7: carga contábil de `booking charge` e _remaining_ por bookings (Fase 18), limpeza de `ExtendedBooking` (órfão — **apagado em C18**) — as colunas `stockquantity`/`stockcost` foram entregues em C18 (abaixo). Verificação: suíte core **482 testes / 4934 passos / 0 falhas** (incl. a revisão de `booking charge`, com `rules_booking_charge_14c_test.ts` — 8 steps) · `deno task check:all` exit 0 · `check:stubs` OK · goldens inalterados. **C18 (pendência §13.7, 2026-11-02):** colunas `stockquantity`/`stockcost` — Σ algébrico dos bookings de **estoque** (movimentos sem tarefa, `stockbookings`) com data no período do relatório, preço efetivo do booking; `singlePattern` em `reportableAttributes` + keywords i18n (pt-BR/es) + casos em `TableReport.genMaterialCell` (vale para todo conteúdo de tabela que lista materiais); `defaultColumnTitle` passou a consultar `materialPropertiesById` como segundo dicionário — colunas de material declaradas em `.tjp` (inclusive as novas) saem com título também fora do `materialreport` (a aceitação de `columns unit|unitprice|totalcost` via keyword continua fora de escopo). Booking **com** tarefa não entra (âncora 14C.16.4). **Limpeza §13.7:** órfão `ExtendedBooking` (Fase 8.1) apagado — `model/extended-booking.ts` + teste + re-export em `model/mod.ts`; merge com `ChargeBooking` descartado (formas incompatíveis; esforço/material já vivem em `Booking`/`MaterialBooking`), `ChargeBooking` fica como fonte única do booking de charge. Verificação: `tests/reports/stock-columns_14c_test.ts` (7 steps) · suíte core completa **483 testes / 4934 passos / 0 falhas** · `deno task check:all` exit 0 · `check:stubs` OK · goldens byte-idênticos · `fmt`/`lint` limpos.
- **14-C Onda A — paridade de scheduling + `Material#name` (2026-11-02):** duas frentes independentes destravadas. **(A1)** `TaskScenario#finishScheduling` agora **espelha fielmente** `TaskScenario.rb:410-430`: recursa nos filhos (bottom-up) e mescla, com dedupe, os `assignedresources` de cada tarefa em cada pai imediato (via `forceForScenario`), de modo que a união transita pelo container até a raiz — **elimina a divergência 14C.12.4**. Guard de idempotência próprio (`_finishDone`), separado de `_scheduled` que `markAsScheduled()` já eleva no passe principal; nullify de `@candidates/@mandatories/@allLimits` omitido (só liberação de memória; `limitsOk()` lê `allocation.candidates`). Teste: `tests/scheduling/finish-scheduling-assignedresources_14c_test.ts` (4 passos). **(A2)** `Material#name` passa a ser o **rótulo do cabeçalho** (`material <id> "<rótulo>"`) em vez do id — construtor recebe `label?`, parser (`createMaterial`) repassa o `$STRING`; sem rótulo cai no id (compatível com `material steel` sem aspas). Fecha a pendência 14C.1.14. Consequência: colunas `name` do materialreport, `<Name>` do MSPDI, breakdown/RDO/markdown e round-trip TJP (`material aco "Aço" {`) exibem o rótulo. Testes atualizados (stock-columns, msp-xml-re, smoke, hide-material, markdown) + golden `reports-extensions` regenerado **só** por essa mudança. Verificação: suíte core **484 testes / 4938 passos / 0 falhas** · `deno task check:all` exit 0 · `check:stubs` OK · `fmt`/`lint` limpos nos arquivos tocados.
- **14-C Ondas B–D — motor de `query_*` + `MaterialScenario` + plano da Onda D (2026-11-02/03):** **(B)** 42 `query_*` portados no dispatch de `Query.process` (property→scenarioData→atributo-base): PropertyTreeNode `children/journal/journalmessages/journalsummaries/alert/alertmessages/alertsummaries/alerttrend`; TaskScenario 24 (`activetasks`…`targets`); ResourceScenario central `cost/duties/effort/effortdone/effortleft/headcount/rate/revenue/freetime/freework`. **Ancorados** com âncora válida (dados não produzidos — `NotYetImplementedError`, observável como `!query.process()`, não throw): `annualleave/annualleavelist/annualleavebalance/sickleave/specialleave/timeoffdays/unpaidleave` (Fase 16), `fte` (Fase 18), `Resource#query_dashboard` (Fase 16 — re-ancorado 2026-11-03, xray §4/§5.2: dono único é a Fase 16; antes apontava Fase 15). Semântica fiel: `query_effort`=0 p/ não-agendada; `query_complete` honra valor `complete` gravado antes de recalcular. Os testes de dispatch da Fase 11 que usavam `effort` como valor genérico migraram p/ `priority` (Integer de cenário sem `query_*`). **(C)** `MaterialScenario` `query_*` (`unitprice/effort/cost→totalcost/scheduledcost/actualcost/remainingcost/remaining/stockquantity/stockcost`) **sem duplicar**: o cálculo por período foi extraído p/ `Material#*InPeriod` (fonte única consumida por `TableReport.genMaterialCell` **e** pelas queries); coluna `unitprice` do materialreport reroteada p/ `query_unitprice`. **(Regressão corrigida)** o nome `query_cost` sequestrava `<-cost->` (atributo-base `cost`=preço unitário, cf. `trace-report-material_14c_test.ts`) → renomeado p/ `query_totalcost`, alinhado à keyword real da coluna `totalcost`. **(D)** investigada e **planejada** (não implementada — mudanção transversal): bucket `task`→`charge`, `aggregate charges` (alias `tasks` p/ tj3), booking charge/material/stock temporal com `<modifier>` (reusa `ExtendedCharge`/`distribution.ts`) e `booking effort`→`booking resource` — plano em `docs/syntaxmesh/fases/fase-14-c-onda-d-booking-sintaxe-nomenclatura.md`. Testes BDD novos: `tests/logic/query-{tasks,resources,ptn}_14c_test.ts`, `tests/reports/material-scenario-queries_14c_test.ts`. Docs: rastreabilidade em `fase-14-relatorios-complemento.md §15` e `fase-11-logica-queries-tarefas.md` (adendo 14-C — 11.12/11.13 desbloqueados). Verificação: suíte core **488 testes / 4966 passos / 0 falhas** · `deno check packages/core/mod.ts` limpo · `deno task check:all` exit 0 · `check:stubs` OK · goldens **25 testes / 981 passos / 0 falhas** (sem drift; `PENDING_DIVERGENCES` CSV reavaliado — ainda divergem, permanecem rastreadas) · `fmt`/`lint` limpos nos arquivos tocados.
- **14-C Onda D implementada — nomenclatura + booking temporal (2026-11-04):** execução do plano `fase-14-c-onda-d-booking-sintaxe-nomenclatura.md`. **D1** bucket de custo `task`→`charge` em `AccountBuckets` e todos os usos (`account-scenario.ts`); nome interno só — relatórios/golden inalterados. **D2** `aggregate charges` com `tasks` mantido como **alias de leitura** tj3 (parser `rule("aggregate")`, default em `scenario.ts`, runtime `account-scenario.ts` trata `charges`≡`tasks`). **D4** keyword de tipo `booking resource <ref>` (com `effort` alias de leitura; `booking <id>` continua canônico TJ) e `unitprice <p>` **opcional antes do modifier** na alocação de material. **D3 (o mudanção)** — booking de **charge/material/estoque** aceita cauda temporal `<modifier> <intervalos>[,…]` (`onstart|onend|perhour|perday|perweek|permonth|distributed`), fonte única `model/booking-period.ts` (`BookingTail` + `valueInPeriod`/`overlapDays`/`isTemporalTail`/`legacyTail`). Convenção de dias: **índice inteiro de calendário** com **fim exclusivo** no intervalo (`d+24h`≡1 dia; `A - B` cobre A..B−1) e **período inclusivo** em ambas as pontas — espelha a iteração dia-a-dia de `distribution.ts`. `on <data>` vira tail degenerado `onstart`/1-dia com **`isTemporal()===false`**; todos os consumidores (`Material#*InPeriod`, `AccountScenario#addStockBookings`) mantêm o **caminho legado intacto** e só usam a matemática temporal quando `isTemporal()` — **zero drift de golden** garantido. Charge é armazenamento de parsing (sem consumer contábil ainda — Fase 18). Export TJP (`tjp-export-re.ts#bookingTailText`) **reemite** a sintaxe temporal com o fim cru (`String` de meia-noite ⇒ só a data), fechando o round-trip `parse→export→parse` idêntico. Testes BDD novos: `tests/model/booking-period_test.ts` (unit: legacyTail/overlapDays/isTemporalTail/valueInPeriod por modifier) + `tests/parser/rules_onda_d_14c_test.ts` (D3/D4 por origem) + round-trip por modifier em `tests/reports/tjp-export-material_14c_test.ts`. Verificação: suíte core **497 testes / 5005 passos / 0 falhas** (era 488/4966) · `deno check packages/core/mod.ts` limpo · `deno task check:all` exit 0 · `check:stubs` OK · goldens inalterados (sem regeneração) · `fmt`/`lint` limpos nos arquivos tocados.
- **Fase 15 — Gantt HTML+CSS ✅ Concluída (2026-11-03, 15.0–15.14):** port fiel de `GanttChart`/`GanttHeader`/`GanttHeaderScaleItem`/`GanttLine`/`GanttTaskBar`/`GanttMilestone`/`GanttContainer`/`GanttLoadStack`/`GanttRouter`/`CollisionDetector`/`HTMLGraphics` para `packages/core/src/gantt/` (11 módulos, ADR 028: `<div>` absolutos + classes CSS, **sem SVG/Canvas**), plugado em `TableReport` pelo contrato `SpecialCell` — os 2 stubs `Ancorado: Fase 16` da coluna `chart` (`generateHeaderCell`/`generateTableCell`) desapareceram. **Golden 15.13:** 12 charts (mwe001/002/003/004/006/008×3/009 + `HTML-Reports/{Calendars,Sorting,depArrows}`), **111 linhas** e **48 setas** a 0 diffs contra o `tj3` real, tolerância de 1px só em posição (`*Date` nunca tolerada). **15.14:** `deno task tests` EXIT=0, smoke `tests/integration/smoke_after_phase_15_test.ts` (mwe001/003/008 em pt-BR: tabela da Fase 14 intacta + `div.tabback`/`taskbar` e contagem exata de charts). **Regressões da fase (adendo G1–G9 da `fase-15-gantt-tarefas.md`):** (G1) `PropertyTreeNode` passou a gravar `id`/`name`/`seqno` como **atributos** (`PropertyTreeNode.rb:111,115,121`) — sem isso `sortTasks name.up|seqno.up` comparava `null` com `null` e a ordem do chart/relatórios ficava a de definição; (G4) `prepareScheduling` recuperou o atalho start-end de `TaskScenario.rb:121-123` + guard de idempotência em `scheduleSlot`; (G5) `PTNProxy#getIndicies` checa `index` antes do `get`; (G2/G3) `bookBookings` fiel (`effortdone`/`now`) mudou datas de assignment — teste do MSPDI e golden de extensões atualizados contra o `tj3` real, com `asMoney` (2 casas) no MspXmlRE; (G6) oracle `property-tree.rb` corrigido (`ScenarioWrapper#all`); (G7) 19 × TS2322 (`ScoreboardInterval`×`TimeInterval`) nos testes de booking; (G8) `no-this-alias` em `getIndicies` + `wz_tooltip.js` vendorizado excluído do `lint`; (G9) drift do oracle Ruby (REXML dos `.html` intermediários, ordem de Hash em `attribute-definitions`, 2 casos a mais em `gantt.golden.json`) revertido/registrado. Verificação: suíte **513 testes / 5305 passos / 0 falhas** · `deno task tests` EXIT=0 · `check:stubs` OK · `test:deferred` OK.
- **Fase 16 — Apoio ✅ Concluída (2026-11-03, 16.0–16.20):** journal (ADR 029) —
  `Journal`/`JournalEntry`/`JournalEntryList` com índices `indexBy*`,
  `rangeEntries`, `alertLevel`/`alertEntries`/`currentEntries(R)` e `to_rti` nos
  7 modos do Ruby (+`journalmessages`/`journalsummaries`), `AlertLevelDefinition(s)`,
  `Leave`/`LeaveTypes`/`LeaveList`/`LeaveAllowance(List)` + `to_tjp`,
  `FileList`/`FileRecord`, `URLParameter.decode` (`fflate`), `stdIoWrapper`,
  helpers UTF-8 no-op, `deepClone` dos tipos novos, `Resource#query_dashboard` e
  as 7 consultas de licença (máscara `typeIdx << 2`), `LogicalFlag` (ramo
  Journal) e `hasalert` reais. Código em `packages/core/src/{model,utils,logic}/`
  (desvio: não existe `src/journal/`). **Golden 16.19:** `scripts/golden/journal.rb`
  (17 casos, 7 modos) + `leaves.rb` (19 casos) = **36 casos**. **16.20:**
  `check:all` + `fmt:check` (642 arquivos) + `lint` (600 arquivos) verdes,
  `check:stubs` OK, exports em `packages/core/mod.ts` (iCal `Journal` →
  `ICalJournal`; `isLeaveType` numérico → `isScoreboardLeaveType`), smoke
  `smoke_after_phase_16_test.ts`. **Flakes herdados corrigidos:**
  `attribute-definitions` compara a visão plana de
  `LeaveList`/`LeaveAllowanceList`; **G10 da F15** — o `nowLineX` do golden de
  Gantt era o relógio da máquina (agora `FROZEN_NOW` no oracle e
  `report.set('now', …)` no teste). Suíte: **559 testes / 5542 passos / 0 falhas**.
- **Fase 17 — HTML/XML ✅ Concluída (2026-11-04, 17.0–17.17):** ports reais de
  `XMLElement`/`XMLDocument` (`src/xml/`), `HTMLElements`/`HTMLDocument`
  (`src/html/`), `ICalendar`+`Component`/`Todo`/`Event`/`Journal`/`Person`
  (`src/ical/`) e do Painter SVG completo (`src/painter/`: `Color`/`Points`/
  `SVGSupport`/`Element`/`Group`/`Primitives`/`BasicShapes`/`Text`/`Painter`/
  `FontMetrics`/`FontMetricsData`/`FontData`) — ADR 038 substituiu e apagou os
  5 mínimos herdados (F12/F14/F15): `SimpleXMLElement`+`xml-node.ts`,
  `html-shell.ts`, `reports/i-calendar.ts`, `painter-min.ts`; contrato
  `XMLElementLike` mantido (troca transparente p/ RichText/reports/Gantt).
  `chart-plotter.ts` migrou p/ o Painter real (SVG com `\n`+indent fiel).
  **Goldens 17.16:** `html-xml.rb` (25 casos) + `ical.rb` (11 casos; DTSTAMP
  congelado no oráculo, fuso `Europe/Berlin` pinnado) = 36 casos byte-a-byte.
  **17.17:** `check:all`/`fmt:check`/`lint`/`golden:generate` EXIT=0; smoke
  `smoke_after_phase_17_test.ts` (4 steps, inclui `to_html()` → `XMLElement`
  real e CRLF RFC 5545 do `foldLines`). Suíte: **638 testes / 5883 passos /
  0 falhas**.
- **Varredura xray Ruby↔TS e realocação de escopo (decisões do usuário,
  2026-11-03)** — `docs/syntaxmesh/xray.md` (legenda ASCII `OK/PAR/PLA/NPL/NA/DEAD/EXT`).
  Propagação feita nos docs de fase + código:
  - **Fase 22** entrega o **`doc-core`** completo (subfase 22.1b): `SyntaxReference`,
    `KeywordDocumentation`, `TjpExample`, `UserManual`, `TernarySearchTree` e o núcleo
    de highlight Kate/Vim (`docgen/`) — antes espalhados/em aberto na F16; a 22 também
    entrega o equivalente do `tj3client`/`tj3daemon`/`tj3webd` (mesmo resultado, outra
    funcionalidade — lsp-core + servidor da extensão). **2026-11-03:** a subfase está
    expandida em tarefas atômicas em `fase-22-vscode-extension-tarefas.md` (Blocos C–J,
    **108 tarefas** com testes unitários; cada peça marcada pelo consumidor —
    【24】 via `wz man`/24.9, 【LSP】 restrito ao `lsp-core`, 【24+LSP】 compartilhado;
    geradores finais `.xml`/`.vim` continuam cancelados, só saem os **dados** de
    highlight). Os outros blocos da F22 (22.0, 22.1, 22.2–22.11) ficam para o kickoff.
  - **Fase 24** empacota esse core: `wz man` (tj3man), `--freeze*`, apps de sheets,
    `--report` com dynamicAttributes, consumidores de `FileList`/`StdIoWrapper`/`UTF8String`
    (13.14.3 de imagens + regressão `format richtext` incluídas; adendos 24.9/24.10).
  - **Fase 16**: **16.10 `AlgorithmDiff` CANCELADO** (DEAD no upstream — registro na
    própria seção); 16.9/16.14/16.15 MOVIDOS para a 22; 16.7/16.11/16.12 permanecem no
    core com consumidores declarados (F18/F24); **dono único de `query_dashboard`**.
  - **Fase 18**: núcleo dos apps de sheet (`Tj3SheetAppBase` + sender/receiver/summary de
    TS e SS) = subfase **18.18**; pipeline `dynamicAttributes`/`parseReportAttributes` =
    **18.19**; `MessageHandler#checkLevel` = **18.20**. Política de email (ADR **036**):
    sender devolve o **texto do email** (sem SMTP); receiver consome **texto de mensagem**.
  - **Código**: `TaskJuggler.parse/parseFile/parseContent/freeze` re-ancorados 19→**24**
    (`parseFile` deixou de ser stub silencioso `return null`); `Resource#query_dashboard`
    15→**16**; `Project#generateReports` voltou a chamar `DataCache.instance.flush()`;
    as chamadas de dynamicAttributes viraram âncoras `Fase 18`. Verificação: `check:stubs` OK ·
    `check:all`/`lint`/`fmt:check` verdes · suíte **513 testes / 5305 passos / 0 falhas**.
  - **ADRs**: 029 = Journal/AlertLevel (F16, sem arquivo até 16.0.1); sheets sem SMTP =
    **036**; injeção de provedor de conteúdo = **037**; proibida a varredura de
    renumeração de ADRs existentes (cancelada na tarefa 18.0 do `-tarefas.md`).
  - **Matriz** `completude-matrix.md`: regenerar na **Fase 21** (xray §5.5).
- **Fase 18 — Time/Status Sheets ✅ Concluída (2026-11-05, 18.0–18.20 + adendos):**
  `timesheet/` (`TimeSheetRecord`/`TimeSheet`/`TimeSheets`/`ProjectTiming`) com
  `check()`/`warnOnDelta` fiéis e integração em `Project.checkTimeSheets` e
  `TaskJuggler.checkTimeSheet/checkStatusSheet`; `sheets/`
  (`SheetHandlerBase`/`SheetSender`/`SheetReceiver`, senders e receivers de
  status, `TimeSheetSummary`) mais os **5 apps** de núcleo (`SheetAppBase` +
  `TsSender/TsReceiver/TsSummary/SsSender/SsReceiverApp`, 18.18) que devolvem
  **texto de email** e consomem **texto de mensagem** — sem SMTP, sem
  subprocesso (ADR 036) e com `FileStore` injetado (ADR 037); material/
  `picture` nas sheets (18.17, adendo F10 Complemento). **18.19**: o backup é
  **raso** como no Ruby — depois de gerar, o mapa de atributos volta mas os
  valores das listas do snippet permanecem; só snippet não vazio restaura, e
  `""` deixa `interactive` marcado (verificado no `tj3` 3.8.4). Erro de sintaxe
  vira mensagem do FSM (cascata) em vez de `SystemExit`, e a regra `_columns`
  descarta colunas `null` para não corromper a geração seguinte. **18.20**:
  `outputLevel`/`logLevel` são acessores validados por `checkLevel` (0–5 ou
  nome de `LOG_LEVELS`, `TjArgumentError` = `ArgumentError` do Ruby). **Goldens**:
  `timesheets.rb` (22 casos) e `dynamic-attributes.rb` (6 casos, o caminho do
  `-A`); CLI `--report/--attr` registrada na F24 (24.10.5). **Verificação:**
  `deno task tests` exit 0 · suíte **695 arquivos / 6207 passos / 0 falhas** ·
  `check:stubs` OK · sem `: any` em `packages/core/src` · smoke
  `smoke_after_phase_18_test.ts`.
- **Ordem de execução oficial (diretriz do usuário, 2026-11-03; seção
  "Ordem de execução" do `plano.md`):**
  `16 → 17 → 18 → 23 → 24 → 21 (1ª onda) → 22 → 21 (2ª onda) → 19 → 20 → 21 (3ª onda)`
- **Fase 23 — Template (Vento)** ✅ Concluída (2026-11-06, 23.0–23.8): keyword
  `template` (`en`/`pt-BR` `modelo`/`es` `plantilla`) com corpo `[ ]` **cru** e
  params `( )`, registrada no **namespace único** macro/template do `MacroTable`
  (ramo interno, sem registro paralelo — ADR 033); expansão em **duas fases**
  no `expandMacro` do scanner (macros do corpo antes do render Vento; texto
  reentrante via `injectMacro`, sem autoescape); argumentos nomeados tipados
  (string/número/boolean/`!id`/lista/objeto/aritmética) **sem `eval` próprio**;
  proteções de recursão (cadeia `A → B → A`), profundidade 20, ordem de
  definição e `${?NOME}` silencioso; contexto com `project` (view congelada),
  `ids`, `expandTemplate`, `expandTemplateList`, `expandMacro`. **Caminho de
  macro intocado** (auditoria 23.1b + cerca executável
  `tests/lexer/macro-baseline-regression_test.ts`). Goldens TS-only
  consolidados em `tests/golden/template.golden.json`; integração prova
  schedule/financeiro idênticos ao projeto escrito à mão e relatório via
  fachada `TaskJuggler`. Referência normativa em
  `docs/syntaxmesh/11-referencia-template.md` (insumo do `lsp-core` da F22).
  **23.7.7 pendente com nota** (smoke da CLI): a Fase 24 ainda não existe.
  Verificação: `check:all`/`lint`/`fmt:check`/`check:stubs` exit 0; suíte
  **730 testes / 6402 passos verdes**, com 1 falha **pré-existente** em
  `tests/reports/markdown-report_14c_test.ts` (reproduzida em worktree limpo
  do HEAD — não é regressão da F23).
- **Fase 24 — CLI (`packages/cli`)** ✅ **Concluída (2026-11-08)** — **1ª onda
  ✅ (24.0–24.8)** + **Bloco J ✅ (24.10.1–24.10.9)** + **Bloco I ✅
  (24.9.1–24.9.5, com o `doc-core` da F22 construído na mesma sessão)**. A CLI `syntaxmesh` está
  disponível e a fachada `execute` (envelope JSON) é o **ponto único** de entrada
  das chamadas de CLI; `parse`/`parseFile`/`parseContent` recebem o conteúdo por
  **injeção** (`FileContentProvider`) e o core deixou de ler disco (ADR 034).
  Plano `fase-24-cli.md` + tarefas
  `fase-24-cli-tarefas.md` (~114, sendo ~100 da 1ª onda + adendos 24.9/24.10).
  Depois da 23, antes da 21¹; tj3-equivalente multi-runtime (Deno/Bun/Node); a
  **1ª onda da Fase 21 usa esta CLI como runner** dos golden tests contra o `tj3`
  real. Adendos (decisão 2026-11-03, xray): `wz man` (consome o `doc-core` da
  F22), `--freeze*`, apps de sheets `ts/ss send·receive·summary` (empacotam o
  núcleo da F18; **sem SMTP** — sender devolve o texto do email, receiver lê o
  texto da mensagem), `--report` com dynamicAttributes, `FileList`/`StdIoWrapper`
  da F16, imagens `13.14.3` e regressão `format richtext` (`13.14.4`).
  **Desancorado do core (ADR 034):** `parse`/`parseFile`/`parseContent` recebem o
  texto por **provedor injetado** (`FileContentProvider`) — o core não lê disco
  nem terminal (storage da PWA continua na Fase 19). Só `TaskJuggler.freeze`
  segue ancorado, porque reescrever o master `.tjp` é política da CLI.
  **API nova entregue:** `Report#outputs: Map<format, texto>` (coleta num único
  ponto do dispatch de `generate()`, CSV normalizado por `CSVFile`; `output`/
  `outputFileName` legados intactos), módulo `src/reports/reports-json.ts`
  (`ReportsJson`/`ReportJsonEntry`/`FormatContent` + `renderReports(project,
  options)`: ordem de declaração, `errors[]` por relatório sem matar os demais,
  `ok` global) e a fachada `TaskJuggler.renderReports(options?)` como construtor
  reutilizável da seção `results.reports`.
  **Extensão de DSL:** o modificador `stdout` (`taskreport r "T" stdout { … }`,
  keyword i18n en/pt-BR/es + atributo booleano `stdout` do `PropertySet` de
  relatórios, default `false`) registra apenas a **intenção**; quem imprime no
  terminal é a política de saída da CLI (`output-policy.ts`, 24.5).
  Compatibilidade: `.tjp` sem `stdout` parseia igual (golden de
  `attribute-definitions` preservado — `SM_EXTENSION_IDS` no teste).
  Pureza auditada por `tests/reports/purity_24_test.ts` (grep estático: sem
  `node:fs`/`Deno.*` de I/O/`console.*` no pipeline de relatórios).
  **Fachada `execute` (24.2.22–24.2.29):** `TaskJuggler.execute(request)`/
  `core.execute(request)` **orquestra o pipeline interno** (parse → gates de
  `--check-syntax`/`--list-reports` → schedule → `checkReports` → reports) e
  devolve o envelope `{ ok, exitCode, options, messages, results }` do adendo
  v2.1 §3: eco de opções (só caminhos, nunca o conteúdo), `exitCode` pela
  matriz §5.3, mensagens estruturadas e **apenas** as seções pedidas
  (`check`/`listReports`/`reports`/`help`/`version` + `freeze`/`sheet`/`man`
  ancorados com `*_not_available`). O módulo `src/execution/` guarda
  `types.ts`/`sections.ts`/`envelope.ts`/`execute.ts`/`mod.ts`; o
  `include` é resolvido por lookup em memória via `normalizeInputPath`.
  Como `MessageHandler`/`DataCache` são singletons, chamadas concorrentes são
  **serializadas** por fila de processo (adendo §3.6) — `request`/envelope são
  `structuredClone`áveis. `appOptions` usa `ExecutionSheetAppOptions` (sem o
  `now` funcional da F18) para manter o contrato data-pure; `formats[]` vem de
  `Report#outputs` após a geração (não do declarado), o que faz `-A` bater.
  **Grupo 5 (24.2.31–24.2.36) — costuras de `FileStore` rebaixadas a dados:**
  auditoria classificou cada costura herdada entre _permanece no caminho
  passo-a-passo/PWA_ (`SheetAppContext.fileStore`, `setFileStore`/
  `requireFileStore`, `TaskJuggler.fileStore`) e _refatorada para dados na
  fronteira `execute`_ (`SheetHandlerBase`/sheets, `checkTimeSheet`/
  `checkStatusSheet`, `CSVFile.read`, `XMLDocument.write`, `resolveImageRef` =
  permanece DOM-free). Na via `execute` os apps recebem um `MemoryFileStore`
  efêmero semeado com `request.files` (`sheets/app-data.ts` →
  `runSheetAppData`) e devolvem `emails`/`attachments[{name,contents}]`/
  `files`/`log`; `check-ts`/`check-ss` usam a API de conteúdo
  (`checkTimeSheetContent`/`checkStatusSheetContent`) e o app roda **depois**
  do `schedule`, como no `appMain` do Ruby. English-first: os avisos
  `csv_write_noop` e `xml_document_write_noop` foram traduzidos. **Extensão
  única `.smx`:** mestre aceita `.tjp`/`.smx`, `include` aceita `.tji`/`.smx`
  (`parser/file-extensions.ts`) e sender/receiver/summary **gravam** `.smx`
  (`all.smx`) reconhecendo `.tji`/`all.tji` na leitura (`sheet-extensions.ts` +
  `findSheetFile`); desvio validado da regra zero, registrado no aditamento
  v2.1 do ADR 037 e em notas dos ADRs 026/027/038. Pendente no bloco: só os
  commits (24.2.30/24.2.37).
  **Bloco D (24.3) — flags → request e chamada única.** `src/options.ts`
  traduz `argv` **sem** processo/disco: posicional → `entry`, booleanas do §5.2
  campo a campo, valores com `--flag=valor`, `--` terminador e
  `--silent`/`--no-color` no objeto `renderer` (fora do request); `--config`
  vira `configFile` (ler arquivo é I/O). Flags adiadas (`--freeze*`,
  `--check-time-sheet`/`--check-status-sheet`, `--debug*`) lançam
  `CliUsageError` com rótulo English-first derivado da subfase do `deferred`
  (`phase 24.9`/`phase 24.10`); `resolveExit` projeta `0 | 1` sem inventar
  sucesso. `src/cli.ts` cumpre o fluxo único do §5.1: `parseArgs` →
  `collectInputFiles` (master + fechamento transitivo de `include`s via
  `io.readText`, caminho canônico por `normalizeInputPath`, dedupe/ciclo) →
  **uma** chamada `core.execute(request)` → mensagens/seções → `exit`. A
  descoberta de `include`s é do core (`parser/include-references.ts`:
  `includeKeywords`/`scanIncludeReferences`, comentário fora de string e
  sinônimos i18n de `include` — `incluir`), porque é conhecimento de linguagem
  e não de processo. `buildCommand()` monta a ajuda Cliffy a partir de
  `OPTION_SPECS` (fonte única) com `--help` sem ANSI; o parsing continua no
  `parseArgs` puro. Provas: `tests/options_test.ts` (20 passos),
  `tests/cli_test.ts` (15), `tests/cli.integration_test.ts` (4 subprocessos:
  `mwe001`→0, inválida→1, `.smx`+`include`→0, `--version` sem arquivo) e
  `tests/parser/include-references_test.ts` (7). Pendências: aplicação do YAML
  do `--config` (só aviso `not applied yet`; `Tj3Config` é stub), despacho de
  `reports`/`freeze`/`sheet`/`man` (24.5/24.6) e smoke Bun (binário ausente).
- **Bloco D (24.4) — reporter e resumo do projeto.** `src/reporter.ts`
  reproduz `Message#to_s` do Ruby (`arquivo:linha: Tipo: texto`) com cores por
  severidade e writers injetáveis; a contagem `X errors, Y warnings` sai só
  quando `errors + warnings > 0`. Mensagens vão para **stderr** (como o
  `MessageHandler` e para não corromper o stdout dos relatórios de
  `stdout: true` da 24.5) e o stdout recebe as seções pedidas + o resumo.
  `src/summary.ts` formata identidade, timezone, período, contagens e custo do
  cenário do plano a partir de `lastExecutedProject()` — conveniência nova no
  core (`execution/execute.ts`), reposta a `null` a cada `execute`, com o
  envelope preservado como contrato. `io.ts` ganhou `isTty()` e a cor só liga
  em terminal (`--no-color` sempre respeitado). `--silent` cala info/debug e o
  resumo, mantendo avisos/erros. Provas: `tests/reporter_test.ts` (11),
  `tests/summary_test.ts` (6), `isTty` em `tests/io_test.ts` (3),
  `tests/cli_test.ts` (16, novo contrato de streams) e
  `tests/cli.integration_test.ts` (4 subprocessos, `mwe001` com resumo).
  Pendências: `reports`/`freeze`/`sheet`/`man` (24.5/24.9/24.10) e o commit
  `feat(cli): reporter+summary`.
- **Bloco E (24.5) — política de saída + relatórios ponta a ponta.**
  `src/output-policy.ts` decide **onde** cada conteúdo vai, nunca como o disco
  funciona: ramo terminal (`stdout: true` ou nome `.`) imprime todos os
  formatos na ordem declarada com `--- <name> [<format>] ---` e apara um `\n`
  final; ramo arquivo grava `{name}.{ext}` pela tabela do plano §5.5
  (`markdown→md`, `iCal→ics`, `mspxml`/`niku→xml`, `ctags` sem sufixo) em
  `--output-dir`/cwd, sanitizando o nome (só o último segmento sobrevive,
  `[\\?%*:|"<>]→_`, vazio → `report`) e sobrescrevendo por default. Erro em
  `reports[].errors` ou `ok: false` **aborta sem saída parcial** (nenhum
  arquivo, nenhum asset) e as mensagens passam por `Reporter.error`. Assets do
  HTML (de `assets/css/`, `assets/icons/` e `assets/scripts/wz_tooltip.js`,
  copiados para o `--output-dir` no **mesmo** layout relativo) são copiados só
  quando sai `html` de relatório não-`selfcontained` — o core passou a expor
  `ReportJsonEntry.selfcontained`. Dois bugs de fronteira apareceram na matriz
  e ficaram em `io.ts`: `copyTree` fazia `readdir` em arquivo (nova `isDir()`) e
  `exists()` usava `access()`, que no shim `node:fs` do Deno exige `--allow-sys`
  (`NotCapable: uid`) — reescrita sobre `stat`. `--reports` casa **ids**
  (`report1`…), não nomes, fiel ao `tj3`. Provas: `tests/output_policy_test.ts`
  (22 passos) e `tests/cli.integration_test.ts` (35 passos: MWEs, matrizes de
  erro/scheduler, `include` em 2 níveis, `--no-reports`/`--force-reports`,
  `--reports`/`--list-reports`, idempotência, formato desconhecido, assets);
  suíte do pacote **29 testes / 137 passos**. Divergência **do core** (não da
  CLI): `mwe004` sai 1 com `start date (2024-08-01) of task AcSo.deliveries is
  before the start date (2024-08-01) of the enclosing task` — datas iguais na
  mensagem, comparação por `toSeconds` — registrada como `it.ignore` e
  encaminhada à 1ª onda da Fase 21. Pendente: commit
  `feat(cli): reports-pipeline+output-policy`.
- **Bloco F (24.6) — multi-runtime, binário e README.** `deno task build` produz
  os dois artefatos: `dist/syntaxmesh` (`deno compile`, permissões embutidas) e
  `dist/cli.js` + `dist/package.json` (`scripts/bundle-node.ts` → `deno bundle
  --platform=deno`, shebang node, ESM). O bundle Node roda `mwe001` com todos
  os assets (de `assets/`) porque `dist/` está a três níveis da raiz; o binário
  compilado não os encontra (assets relativos ao módulo) — limitação
  registrada. **Bug real de multi-runtime achado pelo
  bundle:** `node dist/cli.js` morria com `Hour 24 out of range` porque o ICU
  do Node mapeia `hour12: false` para o ciclo h24 (meia-noite = 24) enquanto o
  Deno devolve 0; `timezone.ts` passou a usar `hourCycle: "h23"` (+ `% 24`
  defensivo) com regressão em `tests/time/timezone_test.ts`.
  **Versão única (24.6.6, ADR 040):** `version.ts` segue o template do buildit
  (`__APP_VERSION__` com fallback `""`; a definitiva só existe no bundle,
  montada a partir do `deno.jsonc` da raiz) e o barril do pacote o publica como
  `VERSION`; `AppConfig.version`, `initTj3Config` (que fixava `0.0.0`) e
  `Project.version` derivam daí, e a CLI importa `VERSION` de
  `@vanaware/syntaxmesh` (o service-worker usa o subcaminho `./version`).
  Dentro do core `app-config.ts` importa o **folha**, nunca `./mod.ts`: o barril
  ali fecha ciclo e derruba 4 testes de sheets por TDZ. Goldens `html-xml`/`ical`
  leem a versão do `deno.jsonc` e a neutralizam em `@@VER@@`; o smoke da F17
  interpola `VERSION`; `esbuild.jsonc#versionPaths` aponta para o arquivo real.
  Nenhum teste fixa o número — só a derivação. Medição de tamanho: 605 MB
  default, 349 MB com
  `--node-modules-dir=none`, 114 MB em árvore isolada (o grafo da CLI tem 6
  pacotes npm; o resto é `wrangler`/`workerd`/`sharp` de `packages/server`) e
  `env -i ./dist/syntaxmesh --version` → 0. `packages/cli/README.md` documenta
  uso, flags, destinos, tabela de extensões, política de aborto, permissões por
  runtime e limitações (Deno Deploy sem FS, tamanho do binário, `--config`
  stub, `sheet`/`man`/`--freeze*` pendentes). Provas medidas à mão: o bundle
  roda `node mwe001` com todos os assets e `env -i ./dist/syntaxmesh --version`
  sai 0 sem runtime (o `distribution_test.ts` que automatizava isso foi
  descartado e não está no repo). Suíte do pacote **33 testes / 181 passos** (o
  `version_test.ts` da CLI saiu: `VERSION` agora só é confrontada com a
  derivação, em `packages/core/tests/version_test.ts`). Correção colateral: os
  testes 18.12 voltaram a passar (`checkTimeSheet`/`checkStatusSheet` exigem
  projeto antes do `FileStore`). Pendências: bun ausente (24.6.4) e o commit
  `chore(cli): multi-runtime`.
- **Bloco G (24.7) — golden CLI × tj3.** `scripts/golden/cli-tj3.rb` (oracle
  Ruby) roda o `tj3` 3.8.4 real sobre **34 fixtures** — 8 MWEs, 15
  `Syntax/Correct`, 7 `Errors` e 4 de paridade — e grava
  `packages/cli/tests/golden/cli-tj3.golden.json` (exit, inventário de
  artefatos, `firstMessage`, stdout/stderr residuais e, na paridade, o conteúdo
  dos arquivos). `tests/golden_cli_test.ts` roda a CLI por subprocesso e compara
  exit exato, inventário, **resíduo de stdout** (descontando banner do `tj3` e
  o resumo da CLI), a primeira mensagem de erro com `file:line` nos 7 fixtures
  de erro, 2 CSVs byte-a-byte e 1 HTML por **DOM canônico**
  (`tests/golden/canonical-dom.ts`: estabiliza `ID*`/`Created on`, descarta
  envelope/`head`, tokens ordenados — **163 linhas idênticas** na fixture).
  Subset, critérios e normalizações em `scripts/golden/README.md`; divergências
  aceitas em `known_divergences.md` (D1–D9, sem `it.ignore`). **Quatro correções
  no core só apareceram com o golden:** `Project#schedule()` ganhou o ramo
  terminal de `Project.rb:1225` (projeto em deadlock girava para sempre),
  `checkForLoops` passou de `Array#includes` (referência) para comparação
  **estrutural** (ciclo não detectado ⇒ exit 1 sem mensagem), `Project` passou a
  fixar os formatos default de `Project.rb:89-92` + `projectids` (CSV saía
  `4.33`/`5` onde o `tj3` escreve `4.3`/`5.0`) e o override
  `DurationAttribute#to_s` saiu (achatava `Integer`/`Float`). Também corrigidos
  dois testes pré-existentes: `scanner_test` (o `Scanner` lança `TjError`) e
  `markdown-handlers_14c` (`projectid` default = id do projeto,
  `Project.rb:93`). Goldens `ical`/`html-xml` voltaram a derivar a versão de
  `version.ts` (`PORT_VERSION`) em vez do literal `0.0.0`. CI nova
  (`.github/workflows/ci.yml`) cacheia o golden por hash do `.rb` + fixtures e
  falha se o commitado divergir do oracle. Verificação: `deno task tests` exit 0
  — **808 testes / 6737 passos / 0 falhas**; cobertura de `packages/cli/src`
  92,7 % branch / 95,4 % linha. 23.7.7 (smoke do `template` pela CLI) foi fechada
  aqui. Pendente: commit `test(cli): golden-tj3` (24.7.10).
- **Adendo I/J (24.9/24.10) — freeze e apps de sheet como seções do envelope.**
  `TaskJuggler.freeze()` deixou de estar ancorado e devolve
  `results.freeze.files[] = [{ fileName, contents }]` (`<master>-header.tji` +
  `<master>-bookings.tji`); `--freeze`, `--freeze-by-task` (aceita também a
  grafia do Ruby `--freezebytask`) e `--freezedate` acumulam e só montam
  `request.freeze` no fim, então a ordem não importa — `--freezedate` sozinho
  não liga o freeze (`Tj3.rb` l.86-106). Os cinco apps da F18 viraram
  subcomandos `<proto> <ação>` (`ts send|receive|summary`, `ss send|receive`)
  que preenchem `request.app` + `appOptions`; o `execute` roda sobre o
  `MemoryFileStore` efêmero e devolve `results.sheet`, e a CLI imprime o texto
  e grava `outbox/NNN-<to>.eml` + os arquivos criados (ADR 036/037). Fronteiras
  que ficaram explícitas: `-d/--directory` é a **raiz do chamador**
  (`sheetBaseDir`), nunca `appOptions.workingDir`; `--from <arquivo|->` dos
  receivers é lido pela CLI (novo `readStdin` em `io.ts`) e chega em
  `rawMessage`; `--config` passou a ser parseado (`@std/yaml`) para
  `appOptions.config` nos apps de email; o eco do envelope reduz `files` a
  caminhos (`ExecutionSheetAppOptionsEcho`) e o `execute` consome o request
  original (vazamento de conteúdo corrigido). **24.10.5** já vinha de 24.2.27.
  **24.10.6:** `TaskJuggler.masterFile()` delega a
  `FileList.masterFileWith([".tjp", ".smx"])` (sem varredura duplicada).
  **24.10.8:** `mod.ts` passou a exportar o barril da F13 (`markdown/mod.ts`) e
  `packages/cli/src/images.ts` (`imageRefs`) + `dispatchReports` copiam cada
  imagem relativa para ao lado do relatório — nada é reescrito, `imageDir`
  (default cwd) é a origem, externas e `..` ficam de fora; o TJ3 emite
  `<object data type="image/…">` e não `<img src>`, e o extrator cobre os dois.
  **24.10.9:** golden de CLI com o **mesmo** `header` em dois relatórios prova
  que o default é richtext (`'''forte'''`→`<b>`, `**forte**` literal) e que
  markdown só entra com `format markdown` (o inverso). **Revisão (CodeReview,
  2026-11-08):** `-t/--to` do `ts summary` alimenta **as duas** listas de
  destinatários (`Tj3TsSummary.rb` l.52-57); `-f` é `--force-reports` no `tj3`
  e `--force` nos apps (resolvido depois do subcomando, antes errava
  “requires a sheet app”); `--version`/`--help` saem **antes** do projeto mesmo
  com arquivos (`Tj3AppBase#on_tail`); repetir `--check-time-sheet` é erro de
  uso em vez de reter a última; `imageRefs` recusa caminho absoluto e só
  descarta `..` como **segmento**; o freeze grava artefato vazio (trunca o
  anterior, `File.open(…, 'w')`); `outcome.aborted` ficou monotônico; e
  `assetRoot()` trocou `URL.pathname` por `io.modulePath` (`fileURLToPath`).
  Evidência: `check:all`, `lint` (759 arquivos), `fmt:check` (811),
  `check:stubs` e as suítes verdes — global **819 testes / 6796 passos**,
  pacote CLI **42 testes / 230 passos** (`images_test.ts` novo, 12 passos) e
  integração com 45 passos.
  **24.9.1–24.9.3 — `syntaxmesh man` (fechadas em 2026-11-08).** O `doc-core`
  da F22 não existia, então foi construído junto (ver a entrada da Fase 22
  abaixo) e publicado como `@vanaware/syntaxmesh/doc-core`. A CLI ganhou o
  subcomando `man [<keyword>…]` com `--format text|html|smx` (default `text`);
  os posicionais viram `request.man.keywords` e a política de saída imprime o
  texto ou grava os arquivos do manual sob o `--output-dir` (o
  `css/tjmanual.css` viaja **na própria seção**, então não depende do asset de
  relatórios). `--format` fora do `man` é erro de uso. Divergências conscientes
  do `tj3man`: o recorte de fonte chama-se `smx` (não `tjp`), prefixo que casa
  uma única keyword é resolvido para ela, e a busca do Google na barra de
  letras ficou de fora. Evidência: `packages/core/tests/docgen/man_test.ts`,
  `user-manual_test.ts`, `execute_24_test.ts` (seção `man`) e
  `output_policy_test.ts`/`options_test.ts` (subcomando e `--format`).
  **Verificação final do adendo (2026-11-08):** `deno task test` → **834
  arquivos / 6863 passos / 0 falhas** (97m46s) · `check:all` · `lint` (779
  arquivos) · `fmt:check` (831 arquivos) · `check:doccore` · `check:stubs`, todos
  exit 0.
- **Fase 21 — Compatibilidade e Qualidade 🟨 1ª onda iniciada (2026-11-10)** —
  tarefas **26.22.9/26.22.10/26.22.11 ✅**: `completude-matrix.md` regenerada a
  partir das âncoras do código + Seções C/D consolidando realocações xray e
  pendências F13–F24 hoje só em `CURRENT.md`; cadeia de ADRs **033–037
  reconciliada** (Seção E; 035 segue reservado para a F22; `decisoes/README.md`
  atualizado). **Código âncora pré-F22 endereçado nesta mesma 1ª onda** —
  auditoria e entrega de tudo o que estava ancorado antes da Fase 22 na
  sequência do cronograma (16 → 17 → 18 → 23 → 24 → 21¹):
  - **A1 · `AttributeBase#to_tjp`** (`packages/core/src/attributes/attribute-base.ts`):
    base volta a ser fiel a Ruby (`@type.id + " " + get.to_s`); subclasses
    ricas mantêm overrides próprios. `Ancorado: Fase 12` removido; teste novo
    em `tests/attributes/attribute-base_test.ts`.
  - **A2 · `ResourceScenario#query_fte`** (`packages/core/src/model/resource-scenario.ts`):
    porta `ResourceScenario.rb:403-423` — containers recursam em `kids`,
    folhas usam `workSlots / globalWorkSlots × efficiency`; helper privado
    `getWorkSlots(startIdx, endIdx)` conta slots livres + alocados a `Task`.
    `projExt()` estendido. Verificado em `tests/logic/query-resources_14c_test.ts`.
  - **A5 · dispatch `report.ts`** (`packages/core/src/model/report.ts`): os
    conteúdos `timesheet`/`statussheet` já têm `registerContentFactory`
    (F18); a branch "Ancorado: Fase 18" era código morto. Substituída por
    `Error("Known report type ... no registered content factory")` como
    sentinela de inconsistência interna. `EXTENSION_TYPE_BLOCKS` segue
    cobrindo extensões 14-C não registradas (A4). Teste atualizado em
    `tests/model/report-generate_test.ts`.
  - **D9 · F14-C §13.7 · carga contábil de `booking charge`**
    (`packages/core/src/model/account-scenario.ts`): novo método privado
    `addChargeBookings(task, project, startIdx, endIdx)` chamado no ramo
    `aggregate === "charges" | "tasks"` de `turnover`; resolve conta via
    `resolveAccount` (regra 3 chargeset da tarefa · regra 4 `defaultaccount`),
    respeita janela `[start, end)`, trata estornos (amount negativo),
    verifica pertence (self ou child-of), emite `CostEvent` `task_charge`/
    `actual` idempotente via `Task#chargeBookingEmitted`/
    `markChargeBookingEmitted`. Bucket acumulado só pelo Block I (evita
    dupla contagem). Suite nova em
    `tests/model/account-scenario-charge-booking_test.ts` (6 passos).
  - **A6 (`FUNCTIONS_EXT` · `isoncriticalpath`, `istaskstatus`) e D5
    (`--config` 24.3.11)** permanecem ancorados: A6 é trabalho real das
    Fases 14/18 ainda não abertas (slack/float inexistente no Ruby 3.8.4 ·
    enum derived status de tracking); D5 exige reabrir F24 ad-hoc, o que
    violaria a ordem do cronograma. Comentários no código atualizados
    apontando para matriz §B/A6 e §D/D5.
  **Update 2ª rodada da 1ª onda (2026-11-10, mesma data):**
  - **A6 · `istaskstatus` liberado** (`packages/core/src/logic/logical-function.ts`):
    `FUNCTIONS_EXT.istaskstatus` saiu de `blocked` para `feasible`. Nova
    instância privada `istaskstatus(expr)` chama `Task#scenarioData(scIdx)`
    → `TaskScenario#calcStatus()` (já fiel a `TaskScenario.rb:2477-2496`
    desde a F5) e compara contra o argumento `$ID` normalizado
    (`toLowerCase() + strip [^a-z0-9]`): aceita `not_started`, `notstarted`,
    `Not Started`, `NOT-STARTED` contra `not started`/`not reached`/`in
    progress`/`done`/`unknown`. `isoncriticalpath` continua `blocked`
    (permanente — slack/float inexistente mesmo no Ruby 3.8.4). Suite nova
    com 8 passos em
    `packages/core/tests/logic/logical-function-complemento_test.ts`.
  - **D5 · aplicação de `--config` YAML** (F24 24.3.11): novo módulo
    `packages/core/src/runtime-config.ts` porta `RuntimeConfig.rb` —
    `sectionNode(config, "global.log")` caminha chaves prefixadas com `_`,
    `configureFromSection(target, config, section)` copia apenas chaves já
    existentes no target (Ruby `instance_variables.each`) e converte `Date`
    → `YYYY-MM-DD`. `ExecutionRequest.configObject?: ConfigTree` propaga o
    YAML parseado da CLI até `executeRequest` (aplicado logo após
    `handler.reset()`, espelhando `Tj3Daemon#initialize`). `applyConfig`
    em `packages/cli/src/cli.ts` deixa de emitir o `Warning: ... not
    applied yet` e passa a preencher `request.configObject`; o branch
    sheet-app (SMTP) continua entregando em `appOptions.config`. Testes:
    `packages/core/tests/runtime-config_test.ts` (14 passos cobrindo
    `sectionNode`/`configureFromSection`/integração com
    `MessageHandlerInstance`) e assertion reescrita em
    `packages/cli/tests/cli_test.ts::--config aplica _global / _global._log`.
    README do CLI atualizado (linha `--config` + limitações conhecidas).
  - **Fix gate não-planejado**: `packages/blog/src/cli.ts:96-105` tinha 5×
    `TS18048 'post' is possibly 'undefined'` sob `noUncheckedIndexedAccess`
    (pré-existente em HEAD, travava `deno task check:all`). Loop indexado
    `for (let i = 0; i < posts.length; i++)` trocado por
    `for (const [i, post] of posts.entries())` — `post` agora é `BatchPost`
    em vez de `BatchPost | undefined`.
  **Contagem de âncoras vivas:** 6 → 2 (A3 · CSVFile.read F19; A4 ·
  EXTENSION_TYPE_BLOCKS sentinela). `isoncriticalpath` é a única
  extensão `blocked` restante e é permanente (sem slack/float no Ruby
  3.8.4). Gates desta sessão: `check:stubs` OK · `gaps:audit` OK ·
  `deno task tests` full + goldens (ver §Verificações abaixo).
  **Demais tarefas da 1ª onda** (26.0–26.14, 26.26–26.28) continuam em
  aberto — corpus, runners e2e, AST-equivalence ampliada, snapshots,
  benchmarks, segurança, CSP, `known-divergences` e matriz de cobertura
  #1–#6a. **Fase 22:** P1/P2 já executados antecipadamente com autorização
  do usuário (2026-11-11 — `doc-core` fechado em 106/108 + `lsp-core` puro);
  o restante da Fase 22 (P3 em diante) segue após a 1ª onda da 21.
- **Phase 22 — VS Code extension** `PAR` — **P1 (22.0) accepted 2026-11-11:
  ADR 035** (`decisoes/035-extensao-vscode.md`) created and indexed; baseline
  and layer boundaries recorded (Bloco A in the task document). **P2 completed
  2026-11-11** (shared language/documentation cores): subphase 22.1b closed at
  **106/108 verified** (H 6.9/6.10 outside v1) and the pure `lsp-core` (22.1)
  delivered — 13 service modules + `registerLspServer` over a structural
  connection, coverage **96.6% lines**. Kickoff of P1/P2 was
  **user-authorized early** while F21¹ wave 1 is still partial (26.0–26.14/
  26.26–26.28 open) — no technical dependency; official order unchanged
  (precedent: early `doc-core` delivery for F24). **P3 completed 2026-11-12**
  (editor foundation): shell 22.2 (scaffold + manifest + config + dual
  entries `extension.node.ts`/`extension.web.ts`), grammar 22.3 (TextMate/
  tji/language-config/snippets generators + 4 JSON assets + deterministic
  goldens), transport 22.4 (pure adapter/options/debounce + node/web server
  & client bootstraps + `deno bundle` build of 4 artifacts, Web bundles
  `node:`-free + full-session wiring smoke). Pure-logic coverage **99.2%
  lines**; full gate `deno task tests` EXIT=0 — **853 passed (7078 steps),
  0 failed**. Enabling core fix: `template-engine.ts` now constructs Vento
  from the browser-safe `Environment` + memory loader (no `node:` leak into
  the Web bundle; 12 template tests green). VS Code Test Runner + `.vsix`
  smoke deferred to P7 (no VS Code in this environment). Next block: P4
  (execution/reports/UX).
  [Plan: major blocks P1–P7](docs/syntaxmesh/fases/fase-22-vscode-extension.md#0-major-blocks-and-subblocks)
  and [original task owners](docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md).
  Planning update (2026-11-11): P1 architecture; P2 shared language/docs cores;
  P3 editor/LSP; P4 execution/reports/UX; P5 Web/storage; P6 standalone LSP;
  P7 packaging/acceptance/handoff. Each block has subblocks and entry/exit
  criteria. Original IDs and delivery records are preserved; 22.1b has
  atomic detail (C–J); 22.0 detailed as Bloco A.
  Other unfinished subphases are detailed at kickoff.
  After F21¹, before F21² and phases 19/20; v1 output remains English.
  **Entregue:** o `doc-core` (subfase 22.1b) com `TernarySearchTree`,
  `SyntaxReference`, `KeywordDocumentation`, `ExampleSnippet` (`TjpExample`),
  `UserManual` + capítulos em inglês, `ansi` e a fachada `generateMan`, em
  `packages/core/src/docgen/`, exportado como `./doc-core` (subpath) e **não**
  pelo `mod.ts` raiz. Gate de pureza próprio: `deno task check:doccore`
  (nenhum `Deno.*`/`node:`/`process.*`), dentro do composite `deno task tests`.
  Consumidores: CLI da F24 (24.9 ✅) e o `lsp-core` da própria 22 (✅ P2).
  O doc-core **não escreve em disco**: devolve
  `string`/`Record<nome, conteúdo>`. **Entregue no P2 (2026-11-11):** goldens
  Ruby (TST 1.11, syntax-reference 2.14/2.15, keyword 3.22 — projeção do
  subset reescrito), `checkKeyword`/`stderrLines` (2.11), `toMarkdown` (3.21),
  bloco H `SyntaxCore` (6.1–6.8, dados de highlight Kate/Vim; geradores
  `.xml`/`.vim` seguem cancelados), projeções do manual G 5.13/5.14
  (`getManualToc`/`getManualPage`), pontes `lsp-core` I 7.5–7.7 + smoke 7.9,
  serviços puros 22.1.5–22.1.16 (`DocumentStore` incremental, locale, analyze,
  diagnostics, capabilities, hover, completion, navigation, semantic tokens,
  symbols, `registerLspServer` + smoke sem VS Code) e verificação J completa
  (golden determinístico e byte-idêntico, confronto `tj3man` real em
  `xray.md` §1.7.1, cobertura docgen **97,0% linhas**, gate completo verde).
  Evidência por tarefa atômica em `fase-22-vscode-extension-tarefas.md`
  §Progresso/P2 evidence. **Próximo:** P3 (editor/LSP — shell da extensão).
- Fase 15 — Gantt ✅ Concluída (2026-11-03)
- Fase 16 — Apoio ✅ Concluída (2026-11-03, 16.0–16.20; escopo xray: 16.10
  cancelado; 16.9/16.14/16.15 movidos p/ a 22; dono de `query_dashboard`).
  Adendo **16.21** ✅ (2026-11-12): Journal aceita `Material`/`Account` como
  folha nos modos `status_*`/`alerts_*` + `pictures`/`format` propagados no RTI
  (corpo por `format` via `MarkdownFactory`/MediaWiki; `inputText` preservado);
  `journal-addendum-1621_test.ts` (16 steps) + suíte 843/7039/0.
- Fase 17 — HTML/XML ✅ Concluída (2026-11-04, 17.0–17.17; ADR 038 —
  substituição dos 5 mínimos; goldens html-xml+ical; smoke F17)
- Fase 18 — Time/Status Sheets ✅ Concluída (2026-11-05, 18.0–18.20 + adendos)
  — `TimeSheetRecord`/`TimeSheet`/`TimeSheets`; `SheetHandlerBase`+sender/receiver;
  5 apps de sheet em texto-de-email (ADR 036) com `FileStore` injetado
  (ADR 037); `Project#generateReport(…, dynamicAttributes)` com backup→parse→
  `interactive`→gerar→restore (18.19); `MessageHandler#checkLevel` (18.20);
  goldens `timesheets` (22 casos) e `dynamic-attributes` (6).
- Fase 23 — Template (Vento) ✅ Concluída (2026-11-06, 23.0–23.8) — elemento
  TS-only `template` (ADR 033): declaração com corpo cru + params, namespace
  único com macros, expansão em duas fases no `expandMacro`, argumentos
  nomeados tipados, proteções (recursão/profundidade/ordem) e contexto de
  composição; macros da Fase 10 **intocadas**; referência em
  `docs/syntaxmesh/11-referencia-template.md`.
- Fase 19 — Storage ⬜ Não iniciada (por último, após a 21²)
- Fase 20 — PWA + UI ⬜ Não iniciada (antes da 21³)

## Arquivos de tarefas atômicas (TDD)

Cada fase tem um arquivo de tarefas atômicas separado:

- `docs/syntaxmesh/fases/fase-N-descricao-tarefas.md` — tarefas atômicas com testes unitários
- `docs/syntaxmesh/fases/fase-N-descricao.md` — plano da funcionalidade

## Decisões arquitetônicas (ADR)

Todas as decisões arquitetônicas importantes estão documentadas em `docs/syntaxmesh/decisoes/` (ADRs 001–041). Consulte `docs/syntaxmesh/decisoes/README.md` para a lista completa. Cadeia criada pela ordem oficial de execução: **034 = CLI (Fase 24), 035 = extensão VS Code (Fase 22, aceito 2026-11-11)**; reservados em 2026-11-03 pela varredura xray e já entregues: **036 = sheets sem SMTP (email → texto), Fase 18** e **037 = injeção de provedor de conteúdo/`FileStore`, Fases 18/24**. **029** (Journal/AlertLevel) pertence à Fase 16 e foi entregue em `decisoes/029-journal-alertlevel.md` (16.0); **033** (elemento `template`) foi entregue em `decisoes/033-elemento-template.md` (Fase 23, 23.0); **038** (XML/HTML/ical/painter) na F17 e **039** (`extend` tipo `markdown`) na F10 Complemento. Nunca renumerar ADRs já commitados; a cadeia 034–037 é reconciliada na Fase 21 (conferir o README antes de criar).

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

Execute `deno task tests` para validação completa (o nome `check-all` **não** existe —
a task de type check é `check:all`):

- `deno task check:all` (type check por pacote + `scripts/**/*.ts`)
- `deno task lint` (lint)
- `deno task fmt:check` (formatação)
- `deno task lint:doc:all` (`deno doc --lint` da API pública, em **ratchet** —
  ADR 041). Cada membro define `lint:doc` apontando as entradas do seu mapa
  `exports`; `scripts/lint-doc.ts` compara a contagem por diagnóstico com o teto
  de `scripts/lint-doc-baseline.json` e falha **acima** dele. Resultado de
  2026-11-08: `server`/`ui`/`service-worker` em **zero**, `cli` em 6 (5
  `private-type-ref` + o `missing-return-type` do `buildCommand`, cujo retorno é
  o encadeamento do Cliffy) e `core` em 1698 (1548
  `missing-jsdoc` + 107 `private-type-ref` + 37 `missing-explicit-type` + 6
  `missing-return-type`). Símbolo público novo sem JSDoc estoura o teto; dívida
  paga desce livre e o job sugere `deno task lint:doc:update:all` para apertar.
  Entrada que não existe/erro de tipo **sempre** falha (foi assim que os
  `exports` mortos de `service-worker` apareceram).
- `deno task test` (testes)
- fora do composite: só `deno task gaps:audit` (matriz de completude, relatório) e
  `deno task lint:doc:update:all` (reescreve o teto do ADR 041 — não é check)

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
