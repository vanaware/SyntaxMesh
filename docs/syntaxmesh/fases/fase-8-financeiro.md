# Fase 8 — Sistema Financeiro

> **Arquivo:** `docs/syntaxmesh/fases/fase-8-financeiro.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 4–6 dias
> **Depende de:** Fases 2–7
> **Bloqueia:** Fases 9, 14, 21

---

## 1. Contexto

O sistema financeiro do TaskJuggler é composto por 4 classes que trabalham juntas:

1. **`Charge`** — cobrança pontual ou periódica associada a uma task (`onStart`, `onEnd`, `perDiem`).
2. **`ChargeSet`** — distribuição do turnover de uma task ou recurso entre múltiplas contas (ex: 70% dev, 30% infra).
3. **`AccountCredit`** — crédito manual em uma data específica.
4. **`AccountScenario`** — o **turnover recursivo**: soma dos créditos, dos filhos da conta, das tasks (`aggregate: tasks`) ou dos recursos (`aggregate: resources`), com cálculo de balance via **meta-account**.

O fluxo financeiro completo é:

```
Task (com chargeset) → Charge.turnover(period) + resourceCost
                     ↓
              totalCost × shares
                     ↓
        conta destino (leaf account)
                     ↓
        AccountScenario.turnover → balance
                     ↓
              Report (balance cost revenue)
