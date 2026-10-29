# Fase 22 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-22-vscode-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-22-vscode.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~95 tarefas
> **Concluídas:** 0
> **Natureza:** tooling externo (extensão VS Code + `lsp-core`)
> **Fonte:** `fase-22-lsp.md` (conceito de LSP) + `taskjuggler-lsp` (referência C) +
> documentação VS Code + `@vsce/create`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é implementação de tooling**, não de linguagem. Se precisar de
lógica de parsing/semântica que ainda não existe, **pare e verifique** se está
no `lsp-core` (22.1) ou no core (Fases 2–21). Não implemente lógica de
linguagem na extensão.

### Timing

- **A Fase 22 começa após a Fase 21** (corpus multilíngue validado).
- **`lsp-core` (22.1) é pré-requisito** do LSP client (22.4). Ele **não existe
  ainda** — deve ser criado nesta fase.
- **O motor (`@vanaware/syntaxmesh`) já está pronto** (Fases 2–21). A extensão
  só o consome via Worker.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 030** — Arquitetura simplificada (pacotes).
- **ADR 033** — Extensão VS Code + `lsp-core` (**criado nesta fase**).

### Convenções CRÍTICAS

- **`package.json` é manifesto VS Code**, não gerenciador de dependências.
- **Sem `node_modules`.** Dependências npm via `npm:` no `deno.json`.
- **LSP em Worker**, não stdio.
- **Motor em Worker separado** do LSP Worker.
- **TextMate grammar cobre PT/EN/ES.**
- **Configuração `syntaxmesh.locale` não sobrescreve o arquivo.**
- **Testes de integração no VS Code Test Runner**, não em Deno puro.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não implementar parser/semântica na extensão.
- ❌ Não usar `node_modules` ou `npm install`.
- ❌ Não rodar LSP via stdio (requer processo externo).
- ❌ Não sobrescrever `language "..."` do arquivo via configuração.
- ❌ Não usar `console.log` no Worker do LSP (corrompe JSON-RPC).
- ❌ Não publicar `.vsix` sem testar em VS Code limpo.
- ❌ Não pular 22.1 (`lsp-core`) — sem ele, 22.4 não compila.

---

## Progresso

```
[ ] 22.0  ADR 033 (extensão VS Code + lsp-core)     —   0/6
[ ] 22.1  lsp-core (CRIAR)                          —   0/20
[ ] 22.2  Scaffolding da extensão                   —   0/12
[ ] 22.3  Language contribution                     —   0/12
[ ] 22.4  LSP client                                —   0/12
[ ] 22.5  Comandos e configuração                   —   0/10
[ ] 22.6  Views e Status Bar                        —   0/6
[ ] 22.7  Integração com o motor                    —   0/8
[ ] 22.8  Testes                                    —   0/12
[ ] 22.9  Empacotamento                             —   0/6
[ ] 22.10 Verificação final                         —   0/6
─────────────────────────────────────────────────────────
TOTAL: ~110
```

---

## Bloco A — Fundação

### 22.0 — ADR 033

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.0.1 | Criar `docs/syntaxmesh/decisoes/033-extensao-vscode.md` com frontmatter | idem | arquivo existe |
| 22.0.2 | Seção **Contexto:** tooling complementar; `lsp-core` não existe e é entrega central; reuso de Vim/Emacs/Kate/taskjuggler-lsp | idem | — |
| 22.0.3 | Seção **Decisões:** extensão completa; `lsp-core` adaptador puro; LSP via Worker; motor em Worker separado; `package.json` como manifesto; bundle via Deno; Test Runner | idem | — |
| 22.0.4 | **Alternativas** (LSP stdio, Web extension only, Monaco standalone) + **Consequências** | idem | — |
| 22.0.5 | Seção **Reuso de implementações existentes:** `taskjuggler-lsp` (C), `vim-taskjuggler`, `taskjuggler-mode.el`, Kate syntax | idem | — |
| 22.0.6 | Atualizar linha `033` em `decisoes/README.md` | idem | 33 linhas |

