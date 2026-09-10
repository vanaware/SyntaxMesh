### FASE 1 — Fundação e Workspace Deno

**Objetivo:** Esqueleto do monorepo, quality pipeline, ADRs.

**Referências TJ:** nenhuma (infraestrutura pura).

**Subfases:**
- 1.1 — `deno.jsonc` raiz com workspace, catalog, imports, tasks (`test`, `lint`, `fmt`, `check`).
- 1.2 — Criar packages: `core`, `parser`, `report`, `storage`, `ui`, `language`, `richtext`, `markdown`, `worker-db`, `utils`, `service-worker`.
- 1.3 — Cada package com `deno.jsonc` próprio (`name`, `exports`, `version`).
- 1.4 — Configurar `@std/testing/bdd` + `@std/assert` como padrão de testes.
- 1.5 — ADRs 001–008 já existentes + novos ADRs das decisões recentes (RichText mantido, Markdown futuro, worker-db centralizado, BatchProcessor adiado).
- 1.6 — CI: `deno test`, `deno lint`, `deno fmt --check`.

**Critério de aceite:** `deno task test && deno task lint && deno task fmt` sem erros.

---

### FASE 2 — Tempo e Geometria

**Objetivo:** Base temporal do motor. Tudo depende disso.

**Referências TJ:**
- `lib/taskjuggler/TjTime.rb` ← **fonte primária**
- `lib/taskjuggler/Interval.rb`
- `lib/taskjuggler/IntervalList.rb`
- `lib/taskjuggler/WorkingHours.rb`
- `lib/taskjuggler/RealFormat.rb`
- `docs/tj3-engine/01-blueprint-parser.md` (seção TjTime)
- `docs/tj3-engine/02-bluprint-engine1.md` (seção TjTime)

**Subfases:**
- 2.1 — `TjTime`: representação em **segundos desde epoch**, parsing `YYYY-MM-DD[-HH:MM[:SS][-TZ]]`, `align(clock)`, `utc()`, `secondsOfDay(tz)`, `+`/`-`/`<`/`<=`/`>`/`>=`/`==`/`<=>`, `upto(end, step)`.
- 2.2 — `TjTime` normalizações: `beginOfHour`, `midnight`, `beginOfWeek(startMonday)`, `beginOfMonth`, `beginOfQuarter`, `beginOfYear`.
- 2.3 — `TjTime` avanços: `hoursLater`, `sameTimeNextHour`, `sameTimeNextDay`, `sameTimeNextWeek`, `sameTimeNextMonth`, `sameTimeNextQuarter`, `sameTimeNextYear`, `nextDayOfWeek(dow)`.
- 2.4 — `TjTime` diferenças: `hoursTo`, `daysTo`, `weeksTo`, `monthsTo`, `quartersTo`, `yearsTo` (contagem por `sameTimeNext*`).
- 2.5 — `TjTime` timezone: `checkTimeZone`, `setTimeZone`, `timeZone`, `localtime`, `gmtime`. Usar `Intl.DateTimeFormat` + `Temporal` (proposta) ou lib auxiliar.
- 2.6 — `Interval<S, E>` genérico: `contains?`, `overlaps?`, `intersection`, `combine`, `<=>`.
- 2.7 — `TimeInterval` (construtor polimórfico: 1 TjTime, 2 TjTime, 1 TimeInterval; `duration`).
- 2.8 — `ScoreboardInterval` (conversão datas ↔ índices, `startDate`, `endDate`).
- 2.9 — `IntervalList`: `&` (interseção O(n+m)), `<<` (merge automático), `append` (alias).
- 2.10 — `WorkingHours`: `days` (7 × `[from, to][]`), `setWorkingHours`, `timezone=`, `onShift?(arg)`, `timeOff?(interval)`, `weeklyWorkingHours`, `deep_clone`, `==`. Scoreboard interno com `Scoreboard`.
- 2.11 — `RealFormat`: `format(number)`, `to_s`, parâmetros `[signPrefix, signSuffix, thousandsSep, fractionSep, fractionDigits]`.

**Testes obrigatórios:** parsing de datas ISO, timezones `America/Sao_Paulo`, interseção de `IntervalList`, `onShift?` em feriados.

---

### FASE 3 — Modelo de Atributos

**Objetivo:** Sistema de tipos de atributos com herança e scenario-specific.

**Referências TJ:**
- `lib/taskjuggler/AttributeBase.rb`
- `lib/taskjuggler/AttributeDefinition.rb`
- `lib/taskjuggler/Attributes.rb` (~30 subclasses)
- `lib/taskjuggler/deep_copy.rb`
- `docs/tj3-engine/06-blueprint-engine5.md` (seção Attributes)

**Subfases:**
- 3.1 — `AttributeBase` com `mode` (0=provided, 1=inherited, 2=computed), `reset`, `inherit`, `set`, `get`, `value`, `nil?`, `isList?`, `to_s`, `to_num`, `to_sort`, `to_rti`, `to_tjp`, `quotedString`.
- 3.2 — `ListAttributeBase`.
- 3.3 — `AttributeOverwrite` exception.
- 3.4 — `AttributeDefinition` (imutável, `freeze`, campos `id`, `name`, `objClass`, `inheritedFromParent`, `inheritedFromProject`, `scenarioSpecific`, `default`, `userDefined`).
- 3.5 — Atributos simples: `StringAttribute`, `IntegerAttribute`, `FloatAttribute`, `BooleanAttribute`, `DateAttribute`, `DurationAttribute`, `RichTextAttribute`, `ReferenceAttribute`, `SymbolAttribute`, `PropertyAttribute`, `AccountAttribute`, `RealFormatAttribute`, `LimitsAttribute`, `ShiftAssignmentsAttribute`, `WorkingHoursAttribute`, `LogicalExpressionAttribute`.
- 3.6 — Atributos lista: `FlagListAttribute`, `ResourceListAttribute`, `TaskListAttribute`, `AllocationAttribute`, `BookingListAttribute`, `ChargeListAttribute`, `ChargeSetListAttribute`, `DependencyListAttribute`, `TaskDepListAttribute`, `LogicalExpressionListAttribute`, `LeaveListAttribute`, `LeaveAllowanceListAttribute`, `ColumnListAttribute`, `FormatListAttribute`, `ScenarioListAttribute`, `NodeListAttribute`, `SortListAttribute`, `JournalSortListAttribute`, `DefinitionListAttribute`, `TimeIntervalListAttribute`, `SymbolListAttribute`, `AccountCreditListAttribute`.
- 3.7 — Cada subclasse com `tjpId` estático.
- 3.8 — `deepClone` em TS (`structuredClone` + custom para referências a propriedades).

