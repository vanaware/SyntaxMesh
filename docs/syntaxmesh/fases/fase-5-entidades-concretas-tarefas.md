# Fase 5 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-5-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-5-entidades-concretas.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~108 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{Task,TaskScenario,Resource,ResourceScenario,Account,AccountScenario,Shift,ShiftScenario,Report,Project}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs`.
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento de atributos em `*Scenario` (criado nesta fase).

### Convenções

- `AttributeBase.setMode(0)` em `beforeEach`.
- **Entidades são wrappers finos** de `PropertyTreeNode` (não duplicar lógica).
- **`*Scenario` desta fase são esqueletos** — só constructor + `preloadAttributes`.
- **`scenarioData(scIdx)` é override tipado** em cada entidade.
- **Ordem de registro de `AttributeDefinition`** preserva a ordem do `Project.rb`.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não implementar lógica de scheduling nos `*Scenario` (é Fase 7).
- ❌ Não inventar atributos (a lista do `Project.rb` é a verdade).
- ❌ Não usar `Proxy`.
- ❌ Não modificar ordem dos `registerXAttributes`.

---

## Progresso

```
[ ] 5.0  ADR 016                              —  0/5
[ ] 5.1  ProjectLike + preloadAttributes      —  0/10
[ ] 5.2  Task + TaskScenario                  —  0/7
[ ] 5.3  Resource + ResourceScenario          —  0/7
[ ] 5.4  Account + AccountScenario            —  0/6
[ ] 5.5  Shift + ShiftScenario                —  0/7
[ ] 5.6  Report + ReportScenario              —  0/7
[ ] 5.7  AttrDefs: Scenarios                  —  0/4
[ ] 5.8  AttrDefs: Shifts                     —  0/4
[ ] 5.9  AttrDefs: Accounts                   —  0/4
[ ] 5.10 AttrDefs: Resources                  —  0/6
[ ] 5.11 AttrDefs: Tasks                      —  0/7
[ ] 5.12 AttrDefs: Reports                    —  0/8
[ ] 5.13 MockProject estendido                —  0/6
[ ] 5.14 Golden tests                         —  0/8
[ ] 5.15 Verificação final                    —  0/8
─────────────────────────────────────────────
TOTAL: ~108
```

---

## Bloco A — Fundação

### 5.0 — ADR 016 (pré-carregamento de atributos em `*Scenario`)

**Objetivo:** formalizar a decisão de replicar o pré-carregamento do Ruby.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.0.1 | Criar `docs/syntaxmesh/decisoes/016-pre-carregamento-atributos-scenario.md` com frontmatter | idem | arquivo existe |
| 5.0.2 | Seção **Contexto**: `%w(...).each { \|attr\| @property[attr, @scenarioIdx] }` do Ruby; por que existe | idem | — |
| 5.0.3 | Seção **Decisão**: helper `preloadAttributes(ids: string[])` em `ScenarioData` | idem | — |
| 5.0.4 | Seções **Alternativas** (lazy puro, pré-carregar tudo) + **Consequências** | idem | — |
| 5.0.5 | Adicionar linha `016` em `decisoes/README.md` | `decisoes/README.md` | 16 linhas |

---

### 5.1 — `ProjectLike` estendida + `ScenarioData.preloadAttributes`

**⚠️ Depends:** Fase 4 (`ProjectLike`, `ScenarioData`, `PropertyTreeNode`)
**⚠️ RUBY: `TaskScenario.rb` (construtor), `ResourceScenario.rb` (construtor), `AccountScenario.rb` (construtor)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.1.1 | Estender `ProjectLike` com campos `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports` (todos `PropertySet<T>`) | `src/model/project-like.ts` | `deno check` |
| 5.1.2 | Estender `ProjectLike` com métodos `addScenario`, `addShift`, `addAccount`, `addTask`, `addResource`, `addReport`, `removeAccount` | idem | `deno check` |
| 5.1.3 | Estender `ProjectLike` com `get(attributeId)` / `set(attributeId, value)` e `scenarioIdx(scenario \| id): number \| undefined` | idem | `deno check` |
| 5.1.4 | Adicionar `protected getScenarioAttributes(scIdx: number): Map<string, AttributeBase>` em `PropertyTreeNode` | `src/model/property-tree-node.ts` | `deno check` |
| 5.1.5 | Adicionar `public getScenarioAttribute(scIdx: number, id: string): AttributeBase` em `PropertyTreeNode` (para uso interno do `ScenarioData`) | idem | `deno check` |
| 5.1.6 | ⚠️ Implementar `protected preloadAttributes(ids: string[]): void` em `ScenarioData`: para cada id, chama `property.getScenarioAttribute(scIdx, id)` | `src/model/scenario-data.ts` | 3 testes |
| 5.1.7 | `preloadAttributes` rejeita `id` desconhecido (`TjArgumentError`) | idem | 1 teste |
| 5.1.8 | `preloadAttributes` aceita lista vazia (no-op) | idem | 1 teste |
| 5.1.9 | Reescrever `MockProject` (Fase 4) com os 6 `PropertySet`s + métodos de registro | `tests/model/mock-project.ts` | `deno check` |
| 5.1.10 | Re-exportar novos tipos em `model/mod.ts` e `packages/core/mod.ts` | `src/model/mod.ts`, `src/mod.ts` | `deno check` |

