# Fase 24 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-24-cli-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-24-cli.md`
> **Status:** 🟨 Em andamento (24.0–24.1 ✅ · 24.2 grupos 1–5 ✅ · 24.3 ✅ · 24.4 ✅ · 24.5 ✅ · 24.6 ✅)
> **Total:** ~144 tarefas
> **Concluídas:** 95
> **Foco:** CLI `packages/cli` (porta fiel do `tj3`), `io.ts` multi-runtime, desancoramento de I/O no core, **API de execução única `core.execute` → envelope JSON** (seções `check`/`listReports`/`reports`/`freeze`/`sheet`/`man`/`help`/`version`; entrada `request.files[]` de `{ path, content }` com o fechamento de `include`s — sem provedor, eco só dos caminhos; adendo v2.1 `fase-24-cli-adendo.md`) + modificador `stdout` na DSL

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
  (opções já traduzidas + `files[]` de `{ path, content }` com o **fechamento
  completo** de `include`s — o `execute` **não** recebe provedor/callback de
  leitura, adendo v2.1) e recebe o envelope: `ok`, `exitCode` (dado), `options`
  (eco normalizado — a CLI **não** retém estado das opções; dos arquivos o eco
  traz **só os caminhos**, nunca os conteúdos), `messages`
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
- ❌ Implementar resolução de `include`/macros na CLI (é do core/parser — no
  `execute`, por *lookup* contra `request.files`).
- ❌ Passar provedor/callback de arquivo ao `execute` ou esperar os conteúdos
  dos arquivos de volta no envelope — o conteúdo entra **inline** em
  `request.files` e o eco traz só os caminhos (adendo v2.1).
- ❌ Criar segunda camada de abstração de FS.
- ❌ Emitir relatório pela CLI sem passar pela seção `reports` do envelope de
  `execute` — e, simetricamente, ❌ decidir destino de saída
  (imprimir/gravar/sanitizar) no core (adendo §3.4).
- ❌ Orquestrar o pipeline (`parse`→`schedule`→`render`) ou reexaminar as
  opções no CLI — é trabalho do `core.execute`; a CLI consome o envelope.
- ❌ Imprimir relatórios no terminal sem o delimitador
  `--- <name> [<format>] ---`, ou gravar com nome não sanitizado.
- ❌ Desancorar `freeze` (âncora Fase 24 — 24.9). `checkTimeSheet`/`checkStatusSheet` mantêm a fachada com `FileStore` para o uso passo-a-passo, mas a via `execute` recebe a folha como **conteúdo** (grupo 5, 24.2.33) — não se passa caminho+store por essa fronteira.
- ❌ Aceitar flags de `--debug*`/`--freeze` silenciosamente (v1 = erro âncora).
- ❌ Criar arquivos de projeto SyntaxMesh com extensão `.tjp`/`.tji` em material **novo** — a extensão nativa é `.smx` (decisão 2026-11-07, plano §1.6); `.tjp`/`.tji` só existem como compatibilidade aceitada pelo core (24.2.36).
- ❌ Emitir qualquer saída da ferramenta (mensagem, help, flag, template de sheet, README) que não seja em **inglês** — English-first é política da etapa atual (decisão 2026-11-07, plano §1.7, `02-principios.md`); i18n é só parsing de entrada.

---

## Progresso

```
[x] 24.0  ADR da fase (034) + reposicionamento       —   7/7  (2026-11-07)
[x] 24.1  Scaffold do pacote + io.ts                —  13/14  (2026-11-07; 24.1.11 pendente — bun ausente)
[~] 24.2  Injeção de I/O + API execute/envelope      —  35/37  (2026-11-07; grupos 1–5 ✅; 24.2.30/37 = commits pendentes)
[x] 24.3  Comando Cliffy + flags + exit codes       —  16/17  (2026-11-07; 24.3.17 commit pendente)
[x] 24.4  Saída no terminal (reporter + summary)    —   9/10  (2026-11-07; 24.4.10 commit pendente)
[x] 24.5  Política de saída + ponta a ponta         —  17/18  (2026-11-07; 24.5.18 commit pendente)
[x] 24.6  Multi-runtime + binário + README          —   7/9  (2026-11-07; 24.6.4 bun pendente, 24.6.9 commit pendente)
[x] 24.7  Golden CLI vs tj3 Ruby                    —   9/10  (2026-11-08; 24.7.10 commit pendente)
[x] 24.8  Verificação final                         —   8/8  (2026-11-08)
─────────────────────────────────────────────────────────
SUBTOTAL (1ª onda, bloqueia v1)                    ~130
[x] 24.9  Adendo: syntaxmesh man + --freeze* (Bloco I) —   5/5  (2026-11-08; `doc-core` da F22 construído na mesma sessão)
[x] 24.10 Adendo: apps de sheets + dynamicAttr.     —   9/9  (2026-11-08)
─────────────────────────────────────────────────────
TOTAL: ~144
```

---

## Bloco A — Fundação

### 24.0 — ADR da fase (034) + reposicionamento ✅ (2026-11-07)

**Objetivo:** formalizar CLI multi-runtime e a nova ordem das fases.

**Entregue:** `decisoes/034-cli-multiruntime.md` (ACEITO, 9 decisões +
5 alternativas rejeitadas + consequências), linha 034 no `decisoes/README.md`
(saiu de "Reservado"; a cadeia de reconciliação passou a 034–037),
`plano.md` §"Ordem de execução" conferido (23 → 24 → 21¹ → 22) e
`CURRENT.md` com a seção da Fase 24 reescrita no fecho da fase.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.0.1 | Criar `docs/syntaxmesh/decisoes/0NN-cli-multiruntime.md` com frontmatter (0NN = próximo livre; 034 se a 23 criou o 033 antes) | idem | arquivo existe |
| 24.0.2 | Seção **Contexto:** CLI tj3 headless antes das Fases 19–22; requisito Deno/Bun/Node | idem | — |
| 24.0.3 | Seção **Decisões:** `packages/cli` adaptador puro; Cliffy via JSR; `io.ts` único com `node:fs/promises` (zero ramificação de FS); exit codes 0/1 fiéis a `apps/Tj3.rb`; desancoramento de `TaskJuggler.parse/parseContent` por provedor injetado (**só o caminho passo-a-passo**); API de execução única `core.execute` → envelope JSON — entrada por `request.files` (`{ path, content }`, fechamento de `include`s; sem provedor/disco; conteúdos não voltam no envelope — adendo v2/v2.1) — com contrato de saída = modificador `stdout` na DSL + seção `reports` (`ReportsJson`), política de terminal/arquivo exclusiva da CLI | idem | — |
| 24.0.4 | Seções **Alternativas** (Deno-APIs puras, `@std/cli` sozinho, abstração de storage) e **Consequências** | idem | — |
| 24.0.5 | Atualizar `decisoes/README.md` com a linha do novo ADR | idem | índice consistente |
| 24.0.6 | Confirmar a seção **Ordem de execução** do `plano.md` (23 → 24 → 21¹ → 22) e a linha da Fase 24 no resumo executivo; ajustar se divergir | `plano.md` | ordem confere |
| 24.0.7 | Atualizar `CURRENT.md`: ordem de execução oficial 15 → 16 → 17 → 18 → 23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³ | idem | revisão |

---

## Bloco B — Scaffold e fundação técnica

### 24.1 — `packages/cli` + `io.ts`

**Entregue (2026-11-07):** `packages/cli/deno.jsonc` (nome
`@vanaware/syntaxmesh-cli`, Cliffy 1.3.1 via JSR, core por
`../../packages/core/mod.ts`, tasks `run`/`check`/`test`/`tests`/`compile`),
`./packages/cli` no `workspace` raiz + tasks agregadas `cli`/`cli:test`/
`cli:compile`, `src/io.ts` (fronteira única: `RuntimeGlobals` tipado — sem
`any` —, `detectRuntime`/`resolveArgs`/`isEntrypoint`, `readText`/`writeText`/
`readBytes`/`copy`/`exists`/`mkpath`/`mktemp`/`listDir`, `print`/`printerr`,
`exit` injetável e reexport de `Command` do Cliffy), `src/cli.ts` mínimo
(`main(argv)` + guarda `isEntrypoint`, um único entrypoint nos 3 runtimes) e
`tests/io_test.ts` (5 grupos BDD / 22 steps). Smoke Node via
`deno bundle --platform node` + `node dist` → mesma saída, exit 0. Notas:
(a) `readBytes` normaliza `Buffer` → `Uint8Array` (igualdade estável nos três
runtimes); (b) `exit` aceita globais injetáveis para teste, pois um `exit`
real mataria o runner; (c) **24.1.11 pendente** — `bun` não existe neste
ambiente (política de pendências, nota 10); (d) `isEntrypoint` substituiu
`import.meta.main`, que não existe em bundle Node — evita um segundo
entrypoint na 24.6.

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

**Objetivo:** a fachada passo-a-passo recebe conteúdo **por provedor
injetado** e o `execute(request)` recebe o conteúdo **inline** em
`request.files` (lista `{ path, content }` com o fechamento de `include`s,
sem provedor/disco — adendo v2.1). `execute` é o **ponto único de entrada**
das chamadas de linha de comando, devolvendo o **envelope JSON** (eco
`options` só com os caminhos dos arquivos, `exitCode` como dado,
`messages` estruturadas, `results` com **só as seções pedidas**; adendo §3). O
core orquestra o pipeline por dentro, mas nunca toca em FS, nunca imprime,
nunca decide destino nem chama `exit`/lê argv (plano §5.5/§6).

**Entregue (2026-11-07 — grupo 1, 24.2.1–24.2.7):**
`FileContentProvider` (`src/taskjuggler.ts`, reexportado por `mod.ts`),
`normalizeInputPath` (`src/execution/paths.ts` — canonicalização posix pura de
`./a/b` e `a/../b`), costura de injeção por instância (`Scanner#setFileLoader`,
`ProjectFileParser#setFileLoader`, 4º parâmetro opcional de
`FileStreamHandle`; o estático `FileStreamHandle.fileLoader` dos testes legados
permanece), `async parse(files, provider = null, keepParser = false)` — pré-carga
em `contentCache` com `open_file` fiel ao Ruby para arquivo do topo ausente,
`include` resolvido **relativo ao arquivo que inclui** e falha via
`bad_include` —, `parseContent(content, fileName?, provider?)` (buffer com nome
opcional em `inputFiles`) e `parseFile(fileName, rule)` (regra arbitrária com
`criticalParse`). Notas: (a) `parse` passou a ser **assíncrono** porque o
provedor pode ser assíncrono; provedores assíncronos só valem para os arquivos
listados (pré-carregados) — `include` descoberto durante o lexing exige
provedor **síncrono**; (b) o `execute` (grupo 4) **não** usa provedor: o
conteúdo entra inline em `request.files`; (c) `freeze`/`checkTimeSheet`/
`checkStatusSheet` seguem ancorados (24.2.7 conferido por grep); (d) testes:
`packages/core/tests/taskjuggler_parse_test.ts` (8 steps) contra o corpus real
`Include.tjp` + 7 `.tji`, regressão `tests/parser` + `tests/lexer` verde
(134 testes).

