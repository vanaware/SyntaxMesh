# Fase 24 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-24-cli-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-24-cli.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~136 tarefas
> **Concluídas:** 0
> **Foco:** CLI `packages/cli` (porta fiel do `tj3`), `io.ts` multi-runtime, desancoramento de I/O no core, **API de execução única `core.execute` → envelope JSON** (seções `check`/`listReports`/`reports`/`freeze`/`sheet`/`man`/`help`/`version`) + modificador `stdout` na DSL (adendo `fase-24-cli-adendo.md`)

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa segue TDD.** Antes de implementar:

1. Escrever o teste que falha.
2. `deno task test` → confirmar falha correta.
3. Implementar o mínimo.
4. `deno task test` → passa.
5. `deno task check-all` → verde.
6. Commit atômico.
7. Marcar `[x]`.

E **regra zero do port** (ADR 011): o comportamento da CLI é o do `tj3` Ruby
(`docs/taskjuggler/lib/taskjuggler/apps/Tj3.rb` + `man/tj3.1`). Flags que o
core ainda não suportam **viram erro claro com âncora**, nunca implementação
parallela na CLI.

### Contexto crítico

- **A CLI é burra:** argv + FS + formatação. Toda lógica e **toda a
  orquestração do pipeline** permanecem no core (plano §3). Se precisar de
  regra de linguagem ou de encadear `parse`→`schedule`→`render` na CLI → pare,
  é do `core.execute`.
- **API de execução = envelope JSON (adendo v2, plano §5.5):** o core expõe
  `execute(request): Promise<ExecutionResult>` como **ponto único de entrada**
  das chamadas de linha de comando. O consumidor monta o `ExecutionRequest`
  (opções já traduzidas) e recebe o envelope: `ok`, `exitCode` (dado), `options`
  (eco normalizado — a CLI **não retém estado das opções**), `messages`
  estruturadas e `results` com **apenas as seções pedidas** (`check`,
  `listReports`, `reports`, `freeze`, `sheet`, `man`, `help`, `version`). A
  seção `reports` traz o contrato `ReportsJson` (ordem de declaração, flag
  `stdout`, `formats[]` com conteúdo, `errors[]` por relatório, `outputDir` só
  quando passado); o que era trabalho do core chega **processado** (dynamic
  attributes aplicados, e-mail dos sheets como texto, freeze como conteúdo).
  Imprimir com delimitador, gravar `{name}.{ext}` sanitizado, escrever
  freeze/outbox e `exit(exitCode)` é política **exclusiva da CLI**
  (`output-policy.ts`). Nada de `fs`/`process`/`console`/`exit`/argv no core.
  `.tjp` sem `stdout` ⇒ comportamento idêntico ao antigo (arquivo).
- **`src/io.ts` é o único arquivo** com `node:*` ou detecção de runtime.
- Sem `any` em `src/` — acesso ao global `Deno`/`Bun` é via interface tipada
  (plano §4.2), mesma convenção do lexer do core.
- Exit codes fiéis: apenas `0` (sucesso/`--check-syntax` OK) e `1`
  (erro de parse/relatório/warnings com `--abort-on-warnings`).
- Sem `node_modules`/`npm install`; deps via `jsr:`/`npm:` no `deno.jsonc`.
- O rename do core (`@syntaxmesh/core` → `@vanaware/syntaxmesh`) acontecerá na
  Fase 22 (depois desta). Na Fase 24, importe o core **pelo nome vigente no
  workspace** e registre em `CURRENT.md` que a CLI precisa de ajuste de import
  quando o rename ocorrer.
- ADR da fase = **034** na cadeia da ordem oficial (`plano.md`:
  23 → 24 → 22 ⇒ 033 = template, 034 = CLI, 035 = extensão VS Code). Conferir
  `decisoes/README.md` em 24.0.1.
- Commit por subfase: `docs(cli): ADR da fase`, `feat(cli): scaffold+io`,
  `feat(core): file provider`, `feat(core): stdout+reports-json`,
  `feat(core): execute-envelope`, `feat(cli): options+execute-call`,
  `feat(cli): reporter`, `feat(cli): reports-pipeline+output-policy`,
  `chore(cli): multi-runtime`, `test(cli): golden-tj3`.

### Pré-requisitos

- Fases 2–14 concluídas (parser, scheduler, financeiro, relatórios) — ✅.
- `tj3` Ruby funcional no ambiente (para os golden da subfase 24.7).
- `node` ≥ 20 e `bun` disponíveis para os smoke de 24.6 (se ausentes, marcar a
  tarefa como pendente com nota, não pular silenciosamente).

### Anti-padrões

- ❌ Importar `Deno.*` ou `process` fora de `io.ts` (tasks/flags à parte).
- ❌ Implementar resolução de `include`/macros na CLI (é do core/parser).
- ❌ Criar segunda camada de abstração de FS.
- ❌ Emitir relatório pela CLI sem passar pela seção `reports` do envelope de
  `execute` — e, simetricamente, ❌ decidir destino de saída
  (imprimir/gravar/sanitizar) no core (adendo §3.4).
- ❌ Orquestrar o pipeline (`parse`→`schedule`→`render`) ou reexaminar as
  opções no CLI — é trabalho do `core.execute`; a CLI consome o envelope.
- ❌ Imprimir relatórios no terminal sem o delimitador
  `--- <name> [<format>] ---`, ou gravar com nome não sanitizado.
- ❌ Desancorar `freeze`/`checkTimeSheet`/`checkStatusSheet` (âncoras reais das
  Fases 19/18 — permanecem).
- ❌ Aceitar flags de `--debug*`/`--freeze` silenciosamente (v1 = erro âncora).

---

## Progresso

