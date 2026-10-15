# Fase 8.2 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-8.2-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~130 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `Account.rb`, `AccountScenario.rb`, `ChargeSet.rb` + extensões SyntaxMesh
> **🔎 CHEAT:** §2 `Struct`, §3 `case` → `switch`, §12 Categoria B (float)

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port + extensão.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro**
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e
   categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 014** — `mode` global.
- **ADR 015** — Metaprogramação em `PropertyTreeNode`.
- **ADR 016** — Pré-carregamento em `*Scenario`.
- **ADR 017** — Scoreboard bit encoding.
- **ADR 018** — Heurística do scheduler.
- **ADR 019** — Modelo financeiro (Fase 8).
- **ADR 031** — Modelo contábil estendido (**criado nesta fase**).

### Convenções CRÍTICAS

- **`AttributeBase.setMode(0)` em `beforeEach`** — sem isso, testes vazam estado.
- **`Float` (number JS) para valores monetários** — sem `Decimal`, sem `BigInt`.
  Tolerância `1e-6` nos golden tests.
- **Meta-account usa `adoptees[0] = cost`, `adoptees[1] = revenue`.**
  Sinal: `-cost + revenue`.
- **Invariante:** `sum(buckets) === total` em `AccountScenario`.
- **Sem cache** no motor de agregação (O(n²) aceito).
- **`turnover` mantém assinatura** da Fase 8. `turnoverByType` é a API nova.
- **Múltiplos chargesets: no máximo um por top-level account.**
- **`force` só na tarefa.** Recurso/material não têm modo force.
- **`CostEvent` emitido uma vez por linha de custo.**
- **Compatibilidade `.tjp`:** nenhum golden da Fase 8 pode quebrar.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar `Decimal`.
- ❌ Não otimizar o motor de agregação.
- ❌ Não implementar `AccountListRE` (Fase 14).
- ❌ Não quebrar assinatura de `turnover` da Fase 8.
- ❌ Não permitir dois chargesets para o mesmo top-level.
- ❌ Não implementar modo force em recurso/material.
- ❌ Não usar `Proxy`.

---

## Progresso

```
[ ] 8.2.0  ADR 031 (modelo contábil estendido)        —  0/6
[ ] 8.2.1  Account.allowedTypes                       —  0/9
[ ] 8.2.2  AccountScenario.turnoverByType + buckets   —  0/12
[ ] 8.2.3  CostEvent                                  —  0/10
[ ] 8.2.4  ChargeSetCollection                        —  0/14
[ ] 8.2.5  Motor de precedência (attribution)         —  0/16
[ ] 8.2.6  Integração material no motor               —  0/8
[ ] 8.2.7  Booking scenario-aware                     —  0/10
[ ] 8.2.8  Integração com Task/Resource.turnover      —  0/12
[ ] 8.2.9  API de relatórios (breakdown + plan×actual)—  0/10
[ ] 8.2.10 Golden tests                               —  0/12
[ ] 8.2.11 Verificação final                          —  0/9
─────────────────────────────────────────────────────
TOTAL: ~130
```

### Organização por tópico

| Tópico | Subfases | O que cobre |
|---|---|---|
| **1. Uso de scenario em bookings + tracking + projection** | 8.2.3, 8.2.7 | Booking scenario-aware; projection mode automático; `trackingscenario` como papel |
| **2. Extensão do charge** | 8.2.5, 8.2.6 | Motor de precedência integra `ExtendedCharge`; material usa a mesma gramática |
| **3. Conceito de material** | 8.2.4, 8.2.6 | `Material` participa do motor de atribuição |
| **4. Extensão do booking + cenário** | 8.2.3, 8.2.7 | `CostEvent` registra modo (planned/actual) por cenário |
| **5. Conta não exclusiva + subtotais** | 8.2.1, 8.2.2 | `allowedTypes`; buckets por tipo |
| **6. Múltiplos chargesets** | 8.2.4 | `ChargeSetCollection` validada por top-level |

---

## Bloco A — Fundação

