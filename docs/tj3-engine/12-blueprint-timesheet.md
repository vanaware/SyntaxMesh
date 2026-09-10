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