```

Esta fase também **completa** o pipeline de `turnover` que foi parcialmente implementado em Fase 7 (`TaskScenario.turnover` e `ResourceScenario.turnover` dependem de `Charge`/`ChargeSet`).

**Importante:** o sistema financeiro é **alta prioridade** (junto com scheduler e resources). Isso está alinhado com o roadmap. Sem ele, o `mwe004` (financial) não roda e vários relatórios não funcionam.

---

## 2. Objetivo

Ao final desta fase:

- `AccountCredit` implementado.
- `Charge` implementado (`onStart`, `onEnd`, `perDiem`, `turnover(period)`).
- `ChargeSet` implementado (`addAccount`, `complete`, `share`, `master`, `each`).
- `AccountScenario.turnover` recursivo com suporte a **meta-account** para balance.
- `AccountScenario.query_balance` e `query_turnover`.
- `TaskScenario.turnover` **completo** (integração com `Charge` + `ChargeSet`).
- `ResourceScenario.turnover` **completo**.
- `AccountListRE` (relatório de contas) com **modo balance** — subfase preparatória para Fase 14.
- **≥ 80 testes unitários** + **≥ 25 golden tests** (mwe004 + variações).
- ADR 018 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Charge.rb` | ~80 | Baixa | **Crítica** |
| `ChargeSet.rb` | ~130 | Média | **Crítica** |
| `AccountCredit.rb` | ~30 | Trivial | **Crítica** |
| `AccountScenario.rb` | ~130 | Alta | **Crítica** |
| `Account.rb` | (Fase 5 — revisitar) | Baixa | Suporte |
| `TaskScenario.rb` | `turnover` (seção) | Alta | **Crítica** |
| `ResourceScenario.rb` | `turnover`, `cost` | Média | **Crítica** |
| `reports/AccountListRE.rb` | ~120 | Média | Suporte |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/10-blueprint-finance.md` | §1 Visão geral | Fluxo completo |
| `docs/tj3-engine/10-blueprint-finance.md` | §2 Charge | Modos e turnover |
| `docs/tj3-engine/10-blueprint-finance.md` | §3 ChargeSet | Distribuição |
| `docs/tj3-engine/10-blueprint-finance.md` | §4 Account | `aggregate` |
| `docs/tj3-engine/10-blueprint-finance.md` | §5 AccountCredit | Simples |
| `docs/tj3-engine/10-blueprint-finance.md` | §6 AccountScenario | Turnover e balance |
| `docs/tj3-engine/10-blueprint-finance.md` | §7 Fluxo completo | Exemplo |

### 3.3 Casos de teste Ruby

- `docs/Learning/mwe004/tutorial.tjp` — MWEs financeiros (accounts, rates, charges, PnL).
- Variações para testar:
  - `chargeset` com 1 conta (100%).
  - `chargeset` com 2 contas (70/30).
  - `chargeset` com shares `null` (distribuição automática).
  - `charge onStart`, `onEnd`, `perDiem`.
  - `credit` manual.
  - `aggregate: tasks` vs `aggregate: resources`.
  - `balance cost revenue`.

### 3.4 Golden tests

Script Ruby `finance.rb` que cobre:
1. mwe004 direto.
2. Variações de chargeset.
3. Meta-account.

Extrai do HTML gerado o valor de `query_balance`, `query_turnover`, `query_cost`, `query_revenue` de cada conta.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `Float` para valores monetários

Ruby usa `Float` para `amount`, `rate`, `credits.amount`. Não usa `BigDecimal`. **Decisão:** replicar com `number` (IEEE 754 double).

**Risco:** `0.1 + 0.2 !== 0.3`. Aceito — mesma semântica do Ruby. Se precisão se tornar problema em relatórios, migrar para `Decimal` em fase futura.

Ver ADR 018.

### 4.2 Meta-account: padrão para balance

Quando um report declara `balance cost revenue`, o TaskJuggler **cria uma conta temporária** com:
- `adoptees[0] = costAccount`
- `adoptees[1] = revenueAccount`
- `turnover = -adoptees[0].turnover + adoptees[1].turnover`

Em `AccountScenario.turnover`, o caso `adoptees não vazio` é tratado **antes** do caso `children não vazio`. Replicar fielmente.

### 4.3 `Account.root` e `Account.isChildOf?`

`ChargeSet.addAccount` valida que todas as contas pertencem ao mesmo `root`. `Account.isChildOf?` já vem de `PropertyTreeNode`.

### 4.4 `Charge.turnover(period)` — 3 modos

| Modo | Retorna |
|---|---|
| `onStart` | `period.contains(task.start) ? amount : 0` |
| `onEnd` | `period.contains(task.end) ? amount : 0` |
| `perDiem` | `period.intersection([task.start, task.end]).duration / 86400 * amount` |

**Importante:** `perhour` e `perweek` são convertidos para `perDiem` no parser (`Rule_charge`). O modelo só vê `onStart`/`onEnd`/`perDiem`.

### 4.5 `ChargeSet.complete()` distribui remainder

Se `undefined > 0`, distribui `(1.0 - totalPercent) / undefined` para cada conta sem share.

Se `undefined === 0`, valida que total é exatamente `1.0`.

### 4.6 `AccountScenario.turnover(startIdx, endIdx)` — ordem exata

1. Créditos manuais no intervalo.
2. Se container:
   - Se `adoptees não vazio`, meta-account.
   - Senão, soma de `children.turnover`.
3. Senão, dispatch por `aggregate`:
   - `tasks`: soma de `task.turnover(scIdx, startIdx, endIdx, account, null, false)`.
   - `resources`: soma de `resource.turnover(scIdx, startIdx, endIdx, account, null, false)`.
4. **Sem cache** — o Ruby não tem `DataCache` aqui. Replicar.

### 4.7 `TaskScenario.turnover` — pipeline completo

O código completo:
1. Se container && includeKids: soma children.
2. `chargeset = resource ? resource.chargeset : this.chargeset`.
3. Se vazio, retorna 0.
4. `resourceCost = resource ? resource.cost(...) : sum(r.cost(...))`.
5. `otherCost = sum(charge.turnover(iv))`.
6. `totalCost = resourceCost + otherCost`.
7. Para cada `set` em `chargeset`, para cada `(account, share)`: se `accnt === account || accnt.isChildOf(account)`, `amount += totalCost * share`.

**Nota:** `resourceCost` é 0 para container tasks (sem `assignedresources`).

### 4.8 `ResourceScenario.turnover`

Análogo, mas:
- Se `task` fornecido, delega para `task.turnover(scIdx, startIdx, endIdx, account, this.property)`.
- Senão, itera `chargeset` (do **recurso**), calcula `totalResourceCost = cost(startIdx, endIdx)`.

### 4.9 `AccountListRE` — balance mode

Em Fase 7 (seção 14) ainda não implementamos `AccountListRE`. Aqui adicionamos o **modo balance**:
1. Cria `costAccountList` e `revenueAccountList` filtrando `accountList`.
2. Garante que `costAccount` e `revenueAccount` estão incluídos.
3. Chama `generateAccountList` duas vezes.
4. Cria `totalAccount` temporária que adota cost/revenue; chama `generateAccountList` para a linha total.
5. `project.removeAccount(totalAccount)`.

**Nota:** a geração completa do relatório HTML é Fase 14. Aqui só a lógica de balance.

### 4.10 Erros

- `AccountScenario` usa `error('...', ...)` (via `ScenarioData`).
- `ChargeSet` lança `TjException` em validações (traduzido para `TjArgumentError`).
- `TaskScenario.turnover` não lança — retorna 0 em casos indefinidos.

### 4.11 Performance

O `AccountScenario.turnover` é **O(tasks) × O(accounts)** sem cache. Para projetos grandes, isso degrada. O Ruby aceita (com comentário `TODO: inefficient`). **Decisão:** replicar; se perf virar problema, adicionar `DataCache` em fase futura.

### 4.12 `AccountCredit`

Trivial — `{ date, description, amount }`. Sem lógica.

---

## 5. Subfases detalhadas

---

### 8.0 — ADR 018 (modelo financeiro)

#### Contexto

O sistema financeiro do TaskJuggler tem 3 decisões implícitas no Ruby que precisam ser formalizadas:

1. **Representação numérica** — `Float` (sem `BigDecimal`).
2. **Meta-account** — padrão para cálculo de balance em reports.
3. **Sem cache no `AccountScenario.turnover`** — aceito apesar de O(n²).

#### Objetivo

Criar `docs/syntaxmesh/decisoes/018-modelo-financeiro.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/018-modelo-financeiro.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** explicar o pipeline financeiro e as 3 decisões.
- [ ] **Decisões:**
  - `Float` (number JS) para valores; sem migração para `Decimal` nesta fase.
  - Meta-account documentada como padrão para balance.
  - Sem cache em `turnover` — replicar ineficiência do Ruby.
