# Fase 11 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-11-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-11-logica-queries.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~195 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{LogicalExpression,LogicalOperation,LogicalFunction,Query,SimpleQueryExpander}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

O parser (Fase 10) **constrói** objetos `Logical*` ao parsear `.tjp` (via `rule_logicalExpression` etc.), mas **não os avalia**. Isso significa que as classes `Logical*` devem existir **antes** ou **em paralelo** com a Fase 10.

**Recomendação forte:** executar as **subfases 11.0–11.4 (Logical\*)** **antes** da Fase 10. O resto (11.5+) pode rodar depois.

**Consequência:** o `fase-10-tarefas.md` **assume** que os tipos existem. Se a ordem for invertida, implementar apenas as **classes de construção** na Fase 10 (stubs) e completar `eval` aqui.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (Fase 7).
- **ADR 019** — Modelo financeiro (Fase 8).
- **ADR 020** — Orquestrador e pipeline (Fase 9).
- **ADR 021** — FSM do TextParser (Fase 10).
- **ADR 022** — i18n de keywords (Fase 10).
- **ADR 023** — Expressões lógicas sem precedência (**criado nesta fase**).

### Convenções CRÍTICAS

- **Sem precedência de operadores.** `a | b & c` = `(a | b) & c`, não `a | (b & c)`.
- **`&` e `|` são lazy (short-circuit).**
- **Coerção pelo tipo do `operand1`** (não do `operand2`).
- **Sufixo `_` em funções inverte `property`/`scopeProperty`.**
- **`Query.process` tenta:** customData → property.query_X → data[scIdx].query_X → attribute base.
- **`Query.start`/`end` sincronizados com `startIdx`/`endIdx`.** Setters obrigatórios.
- **`resolvePropertyId` com `!` sobe um nível por caractere.**
- **`scaleValue` com `shortauto`/`longauto` é complexo.** Copiar literalmente.
- **`assignList` sem `RichText` nesta fase.** Retorna string; Fase 12 pluga `RichTextFactory`.
- **`hasalert` é stub.** Fase 16 completa.
- **`LogicalFlag` para Journal é Fase 16.** Só `Query` nesta fase.
- **`SimpleQueryExpander` regex:** `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não introduzir precedência de operadores.
- ❌ Não avaliar `operand2` de `&`/`|` sem short-circuit.
- ❌ Não trocar a ordem de coerção (deve ser pelo `operand1`).
- ❌ Não usar `Proxy`.
- ❌ Não confundir `LogicalAttribute` (lê atributo) com `LogicalOperation` (nó genérico).
- ❌ Não pular o `sufixo _` em funções.
- ❌ Não usar `RichText` real nesta fase.
- ❌ Não usar `Journal` real nesta fase.

---

## Progresso

```
[ ] 11.0  ADR 023 (expressões sem precedência)    —  0/5
[ ] 11.1  LogicalOperation                        —  0/22
[ ] 11.2  LogicalAttribute + LogicalFlag          —  0/14
[ ] 11.3  LogicalFunction (14 funções)            —  0/32
[ ] 11.4  LogicalExpression                       —  0/12
[ ] 11.5  Testes e2e (expressões complexas)       —  0/8
[ ] 11.6  Query estrutura                         —  0/22
[ ] 11.7  Query.process                           —  0/16
[ ] 11.8  Query accessors                         —  0/12
[ ] 11.9  Query scale + assignList                —  0/14
[ ] 11.10 Query resolvePropertyId + customData    —  0/10
[ ] 11.11 SimpleQueryExpander                     —  0/10
[ ] 11.12 Integração com TaskScenario/Resource    —  0/20
[ ] 11.13 Golden tests                            —  0/10
[ ] 11.14 Verificação final                       —  0/8
────────────────────────────────────────────────────
TOTAL: ~195
```

---

## Bloco A — Fundação

### 11.0 — ADR 023 (expressões sem precedência)

**Objetivo:** formalizar a decisão de manter a avaliação **left-to-right sem precedência**.

**⚠️ Nota:** o plano usa `ADR 022`, mas o ADR 022 foi alocado para `i18n-keywords` (Fase 10). Aqui usamos **ADR 023**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.0.1 | Criar `docs/syntaxmesh/decisoes/023-expressoes-logicas.md` com frontmatter | idem | arquivo existe |
| 11.0.2 | Seção **Contexto:** TJ avalia left-to-right sem precedência; `a \| b & c` = `(a \| b) & c`; `&`/`\|` são lazy | idem | — |
| 11.0.3 | Seção **Decisão:** manter fidelidade ao Ruby; exemplos explícitos com parênteses | idem | — |
| 11.0.4 | **Alternativas** (precedência convencional — quebra compatibilidade) + **Consequências** (usuários precisam de parênteses; documentação clara) | idem | — |
| 11.0.5 | Atualizar linha `023` em `decisoes/README.md` | idem | 23 linhas |

---

## Bloco B — Expressões lógicas

### 11.1 — `LogicalOperation`

**⚠️ RUBY: `LogicalOperation.rb` (arquivo inteiro — ~300 linhas)**
**🔎 CHEAT: §3 `case` → `switch`, §12 Categoria B (`Integer#round`)**

**Pré-requisitos:** Fases 2 (`TjTime`), 9 (`TjError`).

