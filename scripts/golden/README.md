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

| Arquivo                                                                         | Fase | Gera                              | Usado por                            |
| ------------------------------------------------------------------------------- | ---- | --------------------------------- | ------------------------------------ |
| `attributes.rb`                                                                 | 3    | `attributes.golden.json`          | `attributes_golden_test.ts`          |
| `tjtime.rb`                                                                     | 2    | `tjtime.golden.json`              | `tjtime.golden.test.ts`              |
| `compute_golden.rb`                                                             | 2    | `compat-fix.golden.json`          | `compat_golden_test.ts`              |
| `finance-mwe004.rb`                                                             | 8    | `finance-mwe004.golden.json`      | `finance_golden_test.ts`             |
| `finance-variations.rb`                                                         | 8    | `finance-variations.golden.json`  | `finance_golden_test.ts`             |
| `parser-mwe001..009.rb` + `parser-syntax-{correct,errors}.rb`                   | 10   | `parser.golden.json`              | `parser_golden_test.ts`              |
| `logical-expressions.rb`                                                        | 11   | `logical-expressions.golden.json` | `logical-expressions_golden_test.ts` |
| `richtext.rb`                                                                   | 12   | `richtext.golden.json`            | `richtext_golden_test.ts`            |
| `reports-mwe001..009.rb` + `reports-syntax-correct.rb`                          | 14   | `reports.golden.json`             | `reports_golden_test.ts`             |
| `gantt-mwe001..009.rb` + `gantt-testsuite.rb`                                   | 15   | `gantt.golden.json`               | `gantt_golden_test.ts`               |
| `journal.rb`                                                                    | 16   | `journal.golden.json`             | `journal_golden_test.ts`             |
| `leaves.rb`                                                                     | 16   | `leaves.golden.json`              | `leaves_golden_test.ts`              |
| `html-xml.rb`                                                                   | 17   | `html-xml.golden.json`            | `html-xml_golden_test.ts`            |
| `ical.rb`                                                                       | 17   | `ical.golden.json`                | `ical_golden_test.ts`                |
| `timesheets.rb`                                                                 | 18   | `timesheets.golden.json`          | `timesheets_golden_test.ts`          |
| `dynamic-attributes.rb`                                                         | 18   | `dynamic-attributes.golden.json`  | `dynamic-attributes_golden_test.ts`  |
| `packages/core/tests/golden/generate_extension_golden.ts` (TS puro, sem oracle) | 14C  | `reports-extensions.golden.json`  | `reports-extensions_golden_test.ts`  |

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

## Reports Golden Tests (Fase 14.23)

Validam o **formato intermediário** dos relatórios (`ReportTable`) contra o
tj3 real: para cada `.tjp`, roda parse → schedule → `generateIntermediateFormat`
sobre cada relatório com `formats` e extrai a tabela (cabeçalho das colunas +
linhas de dados) via walker compartilhado.

### Arquivos

- `reports-common.rb` — harness compartilhado (`run`, `extract_table`,
  `case_for`, `cases_for_list`). Espelhado do lado TS por
  `packages/core/tests/golden/extract-table.ts` (mesmo walker, mesma
  serialização).
- `reports-mwe001.rb` … `reports-mwe009.rb` — um script por MWE
  (`docs/Learning/mweNNN/tutorial.tjp`).
- `reports-syntax-correct.rb` — itera `TestSuite/{ReportGenerator/Correct,
  HTML-Reports,CSV-Reports}`.
- `packages/core/tests/golden/reports_golden_test.ts` — 61 casos de relatório
  (≥60 exigidos), comparando o **digest estrutural** (nº de colunas, nº de
  linhas, sequência de kinds de célula por linha) por relatório.

### Por que digest estrutural e não HTML/valores

O markup HTML difere por design (ADR 027, browser) e os **valores** de célula
(`name`, datas, `query_*`) dependem de integrações pendentes: colunas
computadas `query_*` (Fase 11), `chart`/GanttChart (Fase 15/16), `to_rti`
(Fase 12/14). O golden congela a **geometria do pipeline de relatórios**
(dispatch de conteúdo, colunas, linhas, célula especial vs texto).

