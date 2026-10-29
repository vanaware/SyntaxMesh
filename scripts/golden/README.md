# Golden Tests — Scripts

> **Fase:** 3 — Modelo de Atributos
> **Decisão:** ADR 011 (Port fiel do TaskJuggler) + ADR 013 (`compat.keepRubyBugs`)

## Propósito

Os scripts Ruby deste diretório geram os arquivos `.golden.json` que
servem como **contrato de comportamento** entre a implementação TypeScript
e o TaskJuggler Ruby original (`tj3`).

Cada caso de teste é escrito em Ruby e executado contra a biblioteca
`taskjuggler` real. O resultado (JSON) é commitado em
`packages/core/tests/golden/` e usado por testes Deno para validação
paritária.

## Arquivos

| Arquivo                                                       | Fase | Gera                              | Usado por                            |
| ------------------------------------------------------------- | ---- | --------------------------------- | ------------------------------------ |
| `attributes.rb`                                               | 3    | `attributes.golden.json`          | `attributes_golden_test.ts`          |
| `tjtime.rb`                                                   | 2    | `tjtime.golden.json`              | `tjtime.golden.test.ts`              |
| `compute_golden.rb`                                           | 2    | `compat-fix.golden.json`          | `compat_golden_test.ts`              |
| `finance-mwe004.rb`                                           | 8    | `finance-mwe004.golden.json`      | `finance_golden_test.ts`             |
| `finance-variations.rb`                                       | 8    | `finance-variations.golden.json`  | `finance_golden_test.ts`             |
| `parser-mwe001..009.rb` + `parser-syntax-{correct,errors}.rb` | 10   | `parser.golden.json`              | `parser_golden_test.ts`              |
| `logical-expressions.rb`                                      | 11   | `logical-expressions.golden.json` | `logical-expressions_golden_test.ts` |
| `richtext.rb`                                                 | 12   | `richtext.golden.json`            | `richtext_golden_test.ts`            |

## Fluxo de trabalho

### Gerar um golden

```bash
deno task golden:generate
```

Isso executa `scripts/golden/attributes.rb` via `ruby`, coleta o JSON de
saída e escreve em `packages/core/tests/golden/attributes.golden.json`.

### Validar que o golden está em sync com o Ruby

```bash
deno task golden:generate
git diff --stat packages/core/tests/golden/
```

Se o diff for vazio, o golden está em dia. Se houver alteração, revise
antes de commitar — pode ser um bug na implementação TS ou uma
divergência intencional (nesse caso, documente em ADR 013).

### Rodar os testes golden

```bash
deno task test
```

Os testes golden estão em `packages/core/tests/golden/*_golden_test.ts`.

## Regras

1. **O Ruby é a fonte de verdade.** Qualquer divergência entre o golden
   e a implementação TS é, por padrão, um bug na TS.
2. **Exceção: `compat.keepRubyBugs`.** Se a divergência for um bug
   conhecido do Ruby (Categoria B do cheat sheet), a implementação TS
   pode mantê-lo sob a flag `compat.keepRubyBugs = true`. Documente em
   ADR 013 (`docs/syntaxmesh/decisoes/013-compat-flag-ruby-bugs.md`).
3. **Golden files são versionados.** Nunca edite
   `*.golden.json` manualmente — regere via script.
4. **Cada caso deve ter `description` em português** e os campos
   `method`, `type`, `input`, `expected`.
5. **Idempotência byte-a-byte.** Os `.rb` não gravam `generated_at`
   (proveniência = git) nem serializam objetos Ruby voláteis
   (`#<Proc:0x…>`, `#<Interval:0x…>`). Quando o Ruby precisa simular
   comportamento de objeto (ex.: `to_s` de um mock), emita **token
   estável** — p.ex. `{ __to_s_seq__: ["v1"] }` ou
   `{ __wh_intervals__: { "0": [[s, e]] } }` — e o teste TS rehidrata
   o token em closure (ver `attributes_golden_test.ts`). Os geradores
   (`generate_golden.ts`, `generate_property_tree_golden.ts`)
   re-serializam com `JSON.stringify(…, null, 2)` para casar com o
   `deno fmt`. Assim, `deno task golden:generate` rodado duas vezes
   produz saída idêntica para **todos** os `*.golden.json`.
   Exceção conhecida: os `.html` de relatório escritos de brinde pelos
   scripts de finance embutem timestamp do tj3 ("Created on …") e não
   são consumidos por teste algum — reverta-os
   (`git checkout -- packages/core/tests/golden/*.html`) após gerar.

## Estrutura de um caso

```ruby
tc("Description em português",
   "to_tjp",           # método sendo testado
   "String",           # tipo (bate com getAttributeClass)
   { value: "hello" }, # input
   "text \"hello\"")   # expected
```

Opções suportadas (último argumento Hash):