#### 11.1.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.1.1.1 | Criar `src/logic/logical-operation.ts` com `class LogicalOperation` | idem | `deno check` |
| 11.1.1.2 | Campos: `readonly operand1: unknown`, `operand2: unknown \| null`, `operator: string \| null` | idem | `deno check` |
| 11.1.1.3 | Constructor `(operand1, operator = null, operand2 = null)` | idem | 4 testes (3 combinações) |

#### 11.1.2 — `eval`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.1.2.1 | ⚠️ `eval(expr: LogicalExpression): unknown` — dispatch por `operator` | idem | 1 teste |
| 11.1.2.2 | Se `operator === null`, retorna `operand1` ou `operand1.eval(expr)` | idem | 3 testes |
| 11.1.2.3 | ⚠️ Se `operator === '~'`, retorna `!coerceBoolean(operand1.eval(expr))` | idem | 3 testes |
| 11.1.2.4 | ⚠️ Se `operator` em `>`, `>=`, `=`, `<`, `<=`, `!=`: chama `evalBinaryOperation(op1, operator, op2, coerce)` | idem | 6 testes (1 por operador) |
| 11.1.2.5 | ⚠️ Se `operator === '&'`, retorna `coerceBoolean(op1) && coerceBoolean(op2)` — **lazy** | idem | 4 testes (curto-circuito) |
| 11.1.2.6 | ⚠️ Se `operator === '\|'`, retorna `coerceBoolean(op1) \|\| coerceBoolean(op2)` — **lazy** | idem | 4 testes |
| 11.1.2.7 | Senão, `expr.error('Unknown operator')` | idem | 1 teste |

#### 11.1.3 — Coerções

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.1.3.1 | ⚠️ `private evalBinaryOperation(op1, operator, op2, coerce): boolean` | idem | 1 teste |
| 11.1.3.2 | Detecção de tipo do `operand1`: `instanceof TjTime` → coerção `TjTime` | idem | 3 testes |
| 11.1.3.3 | `typeof === 'number'` → coerção `number` | idem | 3 testes |
| 11.1.3.4 | `typeof === 'string'` → coerção `string` | idem | 3 testes |
| 11.1.3.5 | Interface `RichTextIntermediate` (Fase 12) → `to_s` + coerção `string` | idem | 1 teste |
| 11.1.3.6 | Senão, `expr.error('First operand must be date, number or string')` | idem | 2 testes |
| 11.1.3.7 | ⚠️ `private coerceBoolean(val, expr): boolean` — `null → false`, `number → !== 0`, `string → length > 0`, `TjTime → true` | idem | 5 testes |
| 11.1.3.8 | ⚠️ `private coerceNumber(val, expr): number` — `null → 0`, `number` passa, `string` tenta `parseFloat`, `TjTime → erro` | idem | 5 testes |
| 11.1.3.9 | ⚠️ `private coerceString(val, expr): string` — `null → ''`, `number → toString`, `string` passa, `TjTime → to_s()` | idem | 4 testes |
| 11.1.3.10 | ⚠️ `private coerceTime(val, expr): TjTime` — `TjTime` passa, `string` tenta `TjTime.fromString`, senão erro | idem | 3 testes |

#### 11.1.4 — `to_s`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.1.4.1 | ⚠️ `to_s(query: Query \| null): string` | idem | 4 testes |
| 11.1.4.2 | ⚠️ `private operandToS(operand, query): string` — se `operand` tem `to_s(query)`, usa; senão, `String(operand)` | idem | 3 testes |
| 11.1.4.3 | Teste agregado: `to_s` de `a > 5` retorna `"a > 5"` | idem | 1 teste |

---

### 11.2 — `LogicalAttribute` + `LogicalFlag`

**⚠️ RUBY: `LogicalOperation.rb` — `LogicalAttribute`, `LogicalFlag`**

**Pré-requisitos:** 11.1, Fase 4 (`Scenario`), Fase 5 (`PropertyTreeNode`).

#### 11.2.1 — `LogicalAttribute`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.2.1.1 | Criar `src/logic/logical-attribute.ts` com `class LogicalAttribute extends LogicalOperation` | idem | `deno check` |
| 11.2.1.2 | Campo `readonly scenario: Scenario` | idem | `deno check` |
| 11.2.1.3 | Constructor `(attributeId: string, scenario: Scenario)` | idem | 3 testes |
| 11.2.1.4 | ⚠️ `eval(expr: LogicalExpression): unknown` — `query = expr.query.dup()` | idem | 2 testes |
| 11.2.1.5 | ⚠️ `query.scenarioIdx = scenario.sequenceNo - 1` (não `scenarioIdx`) | idem | 2 testes |
| 11.2.1.6 | ⚠️ `query.attributeId = this.operand1`; `query.process()` | idem | 2 testes |
| 11.2.1.7 | ⚠️ Se `query.ok`, retorna `query.result ?? ''`; senão, `expr.error(query.errorMessage)` | idem | 4 testes |
| 11.2.1.8 | ⚠️ `to_s(query: Query \| null): string` — formato `plan.effort` (se tem scenario) ou `effort` (sem) | idem | 3 testes |

#### 11.2.2 — `LogicalFlag`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.2.2.1 | Criar `src/logic/logical-flag.ts` com `class LogicalFlag extends LogicalOperation` | idem | `deno check` |
| 11.2.2.2 | Constructor `(opnd: string)` — armazena em `operand1` | idem | 2 testes |
| 11.2.2.3 | ⚠️ `eval(expr: LogicalExpression): boolean` — se `expr.query` é `Query`: `(expr.query.property.get('flags', 0) as string[]).includes(this.operand1)` | idem | 4 testes |
| 11.2.2.4 | ⚠️ Senão (Journal — Fase 16), `expr.query.flags.includes(this.operand1)` — stub `NotYetImplementedError` neste branch | idem | 2 testes |
| 11.2.2.5 | ⚠️ `to_s(query: Query \| null): string` | idem | 2 testes |

