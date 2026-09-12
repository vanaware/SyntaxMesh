# Fase 11 — Expressões Lógicas e Queries

> **Arquivo:** `docs/syntaxmesh/fases/fase-11-logica-queries.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 8–10 dias
> **Depende de:** Fases 2–9
> **Bloqueia:** Fases 10 (parser usa `Logical*`), 14, 16, 21

---

## ⚠️ Nota de ordem de execução

O parser (Fase 10) **constrói** objetos `LogicalExpression`, `LogicalOperation`, `LogicalAttribute`, `LogicalFlag`, `LogicalFunction` ao parsear `.tjp` (via `rule_logicalExpression` etc.). O parser **não avalia** essas expressões — apenas cria a árvore.

**Consequência:** as classes `Logical*` devem existir **antes** ou **em paralelo** com a Fase 10. Recomendação:

- **Opção A (recomendada):** executar Fase 11 **antes** da Fase 10 (só os blocos A, C e D; deixar golden tests de reports para depois).
- **Opção B:** executar Fase 11 em paralelo, com `Logical*` implementados primeiro e o parser consumindo.
- **Opção C:** implementar apenas as classes de construção em Fase 10 (stubs), completar `eval` em Fase 11.

Este documento assume a **Opção A** como ordem ideal.

---

## 1. Contexto

O TaskJuggler tem um **sistema de expressões lógicas** e um **sistema de queries** que trabalham juntos:

1. **`LogicalExpression`** — uma árvore de `LogicalOperation` com uma `Query` de contexto. Avaliada em `eval(query)`.

2. **`LogicalOperation`** — o nó da árvore. Tem `operand1`, `operand2` (opcional), `operator` (opcional). Operadores: `~` (NOT), `>`, `>=`, `=`, `<`, `<=`, `!=`, `&`, `|`.

3. **`LogicalAttribute`** — operando que lê um atributo de uma propriedade. Ex: `plan.effort`.

4. **`LogicalFlag`** — operando que verifica se uma flag está presente.

5. **`LogicalFunction`** — operando que chama uma função (14 no total: `isleaf`, `isactive`, `hasalert`, etc.).

6. **`Query`** — o **contexto de avaliação**. Contém:
   - `project`, `property`, `scopeProperty`
   - `scenarioIdx`
   - `start`, `end` (período)
   - `attributeId` (o que está sendo lido)
   - Formatos (`numberFormat`, `currencyFormat`, `timeFormat`)
   - `loadUnit` (`days`, `hours`, `shortauto`, `longauto`)
   - `listItem`, `listType`
   - `journalMode`, `journalAttributes`, `hideJournalEntry`
   - `costAccount`, `revenueAccount`
   - `selfContained`

7. **`SimpleQueryExpander`** — substitui `<-name->` em strings por valores de atributo. Usado em títulos de colunas, legendas, etc.

### Pipeline

```
LogicalExpression (árvore)
    ↓ eval(query)
Query (contexto)
    ↓ Query.process()
query_<attributeId>() na propriedade ou ScenarioData
    ↓
valor → to_s / to_num / to_sort / to_rti
```

### Diferenças do parser

O parser (Fase 10) **cria** as expressões. Ex: `rule_logicalExpression` cria `new LogicalExpression(new LogicalOperation(...), sfi)`. O parser não avalia.

Esta fase **implementa a avaliação** e a **query**.

---

## 2. Objetivo

Ao final desta fase:

- `LogicalExpression`, `LogicalOperation`, `LogicalAttribute`, `LogicalFlag`, `LogicalFunction` implementados.
- 14 funções lógicas: `hasalert`, `isactive`, `ischildof`, `isdependencyof`, `isdutyof`, `isfeatureof`, `isleaf`, `ismilestone`, `isongoing`, `isresource`, `isresponsibilityof`, `istask`, `isvalid`, `treelevel`.
- `Query` completo (`process`, `to_s`, `to_num`, `to_sort`, `to_rti`, `result`, `scaleDuration`, `scaleLoad`, `assignList`, `setCustomData`, `resolvePropertyId`, `reset`).
- `SimpleQueryExpander` completo.
- **≥ 180 testes unitários** + **≥ 40 golden tests** (expressões dos MWEs + queries em reports).
- ADR 022 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `LogicalExpression.rb` | ~70 | Baixa | **Crítica** |
| `LogicalOperation.rb` | ~300 | **Alta** | **Crítica** |
| `LogicalFunction.rb` | ~250 | Média | **Crítica** |
| `Query.rb` | ~330 | **Alta** | **Crítica** |
| `SimpleQueryExpander.rb` | ~70 | Baixa | **Crítica** |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/03-bluprint-engine2.md` | §5 Sistema de Expressões Lógicas | Estrutura |
| `docs/tj3-engine/03-bluprint-engine2.md` | §5.2 LogicalExpression | Classe |
| `docs/tj3-engine/03-bluprint-engine2.md` | §5.3 LogicalOperation | Classe |
| `docs/tj3-engine/03-bluprint-engine2.md` | §5.4 LogicalAttribute | Classe |
| `docs/tj3-engine/03-bluprint-engine2.md` | §5.5 LogicalFlag | Classe |
| `docs/tj3-engine/03-bluprint-engine2.md` | §5.6 Funções | 14 funções |
| `docs/tj3-engine/14-blueprint-others.md` | §5 Query (detalhado) | Query completa |

### 3.3 Casos de teste Ruby

- `docs/Learning/mwe003/tutorial.tjp` — uso de `depends !sibling`.
- `docs/Learning/mwe005/tutorial.tjp` — uso de `priority`, `workinghours`.
- `docs/taskjuggler/test/TestSuite/` — casos de expressões.

### 3.4 Golden tests

Script Ruby `logical-expressions.rb` que avalia expressões em queries fabricadas e serializa o resultado.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Sem precedência de operadores

O TaskJuggler **não tem precedência**. Tudo é avaliado **left-to-right**.

Ex:
- `a | b & c` = `(a | b) & c`
- `a & b | c` = `(a & b) | c`

Isso é **diferente** da maioria das linguagens. Documentar em ADR 022.

### 4.2 `&` e `|` são **lazy**

