# Fase 17 — HTML/XML

> **Arquivo:** `docs/syntaxmesh/fases/fase-17-html-xml.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 6–8 dias
> **Depende de:** Fases 12, 14, 15
> **Bloqueia:** Fases 20, 21

---

## 1. Contexto

Esta fase substitui as **implementações mínimas** de HTML/XML introduzidas nas fases 12 e 14 por versões completas e fiéis ao Ruby.

### O que foi feito nas fases anteriores

- **Fase 12** introduziu `XMLElementLike` (interface) + `SimpleXMLElement` (implementação mínima) para permitir que `RichText` gerasse HTML.
- **Fase 14** introduziu `HTMLDocument` mínimo + `ICalendar` mínimo + `Painter` mínimo (para `ChartPlotter`).
- **Fase 15** usou `XMLElementLike` para gerar o Gantt.

### O que esta fase completa

1. **`XMLElement` real** — implementação completa com `escape`, `to_s(indent)`, `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`. Substitui `SimpleXMLElement`.

2. **`XMLDocument`** — container de `XMLElement`s com `to_s` e `write`.

3. **`HTMLDocument`** — especialização para HTML5/XHTML. `generateHead` completo com meta tags, charset, compatibilidade.

4. **`HTMLElements`** — classes dinâmicas para todas as tags HTML (`DIV`, `P`, `A`, `TABLE`, `TR`, `TD`, `H1`-`H6`, etc.). Usadas por `RichText`, `HTMLDocument`, reports.

5. **`ICalendar` completo** — implementação fiel do RFC 5545 com `Todo`, `Event`, `Journal`, `Person`, `foldLines`, timezone UTC.

6. **`Painter` completo** — biblioteca de desenho vetorial (SVG). Usado por `ChartPlotter`. Inclui `Color`, `Points`, `Element`, `Group`, `Circle`, `Ellipse`, `Line`, `Rect`, `PolyLine`, `Text`.

### Por que importa

- **Gantt** (Fase 15) usa `XMLElementLike`. Após Fase 17, pode usar `XMLElement` real.
- **RichText** (Fase 12) gera HTML. Após Fase 17, gera `XMLElement` real.
- **Reports** (Fase 14) usam `HTMLDocument`. Após Fase 17, saída HTML é fiel ao Ruby.
- **ChartPlotter** (Fase 14) usa `Painter` mínimo. Após Fase 17, gera SVG completo.

### Substituição transparente

A interface `XMLElementLike` (Fase 12) permanece. `XMLElement` real a implementa. Substituição é **sem quebrar**.

---

## 2. Objetivo

Ao final desta fase:

- `XMLElement`, `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`.
- `XMLDocument`.
- `HTMLDocument` completo.
- `HTMLElements` (todas as tags).
- `ICalendar`, `Todo`, `Event`, `Journal`, `Person` completos.
- `Painter` completo (`Color`, `Points`, `Element`, `Group`, `Primitives`, `Circle`, `Ellipse`, `Line`, `Rect`, `PolyLine`, `Text`, `FontMetrics`, `FontMetricsData`, `SVGSupport`).
- **Substituição** de `SimpleXMLElement` por `XMLElement` real.
- **Substituição** de `HTMLDocument` mínimo por versão completa.
- **Substituição** de `ICalendar` mínimo por versão completa.
- **Substituição** de `Painter` mínimo por versão completa.
- **≥ 220 testes unitários** + **≥ 30 golden tests** (HTML/XML/sVG snapshots).
- ADR 028 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `XMLElement.rb` | ~250 | Média | **Crítica** |
| `XMLDocument.rb` | ~70 | Trivial | **Crítica** |
| `HTMLDocument.rb` | ~120 | Baixa | **Crítica** |
| `HTMLElements.rb` | ~80 | Baixa | **Crítica** |
| `ICalendar.rb` | ~330 | Média | Alta |
| `Painter.rb` | ~80 | Baixa | Média |
| `Painter/Color.rb` | ~250 | Média | Média |
| `Painter/Points.rb` | ~50 | Trivial | Média |
| `Painter/Element.rb` | ~80 | Baixa | Média |
| `Painter/Group.rb` | ~80 | Baixa | Média |
| `Painter/Primitives.rb` | ~130 | Baixa | Média |
| `Painter/BasicShapes.rb` | ~130 | Baixa | Média |
| `Painter/Text.rb` | ~30 | Trivial | Média |
| `Painter/SVGSupport.rb` | ~30 | Trivial | Média |
| `Painter/FontMetrics.rb` | ~200 | Média | Média |
| `Painter/FontMetricsData.rb` | ~250 | **Alta** | Média |
| `Painter/FontData.rb` | ~1000 | Trivial (dados) | Média |

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.6, §3 | Uso de XML |
| `docs/tj3-engine/14-blueprint-others.md` | §1-2 | HTML/XML |
| `docs/tj3-engine/15-blueprint-others.md` | (referências) | — |

### 3.3 Casos de teste

- `docs/Learning/mwe001-009/` — reports com HTML.
- `docs/taskjuggler/test/TestSuite/Reports/` — casos.

### 3.4 Golden tests

Scripts Ruby que geram HTML/XML/SVG via `tj3` e comparam byte-a-byte (normalizado).

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 `XMLElement` — substituir `SimpleXMLElement`

A interface `XMLElementLike` (Fase 12) permanece. `XMLElement` a implementa. Substituição é transparente.

**Importante:** `SimpleXMLElement` será **removido** após migração. Todos os imports apontam para `XMLElement`.

### 4.2 `XMLElement.to_s(indent)` — formatação com indentação

A formatação é **sensível a detalhes**:
- `<tag attr1="v1" attr2="v2">`.
- Ordenação de atributos (do Ruby: `keys.sort`).
- Escapes: `&`, `"` em atributos; `&`, `<`, `>` em conteúdo.
- Indentação com 2 espaços por nível.
- `selfClosing` se sem filhos.

