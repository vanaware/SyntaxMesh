# 014 — Attribute mode global em TypeScript

## Contexto

O `AttributeBase.rb` do TaskJuggler usa uma **class variable** `@@mode` compartilhada entre `AttributeBase` e todas as suas ~40 subclasses. O `mode` é um inteiro `0`, `1` ou `2` que influencia o comportamento de `set()` e `inherit()`:

- **`mode = 0` (provided):** o valor foi definido pelo usuário (no `.tjp` ou programaticamente). Ao chamar `set()`, a flag `provided` do atributo é marcada como `true`.
- **`mode = 1` (inherited):** o valor veio do pai ou do projeto. Ao chamar `set()`, a flag `inherited` é marcada como `true`.
- **`mode = 2` (computed):** o valor foi calculado pelo scheduler. Ao chamar `set()`, nenhuma flag é marcada (é o resultado de um cálculo interno).

O scheduler alterna entre os modos durante o pipeline:

```
prepareScenario   → AttributeBase.setMode(1)   // herança do pai/projeto
scheduleScenario  → AttributeBase.setMode(2)   // cálculo interno
finishScenario    → AttributeBase.setMode(0)   // volta ao default
```

Isso permite que o mesmo `set()` seja usado em contextos diferentes sem passar uma flag explícita. O `mode` é um estado **global do processo**, não do atributo.

**Problema:** em TypeScript, não existe equivalente direto a `@@classvar` compartilhada entre subclasses. Precisamos decidir como representar esse estado global.

**Alternativas consideradas:**

- **A) `static` em `AttributeBase`.** Simples, direto, herda o mesmo comportamento do Ruby.
- **B) `AsyncLocalStorage`.** Permite concorrência entre projetos no mesmo worker, mas adiciona complexidade e não é necessário nesta fase.
- **C) Context-passing explícito.** `set(value, mode)` — mais verboso, exige mudar ~40 subclasses.
- **D) `Symbol` no valor.** Cada valor carrega seu modo — poluído, quebra a serialização.
- **E) Map global `modeByProperty`.** Cada propriedade tem seu próprio mode — mais granular, mas diverge do Ruby.
- **F) Instância estática por classe.** Cada subclasse tem seu próprio `mode` — diverge do Ruby (que é compartilhado).

## Decisão

Adotado a alternativa **A**: `static` em `AttributeBase`, com getter/setter estáticos.

```ts
// packages/core/src/attributes/attribute-base.ts

export type AttributeMode = 0 | 1 | 2;

export abstract class AttributeBase<T> {
  private static _mode: AttributeMode = 0;

  static get mode(): AttributeMode {
    return AttributeBase._mode;
  }

  static setMode(mode: AttributeMode): void {
    AttributeBase._mode = mode;
  }

  // ... resto dos métodos
}
```

**Regras de uso:**

- `setMode(0)` é o **default**. Sempre resetar em `beforeEach` de testes.
- `setMode(1)` antes de `prepareScenario`, `setMode(2)` antes de `scheduleScenario`.
- Nunca chamar `setMode` durante a construção de atributos (o modo é irrelevante no `constructor`).
- Documentar qualquer uso de `mode` no código com um comentário.

**Relação com o ADR 013 (`compat.keepRubyBugs`):**

São decisões **independentes**:

| Decisão | Escopo | ADR |
|---|---|---|
| `mode` global | Comportamento de `set()`/`inherit()` | **014** (este) |
| `keepRubyBugs` | Comportamento de bugs do Ruby | **013** |

Nenhuma das duas é subconjunto da outra. Podem coexistir sem conflito.

**Relação com o ADR 015 (`PropertyTreeNode`):**

O `PropertyTreeNode` (Fase 4) **não** usa `mode` diretamente. Ele apenas chama `attribute(id)` ou `scenarioAttribute(id)` que criam `AttributeBase` — a leitura de `mode` acontece dentro do `set()` do atributo. Isso mantém a separação de responsabilidades.

## Consequências

### Positivas

- **Simplicidade:** `static get/set` é direto e legível.
- **Paridade com Ruby:** mesmo comportamento de `@@mode` global.
- **Sem boilerplate:** nenhuma subclasse precisa declarar `mode`.
- **Zero overhead:** uma variável estática, sem `AsyncLocalStorage` ou `Map`.
- **Compatibilidade com golden tests:** o pipeline do scheduler segue o mesmo.

### Negativas / Riscos

- **Sem concorrência entre projetos:** dois `Project.schedule()` simultâneos no mesmo worker clobberariam o `mode` um do outro.
  - **Mitigação:** aceito. O SyntaxMesh roda single-threaded no worker. Se concorrência for necessária no futuro, migrar para `AsyncLocalStorage`.
- **Vazamento entre testes:** esquecer `beforeEach(() => AttributeBase.setMode(0))` faz o teste seguinte herdar o modo anterior.
  - **Mitigação:** obrigatório em `beforeEach`/`afterEach` (documentado em `fase-3-tarefas.md` e no preâmbulo).
- **Estado mutável global:** difícil de testar isoladamente.
  - **Mitigação:** testes explícitos cobrindo os 3 modos (tarefa `3.1.5`, `3.1.9`).

### Neutras / Observações

- O `mode` **não é uma preferência do usuário** — é um detalhe interno do pipeline. Nunca deve ser exposto na UI.
- O `mode` **não afeta** `get()`, `reset()`, `isNil()`, `to_s()` — apenas `set()` e `inherit()`.
- A flag `compat.keepRubyBugs` do ADR 013 **não interfere** no `mode`. São decisões ortogonais.
- Ver `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb` linhas 20–40 para o `@@mode` original.
- Ver `docs/tj3-engine/02-bluprint-engine1.md` §2.5 para o pipeline de scheduling.

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware
**Relacionado:** ADR 013 (compat.keepRubyBugs), ADR 015 (PropertyTreeNode)