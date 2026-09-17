# Fase 21 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-21-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~140 tarefas
> **Concluídas:** 0
> **Foco:** Golden tests, i18n, performance, segurança, cross-browser, release

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

### Contexto crítico

- Esta é a **fase final de validação**. Nada de features novas.
- **Golden tests** contra `tj3` real são o critério primário.
- **AST equivalence** entre en/pt-BR/es normaliza `name`.
- **Snapshot tests** congelam saídas para prevenir regressões.
- **Benchmarks** comparam contra baseline (regressão > 20% falha).
- **Segurança** com OWASP vectors.
- **Cross-browser** com 3 engines (Chromium, Firefox, WebKit).
- **Lighthouse ≥ 90** em 5 categorias.
- **SemVer 1.0.0** no release.
- Sem `any` em `src/`.
- Commit por subfase: `test(quality): golden-parser`, etc.

### Pré-requisitos

- **Todas as fases 1–20 concluídas.**
- `tj3` instalado e funcional (Ruby gem).
- Corpus de fixtures organizado.

### Anti-padrões

- ❌ Não adicionar features novas.
- ❌ Não corrigir comportamento divergente sem consultar `docs/syntaxmesh/10-futuro.md`.
- ❌ Não commitar fixtures com paths absolutos.
- ❌ Não rodar CI sem cachear outputs de `tj3`.
- ❌ Não quebrar contratos públicos.

---

## Progresso

```
[ ] 26.0  ADR 033 (estratégia de validação)         —   0/5
[ ] 26.1  Corpus de fixtures                        —   0/6
[ ] 26.2  tj3-runner                                —   0/8
[ ] 26.3  tj3-ts-runner                             —   0/6
[ ] 26.4  comparator                                —   0/8
[ ] 26.5  Golden tests end-to-end                   —   0/10
[ ] 26.6  Divergências conhecidas                   —   0/4
[ ] 26.7  Relatório de conformidade                 —   0/4
[ ] 26.8  AST equivalence (en ↔ pt-BR ↔ es)         —   0/8
[ ] 26.9  Regression snapshots                      —   0/8
[ ] 26.10 Testes unitários consolidados             —   0/4
[ ] 26.11 Benchmarks                                —   0/10
[ ] 26.12 Testes de segurança                       —   0/8
[ ] 26.13 CSP                                       —   0/4
[ ] 26.14 Otimização final                          —   0/4
[ ] 26.15 Playwright setup                          —   0/6
[ ] 26.16 Cenários E2E                              —   0/10
[ ] 26.17 Acessibilidade                            —   0/6
[ ] 26.18 Lighthouse CI                             —   0/6
[ ] 26.19 Build de produção                         —   0/6
[ ] 26.20 CHANGELOG e release notes                 —   0/4
[ ] 26.21 Versionamento                             —   0/4
[ ] 26.22 Documentação final                        —   0/8
[ ] 26.23 Templates de issues                       —   0/4
[ ] 26.24 CI/CD final                               —   0/8
[ ] 26.25 Verificação final                         —   0/8
─────────────────────────────────────────────────────────
TOTAL: ~140
```

---

## Bloco A — Fundação

### 26.0 — ADR 033 (estratégia de validação)

**Objetivo:** formalizar a estratégia de validação de fidelidade, i18n, performance e segurança.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.0.1 | Criar `docs/syntaxmesh/decisoes/033-estrategia-validacao.md` com frontmatter | idem | arquivo existe |
| 26.0.2 | Seção **Contexto:** necessidade de provar fidelidade ao `tj3` real; i18n; performance; segurança | idem | — |
| 26.0.3 | Seção **Decisões:** golden tests (`tj3` vs `tj3-ts`); AST equivalence; regression snapshots; benchmarks com baseline; Playwright cross-browser; `axe-core`; Lighthouse ≥ 90 | idem | — |
| 26.0.4 | Seção **Alternativas:** testes manuais, apenas unit tests + **Consequências** | idem | — |
| 26.0.5 | Atualizar linha `033` em `decisoes/README.md` | idem | 33 linhas |

---