Replicar **fielmente**.

### 4.3 `XMLText` — não escapa `>`?

Ruby `XMLText.to_s` escapa `&`, `<`, `>` mas **não escapa `"`** (não é atributo). Replicar.

### 4.4 `XMLComment` — canonicalize `--`

Ruby canonicaliza `--` em `-\-` (comentários XML não podem ter `--`). Replicar.

### 4.5 `HTMLElements` — classes dinâmicas

Ruby usa `class_eval` para gerar classes `HTML`, `HEAD`, `BODY`, `DIV`, `P`, `A`, `TABLE`, etc. Em TS, gerar via `Object.defineProperty` ou map estático.

**Decisão:** map estático de classes:

```ts
export const H1 = createHTMLElementClass('h1');
export const H2 = createHTMLElementClass('h2');
// ...
```

### 4.6 `HTMLDocument` — 4 doctypes

`html5`, `strict`, `transitional`, `frameset`. Cada um com header diferente.

### 4.7 `HTMLDocument.generateHead` — meta tags

Ordem:
1. `<title>`.
2. `<meta http-equiv="Content-Type">`.
3. `<meta http-equiv="X-UA-Compatible" content="IE=9">`.
4. Meta tags customizadas (do `metaTags`).
5. Blob (rawHtmlHead).

### 4.8 `ICalendar` — RFC 5545

Detalhes:
- Linhas com `\r\n`.
- `foldLines` para linhas > 75 octetos.
- Escapes: `;`, `,`, `"`, `\`, `\n` em strings.
- `dateTime` formato `YYYYMMDDTHHMMSSZ`.
- `Person`, `Todo`, `Event`, `Journal`.

### 4.9 `Painter` — SVG

`Painter` é uma biblioteca de desenho vetorial que gera SVG. Estrutura:
- `Painter.new(width, height, block)`.
- `to_svg()`.

**Elementos:** `Circle`, `Ellipse`, `Line`, `Rect`, `PolyLine`, `Text`, `Group`.

**Cores:** `Color` (RGB, HSV, nomeadas).

**Fontes:** `FontMetrics` + `FontMetricsData` (métricas de largura/altura de glifos e kerning).

### 4.10 `FontData.rb` — dados pré-computados

`FontData.rb` tem ~1000 linhas de dados de fontes (`LiberationSans`). Copiar como constantes TS.

### 4.11 `FontMetrics` — computa width/height

`FontMetricsData` guarda char widths + kerning delta. `FontMetrics` usa para computar largura de strings.

### 4.12 `Color` — RGB, HSV, nomeadas

`NamedColors` (155 cores). `to_rgb`, `to_hsv`, `to_s` (hex).

### 4.13 `Points` — lista de coordenadas

`Points.new(arr)` + `to_s()`.

### 4.14 `Group` — agrupa elementos com atributos comuns

`Group.new(values, block)`.

### 4.15 `SVGSupport` — valores → SVG attrs

Converte chaves (`fill`, `stroke`, `font_family`) em atributos SVG (`fill`, `stroke`, `font-family`).

### 4.16 `Primitives` — helpers de desenho

`group`, `circle`, `ellipse`, `line`, `polyline`, `rect`, `text`, `color`, `points`.

### 4.17 SVG vs Canvas

Decisão: SVG (mesmo do Ruby). Compatível com `Painter`.

### 4.18 Browser: ICalendar write

`ICalendar.to_s()` retorna string. `write()` retorna string em vez de escrever arquivo.

### 4.19 `HTMLElements` — dependência de `XMLElement`

`HTMLElements` gera classes que herdam de `XMLElement`. Implementar após `XMLElement`.

---

## 5. Subfases detalhadas

**Bloco A — XML** (21.0–21.4)
**Bloco B — HTML** (21.5–21.7)
**Bloco C — ICalendar** (21.8–21.9)
**Bloco D — Painter** (21.10–21.15)
**Bloco E — Substituição e integração** (21.16–21.17)
**Bloco F — Golden tests** (21.18)

---

### Bloco A — XML

---

### 21.0 — ADR 028 (substituição de XML mínimo)

#### Contexto

A Fase 12 introduziu `XMLElementLike` + `SimpleXMLElement` para permitir que `RichText` funcionasse. A Fase 14 fez o mesmo para `HTMLDocument`. A Fase 15 usou `XMLElementLike`.

Agora substituímos por implementações completas. Isso precisa ser registrado.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/028-substituicao-xml.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/028-substituicao-xml.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** `XMLElementLike` introduzida na Fase 12 por compatibilidade.
- [ ] **Decisões:**
  - `XMLElement` real implementa `XMLElementLike`.
  - `SimpleXMLElement` removido.
  - Todos os imports atualizados.
  - Contratos de saída HTML/SVG/XML mantidos.
- [ ] **Alternativas:** manter `SimpleXMLElement` (duplicação).
- [ ] **Consequências:** fidelidade ao Ruby; refatoração de imports.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- Fase 12 — `XMLElementLike`.
- `docs/taskjuggler/lib/taskjuggler/XMLElement.rb`.

#### Critério de aceite

- ADR 028 criado.
- Tabela atualizada.

---

### 21.1 — `XMLElement`

#### Contexto

O bloco fundamental de geração de XML/HTML. Substitui `SimpleXMLElement`.

#### Objetivo

Implementar `XMLElement` completo.

#### Arquivos

- `packages/core/src/xml/xml-element.ts`
- `packages/core/tests/xml/xml-element_test.ts`

#### Requisitos

- [ ] `class XMLElement implements XMLElementLike`:
  - `name: string | null`
  - `attrs: Record<string, string>`
  - `selfClosing: boolean`
  - `children: XMLElement[]`
- [ ] Constructor `(name, attrs = {}, selfClosing = false, block?)`:
  - Valida `name` (string ou null).
  - Valida `attrs`: nomes e valores não-nulos.
  - Processa `block`: chama `yield(block)` ou usa `block`.
  - Converte children string em `XMLText`.
  - Filtra null.
  - Valida tipo de cada child.
- [ ] `append(child: XMLElement | XMLElement[] | string | null): this`:
  - Se string → `XMLText`.
  - Se array → append cada.
  - Se null → ignorado.
  - Se XMLElement → push.
- [ ] `setAttr(attribute, value): void` — valida string.
- [ ] `getAttr(attribute): string | undefined`.
- [ ] `toHTML(): string` — alias de `to_s(0)`.
- [ ] `to_s(indent = 0): string`:
  - `<name` + attrs ordenados + `>`.
  - Se vazio e `selfClosing`: `/>`.
  - Senão: children com `\n` + indentação.
- [ ] Protected `escape(str, quotes = false): string`:
  - `&` → `&amp;`.
  - `"` → `\"` se `quotes`.
  - `<` → `&lt;` (adicionar).
  - `>` → `&gt;` (adicionar).
