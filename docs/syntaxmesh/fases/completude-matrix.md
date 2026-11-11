# Matriz de Completude — Fases 2–24

> **Arquivo:** `docs/syntaxmesh/fases/completude-matrix.md`
> **Origem:** Fase 11-Gaps (Bloco A.4 / Bloco G.3); **regenerada na 1ª onda da
> Fase 21** (tarefa 26.22.9 — decisão 2026-11-03, `docs/syntaxmesh/xray.md`
> §5.5).
> **Atual:** 2026-11-10 (Fase 21, 1ª onda)
>
> Esta matriz é a **fonte única** do status de cada gap do port. Consolida:
> (a) o inventário histórico G1–G21 das Fases 2–12, agora com estados revisados
> contra o código; (b) as **âncoras vivas** em `packages/core/src/**` que o
> `scripts/check-stubs.ts` varre (seção B); (c) as **realocações** da varredura
> xray 2026-11-03 (seção C); (d) as **pendências atuais** das Fases 13–24 que
> só viviam em `CURRENT.md` (seção D); (e) a **reconciliação da cadeia de ADRs
> 033–041** (seção E, tarefa 26.22.11).
>
> O gate `deno task gaps:audit` continua lendo apenas as linhas `| G<n> |` da
> seção A — as demais seções são documentais.

## Legenda

| Status | Significado |
|---|---|
| `fechado` | Gap diagnosticado e corrigido nesta fase, com testes que provam. |
| `verificado` | Entrega confirmada por teste novo (fase dona já tinha entregado). |
| `ancorado` | Stub `NotYetImplementedError` com `// Ancorado: Fase N — razão`; a fase N é dona da entrega futura. |
| `sweep concluído` | Teste deferido da Fase 12 reabilitado e verde. |
| `pendente` | Ainda não endereçado — o gate falha. |

---

## Seção A — Inventário histórico G1–G21 (Fases 2–12)

Revisado contra o código em 2026-11-10. Mudanças em relação à matriz anterior
(2026-10-28): G7 e G11 viram `verificado` (F24 entregou); G8 vira `verificado`
(F14-C C9 entregou `defaultAccount`); G9 vira `entregue` na 2ª rodada desta
1ª onda (F21 2026-11-10: sheets F18 já verdes + `istaskstatus` liberado —
`query_fte` F21/A2 cobre a parte de `FUNCTIONS_EXT` restante); G12
reavaliado — 42 `query_*` em F14-C Onda B, `query_fte` entregue F21/A2.