### Divergências rastreadas (não são xfail silencioso)

- Relatórios que o TS **não monta** (Gantt/query/to_rti) são classificados
  `pending` pela **classe do erro** — erro inesperado falha o teste.
- Relatórios montados com geometria divergente (sub-linhas dependentes de
  alocação/query) estão em `PENDING_DIVERGENCES` explícita, por
  `arquivo:relatório`; saem da lista quando a integração chegar.
- Arquivos cujo **schedule TS** ainda estoura (gap de scheduler de fase
  anterior, ex.: `CSV-Reports/alert.tjp`) estão em `PENDING_SCHEDULER_FILES`.

### Regras específicas

1. **Silenciar o MessageHandler** (`outputLevel = :none`, `trapSetup = true`)
   — como no harness de parser — para erros de parse do TestSuite não
   poluírem o stdout JSON nem abortarem o processo.
2. **RichText de célula precisa de Query registrado** antes de `to_s`
   (`cell_text_text` espelha `ReportTableCell#to_html`); sem isso o walker
   levanta "No Query has been registered…".
3. **Cabeçalho vem das colunas** (`cell1`/`cell2`), não das `@lines`.
4. **Nunca editar `reports.golden.json` à mão** — regerer com
   `deno task golden:generate`.

## Gantt Golden Tests (Fase 15.13)

Validam a **geometria** do Gantt chart (coluna `chart` dos relatórios) contra o
tj3 real. Complementam os reports golden: lá a coluna `chart` é comparada apenas
estruturalmente (`<gantt>`), porque nasceu na Fase 14, antes do Gantt existir.

### Arquivos

- `gantt-common.rb` — harness compartilhado (`run`, `charts_of`,
  `chart_snapshot`, `line_snapshot`, `content_snapshot`, `case_for`,
  `cases_for_list`, `tjp_dir`). Espelhado do lado TS por
  `packages/core/tests/golden/gantt-extract.ts` (mesmo walker, mesma
  serialização, mesma tolerância).
- `gantt-mwe001.rb` … `gantt-mwe009.rb` — **só os MWEs com coluna `chart`**
  (001, 002, 003, 004, 006, 008, 009; mwe005 e mwe007 não têm).
- `gantt-testsuite.rb` — itera `TestSuite/HTML-Reports` (13 arquivos; 5 têm
  `chart`). `depArrows.tjp` é o caso forte do roteador: 35 linhas e 30 setas.
- `packages/core/tests/golden/gantt_golden_test.ts` — um `it` por coluna
  `chart`, mais os testes do comparador e da cobertura mínima.

### O que é comparado

```
{ report, column, scale, startDate, endDate, width, height, viewWidth, scrollbar,
  header: { height, nowLineX, markdateLineX, gridLines, cellStartDates },
  lines: [ { y, height, category, content: [ { kind, x, xEnd, y, w, yLevels, drawFrame } ] } ],
  depArrows: [ [ [x, y], … ] ], arrowHeads: [ [x, y] ] }
```

- `startDate`/`endDate`/`cellStartDates` são **segundos desde a época**
  (`TjTime#to_i` no Ruby, `toSeconds()` no TS) — independem do fuso do processo.
- `depArrows` são as polilinhas ortogonais do `GanttRouter`;
  `arrowHeads` os pontos finais deduplicados.
- **Tolerância:** posições em pixels aceitam **1px** (`POSITION_TOLERANCE`);
  datas, contagens, `kind`, `category` e booleanos são exatos.

### Relógio fixo (`now`)

`header.nowLineX` é `dateToX(now)` e o `now` de cada relatório herda o do
projeto, que nasce como `TjTime.now.align(3600)` (`Project.rb`) — ou seja, **muda
a cada hora**. Sem pino, `HTML-Reports/depArrows.tjp` falhava sozinho (124780 →
124783) sem nenhuma alteração de código.