**Grupo 1 — provedor de conteúdo do caminho passo-a-passo (inalterado, sem `FileSink`; no `execute` o conteúdo entra por `request.files` — grupo 4):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.1 | Definir tipo `FileContentProvider = (path: string) => string \| Promise<string>` e exportar de `mod.ts` (**não** criar `FileSink` — a saída passa a ser o `ReportsJson` do adendo; apagar a referência ao sink deste plano; provedor só alimenta `parse`/`parseContent` passo-a-passo — o `execute` não recebe provedor, adendo v2.1) | `packages/core/src/taskjuggler.ts`, `mod.ts` | `deno check` |
| 24.2.2 | Teste que falha: `parse(["a.tjp"], provider)` com provider fake em Map → `project` montada | `packages/core/tests/taskjuggler_parse_test.ts` | falha correta |
| 24.2.3 | Implementar `TaskJuggler.parse(files, provider, keepParser)` portado de `TaskJuggler.rb` (substitui `NotYetImplementedError("24")`) | `taskjuggler.ts` | teste passa |
| 24.2.4 | Testes: `include` de `.tji` resolvido **relativo ao arquivo que inclui** (semântica `FileInstance`/`Dir` do Ruby); 2 fixtures aninhadas | idem | 2 testes |
| 24.2.5 | Testes: arquivo ausente → mensagem de erro fiel ao Ruby (`Cannot open ...` ou equivalente já padronizado no MessageHandler), `errors > 0`, sem throw | idem | 2 testes |
| 24.2.6 | Implementar `parseContent(content, fileName?)` com o mesmo pipeline interno | `taskjuggler.ts` | 2 testes |
| 24.2.7 | Confirmar que **não** desancorou `freeze`/`checkTimeSheet`/`checkStatusSheet` (âncoras 24/18 permanecem) | idem | grep `NotYetImplementedError` |

**Grupo 2 — parser do modificador `stdout` (adendo §2):**

**Entregue (2026-11-07 — grupo 2, 24.2.8–24.2.13):**
keyword `stdout` em `i18n/canonical.ts` (extensão marcada) e invariavelmente em
`pt-BR.ts`/`es.ts` (mesmo padrão de `template`); atributo
`Report#stdout` (`AttributeType.Boolean`, `inheritedFromParent=false`,
`model/attributes/report-attributes.ts`); regra `reportStdoutFlag`
(`p.optional()` + `["_stdout"]`) que marca `parser.stdoutRequested`, consumido
e zerado por `newReport` — todos os 13 cabeçalhos (`task`/`md*`/`resource`/
`material`/`account`/`text`/`trace`/`breakdown`/`rdo`/`export`/`iCal`/`niku`/
`statusSheet`/`timeSheet`) ganharam `!reportStdoutFlag` no fim do padrão, sem
repetir código de escrita. Nome de relatório duplicado agora leva
`sourceFileInfo` explícito (`report_redefinition` com `file:line`), e
`Scanner#open` aceita um **nome de buffer** opcional (usado por
`parseContent(content, fileName)`) que passa a nomear as mensagens — sem nome,
comportamento legado intacto (`""`). Testes:
`packages/core/tests/parser/rules_report_stdout_24_test.ts` (5 grupos / 22
steps) cobre token i18n, os 13 cabeçalhos + sheets, ausência lida como `false`,
posição inválida (após chaves/no corpo/duplicado), convivência com múltiplos
formatos e nome único com `file:line`. Regressão: `tests/parser` + `tests/lexer`
+ `tests/i18n` → 141 testes; `tests/reports` + `tests/model` + taskjuggler →
176 testes. Nota: `stdout` **não** é herdado de relatório-pai (cada um declara a
própria intenção); a leitura canônica é `report.get("stdout") ?? false`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.8 | Registrar keyword `stdout` (token `_stdout`) no lexer/i18n — SyntaxMesh extension sem equivalente Ruby: nas tabelas pt-BR/es o keyword fica invariado (mesmo padrão de `template`, ADR da F23) | `src/i18n/en.ts`, `pt-BR.ts`, `es.ts` | `deno check` + 1 teste de token |
| 24.2.9 | Criar regra `reportStdoutFlag` com `p.optional()` + padrão `["_stdout",]` (devolve `true`; vazio devolve `false`) — espelha a opção de `optionalID` | `src/parser/rules/report.ts` | unit FSM |
| 24.2.10 | Acrescentar `!reportStdoutFlag` ao final de **todos** os `*ReportHeader` (task/resource/account/material/text/export/rdo/breakdown + aliases `md*` + timesheet/statussheet onde houver header próprio) e gravar a intenção: `rep.set("stdout", true)` quando o val casar — ausência não define a property | idem | 1 teste por tipo de relatório |
| 24.2.11 | Testes de sintaxe (adendo §2.3/§5.2): `stdout` dentro do corpo ou após as chaves ⇒ erro; `stdout stdout` (duplicata) ⇒ erro; `stdout` **não** altera validação de formatos (relatório com `stdout` + múltiplos formatos é válido) | `tests/parser/` (BDD) | ≥ 3 testes |
| 24.2.12 | Compatibilidade (adendo §5.1): suíte golden/parser atual roda inalterada com `.tjp` sem `stdout`; flag lida como `get("stdout") ?? false` | testes existentes + 1 novo | verde |
| 24.2.13 | Validação de **nome único** de relatório (adendo §3.3): duplicata ⇒ erro de validação no registro (`Project#addReport`/`checkReports`), com file:line | `model/project.ts` ou `model/report.ts` | 1 teste |

**Grupo 3 — seção `results.reports` (`renderReports` / `ReportsJson`, adendo §3):**

**Entregue (2026-11-07 — grupo 3, 24.2.14–24.2.20):**
`Report#outputs: Map<format, string>` preenchido num **único ponto** do
`switch` de `generate()` (`outputAsText()` normaliza CSV via `CSVFile` com
separador `;`), com `outputs.clear()` no início e `output`/`outputFileName`
legados intactos. Novo módulo `src/reports/reports-json.ts` com o contrato do
adendo §3.2/§3.3 (`FormatContent`, `ReportJsonEntry`, `ReportsJson`,
`RenderReportsOptions`) e `renderReports(project, options)`: ordem de
declaração, seleção por id/regex (`Project#matchingReports`), `errors[]` por
delta do `MessageHandler` + captura de exceção **por relatório** (um formato
inválido não mata os demais), `formats[]` só quando não houve erro e `ok`
global; `outputDir` entra **apenas** quando passado. Fachada
`TaskJuggler.renderReports(options?)` delega ao módulo (`generateReports`
continua como caminho legado da UI). Testes:
`packages/core/tests/reports/reports_json_test.ts` (3 describes / 9 steps) e
auditoria de pureza `packages/core/tests/reports/purity_24_test.ts` (3 steps):
grep estático de `node:fs`/`node:process`/`process.stdout`/`Deno.*` de I/O/`console.*`
no pipeline (`model/report.ts`, `reports/**`, `execution/**`, `taskjuggler.ts`) e
allowlist `LEGACY_SINKS` verificada nos dois sentidos para o core inteiro.
O golden `attribute-definitions_golden_test.ts` ganhou `SM_EXTENSION_IDS`
(`stdout`) — o JSON do Ruby 3.8.4 permanece **intocado**, preservando a
paridade. Âncoras: `freeze` segue na Fase 24 (só a política da CLI grava o
master); `parse`/`parseContent` já recebem o texto por injeção (ADR 034).
Registro no `CURRENT.md` (bloco da Fase 24) feito na mesma etapa. Nota: 24.2.21
(commit) **não** foi executado — o harness proíbe commits sem pedido explícito.
Regressão (24.2.19): suíte completa do core `deno test -P packages/core/tests` →
**744 testes / 6459 passos**, com a única falha sendo a contagem de atributos de
relatório (`tests/attributes/report-attributes_test.ts`: 67 → 68 por causa do
`stdout`), corrigida e reconfirmada verde.

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