- [ ] **Alternativas:** `Decimal`, `BigInt` com escala fixa, cache.
- [ ] **Consequências:**
  - **Positivas:** fidelidade bit-a-bit com TJ; simples.
  - **Negativas:** erros de arredondamento; perf em projetos grandes.
  - **Mitigação:** golden tests; cache em fase futura se necessário.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Charge.rb`.
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`.
- `docs/tj3-engine/10-blueprint-finance.md`.
- Seções 4.1, 4.2, 4.11.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADR 018 criado.
- Tabela atualizada.

---

### 8.1 — `AccountCredit`

#### Contexto

Classe trivial que representa um crédito manual em uma conta.

#### Objetivo

Implementar `AccountCredit`.

#### Arquivos

- `packages/core/src/finance/account-credit.ts`
- `packages/core/tests/finance/account-credit_test.ts`

#### Requisitos

- [ ] `class AccountCredit`:
  - `readonly date: TjTime`
  - `readonly description: string`
  - `readonly amount: number`
- [ ] Constructor `(date, description, amount)`.

**Nota:** é essencialmente uma struct. Nada mais.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AccountCredit.rb`.

#### Fora de escopo

- Uso — subfase 12.4.

#### Critério de aceite

```ts
const c = new AccountCredit(TjTime.fromString("2026-03-15"), "Bonus", 5000);
assertEquals(c.amount, 5000);
```

#### Testes

- `account-credit_test.ts`:
  - `describe("AccountCredit")`
    - `it("armazena date, description, amount")`.
    - `it("valores negativos aceitos")`.

---

### 8.2 — `Charge`

#### Contexto

`Charge` é uma cobrança (uma vez ou periódica) associada a uma task.

#### Objetivo

Implementar `Charge` com `turnover(period)`.

#### Arquivos

- `packages/core/src/finance/charge.ts`
- `packages/core/tests/finance/charge_test.ts`

#### Requisitos

- [ ] `type ChargeMode = 'onStart' | 'onEnd' | 'perDiem'`.
- [ ] `class Charge`:
  - `readonly amount: number`
  - `readonly mode: ChargeMode`
  - `readonly task: Task`
  - `readonly scenarioIdx: number`
- [ ] Constructor `(amount, mode, task, scenarioIdx)`:
  - Valida que `mode` é uma das 3 opções; senão `TjArgumentError`.
- [ ] `turnover(period: TimeInterval): number`:
  - `onStart`: `period.contains(task.get('start', scIdx)) ? amount : 0.0`.
  - `onEnd`: `period.contains(task.get('end', scIdx)) ? amount : 0.0`.
  - `perDiem`:
    - `iv = period.intersection(new TimeInterval(task.get('start', scIdx), task.get('end', scIdx)))`.
    - Se `iv`, `(iv.duration() / 86400) * amount`.
    - Senão, `0.0`.
- [ ] `to_s(): string`:
  - `onStart` → `"${amount} on start"`.
  - `onEnd` → `"${amount} on end"`.
  - `perDiem` → `"${amount} per day"`.

**Nota:** `task.get('start', scIdx)` pode ser null antes de agendar. Replicar o comportamento do Ruby: se `period.contains(null)` retorna `false` (o `contains` do Ruby trata `nil` retornando `false`). Em TS, checar explicitamente:

```ts
const start = this.task.get('start', this.scenarioIdx) as TjTime | null;
if (start === null) return 0.0;
return period.contains(start) ? this.amount : 0.0;
```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Charge.rb` — arquivo completo.
- `docs/tj3-engine/10-blueprint-finance.md` — §2.