---

## Bloco B — `lsp-core` (CRIAR)

### 22.1 — `lsp-core`

**Objetivo:** criar `packages/core/lsp-core/` com a API de §3.1 do plano.
**Este bloco é pré-requisito do 22.4.**

#### 22.1.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.1.1 | Criar `packages/core/lsp-core/deno.json` com `name: "@vanaware/syntaxmesh/lsp-core"`, `exports`, `imports` | idem | `deno check` |
| 22.1.1.2 | Adicionar `vscode-languageserver-types` ao `imports` (`npm:vscode-languageserver-types@^3`) | idem | `deno check` |
| 22.1.1.3 | Adicionar `lsp-core` ao `workspace` do `deno.jsonc` raiz | `deno.jsonc` | `deno task --list` |
| 22.1.1.4 | Criar `packages/core/lsp-core/mod.ts` com os exports de §3.1 | idem | `deno check` |
| 22.1.1.5 | Adicionar `exports["./lsp-core"]` em `packages/core/deno.json` | `packages/core/deno.json` | `deno check` |

#### 22.1.2 — `locale.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.2.1 | Criar `locale.ts` com `resolveLocale(uri, text): "pt-br" \| "en" \| "es"` | idem | `deno check` |
| 22.1.2.2 | Detectar `language "pt-BR"` no texto; senão, default `"en"` | idem | 3 testes |
| 22.1.2.3 | Teste: `.tjp` sem diretiva → `"en"` | idem | 1 teste |

#### 22.1.3 — `analyze.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.3.1 | Criar `analyze.ts` com `analyzeDocument(uri, text, opts): AnalysisResult` | idem | `deno check` |
| 22.1.3.2 | Chamar `ProjectFileParser.parse(content)` do core | idem | 1 teste |
| 22.1.3.3 | Popular `ast` e `diagnostics` | idem | 2 testes |
| 22.1.3.4 | Suportar `previous` (reuso incremental) | idem | 2 testes |
| 22.1.3.5 | Popular `version` | idem | 1 teste |

#### 22.1.4 — `diagnostics.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.4.1 | Criar `diagnostics.ts` com `toDiagnostics(ast, errors): Diagnostic[]` | idem | `deno check` |
| 22.1.4.2 | Mapear erros de sintaxe para `DiagnosticSeverity.Error` | idem | 2 testes |
| 22.1.4.3 | Mapear erros semânticos (referência não resolvida) para `Error` | idem | 2 testes |
| 22.1.4.4 | Mapear avisos para `Warning` | idem | 2 testes |
| 22.1.4.5 | Mensagens no idioma detectado (via `resolveLocale`) | idem | 2 testes |

#### 22.1.5 — `hover.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.5.1 | Criar `hover.ts` com `getHover(ast, position): Hover \| null` | idem | `deno check` |
| 22.1.5.2 | Retornar markdown com tipo de nó, atributos principais, localização | idem | 3 testes |
| 22.1.5.3 | Retornar `null` quando não houver nada útil | idem | 1 teste |

#### 22.1.6 — `completion.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.6.1 | Criar `completion.ts` com `getCompletions(ast, position, locale): CompletionItem[]` | idem | `deno check` |
| 22.1.6.2 | Sugerir keywords do idioma do arquivo | idem | 3 testes |
| 22.1.6.3 | Sugerir nomes definidos (tasks, resources, accounts) | idem | 3 testes |
| 22.1.6.4 | `CompletionItem.kind` apropriado (`Keyword`, `Reference`, `Property`) | idem | 2 testes |

#### 22.1.7 — `navigation.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.7.1 | Criar `navigation.ts` com `getDefinition(ast, position): Location \| null` | idem | `deno check` |
| 22.1.7.2 | Salto para declaração em referências | idem | 3 testes |
| 22.1.7.3 | Criar `getReferences(ast, position): Location[]` | idem | 3 testes |
| 22.1.7.4 | Listar usos cross-file (se AST agregada) | idem | 2 testes |