**Entregue (2026-11-07 — grupo 4, 24.2.22–24.2.29):**
`src/execution/types.ts` com o contrato do adendo v2.1 (dados puros,
structured-cloneáveis): `ExecutionInputFile`/`ExecutionRequest`/
`ExecutionResult`, `OptionSpec`, `ExecutionOptionsEcho`, seções
`check`/`listReports`/`reports`/`freeze`/`sheet`/`man`/`help`/`version`.
`appOptions` **não** reusa `SheetAppOptions` do F18 porque aquele tem `now`
(função) — o envelope usa `ExecutionSheetAppOptions`, só dados.
`envelope.ts`: `echoOptions` (defaults aplicados; dos arquivos só `entry` +
`files[]` de caminhos), `snapshotMessages` (`severity`/`id`/`text`/`file`/
`line`), `buildEnvelope`, `EXIT_OK`/`EXIT_ERROR`. `sections.ts`: `OPTION_SPECS`
(fonte única da seção `help` e do Cliffy do 24.3, com `deferred` para as flags
ancoradas), `checkSection`, `listReportsSection` (sem `console.log` — não usa o
`Project#listReports` legado), `reportsSection`, `helpSection` (cópias),
`versionSection` (`AppConfig`) e as formas `freezeSection`/`manSection`/
`sheetSection`. `execute.ts` porta `Tj3.rb#appMain`: `--version`/`--help`
sem projeto, `tj3_tjp_file_missing` sem arquivos, parse via provedor de
*lookup* contra `request.files` (`bad_include` quando falta), `--check-syntax`
antes da agenda, `--list-reports` antes da agenda, seções ancoradas
(`freeze`/`sheet`/`man` → mensagem `*_not_available` + exit 1, sem quebrar a
forma do envelope), `schedule` com `forceReports` como único perdão, gate de
erros do §5.5.3 e `checkReports()` antes de renderizar. `dynamicAttributes` é
aplicado **por dentro** (24.2.27) via `Project#generateReport` — a seção já sai
processada e o `Report#formats` original é restaurado.
**Isolamento (24.2.28):** `handler.reset()` por chamada, `TaskJuggler`
dedicado, `DataCache.flush()` no fim e **fila de execução por processo**
(`execute` serializa) — sem isso duas chamadas concorrentes misturavam
mensagens; o adendo §3.6 sanciona a serialização. Testes:
`tests/execution/execute_24_test.ts` (6 describes / 22 steps) cobre eco sem
vazamento de conteúdo, `structuredClone`/JSON round-trip do request e do
envelope, matriz de exit (0/1 incl. `abortOnWarnings` e parse quebrado),
seções sob demanda, ancoradas, `dynamicAttributes` e concorrência.
**Correção de contrato descoberta nesta etapa:** `formats[]` da seção passa a
sair de `Report#outputs` **depois** da geração (a lista declarada antes do
snippet `-A` divergia do que foi realmente renderizado).
`check:stubs` verde após reordenar o comentário de âncora de `freeze`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.22 | Definir tipos `ExecutionInputFile`/`ExecutionRequest`/`ExecutionResult` (contrato do adendo §3.2/§3.3 v2.1) e exportar de `mod.ts` (lib pública — adendo §3.6): tipos de **dados puros** (structured-cloneáveis, sem funções/instâncias — atravessam fronteira Worker/HTTP); `files: { path, content }[]` (fechamento completo de `include`s) + `entry?` (default `files[0].path`) e os demais campos **semânticos** apenas (configContent/checkSyntax/listReports/report/reportsIsRegex/dynamicAttributes/outputDir/noReports/forceReports/abortOnWarnings/warnTsDeltas/addTrace/freeze/help/version/man/app/appOptions); **sem** provedor/callback de arquivo e **sem** `silent`/`noColor` (renderer-only) | `packages/core/src/execution/types.ts`, `mod.ts` | `deno check` |
| 24.2.23 | Implementar `TaskJuggler.execute(request): Promise<ExecutionResult>` portado do fluxo `apps/Tj3.rb: main()`: a partir de `request.files` — `include` resolvido por *lookup* em memória contra a lista (ausente ⇒ erro de arquivo não encontrado, nunca exceção de FS; sem provedor, sem disco) → parse → gate `checkSyntax` → `schedule` → `checkReports` → render/operadores pontuais; sem FS, sem `exit`, sem argv; **abre cada chamada repondo o snapshot do `MessageHandlerInstance` e usando instância `TaskJuggler`/`DataCache` dedicada por request (isolamento por chamada — adendo §3.6, requisito p/ uso em servidor)** | `packages/core/src/execution/execute.ts`, `taskjuggler.ts` | teste de integração 1 |
| 24.2.24 | Construção do envelope: `ok`, `options` (eco do request normalizado com defaults aplicados — dos arquivos ecoa **só os caminhos**: `entry` + `path`s de `files`, nunca os conteúdos), `messages` (snapshot estruturado do `MessageHandlerInstance`: `severity`/`id`/`text`/`file`/`line`) e `exitCode` pela matriz do plano §5.3 (fiel a `apps/Tj3.rb`, incluindo `abortOnWarnings`/`forceReports`) | `execution/envelope.ts` | ≥ 3 testes |
| 24.2.25 | Seções sob demanda: só a pedida aparece em `results` — `check` (`{valid}`, parse sem agenda), `listReports` (`[{name,type}]` na ordem de declaração), `reports` (invoca `renderReports`; `outputDir` presente **só** quando passado), `help` (`OptionSpec[]` do core), `version` (`AppConfig`/`metadata.json`) | `execution/sections.ts` | ≥ 5 testes |
| 24.2.26 | Seções de extensão (forma do envelope + âncoras): `freeze` (`{fileName, contents}` — escrita é do consumidor; desancorado em 24.9.4), `sheet` (apps F18 devolvem `emailText`/anexos via `appOptions.rawMessage`, sem SMTP/FS), `man` (`{format, keywords, content, files}` — doc-core F22, desancorado em 24.9.1–3). Cada uma só é preenchida quando o request a pede | `execution/sections.ts` | teste por seção (`execute_24_test.ts`, `freeze_sheets_24_test.ts`, `output_policy_test.ts`) |
| 24.2.27 | `dynamicAttributes`: `execute` aplica o pipeline 18.19 **por dentro** antes de renderizar (a partir de `request.dynamicAttributes` cru) — a seção `reports` já sai processada; a CLI não reexamina a opção | `execute.ts` (usa `Project#generateReport` 4º arg) | 1 teste |
| 24.2.28 | Pureza e transportabilidade do `execute` (adendo §3.5/§3.6/§5.2): nenhum `node:fs`/`Deno.*File`/`process`/`console`/`exit()`/argv no caminho; teste de round-trip JSON/structured-clone do request+envelope (sem funções/instâncias) e de duas chamadas concorrentes sem vazamento de `messages`/projeto; teste/audit dedicado; rodar suíte completa do core + goldens | `packages/core/tests/` | verde |
| 24.2.29 | Registrar em `CURRENT.md` que a fachada `execute` passou a orquestrar o pipeline interno devolvendo o envelope (eco/`exitCode`/seções) e atualizar o comentário de âncora de `taskjuggler.ts` | idem | revisão |
| 24.2.30 | Commits `feat(core): file provider` (grupo 1) e `feat(core): execute-envelope` (grupo 4) | — | git log |

**Grupo 5 — refatoramento retroativo: costuras de `FileStore` injetado (fases anteriores, já "prontas") → dados como dados na fronteira do `execute`; + extensão única `.smx` (nota 2026-11-07, adendo §5.1):**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.31 | Auditar as costuras de acesso a arquivo **entregues por fases anteriores** sob o conceito de injeção: F18/ADR 037 (`SheetAppContext.fileStore`, `SheetHandlerBase#setFileStore`/`requireFileStore`, templates/outbox/`resources.json` via store); `TaskJuggler.fileStore`/`setFileStore` + `checkTimeSheet(fileName)`/`checkStatusSheet(fileName)` (implementados, leem `.tji` pelo store); `CSVFile.read` (ADR 027); hook de escrita do `XMLDocument.write` (ADR 038 §5); `ImageResolver` (ADR 026/13.14.3). Entregável: classificação por costura — **permanece no caminho passo-a-passo/PWA** vs **refatorar para dados no `execute`** — **e** checagem de que nenhuma costura emite texto fora do inglês (English-first, plano §1.7); registrada em `CURRENT.md` | `taskjuggler.ts`, `sheets/`, ADRs 026/027/037/038 | revisão |
| 24.2.32 | Refatorar os apps de sheet quando chamados pelo `execute` (24.10): o contexto recebe **dados** (conteúdos de template via `request.files`/`appOptions`, `rawMessage`) e o `run()` devolve **dados** (`emailText`, `attachments[{name,contents}]`, summaries); `requireFileStore` deixa de ser obrigatório nesse caminho — a interface `FileStore` (ADR 037) continua a servir consumidores passo-a-passo (F19/PWA) e chamadas diretas: **rebaixada, não revogada** | `sheets/apps/`, `sheet-{sender,receiver}.ts` + testes (fakeOpfs → fakes de dados) | suíte F18 verde |
| 24.2.33 | Refatorar `checkTimeSheet`/`checkStatusSheet`: API baseada em **conteúdo** (ex.: `checkTimeSheetContent(text, fileName?)`) para o `execute` (`app="check-ts"/"check-ss"` — nada de store nem FS); a versão por caminho + `FileStore` permanece para o caminho passo-a-passo; o journal compilado sai pela seção `results.sheet` (substitui o campo mutável `lastSheetReport` na via envelope) | `taskjuggler.ts`, `execution/sections.ts` | 2 testes |
| 24.2.34 | Leituras de arquivo por relatórios (`CSVFile.read`, imagens/`picture` via `ImageResolver`): no caminho `execute` **não** injetar provedor/store implícito — política v1: `path` referenciado ausente de `request.files` ⇒ mensagem de erro fiel via `MessageHandler`, suporte completo ancorado F19/passo-a-passo (imagens: consumo 24.10.8, a CLI lê o disco) | `reports/`, `markdown/extensions/images.ts` | 1 teste por costura ou âncora |
| 24.2.35 | Regressão do grupo 5: suítes F18 sheets (migração fakeOpfs→fakes de dados), goldens F17/F14, testes de contrato/round-trip + `deno task test`; aditar os ADRs — 037 ("injeção vale só no caminho passo-a-passo/PWA; na fronteira `execute` todo conteúdo entra como dado — v2.1"), 026/027/038 onde a costura aparece | idem | verde |
| 24.2.36 | **Extensão única `.smx` (decisão 2026-11-07, plano §1.6):** relaxar as três validações herdadas aceitando `.smx` junto com as extensões atuais — master `.tjp` obrigatório em `project-file-parser.ts:229` (aceitar `.smx`; msg de erro adaptada), include `.tji` obrigatório em `rules/project.ts:558` (aceitar `.smx`), e `sheet-receiver.ts` `SHEET_EXTENSION`/`INCLUSION_FILE` (gerar `.smx`; **reconhecer `.tji` por compatibilidade** — anexos em trânsito). ⚠️ ADAPTAÇÃO à regra zero (ADR 011): desvio validado do Ruby, documentado no aditamento de ADR (24.2.35) | `project-file-parser.ts`, `rules/project.ts`, `sheets/sheet-receiver.ts` + testes (`.smx` aceito; `.tjp`/`.tji` continuam; goldens intactos) | ≥ 3 testes |
| 24.2.37 | Commit `refactor(core): filestore-to-data` + `feat(core): smx-extension` (grupo 5) | — | git log |

**Grupo 5 — conclusão (2026-11-07; 24.2.31–24.2.36 ✅, commits em 24.2.30/37 pendentes).**

_Auditoria das costuras (24.2.31) — classificação:_

| Costura | Arquivo | Classificação |
|---|---|---|
| `SheetAppContext.fileStore` / `setFileStore` / `requireFileStore` | `sheets/sheet-handler-base.ts`, `sheets/apps/app-base.ts` | **permanece** (passo-a-passo/PWA); na via `execute` recebe `MemoryFileStore` semeado com `request.files` |
| `SheetHandlerBase` (templates, `outbox/`, `resources.json`, `all.smx`) | `sheets/sheet-{sender,receiver}.ts`, `time-sheet-summary.ts` | **refatorado** para dados via `runSheetAppData` (saída = `emails`/`attachments`/`files`/`log`) |
| `TaskJuggler.fileStore` + `checkTimeSheet(fileName)`/`checkStatusSheet(fileName)` | `taskjuggler.ts` | **refatorado**: API de conteúdo (`checkTimeSheetContent`) usada pelo `execute`; fachadas por caminho mantidas |
| `CSVFile.read` | `reports/csv-file.ts` | **âncora F19** preservada; `write` no-op com aviso em inglês |
| `XMLDocument.write` | `xml/xml-document.ts` | **consumidor grava**; no-op com aviso em inglês |
| `ImageResolver`/`resolveImageRef` | `markdown/extensions/images.ts` | **permanece DOM-free**; materialização é do consumidor (24.10.8) |

_English-first:_ dois avisos em português foram corrigidos — `csv_write_noop`
(`CSVFile.write`) e `xml_document_write_noop` (`XMLDocument.write`); nenhuma
outra costura emitia texto fora do inglês.

_Entregas:_ `interfaces/memory-file-store.ts` (store efêmero com
`toFiles`/`snapshot`, `list` por primeiro segmento, `write` criando pais) +
`sheets/app-data.ts` (`runSheetAppData`) → 24.2.32;
`SheetCheckResult`/`SHEET_CHECK_FAILED`/`checkTimeSheetContent`
(`taskjuggler.ts`) + `checkSheetSection`/`anchoredSheetSection`
(`execution/sections.ts`) e despacho dos apps **depois** do `schedule` em
`execution/execute.ts` → 24.2.33; política de leituras por relatório → 24.2.34;
`sheets/sheet-extensions.ts` + `parser/file-extensions.ts` (fonte única) →
24.2.36.

