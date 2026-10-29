# Fase 11 (Gaps) — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-11-logical-gaps-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-11-logical-gaps.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~80 tarefas
> **Concluídas:** 0
> **Natureza:** fechamento de gaps + auditoria + ancoragem — **sem features novas**
> **Fonte primária dos gaps:** `fase-11-logical-complemento.md` §6.10, §6.11
> **Timing:** roda **após a Fase 12 concluir**; bloqueia a Fase 13.

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é verificação, correção de gap ou sweep**, não desenvolvimento de
feature. Antes de começar:

1. Releia a linha correspondente do **inventário** em
   `fase-11-logical-gaps.md` §3.
2. Confirme se a linha é **Fechar aqui** (código), **Verificar** (só teste),
   **Verificar entrega em 12.18** (G5) ou **Ancorar** (só comentário + tarefa na
   fase dona).
3. Nunca implemente feature de Fase 13+.

### Timing (2026-10-28)

- **A Fase 12 corre até o fim antes desta fase começar** (decisão do autor).
- **A Fase 12 pode ter deixado testes marcados como `ignore: true` com tag
  `// Gate: fase-11-logical-gaps`.** Esses testes são **input explícito** desta
  fase — o Bloco K os varre e reabilita.
- **G5 (`to_rti` × 5) é entregue pela Fase 12 (12.18).** Aqui só verificamos.
- **O gate é `gate:phase-13`**, não `gate:phase-12`.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 014** — `mode` global.
- **ADR 015** — Metaprogramação em `PropertyTreeNode`.
- **ADR 016** — Pré-carregamento em `*Scenario`.
- **ADR 017** — Scoreboard bit encoding.
- **ADR 018** — Heurística do scheduler.
- **ADR 019** — Modelo financeiro.
- **ADR 021** — Orquestrador e pipeline.
- **ADR 031** — Modelo contábil estendido.
- **ADR 032** — Gate + política de stubs (**criado aqui**).

### Convenções CRÍTICAS

- **`AttributeBase.setMode(0)` em `beforeEach`.**
- **`deno task check:all` verde** antes de fechar cada bloco.
- **Fechar só G1–G4.** Verificar G5, G12–G21. Ancorar G6–G11.
- **Todo `NotYetImplementedError` recebe `// Ancorado: Fase N — <razão>` +
  entrada no `-tarefas.md` da fase dona.**
- **Todo golden test do scheduler compara `start`/`end`/`effort`** — comparar
  menos que isso é sinal de golden mal gerado.
- **Invariantes determinísticos** — usar seeds fixas em geradores.
- **Sweep (Bloco K) é obrigatório** — nenhum teste deferido fica `ignore: true`.
- Sem `any` em `src/`.
- Commit por subfase: `test(quality): ...`, `fix(core): ...`, `chore(gaps): ...`.

### Anti-padrões

- ❌ Não implementar `isoncriticalpath`/`freeze` (Fase 14) aqui.
- ❌ Não implementar `hasalert`/`Journal` (Fase 16) aqui.
- ❌ Não implementar sheets (Fase 18) aqui.
- ❌ Não refatorar `Project.schedule` além do necessário para G1.
- ❌ Não relaxar testes para "passar". Se está vermelho, é gap real.
- ❌ Não ancorar sem criar a tarefa correspondente na fase dona.
- ❌ Não usar `Math.random()` sem seed em invariantes.
- ❌ Não deixar `ignore: true` sobrando ao final (Bloco K).

---

## Progresso

```
[ ] 11.G.A  Infraestrutura de diagnóstico      —   0/5
[ ] 11.G.B  Fechar G1 (placement)               —   0/8
[ ] 11.G.C  Fechar G2, G3 (sentinela + golden)  —   0/2
[ ] 11.G.D  Fechar G4 (end-to-end parser)       —   0/2
[ ] 11.G.K  Sweep dos testes deferidos (F12)    —   0/2
[ ] 11.G.E  Auditoria Fases 4–10                —   0/5
[ ] 11.G.F  Auditoria Fase 11 + G5 (F12)        —   0/4
[ ] 11.G.G  Matriz de completude + ancoragem    —   0/4
[ ] 11.G.H  Invariantes e fuzz                  —   0/3
[ ] 11.G.I  Gate de saída + ADR 032             —   0/2
[ ] 11.G.J  Verificação final                   —   0/6
─────────────────────────────────────────────────────
TOTAL: ~80
```

---

## Bloco A — Infraestrutura de diagnóstico

### 11.G.A.1 — `debug/schedule_probe.ts`

**Objetivo:** ferramenta commitada que recebe um `.tjp`, roda `parse → schedule`,
e dumpar JSON com estado por task/recurso.