#### 22.1.8 — `semantic-tokens.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.8.1 | Criar `semantic-tokens.ts` com `getSemanticTokens(ast): number[]` | idem | `deno check` |
| 22.1.8.2 | Emitir tokens para keywords, identificadores, strings, números, datas, comentários | idem | 6 testes |
| 22.1.8.3 | Declarar `legend` estável (sincronizada com o cliente) | idem | 1 teste |

#### 22.1.9 — `symbols.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.9.1 | Criar `symbols.ts` com `getDocumentSymbols(ast): DocumentSymbol[]` | idem | `deno check` |
| 22.1.9.2 | Árvore hierárquica (project → task → subtask) | idem | 3 testes |
| 22.1.9.3 | Criar `getWorkspaceSymbols(asts): SymbolInformation[]` | idem | 3 testes |
| 22.1.9.4 | Busca case-insensitive por nome | idem | 2 testes |

#### 22.1.10 — Proibições e verificação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1.10.1 | Confirmar que `lsp-core` **não importa** `vscode-languageserver` | idem | grep |
| 22.1.10.2 | Confirmar que `lsp-core` **não importa** `Deno.stdin/stdout` | idem | grep |
| 22.1.10.3 | Confirmar que `lsp-core` importa **apenas** `@vanaware/syntaxmesh` + `vscode-languageserver-types` | idem | grep |
| 22.1.10.4 | `deno task --cwd packages/core/lsp-core test` verde | — | exit 0 |
| 22.1.10.5 | Cobertura ≥ 80% no `lsp-core` | — | relatório |

---

## Bloco C — Scaffolding

### 22.2 — Estrutura da extensão

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.2.1 | Criar `packages/vscode/` com `deno.json` (imports, tasks) | idem | `deno check` |
| 22.2.2 | Criar `package.json` (manifesto VS Code) com `name`, `displayName`, `publisher`, `engines`, `activationEvents`, `main` | idem | JSON válido |
| 22.2.3 | Adicionar `contributes.languages` (`.tjp`, `.tji`) | idem | 2 extensões |
| 22.2.4 | Adicionar `contributes.commands` (`schedule`, `report`, `export`, `switchLanguage`, `showProjectTree`) | idem | 5 comandos |
| 22.2.5 | Adicionar `contributes.configuration` (`syntaxmesh.locale`, `syntaxmesh.scheduleOnSave`, `syntaxmesh.lsp.trace.server`, `syntaxmesh.report.defaultFormat`) | idem | 4 settings |
| 22.2.6 | Adicionar `contributes.viewsContainers` + `contributes.views` (Project Explorer) | idem | 1 view |
| 22.2.7 | Adicionar `contributes.grammars` (`.tjp`, `.tji`) | idem | 2 grammars |
| 22.2.8 | Adicionar `contributes.snippets` (`.tjp`) | idem | 1 snippet file |
| 22.2.9 | Criar `.vscode/launch.json` (Extension Development Host) | idem | arquivo existe |
| 22.2.10 | Criar `.vscode/tasks.json` (build/test) | idem | arquivo existe |
| 22.2.11 | Criar `src/extension.ts` com `activate`/`deactivate` vazios | idem | `deno check` |
| 22.2.12 | Adicionar task `check:all`, `test:unit`, `test:integration`, `package` no `deno.json` | idem | `deno task --list` |

---

## Bloco D — Language contribution