- [ ] Protected `indentation(indent): string`.

**Subclasses:**

- [ ] `class XMLText extends XMLElement`:
  - Constructor `(text)`.
  - `to_s(indent)`: escapa `<`, `>`, `&`.
- [ ] `class XMLNamedText extends XMLElement`:
  - Constructor `(text, name, attrs = {})`.
  - Chama `super(name, attrs)` + `append(new XMLText(text))`.
- [ ] `class XMLComment extends XMLElement`:
  - Constructor `(text = '')`.
  - `to_s(indent)`: `"<!-- " + canonicalize_comment(text) + " -->\n" + ' '.repeat(indent)`.
  - Canonicaliza `--` → `-\-`.
- [ ] `class XMLBlob extends XMLElement`:
  - Constructor `(blob = '')`.
  - `to_s(indent)`: itera caracteres, `\n` → `\n` + `' '.repeat(indent)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/XMLElement.rb` — arquivo completo.

#### Critério de aceite

```ts
const div = new XMLElement('div', { class: 'foo' });
div.append('Hello');
assertEquals(div.to_s(), '<div class="foo">Hello</div>');
```

#### Testes

- `xml-element_test.ts`:
  - `describe("XMLElement")`
    - `it("constructor rejeita attrs nulos")`.
    - `it("append string")`.
    - `it("append elemento")`.
    - `it("append array")`.
    - `it("append null ignorado")`.
    - `it("to_s selfClosing")`.
    - `it("to_s com children")`.
    - `it("attrs ordenados")`.
    - `it("escape &")`, `it("escape <")`, `it("escape >")`.
  - `describe("XMLText")`
    - `it("to_s")`.
    - `it("escapa < > &")`.
  - `describe("XMLNamedText")`
    - `it("cria com nome e texto")`.
  - `describe("XMLComment")`
    - `it("to_s")`.
    - `it("canonicaliza --")`.
  - `describe("XMLBlob")`
    - `it("to_s com indent")`.

---

### 21.2 — `XMLDocument`

#### Contexto

Container de `XMLElement`s. Provê `write`.

#### Objetivo

Implementar `XMLDocument`.

#### Arquivos

- `packages/core/src/xml/xml-document.ts`
- `packages/core/tests/xml/xml-document_test.ts`

#### Requisitos

- [ ] `class XMLDocument`:
  - `protected elements: XMLElement[]`
- [ ] Constructor `(block?)`:
  - Processa `block` (opcional).
- [ ] `append(arg): void`:
  - Se array, append flat.
  - Se null, ignorado.
  - Se XMLElement, push.
  - Senão, `throw Error`.
