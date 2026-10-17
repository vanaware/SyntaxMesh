---
name: Modelo Contábil Estendido
description: Extensão do modelo financeiro TJ para contas não exclusivas, subtotais por tipo, CostEvent auditável, múltiplos chargesets e motor de precedência
type: project
category: important_decision
keywords:
  - extended accounting model
  - non-exclusive accounts
  - subtotals by type
  - CostEvent audit trail
  - multiple chargesets
  - attribution engine
  - force/fallback precedence
usage_scenarios:
  - Porting Phase 8.2 features from Ruby to TypeScript
  - Implementing extended accounting beyond base finance
  - Adding subtotals by cost/resource/material type
  - Creating audit trail with CostEvent
  - Supporting multiple chargesets per project
  - Implementing attribution engine with force/fallback
---
# ADR 020 — Modelo Contábil Estendido (Fase 8.2)

## Contexto

O modelo financeiro base da Fase 8 implementa as estruturas essenciais do TaskJuggler Ruby:

- `AccountCredit` — créditos manuais
- `Charge` — custo por tarefa
- `ChargeSet` — distribuição de custos entre contas
- `AccountScenario.turnover` — pipeline completo de cálculo de custos

No entanto, o Ruby TJ 3.8.4 inclui funcionalidades adicionais que a port SyntaxMesh ainda não implementou:

1. **Contas não exclusivas** — `aggregate tasks`, `aggregate resources`, `aggregate materials` criam contas que aceitam apenas o tipo de custo correspondente.
2. **Subtotais por tipo** — `AccountScenario.turnoverByType()` e `AccountBuckets` permitem breakdown por `task` / `resource` / `material`.
3. **Auditoria** — `CostEvent` registra cada linha de custo com tipo, conta, regra de atribuição, índice de cenário e modo (`planned`/`actual`).
4. **Múltiplos chargesets** — um projeto pode ter vários `ChargeSetCollection` (um por top-level account), cada com seu próprio `master` e `share`.
5. **Motor de precedência** — `resolveAccount()` implementa regras explícitas → origem → fallback → default, com modos `force`/`fallback`.
6. **Booking scenario-aware** — `ExtendedBooking` e `trackingscenario` marcam eventos como `actual` vs `planned`.

Estas extensões são necessárias para:

- Compatibilidade total com o Ruby TJ (nenhum golden test deve quebrar)
- Relatórios mais detalhados (breakdown por tipo, plan × actual)
- Auditoria e depuração (CostEvent)
- Flexibilidade de modelagem (contas não exclusivas, chargesets múltiplos)

## Decisão 1: Contas não exclusivas com `allowedTypes`

### Problema

Contas com `aggregate tasks` só devem aceitar custos de tarefas, não de recursos ou materiais. O mesmo para `aggregate resources` e `aggregate materials`.

### Solução

Adicionar `Account.allowedTypes: Set<CostType>` onde `CostType = 'task' | 'resource' | 'material'`.

- Sem `aggregate` → `allowedTypes` vazio → aceita qualquer tipo (comportamento original).
- `aggregate tasks` → `allowedTypes = {'task'}`.
- `aggregate resources` → `allowedTypes = {'resource'}`.
- `aggregate materials` → `allowedTypes = {'material'}`.

### Implementação

- `Account` possui `allowedTypes: Set<CostType>` (vazio por default).
- `Account.canAccept(type)` retorna `true` se `allowedTypes` vazio ou contém o tipo.
- Parser (`rule_aggregate.ts`) popula `allowedTypes` conforme a diretiva.

### Consequências

- Rejeita custos incompatíveis com erro claro.
- Permite subtotais por tipo (`turnoverByType`).
- Sem impacto em golden tests da Fase 8 (sem `aggregate` nos fixtures).

## Decisão 2: `CostEvent` como unidade auditável

### Problema

O sistema precisa registrar cada linha de custo para auditoria, depuração e relatórios.

### Solução

Criar `CostEvent` com campos:

```ts
interface CostEvent {
  type: 'task_charge' | 'resource_effort' | 'material_usage';
  amount: number;
  account: Account;
  rule: AttributionRule; // 'explicit' | 'origin_chargeset' | 'task_chargeset_force' | 'task_chargeset_fallback' | 'project_default';
  scenarioIdx: number;
  mode: 'planned' | 'actual';
  // campos opcionais
  task?: Task;
  resource?: Resource;
  material?: Material;
}
```