**Pré-requisitos:** Fases 9–12 concluídas.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.A.1.1 | Criar `debug/schedule_probe.ts` com esqueleto | idem | `deno check` |
| 11.G.A.1.2 | Aceitar argumento `<tjpPath>`; ler conteúdo | idem | 1 teste |
| 11.G.A.1.3 | Chamar `TaskJuggler.parseContent(content)`; se falhar, dumpar `MessageHandlerInstance.messages` | idem | 1 teste |
| 11.G.A.1.4 | Chamar `TaskJuggler.schedule()`; capturar retorno | idem | 1 teste |
| 11.G.A.1.5 | Dumpar `MessageHandlerInstance.errors` e `messages` pós-schedule | idem | 1 teste |
| 11.G.A.1.6 | Dumpar, por task: `fullId`, `scenarioData(0).start`, `.end`, `.doneEffort`, `.isRunAway`, `.scheduled`, `.durationType` | idem | 1 teste |
| 11.G.A.1.7 | Dumpar, por recurso: `fullId`, `scenarioData(0).effort`, `.duties.length` | idem | 1 teste |
| 11.G.A.1.8 | Dumpar `DataCache.instance.hits/misses/collisions` | idem | 1 teste |
| 11.G.A.1.9 | Adicionar task `deno task probe <path>` em `deno.jsonc` | `deno.jsonc` | `deno task probe --help` |
| 11.G.A.1.10 | Teste de fumaça: rodar `probe` em `examples/minimal.tjp` e verificar JSON válido | `debug/schedule_probe_test.ts` | verde |

### 11.G.A.2 — Instrumentação de `Project.schedule`

**Objetivo:** logs temporários (via `Log.status` ou `console.error`) em cada fase
para localizar onde o pipeline para. Remover após G1 fechado.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.A.2.1 | Adicionar `Log.status("initScoreboards: size=..., nullSlots=...")` no fim de `initScoreboards` | `src/model/project.ts` | 1 teste |
| 11.G.A.2.2 | Adicionar `Log.status("prepareScenario: tasks=..., usedResources=..., ready=...")` no fim de `prepareScenario` | idem | 1 teste |
| 11.G.A.2.3 | Adicionar `Log.status("scheduleScenario: queue=..., scheduled=...")` a cada iteração do loop | idem | 1 teste |
| 11.G.A.2.4 | Adicionar `Log.status("finishScenario: scheduled=..., runaway=...")` no fim de `finishScenario` | idem | 1 teste |
| 11.G.A.2.5 | Adicionar tarefa 11.G.B.8.6: **remover** os logs após G1 fechado | idem | grep `Log.status.*initScoreboards` retorna 0 |

### 11.G.A.3 — Reapertar `logical-scheduler-driven_test.ts` (sentinela G2)

**Objetivo:** reverter o relaxamento do §6.11; metade 1 deve **falhar** com
assert claro que detecta o gap (antes de 11.G.B fechá-lo).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.A.3.1 | Abrir `tests/integration/logical-scheduler-driven_test.ts` e localizar o relaxamento | idem | leitura |
| 11.G.A.3.2 | Restaurar a asserção `assert(task.scenarioData(0).end !== null, "G1 não fechado: end permanece null")` na metade 1 | idem | teste falha (esperado) |
| 11.G.A.3.3 | Marcar o teste com `ignore: true` + comentário `// Descomentar em 11.G.B.8.5 (fechamento de G1)` | idem | `deno test` passa |
| 11.G.A.3.4 | Documentar em `docs/syntaxmesh/fases/fase-11-logical-gaps.md` §12 a reversão e a data | idem | revisão |

### 11.G.A.4 — Inventário em formato de checklist

**Objetivo:** matriz viva das 21 linhas do inventário, com status e commit
referência.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.A.4.1 | Criar `docs/syntaxmesh/fases/completude-matrix.md` com as 21 linhas | idem | arquivo existe |
| 11.G.A.4.2 | Colunas: `ID`, `Descrição`, `Fase dona`, `Ação`, `Status`, `Commit`, `Teste` | idem | 1 linha por gap |
| 11.G.A.4.3 | Marcar G1–G4 como `fechar`, G5 como `verificar (12.18)`, G6–G11 como `ancorar`, G12–G20 como `verificar`, G21 como `sweep` | idem | revisão |
| 11.G.A.4.4 | Script `scripts/gaps/audit.ts` que falha se algum gap está `pendente` | idem | 1 teste |

### 11.G.A.5 — Script `check:stubs`

**Objetivo:** script que falha se `NotYetImplementedError` não tem
`// Ancorado: Fase N` no comentário imediatamente anterior.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.A.5.1 | Criar `scripts/check-stubs.ts` | idem | `deno check` |
| 11.G.A.5.2 | Regex para `NotYetImplementedError\("Fase (\d+)"\)` e verifica comentário `// Ancorado: Fase N` nas 3 linhas anteriores | idem | 5 testes |
| 11.G.A.5.3 | Adicionar task `check:stubs` em `deno.jsonc` | `deno.jsonc` | `deno task check:stubs` |
| 11.G.A.5.4 | Rodar em CI; falha se encontrar stub não anotado | idem | 1 teste |
| 11.G.A.5.5 | Adicionar `check:stubs` ao CI principal (sempre, mesmo durante Fase 12) | `.github/workflows/ci.yml` (ou equivalente) | revisão |

---

## Bloco B — Fechar G1 (placement de datas)

### 11.G.B.1 — Diagnóstico via probe