## Bloco B — Corpus e runners

### 26.1 — Corpus de fixtures

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.1.1 | Criar `tests/fixtures/mwe001-009/` (copiar de `docs/Learning/`) | idem | 9 diretórios |
| 26.1.2 | Copiar `TestSuite/Syntax/Correct/` (~150 `.tjp`) | `tests/fixtures/syntax/correct/` | ≥ 150 arquivos |
| 26.1.3 | Copiar `TestSuite/Syntax/Errors/` (~50 `.tjp`) | `tests/fixtures/syntax/errors/` | ≥ 50 arquivos |
| 26.1.4 | Copiar `TestSuite/Scheduler/Correct/` (~30 `.tjp`) | `tests/fixtures/scheduler/correct/` | ≥ 30 arquivos |
| 26.1.5 | Copiar `TestSuite/Reports/` (~20 `.tjp`) | `tests/fixtures/reports/` | ≥ 20 arquivos |
| 26.1.6 | Criar `tests/fixtures/README.md` com índice | idem | arquivo existe |

---

### 26.2 — `tj3-runner.ts` (referência)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.2.1 | Criar `scripts/golden/tj3-runner.ts` com `runTj3(fixturePath): Promise<Tj3Output>` | idem | `deno check` |
| 26.2.2 | Executar `Deno.Command('tj3', { args: [fixturePath] })` | idem | 1 teste |
| 26.2.3 | Capturar stdout, stderr, exit code | idem | 2 testes |
| 26.2.4 | Ler arquivos gerados (`.html`, `.csv`, `.ics`) | idem | 2 testes |
| 26.2.5 | Criar `scripts/golden/tj3-normalizer.ts` | idem | `deno check` |
| 26.2.6 | Implementar `normalizeTj3Output(output): NormalizedOutput` | idem | 3 testes |
| 26.2.7 | Salvar em `tests/fixtures/<id>/tj3.expected.json` | idem | 1 teste |
| 26.2.8 | Criar `scripts/golden/tj3-runner_test.ts` | idem | 3 testes |

---

### 26.3 — `tj3-ts-runner.ts` (sujeito)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.3.1 | Criar `scripts/golden/tj3-ts-runner.ts` com `runTj3Ts(fixturePath): Promise<Tj3TsOutput>` | idem | `deno check` |
| 26.3.2 | Ler `.tjp`, chamar `TaskJuggler.parseContent` | idem | 2 testes |
| 26.3.3 | Chamar `schedule()` e `generateReports()` | idem | 2 testes |
| 26.3.4 | Criar `scripts/golden/tj3-ts-normalizer.ts` | idem | `deno check` |
| 26.3.5 | Formato de output idêntico ao `tj3-runner` | idem | 2 testes |
| 26.3.6 | Criar `scripts/golden/tj3-ts-runner_test.ts` | idem | verde |

---

### 26.4 — `comparator.ts` (comparador)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.4.1 | Criar `scripts/golden/comparator.ts` com `compare(expected, actual): Diff[]` | idem | `deno check` |
| 26.4.2 | Comparar ASTs (deep equal, tolerância `1e-6`) | idem | 3 testes |
| 26.4.3 | Comparar diagnostics (id, message, lineNo) | idem | 2 testes |
| 26.4.4 | Comparar datas (timestamps UTC) | idem | 2 testes |
| 26.4.5 | Comparar HTML (DOM normalized) | idem | 2 testes |
| 26.4.6 | Comparar CSV (linha por linha) | idem | 2 testes |
| 26.4.7 | Cada `Diff` com path (JSON pointer) + valores | idem | 2 testes |
| 26.4.8 | Criar `scripts/golden/comparator_test.ts` | idem | verde |

---

## Bloco C — Golden tests

