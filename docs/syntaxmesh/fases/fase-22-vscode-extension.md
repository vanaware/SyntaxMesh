# Fase 22 — Extensão VS Code (`lsp-core` + tooling de edição)

> **File:** `docs/syntaxmesh/fases/fase-22-vscode-extension.md`
> **Tasks:** [Atomic task document](fase-22-vscode-extension-tarefas.md)
> **Status:** `OK` — P1 (22.0) accepted 2026-11-11 (ADR 035); **P2 completed
> 2026-11-11** (22.1b closed at 106/108 verified + pure `lsp-core` delivered).
> **P3 completed 2026-11-12** (editor foundation: shell 22.2 + grammar 22.3 +
> transport 22.4; pure-logic coverage 99.2% lines; Web bundles `node:`-free;
> full gate 853 passed). **P4 completed 2026-11-14** (execution/reports/UX:
> daemon 22.5 execute-based no core delta + reports 22.6 + commands/views/trust
> 22.7; pure-logic coverage 98.8% lines; full gate 867 passed). **P5 completed
> 2026-11-14** (Web/storage: browser-graph purity + user-triggered write
> fallback + storage resolver + Memento small-state + Web scenarios; pure-logic
> coverage 100% lines; full gate 873 passed). **P6 completed 2026-11-14**
> (standalone LSP: transport adapter moved into the lsp-core + independent
> `packages/lsp` with pure args, stdio bootstrap, executable bundle and a
> real framed JSON-RPC protocol smoke; `packages/lsp/src` coverage 100%
> lines/branches/functions; full gate 876 passed). **P7 completed 2026-11-14**
> (packaging/acceptance/handoff — **phase closed, P1–P7 OK**): pure lsp
> `--version` + build-injected version/shebang, `.vsix` packaged with vsce
> under Deno (2.19 MB < 5 MB, valid zip + vsixmanifest + clean inventory),
> manifest-consistency regression + §11 acceptance matrix, closure coverage
> (lsp-core 96.4% / vsextension 99.3% / lsp 100% lines), full gate 880 passed
> and F21² handoff. VS Code runtime acceptance (clean install, Test Runner,
> vscode.dev) deferred to F21² with explicit anchors.
> **Planning:** seven delivered major blocks P1–P7, with subblocks in §0; original
> IDs 22.0–22.11 and existing task blocks C–J remain unchanged. The P8 complement
> is detailed as tasks 22.12.1–22.12.25 and awaits implementation approval.
> **Recorded progress:** 106/108 tasks in 22.1b verified (H 6.9/6.10 outside
> v1); this is not a whole-phase count.
> **Original duration estimate:** 10–14 days; reassess when detailing each block.
> **Technical prerequisites:** existing engine, documentation, template, and F24
> execution API. Storage/PWA phases 19/20 are not prerequisites.
> **Scheduling gate:** finish F21 wave 1 before starting the remaining F22 work.
> P1/P2 kickoff was user-authorized early on 2026-11-11 (no technical dependency
> on the remaining F21¹ tasks); Phase 25 was registered later, and the early
> delivery remains recorded as an execution exception.
> **Official order:** 23 → 24 → 25 → 21¹ → 22 → 21² → 19 → 20 → 21³.
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
| [P2](#p2-shared-language-and-documentation-cores) | Shared language and documentation cores | 22.1, 22.1b | §4 core, §5; task blocks C–J | `OK` — 22.1b closed 106/108 (H 6.9/6.10 outside v1) + pure `lsp-core` delivered (2026-11-11) |
| [P3](#p3-editor-foundation-and-language-tooling) | Editor foundation and language tooling | 22.2–22.4 | §3.1, §4 extension, §6, §7 | `OK` |
| [P4](#p4-project-execution-reports-and-editor-ux) | Project execution, reports, and editor UX | 22.5–22.7 | §3.2–§3.3, §8 | `OK` |
| [P5](#p5-web-host-and-storage-adaptation) | Web host and storage adaptation | 22.8 | §9; Web transport in §7 | `OK` |
| [P6](#p6-standalone-lsp-adapter) | Standalone LSP adapter | 22.9 | §4 LSP adapter, §7 stdio, §10 LSP build | `OK` |
| [P7](#p7-packaging-acceptance-and-handoff) | Packaging, acceptance, and handoff | 22.10–22.11 | §10 extension build, §11, §13 closure | `OK` |

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
**Met 2026-11-14:** P4.1 resolved **execute-based, no core delta** (cached-model
reporting deferred as a future F24 addendum delta); pure daemon
(cache/closure/request-builder/core/persistence) + report
(output-policy/selector/webview-html) + tree/status/input-language/trust modules
unit-tested (pure-logic coverage 98.8% lines); no save/change watcher; full
`deno task tests` green (867 passed / 7129 steps). VS Code runtime acceptance
(Webview/commands/views/trust + `.vsix` smoke) deferred to P7. Evidence per
atomic task in the task document §P4.

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
**Met 2026-11-14:** pure browser-graph purity scanner + regression (22.8.1),
user-triggered write fallback `direct`/`stub-first` (22.8.2–22.8.3), pure
storage capability resolver + Memento small-state store (22.8.4–22.8.6), and
pure Web scenarios (22.8.7) unit-tested without VS Code (pure-logic coverage
100% lines / 96.8% branches); daemon routes file/memory via the resolver and
reuses the P4 in-memory fallback + cache versioning; no direct IndexedDB/OPFS;
no save/change watcher; full `deno task tests` green (873 passed / 7162 steps).
vscode.dev runtime acceptance deferred to P7. Evidence per atomic task in the
task document §P5.

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
**Met 2026-11-14:** the pure transport adapter moved into the `lsp-core`
(22.9.1) and the independent `packages/lsp` delivers pure CLI args (22.9.2),
the stdio bootstrap over `registerLspServer` with logs only on stderr
(22.9.3), the executable bundle `dist/syntaxmesh-lsp.js` (22.9.4) and a real
framed JSON-RPC protocol smoke — initialize → capabilities, didOpen →
publishDiagnostics, hover, shutdown/exit code 0, stdout purity (22.9.5).
Nothing is imported from the extension; `packages/lsp/src` coverage 100%
lines/branches/functions; full `deno task tests` green (876 passed / 7174
steps). `--version` deferred to P7 (build-injected version). Evidence per
atomic task in the task document §P6.

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
**Met 2026-11-14:** pure lsp `--version`/`-V` with the banner from the core
`./version` subpath (22.10.1); build-time version injection by prepending
`const __APP_VERSION__` (root `deno.jsonc` version; `deno bundle` has no
`--define`) + executable shebang (22.10.2); `.vsix` packaged with **vsce
running under Deno** (`deno task package:vsext`) —
`syntaxmesh-vscode-0.0.2.vsix`, **2.19 MB < 5 MB**, 13 files, valid zip +
vsixmanifest + inventory without src/tests/scripts/deno configs (22.10.3);
manifest-consistency regression + §11 acceptance matrix with F21² anchors
(22.10.4); closure coverage `core/src/lsp` **96.4% lines** (≥ 80%),
`vsextension/src` **99.3%** (≥ 70%), `lsp/src` **100%** (22.11.1); full
`deno task tests` green (**880 passed / 7189 steps**) + ADR reconciliation +
F21² handoff (22.11.2). The "installable verified .vsix" exit is met
structurally; clean install / Test Runner / vscode.dev runtime acceptance is
deferred to **F21²** (no VS Code in this environment) — anchors in the task
document §P7 matrix + handoff. Evidence per atomic task in the task document
§P7.

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
- **Sem globais de runtime não vinculados** no grafo Web: capabilities opcionais
  são sondadas via `globalThis` ou portas injetadas. `deno task check:web-bundle`
  reconstrói e escaneia `extension.web.js` e `server.web.js`, incluindo módulos
  CLI alcançados pelo bundle.
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

**Atualização F21² (2ª onda, 2026-11-15):** a estratégia *headless-first*
adaptou este §11 ao ambiente sem VS Code. A **integração LSP** (superfície §5
completa: didOpen/didChange full+incremental/didClose, completion, definition,
references single+cross-file, documentSymbol/workspaceSymbol/semanticTokens,
diagnósticos de fixture de erro do corpus, pureza de stdout) é provada sobre
stdio JSON-RPC real (`packages/lsp/tests/`, 26.29); a **grammar** é tokenizada
headless sobre o corpus EN (26.30); os **diagnósticos lsp-core** em arquivo
grande têm benchmark com baseline (26.31); **manual/help EN** + **`.vsix`
estrutural** + smoke do bundle construído são revalidados (26.32). O aceite
**runtime** VS Code — Test Runner de comandos/trust, instalação limpa
(`code --install-extension`) e vscode.dev — permanece **Diferido com âncora
explícita** para uma execução equipada com VS Code (sem `it.ignore`
silencioso). Matriz completa: `fase-21-compatibilidade-qualidade-tarefas.md`
(adendo 2ª onda, 26.33.1); estratégia: ADR 042 (adendo 2ª onda).

**Atualização F21 26.34 (2026-11-15):** com VS Code Insiders 1.147 instalado
na máquina, as **3 âncoras desktop** foram resolvidas por driver de evidência
(`deno task test:runtime`, fora do gate): Test Runner de LSP/comandos
(full mode 17 passed — os 9 comandos do manifesto via API real), trust em
2 fases (untrusted → extensão desabilitada; grant → ativa + executa) e
instalação limpa do `.vsix` 0.0.2 em dirs isolados (suite sobre o artefato
instalado, 8 passed). **vscode.dev segue Diferido com âncora** (exige sessão
de navegador). Matriz: `fase-21-compatibilidade-qualidade-tarefas.md`
(adendo 26.34) + §P7 das tarefas F22; estratégia: ADR 042 (adendo 26.34).

**Atualização P8.6 (2026-11-24):** o scanner de bundles gerados cobre comentários,
strings, templates, source maps, imports/requires `node:*`, `Deno` não vinculado e
`process` inseguro; a única exceção é a capability check minimatch
`process.platform === "win32"` devidamente guardada. Os testes focados passaram
(3 testes, 26 steps), o pacote passou 81 testes (502 steps) e
`deno task check:web-bundle` reconstrói os quatro artefatos e encontra zero
violações nos dois bundles Web. Uma injeção intencional de `Deno.readTextFileSync`
no bundle gerado provocou exatamente um diagnóstico e exit 1; após restaurar a
linha, o checker passou novamente. O gate completo `deno task tests` também passou
com a nova etapa; aceite real de navegador continua sob responsabilidade de
22.12.23.

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
- ❌ Deixar globais de runtime não vinculados no grafo Web; capabilities opcionais
  usam `globalThis` ou portas injetadas e os artefatos gerados passam por
  `check:web-bundle`.
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
| 22.1 | P2.1, P2.4 | Remaining workspace wiring, `./lsp-core`, pure §5 services and server registration, unit coverage ≥ 80% | P1; documentation bridges depend on 22.1b | `OK` — workspace wiring + pure `lsp-core` (13 services + `registerLspServer`); coverage 96.6% lines (2026-11-11, P2) |
| 22.1b | P2.2, P2.3, P2.5 | Shared docs/search/examples/manual/highlight; editor bridges and oracle verification | Existing engine for C–H; P2.4 foundation for I 7.5–7.7 | `OK` — 106/108 verified (H 6.9/6.10 outside v1); doc-core + editor bridges + oracle goldens (2026-11-11, P2) |
| 22.2 | P3.1 | `packages/vsextension`, manifest, Desktop/Web shells and lifecycle | 22.0; P2 export readiness | `OK` — shell + dual entries delivered (2026-11-12, P3) |
| 22.3 | P3.2 | English TextMate grammar, language configuration, snippets and snapshots | 22.2; P2.3 syntax data | `OK` — generators + 4 assets + golden snapshots (2026-11-12, P3) |
| 22.4 | P3.3 | Thin client/server bootstraps, Desktop IPC and Web Worker/port, LSP integration | 22.1, 22.2; 22.1b editor bridges | `OK` — adapter/options/debounce + 4 bootstraps + `deno bundle` (web `node:`-free) + wiring smoke; pure-logic coverage 99.2% lines (2026-11-12, P3) |
| 22.5 | P4.1, P4.2 | F24 execution-contract audit first; explicit daemon add/remove/list/reload, input/include closure, cache and trust | 22.4; resolve P4.1 before daemon implementation | `OK` — P4.1 execute-based (no core delta) + pure daemon types/cache/closure/request-builder/core/persistence + host/commands (2026-11-14, P4) |
| 22.6 | P4.3 | Report selection/output policy: cached-model contract, HTML/assets Webview, CSV/XML/text saves | 22.5 and its contract decision | `OK` — pure output-policy/selector/webview-html + `ReportPresenter` Webview/save (2026-11-14, P4) |
| 22.7 | P4.4 | Export/input-language/help commands, settings, Project Explorer and Status Bar; translated UX deferred | 22.5; report UI consumes 22.6 | `OK` — settings/locale + project-tree/status-bar + input-language + trust + misc/views host + 9-command manifest; pure-logic coverage 98.8% lines (2026-11-14, P4) |
| 22.8 | P5.1–P5.3 | Browser-safe Web entry, user-triggered writes and storage fallbacks, vscode.dev tests | 22.4–22.7 | `OK` — pure purity/write-fallback/storage-capabilities/small-state + wiring reports/misc/daemon/entries + Web scenarios; pure-logic coverage 100% lines (2026-11-14, P5) |
| 22.9 | P6.1–P6.2 | Independent `packages/lsp` stdio bootstrap, executable build and protocol smoke | 22.4; shared P2 server contract | `OK` — adapter moved into lsp-core + `packages/lsp` (pure args, stdio bootstrap, `dist/syntaxmesh-lsp.js` bundle) + real framed JSON-RPC smoke (initialize/didOpen/hover/shutdown, stdout purity); coverage 100% (2026-11-14, P6) |
| 22.10 | P7.1, P7.2 | Desktop/Web bundles, exclusions, `.vsix` < 5 MB, clean-install acceptance | 22.8; collect 22.9 artifact in acceptance | `OK` — lsp `--version` + build-injected version/shebang + `.vsix` 2.19 MB (vsce under Deno, valid zip + vsixmanifest + clean inventory) + manifest-consistency regression + §11 acceptance matrix; clean-install runtime deferred to F21² (2026-11-14, P7) |
| 22.11 | P7.2, P7.3 | Full `deno task tests`, coverage/integration evidence, ADR and documentation closure, F21² handoff | All in-v1 deliverables accepted | `OK` — gate 880 passed (7189 steps); coverage lsp-core 96.4% / vsextension 99.3% / lsp 100% lines; ADR 035 reconciled (runtime validation belongs to F21²); handoff artifacts registered (2026-11-14, P7) |

Default block order: **P1 → P2 → P3 → P4 → P5 → P6 → P7**. P6 can proceed
independently of P4/P5 after 22.4 is accepted. Within P2, use foundation
readiness rather than a whole-subphase cycle: existing engine → docs/highlight;
workspace/document analysis → help/completion bridges → final `lsp-core`
acceptance. The CLI-facing `doc-core` work already delivered is not repeated.

The original IDs remain 22.0 → 22.1/22.1b readiness steps → 22.2 → 22.3 → 22.4
→ 22.5 → 22.6 → 22.7 → 22.8 → 22.9 → 22.10 → 22.11. The official phase order
is **23 → 24 → 25 → 21¹ → 22 → 21² → 19 → 20 → 21³**; the older suggestion
of starting directly after F14 is superseded. Available F15–F18 engine/report
capabilities are inputs, not a reason to move F22 or reopen those phases.

The documentation/syntax relocation from F16 is unchanged: `TernarySearchTree`
and shared Kate/Vim data belong to 22.1b; the optional final generators remain
outside v1. C–J task ranges, consumer annotations, delivery adaptations, and
progress evidence stay in the task document.

The post-delivery audit complement **P8** is specified after §15. It is proposed
follow-up work and does not change the completed status of 22.0–22.11.

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

# P8 Complement — Command-First API and Web Runtime Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the delivered UI handlers into a canonical command API, expose
that API consistently through the palette, project tree, report commands and
console, cover the complete Fase 24 CLI command surface, and make the Web claim
verifiable at bundle and browser-runtime level.

**Architecture:** Keep F24 `execute(request)` as the only engine entry point.
Add a UI-free command service over the existing daemon host; VS Code commands,
tree items, status bar and console become thin adapters. The pseudo-tj3 adapter
reuses the CLI's pure argument parser, reporter and output policy, but never its
process entry point or runtime I/O. Desktop keeps its Node entry and IPC LSP; Web
keeps its browser entry and Worker LSP. No second scheduler, report pipeline or
semantic-token provider is introduced.

**Tech Stack:** Deno, TypeScript, VS Code Extension API, `vscode-languageclient`,
`@std/testing/bdd`, `@std/assert`, `@std/yaml`, Deno bundler, `@vscode/test-web` for
runtime acceptance.

**Spec:** ADR 035, Fase 24 CLI plan and addendum, F24 `execute` contract, and the
evidence matrix in this section. P1–P7 remain completed historical scope; P8 is
proposed follow-up work, not a rewrite of their acceptance records.

## Global Constraints

- Deno only: no `npm install`, local Node dependency tree or Node-only API in the
  Web graph.
- `syntaxmesh.run` is a compatibility adapter over F24, not a second engine.
  It may import pure CLI contract modules (`options`, reporter, output policy,
  image and sheet-file helpers), never `cli.ts`, `io.ts` or a spawned process.
- `--silent` and `--no-color` remain renderer options; they never enter the
  `ExecutionRequest`.
- All new Deno tests use `@std/testing/bdd` and `@std/assert`; in-host runtime
  suites keep the documented sequential-collector exception because
  `@std/testing/bdd` registers `Deno.test`.
- Business logic lives in services and pure projections; adapters only resolve
  VS Code arguments, prompt, render, write and register disposables.
- Every public command is declared in `contributes.commands`; runtime-only
  aliases and `syntaxmesh.console.clear` are registered but not contributed.
- Every command handler accepts an explicit project/report argument before
  falling back to registry selection or the active master editor.
- `.smx` and `.tjp` are master files; `.tji`/`.tjs` fragments and sheets are not
  valid project roots.
- Workspace Trust still gates every execution and write path. The manifest keeps
  no `untrustedWorkspaces` capability, so VS Code disables the extension and
  registers no commands in a restricted workspace; the in-command gate remains
  the second layer if trust is lost after activation.
- Help/version/man are project-free. Sheet apps remain project-backed: semantic
  commands resolve an explicit, active or single loaded project, while
  `syntaxmesh.run` and its `run`/`smx`/`tj3` console prefixes retain the F24
  positional `.smx`/`.tjp` master requirement. P8 adds no parser or
  execution-semantics delta; its only core change is the injected logging
  portability capability in task 22.12.20.
- No save/change watcher feeds the daemon; refresh remains explicit.
- LSP remains responsible for editor diagnostics and semantic tokens. Execution
  diagnostics use a separate collection and never replace LSP diagnostics.
- Report generation returns data in memory. Only explicit export/freeze actions
  write files, and existing files are never overwritten silently.
- Web console support must use a browser-safe adapter until a real browser test
  proves that a pseudoterminal is available.

---

## P8 Audit Result

### What is already correct

1. The engine connection is sound: `DaemonCore` and report generation call the
   F24 `execute` API with inline file closures. There is no external HTTP daemon
   and no parallel execution implementation.
2. The package has both `main` and `browser` entries. Desktop LSP uses Node IPC;
   Web LSP uses a dedicated Worker with `BrowserMessageReader/Writer`.
3. Workspace Trust, manual reload, Desktop persistence, Web memory fallback,
   strict-CSP report Webviews and user-triggered Web writes are present.
4. LSP already publishes diagnostics and semantic tokens. The proposed direct
   client-side semantic-token provider would duplicate delivered behavior.
5. The core already supports parse-only, schedule-only, freeze and sheet-check
   requests. P8 needs extension wiring, not a new core execution API.

### Evidence matrix

| Blueprint concern | Delivered state | Classification | Controlling evidence |
|---|---|---|---|
| Commands as canonical API | Nine UI-specific commands; handlers contain selection and presentation flow | Missing | `package.json`; `src/commands/daemon.ts`; `src/commands/reports.ts` |
| In-process engine | Daemon/report execution runs in the extension host through `execute` | Confirmed, with nuance | `src/daemon/daemon-core.ts`; `src/daemon/host.ts`; Desktop LSP is still a child process |
| Desktop/Web entries | `main` + `browser`, separate bootstraps | Confirmed | `package.json`; `src/extension.node.ts`; `src/extension.web.ts` |
| Worker LSP | Browser client starts `dist/server.web.js` in a Worker | Confirmed | `src/client/browser.ts`; `src/server/browser.ts` |
| Project registry | URI-keyed multi-project cache exists | Partial | `src/daemon/project-cache.ts` |
| Explicit active project | Active editor is inferred; first project is fallback; no `setActive` | Missing | `src/views/host.ts`; `src/commands/shared.ts` |
| Add/reload semantics | Parse and list reports only; no scheduling | Confirmed; older plan wording is stale | `DaemonCore.addProject/reloadProject` use `listReports: ""` |
| Compile/check/schedule/freeze/sheets | No public commands or request-builder fields | Missing | `src/daemon/request-builder.ts`; `package.json` |
| F24 CLI parity | No `man`, `ts`/`ss` apps, help/version commands, full option surface or tj3-compatible runner | Missing | `packages/cli/src/options.ts`; `packages/cli/src/output-policy.ts`; `package.json` |
| Report list/open/export | One combined `generateReport` flow; HTML opens, other formats auto-save | Partial | `src/commands/reports.ts`; `src/reports/host.ts` |
| Multi-project tree | One selected model projected as five categories; no root project nodes | Partial | `src/views/project-tree.ts`; `src/views/host.ts` |
| Tree toolbar/context menus | No `contributes.menus`; tree items have no command/context metadata | Missing | `package.json`; `src/views/host.ts` |
| Console/PTY | No terminal or command parser | Missing | `package.json`; `src/commands/` |
| Status bar | Shows active model status, locale and report count; opens tree | Partial | `src/views/status-bar.ts`; `src/views/host.ts` |
| Editor diagnostics/tokens | Provided by LSP | Confirmed; do not duplicate | `packages/core/src/lsp/server.ts` |
| Execution diagnostics | Envelope messages are shown as transient messages only | Missing | `src/commands/reports.ts`; no `DiagnosticCollection` for execution |
| Web source purity | Scanner covers only `packages/vsextension/src` | Partial | `src/web/purity.ts`; `tests/web/purity_test.ts` |
| Web bundle purity | Both generated Web bundles contain `Deno.*`; `Log` has unbound `Deno?.` calls | High-risk gap | `packages/core/src/log.ts`; generated `dist/extension.web.js` and `dist/server.web.js` |
| Web runtime acceptance | Desktop runtime evidence exists; `vscode.dev` remains deferred | Unverified | §11; Fase 21 task addendum 26.34 |

The audit baseline was green where it currently looks: extension package tests
passed (33 tests, 131 steps, 0 failures), and `deno task build:vsext` produced all
four bundles. A successful bundle is not evidence that every browser execution
path is safe.

### Corrections to historical wording

- §3.2 describes add/reload as parse plus schedule. The delivered P4.1 behavior is
  parse plus `listReports`, deliberately without scheduling. The P4.1 decision
  note and `DaemonCore` are authoritative.
- §3.3 describes report generation over cached model data. The delivered v1
  re-parses and re-schedules the cached file closure through `execute`; only the
  closure and report inventory are cached. No cached-model reporting delta is
  part of P8.
- §8.1 describes a project tree. The delivered tree is a category/entity view of
  one inferred active project. P8.4 adds actual project roots and multi-project
  navigation.
- §13 records 22.8 as delivered with Web scenarios. Those scenarios are pure or
  mocked tests; they do not replace the still-deferred real browser acceptance
  in §11. P8.6 closes the generated-bundle evidence gap; browser execution remains
  in 22.12.23.
- The historical “no `Deno.*`” wording meant no unbound runtime-specific globals.
  Optional capabilities reached through `globalThis` or injected ports are valid;
  source and generated-bundle scanners now enforce that distinction.

### Risk priority

- **P0 resolved in 22.12.20/22.12.21:** unbound `Deno` progress calls were removed
  from `Log`, and `check:web-bundle` now rejects their reintroduction in either
  generated Web artifact. Real browser execution remains separately unverified.
- **P0:** no real Web extension-host/browser acceptance. Source scans and Deno
  browser bundles cannot prove activation, Worker startup, virtual-filesystem
  writes or console behavior.
- **P1:** command handlers cannot be reused programmatically because selection,
  execution and presentation are combined and command arguments are ignored.
- **P1:** add/reload and tree activation can target an arbitrary active editor,
  including a `.tji` fragment, because `activeMasterUri()` performs no language
  or master-extension validation.
- **P2:** report and status behavior is useful but narrower than the proposed
  command-first UX; the missing pieces are adapters, not engine capabilities.

---

## Target Command API

All project, execution, report and console handlers in the target API return
`CommandResult<T>` and accept optional explicit arguments. Palette clients may
omit arguments to receive prompts; tree and console clients pass arguments
directly. Existing utility commands keep their current return contracts.
`projectUri` means an explicit project reference, not an inferred editor; native
masters use `.smx`, and `.tjp` is accepted as a compatibility input.

| Command | Arguments | Service result | Primary clients |
|---|---|---|---|
| `syntaxmesh.project.add` | `[projectUri?]` | `ProjectModel` | Palette, tree toolbar, console |
| `syntaxmesh.project.remove` | `[projectUri?]` | `null` | Palette, tree context, console |
| `syntaxmesh.project.list` | none | `ProjectSummary[]` | Palette, status fallback, console |
| `syntaxmesh.project.setActive` | `[projectUri?]` | `ProjectModel` | QuickPick, tree root, console |
| `syntaxmesh.project.refresh` | `[projectUri?]` | `ProjectModel` | Tree toolbar/context, console |
| `syntaxmesh.compile` | `[projectUri?, options?: ExecutionCommandOptions]` | `ExecutionResult` with all report data | Palette, tree context, console, run |
| `syntaxmesh.checkSyntax` | `[projectUri?, options?: ExecutionCommandOptions]` | `ExecutionResult` with `results.check` | Palette, console, run |
| `syntaxmesh.scheduleOnly` | `[projectUri?, options?: ExecutionCommandOptions]` | `ExecutionResult` without reports | Palette, console, run |
| `syntaxmesh.freeze` | `[projectUri?, freezeDate?, byTask?, options?: ExecutionCommandOptions]` | `FreezeCommandResult` | Palette, console, run |
| `syntaxmesh.checkTimeSheet` | `[projectUri?, sheetUri?, options?: ExecutionCommandOptions]` | `ExecutionResult` with `results.sheet` | Palette, console, run |
| `syntaxmesh.checkStatusSheet` | `[projectUri?, sheetUri?, options?: ExecutionCommandOptions]` | `ExecutionResult` with `results.sheet` | Palette, console, run |
| `syntaxmesh.report.list` | `[projectUri?, pattern?]` | `ListReportsEntry[]` | Palette, tree expansion, console, run |
| `syntaxmesh.report.render` | `[projectUri?, report?, reportsIsRegex?, dynamicAttributes?]` | `ExecutionResult` with selected reports | Palette, console, run |
| `syntaxmesh.report.open` | `[projectUri?, reportId?, dynamicAttributes?]` | `null` after opening the HTML Webview | Tree report, palette, console |
| `syntaxmesh.report.export` | `[projectUri?, reportId?, format?, targetUri?, dynamicAttributes?]` | `ReportExportResult` | Palette, tree context, console |
| `syntaxmesh.man` | `[format?, keywords?, targetUri?]` | `ManCommandResult` | Palette, console, run |
| `syntaxmesh.sheet.time.send` | `[projectUri?, options?: SheetCommandOptions]` | `SheetCommandResult` | Palette, console, run |
| `syntaxmesh.sheet.time.receive` | `[projectUri?, messageUri?, options?: SheetCommandOptions]` | `SheetCommandResult` | Palette, console, run |
| `syntaxmesh.sheet.time.summary` | `[projectUri?, options?: SheetCommandOptions]` | `SheetCommandResult` | Palette, console, run |
| `syntaxmesh.sheet.status.send` | `[projectUri?, options?: SheetCommandOptions]` | `SheetCommandResult` | Palette, console, run |
| `syntaxmesh.sheet.status.receive` | `[projectUri?, messageUri?, options?: SheetCommandOptions]` | `SheetCommandResult` | Palette, console, run |
| `syntaxmesh.help` | none | `ExecutionResult` with `results.help` | Palette, console, run |
| `syntaxmesh.version` | none | `ExecutionResult` with `results.version` | Palette, console, run |
| `syntaxmesh.console.open` | none | `null` | Palette, status bar |
| `syntaxmesh.run` | `[argv: string[], context?: Tj3RunContext]` | `Tj3RunResult` | Console, debug console |

`ExecutionCommandOptions`, `SheetCommandOptions`, `Tj3RunContext` and the result
types are UI-free contracts defined in P8.2 and P8.7. The semantic commands remain
the preferred palette/tree API; `syntaxmesh.run` exists for CLI-compatible
invocation and console use, not as a requirement to model every tj3 invocation
as a separate VS Code command. In the console, `run` is the canonical prefix;
`smx` and `tj3` are equivalent aliases for the same argv parser and
`syntaxmesh.run` command, including `man`, `ts` and `ss` subcommands.

### Fase 24 Surface Mapping

Every current CLI flag, subcommand and addendum behavior maps either to a typed
command option or to an explicit rejection. The parser and output policy are
shared with F24; the extension only supplies project/file resolution and host
I/O.

| F24 CLI surface | Extension contract |
| --- | --- |
| `syntaxmesh <file.smx\|file.tjp> [options]` | Project argument on execution commands, or `syntaxmesh.run argv` |
| `--config <FILE>` | `ExecutionCommandOptions.configUri` or `SheetCommandOptions.configUri`; host reads and parses it into `configContent`/`configObject` |
| `--silent`, `--no-color` | `Tj3RunContext.renderer`; never part of `ExecutionRequest` |
| `--abort-on-warnings`, `-f`/`--force-reports`, `--warn-ts-deltas`, `--add-trace` | Typed boolean fields on `ExecutionCommandOptions` |
| `--check-syntax` | `syntaxmesh.checkSyntax` |
| `--list-reports <RE>` | `syntaxmesh.report.list` with a regular-expression pattern |
| `--no-reports` | `syntaxmesh.scheduleOnly` |
| `--report <R>`, `--reports <RE>` | `syntaxmesh.report.render` with `reportsIsRegex` false/true; compile forwards the same selection |
| `-A`, `--dynamic-attributes <attrs>` | `dynamicAttributes` on execution/report options |
| `-o`, `--output-dir <DIR>` | `ExecutionCommandOptions.outputDir`, or `targetUri` on explicit export commands |
| `--freeze`, `--freeze-by-task`, `--freezebytask`, `--freezedate <date>` | `syntaxmesh.freeze` arguments |
| `--check-time-sheet <file>`, `--check-status-sheet <file>` | `syntaxmesh.checkTimeSheet`, `syntaxmesh.checkStatusSheet` |
| `--help`, `-h`; `--version`, `-V` | `syntaxmesh.help`, `syntaxmesh.version` |
| `man [--format text\|html\|smx] [keyword...]` | `syntaxmesh.man`; `tjp` is not a valid current format |
| `ts send`, `ts receive --from <file\|->`, `ts summary` | `syntaxmesh.sheet.time.*`; `-` is hydrated from `Tj3RunContext.stdin` |
| `ss send`, `ss receive --from <file\|->` | `syntaxmesh.sheet.status.*`; `-` is hydrated from `Tj3RunContext.stdin` |
| Sheet `-d`/`--directory`, `-e`/`--enddate`, `-r`/`--resource`, `-f`/`--force`, `--hideresource`, `-i`/`--interval`, `--sheet`, `--digest`, `-t`/`--to`, `--dryrun`/`--dry-run`, `--from`, `--config` | Typed fields on `SheetCommandOptions` |
| `stdout` in report DSL and all file artifacts | Shared CLI output policy inside `syntaxmesh.run` |
| `--debug`, `--debuglevel`, `--debugmodules` | Rejected exactly as F24 currently rejects them |

The existing utility commands remain public: `syntaxmesh.exportTjp`,
`syntaxmesh.switchLanguage`, `syntaxmesh.showProjectTree` and
`syntaxmesh.openManual`. The five old project/report IDs
(`addProject`, `reloadProject`, `removeProject`, `listProjects`,
`generateReport`) remain temporary runtime-only compatibility aliases. New UI
must call only canonical IDs. `syntaxmesh.console.clear` is runtime-only.

---

## P8.1 — Command Contract, Service and Active Project Registry

**Priority:** P1. **Depends on:** delivered P4/P5. **Produces:** the reusable
service used by every later adapter.

**Files:**
- Create: `packages/vsextension/src/commands/contracts.ts`
- Create: `packages/vsextension/src/commands/project-ref.ts`
- Create: `packages/vsextension/src/commands/service.ts`
- Modify: `packages/vsextension/src/daemon/project-cache.ts`
- Modify: `packages/vsextension/src/daemon/types.ts`
- Modify: `packages/vsextension/src/daemon/persistence.ts`
- Modify: `packages/vsextension/src/daemon/host.ts`
- Modify: `packages/vsextension/src/commands/daemon.ts`
- Modify: `packages/vsextension/src/commands/shared.ts`
- Modify: `packages/vsextension/package.json`
- Test: `packages/vsextension/tests/commands/service_test.ts`
- Test: `packages/vsextension/tests/commands/project-ref_test.ts`
- Test: `packages/vsextension/tests/daemon/project-cache_test.ts`
- Test: `packages/vsextension/tests/daemon/persistence_test.ts`
- Test: `packages/vsextension/tests/manifest_test.ts`

**Interfaces:**

```ts
export type CommandResult<T> =
  | { ok: true; value: T; messages: ExecutionMessage[] }
  | { ok: false; error: string; messages: ExecutionMessage[] };

export type ProjectIntent =
  | "inventory"
  | "checkSyntax"
  | "scheduleOnly"
  | "compile"
  | "freeze"
  | "checkTimeSheet"
  | "checkStatusSheet"
  | "report"
  | "man"
  | "sheet"
  | "run";

export interface ProjectExecutionState {
  intent: ProjectIntent;
  startedAt: number;
  finishedAt?: number;
  errorCount: number;
}

export type ArtifactKind =
  | "report"
  | "freeze"
  | "manual"
  | "sheet"
  | "email"
  | "asset"
  | "image";

export interface ArtifactResult {
  uri: string;
  fileName: string;
  kind: ArtifactKind;
}

export interface RestoredCache {
  projects: ProjectModel[];
  activeUri: string | null;
}

export interface ProjectCommandPort {
  addProject(uri: string): Promise<ProjectModel>;
  refreshProject(uri: string): Promise<ProjectModel>;
  removeProject(uri: string): Promise<boolean>;
  listProjects(): ProjectSummary[];
  setActiveProject(uri: string): ProjectModel | undefined;
  activeProject(): ProjectModel | undefined;
}

export interface ProjectCommandService {
  addProject(uri: string): Promise<CommandResult<ProjectModel>>;
  refreshProject(uri: string): Promise<CommandResult<ProjectModel>>;
  removeProject(uri: string): Promise<CommandResult<null>>;
  listProjects(): Promise<CommandResult<ProjectSummary[]>>;
  setActiveProject(uri: string): Promise<CommandResult<ProjectModel>>;
}

export interface ProjectDocumentRef {
  uri: string;
  languageId: string;
}

export function resolveProjectUri(input: {
  explicit?: string;
  activeRegistry?: string;
  activeDocument?: ProjectDocumentRef;
  projects: string[];
}): CommandResult<string>;
```

`DaemonHost` implements the string-URI port by converting with `Uri.parse`; the
existing `Uri` methods may remain as internal compatibility wrappers. The service
contains no `window`, `workspace`, `commands` or terminal calls.

- [ ] **Step 1: Add failing registry and resolution tests.**

```ts
it("selects explicit URI before active registry and active editor", () => {
  const resolved = resolveProjectUri({
    explicit: "file:///explicit.smx",
    activeRegistry: "file:///registry.tjp",
    activeDocument: { uri: "file:///editor.tji", languageId: "syntaxmesh" },
    projects: ["file:///registry.tjp"],
  });
  assertEquals(resolved, {
    ok: true,
    value: "file:///explicit.smx",
    messages: [],
  });
});

it("rejects a .tji active document as a project root", () => {
  const resolved = resolveProjectUri({
    activeDocument: { uri: "file:///fragment.tji", languageId: "syntaxmesh" },
    projects: [],
  });
  assertEquals(resolved.ok, false);
});

it("accepts .tjp as a compatibility master", () => {
  const resolved = resolveProjectUri({
    explicit: "file:///legacy.tjp",
    projects: [],
  });
  assertEquals(resolved.ok, true);
  if (resolved.ok) assertEquals(resolved.value, "file:///legacy.tjp");
});
```

Run: `deno task --cwd packages/vsextension tests`. Expected: FAIL because the
new modules/functions do not exist.

- [ ] **Step 2: Implement active selection in `ProjectCache`.** Add
  `activeUri: string | null`, `setActive(uri): boolean`, `active(): string | null`
  and deterministic fallback: first `set` activates when empty; removing the active
  project selects the first remaining URI; `clear()` resets to `null`. Add required
  `active` and `lastIntent` to `ProjectSummary`, and optional `lastExecution` to
  `ProjectModel`
  without replacing the inventory `envelope`. Change `summarize(model)` to
  `summarize(model, activeUri)`; missing `lastExecution` projects as `inventory`.
- [ ] **Step 3: Persist selection without a breaking cache migration.** Add
  optional `activeUri` to `SerializedCache`; `serializeCache(models, activeUri)`
  writes it. Add `restoreCache(json): RestoredCache`, where `RestoredCache` is
  `{ projects: ProjectModel[]; activeUri: string | null }`; version-1 payloads
  without `activeUri` restore with `null`. Keep
  `deserializeCache(json): ProjectModel[]` as a compatibility wrapper over
  `restoreCache(json).projects`. Keep `CACHE_VERSION = 1` because all added fields
  are optional.
- [ ] **Step 4: Implement command constants, result type and service.** Export
  `PUBLIC_COMMAND_IDS`, `RUNTIME_ONLY_COMMAND_IDS` and `LEGACY_COMMAND_IDS` from
  `contracts.ts`. Initialize the public set with the four existing utility commands
  plus the project commands in this slice; later slices extend it. Implement
  add/remove/list/setActive/refresh over `ProjectCommandPort`; reject URI paths
  that do not end in `.smx` or `.tjp`, and turn every failure into `CommandResult`
  rather than a raw exception.
- [ ] **Step 5: Implement project resolution.** Priority is explicit argument,
  active registry project, active `.smx`/`.tjp` editor with language id
  `syntaxmesh`, then a single loaded project. Return a structured error when no
  unambiguous master exists.
- [ ] **Step 6: Make manifest consistency distinguish public and runtime-only
  commands.** Contribute the project commands in this slice and compare
  `contributes.commands` with `PUBLIC_COMMAND_IDS`; assert runtime-only IDs are not
  contributed. Each later slice extends both the constants and manifest when its
  handlers land. Move the real `getCommands(true)` registration check to the
  in-host runtime suite, where VS Code is available.
- [ ] **Step 7: Run package tests and type checks.**

```bash
deno task --cwd packages/vsextension tests
```

Expected: all registry, persistence, resolution, service and manifest tests pass.

---

## P8.2 — Execution Commands, CLI Options and Execution Diagnostics

**Priority:** P1. **Depends on:** P8.1. **Produces:** compile/check/schedule/freeze/
sheet-check commands and the complete F24 root execution option mapping without a
core delta.

**Files:**
- Modify: `packages/vsextension/src/daemon/request-builder.ts`
- Modify: `packages/vsextension/src/daemon/daemon-core.ts`
- Modify: `packages/vsextension/src/commands/service.ts`
- Create: `packages/vsextension/src/commands/execution.ts`
- Create: `packages/vsextension/src/commands/config.ts`
- Create: `packages/vsextension/src/diagnostics/execution.ts`
- Create: `packages/vsextension/src/diagnostics/host.ts`
- Modify: `packages/vsextension/src/extension.node.ts`
- Modify: `packages/vsextension/src/extension.web.ts`
- Modify: `packages/vsextension/deno.jsonc`
- Modify: `packages/vsextension/package.json`
- Test: `packages/vsextension/tests/daemon/request-builder_test.ts`
- Test: `packages/vsextension/tests/daemon/daemon-core_test.ts`
- Test: `packages/vsextension/tests/commands/execution_test.ts`
- Test: `packages/vsextension/tests/commands/config_test.ts`
- Test: `packages/vsextension/tests/diagnostics/execution_test.ts`

**Interfaces:**

```ts
export interface BuildRequestOptions {
  entry?: string;
  configContent?: string;
  configObject?: Record<string, unknown> | null;
  listReports?: string;
  listReportsIsRegex?: boolean;
  report?: string;
  reportsIsRegex?: boolean;
  outputDir?: string;
  dynamicAttributes?: string;
  forceReports?: boolean;
  abortOnWarnings?: boolean;
  warnTsDeltas?: boolean;
  addTrace?: boolean;
  checkSyntax?: boolean;
  noReports?: boolean;
  freeze?: ExecutionFreezeRequest;
  help?: boolean;
  version?: boolean;
  man?: ExecutionManRequest;
  app?: SheetAppName;
  appOptions?: ExecutionSheetAppOptions;
}

export interface ExecutionCommandOptions {
  configUri?: string;
  outputDir?: string;
  report?: string;
  reportsIsRegex?: boolean;
  dynamicAttributes?: string;
  forceReports?: boolean;
  abortOnWarnings?: boolean;
  warnTsDeltas?: boolean;
  addTrace?: boolean;
}

export interface ExecutionCommandPort extends ProjectCommandPort {
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<ExecutionResult>;
}

export interface ExecutionDiagnostic {
  file: string | null;
  line: number | null;
  severity: "error" | "warning" | "information" | "hint";
  message: string;
  code: string;
}
```

- [ ] **Step 1: Add failing request-mapping tests.** Assert exact fields for
  parse-only, schedule-only, freeze, both sheet checks, config data, report
  selection and every new boolean option.

```ts
const closure: InputClosure = {
  files: [{ path: "project.smx", content: "project test {}" }],
  missing: [],
};

it("maps scheduleOnly to noReports without requesting reports", () => {
  const request = buildExecuteRequest(closure, { noReports: true });
  assertEquals(request.noReports, true);
  assertEquals(request.report, undefined);
});

it("forwards F24 root flags without turning renderer flags into execution data", () => {
  const request = buildExecuteRequest(closure, {
    configContent: "currency: EUR",
    report: "cost",
    reportsIsRegex: true,
    forceReports: true,
    abortOnWarnings: true,
    warnTsDeltas: true,
    addTrace: true,
  });
  assertEquals(request.configContent, "currency: EUR");
  assertEquals(request.report, "cost");
  assertEquals(request.reportsIsRegex, true);
  assertEquals(request.forceReports, true);
  assertEquals(request.abortOnWarnings, true);
  assertEquals(request.warnTsDeltas, true);
  assertEquals(request.addTrace, true);
  assertEquals("silent" in request, false);
});

it("forwards sheet content as data", () => {
  const request = buildExecuteRequest(closure, {
    app: "check-ts",
    appOptions: { sheetFile: "day.tji", sheetContent: "booking 2026-01-01 {}" },
  });
  assertEquals(request.app, "check-ts");
  assertEquals(request.appOptions?.sheetContent, "booking 2026-01-01 {}");
});
```

Run: `deno test --allow-read --allow-write --allow-env packages/vsextension/tests/daemon/request-builder_test.ts`. Expected: FAIL.

- [ ] **Step 2: Extend `buildExecuteRequest`.** Copy each new field only when
  defined. Preserve the existing minimal-request behavior and core defaults.
  Never add `silent`, `noColor` or other renderer state to the execution request.
- [ ] **Step 3: Add `DaemonCore.executeProject(uri, options)`.** Add/reload record
  `lastExecution` with intent `inventory`. Execution requires a cached project,
  executes its cached closure, preserves the inventory `envelope`, and updates
  `lastExecution` and `status`. Infer intent in this order: `checkSyntax`,
  `noReports`, `freeze`, `sheet`, report selection, otherwise `compile`.
- [ ] **Step 4: Implement UI-free config hydration.** `loadConfig(uri, readFile)` reads
  the selected YAML through the host port, parses it with `@std/yaml`, and returns
  both `configContent` and `configObject`; invalid YAML becomes a structured
  `CommandResult` error. No command handler performs parsing itself.
- [ ] **Step 5: Implement service methods and command handlers.** `compile` omits
  `report` by default so the core returns every report in memory, or forwards
  `report`/`reportsIsRegex` when supplied; `scheduleOnly` sets `noReports`; sheet
  checks read the selected/open sheet through `workspace.fs` or the active text
  document and pass `sheetContent`/`sheetFile`. Every handler loads optional config
  data through Step 4 and returns `CommandResult`. Extend `PUBLIC_COMMAND_IDS`
  and `contributes.commands` with the six execution commands in this slice.
- [ ] **Step 6: Add the pure diagnostic projection.** Map `fatal`/`error` to
  error, `warning` to warning, `info` to information and `debug` to hint. Keep
  `file`, `line`, `id` and text; do not invent source locations.
- [ ] **Step 7: Add `ExecutionDiagnostics` host.** Create a collection named
  `syntaxmesh.execution`; resolve master paths to the master URI and include
  paths relative to its directory; use line `max(line - 1, 0)` or line 0 when
  absent. Clear only this collection on project removal/reload, and dispose it
  with the extension context.
- [ ] **Step 8: Publish envelope diagnostics after every execution command.**
  Keep LSP diagnostics untouched. Add an in-host test that a syntax error appears
  in `syntaxmesh.execution` while the LSP collection remains present.
- [ ] **Step 9: Run focused and package verification.**

```bash
deno task --cwd packages/vsextension tests
```

---

## P8.3 — Report Selection, Commands and Explicit Artifact Output

**Priority:** P2. **Depends on:** P8.1/P8.2. **Produces:** reusable list/render/open/
export commands, F24 report selection semantics, safe freeze output and the shared
confirmed-output foundation (tasks 22.12.8–22.12.9) consumed by P8.7.

**Files:**
- Modify: `packages/vsextension/src/commands/contracts.ts`
- Modify: `packages/vsextension/src/commands/service.ts`
- Modify: `packages/vsextension/src/commands/reports.ts`
- Modify: `packages/vsextension/src/reports/host.ts`
- Modify: `packages/vsextension/scripts/build.ts`
- Modify: `packages/vsextension/package.json`
- Create: `packages/vsextension/scripts/copy-assets.ts`
- Create: `packages/vsextension/src/cli/artifacts.ts`
- Create: `packages/vsextension/src/cli/output-host.ts`
- Create: `packages/vsextension/src/cli/host.ts`
- Create: `packages/vsextension/src/commands/freeze-output.ts`
- Test: `packages/vsextension/tests/assets_test.ts`
- Test: `packages/vsextension/tests/commands/reports_test.ts`
- Test: `packages/vsextension/tests/commands/freeze-output_test.ts`
- Test: `packages/vsextension/tests/cli/artifacts_test.ts`
- Test: `packages/vsextension/tests/cli/output-host_test.ts`
- Test: `packages/vsextension/tests/reports/output-policy_test.ts`

**Interfaces:**

```ts
listReports(uri: string, pattern?: string): Promise<
  CommandResult<ListReportsEntry[]>
>;

export interface ReportSelection {
  report?: string;
  reportsIsRegex?: boolean;
  dynamicAttributes?: string;
}

renderReports(uri: string, selection: ReportSelection): Promise<
  CommandResult<ExecutionResult>
>;

renderReport(
  uri: string,
  reportId: string,
  dynamicAttributes?: string,
): Promise<CommandResult<ReportJsonEntry>>;

openHtml(
  entry: ReportJsonEntry,
  masterUri: Uri,
): Promise<CommandResult<null>>;

export interface ReportExportOptions {
  projectUri: string;
  reportId: string;
  format: string;
  dynamicAttributes?: string;
  targetRootUri: string;
  fileName: string;
}

export interface ReportExportResult {
  execution: ExecutionResult;
  artifact: ArtifactResult;
}

export interface ReportExportPort {
  renderReports(
    uri: string,
    selection: ReportSelection,
  ): Promise<CommandResult<ExecutionResult>>;
  output: ConfirmedOutputHost;
}

export function exportReport(
  options: ReportExportOptions,
  port: ReportExportPort,
): Promise<CommandResult<ReportExportResult>>;

export interface FreezeCommandResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
}
```

- [ ] **Step 1: Add failing service tests.** `report.list` reads the cached
  inventory and applies an optional regex without scheduling. `renderReports`
  executes one exact id, a regular expression that returns multiple reports, or
  all reports when selection is empty; `-A` reaches the request as
  `dynamicAttributes`, and no render command writes by itself.
- [ ] **Step 2: Implement `syntaxmesh.report.list`.** With no pattern, return all
  cached reports. With a pattern, set `listReportsIsRegex: true` semantics in a
  pure filter and return a structured invalid-regex error rather than throwing.
- [ ] **Step 3: Implement `syntaxmesh.report.render`.** Map exact selection to
  `report`/`reportsIsRegex: false`, regex selection to `reportsIsRegex: true`, and
  no selection to the core default of all reports. Return the execution envelope
  and selected report data without opening or writing a Webview/artifact.
- [ ] **Step 4: Implement `syntaxmesh.report.open`.** Resolve/prompt project and
  report, call `renderReport` with optional dynamic attributes, and call
  `ReportPresenter.openHtml(entry, masterUri)`. The presenter returns
  `CommandResult<null>`; a missing HTML format produces a structured error listing
  the available format ids in declaration order. Keep the existing strict CSP,
  nonce, asset URI mapping and Save message.
- [ ] **Step 5: Implement `syntaxmesh.report.export`.** Resolve/prompt report and
  format, call `showSaveDialog` when no target argument is supplied, and suggest
  `reportFileName(reportId, format)` beside the master. Split the selected file URI
  into `ReportExportOptions.targetRootUri`/`fileName`, then call the pure
  `exportReport` function. It renders through the shared service and writes one
  `report` artifact through `ConfirmedOutputHost.writeAll`; Desktop uses `direct`
  and Web uses `stub-first`. Confirm before replacing an existing target and return
  the final URI string, basename and `kind: "report"`. Forward `dynamicAttributes`
  to the execution request. Extend `PUBLIC_COMMAND_IDS` and `contributes.commands`
  with `report.list`, `report.render`, `report.open` and `report.export`.
- [ ] **Step 6: Make freeze output explicit.** Validate each core-provided
  `FreezeFile.fileName` as a basename, reject path traversal, default both files
  beside the master, and submit header/bookings as one `ConfirmedOutputHost.writeAll`
  batch. Return `FreezeCommandResult` with the execution envelope and plain-data
  `freeze` artifacts only after every write succeeds; a failed write returns
  `CommandResult` failure and does not claim success.
- [ ] **Step 7: Keep `syntaxmesh.generateReport` as a runtime-only alias.** It may
  prompt for the old combined flow, but must delegate actual work to
  `report.open` or `report.export`; no duplicate scheduling or output policy.
- [ ] **Step 8: Package report assets deterministically.** Add the build-only
  `copyReportAssets` helper, call it before bundling, and test the exact 14-file
  inventory under `css/`, `icons/` and `scripts/wz_tooltip.js`. Resolve the source
  tree from the script URL and replace stale package assets.
- [ ] **Step 9: Run report, asset, package and build verification.**

```bash
deno task --cwd packages/vsextension tests
deno task build:vsext
```

---

## P8.4 — Multi-Project Tree, Menus and Status Bar

**Priority:** P2. **Depends on:** P8.1–P8.3 and P8.5 for the status-bar console
action. **Produces:** the tree as a thin client of the canonical API.

**Files:**
- Modify: `packages/vsextension/src/views/project-tree.ts`
- Modify: `packages/vsextension/src/views/host.ts`
- Modify: `packages/vsextension/src/views/status-bar.ts`
- Modify: `packages/vsextension/package.json`
- Test: `packages/vsextension/tests/views/project-tree_test.ts`
- Test: `packages/vsextension/tests/views/status-bar_test.ts`

**Interfaces:**

```ts
export interface TreeNode extends TreeItemData {
  id: string;
  kind: "project" | "category" | "entity" | "report";
  projectUri: string;
  reportId?: string;
  contextValue: "project" | "category" | "entity" | "report";
  command?: string;
  commandArgs?: unknown[];
  children: TreeNode[];
}

export function treeChildren(
  models: ProjectModel[],
  activeUri: string | null,
): TreeNode[];
```

- [ ] **Step 1: Add failing tree tests.** Two projects produce two root nodes;
  ids are globally unique; the active root is marked; report leaves carry
  `syntaxmesh.report.open` and `[projectUri, reportId]`; category/entity nodes do
  not become project commands.
- [ ] **Step 2: Implement project roots.** Root id is `project:${projectUri}`;
  child ids are prefixed with that root id. Root children are the existing five
  categories. Use error/loading/ok icons from `ProjectModel.status` and show the
  last intent in the description.
- [ ] **Step 3: Wire commands and context values in `getTreeItem`.** Project root
  click executes `syntaxmesh.project.setActive`; report click executes
  `syntaxmesh.report.open`. Add `contextValue` for project/report filtering.
  Refresh the tree after service state changes; when no explicit registry
  selection exists, an active cached master may become the fallback, but an
  explicit selection is never silently replaced.
- [ ] **Step 4: Add manifest menus.** Keep the existing activity-bar container.

```json
"menus": {
  "view/title": [
    {
      "command": "syntaxmesh.project.add",
      "when": "view == syntaxmesh.projectTree",
      "group": "navigation"
    },
    {
      "command": "syntaxmesh.project.refresh",
      "when": "view == syntaxmesh.projectTree",
      "group": "navigation"
    }
  ],
  "view/item/context": [
    {
      "command": "syntaxmesh.project.remove",
      "when": "view == syntaxmesh.projectTree && viewItem == project",
      "group": "project"
    },
    {
      "command": "syntaxmesh.compile",
      "when": "view == syntaxmesh.projectTree && viewItem == project",
      "group": "project"
    },
    {
      "command": "syntaxmesh.report.export",
      "when": "view == syntaxmesh.projectTree && viewItem == report",
      "group": "report"
    }
  ]
}
```

- [ ] **Step 5: Upgrade status state.** Add `projectCount`, `activeUri`, `busy`,
  `lastIntent` and execution `errorCount`. Show aggregate project/error counts and
  active intent; clicking executes `syntaxmesh.console.open`. Update before and
  after service execution so long schedules are visible.
- [ ] **Step 6: Run view tests and package tests.**

```bash
deno task --cwd packages/vsextension tests
```

---

## P8.5 — Command Parser, Pseudo-tj3 and Host-Specific Console

**Priority:** P2. **Depends on:** P8.1–P8.3 and P8.7. **Produces:** a console that
parses input and dispatches canonical commands, including full tj3-compatible
syntax, without duplicating business logic. P8.7 is numbered later because it is a
service slice, but its Steps 1–9 must land before the P8.5 CLI-compatible
acceptance run.

**Files:**
- Create: `packages/vsextension/src/console/parser.ts`
- Create: `packages/vsextension/src/console/formatter.ts`
- Create: `packages/vsextension/src/console/commands.ts`
- Create: `packages/vsextension/src/console/pty.ts`
- Create: `packages/vsextension/src/console/input-console.ts`
- Modify: `packages/vsextension/src/extension.node.ts`
- Modify: `packages/vsextension/src/extension.web.ts`
- Modify: `packages/vsextension/package.json`
- Test: `packages/vsextension/tests/console/parser_test.ts`
- Test: `packages/vsextension/tests/console/formatter_test.ts`
- Test: `packages/vsextension/tests/console/commands_test.ts`

**Interfaces:**

```ts
export type ConsoleRequest =
  | {
    kind: "project";
    action: "add" | "remove" | "list" | "setActive" | "refresh";
    project?: string;
  }
  | {
    kind: "execute";
    action: "compile" | "checkSyntax" | "scheduleOnly" | "freeze";
    project?: string;
    freezeDate?: string;
    byTask?: boolean;
    options?: ExecutionCommandOptions;
  }
  | {
    kind: "sheet";
    action:
      | "checkTimeSheet"
      | "checkStatusSheet"
      | "timeSend"
      | "timeReceive"
      | "timeSummary"
      | "statusSend"
      | "statusReceive";
    project?: string;
    sheet?: string;
    options?: SheetCommandOptions;
  }
  | {
    kind: "report";
    action: "list" | "render" | "open" | "export";
    project?: string;
    report?: string;
    pattern?: string;
    reportsIsRegex?: boolean;
    dynamicAttributes?: string;
    format?: string;
    target?: string;
  }
  | { kind: "run"; argv: string[]; stdin?: string }
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "exit" };

export function parseConsoleLine(line: string):
  | { ok: true; value: ConsoleRequest }
  | { ok: false; error: string };
```

- [ ] **Step 1: Add failing parser tests.** Cover all command families, quoted
  paths with spaces, optional project fallback, `--check-syntax`, `--no-reports`,
  `--freeze`, `--list-reports <regex>`, `--report`, `--reports`, `-A`, `--config`,
  `--output-dir`, `man`, `ts`, `ss`, `--from -`, `run`, `smx`, `tj3`, unknown commands,
  rejected debug flags and attempts to execute arbitrary `syntaxmesh.*` ids.
- [ ] **Step 2: Implement the pure parser.** Tokenize quotes without invoking a
  shell. `run <args...>`, `smx <args...>` and `tj3 <args...>` all return
  `{ kind: "run", argv }`; the shared F24 `parseArgs` performs option validation
  during dispatch. Bare `man`, `ts` and `ss` forms may normalize into the same
  request. Map semantic console verbs only to documented commands and reject
  missing required arguments.
- [ ] **Step 3: Implement pure formatters.** Add `formatProjectList`,
  `formatReportList`, `formatExecutionResult`, `formatManResult`,
  `formatSheetResult` and `formatRunResult`. Include stdout/stderr, status, intent,
  message severity/file/line, report/freeze/manual/sheet artifact names and email
  text. No VS Code imports.
- [ ] **Step 4: Implement command dispatch.** `console/commands.ts` converts a
  `ConsoleRequest` to an allowlisted canonical command id and argument array,
  awaits `commands.executeCommand`, and formats the returned `CommandResult`.
  Every `run` request dispatches only to `syntaxmesh.run`, regardless of whether
  the user typed `run`, `smx` or `tj3`; it never constructs a command id from
  untrusted input and never imports/spawns the CLI executable.
- [ ] **Step 5: Implement the Desktop pseudoterminal.** `pty.ts` owns the line
  buffer and `EventEmitter<string>`; `open()` prints help/prompt and documents the
  equivalent `run`, `smx` and `tj3` prefixes; `handleInput()` handles line completion
  and dispatches; `clear` emits terminal clear sequences;
  `exit` closes. For `--from -`, collect subsequent input until Ctrl+D and pass it
  as `stdin`. Extend `PUBLIC_COMMAND_IDS` and `contributes.commands` with
  `console.open` and `run`; keep `console.clear` runtime-only. Register the
  terminal and all disposables on the context.
- [ ] **Step 6: Implement the Web console adapter.** `input-console.ts` uses an
  `OutputChannel` plus sequential `showInputBox` prompts. For `--from -`, open an
  untitled document and use its text as `stdin`. Register the same public commands;
  do not import `pty.ts` from the browser entry. If browser testing later proves
  PTY support, replace the adapter without changing the command API.
- [ ] **Step 7: Add in-host acceptance.** Desktop: run `project list`,
  `check-syntax <uri>`, `run master.smx --check-syntax`,
  `smx master.tjp --list-reports 'cost|task'`, `tj3 man task`,
  `run ts summary master.smx --dry-run`,
  `smx ss send master.tjp --dry-run` and `clear`; verify all three prefixes are
  equivalent, `.smx` and `.tjp` masters both work, and stdout reports print.
  Bare semantic `man` stays project-free and bare `ts`/`ss` forms may resolve the
  active project, but prefixed `run`/`smx`/`tj3` sheet forms keep their positional
  master. Web: run `project list` and `run master.smx --no-reports`; verify no
  terminal or Node API is required.
- [ ] **Step 8: Run console and package tests.**

```bash
deno task --cwd packages/vsextension tests
```

---

## P8.6 — Web Bundle Hardening and Real Browser Acceptance

**Priority:** P0; bundle hardening can proceed in parallel with P8.1. **Depends on:**
delivered P3/P5; browser CLI acceptance also depends on P8.7. **Produces:**
deterministic bundle checks and actual Web runtime evidence.

**Files:**
- Modify: `packages/core/src/log.ts`
- Create: `packages/core/tests/log-runtime_test.ts`
- Modify: `packages/vsextension/src/web/purity.ts`
- Create: `packages/vsextension/src/web/bundle-purity.ts`
- Create: `packages/vsextension/scripts/check-web-bundle.ts`
- Create: `packages/vsextension/tests/web/bundle-purity_test.ts`
- Create: `packages/vsextension/tests/runtime/web-suite.ts`
- Modify: `packages/vsextension/tests/runtime/suite.ts`
- Modify: `packages/vsextension/deno.jsonc`
- Modify: `deno.jsonc`
- Modify: `docs/syntaxmesh/fases/fase-22-vscode-extension.md` §9.2/§11/§12

**Interfaces:**

```ts
export interface LogRuntime {
  isTerminal?: () => boolean;
  write?: (text: string) => void;
}

// Log.runtime defaults to a globalThis capability probe; tests can replace it.
static runtime: LogRuntime = detectLogRuntime();

export interface BundleViolation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

export function scanBrowserBundle(
  file: string,
  text: string,
): BundleViolation[];
```

- [x] **Step 1: Add a failing core runtime test.** Set `Log.runtime = {}` and
  assert `startProgressMeter`, `activity` and `progress` do not throw or write.
  Restore the original runtime after each test.
- [x] **Step 2: Remove unbound `Deno` from `Log`.** Detect optional terminal
  capabilities through `globalThis`, route progress output through
  `Log.runtime.write`, and leave `reset()` responsible only for message/progress
  state. Keep `stream-handle.ts` capability probes guarded through `globalThis`.
- [x] **Step 3: Add bundle-scanner unit tests.** Exercise `scanBrowserBundle`
  with inline fixtures. Flag unbound `Deno.`/`Deno?.`, `node:` imports/requires and
  unsafe `process.env/argv/exit/cwd`. Allow the known guarded minimatch
  `typeof process === "object" && process && process.platform === "win32"`
  capability check; do not allow arbitrary `process.platform` use.
- [x] **Step 4: Implement `check-web-bundle.ts`.** Import `scanBrowserBundle`,
  scan both generated Web bundles, print file/line/snippet/reason for every
  violation, and exit non-zero. Ignore comments and source-map payloads; never
  scan only the entry source.
- [x] **Step 5: Add deterministic tasks.** In `packages/vsextension/deno.jsonc`:

```json
"check:web-bundle": "deno task build && deno run --allow-read scripts/check-web-bundle.ts",
"build:web-tests": "deno bundle --platform=browser --format=esm --external=vscode tests/runtime/web-suite.ts --output=dist/web-tests.js",
"test:web-runtime": "deno task build:web-tests && deno run -A npm:@vscode/test-web@0.0.81 --extensionDevelopmentPath=. --extensionTestsPath=dist/web-tests.js --headless=true"
```

Add root task
`"check:web-bundle": "deno task --cwd packages/vsextension check:web-bundle"`
and insert it into `deno task tests` after `check:lspcore`. Browser runtime remains
outside the default gate because it downloads/launches a browser.

- [ ] **Step 6: Add the browser runtime suite.** Export `run()` and use the same
  sequential `check` collector as the Desktop suite. Verify: browser entry
  activation; Worker LSP initialization; hover/diagnostics on a `.smx` fixture;
  project add/list/setActive; parse-only and schedule-only; HTML report open; a
  TJP export report with more than 100 tasks to exercise progress paths; Web
  input-console open/clear; `run`, `smx` and `tj3` list-reports/manual aliases; a
  stdout report; and a user-triggered virtual-filesystem export.
- [ ] **Step 7: Run bundle and browser acceptance.**

```bash
deno task check:web-bundle
deno task --cwd packages/vsextension test:web-runtime
```

Expected: zero bundle violations and every browser check passing. A skipped or
mocked browser test does not close the Web acceptance item.

- [x] **Step 8: Reconcile documentation claims.** Replace the absolute "no
  `Deno.*`" wording with "no unbound runtime-specific globals; optional host
  capabilities are probed through `globalThis` or injected ports". Record the
  exact browser/runtime evidence in §11 and keep `vscode.dev` deferred until it is
  separately exercised or explicitly accepted from the local browser evidence.

---

## P8.7 — F24 CLI Parity and Pseudo-tj3 Service

**Priority:** P1. **Depends on:** P8.1–P8.3. **Produces:** semantic `man`, sheet-app,
help/version commands and a full CLI-compatible `syntaxmesh.run` adapter for
`.smx` and `.tjp` masters.

**Files:**
- Modify: `packages/cli/deno.jsonc`
- Create: `packages/cli/src/sheet-files.ts`
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/tests/sheet-files_test.ts`
- Modify: `packages/vsextension/deno.jsonc`
- Modify: `packages/vsextension/src/commands/service.ts`
- Modify: `packages/vsextension/src/daemon/request-builder.ts`
- Modify: `packages/vsextension/src/daemon/daemon-core.ts`
- Create: `packages/vsextension/src/commands/meta.ts`
- Create: `packages/vsextension/src/commands/manual.ts`
- Create: `packages/vsextension/src/commands/sheets.ts`
- Create: `packages/vsextension/src/commands/run.ts`
- Modify: `packages/vsextension/src/extension.node.ts`
- Modify: `packages/vsextension/src/extension.web.ts`
- Modify: `packages/vsextension/package.json`
- Test: `packages/vsextension/tests/commands/meta_test.ts`
- Test: `packages/vsextension/tests/commands/manual_test.ts`
- Test: `packages/vsextension/tests/commands/sheets_test.ts`
- Test: `packages/vsextension/tests/commands/run_test.ts`
- Test: `packages/vsextension/tests/web/cli-purity_test.ts`

**Interfaces:**

```ts
export interface Tj3RunContext {
  /** URI string used to resolve argv paths and relative output. */
  cwd?: string;
  stdin?: string;
  confirmOverwrite?: (paths: string[]) => Promise<boolean>;
  renderer?: { silent?: boolean; color?: boolean };
}

export interface Tj3RunResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
  stdout: string;
  stderr: string;
}

export interface SheetCommandOptions {
  directoryUri?: string;
  endDate?: string;
  resources?: string[];
  force?: boolean;
  hideResource?: string;
  intervalDuration?: string;
  to?: string[];
  sheetRecipients?: string[];
  digestRecipients?: string[];
  dryRun?: boolean;
  configUri?: string;
  fromUri?: string;
}

export interface SheetCommandResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
  stdout: string;
  stderr: string;
}

export interface ManCommandResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
  stdout: string;
}

export interface Tj3HostIo extends OutputPolicyIo {
  /** Resolves a policy path against root, or the adapter's configured URI root. */
  resolve(path: string, root?: string): string;
}
```

- [ ] **Step 1: Export the pure F24 CLI contracts and extract sheet-file reading.**
  Add `./options`, `./reporter`, `./output-policy`, `./images` and
  `./sheet-files` exports to `packages/cli/deno.jsonc`, and extend both
  `lint:doc`/`lint:doc:update` source lists to cover every new public module. Move
  `SHEET_TREES`, `collectTree` and `collectSheetFiles` from `cli.ts` into
  `sheet-files.ts` with an injected `read`, `listDir` and `isDir` port; remove the
  Deno/path/runtime-I/O dependency from that module. Update `cli.ts` to import it
  and keep the CLI behavior unchanged. Add fake-I/O tests for nested trees and
  missing directories.
- [ ] **Step 2: Add failing execution-mapping tests.** Verify that `help`, `version`,
  `man` and all five sheet apps reach `buildExecuteRequest` as structured data.

```ts
it("maps help and version without requiring a project", () => {
  const closure: InputClosure = { files: [], missing: [] };
  assertEquals(buildExecuteRequest(closure, { help: true }).help, true);
  assertEquals(buildExecuteRequest(closure, { version: true }).version, true);
});

it("maps the current man formats and sheet apps", () => {
  const closure: InputClosure = { files: [], missing: [] };
  const man = buildExecuteRequest(closure, {
    man: { format: "smx", keywords: ["task"] },
  });
  assertEquals(man.man?.format, "smx");
  assertEquals(man.man?.keywords, ["task"]);

  for (const app of ["ts-send", "ts-receive", "ts-summary", "ss-send", "ss-receive"] as const) {
    assertEquals(buildExecuteRequest(closure, { app }).app, app);
  }
});
```

Run: `deno task --cwd packages/vsextension tests`. Expected: FAIL until Step 3.

- [ ] **Step 3: Extend request mapping and daemon intent.** Copy `help`, `version`
  and `man` only when defined; keep `appOptions` plain data. `DaemonCore` records
  `sheet` for sheet apps and `man` for manual execution. Help/version do not require
  a cached project. A project-backed CLI-compatible run may record intent `run`.
- [ ] **Step 4: Implement the injected output host.** Keep `cli/output-host.ts`
  pure over `Tj3HostIo`; `cli/host.ts` is the VS Code adapter for `workspace.fs`,
  URI resolution and Desktop `direct`/Web `stub-first` writes. Resolve relative
  paths against `Tj3RunContext.cwd`, the master directory or the sheet root. Run
  `dispatchSections` once in record-only mode with no-op `print`/`mkpath`, no real
  `write`/`copy` and `onError: null`; an aborted preview writes nothing. Confirm
  all deduplicated existing destinations in one `confirmOverwrite` call, rejecting
  a missing callback only when confirmation is required, then perform the real
  dispatch. Capture only real `print` calls as stdout and each real copy as an
  `ArtifactCopy`. Resolve the `assets` root from the extension installation and
  classify report/freeze/manual/sheet/email plus asset/image destinations by the
  copy source root, not by destination names; never return host objects.
- [ ] **Step 5: Implement help and version commands.** Register
  `syntaxmesh.help` and `syntaxmesh.version`; each calls `execute` with only its
  flag and returns the envelope. Add manifest/constants tests proving they need no
  active project and do not open files.
- [ ] **Step 6: Implement the manual command.** `syntaxmesh.man` accepts only
  `text`, `html` and `smx`, forwards keywords, and calls `execute` with
  `request.man`. Text/SMX return as stdout by default; an explicit file target is
  split into directory URI/basename and written through
  `ConfirmedOutputHost.writeAll`. HTML treats `targetUri` as a directory, sets it
  as request `outputDir`, and dispatches the manual file map through the shared
  output host. Add tests for each format, keyword forwarding and rejection of the
  stale `tjp` format.
- [ ] **Step 7: Implement the five sheet-app commands.** Map `time.send`,
  `time.receive`, `time.summary`, `status.send` and `status.receive` to the F24 app
  names. Resolve an explicit, active or single loaded project before building the
  request; never pass an empty project closure to a sheet app. Hydrate
  `--directory`, `--config`, `--from`, recipients and sheet trees through host
  ports; map `--to` to both recipient lists and `--sheet`/`--digest` to their
  respective lists; call `collectSheetFiles` for send/receive/summary as F24
  does. Use `dispatchSections` for file deltas, email text and `outbox/*.eml`; do
  not send SMTP. Add tests for every app, `--dry-run`, stdin message input, project
  resolution and missing-message errors.
- [ ] **Step 8: Implement `syntaxmesh.run`.** Call the shared `parseArgs(argv)`
  exactly once. Resolve the positional `.smx`/`.tjp` master, config/sheet/message
  paths and output directory through the host. Add/refresh the explicit project
  when a master is present. Help/version/man are project-free; parsed `ts`/`ss`
  invocations retain the F24 positional-master requirement and pass that resolved
  project to the semantic sheet service. For project execution, call the same
  service methods as the semantic commands. Format envelope messages with
  `Reporter`, then invoke
  `OutputHost.dispatch(execution, { cwd, confirmOverwrite, sheetBaseDir, imageDir, onError })`
  only when the envelope permits output. Capture stdout/stderr and return
  `Tj3RunResult`. Repeated `--report` follows current `parseArgs` overwrite
  semantics; multiple selection uses
  `--reports <RE>` until a future core delta says otherwise.
- [ ] **Step 9: Register the public commands and manifest entries.** Extend
  `PUBLIC_COMMAND_IDS` and `contributes.commands` with `man`, the five sheet-app
  commands, `help`, `version` and `run`; do not contribute a separate tj3 command.
  Desktop and Web handlers must share the same UI-free service; only their I/O
  adapter differs.
- [ ] **Step 10: Add CLI parity and Web purity tests.** Compare `parseArgs` output
  with the extension request builder for every flag in the F24 mapping table.
  Exercise exact/regex reports, `-A`, `stdout` reports, `--output-dir`,
  `--force-reports`, `--abort-on-warnings`, `--warn-ts-deltas`, `--add-trace`,
  freeze header/bookings, HTML manual, sheet file/email output, help/version,
  `.smx`/`.tjp`, invalid/debug flags, overwrite confirmation, and equivalent
  `run`/`smx`/`tj3` console prefixes. Assert the Web dependency graph and generated
  bundles do not include `packages/cli/src/cli.ts`, `packages/cli/src/io.ts`,
  `node:fs`, `node:path` or a child-process import.
- [ ] **Step 11: Run package and bundle verification.**

```bash
deno task --cwd packages/cli tests
deno task --cwd packages/vsextension tests
deno task build:vsext
deno task check:web-bundle
```

Expected: CLI tests unchanged and passing, extension parity tests passing, four
bundles generated, and zero Web bundle violations.

---

## P8 Acceptance and Non-Goals

### Acceptance checklist

- [ ] Palette, tree and console invoke the same service methods and command ids.
- [ ] Explicit project arguments work from tree/context/console; `.smx` is native,
  `.tjp` remains accepted, and `.tji` cannot be added as a master project.
- [ ] Active selection survives Desktop restore and is deterministic on Web.
- [ ] Parse-only never schedules; schedule-only never renders; compile returns all
  report data in memory; freeze/sheet checks match the F24 envelope contract.
- [ ] Every F24 root flag, subcommand and addendum behavior has a typed mapping or
  an explicit rejection, including renderer-only `--silent`/`--no-color`.
- [ ] `man`, all five `ts`/`ss` apps, help and version are callable without
  duplicating engine logic; semantic sheet commands resolve a project, sheet apps
  return files/email data and never use SMTP.
- [ ] `syntaxmesh.run` accepts explicit `.smx` and `.tjp` files, shares F24
  `parseArgs`, and reproduces stdout reports, freeze/manual/sheet artifacts,
  assets/images and overwrite confirmation. Console `run`, `smx` and `tj3` are
  equivalent prefixes for project, `man`, `ts` and `ss` forms; prefixed `ts`/`ss`
  forms retain the positional master while bare semantic forms may use the active
  project.
- [ ] Execution diagnostics are separate from LSP diagnostics and are cleared per
  project.
- [ ] Report list/render/open/export are independently callable; exports, run file
  output and freeze files require overwrite confirmation.
- [ ] Desktop PTY and Web input console share parser, dispatch and formatters.
- [ ] Generated Web bundles pass the deterministic scanner.
- [ ] Real browser acceptance passes and is recorded; until then, Web support is
  "implemented, runtime verification pending", not fully accepted.
- [ ] Full project gate and packaging pass:

```bash
deno task tests
deno task build:vsext
deno task --cwd packages/vsextension test:runtime
deno task --cwd packages/vsextension test:web-runtime
deno task package:vsext
```

### Explicit non-goals

- Do not add a second semantic-token provider; LSP already owns that feature.
- Do not spawn the external `tj3`/SyntaxMesh CLI or import its process/runtime-I/O
  entry points; pseudo-tj3 is an in-process compatibility adapter.
- Do not add SMTP delivery for sheet apps; F24 returns email text and file deltas.
- Do not change the current single-string `--report` core contract; multiple
  selection uses `--reports <RE>` until a separate core delta is approved.
- Do not add automatic save/change scheduling or a filesystem watcher feeding the
  daemon.
- Do not implement cached-model report generation in P8; current re-parse and
  re-schedule behavior remains the F24-backed contract.
- Do not replace the report Webview with a Custom Editor unless a later measured
  requirement justifies it.
- Do not move the existing activity-bar tree into the Explorer merely to match
  the illustrative blueprint.
- Do not claim pseudoterminal support on Web without runtime evidence.
- Do not reopen or renumber completed P1–P7 tasks; record P8 execution in the
  Fase 22 task document when implementation begins.

---

**Fim do plano da Fase 22 (extensão VS Code + `lsp-core` + LSP CLI).**
