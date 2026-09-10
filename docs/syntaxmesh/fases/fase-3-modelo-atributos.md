# Fase 3 — Modelo de Atributos

> **Arquivo:** `docs/syntaxmesh/fases/fase-3-modelo-atributos.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–7 dias
> **Depende de:** Fase 2 — Tempo e Geometria
> **Bloqueia:** Fases 4, 5, 6, 7, 8, 10, 11, 12, 14, 16

---

## 1. Contexto

O TaskJuggler tem um **sistema de atributos único**. Diferente de linguagens onde atributos são simples campos, aqui cada atributo é:

1. **Tipado** — `DateAttribute`, `FloatAttribute`, `FlagListAttribute`, etc. (~40 tipos).
2. **Rastreável** — sabe se o valor foi `provided` (usuário), `inherited` (pai/projeto) ou `computed` (scheduler).
3. **Herança dupla** — herda do pai (`inheritedFromParent`) e/ou do projeto (`inheritedFromProject`).
4. **Scenario-specific** — pode ter valor diferente por cenário (ex: `effort` no cenário "plan" vs "delayed").
5. **Lazy** — só é instanciado quando acessado.
6. **Container-based** — o valor é armazenado no container (`PropertyTreeNode` para não-scenario, `ScenarioData` para scenario-specific), não no próprio atributo.

Este sistema é implementado por 4 arquivos Ruby:

- `AttributeBase.rb` — classe base + `ListAttributeBase` + modo global (`@@mode`).
- `AttributeDefinition.rb` — blueprint imutável de cada atributo.
- `Attributes.rb` — ~40 subclasses (tipos concretos).
- `deep_copy.rb` — utilitário genérico de cópia profunda (usado por `inherit`).

Portar isso corretamente é **crítico**. Erros aqui quebram herança, cenários, validação e relatórios. As subfases seguem a divisão natural do Ruby, mas agrupam subclasses por afinidade.

**Nota sobre dependências futuras:** alguns atributos (`RichTextAttribute`, `ResourceListAttribute.to_rti`, `ReferenceAttribute.to_rti`, `LimitsAttribute`, `ShiftAssignmentsAttribute`, `WorkingHoursAttribute`) dependem de classes que só existirão em fases posteriores (`Query` — Fase 11, `RichText` — Fase 12, `Limits`/`ShiftAssignments` — Fase 6/7). Nesta fase:
- Definimos **interfaces de port** (`RichTextIntermediate`, `QueryLike`) em `packages/core/src/format/` para permitir compilação.
- Implementamos os métodos que **não dependem** dessas classes.
- Métodos que dependem lançam `NotYetImplementedError` com mensagem apontando a fase.

---

## 2. Objetivo

Ao final desta fase:

- `AttributeBase`, `ListAttributeBase`, `AttributeDefinition`, `AttributeOverwrite` implementados.
- Todas as ~40 subclasses de atributo portadas.
- Modo global (`mode` 0/1/2) implementado como `static` em `AttributeBase`.
- `AttributeContainer` interface + implementações em `PropertyTreeNode` e `ScenarioData` (esqueletos).
- `deepClone` utility substituindo `deep_copy.rb`.
- **≥ 120 testes unitários** + **≥ 40 golden tests** (herança, propagação de cenários).
- ADR 013 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `AttributeBase.rb` | ~150 | Média | **Crítica** |
| `AttributeDefinition.rb` | ~60 | Baixa | **Crítica** |
| `Attributes.rb` | ~680 | Média | **Crítica** |
| `deep_copy.rb` | ~80 | Baixa | Alta |

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.3 AttributeDefinitions por PropertySet | Lista de atributos por entidade |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.4 Formato de AttributeDefinition | Tupla de 8 campos |
| `docs/tj3-engine/02-bluprint-engine1.md` | §3.3 Sistema de Atributos (Lazy Creation) | Lazy via Proxy |
| `docs/tj3-engine/06-blueprint-engine5.md` | §6 Attributes (detalhado) | Subclasses completas |
| `docs/tj3-engine/06-blueprint-engine5.md` | §6.2 Implementação de Atributos Comuns | Exemplos de cada tipo |

### 3.3 Golden tests

Usamos `tj3` para validar comportamento de herança e propagação de cenários. O script `scripts/golden/attributes.rb` gera JSON com cenários: projeto com atributos herdados em 3 níveis + 2 cenários + defaults.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `@@mode` global → `static` em `AttributeBase`

Ruby usa `@@mode` (class variable compartilhada entre todas as subclasses). Em TS:

```ts
export type AttributeMode = 0 | 1 | 2;

export abstract class AttributeBase {
  private static _mode: AttributeMode = 0;

  static get mode(): AttributeMode { return AttributeBase._mode; }
  static setMode(mode: AttributeMode): void { AttributeBase._mode = mode; }
}
```

**Limitação:** como o modo é global, dois projetos agendados simultaneamente no mesmo worker clobberariam. Aceito — é o mesmo comportamento do Ruby, e não precisamos de concorrência nesta fase. Registrado em ADR 013.

### 4.2 `@container` → interface `AttributeContainer`

Ruby armazena o valor em `@container.instance_variable_set('@' + id, value)`. Em TS:

```ts
export interface AttributeContainer {
  getStoredValue(attributeId: string): unknown;
  setStoredValue(attributeId: string, value: unknown): void;
}
```

`PropertyTreeNode` e `ScenarioData` implementarão essa interface (Fase 4). Nesta fase, criamos a interface e uma implementação mock para testes.

### 4.3 `deep_clone` genérico → função `deepClone<T>`

Ruby estende `Object#deep_clone`. Em TS, usamos função standalone:

```ts
export function deepClone<T>(value: T): T;
```

Regras:
- Primitivos (`number`, `string`, `boolean`, `null`, `undefined`) → retornam como estão.
- `TjTime`, `RealFormat` → imutáveis, retornam `this`.
- `PropertyTreeNode` (futuro) → retorna `this` (referência).
- `Array` → recursivo em cada elemento.
- `Map`, `Set` → recursivo.
- Objetos com método `deepClone()` → chama o método.
- Fallback → `structuredClone`.

### 4.4 `tjpId` estático

Ruby: cada subclasse define `def TipoAttribute::tjpId; 'text'; end`. TS: `static readonly tjpId = 'text';`.

### 4.5 `to_rti` com dependências futuras

Métodos `to_rti` que dependem de `RichText`/`Query`:

- `RichTextAttribute.to_rti` — herda da base (retorna o valor).
- `ResourceListAttribute.to_rti` — depende de `RichText` e `RTFHandlers`.
- `ReferenceAttribute.to_rti` — depende de `RichText`.