Ruby usa `&&` e `||` (short-circuit). TS: `&&` e `||`.

```ts
case '&': return coerceBoolean(op1.eval()) && coerceBoolean(op2.eval());
```

Em Ruby: `@operand1.eval(expr) && @operand2.eval(expr)`. TS replica.

**Nota:** a avaliação do segundo operando só ocorre se o primeiro não determinou o resultado.

### 4.3 Coerção por tipo do **primeiro** operando

A coerção é determinada pelo **tipo do `operand1`**:

- `TjTime` → coerção para `TjTime`.
- `number` → coerção para `number`.
- `RichTextIntermediate` → coerção para `string` (via `to_s`).
- `string` → coerção para `string`.

O `operand2` é coagido para o mesmo tipo.

### 4.4 `RichTextIntermediate` como operand

Ruby: `if opnd1.is_a?(RichTextIntermediate)` → `opnd1.to_s`. TS: mesma checagem por interface `RichTextIntermediate` (Fase 12). **Nesta fase**, se `RichTextIntermediate` não existe, apenas strings são aceitas.

### 4.5 `LogicalFunction` com sufixo `_`

Funções cujo nome termina em `_` **invertem** `property` e `scopeProperty`:

```ruby
if opnd[-1] == ?_
  @name = opnd[0..-2]
  @invertProperties = true
```

Ex: `isleaf_()` avalia `isleaf()` sobre `scopeProperty` em vez de `property`.

### 4.6 Funções usam `properties(expr)`

Ruby:
```ruby
def properties(expr)
  if @invertProperties
    return expr.query.scopeProperty, nil
  else
    return expr.query.property, expr.query.scopeProperty
  end
end
```

TS: retornar tupla `[PropertyTreeNode, PropertyTreeNode | null]`.

### 4.7 `LogicalAttribute.eval` usa `Query`

```ruby
def eval(expr)
  query = expr.query.dup
  query.scenarioIdx = @scenario.sequenceNo - 1
  query.attributeId = @operand1
  query.process
  if query.ok
    query.result || ''
  else
    expr.error(query.errorMessage)
  end
end
```

TS: idem. `query.result` retorna valor bruto. `|| ''` converte null em string vazia.

### 4.8 `LogicalFlag.eval` distingue Query de Journal

```ruby
def eval(expr)
  if expr.query.is_a?(Query)
    expr.query.property['flags', 0].include?(@operand1)
  else
    expr.query.flags.include?(@operand1)
  end
end
```

TS: `instanceof Query` — mas `Query` está na mesma fase. Alternativa: usar um **type guard** (`isQuery(x)`).

**Journal** é Fase 16. Nesta fase, apenas o caso `Query`.

### 4.9 `Query.process` — pipeline de dispatch

Ordem exata:
1. `reset()`.
2. Resolver `propertyId` se necessário (via `resolvePropertyId`).
3. Se **sem property**, resolver como atributo de projeto (`currency`, `end`, `journal`, `name`, `now`, `projectid`, `start`, `version`, `copyright`).
4. Resolver `scopeProperty` se necessário.
5. Resolver `scenarioIdx` se `scenario` presente.
6. Tentar `customData[attributeId]` (retorno direto).
7. Tentar `property.query_<attributeId>(query)` — método não-scenario-specific.
8. Tentar `scenarioData.query_<attributeId>(query)` — método scenario-specific.
9. Fallback: `property.getAttribute(attributeId, scenarioIdx)`.
10. Se `DateAttribute` e valor null → erro.

**Crítico:** a ordem 7 vs 8 é importante. O Ruby tenta o `property` primeiro, depois o `data[scenarioIdx]`.

### 4.10 `Query.@start` / `@end` ↔ `@startIdx` / `@endIdx`

Ruby sincroniza automaticamente:
```ruby
def start=(date)
  @start = date
  @startIdx = @project.dateToIdx(@start)
end
```

TS: usar **setters** ou **funções privadas** `setStart`, `setEnd`, `setStartIdx`, `setEndIdx`. Não permitir dessincronização.

**Decisão:** usar getters/setters com validação:

```ts
get start(): TjTime { return this._start; }
set start(value: TjTime) { this._start = value; this._startIdx = this.project.dateToIdx(value); }
```

### 4.11 `Query.resolvePropertyId` — `!` move para pai

```ruby
if pId[0] == '!'
  pId.each_utf8_char do |c|
    if c == '!'
      @property = @property.parent
    end
    break unless @property
  end
  @property
```

TS: iterar caracteres de `pId`; cada `!` sobe um nível.

### 4.12 `Query.scaleValue` — `shortauto`/`longauto`

Algoritmo complexo. Escolhe a unidade que produz string mais curta **sem perder precisão**. Ver código Ruby.

### 4.13 `Query.assignList` — listType

Converte array de strings em lista formatada:
- `undefined` / `comma`: separado por `, `.
- `bullets`: `* item\n`.
- `numbered`: `# item\n`.

Cria `RichTextIntermediate` a partir do resultado.

### 4.14 `Query` precisa de `RichText` para `assignList`

Ruby cria `RichText.new(list).generateIntermediateFormat`. **Fase 12** implementa `RichText`.

**Decisão:** nesta fase, `assignList` retorna string direta (sem RichTextIntermediate). Interface `RichTextFactory` da Fase 3 permite plugar depois.

### 4.15 `SimpleQueryExpander` — regex

```ruby
str.gsub!(/<-[a-zA-Z][_a-zA-Z]*->/) do |match|
  attribute = match[2..-3]
  @query.attributeId = attribute
  @query.process
  ...
end
```

Também substitui `<-scenario->` antes.

### 4.16 Erros

- `LogicalExpression.error(text)` lança `TjException`.
- `Query.process` **não lança**; seta `ok = false` e `errorMessage`.

### 4.17 `Query.to_sort` — tipo de retorno

`unknown` — pode ser número, string, TjTime. Usado por `PropertyList` para ordenar.

### 4.18 Funções lógicas: `hasalert` usa `Journal`

Fase 16 implementa `Journal`. Nesta fase, `hasalert` retorna `false` com warning (ou lança `NotYetImplementedError`).

