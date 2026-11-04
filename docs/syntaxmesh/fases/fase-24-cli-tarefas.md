# Fase 24 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-24-cli-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-24-cli.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~105 tarefas
> **Concluídas:** 0
> **Foco:** CLI `packages/cli` (porta fiel do `tj3`), `io.ts` multi-runtime, desancoramento de I/O no core

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

- **A CLI é burra:** argv + FS + formatação. Toda lógica permanece no core
  (plano §3). Se precisar de regra de linguagem na CLI → pare, é do core.
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
  `feat(core): file provider`, `feat(cli): options`, `feat(cli): reporter`,
  `feat(cli): reports-pipeline`, `chore(cli): multi-runtime`,
  `test(cli): golden-tj3`.

### Pré-requisitos

- Fases 2–14 concluídas (parser, scheduler, financeiro, relatórios) — ✅.
- `tj3` Ruby funcional no ambiente (para os golden da subfase 24.7).
- `node` ≥ 20 e `bun` disponíveis para os smoke de 24.6 (se ausentes, marcar a
  tarefa como pendente com nota, não pular silenciosamente).

### Anti-padrões

- ❌ Importar `Deno.*` ou `process` fora de `io.ts` (tasks/flags à parte).
- ❌ Implementar resolução de `include`/macros na CLI (é do core/parser).
- ❌ Criar segunda camada de abstração de FS.
- ❌ Emitir relatório pela CLI sem passar por `generateReports` do core.
- ❌ Desancorar `freeze`/`checkTimeSheet`/`checkStatusSheet` (âncoras reais das
  Fases 19/18 — permanecem).
- ❌ Aceitar flags de `--debug*`/`--freeze` silenciosamente (v1 = erro âncora).

---

## Progresso

```
[ ] 24.0  ADR da fase (0NN) + reposicionamento       —   0/7
[ ] 24.1  Scaffold do pacote + io.ts                —   0/14
[ ] 24.2  Injeção de I/O no core (desancoramento)   —   0/13
[ ] 24.3  Comando Cliffy + flags + exit codes       —   0/16
[ ] 24.4  Saída no terminal (reporter + summary)    —   0/10
[ ] 24.5  Relatórios ponta a ponta + integração     —   0/13
[ ] 24.6  Multi-runtime + binário + README          —   0/9
[ ] 24.7  Golden CLI vs tj3 Ruby                    —   0/10
[ ] 24.8  Verificação final                         —   0/8
─────────────────────────────────────────────────────────
SUBTOTAL (1ª onda, bloqueia v1)                    ~100
[ ] 24.9  Adendo: wz man + --freeze* (Bloco I)      —   0/5
[ ] 24.10 Adendo: apps de sheets + dynamicAttr.     —   0/9
─────────────────────────────────────────────────────────
TOTAL: ~114
```

---

## Bloco A — Fundação

### 24.0 — ADR da fase (0NN) + reposicionamento

**Objetivo:** formalizar CLI multi-runtime e a nova ordem das fases.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.0.1 | Criar `docs/syntaxmesh/decisoes/0NN-cli-multiruntime.md` com frontmatter (0NN = próximo livre; 034 se a 23 criou o 033 antes) | idem | arquivo existe |
| 24.0.2 | Seção **Contexto:** CLI tj3 headless antes das Fases 19–22; requisito Deno/Bun/Node | idem | — |
| 24.0.3 | Seção **Decisões:** `packages/cli` adaptador puro; Cliffy via JSR; `io.ts` único com `node:fs/promises` (zero ramificação de FS); exit codes 0/1 fiéis a `apps/Tj3.rb`; desancoramento de `TaskJuggler.parse/parseContent` por provedor injetado + `FileSink` | idem | — |
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

## Bloco C — Core: injeção de I/O (única alteração fora da CLI)

### 24.2 — Desancoramento de `TaskJuggler.parse/parseContent`

