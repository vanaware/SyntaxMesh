# Onda D — Nova sintaxe de booking + nomenclatura de custos (investigação e plano)

> **Status:** ✅ **implementação concluída (2026-11-04)** — D1–D4 entregues.
> Este documento permanece como a fonte de verdade do *como* (âncoras e
> decisões de projeto); a execução registrou-se em `CURRENT.md` (linha
> "14-C Onda D implementada") e os gates ficaram verdes (suíte core
> **497 testes / 5005 passos / 0 falhas**; `check:all`/`check:stubs` OK;
> goldens inalterados — nenhuma regeneração, o caminho legado ficou intacto).
>
> Escopo derivado do plano `Scheduling_parity_and_query_engine` — Onda D.
> As Ondas A/B/C (paridade `finishScheduling`, `query_*` e `Material#name`)
> já estão entregues e **não** dependem deste trabalho.

---

## 0. Objetivo e motivação

Três padronizações, todas de **nomenclatura/gramática** (não de resultado):

1. **Booking temporal com `<modifier>`**: o booking de *charge* e de *material*
   (inclusive de estoque) deixa de ser preso a uma única data (`on <data>`) e
   passa a aceitar um **período** com **distribuição no período**, exatamente
   como já faz o planejamento de alocação (`onstart`/`onend`/`perhour`/`perday`/
   `perweek`/`permonth`/`distributed`/`distribution { … }`). A forma canônica do
   TaskJuggler para recurso (`booking <id> <intervalo>`) é **mantida** por
   compatibilidade.
2. **Nomenclatura do bucket de custos**: o bucket que hoje se chama `task`
   (alimentado por eventos `task_charge`) passa a se chamar **`charge`**. Os
   três tipos de custo ficam simétricos: `charge`, `resource`, `material`.
3. **`aggregate tasks` → `charges`** (com `tasks` mantido como **alias** para
   ler `.tjp` do tj3) e **`booking effort` → `booking resource`** (keyword
   explícita do tipo; `booking <id>` sem keyword continua canônico).

Tipos de custo canônicos após a onda: **`charge`, `resource`, `material`**.

---

## 1. Estado atual (investigação — âncoras verificadas)

### 1.1 Bucket de custo e tipos

- `interface AccountBuckets { task; resource; material }` —
  [`account-scenario.ts:36-40`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L36).
- `private buckets = { task: 0, resource: 0, material: 0 }` —
  [`account-scenario.ts:49`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L49).
- `buckets.task` é alimentado/propagado em: herança de container
  (l.117-119, 137-141), agregação leaf por `aggregate` (l.172), classificação de
  `CostEvent` (l.249-256), leitura por tipo em `turnoverByType`
  (l.335-351) e `getBuckets` (l.269).