**Decisão:** `hasalert` retorna `false` com warning nesta fase; Fase 16 substitui.

### 4.19 `isvalid` — validações

Implementação completa com validações de atributo + cenário.

### 4.20 `treelevel` — retorna `level + 1`

Simples.

---

## 5. Subfases detalhadas

**Bloco A — Expressões lógicas** (15.0–15.5)
**Bloco B — Query** (15.6–15.10)
**Bloco C — SimpleQueryExpander** (15.11)
**Bloco D — Integração** (15.12)
**Bloco E — Golden tests** (15.13)

---

### Bloco A — Expressões lógicas

---

### 11.0 — ADR 022 (expressões lógicas sem precedência)

#### Contexto

O TaskJuggler avalia expressões lógicas **left-to-right**, sem precedência de operadores. Isso é incomum e precisa ser documentado.

`a | b & c` = `(a | b) & c`, não `a | (b & c)`.

Também: `&` e `|` são **lazy** (short-circuit).

#### Objetivo

Criar `docs/syntaxmesh/decisoes/022-expressoes-logicas.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/022-expressoes-logicas.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** sem precedência; lazy AND/OR.
- [ ] **Decisão:** manter fidelidade ao Ruby.
- [ ] **Consequências:** usuários precisam de parênteses; documentação clara.
- [ ] **Alternativas:** precedência convencional (quebraria compatibilidade).
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb` — `eval`.
- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — `rule_operation`.

#### Critério de aceite

- ADR 022 criado.
- Tabela atualizada.

---

### 11.1 — `LogicalOperation`

#### Contexto

Nó da árvore de expressão. Tem 3 campos: `operand1`, `operand2` (opcional), `operator` (opcional).

#### Objetivo

Implementar `LogicalOperation`.

#### Arquivos

- `packages/core/src/logic/logical-operation.ts`
- `packages/core/tests/logic/logical-operation_test.ts`

#### Requisitos

- [ ] `class LogicalOperation`:
  - `readonly operand1: unknown`
  - `operand2: unknown | null`
  - `operator: string | null`
- [ ] Constructor `(operand1, operator = null, operand2 = null)`.
- [ ] `eval(expr: LogicalExpression): unknown`:
  - `null` operator: `operand1.eval ? operand1.eval(expr) : operand1`.
  - `~`: `!coerceBoolean(operand1.eval(expr))`.
  - `>`, `>=`, `=`, `<`, `<=`, `!=`: `evalBinaryOperation`.
  - `&`: `coerceBoolean(op1) && coerceBoolean(op2)` (lazy).
  - `|`: `coerceBoolean(op1) || coerceBoolean(op2)` (lazy).
  - Senão, `expr.error('Unknown operator')`.
- [ ] `to_s(query: Query | null): string`.
- [ ] Private `evalBinaryOperation(op1, operator, op2, coerce): boolean`.
- [ ] Private `coerceBoolean(val, expr): boolean`.
- [ ] Private `coerceNumber(val, expr): number`.
- [ ] Private `coerceString(val, expr): string`.
- [ ] Private `coerceTime(val, expr): TjTime`.
- [ ] Private `operandToS(operand, query): string`.

**Detecção de tipo do `operand1`:**

- `instanceof TjTime` → coerção para TjTime.
- `typeof === 'number'` → coerção para number.
- `typeof === 'string'` → coerção para string.
- Interface `RichTextIntermediate` (Fase 12) → `to_s` e coerção para string.
- Senão, `expr.error('First operand must be date, number or string')`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb` — arquivo completo.
- `docs/tj3-engine/03-bluprint-engine2.md` — §5.3.

#### Critério de aceite

```ts
const op = new LogicalOperation(true, '&', new LogicalOperation(false));
assertEquals(op.eval(expr), false);

const op2 = new LogicalOperation(5, '>', new LogicalOperation(3));
assertEquals(op2.eval(expr), true);
```

#### Testes

- `logical-operation_test.ts`:
  - `describe("LogicalOperation")`
    - `it("operand único")`.
    - `it("~")`.
    - `it("> number")`.
    - `it(">= number")`.
    - `it("= number")`.
    - `it("< number")`.
    - `it("<= number")`.
    - `it("!= number")`.
    - `it("& lazy")`.
    - `it("| lazy")`.
    - `it("> TjTime")`.
    - `it("= string")`.
    - `it("rejeita operador desconhecido")`.
    - `it("coerceBoolean")`.
    - `it("coerceNumber")`.
    - `it("coerceString")`.
    - `it("coerceTime")`.

---

### 11.2 — `LogicalAttribute` + `LogicalFlag`

#### Contexto

`LogicalAttribute` lê um atributo via `Query`. `LogicalFlag` verifica flag.

#### Objetivo

Implementar ambas.

#### Arquivos

- `packages/core/src/logic/logical-attribute.ts`
- `packages/core/src/logic/logical-flag.ts`
- `packages/core/tests/logic/logical-attribute_test.ts`
- `packages/core/tests/logic/logical-flag_test.ts`

#### Requisitos

**`LogicalAttribute`:**

- [ ] `class LogicalAttribute extends LogicalOperation`:
  - `readonly scenario: Scenario`
- [ ] Constructor `(attributeId: string, scenario: Scenario)`.
- [ ] `eval(expr: LogicalExpression): unknown`:
  - `query = expr.query.dup()`.
  - `query.scenarioIdx = scenario.sequenceNo - 1`.
  - `query.attributeId = this.operand1`.
  - `query.process()`.
  - Se `query.ok`, retorna `query.result ?? ''`.
  - Senão, `expr.error(query.errorMessage)`.
- [ ] `to_s(query: Query | null): string`.

**`LogicalFlag`:**

- [ ] `class LogicalFlag extends LogicalOperation`.
- [ ] Constructor `(opnd: string)`.
- [ ] `eval(expr: LogicalExpression): boolean`:
  - Se `expr.query` é `Query`: `expr.query.property.get('flags', 0).includes(this.operand1)`.
  - Senão (Journal — Fase 16): `expr.query.flags.includes(this.operand1)`.
- [ ] `to_s(query: Query | null): string`.

**Type guard:** `isQuery(x): x is Query` — implementar.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb` — `LogicalAttribute`, `LogicalFlag`.
- `docs/tj3-engine/03-bluprint-engine2.md` — §5.4, §5.5.

