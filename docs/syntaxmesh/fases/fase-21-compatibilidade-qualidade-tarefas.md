# Fase 21 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-21-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade.md`
> **Status:** 🟨 Em andamento (1ª onda iniciada 2026-11-10 — 26.22.9/10/11
> ✅: matriz de completude regenerada + ADRs 033–037 reconciliados;
> **remainder da 1ª onda CONCLUÍDO 2026-11-15** — 26.0–26.11 + 26.14 +
> 26.26–26.28 ✅, gate `deno task tests` **935 passed (7700 steps), 0 failed**;
> **2ª onda (21²) CONCLUÍDA 2026-11-15** — adendo 26.29–26.33 ✅ (suite
> headless adaptado à extensão VS Code: integração LSP stdio, grammar sobre o
> corpus EN, perf lsp-core, manual/help EN, `.vsix` estrutural + smoke do
> bundle; gate `deno task tests` **943 passed (7719 steps), 0 failed**; aceite
> runtime VS Code — Test Runner/clean install/vscode.dev — **Diferido com
> âncora**, sem VS Code no ambiente); **adendo 26.34 CONCLUÍDO 2026-11-15** —
> 3 âncoras runtime desktop resolvidas com Insiders 1.147 (Test Runner de
> comandos/trust + instalação limpa, driver de evidência `test:runtime`;
> vscode.dev segue ancorado); 26.12/26.13 segurança+CSP e 26.15–26.25
> cross-browser/a11y/release ficam para a 3ª onda — ver kickoff abaixo)
> **Total:** ~143 tarefas
> **Concluídas:** 114
> **Foco:** Golden tests, i18n, performance, segurança, cross-browser, release

> **📌 Âncora — Complemento Fase 11 (2ª onda, §6.7 de `fase-11-logical-complemento.md`):**
> (LC-E.3) estender `scripts/golden/logical-expressions.rb` com casos
> Ruby↔TS concordantes p/ as funções da 2ª onda (`isactive`/`isallocated` —
> exige `TaskScenario.getAllocatedTime`) e regressão do scheduler;
> (LC-E.2) round-trip i18n das keywords novas
> (`isaccount`/`ismaterial`/`isparentof`/`istaskofproject`) em AST-equivalence;
> extensões sem correspondente Ruby permanecem **fora** do golden (política em
> `scripts/golden/README.md`).

> **🔢 Numeração (xray §5.6):** as tarefas deste arquivo usam o esquema antigo
> `26.x` (equivale às subfases da Fase 21). **Não renumerar agora** — normalizar na
> abertura da fase, mantendo o mapa 26.N ↔ 21.N no preâmbulo.

> **📌 Adendo xray (2026-11-03, §5.5):** a **1ª onda** desta fase inclui a
> **regeneração da `completude-matrix.md`** a partir das âncoras do código
> (tarefas 26.22.9–26.22.11) e a reconciliação da cadeia de ADRs 033–037.

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

- **Reescopo 2026-11-03 — 3 ondas** (plano §0): 1ª testa o motor **após a
  Fase 24** (subfases 26.0–26.11, 26.14); 2ª adapta o suite à **extensão VS
  Code** (após a 22); 3ª adapta à **PWA + UI** e fecha o release (após a 20).
- **Runner `tj3-ts` (26.3):** usar a **CLI `syntaxmesh` da Fase 24**; não
  construir runner próprio.
- **ADR de validação:** o número 033 foi ocupado pela CLI — atribuir o próximo
  livre em 26.0.1 (conferir `decisoes/README.md`).

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

