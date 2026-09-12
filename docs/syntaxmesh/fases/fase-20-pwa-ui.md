# Fase 20 — PWA + UI

> **Arquivo:** `docs/syntaxmesh/fases/fase-20-pwa-ui.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 15–20 dias
> **Depende de:** Fases 1–19
> **Bloqueia:** Fase 21

---

## 1. Contexto

Esta é a fase que dá **interface ao usuário**. Ela transforma o motor (Fases 2–19) em uma aplicação utilizável no browser, offline, instalável como PWA.

### Arquitetura

```
Browser (PWA)
   ↓
@  syntaxmesh/ui       ← ESTA FASE (Preact + Signals + BeerCSS)
   ↓
@syntaxmesh/storage    ← Fase 19
@syntaxmesh/core       ← Fases 2–9, 11, 16
@syntaxmesh/parser     ← Fase 10
@syntaxmesh/richtext   ← Fase 12
@syntaxmesh/markdown   ← Fase 13
@syntaxmesh/report     ← Fases 14, 15
@syntaxmesh/worker-db  ← Fase 1 (já pronto)
@syntaxmesh/service-worker ← ESTA FASE
```

### Princípios (Fase 1)

- **UI consome serviços, não Core diretamente.**
- **Trabalho pesado em Web Worker** (`engine.worker.ts`) para não travar a UI.
- **Preact + Signals** (reatividade leve).
- **BeerCSS** (material design puro CSS).
- **PWA offline** com Service Worker.

### Fluxo do usuário

```
Abrir app
   ↓
[IndexedDB/OPFS] → lista de projetos
   ↓
Selecionar projeto
   ↓
[Editor] mostra `.tjp`
   ↓
Usuário edita
   ↓
[Debounce 500ms] → parser (Worker) → AST → Core → Scheduler (Worker)
   ↓
[ReportView / GanttView] renderiza
   ↓
[Autosave] salva em OPFS
```

### O que NÃO está nesta fase

- Fase 18 (Time/Status Sheets): UI de download/upload fica aqui.
- Fase 19 (Storage): consumido via `ProjectService`.

### Regras

- **UI não contém lógica de negócio.** Toda lógica está em Core/Parser/Report.
- **UI não toca IndexedDB/OPFS diretamente.** Sempre via `@syntaxmesh/storage`.
- **UI não executa parser/scheduler na main thread.** Sempre via Worker.
- **Core não é importado pela UI diretamente**, apenas via `services/`.

---

## 2. Objetivo

Ao final desta fase:

- **PWA instalável** com `manifest.json` + Service Worker + offline.
- **Shell** com layout, toolbar, sidebar, statusbar.
- **Editor** de `.tjp` (com syntax highlight básico).
- **ProjectExplorer** (lista/cria/duplica/remove projetos).
- **ReportView** (renderiza relatórios HTML).
- **GanttView** (renderiza Gantt).
- **ErrorList** (feedback do parser com localização).
- **SettingsView** (locale, tema, autosave).
- **LanguageSelector** (en, pt-BR, es).
- **Theme system** (light/dark/auto).
- **Web Worker** (`engine.worker.ts`) executa parser + scheduler.
- **Serviços** (`engine-service`, `parser-service`, `scheduler-service`, `report-service`, `storage-service`).
- **Signals** centralizando estado da UI.
- **UI de download/upload** de `.tji` (Fase 18).
- **≥ 120 testes unitários** (componentes + serviços) + **≥ 20 testes E2E** (Playwright ou similar).
- ADR 032 registrado.
- `deno task check-all` verde.

---

## 3. Referências

### 3.1 Stack

- **Preact** — 3 KB, compatível com React API.
- **@preact/signals** — reatividade granular.
- **BeerCSS** — framework CSS material design.
- **Service Worker API** — cache + offline.

### 3.2 Sem referência TaskJuggler

TaskJuggler é CLI. Esta fase é **específica do SyntaxMesh**.

### 3.3 Documentos de referência

- `docs/syntaxmesh/03-arquitetura.md` — seção App.
- `docs/syntaxmesh/decisoes/002-parser-isolado-da-logica-de-ui.md`.
- `docs/syntaxmesh/decisoes/005-typescript-deno-browser-only.md`.
- `docs/BeerCSS/` — guia de uso.
- `docs/syntaxmesh/09-regras-para-ia.md`.

---

## 4. Decisões de port

### 4.1 Preact + Signals

Preact é leve e compatível com React. Signals são reativos e granulares.

```tsx
import { signal, computed } from "@preact/signals";

export const currentProjectId = signal<string | null>(null);
export const projectContent = signal<string>("");
export const isDirty = computed(() => /* ... */);
```

### 4.2 BeerCSS

BeerCSS fornece classes material design. Sem JS extra. UI usa `class="beer-class"`.

Ex:
```tsx
<div class="card">
  <h5>Meu Projeto</h5>
  <button class="button">Salvar</button>