**Decisão:** nesta fase, essas implementações lançam `NotYetImplementedError` (com mensagem apontando Fase 11/12). Testes verificam que lançam. Fase 12 substitui.

Interfaces de port em `packages/core/src/format/rich-text-port.ts`:

```ts
export interface RichTextIntermediate {
  readonly richText: { readonly inputText: string };
  to_s(): string;
  to_html(): unknown;
  empty(): boolean;
  setQuery(query: unknown): void;
  blockMode: boolean;
  sectionNumbers: boolean;
  cssClass: string | null;
}

export interface RichTextFactory {
  create(text: string): RichTextIntermediate;
}
```

### 4.6 `AttributeDefinition` imutável

Ruby usa `freeze`. TS: usar `Object.freeze(this)` no construtor, mais `readonly` em todos os campos.

### 4.7 Tipos de `default`

O default de um atributo pode ser: número, string, booleano, `null`, ou template (Array vazio, `LeaveList` vazio, etc.). Em TS, o tipo é genérico `T`.

### 4.8 `AttributeOverwrite` exception

Ruby: `class AttributeOverwrite < ArgumentError`. TS: `class AttributeOverwrite extends TjArgumentError`.

### 4.9 `quotedString` compartilhado

Ruby: `AttributeBase#quotedString` (privado). TS: método `protected` em `AttributeBase`.

### 4.10 `LimitsAttribute` e `ShiftAssignmentsAttribute`

Esses dois atributos referenciam `Limits` e `ShiftAssignments`, que são classes da Fase 6/7. Nesta fase:
- O tipo do `default` é `unknown` (aceita `null`).
- `LimitsAttribute` estende `AttributeBase` sem lógica especial.
- `ShiftAssignmentsAttribute` idem.

Os métodos `to_tjp` que dependem dessas classes lançam `NotYetImplementedError` até Fase 7.

---

## 5. Subfases detalhadas

Cada subfase segue `docs/syntaxmesh/fases/modelo-tarefas.md`.

---

### 6.0 — ADR 013 (`mode` global de atributos)

#### Contexto

O `AttributeBase.rb` usa `@@mode` (class variable compartilhada). O modo afeta o comportamento de `set()` e `inherit()`:

- `mode = 0` (provided): usuário setou o valor.
- `mode = 1` (inherited): valor veio do pai ou do projeto.
- `mode = 2` (computed): valor calculado pelo scheduler.

O scheduler alterna entre modos durante o pipeline (`prepareScenario` usa mode 1, `scheduleScenario` usa mode 2).

Em TypeScript, precisamos decidir como representar esse estado global.

#### Objetivo

Registrar formalmente a decisão em `docs/syntaxmesh/decisoes/013-attribute-mode-global.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/013-attribute-mode-global.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] Contexto: por que `mode` existe, quando é usado.
- [ ] Decisão: `static` em `AttributeBase`, com getter/setter.
- [ ] Alternativas: `AsyncLocalStorage`, context-passing, `Symbol` no valor.
- [ ] Consequências:
  - **Positivas:** simplicidade, paridade com Ruby.
  - **Negativas:** sem suporte a concorrência entre projetos no mesmo worker.
  - **Mitigação futura:** se necessário, migrar para `AsyncLocalStorage`.
- [ ] Atualizar tabela em `decisoes/README.md`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb` — `@@mode`, `mode`, `setMode`.
- `docs/syntaxmesh/decisoes/README.md` — template.
- Seção 4.1 deste documento.

#### Fora de escopo

- Implementação — subfase 6.1.

#### Critério de aceite

- ADR 013 criado.
- Tabela atualizada.

---

### 6.1 — `AttributeBase`, `ListAttributeBase`, `AttributeOverwrite`

#### Contexto

A classe base de todo o sistema de atributos. Define:
- Armazenamento de valor via container.
- Flags `provided`, `inherited`.
- Modo global.
- Métodos de leitura/escrita.
- Conversões `to_s`, `to_num`, `to_sort`, `to_rti`, `to_tjp`.
- `quotedString` para strings com newline.

#### Objetivo

Implementar `AttributeBase`, `ListAttributeBase` e `AttributeOverwrite` com testes cobrindo todos os modos.

#### Arquivos

- `packages/core/src/attributes/attribute-container.ts` (interface)
- `packages/core/src/attributes/attribute-base.ts`
- `packages/core/src/attributes/list-attribute-base.ts`
- `packages/core/src/attributes/errors.ts` (`AttributeOverwrite`, `NotYetImplementedError`)
- `packages/core/src/attributes/__test__/attribute-base_test.ts`
- `packages/core/src/attributes/__test__/list-attribute-base_test.ts`

#### Requisitos

**`AttributeContainer`:**

- [ ] `getStoredValue(attributeId: string): unknown`.
- [ ] `setStoredValue(attributeId: string, value: unknown): void`.

**`AttributeBase<T>`:**

- [ ] `constructor(property: unknown, type: AttributeDefinition, container: AttributeContainer)`.
- [ ] `protected readonly property: unknown`.
- [ ] `protected readonly type: AttributeDefinition`.
- [ ] `protected readonly container: AttributeContainer`.
- [ ] `provided: boolean` (init `false`).
- [ ] `inherited: boolean` (init `false`).
- [ ] `static get mode(): AttributeMode`.
- [ ] `static setMode(mode: AttributeMode): void`.
- [ ] `reset(): void` — escreve `deepClone(type.default)` no container, zera `provided`/`inherited`.
- [ ] `inherit(value: T): void` — `inherited = true`, escreve `deepClone(value)`.
- [ ] `set(value: T): void` — atualiza flag conforme mode, escreve valor.
- [ ] `get(): T` — lê do container.
- [ ] `get value(): T` — alias de `get()`.
- [ ] `get id(): string` — `type.id`.
- [ ] `get name(): string` — `type.name`.
- [ ] `isNil(): boolean` — `null`/`undefined`/Array vazio.
- [ ] `isList(): boolean` — `false` (subclasses sobrescrevem).
- [ ] `to_s(query?: unknown): string` — `String(get())`.
- [ ] `to_num(): number | null` — número ou `null`.
- [ ] `to_sort(): unknown` — número | string | `null`.
- [ ] `to_rti(query: unknown): RichTextIntermediate | null` — retorna `null` por padrão.
- [ ] `to_tjp(): string` — `${type.id} ${get()}`.
- [ ] `protected quotedString(str: string): string` — se contém `\n`, usa `-8<-\n...\n->8-`; senão `"..."` com escapes.

**`ListAttributeBase<T>`:**

- [ ] Estende `AttributeBase<T[]>`.
- [ ] `to_s(): string` — `get().join(', ')`.
- [ ] `isList(): boolean` — `true`.

