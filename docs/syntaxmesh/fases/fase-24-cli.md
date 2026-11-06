# Fase 24 — CLI (`packages/cli`)

> **Arquivo:** `docs/syntaxmesh/fases/fase-24-cli.md`
> **Tarefas:** `docs/syntaxmesh/fases/fase-24-cli-tarefas.md` (~100 tarefas atômicas)
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–8 dias
> **Depende de:** Fases 2–14 (motor completo: parser, i18n, scheduler, financeiro, relatórios). **Não depende** das Fases 15–23.
> **Bloqueia:** nada — mas **deve ser executada após a Fase 23 e antes** das Fases 21 (1ª onda), 22 (VS Code), 19 (Storage) e 20 (PWA + UI)
> **Posicionamento:** ordem oficial em `plano.md` (2026-11-03): `… 23 → 24 → 21¹ → …`; serve de banco de provas headless do motor — a **1ª onda da Fase 21 usa esta CLI como runner** dos golden tests contra o `tj3` real — e valida a injeção de I/O no core antes da UI e da extensão
> **Natureza:** tooling (novo pacote `packages/cli` no workspace)

---

## 1. Contexto

O SyntaxMesh precisa de uma interface de linha de comando equivalente ao `tj3`
original: ler `.tjp` (com `.tji` associados), agendar o projeto e gerar
relatórios e informações no terminal. A CLI existente em
`docs/taskjuggler/lib/tj3.rb` + `lib/taskjuggler/apps/Tj3.rb` é a **fonte de
verdade** do comportamento a portar (regra zero, ADR 011).

Por que **antes** das Fases 19–22:

- **Banco de provas headless:** a CLI exercita parse → schedule → reports sem
  depender de browser, storage ou UI. É o caminho mais curto para rodar o
  corpus (MWEs + TestSuite) contra o motor e comparar com o `tj3` Ruby.
- **Desamboca âncoras do core:** `TaskJuggler.parse()`/`parseContent()` estão
  ancorados na Fase 19 ([`packages/core/src/taskjuggler.ts`](../../packages/core/src/taskjuggler.ts))
  porque pressupunham storage/browser. Para a CLI, o I/O vem do disco via
  `io.ts` — a fachada pode ser implementada **agora**, com I/O injetado,
  mantendo o storage da Fase 19 para o caminho PWA.
- **Padrão compartilhado:** a camada `io.ts` multi-runtime criada aqui será o
  modelo do futuro pacote `lsp` (Fase 22), que também roda fora do VS Code.

Decisões de alto nível (consolidadas do esboço):

1. Novo pacote `packages/cli` (`@vanaware/syntaxmesh-cli`) no workspace Deno.
2. **Cliffy** para a interface (`jsr:@cliffy/command` — v1 oficial funciona em
   Deno, Node.js e Bun, confirmado em jsr.io/@cliffy).
3. **Multi-runtime (Deno, Bun, Node)** via uma única camada de compatibilidade
   `src/io.ts`, sem ramificação de runtime para FS (usa `node:fs/promises`,
   suportado pelos três).
4. **Toda a lógica do SyntaxMesh permanece no core.** A CLI apenas empacota:
   lê argv, lê/escreve arquivos, chama a fachada `TaskJuggler` e formata saída.

---

## 2. Objetivo

Ao final desta fase:

- Pacote `packages/cli` no workspace, com `deno.jsonc`, entry `src/cli.ts` e
  manifesto de comando Cliffy.
- Camada `io.ts` completa e testada (read/write/exists/mkdir/mkdtemp/exit/args
  + detecção de runtime), **sem `any`** e sem ramificação de FS.
- Implementação (desancoramento) de `TaskJuggler.parse()`/`parseContent()` no
  core via **provedor de conteúdo injetado** (a CLI fornece `io.readText`;
  o core continua sem tocar em disco). Mesma injeção para `parseFile()` e
  `freeze()`/`freezeByTask()`/`freezedate` (reescrita do master file via
  `io.writeText`) — **dono: Fase 24** (reancorado em 2026-11-03; antes
  apontava Fase 19).