**Objetivo:** rodar `probe` em caso mínimo e localizar onde o pipeline para.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.1.1 | Criar `examples/minimal-placement.tjp` com 1 task `effort 8h`, `allocate dev`, `start 2026-01-05` | idem | `tj3` agenda |
| 11.G.B.1.2 | Rodar `deno task probe examples/minimal-placement.tjp > /tmp/probe.json` | — | JSON gerado |
| 11.G.B.1.3 | Analisar `probe.json`: `end === null`? `scheduled === false`? `errors > 0`? | — | análise |
| 11.G.B.1.4 | Se `errors > 0`, ver qual (via `messages`); se 0, o pipeline para silencioso | — | análise |
| 11.G.B.1.5 | Documentar em comentário do PR os valores observados em cada fase (`initScoreboards`, `prepareScenario`, `scheduleScenario`, `finishScenario`) | `docs/syntaxmesh/fases/fase-11-logical-gaps.md` §12 | revisão |
| 11.G.B.1.6 | Hipótese formal do ponto de falha (uma das: `readyForScheduling` falso, `bookResources` não book, `propagateDate` shrink demais, `markAsScheduled` não chamado) | idem | 1 parágrafo |

### 11.G.B.2 — Corrigir o ponto identificado

**Objetivo:** corrigir o ponto do pipeline que bloqueia placement. **Não refatorar
além disso.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.2.1 | Aplicar o fix mínimo no ponto identificado em 11.G.B.1.6 | arquivo identificado | `deno test --filter probe` |
| 11.G.B.2.2 | Re-rodar `probe`; verificar `end !== null` e `scheduled === true` | — | JSON |
| 11.G.B.2.3 | Rodar `deno task test:all`; corrigir regressões (uma por vez) | — | check:all |
| 11.G.B.2.4 | Se fix exigir mudança em `TaskScenario`/`ResourceScenario`, atualizar testes unitários afetados | `tests/model/task-scenario-*`, `resource-scenario-*` | verde |
| 11.G.B.2.5 | Se fix for análogo ao Ruby, documentar referência em comentário `// TJ: TaskScenario.rb:<linha>` | idem | grep |

### 11.G.B.3 — Testes de placement

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.3.1 | `tests/integration/scheduler_placement_test.ts` — caso A.1 (1 task effort+allocate+start) | idem | 1 teste |
| 11.G.B.3.2 | A.2 (sem `start` → erro `task_start_undef` visível via `MessageHandlerInstance.errors > 0`) | idem | 1 teste |
| 11.G.B.3.3 | A.3 (ALAP com `end` fixo) | idem | 1 teste |
| 11.G.B.3.4 | A.4 (cadeia A → B → C) | idem | 1 teste |
| 11.G.B.3.5 | A.5 (milestone automático) | idem | 1 teste |
| 11.G.B.3.6 | A.6 (2 tasks, mesmo recurso) | idem | 1 teste |
| 11.G.B.3.7 | A.7 (efficiency 0.5) | idem | 1 teste |
| 11.G.B.3.8 | A.8 (runaway com `end` cedo) | idem | 1 teste |

### 11.G.B.4 — Testes de recursos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.4.1 | `scheduler_resources_test.ts` — B.1 (`dailymax 4h`) | idem | 1 teste |
| 11.G.B.4.2 | B.3 (`weeklymax 20h`) | idem | 1 teste |
| 11.G.B.4.3 | B.4 (`limits` no recurso) | idem | 1 teste |
| 11.G.B.4.4 | B.5 (prioridade diferente) | idem | 1 teste |
| 11.G.B.4.5 | B.6 (`mandatory` sem candidato → erro) | idem | 1 teste |
| 11.G.B.4.6 | B.7 (`persistent` mantém lock) | idem | 1 teste |
| 11.G.B.4.7 | B.8 (`atomic` com conflito → rollback) | idem | 1 teste |
| 11.G.B.4.8 | B.9 (`shifts` sobrepõem `workinghours`) | idem | 1 teste |
| 11.G.B.4.9 | B.10 (`shifts` com `replace`) | idem | 1 teste |
| 11.G.B.4.10 | Agregado: pelo menos 1 dos testes B.x deve falhar se `bookResources` for regredido | idem | revisão |

### 11.G.B.5 — Testes de propagação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.5.1 | `scheduler_propagate_test.ts` — C.1 (shrink-only, não expande) | idem | 1 teste |
| 11.G.B.5.2 | C.3 (milestone propaga other end) | idem | 1 teste |
| 11.G.B.5.3 | C.4 (container rollup min/max) | idem | 1 teste |
| 11.G.B.5.4 | C.5 (`gapduration 1d`) | idem | 1 teste |
| 11.G.B.5.5 | C.6 (`gaplength 2d` working days) | idem | 1 teste |
| 11.G.B.5.6 | C.8 (dependent já scheduled ignorado) | idem | 1 teste |