- [ ] `to_s(): string` — concatena `element.to_s(0)`.
- [ ] `write(filename: string): string | void`:
  - Se `filename === '.'`, retorna string (browser).
  - Senão, escreve via `Deno.writeTextFile` (se disponível).
  - Retorna void.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/XMLDocument.rb`.

#### Critério de aceite

```ts
const doc = new XMLDocument();
doc.append(new XMLElement('root'));
assertEquals(doc.to_s(), '<root/>');
```

#### Testes

- `xml-document_test.ts`:
  - `it("append")`.
  - `it("append array")`.
  - `it("append null ignorado")`.
  - `it("append tipo inválido lança")`.
  - `it("to_s")`.
  - `it("write '.' retorna string")`.

---

### Bloco B — HTML

---

### 21.3 — `HTMLElements`

#### Contexto

Classes dinâmicas para tags HTML. Ruby usa `class_eval`.

#### Objetivo

Gerar classes.

#### Arquivos

- `packages/core/src/html/html-elements.ts`
- `packages/core/tests/html/html-elements_test.ts`

#### Requisitos

- [ ] Lista de tags suportadas:
  `a, b, body, br, code, col, colgroup, div, em, frame, frameset, footer, h1, h2, h3, head, html, hr, meta, p, pre, span, table, td, title, tr`.
- [ ] Tags self-closing: `area, base, basefont, br, hr, input, img, link, meta`.
- [ ] `function createHTMLElementClass(tag: string): typeof XMLElement`:
  - Retorna classe que chama `super(tag, attrs, selfClosing)`.
- [ ] Exporta cada classe:
  ```ts
  export const HTML = createHTMLElementClass('html');
  export const HEAD = createHTMLElementClass('head');
  export const BODY = createHTMLElementClass('body');
  export const DIV = createHTMLElementClass('div');
  // ... ~25 classes
  ```

#### Referências

- `docs/taskjuggler/lib/taskjuggler/HTMLElements.rb`.

#### Critério de aceite

```ts
const div = new DIV({ class: 'foo' });
div.append('Hello');
assertEquals(div.to_s(), '<div class="foo">Hello</div>');
```

#### Testes

- `html-elements_test.ts`:
  - `it("cria DIV")`.
  - `it("cria H1")`.
  - `it("cria BR self-closing")`.
  - `it("createHTMLElementClass")`.

---

### 21.4 — `HTMLDocument`

#### Contexto

Especializa `XMLDocument` para HTML. Suporta 4 doctypes.

#### Objetivo

Implementar `HTMLDocument`.

#### Arquivos

- `packages/core/src/html/html-document.ts`
- `packages/core/tests/html/html-document_test.ts`

#### Requisitos

- [ ] `class HTMLDocument extends XMLDocument`:
  - `html: XMLElement`
- [ ] Constructor `(docType: 'html5' | 'strict' | 'transitional' | 'frameset' = 'html5')`:
  - Se `html5`: `<!DOCTYPE html>`.
  - Senão: `<?xml version="1.0" encoding="UTF-8"?>` + `<!DOCTYPE html PUBLIC ...>`.
  - Comentário `<!-- This file has been generated by ... -->`.
  - `<html xml:lang="en" lang="en">`.
  - Se não `html5`: `xmlns="http://www.w3.org/1999/xhtml"`.
- [ ] `generateHead(title, metaTags = {}, blob?): XMLElement`:
  - `<head>`.
  - `<title>title</title>`.
  - `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">`.
  - `<meta http-equiv="X-UA-Compatible" content="IE=9">`.
  - Para cada `metaTags`: `<meta name="..." content="...">`.
  - Se `blob`: `XMLBlob`.
  - Append em `html`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/HTMLDocument.rb`.

#### Critério de aceite

```ts
const doc = new HTMLDocument('html5');
const head = doc.generateHead('My Title');
assertEquals(doc.to_s().includes('<!DOCTYPE html>'), true);
assertEquals(doc.to_s().includes('<title>My Title</title>'), true);
```

#### Testes

- `html-document_test.ts`:
  - `it("html5 doctype")`.
  - `it("strict doctype")`.
  - `it("transitional doctype")`.
  - `it("frameset doctype")`.
  - `it("generateHead com title")`.
  - `it("generateHead com metaTags")`.
  - `it("generateHead com blob")`.

---

### Bloco C — ICalendar

---

### 21.5 — `ICalendar` — estrutura + `Component` base

#### Contexto

Container de componentes iCalendar (RFC 5545).

#### Objetivo

Implementar estrutura base.

#### Arquivos

- `packages/core/src/ical/i-calendar.ts`
- `packages/core/src/ical/component.ts`
- `packages/core/src/ical/person.ts`
- `packages/core/tests/ical/i-calendar_test.ts`

#### Requisitos

**`Person`:**

- [ ] `class Person`:
  - `readonly name: string`
  - `readonly email: string`

**`Component` (abstract):**

- [ ] `class Component`:
  - `protected ical: ICalendar`
  - `protected type: string`
  - `readonly uid: string`
  - `protected summary: string`
  - `protected startDate: TjTime`
  - `description: string | null`
  - `relatedTo: string | null`
  - `organizer: Person | null`
  - `protected attendees: Person[]`
- [ ] Constructor `(ical, uid, summary, startDate)`:
  - `type = className.toUpperCase()`.
  - `uid = uid + '-' + type`.
- [ ] `setOrganizer(name, email): void`.
- [ ] `addAttendee(name, email): void`.
- [ ] `to_s(): string`:
  - `BEGIN:V<type>`.
  - `DTSTAMP:...`, `CREATED:...`, `UID:...`, `LAST-MODIFIED:...`.
  - `SUMMARY:...`, `DTSTART:...`.
  - Opcional: `DESCRIPTION`, `RELATED-TO`.
  - Organizer + attendees.
  - `yield` para subclasses.
  - `END:V<type>`.
- [ ] Private `dateTime(date)` — delega para ical.
- [ ] Private `quoted(str)` — escapa `;`, `,`, `"`, `\\`, `\n`.

**`ICalendar`:**

- [ ] `class ICalendar`:
  - `static readonly LINELENGTH = 75`.
  - `readonly uid: string`
  - `creationDate: TjTime`
  - `lastModified: TjTime`
  - `private todos: Todo[]`
  - `private events: Event[]`
  - `private journals: Journal[]`
- [ ] Constructor `(uid)`:
  - `uid = "<packageName>-<uid>"`.
  - `creationDate = lastModified = TjTime.now().utc()`.