**Objetivo:** a fachada recebe conteúdo de disco **por injeção**; o core nunca
toca em FS (plano §6).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.1 | Definir tipos `FileContentProvider = (path: string) => string \| Promise<string>` e `FileSink = (path: string, contents: string) => Promise<void>` (exportar de `mod.ts`) | `packages/core/src/taskjuggler.ts`, `mod.ts` | `deno check` |
| 24.2.2 | Auditar como `generateReports` entrega conteúdos hoje (memória? stub?) e registrar o ponto de junção do `FileSink` em comentário ancorado | `packages/core/src/reports/` | revisão |
| 24.2.3 | Teste que falha: `parse(["a.tjp"], provider)` com provider fake em Map → `project` montada | `packages/core/tests/taskjuggler_parse_test.ts` | falha correta |
| 24.2.4 | Implementar `TaskJuggler.parse(files, provider, keepParser)` portado de `TaskJuggler.rb` (substitui `NotYetImplementedError("19")`) | `taskjuggler.ts` | teste passa |
| 24.2.5 | Testes: `include` de `.tji` resolvido **relativo ao arquivo que inclui** (semântica `FileInstance`/`Dir` do Ruby); 2 fixtures aninhadas | idem | 2 testes |
| 24.2.6 | Testes: arquivo ausente → mensagem de erro fiel ao Ruby (`Cannot open ...` ou equivalente já padronizado no MessageHandler), `errors > 0`, sem throw | idem | 2 testes |
| 24.2.7 | Implementar `parseContent(content, fileName?)` com o mesmo pipeline interno | `taskjuggler.ts` | 2 testes |
| 24.2.8 | Ligar `FileSink` em `generateReports`/`generateReport` (assinatura aceita sink; comportamento sem sink = atual preservado p/ UI) | `taskjuggler.ts`, `reports/` | 3 testes |
| 24.2.9 | Confirmar que **não** desancorou `freeze`/`checkTimeSheet`/`checkStatusSheet` (âncoras 19/18 permanecem) | idem | grep `NotYetImplementedError` |
| 24.2.10 | Rodar suíte completa do core + golden existente para checar regressão | `deno task test` | verde |
| 24.2.11 | Atualizar comentários de âncora no topo de `taskjuggler.ts` (parse/parseContent: "Fase 24 — injeção; storage PWA ainda Fase 19") | idem | revisão |
| 24.2.12 | Registrar desancoramento em `CURRENT.md` | idem | revisão |
| 24.2.13 | Commit `feat(core): file provider + report sink` | — | git log |

---

## Bloco D — Porta de comandos

### 24.3 — Cliffy, flags e exit codes

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.3.1 | Teste que falha: `parseArgs(["proj.tjp"])` → `{ file: "proj.tjp" }` (função pura, sem processo) | `tests/options_test.ts`, `src/options.ts` | falha correta |
| 24.3.2 | Implementar `Tj3Options` (interface) + `parseArgs(args)` cobrindo o mapa do plano §5.2: flags v1 completas | `src/options.ts` | 1 teste por flag |
| 24.3.3 | Flags adiadas (`--freeze*`, `--check-time-sheet`, `--check-status-sheet`, `--debug*`) → erro com mensagem `not yet available (Fase 18/19)` e exit 1 | idem | 2 testes |
| 24.3.4 | Matriz de exit codes (plano §5.3) como função pura `computeExit(result): 0 \| 1` | `src/options.ts` ou `src/exit.ts` | 6 testes (sucesso, parse err, report err, check-syntax OK, abort-on-warnings, force-reports) |
| 24.3.5 | `src/cli.ts`: montar `defineCommand` (nome `syntaxmesh`, versão de `AppConfig`, descrição, argumento `<file.tjp>`, options do §5.2, `--version`/`--help`) | idem | `deno task cli --help` |
| 24.3.6 | Pipeline §5.1: read via `io.readText` → provider injetado → `parse` → gate `--check-syntax` → `schedule` → gate de erros → `generateReports` (com `--no-reports`/`--force-reports`) | `src/cli.ts` | teste de integração 1 |
| 24.3.7 | Aplicar `--abort-on-warnings`, `--warn-ts-deltas`, `--add-trace` na fachada antes de gerar | idem | 3 testes |
| 24.3.8 | `--output-dir` → `generateReports(outputDir)` (semântica de barra final como no core) | idem | 1 teste |
| 24.3.9 | `--list-reports <RE>` → `listReports(re, regExpMode)`; saída no terminal; exit 0 sem agendar (comportamento tj3) | idem | 2 testes |
| 24.3.10 | `--report <R> <PID>` / `--reports <RE> <PID>` → `generateReport(id, false/true)` | idem | 2 testes |
| 24.3.11 | `--config <FILE>`: auditar porte de `Tj3Config`/YAML no core; se incompleto, deixar âncora com erro claro e tarefa futura documentada | idem | 1 teste ou âncora |
| 24.3.12 | `--silent` e `--no-color` plumbing (para o 24.4) | `src/cli.ts` | 1 teste |
| 24.3.13 | Integração: subprocess `deno run cli.ts` em fixture válido → exit 0; inválido → exit 1 | `tests/cli.integration_test.ts` | 2 testes |
| 24.3.14 | `deno task check-all` + testes verdes | — | exit 0 |
| 24.3.15 | Smoke Bun e Node do comando completo (1 fixture) | — | mesmo resultado |
| 24.3.16 | Commit `feat(cli): options+pipeline` | — | git log |