#### 11.2.3 — Type guard + re-export

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.2.3.1 | Criar `isQuery(x: unknown): x is Query` em `src/logic/type-guards.ts` | idem | 4 testes |
| 11.2.3.2 | Re-exportar `LogicalAttribute`, `LogicalFlag`, `isQuery` em `packages/core/mod.ts` | idem | `deno check` |

---

### 11.3 — `LogicalFunction` (14 funções)

**⚠️ RUBY: `LogicalFunction.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §3 `send` → dispatch por `name`, §12 Categoria B (comparações de `TjTime`)**

**Pré-requisitos:** 11.1, Fase 5 (`Task`, `Resource`), Fase 7 (`TaskScenario.getEffectiveWork`).

#### 11.3.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.3.1.1 | Criar `src/logic/logical-function.ts` com `class LogicalFunction extends LogicalOperation` | idem | `deno check` |
| 11.3.1.2 | Campos: `name: string`, `arguments: unknown[]`, `invertProperties: boolean` | idem | `deno check` |
| 11.3.1.3 | ⚠️ Mapa `FUNCTIONS: Map<string, number>` com as 14 funções e seus argument counts | idem | 1 teste (contagem === 14) |
| 11.3.1.4 | ⚠️ Constructor `(opnd: string)` — se `opnd.endsWith('_')`, `name = opnd.slice(0, -1)`, `invertProperties = true`; senão, `name = opnd` | idem | 6 testes (3 funções × com/sem `_`) |
| 11.3.1.5 | ⚠️ `setArgumentsAndCheck(args): [string, string] \| null` — valida função conhecida + argument count | idem | 5 testes |
| 11.3.1.6 | `setArgumentsAndCheck` rejeita função desconhecida (`TjError`) | idem | 2 testes |
| 11.3.1.7 | `setArgumentsAndCheck` rejeita número de args errado | idem | 3 testes |

#### 11.3.2 — `eval` (dispatch)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.3.2.1 | ⚠️ `eval(expr): unknown` — dispatch por `name` (14 casos) | idem | 1 teste |
| 11.3.2.2 | ⚠️ `private properties(expr): [PropertyTreeNode, PropertyTreeNode \| null]` — se `invertProperties`, retorna `[scopeProperty, null]`; senão `[property, scopeProperty]` | idem | 4 testes |
| 11.3.2.3 | `to_s(): string` | idem | 2 testes |

#### 11.3.3 — Funções (14)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.3.3.1 | ⚠️ `isleaf(expr, args): boolean` — `property.leaf()` | idem | 3 testes |
| 11.3.3.2 | ⚠️ `istask(expr, args): boolean` — `property instanceof Task` | idem | 3 testes |
| 11.3.3.3 | ⚠️ `isresource(expr, args): boolean` — `property instanceof Resource` | idem | 3 testes |
| 11.3.3.4 | ⚠️ `ismilestone(expr, args): boolean` — `property instanceof Task && property.get('milestone', scIdx)` | idem | 4 testes |
| 11.3.3.5 | ⚠️ `isactive(expr, args): boolean` — `property.getAllocatedTime(scenarioIdx, startIdx, endIdx, scopeProperty) > 0` | idem | 4 testes |
| 11.3.3.6 | ⚠️ `ischildof(expr, args): boolean` — `parent = propertySet[args[0]]; property.isChildOf(parent)` | idem | 4 testes |
| 11.3.3.7 | ⚠️ `isdependencyof(expr, args): boolean` — `property.isDependencyOf(scenarioIdx, task, args[2])` (3 args) | idem | 4 testes |
| 11.3.3.8 | ⚠️ `isdutyof(expr, args): boolean` — `task.get('assignedresources', scIdx).includes(resource)` | idem | 4 testes |
| 11.3.3.9 | ⚠️ `isfeatureof(expr, args): boolean` — `property.isFeatureOf(scenarioIdx, task)` | idem | 3 testes |
| 11.3.3.10 | ⚠️ `isongoing(expr, args): boolean` — `iv1.overlaps(iv2)` | idem | 3 testes |
| 11.3.3.11 | ⚠️ `isresponsibilityof(expr, args): boolean` — `task.get('responsible', scIdx).includes(resource)` | idem | 3 testes |
| 11.3.3.12 | ⚠️ `isvalid(expr, args): boolean` — validação completa (attribute + scenario + validity) | idem | 6 testes |
| 11.3.3.13 | ⚠️ `treelevel(expr, args): number` — `property.level + 1` | idem | 3 testes |
| 11.3.3.14 | ⚠️ `hasalert(expr, args): boolean` — **stub** `NotYetImplementedError` (Fase 16) + comentário `// TODO Fase 16: hasalert real` | idem | 1 teste |

#### 11.3.4 — Re-export

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.3.4.1 | Teste agregado: `isleaf()` sem sufixo vs `isleaf_()` com sufixo — comportamento diferente | idem | 1 teste |
| 11.3.4.2 | Re-exportar `LogicalFunction` em `packages/core/mod.ts` | idem | `deno check` |

---

### 11.4 — `LogicalExpression`