### 11.G.B.6 — Testes de loops

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.6.1 | `scheduler_loops_test.ts` — D.1 (`depends` em si mesmo → `task_depend_self`) | idem | 1 teste |
| 11.G.B.6.2 | D.2 (`A → B → A` → loop detectado) | idem | 1 teste |
| 11.G.B.6.3 | D.3 (loop indireto `A → B → C → A`) | idem | 1 teste |
| 11.G.B.6.4 | D.5 (container com depends em filho → `task_depend_child`) | idem | 1 teste |
| 11.G.B.6.5 | D.6 (depends duplicado → `task_depend_multi`) | idem | 1 teste |
| 11.G.B.6.6 | D.7 (task fora do range do pai → erro) | idem | 1 teste |

### 11.G.B.7 — Testes de bookings e cenários

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.7.1 | `scheduler_bookings_test.ts` — E.1 (`effortdone` + `effortleft`) | idem | 1 teste |
| 11.G.B.7.2 | E.2 (`effortdone` = `effort`, task termina antes) | idem | 1 teste |
| 11.G.B.7.3 | E.3 (`effortdone` sem `effortleft` → erro) | idem | 1 teste |
| 11.G.B.7.4 | E.5 (bookings em datas passadas → `currentSlotIdx = now`) | idem | 1 teste |
| 11.G.B.7.5 | `scheduler_scenarios_test.ts` — F.1 (2 cenários, 2 schedules) | idem | 1 teste |
| 11.G.B.7.6 | F.2 (`projectionmode` + `now`) | idem | 1 teste |
| 11.G.B.7.7 | F.5 (cenário sem `active` → ignorado) | idem | 1 teste |

### 11.G.B.8 — Descomentar sentinela + verificação end-to-end

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.B.8.1 | Rodar todos os testes de 11.G.B.3–11.G.B.7; verde | — | `deno test` |
| 11.G.B.8.2 | Rodar `probe` novamente em `examples/minimal-placement.tjp`; `end !== null` | — | JSON |
| 11.G.B.8.3 | Rodar `probe` nos 9 MWEs; `end !== null` em todos | — | JSON |
| 11.G.B.8.4 | Descomentar metade 2 do `logical-scheduler-driven_test.ts`; rodar | — | verde |
| 11.G.B.8.5 | Remover `ignore: true` do teste de 11.G.A.3.3 | idem | verde |
| 11.G.B.8.6 | Remover logs de instrumentação (11.G.A.2.5) | `src/model/project.ts` | grep |
| 11.G.B.8.7 | Atualizar `completude-matrix.md`: G1 = `fechado` | `completude-matrix.md` | revisão |
| 11.G.B.8.8 | Atualizar `CURRENT.md` com "G1 fechado" | `CURRENT.md` | revisão |

---

## Bloco C — Fechar G2, G3 (sentinela + golden)

### 11.G.C.1 — Regenerar golden do scheduler comparando `start`/`end`/`effort`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.C.1.1 | Revisar `scripts/golden/project-schedule-mwe*.rb` — confirmar que extraem `start`, `end` e `effort` de cada task | idem | revisão |
| 11.G.C.1.2 | Se algum não extrai `end`, corrigir o script | idem | regenerar |
| 11.G.C.1.3 | Regenerar `packages/core/tests/golden/project-schedule.golden.json` | `deno task golden:generate` | JSON válido |
| 11.G.C.1.4 | Verificar que o JSON contém `end` não-nulo para todas as tasks agendadas | — | jq/grep |
| 11.G.C.1.5 | Criar/atualizar `tests/golden/project-schedule_golden_test.ts` — para cada task: `assertEquals(ts.start, golden.start, ...)`, `assertEquals(ts.end, golden.end, ...)`, `assertEquals(ts.effort, golden.effort, ...)` | idem | verde |
| 11.G.C.1.6 | Adicionar caso de falha proposital: se `end` for `null`, o golden deve falhar com mensagem clara | idem | 1 teste |
| 11.G.C.1.7 | Marcar em `completude-matrix.md`: G3 = `fechado` | `completude-matrix.md` | revisão |

### 11.G.C.2 — Fechar G2 (sentinela)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.C.2.1 | Verificar que `logical-scheduler-driven_test.ts` metade 1 **passa** agora (G1 fechado) | idem | verde |
| 11.G.C.2.2 | Verificar que metade 2 **passa** agora | idem | verde |
| 11.G.C.2.3 | Adicionar caso de regressão: nova task sem `start` deve produzir `task_start_undef` visível | idem | 1 teste |
| 11.G.C.2.4 | Marcar em `completude-matrix.md`: G2 = `fechado` | idem | revisão |
| 11.G.C.2.5 | Documentar em `fase-11-logical-gaps.md` §12 o histórico do relaxamento e do reaperto | `fase-11-logical-gaps.md` | seção |
| 11.G.C.2.6 | `deno task gate:phase-13 --partial` (só G1–G3) | — | verde |

---

## Bloco D — Fechar G4 (end-to-end com parser real)