**Testes:** cada atributo com valor válido + inválido; herança (parent → child); `scenarioSpecific` propagação.

---

### FASE 4 — Árvore de Propriedades

**Objetivo:** `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy`.

**Referências TJ:**
- `lib/taskjuggler/PropertyTreeNode.rb` ← **central**
- `lib/taskjuggler/PropertySet.rb`
- `lib/taskjuggler/ScenarioData.rb`
- `lib/taskjuggler/Scenario.rb`
- `lib/taskjuggler/PTNProxy.rb`
- `docs/tj3-engine/02-bluprint-engine1.md` (seções 3 e 4)

**Subfases:**
- 4.1 — `PropertyTreeNode`: construtor com `propertySet`, `id`, `name`, `parent`; árvore `children`/`adoptees`/`stepParents`; `fullId`, `logicalId`, `level`, `getBSIndicies`, `getIndicies`, `addChild`, `isChildOf?`, `leaf?`, `container?`, `ancestors`, `root`, `kids`, `parents`, `all`, `allLeaves`.
- 4.2 — `PropertyTreeNode` atributos: `@attributes` (lazy via Proxy), `@scenarioAttributes` (array por cenário), `get`, `getAttribute`, `force`, `set`, `[]=`, `[]`, `provided`, `inherited`, `modified`, `attributeDefinition`, `checkFailsAndWarnings`.
- 4.3 — `PropertyTreeNode` herança: `inheritAttributes` (parent + project), `backupAttributes`, `restoreAttributes`.
- 4.4 — `PropertyTreeNode` adoção: `adopt(property)`, `getAdopted(property)`, validações (self, duplicate leaf).
- 4.5 — Delegação para `ScenarioData` via `Proxy` (em vez de `method_missing`) — **decisão de design TS**.
- 4.6 — `PropertySet`: `flatNamespace`, `addAttributeType`, `eachAttributeDefinition`, `knownAttribute?`, `hasQuery?`, `scenarioSpecific?`, `inheritedFromProject?`, `inheritedFromParent?`, `listAttribute?`, `defaultValue`, `attributeName`, `attributeType`, `addProperty`, `removeProperty`, `clearProperties`, `[]`, `index`, `levelSeqNo`, `maxDepth`, `items`, `empty?`, `topLevelItems`, `each`, `to_ary`.
- 4.7 — `ScenarioData`: `property`, `project`, `scenarioIdx`, `attributes`, `a(attributeName)`, `error`, `warning`, `info`, `deep_clone`.
- 4.8 — `Scenario`: `all()`, `allLeaves(includeSelf)`, `initialize`.
- 4.9 — `PTNProxy`: `ptn`, `parent`, `logicalId`, `set`, `get`, `[]`, `level`, `isChildOf?`, `getIndicies`, `method_missing`, `is_a?`.

**Testes:** herança 3 níveis; cenário derivado herda bookings; `adopt` duplicado rejeitado; `BSI` correto.

---

### FASE 5 — Entidades Concretas

**Objetivo:** `Task`, `Resource`, `Account`, `Shift`, `Report` (esqueleto).

**Referências TJ:**
- `lib/taskjuggler/Task.rb`
- `lib/taskjuggler/Resource.rb`
- `lib/taskjuggler/Account.rb`
- `lib/taskjuggler/Shift.rb`
- `lib/taskjuggler/Report.rb`
- `lib/taskjuggler/Project.rb` (seção de definição dos atributos por PropertySet) ← **CRÍTICO**

**Subfases:**
- 5.1 — `Task` + `TaskScenario` (esqueleto): `@data[]`, `method_missing` → `TaskScenario`.
- 5.2 — `Resource` + `ResourceScenario`.
- 5.3 — `Account` + `AccountScenario`.
- 5.4 — `Shift` + `ShiftScenario`.
- 5.5 — `Report` + `ReportScenario` (dummy para flags).
- 5.6 — **Definição dos AttributeDefinitions por PropertySet** (copiar do `Project.rb`): `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`.

**Testes:** cada entidade instanciável; cada `addAttributeType` registrado corretamente.

---

### FASE 6 — Scoreboard e Estruturas Base

**Objetivo:** Scoreboard bit-encoded + limites + shifts.

**Referências TJ:**
- `lib/taskjuggler/Scoreboard.rb` ← **central**
- `lib/taskjuggler/Limits.rb`
- `lib/taskjuggler/ShiftAssignments.rb`
- `lib/taskjuggler/ShiftScenario.rb`
- `docs/tj3-engine/02-bluprint-engine1.md` (seção Scoreboard)
- `docs/tj3-engine/05-blueprint-engine4.md` (seções Limits e ShiftAssignments)

**Subfases:**
- 6.1 — `Scoreboard`: `Int32Array`, `idxToDate`, `dateToIdx`, `each`, `each_index`, `collect!`, `[]`, `[]=`, `get`, `set`, `collectIntervals(iv, minDuration)`.
- 6.2 — Codificação de bits: `nil` (livre), `Task` (alocado), `Integer` (leave bits 2–5, work-time bit 1, override bit 8).
- 6.3 — `Limits` + `Limit`: `setLimit` (dailymax/min, weeklymax/min, monthlymax/min, maximum/minimum), `inc`, `dec`, `ok?`, `reset`, `idxToSbIdx`.
- 6.4 — `ShiftAssignments` + `ShiftAssignment`: `addAssignment` (não-sobreposição), `getSbSlot`, `assigned?`, `onShift?`, `timeOff?`, `onLeave?`, `collectTimeOffIntervals`, `hashKey`, compartilhamento de scoreboards via `@@scoreboards`.

**Testes:** bits do scoreboard; interseção de leaves; compartilhamento de scoreboard idêntico.

---

### FASE 7 — Scheduler Core

