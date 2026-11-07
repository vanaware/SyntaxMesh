# Fase 24 — CLI (`packages/cli`)

> **Arquivo:** `docs/syntaxmesh/fases/fase-24-cli.md`
> **Adendo:** [`fase-24-cli-adendo.md`](./fase-24-cli-adendo.md) — API de execução do core (`execute`: envelope JSON com seções; entrada `request.files` de `{ path, content }` sem provedor — v2.1) + modificador `stdout` na DSL; é a source of truth de §5.5 e do contrato de saída de §6
> **Tarefas:** `docs/syntaxmesh/fases/fase-24-cli-tarefas.md` (~144 tarefas atômicas)
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
5. **API de execução única no core (adendo v2/v2.1).** Uma só chamada
   `core.execute(request)` roda todo o fluxo do `tj3` (e das funções portadas
   dos demais CLIs do TaskJuggler — man, sheets, freeze) e devolve um
   **envelope JSON** com eco dos parâmetros, `exitCode` como dado, mensagens
   estruturadas e **seções identificadas** (`check`, `listReports`, `reports`,
   `freeze`, `sheet`, `man`, `help`, `version`). A **entrada de arquivos** é
   uma lista completa `request.files[]` de `{ path, content }` (+ `entry`):
   como um `.tjp` pode `include` outros `.tjp`/`.tji`, o consumidor passa o
   fechamento todo e o core resolve `include` por *lookup* na lista — **sem
   provedor e sem acesso a disco** — e os conteúdos **não voltam** no envelope
   (eco só dos caminhos), para poupar tráfego/tamanho. O `.tjp` declara a
   *intenção* `stdout`; o core devolve conteúdos como dados e a **CLI é o único
   componente que imprime no terminal ou grava arquivos** (§5.5). Este
   contrato **substitui** o desenho anterior de `FileSink` injetado em
   `generateReports` e o de orquestração do pipeline na CLI.
6. **Nomenclatura e extensão próprias (decisão 2026-11-07).** Os CLIs são
   clones de **comportamento** do `tj3`/`tj3man`/`tj3ts_*`/`tj3ss_*`, não de
   nome: a família chama-se **`syntaxmesh`** (binário via `deno compile`; alias
   curto **`smx`**) com subcomandos `man`, `ts|ss send·receive·summary`,
   `check-ts`/`check-ss` — **todos pela mesma API `execute` com retorno JSON**.
   A extensão nativa é **única**: **`.smx`**, substituindo o par `.tjp`/`.tji`.
   A distinção master/include nunca foi funcional no engine (é uma *convenção
   validada* pelo Ruby para evitar abrir fragmento como entrada ou incluir o
   master); no SyntaxMesh ela passa a ser de **papel**: `entry` = master,
   referenciados por `include` = fragmentos — exatamente a semântica de
   `request.files`/`entry` do adendo v2.1, que dispensa duas extensões.
   `.tjp`/`.tji` continuam **aceitos por compatibilidade** (projetos da regra
   zero, goldens F21 contra o `tj3` real, anexos `.tji` já enviados por
   usuários); a relaxação das três validações herdadas (parser F10, sheets
   F18) é a tarefa 24.2.36 do grupo 5.
7. **English-first em toda saída da ferramenta (decisão 2026-11-07).** Nesta
   etapa de construção do clone do TaskJuggler, **todas as saídas e superfícies
   interativas do SyntaxMesh são em inglês**: `messages` do envelope, `help`,
   `version`, `man`, templates e corpo dos emails de sheet, nomes de seções,
   flags e README. O i18n da Fase 10 é **entrada** (parsear `.tjp`/`.smx` com
   keywords pt/es continua obrigatório para a regra zero e os goldens F21) e a
   diretiva `language` afeta apenas o parsing do arquivo — o tool **emite,
   responde e interage em inglês por default**; expansão multilíngue da saída
   é adendo futuro (F20 UI, F22 adendo PT/ES pós-21). Consolidar o SyntaxMesh
   como ferramenta internacional em inglês primeiro — princípio registrado em
   `02-principios.md`.
   **Corolário (decisão 2026-11-07):** o **parser pt-BR/es** é **experimental**
   e **sujeito a mudanças** (vocabulário, sinônimos, unidades, cobertura do
   `man`). A **recomendação atual** é escrever projetos em **inglês** — `en` é
   a única gramática estável auditada pela regra zero (ADR 011) e a via
   recomendada nos goldens F21; a CLI deve tratar o caminho pt/es como
   **piso de compatibilidade** (fixa `language "en"` por default em exemplos
   do `man`/help e não expõe flags de seleção de idioma na v1). Ver
   `04-linguagem-multilingue.md` e `02-principios.md`.

---

## 2. Objetivo

Ao final desta fase:

- Pacote `packages/cli` no workspace, com `deno.jsonc`, entry `src/cli.ts` e
  manifesto de comando Cliffy.
- Camada `io.ts` completa e testada (read/write/exists/mkdir/mkdtemp/exit/args
  + detecção de runtime), **sem `any`** e sem ramificação de FS.
