# Relatório de conformidade — SyntaxMesh × TaskJuggler

> Gerado por `scripts/golden/generate-report.ts` (F21¹, 26.7) a partir do
> golden e2e (`cli-tj3.golden.json`), do corpus (`tests/fixtures/corpus.json`)
> e do registro de divergências (`known-divergences.json`).

- **tj3 (oráculo):** 3.8.4
- **SyntaxMesh (port):** 0.0.2

## Resumo

| Métrica | Valor |
| --- | --- |
| Fixtures no corpus | 395 |
| Incluídos (comparados) | 340 |
| Excluídos (divergência registrada) | 55 |
| Conformidade | 86.1% |

Conformidade = incluídos / total. Todo caso excluído tem verbete e âncora
no registro — nada é ignorado em silêncio (ADR 042). Um único verbete de
grupo (`<group>/*`) pode excluir vários fixtures.

## Por categoria (grupo do corpus)

| Grupo | Total | Incluídos | Excluídos |
| --- | --- | --- | --- |
| mwe | 9 | 8 | 1 |
| syntax-correct | 75 | 67 | 8 |
| syntax-errors | 94 | 91 | 3 |
| scheduler-correct | 35 | 32 | 3 |
| scheduler-errors | 70 | 52 | 18 |
| report-generator | 9 | 9 | 0 |
| html-reports | 13 | 12 | 1 |
| csv-reports | 18 | 0 | 18 |
| export-refs | 68 | 65 | 3 |
| parity | 4 | 4 | 0 |

## Features ausentes (por tipo de divergência)

| Tipo | Entradas | Ids |
| --- | --- | --- |
| scheduler | 32 | D7, D8, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, D29, D30, D31, D32, D33, D34, D35, D36, D37, D38, D39, D40 |
| serialization | 3 | D2, D10, D44 |
| architecture | 2 | D41, D42 |
| diagnostics | 1 | D43 |
| output-policy | 1 | D9 |

## Divergências registradas