| ID | Descrição | Fase dona | Ação | Status | Teste |
|---|---|---|---|---|---|
| G1  | Placement de datas em `Project.schedule()` — `end` `null` em modelo mínimo | 7 | Fechar (P0) | fechado — 4 chained bugs (PropertyList items, doneEffort reading `_doneEffort`, propagateDate stub, Xref/checkDependency task resolve) + markAsMilestone guards + chargeset each + project vacation→Leave corrigidos | `tests/integration/logical-scheduler-driven_test.ts` (3 steps) · `tests/integration/parser-scheduler_e2e_test.ts` (22 steps) · `tests/invariants/scheduler_invariants_test.ts` (4 steps) |
| G2  | `logical-scheduler-driven_test.ts` relaxado (§6.11) | 7 | Fechar (reapertar) | fechado — metade 1 e 2 passam com asserções fortes | `tests/integration/logical-scheduler-driven_test.ts` |
| G3  | Golden tests do scheduler não comparam `start`/`end`/`effort` | 7/21 | Fechar (regenerar) | fechado — e2e sobre 9 MWEs + hardcoded tj3 dates no mwe004 (milestones + containers) cobrem o mesmo papel do golden Ruby; golden .rb + .json completo **entregue na F24 Bloco G (24.7, `cli-tj3.golden.json`, 34 fixtures)**; `test:golden:scheduler` continua como shim | `packages/cli/tests/golden_cli_test.ts` · `tests/integration/parser-scheduler_e2e_test.ts` (mwe004 tj3 dates) |
| G4  | Testes end-to-end parser → schedule → report ausentes | 7/9/10 | Fechar | fechado — 22 casos cobrindo os 9 MWEs en + mwe001 pt-BR/es + milestones específicos | `tests/integration/parser-scheduler_e2e_test.ts` |
| G5  | `to_rti` × 5 stubs (`attribute-base`, `reference-attribute`, `resource-list-attribute`, `query.ts`, `project-file-parser`) | 14 (era 12/12.18) | Verificar entrega | verificado — 4 dos 5 stubs entregues na F14; `attribute-base.to_tjp` entregue na F21 1ª onda (2026-11-10, seção B A1 removida): a base agora é fiel a Ruby (`@type.id + " " + get.to_s`); subclasses ricas mantêm os overrides próprios | `packages/core/tests/attributes/attribute-base_test.ts` |
| G6  | `isoncriticalpath` — stub (não existe slack/float no Ruby) | 14 | Ancorar em 14 | ancorado — `FUNCTIONS_EXT` entry `isoncriticalpath → [1, "14", "blocked"]` | `scripts/check-stubs.ts` |
| G7  | `TaskJuggler#freeze` — stub (escreve arquivo) | 14 → **24** | Verificar entrega | verificado — F24 Adendo I (24.9.1–24.9.3) entrega `results.freeze.files[]` via envelope `execute`; CLI expõe `--freeze*`; âncora removida do core | `packages/cli/tests/golden_cli_test.ts` · `packages/core/tests/execute_24_test.ts` |
| G8  | `project.defaultAccount` — regra 4 do `resolveAccount` é no-op | 8.2 → **14-C** | Verificar entrega | verificado — F14-C C9 (2026-11-01) implementa `defaultaccount` + variantes `material/resource/charge`; `Project#defaultAccountFor` resolve; `accounting/attribution.ts` consome via `line.project?.defaultAccountFor?.(…)` | `packages/core/tests/reports/default-account_14c_test.ts` |
| G9  | `checkTimeSheet`/`checkStatusSheet`/`istaskstatus` — stubs (sheets) | 18 | Ancorar em 18 | entregue (parcialmente ancorado ainda) — `checkTimeSheet`/`checkStatusSheet` e 5 apps de sheet **entregues na F18 (18.0–18.20 + ADR 036/037)**; `istaskstatus` **liberado na F21 1ª onda 2ª rodada (2026-11-10, ver seção B/Entregues e A6)**, lendo o `_status` já derivado por `TaskScenario#calcStatus` (fiel a `TaskScenario.rb:2477-2496` desde a F5) | `packages/core/tests/logic/logical-function-complemento_test.ts` (8 steps istaskstatus) · `scripts/check-stubs.ts` · `packages/core/tests/sheets/` |
| G10 | `hasalert`/`LogicalFlag` (ramo Journal)/leave-allowance — stubs | 16 | Verificar entrega | verificado — F16 16.18 entrega `LogicalFlag` ramo Journal + `hasalert` real (2026-11-03) | `packages/core/tests/logic/` · smoke `smoke_after_phase_16_test.ts` |
| G11 | `TaskJuggler#parse`/`parseFile`/`parseContent` — stubs (transporte de arquivo) | 19 → **24** | Verificar entrega | verificado — ADR 034 des-ancora: F24 injeta conteúdo por `FileContentProvider`; core não lê disco; `parse/parseFile/parseContent` viram entrada por parâmetro | `packages/cli/tests/cli.integration_test.ts` · `packages/core/tests/execute_24_test.ts` |
| G12 | `query_*` concretos de `TaskScenario`/`ResourceScenario` | 7/8/14/18 | Verificar viáveis + ancorar | verificado — F14-C Onda B entrega 42 `query_*` (Task/Resource/PTN); `query_fte` entregue na F21 1ª onda (2026-11-10, seção B A2 removida) fiel a Ruby `ResourceScenario.rb:403-423` | `packages/core/tests/logic/query-resources_14c_test.ts` · `packages/core/tests/logic/query-{tasks,ptn}_14c_test.ts` |
| G13 | Blocos C0–C4 do Complemento Fase 10 (material, picture, format, timebasis, breakdownreport, rdoreport) | 10 | Verificar entregue | verificado — suite `parser` + `ast-equivalence-complemento_test.ts` + `timebasis-parity_golden_test.ts` cobrem os blocos | `tests/ast-equivalence-complemento_test.ts` · `tests/golden/timebasis-parity_golden_test.ts` |
| G14 | Migração `MockProject → Project` (§9.10 Fase 9) | 9 | Verificar 100% | verificado — nenhum `MockProject` em `packages/core/src` | `tests/integration/gaps_verification_test.ts` (step G14) |
| G15 | Contas não exclusivas + buckets + `CostEvent` + chargesets + plan×actual end-to-end | 8/8.1/8.2 | Verificar end-to-end | verificado — suíte `tests/finance/*` + `tests/golden/finance_golden_test.ts` cobrem mwe004 + variações; chargeset-`each` fix em `preScheduleCheck` destravou mwe004 | `tests/golden/finance_golden_test.ts` · `tests/integration/parser-scheduler_e2e_test.ts` (mwe004) |
| G16 | Motor lógico + Query + AST equivalence (3 idiomas) da Fase 11 | 11 | Verificar completo | verificado — suíte `tests/logic/*` + `tests/query/*` + `tests/ast-equivalence_test.ts` (27 fixtures) + sanity em `gaps_verification_test.ts` | `tests/integration/gaps_verification_test.ts` (step G16) |
| G17 | `ScenarioData#error/warning/info` roteiam para `MessageHandlerInstance` | 9 | Verificar com teste | verificado — método `error()` em `scenario-data.ts:92` delega para `MessageHandlerInstance.instance.error()` | `tests/integration/gaps_verification_test.ts` (step G17) |
| G18 | `TaskJuggler#errors` reflete `MessageHandlerInstance.errors` | 9 | Verificar com teste | verificado — getter em `taskjuggler.ts:110` espelha direto | `tests/integration/gaps_verification_test.ts` (step G18) |
| G19 | Atributos pré-carregados via ADR 016 em `*Scenario` (Fase 5) | 5 | Verificar end-to-end | verificado — `preloadAttributes` roda no construtor de cada `*Scenario`; bag exposto via `getAttributes()` | `tests/integration/gaps_verification_test.ts` (step G19) |
| G20 | `backupAttributes`/`restoreAttributes` (Fase 4) funcionam | 4 | Verificar com teste | verificado — pair opera como shallow-copy fiel do Ruby (estrutura preservada, valores via `AttributeBase.set`) | `tests/integration/gaps_verification_test.ts` (step G20) |
| G21 | Testes da Fase 12 marcados `ignore: true` por depender de G1–G4 | 12 | Sweep: reabilitar | sweep concluído — nenhum teste com tag `// Gate: fase-11-logical-gaps` em `packages/core/tests/` | `scripts/gaps/deferred.ts` |

