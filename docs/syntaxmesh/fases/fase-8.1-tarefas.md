# Fase 8.1 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-8.1-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`
> **Status:** ✅ Concluída
> **Total:** ~37 tarefas
> **Concluídas:** 37 (refrescado 2026-10-12)
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
[x] 8.1.4 — Material (entidade) — 6/6
[x] 8.1.5 — Material allocation (onstart, onend, perhour, perday, perweek, distributed, distribution) — 11/11
[x] 8.1.6 — Extended Charge (mesmos modificadores) — 11/11
[x] 8.1.7 — Extended Booking (effort, charge, material) — 8/8
[x] 8.1.8 — Tracking Scenario (redefinido) — 5/5
[x] 8.1.9 — Integração com Core — 4/4
[x] 8.1.10 — Testes de aceitação — 4/4
[x] 8.1.11 — Documentação — 2/2
[x] 8.1.12 — Re-exportação — 2/2
[x] 8.1.13 — Verificação final — 7/7
─────────────────────────────────────────────────
TOTAL: ~37
```

---

## Organização por grandes tópicos

O plano foi elaborado separadamente para cada grande tópico, conforme solicitado:

| Tópico | Bloco | Tarefas | O que cobre |
|---|---|---|---|
| **1. Scenario em bookings + tracking scenario + projection mode** | C, D, E | 8.1.7, 8.1.8, 8.1.9 | Booking é scenario-specific; tracking scenario redefinido como papel designado; projection mode automático para qualquer cenário com bookings. Mantém compatibilidade com relatórios do TaskJuggler (tracking scenario = REAL). |
| **2. Extensão do charge** | B | 8.1.6 | Novas formas de distribuição temporal: `onstart`, `onend`, `perhour`, `perday`, `perweek`, `distributed`, `distribution { ... }`. |
| **3. Conceito de MATERIAL** | A | 8.1.4, 8.1.5 | Nova entidade `Material` (id, unit, unitPrice, chargeset, totalQuantity) + alocação com mesma gramática de distribuição do charge. |
| **4. Extensão do booking (effort, charge, material + cenário)** | C, E | 8.1.7, 8.1.9 | Booking com 3 tipos (effort, charge, material), scenario-specific, aciona projection mode. Integração com Core. |

**Ordem de implementação sugerida pelo desenvolvedor original do código:**
1. `Material` (entidade) → 8.1.4
2. `MaterialAllocation` (distribuição) → 8.1.5
3. `ExtendedCharge` (mesma distribuição) → 8.1.6
4. `ExtendedBooking` (3 tipos + cenário) → 8.1.7
5. `TrackingScenario` (papel designado) → 8.1.8
6. Integração com Core → 8.1.9
7. Testes, documentação, re-exportação, verificação → 8.1.10–8.1.13

---

## Bloco A — Material (entidade)

### 8.1.4 — Material (entidade)

**⚠️ RUBY:** Não há equivalente direto em TaskJuggler Ruby; esta é uma nova entidade do SyntaxMesh.
**🔎 CHEAT:** §2 `Struct` → `interface` + factory

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`), 5 (`Account`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.4.1 | Criar `src/core/model/material.ts` com `class Material` vazia | idem | `deno check` |
| 8.1.4.2 | Campos `readonly id: string`, `readonly unit: string`, `readonly unitPrice: number`, `readonly chargeset: string`, `readonly totalQuantity?: number` | idem | `deno check` |
| 8.1.4.3 | Constructor `(id, unit, unitPrice, chargeset, totalQuantity?)` — valida tipos e `unitPrice >= 0` | idem | 2 testes |
| 8.1.4.4 | Re-exportar em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.4.5 | Teste: criar material com todos os campos | idem | 1 teste |
| 8.1.4.6 | Teste: material sem totalQuantity opcional | idem | 1 teste |

### 8.1.5 — Material allocation (onstart, onend, perhour, perday, perweek, distributed, distribution)

**⚠️ RUBY:** Não há equivalente direto; esta é uma nova funcionalidade do SyntaxMesh.
**🔎 CHEAT:** §2 `Struct` → `interface` + factory

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`), 5 (`Task`), 8.1.4 (`Material`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.5.1 | Criar `src/core/model/material-allocation.ts` com `type MaterialAllocationModifier = 'onstart' | 'onend' | 'perhour' | 'perday' | 'perweek' | 'distributed' | 'distribution'` | idem | `deno check` |
| 8.1.5.2 | Criar `class MaterialAllocation` com `readonly material: Material`, `readonly quantity: number`, `readonly modifier: MaterialAllocationModifier`, `readonly distribution?: number[]` | idem | `deno check` |
| 8.1.5.3 | Constructor valida `modifier` e `distribution` (se presente) soma 1.0 | idem | 3 testes |
| 8.1.5.4 | Re-exportar em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.5.5 | Teste: alocação onstart | idem | 1 teste |
| 8.1.5.6 | Teste: alocação onend | idem | 1 teste |
| 8.1.5.7 | Teste: alocação perhour | idem | 1 teste |
| 8.1.5.8 | Teste: alocação perday | idem | 1 teste |
| 8.1.5.9 | Teste: alocação perweek | idem | 1 teste |
| 8.1.5.10 | Teste: alocação distributed | idem | 1 teste |
| 8.1.5.11 | Teste: alocação distribution { ... } | idem | 1 teste |

---

## Bloco B — Extended Charge

### 8.1.6 — Extended Charge (mesmos modificadores)

**⚠️ RUBY:** Não há equivalente direto; esta é uma nova funcionalidade do SyntaxMesh.
**🔎 CHEAT:** §3 `case` → `switch`

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`), 5 (`Task`), 8.2 (`Charge`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.6.1 | Criar `src/core/model/extended-charge.ts` com `type ExtendedChargeModifier = 'onstart' | 'onend' | 'perhour' | 'perday' | 'perweek' | 'distributed' | 'distribution'` | idem | `deno check` |
| 8.1.6.2 | Criar `class ExtendedCharge` com `readonly amount: number`, `readonly modifier: ExtendedChargeModifier`, `readonly distribution?: number[]` | idem | `deno check` |
| 8.1.6.3 | Constructor valida `modifier` e `distribution` (se presente) soma 1.0 | idem | 3 testes |
| 8.1.6.4 | Re-exportar em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.6.5 | Teste: extended charge onstart | idem | 1 teste |
| 8.1.6.6 | Teste: extended charge onend | idem | 1 teste |
| 8.1.6.7 | Teste: extended charge perhour | idem | 1 teste |
| 8.1.6.8 | Teste: extended charge perday | idem | 1 teste |
| 8.1.6.9 | Teste: extended charge perweek | idem | 1 teste |
| 8.1.6.10 | Teste: extended charge distributed | idem | 1 teste |
| 8.1.6.11 | Teste: extended charge distribution { ... } | idem | 1 teste |

---

## Bloco C — Extended Booking

### 8.1.7 — Extended Booking (effort, charge, material)

**⚠️ RUBY:** Não há equivalente direto; esta é uma nova funcionalidade do SyntaxMesh.
**🔎 CHEAT:** §4 `Struct` → `interface` + factory

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`), 5 (`Task`, `Resource`), 8.1.4 (`Material`), 8.1.6 (`ExtendedCharge`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.7.1 | Criar `src/core/model/extended-booking.ts` com `type ExtendedBookingType = 'effort' | 'charge' | 'material'` | idem | `deno check` |
| 8.1.7.2 | Criar `class ExtendedBooking` com `readonly type: ExtendedBookingType`, `readonly value: number`, `readonly date: TjTime`, `readonly interval?: TimeInterval` | idem | `deno check` |
| 8.1.7.3 | Constructor valida tipos e valores compatíveis com o tipo | idem | 3 testes |
| 8.1.7.4 | Re-exportar em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.7.5 | Teste: booking effort | idem | 1 teste |
| 8.1.7.6 | Teste: booking charge | idem | 1 teste |
| 8.1.7.7 | Teste: booking material | idem | 1 teste |
| 8.1.7.8 | Teste: booking com intervalo | idem | 1 teste |

---

## Bloco D — Tracking Scenario (redefinido)

### 8.1.8 — Tracking Scenario (redefinido)

**⚠️ RUBY:** Não há equivalente direto; esta é uma nova funcionalidade do SyntaxMesh.
**🔎 CHEAT:** §5 `case` → `switch`

**Pré-requisitos:** Fases 4 (`PropertyTreeNode`), 5 (`Scenario`), 8.1.7 (`ExtendedBooking`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.8.1 | Criar `src/core/model/tracking-scenario.ts` com `type TrackingScenarioRole = 'plan' | 'real' | 'optimistic'` | idem | `deno check` |
| 8.1.8.2 | Criar `class TrackingScenario` com `readonly role: TrackingScenarioRole`, `readonly scenarioId: string` | idem | `deno check` |
| 8.1.8.3 | Constructor valida role e scenarioId | idem | 2 testes |
| 8.1.8.4 | Re-exportar em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.8.5 | Teste: tracking scenario plan | idem | 1 teste |
| 8.1.8.6 | Teste: tracking scenario real | idem | 1 teste |
| 8.1.8.7 | Teste: tracking scenario optimistic | idem | 1 teste |

---

## Bloco E — Integração com Core

### 8.1.9 — Integração com Core

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.9.1 | Atualizar `src/core/accounting/` para processar alocações de material e extended charge | idem | `deno check` |
| 8.1.9.2 | Atualizar `src/core/accounting/` para processar bookings (effort, charge, material) | idem | `deno check` |
| 8.1.9.3 | Atualizar `src/core/accounting/` para respeitar tracking scenario | idem | `deno check` |
| 8.1.9.4 | Criar `tests/core/accounting/` com testes de integração | idem | `deno test` |

### 8.1.10 — Testes de aceitação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.10.1 | Criar `tests/core/material_test.ts` | idem | `deno test` |
| 8.1.10.2 | Criar `tests/core/extended-charge_test.ts` | idem | `deno test` |
| 8.1.10.3 | Criar `tests/core/extended-booking_test.ts` | idem | `deno test` |
| 8.1.10.4 | Criar `tests/core/tracking-scenario_test.ts` | idem | `deno test` |

---

## Bloco F — Documentação e re-exportação

### 8.1.11 — Documentação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.11.1 | Atualizar `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md` com tarefas concluídas | idem | arquivo atualizado |
| 8.1.11.2 | Adicionar exemplos na documentação | idem | exemplos adicionados |

### 8.1.12 — Re-exportação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.1.12.1 | Re-exportar `Material`, `MaterialAllocation`, `ExtendedCharge`, `ExtendedBooking`, `TrackingScenario` em `src/core/model/mod.ts` | idem | `deno check` |
| 8.1.12.2 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco G — Verificação final

### 8.1.13 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 8.1.13.1 | `deno task check-all` verde | exit 0 |
| 8.1.13.2 | `deno task test` verde (incluindo novos testes) | exit 0 |
| 8.1.13.3 | `grep -r "NotYetImplementedError" src/core/` = 0 (sem stubs) | grep |
| 8.1.13.4 | Documentação atualizada em `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md` | arquivo existe |
| 8.1.13.5 | Re-exportação em `packages/core/mod.ts` | `deno check` |
| 8.1.13.6 | Testes de integração cobrem Core + Model | 1+ testes |
| 8.1.13.7 | Auditoria: cada subfase do plano `fase-8.1-nova-funcionalidade-custos.md` tem tarefas correspondentes | grep |

---

## Notas para a IA

### 8.1.4 — Material

- **Nova entidade** — primeira classe de entidade de nível superior além de Task, Resource, Account.
- **UnitPrice >= 0** — custo não negativo.
- **Unit** pode ser qualquer string (kg, m³, un).

### 8.1.5 — Material allocation

- **Mesmos modificadores que charge** — consistência.
- **distribution { ... }** divide total uniformemente sobre N partes.
- **Sem validação de intervalo** — apenas quantity.

### 8.1.6 — Extended Charge

- **Mesmos modificadores que material** — consistência.
- **Amount pode ser negativo** (charge pode subtrair).
- **Sem chargeset** — usa chargeset do Task/Resource.

### 8.1.7 — Extended Booking

- **Three types** — effort (tempo), charge (dinheiro), material (quantidade).
- **Scenario-specific** — bookings are scenario-specific (unlike original TaskJuggler).
- **Projection mode** — any scenario with bookings enters projection mode.

### 8.1.8 — Tracking Scenario

- **Redefined role** — no longer a technical requirement for projection.
- **Designated role** — marks the scenario that represents the "official reality".
- **Default reference for reports** — status reports use it as the "actual" by default.

---

## Referências

- `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md` — plano da funcionalidade.
- `docs/taskjuggler/lib/taskjuggler/AccountCredit.rb`.
- `docs/tj3-engine/10-blueprint-finance.md` — §5.

---

## Fora de escopo

- Visual interface para edição de materiais, charges ou bookings.
- Integração com sistemas externos de compras ou contabilidade.
- Controle de estoque ou inventário.
- Conversão automática de timesheets em bookings.
- Idiomas além do inglês.

---

## Critério de aceite

```ts
// Material
const steel = new Material("Steel", "kg", 25.0, "Costs.Materials",);
assertEquals(steel.unitPrice, 25.0);

// Material allocation
const alloc = new MaterialAllocation(steel, 500, "onstart",);
assertEquals(alloc.quantity, 500);

// Extended charge
const charge = new ExtendedCharge(1000, "distributed",);
assertEquals(charge.amount, 1000);

// Extended booking
const booking = new ExtendedBooking("charge", 1200, TjTime.fromString("2026-11-03"),);
assertEquals(booking.value, 1200);

// Tracking scenario
const tracking = new TrackingScenario("real", "real",);
assertEquals(tracking.role, "real");
```

---

## Testes

- `material_test.ts`:
  - `describe("Material")`
    - `it("cria material com todos os campos")`.
    - `it("rejeita unitPrice negativo")`.
- `material-allocation_test.ts`:
  - `describe("MaterialAllocation")`
    - `it("onstart")`.
    - `it("onend")`.
    - `it("perhour")`.
    - `it("perday")`.
    - `it("perweek")`.
    - `it("distributed")`.
    - `it("distribution { ... }")`.
- `extended-charge_test.ts`:
  - `describe("ExtendedCharge")`
    - `it("onstart")`.
    - `it("onend")`.
    - `it("perhour")`.
    - `it("perday")`.
    - `it("perweek")`.
    - `it("distributed")`.
    - `it("distribution { ... }")`.
- `extended-booking_test.ts`:
  - `describe("ExtendedBooking")`
    - `it("effort")`.
    - `it("charge")`.
    - `it("material")`.
    - `it("com intervalo")`.
- `tracking-scenario_test.ts`:
  - `describe("TrackingScenario")`
    - `it("plan")`.
    - `it("real")`.
    - `it("optimistic")`.

---

## Próximos passos

Continuar para a próxima fase (Fase 8.2 — contabilidade extendida ).
