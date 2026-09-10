# 📘 Blueprint de Implementação: TaskJuggler Core Engine → Deno/TypeScript

## 🎯 Objetivo
Documentar o core engine do TaskJuggler (Ruby) para reimplementação em Deno + TypeScript, servindo como referência para outra IA continuar o trabalho.

---

## 🏗️ 1. ARQUITETURA GERAL (Pipeline)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUIVO .tjp / .tji                           │
│              (texto bruto do usuário)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. ProjectFileScanner (Lexer)                                  │
│     - Tokeniza o texto                                          │
│     - Reconhece: IDs, datas, números, strings, keywords         │
│     - Expande macros ${...} e variáveis $(ENV)                  │
│     - Gerencia estados (modos: tjp, dqString, macroCall...)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ tokens
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. ProjectFileParser (Parser)                                  │
│     - Herda de TextParser (parser genérico)                     │
│     - Inclui TjpSyntaxRules (módulo com regras)                 │
│     - Consome tokens e valida sintaxe                           │
│     - Constrói árvore de objetos (Project, Task, Resource...)   │
│     - @property = nó corrente (stack de contexto)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ AST / PropertyTree
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. TjpSyntaxRules (Gramática)                                  │
│     - ~300 funções rule_* que definem a gramática               │
│     - Cada função declara: pattern, doc, arg, example           │
│     - Usado também pelo SyntaxReference para gerar docs         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Property Tree (Modelo de Domínio)                           │
│     - Project → Tasks, Resources, Accounts, Reports, Scenarios  │
│     - Cada Property tem Attributes (herdáveis, scenario-spec)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔤 2. SCANNER — Tipos de Tokens

**Arquivo:** `ProjectFileScanner.rb` (herda de `TextParser::Scanner`)

### 2.1 Tabela de Tokens

| Token Ruby | Tipo TypeScript Sugerido | Regex / Descrição |
|---|---|---|
| `:INTEGER` | `INTEGER` | `\d+` |
| `:FLOAT` | `FLOAT` | `\d*\.\d+` |
| `:DATE` | `DATE` | `YYYY-MM-DD[-HH:MM[:SS][-TZ]]` |
| `:TIME` | `TIME` | `HH:MM` ou `HH:MM:SS` |
| `:STRING` | `STRING` | `"..."`, `'...'` ou `-8<- ... ->8-` (heredoc) |
| `:ID` | `ID` | `[a-zA-Z_]\w*` |
| `:ID_WITH_COLON` | `ID_WITH_COLON` | `foo:` (usado para `scenarioId:`) |
| `:ABSOLUTE_ID` | `ABSOLUTE_ID` | `a.b.c` (com pontos) |
| `:MACRO` | `MACRO` | `[ ... ]` (corpo de macro) |
| `:LITERAL` | `LITERAL` | Operadores: `<=`, `>=`, `!=`, `!`, `{`, `}`, `(`, `)`, `,`, etc. |

### 2.2 Modos do Scanner (State Machine)

```
:tjp          → modo principal (código TJP)
:dqString     → dentro de "..."
:sqString     → dentro de '...'
:szrString    → dentro de -8<- ... ->8-
:szrString1   → primeira linha após -8<-
:cppComment   → dentro de /* ... */
:macroCall    → dentro de ${...}
:macroDef     → dentro de [ ... ] (definição)
```

### 2.3 Comentários Reconhecidos
- `# ...` (linha única)
- `// ...` (linha única, estilo C++)
- `/* ... */` (bloco, multi-linha)

### 2.4 Expansões Automáticas
- **Macros:** `${MACRO_NAME "arg1" "arg2"}` → texto expandido
- **Variáveis de ambiente:** `$(VAR_NAME)` → valor do ENV
- **Macros condicionais:** `${?MACRO}` → vazio se indefinido

### 2.5 Conversões de Dados no Scanner
```typescript
// Exemplo de conversão que o scanner faz:
to_i(match)    → number (parseInt)
to_f(match)    → number (parseFloat)
to_date(match) → TjTime (Date interno em minutos desde epoch)
to_time(match) → number (segundos desde meia-noite)
```

---

## 📜 3. PARSER — Estrutura e Mecanismos

**Arquivo:** `ProjectFileParser.rb` (herda de `TextParser`)

### 3.1 Variáveis de Instância Críticas

