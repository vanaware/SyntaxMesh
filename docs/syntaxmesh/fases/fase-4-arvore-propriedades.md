# Fase 4 — Árvore de Propriedades

> **Arquivo:** `docs/syntaxmesh/fases/fase-4-arvore-propriedades.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 6–8 dias
> **Depende de:** Fase 2 — Tempo e Geometria; Fase 3 — Modelo de Atributos
> **Bloqueia:** Fases 5, 6, 7, 8, 9, 10, 11, 12, 14, 16

---

## 1. Contexto

`PropertyTreeNode` é a **base de TODAS as entidades** do TaskJuggler. `Task`, `Resource`, `Account`, `Shift`, `Scenario` e `Report` herdam dela. Entender esta classe é entender 80% do modelo de domínio.

Ela fornece:

1. **Estrutura de árvore** — `parent`, `children`, `adoptees`, `stepParents`.
2. **Sistema de IDs** — `id`, `subId`, `fullId`, `logicalId`, `getBSIndicies`, `getIndicies`.
3. **Sistema de atributos lazy** — cria `AttributeBase` sob demanda via `attributeDefinition(id)`.
4. **Herança dupla** — do pai (`inheritAttributes`) e do projeto.
5. **Scenario-specific attributes** — array de Maps, um por cenário.
6. **Adoção** — `adopt(property)` permite uma task aparecer em múltiplos contextos.
7. **Backup/restore** — para reports dinâmicos (`generateReport`).

Ao redor dela, o `PropertySet` gerencia:
- Namespace (flat vs hierárquico).
- Blueprint de `AttributeDefinition`s.
- Índices (`index()`, `levelSeqNo()`, `maxDepth()`).

E o `ScenarioData` é a base de todos os `*Scenario` (`TaskScenario`, `ResourceScenario`, etc.) — a parte scenario-specific de cada propriedade.

O `Scenario` é uma entidade especial: herda de `PropertyTreeNode` mas representa o **cenário** em si (plan, delayed, etc.).

O `PTNProxy` é um wrapper para tasks adotadas, permitindo que a mesma `Task` apareça em múltiplos contextos sem duplicar dados.

Portar isso corretamente é **crítico**. Erros aqui quebram herança, cenários, relatórios, e o scheduler.

---

## 2. Objetivo

Ao final desta fase:

- `AttributeContainer` interface + `MockContainer` (para testes).
- `PropertyTreeNode` com estrutura de árvore, IDs, atributos lazy, herança, adoção, backup/restore.
- `PropertySet` com blueprint de atributos, namespace, índices.
- `ScenarioData` (base para `*Scenario`).
- `Scenario` (entidade concreta).
- `PTNProxy` (wrapper para adopted tasks).
- **≥ 130 testes unitários** + **≥ 30 golden tests** (estrutura de árvore, herança, adoção).
- ADR 014 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `PropertyTreeNode.rb` | ~600 | **Alta** | **Crítica** |
| `PropertySet.rb` | ~250 | Média | **Crítica** |
| `ScenarioData.rb` | ~70 | Baixa | **Crítica** |
| `Scenario.rb` | ~25 | Baixa | **Crítica** |
| `PTNProxy.rb` | ~120 | Média | Alta |

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §3 PropertyTreeNode | Estrutura interna |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.3 Sistema de Atributos (Lazy) | Lazy creation |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.5 Herança de Atributos | inheritAttributes |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.6 IDs e Hierarquia | fullId, getBSIndicies |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.7 Adopt | adopt |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.8 method_missing | Delegação |
| `docs/tj3-engine/06-blueprint-engine5.md` | §5.3 PropertySet | Container |
| `docs/tj3-engine/06-blueprint-engine5.md` | §4.2 ScenarioData | Base dos *Scenario |

### 3.3 Golden tests

Usamos `tj3` para validar:
- Estrutura de árvore (fullId, level, getBSIndicies).
- Herança em 3 níveis.
- Propagação de cenários.
- Adoção (adopt, adoptees, stepParents).

Como `Task`/`Resource` ainda não existem (Fase 5), usamos uma subclasse `TestProperty` no script Ruby.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 Lazy attribute creation

Ruby usa `Hash.new { |hash, key| ... }` — a criação é transparente ao acessar `@attributes[id]`. Em TS, temos 3 opções:

- **Proxy** — mais fiel, mas complexo e difícil de debugar.
- **Método helper** — `attribute(id)` cria sob demanda. Explícito, testável.
- **Inicializar tudo** — cria todos os atributos no construtor. Simples mas desperdiça memória (~40 atributos × milhares de propriedades).

**Decisão:** **método helper `attribute(id)`**. Preserva a semântica (lazy) mas troca a transparência por explicitude.

Ver ADR 014.

### 4.2 `method_missing` → `scenarioData(scIdx)`

Ruby delega métodos não encontrados para `@data[scenarioIdx]`. TS não tem `method_missing`.

Opções:

- **`Proxy` no PropertyTreeNode** — intercepta acessos a métodos.
- **Métodos explícitos nas subclasses** — cada método delegado é definido manualmente.
- **Helper `scenarioData(scIdx)`** — expõe `data[scIdx]` publicamente.

**Decisão:** **helper `scenarioData(scIdx)`**. Subclasses que precisam delegar definem métodos explícitos (ex: `Task.readyForScheduling?(scIdx)` chama `this.scenarioData(scIdx).readyForScheduling?()`). Mais código, mas mais claro e testável.

Ver ADR 014.

### 4.3 `@@scenarioAttributes` → array de Maps

Ruby: `@scenarioAttributes[scenarioIdx]` é um Hash com default block. TS: `Map<string, AttributeBase>` por cenário, com método helper `scenarioAttribute(scIdx, id)`.

Inicializado no construtor como `Array.from({ length: project.scenarioCount }, () => new Map())`.

### 4.4 Backup/restore

Ruby: `@attributes.clone` e `@scenarioAttributes.clone`. TS: `new Map(this.attributes)` (cópia rasa do Map). Os valores (atributos) são compartilhados — igual ao Ruby.

### 4.5 `PTNProxy` — wrapper explícito

Ruby usa `method_missing`. TS: classe explícita com métodos que replicam a interface pública do `PropertyTreeNode` (`get`, `set`, `[]`, `[]=`, `level`, `isChildOf?`, `getIndicies`, `logicalId`).

### 4.6 `PropertyTreeNode` é concreta ou abstrata?

Ruby é concreta (não tem `abstract`). TS: **concreta**, com um construtor que aceita `propertySet`, `id`, `name`, `parent`. Subclasses (Task, Resource) chamam `super(...)`.

### 4.7 MockProject

Testes de Phase 4 precisam de um `Project` mínimo (para `scenarioCount` e `scenario(idx)`). Definimos `MockProject` em testes.

Em produção, `Project` é da Fase 9. A interface `ProjectLike` é definida agora e `Project` a implementará.

### 4.8 Erros

Reutilizamos `TjError`, `TjArgumentError` (Fase 3). Adicionamos `TjInternalError` para situações impossíveis (`$DEBUG` do Ruby).

---

## 5. Subfases detalhadas

---

### 7.0 — ADR 014 (metaprogramação em TS)

#### Contexto

O `PropertyTreeNode.rb` usa duas formas de metaprogramação que não têm equivalente direto em TS:

1. **`Hash.new { |h, k| ... }`** — lazy creation de atributos ao acessar `@attributes[id]`.
2. **`method_missing`** — delegação automática para `@data[scenarioIdx]`.

Precisamos registrar formalmente como adaptamos cada uma.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/014-metaprogramacao-propertytreenode.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/014-metaprogramacao-propertytreenode.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** explicar as duas metaprogramações do Ruby.
- [ ] **Decisão:**
  - Lazy creation → método `attribute(id)` (explícito).
  - `method_missing` → helper `scenarioData(scIdx)` + métodos explícitos nas subclasses.
- [ ] **Alternativas:** `Proxy` (ambos os casos), inicialização antecipada, métodos mágicos.
- [ ] **Consequências:**
  - **Positivas:** explícito, debugável, sem custo de `Proxy`.
  - **Negativas:** mais código nas subclasses; menos transparente.
  - **Mitigação:** helpers/documentação.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb`.
