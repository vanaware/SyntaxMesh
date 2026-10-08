# 📋 Materials, Extended Charge, Extended Booking, and Tracking Scenario in SyntaxMesh

> **Instruction for the developing AI**: This document specifies four interconnected features for SyntaxMesh. Implement them following the architectural principles already defined in the project (independent Core, scenario-specific, mandatory tests). Incompatibility with the original TaskJuggler is **desirable** and expected on yhis specific case.

---

## 1. Overview

SyntaxMesh must extend its cost model with four integrated features:

1. **Material**: a first-class entity representing physical inputs (steel, concrete, paint), with quantity, unit price, and temporal distribution.
2. **Extended Charge**: the `charge` attribute gains new forms of temporal distribution (non-linear), staying consistent with `material`.
3. **Extended Booking**: the `booking` attribute now records not only effort, but also **charge** and **material** actually incurred, enabling projection and plan-vs-actual comparison.
4. **Tracking Scenario (redefined)**: no longer a technical requirement for projection, but a **designated role** indicating which scenario represents the official reality of the project.

The unifying principle is: **`charge` and `material` share the same distribution grammar; `booking` records what actually happened for any of the three (effort, charge, material); any scenario with bookings automatically enters projection mode.**

---

## 2. `Material` Entity

### 2.1 Definition

A material is an entity declared at the project level, with its own attributes:

```
material "Steel" {
  unit "kg"
  unitPrice 25.0
  chargeset "Costs.Materials"
}
```

### 2.2 Attributes

| Attribute | Required | Description |
| :--- | :--- | :--- |
| `id` | Yes | Unique identifier (e.g., "Steel") |
| `unit` | Yes | Unit of measure (e.g., "kg", "m³", "un") |
| `unitPrice` | Yes | Cost per unit |
| `chargeset` | Yes | Reference to the account set (same model as Resource/Task) |
| `totalQuantity` | No | Total planned quantity (optional; can be derived from allocations) |

### 2.3 Allocation to Tasks

A material can be allocated to a task using the **same distribution modifiers** as `charge`:

```
task "Foundation" {
  material "Steel" 500 onstart
  material "Concrete" 300 distributed
  material "Paint" 20 perweek
  material "Sand" 100 distribution { 0.3, 0.5, 0.2 }
}
```

### 2.4 Cost Calculation

The cost of a material in a task is:

```
cost = quantity × unitPrice
```

This cost is automatically posted to the account defined by the material's `chargeset`, respecting the temporal distribution.

---

## 3. Extended Charge

### 3.1 Distribution Modifiers

`charge` now accepts **the same modifiers** as `material`:

| Modifier | Semantics | Example |
| :--- | :--- | :--- |
| `onstart` | Entire value posted at the start of the task | `charge 1000 onstart` |
| `onend` | Entire value posted at the end of the task | `charge 1000 onend` |
| `perhour` | Value posted every hour | `charge 10 perhour` |
| `perday` | Value posted every day | `charge 100 perday` |
| `perweek` | Value posted every week | `charge 500 perweek` |
| `distributed` | Total divided uniformly over the task | `charge 1000 distributed` |
| `distribution { ... }` | Total divided into non-linear fractions | `charge 1000 distribution { 0.5, 0.3, 0.2 }` |

### 3.2 Semantics of `perhour` / `perday` / `perweek`

The declared value is a **rate per period**, repeated each period:

- `charge 100 perday` in a 5-day task → 100 × 5 = **500 total**.

### 3.3 Semantics of `distributed`

The declared value is the **total**, divided uniformly over the duration:

- `charge 1000 distributed` in a 10-day task → 100/day, total 1000.

### 3.4 Semantics of `distribution { ... }`

The declared value is the **total**, divided into **N fractions** applied to **N equal parts** of the task's useful duration:

- `charge 1000 distribution { 0.3, 0.5, 0.2 }` in a 9-day task:
  - Days 1–3: 30% of 1000 = 300
  - Days 4–6: 50% of 1000 = 500
  - Days 7–9: 20% of 1000 = 200

The sum of the parameters must be 1.0 (100%).

### 3.5 Scenario-Specific

`charge` must be **scenario-specific** in SyntaxMesh (unlike the original TaskJuggler). This enables plan-vs-actual comparison:

```
task "Foundation" {
  charge 1000 distributed
  real:charge 1200 distributed
}
```

---

## 4. Extended Booking

### 4.1 Overview

`booking` now records **what actually happened** in three types:

| Type | What it records | Unit |
| :--- | :--- | :--- |
| `effort` | Work performed (already exists) | Time (hours/days) |
| `charge` | Money spent | Monetary value |
| `material` | Quantity consumed | Physical quantity |

### 4.2 Syntax

