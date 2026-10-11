# Fase 8.1 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-8.1-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`
> **Status:** ✅ Concluída
> **Total:** ~25 tarefas
> **Concluídas:** 3
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/AccountCredit.rb` (arquivo inteiro — ~30 linhas)
> **🔎 CHEAT:** §1 `Struct` → `interface` + factory

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 019** — Modelo financeiro (criado nesta fase).

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

---

## Progresso

```
[x] 8.1.1 — AccountCredit (classe trivial) — 6/6
[x] 8.1.2 — AccountCredit (valores negativos) — 1/1
[x] 8.1.3 — AccountCredit (compatível com deepClone) — 1/1
─────────────────────────────────────────────────
TOTAL: ~8
```

---

## Bloco A — AccountCredit (nova funcionalidade custos)

### 8.1.1 — AccountCredit (classe trivial)

**⚠️ RUBY: `AccountCredit.rb` (arquivo inteiro — ~30 linhas)**
**🔎 CHEAT: §1 `Struct` → `interface` + factory**

**Pré-requisitos:** Fase 2 (`TjTime`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.1.1 | Criar `src/finance/account-credit.ts` com `class AccountCredit` vazia | idem | `deno check` |
| 8.1.1.2 | Campos `readonly date: TjTime`, `readonly description: string`, `readonly amount: number` | idem | `deno check` |
| 8.1.1.3 | Constructor `(date, description, amount)` | idem | 2 testes |

### 8.1.2 — AccountCredit (valores negativos)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.2.1 | Teste: valores negativos são aceitos (`amount < 0`) | idem | 1 teste |

### 8.1.3 — AccountCredit (compatível com deepClone)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.3.1 | Teste: `AccountCredit` é compatível com `deepClone` (imutável → retorna `this`) | idem | 1 teste |

---

## Notas para a IA

### 8.1.1 — AccountCredit

- **Classe trivial.** Só uma struct com 3 campos.
- **Testar valores negativos** (créditos podem subtrair).

### 8.1.2 — AccountCredit (valores negativos)

- **Validação de entrada:** o Ruby aceita `amount` negativo.
- **Sem validação adicional** — apenas armazena.

### 8.1.3 — AccountCredit (compatível com deepClone)

- **Imutável:** retornar `this` em `deepClone`.
- **Sem estado mutável** — apenas campos `readonly`.

---

## Referências

- `docs/taskjuggler/lib/taskjuggler/AccountCredit.rb`.
- `docs/tj3-engine/10-blueprint-finance.md` — §5.

---

## Fora de escopo

- Uso — subfase 8.4.

---

## Critério de aceite

```ts
const c = new AccountCredit(TjTime.fromString("2026-03-15"), "Bonus", 5000);
assertEquals(c.amount, 5000);
assertEquals(c.description, "Bonus");
assertEquals(c.date.toString(), "2026-03-15");

// Valores negativos aceitos
const c2 = new AccountCredit(TjTime.fromString("2026-03-15"), "Penalty", -500);
assertEquals(c2.amount, -500);

// deepClone retorna this (imutável)
const c3 = deepClone(c);
assertEquals(c3, c);
```

---

## Testes

- `account-credit_test.ts`:
  - `describe("AccountCredit")`
    - `it("armazena date, description, amount")`.
    - `it("valores negativos aceitos")`.
    - `it("compatível com deepClone")`.

---

## Re-exportar

- Re-exportar `AccountCredit` em `src/finance/mod.ts` e `packages/core/mod.ts`.

---

## Notas finais

- **Classe trivial** — foco em fidelidade ao Ruby.
- **Sem lógica adicional** — apenas armazenamento.
- **Importante para pipeline financeiro** — usado em `AccountScenario.turnover`.
- **Testes simples** — mas necessários para pipeline completo.

---

## Próximos passos

1. Implementar `AccountCredit`.
2. Escrever testes.
3. Re-exportar.
4. Executar `deno task check-all`.
5. Continuar com `Charge` (fase 8.2).