---

## Bloco B — Entidades Concretas

### 5.2 — `Task` + `TaskScenario` (esqueleto)

**⚠️ RUBY: `Task.rb` (arquivo inteiro — ~50 linhas), `TaskScenario.rb` (construtor — linhas 1–40)**
**🔎 CHEAT: §2 (classes), §8 `method_missing` → método explícito (ADR 015)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.2.1 | Criar `src/model/task.ts` com `class Task extends PropertyTreeNode` vazia | idem | `deno check` |
| 5.2.2 | ⚠️ Constructor `(project: ProjectLike, id: string \| null, name: string \| null, parent: Task \| null)`: chama `super(project.tasks, id, name, parent)` + `project.addTask(this)` | idem | 2 testes |
| 5.2.3 | Constructor: inicializa `this.data = new Array(project.scenarioCount)` e cria um `TaskScenario` por cenário | idem | 3 testes |
| 5.2.4 | Override tipado: `scenarioData(scIdx: number): TaskScenario` | idem | 2 testes |
| 5.2.5 | Criar `src/model/task-scenario.ts` com `const TASK_SCENARIO_ATTRS: string[]` com a lista **exata** do Ruby (31 atributos) | idem | 1 teste (contagem === 31) |
| 5.2.6 | ⚠️ Constructor `TaskScenario(task, scIdx, attributes)`: chama `super(task, scIdx, attributes)` + `this.preloadAttributes(TASK_SCENARIO_ATTRS)` | idem | 3 testes |
| 5.2.7 | Teste: `t.getScenarioAttribute(0, "effort")` está pré-carregado após criar `Task` | idem | 1 teste |

**Lista de atributos (do `TaskScenario.rb`):**
```
allocate, assignedresources, booking, charge, chargeset, complete,
competitors, criticalness, depends, duration, effort, effortdone,
effortleft, end, forward, gauge, length, maxend, maxstart, minend,
minstart, milestone, pathcriticalness, precedes, priority,
projectionmode, responsible, scheduled, shifts, start, status
```

---

### 5.3 — `Resource` + `ResourceScenario` (esqueleto)

**⚠️ RUBY: `Resource.rb` (~80 linhas), `ResourceScenario.rb` (construtor)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.3.1 | Criar `src/model/resource.ts` com `class Resource extends PropertyTreeNode` vazia | idem | `deno check` |
| 5.3.2 | ⚠️ Constructor análogo a `Task` (usa `project.resources`, `project.addResource`) | idem | 2 testes |
| 5.3.3 | Constructor: cria um `ResourceScenario` por cenário | idem | 3 testes |
| 5.3.4 | Override tipado: `scenarioData(scIdx): ResourceScenario` | idem | 2 testes |
| 5.3.5 | Criar `src/model/resource-scenario.ts` com `RESOURCE_SCENARIO_ATTRS` (15 atributos do Ruby) | idem | 1 teste |
| 5.3.6 | ⚠️ Constructor `ResourceScenario`: `preloadAttributes(RESOURCE_SCENARIO_ATTRS)` | idem | 3 testes |
| 5.3.7 | Teste: `r.getScenarioAttribute(0, "efficiency")` pré-carregado | idem | 1 teste |

**Lista (do `ResourceScenario.rb`):**
```
alloctdeffort, chargeset, criticalness, directreports, duties,
efficiency, effort, limits, managers, rate, reports, shifts,
leaves, leaveallowances, workinghours
```

