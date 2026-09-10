# 📚 Próximos 5 Arquivos para Detalhar o Core Engine

Os 5 arquivos anteriores cobriram o **pipeline de parsing** (texto → AST). Agora precisamos cobrir o **modelo de domínio + scheduler** (AST → projeto agendado). Estes são os arquivos que fazem o TaskJuggler *funcionar de verdade*.

---

## 🎯 Os 5 Arquivos

### 1. 🏗️ `lib/taskjuggler/Project.rb`
**O orquestrador central** — contém o método `schedule()` que é o **coração do engine**. É aqui que:
- O parser é invocado
- As propriedades são validadas
- O scheduler é chamado para cada cenário
- Os relatórios são gerados
- As macros globais são injetadas

> **Por que é essencial:** Sem ele, você tem um parser que gera objetos soltos. O `Project.rb` é a "cola" que conecta parsing → validação → scheduling → reporting.

---

### 2. 🌳 `lib/taskjuggler/PropertyTreeNode.rb`
**A base de TODAS as propriedades** (Task, Resource, Account, Shift, Scenario, Report). Define:
- A árvore pai/filho (`parent`, `children`, `leaf?`, `container?`)
- O sistema de IDs (`id`, `fullId`, `fullId=`)
- Herança de atributos (`inheritAttributes`)
- Acesso a atributos por cenário (`get`, `set`, `[]`, `[]=`)
- O mecanismo de `provided` (saber se o usuário setou ou é default)

> **Por que é essencial:** É a classe mais usada do sistema. Task, Resource, Account, Shift e Scenario **herdam** dela. Entender `PropertyTreeNode` é entender 80% do modelo de domínio.

---

### 3. 📋 `lib/taskjuggler/Task.rb`
**A entidade mais complexa** — além de herdar de `PropertyTreeNode`, adiciona:
- `TaskScenario` (atributos por cenário: start, end, effort, duration, etc.)
- Lógica de dependências (`depends`, `precedes`)
- Adoção de tarefas (`adopt`)
- Cálculo de `forward` (ASAP vs ALAP)
- Validação de overspecification/underspecification
- Bookings e allocations

> **Por que é essencial:** É onde a complexidade do scheduling reside. O `Task.rb` mostra como atributos como `effort`, `duration`, `length` e `milestone` interagem (mutual exclusion via `setDurationAttribute`).

---

### 4. 🏷️ `lib/taskjuggler/AttributeDefinition.rb`
**O sistema de tipos de atributos** — define:
- Os tipos base: `DateAttribute`, `FloatAttribute`, `StringAttribute`, `RichTextAttribute`, `ReferenceAttribute`, `ListAttribute`, `BooleanAttribute`
- O mecanismo de **herança** (`inherit`, `scenarioSpecific`)
- O controle de **overwrite** (`AttributeOverwrite` exception)
- O flag `provided` (diferenciar valor default de valor setado pelo usuário)
- O modo `AttributeBase.setMode(1)` para atributos herdados vs. explícitos

> **Por que é essencial:** O sistema de atributos do TaskJuggler é **único** — atributos podem ser herdados do pai, do projeto global, ou ser scenario-specific. Sem entender isso, a reimplementação vai falhar nos casos de herança e cenários múltiplos.

---

### 5. ⏰ `lib/taskjuggler/TjTime.rb`
**O sistema de tempo interno** — define:
- Representação interna: **minutos desde 1970-01-01 00:00 UTC** (não usa `Date` do Ruby!)
- Parsing de strings ISO 8601 (`2026-01-01-09:00:00-0300`)
- Conversão de timezone (integra com `TZInfo`)
- Alinhamento com `scheduleGranularity` (5, 10, 15, 20, 30 ou 60 min)
- Operações aritméticas (`+`, `-`, comparação)
- `sameTimeNextDay`, `sameTimeNextWeek`, etc.

> **Por que é essencial:** **Tudo** no TaskJuggler é baseado em `TjTime`. Datas de tarefas, intervalos de booking, working hours, leaves — tudo usa essa classe. Um erro aqui quebra todo o scheduler.

---

## 🔄 Como Eles Se Relacionam com os 5 Anteriores

```
FASE 1 (já coberta): PARSING
  TjpSyntaxRules → ProjectFileParser → ProjectFileScanner
  SyntaxReference → KeywordDocumentation

FASE 2 (agora): MODELO + SCHEDULING
  Project.rb
    ├── invoca → ProjectFileParser (Fase 1)
    ├── contém → PropertySet<Task>, PropertySet<Resource>, ...
    │              └── cada item é um PropertyTreeNode
    │                    └── Task.rb (herda de PropertyTreeNode)
    │                          └── usa → AttributeDefinition
    │                          └── usa → TjTime
    └── chama → Scheduler.schedule()
```

---

## 📋 O Que a Próxima IA Vai Poder Fazer Com Estes 5 Arquivos

| Arquivo | Permite Implementar |
|---|---|
| `Project.rb` | O fluxo completo: `parse() → validate() → schedule() → report()` |
| `PropertyTreeNode.rb` | A árvore de propriedades com herança e cenários |
| `Task.rb` | Tasks com dependências, esforço, duração, milestones |
| `AttributeDefinition.rb` | O sistema de tipos com herança e scenario-specific |
| `TjTime.rb` | Datas, intervalos, timezones e alinhamento de granularidade |

---

## 💡 Arquivos que Ficaram para a Fase 3

Após estes 5, os próximos candidatos seriam:

| Arquivo | Motivo |
|---|---|
| `Scheduler.rb` | O algoritmo de alocação de recursos (o mais complexo!) |
| `Resource.rb` + `ResourceScenario.rb` | Recursos com efficiency, leaves, shifts |
| `WorkingHours.rb` | Horário de trabalho por dia da semana |
| `Interval.rb` + `IntervalList.rb` | Intervalos de tempo para bookings/leaves |
| `LogicalExpression.rb` + `LogicalOperation.rb` | Expressões lógicas para filtros de relatório |

---
