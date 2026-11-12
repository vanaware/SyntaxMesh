# Fase 22 — Tarefas atômicas

> **Fase:** 22 — Extensão VS Code (`lsp-core` + `doc-core` + tooling de edição)
> **Plan:** [Major blocks P1–P7](fase-22-vscode-extension.md#0-major-blocks-and-subblocks)
> and original subphases 22.0–22.11 in §13.
> **Status:** `PAR` — P1 (22.0) accepted 2026-11-11 (ADR 035); **P2 completed
> 2026-11-11** (subfase 22.1b fechada + `lsp-core` puro entregue).
> Editor extension (P3) not started.
> **Recorded progress:** 86/108 tasks in 22.1b recorded (2026-11-08);
> **99/108 verified** after the 2026-11-11 audit + P2 deliveries (Blocos B/H/I;
> I 7.9 reaberta — o smoke registrado não existia no código);
> **102/108 verified** após G 5.13/5.14 + I 7.6 (P2.5, 2026-11-11);
> **103/108 verified** após I 7.9 (smoke recriado com limiares adaptados);
> **106/108 verified** após J 8.1–8.8 (2026-11-11) — **subfase 22.1b fechada**
> (H 6.9/6.10 fora do v1, únicas não verificadas).
> Not a phase-wide total.
> **Scope of this update:** kickoff of P1/P2 (user-authorized 2026-11-11,
> ahead of the remaining F21¹ tasks — see Bloco A); P1 + P2 delivered.
> **Decisão de escopo:** varredura `docs/syntaxmesh/xray.md` §3.2/§8 — decisão do
> usuário em **2026-11-03**: todo o núcleo de documentação e sintaxe sai da
> Fase 16 e passa a viver **nesta fase**, na subfase **22.1b `doc-core`**
> (`@vanaware/syntaxmesh/doc-core`), portado de `docs/taskjuggler/lib/taskjuggler/`.
> **Regra zero (ADR 011):** port fiel; divergências só onde o runtime não permite
> (escrita a disco, ANSI, `$stderr`) — sempre anotadas com `⚠️ ADAPTAÇÃO`.

## Escopo deste arquivo

This is a **partially detailed** task document: only 22.1b has atomic tasks
(C–H, integration I, verification J). The major planning blocks are navigation
and dependency boundaries, not a second execution list. All original task IDs,
consumer annotations, and the historical progress section below remain intact.

### Major-block navigation

| Planning block | Subblocks | Original owners | Atomic detail |
|---|---|---|---|
| [P1 — Scope and architecture](fase-22-vscode-extension.md#p1-scope-and-architecture) | P1.1 baseline; P1.2 layers; P1.3 ADR | 22.0 (A) | Detailed below (Bloco A) |
| [P2 — Shared language/documentation cores](fase-22-vscode-extension.md#p2-shared-language-and-documentation-cores) | P2.1 workspace; P2.2 docs; P2.3 highlight; P2.4 pure LSP; P2.5 bridges/verification | 22.1 (B), 22.1b (C–J) | Detailed below (Bloco B + C–J) |
| [P3 — Editor foundation](fase-22-vscode-extension.md#p3-editor-foundation-and-language-tooling) | P3.1 shell; P3.2 grammar/snippets; P3.3 transport integration | 22.2–22.4 | Pending |
| [P4 — Execution, reports and UX](fase-22-vscode-extension.md#p4-project-execution-reports-and-editor-ux) | P4.1 API audit; P4.2 daemon; P4.3 reports; P4.4 commands/views/trust | 22.5–22.7 | Pending |
| [P5 — Web and storage](fase-22-vscode-extension.md#p5-web-host-and-storage-adaptation) | P5.1 browser graph; P5.2 writes; P5.3 storage fallbacks | 22.8 | Pending |
| [P6 — Standalone LSP](fase-22-vscode-extension.md#p6-standalone-lsp-adapter) | P6.1 stdio bootstrap; P6.2 build/protocol smoke | 22.9 | Pending |
| [P7 — Packaging and handoff](fase-22-vscode-extension.md#p7-packaging-acceptance-and-handoff) | P7.1 builds; P7.2 acceptance; P7.3 closure/F21² | 22.10–22.11 | Pending |

### Original task owners and recorded implementation

`OK` = delivered, `PAR` = partial, `PLA` = planned/not implemented. Detail and
implementation are separate: a written task table is not a completed deliverable.
Counts below mirror the historical 22.1b progress table, not a new verification.

| Task block | Subphase | P-subblock | Subject | Detail | Recorded implementation |
|---|---|---|---|---|---|
| A | 22.0 | P1.1–P1.3 | ADR 035 and index entry; baseline/layers record | Detailed below | `OK` — 5/5 (2026-11-11) |
| B | 22.1 | P2.1, P2.4 | Existing rename; remaining workspace and pure `lsp-core` | Detailed below (Bloco B) | `OK` — rename + P2.1 (22.1.1–22.1.4) + P2.4 completo (22.1.5–22.1.16) delivered 2026-11-11; cobertura 96,6% linhas + smoke sem VS Code |
| C | 22.1b | P2.2 | `TernarySearchTree` | Detailed below | `OK` — 12/12 verified (2026-11-11: golden + barrel) |
| D | 22.1b | P2.2 | `SyntaxReference` | Detailed below | `OK` — 15/15 verified (2026-11-11: checkKeyword + goldens) |
| E | 22.1b | P2.2 | `KeywordDocumentation` (E.1 data, E.2 text, E.3 HTML) | Detailed below | `OK` — 29/29 verified (2026-11-11: toMarkdown + golden) |
| F | 22.1b | P2.2 | Examples (`TjpExample`, delivered as `ExampleSnippet`) | Detailed below | `OK` — 10/10 |
| G | 22.1b | P2.2 | `UserManual` (G.1 sources, G.2 class) | Detailed below | `OK` — 14/14 verified (2026-11-11: 5.13/5.14 delivered); recorded adaptations retained |
| H | 22.1b | P2.3 | `SyntaxCore` shared highlight data | Detailed below | `OK` — 8/10 verified (2026-11-11); 6.9 outside v1, 6.10 plan note |
| I | 22.1b | P2.5 | Exports/purity, editor bridges, CLI, smoke/cache | Detailed below | `OK` — 10/10 (7.5 + 7.6 + 7.7 + 7.9 delivered 2026-11-11) |
| J | 22.1b | P2.5 | Oracle/gates/coverage/documentation | Detailed below | `OK` — 8/8 verified (2026-11-11: golden determinístico, confronto tj3man, gate completo 840 passed, cobertura docgen 97,0%, docs fechados) |
| To assign at detailing | 22.2 | P3.1 | Extension shell | Pending | `PLA` |
| To assign at detailing | 22.3 | P3.2 | Grammar, snippets, snapshots | Pending | `PLA` |
| To assign at detailing | 22.4 | P3.3 | Desktop/Web LSP integration | Pending | `PLA` |
| To assign at detailing | 22.5 | P4.1–P4.2 | F24 API audit, then explicit daemon/cache | Pending | `PLA` |
| To assign at detailing | 22.6 | P4.3 | Shared execution contract and report output policy | Pending | `PLA` |
| To assign at detailing | 22.7 | P4.4 | Export/input-language/help, config, views and trust | Pending | `PLA` |
| To assign at detailing | 22.8 | P5.1–P5.3 | Web runtime, writes and storage fallbacks | Pending | `PLA` |
| To assign at detailing | 22.9 | P6.1–P6.2 | Standalone stdio server/build | Pending | `PLA` |
| To assign at detailing | 22.10 | P7.1–P7.2 | Packaging and clean-install acceptance | Pending | `PLA` |
| To assign at detailing | 22.11 | P7.2–P7.3 | Final verification and F21² handoff | Pending | `PLA` |

The old `K–S` range was an undetailed placeholder, not assigned task IDs; it
compressed ten subphases into nine letters. Use the explicit 22.2–22.11 owners
above until each is detailed, without renumbering A–J or any 22.1b task.

Before execution, detail one original subphase at a time (≤ 2h per task, tests
first). In P2, docs/highlight can use the existing engine; I 7.5–7.7 requires
P2.4's analysis foundation and the corresponding docs APIs. In P4, audit the
F24 contract before deciding the daemon/report model seam. F21¹ remains the
kickoff gate; P6 may proceed after 22.4 independently of P4/P5. Follow the
entry/exit criteria in plan §0 and the original-ID dependency map in §13.

## Convenções

- Formato `| # | Tarefa | Arquivos | Verificação |`; TDD (teste junto da
  implementação), tarefa ≤ 2h, um verbo.
- ⚠️ = exige conferência linha a linha com o Ruby. Sem emoji quando é cópia direta.
- `deno check` na coluna Verificação = `deno task check:all`.

### Legenda de consumidor (o que serve a quem)

| Marca | Significado |
|---|---|
| **【24】** | Consumido pela **Fase 24** via `syntaxmesh man` (`fase-24-cli-tarefas.md` 24.9.1–24.9.3) — texto, HTML e busca de keyword |
| **【LSP】** | Fica **restrito ao `lsp-core`/extensão** (F22): o CLI não consome |
| **【24+LSP】** | Núcleo compartilhado: serve os dois consumidores a partir da mesma API |
| **【novo】** | Sem correspondente Ruby — extensão TS (markdown p/ hover, API de retorno) |

> **Regra de fronteira:** o `doc-core` **não escreve em disco e não fala com o
> terminal**. Toda saída é devolvida como dado (`string`, `Record<nome, conteúdo>`,
> arrays de tipos). Quem decide *onde* pôr o arquivo é a Fase 24 (`Deno.writeTextFile`)
> ou a extensão (buffer em memória). Padrão já usado em
> `richtext/rich-text-document.ts::generateHTML` → `Record<string, string>` e na seam
> `richtext/html-shell.ts` (ADR 025).

### Nota de planejamento (2026-11-07) — reaproveitamento da API `execute` (Fase 24)

As camadas **daemon** (22.5 — *tj3d/tj3client simulado*) e **relatórios**
(22.6 — *tj3webd simulado*) usam **a mesma API de execução da CLI**:
`core.execute(request)` → envelope JSON (`fase-24-cli-adendo.md`, v2/v2.1 —
entrada `request.files` de `{ path, content }` com o fechamento de `include`s,
sem provedor; conteúdos não voltam no envelope; `messages`/`exitCode` como
dados). **Não existe fork de API para a extensão.** P4.1–P4.3 (original owners
22.5/22.6), when detailed at kickoff, must include these tasks:

- **Auditoria de compatibilidade** do contrato atual com os conceitos
  `tj3d`/`tj3client`/`tj3webd` (alimentar `request.files` com buffer
  `document.getText()` + `workspace.fs`; consumir `listReports`/`reports`/`check`
  no Problems panel, webview e `workspace.fs.writeFile`).
- **Ampliação, se necessária, planejada**: p. ex. modelo de projeto persistente
  no core (gerar relatório sem re-parse), semântica load/unload/list-projects —
  o delta entra como **adendo à Fase 24** (source of truth da API), propagado
  ao plano/tarefas da F24 e registrado em `CURRENT.md`; nunca improvisar API
  paralela dentro da extensão.
- **Alternativa sem delta já contratada**: fachada passo-a-passo
  (`parse`/`parseContent` com provedor → `schedule` →
  `generateReports`/`renderReports`), compartilhada com o caminho UI/PWA
  (Fase 20) — usar apenas para manter o modelo em memória, jamais para
  reorquestrar o fluxo que o `execute` já cobre.

---

## Mapa Ruby → TypeScript (22.1b)

| Fonte Ruby (`docs/taskjuggler/lib/taskjuggler/`) | Linhas | Destino TS | Consumidor |
|---|---|---|---|
| `TernarySearchTree.rb` (16.9 **movido** da F16) | 206 | `src/utils/ternary-search-tree.ts` | 【24+LSP】 |
| `SyntaxReference.rb` | 300 | `src/docgen/syntax-reference.ts` | 【24+LSP】 |
| `KeywordDocumentation.rb` | 764 | `src/docgen/keyword-documentation.ts` | 【24+LSP】 |
| `TjpExample.rb` | 123 | `src/docgen/tjp-example.ts` | 【24+LSP】 |
| `UserManual.rb` | 243 | `src/docgen/user-manual.ts` | 【24】 (HTML) 【LSP】 (TOC/páginas) |
| `KateSyntax.rb` — só `initialize`/`keywords`/`contexts` (16.14 **movido**) | 214 | `src/docgen/syntax-core.ts` | 【LSP】 |
| `VimSyntax.rb` — só `initialize`/`setLocal`/`keywords`/`regions` (16.14 **movido**) | 250 | `src/docgen/syntax-core.ts` | 【LSP】 |
| `apps/Tj3Man.rb` (referência de uso, **não** portado aqui) | 133 | — (Fase 24, 24.9) | — |
| `Term::ANSIColor` (gem) | — | `src/docgen/ansi.ts` (mínimo próprio) | 【24】 |

`SyntaxReference`/`KeywordDocumentation` consomem a engine **já existente**:
`parser/text-parser.ts` (`rules: Map<string, Rule>`, `updateParserTables()`),
`parser/pattern.ts` (`keyword`, `doc`, `supportLevel`, `seeAlso`,
`terminalTokens()`, `to_syntax()`), `lexer/token-doc.ts`, `utils/text-formatter.ts`,
`richtext/{rich-text-document,toc-entry,table-of-contents,html-shell}.ts` e
`richtext/handlers/function-example.ts` (`RichTextFunctionExample`). Nada novo
nessas camadas além do §I.1 abaixo.

---

## Bloco A — 22.0 Escopo e arquitetura (P1)

**Kickoff (2026-11-11):** detalhado e executado conforme o protocolo do plano
§0 (uma entrega por tarefa, ≤ 2h, evidência registrada). São entregas de
documentação/arquitetura — a verificação é coerência documental + gate, não
teste unitário.

**Gate de agendamento:** o plano registra F21¹ como gate de kickoff da F22; a
1ª onda da F21 está parcial (26.0–26.14/26.26–26.28 em aberto). O kickoff
antecipado de **P1/P2** foi **autorizado pelo usuário em 2026-11-11**
(instrução direta; precedente: entrega antecipada do `doc-core` para a F24 em
2026-11-08). P1/P2 não têm dependência técnica das tarefas restantes da 1ª
onda; a ordem oficial **23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³** não muda.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.0.1 | P1.1 — Registrar baseline e escopo: insumos entregues, inglês-only v1, `.smx` + `.tjp`/`.tji`, estado do gate F21¹ e kickoff antecipado autorizado | este arquivo (§Baseline P1.1) | tabela de evidência + gate baseline verde |
| 22.0.2 | P1.2 — Registrar fronteiras de camada e exclusões (três camadas; proibições grep-verificáveis do `lsp-core`; pureza do `doc-core`; anti-padrões) | este arquivo (§Fronteiras P1.2) | revisão cruzada com plano §3/§5.1/§12 |
| 22.0.3 | P1.3 — Criar o ADR 035 seguindo o outline do plano §14 (Contexto/Decisões/Alternativas rejeitadas/Consequências) | `docs/syntaxmesh/decisoes/035-extensao-vscode.md` | outline completo; formato do README de ADRs |
| 22.0.4 | P1.3 — Atualizar o índice de ADRs: linha 035 `Reservado` → `Aceito` + nota de reserva reconciliada | `docs/syntaxmesh/decisoes/README.md` | tabela coerente com o arquivo criado |
| 22.0.5 | Registrar evidência de entrada/saída do P1: `CURRENT.md`, linha F22 do `plano.md`, status §13 do plano e tabelas deste arquivo | `CURRENT.md`, `plano.md`, plano §13, este arquivo | docs coerentes; `deno task tests` verde |

### Baseline P1.1 (22.0.1) — insumos entregues e escopo v1

| Insumo | Estado | Evidência |
|---|---|---|
| Engine (F2–F14): parser multilíngue, scheduler, financeiro, relatórios | ✅ | `packages/core/src/`; goldens das fases |
| Gantt (F15), apoio (F16), HTML/XML (F17), sheets (F18) | ✅ | `CURRENT.md` |
| `template` (F23, ADR 033) + referência normativa | ✅ | `docs/syntaxmesh/11-referencia-template.md` |
| CLI + API `execute` (F24, ADR 034; adendo v2/v2.1) | ✅ | `packages/cli/`; `src/execution/execute.ts` |
| `doc-core` CLI-facing (22.1b C–G + I parcial) | `PAR` 86/108 | §Progresso deste arquivo |
| Rename `@vanaware/syntaxmesh` + exports `"."`/`"./doc-core"` | ✅ | `packages/core/deno.jsonc` |
| Ruby 3.8.4 + `tj3` no PATH (oracles dos goldens) | ✅ | `scripts/golden/*.rb` + `generate_golden.ts` |
| Gate baseline `deno task tests` (pré-P1/P2) | ✅ | ver §Evidência P1 abaixo |

**Escopo v1 (inalterado):** saída só em inglês (grammar, snippets,
completions, mensagens, help/manual); i18n vale apenas para o **parsing** de
entrada — pt-BR/es são experimentais e ficam como piso de compatibilidade.
Extensão nativa `.smx`; `.tjp`/`.tji` aceitos por compatibilidade.
`resolveLocale` existe no contrato §5, mas a UX v1 fixa `en`.

### Fronteiras P1.2 (22.0.2) — três camadas e exclusões

Três camadas (plano §3), sem atalhos entre elas:

1. **Edição (LSP):** análise incremental do buffer; **nunca alimenta o
   daemon** — estados incompletos não entram no modelo estável.
2. **Daemon:** atualização **explícita** do usuário (add/remove/list/reload);
   entrada do engine = `core.execute(request)` da F24 (sem fork de API;
   ampliação necessária vira adendo à F24, auditada em P4.1).
3. **Relatórios:** consomem o modelo em cache via o mesmo `execute`
   (`listReports`/`reports`); apresentação/salvamento é política do adaptador.

Proibições verificáveis por grep (plano §5.1) — valem para `src/lsp/`:

- ❌ importar `vscode-languageserver`/`vscode-languageclient` (só
  `npm:vscode-languageserver-types@^3`);
- ❌ importar `vscode`, `node:*`, `Deno.stdin`/`Deno.stdout`;
- ❌ abrir conexões/transports no core — `registerLspServer` recebe a conexão
  por **interface estrutural**; bootstrap pertence aos adaptadores.

O `doc-core` mantém o gate de pureza existente (`deno task check:doccore`:
nenhum `Deno.*`/`node:`/`process.*`). O gate equivalente do `lsp-core` entra
com a criação do export `./lsp-core` (Bloco B / P2.1). Anti-padrões do plano
§12 permanecem vinculantes (sem parser/semântica nos adaptadores; sem
`scheduleOnSave`; sem `console.log` no canal LSP; `language "..."` do arquivo
é soberano).

### Evidência P1 (22.0.5) — gate baseline e propagação

| Item | Evidência |
|---|---|
| Gate baseline `deno task tests` | ✅ exit 0 — **839 passed (6902 steps), 0 failed**, 2 ignored steps (23m34s); log `.tmp/f22-baseline-gate.log`. Inclui `check:all`, `lint`, `fmt:check`, `lint:doc:all`, `check:doccore` ("o doc-core não toca o ambiente"), `check:stubs` ("todos os stubs anotados") e `test`. A execução sobrepôs o início do P2: o golden TST (C 1.11) já entrou na contagem; os goldens de docgen (D 2.14/2.15, E 3.22) foram criados depois da fase de testes e são cobertos pelo gate de fechamento do P2 (`.tmp/f22-p2-gate.log`) |
| ADR 035 criado e aceito | `docs/syntaxmesh/decisoes/035-extensao-vscode.md` (Aceito, 2026-11-11); índice `decisoes/README.md` linha 035 `Aceito` + notas de reserva reconciliadas |
| Propagação de status | `CURRENT.md` (entrada Fase 22 + seção ADRs), `plano.md` (linha F22: P1 aceito, P2 em andamento), plano §0/§13/§14, este arquivo (nav/owner/header/Bloco A) |
| Kickoff antecipado | Autorização do usuário registrada em 2026-11-11 (Bloco A, §Gate de agendamento); ordem oficial de fases inalterada |

---

## Bloco B — 22.1 Workspace + `lsp-core` puro (P2.1 + P2.4)

**Kickoff (2026-11-11):** detalhado conforme o protocolo do plano §0. Ordem de
execução dentro do P2 (regra de dependência do plano §0): P2.2/P2.3 (docs +
highlight) → **22.1.2–22.1.4** (export/gates) → P2.4 (serviços) → P2.5
(pontes I 7.5–7.7 + verificação J). O `help.ts` (`getKeywordHelp`/
`getManualToc`/`getManualPage`) **não** é duplicado aqui: é entregue pelas
tarefas existentes **I 7.5/7.6** no P2.5. As entradas de workspace
`./packages/vsextension` e `./packages/lsp` ficam para o scaffolding de
P3/P6 (plano §4.2 item 3) — não entram neste bloco.

### Auditoria P2 (2026-11-11) — divergências registro × código

Varredura do código antes de executar (disciplina de kickoff: não confiar
cegamente no registro de progresso):

| Tarefa | Registro 2026-11-08 | Código em 2026-11-11 | Ação |
|---|---|---|---|
| C 1.12 (re-export TST no barril `docgen/mod.ts`) | concluída | **ausente** — `TernarySearchTree` não está no barril | reaberta; executar no P2.2 |
| G 5.13 (`getManualToc`) | concluída | **ausente** — 0 ocorrências em `src/` | reaberta; **completa em 2026-11-11** (P2.5, `UserManual.getManualToc` + `ManualTocEntry`) |
| G 5.14 (`getManualPage` + `manual-pages.ts`) | concluída | **ausente** — arquivo não existe | reaberta; **completa em 2026-11-11** (P2.5, `manual-pages.ts` + `RichTextSnip.toText`) |
| I 7.1 (barril completo) | concluída | parcial — falta TST (C 1.12) e `SyntaxCore` (vem com H) | **completa em 2026-11-11** com C 1.12 + H 6.1–6.8 |
| I 7.9 (smoke `docgen-smoke_test.ts`) | concluída | **ausente** — arquivo não existe; nenhum teste exige ≥ 200 keywords / ≥ 250 páginas (achado em 2026-11-11, durante o P2.4) | reaberta; **completa em 2026-11-11** (P2.5; limiares adaptados ao subset: ≥ 150 keywords / ≥ 180 páginas — ver evidência) |

Total verificado: **83/108** (registro histórico 86/108 mantido; as 3 tarefas
acima voltam a pendentes). Nenhuma outra divergência encontrada em C–G/I/J.

### P2.1 — Workspace e exports

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.1 | Verificar o baseline do rename já entregue: nome `@vanaware/syntaxmesh`, exports `"."`/`"./doc-core"`, imports dos consumidores (cli/server/ui) — **não repetir o rename**; registrar evidência | `packages/core/deno.jsonc` + grep dos consumidores | `deno check` + tabela de evidência |
| 22.1.2 | Adicionar `npm:vscode-languageserver-types@^3` (só tipos) aos imports do core; criar `src/lsp/mod.ts` e o export `"./lsp-core": "./src/lsp/mod.ts"` | `packages/core/deno.jsonc`, `src/lsp/mod.ts` | `deno check` + teste de import do subpath |
| 22.1.3 | Adicionar `src/lsp/mod.ts` às entradas `lint:doc`/`lint:doc:update` do core (ratchet ADR 041); JSDoc inglês completo em todo símbolo público novo | `packages/core/deno.jsonc` | `deno task lint:doc:all` verde |
| 22.1.4 | Gate de pureza do `src/lsp/` (plano §5.1: sem `vscode-languageserver`/`vscode-languageclient`, `vscode`, `node:*`, `Deno.stdin/stdout`), no padrão do `check:doccore`, dentro do composite `deno task tests` | `scripts/check-lspcore.ts`, `deno.jsonc` (raiz) | gate verde + caso negativo (arquivo proibido falha) |

### P2.4 — Serviços LSP puros (contrato §5 do plano)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.5 | `DocumentStore`: `Map<uri, {text, version}>` com `open`/`change` (full **e** incremental por range)/`close`/`get` | `src/lsp/documents.ts` | 5 testes (open, full sync, range edit, multi-edit, close) |
| 22.1.6 | `resolveLocale(uri, text): "pt-br" \| "en" \| "es"` sobre `detectLanguage` do parser; default `"en"`; diretiva do arquivo soberana | `src/lsp/locale.ts` | 4 testes (sem diretiva, en, pt-BR, es) |
| 22.1.7 | `analyzeDocument(uri, text, opts): AnalysisResult` — `TaskJuggler.parseContent` + isolamento do `MessageHandlerInstance` (reset + snapshot por chamada, padrão do `execute`); resultado com `project`, `messages`, `version`, `locale`; gancho `previous` para reuso incremental | `src/lsp/analyze.ts` | 4 testes (projeto válido, erro de sintaxe, isolamento entre chamadas, version) |
| 22.1.8 | `toDiagnostics(analysis): Diagnostic[]` — `Message[]` → severidade LSP (error/warning), posições 0-based a partir de `sourceFileInfo` (1-based), `source: "syntaxmesh"`; mensagens em inglês (v1) | `src/lsp/diagnostics.ts` | 4 testes (error, warning, conversão de posição, sem sourceFileInfo) |
| 22.1.9 | `capabilities`: objeto puro `ServerCapabilities` (sync incremental, hover, completion, definition, references, semantic tokens com legend, document/workspace symbols) | `src/lsp/capabilities.ts` | 2 testes (shape, legend estável) |
| 22.1.10 | `getHover(analysis, position): Hover \| null` — nó sob a posição → Markdown (tipo/atributos/localização); keyword → projeção do `doc-core` (junção com I 7.5) | `src/lsp/hover.ts` | 4 testes (keyword, identificador, posição vazia, null) |
| 22.1.11 | `getCompletions(analysis, position, locale): CompletionItem[]` — keywords via `SyntaxCore.categories()` + TST por prefixo (junção = **I 7.7**) + nomes definidos (tasks/resources/accounts); kinds `Keyword`/`Reference`/`Property` | `src/lsp/completion.ts` | 4 testes (prefixo, nomes definidos, kinds, locale en) |
| 22.1.12 | `getDefinition`/`getReferences` — declaração via `sourceFileInfo` dos nós do modelo; referências por varredura de ids; cross-file quando ASTs agregadas | `src/lsp/navigation.ts` | 4 testes (definição, referências, símbolo inexistente, cross-file) |
| 22.1.13 | `getSemanticTokens(analysis): number[]` + `legend` estável — tokens do lexer (`ScannerToken`) → encoding delta LSP (keyword, identificador, string, número, data, comentário) | `src/lsp/semantic-tokens.ts` | 4 testes (legend, encoding, fixture, ordenação) |
| 22.1.14 | `getDocumentSymbols(analysis): DocumentSymbol[]` (árvore project → task → subtask, resources/accounts/shifts/reports) + `getWorkspaceSymbols(asts, query)` case-insensitive | `src/lsp/symbols.ts` | 4 testes (hierarquia, ranges, busca, query vazia) |
| 22.1.15 | `registerLspServer(connection)` — interface estrutural mínima `ServerConnection` (sem importar a lib): `initialize` → capabilities; `didOpen/didChange/didClose` → DocumentStore + analyze + `publishDiagnostics`; todos os handlers do §5 | `src/lsp/server.ts` | 5 testes com mock de conexão (initialize, sync, diagnostics, hover, completion) |
| 22.1.16 | Cobertura ≥ 80% em `src/lsp/` + smoke sem VS Code; registrar evidência de saída do P2.4 | `tests/lsp/` | relatório de cobertura + gate verde |

> **Nota de fronteira:** `src/lsp/` importa apenas o próprio core e o
> `doc-core` (via caminho relativo `../docgen/`). Os shapes do protocolo são
> próprios (`src/lsp/types.ts`, adaptação registrada em 22.1.5/22.1.9 — o
> `npm:vscode-languageserver-types` permitido pelo gate não exporta
> `ServerCapabilities`/`TextDocumentContentChangeEvent`). Nenhuma
> reimplementação de doc-core: help/manual/completion de keywords são
> **projeções** (I 7.5–7.7).

---

## Bloco C — 22.1b.1 `TernarySearchTree` (movido da Fase 16, tarefa 16.9)

**⚠️ RUBY: `TernarySearchTree.rb`** — árvore ternária clássica sobre elementos
comparáveis (String/Array); `find(str, true)` devolve **todos os prefixos**.
**🔎 CHEAT: §3 recursão, §12 Categoria B (partial match)**
**Consumidor:** 【24+LSP】 — `syntaxmesh man` usa para busca por prefixo/fuzzy
(`Tj3Man.rb:30,76`); o LSP usa em `completion`/`workspaceSymbol`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.1.1 | Criar `class TernarySearchTree<T extends string = string>` com campos `value`, `smaller`, `equal`, `larger`, `last` e `private clear()` | `src/utils/ternary-search-tree.ts` | `deno check` |
| 22.1b.1.2 | ⚠️ Constructor `(arg?: T \| T[] \| null)`: array → `sortForBalancedTree(...)` + inserção; senão `insert(arg)` | idem | 3 testes (vazio, string única, lista) |
| 22.1b.1.3 | ⚠️ `insert(str, index = 0)` com `ArgumentError` para `null`/vazio e índice fora de `[0..len-1]` | idem | 4 testes (menor/igual/maior/fim, 2 de erro) |
| 22.1b.1.4 | `insertList(list: T[])` e alias de método `add` (≡ `<<`) | idem | 2 testes |
| 22.1b.1.5 | ⚠️ `find(str, partialMatch = false, index = 0): T \| T[] \| null` — caso de prefixo: `collect` remontando `str[0..-2]` | idem | 6 testes (exato, inexistente, prefixo único, prefixo múltiplo, `null`, string vazia) |
| 22.1b.1.6 | ⚠️ `collect(prefix: T \| null, fn: (s: T) => U): U[]` — ordem smaller → equal → larger (ordem **alfabética** garantida) | idem | 3 testes |
| 22.1b.1.7 | ⚠️ `length(): number` e `maxDepth(depth = 0): number` | idem | 4 testes |
| 22.1b.1.8 | ⚠️ `toArray(): T[]`, `balance(): void` (≡ `balance!`) e `balanced(): TernarySearchTree<T>` | idem | 4 testes (round-trip, idempotência, profundidade cai) |
| 22.1b.1.9 | ⚠️ `private sortForBalancedTree(list: T[]): T[]` — pivô central em camadas (fiel a `TernarySearchTree.rb:184-201`) | idem | 3 testes (lista ordenada, tamanho 1, tamanho ímpar/par) |
| 22.1b.1.10 | ⚠️ `private split(str)` com `ArgumentError` em `null`/vazio (no Ruby é um método privado sem chamadores conhecidos — portar e marcar `// deno-lint-ignore` para o unused) | idem | 2 testes (vazio → erro, normal) |
| 22.1b.1.11 | Teste comparativo vs oracle Ruby: fixture `tests/docgen/fixtures/tst-cases.golden.json` (insert/find partial sobre ~30 keywords) | `tests/utils/ternary-search-tree_test.ts` | 1 teste golden |
| 22.1b.1.12 | Re-exportar em `src/docgen/mod.ts` (e **não** no `mod.ts` raiz — ver 22.1b.7.2) | `src/docgen/mod.ts` | `deno check` |

> **Nota:** o `inspect()` do Ruby é debug-only → **não portado** (registro em
> `xray.md` §1.7). Comparação de caracteres: usar `<`/`>` em `string` (UTF-8 por
> code point em JS é equivalente ao `String#<` do Ruby para as keywords ASCII).

---

## Bloco D — 22.1b.2 `SyntaxReference`

**⚠️ RUBY: `SyntaxReference.rb`** — construtor percorre **todas** as regras do
`ProjectFileParser` e extrai os patterns documentados; depois faz duas passadas
de pós-processamento (`crossReference`, `computeInheritance`).
**Consumidor:** 【24+LSP】 — `syntaxmesh man` (lista + texto + HTML) e hover/completion do LSP.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.2.1 | Criar `class SyntaxReference` com `readonly keywords: Map<string, KeywordDocumentation>` e constructor `(manual: UserManual \| null = null, ignoreOld = false)` | `src/docgen/syntax-reference.ts` | `deno check` |
| 22.1b.2.2 | ⚠️ No construtor: `new ProjectFileParser(...)` + `updateParserTables()`; iterar `rules` → `pattern` pulando `doc === null` e, com `ignoreOld`, os `supportLevel` `deprecated`/`removed` | idem | 3 testes (nº de keywords > 0, `ignoreOld` reduz, filtro de doc) |
| 22.1b.2.3 | ⚠️ Criar o `KeywordDocumentation` de cada pattern com `to_syntax(argDocs, rules)` + `optionalAttributes(pattern, {})`; **lançar** se a mesma keyword aparecer 2× | idem | 2 testes (montagem, duplicata → throw) |
| 22.1b.2.4 | ⚠️ `private optionalAttributes(pattern, stack): Map<Pattern, boolean>` — guard de recursão infinita, skip de pattern documentado, detecção do bloco `{ ... }` (`pattern[0][1] === '{' && pattern[2][1] === '}'`) | idem | 5 testes (sem attrs, bloco opcional, referência única, referência multi-pattern, recursão) |
| 22.1b.2.5 | ⚠️ `private attributes(token, scenarioSpecific): Map<Pattern, boolean>` — literal → atributo; `:scenarioIdCol` → merge com `scenarioSpecific = true`; referência não documentada → segue; documentada → usa o próprio pattern; senão `throw` | idem | 5 testes (cada ramo) |
| 22.1b.2.6 | ⚠️ Passadas do construtor: `crossReference(keywords, rules)` em todos e depois `computeInheritance()` em todos (ordem fiel a `SyntaxReference.rb:69-77`) | idem | 2 testes (contexts populados, flags de herança) |
| 22.1b.2.7 | ⚠️ `all(): string[]` — chaves ordenadas **e** encadeamento `predecessor`/`successor` para barra de navegação | idem | 3 testes (ordenado, vizinhos, pontas `null`) |
| 22.1b.2.8 | ⚠️ `tableOfContents(toc: TableOfContents, sectionPrefix: string)` — entrada `Syntax Reference` + `A.1..A.N` com `title()` | `src/docgen/syntax-reference.ts` | 2 testes (contagem, prefixos `A.x`) |
| 22.1b.2.9 | ⚠️ `internalReferences(): Record<string, string[]>` (uniq por keyword, omitindo vazios) | idem | 2 testes |
| 22.1b.2.10 | ⚠️ `toText(keyword: string): string` (≡ Ruby `to_s`) — devolve `''` em keyword desconhecida | idem | 3 testes (conhecida, desconhecida, `null`) |
| 22.1b.2.11 | ⚠️ `checkKeyword(keyword)`: caso inválido → montar **lista de top-level** (`contexts` vazio ou único == self) e devolver o texto de ajuda em vez de escrever em `$stderr` 【novo】 (`stderrLines(): string[]`) | idem | 3 testes (válida, top-level listada, mensagem de erro) |
| 22.1b.2.12 | ⚠️ `generateHTMLreference(directory, keyword): { name, content } \| null` — delega a `KeywordDocumentation.generateHTML`; **sem escrever arquivo** ⚠️ ADAPTAÇÃO (Ruby faz `File.write`) | idem | 2 testes (nome do arquivo = `<keyword>.html`, conteúdo contém a keyword) |
| 22.1b.2.13 | ⚠️ `generateHTMLnavbar(directory, keywords): { navbar: string, alphabet: string }` — agrupamento por letra inicial (título normalizado), `<base target>`, âncoras; **sem** o formulário de busca do Google 【novo: omitido — serviço externo obsoleto】 | `src/docgen/html-navbar.ts` | 4 testes (letras, ordenação por título, âncoras, `br` após cada item) |
| 22.1b.2.14 | Golden Ruby: criar `scripts/golden/syntax-reference.rb` (oracle: `SyntaxReference.new.all` + `to_s` de ~12 keywords representativas + `internalReferences`) → `tests/golden/syntax-reference.golden.json` | `scripts/golden/syntax-reference.rb` + `scripts/golden/gantt-common.rb`-style harness | `deno task golden:generate` produz JSON estável |
| 22.1b.2.15 | Teste golden Deno contra o JSON de 22.1b.2.14 (lista idêntica, texto com marcação ANSI desligada) | `tests/docgen/syntax-reference_golden_test.ts` | verde (1 teste parametrizado por keyword) |

---

## Bloco E — 22.1b.3 `KeywordDocumentation`

**⚠️ RUBY: `KeywordDocumentation.rb` (764 linhas)** — a maior classe da subfase.
Dividir em três arquivos internos: dados/cross-ref, saída de texto, saída HTML.
**Consumidor:** 【24+LSP】 (`toText` → `syntaxmesh man`; HTML → `syntaxmesh man --format html`;
`toMarkdown` → hover do LSP).

### E.1 — Estrutura e referências cruzadas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.1 | Criar `class KeywordDocumentation` com constructor `(rule, pattern, syntax, args, optAttrPatterns, manual)` e campos `keyword`, `names: string[]`, `pattern`, `references: RichText[]`, `optionalAttributes: KeywordDocumentation[]`, `contexts`, `scenarioSpecific`, `inheritedFromProject`, `inheritedFromParent`, `predecessor`, `successor`, `seeAlso` | `src/docgen/keyword-documentation.ts` | `deno check` |
| 22.1b.3.2 | ⚠️ `isProperty(): boolean` — lista fixa dos 7 tipos de relatório + `optionalAttributes.includes(this)` | idem | 4 testes (property, attribute, `taskreport`, auto-referência) |
| 22.1b.3.3 | ⚠️ `globalScope(): boolean` — `contexts` vazio **ou** algum context `properties` | idem | 3 testes |
| 22.1b.3.4 | ⚠️ `crossReference(keywords, rules)` parte 1: `names` via `pattern.terminalTokens(rules)` com `break` no token `{` | idem | 3 testes (nome único, `.` de escopo, bloco opcional → sem nome) |
| 22.1b.3.5 | ⚠️ `crossReference` parte 2: args que referenciam patterns documentados → `kwd.contexts.push(self)` sem duplicar | idem | 3 testes |
| 22.1b.3.6 | ⚠️ `crossReference` parte 3: `optAttrPatterns` — keyword ausente e **não** deprecated/removed → acumular aviso `undocumented_optional_attribute`; presente → `optionalAttributes.push`, context, `scenarioSpecific = true` quando marcado | idem | 4 testes (resolvido, ausente documentado, ausente deprecated silencioso, scenarioSpecific) |
| 22.1b.3.7 | ⚠️ `crossReference` parte 4: `seeAlso` ordenado e **throw** em referência desconhecida | idem | 2 testes |
| 22.1b.3.8 | ⚠️ `private checkReference(pattern): boolean` (pattern precisa ser referência a regra com keyword documentada) | idem | 2 testes |
| 22.1b.3.9 | ⚠️ `private findPropertySet(): PropertySet \| null` — varrer `contexts` em busca dos 9 keywords de escopo (`task`, `resource`, `account`, `shift`, `scenario`, `accountreport`, `resourcereport`, `taskreport`, `textreport`) e criar um `Project` `'id'/'dummy'/'1.0'` **descartável** (fiel a `KeywordDocumentation.rb:730-759`) | idem | 3 testes (task, relatório, sem context → `null`) |
| 22.1b.3.10 | Adicionar ao `PropertySet` os três delegados que faltam 【novo — API ausente】: `listAttribute(id)`, `inheritedFromProject(id)`, `inheritedFromParent(id)` (semântica de `PropertySet.rb:121-145`, incluindo `false` para atributo inexistente/hardwired) | `src/model/property-set.ts` | 4 testes em `tests/model/property-set_test.ts` |
| 22.1b.3.11 | ⚠️ `listAttribute(): boolean` — keyword sem o sufixo `.escopo` → `propertySet.listAttribute(...)`; `false` sem property set | idem | 3 testes |
| 22.1b.3.12 | ⚠️ `computeInheritance(): void` — preencher `inheritedFromProject`/`inheritedFromParent` pelo property set | idem | 3 testes (ambos, só um, nenhum) |
| 22.1b.3.13 | ⚠️ `title(): string` — `foo.bar` → `foo (bar)`; `foo` → `foo` | idem | 3 testes |

### E.2 — Saída de texto (`syntaxmesh man`)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.14 | Criar `src/docgen/ansi.ts` 【novo — substitui a gem `term/ansicolor`】: `blue/red/cyan/bold/reset` + flag `ansiEnabled(bool)` (desligado devolve a string pura) | `src/docgen/ansi.ts` | 4 testes (cada cor, modo desligado, aninhamento) |
| 22.1b.3.15 | ⚠️ `private format(width, str, textWidth): string` e `private indent(width, str): string` sobre `utils/text-formatter.ts` | `src/docgen/keyword-documentation.ts` | 3 testes |
| 22.1b.3.16 | ⚠️ `toText(): string` parte 1 (cabeçalho): `Keyword:` + **bold**(keyword) + ` (List Attribute)` quando `listAttribute()`; bloco de aviso quando `supportLevel !== "supported"` (⚠️ usar o **texto cru** de `TextFormatter`, sem HTML — divergência registrada em `xray.md`) | idem | 4 testes (keyword simples, list attribute, deprecated, removed) |
| 22.1b.3.17 | ⚠️ `toText()` parte 2: mensagem de `supportLevel` + `Please use a, b instead!` quando deprecated/removed com `seeAlso`; **retorno antecipado** quando `removed` | idem | 3 testes |
| 22.1b.3.18 | ⚠️ `toText()` parte 3: `Purpose:` (RichText `to_s`), `Syntax:` (só quando `syntax !== '[{ <attributes> }]'`) e `Arguments:` (`none` quando vazio; `name:` ou `name [type]:` com o `<`/`>` convertidos em `[`/`]`) | idem | 5 testes |
| 22.1b.3.19 | ⚠️ `toText()` parte 4: `Context:` (`Global scope` quando vazio) e `Attributes:` com as tags `[sc]`/`[ig]`/`[ip]` e a legenda quando qualquer flag aparecer | idem | 5 testes (global, contexts múltiplos, tags combinadas, legenda, `none`) |
| 22.1b.3.20 | ⚠️ `toText()` parte 5: `See also:`; ordenar `optionalAttributes` **por keyword** antes de imprimir (mutação do Ruby ⚠️ usar cópia ordenada) | idem | 3 testes |
| 22.1b.3.21 | `toMarkdown(): string` 【novo — LSP-only】 — mesmo conteúdo em Markdown (título `### keyword`, negrito nos rótulos, blocos ```tjp``` para a sintaxe), **sem ANSI** e sem a legenda de colunas | `src/docgen/keyword-markdown.ts` | 5 testes (keyword, arguments, context, seeAlso, removed) |
| 22.1b.3.22 | Teste de regressão: `toText()` de 12 keywords do golden (22.1b.2.14) com ANSI desligado bate byte a byte | `tests/docgen/keyword-documentation_golden_test.ts` | verde |

### E.3 — Saída HTML (manual)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.23 | ⚠️ `generateHTML(directory): { name, content }` — `HTMLDocument` via seam `createHtmlShell()`, `<head>` com description/keywords + `@manual.generateStyleSheet`, corpo = header/nav/purpose/syntax/args/context/attributes/seeAlso/example/nav; **devolver o conteúdo** e não escrever ⚠️ ADAPTAÇÃO | `src/docgen/keyword-html.ts` | 3 testes (nome do arquivo, presença da keyword, ausência de escrita) |
| 22.1b.3.24 | ⚠️ Partes da página: `generateHTMLSupportLevel`, `generateHTMLKeywordBox` (tabela Keyword/List/Inherited), `generateHTMLDescriptionBox` | idem | 3 testes (badge deprecated, box de keyword, rich text renderizado) |
| 22.1b.3.25 | ⚠️ Partes da página: `generateHTMLPurposeLine`, `generateHTMLSyntaxLine`, `generateHTMLArgumentsLine` (colunas nome/tipo/descrição) | idem | 4 testes (sem args, arg com typeSpec, arg referenciado, multiline) |
| 22.1b.3.26 | ⚠️ Partes da página: `generateHTMLContextLine`, `generateHTMLAlsoLine`, `generateHTMLTableLine(col1, col2, col3?, col1rows?)` | idem | 3 testes (rowspan, coluna vazia, links) |
| 22.1b.3.27 | ⚠️ `generateHTMLOptionalAttributesBox` — tabela com as marcações `sc`/`ig`/`ip` e a legenda em HTML | idem | 4 testes |
| 22.1b.3.28 | ⚠️ `generateHTMLExampleBox` — usa `TjpExample` (22.1b.4) via loader injetado; sem exemplo → omitir a caixa | idem | 3 testes (com tag, sem tag, sem exemplo) |
| 22.1b.3.29 | ⚠️ `supportLevelMessage()` / `useInsteadMessage()` — textos fiéis (comparar com o Ruby; `include MessageHandler` só para os rótulos) | `src/docgen/keyword-documentation.ts` | 3 testes (supported, experimental, deprecated) |

---

## Bloco F — 22.1b.4 `TjpExample`

**⚠️ RUBY: `TjpExample.rb`** — extrai snips anotados de um arquivo `.tjp`;
anotação `# *** EXAMPLE: <tag> +|−`.
**Consumidor:** 【24+LSP】 — exemplos dentro das páginas HTML do `syntaxmesh man`
e snippets de `completion`/hover do LSP.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.4.1 | Criar `class TjpExample` com `private snippets: Map<string, string[]>` semeado com `'full text'` | `src/docgen/tjp-example.ts` | `deno check` |
| 22.1b.4.2 | ⚠️ `parse(text: string): void` — `process()` linha a linha (sem `File`/`StringIO`) | idem | 3 testes (snip único, full text, texto sem anotação) |
| 22.1b.4.3 | ⚠️ `open(fileName: string, text: string): void` 【novo — assinaturas adaptadas】: recebe o **conteúdo** lido pelo chamador (CLI/Deno.readTextFile) e delega a `parse`; mantém a semântica de fechar o arquivo | idem | 2 testes |
| 22.1b.4.4 | ⚠️ `private process()` parte 1: marcador `# *** EXAMPLE: `, tokens `[3]`=tag `[4]`=indicador; `+` duplicado → throw; `−` sem `+` → throw; indicador inválido → throw | idem | 4 testes |
| 22.1b.4.5 | ⚠️ `private process()` parte 2: linhas normais vão para **todos** os snips ativos **e** para `full text`; linhas de anotação **não** entram em `full text` | idem | 3 testes |
| 22.1b.4.6 | ⚠️ Remoção final de linha vazia à direita de cada snip (`snip[-1] === "\n"`, **uma** só) | idem | 2 testes |
| 22.1b.4.7 | ⚠️ `toString(tag: string \| null = null): string \| null` — `null` para tag inexistente (Ruby devolve `nil`; **não** devolver string vazia) | idem | 3 testes |
| 22.1b.4.8 | `tags(): string[]` 【novo】 — lista as snips (para o `syntaxmesh man` validar tag e para completion de snippets) | idem | 2 testes |
| 22.1b.4.9 | Ligar ao handler existente: implementar o `ExampleLoader` de `richtext/handlers/function-example.ts` sobre `TjpExample` (cache por arquivo) | `src/docgen/example-loader.ts` | 3 testes (tag, arquivo inteiro, tag ausente) |
| 22.1b.4.10 | Teste com fixtures reais de `docs/Learning/mwe00*/*.tjp` (cópia em `tests/docgen/fixtures/`) — 3 tags extraídas corretamente | `tests/docgen/tjp-example_test.ts` | verde |

---

## Bloco G — 22.1b.5 `UserManual` + fontes do manual

**⚠️ RUBY: `UserManual.rb`** — especializa `RichTextDocument`; gera capa, índice
de frames, navegação e a **Appendix A** com o `SyntaxReference`.
**Consumidor:** 【24】 para o HTML completo (`syntaxmesh man -m` / `--format html`);
【LSP】 para TOC e páginas em Markdown (`getManualToc`/`getManualPage`).

### G.1 — Fontes (assets)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.5.1 | Copiar os 14 snips do manual (`Intro`, `TaskJuggler_2x_Migration`, `Reporting_Bugs`, `Installation`, `How_To_Contribute`, `Getting_Started`, `Tutorial`, `The_TaskJuggler_Syntax`, `Rich_Text_Attributes`, `List_Attributes`, `Software`, `Day_To_Day_Juggling`, `TaskJuggler_Internals`, `fdl`) de `docs/taskjuggler/manual/` para `packages/core/data/manual/` **na ordem da lista Ruby** | `packages/core/data/manual/*.txt` | `ls` com 14 arquivos + teste de ordem |
| 22.1b.5.2 | Copiar a folha de estilo `css/tjmanual.css` para `packages/core/data/manual/css/` (equivalente ao `FileUtils.cp_r` de `UserManual.rb:73`) | `packages/core/data/manual/css/tjmanual.css` | 1 teste (arquivo presente, `body.manual` no conteúdo) |
| 22.1b.5.3 | Copiar os arquivos de exemplo referenciados pelo manual (`AppConfig.dataDirs('data/test/TestSuite/Syntax/Correct'`-style) para `packages/core/data/examples/`, via lista explícita — **sem** varrer disco em runtime | `packages/core/data/examples/` | 2 testes (lista não vazia, `TjpExample` consegue parsear um deles) |
| 22.1b.5.4 | Criar o carregador de assets `src/docgen/manual-sources.ts`: `loadSnipSources(): { name, text }[]` e `loadExample(name): string \| null` sobre `import … with { type: "text" }` (Deno) **com alternativa injetável** para o bundle do browser ⚠️ ADAPTAÇÃO (fronteira de IO, ADR 001) | `src/docgen/manual-sources.ts` | 3 testes (14 snips, ordem, loader alternativo) |

### G.2 — Classe

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.5.5 | Criar `class UserManual extends RichTextDocument` — `reference = new SyntaxReference(this)`, `registerFunctionHandler(new RichTextFunctionExample(loader))`, `linkTarget = '_top'` | `src/docgen/user-manual.ts` | 2 testes (instancia, handler registrado) |
| 22.1b.5.6 | ⚠️ `generate(): Record<string, string>` — adicionar snips na ordem, `cssClass = 'manual'`, `tableOfContents()`, `generateHTML()`, `checkInternalReferences()`; **devolver o mapa nome→conteúdo** (a fase 24 escreve em disco; o Ruby chamava `generate(directory)` + `File.write`) ⚠️ ADAPTAÇÃO | idem | 4 testes (todos os `.html` nomeados, `index.html` presente, uma página por snip, referência interna checada) |
| 22.1b.5.7 | ⚠️ `generateHTML(directory)` adaptado: `index` + páginas do `SyntaxReference` + merge de `internalReferences` no mapa devolvido | idem | 3 testes (uma página por keyword, `navbar/alphabet/toc` no mapa, referências mescladas) |
| 22.1b.5.8 | ⚠️ `private tableOfContents()` — `super()` + `reference.tableOfContents(toc, 'A')` + âncoras das keywords | idem | 2 testes (capítulo `A`, contagem = nº de keywords) |
| 22.1b.5.9 | ⚠️ Callbacks de shell: `generateStyleSheet` (`<link … css/tjmanual.css>`), `generateHTMLCover` (nome/copyright/autores/data/versão via `app-config.ts` + `version.ts`), `generateHTMLHeader`, `generateHTMLFooter` | `src/docgen/user-manual.ts` | 4 testes (cada um, com `appConfig` fake) |
| 22.1b.5.10 | ⚠️ `generateHTMLNavigationBar(predLabel, predURL, succLabel, succURL)` — tabela `<<` / TOC / `>>`, omitindo a tabela quando não há vizinhos | idem | 3 testes (sem vizinhos, só sucessor, ambos) |
| 22.1b.5.11 | ⚠️ `generateHTMLindex()` — documento `:frameset` (`cols 15%,85%`; `rows 140,*`; frames `alphabet`, `navigator`, `display`) | idem | 2 testes (estrutura de frames, nomes) |
| 22.1b.5.12 | ⚠️ `private generateHTMLReference()` — navbar + uma página por keyword no mapa devolvido | idem | 2 testes |
| 22.1b.5.13 | `getManualToc(): { id, title, level }[]` 【novo — LSP-only】 — projeção da TOC para `lsp-core` | idem | 2 testes (ordem, ids estáveis) |
| 22.1b.5.14 | `getManualPage(id): string \| null` 【novo — LSP-only】 — snip renderizado como Markdown (RichText `to_s`, sem HTML) | `src/docgen/manual-pages.ts` | 4 testes (id válido, id de keyword, inexistente → `null`, sem HTML cru no resultado) |

---

## Bloco H — 22.1b.6 `SyntaxCore` (núcleo de highlight Kate/Vim)

**⚠️ RUBY: `KateSyntax.rb:24-40,160-190` + `VimSyntax.rb:24-44,80-96,147-183,98-145`**
— **somente a lógica de coleta/classificação**. Os geradores finais de arquivo
`.xml`/`.vim` continuam **cancelados** (16.15), e o `AlgorithmDiff` (16.10) também.
**Consumidor:** 【LSP】 quase em sua totalidade (semantic tokens, completion,
grammar TextMate, folding). A CLI **não** consome este bloco.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.6.1 | Criar `class SyntaxCore` com `private reference: SyntaxReference` e as coleções `properties`, `attributes`, `optionBlocks` — constructor `(reference = new SyntaxReference(null, true))`, separando por `isProperty()` e por `optionalAttributes.length > 0` (fiel a `KateSyntax.rb:31-37` e `VimSyntax.rb:32-41`) | `src/docgen/syntax-core.ts` | 3 testes (propriedade, atributo, option block) |
| 22.1b.6.2 | ⚠️ `keywordList(): string[]` — união dos nomes com os filtros dos dois geradores: ignorar `supplement` nas propriedades; pular `resourcereport`/`taskreport`/`textreport` nos atributos; `break` em `%`, `(`, `~`, `include`, `macro`, `project`, `supplement` | idem | 5 testes (cada regra de filtragem) |
| 22.1b.6.3 | ⚠️ `categories(): { keywords: string[]; builtin: string[]; types: string[] }` — as três `<list>` do Kate (`keywords` fixo `macro/project/supplement`, `builtinfuncs` = propriedades, `types` = atributos) | idem | 3 testes (conteúdo, ausência de `supplement` em builtin, filtros em types) |
| 22.1b.6.4 | ⚠️ `tokenRules(): TokenRule[]` 【novo formato de dados】 — os `contexts` do Kate como **dados** (date, time, duration, include, arguments `{…}`, strings `'`/`"`/`-8<−…→8-`, comentários `#`/`//`/`/*…*/`, braces `{}[]` com region folding), **sem** emitir XML | `src/docgen/syntax-core.ts` | 4 testes (cada família, contagem, ordem) |
| 22.1b.6.5 | ⚠️ `optionBlockRegions(): Region[]` — fiel a `VimSyntax#regions`: nome normalizado (`.` → `_`), sufixo `_name` quando há vários nomes, `tag` = `keyword` com `.`→espaço para `supplement`, `fold` para propriedades + `task.timesheet`/`project`, `contains=@tjpcommon,tjp_<name>` + por atributo opcional (+ `tjpblk_` quando o opcional tem opcional), `contained` quando `!globalScope()` | idem | 6 testes (single vs multi nome, `supplement`, fold, contained, contains de aninhamento, normalização) |
| 22.1b.6.6 | ⚠️ `indentSettings(): { softtabstop, shiftwidth, tabstop, expandtab, cinoptions, cinwords: string[], cinkeys }` — `cinwords` = nomes dos option blocks, `uniq` + `sort` (fiel a `VimSyntax#setLocal`) | idem | 3 testes (ordem, unicidade, valores literais) |
| 22.1b.6.7 | ⚠️ `normalize(str: string): string` (`.` → `_`) exportado (usado por regions e keywords) | idem | 2 testes |
| 22.1b.6.8 | Teste de paridade estrutural: `categories().builtin` contém `task`/`resource`/`account`; `types` **não** contém `resourcereport`; `tokenRules()` tem 1 regra de comentário de linha com `#` | `tests/docgen/syntax-core_test.ts` | verde |
| 22.1b.6.9 | **Adendo opcional (fora do v1):** `generateKateXml(): string` e `generateVimSyntax(): string` como funções puras sobre a API acima (sem escrita em disco) — só se um consumidor real aparecer | `src/docgen/kate-generator.ts`, `src/docgen/vim-generator.ts` | ⬜ não iniciar sem consumidor |
| 22.1b.6.10 | **Consumidor real do v1:** exportar `categories()`/`tokenRules()` para a grammar TextMate (22.3) e para `semantic-tokens.ts`/`completion.ts` (22.1/22.4) 【LSP】 — registrar a junção aqui quando aqueles blocos forem detalhados | — | nota de plano |

---

## Bloco I — 22.1b.7 Integração do `doc-core`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.7.1 | Criar `src/docgen/mod.ts` exportando `TernarySearchTree`, `SyntaxReference`, `KeywordDocumentation`, `TjpExample`, `UserManual`, `SyntaxCore`, `ansi`, `manual-sources` | `src/docgen/mod.ts` | `deno check` |
| 22.1b.7.2 | Adicionar o subpath export `"./doc-core": "./src/docgen/mod.ts"` em `packages/core/deno.jsonc` 【novo】 e usar `@vanaware/syntaxmesh/doc-core` no `imports` da F22/F24 | `packages/core/deno.jsonc`, `deno.jsonc` (raiz) | `deno check` |
| 22.1b.7.3 | **Não** re-exportar o `doc-core` pelo `"."` raiz: manter o bundle da PWA leve; documentar a decisão em comentário no `mod.ts` 【novo — inversão da prática da F16, que re-exportava em `mod.ts`】 | `packages/core/mod.ts` | 1 teste de grep (ausente do `mod.ts`) |
| 22.1b.7.4 | Proibição de IO/ANSI-forçado verificável: `doc-core` não importa `Deno.*`, `node:`, `vscode` nem escreve arquivo 【novo — gate no padrão do §5.1 do plano】 | `scripts/check-stubs.ts`-style grep em `src/docgen/` | 1 teste/checagem `deno task check:doccore` (novo task) |
| 22.1b.7.5 | Ponte `lsp-core` → `doc-core`: `getKeywordHelp(keyword, locale)` (contrato §5) implementada sobre `KeywordDocumentation.toMarkdown()` + cache memoizado por keyword 【LSP】 | `src/lsp/help.ts` (bloco 22.1) | 4 testes (keyword conhecida, inexistente, cache, locale ignorado em v1) |
| 22.1b.7.6 | Ponte `lsp-core` → `doc-core`: `getManualToc()`/`getManualPage(id)` expostos por `src/lsp/help.ts` sobre 22.1b.5.13/5.14 【LSP】 | idem | 3 testes |
| 22.1b.7.7 | Ponte `lsp-core` → `doc-core`: completion de keywords usando `SyntaxCore.categories()` + `TernarySearchTree` para prefixo 【LSP】 | `src/lsp/completion.ts` | 3 testes |
| 22.1b.7.8 | Registrar em `fase-24-cli-tarefas.md` 24.9.1–24.9.3 que a fonte é `@vanaware/syntaxmesh/doc-core` (já dito) **e** fixar o contrato: `SyntaxReference.toText/all`, `generateHTMLreference`, `generateHTMLnavbar`, `UserManual.generate(): Record<string,string>`, `TernarySearchTree.find(prefix)` 【24】 | `docs/syntaxmesh/fases/fase-24-cli-tarefas.md` | revisão cruzada |
| 22.1b.7.9 | Smoke test da subfase: montar `SyntaxReference` + `UserManual` e exigir ≥ 200 keywords documentadas e ≥ 250 páginas no mapa HTML 【novo】 | `tests/docgen/docgen-smoke_test.ts` | verde |
| 22.1b.7.10 | Cache de construção: memoizar o `SyntaxReference` por processo (é caro — varre as ~380 regras) e expor `resetSyntaxReferenceCache()` só para testes 【novo】 | `src/docgen/syntax-reference.ts` | 2 testes |

---

## Bloco J — 22.1b.8 Verificação da subfase

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.8.1 | Rodar o golden novo (`scripts/golden/syntax-reference.rb`) e commitar o JSON | `packages/core/tests/golden/syntax-reference.golden.json` | `deno task golden:generate` determinístico (2 execuções iguais) |
| 22.1b.8.2 | Confrontar a saída de texto de 12 keywords com `tj3man`/`tj3 --man` real (shell disponível no ambiente) e registrar divergências em `xray.md` | `docs/syntaxmesh/xray.md` | tabela de divergências |
| 22.1b.8.3 | `deno task check:all` + `deno task lint` + `deno fmt` nos arquivos novos | — | verdes |
| 22.1b.8.4 | `deno task tests` (gate completo: `check:all` + `lint` + `fmt:check` + `lint:doc:all` + `test`) | — | 0 falhas |
| 22.1b.8.5 | `deno task check:stubs` + `deno task gaps:audit` | — | OK |
| 22.1b.8.6 | Cobertura ≥ 80% nos módulos de `src/docgen/` (padrão da subfase 22.1) | — | relatório de cobertura |
| 22.1b.8.7 | Atualizar `CURRENT.md`, `plano.md` (linha da Fase 22) e `xray.md` §1.7/§8 com o resultado da subfase | `CURRENT.md`, `docs/syntaxmesh/fases/plano.md`, `docs/syntaxmesh/xray.md` | docs coerentes |
| 22.1b.8.8 | Marcar as tarefas **históricas** 16.9.* e 16.14.* de `fase-16-apoio-tarefas.md` como "entregues em 22.1b.x" (tabela de progresso da F16) | `docs/syntaxmesh/fases/fase-16-apoio-tarefas.md` | revisão cruzada |

---

## Resumo de quem consome o quê

| Entrega 22.1b | Fase 24 (`syntaxmesh man`, 24.9) | `lsp-core` / extensão (22.1–22.9) |
|---|---|---|
| `TernarySearchTree` | ✅ busca por prefixo (`syntaxmesh man <parcial>`) — 24.9.2 | ✅ completion + `workspaceSymbol` |
| `SyntaxReference.all()` | ✅ listagem de keywords | ✅ lista de keywords do hover |
| `SyntaxReference.toText()` | ✅ **saída padrão** `syntaxmesh man <kw>` (texto ANSI) | — (o LSP usa `toMarkdown`) |
| `SyntaxReference.generateHTMLreference/navbar` | ✅ `syntaxmesh man --format html` (escreve no `--output-dir`) | — |
| `KeywordDocumentation.toText()` | ✅ corpo da página de manual | — |
| `KeywordDocumentation.toMarkdown()` 【novo】 | — | ✅ `getKeywordHelp` (hover/comando de ajuda) |
| `KeywordDocumentation.generateHTML()` | ✅ páginas `<keyword>.html` | — |
| `TjpExample` + `ExampleLoader` | ✅ caixas de exemplo no HTML | ✅ snippet de completion |
| `UserManual.generate()` | ✅ manual completo em `--output-dir` (24.9.3) | — |
| `UserManual.getManualToc/getManualPage` 【novo】 | — | ✅ painel "Manual" da extensão |
| `SyntaxCore.categories/tokenRules/optionBlockRegions` | — | ✅ **exclusivo**: grammar TextMate, semantic tokens, folding |
| `ansi.ts`, `manual-sources.ts` | ✅ suporte (CLI habilita ANSI no TTY) | ✅ suporte (ANSI desligado) |
| Kate `.xml` / Vim `.vim` (geradores finais) | ❌ cancelados (16.15) | ❌ idem — só os dados estruturais acima |

---

## Progresso (subfase 22.1b)

> **Entrega parcial 2026-11-08 (blocos C–G + I):** o `doc-core` foi construído
> para desbloquear `syntaxmesh man` (F24, 24.9.1–24.9.3) — que era o único item
> pendente da Fase 24. Todo o caminho `SyntaxReference` → `KeywordDocumentation`
> → `UserManual` → `generateMan` está implementado, puro e coberto por teste
> (`tests/docgen/`), e `man` responde nos três formatos. Ficaram de fora, por
> serem consumidos **só** pela extensão/revisão, os blocos **H** (`SyntaxCore`
> de highlight) e as pontes `lsp-core` de **I** (7.5–7.7), além dos oráculos
> golden do Ruby (1.11, 2.14/2.15, 3.22) e de **J** 8.1/8.2/8.6.
> Os capítulos do manual (G.1) não são os assets originais: são textos novos em
> inglês, sem menção ao projeto de origem e citando apenas `.smx`.

> **Auditoria 2026-11-11 (Bloco B):** C 1.12 e G 5.13/5.14 estavam registradas
> como concluídas mas **não existiam no código** — reabertas. C 1.12 foi
> entregue no mesmo dia (re-export no barril); G 5.13/5.14 + I 7.6 entregues
> em 2026-11-11 no P2.5 (projeções do manual + pontes em `help.ts`). O registro
> histórico 86/108 permanece acima como snapshot de 2026-11-08; a tabela abaixo
> reflete o estado **verificado** (102/108 após C 1.11/1.12 + D 2.11/2.14/2.15 +
> E 3.21/3.22 + H 6.1–6.8 + I 7.1/7.5/7.6/7.7 + G 5.13/5.14, menos I 7.9
> reaberta por ausência no código).

> **Fechamento 2026-11-11 (P2.5/J):** I 7.9 recriada (limiares adaptados ao
> subset), J 8.1–8.8 verificadas — subfase **22.1b fechada em 106/108**
> (H 6.9/6.10 fora do v1). Gate completo `deno task tests` EXIT=0
> (**840 passed / 7023 steps / 0 failed**); `gaps:audit` OK após normalizar o
> status desatualizado do G9 na `completude-matrix.md` (entregue desde a
> F18/F21, fora do vocabulário do audit). Coberturas: `src/lsp/` **96,6%**
> linhas (22.1.16), `src/docgen/` **97,0%** linhas (8.6). Docs coerentes:
> `CURRENT.md`, `plano.md`, `xray.md` §1.7/§1.8/§8, revisão cruzada F16
> (16.9/16.14 marcadas como entregues em 22.1b.x). Próximo bloco: **P3**.

| Bloco | Tarefas | Concluídas | Observação |
|---|---|---|---|
| C — `TernarySearchTree` | 12 | 12 | 1.11 (golden vs oracle Ruby) + 1.12 (re-export no barril) entregues em 2026-11-11 |
| D — `SyntaxReference` | 15 | 15 | 2.11 (`checkKeyword`/`stderrLines`) + 2.14/2.15 (golden vs oracle Ruby) entregues em 2026-11-11 |
| E — `KeywordDocumentation` | 29 | 29 | 3.21 (`toMarkdown`, LSP) + 3.22 (golden estrutural vs oracle Ruby) entregues em 2026-11-11 |
| F — `TjpExample` | 10 | 10 | classe renomeada `ExampleSnippet` |
| G — `UserManual` + fontes | 14 | 14 | capítulos em inglês (sem `.tjp`/`.tji`) + `manual-css.ts`; 5.13/5.14 entregues em 2026-11-11 (projeções LSP `getManualToc`/`getManualPage`) |
| H — `SyntaxCore` (highlight) | 10 | 8 | 6.1–6.8 entregues em 2026-11-11 (dados p/ LSP; geradores `.xml`/`.vim` seguem cancelados); 6.9 fora do v1; 6.10 nota de plano |
| I — Integração | 10 | 10 | 7.5 (`getKeywordHelp`) + 7.6 (manual) + 7.7 (completion) + 7.9 (smoke, limiares adaptados ao subset) entregues em 2026-11-11 |
| J — Verificação | 8 | 8 | 8.1–8.8 verificadas em 2026-11-11 (golden determinístico, tj3man §1.7.1, gate 840 passed, stubs+gaps OK, docgen 97,0%, docs + revisão F16) |
| **Total 22.1b** | **108** | **106** | **subfase fechada em 2026-11-11** (registro histórico: 86; correção: I 7.9 não existia no código e saiu da contagem; H 6.9/6.10 fora do v1 — únicas não verificadas) |

Checklist de conclusão da subfase:

- [x] 22.1b.1 `TernarySearchTree` (C) — 12/12
- [x] 22.1b.2 `SyntaxReference` (D) — 15/15
- [x] 22.1b.3 `KeywordDocumentation` (E) — 29/29
- [x] 22.1b.4 `TjpExample` (F) — 10/10
- [x] 22.1b.5 `UserManual` + fontes (G) — 14/14
- [~] 22.1b.6 `SyntaxCore` (H) — 8/10 (6.9 fora do v1; 6.10 nota de plano)
- [x] 22.1b.7 Integração (I) — 10/10
- [x] 22.1b.8 Verificação (J) — 8/8

**Critério de aceite da subfase:** `deno task tests` verde; o golden
`syntax-reference` igual ao oracle Ruby; `syntaxmesh man <keyword>` (F24, quando existir)
consegue ser servido **só** por `@vanaware/syntaxmesh/doc-core` sem tocar em
`Deno.*`; e `src/lsp/help.ts` não reimplementa nada — apenas projeta o doc-core.

## Notas de entrega (2026-11-08)

- **Fachada `generateMan`** (`src/docgen/man.ts`): única porta usada pela Fase 24.
  Formatos `text` (lista de keywords ou `to_s`), `html` (manual completo ou página
  única) e `smx` (recorte colável: exemplo anotado do corpus, ou o esqueleto da
  sintaxe). Erros de resolução (keyword inexistente, prefixo ambíguo) voltam
  como `messages`, nunca como exceção — quem decide o `exitCode` é o `execute`.
- **Gate de pureza** `deno task check:doccore` (`scripts/check-doccore.ts`)
  varre `src/docgen/` e falha em `Deno.*`, `node:` ou `process.*`. Entra no
  composite `deno task tests`.
- **Exemplo do corpus** (`Pattern.exampleFile`/`exampleTag`): o `setExample`
  passou a aceitar `null` (antes `""`), sem o que o bloco `smx` e a caixa
  `<pre>` do HTML perdiam o exemplo da keyword.
- **RichText dos `p.doc`**: três textos de regra (\`date\`, \`macro\`, \`template\`)
  tinham `[`…`]` solto, que o scanner lia como HREF e quebrava a página;
  passaram a usar `<nowiki>`. As referências `[[kw]]` sem âncora viraram
  `''''kw''''` (código), e o texto de `p.doc` deixou de nomear o projeto de origem
  (`alertlevels`, `now`, `markdate`, `aggregate`) ou a extensão antiga
  (`include`).

## Planning organization evidence (2026-11-11)

This update organizes the existing phase, not its implementation. It does not
increment the 86/108 recorded completions, close remaining 22.x tasks, or create
ADR 035. The older implementation and adaptation notes above remain unchanged.

| Planning action | Evidence | Verification |
|---|---|---|
| Group existing scope into P1–P7 and 23 subblocks | Plan §0: purposes, boundaries, entry/exit criteria and detailing protocol | Every original subphase 22.0–22.11 mapped in §13 |
| Align atomic-task navigation | Navigation/owner tables at the start of this file | C–J IDs and historical progress preserved; undetailed 22.2–22.11 listed explicitly |
| Preserve scheduling and architecture | Plan §§0/1/13/14; P2 foundation/bridge order; P4.1 F24 API audit | F21¹ gate retained; no execution API or phase-order change |
| Propagate planning references | `CURRENT.md`, `plano.md`, phase `README.md`, `AGENTS.md` F22 entry | References point to the existing plan/task files |

Validation: `git diff --check` passed; navigation targets and all 13 original
subphase owners (22.0–22.11, including 22.1b) were checked. The C–J atomic task
bodies and historical 86/108 progress were preserved. Full `deno task tests`
passed with exit 0: 839 passed (6902 steps), 0 failed, 2 ignored steps. This
includes `check:all`, `lint`, `fmt:check`, `lint:doc:all`, `check:doccore`, and
`check:stubs`. No code or new tests were added for this planning-only update.

Future implementation evidence remains attached to the original atomic task
IDs, not new P-block task IDs.

## P2 implementation evidence (2026-11-11)

Entregas do P2 (P2.1 workspace/exports, P2.2 docs core, P2.3 highlight) no
kickoff antecipado autorizado. Evidência anexada aos IDs atômicos originais,
conforme a convenção acima.

| Tarefa | Entrega | Verificação |
|---|---|---|
| 22.1b.8.1 | Golden `syntax-reference` re-verificado no fechamento do J: o oracle `scripts/golden/syntax-reference.rb` (Ruby real, ANSI off) executado **2×** com stdout capturado em `.tmp/j81-run1.json`/`.tmp/j81-run2.json` — sem tocar na fixture commitada | `diff -q` run1×run2 → idênticos (**determinístico**); `diff -q` run1×`tests/docgen/fixtures/syntax-reference.golden.json` → **byte a byte igual** ao commitado; ruby exit 0 nas duas execuções |
| 22.1b.8.2 | Confronto das 12 keywords do golden com o `tj3man` real (gem no PATH, Ruby 3.8.4) via probe `.tmp/probe-tj3man.ts` (`toText(false)` do port × stdout do CLI, ANSI off quando pipeado); tabela de divergências registrada em **`xray.md` §1.7.1** (banner do CLI, cabeçalho ` (List Attribute)`, contextos `properties`, conteúdo/tamanho do subset) | todas as divergências classificadas como **intencionais** (adaptações já registradas em D 2.15/E 3.22); nenhuma inesperada; o oracle golden usa a lib direta (`SyntaxReference#to_s`), não o app `Tj3Man.rb` |
| 22.1b.8.6 | Cobertura do `src/docgen/` medida no fechamento: `deno test --coverage=.tmp/cov-docgen-j86 -P --no-check packages/core/tests/docgen/` + `deno coverage --include='src/docgen/'` | **97,0% linhas / 100% branches / 90,2% funções** (gate ≥ 80% atendido; menores: `user-manual.ts` 83,3% e `syntax-reference.ts` 89,4% linhas — ramos de erro/IO do `generate()`); relatório lcov+html em `.tmp/cov-docgen-j86/` |
| 22.1b.8.3 | `check:all` + `lint` + `fmt` nos arquivos novos do P2 — rodados dentro do gate completo de fechamento (8.4). Fix no caminho: `ban-untagged-todo` em `manual-pages_test.ts` — falso positivo do comentário PT "Todos os ids…" (prefixo lido como TODO) → reescrito "Cada id é não-vazio…" | `deno task check:all` → 830 arquivos, exit 0; `deno task lint` exit 0; `deno task fmt:check` limpo |
| 22.1b.8.4 | Gate completo `deno task tests` no fechamento do P2 (composite: `check:all` + `lint` + `fmt:check` + `lint:doc:all` + `check:doccore` + `check:lspcore` + `check:stubs` + `test`) | **EXIT=0 — 840 passed (7023 steps), 0 failed**, 2 ignored steps (3m22s); log em `.tmp/j-gate-full2.log` |
| 22.1b.8.5 | `deno task check:stubs` + `deno task gaps:audit`. Fix no caminho: o `gaps:audit` falhava no G9 da `completude-matrix.md` — status `entregue (parcialmente ancorado ainda)` fora do vocabulário do audit e **desatualizado** (F18 entregou tudo; `istaskstatus` liberado na F21 2026-11-10; zero âncoras F18 restantes no core, conferido por grep) → status normalizado para `verificado` com o histórico preservado na célula + nota da Seção A | `check:stubs OK — todos os stubs anotados`; `gaps:audit OK — 21 gaps, todos fechados/verificados/ancorados` |
| 22.1b.8.7 | Docs de fechamento: `CURRENT.md` (entrada Phase 22 → P2 completed, 106/108, lsp-core + verificações), `plano.md` (linha 22 → P2 concluído), `xray.md` §1.7 (6 linhas doc-core `PLA` → `OK` com os arquivos reais), §1.8 (`Tj3Man` → OK), §8 (resultado na linha §3.2); §1.7.1 já tinha a tabela do 8.2 | leitura cruzada dos 4 docs coerente com esta tabela de progresso |
| 22.1b.8.8 | Revisão cruzada F16: linhas 16.9/16.14 do progresso de `fase-16-apoio-tarefas.md` marcadas "**entregue em 22.1b.1.1–1.12**" / "**entregue em 22.1b.6.1–6.8**"; notas ENTREGUE nas seções de detalhe com o mapa 16.14.x → 22.1b.6.x (incl. adaptação `dev-tools/` → `docgen/` e barril doc-core em vez do `mod.ts` raiz) | conferido contra os IDs atômicos desta tabela (C 1.1–1.12, H 6.1–6.8, I 7.1) |
| 22.1.1 | Baseline do rename verificado (não repetido): nome `@vanaware/syntaxmesh` em `packages/core/deno.jsonc`; exports `"."` → `src/mod.ts`, `"./version"`, `"./doc-core"`; shim raiz `packages/core/mod.ts` re-exporta `src/mod.ts`; consumidores: cli (`@vanaware/syntaxmesh` → `../../packages/core/mod.ts`, uso em `cli.ts:36`) e service-worker (idem + `/version`); server/ui não importam o core diretamente (bundle esbuild / estáticos) | grep dos consumidores + `deno task check` (core) exit 0 |
| 22.1.2 | `npm:vscode-languageserver-types@^3` (só tipos; resolvido 3.18.5, lock atualizado) nos imports do core; `src/lsp/mod.ts` criado (barril doc-only — os serviços entram no P2.4; re-export wholesale da lib evitado de propósito para o ratchet ADR 041 medir só a superfície própria); export `"./lsp-core": "./src/lsp/mod.ts"` | `deno test -P --no-check packages/core/tests/lsp/lsp-core_test.ts` → 2 passed (11 steps), 0 failed — inclui import do subpath via self-reference do workspace e ausência de vazamento no barril raiz; `deno task check` (core) exit 0 |
| 22.1.3 | `src/lsp/mod.ts` adicionado às entradas `lint:doc`/`lint:doc:update` do core; JSDoc inglês completo no módulo | `deno task lint:doc` (core) exit 0 com a entrada nova (a tentativa inicial de `export type * as LspTypes` gerou 225 missing-jsdoc da lib externa e foi removida — registrada no cabeçalho do barril) |
| 22.1.4 | `scripts/check-lspcore.ts` no padrão do `check:doccore`: proíbe runtime `vscode-languageserver`/`vscode-languageclient` (tipos `-types` permitidos), API `vscode`, `node:*`, `Deno.stdin/stdout` — inclusive import dinâmico; detecção em função pura exportada (`findLspViolations`) + guarda `import.meta.main`; task `check:lspcore` no root e dentro do composite `deno task tests` | `deno task check:lspcore` exit 0; caso negativo testado sem escrever arquivo proibido (7 testes: cada família + comentário ignorado + dinâmico); `deno check scripts/check-lspcore.ts` exit 0; `deno lint`/`fmt` limpos |
| 22.1.5 | `src/lsp/documents.ts` — `DocumentStore` (`Map<uri, {text, version}>`) com `open`/`change`/`close`/`get`/`size`; sync full **e** incremental (range edits sequenciais sobre o estado intermediário, clamp defensivo de posições, CRLF tratado); 6 testes em `tests/lsp/documents_test.ts`. ⚠️ ADAPTAÇÃO: `TextDocumentContentChangeEvent` não existe em `vscode-languageserver-types@3.18.5` (mora no `-protocol`) → tipo estrutural próprio `ContentChange` em `src/lsp/types.ts` | `deno test -P --no-check packages/core/tests/lsp/` → 7 passed (32 steps), 0 failed (inclui o `lsp-core_test` pré-existente); `deno task check` (core) exit 0 |
| 22.1.6 | `src/lsp/locale.ts` — `resolveLocale(uri, text): Locale` sobre `detectLanguage` do parser; normalização `pt*` → `"pt-br"`, `es*` → `"es"`, resto `"en"`; diretiva do arquivo soberana, default `"en"`; 5 testes em `tests/lsp/locale_test.ts` | mesma suite → verde; `lint:doc` (core) exit 0 |
| 22.1.7 | `src/lsp/analyze.ts` — `analyzeDocument(uri, text, opts): AnalysisResult` com isolamento do singleton (`handler.reset()` + snapshot por chamada, padrão do `execute`), `parseContent` em try/catch, gancho `previous` (texto idêntico → reuso com version nova); 4 testes em `tests/lsp/analyze_test.ts` | mesma suite → verde; projeto válido monta `project.id === "prj"`; erro de sintaxe devolve `ok: false` + mensagens localizadas |
| 22.1.8 | `src/lsp/diagnostics.ts` — `toDiagnostics(analysis): Diagnostic[]`: fatal/error → severidade 1, warning → 2, info/debug fora; posição 1-based → 0-based com clamp (`columnNo` 0 não vira -1); zero-width range; `source: "syntaxmesh"`, `code: message.id`; 4 testes em `tests/lsp/diagnostics_test.ts` | mesma suite → verde; literais numéricos mantêm o módulo livre de runtime |
| 22.1.9 | `src/lsp/capabilities.ts` — objeto puro `capabilities` (sync incremental = 2, hover/definition/references/document+workspace symbols, completion, semantic tokens `full` com legend estável `["keyword","identifier","string","number","date","comment"]`, modificadores `[]`); 2 testes em `tests/lsp/capabilities_test.ts`. ⚠️ ADAPTAÇÃO: `ServerCapabilities` também não existe no `-types` → shapes próprios em `src/lsp/types.ts` (`Position`/`Range`/`Diagnostic`/`SemanticTokensLegend`/`ServerCapabilities`/`ContentChange` etc., estruturalmente idênticos ao protocolo); o `private-type-ref` do `deno doc --lint` (medido por entrada) exigiu re-export dos tipos referenciados no barril (`Project`/`Message`/`FileContentProvider` + os de `types.ts`) — re-export de lib externa arrastaria a superfície não documentada dela para o ratchet | mesma suite → verde; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 **sem diagnósticos**; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos (13 arquivos) |
| 22.1.13 | `src/lsp/semantic-tokens.ts` — `tokenize(text)` + `encodeSemanticTokens(tokens)` + `getSemanticTokens(analysis): number[]` (encoding delta LSP de 5 inteiros, modificadores 0); classificação keyword × identifier via `CANONICAL_KEYWORDS` do i18n; legend reusa `SEMANTIC_TOKEN_TYPES` do capabilities; 6 testes em `tests/lsp/semantic-tokens_test.ts` (legend, encoding, fixture, ordenação/round-trip, tolerância, spans exatos). ⚠️ ADAPTAÇÃO: o enunciado dizia "tokens do lexer (`ScannerToken`)", mas o scanner reporta posição só de linha (`columnNo()` sempre 0), descarta comentários, expande macros (texto ≠ fonte) e aborta no primeiro caractere não reconhecido — incompatível com editor. O módulo usa um tokenizer tolerante de passada única sobre o texto bruto, espelhando as famílias do `ProjectFileScanner` (ID/ABSOLUTE_ID, DATE, TIME, FLOAT/INTEGER, STRING, comentários `#`/`//`/`/* */`/scissors), com spans exatos e sem lançar em texto incompleto | `deno test -P --no-check packages/core/tests/lsp/` → 8 passed (38 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1.12 | `src/lsp/navigation.ts` — `symbolAt(text, position)` (identifier sob o cursor via `tokenize`), `getDefinition(analysis, position, workspace?)` (declaração via `sourceFileInfo` dos nós, lookup id/subId/último-segmento nos 7 property sets, span refinado na linha reportada) e `getReferences(analysis, position, workspace?)` (**varredura de ids** sobre tokens identifier, match exato + variantes dotted, spans exatos); cross-file por análises agregadas; tipo `Location` adicionado a `types.ts`; 6 testes em `tests/lsp/navigation_test.ts` (definição task, definição resource, referências, inexistente, cross-file, symbolAt) | `deno test -P --no-check packages/core/tests/lsp/navigation_test.ts` → 1 passed (6 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos. Nota: referências apontam para o token exato no texto (não para a linha do nó referente), pois `sourceFileInfo` é só de linha |
| 22.1.14 | `src/lsp/symbols.ts` — `getDocumentSymbols(analysis): DocumentSymbol[]` (raiz project kind Module; filhos tasks/resources/accounts/shifts/reports/materials com kinds Class/Variable/Enum/Constant/Function/Object; subtasks aninhadas via `children`; `range` da linha de declaração até a linha mais profunda da subárvore, `selectionRange` no span exato do id via `tokenize`) + `getWorkspaceSymbols(analyses, query): SymbolInformation[]` (flatten dos nós, substring case-insensitive em id **e** nome humano, query vazia = todos, `containerName` = pai); tipos `DocumentSymbol`/`SymbolInformation` adicionados a `types.ts` e re-exportados no barril (exigência do `private-type-ref`); 4 testes em `tests/lsp/symbols_test.ts` (hierarquia, ranges, busca, query vazia/sem projeto) | `deno test -P --no-check packages/core/tests/lsp/` → 10 passed (48 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1.10 | `src/lsp/hover.ts` — `getHover(analysis, position): Hover \| null`: keyword → `getKeywordHelp` (junção I 7.5); identifier → `findSymbolNode` (novo export de `navigation.ts`, com kind label; `findNode` privado refatorado) + Markdown `**kind** \`id\` — name` / `Declared at file:line` / `Attributes: …`; atributos extraídos do **bloco fonte** do nó (brace-matching sobre texto com strings/comentários mascarados via `tokenize`, depth 1 exclui subtasks/option blocks, keyword colada a dígito = unidade de duração `5d` ignorada, declaração sem bloco detectada por keyword de nova declaração). ⚠️ ADAPTAÇÃO: o flag `provided` do modelo não serve — o engine marca valores derivados (duration/projectid/…) como provided; o texto fonte é o registro fiel. Tipos `Hover`/`MarkupContent` em `types.ts`; `tokenAt(text, position)` novo em `semantic-tokens.ts` (`symbolAt` refatorado para usá-lo); 6 testes em `tests/lsp/hover_test.ts` (keyword, identificador, posição vazia, literais/comentário, desconhecido/sem parse, aninhamento+mascaramento) | `deno test -P --no-check packages/core/tests/lsp/` → 12 passed (58 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1.11 | `src/lsp/completion.ts` — `getCompletions(analysis, position, locale = "en"): CompletionItem[]` (**junção I 7.7**): universo de keywords = união de `SyntaxCore.categories()` (keywords/builtin/types) indexada uma vez em `TernarySearchTree` (memoizada, via barril doc-core); prefixo sob o cursor com fallback de fim-exclusivo (cursor após o último caractere digitado); prefixo vazio = todas; dentro de string/número/data/comentário = `[]`; kinds Property(10) p/ builtin, Keyword(14) p/ o resto, Reference(18) p/ nomes definidos (tasks/resources/accounts, label = `subId`, detail = "task name" etc.); tipo `CompletionItem` em `types.ts`; locale ignorado no v1; 5 testes em `tests/lsp/completion_test.ts` (prefixo TST, nomes definidos, kinds, locale, vazio/string) — fixture com prefixo como alvo de `depends` (documento parseável enquanto digita) | `deno test -P --no-check packages/core/tests/lsp/` → 13 passed (63 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1.15 | `src/lsp/server.ts` — `registerLspServer(connection)` sobre a interface estrutural `ServerConnection` (sem importar `vscode-languageserver`; o `Connection` real a satisfaz, `sendDiagnostics` = notificação publish): `initialize` → `capabilities`; `didOpen/didChange` → `DocumentStore` + `analyzeDocument` (com `previous`) + publish de `toDiagnostics`; `didClose` → esquece o documento e zera diagnostics; handlers de request projetam a última análise por URI (hover/completion/definition/references/documentSymbol/workspaceSymbol/semanticTokens), navigation e symbols agregam o workspace; `onSemanticTokens` **opcional** (o `Connection` real expõe como `languages.semanticTokens.on`, adaptado pelo bootstrap); shapes de parâmetro (`DidOpenParams`/`DidChangeParams`/`DidCloseParams`/`TextDocumentPositionParams`/`WorkspaceSymbolParams`/`PublishDiagnosticsParams`/`InitializeResult`/`SemanticTokensResult`/`TextDocumentIdentifier`) em `server.ts` + barril; 5 testes com mock tipado (`Map<string, unknown>` + `call<T>` genérico, sem `any`): initialize, sync incremental + diagnostics + ghost-uri, didClose, hover/completion, definition/references/symbols/tokens | `deno test -P --no-check packages/core/tests/lsp/` → 14 passed (68 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos (27 arquivos). Fix registrado: TS2305 — o teste importava `SemanticTokensResult` de `types.ts`, mas o tipo mora em `server.ts` |
| 22.1.16 | Cobertura medida com `deno test --coverage=.tmp/cov-lsp` sobre `tests/lsp/` + `deno coverage --include='src/lsp/'`: **96,6% linhas / 90,9% branches / 100% funções** (todos os 13 módulos ≥ 92% linhas; menor branch: `server.ts` 77,3% — o gate é o agregado ≥ 80%). Smoke sem VS Code: `tests/lsp/lsp-smoke_test.ts` importa **só o barril público** `@vanaware/syntaxmesh/lsp-core` e exercita a sessão completa (initialize → didOpen → hover/completion/definition/documentSymbol/workspaceSymbol/semanticTokens → didChange incremental com erro → didClose) + serviços puros standalone (analyze/diagnostics/hover/tokens/symbols/locale) + documento inválido tolerado; 3 testes | `deno test -P --no-check packages/core/tests/lsp/` → 15 passed (71 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos. **Saída do P2.4 registrada** — 22.1.5–22.1.16 completos |
| 22.1b.5.13 | `UserManual.getManualToc(): ManualTocEntry[]` (`{ id, title, level }`, tipo novo em `user-manual.ts` + barris doc-core/lsp-core) — projeta a TOC sem renderizar HTML: monta capítulos + `tableOfContents()` + apêndice `A` quando ainda não existem (mesmo prelúdio do `generate()`, idempotente — após `generate()` projeta a TOC já construída); `id` = `file` ou `file#tag` (convenção das âncoras HTML), `level` = profundidade do número da seção; 2 testes em `tests/docgen/manual-pages_test.ts` (ordem: 10 capítulos na ordem canônica + apêndice por último, keywords level 1; ids estáveis entre chamadas e entre instâncias) | `deno test -P --no-check packages/core/tests/docgen/manual-pages_test.ts` → 2 passed (6 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:doccore` + `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos; regressão richtext verde (21 passed, 271 steps) |
| 22.1b.5.14 | `src/docgen/manual-pages.ts` — `getManualPage(id): string \| null` (capítulo via `RichTextSnip.toText()` — novo accessor público que delega ao `to_s` do formato intermediário, sem HTML; keyword via `toMarkdown()`; `#tag` tolerado serve o capítulo inteiro; inexistente/vazio → `null`) + `getManualToc()` module-level + `resetManualPageCache()` (manual memoizado por processo, padrão do `resetSyntaxReferenceCache`); re-exports no barril doc-core; 4 testes (capítulo válido, keyword, inexistente, sem HTML cru **fora das cercas** — placeholders `<id>`/`<name>` da sintaxe TJP dentro de ```tjp não são HTML). ⚠️ ADAPTAÇÃO: o Ruby `Snip` não tem `to_s` — a projeção usa o `RichTextIntermediate#to_s` já portado (F12) | mesma verificação de 5.13 (suite conjunta) |
| 22.1b.7.6 | Pontes do manual em `src/lsp/help.ts`: re-export puro de `getManualToc`/`getManualPage`/`resetManualPageCache` + tipo `ManualTocEntry` do doc-core (5.13/5.14), sem reimplementação — o manual memoizado vive no doc-core, compartilhado; barril `lsp-core` atualizado; 3 testes appended em `tests/lsp/help_test.ts` (TOC ≡ doc-core com capítulos + apêndice, página de capítulo/keyword ≡ doc-core, inexistente → null) | `deno test -P --no-check packages/core/tests/docgen/ packages/core/tests/lsp/` → 30 passed (209 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:doccore` + `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1b.7.9 | `tests/docgen/docgen-smoke_test.ts` criado (estava ausente — auditoria 2026-11-11): monta `SyntaxReference` + `UserManual` e exige os limiares de completude. ⚠️ ADAPTAÇÃO: os limiares originais (≥ 200 keywords / ≥ 250 páginas) derivam da gramática Ruby completa (266 keywords); a portada é o subset reescrito de D 2.15 (**170 keywords / 184 páginas** hoje) → limiares ajustados para **≥ 150 / ≥ 180** com folga, registrados no cabeçalho do teste; a integridade estrutural é exigida em absoluto: sem duplicatas, toda keyword com `toText` não-vazio, `ignoreOld` ⊂ universo, uma página HTML por keyword + 9 capítulos + 4 especiais + css (contagem exata), nenhuma página vazia, `index.html` com frameset, TOC projetada cobre todas as keywords; 2 testes | `deno test -P --no-check packages/core/tests/docgen/docgen-smoke_test.ts` → 1 passed (2 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0; `check:doccore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1b.7.7 | Mesma entrega de 22.1.11 (a ponte **é** o `completion.ts`): `SyntaxCore.categories()` + `TernarySearchTree.find(prefix, true)` sobre o barril doc-core, sem reimplementação; os 3 testes exigidos (prefixo, kinds, universo) estão cobertos pelos 5 testes de `completion_test.ts` | mesma verificação de 22.1.11 |
| 22.1b.7.5 | `src/lsp/help.ts` — `getKeywordHelp(keyword, locale = "en"): MarkdownString \| null` (**projeção**, não reimplementação): lookup exato em `syntaxReference(null, true).keywords` (mesmo universo do SyntaxCore) + `KeywordDocumentation.toMarkdown()`; cache memoizado por keyword (inclusive `null` de inexistente) com `clearKeywordHelpCache()` + `keywordHelpCacheSize()` (introspecção p/ teste); tipo `MarkdownString` (alias de `string`) adicionado a `types.ts` conforme nome do contrato §5; locale aceito e ignorado no v1; 4 testes em `tests/lsp/help_test.ts` (conhecida, inexistente, cache, locale) | `deno test -P --no-check packages/core/tests/lsp/help_test.ts` → 1 passed (4 steps), 0 failed; `deno task check` (core) exit 0; `lint:doc` (core) exit 0 sem diagnósticos; `check:lspcore` exit 0; `deno lint` + `deno fmt` limpos |
| 22.1b.1.11 | Oracle `scripts/golden/tst.rb` (30 keywords TJP; inserção sequencial + construtor de array; `find` exato/parcial; `to_a`/`length`/`maxDepth`; `balanced`/`balance!`) registrado em `tests/golden/generate_golden.ts`; fixture `tests/docgen/fixtures/tst-cases.golden.json`; 6 testes golden appended em `tests/utils/ternary_search_tree_test.ts` | `deno test -P --no-check packages/core/tests/utils/ternary_search_tree_test.ts` → 7 passed (32 steps), 0 failed; `maxDepth` de árvore vazia fica fora do golden (Ruby `nil` × port `0`, adaptação registrada) |
| 22.1b.1.12 | Re-export `TernarySearchTree` em `src/docgen/mod.ts` (não no `mod.ts` raiz, conforme 22.1b.7.2) | `deno task check:doccore` exit 0; import do barril OK; `lint:doc` (core) exit 0 — classe inteiramente JSDoc'd |
| 22.1b.2.11 | `checkKeyword(keyword: string \| null): boolean` + `stderrLines(): string[]` em `src/docgen/syntax-reference.ts` (⚠️ ADAPTAÇÃO: chunks de `$stderr` bufferizados, drenáveis; lista top-level = `contexts` vazio ou único == self, ordem de inserção); 6 testes em `tests/docgen/syntax-reference_test.ts` | `deno test -P --no-check packages/core/tests/docgen/syntax-reference_test.ts` → 1 passed (6 steps), 0 failed; `lint:doc` (core) exit 0; `check:doccore` exit 0. Nota: `task`/`resource` ficam fora da lista top-level (contexts `[self, supplement.*]` na gramática portada — mesmo critério do Ruby) |
| 22.1b.2.14 | Oracle `scripts/golden/syntax-reference.rb` (`SyntaxReference.new` real, `Term::ANSIColor.coloring = false`; `all` + `to_s` de 12 keywords + `internalReferences`) registrado em `generate_golden.ts`; fixture `tests/docgen/fixtures/syntax-reference.golden.json` (266 keywords Ruby, 12 textos, stderr limpo) | ruby exit 0 sem stderr; fixture normalizado no estilo do harness (`JSON.stringify(…, null, 2)`) |
| 22.1b.2.15 | `tests/docgen/syntax-reference_golden_test.ts` — ⚠️ ADAPTAÇÃO: a gramática portada é um **subset reescrito** (170 × 266 keywords; textos novos em inglês), então o golden compara **projeção do subset**: `all()` ordenado/sem duplicatas, interseção pinada (139), `internalReferences` ⊆ oracle (port vazio hoje — textos reescritos sem `[[kw]]`) | `deno test -P --no-check …/syntax-reference_golden_test.ts …/keyword-documentation_golden_test.ts` → 2 passed (52 steps), 0 failed |
| 22.1b.3.22 | `tests/docgen/keyword-documentation_golden_test.ts` — ⚠️ ADAPTAÇÃO: paridade **estrutural** do `toText(false)` vs `to_s` Ruby (12 keywords × 3 testes): seções/ordem (única omissão tolerada: `See also:`), cabeçalho (salvo ` (List Attribute)` de `depends`/`allocate`), contextos (salvo `properties`, exclusivo do Ruby); + 1 teste ANSI-off | mesmo comando acima → verde; conteúdo reescrito de `Purpose:`/`Syntax:` fica fora da comparação (registrado no cabeçalho do teste e do oracle) |
| 22.1b.3.21 | `src/docgen/keyword-markdown.ts` — `keywordToMarkdown(doc)`  【novo — LSP-only, sem contraparte Ruby】 + método `toMarkdown()` em `KeywordDocumentation`; helpers públicos `argumentTexts()` e `supportLevelMessage()` (conteúdo compartilhado com o `toText`); título `### keyword`, negrito nos rótulos, cerca ```tjp, sem ANSI e sem legenda; `removed` para no aviso; re-export no barril doc-core; 7 testes em `tests/docgen/keyword-markdown_test.ts` (keyword, arguments, context, seeAlso, removed sintético, attributes, barril ≡ método) | `deno test -P --no-check packages/core/tests/docgen/` → 11 passed (95 steps), 0 failed; `check:doccore` exit 0; `lint:doc` (core) exit 0; `deno check` do barril + teste exit 0 |
| 22.1b.6.1 | `src/docgen/syntax-core.ts` — `class SyntaxCore` com `private reference` + coleções `properties`/`attributes`/`optionBlocks`; constructor `(reference = new SyntaxReference(null, true))` separando por `isProperty()` e `optionalAttributes.length > 0` (fiel a `KateSyntax.rb:31-37` + `VimSyntax.rb:32-41`); 3 testes | `deno test -P --no-check packages/core/tests/docgen/syntax-core_test.ts` → 1 passed (34 steps), 0 failed (suite completa 6.1–6.8); gramática real: 8 propriedades, 156 atributos, 24 option blocks |
| 22.1b.6.2 | `keywordList(): string[]` — união sem duplicatas com os filtros dos dois geradores (supplement ignorado nas propriedades; reports pulados; break nos STOP_NAMES); 5 testes. ⚠️ ADAPTAÇÃO: multi-nome, STOP_NAME no meio da caminhada e os três reports não ocorrem na gramática portada (reports são `REPORT_PROPERTY_KEYWORDS` nos dois lados) — regras exercitadas com fixtures sintéticas (subclasse com `isProperty()` override para o filtro defensivo) | mesma suite → verde; pin de 127 nomes na gramática real |
| 22.1b.6.3 | `categories(): { keywords, builtin, types }` — as três `<list>` do Kate; ⚠️ ADAPTAÇÃO: o quinteto duplicado `macro project supplement include supplement` do Kate é normalizado para o trio do Vim (documentado no cabeçalho do módulo); 3 testes | mesma suite → verde; builtin contém task/resource/account, sem supplement; types sem reports/include |
| 22.1b.6.4 | `tokenRules(): TokenRule[]` — os 20 detectores do context `Normal` do Kate como dados (regexp/keywords/char/number/string/comment), na ordem original, sem XML; ⚠️ ADAPTAÇÃO: typo `\d{1-2}` do Time corrigido para `\d{1,2}` (documentado); 4 testes (contagem+ordem, famílias) | mesma suite → verde |
| 22.1b.6.5 | `optionBlockRegions(): Region[]` — fiel a `VimSyntax#regions`: id normalizado, sufixo `_name` em multi-nome (vale para todos os nomes), tag `supplement` com `.`→espaço, fold de propriedades + FOLDABLE, `contains` com `tjpblk_` para opcionais aninhados, `contained` por `!globalScope()`; 6 testes. ⚠️ ADAPTAÇÃO: multi-nome via fixture sintética; `task.timesheet` não existe na gramática portada (fold de propriedades cobre o caminho) | mesma suite → verde; 24 regiões na gramática real |
| 22.1b.6.6 | `indentSettings(): IndentSettings` — o `setlocal` do Vim como dados; `cinwords` = nomes dos option blocks, únicos e ordenados; 3 testes (ordem, unicidade+união, valores literais) | mesma suite → verde; 21 cinwords |
| 22.1b.6.7 | `normalize(str)` exportado (`.`→`_`); 2 testes | mesma suite → verde |
| 22.1b.6.8 | Teste de paridade estrutural em `tests/docgen/syntax-core_test.ts`: builtin contém task/resource/account; types sem resourcereport; exatamente 1 regra de comentário de linha com `#` | mesma suite → verde |
| 22.1b.7.1 | Barril `src/docgen/mod.ts` completo: `SyntaxCore` + `normalize` + tipos `TokenRule`/`Region`/`IndentSettings` adicionados (TST já viera com C 1.12); todos os símbolos do enunciado presentes (`ExampleSnippet` no lugar de `TjpExample`, fontes do manual via `MANUAL_CHAPTERS`/`EXAMPLE_CORPUS`/`MANUAL_STYLESHEET`) | `deno task check` (core) exit 0; `check:doccore` exit 0; `lint:doc` (core) exit 0 após JSDoc dos 6 campos de `IndentSettings`; `deno lint` + `deno fmt` limpos; diretório docgen inteiro → 12 passed (129 steps), 0 failed |

> **Bloco H — notas de escopo:** 6.9 (geradores puros `.xml`/`.vim`) permanece
> **fora do v1** — não iniciar sem consumidor real (16.15/ADR 035 cancelam os
> geradores de arquivo). 6.10 (junção com TextMate/semantic-tokens/completion)
> será registrado quando P2.4/P3 forem detalhados; os consumidores do v1 são
> `src/lsp/completion.ts` (I 7.7) e os blocos 22.3/22.4.

> **Nota sobre o critério de aceite:** o "golden `syntax-reference` igual ao
> oracle Ruby" foi adaptado para **projeção do subset** porque a gramática
> portada é reescrita por decisão de escopo (22.1b, entrega 2026-11-08):
> igualdade byte a byte exigiria reverter os textos novos em inglês. As três
> projeções (seções, cabeçalho, contextos) + os pins de vocabulário são o
> contrato de regressão; qualquer alargamento do subset deve atualizar os pins
> com evidência.
