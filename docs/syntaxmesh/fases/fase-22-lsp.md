# Guia de Implementação: `@vanaware/syntaxmesh-lsp`

> **Documento para agentes de IA** que vão implementar, manter ou estender o servidor LSP do projeto SyntaxMesh. Leia o documento inteiro antes de tocar em código. As decisões de arquitetura aqui descritas são **contratos**, não sugestões — quebrá-los cria acoplamento entre camadas e inviabiliza a evolução independente dos pacotes.

---

## 1. Contexto do projeto

**SyntaxMesh** é uma linguagem de domínio derivada do **Task Juggler**, com suporte nativo a variações de sintaxe em **português (pt-br), inglês (en) e espanhol (es)**. O projeto é um **monorepo Deno** estruturado em workspaces.

**Objetivo deste guia:** implementar o pacote `@vanaware/syntaxmesh-lsp`, um servidor LSP que expõe as capacidades do domínio SyntaxMesh para IDEs (VS Code, Neovim, Helix, Zed, etc.), consumindo o adaptador `@vanaware/syntaxmesh/lsp-core` já existente no pacote `@vanaware/syntaxmesh`.

---

## 2. Arquitetura em três camadas (visão geral)

A separação em três camadas é o pilar da arquitetura. **A dependência flui em sentido único** — nunca há importação da camada de cima para baixo, nem do servidor para o core diretamente.

```
┌──────────────────────────────────────────────────────────────┐
│  @vanaware/syntaxmesh-lsp         (servidor LSP)             │
│  • Conexão JSON-RPC via stdio                                │
│  • TextDocuments, capabilities, lifecycle                    │
│  • Cache de AnalysisResult por URI                           │
│  • NÃO contém lógica de linguagem                            │
└──────────────────────┬───────────────────────────────────────┘
                       │ importa apenas o subpath lsp-core
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  @vanaware/syntaxmesh/lsp-core    (adaptador LSP)            │
│  • Traduz AST/erros → tipos LSP (Diagnostic, Hover, ...)     │
│  • API agnóstica de transporte                               │
│  • Único ponto que conhece vscode-languageserver-types       │
└──────────────────────┬───────────────────────────────────────┘
                       │ importa o core normalmente
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  @vanaware/syntaxmesh             (domínio puro)             │
│  • Parser, AST, keywords PT/EN/ES, semântica                 │
│  • Zero dependência de LSP                                   │
└──────────────────────────────────────────────────────────────┘
```

### Regra de ouro

| Camada | Pode importar | **Não pode** importar |
|---|---|---|
| `@vanaware/syntaxmesh` | bibliotecas puras (tree-sitter, etc.) | qualquer coisa de LSP |
| `@vanaware/syntaxmesh/lsp-core` | `@vanaware/syntaxmesh`, `vscode-languageserver-types` | `vscode-languageserver`, `vscode-languageserver-textdocument`, `Deno.stdin/stdout` |
| `@vanaware/syntaxmesh-lsp` | `@vanaware/syntaxmesh/lsp-core`, `vscode-languageserver`, `vscode-languageserver-textdocument` | `@vanaware/syntaxmesh` (acesso direto ao parser) |

**Se em algum momento você precisar importar o core diretamente no servidor, é sinal de que falta uma função no `lsp-core`.** Adicione-a lá, não quebre a regra.

---

## 3. Papel de cada pacote (detalhado)

### 3.1 `@vanaware/syntaxmesh` — Domínio

**Responsabilidade:** toda a inteligência sobre a linguagem.

**O que possui:**
- Parser de arquivos `.tjp` / `.tji` (baseado em Tree-sitter).
- Definição da AST e seus tipos.
- Tabelas de palavras-chave por idioma (`keywords.pt-br.ts`, `keywords.en.ts`, `keywords.es.ts`).
- Regras semânticas (referências cruzadas `depends`/`precedes`, escopo de recursos, tarefas órfãs).
- Resolução de idioma do arquivo/projeto.

**O que NÃO possui:** qualquer menção a `Diagnostic`, `Hover`, `CompletionItem` ou protocolo LSP.

**Exemplo de API pública (não exaustiva):**

```ts
// packages/core/mod.ts
export type { AST, TaskNode, ResourceNode, /* ... */ } from "./ast/mod.ts";
export { parse, parseProject } from "./parser/mod.ts";
export { getKeywords, type Locale } from "./i18n/mod.ts";
export { validate } from "./semantic/mod.ts";
```

