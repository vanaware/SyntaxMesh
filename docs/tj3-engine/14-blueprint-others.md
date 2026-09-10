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