#### Fora de escopo

- Parser (`perhour` → `perDiem` conversão) — Fase 10.

#### Critério de aceite

```ts
const t = new Task(mp, 't1', 'Task 1', null);
t.setForScenario('start', TjTime.fromString("2026-01-05"), 0);
t.setForScenario('end', TjTime.fromString("2026-01-15"), 0);
const c = new Charge(1000, 'perDiem', t, 0);
const period = new TimeInterval(
  TjTime.fromString("2026-01-05"),
  TjTime.fromString("2026-01-15"),
);
assertEquals(c.turnover(period), 10000);
```

#### Testes

- `charge_test.ts`:
  - `describe("Charge")`
    - `it("onStart retorna amount se start está no period")`.
    - `it("onStart retorna 0 se start fora")`.
    - `it("onStart retorna 0 se start null")`.
    - `it("onEnd retorna amount se end está no period")`.
    - `it("onEnd retorna 0 se end null")`.
    - `it("perDiem 10 dias = 10 × amount")`.
    - `it("perDiem interseção parcial")`.
    - `it("perDiem sem interseção = 0")`.
    - `it("constructor rejeita mode inválido")`.
    - `it("to_s em cada mode")`.

---

### 8.3 — `ChargeSet`

#### Contexto

`ChargeSet` distribui o turnover de uma task/recurso entre múltiplas contas, com shares que somam 100%.

#### Objetivo

Implementar `ChargeSet` com validações e distribuição automática.

#### Arquivos

- `packages/core/src/finance/charge-set.ts`
- `packages/core/tests/finance/charge-set_test.ts`

#### Requisitos

- [ ] `class ChargeSet`:
  - `private set: Map<Account, number | null>`
  - `private masterAccount: Account | null`
- [ ] `get master(): Account | null`.
- [ ] `addAccount(account: Account, share: number | null): void`:
  - Se `!account.leaf()`, `TjArgumentError` ("group account cannot be used").
  - Se `set.has(account)`, `TjArgumentError` ("already member").
  - Se `masterAccount === null`, `masterAccount = account.root()`.
  - Senão, se `masterAccount !== account.root()`, `TjArgumentError` ("must belong to same root").
  - Se `account.container()` (mas já validado como leaf), `TjArgumentError` ("only leaf").
  - Se `share !== null && (share < 0 || share > 1)`, `TjArgumentError` ("share 0-100%").
  - `set.set(account, share)`.
- [ ] `each(fn: (account, share) => void): void`.
- [ ] `complete(): void`:
  - `totalPercent = 0`, `undefined = 0`.
  - Para cada `share`: se não null, `totalPercent += share`; senão `undefined += 1`.
  - Se `totalPercent > 1.0`, `TjArgumentError` ("exceeds 100%").
  - Se `undefined > 0`:
    - `commonShare = (1.0 - totalPercent) / undefined`.
    - Se `commonShare <= 0`, `TjArgumentError` ("total 100% but N accounts").
    - Substituir `null` por `commonShare`.
  - Senão, se `totalPercent !== 1.0`, `TjArgumentError` ("total is X% instead of 100%").
