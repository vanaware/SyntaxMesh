# Fase 5 — Entidades Concretas

> **Arquivo:** `docs/syntaxmesh/fases/fase-5-entidades-concretas.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 6–8 dias
> **Depende de:** Fase 2 — Tempo e Geometria; Fase 3 — Modelo de Atributos; Fase 4 — Árvore de Propriedades
> **Bloqueia:** Fases 6, 7, 8, 9, 10, 11, 14, 16

---

## 1. Contexto

Até aqui temos:
- `TjTime`, `Interval`, `Scoreboard`, `WorkingHours` (Fase 2).
- `AttributeBase`, ~40 subclasses, `AttributeDefinition` (Fase 3).
- `PropertyTreeNode`, `PropertySet`, `ScenarioData`, `Scenario`, `PTNProxy` (Fase 4).

O que falta é o que o TaskJuggler **usa de verdade**: `Task`, `Resource`, `Account`, `Shift`, `Report`. Essas são as entidades que aparecem no `.tjp` e que o scheduler manipula.

Cada entidade concreta é, na prática, um **wrapper fino** sobre `PropertyTreeNode`:

1. Herda de `PropertyTreeNode`.
2. Registra-se em `project.<tipo>s` (`project.tasks`, `project.resources`, etc.).
3. Cria uma instância de `*Scenario` por cenário, que implementa a parte scenario-specific.

Além disso, esta fase **define os `AttributeDefinition`s de cada `PropertySet`**. Isso é o conteúdo dos ~141 atributos que o `Project.rb` do TaskJuggler registra nos construtores dos `PropertySet`s. É a "especificação" do que cada tipo de propriedade tem.

**Nota crítica:** os `*Scenario` (`TaskScenario`, `ResourceScenario`, etc.) nesta fase são **esqueletos**. Toda a lógica de scheduling, book, propagação, validação etc. é da Fase 7. Aqui só preparamos a estrutura e forçamos a criação dos atributos que o scheduler vai usar.

Esta fase fecha o "modelo de domínio". Depois dela, tudo que o TaskJuggler "conhece" existe em TypeScript. O scheduler (Fase 7) e o parser (Fase 10) é que darão vida.

---

## 2. Objetivo

Ao final desta fase:

- `Task`, `Resource`, `Account`, `Shift`, `Report` implementadas.
- `TaskScenario`, `ResourceScenario`, `AccountScenario`, `ShiftScenario`, `ReportScenario` como esqueletos.
- `ProjectLike` estendida com métodos de registro (`addTask`, `addResource`, etc.).
- **~141 `AttributeDefinition`s** registradas por `PropertySet` (via funções `registerTaskAttributes(ps)`, etc.).
- `MockProject` completo com todos os `PropertySet`s.
- **≥ 100 testes unitários** + **≥ 20 golden tests** (contagem de atributos, defaults, flags de herança).
- ADR 015 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `Task.rb` | ~50 (esqueleto) | Baixa | **Crítica** |
| `TaskScenario.rb` | ~1200 | — | Esqueleto nesta fase |
| `Resource.rb` | ~80 | Baixa | **Crítica** |
| `ResourceScenario.rb` | ~900 | — | Esqueleto nesta fase |
| `Account.rb` | ~40 | Baixa | **Crítica** |
| `AccountScenario.rb` | ~130 | — | Esqueleto nesta fase |
| `Shift.rb` | ~45 | Baixa | **Crítica** |
| `ShiftScenario.rb` | ~40 | Baixa | **Crítica** |
| `Project.rb` | (seções 200–420) | **Alta** | **Crítica** (fonte das `AttributeDefinition`s) |
| `Report.rb` | (construtor) | Baixa | **Crítica** |

**Importante:** o `Project.rb` é a **fonte da verdade** para os `AttributeDefinition`s. Ele contém, no construtor, a lista completa de atributos por `PropertySet`. Vamos portar essa lista inteira nesta fase.

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.3 AttributeDefinitions por PropertySet | Lista consolidada |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.4 Formato de AttributeDefinition | Tupla de 8 campos |
| `docs/tj3-engine/02-bluprint-engine1.md` | §4.1 Task.rb | Estrutura da Task |
| `docs/tj3-engine/06-blueprint-engine5.md` | §4.3 Padrão de Delegação | `scenarioData(scIdx)` |

### 3.3 Golden tests

Usamos `tj3` para extrair as definições reais dos atributos. O script `scripts/golden/attribute-definitions.rb` percorre cada `PropertySet` criado pelo `Project` do Ruby e serializa cada `AttributeDefinition` em JSON. O teste TS compara com nossas definições.

Isso garante **100% de cobertura** das definições de atributo sem depender de leitura manual do `Project.rb`.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Entidades são wrappers finos

Em Ruby, `Task`, `Resource`, `Account`, `Shift` têm ~40–80 linhas cada, quase todas boilerplate. Em TS, replicamos essa estrutura:

```ts
class Task extends PropertyTreeNode {
  constructor(project: ProjectLike, id: string | null, name: string | null, parent: Task | null) {
    super(project.tasks, id, name, parent);
    project.addTask(this);
    this.data = Array.from({ length: project.scenarioCount }, () => null as any);
    for (let i = 0; i < project.scenarioCount; i++) {
      new TaskScenario(this, i, this.getScenarioAttributes(i));
    }
  }
}
```

### 4.2 `*Scenario` como esqueletos

`TaskScenario` e `ResourceScenario` no Ruby têm ~1200 e ~900 linhas respectivamente. **Nesta fase, são esqueletos** com apenas:
- Constructor que chama `super(property, scenarioIdx, attributes)`.
- **Pré-carregamento de atributos** (ver ADR 015).

Todo o resto vai para a Fase 7. `AccountScenario` e `ShiftScenario` são mais simples e podem ser quase completos, mas ainda assim deixamos `turnover`/`onShift?` para fases futuras.

### 4.3 `ProjectLike` estendida

`PropertyTreeNode` já usa `propertySet.project` para `scenarioCount` e `scenario(idx)`. As entidades concretas precisam de mais:

```ts
interface ProjectLike {
  // Já existente
  readonly scenarioCount: number;
  scenario(idx: number): Scenario | null;
  scenarioIdx(scenario: Scenario | string): number | undefined;

