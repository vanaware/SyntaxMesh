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