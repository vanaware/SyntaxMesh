# Fase 22 — Extensão VS Code (`lsp-core` + tooling de edição)

> **File:** `docs/syntaxmesh/fases/fase-22-vscode-extension.md`
> **Tasks:** [Atomic task document](fase-22-vscode-extension-tarefas.md)
> **Status:** `PAR` — P1 (22.0) accepted 2026-11-11 (ADR 035); **P2 completed
> 2026-11-11** (22.1b closed at 106/108 verified + pure `lsp-core` delivered).
> **P3 completed 2026-11-12** (editor foundation: shell 22.2 + grammar 22.3 +
> transport 22.4; pure-logic coverage 99.2% lines; Web bundles `node:`-free;
> full gate 853 passed). Next block: P4 (execution/reports/UX).
> **Planning:** seven major blocks P1–P7, with subblocks in §0; original IDs
> 22.0–22.11 and existing task blocks C–J remain unchanged.
> **Recorded progress:** 106/108 tasks in 22.1b verified (H 6.9/6.10 outside
> v1); this is not a whole-phase count.
> **Original duration estimate:** 10–14 days; reassess when detailing each block.
> **Technical prerequisites:** existing engine, documentation, template, and F24
> execution API. Storage/PWA phases 19/20 are not prerequisites.
> **Scheduling gate:** finish F21 wave 1 before starting the remaining F22 work.
> P1/P2 kickoff was user-authorized early on 2026-11-11 (no technical dependency
> on the remaining F21¹ tasks); the official order is unchanged.
> **Official order:** 23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³.
> **Handoff:** F21 wave 2 validates the editor extension.
> **Scope:** pure `doc-core`/`lsp-core`, VS Code Desktop/Web adapters, standalone LSP.

---

## 0. Major blocks and subblocks

This is the execution-oriented organization of the existing specification.
Sections §1–§15 remain stable technical references; §13 maps original subphase
IDs to these blocks. No scope is added and no delivered task is reopened by
this reorganization.

`P1`–`P7` identify planning groups, not new task prefixes. The letters C–J
continue to identify the existing 22.1b atomic task blocks. Status codes:
`OK` = delivered/verified scope, `PAR` = partial, `PLA` = planned/not started.
A detailed task list alone does not mean its implementation is complete.

