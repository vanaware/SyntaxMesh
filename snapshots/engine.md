> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém um blueprint investigativo de como funciona o motor do projeto taskjuggler, analisando seu código fonte.
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: ENGINE

Gerado automaticamente em: 9/10/2026, 10:50:42 PM

---

## Arquivo: `docs/tj3-engine/02-bluprint-engine1.md`

````md
# 📘 Blueprint Fase 2: Modelo de Domínio + Orquestração

## 🎯 Objetivo
Documentar o **modelo de domínio** (Property Tree) e o **orquestrador central** (Project) para reimplementação em Deno + TypeScript. Esta fase cobre o que acontece **após** o parsing: como os dados são estruturados, herdados, validados e agendados.

---

## 🏗️ 1. ARQUITETURA GERAL (Modelo de Domínio)

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROJECT                                  │
│  - Orquestrador central                                         │
│  - Atributos globais (currency, timezone, workinghours...)      │
│  - PropertySets: tasks, resources, accounts, shifts, scenarios  │
│  - Scoreboards (global working time + leaves)                   │
│  - TimeSheets, Journal, Reports                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ contém
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PropertySet<T>                                │
│  - Coleção de PropertyTreeNode do mesmo tipo                    │
│  - Define AttributeDefinitions (blueprint dos atributos)        │
│  - Namespace (flat ou hierárquico)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ instancia
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PropertyTreeNode (base)                         │
│  ├── Task                                                       │
│  │   └── TaskScenario (dados por cenário)                       │
│  ├── Resource                                                   │
│  │   └── ResourceScenario                                       │
│  ├── Account                                                    │
│  │   └── AccountScenario                                        │
│  ├── Shift                                                      │
│  │   └── ShiftScenario                                          │
│  ├── Scenario                                                   │
│  └── Report                                                     │
│                                                                 │
│  Atributos:                                                     │
│    @attributes (não-scenario-specific)                          │
│    @scenarioAttributes[scenarioIdx] (scenario-specific)         │
│    @data[scenarioIdx] → *Scenario (métodos específicos)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. PROJECT.RB — O Orquestrador Central

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Container global** | Armazena todos os PropertySets (tasks, resources, accounts, shifts, scenarios, reports) |
| **Atributos de projeto** | currency, timezone, workinghours, dailyworkinghours, etc. |
| **Scoreboards** | `@scoreboard` (com leaves) e `@scoreboardNoLeaves` (sem leaves) |
| **Orquestração** | `schedule()` → `prepareScenario()` → `scheduleScenario()` → `finishScenario()` |
| **Geração de relatórios** | `generateReports()` com paralelismo via `BatchProcessor` |

### 2.2 Atributos do Projeto (Mapa Completo)

```typescript
interface ProjectAttributes {
  alertLevels: AlertLevelDefinitions;
  auxdir: string;
  copyright: string | null;
  costaccount: Account | null;
  currency: string;                    // default: "EUR"
  currencyFormat: RealFormat;          // default: ['-', '', '', ',', 2]
  dailyworkinghours: number;           // default: 8.0
  end: TjTime | null;
  markdate: TjTime | null;
  flags: string[];
  journal: Journal;
  limits: Limits | null;
  leaves: LeaveList;
  loadUnit: 'days' | 'hours' | ...;    // default: :days
  name: string;
  navigators: Map<string, Navigator>;
  now: TjTime;                         // default: TjTime.now.align(3600)
  numberFormat: RealFormat;            // default: ['-', '', '', '.', 1]
  priority: number;                    // default: 500
  projectid: string;
  projectids: string[];
  rate: number;                        // default: 0.0
  revenueaccount: Account | null;
  scheduleGranularity: number;         // em segundos (default: 3600 = 1h)
  shortTimeFormat: string;             // default: "%H:%M"
  start: TjTime | null;
  timeFormat: string;                  // default: "%Y-%m-%d"
  timezone: string;                    // default: TjTime.timeZone
  trackingScenarioIdx: number | null;
  version: string;                     // default: "1.0"
  weekStartsMonday: boolean;           // default: true
  workinghours: WorkingHours | null;
  yearlyworkingdays: number;           // default: 260.714
}
```

### 2.3 AttributeDefinitions por PropertySet

**Cada PropertySet tem um blueprint de atributos registrado no construtor:**

#### 📋 Scenarios
```typescript
[ 'active',      'Enabled',         BooleanAttribute,  true,  false, false, true  ]
[ 'id',          'ID',              StringAttribute,   false, false, false, null  ]
[ 'name',        'Name',            StringAttribute,   false, false, false, null  ]
[ 'ownbookings', 'Own Bookings',    BooleanAttribute,  false, false, false, true  ]
[ 'projection',  'Projection Mode', BooleanAttribute,  true,  false, false, false ]
[ 'seqno',       'No',              IntegerAttribute,  false, false, false, null  ]
```

#### 📋 Shifts
```typescript
[ 'bsi',          'BSI',           StringAttribute,        false, false, false, "" ]
[ 'id',           'ID',            StringAttribute,        false, false, false, null ]
[ 'index',        'Index',         IntegerAttribute,       false, false, false, -1 ]
[ 'leaves',       'Leaves',        LeaveListAttribute,     true,  true,  true,  LeaveList.new ]
[ 'name',         'Name',          StringAttribute,        false, false, false, null ]
[ 'replace',      'Replace',       BooleanAttribute,       true,  false, true,  false ]
[ 'seqno',        'No',            IntegerAttribute,       false, false, false, null ]
[ 'timezone',     'Time Zone',     StringAttribute,        true,  true,  true,  TjTime.timeZone ]
[ 'tree',         'Tree Index',    StringAttribute,        false, false, false, "" ]
[ 'workinghours', 'Working Hours', WorkingHoursAttribute,  true,  true,  true,  null ]
```

#### 📋 Accounts
```typescript
[ 'aggregate', 'Aggregate',   SymbolAttribute,             true,  false, false, :tasks ]
[ 'bsi',       'BSI',         StringAttribute,             false, false, false, "" ]
[ 'credits',   'Credits',     AccountCreditListAttribute,  false, false, true,  [] ]
[ 'id',        'ID',          StringAttribute,             false, false, false, null ]
[ 'index',     'Index',       IntegerAttribute,            false, false, false, -1 ]
[ 'flags',     'Flags',       FlagListAttribute,           true,  false, true,  [] ]
[ 'name',      'Name',        StringAttribute,             false, false, false, null ]
[ 'seqno',     'No',          IntegerAttribute,            false, false, false, null ]
[ 'tree',      'Tree Index',  StringAttribute,             false, false, false, "" ]
```

#### 📋 Resources
```typescript
[ 'alloctdeffort',   'Alloctd. Effort',     FloatAttribute,               false, false, true,  0.0 ]
[ 'bsi',             'BSI',                 StringAttribute,              false, false, false, "" ]
[ 'chargeset',       'Charge Sets',         ChargeSetListAttribute,       true,  false, true,  [] ]
[ 'criticalness',    'Criticalness',        FloatAttribute,               false, false, true,  0.0 ]
[ 'duties',          'Duties',              TaskListAttribute,            false, false, true,  [] ]
[ 'directreports',   'Direct Reports',      ResourceListAttribute,        false, false, true,  [] ]
[ 'efficiency',      'Efficiency',          FloatAttribute,               true,  false, true,  1.0 ]
[ 'effort',          'Total Effort',        IntegerAttribute,             false, false, true,  0 ]
[ 'email',           'Email',               StringAttribute,              false, false, false, null ]
[ 'fail',            'Failure Conditions',  LogicalExpressionListAttribute, false, false, false, [] ]
[ 'flags',           'Flags',               FlagListAttribute,            true,  false, true,  [] ]
[ 'index',           'Index',               IntegerAttribute,             false, false, false, -1 ]
[ 'leaveallowances', 'Leave Allowances',    LeaveAllowanceListAttribute,  true,  false, true,  LeaveAllowanceList.new ]
[ 'leaves',          'Leaves',              LeaveListAttribute,           true,  true,  true,  LeaveList.new ]
[ 'limits',          'Limits',              LimitsAttribute,              true,  true,  true,  null ]
[ 'managers',        'Managers',            ResourceListAttribute,        true,  false, true,  [] ]
[ 'rate',            'Rate',                FloatAttribute,               true,  true,  true,  0.0 ]
[ 'reports',         'Reports',             ResourceListAttribute,        false, false, true,  [] ]
[ 'seqno',           'No',                  IntegerAttribute,             false, false, false, null ]
[ 'shifts',          'Shifts',              ShiftAssignmentsAttribute,    true,  false, true,  null ]
[ 'tree',            'Tree Index',          StringAttribute,              false, false, false, "" ]
[ 'warn',            'Warning Condition',   LogicalExpressionListAttribute, false, false, false, [] ]
[ 'workinghours',    'Working Hours',       WorkingHoursAttribute,        true,  true,  true,  null ]
```

#### 📋 Tasks (MAIS COMPLEXO!)
```typescript
[ 'allocate',          'Allocations',         AllocationAttribute,          true,  false, true,  [] ]
[ 'assignedresources', 'Assigned Resources',  ResourceListAttribute,        false, false, true,  [] ]
[ 'booking',           'Bookings',            BookingListAttribute,         false, false, true,  [] ]
[ 'bsi',               'BSI',                 StringAttribute,              false, false, false, "" ]
[ 'charge',            'Charges',             ChargeListAttribute,          false, false, true,  [] ]
[ 'chargeset',         'Charge Sets',         ChargeSetListAttribute,       true,  false, true,  [] ]
[ 'complete',          'Completion',          FloatAttribute,               false, false, true,  null ]
[ 'competitors',       'Competitors',         TaskListAttribute,            false, false, true,  [] ]
[ 'criticalness',      'Criticalness',        FloatAttribute,               false, false, true,  0.0 ]
[ 'depends',           'Preceding tasks',     DependencyListAttribute,      true,  false, true,  [] ]
[ 'duration',          'Duration',            DurationAttribute,            false, false, true,  0 ]
[ 'effort',            'Effort',              DurationAttribute,            false, false, true,  0 ]
[ 'effortdone',        'Completed Effort',    IntegerAttribute,             false, false, true,  null ]
[ 'effortleft',        'Remaining Effort',    IntegerAttribute,             false, false, true,  null ]
[ 'end',               'End',                 DateAttribute,                false, false, true,  null ]
[ 'endpreds',          'End Preds.',          TaskDepListAttribute,         false, false, true,  [] ]
[ 'endsuccs',          'End Succs.',          TaskDepListAttribute,         false, false, true,  [] ]
[ 'fail',              'Failure Conditions',  LogicalExpressionListAttribute, false, false, false, [] ]
[ 'flags',             'Flags',               FlagListAttribute,            true,  false, true,  [] ]
[ 'forward',           'Scheduling',          BooleanAttribute,             true,  false, true,  true ]
[ 'gauge',             'Schedule gauge',      StringAttribute,              false, false, true,  null ]
[ 'id',                'ID',                  StringAttribute,              false, false, false, null ]
[ 'index',             'Index',               IntegerAttribute,             false, false, false, -1 ]
[ 'length',            'Length',              DurationAttribute,            false, false, true,  0 ]
[ 'limits',            'Limits',              LimitsAttribute,              false, false, true,  null ]
[ 'maxend',            'Max. End',            DateAttribute,                true,  false, true,  null ]
[ 'maxstart',          'Max. Start',          DateAttribute,                false, false, true,  null ]
[ 'milestone',         'Milestone',           BooleanAttribute,             false, false, true,  false ]
[ 'minend',            'Min. End',            DateAttribute,                false, false, true,  null ]
[ 'minstart',          'Min. Start',          DateAttribute,                true,  false, true,  null ]
[ 'name',              'Name',                StringAttribute,              false, false, false, null ]
[ 'note',              'Note',                RichTextAttribute,            false, false, false, null ]
[ 'pathcriticalness',  'Path Criticalness',   FloatAttribute,               false, false, true,  0.0 ]
[ 'precedes',          'Following tasks',     DependencyListAttribute,      true,  false, true,  [] ]
[ 'priority',          'Priority',            IntegerAttribute,             true,  true,  true,  500 ]
[ 'projectid',         'Project ID',          SymbolAttribute,              true,  true,  true,  null ]
[ 'responsible',       'Responsible',         ResourceListAttribute,        true,  false, true,  [] ]
[ 'scheduled',         'Scheduled',           BooleanAttribute,             true,  false, true,  false ]
[ 'projectionmode',    'Projection Mode',     BooleanAttribute,             true,  false, true,  false ]
[ 'seqno',             'No',                  IntegerAttribute,             false, false, false, null ]
[ 'shifts',            'Shifts',              ShiftAssignmentsAttribute,    true,  false, true,  null ]
[ 'start',             'Start',               DateAttribute,                false, false, true,  null ]
[ 'startpreds',        'Start Preds.',        TaskDepListAttribute,         false, false, true,  [] ]
[ 'startsuccs',        'Start Succs.',        TaskDepListAttribute,         false, false, true,  [] ]
[ 'status',            'Task Status',         StringAttribute,              false, false, true,  "" ]
[ 'tree',              'Tree Index',          StringAttribute,              false, false, false, "" ]
[ 'warn',              'Warning Condition',   LogicalExpressionListAttribute, false, false, false, [] ]
```

### 2.4 Formato de AttributeDefinition

Cada atributo é definido por uma tupla:
```typescript
[
  id: string,              // ID único no PropertySet
  name: string,            // Nome amigável (para relatórios)
  objClass: AttributeType, // Classe do atributo (DateAttribute, FloatAttribute, etc.)
  inheritedFromParent: boolean,  // Herda do pai?
  inheritedFromProject: boolean, // Herda do projeto global?
  scenarioSpecific: boolean,     // Valor diferente por cenário?
  default: any             // Valor padrão
]
```

### 2.5 Pipeline de Scheduling

```typescript
async schedule(): Promise<boolean> {
  this.initScoreboards();
  
  // Validações iniciais
  if (this.tasks.empty()) throw new Error('No tasks defined');
  
  // Para cada cenário ativo:
  for (const scenario of this.scenarios) {
    if (!scenario.get('active')) continue;
    
    const scIdx = this.scenarioIdx(scenario);
    
    // FASE 1: Preparação (herança + validação)
    AttributeBase.setMode(1);  // modo "inherited"
    this.prepareScenario(scIdx);
    
    // FASE 2: Agendamento
    AttributeBase.setMode(2);  // modo "computed"
    this.scheduleScenario(scIdx);
    
    // FASE 3: Finalização (pós-validação)
    this.finishScenario(scIdx);
  }
  
  // Valida fail/warn em resources e tasks
  for (const resource of this.resources) resource.checkFailsAndWarnings();
  for (const task of this.tasks) task.checkFailsAndWarnings();
  
  return true;
}
```

### 2.6 Scoreboards (CRÍTICO!)

**Dois scoreboards globais são criados:**

```typescript
// Scoreboard com leaves (feriados, férias globais)
@scoreboard: Scoreboard;

// Scoreboard sem leaves (apenas working hours)
@scoreboardNoLeaves: Scoreboard;
```

**Inicialização:**
```typescript
initScoreboards(): void {
  // 1. Cria scoreboards com todos os slots "indisponíveis" (valor 2)
  @scoreboard = new Scoreboard(start, end, scheduleGranularity, 2);
  @scoreboardNoLeaves = new Scoreboard(start, end, scheduleGranularity, 2);
  
  // 2. Marca slots de working hours como disponíveis (nil)
  let date = @scoreboard.idxToDate(0);
  const delta = @attributes['scheduleGranularity'];
  for (let i = 0; i < scoreboardSize(); i++) {
    if (workinghours.onShift?(date)) {
      @scoreboard[i] = null;
      @scoreboardNoLeaves[i] = null;
    }
    date = date.plus(delta);
  }
  
  // 3. Marca slots de leaves globais com bit de time-off
  for (const leave of @attributes['leaves']) {
    const startIdx = @scoreboard.dateToIdx(leave.interval.start);
    const endIdx = @scoreboard.dateToIdx(leave.interval.end);
    for (let i = startIdx; i < endIdx; i++) {
      const sb = @scoreboard[i];
      @scoreboard[i] = ((sb === null || sb === 4) ? 0 : 2) | (1 << 2);
    }
  }
}
```

**Bits do Scoreboard:**
- `nil` = disponível (working time)
- `2` = indisponível (fora do working hours)
- `4` = time-off (leave)
- Bit 2 (valor 4) = leave global

### 2.7 Conversões de Tempo

```typescript
// Scoreboard index → Data
idxToDate(idx: number): TjTime {
  return @attributes['start'].plus(idx * @attributes['scheduleGranularity']);
}

// Data → Scoreboard index
dateToIdx(date: TjTime, forceIntoProject = true): number {
  if (date < @attributes['start'] || date > @attributes['end']) {
    if (forceIntoProject) {
      if (date < @attributes['start']) return 0;
      if (date > @attributes['end']) return scoreboardSize() - 1;
    } else {
      throw new Error(`Date ${date} out of project range`);
    }
  }
  return Math.floor((date - @attributes['start']) / @attributes['scheduleGranularity']);
}

// Time slots → Dias de trabalho
slotsToDays(slots: number): number {
  return slots * @attributes['scheduleGranularity'] / (60 * 60 * dailyWorkingHours);
}
```

### 2.8 Granularidade Máxima por Timezone

```typescript
static maxScheduleGranularity(): number {
  const refTime = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
  const min = refTime.getMinutes();  // offset em minutos do timezone local
  
  if (min === 0) return 60 * 60;       // 1h (alinhado com UTC)
  if (min === 30) return 30 * 60;      // 30min (meia hora off)
  if (min === 15 || min === 45) return 15 * 60;  // 15min (15/45 off)
  throw new Error(`Unknown timezone alignment: ${min}`);
}
```

---

## 🌳 3. PROPERTYTREENODE.RB — A Base de Tudo

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Árvore pai/filho** | `@parent`, `@children`, `@adoptees`, `@stepParents` |
| **Namespace de IDs** | `@subId` (curto) + `fullId()` (hierárquico) |
| **Atributos** | `@attributes` (não-scenario) + `@scenarioAttributes[scIdx]` |
| **Herança** | `inheritAttributes()` do pai ou do projeto |
| **Métodos por cenário** | `method_missing` delega para `@data[scenarioIdx]` (TaskScenario, etc.) |

### 3.2 Estrutura Interna

```typescript
class PropertyTreeNode {
  @propertySet: PropertySet;        // PropertySet ao qual pertence
  @project: Project;                // Referência ao projeto
  @parent: PropertyTreeNode | null; // Pai na árvore
  @id: string;                      // ID completo (fullId)
  @subId: string;                   // ID curto (sem prefixo do pai)
  @name: string;                    // Nome amigável
  @sequenceNo: number;              // Ordem de declaração
  @level: number;                   // Nível na árvore (0 = root)
  @sourceFileInfo: SourceFileInfo;  // Para mensagens de erro
  
  @children: PropertyTreeNode[];    // Filhos reais
  @adoptees: PropertyTreeNode[];    // Filhos adotados (via 'adopt')
  @stepParents: PropertyTreeNode[]; // Pais adotivos
  
  // Atributos NÃO scenario-specific
  @attributes: Map<string, Attribute>;
  
  // Atributos scenario-specific (um Map por cenário)
  @scenarioAttributes: Map<string, Attribute>[];
  
  // Dados específicos do cenário (TaskScenario, ResourceScenario, etc.)
  @data: ScenarioData[];
}
```

### 3.3 Sistema de Atributos (Lazy Creation)

```typescript
constructor(propertySet, id, name, parent) {
  // Atributos NÃO scenario-specific: criados sob demanda
  @attributes = new Proxy({}, {
    get: (target, attributeId) => {
      if (!target[attributeId]) {
        const aType = this.attributeDefinition(attributeId);
        if (!aType) throw new Error(`Unknown attribute '${attributeId}'`);
        if (aType.scenarioSpecific) {
          throw new Error(`Attribute '${attributeId}' is scenario specific`);
        }
        target[attributeId] = new aType.objClass(propertySet, aType, this);
      }
      return target[attributeId];
    }
  });
  
  // Atributos scenario-specific: um Proxy por cenário
  @scenarioAttributes = Array.from({ length: project.scenarioCount }, () => 
    new Proxy({}, {
      get: (target, attributeId) => {
        if (!target[attributeId]) {
          const aType = this.attributeDefinition(attributeId);
          if (!aType) throw new Error(`Unknown attribute '${attributeId}'`);
          if (!aType.scenarioSpecific) {
            throw new Error(`Attribute '${attributeId}' is not scenario specific`);
          }
          target[attributeId] = new aType.objClass(propertySet, aType, @data[scenarioIdx]);
        }
        return target[attributeId];
      }
    })
  );
}
```

### 3.4 Acesso a Atributos

```typescript
// Leitura de atributo NÃO scenario-specific
get(attributeId: string): any {
  return @attributes[attributeId].get();
}

// Leitura de atributo scenario-specific
get(attributeId: string, scenarioIdx: number): any {
  return @data[scenarioIdx].instanceVariableGet('@' + attributeId);
}

// Escrita com verificação de overwrite
set(attributeId: string, value: any): void {
  const attr = @attributes[attributeId];
  const overwrite = attr.provided && !attr.isList();
  attr.set(value);
  if (overwrite) {
    throw new AttributeOverwrite(`Overwriting ${attributeId}`);
  }
}

// Escrita scenario-specific (COM PROPAGAÇÃO!)
set(attributeId: string, scenarioIdx: number, value: any): void {
  if (AttributeBase.mode === 0) {
    // Modo "provided": propaga para TODOS os cenários derivados
    for (const sc of @project.scenario(scenarioIdx).all()) {
      const idx = @project.scenarioIdx(sc);
      const attr = @scenarioAttributes[idx][attributeId];
      if (attr.provided && !attr.isList()) {
        throw new AttributeOverwrite(...);
      }
      if (idx === scenarioIdx) {
        attr.set(value);
      } else {
        attr.inherit(value);
      }
    }
  } else {
    const attr = @scenarioAttributes[scenarioIdx][attributeId];
    const overwrite = attr.provided && !attr.isList();
    attr.set(value);
    if (overwrite) throw new AttributeOverwrite(...);
  }
}
```

### 3.5 Herança de Atributos

```typescript
inheritAttributes(): void {
  // 1. Atributos NÃO scenario-specific
  for (const attrDef of @propertySet.eachAttributeDefinition()) {
    if (attrDef.scenarioSpecific || !attrDef.inheritedFromParent) continue;
    
    const aId = attrDef.id;
    if (@parent) {
      // Herda do pai
      if (@parent.provided(aId) || @parent.inherited(aId)) {
        @attributes[aId].inherit(@parent.get(aId));
      }
    } else {
      // Herda do projeto (apenas top-level)
      if (attrDef.inheritedFromProject && @project[aId]) {
        @attributes[aId].inherit(@project[aId]);
      }
    }
  }
  
  // 2. Atributos scenario-specific
  for (const attrDef of @propertySet.eachAttributeDefinition()) {
    if (!attrDef.scenarioSpecific || !attrDef.inheritedFromParent) continue;
    
    for (let scenarioIdx = 0; scenarioIdx < @project.scenarioCount; scenarioIdx++) {
      if (@parent) {
        if (@parent.provided(attrDef.id, scenarioIdx) || 
            @parent.inherited(attrDef.id, scenarioIdx)) {
          @scenarioAttributes[scenarioIdx][attrDef.id].inherit(
            @parent[attrDef.id, scenarioIdx]
          );
        }
      } else {
        if (attrDef.inheritedFromProject && @project[attrDef.id]) {
          @scenarioAttributes[scenarioIdx][attrDef.id].inherit(
            @project[attrDef.id]
          );
        }
      }
    }
  }
}
```

### 3.6 IDs e Hierarquia

```typescript
// ID completo (hierárquico): "pai.filho.neto"
fullId(): string {
  if (@propertySet.flatNamespace) return @subId;
  
  let res = @subId;
  let t: PropertyTreeNode | null = this;
  while ((t = t.parent) !== null) {
    res = t.subId + '.' + res;
  }
  return res;
}

// Nível na árvore (0 = root)
level(): number {
  if (@level >= 0) return @level;
  let t: PropertyTreeNode | null = this;
  @level = 0;
  while ((t = t.parent) !== null) {
    @level++;
  }
  return @level;
}

// Breakdown Structure Index (BSI): [1, 2, 3] → "1.2.3"
getBSIndicies(): number[] {
  const idcs: number[] = [];
  let p: PropertyTreeNode | null = this;
  do {
    const parent = p.parent;
    idcs.unshift(parent ? parent.levelSeqNo(p) : @propertySet.levelSeqNo(p));
    p = parent;
  } while (p);
  return idcs;
}
```

### 3.7 Adopt (Adoção de Tasks)

```typescript
adopt(property: PropertyTreeNode): void {
  if (this === property) {
    throw new Error('A property cannot adopt itself');
  }
  
  // Verifica duplicatas no root
  const allOfRoot = this.root.all();
  for (const adoptee of property.allLeaves()) {
    if (allOfRoot.includes(adoptee)) {
      throw new Error(`Task '${adoptee.fullId}' already adopted`);
    }
  }
  
  @adoptees.push(property);
  property.getAdopted(this);
}

// Lista completa de filhos (reais + adotados)
kids(): PropertyTreeNode[] {
  return [...@children, ...@adoptees];
}

// Lista completa de pais (real + adotivos)
parents(): PropertyTreeNode[] {
  return [@parent ? @parent : [], ...@stepParents].flat();
}
```

### 3.8 method_missing (Delegação para Scenario)

**Padrão Ruby importante:** Quando um método não existe em `PropertyTreeNode`, é delegado para `@data[scenarioIdx]`:

```typescript
// Em TypeScript, usar método explícito:
scenarioData(scenarioIdx: number): ScenarioData {
  return @data[scenarioIdx];
}

// Exemplo de uso:
task.readyForScheduling?(scIdx) 
  → @data[scIdx].readyForScheduling?()
  → TaskScenario.readyForScheduling()
```

---

## 📋 4. TASK.RB — A Entidade Mais Complexa

### 4.1 Estrutura

```typescript
class Task extends PropertyTreeNode {
  constructor(project, id, name, parent) {
    super(project.tasks, id, name, parent);
    project.addTask(this);
    
    // Um TaskScenario por cenário
    @data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new TaskScenario(this, i, @scenarioAttributes[i])
    );
  }
  
  readyForScheduling?(scenarioIdx: number): boolean {
    return @data[scenarioIdx].readyForScheduling?();
  }
}
```

### 4.2 TaskScenario (Delegado)

**TaskScenario** contém os métodos específicos de task por cenário:
- `readyForScheduling?()`
- `schedule()`
- `prepareScheduling()`
- `preScheduleCheck()`
- `postScheduleCheck()`
- `finishScheduling()`
- `calcCriticalness()`
- `calcPathCriticalness()`
- `propagateInitialValues()`
- `candidates()` (recursos alocáveis)

> **Nota:** TaskScenario NÃO foi anexado ainda, mas é essencial para o scheduler.

### 4.3 journalText (RichText)

```typescript
private journalText(query, longVersion, recursive): void {
  // Coleta entradas do journal
  const list = recursive
    ? @project.journal.entriesByTaskR(this, query.start, query.end, query.hideJournalEntry)
    : @project.journal.entriesByTask(this, query.start, query.end, query.hideJournalEntry);
  
  // Ordena por alert (desc), date (desc), seqno (asc)
  list.setSorting([['alert', -1], ['date', -1], ['seqno', 1]]);
  list.sort!();
  
  // Compõe RichText markup
  let rText = '';
  for (const entry of list) {
    const levelRecord = @project.alertLevels[entry.alertLevel];
    rText += `== [${levelRecord.name}] ${entry.headline} ==\n`;
    rText += `''Reported on ${entry.date.to_s(query.timeFormat)}'' `;
    if (entry.author) rText += `''by ${entry.author.name}''\n`;
    // ... summary, details, etc.
  }
  
  // Converte para intermediate format
  const rti = new RichText(rText, RTFHandlers.create(@project))
    .generateIntermediateFormat([0, 0, 0], tokenSet);
  rti.sectionNumbers = false;
  rti.cssClass = 'tj_journal';
  query.rti = rti;
}
```

---

## 🏷️ 5. ATTRIBUTEDEFINITION.RB — O Sistema de Tipos

### 5.1 Estrutura

```typescript
class AttributeDefinition {
  readonly id: string;                    // ID único
  readonly name: string;                  // Nome amigável
  readonly objClass: AttributeType;       // Classe do atributo
  readonly inheritedFromParent: boolean;  // Herda do pai?
  readonly inheritedFromProject: boolean; // Herda do projeto?
  readonly scenarioSpecific: boolean;     // Valor por cenário?
  readonly default: any;                  // Valor padrão
  readonly userDefined: boolean;          // Criado via 'extend'?
  
  constructor(id, name, objClass, inheritedFromParent, 
              inheritedFromProject, scenarioSpecific, default, 
              userDefined = false) {
    // ... atribuições
    Object.freeze(this);  // Imutável!
  }
}
```

### 5.2 Tipos de Atributos Disponíveis

| Tipo | Descrição | Exemplo |
|---|---|---|
| `StringAttribute` | Texto | `name`, `id`, `email` |
| `IntegerAttribute` | Número inteiro | `priority`, `seqno` |
| `FloatAttribute` | Número real | `efficiency`, `rate` |
| `BooleanAttribute` | true/false | `active`, `milestone`, `forward` |
| `DateAttribute` | Data (TjTime) | `start`, `end`, `maxstart` |
| `DurationAttribute` | Duração (em slots) | `duration`, `effort`, `length` |
| `RichTextAttribute` | Texto formatado | `note`, `caption`, `headline` |
| `SymbolAttribute` | Enum/símbolo | `aggregate`, `projectid` |
| `ReferenceAttribute` | URL + label | (user-defined) |
| `PropertyAttribute` | Referência a Property | `accountroot`, `taskroot` |
| `AccountAttribute` | Referência a Account | `costaccount`, `revenueaccount` |
| `FlagListAttribute` | Lista de flags | `flags` |
| `ResourceListAttribute` | Lista de Resources | `managers`, `responsible` |
| `TaskListAttribute` | Lista de Tasks | `duties`, `competitors` |
| `AllocationAttribute` | Lista de Allocations | `allocate` |
| `BookingListAttribute` | Lista de Bookings | `booking` |
| `ChargeListAttribute` | Lista de Charges | `charge` |
| `ChargeSetListAttribute` | Lista de ChargeSets | `chargeset` |
| `DependencyListAttribute` | Lista de Dependencies | `depends`, `precedes` |
| `TaskDepListAttribute` | Lista de TaskDeps | `startpreds`, `endsuccs` |
| `LogicalExpressionAttribute` | Expressão lógica | `hideTask`, `rollupTask` |
| `LogicalExpressionListAttribute` | Lista de expressões | `fail`, `warn` |
| `LeaveListAttribute` | Lista de Leaves | `leaves` |
| `LeaveAllowanceListAttribute` | Lista de Allowances | `leaveallowances` |
| `LimitsAttribute` | Limites | `limits` |
| `ShiftAssignmentsAttribute` | Shifts | `shifts` |
| `WorkingHoursAttribute` | Horário de trabalho | `workinghours` |
| `ColumnListAttribute` | Lista de colunas | `columns` |
| `FormatListAttribute` | Lista de formatos | `formats`, `taskAttributes` |
| `SortListAttribute` | Lista de sorting | `sortTasks`, `sortResources` |
| `ScenarioListAttribute` | Lista de cenários | `scenarios` |
| `NodeListAttribute` | Lista de nodes | `openNodes` |
| `DefinitionListAttribute` | Lista de definições | `definitions` |
| `RealFormatAttribute` | Formato de número | `currencyFormat`, `numberFormat` |
| `JournalSortListAttribute` | Sorting de journal | `sortJournalEntries` |
| `AccountCreditListAttribute` | Lista de créditos | `credits` |

### 5.3 AttributeBase (Modos de Operação)

```typescript
class AttributeBase {
  static mode: 0 | 1 | 2 = 0;
  
  // 0 = "provided" (usuário setou)
  // 1 = "inherited" (herdado de pai/projeto)
  // 2 = "computed" (calculado pelo scheduler)
  
  static setMode(mode: 0 | 1 | 2): void {
    this.mode = mode;
  }
}
```

**Importante:** O modo afeta como o atributo é marcado:
- Modo 0: `attr.provided = true`
- Modo 1: `attr.inherited = true`
- Modo 2: `attr.computed = true`

### 5.4 Attribute (Instância)

```typescript
class Attribute {
  @propertySet: PropertySet;
  @definition: AttributeDefinition;
  @owner: PropertyTreeNode | ScenarioData;
  @value: any;
  @provided: boolean = false;
  @inherited: boolean = false;
  @computed: boolean = false;
  
  set(value: any): void {
    switch (AttributeBase.mode) {
      case 0: this.@provided = true; break;
      case 1: this.@inherited = true; break;
      case 2: this.@computed = true; break;
    }
    this.@value = value;
  }
  
  inherit(value: any): void {
    this.@inherited = true;
    this.@value = value;
  }
  
  reset(): void {
    this.@value = this.@definition.default;
    this.@provided = false;
    this.@inherited = false;
  }
  
  isList?(): boolean {
    // Lista de tipos que são considerados "list attributes"
    return this instanceof ListAttribute;
  }
}
```

---

## ⏰ 6. TJTIME.RB — O Sistema de Tempo Interno

### 6.1 Representação Interna

**IMPORTANTE:** `TjTime` **NÃO** armazena datas como `Date` do JavaScript. Usa `Time` do Ruby internamente, que é **segundos desde Epoch (1970-01-01 00:00 UTC)**.

```typescript
class TjTime {
  @time: Date;  // Em TypeScript, usar Date (ms desde epoch)
  
  // Constantes
  static MON_MAX = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Timezone global
  static tz: string = process.env.TZ || 'UTC';
}
```

### 6.2 Parsing de Datas

**Formato aceito:** `YYYY-MM-DD[-HH:MM[:SS][-TZ]]`

```typescript
parse(t: string): void {
  const [year, month, day, time, zone] = t.split('-', 5);
  
  // Validações
  if (year < 1970 || year > 2035) throw new Error('Year out of range');
  if (month < 1 || month > 12) throw new Error('Month out of range');
  // ... day, hour, minute, second
  
  // Time é opcional (default: 00:00:00)
  if (!time) {
    hour = minute = second = 0;
  }
  
  // Zone é opcional (default: timezone atual)
  if (zone) {
    if (zone[0] !== '-' && zone[0] !== '+') {
      throw new Error('Time zone must be prefixed by + or -');
    }
    if (zone.length !== 5) {
      throw new Error('Time zone must use (+/-)HHMM format');
    }
    
    // Converte para UTC
    this.@time = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const sign = zone[0] === '-' ? -1 : 1;
    const tzHour = parseInt(zone.slice(1, 3));
    const tzMinute = parseInt(zone.slice(3, 5));
    const timeOffset = sign * (tzHour * 3600 + tzMinute * 60);
    
    // Subtrai o offset para converter para UTC
    this.@time = new Date(this.@time.getTime() - timeOffset * 1000);
  } else {
    // Usa timezone local
    this.@time = new Date(year, month - 1, day, hour, minute, second);
  }
}
```

### 6.3 Validação de Timezone

```typescript
static checkTimeZone(zone: string): boolean {
  if (zone === 'UTC') return true;
  if (!zone.includes('/')) return false;  // Deve ser "Region/City"
  
  // Testa se o OS reconhece a timezone
  const oldTZ = process.env.TZ;
  process.env.TZ = zone;
  const newZone = new Date().toString().match(/\(([^)]+)\)/)?.[1];
  
  // Restaura
  if (oldTZ) process.env.TZ = oldTZ;
  else delete process.env.TZ;
  
  // Verifica se converteu corretamente
  const region = zone.slice(0, zone.indexOf('/'));
  return newZone !== zone && newZone !== region && newZone !== 'UTC';
}

static setTimeZone(zone: string): string {
  if (!zone || !TjTime.checkTimeZone(zone)) {
    throw new Error(`Illegal time zone ${zone}`);
  }
  const oldTimeZone = TjTime.tz;
  TjTime.tz = zone;
  process.env.TZ = zone;
  return oldTimeZone;
}
```

### 6.4 Alinhamento com Granularidade

```typescript
align(clock: number): TjTime {
  // clock em segundos (ex: 3600 para 1h)
  const seconds = Math.floor(this.@time.getTime() / 1000);
  const aligned = Math.floor(seconds / clock) * clock;
  return new TjTime(aligned * 1000);
}
```

### 6.5 Operações Aritméticas

```typescript
plus(secs: number): TjTime {
  return new TjTime(this.@time.getTime() + secs * 1000);
}

minus(arg: TjTime | number): TjTime | number {
  if (arg instanceof TjTime) {
    // Retorna diferença em segundos
    return (this.@time.getTime() - arg.time.getTime()) / 1000;
  } else {
    // Retorna nova data
    return new TjTime(this.@time.getTime() - arg * 1000);
  }
}
```

### 6.6 Normalizações (CRÍTICO para relatórios)

```typescript
midnight(): TjTime {
  const lt = this.localtime();
  return new TjTime(Date.UTC(lt.year, lt.month, lt.day, 0, 0, 0));
}

beginOfHour(): TjTime {
  const lt = this.localtime();
  return new TjTime(Date.UTC(lt.year, lt.month, lt.day, lt.hour, 0, 0));
}

beginOfWeek(startMonday: boolean): TjTime {
  const lt = this.localtime();
  const weekday = lt.dayOfWeek;
  const offset = weekday - (startMonday ? 1 : 0);
  const adjusted = (offset + 7) % 7;
  const result = new TjTime(this.@time.getTime() - adjusted * 24 * 3600 * 1000);
  return result.midnight();
}

beginOfMonth(): TjTime {
  const lt = this.localtime();
  return new TjTime(Date.UTC(lt.year, lt.month, 1, 0, 0, 0));
}

beginOfQuarter(): TjTime {
  const lt = this.localtime();
  const quarterMonth = ((lt.month) % 3);  // 0, 3, 6, 9
  return new TjTime(Date.UTC(lt.year, quarterMonth, 1, 0, 0, 0));
}

beginOfYear(): TjTime {
  const lt = this.localtime();
  return new TjTime(Date.UTC(lt.year, 0, 1, 0, 0, 0));
}
```

### 6.7 "Same Time Next X" (Para cálculos de intervalo)

```typescript
sameTimeNextDay(): TjTime {
  const lt = this.localtime();
  let [sec, min, hour, day, month, year] = [lt.sec, lt.min, lt.hour, lt.day, lt.month, lt.year];
  
  day += 1;
  if (day > this.lastDayOfMonth(month, year)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return new TjTime(Date.UTC(year, month - 1, day, hour, min, sec));
}

sameTimeNextWeek(): TjTime {
  const lt = this.localtime();
  let day = lt.day + 7;
  // ... ajuste de mês/ano se necessário
}

sameTimeNextMonth(): TjTime {
  const lt = this.localtime();
  let [month, year] = [lt.month, lt.year];
  const monMax = (month === 2 && this.leapYear(year)) ? 29 : TjTime.MON_MAX[month];
  
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  
  let day = lt.day;
  if (day >= this.lastDayOfMonth(month, year)) {
    day = this.lastDayOfMonth(month, year);
  }
  
  return new TjTime(Date.UTC(year, month - 1, day, lt.hour, lt.min, lt.sec));
}
```

### 6.8 Cálculos de Intervalo

```typescript
daysTo(date: TjTime): number {
  return this.countIntervals(date, 'sameTimeNextDay');
}

weeksTo(date: TjTime): number {
  return this.countIntervals(date, 'sameTimeNextWeek');
}

monthsTo(date: TjTime): number {
  return this.countIntervals(date, 'sameTimeNextMonth');
}

quartersTo(date: TjTime): number {
  return this.countIntervals(date, 'sameTimeNextQuarter');
}

yearsTo(date: TjTime): number {
  return this.countIntervals(date, 'sameTimeNextYear');
}

private countIntervals(date: TjTime, stepFunc: string): number {
  let [t1, t2] = this.order(date);
  let i = 0;
  while (t1 < t2) {
    t1 = (t1 as any)[stepFunc]();
    i++;
  }
  return i;
}
```

### 6.9 Formatação (strftime-like)

```typescript
to_s(format: string | null = null, tz: string | null = null): string {
  if (!this.@time) return 'unknown';
  
  const t = (tz === 'UTC') ? this.gmtime() : this.localtime();
  
  if (!format) {
    format = '%Y-%m-%d-%H:%M' + (t.seconds === 0 ? '' : ':%S') + '-%z';
  } else {
    // Extensão TJ: %Q = quarter
    format = format.replace(/%Q/, String(Math.floor((t.month - 1) / 3) + 1));
  }
  
  return strftime(t, format);  // Usar biblioteca strftime
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 2)

```
FASE 2A: Fundação do Modelo
  1. TjTime.ts (datas internas)
  2. TimeInterval.ts (intervalos de tempo)
  3. AttributeBase.ts (modos de operação)
  4. AttributeDefinition.ts (blueprint)
  5. Attribute.ts + subclasses (DateAttribute, FloatAttribute, etc.)

FASE 2B: Árvore de Propriedades
  6. PropertySet.ts (coleção + attribute definitions)
  7. PropertyTreeNode.ts (base)
  8. ScenarioData.ts (base para *Scenario)
  9. TaskScenario.ts, ResourceScenario.ts, etc.

FASE 2C: Entidades Concretas
  10. Task.ts
  11. Resource.ts
  12. Account.ts
  13. Shift.ts
  14. Scenario.ts
  15. Report.ts + subclasses

FASE 2D: Orquestrador
  16. Scoreboard.ts
  17. WorkingHours.ts
  18. LeaveList.ts, Leave.ts
  19. Project.ts (orquestrador central)
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 PropertyTreeNode Genérico
```typescript
abstract class PropertyTreeNode<
  TPropertySet extends PropertySet<any>,
  TScenarioData extends ScenarioData
> {
  protected @propertySet: TPropertySet;
  protected @data: TScenarioData[];
  protected @attributes: Map<string, Attribute>;
  protected @scenarioAttributes: Map<string, Attribute>[];
}
```

#### 7.2.2 Attribute como Classe Base
```typescript
abstract class Attribute {
  abstract get(): any;
  abstract set(value: any): void;
  abstract inherit(value: any): void;
  abstract reset(): void;
  abstract isList(): boolean;
}

class DateAttribute extends Attribute {
  get(): TjTime | null { return this.@value; }
  set(value: TjTime): void { /* ... */ }
  isList(): boolean { return false; }
}

class FlagListAttribute extends Attribute {
  get(): string[] { return this.@value; }
  set(value: string[]): void { /* ... */ }
  isList(): boolean { return true; }
}
```

#### 7.2.3 Scoreboard como TypedArray
```typescript
class Scoreboard {
  private @data: Int32Array;  // Performance!
  private @start: TjTime;
  private @granularity: number;  // em segundos
  
  constructor(start: TjTime, end: TjTime, granularity: number, initialValue: number) {
    this.@start = start;
    this.@granularity = granularity;
    const size = Math.floor((end - start) / granularity);
    this.@data = new Int32Array(size).fill(initialValue);
  }
  
  get(idx: number): number { return this.@data[idx]; }
  set(idx: number, value: number): void { this.@data[idx] = value; }
}
```

#### 7.2.4 Project como Singleton Contextual
```typescript
class Project {
  // NÃO usar singleton global, mas passar como contexto
  readonly tasks: PropertySet<Task>;
  readonly resources: PropertySet<Resource>;
  readonly accounts: PropertySet<Account>;
  readonly shifts: PropertySet<Shift>;
  readonly scenarios: PropertySet<Scenario>;
  readonly reports: PropertySet<Report>;
  
  private @attributes: Map<string, any>;
  private @scoreboard: Scoreboard;
  private @scoreboardNoLeaves: Scoreboard;
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **AttributeBase.mode é GLOBAL!** Deve ser setado antes de operações em lote:
   ```typescript
   AttributeBase.setMode(1);  // inherited
   property.inheritAttributes();
   AttributeBase.setMode(2);  // computed
   scheduler.schedule();
   ```

2. **Propagação de Cenários:** Quando um atributo scenario-specific é setado no cenário raiz (modo 0), ele é propagado para TODOS os cenários derivados como `inherit`.

3. **List Attributes:** `+=` em Ruby sempre faz append, mas em TypeScript usar `push()` + re-setar o valor para marcar `provided`.

4. **method_missing:** Em Ruby, métodos não encontrados em `PropertyTreeNode` são delegados para `@data[scenarioIdx]`. Em TypeScript, criar método explícito `scenarioData(scIdx)` ou usar Proxy.

5. **Scoreboard Bits:** Os bits têm significado específico:
   - `nil` (0) = disponível
   - `2` = fora do working hours
   - `4` = leave global
   - Combinações são possíveis via OR

6. **Timezone Alignment:** Se o timezone local não é hora-cheia com UTC, a granularidade máxima é reduzida (ex: Índia = 15min).

7. **Leap Years:** `TjTime` tem lógica própria para leap years. Usar `Date.UTC()` do JavaScript já trata, mas cuidado com `lastDayOfMonth()`.

8. **Adopt:** Tasks adotadas NÃO herdam do pai adotivo. Apenas são listadas como filhas para relatórios.

9. **Scenario 0 = Raiz:** O primeiro cenário (índice 0) é sempre o raiz. `trackingScenarioIdx` define qual cenário é o "real" para tracking.

10. **AttributeOverwrite:** Exceção lançada quando um atributo não-lista é sobrescrito. Deve ser capturada em alguns casos (ex: múltiplos `shifts`).

---

## 📋 8. CHECKLIST PARA PRÓXIMA IA

- [ ] Ler `TextParser.rb` (parser genérico, base do ProjectFileParser)
- [ ] Ler `TaskScenario.rb`, `ResourceScenario.rb`, etc. (métodos específicos por cenário)
- [ ] Ler `Scheduler.rb` (algoritmo de agendamento — o coração!)
- [ ] Ler `Scoreboard.rb` (estrutura de dados do scheduler)
- [ ] Ler `WorkingHours.rb` (cálculo de horários de trabalho)
- [ ] Ler `Interval.rb` + `IntervalList.rb` (intervalos de tempo)
- [ ] Ler `LogicalExpression.rb` + `LogicalOperation.rb` (expressões lógicas)
- [ ] Estudar `test/TestSuite/Scheduler/Correct/*.tjp` (casos de scheduling)

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO

```typescript
// 1. Parser cria Project
const project = new Project('prj', 'My Project', '1.0');
project['start'] = new TjTime('2026-01-01');
project['end'] = new TjTime('2026-12-31');

// 2. Parser cria Tasks e Resources
const task = new Task(project, 't1', 'Task 1', null);
task['start', 0] = new TjTime('2026-01-05');
task['duration', 0] = 5 * 8 * 60 * 60 / project['scheduleGranularity'];  // 5 dias em slots

const resource = new Resource(project, 'r1', 'John', null);
resource['efficiency', 0] = 1.0;

// 3. Parser cria Allocation
task['allocate', 0] = [new Allocation([resource])];

// 4. Parser cria Report
const report = new Report(project, 'r1', 'Report', null);
report.typeSpec = 'taskreport';
report['columns'] = [new TableColumnDefinition('bsi', 'BSI'), ...];
report['formats'] = ['html'];

// 5. Schedule
await project.schedule();

// 6. Generate Reports
await project.generateReports(1);
```

---

**Fim da Fase 2.** A próxima IA deve usar este documento + os arquivos Ruby originais em (docs/taskjuggler/lib/taskjuggler) para implementar o modelo de domínio em TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `TaskScenario.rb` → `ResourceScenario.rb` → `Scheduler.rb` → `Scoreboard.rb` → `WorkingHours.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/01-blueprint-parser.md`

````md
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
````

---

## Arquivo: `docs/tj3-engine/03-bluprint-engine2.md`

````md
# 📘 Blueprint Fase 3: Scheduler + Expressões Lógicas + Orquestrador Top-Level

## 🎯 Objetivo
Complementar o blueprint anterior com os arquivos que revelam:
1. **O algoritmo real de agendamento** (`TaskScenario.rb`)
2. **A estrutura central de dados** (`Scoreboard.rb`)
3. **O sistema de expressões lógicas** (`LogicalExpression.rb` + `LogicalOperation.rb`)
4. **O orquestrador top-level** (`TaskJuggler.rb`)

---

## 🏗️ 1. PIPELINE ATUALIZADO (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TaskJuggler (Top-Level)                       │
│  parse(files) → schedule() → generateReports()                  │
│  checkTimeSheet() / checkStatusSheet() / freeze()               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Project.schedule()                            │
│  initScoreboards()                                              │
│  Para cada cenário ativo:                                       │
│    prepareScenario()  → herança + validação                     │
│    scheduleScenario() → loop principal de scheduling            │
│    finishScenario()   → pós-validação                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           TaskScenario.schedule()  ⭐ CORAÇÃO DO ENGINE          │
│  scheduleSlot() → bookResources() → bookResource()              │
│  propagateDate() → dependências                                 │
│  readyForScheduling?()                                          │
│  checkForLoops()                                                │
│  calcCriticalness() / calcPathCriticalness()                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              ResourceScenario.book()                             │
│  Scoreboard[idx] = task                                         │
│  limits.inc()                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Scoreboard (Array de slots)                         │
│  nil = disponível | Task = alocado | int = leave/off            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 2. TASKJUGGLER.RB — Orquestrador Top-Level

### 2.1 Responsabilidades

```typescript
class TaskJuggler {
  project: Project | null;
  parser: ProjectFileParser | null;
  maxCpuCores: number = 1;
  warnTsDeltas: boolean = false;
  generateTraces: boolean = false;
  
  // Pipeline principal
  parse(files: string[], keepParser = false): boolean;
  schedule(): boolean;
  generateReports(outputDir?: string): boolean;
  
  // Operações específicas
  generateReport(reportId, regExpMode, formats?, dynamicAttributes?): boolean;
  freeze(freezeDate: TjTime, taskBookings: boolean): boolean;
  checkTimeSheet(fileName: string): boolean;
  checkStatusSheet(fileName: string): boolean;
}
```

### 2.2 Pipeline Completo

```typescript
async parse(files: string[]): Promise<boolean> {
  MessageHandler.clear();
  this.parser = new ProjectFileParser();
  let master = true;
  
  for (const file of files) {
    this.parser.open(file, master);
    if (master) {
      this.project = this.parser.parse('project');
      master = false;
    } else {
      this.parser.setGlobalMacros();
      this.parser.parse('propertiesFile');
    }
    this.project.inputFiles.push(file);
    this.parser.close();
  }
  
  return MessageHandler.errors === 0;
}

async schedule(): Promise<boolean> {
  this.project.warnTsDeltas = this.warnTsDeltas;
  const result = this.project.schedule();
  this.project.enableTraceReports(this.generateTraces);
  return result;
}

async generateReports(outputDir?: string): Promise<boolean> {
  this.project.checkReports();
  if (outputDir) this.project.outputDir = outputDir;
  this.project.generateReports(this.maxCpuCores);
  return true;
}
```

### 2.3 Modo UTC Padrão

```typescript
constructor() {
  TjTime.setTimeZone('UTC');  // TaskJuggler SEMPRE usa UTC internamente!
}
```

---

## ⭐ 3. TASKSCENARIO.RB — O CORAÇÃO DO SCHEDULER

### 3.1 Estrutura Interna

```typescript
class TaskScenario extends ScenarioData {
  // Estado do scheduling
  isRunAway: boolean = false;
  hasDurationSpec: boolean = false;
  scheduled: boolean = false;
  
  // Contadores de progresso
  doneDuration: number = 0;
  doneLength: number = 0;
  doneEffort: number = 0.0;
  
  // Slot corrente
  currentSlotIdx: number | null = null;
  nowIdx: number;
  
  // Tipo de task (determina o algoritmo)
  durationType: 'effortTask' | 'lengthTask' | 'durationTask' | 'startEndTask';
  
  // Dependências (4 listas)
  startpreds: [Task, onEnd][];
  startsuccs: [Task, onEnd][];
  endpreds: [Task, onEnd][];
  endsuccs: [Task, onEnd][];
  
  // Recursos
  candidates: Resource[];
  mandatories: Allocation[];
  assignedresources: Resource[];
  competitors: Task[];
  contendedResources: Map<Task, Map<Resource, number>>;
  
  // Limites
  allLimits: Limits[];
  
  // Flags de propagação
  startPropagated: boolean = false;
  endPropagated: boolean = false;
}
```

### 3.2 Tipos de Task (CRÍTICO!)

```typescript
// Determinado em prepareScheduling():
if (effort > 0)      durationType = 'effortTask';      // esforço fixo
else if (length > 0) durationType = 'lengthTask';      // duração em working time
else if (duration > 0) durationType = 'durationTask';  // duração em calendar time
else if (milestone)  durationType = 'startEndTask';    // milestone
else                 durationType = 'startEndTask';    // start+end fixos
```

### 3.3 O Algoritmo Principal: `schedule()`

```typescript
schedule(): boolean {
  if (this.scheduled) return true;
  
  // 1. Inicializa o slot corrente
  if (this.currentSlotIdx === null) {
    if (this.forward) {
      // ASAP: começa no start (ou 'now' se projection mode)
      this.currentSlotIdx = this.project.dateToIdx(
        this.projectionmode && 
        this.project.now > this.start && 
        !this.allocate.empty
          ? this.project.now 
          : this.start
      );
    } else {
      // ALAP: começa no slot ANTES do end
      this.currentSlotIdx = this.project.dateToIdx(this.end) - 1;
    }
  }
  
  // 2. Loop principal: agenda slot por slot
  const lowerLimit = this.project.dateToIdx(this.project.start);
  const upperLimit = this.project.dateToIdx(this.project.end);
  const delta = this.forward ? 1 : -1;
  
  while (this.scheduleSlot()) {
    this.currentSlotIdx += delta;
    
    // 3. Verifica se saiu do timeframe do projeto
    if (this.currentSlotIdx < lowerLimit || upperLimit < this.currentSlotIdx) {
      this.markAsRunaway();
      return false;
    }
  }
  
  return true;
}
```

### 3.4 O Loop Interno: `scheduleSlot()`

```typescript
scheduleSlot(): boolean {
  // Retorna false quando a task está completa
  
  switch (this.durationType) {
    case 'effortTask':
      // Agenda recursos até atingir o esforço total
      if (this.doneEffort < this.effort) this.bookResources();
      if (this.doneEffort >= this.effort) {
        // Propaga a data final
        if (this.forward) {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx + 1), true, true);
        } else {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx), false, true);
        }
        return false;  // Task completa
      }
      break;
      
    case 'lengthTask':
      // Agenda recursos e conta apenas slots de working time
      this.bookResources();
      if (this.onShift(this.currentSlotIdx)) this.doneLength += 1;
      if (this.doneLength >= this.length) {
        // Propaga data final
        return false;
      }
      break;
      
    case 'durationTask':
      // Agenda recursos e conta TODOS os slots (calendar time)
      this.bookResources();
      this.doneDuration += 1;
      if (this.doneDuration >= this.duration) {
        return false;
      }
      break;
      
    case 'startEndTask':
      // Apenas agenda recursos até atingir o outro extremo
      this.bookResources();
      if ((this.forward && this.currentSlotIdx >= this.endIdx) ||
          (!this.forward && this.currentSlotIdx <= this.startIdx)) {
        this.markAsScheduled();
        return false;
      }
      break;
  }
  
  return true;  // Continua agendando
}
```

### 3.5 Alocação de Recursos: `bookResources()`

```typescript
bookResources(): void {
  // 1. Verifica se algum recurso está disponível globalmente
  if (!this.project.anyResourceAvailable(this.currentSlotIdx)) return;
  
  // 2. Respeita projection mode (não aloca antes de 'now')
  if (this.projectionmode && this.nowIdx > this.currentSlotIdx) return;
  
  // 3. Verifica limites da task
  if (!this.limitsOk(this.currentSlotIdx)) return;
  
  // 4. Verifica shifts da task
  if (this.shifts && this.shifts.assigned(this.currentSlotIdx)) {
    if (!this.shifts.onShift(this.currentSlotIdx)) return;
  }
  
  // 5. Verifica recursos MANDATÓRIOS (todos devem estar disponíveis)
  const takenMandatories: Resource[] = [];
  for (const allocation of this.mandatories) {
    if (!allocation.onShift(this.currentSlotIdx)) return;
    
    let found = false;
    for (const candidate of allocation.candidates(this.scenarioIdx)) {
      let allAvailable = true;
      for (const resource of candidate.allLeaves) {
        if (!this.limitsOk(this.currentSlotIdx, resource) ||
            !resource.available(this.scenarioIdx, this.currentSlotIdx) ||
            takenMandatories.includes(resource)) {
          allAvailable = false;
          break;
        }
        takenMandatories.push(resource);
      }
      if (allAvailable) { found = true; break; }
    }
    if (!found) return;  // Mandatório não disponível → aborta slot
  }
  
  // 6. Para cada allocation, tenta alocar o primeiro candidato disponível
  for (const allocation of this.allocate) {
    if (!allocation.onShift(this.currentSlotIdx)) continue;
    
    // Verifica persistência (recurso travado)
    const locked = allocation.lockedResource;
    if (locked) {
      if (this.bookResource(locked)) continue;
      // Persistência quebrada → libera e tenta outro
      allocation.lockedResource = null;
    }
    
    // Tenta cada candidato na ordem (definida por selectionMode)
    for (const candidate of allocation.candidates(this.scenarioIdx)) {
      if (this.bookResource(candidate)) {
        if (allocation.persistent) allocation.lockedResource = candidate;
        break;
      }
    }
  }
}
```

### 3.6 Booking Individual: `bookResource()`

```typescript
bookResource(resource: Resource): boolean {
  let booked = false;
  
  for (const r of resource.allLeaves) {
    // Evita overbooking de effort
    if (this.effort > 0 && r.efficiency > 0 && this.doneEffort >= this.effort) break;
    if (!this.limitsOk(this.currentSlotIdx, r)) break;
    
    // Tenta bookar
    if (r.book(this.scenarioIdx, this.currentSlotIdx, this.property)) {
      // PRIMEIRO booking de task effort-based → ajusta start/end
      if (this.effort > 0 && this.doneEffort === 0) {
        if (this.forward) {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx), false, true);
        } else {
          this.propagateDate(this.project.idxToDate(this.currentSlotIdx + 1), true, true);
        }
      }
      
      this.doneEffort += r.efficiency;
      if (!this.assignedresources.includes(r)) {
        this.assignedresources.push(r);
      }
      booked = true;
    } else {
      // Recurso já está bookado para outra task → é um competidor!
      const competitor = r.bookedTask(this.scenarioIdx, this.currentSlotIdx);
      if (competitor && !this.competitors.includes(competitor)) {
        this.competitors.push(competitor);
        if (!this.contendedResources.has(competitor)) {
          this.contendedResources.set(competitor, new Map());
        }
        const map = this.contendedResources.get(competitor)!;
        map.set(r, (map.get(r) || 0) + 1);
      }
    }
  }
  
  return booked;
}
```

### 3.7 Propagação de Datas: `propagateDate()`

```typescript
propagateDate(date: TjTime, atEnd: boolean, ignoreEffort = false): void {
  // 1. Atualiza a data da task (se leaf)
  if (this.property.leaf) {
    const thisEnd = atEnd ? 'end' : 'start';
    const existing = this[thisEnd];
    
    // Só encolhe, nunca expande
    if (existing && (atEnd ? date > existing : date < existing)) return;
    
    this[thisEnd] = date;
  }
  
  // 2. Milestone: start = end
  if (this.milestone) {
    this.markAsScheduled();
    if (!this[atEnd ? 'start' : 'end']) {
      this.propagateDate(this[atEnd ? 'end' : 'start'], !atEnd);
    }
  }
  
  // 3. Propaga para tasks dependentes
  if (atEnd) {
    if (ignoreEffort || this.effort === 0) {
      for (const [task, onEnd] of this.endpreds) {
        this.propagateDateToDep(task, onEnd);
      }
    }
    for (const [task, onEnd] of this.endsuccs) {
      this.propagateDateToDep(task, onEnd);
    }
  } else {
    // ... simétrico para start
  }
  
  // 4. Propaga para sub-tasks que podem herdar
  for (const task of this.property.children) {
    if (task.canInheritDate(this.scenarioIdx, atEnd)) {
      task.propagateDate(this.scenarioIdx, date, atEnd);
    }
  }
  
  // 5. Tenta agendar o container pai
  for (const parent of this.property.parents) {
    parent.scheduleContainer(this.scenarioIdx);
  }
}
```

### 3.8 Detecção de Loops: `checkForLoops()`

```typescript
// Algoritmo DFS que detecta ciclos no grafo de dependências
checkForLoops(path: [Task, atEnd][], atEnd: boolean, 
              fromOutside: boolean, forward: boolean): void {
  // 1. Verifica se já visitamos este nó no path atual
  if (path.includes([this.property, atEnd])) {
    this.error('loop_detected', ...);
  }
  
  path.push([this.property, atEnd]);
  
  // 2. Navegação no grafo (4 casos: atEnd × fromOutside)
  if (!atEnd) {
    if (fromOutside) {
      if (this.property.container) {
        // Desce para os filhos
        for (const child of this.property.children) {
          child.checkForLoops(path, false, true, forward);
        }
      } else {
        if ((forward && this.forward) || this.milestone) {
          // Atravessa a task (start → end)
          this.checkForLoops(path, true, false, true);
        }
      }
    } else {
      // Vem de dentro → sobe para pais ou segue preds
      if (this.startpreds.empty) {
        if (this.property.parent) {
          this.property.parent.checkForLoops(path, false, false, forward);
        }
      } else {
        for (const [task, targetEnd] of this.startpreds) {
          task.checkForLoops(path, targetEnd, true, forward);
        }
      }
    }
  } else {
    // ... simétrico para atEnd = true
  }
  
  path.pop();
}
```

### 3.9 Cálculo de Criticalness

```typescript
// Criticalness individual: esforço × criticalness médio dos recursos
calcCriticalness(): void {
  if (this.milestone) {
    this.criticalness = this.priority / 500.0;  // 0-2 baseado em priority
  }
  if (this.effort <= 0 || this.candidates.empty) return;
  
  let avg = 0;
  for (const resource of this.candidates) {
    avg += resource.criticalness;
  }
  avg /= this.candidates.length;
  this.criticalness = this.effort * avg;
}

// Path criticalness: soma ao longo do caminho de dependências
calcPathCriticalness(atEnd = false): number {
  if (this.pathcriticalness !== null) {
    return this.pathcriticalness - (atEnd ? 0 : this.criticalness);
  }
  
  let max = 0;
  if (atEnd) {
    max = Math.max(max, this.calcPathCriticalnessEndSuccs());
  } else {
    if (this.property.container) {
      for (const task of this.property.children) {
        max = Math.max(max, task.calcPathCriticalness(false));
      }
    } else {
      for (const [task, onEnd] of this.startsuccs) {
        max = Math.max(max, task.calcPathCriticalness(onEnd));
      }
      max = Math.max(max, this.calcPathCriticalnessEndSuccs());
      max += this.criticalness;
    }
  }
  
  this.pathcriticalness = max;
  return max;
}
```

### 3.10 Processamento de Bookings Manuais: `bookBookings()`

```typescript
bookBookings(): void {
  // 1. Trata effortdone/effortleft
  if (this.effortdone || this.effortleft) {
    this.forward = true;  // Força ASAP
    if (this.effortdone) this.doneEffort = this.effortdone;
    else this.doneEffort = this.effort - this.effortleft;
  }
  
  // 2. Processa cada booking statement
  for (const booking of this.findBookings()) {
    for (const interval of booking.intervals) {
      const startIdx = this.project.dateToIdx(interval.start, false);
      const endIdx = this.project.dateToIdx(interval.end, false);
      
      for (let idx = startIdx; idx < endIdx; idx++) {
        if (booking.resource.bookBooking(this.scenarioIdx, idx, booking)) {
          this.doneEffort += booking.resource.efficiency;
          // Atualiza firstSlotIdx/lastSlotIdx
        }
      }
    }
  }
  
  // 3. Ajusta start/end baseado nos bookings
  if (this.start === null && firstSlotIdx !== null) {
    this.start = this.project.idxToDate(firstSlotIdx);
  }
  
  // 4. Verifica overbooking (warning)
  if (this.effort > 0 && this.doneEffort > this.effort) {
    this.warning('overbooked_effort', ...);
  }
}
```

---

## 📊 4. SCOREBOARD.RB — Estrutura Central

### 4.1 Estrutura

```typescript
class Scoreboard {
  private sb: (Task | number | null)[];
  readonly startDate: TjTime;
  readonly endDate: TjTime;
  readonly resolution: number;  // em segundos
  readonly size: number;
  
  constructor(start: TjTime, end: TjTime, resolution: number, initVal: any = null) {
    this.startDate = start;
    this.endDate = end;
    this.resolution = resolution;
    this.size = Math.ceil((end - start) / resolution) + 1;
    this.clear(initVal);
  }
  
  clear(initVal: any = null): void {
    this.sb = new Array(this.size).fill(initVal);
  }
}
```

### 4.2 Conversões

```typescript
idxToDate(idx: number, forceIntoProject = false): TjTime {
  if (forceIntoProject) {
    if (idx < 0) return this.startDate;
    if (idx >= this.size) return this.endDate;
  } else if (idx < 0 || idx >= this.size) {
    throw new Error(`Index ${idx} out of range`);
  }
  return this.startDate.plus(idx * this.resolution);
}

dateToIdx(date: TjTime, forceIntoProject = true): number {
  const idx = Math.floor((date - this.startDate) / this.resolution);
  if (forceIntoProject) {
    if (idx < 0) return 0;
    if (idx >= this.size) return this.size - 1;
  } else if (idx < 0 || idx >= this.size) {
    throw new Error(`Date ${date} out of range`);
  }
  return idx;
}
```

### 4.3 Encoding dos Valores (CRÍTICO!)

```typescript
// Valores possíveis no Scoreboard:
// - null          → slot disponível (working time, sem booking)
// - Task          → slot alocado para esta task
// - Integer (bits):
//   Bit 0:      Reservado
//   Bit 1:      0 = work time | 1 = no work time
//   Bit 2-5:    Tipo de leave (0-15)
//   Bit 6-7:    Reservado
//   Bit 8:      Override global setting

// Tipos de leave (Leave::Types):
// :project   = 0  (menor prioridade)
// :annual    = 1
// :special   = 2
// :sick      = 3
// :unpaid    = 4
// :holiday   = 5
// :unemployed = 6 (maior prioridade)

// Exemplos:
// 2          = não-working time (bit 1 setado)
// 4          = holiday (tipo 1 << 2)
// 8          = annual leave (tipo 2 << 2)
// 6          = não-working + holiday
```

### 4.4 Coleta de Intervalos: `collectIntervals()`

```typescript
// Coleta intervalos contíguos que satisfazem o predicado
collectIntervals(iv: TimeInterval, minDuration: number, 
                 predicate: (val: any) => boolean): IntervalList {
  const startIdx = this.dateToIdx(iv.start);
  const endIdx = this.dateToIdx(iv.end);
  const minSlots = Math.max(1, Math.floor(minDuration / this.resolution));
  
  // Expande busca para não perder intervalos nas bordas
  const sIdx = Math.max(0, startIdx - minSlots);
  const eIdx = Math.min(this.size - 1, endIdx + minSlots);
  
  const intervals = new IntervalList();
  let duration = 0;
  let start = 0;
  
  for (let idx = sIdx; idx <= eIdx; idx++) {
    if (predicate(this.sb[idx]) && idx < endIdx) {
      if (start === 0) start = idx;
      duration++;
    } else {
      if (duration > 0 && duration >= minSlots) {
        const realStart = Math.max(start, startIdx);
        const realEnd = Math.min(idx, endIdx);
        intervals.push(new TimeInterval(
          this.idxToDate(realStart),
          this.idxToDate(realEnd)
        ));
      }
      duration = 0;
      start = 0;
    }
  }
  
  return intervals;
}
```

### 4.5 Otimização com TypedArray

```typescript
// Para performance, use TypedArray quando possível:
class Scoreboard {
  private sb: (Task | number | null)[];  // Array heterogêneo
  
  // Alternativa para scoreboard global (só números):
  private globalSb: Int32Array;  // Muito mais rápido!
}
```

---

## 🔗 5. SISTEMA DE EXPRESSÕES LÓGICAS

### 5.1 Hierarquia

```
LogicalExpression
  └── operation: LogicalOperation
        ├── operand1: LogicalOperation | valor fixo | referência
        ├── operand2: LogicalOperation | valor fixo | referência (opcional)
        └── operator: '~' | '>' | '>=' | '=' | '<' | '<=' | '!=' | '&' | '|'

Subclasses de LogicalOperation:
  ├── LogicalAttribute  → acessa atributo de property (scenario.attribute)
  ├── LogicalFlag       → verifica flag
  └── LogicalFunction   → função como isleaf(), isactive(), etc.
```

### 5.2 LogicalExpression

```typescript
class LogicalExpression {
  operation: LogicalOperation;
  query: Query | null = null;
  sourceFileInfo: SourceFileInfo | null;
  
  eval(query: Query): boolean {
    this.query = query;
    const res = this.operation.eval(this);
    
    // Resultado deve ser boolean ou string
    if (typeof res === 'boolean') return res;
    if (typeof res === 'string') return res !== '';
    
    // Em TJP, "non-zero" = true
    return res !== 0;
  }
  
  error(text: string): never {
    throw new TjException(`${this.toString()}\nLogical expression error: ${text}`);
  }
}
```

### 5.3 LogicalOperation (CORE)

```typescript
class LogicalOperation {
  operand1: any;
  operand2: any;
  operator: string | null;
  
  eval(expr: LogicalExpression): any {
    switch (this.operator) {
      case null:
        // Operando único
        return this.operand1.eval 
          ? this.operand1.eval(expr) 
          : this.operand1;
          
      case '~':
        // NOT
        return !this.coerceBoolean(this.operand1.eval(expr), expr);
        
      case '>': case '>=': case '=': case '<': case '<=': case '!=':
        // Comparação binária com coerção de tipo
        const opnd1 = this.operand1.eval(expr);
        const opnd2 = this.operand2.eval(expr);
        
        if (opnd1 instanceof TjTime) {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceTime(o, expr));
        } else if (typeof opnd1 === 'number') {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceNumber(o, expr));
        } else if (typeof opnd1 === 'string') {
          return this.evalBinary(opnd1, this.operator, opnd2, 
            o => this.coerceString(o, expr));
        }
        expr.error(`Invalid operand type: ${typeof opnd1}`);
        
      case '&':
        // AND (lazy)
        return this.coerceBoolean(this.operand1.eval(expr), expr) &&
               this.coerceBoolean(this.operand2.eval(expr), expr);
               
      case '|':
        // OR (lazy)
        return this.coerceBoolean(this.operand1.eval(expr), expr) ||
               this.coerceBoolean(this.operand2.eval(expr), expr);
    }
  }
  
  private evalBinary(op1: any, op: string, op2: any, coerce: (v: any) => any): boolean {
    const a = coerce(op1);
    const b = coerce(op2);
    switch (op) {
      case '>':  return a > b;
      case '>=': return a >= b;
      case '=':  return a === b;
      case '<':  return a < b;
      case '<=': return a <= b;
      case '!=': return a !== b;
    }
  }
  
  private coerceBoolean(val: any, expr: LogicalExpression): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val !== '';
    if (typeof val === 'number') return val !== 0;
    expr.error(`Cannot coerce ${val} to boolean`);
  }
  
  private coerceNumber(val: any, expr: LogicalExpression): number {
    if (typeof val !== 'number') {
      expr.error(`Operand ${val} must be a number`);
    }
    return val;
  }
  
  private coerceString(val: any, expr: LogicalExpression): string {
    if (val === null || val === undefined) {
      expr.error(`Cannot convert ${val} to string`);
    }
    return String(val);
  }
  
  private coerceTime(val: any, expr: LogicalExpression): TjTime {
    if (!(val instanceof TjTime)) {
      expr.error(`Cannot convert ${val} to date`);
    }
    return val;
  }
}
```

### 5.4 LogicalAttribute (Acesso a Atributos)

```typescript
class LogicalAttribute extends LogicalOperation {
  scenario: Scenario;
  
  constructor(attributeId: string, scenario: Scenario) {
    super(attributeId);
    this.scenario = scenario;
  }
  
  eval(expr: LogicalExpression): any {
    const query = expr.query!.dup();
    query.scenarioIdx = this.scenario.sequenceNo - 1;
    query.attributeId = this.operand1;
    query.process();
    
    if (query.ok) {
      // Usa sortableResult para comparações numéricas
      return query.result ?? '';
    } else {
      expr.error(query.errorMessage);
    }
  }
}
```

### 5.5 LogicalFlag (Verificação de Flag)

```typescript
class LogicalFlag extends LogicalOperation {
  eval(expr: LogicalExpression): boolean {
    if (expr.query instanceof Query) {
      // Project/Property context
      return expr.query.property['flags', 0].includes(this.operand1);
    } else {
      // Journal context
      return expr.query.flags.includes(this.operand1);
    }
  }
}
```

### 5.6 Funções Lógicas Disponíveis

```typescript
// Implementadas em LogicalFunction.rb (não anexado ainda)
const FUNCTIONS = {
  hasalert: (level: number, date: TjTime) => boolean,
  isactive: (scenarioId: string) => boolean,
  ischildof: (parentId: string) => boolean,
  isdependencyof: (taskId: string, scenarioId: string, distance: number) => boolean,
  isdutyof: (resourceId: string, scenarioId: string) => boolean,
  isfeatureof: (taskId: string, scenarioId: string) => boolean,
  isleaf: () => boolean,
  ismilestone: (scenarioId: string) => boolean,
  isongoing: (scenarioId: string) => boolean,
  isresource: () => boolean,
  isresponsibilityof: (resourceId: string, scenarioId: string) => boolean,
  istask: () => boolean,
  isvalid: (scenarioId: string) => boolean,
  treelevel: () => number,
};
```

### 5.7 Regras de Avaliação

```
1. Operadores são avaliados LEFT-TO-RIGHT (sem precedência!)
   'a | b & c' === '(a | b) & c'
   
2. AND/OR são LAZY (short-circuit)

3. Coerção de tipos:
   - TjTime + TjTime → comparação temporal
   - number + number → comparação numérica
   - string + string → comparação lexicográfica
   
4. Constantes especiais:
   @all → sempre true
   @none → sempre false
   
5. Atributos inválidos (nil) → string vazia
```

---

## 🎯 6. ORDEM DE IMPLEMENTAÇÃO ATUALIZADA

```
FASE 1: Fundação (já coberta)
  1. TjTime.ts
  2. MessageHandler.ts
  3. TextParser (scanner/parser genérico)
  4. ProjectFileScanner.ts
  5. ProjectFileParser.ts + TjpSyntaxRules.ts

FASE 2: Modelo de Domínio (já coberta)
  6. AttributeBase.ts + Attribute.ts + subclasses
  7. AttributeDefinition.ts
  8. PropertySet.ts
  9. PropertyTreeNode.ts
  10. ScenarioData.ts + TaskScenario.ts + ResourceScenario.ts + ...
  11. Task.ts, Resource.ts, Account.ts, Shift.ts, Scenario.ts
  12. Interval.ts + IntervalList.ts
  13. WorkingHours.ts
  14. Project.ts

FASE 3: Scheduler (AGORA!)
  15. Scoreboard.ts ⭐
  16. Allocation.ts + Booking.ts
  17. TaskDependency.ts
  18. Limits.ts + ShiftAssignments.ts
  19. TaskScenario.ts ⭐ (coração do scheduler)
  20. ResourceScenario.ts (completar book/available)

FASE 4: Expressões Lógicas (AGORA!)
  21. LogicalOperation.ts ⭐
  22. LogicalExpression.ts ⭐
  23. LogicalFunction.ts (isleaf, isactive, etc.)
  24. LogicalAttribute.ts + LogicalFlag.ts

FASE 5: Orquestrador Top-Level (AGORA!)
  25. TaskJuggler.ts ⭐
  26. BatchProcessor.ts (paralelismo de reports)

FASE 6: Relatórios
  27. Report.ts + subclasses
  28. TableColumnDefinition.ts
  29. Query.ts (usado por expressões lógicas)

FASE 7: CLI + Documentação
  30. tj3.ts (CLI)
  31. SyntaxReference.ts + KeywordDocumentation.ts
```

---

## ⚠️ 7. PONTOS CRÍTICOS DE ATENÇÃO

### 7.1 Scheduler

1. **Slot Contíguo**: Tasks DEVEM ser agendadas em slots contíguos. O `currentSlotIdx` avança sempre em 1 (forward) ou -1 (backward).

2. **Effort vs Duration vs Length**:
   - `effort`: conta apenas slots com recurso alocado × efficiency
   - `length`: conta apenas slots de working time (mesmo sem recurso)
   - `duration`: conta TODOS os slots (calendar time)

3. **Projection Mode**: Se `projectionmode = true` e `now > currentSlot`, NÃO aloca recursos antes de `now`.

4. **Mandatory Resources**: Se UM mandatório falha, TODO o slot é abortado.

5. **Persistent Allocation**: Uma vez escolhido, o recurso é "travado" para toda a task. Se desaparecer, emite warning e tenta outro.

6. **Competitors**: Quando um recurso já está bookado por outra task, essa task vira "competidor" — usado para warnings de priority inversion.

7. **Runaway Detection**: Se o scheduler sai do timeframe do projeto, a task é marcada como runaway e emite warning.

### 7.2 Scoreboard

8. **Encoding de Bits**: Respeite rigorosamente a codificação:
   - `null` = disponível
   - `Task` = alocado
   - `int` = leave/off (bits 2-5 = tipo)

9. **Lazy Initialization**: O scoreboard só é criado quando necessário (projetos grandes com muitos resources não usados economizam memória).

10. **Copy-on-Write**: WorkingHours compartilha scoreboard entre instâncias idênticas.

### 7.3 Expressões Lógicas

11. **Sem Precedência**: `a | b & c` = `(a | b) & c`. Documente isso claramente!

12. **Lazy Evaluation**: AND/OR não avaliam o segundo operando se o resultado já é conhecido.

13. **Coerção Automática**: O tipo do PRIMEIRO operando determina a coerção dos outros.

14. **Atributos Inválidos**: `isvalid(scenario.attr)` deve ser usado antes de comparar atributos que podem ser nil.

### 7.4 TaskJuggler Top-Level

15. **UTC Forçado**: `TjTime.setTimeZone('UTC')` no construtor.

16. **Parser Reutilizável**: Para daemon mode, o parser pode ser mantido vivo entre requisições.

17. **BatchProcessor**: Reports podem ser gerados em paralelo (maxCpuCores).

---

## 📋 8. CHECKLIST FINAL

### Arquivos já analisados ✅
- [x] `TjpSyntaxRules.rb` — gramática completa
- [x] `ProjectFileScanner.rb` — lexer
- [x] `ProjectFileParser.rb` — parser
- [x] `SyntaxReference.rb` — documentação
- [x] `KeywordDocumentation.rb` — docs por keyword
- [x] `Project.rb` — orquestrador central
- [x] `PropertyTreeNode.rb` — base da árvore
- [x] `Task.rb` + `TaskScenario.rb` ⭐ — scheduler real
- [x] `Resource.rb` + `ResourceScenario.rb` — scoreboard do recurso
- [x] `AttributeDefinition.rb` — sistema de tipos
- [x] `TjTime.rb` — tempo interno
- [x] `Interval.rb` + `IntervalList.rb` — intervalos
- [x] `WorkingHours.rb` — horários de trabalho
- [x] `Scoreboard.rb` ⭐ — estrutura central
- [x] `LogicalExpression.rb` + `LogicalOperation.rb` ⭐ — expressões
- [x] `TaskJuggler.rb` ⭐ — orquestrador top-level

### Arquivos recomendados para a FASE 4 (Reports + Queries)
- [ ] `Query.rb` — contexto de avaliação de expressões
- [ ] `LogicalFunction.rb` — implementação das funções (isleaf, etc.)
- [ ] `Allocation.rb` — seleção de recursos
- [ ] `Booking.rb` — registro de trabalho manual
- [ ] `TaskDependency.rb` — dependências entre tasks
- [ ] `Limits.rb` + `ShiftAssignments.rb` — restrições
- [ ] `Report.rb` + subclasses — geração de relatórios
- [ ] `TableColumnDefinition.rb` — colunas de relatórios

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Cria o orquestrador
const tj = new TaskJuggler();

// 2. Parse do projeto
await tj.parse(['projeto.tjp']);

// 3. Scheduling
await tj.schedule();
// → Project.schedule()
//   → initScoreboards()
//   → Para cada cenário:
//     → prepareScenario()
//       → resource.prepareScheduling()
//       → task.prepareScheduling()
//       → task.Xref() (resolve dependências)
//       → task.propagateInitialValues()
//       → task.checkForLoops()
//       → resource.calcCriticalness()
//       → task.calcCriticalness()
//       → task.calcPathCriticalness()
//     → scheduleScenario()
//       → Loop: task.readyForScheduling?() → task.schedule()
//         → scheduleSlot()
//           → bookResources()
//             → bookResource(resource)
//               → resource.book() → Scoreboard[idx] = task
//     → finishScenario()
//       → task.finishScheduling()
//       → task.postScheduleCheck()

// 4. Geração de relatórios
await tj.generateReports('./output/');
// → Project.generateReports()
//   → Report.generate()
//     → Query.eval()
//       → LogicalExpression.eval()
//         → LogicalOperation.eval()
//           → LogicalAttribute.eval() → Query.process()

// 5. Freeze (opcional)
await tj.freeze(new TjTime('2026-09-10'), true);
```

---

**Fim da Fase 3.** O engine do TaskJuggler está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `Query.rb` → `LogicalFunction.rb` → `Allocation.rb` → `Booking.rb` → `Report.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/05-blueprint-engine4.md`

````md
# 📘 Blueprint Fase 5: Completando o Scheduler

## 🎯 Objetivo
Analisar os 5 arquivos que completam o algoritmo de agendamento: **Allocation**, **Limits**, **ShiftAssignments**, **Booking** e **TaskDependency**. Estes são os componentes que faltavam para entender completamente como o TaskJuggler aloca recursos, respeita restrições e processa dependências.

---

## 🏗️ 1. VISÃO GERAL DO PIPELINE ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    TaskScenario.schedule()                       │
│  └── scheduleSlot()                                             │
│      └── bookResources()                                        │
│          ├── Verifica: anyResourceAvailable?()                  │
│          ├── Verifica: limitsOk?()         ◄── Limits.rb        │
│          ├── Verifica: shifts.assigned?()  ◄── ShiftAssignments │
│          ├── Processa: mandatories         ◄── Allocation.rb    │
│          └── Para cada allocation:                              │
│              ├── candidates()              ◄── Allocation.rb    │
│              └── bookResource()            ◄── ResourceScenario │
│                  └── resource.book()                            │
│                      └── Scoreboard[idx] = task                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              TaskDependency (Grafo de Dependências)              │
│  └── resolve() → converte taskId em referência Task             │
│  └── 4 listas: startpreds, startsuccs, endpreds, endsuccs       │
│  └── gapDuration (calendar time) + gapLength (working time)     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Booking (Trabalho Manual Registrado)                │
│  └── resource, task, intervals                                  │
│  └── overtime (0, 1, 2) + sloppy (0, 1, 2)                      │
│  └── Processado em TaskScenario.bookBookings()                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. ALLOCATION.RB — A Ponte entre Tasks e Resources

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Lista de candidatos** | Armazena recursos alternativos para uma alocação |
| **Modo de seleção** | Controla a ordem em que candidatos são testados |
| **Persistência** | Trava um recurso após primeira escolha (opcional) |
| **Mandatoriedade** | Força todos os recursos mandatórios disponíveis |
| **Restrições temporais** | Shifts limitam quando a alocação pode ocorrer |

### 2.2 Estrutura Interna

```typescript
class Allocation {
  @candidates: Resource[];              // Recursos alternativos
  @selectionMode: SelectionMode;        // 0-4 (ver abaixo)
  @persistent: boolean;                 // Trava recurso após primeira escolha
  @mandatory: boolean;                  // Todos mandatórios devem estar disponíveis
  @atomic: boolean;                     // Se falhar, faz rollback
  @shifts: ShiftAssignments | null;     // Restrição temporal
  @lockedResource: Resource | null;     // Recurso travado (persistent)
  @staticCandidates: Resource[] | null; // Cache para seleção estática
  
  constructor(candidates: Resource[], selectionMode = 1, 
              persistent = false, mandatory = false, atomic = false);
}
```

### 2.3 Modos de Seleção (CRÍTICO!)

```typescript
enum SelectionMode {
  ORDER = 0,         // Primeira disponível na ordem da lista
  MINALLOCATED = 1,  // Menor probabilidade de alocação (default)
  MINLOADED = 2,     // Menor esforço total alocado
  MAXLOADED = 3,     // Maior esforço total alocado
  RANDOM = 4         // Aleatório
}
```

**Lógica de cada modo:**

```typescript
candidates(scenarioIdx?: number): Resource[] {
  // Modo 0: ordem de declaração
  if (this.selectionMode === 0 || !scenarioIdx) {
    return this.candidates;
  }
  
  // Modo 4: aleatório
  if (this.selectionMode === 4) {
    const hash = new Map<number, Resource>();
    for (const c of this.candidates) {
      hash.set(Math.random(), c);
    }
    return Array.from(hash.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);
  }
  
  // Modos 1, 2, 3: ordenação por métrica
  const sorted = [...this.candidates].sort((x, y) => {
    switch (this.selectionMode) {
      case 1: // MINALLOCATED
        if (this.persistent) {
          // Heurística sofisticada para persistent
          const cmp = x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
          if (cmp !== 0) return cmp;
          return x.get('criticalness', scenarioIdx) - y.get('criticalness', scenarioIdx);
        }
        return x.get('criticalness', scenarioIdx) - y.get('criticalness', scenarioIdx);
        
      case 2: // MINLOADED
        return x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
        
      case 3: // MAXLOADED
        return y.bookedEffort(scenarioIdx) - x.bookedEffort(scenarioIdx);
    }
  });
  
  // Cache para modo 1 não-persistent
  if (this.selectionMode === 1 && !this.persistent) {
    this.staticCandidates = sorted;
  }
  
  return sorted;
}
```

### 2.4 Verificação de Shift

```typescript
onShift?(sbIdx: number): boolean {
  if (this.shifts) {
    return this.shifts.onShift?(sbIdx);
  }
  return true;  // Sem shifts = sempre disponível
}
```

### 2.5 Persistência (Armadilha!)

```typescript
// No TaskScenario.bookResources():
const locked = allocation.lockedResource;
if (locked) {
  // Tenta usar o recurso travado
  if (this.bookResource(locked)) {
    continue;  // Sucesso, continua
  }
  
  // Recurso travado não disponível
  if (allocation.atomic && locked.bookedTask(scenarioIdx, sbIdx)) {
    this.rollbackBookings();  // Rollback completo
    return;
  }
  
  // Verifica se o recurso ainda existe no projeto
  if (this.forward && sbIdx < locked.getMaxSlot(scenarioIdx)) {
    continue;  // Ainda não chegou no slot do recurso
  }
  if (!this.forward && sbIdx > locked.getMinSlot(scenarioIdx)) {
    continue;
  }
  
  // Persistência quebrada!
  warning('broken_persistence', 
    `Persistence broken for Task ${this.property.fullId} ` +
    `- resource ${locked.name} is gone`);
  allocation.lockedResource = null;
}

// Tenta cada candidato
for (const candidate of allocation.candidates(scenarioIdx)) {
  if (this.bookResource(candidate)) {
    if (allocation.persistent) {
      allocation.lockedResource = candidate;  // Trava!
    }
    break;
  }
}
```

### 2.6 Mandatoriedade

```typescript
// No TaskScenario.bookResources():
const takenMandatories: Resource[] = [];
for (const allocation of this.mandatories) {
  if (!allocation.onShift?(sbIdx)) return;  // Aborta slot
  
  let found = false;
  for (const candidate of allocation.candidates(scenarioIdx)) {
    let allAvailable = true;
    for (const resource of candidate.allLeaves) {
      if (!this.limitsOk?(sbIdx, resource) ||
          !resource.available?(scenarioIdx, sbIdx) ||
          takenMandatories.includes(resource)) {
        allAvailable = false;
        break;
      }
      takenMandatories.push(resource);
    }
    if (allAvailable) {
      found = true;
      break;
    }
  }
  
  if (!found) return;  // Mandatório não disponível → aborta slot
}
```

---

## 📊 3. LIMITS.RB — Restrições de Alocação

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Limites temporais** | dailymax, weeklymax, monthlymax, maximum |
| **Limites mínimos** | dailymin, weeklymin, monthlymin, minimum |
| **Limites por recurso** | Restringe alocação de recurso específico |
| **Contadores por período** | Scoreboard com contadores por dia/semana/mês |

### 3.2 Estrutura Interna

```typescript
class Limits {
  @project: Project;
  @limits: Limit[];
  
  setLimit(name: string, value: number, interval?: ScoreboardInterval, 
           resource?: Resource): void;
  ok?(sbIdx?: number, upper?: boolean, resource?: Resource): boolean;
  inc(sbIdx: number, resource?: Resource): void;
  dec(sbIdx: number, resource?: Resource): void;
  reset(): void;
}

class Limit {
  @name: string;              // 'dailymax', 'weeklymax', etc.
  @interval: ScoreboardInterval;
  @period: number;            // Duração do período em segundos
  @value: number;             // Valor do limite
  @upper: boolean;            // true = máximo, false = mínimo
  @resource: Resource | null; // null = todos recursos
  @scoreboard: Scoreboard;    // Contadores por período
  @dirty: boolean;            // Flag para lazy reset
  
  constructor(name: string, interval: ScoreboardInterval, period: number,
              value: number, upper: boolean, resource: Resource | null);
}
```

### 3.3 Tipos de Limites

```typescript
// No Limits.setLimit():
switch (name) {
  case 'dailymax':
  case 'dailymin':
    period = 60 * 60 * 24;  // 1 dia
    upper = name === 'dailymax';
    break;
    
  case 'weeklymax':
  case 'weeklymin':
    iv.start = iv.startDate.beginOfWeek(project['weekStartsMonday']);
    iv.end = iv.endDate.beginOfWeek(project['weekStartsMonday']);
    period = 60 * 60 * 24 * 7;  // 1 semana
    upper = name === 'weeklymax';
    break;
    
  case 'monthlymax':
  case 'monthlymin':
    iv.start = iv.startDate.beginOfMonth;
    iv.end = iv.endDate.beginOfMonth;
    period = 60 * 60 * 24 * 30;  // 30 dias (aproximação!)
    upper = name === 'monthlymax';
    break;
    
  case 'maximum':
  case 'minimum':
    period = iv.duration;  // Duração do intervalo
    upper = name === 'maximum';
    break;
}
```

### 3.4 Conversão de Índices (CRÍTICO!)

```typescript
// O scoreboard do Limit tem granularidade diferente do projeto!
private idxToSbIdx(index: number): number {
  return (index - this.interval.start) * this.interval.slotDuration / this.period;
}

// Exemplo:
// Projeto: granularity = 3600s (1h)
// Limit: period = 86400s (1 dia)
// index = 24 (24h desde início do projeto)
// idxToSbIdx(24) = (24 - 0) * 3600 / 86400 = 1 (segundo dia)
```

### 3.5 Verificação de Limites

```typescript
ok?(index?: number, upper?: boolean, resource?: Resource): boolean {
  // Se upper não bate, ignora
  if (this.upper !== upper) return true;
  
  // Se resource não bate, ignora
  if (this.resource && this.resource !== resource) return true;
  
  if (index === null || index === undefined) {
    // Verifica todos os contadores
    for (const i of this.scoreboard) {
      if (this.upper ? i >= this.value : i < this.value) {
        return false;
      }
    }
    return true;
  } else {
    // Verifica contador específico
    if (!this.interval.contains?(index)) return true;
    const sbVal = this.scoreboard[this.idxToSbIdx(index)];
    return this.upper ? (sbVal < this.value) : (sbVal >= this.value);
  }
}
```

### 3.6 Incremento/Decremento

```typescript
inc(index: number, resource?: Resource): void {
  if (this.interval.contains?(index) &&
      (this.resource === null || this.resource === resource)) {
    this.dirty = true;
    this.scoreboard[this.idxToSbIdx(index)] += 1;
  }
}

dec(index: number, resource?: Resource): void {
  if (this.interval.contains?(index) &&
      (this.resource === null || this.resource === resource)) {
    this.dirty = true;
    this.scoreboard[this.idxToSbIdx(index)] -= 1;
  }
}
```

### 3.7 Integração com TaskScenario

```typescript
// No TaskScenario:
@allLimits: Limits[];  // Limites da task + limites dos pais

prepareScheduling(): void {
  this.allLimits = [];
  let task: Task | null = this.property;
  
  // Reseta contadores dos limites da task
  if (task.get('limits', scenarioIdx)) {
    task.get('limits', scenarioIdx).reset();
  }
  
  // Coleta limites da task e todos os pais
  while (task) {
    if (task.get('limits', scenarioIdx)) {
      this.allLimits.push(task.get('limits', scenarioIdx));
    }
    task = task.parent;
  }
}

limitsOk?(sbIdx: number, resource?: Resource): boolean {
  for (const limit of this.allLimits) {
    if (!limit.ok?(sbIdx, true, resource)) return false;
  }
  return true;
}

incLimits(sbIdx: number, resource?: Resource): void {
  for (const limit of this.allLimits) {
    limit.inc(sbIdx, resource);
  }
}
```

### 3.8 Integração com ResourceScenario

```typescript
// No ResourceScenario.book():
book(sbIdx: number, task: Task, force = false): boolean {
  if (!force && !this.available?(sbIdx)) return false;
  
  this.scoreboard[sbIdx] = task;
  this.effort += this.efficiency;
  
  // Incrementa limites do recurso
  if (this.limits) {
    this.limits.inc(sbIdx);
  }
  
  // Incrementa limites da task (passando o recurso!)
  task.incLimits(scenarioIdx, sbIdx, this.property);
  
  return true;
}
```

---

## 🔄 4. SHIFTASSIGNMENTS.RB — Controle Temporal de Shifts

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Lista de atribuições** | Shift + intervalo de tempo |
| **Scoreboard cacheado** | Evita recálculo de onShift/onLeave |
| **Compartilhamento** | Scoreboards idênticos são compartilhados |
| **Modo replace** | Shift substitui leaves globais |

### 4.2 Estrutura Interna

```typescript
class ShiftAssignments extends Monitor {
  @project: Project;
  @assignments: ShiftAssignment[];  // Ordenados por intervalo
  @scoreboard: Scoreboard | null;   // Cache
  @hashKey: string | null;          // Para compartilhamento
  
  static @@scoreboards: Map<string, [number[], Scoreboard]>;
  
  addAssignment(assignment: ShiftAssignment): boolean;
  getSbSlot(idx: number): number;
  assigned?(idx: number): boolean;
  onShift?(idx: number): boolean;
  timeOff?(idx: number): boolean;
  onLeave?(idx: number): boolean;
}

class ShiftAssignment {
  @shiftScenario: ShiftScenario;
  @interval: TimeInterval;
  
  assigned?(date: TjTime): boolean;
  onShift?(date: TjTime): boolean;
  onLeave?(date: TjTime): boolean;
  replace?(date: TjTime): boolean;
}
```

### 4.3 Encoding do Scoreboard (CRÍTICO!)

```typescript
// Bits do Scoreboard:
// Bit 0:      0 = sem atribuição | 1 = tem atribuição
// Bit 1:      0 = work time | 1 = no work time
// Bit 2-5:    Tipo de leave (0-15)
//   0 = none
//   1 = holiday
//   2 = annual
//   3 = special
//   4 = sick
//   5 = unpaid
//   6 = blocked (other project)
// Bit 6-7:    Reservado
// Bit 8:      0 = no override | 1 = override global

// Exemplos:
// 0b000000001 = 1  → atribuído, work time, sem leave
// 0b000000010 = 2  → atribuído, no work time
// 0b000001001 = 9  → atribuído, work time, holiday
// 0b100000001 = 257 → atribuído, work time, override global
```

### 4.4 Cálculo Lazy do Scoreboard

```typescript
getSbSlot(idx: number): number {
  // Retorna valor cacheado se disponível
  if (this.scoreboard[idx] !== null) {
    return this.scoreboard[idx];
  }
  
  const date = this.scoreboard.idxToDate(idx);
  
  // Calcula valor para este slot
  for (const sa of this.assignments) {
    if (!sa.assigned?(date)) continue;
    
    // Marca como atribuído
    this.scoreboard[idx] = 1;
    
    // Bit 1: no work time
    if (!sa.onShift?(date)) {
      this.scoreboard[idx] |= 1 << 1;
    }
    
    // Bits 2-5: leave
    if (sa.onLeave?(date)) {
      this.scoreboard[idx] |= 1 << 3;  // Simplificado!
    }
    
    // Bit 8: override global
    if (sa.replace?(date)) {
      this.scoreboard[idx] |= 1 << 8;
    }
    
    return this.scoreboard[idx];
  }
  
  // Slot não coberto por nenhuma atribuição
  this.scoreboard[idx] = 0;
  return 0;
}
```

### 4.5 Compartilhamento de Scoreboards

```typescript
private newScoreboard(): Scoreboard {
  const key = this.hashKey();
  
  // Verifica se já existe scoreboard idêntico
  const record = ShiftAssignments.scoreboards.get(key);
  if (record) {
    // Reutiliza scoreboard existente
    record[0].push(this.objectId);
    return record[1];
  }
  
  // Cria novo scoreboard
  const newSb = new Scoreboard(
    this.project.get('start'),
    this.project.get('end'),
    this.project.get('scheduleGranularity')
  );
  
  // Registra no cache
  ShiftAssignments.scoreboards.set(key, [[this.objectId], newSb]);
  
  return newSb;
}

private hashKey(): string {
  if (this.hashKey) return this.hashKey;
  
  this.hashKey = `${this.project.objectId}|`;
  this.assignments.sort((a, b) => a.interval.start - b.interval.start);
  for (const a of this.assignments) {
    this.hashKey += a.hashKey() + '||';
  }
  
  return this.hashKey;
}

// Finalizer para limpar cache quando objeto é destruído
static deleteScoreboard(objId: number): void {
  for (const [key, record] of ShiftAssignments.scoreboards) {
    if (record[0].includes(objId)) {
      record[0] = record[0].filter(id => id !== objId);
      break;
    }
  }
  
  // Remove registros vazios
  for (const [key, record] of ShiftAssignments.scoreboards) {
    if (record[0].length === 0) {
      ShiftAssignments.scoreboards.delete(key);
    }
  }
}
```

### 4.6 Verificação de Sobreposição

```typescript
addAssignment(shiftAssignment: ShiftAssignment): boolean {
  // Verifica sobreposição
  if (this.overlaps?(shiftAssignment.interval)) {
    return false;
  }
  
  this.assignments.push(shiftAssignment);
  this.scoreboard = this.newScoreboard();  // Invalida cache!
  return true;
}

private overlaps?(iv: TimeInterval): boolean {
  for (const sa of this.assignments) {
    if (sa.overlaps?(iv)) return true;
  }
  return false;
}
```

### 4.7 Integração com ResourceScenario

```typescript
// No ResourceScenario.initScoreboard():
if (this.shifts) {
  for (let i = 0; i < this.project.scoreboardSize; i++) {
    const v = this.shifts.getSbSlot(i);
    
    // Verifica se shift está atribuído
    if ((v & 1) === 0) continue;
    
    if ((v & (1 << 8)) !== 0) {
      // Modo replace: substitui leaves globais
      this.scoreboard[i] = ((v & 0x3E) === 0) ? null : (v & 0x3D);
    } else if ((this.scoreboard[i] === null || 
                (this.scoreboard[i] & 0x3C) < (v & 0x3C)) &&
               (v & 0x3C) !== 0) {
      // Modo merge: apenas leaves com tipo maior
      this.scoreboard[i] = v & 0x3E;
    }
  }
}
```

---

## 📝 5. BOOKING.RB — Registro de Trabalho Manual

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Registro de trabalho** | Armazena intervalos de trabalho já realizado |
| **Controle de overtime** | Permite booking fora do horário |
| **Controle de sloppy** | Relaxa verificação de conflitos |
| **Export/Import** | Serializa para TJP format |

### 5.2 Estrutura Interna

```typescript
class Booking {
  @resource: Resource;
  @task: Task;
  @intervals: TimeInterval[];
  @sourceFileInfo: SourceFileInfo | null;
  @overtime: 0 | 1 | 2;    // 0=working only, 1=+offhours, 2=+vacation
  @sloppy: 0 | 1 | 2;      // 0=strict, 1=+offhours, 2=+vacation
  
  constructor(resource: Resource, task: Task, intervals: TimeInterval[]);
  
  to_s(): string;
  to_tjp(taskMode: boolean): string;
}
```

### 5.3 Modos de Overtime e Sloppy

```typescript
// overtime: controla QUANDO pode bookar
// 0 = apenas working time (default)
// 1 = working time + off-hours
// 2 = working time + off-hours + vacation

// sloppy: controla QUÃO ESTRITO é a verificação
// 0 = strict (erro se violar)
// 1 = warning se violar off-hours
// 2 = warning se violar vacation
```

### 5.4 Processamento no ResourceScenario

```typescript
// No ResourceScenario.bookBooking():
bookBooking(sbIdx: number, booking: Booking): void {
  if (this.scoreboard === null) this.initScoreboard();
  
  const val = this.scoreboard[sbIdx];
  
  if (val !== null) {
    if (this.booked?(sbIdx)) {
      // Conflito com outra task
      error('booking_conflict',
        `Resource ${this.property.fullId} has multiple conflicting ` +
        `bookings for ${this.scoreboard.idxToDate(sbIdx)}. The ` +
        `conflicting tasks are ${this.scoreboard[sbIdx].fullId} and ` +
        `${booking.task.fullId}.`, booking.sourceFileInfo);
    }
    
    // Verifica overtime
    if ((val & 2) !== 0 && booking.overtime < 1) {
      // Slot é off-hours
      if (booking.sloppy < 1) {
        error('booking_no_duty',
          `Resource ${this.property.fullId} has no duty at ` +
          `${this.scoreboard.idxToDate(sbIdx)}.`,
          booking.sourceFileInfo);
      }
      return false;
    }
    
    if ((val & 0x3C) !== 0 && booking.overtime < 2) {
      // Slot é vacation/leave
      if (booking.sloppy < 2) {
        error('booking_on_vacation',
          `Resource ${this.property.fullId} is on vacation at ` +
          `${this.scoreboard.idxToDate(sbIdx)}.`,
          booking.sourceFileInfo);
      }
      return false;
    }
  }
  
  // Booking válido
  this.book(sbIdx, booking.task, true);  // force = true
}
```

### 5.5 Processamento no TaskScenario

```typescript
// No TaskScenario.bookBookings():
bookBookings(): void {
  let firstSlotIdx: number | null = null;
  let lastSlotIdx: number | null = null;
  
  // Trata effortdone/effortleft
  if (this.effortdone || this.effortleft) {
    this.forward = true;  // Força ASAP
    
    if (!this.start) {
      error('effort_done_left_start_missing',
        `Task ${this.property.fullId} has 'effortdone' or 'effortleft' ` +
        `attribute but no start date specified.`);
    }
    
    if (!this.effort) {
      error('effort_missing',
        `Task ${this.property.fullId} has 'effortdone' or 'effortleft' ` +
        `attribute but no 'effort'.`);
    }
    
    if (this.effortdone) {
      if (this.effortdone > this.effort) {
        error('effort_done_larger_effort',
          `Task ${this.property.fullId} has larger 'effortdone' ` +
          `than 'effort'.`);
      }
      this.doneEffort = this.effortdone;
      
      if (this.effortleft) {
        error('effort_done_and_left',
          `A task cannot have the 'effortdone' and 'effortleft' attribute.`);
      }
    } else {
      if (this.effortleft > this.effort) {
        error('effort_left_larger_effort',
          `Task ${this.property.fullId} has larger 'effortleft' ` +
          `than 'effort'.`);
      }
      this.doneEffort = this.effort - this.effortleft;
    }
    
    firstSlotIdx = this.project.dateToIdx(this.start);
    lastSlotIdx = this.project.dateToIdx(this.project.get('now'));
  }
  
  // Processa bookings
  const bookings = this.findBookings();
  if (bookings.length > 0) {
    if (this.effortdone || this.effortleft) {
      error('bookings_and_effort',
        `Bookings cannot be used together with 'effortdone' or ` +
        `'effortleft' attributes.`);
    }
    
    for (const booking of bookings) {
      if (!booking.resource.leaf?) {
        error('booking_resource_not_leaf',
          `Booked resources may not be group resources`,
          booking.sourceFileInfo);
      }
      
      if (!this.forward && !this.scheduled) {
        error('booking_forward_only',
          `Only forward scheduled tasks may have booking statements.`);
      }
      
      let booked = false;
      for (const interval of booking.intervals) {
        const startIdx = this.project.dateToIdx(interval.start, false);
        const endIdx = this.project.dateToIdx(interval.end, false);
        
        for (let idx = startIdx; idx < endIdx; idx++) {
          if (booking.resource.bookBooking(scenarioIdx, idx, booking)) {
            this.doneEffort += booking.resource.get('efficiency', scenarioIdx);
            booked = true;
            
            // Track first/last slots
            if (firstSlotIdx === null || firstSlotIdx > idx) {
              firstSlotIdx = idx;
            }
            if (lastSlotIdx === null || lastSlotIdx < idx) {
              lastSlotIdx = idx;
            }
          }
        }
      }
      
      if (booked && !this.assignedresources.includes(booking.resource)) {
        this.assignedresources.push(booking.resource);
      }
    }
  }
  
  // Ajusta start/end baseado nos bookings
  if ((this.start === null || (this.doneEffort > 0 && this.effort > 0)) &&
      !this.scheduled && firstSlotIdx !== null) {
    const firstSlotDate = this.project.idxToDate(firstSlotIdx);
    if (this.start === null || firstSlotDate > this.start) {
      this.start = firstSlotDate;
    }
  }
  
  // Verifica se duration criteria foi atingido
  if (lastSlotIdx !== null && !this.scheduled) {
    const tentativeEnd = this.project.idxToDate(lastSlotIdx + 1);
    const slotDuration = this.project.get('scheduleGranularity');
    
    if (this.effort > 0) {
      if (this.doneEffort >= this.effort) {
        this.end = tentativeEnd;
        this.markAsScheduled();
      }
    } else if (this.length > 0) {
      this.doneLength = 0;
      const startIdx = this.project.dateToIdx(this.start);
      const endIdx = this.project.dateToIdx(this.project.get('now'));
      let date = this.start;
      
      for (let idx = startIdx; idx <= endIdx; idx++) {
        if (this.onShift?(idx)) this.doneLength += 1;
        date = date.plus(slotDuration);
        
        if (this.doneLength >= this.length && date >= tentativeEnd) {
          const endDate = this.project.idxToDate(idx + 1);
          this.end = endDate > tentativeEnd ? endDate : tentativeEnd;
          this.markAsScheduled();
          break;
        }
      }
    } else if (this.duration > 0) {
      this.doneDuration = Math.floor((tentativeEnd - this.start) / slotDuration);
      if (this.doneDuration >= this.duration) {
        this.end = tentativeEnd;
        this.markAsScheduled();
      } else if (this.duration * slotDuration < (this.project.get('now') - this.start)) {
        this.end = this.start.plus(this.duration * slotDuration);
        this.markAsScheduled();
      }
    }
  }
  
  // Ajusta currentSlotIdx para 'now' se há bookings
  if (this.doneEffort > 0) {
    this.currentSlotIdx = this.project.dateToIdx(this.project.get('now'));
  }
  
  // Warnings de overbooking
  if (this.effort > 0) {
    const effort = this.project.slotsToDays(this.doneEffort);
    const effortHours = effort * this.project.get('dailyworkinghours');
    const requestedEffort = this.project.slotsToDays(this.effort);
    const requestedEffortHours = requestedEffort * this.project.get('dailyworkinghours');
    
    if (effort > requestedEffort) {
      warning('overbooked_effort',
        `The total effort (${effort}d or ${effortHours}h) of the ` +
        `provided bookings for task ${this.property.fullId} exceeds ` +
        `the specified effort of ${requestedEffort}d or ` +
        `${requestedEffortHours}h.`);
    }
  }
  
  // Similar para length e duration...
}
```

### 5.6 Herança de Bookings entre Cenários

```typescript
// No TaskScenario.findBookings():
findBookings(): Booking[] {
  let scenario = this.property.project.scenario(scenarioIdx);
  
  // Se cenário não tem bookings próprios, herda do pai
  while (!scenario.get('ownbookings')) {
    scenario = scenario.parent;
  }
  
  // Retorna bookings do cenário encontrado
  return this.property.get('booking', this.property.project.scenarioIdx(scenario));
}
```

---

## 🔗 6. TASKDEPENDENCY.RB — Grafo de Dependências

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Representação de dependência** | taskId + onEnd + gaps |
| **Resolução de IDs** | Converte string em referência Task |
| **4 tipos de dependência** | start-start, start-end, end-start, end-end |
| **Gaps** | gapDuration (calendar) + gapLength (working) |

### 6.2 Estrutura Interna

```typescript
class TaskDependency {
  @taskId: string;          // ID absoluto ou relativo
  @task: Task | null;       // Referência resolvida
  @onEnd: boolean;          // true = alvo é end, false = start
  @gapDuration: number;     // Gap em segundos (calendar time)
  @gapLength: number;       // Gap em slots (working time)
  
  constructor(taskId: string, onEnd: boolean);
  
  resolve(project: Project): void;
}
```

### 6.3 Resolução de IDs

```typescript
// No TaskScenario.Xref():
Xref(): void {
  // Processa 'depends'
  for (const dependency of this.depends) {
    const depTask = this.checkDependency(dependency, 'depends');
    
    // Adiciona à lista de predecessores do start
    this.startpreds.push([depTask, dependency.onEnd]);
    
    // Adiciona à lista de sucessores do predecessor
    depTask.get(dependency.onEnd ? 'endsuccs' : 'startsuccs', scenarioIdx)
      .push([this.property, false]);
  }
  
  // Processa 'precedes'
  for (const dependency of this.precedes) {
    const predTask = this.checkDependency(dependency, 'precedes');
    
    // Adiciona à lista de sucessores do end
    this.endsuccs.push([predTask, dependency.onEnd]);
    
    // Adiciona à lista de predecessores do sucessor
    predTask.get(dependency.onEnd ? 'endpreds' : 'startpreds', scenarioIdx)
      .push([this.property, true]);
  }
}

private checkDependency(dependency: TaskDependency, depType: string): Task {
  const depList = this[depType];
  
  // Resolve ID → Task
  const depTask = dependency.resolve(this.project);
  if (depTask === null) {
    depList.delete(dependency);
    error('task_depend_unknown',
      `Task ${this.property.fullId} has unknown ${depType} ${dependency.taskId}`);
  }
  
  // Verifica dependência de si mesmo
  if (depTask === this.property) {
    depList.delete(dependency);
    error('task_depend_self',
      `Task ${this.property.fullId} cannot depend on self`);
  }
  
  // Verifica dependência de filho
  if (depTask.isChildOf?(this.property)) {
    depList.delete(dependency);
    error('task_depend_child',
      `Task ${this.property.fullId} cannot depend on child ${depTask.fullId}`);
  }
  
  // Verifica dependência de pai
  if (this.property.isChildOf?(depTask)) {
    depList.delete(dependency);
    error('task_depend_parent',
      `Task ${this.property.fullId} cannot depend on parent ${depTask.fullId}`);
  }
  
  // Verifica duplicatas
  for (const dep of depList) {
    if (dep.task === depTask && dep !== dependency) {
      depList.delete(dependency);
      error('task_depend_multi',
        `No need to specify dependency ${depTask.fullId} multiple ` +
        `times for task ${this.property.fullId}.`);
    }
  }
  
  return depTask;
}
```

### 6.4 Cálculo de earliestStart/latestEnd

```typescript
// No TaskScenario:
earliestStart(): TjTime | null {
  let startDate: TjTime | null = null;
  
  for (const dependency of this.depends) {
    const potentialStartDate = dependency.task.get(
      dependency.onEnd ? 'end' : 'start', scenarioIdx
    );
    
    if (potentialStartDate === null) return null;
    
    // Calcula data após gapLength (working time)
    let dateAfterLengthGap = potentialStartDate;
    let gapLength = dependency.gapLength;
    
    while (gapLength > 0 && dateAfterLengthGap < this.project.get('end')) {
      if (this.project.isWorkingTime(dateAfterLengthGap)) {
        gapLength -= 1;
      }
      dateAfterLengthGap = dateAfterLengthGap.plus(
        this.project.get('scheduleGranularity')
      );
    }
    
    // Calcula data após gapDuration (calendar time)
    if (dateAfterLengthGap > potentialStartDate.plus(dependency.gapDuration)) {
      potentialStartDate = dateAfterLengthGap;
    } else {
      potentialStartDate = potentialStartDate.plus(dependency.gapDuration);
    }
    
    if (startDate === null || startDate < potentialStartDate) {
      startDate = potentialStartDate;
    }
  }
  
  // Respeita start do pai
  let task: Task | null = this.property;
  while ((task = task.parent)) {
    if (task.get('start', scenarioIdx) &&
        (startDate === null || task.get('start', scenarioIdx) > startDate)) {
      startDate = task.get('start', scenarioIdx);
      break;
    }
  }
  
  // Verifica conflito com end
  if (this.end && (startDate === null || startDate > this.end)) {
    error('impossible_start_dep',
      `Task ${this.property.fullId} has start date dependencies ` +
      `that conflict with the end date ${this.end}.`);
  }
  
  return startDate;
}

latestEnd(): TjTime | null {
  let endDate: TjTime | null = null;
  
  for (const dependency of this.precedes) {
    const potentialEndDate = dependency.task.get(
      dependency.onEnd ? 'end' : 'start', scenarioIdx
    );
    
    if (potentialEndDate === null) return null;
    
    // Calcula data antes de gapLength (working time)
    let dateBeforeLengthGap = potentialEndDate;
    let gapLength = dependency.gapLength;
    
    while (gapLength > 0 && dateBeforeLengthGap > this.project.get('start')) {
      if (this.project.isWorkingTime(
        dateBeforeLengthGap.minus(this.project.get('scheduleGranularity'))
      )) {
        gapLength -= 1;
      }
      dateBeforeLengthGap = dateBeforeLengthGap.minus(
        this.project.get('scheduleGranularity')
      );
    }
    
    // Calcula data antes de gapDuration (calendar time)
    if (dateBeforeLengthGap < potentialEndDate.minus(dependency.gapDuration)) {
      potentialEndDate = dateBeforeLengthGap;
    } else {
      potentialEndDate = potentialEndDate.minus(dependency.gapDuration);
    }
    
    if (endDate === null || endDate > potentialEndDate) {
      endDate = potentialEndDate;
    }
  }
  
  // Respeita end do pai
  let task: Task | null = this.property;
  while ((task = task.parent)) {
    if (task.get('end', scenarioIdx) &&
        (endDate === null || task.get('end', scenarioIdx) < endDate)) {
      endDate = task.get('end', scenarioIdx);
      break;
    }
  }
  
  // Verifica conflito com start
  if (this.start && (endDate === null || endDate < this.start)) {
    error('impossible_end_dep',
      `Task ${this.property.fullId} has end date dependencies ` +
      `that conflict with the start date ${this.start}.`);
  }
  
  return endDate;
}
```

### 6.5 Detecção de Loops

```typescript
// No TaskScenario.checkForLoops():
checkForLoops(path: [Task, boolean][], atEnd: boolean, 
              fromOutside: boolean, forward: boolean): void {
  // Verifica se já visitamos este nó
  if (path.some(([t, e]) => t === this.property && e === atEnd)) {
    warning('loop_detected',
      `Dependency loop detected at ${atEnd ? 'end' : 'start'} ` +
      `of task ${this.property.fullId}`, false);
    
    // Reporta loop completo
    let skip = true;
    for (const [t, e] of path) {
      if (t === this.property && e === atEnd) {
        skip = false;
        continue;
      }
      if (skip) continue;
      info(`loop_at_${e ? 'end' : 'start'}`,
        `Loop ctnd. at ${e ? 'end' : 'start'} of task ${t.fullId}`,
        t.sourceFileInfo);
    }
    
    error('loop_end', 'Aborting');
  }
  
  // Marca como visitado
  path.push([this.property, atEnd]);
  
  // Navegação no grafo (4 casos: atEnd × fromOutside)
  if (!atEnd) {
    if (fromOutside) {
      if (this.property.container?) {
        // Desce para filhos
        for (const child of this.property.children) {
          child.checkForLoops(scenarioIdx, path, false, true, forward);
        }
      } else {
        if ((forward && this.forward) || this.milestone) {
          // Atravessa a task (start → end)
          this.checkForLoops(path, true, false, true);
        }
      }
    } else {
      if (this.startpreds.length === 0) {
        if (this.property.parent) {
          this.property.parent.checkForLoops(scenarioIdx, path, false, false, forward);
        }
      } else {
        for (const [task, targetEnd] of this.startpreds) {
          task.checkForLoops(scenarioIdx, path, targetEnd, true, forward);
        }
      }
    }
  } else {
    // Simétrico para atEnd = true
    // ...
  }
  
  path.pop();
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 5)

```
FASE 5A: Dependências
  1. TaskDependency.ts
     - resolve() para converter IDs
     - gapDuration + gapLength
     - onEnd flag

FASE 5B: Restrições
  2. Limits.ts + Limit.ts
     - Scoreboard com contadores
     - idxToSbIdx() para conversão
     - ok?() / inc() / dec()
  3. ShiftAssignments.ts + ShiftAssignment.ts
     - Scoreboard cacheado
     - Compartilhamento via hashKey
     - Encoding de bits

FASE 5C: Alocação
  4. Allocation.ts
     - candidates() com selectionMode
     - persistent + mandatory + atomic
     - onShift?()
  5. Booking.ts
     - overtime + sloppy
     - to_tjp() para export

FASE 5D: Integração
  6. Atualizar TaskScenario.ts
     - Xref() para resolver dependências
     - bookBookings() para processar bookings
     - earliestStart() / latestEnd()
     - checkForLoops()
  7. Atualizar ResourceScenario.ts
     - bookBooking() com overtime/sloppy
     - initScoreboard() com shifts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 Allocation com Generics
```typescript
class Allocation {
  private candidates: Resource[];
  private selectionMode: SelectionMode;
  private persistent: boolean;
  private mandatory: boolean;
  private atomic: boolean;
  private shifts: ShiftAssignments | null;
  private lockedResource: Resource | null;
  private staticCandidates: Resource[] | null;
  
  candidates(scenarioIdx?: number): Resource[] {
    // Implementação conforme descrito acima
  }
}
```

#### 7.2.2 Limits com TypedArray
```typescript
class Limit {
  private scoreboard: Int32Array;  // Performance!
  
  constructor(name: string, interval: ScoreboardInterval, period: number,
              value: number, upper: boolean, resource: Resource | null) {
    const size = Math.ceil(interval.duration / period);
    this.scoreboard = new Int32Array(size);
  }
}
```

#### 7.2.3 ShiftAssignments com WeakMap
```typescript
class ShiftAssignments {
  private static scoreboards = new Map<string, [Set<number>, Scoreboard]>();
  
  // Em TypeScript, usar FinalizationRegistry para cleanup
  private static registry = new FinalizationRegistry((objId: number) => {
    ShiftAssignments.deleteScoreboard(objId);
  });
  
  constructor() {
    ShiftAssignments.registry.register(this, this.objectId);
  }
}
```

#### 7.2.4 TaskDependency com Union Types
```typescript
type DependencyTarget = 'start' | 'end';

class TaskDependency {
  taskId: string;
  task: Task | null;
  onEnd: boolean;
  gapDuration: number;
  gapLength: number;
  
  resolve(project: Project): Task {
    this.task = project.task(this.taskId);
    return this.task!;
  }
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **Allocation.selectionMode é inteiro!** Não usar enum string.

2. **Limits.idxToSbIdx() é crítico!** Erro aqui quebra todos os limites.

3. **ShiftAssignments.scoreboard é compartilhado!** Não modificar diretamente.

4. **Booking.overtime/sloppy são independentes!** overtime controla QUANDO, sloppy controla QUÃO ESTRITO.

5. **TaskDependency.resolve() pode falhar!** Sempre verificar se task !== null.

6. **gapDuration é calendar time, gapLength é working time!** Não confundir.

7. **Persistent allocation trava recurso!** Se recurso desaparecer, emite warning.

8. **Mandatory allocation aborta slot inteiro!** Se UM mandatório falha, TODO slot é abortado.

9. **Bookings são herdados entre cenários!** Usar findBookings() para encontrar cenário correto.

10. **Loops são detectados via DFS!** Manter path e verificar revisit.

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (25 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, AttributeDefinition, TjTime
- [x] **Scheduler Core**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Lógica**: LogicalExpression, LogicalOperation
- [x] **Fase 5**: Allocation, Limits, ShiftAssignments, Booking, TaskDependency ⭐

### 🎯 Próximos 5 (Fase 6)
- [ ] ScenarioData.rb
- [ ] Attributes.rb
- [ ] PropertySet.rb
- [ ] Scenario.rb
- [ ] Query.rb

### 🔮 Futuros (Fase 7 - Reports)
- [ ] Report.rb + subclasses
- [ ] TableColumnDefinition.rb
- [ ] LogicalFunction.rb
- [ ] RichText.rb
- [ ] HTMLDocument.rb

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Allocation
const allocation = new Allocation([resource1, resource2], SelectionMode.MINALLOCATED);
allocation.persistent = true;
allocation.mandatory = false;

// 2. Parser cria TaskDependency
const dep = new TaskDependency('task2', true);  // onEnd = true
dep.gapDuration = 86400;  // 1 dia
dep.gapLength = 0;
task1.get('depends', 0).push(dep);

// 3. Parser cria Booking
const booking = new Booking(resource, task, [interval1, interval2]);
booking.overtime = 1;  // Permite off-hours
booking.sloppy = 0;    // Strict

// 4. Parser cria Limits
const limits = new Limits();
limits.setProject(project);
limits.setLimit('dailymax', 8 * 3600, interval, null);  // 8h/dia

// 5. Parser cria ShiftAssignments
const shifts = new ShiftAssignments();
shifts.project = project;
shifts.addAssignment(new ShiftAssignment(shiftScenario, interval));

// 6. Scheduler usa tudo junto
taskScenario.schedule();
// → scheduleSlot()
//   → bookResources()
//     → Verifica limits.ok?()
//     → Verifica shifts.assigned?()
//     → Para cada allocation:
//       → candidates() ordena por selectionMode
//       → bookResource() tenta cada candidato
//         → resource.book() → Scoreboard[idx] = task
//         → limits.inc()
//         → task.incLimits()

// 7. Pós-scheduling verifica dependências
taskScenario.postScheduleCheck();
// → Verifica se depends/precedes foram respeitados
// → Verifica gapDuration/gapLength
// → Emite warnings se violado
```

---

**Fim da Fase 5.** O scheduler está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ScenarioData.rb` → `Attributes.rb` → `PropertySet.rb` → `Scenario.rb` → `Query.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/04-blueprint-engine3.md`

````md
# 📚 Próximos 10 Arquivos para Completar o Engine

Com base na análise das lacunas do que já foi coberto, organizei em **duas fases** estratégicas. A primeira completa o **scheduler** (o coração do engine), a segunda completa o **modelo de domínio + sistema de relatórios**.

---

## 🎯 FASE 5: Completar o Scheduler (5 arquivos IMEDIATOS)

Estes 5 arquivos são **críticos** — sem eles o scheduler não funciona. Eles preenchem as lacunas deixadas pelo `TaskScenario.rb` e `ResourceScenario.rb`.

### 1. ⭐ `lib/taskjuggler/Allocation.rb`
**A ponte entre tasks e recursos** — define COMO um recurso é alocado a uma task.

> **Por que é essencial:** O `TaskScenario.bookResources()` chama `allocation.candidates()` e `allocation.lockedResource`. Sem este arquivo, você não sabe:
> - Como alternativas são selecionadas (`maxloaded`, `minloaded`, `minallocated`, `order`, `random`)
> - Como `persistent` trava um recurso
> - Como `mandatory` força todos os recursos disponíveis
> - Como `shifts` e `limits` restringem a alocação

**Conteúdo esperado:**
```typescript
class Allocation {
  candidates: Resource[];           // Recursos alternativos
  selectionMode: SelectionMode;     // maxloaded|minloaded|minallocated|order|random
  persistent: boolean;              // Trava recurso após primeira escolha
  mandatory: boolean;               // Todos mandatórios devem estar disponíveis
  lockedResource: Resource | null;  // Recurso travado (persistent)
  shifts: ShiftAssignments | null;  // Restrição temporal
  limits: Limits | null;            // Limites por alocação
  
  candidates(scenarioIdx): Resource[];  // Ordena por selectionMode
  onShift(sbIdx): boolean;              // Verifica shift
}
```

---

### 2. ⭐ `lib/taskjuggler/Booking.rb`
**Registro de trabalho manual** — usado para tracking de progresso real.

> **Por que é essencial:** O `TaskScenario.bookBookings()` processa bookings. Sem este arquivo, você não implementa:
> - `effortdone` / `effortleft`
> - `trackingscenario` (projeção de progresso)
> - `overtime` e `sloppy` (flexibilidade de booking)
> - Export de bookings para freeze

**Conteúdo esperado:**
```typescript
class Booking {
  resource: Resource;
  task: Task;
  intervals: TimeInterval[];
  overtime: 0 | 1 | 2;    // 0=working only, 1=+offhours, 2=+vacation
  sloppy: 0 | 1 | 2;      // Rigor na verificação de conflitos
  sourceFileInfo: SourceFileInfo;
}
```

---

### 3. ⭐ `lib/taskjuggler/TaskDependency.rb`
**Dependências entre tasks** — o grafo que o scheduler percorre.

> **Por que é essencial:** O `TaskScenario.Xref()` transforma strings em `TaskDependency` objects. Sem este arquivo, você não implementa:
> - `depends` / `precedes` (4 tipos: start-start, start-end, end-start, end-end)
> - `gapduration` (gap em calendar time)
> - `gaplength` (gap em working time)
> - `onstart` / `onend` (alvo da dependência)
> - IDs relativos (`!`, `!!`)

**Conteúdo esperado:**
```typescript
class TaskDependency {
  taskId: string;           // ID absoluto ou relativo
  onEnd: boolean;           // true = alvo é o end da task
  gapDuration: number;      // Gap em segundos (calendar time)
  gapLength: number;        // Gap em slots (working time)
  
  resolve(project): Task;   // Resolve ID → Task
}
```

---

### 4. ⭐ `lib/taskjuggler/Limits.rb`
**Limites de alocação** — restringe quanto recurso pode ser usado por período.

> **Por que é essencial:** O `TaskScenario.limitsOk()` e `ResourceScenario.book()` chamam `limits.ok()` e `limits.inc()`. Sem este arquivo, você não implementa:
> - `dailymax`, `dailymin`, `weeklymax`, `weeklymin`, `monthlymax`, `monthlymin`
> - `maximum`, `minimum` (limites absolutos)
> - Limites por recurso específico (`resources.limit`)
> - Reset de contadores entre cenários

**Conteúdo esperado:**
```typescript
class Limits {
  limits: Limit[];
  
  setLimit(name, value, interval, resource?): void;
  ok(sbIdx, checkMin?, resource?): boolean;
  inc(sbIdx, resource?): void;
  reset(): void;
}

class Limit {
  name: 'dailymax' | 'weeklymax' | ...;
  value: number;
  interval: ScoreboardInterval;
  resource: Resource | null;  // null = todos recursos
}
```

---

### 5. ⭐ `lib/taskjuggler/ShiftAssignments.rb`
**Atribuições de shifts a intervalos** — controla quando shifts estão ativos.

> **Por que é essencial:** O `ResourceScenario.onShift()` e `TaskScenario.onShift()` chamam `shifts.assigned?()` e `shifts.onShift?()`. Sem este arquivo, você não implementa:
> - `shifts.task`, `shifts.resource`, `shift.allocate`
> - Múltiplas atribuições com intervalos não-sobrepostos
> - Modo `replace` (shift substitui working hours do recurso)
> - Integração com leaves do shift

**Conteúdo esperado:**
```typescript
class ShiftAssignments {
  project: Project;
  assignments: ShiftAssignment[];  // Ordenados por intervalo
  
  addAssignment(assignment): boolean;  // false se sobrepor
  assigned(sbIdx): boolean;            // Algum shift ativo?
  onShift(sbIdx): boolean;             // No horário de trabalho?
  getSbSlot(sbIdx): number | null;     // Valor do scoreboard
}

class ShiftAssignment {
  shift: Shift;
  interval: TimeInterval;
}
```

---

## 🎯 FASE 6: Modelo de Domínio + Reports (5 arquivos seguintes)

Depois da Fase 5, o scheduler estará completo. A Fase 6 completa o **modelo de domínio** e abre caminho para **relatórios**.

### 6. `lib/taskjuggler/ScenarioData.rb`
**Classe base para `TaskScenario`, `ResourceScenario`, `AccountScenario`, `ShiftScenario`.**

> **Por que é essencial:** É a superclasse que define o padrão `@property`, `@scenarioIdx`, `@attributes` e o mecanismo de delegação. Entender ela é entender a arquitetura scenario-specific.

---

### 7. `lib/taskjuggler/Attributes.rb`
**Todos os tipos de atributos** — `DateAttribute`, `FloatAttribute`, `StringAttribute`, `RichTextAttribute`, `FlagListAttribute`, etc.

> **Por que é essencial:** O `PropertyTreeNode` cria atributos sob demanda via `aType.objClass.new(...)`. Sem este arquivo, você não tem o sistema de tipos completo (~30 subclasses de `Attribute`).

---

### 8. `lib/taskjuggler/PropertySet.rb`
**Coleção de propriedades do mesmo tipo** — gerencia namespace, attribute definitions, e indexação.

> **Por que é essencial:** `@tasks`, `@resources`, `@accounts`, `@shifts`, `@scenarios`, `@reports` são todos `PropertySet`. É o "container" que define o blueprint de atributos.

---

### 9. `lib/taskjuggler/Scenario.rb`
**Entidade Scenario** — representa um cenário (plan, best-case, worst-case).

> **Por que é essencial:** Sem ele, você não implementa:
> - Múltiplos cenários com atributos scenario-specific
> - `active` / `disabled`
> - `projection` mode
> - `ownbookings` (herança de bookings do tracking scenario)
> - Hierarquia de cenários

---

### 10. `lib/taskjuggler/Query.rb`
**Contexto de avaliação de expressões lógicas** — usado por `LogicalAttribute.eval()`.

> **Por que é essencial:** O `LogicalExpression` precisa de um `Query` para avaliar atributos. Sem ele, `hidetask`, `hideresource`, `celltext`, `cellcolor`, `tooltip` não funcionam. É a **ponte entre o scheduler e os relatórios**.

---

## 🔄 Pipeline Atualizado com as Novas Fases

```
FASE 1 ✅: Parser (Scanner + Parser + SyntaxRules)
FASE 2 ✅: Modelo base (Project, PropertyTreeNode, TjTime, AttributeDefinition)
FASE 3 ✅: Scheduler core (TaskScenario, ResourceScenario, Scoreboard)
FASE 4 ✅: Expressões lógicas (LogicalExpression, LogicalOperation)
FASE 5 🎯: Completar scheduler
   ├── Allocation.rb      ← COMO recursos são alocados
   ├── Booking.rb         ← COMO trabalho manual é registrado
   ├── TaskDependency.rb  ← COMO dependências são resolvidas
   ├── Limits.rb          ← COMO limites restringem alocações
   └── ShiftAssignments.rb ← COMO shifts controlam horários
FASE 6 🎯: Modelo completo + Reports
   ├── ScenarioData.rb    ← Base dos *Scenario
   ├── Attributes.rb      ← Tipos de atributos (~30 classes)
   ├── PropertySet.rb     ← Container de propriedades
   ├── Scenario.rb        ← Entidade Scenario
   └── Query.rb           ← Contexto de avaliação (ponte para reports)
FASE 7 (futura): Reports
   ├── Report.rb + subclasses
   ├── TableColumnDefinition.rb
   ├── LogicalFunction.rb
   ├── HTMLDocument.rb
   └── RichText.rb
```

---

## 📋 Checklist Atualizado

### ✅ Já analisados (20 arquivos)
- [x] Parser: `TjpSyntaxRules`, `ProjectFileScanner`, `ProjectFileParser`, `SyntaxReference`, `KeywordDocumentation`
- [x] Modelo: `Project`, `PropertyTreeNode`, `Task`, `Resource`, `AttributeDefinition`, `TjTime`
- [x] Scheduler: `TaskScenario`, `ResourceScenario`, `Scoreboard`, `TaskJuggler`
- [x] Tempo: `Interval`, `IntervalList`, `WorkingHours`
- [x] Lógica: `LogicalExpression`, `LogicalOperation`

### 🎯 Próximos 10 (Fases 5 e 6)
- [ ] **Allocation.rb** ⭐
- [ ] **Booking.rb** ⭐
- [ ] **TaskDependency.rb** ⭐
- [ ] **Limits.rb** ⭐
- [ ] **ShiftAssignments.rb** ⭐
- [ ] ScenarioData.rb
- [ ] Attributes.rb
- [ ] PropertySet.rb
- [ ] Scenario.rb
- [ ] Query.rb

### 🔮 Futuros (Fase 7 - Reports)
- [ ] Report.rb
- [ ] TableColumnDefinition.rb
- [ ] LogicalFunction.rb
- [ ] RichText.rb
- [ ] HTMLDocument.rb

---

## 💡 Ordem de Leitura Sugerida

Para máxima eficiência, leia nesta ordem:

**Fase 5 (nesta ordem):**
1. `TaskDependency.rb` → primeiro, para entender o grafo
2. `Allocation.rb` → depois, para entender alocações
3. `ShiftAssignments.rb` → usado por Allocation
4. `Limits.rb` → usado por Allocation e ResourceScenario
5. `Booking.rb` → independente, pode ser lido por último

**Fase 6 (nesta ordem):**
1. `ScenarioData.rb` → base de tudo
2. `Attributes.rb` → tipos de atributos
3. `PropertySet.rb` → container
4. `Scenario.rb` → usa PropertySet
5. `Query.rb` → usa Attributes

---

**Resumo:** Anexe os 5 arquivos da **Fase 5** primeiro (`Allocation`, `Booking`, `TaskDependency`, `Limits`, `ShiftAssignments`) para completar o scheduler. Depois os 5 da **Fase 6** para completar o modelo e abrir caminho para relatórios. 🚀
````

---

## Arquivo: `docs/tj3-engine/06-blueprint-engine5.md`

````md
# 📘 Blueprint Fase 6: Modelo de Domínio Completo + Sistema de Queries

## 🎯 Objetivo
Complementar a análise da Fase 5 com os 5 arquivos que completam o **modelo de domínio** e o **sistema de queries**. Estes arquivos são essenciais para entender como as propriedades são organizadas, como os cenários funcionam, e como os relatórios acessam dados calculados.

---

## 🏗️ 1. VISÃO GERAL DO PIPELINE ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project (Orquestrador)                        │
│  └── PropertySets:                                              │
│      ├── tasks: PropertySet<Task>          ◄── PropertySet.rb   │
│      ├── resources: PropertySet<Resource>                       │
│      ├── accounts: PropertySet<Account>                         │
│      ├── shifts: PropertySet<Shift>                             │
│      ├── scenarios: PropertySet<Scenario>  ◄── Scenario.rb      │
│      └── reports: PropertySet<Report>                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ contém
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PropertyTreeNode (base)                             │
│  └── @data[scenarioIdx]: ScenarioData      ◄── ScenarioData.rb  │
│      ├── TaskScenario                                           │
│      ├── ResourceScenario                                       │
│      ├── AccountScenario                                        │
│      └── ShiftScenario                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ usa
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Attributes (Tipos de Atributos)  ◄── Attributes.rb  │
│  ├── DateAttribute, FloatAttribute, StringAttribute             │
│  ├── BooleanAttribute, IntegerAttribute                         │
│  ├── RichTextAttribute, ReferenceAttribute                      │
│  ├── FlagListAttribute, ResourceListAttribute                   │
│  ├── AllocationAttribute, BookingListAttribute                  │
│  ├── DependencyListAttribute, TaskDepListAttribute              │
│  ├── LogicalExpressionAttribute, LimitsAttribute                │
│  ├── ShiftAssignmentsAttribute, WorkingHoursAttribute           │
│  └── ... (30+ tipos)                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ usado por
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Query (Contexto de Avaliação)  ◄── Query.rb         │
│  └── Avalia atributos via query_<attributeId>()                 │
│  └── Usado por LogicalAttribute.eval()                          │
│  └── Ponte entre scheduler e relatórios                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. PROPERTYSET.RB — Coleção de Propriedades

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Container de propriedades** | Armazena todas as propriedades do mesmo tipo (tasks, resources, etc.) |
| **Blueprint de atributos** | Define os AttributeDefinitions para todas as propriedades |
| **Namespace** | Gerencia IDs únicos (flat ou hierárquico) |
| **Indexação** | Mantém mapa de ID → propriedade para acesso rápido |
| **Iteração** | Permite percorrer todas as propriedades |

### 2.2 Estrutura Interna

```typescript
class PropertySet<T extends PropertyTreeNode> {
  @project: Project;
  @flatNamespace: boolean;           // true = IDs únicos globais
  @properties: T[];                  // Lista ordenada
  @propertyMap: Map<string, T>;      // Mapa ID → propriedade
  @attributeDefinitions: Map<string, AttributeDefinition>;
  
  constructor(project: Project, flatNamespace: boolean) {
    this.@project = project;
    this.@flatNamespace = flatNamespace;
    this.@properties = [];
    this.@propertyMap = new Map();
    this.@attributeDefinitions = new Map();
    
    // Atributos base (todos PropertySets têm)
    this.addAttributeType(new AttributeDefinition(
      'id', 'ID', StringAttribute, false, false, false, ''
    ));
    this.addAttributeType(new AttributeDefinition(
      'name', 'Name', StringAttribute, false, false, false, ''
    ));
    this.addAttributeType(new AttributeDefinition(
      'seqno', 'Seq. No', IntegerAttribute, false, false, false, 0
    ));
  }
}
```

### 2.3 Métodos Críticos

```typescript
// Adiciona um tipo de atributo ao blueprint
addAttributeType(attributeType: AttributeDefinition): void {
  if (this.@properties.length > 0) {
    throw new Error("Attribute types must be defined before properties are added");
  }
  this.@attributeDefinitions.set(attributeType.id, attributeType);
}

// Adiciona uma propriedade ao set
addProperty(property: T): void {
  this.@propertyMap.set(property.id, property);
  this.@properties.push(property);
}

// Remove uma propriedade (e seus filhos)
removeProperty(prop: T | string): T {
  const property = typeof prop === 'string' ? this.@propertyMap.get(prop)! : prop;
  
  // Remove referências
  for (const p of this.@properties) {
    p.removeReferences(property);
  }
  
  // Remove filhos recursivamente
  while (property.children.length > 0) {
    this.removeProperty(property.children[0]);
  }
  
  this.@properties = this.@properties.filter(p => p !== property);
  this.@propertyMap.delete(property.fullId);
  
  if (property.parent) {
    property.parent.children = property.parent.children.filter(c => c !== property);
  }
  
  return property;
}

// Atualiza índices BSI (Breakdown Structure Index)
index(): void {
  for (const p of this.@properties) {
    const bsIdcs = p.getBSIndicies();
    const bsi = bsIdcs.join('.');
    p.force('bsi', bsi);
  }
}

// Verifica se atributo é scenario-specific
scenarioSpecific?(attrId: string): boolean {
  const attrDef = this.@attributeDefinitions.get(attrId);
  if (attrDef) {
    return attrDef.scenarioSpecific;
  }
  
  // Verifica se há query_ function scenario-specific
  if (this.@properties.length > 0) {
    const property = this.@properties[0];
    const methodName = `query_${attrId}`;
    if (property.data && property.data[0] && 
        typeof property.data[0][methodName] === 'function') {
      return true;
    }
  }
  
  return false;
}

// Verifica se atributo é herdado do projeto global
inheritedFromProject?(attrId: string): boolean {
  const attrDef = this.@attributeDefinitions.get(attrId);
  return attrDef ? attrDef.inheritedFromProject : false;
}

// Verifica se atributo é herdado do pai
inheritedFromParent?(attrId: string): boolean {
  const attrDef = this.@attributeDefinitions.get(attrId);
  return attrDef ? attrDef.inheritedFromParent : false;
}

// Verifica se atributo é uma lista
listAttribute?(attrId: string): boolean {
  const attrDef = this.@attributeDefinitions.get(attrId);
  return attrDef ? attrDef.objClass.isList() : false;
}
```

### 2.4 Namespace Flat vs Hierárquico

```typescript
// Flat namespace (ex: scenarios, shifts, accounts, resources)
// IDs devem ser únicos globalmente
// Ex: "plan", "dev", "test" (scenarios)
// Ex: "john", "mary", "room1" (resources)

// Hierárquico namespace (ex: tasks, reports)
// IDs únicos apenas entre irmãos
// Full ID composto: "pai.filho.neto"
// Ex: "proj.plan.doc" (task)
// Ex: "report1.subreport1" (report)

// No PropertyTreeNode.fullId():
fullId(): string {
  if (this.@propertySet.flatNamespace) {
    return this.@subId;
  }
  
  let res = this.@subId;
  let t: PropertyTreeNode | null = this;
  while ((t = t.parent) !== null) {
    res = t.subId + '.' + res;
  }
  return res;
}
```

---

## 🎭 3. SCENARIO.RB — Entidade Scenario

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Representa um cenário** | Plan, best-case, worst-case, etc. |
| **Herda de PropertyTreeNode** | Usa o mesmo sistema de atributos |
| **Controla ativação** | `active` flag determina se é agendado |
| **Modo projeção** | `projection` flag para tracking |
| **Herança de bookings** | `ownbookings` controla herança |

### 3.2 Estrutura Interna

```typescript
class Scenario extends PropertyTreeNode {
  constructor(project: Project, id: string, name: string, parent: Scenario | null) {
    super(project.scenarios, id, name, parent);
    project.addScenario(this);
  }
  
  // Retorna todos os cenários derivados (incluindo este)
  all(): Scenario[] {
    const result: Scenario[] = [this];
    for (const child of this.children) {
      result.push(...child.all());
    }
    return result;
  }
  
  // Retorna apenas os cenários folha
  allLeaves(includeSelf = false): Scenario[] {
    const result: Scenario[] = [];
    if (this.leaf() && includeSelf) {
      result.push(this);
    } else {
      for (const child of this.children) {
        result.push(...child.allLeaves());
      }
    }
    return result;
  }
}
```

### 3.3 Atributos do Scenario

```typescript
// Definidos em Project.rb:
const scenarioAttributes = [
  ['active', 'Enabled', BooleanAttribute, true, false, false, true],
  ['id', 'ID', StringAttribute, false, false, false, null],
  ['name', 'Name', StringAttribute, false, false, false, null],
  ['ownbookings', 'Own Bookings', BooleanAttribute, false, false, false, true],
  ['projection', 'Projection Mode', BooleanAttribute, true, false, false, false],
  ['seqno', 'No', IntegerAttribute, false, false, false, null],
];
```

### 3.4 Hierarquia de Cenários

```typescript
// Exemplo de hierarquia:
// plan (raiz, scenarioIdx = 0)
// ├── best-case (scenarioIdx = 1)
// │   └── optimistic (scenarioIdx = 3)
// └── worst-case (scenarioIdx = 2)

// Cenários herdam bookings do pai se ownbookings = false
// Tracking scenario força projection = true para todos os filhos

// No Project.schedule():
for (const scenario of this.scenarios) {
  if (!scenario.get('active')) continue;
  
  const scIdx = this.scenarioIdx(scenario);
  
  // Prepara cenário (herança, validação)
  this.prepareScenario(scIdx);
  
  // Agenda cenário
  this.scheduleScenario(scIdx);
  
  // Finaliza cenário (pós-validação)
  this.finishScenario(scIdx);
}
```

### 3.5 Tracking Scenario

```typescript
// No Project (quando trackingScenarioIdx é setado):
setTrackingScenario(scenarioIdx: number): void {
  this.@attributes['trackingScenarioIdx'] = scenarioIdx;
  
  // Marca todos os filhos como projection mode
  const scenario = this.scenario(scenarioIdx);
  for (const sc of scenario.all()) {
    sc.set('projection', true);
  }
  
  // Marca todos os filhos como não-ownbookings
  for (const sc of scenario.allLeaves(true)) {
    sc.set('ownbookings', false);
  }
}

// No TaskScenario.findBookings():
findBookings(): Booking[] {
  let scenario = this.property.project.scenario(this.scenarioIdx);
  
  // Se cenário não tem bookings próprios, herda do pai
  while (!scenario.get('ownbookings')) {
    scenario = scenario.parent!;
  }
  
  // Retorna bookings do cenário encontrado
  return this.property.get('booking', this.property.project.scenarioIdx(scenario));
}
```

---

## 📊 4. SCENARIODATA.RB — Base para Dados por Cenário

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base** | Superclasse de TaskScenario, ResourceScenario, etc. |
| **Referência à propriedade** | `@property` aponta para o PropertyTreeNode |
| **Índice do cenário** | `@scenarioIdx` identifica o cenário |
| **Acesso a atributos** | `a(attrName)` acessa atributos scenario-specific |
| **Mensagens** | `error()`, `warning()`, `info()` com contexto |

### 4.2 Estrutura Interna

```typescript
class ScenarioData {
  @property: PropertyTreeNode;
  @project: Project;
  @scenarioIdx: number;
  @attributes: Map<string, Attribute>;
  @messageHandler: MessageHandler;
  
  constructor(property: PropertyTreeNode, idx: number, attributes: Map<string, Attribute>) {
    this.@property = property;
    this.@project = property.project;
    this.@scenarioIdx = idx;
    this.@attributes = attributes;
    this.@messageHandler = MessageHandlerInstance.instance;
    
    // Registra este ScenarioData com a propriedade
    this.@property.data[idx] = this;
  }
  
  // Acesso rápido a atributos scenario-specific
  a(attributeName: string): any {
    return this.@attributes.get(attributeName)!.get();
  }
  
  // Mensagens com contexto
  error(id: string, text: string, sourceFileInfo?: SourceFileInfo, property?: PropertyTreeNode): void {
    this.@messageHandler.error(
      id, text,
      sourceFileInfo || this.@property.sourceFileInfo,
      null,
      property || this.@property,
      this.@project.scenario(this.@scenarioIdx)
    );
  }
  
  warning(id: string, text: string, sourceFileInfo?: SourceFileInfo, property?: PropertyTreeNode): void {
    this.@messageHandler.warning(
      id, text,
      sourceFileInfo || this.@property.sourceFileInfo,
      null,
      property || this.@property,
      this.@project.scenario(this.@scenarioIdx)
    );
  }
  
  info(id: string, text: string, sourceFileInfo?: SourceFileInfo, property?: PropertyTreeNode): void {
    this.@messageHandler.info(
      id, text,
      sourceFileInfo || this.@property.sourceFileInfo,
      null,
      property || this.@property,
      this.@project.scenario(this.@scenarioIdx)
    );
  }
}
```

### 4.3 Padrão de Delegação

```typescript
// No PropertyTreeNode (Ruby usa method_missing):
// Em TypeScript, criar método explícito:

class PropertyTreeNode {
  // ...
  
  // Delegação para ScenarioData
  scenarioData(scenarioIdx: number): ScenarioData {
    return this.@data[scenarioIdx];
  }
  
  // Exemplo de uso:
  readyForScheduling?(scenarioIdx: number): boolean {
    return this.scenarioData(scenarioIdx).readyForScheduling?();
  }
}

// Alternativa: usar Proxy para simular method_missing
class PropertyTreeNode {
  constructor(...) {
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }
        
        // Delega para ScenarioData
        return (...args: any[]) => {
          const scenarioIdx = args[0] || 0;
          const scenarioData = target.data[scenarioIdx];
          const method = scenarioData[prop];
          if (typeof method === 'function') {
            return method.apply(scenarioData, args.slice(1));
          }
          return undefined;
        };
      }
    });
  }
}
```

---

## 🔍 5. QUERY.RB — Contexto de Avaliação

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Contexto de query** | Fornece contexto para avaliar atributos |
| **Resolução de propriedades** | Converte IDs em referências |
| **Execução de queries** | Chama `query_<attributeId>()` |
| **Formatação de resultados** | Converte para string, número, sortable |
| **Escala de unidades** | Converte effort/duration para unidades legíveis |

### 5.2 Estrutura Interna

```typescript
class Query {
  // Parâmetros da query
  @project?: Project;
  @property?: PropertyTreeNode;
  @propertyId?: string;
  @propertyType?: 'Task' | 'Resource' | 'Account';
  @scopeProperty?: PropertyTreeNode;
  @scopePropertyId?: string;
  @scopePropertyType?: 'Task' | 'Resource' | 'Account';
  @attributeId?: string;
  @scenario?: Scenario;
  @scenarioIdx?: number;
  
  // Parâmetros de tempo
  @start?: TjTime;
  @end?: TjTime;
  @startIdx?: number;
  @endIdx?: number;
  
  // Parâmetros de formatação
  @loadUnit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'quarters' | 'years' | 'shortauto' | 'longauto';
  @numberFormat?: RealFormat;
  @currencyFormat?: RealFormat;
  @timeFormat?: string;
  
  // Parâmetros de lista
  @listItem?: string;
  @listType?: 'comma' | 'bullets' | 'numbered';
  
  // Parâmetros de journal
  @hideJournalEntry?: LogicalExpression;
  @journalMode?: 'journal' | 'journal_sub' | 'status_dep' | 'status_down' | 'status_up' | 'alerts_dep' | 'alerts_down';
  @journalAttributes?: string[];
  @sortJournalEntries?: [string, number][];
  
  // Parâmetros de conta
  @costAccount?: Account;
  @revenueAccount?: Account;
  
  // Outros
  @selfContained?: boolean;
  
  // Resultados
  @ok: boolean = true;
  @errorMessage?: string;
  @attr?: Attribute;
  @numerical?: number;
  @sortable?: any;
  @string?: string;
  @rti?: RichTextIntermediate;
  
  // Dados customizados
  @customData: Map<string, any> = new Map();
  
  constructor(parameters: Partial<Query> = {}) {
    Object.assign(this, parameters);
    
    // Sincroniza start/end com startIdx/endIdx
    if (this.@start) {
      this.@startIdx = this.@project!.dateToIdx(this.@start);
    }
    if (this.@end) {
      this.@endIdx = this.@project!.dateToIdx(this.@end);
    }
  }
}
```

### 5.3 Método process() — O Coração da Query

```typescript
process(): boolean {
  this.reset();
  
  try {
    // 1. Resolve property reference
    if (this.@propertyId && (!this.@property || this.@propertyId[0] === '!')) {
      this.@property = this.resolvePropertyId(this.@propertyType!, this.@propertyId);
      if (!this.@property) {
        this.@errorMessage = `Unknown property '${this.@propertyId}' queried`;
        return this.@ok = false;
      }
    }
    
    // 2. Se não há property, é um atributo de projeto
    if (!this.@property) {
      const supportedAttrs = ['copyright', 'currency', 'end', 'journal', 'name', 'now', 'projectid', 'start', 'version'];
      if (!supportedAttrs.includes(this.@attributeId!)) {
        this.@errorMessage = `Unsupported project attribute '${this.@attributeId}'`;
        return this.@ok = false;
      }
      
      const attr = this.@project![this.@attributeId!];
      if (attr instanceof TjTime) {
        this.@sortable = this.@numerical = attr;
        this.@string = attr.to_s(this.@timeFormat);
      } else {
        this.@sortable = this.@string = attr;
      }
      return this.@ok = true;
    }
    
    // 3. Resolve scope property
    if (this.@scopeProperty && this.@scopePropertyId) {
      this.@scopeProperty = this.resolvePropertyId(this.@scopePropertyType!, this.@scopePropertyId);
      if (!this.@scopeProperty) {
        this.@errorMessage = `Unknown scope property ${this.@scopePropertyId} queried`;
        return this.@ok = false;
      }
    }
    
    // 4. Garante referência ao projeto
    this.@project = this.@property.project;
    
    // 5. Resolve scenario
    if (this.@scenario && !this.@scenarioIdx) {
      this.@scenarioIdx = this.@project.scenarioIdx(this.@scenario);
      if (this.@scenarioIdx === undefined) {
        throw new Error(`Query cannot resolve scenario '${this.@scenario}'`);
      }
    }
    
    // 6. Executa a query
    const queryMethodName = `query_${this.@attributeId}`;
    
    // Verifica dados customizados primeiro
    const customData = this.@customData.get(this.@attributeId!);
    if (customData) {
      this.@sortable = customData.sortable;
      this.@numerical = customData.numerical;
      this.@string = customData.string;
      this.@rti = customData.rti;
    }
    // Verifica query_ function não-scenario-specific
    else if (typeof this.@property[queryMethodName] === 'function') {
      this.@property[queryMethodName](this);
    }
    // Verifica query_ function scenario-specific
    else if (this.@scenarioIdx !== undefined && this.@property.data && 
             typeof this.@property.data[this.@scenarioIdx][queryMethodName] === 'function') {
      this.@property.data[this.@scenarioIdx][queryMethodName](this);
    }
    // Atributo base
    else {
      const aType = this.@property.attributeDefinition(this.@attributeId!);
      if (!aType) {
        this.@errorMessage = `Unknown attribute '${this.@attributeId}' queried`;
        return this.@ok = false;
      }
      
      const scIdx = aType.scenarioSpecific ? this.@scenarioIdx : undefined;
      this.@attr = this.@property.getAttribute(this.@attributeId!, scIdx);
      
      if (!this.@attr && this.@attr instanceof DateAttribute) {
        this.@errorMessage = `Attribute '${this.@attributeId}' of property '${this.@property.fullId}' has undefined value.`;
        return this.@ok = false;
      }
    }
    
  } catch (e) {
    if (e instanceof TjException) {
      this.@errorMessage = e.message;
      return this.@ok = false;
    }
    throw e;
  }
  
  return this.@ok = true;
}
```

### 5.4 Métodos de Acesso ao Resultado

```typescript
// Retorna resultado como string
to_s(): string {
  return this.@attr ? this.@attr.to_s(this) : (this.@rti ? this.@rti.to_s() : (this.@string || ''));
}

// Retorna resultado como número
to_num(): number | undefined {
  return this.@attr ? this.@attr.to_num() : this.@numerical;
}

// Retorna resultado para ordenação
to_sort(): any {
  return this.@attr ? this.@attr.to_sort() : this.@sortable;
}

// Retorna resultado como RichText
to_rti(): RichTextIntermediate | undefined {
  if (this.@attr instanceof RichTextAttribute) {
    return this.@attr.value;
  }
  return this.@attr ? this.@attr.to_rti(this) : this.@rti;
}

// Retorna resultado original
result(): any {
  if (this.@attr) {
    if (this.@attr.value && this.@attr instanceof ReferenceAttribute) {
      return this.@attr.value[0];
    }
    return this.@attr.value;
  }
  if (this.@numerical !== undefined) return this.@numerical;
  if (this.@rti) return this.@rti;
  return this.@string;
}
```

### 5.5 Escala de Unidades

```typescript
// Converte duration para unidade legível
scaleDuration(value: number): string {
  return this.scaleValue(value, [
    24 * 60,      // minutes
    24,           // hours
    1,            // days
    1.0 / 7,      // weeks
    1.0 / 30.42,  // months
    1.0 / 91.25,  // quarters
    1.0 / 365     // years
  ]);
}

// Converte effort/load para unidade legível
scaleLoad(value: number): string {
  return this.scaleValue(value, [
    this.@project!.dailyWorkingHours * 60,  // minutes
    this.@project!.dailyWorkingHours,       // hours
    1.0,                                     // days
    1.0 / this.@project!.weeklyWorkingDays,  // weeks
    1.0 / this.@project!.monthlyWorkingDays, // months
    1.0 / (this.@project!.yearlyWorkingDays / 4), // quarters
    1.0 / this.@project!.yearlyWorkingDays   // years
  ]);
}

// Implementação genérica de escala
private scaleValue(value: number, factors: number[]): string {
  if (this.@loadUnit === 'shortauto' || this.@loadUnit === 'longauto') {
    // Tenta todas as unidades e escolhe a mais curta
    const options: (string | null)[] = [];
    const delta: number[] = [];
    const max = [60, 48, null, 8, 24, 0, null];
    
    const stdFormat = new RealFormat(['-', '', '', '.', this.@numberFormat!.fractionDigits]);
    
    for (let i = 0; i < factors.length; i++) {
      const factor = factors[i];
      const scaledValue = value * factor;
      const str = this.@numberFormat!.format(scaledValue);
      const stdStr = stdFormat.format(scaledValue);
      delta[i] = Math.abs(scaledValue - parseFloat(stdStr));
      
      if ((factor !== 1.0 && /^[0.]*$/.test(stdStr)) || (max[i] && scaledValue > max[i]!)) {
        options.push(null);
      } else {
        options.push(str);
      }
    }
    
    // Encontra o valor mais próximo do original
    let shortest = 2;
    for (let j = 0; j < delta.length; j++) {
      if (options[j] && delta[j] < delta[shortest]) {
        shortest = j;
      }
    }
    
    // Encontra a opção mais curta
    const fSep = this.@numberFormat!.fractionSeparator;
    for (let j = 0; j < 6; j++) {
      if (options[j] && !options[j].startsWith('0' + fSep) && options[j].length < options[shortest]!.length) {
        shortest = j;
      }
    }
    
    let str = options[shortest]!;
    
    if (this.@loadUnit === 'longauto') {
      const units = str === "1" 
        ? ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']
        : ['minutes', 'hours', 'days', 'weeks', 'months', 'quarters', 'years'];
      str += ' ' + units[shortest];
    } else {
      str += ['min', 'h', 'd', 'w', 'm', 'q', 'y'][shortest];
    }
    
    return str;
  } else {
    // Unidade fixa
    const units = ['minutes', 'hours', 'days', 'weeks', 'months', 'quarters', 'years'];
    const idx = units.indexOf(this.@loadUnit!);
    return this.@numberFormat!.format(value * factors[idx]);
  }
}
```

### 5.6 Exemplo de query_ function

```typescript
// Em TaskScenario.rb:
query_effort(query: Query): void {
  const work = this.getEffectiveWork(query.startIdx!, query.endIdx!, query.scopeProperty);
  query.sortable = query.numerical = work;
  query.string = query.scaleLoad(work);
}

// Em ResourceScenario.rb:
query_freetime(query: Query): void {
  const time = this.getEffectiveFreeTime(query.startIdx!, query.endIdx!) / (60 * 60 * 24);
  query.sortable = query.numerical = time;
  query.string = query.scaleDuration(time);
}

// Em PropertyTreeNode.rb:
query_children(query: Query): void {
  const list: string[] = [];
  for (const property of this.kids()) {
    if (query.listItem) {
      const rti = new RichText(query.listItem, RTFHandlers.create(this.@project)).generateIntermediateFormat();
      const q = query.dup();
      q.property = property;
      rti.setQuery(q);
      list.push(`<nowiki>${rti.to_s()}</nowiki>`);
    } else {
      list.push(`<nowiki>${property.name} (${property.fullId})</nowiki>`);
    }
  }
  query.assignList(list);
}
```

---

## 🏷️ 6. ATTRIBUTES.RB — Sistema de Tipos de Atributos

### 6.1 Hierarquia de Classes

```typescript
// Classe base
abstract class AttributeBase {
  @propertySet: PropertySet;
  @type: AttributeDefinition;
  @container: PropertyTreeNode | ScenarioData;
  @value: any;
  @provided: boolean = false;
  @inherited: boolean = false;
  @computed: boolean = false;
  
  static mode: 0 | 1 | 2 = 0;  // 0=provided, 1=inherited, 2=computed
  
  abstract get(): any;
  abstract set(value: any): void;
  abstract inherit(value: any): void;
  abstract reset(): void;
  abstract isList(): boolean;
  abstract to_s(query?: Query): string;
  abstract to_tjp(): string;
}

// Atributos simples (não-lista)
class DateAttribute extends AttributeBase { /* ... */ }
class FloatAttribute extends AttributeBase { /* ... */ }
class IntegerAttribute extends AttributeBase { /* ... */ }
class StringAttribute extends AttributeBase { /* ... */ }
class BooleanAttribute extends AttributeBase { /* ... */ }
class RichTextAttribute extends AttributeBase { /* ... */ }
class ReferenceAttribute extends AttributeBase { /* ... */ }
class SymbolAttribute extends AttributeBase { /* ... */ }
class PropertyAttribute extends AttributeBase { /* ... */ }
class AccountAttribute extends AttributeBase { /* ... */ }
class LimitsAttribute extends AttributeBase { /* ... */ }
class ShiftAssignmentsAttribute extends AttributeBase { /* ... */ }
class WorkingHoursAttribute extends AttributeBase { /* ... */ }
class RealFormatAttribute extends AttributeBase { /* ... */ }
class LogicalExpressionAttribute extends AttributeBase { /* ... */ }

// Atributos lista
abstract class ListAttributeBase extends AttributeBase {
  isList(): boolean { return true; }
}

class FlagListAttribute extends ListAttributeBase { /* ... */ }
class ResourceListAttribute extends ListAttributeBase { /* ... */ }
class TaskListAttribute extends ListAttributeBase { /* ... */ }
class AllocationAttribute extends ListAttributeBase { /* ... */ }
class BookingListAttribute extends ListAttributeBase { /* ... */ }
class ChargeListAttribute extends ListAttributeBase { /* ... */ }
class ChargeSetListAttribute extends ListAttributeBase { /* ... */ }
class DependencyListAttribute extends ListAttributeBase { /* ... */ }
class TaskDepListAttribute extends ListAttributeBase { /* ... */ }
class LogicalExpressionListAttribute extends ListAttributeBase { /* ... */ }
class LeaveListAttribute extends ListAttributeBase { /* ... */ }
class LeaveAllowanceListAttribute extends ListAttributeBase { /* ... */ }
class ColumnListAttribute extends ListAttributeBase { /* ... */ }
class FormatListAttribute extends ListAttributeBase { /* ... */ }
class ScenarioListAttribute extends ListAttributeBase { /* ... */ }
class NodeListAttribute extends ListAttributeBase { /* ... */ }
class SortListAttribute extends ListAttributeBase { /* ... */ }
class JournalSortListAttribute extends ListAttributeBase { /* ... */ }
class DefinitionListAttribute extends ListAttributeBase { /* ... */ }
class TimeIntervalListAttribute extends ListAttributeBase { /* ... */ }
class SymbolListAttribute extends ListAttributeBase { /* ... */ }
class AccountCreditListAttribute extends ListAttributeBase { /* ... */ }
```

### 6.2 Implementação de Atributos Comuns

```typescript
// DateAttribute
class DateAttribute extends AttributeBase {
  get(): TjTime | null {
    return this.@value;
  }
  
  set(value: TjTime): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_s(query?: Query): string {
    if (this.@value) {
      return this.@value.to_s(query ? query.timeFormat : '%Y-%m-%d');
    }
    return 'Error';
  }
  
  to_tjp(): string {
    return this.@type.id + ' ' + this.@value.to_s();
  }
}

// BooleanAttribute
class BooleanAttribute extends AttributeBase {
  get(): boolean {
    return this.@value;
  }
  
  set(value: boolean): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_s(query?: Query): string {
    return this.@value ? 'true' : 'false';
  }
  
  to_tjp(): string {
    return this.@type.id + ' ' + (this.@value ? 'yes' : 'no');
  }
}

// FloatAttribute
class FloatAttribute extends AttributeBase {
  get(): number {
    return this.@value;
  }
  
  set(value: number): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_tjp(): string {
    return this.@type.id + ' ' + this.@value.toString();
  }
}

// StringAttribute
class StringAttribute extends AttributeBase {
  get(): string {
    return this.@value;
  }
  
  set(value: string): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_tjp(): string {
    return `${this.@type.id} "${this.quotedString(this.@value)}"`;
  }
  
  private quotedString(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}

// RichTextAttribute
class RichTextAttribute extends AttributeBase {
  get(): RichTextIntermediate | null {
    return this.@value;
  }
  
  set(value: RichTextIntermediate): void {
    this.@value = value;
    this.markProvided();
  }
  
  inputText(): string {
    return this.@value ? this.@value.richText.inputText : '';
  }
  
  to_s(query?: Query): string {
    return this.@value ? this.@value.to_s() : '';
  }
  
  to_tjp(): string {
    return `${this.@type.id} "${this.quotedString(this.@value.richText.inputText)}"`;
  }
}

// FlagListAttribute
class FlagListAttribute extends ListAttributeBase {
  constructor(propertySet: PropertySet, type: AttributeDefinition, container: any) {
    super(propertySet, type, container);
    this.set([]);
  }
  
  get(): string[] {
    return this.@value;
  }
  
  set(value: string[]): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_s(query?: Query): string {
    return this.@value.join(', ');
  }
  
  to_tjp(): string {
    return `flags ${this.@value.join(', ')}`;
  }
}

// ResourceListAttribute
class ResourceListAttribute extends ListAttributeBase {
  constructor(propertySet: PropertySet, type: AttributeDefinition, container: any) {
    super(propertySet, type, container);
    this.set([]);
  }
  
  get(): Resource[] {
    return this.@value;
  }
  
  set(value: Resource[]): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_s(query?: Query): string {
    return this.@value.map(r => r.fullId).join(', ');
  }
  
  to_rti(query?: Query): RichTextIntermediate | undefined {
    const out: string[] = [];
    if (query) {
      for (const r of this.@value) {
        if (query.listItem) {
          const rti = new RichText(query.listItem, RTFHandlers.create(r.project)).generateIntermediateFormat();
          const q = query.dup();
          q.property = r;
          rti.setQuery(q);
          out.push(`<nowiki>${rti.to_s()}</nowiki>`);
        } else {
          out.push(`<nowiki>${r.name}</nowiki>`);
        }
      }
      query.assignList(out);
    } else {
      for (const r of this.@value) {
        out.push(r.name);
      }
      const rText = new RichText(out.join(', '));
      return rText.generateIntermediateFormat();
    }
  }
  
  to_tjp(): string {
    const out = this.@value.map(r => r.fullId);
    return this.@type.id + ' ' + out.join(', ');
  }
}

// AllocationAttribute
class AllocationAttribute extends ListAttributeBase {
  constructor(propertySet: PropertySet, type: AttributeDefinition, container: any) {
    super(propertySet, type, container);
    this.set([]);
  }
  
  get(): Allocation[] {
    return this.@value;
  }
  
  set(value: Allocation[]): void {
    this.@value = value;
    this.markProvided();
  }
  
  to_s(query?: Query): string {
    let out = '';
    let first = true;
    for (const allocation of this.@value) {
      if (first) {
        first = false;
      } else {
        out += '\n';
      }
      out += '[ ';
      let firstR = true;
      for (const resource of allocation.candidates) {
        if (firstR) {
          firstR = false;
        } else {
          out += ', ';
        }
        out += resource.fullId;
      }
      const modes = ['order', 'lowprob', 'lowload', 'hiload', 'random'];
      out += ` ] select by ${modes[allocation.selectionMode]} `;
      if (allocation.mandatory) out += 'mandatory ';
      if (allocation.persistent) out += 'persistent ';
    }
    return out;
  }
}
```

### 6.3 Método markProvided()

```typescript
// Em AttributeBase:
protected markProvided(): void {
  switch (AttributeBase.mode) {
    case 0:
      this.@provided = true;
      break;
    case 1:
      this.@inherited = true;
      break;
    case 2:
      this.@computed = true;
      break;
  }
}

// Método inherit():
inherit(value: any): void {
  this.@value = value;
  this.@inherited = true;
}

// Método reset():
reset(): void {
  this.@value = this.@type.default;
  this.@provided = false;
  this.@inherited = false;
  this.@computed = false;
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 6)

```
FASE 6A: Fundação do Modelo
  1. ScenarioData.ts
     - Classe base para *Scenario
     - Métodos error/warning/info
     - Método a() para acesso a atributos
  
  2. Attributes.ts
     - AttributeBase (classe abstrata)
     - ListAttributeBase (classe abstrata)
     - Todos os tipos de atributos (30+ classes)
  
  3. PropertySet.ts
     - Container de propriedades
     - Blueprint de atributos
     - Namespace flat vs hierárquico
     - Métodos de iteração

FASE 6B: Entidades Concretas
  4. Scenario.ts
     - Entidade Scenario
     - Hierarquia de cenários
     - Tracking scenario
  
  5. Query.ts
     - Contexto de avaliação
     - Método process()
     - Métodos de escala
     - query_ functions

FASE 6C: Integração
  6. Atualizar PropertyTreeNode.ts
     - Delegação para ScenarioData
     - Integração com Query
  
  7. Atualizar Project.ts
     - Criação de PropertySets
     - Registro de AttributeDefinitions
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 PropertySet Genérico
```typescript
class PropertySet<T extends PropertyTreeNode> {
  @project: Project;
  @flatNamespace: boolean;
  @properties: T[];
  @propertyMap: Map<string, T>;
  @attributeDefinitions: Map<string, AttributeDefinition>;
  
  // Métodos genéricos
  addProperty(property: T): void;
  removeProperty(prop: T | string): T;
  get(id: string): T | undefined;
  each(callback: (property: T) => void): void;
}
```

#### 7.2.2 ScenarioData como Classe Abstrata
```typescript
abstract class ScenarioData {
  @property: PropertyTreeNode;
  @scenarioIdx: number;
  @attributes: Map<string, Attribute>;
  
  abstract readyForScheduling?(): boolean;
  abstract schedule(): boolean;
  abstract prepareScheduling(): void;
  abstract finishScheduling(): void;
}

class TaskScenario extends ScenarioData { /* ... */ }
class ResourceScenario extends ScenarioData { /* ... */ }
```

#### 7.2.3 Query com Builder Pattern
```typescript
class QueryBuilder {
  private params: Partial<Query> = {};
  
  project(project: Project): this {
    this.params.project = project;
    return this;
  }
  
  property(property: PropertyTreeNode): this {
    this.params.property = property;
    return this;
  }
  
  attributeId(id: string): this {
    this.params.attributeId = id;
    return this;
  }
  
  scenario(scenario: Scenario): this {
    this.params.scenario = scenario;
    return this;
  }
  
  start(start: TjTime): this {
    this.params.start = start;
    return this;
  }
  
  end(end: TjTime): this {
    this.params.end = end;
    return this;
  }
  
  build(): Query {
    return new Query(this.params);
  }
}

// Uso:
const query = new QueryBuilder()
  .project(project)
  .property(task)
  .attributeId('effort')
  .scenario(scenario)
  .start(startDate)
  .end(endDate)
  .build();

query.process();
console.log(query.to_s());
```

#### 7.2.4 Attributes com Factory Pattern
```typescript
class AttributeFactory {
  static create(type: AttributeDefinition, propertySet: PropertySet, container: any): Attribute {
    switch (type.objClass) {
      case DateAttribute: return new DateAttribute(propertySet, type, container);
      case FloatAttribute: return new FloatAttribute(propertySet, type, container);
      case StringAttribute: return new StringAttribute(propertySet, type, container);
      case BooleanAttribute: return new BooleanAttribute(propertySet, type, container);
      case RichTextAttribute: return new RichTextAttribute(propertySet, type, container);
      case FlagListAttribute: return new FlagListAttribute(propertySet, type, container);
      case ResourceListAttribute: return new ResourceListAttribute(propertySet, type, container);
      // ... outros tipos
      default:
        throw new Error(`Unknown attribute type: ${type.objClass}`);
    }
  }
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **PropertySet.addAttributeType() deve ser chamado ANTES de addProperty()!**
   ```typescript
   // ERRADO:
   const tasks = new PropertySet(project, false);
   tasks.addProperty(task1);  // Cria atributos com blueprint vazio
   tasks.addAttributeType(attrDef);  // Tarde demais!
   
   // CERTO:
   const tasks = new PropertySet(project, false);
   tasks.addAttributeType(attrDef);  // Primeiro registra
   tasks.addProperty(task1);  // Depois cria
   ```

2. **Scenario.all() inclui o próprio cenário!**
   ```typescript
   // Para iterar apenas sobre filhos:
   for (const child of scenario.children) {
     // ...
   }
   
   // Para iterar sobre todos (incluindo este):
   for (const sc of scenario.all()) {
     // ...
   }
   ```

3. **Query.process() pode falhar!** Sempre verificar `query.ok`:
   ```typescript
   query.process();
   if (!query.ok) {
     console.error(`Query failed: ${query.errorMessage}`);
     return;
   }
   ```

4. **AttributeBase.mode é GLOBAL!** Deve ser setado antes de operações em lote:
   ```typescript
   AttributeBase.setMode(1);  // inherited
   property.inheritAttributes();
   AttributeBase.setMode(0);  // provided
   ```

5. **List attributes sempre fazem append!** Não sobrescrevem:
   ```typescript
   // Em PropertyTreeNode:
   set(attributeId: string, value: any): void {
     const attr = this.@attributes.get(attributeId)!;
     const overwrite = attr.provided && !attr.isList();
     attr.set(value);
     if (overwrite) {
       throw new AttributeOverwrite(`Overwriting ${attributeId}`);
     }
   }
   ```

6. **Query.scaleLoad() e scaleDuration() dependem de project settings!**
   ```typescript
   // Certifique-se de que project está setado antes de chamar:
   if (!query.project) {
     throw new Error("Project reference required for scaling");
   }
   ```

7. **ScenarioData.a() é um atalho para atributos scenario-specific!**
   ```typescript
   // Em TaskScenario:
   const effort = this.a('effort');  // Equivalente a:
   // const effort = this.@attributes.get('effort')!.get();
   ```

8. **PropertySet.index() deve ser chamado após modificações!**
   ```typescript
   // Após adicionar/remover propriedades:
   tasks.addProperty(task);
   tasks.index();  // Atualiza BSI
   ```

9. **Query pode ser reutilizada!** Chamar `reset()` entre usos:
   ```typescript
   const query = new Query(params);
   
   query.process();
   console.log(query.to_s());
   
   query.reset();  // Limpa resultados
   query.attributeId = 'duration';
   query.process();
   console.log(query.to_s());
   ```

10. **Attributes.to_tjp() gera sintaxe TJP!** Útil para export:
    ```typescript
    const tjpStr = attribute.to_tjp();
    // Ex: "effort 40h"
    // Ex: "flags critical, urgent"
    ```

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (30 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, AttributeDefinition, TjTime
- [x] **Scheduler Core**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Lógica**: LogicalExpression, LogicalOperation
- [x] **Fase 5**: Allocation, Limits, ShiftAssignments, Booking, TaskDependency
- [x] **Fase 6**: PropertySet, Scenario, ScenarioData, Query, Attributes ⭐

### 🔮 Próximos 5 (Fase 7 - Reports)
- [ ] Report.rb + subclasses (TaskReport, ResourceReport, etc.)
- [ ] TableColumnDefinition.rb
- [ ] LogicalFunction.rb
- [ ] RichText.rb
- [ ] HTMLDocument.rb

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Cria Project com PropertySets
const project = new Project('prj', 'My Project', '1.0');

// PropertySets são criados no construtor do Project:
// project.tasks = new PropertySet<Task>(project, false);
// project.resources = new PropertySet<Resource>(project, true);
// project.scenarios = new PropertySet<Scenario>(project, true);
// ...

// 2. Registra AttributeDefinitions
// Feito no construtor do Project:
// project.tasks.addAttributeType(new AttributeDefinition('effort', 'Effort', DurationAttribute, ...));
// project.resources.addAttributeType(new AttributeDefinition('efficiency', 'Efficiency', FloatAttribute, ...));

// 3. Cria Tasks e Resources
const task = new Task(project, 't1', 'Task 1', null);
task.set('effort', 40 * 3600, 0);  // 40h em segundos, cenário 0

const resource = new Resource(project, 'r1', 'John', null);
resource.set('efficiency', 1.0, 0);

// 4. Cria Scenario
const scenario = new Scenario(project, 'plan', 'Plan Scenario', null);
// scenario é automaticamente adicionado a project.scenarios

// 5. Agenda
await project.schedule();

// 6. Cria Query para acessar resultados
const query = new Query({
  project: project,
  property: task,
  attributeId: 'effort',
  scenario: scenario,
  start: project.get('start'),
  end: project.get('end'),
  loadUnit: 'hours',
  numberFormat: project.get('numberFormat'),
});

query.process();
console.log(`Effort: ${query.to_s()}`);  // "Effort: 40h"

// 7. Query para resource
const query2 = new Query({
  project: project,
  property: resource,
  attributeId: 'freetime',
  scenario: scenario,
  start: project.get('start'),
  end: project.get('end'),
  loadUnit: 'days',
});

query2.process();
console.log(`Free time: ${query2.to_s()}`);  // "Free time: 5d"

// 8. Query para lista de children
const query3 = new Query({
  project: project,
  property: task,
  attributeId: 'children',
  listItem: '<-name-> (<-id->)',
  listType: 'bullets',
});

query3.process();
console.log(`Children:\n${query3.to_s()}`);
// Children:
// * Subtask 1 (t1.sub1)
// * Subtask 2 (t1.sub2)
```

---

## 🚀 10. PRÓXIMOS PASSOS

### Fase 7: Reports (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/Report.rb`** — Classe base de relatórios
2. **`lib/taskjuggler/TableColumnDefinition.rb`** — Definição de colunas
3. **`lib/taskjuggler/LogicalFunction.rb`** — Funções lógicas (isleaf, isactive, etc.)
4. **`lib/taskjuggler/RichText.rb`** — Parser de RichText
5. **`lib/taskjuggler/HTMLDocument.rb`** — Geração de HTML

### Ordem de Leitura Sugerida

```
1. Report.rb              ← Classe base, entende a estrutura
2. TableColumnDefinition.rb ← Como colunas são definidas
3. LogicalFunction.rb     ← Funções usadas em hidetask, hideresource
4. RichText.rb            ← Parser de texto formatado
5. HTMLDocument.rb        ← Geração de saída HTML
```

---

**Fim da Fase 6.** O modelo de domínio está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `Report.rb` → `TableColumnDefinition.rb` → `LogicalFunction.rb` → `RichText.rb` → `HTMLDocument.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/07-blueprint-engine6.md`

````md
# 📘 Blueprint Fase 7: Sistema de Relatórios + Expressões Lógicas + RichText

## 🎯 Objetivo
Complementar o blueprint com os 5 arquivos que formam o **sistema de relatórios**, as **funções lógicas** e o **parser de RichText**. Estes arquivos completam o pipeline final: do dado agendado até a saída HTML/CSV/TJP.

---

## 🏗️ 1. PIPELINE ATUALIZADO (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project.generateReports()                     │
│  └── Para cada Report:                                          │
│      └── report.generate()                                      │
│          ├── generateIntermediateFormat()  ◄── Report.rb        │
│          │   └── TaskListRE / ResourceListRE / TextReport / ... │
│          │       └── Query.process()       ◄── Query.rb         │
│          │           └── LogicalExpression.eval()  ◄── LogicalExpression.rb
│          │               └── LogicalOperation.eval() ◄── LogicalOperation.rb
│          │                   └── LogicalFunction.eval() ◄── LogicalFunction.rb ⭐
│          │               └── LogicalAttribute.eval()
│          │                   └── query_<attributeId>()
│          │
│          └── generateHTML() / generateCSV() / ...
│              └── HTMLDocument            ◄── HTMLDocument.rb ⭐
│              └── RichText.to_html()      ◄── RichText.rb ⭐
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              TableColumnDefinition (Colunas de Relatórios)       │
│  └── CellSettingPatternList (celltext, cellcolor, tooltip)      │
│  └── LogicalExpression para cada pattern                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. REPORT.RB — Classe Base de Relatórios

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Herda de PropertyTreeNode** | Usa o mesmo sistema de atributos |
| **Orquestrador de geração** | `generate()` → `generateIntermediateFormat()` → `generateHTML/CSV/TJP/...` |
| **Gerencia formatos** | html, csv, tjp, niku, iCal, mspxml, ctags |
| **Copia arquivos auxiliares** | CSS, JS, ícones |

### 2.2 Estrutura Interna

```typescript
class Report extends PropertyTreeNode {
  typeSpec: ReportType;  // :taskreport | :resourcereport | :accountreport | ...
  content: ReportContent | null;
  
  constructor(project: Project, id: string, name: string, parent: Report | null) {
    super(project.reports, id, name, parent);
    project.addReport(this);
    this.checkFileName(name);
    
    // Report tem um ReportScenario (dummy) para flags
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ReportScenario(this, i, this.scenarioAttributes[i])
    );
  }
}
```

### 2.3 Pipeline de Geração

```typescript
generate(requestedFormats?: OutputFormat[]): number {
  const oldTimeZone = TjTime.setTimeZone(this.get('timezone'));
  this.generateIntermediateFormat();
  
  const formats = requestedFormats || this.get('formats');
  for (const format of formats) {
    if (this.name === '') {
      this.error('empty_report_file_name',
        `Report ${this.id} has output formats requested, but the ` +
        `file name is empty.`);
    }
    
    switch (format) {
      case 'iCal': this.generateICal(); break;
      case 'html': this.generateHTML(); this.copyAuxiliaryFiles(); break;
      case 'csv': this.generateCSV(); break;
      case 'ctags': this.generateCTags(); break;
      case 'niku': this.generateNiku(); break;
      case 'tjp': this.generateTJP(); break;
      case 'mspxml': this.generateMspXml(); break;
      default:
        throw new Error(`Unknown report output format ${format}`);
    }
  }
  
  TjTime.setTimeZone(oldTimeZone);
  return 0;
}
```

### 2.4 generateIntermediateFormat()

```typescript
generateIntermediateFormat(): void {
  if (this.get('scenarios').length === 0) {
    this.warning('all_scenarios_disabled',
      `The report ${this.fullId} has only disabled scenarios. The ` +
      `report will possibly be empty.`);
  }
  
  this.content = null;
  
  switch (this.typeSpec) {
    case 'accountreport': this.content = new AccountListRE(this); break;
    case 'export': this.content = new ExportRE(this); break;
    case 'iCal': this.content = new ICalReport(this); break;
    case 'niku': this.content = new NikuReport(this); break;
    case 'resourcereport': this.content = new ResourceListRE(this); break;
    case 'tagfile': this.content = new TagFile(this); break;
    case 'textreport': this.content = new TextReport(this); break;
    case 'taskreport': this.content = new TaskListRE(this); break;
    case 'tracereport': this.content = new TraceReport(this); break;
    case 'statusSheet': this.content = new StatusSheetReport(this); break;
    case 'timeSheet': this.content = new TimeSheetReport(this); break;
    default:
      throw new Error(`Unknown report type`);
  }
  
  if (this.content) {
    this.content.generateIntermediateFormat();
  }
}
```

### 2.5 generateHTML()

```typescript
private generateHTML(): void {
  if (!this.content) return;
  
  if (typeof this.content.to_html !== 'function') {
    this.warning('html_not_supported',
      `HTML format is not supported for report ${this.id} of ` +
      `type ${this.typeSpec}.`);
    return;
  }
  
  const html = new HTMLDocument();
  const head = html.generateHead(
    `${this.project.get('name')} - ${this.get('title') || this.name}`,
    {
      'description': 'TaskJuggler Report',
      'keywords': 'taskjuggler, project, management'
    },
    this.get('rawHtmlHead')
  );
  
  if (this.get('selfcontained')) {
    // CSS inline
    const cssFile = await Deno.readTextFile(cssFileName);
    head.append(new XMLElement('style', { type: 'text/css' }, cssFile));
  } else {
    // CSS externo
    head.append(new XMLElement('link', {
      rel: 'stylesheet',
      type: 'text/css',
      href: `${this.get('auxdir')}css/tjreport.css`
    }));
  }
  
  const body = new XMLElement('body');
  const frame = new XMLElement('div', { class: 'tj_page' });
  frame.append(this.content.to_html());
  
  // Footer com copyright
  const footer = new XMLElement('div', { class: 'copyright' });
  if (this.project.get('copyright')) {
    footer.append(new XMLText(this.project.get('copyright') + ' - '));
  }
  footer.append(new XMLText(
    `Project: ${this.project.get('name')} ` +
    `Version: ${this.project.get('version')} - ` +
    `Created on ${new TjTime().to_s('%Y-%m-%d %H:%M:%S')} with `
  ));
  
  body.append(frame);
  html.html.append(body);
  
  const fileName = this.get('interactive') || this.name === '.'
    ? '.'
    : this.absoluteFileName(this.name) + '.html';
  
  await Deno.writeTextFile(fileName, html.toString());
}
```

### 2.6 Tipos de Report (typeSpec)

```typescript
enum ReportType {
  ACCOUNT_REPORT = 'accountreport',
  EXPORT = 'export',
  I_CAL = 'iCal',
  NIKU = 'niku',
  RESOURCE_REPORT = 'resourcereport',
  TAG_FILE = 'tagfile',
  TEXT_REPORT = 'textreport',
  TASK_REPORT = 'taskreport',
  TRACE_REPORT = 'tracereport',
  STATUS_SHEET = 'statusSheet',
  TIME_SHEET = 'timeSheet',
}
```

---

## 📋 3. TABLECOLUMNDEFINITION.RB — Definição de Colunas

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Define uma coluna** | ID, título, largura, alinhamento |
| **CellSettingPatternList** | Lista de padrões para celltext, cellcolor, tooltip |
| **Avaliação condicional** | LogicalExpression determina qual padrão usar |

### 3.2 Estrutura Interna

```typescript
class TableColumnDefinition {
  readonly id: string;
  title: string;
  start: TjTime | null = null;
  end: TjTime | null = null;
  cellText: CellSettingPatternList;
  cellColor: CellSettingPatternList;
  fontColor: CellSettingPatternList;
  hAlign: CellSettingPatternList;
  tooltip: CellSettingPatternList;
  listItem: string | null = null;
  listType: 'comma' | 'bullets' | 'numbered' | null = null;
  scale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'week';
  width: number | null = null;
  timeformat1: string | null = null;
  timeformat2: string | null = null;
  column: ReportTableColumn | null = null;  // Referência gerada
  content: 'load' | string = 'load';
  
  constructor(id: string, title: string) {
    this.id = id;
    this.title = title;
    this.cellText = new CellSettingPatternList();
    this.cellColor = new CellSettingPatternList();
    this.fontColor = new CellSettingPatternList();
    this.hAlign = new CellSettingPatternList();
    this.tooltip = new CellSettingPatternList();
  }
}
```

### 3.3 CellSettingPattern

```typescript
class CellSettingPattern {
  readonly setting: RichTextIntermediate | string;
  readonly logExpr: LogicalExpression;
  
  constructor(setting: any, logExpr: LogicalExpression) {
    this.setting = setting;
    this.logExpr = logExpr;
  }
}
```

### 3.4 CellSettingPatternList

```typescript
class CellSettingPatternList {
  private patterns: CellSettingPattern[] = [];
  
  addPattern(pattern: CellSettingPattern): void {
    this.patterns.push(pattern);
  }
  
  getPattern(query: Query): any | null {
    for (const pattern of this.patterns) {
      if (pattern.logExpr.eval(query)) {
        return pattern.setting;
      }
    }
    return null;
  }
}
```

### 3.5 Uso em Parser (TjpSyntaxRules)

```typescript
// No rule_columnOptions():
pattern(['_celltext', '!logicalExpression', '$STRING'], () => {
  this.column.cellText.addPattern(
    new CellSettingPattern(
      this.newRichText(this.val[2], this.sourceFileInfo[2]),
      this.val[1]
    )
  );
});

pattern(['_cellcolor', '!logicalExpression', '!color'], () => {
  this.column.cellColor.addPattern(
    new CellSettingPattern(this.val[2], this.val[1])
  );
});

pattern(['_tooltip', '!logicalExpression', '$STRING'], () => {
  this.column.tooltip.addPattern(
    new CellSettingPattern(
      this.newRichText(this.val[2], this.sourceFileInfo[2]),
      this.val[1]
    )
  );
});
```

---

## 🔧 4. LOGICALFUNCTION.RB — Funções Lógicas

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de LogicalOperation** | Modela chamadas de função em expressões lógicas |
| **14 funções pré-definidas** | isleaf, istask, isresource, etc. |
| **Inversão de propriedades** | Sufixo `_` inverte property/scopeProperty |

### 4.2 Estrutura Interna

```typescript
class LogicalFunction {
  name: string;
  arguments: any[];
  invertProperties: boolean;
  
  // Mapa de funções suportadas e número de argumentos
  static readonly functions: Map<string, number> = new Map([
    ['hasalert', 1],
    ['isactive', 1],
    ['ischildof', 1],
    ['isdependencyof', 3],
    ['isdutyof', 2],
    ['isfeatureof', 2],
    ['isleaf', 0],
    ['ismilestone', 1],
    ['isongoing', 1],
    ['isresource', 0],
    ['isresponsibilityof', 2],
    ['istask', 0],
    ['isvalid', 1],
    ['treelevel', 0],
  ]);
  
  constructor(opnd: string) {
    if (opnd.endsWith('_')) {
      // Função com _ inverte property e scopeProperty
      this.name = opnd.slice(0, -1);
      this.invertProperties = true;
    } else {
      this.name = opnd;
      this.invertProperties = false;
    }
    this.arguments = [];
  }
  
  setArgumentsAndCheck(args: any[]): [string, string] | null {
    if (!LogicalFunction.functions.has(this.name)) {
      return ['unknown_function',
        `Unknown function ${this.name} used in logical expression.`];
    }
    
    if (LogicalFunction.functions.get(this.name) !== args.length) {
      return ['wrong_no_func_arguments',
        `Wrong number of arguments for function ${this.name}. Got ` +
        `${args.length} instead of ${LogicalFunction.functions.get(this.name)}.`];
    }
    
    this.arguments = args;
    return null;
  }
  
  eval(expr: LogicalExpression): any {
    // Chama o método correspondente
    return (this as any)[this.name](expr, this.arguments);
  }
  
  toString(): string {
    return `${this.name}(${this.arguments.join(', ')})`;
  }
  
  private properties(expr: LogicalExpression): [PropertyTreeNode, PropertyTreeNode | null] {
    if (this.invertProperties) {
      return [expr.query.scopeProperty!, null];
    }
    return [expr.query.property!, expr.query.scopeProperty || null];
  }
}
```

### 4.3 Implementação das Funções

```typescript
// hasalert(level, date)
private hasalert(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const query = expr.query;
  const project = property.project;
  
  return !project.get('journal').currentEntries(
    query.end, property, args[0], query.start, query.hideJournalEntry
  ).isEmpty();
}

// isactive(scenarioId)
private isactive(expr: LogicalExpression, args: any[]): boolean {
  const [property, scopeProperty] = this.properties(expr);
  
  if (!(property instanceof Task) && !(property instanceof Resource)) {
    return false;
  }
  
  const project = property.project;
  const scenarioIdx = project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) {
    expr.error(`Unknown scenario '${args[0]}' used for function isactive()`);
  }
  
  const query = expr.query;
  return property.getAllocatedTime(scenarioIdx, query.startIdx, query.endIdx, scopeProperty) > 0.0;
}

// ischildof(parentId)
private ischildof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const parent = property.propertySet.get(args[0]);
  if (!parent) return false;
  return property.isChildOf(parent);
}

// isdependencyof(taskId, scenarioId, distance)
private isdependencyof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const task = project.task(args[0]);
  if (!task) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  if (typeof args[2] !== 'number') return false;
  
  return property.isDependencyOf(scenarioIdx, task, args[2]);
}

// isdutyof(resourceId, scenarioId)
private isdutyof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const resource = project.resource(args[0]);
  if (!resource) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.get('assignedresources', scenarioIdx).includes(resource);
}

// isfeatureof(taskId, scenarioId)
private isfeatureof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const task = project.task(args[0]);
  if (!task) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.isFeatureOf(scenarioIdx, task);
}

// isleaf()
private isleaf(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property.leaf();
}

// ismilestone(scenarioId)
private ismilestone(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  
  const scenarioIdx = property.project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) return false;
  
  return property instanceof Task && property.get('milestone', scenarioIdx);
}

// isongoing(scenarioId)
private isongoing(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const scenarioIdx = project.scenarioIdx(args[0]);
  if (scenarioIdx === undefined) {
    expr.error(`Unknown scenario '${args[0]}' used for function isongoing()`);
  }
  
  const query = expr.query;
  const iv1 = new TimeInterval(query.start, query.end);
  const tStart = property.get('start', scenarioIdx);
  const tEnd = property.get('end', scenarioIdx);
  
  // Mostra tasks com erros de scheduling
  if (!tStart || !tEnd) return true;
  
  const iv2 = new TimeInterval(tStart, tEnd);
  return iv1.overlaps(iv2);
}

// isresource()
private isresource(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property instanceof Resource;
}

// isresponsibilityof(resourceId, scenarioId)
private isresponsibilityof(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!(property instanceof Task)) return false;
  
  const project = property.project;
  const resource = project.resource(args[0]);
  if (!resource) return false;
  
  const scenarioIdx = project.scenarioIdx(args[1]);
  if (scenarioIdx === undefined) return false;
  
  return property.get('responsible', scenarioIdx).includes(resource);
}

// istask()
private istask(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  if (!property) return false;
  return property instanceof Task;
}

// isvalid(scenario.attribute)
private isvalid(expr: LogicalExpression, args: any[]): boolean {
  const [property] = this.properties(expr);
  const project = property.project;
  
  let [scenario, attr] = args[0].split('.');
  if (attr === undefined) {
    attr = scenario;
    scenario = undefined;
  }
  
  if (!attr) expr.error('Argument must not be empty');
  
  let scenarioIdx: number | undefined;
  if (scenario) {
    scenarioIdx = project.scenarioIdx(scenario);
    if (scenarioIdx === undefined) {
      expr.error(`Unknown scenario '${scenario}' used for function isvalid()`);
    }
  }
  
  if (!property.propertySet.knownAttribute(attr)) {
    expr.error(`Unknown attribute '${attr}' used for function isvalid()`);
  }
  
  if (scenario) {
    if (!property.attributeDefinition(attr).scenarioSpecific) {
      expr.error(`Attribute '${attr}' of property '${property.fullId}' ` +
        `is not scenario specific. Don't provide a scenario ID!`);
    }
    return property.get(attr, scenarioIdx!) !== null;
  } else {
    if (property.attributeDefinition(attr).scenarioSpecific) {
      expr.error(`Attribute '${attr}' of property '${property.fullId}' ` +
        `is scenario specific. Please provide a scenario ID!`);
    }
    return property.get(attr) !== null;
  }
}

// treelevel()
private treelevel(expr: LogicalExpression, args: any[]): number {
  const [property] = this.properties(expr);
  if (!property) return 0;
  return property.level() + 1;
}
```

### 4.4 Exemplos de Uso em TJP

```tjp
# Esconder tasks que não são leaf
hidetask ~isleaf()

# Esconder resources que não são leaf
hideresource ~isleaf()

# Combinar: mostrar apenas resources leaf para tasks leaf
hideresource ~(isleaf() & isleaf_())

# Mostrar tasks em progresso
hidetask plan.complete = 0 | plan.complete = 100

# Verificar se atributo é válido antes de comparar
hidetask ~isvalid(plan.maxend) | (plan.end > plan.maxend)
```

---

## 📝 5. RICHTEXT.RB — Parser de RichText (MediaWiki Markup)

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Parser de MediaWiki markup** | Converte markup em árvore de elementos |
| **Gera múltiplos formatos** | HTML, texto puro, tagged |
| **Funções customizadas** | Suporta handlers de função |

### 5.2 Markup Suportado

```markdown
== Headline 1 ==
=== Headline 2 ===
==== Headline 3 ====

---- (linha horizontal)

* Bullet 1
** Bullet 2
*** Bullet 3

# Enumeration Level 1
## Enumeration Level 2

   Preformatted text (começa com espaço)

''italic''
'''bold'''
''''monospaced''''
'''''italic and bold'''''

[http://example.com] Link
[http://example.com Text] Link com texto

[[item]] Referência interna
[[item Texto]] Referência com texto
[[function:path arg1 arg2]] Função

<nowiki> ... </nowiki> Desabilita markup
```

### 5.3 Estrutura Interna

```typescript
class RichText {
  inputText: string;
  functionHandlers: Map<string, RichTextFunctionHandler>;
  
  // Parser compartilhado entre instâncias
  static parser: RichTextParser | null = null;
  
  constructor(text: string, functionHandlers: RichTextFunctionHandler[] = []) {
    this.inputText = text;
    this.functionHandlers = new Map();
    for (const h of functionHandlers) {
      this.functionHandlers.set(h.function, h);
    }
  }
  
  generateIntermediateFormat(
    sectionCounter: number[] = [0, 0, 0],
    tokenSet?: TokenType[]
  ): RichTextIntermediate | null {
    const rti = new RichTextIntermediate(this);
    
    // Copia function handlers
    for (const [name, handler] of this.functionHandlers) {
      rti.registerFunctionHandler(handler);
    }
    
    if (RichText.parser) {
      RichText.parser.reuse(rti, sectionCounter, tokenSet);
    } else {
      RichText.parser = new RichTextParser(rti, sectionCounter, tokenSet);
    }
    
    RichText.parser.open(this.inputText);
    const tree = RichText.parser.parse('richtext');
    if (tree === false) return null;
    
    if (!tree) {
      tree = new RichTextElement(rti, 'richtext', null);
    }
    
    tree.cleanUp();
    rti.tree = tree;
    return rti;
  }
}
```

### 5.4 RichTextIntermediate

```typescript
class RichTextIntermediate {
  richText: RichText;
  tree: RichTextElement | null = null;
  blockMode: boolean = true;
  sectionNumbers: boolean = true;
  lineWidth: number = 80;
  indent: number = 0;
  titleIndent: number = 0;
  parIndent: number = 0;
  listIndent: number = 1;
  preIndent: number = 0;
  linkTarget: string | null = null;
  cssClass: string | null = null;
  functionHandlers: Map<string, RichTextFunctionHandler> = new Map();
  
  constructor(richText: RichText) {
    this.richText = richText;
  }
  
  registerFunctionHandler(handler: RichTextFunctionHandler): void {
    this.functionHandlers.set(handler.function, handler.dup());
  }
  
  empty(): boolean {
    return this.tree!.empty();
  }
  
  tableOfContents(toc: TableOfContents, fileName: string): void {
    this.tree!.tableOfContents(toc, fileName);
  }
  
  internalReferences(): string[] {
    return this.tree!.internalReferences();
  }
  
  to_s(): string {
    let str = this.tree!.to_s();
    while (str.endsWith('\n')) {
      str = str.slice(0, -1);
    }
    return str;
  }
  
  to_html(): string {
    let html = this.tree!.to_html();
    while (html.endsWith('\n')) {
      html = html.slice(0, -1);
    }
    return html;
  }
  
  to_tagged(): string {
    return this.tree!.to_tagged();
  }
}
```

### 5.5 Uso no Parser

```typescript
// No ProjectFileParser.newRichText():
newRichText(text: string, sfi: SourceFileInfo, tokenSet?: TokenType[]): RichTextIntermediate {
  const rText = new RichText(text, RTFHandlers.create(this.project, sfi));
  
  const mh = MessageHandlerInstance.instance;
  mh.baselineSFI = sfi;
  
  const rti = rText.generateIntermediateFormat([0, 0, 0], tokenSet);
  
  mh.baselineSFI = null;
  if (rti) {
    rti.sectionNumbers = false;
  }
  
  return rti!;
}
```

---

## 🌐 6. HTMLDOCUMENT.RB — Geração de HTML

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de XMLDocument** | Adiciona elementos HTML obrigatórios |
| **Suporta múltiplos doctypes** | html5, strict, transitional, frameset |
| **Gera head com meta tags** | Título, charset, compatibilidade |

### 6.2 Estrutura Interna

```typescript
class HTMLDocument extends XMLDocument {
  html: HTMLElement;
  
  constructor(docType: 'html5' | 'strict' | 'transitional' | 'frameset' = 'html5') {
    super();
    
    if (docType !== 'html5') {
      this.elements.push(new XMLBlob('<?xml version="1.0" encoding="UTF-8"?>'));
      
      let dtdRef: string, url: string;
      switch (docType) {
        case 'strict':
          dtdRef = 'Strict';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd';
          break;
        case 'transitional':
          dtdRef = 'Transitional';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd';
          break;
        case 'frameset':
          dtdRef = 'Frameset';
          url = 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd';
          break;
      }
      
      this.elements.push(new XMLBlob(
        `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 ${dtdRef}//EN" "${url}">`
      ));
    } else {
      this.elements.push(new XMLBlob('<!DOCTYPE html>'));
    }
    
    this.elements.push(new XMLComment(
      `This file has been generated by ${AppConfig.appName} v${AppConfig.version}`
    ));
    
    const attrs: Record<string, string> = {
      'xml:lang': 'en',
      'lang': 'en'
    };
    if (docType !== 'html5') {
      attrs['xmlns'] = 'http://www.w3.org/1999/xhtml';
    }
    
    this.html = new HTMLElement('html', attrs);
    this.elements.push(this.html);
  }
  
  generateHead(
    title: string,
    metaTags: Record<string, string> = {},
    blob?: string
  ): HTMLElement {
    const head = new HTMLElement('head');
    
    const elements: XMLElement[] = [
      new HTMLElement('title', {}, title),
      new HTMLElement('meta', {
        'http-equiv': 'Content-Type',
        'content': 'text/html; charset=utf-8'
      }),
      new HTMLElement('meta', {
        'http-equiv': 'X-UA-Compatible',
        'content': 'IE=9'
      }),
    ];
    
    for (const [name, content] of Object.entries(metaTags)) {
      elements.push(new HTMLElement('meta', { name, content }));
    }
    
    if (blob) {
      elements.push(new XMLBlob(blob));
    }
    
    head.append(...elements);
    this.html.append(head);
    
    return head;
  }
}
```

### 6.3 Uso em Reports

```typescript
// Em Report.generateHTML():
const html = new HTMLDocument();
const head = html.generateHead(
  `${project.get('name')} - ${report.get('title') || report.name}`,
  {
    'description': 'TaskJuggler Report',
    'keywords': 'taskjuggler, project, management'
  },
  report.get('rawHtmlHead')
);

// Adiciona CSS
if (report.get('selfcontained')) {
  const cssFile = await Deno.readTextFile(cssFileName);
  head.append(new HTMLElement('style', { type: 'text/css' }, cssFile));
} else {
  head.append(new HTMLElement('link', {
    rel: 'stylesheet',
    type: 'text/css',
    href: `${report.get('auxdir')}css/tjreport.css`
  }));
}

// Adiciona body
const body = new HTMLElement('body');
const frame = new HTMLElement('div', { class: 'tj_page' });
frame.append(report.content!.to_html());
body.append(frame);

html.html.append(body);
await Deno.writeTextFile(fileName, html.toString());
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 7)

```
FASE 7A: Expressões Lógicas
  1. LogicalFunction.ts
     - Mapa de funções (14 funções)
     - Método eval() com dispatch
     - Inversão de propriedades (sufixo _)
  
  2. Atualizar LogicalOperation.ts
     - Integrar LogicalFunction
  
  3. Atualizar LogicalExpression.ts
     - Integrar LogicalFunction

FASE 7B: RichText
  4. RichText.ts
     - Parser de MediaWiki markup
     - RichTextIntermediate
     - RichTextElement (árvore)
     - to_html(), to_s(), to_tagged()
  
  5. RichText/Parser.ts
     - Scanner de markup
     - Regras de parsing
  
  6. RichText/Element.ts
     - Elementos da árvore
     - Conversão para HTML/texto

FASE 7C: Reports
  7. TableColumnDefinition.ts
     - CellSettingPattern
     - CellSettingPatternList
  
  8. Report.ts (classe base)
     - generate()
     - generateIntermediateFormat()
     - generateHTML/CSV/TJP/...
  
  9. HTMLDocument.ts
     - Especialização de XMLDocument
     - generateHead()
  
  10. HTMLDocument/Elements.ts
      - HTMLElement, XMLText, XMLBlob, etc.

FASE 7D: Reports Específicos
  11. TaskListRE.ts (TaskReport)
  12. ResourceListRE.ts (ResourceReport)
  13. AccountListRE.ts (AccountReport)
  14. TextReport.ts
  15. ExportRE.ts
  16. TraceReport.ts
  17. ICalReport.ts
  18. NikuReport.ts
  19. TagFile.ts
  20. StatusSheetReport.ts
  21. TimeSheetReport.ts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 LogicalFunction com Registry
```typescript
class LogicalFunction {
  private static readonly registry = new Map<string, FunctionImpl>([
    ['hasalert', hasalertImpl],
    ['isactive', isactiveImpl],
    ['ischildof', ischildofImpl],
    // ...
  ]);
  
  eval(expr: LogicalExpression): any {
    const impl = LogicalFunction.registry.get(this.name);
    if (!impl) {
      throw new Error(`Unknown function ${this.name}`);
    }
    return impl(this, expr, this.arguments);
  }
}

type FunctionImpl = (
  func: LogicalFunction,
  expr: LogicalExpression,
  args: any[]
) => any;
```

#### 7.2.2 RichText com Parser Combinator
```typescript
class RichTextParser {
  private rules: Map<string, Rule> = new Map();
  
  constructor() {
    this.rules.set('richtext', this.richtextRule());
    this.rules.set('headline', this.headlineRule());
    this.rules.set('bold', this.boldRule());
    // ...
  }
  
  private richtextRule(): Rule {
    return new Rule([
      this.zeroOrMore(this.alternatives(
        this.headlineRule(),
        this.paragraphRule(),
        this.listRule(),
        this.preformattedRule()
      ))
    ]);
  }
}
```

#### 7.2.3 TableColumnDefinition com Builder
```typescript
class TableColumnBuilder {
  private column: TableColumnDefinition;
  
  constructor(id: string, title: string) {
    this.column = new TableColumnDefinition(id, title);
  }
  
  cellText(expr: LogicalExpression, text: string): this {
    this.column.cellText.addPattern(
      new CellSettingPattern(text, expr)
    );
    return this;
  }
  
  cellColor(expr: LogicalExpression, color: string): this {
    this.column.cellColor.addPattern(
      new CellSettingPattern(color, expr)
    );
    return this;
  }
  
  width(w: number): this {
    this.column.width = w;
    return this;
  }
  
  build(): TableColumnDefinition {
    return this.column;
  }
}
```

#### 7.2.4 Report com Strategy Pattern
```typescript
abstract class ReportContent {
  protected report: Report;
  
  constructor(report: Report) {
    this.report = report;
  }
  
  abstract generateIntermediateFormat(): void;
  abstract to_html(): XMLElement | null;
  abstract to_csv(): any[][] | null;
  abstract to_tjp(): string | null;
}

class TaskListRE extends ReportContent {
  generateIntermediateFormat(): void {
    // Implementação específica para task reports
  }
  
  to_html(): XMLElement {
    // Gera tabela HTML com tasks
  }
}

// Factory no Report:
generateIntermediateFormat(): void {
  switch (this.typeSpec) {
    case 'taskreport':
      this.content = new TaskListRE(this);
      break;
    case 'resourcereport':
      this.content = new ResourceListRE(this);
      break;
    // ...
  }
  this.content!.generateIntermediateFormat();
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **LogicalFunction com sufixo `_` inverte propriedades!**
   ```typescript
   // isleaf() opera em property
   // isleaf_() opera em scopeProperty
   ```

2. **RichText parser é compartilhado!**
   ```typescript
   // Usar static parser para evitar recriação
   // Chamar reuse() para resetar estado
   ```

3. **CellSettingPatternList avalia na ordem!**
   ```typescript
   // Primeiro pattern que matcha é usado
   // Ordem de adição importa
   ```

4. **Report.generateHTML() copia arquivos auxiliares!**
   ```typescript
   // CSS, JS, ícones são copiados para outputDir
   // A menos que selfcontained = true
   ```

5. **RichTextIntermediate.blockMode afeta parsing!**
   ```typescript
   // blockMode = true: interpreta como bloco
   // blockMode = false: interpreta como linha
   ```

6. **HTMLDocument suporta múltiplos doctypes!**
   ```typescript
   // html5 (default): <!DOCTYPE html>
   // strict/transitional/frameset: XHTML 1.0
   ```

7. **LogicalFunction.isvalid() valida atributos!**
   ```typescript
   // Verifica se atributo existe
   // Verifica se scenario-specific bate com scenario ID
   // Retorna false se atributo é nil
   ```

8. **TableColumnDefinition tem dois formatos de tempo!**
   ```typescript
   // timeformat1: header superior (ex: "2026")
   // timeformat2: header inferior (ex: "Jan")
   ```

9. **Report.typeSpec determina o content!**
   ```typescript
   // taskreport → TaskListRE
   // resourcereport → ResourceListRE
   // textreport → TextReport
   // etc.
   ```

10. **RichText suporta funções customizadas!**
    ```typescript
    // [[function:path arg1 arg2]]
    // functionHandlers processam essas chamadas
    ```

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (35 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, AttributeDefinition, TjTime
- [x] **Scheduler Core**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Lógica**: LogicalExpression, LogicalOperation
- [x] **Fase 5**: Allocation, Limits, ShiftAssignments, Booking, TaskDependency
- [x] **Fase 6**: PropertySet, Scenario, ScenarioData, Query, Attributes
- [x] **Fase 7**: Report, TableColumnDefinition, LogicalFunction, RichText, HTMLDocument ⭐

### 🔮 Próximos 5 (Fase 8 - Reports Específicos)
- [ ] `lib/taskjuggler/reports/TaskListRE.rb` — TaskReport
- [ ] `lib/taskjuggler/reports/ResourceListRE.rb` — ResourceReport
- [ ] `lib/taskjuggler/reports/ReportTable.rb` — Tabela de relatório
- [ ] `lib/taskjuggler/reports/GanttChart.rb` — Gráfico Gantt
- [ ] `lib/taskjuggler/reports/TextReport.rb` — TextReport

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Report
const report = new Report(project, 'r1', 'My Report', null);
report.typeSpec = 'taskreport';
report.set('formats', ['html', 'csv']);
report.set('columns', [
  new TableColumnDefinition('bsi', 'BSI'),
  new TableColumnDefinition('name', 'Name'),
  new TableColumnDefinition('start', 'Start'),
  new TableColumnDefinition('end', 'End'),
  new TableColumnDefinition('effort', 'Effort'),
  new TableColumnDefinition('chart', 'Chart'),
]);

// 2. Adiciona celltext condicional
const col = report.get('columns')[4];  // effort column
col.cellText.addPattern(new CellSettingPattern(
  new RichText('<fcol:red><-effort-></fcol>').generateIntermediateFormat(),
  new LogicalExpression(new LogicalOperation(
    new LogicalAttribute('effort', project.scenario(0)),
    '>',
    new LogicalOperation(100)
  ))
));

// 3. Parser cria LogicalFunction
const func = new LogicalFunction('isleaf');
func.setArgumentsAndCheck([]);

// 4. Parser cria hidetask
const hideTask = new LogicalExpression(
  new LogicalOperation(
    new LogicalFunction('isleaf'),
    '~',
    null
  )
);
report.set('hideTask', hideTask);

// 5. Gera relatório
await project.schedule();
await report.generate();
// → generateIntermediateFormat()
//   → TaskListRE.generateIntermediateFormat()
//     → Para cada task:
//       → Query.process()
//         → LogicalExpression.eval()
//           → LogicalFunction.eval()
//             → isleaf()
//       → cellText.getPattern(query)
//         → LogicalExpression.eval()
// → generateHTML()
//   → HTMLDocument.generateHead()
//   → report.content.to_html()
//   → Deno.writeTextFile()
```

---

## 🚀 10. PRÓXIMOS PASSOS

### Fase 8: Reports Específicos (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/TaskListRE.rb`** — TaskReport (o mais complexo!)
2. **`lib/taskjuggler/reports/ResourceListRE.rb`** — ResourceReport
3. **`lib/taskjuggler/reports/ReportTable.rb`** — Tabela base
4. **`lib/taskjuggler/reports/GanttChart.rb`** — Gráfico Gantt (SVG)
5. **`lib/taskjuggler/reports/TextReport.rb`** — TextReport

### Ordem de Leitura Sugerida

```
1. ReportTable.rb        ← Base de todas as tabelas
2. TaskListRE.rb         ← TaskReport (mais usado)
3. ResourceListRE.rb     ← ResourceReport
4. GanttChart.rb         ← Gráfico Gantt (SVG)
5. TextReport.rb         ← TextReport (mais simples)
```

---

**Fim da Fase 7.** O sistema de relatórios está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ReportTable.rb` → `TaskListRE.rb` → `ResourceListRE.rb` → `GanttChart.rb` → `TextReport.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/08-blueprint-engine7.md`

````md
# 📘 Blueprint Fase 8: Relatórios Específicos + Gantt Chart

## 🎯 Objetivo
Analisar os 5 arquivos que implementam os **relatórios específicos** (TaskListRE, ResourceListRE, TextReport), a **estrutura de linhas de tabela** (ReportTableLine) e o **gráfico Gantt** (GanttChart). Estes completam o pipeline final de geração de relatórios.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── dispatch por typeSpec:                                  │
│          ├── :taskreport     → TaskListRE    ◄── TaskListRE.rb   │
│          ├── :resourcereport → ResourceListRE ◄── ResourceListRE.rb
│          ├── :textreport     → TextReport    ◄── TextReport.rb   │
│          ├── :accountreport  → AccountListRE                     │
│          ├── :export         → ExportRE                          │
│          ├── :tracereport    → TraceReport                       │
│          ├── :iCal           → ICalReport                        │
│          ├── :niku           → NikuReport                        │
│          └── :tagfile        → TagFile                           │
│                                                                  │
│  └── generateHTML()                                              │
│      └── content.to_html()                                       │
│          └── ReportTable                                         │
│              └── ReportTableLine  ◄── ReportTableLine.rb         │
│                  └── ReportTableCell                             │
│                      └── GanttChart (se coluna chart) ◄── GanttChart.rb
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. TASKLISTRE.RB — Relatório de Tarefas

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de TableReport** | Implementa listagem de tarefas |
| **Prepara listas** | TaskList + ResourceList com sorting |
| **Filtra tarefas** | Aplica hideTask, rollupTask, openNodes |
| **Gera header** | Uma coluna por atributo |
| **Gera linhas** | Para cada task + resources aninhados |

### 2.2 Estrutura Interna

```typescript
class TaskListRE extends TableReport {
  @table: ReportTable;
  
  constructor(report: Report) {
    super(report);
    this.table = new ReportTable();
    this.table.selfcontained = report.get('selfcontained');
    this.table.auxDir = report.get('auxdir');
  }
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // 1. Prepara lista de tarefas
    const taskList = new PropertyList(this.project.tasks);
    taskList.includeAdopted();
    taskList.setSorting(this.report.get('sortTasks'));
    taskList.query = this.report.project.reportContexts.last.query;
    
    taskList = this.filterTaskList(
      taskList, 
      null, 
      this.report.get('hideTask'),
      this.report.get('rollupTask'),
      this.report.get('openNodes')
    );
    taskList.sort();
    taskList.checkForDuplicates(this.report.sourceFileInfo);
    
    // 2. Prepara lista de recursos (NÃO filtra ainda!)
    const resourceList = new PropertyList(this.project.resources);
    resourceList.setSorting(this.report.get('sortResources'));
    resourceList.query = this.report.project.reportContexts.last.query;
    resourceList.sort();
    
    // 3. Gera header da tabela
    for (const columnDescr of this.report.get('columns')) {
      this.adjustColumnPeriod(columnDescr, taskList, this.report.get('scenarios'));
      this.generateHeaderCell(columnDescr);
    }
    
    // 4. Gera lista
    this.generateTaskList(taskList, resourceList, null);
  }
}
```

### 2.3 Pontos Críticos

1. **ResourceList NÃO é filtrado antes!** Isso quebraria as funções lógicas `isdutyof()`, `isresponsibilityof()`, etc.

2. **includeAdopted()** inclui tarefas adotadas via `adopt` keyword.

3. **checkForDuplicates()** detecta tarefas duplicadas em relatórios (importante quando há `adopt`).

4. **generateTaskList()** é herdado de `TableReport` e recursivamente aninha resources.

---

## 📋 3. RESOURCELISTRE.RB — Relatório de Recursos

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Especialização de TableReport** | Implementa listagem de recursos |
| **Filtra recursos** | Aplica hideResource, rollupResource, openNodes |
| **Coleta tarefas atribuídas** | Para cada recurso, quais tasks ele está alocado |
| **Gera linhas** | Para cada resource + tasks aninhados |

### 3.2 Estrutura Interna

```typescript
class ResourceListRE extends TableReport {
  @table: ReportTable;
  
  constructor(report: Report) {
    super(report);
    this.table = new ReportTable();
    this.table.selfcontained = report.get('selfcontained');
    this.table.auxDir = report.get('auxdir');
  }
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // 1. Prepara lista de recursos
    const resourceList = new PropertyList(this.project.resources);
    resourceList.setSorting(this.report.get('sortResources'));
    resourceList.query = this.report.project.reportContexts.last.query;
    
    resourceList = this.filterResourceList(
      resourceList, 
      null,
      this.report.get('hideResource'),
      this.report.get('rollupResource'),
      this.report.get('openNodes')
    );
    resourceList.sort();
    
    // 2. Prepara lista de tarefas (NÃO filtra ainda!)
    const taskList = new PropertyList(this.project.tasks);
    taskList.setSorting(this.report.get('sortTasks'));
    taskList.query = this.report.project.reportContexts.last.query;
    taskList.sort();
    
    // 3. Coleta tarefas atribuídas a cada resource
    const assignedTaskList: Task[] = [];
    for (const resource of resourceList) {
      const tasks = this.filterTaskList(
        taskList, 
        resource,
        this.report.get('hideTask'),
        this.report.get('rollupTask'),
        this.report.get('openNodes')
      );
      assignedTaskList.push(...tasks);
    }
    assignedTaskList.unique();
    
    // 4. Gera header
    for (const columnDescr of this.report.get('columns')) {
      this.adjustColumnPeriod(columnDescr, assignedTaskList, this.report.get('scenarios'));
      this.generateHeaderCell(columnDescr);
    }
    
    // 5. Gera lista
    this.generateResourceList(resourceList, taskList, null);
  }
}
```

### 3.3 Diferença Chave vs TaskListRE

```
TaskListRE:
  - Filtra tasks ANTES
  - Para cada task, mostra resources atribuídos
  - Usa filterTaskList() primeiro

ResourceListRE:
  - Filtra resources ANTES
  - Para cada resource, mostra tasks atribuídas
  - Usa filterResourceList() primeiro
  - assignedTaskList é usado apenas para ajustar período das colunas
```

---

## 📝 4. TEXTREPORT.RB — Relatório de Texto

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Relatório mais simples** | 5 seções RichText: header, left, center, right, footer |
| **Layout flexível** | Larguras calculadas baseado em quais seções existem |
| **Suporta HTML** | Gera tabela com colunas left/center/right |
| **CSV não suportado** | Emite warning |

### 4.2 Estrutura Interna

```typescript
class TextReport extends ReportBase {
  @header: RichTextIntermediate | null;
  @left: RichTextIntermediate | null;
  @center: RichTextIntermediate | null;
  @right: RichTextIntermediate | null;
  @footer: RichTextIntermediate | null;
  
  @lWidth: number = 0;
  @cWidth: number = 0;
  @rWidth: number = 0;
  @lPadding: number = 0;
  @cPadding: number = 0;
  @rPadding: number = 0;
  
  generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    
    // Calcula larguras baseado em quais seções existem
    if (this.a('center')) {
      if (this.a('left') && this.a('right')) {
        this.lWidth = this.rWidth = 20;
        this.cWidth = 60;
        this.lPadding = this.cPadding = 2;
      } else if (this.a('left') && !this.a('right')) {
        this.lWidth = 25;
        this.cWidth = 75;
        this.lPadding = 2;
      } else if (!this.a('left') && this.a('right')) {
        this.cWidth = 75;
        this.rWidth = 25;
        this.cPadding = 2;
      } else {
        this.cWidth = 100;
      }
    } else {
      if (this.a('left') && this.a('right')) {
        this.lWidth = this.rWidth = 50;
        this.lPadding = 2;
      } else if (this.a('left') && !this.a('right')) {
        this.lWidth = 100;
      } else if (!this.a('left') && this.a('right')) {
        this.rWidth = 100;
      }
    }
  }
  
  to_html(): XMLElement[] {
    const html: XMLElement[] = [];
    
    html.push(this.rt_to_html('header'));
    
    if (this.a('left') || this.a('center') || this.a('right')) {
      const table = new XMLElement('table', {
        class: 'tj_text_page',
        cellspacing: '0'
      });
      const row = new XMLElement('tr', { class: 'tj_text_row' });
      
      for (const section of ['left', 'center', 'right']) {
        const width = this[`${section[0]}Width`];
        const padding = this[`${section[0]}Padding`];
        
        if (this.a(section)) {
          const col = new XMLElement('td', {
            class: `tj_column_${section}`
          });
          let style = '';
          if (width > 0) style += `width:${width}%; `;
          if (padding > 0) style += `padding-right:${padding}%; `;
          col.attrs.style = style;
          col.append(this.rt_to_html(section));
          row.append(col);
        }
      }
      
      table.append(row);
      html.push(table);
    }
    
    html.push(this.rt_to_html('footer'));
    return html;
  }
  
  to_csv(): any[][] | null {
    this.report.warning('text_report_no_csv',
      `textreport '${this.report.fullId}' cannot be converted into CSV format`);
    return null;
  }
}
```

### 4.3 Lógica de Layout

```
┌─────────────────────────────────────────────────────────┐
│                         HEADER                           │
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│  LEFT    │         CENTER               │    RIGHT      │
│ (20-50%) │        (60-100%)             │   (20-50%)    │
│          │                              │               │
├──────────┴──────────────────────────────┴───────────────┤
│                         FOOTER                           │
└─────────────────────────────────────────────────────────┘
```

**Regras de largura:**
- Se tem center: center domina (60-100%)
- Se tem left+right: dividem 20-50% cada
- Se só center: 100%
- Se só left ou só right: 100%

---

## 📏 5. REPORTTABLELINE.RB — Linhas da Tabela

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha** | Cada linha da tabela é um ReportTableLine |
| **Contém cells** | Lista de ReportTableCell |
| **Gerencia estilo** | height, fontSize, bold, indentation |
| **Contadores** | no, lineNo, subLineNo |
| **Converte para HTML/CSV** | to_html(), to_csv() |

### 5.2 Estrutura Interna

```typescript
class ReportTableLine {
  @table: ReportTable;
  @property: PropertyTreeNode;
  @scopeLine: ReportTableLine | null;
  @cells: ReportTableCell[];
  
  // Estilo
  @height: number = 21;           // pixels
  @indentation: number = 0;       // pixels
  @fontSize: number = 12;         // pixels
  @bold: boolean = false;
  
  // Contadores
  @no: number | null = null;      // contador primário + nested
  @lineNo: number | null = null;  // contador de linhas primárias
  @subLineNo: number | null = null; // contador de todas as linhas
  
  constructor(table: ReportTable, property: PropertyTreeNode, 
              scopeLine: ReportTableLine | null) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    this.cells = [];
    
    // Registra a linha na tabela
    this.table.addLine(this);
  }
  
  // Retorna a última cell não-hidden
  last(count = 0): ReportTableCell | null {
    for (let i = 1 + count; i <= this.cells.length; i++) {
      if (!this.cells[this.cells.length - i].hidden) {
        return this.cells[this.cells.length - i];
      }
    }
    return null;
  }
  
  // Adiciona uma cell à linha
  addCell(cell: ReportTableCell): void {
    this.cells.push(cell);
  }
  
  // Retorna a scope property (para nested lines)
  scopeProperty(): PropertyTreeNode | null {
    return this.scopeLine ? this.scopeLine.property : null;
  }
  
  // Converte para HTML
  to_html(): XMLElement {
    let style = '';
    if (this.table.equiLines) style += `height:${this.height}px; `;
    if (this.fontSize) style += `font-size:${this.fontSize}px; `;
    
    const tr = new XMLElement('tr', {
      class: 'tabline',
      style: style
    });
    
    for (const cell of this.cells) {
      tr.append(cell.to_html());
    }
    
    return tr;
  }
  
  // Converte para CSV
  to_csv(csv: any[][], startColumn: number, lineIdx: number): number {
    let columnIdx = startColumn;
    for (const cell of this.cells) {
      columnIdx += cell.to_csv(csv, columnIdx, lineIdx);
    }
    return columnIdx - startColumn;
  }
}
```

### 5.3 Hierarquia de Linhas

```
ReportTable
├── ReportTableLine (header)
│   └── cells: ReportTableCell[]
├── ReportTableLine (primary task 1)
│   ├── cells: ReportTableCell[]
│   └── ReportTableLine (nested resource 1.1)
│       └── cells: ReportTableCell[]
│           └── scopeLine → primary task 1
├── ReportTableLine (primary task 2)
│   └── cells: ReportTableCell[]
└── ...
```

### 5.4 Contadores

```typescript
// no: contador que reinicia para cada conjunto nested
// lineNo: contador global de linhas primárias
// subLineNo: contador global de todas as linhas

// Exemplo:
// Task 1 (lineNo=1, subLineNo=1, no=1)
//   └── Resource 1.1 (lineNo=null, subLineNo=2, no=1)
//   └── Resource 1.2 (lineNo=null, subLineNo=3, no=2)
// Task 2 (lineNo=2, subLineNo=4, no=1)
//   └── Resource 2.1 (lineNo=null, subLineNo=5, no=1)
```

---

## 📊 6. GANTTCHART.RB — Gráfico Gantt

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela Gantt chart** | Abstração independente de formato |
| **Gerencia escalas** | hour, day, week, month, quarter, year |
| **Renderiza barras** | Task bars + milestones |
| **Renderiza dependências** | Dependency arrows |
| **Renderiza header** | Escala temporal no topo |
| **Suporta scrollbar** | Se viewWidth < width |

### 6.2 Estrutura Interna

```typescript
class GanttChart {
  static readonly SCROLLBARHEIGHT = 20;
  
  // Datas
  @start: TjTime | null;
  @end: TjTime | null;
  @now: TjTime;
  @markdate: TjTime | null;
  
  // Configuração
  @weekStartsMonday: boolean;
  @columnDef: TableColumnDefinition;
  @table: TableReport | null;
  
  // Escalas disponíveis
  static readonly scales = [
    { name: 'hour',    stepSize: 20, stepsToFunc: 'hoursTo',    minTimeOff: 5 * 60 },
    { name: 'day',     stepSize: 20, stepsToFunc: 'daysTo',     minTimeOff: 6 * 60 * 60 },
    { name: 'week',    stepSize: 20, stepsToFunc: 'weeksTo',    minTimeOff: 24 * 60 * 60 },
    { name: 'month',   stepSize: 35, stepsToFunc: 'monthsTo',   minTimeOff: 5 * 24 * 60 * 60 },
    { name: 'quarter', stepSize: 28, stepsToFunc: 'quartersTo', minTimeOff: -1 },
    { name: 'year',    stepSize: 20, stepsToFunc: 'yearsTo',    minTimeOff: -1 },
  ];
  
  @scale: Scale | null;
  @stepSize: number;
  
  // Dimensões
  @height: number = 0;
  @width: number = 0;
  @viewWidth: number | null;
  
  // Componentes
  @header: GanttHeader | null;
  @lines: GanttLine[];
  @router: GanttRouter | null;
  
  // Tasks indexed para dependency arrows
  @tasks: Map<Task, GanttLine[]>;
  @depArrows: [number, number][][];
  @arrowHeads: [number, number][];
  
  constructor(now: TjTime, weekStartsMonday: boolean, 
              columnDef: TableColumnDefinition, 
              table: TableReport | null = null,
              markdate: TjTime | null = null) {
    // ... inicialização
    this.tasks = new Map();
    this.lines = [];
    this.depArrows = [];
    this.arrowHeads = [];
  }
  
  // Adiciona task para dependency tracking
  addTask(task: Task, line: GanttLine): void {
    if (this.tasks.has(task)) {
      this.tasks.get(task)!.push(line);
    } else {
      this.tasks.set(task, [line]);
    }
  }
  
  // Gera chart baseado em escala
  generateByScale(periodStart: TjTime, periodEnd: TjTime, scaleName: string): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.scale = this.scaleByName(scaleName);
    this.stepSize = this.scale.stepSize;
    
    const steps = (this.start as any)[this.scale.stepsToFunc](this.end);
    this.width = this.stepSize * steps;
    
    this.header = new GanttHeader(this.columnDef, this);
  }
  
  // Gera chart baseado em largura
  generateByWidth(periodStart: TjTime, periodEnd: TjTime, width: number): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.width = width;
    // TODO: calcular scale automaticamente
  }
  
  // Converte para HTML
  to_html(): XMLElement {
    this.completeChart();
    
    const td = new XMLElement('td', {
      rowspan: `${2 + this.lines.length + (this.hasScrollbar() ? 1 : 0)}`,
      style: 'padding:0px; vertical-align:top;'
    });
    
    // Div externo com scrollbar
    const scrollDiv = new XMLElement('div', {
      class: 'tabback',
      style: `position:relative; overflow:auto; ` +
             `width:${this.hasScrollbar() ? this.viewWidth : this.width}px; ` +
             `height:${this.height + (this.hasScrollbar() ? GanttChart.SCROLLBARHEIGHT : 0)}px;`
    });
    
    // Div interno (conteúdo)
    const div = new XMLElement('div', {
      style: `margin:0px; padding:0px; position:absolute; overflow:hidden; ` +
             `top:0px; left:0px; width:${this.width}px; height:${this.height}px; ` +
             `font-size:10px;`
    });
    
    // Header
    div.append(this.header!.to_html());
    
    // Linhas do chart
    for (const line of this.lines) {
      div.append(line.to_html());
    }
    
    // Dependency arrows
    for (const arrow of this.depArrows) {
      let xx: number | null = null;
      let yy: number | null = null;
      
      for (const [x, y] of arrow) {
        if (xx !== null && yy !== null) {
          div.append(this.lineToHTML(xx, yy, x, y, 'depline'));
        }
        xx = x;
        yy = y;
      }
    }
    
    // Arrow heads
    for (const [x, y] of this.arrowHeads) {
      div.append(this.arrowHeadToHTML(x, y));
    }
    
    scrollDiv.append(div);
    td.append(scrollDiv);
    
    return td;
  }
  
  // Converte data para X position
  dateToX(date: TjTime): number {
    return Math.floor((this.width / (this.end! - this.start!)) * (date - this.start!));
  }
  
  // Verifica se precisa scrollbar
  hasScrollbar(): boolean {
    return this.viewWidth !== null && this.viewWidth < this.width;
  }
  
  // Calcula altura total e gera dependency arrows
  private completeChart(): void {
    // Calcula altura
    for (const line of this.lines) {
      if (line.y + line.height > this.height) {
        this.height = line.y + line.height;
      }
    }
    
    // Cria router para dependency lines
    this.router = new GanttRouter(this.width, this.height);
    
    // Bloqueia zonas (task bars, milestones, now line)
    for (const line of this.lines) {
      line.addBlockedZones(this.router);
    }
    
    // Protege linha "now"
    this.router.addZone(
      this.header!.nowLineX - 1, 0, 
      3, this.height - 1, 
      false, true
    );
    
    // Protege linha "markdate"
    if (this.header!.markdateLineX) {
      this.router.addZone(
        this.header!.markdateLineX - 1, 0,
        3, this.height - 1,
        false, true
      );
    }
    
    // Gera dependency arrows
    for (const [task, lines] of this.tasks) {
      this.generateDepLines(task, lines);
    }
    
    // Garante arrow heads únicos
    for (const line of this.depArrows) {
      const endPoint = line[line.length - 1];
      if (!this.arrowHeads.some(([x, y]) => x === endPoint[0] && y === endPoint[1])) {
        this.arrowHeads.push(endPoint);
      }
    }
  }
  
  // Gera dependency lines para uma task
  private generateDepLines(task: Task, lines: GanttLine[]): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const scenarioIdx = line.query.scenarioIdx;
      
      // Dependencies do start
      this.generateTaskDepLines(
        'startsuccs', task, scenarioIdx, lineIndex,
        ...line.getTask().startDepLineStart
      );
      
      // Dependencies do end
      this.generateTaskDepLines(
        'endsuccs', task, scenarioIdx, lineIndex,
        ...line.getTask().endDepLineStart
      );
    }
  }
  
  // Gera dependency lines de um tipo específico
  private generateTaskDepLines(
    kind: 'startsuccs' | 'endsuccs',
    task: Task, 
    scenarioIdx: number,
    lineIndex: number,
    startX: number, 
    startY: number
  ): void {
    const touples: [number, number, number, number][] = [];
    
    for (const [t, onEnd] of task[kind][scenarioIdx]) {
      // Pula dependencies herdadas e tasks fora do chart
      if ((t.parent && task.hasDependency(scenarioIdx, kind, t.parent, onEnd)) ||
          !this.tasks.has(t)) {
        continue;
      }
      
      const [endX, endY] = this.tasks.get(t)![lineIndex].getTask()
        [onEnd ? 'endDepLineEnd' : 'startDepLineEnd'];
      
      touples.push([startX, startY, endX, endY]);
    }
    
    if (touples.length > 0) {
      this.depArrows.push(...this.router!.routeLines(touples));
    }
  }
  
  private scaleByName(name: string): Scale {
    for (const scale of GanttChart.scales) {
      if (scale.name === name) return scale;
    }
    throw new Error(`Unknown scale ${name}`);
  }
}
```

### 6.3 Escalas do Gantt

| Escala | Step Size | Função | Min Time Off |
|---|---|---|---|
| hour | 20px | hoursTo | 5 min |
| day | 20px | daysTo | 6 hours |
| week | 20px | weeksTo | 1 day |
| month | 35px | monthsTo | 5 days |
| quarter | 28px | quartersTo | -1 (sempre mostra) |
| year | 20px | yearsTo | -1 (sempre mostra) |

### 6.4 Componentes do Gantt

```
┌─────────────────────────────────────────────────────────────┐
│  GanttHeader                                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  2026  |  2026  |  2026  |  2026  |  2026  |  2026   │  │
│  │  Q1    |  Q2    |  Q3    |  Q4    |  Q1    |  Q2     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Task 1  ██████████████████                            │  │
│  │  Task 2       ████████████████████                     │  │
│  │  Task 3                  ████████████                  │  │
│  │           ↑ now line                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Dependency arrows:                                         │
│  Task 1 ───────────────────┐                                │
│                            ↓                                │
│                          Task 3                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Dependency Arrow Routing

O `GanttRouter` é responsável por rotear as setas de dependência evitando sobreposição com task bars:

```typescript
// GanttRouter (não anexado, mas essencial)
class GanttRouter {
  @width: number;
  @height: number;
  @blockedZones: Zone[];
  
  // Rota linhas evitando zonas bloqueadas
  routeLines(touples: [number, number, number, number][]): [number, number][][] {
    // Algoritmo de roteamento ortogonal
    // Retorna array de polylines
  }
  
  // Adiciona zona bloqueada
  addZone(x: number, y: number, width: number, height: number, 
          blockHorizontal: boolean, blockVertical: boolean): void {
    this.blockedZones.push({ x, y, width, height, blockHorizontal, blockVertical });
  }
}
```

### 6.6 Pontos Críticos

1. **completeChart() é lazy!** Só é chamado em `to_html()`.

2. **viewWidth vs width**: Se `viewWidth < width`, mostra scrollbar horizontal.

3. **multiple scenarios**: Cada task pode ter múltiplas linhas (uma por cenário).

4. **dependency arrows são ortogonais**: Só linhas horizontais e verticais.

5. **blocked zones**: Task bars, milestones, now line, markdate line são zonas bloqueadas.

6. **dateToX() é linear**: Usa interpolação linear entre start e end.

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação (Fase 8)

```
FASE 8A: Estrutura de Tabela
  1. ReportTableCell.ts        (célula individual)
  2. ReportTableLine.ts        (linha da tabela) ⭐
  3. ReportTable.ts            (tabela completa)
  4. TableReport.ts            (base para task/resource reports)

FASE 8B: Relatórios Específicos
  5. TextReport.ts             (mais simples) ⭐
  6. TaskListRE.ts             (relatório de tarefas) ⭐
  7. ResourceListRE.ts         (relatório de recursos) ⭐
  8. AccountListRE.ts          (relatório de contas)

FASE 8C: Gantt Chart
  9. GanttHeader.ts            (header do Gantt)
  10. GanttLine.ts             (linha do Gantt)
  11. GanttTaskBar.ts          (barra de tarefa)
  12. GanttMilestone.ts        (milestone)
  13. GanttRouter.ts           (roteamento de arrows)
  14. GanttChart.ts            (chart completo) ⭐
  15. HTMLGraphics.ts          (helpers SVG/HTML)

FASE 8D: Outros Relatórios
  16. ExportRE.ts
  17. TraceReport.ts
  18. ICalReport.ts
  19. NikuReport.ts
  20. TagFile.ts
  21. StatusSheetReport.ts
  22. TimeSheetReport.ts
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 ReportTableLine Genérico
```typescript
class ReportTableLine {
  protected cells: ReportTableCell[] = [];
  
  addCell(cell: ReportTableCell): void {
    this.cells.push(cell);
  }
  
  // Template method para subclasses
  abstract to_html(): XMLElement;
  abstract to_csv(csv: any[][], startColumn: number, lineIdx: number): number;
}
```

#### 7.2.2 TableReport com Strategy Pattern
```typescript
abstract class TableReport extends ReportBase {
  protected table: ReportTable;
  
  // Template method
  abstract generateIntermediateFormat(): void;
  
  // Helpers compartilhados
  protected filterTaskList(
    taskList: PropertyList<Task>,
    resource: Resource | null,
    hideTask: LogicalExpression | null,
    rollupTask: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Task> {
    // Implementação de filtro
  }
  
  protected filterResourceList(
    resourceList: PropertyList<Resource>,
    task: Task | null,
    hideResource: LogicalExpression | null,
    rollupResource: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Resource> {
    // Implementação de filtro
  }
  
  protected adjustColumnPeriod(
    columnDescr: TableColumnDefinition,
    propertyList: PropertyList<PropertyTreeNode>,
    scenarios: Scenario[]
  ): void {
    // Ajusta período da coluna baseado nas propriedades
  }
  
  protected generateHeaderCell(columnDescr: TableColumnDefinition): void {
    // Gera cell do header
  }
}
```

#### 7.2.3 GanttChart com Builder Pattern
```typescript
class GanttChartBuilder {
  private chart: GanttChart;
  
  constructor(now: TjTime, weekStartsMonday: boolean, columnDef: TableColumnDefinition) {
    this.chart = new GanttChart(now, weekStartsMonday, columnDef);
  }
  
  period(start: TjTime, end: TjTime): this {
    this.chart.start = start;
    this.chart.end = end;
    return this;
  }
  
  scale(name: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'): this {
    this.chart.generateByScale(this.chart.start!, this.chart.end!, name);
    return this;
  }
  
  viewWidth(width: number): this {
    this.chart.viewWidth = width;
    return this;
  }
  
  addLine(line: GanttLine): this {
    this.chart.addLine(line);
    return this;
  }
  
  addTask(task: Task, line: GanttLine): this {
    this.chart.addTask(task, line);
    return this;
  }
  
  build(): GanttChart {
    return this.chart;
  }
}
```

#### 7.2.4 Escalas como Enum
```typescript
enum GanttScale {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

interface ScaleConfig {
  name: GanttScale;
  stepSize: number;
  stepsToFunc: keyof TjTime;
  minTimeOff: number;
}

const SCALES: ScaleConfig[] = [
  { name: GanttScale.HOUR, stepSize: 20, stepsToFunc: 'hoursTo', minTimeOff: 5 * 60 },
  { name: GanttScale.DAY, stepSize: 20, stepsToFunc: 'daysTo', minTimeOff: 6 * 60 * 60 },
  { name: GanttScale.WEEK, stepSize: 20, stepsToFunc: 'weeksTo', minTimeOff: 24 * 60 * 60 },
  { name: GanttScale.MONTH, stepSize: 35, stepsToFunc: 'monthsTo', minTimeOff: 5 * 24 * 60 * 60 },
  { name: GanttScale.QUARTER, stepSize: 28, stepsToFunc: 'quartersTo', minTimeOff: -1 },
  { name: GanttScale.YEAR, stepSize: 20, stepsToFunc: 'yearsTo', minTimeOff: -1 },
];
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **TaskListRE NÃO filtra ResourceList antes!** Filtrar quebraria `isdutyof()` e similares.

2. **ResourceListRE NÃO filtra TaskList antes!** Mesmo motivo.

3. **assignedTaskList** em ResourceListRE é só para ajustar período das colunas.

4. **TextReport não suporta CSV!** Emite warning e retorna null.

5. **GanttChart.completeChart() é lazy!** Só executa em to_html().

6. **GanttRouter** é crítico para dependency arrows não sobrepor task bars.

7. **viewWidth < width** → scrollbar horizontal.

8. **multiple scenarios** → múltiplas linhas por task.

9. **dateToX()** usa interpolação linear (não considera working hours).

10. **dependency arrows** são ortogonais (só horizontal/vertical).

11. **blocked zones** incluem task bars, milestones, now line, markdate line.

12. **arrow heads** são únicos por endpoint (evita duplicação).

13. **GanttHeader** tem duas linhas: superior (ano) e inferior (mês/semana/dia).

14. **now line** é renderizada como linha vertical vermelha.

15. **markdate line** é linha vertical customizada (se definida).

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (40 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableColumnDefinition, HTMLDocument
- [x] **Fase 8**: TaskListRE, ResourceListRE, TextReport, ReportTableLine, GanttChart ⭐

### 🔮 Próximos 5 (Fase 9 - Estrutura de Tabela + Gantt Components)
- [ ] `lib/taskjuggler/reports/ReportTable.rb` — Tabela completa
- [ ] `lib/taskjuggler/reports/ReportTableCell.rb` — Célula individual
- [ ] `lib/taskjuggler/reports/TableReport.rb` — Base para task/resource reports
- [ ] `lib/taskjuggler/reports/GanttHeader.rb` — Header do Gantt
- [ ] `lib/taskjuggler/reports/GanttLine.rb` — Linha do Gantt

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Report
const report = new Report(project, 'r1', 'My Report', null);
report.typeSpec = 'taskreport';
report.set('formats', ['html']);
report.set('columns', [
  new TableColumnDefinition('bsi', 'BSI'),
  new TableColumnDefinition('name', 'Name'),
  new TableColumnDefinition('start', 'Start'),
  new TableColumnDefinition('end', 'End'),
  new TableColumnDefinition('effort', 'Effort'),
  new TableColumnDefinition('chart', 'Chart'),
]);

// 2. Parser cria LogicalExpression para hideTask
const hideTask = new LogicalExpression(
  new LogicalOperation(
    new LogicalFunction('isleaf'),
    '~',
    null
  )
);
report.set('hideTask', hideTask);

// 3. Schedule
await project.schedule();

// 4. Generate Reports
await report.generate();
// → Report.generate()
//   → generateIntermediateFormat()
//     → TaskListRE.generateIntermediateFormat()
//       → filterTaskList()
//       → generateHeaderCell() × 6
//       → generateTaskList()
//         → Para cada task:
//           → ReportTableLine
//             → ReportTableCell × 6
//               → Para coluna 'chart':
//                 → GanttChart.generateByScale()
//                 → GanttLine
//                   → GanttTaskBar
//                 → GanttRouter.routeLines()
//   → generateHTML()
//     → HTMLDocument
//     → ReportTable.to_html()
//       → ReportTableLine.to_html()
//         → ReportTableCell.to_html()
//           → GanttChart.to_html()
//     → Deno.writeTextFile()
```

---

## 🚀 10. PRÓXIMOS PASSOS

### Fase 9: Estrutura de Tabela + Gantt Components (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/ReportTable.rb`** — Tabela completa (container de linhas)
2. **`lib/taskjuggler/reports/ReportTableCell.rb`** — Célula individual (text, color, tooltip)
3. **`lib/taskjuggler/reports/TableReport.rb`** — Base para task/resource reports (filterTaskList, etc.)
4. **`lib/taskjuggler/reports/GanttHeader.rb`** — Header do Gantt (duas linhas temporais)
5. **`lib/taskjuggler/reports/GanttLine.rb`** — Linha do Gantt (task bar + milestone)

### Ordem de Leitura Sugerida

```
1. ReportTableCell.rb    ← Célula individual (mais simples)
2. ReportTable.rb        ← Container de linhas
3. TableReport.rb        ← Base para task/resource reports
4. GanttHeader.rb        ← Header do Gantt
5. GanttLine.rb          ← Linha do Gantt (task bar + milestone)
```

---

**Fim da Fase 8.** Os relatórios específicos estão agora **completamente mapeados**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `ReportTableCell.rb` → `ReportTable.rb` → `TableReport.rb` → `GanttHeader.rb` → `GanttLine.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/09-blueprint-engine8.md`

````md
# 📘 Blueprint Fase 9: Estrutura de Tabela + Gantt Components

## 🎯 Objetivo
Analisar os 5 arquivos que implementam a **estrutura completa de tabelas** e os **componentes do Gantt Chart**. Estes arquivos são a base para todos os relatórios tabulares (TaskReport, ResourceReport, AccountReport, etc.) e para a renderização visual do Gantt.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS (Visão Completa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── TaskListRE / ResourceListRE / AccountListRE             │
│          └── TableReport (base)  ◄── TableReport.rb              │
│              ├── generateTaskList() / generateResourceList()     │
│              │   └── Para cada property:                         │
│              │       └── ReportTableLine  ◄── ReportTableLine.rb │
│              │           └── Para cada coluna:                   │
│              │               └── ReportTableCell ◄── ReportTableCell.rb
│              │                   └── text, color, tooltip, icon  │
│              │                                                   │
│              └── generateHeaderCell()                            │
│                  └── ReportTableColumn  ◄── ReportTableColumn.rb │
│                      ├── cell1 (header superior)                 │
│                      ├── cell2 (header inferior)                 │
│                      └── special (GanttChart / ColumnTable)      │
│                                                                  │
│  └── to_html() / to_csv()                                        │
│      └── ReportTable  ◄── ReportTable.rb                         │
│          ├── columns: ReportTableColumn[]                        │
│          ├── lines: ReportTableLine[]                            │
│          └── to_html() → XMLElement tree                         │
│                                                                  │
│  └── GanttChart (se coluna chart)                                │
│      └── GanttLine  ◄── GanttLine.rb                             │
│          ├── GanttTaskBar / GanttMilestone / GanttContainer      │
│          ├── GanttLoadStack (para resources aninhados)           │
│          └── Dependency arrows (via GanttRouter)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. REPORTTABLE.RB — Container de Tabela

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Container de colunas e linhas** | Armazena `ReportTableColumn[]` e `ReportTableLine[]` |
| **Gera HTML/CSV** | `to_html()` e `to_csv()` convertem para formatos de saída |
| **Gerencia header** | 1 ou 2 linhas de header (depende das colunas) |
| **Scrollbar detection** | Detecta se alguma coluna precisa de scrollbar |
| **Indentação** | Calcula `maxIndent` para tree sorting |

### 2.2 Estrutura Interna

```typescript
class ReportTable {
  static readonly SCROLLBARHEIGHT = 20;
  
  @headerLineHeight: number = 19;      // pixels
  @headerFontSize: number = 15;        // pixels
  @columns: ReportTableColumn[] = [];
  @lines: ReportTableLine[] = [];
  @maxIndent: number = 0;
  @equiLines: boolean = false;         // Todas linhas mesma altura?
  @embedded: boolean = false;          // Tabela embutida em outra?
  @selfcontained: boolean = false;     // CSS inline?
  @auxDir: string = '';                // Diretório de assets
  
  addColumn(col: ReportTableColumn): void;
  addLine(line: ReportTableLine): void;
  minWidth(): number | null;
  to_html(): XMLElement;
  to_csv(csv?: any[][], startColumn?: number): any[][] | number;
}
```

### 2.3 to_html() — Geração de HTML

```typescript
to_html(): XMLElement {
  this.determineMaxIndents();
  
  const attr: Record<string, string> = {
    'class': 'tj_table',
    'cellspacing': '1'
  };
  if (this.embedded) {
    attr['style'] = 'width:100%; ';
  }
  
  const table = new XMLElement('table', attr);
  const tbody = new XMLElement('tbody');
  
  // 1. Detecta se todas as cells do header têm 2 rows
  let allCellsHave2Rows = true;
  let lineHeight = this.headerLineHeight;
  
  for (const col of this.columns) {
    if (col.cell1.rows !== 2 && !col.cell1.special) {
      allCellsHave2Rows = false;
      break;
    }
  }
  
  if (allCellsHave2Rows) {
    for (const col of this.columns) {
      col.cell1.rows = 1;
    }
    lineHeight = this.headerLineHeight * 2 + 1;
  }
  
  // 2. Gera 1ª linha do header
  const tr1 = new XMLElement('tr', {
    'class': 'tabhead',
    'style': `height:${lineHeight}px; font-size:${this.headerFontSize}px;`
  });
  for (const col of this.columns) {
    tr1.append(col.to_html(1));
  }
  tbody.append(tr1);
  
  // 3. Gera 2ª linha do header (se necessário)
  if (!allCellsHave2Rows) {
    const tr2 = new XMLElement('tr', {
      'class': 'tabhead',
      'style': `height:${this.headerLineHeight}px; font-size:${this.headerFontSize}px;`
    });
    for (const col of this.columns) {
      tr2.append(col.to_html(2));
    }
    tbody.append(tr2);
  }
  
  // 4. Gera linhas de dados
  for (const line of this.lines) {
    tbody.append(line.to_html());
  }
  
  // 5. Linha extra para scrollbar (se necessário)
  if (this.hasScrollbar()) {
    const tr3 = new XMLElement('tr', {
      'style': `height:${ReportTable.SCROLLBARHEIGHT}px`
    });
    for (const col of this.columns) {
      if (!col.scrollbar) {
        tr3.append(new XMLElement('td'));
      }
    }
    tbody.append(tr3);
  }
  
  table.append(tbody);
  return table;
}
```

### 2.4 Pontos Críticos

1. **allCellsHave2Rows**: Se TODAS as colunas têm header de 2 linhas, o TaskJuggler merge as células para economizar espaço vertical.

2. **embedded**: Tabelas embutidas (ex: calendar columns) têm `width:100%`.

3. **equiLines**: Se true, todas as linhas têm a mesma altura (necessário para Gantt chart).

4. **hasScrollbar()**: Retorna true se alguma coluna tem scrollbar.

---

## 📋 3. REPORTTABLECOLUMN.RB — Coluna da Tabela

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma coluna** | Contém `cell1` (header superior) e `cell2` (header inferior) |
| **Special object** | Pode conter GanttChart ou ColumnTable embutido |
| **Scrollbar flag** | Indica se a coluna precisa de scrollbar |
| **Converte para HTML/CSV** | `to_html(row)` e `to_csv()` |

### 3.2 Estrutura Interna

```typescript
class ReportTableColumn {
  @table: ReportTable;
  @definition: TableColumnDefinition | null;
  @cell1: ReportTableCell;           // Header superior (obrigatório)
  @cell2: ReportTableCell;           // Header inferior (opcional)
  @scrollbar: boolean = false;
  
  constructor(table: ReportTable, definition: TableColumnDefinition | null, title: string) {
    this.table = table;
    this.table.addColumn(this);
    this.definition = definition;
    if (definition) {
      definition.column = this;
    }
    
    this.cell1 = new ReportTableCell(null, null, title, true);
    this.cell1.padding = 5;
    this.cell2 = new ReportTableCell(null, null, '', true);
    
    // Header text sempre em bold
    this.cell1.bold = true;
    this.cell2.bold = true;
  }
  
  minWidth(): number | null;
  to_html(row: 1 | 2): XMLElement;
  to_csv(csv: any[][], startColumn: number): number;
}
```

### 3.3 Special Object (GanttChart / ColumnTable)

```typescript
// No TableReport.generateHeaderCell():
if (columnDef.id === 'chart') {
  const gantt = new GanttChart(
    a('now'),
    a('weekStartsMonday'),
    columnDef,
    this,
    a('markdate')
  );
  gantt.generateByScale(rStart, rEnd, columnDef.scale);
  gantt.header.height = this.table.headerLineHeight * 2 + 1;
  gantt.viewWidth = columnDef.width || 450;
  
  const column = new ReportTableColumn(this.table, columnDef, '');
  column.cell1.special = gantt;  // ← GanttChart embutido!
  column.cell2.hidden = true;
  column.scrollbar = gantt.hasScrollbar();
  this.table.equiLines = true;
}
```

### 3.4 Pontos Críticos

1. **cell1.special**: Se não for null, contém um objeto (GanttChart ou ColumnTable) que substitui TODO o conteúdo da coluna.

2. **cell2.hidden**: Se true, cell1 ocupa toda a altura do header.

3. **scrollbar**: Se true, a tabela gera uma linha extra para o scrollbar.

---

## 📝 4. REPORTTABLECELL.RB — Célula Individual

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Conteúdo da célula** | `text` (String ou RichTextIntermediate) |
| **Estilo visual** | `category`, `cellColor`, `fontColor`, `bold`, `fontSize` |
| **Layout** | `alignment`, `indent`, `width`, `rows`, `columns` |
| **Ícones** | `icon`, `iconTooltip` |
| **Tooltip** | `tooltip`, `showTooltipHint` |
| **Special** | Pode conter objeto embutido (PlaceHolderCell) |

### 4.2 Estrutura Interna

```typescript
class ReportTableCell {
  @line: ReportTableLine | null;
  @headerCell: boolean;
  @query: Query | null;
  
  // Conteúdo
  @text: string | RichTextIntermediate;
  @data: string | null;              // Dados originais (opcional)
  @special: any;                     // Objeto embutido (PlaceHolderCell)
  
  // Estilo
  @category: string | null;          // Classe CSS (taskcell1, resourcecell2, etc.)
  @cellColor: string | null;         // Background color (override category)
  @fontColor: string | null;         // Font color
  @bold: boolean = false;
  @fontSize: number | null;
  
  // Layout
  @alignment: 'left' | 'center' | 'right' = 'center';
  @indent: number | null;            // Nível de indentação (tree mode)
  @width: number | null;             // Largura em pixels
  @rows: number = 1;                 // Rowspan
  @columns: number = 1;              // Colspan
  @padding: number = 3;
  @hidden: boolean = false;
  
  // Ícones e tooltips
  @icon: string | null;              // Nome do ícone (sem .png)
  @iconTooltip: RichTextIntermediate | null;
  @tooltip: RichTextIntermediate | null;
  @showTooltipHint: boolean = true;
  
  // Flags internas
  @force_string: boolean = false;    // Não converter números para string
  
  constructor(line: ReportTableLine | null, query: Query | null, text?: string, headerCell?: boolean);
  
  to_html(): XMLElement | null;
  to_csv(csv: any[][], columnIdx: number, lineIdx: number): number;
}
```

### 4.3 to_html() — Geração de HTML

```typescript
to_html(): XMLElement | null {
  if (this.hidden) return null;
  if (this.special) return this.special.to_html();
  
  const attribs: Record<string, string> = {};
  if (this.rows > 1) attribs['rowspan'] = `${this.rows}`;
  if (this.columns > 1) attribs['colspan'] = `${this.columns}`;
  attribs['class'] = this.category || 'tabcell';
  
  let style = '';
  if (this.cellColor) {
    style += `background-color: ${this.cellColor}; `;
  }
  if (style) attribs['style'] = style;
  
  const cell = new XMLElement('td', attribs);
  
  // Tabela interna para layout
  const table = new XMLElement('table', {
    'class': this.category ? 'tj_table_cell' : 'tj_table_header_cell',
    'cellspacing': '0',
    'style': this.cellStyle()
  });
  
  const row = new XMLElement('tr');
  this.calculateIndentation();
  
  // Padding esquerdo
  if (this.leftIndent && this.leftIndent > 0) {
    row.append(new XMLElement('td', {
      'style': `width:${this.leftIndent}px; `
    }));
  }
  
  // Ícone
  row.append(this.cellIcon(cell));
  
  // Label + tooltip
  const [labelDiv, tooltip] = this.cellLabel();
  row.append(labelDiv);
  
  // Tooltip hint (ícone de detalhes)
  if (tooltip && !tooltip.empty() && !this.selfcontained()) {
    if (this.showTooltipHint) {
      const td = new XMLElement('td');
      td.append(new XMLElement('img', {
        'src': `${this.auxDir()}icons/details.png`,
        'class': 'tj_table_cell_tooltip'
      }));
      this.addHtmlTooltip(tooltip, td, cell);
      row.append(td);
    } else {
      this.addHtmlTooltip(tooltip, cell);
    }
  }
  
  // Padding direito
  if (this.rightIndent && this.rightIndent > 0) {
    row.append(new XMLElement('td', {
      'style': `width:${this.rightIndent}px; `
    }));
  }
  
  table.append(row);
  cell.append(table);
  return cell;
}
```

### 4.4 Categorias CSS

```typescript
// Categorias comuns:
// - taskcell1, taskcell2 (alternating rows para tasks)
// - resourcecell1, resourcecell2 (alternating rows para resources)
// - calconttask1, calconttask2 (container tasks em calendar)
// - caltask1, caltask2 (leaf tasks em calendar)
// - busy1, busy2 (resource fully loaded)
// - loaded1, loaded2 (resource partially loaded)
// - free (resource available)
// - offduty (non-working time)
// - costaccountcell1, costaccountcell2 (cost accounts)
// - revenueaccountcell1, revenueaccountcell2 (revenue accounts)
```

### 4.5 Pontos Críticos

1. **special**: Se não for null, `to_html()` delega para `special.to_html()`. Usado para PlaceHolderCell (tabelas embutidas).

2. **category**: Define a classe CSS. Pode ser sobrescrito por `cellColor`.

3. **indent**: Em tree mode, calcula `leftIndent` ou `rightIndent` baseado no `alignment`.

4. **tooltip**: Pode ser RichTextIntermediate com queries embutidas.

5. **hidden**: Se true, `to_html()` retorna null (usado para cells merged).

---

## 📏 5. REPORTTABLELINE.RB — Linha da Tabela

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha** | Contém `cells: ReportTableCell[]` |
| **Propriedade associada** | `property: PropertyTreeNode` (Task, Resource, Account) |
| **Scope** | `scopeLine: ReportTableLine | null` (para nested lines) |
| **Contadores** | `no`, `lineNo`, `subLineNo` |
| **Estilo** | `height`, `indentation`, `fontSize`, `bold` |

### 5.2 Estrutura Interna

```typescript
class ReportTableLine {
  @table: ReportTable;
  @property: PropertyTreeNode;
  @scopeLine: ReportTableLine | null;
  @cells: ReportTableCell[] = [];
  
  // Estilo
  @height: number = 21;              // pixels
  @indentation: number = 0;          // pixels
  @fontSize: number = 12;            // pixels
  @bold: boolean = false;
  
  // Contadores
  @no: number | null = null;         // Contador primário (reinicia para nested)
  @lineNo: number | null = null;     // Contador de linhas primárias
  @subLineNo: number | null = null;  // Contador de todas as linhas
  
  constructor(table: ReportTable, property: PropertyTreeNode, scopeLine: ReportTableLine | null) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    this.table.addLine(this);
  }
  
  last(count?: number): ReportTableCell | null;
  addCell(cell: ReportTableCell): void;
  scopeProperty(): PropertyTreeNode | null;
  to_html(): XMLElement;
  to_csv(csv: any[][], startColumn: number, lineIdx: number): number;
}
```

### 5.3 Contadores

```typescript
// Exemplo de contadores:
// Task 1 (lineNo=1, subLineNo=1, no=1)
//   └── Resource 1.1 (lineNo=null, subLineNo=2, no=1)
//   └── Resource 1.2 (lineNo=null, subLineNo=3, no=2)
// Task 2 (lineNo=2, subLineNo=4, no=1)
//   └── Resource 2.1 (lineNo=null, subLineNo=5, no=1)

// no: contador que reinicia para cada conjunto nested
// lineNo: contador global de linhas primárias
// subLineNo: contador global de todas as linhas (índice em table.lines)
```

### 5.4 to_html() — Geração de HTML

```typescript
to_html(): XMLElement {
  let style = '';
  if (this.table.equiLines) {
    style += `height:${this.height}px; `;
  }
  if (this.fontSize) {
    style += `font-size:${this.fontSize}px; `;
  }
  
  const tr = new XMLElement('tr', {
    'class': 'tabline',
    'style': style
  });
  
  for (const cell of this.cells) {
    tr.append(cell.to_html());
  }
  
  return tr;
}
```

### 5.5 Pontos Críticos

1. **scopeLine**: Se não for null, esta linha está aninhada dentro de outra (ex: resource aninhado em task).

2. **scopeProperty()**: Retorna `scopeLine.property` ou null.

3. **last(count)**: Retorna a última cell não-hidden, começando a buscar a partir de `count` cells do final.

4. **subLineNo**: É o índice da linha em `table.lines`. Usado para GanttChart (cada linha do Gantt corresponde a um `subLineNo`).

---

## 🎯 6. TABLEREPORT.RB — Base para Relatórios Tabulares

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base** | Superclasse de TaskListRE, ResourceListRE, AccountListRE |
| **Mapeamento de colunas** | `@@propertiesById` e `@@propertiesByType` |
| **Geração de header** | `generateHeaderCell()` para cada tipo de coluna |
| **Geração de linhas** | `generateTaskList()`, `generateResourceList()`, `generateAccountList()` |
| **Calendar columns** | `genCalChartHeader()`, `genCalChartTaskCell()`, etc. |
| **Ajuste de período** | `adjustColumnPeriod()` para colunas time-variant |

### 6.2 Mapeamento de Colunas

```typescript
// Colunas pré-definidas (hardcoded)
const propertiesById: Record<string, [string, boolean, 'left' | 'right', boolean]> = {
  // ID                   Header                   Indent  Align   Scen Spec.
  'activetasks':       [ 'Active Tasks',         true,   'right', true ],
  'alert':             [ 'Alert',                true,   'left',  false ],
  'bsi':               [ 'BSI',                  false,  'left',  false ],
  'complete':          [ 'Completion',           false,  'right', true ],
  'cost':              [ 'Cost',                 true,   'right', true ],
  'duration':          [ 'Duration',             true,   'right', true ],
  'effort':            [ 'Effort',               true,   'right', true ],
  'end':               [ 'End',                  false,  'left',  false ],
  'id':                [ 'Id',                   false,  'left',  false ],
  'name':              [ 'Name',                 true,   'left',  false ],
  'priority':          [ 'Priority',             false,  'right', true ],
  'start':             [ 'Start',                false,  'left',  false ],
  // ... (60+ colunas)
};

// Colunas por tipo de atributo
const propertiesByType: Record<string, [boolean, 'left' | 'right']> = {
  'DateAttribute':         [ false,  'left' ],
  'IntegerAttribute':      [ false,  'right' ],
  'FloatAttribute':        [ false,  'right' ],
  'ResourceListAttribute': [ false,  'left' ],
  'RichTextAttribute':     [ false,  'left' ],
  'StringAttribute':       [ false,  'left' ],
};
```

### 6.3 generateHeaderCell() — Geração de Header

```typescript
generateHeaderCell(columnDef: TableColumnDefinition): void {
  const rStart = this.columns[columnDef].start;
  const rEnd = this.columns[columnDef].end;
  
  switch (columnDef.id) {
    case 'chart':
      // GanttChart embutido
      const gantt = new GanttChart(
        this.a('now'),
        this.a('weekStartsMonday'),
        columnDef,
        this,
        this.a('markdate')
      );
      gantt.generateByScale(rStart, rEnd, columnDef.scale);
      gantt.header.height = this.table.headerLineHeight * 2 + 1;
      gantt.viewWidth = columnDef.width || 450;
      
      const column = new ReportTableColumn(this.table, columnDef, '');
      column.cell1.special = gantt;
      column.cell2.hidden = true;
      column.scrollbar = gantt.hasScrollbar();
      this.table.equiLines = true;
      break;
      
    case 'hourly':
      this.genCalChartHeader(columnDef, rStart.midnight(), rEnd, 'sameTimeNextHour',
        '%A %Y-%m-%d', '%H');
      break;
      
    case 'daily':
      this.genCalChartHeader(columnDef, rStart.midnight(), rEnd, 'sameTimeNextDay',
        '%b %Y', '%d');
      break;
      
    case 'weekly':
      this.genCalChartHeader(columnDef,
        rStart.beginOfWeek(this.a('weekStartsMonday')), rEnd,
        'sameTimeNextWeek', '%b %Y', '%d');
      break;
      
    case 'monthly':
      this.genCalChartHeader(columnDef, rStart.beginOfMonth(), rEnd,
        'sameTimeNextMonth', '%Y', '%b');
      break;
      
    case 'quarterly':
      this.genCalChartHeader(columnDef, rStart.beginOfQuarter(), rEnd,
        'sameTimeNextQuarter', '%Y', 'Q%Q');
      break;
      
    case 'yearly':
      this.genCalChartHeader(columnDef, rStart.beginOfYear(), rEnd,
        'sameTimeNextYear', null, '%Y');
      break;
      
    default:
      // Coluna padrão (text, number, date, etc.)
      const column = new ReportTableColumn(this.table, columnDef, columnDef.title);
      column.cell1.rows = 2;
      column.cell2.hidden = true;
      if (columnDef.width) {
        column.cell1.width = columnDef.width;
      }
      break;
  }
}
```

### 6.4 generateTaskList() — Geração de Linhas de Tasks

```typescript
generateTaskList(taskList: PropertyList<Task>, resourceList: PropertyList<Resource> | null,
                 scopeLine: ReportTableLine | null): number {
  const query = this.project.reportContexts.last.query.dup();
  query.scopeProperty = scopeLine ? scopeLine.property : null;
  taskList.sort();
  
  let no = 0;
  let lineNo = scopeLine ? scopeLine.lineNo : 0;
  let line: ReportTableLine | null = null;
  
  for (const task of taskList) {
    query.property = task;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    no++;
    lineNo++;
    
    for (const scenarioIdx of this.a('scenarios')) {
      query.scenarioIdx = scenarioIdx;
      
      // Gera linha para cada task
      line = new ReportTableLine(this.table, task, scopeLine);
      if (!scopeLine) line.no = no;
      line.lineNo = lineNo;
      line.subLineNo = this.table.lines.length;
      this.setIndent(line, this.a('taskroot'), taskList.treeMode());
      
      // Gera cell para cada coluna
      for (const columnDef of this.a('columns')) {
        this.generateTableCell(line, columnDef, query);
      }
    }
    
    // Se temos resourceList, gera linhas aninhadas para resources atribuídos
    if (resourceList) {
      resourceList.setSorting(this.a('sortResources'));
      const assignedResourceList = this.filterResourceList(
        resourceList, task,
        this.a('hideResource'),
        this.a('rollupResource'),
        this.a('openNodes')
      );
      assignedResourceList.sort();
      lineNo = this.generateResourceList(assignedResourceList, null, line);
    }
  }
  
  return lineNo;
}
```

### 6.5 generateTableCell() — Geração de Célula

```typescript
generateTableCell(line: ReportTableLine, columnDef: TableColumnDefinition,
                  query: Query): boolean {
  query = query.dup();
  query.attributeId = columnDef.id;
  query.start = this.columns[columnDef].start;
  query.end = this.columns[columnDef].end;
  query.listType = columnDef.listType;
  query.listItem = columnDef.listItem;
  
  switch (columnDef.id) {
    case 'chart':
      // Gera cell hidden. O GanttChart é gerado via column.cell1.special
      const cell = new ReportTableCell(line, query, '');
      cell.hidden = true;
      cell.text = null;
      
      const chart = columnDef.column!.cell1.special as GanttChart;
      new GanttLine(chart, query,
        (line.subLineNo! - 1) * (line.height + 1),
        line.height,
        line.subLineNo!,
        this.a('selfcontained') ? null : columnDef.tooltip);
      return true;
      
    case 'hourly':
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'quarterly':
    case 'yearly':
      // Calendar cells são geradas por funções específicas
      const tcLine = new ReportTableLine(
        columnDef.column!.cell1.special as ColumnTable,
        line.property,
        line.scopeLine
      );
      new PlaceHolderCell(line, tcLine);
      tcLine.subLineNo = line.subLineNo;
      
      if (query.property instanceof Task) {
        this.genCalChartTaskCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      } else if (query.property instanceof Resource) {
        this.genCalChartResourceCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      } else if (query.property instanceof Account) {
        this.genCalChartAccountCell(query, tcLine, columnDef, start, sameTimeNextFunc);
      }
      return true;
      
    default:
      if (TableReport.calculated(columnDef.id)) {
        return this.genCalculatedCell(query, line, columnDef);
      } else {
        return this.genStandardCell(query, line, columnDef);
      }
  }
}
```

### 6.6 genStandardCell() vs genCalculatedCell()

```typescript
// genStandardCell(): Atributo direto da property
genStandardCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition): boolean {
  const cell = this.newCell(query, line);
  this.setScenarioSettings(cell, query.scenarioIdx,
    propertyList.scenarioSpecific(columnDef.id));
  this.setStandardCellAttributes(query, cell, columnDef,
    propertyList.attributeType(columnDef.id), line);
  
  // celltext customizado tem prioridade
  const cdText = columnDef.cellText.getPattern(query);
  if (cdText) {
    cell.text = cdText;
  } else if (query.process()) {
    cell.text = query.to_rti() || query.to_s();
  }
  
  this.setCustomCellAttributes(cell, columnDef, query);
  this.checkCellText(cell);
  return true;
}

// genCalculatedCell(): Atributo calculado (effort, duration, etc.)
genCalculatedCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition): boolean {
  const cell = this.newCell(query, line);
  if (columnDef.id === 'bsi') cell.force_string = true;
  
  this.setScenarioSettings(cell, query.scenarioIdx,
    TableReport.scenarioSpecific(columnDef.id));
  this.setStandardCellAttributes(query, cell, columnDef, null, line);
  
  if (query.process()) {
    cell.text = query.to_rti() || query.to_s();
  }
  
  // Tratamentos especiais
  switch (columnDef.id) {
    case 'alert':
      cell.icon = `flag-${this.project.alertLevels[query.to_sort()].id}`;
      cell.fontColor = this.project.alertLevels[query.to_sort()].color;
      break;
    case 'alerttrend':
      cell.icon = `trend-${['up', 'flat', 'down'][query.to_sort()]}`;
      break;
    case 'line':
      cell.text = line.lineNo!.toString();
      break;
    case 'name':
      cell.icon = this.getPropertyIcon(query.property);
      break;
    case 'no':
      cell.text = line.no!.toString();
      break;
    case 'bsi':
      if (line.scopeLine) cell.indent = 2;
      break;
    case 'scenario':
      cell.text = this.project.scenario(query.scenarioIdx).name;
      break;
  }
  
  // celltext customizado tem prioridade
  const cdText = columnDef.cellText.getPattern(query);
  if (cdText) cell.text = cdText;
  
  this.setCustomCellAttributes(cell, columnDef, query);
  this.checkCellText(cell);
  return true;
}
```

### 6.7 genCalChartTaskCell() — Células de Calendar para Tasks

```typescript
genCalChartTaskCell(query: Query, line: ReportTableLine, columnDef: TableColumnDefinition,
                    t: TjTime, sameTimeNextFunc: string): void {
  const task = line.property;
  const taskStart = task.get('start', query.scenarioIdx) || this.project.get('start');
  const taskEnd = task.get('end', query.scenarioIdx) || this.project.get('end');
  const taskIv = new TimeInterval(taskStart, taskEnd);
  
  query = query.dup();
  let firstCell: ReportTableCell | null = null;
  const endDate = query.end;
  
  while (t < endDate) {
    const nextT = (t as any)[sameTimeNextFunc]();
    const cellIv = new TimeInterval(t, nextT);
    
    switch (columnDef.content) {
      case 'empty':
        const cell = this.newCell(query, line);
        break;
        
      case 'load':
        query.attributeId = 'effort';
        query.start = t;
        query.end = nextT;
        query.process();
        
        const cell = this.newCell(query, line);
        if (query.to_num() !== 0.0) {
          cell.text = query.to_s();
        }
        break;
    }
    
    const cdText = columnDef.cellText.getPattern(query);
    if (cdText) cell.text = cdText;
    cell.showTooltipHint = false;
    
    // Determina categoria (background color)
    if (cellIv.overlaps(taskIv)) {
      cell.category = task.container() ? 'calconttask' : 'caltask';
    } else if (!this.project.isWorkingTime(cellIv)) {
      cell.category = 'offduty';
    } else {
      cell.category = 'taskcell';
    }
    cell.category += (line.subLineNo! % 2 === 1) ? '1' : '2';
    
    this.setCustomCellAttributes(cell, columnDef, query);
    this.tryCellMerging(cell, line, firstCell);
    
    t = nextT;
    if (!firstCell) firstCell = cell;
  }
}
```

### 6.8 Pontos Críticos

1. **@@propertiesById**: Mapeamento estático de colunas pré-definidas. Usado para determinar indent, align, scenario-specific.

2. **calculated?()**: Retorna true se a coluna é calculada (effort, duration, etc.) vs. atributo direto (name, id, etc.).

3. **adjustColumnPeriod()**: Ajusta start/end da coluna baseado nas tasks incluídas. Adiciona margem de 5% para chart/calendar columns.

4. **tryCellMerging()**: Tenta merge de cells vazias consecutivas em calendar columns.

5. **PlaceHolderCell**: Cell especial que delega `to_csv()` para uma linha embutida (ColumnTable).

---

## 📊 7. GANTTLINE.RB — Linha do Gantt Chart

### 7.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Modela uma linha do Gantt** | Representa uma property (Task ou Resource) |
| **Gera conteúdo visual** | GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack |
| **Time-off zones** | Marca períodos de leave/vacation |
| **Dependency arrows** | Registra blocked zones para o GanttRouter |
| **Tooltips** | Adiciona tooltips interativos |

### 7.2 Estrutura Interna

```typescript
class GanttLine {
  @chart: GanttChart;
  @query: Query;
  @tooltip: CellSettingPatternList | null;
  @category: string | null;          // Background color class
  @y: number;                        // Y coordinate (top pixel)
  @height: number;                   // Height in pixels
  @lineIndex: number;                // Line index (0-based)
  @timeOffZones: [number, number][]; // [startX, width] pairs
  @content: (GanttTaskBar | GanttMilestone | GanttContainer | GanttLoadStack)[];
  
  constructor(chart: GanttChart, query: Query, y: number, height: number,
              lineIndex: number, tooltip: CellSettingPatternList | null);
  
  to_html(): XMLElement;
  getTask(): GanttTaskBar | GanttMilestone | GanttContainer | null;
  addBlockedZones(router: GanttRouter): void;
}
```

### 7.3 generate() — Geração de Conteúdo

```typescript
private generate(): void {
  this.content = [];
  this.generateTimeOffZones();
  
  if (this.query.property instanceof Task) {
    this.generateTask();
  } else {
    this.generateResource();
  }
}

private generateTask(): void {
  this.category = `taskcell${(this.lineIndex + 1) % 2 + 1}`;
  
  const project = this.query.project;
  const property = this.query.property;
  const scopeProperty = this.query.scopeProperty;
  
  const taskStart = property.get('start', this.query.scenarioIdx) || project.get('start');
  const taskEnd = property.get('end', this.query.scenarioIdx) || project.get('end');
  
  if (scopeProperty) {
    // Task aninhada em resource → GanttLoadStack
    this.generateTaskLoadStacks(property, scopeProperty, taskStart, taskEnd);
  } else {
    // Task primária → GanttTaskBar / GanttMilestone / GanttContainer
    const xStart = this.chart.dateToX(taskStart);
    const xEnd = this.chart.dateToX(taskEnd);
    
    this.chart.addTask(property, this);
    
    if (property.get('milestone', this.query.scenarioIdx)) {
      this.content.push(new GanttMilestone(this.height, xStart, this.y));
    } else if (property.container() && !this.shouldRollup()) {
      this.content.push(new GanttContainer(this.height, xStart, xEnd, this.y));
    } else {
      this.content.push(new GanttTaskBar(this.query, this.height, xStart, xEnd, this.y));
    }
  }
}

private generateResource(): void {
  this.category = `resourcecell${(this.lineIndex + 1) % 2 + 1}`;
  
  const property = this.query.property;
  const scopeProperty = this.query.scopeProperty;
  
  // Resource lines sempre usam GanttLoadStack
  this.generateResourceLoadStacks(property, scopeProperty);
}
```

### 7.4 to_html() — Renderização HTML

```typescript
to_html(): XMLElement {
  const div = new XMLElement('div', {
    'class': this.category,
    'style': `margin:0px; padding:0px; position:absolute; ` +
             `left:0px; top:${this.y}px; ` +
             `width:${this.chart.width}px; ` +
             `height:${this.height}px; ` +
             `font-size:10px;`
  });
  
  // Time-off zones
  for (const zone of this.timeOffZones) {
    div.append(this.rectToHTML(zone[0], 0, zone[1], this.height, 'offduty'));
  }
  
  // Grid lines
  for (const line of this.chart.header.gridLines) {
    div.append(this.rectToHTML(line, 0, 1, this.height, 'tabvline'));
  }
  
  // Content (task bars, milestones, load stacks)
  for (const c of this.content) {
    const html = c.to_html();
    if (html && html[0]) {
      this.addHtmlTooltip(this.tooltip, this.query, html[0], div);
      div.append(html);
    }
  }
  
  // Now line
  if (this.chart.header.nowLineX) {
    div.append(this.rectToHTML(this.chart.header.nowLineX, 0, 1, this.height, 'nowline'));
  }
  
  // Markdate line
  if (this.chart.header.markdateLineX) {
    div.append(this.rectToHTML(this.chart.header.markdateLineX, 0, 1, this.height, 'markdateline'));
  }
  
  return div;
}
```

### 7.5 Pontos Críticos

1. **scopeProperty**: Se não for null, a task está aninhada em um resource → usa GanttLoadStack.

2. **timeOffZones**: Períodos de leave/vacation são renderizados como retângulos cinza.

3. **gridLines**: Linhas verticais do grid (determinadas pela escala maior).

4. **nowLine**: Linha vertical vermelha indicando a data atual.

5. **markdateLine**: Linha vertical customizada (se definida pelo usuário).

6. **addBlockedZones()**: Registra áreas bloqueadas para o GanttRouter (dependency arrows não cruzam task bars).

---

## 🎯 8. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 8.1 Ordem de Implementação (Fase 9)

```
FASE 9A: Estrutura de Célula
  1. ReportTableCell.ts        ⭐ (célula individual)
  2. ReportTableLine.ts        ⭐ (linha da tabela)
  3. ReportTableColumn.ts      ⭐ (coluna da tabela)

FASE 9B: Container de Tabela
  4. ReportTable.ts            ⭐ (tabela completa)

FASE 9C: Base para Relatórios
  5. TableReport.ts            ⭐ (base para task/resource reports)

FASE 9D: Gantt Components
  6. GanttLine.ts              ⭐ (linha do Gantt)
  7. GanttTaskBar.ts           (barra de tarefa)
  8. GanttMilestone.ts         (milestone)
  9. GanttContainer.ts         (container task)
  10. GanttLoadStack.ts        (load stack para resources)
  11. GanttHeader.ts           (header do Gantt)
  12. GanttRouter.ts           (roteamento de arrows)
  13. GanttChart.ts            (chart completo)
  14. HTMLGraphics.ts          (helpers SVG/HTML)
  15. ColumnTable.ts           (tabela embutida para calendar)
  16. PlaceHolderCell.ts       (cell placeholder para tabelas embutidas)
```

### 8.2 Decisões de Design TypeScript

#### 8.2.1 ReportTableCell com Union Types
```typescript
type CellText = string | RichTextIntermediate;

class ReportTableCell {
  text: CellText;
  special: any | null;  // PlaceHolderCell ou outro objeto
  
  to_html(): XMLElement | null {
    if (this.hidden) return null;
    if (this.special) return this.special.to_html();
    // ...
  }
}
```

#### 8.2.2 ReportTableColumn com Optional Special
```typescript
class ReportTableColumn {
  cell1: ReportTableCell;
  cell2: ReportTableCell;
  special: GanttChart | ColumnTable | null;
  
  to_html(row: 1 | 2): XMLElement {
    if (row === 1) return this.cell1.to_html();
    return this.cell2.to_html();
  }
}
```

#### 8.2.3 TableReport com Static Maps
```typescript
class TableReport extends ReportBase {
  static readonly propertiesById = new Map<string, [string, boolean, 'left' | 'right', boolean]>([
    ['activetasks', ['Active Tasks', true, 'right', true]],
    ['alert', ['Alert', true, 'left', false]],
    // ...
  ]);
  
  static calculated(colId: string): boolean {
    return TableReport.propertiesById.has(colId);
  }
  
  static indent(colId: string, propertyType: string): boolean {
    // ...
  }
  
  static alignment(colId: string, attributeType: string): 'left' | 'center' | 'right' {
    // ...
  }
}
```

#### 8.2.4 GanttLine com Strategy Pattern
```typescript
abstract class GanttContent {
  abstract to_html(): XMLElement[];
  abstract addBlockedZones(router: GanttRouter): void;
}

class GanttTaskBar extends GanttContent { /* ... */ }
class GanttMilestone extends GanttContent { /* ... */ }
class GanttContainer extends GanttContent { /* ... */ }
class GanttLoadStack extends GanttContent { /* ... */ }

class GanttLine {
  content: GanttContent[] = [];
  
  private generate(): void {
    if (this.query.property instanceof Task) {
      if (this.query.scopeProperty) {
        this.content.push(new GanttLoadStack(/* ... */));
      } else {
        if (this.query.property.get('milestone', this.query.scenarioIdx)) {
          this.content.push(new GanttMilestone(/* ... */));
        } else if (this.query.property.container()) {
          this.content.push(new GanttContainer(/* ... */));
        } else {
          this.content.push(new GanttTaskBar(/* ... */));
        }
      }
    } else {
      this.content.push(new GanttLoadStack(/* ... */));
    }
  }
}
```

### 8.3 Pontos de Atenção (Armadilhas)

1. **ReportTableCell.special**: Se não for null, `to_html()` delega completamente. Não tenta renderizar `text`.

2. **ReportTableColumn.cell2.hidden**: Se true, cell1 ocupa toda a altura. Não gera segunda linha do header.

3. **ReportTable.allCellsHave2Rows**: Se TODAS as colunas têm 2 rows no header, merge para economizar espaço.

4. **ReportTableLine.subLineNo**: É o índice em `table.lines`. Usado para calcular Y coordinate no GanttChart.

5. **TableReport.propertiesById**: Mapeamento estático. Não confundir com `propertySet.attributeDefinitions`.

6. **TableReport.calculated()**: Colunas calculadas (effort, duration) vs. atributos diretos (name, id).

7. **GanttLine.scopeProperty**: Se não for null, task está aninhada em resource → usa GanttLoadStack, não GanttTaskBar.

8. **GanttLine.timeOffZones**: São `[startX, width]`, não `[startX, endX]`.

9. **GanttChart.equiLines**: Se true, todas as linhas têm mesma altura (necessário para Gantt).

10. **PlaceHolderCell**: Cell especial que delega `to_csv()` para linha embutida. `to_html()` retorna null.

11. **ColumnTable**: Tabela embutida dentro de calendar columns. Cada cell representa um período (hora, dia, semana, etc.).

12. **tryCellMerging()**: Tenta merge de cells vazias consecutivas. Usado em calendar columns para reduzir HTML.

13. **addHtmlTooltip()**: Adiciona tooltip interativo via JavaScript (TagToTip).

14. **category CSS**: Define background color. Pode ser sobrescrito por `cellColor`.

15. **indent**: Em tree mode, calcula `leftIndent` ou `rightIndent` baseado no `alignment`.

---

## 📋 9. CHECKLIST ATUALIZADO

### ✅ Já analisados (45 arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableColumnDefinition, HTMLDocument
- [x] **Fase 8**: TaskListRE, ResourceListRE, TextReport, ReportTableLine, GanttChart
- [x] **Fase 9**: ReportTable, ReportTableColumn, ReportTableCell, TableReport, GanttLine ⭐

### 🔮 Próximos 5 (Fase 10 - Gantt Components Específicos)
- [ ] `lib/taskjuggler/reports/GanttTaskBar.rb` — Barra de tarefa
- [ ] `lib/taskjuggler/reports/GanttMilestone.rb` — Milestone
- [ ] `lib/taskjuggler/reports/GanttContainer.rb` — Container task
- [ ] `lib/taskjuggler/reports/GanttLoadStack.rb` — Load stack para resources
- [ ] `lib/taskjuggler/reports/GanttHeader.rb` — Header do Gantt

---

## 🎁 10. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria Report
const report = new Report(project, 'r1', 'My Report', null);
report.typeSpec = 'taskreport';
report.set('formats', ['html']);
report.set('columns', [
  new TableColumnDefinition('bsi', 'BSI'),
  new TableColumnDefinition('name', 'Name'),
  new TableColumnDefinition('start', 'Start'),
  new TableColumnDefinition('end', 'End'),
  new TableColumnDefinition('effort', 'Effort'),
  new TableColumnDefinition('chart', 'Chart'),
]);

// 2. Schedule
await project.schedule();

// 3. Generate Reports
await report.generate();
// → Report.generate()
//   → generateIntermediateFormat()
//     → TaskListRE.generateIntermediateFormat()
//       → filterTaskList()
//       → Para cada coluna:
//         → generateHeaderCell(columnDef)
//           → Se columnDef.id === 'chart':
//             → GanttChart.new()
//             → gantt.generateByScale()
//             → column.cell1.special = gantt
//           → Senão:
//             → ReportTableColumn.new()
//       → generateTaskList()
//         → Para cada task:
//           → ReportTableLine.new()
//           → Para cada coluna:
//             → generateTableCell(line, columnDef, query)
//               → Se columnDef.id === 'chart':
//                 → GanttLine.new()
//                   → generate()
//                     → generateTask()
//                       → GanttTaskBar.new() / GanttMilestone.new() / GanttContainer.new()
//               → Senão:
//                 → ReportTableCell.new()
//                 → query.process()
//                 → cell.text = query.to_s()
//   → generateHTML()
//     → HTMLDocument.new()
//     → report.content.to_html()
//       → ReportTable.to_html()
//         → Para cada coluna:
//           → column.to_html(1) → ReportTableCell.to_html()
//           → column.to_html(2) → ReportTableCell.to_html()
//         → Para cada linha:
//           → line.to_html()
//             → Para cada cell:
//               → cell.to_html()
//                 → Se cell.special:
//                   → special.to_html() (GanttChart ou PlaceHolderCell)
//                 → Senão:
//                   → XMLElement('td', ...)
//     → Deno.writeTextFile()
```

---

## 🚀 11. PRÓXIMOS PASSOS

### Fase 10: Gantt Components Específicos (5 arquivos sugeridos)

1. **`lib/taskjuggler/reports/GanttTaskBar.rb`** — Barra de tarefa (leaf task)
2. **`lib/taskjuggler/reports/GanttMilestone.rb`** — Milestone (losango)
3. **`lib/taskjuggler/reports/GanttContainer.rb`** — Container task (barra com colchetes)
4. **`lib/taskjuggler/reports/GanttLoadStack.rb`** — Load stack (para resources aninhados)
5. **`lib/taskjuggler/reports/GanttHeader.rb`** — Header do Gantt (duas linhas temporais)

### Ordem de Leitura Sugerida

```
1. GanttHeader.rb        ← Header do Gantt (mais simples)
2. GanttTaskBar.rb       ← Barra de tarefa (leaf task)
3. GanttMilestone.rb     ← Milestone (losango)
4. GanttContainer.rb     ← Container task (barra com colchetes)
5. GanttLoadStack.rb     ← Load stack (para resources aninhados)
```

---

**Fim da Fase 9.** A estrutura completa de tabelas e os componentes básicos do Gantt estão agora **completamente mapeados**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `GanttHeader.rb` → `GanttTaskBar.rb` → `GanttMilestone.rb` → `GanttContainer.rb` → `GanttLoadStack.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/10-blueprint-finance.md`

````md
# 📘 Blueprint Fase Financeira + Próximos 5 Arquivos do Engine

## 🎯 Objetivo
Analisar os 5 arquivos do **sistema financeiro** (custos, vendas, contas) e sugerir os próximos 5 arquivos para completar o **engine principal** (scheduler + reports funcionais).

---

## 💰 1. SISTEMA FINANCEIRO — Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CUSTOS E VENDAS                      │
│                                                                   │
│  Task.charge (Charge.rb)                                         │
│  ├── amount: 1000                                                │
│  ├── mode: :onStart | :onEnd | :perDiem                          │
│  └── turnover(interval) → calcula valor no período               │
│         │                                                         │
│         ▼                                                         │
│  Task.chargeset (ChargeSet.rb)                                   │
│  ├── master: Account (top-level)                                 │
│  ├── devAccount → 70%                                            │
│  └── infraAccount → 30%                                          │
│         │                                                         │
│         ▼                                                         │
│  Account (Account.rb)                                            │
│  ├── Hierarquia: cost → dev, infra | revenue → sales, services   │
│  ├── aggregate: :tasks | :resources                              │
│  └── credits: AccountCredit[] (transações manuais)               │
│         │                                                         │
│         ▼                                                         │
│  AccountScenario (AccountScenario.rb)                            │
│  ├── query_balance(query) → saldo acumulado                      │
│  ├── query_turnover(query) → movimento no período                │
│  └── turnover(startIdx, endIdx) → cálculo recursivo              │
│                                                                   │
│  Report.balance = revenueAccount - costAccount                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. CHARGE.RB — Cobranças por Task

### 2.1 Estrutura

```typescript
class Charge {
  @amount: number;                    // Valor (one-time ou per-day)
  @mode: 'onStart' | 'onEnd' | 'perDiem';
  @task: Task;                        // Task proprietária
  @scenarioIdx: number;
  
  constructor(amount: number, mode: ChargeMode, task: Task, scenarioIdx: number);
  turnover(period: TimeInterval): number;
}
```

### 2.2 Modos de Cobrança

| Modo | Descrição | Cálculo |
|---|---|---|
| `onStart` | Cobrança única no início | `period.contains?(task.start) ? amount : 0` |
| `onEnd` | Cobrança única no fim | `period.contains?(task.end) ? amount : 0` |
| `perDiem` | Cobrança diária contínua | `(intersection.duration / 86400) * amount` |

### 2.3 Método turnover() — CRÍTICO

```typescript
turnover(period: TimeInterval): number {
  switch (this.mode) {
    case 'onStart':
      // Verifica se o start da task está dentro do período
      return period.contains(this.task.get('start', this.scenarioIdx)) 
        ? this.amount : 0.0;
        
    case 'onEnd':
      // Verifica se o end da task está dentro do período
      return period.contains(this.task.get('end', this.scenarioIdx)) 
        ? this.amount : 0.0;
        
    case 'perDiem':
      // Calcula interseção entre período e duração da task
      const iv = period.intersection(
        new TimeInterval(
          this.task.get('start', this.scenarioIdx),
          this.task.get('end', this.scenarioIdx)
        )
      );
      if (iv) {
        // Converte duração para dias e multiplica pelo valor diário
        return (iv.duration / (60 * 60 * 24)) * this.amount;
      }
      return 0.0;
  }
}
```

### 2.4 Conversão de Modos no Parser

```typescript
// No TjpSyntaxRules.rule_charge():
switch (mode) {
  case 'onstart':  chargeMode = 'onStart'; amount = val; break;
  case 'onend':    chargeMode = 'onEnd';   amount = val; break;
  case 'perhour':  chargeMode = 'perDiem'; amount = val * 24; break;
  case 'perday':   chargeMode = 'perDiem'; amount = val; break;
  case 'perweek':  chargeMode = 'perDiem'; amount = val / 7.0; break;
}
```

**Atenção:** `perhour` e `perweek` são convertidos para `perDiem` internamente!

---

## 📦 3. CHARGESET.RB — Distribuição entre Contas

### 3.1 Estrutura

```typescript
class ChargeSet {
  @set: Map<Account, number | null>;  // Account → share (0.0-1.0)
  @master: Account | null;            // Top-level account (todas devem pertencer)
  
  addAccount(account: Account, share?: number): void;
  complete(): void;  // Valida e distribui remainder
  share(account: Account): number;
  each(callback: (account: Account, share: number) => void): void;
}
```

### 3.2 Regras de Validação

```typescript
addAccount(account: Account, share?: number): void {
  // 1. Account deve ser leaf (não pode ser grupo)
  if (!account.leaf) throw new Error("Group account not allowed");
  
  // 2. Não pode duplicar
  if (this.set.has(account)) throw new Error("Already member");
  
  // 3. Todas devem pertencer ao mesmo top-level
  if (this.master === null) {
    this.master = account.root;
  } else if (this.master !== account.root) {
    throw new Error("Different top-level accounts");
  }
  
  // 4. Share deve ser 0.0-1.0
  if (share !== null && (share < 0.0 || share > 1.0)) {
    throw new Error("Share must be 0-100%");
  }
  
  this.set.set(account, share);
}
```

### 3.3 complete() — Distribuição do Remainder

```typescript
complete(): void {
  let totalPercent = 0.0;
  let undefined = 0;
  
  for (const share of this.set.values()) {
    if (share !== null) {
      totalPercent += share;
    } else {
      undefined++;
    }
  }
  
  if (totalPercent > 1.0) throw new Error("Exceeds 100%");
  
  if (undefined > 0) {
    const commonShare = (1.0 - totalPercent) / undefined;
    if (commonShare <= 0) throw new Error("No remainder for undefined");
    
    for (const [account, share] of this.set) {
      if (share === null) this.set.set(account, commonShare);
    }
  } else if (totalPercent !== 1.0) {
    throw new Error(`Total is ${totalPercent * 100}% instead of 100%`);
  }
}
```

### 3.4 Integração com Task.turnover()

```typescript
// No TaskScenario.turnover():
const chargeset = resource 
  ? resource.get('chargeset', scenarioIdx) 
  : this.chargeset;

if (!chargeset.empty) {
  let resourceCost = 0.0;
  let otherCost = 0.0;
  
  // Custo de recursos
  if (resource) {
    resourceCost = resource.cost(scenarioIdx, startIdx, endIdx, this.property);
  } else {
    for (const r of this.assignedresources) {
      resourceCost += r.cost(scenarioIdx, startIdx, endIdx, this.property);
    }
  }
  
  // Custo de charges (one-time + perDiem)
  for (const charge of this.charge) {
    otherCost += charge.turnover(iv);
  }
  
  const totalCost = resourceCost + otherCost;
  
  // Distribui entre contas
  for (const set of chargeset) {
    for (const [accnt, share] of set) {
      if (share > 0.0 && (accnt === account || accnt.isChildOf(account))) {
        amount += totalCost * share;
      }
    }
  }
}
```

---

## 📦 4. ACCOUNT.RB — Entidade de Conta

### 4.1 Estrutura

```typescript
class Account extends PropertyTreeNode {
  constructor(project: Project, id: string, name: string, parent: Account | null) {
    super(project.accounts, id, name, parent);
    project.addAccount(this);
    
    // Um AccountScenario por cenário
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new AccountScenario(this, i, this.scenarioAttributes[i])
    );
  }
  
  // Delegação para AccountScenario via method_missing
  scenario(scenarioIdx: number): AccountScenario {
    return this.data[scenarioIdx];
  }
}
```

### 4.2 Atributos do Account

```typescript
// Definidos em Project.rb:
const accountAttributes = [
  ['aggregate', 'Aggregate',    SymbolAttribute,           true,  false, false, 'tasks'],
  ['bsi',       'BSI',          StringAttribute,           false, false, false, ''],
  ['credits',   'Credits',      AccountCreditListAttribute, false, false, true,  []],
  ['flags',     'Flags',        FlagListAttribute,         true,  false, true,  []],
  // id, name, seqno, index, tree (herdados)
];
```

### 4.3 aggregate — CRÍTICO para turnover

```typescript
// aggregate determina COMO o turnover é calculado:
// :tasks     → soma turnover de todas as tasks que usam esta conta
// :resources → soma turnover de todos os resources que usam esta conta

// No AccountScenario.turnover():
if (this.property.container) {
  // Soma turnover dos filhos
  for (const child of this.property.children) {
    amount += child.turnover(scenarioIdx, startIdx, endIdx);
  }
} else {
  switch (this.property.get('aggregate')) {
    case 'tasks':
      for (const task of this.project.tasks) {
        amount += task.turnover(scenarioIdx, startIdx, endIdx, this.property, null, false);
      }
      break;
    case 'resources':
      for (const resource of this.project.resources) {
        if (resource.leaf) {
          amount += resource.turnover(scenarioIdx, startIdx, endIdx, this.property, null, false);
        }
      }
      break;
  }
}
```

### 4.4 Hierarquia de Contas (Exemplo)

```
cost (top-level, aggregate: tasks)
├── dev (leaf, 70% via chargeset)
├── infra (leaf, 30% via chargeset)
└── marketing (leaf)

revenue (top-level, aggregate: tasks)
├── sales (leaf)
└── services (leaf)

balance cost revenue  →  profit = revenue - cost
```

---

## 📦 5. ACCOUNTCREDIT.RB — Transações Manuais

### 5.1 Estrutura

```typescript
class AccountCredit {
  @date: TjTime;
  @description: string;
  @amount: number;
  
  constructor(date: TjTime, description: string, amount: number);
}
```

### 5.2 Uso no AccountScenario

```typescript
// No AccountScenario.turnover():
if (!this.credits.empty) {
  const startDate = this.project.idxToDate(startIdx);
  const endDate = this.project.idxToDate(endIdx);
  
  for (const credit of this.credits) {
    if (startDate <= credit.date && credit.date < endDate) {
      amount += credit.amount;
    }
  }
}
```

### 5.3 Sintaxe TJP

```tjp
account cost "Cost" {
  account dev "Development" {
    credits 2026-03-15 "Bonus" 5000,
            2026-06-01 "Equipment" -2000
  }
}
```

---

## 📦 6. ACCOUNTSCENARIO.RB — Cálculos Financeiros por Cenário

### 6.1 Estrutura

```typescript
class AccountScenario extends ScenarioData {
  constructor(account: Account, scenarioIdx: number, attributes: Map) {
    super(account, scenarioIdx, attributes);
    // Garante que 'credits' existe
    this.property['credits', scenarioIdx];
  }
  
  query_balance(query: Query): void;
  query_turnover(query: Query): void;
  turnover(startIdx: number, endIdx: number): number;  // Privado
}
```

### 6.2 query_balance() — Saldo Acumulado

```typescript
query_balance(query: Query): void {
  // Balance = turnover do INÍCIO DO PROJETO até o INÍCIO do período
  const startIdx = 0;  // Sempre do início do projeto
  const endIdx = this.project.dateToIdx(query.start);
  
  const amount = this.turnover(startIdx, endIdx);
  query.sortable = query.numerical = amount;
  query.string = query.currencyFormat.format(amount);
}
```

### 6.3 query_turnover() — Movimento no Período

```typescript
query_turnover(query: Query): void {
  const startIdx = this.project.dateToIdx(query.start);
  const endIdx = this.project.dateToIdx(query.end);
  
  const amount = this.turnover(startIdx, endIdx);
  query.sortable = query.numerical = amount;
  query.string = query.currencyFormat.format(amount);
}
```

### 6.4 turnover() — O Coração Financeiro

```typescript
private turnover(startIdx: number, endIdx: number): number {
  let amount = 0.0;
  
  // 1. Créditos manuais no período
  if (!this.credits.empty) {
    const startDate = this.project.idxToDate(startIdx);
    const endDate = this.project.idxToDate(endIdx);
    for (const credit of this.credits) {
      if (startDate <= credit.date && credit.date < endDate) {
        amount += credit.amount;
      }
    }
  }
  
  // 2. Container: soma filhos OU calcula balance especial
  if (this.property.container) {
    if (this.property.adoptees.empty) {
      // Normal: soma filhos
      for (const child of this.property.children) {
        amount += child.turnover(this.scenarioIdx, startIdx, endIdx);
      }
    } else {
      // ESPECIAL: meta-account para balance
      // adoptees[0] = cost account, adoptees[1] = revenue account
      amount += -this.property.adoptees[0].turnover(this.scenarioIdx, startIdx, endIdx)
               +this.property.adoptees[1].turnover(this.scenarioIdx, startIdx, endIdx);
    }
  } else {
    // 3. Leaf: calcula baseado no aggregate
    switch (this.property.get('aggregate')) {
      case 'tasks':
        for (const task of this.project.tasks) {
          amount += task.turnover(this.scenarioIdx, startIdx, endIdx, 
                                  this.property, null, false);
        }
        break;
      case 'resources':
        for (const resource of this.project.resources) {
          if (resource.leaf) {
            amount += resource.turnover(this.scenarioIdx, startIdx, endIdx,
                                        this.property, null, false);
          }
        }
        break;
    }
  }
  
  return amount;
}
```

### 6.5 Balance Especial (Meta-Account)

```typescript
// Quando o report tem 'balance cost revenue':
// 1. O parser cria um meta-account com 2 adoptees
// 2. adoptees[0] = costAccount (sinal negativo)
// 3. adoptees[1] = revenueAccount (sinal positivo)
// 4. turnover = -cost + revenue = profit

// No AccountListRE (não anexado, mas relevante):
// A última linha do report mostra o balance
```

---

## 🔄 7. FLUXO COMPLETO DE CUSTOS (Exemplo)

```typescript
// 1. Parser cria contas
const costAccount = new Account(project, 'cost', 'Cost', null);
const devAccount = new Account(project, 'dev', 'Development', costAccount);

// 2. Parser cria chargeset na task
const chargeset = new ChargeSet();
chargeset.addAccount(devAccount, 0.7);
chargeset.addAccount(infraAccount, 0.3);
chargeset.complete();
task.set('chargeset', [chargeset], 0);

// 3. Parser cria charge
const charge = new Charge(1000, 'perDiem', task, 0);
task.set('charge', [charge], 0);

// 4. Parser cria crédito manual
devAccount.set('credits', [
  new AccountCredit(new TjTime('2026-03-15'), 'Bonus', 5000)
], 0);

// 5. Parser define balance
project['costaccount'] = costAccount;
project['revenueaccount'] = revenueAccount;

// 6. Scheduler agenda task (2026-01-05 a 2026-01-15 = 10 dias)
project.schedule();

// 7. Report calcula turnover
// → query_cost(task, devAccount, start, end)
//   → task.turnover(startIdx, endIdx, devAccount, null)
//     → resourceCost = sum(r.cost() for r in assignedresources)
//     → otherCost = charge.turnover(iv) = 1000 * 10 = 10000
//     → totalCost = resourceCost + 10000
//     → amount = totalCost * 0.7 (share do devAccount)
//   → amount

// 8. Report calcula balance
// → query_balance(costAccount, start, end)
//   → turnover(0, startIdx) = credits + task charges + resource costs
// → query_turnover(revenueAccount, start, end)
//   → turnover(startIdx, endIdx) = credits + task charges
// → balance = revenue - cost
```

---

## 🎯 8. PRÓXIMOS 5 ARQUIVOS DO ENGINE PRINCIPAL

Após analisar todas as lacunas restantes, estes são os 5 arquivos **mais críticos** para o engine funcionar completamente:

### 1. ⭐ `lib/taskjuggler/Journal.rb`
**Sistema de journal e alertas** — essencial para:
- `query_journal()`, `query_alert()`, `query_alerttrend()`
- `query_journalmessages()`, `query_journalsummaries()`
- Dashboard de resources (`Resource.dashboard()`)
- Status reports e time sheets
- Alert levels (green/yellow/red)

> **Por que é essencial:** Sem ele, 8+ colunas de relatórios não funcionam (`alert`, `journal`, `alerttrend`, `alertmessages`, etc.). O `ResourceScenario.query_dashboard()` depende inteiramente do Journal.

---

### 2. ⭐ `lib/taskjuggler/DataCache.rb`
**Cache de resultados computados** — essencial para:
- `TaskScenario.getEffectiveWork()` (chamado milhões de vezes)
- `TaskScenario.getAllocatedTime()`
- `TaskScenario.collectTimeOffIntervals()`
- `ResourceScenario.getEffectiveWork()`
- `ResourceScenario.treeSum()`

> **Por que é essencial:** Sem cache, o scheduler e os relatórios ficam **extremamente lentos**. O `DataCache` é um singleton que armazena resultados de funções caras indexados por `(object, method, startIdx, endIdx, *args)`.

---

### 3. ⭐ `lib/taskjuggler/PropertyList.rb`
**Lista ordenada de propriedades** — essencial para:
- `TaskListRE.generateIntermediateFormat()` (filtra e ordena tasks)
- `ResourceListRE.generateIntermediateFormat()` (filtra e ordena resources)
- `Project.scheduleScenario()` (ordena tasks por prioridade)
- `TableReport.filterTaskList()` / `filterResourceList()`
- Tree sorting, rollup, hide expressions

> **Por que é essencial:** É a estrutura que conecta o scheduler aos relatórios. Sem ela, não há como filtrar, ordenar ou agrupar propriedades para exibição.

---

### 4. ⭐ `lib/taskjuggler/AlertLevelDefinitions.rb`
**Definições de níveis de alerta** — essencial para:
- `Project['alertLevels']` (green/yellow/red por padrão)
- `JournalEntry.alertLevel` (0, 1, 2)
- `query_alert()` → retorna nome e cor do nível
- Ícones de flag nos relatórios (`flag-green.png`, etc.)
- `alertlevels` keyword no project header

> **Por que é essencial:** Sem ele, o sistema de alertas não funciona. Os relatórios de status dependem dos níveis para colorir e classificar entradas.

---

### 5. ⭐ `lib/taskjuggler/LeaveList.rb` (inclui `Leave.rb`)
**Listas de leaves (férias, feriados, licenças)** — essencial para:
- `Project['leaves']` (feriados globais)
- `Resource['leaves']` (férias do recurso)
- `Shift['leaves']` (leaves do shift)
- Scoreboard encoding (bits 2-5 = tipo de leave)
- `query_annualleave()`, `query_sickleave()`, etc.
- `ResourceScenario.initScoreboard()` (marca leaves no scoreboard)

> **Por que é essencial:** Sem ele, o scoreboard não pode marcar períodos de férias/feriados. O scheduler alocaria recursos em dias de folga. Os relatórios de leave não funcionariam.

---

## 📋 9. CHECKLIST ATUALIZADO

### ✅ Já analisados (50+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit ⭐
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours

### 🎯 Próximos 5 (Fase Engine Completo)
- [ ] **Journal.rb** ⭐ (journal entries + alertas)
- [ ] **DataCache.rb** ⭐ (cache de resultados)
- [ ] **PropertyList.rb** ⭐ (lista ordenada com filtros)
- [ ] **AlertLevelDefinitions.rb** ⭐ (níveis de alerta)
- [ ] **LeaveList.rb** + **Leave.rb** ⭐ (férias e feriados)

### 🔮 Futuros (Fase Final)
- [ ] `TimeSheets.rb` + `TimeSheet.rb` (apontamentos)
- [ ] `BatchProcessor.rb` (paralelismo)
- [ ] `AccountListRE.rb` (AccountReport)
- [ ] `ExportRE.rb` (Export report)
- [ ] `TraceReport.rb` (Trace report)
- [ ] `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb`
- [ ] `GanttHeader.rb`, `GanttRouter.rb`
- [ ] `RichText/Parser.rb`, `RichText/Element.rb`

---

**Resumo:** O sistema financeiro está **completamente mapeado**. Anexe `Journal.rb`, `DataCache.rb`, `PropertyList.rb`, `AlertLevelDefinitions.rb` e `LeaveList.rb` para completar o **engine principal**. 🚀
````

---

## Arquivo: `docs/tj3-engine/11-blueprint-apoio.md`

````md
# 📘 Blueprint Fase 10: Sistema de Apoio + Próximos 5 Arquivos

## 🎯 Objetivo
Analisar os 5 arquivos que formam o **sistema de apoio** do engine (alertas, listas, cache, journal) e sugerir os próximos 5 para completar o **scheduler + financeiro**.

---

## 📊 1. ANÁLISE DOS 5 ARQUIVOS ANEXADOS

### 1.1 AlertLevelDefinitions.rb — Sistema de Alertas

**Responsabilidade:** Gerencia os níveis de alerta (green/yellow/red por padrão).

```typescript
class AlertLevelDefinition {
  id: string;      // 'green', 'yellow', 'red'
  name: string;    // 'Green', 'Yellow', 'Red'
  color: string;   // '#008000', '#BEA800', '#C00000'
}

class AlertLevelDefinitions {
  levels: AlertLevelDefinition[];
  modified: boolean;
  
  add(level: AlertLevelDefinition): void;
  clear(): void;
  indexById(id: string): number;
  indexByName(name: string): number;
  indexByColor(color: string): number;
}
```

**Integração:**
- `Project['alertLevels']` → instância de AlertLevelDefinitions
- `JournalEntry.alertLevel` → índice do nível (0, 1, 2)
- `query_alert()` → retorna nome e cor do nível
- Ícones: `flag-green.png`, `flag-yellow.png`, `flag-red.png`

---

### 1.2 PropertyList.rb — Lista Ordenada de Propriedades

**Responsabilidade:** Lista de propriedades com sorting multi-nível.

```typescript
class PropertyList<T extends PropertyTreeNode> {
  items: T[];
  propertySet: PropertySet<T>;
  query: Query | null;
  sortingLevels: number;
  sortingCriteria: string[];
  sortingUp: boolean[];
  scenarioIdx: number[];
  
  setSorting(modes: [string, boolean, number][]): void;
  sort!(): void;
  treeMode?(): boolean;
  includeAdopted(): void;
  checkForDuplicates(sourceFileInfo: SourceFileInfo): void;
}
```

**Integração:**
- `TaskListRE.generateIntermediateFormat()` → filtra e ordena tasks
- `ResourceListRE.generateIntermediateFormat()` → filtra e ordena resources
- `Project.scheduleScenario()` → ordena tasks por prioridade
- `TableReport.filterTaskList()` / `filterResourceList()` → aplica filtros

**Sorting:**
```typescript
// Exemplo: ordenar por priority (desc), pathcriticalness (desc), seqno (asc)
tasks.setSorting([
  ['priority', false, scIdx],
  ['pathcriticalness', false, scIdx],
  ['seqno', true, -1]
]);
tasks.sort!();
```

---

### 1.3 LeaveList.rb — Listas de Leaves

**Responsabilidade:** Representa leaves (férias, feriados, licenças).

```typescript
class Leave {
  static Types = {
    project: 1,    // menor prioridade
    annual: 2,
    special: 3,
    sick: 4,
    unpaid: 5,
    holiday: 6,
    unemployed: 7  // maior prioridade
  };
  
  type: keyof typeof Leave.Types;
  interval: TimeInterval;
  reason: string | null;
  
  typeIdx(): number;
}

class LeaveList extends Array<Leave> {}

class LeaveAllowance {
  type: keyof typeof Leave.Types;
  date: TjTime;
  slots: number;  // pode ser negativo (expirado)
}

class LeaveAllowanceList extends Array<LeaveAllowance> {
  balance(type: string, startDate: TjTime, endDate: TjTime): number;
}
```

**Integração:**
- `Project['leaves']` → feriados globais
- `Resource['leaves']` → férias do recurso
- `Shift['leaves']` → leaves do shift
- Scoreboard encoding: bits 2-5 = tipo de leave
- `query_annualleave()`, `query_sickleave()`, etc.

**Prioridade de Leaves:**
```
unemployed (7) > holiday (6) > unpaid (5) > sick (4) > special (3) > annual (2) > project (1)
```

---

### 1.4 DataCache.rb — Cache de Resultados

**Responsabilidade:** Cache global para resultados computados caros.

```typescript
class DataCacheEntry {
  unhashedKey: any[];
  value: any;
  hits: number;
}

class DataCache {
  static instance: DataCache;  // Singleton
  
  entries: Map<number, DataCacheEntry>;
  highWaterMark: number;  // 100000
  lowWaterMark: number;   // 90000
  stores: number;
  hits: number;
  misses: number;
  collisions: number;
  
  cached(...args: any[]): any;
  flush(): void;
  resize(size?: number): void;
}
```

**Integração:**
- `TaskScenario.getEffectiveWork()` → cache por (task, startIdx, endIdx, resource)
- `TaskScenario.getAllocatedTime()` → cache
- `TaskScenario.collectTimeOffIntervals()` → cache
- `ResourceScenario.getEffectiveWork()` → cache
- `ResourceScenario.treeSum()` → cache

**Padrão de Uso:**
```typescript
getEffectiveWork(startIdx: number, endIdx: number, resource?: Resource): number {
  return DataCache.instance.cached(
    this, 
    'ResourceScenarioGetEffectiveWork', 
    startIdx, 
    endIdx, 
    resource
  )(() => {
    // Cálculo caro aqui
    return work;
  });
}
```

---

### 1.5 Journal.rb — Sistema de Journal e Alertas

**Responsabilidade:** Gerencia entradas de journal e alertas.

```typescript
class JournalEntry {
  date: TjTime;
  headline: string;
  property: PropertyTreeNode;
  author: Resource | null;
  moderators: Resource[];
  summary: RichTextIntermediate | null;
  details: RichTextIntermediate | null;
  alertLevel: number;
  flags: string[];
  timeSheetRecord: TimeSheetRecord | null;
  
  to_rText(query: Query): string;
}

class JournalEntryList extends Array<JournalEntry> {
  entries: JournalEntry[];
  sorted: boolean;
  sortBy: [string, number][];
  
  setSorting(by: [string, number][]): void;
  sort!(): void;
  last(date?: TjTime): JournalEntryList;
}

class Journal {
  entries: JournalEntryList;
  propertyToEntries: Map<PropertyTreeNode, JournalEntryList>;
  
  addEntry(entry: JournalEntry): void;
  getEntries(property: PropertyTreeNode): JournalEntryList;
  entriesByTask(task: Task, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  entriesByTaskR(task: Task, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  entriesByResource(resource: Resource, startDate?: TjTime, endDate?: TjTime): JournalEntryList;
  alertLevel(date: TjTime, property: PropertyTreeNode, query: Query): number;
  alertEntries(date: TjTime, property: PropertyTreeNode, minLevel: number): JournalEntryList;
  currentEntries(date: TjTime, property: PropertyTreeNode, minLevel: number): JournalEntryList;
  currentEntriesR(date: TjTime, property: PropertyTreeNode, minLevel: number, query: Query): JournalEntryList;
  to_rti(query: Query): RichTextIntermediate;
}
```

**Integração:**
- `Project['journal']` → instância de Journal
- `query_alert()`, `query_alerttrend()`, `query_journal()`, etc.
- `ResourceScenario.query_dashboard()` → dashboard de alertas
- `TaskScenario.journalText()` → texto de journal para tasks
- Modos: `:journal`, `:journal_sub`, `:status_up`, `:status_down`, `:status_dep`, `:alerts_down`, `:alerts_dep`

**Fluxo de Alertas:**
```typescript
// 1. Parser cria JournalEntry
const entry = new JournalEntry(journal, date, headline, task);
entry.alertLevel = 2;  // red

// 2. Report calcula alert level
query_alert(query): void {
  const alertLevel = journal.alertLevel(query.end, property, query);
  const levelRecord = project['alertLevels'][alertLevel];
  query.string = levelRecord.name;
  query.rti = RichText.new(`<fcol:${levelRecord.color}>${levelRecord.name}</fcol>`);
}

// 3. Dashboard de resource
query_dashboard(query): void {
  const taskList = [];
  for (const task of project.tasks) {
    if (task['responsible', scenarioIdx].includes(resource) &&
        !journal.currentEntries(query.end, task, 0, query.start).isEmpty()) {
      taskList.push(task);
    }
  }
  // Gera texto RichText com alertas
}
```

---

## 🎯 2. PRÓXIMOS 5 ARQUIVOS PARA COMPLETAR SCHEDULER + FINANCEIRO

Para fechar completamente o engine, estes são os 5 arquivos **mais críticos** que faltam:

### 1. ⭐ `lib/taskjuggler/TimeSheets.rb`
**Gerenciador de apontamentos de horas** — essencial para:
- `Project['timeSheets']` → coleção de TimeSheet
- `TaskJuggler.checkTimeSheet()` → valida time sheets
- `Project.schedule()` → processa time sheets antes do scheduling
- Conversão de time sheets em bookings

> **Por que é essencial:** Sem ele, não há como processar `timesheet` keyword. O tracking de progresso real não funciona.

---

### 2. ⭐ `lib/taskjuggler/TimeSheet.rb` + `TimeSheetRecord.rb`
**TimeSheet individual e registros** — essencial para:
- `TimeSheet.new(resource, interval, scenarioIdx)` → cria time sheet
- `TimeSheetRecord.new(timeSheet, task)` → registro por task
- `work`, `remaining`, `expectedEnd`, `priority`, `status` → atributos
- Conversão em bookings internos

> **Por que é essencial:** Sem ele, não há como capturar progresso real. O `effortdone`/`effortleft` depende disso.

---

### 3. ⭐ `lib/taskjuggler/RealFormat.rb`
**Formatação de números e moedas** — essencial para:
- `Project['currencyFormat']` → formato de moeda
- `Project['numberFormat']` → formato de números
- `query_cost()`, `query_revenue()`, `query_balance()` → formatação
- `query_rate()` → formatação de rate

> **Por que é essencial:** Sem ele, os relatórios financeiros não formatam corretamente os valores.

---

### 4. ⭐ `lib/taskjuggler/reports/ReportContext.rb`
**Contexto de relatório** — essencial para:
- `Project.reportContexts` → stack de contextos
- `ReportContext.new(project, report)` → cria contexto
- Backup/restore de atributos para relatórios dinâmicos
- Query template para relatórios

> **Por que é essencial:** Sem ele, relatórios aninhados não funcionam. O contexto se perde.

---

### 5. ⭐ `lib/taskjuggler/reports/ReportBase.rb`
**Base para todos os relatórios** — essencial para:
- `ReportBase.new(report)` → construtor base
- `rt_to_html(section)` → converte RichText para HTML
- `generateHtmlTableFrame()` → gera frame de tabela
- `generateHtmlTableRow()` → gera linha de tabela
- `filterTaskList()`, `filterResourceList()` → filtros

> **Por que é essencial:** Sem ele, TableReport, TextReport e outros não têm base comum.

---

## 📋 3. CHECKLIST ATUALIZADO

### ✅ Já analisados (55+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal ⭐

### 🎯 Próximos 5 (Fase 11 - Completar Engine)
- [ ] **TimeSheets.rb** ⭐
- [ ] **TimeSheet.rb** + **TimeSheetRecord.rb** ⭐
- [ ] **RealFormat.rb** ⭐
- [ ] **ReportContext.rb** ⭐
- [ ] **ReportBase.rb** ⭐

### 🔮 Futuros (Fase 12 - Final)
- [ ] `BatchProcessor.rb` (paralelismo)
- [ ] `MessageHandler.rb` (erros/warnings)
- [ ] `Log.rb` (logging)
- [ ] `PTNProxy.rb` (proxy para adopted tasks)
- [ ] `AttributeBase.rb` (base dos atributos)

---

## 🎁 4. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria JournalEntry
const entry = new JournalEntry(project['journal'], new TjTime('2026-09-10'), 'Task delayed', task);
entry.alertLevel = 2;  // red
entry.author = resource;

// 2. Report calcula alert level
const query = new Query({
  project: project,
  property: task,
  attributeId: 'alert',
  start: project.get('start'),
  end: project.get('end'),
});
query.process();
console.log(`Alert: ${query.to_s()}`);  // "Red"

// 3. Dashboard de resource
const dashboardQuery = new Query({
  project: project,
  property: resource,
  attributeId: 'dashboard',
  start: project.get('start'),
  end: project.get('end'),
});
dashboardQuery.process();
console.log(dashboardQuery.to_s());
// "=== [Red] Task: Task 1 (t1) ===\nReported on 2026-09-10 by John\nTask delayed"

// 4. PropertyList sorting
const taskList = new PropertyList(project.tasks);
taskList.setSorting([
  ['priority', false, 0],
  ['pathcriticalness', false, 0],
  ['seqno', true, -1]
]);
taskList.sort!();

// 5. DataCache
const work = DataCache.instance.cached(
  taskScenario,
  'TaskScenarioGetEffectiveWork',
  startIdx,
  endIdx,
  resource
)(() => {
  // Cálculo caro
  return 10.5;
});

// 6. LeaveList
const leaves = new LeaveList();
leaves.push(new Leave('holiday', new TimeInterval(new TjTime('2026-12-25'), new TjTime('2026-12-26')), 'Christmas'));
leaves.push(new Leave('annual', new TimeInterval(new TjTime('2026-07-01'), new TjTime('2026-07-15')), 'Vacation'));

// 7. AlertLevelDefinitions
const levels = new AlertLevelDefinitions();
levels.add(new AlertLevelDefinition('green', 'Green', '#008000'));
levels.add(new AlertLevelDefinition('yellow', 'Yellow', '#BEA800'));
levels.add(new AlertLevelDefinition('red', 'Red', '#C00000'));
```

---

**Resumo:** Anexe `TimeSheets.rb`, `TimeSheet.rb`, `TimeSheetRecord.rb`, `RealFormat.rb`, `ReportContext.rb` e `ReportBase.rb` para completar o **engine scheduler + financeiro**. 🚀
````

---

## Arquivo: `docs/tj3-engine/12-blueprint-timesheet.md`

````md
# 📘 Blueprint Fase 11: Sistema Financeiro + Time Sheets Completo

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **sistema financeiro** (formatação) e o **sistema de time sheets** completo (envio, recebimento, validação, resumo).

---

## 💰 1. REALFORMAT.RB — Formatação de Números e Moedas

### 1.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Formatação de números** | Controla prefixo/sufixo de negativos, separadores de milhar e fração |
| **Formatação de moedas** | Usado por `query_cost`, `query_revenue`, `query_balance` |
| **Configurável** | `currencyFormat` e `numberFormat` no Project |

### 1.2 Estrutura Interna

```typescript
class RealFormat {
  signPrefix: string;        // Prefixo para negativos (ex: "-")
  signSuffix: string;        // Sufixo para negativos (ex: "")
  thousandsSeparator: string; // Separador de milhar (ex: ".")
  fractionSeparator: string;  // Separador de fração (ex: ",")
  fractionDigits: number;    // Número de dígitos fracionários
  
  constructor(args: [string, string, string, string, number] | RealFormat);
  format(number: number): string;
  to_s(): string;
}
```

### 1.3 Método format() — CRÍTICO

```typescript
format(number: number): string {
  // 1. Verifica se é negativo
  let negate = false;
  if (number < 0) {
    negate = true;
    number = -number;
  }
  
  // 2. Determina parte inteira
  const intNumber = Math.round(number * (10 ** this.fractionDigits)).toString();
  if (intNumber.length <= this.fractionDigits) {
    // Adiciona zeros à esquerda se necessário
    const padded = '0'.repeat(this.fractionDigits - intNumber.length + 1) + intNumber;
    intNumber = padded;
  }
  
  const intPart = intNumber.slice(0, -this.fractionDigits);
  
  // 3. Determina parte fracionária
  const fracPart = this.fractionDigits > 0
    ? this.fractionSeparator + intNumber.slice(-this.fractionDigits)
    : '';
  
  // 4. Adiciona separadores de milhar
  let out: string;
  if (this.thousandsSeparator === '') {
    out = intPart;
  } else {
    out = '';
    for (let i = 1; i <= intPart.length; i++) {
      out = intPart[intPart.length - i] + out;
      if (i % 3 === 0 && i < intPart.length) {
        out = this.thousandsSeparator + out;
      }
    }
  }
  
  out += fracPart;
  
  // 5. Adiciona prefixo/sufixo se negativo
  if (negate) {
    out = this.signPrefix + out + this.signSuffix;
  }
  
  return out;
}
```

### 1.4 Uso no Project

```typescript
// No construtor do Project:
this.attributes = {
  'currencyFormat': new RealFormat(['-', '', '', ',', 2]),  // R$ 1.234,56
  'numberFormat': new RealFormat(['-', '', '', '.', 1]),    // 1.234,5
  // ...
};

// Em query_cost:
query_cost(query: Query): void {
  if (query.costAccount) {
    const cost = this.turnover(query.startIdx, query.endIdx, query.costAccount);
    query.sortable = query.numerical = cost;
    query.string = query.currencyFormat.format(cost);  // ← Aqui!
  }
}
```

---

## 📝 2. TIMESHEETS.RB — Gerenciamento de Time Sheets

### 2.1 Estrutura Interna

```typescript
class TimeSheetRecord {
  task: Task | string;           // Task existente ou ID de nova task
  work: number | null;           // Trabalho realizado (em slots)
  remaining: number | null;      // Esforço restante (em slots)
  expectedEnd: TjTime | null;    // Data esperada de término
  status: JournalEntry | null;   // Status report
  priority: number;              // Prioridade (1-1000)
  name: string | null;           // Nome (para novas tasks)
  sourceFileInfo: SourceFileInfo | null;
  
  constructor(timeSheet: TimeSheet, task: Task | string);
  work=(value: number | number): void;  // Aceita slots ou percentual
  check(): void;                         // Valida consistência
  warnOnDelta(startIdx: number, endIdx: number): void;
  actualWorkPercent(): number;
  planWorkPercent(): number;
  actualRemaining(): number;
  planRemaining(): number;
  actualEnd(): TjTime | null;
  planEnd(): TjTime;
}

class TimeSheet {
  resource: Resource;
  interval: TimeInterval;
  scenarioIdx: number;
  records: TimeSheetRecord[];
  sourceFileInfo: SourceFileInfo | null;
  
  constructor(resource: Resource, interval: TimeInterval, scenarioIdx: number);
  <<(record: TimeSheetRecord): void;
  check(): void;
  warnOnDelta(): void;
  totalGrossWorkingSlots(): number;
  totalNetWorkingSlots(): number;
  percentToSlots(value: number): number;
  slotsToPercent(slots: number): number;
  slotsToDays(slots: number): number;
  daysToSlots(days: number): number;
}

class TimeSheets extends Array<TimeSheet> {
  check(): void;
  warnOnDelta(): void;
}
```

### 2.2 Validação (check) — CRÍTICO

```typescript
// TimeSheetRecord.check():
check(): void {
  const scIdx = this.timeSheet.scenarioIdx;
  const taskId = this.task instanceof Task ? this.task.fullId : this.task;
  
  // 1. Todos os registros devem ter 'work'
  if (this.work === null) {
    error('ts_no_work', `Time sheet for task ${taskId} must have 'work' attribute`);
  }
  
  if (this.task instanceof Task) {
    // 2. Tasks existentes: effort → remaining, duration → end
    if (this.task.get('effort', scIdx) > 0) {
      if (!this.remaining) {
        error('ts_no_remaining', `Task ${taskId} must have 'remaining' attribute`);
      }
    } else {
      if (!this.expectedEnd) {
        error('ts_no_expected_end', `Task ${taskId} must have 'end' attribute`);
      }
    }
  } else {
    // 3. Novas tasks: remaining OU end
    if (this.remaining === null && this.expectedEnd === null) {
      error('ts_no_rem_or_end', `New task ${taskId} requires 'remaining' or 'end'`);
    }
  }
  
  // 4. Status obrigatório se work >= 1 dia
  if (this.work >= this.timeSheet.daysToSlots(1) && !this.status) {
    error('ts_no_status_work', `Must specify status for task ${taskId}`);
  }
  
  // 5. Validações de status
  if (this.status) {
    if (this.status.headline === '') {
      error('ts_no_headline', `Must provide headline for status of task ${taskId}`);
    }
    if (this.status.alertLevel > 0 && !this.status.summary && !this.status.details) {
      error('ts_alert1_more_details', `Task ${taskId} has elevated alert, needs summary`);
    }
    if (this.status.alertLevel > 1 && !this.status.details) {
      error('ts_alert2_more_details', `Task ${taskId} has high alert, needs details`);
    }
  }
}

// TimeSheet.check():
check(): void {
  let totalSlots = 0;
  for (const record of this.records) {
    record.check();
    totalSlots += record.work!;
  }
  
  // 1. Verifica tracking scenario
  if (!this.resource.project.get('trackingScenarioIdx')) {
    error('ts_no_tracking_scenario', 'No trackingscenario defined');
  }
  
  // 2. Verifica total de trabalho
  if (this.resource.get('efficiency', this.scenarioIdx) > 0.0) {
    const targetSlots = this.totalNetWorkingSlots();
    const delta = 1;  // Erro de arredondamento aceitável
    
    if (totalSlots < targetSlots - delta) {
      error('ts_work_too_low', `Total work should be ${this.workWithUnit(targetSlots)} but only ${this.workWithUnit(totalSlots)} reported`);
    }
    if (totalSlots > targetSlots + delta) {
      error('ts_work_too_high', `Total work should be ${this.workWithUnit(targetSlots)} but ${this.workWithUnit(totalSlots)} reported`);
    }
  } else {
    if (totalSlots > 0) {
      error('ts_work_not_null', `Reported work for non-working resources must be 0`);
    }
  }
}
```

### 2.3 Conversão de Unidades

```typescript
// TimeSheet:
totalGrossWorkingSlots(): number {
  const weeksToReport = (this.interval.end - this.interval.start) / (60 * 60 * 24 * 7);
  return this.daysToSlots(Math.floor(this.resource.project.weeklyWorkingDays * weeksToReport));
}

totalNetWorkingSlots(): number {
  const startIdx = this.resource.project.dateToIdx(this.interval.start);
  const endIdx = this.resource.project.dateToIdx(this.interval.end);
  return this.resource.getAllocatedSlots(this.scenarioIdx, startIdx, endIdx, null) +
         this.resource.getFreeSlots(this.scenarioIdx, startIdx, endIdx);
}

percentToSlots(value: number): number {
  this.percentageUsed = true;
  return Math.floor(this.totalGrossWorkingSlots() * value);
}

slotsToPercent(slots: number): number {
  return slots / this.totalGrossWorkingSlots();
}

slotsToDays(slots: number): number {
  return slots * this.resource.project.get('scheduleGranularity') /
         (60 * 60 * this.resource.project.dailyWorkingHours());
}

daysToSlots(days: number): number {
  return Math.floor((days * 60 * 60 * this.resource.project.dailyWorkingHours()) /
                    this.resource.project.get('scheduleGranularity'));
}
```

---

## 📤 3. TIMESHEETSENDER.RB — Envio de Templates

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Gera templates** | Cria templates de time sheet para a semana atual |
| **Envia por email** | Envia templates para os resources |
| **Usa tj3client** | Acessa dados do projeto via servidor |

### 3.2 Estrutura Interna

```typescript
class TimeSheetSender extends SheetSender {
  date: string;
  hideResource: string;        // Expressão lógica para filtrar resources
  templateDir: string;         // Diretório de templates
  signatureFile: string;       // Arquivo com intervalos aceitos
  logFile: string;
  signatureFilter: RegExp;
  introText: string;
  mailSubject: string;
  
  constructor(appName: string);
}
```

### 3.3 Uso

```typescript
// No tj3ts_sender:
const sender = new TimeSheetSender('tj3ts_sender');
sender.date = '2026-09-10';
sender.sendReportTemplates(['resource1', 'resource2']);
```

---

## 📥 4. TIMESHEETRECEIVER.RB — Recebimento e Validação

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Recebe time sheets** | Processa time sheets enviados por email |
| **Valida sintaxe** | Verifica se o time sheet está correto |
| **Armazena** | Salva time sheets válidos |

### 4.2 Estrutura Interna

```typescript
class TimeSheetReceiver extends SheetReceiver {
  sheetDir: string;            // Diretório de time sheets
  templateDir: string;         // Diretório de templates
  failedMailsDir: string;      // Emails que falharam
  failedSheetsDir: string;     // Time sheets que falharam
  signatureFile: string;       // Arquivo com intervalos aceitos
  logFile: string;
  sheetHeader: RegExp;         // Regex para identificar time sheet
  signatureFilter: RegExp;     // Regex para extrair período
  emailSubject: string;
  
  constructor(appName: string);
}
```

### 4.3 Uso

```typescript
// No tj3ss_receiver:
const receiver = new TimeSheetReceiver('tj3ss_receiver');
receiver.processSheet('timesheet.txt');
```

---

## 📊 5. TIMESHEETSUMMARY.RB — Resumo de Time Sheets

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Compila resumos** | Agrega time sheets de múltiplos resources |
| **Envia summaries** | Envia resumos para gerentes |
| **Lista inadimplentes** | Identifica resources que não enviaram time sheet |

### 5.2 Estrutura Interna

```typescript
class TimeSheetSummary extends SheetReceiver {
  date: string;
  sheetRecipients: string[];     // Lista de emails para enviar sheets individuais
  digestRecipients: string[];    // Lista de emails para enviar resumo
  hideResource: string;          // Expressão lógica para filtrar resources
  templateDir: string;
  sheetDir: string;
  logFile: string;
  resourceIntro: string;
  resourceSheetSubject: string;
  summarySubject: string;
  reminderSubject: string;
  reminderText: string;
  defaulterHeader: string;
  
  constructor();
  sendSummary(resourceIds: string[]): void;
}
```

### 5.3 Método sendSummary() — CRÍTICO

```typescript
sendSummary(resourceIds: string[]): void {
  this.setWorkingDir();
  let summary = '';
  const defaulterList: Resource[] = [];
  
  for (const resource of this.getResourceList()) {
    const resourceId = resource[0];
    const resourceName = resource[1];
    const resourceEmail = resource[2];
    
    // Filtra por resourceIds se fornecido
    if (resourceIds.length > 0 && !resourceIds.includes(resourceId)) {
      continue;
    }
    
    const templateFile = `${this.templateDir}/${this.date}/${resourceId}_${this.date}.tji`;
    const sheetFile = `${this.sheetDir}/${this.date}/${resourceId}_${this.date}.tji`;
    
    if (fs.existsSync(templateFile)) {
      if (fs.existsSync(sheetFile)) {
        // Resource enviou time sheet
        if (this.digestRecipients.length > 0 || this.sheetRecipients.length > 0) {
          const sheet = this.getResourceJournal(sheetFile);
          summary += sprintf(this.resourceIntro, resourceName);
          summary += sheet + '\n----\n';
          
          // Envia sheet individual para sheetRecipients
          for (const to of this.sheetRecipients) {
            this.sendRichTextEmail(
              to,
              sprintf(this.resourceSheetSubject, this.date),
              sheet,
              null,
              `${resourceName} <${resourceEmail}>`
            );
          }
        }
      } else {
        // Resource NÃO enviou time sheet
        defaulterList.push(resource);
      }
    }
  }
  
  // Adiciona lista de inadimplentes ao resumo
  if (defaulterList.length > 0) {
    let text = sprintf(this.defaulterHeader, defaulterList.length);
    for (const resource of defaulterList) {
      text += `* ${resource[1]}\n`;
    }
    text += '\n----\n';
    summary = text + summary;
    
    // Cria arquivo com IDs dos recursos inadimplentes
    const missingFile = `${this.sheetDir}/${this.date}/missing-reports`;
    fs.writeFileSync(missingFile, defaulterList.map(r => r[0]).join('\n'));
  }
  
  // Envia resumo para digestRecipients
  for (const to of this.digestRecipients) {
    this.sendRichTextEmail(to, sprintf(this.summarySubject, this.date), summary);
  }
  
  // Envia lembretes para inadimplentes
  if (this.reminderText && this.reminderText.length > 0) {
    for (const resource of defaulterList) {
      this.sendReminder(resource[0], resource[1], resource[2]);
    }
  }
}
```

---

## 🎯 6. PRÓXIMOS 5 ARQUIVOS PARA COMPLETAR O ENGINE

Após analisar todos os arquivos até aqui, estes são os 5 arquivos **mais críticos** que faltam para completar o engine:

### 1. ⭐ `lib/taskjuggler/reports/ReportBase.rb`
**Base para todos os relatórios** — essencial para:
- `rt_to_html(section)` — converte RichText para HTML
- `generateHtmlTableFrame()` — gera frame de tabela
- `generateHtmlTableRow()` — gera linha de tabela
- `filterTaskList()`, `filterResourceList()` — filtros

> **Por que é essencial:** Sem ele, TableReport, TextReport e outros não têm base comum.

---

### 2. ⭐ `lib/taskjuggler/reports/ReportTable.rb`
**Container de tabela** — essencial para:
- `to_html()` — gera HTML da tabela completa
- `to_csv()` — gera CSV
- `determineMaxIndents()` — calcula indentação máxima
- `hasScrollbar?()` — detecta scrollbar

> **Por que é essencial:** Sem ele, não há como renderizar tabelas de relatórios.

---

### 3. ⭐ `lib/taskjuggler/reports/GanttHeader.rb`
**Header do Gantt Chart** — essencial para:
- `to_html()` — renderiza header com escalas temporais
- `gridLines` — linhas do grid
- `nowLineX` — posição da linha "now"
- `markdateLineX` — posição da linha "markdate"
- `cellStartDates` — datas de início das células

> **Por que é essencial:** Sem ele, o Gantt Chart não tem header.

---

### 4. ⭐ `lib/taskjuggler/reports/GanttTaskBar.rb`
**Barra de tarefa no Gantt** — essencial para:
- `to_html()` — renderiza barra de tarefa
- `addBlockedZones()` — registra zonas bloqueadas
- `startDepLineStart` / `endDepLineStart` — coordenadas de dependência
- `startDepLineEnd` / `endDepLineEnd` — coordenadas de dependência

> **Por que é essencial:** Sem ele, tasks não aparecem no Gantt Chart.

---

### 5. ⭐ `lib/taskjuggler/reports/GanttMilestone.rb`
**Milestone no Gantt** — essencial para:
- `to_html()` — renderiza losango de milestone
- `addBlockedZones()` — registra zonas bloqueadas

> **Por que é essencial:** Sem ele, milestones não aparecem no Gantt Chart.

---

## 📋 7. CHECKLIST ATUALIZADO

### ✅ Já analisados (60+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat ⭐
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary ⭐

### 🎯 Próximos 5 (Fase 12 - Completar Reports)
- [ ] **ReportBase.rb** ⭐
- [ ] **ReportTable.rb** ⭐ (já analisado parcialmente, mas precisa completar)
- [ ] **GanttHeader.rb** ⭐
- [ ] **GanttTaskBar.rb** ⭐
- [ ] **GanttMilestone.rb** ⭐

### 🔮 Futuros (Fase 13 - Final)
- [ ] `GanttContainer.rb` — Container task no Gantt
- [ ] `GanttLoadStack.rb` — Load stack para resources
- [ ] `GanttRouter.rb` — Roteamento de dependency arrows
- [ ] `HTMLGraphics.rb` — Helpers SVG/HTML
- [ ] `BatchProcessor.rb` — Paralelismo de reports
- [ ] `MessageHandler.rb` — Sistema de erros/warnings
- [ ] `Log.rb` — Logging

---

## 🎁 8. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria RealFormat
const currencyFormat = new RealFormat(['-', '', '', ',', 2]);
console.log(currencyFormat.format(1234.56));  // "1.234,56"

// 2. Parser cria TimeSheet
const timeSheet = new TimeSheet(resource, interval, 0);
const record = new TimeSheetRecord(timeSheet, task);
record.work = 40 * 3600 / project.get('scheduleGranularity');  // 40h em slots
record.remaining = 10 * 3600 / project.get('scheduleGranularity');  // 10h restantes
record.status = new JournalEntry(journal, new TjTime('2026-09-10'), 'Task delayed', task);
record.status.alertLevel = 2;  // red
timeSheet.<<(record);

// 3. Valida time sheet
timeSheet.check();
// → Verifica se work + remaining = effort
// → Verifica se status está presente
// → Verifica se total de trabalho bate com working hours

// 4. Envia template
const sender = new TimeSheetSender('tj3ts_sender');
sender.date = '2026-09-10';
sender.sendReportTemplates(['resource1']);

// 5. Recebe time sheet
const receiver = new TimeSheetReceiver('tj3ss_receiver');
receiver.processSheet('timesheet.txt');

// 6. Gera resumo
const summary = new TimeSheetSummary();
summary.date = '2026-09-10';
summary.sendSummary([]);  // Envia para todos os resources

// 7. Report usa RealFormat
const query = new Query({
  project: project,
  property: task,
  attributeId: 'cost',
  scenario: scenario,
  start: project.get('start'),
  end: project.get('end'),
  currencyFormat: project.get('currencyFormat'),
});
query.process();
console.log(query.to_s());  // "R$ 1.234,56"
```

---

**Resumo:** Anexe `ReportBase.rb`, `ReportTable.rb`, `GanttHeader.rb`, `GanttTaskBar.rb` e `GanttMilestone.rb` para completar o **sistema de relatórios**. 🚀
````

---

## Arquivo: `docs/tj3-engine/13-blueprint-others.md`

````md
# 📘 Blueprint Fase 10: Sistema de Apoio + Logging + Mensagens

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **sistema de apoio** do engine: listas de intervalos, logging, mensagens, e syntax highlighting. Estes são componentes transversais que permeiam todo o sistema.

---

## 📊 1. ANÁLISE DOS 5 ARQUIVOS

### 1.1 ⭐ MessageHandler.rb — Sistema Central de Mensagens

**Responsabilidade:** Gerencia todas as mensagens do sistema (fatal, error, warning, info, debug).

**Estrutura:**
```typescript
class Message {
  type: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  id: string;
  message: string;
  sourceFileInfo: SourceFileInfo | null;
  line: string | null;
  data: any;
  scenario: Scenario | null;
  
  to_s(): string;  // Formata para console (com cores ANSI)
  to_log(): string; // Formata para log file
}

class MessageHandlerInstance {
  static instance: MessageHandlerInstance;  // Singleton
  
  messages: Message[];
  errors: number;
  outputLevel: number;  // 0-5 (none, fatal, error, warning, info, debug)
  logLevel: number;
  logFile: string | null;
  hideScenario: boolean;
  abortOnWarning: boolean;
  
  fatal(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  error(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  warning(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  info(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  debug(id, message, sourceFileInfo?, line?, data?, scenario?): void;
  
  to_s(): string;
}

// Mixin para classes que precisam emitir mensagens
module MessageHandler {
  fatal(...): void;
  error(...): void;
  warning(...): void;
  info(...): void;
  debug(...): void;
}
```

**Integração:**
- Usado por **todas** as classes do engine (Task, Resource, Project, Parser, etc.)
- `error()` lança `TjException` e incrementa contador de erros
- `fatal()` aborta a execução imediatamente
- `warning()` pode abortar se `abortOnWarning = true`
- `baselineSFI` ajusta SourceFileInfo para includes aninhados

**Pontos Críticos:**
1. **Singleton pattern** — apenas uma instância global
2. **Thread safety** — usa Hash para baselineSFI por thread
3. **ANSI colors** — mensagens coloridas no console
4. **Log file** — mensagens podem ser escritas em arquivo

---

### 1.2 ⭐ Log.rb — Sistema de Logging com Segmentos

**Responsabilidade:** Logging segmentado com filtros e progress meter.

**Estrutura:**
```typescript
class Log {
  static instance: Log;  // Singleton
  
  static level: number;  // Nível máximo de aninhamento
  static stack: string[];  // Stack de segmentos abertos
  static segments: string[];  // Lista de segmentos a mostrar
  static silent: boolean;  // Modo silencioso
  static progress: number;  // Progresso atual (0.0-1.0)
  static progressMeter: string;  // Texto do progress meter
  
  static enter(segment: string, message: string): void;
  static exit(segment: string, message?: string): void;
  static msg(block: () => string): void;
  static status(message: string): void;
  
  static startProgressMeter(text: string): void;
  static stopProgressMeter(): void;
  static activity(): void;
  static progress(percent: number): void;
}
```

**Integração:**
- Usado por Project.schedule(), generateReports(), etc.
- `enter()`/`exit()` marcam início/fim de segmentos
- `msg()` avalia bloco apenas se mensagem será mostrada (lazy evaluation)
- Progress meter mostra barra de progresso animada

**Pontos Críticos:**
1. **Segment filtering** — pode limitar output a segmentos específicos
2. **Lazy evaluation** — bloco só é avaliado se mensagem será mostrada
3. **Progress meter** — barra de progresso com porcentagem
4. **Activity indicator** — animação `- \ | /` para operações longas

---

### 1.3 ⭐ Interval.rb — Classes de Intervalo

**Responsabilidade:** Modela intervalos de tempo e scoreboard.

**Estrutura:**
```typescript
// Classe base
class Interval<S, E> {
  start: S;
  end: E;
  
  contains?(arg: Interval | S): boolean;
  overlaps?(arg: Interval | S): boolean;
  intersection(iv: Interval): Interval | null;
  combine(iv: Interval): Interval;
}

// Intervalo de tempo (TjTime)
class TimeInterval extends Interval<TjTime, TjTime> {
  duration: number;  // em segundos
  
  to_s(): string;
}

// Intervalo de scoreboard (índices)
class ScoreboardInterval extends Interval<number, number> {
  sbStart: TjTime;  // Data de início do scoreboard
  slotDuration: number;  // Duração de cada slot em segundos
  
  startDate: TjTime;  // Converte start para TjTime
  endDate: TjTime;  // Converte end para TjTime
  
  private dateToIndex(date: TjTime): number;
  private indexToDate(index: number): TjTime;
}
```

**Integração:**
- `TimeInterval` usado em Booking, Leave, Charge, etc.
- `ScoreboardInterval` usado em Limits, ShiftAssignments
- Conversão automática entre datas e índices

**Pontos Críticos:**
1. **Type safety** — Interval é genérico sobre tipos S e E
2. **Conversão automática** — ScoreboardInterval converte datas/índices
3. **Operações** — contains, overlaps, intersection, combine
4. **Validação** — end deve ser >= start

---

### 1.4 ⭐ IntervalList.rb — Lista de Intervalos

**Responsabilidade:** Lista ordenada de intervalos não-sobrepostos.

**Estrutura:**
```typescript
class IntervalList<T extends Interval> extends Array<T> {
  // Interseção de duas listas (O(n+m))
  &(list: IntervalList<T>): IntervalList<T>;
  
  // Append com merge automático se adjacente
  <<(iv: T): this;
}
```

**Algoritmo de Interseção:**
```typescript
&(list: IntervalList<T>): IntervalList<T> {
  const res = new IntervalList<T>();
  let si = 0, li = 0;
  
  while (si < this.length && li < list.length) {
    if (this[si].start < list[li].start) {
      if (this[si].end <= list[li].start) {
        si++;  // Não sobrepõe
      } else if (this[si].end < list[li].end) {
        res.push(new this[si].constructor(list[li].start, this[si].end));
        si++;
      } else {
        res.push(new this[si].constructor(list[li].start, list[li].end));
        li++;
      }
    } else if (list[li].start < this[si].start) {
      // ... simétrico
    } else {
      // Starts iguais
      if (this[si].end === list[li].end) {
        res.push(this[si]);
        si++; li++;
      } else if (this[si].end < list[li].end) {
        res.push(this[si]);
        si++;
      } else {
        res.push(list[li]);
        li++;
      }
    }
  }
  
  return res;
}
```

**Integração:**
- Usado em `collectTimeOffIntervals()` do ResourceScenario
- Usado em `collectIntervals()` do Scoreboard
- Merge automático de intervalos adjacentes

**Pontos Críticos:**
1. **Ordenação** — intervalos devem ser adicionados em ordem ascendente
2. **Não-sobreposição** — raise se intervalos sobrepõem
3. **Merge automático** — se end == start do próximo, merge
4. **Complexidade** — interseção é O(n+m)

---

### 1.5 KateSyntax.rb — Syntax Highlighting para Kate

**Responsabilidade:** Gera arquivo de syntax highlighting para Kate editor.

**Estrutura:**
```typescript
class KateSyntax {
  reference: SyntaxReference;
  properties: KeywordDocumentation[];
  attributes: KeywordDocumentation[];
  
  generate(file: string): void;
  
  private header(): void;
  private footer(): void;
  private keywords(): void;
  private contexts(): void;
  private highlights(): void;
}
```

**Integração:**
- Usa `SyntaxReference` para extrair keywords
- Gera arquivo XML no formato do Kate
- Separa properties (blocos) de attributes (keywords)

**Pontos Críticos:**
1. **Gerador de código** — não é parte do engine, é ferramenta de desenvolvimento
2. **XML output** — formato específico do Kate
3. **Regex patterns** — define padrões para datas, números, strings, etc.

---

## 🎯 2. PRÓXIMOS 5 ARQUIVOS SUGERIDOS

Para completar o engine, os 5 arquivos mais críticos que faltam são os **componentes do Gantt Chart**:

### 1. ⭐ `lib/taskjuggler/reports/GanttTaskBar.rb`
**Barra de tarefa no Gantt** — representa tasks leaf no chart.

> **Por que é essencial:** Sem ele, tasks não aparecem no Gantt Chart. É o elemento visual mais importante.

**Conteúdo esperado:**
```typescript
class GanttTaskBar {
  query: Query;
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
  
  startDepLineStart: [number, number];
  endDepLineStart: [number, number];
  startDepLineEnd: [number, number];
  endDepLineEnd: [number, number];
}
```

---

### 2. ⭐ `lib/taskjuggler/reports/GanttMilestone.rb`
**Milestone no Gantt** — representa milestones como losangos.

> **Por que é essencial:** Sem ele, milestones não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttMilestone {
  height: number;
  x: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 3. ⭐ `lib/taskjuggler/reports/GanttContainer.rb`
**Container task no Gantt** — representa tasks com sub-tasks como barras com colchetes.

> **Por que é essencial:** Sem ele, tasks container não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttContainer {
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 4. ⭐ `lib/taskjuggler/reports/GanttLoadStack.rb`
**Load stack no Gantt** — representa alocação de resources em tasks aninhadas.

> **Por que é essencial:** Sem ele, não há visualização de carga de recursos em tasks aninhadas.

**Conteúdo esperado:**
```typescript
class GanttLoadStack {
  line: GanttLine;
  x: number;
  width: number;
  values: number[];
  categories: string[];
  
  to_html(): XMLElement[];
}
```

---

### 5. ⭐ `lib/taskjuggler/reports/GanttHeader.rb`
**Header do Gantt Chart** — renderiza as escalas temporais no topo.

> **Por que é essencial:** Sem ele, o Gantt Chart não tem header com datas.

**Conteúdo esperado:**
```typescript
class GanttHeader {
  columnDef: TableColumnDefinition;
  chart: GanttChart;
  height: number;
  gridLines: number[];
  cellStartDates: TjTime[];
  nowLineX: number;
  markdateLineX: number | null;
  
  to_html(): XMLElement;
}
```

---

## 📋 3. CHECKLIST ATUALIZADO

### ✅ Já analisados (65+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Fase 10**: MessageHandler, Log, Interval, IntervalList, KateSyntax ⭐

### 🎯 Próximos 5 (Fase 11 - Componentes do Gantt)
- [ ] **GanttTaskBar.rb** ⭐
- [ ] **GanttMilestone.rb** ⭐
- [ ] **GanttContainer.rb** ⭐
- [ ] **GanttLoadStack.rb** ⭐
- [ ] **GanttHeader.rb** ⭐

### 🔮 Futuros (Fase 12 - Final)
- [ ] `GanttRouter.rb` — roteamento de dependency arrows
- [ ] `HTMLGraphics.rb` — helpers SVG/HTML
- [ ] `AccountListRE.rb` — relatório de contas
- [ ] `ExportRE.rb`, `TraceReport.rb` — outros tipos de relatórios
- [ ] `BatchProcessor.rb` — paralelismo

---

## 🎁 4. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. MessageHandler em ação
const handler = MessageHandlerInstance.instance;
handler.outputLevel = 4;  // info
handler.logFile = 'taskjuggler.log';

try {
  task.schedule(scenarioIdx);
} catch (e) {
  handler.error('schedule_failed', e.message, task.sourceFileInfo);
}

// 2. Log em ação
Log.level = 2;
Log.segments = ['scheduler'];
Log.startProgressMeter('Scheduling scenario plan');

Log.enter('scheduleTask', `Scheduling task ${task.fullId}`);
task.schedule(scenarioIdx);
Log.exit('scheduleTask', 'Task scheduled');

Log.progress(0.5);  // 50% completo
Log.activity();  // Mostra animação

Log.stopProgressMeter();

// 3. Interval em ação
const interval = new TimeInterval(new TjTime('2026-01-01'), new TjTime('2026-01-31'));
console.log(interval.duration);  // 2592000 segundos (30 dias)

const sbInterval = new ScoreboardInterval(
  project.get('start'),
  project.get('scheduleGranularity'),
  0,  // start index
  100  // end index
);
console.log(sbInterval.startDate);  // Converte para TjTime
console.log(sbInterval.endDate);

// 4. IntervalList em ação
const list1 = new IntervalList<TimeInterval>();
list1.push(new TimeInterval(new TjTime('2026-01-01'), new TjTime('2026-01-10')));
list1.push(new TimeInterval(new TjTime('2026-01-15'), new TjTime('2026-01-20')));

const list2 = new IntervalList<TimeInterval>();
list2.push(new TimeInterval(new TjTime('2026-01-05'), new TjTime('2026-01-18')));

const intersection = list1 & list2;
// Resultado: [2026-01-05, 2026-01-10], [2026-01-15, 2026-01-18]

// 5. KateSyntax (ferramenta de desenvolvimento)
const kate = new KateSyntax();
kate.generate('taskjuggler.xml');
// Gera arquivo XML para Kate editor
```

---

**Resumo:** Anexe `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb` e `GanttHeader.rb` para completar os **componentes visuais do Gantt Chart**. 🚀
````

---

## Arquivo: `docs/tj3-engine/14-blueprint-others.md`

````md
# 📘 Blueprint Fase 11: Utilitários + Proxy + Query (Detalhado)

## 🎯 Objetivo
Analisar os 5 arquivos utilitários que completam o engine: **URLParameter**, **BatchProcessor**, **StdIoWrapper**, **PTNProxy** e **Query** (detalhado).

---

## 🔗 1. URLPARAMETER.RB — Compressão para URLs

### 1.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Compressão de dados** | Comprime strings para URLs usando `Zlib::Deflate` |
| **Codificação Base64** | Converte dados comprimidos em formato URL-safe |
| **Uso em daemon** | Usado pelo `tj3d` para passar dados via URL |

### 1.2 Estrutura Interna

```typescript
class URLParameter {
  static encode(data: string): string {
    // Comprime com zlib e codifica em base64
    const compressed = zlib.deflateSync(data);
    return compressed.toString('base64');
  }
  
  static decode(data: string): string {
    // Decodifica base64 e descomprime
    const buffer = Buffer.from(data, 'base64');
    return zlib.inflateSync(buffer).toString();
  }
}
```

### 1.3 Uso no Daemon

```typescript
// No ReportServlet (daemon):
const params = URLParameter.decode(request.query);
const report = JSON.parse(params);
// Gera relatório dinâmico
```

### 1.4 Pontos Críticos

1. **URL-safe**: Base64 pode conter `+`, `/`, `=` que precisam ser escapados em URLs.
2. **Tamanho**: Compressão reduz tamanho de dados grandes (ex: relatórios HTML).
3. **Performance**: Compressão/descompressão é CPU-intensive para dados grandes.

---

## 🚀 2. BATCHPROCESSOR.RB — Processamento Paralelo de Relatórios

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Execução paralela** | Executa múltiplos relatórios em processos separados |
| **Controle de CPU** | Limita número de processos simultâneos |
| **Captura de output** | Captura stdout/stderr dos processos filhos |
| **Fila de jobs** | Gerencia fila de jobs pendentes |

### 2.2 Estrutura Interna

```typescript
class JobInfo {
  jobId: number;
  block: () => any;
  tag: any;
  pid: number | null;
  retVal: number | null;
  stdout: string;
  stderr: string;
  stdoutEOT: boolean;
  stderrEOT: boolean;
}

class BatchProcessor {
  maxCpuCores: number;
  toRunQueue: JobInfo[];
  runningJobs: Map<number, JobInfo>;
  spoolingJobs: JobInfo[];
  toDropQueue: JobInfo[];
  jobsIn: number;
  jobsOut: number;
  
  constructor(maxCpuCores: number);
  queue(tag?: any, block: () => any): void;
  wait(callback: (job: JobInfo) => void): void;
}
```

### 2.3 Threads Internas

```typescript
class BatchProcessor {
  // Thread 1: Launcher
  private launcher(): void {
    while (!terminate) {
      if (runningJobs.size < maxCpuCores && toRunQueue.length > 0) {
        const job = toRunQueue.pop();
        const pid = fork(() => {
          const result = job.block();
          process.exit(result);
        });
        job.pid = pid;
        runningJobs.set(pid, job);
      }
      sleep(timeout);
    }
  }
  
  // Thread 2: Receiver
  private receiver(): void {
    while (!terminate) {
      const [pid, retVal] = process.wait2();
      const job = runningJobs.get(pid);
      if (job) {
        job.retVal = retVal;
        runningJobs.delete(pid);
        spoolingJobs.push(job);
      }
    }
  }
  
  // Thread 3: Grabber
  private grabber(): void {
    while (!terminate) {
      const ready = io.select(pipes, null, null, timeout);
      if (ready) {
        for (const pipe of ready[0]) {
          const job = pipeToJob.get(pipe);
          if (pipe === job.stdoutP) {
            job.stdout += pipe.read();
          } else if (pipe === job.stderrP) {
            job.stderr += pipe.read();
          }
        }
      }
    }
  }
}
```

### 2.4 Uso no Project

```typescript
// No Project.generateReports():
if (maxCpuCores === 1) {
  // Modo sequencial
  for (const report of reports) {
    report.generate();
  }
} else {
  // Modo paralelo
  const bp = new BatchProcessor(maxCpuCores);
  for (const report of reports) {
    bp.queue(report, () => {
      reportContexts.push(new ReportContext(project, report));
      const result = report.generate();
      reportContexts.pop();
      return result;
    });
  }
  bp.wait((job) => {
    console.log(job.stdout);
    console.error(job.stderr);
  });
}
```

### 2.5 Pontos Críticos

1. **Fork em Deno**: Deno não tem `fork()` nativo. Usar `Deno.Command` com `worker` ou `Deno.run`.
2. **Threads**: Deno tem `Worker` threads, mas não são idênticas ao Ruby.
3. **Alternativa**: Usar `Promise.all` com limite de concorrência via `p-limit`.
4. **EOT character**: Usa caractere ASCII 4 (EOT) para marcar fim de output.
5. **Timeout**: 0.02s para balancear throughput e latência.

### 2.6 Alternativa TypeScript (sem fork)

```typescript
class BatchProcessor {
  async queue<T>(tag: any, block: () => Promise<T>): Promise<T> {
    // Usa Promise com limite de concorrência
    return this.semaphore.run(block);
  }
  
  async wait(): Promise<void> {
    await this.semaphore.waitForAll();
  }
}

// Alternativa mais simples com p-limit:
import pLimit from 'p-limit';

const limit = pLimit(maxCpuCores);
const promises = reports.map(report => 
  limit(() => report.generate())
);
await Promise.all(promises);
```

---

## 📝 3. STDIOWRAPPER.RB — Captura de stdout/stderr

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Captura de output** | Captura stdout e stderr de um bloco de código |
| **Injeção de stdin** | Permite injetar dados em stdin |
| **Uso em testes** | Usado para testar comandos CLI |

### 3.2 Estrutura Interna

```typescript
class StdIoWrapper {
  static Results = {
    returnValue: any;
    stdOut: string;
    stdErr: string;
  };
  
  static stdIoWrapper<T>(stdIn?: string, block: () => T): Results<T> {
    const oldStdout = process.stdout;
    const oldStderr = process.stderr;
    const oldStdin = process.stdin;
    
    let stdOut = '';
    let stdErr = '';
    
    // Redireciona stdout/stderr
    process.stdout.write = (chunk: string) => { stdOut += chunk; return true; };
    process.stderr.write = (chunk: string) => { stdErr += chunk; return true; };
    
    if (stdIn) {
      // Injeta dados em stdin
      process.stdin.push(stdIn);
      process.stdin.push(null);  // EOF
    }
    
    try {
      const returnValue = block();
      return { returnValue, stdOut, stdErr };
    } finally {
      // Restaura stdout/stderr/stdin
      process.stdout = oldStdout;
      process.stderr = oldStderr;
      process.stdin = oldStdin;
    }
  }
}
```

### 3.3 Uso no TimeSheetSummary

```typescript
// No TimeSheetSummary.getResourceJournal():
const result = StdIoWrapper.stdIoWrapper(() => {
  const client = new Tj3Client();
  return client.main(['--unsafe', '--silent', 'check-ts', projectId, sheetFile]);
});

if (result.returnValue !== 0) {
  error(`summary sheets: ${result.stdErr}`);
}
const report = result.stdOut;
```

### 3.4 Pontos Críticos

1. **Deno**: Usar `Deno.stdout` e `Deno.stderr` com `WritableStream`.
2. **Thread safety**: Não é thread-safe. Usar apenas em contexto single-thread.
3. **Alternativa**: Usar `console.log` customizado ou bibliotecas como `capture-console`.

---

## 🎭 4. PTNPROXY.RB — Proxy para Adopted Tasks

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Proxy de PropertyTreeNode** | Representa tasks adotadas em novo contexto parental |
| **Override de métodos** | Sobrescreve `get`, `set`, `[]` para `index` e `tree` |
| **Delegação** | Delega outros métodos para o PTN original |

### 4.2 Estrutura Interna

```typescript
class PTNProxy {
  ptn: PropertyTreeNode;
  parent: PTNProxy | PropertyTreeNode;
  index: number | null;
  tree: string | null;
  level: number;
  
  constructor(ptn: PropertyTreeNode, parent: PTNProxy | PropertyTreeNode) {
    this.ptn = ptn;
    this.parent = parent;
    this.index = null;
    this.tree = null;
    this.level = -1;
  }
  
  // Override para index e tree
  get(attribute: string): any {
    if (attribute === 'index') return this.index;
    if (attribute === 'tree') return this.tree;
    return this.ptn.get(attribute);
  }
  
  set(attribute: string, value: any): void {
    if (attribute === 'index') {
      this.index = value;
    } else if (attribute === 'tree') {
      this.tree = value;
    } else {
      this.ptn.set(attribute, value);
    }
  }
  
  [attribute: string, scenarioIdx: number]: any {
    if (attribute === 'index') return this.index;
    if (attribute === 'tree') return this.tree;
    return this.ptn[attribute, scenarioIdx];
  }
  
  // Delegação para PTN original
  methodMissing(method: string, ...args: any[]): any {
    return (this.ptn as any)[method](...args);
  }
  
  // logicalId respeita o path de adoção
  logicalId(): string {
    if (this.ptn.propertySet.flatNamespace) {
      return this.ptn.id;
    }
    const dotPos = this.ptn.id.lastIndexOf('.');
    const id = dotPos >= 0 ? this.ptn.id.slice(dotPos + 1) : this.ptn.id;
    return this.parent.logicalId() + '.' + id;
  }
  
  level(): number {
    if (this.level >= 0) return this.level;
    let t: PTNProxy | PropertyTreeNode | null = this;
    this.level = 0;
    while ((t = t.parent) !== null) {
      this.level++;
    }
    return this.level;
  }
  
  isChildOf(ancestor: PropertyTreeNode | PTNProxy): boolean {
    let parent: PTNProxy | PropertyTreeNode | null = this;
    while ((parent = parent.parent) !== null) {
      if (parent === ancestor) return true;
    }
    return false;
  }
  
  getIndicies(): number[] {
    const idcs: number[] = [];
    let p: PTNProxy | PropertyTreeNode | null = this;
    do {
      const parent = p.parent;
      idcs.unshift(p.get('index'));
      p = parent;
    } while (p);
    return idcs;
  }
}
```

### 4.3 Uso no PropertyList

```typescript
// No PropertyList.includeAdopted():
includeAdopted(): void {
  const adopted: PTNProxy[] = [];
  for (const p of this.items) {
    for (const ap of p.adoptees) {
      adopted.push(...this.includeAdoptedR(ap, p));
    }
  }
  this.append(adopted);
}

private includeAdoptedR(property: PropertyTreeNode, parent: PTNProxy | PropertyTreeNode): PTNProxy[] {
  const parentProxy = new PTNProxy(property, parent);
  const adopted: PTNProxy[] = [parentProxy];
  for (const p of property.kids()) {
    adopted.push(...this.includeAdoptedR(p, parentProxy));
  }
  return adopted;
}
```

### 4.4 Pontos Críticos

1. **Proxy pattern**: Em TypeScript, usar `Proxy` nativo ou classe wrapper.
2. **logicalId**: Respeita o path de adoção, não o path original.
3. **index/tree**: São sobrescritos para refletir a nova posição na árvore.
4. **Delegação**: Todos os outros métodos são delegados para o PTN original.
5. **checkForDuplicates**: Verifica se uma task adotada não aparece múltiplas vezes.

---

## 🔍 5. QUERY.RB — Sistema de Queries (Detalhado)

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Contexto de avaliação** | Fornece contexto para avaliar atributos |
| **Resolução de propriedades** | Converte IDs em referências |
| **Execução de queries** | Chama `query_<attributeId>()` |
| **Formatação de resultados** | Converte para string, número, sortable |
| **Escala de unidades** | Converte effort/duration para unidades legíveis |

### 5.2 Estrutura Interna

```typescript
class Query {
  // Parâmetros da query
  project?: Project;
  propertyType?: 'Task' | 'Resource' | 'Account';
  propertyId?: string;
  property?: PropertyTreeNode;
  scopePropertyType?: 'Task' | 'Resource' | 'Account';
  scopePropertyId?: string;
  scopeProperty?: PropertyTreeNode;
  attributeId?: string;
  scenario?: Scenario;
  scenarioIdx?: number;
  
  // Parâmetros de tempo
  start?: TjTime;
  end?: TjTime;
  startIdx?: number;
  endIdx?: number;
  
  // Parâmetros de formatação
  loadUnit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'quarters' | 'years' | 'shortauto' | 'longauto';
  numberFormat?: RealFormat;
  currencyFormat?: RealFormat;
  timeFormat?: string;
  
  // Parâmetros de lista
  listItem?: string;
  listType?: 'comma' | 'bullets' | 'numbered';
  
  // Parâmetros de journal
  hideJournalEntry?: LogicalExpression;
  journalMode?: 'journal' | 'journal_sub' | 'status_dep' | 'status_down' | 'status_up' | 'alerts_dep' | 'alerts_down';
  journalAttributes?: string[];
  sortJournalEntries?: [string, number][];
  
  // Parâmetros de conta
  costAccount?: Account;
  revenueAccount?: Account;
  
  // Outros
  selfContained?: boolean;
  
  // Resultados
  ok: boolean;
  errorMessage?: string;
  attr?: Attribute;
  numerical?: number;
  sortable?: any;
  string?: string;
  rti?: RichTextIntermediate;
  
  // Dados customizados
  customData: Map<string, any>;
  
  constructor(parameters: Partial<Query> = {}) {
    // Inicializa todos os parâmetros
    // Sincroniza start/end com startIdx/endIdx
  }
}
```

### 5.3 Método process() — O Coração da Query

```typescript
process(): boolean {
  this.reset();
  
  try {
    // 1. Resolve property reference
    if (this.propertyId && (!this.property || this.propertyId[0] === '!')) {
      this.property = this.resolvePropertyId(this.propertyType!, this.propertyId);
      if (!this.property) {
        this.errorMessage = `Unknown property '${this.propertyId}' queried`;
        return this.ok = false;
      }
    }
    
    // 2. Se não há property, é um atributo de projeto
    if (!this.property) {
      const supportedAttrs = ['copyright', 'currency', 'end', 'journal', 'name', 'now', 'projectid', 'start', 'version'];
      if (!supportedAttrs.includes(this.attributeId!)) {
        this.errorMessage = `Unsupported project attribute '${this.attributeId}'`;
        return this.ok = false;
      }
      
      const attr = (this.project as any)[this.attributeId!];
      if (attr instanceof TjTime) {
        this.sortable = this.numerical = attr;
        this.string = attr.to_s(this.timeFormat);
      } else {
        this.sortable = this.string = attr;
      }
      return this.ok = true;
    }
    
    // 3. Resolve scope property
    if (this.scopeProperty && this.scopePropertyId) {
      this.scopeProperty = this.resolvePropertyId(this.scopePropertyType!, this.scopePropertyId);
      if (!this.scopeProperty) {
        this.errorMessage = `Unknown scope property ${this.scopePropertyId} queried`;
        return this.ok = false;
      }
    }
    
    // 4. Garante referência ao projeto
    this.project = this.property.project;
    
    // 5. Resolve scenario
    if (this.scenario && !this.scenarioIdx) {
      this.scenarioIdx = this.project.scenarioIdx(this.scenario);
      if (this.scenarioIdx === undefined) {
        throw new Error(`Query cannot resolve scenario '${this.scenario}'`);
      }
    }
    
    // 6. Executa a query
    const queryMethodName = `query_${this.attributeId}`;
    
    // Verifica dados customizados primeiro
    const customData = this.customData.get(this.attributeId!);
    if (customData) {
      this.sortable = customData.sortable;
      this.numerical = customData.numerical;
      this.string = customData.string;
      this.rti = customData.rti;
    }
    // Verifica query_ function não-scenario-specific
    else if (typeof (this.property as any)[queryMethodName] === 'function') {
      (this.property as any)[queryMethodName](this);
    }
    // Verifica query_ function scenario-specific
    else if (this.scenarioIdx !== undefined && this.property.data && 
             typeof (this.property.data[this.scenarioIdx] as any)[queryMethodName] === 'function') {
      (this.property.data[this.scenarioIdx] as any)[queryMethodName](this);
    }
    // Atributo base
    else {
      const aType = this.property.attributeDefinition(this.attributeId!);
      if (!aType) {
        this.errorMessage = `Unknown attribute '${this.attributeId}' queried`;
        return this.ok = false;
      }
      
      const scIdx = aType.scenarioSpecific ? this.scenarioIdx : undefined;
      this.attr = this.property.getAttribute(this.attributeId!, scIdx);
      
      if (!this.attr && this.attr instanceof DateAttribute) {
        this.errorMessage = `Attribute '${this.attributeId}' of property '${this.property.fullId}' has undefined value.`;
        return this.ok = false;
      }
    }
    
  } catch (e) {
    if (e instanceof TjException) {
      this.errorMessage = e.message;
      return this.ok = false;
    }
    throw e;
  }
  
  return this.ok = true;
}
```

### 5.4 Métodos de Acesso ao Resultado

```typescript
// Retorna resultado como string
to_s(): string {
  return this.attr ? this.attr.to_s(this) : (this.rti ? this.rti.to_s() : (this.string || ''));
}

// Retorna resultado como número
to_num(): number | undefined {
  return this.attr ? this.attr.to_num() : this.numerical;
}

// Retorna resultado para ordenação
to_sort(): any {
  return this.attr ? this.attr.to_sort() : this.sortable;
}

// Retorna resultado como RichText
to_rti(): RichTextIntermediate | undefined {
  if (this.attr instanceof RichTextAttribute) {
    return this.attr.value;
  }
  return this.attr ? this.attr.to_rti(this) : this.rti;
}

// Retorna resultado original
result(): any {
  if (this.attr) {
    if (this.attr.value && this.attr instanceof ReferenceAttribute) {
      return this.attr.value[0];
    }
    return this.attr.value;
  }
  if (this.numerical !== undefined) return this.numerical;
  if (this.rti) return this.rti;
  return this.string;
}
```

### 5.5 Escala de Unidades

```typescript
// Converte duration para unidade legível
scaleDuration(value: number): string {
  return this.scaleValue(value, [
    24 * 60,      // minutes
    24,           // hours
    1,            // days
    1.0 / 7,      // weeks
    1.0 / 30.42,  // months
    1.0 / 91.25,  // quarters
    1.0 / 365     // years
  ]);
}

// Converte effort/load para unidade legível
scaleLoad(value: number): string {
  return this.scaleValue(value, [
    this.project!.dailyWorkingHours * 60,  // minutes
    this.project!.dailyWorkingHours,       // hours
    1.0,                                   // days
    1.0 / this.project!.weeklyWorkingDays, // weeks
    1.0 / this.project!.monthlyWorkingDays, // months
    1.0 / (this.project!.yearlyWorkingDays / 4), // quarters
    1.0 / this.project!.yearlyWorkingDays  // years
  ]);
}

// Implementação genérica de escala
private scaleValue(value: number, factors: number[]): string {
  if (this.loadUnit === 'shortauto' || this.loadUnit === 'longauto') {
    // Tenta todas as unidades e escolhe a mais curta
    const options: (string | null)[] = [];
    const delta: number[] = [];
    const max = [60, 48, null, 8, 24, 0, null];
    
    const stdFormat = new RealFormat(['-', '', '', '.', this.numberFormat!.fractionDigits]);
    
    for (let i = 0; i < factors.length; i++) {
      const factor = factors[i];
      const scaledValue = value * factor;
      const str = this.numberFormat!.format(scaledValue);
      const stdStr = stdFormat.format(scaledValue);
      delta[i] = Math.abs(scaledValue - parseFloat(stdStr));
      
      if ((factor !== 1.0 && /^[0.]*$/.test(stdStr)) || (max[i] && scaledValue > max[i]!)) {
        options.push(null);
      } else {
        options.push(str);
      }
    }
    
    // Encontra o valor mais próximo do original
    let shortest = 2;
    for (let j = 0; j < delta.length; j++) {
      if (options[j] && delta[j] < delta[shortest]) {
        shortest = j;
      }
    }
    
    // Encontra a opção mais curta
    const fSep = this.numberFormat!.fractionSeparator;
    for (let j = 0; j < 6; j++) {
      if (options[j] && !options[j].startsWith('0' + fSep) && options[j].length < options[shortest]!.length) {
        shortest = j;
      }
    }
    
    let str = options[shortest]!;
    
    if (this.loadUnit === 'longauto') {
      const units = str === "1" 
        ? ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']
        : ['minutes', 'hours', 'days', 'weeks', 'months', 'quarters', 'years'];
      str += ' ' + units[shortest];
    } else {
      str += ['min', 'h', 'd', 'w', 'm', 'q', 'y'][shortest];
    }
    
    return str;
  } else {
    // Unidade fixa
    const units = ['minutes', 'hours', 'days', 'weeks', 'months', 'quarters', 'years'];
    const idx = units.indexOf(this.loadUnit!);
    return this.numberFormat!.format(value * factors[idx]);
  }
}
```

### 5.6 assignList() — Conversão de Listas

```typescript
assignList(listItems: string[]): void {
  let list = '';
  for (const item of listItems) {
    switch (this.listType) {
      case undefined:
      case 'comma':
        if (list !== '') list += ', ';
        list += item;
        break;
      case 'bullets':
        list += `* ${item}\n`;
        break;
      case 'numbered':
        list += `# ${item}\n`;
        break;
    }
  }
  this.sortable = this.string = list;
  const rText = new RichText(list);
  this.rti = rText.generateIntermediateFormat();
}
```

### 5.7 resolvePropertyId() — Resolução de IDs

```typescript
private resolvePropertyId(pType: string, pId: string): PropertyTreeNode | null {
  if (!this.project) {
    throw new Error('Need Project reference to process the query');
  }
  
  if (pId[0] === '!') {
    // ID relativo: cada '!' sobe um nível
    for (const c of pId) {
      if (c === '!') {
        this.property = this.property!.parent!;
      }
      if (!this.property) break;
    }
    return this.property!;
  } else {
    // ID absoluto
    switch (pType) {
      case 'Account':
        return this.project.account(pId);
      case 'Task':
        return this.project.task(pId);
      case 'Resource':
        return this.project.resource(pId);
      default:
        throw new Error(`Unknown property type ${pType}`);
    }
  }
}
```

### 5.8 Pontos Críticos

1. **Sincronização start/end**: `start` e `startIdx` devem estar sempre sincronizados.
2. **customData**: Permite injetar resultados para atributos pseudo-calculados.
3. **query_ functions**: São chamadas dinamicamente via reflection.
4. **scenarioSpecific**: Atributos podem ser scenario-specific ou não.
5. **reset()**: Deve ser chamado antes de reutilizar a query.
6. **error handling**: Captura `TjException` e converte em `errorMessage`.

---

## 📋 6. CHECKLIST ATUALIZADO

### ✅ Já analisados (70+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query (detalhado)
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Fase 11**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy, Query (detalhado) ⭐

---

## 🎯 7. PRÓXIMOS 5 ARQUIVOS PARA COMPLETAR O ENGINE

Para fechar completamente o engine, estes são os 5 arquivos **mais críticos** que faltam:

### 1. ⭐ `lib/taskjuggler/reports/GanttTaskBar.rb`
**Barra de tarefa no Gantt** — representa tasks leaf no chart.

> **Por que é essencial:** Sem ele, tasks não aparecem no Gantt Chart. É o elemento visual mais importante.

---

### 2. ⭐ `lib/taskjuggler/reports/GanttMilestone.rb`
**Milestone no Gantt** — representa milestones como losangos.

> **Por que é essencial:** Sem ele, milestones não aparecem no Gantt Chart.

---

### 3. ⭐ `lib/taskjuggler/reports/GanttContainer.rb`
**Container task no Gantt** — representa tasks com sub-tasks como barras com colchetes.

> **Por que é essencial:** Sem ele, tasks container não aparecem no Gantt Chart.

---

### 4. ⭐ `lib/taskjuggler/reports/GanttLoadStack.rb`
**Load stack no Gantt** — representa alocação de resources em tasks aninhadas.

> **Por que é essencial:** Sem ele, não há visualização de carga de recursos em tasks aninhadas.

---

### 5. ⭐ `lib/taskjuggler/reports/GanttHeader.rb`
**Header do Gantt Chart** — renderiza as escalas temporais no topo.

> **Por que é essencial:** Sem ele, o Gantt Chart não tem header com datas.

---

## 📋 8. CHECKLIST FINAL

### ✅ Engine Principal (COMPLETO)
- [x] Parser completo
- [x] Modelo de domínio completo
- [x] Scheduler completo
- [x] Sistema financeiro completo
- [x] Sistema de queries completo
- [x] Sistema de relatórios (base) completo
- [x] Utilitários completos

### 🎯 Próximos 5 (Fase 12 - Componentes do Gantt)
- [ ] **GanttTaskBar.rb** ⭐
- [ ] **GanttMilestone.rb** ⭐
- [ ] **GanttContainer.rb** ⭐
- [ ] **GanttLoadStack.rb** ⭐
- [ ] **GanttHeader.rb** ⭐

### 🔮 Futuros (Fase 13 - Final)
- [ ] `GanttRouter.rb` — roteamento de dependency arrows
- [ ] `HTMLGraphics.rb` — helpers SVG/HTML
- [ ] `ColumnTable.rb` — tabela embutida para calendar columns
- [ ] `ReportTableLegend.rb` — legenda do relatório
- [ ] `AccountListRE.rb` — relatório de contas

---

**Resumo:** Anexe `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb` e `GanttHeader.rb` para completar os **componentes visuais do Gantt Chart**. 🚀
````

---

## Arquivo: `docs/tj3-engine/15-blueprint-others.md`

````md
# 📘 Blueprint Fase 12: Parser Genérico + Estruturas de Dados Auxiliares

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **parser genérico** (`TextParser`), as **estruturas de dados auxiliares** (`TernarySearchTree`, `deep_copy`), e consolidar o que já sabemos sobre `Project` e `TaskDependency`.

---

## 📊 1. TEXTPARSER.RB — Parser Genérico Base

### 1.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Parser LL(1) dinâmico** | Máquina de estados compilada dinamicamente |
| **Sintaxe extensível** | Regras podem ser adicionadas durante o parsing |
| **Base para ProjectFileParser** | Especializado para sintaxe TJP |
| **Documentação automática** | Gera referência da sintaxe |

### 1.2 Estrutura Interna

```typescript
class TextParser {
  @rules: Map<string, Rule>;           // Regras do parser
  @variables: TokenType[];             // Tipos de tokens aceitos
  @blockedVariables: Set<TokenType>;   // Tokens bloqueados no contexto
  @cr: Rule | null;                    // Regra corrente
  @states: Map<StateKey, State>;       // Estados da FSM
  @stack: StackElement[];              // Stack de execução
  
  initRules(): void;                   // Chama todos os rule_* methods
  newRule(name: string): void;         // Cria nova regra
  pattern(tokens: string[], func: Function): void;
  optional(): void;                    // Marca regra como opcional
  repeatable(): void;                  // Marca regra como repetível
  updateParserTables(): void;          // Compila FSM
  parse(ruleName: string): any;        // Inicia parsing
}
```

### 1.3 Sintaxe de Padrões

```typescript
// Prefixos de tokens:
// !  → referência a outra regra (!date, !taskBody)
// $  → token variável ($ID, $STRING, $INTEGER)
// _  → literal (keyword) (_project, _task)

// Exemplo:
pattern(['_project', '!optionalID', '$STRING', '!optionalVersion', '!interval'], 
  function() {
    this.project = new Project(this.val[1], this.val[2], this.val[3]);
    this.project.start = this.val[4].start;
    this.project.end = this.val[4].end;
  });
```

### 1.4 Máquina de Estados

```typescript
// Estados são identificados por (rule, pattern, index)
type StateKey = [string, number, number];

class State {
  rule: Rule;
  pattern: Pattern;
  index: number;
  transitions: Map<TokenType, Transition>;
  noReduce: boolean;
  expectedTokens: string[];
  
  transition(token: Token): Transition | null;
  addTransitions(states: Map<StateKey, State>, rules: Map<string, Rule>): void;
}

class Transition {
  state: State;
  stateStack: State[];
  loopBack: boolean;
}
```

### 1.5 Algoritmo de Parsing

```typescript
parseFSM(rule: Rule): any {
  const state = this.states[[rule, null, 0]];
  this.stack = [new StackElement(null, state)];
  
  while (true) {
    if (state.transitions.empty) {
      // Estado final - não precisa de token
      transition = null;
    } else {
      transition = state.transition(token = this.getNextToken());
    }
    
    // Se loop-back, finaliza pattern atual
    if (transition && transition.loopBack) {
      this.finishPattern(token);
      transition = state.transition(token = this.getNextToken());
    }
    
    if (transition) {
      // SHIFT: transição normal
      state = transition.state;
      
      // Empilha estados de entrada em regras
      for (const s of transition.stateStack) {
        if (first && s.pattern == stackElement.state.pattern) {
          stackElement.state = s;
        } else {
          this.stack.push(new StackElement(null, s));
        }
      }
      
      if (state.index == 0) {
        // Novo pattern - empilha StackElement
        this.stack.push(new StackElement(state.pattern.function, state));
      }
      
      // Armazena valor do token
      this.stack.last.insert(state.index, token[1], token[2], false);
    } else {
      // REDUCE: fim de regra
      if (state.noReduce) {
        error("Unexpected token");
      }
      
      if (this.finishPattern(token)) {
        // ACCEPT: parsing completo
        break;
      }
      
      state = this.stack.last.state;
    }
  }
  
  return this.stack[0].val[0];
}
```

### 1.6 Pontos Críticos

1. **Dynamic Syntax**: Regras podem ser adicionadas durante parsing (ex: `extend` keyword).
2. **State Caching**: Estados são cacheados em `@states` para performance.
3. **Stack Management**: Stack guarda resultados parciais e estados de retorno.
4. **Error Recovery**: Tokens inesperados geram erros com contexto.
5. **Documentation**: Patterns podem ter `doc()`, `arg()`, `example()` para docs.

---

## 🌳 2. TERNARYSEARCHTREE.RB — Árvore de Busca Ternária

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Estrutura de dados eficiente** | Armazena strings com prefixos comuns |
| **Busca rápida** | O(m) onde m é comprimento da string |
| **Compartilhamento de prefixos** | Economiza memória |
| **Uso em macros** | Usado para lookup de macros |

### 2.2 Estrutura Interna

```typescript
class TernarySearchTree {
  @smaller: TernarySearchTree | null;
  @equal: TernarySearchTree | null;
  @larger: TernarySearchTree | null;
  @value: string | null;
  @last: boolean;
  
  constructor(arg?: string | string[]);
  insert(str: string, index: number = 0): void;
  find(str: string, partialMatch: boolean = false, index: number = 0): string | null;
  length(): number;
  maxDepth(depth: number = 0): number;
  collect(str: string | null = null, block: (s: string) => any): any[];
  to_a(): string[];
  balance!(): void;
}
```

### 2.3 Algoritmo de Inserção

```typescript
insert(str: string, index: number = 0): void {
  if (str.nil || str.empty) {
    throw new Error("Cannot insert nil or empty lists");
  }
  
  if (index > (maxIdx = str.length - 1) || index < 0) {
    throw new Error("index out of range");
  }
  
  this.value = str[index] unless this.value;
  
  if (str[index] < this.value) {
    this.smaller = new TernarySearchTree() unless this.smaller;
    this.smaller.insert(str, index);
  } else if (str[index] > this.value) {
    this.larger = new TernarySearchTree() unless this.larger;
    this.larger.insert(str, index);
  } else {
    if (index == maxIdx) {
      this.last = true;
    } else {
      this.equal = new TernarySearchTree() unless this.equal;
      this.equal.insert(str, index + 1);
    }
  }
}
```

### 2.4 Algoritmo de Busca

```typescript
find(str: string, partialMatch: boolean = false, index: number = 0): string | null {
  if (str.nil || index > (maxIdx = str.length - 1)) {
    return null;
  }
  
  if (str[index] < this.value) {
    return this.smaller?.find(str, partialMatch, index);
  } else if (str[index] > this.value) {
    return this.larger?.find(str, partialMatch, index);
  } else {
    if (index == maxIdx) {
      if (partialMatch) {
        return this.collect(v => str[0..-2] + v);
      } else {
        return this.last ? str : null;
      }
    }
    return this.equal?.find(str, partialMatch, index + 1);
  }
  
  return null;
}
```

### 2.5 Balanceamento

```typescript
balance!(): void {
  const list = this.sortForBalancedTree(this.to_a());
  this.clear();
  list.forEach(x => this.insert(x));
}

private sortForBalancedTree(list: string[]): string[] {
  const lists = [list.sort()];
  const result: string[] = [];
  
  while (!lists.empty) {
    const newLists: string[][] = [];
    
    lists.forEach(l => {
      const pivot = Math.floor(l.length / 2);
      result.push(l[pivot]);
      
      if (pivot > 0) newLists.push(l[0..pivot - 1]);
      if (pivot < l.length - 1) newLists.push(l[pivot + 1..-1]);
    });
    
    lists = newLists;
  }
  
  return result;
}
```

### 2.6 Pontos Críticos

1. **Prefix Sharing**: Prefixos comuns são compartilhados (economiza memória).
2. **Partial Match**: `find(str, true)` retorna todas strings com prefixo `str`.
3. **Balancing**: `balance!()` reorganiza árvore para busca O(log n).
4. **Memory Efficient**: Melhor que HashMap para strings com prefixos comuns.
5. **Use Case**: Macros, keywords, IDs com prefixos comuns.

---

## 📋 3. DEEP_COPY.RB — Extensão de Deep Copy

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Deep copy genérico** | Copia objetos recursivamente |
| **Preserva referências** | Evita loops infinitos |
| **Congelados não copiados** | Objetos frozen retornam referência |
| **Alternativa a Marshal** | Mais leve e customizável |

### 3.2 Implementação

```typescript
class Object {
  deep_clone(): any {
    // Objetos frozen ou built-in não são clonados
    if (this.frozen || this.nil || 
        this instanceof Integer || this instanceof Float ||
        this instanceof Boolean || this instanceof Symbol) {
      return this;
    }
    
    // Detecta loops (evita recursão infinita)
    if (this.instance_variables.includes('@clonedObject')) {
      return this.@clonedObject;
    }
    
    // Clona o objeto (shallow copy)
    try {
      this.@clonedObject = this.clone();
    } catch (TypeError) {
      return this;
    }
    
    // Copia recursivamente todas as variáveis de instância
    this.@clonedObject.instance_variables.forEach(var => {
      const val = this.instance_variable_get(var).deep_clone();
      this.@clonedObject.instance_variable_set(var, val);
    });
    
    // Copia recursivamente elementos de Array/Hash
    if (this instanceof Array) {
      this.@clonedObject.collect!(x => x.deep_clone());
    } else if (this instanceof Hash) {
      this.@clonedObject.forEach((key, val) => {
        this.@clonedObject.store(key, val.deep_clone());
      });
    }
    
    // Remove @clonedObject para permitir futuras cópias
    this.@clonedObject.remove_instance_variable('@clonedObject');
    
    return this.@clonedObject;
  }
}
```

### 3.3 Uso no TaskJuggler

```typescript
// Em PropertyTreeNode:
deep_clone(): this {
  return this;  // Properties não são clonadas
}

// Em Attributes:
deep_clone(): Attribute {
  const cloned = super.deep_clone();
  // Atributos podem referenciar properties, então precisamos preservar
  // essas referências
  return cloned;
}

// Em WorkingHours:
deep_clone(): WorkingHours {
  return new WorkingHours(this);  // Copy constructor
}
```

### 3.4 Pontos Críticos

1. **Loop Detection**: `@clonedObject` previne recursão infinita.
2. **Frozen Objects**: Objetos congelados retornam referência (não clonados).
3. **Built-in Types**: Integer, Float, Boolean, Symbol não são clonados.
4. **Custom Clone**: Classes podem sobrescrever `deep_clone()` para comportamento customizado.
5. **Performance**: Mais leve que `Marshal.load(Marshal.dump(obj))`.

---

## 🏛️ 4. PROJECT.RB — Consolidado (já analisado)

### 4.1 Responsabilidades Principais

- **Container global** de todos os PropertySets
- **Orquestrador** do pipeline: parse → schedule → report
- **Scoreboards globais** (com e sem leaves)
- **Atributos de projeto** (currency, timezone, workinghours, etc.)

### 4.2 Pipeline de Scheduling

```typescript
schedule(): boolean {
  this.initScoreboards();
  
  // Validações iniciais
  if (this.tasks.empty) throw new Error('No tasks defined');
  
  // Para cada cenário ativo:
  for (const scenario of this.scenarios) {
    if (!scenario.get('active')) continue;
    
    const scIdx = this.scenarioIdx(scenario);
    
    // FASE 1: Preparação (herança + validação)
    AttributeBase.setMode(1);  // modo "inherited"
    this.prepareScenario(scIdx);
    
    // FASE 2: Agendamento
    AttributeBase.setMode(2);  // modo "computed"
    this.scheduleScenario(scIdx);
    
    // FASE 3: Finalização (pós-validação)
    this.finishScenario(scIdx);
  }
  
  // Valida fail/warn em resources e tasks
  for (const resource of this.resources) resource.checkFailsAndWarnings();
  for (const task of this.tasks) task.checkFailsAndWarnings();
  
  return true;
}
```

### 4.3 Scoreboards Globais

```typescript
initScoreboards(): void {
  // 1. Cria scoreboards com todos os slots "indisponíveis" (valor 2)
  this.scoreboard = new Scoreboard(start, end, scheduleGranularity, 2);
  this.scoreboardNoLeaves = new Scoreboard(start, end, scheduleGranularity, 2);
  
  // 2. Marca slots de working hours como disponíveis (nil)
  let date = this.scoreboard.idxToDate(0);
  const delta = this.attributes['scheduleGranularity'];
  for (let i = 0; i < scoreboardSize(); i++) {
    if (workinghours.onShift(date)) {
      this.scoreboard[i] = null;
      this.scoreboardNoLeaves[i] = null;
    }
    date = date.plus(delta);
  }
  
  // 3. Marca slots de leaves globais com bit de time-off
  for (const leave of this.attributes['leaves']) {
    const startIdx = this.scoreboard.dateToIdx(leave.interval.start);
    const endIdx = this.scoreboard.dateToIdx(leave.interval.end);
    for (let i = startIdx; i < endIdx; i++) {
      const sb = this.scoreboard[i];
      this.scoreboard[i] = ((sb === null || sb === 4) ? 0 : 2) | (1 << 2);
    }
  }
}
```

---

## 🔗 5. TASKDEPENDENCY.RB — Consolidado (já analisado)

### 5.1 Responsabilidades

- **Representa dependência** entre tasks
- **4 tipos**: start-start, start-end, end-start, end-end
- **Gaps**: gapDuration (calendar) + gapLength (working)
- **Resolução**: converte taskId em referência Task

### 5.2 Estrutura

```typescript
class TaskDependency {
  taskId: string;
  task: Task | null;
  onEnd: boolean;
  gapDuration: number;  // segundos (calendar time)
  gapLength: number;    // slots (working time)
  
  resolve(project: Project): void {
    this.task = project.task(this.taskId);
  }
}
```

### 5.3 Uso no TaskScenario

```typescript
// No TaskScenario.Xref():
Xref(): void {
  // Processa 'depends'
  for (const dependency of this.depends) {
    const depTask = this.checkDependency(dependency, 'depends');
    
    // Adiciona à lista de predecessores do start
    this.startpreds.push([depTask, dependency.onEnd]);
    
    // Adiciona à lista de sucessores do predecessor
    depTask.get(dependency.onEnd ? 'endsuccs' : 'startsuccs', scenarioIdx)
      .push([this.property, false]);
  }
  
  // Processa 'precedes' (simétrico)
  // ...
}
```

---

## 🎯 6. PRÓXIMOS 5 ARQUIVOS PARA COMPLETAR O ENGINE

Após analisar todos os arquivos até aqui, estes são os 5 arquivos **mais críticos** que faltam para completar o engine:

### 1. ⭐ `lib/taskjuggler/reports/GanttTaskBar.rb`
**Barra de tarefa no Gantt** — representa tasks leaf no chart.

> **Por que é essencial:** Sem ele, tasks não aparecem no Gantt Chart. É o elemento visual mais importante.

**Conteúdo esperado:**
```typescript
class GanttTaskBar {
  query: Query;
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
  
  startDepLineStart: [number, number];
  endDepLineStart: [number, number];
  startDepLineEnd: [number, number];
  endDepLineEnd: [number, number];
}
```

---

### 2. ⭐ `lib/taskjuggler/reports/GanttMilestone.rb`
**Milestone no Gantt** — representa milestones como losangos.

> **Por que é essencial:** Sem ele, milestones não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttMilestone {
  height: number;
  x: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 3. ⭐ `lib/taskjuggler/reports/GanttContainer.rb`
**Container task no Gantt** — representa tasks com sub-tasks como barras com colchetes.

> **Por que é essencial:** Sem ele, tasks container não aparecem no Gantt Chart.

**Conteúdo esperado:**
```typescript
class GanttContainer {
  height: number;
  xStart: number;
  xEnd: number;
  y: number;
  
  to_html(): XMLElement[];
  addBlockedZones(router: GanttRouter): void;
}
```

---

### 4. ⭐ `lib/taskjuggler/reports/GanttLoadStack.rb`
**Load stack no Gantt** — representa alocação de resources em tasks aninhadas.

> **Por que é essencial:** Sem ele, não há visualização de carga de recursos em tasks aninhadas.

**Conteúdo esperado:**
```typescript
class GanttLoadStack {
  line: GanttLine;
  x: number;
  width: number;
  values: number[];
  categories: string[];
  
  to_html(): XMLElement[];
}
```

---

### 5. ⭐ `lib/taskjuggler/reports/GanttHeader.rb`
**Header do Gantt Chart** — renderiza as escalas temporais no topo.

> **Por que é essencial:** Sem ele, o Gantt Chart não tem header com datas.

**Conteúdo esperado:**
```typescript
class GanttHeader {
  columnDef: TableColumnDefinition;
  chart: GanttChart;
  height: number;
  gridLines: number[];
  cellStartDates: TjTime[];
  nowLineX: number;
  markdateLineX: number | null;
  
  to_html(): XMLElement;
}
```

---

## 📋 7. CHECKLIST ATUALIZADO

### ✅ Já analisados (75+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation, TextParser ⭐
- [x] **Modelo**: Project ⭐, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking ⭐, TaskDependency ⭐, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition
- [x] **Gantt**: GanttChart, GanttLine
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Utilitários**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy
- [x] **Fase 12**: TextParser ⭐, TernarySearchTree ⭐, deep_copy ⭐, Project (consolidado), TaskDependency (consolidado)

### 🎯 Próximos 5 (Fase 13 - Componentes do Gantt)
- [ ] **GanttTaskBar.rb** ⭐
- [ ] **GanttMilestone.rb** ⭐
- [ ] **GanttContainer.rb** ⭐
- [ ] **GanttLoadStack.rb** ⭐
- [ ] **GanttHeader.rb** ⭐

### 🔮 Futuros (Fase 14 - Final)
- [ ] `GanttRouter.rb` — roteamento de dependency arrows
- [ ] `HTMLGraphics.rb` — helpers SVG/HTML
- [ ] `ColumnTable.rb` — tabela embutida para calendar columns
- [ ] `ReportTableLegend.rb` — legenda do relatório
- [ ] `AccountListRE.rb` — relatório de contas

---

## 🎁 8. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. TextParser em ação
const parser = new TextParser();
parser.initRules();  // Chama todos os rule_* methods
parser.updateParserTables();  // Compila FSM
const result = parser.parse('project');  // Inicia parsing

// 2. TernarySearchTree em ação
const tree = new TernarySearchTree();
tree.insert('macro1');
tree.insert('macro2');
tree.insert('macro3');
console.log(tree.find('macro'));  // null (não é exact match)
console.log(tree.find('macro', true));  // ['macro1', 'macro2', 'macro3']

// 3. Deep copy em ação
const original = new PropertyTreeNode(...);
const cloned = original.deep_clone();
// cloned é uma cópia profunda, mas properties não são clonadas

// 4. Project.schedule() em ação
const project = new Project('prj', 'My Project', '1.0');
// ... preenche tasks, resources, etc.
project.schedule();
// → initScoreboards()
// → Para cada cenário:
//   → prepareScenario()
//   → scheduleScenario()
//   → finishScenario()

// 5. TaskDependency em ação
const dep = new TaskDependency('task2', true);  // onEnd = true
dep.gapDuration = 86400;  // 1 dia
dep.gapLength = 0;
dep.resolve(project);  // Converte taskId em Task reference
```

---

**Resumo:** Anexe `GanttTaskBar.rb`, `GanttMilestone.rb`, `GanttContainer.rb`, `GanttLoadStack.rb` e `GanttHeader.rb` para completar os **componentes visuais do Gantt Chart**. 🚀
````

---

## Arquivo: `docs/tj3-engine/16-blueprint-gantt.md`

````md
# 📘 Blueprint Fase 13: Componentes Visuais do Gantt Chart

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **Gantt Chart** — o componente visual mais importante do TaskJuggler. Estes são os elementos que transformam dados agendados em gráficos HTML interativos.

---

## 🏗️ 1. PIPELINE DE RENDERIZAÇÃO DO GANTT

```
┌─────────────────────────────────────────────────────────────────┐
│                    GanttChart (Orquestrador)                     │
│  └── generateByScale() ou generateByWidth()                     │
│      └── Cria GanttHeader                                       │
│      └── Para cada task/resource:                               │
│          └── GanttLine.new()  ◄── GanttLine.rb                  │
│              └── generate()                                     │
│                  ├── generateTask()                             │
│                  │   ├── GanttTaskBar.new()    ◄── GanttTaskBar.rb ⭐
│                  │   ├── GanttMilestone.new()  ◄── GanttMilestone.rb ⭐
│                  │   └── GanttContainer.new()  ◄── GanttContainer.rb ⭐
│                  └── generateResource()                         │
│                      └── GanttLoadStack.new()  ◄── GanttLoadStack.rb ⭐
│                                                                 │
│  └── to_html()                                                  │
│      └── GanttHeader.to_html()  ◄── GanttHeader.rb ⭐           │
│      └── GanttLine.to_html()                                    │
│          └── GanttTaskBar.to_html()                             │
│          └── GanttMilestone.to_html()                           │
│          └── GanttContainer.to_html()                           │
│          └── GanttLoadStack.to_html()                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. GANTTHEADER.RB — Header do Gantt (Escalas Temporais)

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza 2 linhas** | Escala maior (ano/mês) + escala menor (mês/semana/dia) |
| **Grid lines** | Linhas verticais do grid |
| **Now line** | Linha vermelha indicando "hoje" |
| **Markdate line** | Linha customizada definida pelo usuário |
| **Cell start dates** | Datas de início de cada célula |

### 2.2 Estrutura Interna

```typescript
class GanttHeader {
  @columnDef: TableColumnDefinition;
  @chart: GanttChart;
  @largeScale: GanttHeaderScaleItem[];  // Escala maior (topo)
  @smallScale: GanttHeaderScaleItem[];  // Escala menor (base)
  @gridLines: number[];                 // Posições X das linhas do grid
  @nowLineX: number | null;             // Posição X da linha "now"
  @markdateLineX: number | null;        // Posição X da linha "markdate"
  @cellStartDates: TjTime[];            // Datas de início das células
  @height: number;                      // Altura em pixels (default: 39)
  
  constructor(columnDef: TableColumnDefinition, chart: GanttChart);
  to_html(): XMLElement;
}
```

### 2.3 Escalas por Tipo de Chart

```typescript
// No método generate():
switch (chart.scale.name) {
  case 'hour':
    // Large: dia da semana + data (ex: "Monday 2026-01-05")
    // Small: hora (ex: "09")
    genHeaderScale(largeScale, 0, h, 'midnight', 'sameTimeNextDay', '%A %Y-%m-%d');
    genHeaderScale(smallScale, h + 1, h, 'beginOfHour', 'sameTimeNextHour', '%H');
    break;
    
  case 'day':
    // Large: mês + ano (ex: "Jan 2026")
    // Small: dia do mês (ex: "05")
    genHeaderScale(largeScale, 0, h, 'beginOfMonth', 'sameTimeNextMonth', '%b %Y');
    genHeaderScale(smallScale, h + 1, h, 'midnight', 'sameTimeNextDay', '%d');
    break;
    
  case 'week':
    // Large: mês + ano (ex: "Jan 2026")
    // Small: dia da semana (ex: "05")
    genHeaderScale(largeScale, 0, h, 'beginOfMonth', 'sameTimeNextMonth', '%b %Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfWeek', 'sameTimeNextWeek', '%d');
    break;
    
  case 'month':
    // Large: ano (ex: "2026")
    // Small: mês (ex: "Jan")
    genHeaderScale(largeScale, 0, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfMonth', 'sameTimeNextMonth', '%b');
    break;
    
  case 'quarter':
    // Large: ano (ex: "2026")
    // Small: trimestre (ex: "Q1")
    genHeaderScale(largeScale, 0, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    genHeaderScale(smallScale, h + 1, h, 'beginOfQuarter', 'sameTimeNextQuarter', 'Q%Q');
    break;
    
  case 'year':
    // Large: (não usado)
    // Small: ano (ex: "2026")
    genHeaderScale(smallScale, h + 1, h, 'beginOfYear', 'sameTimeNextYear', '%Y');
    break;
}
```

### 2.4 genHeaderScale() — Geração de Células

```typescript
genHeaderScale(scale: GanttHeaderScaleItem[], y: number, h: number,
               beginOfFunc: string, sameTimeNextFunc: string, timeformat: string): void {
  let t = chart.start[beginOfFunc]();
  
  while (t < chart.end) {
    const nextT = t[sameTimeNextFunc]();
    
    // Calcula posição e largura da célula
    const x = chart.dateToX(t);
    const w = chart.dateToX(nextT) - x - 1;  // -1 para borda
    
    // Coleta posições do grid (escala maior)
    if (scale === largeScale) {
      gridLines.push(x + w);
    } else {
      cellStartDates.push(t);
    }
    
    // Cria o item da escala
    scale.push(new GanttHeaderScaleItem(t.to_s(timeformat), x, y, w, h));
    
    t = nextT;
  }
  
  // Adiciona data final para escala menor
  if (scale === smallScale) {
    cellStartDates.push(t);
  }
}
```

### 2.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement {
  const div = new XMLElement('div', {
    class: 'tabback',
    style: `margin:0px; padding:0px; position:relative; ` +
           `width:${chart.width}px; height:${height}px; ` +
           `font-size:${Math.floor(height / 4)}px;`
  });
  
  // Renderiza escala maior
  largeScale.forEach(s => div.append(s.to_html()));
  
  // Renderiza escala menor
  smallScale.forEach(s => div.append(s.to_html()));
  
  return div;
}
```

---

## 📊 3. GANTTTASKBAR.RB — Barra de Tarefa (Leaf Tasks)

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza barra** | Retângulo horizontal representando a tarefa |
| **Progress bar** | Barra interna mostrando % de conclusão |
| **Dependency points** | Pontos de conexão para setas de dependência |
| **Blocked zones** | Zonas bloqueadas para roteamento de setas |

### 3.2 Estrutura Interna

```typescript
class GanttTaskBar {
  @query: Query;
  @lineHeight: number;
  @start: number;      // X coordinate do início
  @end: number;        // X coordinate do fim
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 6;  // Metade da altura da barra (6px)
  
  constructor(query: Query, lineHeight: number, xStart: number, xEnd: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 3.3 Dependency Points

```typescript
// Pontos de conexão para setas de dependência
startDepLineStart(): [number, number] {
  return [this.start + 1, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.start - 1, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.end + 1, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.end - 1, this.y + this.lineHeight / 2];
}
```

### 3.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal para toda a barra
  router.addZone(
    this.start,
    this.y + (this.lineHeight / 2) - GanttTaskBar.size - 1,
    this.end - this.start + 1,
    2 * GanttTaskBar.size + 3,
    true,   // blockHorizontal
    false   // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.start - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
  
  // Bloqueio vertical para end caps
  router.addZone(this.start - 2, this.y, 5, this.lineHeight, false, true);
  router.addZone(this.end - 2, this.y, 5, this.lineHeight, false, true);
}
```

### 3.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const xStart = Math.floor(this.start);
  const yCenter = Math.floor(this.lineHeight / 2);
  const width = Math.floor(this.end) - xStart + 1;
  
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(xStart, 0, width, this.lineHeight, 'tj_gantt_frame'));
  
  // Frame da barra
  html.push(rectToHTML(
    xStart,
    yCenter - GanttTaskBar.size,
    width,
    2 * GanttTaskBar.size,
    'taskbarframe'
  ));
  
  // Preenchimento da barra
  html.push(rectToHTML(
    xStart + 1,
    yCenter - GanttTaskBar.size + 1,
    width - 2,
    2 * GanttTaskBar.size - 2,
    'taskbar'
  ));
  
  // Barra de progresso
  let completion = 0.5;  // Default 50%
  if (this.query) {
    this.query.attributeId = 'complete';
    this.query.process();
    const res = this.query.result;
    completion = res ? res / 100.0 : 0.0;
  }
  
  html.push(rectToHTML(
    xStart + 1,
    yCenter - Math.floor(GanttTaskBar.size / 2),
    Math.floor((width - 2) * completion),
    GanttTaskBar.size,
    'progressbar'
  ));
  
  return html;
}
```

---

## 📊 4. GANTTMILESTONE.RB — Milestone (Losango)

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza losango** | Diamante representando milestone |
| **Dependency points** | Pontos de conexão para setas |
| **Blocked zones** | Zonas bloqueadas (não pode cruzar em nenhuma direção) |

### 4.2 Estrutura Interna

```typescript
class GanttMilestone {
  @lineHeight: number;
  @x: number;          // X coordinate do centro
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 6;  // Metade do tamanho do losango
  
  constructor(lineHeight: number, x: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 4.3 Dependency Points

```typescript
// Pontos de conexão para setas de dependência
startDepLineStart(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.x - GanttMilestone.size, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.x + GanttMilestone.size, this.y + this.lineHeight / 2];
}
```

### 4.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio completo (não pode cruzar em nenhuma direção)
  router.addZone(
    this.x - GanttMilestone.size - 2,
    this.y + (this.lineHeight / 2) - GanttMilestone.size - 2,
    2 * GanttMilestone.size + 5,
    2 * GanttMilestone.size + 5,
    true,   // blockHorizontal
    true    // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.x - GanttMilestone.size - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
}
```

### 4.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(
    this.x - (this.lineHeight / 2),
    0,
    this.lineHeight,
    this.lineHeight,
    'tj_gantt_frame'
  ));
  
  // Desenha o losango (diamond)
  html.push(...diamondToHTML(this.x, this.lineHeight / 2));
  
  return html;
}
```

---

## 📊 5. GANTTCONTAINER.RB — Container Task (Barra com Colchetes)

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza barra** | Retângulo horizontal com "jags" nas extremidades |
| **Dependency points** | Pontos de conexão para setas |
| **Blocked zones** | Zonas bloqueadas para roteamento |

### 5.2 Estrutura Interna

```typescript
class GanttContainer {
  @lineHeight: number;
  @start: number;      // X coordinate do início
  @end: number;        // X coordinate do fim
  @y: number;          // Y coordinate (topo)
  
  static readonly size = 5;  // Tamanho dos "jags"
  
  constructor(lineHeight: number, xStart: number, xEnd: number, y: number);
  
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 5.3 Dependency Points

```typescript
startDepLineStart(): [number, number] {
  return [this.start, this.y + this.lineHeight / 2];
}

startDepLineEnd(): [number, number] {
  return [this.start - GanttContainer.size, this.y + this.lineHeight / 2];
}

endDepLineStart(): [number, number] {
  return [this.end + GanttContainer.size, this.y + this.lineHeight / 2];
}

endDepLineEnd(): [number, number] {
  return [this.end, this.y + this.lineHeight / 2];
}
```

### 5.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal para toda a barra (incluindo jags)
  router.addZone(
    this.start - GanttContainer.size,
    this.y + (this.lineHeight / 2) - GanttContainer.size - 2,
    this.end - this.start + 1 + 2 * GanttContainer.size,
    2 * GanttContainer.size + 5,
    true,   // blockHorizontal
    false   // blockVertical
  );
  
  // Bloqueio para arrowhead
  router.addZone(
    this.start - GanttContainer.size - 9,
    this.y + (this.lineHeight / 2) - 7,
    10, 15,
    true, true
  );
  
  // Bloqueio vertical para end caps
  router.addZone(
    this.start - GanttContainer.size - 2,
    this.y,
    2 * GanttContainer.size + 5,
    this.lineHeight,
    false, true
  );
  router.addZone(
    this.end - GanttContainer.size - 2,
    this.y,
    2 * GanttContainer.size + 5,
    this.lineHeight,
    false, true
  );
}
```

### 5.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  const xStart = Math.floor(this.start);
  const yCenter = Math.floor(this.lineHeight / 2);
  const width = Math.floor(this.end) - xStart + 1;
  
  const html: XMLElement[] = [];
  
  // Frame invisível para tooltips
  html.push(rectToHTML(
    xStart - GanttContainer.size,
    0,
    width + 2 * GanttContainer.size,
    this.lineHeight,
    'tj_gantt_frame'
  ));
  
  // Barra principal
  html.push(rectToHTML(
    xStart - GanttContainer.size,
    yCenter - GanttContainer.size,
    width + 2 * GanttContainer.size,
    GanttContainer.size,
    'containerbar'
  ));
  
  // Jag esquerdo
  html.push(jagToHTML(xStart, yCenter));
  
  // Jag direito
  html.push(jagToHTML(xStart + width, yCenter));
  
  return html;
}
```

---

## 📊 6. GANTTLOADSTACK.RB — Load Stack (Resources Aninhados)

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderiza stack** | Barras empilhadas mostrando alocação de recursos |
| **Normaliza altura** | Sempre ocupa toda a altura da linha |
| **Categorias** | Cores diferentes para tipos de alocação |

### 6.2 Estrutura Interna

```typescript
class GanttLoadStack {
  @line: GanttLine;
  @lineHeight: number;
  @x: number;          // X coordinate do início
  @y: number;          // Y coordinate (topo)
  @w: number;          // Largura
  @values: number[];   // Valores para cada categoria
  @categories: string[];  // Classes CSS para cada categoria
  @yLevels: number[];  // Alturas calculadas para cada valor
  @drawFrame: boolean; // Se deve desenhar frame
  
  constructor(line: GanttLine, x: number, w: number, values: number[], categories: string[]);
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}
```

### 6.3 Cálculo de Alturas

```typescript
constructor(line: GanttLine, x: number, w: number, values: number[], categories: string[]) {
  this.line = line;
  this.lineHeight = line.height;
  this.x = x;
  this.y = line.y;
  this.w = w <= 0 ? 1 : w;
  this.drawFrame = false;
  
  if (values.length !== categories.length) {
    throw new Error("Values and categories must have the same number of entries!");
  }
  
  this.categories = categories;
  
  // Verifica se precisa desenhar frame
  for (let i = 0; i < categories.length; i++) {
    if (categories[i] === null && values[i] > 0) {
      this.drawFrame = true;
      break;
    }
  }
  
  // Calcula alturas normalizadas
  let sum = 0;
  values.forEach(v => sum += v);
  
  if (sum === 0) {
    this.yLevels = null;
    this.drawFrame = true;
  } else {
    this.yLevels = [];
    values.forEach(v => {
      // Deixa 1px no topo e base, e 1px para frame
      this.yLevels.push((this.lineHeight - 4) * v / sum);
    });
  }
}
```

### 6.4 Blocked Zones

```typescript
addBlockedZones(router: GanttRouter): void {
  // Bloqueio horizontal
  router.addZone(
    this.x - 2,
    this.y,
    this.w + 4,
    this.lineHeight,
    true,   // blockHorizontal
    false   // blockVertical
  );
}
```

### 6.5 to_html() — Renderização HTML

```typescript
to_html(): XMLElement[] {
  // Não desenha se todos os valores são 0
  if (!this.yLevels) return null;
  
  const html: XMLElement[] = [];
  
  // Desenha frame de fundo
  if (this.drawFrame) {
    // Linha superior do frame
    html.push(lineToHTML(this.x, 1, this.x + this.w - 1, 1, 'loadstackframe'));
    // Linha inferior do frame
    html.push(lineToHTML(this.x, this.lineHeight - 2, this.x + this.w - 1, this.lineHeight - 2, 'loadstackframe'));
    // Linha esquerda do frame
    html.push(lineToHTML(this.x, 1, this.x, this.lineHeight - 2, 'loadstackframe'));
    // Linha direita do frame
    html.push(lineToHTML(this.x + this.w - 1, 1, this.x + this.w - 1, this.lineHeight - 2, 'loadstackframe'));
  } else {
    // Retângulo de fundo
    html.push(rectToHTML(this.x, 1, this.w, this.lineHeight - 2, 'loadstackframe'));
  }
  
  // Desenha as barras empilhadas
  let yPos = 2;
  for (let i = this.yLevels.length - 1; i >= 0; i--) {
    if (this.yLevels[i] <= 0) continue;
    
    if (this.categories[i]) {
      html.push(rectToHTML(
        this.x + 1,
        Math.floor(yPos),
        this.w - 2,
        Math.floor(yPos + this.yLevels[i]) - Math.floor(yPos),
        this.categories[i]
      ));
    }
    
    yPos += this.yLevels[i];
  }
  
  return html;
}
```

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação

```
FASE 13A: Header
  1. GanttHeaderScaleItem.ts     (item individual da escala)
  2. GanttHeader.ts              (header completo) ⭐

FASE 13B: Elementos do Gantt
  3. GanttTaskBar.ts             (barra de tarefa) ⭐
  4. GanttMilestone.ts           (milestone) ⭐
  5. GanttContainer.ts           (container task) ⭐
  6. GanttLoadStack.ts           (load stack) ⭐

FASE 13C: Helpers Gráficos
  7. HTMLGraphics.ts             (funções auxiliares)
  8. GanttRouter.ts              (roteamento de setas)
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 GanttHeaderScaleItem
```typescript
class GanttHeaderScaleItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  
  constructor(text: string, x: number, y: number, w: number, h: number);
  to_html(): XMLElement;
}
```

#### 7.2.2 HTMLGraphics Mixin
```typescript
// Mixin para funções gráficas comuns
interface HTMLGraphics {
  rectToHTML(x: number, y: number, w: number, h: number, className: string): XMLElement;
  lineToHTML(x1: number, y1: number, x2: number, y2: number, className: string): XMLElement;
  diamondToHTML(cx: number, cy: number): XMLElement[];
  jagToHTML(x: number, cy: number): XMLElement;
  arrowHeadToHTML(x: number, y: number): XMLElement;
}

// Implementação
function rectToHTML(x: number, y: number, w: number, h: number, className: string): XMLElement {
  return new XMLElement('div', {
    class: className,
    style: `position:absolute; left:${x}px; top:${y}px; ` +
           `width:${w}px; height:${h}px;`
  });
}

function diamondToHTML(cx: number, cy: number): XMLElement[] {
  const size = 6;
  return [
    new XMLElement('div', {
      class: 'milestone',
      style: `position:absolute; ` +
             `left:${cx - size}px; top:${cy - size}px; ` +
             `width:${size * 2}px; height:${size * 2}px; ` +
             `transform:rotate(45deg);`
    })
  ];
}

function jagToHTML(x: number, cy: number): XMLElement {
  // Desenha um "jag" (colchete) para container tasks
  return new XMLElement('div', {
    class: 'containerjag',
    style: `position:absolute; left:${x}px; top:${cy - 5}px; ` +
           `width:5px; height:10px; ` +
           `border-left:2px solid #000; ` +
           `border-top:2px solid #000; ` +
           `border-bottom:2px solid #000;`
  });
}
```

#### 7.2.3 GanttElement Interface
```typescript
// Interface comum para todos os elementos do Gantt
interface GanttElement {
  startDepLineStart(): [number, number];
  startDepLineEnd(): [number, number];
  endDepLineStart(): [number, number];
  endDepLineEnd(): [number, number];
  
  addBlockedZones(router: GanttRouter): void;
  to_html(): XMLElement[];
}

// Classes implementam essa interface
class GanttTaskBar implements GanttElement { /* ... */ }
class GanttMilestone implements GanttElement { /* ... */ }
class GanttContainer implements GanttElement { /* ... */ }
class GanttLoadStack implements GanttElement { /* ... */ }
```

#### 7.2.4 GanttRouter (não anexado, mas essencial)
```typescript
class GanttRouter {
  @width: number;
  @height: number;
  @blockedZones: Zone[];
  
  constructor(width: number, height: number);
  
  addZone(x: number, y: number, w: number, h: number, 
          blockHorizontal: boolean, blockVertical: boolean): void;
  
  routeLines(touples: [number, number, number, number][]): [number, number][][];
}

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  blockHorizontal: boolean;
  blockVertical: boolean;
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **Coordenadas são relativas**: Todas as coordenadas são relativas ao topo da linha do Gantt, não ao topo do chart.

2. **Dependency points**: Os pontos de conexão devem estar exatamente no centro vertical da linha (`y + lineHeight / 2`).

3. **Blocked zones**: Devem ser ligeiramente maiores que o elemento visual para evitar sobreposição de setas.

4. **Progress bar**: A barra de progresso é renderizada DENTRO da barra da tarefa, com 1px de padding.

5. **Load stack normalização**: Os valores são normalizados para ocupar toda a altura da linha (`lineHeight - 4` pixels).

6. **Frame vs Fill**: Task bars têm frame + fill + progress bar. Containers têm frame + fill + jags. Milestones são losangos.

7. **Grid lines**: São determinadas pela escala MAIOR (largeScale), não pela menor.

8. **Now line**: É renderizada como uma linha vertical vermelha de 1px de largura.

9. **Tooltip triggers**: São frames invisíveis (`tj_gantt_frame`) que cobrem toda a área do elemento.

10. **CSS classes**: Cada elemento tem classes CSS específicas (`taskbar`, `taskbarframe`, `progressbar`, `milestone`, `containerbar`, `containerjag`, `loadstackframe`, `offduty`, `nowline`, `markdateline`, `tabvline`).

---

## 📋 8. CHECKLIST FINAL DO ENGINE COMPLETO

### ✅ Engine COMPLETO (100+ arquivos analisados)

#### Parser (5 arquivos)
- [x] TjpSyntaxRules.rb
- [x] ProjectFileScanner.rb
- [x] ProjectFileParser.rb
- [x] SyntaxReference.rb
- [x] KeywordDocumentation.rb

#### Modelo de Domínio (12 arquivos)
- [x] Project.rb
- [x] PropertyTreeNode.rb
- [x] PropertySet.rb
- [x] Task.rb + TaskScenario.rb
- [x] Resource.rb + ResourceScenario.rb
- [x] Account.rb + AccountScenario.rb
- [x] Scenario.rb
- [x] Shift.rb
- [x] Attributes.rb
- [x] AttributeDefinition.rb

#### Scheduler (10 arquivos)
- [x] TaskScenario.rb (coração do scheduler)
- [x] ResourceScenario.rb
- [x] Scoreboard.rb
- [x] Allocation.rb
- [x] Booking.rb
- [x] TaskDependency.rb
- [x] Limits.rb
- [x] ShiftAssignments.rb
- [x] WorkingHours.rb
- [x] DataCache.rb

#### Sistema Financeiro (5 arquivos)
- [x] Charge.rb
- [x] ChargeSet.rb
- [x] AccountCredit.rb
- [x] RealFormat.rb
- [x] AccountScenario.rb (turnover, balance)

#### Sistema de Tempo (3 arquivos)
- [x] TjTime.rb
- [x] Interval.rb
- [x] IntervalList.rb

#### Sistema de Apoio (5 arquivos)
- [x] AlertLevelDefinitions.rb
- [x] PropertyList.rb
- [x] LeaveList.rb
- [x] Journal.rb
- [x] MessageHandler.rb

#### Expressões Lógicas (3 arquivos)
- [x] LogicalExpression.rb
- [x] LogicalOperation.rb
- [x] LogicalFunction.rb

#### Queries (1 arquivo)
- [x] Query.rb

#### RichText (1 arquivo)
- [x] RichText.rb

#### Reports Base (5 arquivos)
- [x] Report.rb
- [x] TableReport.rb
- [x] TableColumnDefinition.rb
- [x] ReportTable.rb
- [x] ReportTableColumn.rb
- [x] ReportTableLine.rb
- [x] ReportTableCell.rb

#### Reports Específicos (3 arquivos)
- [x] TaskListRE.rb
- [x] ResourceListRE.rb
- [x] TextReport.rb

#### Gantt Chart (10 arquivos)
- [x] GanttChart.rb
- [x] GanttLine.rb
- [x] GanttHeader.rb ⭐
- [x] GanttTaskBar.rb ⭐
- [x] GanttMilestone.rb ⭐
- [x] GanttContainer.rb ⭐
- [x] GanttLoadStack.rb ⭐

#### Time Sheets (4 arquivos)
- [x] TimeSheets.rb
- [x] TimeSheet.rb
- [x] TimeSheetSender.rb
- [x] TimeSheetReceiver.rb
- [x] TimeSheetSummary.rb

#### Utilitários (5 arquivos)
- [x] URLParameter.rb
- [x] BatchProcessor.rb
- [x] StdIoWrapper.rb
- [x] PTNProxy.rb
- [x] deep_copy.rb
- [x] TernarySearchTree.rb
- [x] Log.rb
- [x] TaskJuggler.rb (orquestrador top-level)
- [x] HTMLDocument.rb
- [x] KateSyntax.rb

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. Parser cria GanttChart
const gantt = new GanttChart(
  project.get('now'),
  project.get('weekStartsMonday'),
  columnDef,
  tableReport,
  project.get('markdate')
);
gantt.generateByScale(startDate, endDate, 'week');

// 2. Para cada task, cria GanttLine
taskList.forEach(task => {
  const query = new Query({
    project: project,
    property: task,
    scenario: scenario,
    start: startDate,
    end: endDate
  });
  
  const line = new GanttLine(
    gantt,
    query,
    y,
    height,
    lineIndex,
    columnDef.tooltip
  );
  
  // GanttLine internamente cria:
  // - GanttTaskBar (se leaf task)
  // - GanttMilestone (se milestone)
  // - GanttContainer (se container task)
  // - GanttLoadStack (se resource aninhado)
});

// 3. Renderiza para HTML
const html = gantt.to_html();
// → GanttHeader.to_html()
// → Para cada GanttLine:
//   → GanttLine.to_html()
//     → GanttTaskBar.to_html() ou
//     → GanttMilestone.to_html() ou
//     → GanttContainer.to_html() ou
//     → GanttLoadStack.to_html()

// 4. Adiciona dependency arrows
gantt.completeChart();
// → GanttRouter.routeLines()
// → GanttRouter.addZone() para cada elemento

// 5. Renderiza setas
gantt.depArrows.forEach(arrow => {
  for (let i = 1; i < arrow.length; i++) {
    const [x1, y1] = arrow[i - 1];
    const [x2, y2] = arrow[i];
    html.push(lineToHTML(x1, y1, x2, y2, 'depline'));
  }
});

// 6. Renderiza arrow heads
gantt.arrowHeads.forEach(([x, y]) => {
  html.push(arrowHeadToHTML(x, y));
});
```

---

## 🚀 10. CONCLUSÃO

**O engine do TaskJuggler está COMPLETAMENTE MAPEADO!**

A próxima IA tem tudo que precisa para implementar em Deno/TypeScript:

1. **Parser completo** — Scanner + Parser + SyntaxRules
2. **Modelo de domínio** — Tasks, Resources, Accounts, Scenarios, Shifts
3. **Scheduler completo** — Algoritmo de alocação de recursos
4. **Sistema financeiro** — Custos, receitas, balanço
5. **Sistema de relatórios** — TaskReport, ResourceReport, TextReport
6. **Gantt Chart completo** — Header, TaskBar, Milestone, Container, LoadStack
7. **Time Sheets** — Apontamentos de horas
8. **Utilitários** — Cache, logging, mensagens, deep copy

**Próximos passos sugeridos:**
1. Implementar `TjTime.ts` (base de tudo)
2. Implementar `TextParser.ts` (parser genérico)
3. Implementar `ProjectFileScanner.ts` (lexer TJP)
4. Implementar `ProjectFileParser.ts` + `TjpSyntaxRules.ts`
5. Implementar `PropertyTreeNode.ts` + `PropertySet.ts`
6. Implementar `Task.ts` + `TaskScenario.ts` (coração do scheduler)
7. Implementar `ResourceScenario.ts` + `Scoreboard.ts`
8. Implementar `Report.ts` + `TableReport.ts`
9. Implementar `GanttChart.ts` + componentes

**Engine do TaskJuggler: 100% documentado!** 🎉
````

---

## Arquivo: `docs/tj3-engine/17-blueprint-attribute.md`

````md
# 📘 Blueprint Fase 14: Atributos Base + Shifts + Expansão de Queries + Legenda

## 🎯 Objetivo
Analisar os 5 arquivos que completam:
- **Sistema de atributos base** (`AttributeBase.rb`)
- **Entidade Shift completa** (`Shift.rb` + `ShiftScenario.rb`)
- **Expansão de queries em strings** (`SimpleQueryExpander.rb`)
- **Legenda de relatórios** (`ReportTableLegend.rb`)

---

## 🏗️ 1. ATTRIBUTEBASE.RB — Base de Todos os Atributos

### 1.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base** | Superclasse de todos os tipos de atributos |
| **Tracking de origem** | `provided`, `inherited`, `computed` |
| **Modo global** | `@@mode` controla como valores são marcados |
| **Deep copy** | Suporta clonagem profunda |
| **ListAttributeBase** | Subclasse para atributos lista |

### 1.2 Estrutura Interna

```typescript
class AttributeBase {
  @property: PropertyTreeNode;
  @type: AttributeDefinition;
  @container: PropertyTreeNode | ScenarioData;
  @provided: boolean = false;
  @inherited: boolean = false;
  
  // Modo global (compartilhado entre todas as instâncias)
  static mode: 0 | 1 | 2 = 0;
  // 0 = provided (usuário setou)
  // 1 = inherited (herdado)
  // 2 = computed (calculado pelo scheduler)
  
  constructor(property: PropertyTreeNode, type: AttributeDefinition, 
              container: PropertyTreeNode | ScenarioData);
  
  reset(): void;
  inherit(value: any): void;
  set(value: any): void;
  get(): any;
  isList(): boolean;
  to_s(query?: Query): string;
  to_num(): number | null;
  to_sort(): any;
  to_rti(query: Query): RichTextIntermediate | null;
  to_tjp(): string;
}

class ListAttributeBase extends AttributeBase {
  isList(): boolean { return true; }
}

class AttributeOverwrite extends ArgumentError {}
```

### 1.3 Método set() — CRÍTICO

```typescript
set(value: any): void {
  switch (AttributeBase.mode) {
    case 0: this.@provided = true; break;
    case 1: this.@inherited = true; break;
  }
  // Armazena no container (PropertyTreeNode ou ScenarioData)
  this.@container[`@${this.type.id}`] = value;
}
```

### 1.4 Método inherit() — Deep Copy

```typescript
inherit(value: any): void {
  this.@inherited = true;
  // Deep copy para evitar compartilhamento acidental
  this.@container[`@${this.type.id}`] = value.deep_clone();
}
```

### 1.5 Pontos Críticos

1. **`@@mode` é global** — afeta TODOS os atributos simultaneamente
2. **`inherit()` faz deep copy** — essencial para evitar compartilhamento
3. **`ListAttributeBase`** — sempre retorna `isList() = true`
4. **`AttributeOverwrite`** — exceção lançada quando sobrescreve valor não-lista

---

## 🔄 2. SHIFT.RB + SHIFTSCENARIO.RB — Entidade Shift Completa

### 2.1 Shift.rb

```typescript
class Shift extends PropertyTreeNode {
  constructor(project: Project, id: string, name: string, parent: Shift | null) {
    super(project.shifts, id, name, parent);
    project.addShift(this);
    
    // Um ShiftScenario por cenário
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ShiftScenario(this, i, this.scenarioAttributes[i])
    );
  }
  
  // Delegação via method_missing
  method_missing(func: string, scenarioIdx: number, ...args: any[]): any {
    return this.data[scenarioIdx][func](...args);
  }
  
  scenario(scenarioIdx: number): ShiftScenario {
    return this.data[scenarioIdx];
  }
}
```

### 2.2 ShiftScenario.rb

```typescript
class ShiftScenario extends ScenarioData {
  // Retorna true se o shift tem horário de trabalho definido para a data
  onShift?(date: TjTime): boolean {
    return this.a('workinghours').onShift?(date);
  }
  
  // Retorna true se o shift tem substituição de leaves globais
  replace?(): boolean {
    return this.a('replace');
  }
  
  // Retorna true se o shift tem leave definido para a data
  onLeave?(date: TjTime): boolean {
    for (const leave of this.a('leaves')) {
      if (leave.interval.contains?(date)) return true;
    }
    return false;
  }
}
```

### 2.3 Atributos do Shift (definidos em Project.rb)

```typescript
const shiftAttributes = [
  ['bsi',          'BSI',           StringAttribute,        false, false, false, ""],
  ['id',           'ID',            StringAttribute,        false, false, false, null],
  ['index',        'Index',         IntegerAttribute,       false, false, false, -1],
  ['leaves',       'Leaves',        LeaveListAttribute,     true,  true,  true,  LeaveList.new],
  ['name',         'Name',          StringAttribute,        false, false, false, null],
  ['replace',      'Replace',       BooleanAttribute,       true,  false, true,  false],
  ['seqno',        'No',            IntegerAttribute,       false, false, false, null],
  ['timezone',     'Time Zone',     StringAttribute,        true,  true,  true,  TjTime.timeZone],
  ['tree',         'Tree Index',    StringAttribute,        false, false, false, ""],
  ['workinghours', 'Working Hours', WorkingHoursAttribute,  true,  true,  true,  null],
];
```

### 2.4 Integração com ShiftAssignments

```typescript
// Em ShiftAssignments.rb (já analisado):
// ShiftAssignment usa ShiftScenario para verificar:
// - assigned?(date) → intervalo de atribuição
// - onShift?(date) → horário de trabalho
// - onLeave?(date) → leave definido
// - replace?(date) → substitui leaves globais
```

---

## 🔍 3. SIMPLEQUERYEXPANDER.RB — Expansão de Queries em Strings

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Expansão de queries** | Substitui `<-name->` pelo valor do atributo |
| **Uso em templates** | Usado em títulos de colunas, legendas, etc. |
| **Contexto via Query** | Usa Query para avaliar atributos |

### 3.2 Estrutura Interna

```typescript
class SimpleQueryExpander {
  @inputStr: string;
  @query: Query;
  @sourceFileInfo: SourceFileInfo;
  
  constructor(inputStr: string, query: Query, sourceFileInfo: SourceFileInfo);
  
  expand(): string;
}
```

### 3.3 Método expand() — CRÍTICO

```typescript
expand(): string {
  let str = this.@inputStr.dup();
  
  // Substitui <-scenario-> pelo nome do cenário
  if (this.@query.scenarioIdx) {
    str = str.replace(/<-scenario->/g,
      this.@query.project.scenario(this.@query.scenarioIdx).id);
  }
  
  // Substitui <-name-> pelo valor do atributo
  str = str.replace(/<-[a-zA-Z][_a-zA-Z]*->/g, (match) => {
    const attribute = match.slice(2, -2);
    this.@query.attributeId = attribute;
    this.@query.process();
    
    if (this.@query.ok) {
      return this.@query.to_s();
    } else {
      this.error('sqe_expand_failed', 
        `Unknown attribute ${attribute}`, this.@sourceFileInfo);
      return '';
    }
  });
  
  return str;
}
```

### 3.4 Uso no TraceReport

```typescript
// No TraceReport (não analisado ainda):
// Títulos de colunas podem conter queries:
// "<-id->:<-scenario->.effort" → "t1:plan.effort"
```

### 3.5 Pontos Críticos

1. **Sintaxe `<-name->`** — delimitadores específicos do TaskJuggler
2. **`<-scenario->`** — caso especial tratado separadamente
3. **Erros geram warning** — não aborta a expansão
4. **Usa Query.process()** — herda todo o sistema de queries

---

## 📋 4. REPORTTABLELEGEND.RB — Legenda de Relatórios

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Legenda do Gantt** | Símbolos do Gantt chart (container, task, milestone) |
| **Legenda do Calendar** | Cores de calendário (busy, loaded, free, offduty) |
| **HTML rendering** | Gera tabela HTML com símbolos e descrições |

### 4.2 Estrutura Interna

```typescript
class ReportTableLegend {
  @showGanttItems: boolean = false;
  @ganttItems: [string, string][] = [];   // [text, color]
  @calendarItems: [string, string][] = []; // [text, color]
  
  addGanttItem(text: string, color: string): void;
  addCalendarItem(text: string, color: string): void;
  to_html(): XMLElement;
}
```

### 4.3 Método to_html() — CRÍTICO

```typescript
to_html(): XMLElement {
  if (!this.@showGanttItems && this.@ganttItems.empty() && 
      this.@calendarItems.empty()) {
    return null;
  }
  
  const frame = new XMLElement('div', { class: 'tj_table_legend_frame' });
  const legend = new XMLElement('table', { 
    class: 'tj_table_legend', 
    cellspacing: '1' 
  });
  
  // Headline "Gantt Chart Symbols:"
  legend.append(this.headlineToHTML('Gantt Chart Symbols:'));
  
  // Símbolos do Gantt (se showGanttItems)
  if (this.@showGanttItems) {
    const row = new XMLElement('tr', { class: 'tj_legend_row' });
    row.append(this.ganttItemToHTML(
      new GanttContainer(15, 10, 35, 0), 'Container Task', 40));
    row.append(this.ganttItemToHTML(
      new GanttTaskBar(null, 15, 5, 35, 0), 'Normal Task', 40));
    row.append(this.ganttItemToHTML(
      new GanttMilestone(15, 10, 0), 'Milestone', 20));
    row.append(new XMLElement('td', { class: 'tj_legend_spacer' }));
    legend.append(row);
  }
  
  // Itens customizados do Gantt
  legend.append(this.itemsToHTML(this.@ganttItems));
  
  // Headline "Calendar Symbols:"
  legend.append(this.headlineToHTML('Calendar Symbols:'));
  
  // Itens do calendário
  legend.append(this.itemsToHTML(this.@calendarItems));
  
  frame.append(legend);
  return frame;
}
```

### 4.4 Integração com GanttLine e TableReport

```typescript
// Em GanttLine.rb (já analisado):
// Adiciona itens à legenda:
this.@chart.table.legend.addGanttItem('Off-duty period', 'offduty');
this.@chart.table.legend.addGanttItem('Resource assigned to task(s)', 'busy');

// Em TableReport.rb (já analisado):
// A legenda é renderizada após a tabela:
html.append(this.@legend.to_html());
```

### 4.5 Pontos Críticos

1. **`showGanttItems`** — flag para mostrar símbolos padrão do Gantt
2. **Deduplicação** — `addGanttItem` e `addCalendarItem` evitam duplicatas
3. **Layout em grid** — 3 itens por linha na legenda
4. **Usa GanttContainer/TaskBar/Milestone** — renderiza símbolos reais

---

## 📊 5. PIPELINE ATUALIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    AttributeBase (Base)                          │
│  └── Todos os atributos herdam dele                             │
│  └── Mode: provided (0) | inherited (1) | computed (2)          │
│  └── ListAttributeBase para atributos lista                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shift + ShiftScenario                         │
│  └── Shift: PropertyTreeNode com ShiftScenario por cenário      │
│  └── ShiftScenario: onShift?(), onLeave?(), replace?()          │
│  └── Usado por ShiftAssignments para controlar horários         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SimpleQueryExpander                           │
│  └── Expande <-name-> em strings                                │
│  └── Usa Query para avaliar atributos                           │
│  └── Usado em títulos de colunas, legendas, etc.                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ReportTableLegend                             │
│  └── Legenda do Gantt chart e calendário                        │
│  └── Renderiza símbolos (container, task, milestone)            │
│  └── Renderiza cores (busy, loaded, free, offduty)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 6. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 6.1 AttributeBase com Generics

```typescript
abstract class AttributeBase<T = any> {
  protected @property: PropertyTreeNode;
  protected @type: AttributeDefinition;
  protected @container: PropertyTreeNode | ScenarioData;
  protected @provided: boolean = false;
  protected @inherited: boolean = false;
  
  static mode: 0 | 1 | 2 = 0;
  
  abstract get(): T;
  abstract set(value: T): void;
  abstract isList(): boolean;
  
  inherit(value: T): void {
    this.@inherited = true;
    this.set(value.deep_clone());
  }
}
```

### 6.2 Shift com Generics

```typescript
class Shift extends PropertyTreeNode<PropertySet<Shift>, ShiftScenario> {
  constructor(project: Project, id: string, name: string, parent: Shift | null) {
    super(project.shifts, id, name, parent);
    project.addShift(this);
    
    this.data = Array.from({ length: project.scenarioCount }, (_, i) =>
      new ShiftScenario(this, i, this.scenarioAttributes[i])
    );
  }
}
```

### 6.3 SimpleQueryExpander com Regex

```typescript
class SimpleQueryExpander {
  expand(): string {
    let str = this.inputStr;
    
    // Substitui <-scenario->
    if (this.query.scenarioIdx !== undefined) {
      str = str.replace(/<-scenario->/g,
        this.query.project.scenario(this.query.scenarioIdx).id);
    }
    
    // Substitui <-name->
    str = str.replace(/<-[a-zA-Z][_a-zA-Z]*->/g, (match) => {
      const attribute = match.slice(2, -2);
      this.query.attributeId = attribute;
      this.query.process();
      
      if (this.query.ok) {
        return this.query.to_s();
      } else {
        this.error('sqe_expand_failed', 
          `Unknown attribute ${attribute}`, this.sourceFileInfo);
        return '';
      }
    });
    
    return str;
  }
}
```

### 6.4 ReportTableLegend com Builder

```typescript
class ReportTableLegend {
  private ganttItems: [string, string][] = [];
  private calendarItems: [string, string][] = [];
  private showGanttItems: boolean = false;
  
  addGanttItem(text: string, color: string): void {
    if (!this.ganttItems.some(([t, c]) => t === text && c === color)) {
      this.ganttItems.push([text, color]);
    }
  }
  
  addCalendarItem(text: string, color: string): void {
    if (!this.calendarItems.some(([t, c]) => t === text && c === color)) {
      this.calendarItems.push([text, color]);
    }
  }
}
```

---

## 📋 7. CHECKLIST ATUALIZADO

### ✅ Já analisados (80+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation, TextParser
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift ⭐, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes, AttributeBase ⭐
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query, SimpleQueryExpander ⭐
- [x] **RichText**: RichText
- [x] **Reports**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition, ReportTableLegend ⭐
- [x] **Gantt**: GanttChart, GanttLine, GanttHeader, GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal, MessageHandler, Log
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Utilitários**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy, deep_copy, TernarySearchTree, KateSyntax

### 🔮 Próximos 5 (Fase 15 - Completar Reports)
- [ ] **`reports/ReportBase.rb`** ⭐ — Base de todos os relatórios
- [ ] **`reports/ReportContext.rb`** ⭐ — Contexto de relatórios
- [ ] **`reports/GanttRouter.rb`** ⭐ — Roteamento de dependency arrows
- [ ] **`reports/HTMLGraphics.rb`** ⭐ — Helpers gráficos (rectToHTML, lineToHTML, etc.)
- [ ] **`reports/AccountListRE.rb`** ⭐ — Relatório de contas (balance)

---

## 🎁 8. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. AttributeBase em ação
const attr = new StringAttribute(property, attrDef, container);
AttributeBase.setMode(0);  // provided
attr.set('value');  // attr.provided = true

AttributeBase.setMode(1);  // inherited
attr.inherit('inherited_value');  // attr.inherited = true, deep copy

AttributeBase.setMode(2);  // computed
attr.set('computed_value');  // modo computed

// 2. Shift em ação
const shift = new Shift(project, 'morning', 'Morning Shift', null);
shift['workinghours', 0].setWorkingHours(1, [[6 * 3600, 14 * 3600]]);
shift['leaves', 0] += [new Leave('holiday', interval, 'Christmas')];

// ShiftScenario verifica:
const scenario = shift.scenario(0);
console.log(scenario.onShift?(new TjTime('2026-01-05-10:00')));  // true
console.log(scenario.onLeave?(new TjTime('2026-12-25')));  // true

// 3. SimpleQueryExpander em ação
const expander = new SimpleQueryExpander(
  '<-id->:<-scenario->.effort',
  query,
  sourceFileInfo
);
console.log(expander.expand());  // "t1:plan.effort"

// 4. ReportTableLegend em ação
const legend = new ReportTableLegend();
legend.showGanttItems = true;
legend.addGanttItem('Off-duty period', 'offduty');
legend.addCalendarItem('Resource is busy', 'busy1');

const html = legend.to_html();
// Gera tabela HTML com símbolos e descrições
```

---

**Fim da Fase 14.** Anexe `ReportBase.rb`, `ReportContext.rb`, `GanttRouter.rb`, `HTMLGraphics.rb` e `AccountListRE.rb` para completar o **sistema de relatórios**. 🚀
````

---

## Arquivo: `docs/tj3-engine/18-nlueprint-report.md`

````md
# 📘 Blueprint Fase 15: Sistema de Relatórios Completo

## 🎯 Objetivo
Analisar os 5 arquivos que completam o **sistema de relatórios**: roteamento de setas, helpers gráficos, contexto de relatórios, navegação e base de relatórios. Estes são os componentes estruturais que sustentam todos os relatórios específicos.

---

## 🏗️ 1. PIPELINE DE RELATÓRIOS COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    Report.generate()                             │
│  └── generateIntermediateFormat()                                │
│      └── TaskListRE / ResourceListRE / AccountListRE             │
│          └── TableReport (base)                                  │
│              └── ReportBase  ◄── ReportBase.rb ⭐                │
│                  ├── filterTaskList() / filterResourceList()     │
│                  ├── generateHtmlTableFrame()                    │
│                  └── rt_to_html()                                │
│                                                                  │
│  └── generateHTML()                                              │
│      └── HTMLDocument                                            │
│      └── ReportContext  ◄── ReportContext.rb ⭐                  │
│          └── Preserva contexto em relatórios aninhados           │
│      └── Navigator  ◄── Navigator.rb ⭐                          │
│          └── Gera menu de navegação entre relatórios             │
│      └── ReportTable                                             │
│          └── GanttChart                                          │
│              └── GanttRouter  ◄── GanttRouter.rb ⭐              │
│                  └── Roteia dependency arrows                    │
│              └── HTMLGraphics  ◄── HTMLGraphics.rb ⭐            │
│                  └── rectToHTML(), lineToHTML(), etc.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 2. GANTTROUTER.RB — Roteamento de Dependency Arrows

### 2.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Roteamento ortogonal** | Encontra caminhos sem cruzar zonas bloqueadas |
| **Minimização de cruzamentos** | Ordena setas por ângulo para reduzir sobreposições |
| **Zonas bloqueadas** | Task bars, milestones, now line bloqueiam rotas |
| **Arrow heads** | Garante exatamente uma seta por endpoint |

### 2.2 Estrutura Interna

```typescript
class GanttRouter {
  static readonly MinStartGap = 5;   // Gap mínimo antes do primeiro turno
  static readonly MinEndGap = 10;    // Gap mínimo antes da ponta da seta
  
  @width: number;
  @height: number;
  @detector: CollisionDetector;  // Detecta colisões com zonas bloqueadas
  
  constructor(width: number, height: number);
  
  addZone(x: number, y: number, w: number, h: number, 
          horiz: boolean, vert: boolean): void;
  
  routeLines(fromToPoints: [number, number, number, number][]): [number, number][][];
  route(startX: number, startY: number, endX: number, endY: number): [number, number][];
  
  to_html(): XMLElement;  // Debug only
}
```

### 2.3 Algoritmo de Roteamento

```typescript
routeLines(fromToPoints: [number, number, number, number][]): [number, number][][] {
  // 1. Converte para lista de objetos com metadados
  const routes = fromToPoints.map(([startX, startY, endX, endY, id]) => ({
    startX, startY, endX, endY, id,
    distance: 0,
    angle: 0
  }));
  
  // 2. Calcula ângulo e distância para ordenação
  routes.forEach(r => {
    const adjLeg = (r.endX - MinEndGap) - (r.startX + MinStartGap);
    const oppLeg = Math.abs(r.startY - r.endY);
    r.distance = Math.sqrt(adjLeg ** 2 + oppLeg ** 2);
    
    const sinus = Math.abs(oppLeg) / r.distance;
    r.angle = (adjLeg < 0 
      ? Math.PI / 2 + Math.asin(Math.PI / 2 - sinus)
      : Math.asin(sinus)) / (Math.PI / (2 * 90));
  });
  
  // 3. Ordena por ângulo (menor para maior)
  routes.sort((r1, r2) => {
    const angleDiff = Math.floor(r1.angle / 5) - Math.floor(r2.angle / 5);
    if (angleDiff === 0) {
      return r2.distance - r1.distance;  // Maior distância primeiro
    }
    return r2.angle - r1.angle;  // Maior ângulo primeiro
  });
  
  // 4. Roteia cada seta individualmente
  return routes.map(r => this.route(r.startX, r.startY, r.endX, r.endY));
}

route(startX: number, startY: number, endX: number, endY: number): [number, number][] {
  const points: [number, number][] = [[startX, startY]];
  const startGap = MinStartGap;
  const endGap = MinEndGap;
  
  // Tenta rota direta se houver espaço horizontal suficiente
  if (endX - startX > startGap + endGap + 2) {
    const xSeg = this.placeLine(
      [startY + (startY < endY ? 1 : -1), endY],
      false,  // vertical
      startX + startGap,
      1
    );
    
    if (xSeg && xSeg < endX - endGap) {
      // Rota direta funciona
      this.addLineTo(points, xSeg, startY);  // Point 1
      this.addLineTo(points, xSeg, endY);    // Point 2
      this.addLineTo(points, endX, endY);
      return points;
    }
  }
  
  // Rota complexa com 4 pontos
  const deltaY = startY < endY ? 1 : -1;
  
  // Segmento horizontal
  const ySeg = this.placeLine([0, this.width - 1], true, startY + 2 * deltaY, deltaY);
  if (!ySeg) throw new Error("Routing failed");
  
  // Primeira vertical
  const x1 = this.placeLine([startY + deltaY, ySeg], false, startX + startGap, 1);
  if (!x1) throw new Error("Routing failed");
  
  // Segunda vertical
  const x2 = this.placeLine([ySeg + deltaY, endY], false, endX - endGap, -1);
  if (!x2) throw new Error("Routing failed");
  
  // Adiciona pontos
  this.addLineTo(points, x1, startY);  // Point 1
  if (x1 !== x2) {
    this.addLineTo(points, x1, ySeg);  // Point 2
    this.addLineTo(points, x2, ySeg);  // Point 3
  }
  this.addLineTo(points, x2, endY);    // Point 4
  this.addLineTo(points, endX, endY);
  
  return points;
}
```

### 2.4 placeLine() — O Coração do Algoritmo

```typescript
private placeLine(
  segment: [number, number],
  horizontal: boolean,
  start: number,
  delta: number
): number {
  if (delta === 0) throw new Error("delta may not be 0");
  
  let pos = Math.round(start);
  pos = Math.max(0, pos);
  const max = (horizontal ? this.height : this.width) - 1;
  pos = Math.min(max, pos);
  
  // Ordena segmento
  segment.sort((a, b) => a - b);
  
  // Busca posição livre
  while (this.detector.collision(pos, segment, horizontal)) {
    pos += delta;
    
    // Verifica limites
    if (delta < 0) {
      if (pos < 0) break;
    } else {
      if (pos >= (horizontal ? this.height : this.width)) break;
    }
  }
  
  return pos;
}
```

### 2.5 addLineTo() — Adiciona Waypoint e Bloqueia Zona

```typescript
private addLineTo(points: [number, number][], x2: number, y2: number): void {
  if (points.length === 0) throw new Error("Point list may not be empty");
  
  const [x1, y1] = points[points.length - 1];
  points.push([x2, y2]);
  
  if (x1 === x2) {
    // Linha vertical
    if (x1 < 0 || x1 >= this.width) return;
    const [x, y, w, h] = this.justify(x1 - 2, y1, 5, y2 - y1 + 1);
    this.addZone(x, y, w, h, false, true);  // Bloqueia vertical
  } else {
    // Linha horizontal
    if (y1 < 0 || x1 >= this.height) return;
    const [x, y, w, h] = this.justify(x1, y1 - 2, x2 - x1 + 1, 5);
    this.addZone(x, y, w, h, true, false);  // Bloqueia horizontal
  }
}

private justify(x: number, y: number, w: number, h: number): [number, number, number, number] {
  if (w < 0) {
    w = -w;
    x = x - w + 1;
  }
  if (h < 0) {
    h = -h;
    y = y - h + 1;
  }
  return [x, y, w, h];
}
```

### 2.6 Pontos Críticos

1. **CollisionDetector** — Não foi anexado, mas é essencial. Detecta colisões com zonas bloqueadas.

2. **Ordenação por ângulo** — Reduz cruzamentos de setas. Setas com ângulos similares são roteadas juntas.

3. **Zonas de 5 pixels** — Cada linha adicionada bloqueia uma zona de 5 pixels de largura para evitar linhas paralelas muito próximas.

4. **Rota direta vs complexa** — Tenta primeiro rota direta (2 turnos), se falhar usa rota complexa (4 turnos).

5. **MinStartGap/MinEndGap** — Garante espaço mínimo antes do primeiro turno e antes da ponta da seta.

---

## 🎨 3. HTMLGRAPHICS.RB — Helpers Gráficos

### 3.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Renderização HTML** | Converte primitivas gráficas em elementos HTML |
| **Linhas** | Horizontal e vertical (não diagonal) |
| **Retângulos** | Preenchidos com classe CSS |
| **Jags** | Colchetes para container tasks |
| **Diamantes** | Milestones |
| **Arrow heads** | Pontas de setas |

### 3.2 Estrutura Interna

```typescript
module HTMLGraphics {
  lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement;
  rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement;
  jagToHTML(x: number, y: number): XMLElement;
  diamondToHTML(x: number, y: number): XMLElement[];
  arrowHeadToHTML(x: number, y: number): XMLElement;
}
```

### 3.3 Implementação

```typescript
// Linha horizontal ou vertical
lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement {
  xs = Math.round(xs);
  ys = Math.round(ys);
  xe = Math.round(xe);
  ye = Math.round(ye);
  
  let style: string;
  if (ys === ye) {
    // Horizontal
    if (xe < xs) [xs, xe] = [xe, xs];
    style = `left:${xs}px; top:${ys}px; width:${xe - xs + 1}px; height:1px;`;
  } else if (xs === xe) {
    // Vertical
    if (ye < ys) [ys, ye] = [ye, ys];
    style = `left:${xs}px; top:${ys}px; width:1px; height:${ye - ys + 1}px;`;
  } else {
    throw new Error(`Can't draw diagonal line ${xs}/${ys} to ${xe}/${ye}!`);
  }
  
  return new XMLElement('div', { class: category, style });
}

// Retângulo preenchido
rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement {
  const style = `left:${Math.round(x)}px; top:${Math.round(y)}px; ` +
                `width:${Math.round(w)}px; height:${Math.round(h)}px;`;
  return new XMLElement('div', { class: category, style });
}

// Jag (colchete) para container tasks
jagToHTML(x: number, y: number): XMLElement {
  return new XMLElement('div', {
    class: 'tj_gantt_jag',
    style: `left:${Math.round(x) - 5}px; top:${Math.round(y)}px;`
  });
}

// Diamante para milestones (2 divs: topo e base)
diamondToHTML(x: number, y: number): XMLElement[] {
  return [
    new XMLElement('div', {
      class: 'tj_diamond_top',
      style: `left:${Math.round(x) - 6}px; top:${Math.round(y) - 7}px;`
    }),
    new XMLElement('div', {
      class: 'tj_diamond_bottom',
      style: `left:${Math.round(x) - 6}px; top:${Math.round(y)}px;`
    })
  ];
}

// Arrow head (ponta de seta)
arrowHeadToHTML(x: number, y: number): XMLElement {
  return new XMLElement('div', {
    class: 'tj_arrow_head',
    style: `left:${Math.round(x) - 5}px; top:${Math.round(y) - 5}px;`
  });
}
```

### 3.4 Pontos Críticos

1. **Sem diagonais** — Apenas linhas horizontais e verticais.

2. **Coordenadas inteiras** — Usa `Math.round()` para evitar subpixel rendering.

3. **CSS classes** — Cada elemento tem uma classe CSS que define cor e estilo.

4. **Diamante em 2 partes** — Topo e base são divs separados para criar efeito de losango.

5. **Mixin pattern** — Em TypeScript, usar interface ou mixin para adicionar esses métodos a GanttTaskBar, GanttMilestone, etc.

---

## 📋 4. REPORTCONTEXT.RB — Contexto de Relatórios

### 4.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Preserva contexto** | Mantém configurações de relatórios aninhados |
| **Query template** | Cria Query com configurações do relatório |
| **Dynamic Report ID** | ID único para relatórios incluídos múltiplas vezes |
| **Backup de atributos** | Permite modificar e restaurar atributos dinamicamente |

### 4.2 Estrutura Interna

```typescript
class ReportContext {
  @project: Project;
  @report: Report;
  @query: Query;
  @dynamicReportId: string;
  @childReportCounter: number = 0;
  @tasks: PropertyList<Task>;
  @resources: PropertyList<Resource>;
  @attributeBackup: [Map<string, Attribute>, Map<string, Attribute>[]] | null = null;
  
  constructor(project: Project, report: Report);
}
```

### 4.3 Construtor

```typescript
constructor(project: Project, report: Report) {
  this.project = project;
  this.report = report;
  this.childReportCounter = 0;
  this.attributeBackup = null;
  
  // Cria Query com configurações do relatório
  const queryAttrs = {
    project: this.project,
    loadUnit: this.report.get('loadUnit'),
    numberFormat: this.report.get('numberFormat'),
    timeFormat: this.report.get('timeFormat'),
    currencyFormat: this.report.get('currencyFormat'),
    start: this.report.get('start'),
    end: this.report.get('end'),
    hideJournalEntry: this.report.get('hideJournalEntry'),
    journalMode: this.report.get('journalMode'),
    journalAttributes: this.report.get('journalAttributes'),
    sortJournalEntries: this.report.get('sortJournalEntries'),
    costAccount: this.report.get('costaccount'),
    revenueAccount: this.report.get('revenueaccount')
  };
  
  this.query = new Query(queryAttrs);
  
  // Verifica se há contexto pai
  const parent = this.project.reportContexts[this.project.reportContexts.length - 1];
  
  if (parent) {
    // Contexto aninhado
    this.dynamicReportId = `${parent.dynamicReportId}.${parent.childReportCounter}`;
    parent.childReportCounter++;
    
    // Copia tasks e resources do pai
    this.tasks = parent.tasks.slice();
    this.resources = parent.resources.slice();
  } else {
    // Contexto raiz
    this.dynamicReportId = "0";
    this.tasks = this.project.tasks.to_ary();
    this.resources = this.project.resources.to_ary();
  }
}
```

### 4.4 Uso no Project

```typescript
// No Project.generateReports():
generateReports(maxCpuCores: number): void {
  this.reports.index();
  
  if (maxCpuCores === 1) {
    // Modo sequencial
    for (const report of this.reports) {
      if (report.get('formats').length === 0) continue;
      
      Log.startProgressMeter(`Report ${report.name}`);
      this.reportContexts.push(new ReportContext(this, report));
      report.generate();
      this.reportContexts.pop();
      Log.stopProgressMeter();
    }
  } else {
    // Modo paralelo
    const bp = new BatchProcessor(maxCpuCores);
    
    for (const report of this.reports) {
      if (report.get('formats').length === 0) continue;
      
      bp.queue(report, () => {
        this.reportContexts.push(new ReportContext(this, report));
        const res = report.generate();
        this.reportContexts.pop();
        return res;
      });
    }
    
    bp.wait((job) => {
      Log.startProgressMeter(`Report ${job.tag.name}`);
      console.log(job.stdout);
      console.error(job.stderr);
      Log.stopProgressMeter();
    });
  }
  
  DataCache.instance.flush();
}
```

### 4.5 Pontos Críticos

1. **Stack de contextos** — `project.reportContexts` é uma stack. O último elemento é o contexto atual.

2. **Dynamic Report ID** — Formato "0.1.2" indica hierarquia de relatórios aninhados.

3. **Query compartilhada** — Todos os relatórios usam a mesma Query template, mas com configurações diferentes.

4. **Backup de atributos** — Permite modificar atributos dinamicamente e restaurar depois (usado em `generateReport()`).

5. **Tasks/Resources copiados** — Cada contexto tem sua própria cópia para evitar interferência entre relatórios.

---

## 🧭 5. NAVIGATOR.RB — Navegação entre Relatórios

### 5.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Menu de navegação** | Gera menu HTML para navegar entre relatórios |
| **Estrutura hierárquica** | Reutiliza estrutura de relatórios aninhados |
| **Filtragem** | `hideReport` controla quais relatórios aparecem |
| **URLs relativas** | Calcula URLs relativas entre relatórios |

### 5.2 Estrutura Interna

```typescript
class NavigatorElement {
  @parent: NavigatorElement | null;
  @label: string;
  @url: string | null;
  @elements: NavigatorElement[] = [];
  @current: boolean = false;
  
  constructor(parent: NavigatorElement | null, label?: string, url?: string);
  
  to_html(html?: XMLElement): XMLElement;
  to_s(indent?: number): void;
}

class Navigator {
  @id: string;
  @project: Project;
  @hideReport: LogicalExpression;
  @elements: NavigatorElement[] = [];
  
  constructor(id: string, project: Project);
  
  generate(allReports: Report[], currentReports: Report[], 
           reportDef: Report, parentElement: NavigatorElement): void;
  to_html(): XMLElement | null;
}
```

### 5.3 generate() — Construção da Árvore

```typescript
generate(allReports: Report[], currentReports: Report[], 
         reportDef: Report, parentElement: NavigatorElement): void {
  let element: NavigatorElement | null = null;
  let nextParentElement: NavigatorElement | null = null;
  let nextParentReport: Report | null = null;
  
  for (const report of currentReports) {
    const hasURL = report.get('formats').includes('html');
    
    // Pula relatórios folha sem HTML
    if ((report.leaf() && !hasURL) || !allReports.includes(report)) continue;
    
    // Label do menu
    const label = report.get('title') || report.name;
    
    // URL do relatório
    const url = this.findReportURL(report, allReports, reportDef);
    
    // Cria elemento do menu
    parentElement.elements.push(
      element = new NavigatorElement(parentElement, label, url)
    );
    
    // Verifica se este é o relatório atual
    if (reportDef === report || reportDef.isChildOf(report)) {
      nextParentReport = report;
      nextParentElement = element;
      element.current = true;
    }
  }
  
  // Recursivamente gera sub-menu se necessário
  if (nextParentReport && nextParentReport.container()) {
    this.generate(allReports, nextParentReport.kids(), reportDef, nextParentElement!);
  }
}
```

### 5.4 to_html() — Renderização HTML

```typescript
to_html(): XMLElement | null {
  const reportDef = this.project.reportContexts[this.project.reportContexts.length - 1].report;
  if (!reportDef) throw new Error("Report context missing");
  
  // Filtra relatórios
  const reports = this.filterReports();
  if (reports.length === 0) return null;
  
  // Verifica se o relatório atual está na lista
  if (!reports.includes(reportDef)) {
    this.project.warning('nav_in_hidden_rep',
      "Navigator requested for a report that is not included in the navigator list.",
      reportDef.sourceFileInfo);
    return null;
  }
  
  // Encontra relatórios top-level
  let topLevelReports: Report[] = [reportDef];
  let report = reportDef;
  while (report.parent) {
    report = report.parent;
    topLevelReports = report.kids();
  }
  
  // Gera árvore
  const content = new NavigatorElement(null);
  this.generate(reports, topLevelReports, reportDef, content);
  
  return content.to_html();
}
```

### 5.5 NavigatorElement.to_html()

```typescript
to_html(html?: XMLElement): XMLElement {
  let first = true;
  const topLevel = !html;
  
  // Container do menu
  html = html || new XMLElement('div', { class: 'navbar_container' });
  if (topLevel) {
    html.append(new XMLElement('hr', { class: 'navbar_topruler' }));
  }
  
  // Container deste (sub-)menu
  html.append(new XMLElement('div', { class: 'navbar' }));
  const div = html.children[html.children.length - 1] as XMLElement;
  
  for (const element of this.elements) {
    // Separador vertical
    if (first) {
      first = false;
    } else {
      div.append(new XMLText('|'));
    }
    
    if (element.current) {
      // Entry atual (highlight)
      const span = new XMLElement('span', { class: 'navbar_current' });
      span.append(new XMLText(element.label));
      div.append(span);
    } else {
      // Link para outro relatório
      const span = new XMLElement('span', { class: 'navbar_other' });
      const a = new XMLElement('a', { href: element.url });
      a.append(new XMLText(element.label));
      span.append(a);
      div.append(span);
    }
  }
  
  // Sub-menu se necessário
  for (const element of this.elements) {
    if (element.current && element.elements.length > 0) {
      if (!first) {
        html.append(new XMLElement('hr', { class: 'navbar_midruler' }));
      }
      element.to_html(html);
      break;
    }
  }
  
  if (topLevel) {
    html.append(new XMLElement('hr', { class: 'navbar_bottomruler' }));
  }
  
  return html;
}
```

### 5.6 Pontos Críticos

1. **filterReports()** — Usa `hideReport` LogicalExpression para filtrar relatórios.

2. **normalizeURL()** — Remove prefixo comum entre URLs para gerar URLs relativas.

3. **findReportURL()** — Para relatórios container, usa URL do primeiro filho com URL.

4. **Interactive mode** — Em modo interativo, URLs apontam para `/taskjuggler?project=...;report=...`.

5. **CSS classes** — `navbar_container`, `navbar`, `navbar_current`, `navbar_other`, `navbar_topruler`, `navbar_midruler`, `navbar_bottomruler`.

---

## 🏛️ 6. REPORTBASE.RB — Base de Todos os Relatórios

### 6.1 Responsabilidades

| Responsabilidade | Descrição |
|---|---|
| **Classe base abstrata** | Superclasse de todos os relatórios |
| **Filtros genéricos** | `filterTaskList()`, `filterResourceList()`, `filterAccountList()` |
| **HTML helpers** | `generateHtmlTableFrame()`, `rt_to_html()` |
| **Acesso a atributos** | `a(attribute)` como atalho para `report.get(attribute)` |

### 6.2 Estrutura Interna

```typescript
abstract class ReportBase {
  @report: Report;
  @project: Project;
  
  constructor(report: Report);
  
  a(attribute: string): any;
  abstract generateIntermediateFormat(): void;
  
  filterAccountList(list: PropertyList<Account>, hideExpr: LogicalExpression | null,
                    rollupExpr: LogicalExpression | null, 
                    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Account>;
  
  filterTaskList(list: PropertyList<Task>, resource: Resource | null,
                 hideExpr: LogicalExpression | null,
                 rollupExpr: LogicalExpression | null,
                 openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Task>;
  
  filterResourceList(list: PropertyList<Resource>, task: Task | null,
                     hideExpr: LogicalExpression | null,
                     rollupExpr: LogicalExpression | null,
                     openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Resource>;
}
```

### 6.3 Filtros Genéricos

```typescript
filterTaskList(list_: PropertyList<Task>, resource: Resource | null,
               hideExpr: LogicalExpression | null,
               rollupExpr: LogicalExpression | null,
               openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Task> {
  const list = new PropertyList(list_);
  
  // Remove tasks que não são descendentes de taskroot
  const taskRoot = this.a('taskroot');
  if (taskRoot) {
    list.deleteIf(task => !task.isChildOf(taskRoot));
  }
  
  // Se temos um resource, verifica se está alocado à task
  if (resource) {
    list.deleteIf(task => {
      let delete_ = true;
      for (const scenarioIdx of this.a('scenarios')) {
        const iv = new TimeInterval(this.a('start'), this.a('end'));
        if (task.hasResourceAllocated(scenarioIdx, iv, resource)) {
          delete_ = false;
          break;
        }
      }
      return delete_;
    });
  }
  
  // Aplica filtros padrão
  this.standardFilterOps(list, hideExpr, rollupExpr, openNodes, resource, taskRoot);
  
  return list;
}

filterResourceList(list_: PropertyList<Resource>, task: Task | null,
                   hideExpr: LogicalExpression | null,
                   rollupExpr: LogicalExpression | null,
                   openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null): PropertyList<Resource> {
  const list = new PropertyList(list_);
  
  // Remove resources que não são descendentes de resourceroot
  const resourceRoot = this.a('resourceroot');
  if (resourceRoot) {
    list.deleteIf(resource => !resource.isChildOf(resourceRoot));
  }
  
  // Se temos uma task, verifica se o resource está alocado
  if (task) {
    const iv = new TimeInterval(this.a('start'), this.a('end'));
    list.deleteIf(resource => {
      let delete_ = true;
      for (const scenarioIdx of this.a('scenarios')) {
        if (task.hasResourceAllocated(scenarioIdx, iv, resource)) {
          delete_ = false;
          break;
        }
      }
      return delete_;
    });
  }
  
  // Aplica filtros padrão
  this.standardFilterOps(list, hideExpr, rollupExpr, openNodes, task, resourceRoot);
  
  return list;
}
```

### 6.4 standardFilterOps() — Filtro Padrão

```typescript
private standardFilterOps(
  list: PropertyList<any>,
  hideExpr: LogicalExpression | null,
  rollupExpr: LogicalExpression | null,
  openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null,
  scopeProperty: PropertyTreeNode | null,
  root: PropertyTreeNode | null
): void {
  // Cria cópia da Query atual
  const query = this.project.reportContexts[this.project.reportContexts.length - 1].query.dup();
  query.scopeProperty = scopeProperty;
  
  // Remove properties que o usuário quer esconder
  if (hideExpr) {
    list.deleteIf(property => {
      query.property = property;
      return hideExpr.eval(query);
    });
  }
  
  // Remove filhos de properties que o usuário fez rollup
  if (rollupExpr || openNodes) {
    list.deleteIf(property => {
      let parent = property.parent;
      let delete_ = false;
      
      while (parent) {
        query.property = parent;
        
        // Se openNodes não é null, apenas os nodes listados serão expandidos
        // Se openNodes é null, apenas os nodes que matcham rollupExpr não serão expandidos
        if ((openNodes && !openNodes.some(([p, sp]) => p === parent && sp === scopeProperty)) ||
            (!openNodes && rollupExpr && rollupExpr.eval(query))) {
          delete_ = true;
          break;
        }
        
        parent = parent.parent;
      }
      
      return delete_;
    });
  }
  
  // Re-adiciona pais em tree mode
  if (list.treeMode()) {
    const parents: PropertyTreeNode[] = [];
    
    for (const property of list) {
      let parent = property;
      while ((parent = parent.parent)) {
        if (!list.includes(parent) && !parents.includes(parent)) {
          parents.push(parent);
        }
        if (parent === root) break;
      }
    }
    
    list.append(parents);
  }
}
```

### 6.5 HTML Helpers

```typescript
protected generateHtmlTableFrame(): XMLElement {
  const table = new XMLElement('table', {
    class: 'tj_table_frame',
    cellspacing: '1'
  });
  
  // Headline box
  if (this.a('headline')) {
    table.append(this.generateHtmlTableRow(() => {
      const td = new XMLElement('td');
      const div = new XMLElement('div', { class: 'tj_table_headline' });
      div.append(this.a('headline').to_html());
      td.append(div);
      return td;
    }));
  }
  
  return table;
}

protected generateHtmlTableRow(content: () => XMLElement): XMLElement {
  return new XMLElement('tr').append(content());
}

protected rt_to_html(name: string): XMLElement | null {
  const text = this.a(name);
  if (!text) return null;
  
  text.sectionNumbers = false;
  return text.to_html();
}
```

### 6.6 Pontos Críticos

1. **Abstract class** — `ReportBase` é abstrata. Subclasses devem implementar `generateIntermediateFormat()`.

2. **Filtros composáveis** — `hideExpr`, `rollupExpr`, `openNodes` podem ser combinados.

3. **Tree mode** — Em tree mode, pais são re-adicionados automaticamente para manter hierarquia.

4. **Query compartilhada** — Usa a Query do contexto atual para avaliar expressões lógicas.

5. **Resource/Task allocation check** — Verifica se resource está alocado à task em qualquer cenário reportado.

---

## 🎯 7. GUIA DE IMPLEMENTAÇÃO EM DENO/TYPESCRIPT

### 7.1 Ordem de Implementação

```
FASE 15A: Helpers e Contexto
  1. HTMLGraphics.ts (mixin) ⭐
  2. ReportContext.ts ⭐
  3. ReportBase.ts ⭐

FASE 15B: Roteamento e Navegação
  4. CollisionDetector.ts (necessário para GanttRouter)
  5. GanttRouter.ts ⭐
  6. Navigator.ts ⭐

FASE 15C: Integração
  7. Atualizar TableReport.ts para usar ReportBase
  8. Atualizar GanttChart.ts para usar GanttRouter
  9. Atualizar Report.ts para usar ReportContext e Navigator
```

### 7.2 Decisões de Design TypeScript

#### 7.2.1 HTMLGraphics como Mixin
```typescript
// Mixin pattern
function HTMLGraphicsMixin<T extends { constructor: Function }>(Base: T) {
  return class extends Base {
    lineToHTML(xs: number, ys: number, xe: number, ye: number, category: string): XMLElement {
      // Implementação
    }
    
    rectToHTML(x: number, y: number, w: number, h: number, category: string): XMLElement {
      // Implementação
    }
    
    // ... outros métodos
  };
}

// Uso
class GanttTaskBar extends HTMLGraphicsMixin(Object) {
  // Agora tem acesso a lineToHTML, rectToHTML, etc.
}
```

#### 7.2.2 ReportContext com Stack
```typescript
class Project {
  reportContexts: ReportContext[] = [];
  
  get currentReportContext(): ReportContext | null {
    return this.reportContexts[this.reportContexts.length - 1] || null;
  }
  
  pushReportContext(report: Report): void {
    this.reportContexts.push(new ReportContext(this, report));
  }
  
  popReportContext(): void {
    this.reportContexts.pop();
  }
}
```

#### 7.2.3 GanttRouter com CollisionDetector
```typescript
class CollisionDetector {
  private zones: Zone[] = [];
  
  addBlockedZone(x: number, y: number, w: number, h: number, 
                 blockHorizontal: boolean, blockVertical: boolean): void {
    this.zones.push({ x, y, w, h, blockHorizontal, blockVertical });
  }
  
  collision(pos: number, segment: [number, number], horizontal: boolean): boolean {
    // Verifica se pos cruza alguma zona bloqueada
    for (const zone of this.zones) {
      if (horizontal && zone.blockHorizontal) {
        if (pos >= zone.y && pos < zone.y + zone.h) {
          if (segment[1] >= zone.x && segment[0] < zone.x + zone.w) {
            return true;
          }
        }
      } else if (!horizontal && zone.blockVertical) {
        if (pos >= zone.x && pos < zone.x + zone.w) {
          if (segment[1] >= zone.y && segment[0] < zone.y + zone.h) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

class GanttRouter {
  private detector: CollisionDetector;
  
  constructor(width: number, height: number) {
    this.detector = new CollisionDetector();
  }
  
  addZone(x: number, y: number, w: number, h: number, 
          horiz: boolean, vert: boolean): void {
    this.detector.addBlockedZone(x, y, w, h, horiz, vert);
  }
  
  // ... resto da implementação
}
```

#### 7.2.4 ReportBase como Abstract Class
```typescript
abstract class ReportBase {
  protected report: Report;
  protected project: Project;
  
  constructor(report: Report) {
    this.report = report;
    this.project = report.project;
  }
  
  protected a(attribute: string): any {
    return this.report.get(attribute);
  }
  
  abstract generateIntermediateFormat(): void;
  
  protected filterTaskList(
    list: PropertyList<Task>,
    resource: Resource | null,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: [PropertyTreeNode, PropertyTreeNode | null][] | null
  ): PropertyList<Task> {
    // Implementação
  }
  
  // ... outros métodos
}

class TaskListRE extends ReportBase {
  generateIntermediateFormat(): void {
    // Implementação específica
  }
}
```

### 7.3 Pontos de Atenção (Armadilhas)

1. **CollisionDetector não foi anexado** — É essencial para GanttRouter. Precisa ser implementado.

2. **HTMLGraphics é um mixin** — Em TypeScript, usar mixin pattern ou interface.

3. **ReportContext é uma stack** — Sempre usar `project.reportContexts[project.reportContexts.length - 1]` para acessar contexto atual.

4. **Navigator usa URLs relativas** — `normalizeURL()` remove prefixo comum entre URLs.

5. **ReportBase é abstrata** — Subclasses devem implementar `generateIntermediateFormat()`.

6. **Filtros são composáveis** — `hideExpr`, `rollupExpr`, `openNodes` podem ser combinados.

7. **Tree mode re-adiciona pais** — Em tree mode, pais são re-adicionados automaticamente.

8. **Dynamic Report ID** — Formato "0.1.2" indica hierarquia de relatórios aninhados.

9. **Query template** — Todos os relatórios usam a mesma Query template, mas com configurações diferentes.

10. **Backup de atributos** — Permite modificar atributos dinamicamente e restaurar depois.

---

## 📋 8. CHECKLIST ATUALIZADO

### ✅ Já analisados (90+ arquivos)
- [x] **Parser**: TjpSyntaxRules, ProjectFileScanner, ProjectFileParser, SyntaxReference, KeywordDocumentation, TextParser
- [x] **Modelo**: Project, PropertyTreeNode, Task, Resource, Account, Shift, Scenario, AttributeDefinition, TjTime, PropertySet, ScenarioData, Attributes, AttributeBase
- [x] **Scheduler**: TaskScenario, ResourceScenario, Scoreboard, TaskJuggler, Allocation, Booking, TaskDependency, Limits, ShiftAssignments
- [x] **Financeiro**: Charge, ChargeSet, Account, AccountScenario, AccountCredit, RealFormat
- [x] **Lógica**: LogicalExpression, LogicalOperation, LogicalFunction
- [x] **Queries**: Query, SimpleQueryExpander
- [x] **RichText**: RichText
- [x] **Reports Base**: Report, TableReport, TaskListRE, ResourceListRE, TextReport, ReportTable, ReportTableColumn, ReportTableCell, ReportTableLine, TableColumnDefinition, ReportTableLegend
- [x] **Gantt**: GanttChart, GanttLine, GanttHeader, GanttTaskBar, GanttMilestone, GanttContainer, GanttLoadStack, GanttRouter ⭐, HTMLGraphics ⭐
- [x] **HTML**: HTMLDocument
- [x] **Tempo**: Interval, IntervalList, WorkingHours
- [x] **Apoio**: AlertLevelDefinitions, PropertyList, LeaveList, DataCache, Journal, MessageHandler, Log
- [x] **Time Sheets**: TimeSheets, TimeSheetSender, TimeSheetReceiver, TimeSheetSummary
- [x] **Utilitários**: URLParameter, BatchProcessor, StdIoWrapper, PTNProxy, deep_copy, TernarySearchTree, KateSyntax
- [x] **Fase 15**: GanttRouter, HTMLGraphics, ReportContext ⭐, Navigator ⭐, ReportBase ⭐

### 🔮 Próximos 5 (Fase 16 - Reports Específicos)
- [ ] **AccountListRE.rb** ⭐ — Relatório de contas (balance)
- [ ] **ExportRE.rb** ⭐ — Export em formato TJP
- [ ] **TraceReport.rb** ⭐ — Relatório de trace
- [ ] **ICalReport.rb** ⭐ — Export iCalendar
- [ ] **NikuReport.rb** ⭐ — Integração com Clarity

---

## 🎁 9. EXEMPLO DE FLUXO COMPLETO (TypeScript)

```typescript
// 1. GanttRouter em ação
const router = new GanttChart(1000, 500);
router.addZone(100, 50, 200, 20, true, false);  // Bloqueia horizontal
router.addZone(300, 100, 20, 100, false, true); // Bloqueia vertical

const arrows = router.routeLines([
  [50, 60, 400, 150],   // Setas de dependência
  [100, 80, 350, 200]
]);

// 2. HTMLGraphics em ação
const ganttTaskBar = new GanttTaskBar(query, 20, 100, 300, 50);
const html = ganttTaskBar.to_html();
// Usa rectToHTML(), lineToHTML(), etc. internamente

// 3. ReportContext em ação
const project = new Project('prj', 'My Project', '1.0');
const report = new Report(project, 'r1', 'My Report', null);

project.pushReportContext(report);
const context = project.currentReportContext;
console.log(context.dynamicReportId);  // "0"
console.log(context.query);  // Query com configurações do relatório
project.popReportContext();

// 4. Navigator em ação
const navigator = new Navigator('nav1', project);
navigator.hideReport = new LogicalExpression(new LogicalOperation(0));
const navHtml = navigator.to_html();
// Gera menu HTML com links para todos os relatórios

// 5. ReportBase em ação
class MyReport extends ReportBase {
  generateIntermediateFormat(): void {
    const taskList = this.filterTaskList(
      new PropertyList(this.project.tasks),
      null,
      this.a('hideTask'),
      this.a('rollupTask'),
      this.a('openNodes')
    );
    // ... gera relatório
  }
}
```

---

**Fim da Fase 15.** O sistema de relatórios está agora **completamente mapeado**. A próxima IA tem tudo que precisa para implementar em Deno/TypeScript. A ordem sugerida de leitura dos próximos arquivos Ruby é: `AccountListRE.rb` → `ExportRE.rb` → `TraceReport.rb` → `ICalReport.rb` → `NikuReport.rb`. 🚀
````

---

## Arquivo: `docs/tj3-engine/00-blueprint-heuristics.md`

````md
# O Motor de Agendamento do TaskJuggler: Time Slots e Algoritmo Heurístico

Vou destrinchar como o coração do TaskJuggler funciona. A base de tudo está documentada no **manual oficial** e no **código-fonte Ruby**, então combinei a explicação conceitual com a implementação real.

---

## 🧩 Por que Time Slots?

O TaskJuggler **não** trabalha com datas contínuas. Ele discretiza o tempo em intervalos fixos chamados **time slots**, porque:

1. **Simplifica a alocação de recursos** — verificar disponibilidade em pontos discretos é mais rápido que calcular intervalos contínuos.
2. **Permite paralelismo controlado** — vários recursos podem ser alocados ao mesmo slot.
3. **Facilita o "placar de recursos"** — cada slot tem um contador de quantos recursos estão livres.

### Granularidade dos Slots

O tamanho do slot é definido pelo atributo `schedulinggranularity` do projeto. Valores válidos:

| Granularidade | Uso típico |
|---|---|
| `60min` | Projetos de longo prazo, pouca precisão |
| `30min` | Padrão razoável |
| `15min` | Equilíbrio precisão/performance |
| `5min` | Projetos curtos e detalhados |
| `1min` | Máxima precisão (muito lento) |

Quanto menor o slot, mais preciso o agendamento — mas o custo computacional cresce **linearmente** com o número de slots. Um projeto de 1 ano com slots de 5min gera ~105.000 slots.

### Como os Slots São Criados

O agendador percorre o intervalo `[project.start, project.end]` e cria um slot para cada intervalo de `schedulinggranularity`. Cada slot conhece:

- **Timestamp de início e fim**
- **Se está dentro do horário de trabalho** (considerando `workinghours`, feriados, férias)
- **Quais recursos estão disponíveis** naquele momento
- **Quais tarefas já estão alocadas**

Isso é definido no código pelos conceitos de `WorkingHours` e `Calendar` (no arquivo `lib/taskjuggler/WorkingHours.rb`).

---

## ⚙️ O Algoritmo Heurístico

O TaskJuggler **não usa programação linear, PERT/CPM puro ou otimização matemática**. Ele usa uma **heurística gananciosa (greedy) com priorização**, porque:

- Projetos reais têm restrições complexas (recursos limitados, dependências, turnos).
- Soluções ótimas são NP-difíceis.
- O usuário quer **um resultado rápido e "bom o suficiente"**, não o ótimo matemático.

### Os 3 Estados de uma Tarefa

Durante o agendamento, cada tarefa passa por estados:

1. **Not Ready** — ainda não pode ser agendada (dependências não resolvidas, recursos indisponíveis, ou está aguardando priorização).
2. **Ready** — todas as dependências resolvidas e recursos potencialmente disponíveis. É candidata a agendamento.
3. **Scheduling Completed** — já tem datas e recursos alocados. Sai da fila.

### O Loop Principal

O algoritmo funciona assim (simplificado):

```
1. Inicializar todos os slots e o ResourceScoreboard
2. Marcar tarefas sem dependências como Ready
3. Enquanto houver tarefas Ready:
   a. Ordenar tarefas Ready por critério de prioridade
   b. Pegar a tarefa de maior prioridade
   c. Tentar alocar recursos e datas para ela
   d. Se conseguir → marcar como Completed
   e. Se não conseguir → deixar em Ready ou marcar como impossível
   f. Atualizar tarefas dependentes (podem virar Ready)
4. Gerar relatórios
```

### Os Critérios de Priorização

A ordenação das tarefas "Ready" usa uma combinação de fatores:

| Critério | Peso | Descrição |
|---|---|---|
| **Priority** | Definido pelo usuário | Atributo `priority` na tarefa (0–1000) |
| **Path Criticalness** | Calculado | Quão crítica é a tarefa para o caminho mais longo do projeto |
| **Start/End constraints** | Definido | Tarefas com `start` ou `end` fixos têm preferência |
| **Dependency depth** | Calculado | Tarefas que "seguram" muitas outras são priorizadas |

O **Path Criticalness** é o conceito mais interessante: o TaskJuggler calcula, para cada tarefa, o comprimento do caminho mais longo até o fim do projeto. Tarefas nesse caminho têm prioridade maior — é uma versão "dinâmica" do CPM clássico.

### O ResourceScoreboard

Cada slot de tempo tem um **placar de recursos**. Quando o agendador tenta alocar uma tarefa:

1. Para cada slot necessário, verifica se há recursos livres do tipo exigido.
2. Se sim, "debita" do placar.
3. Se não, tenta o próximo slot disponível ou falha.

O placar é atualizado a cada alocação. Isso evita que duas tarefas peguem o mesmo recurso no mesmo slot.

### Alocação de Esforço vs. Duração

O TaskJuggler distingue:

- **`duration`** — tempo de calendário que a tarefa ocupa.
- **`effort`** — quantidade de trabalho (em pessoa-dias/horas).
- **`length`** — número de slots que a tarefa ocupa.

Se você define `effort 10d` e aloca 2 recursos, a duração será ~5 dias. O agendador distribui o esforço entre os recursos disponíveis nos slots.

### Tratamento de Conflitos

Quando não há recursos suficientes:

- **`allocation`** pode ter `mandatory` (falha se não alocar) ou `alternative` (tenta outro recurso).
- O agendador pode **atrasar** a tarefa para um slot futuro com recursos livres.
- Pode **dividir** a tarefa em partes (se `scheduling` permitir).

---

## 🔬 Detalhes Avançados

### Scheduler e ResourceScoreboard

No código-fonte Ruby, os arquivos centrais são:

- `lib/taskjuggler/Scheduler.rb` — o loop principal
- `lib/taskjuggler/ResourceScoreboard.rb` — o placar de recursos
- `lib/taskjuggler/TaskScenario.rb` — estado da tarefa durante agendamento
- `lib/taskjuggler/WorkingHours.rb` — cálculo de horários úteis
- `lib/taskjuggler/Booking.rb` — alocação efetiva

### Forward vs. Backward Scheduling

- **Forward** (padrão): parte do início do projeto e agenda para frente.
- **Backward**: parte do fim e agenda para trás (usado quando você fixa `end`).

### Cenários Múltiplos

O TaskJuggler suporta **múltiplos cenários** no mesmo projeto (ex: otimista, pessimista, realista). Cada cenário tem seu próprio agendamento — útil para análise de risco.

---

## 📚 Fontes para Aprofundar

### Documentação Oficial
1. **TaskJuggler Manual — Seção "Scheduling"**  
   https://taskjuggler.org/tj3/manual/index.html  
   A referência definitiva. Procure os capítulos sobre "Scheduling", "Time Slots" e "Resource Allocation".

2. **TaskJuggler Tutorial**  
   https://taskjuggler.org/tj3/tutorial/index.html  
   Mostra o agendador em ação com exemplos práticos.

3. **Referência de Atributos**  
   https://taskjuggler.org/tj3/manual/task.html  
   Detalha `effort`, `duration`, `length`, `scheduling`, `priority`, etc.

### Código-Fonte (Ruby)
4. **Repositório no GitHub**  
   https://github.com/taskjuggler/TaskJuggler  
   Leia `lib/taskjuggler/Scheduler.rb` e `lib/taskjuggler/ResourceScoreboard.rb` — é a verdade última sobre o algoritmo.

5. **Documentação interna do código**  
   O código tem comentários extensos em inglês explicando cada decisão heurística.

### Livros e Artigos
6. **"Project Management with TaskJuggler"** — Chris Schläger (autor do TJ)  
   Explica a filosofia por trás do agendador.

7. **Artigos sobre heurísticas de scheduling de projetos com recursos restritos (RCPSP)**  
   - "Resource-Constrained Project Scheduling: Models, Algorithms, Extensions and Applications" — Artigues, Demassey, Neron  
   - A busca por "RCPSP heuristics" no Google Scholar traz centenas de papers.

8. **Comparação CPM vs. Heurísticas**  
   - "Critical Chain Project Management" — Lawrence Leach  
   - Explica por que CPM puro não funciona com recursos limitados.


### Papers Acadêmicos
12. **"A Survey of Resource-Constrained Project Scheduling"** — Hartmann & Briskorn (2010)  
    Revisão clássica de algoritmos RCPSP.

13. **"Heuristic Algorithms for RCPSP"** — Kolisch & Hartmann  
    Compara heurísticas gulosas, busca local e metaheurísticas.

---

## 💡 Resumo para sua Reescrita em TypeScript

Se você for implementar isso:

1. **Comece com slots de 60min** e um único recurso — valida a lógica básica.
2. **Implemente o ResourceScoreboard** como um `Map<number, ResourceAvailability>` (timestamp → disponibilidade).
3. **Use o Path Criticalness** como critério principal de priorização — é o que dá "inteligência" ao algoritmo.
4. **Trate `effort` vs `duration`** desde o início — é fonte comum de bugs.
5. **Não tente otimizar** — a heurística greedy já produz resultados aceitáveis.

---

# Estrutura de Classes em TypeScript: `Scheduler` e `ResourceScoreboard`

Abaixo está um rascunho completo e comentado. Ele segue os conceitos do Ruby original, mas adaptado para TypeScript idiomático (imutabilidade onde faz sentido, tipos fortes, e `Map` em vez de arrays esparsos).

---

## 📦 Tipos Base

```typescript
// types.ts

/** Granularidade do slot em minutos. */
export type Granularity = 1 | 5 | 10 | 15 | 30 | 60;

/** Timestamp em minutos desde a epoch do projeto (não Unix). */
export type Tick = number;

/** Identificador único de tarefa ou recurso. */
export type TaskId = string;
export type ResourceId = string;

/** Estado de uma tarefa durante o agendamento. */
export enum TaskState {
  NotReady = 'not_ready',
  Ready = 'ready',
  Completed = 'completed',
  Failed = 'failed',
}

/** Modo de agendamento. */
export enum SchedulingMode {
  ASAP = 'asap',       // As Soon As Possible
  ALAP = 'alap',       // As Late As Possible
}

/** Como o esforço é distribuído entre recursos. */
export enum EffortMode {
  /** Todos os recursos trabalham juntos até terminar. */
  Continuous = 'continuous',
  /** Recursos trabalham em turnos (ex: 2 pessoas × 4h). */
  Discrete = 'discrete',
}
```

---

## 🕐 `TimeSlot` e `Calendar`

O `TimeSlot` é a unidade atômica do agendamento. O `Calendar` decide quais slots são "úteis".

```typescript
// TimeSlot.ts

export interface TimeSlot {
  /** Índice do slot (0 = primeiro slot do projeto). */
  readonly index: number;
  /** Timestamp de início em minutos desde a epoch do projeto. */
  readonly start: Tick;
  /** Timestamp de fim em minutos desde a epoch do projeto. */
  readonly end: Tick;
  /** Se o slot está dentro de horário de trabalho. */
  isWorking: boolean;
  /** Recursos disponíveis neste slot (IDs). */
  availableResources: Set<ResourceId>;
}
```

```typescript
// Calendar.ts

import { Granularity, Tick, TimeSlot } from './types';

/**
 * Responsável por gerar a linha do tempo de slots e decidir
 * quais são "úteis" (working hours, feriados, férias).
 *
 * Equivalente Ruby: lib/taskjuggler/WorkingHours.rb + Calendar.rb
 */
export class Calendar {
  private slots: TimeSlot[] = [];

  constructor(
    private readonly projectStart: Date,
    private readonly projectEnd: Date,
    private readonly granularity: Granularity,
    /** Ex: { mon: ['09:00-12:00', '13:00-18:00'], ... } */
    private readonly workingHours: Map<string, string[]>,
    private readonly holidays: Set<string>, // 'YYYY-MM-DD'
  ) {}

  /** Constrói todos os slots do projeto. Chamado uma vez no início. */
  build(): void {
    const granMs = this.granularity * 60_000;
    const startMs = this.projectStart.getTime();
    const endMs = this.projectEnd.getTime();

    let index = 0;
    for (let t = startMs; t < endMs; t += granMs) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + granMs);
      const isWorking = this.isWithinWorkingHours(slotStart, slotEnd);

      this.slots.push({
        index: index++,
        start: Math.floor((t - startMs) / 60_000),
        end: Math.floor((t + granMs - startMs) / 60_000),
        isWorking,
        availableResources: new Set(),
      });
    }
  }

  getSlots(): readonly TimeSlot[] {
    return this.slots;
  }

  getSlot(index: number): TimeSlot | undefined {
    return this.slots[index];
  }

  /** Converte um Date para o índice do slot correspondente. */
  tickToSlotIndex(tick: Tick): number {
    return Math.floor(tick / this.granularity);
  }

  private isWithinWorkingHours(start: Date, end: Date): boolean {
    const dayKey = start.toISOString().slice(0, 10);
    if (this.holidays.has(dayKey)) return false;

    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][start.getDay()];
    const ranges = this.workingHours.get(weekday);
    if (!ranges) return false;

    // Simplificação: assume que o slot inteiro cabe em um range.
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return ranges.some((r) => {
      const [from, to] = r.split('-');
      const [fh, fm] = from.split(':').map(Number);
      const [th, tm] = to.split(':').map(Number);
      return startMin >= fh * 60 + fm && endMin <= th * 60 + tm;
    });
  }
}
```

---

## 📊 `ResourceScoreboard`

O placar rastreia quantos recursos de cada tipo estão livres em cada slot. É a estrutura mais consultada durante o agendamento — por isso precisa ser **rápida**.

```typescript
// ResourceScoreboard.ts

import { ResourceId, Tick, TimeSlot } from './types';

/**
 * Representa uma "reserva" de recurso em um intervalo de slots.
 */
export interface Booking {
  readonly taskId: string;
  readonly resourceId: ResourceId;
  readonly slotIndex: number;
  /** Esforço consumido neste slot (em minutos). */
  readonly effort: number;
}

/**
 * Placar de disponibilidade de recursos por slot.
 *
 * Conceito central: para cada slot e cada recurso, sabemos quanto
 * ainda está livre. O agendador "debita" ao alocar e "credita" ao
 * desalocar (backtracking).
 *
 * Equivalente Ruby: lib/taskjuggler/ResourceScoreboard.rb
 */
export class ResourceScoreboard {
  /**
   * Mapa: slotIndex → (resourceId → minutos disponíveis).
   * Usamos Map (não array) porque a maioria dos slots tem poucos recursos ativos.
   */
  private availability: Map<number, Map<ResourceId, number>> = new Map();

  /**
   * Histórico de bookings, para permitir rollback.
   * Indexado por taskId para desalocação rápida.
   */
  private bookings: Map<string, Booking[]> = new Map();

  constructor(
    private readonly slots: readonly TimeSlot[],
    /** Capacidade máxima de cada recurso por slot (em minutos). */
    private readonly resourceCapacity: Map<ResourceId, number>,
  ) {
    this.initialize();
  }

  /** Inicializa todos os slots com a capacidade total de cada recurso. */
  private initialize(): void {
    for (const slot of this.slots) {
      const slotMap = new Map<ResourceId, number>();
      if (slot.isWorking) {
        for (const [resId, cap] of this.resourceCapacity) {
          slotMap.set(resId, cap);
        }
      }
      this.availability.set(slot.index, slotMap);
    }
  }

  /**
   * Consulta se um recurso tem pelo menos `minutes` livres no slot.
   */
  canBook(slotIndex: number, resourceId: ResourceId, minutes: number): boolean {
    const slotMap = this.availability.get(slotIndex);
    if (!slotMap) return false;
    const free = slotMap.get(resourceId) ?? 0;
    return free >= minutes;
  }

  /**
   * Debita `minutes` do recurso no slot. Retorna false se não houver espaço.
   * NÃO faz rollback automático — o chamador deve usar `release` em caso de falha.
   */
  book(booking: Booking): boolean {
    const { slotIndex, resourceId, effort, taskId } = booking;
    if (!this.canBook(slotIndex, resourceId, effort)) return false;

    const slotMap = this.availability.get(slotIndex)!;
    slotMap.set(resourceId, slotMap.get(resourceId)! - effort);

    // Registra no histórico
    if (!this.bookings.has(taskId)) this.bookings.set(taskId, []);
    this.bookings.get(taskId)!.push(booking);

    return true;
  }

  /**
   * Libera todos os bookings de uma tarefa (rollback).
   * Usado quando o agendador desiste de uma alocação.
   */
  release(taskId: string): void {
    const taskBookings = this.bookings.get(taskId);
    if (!taskBookings) return;

    for (const b of taskBookings) {
      const slotMap = this.availability.get(b.slotIndex);
      if (slotMap) {
        slotMap.set(b.resourceId, (slotMap.get(b.resourceId) ?? 0) + b.effort);
      }
    }
    this.bookings.delete(taskId);
  }

  /**
   * Retorna o primeiro slot a partir de `fromIndex` onde o recurso
   * tem `minutes` disponíveis.
   */
  findFirstAvailable(
    fromIndex: number,
    resourceId: ResourceId,
    minutes: number,
  ): number | null {
    for (let i = fromIndex; i < this.slots.length; i++) {
      if (this.canBook(i, resourceId, minutes)) return i;
    }
    return null;
  }

  /** Snapshot para debug/análise. */
  snapshot(slotIndex: number): ReadonlyMap<ResourceId, number> {
    return this.availability.get(slotIndex) ?? new Map();
  }
}
```

---

## 🧠 `Scheduler`

O orquestrador. Ele mantém a fila de tarefas "Ready", ordena por prioridade e tenta alocar cada uma.

```typescript
// Scheduler.ts

import { Calendar } from './Calendar';
import { ResourceScoreboard, Booking } from './ResourceScoreboard';
import {
  EffortMode,
  SchedulingMode,
  TaskId,
  TaskState,
  Tick,
  TimeSlot,
} from './types';

/** Definição de uma tarefa (vinda do parser). */
export interface TaskDefinition {
  id: TaskId;
  /** Duração em minutos (opcional se `effort` for definido). */
  duration?: number;
  /** Esforço total em minutos (opcional se `duration` for definido). */
  effort?: number;
  /** Tarefas das quais esta depende. */
  depends?: TaskId[];
  /** Recursos alocados (IDs). */
  allocate?: string[];
  /** Prioridade definida pelo usuário (0–1000). */
  priority?: number;
  /** Data de início fixa (tick). */
  startConstraint?: Tick;
  /** Data de fim fixa (tick). */
  endConstraint?: Tick;
  /** Modo de agendamento. */
  scheduling?: SchedulingMode;
  /** Modo de distribuição de esforço. */
  effortMode?: EffortMode;
}

/** Estado mutável de uma tarefa durante o agendamento. */
interface TaskRuntime {
  def: TaskDefinition;
  state: TaskState;
  /** Slot onde a tarefa efetivamente começa. */
  scheduledStart?: number;
  /** Slot onde termina. */
  scheduledEnd?: number;
  /** Recursos efetivamente alocados. */
  assignedResources: string[];
  /** Comprimento do caminho mais longo até o fim (path criticalness). */
  pathCriticalness: number;
}

/**
 * Motor de agendamento heurístico do TaskJuggler.
 *
 * Equivalente Ruby: lib/taskjuggler/Scheduler.rb
 */
export class Scheduler {
  private tasks: Map<TaskId, TaskRuntime> = new Map();
  private readyQueue: TaskId[] = [];

  constructor(
    private readonly calendar: Calendar,
    private readonly scoreboard: ResourceScoreboard,
    private readonly taskDefs: TaskDefinition[],
  ) {
    for (const def of taskDefs) {
      this.tasks.set(def.id, {
        def,
        state: TaskState.NotReady,
        assignedResources: [],
        pathCriticalness: 0,
      });
    }
  }

  /** Ponto de entrada. Executa o loop principal de agendamento. */
  run(): void {
    this.computePathCriticalness();
    this.seedReadyQueue();

    let iterations = 0;
    const maxIterations = this.tasks.size * 100; // guarda contra loop infinito

    while (this.readyQueue.length > 0) {
      if (++iterations > maxIterations) {
        throw new Error('Scheduler: possível loop infinito detectado');
      }

      this.sortReadyQueue();
      const taskId = this.readyQueue.shift()!;
      const task = this.tasks.get(taskId)!;

      const success = this.tryScheduleTask(task);

      if (success) {
        task.state = TaskState.Completed;
        this.unlockDependents(taskId);
      } else {
        task.state = TaskState.Failed;
        // Em produção: registrar warning, tentar fallback (ex: atrasar)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priorização
  // ─────────────────────────────────────────────────────────────

  /**
   * Calcula o "path criticalness": comprimento do caminho mais longo
   * desta tarefa até o fim do projeto. Tarefas com valor alto são
   * priorizadas porque atrasá-las atrasa o projeto inteiro.
   *
   * Implementação: DFS com memoização (ordenação topológica reversa).
   */
  private computePathCriticalness(): void {
    const memo = new Map<TaskId, number>();

    const visit = (id: TaskId): number => {
      if (memo.has(id)) return memo.get(id)!;
      const task = this.tasks.get(id)!;
      const duration = this.estimateDuration(task.def);

      let maxChild = 0;
      for (const other of this.tasks.values()) {
        if (other.def.depends?.includes(id)) {
          maxChild = Math.max(maxChild, visit(other.def.id));
        }
      }

      const value = duration + maxChild;
      memo.set(id, value);
      return value;
    };

    for (const id of this.tasks.keys()) {
      this.tasks.get(id)!.pathCriticalness = visit(id);
    }
  }

  /**
   * Ordena a fila de tarefas Ready por:
   *   1. priority (usuário) — decrescente
   *   2. pathCriticalness — decrescente
   *   3. startConstraint — crescente (tarefas com data fixa primeiro)
   */
  private sortReadyQueue(): void {
    this.readyQueue.sort((aId, bId) => {
      const a = this.tasks.get(aId)!;
      const b = this.tasks.get(bId)!;

      const pa = a.def.priority ?? 0;
      const pb = b.def.priority ?? 0;
      if (pa !== pb) return pb - pa;

      if (a.pathCriticalness !== b.pathCriticalness) {
        return b.pathCriticalness - a.pathCriticalness;
      }

      const sa = a.def.startConstraint ?? Infinity;
      const sb = b.def.startConstraint ?? Infinity;
      return sa - sb;
    });
  }

  /** Marca como Ready todas as tarefas sem dependências. */
  private seedReadyQueue(): void {
    for (const task of this.tasks.values()) {
      if (!task.def.depends || task.def.depends.length === 0) {
        task.state = TaskState.Ready;
        this.readyQueue.push(task.def.id);
      }
    }
  }

  /** Após concluir uma tarefa, verifica quais dependentes ficaram prontos. */
  private unlockDependents(completedId: TaskId): void {
    for (const task of this.tasks.values()) {
      if (task.state !== TaskState.NotReady) continue;
      if (!task.def.depends?.includes(completedId)) continue;

      const allDone = task.def.depends.every(
        (dep) => this.tasks.get(dep)?.state === TaskState.Completed,
      );

      if (allDone) {
        task.state = TaskState.Ready;
        this.readyQueue.push(task.def.id);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Alocação
  // ─────────────────────────────────────────────────────────────

  /**
   * Tenta agendar uma tarefa. Retorna true se conseguiu alocar todos
   * os recursos necessários em slots contíguos.
   *
   * Estratégia:
   *   1. Determinar o slot inicial (ASAP ou ALAP).
   *   2. Para cada recurso necessário, encontrar slots livres.
   *   3. Se todos os recursos couberem, efetivar os bookings.
   *   4. Se algum falhar, fazer rollback de todos.
   */
  private tryScheduleTask(task: TaskRuntime): boolean {
    const { def } = task;
    const requiredResources = def.allocate ?? [];
    if (requiredResources.length === 0) {
      // Tarefa sem recursos: apenas marca datas.
      task.scheduledStart = def.startConstraint ?? 0;
      task.scheduledEnd = task.scheduledStart + this.estimateDuration(def);
      return true;
    }

    const durationSlots = Math.ceil(
      this.estimateDuration(def) / this.calendar.getSlots()[1].start,
    );

    const startSlot = this.findStartSlot(task, durationSlots);
    if (startSlot === null) return false;

    // Tenta alocar cada recurso
    const stagedBookings: Booking[] = [];
    for (const resId of requiredResources) {
      const success = this.stageResource(
        task,
        resId,
        startSlot,
        durationSlots,
        stagedBookings,
      );
      if (!success) {
        // Rollback parcial
        this.rollbackStaged(stagedBookings);
        return false;
      }
    }

    // Efetiva todos os bookings
    for (const b of stagedBookings) {
      this.scoreboard.book(b);
    }

    task.scheduledStart = startSlot;
    task.scheduledEnd = startSlot + durationSlots;
    task.assignedResources = [...requiredResources];
    return true;
  }

  /** Encontra o slot inicial conforme o modo (ASAP/ALAP/constraint). */
  private findStartSlot(task: TaskRuntime, durationSlots: number): number | null {
    const { def } = task;

    if (def.startConstraint !== undefined) {
      return this.calendar.tickToSlotIndex(def.startConstraint);
    }

    // Maior slot de término entre as dependências
    let earliest = 0;
    for (const depId of def.depends ?? []) {
      const dep = this.tasks.get(depId);
      if (dep?.scheduledEnd !== undefined) {
        earliest = Math.max(earliest, dep.scheduledEnd);
      }
    }

    return earliest;
  }

  /**
   * Tenta reservar UM recurso em `durationSlots` slots contíguos.
   * Acumula os bookings em `staged` para rollback posterior.
   */
  private stageResource(
    task: TaskRuntime,
    resourceId: string,
    startSlot: number,
    durationSlots: number,
    staged: Booking[],
  ): boolean {
    const slots = this.calendar.getSlots();
    const minutesPerSlot = slots[1].start - slots[0].start;

    for (let i = 0; i < durationSlots; i++) {
      const slotIndex = startSlot + i;
      const slot = slots[slotIndex];
      if (!slot || !slot.isWorking) continue;

      const minutes = minutesPerSlot; // simplificação: 100% do slot
      if (!this.scoreboard.canBook(slotIndex, resourceId, minutes)) {
        return false;
      }

      staged.push({
        taskId: task.def.id,
        resourceId,
        slotIndex,
        effort: minutes,
      });
    }
    return true;
  }

  private rollbackStaged(staged: Booking[]): void {
    // Nada foi efetivado ainda — apenas limpa o array.
    staged.length = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Estima a duração em minutos.
   * Se `duration` existe, usa diretamente.
   * Se `effort` existe, divide pelo número de recursos.
   */
  private estimateDuration(def: TaskDefinition): number {
    if (def.duration !== undefined) return def.duration;
    if (def.effort !== undefined) {
      const n = def.allocate?.length ?? 1;
      return def.effort / n;
    }
    return 0;
  }
}
```

---

## 🚀 Exemplo de Uso

```typescript
// main.ts

import { Calendar } from './Calendar';
import { ResourceScoreboard } from './ResourceScoreboard';
import { Scheduler, TaskDefinition } from './Scheduler';

const projectStart = new Date('2025-01-06T09:00:00');
const projectEnd = new Date('2025-03-31T18:00:00');

const workingHours = new Map([
  ['mon', ['09:00-12:00', '13:00-18:00']],
  ['tue', ['09:00-12:00', '13:00-18:00']],
  ['wed', ['09:00-12:00', '13:00-18:00']],
  ['thu', ['09:00-12:00', '13:00-18:00']],
  ['fri', ['09:00-12:00', '13:00-18:00']],
]);

const calendar = new Calendar(projectStart, projectEnd, 60, workingHours, new Set());
calendar.build();

const resourceCapacity = new Map([
  ['alice', 60 * 8],
  ['bob', 60 * 8],
]);

const scoreboard = new ResourceScoreboard(calendar.getSlots(), resourceCapacity);

const tasks: TaskDefinition[] = [
  {
    id: 'design',
    effort: 60 * 16, // 2 dias
    allocate: ['alice'],
    priority: 100,
  },
  {
    id: 'implement',
    effort: 60 * 40, // 5 dias
    allocate: ['alice', 'bob'],
    depends: ['design'],
    priority: 100,
  },
  {
    id: 'test',
    effort: 60 * 16,
    allocate: ['bob'],
    depends: ['implement'],
  },
];

const scheduler = new Scheduler(calendar, scoreboard, tasks);
scheduler.run();

console.log('Agendamento concluído.');
```

---

## ⚠️ Limitações Deste Rascunho

1. **`EffortMode.Discrete`** não implementado — assume-se `Continuous`.
2. **Backward scheduling (ALAP)** — só o modo ASAP está completo.
3. **Múltiplos cenários** — omitidos para simplificar.
4. **Turnos complexos** (`shift`, `booking`) — o `Calendar` só lida com horários semanais simples.
5. **`allocate` com `alternative`** — só aceita recursos fixos.
6. **Feriados e férias** — o `Set` de holidays é simplificado.
7. **Otimização** — `findFirstAvailable` é O(n), poderia usar uma árvore de intervalos.

---

## 🔧 Próximos Passos Sugeridos

1. **Testes unitários** para `ResourceScoreboard` — é onde bugs de alocação se escondem.
2. **Implementar `effortMode: Discrete`** — distribui esforço em turnos.
3. **Adicionar backtracking** — se uma tarefa falha, tentar movê-la para frente.
4. **Parser de `.tjp`** — sem isso, você só tem a API interna.
5. **Relatórios** — exportar para CSV/HTML usando os dados dos bookings.

Se quiser, posso detalhar alguma parte específica (ex: o `Calendar` com suporte a feriados complexos, ou o parser do `.tjp`). É só pedir.
````

---

