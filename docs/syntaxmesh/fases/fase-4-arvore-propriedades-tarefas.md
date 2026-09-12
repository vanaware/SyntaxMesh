# Fase 4 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-4-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-4-arvore-propriedades.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~118 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{PropertyTreeNode,PropertySet,ScenarioData,Scenario,PTNProxy}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md` (seção relevante)
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 012** — `TjTime` em TypeScript (Fase 2).
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global de atributos (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (criado nesta fase).

### Convenções

- `AttributeBase.setMode(0)` em `beforeEach` — sem isso, testes vazam estado.
- `PropertyTreeNode` é **concreta** (não abstrata). Subclasses estendem.
- `attribute(id)` é o **único** ponto de criação de atributo não-scenario.
- `scenarioAttribute(scIdx, id)` é o **único** ponto de criação de atributo scenario-specific.
- `scenarioData(scIdx)` substitui `method_missing` (ADR 015).
- Nunca usar `Proxy` (ADR 015).
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar `Proxy` em `PropertyTreeNode` (ADR 015).
- ❌ Não acessar `attributes` Map diretamente — sempre via `attribute(id)`.
- ❌ Não inicializar atributos antecipadamente (lazy é decisão de design).
- ❌ Não mutar `scenarioAttributes[scIdx]` fora de `scenarioAttribute`.
- ❌ Não introduzir herança virtual / mixins.

---

## Progresso

```
[x] 4.0  ADR 015 (metaprogramação)          —  5/5  ✅ (já criada)
[ ] 4.1  Fundação (AttributeContainer etc.) —  0/10
[ ] 4.2  PropertyTreeNode estrutura         —  0/22
[ ] 4.3  PropertyTreeNode atributos lazy    —  0/14
[ ] 4.4  PropertyTreeNode herança           —  0/9
[ ] 4.5  PropertyTreeNode adoção            —  0/8
[ ] 4.6  PropertySet                        —  0/20
[ ] 4.7  ScenarioData                       —  0/6
[ ] 4.8  Scenario                           —  0/4
[ ] 4.9  PTNProxy                           —  0/10
[ ] 4.10 Golden tests                       —  0/10
[ ] 4.11 Verificação final                  —  0/8
─────────────────────────────────────────────
TOTAL: ~118
```

---

## Bloco A — Fundação

### 4.0 — ADR 015 (`PropertyTreeNode` metaprogramação) ✅

**Status:** ✅ Arquivo `docs/syntaxmesh/decisoes/015-metaprogramacao-propertytreenode.md` já criado.

| # | Tarefa | Arquivos | Verificação | Status |
|---|---|---|---|---|
| 4.0.1 | Criar `015-metaprogramacao-propertytreenode.md` com frontmatter | idem | arquivo existe | [x] |
| 4.0.2 | Seção **Contexto**: `Hash.new { }` + `method_missing` | idem | — | [x] |
| 4.0.3 | Seção **Decisão**: `attribute(id)` + `scenarioData(scIdx)`, sem `Proxy` | idem | — | [x] |
| 4.0.4 | Seções **Alternativas** (`Proxy`, inicialização antecipada) + **Consequências** | idem | — | [x] |
| 4.0.5 | Adicionar linha `015` em `decisoes/README.md` | `decisoes/README.md` | 15 linhas | [x] |

---

### 4.1 — Fundação (AttributeContainer + ProjectLike + MockProject + erros)

**⚠️ Depends:** Fase 3 (`PropertyLike`, `AttributeBase`, `AttributeDefinition`)
**⚠️ RUBY: `PropertyTreeNode.rb` — topo do arquivo (definição de `@attributes`, `@data`)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.1.1 | Criar `model/project-like.ts` com `interface ProjectLike { scenarioCount: number; scenario(arg): Scenario \| null; scenarioIdx(sc): number \| undefined; get(name): unknown; set(name, v): void }` | `src/model/project-like.ts` | `deno check` |
| 4.1.2 | Criar `model/errors.ts` com `TjInternalError extends TjError` | `src/model/errors.ts` | `deno check` |
| 4.1.3 | Re-exportar `PropertyLike` de Fase 3 em `model/mod.ts` | `src/model/mod.ts` | `deno check` |
| 4.1.4 | Estender `MockContainer` (Fase 3) para expor `has(id)` + `size()` | `tests/attributes/mock-container.ts` | `deno check` |
| 4.1.5 | Criar `tests/model/mock-project.ts` (reescrever) com `MockProject implements ProjectLike` | idem | `deno check` |
| 4.1.6 | `MockProject`: `scenarioCount` configurável (default `1`) | idem | 2 testes |
| 4.1.7 | `MockProject`: `scenario(idx)` retorna `{ id: 'plan', fullId: 'plan' }` para `idx === 0` | idem | 2 testes |
| 4.1.8 | `MockProject`: `scenarioIdx(sc)` retorna `0` para `plan`, `undefined` senão | idem | 2 testes |
| 4.1.9 | `MockProject`: `get`/`set` sobre `Map<string, unknown>` interno | idem | 3 testes |
| 4.1.10 | Adicionar exports em `packages/core/mod.ts` | `src/mod.ts` | `deno check` |

---

## Bloco B — `PropertyTreeNode`

### 4.2 — `PropertyTreeNode` — estrutura e IDs

**⚠️ RUBY: `PropertyTreeNode.rb` (linhas ~30–250)** — construtor, `fullId`, `level`, `getBSIndicies`, `getIndicies`, `addChild`, `removeReferences`, `leaf?`, `container?`, `kids`, `parents`, `all`, `allLeaves`, `isChildOf?`, `ancestors`, `root`, `levelSeqNo`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.2.1 | Criar classe `PropertyTreeNode implements PropertyLike, AttributeContainer` vazia | `src/model/property-tree-node.ts` | `deno check` |
| 4.2.2 | Campos: `propertySet`, `project`, `parent`, `subId`, `id`, `name`, `sequenceNo`, `children[]`, `adoptees[]`, `stepParents[]`, `sourceFileInfo`, `data[]` | idem | 1 teste |
| 4.2.3 | ⚠️ Constructor `(propertySet, id, name, parent)`: gerar ID único (`_<Class>_<N>`) se `id === null` | idem | 3 testes |
| 4.2.4 | ⚠️ Constructor: em namespace hierárquico, se `id` contém `.`, extrair parent de `id` (Ruby: split em último `.`) | idem | 3 testes |
| 4.2.5 | Constructor: chamar `set('id', fullId)`, `set('name', name)`, `set('seqno', sequenceNo)` | idem | 1 teste |
| 4.2.6 | ⚠️ `get fullId()`: em `flatNamespace`, retorna `subId`; senão `parent.fullId + '.' + subId` | idem | 3 testes |
| 4.2.7 | `logicalId(): string` — para `PropertyTreeNode` é igual a `fullId` (PTNProxy sobrescreve) | idem | 2 testes |
| 4.2.8 | ⚠️ `get level(): number` — cacheado; `0` se sem parent, senão `parent.level + 1` | idem | 3 testes |
| 4.2.9 | `root(): PropertyTreeNode` — sobe até `parent === null` | idem | 2 testes |
| 4.2.10 | ⚠️ `ancestors(includeStepParents = false): PropertyTreeNode[]` — sobe, inclui stepParents se flag | idem | 4 testes |
| 4.2.11 | `isChildOf?(ancestor): boolean` — checa se `ancestor` está em `parents()` recursivamente | idem | 4 testes |
| 4.2.12 | ⚠️ `leaf(): boolean` — sem `children` E sem `adoptees` | idem | 3 testes |
| 4.2.13 | `container(): boolean` — com `children` OU `adoptees` | idem | 3 testes |
| 4.2.14 | `kids(): PropertyTreeNode[]` — `children + adoptees` | idem | 2 testes |
| 4.2.15 | `parents(): PropertyTreeNode[]` — `[parent] + stepParents` filtrando `null` | idem | 2 testes |
| 4.2.16 | `all(): PropertyTreeNode[]` — self + descendentes recursivo | idem | 3 testes |
| 4.2.17 | ⚠️ `allLeaves(withoutSelf = false): PropertyTreeNode[]` — folhas; `withoutSelf` exclui self | idem | 4 testes |
| 4.2.18 | ⚠️ `getBSIndicies(): number[]` — índice de cada ancestral em `parents[0].children` + índice em `children` | idem | 4 testes |
| 4.2.19 | ⚠️ `getIndicies(): number[]` — usa `get('index')` do pai + filho | idem | 3 testes |
| 4.2.20 | `levelSeqNo(node: PropertyTreeNode): number` — número sequencial no nível | idem | 2 testes |
| 4.2.21 | `addChild(child): void` — push + set `parent` do child | idem | 2 testes |
| 4.2.22 | `removeReferences(property): void` — remove de `children`, `adoptees`, `stepParents` | idem | 3 testes |

---

### 4.3 — `PropertyTreeNode` — atributos lazy

**⚠️ RUBY: `PropertyTreeNode.rb` (linhas ~250–400)** — `@attributes` Hash default, `@scenarioAttributes`, `get`, `getAttribute`, `force`, `set`, `[]=`, `[]`, `provided`, `inherited`, `modified`.
**🔎 CHEAT: §8 `Hash.new { }` → método `attribute(id)`, §3 `@@classvar` (não aplicável aqui)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.3.1 | Campo `private attributes = new Map<string, AttributeBase<unknown>>()` | `src/model/property-tree-node.ts` | `deno check` |
| 4.3.2 | Campo `private scenarioAttributes: Array<Map<string, AttributeBase<unknown>>>` (inicializado com `project.scenarioCount` Maps vazios) | idem | 1 teste |
| 4.3.3 | ⚠️ Método `attribute(id: string): AttributeBase<unknown>`: cache hit, senão `attributeDefinition(id)` + `new aDef.objClass(...)` | idem | 4 testes |
| 4.3.4 | `attribute(id)` rejeita `scenarioSpecific` (`TjArgumentError`) | idem | 2 testes |
| 4.3.5 | `attribute(id)` rejeita `id` desconhecido (`TjArgumentError` "Unknown attribute") | idem | 1 teste |
| 4.3.6 | ⚠️ Método `private scenarioAttribute(scIdx, id): AttributeBase<unknown>`: cache hit, senão cria com `container = data[scIdx]` | idem | 4 testes |
| 4.3.7 | `scenarioAttribute` rejeita `!scenarioSpecific` (`TjArgumentError`) | idem | 1 teste |
| 4.3.8 | `scenarioAttribute` rejeita `data[scIdx] === null` (`TjInternalError` "ScenarioData must be initialized") | idem | 1 teste |
| 4.3.9 | `get(id): unknown` → `this.attribute(id).get()` | idem | 2 testes |
| 4.3.10 | `getAttribute(id, scIdx?): AttributeBase<unknown>` — dispatch entre `attribute` e `scenarioAttribute` | idem | 2 testes |
| 4.3.11 | ⚠️ `set(id, value): void` — verifica overwrite (exceto listas); chama `attr.set(value)` | idem | 3 testes |
| 4.3.12 | `force(id, value): void` — `attr.set(value)` sem check overwrite | idem | 1 teste |
| 4.3.13 | ⚠️ `getForScenario(id, scIdx): unknown` → `scenarioAttribute(scIdx, id).get()` | idem | 2 testes |
| 4.3.14 | ⚠️ `setForScenario(id, value, scIdx): void` — se `scIdx === undefined` delega a `set`; se `mode === 0` propaga para cenários derivados (filhos fazem `inherit`) | idem | 5 testes |
| 4.3.15 | `provided(id, scIdx?): boolean` | idem | 3 testes |
| 4.3.16 | `inherited(id, scIdx?): boolean` | idem | 3 testes |
| 4.3.17 | `modified(id, scIdx?): boolean` — `provided \|\| inherited` | idem | 3 testes |
| 4.3.18 | ⚠️ `attributeDefinition(id): AttributeDefinition \| undefined` — `propertySet.attributeDefinition(id)` | idem | 2 testes |
| 4.3.19 | ⚠️ `scenarioData(scIdx): ScenarioData` — retorna `this.data[scIdx]!` (ADR 015) | idem | 2 testes |
| 4.3.20 | `implements AttributeContainer`: `getStoredValue`/`setStoredValue` sobre `attributes` Map | idem | 3 testes |

---

### 4.4 — `PropertyTreeNode` — herança e backup/restore

**⚠️ RUBY: `PropertyTreeNode.rb` (linhas ~400–500)** — `inheritAttributes`, `backupAttributes`, `restoreAttributes`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.4.1 | ⚠️ `inheritAttributes(): void` — itera `eachAttributeDefinition`; para atributos `inheritedFromParent` com parent que tem valor, chama `attr.inherit(parent.get(id))` | `src/model/property-tree-node.ts` | 4 testes |
| 4.4.2 | `inheritAttributes` — top-level herda de `project.get(id)` se `inheritedFromProject` | idem | 3 testes |
| 4.4.3 | `inheritAttributes` — cenários: itera por `scIdx`, propaga via `getForScenario`/`setForScenario` (com `inherit`) | idem | 3 testes |
| 4.4.4 | `inheritAttributes` — não sobrescreve valor já `provided` | idem | 2 testes |
| 4.4.5 | `inheritAttributes` — preserva `inherited` em cadeia (parent também herdou) | idem | 2 testes |
| 4.4.6 | ⚠️ `backupAttributes(): AttributeBackup` — retorna `{ attributes: new Map(this.attributes), scenarioAttributes: this.scenarioAttributes.map(m => new Map(m)) }` | idem | 2 testes |
| 4.4.7 | ⚠️ `restoreAttributes(backup): void` — restaura os Maps (atributos são compartilhados — cópia rasa) | idem | 2 testes |
| 4.4.8 | `restoreAttributes` — testar round-trip: modifica, restaura, verifica valores originais | idem | 1 teste |
| 4.4.9 | `restoreAttributes` — testar que mapa `attributes` é substituído, não mutado in-place | idem | 1 teste |

---

### 4.5 — `PropertyTreeNode` — adoção

**⚠️ RUBY: `PropertyTreeNode.rb` (linhas ~500–560)** — `adopt`, `getAdopted`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.5.1 | ⚠️ `adopt(property): void` — rejeita `property === this` (`TjArgumentError` "cannot adopt itself") | `src/model/property-tree-node.ts` | 2 testes |
| 4.5.2 | `adopt` — coleta `root().all()` e verifica se alguma folha de `property.allLeaves()` já está lá | idem | 3 testes |
| 4.5.3 | `adopt` — rejeita duplicata (`TjArgumentError` "already adopted") | idem | 2 testes |
| 4.5.4 | `adopt` — push em `adoptees` + chama `property.getAdopted(this)` | idem | 2 testes |
| 4.5.5 | ⚠️ `getAdopted(property): void` — adiciona `property` a `stepParents` se ainda não estiver | idem | 2 testes |
| 4.5.6 | `getAdopted` — idempotente: chamar 2x não duplica | idem | 1 teste |
| 4.5.7 | `kids()` inclui `adoptees` (verificar comportamento pós-adopt) | idem | 1 teste |
| 4.5.8 | `leaf()` retorna `false` quando há `adoptees` | idem | 1 teste |

---

## Bloco C — `PropertySet`

### 4.6 — `PropertySet`

**⚠️ RUBY: `PropertySet.rb` (arquivo inteiro — ~250 linhas)** — construtor, `addAttributeType`, `eachAttributeDefinition`, `knownAttribute`, `hasQuery?`, `scenarioSpecific?`, `inheritedFromProject?`, `inheritedFromParent?`, `userDefined?`, `listAttribute?`, `defaultValue`, `attributeName`, `attributeType`, `addProperty`, `removeProperty`, `clearProperties`, `index`, `levelSeqNo`, `maxDepth`, `items`, `empty?`, `topLevelItems`, `each`, `to_ary`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.6.1 | Criar `src/model/property-set.ts` com classe `PropertySet<T extends PropertyTreeNode>` | idem | `deno check` |
| 4.6.2 | Campos: `project`, `flatNamespace`, `private properties[]`, `private propertyMap: Map<string, T>`, `private attributeDefinitions: Map<string, AttributeDefinition>` | idem | `deno check` |
| 4.6.3 | ⚠️ Constructor `(project, flatNamespace)`: adiciona `id` (`StringAttribute`), `name` (`StringAttribute`), `seqno` (`IntegerAttribute`) via `addAttributeType` (base) | idem | 3 testes |
| 4.6.4 | ⚠️ `addAttributeType(attrDef): void` — rejeita se `properties.length > 0` (`TjError` "Attribute types must be defined before properties are added") | idem | 2 testes |
| 4.6.5 | `addAttributeType` — registra em `attributeDefinitions` Map | idem | 1 teste |
| 4.6.6 | `addAttributeType` — idempotente: rejeita duplicata de id? (verificar Ruby) | idem | 1 teste |
| 4.6.7 | `eachAttributeDefinition(): IterableIterator<AttributeDefinition>` | idem | 1 teste |
| 4.6.8 | `knownAttribute(id): boolean` | idem | 2 testes |
| 4.6.9 | ⚠️ `hasQuery?(id, scenarioIdx?): boolean` — verifica se existe `query_<id>` em alguma property (Fase 11 completa) → nesta fase: `false` | idem | 2 testes |
| 4.6.10 | `scenarioSpecific?(id): boolean` — `attrDef.scenarioSpecific` | idem | 3 testes |
| 4.6.11 | `inheritedFromProject?(id)`, `inheritedFromParent?(id)` | idem | 4 testes |
| 4.6.12 | `userDefined?(id)` | idem | 2 testes |
| 4.6.13 | ⚠️ `listAttribute?(id): boolean` — `attrDef.objClass` estende `ListAttributeBase` | idem | 3 testes |
| 4.6.14 | `defaultValue(id): unknown` — `attrDef.default` | idem | 2 testes |
| 4.6.15 | `attributeName(id): string \| undefined` | idem | 2 testes |
| 4.6.16 | `attributeType(id): AttributeType \| undefined` | idem | 2 testes |
| 4.6.17 | ⚠️ `addProperty(prop): void` — push + Map; atualiza `sequenceNo` do prop | idem | 3 testes |
| 4.6.18 | ⚠️ `removeProperty(prop \| id): T` — remove recursivamente (children) + `removeReferences` | idem | 4 testes |
| 4.6.19 | `clearProperties(): void` — limpa properties + Map | idem | 2 testes |
| 4.6.20 | `get(id): T \| undefined` — via `propertyMap` | idem | 2 testes |
| 4.6.21 | ⚠️ `index(): void` — recalcula `bsi` (via `getBSIndicies` + `levelSeqNo`?) — verificar Ruby | idem | 3 testes |
| 4.6.22 | `levelSeqNo(property): number` — número sequencial de property no seu nível | idem | 2 testes |
| 4.6.23 | `maxDepth(): number` | idem | 2 testes |
| 4.6.24 | `items(): number`, `empty(): boolean`, `topLevelItems(): number` | idem | 4 testes |
| 4.6.25 | `each(fn): void` — itera properties em ordem BSI | idem | 2 testes |
| 4.6.26 | `toArray(): T[]` | idem | 1 teste |
| 4.6.27 | `[Symbol.iterator](): Iterator<T>` | idem | 2 testes |

---

## Bloco D — `ScenarioData` e `Scenario`

### 4.7 — `ScenarioData`

**⚠️ RUBY: `ScenarioData.rb` (arquivo inteiro — ~70 linhas)** — constructor, `property`, `a(attributeName)`, `error`, `warning`, `info`, `deep_clone`.

**Nota:** `MessageHandlerLike` é Fase 9. Nesta fase, interface + mock.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.7.1 | Criar `src/model/message-handler-like.ts` com `interface MessageHandlerLike { error(id, text, sfi?, property?): void; warning(...); info(...) }` | idem | `deno check` |
| 4.7.2 | Criar `src/model/scenario-data.ts` com classe `ScenarioData` | idem | `deno check` |
| 4.7.3 | ⚠️ Constructor `(property, idx, attributes)`: seta `property.data[idx] = this` (self-registration) | idem | 3 testes |
| 4.7.4 | `a(attributeName): unknown` — atalho para `property.getAttribute(name, scenarioIdx).get()` | idem | 3 testes |
| 4.7.5 | ⚠️ `error(id, text, sfi?, property?)`, `warning(...)`, `info(...)` — delegam para `MessageHandler` singleton | idem | 4 testes |
| 4.7.6 | `deepClone(): this` — retorna `this` (ScenarioData não é clonado) | idem | 1 teste |

---

### 4.8 — `Scenario`

**⚠️ RUBY: `Scenario.rb` (arquivo inteiro — ~25 linhas)** — constructor, `all`, `allLeaves`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.8.1 | Criar `src/model/scenario.ts` com `class Scenario extends PropertyTreeNode` | idem | `deno check` |
| 4.8.2 | ⚠️ Constructor `(project, id, name, parent)`: `super(project.scenarios, ...)` + registra em `project.addScenario(this)` | idem | 2 testes |
| 4.8.3 | `all(): Scenario[]` — self + descendentes (override tipado) | idem | 3 testes |
| 4.8.4 | `allLeaves(includeSelf = false): Scenario[]` | idem | 3 testes |

---

## Bloco E — `PTNProxy`

### 4.9 — `PTNProxy`

**⚠️ RUBY: `PTNProxy.rb` (arquivo inteiro — ~120 linhas)** — `logicalId`, `get`, `set`, `getForScenario`, `setForScenario`, `level`, `isChildOf?`, `getIndicies`, `ptn`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.9.1 | Criar `src/model/ptn-proxy.ts` com classe `PTNProxy` | idem | `deno check` |
| 4.9.2 | Campos: `ptn`, `parent`, `private index`, `private tree`, `private levelCache` | idem | 1 teste |
| 4.9.3 | Constructor `(ptn, parent)` — rejeita `parent === null` (`TjArgumentError`) | idem | 2 testes |
| 4.9.4 | ⚠️ `logicalId(): string` — se `ptn.propertySet.flatNamespace`, retorna `ptn.id`; senão `parent.logicalId() + '.' + idCurto(ptn.id)` | idem | 4 testes |
| 4.9.5 | ⚠️ `get(attribute): unknown` — se `index`/`tree`, retorna cache; senão delega a `ptn.get(attribute)` | idem | 3 testes |
| 4.9.6 | ⚠️ `set(attribute, value): void` — se `index`/`tree`, seta cache; senão delega a `ptn.set(attribute, value)` | idem | 3 testes |
| 4.9.7 | `getForScenario(attribute, scIdx)`, `setForScenario(attribute, value, scIdx)` — análogos | idem | 3 testes |
| 4.9.8 | `get level(): number` — cacheado; sobe por `parent` | idem | 3 testes |
| 4.9.9 | ⚠️ `isChildOf?(ancestor): boolean` | idem | 3 testes |
| 4.9.10 | `getIndicies(): number[]`, `ptn(): PropertyTreeNode` | idem | 3 testes |

---

## Bloco F — Golden tests

### 4.10 — Golden tests (`PropertyTreeNode` + `PropertySet`)

**⚠️ RUBY: `PropertyTreeNode.rb`, `PropertySet.rb`**

**Nota:** como `Task`/`Resource` ainda não existem (Fase 5), usamos uma subclasse `TestProperty` no script Ruby.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 4.10.1 | Atualizar `scripts/golden/README.md` com seção de `property-tree` | idem | — |
| 4.10.2 | `scripts/golden/property-tree.rb` — define `TestProperty < PropertyTreeNode` + `MockProject` | idem | roda |
| 4.10.3 | Casos de estrutura: `fullId`, `level`, `getBSIndicies`, `all`, `allLeaves` | idem | JSON válido |
| 4.10.4 | Casos de herança não-scenario em 3 níveis | idem | ≥ 10 casos |
| 4.10.5 | Casos de herança scenario-specific com 2 cenários | idem | ≥ 10 casos |
| 4.10.6 | Casos de adoção (simples + duplicada esperando erro) | idem | ≥ 5 casos |
| 4.10.7 | Casos de backup/restore | idem | ≥ 3 casos |
| 4.10.8 | Task `golden:generate` atualizada | `deno.jsonc` | roda |
| 4.10.9 | `tests/golden/property-tree_golden_test.ts` — itera casos | idem | verde |
| 4.10.10 | Commitar JSON em `packages/core/tests/golden/property-tree.golden.json` | idem | versionado |

---

## Bloco G — Verificação final

### 4.11 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 4.11.1 | `deno task check-all` verde | exit 0 |
| 4.11.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 4.11.3 | `grep -r "Proxy" packages/core/src/model/` retorna 0 (ADR 015) | grep |
| 4.11.4 | `grep -r "scenarioData" packages/core/src/model/` ≥ 3 | grep |
| 4.11.5 | ADR 015 já commitada | git log |
| 4.11.6 | `PropertySet`, `PropertyTreeNode`, `ScenarioData`, `Scenario`, `PTNProxy` exportados em `model/mod.ts` | `deno check` |
| 4.11.7 | `tests/integration/smoke_after_phase_4_test.ts` — importa `@syntaxmesh/core`, cria `PropertySet` + `PropertyTreeNode`, verifica `fullId`; verifica Fase 3 (`AttributeBase.setMode(0)`) | 1 teste |
| 4.11.8 | Auditoria: cada subfase do plano `fase-4-arvore-propriedades.md` tem tarefas correspondentes | grep |

---

## Notas para a IA

1. **Ordem:** 4.0 (já feito) → 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9 → 4.10 → 4.11.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura do arquivo completo.
3. **`Proxy` é proibido** — ADR 015. Usar `attribute(id)` + `scenarioData(scIdx)`.
4. **`AttributeBase.setMode(0)` em `beforeEach`** (herança do Fase 3).
5. **`PropertyLike`** (Fase 3) fica **mínimo** (`id`, `name`). Não expandir.
6. **`ProjectLike`** é nova interface em `model/project-like.ts` — mínimo para `PropertySet` e `PropertyTreeNode`.
7. **`MockProject`** é **reescrito** (Fase 3 tinha versão mínima). Expandir com `scenarioCount`, `scenario(idx)`, `scenarioIdx(sc)`, `get`/`set`.
8. **`scenarioData(scIdx)` retorna `ScenarioData`** — a partir da Fase 5, subclasses fazem override tipado (`TaskScenario`, etc.).
9. **`inheritAttributes`** roda **uma vez por propriedade**, logo após criação. Não chamar em loop.
10. **`backupAttributes`** é **cópia rasa** — atributos são compartilhados. Aceito (mesmo comportamento do Ruby).
11. **`adopt`** validações: self, duplicata na mesma raiz. Não permitir ciclos.
12. **`PropertySet.addAttributeType`** deve ser chamado **antes** de `addProperty`.
13. **`PropertySet.index()`** recalcula BSI. Chamar após adicionar/remover.
14. **`MockContainer`** é `AttributeContainer` (Fase 3). `PropertyTreeNode` também é.
15. **Stubs** (`NotYetImplementedError`) com comentário `// TODO Fase N: <razão>`.
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(core): property-tree-node`, etc.
18. **Golden tests são o critério final.** Rodar `tj3` real se possível.
19. **`MessageHandlerLike`** é interface nesta fase; implementação real na Fase 9.
20. **`Scenario`** herda de `PropertyTreeNode` (não de `ScenarioData`).

---

## Notas específicas por subfase

### 4.1 — Fundação

- `ProjectLike` é **mínimo**: `scenarioCount`, `scenario`, `scenarioIdx`, `get`, `set`. Fase 9 expande.
- `MockProject` **reescreve** o da Fase 3 (que era stub).
- `MockContainer` é **estendido** com `has(id)` e `size()`.

### 4.2 — Estrutura

- `getBSIndicies` é o **mais sutil**. Ler Ruby linha-a-linha.
- `getIndicies` usa `get('index')` — que é setado por `PropertySet.index()`.

### 4.3 — Atributos lazy

- `attribute(id)` é o **coração** de toda a Fase 4.
- `scenarioAttribute(scIdx, id)` só é usado por `setForScenario`/`getForScenario`/`provided`/`inherited`/`modified`.
- `setForScenario` com `mode 0` propaga para cenários derivados — teste com 3 cenários hierárquicos.

### 4.4 — Herança

- `inheritAttributes` é chamado **uma vez** por propriedade (nas subclasses, Fase 5).
- `backupAttributes`/`restoreAttributes` são usados por `generateReport` (Fase 14).

### 4.5 — Adoção

- Adoção em árvore **sem ciclos**. `adopt` valida.

### 4.6 — `PropertySet`

- `PropertySet<T>` é **genérico**: `PropertySet<Scenario>`, `PropertySet<Task>`, etc.
- `index()` recalcula BSI — chave para `getBSIndicies` funcionar.

### 4.7 — `ScenarioData`

- `a(name)` é o atalho que `TaskScenario`/`ResourceScenario` usam (Fase 5+).
- `MessageHandlerLike` é interface — mock em testes.

### 4.8 — `Scenario`

- `all()` e `allLeaves()` sobrescrevem `PropertyTreeNode` com tipagem mais específica.
- Registro em `project.addScenario` é **obrigatório**.

### 4.9 — `PTNProxy`

- Usado por `PropertyList` (Fase 9).
- `logicalId()` respeita caminho de adoção.

### 4.10 — Golden tests

- `TestProperty < PropertyTreeNode` é subclasse **apenas no script Ruby** (não em `src/`).
- Casos cobrem: estrutura, herança, adoção, backup/restore.

---

**Fim do arquivo de tarefas da Fase 4.**