Por isso `gantt-common.rb` fixa `FROZEN_NOW = '2026-01-01'`, aplica em
`report.set('now', …)` antes de gerar e grava o valor em cada caso
(`case.now`); `gantt_golden_test.ts` reaplica `report.set("now", …)` com o mesmo
valor antes de `generateIntermediateFormat`. Efeito colateral: a zona de
proteção da linha `nowline` no `GanttRouter` muda de posição, então `depArrows`
(1px) e `nowLineX` são os únicos campos afetados pela nova geração.

### Por que `to_html` no oracle

`GanttChart#completeChart` — que cria o router, roteia as dependências e
preenche `@depArrows`/`@arrowHeads` — só roda dentro de `to_html`. O oracle chama
`chart.to_html` de propósito (e o walker TS faz o mesmo); sem isso as setas não
existem no momento da extração.

### `instance_variable_get` de propósito

`GanttTaskBar`/`GanttMilestone`/`GanttContainer`/`GanttLoadStack` guardam a
geometria em ivars **sem `attr_reader`**. O oracle lê via
`instance_variable_get`; o walker TS lê os campos `private` equivalentes por
cast (em TS `private` só existe em tempo de compilação). Expor getters públicos
só de snapshot seria API de produção criada para o teste.

### Regras específicas

1. **Mesmo harness do reports golden** (`outputLevel = :none`,
   `trapSetup = true`, `TASKJUGGLER_DATA_PATH`) — logs nunca no stdout JSON.
2. **Arquivos sem `chart` produzem `charts: []`** e são descartados pelo
   gerador (`gantt-testsuite.rb`); não viram caso.
3. **Nunca editar `gantt.golden.json` à mão** — regerer com
   `deno task golden:generate`.
4. **O relógio é do golden, não do processo** — `FROZEN_NOW` no oracle e
   `report.set("now", …)` no teste; nunca comparar contra `TjTime.now()`.

```bash
ruby scripts/golden/gantt-mwe001.rb          # um caso, para depurar
ruby scripts/golden/gantt-testsuite.rb      # corpus HTML-Reports
deno task golden:generate                   # todos (grava gantt.golden.json)
```

## Journal Golden Tests (Fase 16.19)

Validam a renderização do journal (`Journal#to_rti`) contra o TaskJuggler Ruby
real. O oracle monta um `Project` mínimo (2 tasks raiz + 1 sub-task, 2
resources), insere 6 `JournalEntry` (alertLevel, autor, flags, summary/details,
uma entrada global e uma com flag `secret`) e, para cada `journalMode`
(`journal`, `journal_sub`, `status_up`, `status_down`, `status_dep`,
`alerts_down`, `alerts_dep`), chama `to_rti` e extrai o texto plano do
`RichTextIntermediate`.

### Arquivos

- `journal.rb` — escreve `journal.golden.json` (17 casos) com
  `{ description, mode, property, start, end, attributes, selfContained,
  hideFlags, expected }`.
- `packages/core/tests/golden/journal_golden_test.ts` — reconstrói a fixture
  no TS e compara o texto plano de `query.rti`.

### Tolerâncias

1. **Texto plano com whitespace colapsado** (`\s+` → espaço) — mesma
   tolerância do golden de RichText (12.19.8): o `textBlockFormat` do Ruby
   reflui parágrafos conforme a largura.
2. **Conteúdo exato:** alertas, nomes, `fullId`, datas, flags, summary e
   details são comparados integralmente — a seleção e a ordem
   (`date/alert/seqno`) de cada modo também, já que o texto é composto nessa
   ordem.
3. **`summary`/`details`**: o Ruby guarda o `RichTextIntermediate` e lê
   `richText.inputText`; o port guarda o `inputText` direto. Mesmo efeito no
   markup final.

### Regras específicas

1. **Fixture nova por caso** — `to_rti` ordena listas internas; recriar o
   projeto isola os casos.
