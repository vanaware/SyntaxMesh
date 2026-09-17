# Fase 20 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-20-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-20-pwa-ui.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~180 tarefas
> **Concluídas:** 0
> **Stack:** Preact + Signals + BeerCSS + Service Worker + Web Worker

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa segue TDD.** Antes de implementar:

1. Escrever o teste que falha.
2. `deno task test` → confirmar falha correta.
3. Implementar o mínimo.
4. `deno task test` → passa.
5. `deno task check-all` → verde.
6. Commit atômico.
7. Marcar `[x]`.

### Regras arquiteturais obrigatórias

- **UI consome serviços, nunca Core diretamente.**
- **UI não toca IndexedDB/OPFS diretamente.** Sempre via `@syntaxmesh/storage`.
- **UI não executa parser/scheduler na main thread.** Sempre via `engine.worker.ts`.
- **Core não é importado pela UI diretamente**, apenas via `services/`.
- **Preact + Signals + BeerCSS.** Sem outros frameworks.
- **Editor básico** (textarea + overlay). Sem CodeMirror/Monaco.
- **GanttView** usa HTML da Fase 15 + `tjreport.css`.
- **ReportView** com `<iframe sandbox>`.
- **Service Worker** versionado (`CACHE_VERSION`).

### ADRs relevantes

- **ADR 001** — Core independente de DOM.
- **ADR 002** — Parser isolado da lógica de UI.
- **ADR 005** — TypeScript + Deno + Browser only.
- **ADR 032** — PWA + UI stack (**criado nesta fase**).

### Convenções

- Componentes em `PascalCase.tsx`.
- Signals agrupados por domínio (`ui.ts`, `project.ts`, etc.).
- Serviços como classes com injeção de dependências.
- i18n de UI separado de i18n de keywords.
- Tema via `data-theme` do BeerCSS.
- Debounce: parser 300ms; autosave 500ms.
- Sem `any` em `src/`.
- Commit por subfase: `feat(ui): toolbar`, etc.

### Anti-padrões

- ❌ Não importar `@syntaxmesh/core` em `packages/ui/src/components/**`.
- ❌ Não usar `IndexedDB`/`OPFS` em `packages/ui/src/**`.
- ❌ Não adicionar dependências fora de Preact/Signals/BeerCSS.
- ❌ Não implementar editor com Monaco/CodeMirror.
- ❌ Não quebrar contratos de `@syntaxmesh/storage`.

---

## Progresso

```
[ ] 25.0  ADR 032 (PWA + UI stack)              —   0/5
[ ] 25.1  manifest.json + ícones                —   0/6
[ ] 25.2  Service Worker                        —   0/12
[ ] 25.3  Registro do SW + auto-update          —   0/8
[ ] 25.4  index.html + shell offline            —   0/6
[ ] 25.5  Preact + Signals setup                —   0/8
[ ] 25.6  BeerCSS setup                         —   0/5
[ ] 25.7  Theme system                          —   0/8
[ ] 25.8  engine.worker.ts                      —   0/12
[ ] 25.9  engine-client.ts                      —   0/8
[ ] 25.10 parser-service.ts                     —   0/6
[ ] 25.11 scheduler-service.ts                  —   0/5
[ ] 25.12 report-service.ts + storage-service.ts —  0/10
[ ] 25.13 Estrutura de Signals                  —   0/14
[ ] 25.14 Toolbar                               —   0/6
[ ] 25.15 Sidebar + ProjectExplorer             —   0/10
[ ] 25.16 StatusBar + ErrorList                 —   0/8
[ ] 25.17 LanguageSelector                      —   0/4
[ ] 25.18 Shell                                 —   0/8
[ ] 25.19 ProjectExplorerView                   —   0/6
[ ] 25.20 EditorView                            —   0/12
[ ] 25.21 GanttView                             —   0/8
[ ] 25.22 ReportView                            —   0/8
[ ] 25.23 SettingsView                          —   0/8
[ ] 25.24 SheetsView                            —   0/8
[ ] 25.25 i18n UI                               —   0/8
[ ] 25.26 Integração end-to-end                 —   0/12
[ ] 25.27 Performance e acessibilidade          —   0/8
[ ] 25.28 Build e deploy                        —   0/8
[ ] 25.29 Verificação final                     —   0/8
─────────────────────────────────────────────────────
TOTAL: ~180
```