**Erros:**

- [ ] `NotYetImplementedError extends TjError` — para métodos stub.
- [ ] `AttributeOverwrite extends TjArgumentError`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb` — arquivo completo.
- `docs/tj3-engine/06-blueprint-engine5.md` — §6.3 `markProvided`.

#### Fora de escopo

- Subclasses concretas (6.3+).
- `PropertyTreeNode`/`ScenarioData` (Fase 4) — usamos `MockContainer` nos testes.

#### Critério de aceite

```ts
const container = new MockContainer();
const attr = new StringAttribute("property", def, container);

attr.set("hello");
assertEquals(attr.get(), "hello");
assert(attr.provided);
assert(!attr.inherited);

AttributeBase.setMode(1);
attr.inherit("inherited-value");
assert(attr.inherited);
assertEquals(attr.get(), "inherited-value");
```

#### Testes

- `attribute-base_test.ts`:
  - `describe("AttributeBase")`
    - `it("reset escreve default no container")`.
    - `it("set em mode 0 marca provided")`.
    - `it("set em mode 1 marca inherited")`.
    - `it("set em mode 2 não marca nenhum")`.
    - `it("inherit marca inherited e clona valor")`.
    - `it("isNil para null/undefined/array vazio")`.
    - `it("isList é false")`.
    - `it("to_s para número/string")`.
    - `it("to_num para número")`.
    - `it("to_num para string retorna null")`.
    - `it("quotedString sem newline")`.
    - `it("quotedString com newline usa -8<-")`.
    - `it("quotedString escapa aspas")`.
- `list-attribute-base_test.ts`:
  - `describe("ListAttributeBase")`
    - `it("isList é true")`.
    - `it("to_s junta com vírgula")`.

---

### 6.2 — `AttributeDefinition`

#### Contexto

`AttributeDefinition` é o blueprint imutável de cada atributo. Cada `PropertySet` registra suas definições; cada `PropertyTreeNode` as consulta para criar atributos sob demanda.

Formato da tupla (8 campos):
1. `id: string`
2. `name: string`
3. `objClass: AttributeType` (construtor da subclasse)
4. `inheritedFromParent: boolean`
5. `inheritedFromProject: boolean`
6. `scenarioSpecific: boolean`
7. `default: unknown`
8. `userDefined: boolean` (opcional, default `false`)

#### Objetivo

Implementar `AttributeDefinition` imutável + enum `AttributeType` (identificador do construtor).

#### Arquivos

- `packages/core/src/attributes/attribute-definition.ts`
- `packages/core/src/attributes/attribute-type.ts`
- `packages/core/src/attributes/__test__/attribute-definition_test.ts`

#### Requisitos

- [ ] `AttributeDefinition` com todos os 8 campos `readonly`.
- [ ] `Object.freeze(this)` no construtor.
- [ ] `AttributeType` enum com todos os tipos:
  `AccountAttribute`, `AccountCreditListAttribute`, `AllocationAttribute`, `BookingListAttribute`, `BooleanAttribute`, `ChargeListAttribute`, `ChargeSetListAttribute`, `ColumnListAttribute`, `DateAttribute`, `DefinitionListAttribute`, `DependencyListAttribute`, `DurationAttribute`, `IntegerAttribute`, `FlagListAttribute`, `FloatAttribute`, `FormatListAttribute`, `JournalSortListAttribute`, `TimeIntervalListAttribute`, `LeaveAllowanceListAttribute`, `LeaveListAttribute`, `LimitsAttribute`, `LogicalExpressionAttribute`, `LogicalExpressionListAttribute`, `NodeListAttribute`, `PropertyAttribute`, `RealFormatAttribute`, `ReferenceAttribute`, `ResourceListAttribute`, `RichTextAttribute`, `ScenarioListAttribute`, `ShiftAssignmentsAttribute`, `SortListAttribute`, `StringAttribute`, `SymbolAttribute`, `SymbolListAttribute`, `TaskDepListAttribute`, `TaskListAttribute`, `WorkingHoursAttribute`.
- [ ] `AttributeDefinition` valida `id` (não vazio), `name` (não vazio), `objClass` (definido).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb` — arquivo completo.
- `docs/tj3-engine/02-bluprint-engine1.md` — §2.4.

#### Fora de escopo

- Registro em `PropertySet` — Fase 4.

#### Critério de aceite

```ts
const def = new AttributeDefinition(
  "effort", "Effort", AttributeType.DurationAttribute,
  false, false, true, 0,
);
assert(Object.isFrozen(def));
```

#### Testes

- `attribute-definition_test.ts`:
  - `describe("AttributeDefinition")`
    - `it("armazena todos os campos")`.
    - `it("é imutável após criação")`.
    - `it("rejeita id vazio")`.
    - `it("rejeita name vazio")`.
    - `it("userDefined default false")`.
    - `it("userDefined true quando passado")`.

---

### 6.3 — Atributos escalares e temporais

#### Contexto

Primeiras subclasses concretas. Trivialmente simples mas usadas em todo lugar.

Subclasses: `StringAttribute`, `IntegerAttribute`, `FloatAttribute`, `BooleanAttribute`, `SymbolAttribute`, `DateAttribute`, `DurationAttribute`.

#### Objetivo

Implementar cada atributo com `to_s`, `to_tjp` específicos e `tjpId` estático.

#### Arquivos

- `packages/core/src/attributes/scalar/string-attribute.ts`
- `packages/core/src/attributes/scalar/integer-attribute.ts`
- `packages/core/src/attributes/scalar/float-attribute.ts`
- `packages/core/src/attributes/scalar/boolean-attribute.ts`
- `packages/core/src/attributes/scalar/symbol-attribute.ts`
- `packages/core/src/attributes/scalar/date-attribute.ts`
- `packages/core/src/attributes/scalar/duration-attribute.ts`
- `packages/core/src/attributes/__test__/scalar-attributes_test.ts`

#### Requisitos

**`StringAttribute`:**

- [ ] `tjpId = "text"`.
- [ ] `to_tjp()` → `${id} ${quotedString(get())}`.

**`IntegerAttribute`:**

- [ ] `tjpId = "integer"`.
- [ ] `to_tjp()` herda da base (default).

**`FloatAttribute`:**

- [ ] `tjpId = "number"`.
- [ ] `to_tjp()` → `${id} ${get()}`.

**`BooleanAttribute`:**

- [ ] `tjpId = "boolean"`.
- [ ] `to_s()` → `"true"` / `"false"`.
- [ ] `to_tjp()` → `${id} yes` / `${id} no`.

**`SymbolAttribute`:**

- [ ] `tjpId = "symbol"`.