---

### 5.4 — `Account` + `AccountScenario` (esqueleto)

**⚠️ RUBY: `Account.rb` (~40 linhas), `AccountScenario.rb` (~130 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.4.1 | Criar `src/model/account.ts` com `class Account extends PropertyTreeNode` | idem | `deno check` |
| 5.4.2 | ⚠️ Constructor análogo (usa `project.accounts`, `project.addAccount`) | idem | 2 testes |
| 5.4.3 | Constructor: cria um `AccountScenario` por cenário | idem | 3 testes |
| 5.4.4 | Override tipado: `scenarioData(scIdx): AccountScenario` | idem | 2 testes |
| 5.4.5 | Criar `src/model/account-scenario.ts` com `ACCOUNT_SCENARIO_ATTRS = ['credits']` (única do Ruby) | idem | 1 teste |
| 5.4.6 | ⚠️ Stub `turnover(startIdx, endIdx): number` — lança `NotYetImplementedError("Fase 8")` + comentário `// TODO Fase 8: turnover completo` | idem | 1 teste |

---

### 5.5 — `Shift` + `ShiftScenario` (quase completo)

**⚠️ RUBY: `Shift.rb` (~45 linhas), `ShiftScenario.rb` (~40 linhas — arquivo completo)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.5.1 | Criar `src/model/shift.ts` com `class Shift extends PropertyTreeNode` | idem | `deno check` |
| 5.5.2 | ⚠️ Constructor análogo (usa `project.shifts`, `project.addShift`) | idem | 2 testes |
| 5.5.3 | Constructor: cria um `ShiftScenario` por cenário | idem | 3 testes |
| 5.5.4 | Override tipado: `scenarioData(scIdx): ShiftScenario` | idem | 2 testes |
| 5.5.5 | Criar `src/model/shift-scenario.ts` com constructor (sem pré-carregamento) | idem | `deno check` |
| 5.5.6 | ⚠️ `onShift?(date: TjTime): boolean` — se `workinghours` null, retorna `true`; senão delega | idem | 3 testes |
| 5.5.7 | ⚠️ `replace?(): boolean` — `this.a('replace') as boolean`; `onLeave?(date): boolean` — itera `leaves` | idem | 4 testes |

---

### 5.6 — `Report` + `ReportScenario` (esqueleto)

**⚠️ RUBY: `Report.rb` (construtor + `checkFileName`)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.6.1 | Criar `src/model/report.ts` com `enum ReportType` (11 valores: `AccountReport`, `Export`, `ICal`, `Niku`, `ResourceReport`, `TagFile`, `TextReport`, `TaskReport`, `TraceReport`, `StatusSheet`, `TimeSheet`) | idem | 1 teste |
| 5.6.2 | Criar `class Report extends PropertyTreeNode` com campos `typeSpec: ReportType \| null`, `content: unknown` | idem | `deno check` |
| 5.6.3 | ⚠️ Constructor análogo (usa `project.reports`, `project.addReport`) | idem | 2 testes |
| 5.6.4 | Constructor: cria um `ReportScenario` por cenário | idem | 3 testes |
| 5.6.5 | Override tipado: `scenarioData(scIdx): ReportScenario` | idem | 2 testes |
| 5.6.6 | ⚠️ `checkFileName(name: string): void` — rejeita `\?%*:\|"<>` (Unix); erro claro | idem | 3 testes |
| 5.6.7 | ⚠️ `absoluteFileName(name: string): string` — prepend `project.outputDir` se relativo; `absoluteFileName?(name): boolean` | idem | 3 testes |

---

## Bloco C — AttributeDefinitions (ordem do `Project.rb`)

**⚠️ Regra de ouro:** a ordem de registro dos atributos **preserva a ordem do `Project.rb`**. Não reordenar alfabeticamente.

**⚠️ Idempotência:** `registerXAttributes` deve poder ser chamada múltiplas vezes sem quebrar (ignora se já registrado).

**⚠️ Base já existe:** `id`, `name`, `seqno` já são adicionados pelo `PropertySet` base (Fase 4). `registerXAttributes` só adiciona os **específicos**.

---

### 5.7 — `AttributeDefinitions`: Scenarios

**⚠️ RUBY: `Project.rb` — bloco `@scenarios = PropertySet.new(self, true)`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.7.1 | Criar `src/model/attributes/scenario-attributes.ts` com `registerScenarioAttributes(ps)` | idem | `deno check` |
| 5.7.2 | Registrar `active` (Boolean, `inheritParent=true`, default `true`) | idem | 3 testes |
| 5.7.3 | Registrar `ownbookings` (Boolean, default `true`) e `projection` (Boolean, `inheritParent=true`, default `false`) | idem | 4 testes |
| 5.7.4 | Teste: `id`, `name`, `seqno` **não** são re-adicionados (já estão na base) | idem | 1 teste |

---

### 5.8 — `AttributeDefinitions`: Shifts

**⚠️ RUBY: `Project.rb` — bloco `@shifts`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.8.1 | Criar `src/model/attributes/shift-attributes.ts` com `registerShiftAttributes(ps)` | idem | `deno check` |
| 5.8.2 | Registrar os 7 atributos na ordem exata: `bsi`, `index`, `leaves`, `replace`, `timezone`, `tree`, `workinghours` | idem | 7 testes (um por atributo) |
| 5.8.3 | Teste: `leaves` é `LeaveListAttribute` e `listAttribute?('leaves') === true` | idem | 1 teste |
| 5.8.4 | Teste: `timezone` default é `TjTime.getTimeZone()` | idem | 1 teste |

---

### 5.9 — `AttributeDefinitions`: Accounts

**⚠️ RUBY: `Project.rb` — bloco `@accounts`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.9.1 | Criar `src/model/attributes/account-attributes.ts` com `registerAccountAttributes(ps)` | idem | `deno check` |
| 5.9.2 | Registrar os 6 atributos na ordem: `aggregate`, `bsi`, `credits`, `index`, `flags`, `tree` | idem | 6 testes |
| 5.9.3 | Teste: `aggregate` default `'tasks'` (Symbol) | idem | 1 teste |
| 5.9.4 | Teste: `credits` é scenario-specific | idem | 1 teste |

---

### 5.10 — `AttributeDefinitions`: Resources

**⚠️ RUBY: `Project.rb` — bloco `@resources`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.10.1 | Criar `src/model/attributes/resource-attributes.ts` com `registerResourceAttributes(ps)` | idem | `deno check` |
| 5.10.2 | Registrar os 10 primeiros (ordem alfabética do Ruby): `alloctdeffort`, `bsi`, `chargeset`, `criticalness`, `duties`, `directreports`, `efficiency`, `effort`, `email`, `fail` | idem | 10 testes |
| 5.10.3 | Registrar os 10 restantes: `flags`, `index`, `leaveallowances`, `leaves`, `limits`, `managers`, `rate`, `reports`, `shifts`, `tree` | idem | 10 testes |
| 5.10.4 | Registrar `warn` e `workinghours` (total 22 atributos) | idem | 2 testes |
| 5.10.5 | Teste: `rate`, `leaves`, `workinghours`, `limits` têm `inheritedFromProject=true` | idem | 4 testes |
| 5.10.6 | Teste: contagem total = 22 (contando base + específicos, ou 20 se filtrar base) | idem | 1 teste |

---

### 5.11 — `AttributeDefinitions`: Tasks

**⚠️ RUBY: `Project.rb` — bloco `@tasks` (o maior — 44 atributos)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.11.1 | Criar `src/model/attributes/task-attributes.ts` com `registerTaskAttributes(ps)` | idem | `deno check` |
| 5.11.2 | Registrar bloco 1 (11): `allocate`, `assignedresources`, `booking`, `bsi`, `charge`, `chargeset`, `complete`, `competitors`, `criticalness`, `depends`, `duration` | idem | 11 testes |
| 5.11.3 | Registrar bloco 2 (11): `effort`, `effortdone`, `effortleft`, `end`, `endpreds`, `endsuccs`, `fail`, `flags`, `forward`, `gauge`, `index` | idem | 11 testes |
| 5.11.4 | Registrar bloco 3 (11): `length`, `limits`, `maxend`, `maxstart`, `milestone`, `minend`, `minstart`, `note`, `pathcriticalness`, `precedes`, `priority` | idem | 11 testes |
| 5.11.5 | Registrar bloco 4 (11): `projectid`, `responsible`, `scheduled`, `projectionmode`, `shifts`, `start`, `startpreds`, `startsuccs`, `status`, `tree`, `warn` | idem | 11 testes |
| 5.11.6 | Teste: `priority` default `500` e é `inheritFromParent` + `inheritFromProject` | idem | 1 teste |
| 5.11.7 | Teste: `milestone` é scenario-specific; `depends`/`precedes` são list attributes | idem | 3 testes |

---

### 5.12 — `AttributeDefinitions`: Reports

**⚠️ RUBY: `Project.rb` — bloco `@reports` (o maior do projeto — 61 atributos)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.12.1 | Criar `src/model/attributes/report-attributes.ts` com `registerReportAttributes(ps)` | idem | `deno check` |
| 5.12.2 | Registrar bloco 1 (10): `accountroot`, `auxdir`, `bsi`, `caption`, `center`, `columns`, `costaccount`, `currencyFormat`, `definitions`, `end` | idem | 10 testes |
| 5.12.3 | Registrar bloco 2 (10): `markdate`, `epilog`, `flags`, `footer`, `formats`, `ganttBars`, `header`, `headline`, `hideAccount`, `hideJournalEntry` | idem | 10 testes |
| 5.12.4 | Registrar bloco 3 (10): `hideResource`, `hideTask`, `height`, `index`, `interactive`, `journalAttributes`, `journalMode`, `left`, `loadUnit`, `now` | idem | 10 testes |
| 5.12.5 | Registrar bloco 4 (10): `numberFormat`, `openNodes`, `prolog`, `rawHtmlHead`, `resourceAttributes`, `resourceroot`, `revenueaccount`, `right`, `rollupAccount`, `rollupResource` | idem | 10 testes |
| 5.12.6 | Registrar bloco 5 (10): `rollupTask`, `scenarios`, `selfcontained`, `shortTimeFormat`, `sortAccounts`, `sortJournalEntries`, `sortResources`, `sortTasks`, `start`, `taskAttributes` | idem | 10 testes |
| 5.12.7 | Registrar bloco 6 (11): `taskroot`, `timeFormat`, `timeOffId`, `timeOffName`, `timezone`, `title`, `tree`, `weekStartsMonday`, `width`, `novevents` | idem | 11 testes |
| 5.12.8 | Teste: `height` default `480`; `width` default `640`; `definitions` default `['*']`; `scenarios` default `[0]` | idem | 4 testes |

---

## Bloco D — Integração

### 5.13 — `MockProject` estendido + fixtures

**⚠️ RUBY: revisitar `MockProject` da Fase 4 e expandir**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.13.1 | Reescrever `tests/model/mock-project.ts` com os 6 `PropertySet`s (`scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`) | idem | `deno check` |
| 5.13.2 | Cada `PropertySet` recebe os atributos base (via `PropertySet` da Fase 4) | idem | 6 testes |
| 5.13.3 | Constructor de `MockProject` cria `scenarioCount` cenários `plan`, `scenario1`, ... | idem | 3 testes |
| 5.13.4 | `addScenario`, `addShift`, `addAccount`, `addTask`, `addResource`, `addReport`, `removeAccount` funcionais | idem | 7 testes |
| 5.13.5 | Criar helper `tests/fixtures/mock-project.ts` com `createMockProject(scenarioCount = 1)` que chama as 6 funções `registerXAttributes` | idem | 1 teste |
| 5.13.6 | `MockProject`: `get('now')`, `get('start')`, `get('end')` têm defaults (`TjTime.fromString("2026-01-01")`) | idem | 3 testes |

---

## Bloco E — Golden tests

### 5.14 — Golden tests (definições de atributos)

**⚠️ RUBY: `Project.rb` — comparação das ~141 `AttributeDefinition`s**

**Objetivo:** comparar cada `AttributeDefinition` registrada em TS com a que o `Project.rb` do Ruby registra.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.14.1 | Atualizar `scripts/golden/README.md` com seção de `attribute-definitions` | idem | existe |
| 5.14.2 | Criar `scripts/golden/attribute-definitions.rb` que instancia `Project.new("prj", "Test", "1.0")` | idem | roda |
| 5.14.3 | Script: iterar `eachAttributeDefinition` para cada `PropertySet` e serializar `{ id, name, tjpId, inheritParent, inheritProject, scenarioSpecific, default }` | idem | JSON válido |
| 5.14.4 | Preservar ordem de inserção (não sortear) | idem | 1 teste |
| 5.14.5 | Gerar `packages/core/tests/golden/attribute-definitions.golden.json` | idem | arquivo existe |
| 5.14.6 | Task `golden:generate` atualizada para incluir o novo script | `deno.jsonc` | roda |
| 5.14.7 | Criar `tests/golden/attribute-definitions_golden_test.ts` que itera os 6 `PropertySet`s e compara cada atributo | idem | verde |
| 5.14.8 | Cobertura ≥ 140 atributos comparados; zero divergências | idem | verde |

---

## Bloco F — Verificação final

### 5.15 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 5.15.1 | `deno task check-all` verde | exit 0 |
| 5.15.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 5.15.3 | `grep -r "NotYetImplementedError" packages/core/src/model/` ≥ 1 (account.turnover) | grep |
| 5.15.4 | ADR 016 criada e commitada | git log |
| 5.15.5 | `Task`, `Resource`, `Account`, `Shift`, `Report` exportados em `model/mod.ts` | `deno check` |
| 5.15.6 | `registerXAttributes` exportadas em `model/attributes/mod.ts` | `deno check` |
| 5.15.7 | `tests/integration/smoke_after_phase_5_test.ts` — cria `MockProject`, cria `Task`, verifica pré-carregamento; verifica Fase 4 (`PropertySet`) | 1 teste |
| 5.15.8 | Auditoria: cada subfase do plano `fase-5-entidades-concretas.md` tem tarefas correspondentes | grep |

---

## Notas para a IA

1. **Ordem:** 5.0 → 5.1 → 5.7–5.12 (AttributeDefinitions) → 5.2–5.6 (entidades) → 5.13 → 5.14 → 5.15.
   - **Por quê:** entidades precisam das `AttributeDefinition`s registradas para funcionar.
   - Exceção: 5.7 pode rodar antes de 5.1.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura.
3. **`AttributeBase.setMode(0)` em `beforeEach`.**
4. **`*Scenario` desta fase são esqueletos.** Não implementar `schedule()`, `book()`, etc.
5. **`preloadAttributes`** existe só para os `*Scenario` com lista do Ruby (Task, Resource, Account).
6. **Ordem dos atributos preserva `Project.rb`** — não reordenar.
7. **`registerXAttributes` é idempotente.**
8. **`LeaveList`, `LeaveAllowanceList` são stubs** nesta fase. Fase 16 implementa.
9. **Stubs** (`NotYetImplementedError`) com comentário `// TODO Fase N: <razão>`.
10. **Sem `any`.** Use `unknown` + narrowing.
11. **Commit por subfase.** `feat(core): task-entity`, `feat(core): task-attributes`, etc.
12. **Golden tests comparam todos os ~141 atributos.** Se divergir, corrigir o TS (não o golden).
13. **Não tocar em Fase 7.** Se algum atributo precisar de lógica (ex: `criticalness`), não implementar.
14. **`scenarioData(scIdx)` é override tipado** em cada entidade.
15. **ADR 016** (não 015). **ADR 015** é metaprogramação (Fase 4).

---

## Notas específicas por subfase

### 5.1 — Fundação

- `ProjectLike` cresce bastante. Manter interface **mínima** — só o que `PropertyTreeNode` + entidades precisam.
- `preloadAttributes` é o único ponto que força criação de atributo scenario-specific.

### 5.2–5.6 — Entidades

- **Todas são wrappers finos.** Não duplicar lógica.
- **Só `ShiftScenario` tem lógica real** (`onShift?`, `replace?`, `onLeave?`).
- **`AccountScenario.turnover`** é stub (Fase 8).

### 5.7–5.12 — AttributeDefinitions

- **Ordem exata do `Project.rb`.** Se um atributo parecer faltar, verificar o Ruby.
- **Sem invenções.** Se não está no `Project.rb`, não existe.
- **Cada bloco de 10-11 atributos** = 1 tarefa atômica.
- **Idempotência:** rodar 2x não quebra.

### 5.13 — MockProject

- Deve ser **completo** agora — todas as 6 entidades instanciáveis.
- `createMockProject` é o helper canônico para todos os testes de Fase 5+.

### 5.14 — Golden tests

- É o **critério de aceite** mais forte desta fase.
- Compara **todos** os ~141 atributos, `id`, `name`, `tjpId`, 3 flags, `default`.
- Qualquer divergência = bug no TS.

---

**Fim do arquivo de tarefas da Fase 5.**