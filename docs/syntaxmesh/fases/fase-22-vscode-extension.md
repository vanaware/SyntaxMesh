# Plano de Desenvolvimento da Extensão VS Code do SyntaxMesh

## 1. Visão Geral

Este documento detalha o planejamento para o desenvolvimento da extensão VS Code do SyntaxMesh, uma linguagem de planejamento de projetos compatível com TaskJuggler, com palavras-chave adicionais (`material`, uso de `scenario` em `charge`). O projeto é um monorepo Deno, onde o pacote `core` concentra toda a lógica (análise, planejamento, geração de relatórios e lógica LSP), e os demais pacotes (`vsextension`, `lsp`) são adaptadores que consomem o que o core exporta.

A extensão deve ser compatível com o **Node.js Extension Host** (desktop/remoto) e o **Web Extension Host** (vscode.dev), seguindo o modelo do tj3d/tj3client/tj3webd do TaskJuggler para separar edição (LSP) de modelo de projeto estável (daemon).

## 2. Estrutura de Pacotes

```
packages/
├── core/                    # Fonte da verdade: análise, planejamento, relatórios E lógica LSP
│   ├── deno.json            # name: @syntaxmesh/core
│   │                        # exports: { ".": "./mod.ts",
│   │                        #            "./lsp-core": "./src/lsp/mod.ts" }
│   ├── mod.ts               # Exporta análise/planejamento/relatórios
│   └── src/
│       ├── analysis/        # Análise sintática, planejamento, geração de relatórios
│       ├── lsp/             # Lógica LSP pura (sem vscode-languageserver)
│       │   ├── mod.ts       # Exporta o "contrato LSP" (lsp-core)
│       │   ├── capabilities.ts  # ServerCapabilities (objeto puro)
│       │   ├── handlers.ts      # Funções puras: completion, hover, diagnostics...
│       │   └── documents.ts     # DocumentStore puro (Map<string, string>)
│       └── types/
│           └── lsp.ts       # Tipos LSP próprios (CompletionItem, Diagnostic...)
├── vsextension/            # Extensão VS Code (adaptador: cliente + servidor LSP + daemon)
│   ├── deno.json            # name: @syntaxmesh/vsextension
│   │                        # exports: { ".": "./src/extension.node.ts",
│   │                        #            "./server": "./src/server/mod.ts" }
│   ├── package.json         # Manifesto VS Code (obrigatório)
│   ├── src/
│   │   ├── extension.node.ts    # Entrada Node.js
│   │   ├── extension.web.ts     # Entrada Web (vscode.dev)
│   │   ├── client/              # Cliente LSP (LanguageClient)
│   │   ├── server/              # Adaptador fino: traduz core/lsp-core para vscode-languageserver
│   │   ├── daemon/              # Gerenciador de projetos (análogo ao tj3d)
│   │   ├── reports/             # Seleção e geração de relatórios (análogo ao tj3webd)
│   │   └── webview/             # Painéis de relatório
│   ├── scripts/build.ts
│   └── dist/
│       ├── extension.node.js
│       └── extension.web.js
└── lsp/                    # Servidor CLI independente (adaptador)
    ├── deno.json            # name: @syntaxmesh/lsp
    ├── mod.ts              # Importa @syntaxmesh/vsextension/server, wrapper CLI
    └── scripts/build.ts
```

## 3. Responsabilidades por Pacote

### `core`
- **Função**: análise sintática, motor de planejamento, geração de relatórios **e toda a lógica LSP**.
- **Dependências**: nenhuma dependência de runtime (compatível com browser bundle). **Não importa** `vscode` nem `vscode-languageserver`.
- **Exporta dois pontos de entrada**:
  - `"."` → `mod.ts`: funções de análise/planejamento/relatório (I/O injetado pelo chamador), incluindo listagem de relatórios definidos no `.tjp`.
  - `"./lsp-core"` → `src/lsp/mod.ts`: contrato LSP puro — `capabilities`, handlers (`handleCompletion`, `handleHover`, `handleDiagnostics`), `DocumentStore` e tipos LSP próprios.
- **I/O**: a leitura de arquivos é injetada pelo chamador (extensão VS Code usa `vscode.workspace.fs`; CLI usa `Deno.readTextFile` ou `node:fs`).