- [ ] `share(account: Account): number | null`.
- [ ] `to_s(): string` — `"(account1 70%, account2 30%)"`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb` — arquivo completo.
- `docs/tj3-engine/10-blueprint-finance.md` — §3.

#### Fora de escopo

- Uso — subfase 12.5.

#### Critério de aceite

```ts
const cs = new ChargeSet();
cs.addAccount(devAccount, 0.7);
cs.addAccount(infraAccount, 0.3);
cs.complete();
assertEquals(cs.share(devAccount), 0.7);
```

#### Testes

- `charge-set_test.ts`:
  - `describe("ChargeSet")`
    - `it("addAccount define master na primeira vez")`.
    - `it("addAccount rejeita group account")`.
    - `it("addAccount rejeita duplicata")`.
    - `it("addAccount rejeita roots diferentes")`.
    - `it("addAccount rejeita share > 1")`.
    - `it("addAccount rejeita share < 0")`.
    - `it("complete distribui remainder")`.
    - `it("complete rejeita total > 100%")`.
    - `it("complete rejeita total != 100% sem undefined")`.
    - `it("complete rejeita commonShare <= 0")`.
    - `it("share")`.
    - `it("each")`.
    - `it("to_s")`.

---

### 8.4 — `AccountScenario.turnover` + `query_balance` + `query_turnover`

#### Contexto

O turnover de uma conta é calculado recursivamente:
- Créditos manuais.
- Container: soma filhos ou **meta-account**.
- Leaf: `aggregate: tasks` ou `aggregate: resources`.

#### Objetivo

Implementar `AccountScenario.turnover`, `query_balance`, `query_turnover`.

#### Arquivos

- `packages/core/src/model/account-scenario.ts` (estender)
- `packages/core/tests/model/account-scenario-turnover_test.ts`

#### Requisitos

**`turnover(startIdx: number, endIdx: number): number`:**

- [ ] `amount = 0.0`.
- [ ] **Créditos manuais:**
  - `credits = this.a('credits') as AccountCredit[]`.
  - `startDate = project.idxToDate(startIdx)`, `endDate = project.idxToDate(endIdx)`.
  - Para cada `credit`: se `startDate <= credit.date && credit.date < endDate`, `amount += credit.amount`.
- [ ] **Container:**
  - Se `property.container()`:
    - Se `property.adoptees.empty`, para cada child: `amount += child.scenarioData(scIdx).turnover(startIdx, endIdx)`.
    - Senão (meta-account):
      - `amount += -adoptees[0].turnover(scIdx, startIdx, endIdx) + adoptees[1].turnover(scIdx, startIdx, endIdx)`.
- [ ] **Leaf:**
  - `aggregate = this.a('aggregate') as string`.
  - `tasks`: para cada task em `project.tasks`: `amount += task.scenarioData(scIdx).turnover(startIdx, endIdx, this.property, null, false)`.
  - `resources`: para cada resource em `project.resources`, se `resource.leaf()`: `amount += resource.scenarioData(scIdx).turnover(startIdx, endIdx, this.property, null, false)`.
  - Senão, `throw TjInternalError`.

**`query_balance(query: Query): void`:**

- [ ] `startIdx = 0`, `endIdx = project.dateToIdx(query.start)`.
- [ ] `amount = turnover(startIdx, endIdx)`.
- [ ] `query.sortable = query.numerical = amount`.
- [ ] `query.string = query.currencyFormat.format(amount)`.

**`query_turnover(query: Query): void`:**

- [ ] `startIdx = project.dateToIdx(query.start)`, `endIdx = project.dateToIdx(query.end)`.
- [ ] Análogo.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb` — arquivo completo.
- `docs/tj3-engine/10-blueprint-finance.md` — §6.

#### Fora de escopo

- Meta-account creation (feita por `AccountListRE` — subfase 12.7).
- Report generation — Fase 14.

#### Critério de aceite

Análogo.

#### Testes

- `account-scenario-turnover_test.ts`:
  - `describe("AccountScenario.turnover")`
    - `it("créditos manuais no intervalo")`.
    - `it("créditos fora do intervalo ignorados")`.
    - `it("container soma filhos")`.
    - `it("meta-account cost + revenue")`.
    - `it("aggregate tasks soma over tasks")`.
    - `it("aggregate resources soma over resources")`.
  - `describe("AccountScenario.query_balance")`
    - `it("retorna turnover do início ao query.start")`.
    - `it("formata com currencyFormat")`.
  - `describe("AccountScenario.query_turnover")`
    - `it("retorna turnover do período")`.

---

### 8.5 — `TaskScenario.turnover` — pipeline completo

#### Contexto

A Fase 7 implementou `TaskScenario.turnover` mas com dependências de `Charge`/`ChargeSet`. Aqui **consolidamos** com o pipeline completo.

**Importante:** se a implementação da Fase 7 já está completa (por assumir `Charge.turnover`), esta subfase só adiciona testes de integração. Caso contrário, completa a lógica.

#### Objetivo

Garantir que `TaskScenario.turnover` funciona end-to-end com `Charge` + `ChargeSet`.

