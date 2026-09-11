# Fase 21 — Compatibilidade e Qualidade

> **Arquivo:** `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 12–15 dias
> **Depende de:** Fases 1–20
> **Bloqueia:** release

---

## 1. Contexto

Esta é a **fase final de validação**. O motor está completo (Fases 2–19), a UI funciona (Fase 20). Agora provamos que o SyntaxMesh é **fiel ao TaskJuggler** e **pronto para produção**.

### Objetivos centrais

1. **Provar fidelidade** ao TaskJuggler 3.8.4 via golden tests.
2. **Provar equivalência multilíngue** (en ↔ pt-BR ↔ es).
3. **Provar robustez** em corpus real (MWEs + TestSuite).
4. **Provar performance** aceitável.
5. **Provar segurança** (XSS, sanitização, CSP).
6. **Provar cross-browser** (Chromium, Firefox, Safari).
7. **Provar qualidade de release** (build, Lighthouse, acessibilidade).

### Estratégia de validação

```
Corpus de entrada (MWEs + TestSuite + traduções)
   ↓
[SyntaxMesh]  ↔  [tj3 (Ruby)]
   ↓
Comparação de saídas (normalizadas)
   ↓
Relatório de conformidade
```

**Princípio:** se o `tj3` real produz X e o SyntaxMesh produz Y, X e Y devem ser **iguais** dentro das tolerâncias definidas.

### Categorias de testes

| Categoria | Ferramenta | Volume esperado |
|---|---|---|
| **Golden tests** (fidelidade) | `tj3` + diff normalizado | ≥ 200 fixtures |
| **AST equivalence** (i18n) | Comparador próprio | ≥ 30 fixtures × 3 idiomas |
| **Regression tests** | Snapshot próprio | ≥ 100 snapshots |
| **Performance benchmarks** | `deno bench` | ≥ 10 benchmarks |
| **Security tests** | OWASP vectors | ≥ 40 vectors |
| **Cross-browser E2E** | Playwright | ≥ 30 cenários × 3 browsers |
| **A11y tests** | `axe-core` | ≥ 20 cenários |
| **Lighthouse** | Lighthouse CI | 4 categorias |

### O que "fidelidade" significa

Para **cada** `.tjp` de entrada:

- **Parsing** idêntico (AST igual ou equivalente).
- **Diagnostics** idênticos (mesma severidade, mesma mensagem ou mensagem traduzida equivalente, mesma localização).
- **Scheduling** idêntico (datas, esforço, recursos).
- **Reports** idênticos (HTML normalizado, CSV byte-a-byte).

Se algo divergir:

1. **Bug no SyntaxMesh** → corrigir.
2. **Feature do TJ não portada** → documentar em `docs/syntaxmesh/10-futuro.md`.
3. **Erro no golden** → corrigir fixture.

---

## 2. Objetivo

Ao final desta fase:

- Corpus organizado em `tests/fixtures/` (MWEs, TestSuite, traduções).
- Golden tests end-to-end (`tj3` vs `tj3-ts`) em ≥ 200 fixtures.
- Testes de equivalência multilíngue (en ↔ pt-BR ↔ es) em ≥ 30 fixtures.
- Regression tests (snapshots) em ≥ 100 pontos.
- Benchmarks em ≥ 10 cenários.
- Testes de segurança (XSS, sanitização, CSP).
- Testes cross-browser (Playwright em 3 browsers).
- Testes de acessibilidade (`axe-core`).
- Lighthouse ≥ 90 em PWA, Performance, Accessibility, Best Practices.
- Relatório de conformidade (`docs/syntaxmesh/10-futuro.md` atualizado).
- **≥ 500 testes automatizados** no total.
- ADR 033 registrado (estratégia de validação).
- Release 1.0 pronto.

---

## 3. Referências

### 3.1 Fontes de fixtures

- `docs/Learning/mwe001-009/` — 9 MWEs.
- `docs/taskjuggler/test/TestSuite/` — ~250 fixtures de teste.
- `docs/taskjuggler/test/TestSuite/Syntax/Correct/` — ~150 `.tjp` válidos.
- `docs/taskjuggler/test/TestSuite/Syntax/Errors/` — ~50 `.tjp` com erro.
- `docs/taskjuggler/test/TestSuite/Scheduler/Correct/` — ~30 fixtures.
- `docs/taskjuggler/test/TestSuite/Reports/` — ~20 fixtures.

### 3.2 Ferramentas

- **`tj3`** — instalação via Ruby gem (referência).
- **`deno bench`** — benchmarks nativos.
- **Playwright** — E2E cross-browser.
- **`axe-core`** — acessibilidade.
- **Lighthouse CI** — qualidade PWA.

### 3.3 Documentos de referência

- `docs/syntaxmesh/03-arquitetura.md`.
- `docs/syntaxmesh/06-testes-e-processo.md`.
- `docs/syntaxmesh/10-futuro.md`.
- `docs/syntaxmesh/decisoes/006-build-pipeline-deno-tasks.md`.
- ADRs 001–032.

---

## 4. Decisões de port

### 4.1 Normalização de saídas

Antes de comparar com o `tj3`, normalizar:

- **Datas**: formato ISO → timestamp UTC.
- **Timezone**: fixar `UTC` no golden.
- **Whitespace**: colapsar.
- **Paths absolutos**: substituir por `<PATH>`.
- **Versão**: substituir `tj3 vX.Y.Z` por `tj3 v<VER>`.
- **IDs gerados**: substituir `_Task_N` por `<ID>`.
- **Ordem de atributos**: ordenar alfabeticamente quando aplicável.
- **Float**: comparar com tolerância `1e-6`.
- **HTML**: normalizar com parser DOM + serialização canônica.

### 4.2 Golden tests — pipeline

Para cada fixture:

1. Rodar `tj3 <fixture>` (capturar stdout/stderr + saídas geradas).
2. Rodar `tj3-ts <fixture>` (capturar stdout/stderr + saídas geradas).
3. Normalizar ambos.
4. Comparar com tolerância.
5. Se divergir:
   - Registrar diferença.
   - Marcar fixture como `known_divergence` (se aceito) ou `bug` (se corrigir).

**Estrutura do corpus:**

```
tests/fixtures/
├── mwe001/
│   ├── tutorial.tjp           (input)
│   ├── tj3.expected.json      (saída do tj3)
│   └── tj3-ts.actual.json     (saída do tj3-ts — gerada)
├── mwe002/
├── ...
├── syntax/
│   ├── correct/
│   └── errors/
├── scheduler/
│   └── correct/
└── reports/
```

### 4.3 AST equivalence — i18n

Para cada MWE:

1. Parsing em `en` → AST_en.
2. Parsing em `pt-BR` → AST_pt.
3. Parsing em `es` → AST_es.
4. Normalizar (nomes de tasks viram `<TASK>`).
5. Comparar estruturalmente.

**Comparação:**

- IDs iguais.
- Hierarquia igual.
- Atributos iguais (exceto `name`).
- Depends iguais.
- Valores iguais.

### 4.4 Regression tests

Snapshots congelados de:

- AST de cada fixture.
- Diagnostics de cada erro.
- Saída de `to_s`, `to_html`, `to_markdown` do RichText/Markdown.
- Saída de reports (HTML normalizado, CSV).
- HTML do Gantt.

**Ferramenta:** `@std/testing/snapshot` + `Deno.makeTempDir`.

**Regra:** snapshot divergiu → revisar manualmente → aceitar ou corrigir.

### 4.5 Performance benchmarks

Benchmarks em cenários representativos:

| Cenário | Complexidade | Alvo |
|---|---|---|
| Parse 100 tasks | Média | < 50ms |
| Parse 1000 tasks | Alta | < 500ms |
| Schedule 100 tasks, 10 recursos | Média | < 200ms |
| Schedule 1000 tasks, 100 recursos | Alta | < 3s |
| Generate Gantt 500 tasks | Alta | < 1s |
| Generate 10 reports | Média | < 1s |
| Calcular criticalness 1000 tasks | Alta | < 100ms |
| `getEffectiveWork` em 10k queries | Alta | < 200ms |
| Lexing 10k linhas | Média | < 100ms |
| Full pipeline MWE | Baixa | < 100ms |

**Ferramenta:** `deno bench`.

### 4.6 Segurança

Vectors OWASP:

- **XSS em Markdown** — `<script>`, `<img onerror>`, `javascript:`.
- **XSS em RichText** — `<html>` blocks.
- **XSS em reports HTML** — nomes de task com payloads.
- **Path traversal** — `../` em nomes de arquivos.
- **DoS via input gigante** — 10MB de `.tjp`.
- **DoS via recursão** — dependências circulares.
- **CSV injection** — `=CMD|...` em campos.
- **iCal injection** — newlines em campos.
- **CSP bypass** — inline scripts.

**Ferramenta:** testes dedicados + `axe-core`.

### 4.7 Cross-browser

Browsers alvo:

- **Chromium** (Chrome, Edge).
- **Firefox**.
- **WebKit** (Safari).

Cenários:

- Abrir app → criar projeto → editar → salvar.
- Importar `.tjp`.
- Agendar → ver Gantt.
- Gerar report.
- Download/upload `.tji`.
- Trocar locale.
- Trocar tema.
- Instalar PWA.
- Funcionar offline.

**Ferramenta:** Playwright.

### 4.8 Acessibilidade

Regras:

- Contraste WCAG AA (4.5:1 texto; 3:1 UI).
- Navegação por teclado (tab, shift+tab, enter, esc).
- ARIA labels em ícones.
- Foco visível.
- Sem armadilha de foco.

**Ferramenta:** `axe-core` + Lighthouse.

### 4.9 Lighthouse

Categorias:

| Categoria | Alvo |
|---|---|
| PWA | ≥ 90 |
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 90 |
| SEO | ≥ 90 |

**Ferramenta:** Lighthouse CI.

### 4.10 Relatório de conformidade

Gerar `docs/syntaxmesh/10-futuro.md` atualizado com:

- Features portadas (100%).
- Features **não** portadas (lista + justificativa).
- Divergências conhecidas (lista + mitigação).
- Roadmap pós-1.0.

### 4.11 CI/CD

Pipeline GitHub Actions (ou equivalente):

1. `deno task check-all`.
2. `deno task golden:generate` (requer `tj3`).
3. `deno task golden:test`.
4. `deno task bench` (compara com baseline).
5. `deno task test:e2e` (Playwright).
6. `deno task test:a11y` (axe-core).
7. Lighthouse CI.
8. Deploy preview (Cloudflare Pages).

### 4.12 Versionamento e release

- **SemVer**: `1.0.0` no primeiro release.
- **CHANGELOG.md** com todas as fases.
- **Git tag** `v1.0.0`.
- **Release notes** geradas.
- **Assets**: `dist.zip`, `bundle.js`, `bundle.css`.

### 4.13 Documentação final

- **README** com instalação, uso, exemplos.
- **Manual** (`docs/manual/`).
- **API docs** (TypeDoc).
- **Guia de migração** (`tj3` → `tj3-ts`).
- **Guia de desenvolvimento** (contributing).

### 4.14 Bug reporting

Criar template `.github/ISSUE_TEMPLATE/`:

- Bug report.
- Feature request.
- Documentation.

### 4.15 Não é escopo

- Otimização extrema de performance (já feito).
- Suporte a browsers antigos.
- Backend.
- Sincronização em nuvem.
- Colaboração em tempo real.

---

## 5. Subfases detalhadas

**Bloco A — Fundação** (26.0–26.2)
**Bloco B — Golden tests** (26.3–26.7)
**Bloco C — i18n e regressão** (26.8–26.10)
**Bloco D — Performance e segurança** (26.11–26.14)
**Bloco E — Cross-browser e a11y** (26.15–26.18)
**Bloco F — Release** (26.19–26.24)

---

### Bloco A — Fundação

---

### 26.0 — ADR 033 (estratégia de validação)

#### Contexto

Como provar fidelidade ao TaskJuggler? Como validar i18n? Como garantir performance? Precisamos registrar a estratégia.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/033-estrategia-validacao.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/033-estrategia-validacao.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** necessidade de validação rigorosa.
- [ ] **Decisões:**
  - **Golden tests** (`tj3` vs `tj3-ts`) como referência primária.
  - **AST equivalence** para i18n.
  - **Regression snapshots** para estabilidade.
  - **Benchmarks** com baseline.
  - **Cross-browser** com Playwright.
  - **A11y** com `axe-core`.
  - **Lighthouse ≥ 90**.
- [ ] **Alternativas:** testes manuais (frágil); apenas unit tests (insuficiente).
- [ ] **Consequências:** confiança alta; custo de manutenção.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/syntaxmesh/06-testes-e-processo.md`.
- Fase 2, subfase 5.14 (infraestrutura).