### `vsextension`
- **Função**: extensão VS Code completa — cliente LSP, servidor LSP embutido (adaptador), daemon de projetos, seleção e geração de relatórios, Webview, operações Git, publicação.
- **Dependências**: `vscode` (cliente), `vscode-languageserver` (adaptador do servidor).
- **Entradas duplas**: `extension.node.ts` e `extension.web.ts`; o VS Code escolhe pelo campo `browser` do `package.json`.
- **Servidor embutido**: `src/server/mod.ts` é a **única fonte do adaptador LSP**, compartilhado com o pacote `lsp` via subpath export `./server`. Ele traduz os tipos do `core/lsp-core` para a API do `vscode-languageserver` e gerencia a conexão.

### `lsp`
- **Função**: servidor LSP CLI independente para Neovim, Helix e outras ferramentas.
- **Dependências**: `vscode-languageserver`, e importa `@syntaxmesh/vsextension/server` (o adaptador).
- **Empacotamento**: bundle separado em executável CLI (`syntaxmesh-lsp`), com suporte a `--stdio`.

## 4. Arquivos `deno.json`

**`deno.json` da raiz (orquestração do workspace)**

```json
{
  "workspace": [
    "./packages/core",
    "./packages/vsextension",
    "./packages/lsp"
  ],
  "imports": {
    "@vsce/bundler": "jsr:@vsce/bundler@^1"
  },
  "tasks": {
    "build:vsext": "cd packages/vsextension && deno task build",
    "build:lsp": "cd packages/lsp && deno task build",
    "build": "deno task build:vsext && deno task build:lsp"
  }
}
```

**`packages/core/deno.json`**

```json
{
  "name": "@syntaxmesh/core",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts",
    "./lsp-core": "./src/lsp/mod.ts"
  }
}
```

**`packages/vsextension/deno.json`**

```json
{
  "name": "@syntaxmesh/vsextension",
  "version": "0.1.0",
  "exports": {
    ".": "./src/extension.node.ts",
    "./server": "./src/server/mod.ts"
  },
  "imports": {
    "@syntaxmesh/core": "jsr:@syntaxmesh/core@^0.1.0",
    "@syntaxmesh/core/lsp-core": "jsr:@syntaxmesh/core@^0.1.0/lsp-core"
  },
  "tasks": {
    "build": "deno run -A scripts/build.ts"
  }
}
```

**`packages/lsp/deno.json`**

```json
{
  "name": "@syntaxmesh/lsp",
  "version": "0.1.0",
  "exports": "./mod.ts",
  "imports": {
    "@syntaxmesh/vsextension/server": "jsr:@syntaxmesh/vsextension@^0.1.0/server"
  },
  "tasks": {
    "build": "deno run -A scripts/build.ts"
  }
}
```

> O `core` declara um objeto `exports` com `"."` e `"./lsp-core"`. O `vsextension` importa `@syntaxmesh/core/lsp-core` dentro do adaptador `src/server/mod.ts`.

## 5. Arquitetura das Três Camadas

### 5.1 Camada de Edição (LSP)

Responsável por highlight, autocomplete, ajuda/manuais e diagnóstico **durante a edição**. O LSP analisa incrementalmente o buffer em edição, mas **não alimenta o daemon**. Estados intermediários com sintaxe incompleta nunca entram no modelo de projeto estável.

- `vsextension/src/client/`: `LanguageClient` inicia o servidor embutido e registra capacidades no VS Code.
- `vsextension/src/server/mod.ts`: adaptador que consome `@syntaxmesh/core/lsp-core` e registra handlers na conexão `vscode-languageserver`.
- `package.json` declara `contributes.languages` (id `syntaxmesh`, extensões `.tjp`) e `contributes.grammars` (TextMate para coloração básica).
- `contributes.commands` expõe comandos de ajuda/manuais que abrem páginas estáticas no Webview ou no navegador.

### 5.2 Camada de Daemon (análogo ao tj3d/tj3client)

Responsável por manter modelos de projeto **estáveis e agendados** em memória, sem reanálise automática a cada alteração de arquivo.

- **Comandos de gerenciamento** (análogos ao tj3client):
  - "SyntaxMesh: Adicionar Projeto ao Daemon" → seleciona um `.tjp`, analisa, agenda e armazena em cache.
  - "SyntaxMesh: Remover Projeto do Daemon"
  - "SyntaxMesh: Listar Projetos"
  - "SyntaxMesh: Recarregar Projeto" (após o usuário concluir a edição)