</div>
```

### 4.3 Web Worker obrigatório

Parser + scheduler rodam em `engine.worker.ts`. UI envia requests via `engine-client.ts`.

**Mensagens:**
- `parse { content }` → `{ ast, diagnostics }`.
- `schedule { project }` → `{ scheduledProject }`.
- `report { id, project, format }` → `{ content }`.

**Protocolo:** similar ao `worker-db`.

### 4.4 Serviços como adaptadores

UI consome serviços, não Core diretamente.

```
services/
├── engine-service.ts      (coordena parser + scheduler + reports)
├── parser-service.ts      (fala com engine.worker)
├── scheduler-service.ts   (fala com engine.worker)
├── report-service.ts      (fala com engine.worker)
└── storage-service.ts     (fala com @syntaxmesh/storage)
```

### 4.5 Signals estruturados

`signals/` agrupa por domínio:

- `ui.ts` — tema, sidebar, modal, toast.
- `project.ts` — projeto atual, conteúdo, metadados, dirty.
- `editor.ts` — seleção, cursor, undo/redo.
- `parser.ts` — diagnostics.
- `report.ts` — relatório atual, formato, zoom.
- `settings.ts` — locale, autosaveMs, tema.

### 4.6 Service Worker

Estratégia de cache:
- **Precache**: shell + ícones + CSS + JS bundle.
- **Runtime cache**: `.tjp`/`.tji` (não usados via fetch; ficam em OPFS).
- **Network-first** para atualizações do shell.

Versão do SW: `v1` (incrementa por release).

### 4.7 Manifest

`public/manifest.json`:
```json
{
  "name": "SyntaxMesh",
  "short_name": "SyntaxMesh",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1a1a1a",
  "background_color": "#ffffff",
  "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }, ...]
}
```

### 4.8 Editor

Editor **básico** com `<textarea>` + syntax highlight via overlay.

**Não** usar CodeMirror/Monaco nesta fase (peso). Futuro: Monaco se necessário.

Syntax highlight via `<pre>` com regex simples + overlay.

### 4.9 GanttView

Renderiza o HTML do Gantt (Fase 15) em um `<div>` isolado.

**Nota:** HTML do Gantt usa CSS classes do TaskJuggler. Precisamos incluir `tjreport.css` como asset estático em `public/css/`.

### 4.10 ReportView

Renderiza HTML do report em `<iframe>` sandbox ou `<div>` sanitizado.

**Decisão:** `<iframe sandbox="allow-same-origin">` para isolamento.

### 4.11 Download/Upload de `.tji` (Fase 18)

UI fornece:
- Botão "Baixar template" (para cada recurso).
- Área de drop para upload de `.tji`.
- Feedback do parser + `checkTimeSheet`.

### 4.12 Feedback do parser

`ErrorList` mostra diagnostics (severidade, mensagem, localização). Clique navega para linha no editor.

### 4.13 Theme

Detecção automática via `prefers-color-scheme`. Override manual salvo em Settings.

BeerCSS suporta `data-theme="dark"`.

### 4.14 Responsividade

BeerCSS é responsivo por padrão. Layout adapta em 3 breakpoints: mobile (< 768px), tablet (768–1024px), desktop (> 1024px).

### 4.15 Auto-update

Service Worker detecta nova versão e mostra toast "Nova versão disponível. Recarregar?".

### 4.16 Sem backend

Tudo funciona offline. Hospedagem estática (GitHub Pages, Cloudflare Pages).

### 4.17 i18n de UI

Separado do i18n de keywords (Fase 10). Catálogo próprio:
- `packages/ui/src/i18n/en.ts`
- `packages/ui/src/i18n/pt-BR.ts`
- `packages/ui/src/i18n/es.ts`

### 4.18 Estado vindo do Storage

Ao abrir, `ProjectService.list()` popula `projectsSignal`. Selecionar carrega conteúdo.

### 4.19 Undo/Redo

Histórico em `editor.ts` (stack de snapshots do conteúdo). Ctrl+Z / Ctrl+Y.

### 4.20 Testes

- **Componentes**: Vitest + `@testing-library/preact`.
- **Serviços**: Vitest com mocks.
- **E2E**: Playwright (browser real).

---

## 5. Subfases detalhadas

**Bloco A — PWA Base** (25.0–25.4)
**Bloco B — Stack UI** (25.5–25.7)
**Bloco C — Worker + Serviços** (25.8–25.12)
**Bloco D — Signals** (25.13)
**Bloco E — Componentes base** (25.14–25.17)
**Bloco F — Views** (25.18–25.24)
**Bloco G — i18n UI** (25.25)
**Bloco H — Integração e testes** (25.26–25.28)

---

### Bloco A — PWA Base

---

### 20.0 — ADR 032 (PWA + UI stack)

#### Contexto

O SyntaxMesh é browser-only (ADR 005). Precisa de:
- PWA offline.
- UI leve (Preact).
- Reatividade granular (Signals).
- CSS material (BeerCSS).
- Web Worker para não travar main thread.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/032-pwa-ui-stack.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/032-pwa-ui-stack.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** browser-only; requisitos de UI + offline.
- [ ] **Decisões:**
  - Preact + Signals + BeerCSS.
  - Web Worker obrigatório para parser/scheduler.
  - Service Worker com cache precache + network-first.
  - Hospedagem estática.
- [ ] **Alternativas:** React, Vue, Svelte, CodeMirror, Monaco.
- [ ] **Consequências:** leve, offline, sem backend; limites do editor básico.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- ADR 005, ADR 002, ADR 001.

#### Critério de aceite

- ADR 032 criado.

---

### 20.1 — `manifest.json` + ícones

#### Contexto

PWA precisa de manifest e ícones.

#### Objetivo

Criar manifest + gerar ícones.

#### Arquivos

- `packages/ui/public/manifest.json`
- `packages/ui/public/icons/icon-192.png`
- `packages/ui/public/icons/icon-512.png`
- `packages/ui/public/icons/maskable-512.png`
- `packages/ui/public/favicon.ico`
- `packages/ui/tests/public/manifest_test.ts`

#### Requisitos

- [ ] `manifest.json` com:
  - `name`, `short_name`, `start_url`, `display: standalone`.
  - `theme_color`, `background_color`.
  - `icons` (192, 512, maskable).
  - `categories: ["productivity", "business"]`.
  - `scope: "/"`.
- [ ] Ícones em PNG (192×192, 512×512, maskable 512×512).
- [ ] `favicon.ico`.

#### Critério de aceite

- `manifest.json` válido (Lighthouse PWA).

#### Testes

- `manifest_test.ts`:
  - `it("manifest é JSON válido")`.
  - `it("contém icons")`.
  - `it("start_url /")`.

---

### 20.2 — Service Worker

#### Contexto

Service Worker para cache e offline.

#### Objetivo

Implementar.

#### Arquivos

- `packages/service-worker/src/sw.ts`
- `packages/service-worker/src/cache-strategies.ts`
- `packages/service-worker/tests/cache-strategies_test.ts`
- `packages/service-worker/mod.ts`

#### Requisitos

- [ ] `sw.ts`:
  - `self.addEventListener('install', ...)`:
    - Precache: shell HTML, CSS, JS bundle, ícones.
    - `skipWaiting()`.
  - `self.addEventListener('activate', ...)`:
    - Limpa caches antigos.
    - `clients.claim()`.
  - `self.addEventListener('fetch', ...)`:
    - Shell (HTML, CSS, JS): network-first, fallback cache.
    - Assets estáticos (ícones, fontes): cache-first.
    - Navegação SPA: serve `index.html` do cache.
- [ ] `cache-strategies.ts`:
  - `precache(urls): Promise<void>`.
  - `networkFirst(request): Promise<Response>`.
  - `cacheFirst(request): Promise<Response>`.
  - `staleWhileRevalidate(request): Promise<Response>`.
- [ ] `CACHE_VERSION = 'v1'`.

#### Referências

- Service Worker API.

#### Critério de aceite

- App funciona offline após primeira visita.

#### Testes

- `cache-strategies_test.ts`:
  - `it("precache")`.
  - `it("networkFirst com rede")`.
  - `it("networkFirst sem rede usa cache")`.
  - `it("cacheFirst")`.

---

### 20.3 — Registro do SW + auto-update

#### Contexto

Registrar SW e detectar atualizações.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/pwa/sw-register.ts`
- `packages/ui/src/pwa/update-toast.tsx`
- `packages/ui/tests/pwa/sw-register_test.ts`