#### Critério de aceite

```ts
const scenario = new Scenario(project, 'plan', 'Plan', null);
const attr = new LogicalAttribute('effort', scenario);
assertEquals(attr.eval(expr), 8);
```

#### Testes

- `logical-attribute_test.ts`:
  - `it("eval de atributo simples")`.
  - `it("eval usa scenarioIdx do LogicalAttribute")`.
  - `it("erro se atributo inválido")`.
  - `it("to_s com query")`, `it("to_s sem query")`.
- `logical-flag_test.ts`:
  - `it("flag presente")`.
  - `it("flag ausente")`.
  - `it("isQuery type guard")`.

---

### 11.3 — `LogicalFunction` (14 funções)

#### Contexto

Funções lógicas: `hasalert`, `isactive`, `ischildof`, etc. Cada uma tem N argumentos fixos.

#### Objetivo

Implementar `LogicalFunction` + 14 funções.

#### Arquivos

- `packages/core/src/logic/logical-function.ts`
- `packages/core/tests/logic/logical-function_test.ts`

#### Requisitos

- [ ] `class LogicalFunction`:
  - `name: string`
  - `arguments: unknown[]`
  - `invertProperties: boolean`
- [ ] Mapa `functions: Map<string, number>`:
  ```
  hasalert: 1, isactive: 1, ischildof: 1, isdependencyof: 3,
  isdutyof: 2, isfeatureof: 2, isleaf: 0, ismilestone: 1,
  isongoing: 1, isresource: 0, isresponsibilityof: 2, istask: 0,
  isvalid: 1, treelevel: 0
  ```
- [ ] Constructor `(opnd: string)`:
  - Se `opnd.endsWith('_')`, `name = opnd.slice(0, -1)`, `invertProperties = true`.
  - Senão, `name = opnd`, `invertProperties = false`.
- [ ] `setArgumentsAndCheck(args): [string, string] | null`.
- [ ] `eval(expr): unknown` — dispatch por `name`.
- [ ] `to_s(): string`.
- [ ] Private `properties(expr): [PropertyTreeNode, PropertyTreeNode | null]`.

**Implementação das 14 funções:**

- [ ] `hasalert(expr, args)` — retorna `false` (stub Fase 16).
- [ ] `isactive(expr, args)` — `property.getAllocatedTime(scenarioIdx, startIdx, endIdx, scopeProperty) > 0`.
- [ ] `ischildof(expr, args)` — `parent = propertySet[args[0]]; property.isChildOf(parent)`.
- [ ] `isdependencyof(expr, args)` — `property.isDependencyOf(scenarioIdx, task, args[2])`.
- [ ] `isdutyof(expr, args)` — `task.get('assignedresources', scIdx).includes(resource)`.
- [ ] `isfeatureof(expr, args)` — `property.isFeatureOf(scenarioIdx, task)`.
- [ ] `isleaf(expr, args)` — `property.leaf()`.
- [ ] `ismilestone(expr, args)` — `property instanceof Task && property.get('milestone', scIdx)`.
- [ ] `isongoing(expr, args)` — `iv1.overlaps(iv2)`.
- [ ] `isresource(expr, args)` — `property instanceof Resource`.
- [ ] `isresponsibilityof(expr, args)` — `task.get('responsible', scIdx).includes(resource)`.
- [ ] `istask(expr, args)` — `property instanceof Task`.
- [ ] `isvalid(expr, args)` — validação completa.
- [ ] `treelevel(expr, args)` — `property.level + 1`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb` — arquivo completo.
- `docs/tj3-engine/03-bluprint-engine2.md` — §5.6.

#### Critério de aceite

```ts
const fn = new LogicalFunction('isleaf');
fn.setArgumentsAndCheck([]);
assertEquals(fn.eval(expr), true);
```

#### Testes

- `logical-function_test.ts`:
  - `it("setArgumentsAndCheck valida função desconhecida")`.
  - `it("setArgumentsAndCheck valida número de args")`.
  - `it("sufixo _ inverte properties")`.
  - `it("isleaf")`.
  - `it("istask")`.
  - `it("isresource")`.
  - `it("ismilestone")`.
  - `it("isactive")`.
  - `it("ischildof")`.
  - `it("isdependencyof")`.
  - `it("isdutyof")`.
  - `it("isfeatureof")`.
  - `it("isongoing")`.
  - `it("isresponsibilityof")`.
  - `it("isvalid com atributo válido")`.
  - `it("isvalid com atributo nil")`.
  - `it("treelevel")`.
  - `it("hasalert retorna false (stub)")`.

---

### 11.4 — `LogicalExpression`

#### Contexto

Wrapper da árvore de operações. Expõe `eval(query)`.

#### Objetivo

Implementar `LogicalExpression`.

#### Arquivos

- `packages/core/src/logic/logical-expression.ts`
- `packages/core/tests/logic/logical-expression_test.ts`

#### Requisitos

- [ ] `class LogicalExpression`:
  - `readonly operation: LogicalOperation`
  - `readonly sourceFileInfo: SourceFileInfo | null`
  - `query: Query | null`
- [ ] Constructor `(op, sfi = null)`.
- [ ] `eval(query: Query): boolean`:
  - `this.query = query`.
  - `res = this.operation.eval(this)`.
  - Se `res === true || res === false || typeof res === 'string'`, retorna.
  - Senão, `res !== 0`.
- [ ] `to_s(query: Query | null): string`.
- [ ] `error(text: string): never` — lança `TjException` com `to_s` + mensagem.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb`.

#### Critério de aceite

```ts
const expr = new LogicalExpression(new LogicalOperation(true, '&', new LogicalOperation(false)));
assertEquals(expr.eval(query), false);
```

#### Testes

- `logical-expression_test.ts`:
  - `it("eval true")`.
  - `it("eval false")`.
  - `it("eval string não-vazia = true")`.
  - `it("eval string vazia = false")`.
  - `it("eval number != 0 = true")`.
  - `it("eval number 0 = false")`.
  - `it("error lança TjException")`.
  - `it("to_s com e sem query")`.