- [ ] `addTodo(todo)`, `addEvent(event)`, `addJournal(journal)`.
- [ ] `to_s(): string`:
  - `BEGIN:VCALENDAR`, `PRODID:-//...//EN`, `VERSION:2.0`.
  - Todos + events + journals.
  - `END:VCALENDAR`.
  - `foldLines`.
- [ ] `dateTime(date): string` — `date.to_s('%Y%m%dT%H%M%SZ', 'UTC')`.
- [ ] Private `foldLines(str): string`:
  - Linhas > `LINELENGTH` octetos → quebra com `\n `.
  - Converte `\n` → `\r\n`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb` — arquivo completo.

#### Critério de aceite

```ts
const ical = new ICalendar('test');
const todo = new Todo(ical, 'u1', 'Task 1', start, end);
const str = ical.to_s();
assert(str.includes('BEGIN:VCALENDAR'));
assert(str.includes('BEGIN:VTODO'));
```

#### Testes

- `i-calendar_test.ts`:
  - `describe("Person")`
    - `it("constructor")`.
  - `describe("Component")`
    - `it("to_s básico")`.
    - `it("quoted escapa")`.
    - `it("setOrganizer")`.
    - `it("addAttendee")`.
  - `describe("ICalendar")`
    - `it("constructor")`.
    - `it("addTodo")`.
    - `it("to_s com 1 todo")`.
    - `it("foldLines longo")`.
    - `it("CRLF")`.

---

### 21.6 — `ICalendar` — `Todo`, `Event`, `Journal`

#### Contexto

Subclasses de `Component`.

#### Objetivo

Implementar as 3.

#### Arquivos

- `packages/core/src/ical/todo.ts`
- `packages/core/src/ical/event.ts`
- `packages/core/src/ical/journal.ts`
- `packages/core/tests/ical/todo_test.ts`
- `packages/core/tests/ical/event_test.ts`
- `packages/core/tests/ical/journal_test.ts`

#### Requisitos

**`Todo`:**

- [ ] `class Todo extends Component`:
  - `protected endDate: TjTime`
  - `priority: number` (0-9)
  - `percentComplete: number`
- [ ] Constructor `(ical, uid, summary, startDate, endDate)`:
  - `ical.addTodo(this)`.
  - `priority = 0`.
  - `percentComplete = -1`.
- [ ] `to_s()`:
  - Se `percentComplete < 100`: `DUE:...`.
  - Senão: `COMPLETED:...`.
  - `PERCENT-COMPLETE:...`.

**`Event`:**

- [ ] `class Event extends Component`:
  - `protected endDate: TjTime`
  - `priority: number` (default 1)
- [ ] Constructor `(ical, uid, summary, startDate, endDate)`:
  - `ical.addEvent(this)`.
- [ ] `to_s()`:
  - `PRIORITY:...`, `DTEND:...`, `TRANSP:TRANSPARENT`.

**`Journal`:**

- [ ] `class Journal extends Component`:
- [ ] Constructor `(ical, uid, summary, startDate)`:
  - `ical.addJournal(this)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb` — classes `Todo`, `Event`, `Journal`.

#### Critério de aceite

Análogo.

#### Testes

- `todo_test.ts`:
  - `it("to_s com percentComplete 50")`.
  - `it("to_s com percentComplete 100 usa COMPLETED")`.
  - `it("priority")`.
- `event_test.ts`:
  - `it("to_s")`.
  - `it("priority default 1")`.
- `journal_test.ts`:
  - `it("to_s")`.

---

### Bloco D — Painter

---

### 21.7 — `Color` + `Points` + `SVGSupport`

#### Contexto

Helpers de cor e geometria.

#### Objetivo

Implementar as 3.

#### Arquivos

- `packages/core/src/painter/color.ts`
- `packages/core/src/painter/points.ts`
- `packages/core/src/painter/svg-support.ts`
- `packages/core/tests/painter/color_test.ts`
- `packages/core/tests/painter/points_test.ts`

#### Requisitos

**`Color`:**

- [ ] `static NamedColors: Record<string, [number, number, number]>` — 155 cores.
- [ ] Constructor `(...args)`:
  - 1 arg: nome.
  - 3 args: RGB (0-255).
  - 4 args: HSV (H 0-360, S 0-255, V 0-255).
- [ ] `to_rgb(): [number, number, number]`.
- [ ] `to_hsv(): [number, number, number]`.
- [ ] `to_s(): string` — `#RRGGBB`.
- [ ] Private `hsvToRgb(h, s, v)`.
- [ ] Private `rgbToHsv(r, g, b)`.

**`Points`:**

- [ ] `class Points`:
  - `private points: [number, number][]`
- [ ] Constructor `(arr)` — valida cada ponto.
- [ ] `to_s(): string` — `"x,y x,y x,y"`.

**`SVGSupport`:**

- [ ] `valuesToSVG(values): Record<string, string>`:
  - Converte `font_size` → `font-size`.
  - Adiciona `pt` para `font_size`.
  - Underscores → dashes.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Painter/Color.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/Points.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/SVGSupport.rb`.

#### Critério de aceite

```ts
const c = new Color('red');
assertEquals(c.to_s(), '#ff0000');

const c2 = new Color(255, 128, 0);
assertEquals(c2.to_s(), '#ff8000');