---

## Bloco A — PWA Base

### 25.0 — ADR 032 (PWA + UI stack)

**Objetivo:** formalizar a stack UI (Preact + Signals + BeerCSS), o Web Worker obrigatório e a estratégia de Service Worker.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.0.1 | Criar `docs/syntaxmesh/decisoes/032-pwa-ui-stack.md` com frontmatter | idem | arquivo existe |
| 25.0.2 | Seção **Contexto:** browser-only; requisitos de UI + offline; alternativas (React, Vue, Svelte) | idem | — |
| 25.0.3 | Seção **Decisões:** Preact + Signals + BeerCSS; Web Worker obrigatório; SW precache + network-first; hospedagem estática | idem | — |
| 25.0.4 | Seção **Alternativas:** CodeMirror/Monaco (editor) + **Consequências** | idem | — |
| 25.0.5 | Atualizar linha `032` em `decisoes/README.md` | idem | 32 linhas |

---

### 25.1 — `manifest.json` + ícones

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.1.1 | Criar `packages/ui/public/manifest.json` com `name`, `short_name`, `start_url`, `display: standalone` | idem | JSON válido |
| 25.1.2 | Adicionar `theme_color`, `background_color`, `scope: "/"` | idem | 1 teste |
| 25.1.3 | Adicionar `icons` (192×192, 512×512, maskable 512×512) | idem | 3 arquivos |
| 25.1.4 | Adicionar `categories: ["productivity", "business"]` | idem | 1 teste |
| 25.1.5 | Criar ícones PNG em `packages/ui/public/icons/` | idem | arquivos existem |
| 25.1.6 | Criar `packages/ui/tests/public/manifest_test.ts` | idem | 3 testes (JSON válido, icons, start_url) |

---

### 25.2 — Service Worker

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.2.1 | Criar `packages/service-worker/src/sw.ts` com estrutura base | idem | `deno check` |
| 25.2.2 | Adicionar `self.addEventListener('install', ...)` com precache | idem | 1 teste |
| 25.2.3 | Adicionar `self.addEventListener('activate', ...)` com limpeza de caches antigos | idem | 1 teste |
| 25.2.4 | Adicionar `self.addEventListener('fetch', ...)` | idem | 1 teste |
| 25.2.5 | Criar `packages/service-worker/src/cache-strategies.ts` | idem | `deno check` |
| 25.2.6 | Implementar `precache(urls): Promise<void>` | idem | 2 testes |
| 25.2.7 | Implementar `networkFirst(request): Promise<Response>` | idem | 3 testes |
| 25.2.8 | Implementar `cacheFirst(request): Promise<Response>` | idem | 2 testes |
| 25.2.9 | Implementar `staleWhileRevalidate(request): Promise<Response>` | idem | 2 testes |
| 25.2.10 | Definir `CACHE_VERSION = 'v1'` | idem | 1 teste |
| 25.2.11 | Configurar shell (HTML, CSS, JS): network-first | idem | 1 teste |
| 25.2.12 | Criar `packages/service-worker/tests/cache-strategies_test.ts` com 4 testes | idem | verde |

---

### 25.3 — Registro do SW + auto-update

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.3.1 | Criar `packages/ui/src/pwa/sw-register.ts` | idem | `deno check` |
| 25.3.2 | Implementar `registerServiceWorker(): Promise<void>` | idem | 2 testes |
| 25.3.3 | Escutar `updatefound` | idem | 1 teste |
| 25.3.4 | Criar `packages/ui/src/pwa/update-toast.tsx` (componente) | idem | `deno check` |
| 25.3.5 | Toast com botões "Recarregar" e "Depois" | idem | 2 testes |
| 25.3.6 | Populate `updateAvailableSignal` quando nova versão detectada | idem | 1 teste |
| 25.3.7 | Criar `packages/ui/tests/pwa/sw-register_test.ts` | idem | 2 testes |
| 25.3.8 | Teste: `register` chama `navigator.serviceWorker.register` | idem | 1 teste |

---