**Quem consome:** `lsp-core` (para o LSP), CLI de lint, hooks de pre-commit, GitHub Actions, outros adaptadores futuros.

### 3.2 `@vanaware/syntaxmesh/lsp-core` — Adaptador LSP

**Responsabilidade:** **traduzir** conceitos do domínio para tipos do protocolo LSP. É a **única camada autorizada a conhecer o vocabulário do LSP**.

**O que possui:**

| Módulo | Função | Saída |
|---|---|---|
| `analyze.ts` | `analyzeDocument(uri, text, opts)` | `AnalysisResult` |
| `diagnostics.ts` | `toDiagnostics(ast, errors)` | `Diagnostic[]` |
| `hover.ts` | `getHover(ast, position)` | `Hover \| null` |
| `completion.ts` | `getCompletions(ast, position, locale)` | `CompletionItem[]` |
| `semantic-tokens.ts` | `getSemanticTokens(ast)` | `number[]` (formato LSP) |
| `locale.ts` | `resolveLocale(uri, text)` | `"pt-br" \| "en" \| "es"` |

**O que NÃO possui:**
- Conexão LSP.
- `TextDocuments` ou gerenciamento de ciclo de vida de documentos.
- Conhecimento sobre stdin/stdout, pipes ou transportes.
- Estado persistente global (o estado é passado explicitamente via parâmetros).

**Dependências permitidas:** `@vanaware/syntaxmesh`, **`vscode-languageserver-types`** (somente tipos e constantes — pacote leve, zero dependência de Node).

**Contrato principal:**

```ts
export interface AnalyzeOptions {
  uri: string;
  locale?: "pt-br" | "en" | "es" | "auto";
  previous?: AnalysisResult;   // permite reuso incremental de AST
  version?: number;
}

export interface AnalysisResult {
  ast: AST;
  diagnostics: Diagnostic[];
  version: number;
}

export function analyzeDocument(
  uri: string,
  text: string,
  opts: AnalyzeOptions,
): AnalysisResult;
```

**Por que esse desenho:** permite que CLI, formatadores, extensões sem LSP e testes unitários consumam a mesma lógica sem subir um servidor. Testes do `lsp-core` rodam em milissegundos.

### 3.3 `@vanaware/syntaxmesh-lsp` — Servidor LSP (objeto deste guia)

**Responsabilidade:** **orquestração do protocolo LSP**. Nada de linguagem.

**O que possui:**
- Inicialização da conexão via stdio.
- `TextDocuments` para sincronização incremental.
- Registro de capabilities (`hoverProvider`, `completionProvider`, `semanticTokensProvider`, etc.).
- **Cache por URI** de `AnalysisResult` (para reuso incremental).
- Handlers que delegam **toda a lógica** ao `lsp-core`.

**O que NÃO possui:**
- Parser, AST, keywords, regras semânticas — nada disso mora aqui.
- Importação de `@vanaware/syntaxmesh` (somente do subpath `lsp-core`).

---

## 4. O que o servidor LSP **deve entregar** como solução

O `syntaxmesh-lsp` deve entregar **cinco pilares funcionais**, cada um mapeado a uma capacidade LSP. **Implemente nesta ordem** — cada pilar depende do anterior estar estável.

### 4.1. Diagnósticos em tempo real (obrigatório, MVP)

**Capacidade LSP:** `textDocument/publishDiagnostics` (server → client, sem request).

**Comportamento esperado:**
- A cada `didOpen` / `didChange`, reanalisar o documento.
- Publicar `Diagnostic[]` com: `range`, `severity`, `message`, `source: "syntaxmesh"`, `code` (para o usuário poder filtrar/suprimir por código).
- Erros de **sintaxe** → `DiagnosticSeverity.Error`.
- Erros semânticos (referência não resolvida) → `DiagnosticSeverity.Error`.
- Avisos (task sem alocação, dependência circular suspeita) → `DiagnosticSeverity.Warning`.
- Limpar diagnósticos quando o documento é fechado (`didClose`).

**Mensagens de diagnóstico devem respeitar o idioma do arquivo** (via `resolveLocale` no `lsp-core`).

### 4.2. Hover informativo (obrigatório)

**Capacidade LSP:** `textDocument/hover`.