2. **`scenarioIdx = 0` explícito** — o Ruby precisa do cenário para ler
   `startpreds` em `status_dep`/`alerts_dep`.
3. **`journalAttributes` explícito** — o default vive no contexto de
   relatórios (`TaskJuggler.rb`), não em `Query`.
4. **`hideJournalEntry` usa `LogicalExpression(LogicalFlag("secret"))`** —
   exercita o caminho de journal da Fase 16.18.
5. **Nunca editar `journal.golden.json` à mão** — regerer com
   `deno task golden:generate`.

## Leaves Golden Tests (Fase 16.19)

Validam `Leave`, `LeaveList`, `LeaveAllowance` e `LeaveAllowanceList` contra o
Ruby: `Leave::Types`/`typeIdx` (1–7), `Leave#to_s` (com e sem motivo; sem
motivo mantém os dois espaços), ordem de inserção da `LeaveList` e
`LeaveAllowanceList#balance` (janela `[start, end)`, provisões negativas de
expiração, tipos misturados, data inicial inclusiva e final exclusiva), além
dos `ArgumentError` de tipo inválido.

### Arquivos

- `leaves.rb` — escreve `leaves.golden.json` (19 casos) com `{ description,
  method, input, expected, error }`; `method` ∈ `typeIdx` | `to_s` | `order` |
  `balance`.
- `packages/core/tests/golden/leaves_golden_test.ts` — reconstrói cada caso a
  partir de `input` e compara valor (ou a mensagem de erro).

### Regras específicas

1. **Fuso UTC em ambos os lados** — `TjTime#to_s` embute o offset e
   `Leave#to_s` interpola o intervalo; o teste fixa UTC em `beforeAll` e
   restaura o fuso anterior em `afterAll`.
2. **`TimeInterval`, não `Interval`** — só `TimeInterval` define `to_s` (o
   parser do TJP também produz `TimeInterval` para licenças).
3. **Nunca editar `leaves.golden.json` à mão** — regerer com
   `deno task golden:generate`.

## HTML/XML e iCalendar Golden Tests (Fase 17.16)

Validam as serializações puras do Fase 17 — sem tj3, sem projeto: os dois
oráculos montam objetos diretos da biblioteca Ruby e gravam a string final.

### Arquivos

- `html-xml.rb` — 25 casos de `XMLElement`/`XMLText`/`XMLNamedText`/
  `XMLComment`/`XMLBlob`/`XMLDocument`/`HTMLDocument` (ordem de attrs,
  escapes `&`/`"`/`<`/`>`, self-closing, newline+indent com 2+ filhos,
  canonicalização `--`→`-\-`, re-indent de blob, `write('.')` puts-style,
  docTypes html5/strict com `generateHead`). Cada caso é `{ id, kind, spec,
  expected }` e o teste TS (`html-xml_golden_test.ts`) tem um builder por
  `id`, espelho 1:1 da lambda Ruby — comparação **byte-a-byte sem
  normalização** (a string é interna; `\n`/indentação são a carga útil).
- `ical.rb` — 11 casos de `ICalendar`/`Component`/`Todo`/`Event`/`Journal` +
  `foldLines` (envelope, DUE vs COMPLETED, escapes RFC de DESCRIPTION,
  RELATED-TO, ORGANIZER/ATTENDEE, dobra ASCII e UTF-8 multibyte, ordem
  todos→events→journals). `ical_golden_test.ts` compara byte-a-byte com duas
  exceções documentadas no header do teste:
  1. **DTSTAMP** — hora da serialização, não determinística na natureza; o
     oracle a **congela** (`ICAL_FROZEN_NOW`, mesmo precedente do `FROZEN_NOW`
     do gantt) para o golden ser byte-idempotente, e o teste substitui os dois
     lados por `DTSTAMP:\d{8}T\d{6}Z` → `DTSTAMP:@@NOW@@` (o port não tem seam
     de relógio e emite o `now()` real; a linha tem 26 bytes, nunca é dobrada).
  2. **CRLF não é normalizado** — aqui o `\r\n` gerado por `foldLines` é a
     própria carga útil verificada (RFC 5545).