### 25.4 — `index.html` + shell offline

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.4.1 | Criar `packages/ui/public/index.html` com meta viewport | idem | arquivo existe |
| 25.4.2 | Adicionar `<link rel="manifest">` | idem | 1 teste |
| 25.4.3 | Adicionar `<link rel="stylesheet" href="beercss.min.css">` | idem | 1 teste |
| 25.4.4 | Adicionar `<link rel="stylesheet" href="tjreport.css">` | idem | 1 teste |
| 25.4.5 | Adicionar `<div id="app"></div>` e `<script type="module" src="main.js"></script>` | idem | 2 testes |
| 25.4.6 | Criar `packages/ui/public/offline.html` (fallback) | idem | arquivo existe |

---

## Bloco B — Stack UI

### 25.5 — Preact + Signals setup

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.5.1 | Adicionar deps `preact`, `@preact/signals`, `preact-render-to-string` em `packages/ui/deno.jsonc` | idem | `deno check` |
| 25.5.2 | Criar `packages/ui/src/main.tsx` com `render(<App />, document.getElementById('app'))` | idem | `deno check` |
| 25.5.3 | Chamar `registerServiceWorker()` em `main.tsx` | idem | 1 teste |
| 25.5.4 | Criar `packages/ui/src/app.tsx` com componente `<App />` esqueleto | idem | `deno check` |
| 25.5.5 | Adicionar roteamento por hash (`location.hash`) | idem | 2 testes |
| 25.5.6 | Criar `packages/ui/tests/app_test.tsx` | idem | 2 testes |
| 25.5.7 | Teste: renderiza `<Shell />` | idem | 1 teste |
| 25.5.8 | Configurar `jsxImportSource: "preact"` em `deno.jsonc` (se necessário) | idem | `deno check` |

---

### 25.6 — BeerCSS setup

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.6.1 | Baixar/copiar `beercss.min.css` para `packages/ui/public/` | idem | arquivo existe |
| 25.6.2 | Criar `packages/ui/src/styles/app.css` com overrides mínimos | idem | arquivo existe |
| 25.6.3 | Copiar `tjreport.css` de `docs/taskjuggler/data/css/tjreport.css` | idem | arquivo existe |
| 25.6.4 | Adicionar Material Symbols em `index.html` | idem | 1 teste |
| 25.6.5 | Teste: classes BeerCSS aplicam estilo | idem | 1 teste |

---

### 25.7 — Theme system

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.7.1 | Criar `packages/ui/src/theme/theme.ts` com `type Theme = 'light' \| 'dark' \| 'auto'` | idem | `deno check` |
| 25.7.2 | Criar `packages/ui/src/theme/theme-signal.ts` com `themeSignal` | idem | 2 testes |
| 25.7.3 | Implementar `applyTheme(theme)` com `data-theme` no `<html>` | idem | 3 testes |
| 25.7.4 | Implementar `resolveTheme(theme)` (auto → matchMedia) | idem | 3 testes |
| 25.7.5 | Escutar mudanças em `prefers-color-scheme` | idem | 1 teste |
| 25.7.6 | Persistir `themeSignal` via `SettingsService` | idem | 2 testes |
| 25.7.7 | Criar `packages/ui/tests/theme/theme_test.ts` com 5 testes | idem | verde |
| 25.7.8 | Teste: alterna light ↔ dark | idem | 1 teste |

---

## Bloco C — Worker + Serviços

### 25.8 — `engine.worker.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.8.1 | Criar `packages/ui/src/workers/engine-protocol.ts` com tipos `Request`/`Response` | idem | `deno check` |
| 25.8.2 | `type Request = { id, method, args }` | idem | `deno check` |
| 25.8.3 | `type Response = { id, ok, result?, error? }` | idem | `deno check` |
| 25.8.4 | Criar `packages/ui/src/workers/engine.worker.ts` | idem | `deno check` |
| 25.8.5 | Escutar `self.onmessage` | idem | 1 teste |
| 25.8.6 | Implementar método `parse` (chama `ProjectFileParser`) | idem | 2 testes |
| 25.8.7 | Implementar método `schedule` (chama `TaskJuggler.schedule`) | idem | 2 testes |
| 25.8.8 | Implementar método `report` (chama `Report.generate`) | idem | 2 testes |
| 25.8.9 | Encapsular erro em `Response` | idem | 1 teste |
| 25.8.10 | Criar `packages/ui/tests/workers/engine-worker_test.ts` | idem | 3 testes |
| 25.8.11 | Teste: `parse` projeto minimal | idem | 1 teste |
| 25.8.12 | Teste: `schedule` projeto | idem | 1 teste |