- **Sem escuta automática**: não vincular `onDidChangeTextDocument` nem `onDidSaveTextDocument` para atualizar o daemon. O usuário controla explicitamente quando o modelo é atualizado.
- **Cache**: `Map<string, ProjectModel>` em memória, chaveado pelo `uri.toString()` do `.tjp`.
  - **Desktop**: serializar o modelo agendado em `context.storageUri`, carregar na inicialização; o usuário recarrega manualmente após editar.
  - **Web**: apenas em memória (devido à instabilidade de origem do IndexedDB).
- **Consistência**: ao adicionar, ler o conteúdo do buffer em edição (`document.getText()`) ou do disco, conforme a escolha do usuário; ao recarregar, sempre ler o estado atual.

### 5.3 Camada de Relatórios (análogo ao tj3webd)

Responsável por listar relatórios disponíveis, gerar e apresentar/salvar.

- **Listagem**: ler do modelo em cache a lista de definições de relatório (nome, formato), análoga ao `tj3client list-reports <project_id>`.
- **Seleção**: Webview ou QuickPick para o usuário escolher quais relatórios gerar e o destino de cada um.
- **Ramificação por formato**:
  - **HTML**: exibir na Webview. Recursos associados (CSS/JS/imagens) são empacotados e injetados como URIs de `vscode-webview-resource`; a Webview também oferece botão "Salvar no Workspace" (incluindo recursos associados).
  - **CSV / XML (niku) / texto puro**: **não** exibir na Webview; oferecer diretamente "Salvar no Workspace".
- **Geração**: consumir o modelo em cache (sem reanálise), serializar o relatório e apresentar/salvar.

## 6. Compatibilidade com Web Extension (vscode.dev)

### 6.1 Como habilitar

No `package.json` do `vsextension`:

```json
{
  "main": "./dist/extension.node.js",
  "browser": "./dist/extension.web.js"
}
```

### 6.2 Limitações do ambiente Web

- **Sem `node:*`**: `extension.web.ts` e dependências não podem importar módulos nativos do Node.js. O `core` já é compatível com browser.
- **`storageUri` pode estar ausente**: no Web Host não há caminho de sistema de arquivos real; `context.storageUri` / `globalStorageUri` podem ser `undefined`.
- **Operações Git indisponíveis**: não é possível iniciar processos externos; comandos Git devem ser desabilitados na entrada Web ou exibir mensagem amigável.
- **IndexedDB não confiável**: o Web Worker Extension Host do VS Code gera uma nova origem a cada carregamento; não confiar em IndexedDB/OPFS para persistência.
- **Escrita no workspace**: `workspace.fs.writeFile` só pode ser acionado por interação do usuário e dentro de uma janela de permissão curta. A solução stub (escrever arquivo vazio imediatamente após o clique, depois sobrescrever) é o fallback.

## 7. Estratégia de Armazenamento (Node.js vs Web)

| API | Escopo | Adequado para | Comportamento no Web |
| :--- | :--- | :--- | :--- |
| `context.globalState` | Global | Chave-valor pequeno, configurações | Persiste via IndexedDB interno do VS Code |
| `context.workspaceState` | Workspace | Chave-valor pequeno por projeto | Persiste via IndexedDB interno do VS Code |
| `context.storageUri` | Workspace | Arquivos grandes por projeto; cache serializado do daemon | **Pode ser `undefined`** |
| `context.globalStorageUri` | Global | Arquivos grandes globais | **Pode ser `undefined`** |
| `context.secrets` | Global | Dados sensíveis (tokens) | Criptografia DKE no Web |

**Não usar** `localStorage` / `IndexedDB` / OPFS diretamente, devido à instabilidade de origem do Web Worker Extension Host.

**Estratégia para o SyntaxMesh**:
- Dados pequenos (configurações, último estado): `globalState` / `workspaceState`.
- Cache do daemon: Desktop em `storageUri` (serializado, carregado na inicialização, atualização manual); Web apenas em memória.
- Relatórios grandes: Node usa `storageUri`; Web gera sob demanda e exibe no Webview, sem persistência entre recarregamentos.

## 8. Fluxo de Dados

```
Arquivo .tjp
    │
    ├─ Edição: LSP (highlight, autocomplete, help) — análise incremental, não alimenta o daemon
    │
    ├─ Usuário aciona "Adicionar Projeto ao Daemon"
    │       │
    │       └─ core (análise/planejamento) → ProjectModel em cache
    │
    ├─ Usuário aciona "Gerar Relatório"
    │       │
    │       ├─ HTML → Webview (recursos associados injetados) / Salvar no Workspace
    │       └─ CSV/XML/texto → Salvar no Workspace (workspace.fs)
    │
    └─ CLI: Deno.readTextFile / node:fs → core → stdout / arquivo
```

