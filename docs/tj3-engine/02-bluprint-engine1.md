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