---

### 25.9 — `engine-client.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.9.1 | Criar `packages/ui/src/workers/engine-client.ts` | idem | `deno check` |
| 25.9.2 | Classe `EngineClient` com `worker`, `pending`, `nextId` | idem | `deno check` |
| 25.9.3 | Implementar `parse(content): Promise<{ ast, diagnostics }>` | idem | 2 testes |
| 25.9.4 | Implementar `schedule(project): Promise<Project>` | idem | 2 testes |
| 25.9.5 | Implementar `report(id, project, format): Promise<string>` | idem | 2 testes |
| 25.9.6 | Implementar `terminate()` | idem | 1 teste |
| 25.9.7 | Teste: `terminate` libera recursos | idem | 1 teste |
| 25.9.8 | Criar `packages/ui/tests/workers/engine-client_test.ts` | idem | verde |

---

### 25.10 — `parser-service.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.10.1 | Criar `packages/ui/src/services/parser-service.ts` | idem | `deno check` |
| 25.10.2 | Classe `ParserService` com `EngineClient` injetado | idem | 2 testes |
| 25.10.3 | Implementar `parse(content, locale): Promise<{ ast, diagnostics }>` | idem | 2 testes |
| 25.10.4 | Debounce 300ms | idem | 2 testes |
| 25.10.5 | Populate `parserDiagnosticsSignal` | idem | 1 teste |
| 25.10.6 | Criar `packages/ui/tests/services/parser-service_test.ts` | idem | verde |

---

### 25.11 — `scheduler-service.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.11.1 | Criar `packages/ui/src/services/scheduler-service.ts` | idem | `deno check` |
| 25.11.2 | Classe `SchedulerService` com `EngineClient` injetado | idem | 2 testes |
| 25.11.3 | Implementar `schedule(project): Promise<Project>` | idem | 2 testes |
| 25.11.4 | Populate `scheduledProjectSignal` | idem | 1 teste |
| 25.11.5 | Criar `packages/ui/tests/services/scheduler-service_test.ts` | idem | verde |

---

### 25.12 — `report-service.ts` + `storage-service.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.12.1 | Criar `packages/ui/src/services/report-service.ts` | idem | `deno check` |
| 25.12.2 | Implementar `generate(reportId, project, format): Promise<string>` | idem | 2 testes |
| 25.12.3 | Criar `packages/ui/src/services/storage-service.ts` | idem | `deno check` |
| 25.12.4 | Encapsular `ProjectService`, `Autosave`, `Recovery`, `ImportExport`, `SettingsService` | idem | `deno check` |
| 25.12.5 | Inicializar `WorkerDbClient` (Fase 19) | idem | 1 teste |
| 25.12.6 | Implementar `listProjects(): Promise<ProjectMeta[]>` | idem | 2 testes |
| 25.12.7 | Implementar `createProject(name, content): Promise<string>` | idem | 2 testes |
| 25.12.8 | Criar `packages/ui/tests/services/report-service_test.ts` | idem | 2 testes |
| 25.12.9 | Criar `packages/ui/tests/services/storage-service_test.ts` | idem | 2 testes |
| 25.12.10 | Teste: `generate` retorna HTML | idem | 1 teste |

---

## Bloco D — Signals