```ruby
tc("...", "to_tjp", "String", { value: "x" }, "...", mode: 1)
tc("...", "to_tjp", "String", { value: "x" }, "...", inherit: true)
```

## Manutenção

Ao adicionar um novo tipo de atributo ou corrigir comportamento:

1. Atualizar `scripts/golden/attributes.rb` com os novos casos.
2. `deno task golden:generate`.
3. `deno task test` — verificar que os testes passam.
4. Commitar os três arquivos juntos (`attributes.rb`, `.golden.json`,
   `_golden_test.ts` se houver).

## Finance Golden Tests (Fase 8.8)

Os testes golden financeiros geram casos a partir de arquivos `.tjp` do TaskJuggler
(`tj3`) e comparam os valores de relatórios (PnL, Resources) com a
implementação TypeScript.

### Arquivos

- `scripts/golden/finance-mwe004.rb` — gera `finance-mwe004.golden.json`
- `scripts/golden/finance-variations.rb` — gera `finance-variations.golden.json`
- `packages/core/tests/golden/finance_golden_test.ts` — testes que carregam os JSONs e validam os valores

### Fluxo de trabalho

```bash
# Gerar golden para mwe004 (caso base)
ruby scripts/golden/finance-mwe004.rb
# Gerar golden para variações (casos adicionais)
ruby scripts/golden/finance-variations.rb
# Rodar testes
npm test
```

### Regras Específicas

1. **`balance cost rev` deve estar NO ESCOPO DO PROJETO** (fora do bloco `project`)
2. **`chargeset` em tarefas aponta para um `Account` (não um `Resource`)**
3. **`charge` e `effort` são tratados como custos**
4. **`charge` com `onend` gera custo no final da tarefa**
5. **`charge` com `onstart` gera custo no início**
6. **`charge` com `perday` gera custo diário**
7. **`charge` com `perhour`/`perweek` são convertidos para `perday`**
8. **`charge` negativo é permitido (créditos)**
9. **`effort` negativo é rejeitado**
10. **`chargeset` em recursos usa `resource.chargeset`**

### Diagnóstico de valores zero

Se os valores golden são todos 0.0:

1. **Verifique `balance cost rev`** — deve estar no escopo correto
2. **Verifique `chargeset`** — deve apontar para um Account válido
3. **Verifique `rate`** — recursos devem ter rate definido
4. **Verifique `effort`** — tarefas devem ter effort definido
5. **Verifique `charge`** — deve estar no escopo correto
6. **Verifique `now`** — deve estar dentro do período do projeto
7. **Verifique `depends`** — tarefas devem ter start/end constraints

### Exemplo de caso golden

```json
{
  "description": "Project Expenses",
  "method": "to_tjp",
  "type": "Account",
  "input": { "value": null },
  "expected": {
    "balance": 1000.0,
    "cost": 800.0,
    "revenue": 200.0,
    "turnover": 600.0
  }
}
```

## Parser Golden Tests (Fase 10.19)

Geram os casos de **parse de `.tjp`** (successo e erro) executando o
TaskJuggler Ruby real como oracle. O harness replica o `test_Syntax.rb` do
TJ: para cada arquivo, um `TaskJuggler.new` (que reseta o fuso para UTC via
`TjTime.setTimeZone('UTC')`), `mh.trapSetup = true` (primeiro erro aborta o
parse) e captura `{ file, ok, errorId?, errorMsg?, lineNo? }`.

### Arquivos

- `parser-common.rb` — harness compartilhado (carrega a gema, roda um
  arquivo `.tjp` e imprime o caso JSON; markers `<<<GOLDEN>>>` isolam o
  JSON dos logs do tj3).
- `parser-mwe001.rb` … `parser-mwe009.rb` — um script por MWE de
  `docs/Learning/mweNNN/tutorial.tjp` (casos de sucesso, incluindo os
  `include` dos tutoriais).
- `parser-syntax-correct.rb` — itera `docs/taskjuggler/test/TestSuite/Syntax/Correct/`.
- `parser-syntax-errors.rb` — itera `…/Syntax/Errors/` e captura
  `errorId`/`errorMsg`/`lineNo` da primeira mensagem do MessageHandler.
- Saída mesclada em `packages/core/tests/golden/parser.golden.json`
  (178 casos), consumida por `parser_golden_test.ts`.

### Fluxo de trabalho

```bash
deno task golden:generate   # roda todos os parser-*.rb via ruby + tj3
deno task test              # valida o parser TS contra o parser.golden.json
```

### Casos com RichText (Fase 12)

Cinco casos dependem de RichText/Markup e têm **skip explícito** em
`parser_golden_test.ts` (`PENDING_FASE_12`): `Syntax/Correct/{CustomAttributes,
EnvVar,MinMax,tutorial}.tjp` e `Syntax/Errors/unsupported_token.tjp` —
`unsupported_token` exige `limitTokenSet`, chamado apenas do
`RichText/Parser.rb`. Serão habilitados na Fase 12.