## 9. Estratégia de Build

| Pacote | Ferramenta | Saída | Observação |
| :--- | :--- | :--- | :--- |
| `core` | `deno bundle` ou esbuild | `dist/core.js` (opcional) | `vsextension`/`lsp` importam o source TS via workspace |
| `vsextension` (Node) | `@vsce/bundler` | `dist/extension.node.js` | `vscode` external; pode incluir `node:*` |
| `vsextension` (Web) | `@vsce/bundler` (platform: browser) | `dist/extension.web.js` | **Sem `node:*`**; `vscode` external |
| `lsp` | esbuild / deno bundler | `dist/syntaxmesh-lsp.js` | Wrapper CLI com shebang, `--stdio` |

## 10. Pontos de Atenção

- **`core` não importa `vscode` nem `vscode-languageserver`**: mantém independência de runtime e compatibilidade com browser.
- **`core/lsp-core` é a fonte da verdade LSP**: handlers, capabilities, DocumentStore e tipos vivem no core.
- **`vsextension/src/server/` é adaptador fino**: traduz tipos do core para `vscode-languageserver`; não contém lógica de linguagem.
- **`lsp` importa `@syntaxmesh/vsextension/server`**: fonte única do adaptador.
- **Daemon não escuta automaticamente**: o usuário adiciona/recarrega projetos explicitamente; estados intermediários com sintaxe incompleta nunca entram no modelo.
- **Leitura de arquivos na extensão**: sempre `vscode.workspace.fs`, nunca `node:fs` direto.
- **Workspace Trust**: não executar planejamento automaticamente em workspaces não confiáveis; usar `vscode.workspace.isTrusted`.
- **I/O no core**: não chamar `Deno.readTextFile` diretamente; a leitura é injetada.
- **Web Extension**: `extension.web.ts` não pode usar `child_process`; comandos Git desabilitados ou redirecionados.
- **Armazenamento no Web**: usar `globalState`/`workspaceState`; `storageUri` pode ser `undefined`.
- **Escrita no workspace na Web**: usar `workspace.fs.writeFile` com `TextEncoder`; stub imediato após interação do usuário como fallback.
- **Relatórios HTML na Webview**: reescrever caminhos de recursos associados ou empacotá-los; oferecer "Salvar no Workspace" incluindo recursos.
- **`package.json` obrigatório**: o `deno.json` não substitui o manifesto VS Code; ambos coexistem.

## 11. Tarefas Detalhadas

### Fase 1 — Core mínimo e extensão Node com relatório
1. Criar `packages/core` com `deno.json` (`exports: { ".": "./mod.ts", "./lsp-core": "./src/lsp/mod.ts" }`).
2. Implementar `mod.ts`: análise sintática mínima do `.tjp` (blocos `{}`, IDs hierárquicos, `!` relativo, macros `${}`), motor de planejamento básico, gerador de relatório HTML e listagem de definições de relatório.
3. Criar `packages/vsextension` com `deno.json`, `package.json` (`main` apontando para `dist/extension.node.js`) e `src/extension.node.ts`.
4. Implementar comando "SyntaxMesh: Adicionar Projeto ao Daemon": seleciona `.tjp`, lê via `vscode.workspace.fs`, analisa com o core, armazena `ProjectModel` em memória.
5. Implementar Webview de relatório HTML simples: comando "SyntaxMesh: Gerar Relatório" lê do cache, gera HTML, exibe no `WebviewPanel`.
6. Configurar `scripts/build.ts` com `@vsce/bundler` para gerar `dist/extension.node.js`.
7. Testar no VS Code desktop: abrir `.tjp`, adicionar ao daemon, gerar relatório, ver Webview.

### Fase 2 — Lógica LSP no core e servidor embutido
1. Implementar `core/src/lsp/`: `capabilities.ts`, `handlers.ts` (completion, hover, diagnostics), `documents.ts` (DocumentStore puro), `types/lsp.ts`.
2. Exportar tudo em `core/src/lsp/mod.ts` (ponto de entrada `./lsp-core`).
3. Criar `vsextension/src/server/mod.ts`: adaptador que importa `@syntaxmesh/core/lsp-core`, registra handlers na conexão `vscode-languageserver` e implementa `startServer(connection)`.
4. Criar `vsextension/src/client/`: `LanguageClient` que inicia o servidor embutido (mesmo bundle) e registra capacidades.
5. No `package.json`, declarar `contributes.languages` (id `syntaxmesh`, extensões `.tjp`), `contributes.grammars` (TextMate) e `contributes.commands` (adicionar/remover/listar/recarregar projeto, gerar relatório, abrir manuais).
6. Testar: preenchimento automático, diagnóstico, hover no VS Code.