---

### 11.5 — Testes de expressões complexas

#### Contexto

Testes end-to-end de expressões, cobrindo todos os operadores, funções e casos de erro.

#### Objetivo

Validar comportamento de expressões completas.

#### Arquivos

- `packages/core/tests/logic/expressions-e2e_test.ts`

#### Requisitos

- [ ] Sem precedência: `a | b & c` = `(a | b) & c`.
- [ ] Lazy: segundo operando não avaliado se primeiro determina.
- [ ] Coerção por tipo do primeiro operando.
- [ ] Combinações: `~(a | b)`, `a & b & c`, `a | b | c`, `a > 5 & b < 10`.
- [ ] `@all` e `@none`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — `rule_logicalExpression`.

#### Critério de aceite

Análogo.

#### Testes

- `expressions-e2e_test.ts`:
  - `it("a | b & c = (a | b) & c")`.
  - `it("lazy & não avalia segundo")`.
  - `it("lazy | não avalia segundo")`.
  - `it("coerção number")`.
  - `it("coerção TjTime")`.
  - `it("combinação aninhada")`.
  - `it("~ nega")`.
  - `it("string vazia = false")`.

---

### Bloco B — Query

---

### 11.6 — `Query` — estrutura

#### Contexto

`Query` é o contexto de avaliação. Tem ~25 campos + 6 índices.

#### Objetivo

Implementar a estrutura de `Query`.

#### Arquivos

- `packages/core/src/query/query.ts`
- `packages/core/tests/query/query-structure_test.ts`

#### Requisitos

- [ ] `class Query`:
  - **Propriedades alvo:**
    - `project: Project | null`
    - `propertyType: 'Task' | 'Resource' | 'Account' | null`
    - `propertyId: string | null`
    - `property: PropertyTreeNode | null`
    - `scopePropertyType: 'Task' | 'Resource' | 'Account' | null`
    - `scopePropertyId: string | null`
    - `scopeProperty: PropertyTreeNode | null`
    - `attributeId: string | null`
    - `scenario: Scenario | null`
    - `scenarioIdx: number | null`
  - **Tempo:**
    - `private _start: TjTime | null`
    - `private _end: TjTime | null`
    - `private _startIdx: number | null`
    - `private _endIdx: number | null`
  - **Formatação:**
    - `loadUnit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'quarters' | 'years' | 'shortauto' | 'longauto' | null`
    - `numberFormat: RealFormat | null`
    - `currencyFormat: RealFormat | null`
    - `timeFormat: string | null`
  - **Listas:**
    - `listItem: string | null`
    - `listType: 'comma' | 'bullets' | 'numbered' | null`
  - **Journal:**
    - `hideJournalEntry: LogicalExpression | null`
    - `journalMode: 'journal' | 'journal_sub' | 'status_dep' | 'status_down' | 'status_up' | 'alerts_dep' | 'alerts_down' | null`
    - `journalAttributes: string[] | null`
    - `sortJournalEntries: Array<[string, number]> | null`
  - **Contas:**
    - `costAccount: Account | null`
    - `revenueAccount: Account | null`
  - **Outros:**
    - `selfContained: boolean`
  - **Resultados:**
    - `ok: boolean`
    - `errorMessage: string | null`
    - `attr: AttributeBase | null`
    - `numerical: number | null`
    - `sortable: unknown`
    - `string: string | null`
    - `rti: RichTextIntermediate | null`
  - **customData:** `Map<string, CustomData>`.
- [ ] Constructor `(params: QueryParams = {})`.
- [ ] Getters/setters `start`, `end`, `startIdx`, `endIdx` (sincronizados).
- [ ] `dup(): Query`.
- [ ] Private `reset(): void`.

**`CustomData`:**

```ts
interface CustomData {
  sortable?: unknown;
  numerical?: number;
  string?: string;
  rti?: RichTextIntermediate;
}
```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Query.rb` — arquivo completo.
- `docs/tj3-engine/14-blueprint-others.md` — §5.

#### Critério de aceite

```ts
const q = new Query({
  project: p,
  property: t,
  attributeId: 'effort',
  start: TjTime.fromString("2026-01-01"),
  end: TjTime.fromString("2026-12-31"),
});
assertEquals(q.startIdx, p.dateToIdx(q.start));
```

#### Testes

- `query-structure_test.ts`:
  - `it("constructor com params")`.
  - `it("start sincroniza startIdx")`.
  - `it("end sincroniza endIdx")`.
  - `it("startIdx sincroniza start")`.
  - `it("dup copia tudo")`.
  - `it("customData")`.

---

### 11.7 — `Query.process`

#### Contexto

O método mais complexo da fase. Resolve a propriedade, o cenário, o atributo, e popula o resultado.

#### Objetivo

Implementar `Query.process` com o pipeline exato.

#### Arquivos

- `packages/core/src/query/query.ts` (estender)
- `packages/core/tests/query/query-process_test.ts`

#### Requisitos

- [ ] `process(): boolean`:
  - **1. `reset()`**.
  - **2. `try`**:
    - **a.** Se `propertyId && (!property || propertyId[0] === '!')`:
      - `property = resolvePropertyId(propertyType, propertyId)`.
      - Se null → `errorMessage = "Unknown property"`, `return ok = false`.
    - **b.** Se `!property` (atributo de projeto):
      - `supportedAttrs = ['copyright', 'currency', 'end', 'journal', 'name', 'now', 'projectid', 'start', 'version']`.
      - Se `attributeId` não está na lista → `errorMessage`, `return false`.
      - Se `project[attributeId]` é `TjTime`:
        - `sortable = numerical = attr`.
        - `string = attr.to_s(timeFormat)`.
      - Senão, `sortable = string = attr`.
      - `return ok = true`.
    - **c.** Se `scopePropertyId && !scopeProperty`:
      - `scopeProperty = resolvePropertyId(scopePropertyType, scopePropertyId)`.
      - Se null → `errorMessage`, `return false`.
    - **d.** `project = property.project` (se ainda null).
    - **e.** Se `scenario && !scenarioIdx`:
      - `scenarioIdx = project.scenarioIdx(scenario)`.
      - Se undefined → `throw Error`.
    - **f.** `queryMethodName = 'query_' + attributeId`.
    - **g.** Se `customData.has(attributeId)`:
      - `data = customData.get(attributeId)`.
      - `sortable = data.sortable`, `numerical = data.numerical`, `string = data.string`, `rti = data.rti`.
    - **h.** Senão se `typeof property[queryMethodName] === 'function'`:
      - `property[queryMethodName](this)`.
    - **i.** Senão se `scenarioIdx !== undefined && property.data && property.data[scenarioIdx]`:
      - `if (typeof property.data[scenarioIdx][queryMethodName] === 'function') property.data[scenarioIdx][queryMethodName](this)`.
    - **j.** Senão (fallback):
      - `aType = property.attributeDefinition(attributeId)`.
      - Se `!aType` → `errorMessage = "Unknown attribute"`, `return false`.
      - `scIdx = aType.scenarioSpecific ? scenarioIdx : undefined`.
      - `attr = property.getAttribute(attributeId, scIdx)`.
      - Se `attr instanceof DateAttribute && !attr.get()`:
        - `errorMessage = "undefined value"`, `return false`.
  - **3. `catch TjException`**: `errorMessage = e.message`, `return ok = false`.
  - **4. `return ok = true`**.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Query.rb` — método `process`.