**Objetivo:** O coração. Loop slot-a-slot.

**Referências TJ:**
- `lib/taskjuggler/TaskScenario.rb` ← **central**
- `lib/taskjuggler/ResourceScenario.rb` ← **central**
- `lib/taskjuggler/Allocation.rb`
- `lib/taskjuggler/Booking.rb`
- `lib/taskjuggler/TaskDependency.rb`
- `docs/tj3-engine/03-bluprint-engine2.md` (seção 3 — TaskScenario)
- `docs/tj3-engine/05-blueprint-engine4.md` (seções Allocation, Booking, TaskDependency)

**Subfases:**
- 7.1 — `TaskDependency`: `taskId`, `task`, `onEnd`, `gapDuration`, `gapLength`, `resolve(project)`, `==`.
- 7.2 — `Allocation`: `candidates`, `selectionMode` (0–4), `persistent`, `mandatory`, `atomic`, `lockedResource`, `shifts`, `candidates(scenarioIdx)`, `onShift?(sbIdx)`.
- 7.3 — `Booking`: `resource`, `task`, `intervals`, `overtime` (0/1/2), `sloppy` (0/1/2), `sourceFileInfo`, `to_s`, `to_tjp`.
- 7.4 — `TaskScenario.prepareScheduling`: reset de `@property['startpreds'|'startsuccs'|'endpreds'|'endsuccs']`, `@isRunAway`, `@currentSlotIdx`, `@doneDuration`/`@doneLength`/`@doneEffort`, `@durationType` (`effortTask`|`lengthTask`|`durationTask`|`startEndTask`), `markAsMilestone`, coleta de `@allLimits`, `@mandatories`, `bookBookings`.
- 7.5 — `TaskScenario.Xref`: resolve `depends`/`precedes`, popula 4 listas, `checkDependency`.
- 7.6 — `TaskScenario.propagateInitialValues`, `preScheduleCheck` (validações: overspecified, underspecified, container_duration, milestone_duration, task_overspecified, task_underspecified).
- 7.7 — `TaskScenario.checkForLoops` (DFS com `@deadEndFlags`).
- 7.8 — `TaskScenario.calcCriticalness`, `calcPathCriticalness`, `calcPathCriticalnessEndSuccs`.
- 7.9 — `TaskScenario.schedule()`: loop principal, `scheduleSlot()` (dispatch por `@durationType`), `bookResources()`, `bookResource()`, `propagateDate()`, `scheduleContainer()`, `earliestStart()`, `latestEnd()`, `readyForScheduling?`, `markAsScheduled`, `markAsRunaway`, `bookBookings`, `rollbackBookings`.
- 7.10 — `ResourceScenario.prepareScheduling`, `calcCriticalness`, `setDirectReports`, `setReports`, `finishScheduling`.
- 7.11 — `ResourceScenario.available?`, `booked?`, `bookedTask`, `book(sbIdx, task, force)`, `bookBooking(sbIdx, booking)`, `bookedEffort`.
- 7.12 — `ResourceScenario.initScoreboard` (working hours, leaves globais, leaves do resource, shifts com `replace`).
- 7.13 — `ResourceScenario.getAllocatedSlots`, `getFreeSlots`, `getWorkSlots`, `getLeaveSlots`, `getTimeOffSlots`, `getEffectiveWork`, `getEffectiveFreeWork`, `getEffectiveFreeTime`, `treeSum`, `fitIndicies`, `collectTimeOffIntervals`, `collectLeaveIntervals`.

**Testes:** projeto de 3 tarefas em cadeia com ASAP; ALAP com `end` fixo; recurso compartilhado; milestone automático; runaway detection; loop detection.

---

### FASE 8 — Sistema Financeiro

**Objetivo:** Custos, receitas, balanço. **Alta prioridade.**

**Referências TJ:**
- `lib/taskjuggler/Charge.rb`
- `lib/taskjuggler/ChargeSet.rb`
- `lib/taskjuggler/AccountCredit.rb`
- `lib/taskjuggler/AccountScenario.rb`
- `docs/tj3-engine/10-blueprint-finance.md` ← **blueprint completo**

**Subfases:**
- 8.1 — `Charge`: `amount`, `mode` (`onStart`|`onEnd`|`perDiem`), `task`, `scenarioIdx`, `turnover(period)`.
- 8.2 — `ChargeSet`: `set`, `master`, `addAccount`, `complete`, `share`, `each`, `to_s`. Validação de 100%.
- 8.3 — `AccountCredit`: `date`, `description`, `amount`.
- 8.4 — `AccountScenario.query_balance`, `query_turnover`, `turnover(startIdx, endIdx)` (privado, recursivo: credits + filhos + aggregate tasks/resources + meta-account balance).
- 8.5 — `TaskScenario.turnover(startIdx, endIdx, account, resource, includeKids)` — combina `resourceCost` + `otherCost` × `chargeset shares`.
- 8.6 — `ResourceScenario.turnover`, `cost`, `query_cost`, `query_revenue`, `query_rate`.
- 8.7 — `TaskScenario.query_cost`, `query_revenue`.
- 8.8 — `AccountListRE` (na Fase 14, mas o `balance` depende daqui).

**Testes:** chargeset 70/30; charge perDiem 10 dias; balance revenue−cost; créditos manuais.

---

### FASE 9 — Orquestrador e Cache

**Objetivo:** `Project`, `TaskJuggler`, `DataCache`, `PropertyList`, `MessageHandler`, `Log`.

**Referências TJ:**
- `lib/taskjuggler/Project.rb` ← **central**
- `lib/taskjuggler/TaskJuggler.rb`
- `lib/taskjuggler/DataCache.rb`
- `lib/taskjuggler/PropertyList.rb`
- `lib/taskjuggler/MessageHandler.rb`
- `lib/taskjuggler/Log.rb`
- `lib/taskjuggler/TjException.rb`
- `lib/taskjuggler/Tj3Config.rb`, `AppConfig.rb`, `version.rb`
- `docs/tj3-engine/10-blueprint-finance.md` (seção DataCache)
- `docs/tj3-engine/11-blueprint-apoio.md`