_Extensão única `.smx` (24.2.36):_ mestre aceita `.tjp`/`.smx`
(`illegal_extension` cita os dois), `include` aceita `.tji`/`.smx`
(`bad_include_suffix` idem), e sender/receiver/summary **gravam** `.smx`
(`all.smx`) reconhecendo `.tji`/`all.tji` na leitura — inclusive herdando o
encadeamento do `all.tji` do topo ao abrir uma pasta nova e reaproveitando
template legado sem regenerar. ADAPTAÇÃO à regra zero (ADR 011), registrada no
aditamento v2.1 do ADR 037 (e notas nos ADRs 026/027/038).

_Testes novos:_ `tests/interfaces/memory-file-store_test.ts` (9),
`tests/sheets/app-data_24_test.ts` (7), `tests/execution/sheet_check_24_test.ts`
(8), `tests/reports/file_reads_24_test.ts` (7),
`tests/parser/file-extensions_24_test.ts` (9) e os describes de extensão em
`tests/sheets/sheet-receiver_test.ts` (2); suítes F18/F17/F14 ajustadas
(`fakeOpfs` → dados e `.tji` → `.smx` onde o arquivo é **gerado**, mantendo
`.tji` como caso de compatibilidade).

_Pendência consciente da extensão (não é desta tarefa):_ `Report#generateTJP`
(`model/report.ts`) ainda **nomeia** a saída gerada como `.tjp` (quando exporta
`project`) ou `.tji`; renomear para `.smx` é decisão da política de saída
(24.5) e do golden CLI×tj3 (24.7), porque mexe em nome de arquivo, não em
validação de entrada. As três validações pedidas por 24.2.36 estão fechadas.

---

## Bloco D — Porta de comandos

### 24.3 — Cliffy, flags → `ExecutionRequest` e consumo do envelope

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.3.1 | Teste que falha: `parseArgs(["proj.tjp"])` → `{ entry: "proj.tjp" }` (função pura, sem processo) | `tests/options_test.ts`, `src/options.ts` | falha correta |
| 24.3.2 | Implementar `parseArgs(args): ExecutionRequest` cobrindo o mapa do plano §5.2: flags v1 mapeadas campo a campo para os campos semânticos do request (posicional → `entry`; `files` é montado pelo chamador, 24.3.6); `--silent`/`--no-color` **não** entram no request (vão para um objeto de renderer à parte) | `src/options.ts` | 1 teste por flag |
| 24.3.3 | Flags adiadas (`--freeze*`, `--check-time-sheet`, `--check-status-sheet`, `--debug*`) → erro com mensagem `not yet available (Fase 18/19)` e exit 1 | idem | 2 testes |
| 24.3.4 | `exit` da CLI consome `result.exitCode` do envelope (função pura `resolveExit(result): 0 \| 1`; matriz testada no core em 24.2.24). Caso sem request (erro de flag do Cliffy) ⇒ exit 1 com mensagem própria | `src/cli.ts` ou `src/exit.ts` | 3 testes (forward exitCode 0/1; flag inválida sem request) |
| 24.3.5 | `src/cli.ts`: montar `defineCommand` (nome `syntaxmesh`, versão de `AppConfig`, descrição, argumento `<file>` (`.smx`; `.tjp` por compat — decisão 2026-11-07), options do §5.2, `--version`/`--help`) | idem | `deno task cli --help` |
| 24.3.6 | **Fluxo único §5.1 (adendo v2/v2.1):** argv → `parseArgs` → a CLI lê master + incluídos (`.smx`/`.tjp`/`.tji` indifferentemente — closure de `include`s é por caminho, não por extensão) via `io.readText` e monta `request.files` (fechamento completo de `include`s; `entry` = master) → **uma** chamada `core.execute(request)` (**sem** provedor de conteúdo) → renderizar `messages` → despachar `results` pelo `output-policy.ts` (plano §5.5) → `exit(result.exitCode)`. A CLI **não** encadeia `parse`/`schedule`/`render` nem reexamina opções; os conteúdos dos arquivos **não** voltam no envelope (eco só dos caminhos) | `src/cli.ts` | teste de integração 1 |
| 24.3.7 | `--abort-on-warnings`, `--warn-ts-deltas`, `--add-trace`, `--force-reports`, `--no-reports` → campos do request (não ação na CLI; o core aplica no `execute`) | idem | 3 testes (mapeamento) |
| 24.3.8 | `--output-dir` → `request.outputDir`; o `outputDir` ecoado na seção `reports` é o que a política usa para gravar os `stdout: false` (semântica de barra final como no core) | idem | 1 teste |
| 24.3.9 | `--list-reports <RE>` → `request.listReports`; a CLI só imprime a seção `results.listReports` (o core já a produz sem agendar — comportamento tj3, exit 0) | idem | 2 testes |
| 24.3.10 | `--report <R>` / `--reports <RE>` → `request.report`/`reportsIsRegex`; a seção `reports` chega **filtrada** do core (plano §5.5 ponto 4). `dynamicAttributes` (`-A`) → `request.dynamicAttributes` cru; o core aplica o pipeline 18.19 internamente (24.2.27) | idem | 2 testes |
| 24.3.11 | `--config <FILE>`: a CLI lê o YAML via `io.readText` → `request.configContent`; auditar porte de `Tj3Config`/YAML no core; se incompleto, deixar âncora com erro claro e tarefa futura documentada | idem | 1 teste ou âncora |
| 24.3.12 | `--silent` e `--no-color` vão ao renderer (24.4), **não** ao request; plumbing do objeto de render | `src/cli.ts` | 1 teste |
| 24.3.13 | Integração: subprocess `deno run cli.ts` em fixture válido → exit 0; inválido → exit 1 | `tests/cli.integration_test.ts` | 2 testes |
| 24.3.14 | `deno task check-all` + testes verdes | — | exit 0 |
| 24.3.15 | Smoke Bun e Node do comando completo (1 fixture) | — | mesmo resultado |
| 24.3.16 | **English-first (plano §1.7, decisão 2026-11-07):** `--help`, mensagens de erro de flag e qualquer texto nativo da CLI são só em inglês; teste varre a saída do `--help` e dos erros de argv por caracteres/melodias não-inglesas (sem tradução de flags nesta etapa) | `src/cli.ts`, `src/options.ts` | 1 teste |
| 24.3.17 | Commit `feat(cli): options+execute-call` | — | git log |

#### Conclusão do 24.3 (2026-11-07) — flags, fechamento de `include`s e chamada única

_Entregas._ `src/options.ts` (tradução **pura** de `argv`, sem processo/disco):
posicional → `entry`; booleanas do §5.2 campo a campo; valores (`--config`,
`--list-reports`, `--report`/`--reports` com `reportsIsRegex`, `-A`/`--dynamic-attributes`,
`--output-dir`/`-o`, inclusive a forma inline `--flag=valor` e o `--` terminador);
`--silent`/`--no-color` saem no objeto `renderer` (nunca no request) e
`--config` vira `configFile` porque ler arquivo é I/O; `resolveExit(result): 0 | 1`
projeta o `exitCode` do envelope sem inventar sucesso (código inesperado ⇒ 1).

_Flags adiadas erram em voz alta_ (`CliUsageError` → `stderr` + exit 1):
`--freeze`/`--freeze-by-task`/`--freezedate` → `phase 24.9`,
`--check-time-sheet`/`--check-status-sheet` → `phase 24.10`,
`--debug*` → `no equivalent in the port`. O rótulo é derivado do campo
`deferred` do `OPTION_SPECS` (subfase extraída por regex) — **English-first**
(plano §1.7): o texto do core continua em português para o leitor do código, a
CLI mostra só a subfase em inglês.

_Fluxo único (§5.1)._ `src/cli.ts`: `parseArgs` → `helpText()` (só
`--help`) → `--config` lido por `io.readText` → `collectInputFiles` (master +
fechamento transitivo de `include`s, caminho canônico por `normalizeInputPath`)
→ **uma** chamada `execute(request)` → mensagens → seções → `resolveExit`.
Nada de `parse`/`schedule`/`render` encadeados na CLI.

_Fechamento de `include`s._ Novo `src/parser/include-references.ts` no core
(`includeKeywords`/`scanIncludeReferences`): leitura **estática** por linha,
comentário `#` fora de string descartado, keyword canônico **ou sinônimo
localizado** (união dos idiomas registrados — `incluir` em pt-BR/es, ADR 023) e
o primeiro literal entre aspas como caminho. Cobre as três formas da gramática
(`prologInclude`, `projectBodyInclude`, `includeFile`). No `cli.ts`,
`collectInputFiles(entry, read)` resolve cada referência contra o diretório do
arquivo que inclui, canonicaliza, deduplica (corta ciclos) e separa `missing`:
master ausente = fatal antes do `execute`; `include` ausente continua virando
`bad_include` no core (fiel ao `tj3`).

_Comando Cliffy (24.3.5)._ `buildCommand()` gera a definição a partir de
`OPTION_SPECS` (fonte única com a seção `help`), com `.name`/`.version` de
`AppConfig`, `<file>` e `--silent`/`--no-color`; `--help` sai por
`getHelp()` com ANSI removido. O **parsing** continua no `parseArgs` puro —
Cliffy é só a ajuda humana (plano §5.2, ponto 8).

_Testes._ `tests/options_test.ts` (6 describes, 20 passos),
`tests/cli_test.ts` (3 describes, 15 passos: fechamento de includes, fluxo
único in-process com E/S injetada, English-first),
`tests/cli.integration_test.ts` (4 passos por subprocesso: `mwe001` → 0,
inválida → 1 com `error:`, master `.smx` + `include` → 0, `--version` sem
arquivo) e `packages/core/tests/parser/include-references_test.ts` (7 passos).

_Verificação._ `deno test -P -A packages/cli/tests` → 14 testes / 61 passos;
`tests/parser` → 119/423; `deno task check:all`, `lint` (741 arquivos) e
`check:stubs` verdes; `deno task cli --help` lista as 18 opções em inglês.

_Pendências conscientes._ (a) 24.3.11: a leitura do YAML entra, mas a
**aplicação** depende do porte completo de `Tj3Config` (hoje só valores fixos
em `initTj3Config`) — a CLI avisa em `stderr` (`not applied yet`) e o conteúdo
viaja em `configContent`; **(update F21 1ª onda 2ª rodada, 2026-11-10 —
fechada):** novo módulo `packages/core/src/runtime-config.ts` porta
`RuntimeConfig.rb` (`sectionNode` + `configureFromSection`);
`ExecutionRequest.configObject` propaga o YAML parseado até `executeRequest`,
que aplica `_global`/`_global._log` em `MessageHandlerInstance` **após**
`handler.reset()` (mesmo seam que Ruby usa em `Tj3Daemon#initialize`);
sheet apps SMTP seguem recebendo via `appOptions.config`. O `Warning: ...
not applied yet` foi removido. Testes:
`packages/core/tests/runtime-config_test.ts` (14 passos) e
`packages/cli/tests/cli_test.ts::--config`. (b) a apresentação de mensagens
é provisória (`cli.ts`, 24.4 substitui por `reporter.ts`) e
`reports`/`freeze`/`sheet`/`man` não são despachados (24.5/24.9/24.10);
(c) 24.3.15 (smoke Bun/Node) fica pendente — `bun` não está instalado no
ambiente; o caminho de runtime já é único (`io.ts`, `node:fs/promises`).