  // PropertySets (para as entidades se registrarem)
  readonly scenarios: PropertySet<Scenario>;
  readonly shifts: PropertySet<Shift>;
  readonly accounts: PropertySet<Account>;
  readonly resources: PropertySet<Resource>;
  readonly tasks: PropertySet<Task>;
  readonly reports: PropertySet<Report>;

  // Registro
  addScenario(s: Scenario): void;
  addShift(s: Shift): void;
  addAccount(a: Account): void;
  addTask(t: Task): void;
  addResource(r: Resource): void;
  addReport(r: Report): void;
  removeAccount(a: Account): void;

  // Atributos de projeto (usados por inheritAttributes)
  get(attributeId: string): unknown;
  set(attributeId: string, value: unknown): void;
}
```

A interface cresce mas permanece enxuta. `Project` real (Fase 9) implementará tudo isso.

### 4.4 `getScenarioAttributes(scIdx)` no `PropertyTreeNode`

Ruby acessa `@scenarioAttributes[i]` diretamente da subclasse. Em TS, adicionamos um **método protegido** em `PropertyTreeNode` (retro-compatível com Fase 4):

```ts
protected getScenarioAttributes(scIdx: number): Map<string, AttributeBase> {
  return this.scenarioAttributes[scIdx];
}
```

Isso evita expor o array inteiro. Ajuste pequeno na Fase 4.

### 4.5 `KeywordArray` → `string[]` com `'*'` sentinela

Ruby tem `KeywordArray` (subclasse de `Array` com `'*'` especial). Em TS:

```ts
type KeywordList = string[];  // '*' é sentinela
function keywordListIncludes(list: KeywordList, value: string): boolean {
  return list[0] === '*' || list.includes(value);
}
```

### 4.6 `Symbol` no Ruby → string no TS

Onde o Ruby usa símbolos (`:tasks`, `:days`), TS usa strings (`'tasks'`, `'days'`). Compatível com o `RealFormat` e `WorkingHours` da Fase 2 (que já usam strings).

### 4.7 `nil` default

Onde o Ruby usa `nil`, TS usa `null`. Onde o Ruby usa `[]` ou `LeaveList.new`, TS usa `[]` ou um novo `LeaveList` (Fase 16 — mas `LeaveList` é simples: `Array<Leave>`; definimos `Leave` como stub nesta fase).

### 4.8 `registerXAttributes(ps)` — funções em vez de bloco

Em vez de colocar 44 linhas no construtor de `Task`, extraímos para funções:

```ts
export function registerTaskAttributes(ps: PropertySet<Task>): void {
  ps.addAttributeType(new AttributeDefinition('allocate', 'Allocations', AttributeType.AllocationAttribute, true, false, true, []));
  ps.addAttributeType(new AttributeDefinition('assignedresources', ...));
  // ... 42 mais
}
```

Isso permite testar as definições isoladamente e mantém o construtor de `Task` limpo.

### 4.9 Ordem dos atributos importa?

Em Ruby, a ordem de `attrs.each` define a ordem de registro. `eachAttributeDefinition` retorna ordenado por `id`, então a ordem de inserção não afeta o comportamento final. **Mas** para golden tests (comparação com Ruby), preservar a ordem do `Project.rb` ajuda a detectar divergências.

**Decisão:** preservar a ordem exata do `Project.rb`.

### 4.10 `KeywordArray.new([ '*' ])` para defaults

Atributos como `definitions`, `journalAttributes`, `taskAttributes`, `resourceAttributes` têm default `KeywordArray.new([ '*' ])`. Em TS, default é `['*']`.

---

## 5. Subfases detalhadas

---

### 9.0 — ADR 015 (pré-carregamento de atributos em `*Scenario`)

#### Contexto

O `TaskScenario.rb` Ruby tem, no construtor:

```ruby
%w( allocate assignedresources booking charge chargeset complete
    competitors criticalness depends duration
    effort effortdone effortleft end forward gauge length
    maxend maxstart minend minstart milestone pathcriticalness
    precedes priority projectionmode responsible
    scheduled shifts start status ).each do |attr|
  @property[attr, @scenarioIdx]
end
```

Isso **força a criação** de cada atributo no `ScenarioData` atual. Como o `attribute(id)` é lazy (Fase 4), sem esse pré-carregamento os atributos só seriam criados no primeiro acesso.

Mesma coisa em `ResourceScenario.rb` e `AccountScenario.rb`.

#### Objetivo

Registrar a decisão de **replicar** esse pré-carregamento em TS.

#### Arquivos

- `docs/syntaxmesh/decisoes/015-pre-carregamento-atributos-scenario.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** explicar o pré-carregamento do Ruby e por que existe.
- [ ] **Decisão:** replicar via helper `preloadAttributes([...])` em `ScenarioData`.
- [ ] **Alternativas:**
  - Não pré-carregar (lazy puro) — mais eficiente em memória.
  - Pré-carregar tudo — desperdício.