**Subfases:**
- 9.1 — `DataCache` (singleton, `entries` Map, `highWaterMark`, `lowWaterMark`, `stores`, `hits`, `misses`, `collisions`, `cached(...args, block)`, `flush`, `resize`, `to_s`). **Crítico para performance.**
- 9.2 — `PropertyList`: `items`, `propertySet`, `query`, `sortingLevels`, `sortingCriteria`, `sortingUp`, `scenarioIdx`, `setSorting`, `resetSorting`, `append`, `treeMode?`, `sort!` (2 passes para tree mode), `itemIndex`, `index`, `includeAdopted`, `checkForDuplicates`, `include?`, `[]`, `to_ary`.
- 9.3 — `MessageHandler` (singleton): `messages`, `errors`, `outputLevel`, `logLevel`, `logFile`, `hideScenario`, `abortOnWarning`, `baselineSFI`, `trapSetup`, `fatal`, `error`, `critical`, `warning`, `info`, `debug`, `clear`, `to_s`.
- 9.4 — `Log`: `level`, `stack`, `segments`, `silent`, `progress`, `progressMeter`, `enter`, `exit`, `msg`, `status`, `startProgressMeter`, `stopProgressMeter`, `activity`, `progress`.
- 9.5 — `TjException`, `TjRuntimeError`, `AttributeOverwrite`.
- 9.6 — `Project`: `@attributes` (Map com todos os atributos de projeto), `[]`, `[]=`, `scenarioCount`, `dailyWorkingHours`, `weeklyWorkingDays`, `monthlyWorkingDays`, `yearlyWorkingDays`, `slotsToDays`, `scenario(arg)`, `scenarioIdx(sc)`, `shift`, `account`, `task`, `resource`, `report`, `reportByName`, `schedule`, `enableTraceReports`, `checkReports`, `generateReports`, `generateReport`, `listReports`, `checkTimeSheets`, `add*`/`removeAccount`, `isWorkingTime`, `hasWorkingTime`, `convertToDailyLoad`, `scoreboardSize`, `idxToDate`, `dateToIdx`, `collectTimeOffIntervals`, `workingDays`, `getWorkSlots`, `anyResourceAvailable?`, `maxScheduleGranularity` (estático), `attributeName`, `journal`, `to_s`, `deep_clone`.
- 9.7 — `Project.prepareScenario`, `finishScenario`, `scheduleScenario`, `initScoreboards`, `computeResourceAvailabilities`, `matchingReports`.
- 9.8 — `TaskJuggler` top-level: `parse`, `schedule`, `generateReports`, `generateReport`, `listReports`, `freeze`, `checkTimeSheet`, `checkStatusSheet`, `projectId`, `projectName`, `errors`, `initialize` (UTC forçado).
- 9.9 — `AppConfig`, `Tj3Config`, `version`.

**Testes:** cache hit/miss; PropertyList tree sort; `Project.schedule` com 3 cenários; mensagens com `baselineSFI`.

---

### FASE 10 — Parser e Linguagem

**Objetivo:** Lexer, parser FSM, gramática TJP, i18n.

**Referências TJ:**
- `lib/taskjuggler/TextParser.rb` + `TextParser/*` (Pattern, Rule, State, MacroTable, StackElement, TokenDoc, SourceFileInfo)
- `lib/taskjuggler/ProjectFileScanner.rb`
- `lib/taskjuggler/ProjectFileParser.rb`
- `lib/taskjuggler/TjpSyntaxRules.rb` (~300 `rule_*`) ← **gigante**
- `docs/tj3-engine/01-blueprint-parser.md`

**Subfases:**
- 10.1 — `SourceFileInfo` (`fileName`, `lineNo`, `columnNo`, `to_s`).
- 10.2 — `TokenDoc` (`name`, `text`, `typeSpec`, `pattern`).
- 10.3 — `Macro` + `MacroTable` (`add`, `clear`, `include?`, `resolve`).
- 10.4 — `StackElement` (`val`, `sourceFileInfo`, `function`, `state`, `insert`, `store`, `each`, `length`).
- 10.5 — `StateTransition` + `State` (`rule`, `pattern`, `index`, `transitions`, `noReduce`, `addTransitions`, `addTransition`, `transition(token)`, `expectedTokens`, `to_s`).
- 10.6 — `Pattern` (`keyword`, `doc`, `supportLevel`, `seeAlso`, `exampleFile`, `exampleTag`, `tokens`, `function`, `generateStates`, `addTransitionsToState`, `setDoc`, `setArg`, `setLastSyntaxToken`, `setSupportLevel`, `setSeeAlso`, `setExample`, `[]`, `each`, `optional?`, `terminalSymbol?`, `terminalTokens`, `to_syntax`, `to_s`).
- 10.7 — `Rule` (`name`, `patterns`, `optional`, `repeatable`, `keyword`, `doc`, `addPattern`, `include?`, `setOptional`, `optional?`, `generateStates`, `addTransitionsToState`, `setRepeatable`, `setDoc`, `setArg`, `setLastSyntaxToken`, `setSupportLevel`, `setSeeAlso`, `setExample`, `pattern`, `to_syntax`, `dump`).
- 10.8 — `TextParser` FSM: `rules`, `variables`, `blockedVariables`, `cr`, `states`, `stack`, `initRules`, `newRule`, `pattern`, `optional`, `repeatable`, `updateParserTables`, `parse(ruleName)`, `sourceFileInfo`, `error`, `warning`, `parseFSM`, `finishPattern`, `saveFsmStack`, `restoreFsmStack`, `getNextToken`.
- 10.9 — `Scanner` genérico: `StreamHandle`, `FileStreamHandle`, `BufferStreamHandle`, `mode=`, `open`, `close`, `include`, `sourceFileInfo`, `fileName`, `lineNo`, `nextToken`, `returnToken`, `addMacro`, `macroDefined?`, `expandMacro`, `scanToken`, `message`.
- 10.10 — `ProjectFileScanner`: token patterns (`INTEGER`, `FLOAT`, `DATE`, `TIME`, `STRING`, `ID`, `ID_WITH_COLON`, `ABSOLUTE_ID`, `MACRO`, `LITERAL`), modos (`:tjp`, `:dqString`, `:sqString`, `:szrString`, `:cppComment`, `:macroCall`, `:macroDef`), `to_i`, `to_f`, `to_date`, `to_time`, `startStringDQ/SQ/SZR`, `startMacroCall`, `endMacroCall`, `environmentVariable`, `startMacroDef`, `endMacroDef`.
- 10.11 — `ProjectFileParser`: `@scanner`, `@variables`, `@project`, `@property`, `@scenarioIdx`, `@idStack`, `@fileStack`, `@taskprefix`, `@resourceprefix`, `@accountprefix`, `@reportprefix`, `@allocate`, `@booking`, `@journalEntry`, `@navigator`, `@limits`, `@limitInterval`, `@limitResources`, `@shiftAssignments`, `@column`, `@timeSheet`, `@timeSheetRecord`, `@sheetAuthor`, `@sheetStart`, `@sheetEnd`, `@reportCounter`, `@projectId`, `@sortProperty`, `@ruleToExtend`, `@ruleToExtendWithScenario`, `@propertySet`, `open`, `close`, `nextToken`, `returnToken`, `setGlobalMacros`, `parseReportAttributes`, `weekDay`, `checkContainer`, `checkInterval`, `checkBooking`, `extendPropertySetDefinition`, `newRichText`, `newReport`, `setLimit`, `setDurationAttribute`, `allOrNothingListRule`, `listRule`, `commaListRule`, `optionsRule`, `singlePattern`, `doc`, `descr`, `arg`, `lastSyntaxToken`, `level`, `also`, `example`, `columnTitle`, `initFileStack`, `pushFileStack`, `popFileStack`, `appendScListAttribute`.
- 10.12 — `TjpSyntaxRules`: **~300 regras** divididas em blocos (rules 1–50, 51–100, ...). Cada `rule_*` com `pattern`, `doc`, `arg`, `example`, `also`, `level`.
- 10.13 — **`@syntaxmesh/language`**: `LanguageDefinition` (`id`, `name`, `keywords`, `units`), `LanguageRegistry` (`get`, `register`, `all`), `canonical.ts` (tipo `CanonicalKeyword`), `en.ts`, `pt-BR.ts`, `es.ts`.
- 10.14 — Diretiva `language "pt-BR"` no `.tjp` (tratada pelo Scanner antes de qualquer keyword).
- 10.15 — Resolvedor de sinônimos: keyword → canônica, com erro se ambíguo.