**Comportamento:**
- Ao passar o mouse sobre uma referência (ex.: nome de tarefa em `depends`), retornar um `Hover` com markdown: tipo de nó, atributos principais, localização da definição.
- Retornar `null` quando não houver nada útil (nunca invente).

### 4.3. Autocomplete contextual (obrigatório)

**Capacidade LSP:** `textDocument/completion`, com `triggerCharacters: [".", ":"]`.

**Comportamento:**
- Sugerir **palavras-chave do idioma do arquivo** (via `lsp-core/completion.ts`).
- Sugerir **nomes já definidos** no escopo atual (tarefas, recursos, contas).
- Cada `CompletionItem` deve ter `kind` apropriado (`Keyword`, `Reference`, `Property`).

### 4.4. Navegação semântica (recomendado)

**Capacidades:** `textDocument/definition`, `textDocument/references`.

**Comportamento:**
- `definition` em referências → saltar para a declaração.
- `references` em declarações → listar todos os usos no projeto.
- Essas capacidades **exigem que o `lsp-core` já exponha** `getDefinition` / `getReferences`. Se ainda não existirem, **não implemente no servidor** — solicite ao mantenedor do core ou abra PR no `lsp-core` primeiro.

### 4.5. Realce sintático semântico (recomendado)

**Capacidade:** `textDocument/semanticTokens/full`.

**Comportamento:**
- Consumir `getSemanticTokens(ast)` do `lsp-core` e retornar `{ data: number[] }`.
- Declarar a `legend` no `initialize` com `tokenTypes` estáveis (`keyword`, `type`, `variable`, `parameter`) — **sincronize com o `lsp-core`**, que precisa gerar índices correspondentes à mesma legend.

### Fora de escopo (não implemente sem solicitação explícita)

- Formatação (`textDocument/formatting`) — pertence ao core, não ao LSP.
- Code actions (exceto se surgirem regras que as justifiquem).
- Rename symbol — depende de suporte no core.
- Workspace symbols — pode vir depois, mas não no MVP.

---

## 5. Contrato de integração `lsp → lsp-core`

Estas são as **únicas** chamadas que o servidor faz ao `lsp-core`. Se precisar de algo além, **é sinal de que falta API no `lsp-core`** — abra issue, não burle.

```ts
import {
  analyzeDocument,     // → AnalysisResult (contém ast + diagnostics)
  getHover,            // → Hover | null
  getCompletions,      // → CompletionItem[]
  getSemanticTokens,   // → number[]
  resolveLocale,       // → "pt-br" | "en" | "es"
} from "@vanaware/syntaxmesh/lsp-core";
```

**Fluxo típico:**

```ts
documents.onDidChangeContent(({ document }) => {
  const previous = cache.get(document.uri);
  const result = analyzeDocument(document.uri, document.getText(), {
    uri: document.uri,
    locale: "auto",          // resolveLocale é chamado internamente
    previous,                // reuso incremental
    version: document.version,
  });
  cache.set(document.uri, result);
  connection.sendDiagnostics({ uri: document.uri, diagnostics: result.diagnostics });
});

connection.onHover(({ textDocument, position }) => {
  const result = cache.get(textDocument.uri);
  if (!result) return null;
  return getHover(result.ast, position);
});
```

**Note que o servidor nunca vê `AST` nem `TaskNode` diretamente** — ele só guarda a referência opaca e a repassa. Isso é proposital.

---

## 6. Estrutura de pastas do pacote `packages/lsp`

```
packages/lsp/
├── deno.json
├── mod.ts                    # re-export (para embedding em outros runtimes)
├── src/
│   ├── connection.ts         # BrowserMessageReader/Writer sobre Deno.stdio
│   ├── server.ts             # createConnection + registro de handlers
│   ├── documents.ts          # TextDocuments + cache por URI
│   ├── handlers/
│   │   ├── diagnostics.ts
│   │   ├── hover.ts
│   │   ├── completion.ts
│   │   ├── definition.ts     # se disponível no lsp-core
│   │   ├── references.ts     # se disponível no lsp-core
│   │   └── semantic-tokens.ts
│   └── log.ts                # console.error wrapper (NUNCA console.log)
├── bin/
│   └── syntaxmesh-lsp.ts     # entrypoint CLI (stdio)
└── tests/
    ├── integration_test.ts   # spawn do binário + JSON-RPC de fumaça
    └── fixtures/
```

---

## 7. `deno.json` de referência

**`packages/lsp/deno.json`:**