#### Critério de aceite

- ADR 033 criado.

---

### 26.1 — Corpus de fixtures

#### Contexto

Organizar todas as fixtures em `tests/fixtures/`.

#### Objetivo

Copiar e organizar.

#### Arquivos

- `tests/fixtures/mwe001-009/` — 9 MWEs.
- `tests/fixtures/syntax/correct/` — ~150 `.tjp`.
- `tests/fixtures/syntax/errors/` — ~50 `.tjp`.
- `tests/fixtures/scheduler/correct/` — ~30 `.tjp`.
- `tests/fixtures/reports/` — ~20 `.tjp`.
- `tests/fixtures/README.md` — índice.

#### Requisitos

- [ ] Copiar fixtures de `docs/Learning/` e `docs/taskjuggler/test/TestSuite/`.
- [ ] Adicionar `README.md` explicando origem.
- [ ] Cada fixture com ID único.

#### Referências

- `docs/taskjuggler/test/TestSuite/`.

#### Critério de aceite

- ≥ 200 fixtures em `tests/fixtures/`.

#### Testes

- `corpus_test.ts`:
  - `it("cada fixture tem ID único")`.
  - `it("cada fixture é .tjp ou .tji")`.

---

### 26.2 — Script `tj3-runner.ts` (referência)

#### Contexto