#### Requisitos

- [ ] `registerServiceWorker(): Promise<void>`:
  - `navigator.serviceWorker.register('/sw.js')`.
  - Escuta `updatefound`.
  - Mostra toast se nova versão disponível.
- [ ] `UpdateToast` (componente Preact):
  - Botão "Recarregar".
  - Botão "Depois".

#### Critério de aceite

- Atualização detectada + toast exibido.

#### Testes

- `sw-register_test.ts`:
  - `it("register chama navigator.serviceWorker.register")`.
  - `it("updatefound dispara callback")`.

---

### 20.4 — `index.html` + shell offline

#### Contexto

Página base + shell offline.

#### Objetivo

Criar.

#### Arquivos

- `packages/ui/public/index.html`
- `packages/ui/public/offline.html`
- `packages/ui/tests/public/index_test.ts`

#### Requisitos

- [ ] `index.html`:
  - `<meta name="viewport">`.
  - `<link rel="manifest">`.
  - `<link rel="stylesheet" href="beercss.min.css">`.
  - `<link rel="stylesheet" href="tjreport.css">`.
  - `<div id="app"></div>`.
  - `<script type="module" src="main.js"></script>`.
- [ ] `offline.html` (fallback).

#### Critério de aceite

- `index.html` carrega com BeerCSS + shell.

#### Testes

- `index_test.ts`:
  - `it("contém manifest link")`.
  - `it("contém div#app")`.

---

### Bloco B — Stack UI

---

### 20.5 — Preact + Signals setup

#### Contexto

