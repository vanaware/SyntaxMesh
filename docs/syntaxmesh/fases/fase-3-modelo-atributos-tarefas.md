# Fase 3 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-3-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-3-modelo-atributos.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~140 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{AttributeBase,AttributeDefinition,Attributes,deep_copy}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md` (seção relevante)
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### `compat.keepRubyBugs`

Criado na Fase 2 (`packages/core/src/compat.ts`). Ver **ADR 013** (`docs/syntaxmesh/decisoes/013-compat-flag-ruby-bugs.md`) e cheat sheet §15.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (bugs do Ruby).
- **ADR 014** — `mode` global de atributos (criado nesta fase).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (criado na Fase 4).

### Convenções

- `AttributeBase.setMode(0)` em `beforeEach` — sem isso, testes vazam estado.
- `tjpId` é `static readonly`.
- Valor mora no `AttributeContainer`, nunca em campo próprio.
- `deepClone` é pré-requisito (rodar 3.13 antes se preferir).
- `to_rti` que depende de Fase 11/12 lança `NotYetImplementedError`.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não criar classes novas (ex: `ScoreboardValue`) que não existam no Ruby.
- ❌ Não simplificar algoritmos complexos (ex: `to_tjp` de `WorkingHoursAttribute`).
- ❌ Não reordenar registros de `AttributeDefinition` (ordem do `Project.rb` é a verdade).
- ❌ Não usar `Proxy` em `AttributeBase` (a decisão é método `attribute(id)` explícito — ADR 015).

---

## Progresso

```
[ ] 3.0  ADR 014 (mode global)              —  0/5
[ ] 3.1  Interface + AttributeBase          —  0/19
[ ] 3.2  AttributeDefinition                —  0/8
[ ] 3.3  Escalares e temporais (7)          —  0/22
[ ] 3.4  Referência (3)                     —  0/11
[ ] 3.5  Listas primitivas (6)              —  0/14
[ ] 3.6  Dependências (2)                   —  0/6
[ ] 3.7  Financeiro (3)                     —  0/8
[ ] 3.8  Alocação e booking (2)             —  0/8
[ ] 3.9  Expressões lógicas (2)             —  0/4
[ ] 3.10 Tempo complexo (6)                 —  0/12
[ ] 3.11 Formatação (5)                     —  0/6
[ ] 3.12 Ricos (2)                          —  0/8
[ ] 3.13 deepClone utility                  —  0/10
[ ] 3.14 Golden tests                       —  0/9
─────────────────────────────────────────────
TOTAL: ~140
```

---

## Bloco A — Fundação

### 3.0 — ADR 014 (`mode` global de atributos)

**Objetivo:** formalizar a flag global `mode` como decisão de arquitetura.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 3.0.1 | Criar `docs/syntaxmesh/decisoes/014-attribute-mode-global.md` com frontmatter | idem | arquivo existe |
| 3.0.2 | Seção **Contexto**: `@@mode` class variable; 3 modos (0/1/2); uso no scheduler | idem | — |
| 3.0.3 | Seção **Decisão**: `static` em `AttributeBase` com getter/setter; reset em `beforeEach` | idem | — |
| 3.0.4 | Seções **Alternativas** (`AsyncLocalStorage`, context-passing, Symbol) + **Consequências** + **Relação com ADR 013** | idem | — |
| 3.0.5 | Adicionar linha `014` em `decisoes/README.md` | idem | 14 linhas |

---

### 3.1 — Interface + `AttributeBase` + `ListAttributeBase`