- `Project.costEvents: CostEvent[]` (append-only).
- Emitido por `TaskScenario.turnover`, `ResourceScenario.turnover`, `MaterialAllocation`.
- `mode` determinado por `trackingscenario` (actual) vs default (planned).

### Consequências

- Base para relatórios de auditoria.
- Permite breakdown por tipo e plan × actual.
- Sem impacto em golden tests da Fase 8 (sem novos eventos nos fixtures).

## Decisão 3: Múltiplos chargesets com `ChargeSetCollection`

### Problema

Um projeto pode precisar de mais de um conjunto de distribuição de custos (ex: um para custos, outro para receitas). O Ruby TJ permite apenas um `ChargeSet` por projeto, mas SyntaxMesh pode estender.

### Solução

`ChargeSetCollection`:

- Mapeia `top-level Account → ChargeSet`.
- `add(set)` valida que `set.master !== null`.
- Rejeita duplicata de mesmo top-level.
- `forType(type)` resolve por tipo via top-level.

Integração:

- `Task.chargeset`, `Resource.chargeset`, `Material.chargeset` tornam-se `ChargeSetCollection` (compat: 1 entrada).
- Parser (`rule_chargeset.ts`) aceita múltiplos.

### Consequências

- Permite chargeset custo + chargeset receita no mesmo projeto.
- Sem quebra de golden tests da Fase 8 (sem chargeset múltiplo nos fixtures).

## Decisão 4: Motor de precedência (`force`/`fallback`)

### Problema

Qual conta usar quando múltiplas opções existem? O Ruby TJ usa ordem fixa; SyntaxMesh adiciona regras explícitas e modos `force`/`fallback`.

### Solução

`resolveAccount(line: CostLine): { account, rule }`

Regras (em ordem):

1. **Explícito** — `line.explicitAccount` presente.
2. **Origem** — `resource_effort` → `resource.chargeset.forType('resource')`.
3. **Material** — `material_usage` → `material.chargeset.forType('material')`.
4. **Fallback** — `task_charge` → `task.chargeset.forType(type)`.
5. **Default** — conta default do projeto.

Modos:

- `force` ignora regra de origem.
- `fallback` permite fallback para próximo nível.

### Consequências

- Flexível, auditável, extensível.
- Sem quebra de golden tests (sem `force`/`fallback` nos fixtures).

## Alternativas

- Manter modelo Ruby 1: apenas um chargeset por projeto, sem `allowedTypes`, sem auditoria.
- Implementar posteriormente: `AccountListRE` (Fase 14) para relatórios.
- Otimizar motor: cache em `AccountScenario.turnover` (aceito O(n²)).

## Consequências

- **Funcionalidade:** contas não exclusivas, subtotais por tipo, auditoria, chargesets múltiplos, motor flexível.
- **Performance:** O(n²) mantido; sem cache.
- **Manutenção:** ADRs claros, stubs (`NotYetImplementedError`) para dependências futuras.
- **Compatibilidade:** golden tests da Fase 8 continuam verdes.

## Relação com ADRs

- **ADR 019** (modelo financeiro) — base; este ADR estende.
- **ADR 011** — fidelidade ao Ruby mantida.
- **ADR 013** — `compat.keepRubyBugs` não afeta esta extensão.
- **ADR 014** — `mode` global usado por `CostEvent.mode`.
- **ADR 015** — `PropertyTreeNode` usado por `Account`.
- **ADR 016** — pré-carregamento em `AccountScenario`.
- **ADR 017** — scoreboard não afetado.
- **ADR 018** — heurística do scheduler não afetada.

## Como aplicar

1. Implementar `Account.allowedTypes` e `canAccept`.
2. Criar `CostEvent` e `Project.costEvents`.
3. Implementar `ChargeSetCollection`.
4. Implementar `resolveAccount` com regras e modos.
5. Integrar `CostEvent` em `TaskScenario.turnover`, `ResourceScenario.turnover`, `MaterialAllocation`.
6. Adicionar `booking scenario-aware` (`ExtendedBooking.scenarioIdx`).
7. Escrever golden tests (`finance-8.2-*`) e testes unitários.
8. Executar `deno task check-all` e `deno task golden:generate && deno task test`.

---

**Status:** Proposto (2026-10-15)
**Próximo passo:** Implementar subfase 8.2.1 (`Account.allowedTypes`).