Configurar Preact + Signals.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/deno.jsonc` (deps)
- `packages/ui/src/main.tsx`
- `packages/ui/src/app.tsx`
- `packages/ui/tests/app_test.tsx`

#### Requisitos

- [ ] Deps: `preact`, `@preact/signals`, `preact-render-to-string` (testes).
- [ ] `main.tsx`:
  - `render(<App />, document.getElementById('app'))`.
  - `registerServiceWorker()`.
- [ ] `app.tsx`:
  - `Shell` (layout).
  - Rotas simples (baseado em `location.hash`).
  - Providers de Signals.

#### Critério de aceite

- App monta.

#### Testes

- `app_test.tsx`:
  - `it("renderiza Shell")`.

---

### 20.6 — BeerCSS setup

#### Contexto

BeerCSS como framework CSS.

#### Objetivo

Integrar.

#### Arquivos

- `packages/ui/public/beercss.min.css` (ou CDN)
- `packages/ui/src/styles/app.css`
- `packages/ui/src/styles/tjreport.css` (copiado do TaskJuggler)
- `docs/BeerCSS/` (referência)

#### Requisitos

- [ ] BeerCSS importado em `index.html`.
- [ ] `app.css` com overrides mínimos.
- [ ] `tjreport.css` copiado de `docs/taskjuggler/data/css/tjreport.css`.
- [ ] Ícones (`material-symbols`) disponíveis.

#### Critério de aceite

- Classes BeerCSS funcionam.

---

### 20.7 — Theme system

#### Contexto

Light/dark/auto.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/theme/theme.ts`
- `packages/ui/src/theme/theme-signal.ts`
- `packages/ui/tests/theme/theme_test.ts`

#### Requisitos

- [ ] `type Theme = 'light' | 'dark' | 'auto'`.
- [ ] `themeSignal` (signal).
- [ ] `applyTheme(theme)`:
  - `document.documentElement.setAttribute('data-theme', resolved)`.
- [ ] `resolveTheme(theme)`:
  - `auto` → `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`.
- [ ] Escuta mudanças em `prefers-color-scheme`.

#### Critério de aceite

- Alterna tema.

#### Testes

- `theme_test.ts`:
  - `it("resolveTheme light")`.
  - `it("resolveTheme dark")`.
  - `it("resolveTheme auto")`.
  - `it("applyTheme seta attribute")`.

---

### Bloco C — Worker + Serviços

---

### 20.8 — `engine.worker.ts`

#### Contexto

Worker que executa parser + scheduler + reports.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/workers/engine.worker.ts`
- `packages/ui/src/workers/engine-protocol.ts`
- `packages/ui/tests/workers/engine-worker_test.ts`

#### Requisitos

- [ ] `engine-protocol.ts`:
  - `type Request`:
    - `id: number`
    - `method: 'parse' | 'schedule' | 'report'`
    - `args: unknown[]`
  - `type Response`:
    - `id: number`
    - `ok: boolean`
    - `result?: unknown`
    - `error?: { name, message }`
- [ ] `engine.worker.ts`:
  - Escuta mensagens.
  - `parse`: chama `ProjectFileParser`.
  - `schedule`: chama `TaskJuggler.schedule`.
  - `report`: chama `Report.generate`.
  - Encapsula erro em `Response`.
- [ ] Worker importa Core, Parser, Report (todos browser-safe).

#### Critério de aceite

- `parse` retorna AST + diagnostics.

#### Testes

- `engine-worker_test.ts`:
  - `it("parse projeto minimal")`.
  - `it("schedule projeto")`.
  - `it("report formato html")`.

---

### 20.9 — `engine-client.ts`

#### Contexto

Wrapper que envia mensagens ao Worker.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/workers/engine-client.ts`
- `packages/ui/tests/workers/engine-client_test.ts`

#### Requisitos

- [ ] `class EngineClient`:
  - `private worker: Worker`
  - `private pending: Map<number, { resolve, reject }>`
  - `private nextId: number`
- [ ] Constructor.
- [ ] `parse(content): Promise<{ ast, diagnostics }>`.
- [ ] `schedule(project): Promise<Project>`.
- [ ] `report(id, project, format): Promise<string>`.
- [ ] `terminate()`.

#### Critério de aceite

- Cliente envia e recebe.

#### Testes

- `engine-client_test.ts`:
  - `it("parse")`.
  - `it("schedule")`.
  - `it("report")`.
  - `it("terminate")`.

---

### 20.10 — `parser-service.ts`

#### Contexto

Serviço de parsing.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/services/parser-service.ts`
- `packages/ui/tests/services/parser-service_test.ts`

#### Requisitos

- [ ] `class ParserService`:
  - `private client: EngineClient`
- [ ] `parse(content, locale): Promise<{ ast, diagnostics }>`.
- [ ] Debounce 300ms.
- [ ] Popula `parserDiagnosticsSignal`.

#### Critério de aceite

- Parsing debounced.

#### Testes

- `parser-service_test.ts`:
  - `it("parse")`.
  - `it("debounce")`.
  - `it("popula signal")`.

---

### 20.11 — `scheduler-service.ts`

#### Contexto

Serviço de scheduling.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/services/scheduler-service.ts`
- `packages/ui/tests/services/scheduler-service_test.ts`