**`DateAttribute`:**

- [ ] `tjpId = "date"`.
- [ ] `to_s(query?)` → se valor existe, `value.to_s(query?.timeFormat ?? "%Y-%m-%d")`; senão `"Error"`.
- [ ] `to_tjp()` herda da base.
- [ ] Nota: `query` é `unknown` nesta fase (Fase 11 define `Query`).

**`DurationAttribute`:**

- [ ] `tjpId = "duration"`.
- [ ] `to_s(query?)` → se query, `query.scaleDuration(project.slotsToDays(get()))`; senão `get().toString()`.
- [ ] `to_tjp()` → `${id} ${get()}h`.
- [ ] Nota: `query` e `project` são `unknown` nesta fase; o método lança se chamado sem query (comportamento documentado).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes correspondentes.
- `docs/tj3-engine/06-blueprint-engine5.md` — §6.2.

#### Fora de escopo

- `DurationAttribute` com `query` real — Fase 11.

#### Critério de aceite

```ts
const s = new StringAttribute(p, stringDef, c);
s.set("hello\nworld");
assertEquals(s.to_tjp(), `text -8<-\nhello\nworld\n->8-`);

const b = new BooleanAttribute(p, boolDef, c);
b.set(true);
assertEquals(b.to_tjp(), "active yes");

const d = new DateAttribute(p, dateDef, c);
d.set(TjTime.fromString("2026-01-01"));
assertEquals(d.to_s(), "2026-01-01");
```

#### Testes

- `scalar-attributes_test.ts`:
  - `describe("StringAttribute")`
    - `it("to_s")`.
    - `it("to_tjp simples")`.
    - `it("to_tjp multiline")`.
  - `describe("IntegerAttribute")` — `it("to_tjp")`.
  - `describe("FloatAttribute")` — `it("to_tjp")`.
  - `describe("BooleanAttribute")`
    - `it("to_s true/false")`.
    - `it("to_tjp yes/no")`.
  - `describe("SymbolAttribute")` — `it("tjpId")`.
  - `describe("DateAttribute")`
    - `it("to_s com valor")`.
    - `it("to_s sem valor retorna Error")`.
    - `it("respeita timeFormat customizado")`.
  - `describe("DurationAttribute")`
    - `it("to_s sem query")`.
    - `it("to_tjp")`.

---

### 6.4 — Atributos de referência

#### Contexto

Atributos que referenciam outras entidades: `PropertyAttribute`, `AccountAttribute`, `ReferenceAttribute`.

#### Objetivo

Portar os 3 atributos de referência.

#### Arquivos

- `packages/core/src/attributes/reference/property-attribute.ts`
- `packages/core/src/attributes/reference/account-attribute.ts`
- `packages/core/src/attributes/reference/reference-attribute.ts`
- `packages/core/src/attributes/__test__/reference-attributes_test.ts`

#### Requisitos

**`PropertyAttribute`:**

- [ ] `tjpId = "property"`.

**`AccountAttribute`:**

- [ ] `tjpId = "account"`.
- [ ] `to_s()` → `get()?.id ?? ''`.
- [ ] `to_tjp()` → `get()?.id ?? ''`.

**`ReferenceAttribute`:**

- [ ] `tjpId = "reference"`.
- [ ] Valor é `[url, [label]?]`.
- [ ] `url()` → `get()?.[0]`.
- [ ] `label()` → `get()?.[1]?.[0] ?? get()?.[0] ?? null`.
- [ ] `to_s()` → `url() ?? ''`.
- [ ] `to_tjp()` → `${id} "${url}"${label ? ` { label "${label}" }` : ''}`.
- [ ] `to_rti(query)` → lança `NotYetImplementedError` (Fase 12).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — `PropertyAttribute`, `AccountAttribute`, `ReferenceAttribute`.

#### Fora de escopo

- `ReferenceAttribute.to_rti` — Fase 12.

#### Critério de aceite

```ts
const acc = new AccountAttribute(p, def, c);
acc.set({ id: "cost.dev" });
assertEquals(acc.to_s(), "cost.dev");

const ref = new ReferenceAttribute(p, def, c);
ref.set(["http://example.com", ["Example"]]);
assertEquals(ref.to_tjp(), `foo "http://example.com" { label "Example" }`);
```

#### Testes

- `reference-attributes_test.ts`:
  - `describe("AccountAttribute")`
    - `it("to_s com conta")`.
    - `it("to_s sem conta retorna vazio")`.
  - `describe("ReferenceAttribute")`
    - `it("url e label")`.
    - `it("to_s retorna url")`.
    - `it("to_tjp sem label")`.
    - `it("to_tjp com label")`.
    - `it("to_rti lança NotYetImplementedError")`.

---

### 6.5 — Listas simples e de propriedades

#### Contexto

Atributos de lista que armazenam valores primitivos (`FlagList`, `SymbolList`, `ScenarioList`, `NodeList`) ou referências a outras propriedades (`ResourceList`, `TaskList`).

#### Objetivo

Portar 6 atributos de lista.

#### Arquivos

- `packages/core/src/attributes/list/flag-list-attribute.ts`
- `packages/core/src/attributes/list/symbol-list-attribute.ts`
- `packages/core/src/attributes/list/scenario-list-attribute.ts`
- `packages/core/src/attributes/list/node-list-attribute.ts`
- `packages/core/src/attributes/list/resource-list-attribute.ts`
- `packages/core/src/attributes/list/task-list-attribute.ts`
- `packages/core/src/attributes/__test__/list-simple_test.ts`

#### Requisitos

**`FlagListAttribute`:**

- [ ] `tjpId = "flaglist"`.
- [ ] `to_s()` → `get().join(', ')`.
- [ ] `to_tjp()` → `flags ${get().join(', ')}`.

**`SymbolListAttribute`:**

- [ ] `tjpId = "symbollist"`.

**`ScenarioListAttribute`:**

- [ ] `tjpId = "scenarios"`.
- [ ] `to_s()` → `get().join(', ')`.

**`NodeListAttribute`:**

- [ ] Sem `tjpId` explícito.

**`ResourceListAttribute`:**

- [ ] `tjpId = "resourcelist"`.
- [ ] `to_s()` → `get().map(r => r.fullId).join(', ')`.
- [ ] `to_tjp()` → `${id} ${get().map(r => r.fullId).join(', ')}`.
- [ ] `to_rti(query)` → lança `NotYetImplementedError` (Fase 12).

**`TaskListAttribute`:**

- [ ] `tjpId = "tasklist"`.
- [ ] `to_s()` → `get().map(t => t.fullId).join(', ')`.
- [ ] `to_tjp()` → idem.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes correspondentes.

#### Fora de escopo