**Testes:** lexing de cada tipo; parsing de `project`, `task`, `resource`, `account`, `shift`, `scenario`, `report`; i18n (AST igual em en/pt-BR/es); macros `${N}`; includes.

---

### FASE 11 — Expressões Lógicas e Queries

**Objetivo:** Motor de expressões lógicas e ponte para reports.

**Referências TJ:**
- `lib/taskjuggler/LogicalExpression.rb`
- `lib/taskjuggler/LogicalOperation.rb`
- `lib/taskjuggler/LogicalFunction.rb`
- `lib/taskjuggler/Query.rb`
- `lib/taskjuggler/SimpleQueryExpander.rb`
- `docs/tj3-engine/03-bluprint-engine2.md` (seção 5)
- `docs/tj3-engine/14-blueprint-others.md` (seção Query)

**Subfases:**
- 11.1 — `LogicalOperation`: `operand1`, `operand2`, `operator`, `eval(expr)`, `to_s(query)`, `evalBinaryOperation`, `coerceBoolean`, `coerceNumber`, `coerceString`, `coerceTime`.
- 11.2 — `LogicalAttribute` (`attribute`, `scenario`, `eval`), `LogicalFlag` (`opnd`, `eval`, `to_s`).
- 11.3 — `LogicalFunction`: 14 funções (`hasalert`, `isactive`, `ischildof`, `isdependencyof`, `isdutyof`, `isfeatureof`, `isleaf`, `ismilestone`, `isongoing`, `isresource`, `isresponsibilityof`, `istask`, `isvalid`, `treelevel`), sufixo `_` inverte property/scopeProperty.
- 11.4 — `LogicalExpression`: `operation`, `query`, `sourceFileInfo`, `eval(query)`, `to_s(query)`, `error(text)`.
- 11.5 — `Query`: `project`, `propertyType`, `propertyId`, `property`, `scopePropertyType`, `scopePropertyId`, `scopeProperty`, `attributeId`, `scenario`, `scenarioIdx`, `start`, `end`, `startIdx`, `endIdx`, `loadUnit`, `numberFormat`, `currencyFormat`, `timeFormat`, `listItem`, `listType`, `hideJournalEntry`, `journalMode`, `journalAttributes`, `sortJournalEntries`, `costAccount`, `revenueAccount`, `selfContained`, `customData`, `setCustomData`, `process`, `assignList`, `to_s`, `to_num`, `to_sort`, `to_rti`, `result`, `scaleDuration`, `scaleLoad`, `scaleValue`, `resolvePropertyId`, `reset`.
- 11.6 — `SimpleQueryExpander`: `inputStr`, `query`, `sourceFileInfo`, `expand()` (`<-scenario->`, `<-name->`).

**Testes:** `a | b & c` = `(a | b) & c`; `isvalid` com DateAttribute; `hidetask` com múltiplos operadores; Query.scaleDuration.

---

### FASE 12 — RichText (compatibilidade TJP)

**Objetivo:** Manter Markup MediaWiki para compatibilidade total com `.tjp`.

**Referências TJ:**
- `lib/taskjuggler/RichText.rb`
- `lib/taskjuggler/RichText/*` (Document, Element, Parser, Scanner, Snip, SyntaxRules, TOCEntry, TableOfContents, FunctionHandler, FunctionExample, RTFHandlers, RTFNavigator, RTFQuery, RTFReport, RTFReportLink, RTFWithQuerySupport)

