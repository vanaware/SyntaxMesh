# Matriz de Completude — Fases 2–12

> **Arquivo:** `docs/syntaxmesh/fases/completude-matrix.md`
> **Origem:** Fase 11-Gaps (Bloco A.4 / Bloco G.3)
> **Atual:** 2026-10-28
>
> Esta matriz é a **fonte viva** do status de cada gap do inventário
> (`fase-11-logical-gaps.md` §3). É consumida por `deno task gaps:audit` — se
> qualquer linha tiver status `pendente`, o gate `gate:phase-13` falha.

## Legenda

| Status | Significado |
|---|---|
| `fechado` | Gap diagnosticado e corrigido nesta fase, com testes que provam. |
| `verificado` | Entrega confirmada por teste novo (fase dona já tinha entregado). |
| `ancorado` | Stub `NotYetImplementedError` com `// Ancorado: Fase N — razão`; a fase N é dona da entrega futura. |
| `sweep concluído` | Teste deferido da Fase 12 reabilitado e verde. |
| `pendente` | Ainda não endereçado — o gate falha. |

## Inventário

| ID | Descrição | Fase dona | Ação | Status | Teste |
|---|---|---|---|---|---|
| G1  | Placement de datas em `Project.schedule()` — `end` `null` em modelo mínimo | 7 | Fechar (P0) | fechado — 4 chained bugs (PropertyList items, doneEffort reading `_doneEffort`, propagateDate stub, Xref/checkDependency task resolve) + markAsMilestone guards + chargeset each + project vacation→Leave corrigidos | `tests/integration/logical-scheduler-driven_test.ts` (3 steps) · `tests/integration/parser-scheduler_e2e_test.ts` (22 steps) · `tests/invariants/scheduler_invariants_test.ts` (4 steps) |
| G2  | `logical-scheduler-driven_test.ts` relaxado (§6.11) | 7 | Fechar (reapertar) | fechado — metade 1 e 2 passam com asserções fortes | `tests/integration/logical-scheduler-driven_test.ts` |
| G3  | Golden tests do scheduler não comparam `start`/`end`/`effort` | 7/21 | Fechar (regenerar) | fechado — e2e sobre 9 MWEs + hardcoded tj3 dates no mwe004 (milestones + containers) cobrem o mesmo papel do golden Ruby; golden .rb + .json completo fica para 21. | `tests/integration/parser-scheduler_e2e_test.ts` (mwe004 tj3 dates) |
| G4  | Testes end-to-end parser → schedule → report ausentes | 7/9/10 | Fechar | fechado — 22 casos cobrindo os 9 MWEs en + mwe001 pt-BR/es + milestones específicos | `tests/integration/parser-scheduler_e2e_test.ts` |
| G5  | `to_rti` × 5 stubs (`attribute-base`, `reference-attribute`, `resource-list-attribute`, `query.ts`, `project-file-parser`) | 12 (12.18) | Verificar entrega | ancorado em 12 (Fase 12 em andamento; os 5 stubs têm `// Ancorado: Fase 12 — RichTextFactory (12.18)`); a Fase 12 substituirá por implementações reais em 12.18 | `scripts/check-stubs.ts` |
| G6  | `isoncriticalpath` — stub (não existe slack/float no Ruby) | 14 | Ancorar em 14 | ancorado | `scripts/check-stubs.ts` |
| G7  | `TaskJuggler#freeze` — stub (escreve arquivo) | 14 | Ancorar em 14 | ancorado | `scripts/check-stubs.ts` |
| G8  | `project.defaultAccount` — regra 4 do `resolveAccount` é no-op | 8.2 | Ancorar em 8.2 | ancorado | `scripts/check-stubs.ts` |
| G9  | `checkTimeSheet`/`checkStatusSheet`/`istaskstatus` — stubs (sheets) | 18 | Ancorar em 18 | ancorado | `scripts/check-stubs.ts` |
| G10 | `hasalert`/`LogicalFlag` (ramo Journal)/leave-allowance — stubs | 16 | Ancorar em 16 | ancorado | `scripts/check-stubs.ts` |
| G11 | `TaskJuggler#parse`/`parseFile`/`parseContent` — stubs (transporte de arquivo) | 19 | Ancorar em 19 | ancorado | `scripts/check-stubs.ts` |
| G12 | `query_*` concretos de `TaskScenario`/`ResourceScenario` | 7/8/14/18 | Verificar viáveis + ancorar | ancorado (bloqueadas via FUNCTIONS_EXT com `ext[1]` dinâmico) | `scripts/check-stubs.ts` |
| G13 | Blocos C0–C4 do Complemento Fase 10 (material, picture, format, timebasis, breakdownreport, rdoreport) | 10 | Verificar entregue | verificado — suite `parser` + `ast-equivalence-complemento_test.ts` + `timebasis-parity_golden_test.ts` cobrem os blocos | `tests/ast-equivalence-complemento_test.ts` · `tests/golden/timebasis-parity_golden_test.ts` |
| G14 | Migração `MockProject → Project` (§9.10 Fase 9) | 9 | Verificar 100% | verificado — nenhum `MockProject` em `packages/core/src` | `tests/integration/gaps_verification_test.ts` (step G14) |
| G15 | Contas não exclusivas + buckets + `CostEvent` + chargesets + plan×actual end-to-end | 8/8.1/8.2 | Verificar end-to-end | verificado — suíte `tests/finance/*` + `tests/golden/finance_golden_test.ts` cobrem mwe004 + variações; chargeset-`each` fix em `preScheduleCheck` destravou mwe004 | `tests/golden/finance_golden_test.ts` · `tests/integration/parser-scheduler_e2e_test.ts` (mwe004) |
| G16 | Motor lógico + Query + AST equivalence (3 idiomas) da Fase 11 | 11 | Verificar completo | verificado — suíte `tests/logic/*` + `tests/query/*` + `tests/ast-equivalence_test.ts` (27 fixtures) + sanity em `gaps_verification_test.ts` | `tests/integration/gaps_verification_test.ts` (step G16) |
| G17 | `ScenarioData#error/warning/info` roteiam para `MessageHandlerInstance` | 9 | Verificar com teste | verificado — método `error()` em `scenario-data.ts:92` delega para `MessageHandlerInstance.instance.error()` | `tests/integration/gaps_verification_test.ts` (step G17) |
| G18 | `TaskJuggler#errors` reflete `MessageHandlerInstance.errors` | 9 | Verificar com teste | verificado — getter em `taskjuggler.ts:110` espelha direto | `tests/integration/gaps_verification_test.ts` (step G18) |
| G19 | Atributos pré-carregados via ADR 016 em `*Scenario` (Fase 5) | 5 | Verificar end-to-end | verificado — `preloadAttributes` roda no construtor de cada `*Scenario`; bag exposto via `getAttributes()` | `tests/integration/gaps_verification_test.ts` (step G19) |
| G20 | `backupAttributes`/`restoreAttributes` (Fase 4) funcionam | 4 | Verificar com teste | verificado — pair opera como shallow-copy fiel do Ruby (estrutura preservada, valores via `AttributeBase.set`) | `tests/integration/gaps_verification_test.ts` (step G20) |
| G21 | Testes da Fase 12 marcados `ignore: true` por depender de G1–G4 | 12 | Sweep: reabilitar | sweep concluído — nenhum teste com tag `// Gate: fase-11-logical-gaps` em `packages/core/tests/` | `scripts/gaps/deferred.ts` |

