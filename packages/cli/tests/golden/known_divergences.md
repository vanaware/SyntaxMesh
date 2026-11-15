# Divergências conhecidas — golden CLI × `tj3` (Fase 24.7 + F21¹)

> **Fase:** 24.7.5 + 26.6 · **Golden:** `packages/cli/tests/golden/cli-tj3.golden.json`
> **Oracle:** `scripts/golden/cli-tj3.rb` · **Testes:** `packages/cli/tests/e2e_<grupo>_test.ts`
> **Registro máquina:** [`known-divergences.json`](./known-divergences.json) (26.6) —
> este `.md` guarda os verbetes humanos; os efeitos operacionais
> (`exclude`/`compare-artifacts`/`none`) vivem no JSON.
> **Política:** `scripts/golden/README.md` § "Golden CLI × tj3" e Regra 1 (o Ruby
> é a fonte de verdade; divergência é bug do port até prova em contrário).

## Por que este arquivo existe

O golden compara o que o usuário vê: código de saída, arquivos gravados,
mensagens e stdout. Toda diferença que **não** é comparada hoje precisa de
âncora aqui — na linha do caso, no `compare` do fixture ou numa exclusão do
subset. Sem âncora, a diferença volta como falha silenciosa meses depois.

Três destinos possíveis para uma divergência:

| Destino                     | Quando                                                                                          | Efeito no golden                                |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Normalização**            | a diferença é de representação, não de comportamento (carimbo, id de tooltip, caminho absoluto) | comparado depois de normalizar                  |
| **Sub-critério mais fraco** | o port acerta o essencial e erra a forma (ex.: falta a linha `Total` de um CSV)                 | `compare: "artifacts"` — só `exit` + inventário |
| **Fora do subset**          | o port **falha** onde o `tj3` funciona (bug do core)                                            | o caso sai do `.rb`, com a razão no comentário  |

Nenhum caso é ignorado por `it.ignore`: ou é comparado, ou não entra no
subset. A triagem de todos eles é da 1ª onda da Fase 21 (golden completo ×
`tj3`), que regenera a matriz de completude.

## Registro

| #      | Divergência                                                                                                                                                                                                                                                                                 | Onde                          | Golden                                                                                                                             | Âncora                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **D1** | UI de terminal: o `tj3` imprime banner GPL (11 linhas) + barra de progresso com `\r`; a CLI imprime o resumo do projeto (24.4.5).                                                                                                                                                           | stdout dos dois lados         | os dois são filtrados; sobra o **resíduo**, comparado e vazio                                                                      | `cli-tj3.rb#strip_banner`, `e2e-harness.ts#residue`                              |
| **D2** | `accountreport` em modo **balance**: o `tj3` fecha a lista com uma linha `Total` (um `Account` temporário que adota a conta de custo e a de receita, `AccountListRE#generateIntermediateFormat`) e numera cada lista do zero; o port não gera a linha.                                      | `parity-csv-balance.smx`      | `compare: "artifacts"` — `exit` + inventário                                                                                       | fixture + este verbete                                                           |
| **D3** | Serialização de célula em CSV (`CSVFile#marshal`): (a) `Float` inteiro sai `4.0` no Ruby e `4` no port; (b) célula vazia sai `""` no Ruby e vazia no port; (c) célula em erro sai `""` no Ruby e `<Error>` no port.                                                                         | relatórios CSV                | os 2 fixtures byte a byte só usam colunas de texto/data/percentual (`id`, `name`, `start`, `end`, `priority`, `complete`, `index`) | `parity-csv-{tasks,accounts}.smx`                                                |
| **D4** | Conjunto de **avisos** difere: o port emite `priority_inversion` e `*_check_unsupported` no `schedule()`, que o Ruby só avalia com o motor de queries; o Ruby emite `no_reports` (projeto sem relatório) e um aviso extra de `balance` ausente, que o port não emite.                       | `messages` / `stderr`         | só a **primeira mensagem** dos fixtures de erro é comparada; nos demais, `messages` é informativo                                  | `cli-tj3.rb` (comentário "Por que não comparar tudo")                            |
| **D5** | Envelope do HTML: `<head>` do `tj3` traz `description`/`keywords`; o `<link>` de css, o comentário "generated by tj3" e a linha de copyright ("… with SyntaxMesh") são do produto.                                                                                                          | `parity-html.smx`             | DOM canônico: `<body>` apenas, envelope fora, `ID<n>`/`<TS>` estabilizados                                                         | `canonical-dom.ts`                                                               |
| **D6** | Geometria de **Gantt** (posição de barras, setas, `nowLineX`) não é comparada pela CLI — a cobertura é o golden dedicado da Fase 15.                                                                                                                                                        | relatórios com coluna `chart` | nenhum fixture de paridade tem `chart`                                                                                             | `scripts/golden/gantt-common.rb`                                                 |
| **D7** | `Learning/mwe004`: `task_start_in_parent` espúrio em `deliveries.start` (marco fixado no começo do projeto é comparado com o início do pai e acusa "antes" com a mesma data impressa). A CLI sai com `1` e nenhum artefato; o `tj3` sai com `0`.                                            | scheduler do core             | **fora do corpus** (`exclude` D7)                                                                                                  | `known-divergences.json#D7` + `cli.integration_test.ts` (`it.ignore` da 1ª onda) |
| **D8** | `Syntax/Correct/AccountReport`: `effort 20m` (20 **meses**) com duas alocações de **grupo** estoura o intervalo do projeto no port (`173.5d of effort … does not fit into the project time frame`) e não no `tj3`. Tarefa de um recurso só passa; o que quebra é a competição entre grupos. | scheduler do core             | **fora do corpus** (`exclude` D8)                                                                                                  | `known-divergences.json#D8`                                                      |
| **D9** | `Syntax/Correct/Leave`: `resourcereport "."` faz o `tj3` escrever o HTML no **stdout**; o port com `--output-dir` sempre grava em disco.                                                                                                                                                    | output policy                 | **fora do corpus** (`exclude` D9; a cobertura de `leaves` é `scripts/golden/leaves.rb`)                                            | `known-divergences.json#D9`                                                      |