#### Requisitos

- [ ] `class SchedulerService`:
  - `private client: EngineClient`
- [ ] `schedule(project): Promise<Project>`.
- [ ] Popula `scheduledProjectSignal`.

#### Critério de aceite

- Scheduling funciona.

#### Testes

- `scheduler-service_test.ts`:
  - `it("schedule")`.
  - `it("popula signal")`.

---

### 20.12 — `report-service.ts` + `storage-service.ts`

#### Contexto

Serviços de report e storage.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/services/report-service.ts`
- `packages/ui/src/services/storage-service.ts`
- `packages/ui/tests/services/report-service_test.ts`
- `packages/ui/tests/services/storage-service_test.ts`

#### Requisitos

**`ReportService`:**

- [ ] `generate(reportId, project, format): Promise<string>`.

**`StorageService`:**

- [ ] Encapsula `ProjectService`, `Autosave`, `Recovery`, `ImportExport`, `SettingsService`.
- [ ] Inicializa `WorkerDbClient` (Fase 19).

#### Critério de aceite

- Report e storage funcionam.

#### Testes

- `report-service_test.ts`:
  - `it("generate html")`.
  - `it("generate csv")`.
- `storage-service_test.ts`:
  - `it("list projetos")`.
  - `it("create projeto")`.

---

### Bloco D — Signals

---

### 20.13 — Estrutura de Signals

#### Contexto

Centralizar estado reativo.

#### Objetivo

Implementar todos os signals.

#### Arquivos

- `packages/ui/src/signals/ui.ts`
- `packages/ui/src/signals/project.ts`
- `packages/ui/src/signals/editor.ts`
- `packages/ui/src/signals/parser.ts`
- `packages/ui/src/signals/report.ts`
- `packages/ui/src/signals/settings.ts`
- `packages/ui/tests/signals/*.ts`

#### Requisitos

**`ui.ts`:**

- [ ] `themeSignal = signal<Theme>('auto')`.
- [ ] `sidebarOpenSignal = signal<boolean>(true)`.
- [ ] `modalSignal = signal<Modal | null>(null)`.
- [ ] `toastSignal = signal<Toast | null>(null)`.
- [ ] `loadingSignal = signal<boolean>(false)`.

**`project.ts`:**

- [ ] `projectsSignal = signal<ProjectMeta[]>([])`.
- [ ] `currentProjectIdSignal = signal<string | null>(null)`.
- [ ] `currentProjectContentSignal = signal<string>('')`.
- [ ] `currentProjectMetaSignal = signal<ProjectMeta | null>(null)`.
- [ ] `isDirtySignal = signal<boolean>(false)`.

**`editor.ts`:**

- [ ] `cursorSignal = signal<{ line, col }>({ line: 0, col: 0 })`.
- [ ] `undoStackSignal`, `redoStackSignal`.

**`parser.ts`:**

- [ ] `parserDiagnosticsSignal = signal<Diagnostic[]>([])`.

**`report.ts`:**

- [ ] `reportFormatSignal = signal<'html' | 'csv'>('html')`.
- [ ] `reportContentSignal = signal<string>('')`.
- [ ] `reportLoadingSignal = signal<boolean>(false)`.

**`settings.ts`:**

- [ ] `settingsSignal = signal<Settings | null>(null)`.

#### Critério de aceite

- Signals importáveis.

#### Testes

- `signals_test.ts`:
  - `it("signals são writable")`.
  - `it("isDirty computed")`.

---

### Bloco E — Componentes base

---

### 20.14 — `Toolbar`

#### Contexto

Barra superior.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/components/Toolbar.tsx`
- `packages/ui/tests/components/Toolbar_test.tsx`

#### Requisitos

- [ ] `<Toolbar />`:
  - Logo + nome.
  - Botão "Novo".
  - Botão "Salvar".
  - Botão "Agendar".
  - Botão "Relatório".
  - Botão "Configurações".
  - `LanguageSelector`.
  - Toggle de tema.

#### Critério de aceite

- Botões clicáveis.

#### Testes

- `Toolbar_test.tsx`:
  - `it("renderiza botões")`.
  - `it("clique Novo dispara callback")`.

---

### 20.15 — `Sidebar` + `ProjectExplorer`

#### Contexto

Menu lateral + lista de projetos.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/components/Sidebar.tsx`
- `packages/ui/src/components/ProjectTree.tsx`
- `packages/ui/tests/components/Sidebar_test.tsx`

#### Requisitos

**`Sidebar`:**

- [ ] Menu: Projetos, Editor, Relatórios, Gantt, Configurações.

**`ProjectTree`:**

- [ ] Lista de `projectsSignal`.
- [ ] Botão "Novo projeto".
- [ ] Context menu (renomear, duplicar, remover).
- [ ] Clique carrega projeto.

#### Critério de aceite

- Lista e ações funcionam.

#### Testes

- `Sidebar_test.tsx`:
  - `it("renderiza menu")`.
  - `it("clique carrega projeto")`.

---

### 20.16 — `StatusBar` + `ErrorList`

#### Contexto

Barra inferior + lista de erros.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/components/StatusBar.tsx`
- `packages/ui/src/components/ErrorList.tsx`
- `packages/ui/tests/components/StatusBar_test.tsx`

#### Requisitos

**`StatusBar`:**

- [ ] Mostra: cursor (linha/col), locale, dirty, status do parser.

**`ErrorList`:**

- [ ] Lista de `parserDiagnosticsSignal`.
- [ ] Ícone por severidade.
- [ ] Clique navega para linha.

#### Critério de aceite

- Erros aparecem.

#### Testes

- `StatusBar_test.tsx`:
  - `it("mostra cursor")`.
  - `it("mostra dirty")`.

---

### 20.17 — `LanguageSelector`

#### Contexto

Seleção de idioma da UI.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/components/LanguageSelector.tsx`
- `packages/ui/tests/components/LanguageSelector_test.tsx`

#### Requisitos

- [ ] Dropdown com `en`, `pt-BR`, `es`.
- [ ] Atualiza `settingsSignal` + storage.

#### Critério de aceite

- Troca de idioma funciona.

#### Testes

- `LanguageSelector_test.tsx`:
  - `it("renderiza 3 opções")`.
  - `it("clique muda locale")`.

---

### Bloco F — Views

---

### 20.18 — `Shell` (layout)

#### Contexto

Layout principal.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/Shell.tsx`
- `packages/ui/tests/views/Shell_test.tsx`

#### Requisitos

- [ ] Layout: `Toolbar` (topo) + `Sidebar` (esquerda) + `<main>` + `StatusBar`.
- [ ] Rotas: `#/projects`, `#/editor`, `#/report`, `#/gantt`, `#/settings`.
- [ ] Modal + toast containers.

#### Critério de aceite

- Navegação por hash funciona.

#### Testes

- `Shell_test.tsx`:
  - `it("renderiza Toolbar")`.
  - `it("renderiza Sidebar")`.

---

### 20.19 — `ProjectExplorerView`

#### Contexto

Lista de projetos.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/ProjectExplorerView.tsx`
- `packages/ui/tests/views/ProjectExplorerView_test.tsx`

#### Requisitos

- [ ] Grid de cards (BeerCSS).
- [ ] Botão "Novo projeto".
- [ ] Ações por card: abrir, renomear, duplicar, remover.
- [ ] Import `.tjp` (drag-and-drop).

#### Critério de aceite

- CRUD funciona.

#### Testes

- `ProjectExplorerView_test.tsx`:
  - `it("renderiza grid")`.
  - `it("clique abre projeto")`.

---

### 20.20 — `EditorView`

#### Contexto

Editor de `.tjp`.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/EditorView.tsx`
- `packages/ui/src/editor/editor.ts`
- `packages/ui/tests/views/EditorView_test.tsx`

#### Requisitos

- [ ] `<textarea>` controlado por `currentProjectContentSignal`.
- [ ] Syntax highlight básico (overlay `<pre>`).
- [ ] Debounce → `parser-service.parse`.
- [ ] Autosave debounced → `storage-service`.
- [ ] Undo/Redo (Ctrl+Z / Ctrl+Y).
- [ ] Navegação por erro (clique em ErrorList).

**Syntax highlight:**
- Comentários (`#`, `//`, `/* */`).
- Keywords (via `LanguageRegistry`).
- Strings, datas, números.
- `<span class="kw">`, `<span class="str">`, etc.

#### Critério de aceite

- Edição + parsing + autosave.

#### Testes

- `EditorView_test.tsx`:
  - `it("renderiza textarea")`.
  - `it("digitação atualiza signal")`.
  - `it("debounce dispara parser")`.

---

### 20.21 — `GanttView`

#### Contexto

Visualização do Gantt.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/GanttView.tsx`
- `packages/ui/src/styles/gantt.css`
- `packages/ui/tests/views/GanttView_test.tsx`