### Determinismo compartilhado (ical)

- Fuso fixo `Europe/Berlin` gravado em `spec.tz` de cada caso; o teste chama
  `TjTime.setTimeZone(c.spec.tz)` antes de montar as datas e restaura no fim
  (try/finally) — padrão dos reports golden.
- `creationDate`/`lastModified` pinados em `2026-01-01` dos dois lados.
- AppConfig igualado aos defaults do port (`packages/core/src/app-config.ts`):
  `packageName=@vanaware/syntaxmesh`, `softwareName=SyntaxMesh`,
  `version=0.0.0`, `appName=syntaxmesh` (html-xml: o comentário
  "generated by …" do `HTMLDocument` casa byte-a-byte sem normalização).

### Regras específicas

1. **`Event#priority` não é serializável como caso de golden**: o Ruby não dá
   `attr_accessor :priority` ao `Event` (fixo em 1) e o `priority` do `Todo`
   nem aparece no `to_s` — esquisitice replicada no port, nada a comparar.
2. **Nunca editar `html-xml.golden.json`/`ical.golden.json` à mão** — regerer
   com `deno task golden:generate`.

## Time Sheets (Fase 18, 18.15)

### Arquivos

- `timesheets.rb` — 22 casos sobre um projeto **agendado de verdade**
  (`effortTask` 10d + `durationTask` 3d, recursos `dev` e `idle` com
  `efficiency 0`, `trackingscenario plan`): 15 de `TimeSheet#check`
  (`ts_no_remaining`, `ts_no_expected_end`, `ts_no_status_work`,
  `ts_no_headline`, `ts_default_summary`, `ts_alert1/2_more_details`,
  `ts_work_too_low/high`, `ts_work_not_null`, `ts_no_rem_or_end`, duas folhas
  independentes) e 7 de `TimeSheet#warnOnDelta`
  (`ts_res_work_delta`, `ts_res_remain_delta`, `ts_res_end_delta`,
  `ts_res_new_task`). Cada caso é `{ description, kind, sheets, expected }`,
  onde `sheets` é o **spec** (dias/percentual, nunca slots crus) e
  `expected` traz as mensagens do `MessageHandler` + o snapshot da folha
  (`percentageUsed`, `totalSlots`, `work`, `remaining`, `expectedEnd`,
  `status`).
- `timesheets_golden_test.ts` — reconstrói cada spec com `TimeSheet`/
  `TimeSheetRecord` do port (`daysToSlots`/`percentToSlots`, `JournalEntry`
  de status) e compara **mensagens + snapshot**.

### Regras específicas

1. **Dois `assert` por caso**: o snapshot das folhas (slots, dias, status)
   é comparado **sem normalização** — é ele que prova que o cálculo bate; a
   normalização textual existe só para formatação.
2. **`@@DATE@@`** — `ts_res_end_delta` interpola o fim esperado; o Ruby usa
   `TjTime#to_s` sem formato (`2026-02-10-00:00-+0000`) e o port `toString()`
   (`2026-02-10`).
3. **`4.0d` → `4d`** — `Float#to_s` do Ruby carrega o `.0`; o número JS não.
4. **O oracle desarma o raise do `MessageHandler`** (`NonFatalErrors` em
   `timesheets.rb`): com `trapSetup` o Ruby aborta no primeiro `error(...)`,
   enquanto o port acumula todas as mensagens. O contador de erros continua
   sendo incrementado.
5. **Registro sem `work` não é caso de golden** — `totalSlots += nil` estoura
   no Ruby; o `?? 0` do port é extensão leniente.

## Dynamic Attributes (Fase 18, 18.19.7)

### Arquivos

