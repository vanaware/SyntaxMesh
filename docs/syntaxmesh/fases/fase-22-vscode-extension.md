# Fase 22 — Extensão VS Code (`lsp-core` + tooling de edição)

> **Arquivo:** `docs/syntaxmesh/fases/fase-22-vscode-extension.md` **Tarefas:**
> `docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md` (a criar no
> kickoff) **Status:** ⬜ Não iniciada **Duração estimada:** 10–14 dias
> **Depende de:** Fases 2–14 (motor completo: parser, i18n, queries,
> relatórios). **Não depende** das Fases 15–21. **Bloqueia:** nada — tooling
> externo ao runtime PWA **Posicionamento (ordem oficial 2026-11-03):**
> executada **após a 1ª onda da Fase 21** (que valida o motor via CLI da 24) e
> **antes** das Fases 19 (Storage), 20 (PWA + UI) e das 2ª/3ª ondas da 21 — a
> 2ª onda da 21 adapta o suite para testar esta extensão **Natureza:**
> tooling externo (extensão VS Code + `lsp-core` + servidor LSP CLI)

---

## 1. Contexto

O motor — pacote core **renomeado para `@vanaware/syntaxmesh`**, o pacote
principal do projeto — está completo nas Fases 2–14: parser TJP multilíngue,
scheduler, financeiro e relatórios. A Fase 22 entrega o **tooling de edição**:
uma extensão VS Code que reúne tudo o que apoia o usuário a entender e usar a
sintaxe de planejamento — highlight, autocomplete, diagnósticos, hover,
navegação, **help e manual** — além da integração com o motor (agendamento,
geração de relatórios).

A fase é executada **antes** das Fases 19–21 porque consome o core diretamente
(parse/schedule/reports) e não precisa de Storage (19), UI PWA (20) nem do
corpus multilíngue certificado (21).

O design segue o modelo do TaskJuggler original (**tj3d / tj3client /
tj3webd**): separar **edição** (LSP, análise incremental do buffer) de **modelo
de projeto estável** (daemon alimentado sob demanda pelo usuário) e de
**relatórios** (geração a partir do modelo em cache).

A extensão deve ser compatível com dois Extension Hosts:

- **Node.js Extension Host** (desktop e sessão remota).
- **Web Extension Host** (vscode.dev), sem `node:*` e sem processos externos.

Toda a lógica de linguagem (parsing, semântica, regras LSP, help/manual) vive no
**core**, exportada como **`@vanaware/syntaxmesh/lsp-core`** — um contrato puro,
testável em Deno sem VS Code. A extensão e o CLI são **adaptadores finos**.

### Escopo v1 — inglês

A primeira iteração da extensão é **monolíngue (`en`)**: grammar TextMate,
snippets, completions, diagnósticos, help e manual apenas em inglês. O i18n do
motor (Fase 10) e o `resolveLocale` do `lsp-core` continuam existentes e prontos
— a UX da extensão apenas os fixa em `en`. Suporte PT/ES na extensão vira
**adendo**, a ser executado após a Fase 21.

### Reuso de implementações existentes

| Fonte                                                          | O que aproveitar                             |
| -------------------------------------------------------------- | -------------------------------------------- |
| `taskjuggler-lsp` (C) — github.com/devrintalen/taskjuggler-lsp | Referência de gramática e comportamentos LSP |
| `vim-taskjuggler` — github.com/kalafut/vim-taskjuggler         | Lista de keywords para a grammar TextMate    |
| `taskjuggler-mode.el`                                          | Snippets e estrutura de edição               |
| Kate syntax (ktexteditor)                                      | Estrutura de contextos de highlight          |

---

## 2. Objetivo

Ao final desta fase:

- Renomear o pacote core para `@vanaware/syntaxmesh` (pacote principal), com
  exports `"."` e `"./lsp-core"`; ajustar o `name` do `deno.jsonc` raiz
  (colisão) e os imports de `server`/`ui`/`service-worker`.
- `lsp-core` exportado pelo core (`@vanaware/syntaxmesh/lsp-core`) com handlers
  puros: diagnostics, hover, completion, definition/references, semantic tokens,
  document/workspace symbols, **help/manual** (referência de keywords e
  documentação embutida), DocumentStore incremental, resolução de locale e
  **registro do servidor** (`registerLspServer`). Toda a inteligência do LSP
  mora no core; extensão e CLI são bootstrap mínimo.
- **v1 em inglês** (grammar, snippets, completions, mensagens, help); PT/ES como
  adendo pós-Fase 21.
- Extensão VS Code (`packages/vsextension`) funcional em **desktop** e
  **vscode.dev**:
  - Language contribution: `contributes.languages` (id `syntaxmesh`, extensões
    `.tjp`/`.tji`), grammar TextMate (**EN na v1**),
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

---

## 4. Estrutura de pacotes