- `docs/taskjuggler/lib/taskjuggler/PTNProxy.rb`.
- Seções 4.1, 4.2, 4.5.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADR 014 criado.
- Tabela atualizada.

---

### 7.1 — `AttributeContainer`, `ProjectLike`, erros internos

#### Contexto

Antes de `PropertyTreeNode` e `ScenarioData`, precisamos das interfaces que eles implementam/consomem.

#### Objetivo

Definir:
- `AttributeContainer` (já esboçada na Fase 3, formalizar).
- `MockContainer` para testes.
- `ProjectLike` (interface mínima do `Project` para esta fase).
- `TjInternalError`.

#### Arquivos

- `packages/core/src/attributes/attribute-container.ts` (já existe, revisar)
- `packages/core/src/model/project-like.ts`
- `packages/core/src/errors.ts` (atualizar)
- `packages/core/tests/model/mock-container.ts`
- `packages/core/tests/model/mock-project.ts`

#### Requisitos

**`AttributeContainer`:**

- [ ] `getStoredValue(attributeId: string): unknown`.
- [ ] `setStoredValue(attributeId: string, value: unknown): void`.

**`ProjectLike`:**

- [ ] `get scenarioCount(): number`.
- [ ] `scenario(idx: number): { id: string; fullId: string } | null`.
- [ ] (Opcional) `objectId(): number` — usado para `ShiftAssignments.hashKey` (Fase 6).

**`TjInternalError`:**

- [ ] `class TjInternalError extends TjError`.

**`MockContainer`:**

- [ ] Implementa `AttributeContainer`.
- [ ] Armazena em `Map<string, unknown>`.
- [ ] `getStoredValue` retorna `undefined` se ausente.

**`MockProject`:**

- [ ] Implementa `ProjectLike`.
- [ ] `scenarioCount` configurável (default 1).
- [ ] `scenario(idx)` retorna `{ id: 'plan', fullId: 'plan' }` para `idx === 0`, senão `null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb` — uso de `@container`.
- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — `@project.scenarioCount`.

#### Fora de escopo

- `Project` real — Fase 9.

#### Critério de aceite

```ts
const c = new MockContainer();
c.setStoredValue("foo", "bar");
assertEquals(c.getStoredValue("foo"), "bar");

const p = new MockProject(2);
assertEquals(p.scenarioCount, 2);
assertEquals(p.scenario(0)?.id, "plan");
assert(p.scenario(5) === null);
```

#### Testes

- `attribute-container_test.ts`:
  - `describe("MockContainer")`
    - `it("armazena e recupera")`.
    - `it("retorna undefined para chave ausente")`.
- `mock-project_test.ts`:
  - `describe("MockProject")`
    - `it("scenarioCount")`.
    - `it("scenario por índice")`.
    - `it("retorna null para índice fora do range")`.