**Subfases:**
- 12.1 — `RichText` (constructor, `generateIntermediateFormat(sectionCounter, tokenSet)`, `functionHandler(name, block)`).
- 12.2 — `RichTextScanner`: modos (`:bop`, `:bol`, `:inline`, `:nowiki`, `:html`, `:ref`, `:href`, `:func`), tokens (`LINEBREAK`, `SPACE`, `WORD`, `BOLD`, `ITALIC`, `CODE`, `BOLDITALIC`, `PRE`, `HREF`, `HREFEND`, `REF`, `REFEND`, `HLINE`, `HTMLBLOB`, `FCOLSTART`, `FCOLEND`, `QUERY`, `INLINEFUNCSTART`, `INLINEFUNCEND`, `BLOCKFUNCSTART`, `BLOCKFUNCEND`, `ID`, `STRING`, `TITLE1-4`, `TITLE1END-4END`, `BULLET1-4`, `NUMBER1-4`).
- 12.3 — `RichTextParser` + `RichTextSyntaxRules`.
- 12.4 — `RichTextElement`: `richText`, `category`, `children`, `data`, `appendSpace`, `cleanUp`, `empty?`, `tableOfContents`, `internalReferences`, `to_s`, `to_tagged`, `to_html`, `children_to_s`, `checkHandler`, `convertToID`, `sTitle`, `htmlTitle`, `htmlObject`, `textBlockFormat`, `textBlockIndent`.
- 12.5 — `RichTextIntermediate`: `richText`, `functionHandlers`, `blockMode`, `sectionNumbers`, `lineWidth`, `indent`, `titleIndent`, `parIndent`, `listIndent`, `preIndent`, `linkTarget`, `cssClass`, `tree`, `registerFunctionHandler`, `functionHandler`, `empty?`, `tableOfContents`, `internalReferences`, `to_s`, `to_html`, `to_tagged`, `setQuery`.
- 12.6 — `RichTextSnip`, `RichTextDocument`, `TOCEntry`, `TableOfContents`, `RichTextImage`.
- 12.7 — `RichTextFunctionHandler` (abstrata), `FunctionExample`, `RTFHandlers`, `RTFNavigator`, `RTFQuery`, `RTFReport`, `RTFReportLink`, `RTFWithQuerySupport`.

**Testes:** parsing de cada markup; `to_html` equivalente ao Ruby; `to_s` (plain text); functions handlers.

---

### FASE 13 — Markdown (novo, futuro)

**Objetivo:** Formato going-forward. Wrapper sobre `@deno/gfm` + extensões.

**Referências TJ:** nenhuma (novo).

**Subfases:**
- 13.1 — Wrapper `@deno/gfm` (`markdownToHtml`, `markdownToText`).
- 13.2 — Extensões: cor (`<fcol:red>`), HTML inline permitido, funções customizadas (`[[query:...]]`, `[[report:...]]`, `[[navigator:...]]`).
- 13.3 — Mini-queries `<-name->` inline.
- 13.4 — Renderizador `to_s` (plain text).
- 13.5 — Migração gradual: RichText → Markdown.

**Nota:** Fase futura. Não bloqueia nada.

---

### FASE 14 — Relatórios

**Objetivo:** Pipeline completo de relatórios.

**Referências TJ:**
- `lib/taskjuggler/reports/Report.rb` ← **central**
- `lib/taskjuggler/reports/ReportBase.rb`
- `lib/taskjuggler/reports/TableReport.rb` ← **central**
- `lib/taskjuggler/reports/ReportTable.rb`
- `lib/taskjuggler/reports/ReportTableColumn.rb`
- `lib/taskjuggler/reports/ReportTableLine.rb`
- `lib/taskjuggler/reports/ReportTableCell.rb`
- `lib/taskjuggler/reports/ReportTableLegend.rb`
- `lib/taskjuggler/reports/TableReportColumn.rb`
- `lib/taskjuggler/TableColumnDefinition.rb`
- `lib/taskjuggler/TableColumnSorter.rb`
- `lib/taskjuggler/reports/ColumnTable.rb`
- `lib/taskjuggler/reports/ReportContext.rb`
- `lib/taskjuggler/reports/Navigator.rb`
- `lib/taskjuggler/reports/TaskListRE.rb`
- `lib/taskjuggler/reports/ResourceListRE.rb`
- `lib/taskjuggler/reports/AccountListRE.rb`
- `lib/taskjuggler/reports/TextReport.rb`
- `lib/taskjuggler/reports/ExportRE.rb`
- `lib/taskjuggler/reports/TjpExportRE.rb`
- `lib/taskjuggler/reports/MspXmlRE.rb`
- `lib/taskjuggler/reports/ICalReport.rb`
- `lib/taskjuggler/reports/NikuReport.rb`
- `lib/taskjuggler/reports/TraceReport.rb`
- `lib/taskjuggler/reports/CSVFile.rb`
- `lib/taskjuggler/reports/ChartPlotter.rb`
- `docs/tj3-engine/07-blueprint-engine6.md`
- `docs/tj3-engine/08-blueprint-engine7.md`
- `docs/tj3-engine/09-blueprint-engine8.md`

**Subfases:**
- 14.1 — `Report` (PropertyTreeNode): `typeSpec`, `content`, `generate(requestedFormats)`, `generateIntermediateFormat`, `to_html`, `interactive?`, `generateHTML`, `generateCSV`, `generateTJP`, `generateMspXml`, `generateNiku`, `generateICal`, `generateCTags`, `copyAuxiliaryFiles`, `checkFileName`, `absoluteFileName`.
- 14.2 — `ReportBase`: `report`, `project`, `a(attribute)`, `generateIntermediateFormat`, `filterAccountList`, `filterTaskList`, `filterResourceList`, `generateHtmlTableFrame`, `generateHtmlTableRow`, `rt_to_html`, `standardFilterOps`.
- 14.3 — `TableColumnDefinition` + `CellSettingPattern` + `CellSettingPatternList`.
- 14.4 — `TableReport` (base): `legend`, `@@propertiesById`, `@@propertiesByType`, `initialize`, `generateIntermediateFormat`, `to_html`, `to_csv`, `defaultColumnTitle`, `indent`, `alignment`, `calculated?`, `scenarioSpecific?`, `adjustColumnPeriod`, `generateHeaderCell`, `generateAccountList`, `generateTaskList`, `generateResourceList`, `generateTableCell`, `genStandardCell`, `genCalculatedCell`, `genCalChartAccountCell`, `genCalChartTaskCell`, `genCalChartResourceCell`, `setStandardCellAttributes`, `setCustomCellAttributes`, `setScenarioSettings`, `newCell`, `setIndent`, `setAccountCellBgColor`, `checkCellText`, `tryCellMerging`, `genCalChartHeader`.
- 14.5 — `ReportTable` + `ReportTableColumn` + `ReportTableLine` + `ReportTableCell` + `PlaceHolderCell`.
- 14.6 — `ReportTableLegend`.
- 14.7 — `TableColumnSorter`, `ColumnTable`.
- 14.8 — `ReportContext`: `project`, `report`, `query`, `dynamicReportId`, `childReportCounter`, `tasks`, `resources`, `attributeBackup`.
- 14.9 — `Navigator`: `id`, `hideReport`, `generate`, `to_html`, `filterReports`, `normalizeURL`, `findReportURL`.
- 14.10 — `TaskListRE`, `ResourceListRE`, `AccountListRE`.
- 14.11 — `TextReport`.
- 14.12 — `ExportRE` + `TjpExportRE` + `MspXmlRE`.
- 14.13 — `ICalReport` + `ICalendar`.
- 14.14 — `NikuReport`.
- 14.15 — `TraceReport` + `ChartPlotter`.
- 14.16 — `CSVFile`.