### 11.G.D.1 — Suite de integração com parser real

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.D.1.1 | Criar `tests/integration/parser-scheduler_e2e_test.ts` | idem | `deno check` |
| 11.G.D.1.2 | Para cada MWE 001–009: `parse(content)` → `schedule()` → comparar com golden | idem | 9 testes |
| 11.G.D.1.3 | Caso: `.tjp` em pt-BR → parse → schedule → comparar com golden | idem | 1 teste |
| 11.G.D.1.4 | Caso: `.tjp` em es → parse → schedule → comparar com golden | idem | 1 teste |
| 11.G.D.1.5 | Caso: `.tjp` com `dailymax` → parse → schedule → golden | idem | 1 teste |
| 11.G.D.1.6 | Caso: `.tjp` com `shifts` → parse → schedule → golden | idem | 1 teste |
| 11.G.D.1.7 | Caso: `.tjp` com `projectionmode` → parse → schedule → golden | idem | 1 teste |
| 11.G.D.1.8 | Caso: `.tjp` com `material` (Complemento 10) → parse → schedule → financeiro | idem | 1 teste |
| 11.G.D.1.9 | Caso: `.tjp` com `timebasis length` → parse → schedule → golden | idem | 1 teste |
| 11.G.D.1.10 | Agregado: ≥ 15 casos, todos verdes | idem | verde |

### 11.G.D.2 — Integração com relatórios

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.D.2.1 | `parse → schedule → report("taskreport")` em mwe001; comparar com golden de reports (se existir) | idem | 1 teste |
| 11.G.D.2.2 | `parse → schedule → report("resourcereport")` em mwe003; comparar | idem | 1 teste |
| 11.G.D.2.3 | Marcar em `completude-matrix.md`: G4 = `fechado` | idem | revisão |

---

## Bloco K — Sweep dos testes deferidos pela Fase 12

> **Objetivo:** varrer todos os testes que a Fase 12 marcou como `ignore: true`
> com tag `// Gate: fase-11-logical-gaps`, remover o `ignore` e verificar que
> passam com G1–G4 fechados.
>
> **Contexto:** a Fase 12 correu até o fim antes desta fase. Alguns testes de
> 12.19 (golden RichText que comparam HTML de reports gerados por projetos
> agendados) e 12.20 (smoke que chama `Project.schedule()`) podem ter sido
> deferidos. A lista é input explícito desta fase.

### 11.G.K.1 — Inventariar testes deferidos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.K.1.1 | Rodar `grep -rn "Gate: fase-11-logical-gaps" packages/core/tests/` e listar todos | — | lista gerada |
| 11.G.K.1.2 | Documentar a lista em `docs/syntaxmesh/fases/fase-11-logical-gaps.md` §12 (seção "Testes deferidos pela Fase 12") | idem | revisão |
| 11.G.K.1.3 | Para cada teste deferido, identificar qual gap ele depende (G1/G2/G3/G4) | idem | tabela |
| 11.G.K.1.4 | Ordenar a lista por gap para que o sweep siga a ordem dos blocos B→C→D | idem | revisão |

### 11.G.K.2 — Sweep e reabilitação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.K.2.1 | Para cada teste que depende apenas de G1: remover `ignore: true` e rodar | arquivo do teste | verde |
| 11.G.K.2.2 | Para cada teste que depende de G1+G3: remover `ignore: true` e rodar | idem | verde |
| 11.G.K.2.3 | Para cada teste que depende de G1+G3+G4: remover `ignore: true` e rodar | idem | verde |
| 11.G.K.2.4 | Remover a tag `// Gate: fase-11-logical-gaps` de todos os testes reabilitados | idem | grep retorna 0 |
| 11.G.K.2.5 | Atualizar `fase-12-richtext-tarefas.md` — marcar 12.19/12.20 como **totalmente concluídas** (não mais "parciais") | idem | revisão |
| 11.G.K.2.6 | Atualizar `completude-matrix.md`: G21 = `sweep concluído` | idem | revisão |
| 11.G.K.2.7 | Rodar `deno task test:deferred` (novo comando) e garantir verde | `deno.jsonc` + testes | verde |
| 11.G.K.2.8 | Atualizar `CURRENT.md`: "Fase 12 totalidade entregue (deferidos reabilitados)" | idem | revisão |

> **Regra:** ao final do Bloco K, `grep -rn "Gate: fase-11-logical-gaps"` deve
> retornar **zero**. Nenhum teste pode ficar deferido.

---

## Bloco E — Auditoria Fases 4–10 (verificações)

### 11.G.E.1 — Auditoria Fase 4 (árvore)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.E.1.1 | G20: `backupAttributes()`/`restoreAttributes()` — testar 3 níveis, modificar, restaurar, verificar | `tests/model/property-tree-node-inherit_test.ts` | 3 testes |
| 11.G.E.1.2 | `inheritAttributes` em container (3 níveis) — verificar cadeia | idem | 3 testes |
| 11.G.E.1.3 | Marcar em `completude-matrix.md`: G20 = `verificado` | idem | revisão |

### 11.G.E.2 — Auditoria Fase 5 (entidades)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.E.2.1 | Confirmar que `registerXAttributes` é idempotente: chamar 2× e verificar contagem | `tests/model/attributes/*_test.ts` | 5 testes |
| 11.G.E.2.2 | Confirmar contagem de atributos por entidade (task=44, resource=22, report=61, account=6, shift=7, scenario=3) | idem | 6 testes |
| 11.G.E.2.3 | G19: `TaskScenario.getScenarioAttribute(0, "effort")` existe após criar `Task` | `tests/model/task_test.ts` | 1 teste |
| 11.G.E.2.4 | Marcar em `completude-matrix.md`: G19 = `verificado` | idem | revisão |