#### Arquivos

- `packages/core/src/model/task-scenario.ts` (revisar `turnover`)
- `packages/core/tests/model/task-scenario-turnover_test.ts`

#### Requisitos

**`turnover(startIdx, endIdx, account, resource = null, includeKids = true): number`:**

- [ ] `amount = 0.0`.
- [ ] **Container com kids:**
  - Se `property.container() && includeKids`: soma `children.turnover(...)`.
- [ ] **Chargeset:**
  - `chargeset = resource ? resource.get('chargeset', scIdx) : this.a('chargeset')`.
  - Se `chargeset.empty`, retorna `amount`.
- [ ] **resourceCost:**
  - Se `!property.container()`:
    - Se `resource`: `resourceCost = resource.scenarioData(scIdx).cost(startIdx, endIdx, this.property)`.
    - Senão: `resourceCost = sum(r.scenarioData(scIdx).cost(startIdx, endIdx, this.property) for r in this.assignedresources)`.
- [ ] **otherCost:**
  - Se `this.a('charge')` não vazio:
    - `startDate = isTjTime(startIdx) ? startIdx : project.idxToDate(startIdx)`.
    - `endDate = isTjTime(endIdx) ? endIdx : project.idxToDate(endIdx)`.
    - `iv = new TimeInterval(startDate, endDate)`.
    - `otherCost = sum(charge.turnover(iv) for charge in this.a('charge'))`.
- [ ] **totalCost = resourceCost + otherCost**.
- [ ] **Distribuição:**
  - Para cada `set` em `chargeset`, para cada `(accnt, share)`:
    - Se `share > 0 && (accnt === account || accnt.isChildOf(account))`:
      - `amount += totalCost * share`.
- [ ] Retorna `amount`.

**Tipos de `startIdx`/`endIdx`:** o Ruby aceita `TjTime` ou índice. Em TS, unificar para `number` (sempre índices) e converter internamente quando precisar de datas. **Alternativa:** aceitar `number` (índices) por consistência com `AccountScenario.turnover`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — método `turnover`.
- `docs/tj3-engine/10-blueprint-finance.md` — §7.

#### Fora de escopo

- Report de custo (`query_cost` já feito em 11.16).

#### Critério de aceite

Análogo.

#### Testes

- `task-scenario-turnover_test.ts`:
  - `describe("TaskScenario.turnover")`
    - `it("container soma children")`.
    - `it("chargeset 100% para 1 conta")`.
    - `it("chargeset 70/30 para 2 contas")`.
    - `it("inclui charge onStart")`.
    - `it("inclui charge perDiem")`.
    - `it("inclui resourceCost de assignedresources")`.
    - `it("filtra por account == filho")`.
    - `it("resource específico usa seu próprio chargeset")`.

---

### 8.6 — `ResourceScenario.turnover` — pipeline completo

#### Contexto

Análogo a 12.5, mas para recursos.

#### Objetivo

Garantir que `ResourceScenario.turnover` funciona end-to-end.

#### Arquivos

- `packages/core/src/model/resource-scenario.ts` (revisar `turnover` e `cost`)
- `packages/core/tests/model/resource-scenario-turnover_test.ts`

#### Requisitos

**`turnover(startIdx, endIdx, account, task = null, includeKids = false): number`:**

- [ ] `amount = 0.0`.
- [ ] **Container com kids:**
  - Se `property.container() && includeKids`: soma `children.turnover(...)`.
- [ ] **Leaf:**
  - Se `task`: `amount = task.scenarioData(scIdx).turnover(startIdx, endIdx, account, this.property)`.
  - Senão:
    - `chargeset = this.a('chargeset')`.
    - Se vazio, retorna 0.
    - `totalResourceCost = cost(startIdx, endIdx)`.
    - Para cada `set` em `chargeset`, para cada `(accnt, share)`: se `share > 0 && (accnt === account || accnt.isChildOf(account))`, `amount += totalResourceCost * share`.

**`cost(startIdx, endIdx, task = null): number`:**

- [ ] `getAllocatedTime(startIdx, endIdx, task) * rate`.
- [ ] `rate` já implementado em Fase 7.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — método `turnover`.
- `docs/tj3-engine/10-blueprint-finance.md` — §7.

#### Critério de aceite

Análogo.

#### Testes