---

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

#### Conclusão do 24.4 (2026-11-07) — reporter e resumo do projeto

_Entregas._ `src/reporter.ts`: `formatMessage` reproduz `Message#to_s` do
Ruby (`arquivo:linha: Tipo: texto`, caindo para `arquivo: Tipo:` e `Tipo:`),
`COLORS` por severidade (fatal/error vermelho, warning magenta, info azul,
debug verde) e `Reporter` com writers injetáveis (`out`/`err`). A contagem
final `X errors, Y warnings` (singular/plural correto) só aparece quando há
erro ou aviso — execução limpa fica silenciosa. `--silent` cala info/debug e
suprime o resumo, mas **mantém** avisos, erros e a contagem (semântica do
`MessageHandler`).

_Divergência consciente (24.4.1)._ O texto da tarefa pede "stdout por nível";
seguimos o Ruby (`MessageHandler` escreve em `$stderr`) e a política do
adendo §4.1/§4.2 — o **stdout** é reservado ao conteúdo dos relatórios de
`stdout: true`, então mensagens em `stdout` corromperiam a saída dos
relatórios da 24.5. `stdout` recebe só as seções pedidas (`version`/`check`/
`listReports`) e o resumo do projeto.

_Divergência consciente (24.4.4)._ O `tj3` **não** imprime linha de
totalização (varredura em `MessageHandler.rb`/`Tj3AppBase.rb`): a linha é
adaptação documentada, com a redação pedida pela tarefa e impressa apenas
quando `errors + warnings > 0`. Também **não** portamos o banner de AppConfig
do `Tj3AppBase#main` (metadados já em `--version`; banner poluiria saída
canalizada).

`src/summary.ts`: `projectSummary(project)` + `formatSummary` (identidade
`Project <id> "<name>" v<version>`, `timezone`, `period`, contagens de
tasks/resources/accounts e custo do cenário do plano formatado na moeda). O
projeto vem de `lastExecutedProject()` — conveniência in-process nova no core
(`execution/execute.ts` + `execution/mod.ts`), reposta a `null` no início de
cada `execute` e preenchida após o `parse`; **o envelope continua sendo o
contrato** (plano §5.5 ponto 9).

_Plumbing._ `io.ts` ganhou `isTty()` (Deno `stdout.isTerminal()` /
`process.stdout.isTTY`, conservador quando ausente); `cli.ts` monta o reporter
com `color: renderer.color && isTty()` — pipe nunca recebe ANSI (24.4.2).

_Testes._ `tests/reporter_test.ts` (11 passos), `tests/summary_test.ts` (6),
`describe("isTty")` em `tests/io_test.ts` (3), `tests/cli_test.ts` reescrito
para o novo contrato de streams (16 passos: mensagens em `stderr`, resumo em
`stdout`, `--silent` silenciando só info/debug) e
`tests/cli.integration_test.ts` com 4 passos por subprocesso (`mwe001` → 0
**com** resumo; inválida → 1 com `bad.smx:1: Error:` + `1 error, 0 warnings`
em `stderr` e `stdout` vazio).

_Verificação._ `deno test -P -A packages/cli/tests` → 20 testes / 85 passos;
`deno task check:all`, `lint` (745 arquivos), `check:stubs` e `fmt:check`
(794 arquivos) verdes.

_Pendências conscientes._ (a) 24.4.10 (commit) pendente — nenhum commit é
criado sem pedido explícito; (b) 24.4.6 é revisão: as mensagens do core já
são literais em inglês (i18n cobre só palavras-chave de parsing), então nada
a traduzir; (c) `sheet`/`man`/`freeze` continuam sem despacho próprio
(24.5/24.9/24.10).

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
| 24.5.10 | `include`/`.tji` E2E: fixture com 2 níveis de include gera relatório correto — a CLI monta o fechamento em `request.files` e o core resolve por *lookup* (nenhum acesso a disco no core; `path` ausente na lista ⇒ erro fiel ao `tj3`) | fixtures próprios | 1 teste |
| 24.5.11 | `--no-reports`: agenda sem criar arquivos nem imprimir conteúdos | idem | 1 teste |
| 24.5.12 | `--force-reports` com fixture que tem erro de schedule: renderiza/gera apesar de erros (comportamento tj3.rb:149) | idem | 1 teste |
| 24.5.13 | `--reports <regex>` gera e imprime apenas os casados; `--list-reports` os enumera | idem | 2 testes |
| 24.5.14 | Idempotência: duas execuções no mesmo diretório produzem mesmo conteúdo (tolerância p/ timestamps por normalização) | idem | 1 teste |
| 24.5.15 | Formato não suportado/unknown em relatório pedido ⇒ entrada em `reports[].errors` + exit 1, sem stack trace e sem saída parcial dos demais (ligação 24.2.15 ↔ política) | idem | 1 teste |
| 24.5.16 | **Assets auxiliares do HTML** (plano §5.5 ponto 5): `copyAuxiliaryFiles` é no-op no core (ADR 027), então a política copia `assets/css/`, `assets/scripts/` (wz_tooltip.js) e `assets/icons/` para o `--output-dir` quando houver relatório `html` não-`selfcontained` | `src/output-policy.ts` + 1 teste | 1 teste |
| 24.5.17 | `check-all` + `deno test` verdes | — | exit 0 |
| 24.5.18 | Commit `feat(cli): reports-pipeline+output-policy` | — | git log |

#### Conclusão do 24.5 (2026-11-07) — política de saída + ponta a ponta

_Entregas._ `src/output-policy.ts` é o **único** dono da decisão de destino:
`extensionOf` (tabela do plano §5.5 ponto 1 — `markdown→md`, `iCal→ics`,
`mspxml`/`niku→xml`, `ctags→` sem sufixo, desconhecido → só o nome),
`sanitizeFileName` (só o último segmento sobrevive, `..` e `.` descartados,
`[\\?%*:|"<>]→_`, vazio → `report`), `fileNameFor`, `delimiterFor`
(`--- <name> [<format>] ---`), `goesToStdout` (`stdout: true` **ou** nome `.`),
`dispatchReports` e `dispatchSections`. Ramo terminal imprime todos os formatos
na ordem declarada e apara **um** `\n` final (sem linha em branco extra); ramo
arquivo grava `{name}.{ext}` em `outputDir` (ou cwd), cria diretório uma vez por
pasta via `mkpath`, sobrescreve por default e sanitiza nomes aninhados.

_Aborto sem saída parcial (adendo §4.4)._ `reports[].errors` não-vazio **ou**
`ok: false` ⇒ nenhuma escrita, nenhum asset, mensagens via `onError` →
`Reporter.error` (mesmo formato `Message#to_s`, nunca silenciado) e o exit vem
do envelope. Verificado com dois testes unitários e com a fixture de formato
inexistente (exit 1, stdout vazio, zero arquivos).

_Assets do HTML (24.5.16)._ `copyAuxiliaryFiles` é no-op no core (ADR 027),
então a política copia `css/` e `icons/` (diretórios) + `scripts/wz_tooltip.js`
(arquivo isolado, porque o `scripts/` do repo guarda ferramentas de build) para
o `--output-dir` **somente** quando sai `html` de relatório não-`selfcontained`.
A origem é `<repo>/assets/` (`assetRoot()`), que guarda o payload do relatório
fora da raiz e fora de `scripts/`; o layout interno de `assets/` é **idêntico**
ao do `--output-dir` (`css/`, `icons/`, `scripts/wz_tooltip.js`), então copiar
`assets/<nome>` → `<saída>/<nome>` preserva as referências do HTML.
Para isso o core passou a expor o dado no envelope: `ReportJsonEntry` ganhou
`selfcontained: boolean` (`report.get("selfcontained") === true`) — nenhum teste
do core comparava o objeto inteiro, então o campo é aditivo.

_Dois bugs de fronteira achados pela matriz e corrigidos em `io.ts`._ (a)
`copyTree` chamava `readdir` em arquivo (`ENOTDIR`) ⇒ nova `io.isDir()` baseada
em `stat` e ramo de folha copiando direto; (b) `io.exists()` usava `access()`, que
no shim `node:fs` do Deno exige `--allow-sys` (`uid`) e quebrava **toda** a CLI
com `NotCapable` ⇒ reescrita sobre `stat` (sem permissão extra). Os testes de
`io.ts` foram ajustados para a nova função.

_Semântica de `--reports`._ O filtro casa **ids** de relatório, não nomes: o
parser gera `report1`, `report2`… quando o `.tjp` não declara id (`newReport`),
então `--reports report1` funciona e `--reports Plan` não casa nada — fiel ao
`tj3` e coberto por teste.

_Testes._ `tests/output_policy_test.ts` novo (9 `describe` / 22 passos, FS em
memória tipado), `tests/cli.integration_test.ts` com 35 passos por subprocesso:
matriz MWE001–009 (8 verdes), matriz de erros (5), matriz Scheduler/Correct
(5), `include` em 2 níveis (`.smx → .tji → sub/.tji`), `--no-reports`,
`--force-reports` (mwe004: exit 1 **com** artefatos, tj3.rb:149), `--reports`
/`--list-reports`, idempotência, formato desconhecido e assets (`css/tjreport.css`
+ `icons/task.png` no `--output-dir`).

_Divergência conhecida (não é da CLI)._ `mwe004` sai 1 no core com
`The start date (2024-08-01) of task AcSo.deliveries is before the start date
(2024-08-01) of the enclosing task.` — as datas impressas são iguais, logo a
comparação falha por resolução interna (`toSeconds`), não por dado. Fica como
`it.ignore` documentado e é item da 1ª onda da Fase 21 (reconciliação de
divergências), fora do escopo da 24.5.

_Verificação._ `deno test -P -A packages/cli/tests` → 29 testes / 137 passos (1
passo ignorado = mwe004); core `reports_json` + `execution` → 12 / 39;
`deno task check:all`, `lint` (747 arquivos), `check:stubs`, `fmt:check` (796
arquivos) verdes.

_Pendências conscientes._ (a) 24.5.18 (commit) pendente — nenhum commit sem
pedido explícito; (b) 24.5.7 fica 8/9 pelo mwe004 acima; (c) `freeze`/`sheet`
seguem com forma estável mas conteúdo delegado a 24.9/24.10 (a política só grava
`freeze` quando o core devolve `contents` não-vazio).

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

#### Conclusão do 24.6 (2026-11-07) — multi-runtime, binário e README