- [ ] **Consequências:**
  - **Positivas:** fidelidade ao Ruby; testes podem verificar existência; evita bugs sutis em `set` sem `attribute()`.
  - **Negativas:** ~30–50 atributos criados por cenário mesmo se não usados.
  - **Mitigação:** lista de pré-carregamento é curada (só os atributos que o scheduler vai tocar).
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — construtor.
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — construtor.
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb` — construtor.
- Seção 4.2.

#### Fora de escopo

- Implementação (subfase 9.1).

#### Critério de aceite

- ADR 015 criado.
- Tabela atualizada.

---

### 9.1 — Estender `ProjectLike` + `ScenarioData.preloadAttributes`

#### Contexto

Antes das entidades, precisamos:
- Estender `ProjectLike` com métodos de registro e acesso a `PropertySet`s.
- Adicionar `preloadAttributes(ids: string[])` em `ScenarioData`.
- Adicionar `getScenarioAttributes(scIdx)` em `PropertyTreeNode` (protected).

#### Objetivo

Preparar infraestrutura para entidades.

#### Arquivos

- `packages/core/src/model/project-like.ts` (estender)
- `packages/core/src/model/scenario-data.ts` (estender)
- `packages/core/src/model/property-tree-node.ts` (estender — método protegido)
- `packages/core/tests/model/scenario-data-preload_test.ts`
- `packages/core/tests/model/mock-project.ts` (atualizar)

#### Requisitos

**`ProjectLike`:**

- [ ] Adicionar campos `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports` (todos `PropertySet<T>`).
- [ ] Adicionar métodos `addScenario`, `addShift`, `addAccount`, `addTask`, `addResource`, `addReport`, `removeAccount`.
- [ ] Adicionar `get(attributeId)` e `set(attributeId, value)`.
- [ ] Adicionar `scenarioIdx(scenario | id): number | undefined`.

**`PropertyTreeNode`:**

- [ ] `protected getScenarioAttributes(scIdx: number): Map<string, AttributeBase>`.

**`ScenarioData`:**

- [ ] `protected preloadAttributes(ids: string[]): void` — para cada id, chama `this.attribute(id)` (que cria lazy). Se o atributo não existir na definição, lança `TjArgumentError`.
- [ ] Modificar `attribute(id)` para suportar chamada de dentro do `ScenarioData` (hoje é privado em `PropertyTreeNode`). **Solução:** expor `getScenarioAttribute(scIdx, id)` como público em `PropertyTreeNode`, e `ScenarioData.preloadAttributes` chama esse método.

**`MockProject`:**

- [ ] Implementar toda a `ProjectLike`.
- [ ] Criar `PropertySet`s para cada tipo no construtor.
- [ ] `addX` registra no `PropertySet` correspondente.
- [ ] `get`/`set` de atributos de projeto via `Map<string, unknown>`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb`.
- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — `getAttribute`.

#### Fora de escopo

- Entidades concretas (9.2+).

#### Critério de aceite

```ts
const mp = new MockProject(1);
mp.tasks.addAttributeType(new AttributeDefinition("effort", "Effort", AttributeType.DurationAttribute, false, false, true, 0));
assertEquals(mp.tasks.knownAttribute("effort"), true);
assertEquals(mp.scenarioCount, 1);
assert(mp.scenario(0) !== null);
```

#### Testes

- `scenario-data-preload_test.ts`:
  - `describe("ScenarioData.preloadAttributes")`
    - `it("cria atributos lazy")`.
    - `it("não recria se já existe")`.
    - `it("rejeita atributo desconhecido")`.
    - `it("aceita lista vazia")`.
- `mock-project_test.ts` (estender):
  - `it("cria todos os PropertySets")`.
  - `it("addTask registra em tasks")`.
  - `it("addResource registra em resources")`.
  - `it("scenarioIdx por id")`.

---

### 9.2 — `Task` + `TaskScenario` (esqueleto)

#### Contexto

`Task` é a entidade mais usada do TaskJuggler. `TaskScenario` é onde vive a lógica scenario-specific (esqueleto nesta fase).

#### Objetivo

Implementar `Task` e `TaskScenario` mínimo.

#### Arquivos

- `packages/core/src/model/task.ts`
- `packages/core/src/model/task-scenario.ts`
- `packages/core/tests/model/task_test.ts`

#### Requisitos

**`Task`:**

- [ ] `class Task extends PropertyTreeNode`.
- [ ] Constructor `(project: ProjectLike, id: string | null, name: string | null, parent: Task | null)`:
  - `super(project.tasks, id, name, parent)`.
  - `project.addTask(this)`.
  - `this.data = new Array(project.scenarioCount)`.
  - Para cada `i` em `[0, project.scenarioCount)`:
    - `new TaskScenario(this, i, this.getScenarioAttributes(i))`.
- [ ] `scenarioData(scIdx: number): TaskScenario` — override tipado de `PropertyTreeNode.scenarioData`.

**`TaskScenario`:**

- [ ] `class TaskScenario extends ScenarioData`.
- [ ] Constructor `(task: Task, scIdx: number, attributes: Map<string, AttributeBase>)`:
  - `super(task, scIdx, attributes)`.
  - `this.preloadAttributes(TASK_SCENARIO_ATTRS)`.
- [ ] `const TASK_SCENARIO_ATTRS: string[]` com a lista exata do Ruby:
  ```
  allocate, assignedresources, booking, charge, chargeset, complete,
  competitors, criticalness, depends, duration, effort, effortdone,
  effortleft, end, forward, gauge, length, maxend, maxstart, minend,
  minstart, milestone, pathcriticalness, precedes, priority,
  projectionmode, responsible, scheduled, shifts, start, status
  ```
  (31 atributos — mesma lista do Ruby, linhas 24–30 do `TaskScenario.rb`.)

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Task.rb` — arquivo completo.
- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` — construtor (linhas iniciais).

#### Fora de escopo

- Lógica de scheduling — Fase 7.

#### Critério de aceite

```ts
const mp = new MockProject(1);
registerTaskAttributes(mp.tasks);
const t = new Task(mp, "t1", "Task 1", null);
assert(t instanceof Task);
assert(t instanceof PropertyTreeNode);
assertEquals(mp.tasks.items(), 1);
assert(t.scenarioData(0) instanceof TaskScenario);
assert(t.getScenarioAttribute(0, "effort") !== undefined);
```

#### Testes

- `task_test.ts`:
  - `describe("Task")`
    - `it("registra em project.tasks")`.
    - `it("cria um TaskScenario por cenário")`.
    - `it("scenarioData retorna TaskScenario tipado")`.
    - `it("pré-carrega os 31 atributos do Ruby")`.
    - `it("aceita parent Task")`.
    - `it("fullId respeita hierarquia")`.

---

### 9.3 — `Resource` + `ResourceScenario` (esqueleto)

#### Contexto

`Resource` é similar a `Task` mas com atributos específicos (`efficiency`, `rate`, `leaves`, etc.).

#### Objetivo

Implementar `Resource` e `ResourceScenario` mínimo.

#### Arquivos

- `packages/core/src/model/resource.ts`
- `packages/core/src/model/resource-scenario.ts`
- `packages/core/tests/model/resource_test.ts`

#### Requisitos

**`Resource`:**