**Testes:** cada tipo de report; `columns` customizadas; `hidetask`/`hideresource`; CSV; JSON; HTML.

---

### FASE 15 — Gantt

**Objetivo:** Gantt chart completo em HTML+CSS.

**Referências TJ:**
- `lib/taskjuggler/reports/GanttChart.rb`
- `lib/taskjuggler/reports/GanttHeader.rb`
- `lib/taskjuggler/reports/GanttHeaderScaleItem.rb`
- `lib/taskjuggler/reports/GanttLine.rb`
- `lib/taskjuggler/reports/GanttTaskBar.rb`
- `lib/taskjuggler/reports/GanttMilestone.rb`
- `lib/taskjuggler/reports/GanttContainer.rb`
- `lib/taskjuggler/reports/GanttLoadStack.rb`
- `lib/taskjuggler/reports/GanttRouter.rb`
- `lib/taskjuggler/reports/CollisionDetector.rb`
- `lib/taskjuggler/reports/HTMLGraphics.rb`
- `docs/tj3-engine/16-blueprint-gantt.md` ← **blueprint completo**

**Subfases:**
- 15.1 — `HTMLGraphics`: `lineToHTML`, `rectToHTML`, `jagToHTML`, `diamondToHTML`, `arrowHeadToHTML`.
- 15.2 — `CollisionDetector`: `addBlockedZone`, `collision?`, `to_html`, `clip`, `addSegment`, `overlaps?`, `mergeable?`, `merge`.
- 15.3 — `GanttRouter`: `routeLines`, `route`, `placeLine`, `addLineTo`, `justify`.
- 15.4 — `GanttChart`: `start`, `end`, `now`, `weekStartsMonday`, `header`, `width`, `scale`, `scales`, `table`, `markdate`, `viewWidth`, `generateByScale`, `generateByWidth`, `to_html`, `to_csv`, `dateToX`, `addLine`, `addTask`, `hasScrollbar?`, `completeChart`, `generateDepLines`, `generateTaskDepLines`.
- 15.5 — `GanttHeader`: `gridLines`, `nowLineX`, `markdateLineX`, `cellStartDates`, `height`, `to_html`, `generate`, `genHeaderScale`.
- 15.6 — `GanttHeaderScaleItem`.
- 15.7 — `GanttLine`: `chart`, `query`, `tooltip`, `category`, `y`, `height`, `lineIndex`, `timeOffZones`, `content`, `to_html`, `getTask`, `addBlockedZones`, `generate`, `generateTask`, `generateResource`, `generateTimeOffZones`, `addHtmlTooltip`.
- 15.8 — `GanttTaskBar`, `GanttMilestone`, `GanttContainer`, `GanttLoadStack`.

**Testes:** Gantt com granularidade week; dependency arrows; milestones; container tasks; load stacks.

---

### FASE 16 — Apoio

**Objetivo:** Estruturas auxiliares.

**Referências TJ:**
- `lib/taskjuggler/Journal.rb`
- `lib/taskjuggler/AlertLevelDefinitions.rb`
- `lib/taskjuggler/LeaveList.rb`
- `lib/taskjuggler/TernarySearchTree.rb`
- `lib/taskjuggler/AlgorithmDiff.rb`
- `lib/taskjuggler/TextFormatter.rb`
- `lib/taskjuggler/FileList.rb`
- `lib/taskjuggler/URLParameter.rb`
- `lib/taskjuggler/StdIoWrapper.rb`
- `lib/taskjuggler/UTF8String.rb`
- `lib/taskjuggler/KateSyntax.rb`
- `lib/taskjuggler/VimSyntax.rb`

**Subfases:**
- 16.1 — `Journal` + `JournalEntry` + `JournalEntryList`: `addEntry`, `getEntries`, `entriesByTask`, `entriesByTaskR`, `entriesByResource`, `entries`, `alertLevel`, `alertEntries`, `currentEntries`, `currentEntriesR`, `to_rti`, `hidden`.
- 16.2 — `AlertLevelDefinition` + `AlertLevelDefinitions`.
- 16.3 — `Leave` + `LeaveList` + `LeaveAllowance` + `LeaveAllowanceList`.
- 16.4 — `TernarySearchTree`.
- 16.5 — `AlgorithmDiff` (Diff, Hunk, Diffable).
- 16.6 — `TextFormatter`.
- 16.7 — `FileList` + `FileRecord`.
- 16.8 — `URLParameter` (encode/decode).
- 16.9 — `StdIoWrapper` (adaptado).
- 16.10 — `UTF8String` (adaptado para TS nativo — `each_utf8_char`, `length_utf8`, `forceUTF8Encoding`).
- 16.11 — `KateSyntax`, `VimSyntax` (geradores de syntax highlighting).

**Testes:** Journal.alertLevel com hierarquia; `currentEntriesR` com dependências; TernarySearchTree.

---

### FASE 17 — HTML/XML

**Objetivo:** Geradores de HTML/XML.

**Referências TJ:**
- `lib/taskjuggler/XMLDocument.rb`
- `lib/taskjuggler/XMLElement.rb`
- `lib/taskjuggler/HTMLDocument.rb`
- `lib/taskjuggler/HTMLElements.rb`
- `lib/taskjuggler/ICalendar.rb`