- Porta de opções fiel ao `tj3` no escopo v1 (§5): parse + schedule + geração
  de todos os relatórios declarados, `--check-syntax`, `--list-reports`,
  `--report/--reports`, `--output-dir`, `--no-reports`, `--force-reports`,
  `--silent`, `--no-color`, `--abort-on-warnings`, `--warn-ts-deltas`,
  `--add-trace`, `--config`, `--version`, `--help`.
- **Complementos pós-`tj3` (decisão 2026-11-03 — §5.4):**
  - `wz man` — gerador de referência de sintaxe/keywords/manual, consumindo o
    **`doc-core` entregue na Fase 22** (`SyntaxReference`,
    `KeywordDocumentation`, `TjpExample`, `UserManual`, `SyntaxCore`) — o
    equivalente do `tj3man` Ruby (`apps/Tj3Man.rb`).
  - Apps de sheets (equivalentes de `tj3ss_sender/receiver`,
    `tj3ts_sender/receiver/summary`, base `Tj3SheetAppBase`): o **núcleo das
    classes vive no core, entregue na Fase 18**; a CLI apenas empacota. **Sem
    SMTP**: o sender monta e imprime/escreve o **texto do email** (corpo +
    anexo `.tji`/`.tjs`); o receiver consome **texto de mensagem** fornecido
    pelo usuário (arquivo/stdin), não a mensagem inteira de um cliente de email.
  - `--report` com **atributos dinâmicos** (equivalente `-A`/`dynamicAttributes`
    do ReportServer Ruby): usa o pipeline `parseReportAttributes` +
    backup/restore **planejado na Fase 18** (§3.4 do xray).
  - Consumidores dos utilitários do core da Fase 16: `FileList` (rastreio de
    arquivos de entrada/repetibilidade — Ruby `Project.rb:478`), `StdIoWrapper`
    (captura de stdout/stderr p/ anexos e saída dos apps de sheet) e
    `UTF8String` (no-op, conforme 16.12).
- Códigos de saída fiéis a `apps/Tj3.rb` (`0` sucesso, `1` erro; §5.3).
- Mensagens do `MessageHandlerInstance` renderizadas no terminal (cores via
  Cliffy ANSI, respeitando `--no-color`/`--silent`).
- Execução demonstrada nos três runtimes: `deno run`, `bun run`, `node` (via
  bundle) + `deno compile` gerando binário `syntaxmesh`.
- Testes BDD: unitários (io, flags, exit codes, render) e de integração
  rodando fixtures reais (MWEs + TestSuite em inglês) de ponta a ponta.
- ADR da fase registrado (CLI + estratégia multi-runtime) — **034** na cadeia
  da ordem oficial; ver §10.
- `CURRENT.md` e `plano.md` confirmados com a ordem oficial (23 → 24 → 21¹ → 22).

---

## 3. Princípio: a CLI empacota, o core pensa

> Copiado do esboço, como regra inviolável: *"toda a lógica do syntaxmesh deve
> permanecer em core. este pacote apenas empacota o core para poder ser
> executado com um cli, lendo arquivos e escrevendo arquivos que são
> verdadeiramente elaborados apenas em core."*

| Responsabilidade | Onde vive |
|---|---|
| Parsing, scheduling, relatórios, mensagens, árvore de propriedades | `@vanaware/syntaxmesh` (core) — **já feito (Fases 2–14)** |
| Ler arquivo `.tjp`/`.tji` do disco, escrever saídas, argv, exit | `packages/cli/src/io.ts` |
| Definir flags, ajudar, cores, tabela de opções | `packages/cli` (Cliffy) |
| Decidir o que/quando executar (pipeline tj3) | `packages/cli/src/cli.ts` chamando a fachada `TaskJuggler` |

- O core **não** importa `node:fs`, `Deno.readTextFile` nem `process`. Conteúdo
  de arquivo entra por parâmetro/callback; conteúdo de relatório sai por
  retorno/`FileSink`.
- Se aparecer alguma lógica de linguagem na CLI → **pare**: ela pertence ao core
  (ou é bug do core).

---

## 4. Estratégia multi-runtime (Cliffy + `io.ts`)