Rodar `tj3` e capturar saída normalizada.

#### Objetivo

Implementar.

#### Arquivos

- `scripts/golden/tj3-runner.ts`
- `scripts/golden/tj3-normalizer.ts`
- `scripts/golden/README.md` (atualizar)

#### Requisitos

- [ ] `runTj3(fixturePath): Promise<Tj3Output>`:
  - `Deno.Command('tj3', { args: [fixturePath] })`.
  - Captura stdout, stderr, exit code.
  - Lê arquivos gerados (`.html`, `.csv`, `.ics`).
- [ ] `normalizeTj3Output(output): NormalizedOutput`.
- [ ] Salva em `tests/fixtures/<id>/tj3.expected.json`.

#### Referências

- `docs/syntaxmesh/decisoes/006-build-pipeline-deno-tasks.md` (task `taskjuggler`).

#### Critério de aceite

- Script roda em todos os MWEs.

#### Testes

- `tj3-runner_test.ts`:
  - `it("roda mwe001")`.
  - `it("captura exit code")`.
  - `it("lê arquivos gerados")`.

---

### Bloco B — Golden tests

---

### 26.3 — `tj3-ts-runner.ts` (sujeito)

#### Contexto

Rodar `tj3-ts` (SyntaxMesh) e capturar saída normalizada.