**Subfases:**
- 17.1 — `XMLElement`: `name`, `attributes`, `selfClosing`, `children`, `[]=`, `[]`, `to_s(indent)`, `escape`, `indentation`.
- 17.2 — `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`.
- 17.3 — `XMLDocument`: `elements`, `<<`, `to_s`, `write(filename)`.
- 17.4 — `HTMLDocument` (`initialize(docType)`, `generateHead`, `html`).
- 17.5 — `HTMLElements` (HTML, HEAD, BODY, TITLE, META, etc.).
- 17.6 — `ICalendar`: `Person`, `Component`, `Todo`, `Event`, `Journal`, `to_s`, `dateTime`, `foldLines`.

**Testes:** geração de HTML válido; round-trip XML; iCal com `foldLines`.

---

### FASE 18 — Time/Status Sheets

**Objetivo:** Time sheets e status sheets.

**Referências TJ:**
- `lib/taskjuggler/TimeSheets.rb`
- `lib/taskjuggler/TimeSheetSender.rb`
- `lib/taskjuggler/TimeSheetReceiver.rb`
- `lib/taskjuggler/TimeSheetSummary.rb`
- `lib/taskjuggler/StatusSheetSender.rb`
- `lib/taskjuggler/StatusSheetReceiver.rb`
- `lib/taskjuggler/SheetHandlerBase.rb`
- `lib/taskjuggler/SheetSender.rb`
- `lib/taskjuggler/SheetReceiver.rb`

**Subfases:**
- 18.1 — `TimeSheetRecord` + `TimeSheet` + `TimeSheets`.
- 18.2 — `SheetHandlerBase`, `SheetSender`, `SheetReceiver`.
- 18.3 — `TimeSheetSender`, `TimeSheetReceiver`, `TimeSheetSummary`.
- 18.4 — `StatusSheetSender`, `StatusSheetReceiver`.

**Nota:** Email via SMTP requer servidor; no browser, pode ser adaptado para download/upload.

---

### FASE 19 — Storage

**Objetivo:** Persistência local via `@syntaxmesh/worker-db`.

**Referências TJ:** nenhuma (novo).

**Subfases:**
- 19.1 — Wrapper `worker-db-client` (`get`, `set`, `del`, `keys`).
- 19.2 — CRUD de projetos (IndexedDB via worker-db).
- 19.3 — OPFS via worker-db (arquivos `.tjp`, `.tji`, autosave).
- 19.4 — Import/export `.tjp`.
- 19.5 — Autosave + recovery.

**Regra:** **Nunca** usar `idb-keyval` direto. **Sempre** via `@syntaxmesh/worker-db`.

---

### FASE 20 — PWA + UI

**Objetivo:** Service Worker, manifest, Preact + Signals + BeerCSS.

**Referências TJ:** `docs/BeerCSS/`.

**Subfases:**
- 20.1 — Service Worker + manifest + offline.
- 20.2 — Shell, project explorer, editor.
- 20.3 — Feedback do parser, Gantt visual, relatórios.
- 20.4 — Language selector, tema, responsividade.
- 20.5 — Web Worker para Core/Scheduler.

**Nota:** `BatchProcessor` descartado por enquanto. Se performance degradar, avaliar Web Worker pool.

---

### FASE 21 — Compatibilidade e Qualidade

**Objetivo:** Golden tests, corpus multilíngue, performance, release.

**Referências TJ:**
- `docs/Learning/mwe001–mwe009/` (9 MWEs)
- `docs/taskjuggler/test/TestSuite/`

**Subfases:**
- 21.1 — Corpus de `.tjp` (inglês) + traduções (pt-BR, es).
- 21.2 — Golden tests: rodar `deno task taskjuggler` (tj3 real) e `tj3-ts` no mesmo fixture, comparar saída normalizada.
- 21.3 — Conformidade multilíngue (AST igual).
- 21.4 — Performance (benchmark em projetos grandes).
- 21.5 — Segurança, regressão, cross-browser.
- 21.6 — Build de produção, release.

**Opcional:** `tj3.ts` CLI para rodar no Deno CLI (OPFS como filesystem normal). Não é foco.

---

## Resumo executivo

| Fase | Pacote | Referências Ruby | Prioridade |
|---|---|---|---|
| 1 | workspace | — | Alta |
| 2 | core | TjTime, Interval, IntervalList, WorkingHours, RealFormat | **Crítica** |
| 3 | core | AttributeBase, AttributeDefinition, Attributes, deep_copy | **Crítica** |
| 4 | core | PropertyTreeNode, PropertySet, ScenarioData, Scenario, PTNProxy | **Crítica** |
| 5 | core | Task, Resource, Account, Shift, Report, Project | **Crítica** |
| 6 | core | Scoreboard, Limits, ShiftAssignments, ShiftScenario | **Crítica** |
| 7 | core | TaskScenario, ResourceScenario, Allocation, Booking, TaskDependency | **Crítica** |
| 8 | core | Charge, ChargeSet, AccountCredit, AccountScenario | **Alta** |
| 9 | core | Project, TaskJuggler, DataCache, PropertyList, MessageHandler, Log | **Crítica** |
| 10 | parser + language | TextParser/*, ProjectFileScanner, ProjectFileParser, TjpSyntaxRules | **Crítica** |
| 11 | core | LogicalExpression, LogicalOperation, LogicalFunction, Query, SimpleQueryExpander | **Crítica** |
| 12 | richtext | RichText, RichText/* | **Alta** |
| 13 | markdown | — | Baixa (futuro) |
| 14 | report | reports/* | **Crítica** |
| 15 | report | Gantt* | **Alta** |
| 16 | core | Journal, AlertLevelDefinitions, LeaveList, TernarySearchTree, etc. | **Alta** |
| 17 | report | XMLDocument, XMLElement, HTMLDocument, HTMLElements, ICalendar | **Média** |
| 18 | storage | TimeSheets, Sheet* | **Média** |
| 19 | storage | — | **Alta** |
| 20 | ui + service-worker | — | **Média** |
| 21 | tests/ | MWEs, TestSuite | **Crítica** |