### 11.G.E.3 — Auditoria Fase 6 (scoreboard)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.E.3.1 | End-to-end: `Limits` + `dailymax` respeitados no scheduler | `tests/integration/scheduler_limits_test.ts` | 3 testes |
| 11.G.E.3.2 | End-to-end: `ShiftAssignments` + `shifts` respeitados no scheduler | idem | 3 testes |
| 11.G.E.3.3 | Marcar em `completude-matrix.md` | idem | revisão |

### 11.G.E.4 — Auditoria Fase 9 (orquestrador)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.E.4.1 | G14: `MockProject` removido? `grep -r "MockProject" packages/core/` retorna 0 | — | grep |
| 11.G.E.4.2 | G14: todos os testes usam `Project` real; `createTestProject` é o helper canônico | `tests/fixtures/create-test-project.ts` | revisão |
| 11.G.E.4.3 | G17: `ScenarioData#error` incrementa `MessageHandlerInstance.errors` | `tests/model/scenario-data-preload_test.ts` | 1 teste |
| 11.G.E.4.4 | G18: `TaskJuggler#errors` reflete `MessageHandlerInstance.errors` | `tests/taskjuggler_test.ts` | 1 teste |
| 11.G.E.4.5 | Marcar em `completude-matrix.md`: G14, G17, G18 = `verificado` | idem | revisão |

### 11.G.E.5 — Auditoria Fase 10 (parser)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.E.5.1 | AST equivalence en/pt-BR/es em ≥ 30 fixtures (rodar suite existente) | `tests/ast-equivalence_test.ts` | verde |
| 11.G.E.5.2 | G13: Confirmar entrega dos Blocos C0–C4 do Complemento 10 (`material`, `picture`, `format`, `timebasis`, `breakdownreport`, `rdoreport`) — rodar `deno test --filter complemento-10` | `tests/parser/*` | verde |
| 11.G.E.5.3 | Golden parser contra `tj3` (178 casos) | `tests/golden/parser_golden_test.ts` | verde |
| 11.G.E.5.4 | Marcar em `completude-matrix.md`: G13 = `verificado` | idem | revisão |

---

## Bloco F — Auditoria Fase 11 + verificação G5 (Fase 12)

### 11.G.F.1 — Motor lógico

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.F.1.1 | Rodar suite de `LogicalOperation`/`LogicalAttribute`/`LogicalFlag`/`LogicalFunction`/`LogicalExpression` | `tests/logic/*` | verde |
| 11.G.F.1.2 | Rodar suite de `Query` (estrutura, process, accessors, scale, resolve, customData) | `tests/query/*` | verde |
| 11.G.F.1.3 | Rodar `SimpleQueryExpander` suite | `tests/query/simple-query-expander_test.ts` | verde |

### 11.G.F.2 — Funções ancoradas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.F.2.1 | Confirmar `hasalert` (G10) lança `NotYetImplementedError` com `// Ancorado: Fase 16` | `src/logic/logical-function.ts` | 1 teste |
| 11.G.F.2.2 | Confirmar `LogicalFlag` ramo Journal (G10) idem | `src/logic/logical-flag.ts` | 1 teste |
| 11.G.F.2.3 | Confirmar `isoncriticalpath` (G6) idem Fase 14 | `src/logic/logical-function.ts` | 1 teste |
| 11.G.F.2.4 | Confirmar `istaskstatus` (G9) idem Fase 18 | idem | 1 teste |

### 11.G.F.3 — Auditoria G16

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.F.3.1 | Marcar em `completude-matrix.md`: G16 = `verificado` | `completude-matrix.md` | revisão |

### 11.G.F.4 — Verificar entrega de G5 pela Fase 12

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.F.4.1 | Verificar que `attribute-base.ts:232` (`to_rti`) **não** lança `NotYetImplementedError` — foi implementado em 12.18 | `src/attributes/attribute-base.ts` | 1 teste |
| 11.G.F.4.2 | Verificar `reference-attribute.ts:42` idem | idem | 1 teste |
| 11.G.F.4.3 | Verificar `resource-list-attribute.ts:54` idem | idem | 1 teste |
| 11.G.F.4.4 | Verificar `query.ts:608` (rti) idem | `src/query/query.ts` | 1 teste |
| 11.G.F.4.5 | Verificar `project-file-parser.ts:463` (`newRichText`) usa `RichTextFactory` real | `src/parser/project-file-parser.ts` | 1 teste |
| 11.G.F.4.6 | Teste end-to-end: `<attribute>.to_rti()` retorna `RichTextIntermediate` válido | `tests/integration/richtext-factory_test.ts` | 1 teste |
| 11.G.F.4.7 | **Exceção:** se 12.18 **não** entregou algum dos 5 (imprevisto), implementar aqui com prioridade — e abrir issue na Fase 12 para retro (raro) | idem | revisão |
| 11.G.F.4.8 | Marcar em `completude-matrix.md`: G5 = `verificado (entregue por 12.18)` | idem | revisão |

---

