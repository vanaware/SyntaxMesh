# Fase 8 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-8-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-8-financeiro.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~125 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Charge,ChargeSet,AccountCredit,AccountScenario,Account}.rb` + seções `turnover` de `TaskScenario.rb` / `ResourceScenario.rb` + `reports/AccountListRE.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (Fase 7).
- **ADR 019** — Modelo financeiro (**criado nesta fase**).

### Convenções CRÍTICAS

- **`AttributeBase.setMode(0)` em `beforeEach`** — sem isso, testes vazam estado.
- **`Float` (number JS) para valores monetários** — sem `Decimal`, sem `BigInt`. Tolerância `1e-6` nos golden tests.
- **Meta-account usa `adoptees[0] = cost`, `adoptees[1] = revenue`.** Sinal: `-cost + revenue`.
- **`AccountScenario.turnover` é O(n²)** — replicar ineficiência do Ruby. Sem cache.
- **`Charge.mode`** — apenas 3 valores: `onStart`, `onEnd`, `perDiem`.
- **`ChargeSet.complete()`** é obrigatório antes de usar shares.
- **`createBalanceAccount` usa id único** (`_balance_<n>`) para evitar colisão com `'0'`.
- **`aggregate: resources` filtra por `leaf()`** — não somar grupos.
- **`TaskScenario.turnover` usa `resource.chargeset`** se `resource` fornecido (não `this.chargeset`).
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não implementar `Report` (Fase 14) — apenas o utilitário de balance.
- ❌ Não criar `AccountListRE` completo — só o utilitário `createBalanceAccount`.
- ❌ Não otimizar `turnover` com cache.
- ❌ Não usar `Decimal` ou arredondamento explícito.
- ❌ Não implementar `Charge.perhour`/`perweek` — só o que a Fase 10 (parser) converte para `perDiem`.
- ❌ Não reordenar branches de `turnover`.
- ❌ Não usar `Proxy`.

---

## Progresso

```
[ ] 8.0  ADR 019 (modelo financeiro)              —  0/5
[ ] 8.1  AccountCredit                            —  0/6
[ ] 8.2  Charge                                   —  0/22
[ ] 8.3  ChargeSet                                —  0/26
[ ] 8.4  AccountScenario.turnover + queries       —  0/24
[ ] 8.5  TaskScenario.turnover (completo)         —  0/14
[ ] 8.6  ResourceScenario.turnover + cost         —  0/12
[ ] 8.7  Meta-account (utilitário)                —  0/8
[ ] 8.8  Golden tests (financeiro)                —  0/10
[ ] 8.9  Verificação final                        —  0/8
─────────────────────────────────────────────────
TOTAL: ~125
```

---

## Bloco A — Fundação

### 8.0 — ADR 019 (modelo financeiro)

**Objetivo:** formalizar as 3 decisões implícitas do sistema financeiro.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.0.1 | Criar `docs/syntaxmesh/decisoes/019-modelo-financeiro.md` com frontmatter | idem | arquivo existe |
| 8.0.2 | Seção **Contexto:** pipeline financeiro (Charge → ChargeSet → AccountScenario → balance); 3 decisões implícitas | idem | — |
| 8.0.3 | Seção **Decisão 1:** `Float` (number JS) para valores; sem `Decimal`; tolerância `1e-6` nos golden tests | idem | — |
| 8.0.4 | Seção **Decisão 2:** meta-account com `adoptees[0] = cost`, `adoptees[1] = revenue`; sinal `-cost + revenue` | idem | — |
| 8.0.5 | Seção **Decisão 3:** sem cache em `AccountScenario.turnover` (O(n²) aceito); **Alternativas** + **Consequências**; atualizar linha `019` em `decisoes/README.md` | idem | 19 linhas |

---

## Bloco B — Estruturas financeiras

### 8.1 — `AccountCredit`

**⚠️ RUBY: `AccountCredit.rb` (arquivo inteiro — ~30 linhas)**
**🔎 CHEAT: §1 `Struct` → `interface` + factory**

