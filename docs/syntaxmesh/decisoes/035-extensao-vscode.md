# Extensão VS Code + `lsp-core` (tooling de edição)

**Status:** Aceito
**Data:** 2026-11-11
**Fase:** 22 (extensão VS Code `packages/vsextension` + `lsp-core`/`doc-core`
no core + servidor LSP independente `packages/lsp`); consumidores: 21²
(validação da extensão), 19/20 (storage/PWA depois desta fase)

## Contexto

O motor está completo (Fases 2–14: parser TJP multilíngue, scheduler,
financeiro, relatórios; F15–F18: Gantt, apoio, HTML/XML, sheets), o elemento
`template` foi entregue na Fase 23 (ADR 033) e a CLI com a API de execução
`execute` na Fase 24 (ADR 034). Falta o **tooling de edição**: highlight,
autocomplete, diagnósticos, hover, navegação, help/manual e a integração
confortável com o motor dentro do editor.

Três pressões moldaram a decisão:

1. **Reuso de referências existentes.** `taskjuggler-lsp` (C),
   `vim-taskjuggler`, `taskjuggler-mode.el` e a syntax do Kate fornecem
   gramática, keywords e comportamentos LSP de referência; o modelo
   **tj3d/tj3client/tj3webd** do TaskJuggler original inspira a separação
   entre edição, modelo de projeto estável e relatórios.
2. **O core é puro** (ADR 001/027/030/034): não toca em disco, não imprime,
   não abre conexões. Toda a lógica de linguagem — inclusive o wiring do
   servidor LSP — deve viver no core e ser testável em Deno puro e no browser.
3. **Dois Extension Hosts.** A extensão precisa rodar no Node.js Extension
   Host (desktop/remoto) e no Web Extension Host (vscode.dev, sem `node:*` e
   sem processos externos).

O `doc-core` (subfase 22.1b) já foi entregue parcialmente em 2026-11-08 para
desbloquear o `syntaxmesh man` da F24; esta decisão ratifica o lugar dele na
arquitetura e cobre o restante da fase.

## Decisão

1. **Extensão completa em `packages/vsextension`** (`@vanaware/syntaxmesh-vscode`):
   language contribution (`syntaxmesh`, `.smx` nativa + `.tjp`/`.tji` por
   compatibilidade), grammar TextMate, snippets, cliente LSP + servidor
   embutido, daemon de projetos, relatórios, views e comandos. Entradas duplas
   `extension.node.ts`/`extension.web.ts` (campo `browser` do manifesto).

2. **`lsp-core` como contrato puro dentro do core** — subpath export
   `@vanaware/syntaxmesh/lsp-core` → `src/lsp/mod.ts`: `resolveLocale`,
   `analyzeDocument`, `toDiagnostics`, hover, completion, definition/references,
   semantic tokens, symbols, `DocumentStore` incremental, `capabilities`,
   help/manual e `registerLspServer`. Única dependência nova do core:
   `npm:vscode-languageserver-types@^3` (apenas tipos). Proibições
   grep-verificáveis: sem `vscode-languageserver`/`vscode-languageclient`,
   sem `vscode`, sem `node:*`, sem `Deno.stdin/stdout`, sem transports.

3. **Rename do core para `@vanaware/syntaxmesh`** (pacote principal), já
   entregue com os exports `"."` e `"./doc-core"` — ratificado aqui; o
   `"./lsp-core"` é o terceiro entry point, separado do barril raiz para
   manter o bundle da PWA leve.

4. **Wiring do servidor LSP no core**: `registerLspServer(connection)` recebe
   uma **interface estrutural mínima** (`ServerConnection`) que o `Connection`
   do `vscode-languageserver` satisfaz — o core não importa a lib. As entradas
   vscode/CLI são **bootstrap de transporte**: criar a conexão (IPC no
   desktop, Worker/MessagePort no Web, `--stdio` no CLI) e chamar
   `registerLspServer`. Nenhuma inteligência de LSP nos adaptadores.

5. **Daemon com atualização manual** (add/remove/list/reload explícitos; sem
   `onDidChangeTextDocument`/`onDidSaveTextDocument` ligado ao daemon — o
   antigo `scheduleOnSave` fica removido). A camada de edição nunca alimenta
   o daemon. **As camadas daemon/relatórios reutilizam a API `execute` da
   Fase 24** (adendo v2/v2.1): o *tj3d/tj3webd simulado* consome a mesma API
   da CLI, **sem fork**; ampliação necessária (modelo persistente,
   load/unload/list) vira **adendo à F24**, auditada antes da implementação
   (P4.1). Alternativa sem delta já contratada: fachada passo-a-passo
   (`parse`/`parseContent` → `schedule` → `generateReports`/`renderReports`).