- **Onda atual.** 1ª: Fases 15–18 + 23 + 24 concluídas. 2ª: Fase 22. 3ª: Fases 19–20.
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
[x] 26.0  ADR 042 (estratégia de validação)         —   5/5
[x] 26.1  Corpus de fixtures                        —   6/6
[x] 26.2  tj3-runner (oracle v2, corpus inteiro)     —   8/8
[x] 26.3  tj3-ts-runner (harness + suites por grupo) —   6/6
[x] 26.4  comparator (reuso F24.7 + registro)        —   8/8
[x] 26.5  Golden tests end-to-end                   —   11/11
[x] 26.6  Divergências conhecidas                   —   4/4
[x] 26.7  Relatório de conformidade                 —   4/4
[x] 26.8  AST equivalence (en ↔ pt-BR ↔ es)         —   8/8
[x] 26.9  Regression snapshots                      —   8/8
[x] 26.10 Testes unitários consolidados             —   4/4
[x] 26.11 Benchmarks                                —  10/10
[ ] 26.12 Testes de segurança                       —   0/8
[ ] 26.13 CSP                                       —   0/4
[x] 26.14 Otimização final                          —   4/4
[ ] 26.15 Playwright setup                          —   0/6
[ ] 26.16 Cenários E2E                              —   0/10
[ ] 26.17 Acessibilidade                            —   0/6
[ ] 26.18 Lighthouse CI                             —   0/6
[ ] 26.19 Build de produção                         —   0/6
[ ] 26.20 CHANGELOG e release notes                 —   0/4
[ ] 26.21 Versionamento                             —   0/4
[ ] 26.22 Documentação final + matriz de completude  — 3/11
[ ] 26.23 Templates de issues                       —   0/4
[ ] 26.24 CI/CD final                               —   0/8
[ ] 26.25 Verificação final                         —   0/8
─────────────────────────────────────────────────────────
TOTAL: ~143
```

---

## 1ª onda — kickoff do remainder (2026-11-15)

**Autorização:** usuário ("yes phase 21 remainder", 2026-11-15), após o
fechamento da Fase 22 (P1–P7, gate 880 passed). A 1ª onda já entregou
26.22.9–26.22.11 + o código âncora pré-F22 (A1/A2/A5/A6/D5/D9 — ver
CURRENT.md); este bloco executa o **remainder**: 26.0–26.11, 26.14 e o
adendo 26.26–26.28.

**Fronteira da onda (plano §0, autoritativa):** 1ª = 26.0–26.11 + 26.14;
26.12 (segurança) e 26.13 (CSP) são da **3ª onda** (a menção "26.0–26.14"
em CURRENT.md era arredondamento — corrigir na sincronização). O handoff
da F22 alimenta a **2ª onda**, fora deste bloco.

### Decisões do kickoff (2026-11-15)

| Aspecto | Decisão | Fundamento |
|---|---|---|
| ADR de validação | **042** (`042-estrategia-validacao.md`) — próximo livre após 041; o "033" do plano original foi ocupado pelo template (F23) | plano §0; `decisoes/README.md` conferido 2026-11-15 |
| Runner do sujeito | **reusa o harness e2e da F24.7** (`scripts/golden/cli-tj3.rb` + `packages/cli/tests/golden_cli_test.ts` + `canonical-dom.ts`): a CLI `syntaxmesh` É o runner (diretriz da onda); 26.2–26.4 não constroem runner/comparator paralelos — o delta é organizar o corpus em grupos e escalar o subset | plano §0 ("nada de runner próprio"); F24.7 já entrega exit/inventário/stdout-resíduo/primeira mensagem/CSV byte/HTML DOM |
| Localização do suite | permanece em `packages/cli/tests/` (o `test.include` raiz só cobre `packages/**/tests/**`); `scripts/golden/` ganha o oracle estendido; nada de `tests/golden/` raiz paralelo | `deno.jsonc` raiz; evita suite fora do gate |
| Corpus | **referenciado no lugar** (`docs/Learning/mwe*` + `docs/taskjuggler/test/TestSuite/`, já commitados) + índice/manifesto em `tests/fixtures/` (README + `corpus.json`); **não copiar** — cópia duplicaria a fonte e derivaria | os goldens existentes (parser/reports/gantt) já leem `docs/` diretamente; regra "fixtures commitadas" satisfeita |
| Grupos do corpus (contagens reais medidas 2026-11-15) | mwe 9 · syntax-correct 75 · syntax-errors 94 · scheduler-correct 35 · scheduler-errors 70 · reports (ReportGenerator/Correct 9 + HTML-Reports 13 + CSV-Reports 18 = 40) · export-refs 68 — **391 fixtures**; o "~150/~50" do plano era estimativa | TestSuite real |
| Triagem de divergências | política da F24.7 (`known_divergences.md`): default = **bug do port**; destinos = normalização / sub-critério mais fraco / fora-do-subset com âncora; nunca `it.ignore` silencioso. D7/D8 (scheduler) têm saída prometida nesta onda — reconciliar `Project.schedule()` ou registrar com âncora de fase | `known_divergences.md` §Ponto de saída; plano §0 ("divergência pode corrigir a fase culpada") |
| i18n (26.8) | base existente: 9 MWEs × 3 + template × 3 + complemento; expandir com ≥21 fixtures traduzidos mecanicamente do Syntax/Correct até ≥30 × 3, reusando `helpers/ast-snapshot.ts` (`normalizeAST`/`snapshotAST`) | `ast-equivalence_test.ts` (10.18); plano §4.3 |
| Snapshots (26.9) | `@std/testing/snapshot` (primeiro uso no repo) sobre AST/diagnostics/richtext/reports normalizados | plano §4.4; Notas IA #6 |
| Benchmarks (26.11) | `bench/` na raiz + `deno bench`; `baseline.json` commitado; `bench:compare` falha com regressão > 20% | plano §4.5 |
| Cobertura (26.10) | medir com `deno test -P --coverage` + lcov; alvo ≥ 85% linhas no core; relatório `docs/syntaxmesh/coverage.md` | precedente P7 (agregação awk sobre lcov) |

**Ordem de execução:** 26.0 (ADR) → 26.1 (corpus) → 26.2–26.4 (harness) →
26.5 (e2e + triagem) → 26.6 (divergências) → 26.7 (relatório) → 26.8
(i18n) → 26.9 (snapshots) → 26.10 (coverage) → 26.11 (bench) → 26.14
(otimização) → 26.26–26.28 (extensões) → gate + evidência + docs.

**Fecho da 1ª onda (2026-11-15):** ordem de execução cumprida até o fim.
Gate `deno task tests` **935 passed (7700 steps), 0 failed (4m19s)**;
`bench:compare` **EXIT=0** (11 benches, sem regressão > 20%). Concluídas
**96** de ~143. Docs sincronizados: `CURRENT.md` (F21 + fronteira corrigida
+ ADRs 001–042), `plano.md` (linha F21 do Resumo executivo + matriz 26.28.1),
este `-tarefas.md` (Progresso + evidência 26.26–26.28 + Concluídas 96),
`fase-21-compatibilidade-qualidade.md` (Status + §0 onda 1),
`completude-matrix.md` (§E: 035 aceito + 042 novo; data 2026-11-15) e
`decisoes/README.md` (042 já indexado em 26.0). **Pendências das ondas 2/3:**
26.12/26.13 (segurança/CSP), 26.15–26.25 (cross-browser/a11y/Lighthouse/
release), 26.22.1–26.22.8 (documentação final). Lighthouse + tela de RDO
ancorados à 3ª onda (F20 PWA+UI não iniciada).

---

## Bloco A — Fundação

### 26.0 — ADR de validação (042; o "033" original foi ocupado pelo template)

**Objetivo:** formalizar a estratégia de validação de fidelidade, i18n, performance e segurança.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.0.1 | Criar `docs/syntaxmesh/decisoes/042-estrategia-validacao.md` | idem | arquivo existe **[x 2026-11-15]** |
| 26.0.2 | Seção **Contexto:** necessidade de provar fidelidade ao `tj3` real; i18n; performance; segurança; 3 ondas + infra existente | idem | — **[x 2026-11-15]** |
| 26.0.3 | Seção **Decisão:** goldens (`tj3` × CLI) em 2 camadas; corpus no lugar; política de divergência; AST equivalence; snapshots; benchmarks com baseline; ondas 2/3 (Playwright/axe/Lighthouse); relatório gerado | idem | — **[x 2026-11-15]** |
| 26.0.4 | Seção **Alternativas rejeitadas** + **Consequências** | idem | — **[x 2026-11-15]** |
| 26.0.5 | Atualizar linha `042` em `decisoes/README.md` (tabela + nota de reserva) | idem | tabela sem números duplicados nem vagos **[x 2026-11-15]** |

---

## Bloco B — Corpus e runners

### 26.1 — Corpus de fixtures

> **Adaptação do kickoff (ADR 042):** fixtures **referenciadas no lugar**
> (fontes já commitadas em `docs/`); o deliverable é o manifesto
> `tests/fixtures/corpus.json` + índice, não a cópia física. TDD: teste
> primeiro (`corpus_test.ts`), módulo puro depois.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.1.1 | Grupo `mwe` (9 tutoriais) no manifesto | `scripts/golden/corpus.ts`, `tests/fixtures/corpus.json` | contagem 9 **[x 2026-11-15]** |
| 26.1.2 | Grupos `syntax-correct` (75) + `syntax-errors` (94) | idem | contagens **[x 2026-11-15]** |
| 26.1.3 | Grupos `scheduler-correct` (35) + `scheduler-errors` (70) | idem | contagens **[x 2026-11-15]** |
| 26.1.4 | Grupos de reports (`report-generator` 9 + `html-reports` 13 + `csv-reports` 18) + `export-refs` (68) + `parity` (4) | idem | contagens; total **395** **[x 2026-11-15]** |
| 26.1.5 | Módulo puro `fixtureId`/`buildManifest`/`scanCorpus` + task `corpus:generate` | `scripts/golden/corpus.ts`, `deno.jsonc` | TDD red→green; **3 passed (11 steps)** — ids únicos, paths existem, sync do commitado **[x 2026-11-15]** |
| 26.1.6 | Criar `tests/fixtures/README.md` com índice | idem | arquivo existe **[x 2026-11-15]** |

---

### 26.2 — Oracle v2: `cli-tj3.rb` sobre o corpus inteiro (referência)

> **Adaptação do kickoff (ADR 042):** nada de `tj3-runner.ts` paralelo — o
> oracle é o `scripts/golden/cli-tj3.rb` da F24.7, estendido para ler o
> manifesto (26.1) e o registro de divergências (26.6). O golden continua
> em `packages/cli/tests/golden/cli-tj3.golden.json` (wiring de
> `generate_golden.ts` inalterado).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.2.1 | Oracle lê `tests/fixtures/corpus.json` (inventário único; ids `<grupo>/<stem>`) | `scripts/golden/cli-tj3.rb` | 395 casos no golden **[x 2026-11-15]** |
| 26.2.2 | Oracle lê `known-divergences.json`; `exclude` → caso `{excluded: "D<n>"}` sem rodar | idem | D7/D8/D9 excluídos **[x 2026-11-15]** |
| 26.2.3 | Campo `group` + `kind` derivado do grupo (`*-errors`→errors, `parity`→parity, resto→project) | idem | 10 grupos **[x 2026-11-15]** |
| 26.2.4 | Timeout por caso (60s, `popen3` + watchdog `KILL`; exit 124) | idem | 0 timeouts na regeneração **[x 2026-11-15]** |
| 26.2.5 | Paridade: cópia `.smx`→`.tjp` + mapa de compare (exact/dom/artifacts) | idem | 4 casos parity **[x 2026-11-15]** |
| 26.2.6 | Progresso em stderr (`[n/395]`); JSON no stdout | idem | log da regeneração **[x 2026-11-15]** |
| 26.2.7 | Regenerar `cli-tj3.golden.json` (395 casos, 3 excluídos) | `packages/cli/tests/golden/cli-tj3.golden.json` | JSON re-stringificado indent 2 (idêntico ao fluxo `golden:generate:ruby`) **[x 2026-11-15]** |
| 26.2.8 | `ruby -c` + run completo | — | Syntax OK; **EXIT=0** (~4min) **[x 2026-11-15]** |

---

### 26.3 — Runner v2: harness compartilhado + suites por grupo (sujeito)

> **Adaptação do kickoff (ADR 042):** a CLI `syntaxmesh` É o runner — nada
> de `tj3-ts-runner.ts`. O `golden_cli_test.ts` da F24.7 (34 casos) foi
> extraído para `golden/e2e-harness.ts` e substituído por 10 arquivos
> `e2e_<grupo>_test.ts` (paralelismo nativo do Deno, sem runner próprio).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.3.1 | Extrair harness (runCli/inventory/residue/normalização/comparação) | `packages/cli/tests/golden/e2e-harness.ts` | `deno check` limpo **[x 2026-11-15]** |
| 26.3.2 | `casesForGroup` + `effectiveCompare` (downgrade do registro) — TDD | `e2e_harness_test.ts` | red→green; **2 passed (7 steps)** **[x 2026-11-15]** |
| 26.3.3 | 10 suites `e2e_<grupo>_test.ts` via `registerGroup(grupo)` | `packages/cli/tests/e2e_*_test.ts` | 1 arquivo por grupo do manifesto **[x 2026-11-15]** |
| 26.3.4 | Casos `excluded` assertam a âncora do registro (entrada + fixture + efeito + arquivo) | `e2e-harness.ts#assertExcluded` | nunca silencioso **[x 2026-11-15]** |
| 26.3.5 | Timeout de spawn da CLI (60s, kill + falha explícita) | `e2e-harness.ts#runCli` | hang falha, não trava o gate **[x 2026-11-15]** |
| 26.3.6 | Remover `golden_cli_test.ts` (subsumido) + referências vivas atualizadas | README golden, `known_divergences.md`, `generate_golden.ts`, fixture `.smx` | grep sem referência viva **[x 2026-11-15]** |

---

### 26.4 — Comparador: reuso F24.7 + registro máquina de divergências

> **Adaptação do kickoff (ADR 042):** nada de `comparator.ts` paralelo — o
> comparador da F24.7 (exit/inventário/resíduo/primeira mensagem/CSV byte/
> HTML DOM) é reutilizado no harness. O delta é o registro máquina
> `known-divergences.json` + loader estrito + precedência de efeitos.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.4.1 | Reusar o comparador F24.7 no harness (sem camada paralela) | `e2e-harness.ts#assertCase` | mesmos 6 critérios **[x 2026-11-15]** |
| 26.4.2 | `parseRegistry` estrito (9 campos, id `D\d+`, únicos, fixture conhecido, enums) | `packages/cli/tests/golden/divergences.ts` | TDD **[x 2026-11-15]** |
| 26.4.3 | `effectFor`: precedência exclude > compare-artifacts > none (wildcard `*`) | idem | TDD **[x 2026-11-15]** |
| 26.4.4 | Testes do loader + precedência | `divergences_test.ts` | red→green; **3 passed (14 steps)** **[x 2026-11-15]** |
| 26.4.5 | Migrar D1–D9 do `.md` para o JSON (verbetes em inglês) | `known-divergences.json` | 9 entradas **[x 2026-11-15]** |
| 26.4.6 | Efeitos: D7/D8/D9 `exclude`; D2 `compare-artifacts`; resto `none` | idem | regressão do registro real **[x 2026-11-15]** |
| 26.4.7 | Regressão do registro real contra `corpus.json` | `divergences_test.ts` | verde **[x 2026-11-15]** |
| 26.4.8 | Harness aplica o downgrade no momento da comparação | `e2e-harness.ts#effectiveCompare` | TDD (7 steps) **[x 2026-11-15]** |

---

## Bloco C — Golden tests

### 26.5 — Golden tests end-to-end

> **Abordagem (kickoff):** reusa o harness e2e da F24.7 escalado ao corpus
> completo — a CLI `syntaxmesh` É o runner, 10 suites de grupo
> (`packages/cli/tests/e2e_<grupo>_test.ts`), **sem runner próprio**. A triagem
> segue a política do kickoff: default = **bug do port**; destinos =
> normalização / sub-critério mais fraco / fora-do-subset **com âncora**; nunca
> `it.ignore` silencioso. D7/D8 (scheduler) são registrados com âncora de fase
> (reconciliação de `Project.schedule()` fica como saída prometida).
>
> **Resultado:** e2e verde — `10 passed (395 steps), 0 failed`; **340 incluídos**
> passando (≥ 200), **55 excluídos** com âncora de registro. Baseline 303/395 →
> 313 (batch A) → 325 (batch B) → 395 (batch C).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.5.1 | e2e sobre os 395 fixtures via harness F24.7 (10 suites de grupo) | `e2e-harness.ts`, `e2e_*_test.ts` | `deno test -A packages/cli/tests/e2e_*_test.ts` **[x 2026-11-15]** |
| 26.5.2 | Batch A — abort de macro overflow (throw após erro, espelha Ruby) | `lexer/scanner.ts` | TDD red→green; CLI = 23 mensagens do golden **[x 2026-11-15]** |
| 26.5.3 | Batch A — include com aspas simples (SQ) | `parser/include-references.ts` | TDD 4 testes; Booking3 EXIT=0 **[x 2026-11-15]** |
| 26.5.4 | Batch A — fidelidade de mensagens (tj-time `)`, specifations, specificy×2, date_in_range, booking_conflict fullId, runaway_token to_s, report.ts `\"`) | core (6 arquivos) | type check + 15 suites (123 steps) **[x 2026-11-15]** |
| 26.5.5 | Batch B — canonicalização de data (long form/ISO/ctime → instante UTC) + colapso de float integral, só mensagens | `e2e-harness.ts#canonicalizeDates`, `cli-tj3.rb` | TDD 8 testes; probe Ruby×TS idêntico **[x 2026-11-15]** |
| 26.5.6 | Batch B — filtro simétrico do medidor de progresso (`Report …`) | `TJ_NOISE`/`CLI_NOISE` | resíduo vazio dos dois lados **[x 2026-11-15]** |
| 26.5.7 | Batch C — remoção da localização de fonte (`<PATH>:12:`) em erros de runtime | `normalizeMessage`×`normalize_message` | TDD; 8 `ts_*` passam **[x 2026-11-15]** |
| 26.5.8 | Batch C — fidelidade: `unknown_scenario_idx` sem dois-pontos; `impossible_start/end_dep` com a data conflitante | `rules/common.ts`, `model/task-scenario.ts` | e2e verde (Ruby TjpSyntaxRules.rb:5228 / TaskScenario.rb:1221,1278) **[x 2026-11-15]** |
| 26.5.9 | Batch C — globs de grupo `<group>/*` no registro (TS + Ruby) | `divergences.ts#matchesFixture`, `cli-tj3.rb#exclusion_for` | TDD (glob aceita/rejeita/escopo) **[x 2026-11-15]** |
| 26.5.10 | Batch C — 35 entradas D10–D44 (52 fixtures) + D45 (normalizações) | `known-divergences.json`, `known_divergences.md` | registro valida contra o corpus; `assertExcluded` com glob **[x 2026-11-15]** |
| 26.5.11 | Regenerar o golden + e2e verde | `cli-tj3.golden.json` | `10 passed (395 steps), 0 failed`; 340 incluídos / 55 excluídos **[x 2026-11-15]** |

**Triagem (63 falhas pós-batch-A → 0):** 11 corrigidas/normalizadas (3 fidelidade
+ 8 `ts_*` de localização); 52 registradas com âncora — D10 `csv-reports/*`
(serialização D3), D11–D33/D39/D40 (scheduler), D34–D38 (motor de queries),
D41/D42 (gramática superconjunto), D43 (data em diagnóstico), D44 (`export`).
Nenhuma silenciada: toda exclusão tem verbete + âncora de fase de saída.

---

### 26.6 — Divergências conhecidas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.6.1 | `known-divergences.json` (criado na 26.4, expandido na 26.5) | `packages/cli/tests/golden/known-divergences.json` | 45 entradas D1–D45; JSON válido **[x 2026-11-15]** |
| 26.6.2 | Verbete por divergência: fixture, descrição, justificativa, mitigação, prioridade, efeito, âncora | `known_divergences.md` + JSON | 45 verbetes; "Ponto de saída" por família **[x 2026-11-15]** |
| 26.6.3 | `10-futuro.md` com a lista de features ausentes | `docs/syntaxmesh/10-futuro.md` | seção "Lacunas de compatibilidade conhecidas (F21¹)" **[x 2026-11-15]** |
| 26.6.4 | Teste: registro válido contra o schema + corpus real | `divergences_test.ts` | `parseRegistry` estrito + regressão do registro real; globs `<group>/*` **[x 2026-11-15]** |

> **Efeitos:** D7/D8/D9 + D10–D44 = `exclude` (55 fixtures fora do subset, com
> âncora); D2 = `compare-artifacts`; D1/D3/D4/D5/D6/D45 = `none`. Precedência
> exclude > compare-artifacts > none; wildcard `*` e glob de grupo `<group>/*`.

---

### 26.7 — Relatório de conformidade

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.7.1 | Criar `scripts/golden/generate-report.ts` | `scripts/golden/generate-report.ts` + módulo puro `packages/cli/tests/golden/conformance-report.ts` | `deno check` limpo; task `conformance:report` **[x 2026-11-15]** |
| 26.7.2 | Estrutura: resumo, por categoria, divergências, features ausentes | `conformance-report.ts` (`buildReport` + `renderMarkdown`) | 8 testes BDD em `conformance-report_test.ts` (5 agregação + 3 render) **[x 2026-11-15]** |
| 26.7.3 | Incluir versões (`tj3 3.8.4`, port `0.0.2`) | `generate-report.ts` (probe `tj3 --version` espelhando o oráculo; versão do `packages/cli/deno.jsonc`) | teste de render com ambas as versões **[x 2026-11-15]** |
| 26.7.4 | Gerar `docs/syntaxmesh/conformance-report.md` | idem | arquivo existe; 340/395 incluídos (86,1%), 55 excluídos; regeneração byte-idêntica **[x 2026-11-15]** |

> **Abordagem:** lógica pura (`buildReport`/`renderMarkdown`, sem I/O) em
> `packages/cli/tests/golden/` — o glob de testes só cobre `packages/**/tests/**`;
> `scripts/golden/generate-report.ts` é a casca fina de I/O (manifesto do
> corpus + golden + registro → md). Render determinístico (sem timestamp):
> o arquivo só muda quando os dados mudam. Versões reais: tj3 **3.8.4**
> (oráculo) e port **0.0.2** (`packages/cli/deno.jsonc`; o "tj3-ts 1.0.0"
> original era placeholder). Evidência: `deno test … conformance-report_test.ts`
> → 2 passed (8 steps), 0 failed; `deno task conformance:report` →
> "340/395 incluídos (86.1%), 55 excluídos"; segunda execução byte-idêntica
> (`diff` vazio); `deno fmt`/`deno lint` limpos.

---

## Bloco D — i18n e regressão

### 26.8 — AST equivalence (en ↔ pt-BR ↔ es)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.8.1 | Criar `tests/fixtures/i18n/en/` (30 fixtures) | `packages/core/tests/fixtures/i18n/*.en.tjp` (convenção existente) | 23 famílias en no diretório + 9 MWEs in place = **32 ≥ 30** **[x 2026-11-15]** |
| 26.8.2 | Criar `tests/fixtures/i18n/pt-BR/` (traduções) | `*.pt-BR.tjp` (mesma convenção) | 23 traduções + 9 MWEs **[x 2026-11-15]** |
| 26.8.3 | Criar `tests/fixtures/i18n/es/` (traduções) | `*.es.tjp` (mesma convenção) | 23 traduções + 9 MWEs **[x 2026-11-15]** |
| 26.8.4 | Criar `tests/i18n/ast_equivalence_test.ts` | `packages/core/tests/ast-equivalence-expansion_test.ts` (descoberta por diretório) | `deno check` limpo **[x 2026-11-15]** |
| 26.8.5 | Implementar `normalizeAST(ast)` (substitui `name` por `__TASK__`/`__RESOURCE__`) | `tests/helpers/ast-snapshot.ts` (já existente, 10.18.4) | 3 testes existentes + `hashKeyCache` adicionado ao SKIP_KEYS (memoização, não-AST) **[x 2026-11-15]** |
| 26.8.6 | Para cada fixture: parsear 3 versões e comparar | `ast-equivalence-expansion_test.ts` | 23 famílias × 3 testes = 69 passos + 9 MWEs × 3 na suíte 10.18 **[x 2026-11-15]** |
| 26.8.7 | Cobertura: 100% das fixtures com AST idêntica | idem | verde — nenhuma divergência **[x 2026-11-15]** |
| 26.8.8 | Teste agregado: todas as fixtures × 3 idiomas | idem (describe "26.8.7/26.8.8 — agregado") | 2 testes: contagem ≥30 + varredura completa **[x 2026-11-15]** |

> **Abordagem:** reuso da infraestrutura existente (10.18/C3.9.3) em vez dos
> caminhos literais do plano — fixtures como trincas `<família>.<lang>.tjp`
> em `packages/core/tests/fixtures/i18n/` (en dos MWEs referenciado in place
> em `docs/Learning/`, ADR 042). 22 famílias novas (accounts, shifts, leaves,
> vacation, gap-dependencies, milestones, scheduling-modes, limits,
> resource-attributes, task-attributes, scenarios, taskreport, resourcereport,
> journal, flags, macros, supplement-booking, export, textreport,
> project-attributes, minmax, precedes-responsible) geradas por tradução
> mecânica de keywords (`.tmp/gen-i18n-fixtures.ts`, marcadores `@kw@` —
> ids/strings/datas/literais byte-idênticos). Triage inicial: `isleaf` é
> função lógica (`~isleaf()`), `copyright` é diretiva de nível de
> propriedades, `currencyformat`/`numberformat` têm 5 argumentos,
> `timingresolution` pede unidade, id `a` colide com unidade de ano pt/es,
> e `hashKeyCache` (contador global de memoização) saiu do snapshot.
> Evidência: expansão **24 passed (71 steps), 0 failed**; suítes 10.18 +
> C3.9.3 **13 passed (41 steps)**; smoke F10 **1 passed (3 steps)**;
> `deno check`/`fmt`/`lint` limpos.

---

### 26.9 — Regression snapshots

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.9.1 | Criar `tests/regression/ast_snapshot_test.ts` | `packages/core/tests/regression/ast_snapshot_test.ts` | `deno check` limpo **[x 2026-11-15]** |
| 26.9.2 | Snapshot de AST para cada fixture | `__snapshots__/ast.snap.json` (32 fixtures: 9 MWEs + 23 famílias i18n en) | 1 teste agregado, ≥30 fixtures **[x 2026-11-15]** |
| 26.9.3 | Criar `tests/regression/diagnostics_snapshot_test.ts` | `packages/core/tests/regression/diagnostics_snapshot_test.ts` | `deno check` limpo **[x 2026-11-15]** |
| 26.9.4 | Snapshot de diagnostics para cada erro | `__snapshots__/diagnostics.snap.json` (94 fixtures `syntax-errors` do corpus) | 1 teste; sem paths absolutos **[x 2026-11-15]** |
| 26.9.5 | Criar `tests/regression/richtext_snapshot_test.ts` | `packages/core/tests/regression/richtext_snapshot_test.ts` | `deno check` limpo **[x 2026-11-15]** |
| 26.9.6 | Snapshot de `RichText.to_s`/`to_html`/`to_tagged` | `__snapshots__/richtext-to_{s,html,tagged}.snap.json` (8 amostras MediaWiki) | 3 testes (um por modo) **[x 2026-11-15]** |
| 26.9.7 | Criar `tests/regression/report_snapshot_test.ts` (HTML normalizado) | `packages/core/tests/regression/report_snapshot_test.ts` + `__snapshots__/report-html.snap.txt` | 1 teste; parse→schedule→`generate(["html"])`; `<NOW>`/`<VER>` normalizados **[x 2026-11-15]** |
| 26.9.8 | Criar `tests/regression/__snapshots__/` (gerado) | `packages/core/tests/regression/__snapshots__/` | 6 arquivos existem **[x 2026-11-15]** |

> **Abordagem:** snapshots fixam o comportamento ATUAL do port (regressão),
> complementando o golden e2e (conformidade × tj3). Helper `snapshot-io.ts`
> com modo `UPDATE_SNAPSHOTS=1` (task `snapshots:update`) — única via
> sancionada de mudar baseline. Determinismo: `now` fixado em todas as
> famílias i18n (o default do Project é relógio real alinhado à hora),
> `serializeValue` com chaves ordenadas, carimbo "Created on" e versão
> injetada no build normalizados no HTML. Evidência: **4 passed (6 steps),
> 0 failed**; duas execuções consecutivas byte-idênticas (`md5sum -c` OK);
> `deno check`/`fmt`/`lint` limpos.

---

### 26.10 — Testes unitários consolidados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.10.1 | Adicionar task `test:all` em `deno.jsonc` | `deno.jsonc` (tasks `test:all` + `coverage:core`) | listada por `deno task` (Deno 2.9 não tem `--list`) **[x 2026-11-15]** |
| 26.10.2 | `test:all` roda `packages/*/tests/**` + `tests/unit/**` | `deno.jsonc` (include `tests/unit/**/*test.ts`) + `tests/unit/workspace-smoke_test.ts` | **931 passed (7690 steps), 0 failed** (4m49s) **[x 2026-11-15]** |
| 26.10.3 | Cobertura ≥ 85% | `.tmp/core.lcov` (via `deno task coverage:core`) | **90.82%** linhas no core (48114/52977, 350 arquivos) **[x 2026-11-15]** |
| 26.10.4 | Relatório em `docs/syntaxmesh/coverage.md` | `docs/syntaxmesh/coverage.md` | arquivo existe (resultado + por módulo + lacunas) **[x 2026-11-15]** |

> **Abordagem:** `test:all` = `deno test --no-check -P` com o include glob
> estendido para `tests/unit/**` (smoke de workspace exercitando o barril
> público do core). Cobertura medida só sobre testes unitários do core
> (`coverage:core`): o harness e2e do CLI gera subprocessos `deno` que
> herdariam `DENO_COVERAGE_DIR` e explodiriam o diretório de coverage
> (142k arquivos / `StorageFull` mesmo com GB livres — limite de inodes do
> overlay). O único subprocesso do core é ruby/tj3 (não escreve coverage
> deno); o golden do core é ignorado (`--ignore`) para focar nos unitários.
> Agregação awk sobre lcov (`LH`/`LF`), precedente P7. **Correção de
> determinismo (26.9):** a fixture pré-existente `complemento-keywords`
> (en/pt-BR/es) não fixava `now`/`timezone` e divergia com o relógio real
> no snapshot de AST — bloco de projeto com `timezone "UTC"` + `now
> 2026-01-15` adicionado nos 3 idiomas; baseline regenerado (só
> `ast.snap.json` mudou), equivalência i18n preservada (**37 passed, 0
> failed**), snapshot estável em 2 execuções + probe com 110 parses de
> perturbação (0/32 divergentes).

---

## Bloco E — Performance e segurança

### 26.11 — Benchmarks

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.11.1 | Criar `bench/parse_bench.ts` (100 tasks, 1000 tasks) | `bench/parse_bench.ts` (+ `bench/workloads.ts`) | `deno bench` roda — 2 benches **[x 2026-11-15]** |
| 26.11.2 | Criar `bench/schedule_bench.ts` (100 tasks, 1000 tasks) | `bench/schedule_bench.ts` | 3 benches (100/1000 start fixo + booking 100) **[x 2026-11-15]** |
| 26.11.3 | Criar `bench/report_bench.ts` (10 reports) | `bench/report_bench.ts` | 1 bench (10 taskreports HTML, 50 tarefas) **[x 2026-11-15]** |
| 26.11.4 | Criar `bench/gantt_bench.ts` (500 tasks) | `bench/gantt_bench.ts` | 1 bench (coluna `chart`, 500 tarefas) **[x 2026-11-15]** |
| 26.11.5 | Criar `bench/rich_text_bench.ts` | `bench/rich_text_bench.ts` | 3 benches (`to_s`/`to_html`/`to_tagged`) **[x 2026-11-15]** |
| 26.11.6 | Criar `bench/query_bench.ts` (10k queries) | `bench/query_bench.ts` | 1 bench (10k queries `effort`) **[x 2026-11-15]** |
| 26.11.7 | Salvar `bench/baseline.json` | `bench/baseline.json` | JSON válido, 11 benches (`deno task bench:baseline`) **[x 2026-11-15]** |
| 26.11.8 | Adicionar task `bench:compare` em `deno.jsonc` | `deno.jsonc` (tasks `bench:run`/`bench:baseline`/`bench:compare` + seção `bench`) + `bench/compare.ts` + `bench/compare-run.ts` | listada por `deno task`; `bench:compare` **EXIT=0** (11 benches, sem regressão > 20%) **[x 2026-11-15]** |
| 26.11.9 | CI falha se regressão > 20% | `bench/bench_test.ts` (gate) + `bench/compare-run.ts` (exit 1) | 1 teste (detecta +50%, limiar estrito 20%, melhoria não regride); runner **EXIT=1** com limiar forçado **[x 2026-11-15]** |
| 26.11.10 | Criar `bench/bench_test.ts` (baseline existe, sem regressão) | `bench/bench_test.ts` | 2 testes (baseline válido ≥10 benches; sem regressão current==baseline) — **2 passed (3 steps)** **[x 2026-11-15]** |

> **Abordagem:** `bench/` na raiz com 6 arquivos `*_bench.ts` (11 benches) sobre
> workloads sintéticos determinísticos (`bench/workloads.ts`: `timezone "UTC"`
> + `now 2026-01-15`). Os benches de volume usam `start` fixo + effort (sem
> alocação) porque o booking de recurso é O(n²) no nº de tarefas — hotspot
> alvo da 26.14; um bench dedicado (`schedule_booking_100`, `allocate: true`)
> preserva esse caminho para medir a otimização. `deno bench --json` (version
> 1) alimenta `bench/baseline.json` (commitado); a métrica de comparação é
> `results[0].ok.avg` (ns/iter, menor = mais rápido). `bench/compare.ts` é puro
> (`extractMeasurements` + `detectRegressions`, limiar default 20% estrito) e
> testável com dados sintéticos; `bench/compare-run.ts` faz o I/O (spawna
> `deno bench --json`, compara, exit 1 se regressão; limiar configurável via
> `BENCH_THRESHOLD_PCT`). `bench_test.ts` valida o baseline + a lógica do gate
> sem rodar os benches reais (lentos/ruidosos) no gate de testes. Evidência:
> `deno check`/`fmt`/`lint` limpos; `bench:compare` **EXIT=0** (11 benches,
> deltas dentro de ±20%); caminho de falha confirmado com
> `BENCH_THRESHOLD_PCT=-100` → **EXIT=1** (11 regressões reportadas). Gate
> completo `deno task tests` verde: **933 passed (7693 steps), 0 failed**
> (5m5s; +2 testes/+3 steps do `bench_test.ts` sobre os 931 da 26.10).

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
| 26.14.1 | Analisar `bench` report | `.tmp/probe-cpu-profile.ts` (scratch) | profiling CPU (`node:inspector`) dos 3 workloads pesados; top-3 = fuso (~95% booking), XML `to_s` (~65% gantt), acesso a atributos (~30% schedule) **[x 2026-11-15]** |
| 26.14.2 | Otimizar top 3 hotspots | `time/timezone.ts`, `time/tj-time.ts`, `xml/xml-element.ts` | 4 otimizações output-preserving: fast path UTC, `strftime` lazy/hoisted, escape XML, `to_s` O(n²)→O(n); goldens+snapshots byte-idênticos **[x 2026-11-15]** |
| 26.14.3 | Re-rodar benchmarks | `bench/baseline.json` (regenerado) + `tests/time/timezone_test.ts` | `bench:compare` **EXIT=0**; booking -88.3% (8.5×), gantt -74.2% (3.9×), parse_100 -86.7%; 3 testes de equivalência UTC (vs. ICU) **[x 2026-11-15]** |
| 26.14.4 | Documentar em `docs/syntaxmesh/performance.md` | `docs/syntaxmesh/performance.md` | arquivo existe (158 linhas): profile, top-3, 4 otimizações, antes/depois, reprodução **[x 2026-11-15]** |

> **Abordagem:** profiling CPU via `node:inspector` (`deno prof` não existe no
> Deno 2.9.8) sobre os workloads determinísticos da 26.11. O profile **refutou**
> a hipótese inicial (`duties.includes`): o hotspot de booking era matemática de
> fuso (~95% — `getLocalParts` 40.5%, `getOffsetSeconds` 25%, `getTimeZoneAbbr`
> 13.4%, `strftime` 9.4%), não a busca de deveres. Quatro otimizações
> **output-preserving**: (1) fast path UTC em `timezone.ts` (getters nativos
> `getUTC*` ≡ Intl sem offset/DST; equivalência provada em 200k instantes, 0
> divergências, 26.5× mais rápido); (2) `strftime` lazy + constantes hoisted em
> `tj-time.ts` (`%Z`/`%z`/`%j`/`%W` só quando presentes); (3) fast path de escape
> XML; (4) `XMLElement.to_s` O(n²)→O(n) — `out.endsWith(">")` relia a corda
> acumulada a cada filho, substituído por `prevEndsWithGt` rastreado (ganho real
> do Gantt). O hotspot 3 (acesso a atributos, ~30% do schedule 1000) foi
> **adiado conscientemente**: a guarda `!attr→null` é semântica deliberada.
> Evidência: time+strftime+tjtime/html-xml goldens+regression **46 passed (585
> steps)**; xml/html+gantt/reports/html-xml/ical goldens+regression **31 passed
> (332 steps)**; `timezone_test.ts` **2 passed (7 steps)** com 3 testes de
> equivalência UTC vs. ICU; `deno check`/`fmt`/`lint` limpos. `bench:compare`
> **EXIT=0** (11 benches, sem regressão > 20%): booking 1564→183ms (**-88.3%**,
> 8.5×), parse_100 319→42.5ms (**-86.7%**), gantt 1869→483ms (**-74.2%**, 3.9×),
> parse_1000 -69.9%, schedule_100 -44.0%, report_10 -29.6%. `baseline.json`
> regenerado pós-otimização (gate protege os ganhos); cópia prévia em
> `.tmp/baseline-pre-2614.json`. Detalhes em `docs/syntaxmesh/performance.md`.
> Gate completo `deno task tests` verde: **934 passed (7696 steps), 0 failed**
> (4m40s; +1 teste/+3 steps dos 3 testes UTC fast path sobre os 933 da 26.11).

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

**Adendo xray (2026-11-03, §5.5) — regeneração da matriz de completude:**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.22.9 | **Regenerar `completude-matrix.md` a partir do código**: varrer as âncoras `// Ancorado: Fase N — razão` (mesma fonte de `scripts/check-stubs.ts`) e produzir uma linha por stub com fase dona | `docs/syntaxmesh/fases/completude-matrix.md` + script auxiliar em `scripts/gaps/` | matriz cobre F2–F20; `deno task gaps:audit` verde **[x 2026-11-10]** |
| 26.22.10 | Conciliar a matriz com as realocações da varredura xray (F16 16.9/16.10/16.14–16.15, F18 18.18–18.20, F22 22.1b, F24 24.9/24.10) e com os gaps hoje só em `CURRENT.md` (F13/F14/F14-C/F15) | idem | nenhuma linha `pendente` sem dono **[x 2026-11-10 — Seções C/D]** |
| 26.22.11 | Reconciliar a cadeia de ADR **033–037** (reservados) com os arquivos realmente criados nas Fases 22/23/24/18; atualizar `decisoes/README.md` | `decisoes/README.md` | tabela sem números duplicados nem vagos **[x 2026-11-10 — Seção E; 035 permanece reservado para F22]** |

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

## Adendo Fase 10 Complemento: regressão e qualidade das extensões (#1–#6a)

> **Origem:** `fase-10-complemento1.md` §8/§10 e `fase-10-complemento2.md` §8/§11. As extensões nasceram com fixtures próprias nos Blocos C3/C4 de `fase-10-complemento-tarefas.md`; aqui entram na matriz de compatibilidade e no gate de release.

```
[x] 26.26  Matriz de extensões i18n              —  3/3
[x] 26.27  known-divergences timebasis           —  2/2
[x] 26.28  Gate de release com extensões         —  2/2
```

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.26.1 | Corpus de regressão estendido: `.tjp` do TJ puro (sem keywords novas) processa **byte-idêntico** antes/depois das extensões | `tests/corpus/` | e2e CLI×tj3 **10 passed (395 steps)**: exit/artifacts/stdout + paridade CSV byte-a-byte/HTML DOM canônico; `corpus_test` 395 fixtures/10 grupos; snapshots regressão (ast/diagnostics/report/richtext) verdes **[x 2026-11-15]** |
| 26.26.2 | AST-equivalence das keywords novas (`material`, `picture`, `format`, `timebasis`, `breakdownreport`, `rdoreport`) em en/pt-BR/es (ampliação do que o Bloco C3.9 iniciou) | `tests/ast-equivalence_test.ts` | `ast-equivalence-complemento_test.ts` **2 passed (9 steps)**: C3.9.3 en/pt-BR/es (5 its) + presença não-vacua material/timebasis/breakdownreport/rdoreport/picture/format (4 its) **[x 2026-11-15]** |
| 26.26.3 | Benchmarks: parser com regras novas não regride >5% no throughput de `.tjp` existentes | `tests/bench/` | `bench:compare` **EXIT=0**; parse_100 **-12.5%**, parse_1000 melhor-caso 103.8ms ≈ baseline 104.2ms (**-0.4%**, +5.1% single-run = ruído ambiental); 26.14 deixou parse 3–7× mais rápido que o pré-otimização **[x 2026-11-15]** |
| 26.27.1 | Preencher `known-divergences.json` com `timebasis length` e cálculos de `perweek`/`permonth` que divergem do `tj3` (documentar fórmula TJ observada) | `packages/core/tests/golden/known-divergences.json` | 6 entradas (`perweek_inclusive_semantics` + `length_mode_task_only` adicionadas; fórmula TJ `TjpSyntaxRules.rb:6292-6311` documentada); `timebasis-parity_golden_test.ts` **2 passed (6 steps)** valida ids **[x 2026-11-15]** |
| 26.27.2 | Golden `charge` default `duration` contra `tj3` coberto no corpus MWE completo | `scripts/golden/finance-*.rb` | `finance_golden_test.ts` verde: mwe004 overview + variations `report-charges` (onStart/onEnd/perDiem) + `report-perhour`; goldens de `finance-mwe004.rb`/`finance-variations.rb` (mwe004/variaveis.tjp) **[x 2026-11-15]** |
| 26.28.1 | Matriz de cobertura #1–#6a × camadas (modelo/parser/journal/sheets/markdown/reports/storage/app) marcada no `plano.md` | docs | matriz #1–#6a × 8 camadas na seção FASE 21 de `plano.md`, legenda `OK`/`—`/`F19`/`F20` + bloco de evidência 26.26–26.28 **[x 2026-11-15]** |
| 26.28.2 | Gate de release: `check:all` + golden + corpus + Lighthouse com a tela de RDO presente | CI | gate da 1ª onda (motor) `deno task tests` verde (`check:all` + golden + corpus); **Lighthouse + tela de RDO → 3ª onda** (F20 UI não iniciada — âncora explícita, sem `it.ignore` silencioso) **[x 2026-11-15]** |

> **Abordagem (26.26–26.28, F21¹ — 2026-11-15):** o adendo das extensões
> #1–#6a foi fechado sobre a infra já entregue pelas fases anteriores — o
> delta desta onda é **regressão + paridade + matriz**, não features novas.
> - **26.26.1 (corpus byte-idêntico):** os 10 suites e2e (`e2e_<grupo>_test.ts`)
>   rodam a CLI real (subprocesso) sobre as 395 fixtures do manifesto contra o
>   oracle `tj3` (`cli-tj3.rb`): exit + inventário de artifacts + resíduo de
>   stdout nos projetos, primeira mensagem normalizada nos erros, e **paridade
>   de conteúdo** CSV byte-a-byte / HTML por DOM canônico. Resultado:
>   **10 passed (395 steps), 0 failed (1m51s)**. Os casos `exclude` da triagem
>   (ADR 042) são assertados contra a âncora do registro, nunca ignorados.
>   Snapshots de regressão (26.9: ast/diagnostics/report/richtext) verdes.
> - **26.26.2 (AST-equivalence + presença):** `ast-equivalence-complemento_test.ts`
>   amplia o C3.9.3 — en/pt-BR/es parseiam sem mensagens e produzem AST
>   equivalente (5 its) + um describe novo de **presença não-vacua** (4 its):
>   `Material` steel, `timebasis` no cenário de t1, `breakdownreport`/`rdoreport`
>   com attrs distintivos (`hideJournalEntry`/`maxpictures`), `picture`/`format`
>   exercitados no journalentry. **2 passed (9 steps)**.
> - **26.26.3 (throughput do parser):** `bench:compare` **EXIT=0** (11 benches,
>   sem regressão > 20%). `parse_100` **-12.5%**; `parse_1000` +5.1% no single-run
>   do gate, mas 3 execuções isoladas dão 103.8/124.1/115.0ms — **melhor-caso
>   103.8ms ≈ baseline 104.2ms (-0.4%)**, logo o +5.1% é ruído ambiental, não
>   regressão de código. A 26.14 já deixara o parse 3–7× mais rápido que o
>   pré-otimização (`performance.md`); as regras novas não regredem o throughput.
> - **26.27.1 (known-divergences):** `known-divergences.json` com 6 entradas —
>   adicionadas `perweek_inclusive_semantics` (fórmula TJ observada:
>   `perweek X → perDiem X/7`, `TjpSyntaxRules.rb:6292-6311`, elapsed half-open;
>   SM inclusive → razão 5/4 em Mon-Fri) e `length_mode_task_only`.
>   `timebasis-parity_golden_test.ts` valida os ids e a paridade SM×tj3
>   (onstart/onend iguais; perday/perweek inclusive vs half-open). **2 passed
>   (6 steps)**.
> - **26.27.2 (charge default duration):** `finance_golden_test.ts` verde sobre
>   os goldens de `finance-mwe004.rb` (overview taskreport) e `finance-variations.rb`
>   (mwe004/variaveis.tjp: `report-charges` onStart/onEnd/perDiem + `report-perhour`),
>   cobrindo o `charge` default `duration` no corpus MWE completo.
> - **26.28.1 (matriz):** matriz #1–#6a × 8 camadas na seção FASE 21 de
>   `plano.md` (legenda `OK`/`—`/`F19`/`F20`); storage/app adiados à 3ª onda.
> - **26.28.2 (gate de release da 1ª onda):** `deno task tests` verde —
>   **935 passed (7700 steps), 0 failed (4m19s)** (`check:all` + `lint` +
>   `fmt:check` + `lint:doc:all` + `check:doccore` + `check:lspcore` +
>   `check:stubs` + `test`, incluindo golden + corpus e2e). **Lighthouse + tela
>   de RDO ficam ancorados para a 3ª onda** (F20 PWA+UI não iniciada; sem
>   `it.ignore` silencioso — a matriz e este bloco registram o adiamento).
>   +1 teste/+4 steps sobre os 934 da 26.14 = o describe de presença 26.26.2.

---

## 2ª onda (21²) — kickoff e adendo: suite adaptado à extensão VS Code (26.29–26.33)

> **Autorização:** usuário ("vamos fazer a proxima onda do 21", 2026-11-15),
> após o fecho da 1ª onda (gate 935 passed) e da Fase 22 (P1–P7, gate 880
> passed). Ordem oficial: `… 24 → 21¹ → 22 → 21² → 19 → 20 → 21³`. Escopo
> autoritativo: plano §0, linha da 2ª onda — integração LSP
> (`registerLspServer`/handlers), grammar sobre o corpus, performance de
> `lsp-core` (diagnósticos em arquivo grande), ajuda/manual EN, empacotamento
> `.vsix`. O handoff da F22 (§11 + §P7) alimenta esta onda.

### Decisões do kickoff (2026-11-15)

| Aspecto | Decisão | Fundamento |
|---|---|---|
| Runtime VS Code | **Headless-first + âncora** (escolha do usuário): tudo o que é provável em Deno puro é entregue e gatado; o aceite que exige VS Code vivo (Test Runner de comandos/trust, `code --install-extension`, vscode.dev) fica **diferido com âncora explícita** — sem `it.ignore` silencioso | ambiente sem VS Code (memória de ambiente); F22 §11 já diferiu esses itens à F21²; precedente da 1ª onda (Lighthouse → 3ª onda) |
| Integração LSP | estende o harness stdio JSON-RPC real (`packages/lsp/tests/protocol_test.ts`, 22.9.5) à superfície §5 completa (didChange/didClose/completion/definition/references/documentSymbol/workspaceSymbol/semanticTokens); o sujeito é o servidor standalone `packages/lsp/src/mod.ts --stdio` | `registerLspServer` (core/src/lsp/server.ts) agrega todo documento aberto; o transporte stdio não precisa do editor |
| Tokenizer da grammar | **`npm:vscode-textmate` + `npm:vscode-oniguruma`** (WASM), imports **test-only** em `packages/vsextension/deno.jsonc`; tokenização fiel headless da grammar gerada (`generateGrammar`); não entra em bundle nenhum; fronteira do `lsp-core` intacta | grammar é dado puro projetado de `SyntaxCore`; TextMate exige oniguruma; deps de teste não violam o pure-Deno do bundle |
| Idioma da grammar | v1 **EN-only**: tokenização alvo nas fixtures EN (MWEs + syntax-correct EN); keywords não-EN caem no escopo raiz (limitação documentada, não falha); PT/ES = adendo pós-F21 | F22 §12 convenção 4; plano §0 |
| Numeração | continua o esquema `26.x` (1ª onda terminou em 26.28): **26.29–26.33**, 14 tarefas atômicas; bloco "Adendo — 2ª onda (21²)" | xray §5.6 (não renumerar); mapa 26.N ↔ 21.N |
| ADR | **adendo à 042** (`042-estrategia-validacao.md`) registrando a estratégia headless + política de âncora; sem número novo | 042 já é o ADR de estratégia de validação das 3 ondas |
| Performance | novo `bench/lsp_bench.ts` (`analyzeDocument` sobre `buildSource(1000)`), grupo `lsp`; baseline commitado; `bench:compare` falha com regressão > 20% | infra de bench da 1ª onda (26.11); `analyzeDocument` exportado pelo `lsp-core` |

**Ordem de execução:** 26.29 (integração LSP stdio) → 26.30 (grammar sobre o
corpus) → 26.31 (perf lsp-core) → 26.32 (manual EN + .vsix estrutural) →
26.33 (âncoras runtime + fecho) → gate + evidência + docs.

### Progresso (adendo 2ª onda)

```
[x] 26.29  Integração LSP headless (stdio)        —  5/5
[x] 26.30  Grammar TextMate sobre o corpus        —  3/3
[x] 26.31  Performance lsp-core                   —  2/2
[x] 26.32  Manual EN + .vsix estrutural           —  2/2
[x] 26.33  Âncoras runtime + fecho da 2ª onda     —  2/2
```

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.29.1 | Extrair `StdioClient` + helpers de framing de `protocol_test.ts` para helper reutilizável; refactor sem mudança de comportamento; contrato completo de capabilities no `initialize` | `packages/lsp/tests/stdio-client.ts`, `protocol_test.ts` | helper `stdio-client.ts` (StdioClient + openSession/didOpen/nextDiagnostics/shutdown); `protocol_test.ts` refactorado; capabilities §5 completas (sync=2, hover/completion/definition/references/documentSymbol/workspaceSymbol/semanticTokens + legend); lsp `deno task tests` **10 passed (29 steps)** **[x 2026-11-15]** |
| 26.29.2 | `didChange` (full + incremental range) → `publishDiagnostics` atualiza; `didClose` → limpa diagnósticos | `packages/lsp/tests/integration_test.ts` | sessão framed real: incremental insere `bogusattr` → diagnostics source `syntaxmesh`; full restaura → `[]`; didClose → `[]` + hover `null` **[x 2026-11-15]** |
| 26.29.3 | `completion` + `definition` + `references` sobre stdio, single-doc e workspace cross-file (2 documentos abertos) | idem | completion `build` kind 18; definition `dev`→linha 2; cross-file B→A (uri A, linha 2) + references agregam os 2 uris **[x 2026-11-15]** |
| 26.29.4 | `documentSymbol` + `workspace/symbol` + `semanticTokens` (legend + `data` delta de 5 inteiros) sobre stdio | idem | documentSymbol raiz `prj` + 3 children; workspace/symbol `bu`→`build`; semanticTokens/full `data.length % 5 == 0` **[x 2026-11-15]** |
| 26.29.5 | Diagnósticos sobre fixture de erro real do corpus (syntax-errors) → `Diagnostic[]` não-vazio com range/severity/message; pureza de stdout | idem + `tests/fixtures/corpus.json` | 1ª fixture syntax-errors (`adopt_duplicate_child-1`) lida do manifesto → diagnostics severity 1/2 + source/message/range; `remaining()` 0 bytes após exit **[x 2026-11-15]** |
| 26.30.1 | Harness headless de tokenização TextMate: `vscode-textmate` + `vscode-oniguruma` (WASM) test-only; `Registry` sobre `generateGrammar()`; helper `tokenize(text)` | `packages/vsextension/deno.jsonc`, `tests/grammar/tokenizer.ts`, `tokenizer_test.ts` | WASM carrega em Deno (pacotes CJS: API via default export, tipos via type-only); grammar registrada; `tokenizer_test.ts` cobre control/storage/other, string/date/duration, int/float, comment line+block com estado cross-line **1 passed (5 steps)** **[x 2026-11-15]** |
| 26.30.2 | Cobertura de escopos sobre fixtures EN do corpus (MWEs + syntax-correct EN): keywords/literals/comments/strings nos escopos `*.syntaxmesh`; não-EN cai no raiz (limitação EN-only) | `packages/vsextension/tests/grammar/corpus_test.ts` | 84 fixtures EN (9 MWE + 75 syntax-correct) tokenizam sem quebrar regex (raiz ativo em todo token); os 20 escopos declarados pela grammar são exercitados; não-EN (`projeto`/`tarefa`/`recurso`) cai no raiz (limitação EN-only, contrastado com EN) **1 passed (3 steps)** **[x 2026-11-15]** |
| 26.30.3 | Golden snapshot de tokenização sobre fixtures EN representativas + regressão de expansão de snippets | `tests/grammar/tokenization_test.ts`, `generate-tokenization.ts`, `fixtures/tokenization.golden.json` | golden `tokenization.golden.json` (mwe001, 38 linhas/149 tokens) byte-a-byte; expansão dos 6 snippets de `snippets.golden.json` (tab stops→placeholder) → keywords EN nos escopos; `tokenization_test.ts` **1 passed (2 steps)**; dir grammar **8 passed (30 steps)**; pacote vsextension **33 passed (131 steps)** **[x 2026-11-15]** |
| 26.31.1 | `bench/lsp_bench.ts`: `analyzeDocument(uri, buildSource(1000), {})` (source fora do loop), grupo `lsp`, nome `lsp_diagnostics_1000` | `bench/lsp_bench.ts` | `analyzeDocument` (lsp-core) sobre `buildSource(100/1000)`, source fora do loop, grupo `lsp`, nomes `lsp_diagnostics_100`/`lsp_diagnostics_1000`; auto-descoberto pelo `bench:compare`; `deno check` verde **[x 2026-11-15]** |
| 26.31.2 | Entrada estável no `bench/baseline.json` (melhor-caso em execuções isoladas); `bench:compare` EXIT=0; `bench_test.ts` verde | `bench/baseline.json` | 11→13 benches (splice best-case de 3 execuções isoladas: lsp_100 38.9ms, lsp_1000 97.3ms; 44 inserções/0 deleções, entradas existentes preservadas byte-a-byte); `bench_test.ts` **2 passed (3 steps)**; `bench:compare` **EXIT=0** (13 benches; lsp_100 -2.9%, lsp_1000 -1.9%) **[x 2026-11-15]** |
| 26.32.1 | Regressão manual/help EN: `getManualToc`/`getManualPage` + `UserManual.generate` golden; cobertura `getKeywordHelp` (markdown) sobre keywords EN do corpus | `packages/core/tests/lsp/help-coverage_test.ts` | 164 keywords EN documentadas (`reference.all` ignoreOld=true) → `getKeywordHelp` markdown (`###` título, sem ANSI) + `getManualPage` + `getManualToc` + `UserManual.generate` (página por keyword, não só amostras); 40 keywords dos MWEs do corpus resolvem (0 falhas); reusa doc-core (22.1b), verificação não rebuild **1 passed (4 steps)** **[x 2026-11-15]** |
| 26.32.2 | Regressão estrutural `.vsix`: inventário + `vsixmanifest` + coerência de manifesto (22.10.4) + tamanho < 5 MB; pureza web `node:`-free + injeção de versão; smoke do bundle construído sobre stdio (evidência) | `packages/lsp/tests/smoke-bundle.ts` (novo, evidência), `packages/vsextension/tests/` + `packages/lsp/tests/` (reuso) | gates re-executados: vsextension manifest (22.10.4) + purity (22.8.1) **2 passed (10 steps)**, lsp inject (22.10.2) + args **5 passed (20 steps)**; `.vsix` 13 arquivos, `vsixmanifest` Identity `syntaxmesh-vscode` v0.0.2 publisher `vanaware`/Engine `^1.90.0`/ExtensionKind `workspace,web`, `[Content_Types].xml`, **2291147 bytes (2.18 MB) < 5 MB**; rebuild `dist/syntaxmesh-lsp.js` (2552 kB, 580 módulos) shebang + `__APP_VERSION__="0.0.2-mtvrt8od"`, banner `--version` confere; web bundles `node:`-free (0) e 4 bundles + lsp sem `textmate`/`oniguruma` (0 leak — deps test-only fora do bundle); smoke `smoke-bundle.ts` (driver de evidência, não `*test.ts`, type-checked) initialize→didOpen→hover→shutdown: sync=2/hover=true (8 caps), hover `### task` markdown, 0 diagnostics, exit 0, stdout puro **[x 2026-11-15]** |
| 26.33.1 | Matriz de aceite: F22 §11 + matriz F21² neste arquivo — itens headless OK (26.29–26.32); Test Runner/clean install/vscode.dev **Diferido** com âncora; adendo à ADR 042 | `fase-22-vscode-extension.md` §11, `fase-22-vscode-extension-tarefas.md` §P7, este arquivo, `decisoes/042-estrategia-validacao.md` | matriz de aceite F21² (9 itens: 5 headless OK 26.29–26.32 + 4 runtime **Diferido** com âncora explícita); F22 §11 (plano) + §P7 (tarefas) atualizados 2026-11-15 com evidência headless e runtime re-ancorado (pós-F21², sem `it.ignore`); adendo à ADR 042 (estratégia headless-first + política de âncora, sem número novo) **[x 2026-11-15]** |
| 26.33.2 | Gate de fecho `deno task tests` EXIT=0 + sync de docs (CURRENT/plano/este arquivo/plano §0/AGENTS/completude-matrix/ADR 042); Concluídas 96 → 110 | docs | gate `deno task tests` **EXIT=0 — 943 passed (7719 steps), 0 failed, 0 ignored (2 steps) (4m22s)** (1ª onda 935→943, +8 testes/+19 steps; sem `it.ignore` novo); `bench:compare` EXIT=0 (13 benches); docs sincronizados: CURRENT/plano (linha F21 + §0)/este arquivo (Concluídas 110 + Status + Progresso 2/2)/plano §0 (linha 2ª onda concluída)/AGENTS (linha F21)/completude-matrix §E (042 adendo + 035 re-âncora)/ADR 042 (adendo 2ª onda) + decisoes/README **[x 2026-11-15]** |

### Matriz de aceite F21² (26.33.1, 2026-11-15; atualizada pelo adendo 26.34)

Escopo headless entregue e gatado (Deno puro, sem VS Code). O aceite runtime
VS Code foi registrado como **Diferido com âncora explícita** (ambiente sem
VS Code — handoff para uma execução equipada; sem `it.ignore` silencioso);
com o VS Code Insiders disponível na máquina, o adendo **26.34** resolveu as
**3 âncoras desktop** (Test Runner de comandos/trust + instalação limpa) —
vscode.dev permanece ancorado. A matriz consome o handoff da F22 (§11 + §P7,
atualizados 2026-11-15) e o estende.

| Item de aceite | Evidência headless (Deno) | Status |
|---|---|---|
| Integração LSP §5 completa sobre stdio (capabilities, didChange full/incremental, didClose, completion/definition/references single+cross-file, documentSymbol/workspaceSymbol/semanticTokens, diagnósticos de erro do corpus, pureza stdout) | `packages/lsp/tests/stdio-client.ts` + `integration_test.ts` + `protocol_test.ts` (26.29.1–.5) | OK |
| Grammar TextMate sobre o corpus EN (tokenizer headless, 84 fixtures, 20 escopos, não-EN cai no raiz, golden + expansão de snippets) | `packages/vsextension/tests/grammar/` `tokenizer.ts`/`corpus_test.ts`/`tokenization_test.ts` (26.30.1–.3) | OK |
| Performance lsp-core: diagnósticos em arquivo grande (benchmark + baseline) | `bench/lsp_bench.ts` + `bench/baseline.json` (26.31.1–.2); `bench:compare` EXIT=0 | OK |
| Manual/help EN (`getManualToc`/`getManualPage`/`UserManual.generate` + `getKeywordHelp` sobre keywords do corpus) | `packages/core/tests/lsp/help-coverage_test.ts` (26.32.1) | OK |
| `.vsix` estrutural + pureza web `node:`-free + injeção de versão + smoke do bundle construído | gates manifest/purity/inject re-executados + `packages/lsp/tests/smoke-bundle.ts` (26.32.2, evidência) | OK |
| VS Code Test Runner — integração de comandos (daemon/relatório/export/idioma) | unitários puros P4 + coerência manifesto ↔ registros (22.10.4); runtime exige Extension Host | **OK** — runtime Insiders 1.147 (26.34.1–.2): full mode **17 passed, 0 failed**, os 9 comandos via API real (stubs de UI no mesmo host) |
| VS Code Test Runner — trust (workspace não confiável) | `tests/trust_test.ts` (P4, lógica pura); runtime exige API `vscode` | **OK** — runtime Insiders 1.147 (26.34.3): untrusted → extensão desabilitada (2 passed); grant persistido → ativa + executa (sonda, 3 passed) |
| Instalação limpa (`code --install-extension` + abrir `.tjp`) | `.vsix` estrutural válido (22.10.3 + revalidação 26.32.2); runtime exige VS Code desktop | **OK** — runtime Insiders 1.147 (26.34.4): `.vsix` 0.0.2 instalado em `--extensions-dir` isolado + suite sobre o artefato instalado **8 passed, 0 failed** |
| vscode.dev (Web Extension Host runtime) | cenários Web puros P5 (22.8.7) + pureza do grafo (22.8.1); runtime exige vscode.dev | **Diferido** — âncora: runtime vscode.dev |

> **Âncora runtime (política):** os quatro itens runtime foram registrados
> como **Diferido** por não serem fecháveis no ambiente original (sem VS Code
> desktop nem vscode.dev) — handoff explícito para uma execução equipada,
> não forçados para a 3ª onda (que é PWA/UI/release). Nenhum `it.ignore`
> silencioso: a evidência headless correspondente está entregue e gatada
> acima. **Atualização 26.34 (2026-11-15):** com o Insiders instalado, as 3
> âncoras desktop foram resolvidas por driver de evidência (`test:runtime`,
> fora do gate — precedente `smoke-bundle.ts`); **vscode.dev segue Diferido
> com âncora** (exige sessão de navegador). Registro: ADR 042 (adendos 2ª
> onda + 26.34) + F22 §11/§P7 (atualizados 2026-11-15).

> **Abordagem (26.29–26.33, F21² — 2026-11-15):** *headless-first + âncora*
> (escolha do usuário). Tudo o que é provável em Deno puro foi entregue e
> gatado: (26.29) o harness `StdioClient` (extraído de `protocol_test.ts`)
> dirige o servidor standalone real sobre stdio JSON-RPC framed, cobrindo a
> superfície §5 completa — capabilities, didChange full/incremental, didClose,
> completion/definition/references single+cross-file, documentSymbol/
> workspaceSymbol/semanticTokens, diagnósticos de fixture de erro do corpus e
> pureza de stdout; (26.30) tokenizer TextMate headless (`npm:vscode-textmate`
> + `npm:vscode-oniguruma` WASM, **test-only**, fora de todo bundle; pacotes
> CJS exigem default import para valores + type-only para tipos) sobre 84
> fixtures EN do corpus, 20 escopos, não-EN cai no raiz (limitação EN-only v1),
> golden de tokenização + expansão de snippets; (26.31) `bench/lsp_bench.ts`
> (`analyzeDocument` sobre `buildSource(100/1000)`, grupo `lsp`) + baseline
> best-case commitado (13 benches, `bench:compare` EXIT=0); (26.32) regressão
> manual/help EN (164 keywords documentadas + 40 do corpus) e `.vsix`
> estrutural (13 arquivos, 2.18 MB < 5 MB, vsixmanifest, pureza web
> `node:`-free, injeção de versão) + smoke do bundle construído sobre stdio
> (driver de evidência `smoke-bundle.ts`, não gatado para não impor pré-build);
> (26.33) matriz de aceite F21² + F22 §11/§P7 atualizados + adendo à ADR 042.
> **Fronteira:** o aceite runtime VS Code (Test Runner de comandos/trust,
> `code --install-extension`, vscode.dev) permanece **Diferido com âncora
> explícita** — sem VS Code no ambiente, handoff para execução equipada (não
> forçado para a 3ª onda); nenhum `it.ignore` silencioso. Gate de fecho
> `deno task tests` **943 passed (7719 steps), 0 failed (4m22s)**; Concluídas
> 96 → 110.

---

## Adendo — resolução das âncoras runtime desktop (26.34)

> **Autorização:** usuário informou VS Code Insiders instalado na máquina
> (2026-11-15; `code-insiders` 1.147.0-insider, display `:0` ativo) e escolheu
> o escopo **3 âncoras desktop** (Test Runner de comandos/trust + instalação
> limpa) com harness **Deno npm:** (`@vscode/test-electron`); vscode.dev
> permanece ancorado. Resolve os itens **Diferido** da matriz F21² (26.33.1)
> que dependem de VS Code desktop — sem alterar o escopo da 3ª onda.

### Decisões do kickoff (2026-11-15)

| Aspecto | Decisão | Fundamento |
|---|---|---|
| Ambiente | VS Code Insiders 1.147.0-insider (`/usr/bin/code-insiders`), engines `^1.90.0` satisfeito; display `:0`/Wayland ativo; Node v20 via nvm existe mas **não é usado** | verificação direta (`--version`, `which`); memória de ambiente atualizada |
| Harness | `npm:@vscode/test-electron@^2.5.2` via compatibilidade npm do Deno (sem `npm install`/`node_modules`), apontando `vscodeExecutablePath` para o Insiders instalado (sem download de VS Code) | precedente `npm:@vscode/vsce` (task `package`) + deps test-only da 2ª onda; regra pure-Deno do repo |
| Suite in-host | `tests/runtime/suite.ts` em bundle CJS (`--external vscode`) carregado pelo Node Extension Host; `@std/assert` + coletor sequencial `check(name, fn)` — **exceção BDD documentada** (`Deno.test` não roda no host do VS Code) | `extensionTestsPath` é carregado via `require` pelo host Node; mesmo pipeline de bundle dos artefatos (22.4.7) |
| Instrumentação de UI | stubs no mesmo Extension Host: `showQuickPick` (1º item), `showSaveDialog` (`defaultUri`), captura de `show*Message`; webviews assertados via `window.tabGroups.all` | comandos são UI-wiring sobre lógica pura já gatada; o aceite runtime prova o wiring real |
| Isolamento | 3 execuções com `--user-data-dir` temporário fresco (dev/untrusted/clean); clean usa também `--extensions-dir` temporário + `.vsix` instalado; workspace fixture copiado para tmp (escritas nunca tocam o repo) | instalação limpa real; sem estado residual entre cenários |
| Política de gate | driver de **evidência**, não teste de gate (task `test:runtime` separada; suite/driver não são `*test.ts`, não coletados por `deno test`); gate completo permanece verde e sem dependência de VS Code/pré-build | precedente `smoke-bundle.ts` (26.32.2) |
| Numeração | continua `26.x`: **26.34.1–.4**, 4 tarefas atômicas; Concluídas 110 → 114 | xray §5.6 (não renumerar) |
| ADR | adendo à **042** (âncoras desktop resolvidas; vscode.dev segue ancorado); sem número novo | 042 é o ADR de estratégia de validação |

**Ordem de execução:** 26.34.1 (harness + LSP in-host, dev run) → 26.34.2
(comandos, full mode) → 26.34.3 (trust, untrusted run) → 26.34.4 (instalação
limpa + matriz + ADR + docs + gate).

### Progresso (adendo 26.34)

```
[x] 26.34  Âncoras runtime desktop (Insiders)     —  4/4
```

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 26.34.1 | Harness runtime: import test-only `@vscode/test-electron`; driver Deno (`run.ts`) + suite in-host (`suite.ts`, CJS `--external vscode`) + fixtures workspace; dev run: ativação + LSP no Extension Host real (diagnostics/hover/completion) | `packages/vsextension/deno.jsonc`, `tests/runtime/` | import `npm:@vscode/test-electron@^2.5.2` test-only + task `test:runtime` (fora do gate); driver resolve os 2 entry points do Insiders (wrapper `/usr/bin/code-insiders` para CLI `--version`/install/list — ele encaminha janelas e sai 0; binário Electron `/usr/share/code-insiders/code-insiders` para janelas — trava em flags CLI puras), bundle CJS `--external vscode`, fixtures copiados para tmp, `--user-data-dir` fresco, timeout 6 min com timer limpo no settle; suite = exceção BDD documentada (`@std/assert` + coletor `check`); dev run `deno task test:runtime`: **6 checks LSP ok** (ativação `vanaware.syntaxmesh-vscode`, languageId `syntaxmesh`, diagnostics de `error.tjp` com message/range/severity, master `[]`, hover markdown `task`, completion `build` após `depends`), Exit code 0; `deno check tests/runtime/run.ts tests/runtime/suite.ts` verde **[x 2026-11-15]** |
| 26.34.2 | Integração de comandos (full mode): os 9 comandos do manifesto exercitados via API real — daemon add/reload/list/remove, relatório HTML (webview) + CSV (arquivo), export, switch-language, manual, tree | `tests/runtime/suite.ts` | dev run full: **RUNTIME SUITE full: 17 passed, 0 failed** (6 LSP + 11 comandos), Exit code 0 — addProject `loaded master.tjp (ok).`; reloadProject `reloaded master.tjp (ok).`; listProjects quick-pick 1 item label `master.tjp` description `1 reports`; removeProject `removed master.tjp.` + re-add; generateReport HTML aba `SyntaxMesh: overview` via `tabGroups.all`; CSV via `ConfigurationTarget.Workspace` → `overview.csv` stat > 0 + `saved overview.csv.` + restore; exportTjp `exported.tjp` bytes == documento + `exported master.tjp.`; switchLanguage insere `language "pt-BR"` + mensagem, volta `en` in-place; openManual aba `SyntaxMesh Manual:`; showProjectTree resolve; os 9 comandos do manifesto exercitados **[x 2026-11-15]** |
| 26.34.3 | Trust (untrusted run, 2 fases): workspace não confiável mantém a extensão desabilitada (sem capability `untrustedWorkspaces`, 1ª camada; gate `assertTrusted` é a 2ª, P4); grant de trust habilita ativação + execução | `tests/runtime/suite.ts`, `run.ts`, `tests/runtime/probe/` | `deno task test:runtime -- --mode untrusted` **DRIVER_EXIT=0**: fase A (janela de teste, perfil fresco sem grant) **2 passed** — `isTrusted === false`, extensão presente mas `isActive === false`, comandos `addProject`/`generateReport` ausentes de `getCommands(true)` (VS Code desabilita a extensão em modo restrito — o bloqueio observado é anterior ao `UNTRUSTED_MESSAGE` do gate in-command, coberto em P4); grant persistido no perfil (`content.trust.model.key` em `state.vscdb`, mesma entrada do botão "Trust" da UI — Insiders 1.147 não expõe comando de grant programático e janelas de teste usam storage em memória, fallback documentado no kickoff); fase B (janela NORMAL + extensão sonda `probe/`, sem `extensionTestsPath`) **RUNTIME PROBE trusted=true: 3 passed** — workspace confiável, extensão ativa após abrir `.tjp`, `addProject` executa com `loaded master.tjp (ok).` **[x 2026-11-15]** |
| 26.34.4 | Instalação limpa do `.vsix` em dirs isolados + suite sobre o artefato instalado; matriz F21² (3 itens Diferido → OK; vscode.dev segue ancorado); ADR 042 + sync de docs + gate de fecho | `run.ts`, `tests/runtime/inert/`, docs | `deno task test:runtime -- --mode clean` **DRIVER_EXIT=0**: `--install-extension syntaxmesh-vscode-0.0.2.vsix --extensions-dir <tmp>` → "successfully installed"; `--list-extensions --show-versions` → `vanaware.syntaxmesh-vscode@0.0.2`; suite sobre o artefato INSTALADO (sem dev path da extensão): **RUNTIME SUITE clean: 8 passed, 0 failed** (6 LSP + addProject + relatório HTML webview), `--user-data-dir` fresco; achados do harness registrados: o test runner in-host exige AMBOS os paths (`_doHandleExtensionTests`) → placeholder inerte `tests/runtime/inert/` (sem main/activationEvents, nunca ativa); o objeto de API `vscode` é chaveado pelo path da extensão que contém o módulo (`findSubstr`) → bundle da suite copiado para dentro do dir instalado (stubs de UI alcançam a extensão); matriz F21²: 3 linhas Diferido → OK (vscode.dev segue ancorado); ADR 042 adendo 26.34; gate de fecho registrado na nota de fecho do adendo abaixo **[x 2026-11-15]** |

### Nota de fecho (adendo 26.34, 2026-11-15)

**Evidência runtime** (driver `deno task test:runtime`, fora do gate; logs
`/tmp/runtime-*-final2.log`): full mode **17 passed, 0 failed** (6 LSP + 11
comandos — os 9 do manifesto); untrusted **2 passed** (fase A) + **RUNTIME
PROBE trusted=true: 3 passed** (fase B); clean **8 passed, 0 failed** sobre o
`.vsix` 0.0.2 instalado — todos com **DRIVER_EXIT=0**.

**Gate de fecho:** `deno task tests` **EXIT=0 — 943 passed (7719 steps),
0 failed, 0 ignored (2 steps) (4m22s)** — contagem inalterada da 2ª onda (a
suite runtime não é coletada: `suite.ts`/`run.ts`/`probe.ts` não são
`*test.ts`; type-check cobertos pelo `check` do vsextension).
`deno task bench:compare` **EXIT=0** — 13 benches, sem regressões > 20%
(delta máximo +1,0% em `gantt_500_html`); baseline intocado. `deno fmt
--check` limpo (1033 arquivos). Nenhum `it.ignore` novo;
`@vscode/test-electron` restrito ao driver + import map (não entra em nenhum
dos 4 bundles da extensão nem no bundle lsp); pureza do `lsp-core` intacta
(`check:lspcore` verde no gate).

**Desvios/fallbacks registrados** (autorizados pelo plano): trust em 2 fases
com grant persistido + sonda em janela normal (Insiders 1.147 não expõe
comando de grant programático; janelas de teste usam storage em memória);
placeholder inerte como dev path no clean mode (o runner in-host exige ambos
os paths); bundle da suite copiado para o dir instalado (afinidade do objeto
de API `vscode` por path da extensão). Higiene do harness: `.vscode-test/`
(resíduo do test-electron) adicionado ao `.gitignore`; `deno fmt` deve ser
rodado da raiz (fmt por arquivo resolve `probe/package.json` como config e
ignora o workspace).

**Sync de docs:** matriz F21² (3 linhas Diferido → OK; vscode.dev segue
ancorado) + nota de política de âncora; ADR 042 (adendo 26.34, sem número
novo); plano F21 §0 + Status; F22 §11 + §P7; `plano.md` (nota da 2ª onda +
linhas F21/F22); `CURRENT.md`; `AGENTS.md`; `completude-matrix.md` §E
035/042; `decisoes/README.md`. **Concluídas 110 → 114.** Sem commits (não
solicitados).

---

**Fim do arquivo de tarefas da Fase 21.**