`booking` can be declared in two contexts:

**In the resource context (for effort and charge):**
```
resource "Engineer" {
  booking effort "Foundation" 2026-11-01 - 2026-11-05 { sloppy 2 }
  booking charge "Foundation" value 1200 on 2026-11-03
}
```

**In the material context (for material):**
```
material "Steel" {
  booking "Foundation" quantity 550 on 2026-11-03
}
```

**Unified alternative (inside the task):**
```
task "Foundation" {
  booking effort "Engineer" 2026-11-01 - 2026-11-05
  booking charge "Engineer" value 1200 on 2026-11-03
  booking material "Steel" quantity 550 on 2026-11-03
}
```

### 4.3 Semantics

1. **Storage**: each `booking` has a type (`effort`, `charge`, `material`), a value, and a date/interval.
2. **Projection**: in projection mode, the Core uses bookings as fixed past data:
   - Effort bookings → determine work already done.
   - Charge bookings → determine money already spent.
   - Material bookings → determine quantity already consumed.
3. **Remaining calculation**: the Core computes the **remaining balance** (planned − booking) and reschedules the future accordingly.
4. **Replacement vs. addition**: a booking **replaces** the planned value for that period (does not add). It represents reality.
5. **Reports**: plan-vs-actual reports compare "planned" vs. "booking" and show deviations.

### 4.4 Automatic Projection

**Any scenario that has bookings automatically enters projection mode.** There is no need for a special tracking scenario to enable projection. This is a key difference from the original TaskJuggler.

### 4.5 Scenario-Specific

Bookings are **scenario-specific**. Any scenario can have its own bookings:

```
task "Foundation" {
  booking effort "Engineer" 2026-11-01 - 2026-11-05
  real:booking effort "Engineer" 2026-11-01 - 2026-11-06
}
```

### 4.6 Validation

The Core must validate:
- Material booking refers to an existing material.
- Quantity is compatible with the unit.
- Charge booking has a monetary value.
- Effort booking has a valid duration.

---

## 5. Tracking Scenario (Redefined)

### 5.1 Role in SyntaxMesh

In the original TaskJuggler, the tracking scenario was a **technical requirement** for projection: bookings only worked inside it, and all sub-scenarios inherited its bookings. In SyntaxMesh, this changes:

- **Projection is automatic**: any scenario with bookings enters projection mode.
- **Tracking scenario becomes a designated role**, not a technical mechanism.
- It indicates which scenario represents the **official reality** of the project.

### 5.2 Functions

| Function | Description |
| :--- | :--- |
| **Official tracking scenario** | Marks the scenario that represents the "official reality" of the project. |
| **Default reference for reports** | Status reports, timesheets, and plan-vs-actual reports use this scenario as the "actual" by default. |
| **Optional inheritance** | Sub-scenarios may inherit its bookings, but this is a choice, not an obligation. |
| **Baseline comparison** | Enables comparison between a `plan` (baseline) scenario and the `tracking` (actual) scenario. |

### 5.3 Syntax

A simple directive designates the tracking scenario:

```
trackingscenario real
```

This does not change technical behavior (the `real` scenario already enters projection because it has bookings), but **marks** it for reporting purposes.

### 5.4 Difference from TaskJuggler

| Aspect | TaskJuggler today | SyntaxMesh (proposal) |
| :--- | :--- | :--- |
| **Projection** | Only works inside the tracking scenario | Any scenario with bookings enters projection |
| **Bookings** | Exclusive to tracking scenario and derivatives | Any scenario can have bookings |
| **Tracking scenario** | Technical requirement for projection | Designated role, optional, for reports |
| **Flexibility** | Low (rigid hierarchy) | High (independent scenarios) |

### 5.5 Practical Example

You could have:

- **Scenario `plan`**: baseline, no bookings. Represents the original plan.
- **Scenario `real`**: with effort, charge, and material bookings. Represents what actually happened.
- **Scenario `optimistic`**: no bookings, or different bookings. Represents a hypothetical scenario.

To designate `real` as the official tracking scenario:

```
trackingscenario real
```

This marks `real` so that:
- Status and timesheet reports use it by default.
- Plan-vs-actual comparisons know which is the "actual".

---

## 6. Unified Grammar

### 6.1 Comparison Table

| Modifier | `charge` (money) | `material` (quantity) | `booking` (actual) |
| :--- | :--- | :--- | :--- |
| `onstart` | Value at start | Quantity at start | — |
| `onend` | Value at end | Quantity at end | — |
| `perhour` | Value per hour | Quantity per hour | — |
| `perday` | Value per day | Quantity per day | — |
| `perweek` | Value per week | Quantity per week | — |
| `distributed` | Uniform total | Uniform total | — |
| `distribution { ... }` | Total in fractions | Total in fractions | — |
| `booking` | Actual money spent | Actual quantity consumed | Records effort/charge/material |