### 24.4 — Saída no terminal

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.4.1 | `src/reporter.ts`: consumir `MessageHandlerInstance` e escrever no stdout por nível (info/warning/error), cores Cliffy ANSI (amarelo/vermelho) | idem | `deno check` |
| 24.4.2 | Respeitar `--no-color` e detecção de não-TTY (sem ANSI quando pipe) | idem | 2 testes |
| 24.4.3 | `--silent`: suprimir info/progresso; manter contagem final de erros | idem | 1 teste |
| 24.4.4 | Resumo final fiel ao tj3: `X errors, Y warnings` (formato/ordem conferidos no Ruby) | idem | 2 testes |
| 24.4.5 | `src/summary.ts`: resumo do projeto (id, name, timezone, intervalo, contagens de tasks/resources/accounts e totais financeiros) | idem | 3 testes |
| 24.4.6 | Mensagens no idioma **en** (coerente com v1 monolíngue da Fase 22; respeitar diretiva do arquivo quando o core já traduz) | idem | revisão |
| 24.4.7 | Unit: reporter com stdout espião (injetável) — sem mock global | `tests/reporter_test.ts` | 4 testes |
| 24.4.8 | Integração: saída de `mwe001` contém resumo + zero erros; fixture com erro contém localização | `tests/cli.integration_test.ts` | 2 testes |
| 24.4.9 | `check-all` verde | — | exit 0 |
| 24.4.10 | Commit `feat(cli): reporter+summary` | — | git log |

---

## Bloco E — Relatórios ponta a ponta

### 24.5 — Geração de arquivos reais

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.5.1 | Teste E2E que falha: rodar `mwe001.tjp` completo; asserts: `.html` gerados no `mktemp()` com `--output-dir` | `tests/cli.integration_test.ts` | falha correta |
| 24.5.2 | Confirmar escrita via `FileSink` de 24.2 funcionando para todos os tipos de relatório declarados no fixture | — | arquivo no disco |
| 24.5.3 | Teste: relatórios com recursos associados (CSS/JS/imagens do Fase 14) são copiados pelo sink | fixture apropriado | 1 teste |
| 24.5.4 | Matriz de fixtures: `docs/Learning/mwe001–009` todos executam com exit 0 | idem | 9 testes |
| 24.5.5 | Matriz de erro: subset `TestSuite/Syntax/Errors/` → exit 1 + mensagem com file:line | idem | ≥ 5 testes |
| 24.5.6 | Subset `TestSuite/Scheduler/Correct/` → exit 0 | idem | ≥ 5 testes |
| 24.5.7 | `include`/`.tji` E2E: fixture com 2 níveis de include gera relatório correto | fixtures próprios | 1 teste |
| 24.5.8 | `--no-reports`: agenda sem criar arquivos | idem | 1 teste |
| 24.5.9 | `--force-reports` com fixture que tem erro de schedule: gera apesar de erros (comportamento tj3.rb:149) | idem | 1 teste |
| 24.5.10 | `--reports <regex>` gera apenas casados; `--list-reports` os enumera | idem | 2 testes |
| 24.5.11 | Idempotência: duas execuções no mesmo diretório produzem mesmo conteúdo (tolerância p/ timestamps por normalização) | idem | 1 teste |
| 24.5.12 | `check-all` + `deno test` verdes | — | exit 0 |
| 24.5.13 | Commit `feat(cli): reports-pipeline` | — | git log |