- `docs/tj3-engine/14-blueprint-others.md` — §5.3.

#### Critério de aceite

```ts
const q = new Query({ project: p, property: t, attributeId: 'effort', ... });
assert(q.process());
assertEquals(q.to_num(), 8);
```

#### Testes

- `query-process_test.ts`:
  - `it("atributo simples")`.
  - `it("atributo de projeto (currency)")`.
  - `it("atributo de projeto (now)")`.
  - `it("query_ custom method")`.
  - `it("query_ scenario-specific")`.
  - `it("customData tem prioridade")`.
  - `it("propertyId com !")`.
  - `it("scopePropertyId")`.
  - `it("scenario resolve para scenarioIdx")`.
  - `it("DateAttribute null → erro")`.
  - `it("atributo desconhecido → erro")`.
  - `it("propertyId desconhecido → erro")`.

---

### 11.8 — `Query` — métodos de acesso

#### Contexto

Após `process()`, o usuário lê o resultado via `to_s()`, `to_num()`, `to_sort()`, `to_rti()`, `result()`.

#### Objetivo

Implementar os 5 métodos.

#### Arquivos

- `packages/core/src/query/query.ts` (estender)
- `packages/core/tests/query/query-accessors_test.ts`

#### Requisitos

- [ ] `to_s(): string`:
  - `attr ? attr.to_s(this) : (rti ? rti.to_s() : (string ?? ''))`.
- [ ] `to_num(): number | null`:
  - `attr ? attr.to_num() : numerical`.
- [ ] `to_sort(): unknown`:
  - `attr ? attr.to_sort() : sortable`.
- [ ] `to_rti(): RichTextIntermediate | null`:
  - Se `attr instanceof RichTextAttribute`, retorna `attr.get()`.
  - Senão, `attr ? attr.to_rti(this) : rti`.
- [ ] `result(): unknown`:
  - Se `attr`:
    - Se `ReferenceAttribute`, retorna `attr.get()[0]`.
    - Senão, `attr.get()`.
  - Senão se `numerical !== null`, retorna `numerical`.
  - Senão se `rti`, retorna `rti`.
  - Senão, retorna `string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Query.rb` — métodos `to_s`, `to_num`, `to_sort`, `to_rti`, `result`.

#### Critério de aceite

Análogo.

#### Testes

- `query-accessors_test.ts`:
  - `it("to_s com attr")`.
  - `it("to_s com string")`.
  - `it("to_s com rti")`.
  - `it("to_num")`.
  - `it("to_sort")`.
  - `it("to_rti com RichTextAttribute")`.
  - `it("result com ReferenceAttribute")`.

---

### 11.9 — `Query` — scale + assignList

#### Contexto

`scaleDuration` e `scaleLoad` convertem números para strings legíveis (`"3d"`, `"2.5h"`, `"1min"`). `assignList` formata listas.

#### Objetivo

Implementar `scaleDuration`, `scaleLoad`, `scaleValue`, `assignList`.

#### Arquivos

- `packages/core/src/query/query.ts` (estender)
- `packages/core/tests/query/query-scale_test.ts`

#### Requisitos

**`scaleDuration(value: number): string`:**

- [ ] `scaleValue(value, [24*60, 24, 1, 1/7, 1/30.42, 1/91.25, 1/365])`.

**`scaleLoad(value: number): string`:**

- [ ] `scaleValue(value, [dailyWorkingHours*60, dailyWorkingHours, 1, 1/weeklyWorkingDays, 1/monthlyWorkingDays, 1/(yearlyWorkingDays/4), 1/yearlyWorkingDays])`.

**`scaleValue(value: number, factors: number[]): string`:**

- [ ] Se `loadUnit === 'shortauto' || loadUnit === 'longauto'`:
  - Iterar 7 unidades, computar `scaledValue = value * factor`.
  - `str = numberFormat.format(scaledValue)`.
  - `delta = |scaledValue - parseFloat(str)|`.
  - Filtrar `str` que começa com `'0' + fractionSeparator`.
  - Escolher o menor `str` não-descartado.
  - Se `longauto`, sufixo `minute(s)`, `hour(s)`, etc.
  - Se `shortauto`, sufixo `min`, `h`, `d`, `w`, `m`, `q`, `y`.
- [ ] Senão, unidade fixa:
  - `units = ['minutes', 'hours', 'days', 'weeks', 'months', 'quarters', 'years']`.
  - `idx = units.indexOf(loadUnit)`.
  - `numberFormat.format(value * factors[idx])`.

**`assignList(listItems: string[]): void`:**

- [ ] `list = ''`.
- [ ] Para cada `item`:
  - `comma` / `undefined`: `list += ', ' + item`.
  - `bullets`: `list += '* ' + item + '\n'`.
  - `numbered`: `list += '# ' + item + '\n'`.
- [ ] `sortable = string = list`.
- [ ] `rti = richTextFactory.create(list)` (Fase 12) ou `null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Query.rb` — métodos `scaleDuration`, `scaleLoad`, `scaleValue`, `assignList`.