```
[ ] 24.0  ADR da fase (0NN) + reposicionamento       —   0/7
[ ] 24.1  Scaffold do pacote + io.ts                —   0/14
[ ] 24.2  Injeção de I/O + API execute/envelope      —   0/30
[ ] 24.3  Comando Cliffy + flags + exit codes       —   0/16
[ ] 24.4  Saída no terminal (reporter + summary)    —   0/10
[ ] 24.5  Política de saída + ponta a ponta         —   0/18
[ ] 24.6  Multi-runtime + binário + README          —   0/9
[ ] 24.7  Golden CLI vs tj3 Ruby                    —   0/10
[ ] 24.8  Verificação final                         —   0/8
─────────────────────────────────────────────────────────
SUBTOTAL (1ª onda, bloqueia v1)                    ~122
[ ] 24.9  Adendo: wz man + --freeze* (Bloco I)      —   0/5
[ ] 24.10 Adendo: apps de sheets + dynamicAttr.     —   0/9
─────────────────────────────────────────────────────────
TOTAL: ~136
```

---

## Bloco A — Fundação

### 24.0 — ADR da fase (0NN) + reposicionamento

**Objetivo:** formalizar CLI multi-runtime e a nova ordem das fases.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.0.1 | Criar `docs/syntaxmesh/decisoes/0NN-cli-multiruntime.md` com frontmatter (0NN = próximo livre; 034 se a 23 criou o 033 antes) | idem | arquivo existe |
| 24.0.2 | Seção **Contexto:** CLI tj3 headless antes das Fases 19–22; requisito Deno/Bun/Node | idem | — |
| 24.0.3 | Seção **Decisões:** `packages/cli` adaptador puro; Cliffy via JSR; `io.ts` único com `node:fs/promises` (zero ramificação de FS); exit codes 0/1 fiéis a `apps/Tj3.rb`; desancoramento de `TaskJuggler.parse/parseContent` por provedor injetado; contrato de saída = modificador `stdout` na DSL + `core.renderReports(): ReportsJson`, com política de terminal/arquivo exclusiva da CLI (adendo) | idem | — |
| 24.0.4 | Seções **Alternativas** (Deno-APIs puras, `@std/cli` sozinho, abstração de storage) e **Consequências** | idem | — |
| 24.0.5 | Atualizar `decisoes/README.md` com a linha do novo ADR | idem | índice consistente |
| 24.0.6 | Confirmar a seção **Ordem de execução** do `plano.md` (23 → 24 → 21¹ → 22) e a linha da Fase 24 no resumo executivo; ajustar se divergir | `plano.md` | ordem confere |
| 24.0.7 | Atualizar `CURRENT.md`: ordem de execução oficial 15 → 16 → 17 → 18 → 23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³ | idem | revisão |

---

## Bloco B — Scaffold e fundação técnica

### 24.1 — `packages/cli` + `io.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.1.1 | Criar `packages/cli/deno.jsonc` (`name: "@vanaware/syntaxmesh-cli"`; imports: `@cliffy/command: jsr:@cliffy/command`, core pelo nome vigente; tasks `run`/`check`/`test`) | idem | `deno check` |
| 24.1.2 | Adicionar `"./packages/cli"` ao `workspace` raiz e task agregada `"cli": "deno run --allow-read --allow-write --allow-env packages/cli/src/cli.ts"` | `deno.jsonc` | `deno task` lista `cli` |
| 24.1.3 | Criar `src/io.ts`: interface de global tipada (`RuntimeGlobals`) — sem `any` — e `runtime: "deno" \| "bun" \| "node"` | idem | `deno check` |
| 24.1.4 | `args: string[]` com ramificação única `Deno.args`/`process.argv.slice(2)` | idem | 2 testes |
| 24.1.5 | `readText`/`writeText`/`exists` via `node:fs/promises` (sem ramificação) | idem | 3 testes |
| 24.1.6 | `mkpath` (recursive) e `mktemp(prefix)` via `mkdtemp(join(tmpdir(), prefix))` | idem | 2 testes |
| 24.1.7 | `exit(code)` com ramificação Deno/process + `throw unreachable` | idem | 1 teste (subprocess) |
| 24.1.8 | Reexportar `Command` do Cliffy em `io.ts` (fronteira única) | idem | `deno check` |
| 24.1.9 | Criar `tests/io_test.ts` (BDD): round-trip write/read em `mktemp`, `exists` true/false, `mkpath` recursivo, `args` injetáveis | idem | todos verdes |
| 24.1.10 | Criar `src/cli.ts` mínimo (echo de `args`, exit 0) para validar o pipeline de execução | idem | `deno task cli a b` |
| 24.1.11 | Smoke `bun run packages/cli/src/cli.ts` (se bun disponível) | — | mesma saída do Deno |
| 24.1.12 | Smoke Node: bundle rápido do `cli.ts` mínimo com o pipeline `scripts/esbuild.ts` existente e `node dist` | — | exit 0 |
| 24.1.13 | `deno task check-all` verde com o pacote novo | — | exit 0 |
| 24.1.14 | Commit `feat(cli): scaffold+io` | — | git log |

---

## Bloco C — Core: injeção de I/O + API de execução `execute` (única alteração fora da CLI)

### 24.2 — Desancoramento de `parse/parseContent` + DSL `stdout` + fachada `execute` (envelope)

**Objetivo:** a fachada recebe conteúdo de disco **por injeção** e expõe
`execute(request)` como **ponto único de entrada** das chamadas de linha de
comando, devolvendo o **envelope JSON** (eco `options`, `exitCode` como dado,
`messages` estruturadas, `results` com **só as seções pedidas**; adendo §3). O
core orquestra o pipeline por dentro, mas nunca toca em FS, nunca imprime,
nunca decide destino nem chama `exit`/lê argv (plano §5.5/§6).