#### Objetivo

Implementar.

#### Arquivos

- `scripts/golden/tj3-ts-runner.ts`
- `scripts/golden/tj3-ts-normalizer.ts`

#### Requisitos

- [ ] `runTj3Ts(fixturePath): Promise<Tj3TsOutput>`:
  - Lê `.tjp`.
  - `TaskJuggler.parseContent`.
  - `schedule()`.
  - `generateReports()`.
- [ ] Mesmo formato de output do `tj3-runner`.

#### Critério de aceite

- Outputs comparáveis.

#### Testes

- `tj3-ts-runner_test.ts`:
  - `it("roda mwe001")`.
  - `it("formato igual ao tj3-runner")`.

---

### 26.4 — `comparator.ts` (comparador)

#### Contexto

Comparar saídas normalizadas.

#### Objetivo

Implementar.

#### Arquivos

- `scripts/golden/comparator.ts`
- `scripts/golden/comparator_test.ts`

#### Requisitos

- [ ] `compare(expected, actual): Diff[]`:
  - Comparar ASTs (deep equal, tolerância `1e-6`).
  - Comparar diagnostics (id, message, lineNo).
  - Comparar datas (timestamps UTC).
  - Comparar números (tolerância).
  - Comparar HTML (DOM normalized).
  - Comparar CSV (linha por linha).
- [ ] Cada `Diff` com path (JSON pointer) + valores.

#### Critério de aceite

- Comparador detecta divergências.

#### Testes

- `comparator_test.ts`:
  - `it("AST iguais")`.
  - `it("AST diferentes")`.
  - `it("float com tolerância")`.
  - `it("HTML normalizado")`.

---

### 26.5 — Golden tests end-to-end

#### Contexto

Rodar todos os golden tests.

#### Objetivo

Implementar suite.

#### Arquivos

- `scripts/golden/run-all.ts`
- `tests/golden/mwe_golden_test.ts`
- `tests/golden/syntax_golden_test.ts`
- `tests/golden/scheduler_golden_test.ts`
- `tests/golden/reports_golden_test.ts`

#### Requisitos

- [ ] Para cada fixture:
  - Rodar `tj3` (se ainda não rodou).
  - Rodar `tj3-ts`.
  - Comparar.
  - Se divergir, marcar como `known_divergence` ou `bug`.
- [ ] Gerar relatório em `docs/syntaxmesh/conformance-report.md`.
- [ ] ≥ 200 fixtures.

#### Referências

- Fase 2, subfase 5.14.

#### Critério de aceite

- ≥ 95% das fixtures com paridade.
- Divergências documentadas.

#### Testes

- `mwe_golden_test.ts`:
  - `describe("Golden MWE")` — itera 9.
- `syntax_golden_test.ts`:
  - `describe("Golden Syntax")` — itera ~200.