```json
{
  "name": "@vanaware/syntaxmesh-lsp",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts",
    "./bin": "./bin/syntaxmesh-lsp.ts"
  },
  "imports": {
    "@vanaware/syntaxmesh/lsp-core": "workspace:@vanaware/syntaxmesh/lsp-core",
    "vscode-languageserver": "npm:vscode-languageserver@^9/browser",
    "vscode-languageserver-textdocument": "npm:vscode-languageserver-textdocument@^1"
  },
  "tasks": {
    "dev": "deno run --watch --allow-read --allow-env bin/syntaxmesh-lsp.ts",
    "compile": "deno compile --allow-read --allow-env --output=./out/syntaxmesh-lsp bin/syntaxmesh-lsp.ts",
    "test": "deno test --allow-read --allow-run"
  }
}
```

**Atenção aos detalhes:**
- Use `vscode-languageserver@^9/browser`, **não** `/node`. O modo browser expõe `BrowserMessageReader/Writer`, que funcionam com `Deno.stdin.readable` e `Deno.stdout.writable`.
- Permissões mínimas: `--allow-read` (fixtures/grammar WASM) e `--allow-env`. **Nunca** `--allow-all`.

---

## 8. Bootstrap mínimo (referência)

```ts
// packages/lsp/bin/syntaxmesh-lsp.ts
import { startServer } from "../src/server.ts";

startServer().catch((err) => {
  console.error("[syntaxmesh-lsp] fatal:", err);
  Deno.exit(1);
});
```

```ts
// packages/lsp/src/server.ts
import {
  createConnection, TextDocuments, TextDocumentSyncKind,
  BrowserMessageReader, BrowserMessageWriter,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { registerHandlers } from "./handlers/mod.ts";

export async function startServer() {
  const connection = createConnection(
    new BrowserMessageReader(Deno.stdin.readable),
    new BrowserMessageWriter(Deno.stdout.writable),
  );

  const documents = new TextDocuments(TextDocument);

  connection.onInitialize(() => ({
    serverInfo: { name: "syntaxmesh-lsp", version: "0.1.0" },
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: { triggerCharacters: [".", ":"] },
      definitionProvider: true,
      referencesProvider: true,
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["keyword", "type", "variable", "parameter"],
          tokenModifiers: [],
        },
        full: true,
      },
    },
  }));

  registerHandlers(connection, documents);
  documents.listen(connection);
  await connection.listen();
}
```

---

## 9. Regras rígidas (violações são bugs)

1. **`stdout` é sagrado.** Qualquer `console.log` no servidor corrompe o fluxo JSON-RPC e desconecta o cliente. Use **sempre** `console.error` (ou o wrapper `src/log.ts`) para debug.
2. **Nunca importe `@vanaware/syntaxmesh` no `syntaxmesh-lsp`.** Só `@vanaware/syntaxmesh/lsp-core`.
3. **Nunca coloque lógica de linguagem no LSP.** Se precisar de validação, adicione ao `lsp-core` (ou ao core, se for domínio puro).
4. **Estado por URI vive em um único `Map`.** Não crie caches paralelos. Ao `didClose`, delete a entrada.
5. **Handlers retornam `null` em caso de dúvida.** Não invente informação. Se `cache.get(uri)` retornar `undefined`, retorne `null` imediatamente.
6. **Nunca bloqueie o event loop.** `analyzeDocument` deve ser rápido; se o parsing em arquivos grandes for custoso, mova para um `Worker` (`Deno.Worker`) — mas isso é decisão do core, não do LSP.
7. **Capabilities precisam refletir handlers registrados.** Se `hoverProvider: true`, o handler `onHover` **precisa** existir. Caso contrário, o cliente trava esperando resposta.
8. **Sempre propague `version` de `AnalysisResult`** para evitar respostas obsoletas em edições rápidas.

---

## 10. Estratégia de testes (o que o CI deve garantir)

### No `lsp-core` (roda em milissegundos, maioria dos testes)

```ts
// packages/core/lsp-core/diagnostics_test.ts
import { analyzeDocument } from "./analyze.ts";

Deno.test("referência a tarefa inexistente gera erro", () => {
  const result = analyzeDocument("file:///x.tjp", `
    task A { depends B }
  `, { uri: "file:///x.tjp", locale: "en" });
  assertEquals(result.diagnostics.length, 1);
  assertEquals(result.diagnostics[0].severity, 1); // Error
});
```