_Entregas._ `packages/cli/deno.jsonc` ganhou `build:node` (script
`scripts/bundle-node.ts`), `build` (compile + bundle) e o `compile` passou a
escrever em `dist/` com `--node-modules-dir=none`. `scripts/bundle-node.ts`
chama `deno bundle --platform=deno --no-check --minify` (o único bundler do
repo que resolve o import map `jsr:`/`npm:` sem `node_modules`), prepende
`#!/usr/bin/env node`, grava `dist/cli.js` + `dist/package.json`
(`{"type":"module"}`) e reporta o tamanho. `packages/cli/README.md` documenta
uso, flags, destinos `stdout` vs `{name}.{ext}`, tabela de extensões, sanitização,
política de aborto sem saída parcial, permissões por runtime, instalação e
limitações conhecidas (24.6.5/24.6.7).

_Bug real de multi-runtime encontrado pelo bundle (corrigido no core)._
`node dist/cli.js mwe001.tjp` saía 1 com `Error: Plan: Hour 24 out of range
(0 - 23)`: o ICU do Node mapeia `hour12: false` para o ciclo **h24** (meia-noite
= 24) enquanto o Deno devolvia 0, e `TjTime.fromParts` rejeita 24. `timezone.ts`
passou a usar `hourCycle: "h23"` (mais um `% 24` defensivo) com regressão em
`tests/time/timezone_test.ts` (4 casos). Exatamente o que a fase existe para
pegar — o mesmo código, dois runtimes.

_Versão única (24.6.6, ADR 040)._ `version.ts` segue o template do buildit —
declara `__APP_VERSION__` e cai em `""`; a **definitiva só existe depois do
bundle**, montada a partir do `deno.jsonc` da raiz. O barril do pacote
(`@vanaware/syntaxmesh`, via `mod.ts`) o publica como `VERSION`, e tudo deriva
daí: `AppConfig.version`, `initTj3Config` (que fixava `"0.0.0"` e sobrescrevia
tudo) e `Project.version`. Consumidores de fora importam `VERSION` de
`@vanaware/syntaxmesh` — a CLI pelo barril e o service-worker pelo subcaminho
`./version`, para não arrastar o core inteiro ao próprio bundle.

_Dentro_ do core o import é do folha, não do barril: `app-config.ts` é
dependência de quase todo o pacote, e `import ... from "./mod.ts"` ali fecha
ciclos de módulo que derrubam `sheets/apps/app-base`,
`sheets/status-sheet-sender`, `sheets/time-sheet-receiver` e
`sheets/time-sheet-sender` com `Cannot access 'SheetHandlerBase' before
initialization` (visto no gate completo, 4 falhas). `CORE_VERSION` saiu: era
alias sem consumidor.

**Nenhum teste fixa o número:** `packages/core/tests/version_test.ts` prova
`VERSION === APP_VERSION` e `AppConfig.version === VERSION`, e
`packages/cli/tests/cli_test.ts` prova `--version` = `SyntaxMesh ${VERSION}`.
Um literal ("0.0.2", "0.0.0"…) só criaria atrito no bump sem provar nada além
da derivação — foi por isso que o antigo `tests/version_test.ts` da CLI (que
também exigia `package.json`/`deno.jsonc` iguais a `VERSION`) saiu. Efeito
colateral esperado: goldens `html-xml`/`ical` e o smoke da F17 citavam `0.0.0`
— agora o smoke interpola `VERSION`,
`scripts/esbuild.jsonc#versionPaths` aponta para o arquivo real e os dois
scripts Ruby de golden leem `"version"` do `deno.jsonc` da raiz (a mesma fonte
que o buildit consome). Como o port em teste vê `""` e o oracle vê
`0.0.2-mtvrt8od`, os dois goldens neutralizam o token em `@@VER@@` (mesmo
tratamento do `DTSTAMP`): a versão definitiva só existe no bundle, então nem o
golden nem o teste tomam partido dela. Gate completo depois do ajuste (2026-11-08):
**807 testes / 6734 passos, 0 falhas**, `lint` 756 arquivos, `fmt:check` 808,
`check:stubs` OK, suíte da CLI em 33 testes.

_Distribuição medida (24.6.2)._ `deno compile` embute o layout npm do
workspace: **605 MB** por default, **349 MB** com `--node-modules-dir=none` e
**114 MB** compilado numa árvore isolada — o grafo da CLI tem só 6 pacotes npm
(`micromark`, `mdast-util-*`, `vento`, `fflate`…), o resto vem de `wrangler`/
`workerd`/`sharp` de `packages/server`. `env -i ./dist/syntaxmesh --version`
→ 0 (sem dependência de runtime). O bundle Node fica em **903 kB** e roda
`mwe001` com todos os assets (de `assets/`, copiados para `css/`, `icons/` e
`scripts/wz_tooltip.js` no destino), porque `dist/` está a três níveis da raiz
do repo.

_Testes._ A suíte do pacote fecha em **33 testes / 181 passos** (1 passo
ignorado). A distribuição foi medida à mão (bundle → shebang/ESM →
`node --version` → `node mwe001` com assets; Bun sondado e `it.ignore`); o
`distribution_test.ts` que automatizava isso foi descartado e não está no repo.

_Correção colateral na suíte (24.2). _ `TaskJuggler.checkTimeSheet`/
`checkStatusSheet` devolviam `false` em vez de lançar sem projeto desde o grupo
5 (`readSheet` → `null`). Restaurada a pré-condição `requireProject` **antes**
do `FileStore` (o teste 18.12 já exigia isso).

_Verificação._ `deno task check:all`, `lint` (751 arquivos), `check:stubs`,
`fmt:check` (801 arquivos) verdes; `deno task test` sem falhas.

_Pendências conscientes._ (a) 24.6.4 — `bun` não existe neste ambiente: o caso
fica `it.ignore` e o artefato é o mesmo ESM que o Node validou; (b) 24.6.9
(commit) pendente; (c) o binário compilado não encontra `css/`/`icons/`
(assets relativos ao módulo, que no binário aponta para o FS virtual) — o HTML
sai sem assets; empacotar assets junto ao binário fica para a tarefa de
packaging registrada na Fase 21/24.8.

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

#### Conclusão do 24.7 (2026-11-08) — golden CLI × tj3

_Entregas._ `scripts/golden/cli-tj3.rb` roda o `tj3` 3.8.4 real sobre **34
fixtures** — 8 MWEs (001–003, 005–009), 15 `Syntax/Correct`, 7 `Errors` e 4 de
paridade (`parity-csv-{accounts,balance,tasks}`, `parity-html`) — e emite um
objeto por caso com `exit`, `artifacts` (inventário relativo ordenado),
`firstMessage`, `stdout`/`stderr` residuais e, nos casos de paridade, o conteúdo
dos arquivos gerados. O subset, os critérios, as normalizações (`<PATH>` só para
`docs/`/`packages/` — `css/`, `icons/`, `scripts/` são payload do relatório) e
os comandos estão em `scripts/golden/README.md` §"Golden CLI × tj3 (Fase
24.7)" (24.7.1/24.7.2). O golden mora no pacote que o consome
(`packages/cli/tests/golden/cli-tj3.golden.json`) e é regerado pelo mesmo
`deno task golden:generate:ruby` (entrada nova em
`packages/core/tests/golden/generate_golden.ts`); o diff foi **só aditivo** —
nenhum golden pré-existente mudou (24.7.3).

_Contrato de comparação (24.7.4/6/7/8)._ `tests/golden_cli_test.ts` roda a CLI
por subprocesso em diretório temporário, um `it` por caso, e compara: (a)
`exit` exato; (b) inventário de artefatos; (c) **resíduo de stdout** — tudo o
que o `tj3` imprime além de banner/progresso, descontado o resumo de projeto da
própria CLI, tem de sair vazio (pega relatório indo para o terminal quando
deveria virar arquivo); (d) a **primeira** mensagem de erro normalizada, com
`file:line`, nos 7 fixtures de erro; (e) CSV **byte-a-byte** em 2 fixtures; (f)
HTML por **DOM canônico** em 1. Nenhum caso é desligado por `it.ignore`:
divergência aceita rebaixa o critério (`compare: "artifacts"`) e vai para o
registro.

_DOM canônico (24.7.7)._ `tests/golden/canonical-dom.ts` estabiliza (`ID\d+` →
`ID<n>`, `Created on …` → `<TS>`), descarta envelope/`<head>`/`<link>`/
`<script>`/`<style>`/comentários, emite **um token por linha** com atributos
ordenados por nome e texto com espaço colapsado; `firstDifference` aponta a
primeira linha divergente. Na fixture de paridade os dois lados fecham em **163
linhas idênticas**. Testes próprios em `canonical_dom_test.ts` (inclui `>`
dentro de atributo citado e documento sem `<body>`).

_Divergências aceitas (24.7.5)._ `packages/cli/tests/golden/known_divergences.md`
tabela D1–D9 com âncora e destino (normalização / critério mais fraco / fora do
subset), mais sete comportamentos do `tj3` que **não** são divergência. Duas
foram reescritas depois de medidas contra o oracle: D2 (`balance` — o Ruby
reinicia o índice em 1 **por lista** e acrescenta a linha `Total`; o port numera
1, 2 e não emite `Total`) e D3 (marshalling de célula CSV — `4.0` vs `4`, `""`
vs vazio, `""` vs `<Error>`, e coluna de série temporal repetindo o cabeçalho de
data).

_Quatro correções no core que só o golden achou._ (a) `Project#schedule()` podia
**não terminar**: faltava o ramo `else` de fim de laço de `Project.rb:1225` para
o caso "primeira falha de agendamento **e** nenhuma tarefa pronta"
(`Syntax/Correct/AccountReport.tjp`) — agora emite `deadlock` e sai com
"Some tasks did not fit into the project time frame". (b) `checkForLoops` usava
`Array#includes` (igualdade por **referência**) onde o Ruby usa
`path.include?([@property, atEnd])` (estrutural): o ciclo nunca era detectado e
a CLI morria com exit 1 **sem mensagem** — passou a `path.some(…)`, com o texto
`Loop ctnd. at …` de `TaskScenario.rb:642` e a origem da tarefa na mensagem.
(c) `Project` não fixava os formatos default de `Project.rb:89-92`
(`numberFormat` 1 casa, `currencyFormat` 2 casas com `,`, `timeFormat`,
`shortTimeFormat`) nem `projectids`, então toda célula numérica caía no fallback
de 2 casas do `Query#scaleValue` e o CSV saía `4.33`/`5` onde o `tj3` escreve
`4.3`/`5.0`. (d) `DurationAttribute#to_s` era um override que achatava a
distinção `Integer`/`Float` do Ruby — saiu (o `to_s` do `AttributeBase` já
espelha `get.to_s`) e o porquê ficou na doc da classe. Regressões em
`tests/model/dependency-loop_24_test.ts` e
`tests/model/project-format-defaults_24_test.ts`.