---

## Seção B — Âncoras vivas no código (Fases 13–20)

Fonte: `grep 'Ancorado: Fase' packages/core/src/**` — mesma lista que
`scripts/check-stubs.ts` varre (regenerada em 2026-11-10 após a limpeza da 1ª
onda).

| ID | Arquivo:linha | `// Ancorado: Fase N — razão` | Dono atual | Comentário |
|---|---|---|---|---|
| A3 | `packages/core/src/reports/csv-file.ts:92` (`CSVFile.read`) | Fase **19** — leitura depende do `FileStore` (workerdb) | 19 (Storage) | Escopo canônico da F19. |
| A4 | `packages/core/src/model/report.ts:281` (`EXTENSION_TYPE_BLOCKS` dispatch) | Fase **14C** — conteúdo de extensão não registrado | 14-C | Dinâmico por `block.id`. Hoje nenhum `EXTENSION_TYPE_BLOCKS` entry cai aqui (todos registrados); fica como sentinela para extensões futuras. |
| A6 | `packages/core/src/logic/logical-function.ts` (`FUNCTIONS_EXT` entry `isoncriticalpath`) | Fase **14** (permanente) | 14 | `isoncriticalpath` segue `blocked` — slack/float inexistente mesmo no Ruby 3.8.4, sem consumidores no port. `istaskstatus` foi **liberado nesta 1ª onda (2026-11-10, 2ª rodada)** — ver "Entregues" abaixo. |