### 4.1 Por que `node:fs/promises` até no Deno

O Deno suporta o shim `node:fs/promises` nativamente; Bun e Node idem. Assim,
**zero ramificação de runtime para arquivos e diretórios** — a única
ramificação restante é `args` (entrada) e `exit` (detecção), uma linha cada.

### 4.2 `io.ts` (camada de compatibilidade unificada)

Adotado do esboço, com ajuste obrigatório: substituir `globalThis as any` por
acesso tipado, seguindo a **mesma convenção usada no lexer do core**
(runtime-agnostic, sem `any` em `src/`):

```typescript
// src/io.ts
export { Command } from "@cliffy/command";

// Acesso tipado ao global (convenção core/src/lexer): nada de `any` em src/.
interface RuntimeGlobals {
  Deno?: { args: string[]; exit: (code?: number) => never };
  Bun?: Record<string, never>;
}
const g = globalThis as unknown as RuntimeGlobals & {
  process: { argv: string[]; exit: (code?: number) => never };
};

/** Detecta runtime (útil para logs/diagnóstico, não para FS). */
export const runtime: "deno" | "bun" | "node" = g.Deno ? "deno"
  : g.Bun ? "bun"
  : "node";

/** Argumentos normalizados (única ramificação de entrada; mantida por
 *  testabilidade — permite injetar args nos testes). */
export const args: string[] = g.Deno ? g.Deno.args : g.process.argv.slice(2);

// ---------- Arquivos e diretórios: sempre node:fs, sem ramificação ----------
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const readText = (path: string): Promise<string> =>
  readFile(path, "utf8");

export const writeText = (path: string, data: string): Promise<void> =>
  writeFile(path, data, "utf8");

export async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

/** mkdir -p */
export const mkpath = (path: string): Promise<void> =>
  mkdir(path, { recursive: true });

/** Diretório temporário único com prefixo. */
export const mktemp = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix));

// ---------- Processo ----------
export function exit(code = 0): never {
  if (g.Deno) g.Deno.exit(code);
  g.process.exit(code);
  throw new Error("unreachable");
}
```

### 4.3 Pontos de atenção (do esboço, confirmados)

1. **Permissões no Deno continuam valendo** — `node:fs/promises` exige
   `--allow-read --allow-write --allow-env` igualzinho ao `Deno.readTextFile`.
   Task `run` do pacote: `deno run --allow-read --allow-write --allow-env src/cli.ts`.
2. **`Deno Deploy` não tem FS** — fora de escopo; se um dia, abstrair
   *storage*, não o runtime.
3. **`args` mantém o `if`** — Cliffy até normaliza internamente, mas manter a
   variável injetável garante testabilidade unitária. Uma linha é preço justo.

---

## 5. Porta de comandos — fidelidade ao `tj3`

### 5.1 Forma de uso

```
syntaxmesh <arquivo.tjp> [opções]
```

Comportamento padrão (fiel a `apps/Tj3.rb: main()`):

1. Lê o arquivo e resolve `include`/`.tji` (leitura via `io.readText`,
   caminhos relativos ao arquivo que inclui — como `FileInstance` no Ruby).
2. `TaskJuggler.parse()` → `schedule()` → gera **todos os relatórios
   declarados**, a menos que `--no-reports`/`--check-syntax`.
3. Não gera relatórios se houve erros (§5.2), a menos de `--force-reports`.
4. Imprime resumo do projeto, mensagens do `MessageHandler` e progresso
   (suprimíveis com `--silent`).

### 5.2 Mapa de opções v1 (fonte: `man/tj3.1` + `lib/taskjuggler/apps/Tj3.rb`)

