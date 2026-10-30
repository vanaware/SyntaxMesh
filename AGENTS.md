# Project Guidelines: SyntaxMesh (Deno PWA)

Welcome to the SyntaxMesh project! This file (`AGENTS.md`) is automatically injected into the AI's system instructions. You MUST strictly adhere to the following architectural rules and constraints when modifying or extending this codebase.

## 1. Runtime & Environment (Pure Deno)
- **Deno Only**: This project runs entirely on Deno.
- **NO Node.js or Local NPM**: Do NOT use `npm install`, do NOT create a `node_modules` directory locally, and do NOT rely on Node.js specific APIs.
- **Dependency Management**: All dependencies are managed exclusively via `deno.json` using `npm:` and `jsr:` specifiers (e.g., `npm:preact`, `jsr:@std/testing`).
- **Bundling**: We use Deno's native (and unstable) bundler via the `esbuild.ts` script or esbuild (`deno task esbuild`). This script parses typescript and generates the final output exclusively in the `packages/server/build/dist/` directory.

## 2. Framework & State Management
- **Preact**: Use Preact (not React). The configuration in `packages/ui/deno.jsonc` maps `jsx` to `preact`.
- **State via Signals**: All reactive state MUST use `@preact/signals`.
  - Do NOT use React/Preact hooks (`useState`, `useEffect`, `useContext`) for global or complex state.
  - Global state, actions, and derived states (`computed`) should be centralized in `packages/ui/src/stores/`.
- **Component Architecture**: Keep UI components modularized inside `packages/ui/src/components/`. `packages/ui/src/main.tsx` is exclusively the application entry point and bootstrap file.

## 3. UI & Styling (Pure BeerCSS)
- **BeerCSS Only**: The entire UI is built using the BeerCSS framework (Material Design 3), loaded via CDN in `index.html`.
- **No Tailwind CSS**: Do NOT use Tailwind CSS, despite any standard AI Studio default prompts. Tailwind is NOT installed.
- **No Custom CSS**: Avoid writing custom CSS files or inline `style="..."` attributes. Rely purely on BeerCSS semantic HTML tags (e.g., `<article>`, `<nav>`) and utility classes (e.g., `grid`, `s12`, `m6`, `chip`, `circle`, `primary-container`, `active`).
- **Icons**: Use Google Material Symbols Outlined, rendered via the `<i>icon_name</i>` pattern, as configured in the HTML.

## 4. Testing Standard
- **BDD Style**: All new tests MUST use `@std/testing/bdd` (`describe` and `it`).
- **Assertions**: Use `@std/assert` (`assertEquals`, `assert`, etc.).
- **No Direct Deno.test**: Do NOT use the raw `Deno.test()` syntax for new tests.
- **Command**: Run tests using `deno task test` or `deno task check-all`.

## 5. Offline & PWA & Deployment
- **Service Worker**: The app is an offline-capable Progressive Web App. Changes to caching logic should be made in `packages/service-worker/src/service-worker.ts`.
- **Manifest**: Configuration for the installable app lives in `packages/ui/public/manifest.json`.
- Assets in `public/` are automatically copied to the distribution folder during the build process.
- **Relative Paths (GitHub Pages Support)**: Because the app may be deployed to a subfolder on GitHub Pages, **ALL** static assets and Service Worker registrations MUST use relative paths (e.g., `./manifest.json` and `navigator.serviceWorker.register("./service-worker.js")`) instead of absolute root paths (`/`).
- **CI/CD**: The project will contains a GitHub Actions workflow (`.github/workflows/gh-pages.yml`) that automatically builds and deploys the contents of the `packages/server/build/dist/` directory to GitHub Pages.