- Implementação (desancoramento) de `TaskJuggler.parse()`/`parseContent()` no
  core com leitura de arquivo **injetada** — para o caminho passo-a-passo
  (UI/PWA Fase 20) via provedor `(path) => string` (o chamador fornece
  `io.readText`; o core continua sem tocar em disco). **`execute`, porém, não
  usa provedor**: recebe `request.files` (lista `{ path, content }` com o
  fechamento completo de `include`s) e resolve `include` por *lookup* contra
  essa lista. Mesma injeção para `parseFile()` e
  `freeze()`/`freezeByTask()`/`freezedate` (reescrita do master file via
  `io.writeText`) — **dono: Fase 24** (reancorado em 2026-11-03; antes
  apontava Fase 19).
- Porta de opções fiel ao `tj3` no escopo v1 (§5): parse + schedule + geração
  de todos os relatórios declarados, `--check-syntax`, `--list-reports`,
  `--report/--reports`, `--output-dir`, `--no-reports`, `--force-reports`,
  `--silent`, `--no-color`, `--abort-on-warnings`, `--warn-ts-deltas`,
  `--add-trace`, `--config`, `--version`, `--help` — todas traduzidas campo a
  campo no `ExecutionRequest` da API `execute` (as de renderização, `--silent`/
  `--no-color`, ficam só no renderer da CLI).
- **API de execução única (adendo v2):** o parser reconhece o modificador
  `stdout` em todos os cabeçalhos de relatório (posição única: após o nome,
  antes das chaves; duplicata ou posição inválida = erro de sintaxe) e o core
  expõe `execute(request)`, **ponto único de entrada** para todas as chamadas
  de linha de comando: roda o pipeline interno e devolve o envelope JSON —
  `ok`, `exitCode` (dado), `options` (eco normalizado), `messages`
  (estruturadas) e `results` com **apenas as seções pedidas** (`check`,
  `listReports`, `reports`, `freeze`, `sheet`, `man`, `help`, `version`). A
  **entrada de arquivos** é uma lista completa `request.files[]` de
  `{ path, content }` (+ `entry` opcional, default `files[0]`): como um `.tjp`
  pode `include` outros `.tjp`/`.tji`, o consumidor passa o fechamento completo
  e o core resolve `include` por *lookup* na lista — **sem provedor, sem
  disco**; os conteúdos **não voltam** no envelope (eco só dos caminhos), para
  poupar tráfego/tamanho. A
  seção `reports` carrega o contrato v1 (`stdout`/`formats`/`errors` por
  relatório) e um campo `outputDir` presente **somente** quando o parâmetro
  foi passado. O que era trabalho do core chega processado: dynamic
  attributes (pipeline 18.19) aplicados, e-mail dos sheets como texto, freeze
  como conteúdo. A CLI só renderiza: `stdout: true` ⇒ imprimir no terminal
  todos os formatos com delimitador `--- <name> [<format>] ---`; `stdout:
  false` ⇒ gravar `{name}.{ext}` sanitizado no `outputDir` ecoado. Arquivos
  `.tjp` sem `stdout` continuam com comportamento idêntico ao anterior
  (gravação em arquivo).
- **Complementos pós-`tj3` (decisão 2026-11-03 — §5.4):**
  - `syntaxmesh man` — gerador de referência de sintaxe/keywords/manual, consumindo o
    **`doc-core` entregue na Fase 22** (`SyntaxReference`,
    `KeywordDocumentation`, `TjpExample`, `UserManual`, `SyntaxCore`) — o
    equivalente do `tj3man` Ruby (`apps/Tj3Man.rb`).
  - Apps de sheets (equivalentes de `tj3ss_sender/receiver`,
    `tj3ts_sender/receiver/summary`, base `Tj3SheetAppBase`): o **núcleo das
    classes vive no core, entregue na Fase 18**; a CLI apenas empacota. **Sem
    SMTP**: o sender monta e imprime/escreve o **texto do email** (corpo +
    anexo `.tji`/`.tjs`; desde 2026-11-07 o anexo gerado é `.smx`, com `.tji`
    reconhecido por compatibilidade — 24.2.36); o receiver consome **texto de
    mensagem** fornecido
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
| Decidir o que/quando executar (pipeline tj3, §5.1) | `@vanaware/syntaxmesh` (core) — `execute()` roda o fluxo e devolve o envelope (adendo v2 §3) |
| Renderizar relatórios/seções e devolver conteúdos como dados do envelope | `@vanaware/syntaxmesh` (core) — seções `results.*` (§5.5/§6) |
| Traduzir argv → `ExecutionRequest` (lê master + `include`s via `io.ts` em `request.files`), despachar o envelope (terminal vs arquivo, delimitador, nome, sanitização, política de erro, `exit`) e escrever freeze/outbox | `packages/cli` (`options.ts` + `output-policy.ts`, adendo §4) |

- O core **não** importa `node:fs`, `Deno.readTextFile` nem `process`, e **não
  imprime nem grava nada**: no `execute`, o conteúdo de arquivo entra **inline**
  em `request.files` (sem provedor de arquivo — provedor só no caminho
  passo-a-passo UI/PWA); o core resolve `include` por *lookup* contra essa
  lista e **não devolve** os conteúdos no envelope (eco só dos caminhos). Todo
  resultado sai como **envelope** de `execute` — conteúdos de relatório na
  seção `results.reports` (`ReportsJson`), mensagens/`exitCode`/eco como dados
  (adendo §3.4). Toda decisão de execução da intenção `stdout` é do consumidor
  — na v1, a CLI.
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