6. **`doc-core` permanece subpath separado** (`@vanaware/syntaxmesh/doc-core`,
   `src/docgen/`), puro (gate `check:doccore`), servindo CLI e LSP a partir da
   mesma API. O núcleo de highlight Kate/Vim (`SyntaxCore`) entrega **dados**
   (categorias, token rules, regions, indentação); os geradores finais
   `.xml`/`.vim` continuam cancelados (16.15) — fora do v1.

7. **`package.json` é manifesto VS Code**, não gerenciador de dependências;
   `deno.json(c)` gerencia deps/tasks (sem `node_modules`/`npm install`).
   Build via `@vsce/bundler` ou esbuild; `.vsix` < 5 MB testado em instalação
   limpa. Servidor LSP independente em `packages/lsp` (`syntaxmesh-lsp
   --stdio`) para Neovim/Helix, usando o mesmo `registerLspServer`.

8. **v1 monolíngue EN** (grammar, snippets, completions, mensagens,
   help/manual) — English-first em toda saída (decisão 2026-11-07); i18n vale
   apenas para o parsing de entrada (pt-BR/es experimentais, piso de
   compatibilidade). PT/ES na UX vira adendo pós-Fase 21. `language "..."` do
   arquivo é soberano; configuração é apenas default.

9. **Agendamento:** depois da F21¹, antes da F21² e das Fases 19/20 (ordem
   oficial 23 → 24 → 21¹ → 22 → 21² → 19 → 20 → 21³). **Kickoff antecipado
   autorizado pelo usuário em 2026-11-11** para os blocos P1/P2 (escopo/
   arquitetura + núcleos compartilhados), sem dependência técnica das tarefas
   restantes da 1ª onda da F21 — mesmo precedente da entrega antecipada do
   `doc-core` para a F24. A ordem oficial não muda.

## Alternativas rejeitadas

- **Pacote `lsp-core` separado** (`packages/core/lsp-core/` ou workspace
  próprio): duplicaria identidade/build e afastaria a lógica do motor;
  substituído pelo subpath export dentro do core (ADR 030).
- **LSP-only em Worker sem suporte desktop/stdio**: deixaria de fora o
  Extension Host Node e os editores externos; o transporte por host
  (IPC/Worker/stdio) cobre os três com o mesmo contrato.
- **Monaco standalone**: não entrega a distribuição VS Code (Marketplace,
  vscode.dev) nem os comandos/views de editor pedidos.
- **Reutilizar `taskjuggler-lsp` (C) diretamente**: runtime e gramática
  externos ao port TS; serve só como referência de comportamento.
- **API de execução paralela para a extensão**: violaria o contrato único da
  F24; qualquer delta entra pelo adendo da F24 (fonte de verdade).
- **`scheduleOnSave`/escuta automática do daemon**: estados intermediários de
  edição contaminariam o modelo estável; substituído por recarga explícita.

## Consequências

### Positivas

- Toda a inteligência de edição é testável em Deno puro e no browser, sem
  VS Code; extensão e CLI ficam reduzidos a bootstrap + política de saída.
- Um único contrato LSP serve desktop, Web e editores externos — sem
  duplicação de handlers entre hosts.
- O mesmo `execute` serve CLI, daemon e relatórios: sem fork de API e sem
  orquestração duplicada.
- O `doc-core` compartilhado evita reimplementar help/manual no LSP.

### Negativas / Riscos

- O core ganha uma dependência de tipos (`vscode-languageserver-types`) —
  aceitável: só tipos, sem runtime, compatível com o bundle browser.
- A extensão não roda sem VS Code; o `packages/lsp` mitiga para outros
  editores, mas é outro artefato a manter.
- O cache do daemon pode ficar obsoleto entre versões do modelo — versionar
  o formato do cache e invalidar na mudança (Desktop); Web só em memória.
- A interface estrutural `ServerConnection` precisa acompanhar a superfície
  usada do `vscode-languageserver`; testes de contrato com mock cobrem o
  wiring sem importar a lib.

### Neutras / Observações

- A validação da extensão pertence à **2ª onda da Fase 21** (handoff); esta
  fase entrega os artefatos e a evidência de aceitação (P7).
- Fases 19/20 (storage/PWA) não são pré-requisito técnico desta fase.
- O `template` (F23) já tem referência normativa pronta
  (`11-referencia-template.md`) e deve ser coberto pela grammar/help em v1.

---

**Status:** Aceito
**Data:** 2026-11-11
**Autor(es):** SyntaxMesh (port TS-only)