**⚠️ RUBY: `AttributeBase.rb` (arquivo inteiro — ~150 linhas)**
**🔎 CHEAT: §3 `@@classvar`, §8 `Hash.new { }`, §12 Categoria B (`Integer#round`)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 3.1.0 | Criar `src/model/property-like.ts` com `interface PropertyLike { readonly id: string; readonly name: string }` (R2) | `src/model/property-like.ts` | `deno check` |
| 3.1.1 | Criar `attributes/attribute-container.ts` com `interface AttributeContainer` (get/set) | idem | `deno check` |
| 3.1.2 | Criar `MockContainer` em testes (Map interno, `undefined` se ausente) | `tests/attributes/mock-container.ts` | `deno check` |
| 3.1.3 | Criar `attributes/errors.ts` com `TjError`, `TjArgumentError`, `TjRuntimeError`, `AttributeOverwrite`, `NotYetImplementedError` | `src/attributes/errors.ts` | `deno check` |
| 3.1.4 | Criar classe `AttributeBase<T>` vazia com `constructor(property: PropertyLike, type: AttributeDefinition<T>, container: AttributeContainer)` | `src/attributes/attribute-base.ts` | `deno check` |
| 3.1.5 | ⚠️ RUBY:24. `private static _mode: 0\|1\|2 = 0`; `static get mode()`; `static setMode(m)` | idem | 3 testes |
| 3.1.6 | Campos `protected readonly property/type/container`; flags `provided: boolean = false`, `inherited: boolean = false` | idem | 1 teste |
| 3.1.7 | ⚠️ RUBY:`reset`. Implementar: `inherited = provided = false`; `container.setStoredValue(type.id, deepClone(type.default))` | idem | 3 testes |
| 3.1.8 | ⚠️ RUBY:`inherit`. Implementar: `inherited = true`; `setStoredValue(id, deepClone(value))` | idem | 2 testes |
| 3.1.9 | ⚠️ RUBY:`set`. Implementar: `mode===0 → provided=true`; `mode===1 → inherited=true`; `setStoredValue(id, value)` | idem | 4 testes (mode 0/1/2) |
| 3.1.10 | Implementar `get()`, `get value()`, `get id()`, `get name()` | idem | 2 testes |
| 3.1.11 | ⚠️ RUBY:`nil?`. `isNil(): boolean` = `true` se `null`, `undefined` ou `Array.isArray() && length === 0` | idem | 4 testes |
| 3.1.12 | `isList(): boolean` retorna `false` na base | idem | 1 teste |
| 3.1.13 | ⚠️ RUBY:`to_s`, `to_num`, `to_sort`, `to_rti`, `to_tjp`. Implementar os 5 com defaults da base | idem | 5 testes |
| 3.1.14 | ⚠️ RUBY:`quotedString`. Protegido: se tem `\n` → `-8<-\n...\n->8-`; senão `"..."` com `\"` escapado | idem | 4 testes |
| 3.1.15 | ⚠️ RUBY:`ListAttributeBase`. Subclasse com `to_s() = get().join(', ')` e `isList(): true` | `src/attributes/list-attribute-base.ts` | 2 testes |
| 3.1.16 | Teste agregado: `beforeEach(() => AttributeBase.setMode(0))`; teste vaza estado se esquecer | idem | 1 teste (documenta) |
| 3.1.17 | Re-exportar em `attributes/mod.ts` | idem | `deno check` |
| 3.1.18 | Adicionar exports em `packages/core/mod.ts` (incluindo `PropertyLike`) | idem | `deno check` |

---

### 3.2 — `AttributeDefinition` + `AttributeType`

**⚠️ RUBY: `AttributeDefinition.rb` (arquivo inteiro — ~60 linhas)**
**🔎 CHEAT: §2 `.freeze` → `Object.freeze(this)`, §1 `Struct` → `interface`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 3.2.1 | Criar `attributes/attribute-type.ts` com `enum AttributeType` listando ~40 tipos do Ruby | idem | 1 teste (contagem ≥ 38) |
| 3.2.2 | Criar `attributes/attribute-definition.ts` com 8 campos `readonly` | idem | `deno check` |
| 3.2.3 | ⚠️ RUBY:`freeze`. Chamar `Object.freeze(this)` no fim do constructor | idem | 1 teste (`Object.isFrozen`) |
| 3.2.4 | Validar `id` não-vazio e `name` não-vazio (`TjArgumentError`) | idem | 2 testes |
| 3.2.5 | `userDefined` default `false` | idem | 2 testes |
| 3.2.6 | Função `attributeTypeClass(type: AttributeType)` que retorna o construtor correspondente | idem | 3 testes |
| 3.2.7 | Teste: mutar campo lança `TypeError` (strict mode) | idem | 1 teste |
| 3.2.8 | Re-exportar em `attributes/mod.ts` | idem | `deno check` |

---

### 3.3 — Escalares e temporais