---

### 7.2 — `PropertyTreeNode` — estrutura de árvore e IDs

#### Contexto

Antes de atributos, precisamos da estrutura básica: parent/children, IDs, level, BSI.

#### Objetivo

Implementar:
- Construtor com `propertySet`, `id`, `name`, `parent`.
- Estrutura de árvore: `children`, `adoptees`, `stepParents`.
- IDs: `id`, `subId`, `fullId`, `logicalId`.
- Navegação: `level`, `root`, `ancestors`, `isChildOf?`, `leaf?`, `container?`, `all`, `allLeaves`, `kids`, `parents`.
- Índices: `getBSIndicies`, `getIndicies`, `levelSeqNo`.
- `removeReferences`.

#### Arquivos

- `packages/core/src/model/property-tree-node.ts`
- `packages/core/tests/model/property-tree-node-structure_test.ts`

#### Requisitos

- [ ] Classe `PropertyTreeNode` (concreta).
- [ ] Constructor `(propertySet, id, name, parent)`.
- [ ] Campos:
  - `propertySet: PropertySet`
  - `project: ProjectLike` (via `propertySet.project`)
  - `parent: PropertyTreeNode | null`
  - `subId: string`
  - `id: string` (igual a `fullId` em Ruby)
  - `name: string`
  - `sequenceNo: number` (incrementado pelo `PropertySet`)
  - `children: PropertyTreeNode[]`
  - `adoptees: PropertyTreeNode[]`
  - `stepParents: PropertyTreeNode[]`
  - `sourceFileInfo: SourceFileInfo | null`
- [ ] Inicialização:
  - Se `id` é null, gera ID único (`_<Tipo>_<N>`).
  - Em namespace hierárquico, se `id` contém `.`, extrai `parent` de `id`.
  - Chama `set('id', fullId)`, `set('name', name)`, `set('seqno', sequenceNo)`.
- [ ] `get level(): number` — cacheado.
- [ ] `get fullId(): string` — em flat, retorna `subId`; em hierárquico, `parent.fullId + '.' + subId`.
- [ ] `logicalId(): string` — para `PropertyTreeNode` é igual a `fullId` (PTNProxy sobrescreve).
- [ ] `root(): PropertyTreeNode` — topo da árvore.
- [ ] `ancestors(includeStepParents = false): PropertyTreeNode[]`.
- [ ] `isChildOf?(ancestor): boolean`.
- [ ] `leaf(): boolean` — sem children e sem adoptees.
- [ ] `container(): boolean` — com children ou adoptees.
- [ ] `kids(): PropertyTreeNode[]` — `children + adoptees`.
- [ ] `parents(): PropertyTreeNode[]` — `[parent] + stepParents` (filtra null).
- [ ] `all(): PropertyTreeNode[]` — self + descendentes.
- [ ] `allLeaves(withoutSelf = false): PropertyTreeNode[]`.
- [ ] `getBSIndicies(): number[]`.
- [ ] `getIndicies(): number[]` — usa `get('index')`.
- [ ] `levelSeqNo(node): number`.
- [ ] `addChild(child): void`.
- [ ] `removeReferences(property): void` — remove de `children`, `adoptees`, `stepParents`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — métodos de estrutura.

#### Fora de escopo

- Atributos (7.3).
- Herança (7.4).
- Adoção (7.5).

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
const root = new PropertyTreeNode(ps, "root", "Root", null);
const child = new PropertyTreeNode(ps, "child", "Child", root);
const gc = new PropertyTreeNode(ps, "gc", "Grandchild", child);