#### Critério de aceite

```ts
const q = new Query({ loadUnit: 'days', numberFormat: new RealFormat([...]) });
assertEquals(q.scaleDuration(3), "3d");
```

#### Testes

- `query-scale_test.ts`:
  - `describe("scaleDuration")`
    - `it("com loadUnit days")`.
    - `it("com loadUnit shortauto")`.
    - `it("com loadUnit longauto")`.
  - `describe("scaleLoad")`
    - `it("com loadUnit hours")`.
    - `it("com loadUnit days")`.
  - `describe("assignList")`
    - `it("comma")`.
    - `it("bullets")`.
    - `it("numbered")`.

---

### 11.10 — `Query` — `resolvePropertyId` + `setCustomData`

#### Contexto

`resolvePropertyId` interpreta `!` (subir para pai) e IDs absolutos. `setCustomData` injeta resultados.

#### Objetivo

Implementar os 2 métodos.

#### Arquivos

- `packages/core/src/query/query.ts` (estender)
- `packages/core/tests/query/query-resolve_test.ts`

#### Requisitos

**`resolvePropertyId(pType, pId): PropertyTreeNode | null`:**

- [ ] Se `!project`, `throw Error('Need Project reference')`.
- [ ] Se `pId[0] === '!'`:
  - Para cada `c` em `pId`:
    - Se `c === '!'`, `property = property.parent`.
    - Se `!property`, `break`.
  - Retorna `property`.
- [ ] Senão, dispatch por `pType`:
  - `Account` → `project.account(pId)`.
  - `Task` → `project.task(pId)`.
  - `Resource` → `project.resource(pId)`.
  - Senão, `throw Error('Unknown property type')`.

**`setCustomData(name: string, data: CustomData): void`:**

- [ ] `customData.set(name, data)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Query.rb` — `resolvePropertyId`, `setCustomData`.

#### Critério de aceite

Análogo.

#### Testes

- `query-resolve_test.ts`:
  - `it("resolve absolute task")`.
  - `it("resolve ! sobe um nível")`.
  - `it("resolve !! sobe dois níveis")`.
  - `it("resolve ! além do root retorna null")`.
  - `it("resolve resource")`.
  - `it("resolve account")`.
  - `it("resolve tipo desconhecido lança")`.

---

### Bloco C — SimpleQueryExpander

---

### 11.11 — `SimpleQueryExpander`

#### Contexto

Substitui `<-name->` em strings por valores de atributo. Usado em títulos de colunas (Fase 14), legendas, etc.

#### Objetivo

Implementar `SimpleQueryExpander`.

#### Arquivos

- `packages/core/src/query/simple-query-expander.ts`
- `packages/core/tests/query/simple-query-expander_test.ts`

#### Requisitos

- [ ] `class SimpleQueryExpander`:
  - `private inputStr: string`
  - `private query: Query`
  - `private sourceFileInfo: SourceFileInfo | null`
- [ ] Constructor `(inputStr, query, sfi)`.
- [ ] `expand(): string`:
  - `str = inputStr`.
  - Se `query.scenarioIdx !== undefined`, substitui `<-scenario->` por `query.project.scenario(query.scenarioIdx).id`.
  - `str.replace(/<-[a-zA-Z][_a-zA-Z]*->/g, (match) => ...)`:
    - `attribute = match.slice(2, -2)`.
    - `query.attributeId = attribute`.
    - `query.process()`.
    - Se `query.ok`, retorna `query.to_s()`.
    - Senão, `error('sqe_expand_failed', 'Unknown attribute ' + attribute, sfi)`, retorna `''`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/SimpleQueryExpander.rb` — arquivo completo.
- `docs/tj3-engine/14-blueprint-others.md` — §5.6.

#### Critério de aceite

```ts
const expander = new SimpleQueryExpander('Effort: <-effort->', query, null);
assertEquals(expander.expand(), "Effort: 8d");
```

#### Testes

- `simple-query-expander_test.ts`:
  - `it("sem placeholders")`.
  - `it("substitui <-name->")`.
  - `it("substitui <-scenario->")`.
  - `it("substitui múltiplos")`.
  - `it("erro se atributo desconhecido")`.
  - `it("query.ok false retorna vazio + warning")`.

---

### Bloco D — Integração

---

### 11.12 — Integração com `TaskScenario` e `ResourceScenario`

#### Contexto

Os métodos `query_*` em `TaskScenario` e `ResourceScenario` já foram implementados na Fase 7. Aqui **validamos a integração** com `Query`.

#### Objetivo

Testes end-to-end.

#### Arquivos

- `packages/core/tests/integration/query-task_test.ts`
- `packages/core/tests/integration/query-resource_test.ts`

#### Requisitos

- [ ] Para cada `query_*` de TaskScenario:
  - Criar query apropriada.
  - `query.process()`.
  - Validar `query.ok`, `query.to_s()`, `query.to_num()`.
- [ ] Para cada `query_*` de ResourceScenario:
  - Idem.
- [ ] Testar `LogicalAttribute.eval` que dispara `query.process`.
- [ ] Testar `SimpleQueryExpander` em título de coluna.

#### Referências

- Fases 7 (TaskScenario, ResourceScenario).
- Fases 11 (Query).

#### Critério de aceite

```ts
const q = new Query({
  project: p, property: task, attributeId: 'effort',
  scenario: scenario, start: ..., end: ...,
});
q.process();
assertEquals(q.to_s(), "8d");
```

#### Testes

- `query-task_test.ts`:
  - `it("query_effort")`.
  - `it("query_duration")`.
  - `it("query_complete")`.
  - `it("query_cost")`.
  - `it("query_revenue")`.
  - `it("query_activetasks")`.
  - `it("query_competitorcount")`.
  - `it("query_followers")`.
  - `it("query_precursors")`.
- `query-resource_test.ts`:
  - `it("query_effort")`.
  - `it("query_annualleave")`.
  - `it("query_freetime")`.
  - `it("query_freework")`.
  - `it("query_fte")`.
  - `it("query_headcount")`.
  - `it("query_rate")`.
  - `it("query_duties")`.

---

### Bloco E — Golden tests

---

### 11.13 — Golden tests (expressões + queries)

#### Contexto

Validar contra `tj3` real.

#### Objetivo

Scripts Ruby `logical-expressions.rb` e `queries.rb`.

#### Arquivos

- `scripts/golden/logical-expressions.rb`
- `scripts/golden/queries.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/logical-expressions.golden.json`
- `packages/core/tests/golden/queries.golden.json`
- `packages/core/tests/golden/logical-expressions_golden_test.ts`
- `packages/core/tests/golden/queries_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**`logical-expressions.rb`:**