### 6.2 Complete Example

```
project "My Construction" {
  account "Costs" cost {
    account "Materials"
    account "Labor"
  }
  trackingscenario real
}

resource "Engineer" {
  rate 500
  chargeset "Costs.Labor"
  booking effort "Foundation" 2026-11-01 - 2026-11-05 { sloppy 2 }
  booking charge "Foundation" value 1200 on 2026-11-03
}

material "Steel" {
  unit "kg"
  unitPrice 25.0
  chargeset "Costs.Materials"
  booking "Foundation" quantity 550 on 2026-11-03
}

task "Foundation" {
  effort 10d
  allocate "Engineer"
  material "Steel" 500 distribution { 0.3, 0.5, 0.2 }
  charge 2000 onstart
  charge 500 perweek
}
```

---

## 7. Non-Functional Requirements

| Requirement | Description |
| :--- | :--- |
| **RNF01 — Independent Core** | Materials, charge, booking, and tracking scenario logic reside in `src/core/accounting/` or `src/core/model/`, with no dependency on UI, Storage, or Parser. |
| **RNF02 — chargeset reuse** | Material uses the same `chargeset` as Resource/Task. Do not create a parallel system. |
| **RNF03 — Tests** | Every new feature has unit and integration tests (Rule 12). |
| **RNF04 — Documentation** | Document in `docs/`, with examples in `examples/`. |
| **RNF05 — Controlled incompatibility** | Material/charge/booking syntax does not need to be compatible with TaskJuggler. `.tjp` files without these features continue to work. |
| **RNF06 — English only (for now)** | All new keywords are in English. No other languages at this stage. |

---

## 8. Acceptance Criteria

1. It is possible to declare a material with unit, unit price, and `chargeset`.
2. It is possible to allocate a material to a task with `onstart`, `onend`, `perhour`, `perday`, `perweek`, `distributed`, or `distribution { ... }`.
3. `charge` accepts the same distribution modifiers as `material`.
4. `distribution { ... }` divides the total into N equal fractions of the useful duration.
5. `booking` records effort, charge, and material actually incurred.
6. Any scenario with bookings automatically enters projection mode.
7. In projection mode, the Core uses bookings as fixed past data and reschedules the future.
8. Reports compare plan vs. actual using bookings.
9. A `trackingscenario` directive designates the official tracking scenario for reports.
10. All new keywords are in English only.
11. All tests pass (`deno test`, `deno lint`, `deno fmt --check`).

---

## 9. Out of Scope (for now)

- Visual interface for editing materials, charges, or bookings.
- Integration with external purchasing or accounting systems.
- Inventory or stock control.
- Automatic conversion of timesheets into bookings.
- Additional languages beyond English.

---

## 10. Summary for the AI

> Implement four integrated features: **material** (entity with quantity and unit price), **extended charge** (with non-linear distribution via `distribution { ... }`), **extended booking** (recording effort, charge, and material actually incurred), and **tracking scenario** (redefined as a designated role, not a technical requirement). `charge` and `material` share the same distribution grammar. `booking` is scenario-specific and automatically triggers projection mode. A `trackingscenario` directive marks which scenario represents the official reality for reporting purposes. Material uses `chargeset` to direct costs to accounts. Follow SyntaxMesh architectural principles: independent Core, scenario-specific, with mandatory tests. Use only English keywords at this stage.

Primeiro crie um plano de tarefas fase-8.1 detalhado usando o modelo: docs/syntaxmesh/fases/modelo-tarefas.md
complemente este plano 8.1 com modelo de escrita usado para escrever as fases e atualize 0 plano.md e README.md com a fase 8.1    

Esta é uma fase crítica pois vai precisar implementar novas funcionalidades sem perder a essencia e modo de calculos já existentes do taskjuggler, esta novo funcionalidade deve se integrar as existentes sem perder a filosofia e caracterirsticas principais do taskjuggler. Deveria ser criado pensando como o desenvolvedor original do código incluiria estas funcionalidades descritas.    

Como são muitas mudanças faça um plano de tarefas primeiro separado para cada grande tópico: 
1. uso de scenario em bookings, permitindo o usuário incluir booking para um cenario especifico, modificar o uso de tranckingscenario para manter compatibilidade com os relatórios do taskjuggler como sendo o REAL do que aconteceu e sistema para projection mode.
2. extender o charge para permitir as novas formas de indicação de custo
3. incluir o conceito de MATERIAL e a nova forma de informar custos no projeto
4. extender o booking para poder ser usado para effort, charge e tambem material além da possibilidade de ter cenário para determinado no passo 1.