- `scheduler_golden_test.ts`:
  - `describe("Golden Scheduler")` — itera ~30.
- `reports_golden_test.ts`:
  - `describe("Golden Reports")` — itera ~20.

---

### 26.6 — Divergências conhecidas

#### Contexto

Algumas divergências são **aceitas** (limitações do port ou diferenças intencionais).

#### Objetivo

Documentar.

#### Arquivos

- `docs/syntaxmesh/10-futuro.md` (atualizar)
- `tests/golden/known-divergences.json`

#### Requisitos

- [ ] Lista de divergências com:
  - Fixture.
  - Descrição.
  - Justificativa.
  - Mitigação (se aplicável).
  - Prioridade (baixa/média/alta).
- [ ] Cada divergência referenciada em `10-futuro.md`.

**Exemplos esperados:**
- Ordem de atributos em HTML (não afeta funcionalidade).
- Float precision em financial (tolerância `1e-6`).
- `novevents` do iCal (feature opcional).
- NikuReport (feature opcional).
- Mensagens de erro com tradução pt-BR (diferentes do original en).

#### Critério de aceite

- ≥ 0 divergências não documentadas.

---

### 26.7 — Relatório de conformidade

#### Contexto

Documento consolidado.

#### Objetivo

Gerar.

#### Arquivos

- `docs/syntaxmesh/conformance-report.md`
- `scripts/golden/generate-report.ts`

#### Requisitos

- [ ] Estrutura:
  - **Resumo:** X/Y fixtures com paridade.
  - **Por categoria:** MWE, Syntax, Scheduler, Reports.
  - **Divergências conhecidas:** lista.
  - **Features ausentes:** lista.
  - **Data da última verificação.**
  - **Versões:** `tj3 3.8.4`, `tj3-ts 1.0.0`.
- [ ] Gerado automaticamente.

#### Critério de aceite

- Relatório legível, atualizado.

---

### Bloco C — i18n e regressão

---

### 26.8 — AST equivalence (en ↔ pt-BR ↔ es)

#### Contexto

Provar que idiomas produzem AST idêntica.

#### Objetivo

Implementar suite.

#### Arquivos

- `tests/i18n/ast_equivalence_test.ts`
- `tests/fixtures/i18n/en/`
- `tests/fixtures/i18n/pt-BR/`
- `tests/fixtures/i18n/es/`

#### Requisitos

- [ ] Para cada MWE:
  - Traduzir para pt-BR.
  - Traduzir para es.
  - Parsear cada versão.
  - Normalizar (nomes → `<TASK>`).
  - Comparar estruturalmente.
- [ ] ≥ 30 fixtures × 3 idiomas.

#### Referências

- Fase 10, subfase 14.18.

#### Critério de aceite

- 100% das fixtures com AST idêntica.

#### Testes

- `ast_equivalence_test.ts`:
  - `describe("AST equivalence")` — itera.

---

### 26.9 — Regression snapshots

#### Contexto

Snapshots congelados previnem regressões.

#### Objetivo

Implementar.

#### Arquivos

- `tests/regression/ast_snapshot_test.ts`
- `tests/regression/diagnostics_snapshot_test.ts`
- `tests/regression/richtext_snapshot_test.ts`
- `tests/regression/report_snapshot_test.ts`
- `tests/regression/gantt_snapshot_test.ts`
- `tests/regression/__snapshots__/` (gerado)

#### Requisitos

- [ ] Snapshot de AST para cada fixture.
- [ ] Snapshot de diagnostics para cada erro.
- [ ] Snapshot de `RichText.to_s`/`to_html`/`to_tagged`.
- [ ] Snapshot de `Markdown.to_markdown`.
- [ ] Snapshot de reports (HTML normalizado).
- [ ] Snapshot de Gantt HTML.
- [ ] ≥ 100 snapshots.

**Ferramenta:** `@std/testing/snapshot`.

#### Referências

- `docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md`.

#### Critério de aceite

- Snapshots atualizados.

#### Testes

- `ast_snapshot_test.ts`:
  - `describe("AST snapshots")` — itera.

---

### 26.10 — Testes unitários consolidados

#### Contexto

Garantir cobertura global.

#### Objetivo

Rodar todos os testes unitários.

#### Arquivos

- `deno.jsonc` — task `test:all`.

#### Requisitos

- [ ] Task `test:all` roda:
  - `packages/*/tests/**`.
  - `tests/unit/**`.
- [ ] Cobertura ≥ 85%.
- [ ] Relatório em `docs/syntaxmesh/coverage.md`.

#### Critério de aceite

- Cobertura ≥ 85%.

---