### 25.13 — Estrutura de Signals

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.13.1 | Criar `packages/ui/src/signals/ui.ts` | idem | `deno check` |
| 25.13.2 | Adicionar `themeSignal`, `sidebarOpenSignal`, `modalSignal`, `toastSignal`, `loadingSignal` | idem | 3 testes |
| 25.13.3 | Criar `packages/ui/src/signals/project.ts` | idem | `deno check` |
| 25.13.4 | Adicionar `projectsSignal`, `currentProjectIdSignal`, `currentProjectContentSignal`, `currentProjectMetaSignal`, `isDirtySignal` | idem | 3 testes |
| 25.13.5 | Criar `packages/ui/src/signals/editor.ts` com `cursorSignal`, `undoStackSignal`, `redoStackSignal` | idem | 2 testes |
| 25.13.6 | Criar `packages/ui/src/signals/parser.ts` com `parserDiagnosticsSignal` | idem | 1 teste |
| 25.13.7 | Criar `packages/ui/src/signals/report.ts` com `reportFormatSignal`, `reportContentSignal`, `reportLoadingSignal` | idem | 2 testes |
| 25.13.8 | Criar `packages/ui/src/signals/settings.ts` com `settingsSignal` | idem | 1 teste |
| 25.13.9 | Criar `packages/ui/src/signals/index.ts` re-exportando todos | idem | `deno check` |
| 25.13.10 | Criar `packages/ui/tests/signals/signals_test.ts` | idem | `deno check` |
| 25.13.11 | Teste: signals são writable | idem | 1 teste |
| 25.13.12 | Teste: `isDirtySignal` (computed) | idem | 1 teste |
| 25.13.13 | Teste: `loadingSignal` | idem | 1 teste |
| 25.13.14 | Teste: `toastSignal` | idem | 1 teste |

---

## Bloco E — Componentes base

### 25.14 — `Toolbar`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.14.1 | Criar `packages/ui/src/components/Toolbar.tsx` | idem | `deno check` |
| 25.14.2 | Renderizar logo + nome | idem | 1 teste |
| 25.14.3 | Botões: "Novo", "Salvar", "Agendar", "Relatório", "Configurações" | idem | 2 testes |
| 25.14.4 | Integrar `LanguageSelector` | idem | 1 teste |
| 25.14.5 | Toggle de tema | idem | 1 teste |
| 25.14.6 | Criar `packages/ui/tests/components/Toolbar_test.tsx` | idem | 2 testes |

---

### 25.15 — `Sidebar` + `ProjectExplorer`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.15.1 | Criar `packages/ui/src/components/Sidebar.tsx` | idem | `deno check` |
| 25.15.2 | Menu: Projetos, Editor, Relatórios, Gantt, Configurações | idem | 1 teste |
| 25.15.3 | Criar `packages/ui/src/components/ProjectTree.tsx` | idem | `deno check` |
| 25.15.4 | Listar `projectsSignal` | idem | 2 testes |
| 25.15.5 | Botão "Novo projeto" | idem | 1 teste |
| 25.15.6 | Context menu: renomear, duplicar, remover | idem | 2 testes |
| 25.15.7 | Clique carrega projeto | idem | 2 testes |
| 25.15.8 | Criar `packages/ui/tests/components/Sidebar_test.tsx` | idem | verde |
| 25.15.9 | Teste: renderiza menu | idem | 1 teste |
| 25.15.10 | Teste: clique carrega projeto | idem | 1 teste |

---

### 25.16 — `StatusBar` + `ErrorList`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.16.1 | Criar `packages/ui/src/components/StatusBar.tsx` | idem | `deno check` |
| 25.16.2 | Mostrar cursor (linha/col) | idem | 2 testes |
| 25.16.3 | Mostrar locale, dirty, status do parser | idem | 2 testes |
| 25.16.4 | Criar `packages/ui/src/components/ErrorList.tsx` | idem | `deno check` |
| 25.16.5 | Listar `parserDiagnosticsSignal` | idem | 2 testes |
| 25.16.6 | Ícone por severidade | idem | 1 teste |
| 25.16.7 | Clique navega para linha | idem | 1 teste |
| 25.16.8 | Criar `packages/ui/tests/components/StatusBar_test.tsx` | idem | verde |

---

### 25.17 — `LanguageSelector`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.17.1 | Criar `packages/ui/src/components/LanguageSelector.tsx` | idem | `deno check` |
| 25.17.2 | Dropdown com `en`, `pt-BR`, `es` | idem | 2 testes |
| 25.17.3 | Atualiza `settingsSignal` + `SettingsService` | idem | 2 testes |
| 25.17.4 | Criar `packages/ui/tests/components/LanguageSelector_test.tsx` | idem | verde |