- `resource-scenario-turnover_test.ts`:
  - `describe("ResourceScenario.turnover")`
    - `it("com task delega")`.
    - `it("sem task usa chargeset do recurso")`.
    - `it("container com kids")`.
    - `it("sem chargeset retorna 0")`.
  - `describe("ResourceScenario.cost")`
    - `it("rate × allocatedTime")`.

---

### 8.7 — Meta-account (utilitário)

#### Contexto

O meta-account é criado **dinamicamente** por `AccountListRE` quando o report tem `balance cost revenue`. Como `AccountListRE` completo é Fase 14, aqui criamos um **utilitário** que encapsula a criação e remoção.

#### Objetivo

Criar `createBalanceAccount(project, costAccount, revenueAccount): Account` que:
1. Cria uma conta temporária.
2. Adota cost e revenue como `adoptees`.
3. Retorna a conta.

E `removeBalanceAccount(project, account): void` que remove.

#### Arquivos

- `packages/core/src/finance/balance-account.ts`
- `packages/core/tests/finance/balance-account_test.ts`

#### Requisitos

- [ ] `createBalanceAccount(project, costAccount, revenueAccount): Account`:
  - Cria `new Account(project, '0', "Total", null)` (id `'0'`).
  - `account.adopt(costAccount)`.
  - `account.adopt(revenueAccount)`.
  - Retorna.
- [ ] `removeBalanceAccount(project, account): void`:
  - `project.removeAccount(account)`.

**Nota:** o `id` do Ruby é `'0'` mas pode colidir com uma conta existente. Usar um id único (`'_balance_' + counter`) para evitar colisão. Isso **não** afeta o comportamento visível.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb` — seção do balance.

#### Fora de escopo

- Uso completo em report — Fase 14.

#### Critério de aceite

```ts
const cost = new Account(mp, 'cost', 'Cost', null);
const rev = new Account(mp, 'rev', 'Revenue', null);
const balance = createBalanceAccount(mp, cost, rev);
assertEquals(balance.adoptees.length, 2);
// turnover(start, end) = -cost.turnover + rev.turnover
```

#### Testes

- `balance-account_test.ts`:
  - `describe("createBalanceAccount")`
    - `it("cria conta com 2 adoptees")`.
    - `it("turnover calcula revenue - cost")`.

---

### 8.8 — Golden tests (financeiro)

#### Contexto

Validar o pipeline financeiro contra `tj3`.

#### Objetivo

Rodar mwe004 + variações.

#### Arquivos

- `scripts/golden/finance-mwe004.rb`
- `scripts/golden/finance-variations.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/finance.golden.json`
- `packages/core/tests/golden/finance_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Script Ruby `finance-mwe004.rb`:**

- [ ] Roda `tj3 mwe004/tutorial.tjp`.
- [ ] Lê `PnL.html` e `Resources.html`.
- [ ] Extrai valores de `balance`, `turnover`, `cost`, `revenue` para cada conta.
- [ ] Serializa.

**Script Ruby `finance-variations.rb`:**

- [ ] Casos adicionais:
  - chargeset 100% 1 conta.
  - chargeset 70/30.
  - chargeset com shares null.
  - charge onStart, onEnd, perDiem.
  - credit manual positivo e negativo.
  - aggregate tasks vs resources.
  - balance cost revenue.

**Teste TS:**

- [ ] Lê o JSON.
- [ ] Para cada caso, constrói o cenário no `MockProject`.
- [ ] Compara valores (tolerância `1e-6` para floats).
- [ ] Cobertura ≥ 25 casos.

**Task `golden:generate`:**

- [ ] Adicionar os 2 scripts.

#### Referências

- `docs/Learning/mwe004/tutorial.tjp`.
- `docs/tj3-engine/10-blueprint-finance.md`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- HTML rendering de reports — Fase 14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 25 casos.
- Zero divergências (dentro de tolerância).

#### Testes

- `finance_golden_test.ts`:
  - `describe("Golden finance mwe004")` — itera casos.
  - `describe("Golden finance variations")`.

---

## 6. Ordem de execução sugerida

