# ADR 016 — Pré-carregamento de atributos em `*Scenario`

## Contexto

No TaskJuggler Ruby, o construtor de cada `*Scenario` (ex: `TaskScenario`, `ResourceScenario`) itera sobre uma lista de atributos e os acessa via `@property[attr, @scenarioIdx]`. Isso força a criação imediata de cada `AttributeBase` no cenário, em vez de criá-los lazy no primeiro acesso.

```ruby
# TaskScenario.rb (linhas 28–36)
%w( allocate assignedresources booking charge chargeset complete
    competitors criticalness depends duration
    effort effortdone effortleft end forward gauge length
    maxend maxstart minend minstart milestone pathcriticalness
    precedes priority projectionmode responsible
    scheduled shifts start status ).each do |attr|
  @property[attr, @scenarioIdx]
end
```

**Por que existe:** o scheduler (Fase 7) acessa esses atributos repetidamente. Criar lazy no primeiro acesso adicionaria verificação de existência a cada chamada. Pré-carregar garante que o atributo existe e está no modo correto desde a construção.

## Decisão

Implementar `preloadAttributes(ids: string[])` em `ScenarioData` que, para cada id:
1. Chama `property.getScenarioAttribute(scIdx, id)` — que cria o `AttributeBase` se não existir.
2. Rejeita `id` desconhecido com `TjArgumentError`.
3. Aceita lista vazia (no-op).

```ts
// ScenarioData
public preloadAttributes(ids: string[]): void {
  for (const id of ids) {
    this.property.getScenarioAttribute(this.scenarioIdx, id);
  }
}
```

O `*Scenario` constructor chama `this.preloadAttributes(TASK_SCENARIO_ATTRS)` após `super()`.

## Alternativas

| Alternativa | Descrição | Por que rejeitada |
|---|---|---|
| Lazy puro | Criar atributo só no primeiro `get()` | Adiciona overhead a cada acesso do scheduler; Ruby não faz isso |
| Pré-carregar tudo | Criar todos os atributos do PropertySet | Desnecessário — só os que o scheduler usa |

## Consequências

- `*Scenario` constructors são ligeiramente mais lentos na criação, mas acessos subsequentes são mais rápidos.
- `preloadAttributes` é idempotente (criar atributo já existente é no-op via `attribute()`).
- ADR 016 aplica-se a Task, Resource, Account, Shift, Report.

---

**Status:** Proposto
**Data:** 2026-10-01
**Autor(es):** SyntaxMesh