**Entregues nesta 1ª onda (2026-11-10)** — linhas removidas da seção:

- **A1** — `attribute-base.to_tjp`: base fiel a Ruby (`@type.id + " " +
  get.to_s`); subclasses ricas mantêm os overrides próprios. Verificado por
  `tests/attributes/attribute-base_test.ts` (novo passo `to_tjp retorna '<id>
  <valor>'`).
- **A2** — `ResourceScenario#query_fte`: porta fiel de
  `ResourceScenario.rb:403-423` (`workSlots / globalWorkSlots × efficiency`;
  containers acumulam filhos). Verificado por
  `tests/logic/query-resources_14c_test.ts`.
- **A5** — `report.ts` dispatch: os conteúdos `timesheet`/`statussheet` já
  têm `registerContentFactory` (F18); a branch "Ancorado: Fase 18" era código
  morto. Removida; substituída por `Error("Known report type ... no
  registered content factory")` como sentinela de inconsistência interna.
  Verificado por `tests/model/report-generate_test.ts`.
- **A6 (parcial · `istaskstatus` liberado)** — 2ª rodada da 1ª onda, mesma
  data (2026-11-10). `FUNCTIONS_EXT.istaskstatus` saiu de `blocked` para
  `feasible`; novo método privado `LogicalFunction#istaskstatus(expr)` resolve
  o id, exige `instanceof Task`, chama `TaskScenario#calcStatus()` (já fiel
  a `TaskScenario.rb:2477-2496` desde a F5) e compara contra o argumento
  `$ID` normalizado — `not_started`, `notstarted`, `Not Started` e
  `NOT-STARTED` colapsam para o mesmo alvo (`not started`). Suíte com 8
  passos em
  `packages/core/tests/logic/logical-function-complemento_test.ts`.
  `isoncriticalpath` continua `blocked` (permanente).
- **D5 (`--config` 24.3.11 aplicado)** — 2ª rodada da 1ª onda (2026-11-10).
  Novo módulo `packages/core/src/runtime-config.ts` porta `RuntimeConfig.rb`
  (`sectionNode` caminha seções `_`-prefixadas; `configureFromSection`
  copia apenas chaves existentes e converter `Date` → `YYYY-MM-DD`).
  `ExecutionRequest.configObject` propaga o YAML parseado até
  `executeRequest`, que aplica `_global` e `_global._log` em
  `MessageHandlerInstance` **após** `handler.reset()` (Ruby
  `Tj3Daemon#initialize`). CLI `applyConfig` deixa de emitir o `Warning:
  ... not applied yet`; sheet apps SMTP seguem recebendo via
  `appOptions.config`. Testes novos em
  `packages/core/tests/runtime-config_test.ts` (14 passos) e assertion
  reescrita em `packages/cli/tests/cli_test.ts::--config`. README da
  CLI atualizado (linha `--config` + limitações conhecidas).

**Contagem atual:** 2 âncoras fixas (A3 · CSVFile.read F19; A4 · sentinela
EXTENSION_TYPE_BLOCKS) + 1 `blocked` permanente em A6 (`isoncriticalpath`).
`check:stubs` OK.

---

## Seção C — Realocações da varredura xray (2026-11-03)

Cada linha registra o que saiu do escopo de uma fase e para onde foi. Não são
gaps — são decisões de escopo já propagadas.