### Bloco D — Performance e segurança

---

### 26.11 — Benchmarks

#### Contexto

Medir performance.

#### Objetivo

Implementar.

#### Arquivos

- `bench/parse_bench.ts`
- `bench/schedule_bench.ts`
- `bench/report_bench.ts`
- `bench/gantt_bench.ts`
- `bench/rich_text_bench.ts`
- `bench/query_bench.ts`
- `bench/baseline.json`

#### Requisitos

- [ ] ≥ 10 benchmarks.
- [ ] Baseline salvo em `baseline.json`.
- [ ] CI compara com baseline; falha se regredir > 20%.

**Exemplos:**
```ts
Deno.bench("parse 100 tasks", () => {
  parser.parse(loadFixture("100-tasks.tjp"));
});
```

#### Referências

- `deno bench`.

#### Critério de aceite

- Todos os benchmarks < 2× baseline.

#### Testes

- `bench_test.ts`:
  - `it("baseline existe")`.
  - `it("sem regressão > 20%")`.

---

### 26.12 — Testes de segurança

#### Contexto

Vectors OWASP.

#### Objetivo

Implementar.

#### Arquivos

- `tests/security/xss_test.ts`
- `tests/security/path_traversal_test.ts`
- `tests/security/dos_test.ts`
- `tests/security/csv_injection_test.ts`
- `tests/security/ical_injection_test.ts`
- `tests/security/fixtures/owasp/`

#### Requisitos

- [ ] **XSS em Markdown**:
  - `<script>alert(1)</script>` → sanitizado.
  - `<img onerror=...>` → sanitizado.
  - `[link](javascript:...)` → rejeitado.
- [ ] **XSS em RichText**:
  - `<html><script>...</script></html>` → sanitizado.
- [ ] **XSS em reports**:
  - Task com nome `<script>` → escapado no HTML.
- [ ] **Path traversal**:
  - `../../etc/passwd` em nomes de arquivo → rejeitado.
- [ ] **DoS**:
  - `.tjp` de 10MB → erro controlado.
  - Dependência circular → erro controlado.
  - Macros recursivas → limite de 20.
- [ ] **CSV injection**:
  - `=CMD|...` em campos → escapado.
- [ ] **iCal injection**:
  - `\n` em campos → escapado.
- [ ] ≥ 40 vectors.

#### Critério de aceite

- Zero XSS.
- Zero bypass.
- Erros controlados.

#### Testes

- `xss_test.ts`:
  - `describe("XSS")` — itera vectors.

---

### 26.13 — CSP

#### Contexto

Content Security Policy.

#### Objetivo

Configurar.

#### Arquivos

- `packages/server/src/csp.ts`
- `packages/ui/public/_headers` (Cloudflare Pages)
- `docs/syntaxmesh/csp.md`

#### Requisitos

- [ ] CSP:
  - `default-src 'self'`.
  - `script-src 'self' 'wasm-unsafe-eval'`.
  - `style-src 'self' 'unsafe-inline'` (BeerCSS).
  - `img-src 'self' data:`.
  - `connect-src 'self'`.
  - `frame-ancestors 'none'`.
  - `base-uri 'self'`.
  - `form-action 'self'`.

#### Critério de aceite

- App carrega com CSP estrita.

#### Testes

- `csp_test.ts`:
  - `it("headers corretos")`.

---

### 26.14 — Otimização final

#### Contexto

Ajustar performance onde benchmarks indicaram.

#### Objetivo

Aplicar correções.

#### Arquivos

- Vários (dependendo do resultado dos benchmarks).

#### Requisitos

- [ ] Analisar `bench` report.
- [ ] Otimizar top 3 hotspots.
- [ ] Re-rodar benchmarks.
- [ ] Documentar em `docs/syntaxmesh/performance.md`.

#### Critério de aceite

- Todos os benchmarks dentro do alvo.

---

### Bloco E — Cross-browser e a11y

---

### 26.15 — Playwright setup

#### Contexto

E2E cross-browser.

#### Objetivo

Configurar.

#### Arquivos

- `playwright.config.ts`
- `tests/e2e/fixtures/`
- `tests/e2e/helpers/`

#### Requisitos

- [ ] Browsers: Chromium, Firefox, WebKit.
- [ ] Servidor de teste: `packages/server` (Deno).
- [ ] Base URL: `http://localhost:8080`.

#### Critério de aceite

- `deno task test:e2e` roda.

---

### 26.16 — Cenários E2E

#### Contexto

Cobrir fluxos críticos.

#### Objetivo

Implementar.

#### Arquivos