| **D10** | Grupo `csv-reports/*`: conteúdo CSV no stdout — marshaling de célula (D3), renderização de data, células de query não expandidas e valores de scheduling. Saída de relatório ainda não reconciliada. | grupo `csv-reports` | **fora do corpus** (`exclude` D10) | `known-divergences.json#D10` |
| **D11** | Validação de dependência: port reports a generic 'Dependency loop detected' warning; tj3 errors 'Task t1.t2 cannot depend on self'. | `scheduler-errors/task_depend_self` | **fora do corpus** (`exclude` D11) | `known-divergences.json#D11` |
| **D12** | Validação de dependência: port reports a generic dependency-loop warning; tj3 errors 'Task t1 cannot depend on child t1.t2'. | `scheduler-errors/task_depend_child` | **fora do corpus** (`exclude` D12) | `known-divergences.json#D12` |
| **D13** | Validação de dependência: port reports a generic dependency-loop warning; tj3 errors 'Task t1.t2 cannot depend on parent t1'. | `scheduler-errors/task_depend_parent` | **fora do corpus** (`exclude` D13) | `known-divergences.json#D13` |
| **D14** | Validação de dependência: port errors "Unknown task 'foo'"; tj3 errors 'Task t1.t2 has unknown depends foo'. | `scheduler-errors/task_depend_unknown` | **fora do corpus** (`exclude` D14) | `known-divergences.json#D14` |
| **D15** | Validação de dependência: port exits 0; tj3 exits 1 on the invalid multiple dependency. | `scheduler-errors/task_depend_multi` | **fora do corpus** (`exclude` D15) | `known-divergences.json#D15` |
| **D16** | Dependência de gap/sobreposição impossível: port's first message is the priority_inversion warning; tj3 errors 'must start after end … could not be met'. | `scheduler-errors/task_pred_before` | **fora do corpus** (`exclude` D16) | `known-divergences.json#D16` |
| **D17** | Dependência de gap/sobreposição impossível: port exits 0; tj3 exits 1 on the impossible predecessor overlap. | `scheduler-errors/task_pred_before_1` | **fora do corpus** (`exclude` D17) | `known-divergences.json#D17` |
| **D18** | Dependência de gap/sobreposição impossível: port's first message is the priority warning; tj3 errors 'must start 3 days after end … could not be met'. | `scheduler-errors/task_pred_before_2` | **fora do corpus** (`exclude` D18) | `known-divergences.json#D18` |
| **D19** | Dependência de gap/sobreposição impossível: port's first message is the priority warning; tj3 errors 'must end before start … could not be met'. | `scheduler-errors/task_succ_after` | **fora do corpus** (`exclude` D19) | `known-divergences.json#D19` |
| **D20** | Dependência de gap/sobreposição impossível: port exits 0; tj3 exits 1 on the impossible successor overlap. | `scheduler-errors/task_succ_after_1` | **fora do corpus** (`exclude` D20) | `known-divergences.json#D20` |
| **D21** | Dependência de gap/sobreposição impossível: port's first message is the priority warning; tj3 errors 'must end 3 days before start … could not be met'. | `scheduler-errors/task_succ_after_2` | **fora do corpus** (`exclude` D21) | `known-divergences.json#D21` |
| **D22** | Capacidade de scheduling: port errors 'too few specifations' + 'undefined end time' and exits 1; tj3 schedules it (exit 0). | `scheduler-correct/Scheduled` | **fora do corpus** (`exclude` D22) | `known-divergences.json#D22` |
| **D23** | Capacidade de scheduling: port exits 1; tj3 exits 0 (persistent-resource scheduling). | `scheduler-correct/PersistentResources-2` | **fora do corpus** (`exclude` D23) | `known-divergences.json#D23` |
| **D24** | Capacidade de scheduling: port exits 1; tj3 exits 0 (time-sheet scheduling). | `scheduler-correct/TimeSheet2` | **fora do corpus** (`exclude` D24) | `known-divergences.json#D24` |
| **D25** | Capacidade de scheduling: port exits 1; tj3 exits 0 (allocation). | `export-refs/Allocate-1` | **fora do corpus** (`exclude` D25) | `known-divergences.json#D25` |
| **D26** | Capacidade de scheduling: port exits 1; tj3 exits 0 (dependency scheduling). | `export-refs/Depends1` | **fora do corpus** (`exclude` D26) | `known-divergences.json#D26` |
| **D27** | Capacidade de scheduling: port exits 1; tj3 exits 0 (tutorial project). | `export-refs/tutorial` | **fora do corpus** (`exclude` D27) | `known-divergences.json#D27` |
| **D28** | Capacidade de scheduling: port exits 1; tj3 exits 0 (dependency scheduling). | `syntax-correct/Depends1` | **fora do corpus** (`exclude` D28) | `known-divergences.json#D28` |
| **D29** | Capacidade de scheduling: port exits 1; tj3 exits 0 (priority scheduling). | `syntax-correct/Priority` | **fora do corpus** (`exclude` D29) | `known-divergences.json#D29` |
| **D30** | Capacidade de scheduling: port exits 1; tj3 exits 0 (tutorial project). | `syntax-correct/tutorial` | **fora do corpus** (`exclude` D30) | `known-divergences.json#D30` |
| **D31** | Capacidade de scheduling: port exits 1; tj3 exits 0. | `syntax-correct/ListAttributes` | **fora do corpus** (`exclude` D31) | `known-divergences.json#D31` |
| **D32** | Capacidade de scheduling: port exits 1; tj3 exits 0 (template project). | `syntax-correct/template` | **fora do corpus** (`exclude` D32) | `known-divergences.json#D32` |
| **D33** | Capacidade de scheduling: port exits 1; tj3 exits 0 (alert-level scheduling). | `html-reports/Alerts` | **fora do corpus** (`exclude` D33) | `known-divergences.json#D33` |
| **D34** | Check do motor de queries: port exits 0; tj3 exits 1 (user-defined resource fail check). | `scheduler-errors/resource_fail_check` | **fora do corpus** (`exclude` D34) | `known-divergences.json#D34` |
| **D35** | Check do motor de queries: port exits 0; tj3 exits 1 (user-defined task fail check). | `scheduler-errors/task_fail_check` | **fora do corpus** (`exclude` D35) | `known-divergences.json#D35` |
| **D36** | Check do motor de queries: port's first message is the priority warning; tj3 warns 'User defined warning triggered for resource r'. | `scheduler-errors/resource_warn_check` | **fora do corpus** (`exclude` D36) | `known-divergences.json#D36` |
| **D37** | Check do motor de queries: port's first message is the priority warning; tj3 warns 'User defined warning triggered for task'. | `scheduler-errors/task_warn_check` | **fora do corpus** (`exclude` D37) | `known-divergences.json#D37` |
| **D38** | Check do motor de queries: port's first message is the priority warning; tj3's is no_reports (D4 ordering). | `scheduler-errors/ts_res_new_task` | **fora do corpus** (`exclude` D38) | `known-divergences.json#D38` |
| **D39** | O port emite 'undefined end time'; o tj3 emite a mensagem específica de 'marked as scheduled' sem start/end fixos. | `scheduler-errors/not_scheduled` | **fora do corpus** (`exclude` D39) | `known-divergences.json#D39` |
| **D40** | Primeira mensagem do port é o aviso priority_inversion; o tj3 emite o aviso de alocação sem recursos atribuídos. | `scheduler-errors/allocate_no_assigned` | **fora do corpus** (`exclude` D40) | `known-divergences.json#D40` |
| **D41** | Gramática top-level do port é superconjunto: aceita 'language'/'template' que o tj3 não lista. | `syntax-errors/empty` | **fora do corpus** (`exclude` D41) | `known-divergences.json#D41` |
| **D42** | O port aceita um token que o tj3 rejeita (superconjunto de gramática); exit 0 × 1. | `syntax-errors/unsupported_token` | **fora do corpus** (`exclude` D42) | `known-divergences.json#D42` |
| **D43** | Renderização de data no erro: o port imprime o end à meia-noite, o tj3 no instante de fim de dia do projeto. | `syntax-errors/report_start` | **fora do corpus** (`exclude` D43) | `known-divergences.json#D43` |
| **D44** | O port não gera os artefatos de `export` FullProject.tjp e Week1Bookings.tjp (só MS-Project.xml). | `syntax-correct/Export` | **fora do corpus** (`exclude` D44) | `known-divergences.json#D44` |
| **D45** | **Normalizações de mensagem** (26.5): renderizações de data (long form, ISO simples, ctime do JS) canonicalizadas para instante UTC; float integral colapsa (`4.0`→`4`); localização de fonte (`<PATH>:12:`) removida (o tj3 omite em erros de runtime); medidor de progresso (`Report …`) filtrado dos dois lados. | mensagens dos dois lados | comparado **após normalizar** (instante/valor/texto seguem comparados) | `e2e-harness.ts#normalizeMessage`, `cli-tj3.rb#normalize_message` |

