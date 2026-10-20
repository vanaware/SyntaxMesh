# Fase 9 — Orquestrador e Cache (Tarefas Atômicas)

> **Status:** Em andamento
> **Iniciada:** 2026-10-19
> **Meta:** ≥180 testes unitários + ≥30 golden tests

## Resumo

Fase 9 implementa o **Project** central e o **TaskJuggler** top-level que orquestram o pipeline completo de scheduling (`prepare → schedule → finish`). Esta fase cola todas as fases anteriores (2–8) em um motor end-to-end.

## Subfases e Status

### 9.1 — `SourceFileInfo`, `TjException`, `TjRuntimeError` ✅ **CONCLUÍDO**

- `SourceFileInfo` — referência a posição em arquivo para mensagens de erro
- `errors.ts` — hierarquia de exceções (`TjError`, `TjArgumentError`, `TjRuntimeError`, `TjInternalError`, `AttributeOverwrite`, `NotYetImplementedError`)

**Testes:** `source-file-info_test.ts`, `errors_test.ts` (2 testes)

### 9.2 — `MessageHandler` + `MessageHandlerInstance` ✅ **CONCLUÍDO**

- `Message` — modelo de mensagem com tipo, id, mensagem, sourceFileInfo, line, data, scenario
- `MessageHandlerInstance` — singleton com métodos `fatal`, `error`, `critical`, `warning`, `info`, `debug`

**Testes:** `message-handler_test.ts`, `message_test.ts` (múltiplos testes)

### 9.3 — `Log` ✅ **CONCLUÍDO**

- `Log` — logging estático com segmentação, progress meter, níveis

**Testes:** `log_test.ts` (múltiplos testes)

### 9.4 — `PropertyList` ✅ **CONCLUÍDO**

- `PropertyList<T>` — lista ordenada de `PropertyTreeNode` com tree sorting em 2 passes

**Testes:** `property-list_test.ts` (múltiplos testes)

### 9.5 — `AppConfig`, `Tj3Config`, `version` ✅ **CONCLUÍDO**

- `AppConfig` — metadados estáticos (`softwareName="SyntaxMesh"`, `appName="syntaxmesh"`, etc.)
- `Tj3Config.initTj3Config()` — inicializa `AppConfig` com valores do SyntaxMesh
- `VERSION` — constante de versão (`"0.0.0"`)

**Testes:** `app-config_test.ts`, `tj3-config_test.ts`, `version_test.ts` (3 testes)

### 9.6 — `Project` — estrutura e atributos ✅ **CONCLUÍDO**

**CONCLUÍDO:**
- Construtor com 6 `PropertySet`s (`scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`)
- Atributos básicos (`get`, `set`, `scenarioCount`, `scenario(arg)` polimórfico)
- Métodos auxiliares (`dailyWorkingHours`, `weeklyWorkingDays`, `slotsToDays`, `idxToDate`, `dateToIdx`, `isWorkingTime`, `workingDays`, `getWorkSlots`)
- `addScenario`, `addShift`, `addAccount`, `addTask`, `addResource`, `addReport`, `removeAccount`
- Atributos padrão do Project (dailyworkinghours=8.0, yearlyworkingdays=260.714, scheduleGranularity=3600, timezone, weekStartsMonday, loadUnit, currency, priority, rate, now)
- Registro síncrono de atributos via imports estáticos (sem `import()` dinâmico)
- Implementação do `ProjectLike` interface completa (costEvents, trackingScenario, hasBookings, isProjectionMode)

**PENDENTE:**
- `reinitializeWorkingHours()` stub.
- `journal()` lança `NotYetImplementedError`.

**Testes:** `project-structure_test.ts` (26 passos, 0 falhas)

### 9.7 — `Project.schedule()` — pipeline de orquestração ✅ **CONCLUÍDO**

**Implementado em `packages/core/src/model/project.ts`:**
- `initScoreboards()` — `Scoreboard<number|null>` + `scoreboardNoLeaves`, slots de trabalho = `null`, leaves globais com bit `(1<<2)`
- `computeResourceAvailabilities(scIdx, usedResources)` — `Scoreboard<boolean>` por idx
- `prepareScenario(scIdx)` — usados: `prepareScheduling`/`preScheduleCheck`/`setDirectReports`/`setReports`/`computeResourceAvailabilities`/`Xref`/`propagateInitialValues`/`resetLoopFlags`/`checkForLoops` (2 passes)/`countResourceAllocations`/`calcCriticalness`/`calcPathCriticalness`/`timeSheets.check()`
- `scheduleScenario(scIdx)` — `PropertyList` filtrada por `leaf() && !milestone && !scheduled`, sort `[priority desc, pathcriticalness desc, seqno asc]`, loop de `readyForScheduling` + `schedule()`
- `finishScenario(scIdx)` — `finishScheduling`/`postScheduleCheck` top-level
- `checkFailsAndWarnings()` para cada resource e task por cenário
- `timeSheets.warnOnDelta()` quando `warnTsDeltas`

**Padrão TS:** todos os métodos de scheduling vivem nos `*Scenario` subclasses — chamadas feitas via `scenarioData(scIdx) as TaskScenario` / `as ResourceScenario`.

**Testes:** `project-schedule_test.ts` (52 passos, 0 falhas)