assertEquals(root.fullId, "root");
assertEquals(child.fullId, "root.child");
assertEquals(gc.fullId, "root.child.gc");
assertEquals(gc.level, 2);
assertEquals(root.kids().length, 1);
assert(gc.isChildOf(root));
assert(!root.isChildOf(gc));
```

#### Testes

- `property-tree-node-structure_test.ts`:
  - `describe("PropertyTreeNode estrutura")`
    - `it("constrói árvore de 3 níveis")`.
    - `it("fullId hierárquico")`.
    - `it("fullId flat")`.
    - `it("level cacheado")`.
    - `it("root")`.
    - `it("ancestors")`.
    - `it("ancestors inclui step parents")`.
    - `it("isChildOf direto")`.
    - `it("isChildOf indireto")`.
    - `it("isChildOf falso")`.
    - `it("leaf em folha")`.
    - `it("container em pai")`.
    - `it("kids inclui adoptees")`.
    - `it("parents inclui step parents")`.
    - `it("all")`.
    - `it("allLeaves")`.
    - `it("getBSIndicies")`.
    - `it("getIndicies")`.
    - `it("levelSeqNo")`.
    - `it("removeReferences")`.

---

### 7.3 — `PropertyTreeNode` — atributos lazy

#### Contexto

O sistema de atributos lazy é o coração do `PropertyTreeNode`. Atributos são criados sob demanda; não-scenario vivem em `@attributes`, scenario-specific em `@scenarioAttributes[scIdx]`.

#### Objetivo

Implementar:
- Método `attribute(id)` — cria lazy.
- `scenarioAttribute(scIdx, id)` — cria lazy no cenário.
- `get`, `getAttribute`, `set`, `force`, `[]`, `[]=`, `provided`, `inherited`, `modified`, `attributeDefinition`.
- Validação de overwrite (`AttributeOverwrite`).
- Propagação de cenários em `[]=` (mode 0).

#### Arquivos

- `packages/core/src/model/property-tree-node.ts` (estender)
- `packages/core/tests/model/property-tree-node-attributes_test.ts`

#### Requisitos

- [ ] `private attributes: Map<string, AttributeBase>`.
- [ ] `private scenarioAttributes: Array<Map<string, AttributeBase>>` (uma por cenário).
- [ ] `private attribute(id: string): AttributeBase`:
  - Se existe, retorna.
  - Se não, busca `attributeDefinition(id)`.
  - Se é `scenarioSpecific`, lança `TjArgumentError`.
  - Cria `new aType.objClass(propertySet, aType, this)` e armazena.
- [ ] `private scenarioAttribute(scIdx: number, id: string): AttributeBase`:
  - Se existe, retorna.
  - Se `this.data[scIdx]` é null, lança `TjInternalError` ("ScenarioData must be initialized before scenario-specific attributes").
  - Se não é `scenarioSpecific`, lança `TjArgumentError`.
  - Cria `new aType.objClass(propertySet, aType, this.data[scIdx])` e armazena.
- [ ] `get(id): unknown` — `this.attribute(id).get()`.
- [ ] `getAttribute(id, scIdx?): AttributeBase`.
- [ ] `set(id, value): void` — verifica overwrite (exceto listas); chama `attr.set(value)`; se overwrite, lança `AttributeOverwrite`.
- [ ] `force(id, value): void` — chama `attr.set(value)` sem verificar overwrite.
- [ ] `getForScenario(id, scIdx): unknown`.
- [ ] `setForScenario(id, value, scIdx): void`:
  - Se `scIdx` é `undefined`, delega a `set`.
  - Se `AttributeBase.mode === 0`, propaga para todos os cenários derivados: o cenário alvo recebe `set`, os filhos recebem `inherit` (via `project.scenario(scIdx).all()`).
  - Senão, `set` no cenário alvo.
  - Verifica overwrite em todos os cenários.
- [ ] `provided(id, scIdx?): boolean`.
- [ ] `inherited(id, scIdx?): boolean`.
- [ ] `modified(id, scIdx?): boolean` — `provided || inherited`.
- [ ] `attributeDefinition(id): AttributeDefinition | undefined`.
- [ ] `data: ScenarioData[]` — array (inicialmente vazio; subclasses preenchem).
- [ ] `scenarioData(scIdx: number): ScenarioData`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — construtor (Hash default), `get`, `getAttribute`, `force`, `set`, `[]=`, `[]`, `provided`, `inherited`, `modified`.

#### Fora de escopo

- `checkFailsAndWarnings` — Fase 11 (depende de `Query`).

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
ps.addAttributeType(new AttributeDefinition(
  "effort", "Effort", AttributeType.DurationAttribute,
  false, false, true, 0,
));

const task = new PropertyTreeNode(ps, "t1", "Task 1", null);
task.set("effort", 100);
assertEquals(task.get("effort"), 100);
assert(task.provided("effort", 0));
```

#### Testes

- `property-tree-node-attributes_test.ts`:
  - `describe("PropertyTreeNode atributos")`
    - `it("cria lazy ao acessar get")`.
    - `it("armazena valor em set")`.
    - `it("set marca provided em mode 0")`.
    - `it("set marca inherited em mode 1")`.
    - `it("set não marca flag em mode 2")`.
    - `it("rejeita overwrite de atributo não-lista")`.
    - `it("aceita append em listas sem overwrite")`.
    - `it("force sobrescreve sem erro")`.
    - `it("rejeita atributo desconhecido")`.
    - `it("atributo scenario-specific requer scIdx")`.
    - `it("provided/inherited/modified")`.
    - `it("propagação de cenário em mode 0")` — projeto com 3 cenários hierárquicos.

---

### 7.4 — `PropertyTreeNode` — herança e backup/restore

#### Contexto

Atributos podem ser herdados do pai (não-scenario) ou do projeto (top-level). Cenários-specific herdam do pai por cenário.

Além disso, `backupAttributes`/`restoreAttributes` são usados para modificar atributos temporariamente durante `generateReport`.

#### Objetivo

Implementar:
- `inheritAttributes()` — preenche atributos marcados como `inheritedFromParent`/`inheritedFromProject`.
- `backupAttributes()` — snapshot.
- `restoreAttributes(backup)` — restauração.

#### Arquivos

- `packages/core/src/model/property-tree-node.ts` (estender)
- `packages/core/tests/model/property-tree-node-inherit_test.ts`

#### Requisitos

- [ ] `inheritAttributes(): void`:
  - Para cada `AttributeDefinition` não-scenario com `inheritedFromParent`:
    - Se tem parent e `parent.provided(id) || parent.inherited(id)`, chama `this.attribute(id).inherit(parent.get(id))`.
    - Senão, se é top-level e `inheritedFromProject` e `project[id]` existe, chama `.inherit(project[id])`.
  - Para cada `AttributeDefinition` scenario com `inheritedFromParent`:
    - Por cenário: igual, mas usando `provided(id, scIdx)` e `parent.getForScenario(id, scIdx)`.
    - Top-level herda de `project[id]`.
- [ ] `backupAttributes(): AttributeBackup`:
  - Retorna `{ attributes: new Map(this.attributes), scenarioAttributes: this.scenarioAttributes.map(m => new Map(m)) }`.
- [ ] `restoreAttributes(backup): void`:
  - Restaura os Maps.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — `inheritAttributes`, `backupAttributes`, `restoreAttributes`.

#### Fora de escopo