### Fase 3 — Daemon e relatórios completos
1. Implementar `vsextension/src/daemon/`: gerenciador com `add`/`remove`/`list`/`reload`, cache em memória, persistência em `storageUri` (Node).
2. Implementar `vsextension/src/reports/`: listagem de relatórios do modelo em cache, seleção via QuickPick/Webview, ramificação por formato.
3. HTML: Webview com recursos associados injetados (`vscode-webview-resource`), botão "Salvar no Workspace".
4. CSV/XML/texto: comando "Salvar no Workspace" via `workspace.fs.writeFile` com `TextEncoder`.
5. Implementar "Recarregar Projeto" e persistência do cache (Node), com invalidação ao remover.
6. Testar: adicionar múltiplos projetos, listar, recarregar após edição, gerar relatórios HTML e CSV.

### Fase 4 — Web Extension (vscode.dev)
1. Criar `src/extension.web.ts` sem imports `node:*`; detectar `vscode.env.uiKind === vscode.UIKind.Web`.
2. No `package.json`, adicionar `"browser": "./dist/extension.web.js"`.
3. Ajustar `scripts/build.ts` para gerar também `dist/extension.web.js` (platform browser).
4. Desabilitar/redirecionar comandos Git na entrada Web; exibir mensagem explicativa.
5. Implementar fallback stub na exportação: escrever arquivo vazio imediatamente após o clique, depois sobrescrever com o conteúdo real.
6. Daemon na Web: apenas em memória; relatórios HTML na Webview com recursos injetados; CSV/XML via `workspace.fs`.
7. Documentar no README as diferenças de armazenamento (globalState funciona; storageUri pode ser undefined; sem persistência entre recarregamentos; janela de permissão de escrita).
8. Testar em vscode.dev: adicionar projeto, gerar relatório HTML na Webview, salvar CSV no workspace.

### Fase 5 — Recursos avançados da extensão Node
1. Operações Git via `child_process.spawn` (apenas Node).
2. Publicação de relatórios via `fetch` (ambos) com tratamento de CORS no Web.
3. Cache do daemon persistido em `storageUri` com versionamento (invalidar se o formato do modelo mudar).
4. Simulação estilo `tj3d`/`tj3webd`: manter estado em memória no Webview, sem persistência entre recarregamentos.

### Fase 6 — UI web offline-first separada
1. Criar workspace separado consumindo o bundle do `core`.
2. Implementar UI offline-first (PWA) com armazenamento próprio (IndexedDB/OPFS no contexto da própria UI, onde a origem é estável).
3. Reutilizar a lógica do core para análise/planejamento/relatórios.

## 12. Resumo das Decisões

| Decisão | Escolha |
| :--- | :--- |
| Fonte da verdade LSP | `core/lsp-core`, sem dependência de runtime |
| Adaptador LSP | `vsextension/src/server/`, compartilhado com `lsp` |
| Atualização do daemon | Manual (adicionar/recarregar), sem escuta automática |
| Cache do daemon | Memória (ambos); `storageUri` (Node) com atualização manual |
| Relatórios HTML | Webview com recursos injetados + opção salvar |
| Relatórios não-HTML | Salvar no workspace via `workspace.fs` |
| Escrita no workspace (Web) | `workspace.fs.writeFile` + stub imediato como fallback |
| Armazenamento no Web | `globalState`/`workspaceState`; sem IndexedDB/OPFS direto |
| Entradas da extensão | `extension.node.ts` + `extension.web.ts` (`browser` no `package.json`) |
| Build | `@vsce/bundler` para Node e Web; `lsp` com esbuild/deno bundler |

---

Este documento cobre a arquitetura, os arquivos de configuração, as três camadas (edição/LSP, daemon, relatórios), a compatibilidade Web, a estratégia de armazenamento, o fluxo de dados, o build, os pontos de atenção e as tarefas detalhadas por fase. Se quiser, posso detalhar o conteúdo de `core/src/lsp/documents.ts` (DocumentStore puro), o `scripts/build.ts` completo com `@vsce/bundler`, ou o esboço do gerenciador de daemon (`src/daemon/`).