- [ ] Análogo a `Task`.
- [ ] Constructor `(project, id, name, parent: Resource | null)`.

**`ResourceScenario`:**

- [ ] Constructor `(resource, scIdx, attributes)`:
  - `super(...)`.
  - `this.preloadAttributes(RESOURCE_SCENARIO_ATTRS)`.
- [ ] `const RESOURCE_SCENARIO_ATTRS: string[]` com a lista exata do Ruby:
  ```
  alloctdeffort, chargeset, criticalness, directreports, duties,
  efficiency, effort, limits, managers, rate, reports, shifts,
  leaves, leaveallowances, workinghours
  ```
  (15 atributos — do `ResourceScenario.rb` linhas iniciais.)

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Resource.rb`.
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — construtor.

#### Fora de escopo

- Book, availability, treeSum — Fase 7.

#### Critério de aceite

Análogo a `Task`.

#### Testes

- `resource_test.ts`:
  - `it("registra em project.resources")`.
  - `it("cria um ResourceScenario por cenário")`.
  - `it("pré-carrega os 15 atributos do Ruby")`.
  - `it("aceita parent Resource")`.

---

### 9.4 — `Account` + `AccountScenario` (esqueleto)

#### Contexto

`Account` representa contas financeiras. `AccountScenario` tem `turnover()` (Fase 8).

#### Objetivo

Implementar `Account` e `AccountScenario` mínimo.

#### Arquivos

- `packages/core/src/model/account.ts`
- `packages/core/src/model/account-scenario.ts`
- `packages/core/tests/model/account_test.ts`

#### Requisitos

**`Account`:**

- [ ] Análogo a `Task`.

**`AccountScenario`:**

- [ ] Constructor pré-carrega `['credits']` (única no Ruby).
- [ ] Stub de `turnover(startIdx, endIdx): number` — lança `NotYetImplementedError` (Fase 8).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Account.rb`.
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb` — construtor.

#### Fora de escopo

- `turnover`, `query_balance`, `query_turnover` — Fase 8.

#### Critério de aceite

Análogo.

#### Testes

- `account_test.ts`:
  - `it("registra em project.accounts")`.
  - `it("cria um AccountScenario por cenário")`.
  - `it("pré-carrega credits")`.
  - `it("turnover lança NotYetImplementedError")`.

---

### 9.5 — `Shift` + `ShiftScenario`

#### Contexto

`Shift` representa turnos. `ShiftScenario` **é simples** e pode ser implementado quase completo nesta fase.

#### Objetivo

Implementar `Shift` e `ShiftScenario`.

#### Arquivos

- `packages/core/src/model/shift.ts`
- `packages/core/src/model/shift-scenario.ts`
- `packages/core/tests/model/shift_test.ts`

#### Requisitos

**`Shift`:**

- [ ] Análogo.

**`ShiftScenario`:**

- [ ] Constructor pré-carrega `[]` (o Ruby não pré-carrega; acessa `a('workinghours')` sob demanda).
- [ ] `onShift?(date: TjTime): boolean` — `(this.a('workinghours') as WorkingHours).onShift(date)`.
- [ ] `replace?(): boolean` — `this.a('replace') as boolean`.
- [ ] `onLeave?(date: TjTime): boolean` — itera `a('leaves')` e verifica se `date` está em algum intervalo.

**Nota:** `a(attributeName)` é o helper de `ScenarioData` (Fase 4) que retorna `this.attributes.get(name).get()`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Shift.rb`.
- `docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb` — arquivo completo.

#### Fora de escopo

- Integração com `ResourceScenario` — Fase 7.

#### Critério de aceite

```ts
const shift = new Shift(mp, "morning", "Morning", null);
const scenario = shift.scenarioData(0);
const wh = new WorkingHours(3600, start, end, "UTC");
shift.setForScenario("workinghours", wh, 0);
assert(scenario.onShift(TjTime.fromString("2026-01-05-10:00")));
```

#### Testes

- `shift_test.ts`:
  - `it("registra em project.shifts")`.
  - `it("onShift usa workinghours")`.
  - `it("replace lê do atributo")`.
  - `it("onLeave percorre leaves")`.

---

### 9.6 — `Report` + `ReportScenario` (esqueleto)

#### Contexto

`Report` é a entidade que descreve um relatório. O parser da Fase 10 instancia; a Fase 14 gera o conteúdo. Aqui só criamos a estrutura.

#### Objetivo

Implementar `Report` e `ReportScenario` (dummy).

#### Arquivos

- `packages/core/src/model/report.ts`
- `packages/core/src/model/report-scenario.ts`
- `packages/core/tests/model/report_test.ts`

#### Requisitos

**`Report`:**

- [ ] Análogo.
- [ ] Campos adicionais: `typeSpec: ReportType | null`, `content: unknown` (Fase 14).
- [ ] `ReportType` enum: `AccountReport`, `Export`, `ICal`, `Niku`, `ResourceReport`, `TagFile`, `TextReport`, `TaskReport`, `TraceReport`, `StatusSheet`, `TimeSheet`.
- [ ] `checkFileName(name: string): void` — rejeita `\?%*:|"<>` em Windows, `\\?%*:|"<>` em Unix.
- [ ] `absoluteFileName?(name): boolean`.
- [ ] `absoluteFileName(name): string` — prepend `project.outputDir` se relativo.

**`ReportScenario`:**