## Especificidades do `tj3` que **não** são divergência

Registradas porque surpreendem ao ler o golden:

1. **`-o` exige diretório existente** (o oracle cria o temporário antes).
2. **Extensão tem de ser `.tjp`** — os fixtures de paridade (`.smx`) são
   copiados para um temporário, e é a cópia que aparece normalizada como
   `<PATH>` nas mensagens.
3. **`Error` encerra o processo** (`MessageHandler#error` → `exit 1`), então o
   golden de um fixture de erro tem **uma** mensagem comparável; as demais
   linhas do stderr são a cascata do FSM do port e ficam fora (D4).
4. **O `tj3` imprime a linha de fonte ofensora** depois da mensagem de erro; o
   port não repete o texto do `.tjp`. Só a linha `file:line: Severity: texto`
   entra na comparação (24.7.8).
5. **`effort 20m` é 20 meses**, não 20 minutos (`m` = month). Foi o que
   delatou D8.
6. **Relatório sem `formats` gravado em `"."`** vira `resourcereport "."`
   (D9): `"."` é diretório, não arquivo.
7. **Coluna de série temporal (`daily`, `weekly`…) gera uma célula por
   período** e repete o cabeçalho com a data (`"2026-01-05";"2026-01-05";…`),
   mais as células do calendário anterior (`2025-12-29`…) no fim. Não é bug —
   é o `Report` montando uma coluna por slot da escala.