**⚠️ RUBY: `Attributes.rb` — 7 subclasses**
**🔎 CHEAT: §2 (classes), §5 (strings), §12 (bugs)**

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.3.1–3.3.3 | `StringAttribute` | `text` | 3 |
| 3.3.4–3.3.6 | `IntegerAttribute` | `integer` | 3 |
| 3.3.7–3.3.9 | `FloatAttribute` | `number` | 3 |
| 3.3.10–3.3.13 | `BooleanAttribute` | `boolean` | 4 (`to_s`, `to_tjp` com `yes/no`) |
| 3.3.14–3.3.15 | `SymbolAttribute` | `symbol` | 2 |
| 3.3.16–3.3.18 | `DateAttribute` | `date` | 3 (`to_s` com formato, `to_s(null) → 'Error'`) |
| 3.3.19–3.3.21 | `DurationAttribute` | `duration` | 3 (`to_s(null) → '${get()}h'`) |
| 3.3.22 | Teste agregado — cada `tjpId` × 1 valor | — | 1 |

**Padrão por subclasse** (ex: `StringAttribute`):
1. Criar arquivo com classe vazia + `tjpId`.
2. Implementar override(s) de `to_tjp`/`to_s` (ler Ruby).
3. Testes para cada override.

---

### 3.4 — Referência

**⚠️ RUBY: `Attributes.rb` — `PropertyAttribute`, `AccountAttribute`, `ReferenceAttribute`**
**🔎 CHEAT: §5 `String#gsub`, §3 `arr.join`**

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.4.1–3.4.3 | `PropertyAttribute` | `property` | 3 |
| 3.4.4–3.4.6 | `AccountAttribute` (`to_s = get()?.id ?? ''`) | `account` | 3 |
| 3.4.7–3.4.11 | `ReferenceAttribute` (`url()`, `label()`, `to_s`, `to_tjp` com `{ label "..." }`) | `reference` | 5 |

**Nota:** `ReferenceAttribute.to_rti` depende de RichText (Fase 12). Stub com `NotYetImplementedError` + comentário `// TODO Fase 12`.

---

### 3.5 — Listas primitivas

**⚠️ RUBY: `Attributes.rb` — 6 subclasses**

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.5.1–3.5.2 | `FlagListAttribute` (`to_tjp = "flags ${join(', ')}"`) | `flaglist` | 2 |
| 3.5.3–3.5.4 | `SymbolListAttribute` | `symbollist` | 2 |
| 3.5.5–3.5.6 | `ScenarioListAttribute` | `scenarios` | 2 |
| 3.5.7–3.5.8 | `NodeListAttribute` (sem `tjpId`) | — | 2 |
| 3.5.9–3.5.11 | `ResourceListAttribute` (`to_s` junta `fullId`; `to_rti` stub Fase 12) | `resourcelist` | 3 |
| 3.5.12–3.5.14 | `TaskListAttribute` | `tasklist` | 3 |

---

### 3.6 — Dependências

**⚠️ RUBY: `Attributes.rb` — 2 subclasses**
**Nota:** `TaskDependency` é Fase 7. Usar tipo `{ task: { fullId: string } }` local.

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.6.1–3.6.3 | `DependencyListAttribute` (`to_s` filtra `null`) | `dependencylist` | 3 |
| 3.6.4–3.6.6 | `TaskDepListAttribute` (desestrutura tuplas) | `taskdeplist` | 3 |

---

### 3.7 — Financeiro

**⚠️ RUBY: `Attributes.rb` — 3 subclasses**
**Nota:** `Charge`, `ChargeSet`, `AccountCredit` são Fase 8. Stubs tipados.

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.7.1–3.7.2 | `ChargeListAttribute` | `charge` | 2 |
| 3.7.3–3.7.5 | `ChargeSetListAttribute` (`to_s` chama `.to_s()`) | `chargeset` | 3 |
| 3.7.6–3.7.8 | `AccountCreditListAttribute` (default `[]`) | `credits` | 3 |

---

### 3.8 — Alocação e booking