| ID | Origem | Destino | Status |
|---|---|---|---|
| C1 | 16.10 `AlgorithmDiff` | **CANCELADO** (DEAD no upstream TJ 3.8.4) | ok — registrado em `fase-16-apoio-tarefas.md` |
| C2 | 16.9 `TernarySearchTree` | F22 `doc-core` | **entregue** — 2026-11-08 (Bloco C F22) |
| C3 | 16.14/16.15 `KateSyntax`/`VimSyntax` (highlight core) | F22 `doc-core` Bloco H | **pendente** — F22 Bloco H (`SyntaxCore` de highlight) ainda não aberto |
| C4 | 16.7 `FileList` + 16.11 `StdIoWrapper` + 16.12 `UTF8String` | Core (F16) com consumidores F18/F24 | **entregue** — F16 2026-11-03; consumidores ligados em F18 (2026-11-05) e F24 (2026-11-08, 24.10.6 `masterFile`) |
| C5 | 16.17 `Resource#query_dashboard` + 7 consultas de licença | **dono único F16** (was F15) | **entregue** — âncora re-citada em `resource.ts:93-95` |
| C6 | 18.18 apps de sheet (núcleo `Tj3SheetAppBase`) | F18 | **entregue** — 18.18 (2026-11-05) + F24 Bloco J empacota como subcomandos (24.10.1–24.10.4) |
| C7 | 18.19 `dynamicAttributes`/`parseReportAttributes` | F18 | **entregue** — 18.19 (2026-11-05); CLI `--report --attr` em 24.10.5 |
| C8 | 18.20 `MessageHandler#checkLevel` | F18 | **entregue** — 18.20 (2026-11-05) |
| C9 | 22.1b `doc-core` inteiro | F22 | **parcialmente entregue** — Blocos C–G fechados em 2026-11-08 (Bloco H Kate/Vim + pontes `lsp-core` 7.5–7.7 + goldens Ruby 1.11/2.14/2.15/3.22 seguem pendentes) |
| C10 | 24.9 `syntaxmesh man` (consome `doc-core`) | F24 | **entregue** — 24.9.1–24.9.3 (2026-11-08) |
| C11 | 24.10 apps de sheet/freeze/`--report --attr`/`FileList`/`StdIoWrapper`/imagens 13.14.3/regressão `format richtext` | F24 | **entregue** — Bloco J 24.10.1–24.10.9 (2026-11-08) |
| C12 | 13.14.3 imagens (OPFS/blob na PWA) | F24 ✅ + F19 (PWA) | F24 24.10.8 **entregue** (2026-11-08); F19 OPFS pendente |
| C13 | 13.14.4 `format richtext` em reports | F14-C | **entregue** — `14C.5.1–5.12` (2026-11-01) |
| C14 | Gap §5.4 `Project#generateReports` → `DataCache.flush()` | Core | **resolvido** — chamada restaurada fiel a `Project.rb:774`; comentário `// stub` removido |
| C15 | Gap §5.3 ADR 029 duplicado | Journal/AlertLevel=F16 (arquivo `029-journal-alertlevel.md`); sheets=F22 reserva atual **036**; provedor de conteúdo=**037** | **resolvido** — ver seção E |

---

## Seção D — Pendências atuais F13–F24 (extraídas de CURRENT.md + docs da CLI)