- [ ] Para cada expressão do `TestSuite/`:
  - Cria contexto mínimo (1 task, 1 resource).
  - Avalia via `LogicalExpression.eval`.
  - Registra `{ expr, result }`.

**`queries.rb`:**

- [ ] Roda `tj3` em `mwe001-009` (que têm reports com queries).
- [ ] Extrai valores de células do HTML.
- [ ] Registra `{ report, task, attr, value }`.

**Testes TS:**

- [ ] Reconstroem cenário.
- [ ] Compara.
- [ ] ≥ 40 casos.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/taskjuggler/test/TestSuite/`.
- `docs/Learning/mwe001-009/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- HTML rendering — Fase 14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 40 casos.
- Todos passam.

#### Testes

- `logical-expressions_golden_test.ts`:
  - `describe("Golden logical expressions")` — itera.
- `queries_golden_test.ts`:
  - `describe("Golden queries")` — itera.

---

## 6. Ordem de execução sugerida

```text
15.0  ADR 022
      ↓
15.1  LogicalOperation
15.2  LogicalAttribute + LogicalFlag
15.3  LogicalFunction
15.4  LogicalExpression
15.5  Testes e2e
      ↓
15.6  Query estrutura
15.7  Query.process
15.8  Query accessors
15.9  Query scale + assignList
15.10 Query resolvePropertyId + customData
      ↓
15.11 SimpleQueryExpander
      ↓
15.12 Integração com TaskScenario/ResourceScenario
      ↓
15.13 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 11 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `LogicalExpression`, `LogicalOperation`, `LogicalAttribute`, `LogicalFlag`, `LogicalFunction` implementados.
- [ ] 14 funções lógicas completas.
- [ ] `Query.process` completo.
- [ ] `Query` accessors + scale + assignList + resolvePropertyId.
- [ ] `SimpleQueryExpander`.
- [ ] Integração com `TaskScenario` e `ResourceScenario` validada.
- [ ] **≥ 180 testes unitários**.
- [ ] **≥ 40 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 022 criado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Sem precedência confunde usuários | Alto | Documentar; exemplos com parênteses |
| Coerção por tipo do **primeiro** operando errada | Alto | Testes em cada combinação |
| Lazy AND/OR com efeitos colaterais | Médio | Testes com `customData` que conta chamadas |
| `Query.process` dispatch errado (property vs scenarioData) | Alto | Testes com `query_` custom |
| `start`/`end` dessincronizados | Médio | Setters validam |
| `resolvePropertyId` com `!!!` além do root | Médio | Teste retorna null |
| `scaleValue` com `shortauto` erra unidade | Médio | Golden tests com Ruby |
| `SimpleQueryExpander` com regex errada | Médio | Testes com casos limítrofes |
| `hasalert` stub retorna valor errado | Baixo | Fase 16 completa |
| `LogicalFlag` para Journal requer Fase 16 | Baixo | Apenas Query testado nesta fase |
| Performance de `Query.process` em reports | Médio | Benchmarks; `DataCache` da Fase 7 |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb`
- `docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb`
- `docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb`
- `docs/taskjuggler/lib/taskjuggler/Query.rb`
- `docs/taskjuggler/lib/taskjuggler/SimpleQueryExpander.rb`

### Blueprints

- `docs/tj3-engine/03-bluprint-engine2.md` — §5
- `docs/tj3-engine/14-blueprint-others.md` — §5

### Documentos do projeto

- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/022-expressoes-logicas.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/taskjuggler/test/TestSuite/`
- `docs/Learning/mwe001-009/`

### Fases dependentes

- **Fase 10 — Parser** (usa `Logical*` para construir expressões).
- **Fase 12 — RichText** (usa `Query.setQuery` em function handlers).
- **Fase 14 — Reports** (`ReportBase.filterTaskList`, `columnTitle`, `SimpleQueryExpander`).
- **Fase 16 — Journal** (`LogicalFlag` para Journal, `hasalert`).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **Sem precedência.** `a | b & c` = `(a | b) & c`. Não tente "corrigir".
2. **Lazy `&` / `|`.** Usar `&&` e `||` do TS.
3. **Coerção pelo tipo do `operand1`.** Não pelo `operand2`.
4. **Sufixo `_` inverte property/scopeProperty.**
5. **`Query.process` tenta:** customData → property.query_X → data[scIdx].query_X → attribute base.
6. **`start`/`end` sincronizados com `startIdx`/`endIdx`.** Setters obrigatórios.
7. **`resolvePropertyId` com `!` sobe um nível por caractere.**
8. **`scaleValue` com `shortauto`/`longauto` complexo.** Copiar o Ruby literalmente.
9. **`assignList` sem RichText nesta fase.** Retorna string; Fase 12 pluga `RichTextFactory`.
10. **`hasalert` é stub.** Fase 16.
11. **`LogicalFlag` para Journal é Fase 16.** Só `Query` nesta fase.
12. **`Query` usa `ReportContext` (Fase 14) em reports.** Integração vem depois.
13. **`SimpleQueryExpander` regex:** `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **Commit por subfase.** `feat(core): logical-operation`, `feat(core): query`, etc.

---

## 11. ADR 022 (referência rápida)

Criado como subfase 15.0. Conteúdo esperado:

- **Título:** Expressões lógicas sem precedência
- **Contexto:** TJ avalia left-to-right, sem precedência.
- **Decisão:** manter fidelidade.
- **Alternativas:** precedência convencional (quebra compatibilidade).
- **Consequências:** usuários precisam parênteses; documentação clara.

---

**Fim da Fase 11.**