_Dois testes pré-existentes corrigidos de passagem._ (a) `scanner_test` "include
recursivo é reportado como erro" esperava que `Scanner#include` só registrasse a
mensagem; o Ruby aborta no `MessageHandler#error` e o port lança `TjError` — é o
`throw` que impede o arquivo de ser empilhado para sempre — passou a
`assertThrows`. (b) `markdown-handlers_14c` "reportlink interativo" exigia
`project=` vazio, mas o Ruby inicializa `projectid` com o **id do projeto**
(`Project.rb:93`); a expectativa virou `project=mdrep` com a âncora.

_Tarja de versão nos goldens de serialização._ `scripts/golden/ical.rb` e
`html-xml.rb` fixavam `AppConfig.version = "0.0.0"`, então regerar depois do
bump para 0.0.2 (24.6.6) reescrevia PRODID/`generated by` para trás e derrubava
13 testes. Ambos passaram a ler `PORT_VERSION` de
`packages/core/src/version.ts`; os dois goldens foram regerados e a regeneração
é **byte-idêntica** ao estado esperado. O `.html` legado que
`finance-variations.rb` grava em `packages/core/tests/golden/` continua byproduct
do pipeline: é revertido conforme a regra 5 do README.

_CI (24.7.9)._ O repo não tinha `.github/`; o workflow `CI` foi criado com Deno
vindo da `.tool-versions`, `gem install taskjuggler -v 3.8.4`, cache do golden
com chave `hashFiles('scripts/golden/cli-tj3.rb',
'packages/cli/tests/fixtures/golden/*.smx')` (mudar o port não invalida o
artefato caro), geração quando o cache erra, `git diff --exit-code` para provar
que o golden commitado é o que o oracle produz hoje e as tarjas
`check`/`lint`/`fmt:check`/`test` da CLI.

_Verificação._ `deno test packages/cli/tests/golden_cli_test.ts` → **34/34 casos
em 25 s**; `canonical_dom_test.ts` → 3 `describe` / 8 passos. Gate completo
(`deno task tests`) **exit 0**: `check:all`, `lint` (757 arquivos), `fmt:check`
(809), `lint:doc:all` e `test` → **808 testes / 6736 passos / 0 falhas / 0
ignorados** (2 passos ignorados) — as 4 falhas que existiam antes do
bloco (`html-xml` ×2, `ical` ×11 passos, `scanner` e `markdown-handlers_14c`)
estão fechadas.

_Pendências conscientes._ (a) 24.7.10 (commit) pendente — nenhum commit sem
pedido explícito; (b) a ordem de `attribute-definitions.golden.json` é a do
registro Ruby (a regeneração reproduz o arquivo byte-a-byte) e **não** é
comparada posicionalmente pelo teste, que agrupa por `id`; (c) `mwe004`,
`AccountReport` e `Leave` ficam fora do subset até a 1ª onda da Fase 21
(D7/D8/D9) — o golden avalia fidelidade de **transporte** (exit/artefatos/
stdout/mensagem), não geometria de Gantt nem conteúdo de relatório, que já têm
goldens próprios nas fases 14/15/17/18.

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

#### Conclusão do 24.8 (2026-11-08) — verificação final da 1ª onda

_Números._ `deno task tests` **exit 0** no workspace inteiro: `check:all` (por
pacote), `lint` (757 arquivos), `fmt:check` (809), `lint:doc:all` e `test` →
**808 testes / 6737 passos / 0 falhas / 0 ignorados** (2 passos ignorados). A
suíte da CLI sozinha (`deno task --cwd packages/cli test`) verde, incluindo os
34 casos do golden (24.7).

_Cobertura de `packages/cli/src` (24.8.2)._ `deno test --coverage` +
`deno coverage --include=packages/cli/src` → **92,7 % branch / 97,0 % função /
95,4 % linha** (mínimo pedido: 80 %): `cli.ts` 95,0 linha, `io.ts` 97,6,
`options.ts` 97,5, `output-policy.ts` 95,8, `reporter.ts` 89,0, `summary.ts`
96,2.

_Pureza (24.8.4)._ Grep em `packages/cli/src`: as **11** ocorrências de
`node:`/`Deno.`/`process.` estão todas em `io.ts` — é a seam de runtime
(`node:fs/promises`, `node:os`, `node:path`, `node:url` e os três acessos
`g.Deno`); **zero** `as any` em `src/`.

_ADR (24.8.5)._ `decisoes/034-cli-multiruntime.md` existe e está indexado na
tabela de `decisoes/README.md` (Aceito, 2026-11-07).

_Registro (24.8.6/7/8)._ `CURRENT.md` tem os blocos D–G com os números de cada
um e a frase de estado da fase (CLI `syntaxmesh` disponível, `parse`/
`parseContent` recebendo conteúdo por injeção, `execute` como ponto único de
entrada); `plano.md` (linha da Fase 24) saiu de "⬜ Não iniciada" para
"🟨 Em andamento — 24.0–24.8 ✅"; o bloco `## Progresso` deste arquivo foi
atualizado.