---

## Bloco F — Views

### 25.18 — `Shell`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.18.1 | Criar `packages/ui/src/views/Shell.tsx` | idem | `deno check` |
| 25.18.2 | Layout: `Toolbar` (topo) + `Sidebar` (esquerda) + `<main>` + `StatusBar` | idem | 1 teste |
| 25.18.3 | Rotas por hash: `#/projects`, `#/editor`, `#/report`, `#/gantt`, `#/settings` | idem | 3 testes |
| 25.18.4 | Modal + toast containers | idem | 2 testes |
| 25.18.5 | Criar `packages/ui/tests/views/Shell_test.tsx` | idem | 2 testes |
| 25.18.6 | Teste: renderiza Toolbar | idem | 1 teste |
| 25.18.7 | Teste: renderiza Sidebar | idem | 1 teste |
| 25.18.8 | Teste: navegação por hash | idem | 1 teste |

---

### 25.19 — `ProjectExplorerView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.19.1 | Criar `packages/ui/src/views/ProjectExplorerView.tsx` | idem | `deno check` |
| 25.19.2 | Grid de cards (BeerCSS) | idem | 1 teste |
| 25.19.3 | Botão "Novo projeto" | idem | 1 teste |
| 25.19.4 | Ações: abrir, renomear, duplicar, remover | idem | 2 testes |
| 25.19.5 | Import `.tjp` (drag-and-drop) | idem | 1 teste |
| 25.19.6 | Criar `packages/ui/tests/views/ProjectExplorerView_test.tsx` | idem | 2 testes |

---

### 25.20 — `EditorView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.20.1 | Criar `packages/ui/src/editor/editor.ts` | idem | `deno check` |
| 25.20.2 | Criar `packages/ui/src/views/EditorView.tsx` | idem | `deno check` |
| 25.20.3 | `<textarea>` controlado por `currentProjectContentSignal` | idem | 2 testes |
| 25.20.4 | Syntax highlight básico (overlay `<pre>`) | idem | 3 testes |
| 25.20.5 | Debounce → `parser-service.parse` | idem | 2 testes |
| 25.20.6 | Autosave debounced → `storage-service` | idem | 2 testes |
| 25.20.7 | Undo/Redo (Ctrl+Z / Ctrl+Y) | idem | 2 testes |
| 25.20.8 | Navegação por erro (clique em ErrorList) | idem | 1 teste |
| 25.20.9 | Criar `packages/ui/tests/views/EditorView_test.tsx` | idem | verde |
| 25.20.10 | Teste: renderiza textarea | idem | 1 teste |
| 25.20.11 | Teste: digitação atualiza signal | idem | 1 teste |
| 25.20.12 | Teste: debounce dispara parser | idem | 1 teste |

---

### 25.21 — `GanttView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.21.1 | Criar `packages/ui/src/views/GanttView.tsx` | idem | `deno check` |
| 25.21.2 | Botão "Agendar" (chama `scheduler-service.schedule`) | idem | 2 testes |
| 25.21.3 | Gerar report com coluna `chart` | idem | 1 teste |
| 25.21.4 | Renderizar HTML em `<div>` com CSS `tjreport.css` | idem | 2 testes |
| 25.21.5 | Zoom (hour, day, week, month, quarter, year) | idem | 3 testes |
| 25.21.6 | Criar `packages/ui/src/styles/gantt.css` (se necessário) | idem | arquivo existe |
| 25.21.7 | Criar `packages/ui/tests/views/GanttView_test.tsx` | idem | verde |
| 25.21.8 | Teste: `zoom` muda escala | idem | 1 teste |

---

### 25.22 — `ReportView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.22.1 | Criar `packages/ui/src/views/ReportView.tsx` | idem | `deno check` |
| 25.22.2 | Dropdown de report (taskreport, resourcereport, etc.) | idem | 2 testes |
| 25.22.3 | Dropdown de formato (html, csv) | idem | 1 teste |
| 25.22.4 | `<iframe sandbox="allow-same-origin">` renderiza HTML | idem | 2 testes |
| 25.22.5 | Botão "Baixar CSV" | idem | 1 teste |
| 25.22.6 | Criar `packages/ui/tests/views/ReportView_test.tsx` | idem | verde |
| 25.22.7 | Teste: renderiza iframe | idem | 1 teste |
| 25.22.8 | Teste: download csv | idem | 1 teste |