```typescript
class ProjectFileParser {
  @scanner: ProjectFileScanner;      // Lexer
  @variables: TokenType[];            // Tokens variáveis aceitos
  @project: Project | null;           // Projeto sendo construído
  @property: Property | null;         // Nó corrente (task/resource/account/report)
  @scenarioIdx: number;               // Índice do cenário corrente (0 = plan)
  @idStack: string[];                 // Stack para 'supplement' aninhados
  @fileStack: FileStackEntry[];       // Stack para includes aninhados
  
  // Prefixos de escopo (herdados em includes)
  @taskprefix: string;
  @resourceprefix: string;
  @accountprefix: string;
  @reportprefix: string;
  
  // Estado temporário para parsing de blocos complexos
  @allocate: Allocation | null;
  @booking: Booking | null;
  @journalEntry: JournalEntry | null;
  @navigator: Navigator | null;
  @limits: Limits | null;
  @limitInterval: ScoreboardInterval;
  @limitResources: Resource[];
  @shiftAssignments: ShiftAssignments | null;
  @column: TableColumnDefinition | null;
  @timeSheet: TimeSheet | null;
  @timeSheetRecord: TimeSheetRecord | null;
  @sheetAuthor: Resource;
  @sheetStart: Date;
  @sheetEnd: Date;
  @reportCounter: number;
  @projectId: string;
  @sortProperty: 'task' | 'resource' | 'account';
  @ruleToExtend: Rule;
  @ruleToExtendWithScenario: Rule;
  @propertySet: PropertySet;
}
```

### 3.2 Macros Globais Automáticas
Após ler o header do projeto, o parser injeta automaticamente:
```typescript
${projectstart}  → data de início do projeto
${projectend}    → data de fim do projeto
${now}           → data "agora" (ou definida por 'now')
${today}         → mesma data formatada com timeFormat
```

### 3.3 Métodos Auxiliares Essenciais

| Método | Função |
|---|---|
| `checkContainer(attr)` | Impede alterar atributo após adicionar filhos |
| `checkInterval(iv)` | Valida intervalo dentro do timeframe do projeto |
| `checkBooking(task, resource)` | Valida que booking é em leaf task e leaf resource |
| `setDurationAttribute(attr, val)` | Gerencia mutual-exclusão: duration/effort/length/milestone |
| `extendPropertySetDefinition(type, default)` | Adiciona atributo user-defined em runtime |
| `newRichText(text, sfi, tokenSet)` | Parse de RichText com contexto de erro |
| `newReport(id, name, type, sfi)` | Cria report com validação de unicidade |
| `setLimit(name, value, interval)` | Aplica limite a recursos específicos |
| `appendScListAttribute(attrId, list)` | Append em listas preservando flag 'provided' |

### 3.4 Helpers de Construção de Regras

```typescript
// Usados DENTRO das funções rule_*:
pattern(tokens, action)    // Define um padrão e sua ação
doc(keyword, text)         // Documentação do keyword
descr(text)                // Descrição curta (para singlePattern)
arg(idx, name, text)       // Documentação de argumento
example(file, tag)         // Exemplo do arquivo de teste
also(keywords)             // "Ver também"
level(supportLevel)        // :supported | :beta | :experimental | :deprecated | :removed
lastSyntaxToken(idx)       // Limita documentação sintática

// Modificadores de regra:
optional                   // Padrão é opcional
repeatable                 // Padrão pode repetir

// Construtores de regras compostas:
optionsRule(attributes)    // { attr1 attr2 ... }
listRule(name, item)       // item, item, item
commaListRule(item)        // , item , item
singlePattern(item)        // Apenas um token
allOrNothingListRule(name, items)  // '*' | '-' | lista
```

### 3.5 Sintaxe de Padrões

```
'_'  → prefixo de literal (keyword)
'$'  → prefixo de token variável ($ID, $STRING, $INTEGER, etc.)
'!'  → prefixo de referência a outra regra (!date, !taskBody)
```

Exemplo:
```ruby
pattern(%w( _project !optionalID $STRING !optionalVersion !interval ), lambda { ... })
```
Significa: keyword `project`, opcionalmente ID, STRING obrigatório, versão opcional, intervalo obrigatório.

---

## 🧩 4. TjpSyntaxRules — Gramática Completa

**Arquivo:** `TjpSyntaxRules.rb` (módulo incluído no Parser)

