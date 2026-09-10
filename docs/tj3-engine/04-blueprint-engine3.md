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