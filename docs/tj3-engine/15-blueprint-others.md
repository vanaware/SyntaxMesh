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