### 22.3 — TextMate grammar + snippets

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.3.1 | Criar `syntaxes/syntaxmesh.tmLanguage.json` com escopo `source.syntaxmesh` | idem | JSON válido |
| 22.3.2 | Adicionar patterns para `project`, `task`, `resource`, `account`, `shift`, `report`, `scenario` | idem | 7 patterns |
| 22.3.3 | Adicionar patterns para `depends`, `precedes`, `allocate`, `chargeset`, `material`, `timebasis` | idem | 6 patterns |
| 22.3.4 | Adicionar patterns para `effort`, `duration`, `length`, `start`, `end`, `milestone` | idem | 6 patterns |
| 22.3.5 | Adicionar patterns para strings, números, datas, comentários (`#`, `//`, `/* */`) | idem | 4 patterns |
| 22.3.6 | Criar `syntaxes/syntaxmesh-tji.tmLanguage.json` (importa a grammar `.tjp` + adiciona `include`) | idem | JSON válido |
| 22.3.7 | Criar `language-configuration.json` (brackets, auto-closing, comments, folding) | idem | JSON válido |
| 22.3.8 | Criar `snippets/syntaxmesh.json` com `project`, `task`, `resource`, `account`, `report`, `material` | idem | 6 snippets |
| 22.3.9 | Adicionar variantes PT/EN/ES nos snippets (ou placeholders) | idem | revisão |
| 22.3.10 | **Reusar conceitualmente** `vim-taskjuggler` (lista de keywords) e `taskjuggler-mode.el` (snippets) | idem | revisão |
| 22.3.11 | **Reusar conceitualmente** Kate syntax (estrutura de contexto) | idem | revisão |
| 22.3.12 | Snapshot test: TextMate grammar destaca PT/EN/ES corretamente (fixtures) | `tests/unit/grammar_test.ts` | 3 testes |

---

## Bloco E — LSP client

### 22.4 — Cliente LSP

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.4.1 | Criar `src/lsp/client.ts` com `LanguageClient` de `vscode-languageclient/browser` | idem | `deno check` |
| 22.4.2 | Criar `src/lsp/worker.ts` com entry do Worker que hospeda `lsp-core` | idem | `deno check` |
| 22.4.3 | Configurar `clientOptions.documentSelector` para `.tjp`/`.tji` | idem | 1 teste |
| 22.4.4 | Configurar `synchronize.fileEvents` (watcher de `.tjp`/`.tji`) | idem | 1 teste |
| 22.4.5 | Registrar `capabilities` no `initialize` (sync incremental, hover, completion, definition, references, semantic tokens, document symbols, workspace symbols) | idem | 1 teste |
| 22.4.6 | Implementar `didOpen`/`didChange`/`didClose` no Worker | idem | 3 testes |
| 22.4.7 | Implementar `publishDiagnostics` no Worker | idem | 1 teste |
| 22.4.8 | Implementar `hover` no Worker | idem | 1 teste |
| 22.4.9 | Implementar `completion` no Worker | idem | 1 teste |
| 22.4.10 | Implementar `definition`/`references` no Worker | idem | 2 testes |
| 22.4.11 | Implementar `semanticTokens/full` no Worker | idem | 1 teste |
| 22.4.12 | Implementar `documentSymbol`/`workspace/symbol` no Worker | idem | 2 testes |

---

## Bloco F — Comandos e configuração

### 22.5 — Comandos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.5.1 | Criar `src/commands/schedule.ts` — parse+schedule no `engine.worker`; exibe diagnósticos + cronograma | idem | `deno check` |
| 22.5.2 | Criar `src/commands/report.ts` — parse+schedule+report; abre Webview ou salva | idem | `deno check` |
| 22.5.3 | Criar `src/commands/export.ts` — exporta `.tjp` canônico | idem | `deno check` |
| 22.5.4 | Criar `src/commands/switch-language.ts` — alterna `language "..."` no `.tjp` ativo | idem | `deno check` |
| 22.5.5 | Criar `src/commands/show-project-tree.ts` — abre a view de árvore | idem | `deno check` |
| 22.5.6 | Registrar todos os comandos em `extension.ts` | idem | 5 comandos |
| 22.5.7 | Criar `src/config/settings.ts` — leitura de `syntaxmesh.*` | idem | 4 settings |
| 22.5.8 | `syntaxmesh.locale` `auto` respeita `language "..."`; `en`/`pt-BR`/`es` forçam | idem | 4 testes |
| 22.5.9 | `syntaxmesh.scheduleOnSave` dispara `schedule` no `onDidSave` | idem | 1 teste |
| 22.5.10 | `syntaxmesh.report.defaultFormat` usado pelo comando `report` | idem | 1 teste |