- `tests/e2e/project-crud.spec.ts`
- `tests/e2e/editor-parse.spec.ts`
- `tests/e2e/schedule-gantt.spec.ts`
- `tests/e2e/report.spec.ts`
- `tests/e2e/sheets.spec.ts`
- `tests/e2e/i18n.spec.ts`
- `tests/e2e/theme.spec.ts`
- `tests/e2e/pwa-offline.spec.ts`

#### Requisitos

- [ ] ≥ 30 cenários × 3 browsers = ≥ 90 execuções.
- [ ] Cada cenário testa funcionalidade crítica.

#### Critério de aceite

- 100% verde nos 3 browsers.

#### Testes

- `project-crud.spec.ts`:
  - `test("cria projeto")`.
  - `test("edita projeto")`.
  - `test("remove projeto")`.

---

### 26.17 — Acessibilidade

#### Contexto

WCAG AA.

#### Objetivo

Implementar.

#### Arquivos

- `tests/a11y/*.spec.ts`

#### Requisitos

- [ ] `axe-core` em cada view.
- [ ] Contraste ≥ 4.5:1.
- [ ] Navegação por teclado.
- [ ] ARIA em ícones.
- [ ] Foco visível.
- [ ] Sem armadilha de foco.
- [ ] ≥ 20 cenários.

#### Critério de aceite

- Zero issues críticos no `axe-core`.

#### Testes

- `a11y.spec.ts`:
  - `test("Toolbar sem issues")`.
  - `test("Editor sem issues")`.

---

### 26.18 — Lighthouse CI

#### Contexto

Qualidade PWA.

#### Objetivo

Configurar.

#### Arquivos

- `lighthouserc.json`

#### Requisitos

- [ ] Rodar Lighthouse em `dist/`.
- [ ] Alvos:
  - PWA ≥ 90.
  - Performance ≥ 90.
  - Accessibility ≥ 95.
  - Best Practices ≥ 90.
  - SEO ≥ 90.

#### Critério de aceite

- Todos os alvos atingidos.

---

### Bloco F — Release

---

### 26.19 — Build de produção

#### Contexto

Gerar pacote final.

#### Objetivo

Implementar.

#### Arquivos

- `esbuild.ts` (revisar)
- `deno.jsonc` (task `build:prod`)

#### Requisitos

- [ ] Minifica JS + CSS.
- [ ] Tree-shaking.
- [ ] Source maps (opcional).
- [ ] Copia `public/` para `dist/`.
- [ ] Gera `sw.js`.
- [ ] Assets com hash.

#### Critério de aceite

- `dist/` gera e funciona offline.

#### Testes

- `build_test.ts`:
  - `it("dist/ contém index.html")`.
  - `it("dist/ contém sw.js")`.
  - `it("dist/ contém manifest.json")`.

---

### 26.20 — CHANGELOG e release notes

#### Contexto

Documentar release.

#### Objetivo

Gerar.

#### Arquivos

- `CHANGELOG.md`
- `docs/syntaxmesh/release-notes/v1.0.0.md`

#### Requisitos

- [ ] CHANGELOG com todas as fases.
- [ ] Release notes com:
  - Novidades.
  - Breaking changes.
  - Bugs corrigidos.
  - Agradecimentos.

#### Critério de aceite

- CHANGELOG completo.

---

### 26.21 — Versionamento

#### Contexto

SemVer.

#### Objetivo

Aplicar.

#### Arquivos

- `deno.jsonc` — `version: "1.0.0"`.
- `packages/*/deno.jsonc` — sincronizado.

#### Requisitos

- [ ] Versão `1.0.0`.
- [ ] Git tag `v1.0.0`.
- [ ] Release no GitHub (ou equivalente).

#### Critério de aceite

- Tag criada.

---

### 26.22 — Documentação final

#### Contexto

Completar docs.

#### Objetivo

Escrever.

#### Arquivos

- `README.md` (raiz).
- `docs/manual/index.md`.
- `docs/contributing.md`.
- `docs/migration-tj3-to-syntaxmesh.md`.
- API docs via TypeDoc.

#### Requisitos

- [ ] README com instalação, uso, exemplos.
- [ ] Manual com features.
- [ ] Guia de migração `tj3` → `syntaxmesh`.
- [ ] Guia de contribuição.
- [ ] API docs geradas.

#### Critério de aceite

- Docs públicas.

---

### 26.23 — Templates de issues

#### Contexto

Facilitar feedback.

#### Objetivo

Criar.

#### Arquivos

- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/documentation.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

#### Requisitos

- [ ] Templates prontos.
- [ ] Guia de contribuição em `CONTRIBUTING.md`.

#### Critério de aceite