| Flag | Efeito no tj3 | Implementação SyntaxMesh |
|---|---|---|
| `<file.tjp>` (posicional) | master file | `io.readText` → `TaskJuggler.parse()` |
| `--config <FILE>` | YAML de configuração | ler YAML via core (`Tj3Config`/`AppConfig` já portados em parte); validar |
| `--silent` | suprime info/progresso | `MessageHandler` em modo quiet |
| `--no-color` | sem ANSI | desliga color do Cliffy ANSI |
| `--abort-on-warnings` | warning trata como erro | pós-parse: `warnings > 0` ⇒ exit 1 |
| `--check-syntax` | só parseia (exit 0 se OK) | `parse()` e para; não agenda |
| `--list-reports <RE>` | lista relatórios (regex) | `TaskJuggler.listReports(re, regExpMode)` |
| `--no-reports` | agenda, não gera | pula `generateReports` |
| `--report <R> <PID>` / `--reports <RE> <PID>` | gera específicos/regex | `generateReport(id, false/true)` |
| `--output-dir <DIR>` | prefixo de saída | `generateReports(outputDir)` |
| `--force-reports` | gera apesar de erros | pula o gate de erros |
| `--warn-ts-deltas` | warnings de time sheet | `tj.warnTsDeltas = true` |
| `--add-trace` | habilita trace reports | `tj.generateTraces = true` |
| `--version`, `--help` | metadados/usagem | `AppConfig` + Cliffy embute |

**Adiados conscientemente (com âncora registrada):**

| Flag | Motivo | Âncora |
|---|---|---|
| `--freeze`, `--freeze-by-task`, `--freezedate` | reescreve master file (status sheets) | **Fase 24** (reancorado 2026-11-03; antes: Fase 19). Núcleo `TaskJuggler.freeze` no core; escrita via `io.writeText` (subfase 24.9) |
| `--check-time-sheet`, `--check-status-sheet` | sheets ainda não portadas | Núcleo: **Fase 18** (já ancorado no core); empacotamento CLI: **Fase 24** (§5.4) |
| `--debug`, `--debuglevel`, `--debugmodules` | hook de debug Ruby | descartado (sem equivalente no port; depurar via testes/`--add-trace`) |

### 5.3 Códigos de saída (fiéis a `apps/Tj3.rb`)

```
0  → sucesso (ou --check-syntax sem erros)
1  → erro de parse, erro de relatório, ou warnings com --abort-on-warnings
```

Mapear diretamente os retornos da fachada (`parse()`, `schedule()`,
`generateReports()`, `generateReport()`, `errors > 0`), como no Ruby. Cliffy
cuida de `--help`/`--version` (exit 0) e de erro de flag desconhecida (exit 1
com mensagem própria).

### 5.4 Complementos pós-`tj3` (decisão 2026-11-03 — varredura `docs/syntaxmesh/xray.md`)