- Tipo do evento: `readonly type: "task_charge" | "resource_effort" |
  "material_usage"` —
  [`cost-event.ts:37,48`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/cost-event.ts#L37).
  O **nome do tipo de evento** (`task_charge`) é fiel ao Ruby e **não muda**;
  muda apenas o **nome do campo do bucket** que o recebe (`task` → `charge`).

### 1.2 `aggregate` (account)

- Parser: `rule("aggregate")` aceita `_resources`/`_tasks`/`_materials`
  devolvendo `"resources"|"tasks"|"materials"` —
  [`task.ts:1400-1407`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/task.ts#L1400).
- Armazenado por `asProp(this).set("aggregate", this.val[1])` —
  [`account.ts:163-165`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/account.ts#L163).
- Default derivado do conteúdo do cenário (`"tasks"`/`"resources"`/`"materials"`)
  — [`scenario.ts:480-485`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/scenario.ts#L480).
- Consumido em runtime por `if (aggregate === "tasks") …` —
  [`account-scenario.ts:149`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L149).

### 1.3 Gramática de booking hoje

Quatro origens partilham o prefixo `_booking` e desambiguam pelo 2º token:

- **Recurso (canônico TJ):** `booking [effort] <recurso> <intervalo> [{attrs}]`
  — `taskBookingHeader` = `!bookingEffortKeyword !resourceId !valIntervals`
  ([`task.ts:687-705`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/task.ts#L687));
  `bookingEffortKeyword` torna `effort` **opcional** (Adendo §12.3 /
  `TjpSyntaxRules.rb:6001`). No corpo do recurso: `resourceBooking`
  ([`resource.ts:222`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/resource.ts#L222)).
- **Charge (data única):** `booking charge ["desc"] [value] <montante> on <data>`
  com `_on !date` fixos, nas três origens (tarefa
  [`booking.ts:101-133`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/booking.ts#L101),
  recurso l.137-152, material l.155-170). Modelo: `ChargeBooking` (fonte única
  do booking de charge após C18 remover o órfão `ExtendedBooking`).
- **Material (data única):** `booking material <id> [quantity] <q> [unitprice
  <p>] on <data>` — `materialBooking` com `_on !date`
  ([`material.ts:347-360`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/material.ts#L347)).
- **Stock (data única):** `material { booking [quantity] <q> [unitprice <p>] on
  <data> }` — `materialBookingBody` (sem referência de tarefa)
  ([`material.ts:383-395`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/material.ts#L383)).

### 1.4 Maquinaria de `<modifier>` que **já existe** (reuso, não reinvenção)

- `distribution.ts` (`countEligibleDays`, `distributeDays`, `distributeFractions`,
  `perPeriod`, `DistributionContext`, `PeriodModifier`) e
  `ExtendedCharge` com `ExtendedChargeModifier = onstart|onend|perhour|perday|
  perweek|permonth|distributed|distribution` —
  [`extended-charge.ts:20-28`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/extended-charge.ts#L20);
  `turnover(period)` corta e distribui pelo período (Fase 8.1/10, §3.1–§3.6).
- **Alocação de material** já usa o parser de modificador
  (`_onstart`/`_onend`/`_perday`/`_distributed`/…) →
  `MaterialAllocationModifier` default `"distributed"` —
  [`material.ts:455-495`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/material.ts#L455).
- **Alocação de charge** (`charge <montante> <mode>`) já mapeia
  `onstart/onend/perhour/perday/perweek` —
  [`task.ts:856-890`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/task.ts#L856).

> Conclusão da investigação: **o motor de distribuição temporal já está pronto e
> exercitado** (ExtendedCharge + distribution.ts). A Onda D é predominantemente
> **gramática + fiação**: fazer os *bookings* (charge/material/stock) aceitar
> `<modifier> <intervalo>[,…]` e rotear para o cálculo por período existente,
> mais a renomeação de nomenclatura. Não há novo algoritmo de distribuição a
> escrever.

---

## 2. Divergências / pontos de atrito a resolver

| # | Hoje | Alvo | Risco |
|---|------|------|-------|
| D-a | Bucket `task` | Bucket `charge` (campo da interface + todos os usos) | Baixo (rename mecânico; golden não vê o nome interno) |
| D-b | `aggregate tasks` | `aggregate charges`, `tasks` vira alias de leitura (tj3) | Médio (parser + default em scenario.ts + `=== "tasks"`) |
| D-c | `booking charge … on <data>` | `booking charge … [value] <montante> <modifier> <intervalo>[,…]` | Alto (3 origens + modelo ChargeBooking + turnover) |
| D-d | `booking material … on <data>` | `booking material <id> [quantity] <q> [unitprice <p>] <modifier> <intervalo>[,…]` | Alto |
| D-e | stock `booking … on <data>` | `booking … <modifier> <intervalo>[,…]` | Médio (AccountScenario#addStockBookings corta por dia) |
| D-f | `booking effort <recurso>` | `booking resource <recurso>` (keyword do tipo) + manter `booking <recurso>` canônico | Médio (scanner/keyword + docs) |
| D-g | `task { material <id> <qty> <modifier> }` alocação já tem modifier, mas **sem `unitprice` opcional** antes do modifier | `material <id> [quantity] <qty> [unitprice <p>] <modifier>` | Baixo |

**ExtendedBooking**: já foi **apagado** na Onda C/C18. O plano original citava
`ExtendedBooking` em `extended-booking.ts`; a realidade da árvore é
`ChargeBooking` (fonte única) — todo o trabalho de booking de charge se faz
sobre `ChargeBooking`, **não** sobre uma classe extinta.

---

## 3. Plano de implementação (sub-ondas ordenadas por risco)

Cada sub-onda termina verde no gate (`deno check`, `deno task test`,
`check:all`, `check:stubs`, `fmt`/`lint`; goldens só podem mexer por motivo
justificado e anotado).

### D1 — Nomenclatura do bucket (D-a) — *mecânico, sem mudança de comportamento*

1. Renomear campo `task`→`charge` em `AccountBuckets`
   ([`account-scenario.ts:36-40`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L36))
   e **todos** os usos (`buckets.task`, parâmetros `type: "task"|…`,
   `turnoverByType` case `"task"`). Atualizar `getBuckets()` consumidores.
2. Expor leitura por nome canônico, mantendo `turnoverByType`:
   adicionar `chargeTotal()`, `resourceTotal()`, `materialTotal()` (ou renomear
   o que hoje só existe via `turnoverByType("task")`) para a simetria pedida no
   plano. Procurar `taskTotal`/`materialTotal` em relatórios: hoje só existe
   `materialTotalCost` (privado, `table-report.ts:1419`) e `resourceTotal`
   (niku) — nada a renomear no core além do bucket.
3. Testes: ajuste dos asserts que leem `getBuckets().task` → `.charge`;
   `breakdownreport`/`accountreport` inalterados (nome interno não aparece na
   saída). **Sem** mudança de golden esperada.

### D2 — `aggregate charges` (D-b) — *parser + default + runtime*

1. Em `rule("aggregate")` ([`task.ts:1400-1407`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/task.ts#L1400)):
   adicionar `_charges` → `"charges"`; **manter** `_tasks` → `"tasks"` como alias
   de leitura (tj3). `descr`/doc atualizados.
2. `AccountScenario`: tratar `"charges"` e `"tasks"` como o **mesmo** regime
   (agrega `project.tasks` no bucket `charge`), isto é, a condição passa a
   `if (aggregate === "charges" || aggregate === "tasks")`
   ([`account-scenario.ts:149`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L149)).
3. `scenario.ts:480-485`: o default derivado passa a `"charges"` ao gerar novo
   `.tjp`, mas continua aceitando `"tasks"` quando lido de fixture tj3.
4. Testes/goldens: fixture que declara `aggregate tasks` **não** deve mudar de
   resultado (alias); adicionar caso `aggregate charges` equivalente. Verificar
   `account`-report goldens estáveis.

### D3 — Booking de charge/material/stock temporal (D-c/D-d/D-e) — *o maior*

Estratégia: **não** criar novo motor — reutilizar `ExtendedCharge`/`distribution.ts`
e o caminho de cálculo de material já portado (`Material#*InPeriod`).

1. **Gramática**: substituir `_on !date` por `!chargeModifier !valIntervals`
   (lista de intervalos) nos cabeçalhos
   ([`booking.ts:101-170`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/booking.ts#L101)
   e [`material.ts:347-395`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/material.ts#L347)).
   Um único `chargeModifier`/`materialBookingModifier` cobrindo
   `onstart|onend|perhour|perday|perweek|permonth|distributed|distribution { … }`
   (mesmo vocabulário da alocação, para consistência).
2. **Modelo**: dar a `ChargeBooking` e `MaterialBooking` um campo de **período +
   modifier** (em vez de `date` único). Aceitar o intervalo de referência (a
   tarefa-dona para charge; `[start,end]` explícito para stock) e calcular o
   valor no período com a mesma matemática de `ExtendedCharge.turnover` /
   `Material#*InPeriod`. Manter **retro-compatibilidade de parsing** se
   desejado (um `on <data>` vira um intervalo degenerate de 1 dia), ou migrar
   de uma vez (decisão: **migrar**, com regeneração dos fixtures que usam a
   sintaxe antiga).
3. **Contabilização**: `AccountScenario#addStockBookings`
   ([`account-scenario.ts:284-328`](file:///home/aarvati/github/syntaxmesh/packages/core/src/model/account-scenario.ts#L284))
   deixa de filtrar `booking.date` pontual e passa a somar o valor **distribuído**
   pelo período da query/relatório; emitir `CostEvent` `material_usage` com a
   quantia efetiva do período (idempotência preservada).
4. **Relatórios/exports**: `materialreport` (colunas de estoque/custo), RDO,
   breakdown, `tjp-export` e MSPDI precisam refletir o booking agora temporal —
   revisar `genMaterialCell`, `stockBookingsInPeriod` (agora no `Material`, fonte
   única da Onda C) e o exportador TJP para **reemitir** a nova sintaxe
   (`booking … <modifier> …`) no round-trip.
5. **Testes (BDD)**: por origem (tarefa/recurso/material/stock) × por modifier
   (onstart/onend/perday/distributed/distribution), comparando o valor no
   período esperado; um caso por intervalo múltiplo (`[i1, i2]`); round-trip TJP.
   Este é o maior volume de testes novos.

### D4 — `booking resource` keyword (D-f) + unitprice opcional (D-g)

1. Adicionar keyword de **tipo** ao booking canônico: `booking resource <id>
   <intervalo>` como forma explícita, mantendo `booking <id> <intervalo>`
   (canônica TJ) e removendo/convertendo `effort`→`resource` na keyword de
   desambiguação (`bookingEffortKeyword`, [`task.ts:687-705`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/task.ts#L687)).
   Se `effort` já foi aceito, decidir se vira alias de leitura ou é removido —
   alinhado com a política de alias de `aggregate`.
2. Alocação de material: aceitar `unitprice <p>` **opcional antes do modifier**
   na forma de tarefa (`material <id> [quantity] <qty> [unitprice <p>]
   <modifier>`) — [`material.ts:314-330`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/material.ts#L314).
   `defaultaccount [material|resource|charge]` **já** usa a nomenclatura alvo —
   nada a mudar ali (confirmado [`project.ts:163-250`](file:///home/aarvati/github/syntaxmesh/packages/core/src/parser/rules/project.ts#L163)).

---

## 4. Estratégia de testes e gate por sub-onda

- **Ordem:** D1 → D2 (baixo risco, destravam nomes) → D4 (keyword) → D3
  (gramática temporal, o mudanção). D1/D2/D4 podem ser commits separados e
  verdes; D3 provavelmente toca fixtures e exige `golden:generate`.
- **Invariante de paridade:** nenhuma sub-onda deve alterar o **resultado** dos
  relatórios do conjunto golden já verde, exceto onde a sintaxe nova
  legitimamente reinterpreta um `.tjp` (marcar em `PENDING_DIVERGENCES` só se
  temporário, com razão e fase).
- **Gate por sub-onda:** `deno check packages/core/mod.ts` · `deno task test`
  (0 falhas) · `deno task check:all` exit 0 · `check:stubs` OK · `fmt`/`lint`
  limpos nos arquivos tocados · `golden:generate` + inspeção de diff (aceitar
  só mudança justificada).

---

## 5. Rastreabilidade

- Este documento era a entrega da **todo d0** (investigar + planejar a Onda D).
- **Implementação D1–D4 concluída em 2026-11-04** (`CURRENT.md`, linha
  "14-C Onda D implementada"). Gate final verde: suíte core **497 testes /
  5005 passos / 0 falhas** (era 488/4966) · `deno check packages/core/mod.ts`
  limpo · `deno task check:all` exit 0 · `check:stubs` OK · goldens inalterados
  (sem `golden:generate`, porque o caminho legado de `on <data>` ficou intacto
  e nenhum `.tjp` do conjunto golden usa a sintaxe temporal nova) · `fmt`/`lint`
  limpos nos arquivos tocados.
- **Desvios do plano (§3) adotados na execução:**
  - **D3 não reusa `ExtendedCharge`/`distribution.ts`** diretamente: a
    distribuição do booking é um fato *real calendar-based* (dinheiro/material
    em datas), não previsão sobre a agenda; a matemática vive em fonte única
    própria `model/booking-period.ts`. Só o **vocabulário de literais** do
    modifier é compartilhado com a alocação. `distribution.ts` é espelhado
    apenas na **convenção de contagem de dias** (índice inteiro, iteração
    inclusiva dia-a-dia).
  - **Sem migração de fixtures**: `on <data>` permanece válido (tail degenerado
    `onstart`/1-dia, `isTemporal()===false`); a decisão "migrar" do §3.D3.2 foi
    substituída por **retro-compatibilidade preservada** — garantia de zero
    drift de golden.
  - **Charge é parse-only** *(status 2026-11-08)*: `ChargeBooking` guarda o
    tail mas ainda não tinha consumer contábil (carga no turnover) — ficava a
    cargo da Fase 18, como registrado no §13.7 da Fase 14 Complemento.
    **Consumer entregue na Fase 21 1ª onda (2026-11-10)**:
    `AccountScenario#addChargeBookings` chamado do ramo
    `aggregate === "charges" | "tasks"` de `turnover`, emitindo
    `CostEvent task_charge`/`actual` idempotente. Ver matriz §D/D9 e
    `packages/core/tests/model/account-scenario-charge-booking_test.ts`.
- Relação com ondas já entregues: D3 reusa a **fonte única** de cálculo de
  material da Onda C (`Material#*InPeriod`), adicionando-lhes o gate
  `isTemporal()` (path legado intacto + path temporal via `booking-period.ts`).