- `dynamic-attributes.rb` — 6 casos sobre um projeto agendado (`prj`, tarefas
  `a`/`b` com esforço e `allocate dev`, `taskreport dyn` com `columns id`),
  chamando `Project#generateReport('dyn', false, nil, snippet)` — o caminho do
  `tj3 -A`/`--attr`:

  | `dynamic`                     | colunas   | cabeçalhos  | tarefas | erros |
  | ----------------------------- | --------- | ----------- | ------- | ----- |
  | `nil` (sem `-A`)              | `id`      | `Id`        | `a b`   | 0     |
  | `columns id, name`            | `id name` | `Id Name`   | `a b`   | 0     |
  | `columns name, id`            | `name id` | `Name Id`   | `a b`   | 0     |
  | `hidetask plan.id = "b"`      | `id`      | `Id`        | `a`     | 0     |
  | `hidetask plan.id = "a"`      | `id`      | `Id`        | `b`     | 0     |
  | `columns id, naoExiste`       | `id`      | —           | —       | 1     |

  Cada caso é `{ description, dynamic, columns, headers, tasks, errors,
  errorIds, error }`. `columns` é lido **depois** da geração: o backup do
  Ruby é raso, então as colunas do snippet permanecem no relatório.
- `dynamic-attributes_golden_test.ts` — parseia o mesmo fixture, agenda e gera
  com o 4º argumento de `Project#generateReport`, comparando colunas,
  cabeçalhos, ids de tarefa e erros.

### Regras específicas

1. **Sintaxe TJP, não CLI** — `columns id, name` é lista (**sem aspas**);
   palavras-chave de relatório são minúsculas (`hidetask`, `hideresource`) e
   `hidetask plan.id = "b"` esconde a tarefa casada (o `~` ali é o operador
   NOT, não parte do id).
2. **Nome da tarefa não aparece** quando só a coluna `id` existe — o oracle
   extrai as **células de conteúdo** e intersecta com `%w[a b]`; o teste TS faz
   o mesmo filtro.
3. **Erro de sintaxe é divergência registrada** — o Ruby para no primeiro
   `no_reduce` e **aborta o processo** (`SystemExit`), então a tabela dele fica
   vazia no caso ruim; o port acumula a cascata do FSM, descarta a coluna
   inválida e gera a tabela com a lista anterior (`id`). O teste compara
   `columns` com o golden e exige a tabela íntegra.
4. **`MessageHandler` é zerado depois do `schedule()`** — o agendamento emite
   avisos (`priority_inversion`, `*_check_unsupported`) alheios ao `-A`; o
   golden guarda só os erros da geração.
5. **`interactive`** — com snippet (inclusive `""`) o relatório é marcado
   `interactive` e o Ruby escreve em `"."`; só com snippet **não vazio** há
   backup/restore, então `""` deixa o atributo marcado (verificado no 3.8.4).

## Snapshots de Extensão (Fase 14 Complemento, 14C.0.12)

As extensões do complemento (formato `json` de tabela, `Picture.to_html`,
`maxpictures`, índices do Journal, materialreport/breakdown/rdoreport…) **não
existem no TaskJuggler Ruby** — não há oracle `tj3`. A fonte de verdade é um
snapshot TS determinístico:

- `packages/core/tests/golden/extension-snapshot.ts` — monta o snapshot
  (fixture `tests/fixtures/ext/14c-rdo-budget.tjp` + probes de render com
  entradas constantes; sem timestamps/fusos no payload).
- `packages/core/tests/golden/generate_extension_golden.ts` — grava
  `reports-extensions.golden.json` (`JSON.stringify(…, null, 2)` + `\n`).
- `packages/core/tests/golden/reports-extensions_golden_test.ts` — re-gera em
  memória e compara **byte-a-byte** com o commitado.

```bash
deno task golden:generate:extensions   # regerar apenas o snapshot TS
deno task golden:generate              # ruby + extensões (encadeados)
```

Cada bloco C1–C7 deve estender `buildExtensionSnapshot()` com novos probes
(materialreport html/csv/json, breakdown, RDO, markdown) em vez de criar
outro mecanismo de comparação.