| Block | Subject | Original subphases | References | Current implementation |
|---|---|---|---|---|
| [P1](#p1-scope-and-architecture) | Scope and architecture | 22.0 | §1–§3 overview, §12, §14 | `OK` — ADR 035 accepted (2026-11-11) |
| [P2](#p2-shared-language-and-documentation-cores) | Shared language and documentation cores | 22.1, 22.1b | §4 core, §5; task blocks C–J | `PAR` — rename and CLI docs delivered; LSP pending |
| [P3](#p3-editor-foundation-and-language-tooling) | Editor foundation and language tooling | 22.2–22.4 | §3.1, §4 extension, §6, §7 | `OK` |
| [P4](#p4-project-execution-reports-and-editor-ux) | Project execution, reports, and editor UX | 22.5–22.7 | §3.2–§3.3, §8 | `PLA` |
| [P5](#p5-web-host-and-storage-adaptation) | Web host and storage adaptation | 22.8 | §9; Web transport in §7 | `PLA` |
| [P6](#p6-standalone-lsp-adapter) | Standalone LSP adapter | 22.9 | §4 LSP adapter, §7 stdio, §10 LSP build | `PLA` |
| [P7](#p7-packaging-acceptance-and-handoff) | Packaging, acceptance, and handoff | 22.10–22.11 | §10 extension build, §11, §13 closure | `PLA` |

### P1. Scope and architecture

**Purpose:** establish the common boundaries before detailing implementation.

- **P1.1 — Baseline and scope:** record delivered engine/template/CLI inputs,
  English-only v1 output, `.smx` plus `.tjp`/`.tji` input compatibility, and
  the F21¹ scheduling gate (§1–§2).
- **P1.2 — Layer boundaries:** separate mutable editing analysis, explicitly
  refreshed stable project models, and report presentation (§3).
- **P1.3 — Architecture record:** complete 22.0/ADR 035 using §14; preserve
  Deno dependency management and pure-core/thin-adapter rules (§12).

**Exit:** architecture and exclusions recorded; no automatic daemon reload,
no duplicate parser/LSP intelligence in adapters, and no parallel execution
API. **Met 2026-11-11:** ADR 035 created and accepted; baseline/layers recorded
in the task document (Bloco A); index row flipped to Aceito.

### P2. Shared language and documentation cores

**Purpose:** build reusable services without VS Code or transport dependencies.

- **P2.1 — Workspace and exports (22.1):** verify the already delivered core
  rename, then plan only remaining workspace wiring and `./lsp-core` export
  work (§4.2). Keep `./doc-core` as a separate existing entry point.
- **P2.2 — Documentation model and rendering (22.1b C–G):** preserve search,
  syntax references, keyword data/text/HTML, examples, and manual sources.
  Existing subblocks E.1/E.2/E.3 and G.1/G.2 remain intact. Close the recorded
  missing `checkKeyword`, Markdown projection, and Ruby-oracle tests; retain
  the delivered name `ExampleSnippet` and recorded manual adaptations.
- **P2.3 — Shared syntax/highlight data (22.1b H):** classifications, token
  rules, regions, indentation, and consumer exports. Final Kate XML/Vim file
  generators (22.1b.6.9) remain optional and outside v1 acceptance.
- **P2.4 — Editing analysis and pure LSP services (22.1):** `DocumentStore`,
  locale detection, analysis, diagnostics, hover, completion, navigation,
  semantic tokens, symbols, capabilities, and structural server registration
  (§5). Output remains English; input locale detection does not translate UX.
- **P2.5 — Consumer bridges and verification (22.1b I–J):** help/manual and
  completion bridges 7.5–7.7, exports/purity, smoke/cache, pending goldens,
  and coverage. Preserve the already delivered F24 `generateMan` consumer.

**Dependency rule:** establish P2.1 and the document/analysis foundation of
P2.4 before connecting P2.5. P2.2/P2.3 provide documentation and syntax data
for those bridges. This replaces the apparent cycle "all of 22.1 before
22.1b, but all of 22.1b before help in 22.1" with explicit readiness steps;
it does not change task IDs.

**Exit:** pure public contracts and docs/highlight bridges verified, core
coverage at least 80%, and remaining in-v1 22.1b tasks closed with evidence.
The recorded 86/108 completions stay historical progress, not fresh claims.
**Met 2026-11-11:** 22.1b closed at 106/108 (H 6.9/6.10 outside v1); coverage
`src/lsp/` 96.6% / `src/docgen/` 97.0% lines; full `deno task tests` green
(840 passed / 7023 steps); evidence per atomic ID in the task document.

### P3. Editor foundation and language tooling

**Purpose:** deliver editing support independently of scheduling/report commands.

- **P3.1 — Extension shell (22.2):** manifest, language registration, dual
  entry points, package/workspace scaffolding, and activation lifecycle.
- **P3.2 — TextMate and snippets (22.3):** English grammar, include grammar,
  brackets/comments/folding, and snippets; consume P2 syntax data and the
  existing `template` reference (§6).
- **P3.3 — Client/server integration (22.4):** Desktop IPC and Web
  Worker/MessagePort bootstraps, selectors, incremental synchronization,
  diagnostics, debounce/cancellation, and shared `registerLspServer` (§7).

**Entry:** P1; P2 contracts and syntax data ready for their consumers.
**Exit:** editing integration and grammar snapshots green; incomplete buffer
states never refresh the daemon. Web transport belongs here; complete Web
runtime/storage behavior belongs to P5.

**Delivered (2026-11-12):** `packages/vsextension` shell + dual entries
(22.2); pure grammar/language-config/snippets generators consuming the
`doc-core` `SyntaxCore`, four generated assets and golden snapshots (22.3);
pure adapter/client-options/debounce, Node + Web server/client bootstraps over
`registerLspServer`, and a `deno bundle` build of the four artifacts (Desktop
CJS / Web ESM, `--external vscode`, Web bundles verified `node:`-free) plus a
full-session wiring smoke (22.4). Pure-logic coverage **99.2% lines**. Enabling
core fix: `template-engine.ts` now builds Vento from the browser-safe
`Environment` + `MemoryLoader` + plugins (no `mod.js` `FileLoader`), honoring
the `lsp-core` "no `node:*`" boundary. VS Code Test Runner / `.vsix` acceptance
remains P7. Evidence per atomic task in the task document §P3.

### P4. Project execution, reports, and editor UX

**Purpose:** connect deliberate user actions to stable project execution.

- **P4.1 — Execution-contract audit (start of 22.5):** check F24 `execute`
  against load/reload/list and cached-model reporting. Record any required
  delta in the F24 addendum before implementation; preserve the existing
  stepwise-facade alternative. This block organization chooses neither path.
- **P4.2 — Project daemon (22.5):** add/remove/list/reload, buffer versus
  workspace input, include closure, multi-project cache, invalidation, and
  Desktop persistence (§3.2).
- **P4.3 — Report output policy (22.6):** list/select/generate, HTML Webviews
  with assets, CSV/XML/text workspace saves, and shared envelope consumption
  (§3.3). Cached-model reporting is gated by P4.1, not assumed available.
- **P4.4 — Commands and presentation (22.7):** export/input-language/help, Project Explorer,
  Status Bar, settings, and Workspace Trust (§8). Treat multilingual command
  variants as the already deferred post-v1 addendum, consistent with §1.

**Entry:** P3 integration; resolve P4.1 before daemon/report implementation.
**Exit:** explicit execution, stale-cache behavior, report formats, and trust
checks tested; no save/change watcher feeds the daemon.

### P5. Web host and storage adaptation

**Purpose:** finish vscode.dev behavior without depending on F19 storage.

- **P5.1 — Browser dependency graph:** complete the Web entry point and
  verify absence of Node/process dependencies (§9.1–§9.2).
- **P5.2 — User-triggered workspace writes:** validate permissions and the
  existing write fallback for report/export commands (§9.2).
- **P5.3 — Storage capability fallbacks:** small state through VS Code APIs,
  in-memory daemon when storage URIs are absent, Desktop cache versioning,
  and no direct IndexedDB/OPFS reliance (§9.3).

**Entry:** P3 Web transport and P4 commands.
**Exit:** Web editing/execution/report scenarios verified, including missing
storage and denied writes; transport/core logic is not duplicated.

### P6. Standalone LSP adapter

**Purpose:** expose the same language server to non-VS Code editors.

- **P6.1 — Stdio bootstrap:** independent `packages/lsp` adapter creates the
  connection and calls the shared server registration; no extension import.
- **P6.2 — Executable and protocol smoke:** build `syntaxmesh-lsp --stdio`,
  verify initialize/document/handler flow, and keep logs off JSON-RPC stdout.

**Entry:** P2 server contract verified through P3 integration.
**Exit:** external-editor protocol smoke green. This block does not deliver
socket daemons, SMTP services, or another engine runner. It may be developed
independently of P4/P5 once its entry conditions hold; §13 retains the default
serial sequence.

### P7. Packaging, acceptance, and handoff

**Purpose:** close distributable artifacts and phase-level evidence.

- **P7.1 — Desktop/Web builds (22.10):** bundles, external `vscode` API,
  included assets, exclusions, and `.vsix` below 5 MB (§10).
- **P7.2 — Acceptance matrix (22.10–22.11):** clean installation, grammar,
  LSP, daemon/report/export/input-language/help commands, trust, Web, and stdio
  scenarios (§11).
- **P7.3 — Closure and handoff (22.11):** full quality gate, coverage
  thresholds (80% core, 70% extension), ADR/status/link reconciliation, and
  input artifacts for F21 wave 2. Validation work stays in its original
  owning task; this block collects evidence rather than duplicating tasks.

**Entry:** P2–P6 accepted, excluding explicitly out-of-v1 items.
**Exit:** installable verified `.vsix`, verified standalone server, coherent
planning evidence, and handoff to F21². Packaging is not Marketplace publishing
or deployment authorization.

### Detailing and execution protocol

1. Use the P-block as the scope boundary and the original 22.x ID as task owner.
2. Before starting each unfinished subphase, expand its atomic tasks in the
   existing task document: one deliverable, at most two hours, tests first.
3. Keep existing C–J IDs/completion records; add dependencies and consumer
   links rather than copying tasks into a second list.
4. Record entry/exit evidence and run the relevant tests plus `deno task tests`.
5. Update the task progress, this plan's §13, `CURRENT.md`, and the canonical
   `plano.md` without moving the official phase order.

---

## 1. Contexto

O motor — pacote core **renomeado para `@vanaware/syntaxmesh`**, o pacote
principal do projeto — está completo nas Fases 2–14: parser TJP multilíngue,
scheduler, financeiro e relatórios. A Fase 22 entrega o **tooling de edição**:
uma extensão VS Code que reúne tudo o que apoia o usuário a entender e usar a
sintaxe de planejamento — highlight, autocomplete, diagnósticos, hover,
navegação, **help e manual** — além da integração com o motor (agendamento,
geração de relatórios).

The remaining F22 work starts **after F21 wave 1** and hands off to **F21
wave 2**, before Storage (19) and PWA/UI (20). Engine availability is a technical
prerequisite, not authorization to bypass that scheduling gate. The CLI-facing
part of 22.1b was delivered early to unblock F24 `man`; its remaining editor
consumers are organized in P2.

O design segue o modelo do TaskJuggler original (**tj3d / tj3client /
tj3webd**): separar **edição** (LSP, análise incremental do buffer) de **modelo
de projeto estável** (daemon alimentado sob demanda pelo usuário) e de
**relatórios** (geração a partir do modelo em cache).

**Nota (2026-11-07):** as camadas **daemon** e **relatórios** — o *tj3d
simulado* — reaproveitam **a mesma API de execução `core.execute(request)`**
criada para a CLI na Fase 24 (adendo `fase-24-cli-adendo.md`, v2/v2.1: envelope
JSON com seções; entrada `request.files` de `{ path, content }` com o
fechamento de `include`s, sem provedor; conteúdos não voltam no envelope). Não
há fork de API para a extensão: se os conceitos de `tj3d`/`tj3client`/`tj3webd`
exigarem algo que o contrato atual não cobre (p. ex. modelo de projeto
persistente no core, load/unload/list, gerar relatório sem re-parse), **a
própria API é ampliada** — o delta entra pelo adendo da Fase 24 (source of
truth) com tarefas planejadas no kickoff de 22.5/22.6 (§3.2/§3.3).

A extensão deve ser compatível com dois Extension Hosts:

- **Node.js Extension Host** (desktop e sessão remota).
- **Web Extension Host** (vscode.dev), sem `node:*` e sem processos externos.

Toda a lógica de linguagem (parsing, semântica, regras LSP, help/manual) vive no
**core**, exportada como **`@vanaware/syntaxmesh/lsp-core`** — um contrato puro,
testável em Deno sem VS Code. A extensão e o CLI são **adaptadores finos**.

### Escopo v1 — inglês

A primeira iteração da extensão é **monolíngue (`en`)**: grammar TextMate,
snippets, completions, diagnósticos, help e manual apenas em inglês. É também a
política global da ferramenta nesta etapa — **English-first em toda saída**
(decisão 2026-11-07, `02-principios.md` e `fase-24-cli.md` §1.7): o tool emite,
responde e interage só em inglês; o i18n vale apenas para o **parsing** de
arquivos de entrada. O i18n do
motor (Fase 10) e o `resolveLocale` do `lsp-core` continuam existentes e prontos
— a UX da extensão apenas os fixa em `en`. Suporte PT/ES na extensão vira
**adendo**, a ser executado após a Fase 21.

> ⚠️ O **parser pt-BR/es é experimental** (decisão 2026-11-07) e sujeito a
> mudanças — vocabulário, sinônimos, unidades e cobertura podem ser
> renegociados sem aviso. A **recomendação atual** ao usuário é escrever
> projetos em **inglês**; a grammar TextMate v1, os snippets, o `doc-core` e o
> `resolveLocale` tratam pt/es como **piso de compatibilidade** do motor (ver
> `04-linguagem-multilingue.md` e `02-principios.md`).

### Reuso de implementações existentes

| Fonte                                                          | O que aproveitar                             |
| -------------------------------------------------------------- | -------------------------------------------- |
| `taskjuggler-lsp` (C) — github.com/devrintalen/taskjuggler-lsp | Referência de gramática e comportamentos LSP |
| `vim-taskjuggler` — github.com/kalafut/vim-taskjuggler         | Lista de keywords para a grammar TextMate    |
| `taskjuggler-mode.el`                                          | Snippets e estrutura de edição               |
| Kate syntax (ktexteditor)                                      | Estrutura de contextos de highlight          |
| `docs/syntaxmesh/11-referencia-template.md` (Fase 23, 23.8.1)   | Grammar, completions, snippets e help de `template` já têm referência normativa pronta |

A linha acima é insumo, não pendência: o elemento `template` (ADR 033) foi
entregue na Fase 23 com declaração, chamada, tipos de valor, tabela de erros e
mapa de testes em `docs/syntaxmesh/11-referencia-template.md`. A grammar TextMate
e o `doc-core`/help do `lsp-core` devem cobri-lo em v1 (`en`, keyword
`template`), sem esperar novo material de referência.

---

## 2. Objetivo

Ao final desta fase:

- Preserve the delivered `@vanaware/syntaxmesh` core identity, existing
  `"."`/`"./doc-core"` exports, and consumer imports; finish only the remaining
  workspace wiring and `"./lsp-core"` export (P2.1).
- `lsp-core` exportado pelo core (`@vanaware/syntaxmesh/lsp-core`) com handlers
  puros: diagnostics, hover, completion, definition/references, semantic tokens,
  document/workspace symbols, **help/manual** (referência de keywords e
  documentação embutida), DocumentStore incremental, resolução de locale e
  **registro do servidor** (`registerLspServer`). Toda a inteligência do LSP
  mora no core; extensão e CLI são bootstrap mínimo.
- **`doc-core` — núcleo de documentação e sintaxe inteiro nesta fase** (novo
  subpath export `@vanaware/syntaxmesh/doc-core`, decidido 2026-11-03): port
  completo de `SyntaxReference.rb`, `KeywordDocumentation.rb`, `TjpExample.rb`
  e `UserManual.rb` (base do help/manual do LSP e dos exemplos `[[[…]]]`),
  **mais** o `TernarySearchTree` (16.9 **MOVIDO** para cá) e o `SyntaxCore`/
  highlight (núcleo de `KateSyntax`/`VimSyntax`, 16.14 **MOVIDO** para cá) —
  o núcleo de docs/sintaxe todo desenvolvido nesta fase, como subfase 22.1b.
  A **Fase 24** expõe esse núcleo como comando `man` da CLI (equivalente ao
  `tj3man`) — ver `fase-24-cli.md` §5.4.
- **v1 em inglês** (grammar, snippets, completions, mensagens, help); PT/ES como
  adendo pós-Fase 21.
- Extensão VS Code (`packages/vsextension`) funcional em **desktop** e
  **vscode.dev**:
  - Language contribution: `contributes.languages` (id `syntaxmesh`, extensão
    nativa `.smx` + `.tjp`/`.tji` por compatibilidade — decisão 2026-11-07,
    `fase-24-cli.md` §1.6), grammar TextMate (**EN na v1**),
    `language-configuration.json`, snippets.
  - Cliente LSP + servidor embutido — o servidor é apenas bootstrap de
    transporte; o wiring do protocolo vem do `lsp-core` (`registerLspServer`).
  - Daemon de projetos (adicionar/remover/listar/recarregar) **sem escuta
    automática**.
  - Relatórios: listagem a partir do modelo em cache, Webview para HTML, salvar
    no workspace para CSV/XML/texto.
  - Views (árvore do projeto) e Status Bar (locale detectado, última execução).
- Servidor LSP CLI independente (`packages/lsp`, `--stdio`) para Neovim/Helix.
- `.vsix` empacotado (< 5 MB), testado em instalação limpa.
- ADR da fase registrado (**035** na cadeia da ordem oficial; conferir README).
- Testes: unitários do `lsp-core` em Deno puro (cobertura ≥ 80%), integração no
  VS Code Test Runner (cobertura ≥ 70% no pacote da extensão).

---

## 3. Arquitetura: três camadas

```
Arquivo .tjp
    │
    ├─ Camada 1 — Edição (LSP): highlight, autocomplete, hover, diagnósticos.
    │       Análise incremental do buffer; NUNCA alimenta o daemon.
    │
    ├─ Camada 2 — Daemon: usuário aciona "Adicionar/Recarregar Projeto".
    │       core (parse + schedule) → ProjectModel estável em cache.
    │
    └─ Camada 3 — Relatórios: lista do modelo em cache → gerar HTML (Webview)
            ou CSV/XML/texto (salvar no workspace). Sem reanálise.
```

### 3.1 Camada de edição (LSP)

- Responsável por highlight, autocomplete, ajuda/manuais e diagnóstico **durante
  a edição**.
- Analisa incrementalmente o buffer em edição, mas **não alimenta o daemon**:
  estados intermediários com sintaxe incompleta nunca entram no modelo de
  projeto estável.
- `vsextension/src/client/`: `LanguageClient` inicia o servidor embutido e
  registra capacidades.
- O **registro do servidor LSP vive no `lsp-core`** (`registerLspServer`):
  capabilities, sincronização de documentos e todos os handlers são conectados a
  uma conexão LSP via **interface estrutural mínima** — sem importar
  `vscode-languageserver` (o `Connection` do `vscode-languageserver` satisfaz a
  interface estruturalmente).
- `vsextension/src/server/mod.ts` e `packages/lsp/mod.ts`: apenas **bootstrap de
  transporte** — criar a conexão (IPC/port/stdio) e chamar
  `registerLspServer(connection)`. Nenhuma inteligência de LSP neles.
- `package.json` declara `contributes.languages` e `contributes.grammars`
  (TextMate para coloração básica); `contributes.commands` expõe comandos de
  ajuda/manuais (Webview ou navegador).

### 3.2 Camada de daemon (análogo ao tj3d/tj3client)

- Mantém modelos de projeto **estáveis e agendados** em memória.
- **Comandos de gerenciamento** (análogos ao tj3client):
  - `SyntaxMesh: Adicionar Projeto ao Daemon` — seleciona `.tjp`, analisa,
    agenda, armazena em cache.
  - `SyntaxMesh: Remover Projeto do Daemon`
  - `SyntaxMesh: Listar Projetos`
  - `SyntaxMesh: Recarregar Projeto` (após o usuário concluir a edição)
- **Sem escuta automática**: não vincular `onDidChangeTextDocument` nem
  `onDidSaveTextDocument` ao daemon. O usuário controla explicitamente quando o
  modelo é atualizado. _(Esta decisão substitui o antigo
  `syntaxmesh.scheduleOnSave`.)_
- **Cache**: `Map<string, ProjectModel>` chaveado pelo `uri.toString()` do
  `.tjp`.
  - **Desktop**: serializar em `context.storageUri`, carregar na inicialização;
    recarga manual após edição.
  - **Web**: apenas em memória (IndexedDB do Web Worker Host tem origem
    instável).
- **Consistência**: ao adicionar, ler o buffer em edição (`document.getText()`)
  ou o disco, conforme escolha do usuário; ao recarregar, sempre ler o estado
  atual.
- **Entrada do engine = `execute` (Fase 24, adendo v2/v2.1 — nota
  2026-11-07)**: adicionar/recarregar é **uma** chamada
  `core.execute(request)` com `request.files` montado pela extensão (master do
  buffer `document.getText()` ou `workspace.fs.readFile`; fechamento de
  `.smx`/`.tjp`/`.tji` (indiferente — o closure de `include`s é por caminho,
  não por extensão) lido via `workspace.fs` — sem provedor e sem FS
  no core). As `messages` do envelope alimentam o Problems panel; `exitCode`
  vira status; o que for pedido sai como **dados** (`check`, `reports` etc.).
  O cache multi-projeto (`Map<uri, ProjectModel>`) continua responsabilidade da
  extensão — o core permanece puro, sem estado entre chamadas.
- **Ampliação necessária = planejada, não improvisada**: o `execute` atual é
  one-shot (parse → schedule → seções pedidas). Se convier manter o modelo
  carregado no core (relatórios sem re-parse; semântica `tj3client`
  load/unload/list-projects), a ampliação vira **adendo à Fase 24** (source of
  truth) com propagação ao plano/tarefas da F24 — tarefa de auditoria de
  compatibilidade no kickoff de 22.5. A alternativa sem delta já existente é a
  fachada passo-a-passo (`parse`/`parseContent` com provedor → `schedule` →
  `generateReports`/`renderReports`), compartilhada com o caminho UI/PWA
  (Fase 20).

> **Decisão P4.1 (auditoria 2026-11-12, confirmada pelo usuário):** o daemon v1
> é **execute-based, sem delta no core**. O cache `Map<uri, ProjectModel>` vive
> na extensão e guarda o **fechamento de arquivos** + o **último envelope**
> (`listReports`/`reports`/`messages`/`exitCode`); add/reload/list/generate são
> chamadas `execute` com `request.files` remontado do estado atual. A geração
> de relatório **re-parseia + reagenda** (one-shot); a listagem usa a seção
> `listReports` do último envelope. O **relatório sem re-parse** (modelo
> persistente no core) fica **adiado como delta futuro do adendo F24**
> (source of truth), com a fachada passo-a-passo preservada como alternativa.
> Registrado em `fase-24-cli-adendo.md` §5.1 e nas tarefas 22.5.

### 3.3 Camada de relatórios (análogo ao tj3webd)

- **Listagem**: relatórios definidos no `.tjp` (nome, formato), lidos do modelo
  em cache — análogo a `tj3client list-reports <project_id>`.
- **Seleção**: QuickPick ou Webview para escolher relatórios e destino.
- **Ramificação por formato**:
  - **HTML**: Webview; recursos associados (CSS/JS/imagens) empacotados e
    injetados como URIs `vscode-webview-resource`; botão "Salvar no Workspace"
    (inclui recursos).
  - **CSV / XML (MSPDI) / texto puro**: **não** exibir na Webview; oferecer
    diretamente "Salvar no Workspace" via `workspace.fs.writeFile`.
- **Geração**: consome o modelo em cache (sem reanálise), serializa e
  apresenta/salva.
- **Mesma API (nota 2026-11-07)**: listagem e geração também fluem pelo
  `execute` — `request.listReports` devolve a seção `listReports` (análogos
  `tj3client list-reports`/`tj3webd` de índice) e `request.report`/
  `reportsIsRegex` (com `outputDir` quando aplicável) devolvem a seção
  `reports` com conteúdos como dados. Ramificação Webview/recursos e
  `workspace.fs.writeFile` são **política de saída da extensão** (simétrica à
  `output-policy.ts` da CLI). Se a auditoria de 22.5 optar por modelo
  persistente no core, a geração sai da ampliação do adendo F24; se optar pela
  fachada passo-a-passo, o contrato do envelope permanece intocado.

---

## 4. Estrutura de pacotes

```
packages/
├── core/                    # Pacote principal: análise, planejamento, relatórios, LSP, help/manual
│   ├── deno.jsonc           # name: @vanaware/syntaxmesh
│   │                        # exports: existing "." / "./doc-core"; planned "./lsp-core"
│   ├── mod.ts               # Exporta análise/planejamento/relatórios
│   └── src/
│       ├── parser/ …        # (existente) engine já implementada nas Fases 2–14
│       └── lsp/             # lsp-core: apoio ao usuário (lógica pura, sem vscode-languageserver)
│           ├── mod.ts       # Ponto de entrada "./lsp-core"
│           ├── capabilities.ts  # ServerCapabilities como objeto puro
│           ├── documents.ts # DocumentStore puro (Map<string, string>, sync incremental)
│           ├── locale.ts    # resolveLocale(uri, text): "pt-br" | "en" | "es" (v1 da extensão usa "en")
│           ├── help.ts      # Referência de keywords/sintaxe + manual embutido (v1: EN)
│           ├── analyze.ts   # analyzeDocument: parse + AST + erros (reuso incremental)
│           ├── diagnostics.ts   # erros/avisos → Diagnostic[] (LSP types)
│           ├── hover.ts         # hover markdown sobre nós da AST
│           ├── completion.ts    # keywords do idioma + nomes definidos
│           ├── navigation.ts    # definition / references
│           ├── semantic-tokens.ts # tokens + legend estável
│           ├── symbols.ts       # documentSymbol (hierárquico) / workspaceSymbol
│           └── server.ts        # registerLspServer(connection): wiring do protocolo (interface estrutural)
├── vsextension/             # Extensão VS Code (adaptador: cliente + servidor + daemon + relatórios)
│   ├── deno.jsonc           # name: @vanaware/syntaxmesh-vscode
│   │                        # exports: { ".": "./src/extension.node.ts" }
│   ├── package.json         # Manifesto VS Code (obrigatório; não gerencia dependências)
│   ├── syntaxes/            # Grammars TextMate (.tjp, .tji)
│   ├── snippets/            # syntaxmesh.json
│   ├── src/
│   │   ├── extension.node.ts    # Entrada Node.js (main)
│   │   ├── extension.web.ts     # Entrada Web (browser)
│   │   ├── client/              # LanguageClient (node e browser variants)
│   │   ├── server/              # Bootstrap de conexão: createConnection + registerLspServer do core
│   │   ├── daemon/              # Gerenciador de projetos (análogo ao tj3d)
│   │   ├── reports/             # Seleção e geração de relatórios (análogo ao tj3webd)
│   │   ├── views/               # Project tree (TreeDataProvider) + status bar
│   │   ├── commands/            # Comandos (daemon, relatórios, export, switch-language)
│   │   ├── config/              # Leitura de settings syntaxmesh.*
│   │   └── webview/             # Painéis de relatório
│   ├── scripts/build.ts
│   └── dist/
│       ├── extension.node.js
│       └── extension.web.js
└── lsp/                     # Servidor LSP CLI independente (adaptador)
    ├── deno.jsonc           # name: @vanaware/syntaxmesh-lsp
    ├── mod.ts               # CLI --stdio: createConnection + registerLspServer do lsp-core
    └── scripts/build.ts
```

> **Nota:** a alternativa anterior (pacote `packages/core/lsp-core/` separado e
> LSP hospedado em Worker com o motor em Worker próprio) foi **substituída**:
> `lsp-core` vive em `core/src/lsp/` como subpath export, e o servidor LSP roda
> embutido no bundle da extensão (IPC no desktop, Worker/port no Web). O motor é
> invocado pela camada de daemon dentro do Extension Host, não por Worker
> separado.

### 4.1 Responsabilidades por pacote

#### `core`

- **Função:** análise sintática, motor de planejamento, geração de relatórios
  **e toda a lógica LSP**.
- **Dependências:** nenhuma dependência de runtime (compatível com browser
  bundle). **Não importa** `vscode` nem `vscode-languageserver`.
- **Entry points:** existing `"."` and `"./doc-core"`; planned `"./lsp-core"`.
  `"./doc-core"` → `src/docgen/mod.ts` remains separate from the root export and
  supplies P2 documentation/highlight data to CLI and editor consumers.
  - `"."` → `mod.ts`: análise/planejamento/relatório (I/O injetado pelo
    chamador), incluindo listagem de relatórios definidos no `.tjp`.
  - `"./lsp-core"` → `src/lsp/mod.ts`: contrato LSP puro — `capabilities`,
    handlers, `DocumentStore`, `help`/manual, `registerLspServer`, tipos. Tudo o
    que apoia o usuário a entender a sintaxe e o uso do SyntaxMesh (highlight,
    autocomplete, hover, help, manual) — incluindo o wiring do servidor LSP.
- **I/O:** leitura de arquivos é injetada pelo chamador (extensão usa
  `vscode.workspace.fs`; CLI usa `Deno.readTextFile` ou `node:fs`).
- **Única dependência nova:** `npm:vscode-languageserver-types@^3` (apenas
  tipos) no `imports` do core.

#### `vsextension`

- **Função:** extensão completa — cliente LSP, servidor LSP embutido
  (adaptador), daemon, relatórios, Webview, views, publicação.
- **Dependências:** `vscode` (API de extensão), `vscode-languageclient` +
  `vscode-languageserver` (adaptadores).
- **Entradas duplas:** `extension.node.ts` e `extension.web.ts`; o VS Code
  escolhe pelo campo `browser` do `package.json`.
- **Servidor embutido:** `src/server/mod.ts` é apenas **bootstrap de
  transporte** — cria a conexão (`vscode-languageserver/node` ou `/browser`) e
  chama `registerLspServer` do `@vanaware/syntaxmesh/lsp-core`. A inteligência
  do servidor LSP **não mora aqui**, morando no core junto dos handlers.

#### `lsp`

- **Função:** servidor LSP CLI independente para Neovim, Helix e outras
  ferramentas.
- **Dependências:** `vscode-languageserver` (apenas para o transporte stdio);
  usa `@vanaware/syntaxmesh/lsp-core` diretamente — nada é compartilhado com a
  extensão além do próprio core.
- **Empacotamento:** bundle executável (`syntaxmesh-lsp`) com suporte a
  `--stdio`.

### 4.2 Workspace `deno.jsonc` (raiz) — renome e junção

P2.1 / original owner 22.1:

1. **Delivered baseline:** the core is already `@vanaware/syntaxmesh`; the root
   no longer has the conflicting package name. Verify, do not repeat the rename.
2. **Delivered baseline:** consumer imports use the core identity. Preserve them
   and the separate `"./doc-core"` export delivered for F24.
3. **Pending:** add `"./packages/vsextension"` and `"./packages/lsp"` to
   `workspace` when their scaffolding is created.
4. **Pending:** add `"./lsp-core"` and aggregate build tasks; retain the existing
   `"."` and `"./doc-core"` entry points:

```jsonc
{
  "tasks": {
    "build:vsext": "cd packages/vsextension && deno task build",
    "build:lsp": "cd packages/lsp && deno task build"
  }
}
```

---

## 5. Contrato `lsp-core`

API exportada por `@vanaware/syntaxmesh/lsp-core` (funções puras;
posições/intervalos nos tipos do `vscode-languageserver-types`). **v1:
mensagens, help e manual apenas em inglês** — as assinaturas com `locale` já
existem para o adendo multilíngue pós-Fase 21.

| Função                                                    | Responsabilidade                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveLocale(uri, text): "pt-br" \| "en" \| "es"`       | Detecta `language "..."` no texto; default `"en"` (v1 da extensão sempre consome `"en"`)                                                                                                                                                                                                                                               |
| `analyzeDocument(uri, text, opts): AnalysisResult`        | `ProjectFileParser.parse`; popula AST, erros, `version`; aceita `previous` para reuso incremental                                                                                                                                                                                                                                      |
| `toDiagnostics(ast, errors): Diagnostic[]`                | Erros de sintaxe e referência → `Error`; avisos → `Warning`; mensagens em inglês (v1)                                                                                                                                                                                                                                                  |
| `getHover(ast, position): Hover \| null`                  | Markdown com tipo do nó, atributos principais, localização; `null` quando não há nada útil                                                                                                                                                                                                                                             |
| `getCompletions(ast, position, locale): CompletionItem[]` | Keywords do idioma (v1: `en`) + nomes definidos (tasks, resources, accounts); `kind` apropriado (`Keyword`, `Reference`, `Property`)                                                                                                                                                                                                   |
| `getKeywordHelp(keyword, locale): MarkdownString \| null` | Referência embutida da sintaxe/uso de cada keyword (v1: `en`) — alimenta o hover "ver manual" e o comando de ajuda                                                                                                                                                                                                                     |
| `getManualToc() / getManualPage(id): MarkdownString`      | Manual do usuário embutido no pacote: formato `.tjp`, conceitos de planejamento, exemplos (v1: `en`)                                                                                                                                                                                                                                   |
| `getDefinition(ast, position): Location \| null`          | Salto para declaração em referências (`!id`, nomes)                                                                                                                                                                                                                                                                                    |
| `getReferences(ast, position): Location[]`                | Usos do símbolo; cross-file quando ASTs agregadas                                                                                                                                                                                                                                                                                      |
| `getSemanticTokens(ast): number[]`                        | Keywords, identificadores, strings, números, datas, comentários; `legend` estável sincronizada com o cliente                                                                                                                                                                                                                           |
| `getDocumentSymbols(ast): DocumentSymbol[]`               | Árvore hierárquica (project → task → subtask)                                                                                                                                                                                                                                                                                          |
| `getWorkspaceSymbols(asts): SymbolInformation[]`          | Busca case-insensitive por nome                                                                                                                                                                                                                                                                                                        |
| `DocumentStore`                                           | `Map<uri, text>` com aplicação de `didChange` incremental (range edits)                                                                                                                                                                                                                                                                |
| `capabilities`                                            | Objeto puro de `ServerCapabilities` (sync incremental, hover, completion, definition, references, semantic tokens, document/workspace symbols)                                                                                                                                                                                         |
| `registerLspServer(connection): void`                     | Wiring do protocolo LSP: aplica `capabilities` no `initialize`, conecta `DocumentStore` (`didOpen`/`didChange`/`didClose`), emite `publishDiagnostics` e registra todos os handlers. Recebe uma **interface estrutural mínima** (`ServerConnection`) que o `Connection` do `vscode-languageserver` satisfaz — o core não importa a lib |

### 5.1 Proibições do `lsp-core` (verificáveis por grep)

- ❌ **Não importa** `vscode-languageserver` nem `vscode-languageclient` (só
  `-types`).
- ❌ **Não importa** `vscode`, `Deno.stdin`/`Deno.stdout`, `node:*`.
- ❌ **Não abre conexões nem transports** — criar a conexão pertence aos
  bootstrap (vscode/CLI); o wiring do protocolo (`registerLspServer`) sim, pois
  recebe a conexão por interface estrutural.
- ✅ Roda e é testado **em Deno puro** e em browser (smoke test sem VS Code).

---

## 6. Language contribution (TextMate + snippets)

- `syntaxes/syntaxmesh.tmLanguage.json` (escopo `source.syntaxmesh`) com
  patterns para:
  - Estruturas: `project`, `task`, `resource`, `account`, `shift`, `report`,
    `scenario`.
  - Relações/estendidas: `depends`, `precedes`, `allocate`, `chargeset`,
    `material`, `timebasis`.
  - Tempo/esforço: `effort`, `duration`, `length`, `start`, `end`, `milestone`.
  - Literais: strings, números, datas, comentários (`#`, `//`, `/* */`).
- `syntaxes/syntaxmesh-tji.tmLanguage.json` (escopo `source.syntaxmesh.tji`):
  importa a grammar `.tjp` + `include`.
- **v1: grammar apenas em inglês** (lista de keywords `en` do módulo i18n do
  core; reaproveitar conceitualmente Vim/Emacs/Kate). Variante PT/ES é
  **adendo** executado após a Fase 21.
- `language-configuration.json`: brackets, auto-closing, comentários, folding.
- `snippets/syntaxmesh.json`: `project`, `task`, `resource`, `account`,
  `report`, `material` — em inglês (v1), com placeholders para idiomas futuros.
- Semantic tokens (via `lsp-core`) refinam o highlight básico do TextMate.

---

## 7. Cliente e servidor LSP — transporte por host

| Host                                 | Servidor                                                    | Transporte                                               |
| ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| **Desktop (Node Extension Host)**    | bootstrap `src/server/mod.ts` + `registerLspServer` do core | `vscode-languageclient/node` (IPC)                       |
| **Web (vscode.dev)**                 | Mesmo adaptador, empacotado para browser                    | `vscode-languageclient/browser` sobre Worker/MessagePort |
| **Editores externos (Neovim/Helix)** | `packages/lsp` (CLI) — mesmo `registerLspServer` do core    | `--stdio`                                                |

Regras:

- O `registerLspServer` (no `lsp-core`) registra `initialize` com as
  `capabilities`, cuida de `didOpen`/`didChange` (incremental)/`didClose` sobre
  o `DocumentStore` e emite `publishDiagnostics` após cada análise. As entradas
  da extensão e do CLI **só criam a conexão** — nenhum handler ou regra de
  protocolo fora do core.
- `clientOptions.documentSelector` restrito a `syntaxmesh` (`.smx` nativa +
  `.tjp`/`.tji` por compat); `synchronize.fileEvents` com watcher dessas
  extensões para reanálise de arquivos fechados.
- ❌ **Nunca** `console.log` no canal do servidor LSP (corrompe JSON-RPC); usar
  `connection.console`/`vscode.window` loggers.
- Debounce de reanálise no cliente; cancelamento de request anterior.

---

## 8. Views, Status Bar e configuração

### 8.1 Project Explorer + Status Bar

- `src/views/project-tree.ts`: `TreeDataProvider` sobre o modelo do daemon —
  `getChildren` lista tasks, resources, accounts, shifts, reports; `getTreeItem`
  com ícone e `collapsibleState`; refresh após add/reload/schedule.
- `src/views/status-bar.ts`: estado do parser/daemon, locale detectado e última
  execução.

### 8.2 Comandos

P4.4 owns this command inventory. The labels below are historical descriptions,
not v1 UI strings: emitted command titles are English. Switching the input-file
`language` directive is distinct from translating the UI; preserve that planned
command and its tests. Translated UX variants remain the post-v1 addendum in §1.

| Comando                                   | Camada     | Descrição                                                       |
| ----------------------------------------- | ---------- | --------------------------------------------------------------- |
| `SyntaxMesh: Adicionar Projeto ao Daemon` | Daemon     | Seleciona `.tjp`, analisa+agenda, cacheia                       |
| `SyntaxMesh: Remover Projeto do Daemon`   | Daemon     | Remove e invalida cache                                         |
| `SyntaxMesh: Listar Projetos`             | Daemon     | QuickPick com projetos em cache                                 |
| `SyntaxMesh: Recarregar Projeto`          | Daemon     | Re-analisa+agenda a partir do estado atual                      |
| `SyntaxMesh: Gerar Relatório`             | Relatórios | Lista relatórios do modelo, seleciona, gera (Webview ou salvar) |
| `SyntaxMesh: Exportar .tjp`               | Relatórios | Serialização canônica do modelo                                 |
| `SyntaxMesh: Alternar Idioma`             | Edição     | Reescreve `language "..."` no `.tjp` ativo                      |
| `SyntaxMesh: Mostrar Árvore do Projeto`   | Views      | Abre/foca a view                                                |
| `SyntaxMesh: Abrir Manual`                | Edição     | Help no Webview/navegador                                       |

### 8.3 Configuração (`contributes.configuration`)

| Setting                           | Default  | Comportamento                                                                                                                                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `syntaxmesh.locale`               | `"auto"` | `auto` respeita `language "..."` do arquivo; `en`/`pt-BR`/`es` atuam apenas como **default quando o arquivo não tem diretiva** — a diretiva do arquivo **nunca é sobrescrita** |
| `syntaxmesh.lsp.trace.server`     | `"off"`  | Trace LSP (`off`/`messages`/`verbose`)                                                                                                                                         |
| `syntaxmesh.report.defaultFormat` | `"html"` | Formato preferido no comando Gerar Relatório                                                                                                                                   |

> ❌ Removido do plano anterior: `syntaxmesh.scheduleOnSave` — substituído pelo
> modelo de daemon com atualização manual explícita (§3.2).

### 8.4 Segurança / Workspace Trust

- Não executar planejamento automaticamente em workspaces não confiáveis; gatear
  comandos de daemon/relatórios com `vscode.workspace.isTrusted`.

---

## 9. Compatibilidade Web (vscode.dev) e armazenamento

### 9.1 Habilitação

```json
{
  "main": "./dist/extension.node.js",
  "browser": "./dist/extension.web.js"
}
```

### 9.2 Limitações do ambiente Web

- **Sem `node:*`** em `extension.web.ts` e suas dependências (o core já é
  browser-compatível).
- **`storageUri`/`globalStorageUri` podem ser `undefined`**.
- **Operações Git indisponíveis** (sem `child_process`): desabilitar ou exibir
  mensagem amigável na entrada Web.
- **IndexedDB/OPFS não confiáveis** no Web Worker Extension Host (origem nova a
  cada carregamento) — não usar diretamente.
- **Escrita no workspace**: `workspace.fs.writeFile` só por interação do usuário
  e em janela de permissão curta; fallback stub (escrever arquivo vazio
  imediatamente após o clique, depois sobrescrever).

### 9.3 Estratégia de armazenamento

| API                        | Escopo    | Adequado para                      | Comportamento no Web                      |
| -------------------------- | --------- | ---------------------------------- | ----------------------------------------- |
| `context.globalState`      | Global    | Chave-valor pequeno, configurações | Persiste via IndexedDB interno do VS Code |
| `context.workspaceState`   | Workspace | Chave-valor pequeno por projeto    | Persiste via IndexedDB interno do VS Code |
| `context.storageUri`       | Workspace | Cache serializado do daemon        | **Pode ser `undefined`**                  |
| `context.globalStorageUri` | Global    | Arquivos grandes globais           | **Pode ser `undefined`**                  |
| `context.secrets`          | Global    | Dados sensíveis (tokens)           | Criptografia DKE no Web                   |

**Estratégia SyntaxMesh:** dados pequenos → `globalState`/`workspaceState`;
cache do daemon → memória (ambos) + `storageUri` no Desktop com versionamento do
formato (invalidar cache se o formato do modelo mudar); relatórios grandes →
Node usa `storageUri`, Web gera sob demanda sem persistência entre
recarregamentos.

---

## 10. Estratégia de build e empacotamento

| Pacote               | Ferramenta                                        | Saída                          | Observação                                                        |
| -------------------- | ------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `core`               | — (source TS via workspace)                       | —                              | `vsextension`/`lsp` importam do source                            |
| `vsextension` (Node) | `@vsce/bundler` (jsr:@vsce/bundler@^1) ou esbuild | `dist/extension.node.js`       | `vscode` external; pode incluir `node:*`                          |
| `vsextension` (Web)  | mesmo bundler, platform browser                   | `dist/extension.web.js`        | **Sem `node:*`**; `vscode` external                               |
| `lsp`                | esbuild / Deno bundler                            | `dist/syntaxmesh-lsp.js`       | Shebang, `--stdio`                                                |
| `.vsix`              | `deno run npm:@vscode/vsce package`               | `syntaxmesh-vscode-x.y.z.vsix` | `.vscodeignore` exclui `src/`, `tests/`, `deno.json*`, `scripts/` |

- Tamanho do `.vsix` < 5 MB.
- Testar instalação em VS Code limpo (`code --install-extension`) antes de
  fechar a fase.
- ❌ Sem `node_modules`/`npm install` no repositório — dependências via
  `npm:`/`jsr:` no `deno.json(c)`; `package.json` da extensão é **manifesto VS
  Code**, não gerenciador de dependências (os dois coexistem com o `deno.json`).

---

## 11. Estratégia de testes

| Alvo                 | Sujeito                                                                                                                       | Ferramenta                                  | Critério                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| Unitários `lsp-core` | analyze/diagnostics/hover/completion/navigation/semantic-tokens/symbols/locale/documents/help-manual                          | `deno test` + `@std/testing/bdd` (no core)  | Cobertura ≥ 80%; roda sem VS Code (smoke) |
| Unitários extensão   | commands (com mock do daemon/client), config, engine/daemon cache                                                             | Deno (lógica pura extraída)                 | Cobertura ≥ 70% no pacote                 |
| Grammar              | TextMate destaca EN (v1); snippets expandem                                                                                   | Snapshot fixtures                           | 1 idioma (EN); PT/ES no adendo            |
| Integração LSP       | initialize + didOpen/didChange + publishDiagnostics + hover + completion + definition + references + semanticTokens + symbols | **VS Code Test Runner**                     | —                                         |
| Integração comandos  | add/reload daemon, gerar relatório HTML/CSV, export, switch-language                                                          | VS Code Test Runner                         | —                                         |
| Smoke `.vsix`        | instalar em VS Code limpo, abrir `.tjp`, ver highlight + diagnósticos + hover + completion                                    | manual + teste automatizado quando possível | 1 cenário                                 |
| Workspace | `lsp-core` preserves workspace integrity | `deno task check:all` and full `deno task tests` | exit 0 |

Convenções: BDD (`@std/testing/bdd` + `@std/assert`); sem `any` em `src/`; TDD
para handlers novos; fixtures de entrada: MWEs (`docs/Learning/mwe001–009`) e
`docs/taskjuggler/test/TestSuite/` em inglês — já versionados no repositório;
**não** depende do corpus da Fase 21.

---

## 12. Convenções e anti-padrões

### Convenções

1. `package.json` é **manifesto VS Code**; `deno.json(c)` gerencia
   dependências/tasks.
2. Lógica de linguagem **e wiring do servidor LSP** somente no `lsp-core`/core;
   extensão e CLI são bootstrap de transporte (criar conexão
   - `registerLspServer`).
3. Transporte LSP por host: IPC (desktop), Worker/port (Web), `--stdio` (CLI) —
   nunca dentro do core.
4. TextMate grammar v1 cobre **apenas EN** (PT/ES = adendo pós-Fase 21);
   semantic tokens refinam o básico.
5. `language "..."` do arquivo é soberano; configuração é apenas default.
6. Daemon **sem escuta automática**; recarga explícita pelo usuário.
7. Testes de integração no **VS Code Test Runner**; unitários do core em Deno
   puro.
8. Paths relativos nos assets da extensão (consistente com o resto do projeto).

### Anti-padrões

- ❌ Implementar parser/semântica na extensão ou no CLI.
- ❌ Importar `vscode-languageserver` (fora do bootstrap de transporte
  vscode/CLI), `vscode`, `node:*` ou `Deno.stdin/stdout` dentro do
  core/`lsp-core`.
- ❌ Usar `node_modules` ou `npm install`.
- ❌ `console.log` no canal do servidor LSP.
- ❌ sobrescrever `language "..."` do arquivo via configuração.
- ❌ Vincular save/change automático ao daemon (reintroduzir `scheduleOnSave`).
- ❌ Confiar em IndexedDB/OPFS/`localStorage` direto no Web Extension Host.
- ❌ Publicar `.vsix` sem testar em VS Code limpo.
- ❌ Executar planejamento em workspace não confiável.

---

## 13. Subfases (índice para o arquivo de tarefas)

The [task document](fase-22-vscode-extension-tarefas.md) remains the only atomic
execution list. Its 22.1b blocks C–J contain 108 tasks, with 86 recorded complete.
22.0 (Bloco A) was detailed and delivered at kickoff (2026-11-11); the other
unfinished subphases still need atomic detailing at their kickoff.
The P-block mapping below reorganizes scope without renumbering tasks.

| ID | Planning block / subblock | Deliverable | Entry condition | Recorded status |
|---|---|---|---|---|
| 22.0 | P1.1–P1.3 | ADR 035 (`decisoes/035-extensao-vscode.md`) and index entry; architecture/exclusions | F21¹ gate (P1/P2 early kickoff user-authorized 2026-11-11) | `OK` — ADR 035 accepted; baseline/layers recorded (2026-11-11) |
| 22.1 | P2.1, P2.4 | Remaining workspace wiring, `./lsp-core`, pure §5 services and server registration, unit coverage ≥ 80% | P1; documentation bridges depend on 22.1b | `PAR` — rename delivered; language core pending |
| 22.1b | P2.2, P2.3, P2.5 | Shared docs/search/examples/manual/highlight; editor bridges and oracle verification | Existing engine for C–H; P2.4 foundation for I 7.5–7.7 | `PAR` — 86/108, CLI consumer delivered |
| 22.2 | P3.1 | `packages/vsextension`, manifest, Desktop/Web shells and lifecycle | 22.0; P2 export readiness | `OK` — shell + dual entries delivered (2026-11-12, P3) |
| 22.3 | P3.2 | English TextMate grammar, language configuration, snippets and snapshots | 22.2; P2.3 syntax data | `OK` — generators + 4 assets + golden snapshots (2026-11-12, P3) |
| 22.4 | P3.3 | Thin client/server bootstraps, Desktop IPC and Web Worker/port, LSP integration | 22.1, 22.2; 22.1b editor bridges | `OK` — adapter/options/debounce + 4 bootstraps + `deno bundle` (web `node:`-free) + wiring smoke; pure-logic coverage 99.2% lines (2026-11-12, P3) |
| 22.5 | P4.1, P4.2 | F24 execution-contract audit first; explicit daemon add/remove/list/reload, input/include closure, cache and trust | 22.4; resolve P4.1 before daemon implementation | `PLA` |
| 22.6 | P4.3 | Report selection/output policy: cached-model contract, HTML/assets Webview, CSV/XML/text saves | 22.5 and its contract decision | `PLA` |
| 22.7 | P4.4 | Export/input-language/help commands, settings, Project Explorer and Status Bar; translated UX deferred | 22.5; report UI consumes 22.6 | `PLA` |
| 22.8 | P5.1–P5.3 | Browser-safe Web entry, user-triggered writes and storage fallbacks, vscode.dev tests | 22.4–22.7 | `PLA` |
| 22.9 | P6.1–P6.2 | Independent `packages/lsp` stdio bootstrap, executable build and protocol smoke | 22.4; shared P2 server contract | `PLA` |
| 22.10 | P7.1, P7.2 | Desktop/Web bundles, exclusions, `.vsix` < 5 MB, clean-install acceptance | 22.8; collect 22.9 artifact in acceptance | `PLA` |
| 22.11 | P7.2, P7.3 | Full `deno task tests`, coverage/integration evidence, ADR and documentation closure, F21² handoff | All in-v1 deliverables accepted | `PLA` |

Default block order: **P1 → P2 → P3 → P4 → P5 → P6 → P7**. P6 can proceed
independently of P4/P5 after 22.4 is accepted. Within P2, use foundation
readiness rather than a whole-subphase cycle: existing engine → docs/highlight;
workspace/document analysis → help/completion bridges → final `lsp-core`
acceptance. The CLI-facing `doc-core` work already delivered is not repeated.

The original IDs remain 22.0 → 22.1/22.1b readiness steps → 22.2 → 22.3 → 22.4
→ 22.5 → 22.6 → 22.7 → 22.8 → 22.9 → 22.10 → 22.11. The official phase order
remains **23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³**; the older suggestion
of starting directly after F14 is superseded. Available F15–F18 engine/report
capabilities are inputs, not a reason to move F22 or reopen those phases.

The documentation/syntax relocation from F16 is unchanged: `TernarySearchTree`
and shared Kate/Vim data belong to 22.1b; the optional final generators remain
outside v1. C–J task ranges, consumer annotations, delivery adaptations, and
progress evidence stay in the task document.

Suggested commit scopes remain `feat(lsp-core)`, `feat(vscode)`, `feat(lsp)`,
and `chore(vscode)` per original subphase. This planning update creates no commits.

---

## 14. ADR da fase (035) — Extensão VS Code + `lsp-core`

P1.3 / 22.0 created the reserved
`docs/syntaxmesh/decisoes/035-extensao-vscode.md` and updated the ADR index
on **2026-11-11** (status Aceito). The outline below is the one the delivered
ADR follows:

- **Contexto:** tooling complementar pós-engine; reuso de
  Vim/Emacs/Kate/`taskjuggler-lsp`; inspiração tj3d/tj3client/tj3webd.
- **Decisões:** extensão completa; `lsp-core` como contrato puro dentro do core
  (subpath export `@vanaware/syntaxmesh/lsp-core`, incluindo help/manual);
  renome do core para `@vanaware/syntaxmesh` (pacote principal); **wiring do
  servidor LSP no core** (`registerLspServer` via interface estrutural), com
  entradas vscode/CLI reduzidas a bootstrap de transporte; transporte por host
  (IPC/Worker/stdio); daemon com atualização manual; **reuso da API de
  execução `execute` da Fase 24 (adendo v2/v2.1) pelas camadas daemon/
  relatórios — o *tj3d/tj3webd simulado* consome a mesma API da CLI, sem fork;
  ampliação necessária vira adendo à F24 (nota 2026-11-07)**; entradas duplas
  node/web; `package.json` como manifesto; build via `@vsce/bundler`; **v1
  monolíngue EN** (PT/ES como adendo pós-Fase 21); scheduled after F21¹,
  before F21² and phases 19/20.
- **Alternativas rejeitadas:** pacote `lsp-core` separado; LSP-only em Worker
  sem suporte desktop stdio; Monaco standalone; reutilizar `taskjuggler-lsp` C
  diretamente.
- **Consequências:** core ganha dependência de tipos (aceitável); extensão não
  roda sem VS Code; cache do daemon pode ficar obsoleto entre versões (versionar
  formato).

> ⚠️ **Numeração (resolvida 2026-11-03):** a ordem oficial em `plano.md`
> (`… 23 → 24 → 21¹ → 22 …`) define a cadeia de criação **033 = template**
> (Fase 23), **034 = CLI** (Fase 24), **035 = esta extensão**; a validação da
> Fase 21 usa ADR próprio (próximo livre). Conferir `decisoes/README.md` antes
> de criar.

---

## 15. Referências cruzadas

- `docs/syntaxmesh/fases/plano.md` — plano canônico de fases.
- `docs/syntaxmesh/decisoes/030-arquitetura-simplificada.md` —
  pacotes/workspace.
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md` — port fiel do
  TaskJuggler (regra zero).
- `docs/syntaxmesh/fases/fase-10-parser-linguagem.md` — parser e i18n.
- `docs/syntaxmesh/fases/fase-11-logica-queries.md` — `Query`.
- `docs/syntaxmesh/fases/fase-14-relatorios.md` — pipeline de relatórios.
- `docs/syntaxmesh/fases/fase-24-cli.md` / `fase-24-cli-adendo.md` — API de
  execução `execute` (envelope JSON, entrada `request.files`, adendo v2/v2.1)
  **reutilizada pelas camadas daemon/relatórios desta fase** (nota 2026-11-07).
- `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md` — corpus e golden
  tests.
- `docs/tj3-engine/` — blueprints do engine original.
- Referências externas: `taskjuggler-lsp` (C), `vim-taskjuggler`,
  `taskjuggler-mode.el`, Kate syntax.
- Documentação VS Code: Extension APIs, Language Extensions, Web Extensions,
  Publish.

---

**Fim do plano da Fase 22 (extensão VS Code + `lsp-core` + LSP CLI).**