Comportamento padrão (fiel a `apps/Tj3.rb: main()`, agora **portada para dentro
do core** pela API `execute`):

1. A CLI monta o `ExecutionRequest`: lê o master e os `.tjp`/`.tji` que ele
   referencia (via `io.readText`) e os coloca em `request.files` (lista
   `{ path, content }`, fechamento completo, `entry` = master); então chama
   `core.execute(request)` **uma** única vez. O core resolve `include`/`.tji`
   por *lookup* contra `request.files` (caminhos relativos ao arquivo que
   inclui, como `FileInstance` no Ruby) — **sem provedor de arquivo e sem
   tocar em disco**; os conteúdos não são devolvidos no envelope.
2. O core roda internamente `parse()` → `schedule()` → renderização de **todos
   os relatórios declarados**, preenche as seções pedidas do envelope e a CLI
   aplica a política de saída (§5.5), a menos que `--no-reports`/
   `--check-syntax`.
3. O core não inclui relatórios gerados se houve erros (gate do §5.2 no
   envelope), a menos de `--force-reports`.
4. A CLI imprime resumo do projeto e as `messages` do envelope (cores/
   supressão a critério do renderer — `--silent`/`--no-color` não entram no
   request) e sai com `exit(result.exitCode)`.

### 5.2 Mapa de opções v1 (fonte: `man/tj3.1` + `lib/taskjuggler/apps/Tj3.rb`)

| Flag | Efeito no tj3 | Implementação SyntaxMesh |
|---|---|---|
| `<file>` (`.smx`; `.tjp` aceito por compat — decisão 2026-11-07) | master file | `request.entry` + o arquivo em `request.files` (a CLI lê via `io.readText` e monta o fechamento de `include`s); o core resolve `include` por *lookup* contra `request.files`, sem provedor/disco |
| `--config <FILE>` | YAML de configuração | `request.configContent` (a CLI lê o YAML via `io.readText`; core valida/aplica — `Tj3Config`/`AppConfig` já portados em parte) |
| `--silent` | suprime info/progresso | **renderer-only** (não entra no request); render quiet das `messages` |
| `--no-color` | sem ANSI | **renderer-only**; desliga color do Cliffy ANSI |
| `--abort-on-warnings` | warning trata como erro | `request.abortOnWarnings`; core computa `exitCode` 1 no envelope |
| `--check-syntax` | só parseia (exit 0 se OK) | `request.checkSyntax` ⇒ seção `results.check` (sem agenda) |
| `--list-reports <RE>` | lista relatórios (regex) | `request.listReports` ⇒ seção `results.listReports` (sem agenda) |
| `--no-reports` | agenda, não gera | `request.noReports`; core omite a seção `reports` |
| `--report <R> <PID>` / `--reports <RE> <PID>` | gera específicos/regex | `request.report` + `reportsIsRegex`; seção `reports` já vem filtrada (§5.5 ponto 4) |
| `--report -A "<attrs>"` (§5.4) | atributos dinâmicos | `request.dynamicAttributes` cru como string; **o core aplica o pipeline 18.19 interno** antes de renderizar |
| `--output-dir <DIR>` | prefixo de saída | `request.outputDir`; ecoado como campo `outputDir` da seção `reports` (§5.5) |
| `--force-reports` | gera apesar de erros | `request.forceReports`; core dispensa o gate de erros no envelope |
| `--warn-ts-deltas` | warnings de time sheet | `request.warnTsDeltas` |
| `--add-trace` | habilita trace reports | `request.addTrace` |
| `--version`, `--help` | metadados/usagem | `request.version`/`help` ⇒ seções `version`/`help` (dados estruturados); Cliffy mantém a ajuda humana de argv |

**Adiados conscientemente (com âncora registrada):**

| Flag | Motivo | Âncora |
|---|---|---|
| `--freeze`, `--freeze-by-task`, `--freezedate` | reescreve master file (status sheets) | **Fase 24** (reancorado 2026-11-03; antes: Fase 19). Núcleo `TaskJuggler.freeze` no core; `execute` devolve `results.freeze.contents`; escrita via `io.writeText` (subfase 24.9) |
| `--check-time-sheet`, `--check-status-sheet` | sheets ainda não portadas | Núcleo: **Fase 18** (já ancorado no core); empacotamento CLI: **Fase 24** (§5.4) |
| `--debug`, `--debuglevel`, `--debugmodules` | hook de debug Ruby | descartado (sem equivalente no port; depurar via testes/`--add-trace`) |

### 5.3 Códigos de saída (fiéis a `apps/Tj3.rb`)

```
0  → sucesso (ou --check-syntax sem erros)
1  → erro de parse, erro de relatório, ou warnings com --abort-on-warnings
```

O **core computa `exitCode`** dentro do envelope com essa matriz (mesma lógica
de retornos/`errors > 0` do Ruby); a CLI apenas chama `io.exit(result.exitCode)`
— nenhum `exit()` nasce no core. Cliffy cuida de erro de flag desconhecida
(exit 1 com mensagem própria), caso em que nem há request.

### 5.4 Complementos pós-`tj3` (decisão 2026-11-03 — varredura `docs/syntaxmesh/xray.md`)