- Validação de cenários derivados — Fase 5.

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
ps.addAttributeType(new AttributeDefinition(
  "priority", "Priority", AttributeType.IntegerAttribute,
  true, true, false, 500,
));

const parent = new PropertyTreeNode(ps, "p", "Parent", null);
parent.set("priority", 100);

const child = new PropertyTreeNode(ps, "c", "Child", parent);
child.inheritAttributes();
assertEquals(child.get("priority"), 100);
assert(child.inherited("priority"));
```

#### Testes

- `property-tree-node-inherit_test.ts`:
  - `describe("PropertyTreeNode.inheritAttributes")`
    - `it("herda do parent não-scenario")`.
    - `it("herda do project (top-level)")`.
    - `it("não herda se parent não tem valor")`.
    - `it("não herda se flag inheritFromParent = false")`.
    - `it("herda scenario-specific do parent")`.
    - `it("herda scenario-specific do project")`.
    - `it("não herda sobre valor já provided")`.
    - `it("preserva inherited em cadeia")`.
  - `describe("PropertyTreeNode.backupAttributes/restoreAttributes")`
    - `it("backup faz cópia rasa")`.
    - `it("restore reverte modificações")`.
    - `it("backup/restore preserva valores")`.

---

### 7.5 — `PropertyTreeNode` — adoção

#### Contexto

`adopt(property)` permite uma task aparecer em múltiplos contextos sem duplicar dados. O adoptado ganha o adotante como `stepParent`; o adotante ganha o adotado como `adoptee`.

Validações:
- Um nó não pode adotar a si mesmo.
- Uma task não pode ser adotada duas vezes na mesma raiz (evita duplicação em reports).

#### Objetivo

Implementar `adopt` + `getAdopted` + validações.

#### Arquivos

- `packages/core/src/model/property-tree-node.ts` (estender)
- `packages/core/tests/model/property-tree-node-adopt_test.ts`

#### Requisitos

- [ ] `adopt(property: PropertyTreeNode): void`:
  - Se `property === this`, lança `TjArgumentError` ("A property cannot adopt itself").
  - Coleta `root.all()` (todas as propriedades da raiz do adotante).
  - Para cada leaf de `property.allLeaves()`:
    - Se está em `allOfRoot`, lança `TjArgumentError` ("already adopted").
  - `this.adoptees.push(property)`.
  - `property.getAdopted(this)`.
- [ ] `getAdopted(property): void`:
  - Se `property` já está em `stepParents`, retorna.
  - `this.stepParents.push(property)`.
- [ ] `kids()` — atualizado para incluir `adoptees`.
- [ ] `parents()` — atualizado para incluir `stepParents`.
- [ ] `leaf()` — retorna false se tem `adoptees`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` — `adopt`, `getAdopted`, `kids`, `parents`.

#### Fora de escopo

- `PTNProxy` (7.9).

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
const root1 = new PropertyTreeNode(ps, "r1", "Root 1", null);
const root2 = new PropertyTreeNode(ps, "r2", "Root 2", null);
const task = new PropertyTreeNode(ps, "t", "Task", root1);

root2.adopt(task);
assertEquals(task.stepParents.length, 1);
assertEquals(root2.adoptees.length, 1);
assertEquals(root2.kids().length, 1);
```

#### Testes

- `property-tree-node-adopt_test.ts`:
  - `describe("PropertyTreeNode.adopt")`
    - `it("adiciona adoptee e stepParent")`.
    - `it("rejeita auto-adoção")`.
    - `it("rejeita duplicação na mesma raiz")`.
    - `it("kids inclui adoptees")`.
    - `it("parents inclui stepParents")`.
    - `it("leaf falso quando tem adoptee")`.
    - `it("all inclui adoptees")`.
    - `it("allLeaves inclui leaves de adoptees")`.

---

### 7.6 — `PropertySet`

#### Contexto

`PropertySet` é o container das propriedades de mesmo tipo. Gerencia:
- Blueprint de `AttributeDefinition`s (registrados no início).
- Namespace flat vs hierárquico.
- Índices (BSI, tree).
- Lista de propriedades.

#### Objetivo

Implementar `PropertySet` completo.

#### Arquivos

- `packages/core/src/model/property-set.ts`
- `packages/core/tests/model/property-set_test.ts`

#### Requisitos

- [ ] Classe `PropertySet`:
  - `project: ProjectLike`
  - `flatNamespace: boolean`
  - `private properties: PropertyTreeNode[]`
  - `private propertyMap: Map<string, PropertyTreeNode>`
  - `private attributeDefinitions: Map<string, AttributeDefinition>`
- [ ] Constructor `(project, flatNamespace)`:
  - Adiciona atributos base: `id` (StringAttribute), `name` (StringAttribute), `seqno` (IntegerAttribute).
- [ ] `addAttributeType(attrDef: AttributeDefinition): void`:
  - Se `properties.length > 0`, lança `TjError` ("Attribute types must be defined before properties are added").
  - Registra em `attributeDefinitions`.
- [ ] `eachAttributeDefinition(): IterableIterator<AttributeDefinition>`.
- [ ] `knownAttribute(id): boolean`.
- [ ] `hasQuery?(id, scenarioIdx?): boolean` — verifica se existe `query_<id>` em alguma propriedade (Fase 11 completa).
- [ ] `scenarioSpecific?(id): boolean`.
- [ ] `inheritedFromProject?(id): boolean`.
- [ ] `inheritedFromParent?(id): boolean`.
- [ ] `userDefined?(id): boolean`.
- [ ] `listAttribute?(id): boolean`.
- [ ] `defaultValue(id): unknown`.
- [ ] `attributeName(id): string | undefined`.
- [ ] `attributeType(id): AttributeType | undefined`.
- [ ] `addProperty(prop): void`.
- [ ] `removeProperty(prop | id): PropertyTreeNode` — remove recursivamente.
- [ ] `clearProperties(): void`.
- [ ] `get(id): PropertyTreeNode | undefined` — também implementar `[Symbol.iterator]`.
- [ ] `index(): void` — recalcula BSI para todas as propriedades.
- [ ] `levelSeqNo(property): number`.
- [ ] `maxDepth(): number`.
- [ ] `items(): number`.
- [ ] `empty(): boolean`.
- [ ] `topLevelItems(): number`.
- [ ] `each(fn): void`.
- [ ] `toArray(): PropertyTreeNode[]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertySet.rb` — arquivo completo.

#### Fora de escopo

- `hasQuery?` completo — Fase 11.

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
ps.addAttributeType(new AttributeDefinition(
  "effort", "Effort", AttributeType.DurationAttribute,
  false, false, true, 0,
));

assertEquals(ps.knownAttribute("effort"), true);
assertEquals(ps.scenarioSpecific?("effort"), true);
assertEquals(ps.listAttribute?("effort"), false);

const root = new PropertyTreeNode(ps, "r", "R", null);
const child = new PropertyTreeNode(ps, "c", "C", root);
assertEquals(ps.items(), 2);
ps.index();
assertEquals(root.get("bsi"), "1");
assertEquals(child.get("bsi"), "1.1");
```