#### Requisitos

- [ ] Botão "Agendar".
- [ ] Chama `scheduler-service.schedule`.
- [ ] Gera report com coluna `chart`.
- [ ] Renderiza HTML em `<div>` com CSS `tjreport.css`.
- [ ] Zoom (escala: hour, day, week, month, quarter, year).

#### Critério de aceite

- Gantt renderizado.

#### Testes

- `GanttView_test.tsx`:
  - `it("renderiza gantt")`.
  - `it("zoom muda escala")`.

---

### 20.22 — `ReportView`

#### Contexto

Visualização de relatórios.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/ReportView.tsx`
- `packages/ui/tests/views/ReportView_test.tsx`

#### Requisitos

- [ ] Dropdown de report (taskreport, resourcereport, etc.).
- [ ] Dropdown de formato (html, csv).
- [ ] `<iframe sandbox="allow-same-origin">` renderiza HTML.
- [ ] Botão "Baixar CSV".

#### Critério de aceite

- Report renderizado.

#### Testes

- `ReportView_test.tsx`:
  - `it("renderiza iframe")`.
  - `it("download csv")`.

---

### 20.23 — `SettingsView`

#### Contexto

Configurações.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/SettingsView.tsx`
- `packages/ui/tests/views/SettingsView_test.tsx`