---

## Bloco G — Views e Status Bar

### 22.6 — Project Explorer + Status Bar

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.6.1 | Criar `src/views/project-tree.ts` com `TreeDataProvider` | idem | `deno check` |
| 22.6.2 | `getChildren` lista `tasks`, `resources`, `accounts`, `shifts`, `reports` | idem | 5 testes |
| 22.6.3 | `getTreeItem` retorna `TreeItem` com ícone e `collapsibleState` | idem | 1 teste |
| 22.6.4 | Refresh após `schedule` | idem | 1 teste |
| 22.6.5 | Criar `src/views/status-bar.ts` com estado do parser/scheduler | idem | 1 teste |
| 22.6.6 | Status Bar mostra locale detectado e última execução | idem | 2 testes |

---

## Bloco H — Integração com o motor

### 22.7 — Engine Worker

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.7.1 | Criar `src/engine/worker.ts` com entry do Worker que importa `@vanaware/syntaxmesh` | idem | `deno check` |
| 22.7.2 | Implementar `parse` no Worker | idem | 1 teste |
| 22.7.3 | Implementar `schedule` no Worker | idem | 1 teste |
| 22.7.4 | Implementar `report` no Worker | idem | 1 teste |
| 22.7.5 | Criar `src/engine/client.ts` com request/response (`id`) | idem | 3 testes |
| 22.7.6 | Tratar erros do Worker (timeout, exception) | idem | 2 testes |
| 22.7.7 | Cancelamento de request anterior (debounce) | idem | 1 teste |
| 22.7.8 | Exportar `EngineClient` em `mod.ts` | idem | `deno check` |

---

## Bloco I — Testes

### 22.8 — Unitários + integração

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.8.1 | `tests/unit/commands_test.ts` — mock de `EngineClient` | idem | 5 testes |
| 22.8.2 | `tests/unit/engine-client_test.ts` — request/response | idem | 4 testes |
| 22.8.3 | `tests/unit/config_test.ts` — leitura/escrita de settings | idem | 4 testes |
| 22.8.4 | `tests/integration/lsp.test.ts` — initialize + publishDiagnostics + hover + completion + definition + references | idem | 6 testes |
| 22.8.5 | `tests/integration/commands.test.ts` — schedule, report, export, switchLanguage | idem | 4 testes |
| 22.8.6 | `tests/integration/language.test.ts` — grammar snapshot PT/EN/ES + snippets | idem | 4 testes |
| 22.8.7 | Configurar `test:unit` (Deno) e `test:integration` (VS Code Test Runner) | `deno.json`, `package.json` | `deno task --list` |
| 22.8.8 | CI roda `test:unit` + `test:integration` | `.github/workflows/ci.yml` (ou equivalente) | verde |
| 22.8.9 | Cobertura ≥ 70% no pacote `vscode` | — | relatório |
| 22.8.10 | Smoke test: instalar `.vsix` em VS Code limpo, abrir `.tjp`, ver highlighting + diagnósticos + hover + completion | `tests/integration/smoke.test.ts` | 1 teste |
| 22.8.11 | Smoke test: `lsp-core` roda em Deno puro (sem VS Code) | `packages/core/lsp-core/tests/smoke_test.ts` | 1 teste |
| 22.8.12 | Confirmar que `lsp-core` não quebra `deno check` do workspace | `deno task check:all` | exit 0 |

---

## Bloco J — Empacotamento