## Bloco G — Matriz de completude e ancoragem

### 11.G.G.1 — Ancoragem G6–G11

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.G.1.1 | Anotar G6 (`isoncriticalpath`) → Fase 14 em `logical-function.ts` | idem | `check:stubs` |
| 11.G.G.1.2 | Anotar G7 (`freeze`) → Fase 14 em `taskjuggler.ts` | idem | idem |
| 11.G.G.1.3 | Anotar G8 (`defaultAccount`) → Fase 8.2 (regra 4 do `resolveAccount`) | `accounting/attribution.ts` | idem |
| 11.G.G.1.4 | Anotar G9 (`checkTimeSheet`/`checkStatusSheet`/`istaskstatus`) → Fase 18 | `taskjuggler.ts`, `logical-function.ts` | idem |
| 11.G.G.1.5 | Anotar G10 (`hasalert`/`LogicalFlag`) → Fase 16 | `logical-function.ts`, `logical-flag.ts` | idem |
| 11.G.G.1.6 | Anotar G11 (`parse`/`parseContent`) → Fase 19 | `taskjuggler.ts` | idem |
| 11.G.G.1.7 | Adicionar 6 entradas nos `-tarefas.md` das fases 8.2/14/16/18/19 referenciando esta fase | idem | revisão |

### 11.G.G.2 — Ancoragem G12 (query_* viáveis)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.G.2.1 | Listar todos os métodos `query_*` de `TaskScenario` e `ResourceScenario` que retornam valor real vs stub | `completude-matrix.md` §G12 | revisão |
| 11.G.G.2.2 | Para cada stub, adicionar `// Ancorado: Fase N` | código | `check:stubs` |
| 11.G.G.2.3 | Se algum stub for viável agora (sem depender de scheduling/finance), implementar | idem | 1 teste |

### 11.G.G.3 — Matriz de completude final

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.G.3.1 | Para cada uma das fases 2–12, listar status `verde`/`verificado`/`ancorado` | `completude-matrix.md` | revisão |
| 11.G.G.3.2 | Script `scripts/gaps/audit.ts` falha se algum gap está `pendente` | idem | 1 teste |
| 11.G.G.3.3 | Adicionar `deno task gaps:audit` em `deno.jsonc` | idem | `deno task --list` |
| 11.G.G.3.4 | Rodar `deno task gaps:audit`; verde | — | exit 0 |

### 11.G.G.4 — Verificação dos stubs

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.G.4.1 | `deno task check:stubs` verde | — | exit 0 |
| 11.G.G.4.2 | `grep -rn "Gate: fase-11-logical-gaps" packages/core/tests/` retorna 0 (Bloco K concluído) | — | grep |
| 11.G.G.4.3 | `grep -rn "NotYetImplementedError" packages/core/src/ \| wc -l` — conferir contra a lista de ancorados | — | revisão |

---

## Bloco H — Invariantes e fuzz

### 11.G.H.1 — Invariantes do scheduler

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.H.1.1 | Criar `tests/invariants/scheduler_invariants_test.ts` | idem | `deno check` |
| 11.G.H.1.2 | Invariante: toda task `scheduled` tem `start !== null` | idem | 1 teste |
| 11.G.H.1.3 | Invariante: toda task `scheduled` tem `end !== null` | idem | 1 teste |
| 11.G.H.1.4 | Invariante: `start <= end` | idem | 1 teste |
| 11.G.H.1.5 | Invariante: toda milestone tem `start == end` | idem | 1 teste |
| 11.G.H.1.6 | Invariante: dependência respeitada (`B.start >= A.end` se `B depends A`) | idem | 1 teste |
| 11.G.H.1.7 | Invariante: task dentro do range do projeto ou `isRunAway` | idem | 1 teste |

### 11.G.H.2 — Fuzz determinístico

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.H.2.1 | `tests/fuzz/scheduler_fuzz_test.ts` — gerar N=20 projetos determinísticos (seed=42) com 3–10 tasks, dependências aleatórias, 1–3 recursos | idem | `deno check` |
| 11.G.H.2.2 | Para cada projeto gerado, chamar `schedule()`; verificar todos os invariantes de 11.G.H.1 | idem | 20 testes |
| 11.G.H.2.3 | Se algum projeto falhar invariante, salvar em `tests/fuzz/failures/` e reportar | idem | 1 teste |

### 11.G.H.3 — Adicionar ao gate

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.H.3.1 | Adicionar `test:invariants` em `deno.jsonc` | idem | `deno task --list` |
| 11.G.H.3.2 | Adicionar `test:fuzz` em `deno.jsonc` | idem | idem |
| 11.G.H.3.3 | Incluir ambos em `gate:phase-13` | idem | revisão |

---

## Bloco I — Gate de saída + ADR 032