A porta do `tj3` (§5.1–5.3) continua o escopo central. Além dela, a CLI passa a
empacotar recursos adicionais cujo **núcleo vive no core** (regra §3 — "a CLI
empacota, o core pensa"):

| Comando | Equivalente Ruby | Núcleo (quem entrega) | Empacotamento CLI |
|---|---|---|---|
| `syntaxmesh man [--format html\|text\|tjp] [keyword…]` | `apps/Tj3Man.rb` + `UserManual`/`SyntaxReference`/`KeywordDocumentation`/`TjpExample` | **Fase 22** — `doc-core` (`@vanaware/syntaxmesh/doc-core`, subfase 22.1b) + `SyntaxCore`/`TernarySearchTree` da F16 | F24 subfase 24.9 |
| `syntaxmesh ts send` / `syntaxmesh ts receive` / `syntaxmesh ts summary` | `apps/Tj3TsSender/TsReceiver/TsSummary.rb` + `Tj3SheetAppBase` | **Fase 18** — classes `TimeSheetSender/Receiver/Summary` no core | F24 subfase 24.10. **Sem SMTP**: sender devolve o **texto do email** (corpo + anexo codificado) para o usuário enviar; receiver lê o **texto da mensagem** de arquivo/stdin — espelhando a decisão email→download da F18 (ADR da fase sheets) |
| `syntaxmesh ss send` / `syntaxmesh ss receive` | `apps/Tj3SsSender/SsReceiver.rb` | **Fase 18** — `StatusSheetSender/Receiver` no core | F24 subfase 24.10 (mesma política texto-do-email) |
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
> `SHEET_APP_EXIT_OK`/`SHEET_APP_EXIT_ERROR`. O anexo nasce `.tji` no Ruby (o
> receiver só reconhecia essa extensão em `SheetReceiver#SHEET_EXTENSION`);
> desde a decisão 2026-11-07 o SyntaxMesh **gera `.smx`** e **reconhece `.tji`
> por compatibilidade** (tarefa 24.2.36 — ADAPTAÇÃO à regra zero, plano §1.6);
> o `.tjs` citado no adendo 18.18.6 é divergência de documentação, não de
> comportamento.

> Nota: `freeze` (`--freeze*`) também reancorado para **Fase 24** (24.9) —
> era Fase 19. O daemon em si (`tj3d`/`tj3webd`/`tj3client`) permanece **fora de
> escopo**: a funcionalidade análoga é entregue pela camada 3 da Fase 22
> (relatórios embutidos no editor) e pela PWA (Fase 20) — registrar a rejeição
> explícita no plano canônico (xray §3.1). **Nota 2026-11-07:** o *tj3d/tj3webd
> simulado* da Fase 22 (camadas daemon/relatórios) **reaproveita esta mesma API
> `execute`** (adendo §5.1 — consumidores planejados); eventual ampliação do
> contrato (modelo persistente, load/unload/list, gerar sem re-parse) entra por
> adendo a `fase-24-cli-adendo.md`, nunca por API paralela na extensão.

### 5.5 API de execução (`execute` → envelope JSON) e modificador `stdout` (adendo v2)

Especificação completa em [`fase-24-cli-adendo.md`](./fase-24-cli-adendo.md).
Resumo vinculante:

- **DSL:** `stdout` é um modificador booleano opcional posicionado **após o
  nome do relatório e antes da abertura de chaves** (`taskreport "Tarefas"
  stdout { ... }`). Ausência ⇒ `false`. Aplica-se a **todos** os tipos de
  relatório, inclusive os que têm nome de arquivo como primeiro parâmetro
  (`export`, `timesheetreport`, `statussheetreport`). É *intenção*, não ação:
  a presença de `stdout` não altera a validação do relatório (múltiplos
  formatos continuam válidos) e `.tjp` sem `stdout` comporta-se exatamente
  como antes.
- **Core:** `execute(request)` é o **ponto único de entrada** das chamadas de
  linha de comando. Devolve o envelope — `ok`, `exitCode` (dado), `options`
  (eco normalizado com defaults), `messages` estruturadas (`severity`, `id`,
  `text`, `file`, `line`) e `results` com **apenas as seções pedidas**:
  `check`, `listReports`, `reports`, `freeze`, `sheet`, `man`, `help`,
  `version`. A seção `reports` tem o contrato v1 (`reports[]` na ordem de
  declaração, `name` único com validação de duplicata, `stdout`, `formats[]`
  `{ format, content }` como string, `errors[]` por relatório) + campo
  `outputDir` **presente só quando passado no request**. O que era trabalho do
  core chega processado (dynamic attributes, e-mail-texto dos sheets, conteúdo
  do freeze). O core **não** acessa `fs`/`process.stdout`, não lê argv, não
  chama `exit()`, não sanitiza nomes, não decide destino (adendo §3.5).
- **CLI (política, adendo §4):** traduz argv → request, faz **uma** chamada e
  despacha as seções — para cada report/format da seção `reports`:
  `stdout: true` ⇒ imprime no terminal **todos** os formatos na ordem
  declarada, com delimitador `--- <name> [<format>] ---` (nunca misturar
  relatórios sem delimitador); `stdout: false` ⇒ grava `{name}.{ext}` com o
  nome sanitizado no `outputDir` ecoado, sobrescrevendo por padrão. Seções
  `freeze`/`sheet` viram escritas em disco (`io.writeText`, `outbox/*.eml`),
  `check`/`listReports`/`help`/`version` viram impressão estruturada.
  `report.errors` não-vazio ⇒ reportar com clareza; `ok: false` ⇒ reportar
  falha global e não prosseguir com saída parcial (salvo configuração
  explícita); no fim, `exit(result.exitCode)`. A política abortar/continuar
  fica documentada no README da CLI (24.6.5).

**Pontos de projeto (decididos aqui, para implementação fiel):**

1. **Extensão de arquivo:** `{name}.{ext}` onde `ext` espelha a tabela de
   sufixos que o core já calcula em `Report#generate*`/`outputFileName`
   (`csv`→`csv`, `html`→`html`, `markdown`→`md`, `iCal`→`ics`,
   `mspxml`/`niku`→`xml`, `tjp`→`tjp`/`tji` por `definitions`, `json`→`json`,
   `ctags`→sem sufixo). Nos casos do adendo (`csv`, `html`, `txt`)
   `ext === format`; a tabela existe justamente para não divergir do nome
   lógico que o core já produz. Identificador de formato desconhecido/ não
   suportado (ex.: `txt` não está no dispatch de `Report#generate` hoje) vira
   entrada em `reports[].errors`, não throw da CLI.
2. **Conteúdo por formato:** hoje `Report#generate()` sobrescreve `this.output`
   a cada formato do loop (ADR 027 — nada é gravado). A coleta
   `outputs: Map<format, string>` acontece num **único ponto** no loop de
   dispatch de `generate()`, com normalização do CSV (Array-de-Arrays → texto
   `;`, como `CSVFile`) — não em cada `generateXXX` (24.2.14).
3. **Erros por relatório:** o construtor da seção `reports` tira snapshot do
   comprimento de `MessageHandlerInstance.instance.messages` antes/depois de
   cada relatório e atribui o delta (tipos `error`/`fatal`) a
   `reports[].errors`; exceções de geração (formato unknown,
   `NotYetImplementedError` de sheets) também viram entradas ali. A semântica
   global de `errors`/`exitCode` (§5.3) permanece mandando — `errors[]` é por
   relatório, para o consumidor decidir.
4. **Filtro seletivo:** `--report/--reports` são campos do request
   (`report`/`reportsIsRegex`); o construtor da seção aceita seleção interna,
   mas **sem** seleção o contrato é exatamente o do adendo. `--force-reports`
   continua gate do pipeline do core, dispensável pelo request.
5. **Assets auxiliares:** o envelope transporta só o conteúdo de cada
   relatório; a cópia de `css/`, `scripts/` (`wz_tooltip.js`) e `icons/`
   exigida pelo HTML não-`selfcontained` é responsabilidade da política da CLI
   (o core `copyAuxiliaryFiles` é no-op — ADR 027). Tarefa: 24.5.16.
6. **Opções de renderização ficam fora do request:** `--silent`/`--no-color`
   são do renderer da CLI; o envelope devolve `messages` estruturadas e o
   consumidor decide cor/verbosidade. Estado de opções não se retém na CLI: o
   eco `options` é a fonte.
7. **`exitCode` como dado:** o core calcula a matriz do §5.3 no envelope; nenhum
   `exit()`/`Deno.exit`/`process.exit` no core — precedente fiel já usado pelos
   apps de sheet da F18 (`run()` devolve o código, não executa).
8. **`help`/`version` estruturados:** a especificação de opções de execução
   (`OptionSpec[]`) vive no core e alimenta a seção `help` **e** a definição
   Cliffy (fonte única, sem duplicação); `version` vem de
   `AppConfig`/`metadata.json`. A ajuda humana de argv (flag inválida) continua
   sendo do Cliffy, sem request ao core.
9. **Contrato transportável (nota 2026-11-07, adendo §3.6):** request e
   envelope são **dados puros JSON-serializáveis** (sem funções/callbacks) —
   o desenho comportará, sem mudança de forma: (a) um **Web Worker** rodando
   `execute` para a UI da Fase 20 via `postMessage`; (b) arquitetura
   **cliente–servidor** (HTTP/RPC) com `execute` assíncrono e o mesmo envelope
   de resposta — exigindo **isolamento por chamada** (singletons
   `MessageHandlerInstance`/`DataCache` repostos/snapshotados a cada `execute`;
   instância dedicada ou serialização por request no servidor); (c) uso como
   **lib TypeScript** via export raiz do `@vanaware/syntaxmesh` (tipos
   `ExecutionInputFile`/`ExecutionRequest`/`ExecutionResult` públicos). A
   leitura do `project` em memória após o `execute` (resumo 24.4.5) é
   conveniência **in-process**, nunca contrato.

---

## 6. Integração com o core (desancoramento + API `execute` → envelope JSON)

- Mudança no **core** (única alteração de código fora do pacote CLI):
  - `TaskJuggler.parse(files, fileReader)` e `parseContent(content)` recebem um
    **provedor de conteúdo** injetado (assinatura:
      `(path: string) => Promise<string> | string`), substituindo os throws
      `NotYetImplementedError("24", ...)`. A resolução de `include` relativa ao
      arquivo-pai deve seguir `TaskJuggler.rb` (mesma semântica de
      `FileInstance`/`Dir.getwd`). **Escopo do provedor: só o caminho
      passo-a-passo (UI/PWA Fase 20)** — no `execute` (adendo v2.1) o conteúdo
      chega **inline** em `request.files`, sem provedor.
  - Os chamadores futuros (PWA/Fase 19–20) injetarão seu próprio provedor
    (storage/workerdb); a CLI lê master + `include`s via `io.readText` e monta
    `request.files`. **Nada de FS no core.**
  - **Fachada `execute` (adendo v2 §3) — ponto único de entrada:** novo método
    `TaskJuggler.execute(request: ExecutionRequest): Promise<ExecutionResult>`.
    Ele **orquestra por dentro** o que antes a CLI coordenava manualmente
    (a partir de `request.files`: `include` por *lookup* em memória → parse →
    gates → `schedule` → `checkReports` →
    render/operadores pontuais `list`/`freeze`/`man`/sheets) e monta o
    **envelope**: `ok`, `exitCode` (matriz do §5.3, como dado), `options` (eco
    normalizado do request — dos arquivos só os **caminhos**, nunca os
    conteúdos), `messages` (snapshot estruturado do
    `MessageHandlerInstance`: `severity`/`id`/`text`/`file`/`line`) e `results`
    com **apenas as seções pedidas**. Os métodos passo-a-passo
    (`parse`/`schedule`/`generateReports`/`renderReports`/`freeze`)
    permanecem como blocos internos reutilizáveis — a fachada UI/PWA (Fase 20)
    continua orquestrando por eles; `execute` é o atalho canônico dos
    consumidores de linha de comando.
  - **Refatoramento retroativo (nota 2026-11-07, grupo 5 das tarefas —
    24.2.31–37):** as costuras de injeção de arquivo **já entregues** por fases
    anteriores — apps de sheet da F18 com `FileStore` (ADR 036/037:
    `setFileStore`/`requireFileStore`, `TaskJuggler.fileStore`,
    `checkTimeSheet`/`checkStatusSheet` por caminho), `CSVFile.read` (ADR 027),
    hooks de escrita do `XMLDocument` (ADR 038), `ImageResolver` (ADR 026) —
    **não se aplicam na fronteira do `execute`**: conteúdo entra por
    `request.files`/`appOptions` e sai por `results.*`. As interfaces seguem
    válidas no caminho passo-a-passo (Fases 19–20) — rebaixadas, não revogadas
    (adendo §5.1).
  - **Contrato de saída (adendo `stdout`), no lugar do antigo `FileSink`:**
    - **Parser:** keyword `stdout` registrado no lexer/i18n (extensão
      SyntaxMesh sem equivalente Ruby — nas tabelas pt-BR/es o keyword fica
      invariado, mesmo padrão de `template`) e regra opcional
      `reportStdoutFlag` (`p.optional()`, como `optionalID`) acrescentada ao
      final de **todos** os `*ReportHeader` (inclusive aliases `md*`, `export`,
      `rdo`/`breakdown` e cabeçalhos de timesheet/statussheet). A action faz
      `rep.set("stdout", true)`; ausência ⇒ property não definida, lida como
      `false`. Posição inválida (depois das chaves) e duplicata não casam
      transição no FSM ⇒ erro de sintaxe padrão do parser (adendo §2.3).
    - **Modelo:** `Report` lê a flag na renderização; **nome único** é
      validado no registro dos relatórios (duplicata ⇒ erro de validação,
      adendo §3.3).
    - **Seção `results.reports` (`renderReports`):** novo módulo
      `src/reports/reports-json.ts` com
      `renderReports(project, selection?): ReportsJson` (tipos exportados no
      `mod.ts`): percorre `project.reports` em ordem de declaração, reaproveita
      o pipeline existente (`Report#generate` por formato + `outputFileName`),
      coleta `formats[]` com conteúdo string (normalização CSV), captura
      `errors[]` por delta do `MessageHandlerInstance` e define `ok`. Este
      módulo é **o construtor interno da seção `reports`** do envelope (não o
      ponto de entrada público); é implementado **sobre** o mecanismo que já
      existe (ADR 027: `output` em memória, nada de disco) — não criar segundo
      pipeline de render.
    - **Outras seções:** `check` (parse sem agenda), `listReports`, `freeze`
      (`{ fileName, contents }`, escrita é do consumidor), `sheet` (apps da
      F18 devolvem `emailText`/anexos como dados via `appOptions.rawMessage`),
      `man` (doc-core da F22), `help` (`OptionSpec[]`), `version`
      (`AppConfig`/`metadata.json`). Cada seção só é preenchida quando o
      request a pede (adendo §3.4).
    - **Pureza:** nenhum acesso a `fs`/`process`/stdout real no core, nenhum
      `exit()`, nenhum argv (adendo §5.2) — auditado por teste dedicado na
      suíte do core.
  - Registrar em `CURRENT.md` que as âncoras 19/24 de `parse`/`parseContent`
    foram **substituídas por injeção** nesta fase, que a fachada `execute`
    passou a orquestrar o pipeline interno devolvendo o envelope, que a
    intenção `stdout` é consumida apenas pela política da CLI, e que o caminho
    PWA/storage mantém a âncora 19.
- A CLI mantém-se **100% burra**: monta o `ExecutionRequest`, faz **uma**
  chamada `core.execute`, despacha as seções do envelope pela política de
  §5.5 e sai com `exit(result.exitCode)` — não orquestra o pipeline nem retém
  estado das opções (o eco `options` é a fonte).

---

## 7. Estrutura do pacote

```
packages/cli/
├── deno.jsonc               # name: @vanaware/syntaxmesh-cli
│                            # imports: @cliffy/command (jsr), @vanaware/syntaxmesh (workspace)
│                            # tasks: run / check / test / compile
├── src/
│   ├── cli.ts               # entry: argv→ExecutionRequest + uma core.execute + despacho
│   │                        #   das seções do envelope + exit(result.exitCode) (§5.1)
│   ├── options.ts           # mapa flag → ExecutionRequest (testável isolado do Cliffy)
│   ├── io.ts                # camada de compatibilidade (§4.2) — único lugar com node:*
│   ├── output-policy.ts     # envelope → despacho de seções (§5.5): reports → terminal/
│   │                        #   arquivo (delimitadores, {name}.{ext}, sanitização,
│   │                        #   política ok/errors); freeze/sheet/man/check/help/version
│   ├── reporter.ts          # MessageHandler → stdout (cores, silent, contagens)
│   └── summary.ts           # resumo do projeto em terminal (task/resource/finanças)
├── tests/
│   ├── io_test.ts
│   ├── options_test.ts
│   ├── output_policy_test.ts # imprime com delimitador; grava sanitizado; mistos
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
o escopo v1 monolíngue adotado também na Fase 22. **English-first (decisão
2026-11-07, §1.7):** toda saída da ferramenta (mensagens, help, man, templates
de sheet, README) é em inglês; o i18n do core vale só para o parsing de
arquivos de entrada.

| Alvo | Método | Critério |
|---|---|---|
| `io.ts` | unit (Deno) + asserts de paridade node:fs | read/write/exists/mkdir/mkdtemp/exit/args cobertos |
| `args` injetável | unit | parse de flags sem processo real |
| Mapa flag→opção (§5.2) | unit | cada flag v1 mapeia; flags adiadas viram erro claro |
| Exit codes (§5.3) | unit/int | matriz 0/1 incluindo abort-on-warnings e force-reports |
| Parser `stdout` (adendo §2) | unit BDD no parser | aceito em todos os cabeçalhos; erro de posição; duplicata rejeitada; `.tjp` sem `stdout` inalterado (compatibilidade) |
| Envelope `execute` (adendo §3) | unit no core | eco de `options` com defaults; só popula a seção pedida; `messages` estruturadas (`severity`/`id`/`text`/`file`/`line`); `exitCode` conforme matriz §5.3; `dynamicAttributes` aplicados por dentro |
| Seção `reports` (`ReportsJson`, adendo §3) | unit no core | ordem de declaração, flag `stdout` refletida, `formats[]` completos com conteúdo string, `errors[]` por relatório, `outputDir` presente só quando passado, `ok` |
| Pureza do core (adendo §5.2) | teste/audit estático | nenhum `node:fs`/`Deno.*File`/`process`/`exit`/argv além do já permitido no core |
| Política de saída da CLI (adendo §4) | unit + integração | despacho de seções; delimitador por report/format; arquivo `{name}.{ext}` sanitizado; múltiplos formatos; fixture misto `stdout`/não-`stdout`; `exit(result.exitCode)` |
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
  injetado; **API de execução única `core.execute(request)` devolvendo o
  envelope JSON** (eco `options`, `exitCode` como dado, `messages`
  estruturadas, seções `results.*`; a seção `reports` reusa o construtor
  `ReportsJson` do modificador `stdout` na DSL) — core puro (sem FS/terminal/
  política/`exit`/argv), CLI única decisora (terminal com delimitador vs
  arquivo `{name}.{ext}` sanitizado).
- **Alternativas rejeitadas:** `Deno.args`/`Deno.readTextFile` puros (mata
  Bun/Node); `@std/cli` sozinho (perde UX de ajuda/tabelas do Cliffy); driver
  de abstração de storage (overkill — problema é runtime, não storage; ver
  ADR 030); `FileSink` injetado em `generateReports` (política de saída
  vazando para o core — **substituído pelo adendo `stdout`**); **orquestrar o
  pipeline na CLI com `renderReports` como entrada pública (desenho v1)** —
  **substituído pela fachada única `execute`** (adendo v2), que move a
  orquestração para o core e devolve todas as opções e resultados ecoados no
  envelope, registro explícito nesta ADR.
- **Consequências:** core ganha injeção de I/O na fachada e a API `execute` +
  envelope (desejável p/ Fase 19/20 e para os consumidores da Fase 22 — MCP/
  editor —, que leem o mesmo JSON); a CLI deixa de orquestrar o pipeline e passa
  a ser transporte+renderização; `--debug*` fica fora da v1; freeze (24.9) e
  check/sheets (24.10) entram na v2
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
8. `stdout` é **intenção no `.tjp`**, decidida pela CLI: o core só popula a
   seção `reports` do envelope (adendo §3.4). Qualquer `console.log`/escrita
   nascendo no core → pare.
9. A política de §5.5 vive **inteira** em `output-policy.ts` (delimitadores,
   tabela de extensões, sanitização, sobrescrita, abortar/continuar) — flags e
   mensagens não espalham essa decisão pelo pacote.
10. A **orquestração do pipeline é do core** (`execute`): a CLI monta o request,
    faz uma chamada e consome o envelope — não encadeia `parse`→`schedule`→
    `render` nem retém estado de opções (o eco `options` é a fonte).

### Anti-padrões

- ❌ Importar `Deno.*` (exceto em permissões de task) ou `process` fora de `io.ts`.
- ❌ Implementar resolução de `include`/macros/performance na CLI (é do core/parser).
- ❌ Introduzir `node_modules`/`npm install` — dependências via `jsr:`/`npm:`.
- ❌ Usar `as any` (padrão do repo; usar interface de global tipada, §4.2).
- ❌ Criar segunda camada de abstração de FS (além do `io.ts`).
- ❌ Emitir texto de relatório direto do CLI sem passar pela seção `reports`
  do envelope de `execute` (o `generateReports` legado é o caminho da UI, não
  da política da CLI).
- ❌ Orquestrar o pipeline (`parse`→`schedule`→`render`) na CLI — isso é
  trabalho do `core.execute`; a CLI só monta o request e consome o envelope.
- ❌ Decidir destino de relatório no core (imprimir, gravar, sanitizar) — o
  core produz o envelope (seção `reports` = `ReportsJson`); a decisão é do
  consumidor (adendo §3.4).
- ❌ Imprimir relatórios/formatos no terminal sem o delimitador
  `--- <name> [<format>] ---`, ou gravar arquivo com nome não sanitizado.
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
| 24.2 | Injeção de I/O + API `stdout`/`execute` (envelope) no core | `parse/parseContent` desancorados via provedor injetado; parser do modificador `stdout` (+ keyword i18n e nome único); fachada `execute(request)` montando o envelope (`ok`/`exitCode`/`options`/`messages`/`results.*`) com `renderReports` como construtor da seção `reports`; testes de contrato, seções e pureza; **grupo 5 — refatoramento retroativo das costuras de `FileStore` injetado (F18/ADR 037, ADRs 026/027/038) para dados-como-dados na fronteira do `execute`, incl. extensão única `.smx` (24.2.36) (nota 2026-11-07)** | 24.1 |
| 24.3 | Comando + flags + consumo do envelope | `cli.ts` com Cliffy; `options.ts` mapeando §5.2 para o `ExecutionRequest`; **uma** chamada `core.execute` + despacho de seções; exit via `exit(result.exitCode)` §5.3 | 24.2 |
| 24.4 | Saída no terminal | `reporter.ts` (MessageHandler→stdout, cores, silent) + `summary.ts` | 24.3 |
| 24.5 | Relatórios ponta a ponta + política de saída | `output-policy.ts` (terminal com delimitador vs `{name}.{ext}` sanitizado em `--output-dir`), `--report/--reports/--list-reports`, `--force-reports`, `--no-reports`; integração com fixtures mistos `stdout`/não-`stdout` e MWEs | 24.4 |
| 24.6 | Multi-runtime + binário | smoke Bun/Node; `deno compile`; bundle node via `scripts/esbuild.ts`; README por runtime | 24.5 |
| 24.7 | Fidelidade tj3 (golden CLI) | comparação stdout/exit/artefatos vs `tj3` Ruby no subset de fixtures; divergências documentadas (regra zero) | 24.5 |
| 24.8 | Verificação final | `check-all` + `test` + cobertura ≥ 80% + ADR commitado + `CURRENT.md`/`plano.md` atualizados | todas |
| 24.9 | `man` + `freeze` (§5.4) | comando `syntaxmesh man` sobre o `doc-core` da F22 (html/text/tjp) + desancoramento e flags `--freeze*` via `io.writeText` | 24.3, F22 (22.1b) |
| 24.10 | Apps de sheets (§5.4) | `ts/ss send·receive·summary` empacotando as classes da F18 (texto do email, sem SMTP) + `--report` com dynamicAttributes | 24.5, F18 |

Ordem de execução: 24.0 → 24.1 → … → 24.8 (linear; 24.7 pode correr em
paralelo com 24.6). **24.9/24.10 são extensões pós-v1** (§5.4) — executam depois
de 24.8, quando F22 (`doc-core`) e F18 (sheets/dynamicAttributes) estiverem
verdes.

Commits por subfase: `feat(cli): scaffold+io`, `feat(core): file provider`,
`feat(core): stdout+reports-json`, `feat(core): execute-envelope`,
`feat(cli): options+execute-call`, `feat(cli): reporter`,
`feat(cli): reports-pipeline+output-policy`, `chore(cli): multi-runtime`,
`test(cli): golden-tj3`, `docs(cli): ADR da fase`.

---

## 13. Referências cruzadas

- **Fonte de verdade do comportamento:**
  - `docs/taskjuggler/lib/tj3.rb` (entry) e
    `docs/taskjuggler/lib/taskjuggler/apps/Tj3.rb` (flags + fluxo + returns).
  - `docs/taskjuggler/man/tj3.1` (lista completa de flags).
  - `docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb` (`parse/parseFile` e
    semântica de `FileInstance`/include) — portar fielmente para a fachada já
    existente em `packages/core/src/taskjuggler.ts`; a fachada `execute` agrega
    o fluxo do `apps/Tj3.rb: main()` no core (adendo v2 §3).
- **Docs internos:**
  - [`fase-24-cli-adendo.md`](./fase-24-cli-adendo.md) — especificação
    vinculante da API `execute` (envelope JSON com seções), do modificador
    `stdout`, do contrato `ReportsJson` (seção `reports`) e das
    responsabilidades core/CLI (§5.5 deste plano).
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