### 8.2.0 — ADR 031

**⚠️ RUBY:** Não se aplica (ADR é documento de projeto).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.0.1 | Criar `docs/syntaxmesh/decisoes/020-modelo-contabil-estendido.md` com frontmatter | idem | arquivo existe |
| 8.2.0.2 | Seção **Contexto:** limites do modelo TJ e diretriz SyntaxMesh | idem | — |
| 8.2.0.3 | Seção **Decisão 1:** contas não exclusivas; `aggregate` como filtro; subtotais por tipo | idem | — |
| 8.2.0.4 | Seção **Decisão 2:** `CostEvent` como unidade auditável; campos e semântica | idem | — |
| 8.2.0.5 | Seção **Decisão 3:** múltiplos chargesets (restrição por top-level) + motor de precedência (`force`/`fallback`) | idem | — |
| 8.2.0.6 | **Alternativas** + **Consequências** + atualizar `decisoes/README.md` | idem | linha 020 |

---

## Bloco B — Conta estendida

### 8.2.1 — `Account.allowedTypes`

**⚠️ RUBY: `Account.rb` — arquivo inteiro**
**🔎 CHEAT: §2 `Struct` → `interface`, §3 `case`**

**Pré-requisitos:** Fase 5 (`Account`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.1.1 | Adicionar `type CostType = 'task' \| 'resource' \| 'material'` em `src/core/model/account.ts` | idem | `deno check` |
| 8.2.1.2 | Adicionar `allowedTypes: Set<CostType>` na classe `Account` (vazio por default) | idem | `deno check` |
| 8.2.1.3 | Método `canAccept(type: CostType): boolean` | idem | 3 testes |
| 8.2.1.4 | Parser: `aggregate tasks` → `allowedTypes = {task}` | `src/core/parser/rule_aggregate.ts` | 2 testes |
| 8.2.1.5 | Parser: `aggregate resources` → `allowedTypes = {resource}` | idem | 2 testes |
| 8.2.1.6 | Parser: `aggregate materials` → `allowedTypes = {material}` | idem | 2 testes |
| 8.2.1.7 | Parser: `aggregate tasks, resources, materials` → conjunto com 3 | idem | 2 testes |
| 8.2.1.8 | Compatibilidade: sem `aggregate` → `allowedTypes` vazio → aceita tudo | idem | 2 testes |
| 8.2.1.9 | Teste: `aggregate tasks` seguido de custo de recurso → erro claro | idem | 1 teste |

---

## Bloco C — Subtotais por tipo

### 8.2.2 — `AccountScenario.turnoverByType` + buckets

**⚠️ RUBY: `AccountScenario.rb` — arquivo inteiro**
**🔎 CHEAT: §3 `each` → `for-of`**

**Pré-requisitos:** Fases 5, 8.2.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.2.1 | Adicionar `interface AccountBuckets { task: number; resource: number; material: number }` | `src/core/model/account-scenario.ts` | `deno check` |
| 8.2.2.2 | Campo privado `buckets: AccountBuckets` (reset a cada `turnover`) | idem | `deno check` |
| 8.2.2.3 | `turnover` existente popula buckets conforme origem | idem | 3 testes |
| 8.2.2.4 | **Invariante:** `sum(buckets) === total` dentro de `1e-6` | idem | 3 testes |
| 8.2.2.5 | Novo método `turnoverByType(startIdx, endIdx, type): number` | idem | 3 testes |
| 8.2.2.6 | `turnoverByType(.., 'task')` chama turnover de tasks (comportamento Fase 8) | idem | 2 testes |
| 8.2.2.7 | `turnoverByType(.., 'resource')` chama turnover de resources | idem | 2 testes |
| 8.2.2.8 | `turnoverByType(.., 'material')` chama turnover de materials | idem | 2 testes |
| 8.2.2.9 | Dispatch por tipo: tipo desconhecido → `TjInternalError` | idem | 1 teste |
| 8.2.2.10 | Re-exportar `AccountBuckets` em `model/mod.ts` | idem | `deno check` |
| 8.2.2.11 | Teste: conta com 3 tipos simultâneos → 3 buckets corretos | idem | 1 teste |
| 8.2.2.12 | Teste: conta com `aggregate tasks` → buckets resource/material zerados | idem | 1 teste |

---

## Bloco D — `CostEvent`

### 8.2.3 — `CostEvent`

**⚠️ RUBY:** Não se aplica (novo em SyntaxMesh).

**Pré-requisitos:** Fases 5, 8.2.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.3.1 | Criar `src/core/accounting/cost-event.ts` | idem | `deno check` |
| 8.2.3.2 | `type CostEventType = 'task_charge' \| 'resource_effort' \| 'material_usage'` | idem | `deno check` |
| 8.2.3.3 | `type AttributionRule = 'explicit' \| 'origin_chargeset' \| 'task_chargeset_force' \| 'task_chargeset_fallback' \| 'project_default'` | idem | `deno check` |
| 8.2.3.4 | `interface CostEvent` com todos os campos | idem | `deno check` |
| 8.2.3.5 | `type CostEventMode = 'planned' \| 'actual'` | idem | `deno check` |
| 8.2.3.6 | Factory `createCostEvent(line, account, rule, scenarioIdx, mode)` | idem | 2 testes |
| 8.2.3.7 | Teste: evento com `type = 'task_charge'` | idem | 1 teste |
| 8.2.3.8 | Teste: evento com `type = 'material_usage'` e `materialId` | idem | 1 teste |
| 8.2.3.9 | Coleção `Project.costEvents: CostEvent[]` (append-only) | `src/core/model/project.ts` | `deno check` |
| 8.2.3.10 | Re-exportar em `accounting/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco E — Múltiplos chargesets

### 8.2.4 — `ChargeSetCollection`

**⚠️ RUBY: `ChargeSet.rb` — arquivo inteiro**
**🔎 CHEAT: §3 `Map` vs `Hash`**

**Pré-requisitos:** Fases 5, 8.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.4.1 | Criar `src/core/finance/charge-set-collection.ts` | idem | `deno check` |
| 8.2.4.2 | Campo `private sets: Map<Account, ChargeSet>` (key = top-level) | idem | `deno check` |
| 8.2.4.3 | Método `add(set: ChargeSet): void` — valida `set.master !== null` | idem | 2 testes |
| 8.2.4.4 | Rejeita duplicata: `sets.has(top)` → `TjArgumentError` | idem | 2 testes |
| 8.2.4.5 | Aceita múltiplos se top-levels diferentes (custo + receita) | idem | 2 testes |
| 8.2.4.6 | `forTop(top: Account): ChargeSet \| null` | idem | 2 testes |
| 8.2.4.7 | `forType(type: CostType): ChargeSet \| null` (resolve por tipo via top-level) | idem | 3 testes |
| 8.2.4.8 | `all(): Iterable<ChargeSet>` | idem | 2 testes |
| 8.2.4.9 | `empty(): boolean` | idem | 2 testes |
| 8.2.4.10 | Alterar `Task.chargeset` para `ChargeSetCollection` (compat: 1 entrada) | `src/core/model/task.ts` | 3 testes |
| 8.2.4.11 | Alterar `Resource.chargeset` para `ChargeSetCollection` | `src/core/model/resource.ts` | 3 testes |
| 8.2.4.12 | Alterar `Material.chargeset` para `ChargeSetCollection` (Fase 8.1) | `src/core/model/material.ts` | 3 testes |
| 8.2.4.13 | Parser aceita `chargeset` múltiplo | `parser/rule_chargeset.ts` | 3 testes |
| 8.2.4.14 | Re-exportar em `finance/mod.ts` e `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco F — Motor de precedência

### 8.2.5 — `attribution.ts`

**⚠️ RUBY:** Não se aplica (novo em SyntaxMesh).

**Pré-requisitos:** Fases 5, 8.2.1–8.2.4.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.5.1 | Criar `src/core/accounting/attribution.ts` | idem | `deno check` |
| 8.2.5.2 | `interface CostLine` com `type`, `amount`, `explicitAccount?`, `task`, `resource?`, `material?` | idem | `deno check` |
| 8.2.5.3 | `function resolveAccount(line: CostLine): { account, rule }` | idem | 1 teste |
| 8.2.5.4 | Regra 1: `explicitAccount` presente → `explicit` | idem | 2 testes |
| 8.2.5.5 | Regra 2: `resource_effort` → `resource.chargeset.forType('resource')` → `origin_chargeset` | idem | 3 testes |
| 8.2.5.6 | Regra 2: `material_usage` → `material.chargeset.forType('material')` → `origin_chargeset` | idem | 3 testes |
| 8.2.5.7 | Regra 2: `task_charge` → pula (não há origem separada) | idem | 2 testes |
| 8.2.5.8 | Regra 3: `task.chargeset.forType(type)` → `task_chargeset_fallback` | idem | 3 testes |
| 8.2.5.9 | Regra 4: conta default do projeto → `project_default` | idem | 2 testes |
| 8.2.5.10 | `task.chargesetMode === 'force'` → regra 2 ignorada | idem | 3 testes |
| 8.2.5.11 | `force` + task sem chargeset do tipo → cai em regra 2 (fallback natural) | idem | 2 testes |
| 8.2.5.12 | Sem conta em nenhum nível → `TjArgumentError` claro | idem | 2 testes |
| 8.2.5.13 | `type` desconhecido → `TjInternalError` | idem | 1 teste |
| 8.2.5.14 | Re-exportar `resolveAccount` e `CostLine` | idem | `deno check` |
| 8.2.5.15 | Integrar `chargesetmode` no parser | `parser/rule_chargeset.ts` | 2 testes |
| 8.2.5.16 | Teste agregado: task force + resource com chargeset próprio → task domina | idem | 1 teste |

---

## Bloco G — Integração material

### 8.2.6 — Material no motor

**⚠️ RUBY:** Não se aplica.

**Pré-requisitos:** Fases 8.1, 8.2.5.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.6.1 | `MaterialAllocation` emite `CostLine` com `type = 'material_usage'` | `src/core/accounting/attribution.ts` | 3 testes |
| 8.2.6.2 | Custo = `quantity × unitPrice` | idem | 2 testes |
| 8.2.6.3 | Distribuição temporal via `modifier` respeitada | idem | 3 testes |
| 8.2.6.4 | Material com chargeset próprio → conta `origin_chargeset` | idem | 3 testes |
| 8.2.6.5 | Material sem chargeset → task chargeset → `task_chargeset_fallback` | idem | 2 testes |
| 8.2.6.6 | Emissão de `CostEvent` por material alocado | idem | 2 testes |
| 8.2.6.7 | Teste: 3 materiais em 1 task → 3 eventos | idem | 1 teste |
| 8.2.6.8 | Re-exportar em `accounting/mod.ts` | idem | `deno check` |

---

## Bloco H — Booking scenario-aware

### 8.2.7 — Booking + cenário

**⚠️ RUBY:** Não se aplica.

**Pré-requisitos:** Fases 8.1, 8.2.3.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.7.1 | Adicionar `scenarioIdx: number` em `ExtendedBooking` | `src/core/model/extended-booking.ts` | `deno check` |
| 8.2.7.2 | `Project.hasBookings(scenarioIdx): boolean` | `src/core/model/project.ts` | 3 testes |
| 8.2.7.3 | `Project.isProjectionMode(scenarioIdx): boolean` (delega a `hasBookings`) | idem | 2 testes |
| 8.2.7.4 | Parser: `booking ... real:booking ...` preenche `scenarioIdx` correto | `parser/rule_booking.ts` | 3 testes |
| 8.2.7.5 | Diretiva `trackingscenario <id>` → `Project.trackingScenario: string \| null` | idem | 2 testes |
| 8.2.7.6 | `CostEvent.mode` = `'actual'` se cenário é `trackingScenario` | idem | 2 testes |
| 8.2.7.7 | `CostEvent.mode` = `'planned'` caso contrário | idem | 2 testes |
| 8.2.7.8 | Teste: cenário sem bookings → sem eventos `actual` | idem | 1 teste |
| 8.2.7.9 | Re-exportar em `model/mod.ts` | idem | `deno check` |
| 8.2.7.10 | Compatibilidade: `trackingscenario` é opcional | idem | 1 teste |

---

## Bloco I — Integração com turnover

### 8.2.8 — Task/Resource `turnover` via motor

**⚠️ RUBY: `TaskScenario.rb` / `ResourceScenario.rb` (turnover)**
**🔎 CHEAT: §3 `is_a?` → `instanceof`**

**Pré-requisitos:** Fases 8, 8.2.1–8.2.7.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.8.1 | `TaskScenario.turnover` usa `resolveAccount` | `src/core/model/task-scenario.ts` | 3 testes |
| 8.2.8.2 | `TaskScenario.turnover` emite `CostEvent` por linha | idem | 3 testes |
| 8.2.8.3 | `turnoverByType` em task delega ao motor | idem | 2 testes |
| 8.2.8.4 | `ResourceScenario.turnover` usa `resolveAccount` | `src/core/model/resource-scenario.ts` | 3 testes |
| 8.2.8.5 | `ResourceScenario.turnover` emite `CostEvent` | idem | 2 testes |
| 8.2.8.6 | `AccountScenario.turnover` popula buckets conforme eventos | `src/core/model/account-scenario.ts` | 3 testes |
| 8.2.8.7 | Conta `aggregate tasks` rejeita custo de recurso/material | idem | 2 testes |
| 8.2.8.8 | Conta livre aceita os três tipos sem erro | idem | 2 testes |
| 8.2.8.9 | Compatibilidade Fase 8: golden tests continuam verdes | idem | 5 testes |
| 8.2.8.10 | Teste agregado: task com 2 recursos + 1 material + 1 charge → 4 eventos | idem | 1 teste |
| 8.2.8.11 | Teste agregado: 3 tipos para mesma conta → buckets corretos | idem | 1 teste |
| 8.2.8.12 | Re-exportar métodos | `model/mod.ts` | `deno check` |

---

## Bloco J — API de relatórios

### 8.2.9 — Breakdown + plan × actual

**⚠️ RUBY:** Não se aplica.

**Pré-requisitos:** 8.2.8.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.9.1 | `AccountScenario.taskTotal(startIdx, endIdx): number` | `account-scenario.ts` | 2 testes |
| 8.2.9.2 | `AccountScenario.resourceTotal(startIdx, endIdx): number` | idem | 2 testes |
| 8.2.9.3 | `AccountScenario.materialTotal(startIdx, endIdx): number` | idem | 2 testes |
| 8.2.9.4 | `AccountScenario.planVsActual(startIdx, endIdx): {planned, actual, variance}` | idem | 3 testes |
| 8.2.9.5 | Variance = `actual - planned` | idem | 2 testes |
| 8.2.9.6 | Filtro por `scenarioIdx` em `turnoverByType` (opcional) | idem | 2 testes |
| 8.2.9.7 | Teste: plan=100, actual=120 → variance=20 | idem | 1 teste |
| 8.2.9.8 | Teste: sem bookings → actual=0 | idem | 1 teste |
| 8.2.9.9 | Teste: com `trackingScenario` marcado → actual usa esse cenário | idem | 1 teste |
| 8.2.9.10 | Re-exportar métodos | `model/mod.ts` | `deno check` |

---

## Bloco K — Golden tests

### 8.2.10 — Golden tests

**Usa:** `tj3` real + fixtures da Fase 8 + variações novas.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 8.2.10.1 | Atualizar `scripts/golden/README.md` com seção 8.2 | idem | existe |
| 8.2.10.2 | Criar `scripts/golden/finance-8.2-account-types.rb` | idem | roda |
| 8.2.10.3 | Caso: conta com `aggregate tasks, resources, materials` | idem | ≥ 3 casos |
| 8.2.10.4 | Criar `scripts/golden/finance-8.2-multi-chargeset.rb` | idem | roda |
| 8.2.10.5 | Caso: task com chargeset custo + receita (2 top-levels) | idem | ≥ 3 casos |
| 8.2.10.6 | Criar `scripts/golden/finance-8.2-precedence.rb` | idem | roda |
| 8.2.10.7 | Casos: `force` vs `fallback`; com/sem chargeset de origem | idem | ≥ 6 casos |
| 8.2.10.8 | Criar `scripts/golden/finance-8.2-plan-vs-actual.rb` | idem | roda |
| 8.2.10.9 | Casos: bookings em cenário real; `trackingscenario` | idem | ≥ 5 casos |
| 8.2.10.10 | Serializar 4 JSONs em `packages/core/tests/golden/` | idem | JSON válido |
| 8.2.10.11 | Criar `tests/golden/finance-8.2_golden_test.ts` iterando os JSONs | idem | verde |
| 8.2.10.12 | Tolerância `1e-6`; cobertura ≥ 30 casos; commitar JSONs | idem | versionado |

---

## Bloco L — Verificação final

### 8.2.11 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 8.2.11.1 | `deno task check-all` verde | exit 0 |
| 8.2.11.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 8.2.11.3 | `grep -r "NotYetImplementedError" packages/core/src/accounting/` = 0 | grep |
| 8.2.11.4 | Golden tests da Fase 8 continuam verdes (compatibilidade) | exit 0 |
| 8.2.11.5 | ADR 031 criada e commitada | git log |
| 8.2.11.6 | `allowedTypes`, `CostEvent`, `ChargeSetCollection`, `resolveAccount` exportados | `deno check` |
| 8.2.11.7 | Smoke test: task com 3 tipos de custo + plan × actual | 1 teste |
| 8.2.11.8 | Auditoria: cada subfase do plano 8.2 tem tarefas correspondentes | grep |
| 8.2.11.9 | Invariante `sum(buckets) === total` testada em ≥ 5 cenários | grep |

---

## Notas para a IA

1. **Ordem:** 8.2.0 → 8.2.1 → 8.2.2 → 8.2.3 → 8.2.4 → 8.2.5 → 8.2.6 → 8.2.7 →
   8.2.8 → 8.2.9 → 8.2.10 → 8.2.11.
2. **Sempre ler o Ruby primeiro** quando a tarefa citar `⚠️ RUBY:`.
3. **Fidelidade + extensão.** Onde há Ruby, portar; onde não há, projetar conforme
   ADR 031.
4. **`Float` sem `Decimal`.** Tolerância `1e-6` em golden tests.
5. **`turnover` mantém assinatura.** `turnoverByType` é a API nova.
6. **`CostEvent` é emitido uma vez por linha de custo.**
7. **Múltiplos chargesets: no máximo um por top-level.** Validar na inserção.
8. **`force` só na tarefa.** Recurso/material não têm modo force.
9. **Buckets somam ao total.** Invariante testada.
10. **Compatibilidade `.tjp`:** golden da Fase 8 continuam verdes.
11. **Sem cache.** O(n²) replicado.
12. **Sem `any`.** `unknown` + narrowing.
13. **Commit por subfase.** `feat(core): account-allowed-types`,
    `feat(core): cost-event`, `feat(core): charge-set-collection`,
    `feat(core): attribution-engine`, etc.
14. **ADR 031** (não 019). ADR 019 é modelo financeiro base (Fase 8).
15. **Não tocar em Fase 14.** `AccountListRE` completo é Fase 14; aqui só a API.

### Notas específicas

**8.2.1 — `Account.allowedTypes`**
- Compatibilidade: sem `aggregate` → conjunto vazio → aceita tudo.
- `aggregate tasks` → comportamento idêntico ao TJ.

**8.2.2 — Buckets**
- Invariante `sum(buckets) === total` dentro de `1e-6`.
- `turnover` continua retornando total.

**8.2.3 — `CostEvent`**
- Append-only em `Project.costEvents`.
- Campos opcionais (`resourceId`, `materialId`) conforme tipo.

**8.2.4 — `ChargeSetCollection`**
- Key = top-level account (não o set inteiro).
- Rejeitar duplicata de top-level com erro claro.

**8.2.5 — Motor de precedência**
- Ordem: explicit → origin → task (fallback) → project.
- `force` ignora `origin`.
- Sem conta em nenhum nível → erro.

**8.2.6 — Material**
- Custo = `quantity × unitPrice`.
- Distribuição temporal via `modifier`.

**8.2.7 — Booking scenario-aware**
- Projection mode automático por presença de bookings.
- `trackingscenario` só marca; não muda comportamento.

**8.2.8 — Integração turnover**
- Cada linha emite 1 `CostEvent`.
- Buckets alimentados pelo evento.

**8.2.9 — API relatórios**
- `planVsActual` retorna `{planned, actual, variance}`.
- `variance = actual - planned`.

**8.2.10 — Golden tests**
- Manter golden da Fase 8 como regressão.
- Novos cobrem 8.2.

---

## Referências

- `docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md`
- `docs/syntaxmesh/decisoes/020-modelo-contabil-estendido.md`
- `docs/syntaxmesh/fases/fase-8-financeiro.md`
- `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`
- `docs/taskjuggler/lib/taskjuggler/Account.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`

---

## Fora de escopo

- Interface visual.
- Integração com sistemas externos.
- Estoque / inventário.
- Conversão automática de timesheets em bookings.
- Otimização do motor O(n²).
- Implementação de `AccountListRE` completo (Fase 14).

---

## Critério de aceite

```ts
// Conta aceita múltiplos tipos
const conta = new Account(project, 'c', 'Conta', null);
conta.allowedTypes = new Set(['task', 'resource', 'material']);
assertEquals(conta.canAccept('resource'), true);

// Subtotais por tipo
const acc = project.getAccount('c').scenarioData(0);
assertEquals(acc.turnoverByType(0, 30, 'task'), 100);
assertEquals(acc.turnoverByType(0, 30, 'resource'), 200);
assertEquals(acc.turnover(0, 30), 300);

// CostEvent
const ev = createCostEvent(
  { type: 'resource_effort', amount: 500, task: t, resource: r },
  conta, 'origin_chargeset', 0, 'planned',
);
assertEquals(ev.amount, 500);

// Múltiplos chargesets
const coll = new ChargeSetCollection();
coll.add(custoSet);   // top = Costs
coll.add(receitaSet); // top = Revenues
assertEquals(coll.all().length, 2);

// Motor de precedência
const { account, rule } = resolveAccount({
  type: 'resource_effort', amount: 100,
  task: t, resource: r,
});
assertEquals(rule, 'origin_chargeset');
```

---

**Fim do arquivo de tarefas da Fase 8.2.**


## Resumo executivo das mudanças

| Diretriz | Onde vive na 8.2 | Impacto |
|---|---|---|
| Conta não exclusiva | 8.2.1 (`allowedTypes`) | Remove a limitação do TJ sem quebrar `.tjp` |
| Subtotais por tipo | 8.2.2 (`buckets`, `turnoverByType`) | API nova; `turnover` antigo intacto |
| `CostEvent` auditável | 8.2.3 | Base para relatórios e debug |
| Múltiplos chargesets | 8.2.4 (`ChargeSetCollection`) | Restrição por top-level, não por tipo |
| Motor de precedência | 8.2.5 (`attribution.ts`) | Explícito, com `force`/`fallback` |
| Material no motor | 8.2.6 | Integra Fase 8.1 ao contábil |
| Booking scenario-aware | 8.2.7 | Projection mode automático; `trackingscenario` como papel |
| Turnover via motor | 8.2.8 | Consistência total |
| Relatórios | 8.2.9 | Breakdown + plan × actual |
| Compatibilidade | 8.2.10, 8.2.11 | Golden da Fase 8 como regressão |