const p = new Points([[1, 2], [3, 4]]);
assertEquals(p.to_s(), '1,2 3,4 ');
```

#### Testes

- `color_test.ts`:
  - `it("nome red")`.
  - `it("nome blue")`.
  - `it("RGB")`.
  - `it("HSV")`.
  - `it("to_hsv")`.
  - `it("rejeita cor desconhecida")`.
  - `it("rejeita RGB fora do range")`.
- `points_test.ts`:
  - `it("constructor")`.
  - `it("to_s")`.
  - `it("rejeita ponto inválido")`.

---

### 21.8 — `Element` + `Group`

#### Contexto

`Element` é base de todos os elementos SVG. `Group` agrupa.

#### Objetivo

Implementar as 2.

#### Arquivos

- `packages/core/src/painter/element.ts`
- `packages/core/src/painter/group.ts`
- `packages/core/tests/painter/element_test.ts`
- `packages/core/tests/painter/group_test.ts`

#### Requisitos

**`Element`:**

- [ ] `abstract class Element`:
  - `protected type: string`
  - `protected attributes: string[]` — permitidos.
  - `protected values: Record<string, unknown>`
  - `protected text: string | null`
- [ ] Constructor `(type, attrs, values)`:
  - Valida cada chave em `attrs`.
- [ ] `to_svg(): XMLElement`:
  - `<type>` + `valuesToSVG`.
  - Se `text`, append `<text>`.

**`Group`:**

- [ ] `class Group`:
  - `private values: Record<string, unknown>`
  - `private elements: Element[]`
- [ ] Constructor `(values, block?)`:
  - Valida chaves em `[fill, font_family, font_size, stroke, stroke_width]`.
  - Processa `block`.
- [ ] `to_svg(): XMLElement`:
  - `<g>` + attrs + children.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Painter/Element.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/Group.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `element_test.ts`:
  - `it("constructor")`.
  - `it("to_svg")`.
  - `it("rejeita atributo desconhecido")`.
- `group_test.ts`:
  - `it("constructor com block")`.
  - `it("to_svg com child")`.

---

### 21.9 — `Primitives` + `BasicShapes` + `Text`

#### Contexto

Helpers de desenho e formas básicas.

#### Objetivo

Implementar as 3.

#### Arquivos

- `packages/core/src/painter/primitives.ts`
- `packages/core/src/painter/basic-shapes.ts`
- `packages/core/src/painter/text.ts`
- `packages/core/tests/painter/primitives_test.ts`

#### Requisitos

**`BasicShapes`:**

- [ ] `class Circle extends Element`:
  - `attrs = [cx, cy, r] + FillAndStrokeAttrs`.
- [ ] `class Ellipse extends Element`:
  - `attrs = [cx, cy, rx, ry] + FillAndStrokeAttrs`.
- [ ] `class Line extends Element`:
  - `attrs = [x1, y1, x2, y2] + StrokeAttrs`.
- [ ] `class Rect extends Element`:
  - `attrs = [x, y, width, height, rx, ry] + FillAndStrokeAttrs`.
- [ ] `class PolyLine extends Element`:
  - `attrs = [points] + FillAndStrokeAttrs`.

**`Text`:**

- [ ] `class Text extends Element`:
  - `attrs = [x, y] + TextAttrs`.
  - Constructor `(str, attrs)`.
  - `text = str`.

**`Primitives` (mix-in):**

- [ ] `color(...args): Color`.
- [ ] `points(arr): Points`.
- [ ] `group(attrs, block?): Group`.
- [ ] `circle(cx, cy, r, attrs = {}): Circle`.
- [ ] `ellipse(cx, cy, rx, ry, attrs = {}): Ellipse`.
- [ ] `line(x1, y1, x2, y2, attrs = {}): Line`.
- [ ] `polyline(points, attrs = {}): PolyLine`.
- [ ] `rect(x, y, width, height, attrs = {}): Rect`.
- [ ] `text(x, y, str, attrs = {}): Text`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Painter/Primitives.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/BasicShapes.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/Text.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `primitives_test.ts`:
  - `it("circle")`.
  - `it("ellipse")`.
  - `it("line")`.
  - `it("rect")`.
  - `it("polyline")`.
  - `it("text")`.
  - `it("group com block")`.

---

### 21.10 — `Painter`

#### Contexto

Classe principal de desenho.

#### Objetivo

Implementar `Painter`.

#### Arquivos

- `packages/core/src/painter/painter.ts`
- `packages/core/tests/painter/painter_test.ts`

#### Requisitos

- [ ] `class Painter`:
  - `private width: number`
  - `private height: number`
  - `private elements: Element[]`
- [ ] Constructor `(width, height, block?)`:
  - Processa `block` (com ou sem argumento).
- [ ] `to_svg(): XMLElement`:
  - `<svg width="..." height="...">`.
  - Children.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Painter.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `painter_test.ts`:
  - `it("constructor")`.
  - `it("to_svg vazio")`.
  - `it("to_svg com 1 rect")`.
  - `it("block com arg")`.
  - `it("block sem arg (instance_eval)")`.

---

### 21.11 — `FontMetrics` + `FontMetricsData` + `FontData`

#### Contexto

Métricas de fontes para cálculo de largura/altura de texto.

#### Objetivo

Implementar as 3.

#### Arquivos

- `packages/core/src/painter/font-metrics.ts`
- `packages/core/src/painter/font-metrics-data.ts`
- `packages/core/src/painter/font-data.ts`
- `packages/core/tests/painter/font-metrics_test.ts`

#### Requisitos

**`FontMetricsData`:**

- [ ] `class FontMetricsData`:
  - `readonly fontName: string`
  - `readonly type: 'normal' | 'italic' | 'bold' | 'bold_italic'`
  - `readonly ptSize: number`
  - `readonly height: number`
  - `readonly charWidth: Record<string, number>`
  - `readonly kerningDelta: Record<string, number>`
- [ ] `glyphWidth(c: string): number | null`.
- [ ] `averageWidth(): number`.
- [ ] `toRuby(): string` — só para geração.

**`FontData` (constantes):**

- [ ] `Font_LiberationSans_normal`.
- [ ] `Font_LiberationSans_italic`.
- [ ] `Font_LiberationSans_bold`.
- [ ] `Font_LiberationSans_bold_italic`.

**`FontMetrics`:**

- [ ] `class FontMetrics`:
  - `private fonts: Record<string, FontMetricsData>`
- [ ] Constructor:
  - Registra `Arial` = `LiberationSans`.
  - `Arial-Italic` = `LiberationSans-Italic`.
  - `Arial-Bold` = `LiberationSans-Bold`.
  - `Arial-BoldItalic` = `LiberationSans-BoldItalic`.
- [ ] `height(font, ptSize): number`:
  - `fontMetrics.height * (ptSize / fontMetrics.ptSize) * (4/3)`.
- [ ] `width(font, ptSize, str): number`:
  - Itera caracteres, soma `glyphWidth`, aplica `kerningDelta`.
  - Escala.
- [ ] Private `checkFontName(font)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Painter/FontMetrics.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/FontMetricsData.rb`.
- `docs/taskjuggler/lib/taskjuggler/Painter/FontData.rb`.

#### Critério de aceite

```ts
const fm = new FontMetrics();
const h = fm.height('Arial', 12);
assert(h > 0);