### Regras específicas

1. **Fuso UTC por caso.** O golden só bate se cada parse resetar o fuso
   (o driver TS espelha com `TjTime.setTimeZone("UTC")` em `parseMasterFile`).
2. **Primeiro erro aborta.** Com `trapSetup`, apenas a primeira mensagem
   do MessageHandler aparece no golden — o TS replica com `mh.trapSetup = true`.
3. **Nunca editar `parser.golden.json` à mão** — regerer com
   `deno task golden:generate`.

## Logical Expressions Golden Tests (Fase 11.13)

Validam a semântica do motor de expressões lógicas (`LogicalOperation`/
`LogicalExpression`) contra o Ruby como oracle.

### Arquivos

- `scripts/golden/logical-expressions.rb` — constrói árvores
  `LogicalOperation` sobre primitivos (números, strings, booleanos), avalia
  via `LogicalExpression#eval(nil)` e serializa `{ description, tree,
  expected }` para `logical-expressions.golden.json` (25 casos).
- `packages/core/tests/golden/logical-expressions_golden_test.ts` —
  reconstroi cada `tree` em TS, avalia e compara com `expected`.

### Escopo e divergências conhecidas

O golden cobre **apenas** os casos em que Ruby e TS coincidem: comparações de
mesmo tipo, `&`/`|` lazy (short-circuit), `~`, avaliação **left-to-right sem
precedência** (ADR 024) e erros de operador. Comparações **número-vs-string**
são deliberadamente omitidas: o Ruby é estrito (`coerceNumber` rejeita
`String` → `TjException`), enquanto o port TS segue a tarefa 11.1.3.8
(`parseFloat` da string). Incluir esses casos geraria falsa divergência.

### Queries golden (11.13.4–11.13.5) — BLOQUEADO

A geração de um golden de queries a partir do HTML do `tj3` depende dos
métodos `query_*` de scheduling/financeiro em `Task`/`Resource`
(`query_effort`, `query_duration`, `query_cost`, …), que **ainda não existem**
no core (só `query_balance`/`query_turnover` estão implementados). Este golden
será criado quando as fases de scheduling (7) e financeiro (8) entregarem
esses métodos. A ponte `Query.process` (dispatch
`customData → property.query_X → data[scIdx].query_X → atributo base`) já é
coberta por `query_test.ts` e `integration/query-task_test.ts`.

## RichText Golden Tests (Fase 12.19)

Validam as três serializações do subsistema RichText (`to_s`, `to_tagged`,
`to_html`) contra o TaskJuggler Ruby real como oracle.

### Arquivos

- `scripts/golden/richtext.rb` — itera ~32 markups de exemplo (parágrafos,
  títulos aninhados, negrito/itálico, listas, código, nowiki, links `href`/`ref`
  com âncora, tabela, citação, entidade, escape, `sectionNumbers=false`),
  instancia `RichText.new(input)`, gera o `RichTextIntermediate` e grava
  `{ id, description, input, sectionNumbers, expected: { plain, tagged, html } }`
  em `packages/core/tests/richtext/golden/richtext.golden.json`.
- `packages/core/tests/richtext/golden/richtext_golden_test.ts` — reproduz cada
  markup no TS e compara as três saídas.

### Tolerâncias de comparação (12.19.8)

1. **`plain` (to_s):** whitespace colapsado (`\s+` → espaço) — o
   `textBlockFormat` do Ruby quebra linhas conforme a largura.
2. **`tagged` (to_tagged):** comparado byte-a-byte.
3. **`html` (to_html):** normaliza apenas a **formatação de serialização** —
   remove whitespace _entre tags_ (`>\s+<` → `><`) e antes de auto-fechamento
   (`\s+/>` → `/>`). O **conteúdo** (tags, atributos, escapes) é comparado
   rigorosamente. A divergência de indentação vem do `SimpleXMLElement` mínimo
   desta fase; a Fase 17 (elemento `XMLElement` real) a elimina.

### Casos excluídos (Ruby é o oracle)

Dois markups são **recusados pelo próprio Ruby** e ficam fora do golden (sem
expectativa do oracle): `=====` (título de nível 5, inexistente → `NameError`)
e `'''…''…'''` (aninhamento ambíguo de negrito/itálico → erro de token). O port
TS é mais leniente nesses dois casos; a coincidência de comportamento será
reavaliada na Fase 21 (compatibilidade).

### Regras específicas

1. **Parser singleton resetado por caso.** `RichText.class_variable_set(:@@parser,
   nil)` antes de cada markup evita vazamento de estado do contador de seções.
2. **`trapSetup = true`** converte erros de parse em exceção (não `exit 1`),
   como no harness de parser da Fase 10.
3. **Nunca editar `richtext.golden.json` à mão** — regerer com
   `deno task golden:generate`.