_23.7.7 fechada de passagem._ A F23 arrastava um único item pendente — o smoke
`syntaxmesh template-fixture.tjp --no-reports` exit 0 — porque a CLI não
existia. Com ela pronta, o smoke entrou em `cli.integration_test.ts` ("template
da F23 renderiza pela CLI e sai 0") sobre `templates/reports.tjp`: a
`basic.tjp` **não** serve de alvo, porque as tasks dela têm `effort` sem
`allocate` e o scheduler erra de propósito (`Task t1 has an effort but no
resource allocations`). `fase-23-template-tarefas.md` passou a 98/98 e
`plano.md` deixou de listá-la como pendente.

_Pendências conscientes._ (a) **Nenhum commit foi feito** — 24.2.30/24.2.37,
24.3.17, 24.4.10, 24.5.18, 24.6.9 e 24.7.10 seguem pendentes (commit só a
pedido explícito); o conteúdo está no worktree e no commit `5d81b81 "fase 24 em
andamento"` criado fora desta sessão. (b) 24.6.4 (Bun) continua `it.ignore` —
não existe `bun` neste ambiente. (c) Os adendos **24.9** (`syntaxmesh man`,
`--freeze*`) e **24.10** (apps de sheets + `--attr`) são a 2ª onda da fase,
explicitamente depois de 24.8.

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
> com as formas de seção já ancoradas em 24.2.26. **Pré-requisito (nota
> 2026-11-07):** as apps de sheet da F18 hoje exigem `FileStore` injetado (ADR
> 037) — a via `execute` não aceita costura de arquivo injetada; o refatoramento
> dados-como-dados sai do **grupo 5** (24.2.31–24.2.35) e a extensão `.smx` da
> tarefa 24.2.36, antes de 24.10.1–4.

### 24.9 — `syntaxmesh man` + `--freeze*` (Bloco I) ✅ (2026-11-08)

| # | Tarefa | Fonte/Arquivos | Verificação |
|---|---|---|---|
| 24.9.1 | Comando Cliffy `man` com `--format html\|text\|smx` e filtro por keyword → popula `request.man`; a CLI **só imprime/grava a seção `results.man`** devolvida pelo `execute` | `packages/cli/src/options.ts` + `output-policy.ts`; core consome `@vanaware/syntaxmesh/doc-core` (F22 22.1b — tarefas C–H do `fase-22-vscode-extension-tarefas.md`; contrato fixado em 22.1b.7.8) | ✅ teste BDD por formato (`options_test.ts`, `man_test.ts`) |
| 24.9.2 | `syntaxmesh man <keyword>`: o core resolve via `TernarySearchTree`/`SyntaxReference` e devolve a documentação (`KeywordDocumentation` + exemplos `TjpExample`) na seção `man`; a CLI imprime | core — `TernarySearchTree.find(prefix, true)` (22.1b.1.5), `SyntaxReference.all/toText` (22.1b.2.7/2.10), `KeywordDocumentation.toText` (22.1b.3.16–20), `TjpExample` (22.1b.4) | ✅ `task`/`resource`/`shift` + prefixo único + ambíguo + inexistente |
| 24.9.3 | `syntaxmesh man --format html` gera manual completo (`UserManual` do doc-core) como conteúdo na seção `man`; **a escrita em disco é da CLI** no `--output-dir`, o core não escreve | core — `UserManual.generate(): Record<nome, conteúdo>` (22.1b.5.6) + `css/tjmanual.css` copiado do asset (22.1b.5.2) | ✅ snapshot estrutural (`user-manual_test.ts`, `dispatchSections — man`) |
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

#### Conclusão do adendo Bloco J (2026-11-08) — 24.10.1–24.10.9

**24.10.1–24.10.4 — apps de sheet como subcomandos.** No Ruby cada app é um
binário (`tj3ts_sender`, `tj3ts_receiver`, `tj3ts_summary`, `tj3ss_sender`,
`tj3ss_receiver`); aqui viram `<proto> <ação>`: `ts send`, `ts receive`,
`ts summary`, `ss send`, `ss receive`, mais os `--check-time-sheet` /
`--check-status-sheet` da 1ª onda. `options.ts` traduz para `request.app` +
`request.appOptions` (`SHEET_COMMANDS`, `SHEET_BOOLEAN_FLAGS`, `SHEET_VALUE_FLAGS`)
e o **core carrega a chamada** (`execute` → `runSheetSection`) devolvendo
`results.sheet` — sem SMTP (ADR 036) e sem disco (ADR 037, `MemoryFileStore`).
A CLI imprime `reportText ?? summaryText ?? emailText` e grava o que o app criou
sob `sheetBaseDir` + `outbox/NNN-<to>.eml` por mensagem (`dispatchSheet`).

Duas decisões de fronteira, ambas para não vazar E/S para o core:

- `-d/--directory` do app é a **raiz do chamador** (`ParsedArgs.sheetDir` →
  `OutputPolicyOptions.sheetBaseDir`), **nunca** `appOptions.workingDir` — o
  `FileStore` já está enraizado lá; mandar o mesmo caminho criaria
  `dir/dir/…` no delta de arquivos.
- `-e/--enddate`, `-r/--resource`, `-f/--force`, `--hideresource`, `-i`,
  `--sheet`, `--digest` vão como dado (`endDate`, `resources`, `force`,
  `hideResource`, `intervalDuration`, `sheetContent`, `digestRecipients`).
  `--from <arquivo|->` (receivers) é lido pela CLI (`io.readText` ou
  `readStdin`, novo em `io.ts`) e chega em `appOptions.rawMessage`; `-` só é
  aceito por `ts receive`/`ss receive`.
- `--config` deixou de ser decorativo para os apps de email: a CLI parseia o
  YAML (`@std/yaml`, novo no `packages/cli/deno.jsonc`) e entrega
  `appOptions.config` — antes o arquivo era lido e descartado (24.3.11).

O eco do envelope não vaza conteúdo: `ExecutionSheetAppOptionsEcho` reduz
`files` a **caminhos** (`echoAppOptions`) e o `execute` consome o
`request.appOptions` original (foi um vazamento real, corrigido na mesma
passada).

**24.10.5 — `--report`/`-A`.** Já entregue por 24.2.27 (`options.ts` traduz,
`execute` aplica pelo 4º argumento de `Project#generateReport`); coberto por
`options_test.ts` (`-A` → `dynamicAttributes` cru),
`tests/execution/execute_24_test.ts` e o golden
`golden/dynamic-attributes_golden_test.ts` (18.19.7). Nada novo aqui.

**24.10.6 — sem reimplementação local.** `TaskJuggler.masterFile()` passou a
deleger a `FileList.masterFileWith([".tjp", ".smx"])` em vez de varrer a lista
de arquivos por conta própria (`masterFile` continua `.tjp`-only, fiel ao
Ruby); o `StdIoWrapper` da F16 segue como única captura de saída. `grep` por
leitura/varrredura duplicada não acha candidato.

**24.10.7 — âncoras.** `deno task check:stubs` verde (as âncoras da F24 em
`freeze`/`parse`/`parseFile`/`parseContent`; `freeze` já desancorada na 24.9.4).

**24.10.8 — imagens em relatórios.** Duas peças, na divisão já fixada: o core
decide **se** a referência é externa (`isExternalImageRef`, 13.14.3) e a CLI
materializa. `packages/core/src/mod.ts` passou a exportar o barril da F13
(`./markdown/mod.ts`) — o descritor não era alcançável de fora do core.
`packages/cli/src/images.ts` extrai as referências relativas (`imageRefs`) e
`dispatchReports` copia cada uma para **ao lado do relatório**, preservando o
caminho que o HTML/Markdown já cita (nada é reescrito, nenhum base64): origem
`OutputPolicyOptions.imageDir` (default `""` = cwd do chamador), destino
`dirOf(relatório) + ref`. Referências externas e caminhos com `..` ficam de
fora (adendo §4.3); origem igual ao destino não é recopiada.

O teste de integração corrigiu uma suposição errada: o `RichTextIntermediate`
emite imagem como `<object alt data type="image/jpg">` (`Element.rb:551-570`),
não `<img src>` — o extrator cobre os dois dialetos (e o `<object>` só entra
quando `type` é `image/…`, porque o mesmo elemento serve a outras mídias).

**24.10.9 — dialetos.** O núcleo já estava entregue (14C.5); o que faltava era
travar o comportamento **na saída da CLI**. `cli.integration_test.ts` usa uma
fixture com o **mesmo** `header` (`'''forte''' e **forte**`) em dois relatórios
— um sem `format` (richtext, o default dos `.tjp` legados) e outro com
`format markdown` — e compara os dois HTML: o primeiro renderiza
`<b>forte</b>` a partir de `'''…'''` e deixa `**forte**` literal; o segundo
faz o inverso (`<b>` de `**…**` e `'''forte'''` literal).

_Evidência (pós-revisão)._ `deno task check:all` ✅ · `deno task lint` 759
arquivos ✅ · `deno task fmt:check` 811 arquivos ✅ · `deno task check:stubs` ✅ ·
suíte global **819 testes / 6796 passos / 0 falhas** (21m14s) · suíte do pacote
CLI **42 testes / 230 passos** (`images_test.ts` novo: 2 describes / 12 passos) ·
integração por subprocesso **45 passos** com os dois novos casos verdes.
O composite `deno task tests` **fechou ponta a ponta** em 2026-11-08 (exit 0;
`check:all` + `lint` 780 + `fmt:check` 832 + `lint:doc:all` + `check:doccore` +
`check:stubs` + suíte **834 arquivos / 6863 passos / 0 falhas**). O
defeito pré-existente do `lint:doc:all` (task inexistente desde `00dea6d`,
1694 `missing-jsdoc` no core) foi resolvido no mesmo dia pelo **ratchet** de
`deno doc --lint` — `scripts/lint-doc.ts` + teto em
`scripts/lint-doc-baseline.json`, ADR 041.

**24.9.4/24.9.5 — freeze.** `TaskJuggler.freeze()` devolve os dois artefatos
(`<master>-header.tji` e `<master>-bookings.tji`) como **dado** em
`results.freeze.files[]`; quem grava é `dispatchFreeze`. As flags
(`--freeze`, `--freeze-by-task` — a grafia do Ruby `--freezebytask` também
entra — e `--freezedate`) acumulam em variáveis e só montam
`request.freeze` no fim, então a ordem não importa; `--freezedate` sozinho
não liga o freeze (fiel ao `Tj3.rb` l.86-106, onde só `@freeze` dispara).
Date inválida ⇒ `tj3_ivld_freeze_date` e exit 1 sem escrever nada.

**24.9.1–24.9.3 — `syntaxmesh man`.** O `doc-core` da F22 (subfase 22.1b)
não existia, então foi construído nesta mesma sessão: `TernarySearchTree`,
`SyntaxReference`, `KeywordDocumentation`, `ExampleSnippet` (`TjpExample`),
`UserManual` + capítulos em inglês e a fachada `generateMan` — tudo **puro**
(devolve dado, não escreve/lê/imprime), publicado como
`@vanaware/syntaxmesh/doc-core` e guardado por `deno task check:doccore`.

A CLI ficou com o mínimo: `syntaxmesh man [<keyword>…]` com
`--format text|html|smx` (default `text`) espalha os posicionais em
`request.man.keywords` e a política de saída imprime o texto ou grava os
arquivos do manual sob o `--output-dir` (o CSS `css/tjmanual.css` viaja **na
própria seção**, então o manual não depende de asset do lado da CLI — fecha a
dúvida que estava em aberto aqui). `--format` fora do subcomando é erro de uso.

Três divergências conscientes do `tj3man`: (a) o recorte de fonte chama-se
`smx`, não `tjp`, porque o manual só cita a extensão nova; (b) prefixo que casa
**uma única** keyword é resolvido para ela (o Ruby repassava o texto digitado e
imprimia nada); (c) a busca do Google na barra de letras ficou de fora — é
serviço externo obsoleto.

O manual gerado é verificado por teste: 184 arquivos (índice, sumário,
capítulos, 170 keywords, navegação e CSS), prosa em inglês, **nenhuma menção ao
projeto de origem** e **nenhuma citação de `.tjp`/`.tji`** — os textos vieram
do `p.doc` das regras do parser, que também foi limpo (`alertlevels`, `now`,
`markdate`, `aggregate` e o argumento de `include`).

**Verificação do adendo (2026-11-08):** `deno task test` → **834 arquivos /
6863 passos / 0 falhas** (97m46s) · `check:all` · `lint` (779 arquivos) ·
`fmt:check` (831 arquivos) · `check:doccore` · `check:stubs` — todos exit 0.
Novos testes: `docgen/man_test.ts` (16 passos), `docgen/user-manual_test.ts`
(25), `docgen/manual-examples_test.ts` (4), `execution/execute_24_test.ts`
(4, seção `man`), `cli/tests/options_test.ts` (+7) e
`cli/tests/output_policy_test.ts` (+3).

#### Revisão pós-entrega (CodeReview, 2026-11-08)

Uma revisão única sobre o diff do adendo levantou 4 avisos e 6 sugestões. Foram
corrigidos os que tocam **fidelidade ao Ruby** e **segurança de caminho**:

- **`-t/--to` do `ts summary`** alimenta **as duas** listas
  (`sheetRecipients` e `digestRecipients`), como `Tj3TsSummary.rb` l.52-57;
  `--sheet`/`--digest` continuam alvejando uma só.
- **`-f` deixou de ser capturado como `--force` de sheet**: no `tj3` é
  `--force-reports` (`Tj3.rb` l.148-151). A flag acumula (`forceRequested`) e só
  é resolvida depois do subcomando, então `syntaxmesh -f proj.smx` voltou a
  valer — antes errava com “requires a sheet app”.
- **`--version`/`--help` saem antes de tudo** (`execute.ts` **e** `cli.main`):
  o `on_tail` do `Tj3AppBase` imprime e sai **mesmo com arquivos** na linha de
  comando; antes o pipeline inteiro rodava e só então a seção era ecoada, e
  `syntaxmesh --version nope.smx` morria em `Cannot open file` em vez de
  responder 0.
- **`--check-time-sheet`/`--check-status-sheet` repetidos** são erro de uso
  (`accepts only one sheet per run`) em vez de reter a última em silêncio — o
  Ruby acumula (`@timeSheets << arg`), o envelope checa uma por vez; trocar de
  tipo continua caindo no conflito de app, que explica melhor.
- **Imagens**: `imageRefs` recusa caminho absoluto (POSIX e letra de unidade) e
  trata `..` como **segmento** (`fotos/a..b.jpg` é nome válido), então nada sai
  da raiz de imagens.
- **Freeze**: artefato vazio é **gravado**, truncando o arquivo do freeze
  anterior, como o `File.open(…, 'w')` do Ruby.
- **`outcome.aborted` é monotônico**: um despacho de relatórios bem-sucedido não
  desfaz o aborto de uma seção `sheet` que falhou.
- **`assetRoot()`** deixou de usar `URL.pathname` (percent-encoding de espaços e
  `/C:/` no Windows): `io.modulePath` usa `fileURLToPath`, com teste próprio.

Provas novas: `-f` nos dois caminhos e repetição de folha (`options_test.ts`),
`collectSheetFiles` (árvores, raiz ausente, arquivo ilegível) e `--from -` via
`readStdin` (sucesso e erro) em `cli_test.ts`, `--version`/`--help` com arquivos
no request (`execute_24_test.ts`) e o artefato vazio do freeze
(`output_policy_test.ts`).

---

## Notas para a IA

1. **Ordem:** 24.0 → 24.1 → 24.2 → 24.3 → 24.4 → 24.5 → 24.6 → 24.7 → 24.8
   (24.6 e 24.7 podem alternar).
2. **24.2 é a única tarefa que mexe no core.** Mudanças mínimas e fiéis a
   `TaskJuggler.rb`; nada de FS no core; não desancorar `freeze`/sheets. O
   pacote inclui agora o parser do modificador `stdout`, o construtor da seção
   `reports` (`renderReports`/`ReportsJson`) e a **fachada `execute` que monta o
   envelope** (adendo v2 §3) — o core produz **JSON**, nunca imprime, grava,
   chama `exit` nem lê argv. O **grupo 5 (24.2.31–35)** é o trabalho
   retroativo: refatora costuras de `FileStore` já entregues (ADR 037 —
   sheets/check* da F18) para dados-como-dados na fronteira do `execute`, sem
   criar funcionalidade nova; a **extensão única `.smx` (24.2.36)** relaxa as
   validações herdadas de extensão (plano §1.6).
3. **A CLI não orquestra o pipeline** (adendo v2/v2.1): 24.3 traduz argv →
   `ExecutionRequest` e monta `request.files` (master + `include`s lidos via
   `io.readText`), faz **uma** chamada `core.execute` (sem provedor) e despacha
   o envelope (24.5). As opções já chegam processadas/ecoadas — a CLI não
   reexamina flags nem retém estado delas; os conteúdos dos arquivos não
   voltam no envelope.
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