### 4.1 Estrutura das Regras

Cada regra é uma função `rule_<nome>` que:
1. Chama `pattern()` uma ou mais vezes (alternativas)
2. Cada pattern tem uma `lambda` (ação) que constrói o objeto
3. Usa `doc()`, `arg()`, `example()` para documentação

### 4.2 Categorias de Keywords (Mapeamento Completo)

#### 🏛️ BLOCOS PRINCIPAIS (Property Headers)

| Keyword | Regra | Ação Principal |
|---|---|---|
| `project` | `rule_projectHeader` | `Project.new(id, name, version)` + set start/end |
| `task` | `rule_taskHeader` | `Task.new(project, id, name, parent)` |
| `resource` | `rule_resourceHeader` | `Resource.new(project, id, name, parent)` |
| `account` | `rule_accountHeader` | `Account.new(project, id, name, parent)` |
| `scenario` | `rule_scenarioHeader` | `Scenario.new(project, id, name, parent)` |
| `shift` | `rule_shiftHeader` | `Shift.new(project, id, name, parent)` |
| `supplement` | `rule_supplement*` | Reabre property existente para adicionar attrs |

#### 📊 RELATÓRIOS (Report Headers)

| Keyword | Regra | Tipo Interno |
|---|---|---|
| `taskreport` | `rule_taskReportHeader` | `:taskreport` |
| `resourcereport` | `rule_resourceReportHeader` | `:resourcereport` |
| `accountreport` | `rule_accountReportHeader` | `:accountreport` |
| `textreport` | `rule_textReportHeader` | `:textreport` |
| `tracereport` | `rule_traceReportHeader` | `:tracereport` |
| `export` | `rule_exportHeader` | `:export` |
| `icalreport` | `rule_iCalReportHeader` | `:iCal` |
| `nikureport` | `rule_nikuReportHeader` | `:niku` |
| `tagfile` | `rule_tagfileHeader` | `:tagfile` |
| `timesheetreport` | `rule_tsReportHeader` | `:timeSheet` |
| `statussheetreport` | `rule_ssReportHeader` | `:statusSheet` |

#### 📥 ENTRADA DE DADOS

| Keyword | Regra | Ação |
|---|---|---|
| `journalentry` | `rule_journalEntryHeader` | `JournalEntry.new(...)` |
| `timesheet` | `rule_timeSheetHeader` | `TimeSheet.new(resource, interval, scenarioIdx)` |
| `statussheet` | `rule_statusSheetHeader` | Configura @sheetAuthor, @sheetStart, @sheetEnd |
| `booking` (task) | `rule_taskBookingHeader` | `Booking.new(resource, task, intervals)` |
| `booking` (resource) | `rule_resourceBookingHeader` | `Booking.new(resource, task, intervals)` |

#### 🎯 ATRIBUTOS DE PROJETO (rule_projectBodyAttributes)

```
alertlevels, currency, currencyformat, dailyworkinghours,
extend, include, journalentry, macro, now, markdate,
numberformat, outputdir, scenario, shorttimeformat,
timeformat, timezone, timingresolution, trackingscenario,
weekstartsmonday, weekstartssunday, workinghours, yearlyworkingdays
```

#### 🎯 ATRIBUTOS DE TASK (rule_taskScenarioAttributes)

```
account(removido), allocate, booking, charge, chargeset,
complete, depends, duration, effort, effortdone, effortleft,
end, endcredit(deprecated), fail, flags, length, limits,
maxend, maxstart, milestone, minend, minstart, note,
period, precedes, priority, projectid, responsible,
scheduled, scheduling, schedulingmode, shift(deprecated),
shifts, start, startcredit(deprecated), warn
```

**Atributos task não-scenario-specific (rule_taskAttributes):**
```
adopt, journalentry, note, purge, supplement, task (aninhado),
scenarioIdCol (prefixo de cenário)
```

#### 🎯 ATRIBUTOS DE RESOURCE (rule_resourceScenarioAttributes)

```
chargeset, efficiency, flags, booking, fail, leaveallowances,
leaves, limits, managers, rate, shift(deprecated), shifts,
vacation, warn, workinghours
```

**Atributos resource não-scenario-specific:**
```
email, journalentry, purge, resource (aninhado), supplement
```