| ID | Fase | Pendência | Evidência |
|---|---|---|---|
| D1 | F22 Bloco H | `SyntaxCore` de highlight Kate/Vim (dados, não `.xml`/`.vim` finais) | `fase-22-vscode-extension-tarefas.md` §Progresso (Bloco H em aberto) |
| D2 | F22 | Pontes `lsp-core` 7.5–7.7 (subfase 22.1b) | idem |
| D3 | F22 | Goldens Ruby 1.11 / 2.14 / 2.15 / 3.22 (oracle do `doc-core`) | idem |
| D4 | F22 | Extensão VS Code em si (Blocos 22.0 / 22.1 não-1b / 22.2–22.11) — kickoff não aberto | `fase-22-vscode-extension.md` |
| D5 | F24 | **entregue nesta 1ª onda (2026-11-10, 2ª rodada)** — `--config` YAML é lido e **aplicado**: `_global`/`_global._log` chegam a `MessageHandlerInstance` via `RuntimeConfig`-port compartilhado; sheet apps SMTP preservam `appOptions.config` | `packages/core/src/runtime-config.ts` · `packages/core/src/execution/execute.ts` (apply após `handler.reset()`) · `packages/cli/src/cli.ts::applyConfig` · `packages/core/tests/runtime-config_test.ts` · `packages/cli/tests/cli_test.ts::--config` |
| D6 | F24 | Flags `--debug`/`--debuglevel`/`--debugmodules`: "no equivalent in the port" | `packages/cli/src/options.ts` l.147-151 (`DEFERRED_REASONS`) — decisão English-first; sem fase dona |
| D7 | F24 | Smoke Bun (24.6.4): binário ausente no ambiente | CURRENT.md F24 Bloco F |
| D8 | F24 | Commits pendentes dos blocos: 24.2.30/24.2.37 (FileStore retro-fit), 24.4 (reporter+summary), 24.5 (reports-pipeline+output-policy), 24.6 (multi-runtime), 24.7.10 (golden-tj3) | CURRENT.md F24 |
| D9 | F14-C §13.7 (residual) | **entregue nesta 1ª onda (2026-11-10)** — `AccountScenario#addChargeBookings` consome `task.chargeBookings` e emite `CostEvent` `task_charge/actual` idempotente; regra 3 (chargeset da tarefa) e regra 4 (`defaultaccount`) do `resolveAccount` efetivas | `packages/core/src/model/account-scenario.ts` · `packages/core/tests/model/account-scenario-charge-booking_test.ts` (6 steps) |
| D10 | F21 (esta onda) | Subfases 26.0–26.14 restantes nesta 1ª onda (corpus, runners, comparator, goldens e2e, AST-equivalence ampliada, snapshots, benchmarks, segurança) | `fase-21-compatibilidade-qualidade-tarefas.md` §Progresso |

**Ação desta tarefa (26.22.9/26.22.10):** a matriz passa a ser a **fonte única**;
D1–D4 listam a F22 que **abre logo após a 21¹**; D5 foi **endereçada nesta
1ª onda** (`--config` aplicado via `RuntimeConfig`-port compartilhado,
ver seção B/Entregues); D6–D8 listam pendências residuais da F24
(nenhuma bloqueia a 21¹); D9 foi **endereço nesta 1ª onda** (carga contábil
do `booking charge` consumida em `AccountScenario#turnover`); D10 é o
trabalho corrente desta 1ª onda.

---

## Seção E — Cadeia de ADRs 033–041 reconciliada (tarefa 26.22.11)

Estado 2026-11-10, conferido contra `docs/syntaxmesh/decisoes/`:

| ADR | Título | Arquivo | Status | Criada/entregue por | Observação |
|---|---|---|---|---|---|
| 033 | Elemento `template` (Vento) | `033-elemento-template.md` | Aceito | Fase 23 (2026-11-06) | coerente |
| 034 | CLI multi-runtime + API `execute` | `034-cli-multiruntime.md` | Aceito | Fase 24 (2026-11-07) | coerente |
| 035 | Extensão VS Code + `lsp-core` | **não existe** | **Reservado** | Fase 22 ( kickoff em aberto ) | **Manter reservado** — a F22 abre na sequência desta onda |
| 036 | Sheets sem SMTP (sender/receiver em texto) | `036-sheets-sem-smtp.md` | Aceito | Fase 18 (2026-11-05) | coerente |
| 037 | Injeção de `FileStore`/`KeyValueStore` | `037-filestore-injection.md` | Aceito | Fase 18 (2026-11-05) | coerente; aditamento v2.1 (F24 24.10 — `.smx`) registrado no próprio arquivo |
| 038 | Substituição XML/HTML/ical/painter mínimos | `038-substituicao-xml.md` | Aceito | Fase 17 (2026-11-04) | fora da cadeia 033–037; registrado aqui por completude |
| 039 | Tipo `markdown` em `extend` | `039-extend-markdown.md` | Aceito | Fase 10 Complemento 3 (2026-11-06) | idem |
| 040 | Versão única via `version.ts` | `040-versao-unica.md` | Aceito | Fase 24 (2026-11-08) | idem |
| 041 | Gate `lint:doc` como ratchet | `041-gate-lint-doc.md` | Aceito | Fase 24 (2026-11-08) | idem |