#### Requisitos

- [ ] Tema (light/dark/auto).
- [ ] Locale da UI.
- [ ] Autosave ms.
- [ ] Font size.
- [ ] Botão "Reset".
- [ ] Exportar/Importar projeto (JSON).

#### Critério de aceite

- Preferências persistem.

#### Testes

- `SettingsView_test.tsx`:
  - `it("muda tema")`.
  - `it("reset")`.

---

### 20.24 — `SheetsView` (Fase 18 UI)

#### Contexto

UI de download/upload de `.tji`.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/views/SheetsView.tsx`
- `packages/ui/tests/views/SheetsView_test.tsx`

#### Requisitos

- [ ] Botão "Gerar templates" (chama `TimeSheetSender`).
- [ ] Lista de templates.
- [ ] Botão "Baixar" por template.
- [ ] Área de drop para upload de `.tji`.
- [ ] Chama `TaskJuggler.checkTimeSheet`.
- [ ] Mostra resultado.

#### Critério de aceite

- Download/upload funciona.

#### Testes

- `SheetsView_test.tsx`:
  - `it("gera templates")`.
  - `it("upload .tji")`.

---

### Bloco G — i18n UI

---

### 20.25 — Catálogo de mensagens da UI

#### Contexto

i18n de UI (separado de i18n de keywords).

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/src/i18n/types.ts`
- `packages/ui/src/i18n/en.ts`
- `packages/ui/src/i18n/pt-BR.ts`
- `packages/ui/src/i18n/es.ts`
- `packages/ui/src/i18n/i18n.ts`
- `packages/ui/tests/i18n/i18n_test.ts`

#### Requisitos

- [ ] `type MessageKey = ...` (união de chaves).
- [ ] `en.ts`: mensagens em inglês.
- [ ] `pt-BR.ts`, `es.ts`: traduções.
- [ ] `t(key, params?): string` — interpolate.
- [ ] `i18nSignal` — locale atual.

**Exemplos de chaves:**
- `toolbar.new`, `toolbar.save`, `toolbar.schedule`.
- `editor.placeholder`.
- `errors.syntax`, `errors.schedule`.
- `settings.theme.light`, `settings.theme.dark`.

#### Critério de aceite

- Trocar locale traduz UI.

#### Testes

- `i18n_test.ts`:
  - `it("t en")`.
  - `it("t pt-BR")`.
  - `it("t com params")`.
  - `it("fallback para en")`.

---

### Bloco H — Integração e testes

---

### 20.26 — Integração end-to-end

#### Contexto

Testes de fluxo completo.

#### Objetivo

Implementar.

#### Arquivos

- `packages/ui/tests/integration/*.tsx`

#### Requisitos

- [ ] Testes:
  - Criar projeto → editar → salvar → reabrir.
  - Importar `.tjp` → parse → schedule → report.
  - Gerar template de time sheet → baixar → upload → validar.
  - Trocar locale → UI traduz.
  - Trocar tema → CSS muda.

#### Critério de aceite

- ≥ 20 testes E2E.

#### Testes

- `integration_test.tsx`:
  - `describe("Fluxo completo")` — itera cenários.

---

### 20.27 — Performance e acessibilidade

#### Contexto

Qualidade da UI.

#### Objetivo

Verificar.

#### Arquivos

- `packages/ui/tests/performance/*.ts`
- `packages/ui/tests/a11y/*.ts`

#### Requisitos

- [ ] **Performance:**
  - Parsing < 200ms em MWE.
  - Render Gantt < 1s em projeto médio.
  - Autosave < 100ms.
- [ ] **Acessibilidade:**
  - Contraste (WCAG AA).
  - Navegação por teclado.
  - ARIA labels.
  - Foco visível.

#### Critério de aceite

- Lighthouse ≥ 90 (PWA, Performance, Accessibility).

#### Testes

- `a11y_test.ts`:
  - `it("contraste OK")`.
  - `it("tab navigation")`.

---

### 20.28 — Build e deploy

#### Contexto

Pipeline de build.

#### Objetivo

Implementar.

#### Arquivos

- `esbuild.ts` (atualizar)
- `deno.jsonc` (tasks)
- `.github/workflows/deploy.yml` (opcional)

#### Requisitos

- [ ] `deno task build`:
  - Bundle UI + Service Worker.
  - Copia `public/` para `dist/`.
  - Minifica JS + CSS.
- [ ] Deploy: GitHub Pages / Cloudflare Pages.
- [ ] Assets otimizados.

#### Critério de aceite

- `dist/` gera e funciona.

#### Testes

- Smoke E2E em `dist/`.

---

## 6. Ordem de execução sugerida