#### Testes

- `property-set_test.ts`:
  - `describe("PropertySet")`
    - `it("constrói com atributos base")`.
    - `it("addAttributeType registra")`.
    - `it("rejeita addAttributeType após adicionar propriedade")`.
    - `it("knownAttribute")`.
    - `it("scenarioSpecific?")`.
    - `it("inheritedFromProject?")`, `it("inheritedFromParent?")`.
    - `it("listAttribute?")`.
    - `it("defaultValue")`.
    - `it("attributeName")`.
    - `it("addProperty")`.
    - `it("removeProperty recursivo")`.
    - `it("index recalcula BSI")`.
    - `it("levelSeqNo")`.
    - `it("maxDepth")`.
    - `it("items/empty/topLevelItems")`.
    - `it("each")`.
    - `it("toArray")`.

---

### 7.7 — `ScenarioData`

#### Contexto

Base de todos os `*Scenario` (`TaskScenario`, `ResourceScenario`, `AccountScenario`, `ShiftScenario`). Fornece acesso a atributos scenario-specific e mensagens de erro com contexto.

#### Objetivo

Implementar `ScenarioData`.

#### Arquivos

- `packages/core/src/model/scenario-data.ts`
- `packages/core/tests/model/scenario-data_test.ts`

#### Requisitos

- [ ] Classe `ScenarioData`:
  - `property: PropertyTreeNode`
  - `project: ProjectLike`
  - `scenarioIdx: number`
  - `private attributes: Map<string, AttributeBase>`
  - `private messageHandler: MessageHandlerInstance`
- [ ] Constructor `(property, idx, attributes)`:
  - Set `property.data[idx] = this`.
- [ ] `deepClone(): this` — retorna `this`.
- [ ] `a(attributeName: string): unknown` — acesso rápido.
- [ ] `error(id, text, sourceFileInfo?, property?): void`.
- [ ] `warning(id, text, sourceFileInfo?, property?): void`.
- [ ] `info(id, text, sourceFileInfo?, property?): void`.

**Nota:** `MessageHandlerInstance` é da Fase 9. Nesta fase, definimos uma interface `MessageHandlerLike` com métodos `error`, `warning`, `info`. Implementação mock em testes; real na Fase 9.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ScenarioData.rb` — arquivo completo.
- `docs/tj3-engine/06-blueprint-engine5.md` — §4.2.

#### Fora de escopo

- `MessageHandler` real — Fase 9.

#### Critério de aceite

```ts
const mockHandler = new MockMessageHandler();
const prop = new PropertyTreeNode(ps, "t", "Task", null);
const sd = new ScenarioData(prop, 0, new Map());

assertEquals(prop.data[0], sd);
assertEquals(sd.property, prop);
assertEquals(sd.scenarioIdx, 0);
sd.warning("test_warn", "message");
assertEquals(mockHandler.warnings.length, 1);
```

#### Testes

- `scenario-data_test.ts`:
  - `describe("ScenarioData")`
    - `it("registra em property.data[idx]")`.
    - `it("a() acessa atributo")`.
    - `it("deepClone retorna this")`.
    - `it("error/warning/info delegam para handler")`.
    - `it("usa sourceFileInfo padrão do property")`.

---

### 7.8 — `Scenario`

#### Contexto

`Scenario` é uma entidade concreta que herda de `PropertyTreeNode`. Representa um cenário (plan, delayed, etc.).

#### Objetivo

Implementar `Scenario`.

#### Arquivos

- `packages/core/src/model/scenario.ts`
- `packages/core/tests/model/scenario_test.ts`

#### Requisitos

- [ ] Classe `Scenario extends PropertyTreeNode`:
  - Constructor `(project, id, name, parent)`.
  - Registra-se em `project.addScenario(this)`.
- [ ] `all(): Scenario[]` — self + descendentes.
- [ ] `allLeaves(includeSelf = false): Scenario[]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Scenario.rb` — arquivo completo.

#### Fora de escopo

- Lógica de cenário (projection, active) — Fase 5/9.

#### Critério de aceite

```ts
const plan = new Scenario(mockProject, "plan", "Plan", null);
const delayed = new Scenario(mockProject, "delayed", "Delayed", plan);