**Resultado:** a cadeia 033–037 está coerente com os arquivos em disco.
`decisoes/README.md` **não precisa de mudança** (a nota de reserva já indica
035 para a F22). Nenhum ADR novo foi aberto nesta 1ª onda; se a F22 criar o
ADR 035 na sua abertura, só precisa preencher o arquivo mantendo o número.

**Regra permanente (já no README):** nunca renumerar ADRs existentes; ao criar,
conferir a tabela e usar o próximo livre. A cláusula "cadeia 034–037 é
reconciliada na Fase 21" está **satisfeita** com esta seção.

---

## Notas

- **Fase 12 concluída (2026-10-29) — reavaliação de G5:** o subsistema RichText
  (12.0–12.20) foi inteiramente entregue. **G5 (wiring `to_rti` por atributo)**
  ficou de fora dos 215 critérios atômicos: 4 dos 5 stubs foram entregues na
  F14; `attribute-base.to_tjp` foi **entregue nesta 1ª onda** (2026-11-10),
  fiel a Ruby `@type.id + " " + get.to_s`. Sweep final de subclasses ricas na
  2ª onda da F21.
- **G3:** o golden .rb completo do scheduler foi entregue pelo Bloco G da F24
  (24.7, 34 fixtures, `cli-tj3.golden.json` + `deno task golden:generate`).
  Enquanto isso `test:golden:scheduler` continua como shim apontando para o
  e2e `parser-scheduler_e2e_test.ts`.
- **G8 (defaultAccount):** regra 4 em `resolveAccount` consome
  `line.project?.defaultAccountFor?.(costTypeFromEventType(line.type))` — o
  no-op original virou dispatch efetivo na F14-C C9 (2026-11-01).
- **Sobre D9 (booking charge consumer contábil):** entregue nesta 1ª onda
  (2026-11-10). `AccountScenario#turnover` agora chama
  `addChargeBookings(task, project, startIdx, endIdx)` no ramo
  `aggregate === "charges" | "tasks"`, que resolve a conta destino via
  `resolveAccount` (regra 3: chargeset da tarefa; regra 4: `defaultaccount`
  do projeto), emite `CostEvent` `task_charge/actual` idempotente
  (`Task#chargeBookingEmitted` / `markChargeBookingEmitted`) e acumula
  `amount` — os buckets ficam a cargo do Block I (evita dupla contagem).
  Verificado por `packages/core/tests/model/account-scenario-charge-booking_test.ts`
  (6 steps: chargeset rule 3 · janela · estorno · idempotência · defaultaccount
  rule 4 · irmã isolada).

## Como atualizar

- Ao fechar/verificar/ancorar um gap, edite a célula `Status` mantendo o
  prefixo canônico (`fechado`, `verificado`, `ancorado`, `sweep concluído`).
- Rode `deno task gaps:audit` — se a linha `G<n>` não bater com o regex, o
  gate falha com exit != 0. As seções B/C/D/E são documentais.
- Ao adicionar um gap novo, crie a linha com `pendente` na seção A (se for do
  inventário G1–G21) ou uma nova linha `A<n>`/`C<n>`/`D<n>` nas seções
  correspondentes e abra task na fase dona.
- Ao remover uma âncora do código (stub virou entrega), apague a linha da
  seção B na mesma PR.