const w = fm.width('Arial', 12, 'Hello');
assert(w > 0);
```

#### Testes

- `font-metrics_test.ts`:
  - `it("height Arial 12")`.
  - `it("width string simples")`.
  - `it("width com kerning")`.
  - `it("rejeita fonte desconhecida")`.
  - `it("Arial = LiberationSans")`.

---

### Bloco E — Substituição e integração

---

### 21.12 — Substituir `SimpleXMLElement` por `XMLElement`

#### Contexto

Fase 12 introduziu `SimpleXMLElement`. Agora removemos.

#### Objetivo

Migrar.

#### Arquivos

- `packages/richtext/src/xml-like.ts` — manter `XMLElementLike` interface.
- `packages/richtext/src/rich-text-element.ts` — atualizar imports.
- `packages/report/src/**` — atualizar imports.
- `packages/report/src/gantt/**` — atualizar imports.
- `packages/core/tests/**` — atualizar imports.

#### Requisitos

- [ ] `SimpleXMLElement` **removido**.
- [ ] `XMLElement` (Fase 17) **implementa** `XMLElementLike`.
- [ ] Todos os imports apontam para `XMLElement`.
- [ ] Testes passam.

**Estratégia:**
1. Mover `XMLElementLike` para `packages/core/src/xml/xml-element-like.ts`.
2. `XMLElement` importa de lá.
3. Atualizar imports nos outros packages.

#### Referências

- ADR 028.

#### Critério de aceite

- `deno task test` verde.

---

### 21.13 — Substituir `HTMLDocument` mínimo

#### Contexto

Fase 14 introduziu `HTMLDocument` mínimo. Agora substituímos.

#### Objetivo

Migrar.

#### Arquivos

- `packages/report/src/html-document.ts` (remover)
- `packages/report/src/report.ts` (atualizar imports)
- Fase 12, 14 — imports.

#### Requisitos

- [ ] `HTMLDocument` mínimo removido.
- [ ] `HTMLDocument` real (Fase 17) usado.
- [ ] Testes atualizados.

#### Critério de aceite

- `deno task test` verde.

---

### 21.14 — Substituir `ICalendar` mínimo

#### Contexto

Fase 14 introduziu `ICalendar` mínimo. Agora substituímos.

#### Objetivo

Migrar.

#### Arquivos

- `packages/report/src/i-calendar.ts` (remover)
- `packages/report/src/i-cal-report.ts` (atualizar imports)

#### Requisitos

- [ ] `ICalendar` mínimo removido.
- [ ] `ICalendar` real (Fase 17) usado.

#### Critério de aceite

- `deno task test` verde.

---

### 21.15 — Substituir `Painter` mínimo

#### Contexto

Fase 14 introduziu `Painter` mínimo. Agora substituímos.

#### Objetivo

Migrar.

#### Arquivos

- `packages/report/src/chart-plotter.ts` (atualizar imports)

#### Requisitos

- [ ] `Painter` mínimo removido.
- [ ] `Painter` real usado.

#### Critério de aceite

- `deno task test` verde.

---

### Bloco F — Golden tests

---

### 21.16 — Golden tests (HTML/XML/SVG)

#### Contexto

Validar HTML/XML/SVG contra `tj3`.

#### Objetivo

Snapshots.

#### Arquivos

- `scripts/golden/html-xml.rb`
- `scripts/golden/ical.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/core/tests/golden/html-xml.golden.json`
- `packages/core/tests/golden/ical.golden.json`
- `packages/core/tests/golden/html-xml_golden_test.ts`
- `packages/core/tests/golden/ical_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Scripts Ruby:**

- [ ] `html-xml.rb`:
  - Constrói `HTMLDocument` com várias tags.
  - Serializa.
  - Também testa `XMLElement` + `XMLText` + `XMLComment` + `XMLBlob`.
- [ ] `ical.rb`:
  - Constrói `ICalendar` com `Todo`, `Event`, `Journal`.
  - Serializa.

**Testes TS:**

- [ ] Compara strings byte-a-byte.
- [ ] ≥ 30 casos.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/HTMLDocument.rb`.
- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb`.
- Fase 2, subfase 5.14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 30 casos.
- Todos passam.

#### Testes

- `html-xml_golden_test.ts`:
  - `describe("Golden HTML/XML")` — itera.
- `ical_golden_test.ts`:
  - `describe("Golden ICalendar")` — itera.

---

## 6. Ordem de execução sugerida

```text
21.0  ADR 028
      ↓
21.1  XMLElement + XMLText + XMLNamedText + XMLComment + XMLBlob
21.2  XMLDocument
      ↓
21.3  HTMLElements
21.4  HTMLDocument
      ↓
21.5  ICalendar estrutura + Component
21.6  Todo, Event, Journal
      ↓
21.7  Color + Points + SVGSupport
21.8  Element + Group
21.9  Primitives + BasicShapes + Text
21.10 Painter
21.11 FontMetrics + FontData
      ↓
21.12 Substituir SimpleXMLElement → XMLElement
21.13 Substituir HTMLDocument mínimo
21.14 Substituir ICalendar mínimo
21.15 Substituir Painter mínimo
      ↓
21.16 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 17 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `XMLElement` + subclasses completos.
- [ ] `XMLDocument`, `HTMLDocument`, `HTMLElements` completos.
- [ ] `ICalendar` + `Todo` + `Event` + `Journal` completos.
- [ ] `Painter` + `Color` + `Points` + `Element` + `Group` + `Primitives` + `BasicShapes` + `Text` + `FontMetrics` + `FontData` completos.
- [ ] `SimpleXMLElement` removido.
- [ ] `HTMLDocument` mínimo removido.
- [ ] `ICalendar` mínimo removido.
- [ ] `Painter` mínimo removido.
- [ ] **≥ 220 testes unitários**.
- [ ] **≥ 30 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 028 criado.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Substituição de `SimpleXMLElement` quebra imports | Alto | Fazer arquivo por arquivo |
| `HTMLElements` com `class_eval` dinâmico | Médio | Map estático |
| `ICalendar.foldLines` com UTF-8 | Médio | Testes com emojis/acentos |
| `FontData.rb` (1000 linhas) copiado errado | Alto | Copiar byte-a-byte |
| `Color.hsvToRgb` com precisão | Médio | Golden tests |
| `Painter` mínimo vs real divergem | Alto | Substituição em 21.15 |
| `XMLElement.escape` inconsistente | Alto | Testes com cada tipo |
| `HTMLDocument.strict` com XHTML | Médio | Golden tests |
| `to_s` com indentação diferente | Médio | Golden tests byte-a-byte |
| `FontMetrics.width` com kerning | Médio | Comparar com Ruby |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/XMLElement.rb`
- `docs/taskjuggler/lib/taskjuggler/XMLDocument.rb`
- `docs/taskjuggler/lib/taskjuggler/HTMLDocument.rb`
- `docs/taskjuggler/lib/taskjuggler/HTMLElements.rb`
- `docs/taskjuggler/lib/taskjuggler/ICalendar.rb`
- `docs/taskjuggler/lib/taskjuggler/Painter.rb`
- `docs/taskjuggler/lib/taskjuggler/Painter/*.rb`

### Blueprints

- `docs/tj3-engine/14-blueprint-others.md`
- `docs/tj3-engine/15-blueprint-others.md`

### Documentos do projeto

- `docs/syntaxmesh/decisoes/028-substituicao-xml.md` (novo)
- `docs/syntaxmesh/03-arquitetura.md`

### Fases dependentes

- **Fase 20 — UI** (exibe HTML).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **`XMLElement` substitui `SimpleXMLElement`.** Interface `XMLElementLike` mantida.
2. **Escape em `XMLText`:** `<`, `>`, `&`. **Não** escapa `"`.
3. **Escape em `XMLElement` attrs:** `&`, `"`.
4. **`XMLComment` canonicaliza `--`** em `-\-`.
5. **`HTMLDocument` 4 doctypes** — html5, strict, transitional, frameset.
6. **`HTMLElements` map estático.** Não usar `class_eval`.
7. **`ICalendar.foldLines`** com `LINELENGTH = 75`.
8. **`dateTime` sempre em UTC.**
9. **`Color.hsvToRgb`** com `hi = (h/60).floor % 6`.
10. **`Painter` gera SVG.** Sem Canvas.
11. **`FontData.rb` copiado byte-a-byte.**
12. **`FontMetrics.width`** aplica kerning.
13. **`SVGSupport.valuesToSVG`** com `font_size` → `font-size` + `pt`.
14. **Substituições em subfases separadas** (21.12–21.15).
15. **Golden tests byte-a-byte** — normalizar apenas line endings.
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(core): xml-element`, etc.

---

## 11. ADR 028 (referência rápida)

Criado como subfase 21.0. Conteúdo esperado:

- **Título:** Substituição de XML/HTML/ICalendar/Painter mínimos
- **Contexto:** Fases 12/14 introduziram implementações mínimas.
- **Decisões:**
  - `XMLElement` real implementa `XMLElementLike`.
  - `SimpleXMLElement` removido.
  - `HTMLDocument`, `ICalendar`, `Painter` substituídos.
- **Alternativas:** manter mínimos (duplicação).
- **Consequências:** fidelidade; refatoração de imports.

---

**Fim da Fase 17.**