**Grupo 1 — provedor de conteúdo (inalterado, sem `FileSink`):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.1 | Definir tipo `FileContentProvider = (path: string) => string \| Promise<string>` e exportar de `mod.ts` (**não** criar `FileSink` — a saída passa a ser o `ReportsJson` do adendo; apagar a referência ao sink deste plano) | `packages/core/src/taskjuggler.ts`, `mod.ts` | `deno check` |
| 24.2.2 | Teste que falha: `parse(["a.tjp"], provider)` com provider fake em Map → `project` montada | `packages/core/tests/taskjuggler_parse_test.ts` | falha correta |
| 24.2.3 | Implementar `TaskJuggler.parse(files, provider, keepParser)` portado de `TaskJuggler.rb` (substitui `NotYetImplementedError("24")`) | `taskjuggler.ts` | teste passa |
| 24.2.4 | Testes: `include` de `.tji` resolvido **relativo ao arquivo que inclui** (semântica `FileInstance`/`Dir` do Ruby); 2 fixtures aninhadas | idem | 2 testes |
| 24.2.5 | Testes: arquivo ausente → mensagem de erro fiel ao Ruby (`Cannot open ...` ou equivalente já padronizado no MessageHandler), `errors > 0`, sem throw | idem | 2 testes |
| 24.2.6 | Implementar `parseContent(content, fileName?)` com o mesmo pipeline interno | `taskjuggler.ts` | 2 testes |
| 24.2.7 | Confirmar que **não** desancorou `freeze`/`checkTimeSheet`/`checkStatusSheet` (âncoras 24/18 permanecem) | idem | grep `NotYetImplementedError` |

**Grupo 2 — parser do modificador `stdout` (adendo §2):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.8 | Registrar keyword `stdout` (token `_stdout`) no lexer/i18n — SyntaxMesh extension sem equivalente Ruby: nas tabelas pt-BR/es o keyword fica invariado (mesmo padrão de `template`, ADR da F23) | `src/i18n/en.ts`, `pt-BR.ts`, `es.ts` | `deno check` + 1 teste de token |
| 24.2.9 | Criar regra `reportStdoutFlag` com `p.optional()` + padrão `["_stdout",]` (devolve `true`; vazio devolve `false`) — espelha a opção de `optionalID` | `src/parser/rules/report.ts` | unit FSM |
| 24.2.10 | Acrescentar `!reportStdoutFlag` ao final de **todos** os `*ReportHeader` (task/resource/account/material/text/export/rdo/breakdown + aliases `md*` + timesheet/statussheet onde houver header próprio) e gravar a intenção: `rep.set("stdout", true)` quando o val casar — ausência não define a property | idem | 1 teste por tipo de relatório |
| 24.2.11 | Testes de sintaxe (adendo §2.3/§5.2): `stdout` dentro do corpo ou após as chaves ⇒ erro; `stdout stdout` (duplicata) ⇒ erro; `stdout` **não** altera validação de formatos (relatório com `stdout` + múltiplos formatos é válido) | `tests/parser/` (BDD) | ≥ 3 testes |
| 24.2.12 | Compatibilidade (adendo §5.1): suíte golden/parser atual roda inalterada com `.tjp` sem `stdout`; flag lida como `get("stdout") ?? false` | testes existentes + 1 novo | verde |
| 24.2.13 | Validação de **nome único** de relatório (adendo §3.3): duplicata ⇒ erro de validação no registro (`Project#addReport`/`checkReports`), com file:line | `model/project.ts` ou `model/report.ts` | 1 teste |

**Grupo 3 — seção `results.reports` (`renderReports` / `ReportsJson`, adendo §3):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.14 | Coleta por formato: `Report#generate()` sobrescreve `this.output` a cada formato; adicionar `outputs: Map<format, string>` preenchida num **único ponto** no loop de dispatch (antes do `return`), com normalização do CSV (Array-de-Arrays → texto `;` como `CSVFile`) e dos `null`s de formato não suportado; `output`/`outputFileName` legados intactos (UI) | `model/report.ts` | 2 testes |
| 24.2.15 | Criar módulo `src/reports/reports-json.ts`: tipos `ReportsJson`/`ReportJsonEntry`/`FormatContent` (contrato exato do adendo §3.2/§3.3, exportados no `mod.ts`) e `renderReports(project, selection?): ReportsJson` — ordem de declaração de `project.reports`, `stdout` da property, `formats[]` de `outputs`, `errors[]` por delta do `MessageHandlerInstance` (tipos `error`/`fatal`) + captura de exceções de geração (formato unknown, `NotYetImplementedError` de sheets), `ok` global | idem | `deno check` |
| 24.2.16 | Testes de contrato (adendo §5.2): múltiplos relatórios/formatos com conteúdo correto; ordem preservada; flag refletida; `errors[]` por relatório sem matar os demais; `ok: false` em falha global; `selection` (id/regex) filtra entradas mantendo o contrato | `tests/reports_json_test.ts` (BDD) | ≥ 5 testes |
| 24.2.17 | Expor `TaskJuggler.renderReports(selection?)` na fachada como **construtor reutilizável da seção `reports`** (chama o módulo com `this.project`); **não** é o ponto de entrada público — o `execute` do grupo 4 o invoca. O `generateReports(outputDir?)` permanece intacto como caminho legado da UI/Fase 20 | `taskjuggler.ts` | 1 teste |
| 24.2.18 | Pureza (adendo §5.2): teste/audit estático — nenhum acesso a `node:fs`, `Deno.*File`, `process.stdout` ou `console.log` de conteúdo de relatório no `packages/core` (padrão grep como o de `check-stubs`) | `packages/core/tests/` ou script | verde |
| 24.2.19 | Rodar suíte completa do core + goldens existentes (regressão do grupo 2 em `.tjp` sem `stdout`) | `deno task test` | verde |
| 24.2.20 | Atualizar comentários de âncora no topo de `taskjuggler.ts` (parse/parseContent: "injeção — Fase 24; storage PWA ainda Fase 19"; nota de que a intenção `stdout` é consumida só pela política da CLI) e registrar desancoramento + API em `CURRENT.md` | idem | revisão |
| 24.2.21 | Commit `feat(core): stdout+reports-json` (grupos 2–3) | — | git log |