```text
12.0  ADR 018
      ↓
12.1  AccountCredit                ← pode rodar em paralelo com 12.2
12.2  Charge
      ↓
12.3  ChargeSet
      ↓
12.4  AccountScenario.turnover + queries
      ↓
12.5  TaskScenario.turnover (completo)
      ↓
12.6  ResourceScenario.turnover (completo)
      ↓
12.7  Meta-account (utilitário)
      ↓
12.8  Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 8 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `AccountCredit`, `Charge`, `ChargeSet` implementados.
- [ ] `AccountScenario.turnover` recursivo + meta-account.
- [ ] `AccountScenario.query_balance` e `query_turnover`.
- [ ] `TaskScenario.turnover` completo.
- [ ] `ResourceScenario.turnover` completo.
- [ ] `createBalanceAccount` / `removeBalanceAccount`.
- [ ] **≥ 80 testes unitários**.
- [ ] **≥ 25 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 018 criado.
- [ ] Scripts `finance-*.rb` funcionais.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Precisão de `Float` causa divergência em m2 | Médio | Tolerância `1e-6` nos golden tests; ADR documenta |
| Meta-account mal identificada (colisão de `id='0'`) | Médio | Usar id único gerado (`_balance_<n>`) |
| `AccountScenario.turnover` O(n²) degrada perf | Médio | Aceito nesta fase; cache em fase futura |
| `TaskScenario.turnover` com `resource` específico diverge | Alto | Golden tests com 3+ recursos |
| `ChargeSet.complete` sem chamar quebra distribuição | Alto | Testes verificam erro se não chamar |
| `perDiem` com interseção parcial imprecisa | Médio | Golden test com 3 dias de 10 |
| `resourceCost` para container tasks | Baixo | Teste garante 0 |
| `removeBalanceAccount` deixa referências órfãs | Médio | `removeReferences` chamado por `removeProperty` |
| `aggregate: resources` soma recursos não-leaf | Médio | Teste com hierarquia de recursos |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Charge.rb`
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountCredit.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/Account.rb`
- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` (método `turnover`)
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` (métodos `turnover`, `cost`)
- `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb` (balance mode)

### Blueprints

- `docs/tj3-engine/10-blueprint-finance.md` (seções 1–7)

### Documentos do projeto

- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/018-modelo-financeiro.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/Learning/mwe004/tutorial.tjp`

### Fases dependentes

- **Fase 9 — Orquestrador** (`Project.schedule` roda o pipeline financeiro).
- **Fase 14 — Reports** (`AccountListRE` completo com balance; `resourcereport` com `balance cost rev`).
- **Fase 21 — Compatibilidade** (golden tests mwe004).

---

## 10. Notas para a IA

1. **Fidelidade ao Ruby.** O `turnover` é O(n²) — replicar. Não otimizar prematuramente.
2. **`Float` sem `Decimal`.** Mesma semântica do Ruby. Tolerância `1e-6` em golden tests.
3. **Meta-account usa `adoptees`.** `adoptees[0]` = cost, `adoptees[1]` = revenue. Sinal: `-cost + revenue`.
4. **`Charge` valida `mode`.** Sem modo desconhecido.
5. **`ChargeSet.complete()` é obrigatório** antes de usar shares. Sem ele, shares `null` não são distribuídos.
6. **`master` é setado na primeira `addAccount`.** Se vazio, `master = null`.
7. **`TaskScenario.turnover` usa `resource.chargeset` se `resource` fornecido.** Não `this.chargeset`.
8. **`ResourceScenario.turnover` com `task` delega.** Sem task, usa chargeset do recurso.
9. **`aggregate: resources` filtra por `leaf()`.** Não somar grupos.
10. **`createBalanceAccount` usa id único.** Não usar `'0'` fixo (colisão).
11. **`removeBalanceAccount` chama `project.removeAccount`.** Propaga remoção de referências.
12. **`query_balance` sempre começa em idx 0.** Não é `query.startIdx`.
13. **Sem `any`.** Use `unknown` + narrowing.
14. **Commit por subfase.** `feat(core): charge`, `feat(core): account-scenario-turnover`, etc.
15. **Golden tests com mwe004 são o critério mais forte.**

---

## 11. ADR 018 (referência rápida)

Criado como subfase 12.0. Conteúdo esperado:

- **Título:** Modelo financeiro em TypeScript: Float, meta-account, sem cache
- **Contexto:** pipeline de `turnover`, decisões implícitas do Ruby.
- **Decisões:**
  - `Float` (number JS) — mesma semântica do Ruby.
  - Meta-account com `adoptees[0] = cost`, `adoptees[1] = revenue`.
  - Sem cache em `AccountScenario.turnover` — O(n²) aceito.
- **Alternativas:** `Decimal`, cache.
- **Consequências:** fidelidade + testabilidade; imprecisão e perf em projetos grandes.

---

**Fim da Fase 8.**