- `ResourceListAttribute.to_rti` — Fase 12.

#### Critério de aceite

```ts
const fl = new FlagListAttribute(p, def, c);
fl.set(["critical", "urgent"]);
assertEquals(fl.to_tjp(), "flags critical, urgent");
assertEquals(fl.isList(), true);
```

#### Testes

- `list-simple_test.ts`:
  - `describe("FlagListAttribute")`
    - `it("to_s")`, `it("to_tjp")`, `it("isList true")`.
  - `describe("SymbolListAttribute")` — `it("tjpId")`.
  - `describe("ScenarioListAttribute")` — `it("to_s")`.
  - `describe("ResourceListAttribute")`
    - `it("to_s junta fullIds")`.
    - `it("to_rti lança")`.
  - `describe("TaskListAttribute")` — `it("to_s junta fullIds")`.

---

### 6.6 — Dependências (`DependencyListAttribute`, `TaskDepListAttribute`)

#### Contexto

Atributos que armazenam dependências entre tarefas.

`DependencyListAttribute` — lista de `TaskDependency` (com `task`, `onEnd`, `gapDuration`, `gapLength`).

`TaskDepListAttribute` — lista de tuplas `[task, onEnd]` (usada em `startpreds`, `startsuccs`, etc.).

**Nota:** `TaskDependency` é da Fase 7. Nesta fase, usamos `unknown` no tipo e só implementamos `to_s`/`to_tjp` que acessam `.task.fullId`.

#### Objetivo

Portar os 2 atributos.

#### Arquivos

- `packages/core/src/attributes/list/dependency-list-attribute.ts`
- `packages/core/src/attributes/list/task-dep-list-attribute.ts`
- `packages/core/src/attributes/__test__/dependency-attributes_test.ts`

#### Requisitos

**`DependencyListAttribute`:**

- [ ] `tjpId = "dependencylist"`.
- [ ] `to_s()` → `get().filter(d => d.task).map(d => d.task.fullId).join(', ')`.
- [ ] `to_tjp()` → `${id} ${get().map(d => d.task.fullId).join(', ')}`.

**`TaskDepListAttribute`:**

- [ ] `tjpId = "taskdeplist"`.
- [ ] `to_s()` → `get().map(([t, _]) => t.fullId).join(', ')`.
- [ ] `to_tjp()` → idem.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes correspondentes.

#### Fora de escopo

- `TaskDependency` — Fase 7.

#### Critério de aceite

```ts
const dl = new DependencyListAttribute(p, def, c);
dl.set([
  { task: { fullId: "t1" }, onEnd: true },
  { task: { fullId: "t2" }, onEnd: false },
]);
assertEquals(dl.to_s(), "t1, t2");
```

#### Testes

- `dependency-attributes_test.ts`:
  - `describe("DependencyListAttribute")`
    - `it("to_s com task")`.
    - `it("to_s filtra task null")`.
    - `it("to_tjp")`.
  - `describe("TaskDepListAttribute")`
    - `it("to_s")`.
    - `it("to_tjp")`.

---

### 6.7 — Financeiro (`ChargeListAttribute`, `ChargeSetListAttribute`, `AccountCreditListAttribute`)

#### Contexto

Atributos financeiros que referenciam `Charge`, `ChargeSet` e `AccountCredit` (Fase 8).

Nesta fase, os tipos são `unknown`; só implementamos métodos que acessam campos estáveis (`to_s` de `ChargeSetList` usa `.to_s` do próprio `ChargeSet`).

#### Objetivo

Portar os 3 atributos.

#### Arquivos

- `packages/core/src/attributes/list/charge-list-attribute.ts`
- `packages/core/src/attributes/list/charge-set-list-attribute.ts`
- `packages/core/src/attributes/list/account-credit-list-attribute.ts`
- `packages/core/src/attributes/__test__/financial-attributes_test.ts`

#### Requisitos

**`ChargeListAttribute`:**

- [ ] `tjpId = "charge"`.
- [ ] `to_s()` → `get().join(', ')`.
- [ ] `to_tjp()` herda da base (default).

**`ChargeSetListAttribute`:**

- [ ] `tjpId = "chargeset"`.
- [ ] `to_s()` → `get().map(i => i.to_s()).join(', ')`.
- [ ] `to_tjp()` → `${id} ${get().map(i => i.to_s()).join(', ')}`.

**`AccountCreditListAttribute`:**

- [ ] `tjpId = "credits"`.
- [ ] Constructor inicializa `set([])` (default é Array vazio).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes correspondentes.
- `docs/tj3-engine/10-blueprint-finance.md` — contexto financeiro.

#### Fora de escopo

- `Charge`, `ChargeSet`, `AccountCredit` — Fase 8.

#### Critério de aceite

```ts
const csl = new ChargeSetListAttribute(p, def, c);
csl.set([{ to_s: () => "cost.dev 70%, cost.infra 30%" }]);
assertEquals(csl.to_s(), "cost.dev 70%, cost.infra 30%");
```

#### Testes

- `financial-attributes_test.ts`:
  - `describe("ChargeListAttribute")` — `it("to_s")`.
  - `describe("ChargeSetListAttribute")`
    - `it("to_s chama to_s de cada")`.
    - `it("to_tjp")`.
  - `describe("AccountCreditListAttribute")`
    - `it("default é array vazio")`.

---

### 6.8 — Alocação e booking (`AllocationAttribute`, `BookingListAttribute`)

#### Contexto

`AllocationAttribute` — lista de `Allocation` (Fase 7). `to_s` complexo com seleção de modo.

`BookingListAttribute` — lista de `Booking` (Fase 7). `to_s` junta `.to_s()`; `to_tjp` lança (é caso especial).

#### Objetivo

Portar os 2 atributos.

#### Arquivos

- `packages/core/src/attributes/list/allocation-attribute.ts`
- `packages/core/src/attributes/list/booking-list-attribute.ts`
- `packages/core/src/attributes/__test__/allocation-attributes_test.ts`

#### Requisitos

**`AllocationAttribute`:**

- [ ] `tjpId = "allocation"`.
- [ ] `to_s()`:
  - Itera `get()`.
  - Para cada allocation: `[ id1, id2 ] select by <mode> [mandatory] [persistent]`.
  - Modos: `order`, `lowprob`, `lowload`, `hiload`, `random`.
- [ ] `to_tjp()` — lança `NotYetImplementedError` (comentário `# TODO: incomplete` no Ruby).

**`BookingListAttribute`:**