### 26.5 — Golden tests end-to-end

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.5.1 | Criar `scripts/golden/run-all.ts` | idem | `deno check` |
| 26.5.2 | Criar `tests/golden/mwe_golden_test.ts` (9 MWEs) | idem | verde |
| 26.5.3 | Criar `tests/golden/syntax_golden_test.ts` (~200 fixtures) | idem | verde |
| 26.5.4 | Criar `tests/golden/scheduler_golden_test.ts` (~30 fixtures) | idem | verde |
| 26.5.5 | Criar `tests/golden/reports_golden_test.ts` (~20 fixtures) | idem | verde |
| 26.5.6 | Para cada fixture: rodar `tj3` (se não rodou) | idem | 1 teste |
| 26.5.7 | Rodar `tj3-ts` | idem | 1 teste |
| 26.5.8 | Comparar com `comparator` | idem | 1 teste |
| 26.5.9 | Marcar `known_divergence` ou `bug` quando divergir | idem | 1 teste |
| 26.5.10 | Gerar relatório em `docs/syntaxmesh/conformance-report.md` | idem | arquivo existe |

---

### 26.6 — Divergências conhecidas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.6.1 | Criar `tests/golden/known-divergences.json` | idem | JSON válido |
| 26.6.2 | Documentar cada divergência: fixture, descrição, justificativa, mitigação, prioridade | idem | 1 teste |
| 26.6.3 | Atualizar `docs/syntaxmesh/10-futuro.md` com lista de features ausentes | idem | seção existe |
| 26.6.4 | Teste: `known-divergences.json` é válido contra schema | idem | 1 teste |

---

### 26.7 — Relatório de conformidade

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.7.1 | Criar `scripts/golden/generate-report.ts` | idem | `deno check` |
| 26.7.2 | Estrutura: resumo, por categoria, divergências, features ausentes | idem | 3 testes |
| 26.7.3 | Incluir versões (`tj3 3.8.4`, `tj3-ts 1.0.0`) | idem | 1 teste |
| 26.7.4 | Gerar `docs/syntaxmesh/conformance-report.md` | idem | arquivo existe |

---

## Bloco D — i18n e regressão

### 26.8 — AST equivalence (en ↔ pt-BR ↔ es)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.8.1 | Criar `tests/fixtures/i18n/en/` (30 fixtures) | idem | 30 arquivos |
| 26.8.2 | Criar `tests/fixtures/i18n/pt-BR/` (traduções) | idem | 30 arquivos |
| 26.8.3 | Criar `tests/fixtures/i18n/es/` (traduções) | idem | 30 arquivos |
| 26.8.4 | Criar `tests/i18n/ast_equivalence_test.ts` | idem | `deno check` |
| 26.8.5 | Implementar `normalizeAST(ast)` (substitui `name` por `__TASK__`/`__RESOURCE__`) | idem | 2 testes |
| 26.8.6 | Para cada fixture: parsear 3 versões e comparar | idem | 30 testes |
| 26.8.7 | Cobertura: 100% das fixtures com AST idêntica | idem | verde |
| 26.8.8 | Teste agregado: todas as fixtures × 3 idiomas | idem | 1 teste |

---

### 26.9 — Regression snapshots

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.9.1 | Criar `tests/regression/ast_snapshot_test.ts` | idem | `deno check` |
| 26.9.2 | Snapshot de AST para cada fixture | idem | 1 teste |
| 26.9.3 | Criar `tests/regression/diagnostics_snapshot_test.ts` | idem | `deno check` |
| 26.9.4 | Snapshot de diagnostics para cada erro | idem | 1 teste |
| 26.9.5 | Criar `tests/regression/richtext_snapshot_test.ts` | idem | `deno check` |
| 26.9.6 | Snapshot de `RichText.to_s`/`to_html`/`to_tagged` | idem | 3 testes |
| 26.9.7 | Criar `tests/regression/report_snapshot_test.ts` (HTML normalizado) | idem | 1 teste |
| 26.9.8 | Criar `tests/regression/__snapshots__/` (gerado) | idem | arquivos existem |

---

### 26.10 — Testes unitários consolidados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.10.1 | Adicionar task `test:all` em `deno.jsonc` | idem | `deno task --list` |
| 26.10.2 | `test:all` roda `packages/*/tests/**` + `tests/unit/**` | idem | verde |
| 26.10.3 | Cobertura ≥ 85% | idem | relatório |
| 26.10.4 | Relatório em `docs/syntaxmesh/coverage.md` | idem | arquivo existe |