#### 🎯 ATRIBUTOS DE ACCOUNT (rule_accountScenarioAttributes)

```
aggregate, credits, flags
```

#### 🎯 ATRIBUTOS DE SHIFT (rule_shiftScenarioAttributes)

```
leaves, replace, timezone, vacation, workinghours
```

#### 🎯 ATRIBUTOS DE SCENARIO (rule_scenarioAttributes)

```
active, disabled(deprecated), enabled(deprecated), projection(deprecated), scenario (aninhado)
```

#### 🎯 ATRIBUTOS GLOBAIS (rule_propertiesBody)

```
account, auxdir, balance, copyright, flags, include, leaves,
limits, macro, navigator, projectid, projectids, rate,
reportProperties, resource, shift, statusSheet, supplement,
task, timeSheet, vacation
```

### 4.3 Atributos Comuns de Relatórios (rule_reportAttributes)

```
accountroot, auxdir, balance, caption, center, columns,
currencyformat, end, epilog, flags, footer, formats, header,
headline, hidejournalentry, hideaccount, hideresource, hidetask,
height, journalattributes, journalmode, left, loadunit,
numberformat, opennodes, period, prolog, purge, rawhtmlhead,
reports, right, rollupaccount, rollupresource, rolluptask,
scenarios, selfcontained, sortaccounts, sortjournalentries,
sortresources, sorttasks, start, resourceroot, taskroot,
timeformat, timezone, title, width
```

### 4.4 IDs de Colunas (rule_reportableAttributes)

Lista completa de colunas disponíveis em relatórios:

```
activetasks, annualleave, annualleavebalance, annualleavelist,
alert, alertmessages(dep), alertsummaries(dep), alerttrend,
balance, bsi, chart, children, closedtasks, competitorcount,
competitors, complete, completed(dep), criticalness, cost, daily,
directreports, duration, duties, efficiency, effort, effortdone,
effortleft, email, end, flags, followers, freetime, freework,
fte, gauge, headcount, hierarchindex(dep), hourly, id, index,
inputs, journal, journal_sub(dep), journalmessages(dep),
journalsummaries(dep), line, managers, maxend, maxstart, minend,
minstart, monthly, no, name, note, opentasks, pathcriticalness,
precursors, priority, quarterly, rate, reports, resources,
responsible, revenue, scenario, scheduling, seqno, sickleave,
specialleave, start, status, targets, turnover, wbs(dep),
unpaidleave, weekly, yearly
```

### 4.5 Funções Lógicas (rule_functionPatterns)

```
hasalert(level, date), isactive(scenarioId), ischildof(parentId),
isdependencyof(taskId, scenarioId, distance), isdutyof(resourceId, scenarioId),
isfeatureof(taskId, scenarioId), isleaf(), ismilestone(scenarioId),
isongoing(scenarioId), isresource(), isresponsibilityof(resourceId, scenarioId),
istask(), isvalid(scenarioId), treelevel()
```

### 4.6 Operadores Lógicos (rule_operator)

```
|   → OR
&   → AND
>   → greater than
<   → less than
=   → equal
>=  → greater-or-equal
<=  → less-or-equal
!=  → not-equal
~   → NOT (prefix)
```

### 4.7 Unidades de Duração (rule_durationUnit)

```
min → minutos
h   → horas
d   → dias
w   → semanas
m   → meses
y   → anos
```

### 4.8 Tipos de Leave (rule_leaveType)

```
project   → outro projeto (menor prioridade)
annual    → férias anuais
special   → licença especial
sick      → doença
unpaid    → não remunerada
holiday   → feriado
unemployed → desempregado (maior prioridade)
```

### 4.9 Modos de Charge (rule_chargeMode)

```
onstart  → cobrar no início
onend    → cobrar no fim
perhour  → cobrar por hora
perday   → cobrar por dia
perweek  → cobrar por semana
```

### 4.10 Modos de Scheduling

**Direção (rule_schedulingDirection):**
```
asap → As Soon As Possible (forward)
alap → As Late As Possible (backward)
```

**Modo (rule_schedulingMode):**
```
planning    → modo planejamento
projection  → modo projeção (respeita bookings passados)
```

### 4.11 Modos de Seleção de Alocação (rule_allocationSelectionMode)

```
maxloaded     → recurso mais carregado
minloaded     → recurso menos carregado
minallocated  → menor fator de alocação (padrão)
order         → primeiro da lista
random        → aleatório
```

