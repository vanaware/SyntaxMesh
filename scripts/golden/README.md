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

| Arquivo | Fase | Gera | Usado por |
|---|---|---|---|
| `attributes.rb` | 3 | `attributes.golden.json` | `attributes_golden_test.ts` |
| `tjtime.rb` | 2 | `tjtime.golden.json` | `tjtime.golden.test.ts` |
| `compute_golden.rb` | 2 | `compat-fix.golden.json` | `compat_golden_test.ts` |
| `finance-mwe004.rb` | 8 | `finance-mwe004.golden.json` | `finance_golden_test.ts` |
| `finance-variations.rb` | 8 | `finance-variations.golden.json` | `finance_golden_test.ts` |

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