---

## Bloco E — Performance e segurança

### 26.11 — Benchmarks

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.11.1 | Criar `bench/parse_bench.ts` (100 tasks, 1000 tasks) | idem | `deno bench` roda |
| 26.11.2 | Criar `bench/schedule_bench.ts` (100 tasks, 1000 tasks) | idem | `deno bench` roda |
| 26.11.3 | Criar `bench/report_bench.ts` (10 reports) | idem | `deno bench` roda |
| 26.11.4 | Criar `bench/gantt_bench.ts` (500 tasks) | idem | `deno bench` roda |
| 26.11.5 | Criar `bench/rich_text_bench.ts` | idem | `deno bench` roda |
| 26.11.6 | Criar `bench/query_bench.ts` (10k queries) | idem | `deno bench` roda |
| 26.11.7 | Salvar `bench/baseline.json` | idem | JSON válido |
| 26.11.8 | Adicionar task `bench:compare` em `deno.jsonc` | idem | `deno task --list` |
| 26.11.9 | CI falha se regressão > 20% | idem | 1 teste |
| 26.11.10 | Criar `bench/bench_test.ts` (baseline existe, sem regressão) | idem | 2 testes |

---

### 26.12 — Testes de segurança

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.12.1 | Criar `tests/security/xss_test.ts` (Markdown, RichText, reports) | idem | 8 testes |
| 26.12.2 | Criar `tests/security/path_traversal_test.ts` | idem | 4 testes |
| 26.12.3 | Criar `tests/security/dos_test.ts` (10MB, circular, macros recursivas) | idem | 6 testes |
| 26.12.4 | Criar `tests/security/csv_injection_test.ts` | idem | 4 testes |
| 26.12.5 | Criar `tests/security/ical_injection_test.ts` | idem | 4 testes |
| 26.12.6 | Criar `tests/security/fixtures/owasp/` (vectors) | idem | ≥ 40 arquivos |
| 26.12.7 | Todos os vectors devem passar (zero XSS, bypass) | idem | verde |
| 26.12.8 | Teste agregado: ≥ 40 vectors | idem | 1 teste |

---

### 26.13 — CSP

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.13.1 | Criar `packages/server/src/csp.ts` | idem | `deno check` |
| 26.13.2 | Configurar `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `style-src 'self' 'unsafe-inline'` | idem | 3 testes |
| 26.13.3 | Configurar `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'` | idem | 3 testes |
| 26.13.4 | Criar `packages/ui/public/_headers` (Cloudflare Pages) | idem | arquivo existe |

---

### 26.14 — Otimização final

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.14.1 | Analisar `bench` report | idem | relatório |
| 26.14.2 | Otimizar top 3 hotspots | vários | benchmarks |
| 26.14.3 | Re-rodar benchmarks | idem | 3 testes |
| 26.14.4 | Documentar em `docs/syntaxmesh/performance.md` | idem | arquivo existe |

---

## Bloco F — Cross-browser e a11y

### 26.15 — Playwright setup

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.15.1 | Criar `playwright.config.ts` | idem | arquivo existe |
| 26.15.2 | Browsers: Chromium, Firefox, WebKit | idem | 1 teste |
| 26.15.3 | Servidor de teste: `packages/server` (Deno) | idem | 1 teste |
| 26.15.4 | Base URL: `http://localhost:8080` | idem | 1 teste |
| 26.15.5 | Adicionar task `test:e2e` em `deno.jsonc` | idem | `deno task --list` |
| 26.15.6 | Teste: `deno task test:e2e` roda | idem | verde |

---