**Grupo 4 — fachada `execute` + envelope JSON (adendo v2 §3):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.22 | Definir tipos `ExecutionRequest`/`ExecutionResult` (contrato do adendo §3.2/§3.3) e exportar de `mod.ts`: campos **semânticos** apenas (file/content/configContent/checkSyntax/listReports/report/reportsIsRegex/dynamicAttributes/outputDir/noReports/forceReports/abortOnWarnings/warnTsDeltas/addTrace/freeze/help/version/man/app/appOptions); **sem** `silent`/`noColor` (renderer-only) | `packages/core/src/execution/types.ts`, `mod.ts` | `deno check` |
| 24.2.23 | Implementar `TaskJuggler.execute(request): Promise<ExecutionResult>` portado do fluxo `apps/Tj3.rb: main()`: provedor injetado → `parse`/`parseContent` → gate `checkSyntax` → `schedule` → `checkReports` → render/operadores pontuais; sem FS, sem `exit`, sem argv | `packages/core/src/execution/execute.ts`, `taskjuggler.ts` | teste de integração 1 |
| 24.2.24 | Construção do envelope: `ok`, `options` (eco do request normalizado com defaults aplicados), `messages` (snapshot estruturado do `MessageHandlerInstance`: `severity`/`id`/`text`/`file`/`line`) e `exitCode` pela matriz do plano §5.3 (fiel a `apps/Tj3.rb`, incluindo `abortOnWarnings`/`forceReports`) | `execution/envelope.ts` | ≥ 3 testes |
| 24.2.25 | Seções sob demanda: só a pedida aparece em `results` — `check` (`{valid}`, parse sem agenda), `listReports` (`[{name,type}]` na ordem de declaração), `reports` (invoca `renderReports`; `outputDir` presente **só** quando passado), `help` (`OptionSpec[]` do core), `version` (`AppConfig`/`metadata.json`) | `execution/sections.ts` | ≥ 5 testes |
| 24.2.26 | Seções de extensão (forma do envelope + âncoras): `freeze` (`{fileName, contents}` — escrita é do consumidor; núcleo ainda ancorado Fase 24 → 24.9), `sheet` (apps F18 devolvem `emailText`/anexos via `appOptions.rawMessage`, sem SMTP/FS), `man` (doc-core F22 — âncora até 24.9). Cada uma só é preenchida quando o request a pede | `execution/sections.ts` | teste por seção (ou âncora explícita) |
| 24.2.27 | `dynamicAttributes`: `execute` aplica o pipeline 18.19 **por dentro** antes de renderizar (a partir de `request.dynamicAttributes` cru) — a seção `reports` já sai processada; a CLI não reexamina a opção | `execute.ts` (usa `Project#generateReport` 4º arg) | 1 teste |
| 24.2.28 | Pureza do `execute` (adendo §3.5/§5.2): nenhum `node:fs`/`Deno.*File`/`process`/`console`/`exit()`/argv no caminho; teste/audit dedicado; rodar suíte completa do core + goldens | `packages/core/tests/` | verde |
| 24.2.29 | Registrar em `CURRENT.md` que a fachada `execute` passou a orquestrar o pipeline interno devolvendo o envelope (eco/`exitCode`/seções) e atualizar o comentário de âncora de `taskjuggler.ts` | idem | revisão |
| 24.2.30 | Commits `feat(core): file provider` (grupo 1) e `feat(core): execute-envelope` (grupo 4) | — | git log |

---

## Bloco D — Porta de comandos