### 4.12 Formatos de Saída (rule_outputFormat)

```
csv   → CSV
html  → HTML
niku  → Clarity XML
```

### 4.13 Modos de Journal em Relatórios (rule_journalReportMode)

```
journal      → journal regular
journal_sub  → journal de task + subtasks
status_dep   → último status + dependências
status_down  → último status + sub-propriedades
status_up    → último status (sobe se pai mais recente)
alerts_dep   → alertas + dependências
alerts_down  → alertas + sub-propriedades
```

---

## 🌳 5. MODELO DE DOMÍNIO (Property Tree)

### 5.1 Hierarquia de Classes

```
Property (base abstrata)
├── Task
│   └── TaskScenario (atributos por cenário)
├── Resource
│   └── ResourceScenario
├── Account
│   └── AccountScenario
├── Shift
│   └── ShiftScenario
├── Scenario
└── Report
    ├── TaskReport
    ├── ResourceReport
    ├── AccountReport
    ├── TextReport
    ├── TraceReport
    ├── ExportReport
    ├── ICalReport
    ├── NikuReport
    ├── TagFile
    ├── TimeSheetReport
    └── StatusSheetReport

PropertySet (container de propriedades do mesmo tipo)
├── tasks: PropertySet<Task>
├── resources: PropertySet<Resource>
├── accounts: PropertySet<Account>
├── shifts: PropertySet<Shift>
├── scenarios: PropertySet<Scenario>
└── reports: PropertySet<Report>

Project
├── id: string
├── name: string
├── version: string
├── start: TjTime
├── end: TjTime
├── now: TjTime
├── timezone: string
├── scheduleGranularity: number (minutos)
├── dailyworkinghours: number
├── yearlyworkingdays: number
├── weekStartsMonday: boolean
├── currency: string
├── currencyFormat: RealFormat
├── numberFormat: RealFormat
├── timeFormat: string
├── shortTimeFormat: string
├── outputDir: string
├── trackingScenarioIdx: number
├── costaccount: Account
├── revenueaccount: Account
├── alertLevels: AlertLevelDefinitions
├── flags: string[]
├── leaves: Leave[]
├── limits: Limits
├── journal: Journal
├── navigators: Map<string, Navigator>
├── projectids: string[]
├── tasks: PropertySet
├── resources: PropertySet
├── accounts: PropertySet
├── shifts: PropertySet
├── scenarios: PropertySet
├── reports: PropertySet
├── timeSheets: TimeSheet[]
└── inputFiles: string[]
```

### 5.2 Atributos (Attribute System)

```typescript
// Cada atributo tem:
interface AttributeDefinition {
  id: string;
  description: string;
  type: AttributeType;  // DateAttribute, FloatAttribute, StringAttribute, 
                        // RichTextAttribute, ReferenceAttribute, etc.
  inherit: boolean;
  scenarioSpecific: boolean;
  defaultValue: any;
  userDefined: boolean;
}

// Property armazena atributos assim:
property[id, scenarioIdx] = value;  // leitura/escrita
property.getAttribute(id, scenarioIdx);  // com metadados 'provided'
property.set(id, value);  // respeita AttributeOverwrite
```

### 5.3 Herança de Atributos

```
Global (project) → PropertySet → Parent Property → Child Property
                                                         ↓
                                              Scenario override (se scenarioSpecific)
```

---

## 📖 6. SyntaxReference & KeywordDocumentation

### 6.1 SyntaxReference.rb

**Função:** Percorre todas as regras do parser e extrai keywords documentados.

```typescript
class SyntaxReference {
  keywords: Map<string, KeywordDocumentation>;
  
  constructor() {
    const parser = new ProjectFileParser();
    parser.updateParserTables();
    
    for (const rule of parser.rules.values()) {
      for (const pattern of rule.patterns) {
        if (pattern.doc) {
          const kwd = new KeywordDocumentation(rule, pattern, ...);
          this.keywords.set(pattern.keyword, kwd);
        }
      }
    }
    
    // Cross-referencing
    for (const kwd of this.keywords.values()) {
      kwd.crossReference(this.keywords, parser.rules);
      kwd.computeInheritance();
    }
  }
}
```

### 6.2 KeywordDocumentation.rb

**Função:** Representa a documentação completa de um keyword.