assertEquals(plan.all().length, 2);
assertEquals(plan.allLeaves().length, 1);
assertEquals(plan.allLeaves()[0], delayed);
```

#### Testes

- `scenario_test.ts`:
  - `describe("Scenario")`
    - `it("registra em project")`.
    - `it("all com hierarquia")`.
    - `it("allLeaves sem self")`.
    - `it("allLeaves com self em folha")`.

---

### 7.9 — `PTNProxy`

#### Contexto

Wrapper para `PropertyTreeNode` usada em `PropertyList` (Fase 9). Permite que a mesma `Task` apareça em múltiplos contextos sem duplicar dados. O `logicalId` respeita o caminho de adoção.

#### Objetivo

Implementar `PTNProxy`.

#### Arquivos

- `packages/core/src/model/ptn-proxy.ts`
- `packages/core/tests/model/ptn-proxy_test.ts`

#### Requisitos

- [ ] Classe `PTNProxy`:
  - `ptn: PropertyTreeNode`
  - `parent: PTNProxy | PropertyTreeNode`
  - `private index: number | null`
  - `private tree: string | null`
  - `private levelCache: number`
- [ ] Constructor `(ptn, parent)`:
  - `parent` não pode ser null.
- [ ] `logicalId(): string`:
  - Se `ptn.propertySet.flatNamespace`, retorna `ptn.id`.
  - Senão, `parent.logicalId() + '.' + idCurto(ptn.id)`.
- [ ] `get(attribute): unknown`:
  - Se `attribute === 'index'`, retorna `this.index`.
  - Se `attribute === 'tree'`, retorna `this.tree`.
  - Senão, delega para `ptn.get(attribute)`.
- [ ] `set(attribute, value): void`:
  - Se `attribute === 'index'`, seta `this.index`.
  - Se `attribute === 'tree'`, seta `this.tree`.
  - Senão, delega para `ptn.set(attribute, value)`.
- [ ] `getForScenario(attribute, scIdx): unknown` — mesmo padrão.
- [ ] `setForScenario(attribute, value, scIdx): void`.
- [ ] `get level(): number` — cacheado, conta subindo pelo parent.
- [ ] `isChildOf?(ancestor): boolean`.
- [ ] `getIndicies(): number[]`.
- [ ] `ptn(): PropertyTreeNode` — retorna `this.ptn`.

**Nota:** `PTNProxy` também expõe `propertySet`, `fullId`, `name` via delegação.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PTNProxy.rb` — arquivo completo.

#### Fora de escopo

- Uso em `PropertyList` — Fase 9.

#### Critério de aceite

```ts
const ps = new PropertySet(mockProject, false);
const root = new PropertyTreeNode(ps, "root", "R", null);
const task = new PropertyTreeNode(ps, "task", "T", root);
const proxy = new PTNProxy(task, root);

assertEquals(proxy.logicalId(), "root.task");
assertEquals(proxy.level, 1);
assertEquals(proxy.ptn(), task);
```

#### Testes

- `ptn-proxy_test.ts`:
  - `describe("PTNProxy")`
    - `it("logicalId com ptn flat")`.
    - `it("logicalId com ptn hierárquico")`.
    - `it("get/set para index e tree")`.
    - `it("get/set delega para ptn")`.
    - `it("level cacheado")`.
    - `it("isChildOf?")`.
    - `it("getIndicies")`.
    - `it("ptn() retorna original")`.
    - `it("rejeita parent null")`.

---

### 7.10 — Golden tests (estrutura + herança + adoção)

#### Contexto

Validar comportamento contra o Ruby real.

#### Objetivo

Criar `scripts/golden/property-tree.rb` que:
- Cria `MockProject` (Ruby minimalista).
- Cria `PropertySet`, adiciona atributos.
- Constrói árvores, testa herança, testa adoção.
- Serializa resultados em JSON.

Teste TS lê JSON e compara.

#### Arquivos

- `scripts/golden/property-tree.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/property-tree.golden.json` (gerado)
- `packages/core/tests/golden/property-tree_golden_test.ts`
- `deno.jsonc` — atualizar task `golden:generate`

#### Requisitos

**Script Ruby:**

- [ ] Define `TestProperty < PropertyTreeNode` no próprio script.
- [ ] Define `MockProject` com `scenarioCount` e `scenario(idx)`.
- [ ] Casos:
  - Estrutura de árvore (fullId, level, getBSIndicies, all, allLeaves).
  - Herança não-scenario em 3 níveis.
  - Herança scenario-specific com 2 cenários.
  - Adoção simples.
  - Adoção duplicada (espera erro).
  - Backup/restore.
- [ ] Serializa em JSON estruturado.

**Teste TS:**

- [ ] Itera casos.
- [ ] Verifica cada resultado.
- [ ] Cobertura ≥ 30 casos.

**Task `golden:generate`:**

- [ ] `ruby scripts/golden/property-tree.rb > packages/core/tests/golden/property-tree.golden.json`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb`.
- `docs/taskjuggler/lib/taskjuggler/PropertySet.rb`.
- Fase 2, subfase 5.14 — infraestrutura base.

#### Fora de escopo

- Golden tests de Task/Resource — Fase 5.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- JSON com ≥ 30 casos.
- Todos passam.

#### Testes

- `property-tree_golden_test.ts`:
  - `describe("Golden PropertyTreeNode")`
    - itera casos de estrutura.
    - itera casos de herança.
    - itera casos de adoção.

---

## 6. Ordem de execução sugerida

```text
7.0  ADR 014
      ↓