### 24.3 — Cliffy, flags → `ExecutionRequest` e consumo do envelope

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.3.1 | Teste que falha: `parseArgs(["proj.tjp"])` → `{ file: "proj.tjp" }` (função pura, sem processo) | `tests/options_test.ts`, `src/options.ts` | falha correta |
| 24.3.2 | Implementar `parseArgs(args): ExecutionRequest` cobrindo o mapa do plano §5.2: flags v1 mapeadas campo a campo para os campos semânticos do request; `--silent`/`--no-color` **não** entram no request (vão para um objeto de renderer à parte) | `src/options.ts` | 1 teste por flag |
| 24.3.3 | Flags adiadas (`--freeze*`, `--check-time-sheet`, `--check-status-sheet`, `--debug*`) → erro com mensagem `not yet available (Fase 18/19)` e exit 1 | idem | 2 testes |
| 24.3.4 | `exit` da CLI consome `result.exitCode` do envelope (função pura `resolveExit(result): 0 \| 1`; matriz testada no core em 24.2.24). Caso sem request (erro de flag do Cliffy) ⇒ exit 1 com mensagem própria | `src/cli.ts` ou `src/exit.ts` | 3 testes (forward exitCode 0/1; flag inválida sem request) |
| 24.3.5 | `src/cli.ts`: montar `defineCommand` (nome `syntaxmesh`, versão de `AppConfig`, descrição, argumento `<file.tjp>`, options do §5.2, `--version`/`--help`) | idem | `deno task cli --help` |
| 24.3.6 | **Fluxo único §5.1 (adendo v2):** argv → `parseArgs` → `ExecutionRequest` → **uma** chamada `core.execute(request)` (provedor de conteúdo = `io.readText`) → renderizar `messages` → despachar `results` pelo `output-policy.ts` (plano §5.5) → `exit(result.exitCode)`. A CLI **não** encadeia `parse`/`schedule`/`render` nem reexamina opções | `src/cli.ts` | teste de integração 1 |
| 24.3.7 | `--abort-on-warnings`, `--warn-ts-deltas`, `--add-trace`, `--force-reports`, `--no-reports` → campos do request (não ação na CLI; o core aplica no `execute`) | idem | 3 testes (mapeamento) |
| 24.3.8 | `--output-dir` → `request.outputDir`; o `outputDir` ecoado na seção `reports` é o que a política usa para gravar os `stdout: false` (semântica de barra final como no core) | idem | 1 teste |
| 24.3.9 | `--list-reports <RE>` → `request.listReports`; a CLI só imprime a seção `results.listReports` (o core já a produz sem agendar — comportamento tj3, exit 0) | idem | 2 testes |
| 24.3.10 | `--report <R>` / `--reports <RE>` → `request.report`/`reportsIsRegex`; a seção `reports` chega **filtrada** do core (plano §5.5 ponto 4). `dynamicAttributes` (`-A`) → `request.dynamicAttributes` cru; o core aplica o pipeline 18.19 internamente (24.2.27) | idem | 2 testes |
| 24.3.11 | `--config <FILE>`: a CLI lê o YAML via `io.readText` → `request.configContent`; auditar porte de `Tj3Config`/YAML no core; se incompleto, deixar âncora com erro claro e tarefa futura documentada | idem | 1 teste ou âncora |
| 24.3.12 | `--silent` e `--no-color` vão ao renderer (24.4), **não** ao request; plumbing do objeto de render | `src/cli.ts` | 1 teste |
| 24.3.13 | Integração: subprocess `deno run cli.ts` em fixture válido → exit 0; inválido → exit 1 | `tests/cli.integration_test.ts` | 2 testes |
| 24.3.14 | `deno task check-all` + testes verdes | — | exit 0 |
| 24.3.15 | Smoke Bun e Node do comando completo (1 fixture) | — | mesmo resultado |
| 24.3.16 | Commit `feat(cli): options+execute-call` | — | git log |

### 24.4 — Saída no terminal

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.4.1 | `src/reporter.ts`: consumir o array `result.messages` do envelope (estruturado: `severity`/`id`/`text`/`file`/`line`) e escrever no stdout por nível (info/warning/error), cores Cliffy ANSI (amarelo/vermelho) — a CLI **não** lê o `MessageHandlerInstance` vivo, só o eco do envelope | idem | `deno check` |
| 24.4.2 | Respeitar `--no-color` e detecção de não-TTY (sem ANSI quando pipe) | idem | 2 testes |
| 24.4.3 | `--silent`: suprimir info/progresso; manter contagem final de erros | idem | 1 teste |
| 24.4.4 | Resumo final fiel ao tj3: `X errors, Y warnings` (formato/ordem conferidos no Ruby) | idem | 2 testes |
| 24.4.5 | `src/summary.ts`: resumo do projeto (id, name, timezone, intervalo, contagens de tasks/resources/accounts e totais financeiros), lido do `project` carregado na fachada `TaskJuggler` após o `execute` (conveniência de UI; o envelope é o contrato dos *resultados* de comando) | idem | 3 testes |
| 24.4.6 | Mensagens no idioma **en** (coerente com v1 monolíngue da Fase 22; respeitar diretiva do arquivo quando o core já traduz) | idem | revisão |
| 24.4.7 | Unit: reporter com stdout espião (injetável) — sem mock global | `tests/reporter_test.ts` | 4 testes |
| 24.4.8 | Integração: saída de `mwe001` contém resumo + zero erros; fixture com erro contém localização | `tests/cli.integration_test.ts` | 2 testes |
| 24.4.9 | `check-all` verde | — | exit 0 |
| 24.4.10 | Commit `feat(cli): reporter+summary` | — | git log |

---

## Bloco E — Relatórios ponta a ponta + política de saída