---

## Bloco F — Distribuição

### 24.6 — Multi-runtime + binário

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.6.1 | Task `compile`: `deno compile --output syntaxmesh packages/cli/src/cli.ts` (+ permissões embutidas `--allow-read --allow-write --allow-env`) | `packages/cli/deno.jsonc` | binário roda fixture |
| 24.6.2 | Verificar tamanho do binário e ausência de dependência de runtime no `--version` | — | `< ...` |
| 24.6.3 | Bundle Node oficial: tarefa de build reaproveitando `scripts/esbuild.ts`/`esbuild.jsonc` (target node, ESM, shebang) → `packages/cli/dist/cli.js` | `scripts/` ou task local | `node dist/cli.js mwe001.tjp` exit 0 |
| 24.6.4 | Smoke Bun automatizado (quando disponível) em 1 fixture | — | exit 0 |
| 24.6.5 | Criar `packages/cli/README.md`: uso, tabela de flags, permissões por runtime, instalação (Deno compile / bun / node bundle) | idem | revisão |
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
| 24.8.6 | `CURRENT.md` com "Fase 24 concluída; CLI `syntaxmesh` disponível; âncoras parse/parseContent substituídas por injeção" e nota de ajuste de import p/ rename da Fase 22 | revisão |
| 24.8.7 | `plano.md` marcado com status da Fase 24 | revisão |
| 24.8.8 | Progresso deste arquivo 100% (`[x]` em tudo, contadores atualizados) | revisão |

---

## Adendo (2026-11-03 — varredura xray) — Blocos I/J (pós-v1)

Escopo registrado em `fase-24-cli.md` §5.4. Executar **depois de 24.8**, quando
F22 (`doc-core`) e F18 (sheets + dynamicAttributes + checkLevel) estiverem
verdes; são extensões, não bloqueiam a 1ª onda da Fase 21.

### 24.9 — `wz man` + `--freeze*` (Bloco I)

| # | Tarefa | Fonte/Arquivos | Verificação |
|---|---|---|---|
| 24.9.1 | Comando Cliffy `man` com `--format html\|text\|tjp` e filtro por keyword | `packages/cli/src/commands/man.ts`; consome `@vanaware/syntaxmesh/doc-core` (F22 22.1b — tarefas C–H do `fase-22-vscode-extension-tarefas.md`; contrato fixado em 22.1b.7.8) | teste BDD por formato |
| 24.9.2 | `wz man <keyword>` resolve via `TernarySearchTree`/`SyntaxReference` e imprime documentação (`KeywordDocumentation` + exemplos `TjpExample`) | idem — `TernarySearchTree.find(prefix, true)` (22.1b.1.5), `SyntaxReference.all/toText` (22.1b.2.7/2.10), `KeywordDocumentation.toText` (22.1b.3.16–20), `TjpExample` (22.1b.4) | ≥ 3 keywords (task/resource/report) |
| 24.9.3 | `wz man --format html` gera manual completo (`UserManual` do doc-core) em `--output-dir` | idem — `UserManual.generate(): Record<nome, conteúdo>` (22.1b.5.6) + `css/tjmanual.css` copiado do asset (22.1b.5.2); **a escrita em disco é da CLI**, o core não escreve | snapshot estrutural |
| 24.9.4 | Desancorar `TaskJuggler.freeze()` (âncora Fase 24 no core) — reescrita do master file via `io.writeText` | `packages/core/src/taskjuggler.ts` + `packages/cli` | teste com fixture `.tjp` congelável |
| 24.9.5 | Flags `--freeze`, `--freeze-by-task`, `--freezedate` mapeadas (tj3 §5.2) | `options.ts` | teste de flags + exit codes |

### 24.10 — Apps de sheets + dynamicAttributes (Bloco J)