- [ ] `class ReportScenario extends ScenarioData` — vazio (só satisfaz a criação de `data[]`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Report.rb` — construtor + `checkFileName`.

#### Fora de escopo

- `generate()` — Fase 14.

#### Critério de aceite

```ts
const r = new Report(mp, "r1", "Report 1", null);
assertEquals(r.typeSpec, null);
r.set("formats", ["html"]);
assertEquals(r.get("formats"), ["html"]);
assertThrows(() => new Report(mp, "r2", "In*valid", null));
```

#### Testes

- `report_test.ts`:
  - `it("registra em project.reports")`.
  - `it("cria ReportScenario por cenário")`.
  - `it("typeSpec inicia null")`.
  - `it("rejeita nome com caracteres inválidos")`.
  - `it("absoluteFileName prepend outputDir")`.
  - `it("absoluteFileName preserva absoluto")`.

---

### 9.7 — `AttributeDefinitions`: Scenarios

#### Contexto

Primeira das 6 subfases que registram `AttributeDefinition`s. Segue a ordem do `Project.rb`.

#### Objetivo

Implementar `registerScenarioAttributes(ps: PropertySet<Scenario>)`.

#### Arquivos

- `packages/core/src/model/attributes/scenario-attributes.ts`
- `packages/core/tests/model/attributes/scenario-attributes_test.ts`

#### Requisitos

- [ ] `registerScenarioAttributes(ps)` adiciona (na ordem):
  ```
  active       BooleanAttribute  inherit=true,  proj=false, scen=false, default=true
  id           StringAttribute   inherit=false, proj=false, scen=false, default=null
  name         StringAttribute   inherit=false, proj=false, scen=false, default=null
  ownbookings  BooleanAttribute  inherit=false, proj=false, scen=false, default=true
  projection   BooleanAttribute  inherit=true,  proj=false, scen=false, default=false
  seqno        IntegerAttribute  inherit=false, proj=false, scen=false, default=null
  ```
- [ ] **Nota:** `id`, `name`, `seqno` **já** estão no `PropertySet` base. O `registerScenarioAttributes` só adiciona `active`, `ownbookings`, `projection`. Os demais são **verificados** para garantir que estão lá, mas não re-adicionados.
  - Se `ps.knownAttribute('id')`, não fazer nada (base já adicionou).
  - Comportamento esperado: `registerScenarioAttributes` deve ser idempotente e ciente da base.

**Decisão de design:** o `registerXAttributes` só adiciona os atributos **específicos**, não os base. A lista "completa" fica para os golden tests.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@scenarios = PropertySet.new(self, true)`.

#### Fora de escopo

- Lógica de projeção — Fase 9.

#### Critério de aceite

```ts
const mp = new MockProject(1);
registerScenarioAttributes(mp.scenarios);
assertEquals(mp.scenarios.knownAttribute("active"), true);
assertEquals(mp.scenarios.knownAttribute("ownbookings"), true);
assertEquals(mp.scenarios.knownAttribute("projection"), true);
assertEquals(mp.scenarios.knownAttribute("id"), true); // base
assertEquals(mp.scenarios.scenarioSpecific?("active"), false);
assertEquals(mp.scenarios.inheritedFromParent?("active"), true);
```

#### Testes

- `scenario-attributes_test.ts`:
  - `it("registra active, ownbookings, projection")`.
  - `it("não re-adiciona id, name, seqno")`.
  - `it("flags de herança corretas")`.
  - `it("defaults corretos")`.

---

### 9.8 — `AttributeDefinitions`: Shifts

#### Objetivo

Implementar `registerShiftAttributes(ps: PropertySet<Shift>)`.

#### Arquivos

- `packages/core/src/model/attributes/shift-attributes.ts`
- `packages/core/tests/model/attributes/shift-attributes_test.ts`

#### Requisitos

Adicionar (ordem do `Project.rb`):
```
bsi          StringAttribute        false,false,false, ""
index        IntegerAttribute       false,false,false, -1
leaves       LeaveListAttribute     true, true, true,  new LeaveList()
replace      BooleanAttribute       true, false,true,  false
timezone     StringAttribute        true, true, true,  TjTime.getTimeZone()
tree         StringAttribute        false,false,false, ""
workinghours WorkingHoursAttribute  true, true, true,  null
```

**Nota:** `LeaveList` é stub nesta fase (`class LeaveList extends Array<unknown> {}`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@shifts = PropertySet.new(self, true)`.

#### Critério de aceite

Análogo. 7 atributos além dos base.

#### Testes

- `shift-attributes_test.ts`:
  - `it("registra 7 atributos")`.
  - `it("leaves é list attribute")`.
  - `it("timezone default é TjTime.getTimeZone()")`.

---

### 9.9 — `AttributeDefinitions`: Accounts

#### Objetivo

Implementar `registerAccountAttributes(ps: PropertySet<Account>)`.

#### Arquivos

- `packages/core/src/model/attributes/account-attributes.ts`
- `packages/core/tests/model/attributes/account-attributes_test.ts`

#### Requisitos

Adicionar (ordem do `Project.rb`):
```
aggregate  SymbolAttribute             true, false,false, "tasks"
bsi        StringAttribute             false,false,false, ""
credits    AccountCreditListAttribute  false,false,true,  []
index      IntegerAttribute            false,false,false, -1
flags      FlagListAttribute           true, false,true,  []
tree       StringAttribute             false,false,false, ""
```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@accounts`.

#### Critério de aceite

Análogo. 6 atributos.

#### Testes

- `account-attributes_test.ts`:
  - `it("registra 6 atributos")`.
  - `it("aggregate default é 'tasks'")`.
  - `it("credits é scenario-specific")`.

---

### 9.10 — `AttributeDefinitions`: Resources

#### Objetivo

Implementar `registerResourceAttributes(ps: PropertySet<Resource>)`.

#### Arquivos

- `packages/core/src/model/attributes/resource-attributes.ts`
- `packages/core/tests/model/attributes/resource-attributes_test.ts`

#### Requisitos

Adicionar **20 atributos** (ordem do `Project.rb`):
```
alloctdeffort    FloatAttribute                false,false,true, 0.0
bsi              StringAttribute               false,false,false, ""
chargeset        ChargeSetListAttribute        true, false,true,  []
criticalness     FloatAttribute                false,false,true, 0.0
duties           TaskListAttribute             false,false,true, []
directreports    ResourceListAttribute         false,false,true, []
efficiency       FloatAttribute                true, false,true, 1.0
effort           IntegerAttribute              false,false,true, 0
email            StringAttribute               false,false,false, null
fail             LogicalExpressionListAttribute false,false,false, []
flags            FlagListAttribute             true, false,true, []
index            IntegerAttribute              false,false,false, -1
leaveallowances  LeaveAllowanceListAttribute   true, false,true, new LeaveAllowanceList()
leaves           LeaveListAttribute            true, true, true,  new LeaveList()
limits           LimitsAttribute               true, true, true,  null
managers         ResourceListAttribute         true, false,true, []
rate             FloatAttribute                true, true, true, 0.0
reports          ResourceListAttribute         false,false,true, []
shifts           ShiftAssignmentsAttribute     true, false,true, null
tree             StringAttribute               false,false,false, ""
warn             LogicalExpressionListAttribute false,false,false, []
workinghours     WorkingHoursAttribute         true, true, true,  null
```

**Nota:** `LeaveAllowanceList` é stub nesta fase.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@resources`.

#### Critério de aceite

Análogo. 20 atributos.

#### Testes

- `resource-attributes_test.ts`:
  - `it("registra 20 atributos")`.
  - `it("inheritedFromProject correto para rate, leaves, workinghours, limits")`.
  - `it("defaults corretos")`.

---

### 9.11 — `AttributeDefinitions`: Tasks

#### Objetivo

Implementar `registerTaskAttributes(ps: PropertySet<Task>)`.

#### Arquivos

- `packages/core/src/model/attributes/task-attributes.ts`
- `packages/core/tests/model/attributes/task-attributes_test.ts`

#### Requisitos

Adicionar **44 atributos** (ordem do `Project.rb`). Este é o maior bloco.

```
allocate          AllocationAttribute           true, false,true, []
assignedresources ResourceListAttribute         false,false,true, []
booking           BookingListAttribute          false,false,true, []
bsi               StringAttribute               false,false,false, ""
charge            ChargeListAttribute           false,false,true, []
chargeset         ChargeSetListAttribute        true, false,true, []
complete          FloatAttribute                false,false,true, null
competitors       TaskListAttribute             false,false,true, []
criticalness      FloatAttribute                false,false,true, 0.0
depends           DependencyListAttribute       true, false,true, []
duration          DurationAttribute             false,false,true, 0
effort            DurationAttribute             false,false,true, 0
effortdone        IntegerAttribute              false,false,true, null
effortleft        IntegerAttribute              false,false,true, null
end               DateAttribute                 false,false,true, null
endpreds          TaskDepListAttribute          false,false,true, []
endsuccs          TaskDepListAttribute          false,false,true, []
fail              LogicalExpressionListAttribute false,false,false, []
flags             FlagListAttribute             true, false,true, []
forward           BooleanAttribute              true, false,true, true
gauge             StringAttribute               false,false,true, null
index             IntegerAttribute              false,false,false, -1
length            DurationAttribute             false,false,true, 0
limits            LimitsAttribute               false,false,true, null
maxend            DateAttribute                 true, false,true, null
maxstart          DateAttribute                 false,false,true, null
milestone         BooleanAttribute              false,false,true, false
minend            DateAttribute                 false,false,true, null
minstart          DateAttribute                 true, false,true, null
note              RichTextAttribute             false,false,false, null
pathcriticalness  FloatAttribute                false,false,true, 0.0
precedes          DependencyListAttribute       true, false,true, []
priority          IntegerAttribute              true, true, true, 500
projectid         SymbolAttribute               true, true, true, null
responsible       ResourceListAttribute         true, false,true, []
scheduled         BooleanAttribute              true, false,true, false
projectionmode    BooleanAttribute              true, false,true, false
shifts            ShiftAssignmentsAttribute     true, false,true, null
start             DateAttribute                 false,false,true, null
startpreds        TaskDepListAttribute          false,false,true, []
startsuccs        TaskDepListAttribute          false,false,true, []
status            StringAttribute               false,false,true, ""
tree              StringAttribute               false,false,false, ""
warn              LogicalExpressionListAttribute false,false,false, []
```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@tasks`.

#### Critério de aceite

Análogo. 44 atributos.

#### Testes

- `task-attributes_test.ts`:
  - `it("registra 44 atributos")`.
  - `it("priority default 500")`.
  - `it("priority é inheritFromParent e inheritFromProject")`.
  - `it("milestone é scenario-specific")`.
  - `it("depends, precedes são list attributes")`.

---

### 9.12 — `AttributeDefinitions`: Reports

#### Objetivo

Implementar `registerReportAttributes(ps: PropertySet<Report>)`.

#### Arquivos

- `packages/core/src/model/attributes/report-attributes.ts`
- `packages/core/tests/model/attributes/report-attributes_test.ts`

#### Requisitos

Adicionar **61 atributos** (ordem do `Project.rb`). Maior bloco do projeto.

Lista completa (ordem do `Project.rb`):
```
accountroot          PropertyAttribute               true, false,false, null
auxdir               StringAttribute                 true, true, false, ""
bsi                  StringAttribute                 false,false,false, ""
caption              RichTextAttribute               true, false,false, null
center               RichTextAttribute               true, false,false, null
columns              ColumnListAttribute             true, false,false, []
costaccount          AccountAttribute                true, true, false, null
currencyFormat       RealFormatAttribute             true, true, false, null
definitions          DefinitionListAttribute         true, false,false, ['*']
end                  DateAttribute                   true, true, false, null
markdate             DateAttribute                   true, true, false, null
epilog               RichTextAttribute               true, false,false, null
flags                FlagListAttribute               true, false,true,  []
footer               RichTextAttribute               true, false,false, null
formats              FormatListAttribute             true, false,false, []
ganttBars            BooleanAttribute                true, false,false, true
header               RichTextAttribute               true, false,false, null
headline             RichTextAttribute               true, false,false, null
hideAccount          LogicalExpressionAttribute      true, false,false, null
hideJournalEntry     LogicalExpressionAttribute      true, false,false, null
hideResource         LogicalExpressionAttribute      true, false,false, null
hideTask             LogicalExpressionAttribute      true, false,false, null
height               IntegerAttribute                false,false,false, 480
index                IntegerAttribute                false,false,false, -1
interactive          BooleanAttribute                false,false,false, false
journalAttributes    SymbolListAttribute             true, false,false, ['*']
journalMode          SymbolAttribute                 true, false,false, "journal"
left                 RichTextAttribute               true, false,false, null
loadUnit             StringAttribute                 true, true, false, null
now                  DateAttribute                   true, true, false, null
numberFormat         RealFormatAttribute             true, true, false, null
openNodes            NodeListAttribute               false,false,false, null
prolog               RichTextAttribute               true, false,false, null
rawHtmlHead          StringAttribute                 true, false,false, null
resourceAttributes   FormatListAttribute             true, false,false, ['*']
resourceroot         PropertyAttribute               true, false,false, null
revenueaccount       AccountAttribute                true, true, false, null
right                RichTextAttribute               true, false,false, null
rollupAccount        LogicalExpressionAttribute      true, false,false, null
rollupResource       LogicalExpressionAttribute      true, false,false, null
rollupTask           LogicalExpressionAttribute      true, false,false, null
scenarios            ScenarioListAttribute           true, false,false, [0]
selfcontained        BooleanAttribute                true, false,false, false
shortTimeFormat      StringAttribute                 true, true, false, null
sortAccounts         SortListAttribute               true, false,false, [["seqno", true, -1]]
sortJournalEntries   JournalSortListAttribute        true, false,false, [["alert", 1], ["date", 1], ["seqno", 1]]
sortResources        SortListAttribute               true, false,false, [["seqno", true, -1]]
sortTasks            SortListAttribute               true, false,false, [["seqno", true, -1]]
start                DateAttribute                   true, true, false, null
taskAttributes       FormatListAttribute             true, false,false, ['*']
taskroot             PropertyAttribute               true, false,false, null
timeFormat           StringAttribute                 true, true, false, null
timeOffId            StringAttribute                 false,false,false, null
timeOffName          StringAttribute                 false,false,false, null
timezone             StringAttribute                 true, true, false, TjTime.getTimeZone()
title                StringAttribute                 true, false,false, null
tree                 StringAttribute                 false,false,false, ""
weekStartsMonday     BooleanAttribute                true, true, false, false
width                IntegerAttribute                true, false,false, 640
novevents            BooleanAttribute                true, false,false, false
```

**Nota:** `scenarios` default no Ruby é `[ 0 ]` (índice de cenário). Em TS, `[0]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb` — bloco `@reports`.

#### Critério de aceite

Análogo. 61 atributos.

#### Testes

- `report-attributes_test.ts`:
  - `it("registra 61 atributos")`.
  - `it("height default 480")`, `it("width default 640")`.
  - `it("definitions default ['*']")`.
  - `it("scenarios default [0]")`.
  - `it("flags é scenario-specific")`.

---

### 9.13 — `MockProject` estendido + fixtures

#### Contexto

`MockProject` precisa implementar toda a `ProjectLike` e criar os 6 `PropertySet`s com suas `AttributeDefinition`s.

#### Objetivo

`MockProject` completo + helpers para testes.

#### Arquivos

- `packages/core/tests/model/mock-project.ts` (reescrito)
- `packages/core/tests/fixtures/mock-project.ts` (helper `createMockProject(scenarioCount = 1)`)

#### Requisitos

**`MockProject`:**

- [ ] Constructor `(scenarioCount: number = 1)`:
  - Cria `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`.
  - Registra os atributos base em cada `PropertySet`.
  - Cria cenários conforme `scenarioCount` (`plan`, `scenario1`, ...).
- [ ] Implementa todos os métodos de `ProjectLike`.
- [ ] Armazena atributos de projeto em `Map<string, unknown>` (`currency`, `timezone`, `start`, `end`, `now`, etc.).
- [ ] `get('now')`, `get('start')`, `get('end')` têm defaults sensatos (`TjTime.fromString("2026-01-01")`).

**Helper `createMockProject`:**

- [ ] Registra todas as `AttributeDefinition`s (chama as 6 funções `registerXAttributes`).
- [ ] Uso típico nos testes:
  ```ts
  const mp = createMockProject(2);
  ```

#### Referências

- Fase 4, subfase 7.1 (`MockProject` original).

#### Fora de escopo

- `Project` real — Fase 9.

#### Critério de aceite

```ts
const mp = createMockProject(2);
assertEquals(mp.scenarioCount, 2);
assertEquals(mp.tasks.knownAttribute("effort"), true);
assertEquals(mp.reports.knownAttribute("formats"), true);
assertEquals(mp.reports.knownAttribute("novevents"), true);
```

#### Testes

- `mock-project_test.ts` (estender):
  - `it("createMockProject registra todos os atributos")`.
  - `it("MockProject tem 2 cenários")`.
  - `it("get('now') tem default")`.

---

### 9.14 — Golden tests (definições de atributos)

#### Contexto

Comparar as ~141 definições com o que o `Project.rb` real registra.

#### Objetivo

Script Ruby que serializa todas as `AttributeDefinition`s de um `Project` vazio.

#### Arquivos

- `scripts/golden/attribute-definitions.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/attribute-definitions.golden.json` (gerado)
- `packages/core/tests/golden/attribute-definitions_golden_test.ts`
- `deno.jsonc` — atualizar task `golden:generate`

#### Requisitos

**Script Ruby:**

- [ ] `require 'taskjuggler/Project'`.
- [ ] Instancia `Project.new("prj", "Test", "1.0")`.
- [ ] Para cada `PropertySet` (`scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`):
  - Itera `eachAttributeDefinition`.
  - Serializa: `id`, `name`, `objClass.tjpId`, `inheritedFromParent`, `inheritedFromProject`, `scenarioSpecific`, `default` (formatado).
- [ ] Ordem preservada (não sortear).
- [ ] Formato:
  ```json
  {
    "scenarios": [
      { "id": "active", "name": "Enabled", "tjpId": "boolean",
        "inheritParent": true, "inheritProject": false,
        "scenarioSpecific": false, "default": true },
      ...
    ],
    "tasks": [ ... ],
    "reports": [ ... ],
    ...
  }
  ```

**Teste TS:**

- [ ] Lê o JSON.
- [ ] Instancia `MockProject` e registra as `AttributeDefinition`s.
- [ ] Para cada atributo: compara `id`, `name`, `tjpId`, 3 flags, `default`.
- [ ] Cobertura: **todas as ~141 definições**.

**Task `golden:generate`:**

- [ ] `ruby scripts/golden/attribute-definitions.rb > packages/core/tests/golden/attribute-definitions.golden.json`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Project.rb`.
- Fase 2, subfase 5.14 — infraestrutura.

#### Fora de escopo

- Golden tests de task/resource comportamento — Fase 7.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- JSON com **todos** os atributos (≥ 140).
- Zero divergências.

#### Testes

- `attribute-definitions_golden_test.ts`:
  - `describe("Golden attribute definitions")`
    - itera `scenarios`, `shifts`, `accounts`, `resources`, `tasks`, `reports`.

---

## 6. Ordem de execução sugerida

```text
9.0  ADR 015
      ↓
9.1  ProjectLike + ScenarioData.preloadAttributes
      ↓
9.7  AttributeDefinitions: Scenarios     ← pode ir em paralelo com 9.2
9.8  AttributeDefinitions: Shifts
9.9  AttributeDefinitions: Accounts
9.10 AttributeDefinitions: Resources
9.11 AttributeDefinitions: Tasks
9.12 AttributeDefinitions: Reports
      ↓
9.2  Task + TaskScenario                 ← precisa de 9.11
9.3  Resource + ResourceScenario         ← precisa de 9.10
9.4  Account + AccountScenario           ← precisa de 9.9
9.5  Shift + ShiftScenario               ← precisa de 9.8
9.6  Report + ReportScenario             ← precisa de 9.12
      ↓
9.13 MockProject estendido
      ↓
9.14 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 5 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `Task`, `Resource`, `Account`, `Shift`, `Report` implementadas.
- [ ] `TaskScenario`, `ResourceScenario`, `AccountScenario`, `ShiftScenario`, `ReportScenario` (esqueletos) implementados.
- [ ] `ProjectLike` estendida.
- [ ] `ScenarioData.preloadAttributes` implementado.
- [ ] `getScenarioAttributes(scIdx)` em `PropertyTreeNode` (protected).
- [ ] ~141 `AttributeDefinition`s registradas.
- [ ] `MockProject` completo com todos os `PropertySet`s.
- [ ] **≥ 100 testes unitários**.
- [ ] **≥ 20 golden tests** (todos os atributos).
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 015 criado.
- [ ] `scripts/golden/attribute-definitions.rb` funcional.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Lista de atributos divergir do Ruby | Alto | Golden tests comparam **todos** os atributos |
| `preloadAttributes` esquecer de algum atributo | Médio | Lista do Ruby é copiada literalmente |
| Ordem dos atributos alterar `eachAttributeDefinition` | Baixo | Ordenado por id; ordem de inserção não importa |
| `KeywordArray` `['*']` tratado como string normal | Médio | Documentar; helper `keywordListIncludes` |
| `MockProject` diverge do `Project` real | Médio | `ProjectLike` é contrato; Fase 9 valida |
| Criação de ~50 atributos por cenário degrada performance | Médio | Aceitável; otimizar em Fase 9 se necessário |
| Entidades circulam referência a `project` | Baixo | `ProjectLike` é interface; sem dependência circular |
| `Task`/`Resource` herdam de `PropertyTreeNode` mas precisam de override de `scenarioData` | Baixo | Usar generics: `PropertyTreeNode<TScenario>` (opcional) |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Task.rb`
- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` (construtor)
- `docs/taskjuggler/lib/taskjuggler/Resource.rb`
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` (construtor)
- `docs/taskjuggler/lib/taskjuggler/Account.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb` (construtor)
- `docs/taskjuggler/lib/taskjuggler/Shift.rb`
- `docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/Report.rb` (construtor)
- `docs/taskjuggler/lib/taskjuggler/Project.rb` (linhas ~200–420)

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.3, §2.4, §4.1
- `docs/tj3-engine/06-blueprint-engine5.md` — §4.3

### Documentos do projeto

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/015-pre-carregamento-atributos-scenario.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 6 — Scoreboard e Estruturas Base** (Limits, ShiftAssignments referenciam `Task`, `Resource`).
- **Fase 7 — Scheduler** (implementa os `*Scenario` completos).
- **Fase 8 — Financeiro** (implementa `turnover` de `AccountScenario`).
- **Fase 9 — Orquestrador** (`Project` real com todos os `PropertySet`s).
- **Fase 10 — Parser** (cria `Task`, `Resource` a partir do `.tjp`).

---

## 10. Notas para a IA

1. **Não inventar atributos.** A lista do `Project.rb` é a verdade. Se um atributo parecer faltar, verificar o código Ruby primeiro.
2. **Preservar a ordem do `Project.rb`.** Ajuda em golden tests.
3. **`registerXAttributes` é idempotente.** Rodar duas vezes não quebra.
4. **`*Scenario` desta fase são esqueletos.** Não implementar `schedule()`, `book()`, etc. — Fase 7.
5. **`preloadAttributes` é sobre os atributos que o **Ruby pré-carrega**.** Não adicionar outros "por precaução".
6. **Golden tests exigem `tj3` funcional.** Se falhar, verificar `gem list taskjuggler`.
7. **`LeaveList`, `LeaveAllowanceList` são stubs nesta fase** (`class LeaveList extends Array<unknown> {}`). Fase 16 implementa de verdade.
8. **Sem `any`.** Use `unknown` + narrowing.
9. **Commit por subfase.** `feat(core): task-entity`, `feat(core): task-attributes`, etc.
10. **`Report.absoluteFileName`** usa `project.outputDir`. `MockProject` deve ter esse campo.
11. **Não tocar em Fase 7.** Se algum atributo parecer precisar de lógica (ex: `criticalness`), **não implementar** — é Fase 7.
12. **`scenarioData(scIdx)` é override tipado.** Cada subclasse declara seu próprio retorno (`TaskScenario`, etc.).

---

## 11. ADR 015 (referência rápida)

Criado como subfase 9.0. Conteúdo esperado:

- **Título:** Pré-carregamento de atributos em `*Scenario`
- **Contexto:** Ruby faz `%w(...).each { |attr| @property[attr, @scenarioIdx] }` para forçar criação.
- **Decisão:** Replicar via `preloadAttributes(ids)` em `ScenarioData`.
- **Alternativas:** Lazy puro, pré-carregar tudo.
- **Consequências:** fidelidade + testes verificáveis; custo de memória aceitável.

---

**Fim da Fase 5.**