## Notas

- **Fase 12 em andamento (Bloco K varrido em 2026-10-28):** G5 está
  **parcialmente entregue** (RichTextFactory chega em 12.18). Os 5 stubs têm
  âncora `Fase 12` válida; o `check:stubs` passa. Ao fechar 12.18, as
  âncoras são removidas e os stubs viram implementações reais — o gate
  `gaps:audit` permanece verde porque a linha fica `ancorado` até o sweep
  final.
- **G3:** o golden .rb completo fica para a Fase 21 (compatibilidade e
  qualidade); enquanto isso o e2e com 8 datas hard-coded do mwe004
  (`AcSo`, `AcSo.spec`, `AcSo.software`, `AcSo.software.database`,
  `AcSo.software.gui`, `AcSo.deliveries`, `AcSo.deliveries.start`,
  `AcSo.deliveries.beta`) cobre o mesmo papel de sentinela.
- **G8 (defaultAccount):** regra 4 continua no-op em `resolveAccount`. A
  âncora em `accounting/attribution.ts` é a Fase 8.2, que já tem task list
  marcada; sem mudança de status aqui.

## Como atualizar

- Ao fechar/verificar/ancorar um gap, edite a célula `Status` mantendo o
  prefixo canônico (`fechado`, `verificado`, `ancorado`, `sweep concluído`).
- Rode `deno task gaps:audit` — se a linha não bater com o regex, o gate
  falha com exit != 0.
- Ao adicionar um gap novo (descoberto em Fase 13+), crie a linha com
  `pendente` e abra task na fase dona.
