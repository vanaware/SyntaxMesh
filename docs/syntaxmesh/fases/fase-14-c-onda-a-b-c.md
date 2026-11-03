# Paridade de scheduling + motor de queries + Material#name

Três frentes, cada uma com testes BDD e verificação no fim
(`deno task check:all`, `deno task test`, goldens, `fmt`/`lint`). Ordem: A
(pequenas, independentes) → B → C → D.

## Onda A — Item 1 e Item 4 (pequenas, destravam sozinhas)

### A1. `finishScheduling`: mesclar `assignedresources` no pai (fecha a divergência 14C.12.4)

- Em `model/task-scenario.ts` `finishScheduling()` (l.2159): após a matemática
  atual, implementar fielmente o bloco de
  [`TaskScenario.rb:416-423`](file:///home/aarvati/github/syntaxmesh/docs/taskjuggler/lib/taskjuggler/TaskScenario.rb#L416):
  para cada `parent` de `this.getProperty().parents()`, adicionar os recursos de
  `this.a("assignedresources")` ao atributo de cenário `assignedresources` do
  pai, com dedupe (`if (!parentList.includes(r)) parentList.push(r)`), gravando
  via `forceForScenario`/`setStoredValue` como o resto do port.
- A recursão em filhos já é coberta por `Project#finishScenario` (l.1108);
  **não** duplicar.
- O nullify de `@candidates/@mandatories/@allLimits` (Ruby l.427-429) é
  **omitido deliberadamente**: são otimização/memória do Ruby e `limitsOk()` lê
  `allocation.candidates`; deixar注释 explicando (não é divergência de
  resultado).
- Testes (`tests/scheduler/finish-scheduling-assignedresources_14c_test.ts`):
  container com 2 filhos, cada filho com recursos distintos + um em comum →
  `assignedresources` do container = união sem duplicata; leaf simples (sem pai)
  não lança; reusar `createTestProject`.

### A2. `Material#name` = rótulo do cabeçalho (fecha pendência 14C.1.14)

- `model/material.ts`: adicionar parâmetro `label?: string` ao construtor (após
  `parent`), `super(project.materials, id, label ?? id, parent)` e
  `this.set("name", label ?? id)`; manter `this.set("id", id)`. Quando não
  houver rótulo, cai no id (compatível com `material steel` sem aspas).
- `parser/rules/material.ts` `createMaterial()` (l.615): remover `void name` e
  passar `name` como `label` ao `new Material(...)`.
- Atualizar o comentário de doc que hoje justifica o espelhamento id→name.
- Impacto rastreado: `tjp-export-re.ts`/`msp-xml-re.ts` passam a emitir
  `<Name>Steel</Name>` quando houver rótulo. Revisar asserts que esperavam o id
  (`tests/reports/stock-columns_14c_test.ts` usa `material steel` sem rótulo →
  permanece `steel`); ajustar qualquer teste/golden que declare rótulo e
  esperava o id. Rodar `deno task golden:generate` e inspecionar diff; regenerar
  só o que legitima­mente mudou.

## Onda B — Item 2: `query_*` portáveis (TaskScenario + ResourceScenario central + PropertyTreeNode)

Template de assinatura/efeito:
[`AccountScenario#query_balance/query_turnover`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L358)
(recebe `query`, grava resultado por `query.setCustomData(...)`/campos). O
dispatch já resolve `query_<attributeId>` em property→scenarioData
([`query.ts:408-421`](file:///home/aarvati/github/syntaxmesh/packages/core/src/query/query.ts#L408)).

### B1. `model/property-tree-node.ts` (compartilhados, portáveis)

Implementar fielmente `query_children`, `query_journal`,
`query_journalmessages`, `query_journalsummaries`, `query_alert`,
`query_alertmessages` (Ruby `PropertyTreeNode.rb:594-659`), delegando ao
`Journal`/`alertLevels` já portados. `query_alertsummaries`/`query_alerttrend`:
implementar se houver série de alertas históricos; caso contrário **ancorar**
com `// Ancorado: Fase 18 — alerttrend exige série temporal de alertas`.

### B2. `model/task-scenario.ts` (24 queries, todos portáveis — apoiados em scheduling/financeiro/deps/allocation já concluídos)

`activetasks, closedtasks, competitorcount, complete, cost, duration, effortdone, effortleft, effort, followers, gauge, headcount, inputs, maxend, maxstart, minend, minstart, opentasks, precursors, resources, revenue, scheduling, status, targets`
(Ruby `TaskScenario.rb:1290-1548`). Reusar acessores existentes (scoreboard,
`getAllocatedTime`, charge/finance, `TaskDependency`, `PropertyList`). Cada um:
`query_X(query)` espelhando o Ruby.

### B3. `model/resource-scenario.ts` (subset central portável)

`cost, duties, effort, effortdone, effortleft, headcount, rate, revenue, freetime, freework`
(Ruby `ResourceScenario.rb`). Delegar a bookings/scoreboard/finance já portados.

### B4. Ancorados (dados ainda não produzidos — NÃO implementar, deixar stub com âncora + motivo)

`annualleave, annualleavelist, annualleavebalance, sickleave, timeoffdays, unpaidleave, fte`
→ Fase 16/18 (LeaveList de férias/sick/annual + horas de contrato/calendário);
`Resource#query_dashboard` → Fase 15/20. Cada um: comentário
`// Ancorado: Fase N — <razão>` (política do `check:stubs`).

## Onda C — Item 2: `MaterialScenario#query_*` (extensão sem oracle, espelha o materialreport)

Em `model/material-scenario.ts`, adicionar `query_*` que reusam a lógica
validada de `Material` (`unitPriceValue`, `stockQuantity/stockCost`,
`stockBookings`, alocações) e o recorte de período da query (`query.start/end`),
espelhando `TableReport.materialPropertiesById`:

- `query_unitprice` (unit price efetivo), `query_cost` (total cost planejado),
  `query_actualcost`, `query_scheduledcost`, `query_remainingcost`,
  `query_effort` (quantidade alocada), `query_remaining` (quantidade restante),
  `query_stockquantity`, `query_stockcost`.
- Recorte temporal igual ao `genMaterialCell`/`stockBookingsInPeriod` (período
  `[start, end]` fechado).
- **Sem duplicar**: extrair os cálculos hoje privados de `TableReport` para um
  helper reutilizável (ou mover para `Material`/`MaterialScenario`) e fazer
  `genMaterialCell` consumir o mesmo caminho, mantendo os testes C18 verdes.
- **BDD é a fonte de verdade** (sem oracle Ruby):
  `tests/reports/material-scenario-queries_14c_test.ts` cobre cada query com
  valores esperados iguais aos das células correspondentes do materialreport
  (paridade query ⇄ coluna).

## Testes

- Novos arquivos: `finish-scheduling-assignedresources_14c_test.ts`,
  `query-tasks_14c_test.ts`, `query-resources_14c_test.ts`,
  `query-ptn_14c_test.ts`, `material-scenario-queries_14c_test.ts` (+ updates de
  `stock-columns_14c_test.ts`/`rules_booking` se o rótulo do material mudar
  asserts).
- Estilo `@std/testing/bdd` + `@std/assert`; fixtures
  `createTestProject`/`parseReport`.

## Docs e rastreabilidade

- `fase-7-scheduler-core-tarefas.md`: 14C.12.4 passa a "divergência ELIMINADA"
  (mescla feita), com evidência do teste.
- `fase-11-logica-queries-tarefas.md` (ou adendo 14-C): registrar query_*
  implementados vs ancorados (lista da B4 com fase dona).
- `fase-14-relatorios-complemento.md` §13.7: `Material#name` **resolvido**;
  adicionar §/bloco para query_* + MaterialScenario.
- `CURRENT.md`: atualizar linha da Fase 14-C/gaps (remove #4 name, adiciona
  paridade finishScheduling/queries) e contagem da suíte.
- `snapshots/` relevantes se existirem espelhos de estado.
- Contar testes após rodar a suíte e propagar o número em `CURRENT.md`/docs.

## Verificação final (gate)

- `deno check packages/core/mod.ts` limpo.
- `deno task test` (suíte core) 0 falhas — reportar nova contagem (base atual
  483/4934).
- `deno task check:all` exit 0; `check:stubs` OK (todos os novos ancorados com
  âncora válida).
- `deno task golden:generate` + `deno task test`: aceitar mudanças de golden
  somente por Material#name; reavaliar
  `PENDING_DIVERGENCES`/`PENDING_SCHEDULER_FILES` em `reports_golden_test.ts` e
  retirar entradas que os query_* agora satisfazem.
- `deno fmt --check` e `deno lint` limpos nos arquivos tocados.

## Premissas

- Mesclar `assignedresources` é paridade desejada e pode alterar saídas de
  reports/MSPDI de containers (esperado; validado por testes + goldens).
- query_* de material ficam restritos a espelhar as colunas do materialreport;
  novos pedidos de coluna material viram adendos futuros.
- Métodos ancorados não lançam em runtime comum: só quando uma coluna/consulta
  os exigir (dispatch atual cai em atributo base), preservando a suíte verde.

## Onda D — Nova Syntaxe em Booking

O booking de material e de charge não ser específico para uma data mas passa a
ser definido para o período podendo ter a distribuição no período definida como
se faz no planejamento <modifier> (ex: onstart, onend, perhour, perday, perweek,
distributed, distribution { a, b, c }).

### Syntaxe atual

- booking effort <id> <interval4> [, <interval4>...] [{ <attributes> }]
- booking charge ["descrição"] [value] <montante> on <data>
- booking material <id> [quantity] <qty> [unitprice <p>] on <data>

### Nova syntaxe

mantem a syntaxe original do taskjugger para resource para manter
compatibilidade:

- booking <id> <interval4> [, <interval4>...] [{ <attributes> }]

altera-se as syntaxe novas do syntaxmesh para (dentro de task):

- booking resource <id> <interval4> [, <interval4>...] [{ <attributes> }]
- booking charge ["descrição"] [value] <montante> <modifier> <interval4> [,
  <interval4>...]
- booking material <id> [quantity] <qty> [unitprice <p>] <modifier> <interval4>
  [, <interval4>...]

o mesmo muda para o stock booking que passa a ser definido em um intervalo
também: material { booking [quantity] <qty> [unitprice <p>] <modifier>
<interval4> [, <interval4>...] }

O planejamento de alocação de material tem o unitprice "opcional" antes do
modifier: task { material <id> [quantity] <qty> [unitprice <p>] <modifier> }

uniformizar a nomenclatura do bucket de custos:

```ts
interface AccountBuckets {
    charge: number; // custos de task_charge
    resource: number; // custos de resource_effort
    material: number; // custos de material_usage
}
```

mudando também nomes de métodos como:

- chargeTotal() // antes era taskTotal()
- resourceTotal()
- materialTotal()

mudar também a nomenclatura de aggregate que era assim:

```tjp
account "Custos" {
  aggregate tasks, resources, materials    # aceita os 3
}
```

trocando aggregate "tasks" para "charges" (neste caso se for necessário manter
compatibilidade com tj3 pode-se manter como alias "tasks"):

```tjp
account "Custos" {
  aggregate charges, resources, materials    # aceita os 3
}
```

mudar o booking (type effort para resource):

```ts
// Fase 8.1 — src/core/model/extended-booking.ts
class ExtendedBooking {
  readonly type: 'resource' | 'charge' | 'material';
  ...
}
```

a definição do fallback default account mantem a nomenclatura atual (material,
resource ou charge):

```tjp
project {
  defaultaccount [ material | resource | charge ] <id>
}
```

Observação: estas mudanças provocarão bastante mudanção em rotinas de testes e
código mas é preferível padronizar a nomenclatura agora. os tipos de custos são
: charge, resource e material. Se encontrar mais alguma divergência pode listar
no planejamento.