- Templates disponíveis.

---

### 26.24 — CI/CD final

#### Contexto

Automatizar tudo.

#### Objetivo

Configurar.

#### Arquivos

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/release.yml`

#### Requisitos

- [ ] **CI** (em cada PR):
  - `deno task check-all`.
  - `deno task test:all`.
  - `deno task golden:test`.
  - `deno task bench:compare`.
  - `deno task test:e2e`.
  - `deno task test:a11y`.
  - Lighthouse CI.
- [ ] **Deploy** (em `main`):
  - Build.
  - Deploy para Cloudflare Pages / GitHub Pages.
- [ ] **Release** (em tag):
  - Gera assets.
  - Publica.

#### Critério de aceite

- CI verde.
- Deploy automático.

---

## 6. Ordem de execução sugerida

```text
26.0  ADR 033
26.1  Corpus de fixtures
26.2  tj3-runner
      ↓
26.3  tj3-ts-runner
26.4  comparator
26.5  Golden tests
26.6  Divergências conhecidas
26.7  Relatório de conformidade
      ↓
26.8  AST equivalence i18n
26.9  Regression snapshots
26.10 Testes unitários consolidados
      ↓
26.11 Benchmarks
26.12 Testes de segurança
26.13 CSP
26.14 Otimização final
      ↓
26.15 Playwright setup
26.16 Cenários E2E
26.17 Acessibilidade
26.18 Lighthouse CI
      ↓
26.19 Build de produção
26.20 CHANGELOG
26.21 Versionamento
26.22 Documentação final
26.23 Templates de issues
26.24 CI/CD final
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 21 é considerada concluída quando:

```bash
deno task check-all
deno task golden:test
deno task test:e2e
deno task test:a11y
```

passam, e:

- [ ] Corpus ≥ 200 fixtures.
- [ ] Golden tests ≥ 95% paridade.
- [ ] AST equivalence 100%.
- [ ] Regression snapshots ≥ 100.
- [ ] Benchmarks dentro do alvo.
- [ ] Security ≥ 40 vectors sem falha.
- [ ] Cross-browser 3/3 verde.
- [ ] A11y zero issues críticos.
- [ ] Lighthouse ≥ 90 em 5 categorias.
- [ ] Release 1.0 publicado.
- [ ] ADR 033 criado.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| `tj3` indisponível no CI | **Alto** | Cachear outputs em JSON commitados |
| Fixtures divergem por ambiente | Médio | Fixar timezone UTC; normalizar |
| Performance regride | Médio | Baseline + alerta CI |
| XSS bypass encontrado | **Alto** | Corrigir + adicionar vector |
| Safari com comportamento diferente | Alto | Playwright WebKit |
| iOS PWA com SW limitado | Médio | Documentar limitações |
| Lighthouse oscila | Baixo | Rodar 3× e tirar média |
| Divergência não documentada | Médio | Checklist de revisão |
| Escopo de release expande | Alto | Congelar features antes da Fase 21 |

---

## 9. Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/03-arquitetura.md`.
- `docs/syntaxmesh/06-testes-e-processo.md`.
- `docs/syntaxmesh/10-futuro.md`.
- `docs/syntaxmesh/decisoes/033-estrategia-validacao.md` (novo).
- `docs/syntaxmesh/conformance-report.md` (gerado).

### Fases referenciadas

- **Fase 2** — subfase 5.14 (infraestrutura).
- **Fase 6** — subfase 10.6 (golden limits).
- **Fase 7** — subfase 11.18 (golden scheduler).
- **Fase 10** — subfase 14.19 (golden parser).
- **Fase 14** — subfase 18.23 (golden reports).
- **Fase 15** — subfase 19.13 (golden gantt).
- **Fase 16** — subfase 20.19 (golden journal).
- **Fase 18** — subfase 22.15 (golden timesheets).
- **Fase 19** — subfase 24.12 (snapshot storage).

### Fases dependentes

- Nenhuma. Fase final.

---

## 10. Notas para a IA

1. **Golden tests são o critério primário.** Se divergir, corrigir código ou documentar.
2. **Normalização é crítica.** Fixar UTC; colapsar whitespace.
3. **Tolerância `1e-6`** para floats.
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
15. **Release notes com agradecimentos.**
16. **CI roda tudo.**
17. **Sem `any` em `src/`.**
18. **Commit por subfase.** `feat(quality): golden-tests`, etc.
19. **Relatório de conformidade gerado automaticamente.**
20. **Documentar divergências conhecidas** em `10-futuro.md`.

---

## 11. ADR 033 (referência rápida)

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

**Fim da Fase 21.**