### 26.16 — Cenários E2E

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.16.1 | Criar `tests/e2e/project-crud.spec.ts` | idem | 3 testes |
| 26.16.2 | Criar `tests/e2e/editor-parse.spec.ts` | idem | 3 testes |
| 26.16.3 | Criar `tests/e2e/schedule-gantt.spec.ts` | idem | 3 testes |
| 26.16.4 | Criar `tests/e2e/report.spec.ts` | idem | 2 testes |
| 26.16.5 | Criar `tests/e2e/sheets.spec.ts` | idem | 2 testes |
| 26.16.6 | Criar `tests/e2e/i18n.spec.ts` | idem | 2 testes |
| 26.16.7 | Criar `tests/e2e/theme.spec.ts` | idem | 2 testes |
| 26.16.8 | Criar `tests/e2e/pwa-offline.spec.ts` | idem | 3 testes |
| 26.16.9 | ≥ 30 cenários × 3 browsers | idem | verde |
| 26.16.10 | 100% verde nos 3 browsers | idem | relatório |

---

### 26.17 — Acessibilidade

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.17.1 | Adicionar `axe-core` como dev dep | idem | `deno check` |
| 26.17.2 | Criar `tests/a11y/a11y.spec.ts` (componentes) | idem | 6 testes |
| 26.17.3 | Teste: contraste ≥ 4.5:1 | idem | 1 teste |
| 26.17.4 | Teste: navegação por teclado | idem | 1 teste |
| 26.17.5 | Teste: ARIA em ícones | idem | 1 teste |
| 26.17.6 | Teste: foco visível + sem armadilha de foco | idem | 1 teste |

---

### 26.18 — Lighthouse CI

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.18.1 | Criar `lighthouserc.json` | idem | JSON válido |
| 26.18.2 | Alvos: PWA ≥ 90, Performance ≥ 90, Accessibility ≥ 95 | idem | 3 testes |
| 26.18.3 | Alvos: Best Practices ≥ 90, SEO ≥ 90 | idem | 2 testes |
| 26.18.4 | Rodar Lighthouse em `dist/` | idem | relatório |
| 26.18.5 | Salvar relatório em `docs/syntaxmesh/lighthouse.md` | idem | arquivo existe |
| 26.18.6 | Todos os alvos atingidos | idem | verde |

---

## Bloco G — Release

### 26.19 — Build de produção

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.19.1 | Revisar `esbuild.ts` | idem | `deno check` |
| 26.19.2 | Adicionar task `build:prod` em `deno.jsonc` | idem | `deno task --list` |
| 26.19.3 | Minificar JS + CSS | idem | 1 teste |
| 26.19.4 | Tree-shaking | idem | 1 teste |
| 26.19.5 | Copiar `public/` para `dist/` | idem | 1 teste |
| 26.19.6 | Gera `sw.js`, assets com hash | idem | 2 testes |

---

### 26.20 — CHANGELOG e release notes

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.20.1 | Criar `CHANGELOG.md` com todas as fases | idem | arquivo existe |
| 26.20.2 | Criar `docs/syntaxmesh/release-notes/v1.0.0.md` | idem | arquivo existe |
| 26.20.3 | Estrutura: novidades, breaking changes, bugs corrigidos, agradecimentos | idem | 1 teste |
| 26.20.4 | Teste: CHANGELOG completo | idem | 1 teste |

---

### 26.21 — Versionamento

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.21.1 | Atualizar `deno.jsonc` raiz com `version: "1.0.0"` | idem | 1 teste |
| 26.21.2 | Sincronizar `version` nos `packages/*/deno.jsonc` | idem | 12 testes |
| 26.21.3 | Criar git tag `v1.0.0` | idem | git tag existe |
| 26.21.4 | Criar release no GitHub (ou equivalente) | idem | release existe |

---

### 26.22 — Documentação final

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.22.1 | Criar `README.md` (raiz) com instalação, uso, exemplos | idem | arquivo existe |
| 26.22.2 | Criar `docs/manual/index.md` | idem | arquivo existe |
| 26.22.3 | Criar `docs/contributing.md` | idem | arquivo existe |
| 26.22.4 | Criar `docs/migration-tj3-to-syntaxmesh.md` | idem | arquivo existe |
| 26.22.5 | Gerar API docs via TypeDoc | idem | diretório `api/` |
| 26.22.6 | Teste: README tem seções mínimas | idem | 1 teste |
| 26.22.7 | Teste: manual cobre features principais | idem | 1 teste |
| 26.22.8 | Teste: guia de migração cobre divergências | idem | 1 teste |

