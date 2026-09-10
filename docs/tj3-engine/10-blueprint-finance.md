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