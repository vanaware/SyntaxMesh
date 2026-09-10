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