---

### 26.23 — Templates de issues

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.23.1 | Criar `.github/ISSUE_TEMPLATE/bug_report.md` | idem | arquivo existe |
| 26.23.2 | Criar `.github/ISSUE_TEMPLATE/feature_request.md` | idem | arquivo existe |
| 26.23.3 | Criar `.github/ISSUE_TEMPLATE/documentation.md` | idem | arquivo existe |
| 26.23.4 | Criar `.github/PULL_REQUEST_TEMPLATE.md` | idem | arquivo existe |

---

### 26.24 — CI/CD final

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.24.1 | Criar `.github/workflows/ci.yml` | idem | arquivo existe |
| 26.24.2 | CI roda `check-all`, `test:all`, `golden:test` | idem | 3 testes |
| 26.24.3 | CI roda `bench:compare`, `test:e2e`, `test:a11y` | idem | 3 testes |
| 26.24.4 | Criar `.github/workflows/deploy.yml` (em `main`) | idem | arquivo existe |
| 26.24.5 | Deploy para Cloudflare Pages / GitHub Pages | idem | 1 teste |
| 26.24.6 | Criar `.github/workflows/release.yml` (em tag) | idem | arquivo existe |
| 26.24.7 | Release gera assets e publica | idem | 1 teste |
| 26.24.8 | CI verde em main | idem | relatório |

---

## Bloco H — Verificação final

### 26.25 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 26.25.1 | `deno task check-all` verde | exit 0 |
| 26.25.2 | `deno task golden:test` verde | exit 0 |
| 26.25.3 | `deno task test:e2e` verde | exit 0 |
| 26.25.4 | `deno task test:a11y` verde | exit 0 |
| 26.25.5 | ADR 033 criada e commitada | git log |
| 26.25.6 | Relatório de conformidade gerado | arquivo existe |
| 26.25.7 | Release 1.0 publicado com tag | git tag |
| 26.25.8 | Auditoria: cada subfase do plano `fase-21-compatibilidade-qualidade.md` tem tarefas correspondentes | grep |

---

## Notas para a IA

1. **Ordem:** 26.0 → 26.1 → ... → 26.24 → 26.25.
2. **Golden tests são o critério primário.** Se divergir, corrigir código ou documentar divergência.
3. **Normalização é crítica.** Fixar UTC; colapsar whitespace; tolerância `1e-6` para floats.
4. **Fixtures commitadas.** CI não depende de `tj3` se outputs estiverem em JSON.
5. **AST equivalence** normaliza `name`.
6. **Snapshots** com `@std/testing/snapshot`.
7. **Benchmarks com baseline.** Regressão > 20% falha.
8. **Segurança** com OWASP vectors.
9. **CSP estrita.** `unsafe-inline` só para BeerCSS.
10. **Cross-browser 3/3.** Chromium, Firefox, WebKit.
11. **A11y com `axe-core`.** Zero issues críticos.
12. **Lighthouse ≥ 90.**
13. **SemVer `1.0.0`.**
14. **CHANGELOG completo.**
15. **CI roda tudo.**
16. **Sem `any` em `src/`.**
17. **Commit por subfase.** `test(quality): golden-parser`, etc.
18. **Relatório de conformidade gerado automaticamente.**
19. **Documentar divergências conhecidas** em `10-futuro.md`.
20. **Não adicionar features novas.** Fase de validação apenas.

---

## ADR 033 (referência rápida)

Criado como subfase 26.0. Conteúdo esperado:

- **Título:** Estratégia de validação
- **Contexto:** provar fidelidade, i18n, performance, segurança.
- **Decisões:**
  - Golden tests (`tj3` vs `tj3-ts`) como referência.
  - AST equivalence para i18n.
  - Regression snapshots.
  - Benchmarks com baseline.
  - Playwright cross-browser.
  - `axe-core` a11y.
  - Lighthouse ≥ 90.
- **Alternativas:** testes manuais; apenas unit.
- **Consequências:** confiança alta; custo de manutenção.

---

**Fim do arquivo de tarefas da Fase 21.**