## Como adicionar uma divergência

1. Reproduza com `ruby scripts/golden/cli-tj3.rb` e a CLI no mesmo fixture.
2. Classifique nos três destinos acima — o default é **bug do port**.
3. Se for bug do core fora do escopo da CLI, tire o caso do subset no `.rb` e
   escreva a razão **no comentário acima da lista** (a lista é a fonte do
   subset, não este arquivo).
4. Se for de forma, ajuste o `compare` do fixture ou a normalização — nunca
   compare menos sem registrar aqui.
5. Rode `deno task golden:generate:ruby && deno task cli:test`.

## Ponto de saída

- **Relatório/serialização** — D2, D3, D10 (grupo `csv-reports`) e D44: saem
  com o golden completo de relatórios da Fase 21.
- **Scheduler** — D7, D8, D11–D33, D39 e D40: saem quando o
  `Project.schedule()` for reconciliado com o `Project.rb` (alvo da 1ª onda;
  registrados com âncora de fase até lá).
- **Motor de queries** — D34–D38 (fail/warn checks): saem com a reconciliação
  do motor de queries (D4).
- **Gramática (superconjunto)** — D41, D42: saem com a decisão de subset da
  matriz de compatibilidade.
- **Diagnóstico** — D43 (renderização de data no erro): sai com a
  reconciliação de diagnósticos.
- **Arquiteturais** — D1, D5, D6 e D9 (produto, envelope, golden dedicado,
  política de saída): permanecem.
- **Normalização** — D45: não é divergência; a diferença é de representação e
  segue comparada após normalizar.