```typescript
class KeywordDocumentation {
  keyword: string;           // ex: "allocate", "flags.task"
  names: string[];           // tokens terminais
  pattern: Pattern;
  syntax: string;            // sintaxe expandida
  args: TokenDoc[];
  contexts: KeywordDocumentation[];  // onde pode aparecer
  optionalAttributes: KeywordDocumentation[];  // atributos filhos
  scenarioSpecific: boolean;
  inheritedFromProject: boolean;
  inheritedFromParent: boolean;
  predecessor: KeywordDocumentation;
  successor: KeywordDocumentation;
  references: RichText[];
  seeAlso: KeywordDocumentation[];
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Estrutura de Pastas Sugerida

```
src/
├── core/
│   ├── ProjectFileScanner.ts    # Lexer
│   ├── ProjectFileParser.ts     # Parser
│   ├── TjpSyntaxRules.ts        # Regras gramaticais
│   ├── TextParser.ts            # Parser genérico (base)
│   └── TextParser/
│       ├── Scanner.ts
│       ├── Pattern.ts
│       ├── Rule.ts
│       ├── MacroTable.ts
│       ├── State.ts
│       └── TokenDoc.ts
├── model/
│   ├── Project.ts
│   ├── Property.ts
│   ├── PropertySet.ts
│   ├── Task.ts
│   ├── Resource.ts
│   ├── Account.ts
│   ├── Shift.ts
│   ├── Scenario.ts
│   ├── Report.ts
│   ├── Attribute.ts
│   ├── AttributeDefinition.ts
│   └── ... (outras entidades)
├── time/
│   ├── TjTime.ts                # Data/hora interna
│   ├── TimeInterval.ts
│   ├── WorkingHours.ts
│   └── Leave.ts
├── reports/
│   ├── TaskReport.ts
│   ├── ResourceReport.ts
│   └── ... (cada tipo de report)
├── scheduler/
│   ├── Scheduler.ts
│   ├── Allocation.ts
│   ├── Booking.ts
│   └── Limits.ts
├── docs/
│   ├── SyntaxReference.ts
│   └── KeywordDocumentation.ts
└── apps/
    └── tj3.ts                   # CLI principal
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 Token Types (enum)
```typescript
export enum TokenType {
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  DATE = 'DATE',
  TIME = 'TIME',
  STRING = 'STRING',
  ID = 'ID',
  ID_WITH_COLON = 'ID_WITH_COLON',
  ABSOLUTE_ID = 'ABSOLUTE_ID',
  MACRO = 'MACRO',
  LITERAL = 'LITERAL',
}

export type Token = [TokenType, any, SourceFileInfo?];
```

#### 7.2.2 Pattern DSL
Como Ruby usa lambdas dinamicamente, em TypeScript use closures:
```typescript
class Rule {
  patterns: Pattern[] = [];
  
  pattern(tokens: string[], action: (this: Parser, ...args: any[]) => any) {
    this.patterns.push(new Pattern(tokens, action));
  }
  
  optional() { /* ... */ }
  repeatable() { /* ... */ }
}
```

#### 7.2.3 Property com Index Signature
```typescript
class Property {
  private attributes = new Map<string, Map<number, AttributeValue>>();
  
  get(id: string, scenarioIdx = 0): any {
    return this.attributes.get(id)?.get(scenarioIdx)?.value;
  }
  
  set(id: string, value: any, scenarioIdx = 0): void {
    // verifica AttributeOverwrite, seta 'provided' flag, etc.
  }
}
```

#### 7.2.4 Regras como Métodos
```typescript
class TjpSyntaxRules {
  // Cada regra vira um método que registra patterns
  rule_project(this: ProjectFileParser) {
    this.pattern(['_project', '!optionalID', '$STRING', '!optionalVersion', '!interval'], 
      function(this: ProjectFileParser) {
        this.project = new Project(this.val[1], this.val[2], this.val[3]);
        this.project.start = this.val[4].start;
        this.project.end = this.val[4].end;
        // ...
      });
    this.doc('project', 'The project property is mandatory...');
  }
}
```

### 7.3 Ordem de Implementação Recomendada