### 24.5 — `output-policy.ts`: terminal vs arquivo (adendo §4)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.5.1 | Teste E2E que falha: `mwe001.tjp` completo (sem `stdout`) grava `.html` no `mktemp()` via `--output-dir` — caminho legado preservado pela política (compatibilidade, adendo §5.1) | `tests/cli.integration_test.ts` | falha correta |
| 24.5.2 | Esqueleto de `src/output-policy.ts`: **despacho das seções** do envelope pelo algoritmo do adendo §4.1 — ramo `reports` percorre `reports[].formats[]` (entrada `{ name, stdout, formats[], errors[] }`); ramos `check`/`listReports`/`help`/`version` imprimem representação estruturada; `freeze`/`sheet`/`man` têm forma definida mas produção delegada a 24.9/24.10 | `src/output-policy.ts` | `deno check` |
| 24.5.3 | Ramo terminal (`stdout: true`): imprime **todos** os formatos na ordem declarada com delimitador `--- <name> [<format>] ---`; writer injetável (testabilidade, sem mock global) | idem | ≥ 3 testes |
| 24.5.4 | Ramo arquivo (`stdout: false`): grava `{name}.{ext}` pela tabela de extensões do plano §5.5 ponto 1, com nome sanitizado (caracteres `[\\?%*:|"<>]` substituídos; nome `.` = stdout como no core); sobrescrita é o default; diretório via `io.mkpath` + `--output-dir` | idem | ≥ 3 testes |
| 24.5.5 | Política de erros (adendo §4.4): `report.errors` não-vazio ⇒ mensagem clara via `reporter.ts` + exit 1 (§5.3); `ok: false` ⇒ não prosseguir com saída parcial; caso documentado no README (24.6.5) | idem | 2 testes |
| 24.5.6 | Fixture próprio com relatórios **mistas** (`stdout` e não-`stdout`, múltiplos formatos): uma execução produz terminal + arquivos corretamente (integração do adendo §5.2) | `tests/output_policy_test.ts` + fixture `.tjp` | verde |
| 24.5.7 | Matriz de fixtures: `docs/Learning/mwe001–009` todos executam com exit 0 | idem | 9 testes |
| 24.5.8 | Matriz de erro: subset `TestSuite/Syntax/Errors/` → exit 1 + mensagem com file:line | idem | ≥ 5 testes |
| 24.5.9 | Subset `TestSuite/Scheduler/Correct/` → exit 0 | idem | ≥ 5 testes |
| 24.5.10 | `include`/`.tji` E2E: fixture com 2 níveis de include gera relatório correto | fixtures próprios | 1 teste |
| 24.5.11 | `--no-reports`: agenda sem criar arquivos nem imprimir conteúdos | idem | 1 teste |
| 24.5.12 | `--force-reports` com fixture que tem erro de schedule: renderiza/gera apesar de erros (comportamento tj3.rb:149) | idem | 1 teste |
| 24.5.13 | `--reports <regex>` gera e imprime apenas os casados; `--list-reports` os enumera | idem | 2 testes |
| 24.5.14 | Idempotência: duas execuções no mesmo diretório produzem mesmo conteúdo (tolerância p/ timestamps por normalização) | idem | 1 teste |
| 24.5.15 | Formato não suportado/unknown em relatório pedido ⇒ entrada em `reports[].errors` + exit 1, sem stack trace e sem saída parcial dos demais (ligação 24.2.15 ↔ política) | idem | 1 teste |
| 24.5.16 | **Assets auxiliares do HTML** (plano §5.5 ponto 5): `copyAuxiliaryFiles` é no-op no core (ADR 027), então a política copia `css/`, `scripts/` (wz_tooltip.js) e `icons/` para o `--output-dir` quando houver relatório `html` não-`selfcontained` | `src/output-policy.ts` + 1 teste | 1 teste |
| 24.5.17 | `check-all` + `deno test` verdes | — | exit 0 |
| 24.5.18 | Commit `feat(cli): reports-pipeline+output-policy` | — | git log |

---

## Bloco F — Distribuição

### 24.6 — Multi-runtime + binário

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.6.1 | Task `compile`: `deno compile --output syntaxmesh packages/cli/src/cli.ts` (+ permissões embutidas `--allow-read --allow-write --allow-env`) | `packages/cli/deno.jsonc` | binário roda fixture |
| 24.6.2 | Verificar tamanho do binário e ausência de dependência de runtime no `--version` | — | `< ...` |
| 24.6.3 | Bundle Node oficial: tarefa de build reaproveitando `scripts/esbuild.ts`/`esbuild.jsonc` (target node, ESM, shebang) → `packages/cli/dist/cli.js` | `scripts/` ou task local | `node dist/cli.js mwe001.tjp` exit 0 |
| 24.6.4 | Smoke Bun automatizado (quando disponível) em 1 fixture | — | exit 0 |
| 24.6.5 | Criar `packages/cli/README.md`: uso, tabela de flags, semântica do modificador `stdout` (terminal vs arquivo `{name}.{ext}`), política abortar/continuar sobre `ReportsJson` (adendo §4.4), permissões por runtime, instalação (Deno compile / bun / node bundle) | idem | revisão |
| 24.6.6 | Registrar `syntaxmesh --version` consistente com `metadata.json`/`scripts/tag-version.ts` | idem | 1 teste |
| 24.6.7 | Documentar limitação conhecida: Deno Deploy sem FS fora de escopo (plano §4.3) | README | revisão |
| 24.6.8 | `check-all` verde | — | exit 0 |
| 24.6.9 | Commit `chore(cli): multi-runtime` | — | git log |

---

## Bloco G — Fidelidade ao tj3

### 24.7 — Golden CLI vs Ruby

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.7.1 | Selecionar subset de fixtures p/ golden CLI (MWEs + ~10 Syntax/Correct + ~5 Errors) | `scripts/golden/README.md` | lista definida |
| 24.7.2 | Criar `scripts/golden/cli-tj3.rb`: roda `tj3` real sobre o subset e captura stdout/exit/paths de artefatos (geração com normalizações do pipeline existente: versão→`<VER>`, paths→`<PATH>`, float 1e-6) | idem | JSON gerado |
| 24.7.3 | Regenerar golden (`deno task golden:generate`) sem quebrar snapshots existentes | `packages/core/tests/golden/` | diff só aditivo |
| 24.7.4 | Teste TS que roda a CLI no mesmo subset e compara stdout/exit com o golden (normalizando igualmente) | `tests/golden_cli_test.ts` | verde ou divergências listadas |
| 24.7.5 | Divergências aceitas: registrar em `packages/cli/tests/golden/known_divergences.md` com justificativa e âncora (política `scripts/golden/README.md`) | idem | revisão |
| 24.7.6 | Comparar artefatos CSV/texto byte-a-byte quando houver correspondência no Ruby | idem | ≥ 2 fixtures |
| 24.7.7 | Comparar HTML com normalização DOM canônica (regra da Fase 21, adiantada p/ CLI) | idem | ≥ 1 fixture |
| 24.7.8 | Mensagens de erro: conferir localização `file:line:col` idêntica ao tj3 no subset Errors | idem | ≥ 3 casos |
| 24.7.9 | CI: job roda `golden:generate` + testes da CLI (cachear saída do `tj3`) | workflow | verde |
| 24.7.10 | Commit `test(cli): golden-tj3` | — | git log |

> Fidelidade: o golden compara o **caminho legado** (relatórios sem `stdout` ⇒
> gravação em arquivo, equivalente ao tj3). O modificador `stdout` e o
> delimitador de terminal são extensões SyntaxMesh sem contraparte Ruby —
> cobertas por 24.2.8–24.2.16 e 24.5.3/24.5.6, não pelo golden.