7.1  AttributeContainer + MockContainer + MockProject + erros
      ↓
7.6  PropertySet                    ← pode rodar antes de PropertyTreeNode completo
      ↓
7.2  PropertyTreeNode — estrutura
      ↓
7.3  PropertyTreeNode — atributos lazy
      ↓
7.4  PropertyTreeNode — herança
      ↓
7.5  PropertyTreeNode — adoção
      ↓
7.7  ScenarioData
      ↓
7.8  Scenario
      ↓
7.9  PTNProxy
      ↓
7.10 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 4 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `PropertyTreeNode` completo (estrutura + atributos + herança + adoção).
- [ ] `PropertySet` completo.
- [ ] `ScenarioData` implementada.
- [ ] `Scenario` implementada.
- [ ] `PTNProxy` implementado.
- [ ] `AttributeContainer`, `ProjectLike` formalizados.
- [ ] `MockContainer`, `MockProject` em testes.
- [ ] **≥ 130 testes unitários**.
- [ ] **≥ 30 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 014 criado.
- [ ] `scripts/golden/property-tree.rb` funcional.
- [ ] `scripts/golden/README.md` atualizado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Lazy attribute creation com helper é menos transparente que Ruby | Médio | Testes garantem semântica igual; ADR 014 documenta |
| `method_missing` substituído por helper quebra subclasses futuras | Médio | Definir padrão claro em ADR 014; revisar em Fase 5 |
| Propagação de cenários em `[]=` com mode 0 tem bug | Alto | Testes com 3 cenários hierárquicos |
| Backup/restore é cópia rasa | Baixo | Aceito — mesmo comportamento do Ruby |
| Adoção recursiva pode causar loop | Alto | Detecção de duplicação em `allLeaves()` do root |
| `MockProject` diverge do `Project` real | Médio | `ProjectLike` é interface mínima; Fase 9 implementa |
| `getBSIndicies` depende de `levelSeqNo` correto | Alto | Testar com árvores variadas (2-3 níveis) |
| `getIndicies` depende de `get('index')` (recalculado por `index()`) | Alto | Testar `PropertySet.index()` |
| `PropertySet.removeProperty` pode quebrar referências | Alto | Testar remoção recursiva + `removeReferences` |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb`
- `docs/taskjuggler/lib/taskjuggler/PropertySet.rb`
- `docs/taskjuggler/lib/taskjuggler/ScenarioData.rb`
- `docs/taskjuggler/lib/taskjuggler/Scenario.rb`
- `docs/taskjuggler/lib/taskjuggler/PTNProxy.rb`

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §3, §4
- `docs/tj3-engine/06-blueprint-engine5.md` — §4.2, §5.3

### Documentos do projeto

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/013-attribute-mode-global.md`
- `docs/syntaxmesh/decisoes/014-metaprogramacao-propertytreenode.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 5 — Entidades Concretas** (Task, Resource herdam de PropertyTreeNode).
- **Fase 6 — Scoreboard e Estruturas Base** (Limits, ShiftAssignments usam ScenarioData).
- **Fase 7 — Scheduler** (usa `scenarioData(scIdx)` e atributos scenario).
- **Fase 9 — Orquestrador** (Project gerencia PropertySets).
- **Fase 14 — Reports** (usa `PropertyList` com `PTNProxy`).

---

## 10. Notas para a IA

1. **`attribute(id)` é o coração.** Sempre use-o; nunca acesse `attributes` Map diretamente.
2. **Não introduza `Proxy`.** A decisão foi por métodos explícitos (ADR 014). Se você acha que precisa, **pare e consulte o autor**.
3. **`scenarioData(scIdx)` substitui `method_missing`.** Subclasses definem métodos explícitos que chamam `this.scenarioData(scIdx).<method>()`.
4. **`inheritAttributes` é chamada uma vez por propriedade**, logo após a criação (nas subclasses). Não chame em loop.
5. **`backupAttributes` é cópia rasa.** Não tente "melhorar" para deep copy — muda a semântica.
6. **Propagação de cenários em `[]=` com mode 0.** Sempre propague para todos os derivados; o alvo recebe `set`, filhos recebem `inherit`.
7. **`PropertySet.index()` recalcula BSI.** Chame sempre após adicionar/remover propriedades.
8. **Golden tests contra Ruby são obrigatórios** para estrutura, herança e adoção.
9. **Sem `any`.** Use `unknown` e narrowing.
10. **Commit por subfase.** `feat(core): property-tree/<aspecto>`.
11. **`MockProject` fica em `tests/`.** Não exponha em `src/`.
12. **`ProjectLike` é interface, não classe.** `Project` real virá na Fase 9.
13. **`MessageHandlerLike` é interface.** Implementação real na Fase 9.

---

## 11. ADR 014 (referência rápida)

Criado como subfase 7.0. Conteúdo esperado:

- **Título:** Metaprogramação Ruby em PropertyTreeNode: adaptações para TypeScript
- **Contexto:** `Hash.new { ... }` (lazy) e `method_missing` (delegação).
- **Decisão:**
  - Lazy → método `attribute(id)`.
  - Delegação → helper `scenarioData(scIdx)` + métodos explícitos.
- **Alternativas:** `Proxy`, inicialização antecipada.
- **Consequências:** clareza + debugabilidade; mais código.

---

**Fim da Fase 4.**