---

### 25.23 — `SettingsView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.23.1 | Criar `packages/ui/src/views/SettingsView.tsx` | idem | `deno check` |
| 25.23.2 | Tema (light/dark/auto) | idem | 2 testes |
| 25.23.3 | Locale da UI | idem | 2 testes |
| 25.23.4 | Autosave ms | idem | 1 teste |
| 25.23.5 | Font size | idem | 1 teste |
| 25.23.6 | Botão "Reset" | idem | 1 teste |
| 25.23.7 | Exportar/Importar projeto (JSON) | idem | 1 teste |
| 25.23.8 | Criar `packages/ui/tests/views/SettingsView_test.tsx` | idem | 2 testes |

---

### 25.24 — `SheetsView`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.24.1 | Criar `packages/ui/src/views/SheetsView.tsx` | idem | `deno check` |
| 25.24.2 | Botão "Gerar templates" (chama `TimeSheetSender`) | idem | 2 testes |
| 25.24.3 | Lista de templates | idem | 1 teste |
| 25.24.4 | Botão "Baixar" por template | idem | 1 teste |
| 25.24.5 | Área de drop para upload de `.tji` | idem | 2 testes |
| 25.24.6 | Chama `TaskJuggler.checkTimeSheet` | idem | 1 teste |
| 25.24.7 | Mostra resultado | idem | 1 teste |
| 25.24.8 | Criar `packages/ui/tests/views/SheetsView_test.tsx` | idem | verde |

---

## Bloco G — i18n UI

### 25.25 — Catálogo de mensagens da UI

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.25.1 | Criar `packages/ui/src/i18n/types.ts` com `MessageKey` | idem | `deno check` |
| 25.25.2 | Criar `packages/ui/src/i18n/en.ts` | idem | `deno check` |
| 25.25.3 | Criar `packages/ui/src/i18n/pt-BR.ts` | idem | `deno check` |
| 25.25.4 | Criar `packages/ui/src/i18n/es.ts` | idem | `deno check` |
| 25.25.5 | Criar `packages/ui/src/i18n/i18n.ts` com `t(key, params?)` | idem | 3 testes |
| 25.25.6 | Implementar `i18nSignal` | idem | 2 testes |
| 25.25.7 | Criar `packages/ui/tests/i18n/i18n_test.ts` | idem | verde |
| 25.25.8 | Teste: fallback para en | idem | 1 teste |

---

## Bloco H — Integração e testes

### 25.26 — Integração end-to-end

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.26.1 | Criar `packages/ui/tests/integration/create-project_test.tsx` | idem | verde |
| 25.26.2 | Criar `packages/ui/tests/integration/editor-parse_test.tsx` | idem | verde |
| 25.26.3 | Criar `packages/ui/tests/integration/schedule-report_test.tsx` | idem | verde |
| 25.26.4 | Criar `packages/ui/tests/integration/sheets-upload_test.tsx` | idem | verde |
| 25.26.5 | Criar `packages/ui/tests/integration/i18n_test.tsx` | idem | verde |
| 25.26.6 | Criar `packages/ui/tests/integration/theme_test.tsx` | idem | verde |
| 25.26.7 | Teste: criar projeto → editar → salvar → reabrir | idem | 1 teste |
| 25.26.8 | Teste: importar `.tjp` → parse → schedule → report | idem | 1 teste |
| 25.26.9 | Teste: gerar template de time sheet → baixar → upload → validar | idem | 1 teste |
| 25.26.10 | Teste: trocar locale → UI traduz | idem | 1 teste |
| 25.26.11 | Teste: trocar tema → CSS muda | idem | 1 teste |
| 25.26.12 | Cobertura ≥ 20 testes E2E | idem | verde |

---