### No `syntaxmesh-lsp` (testes de fumaça, um por feature)

```ts
// packages/lsp/tests/integration_test.ts
Deno.test("servidor responde a initialize e publica diagnósticos em didOpen", async () => {
  const cmd = new Deno.Command("./out/syntaxmesh-lsp", {
    stdin: "piped", stdout: "piped", stderr: "piped",
  });
  const proc = cmd.spawn();
  // Enviar initialize → didOpen com conteúdo inválido → ler publishDiagnostics
  // Assertar que a mensagem foi recebida com N diagnósticos.
  // Finalizar com shutdown/exit.
});
```

**Regra:** o servidor não deve ter testes que exercitem regras de linguagem. Um teste de fumaça por handler é suficiente — o comportamento já foi coberto no `lsp-core`.

---

## 11. Checklist de entrega (o que "pronto" significa)

O pacote `@vanaware/syntaxmesh-lsp` só é considerado **pronto para release 0.1.0** quando **todos** os itens abaixo são verdadeiros:

- [ ] `packages/lsp/deno.json` no workspace do monorepo, com imports corretos.
- [ ] `bin/syntaxmesh-lsp.ts` compilável via `deno task compile`.
- [ ] Conexão stdio funcional: cliente VS Code (ou `nvim --headless`) inicia e recebe `initialize` com sucesso.
- [ ] **Pilar 4.1 (diagnósticos)** funcionando em tempo real em `.tjp` e `.tji`.
- [ ] **Pilar 4.2 (hover)** funcionando em referências.
- [ ] **Pilar 4.3 (completion)** funcionando com palavras-chave no idioma do arquivo.
- [ ] **Pilar 4.4 (definition/references)** funcionando (se `lsp-core` já expõe as APIs).
- [ ] **Pilar 4.5 (semantic tokens)** funcionando (se `lsp-core` já expõe a API).
- [ ] Suporte a **pt-br, en, es** validado em teste de integração (um arquivo por idioma).
- [ ] `deno task test` no pacote `lsp` passando em CI.
- [ ] `deno lint` e `deno fmt --check` limpos.
- [ ] Nenhum `console.log` no código do servidor (checado por lint customizado ou grep no CI).
- [ ] `stdout` limpo durante toda a sessão LSP (verificado em teste de integração).
- [ ] Documentação em `packages/lsp/README.md`: como compilar, como plugar no VS Code, como plugar no Neovim.

---

## 12. Como o mantenedor vai saber que está certo

Ao final da implementação, o repositório deve permitir:

1. **`deno task compile` em `packages/lsp`** produz um binário `out/syntaxmesh-lsp`.
2. **Adicionar uma nova palavra-chave em pt-br** dentro de `packages/core/i18n/keywords.pt-br.ts` **não exige nenhuma alteração em `packages/lsp`** — o servidor já passa a reconhecê-la na próxima compilação. Este é o **teste definitivo** de que a separação de camadas está correta.
3. **Um teste do `lsp-core`** pode ser escrito em ~5 linhas para qualquer nova regra semântica, rodando em milissegundos.
4. **Trocar `vscode-languageserver` por outra lib** (ex.: `tower-lsp` via binding Rust) seria possível mexendo apenas em `packages/lsp/src/connection.ts` e nos handlers — `lsp-core` não muda uma vírgula.

---

## 13. Perguntas que **não devem ser feitas** ao implementar

- ❌ "Como faço o parser do SyntaxMesh dentro do LSP?" → **Você não faz.** Importe `analyzeDocument` do `lsp-core`.
- ❌ "Onde coloco a tabela de palavras-chave em pt-br?" → **No core**, `packages/core/i18n/`. Nunca no LSP.
- ❌ "Como mapeio um erro do parser para `Diagnostic`?" → Já está em `lsp-core/diagnostics.ts`. Se não estiver, adicione **lá**.
- ❌ "Como detecto o idioma do arquivo?" → `resolveLocale` do `lsp-core`.
- ❌ "Posso usar `vscode-languageserver/node` para simplificar?" → **Não.** Use `/browser` com streams do Deno.

Se a resposta para uma pergunta de implementação não estiver clara neste guia, **o problema é de contrato entre camadas**, não do LSP. A resposta correta, nesses casos, é: **abrir uma discussão sobre a API do `lsp-core`** — nunca implementar a lógica de linguagem dentro do servidor.