**⚠️ RUBY: `LogicalExpression.rb` (arquivo inteiro — ~70 linhas)**

**Pré-requisitos:** 11.1, Fase 9 (`TjError`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.4.1 | Criar `src/logic/logical-expression.ts` com `class LogicalExpression` | idem | `deno check` |
| 11.4.2 | Campos: `readonly operation: LogicalOperation`, `readonly sourceFileInfo: SourceFileInfo \| null`, `query: Query \| null` | idem | `deno check` |
| 11.4.3 | Constructor `(op, sfi = null)` | idem | 2 testes |
| 11.4.4 | ⚠️ `eval(query: Query): boolean` — `this.query = query` | idem | 2 testes |
| 11.4.5 | `eval` — `res = this.operation.eval(this)` | idem | 1 teste |
| 11.4.6 | ⚠️ Se `res === true \|\| res === false \|\| typeof res === 'string'`, retorna direto | idem | 3 testes |
| 11.4.7 | ⚠️ Senão, retorna `res !== 0` (number) | idem | 3 testes |
| 11.4.8 | ⚠️ `to_s(query: Query \| null): string` — delega para `operation.to_s` | idem | 3 testes |
| 11.4.9 | ⚠️ `error(text: string): never` — lança `TjError` com `to_s(query)` + mensagem | idem | 3 testes |
| 11.4.10 | Teste: `eval(true) === true`; `eval(false) === false` | idem | 2 testes |
| 11.4.11 | Teste: `eval("")` (string vazia) === `false`; `eval("hello")` === `true` | idem | 2 testes |
| 11.4.12 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 11.5 — Testes e2e (expressões complexas)

**Objetivo:** validar comportamento de expressões completas, cobrindo todos os operadores, funções e casos de erro.

**Pré-requisitos:** 11.1–11.4.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.5.1 | Criar `packages/core/tests/logic/expressions-e2e_test.ts` | idem | `deno check` |
| 11.5.2 | ⚠️ **Sem precedência:** `a \| b & c` = `(a \| b) & c` | idem | 1 teste |
| 11.5.3 | ⚠️ **Sem precedência:** `a & b \| c` = `(a & b) \| c` | idem | 1 teste |
| 11.5.4 | ⚠️ **Lazy `&`:** segundo operando não avaliado se primeiro é `false` | idem | 1 teste |
| 11.5.5 | ⚠️ **Lazy `\|`:** segundo operando não avaliado se primeiro é `true` | idem | 1 teste |
| 11.5.6 | Combinação aninhada: `~(a \| b)` | idem | 1 teste |
| 11.5.7 | `a & b & c` (associativo à esquerda) | idem | 1 teste |
| 11.5.8 | `a > 5 & b < 10` (coerção number) | idem | 1 teste |

---

## Bloco C — Query

### 11.6 — `Query` estrutura

**⚠️ RUBY: `Query.rb` (arquivo inteiro — ~330 linhas)**
**🔎 CHEAT: §3 `attr_accessor` → getter/setter, §8 `@start`/`@startIdx` sincronizados**

**Pré-requisitos:** Fase 5 (`Task`, `Resource`, `Account`), Fase 2 (`TjTime`, `RealFormat`).

#### 11.6.1 — Campos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.6.1.1 | Criar `src/query/query.ts` com `class Query` | idem | `deno check` |
| 11.6.1.2 | Campos de projeto/propriedade: `project`, `propertyType`, `propertyId`, `property`, `scopePropertyType`, `scopePropertyId`, `scopeProperty` | idem | `deno check` |
| 11.6.1.3 | Campos de atributo/cenário: `attributeId`, `scenario`, `scenarioIdx` | idem | `deno check` |
| 11.6.1.4 | Campos privados de tempo: `private _start`, `private _end`, `private _startIdx`, `private _endIdx` | idem | `deno check` |
| 11.6.1.5 | Campos de formatação: `loadUnit`, `numberFormat`, `currencyFormat`, `timeFormat` | idem | `deno check` |
| 11.6.1.6 | Campos de lista: `listItem`, `listType` | idem | `deno check` |
| 11.6.1.7 | Campos de journal: `hideJournalEntry`, `journalMode`, `journalAttributes`, `sortJournalEntries` | idem | `deno check` |
| 11.6.1.8 | Campos de contas: `costAccount`, `revenueAccount` | idem | `deno check` |
| 11.6.1.9 | Campos diversos: `selfContained: boolean` | idem | `deno check` |
| 11.6.1.10 | Campos de resultado: `ok: boolean`, `errorMessage: string \| null`, `attr: AttributeBase \| null`, `numerical`, `sortable`, `string`, `rti` | idem | `deno check` |
| 11.6.1.11 | Campo `customData: Map<string, CustomData>` com tipo `CustomData` | idem | `deno check` |

#### 11.6.2 — Getters/setters sincronizados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.6.2.1 | ⚠️ `get start(): TjTime \| null` + `set start(value)` — sincroniza `_startIdx` | idem | 3 testes |
| 11.6.2.2 | ⚠️ `get end(): TjTime \| null` + `set end(value)` — sincroniza `_endIdx` | idem | 3 testes |
| 11.6.2.3 | ⚠️ `get startIdx(): number \| null` + `set startIdx(value)` — sincroniza `_start` | idem | 3 testes |
| 11.6.2.4 | ⚠️ `get endIdx(): number \| null` + `set endIdx(value)` — sincroniza `_end` | idem | 3 testes |
| 11.6.2.5 | Teste: `start.set(...)` propaga para `startIdx` | idem | 1 teste |

#### 11.6.3 — Constructor + dup + reset

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.6.3.1 | ⚠️ Constructor `(params: QueryParams = {})` — aplica params | idem | 4 testes |
| 11.6.3.2 | `QueryParams` interface com todos os campos opcionais | idem | `deno check` |
| 11.6.3.3 | ⚠️ `dup(): Query` — cópia profunda (novos Map, novos objetos) | idem | 5 testes |
| 11.6.3.4 | ⚠️ `private reset(): void` — limpa `ok`, `errorMessage`, `attr`, `numerical`, `sortable`, `string`, `rti` | idem | 3 testes |
| 11.6.3.5 | Teste: `dup` preserva `customData` | idem | 1 teste |

---

### 11.7 — `Query.process`

**⚠️ RUBY: `Query.rb` — método `process`**

**Pré-requisitos:** 11.6, Fases 5–7.

#### 11.7.1 — Pipeline

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.7.1.1 | ⚠️ `process(): boolean` — **sempre** chama `reset()` primeiro | idem | 2 testes |
| 11.7.1.2 | ⚠️ **Passo a:** se `propertyId && (!property \|\| propertyId[0] === '!')`: `property = resolvePropertyId(propertyType, propertyId)` | idem | 4 testes |
| 11.7.1.3 | Se `property === null`, `errorMessage = "Unknown property"`, `ok = false`, `return false` | idem | 3 testes |
| 11.7.1.4 | ⚠️ **Passo b:** se `!property` (atributo de projeto): `supportedAttrs = ['copyright', 'currency', 'end', 'journal', 'name', 'now', 'projectid', 'start', 'version']` | idem | 4 testes |
| 11.7.1.5 | Se `attributeId` não está em `supportedAttrs`, `errorMessage`, `return false` | idem | 2 testes |
| 11.7.1.6 | Se `project[attributeId]` é `TjTime`: `sortable = numerical = attr`; `string = attr.to_s(timeFormat)` | idem | 4 testes |
| 11.7.1.7 | Senão, `sortable = string = attr` | idem | 3 testes |
| 11.7.1.8 | ⚠️ **Passo c:** se `scopePropertyId && !scopeProperty`: `scopeProperty = resolvePropertyId(scopePropertyType, scopePropertyId)` | idem | 3 testes |
| 11.7.1.9 | Se `scopeProperty === null`, `errorMessage`, `return false` | idem | 2 testes |
| 11.7.1.10 | ⚠️ **Passo d:** `project = property.project` (se ainda null) | idem | 1 teste |
| 11.7.1.11 | ⚠️ **Passo e:** se `scenario && !scenarioIdx`: `scenarioIdx = project.scenarioIdx(scenario)` | idem | 2 testes |
| 11.7.1.12 | Se `scenarioIdx === undefined`, `throw Error` | idem | 1 teste |

#### 11.7.2 — Dispatch de atributo

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.7.2.1 | ⚠️ `queryMethodName = 'query_' + attributeId` | idem | 1 teste |
| 11.7.2.2 | ⚠️ **Passo g:** se `customData.has(attributeId)`: aplica `sortable`, `numerical`, `string`, `rti` | idem | 4 testes |
| 11.7.2.3 | ⚠️ **Passo h:** senão se `typeof property[queryMethodName] === 'function'`: chama `property[queryMethodName](this)` | idem | 4 testes |
| 11.7.2.4 | ⚠️ **Passo i:** senão se `scenarioIdx !== undefined && property.data && property.data[scenarioIdx]`: se `typeof property.data[scenarioIdx][queryMethodName] === 'function'`, chama | idem | 4 testes |
| 11.7.2.5 | ⚠️ **Passo j:** senão (fallback): `aType = property.attributeDefinition(attributeId)` | idem | 3 testes |
| 11.7.2.6 | Se `!aType`, `errorMessage = "Unknown attribute"`, `return false` | idem | 2 testes |
| 11.7.2.7 | `scIdx = aType.scenarioSpecific ? scenarioIdx : undefined` | idem | 2 testes |
| 11.7.2.8 | `attr = property.getAttribute(attributeId, scIdx)` | idem | 1 teste |
| 11.7.2.9 | ⚠️ Se `attr instanceof DateAttribute && !attr.get()`, `errorMessage = "undefined value"`, `return false` | idem | 3 testes |

#### 11.7.3 — Erros e retorno

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.7.3.1 | ⚠️ **Catch:** se `TjException`, `errorMessage = e.message`, `ok = false`, `return false` | idem | 3 testes |
| 11.7.3.2 | `return ok = true` no sucesso | idem | 1 teste |
| 11.7.3.3 | Teste agregado: atributo simples (`effort`) via `query_X` custom | idem | 1 teste |
| 11.7.3.4 | Teste agregado: atributo de projeto (`currency`) | idem | 1 teste |

---

### 11.8 — `Query` accessors

**⚠️ RUBY: `Query.rb` — métodos `to_s`, `to_num`, `to_sort`, `to_rti`, `result`**

**Pré-requisitos:** 11.7, Fase 3 (`AttributeBase`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.8.1 | ⚠️ `to_s(): string` — `attr ? attr.to_s(this) : (rti ? rti.to_s() : (string ?? ''))` | idem | 5 testes |
| 11.8.2 | `to_num(): number \| null` — `attr ? attr.to_num() : numerical` | idem | 4 testes |
| 11.8.3 | `to_sort(): unknown` — `attr ? attr.to_sort() : sortable` | idem | 4 testes |
| 11.8.4 | ⚠️ `to_rti(): RichTextIntermediate \| null` — se `attr instanceof RichTextAttribute`, retorna `attr.get()` | idem | 3 testes |
| 11.8.5 | Senão, `attr ? attr.to_rti(this) : rti` | idem | 3 testes |
| 11.8.6 | ⚠️ `result(): unknown` — se `attr`: se `ReferenceAttribute`, retorna `attr.get()[0]`; senão `attr.get()` | idem | 4 testes |
| 11.8.7 | Senão se `numerical !== null`, retorna `numerical` | idem | 2 testes |
| 11.8.8 | Senão se `rti`, retorna `rti` | idem | 1 teste |
| 11.8.9 | Senão, retorna `string` | idem | 1 teste |

---

### 11.9 — `Query` scale + assignList

**⚠️ RUBY: `Query.rb` — `scaleDuration`, `scaleLoad`, `scaleValue`, `assignList`**
**🔎 CHEAT: §6 `Float#round`, §12 Categoria B (float precision)**

**Pré-requisitos:** 11.6.

#### 11.9.1 — `scaleValue` (algoritmo complexo)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.9.1.1 | ⚠️ `scaleValue(value: number, factors: number[]): string` — dispatch por `loadUnit` | idem | 1 teste |
| 11.9.1.2 | ⚠️ Se `loadUnit === 'shortauto' \|\| 'longauto'`: iterar 7 unidades, computar `scaledValue = value * factor` | idem | 3 testes |
| 11.9.1.3 | `str = numberFormat.format(scaledValue)` | idem | 2 testes |
| 11.9.1.4 | `delta = \|scaledValue - parseFloat(str)\|` | idem | 2 testes |
| 11.9.1.5 | ⚠️ Filtrar `str` que começa com `'0' + fractionSeparator` | idem | 3 testes |
| 11.9.1.6 | ⚠️ Escolher o menor `str` não-descartado | idem | 4 testes |
| 11.9.1.7 | Se `longauto`, sufixo `minute(s)`, `hour(s)`, `day(s)`, etc. | idem | 3 testes |
| 11.9.1.8 | Se `shortauto`, sufixo `min`, `h`, `d`, `w`, `m`, `q`, `y` | idem | 3 testes |
| 11.9.1.9 | ⚠️ Senão, unidade fixa: `idx = units.indexOf(loadUnit)`; `numberFormat.format(value * factors[idx])` | idem | 4 testes |

#### 11.9.2 — `scaleDuration` + `scaleLoad`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.9.2.1 | ⚠️ `scaleDuration(value: number): string` — `scaleValue(value, [24*60, 24, 1, 1/7, 1/30.42, 1/91.25, 1/365])` | idem | 4 testes |
| 11.9.2.2 | ⚠️ `scaleLoad(value: number): string` — `scaleValue(value, [dailyWorkingHours*60, dailyWorkingHours, 1, 1/weeklyWorkingDays, 1/monthlyWorkingDays, 1/(yearlyWorkingDays/4), 1/yearlyWorkingDays])` | idem | 4 testes |

#### 11.9.3 — `assignList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.9.3.1 | ⚠️ `assignList(listItems: string[]): void` — itera items | idem | 2 testes |
| 11.9.3.2 | `comma` / `undefined`: `list += ', ' + item` | idem | 2 testes |
| 11.9.3.3 | `bullets`: `list += '* ' + item + '\n'` | idem | 2 testes |
| 11.9.3.4 | `numbered`: `list += '# ' + item + '\n'` | idem | 2 testes |
| 11.9.3.5 | ⚠️ `sortable = string = list`; `rti = null` (Fase 12 pluga) | idem | 2 testes |

---

### 11.10 — `Query` — `resolvePropertyId` + `setCustomData`

**⚠️ RUBY: `Query.rb` — `resolvePropertyId`, `setCustomData`**

**Pré-requisitos:** 11.6.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.10.1 | ⚠️ `resolvePropertyId(pType, pId): PropertyTreeNode \| null` — se `!project`, `throw Error('Need Project reference')` | idem | 2 testes |
| 11.10.2 | ⚠️ Se `pId[0] === '!'`: para cada char, se `c === '!'`, `property = property.parent`; se `!property`, `break` | idem | 4 testes |
| 11.10.3 | Retorna `property` | idem | 1 teste |
| 11.10.4 | ⚠️ Senão, dispatch por `pType`: `Account → project.account(pId)`, `Task → project.task(pId)`, `Resource → project.resource(pId)` | idem | 4 testes |
| 11.10.5 | Senão, `throw Error('Unknown property type')` | idem | 1 teste |
| 11.10.6 | `resolvePropertyId('!')` sem property → `null` | idem | 1 teste |
| 11.10.7 | `resolvePropertyId('!!')` sobe 2 níveis | idem | 1 teste |
| 11.10.8 | `resolvePropertyId('!!!')` além do root → `null` | idem | 1 teste |
| 11.10.9 | ⚠️ `setCustomData(name: string, data: CustomData): void` — `customData.set(name, data)` | idem | 2 testes |
| 11.10.10 | Re-exportar `Query`, `QueryParams`, `CustomData` em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco D — SimpleQueryExpander

### 11.11 — `SimpleQueryExpander`

**⚠️ RUBY: `SimpleQueryExpander.rb` (arquivo inteiro — ~70 linhas)**
**🔎 CHEAT: §5 `String#gsub` → `replaceAll`, regex**

**Pré-requisitos:** 11.6 (`Query`), Fase 9 (`MessageHandlerLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.11.1 | Criar `src/query/simple-query-expander.ts` com `class SimpleQueryExpander` | idem | `deno check` |
| 11.11.2 | Campos: `private inputStr: string`, `private query: Query`, `private sourceFileInfo: SourceFileInfo \| null` | idem | `deno check` |
| 11.11.3 | Constructor `(inputStr, query, sfi)` | idem | 2 testes |
| 11.11.4 | ⚠️ `expand(): string` — `str = inputStr` | idem | 1 teste |
| 11.11.5 | ⚠️ Se `query.scenarioIdx !== undefined`, substitui `<-scenario->` por `query.project.scenario(query.scenarioIdx).id` | idem | 3 testes |
| 11.11.6 | ⚠️ `str.replace(/<-([a-zA-Z][_a-zA-Z]*)->/g, ...)` — regex exata | idem | 4 testes |
| 11.11.7 | ⚠️ `attribute = match.slice(2, -2)` | idem | 1 teste |
| 11.11.8 | ⚠️ `query.attributeId = attribute`; `query.process()` | idem | 2 testes |
| 11.11.9 | ⚠️ Se `query.ok`, retorna `query.to_s()` | idem | 2 testes |
| 11.11.10 | ⚠️ Senão, `error('sqe_expand_failed', 'Unknown attribute ' + attribute, sfi)`, retorna `''` | idem | 3 testes |
| 11.11.11 | Teste: `"Effort: <-effort->"` → `"Effort: 8d"` | idem | 1 teste |
| 11.11.12 | Teste: múltiplos placeholders substituídos | idem | 1 teste |
| 11.11.13 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco E — Integração

### 11.12 — Integração com `TaskScenario` e `ResourceScenario`

**⚠️ Fase 7 implementou os `query_*` methods.** Aqui **validamos a integração** com `Query`.

**Pré-requisitos:** Fases 7, 11.6–11.10.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.12.1 | Criar `packages/core/tests/integration/query-task_test.ts` | idem | `deno check` |
| 11.12.2 | Helper `makeQuery(project, task, attributeId, start, end)` | idem | 1 teste |
| 11.12.3 | ⚠️ `query_effort` — retorna effort formatado | idem | 1 teste |
| 11.12.4 | ⚠️ `query_duration` — retorna duration formatado | idem | 1 teste |
| 11.12.5 | ⚠️ `query_complete` — retorna `%` | idem | 1 teste |
| 11.12.6 | ⚠️ `query_cost` — retorna cost | idem | 1 teste |
| 11.12.7 | ⚠️ `query_revenue` — retorna revenue | idem | 1 teste |
| 11.12.8 | ⚠️ `query_activetasks` — lista de tasks ativas | idem | 1 teste |
| 11.12.9 | ⚠️ `query_competitorcount` — número | idem | 1 teste |
| 11.12.10 | ⚠️ `query_followers` — lista | idem | 1 teste |
| 11.12.11 | ⚠️ `query_precursors` — lista | idem | 1 teste |
| 11.12.12 | Criar `packages/core/tests/integration/query-resource_test.ts` | idem | `deno check` |
| 11.12.13 | ⚠️ `query_effort` (resource) | idem | 1 teste |
| 11.12.14 | ⚠️ `query_annualleave` | idem | 1 teste |
| 11.12.15 | ⚠️ `query_freetime` | idem | 1 teste |
| 11.12.16 | ⚠️ `query_freework` | idem | 1 teste |
| 11.12.17 | ⚠️ `query_fte` | idem | 1 teste |
| 11.12.18 | ⚠️ `query_headcount` | idem | 1 teste |
| 11.12.19 | ⚠️ `query_rate` | idem | 1 teste |
| 11.12.20 | ⚠️ `LogicalAttribute.eval` dispara `query.process` | idem | 1 teste |

---

## Bloco F — Golden tests

### 11.13 — Golden tests (expressões + queries)

**⚠️ RUBY: `TestSuite/` + `mwe001–009/`**

**Pré-requisitos:** Fases 7, 9, 10, 11.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.13.1 | Atualizar `scripts/golden/README.md` com seções de `logical-expressions` e `queries` | idem | existe |
| 11.13.2 | Criar `scripts/golden/logical-expressions.rb` — para cada expressão do `TestSuite/`, cria contexto mínimo (1 task, 1 resource) e avalia via `LogicalExpression.eval` | idem | roda |
| 11.13.3 | Serializa `{ expr, result }` em `logical-expressions.golden.json` | idem | ≥ 20 casos |
| 11.13.4 | Criar `scripts/golden/queries.rb` — roda `tj3` em `mwe001-009` (que têm reports com queries) | idem | roda |
| 11.13.5 | Extrai valores de células do HTML; serializa `{ report, task, attr, value }` em `queries.golden.json` | idem | ≥ 20 casos |
| 11.13.6 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 11.13.7 | Criar `packages/core/tests/golden/logical-expressions_golden_test.ts` | idem | verde |
| 11.13.8 | Criar `packages/core/tests/golden/queries_golden_test.ts` | idem | verde |
| 11.13.9 | Comparação com tolerância `1e-6` para números; normalização de strings | idem | 3 testes |
| 11.13.10 | Cobertura ≥ 40 casos; commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco G — Verificação final

### 11.14 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 11.14.1 | `deno task check-all` verde | exit 0 |
| 11.14.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 11.14.3 | `grep -r "NotYetImplementedError" packages/core/src/logic/` — apenas `hasalert` (Fase 16) | ≤ 1 ocorrência |
| 11.14.4 | ADR 023 criada e commitada | git log |
| 11.14.5 | `LogicalOperation`, `LogicalAttribute`, `LogicalFlag`, `LogicalFunction`, `LogicalExpression`, `Query`, `SimpleQueryExpander` exportados em `packages/core/mod.ts` | `deno check` |
| 11.14.6 | `tests/integration/smoke_after_phase_11_test.ts` — cria `Query` com `attributeId='effort'`, processa; verifica Fase 10 (parser AST equivalence) | 1 teste |
| 11.14.7 | Auditoria: cada subfase do plano `fase-11-logica-queries.md` tem tarefas correspondentes | grep |
| 11.14.8 | Corrigir numeração em `fase-11-logica-queries.md` (`### 15.X` → `### 11.X`, `ADR 022` → `ADR 023`) | grep |

---

## Notas para a IA

1. **Ordem de execução CRÍTICA:** as subfases **11.0–11.4** devem rodar **antes** da Fase 10 (parser precisa das classes `Logical*` para construir expressões).
2. **Ordem dentro da Fase 11:** 11.0 → 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7 → 11.8 → 11.9 → 11.10 → 11.11 → 11.12 → 11.13 → 11.14.
3. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura.
4. **Sem precedência.** `a | b & c` = `(a | b) & c`. **Não** corrigir.
5. **Lazy `&`/`|`.** Usar `&&` e `||` do TS.
6. **Coerção pelo tipo do `operand1`.** Não pelo `operand2`.
7. **Sufixo `_` inverte `property`/`scopeProperty`.**
8. **`Query.process` tenta:** customData → property.query_X → data[scIdx].query_X → attribute base.
9. **`start`/`end` sincronizados com `startIdx`/`endIdx`.** Setters obrigatórios.
10. **`resolvePropertyId` com `!` sobe um nível por caractere.**
11. **`scaleValue` com `shortauto`/`longauto` complexo.** Copiar literalmente.
12. **`assignList` sem `RichText`** nesta fase. Retorna string; Fase 12 pluga `RichTextFactory`.
13. **`hasalert` é stub.** Fase 16.
14. **`LogicalFlag` para Journal é Fase 16.** Só `Query` nesta fase.
15. **`SimpleQueryExpander` regex:** `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(core): logical-operation`, `feat(core): query`, etc.
18. **ADR 023** (não 022). **ADR 022** é i18n (Fase 10).
19. **`Query.process` é o método mais complexo desta fase.** Seguir o pipeline exato.
20. **`RichTextIntermediate`** já existe (Fase 12 faz o real; aqui é interface `RichTextPort` da Fase 3).

---

## Notas específicas por subfase

### 11.0 — ADR 023

- **Documenta a ausência de precedência.** Exemplos explícitos.

### 11.1 — LogicalOperation

- **Nó genérico.** 3 campos: `operand1`, `operator`, `operand2`.
- **`eval` dispatch por `operator`.**
- **`&` e `|` são lazy.**
- **Coerção por tipo do `operand1`.**

### 11.2 — LogicalAttribute + LogicalFlag

- **`LogicalAttribute`** usa `scenario.sequenceNo - 1` (não `scenarioIdx` direto).
- **`LogicalFlag`** distingue `Query` de `JournalEntry` (Fase 16).

### 11.3 — LogicalFunction

- **14 funções.** Cada uma tem argument count fixo.
- **Sufixo `_`** inverte `property`/`scopeProperty`.
- **`hasalert` é stub** (Fase 16).

### 11.4 — LogicalExpression

- **Wrapper da árvore.** `eval(query)`.
- **Normaliza `res`:** booleano, string ou number (`!== 0`).

### 11.5 — Testes e2e

- **Sem precedência.**
- **Lazy com efeitos colaterais.**

### 11.6 — Query estrutura

- **~25 campos.**
- **`start`/`end` sincronizados com `startIdx`/`endIdx`.**

### 11.7 — Query.process

- **Pipeline exato.** 5 passos (a–j).
- **Tenta property → scenarioData → attribute base.**
- **`customData` tem prioridade.**

### 11.8 — Query accessors

- **5 métodos:** `to_s`, `to_num`, `to_sort`, `to_rti`, `result`.
- **`result`** distingue `ReferenceAttribute`.

### 11.9 — Query scale + assignList

- **`scaleValue` é o mais complexo.** Copiar literalmente.
- **`assignList` sem `RichText`** nesta fase.

### 11.10 — Query resolve

- **`!`** sobe um nível por caractere.
- **Dispatch por tipo de property.**

### 11.11 — SimpleQueryExpander

- **Regex exata.**
- **Substitui `<-name->`** por `query.to_s()`.

### 11.12 — Integração

- **Validar `query_*` de `TaskScenario` e `ResourceScenario`.**
- **`LogicalAttribute.eval` dispara `query.process`.**

### 11.13 — Golden tests

- **Expressões do `TestSuite/`.**
- **Queries dos MWEs.**

### 11.14 — Verificação

- **Sem stubs além de `hasalert`.**
- **ADR 023 (não 022).**

---

**Fim do arquivo de tarefas da Fase 11.**