**⚠️ RUBY: `Attributes.rb` — 2 subclasses**
**Nota:** `Allocation`, `Booking` são Fase 7. Stubs tipados.

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.8.1–3.8.5 | `AllocationAttribute` — `to_s` com `select by mode`, `mandatory`, `persistent` (5 casos) | `allocation` | 5 |
| 3.8.6–3.8.8 | `BookingListAttribute` — `to_s` OK; `to_tjp` **lança** | `bookinglist` | 3 |

---

### 3.9 — Expressões lógicas

**⚠️ RUBY: `Attributes.rb` — 2 subclasses**
**Nota:** `LogicalExpression` é Fase 11. Wrapper trivial.

| # | Subclasse | `tjpId` | Tarefas |
|---|---|---|---|
| 3.9.1–3.9.2 | `LogicalExpressionAttribute` | `logicalexpressions` | 2 |
| 3.9.3–3.9.4 | `LogicalExpressionListAttribute` (`isList: true`) | `logicalexpressions` | 2 |

---

### 3.10 — Tempo complexo

**⚠️ RUBY: `Attributes.rb` — 6 subclasses**

| # | Subclasse | `tjpId` | Nota | Tarefas |
|---|---|---|---|---|
| 3.10.1–3.10.2 | `TimeIntervalListAttribute` | `intervallist` | | 2 |
| 3.10.3–3.10.4 | `LeaveListAttribute` | `leave` | `to_tjp = "leaves ${join(',\n')}"` | 2 |
| 3.10.5–3.10.6 | `LeaveAllowanceListAttribute` | — | sem `tjpId` | 2 |
| 3.10.7–3.10.8 | `LimitsAttribute` | `limits` | constructor chama `setProject`; `to_tjp` lança | 2 |
| 3.10.9–3.10.10 | `ShiftAssignmentsAttribute` | `shifts` | constructor seta `project`; `to_tjp` implementa | 2 |
| 3.10.11–3.10.12 | `WorkingHoursAttribute` | `workinghours` | `to_tjp` itera 7 dias | 2 |

**Nota:** `WorkingHours` existe (Fase 2) → `to_tjp` **completo**. Os demais usam `NotYetImplementedError`.

---

### 3.11 — Formatação

**⚠️ RUBY: `Attributes.rb` — 5 subclasses**

| # | Subclasse | `tjpId` | Nota | Tarefas |
|---|---|---|---|---|
| 3.11.1 | `RealFormatAttribute` | — | sem `tjpId` | 1 |
| 3.11.2 | `ColumnListAttribute` | `columns` | `to_s = 'TODO'` (replicar) | 1 |
| 3.11.3 | `FormatListAttribute` | — | `to_s = join(', ')` | 1 |
| 3.11.4 | `SortListAttribute` | `sorting` | | 1 |
| 3.11.5 | `JournalSortListAttribute` | `journalsorting` | | 1 |
| 3.11.6 | Teste agregado | — | 1 |

---

### 3.12 — Ricos

**⚠️ RUBY: `Attributes.rb` — 2 subclasses**
**Nota:** `RichText` é Fase 12. Interface `RichTextIntermediate` em `format/`.

| # | Tarefa | Verificação |
|---|---|---|
| 3.12.1 | Criar `format/rich-text-port.ts` com `interface RichTextIntermediate` | `deno check` |
| 3.12.2–3.12.5 | `RichTextAttribute` — `inputText()`, `tjpId='richtext'`, `to_s`, `to_tjp` | 4 testes |
| 3.12.6–3.12.7 | `DefinitionListAttribute` (`isList: true`, sem `tjpId`) | 2 testes |
| 3.12.8 | `RichTextAttribute` com `get() === null` → `inputText() === ''` | 1 teste |

---

### 3.13 — `deepClone` utility

**⚠️ RUBY: `deep_copy.rb` (arquivo inteiro — ~80 linhas)**
**🔎 CHEAT: §3 `.clone`/`dup`, §12 (referências circulares)**