```
FASE 1: Fundação
  1. TjTime.ts (datas internas em minutos)
  2. TimeInterval.ts
  3. MessageHandler.ts (sistema de erros/warnings)
  4. TextParser/ (scanner e parser genéricos)
  5. ProjectFileScanner.ts (lexer TJP)

FASE 2: Parser Core
  6. ProjectFileParser.ts (estrutura base)
  7. TjpSyntaxRules.ts (começar com project, task, resource)
  8. Property.ts + PropertySet.ts
  9. Task.ts, Resource.ts, Account.ts, Scenario.ts

FASE 3: Atributos Complexos
  10. Attribute.ts (todos os tipos)
  11. WorkingHours.ts, Leave.ts
  12. Allocation.ts, Booking.ts
  13. LogicalExpression.ts, LogicalOperation.ts
  14. Limits.ts, ShiftAssignments.ts

FASE 4: Relatórios
  15. Report.ts + subclasses
  16. TableColumnDefinition.ts
  17. TaskReport, ResourceReport, etc.

FASE 5: Scheduler
  18. Scheduler.ts (o coração do TaskJuggler!)
  19. Scoreboard.ts
  20. Dependency resolution

FASE 6: Documentação
  21. SyntaxReference.ts
  22. KeywordDocumentation.ts
  23. CLI tj3.ts
```

### 7.4 Pontos de Atenção (Armadilhas)

1. **Timing Resolution**: Tudo deve ser múltiplo de `scheduleGranularity` (5, 10, 15, 20, 30 ou 60 min).

2. **Scenario Index**: `@scenarioIdx = 0` é sempre o cenário raiz. Atributos scenario-specific usam esse índice.

3. **Property Stack**: `@property` muda conforme entra/sai de blocos. Use `@property.parent` para voltar.

4. **Mutual Exclusion**: `duration`, `effort`, `length`, `milestone` são mutuamente exclusivos (ver `setDurationAttribute`).

5. **Include Files**: Prefixos (`taskprefix`, etc.) são empilhados em `@fileStack`.

6. **Supplement**: Reabre uma property existente. Use `@idStack` para restaurar o contexto.

7. **Container Check**: Muitos atributos não podem ser alterados após adicionar filhos (`checkContainer`).

8. **RichText**: Parser separado com seu próprio scanner. Use `newRichText()` do parser.

9. **Logical Expressions**: Avaliadas left-to-right, sem precedência de operadores (use parênteses).

10. **Export/Tracking Scenario**: Bookings só são permitidos no tracking scenario e seus derivados.

---

## 📋 8. CHECKLIST PARA PRÓXIMA IA

- [ ] Ler `TextParser.rb` (não anexado, mas é a base do parser genérico)
- [ ] Ler `Property.rb`, `Task.rb`, `Resource.rb`, `Account.rb` (modelo de domínio)
- [ ] Ler `Scheduler.rb` (algoritmo de agendamento)
- [ ] Ler `Attribute.rb`, `AttributeDefinition.rb` (sistema de atributos)
- [ ] Ler `LogicalExpression.rb`, `LogicalOperation.rb` (expressões lógicas)
- [ ] Estudar `test/TestSuite/Syntax/Correct/*.tjp` (exemplos válidos)
- [ ] Estudar `test/TestSuite/Syntax/Errors/*.tjp` (casos de erro)
- [ ] Estudar `test/TestSuite/Scheduler/Correct/*.tjp` (scheduling)

---

## 🎁 9. EXEMPLO MINIMALISTA FUNCIONAL

Para validar a implementação, este deve ser o primeiro arquivo processado com sucesso:

```tjp
project hello "Hello World" 2026-01-01 - 2026-12-31 {
  timezone "America/Sao_Paulo"
  timingresolution 60min
  dailyworkinghours 8
}

task t1 "Task 1" {
  start 2026-01-05
  duration 5d
  effort 40h
}

resource r1 "John" {
  efficiency 1.0
  rate 500
}

t1.allocate r1

taskreport r1 "Report" {
  columns bsi, name, start, end, effort, chart
  formats html
}
```

---

**Fim do blueprint.** A IA deve usar este documento como mapa e consultar os arquivos Ruby originais para detalhes de implementação específicos em (docs/taskjuggler/lib/taskjuggler). A ordem sugerida de leitura dos arquivos Ruby é: `TjpSyntaxRules.rb` → `ProjectFileParser.rb` → `ProjectFileScanner.rb` → `SyntaxReference.rb` → `KeywordDocumentation.rb`.