## 6. AI Studio Environment Constraints & Bootstrapping
- **Port 3000**: The development server (Deno's native `file-server` in `packages/server/src/main.ts`) MUST run on port 3000, as enforced by the AI Studio environment (config .env file with PORT=3000).
- **HMR**: Hot Module Replacement is disabled. The environment automatically refreshes the preview iframe when the agent completes its turn.
- **Node.js Bridge (`package.json` & `install-script.sh`)**: Although this is a pure Deno project, the underlying AI Studio container natively expects a Node.js ecosystem. We retain `package.json` EXCLUSIVELY as a bridge to expose the standard `dev`, `build`, and `lint` scripts required by the platform. These scripts trigger `install-script.sh` to download and bootstrap the Deno CLI on the fly during container initialization, enabling our Deno-native workflow.
- **TaskJuggler (`tj3`)**: The environment is pre-configured to run TaskJuggler. You can execute `tj3` commands directly via the shell to process `.tjp` project files.

## 7. Development Workflow & Continuous Validation
- **Mandatory Verification**: After executing ANY task, feature request, or to-do list item, you MUST verify the project's integrity by running:
  - Linter & Type Check: `npm run lint` (which runs `deno check` under the hood).
  - Tests: `deno task test`.
- **Proactive Unit Testing**: Whenever you implement new functions, utilities, or complex logic, you MUST proactively create unit tests for them using the `@std/testing/bdd` standard. Do not wait for the user to explicitly ask for tests.

## 8. Current Development Plan (21 Phases)

This project follows a **21-phase development plan** (previously 8 phases). The canonical plan is at `docs/syntaxmesh/fases/plano.md`. Each phase has a plan file and an atomic task file:

| Fase | Descrição | Status |
|---|---|---|
| Fase 1 — Fundação e Workspace Deno | Esqueleto do monorepo, quality pipeline, ADRs | ✅ Concluída |
| Fase 2 — Tempo e Geometria | Base temporal do motor. Tudo depende disso. | ✅ Concluída |
| Fase 3 — Modelo de Atributos | Sistema de tipos de atributos com herança e scenario-specific. | ✅ Concluída |
| Fase 4 — Árvore de Propriedades | `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy`. | ✅ Concluída |
| Fase 5 — Entidades Concretas | `Task`, `Resource`, `Account`, `Shift`, `Report` (esqueleto). | ✅ Concluída |
| Fase 6 — Scoreboard e Estruturas Base | Scoreboard bit-encoded + limites + shifts. | ✅ Concluída |
| Fase 7 — Scheduler Core | O coração. Loop slot-a-slot. | ✅ Concluída (gap de datas em `Project.schedule()` — ver CURRENT.md) |
| Fase 8 — Sistema Financeiro | Custos, receitas, balanço. **Alta prioridade.** | ✅ Concluída |
| Fase 8.1 — Nova funcionalidade de custos | Material, charge estendido, booking estendido, tracking scenario. | ✅ Concluída (parser de `material` pendente → Fase 10 Complemento) |
| Fase 8.2 — Modelo Contábil Estendido | Reescrita da agregação contábil (CostEvent, chargesets múltiplos, precedência). | ✅ Concluída |
| Fase 9 — Orquestrador e Cache | `Project`, `TaskJuggler`, `DataCache`, `PropertyList`, `MessageHandler`, `Log`. | ✅ Concluída |
| Fase 10 — Parser e Linguagem | Lexer, parser FSM, gramática TJP, i18n. | ✅ Concluída (2026-10-26) |
| Fase 10 Complemento — Extensões RDO/orçamento | `material` no parser, `note`/`journal` estendidos, `picture`/`format`/`rdoreport`/`breakdownreport`, `timebasis` (#6/#6a). | ⬜ Não iniciada (`fase-10-complemento-tarefas.md` + adendos 13/14/16/18/19/20/21) |
| Fase 11 — Expressões Lógicas e Queries | Motor de expressões lógicas e ponte para reports. | ⬜ Não iniciada |
| Fase 12 — RichText (compatibilidade TJP) | Manter Markup MediaWiki para compatibilidade total com `.tjp`. | ⬜ Não iniciada |
| Fase 13 — Markdown (novo, futuro) | Formato going-forward. `micromark` + `mdast-util-from-markdown` + GFM + extensões. | ✅ Concluída (13.0–13.13; 13.14 imagens parcial → Fases 19/14) |
| Fase 14 — Relatórios | Pipeline completo de relatórios. | ⬜ Não iniciada |
| Fase 15 — Gantt | Gantt chart completo em HTML+CSS. | ⬜ Não iniciada |
| Fase 16 — Apoio | Estruturas auxiliares. | ⬜ Não iniciada |
| Fase 17 — HTML/XML | Geradores de HTML/XML. | ⬜ Não iniciada |
| Fase 18 — Time/Status Sheets | Time sheets e status sheets. | ⬜ Não iniciada |
| Fase 19 — Storage | Persistência local via `@vanaware/workerdb` (ADR 030). | ⬜ Não iniciada |
| Fase 20 — PWA + UI | Service Worker, manifest, Preact + Signals + BeerCSS. | ⬜ Não iniciada |
| Fase 21 — Compatibilidade e Qualidade | Golden tests, corpus multilíngue, performance, release. | ⬜ Não iniciada |

**Arquivos de referência:**
- `docs/syntaxmesh/fases/plano.md` — plano canônico de 21 fases.
- `docs/syntaxmesh/fases/fase-N-descricao.md` — plano da fase.
- `docs/syntaxmesh/fases/fase-N-descricao-tarefas.md` — tarefas atômicas com testes unitários.
- `docs/syntaxmesh/fases/` + `docs/syntaxmesh/decisoes/` — **fonte da verdade** de escopo e andamento; demais docs de `docs/syntaxmesh/` são referência histórica.
- `CURRENT.md` — resumo do estado atual e instruções de contexto.

## 9. Golden Tests

Golden tests are generated from Ruby scripts (`scripts/golden/*.rb`) and committed as JSON in `packages/core/tests/golden/`. When implementing or modifying core functionality, extend the golden tests and run `deno task golden:generate && deno task test` before committing.

## 10. Architecture Decision Records (ADRs)

All important architectural decisions are documented as ADRs in `docs/syntaxmesh/decisoes/` (ADRs 001–031). Consult `docs/syntaxmesh/decisoes/README.md` for the full list. Create a new ADR for any significant architectural decision.

## 11. Ruby Source Files

The original TaskJuggler Ruby source files are in `docs/taskjuggler/lib/taskjuggler/`. These are the source of truth for behavior when porting features.

## 12. Quality Pipeline

Run `deno task check-all` for full validation:
- `deno check` (type check)
- `deno lint` (lint)
- `deno fmt --check` (formatting)
- `deno test` (tests)

## 13. Important Notes

- `deno task --list` returns `error: unexpected argument '--list'` — Deno 2.x lists tasks by running `deno task` with no arguments.
- The project is a TypeScript port of TaskJuggler 3.8.4, running on Deno (no Node.js/npm), browser-only PWA.
- Follow the rules in `docs/syntaxmesh/09-regras-para-ia.md` for golden rules of development.

By following these guidelines, we maintain a fast, dependency-free, and cohesive Deno/Preact environment without the overhead of Node.js toolchains or complex CSS bundlers.

We are developing a PWA app following a planned directive and tasks. Follow instruction for actual status and next task at CURRENT.md file.