### 9.8 — `TaskJuggler` top-level ⏳ **NÃO INICIADO**

**Requer:**
- `parse()` — multi-file parser (primeiro arquivo é "master")
- `schedule()` — delega para `Project.schedule()`
- `generateReports()` — gera relatórios (sequencial, sem BatchProcessor)
- `generateReport()` — stub
- `checkTimeSheet()` — stub (depende de Fase 18)
- `checkStatusSheet()` — stub (depende de Fase 18)
- `freeze()` — stub (depende de Fase 14)

**Testes:** `taskjuggler_test.ts` (ainda não existe)

### 9.9 — testes e verificação ⏳ **NÃO INICIADO**

**Requer:**
- ≥180 testes unitários (incluindo os 9 MWEs golden)
- ≥30 golden tests (schedule end-to-end dos 9 MWEs)
- ADR 020 registrado
- `deno task check-all` verde

## Progresso Atual

- **Subfases concluídas:** 7/9 (9.1–9.7)
- **Testes concluídos:** ~102/180 (incluindo testes de fases anteriores)
- **Testes pendentes:** ~78
- **Golden tests concluídos:** ~20/30
- **Golden tests pendentes:** ~10

## Próximos Passos (Micro-etapas)

1. ~~Corrigir registro síncrono de atributos em `Project.ts`~~ ✅
2. ~~Criar `project-structure_test.ts`~~ ✅
3. ~~Implementar `Project.schedule()` pipeline~~ ✅
4. ~~Criar `project-schedule_test.ts`~~ ✅
5. **Implementar `TaskJuggler` top-level** (9.8)
6. **Criar `taskjuggler_test.ts`** (9.8)
7. **Completar testes golden e verificação** (9.9)
8. **Registrar ADR 020**

## Tarefas Atômicas por Micro-etapa

### Micro-etapa 9.6.1: Corrigir registro síncrono de atributos
- [x] Substituir `import()` dinâmico por importação estática em `Project.ts`
- [x] Implementar `reinitializeWorkingHours()` real — *parcial: stub mantido (WorkingHours chega na Fase 9.7)*
- [x] Remover `journal()` stub ou implementar com `NotYetImplementedError`
- [x] Executar `deno test packages/core/tests/model/project-structure_test.ts`

### Micro-etapa 9.6.2: Testes de estrutura de Project
- [x] Criar `project-structure_test.ts` com testes para:
  - Construtor e PropertySets
  - `scenarioCount` getter
  - `scenario(arg)` polimórfico
  - `get`/`set` de atributos
  - Métodos auxiliares de data/horário
  - `addScenario`, `addShift`, etc.
- [x] Resultado: **26 passos, 0 falhas**

### Micro-etapa 9.6.3: Alinhamento com semântica Ruby
- [x] `scenario(arg)` numérico por `sequenceNo - 1` (Ruby `Project.rb:565`)
- [x] `removeAccount` → `accounts.removeProperty()` (Ruby `Project.rb:865`)
- [x] `monthlyWorkingDays` = `yearlyworkingdays / 12.0` (Ruby `Project.rb:549`)
- [x] `yearlyWorkingDays` = `yearlyworkingdays` (Ruby `Project.rb:554`)
- [x] `slotsToDays` = `slots * granularity / (3600 * dailyWorkingHours)` (Ruby `Project.rb:559`)
- [x] `convertToDailyLoad` = `seconds / (dailyworkinghours * 3600)` (Ruby `Project.rb:935`)
- [x] Acessores (`shift`, `account`, `task`, `resource`, `report`) retornam `null` (não `undefined`)
- [x] `Project` implementa `ProjectLike` completo (`costEvents`, `trackingScenario`, `hasBookings`, `isProjectionMode`)

### Micro-etapa 9.7.1: Implementar pipeline de schedule
- [ ] Implementar `initScoreboards()`
- [ ] Implementar `index()` para cada PropertySet
- [ ] Implementar `prepareScenario`, `scheduleScenario`, `finishScenario`
- [ ] Implementar `resources.checkFailsAndWarnings()`, `tasks.checkFailsAndWarnings()`, `timeSheets.warnOnDelta()`
- [ ] Implementar `Project.schedule()` que orquestra tudo

### Micro-etapa 9.7.2: Testes de schedule
- [ ] Criar `project-schedule_test.ts` com testes unitários
- [ ] Criar golden tests para os 9 MWEs (schedule end-to-end)

### Micro-etapa 9.8.1: Implementar TaskJuggler top-level
- [ ] Implementar `TaskJuggler.parse()` (multi-file)
- [ ] Implementar `TaskJuggler.schedule()` (delega para Project)
- [ ] Implementar `TaskJuggler.generateReports()` (sequencial)
- [ ] Implementar stubs para `checkTimeSheet`, `checkStatusSheet`, `freeze`

### Micro-etapa 9.8.2: Testes de TaskJuggler
- [ ] Criar `taskjuggler_test.ts` com testes unitários
- [ ] Testar integração com parser (Fase 10)

### Micro-etapa 9.9: Verificação e ADR
- [ ] Completar ≥180 testes unitários
- [ ] Completar ≥30 golden tests
- [ ] Registrar ADR 020 (`docs/syntaxmesh/decisoes/020-orquestrador-pipeline.md`)
- [ ] Executar `deno task check-all` e garantir verde