- [ ] `tjpId = "bookinglist"`.
- [ ] `to_s()` → `get().map(b => b.to_s()).join(', ')`.
- [ ] `to_tjp()` → lança `NotYetImplementedError` (Ruby: `raise "Don't call this method..."`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes.
- `docs/taskjuggler/lib/taskjuggler/Allocation.rb`.

#### Fora de escopo

- `Allocation`, `Booking` — Fase 7.

#### Critério de aceite

```ts
const al = new AllocationAttribute(p, def, c);
al.set([{
  candidates: [{ fullId: "r1" }, { fullId: "r2" }],
  selectionMode: 1,
  mandatory: false,
  persistent: true,
}]);
assertEquals(al.to_s(), "[ r1, r2 ] select by lowprob  persistent ");
```

#### Testes

- `allocation-attributes_test.ts`:
  - `describe("AllocationAttribute")`
    - `it("to_s com 1 candidato")`.
    - `it("to_s com 2 candidatos")`.
    - `it("to_s com mandatory")`.
    - `it("to_s com persistent")`.
    - `it("to_tjp lança")`.
  - `describe("BookingListAttribute")`
    - `it("to_s")`.
    - `it("to_tjp lança")`.

---

### 6.9 — Expressões lógicas (`LogicalExpressionAttribute`, `LogicalExpressionListAttribute`)

#### Contexto

Atributos que armazenam `LogicalExpression` (Fase 11). Nesta fase, são wrappers triviais; só implementamos os campos e `tjpId`.

#### Objetivo

Portar os 2 atributos.

#### Arquivos

- `packages/core/src/attributes/logical/logical-expression-attribute.ts`
- `packages/core/src/attributes/logical/logical-expression-list-attribute.ts`
- `packages/core/src/attributes/__test__/logical-attributes_test.ts`

#### Requisitos

**`LogicalExpressionAttribute`:**

- [ ] `tjpId = "logicalexpressions"`.
- [ ] Estende `AttributeBase<unknown>`.

**`LogicalExpressionListAttribute`:**

- [ ] `tjpId = "logicalexpressions"`.
- [ ] Estende `ListAttributeBase<unknown>`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes.

#### Fora de escopo

- `LogicalExpression`, `LogicalOperation` — Fase 11.

#### Critério de aceite

```ts
const la = new LogicalExpressionAttribute(p, def, c);
assertEquals(la.tjpId, "logicalexpressions");
```

#### Testes

- `logical-attributes_test.ts`:
  - `describe("LogicalExpressionAttribute")` — `it("tjpId")`.
  - `describe("LogicalExpressionListAttribute")` — `it("isList true")`.

---

### 6.10 — Tempo complexo (TimeIntervalList, LeaveList, LeaveAllowanceList, Limits, ShiftAssignments, WorkingHours)

#### Contexto

Atributos que referenciam classes da Fase 6/7/16.

**Nota:** alguns dependem de `Leave`, `Limits`, `ShiftAssignments` que **não existem ainda**. Implementamos apenas os wrappers triviais; os métodos complexos (`to_tjp` do `WorkingHoursAttribute`, `LimitsAttribute`, `ShiftAssignmentsAttribute`) ficam para as fases correspondentes.

#### Objetivo

Portar os 6 atributos com comportamento mínimo.

#### Arquivos

- `packages/core/src/attributes/time/time-interval-list-attribute.ts`
- `packages/core/src/attributes/time/leave-list-attribute.ts`
- `packages/core/src/attributes/time/leave-allowance-list-attribute.ts`
- `packages/core/src/attributes/time/limits-attribute.ts`
- `packages/core/src/attributes/time/shift-assignments-attribute.ts`
- `packages/core/src/attributes/time/working-hours-attribute.ts`
- `packages/core/src/attributes/__test__/time-attributes_test.ts`

#### Requisitos

**`TimeIntervalListAttribute`:**

- [ ] `tjpId = "intervallist"`.
- [ ] `to_s()` → `get().map(i => i.to_s()).join(', ')`.
- [ ] `to_tjp()` → idem.

**`LeaveListAttribute`:**

- [ ] `tjpId = "leave"`.
- [ ] `to_tjp()` → `leaves ${get().join(",\n")}`.
- [ ] **Nota:** `Leave` é da Fase 16; tipo é `unknown` nesta fase.

**`LeaveAllowanceListAttribute`:**

- [ ] Sem `tjpId`.
- [ ] Estende `ListAttributeBase<unknown>`.

**`LimitsAttribute`:**

- [ ] `tjpId = "limits"`.
- [ ] Constructor: se `get()` existe, chama `value.setProject(property.project)`.
- [ ] `to_tjp()` → lança `NotYetImplementedError` (Fase 7).

**`ShiftAssignmentsAttribute`:**

- [ ] `tjpId = "shifts"`.
- [ ] Constructor: se `get()` existe, seta `value.project = property.project`.
- [ ] `to_tjp()` → lança `NotYetImplementedError` (Fase 7).

**`WorkingHoursAttribute`:**

- [ ] `tjpId = "workinghours"`.
- [ ] `to_tjp()` → itera 7 dias; chama `get().getWorkingHours(day)`; formata intervalos.
- [ ] **Nota:** `WorkingHours` **existe** (Fase 2). Podemos implementar `to_tjp` completamente.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes.
- `docs/taskjuggler/lib/taskjuggler/WorkingHours.rb` — `getWorkingHours`.

#### Fora de escopo

- `Limits`, `ShiftAssignments`, `Leave` — Fases 6, 7, 16.

#### Critério de aceite

```ts
const wha = new WorkingHoursAttribute(p, def, c);
const wh = new WorkingHours(3600, start, end, "UTC");
wh.setWorkingHours(1, [[32400, 61200]]);
wha.set(wh);
assert(wha.to_tjp().includes("workinghours mon 9:00 - 17:00"));
```

#### Testes

- `time-attributes_test.ts`:
  - `describe("TimeIntervalListAttribute")` — `it("to_s")`.
  - `describe("LeaveListAttribute")` — `it("tjpId")`.
  - `describe("LimitsAttribute")`
    - `it("constructor chama setProject se valor existe")`.
    - `it("to_tjp lança")`.
  - `describe("ShiftAssignmentsAttribute")`
    - `it("constructor seta project")`.
    - `it("to_tjp lança")`.
  - `describe("WorkingHoursAttribute")`
    - `it("to_tjp com 1 dia")`.
    - `it("to_tjp com off")`.
    - `it("to_tjp com múltiplos intervalos")`.

---

### 6.11 — Formatação e colunas (RealFormat, ColumnList, FormatList, SortList, JournalSortList)

#### Contexto

Atributos usados em reports para formatação e ordenação.

#### Objetivo

Portar os 5 atributos.

#### Arquivos

- `packages/core/src/attributes/format/real-format-attribute.ts`
- `packages/core/src/attributes/format/column-list-attribute.ts`
- `packages/core/src/attributes/format/format-list-attribute.ts`
- `packages/core/src/attributes/format/sort-list-attribute.ts`
- `packages/core/src/attributes/format/journal-sort-list-attribute.ts`
- `packages/core/src/attributes/__test__/format-attributes_test.ts`

#### Requisitos

**`RealFormatAttribute`:**

- [ ] Sem `tjpId` explícito.
- [ ] Estende `AttributeBase<RealFormat>`.

**`ColumnListAttribute`:**

- [ ] `tjpId = "columns"`.
- [ ] `to_s()` → lança `NotYetImplementedError` (Ruby: `"TODO"`).

**`FormatListAttribute`:**

- [ ] Sem `tjpId`.
- [ ] `to_s()` → `get().join(', ')`.

**`SortListAttribute`:**

- [ ] `tjpId = "sorting"`.
- [ ] Estende `ListAttributeBase<unknown>`.

**`JournalSortListAttribute`:**

- [ ] `tjpId = "journalsorting"`.
- [ ] Estende `ListAttributeBase<unknown>`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes.

#### Fora de escopo

- Reports — Fase 14.

#### Critério de aceite

```ts
const fla = new FormatListAttribute(p, def, c);
fla.set(["csv", "html"]);
assertEquals(fla.to_s(), "csv, html");
```

#### Testes

- `format-attributes_test.ts`:
  - `describe("RealFormatAttribute")` — `it("armazena RealFormat")`.
  - `describe("ColumnListAttribute")`
    - `it("tjpId")`.
    - `it("to_s lança")`.
  - `describe("FormatListAttribute")` — `it("to_s")`.
  - `describe("SortListAttribute")` — `it("tjpId")`.
  - `describe("JournalSortListAttribute")` — `it("tjpId")`.

---

### 6.12 — Ricos (`RichTextAttribute`, `DefinitionListAttribute`)

#### Contexto

`RichTextAttribute` armazena `RichTextIntermediate` (Fase 12). Nesta fase, definimos a interface de port e o wrapper.

`DefinitionListAttribute` é um `ListAttributeBase` sem lógica específica.

#### Objetivo

Portar os 2 atributos com interface de port.

#### Arquivos

- `packages/core/src/format/rich-text-port.ts` (novo — interfaces)
- `packages/core/src/attributes/rich/rich-text-attribute.ts`
- `packages/core/src/attributes/list/definition-list-attribute.ts`
- `packages/core/src/attributes/__test__/rich-attributes_test.ts`

#### Requisitos

**`rich-text-port.ts`:**

- [ ] Interface `RichTextIntermediate` (métodos usados por atributos).
- [ ] Interface `RichTextFactory` (opcional, não usada nesta fase).

**`RichTextAttribute`:**

- [ ] `tjpId = "richtext"`.
- [ ] `inputText(): string` → `get()?.richText.inputText ?? ''`.
- [ ] `to_s()` → `get()?.to_s() ?? ''`.
- [ ] `to_tjp()` → `${id} ${quotedString(get().richText.inputText)}`.

**`DefinitionListAttribute`:**

- [ ] Estende `ListAttributeBase<unknown>` (sem `tjpId`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Attributes.rb` — classes.
- `docs/tj3-engine/06-blueprint-engine5.md` — §6.2 `RichTextAttribute`.

#### Fora de escopo

- `RichText` real — Fase 12.

#### Critério de aceite

```ts
const rta = new RichTextAttribute(p, def, c);
rta.set({
  richText: { inputText: "Hello world" },
  to_s: () => "Hello world",
});
assertEquals(rta.inputText(), "Hello world");
assertEquals(rta.to_tjp(), `note "Hello world"`);
```

#### Testes

- `rich-attributes_test.ts`:
  - `describe("RichTextAttribute")`
    - `it("inputText com valor")`.
    - `it("inputText sem valor retorna vazio")`.
    - `it("to_s")`.
    - `it("to_tjp")`.
    - `it("to_tjp multiline")`.
  - `describe("DefinitionListAttribute")` — `it("isList true")`.

---

### 6.13 — `deepClone` utility

#### Contexto

Ruby usa `Object#deep_clone` (custom, em `deep_copy.rb`). Em TS, implementamos uma função standalone.

#### Objetivo

Implementar `deepClone<T>` e testar exaustivamente.

#### Arquivos

- `packages/core/src/utils/deep-clone.ts`
- `packages/core/tests/utils/deep-clone_test.ts`

#### Requisitos

- [ ] `export function deepClone<T>(value: T): T`.
- [ ] Regras:
  - `null`/`undefined` → retorna valor.
  - Primitivos (`number`, `string`, `boolean`, `bigint`, `symbol`) → retorna valor.
  - `TjTime` → retorna `value` (imutável, mas checagem explícita).
  - `RealFormat` → retorna `value`.
  - Objetos com método `deepClone()` → chama o método.
  - Objetos com `deep_clone()` (compatibilidade Ruby) → chama o método.
  - `Array` → recursivo em cada elemento.
  - `Map` → novo `Map` com valores clonados.
  - `Set` → novo `Set` com valores clonados.
  - Fallback → `structuredClone(value)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/deep_copy.rb` — arquivo completo.

#### Fora de escopo

- Objetos circulares — aceito como limitação (`structuredClone` lança).

#### Critério de aceite

```ts
assertEquals(deepClone(42), 42);
assertEquals(deepClone("hello"), "hello");

const arr = [1, 2, [3, 4]];
const cloned = deepClone(arr);
assertNotSame(cloned, arr);
assertNotSame(cloned[2], arr[2]);

class WithDeepClone {
  deepClone(): WithDeepClone { return new WithDeepClone(); }
}
const obj = new WithDeepClone();
assertNotSame(deepClone(obj), obj);
```

#### Testes

- `deep-clone_test.ts`:
  - `describe("deepClone")`
    - `it("retorna primitivos")`.
    - `it("clona array raso")`.
    - `it("clona array aninhado")`.
    - `it("clona Map")`.
    - `it("clona Set")`.
    - `it("chama deepClone se existir")`.
    - `it("chama deep_clone se existir")`.
    - `it("fallback para structuredClone")`.
    - `it("retorna mesmo TjTime")`.
    - `it("retorna mesmo RealFormat")`.

---

### 6.14 — Infraestrutura de golden tests (attributes)

#### Contexto

Similar à Fase 2, usamos `tj3` para gerar referências. Aqui o foco é herança e propagação de cenários.

#### Objetivo

Criar `scripts/golden/attributes.rb` que gera um JSON com:
- Projeto com 3 níveis de tasks (parent → child → grandchild).
- Atributos herdados do projeto.
- Atributos scenario-specific.
- Default values.

O teste TS instancia os mesmos atributos e verifica `provided`/`inherited`/`get()`.

**Limitação:** `PropertyTreeNode` e `ScenarioData` são da Fase 4. Nesta fase, o golden test valida apenas o **estado interno** dos atributos (via MockContainer que rastreia qual id foi escrito).

#### Arquivos

- `scripts/golden/attributes.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/attributes.golden.json` (gerado)
- `packages/core/tests/golden/attributes_golden_test.ts`
- `deno.jsonc` — atualizar task `golden:generate`

#### Requisitos

**Script Ruby:**

- [ ] Importa `AttributeBase`, `AttributeDefinition`, `Attributes` da gem.
- [ ] Gera casos como:
  ```json
  {
    "cases": [
      {
        "description": "StringAttribute default vazio",
        "type": "StringAttribute",
        "default": "",
        "operations": [
          { "op": "get", "expected": "" },
          { "op": "set", "value": "hello", "mode": 0 },
          { "op": "get", "expected": "hello", "provided": true }
        ]
      },
      {
        "description": "IntegerAttribute herança de parent",
        "type": "IntegerAttribute",
        "default": 0,
        "operations": [
          { "op": "setMode", "value": 1 },
          { "op": "inherit", "value": 500 },
          { "op": "get", "expected": 500, "inherited": true }
        ]
      }
    ]
  }
  ```

**Teste TS:**

- [ ] Lê o JSON.
- [ ] Para cada caso: instancia o atributo correspondente, executa operações, compara `get()`, `provided`, `inherited`.
- [ ] Cobertura mínima: 40 casos.

**Task `golden:generate`:**

- [ ] Adicionar `ruby scripts/golden/attributes.rb > packages/core/tests/golden/attributes.golden.json`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb`.
- `docs/taskjuggler/lib/taskjuggler/Attributes.rb`.
- Fase 2, subfase 5.14 — infraestrutura base.

#### Fora de escopo

- Golden test de `PropertyTreeNode` — Fase 4.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- JSON com ≥ 40 casos.
- Todos os golden tests passam.

#### Testes

- `attributes_golden_test.ts`:
  - `describe("Golden attributes")` — itera casos.

---

## 6. Ordem de execução sugerida

```text
6.0  ADR 013
      ↓
6.13 deepClone utility        ← pode ser feito cedo, é independente
      ↓
6.1  AttributeBase + ListAttributeBase
      ↓
6.2  AttributeDefinition
      ↓
6.3  Escalares e temporais
      ↓
6.4  Referências
      ↓
6.5  Listas simples e de propriedades
      ↓
6.6  Dependências
      ↓
6.7  Financeiro
      ↓
6.8  Alocação e booking
      ↓
6.9  Expressões lógicas
      ↓
6.10 Tempo complexo
      ↓
6.11 Formatação
      ↓
6.12 Ricos
      ↓
6.14 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 3 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `AttributeBase`, `ListAttributeBase`, `AttributeDefinition`, `AttributeOverwrite` implementados.
- [ ] ~40 subclasses de atributo implementadas.
- [ ] `deepClone` utility implementada.
- [ ] Interface `AttributeContainer` definida.
- [ ] Interface `RichTextIntermediate` definida (port).
- [ ] **≥ 120 testes unitários**.
- [ ] **≥ 40 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] ADR 013 criado.
- [ ] `scripts/golden/attributes.rb` funcional.
- [ ] `scripts/golden/README.md` atualizado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `mode` global causa bugs sutis em testes | Alto | `beforeEach`/`afterEach` resetando `AttributeBase.setMode(0)` |
| Subclasses de atributo duplicam lógica | Médio | Revisar agrupamento antes de implementar |
| `to_rti` stubs impedem testes completos | Médio | Documentar fases que completam; testar que lançam |
| Interfaces de port divergem do `RichText` real | Médio | Revisar `rich-text-port.ts` na Fase 12 |
| `WorkingHoursAttribute.to_tjp` diverge do Ruby | Médio | Golden test contra Ruby |
| `deepClone` de objetos com referências circulares | Baixo | Aceito; documentado |
| `AttributeDefinition` precisa de acesso a `project` | Médio | Adiar — Fase 4 define `PropertySet` |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb`
- `docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb`
- `docs/taskjuggler/lib/taskjuggler/Attributes.rb`
- `docs/taskjuggler/lib/taskjuggler/deep_copy.rb`

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.3, §2.4, §3.3
- `docs/tj3-engine/06-blueprint-engine5.md` — §6

### Documentos do projeto

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/013-attribute-mode-global.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 4 — Árvore de Propriedades** (usa `AttributeDefinition`, `AttributeBase`, `AttributeContainer`).
- **Fase 5 — Entidades Concretas** (define os `AttributeDefinition`s por entidade).
- **Fase 6 — Scoreboard e Estruturas Base** (completa `LimitsAttribute`, `ShiftAssignmentsAttribute`).
- **Fase 7 — Scheduler** (usa `Allocation`, `Booking`, `TaskDependency`).
- **Fase 11 — Query** (usa `LogicalExpressionAttribute`).
- **Fase 12 — RichText** (completa `RichTextAttribute.to_rti`).

---

## 10. Notas para a IA

1. **`mode` global é resetado por testes.** Sempre `beforeEach(() => AttributeBase.setMode(0))`.
2. **Métodos `to_rti` que dependem de fases futuras lançam `NotYetImplementedError`.** Não tentar implementar com stubs frágeis.
3. **`AttributeDefinition` é imutável.** Nunca modificar após criação.
4. **`tjpId` é `static readonly`.** Nunca instância.
5. **`deepClone` é função pura.** Sem `this`. Sem efeitos colaterais.
6. **Testes de golden usam o Ruby original.** Se divergir, **corrigir o TS**, não o golden.
7. **Não otimizar.** ~40 subclasses pequenas são OK; performance vem do `DataCache` (Fase 9).
8. **Sem `any`.** Usar `unknown` e narrowing.
9. **Commit por subfase.** `feat(core): attributes/<tipo>`.
10. **Interfaces de port** (`RichTextIntermediate`) ficam em `format/` e não em `attributes/`.

---

## 11. ADR 013 (referência rápida)

Criado como subfase 6.0. Conteúdo esperado:

- **Título:** Attribute mode global em TypeScript
- **Contexto:** `@@mode` class variable em Ruby.
- **Decisão:** `static` em `AttributeBase`, com getter/setter.
- **Alternativas:** `AsyncLocalStorage`, context-passing.
- **Consequências:** simplicidade + paridade; sem concorrência entre projetos no mesmo worker.

---

**Fim da Fase 3.**