---

## Bloco H — Encerramento

### 24.8 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 24.8.1 | `deno task check-all` (workspace inteiro) verde | exit 0 |
| 24.8.2 | Cobertura ≥ 80% em `packages/cli/src/` | relatório |
| 24.8.3 | Todos os testes da CLI (`--filter cli` ou path) verdes | exit 0 |
| 24.8.4 | Grep final: nenhum `node:`/`Deno.`/`process.` fora de `io.ts`; nenhum `as any` em `src/` | vazio |
| 24.8.5 | ADR da fase commitado e indexado em `decisoes/README.md` | git log |
| 24.8.6 | `CURRENT.md` com "Fase 24 concluída; CLI `syntaxmesh` disponível; âncoras parse/parseContent substituídas por injeção; fachada `execute` (envelope JSON) é o ponto único de entrada das chamadas de CLI" e nota de ajuste de import p/ rename da Fase 22 | revisão |
| 24.8.7 | `plano.md` marcado com status da Fase 24 | revisão |
| 24.8.8 | Progresso deste arquivo 100% (`[x]` em tudo, contadores atualizados) | revisão |

---

## Adendo (2026-11-03 — varredura xray) — Blocos I/J (pós-v1)

Escopo registrado em `fase-24-cli.md` §5.4. Executar **depois de 24.8**, quando
F22 (`doc-core`) e F18 (sheets + dynamicAttributes + checkLevel) estiverem
verdes; são extensões, não bloqueiam a 1ª onda da Fase 21.

> **Tudo passa pelo `execute` (adendo v2):** `man`, `freeze` e os apps de sheet
> não são chamadas diretas a classes do core a partir da CLI — são **seções do
> envelope** (`results.man`, `results.freeze`, `results.sheet`). A CLI só popula
> `request.man`/`request.freeze`/`request.app`+`appOptions` e despacha a seção
> devolvida; a produção real do conteúdo é do core (doc-core F22, apps F18),
> com as formas de seção já ancoradas em 24.2.26.

### 24.9 — `wz man` + `--freeze*` (Bloco I)

| # | Tarefa | Fonte/Arquivos | Verificação |
|---|---|---|---|
| 24.9.1 | Comando Cliffy `man` com `--format html\|text\|tjp` e filtro por keyword → popula `request.man`; a CLI **só imprime/gravava seção `results.man`** devolvida pelo `execute` | `packages/cli/src/commands/man.ts` + `output-policy.ts`; core consome `@vanaware/syntaxmesh/doc-core` (F22 22.1b — tarefas C–H do `fase-22-vscode-extension-tarefas.md`; contrato fixado em 22.1b.7.8) | teste BDD por formato |
| 24.9.2 | `wz man <keyword>`: o core resolve via `TernarySearchTree`/`SyntaxReference` e devolve a documentação (`KeywordDocumentation` + exemplos `TjpExample`) na seção `man`; a CLI imprime | core — `TernarySearchTree.find(prefix, true)` (22.1b.1.5), `SyntaxReference.all/toText` (22.1b.2.7/2.10), `KeywordDocumentation.toText` (22.1b.3.16–20), `TjpExample` (22.1b.4) | ≥ 3 keywords (task/resource/report) |
| 24.9.3 | `wz man --format html` gera manual completo (`UserManual` do doc-core) como conteúdo na seção `man`; **a escrita em disco é da CLI** no `--output-dir`, o core não escreve | core — `UserManual.generate(): Record<nome, conteúdo>` (22.1b.5.6) + `css/tjmanual.css` copiado do asset (22.1b.5.2) | snapshot estrutural |
| 24.9.4 | Desancorar `TaskJuggler.freeze()` (âncora Fase 24 no core): o `execute` devolve `results.freeze` = `{ fileName, contents }`; **a reescrita do master file via `io.writeText` é da CLI** (com confirmação como no tj3) | `packages/core/src/taskjuggler.ts` + `packages/cli` | teste com fixture `.tjp` congelável |
| 24.9.5 | Flags `--freeze`, `--freeze-by-task`, `--freezedate` mapeadas para `request.freeze` (tj3 §5.2) | `options.ts` | teste de flags + exit codes |

### 24.10 — Apps de sheets + dynamicAttributes (Bloco J)