A porta do `tj3` (§5.1–5.3) continua o escopo central. Além dela, a CLI passa a
empacotar recursos adicionais cujo **núcleo vive no core** (regra §3 — "a CLI
empacota, o core pensa"):

| Comando | Equivalente Ruby | Núcleo (quem entrega) | Empacotamento CLI |
|---|---|---|---|
| `wz man [--format html\|text\|tjp] [keyword…]` | `apps/Tj3Man.rb` + `UserManual`/`SyntaxReference`/`KeywordDocumentation`/`TjpExample` | **Fase 22** — `doc-core` (`@vanaware/syntaxmesh/doc-core`, subfase 22.1b) + `SyntaxCore`/`TernarySearchTree` da F16 | F24 subfase 24.9 |
| `wz ts send` / `wz ts receive` / `wz ts summary` | `apps/Tj3TsSender/TsReceiver/TsSummary.rb` + `Tj3SheetAppBase` | **Fase 18** — classes `TimeSheetSender/Receiver/Summary` no core | F24 subfase 24.10. **Sem SMTP**: sender devolve o **texto do email** (corpo + anexo codificado) para o usuário enviar; receiver lê o **texto da mensagem** de arquivo/stdin — espelhando a decisão email→download da F18 (ADR da fase sheets) |
| `wz ss send` / `wz ss receive` | `apps/Tj3SsSender/SsReceiver.rb` | **Fase 18** — `StatusSheetSender/Receiver` no core | F24 subfase 24.10 (mesma política texto-do-email) |
| `--report <R> [--attr "<attrs>"]` (alias `-A`) com atributos dinâmicos | `ReportServer`/`ReportServlet` (daemon) + `Project#generateReport(dynamicAttributes)` | **Fase 18** — núcleo `parseReportAttributes` + backup/restore (adendo F18; xray §3.4). **Entregue em 18.19:** `Project#generateReport(id, regExpMode, formats, attrs)` faz backup → parse → `interactive` → gera → restore; a CLI só traduz `-A/--attr` para o 4º argumento | F24 subfase 24.10 |
| Rastreio de arquivos de entrada / captura de saída | `FileList`/`StdIoWrapper`/`UTF8String` | **Fase 16** (16.7/16.11/16.12 — utilitários no core) | Consumidos por 24.2/24.10 |
| Imagens em relatórios (`![x](…)`) | `ImageRouter`/`RdoReport` Ruby + `URL.createObjectURL` (browser) | **Fase 13** devolve só o descritor (`resolveImageRef`, core DOM-free) | F24 subfase 24.10.8 — materializa do disco via `io` (13.14.3, xray §4); fase 19 faz o equivalente OPFS na PWA |
| `format richtext` como default na saída | roteador de formato dos reports | **Fase 14-C** (núcleo entregue em `14C.5.1–5.12`) | F24 subfase 24.10.9 — regressão golden dos dois formatos (13.14.4, xray §4) |

**Núcleo dos apps de sheet (18.18, entregue 2026-11-05):** o core exporta
`SheetAppBase` + `TsSenderApp`, `TsReceiverApp`, `TsSummaryApp`, `SsSenderApp` e
`SsReceiverApp` (`@vanaware/syntaxmesh` → `src/sheets/apps/`). Eles recebem
**opções já tipadas** (`workingDir`, `dryRun`, `config`, `endDate`, `resources`,
`force`, `intervalDuration`, `hideResource`, `recipients`) e um
`SheetAppContext` (`project`, `fileStore`, `rawEmail`) e **devolvem** o código de
saída (`0`/`1`) por `run()`.

> **Empacotamento é CLI-only (18.18.9):** parsing de argv (`OptionParser`),
> leitura de `stdin`, `Deno.exit` e a escrita do `outbox/*.eml` ficam na F24
> (24.10). O core nunca chama `Deno.exit` nem lê argv — `run()` só retorna
> `SHEET_APP_EXIT_OK`/`SHEET_APP_EXIT_ERROR`. O anexo continua `.tji` nos dois
tipos de sheet (o Ruby só reconhece essa extensão em
`SheetReceiver#SHEET_EXTENSION`); o `.tjs` citado no adendo 18.18.6 é
divergência de documentação, não de comportamento.

> Nota: `freeze` (`--freeze*`) também reancorado para **Fase 24** (24.9) —
> era Fase 19. O daemon em si (`tj3d`/`tj3webd`/`tj3client`) permanece **fora de
> escopo**: a funcionalidade análoga é entregue pela camada 3 da Fase 22
> (relatórios embutidos no editor) e pela PWA (Fase 20) — registrar a rejeição
> explícita no plano canônico (xray §3.1).

---

## 6. Integração com o core (desancoramento do `TaskJuggler`)

- Mudança no **core** (única alteração de código fora do pacote CLI):
  - `TaskJuggler.parse(files, fileReader)` e `parseContent(content)` recebem um
    **provedor de conteúdo** injetado (assinatura:
      `(path: string) => Promise<string> | string`), substituindo os throws
      `NotYetImplementedError("19", ...)`. A resolução de `include` relativa ao
      arquivo-pai deve seguir `TaskJuggler.rb` (mesma semântica de
      `FileInstance`/`Dir.getwd`).
  - Os chamadores futuros (PWA/Fase 19–20) injetarão seu próprio provedor
    (storage/workerdb); a CLI injeta `io.readText`. **Nada de FS no core.**
  - Confirmar/ajustar o pipeline de escrita de relatórios: `generateReports`
    deve entregar os conteúdos gerados por um **`FileSink` injetado**
      `(path, contents) => Promise<void>` (se hoje já há mecanismo equivalente,
    usá-lo; não inventar outro). Verificar em
    `packages/core/src/reports/` antes de codar.
  - Registrar em `CURRENT.md` que as âncoras 19 de `parse`/`parseContent`/sink
    de relatórios foram **substituídas por injeção** nesta fase, mantendo a
    âncora 19 apenas para o caminho PWA/storage.
- A CLI mantém-se **100% burro**: monta a fachada, define flags, chama métodos
  na ordem do §5.1 e repassa mensagens/saída.

---

## 7. Estrutura do pacote

```
packages/cli/
├── deno.jsonc               # name: @vanaware/syntaxmesh-cli
│                            # imports: @cliffy/command (jsr), @vanaware/syntaxmesh (workspace)
│                            # tasks: run / check / test / compile
├── src/
│   ├── cli.ts               # entry: defineCommand(...) .parse(args) + pipeline §5.1
│   ├── options.ts           # mapa flag → Tj3Options (testável isolado do Cliffy)
│   ├── io.ts                # camada de compatibilidade (§4.2) — único lugar com node:*
│   ├── reporter.ts          # MessageHandler → stdout (cores, silent, contagens)
│   └── summary.ts           # resumo do projeto em terminal (task/resource/finanças)
├── tests/
│   ├── io_test.ts
│   ├── options_test.ts
│   ├── exit_test.ts         # matriz de exit codes (§5.3)
│   ├── cli.integration_test.ts   # fixtures MWEs + TestSuite (end-to-end)
│   └── golden_cli_test.ts        # comparação com saída do tj3 Ruby quando possível
└── README.md                # uso, permissões, instalação por runtime
```

- Adicionar `"./packages/cli"` ao `workspace` do `deno.jsonc` raiz e task
  agregada `cli` (`deno task cli <arquivo.tjp>`).
- Dependências só via `jsr:`/`npm:` no `deno.jsonc` do pacote; **sem
  `node_modules`**.

---

## 8. Execução e distribuição

| Runtime | Como executar | Observação |
|---|---|---|
| Deno (dev/oficial) | `deno task cli projeto.tjp` (= `deno run --allow-read --allow-write --allow-env packages/cli/src/cli.ts`) | fluxo principal, fiel ao AGENTS.md |
| Binário nativo | `deno compile --output syntaxmesh packages/cli/src/cli.ts` | task `compile`; inclui permissões via flags de compile |
| Bun | `bun run packages/cli/src/cli.ts projeto.tjp` | smoke test; sem `deno compile` |
| Node ≥ 20 | bundle via `scripts/esbuild.ts` (alvo node, ESM) + shebang → `node dist/cli.js` | reusa pipeline de build existente do repo |

- Versão exibida por `--version` vem de `metadata.json`/`AppConfig` (manter
  consistência com `scripts/tag-version.ts`).
- Publicação npm/registry **fora de escopo** (decisão de release = Fase 21).

---

## 9. Estratégia de testes

Convenções: BDD (`@std/testing/bdd` + `@std/assert`); TDD para cada unidade
nova; sem `any` em `src/`; fixtures em inglês (MWEs + TestSuite) — coerente com
o escopo v1 monolíngue adotado também na Fase 22.

| Alvo | Método | Critério |
|---|---|---|
| `io.ts` | unit (Deno) + asserts de paridade node:fs | read/write/exists/mkdir/mkdtemp/exit/args cobertos |
| `args` injetável | unit | parse de flags sem processo real |
| Mapa flag→opção (§5.2) | unit | cada flag v1 mapeia; flags adiadas viram erro claro |
| Exit codes (§5.3) | unit/int | matriz 0/1 incluindo abort-on-warnings e force-reports |
| Pipeline completo | integração: `mwe001–009` + `TestSuite/Syntax/Correct` (subset) e `Syntax/Errors` | sucesso/erro esperados; relatórios escritos em `mktemp()` |
| Fidelidade com tj3 Ruby | golden: comparar stdout/exit com `tj3` real nos mesmos fixtures (há harness em `scripts/golden/`) | divergência só nas normalizações já previstas (versão, paths, float 1e-6) |
| Multi-runtime | smoke: `bun run` e `node dist/cli.js` em 1 fixture | exit 0 e mesmos artefatos |
| Workspace | `deno task check-all` | exit 0 |

Cobertura mínima: ≥ 80% em `packages/cli/src/`.

---

## 10. ADR da fase (034) — CLI + estratégia multi-runtime

Criar `docs/syntaxmesh/decisoes/0NN-cli-multiruntime.md` na abertura da fase
(0NN = próximo livre; **034** se a ordem oficial `plano.md` — 23 → 24 → 22 —
for seguida; a Fase 23 cria o 033 antes):

- **Contexto:** necessidade de interface tj3 headless; execução antes das
  Fases 19–22; requirement de rodar em Deno/Bun/Node.
- **Decisões:** pacote `packages/cli` adaptador (regra zero); Cliffy via JSR;
  camada única `io.ts` com `node:fs/promises` (sem ramificação de FS); args com
  ramificação mínima por testabilidade; permissões Deno explícitas na task;
  desancoramento de `TaskJuggler.parse/parseContent` via provedor de conteúdo
  injetado + `FileSink` para relatórios.
- **Alternativas rejeitadas:** `Deno.args`/`Deno.readTextFile` puros (mata
  Bun/Node); `@std/cli` sozinho (perde UX de ajuda/tabelas do Cliffy); driver
  de abstração de storage (overkill — problema é runtime, não storage; ver
  ADR 030).
- **Consequências:** core ganha injeção de I/O na fachada (desejável p/ Fase 19/20);
  `--debug*` fica fora da v1; freeze (24.9) e check/sheets (24.10) entram na v2
  da CLI, dependentes das Fases 18/22; `node:*` aparece no
  workspace pela primeira vez, confinado a `io.ts`.

> ⚠️ **Numeração (resolvida 2026-11-03):** com a ordem oficial
> `15 → 16 → 17 → 18 → 23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³`, a cadeia de
> criação fica **033 = template (Fase 23), 034 = CLI (esta), 035 = extensão VS
> Code (Fase 22)**; a validação da Fase 21 usa um ADR próprio (próximo livre
> após as ondas). Conferir `decisoes/README.md` antes de criar.

---

## 11. Convenções e anti-padrões

### Convenções

1. `packages/cli` é **adaptador puro**: argv + FS + saída. Zero regra de
   linguagem, zero regra de scheduling/relatório.
2. Único arquivo com `node:*`/detecção de runtime: `src/io.ts`.
3. Flags seguem nomes do `tj3` (§5.2); ao adicionar flag própria, registrar no
   README e no ADR.
4. Exit codes fiéis a `apps/Tj3.rb`: apenas `0`/`1` na v1.
5. Toda escrita em disco passa por `io.ts`; caminhos relativos resolvidos como
   no Ruby (relativos ao arquivo-pai do `include`).
6. Mensagens do terminal vêm do `MessageHandlerInstance` (core), formatados em
   `reporter.ts` — não reescrever mensagens na CLI.
7. Cores/ANSI via utilitários do Cliffy; respeitar `--no-color` e não-TTY.

### Anti-padrões

- ❌ Importar `Deno.*` (exceto em permissões de task) ou `process` fora de `io.ts`.
- ❌ Implementar resolução de `include`/macros/performance na CLI (é do core/parser).
- ❌ Introduzir `node_modules`/`npm install` — dependências via `jsr:`/`npm:`.
- ❌ Usar `as any` (padrão do repo; usar interface de global tipada, §4.2).
- ❌ Criar segunda camada de abstração de FS (além do `io.ts`).
- ❌ Emitir texto de relatório direto do CLI sem passar pelo pipeline de
  `generateReports` do core.
- ❌ Rodar relatórios em paralelo simulando scheduler (browser-core é single
  threaded; `maxCpuCores` fica 1).

---

## 12. Subfases (índice para o arquivo de tarefas)

O detalhamento atômico está em [`fase-24-cli-tarefas.md`](./fase-24-cli-tarefas.md),
no padrão dos blocos das fases anteriores:

| # | Subfase | Entrega | Pré-requisito |
|---|---|---|---|
| 24.0 | ADR da fase (0NN) + reposicionamento | `decisoes/0NN-cli-multiruntime.md` + linha no README + confirmação da ordem em `plano.md`/`CURRENT.md` (23 → 24 → 21¹) | — |
| 24.1 | Scaffold + `io.ts` | `packages/cli/` no workspace; `io.ts` (§4.2) com testes unitários; task `cli` | 24.0 |
| 24.2 | Injeção de I/O no core | `TaskJuggler.parse/parseContent` desancorados via provedor injetado; `FileSink` p/ relatórios; testes no core | 24.1 |
| 24.3 | Comando + flags | `cli.ts` com Cliffy; `options.ts` mapeando §5.2; exit codes §5.3 | 24.2 |
| 24.4 | Saída no terminal | `reporter.ts` (MessageHandler→stdout, cores, silent) + `summary.ts` | 24.3 |
| 24.5 | Relatórios de ponta a ponta | geração em `--output-dir`, `--report/--reports/--list-reports`, `--force-reports`, `--no-reports`; integração em MWEs | 24.4 |
| 24.6 | Multi-runtime + binário | smoke Bun/Node; `deno compile`; bundle node via `scripts/esbuild.ts`; README por runtime | 24.5 |
| 24.7 | Fidelidade tj3 (golden CLI) | comparação stdout/exit/artefatos vs `tj3` Ruby no subset de fixtures; divergências documentadas (regra zero) | 24.5 |
| 24.8 | Verificação final | `check-all` + `test` + cobertura ≥ 80% + ADR commitado + `CURRENT.md`/`plano.md` atualizados | todas |
| 24.9 | `man` + `freeze` (§5.4) | comando `wz man` sobre o `doc-core` da F22 (html/text/tjp) + desancoramento e flags `--freeze*` via `io.writeText` | 24.3, F22 (22.1b) |
| 24.10 | Apps de sheets (§5.4) | `ts/ss send·receive·summary` empacotando as classes da F18 (texto do email, sem SMTP) + `--report` com dynamicAttributes | 24.5, F18 |

Ordem de execução: 24.0 → 24.1 → … → 24.8 (linear; 24.7 pode correr em
paralelo com 24.6). **24.9/24.10 são extensões pós-v1** (§5.4) — executam depois
de 24.8, quando F22 (`doc-core`) e F18 (sheets/dynamicAttributes) estiverem
verdes.

Commits por subfase: `feat(cli): scaffold+io`, `feat(core): file provider`,
`feat(cli): options`, `feat(cli): reporter`, `feat(cli): reports-pipeline`,
`chore(cli): multi-runtime`, `test(cli): golden-tj3`, `docs(cli): ADR da fase`.

---

## 13. Referências cruzadas

- **Fonte de verdade do comportamento:**
  - `docs/taskjuggler/lib/tj3.rb` (entry) e
    `docs/taskjuggler/lib/taskjuggler/apps/Tj3.rb` (flags + fluxo + returns).
  - `docs/taskjuggler/man/tj3.1` (lista completa de flags).
  - `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb` (`parse/parseFile` e
    semântica de `FileInstance`/include) — portar fielmente para a fachada já
    existente em `packages/core/src/taskjuggler.ts`.
- **Docs internos:**
  - `docs/syntaxmesh/09-regras-para-ia.md` (regra zero), ADRs 011 (port fiel),
    030 (pacotes), 006 (build pipeline), 007 (workspace), 008 (std/testing BDD).
  - `docs/syntaxmesh/fases/fase-22-vscode-extension.md` — compartilha o padrão
    "adaptador fino" e consome o mesmo core; a CLI pode servir de smoke para o
    `lsp-core` no futuro.
  - `docs/tj3-engine/tj3-reports.md` — pipeline de geração de relatórios
    (referência conceitual da Fase 14).
  - `scripts/golden/` — harness existente de comparação com `tj3` Ruby.
  - `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — diferenças Ruby↔TS (StringIO,
    `Dir`, `FileTest`).
- **Cliffy:** https://cliffy.io (v1; jsr:@cliffy/command — Deno/Node/Bun).

---

**Fim do plano da Fase 24 (CLI `packages/cli` — interface tj3 multi-runtime).**