| # | Tarefa | Verificação |
|---|---|---|
| 3.13.1 | Criar `utils/deep-clone.ts` com `deepClone<T>(value: T): T` | `deno check` |
| 3.13.2 | Primitivos (`number`, `string`, `boolean`, `bigint`, `symbol`, `null`, `undefined`) | 5 testes |
| 3.13.3 | `TjTime` e `RealFormat` → retornam mesma referência | 2 testes |
| 3.13.4 | Objeto com método `deepClone()` → chama | 1 teste |
| 3.13.5 | Objeto com método `deep_clone()` (compat) → chama | 1 teste |
| 3.13.6 | `Array` → recursivo | 2 testes |
| 3.13.7 | `Map` → novo Map com valores clonados | 1 teste |
| 3.13.8 | `Set` → novo Set | 1 teste |
| 3.13.9 | Fallback → `structuredClone` | 1 teste |
| 3.13.10 | ⚠️ Referências circulares: `structuredClone` lança; documentar limitação | 1 teste |

---

### 3.14 — Golden tests

**⚠️ RUBY: `AttributeBase.rb`, `Attributes.rb`**
**Usa:** `docs/taskjuggler/test/` + `tj3` real

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 3.14.1 | Atualizar `scripts/golden/README.md` | idem | existe |
| 3.14.2 | `scripts/golden/attributes.rb` — ~40 casos (cada tipo × 2 valores) | idem | JSON válido |
| 3.14.3 | Estender com casos de `mode` (0/1/2) e `inherit` | idem | ≥ 60 |
| 3.14.4 | Task `golden:generate` atualizada | `deno.jsonc` | roda |
| 3.14.5 | `tests/golden/attributes_golden_test.ts` — `to_tjp()` | idem | verde |
| 3.14.6 | Comparar `to_s()` com tolerância de whitespace | idem | verde |
| 3.14.7 | Comparar `deepClone` de cada default | idem | verde |
| 3.14.8 | Mensagens detalhadas quando diverge | idem | 3 testes |
| 3.14.9 | Commitar JSON em `packages/core/tests/golden/attributes.golden.json` | idem | versionado |

---

## Bloco C — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 3.15.1 | `deno task check-all` verde | exit 0 |
| 3.15.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 3.15.3 | `grep -r "NotYetImplementedError" packages/core/src/attributes/` ≥ 5 (stubs) | grep |
| 3.15.4 | ADR 014 criada e commitada | git log |
| 3.15.5 | Todos os ~40 tipos exportados em `attributes/mod.ts` | `deno check` |
| 3.15.6 | Interface `PropertyLike` implementada em `model/` | `deno check` |
| 3.15.7 | `tests/integration/smoke_after_phase_3_test.ts` — importa `@syntaxmesh/core`, cria `AttributeBase.setMode(0)`, verifica exports | 1 teste |
| 3.15.8 | Auditoria: cada subfase do plano `fase-3-modelo-atributos.md` tem tarefas correspondentes | grep |
| 3.15.9 | Corrigir numeração em `fase-3-modelo-atributos.md` (`### 6.x` → `### 3.x`) | grep |
| 3.15.10 | Atualizar `docs/syntaxmesh/03-arquitetura.md` com `attributes/` e `compat.ts` | seção |

---

## Notas para a IA

1. **Ordem:** 3.0 → 3.1 → ... → 3.14 → Bloco C. Exceção: 3.13 (deepClone) pode ir antes de 3.1.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura.
3. **Cheat sheet §12:** categorizar qualquer bug em A/B/C. Categoria B usa `compat.keepRubyBugs`.
4. **`AttributeBase.setMode(0)` em `beforeEach`.**
5. **`PropertyLike` é mínimo nesta fase** (só `id`, `name`). Fase 4 expande.
6. **Stubs** (`NotYetImplementedError`) sempre com comentário `// TODO Fase N: <razão>`.
7. **Não inventar classes.** Se não está no Ruby, não existe.
8. **Ordem dos `AttributeDefinition`** preserva ordem do `Project.rb` (Fase 5).
9. **Commit por subfase.** `feat(core): attribute-base`, etc.
10. **Sem `any`.** Use `unknown` + narrowing.
11. **Golden tests são o critério final.** Rodar `tj3` real se possível.
12. **Não corrigir bugs de outras fases.** Abrir issue no arquivo da fase competente.
13. **Não usar `Proxy`.** Método `attribute(id)` explícito (ADR 015).
14. **ADR 014** (não 013) para `mode` global. **ADR 013** é `compat.keepRubyBugs`.

---

**Fim do arquivo de tarefas da Fase 3.**