| # | Tarefa | Fonte/Arquivos | Verificação |
|---|---|---|---|
| 24.10.1 | `ts send` → `request.app="ts-send"` + `appOptions`; o core (`TimeSheetSender`) devolve `results.sheet` = `{ emailText, attachments[] }` (corpo + anexo `.tji` codificado); **a impressão do texto / escrita do `outbox/*.eml` é da CLI** (sem SMTP) | core F18 (`src/sheets/apps/`); Ruby `apps/Tj3TsSender.rb` (structure, não transporte) | teste: `emailText` contém corpo + anexo decodificável |
| 24.10.2 | `ts receive --from <file\|->` → `request.app="ts-receive"` com `appOptions.rawMessage` = texto lido pela CLI (arquivo/stdin); o core extrai anexo/processa e devolve `results.sheet`; escrita do `.tji` resultante é da CLI | core F18 (`TimeSheetReceiver`); Ruby `apps/Tj3TsReceiver.rb` | teste ponta a ponta com template round-trip |
| 24.10.3 | `ts summary` → `request.app="ts-summary"`; o core devolve `results.sheet.summaryText`/`reportText` sobre submissões (texto); CLI imprime | core F18 (`TimeSheetSummary`); Ruby `apps/Tj3TsSummary.rb` | fixture da F18 |
| 24.10.4 | `ss send` / `ss receive` → `request.app="ss-send"`/`"ss-receive"`: mesmos contratos via `results.sheet` (`StatusSheetSender/Receiver`), sem SMTP/FS no core | core F18; Ruby `apps/Tj3Ss{Sender,Receiver}.rb` | round-trip `.tji` |
| 24.10.5 | `--report <R> [--attr "..."]` (alias `-A`, fiel ao `tj3 -A`) → `request.report` + `request.dynamicAttributes` cru; **o core aplica o pipeline `parseReportAttributes`/backup-restore 18.19 por dentro do `execute`** (24.2.27, via `Project#generateReport(id, false, undefined, attrs)`) antes de renderizar; a CLI **só traduz argv** e despacha a seção `reports` pela **mesma política §5.5** do `output-policy.ts`. O backup é raso (as colunas do snippet permanecem no relatório, como no Ruby) e erro de sintaxe vira mensagem (`MessageHandler`→`messages`), sem `exit` no core | `execute.ts` → `Project#generateReport` (4º arg) | teste com coluna dinâmica |
| 24.10.6 | Usar `FileList` (16.7) para rastreio de inputs e `StdIoWrapper` (16.11) para captura de saída onde o Ruby usava | core F16 | grep: nenhuma reimplementação local |
| 24.10.7 | `check-stubs`: âncoras `Fase 24` (freeze/parse/parseFile/parseContent) presentes e nenhuma órfã | `scripts/check-stubs.ts` | verde |
| 24.10.8 | **Imagens em relatórios (13.14.3, xray §4)**: `resolveImageRef` do core devolve descritor; a CLI materializa a imagem do disco (`io.readBytes`) como data URI ou arquivo ao lado da saída. Ruby usava `URL.createObjectURL`/blob só no browser | `packages/cli/src/commands/report.ts` + `markdown/extensions/images.ts` | teste: `![x](fotos/a.jpg)` → arquivo/URI na saída |
| 24.10.9 | **Regressão `format richtext` (13.14.4)** na saída da CLI: default `richtext` para `.tjp` legados; markdown só com `format markdown` explícito (núcleo entregue na F14-C, `14C.5.1–5.12`) | F14-C / `reports/*` | golden CLI com os dois formatos |

---

## Notas para a IA

1. **Ordem:** 24.0 → 24.1 → 24.2 → 24.3 → 24.4 → 24.5 → 24.6 → 24.7 → 24.8
   (24.6 e 24.7 podem alternar).
2. **24.2 é a única tarefa que mexe no core.** Mudanças mínimas e fiéis a
   `TaskJuggler.rb`; nada de FS no core; não desancorar `freeze`/sheets. O
   pacote inclui agora o parser do modificador `stdout`, o construtor da seção
   `reports` (`renderReports`/`ReportsJson`) e a **fachada `execute` que monta o
   envelope** (adendo v2 §3) — o core produz **JSON**, nunca imprime, grava,
   chama `exit` nem lê argv.
3. **A CLI não orquestra o pipeline** (adendo v2): 24.3 traduz argv →
   `ExecutionRequest`, faz **uma** chamada `core.execute` e despacha o envelope
   (24.5). As opções já chegam processadas/ecoadas — a CLI não reexamina flags
   nem retém estado delas.
4. **Antes de 24.2.14**, auditar a saída atual do Fase 14 (ADR 027: `output`
   em memória por formato, sobrescrito a cada formato no loop de `generate()`) —
   a coleta `outputs: Map` e o `ReportsJson` reaproveitam esse mecanismo num
   único ponto de dispatch; não criar segundo pipeline de render.
5. `io.ts` é fronteira única de runtime: qualquer novo acesso a FS/process/argv
   **entra nele**, com teste.
6. Flags sem suporte viram **erro com âncora**, não silêncio.
7. Não introduzir `node_modules`; Cliffy via `jsr:` (funciona nos 3 runtimes).
8. Testes de integração rodam a CLI **in-process** (função `main(argv)`) quando
   possível; subprocess apenas onde o exit code/escrita real importa.
9. Ao fim de cada subfase: `deno task check-all` + `deno task test`
   (obrigatório pelo AGENTS.md) e commit atômico.
10. Se Bun/Node ausentes no ambiente de execução, deixar as tasks 24.1.11/12,
   24.3.15, 24.6.3/4 **pendentes com nota explícita** (política de pendências).

---

## Referências cruzadas

- `docs/syntaxmesh/fases/fase-24-cli.md` — plano desta fase (política de saída:
  §5.5).
- `docs/syntaxmesh/fases/fase-24-cli-adendo.md` — especificação da API
  `execute` (envelope JSON com seções), do modificador `stdout`, do contrato
  `ReportsJson` (seção `reports`) e das responsabilidades core/CLI (source of
  truth desta API; grupos 2–4 de 24.2 e o bloco E decorrem dela).
- `docs/taskjuggler/lib/taskjuggler/apps/Tj3.rb` — fluxo/flags/returns (fonte de
  verdade da porta de comandos).
- `docs/taskjuggler/lib/tj3.rb`, `docs/taskjuggler/man/tj3.1` — entry e flags.
- `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb` — semântica de
  `parse`/`parseFile`/include (base do desancoramento 24.2).
- `packages/core/src/taskjuggler.ts` — fachada alvo (âncoras Fase 19).
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md` (regra zero), `030`
  (pacotes), `006`/`007` (tasks/workspace), `008` (BDD).
- `scripts/golden/` — pipeline de golden tests (24.7) e política de
  normalização/`known_divergences`.
- `docs/syntaxmesh/fases/fase-22-vscode-extension.md` — consumidor futuro do
  padrão adaptador; ADR 035 da extensão (cadeia 033=template, 034=CLI, 035=VS Code).
- Cliffy: https://cliffy.io · `jsr:@cliffy/command`.

---

**Fim das tarefas da Fase 24 (CLI `packages/cli` — interface tj3 multi-runtime).**