| # | Tarefa | Fonte/Arquivos | Verificação |
|---|---|---|---|
| 24.10.1 | `ts send`: gera template `.tji` + **texto do email** (corpo; sem SMTP — anexo codificado em base64 no próprio texto ou arquivo separado) | classes da F18 (`TimeSheetSender`); Ruby `apps/Tj3TsSender.rb` (structure, não transporte) | teste: saída contém corpo + anexo decodificável |
| 24.10.2 | `ts receive --from <file|->`: consome **texto de mensagem** (arquivo/stdin), extrai anexo/processa como `TimeSheetReceiver` | Ruby `apps/Tj3TsReceiver.rb`; F18 | teste ponta a ponta com template round-trip |
| 24.10.3 | `ts summary`: `TimeSheetSummary` sobre submissões (texto), saída texto/CSV | Ruby `apps/Tj3TsSummary.rb`; F18 | fixture da F18 |
| 24.10.4 | `ss send` / `ss receive`: mesmos contratos para status sheets (`StatusSheetSender/Receiver`) | Ruby `apps/Tj3Ss{Sender,Receiver}.rb` | round-trip `.tjs` |
| 24.10.5 | `--report <R> [--attr "..."]`: aplica o pipeline `dynamicAttributes`/`parseReportAttributes` da F18 na CLI | `Project#generateReport` (4º arg) | teste com coluna dinâmica |
| 24.10.6 | Usar `FileList` (16.7) para rastreio de inputs e `StdIoWrapper` (16.11) para captura de saída onde o Ruby usava | core F16 | grep: nenhuma reimplementação local |
| 24.10.7 | `check-stubs`: âncoras `Fase 24` (freeze/parse/parseFile/parseContent) presentes e nenhuma órfã | `scripts/check-stubs.ts` | verde |
| 24.10.8 | **Imagens em relatórios (13.14.3, xray §4)**: `resolveImageRef` do core devolve descritor; a CLI materializa a imagem do disco (`io.readBytes`) como data URI ou arquivo ao lado da saída. Ruby usava `URL.createObjectURL`/blob só no browser | `packages/cli/src/commands/report.ts` + `markdown/extensions/images.ts` | teste: `![x](fotos/a.jpg)` → arquivo/URI na saída |
| 24.10.9 | **Regressão `format richtext` (13.14.4)** na saída da CLI: default `richtext` para `.tjp` legados; markdown só com `format markdown` explícito (núcleo entregue na F14-C, `14C.5.1–5.12`) | F14-C / `reports/*` | golden CLI com os dois formatos |

---

## Notas para a IA

1. **Ordem:** 24.0 → 24.1 → 24.2 → 24.3 → 24.4 → 24.5 → 24.6 → 24.7 → 24.8
   (24.6 e 24.7 podem alternar).
2. **24.2 é a única tarefa que mexe no core.** Mudanças mínimas e fiéis a
   `TaskJuggler.rb`; nada de FS no core; não desancorar `freeze`/sheets.
3. **Antes de 24.2.8**, auditar o mecanismo atual de saída de relatórios do
   Fase 14 (memória vs sink) — a junção do `FileSink` deve reaproveitar o que
   existir, não paralelizá-lo.
4. `io.ts` é fronteira única de runtime: qualquer novo acesso a FS/process/argv
   **entra nele**, com teste.
5. Flags sem suporte viram **erro com âncora**, não silêncio.
6. Não introduzir `node_modules`; Cliffy via `jsr:` (funciona nos 3 runtimes).
7. Testes de integração rodam a CLI **in-process** (função `main(argv)`) quando
   possível; subprocess apenas onde o exit code/escrita real importa.
8. Ao fim de cada subfase: `deno task check-all` + `deno task test`
   (obrigatório pelo AGENTS.md) e commit atômico.
9. Se Bun/Node ausentes no ambiente de execução, deixar as tasks 24.1.11/12,
   24.3.15, 24.6.3/4 **pendentes com nota explícita** (política de pendências).

---

## Referências cruzadas

- `docs/syntaxmesh/fases/fase-24-cli.md` — plano desta fase.
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