```text
25.0  ADR 032
      ↓
25.1  manifest.json + ícones
25.2  Service Worker
25.3  Registro do SW + auto-update
25.4  index.html + shell offline
      ↓
25.5  Preact + Signals setup
25.6  BeerCSS setup
25.7  Theme system
      ↓
25.8  engine.worker.ts
25.9  engine-client.ts
25.10 parser-service.ts
25.11 scheduler-service.ts
25.12 report-service.ts + storage-service.ts
      ↓
25.13 Estrutura de Signals
      ↓
25.14 Toolbar
25.15 Sidebar + ProjectExplorer
25.16 StatusBar + ErrorList
25.17 LanguageSelector
      ↓
25.18 Shell
25.19 ProjectExplorerView
25.20 EditorView
25.21 GanttView
25.22 ReportView
25.23 SettingsView
25.24 SheetsView
      ↓
25.25 i18n UI
      ↓
25.26 Integração end-to-end
25.27 Performance e acessibilidade
25.28 Build e deploy
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 20 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] PWA instalável (Lighthouse PWA ≥ 90).
- [ ] Service Worker funcional (offline).
- [ ] Shell + Toolbar + Sidebar + StatusBar.
- [ ] ProjectExplorer (CRUD).
- [ ] Editor com syntax highlight + autosave.
- [ ] GanttView funcional.
- [ ] ReportView funcional.
- [ ] SettingsView funcional.
- [ ] SheetsView (download/upload de `.tji`).
- [ ] LanguageSelector funcional (3 idiomas).
- [ ] Theme (light/dark/auto).
- [ ] `engine.worker.ts` funcional.
- [ ] Serviços completos.
- [ ] Signals estruturados.
- [ ] i18n UI completo.
- [ ] **≥ 120 testes unitários**.
- [ ] **≥ 20 testes E2E**.
- [ ] Lighthouse ≥ 90 (PWA, Performance, Accessibility).
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 032 criado.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Editor básico (sem Monaco) limitado | Médio | Syntax highlight simples funciona; Monaco futuro |
| Worker bloqueado por parser grande | Médio | Debounce + cancelamento |
| Service Worker com cache stale | Alto | Versionamento `CACHE_VERSION` |
| BeerCSS com conflito de classes | Médio | Prefir custom classes |
| Report HTML com CSS quebrado | Médio | `iframe sandbox` |
| Gantt pesado em projeto grande | Alto | Virtualização futura; teste em 500 tasks |
| i18n de UI divergir de i18n de keywords | Médio | Separar conceitos |
| Acessibilidade incompleta | Médio | Testes com `axe-core` |
| Build lento | Baixo | esbuild é rápido |
| Deploy com CSP strict | Médio | Inline CSS com nonce |
| iOS PWA com SW limitado | Médio | Testar em iOS Safari |

---

## 9. Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/03-arquitetura.md` — seção App.
- `docs/syntaxmesh/decisoes/002-parser-isolado-da-logica-de-ui.md`.
- `docs/syntaxmesh/decisoes/005-typescript-deno-browser-only.md`.
- `docs/syntaxmesh/decisoes/032-pwa-ui-stack.md` (novo).
- `docs/syntaxmesh/09-regras-para-ia.md`.
- `docs/BeerCSS/`.

### Fases referenciadas

- **Fase 1** — `@syntaxmesh/ui`, `@syntaxmesh/service-worker` (estrutura).
- **Fase 9** — `Project`, `TaskJuggler`.
- **Fase 10** — Parser.
- **Fase 14** — Reports.
- **Fase 15** — Gantt.
- **Fase 18** — Sheets (UI download/upload).
- **Fase 19** — Storage (`ProjectService`).

### Fases dependentes

- **Fase 21 — Compatibilidade** (testes cross-browser, golden tests E2E).

---

## 10. Notas para a IA

1. **UI consome serviços, não Core diretamente.**
2. **UI não toca IndexedDB/OPFS.** Sempre via `@syntaxmesh/storage`.
3. **UI não executa parser/scheduler na main thread.** Sempre via Worker.
4. **Preact + Signals + BeerCSS.** Não introduzir outros frameworks.
5. **Editor básico.** Sem CodeMirror/Monaco nesta fase.
6. **GanttView** usa HTML da Fase 15 + `tjreport.css`.
7. **ReportView** com `iframe sandbox`.
8. **i18n de UI separado de i18n de keywords.**
9. **Theme via `data-theme` do BeerCSS.**
10. **Service Worker com `CACHE_VERSION`.**
11. **Signals por domínio** (`ui`, `project`, `editor`, `parser`, `report`, `settings`).
12. **Debounce**: parser 300ms; autosave 500ms.
13. **Download/upload de `.tji`** em `SheetsView`.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **Commit por subfase.** `feat(ui): toolbar`, etc.
16. **Testes**: Vitest para unit; Playwright para E2E.
17. **Lighthouse ≥ 90** é o critério final.

---

## 11. ADR 032 (referência rápida)

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

**Fim da Fase 20.**