| Id | Fixture | Tipo | Prioridade | Efeito | Descrição |
| --- | --- | --- | --- | --- | --- |
| D2 | `parity/parity-csv-balance` | serialization | medium | compare-artifacts | accountreport balance mode: tj3 closes the list with a Total row (temporary Account adopting cost/revenue accounts) and numbers each list from zero; the port does not emit the row. |
| D7 | `mwe/mwe004` | scheduler | high | exclude | Spurious task_start_in_parent on deliveries.start: a milestone pinned to the project start is compared against the parent start and reported as before it with the same printed date. CLI exits 1 with no artifacts; tj3 exits 0. |
| D8 | `syntax-correct/AccountReport` | scheduler | high | exclude | effort 20m (20 months) with two group allocations overflows the project time frame in the port (173.5d of effort does not fit) but not in tj3. A single-resource task passes; group competition breaks. |
| D9 | `syntax-correct/Leave` | output-policy | low | exclude | resourcereport "." makes tj3 write the HTML to stdout; the port with --output-dir always writes to disk. |
| D10 | `csv-reports/*` | serialization | medium | exclude | CSV report content on stdout: D3 cell marshaling (integral floats, empty/"" and <Error> cells), date rendering (plain vs long form), unexpanded query-attribute cells ([object Object], <-query->) and scheduling values; the whole group is report output not yet reconciled. |
| D11 | `scheduler-errors/task_depend_self` | scheduler | high | exclude | Dependency validation: port reports a generic 'Dependency loop detected' warning; tj3 errors 'Task t1.t2 cannot depend on self'. |
| D12 | `scheduler-errors/task_depend_child` | scheduler | high | exclude | Dependency validation: port reports a generic dependency-loop warning; tj3 errors 'Task t1 cannot depend on child t1.t2'. |
| D13 | `scheduler-errors/task_depend_parent` | scheduler | high | exclude | Dependency validation: port reports a generic dependency-loop warning; tj3 errors 'Task t1.t2 cannot depend on parent t1'. |
| D14 | `scheduler-errors/task_depend_unknown` | scheduler | high | exclude | Dependency validation: port errors "Unknown task 'foo'"; tj3 errors 'Task t1.t2 has unknown depends foo'. |
| D15 | `scheduler-errors/task_depend_multi` | scheduler | high | exclude | Dependency validation: port exits 0; tj3 exits 1 on the invalid multiple dependency. |
| D16 | `scheduler-errors/task_pred_before` | scheduler | high | exclude | Impossible gap/overlap dependency: port's first message is the priority_inversion warning; tj3 errors 'must start after end … could not be met'. |
| D17 | `scheduler-errors/task_pred_before_1` | scheduler | high | exclude | Impossible gap/overlap dependency: port exits 0; tj3 exits 1 on the impossible predecessor overlap. |
| D18 | `scheduler-errors/task_pred_before_2` | scheduler | high | exclude | Impossible gap/overlap dependency: port's first message is the priority warning; tj3 errors 'must start 3 days after end … could not be met'. |
| D19 | `scheduler-errors/task_succ_after` | scheduler | high | exclude | Impossible gap/overlap dependency: port's first message is the priority warning; tj3 errors 'must end before start … could not be met'. |
| D20 | `scheduler-errors/task_succ_after_1` | scheduler | high | exclude | Impossible gap/overlap dependency: port exits 0; tj3 exits 1 on the impossible successor overlap. |
| D21 | `scheduler-errors/task_succ_after_2` | scheduler | high | exclude | Impossible gap/overlap dependency: port's first message is the priority warning; tj3 errors 'must end 3 days before start … could not be met'. |
| D22 | `scheduler-correct/Scheduled` | scheduler | high | exclude | Scheduling capacity: port errors 'too few specifations' + 'undefined end time' and exits 1; tj3 schedules it (exit 0). |
| D23 | `scheduler-correct/PersistentResources-2` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (persistent-resource scheduling). |
| D24 | `scheduler-correct/TimeSheet2` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (time-sheet scheduling). |
| D25 | `export-refs/Allocate-1` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (allocation). |
| D26 | `export-refs/Depends1` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (dependency scheduling). |
| D27 | `export-refs/tutorial` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (tutorial project). |
| D28 | `syntax-correct/Depends1` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (dependency scheduling). |
| D29 | `syntax-correct/Priority` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (priority scheduling). |
| D30 | `syntax-correct/tutorial` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (tutorial project). |
| D31 | `syntax-correct/ListAttributes` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0. |
| D32 | `syntax-correct/template` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (template project). |
| D33 | `html-reports/Alerts` | scheduler | high | exclude | Scheduling capacity: port exits 1; tj3 exits 0 (alert-level scheduling). |
| D34 | `scheduler-errors/resource_fail_check` | scheduler | medium | exclude | Query-engine check: port exits 0; tj3 exits 1 (user-defined resource fail check). |
| D35 | `scheduler-errors/task_fail_check` | scheduler | medium | exclude | Query-engine check: port exits 0; tj3 exits 1 (user-defined task fail check). |
| D36 | `scheduler-errors/resource_warn_check` | scheduler | medium | exclude | Query-engine check: port's first message is the priority warning; tj3 warns 'User defined warning triggered for resource r'. |
| D37 | `scheduler-errors/task_warn_check` | scheduler | medium | exclude | Query-engine check: port's first message is the priority warning; tj3 warns 'User defined warning triggered for task'. |
| D38 | `scheduler-errors/ts_res_new_task` | scheduler | medium | exclude | Query-engine check: port's first message is the priority warning; tj3's is no_reports (D4 ordering). |
| D39 | `scheduler-errors/not_scheduled` | scheduler | high | exclude | port errors 'has undefined end time'; tj3 errors 'is marked as scheduled but does not have a fixed start and end date'. |
| D40 | `scheduler-errors/allocate_no_assigned` | scheduler | high | exclude | port's first message is the priority_inversion warning; tj3 warns 'has resource allocation requested, but did not get any resources assigned'. |
| D41 | `syntax-errors/empty` | architecture | medium | exclude | port's top-level grammar accepts 'language' and 'template'; tj3 expects only 'include', 'macro', 'project'. |
| D42 | `syntax-errors/unsupported_token` | architecture | medium | exclude | port exits 0 (accepts the token); tj3 exits 1 (rejects it). |
| D43 | `syntax-errors/report_start` | diagnostics | low | exclude | port prints the end date at midnight (…T00:00Z); tj3 at the project's end-of-day instant (…T20:00Z). |
| D44 | `syntax-correct/Export` | serialization | medium | exclude | port does not generate the `export` artifacts FullProject.tjp and Week1Bookings.tjp (only MS-Project.xml). |