**Pré-requisitos:** Fase 2 (`TjTime`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.1 | Criar `src/finance/account-credit.ts` com `class AccountCredit` vazia | idem | `deno check` |
| 8.1.2 | Campos `readonly date: TjTime`, `readonly description: string`, `readonly amount: number` | idem | `deno check` |
| 8.1.3 | Constructor `(date, description, amount)` | idem | 2 testes |
| 8.1.4 | Teste: valores negativos são aceitos (`amount < 0`) | idem | 1 teste |
| 8.1.5 | Re-exportar em `src/finance/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |
| 8.1.6 | Teste: `AccountCredit` é compatível com `deepClone` (imutável → retorna `this`) | idem | 1 teste |

---

### 8.2 — `Charge`

**⚠️ RUBY: `Charge.rb` (arquivo inteiro — ~80 linhas)**
**🔎 CHEAT: §3 `case` → `switch`, §12 Categoria B (round)**

**Pré-requisitos:** Fase 5 (`Task`), Fase 2 (`TjTime`, `TimeInterval`).

#### 8.2.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.1.1 | Criar `src/finance/charge.ts` com `type ChargeMode = 'onStart' \| 'onEnd' \| 'perDiem'` | idem | `deno check` |
| 8.2.1.2 | Criar `class Charge` com campos `readonly amount: number`, `readonly mode: ChargeMode`, `readonly task: Task`, `readonly scenarioIdx: number` | idem | `deno check` |
| 8.2.1.3 | Constructor `(amount, mode, task, scenarioIdx)` — valida que `mode` é uma das 3 opções; senão `TjArgumentError` | idem | 4 testes (3 válidos + 1 inválido) |

#### 8.2.2 — `turnover(period)` — 3 modos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.2.1 | ⚠️ `turnover(period: TimeInterval): number` — dispatch por `mode` | idem | 1 teste |
| 8.2.2.2 | ⚠️ **Modo `onStart`:** `const start = task.get('start', scIdx) as TjTime \| null`; se null, retorna `0.0` | idem | 2 testes |
| 8.2.2.3 | Modo `onStart`: `period.contains(start) ? amount : 0.0` | idem | 3 testes (dentro, fora, exato no início/fim) |
| 8.2.2.4 | ⚠️ **Modo `onEnd`:** análogo com `task.get('end', scIdx)` | idem | 5 testes (2 null + 3 range) |
| 8.2.2.5 | ⚠️ **Modo `perDiem`:** `iv = period.intersection(new TimeInterval(start, end))`; se `iv` null, retorna `0.0` | idem | 3 testes |
| 8.2.2.6 | Modo `perDiem`: se start/end null, retorna `0.0` | idem | 2 testes |
| 8.2.2.7 | Modo `perDiem`: `(iv.duration() / 86400) * amount` | idem | 5 testes (10 dias, 1 dia, 5.5 dias, interseção parcial, sem interseção) |

#### 8.2.3 — `to_s`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.3.1 | ⚠️ `to_s(): string` — `onStart` → `"${amount} on start"` | idem | 2 testes |
| 8.2.3.2 | `onEnd` → `"${amount} on end"`; `perDiem` → `"${amount} per day"` | idem | 4 testes |
| 8.2.3.3 | Re-exportar `Charge`, `ChargeMode` em `src/finance/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

### 8.3 — `ChargeSet`

**⚠️ RUBY: `ChargeSet.rb` (arquivo inteiro — ~130 linhas)**
**🔎 CHEAT: §3 `Map` vs `Hash`, §2 `Struct` → `interface`**

**Pré-requisitos:** Fase 5 (`Account`), Fase 4 (`PropertyTreeNode.root()`, `isChildOf?`).

#### 8.3.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.3.1.1 | Criar `src/finance/charge-set.ts` com `class ChargeSet` vazia | idem | `deno check` |
| 8.3.1.2 | Campos `private set: Map<Account, number \| null>`, `private masterAccount: Account \| null` | idem | `deno check` |
| 8.3.1.3 | `get master(): Account \| null` — getter | idem | 2 testes |
| 8.3.1.4 | Constructor: inicializa `set` vazio, `masterAccount = null` | idem | 1 teste |

#### 8.3.2 — `addAccount` (validações)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.3.2.1 | ⚠️ `addAccount(account, share): void` — se `!account.leaf()`, `TjArgumentError` ("group account cannot be used") | idem | 3 testes |
| 8.3.2.2 | Se `set.has(account)`, `TjArgumentError` ("already member") | idem | 2 testes |
| 8.3.2.3 | ⚠️ Se `masterAccount === null`, `masterAccount = account.root()` | idem | 3 testes |
| 8.3.2.4 | Senão, se `masterAccount !== account.root()`, `TjArgumentError` ("must belong to same root") | idem | 2 testes |
| 8.3.2.5 | Se `account.container()` (já validado como leaf), `TjArgumentError` ("only leaf") — branch defensivo | idem | 1 teste |
| 8.3.2.6 | ⚠️ Se `share !== null && (share < 0 \|\| share > 1)`, `TjArgumentError` ("share 0-100%") | idem | 4 testes (share < 0, > 1, == 0, == 1) |
| 8.3.2.7 | `set.set(account, share)` — armazena | idem | 2 testes |

#### 8.3.3 — `each` + `share` + `to_s`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.3.3.1 | ⚠️ `each(fn: (account, share) => void): void` — itera `set` | idem | 3 testes |
| 8.3.3.2 | ⚠️ `share(account: Account): number \| null` — retorna o share ou `null` | idem | 4 testes (existe, não existe, share null, masterAccount) |
| 8.3.3.3 | ⚠️ `to_s(): string` — `"(account1 70%, account2 30%)"` | idem | 4 testes (1 conta, 2 contas, share null, vazio) |

#### 8.3.4 — `complete` (distribuição)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.3.4.1 | ⚠️ `complete(): void` — `totalPercent = 0`, `undefined = 0` | idem | 1 teste |
| 8.3.4.2 | Para cada `share`: se não null, `totalPercent += share`; senão `undefined += 1` | idem | 3 testes |
| 8.3.4.3 | Se `totalPercent > 1.0`, `TjArgumentError` ("exceeds 100%") | idem | 3 testes (1.01, 1.5, 2.0) |
| 8.3.4.4 | ⚠️ Se `undefined > 0`: `commonShare = (1.0 - totalPercent) / undefined` | idem | 3 testes |
| 8.3.4.5 | Se `commonShare <= 0`, `TjArgumentError` ("total 100% but N accounts") | idem | 3 testes |
| 8.3.4.6 | Substituir cada `null` por `commonShare` | idem | 3 testes (1 null, 2 null, 3 null) |
| 8.3.4.7 | ⚠️ Senão, se `totalPercent !== 1.0`, `TjArgumentError` ("total is X% instead of 100%") | idem | 3 testes (0.5, 0.99, 0.0) |
| 8.3.4.8 | Teste agregado: 3 contas com shares 0.5, 0.3, null → `complete()` distribui 0.2 | idem | 1 teste |
| 8.3.4.9 | Re-exportar em `src/finance/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — `AccountScenario.turnover`

### 8.4 — `AccountScenario.turnover` + `query_balance` + `query_turnover`

**⚠️ RUBY: `AccountScenario.rb` (arquivo inteiro — ~130 linhas)**
**🔎 CHEAT: §3 `each` → `for-of`, §12 Categoria B (float precision)**

**Pré-requisitos:** Fases 2–7.

#### 8.4.1 — `turnover` — créditos manuais

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.4.1.1 | ⚠️ `turnover(startIdx: number, endIdx: number): number` — `amount = 0.0` | `src/model/account-scenario.ts` | 1 teste |
| 8.4.1.2 | `credits = this.a('credits') as AccountCredit[]` | idem | 1 teste |
| 8.4.1.3 | `startDate = project.idxToDate(startIdx)`; `endDate = project.idxToDate(endIdx)` | idem | 2 testes |
| 8.4.1.4 | ⚠️ Para cada `credit`: se `startDate <= credit.date && credit.date < endDate`, `amount += credit.amount` | idem | 6 testes (dentro, antes, depois, exato no início, exato no fim, múltiplos) |
| 8.4.1.5 | Teste agregado: 3 créditos com datas variadas → soma correta | idem | 1 teste |

#### 8.4.2 — `turnover` — container (filhos)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.4.2.1 | ⚠️ Se `property.container() && property.adoptees.empty`: para cada child, `amount += child.scenarioData(scIdx).turnover(startIdx, endIdx)` | idem | 3 testes |
| 8.4.2.2 | Teste: container com 3 filhos diretos → soma | idem | 1 teste |
| 8.4.2.3 | Teste: container com hierarquia 3 níveis → recursão soma tudo | idem | 1 teste |

#### 8.4.3 — `turnover` — meta-account

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.4.3.1 | ⚠️ Se `property.container() && !property.adoptees.empty` (meta-account): `amount += -adoptees[0].turnover(...) + adoptees[1].turnover(...)` | idem | 3 testes |
| 8.4.3.2 | Teste: meta-account com cost=100, revenue=300 → `amount = 200` | idem | 1 teste |
| 8.4.3.3 | Teste: meta-account com cost=0, revenue=0 → `amount = 0` | idem | 1 teste |

#### 8.4.4 — `turnover` — leaf (aggregate)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.4.4.1 | ⚠️ `aggregate = this.a('aggregate') as string` | idem | 1 teste |
| 8.4.4.2 | ⚠️ `aggregate === 'tasks'`: para cada task em `project.tasks`, `amount += task.scenarioData(scIdx).turnover(startIdx, endIdx, this.property, null, false)` | idem | 3 testes |
| 8.4.4.3 | ⚠️ `aggregate === 'resources'`: para cada resource em `project.resources`, **se `resource.leaf()`**, `amount += resource.scenarioData(scIdx).turnover(startIdx, endIdx, this.property, null, false)` | idem | 3 testes |
| 8.4.4.4 | Teste: `aggregate: resources` **não** soma grupos (só leaves) | idem | 1 teste |
| 8.4.4.5 | Senão (aggregate desconhecido), `throw TjInternalError` | idem | 1 teste |

#### 8.4.5 — `query_balance` + `query_turnover`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.4.5.1 | ⚠️ `query_balance(query: Query): void` — `startIdx = 0`; `endIdx = project.dateToIdx(query.start)` | idem | 2 testes |
| 8.4.5.2 | `amount = turnover(startIdx, endIdx)`; `query.sortable = query.numerical = amount` | idem | 2 testes |
| 8.4.5.3 | `query.string = query.currencyFormat.format(amount)` | idem | 2 testes |
| 8.4.5.4 | ⚠️ `query_turnover(query: Query): void` — `startIdx = dateToIdx(query.start)`; `endIdx = dateToIdx(query.end)` | idem | 2 testes |
| 8.4.5.5 | Análogo a `query_balance` (popula `sortable`, `numerical`, `string`) | idem | 2 testes |
| 8.4.5.6 | Re-exportar métodos em `model/mod.ts` | idem | `deno check` |

---

## Bloco D — `TaskScenario.turnover` completo

### 8.5 — `TaskScenario.turnover` (pipeline completo)

**⚠️ RUBY: `TaskScenario.rb` — método `turnover` (seção isolada)**
**🔎 CHEAT: §3 `is_a?` → `instanceof`, §12 Categoria B (float precision)**

**Pré-requisitos:** Fases 5 (`Task`), 7 (`TaskScenario`), 8.2 (`Charge`), 8.3 (`ChargeSet`).

#### 8.5.1 — Container + chargeset

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.5.1.1 | ⚠️ `turnover(startIdx, endIdx, account, resource = null, includeKids = true): number` — `amount = 0.0` | `src/model/task-scenario.ts` | 1 teste |
| 8.5.1.2 | ⚠️ Se `property.container() && includeKids`: soma `children.turnover(...)` | idem | 3 testes |
| 8.5.1.3 | ⚠️ `chargeset = resource ? resource.get('chargeset', scIdx) : this.a('chargeset')` | idem | 2 testes |
| 8.5.1.4 | Se `chargeset.empty`, retorna `amount` (0 ou soma dos children) | idem | 3 testes |

#### 8.5.2 — `resourceCost`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.5.2.1 | ⚠️ Se `!property.container()`: se `resource`, `resourceCost = resource.scenarioData(scIdx).cost(startIdx, endIdx, this.property)` | idem | 3 testes |
| 8.5.2.2 | Senão: `resourceCost = sum(r.scenarioData(scIdx).cost(startIdx, endIdx, this.property) for r in this.assignedresources)` | idem | 4 testes |
| 8.5.2.3 | Se `container`, `resourceCost = 0` | idem | 1 teste |

#### 8.5.3 — `otherCost` (charges)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.5.3.1 | ⚠️ Se `this.a('charge')` não vazio: `iv = new TimeInterval(project.idxToDate(startIdx), project.idxToDate(endIdx))` | idem | 2 testes |
| 8.5.3.2 | `otherCost = sum(charge.turnover(iv) for charge in this.a('charge'))` | idem | 3 testes |
| 8.5.3.3 | Teste: 2 charges (`onStart` + `perDiem`) → `otherCost` correto | idem | 1 teste |

#### 8.5.4 — Distribuição

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.5.4.1 | `totalCost = resourceCost + otherCost` | idem | 1 teste |
| 8.5.4.2 | ⚠️ Para cada `set` em `chargeset`, para cada `(accnt, share)`: se `share > 0 && (accnt === account \|\| accnt.isChildOf(account))`, `amount += totalCost * share` | idem | 5 testes |
| 8.5.4.3 | Teste: chargeset 100% para 1 conta → `amount = totalCost` | idem | 1 teste |
| 8.5.4.4 | Teste: chargeset 70/30 → `amount` correto para cada conta | idem | 2 testes |
| 8.5.4.5 | Teste: `account` é filho de `accnt` → `share` aplicado | idem | 2 testes |
| 8.5.4.6 | Teste: `resource` específico usa seu próprio chargeset | idem | 2 testes |
| 8.5.4.7 | Teste agregado: task leaf com 2 assignedresources + 1 charge perDiem + chargeset 70/30 | idem | 1 teste |

---

## Bloco E — `ResourceScenario.turnover` completo

### 8.6 — `ResourceScenario.turnover` + `cost`

**⚠️ RUBY: `ResourceScenario.rb` — métodos `turnover` e `cost`**

**Pré-requisitos:** Fases 5 (`Resource`), 7 (`ResourceScenario`), 8.2–8.3.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.6.1 | ⚠️ `turnover(startIdx, endIdx, account, task = null, includeKids = false): number` — `amount = 0.0` | `src/model/resource-scenario.ts` | 1 teste |
| 8.6.2 | ⚠️ Se `property.container() && includeKids`: soma `children.turnover(...)` | idem | 3 testes |
| 8.6.3 | ⚠️ Se `task`: `amount = task.scenarioData(scIdx).turnover(startIdx, endIdx, account, this.property)` | idem | 3 testes |
| 8.6.4 | ⚠️ Senão: `chargeset = this.a('chargeset')`; se vazio, retorna 0 | idem | 3 testes |
| 8.6.5 | `totalResourceCost = cost(startIdx, endIdx)` | idem | 1 teste |
| 8.6.6 | Para cada `set` em `chargeset`, para cada `(accnt, share)`: se `share > 0 && (accnt === account \|\| accnt.isChildOf(account))`, `amount += totalResourceCost * share` | idem | 4 testes |
| 8.6.7 | Teste: recurso leaf com rate 100, 8h alocadas → `cost = 800` | idem | 1 teste |
| 8.6.8 | Teste: recurso sem chargeset → `turnover` retorna 0 | idem | 1 teste |
| 8.6.9 | ⚠️ `cost(startIdx, endIdx, task = null): number` = `getAllocatedTime(startIdx, endIdx, task) * rate` | idem | 4 testes |
| 8.6.10 | `get rate(): number` — container: soma de children; leaf: `this.a('rate')` | idem | 3 testes |
| 8.6.11 | Teste agregado: 2 recursos com rates diferentes + chargeset 50/50 | idem | 1 teste |
| 8.6.12 | Re-exportar em `model/mod.ts` | idem | `deno check` |

---

## Bloco F — Meta-account

### 8.7 — `createBalanceAccount` + `removeBalanceAccount`

**⚠️ RUBY: `reports/AccountListRE.rb` — seção balance**

**Pré-requisitos:** Fases 4 (`PropertyTreeNode.adopt`), 5 (`Account`).

#### 8.7.1 — `createBalanceAccount`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.7.1.1 | Criar `src/finance/balance-account.ts` com `let balanceCounter = 0` (module-level) | idem | `deno check` |
| 8.7.1.2 | ⚠️ `createBalanceAccount(project, costAccount, revenueAccount): Account` — `id = '_balance_' + (++balanceCounter)` | idem | 1 teste |
| 8.7.1.3 | Cria `new Account(project, id, "Total", null)` | idem | 2 testes |
| 8.7.1.4 | ⚠️ `account.adopt(costAccount)` + `account.adopt(revenueAccount)` — na ordem exata | idem | 3 testes |
| 8.7.1.5 | Retorna `account` | idem | 1 teste |

#### 8.7.2 — `removeBalanceAccount`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.7.2.1 | ⚠️ `removeBalanceAccount(project, account): void` — `project.removeAccount(account)` | idem | 2 testes |
| 8.7.2.2 | Teste: `removeAccount` propaga remoção de referências em `adoptees`/`stepParents` | idem | 1 teste |
| 8.7.2.3 | Teste agregado: `createBalanceAccount` → `turnover()` = `-cost.turnover + revenue.turnover` | idem | 1 teste |
| 8.7.2.4 | Re-exportar em `src/finance/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco G — Golden tests

### 8.8 — Golden tests (financeiro)

**⚠️ RUBY: `mwe004/tutorial.tjp` + variações**
**Usa:** `tj3` real via `docs/taskjuggler/`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.8.1 | Atualizar `scripts/golden/README.md` com seção de `finance` | idem | existe |
| 8.8.2 | Criar `scripts/golden/finance-mwe004.rb` — roda `tj3 mwe004/tutorial.tjp` | idem | roda |
| 8.8.3 | Lê `PnL.html` e `Resources.html`; extrai `balance`, `turnover`, `cost`, `revenue` de cada conta | idem | JSON válido |
| 8.8.4 | Serializa em `finance-mwe004.golden.json` | idem | ≥ 10 casos |
| 8.8.5 | Criar `scripts/golden/finance-variations.rb` — casos adicionais: chargeset 100%/70-30/null, charge onStart/onEnd/perDiem, credit manual +/- , aggregate tasks vs resources, balance cost revenue | idem | ≥ 15 casos |
| 8.8.6 | Serializa em `finance-variations.golden.json` | idem | JSON válido |
| 8.8.7 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 8.8.8 | Criar `tests/golden/finance_golden_test.ts` que itera os 2 JSONs | idem | verde |
| 8.8.9 | Comparação com tolerância `1e-6` para floats | idem | 3 testes |
| 8.8.10 | Cobertura ≥ 25 casos; commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco H — Verificação final

### 8.9 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 8.9.1 | `deno task check-all` verde | exit 0 |
| 8.9.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 8.9.3 | `grep -r "NotYetImplementedError" packages/core/src/finance/` = 0 (sem stubs) | grep |
| 8.9.4 | ADR 019 criada e commitada | git log |
| 8.9.5 | `AccountCredit`, `Charge`, `ChargeSet`, `createBalanceAccount`, `removeBalanceAccount` exportados em `packages/core/mod.ts` | `deno check` |
| 8.9.6 | `tests/integration/smoke_after_phase_8_test.ts` — cria `Charge` e `ChargeSet`, calcula `turnover`; verifica Fase 7 (`TaskScenario.schedule`) | 1 teste |
| 8.9.7 | Auditoria: cada subfase do plano `fase-8-financeiro.md` tem tarefas correspondentes | grep |
| 8.9.8 | Corrigir numeração em `fase-8-financeiro.md` (`### 12.X` → `### 8.X`, `ADR 018` → `ADR 019`) | grep |

---

## Notas para a IA

1. **Ordem:** 8.0 → 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 → 8.7 → 8.8 → 8.9.
   - Exceção: 8.1 (`AccountCredit`) pode rodar antes de 8.2.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura.
3. **Fidelidade ao Ruby.** O `turnover` é O(n²) — replicar. Não otimizar.
4. **`Float` sem `Decimal`.** Mesma semântica do Ruby. Tolerância `1e-6` em golden tests.
5. **Meta-account usa `adoptees`.** `adoptees[0]` = cost, `adoptees[1]` = revenue. Sinal: `-cost + revenue`.
6. **`Charge` valida `mode`.** Sem modo desconhecido.
7. **`ChargeSet.complete()` é obrigatório** antes de usar shares.
8. **`master` é setado na primeira `addAccount`.** Se vazio, `master = null`.
9. **`TaskScenario.turnover` usa `resource.chargeset` se `resource` fornecido.** Não `this.chargeset`.
10. **`ResourceScenario.turnover` com `task` delega.**
11. **`aggregate: resources` filtra por `leaf()`.**
12. **`createBalanceAccount` usa id único.** Não usar `'0'` fixo.
13. **`removeBalanceAccount` chama `project.removeAccount`.** Propaga remoção de referências.
14. **`query_balance` sempre começa em idx 0.**
15. **Sem `any`.** Use `unknown` + narrowing.
16. **Commit por subfase.** `feat(core): charge`, `feat(core): account-scenario-turnover`, etc.
17. **Golden tests com mwe004 são o critério mais forte.**
18. **ADR 019** (não 018). **ADR 018** é heurística do scheduler (Fase 7).
19. **Não tocar em Fase 14.** `AccountListRE` é Fase 14; aqui só o utilitário `createBalanceAccount`.
20. **`AttributeBase.setMode(0)` em `beforeEach`.**

---

## Notas específicas por subfase

### 8.1 — AccountCredit

- **Classe trivial.** Só uma struct com 3 campos.
- **Testar valores negativos** (créditos podem subtrair).

### 8.2 — Charge

- **3 modos** — `onStart`, `onEnd`, `perDiem`.
- **`perDiem` com interseção parcial** é o caso mais complexo.
- **`task.get('start', scIdx)` pode ser null** — testar explicitamente.

### 8.3 — ChargeSet

- **`addAccount` tem 6 validações.** Cada uma é uma tarefa.
- **`complete` distribui remainder.** Algoritmo exato.
- **`to_s`** deve refletir os shares.

### 8.4 — AccountScenario.turnover

- **Ordem dos cases é crítica:** créditos → container → meta-account → leaf.
- **`aggregate: resources` filtra por `leaf()`.**
- **`query_balance` sempre começa em idx 0** (não `query.startIdx`).
- **Meta-account:** `-cost + revenue`.

### 8.5 — TaskScenario.turnover

- **Ordem:** container → chargeset → resourceCost → otherCost → distribuição.
- **`resourceCost`** é 0 para container.
- **Distribuição por shares** — `account` pode ser pai ou filho.
- **`resource` específico** usa seu próprio chargeset.

### 8.6 — ResourceScenario.turnover

- **Com `task`:** delega.
- **Sem `task`:** usa chargeset do recurso.
- **`cost = allocatedTime * rate`.**

### 8.7 — Meta-account

- **`createBalanceAccount`** cria conta temporária.
- **`removeBalanceAccount`** remove e propaga.
- **`id` único** para evitar colisão com `'0'`.

### 8.8 — Golden tests

- **mwe004** é o caso principal.
- **Variações** cobrem chargeset, charge modes, credits, aggregate.
- **Tolerância `1e-6`** para floats.

### 8.9 — Verificação

- **Sem stubs.**
- **Smoke test cobre Fase 7.**
- **Corrigir numeração do plano.**

---

**Fim do arquivo de tarefas da Fase 8.**