### 22.9 — Bundle + `.vsix`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.9.1 | Criar `scripts/build.ts` com `@vsce/bundler` (ou `esbuild`) | idem | `deno check` |
| 22.9.2 | Configurar `out/extension.js` + `out/lsp.worker.js` + `out/engine.worker.js` | idem | 3 arquivos |
| 22.9.3 | Criar `.vscodeignore` (exclui `src/`, `tests/`, `deno.json`, `scripts/`) | idem | arquivo existe |
| 22.9.4 | Adicionar task `package` em `deno.json` (`deno run npm:@vscode/vsce package`) | idem | `deno task package` |
| 22.9.5 | Gerar `.vsix` e verificar tamanho < 5 MB | — | `ls -lh` |
| 22.9.6 | Testar instalação em VS Code limpo (via `code --install-extension`) | — | sucesso |

---

## Bloco K — Verificação final

### 22.10 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 22.10.1 | `deno task --cwd packages/core/lsp-core test` verde | exit 0 |
| 22.10.2 | `deno task --cwd packages/vscode check:all` verde | exit 0 |
| 22.10.3 | `deno task --cwd packages/vscode test:unit` verde | exit 0 |
| 22.10.4 | `deno task --cwd packages/vscode test:integration` verde | exit 0 |
| 22.10.5 | `deno task --cwd packages/vscode package` gera `.vsix` válido | exit 0 |
| 22.10.6 | ADR 033 commitado | git log |
| 22.10.7 | `CURRENT.md` atualizado com "Fase 22 concluída; extensão VS Code + `lsp-core` disponíveis" | revisão |

---

## Notas para a IA

1. **Ordem:** 22.0 → 22.1 → 22.2 → 22.3 → 22.4 → 22.5 → 22.6 → 22.7 → 22.8 →
   22.9 → 22.10.
2. **`lsp-core` primeiro.** Ele **não existe** — deve ser criado em 22.1 com a
   API de §3.1. Não pule para 22.4 sem 22.1 verde.
3. **`lsp-core` é adaptador puro.** Não importa `vscode-languageserver` nem
   `Deno.stdin/stdout`. Testa em Deno puro.
4. **`package.json` é manifesto**, não gerenciador de dependências.
5. **LSP via Worker**, não stdio.
6. **Motor em Worker separado** do LSP Worker.
7. **TextMate grammar cobre PT/EN/ES.** Reusar conceitualmente Vim/Emacs/Kate.
8. **`syntaxmesh.locale` não sobrescreve o arquivo.**
9. **Testes de integração no VS Code Test Runner.**
10. **Sem `any` em `src/`.**
11. **Commit por subfase:** `feat(lsp-core): analyze`, `feat(lsp-core): diagnostics`,
    `feat(vscode): scaffold`, `feat(vscode): lsp-client`,
    `feat(vscode): schedule-command`, etc.
12. **ADR 033** registrado antes de fechar 22.0.
13. **`CURRENT.md` atualizado** ao final com "extensão VS Code + `lsp-core`
    disponíveis".

---

## Referências cruzadas

- `docs/syntaxmesh/fases/fase-22-vscode.md` — plano desta fase
- `docs/syntaxmesh/fases/fase-22-lsp.md` — plano anterior (LSP server; base
  conceitual para o cliente)
- `docs/syntaxmesh/fases/plano.md` — 21 fases canônicas
- `docs/syntaxmesh/decisoes/033-extensao-vscode.md` — ADR desta fase
- `docs/syntaxmesh/decisoes/030-arquitetura-simplificada.md` — pacotes
- `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md` — corpus e golden
- `docs/syntaxmesh/fases/fase-10-parser-linguagem.md` — parser e i18n
- `docs/syntaxmesh/fases/fase-11-logica-queries.md` — `Query`
- `taskjuggler-lsp` (C) — https://github.com/devrintalen/taskjuggler-lsp
- `vim-taskjuggler` — https://github.com/kalafut/vim-taskjuggler
- `taskjuggler-mode.el` — https://github.com/devrintalen/taskjuggler-mode.el
- Kate syntax — https://invent.kde.org/sars/ktexteditor/-/commit/332b48e1

---

**Fim das tarefas da Fase 22 (extensão VS Code + `lsp-core`).**