### 11.G.I.1 — ADR 032

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.I.1.1 | Criar `docs/syntaxmesh/decisoes/032-gate-fase-13.md` com frontmatter | idem | arquivo existe |
| 11.G.I.1.2 | Seção **Contexto:** descoberta de gaps em fases "concluídas"; necessidade de gate; Fase 12 rodou antes do fechamento | idem | — |
| 11.G.I.1.3 | Seção **Decisões:** 7 comandos do `gate:phase-13`; política de stubs (`check:stubs`); sweep de testes deferidos (`test:deferred`); matriz de completude versionada | idem | — |
| 11.G.I.1.4 | **Alternativas** (revisão manual, gate só `check:all`) + **Consequências** | idem | — |
| 11.G.I.1.5 | Atualizar linha `032` em `decisoes/README.md` | idem | 32 linhas |

### 11.G.I.2 — Task `gate:phase-13`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 11.G.I.2.1 | Adicionar `gate:phase-13` em `deno.jsonc` composta de: `check:all`, `test:integration`, `test:invariants`, `test:golden:scheduler`, `check:stubs`, `gaps:audit`, `test:deferred` | idem | `deno task --list` |
| 11.G.I.2.2 | Adicionar `gate:phase-13 --partial` (só `check:stubs` + `gaps:audit`) para uso durante a Fase 12 | idem | `deno task --list` |
| 11.G.I.2.3 | Rodar `gate:phase-13`; corrigir falhas | — | verde |
| 11.G.I.2.4 | Documentar em `fase-11-logical-gaps.md` §12 | idem | seção |

---

## Bloco J — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 11.G.J.1 | `deno task gate:phase-13` verde | exit 0 |
| 11.G.J.2 | `completude-matrix.md` com 100% das 21 linhas em `fechado`, `verificado` ou `ancorado` | revisão |
| 11.G.J.3 | `deno task gaps:audit` verde | exit 0 |
| 11.G.J.4 | `deno task check:stubs` verde | exit 0 |
| 11.G.J.5 | `grep -rn "Gate: fase-11-logical-gaps" packages/core/tests/` retorna 0 | grep |
| 11.G.J.6 | `CURRENT.md` atualizado com "Fase 11-gaps concluída; Fase 13 liberada" | revisão |
| 11.G.J.7 | Smoke test final: `deno task probe examples/minimal-placement.tjp` retorna `end !== null` | exit 0 |

---

## Notas para a IA

1. **Ordem:** A → B → C → D → K → E → F → G → H → I → J.
2. **P0 é G1.** Se Bloco B não fechar, não avance para C.
3. **`probe` antes de tudo.** Commitá-lo é o primeiro passo.
4. **Sentinela reapertado.** `logical-scheduler-driven_test.ts` metade 1 falha de
   propósito até G1 fechar.
5. **Golden do scheduler compara `start`/`end`/`effort`.** Um só é insuficiente.
6. **End-to-end com parser real é obrigatório.** `parse → schedule` em ≥ 15
   fixtures, incluindo idiomas pt-BR/es e Complemento 10.
7. **Sweep (Bloco K) é obrigatório.** Nenhum `ignore: true` sobra ao final.
8. **Verificar não é ler.** Cada `Verificar` produz teste novo.
9. **Ancorar ≠ implementar.** G6–G11 só ganham `// Ancorado` + entrada na fase
   dona. Nada de código de Fase 13+ aqui.
10. **G5 é entrega da Fase 12** — só verificamos. Exceção: se 12.18 não entregou,
    implementar aqui com prioridade (11.G.F.4.7).
11. **`check:stubs` falha** se `NotYetImplementedError` não tem `// Ancorado`.
12. **`gaps:audit` falha** se algum gap está `pendente` na matriz.
13. **`test:deferred` falha** se algum teste tem `// Gate: fase-11-logical-gaps`
    (prova que o sweep está completo).
14. **Invariantes determinísticos.** Sem `Math.random()` sem seed.
15. **Sem refatorar.** Corrigir o gap, não "melhorar de passagem".
16. **Sem `any`.** `unknown` + narrowing.
17. **Commit por subfase:** `test(quality): probe-scheduler`,
    `fix(core): schedule-placement`, `test(quality): golden-scheduler-start-end`,
    `test(quality): reenable-deferred-from-phase-12`, `chore(gaps): anchor-to-rti`,
    etc.
18. **`CURRENT.md` atualizado** ao final com "Fase 13 liberada".

---

## Referências cruzadas

- `docs/syntaxmesh/fases/fase-11-logical-gaps.md` — plano deste fechamento
- `docs/syntaxmesh/fases/fase-11-logical-complemento.md` §6.10, §6.11
- `docs/syntaxmesh/fases/fase-7-scheduler-core-tarefas.md` — adendo "Gap remanescente"
- `docs/syntaxmesh/fases/fase-12-richtext-tarefas.md` — Fase 12 (rodou antes)
- `docs/syntaxmesh/fases/completude-matrix.md` — matriz viva
- `docs/syntaxmesh/decisoes/032-gate-fase-13.md` — ADR do gate
- `docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md` — receptor de G6, G7
- `docs/syntaxmesh/fases/fase-16-apoio-tarefas.md` — receptor de G10
- `docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md` — receptor de G9
- `docs/syntaxmesh/fases/fase-19-storage-tarefas.md` — receptor de G11
- `docs/syntaxmesh/fases/fase-8.2-tarefas.md` — receptor de G8

---

**Fim das tarefas de fechamento de gaps.**