```
packages/
├── core/                    # Pacote principal: análise, planejamento, relatórios, LSP, help/manual
│   ├── deno.jsonc           # name: @vanaware/syntaxmesh
│   │                        # exports: { ".": "./mod.ts", "./lsp-core": "./src/lsp/mod.ts" }
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
- **Dois pontos de entrada:**
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

Tarefas preliminares do bloco 22.1:

1. **Renomear** o pacote core de `@syntaxmesh/core` para `@vanaware/syntaxmesh`
   — pacote principal do projeto. O `deno.jsonc` **raiz** hoje carrega esse
   mesmo `name`: removê-lo (ou renomeá-lo, ex.: `@vanaware/syntaxmesh-dev`) para
   evitar colisão de nomes no workspace Deno.
2. Atualizar os imports de `server`, `ui` e `service-worker` (`@syntaxmesh/core`
   → `@vanaware/syntaxmesh`) e as referências em docs.
3. Adicionar `"./packages/vsextension"` e `"./packages/lsp"` ao array
   `workspace`.
4. Criar os exports `"."` + `"./lsp-core"` no core e as tarefas agregadas:

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
- `clientOptions.documentSelector` restrito a `syntaxmesh` (`.tjp`/`.tji`);
  `synchronize.fileEvents` com watcher de `.tjp`/`.tji` para reanálise de
  arquivos fechados.
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
| Workspace            | `lsp-core` não quebra `deno check` do workspace                                                                               | `deno task check-all`                       | exit 0                                    |

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

O detalhamento atômico vai em `fase-22-vscode-extension-tarefas.md` (criar no
kickoff), no padrão dos blocos A–K das fases anteriores:

| #     | Subfase                 | Entrega                                                                                                              | Pré-requisito |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- |
| 22.0  | ADR da fase             | `decisoes/0NN-extensao-vscode.md` (035 na cadeia oficial) + linha no README                                            | —             |
| 22.1  | Renome + `lsp-core`     | Core renomeado `@vanaware/syntaxmesh` (§4.2) + `core/src/lsp/` completo (§5, v1 EN), exports, testes unitários ≥ 80% | —             |
| 22.2  | Scaffolding             | `packages/vsextension/` + `package.json` manifesto + entradas node/web vazias + tasks                                | 22.0          |
| 22.3  | Language contribution   | Grammar EN (v1) + language-configuration + snippets + snapshots                                                      | 22.2          |
| 22.4  | Cliente + servidor LSP  | `registerLspServer` no core + `client/` e bootstrap `server/mod.ts`; transporte desktop e Web; integração LSP verde  | 22.1, 22.2    |
| 22.5  | Daemon                  | `daemon/` add/remove/list/reload; cache memória + `storageUri` (Node); trust gate                                    | 22.4          |
| 22.6  | Relatórios              | `reports/` + `webview/`; listagem, seleção, HTML com recursos, salvar CSV/XML                                        | 22.5          |
| 22.7  | Comandos, config, views | comando export/switch-language/ajuda; settings; project tree + status bar                                            | 22.5          |
| 22.8  | Web extension           | `extension.web.ts` sem `node:*`; fallback stub de escrita; testes vscode.dev                                         | 22.4–22.7     |
| 22.9  | CLI `packages/lsp`      | `mod.ts` `--stdio` via `lsp-core` direto (`createConnection` + `registerLspServer`); build do executável             | 22.4          |
| 22.10 | Empacotamento           | `scripts/build.ts`, `.vscodeignore`, task `package`, `.vsix` < 5 MB testado                                          | 22.8          |
| 22.11 | Verificação final       | `check-all` + testes unit/integração + ADR + `CURRENT.md` + `plano.md`                                               | todas         |

Ordem de execução: 22.0 → 22.1 → 22.2 → 22.3 → 22.4 → 22.5 → 22.6 → 22.7 → 22.8
→ 22.9 → 22.10 → 22.11. **22.1 (`lsp-core`) é pré-requisito de 22.4** — não
avançar sem ele verde.

Como a fase depende apenas das Fases 2–14, ela pode ser executada
**imediatamente após a Fase 14**, antes das Fases 15–18
(Gantt/apoio/XML/sheets), 19 (Storage), 20 (PWA + UI) e 21 (Compatibilidade e
Qualidade). Os relatórios gerados pela camada 3 usam o pipeline da Fase 14;
formatos das Fases 15–18 ficam para um adendo. Registrar o reposicionamento em
`plano.md` ao iniciar a fase.

Commits por subfase: `feat(lsp-core): …`, `feat(vscode): scaffold`,
`feat(vscode): lsp-client`, `feat(vscode): daemon`, `feat(vscode): reports`,
`feat(lsp): cli`, `chore(vscode): package`.

---

## 14. ADR da fase (035) — Extensão VS Code + `lsp-core`

Criar `docs/syntaxmesh/decisoes/0NN-extensao-vscode.md` em 22.0 (0NN =
próximo livre; **035** se a cadeia oficial foi seguida) com:

- **Contexto:** tooling complementar pós-engine; reuso de
  Vim/Emacs/Kate/`taskjuggler-lsp`; inspiração tj3d/tj3client/tj3webd.
- **Decisões:** extensão completa; `lsp-core` como contrato puro dentro do core
  (subpath export `@vanaware/syntaxmesh/lsp-core`, incluindo help/manual);
  renome do core para `@vanaware/syntaxmesh` (pacote principal); **wiring do
  servidor LSP no core** (`registerLspServer` via interface estrutural), com
  entradas vscode/CLI reduzidas a bootstrap de transporte; transporte por host
  (IPC/Worker/stdio); daemon com atualização manual; entradas duplas node/web;
  `package.json` como manifesto; build via `@vsce/bundler`; **v1 monolíngue EN**
  (PT/ES como adendo pós-Fase 21); fase executada antes das Fases 19–21.
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
- `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md` — corpus e golden
  tests.
- `docs/tj3-engine/` — blueprints do engine original.
- Referências externas: `taskjuggler-lsp` (C), `vim-taskjuggler`,
  `taskjuggler-mode.el`, Kate syntax.
- Documentação VS Code: Extension APIs, Language Extensions, Web Extensions,
  Publish.

---

**Fim do plano da Fase 22 (extensão VS Code + `lsp-core` + LSP CLI).**