### 25.27 — Performance e acessibilidade

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.27.1 | Criar `packages/ui/tests/performance/parse_test.ts` | idem | verde |
| 25.27.2 | Teste: parsing < 200ms em MWE | idem | 1 teste |
| 25.27.3 | Teste: render Gantt < 1s em projeto médio | idem | 1 teste |
| 25.27.4 | Teste: autosave < 100ms | idem | 1 teste |
| 25.27.5 | Criar `packages/ui/tests/a11y/a11y_test.ts` | idem | verde |
| 25.27.6 | Teste: contraste WCAG AA | idem | 1 teste |
| 25.27.7 | Teste: tab navigation | idem | 1 teste |
| 25.27.8 | Teste: ARIA labels | idem | 1 teste |

---

### 25.28 — Build e deploy

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 25.28.1 | Atualizar `esbuild.ts` para bundle UI + Service Worker | idem | `deno check` |
| 25.28.2 | Copiar `public/` para `dist/` | idem | 1 teste |
| 25.28.3 | Minificar JS + CSS | idem | 1 teste |
| 25.28.4 | Configurar deploy (GitHub Pages / Cloudflare Pages) | idem | 1 teste |
| 25.28.5 | Adicionar `.github/workflows/deploy.yml` (opcional) | idem | arquivo existe |
| 25.28.6 | Adicionar task `build:prod` em `deno.jsonc` | idem | `deno task --list` |
| 25.28.7 | Teste: `dist/` gera e funciona | idem | 1 teste |
| 25.28.8 | Teste: smoke E2E em `dist/` | idem | 1 teste |

---

## Bloco I — Verificação final

### 25.29 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 25.29.1 | `deno task check-all` verde | exit 0 |
| 25.29.2 | `deno task test` verde (unit) | exit 0 |
| 25.29.3 | `deno task test:e2e` verde (integração) | exit 0 |
| 25.29.4 | ADR 032 criada e commitada | git log |
| 25.29.5 | Todos os serviços exportados em `packages/ui/mod.ts` | `deno check` |
| 25.29.6 | `tests/integration/smoke_after_phase_20_test.ts` — cria projeto, edita, salva, gera Gantt; verifica Fase 19 (`ProjectService`) | 1 teste |
| 25.29.7 | Lighthouse ≥ 90 (PWA, Performance, Accessibility, Best Practices) | relatório |
| 25.29.8 | Auditoria: cada subfase do plano `fase-20-pwa-ui.md` tem tarefas correspondentes | grep |

---

## Notas para a IA

1. **Ordem:** 25.0 → 25.1 → ... → 25.28 → 25.29.
2. **UI consome serviços, nunca Core diretamente.**
3. **UI não toca IndexedDB/OPFS.** Sempre via `@syntaxmesh/storage`.
4. **UI não executa parser/scheduler na main thread.** Sempre via Worker.
5. **Preact + Signals + BeerCSS.** Não introduzir outros frameworks.
6. **Editor básico.** Sem CodeMirror/Monaco.
7. **GanttView** usa HTML da Fase 15 + `tjreport.css`.
8. **ReportView** com `<iframe sandbox>`.
9. **i18n de UI separado de i18n de keywords.**
10. **Theme via `data-theme` do BeerCSS.**
11. **Service Worker com `CACHE_VERSION`.**
12. **Signals por domínio** (`ui`, `project`, `editor`, `parser`, `report`, `settings`).
13. **Debounce**: parser 300ms; autosave 500ms.
14. **Download/upload de `.tji`** em `SheetsView`.
15. **Sem `any`.** Use `unknown` + narrowing.
16. **Commit por subfase.** `feat(ui): toolbar`, etc.
17. **Testes**: Vitest-like para unit; Playwright-like para E2E (adaptar).
18. **Lighthouse ≥ 90** é o critério final.

---

## ADR 032 (referência rápida)

Criado como subfase 25.0. Conteúdo esperado:

- **Título:** PWA + UI stack
- **Contexto:** browser-only; offline; sem backend.
- **Decisões:**
  - Preact + Signals + BeerCSS.
  - Web Worker obrigatório.
  - Service Worker precache + network-first.
  - Hospedagem estática.
- **Alternativas:** React, Vue, Svelte, CodeMirror, Monaco.
- **Consequências:** leve, offline; editor básico.

---

**Fim do arquivo de tarefas da Fase 20.**