# Fase 17 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-17-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-17-html-xml.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~180 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{XMLElement,XMLDocument,HTMLDocument,HTMLElements,ICalendar}.rb` + `Painter/*.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

Esta fase **substitui implementações mínimas** das Fases 12, 14 e 15 por versões completas. A ordem importa:

1. **Bloco A (XML)** — `XMLElement` + subclasses + `XMLDocument`.
2. **Bloco B (HTML)** — `HTMLElements` + `HTMLDocument`.
3. **Bloco C (ICalendar)** — `Person`, `Component`, `Todo`, `Event`, `Journal`, `ICalendar`.
4. **Bloco D (Painter)** — `Color`, `Points`, `SVGSupport`, `Element`, `Group`, `Primitives`, `BasicShapes`, `Text`, `Painter`, `FontMetrics`, `FontData`.
5. **Bloco E (substituição)** — Trocar `SimpleXMLElement`, `HTMLDocument` mínimo, `ICalendar` mínimo, `Painter` mínimo.
6. **Bloco F (golden)** — validação end-to-end.
7. **Bloco G (verificação)** — fecha a fase.

**Substituição transparente:** a interface `XMLElementLike` (Fase 12) permanece. `XMLElement` real a implementa. Imports atualizados arquivo por arquivo.

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 012–022** — Fases 2–10 (contexto).
- **ADR 023** — Expressões lógicas sem precedência (Fase 11).
- **ADR 024** — RichText e function handlers (Fase 12).
- **ADR 025** — Markdown going-forward (Fase 13).
- **ADR 026** — Reports browser-only (Fase 14).
- **ADR 027** — Gantt HTML+CSS (Fase 15).
- **ADR 028** — Journal e AlertLevel (Fase 16).
- **ADR 029** — Substituição de XML/HTML/ICalendar/Painter mínimos (**criado nesta fase**).

### Convenções CRÍTICAS

- **`XMLElement` substitui `SimpleXMLElement`** (Fase 12).
- **Interface `XMLElementLike` permanece.**
- **`XMLText` escapa `<`, `>`, `&`. Não escapa `"`.**
- **`XMLElement` attrs escapam `&`, `"`.**
- **`XMLComment` canonicaliza `--` em `-\-`.**
- **`HTMLDocument` 4 doctypes** (html5, strict, transitional, frameset).
- **`HTMLElements` map estático.** Não usar `class_eval`.
- **`ICalendar.foldLines`** com `LINELENGTH = 75`.
- **`dateTime` sempre em UTC.**
- **`Color.hsvToRgb`** com `hi = (h/60).floor % 6`.
- **`Painter` gera SVG.** Sem Canvas.
- **`FontData.rb` copiado byte-a-byte.**
- **`FontMetrics.width`** aplica kerning.
- **`SVGSupport.valuesToSVG`** com `font_size` → `font-size` + `pt`.
- **Substituições em subfases separadas** (17.12–17.15).
- **Golden tests byte-a-byte** — normalizar apenas line endings.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar Canvas (só SVG).
- ❌ Não usar `class_eval` em TS.
- ❌ Não quebrar a interface `XMLElementLike`.
- ❌ Não modificar `RichTextElement` (Fase 12) além dos imports.
- ❌ Não tocar em `GanttChart` (Fase 15) além dos imports.
- ❌ Não reinventar `Painter` com SVG diferente do Ruby.
- ❌ Não usar `Proxy`.
- ❌ Não usar `FontData.rb` como gerador — copiar dados.
- ❌ Não alterar saída de reports (Fase 14) — apenas refatorar imports.

---

## Progresso

```
[ ] 17.0  ADR 029 (substituição XML/HTML/ICalendar/Painter)  —   0/5
[ ] 17.1  XMLElement + XMLText + XMLNamedText + XMLComment + XMLBlob — 0/22
[ ] 17.2  XMLDocument                                       —   0/8
[ ] 17.3  HTMLElements                                      —   0/6
[ ] 17.4  HTMLDocument                                      —   0/10
[ ] 17.5  ICalendar estrutura + Component + Person          —   0/18
[ ] 17.6  Todo, Event, Journal                              —   0/14
[ ] 17.7  Color + Points + SVGSupport                       —   0/16
[ ] 17.8  Element + Group                                   —   0/10
[ ] 17.9  Primitives + BasicShapes + Text                   —   0/16
[ ] 17.10 Painter                                           —   0/8
[ ] 17.11 FontMetrics + FontMetricsData + FontData          —   0/14
[ ] 17.12 Substituir SimpleXMLElement → XMLElement          —   0/8
[ ] 17.13 Substituir HTMLDocument mínimo                    —   0/4
[ ] 17.14 Substituir ICalendar mínimo                       —   0/4
[ ] 17.15 Substituir Painter mínimo                         —   0/4
[ ] 17.16 Golden tests (HTML/XML/ICalendar)                 —   0/10
[ ] 17.17 Verificação final                                 —   0/10
──────────────────────────────────────────────────────────────
TOTAL: ~180
```

---

## Bloco A — Fundação

### 17.0 — ADR 029 (substituição XML/HTML/ICalendar/Painter)

**Objetivo:** formalizar a substituição das implementações mínimas das Fases 12/14/15.

**⚠️ Nota:** o plano usa `ADR 028`, mas ADR 028 é Journal/AlertLevel (Fase 16). Aqui usamos **ADR 029**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.0.1 | Criar `docs/syntaxmesh/decisoes/029-substituicao-xml.md` com frontmatter | idem | arquivo existe |
| 17.0.2 | Seção **Contexto:** `XMLElementLike` introduzida na Fase 12 por compatibilidade; `HTMLDocument`, `ICalendar`, `Painter` mínimos nas Fases 14/15 | idem | — |
| 17.0.3 | Seção **Decisões:** `XMLElement` real implementa `XMLElementLike`; `SimpleXMLElement` removido; `HTMLDocument`/`ICalendar`/`Painter` substituídos; contratos de saída mantidos | idem | — |
| 17.0.4 | **Alternativas** (manter mínimos — duplicação) + **Consequências** (fidelidade; refatoração de imports) | idem | — |
| 17.0.5 | Atualizar linha `029` em `decisoes/README.md` | idem | 29 linhas |

---

## Bloco A — XML

### 17.1 — `XMLElement` + subclasses

**⚠️ RUBY: `XMLElement.rb` (arquivo inteiro — ~250 linhas)**
**🔎 CHEAT: §2 `.freeze` → `Object.freeze`, §5 escape de strings**

**Pré-requisitos:** nenhum (substitui `SimpleXMLElement` da Fase 12).

#### 17.1.1 — `XMLElement`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.1.1 | Criar `packages/core/src/xml/xml-element.ts` com `class XMLElement implements XMLElementLike` | idem | `deno check` |
| 17.1.1.2 | Campos: `name: string \| null`, `attrs: Record<string, string>`, `selfClosing: boolean`, `children: XMLElement[]` | idem | `deno check` |
| 17.1.1.3 | ⚠️ Constructor `(name, attrs = {}, selfClosing = false, block?)` — valida `name` (string ou null) | idem | 4 testes |
| 17.1.1.4 | Constructor valida `attrs`: nomes e valores não-nulos | idem | 3 testes |
| 17.1.1.5 | ⚠️ Constructor processa `block`: chama `yield(block)` ou usa `block` | idem | 4 testes |
| 17.1.1.6 | Constructor converte children string em `XMLText` | idem | 2 testes |
| 17.1.1.7 | Constructor filtra null | idem | 2 testes |
| 17.1.1.8 | Constructor valida tipo de cada child | idem | 3 testes |
| 17.1.1.9 | ⚠️ `append(child: XMLElement \| XMLElement[] \| string \| null): this` — string → `XMLText` | idem | 4 testes |
| 17.1.1.10 | `append` com array | idem | 2 testes |
| 17.1.1.11 | `append` com null → ignorado | idem | 1 teste |
| 17.1.1.12 | `append` com XMLElement → push | idem | 2 testes |
| 17.1.1.13 | ⚠️ `setAttr(attribute, value): void` — valida string | idem | 3 testes |
| 17.1.1.14 | ⚠️ `getAttr(attribute): string \| undefined` | idem | 2 testes |
| 17.1.1.15 | ⚠️ `toHTML(): string` — alias de `to_s(0)` | idem | 2 testes |
| 17.1.1.16 | ⚠️ `to_s(indent = 0): string` — `<name` + attrs ordenados + `>` | idem | 4 testes |
| 17.1.1.17 | `to_s` com `selfClosing` e vazio → `/>` | idem | 2 testes |
| 17.1.1.18 | `to_s` com children → `\n` + indentação | idem | 3 testes |
| 17.1.1.19 | ⚠️ `protected escape(str, quotes = false): string` — `&`, `"`, `<`, `>` | idem | 5 testes |
| 17.1.1.20 | ⚠️ `protected indentation(indent): string` | idem | 2 testes |

#### 17.1.2 — `XMLText`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.2.1 | ⚠️ `class XMLText extends XMLElement` com Constructor `(text)` | idem | 2 testes |
| 17.1.2.2 | ⚠️ `to_s(indent): string` — escapa `<`, `>`, `&` (mas não `"`) | idem | 4 testes |

#### 17.1.3 — `XMLNamedText`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.3.1 | ⚠️ `class XMLNamedText extends XMLElement` com Constructor `(text, name, attrs = {})` | idem | 3 testes |
| 17.1.3.2 | Chama `super(name, attrs)` + `append(new XMLText(text))` | idem | 2 testes |

#### 17.1.4 — `XMLComment`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.4.1 | ⚠️ `class XMLComment extends XMLElement` com Constructor `(text = '')` | idem | 2 testes |
| 17.1.4.2 | ⚠️ `to_s(indent): string` — `"<!-- " + canonicalize_comment(text) + " -->\n" + ' '.repeat(indent)` | idem | 3 testes |
| 17.1.4.3 | ⚠️ Canonicaliza `--` → `-\-` | idem | 3 testes |
| 17.1.4.4 | Teste agregado: comentário com `--` | idem | 1 teste |

#### 17.1.5 — `XMLBlob`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.1.5.1 | ⚠️ `class XMLBlob extends XMLElement` com Constructor `(blob = '')` | idem | 2 testes |
| 17.1.5.2 | ⚠️ `to_s(indent): string` — itera caracteres, `\n` → `\n` + `' '.repeat(indent)` | idem | 4 testes |
| 17.1.5.3 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.2 — `XMLDocument`

**⚠️ RUBY: `XMLDocument.rb` (arquivo inteiro — ~70 linhas)**

**Pré-requisitos:** 17.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.2.1 | Criar `packages/core/src/xml/xml-document.ts` com `class XMLDocument` | idem | `deno check` |
| 17.2.2 | Campo `protected elements: XMLElement[]` | idem | `deno check` |
| 17.2.3 | ⚠️ Constructor `(block?)` — processa `block` (opcional) | idem | 3 testes |
| 17.2.4 | ⚠️ `append(arg): void` — array (append flat), null (ignorado), XMLElement (push) | idem | 5 testes |
| 17.2.5 | `append` com tipo inválido → `throw Error` | idem | 2 testes |
| 17.2.6 | ⚠️ `to_s(): string` — concatena `element.to_s(0)` | idem | 2 testes |
| 17.2.7 | ⚠️ `write(filename: string): string \| void` — `'.'` → string (browser); senão, escreve | idem | 3 testes |
| 17.2.8 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco B — HTML

### 17.3 — `HTMLElements`

**⚠️ RUBY: `HTMLElements.rb` (~80 linhas)**
**🔎 CHEAT: §3 `class_eval` → map estático de classes**

**Pré-requisitos:** 17.1.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.3.1 | Criar `packages/core/src/html/html-elements.ts` | idem | `deno check` |
| 17.3.2 | ⚠️ Lista de tags: `a, b, body, br, code, col, colgroup, div, em, frame, frameset, footer, h1, h2, h3, head, html, hr, meta, p, pre, span, table, td, title, tr` | idem | 1 teste (contagem ≥ 25) |
| 17.3.3 | ⚠️ Tags self-closing: `area, base, basefont, br, hr, input, img, link, meta` | idem | 1 teste |
| 17.3.4 | ⚠️ `function createHTMLElementClass(tag: string): typeof XMLElement` — retorna classe que chama `super(tag, attrs, selfClosing)` | idem | 3 testes |
| 17.3.5 | Exporta cada classe: `HTML`, `HEAD`, `BODY`, `DIV`, `H1`, `A`, `TABLE`, etc. | idem | 5 testes |
| 17.3.6 | Teste: `new DIV({ class: 'foo' })` funciona | idem | 1 teste |

---

### 17.4 — `HTMLDocument`

**⚠️ RUBY: `HTMLDocument.rb` (~120 linhas)**

**Pré-requisitos:** 17.2, 17.3.

#### 17.4.1 — Constructor + doctypes

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.4.1.1 | Criar `packages/core/src/html/html-document.ts` com `class HTMLDocument extends XMLDocument` | idem | `deno check` |
| 17.4.1.2 | Campo `html: XMLElement` | idem | `deno check` |
| 17.4.1.3 | ⚠️ Constructor `(docType: 'html5' \| 'strict' \| 'transitional' \| 'frameset' = 'html5')` | idem | 3 testes |
| 17.4.1.4 | ⚠️ Se `html5`: `<!DOCTYPE html>` | idem | 2 testes |
| 17.4.1.5 | ⚠️ Senão: `<?xml version="1.0" encoding="UTF-8"?>` + `<!DOCTYPE html PUBLIC ...>` | idem | 4 testes |
| 17.4.1.6 | Comentário `<!-- This file has been generated by ... -->` | idem | 2 testes |
| 17.4.1.7 | `<html xml:lang="en" lang="en">` | idem | 2 testes |
| 17.4.1.8 | Se não `html5`: `xmlns="http://www.w3.org/1999/xhtml"` | idem | 2 testes |

#### 17.4.2 — `generateHead`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.4.2.1 | ⚠️ `generateHead(title, metaTags = {}, blob?): XMLElement` — `<head>` | idem | 2 testes |
| 17.4.2.2 | ⚠️ `<title>title</title>` | idem | 2 testes |
| 17.4.2.3 | ⚠️ `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">` | idem | 2 testes |
| 17.4.2.4 | ⚠️ `<meta http-equiv="X-UA-Compatible" content="IE=9">` | idem | 2 testes |
| 17.4.2.5 | ⚠️ Para cada `metaTags`: `<meta name="..." content="...">` | idem | 3 testes |
| 17.4.2.6 | Se `blob`: `XMLBlob` | idem | 2 testes |
| 17.4.2.7 | Append em `html` | idem | 1 teste |
| 17.4.2.8 | Teste: `doc.to_s()` contém `<!DOCTYPE html>` | idem | 1 teste |
| 17.4.2.9 | Teste: `doc.to_s()` contém `<title>My Title</title>` | idem | 1 teste |
| 17.4.2.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco C — ICalendar

### 17.5 — `ICalendar` estrutura + `Component` + `Person`

**⚠️ RUBY: `ICalendar.rb` (arquivo inteiro — ~330 linhas)**
**🔎 CHEAT: §5 strings, §12 Categoria B (foldLines)**

**Pré-requisitos:** Fase 2 (`TjTime`).

#### 17.5.1 — `Person`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.1.1 | Criar `packages/core/src/ical/person.ts` com `class Person` | idem | `deno check` |
| 17.5.1.2 | Campos `readonly name: string`, `readonly email: string` | idem | `deno check` |
| 17.5.1.3 | Constructor `(name, email)` | idem | 2 testes |

#### 17.5.2 — `Component` (abstract)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.2.1 | Criar `packages/core/src/ical/component.ts` com `class Component` | idem | `deno check` |
| 17.5.2.2 | Campos: `protected ical`, `protected type: string`, `readonly uid: string`, `protected summary: string`, `protected startDate: TjTime` | idem | `deno check` |
| 17.5.2.3 | Campos: `description: string \| null`, `relatedTo: string \| null`, `organizer: Person \| null`, `protected attendees: Person[]` | idem | `deno check` |
| 17.5.2.4 | ⚠️ Constructor `(ical, uid, summary, startDate)` — `type = className.toUpperCase()`; `uid = uid + '-' + type` | idem | 3 testes |
| 17.5.2.5 | ⚠️ `setOrganizer(name, email): void` | idem | 2 testes |
| 17.5.2.6 | ⚠️ `addAttendee(name, email): void` | idem | 2 testes |
| 17.5.2.7 | ⚠️ `to_s(): string` — `BEGIN:V<type>`; `DTSTAMP`, `CREATED`, `UID`, `LAST-MODIFIED`, `SUMMARY`, `DTSTART` | idem | 6 testes |
| 17.5.2.8 | `to_s` opcional: `DESCRIPTION`, `RELATED-TO` | idem | 3 testes |
| 17.5.2.9 | `to_s` com organizer + attendees | idem | 3 testes |
| 17.5.2.10 | `to_s` chama `yield` para subclasses | idem | 1 teste |
| 17.5.2.11 | `END:V<type>` | idem | 1 teste |
| 17.5.2.12 | ⚠️ `private dateTime(date)` — delega para `ical` | idem | 2 testes |
| 17.5.2.13 | ⚠️ `private quoted(str)` — escapa `;`, `,`, `"`, `\\`, `\n` | idem | 5 testes |

#### 17.5.3 — `ICalendar` container

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.3.1 | Criar `packages/core/src/ical/i-calendar.ts` com `class ICalendar` | idem | `deno check` |
| 17.5.3.2 | Constante `static readonly LINELENGTH = 75` | idem | `deno check` |
| 17.5.3.3 | Campos: `readonly uid`, `creationDate: TjTime`, `lastModified: TjTime` | idem | `deno check` |
| 17.5.3.4 | Campos: `private todos: Todo[]`, `private events: Event[]`, `private journals: Journal[]` | idem | `deno check` |
| 17.5.3.5 | ⚠️ Constructor `(uid)` — `uid = "<packageName>-<uid>"`; `creationDate = lastModified = TjTime.now().utc()` | idem | 3 testes |
| 17.5.3.6 | ⚠️ `addTodo(todo)`, `addEvent(event)`, `addJournal(journal)` | idem | 3 testes |

#### 17.5.4 — Serialização + `foldLines`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.5.4.1 | ⚠️ `to_s(): string` — `BEGIN:VCALENDAR`, `PRODID`, `VERSION:2.0`, todos + events + journals, `END:VCALENDAR` | idem | 4 testes |
| 17.5.4.2 | ⚠️ `dateTime(date): string` — `date.to_s('%Y%m%dT%H%M%SZ', 'UTC')` | idem | 3 testes |
| 17.5.4.3 | ⚠️ `private foldLines(str): string` — linhas > `LINELENGTH` octetos → quebra com `\n ` | idem | 4 testes |
| 17.5.4.4 | Converte `\n` → `\r\n` | idem | 3 testes |
| 17.5.4.5 | Teste: `to_s` com 1 todo | idem | 1 teste |
| 17.5.4.6 | Teste: `foldLines` longo | idem | 1 teste |
| 17.5.4.7 | Teste: CRLF | idem | 1 teste |
| 17.5.4.8 | Teste: `foldLines` com UTF-8 (emoji) | idem | 1 teste |
| 17.5.4.9 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.6 — `Todo`, `Event`, `Journal`

**⚠️ RUBY: `ICalendar.rb` — classes `Todo`, `Event`, `Journal`**

**Pré-requisitos:** 17.5.

#### 17.6.1 — `Todo`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.1.1 | Criar `packages/core/src/ical/todo.ts` com `class Todo extends Component` | idem | `deno check` |
| 17.6.1.2 | Campos: `protected endDate: TjTime`, `priority: number`, `percentComplete: number` | idem | `deno check` |
| 17.6.1.3 | ⚠️ Constructor `(ical, uid, summary, startDate, endDate)` — `priority = 0`, `percentComplete = -1` | idem | 3 testes |
| 17.6.1.4 | ⚠️ `to_s()` — se `percentComplete < 100`: `DUE:...`; senão: `COMPLETED:...` | idem | 4 testes |
| 17.6.1.5 | `PERCENT-COMPLETE:...` | idem | 2 testes |
| 17.6.1.6 | Teste: `to_s` com `percentComplete 50` | idem | 1 teste |
| 17.6.1.7 | Teste: `to_s` com `percentComplete 100` | idem | 1 teste |

#### 17.6.2 — `Event`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.2.1 | Criar `packages/core/src/ical/event.ts` com `class Event extends Component` | idem | `deno check` |
| 17.6.2.2 | Campos: `protected endDate: TjTime`, `priority: number` (default 1) | idem | `deno check` |
| 17.6.2.3 | ⚠️ Constructor `(ical, uid, summary, startDate, endDate)` | idem | 3 testes |
| 17.6.2.4 | ⚠️ `to_s()` — `PRIORITY:...`, `DTEND:...`, `TRANSP:TRANSPARENT` | idem | 4 testes |
| 17.6.2.5 | Teste: `priority default 1` | idem | 1 teste |

#### 17.6.3 — `Journal`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.6.3.1 | Criar `packages/core/src/ical/journal.ts` com `class Journal extends Component` | idem | `deno check` |
| 17.6.3.2 | ⚠️ Constructor `(ical, uid, summary, startDate)` | idem | 2 testes |
| 17.6.3.3 | Teste: `to_s` | idem | 1 teste |
| 17.6.3.4 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

## Bloco D — Painter

### 17.7 — `Color` + `Points` + `SVGSupport`

**⚠️ RUBY: `Painter/Color.rb` (~250 linhas), `Painter/Points.rb` (~50 linhas), `Painter/SVGSupport.rb` (~30 linhas)**
**🔎 CHEAT: §6 `Float#round`, §12 Categoria B (hsvToRgb)**

**Pré-requisitos:** 17.1 (`XMLElement`).

#### 17.7.1 — `Color`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.1.1 | Criar `packages/core/src/painter/color.ts` com `class Color` | idem | `deno check` |
| 17.7.1.2 | ⚠️ `static NamedColors: Record<string, [number, number, number]>` — 155 cores | idem | 1 teste (contagem ≥ 140) |
| 17.7.1.3 | ⚠️ Constructor `(...args)` — 1 arg (nome), 3 args (RGB), 4 args (HSV) | idem | 5 testes |
| 17.7.1.4 | ⚠️ `to_rgb(): [number, number, number]` | idem | 3 testes |
| 17.7.1.5 | ⚠️ `to_hsv(): [number, number, number]` | idem | 3 testes |
| 17.7.1.6 | ⚠️ `to_s(): string` = `#RRGGBB` | idem | 4 testes |
| 17.7.1.7 | ⚠️ `private hsvToRgb(h, s, v)` — `hi = (h/60).floor % 6` | idem | 6 testes |
| 17.7.1.8 | ⚠️ `private rgbToHsv(r, g, b)` | idem | 4 testes |
| 17.7.1.9 | Teste: `new Color('red').to_s() === '#ff0000'` | idem | 1 teste |
| 17.7.1.10 | Teste: `new Color(255, 128, 0).to_s() === '#ff8000'` | idem | 1 teste |

#### 17.7.2 — `Points`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.2.1 | Criar `packages/core/src/painter/points.ts` com `class Points` | idem | `deno check` |
| 17.7.2.2 | Campo `private points: [number, number][]` | idem | `deno check` |
| 17.7.2.3 | ⚠️ Constructor `(arr)` — valida cada ponto | idem | 3 testes |
| 17.7.2.4 | ⚠️ `to_s(): string` = `"x,y x,y x,y"` | idem | 3 testes |

#### 17.7.3 — `SVGSupport`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.7.3.1 | Criar `packages/core/src/painter/svg-support.ts` | idem | `deno check` |
| 17.7.3.2 | ⚠️ `valuesToSVG(values): Record<string, string>` — converte `font_size` → `font-size` | idem | 3 testes |
| 17.7.3.3 | Adiciona `pt` para `font_size` | idem | 2 testes |
| 17.7.3.4 | Underscores → dashes | idem | 3 testes |
| 17.7.3.5 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.8 — `Element` + `Group`

**⚠️ RUBY: `Painter/Element.rb` (~80 linhas), `Painter/Group.rb` (~80 linhas)**

**Pré-requisitos:** 17.1, 17.7.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.8.1 | Criar `packages/core/src/painter/element.ts` com `abstract class Element` | idem | `deno check` |
| 17.8.2 | Campos: `protected type: string`, `protected attributes: string[]`, `protected values: Record<string, unknown>`, `protected text: string \| null` | idem | `deno check` |
| 17.8.3 | ⚠️ Constructor `(type, attrs, values)` — valida cada chave em `attrs` | idem | 3 testes |
| 17.8.4 | ⚠️ `to_svg(): XMLElement` — `<type>` + `valuesToSVG` | idem | 3 testes |
| 17.8.5 | Se `text`, append `<text>` | idem | 2 testes |
| 17.8.6 | Criar `class Group` com `private values`, `private elements: Element[]` | idem | `deno check` |
| 17.8.7 | ⚠️ Constructor `(values, block?)` — valida chaves em `[fill, font_family, font_size, stroke, stroke_width]` | idem | 4 testes |
| 17.8.8 | Processa `block` | idem | 2 testes |
| 17.8.9 | ⚠️ `to_svg(): XMLElement` — `<g>` + attrs + children | idem | 3 testes |
| 17.8.10 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.9 — `Primitives` + `BasicShapes` + `Text`

**⚠️ RUBY: `Painter/Primitives.rb` (~130 linhas), `Painter/BasicShapes.rb` (~130 linhas), `Painter/Text.rb` (~30 linhas)**

**Pré-requisitos:** 17.8.

#### 17.9.1 — `BasicShapes`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.1.1 | Criar `packages/core/src/painter/basic-shapes.ts` | idem | `deno check` |
| 17.9.1.2 | ⚠️ `class Circle extends Element` — `attrs = [cx, cy, r] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.3 | ⚠️ `class Ellipse extends Element` — `attrs = [cx, cy, rx, ry] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.4 | ⚠️ `class Line extends Element` — `attrs = [x1, y1, x2, y2] + StrokeAttrs` | idem | 3 testes |
| 17.9.1.5 | ⚠️ `class Rect extends Element` — `attrs = [x, y, width, height, rx, ry] + FillAndStrokeAttrs` | idem | 3 testes |
| 17.9.1.6 | ⚠️ `class PolyLine extends Element` — `attrs = [points] + FillAndStrokeAttrs` | idem | 3 testes |

#### 17.9.2 — `Text`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.2.1 | Criar `packages/core/src/painter/text.ts` com `class Text extends Element` | idem | `deno check` |
| 17.9.2.2 | ⚠️ `attrs = [x, y] + TextAttrs` | idem | 2 testes |
| 17.9.2.3 | ⚠️ Constructor `(str, attrs)` — `text = str` | idem | 2 testes |

#### 17.9.3 — `Primitives` (mix-in)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.9.3.1 | Criar `packages/core/src/painter/primitives.ts` | idem | `deno check` |
| 17.9.3.2 | ⚠️ `color(...args): Color` | idem | 2 testes |
| 17.9.3.3 | ⚠️ `points(arr): Points` | idem | 2 testes |
| 17.9.3.4 | ⚠️ `group(attrs, block?): Group` | idem | 3 testes |
| 17.9.3.5 | ⚠️ `circle(cx, cy, r, attrs = {}): Circle` | idem | 2 testes |
| 17.9.3.6 | ⚠️ `ellipse(cx, cy, rx, ry, attrs = {}): Ellipse` | idem | 2 testes |
| 17.9.3.7 | ⚠️ `line(x1, y1, x2, y2, attrs = {}): Line` | idem | 2 testes |
| 17.9.3.8 | ⚠️ `polyline(points, attrs = {}): PolyLine` | idem | 2 testes |
| 17.9.3.9 | ⚠️ `rect(x, y, width, height, attrs = {}): Rect` | idem | 2 testes |
| 17.9.3.10 | ⚠️ `text(x, y, str, attrs = {}): Text` | idem | 2 testes |
| 17.9.3.11 | Re-exportar em `packages/core/mod.ts` | idem | `deno check` |

---

### 17.10 — `Painter`

**⚠️ RUBY: `Painter.rb` (~80 linhas)**

**Pré-requisitos:** 17.8, 17.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.10.1 | Criar `packages/core/src/painter/painter.ts` com `class Painter` | idem | `deno check` |
| 17.10.2 | Campos: `private width: number`, `private height: number`, `private elements: Element[]` | idem | `deno check` |
| 17.10.3 | ⚠️ Constructor `(width, height, block?)` — processa `block` (com ou sem arg) | idem | 4 testes |
| 17.10.4 | ⚠️ `to_svg(): XMLElement` — `<svg width="..." height="...">` + children | idem | 4 testes |
| 17.10.5 | Teste: `to_svg` vazio | idem | 1 teste |
| 17.10.6 | Teste: `to_svg` com 1 rect | idem | 1 teste |
| 17.10.7 | Teste: `block` com arg | idem | 1 teste |
| 17.10.8 | Teste: `block` sem arg (instance_eval) | idem | 1 teste |

---

### 17.11 — `FontMetrics` + `FontMetricsData` + `FontData`

**⚠️ RUBY: `Painter/FontMetrics.rb` (~200 linhas), `Painter/FontMetricsData.rb` (~250 linhas), `Painter/FontData.rb` (~1000 linhas)**
**🔎 CHEAT: §12 Categoria B (kerning)**

**Pré-requisitos:** 17.7.

#### 17.11.1 — `FontMetricsData`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.1.1 | Criar `packages/core/src/painter/font-metrics-data.ts` com `class FontMetricsData` | idem | `deno check` |
| 17.11.1.2 | Campos: `fontName`, `type`, `ptSize`, `height`, `charWidth: Record<string, number>`, `kerningDelta: Record<string, number>` | idem | `deno check` |
| 17.11.1.3 | ⚠️ `glyphWidth(c: string): number \| null` | idem | 3 testes |
| 17.11.1.4 | ⚠️ `averageWidth(): number` | idem | 2 testes |
| 17.11.1.5 | ⚠️ `toRuby(): string` — só para geração | idem | 1 teste |

#### 17.11.2 — `FontData` (constantes)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.2.1 | Criar `packages/core/src/painter/font-data.ts` | idem | `deno check` |
| 17.11.2.2 | ⚠️ `Font_LiberationSans_normal` — copiar byte-a-byte | idem | 1 teste |
| 17.11.2.3 | ⚠️ `Font_LiberationSans_italic` | idem | 1 teste |
| 17.11.2.4 | ⚠️ `Font_LiberationSans_bold` | idem | 1 teste |
| 17.11.2.5 | ⚠️ `Font_LiberationSans_bold_italic` | idem | 1 teste |

#### 17.11.3 — `FontMetrics`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.11.3.1 | Criar `packages/core/src/painter/font-metrics.ts` com `class FontMetrics` | idem | `deno check` |
| 17.11.3.2 | Campo `private fonts: Record<string, FontMetricsData>` | idem | `deno check` |
| 17.11.3.3 | ⚠️ Constructor: registra `Arial` = `LiberationSans`, `Arial-Italic`, `Arial-Bold`, `Arial-BoldItalic` | idem | 5 testes |
| 17.11.3.4 | ⚠️ `height(font, ptSize): number` — `fontMetrics.height * (ptSize / fontMetrics.ptSize) * (4/3)` | idem | 3 testes |
| 17.11.3.5 | ⚠️ `width(font, ptSize, str): number` — soma `glyphWidth` + kerning | idem | 5 testes |
| 17.11.3.6 | ⚠️ `private checkFontName(font)` | idem | 2 testes |
| 17.11.3.7 | Teste: `height Arial 12` | idem | 1 teste |
| 17.11.3.8 | Teste: `width string simples` | idem | 1 teste |
| 17.11.3.9 | Teste: `width com kerning` | idem | 1 teste |

---

## Bloco E — Substituição

### 17.12 — Substituir `SimpleXMLElement` por `XMLElement`

**⚠️ Contexto:** Fase 12 introduziu `SimpleXMLElement`. Agora removemos.

**Pré-requisitos:** 17.1, Fases 12, 14, 15.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.12.1 | Mover interface `XMLElementLike` para `packages/core/src/xml/xml-element-like.ts` | idem | `deno check` |
| 17.12.2 | `XMLElement` importa de lá | idem | `deno check` |
| 17.12.3 | Atualizar imports em `packages/richtext/src/**` | idem | `deno check` |
| 17.12.4 | Atualizar imports em `packages/report/src/**` | idem | `deno check` |
| 17.12.5 | Atualizar imports em `packages/report/src/gantt/**` | idem | `deno check` |
| 17.12.6 | Atualizar imports em `packages/core/tests/**` | idem | `deno check` |
| 17.12.7 | ⚠️ Deletar `SimpleXMLElement` de `packages/richtext/src/xml-like.ts` | idem | `grep -r "SimpleXMLElement"` retorna 0 |
| 17.12.8 | Re-rodar todos os testes | idem | verde |

---

### 17.13 — Substituir `HTMLDocument` mínimo

**⚠️ Contexto:** Fase 14 introduziu `HTMLDocument` mínimo. Agora substituímos.

**Pré-requisitos:** 17.4, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.13.1 | Deletar `packages/report/src/html-document.ts` (versão mínima) | idem | `deno check` |
| 17.13.2 | Atualizar imports em `packages/report/src/report.ts` | idem | `deno check` |
| 17.13.3 | Atualizar imports em `packages/report/src/**` | idem | `deno check` |
| 17.13.4 | Re-rodar testes da Fase 14 | idem | verde |

---

### 17.14 — Substituir `ICalendar` mínimo

**⚠️ Contexto:** Fase 14 introduziu `ICalendar` mínimo. Agora substituímos.

**Pré-requisitos:** 17.5, 17.6, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.14.1 | Deletar `packages/report/src/i-calendar.ts` (versão mínima) | idem | `deno check` |
| 17.14.2 | Atualizar imports em `packages/report/src/i-cal-report.ts` | idem | `deno check` |
| 17.14.3 | Atualizar imports em `packages/report/src/**` | idem | `deno check` |
| 17.14.4 | Re-rodar testes da Fase 14 | idem | verde |

---

### 17.15 — Substituir `Painter` mínimo

**⚠️ Contexto:** Fase 14 introduziu `Painter` mínimo (`PainterMin`). Agora substituímos.

**Pré-requisitos:** 17.10, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.15.1 | Deletar `packages/report/src/painter-min.ts` (versão mínima) | idem | `deno check` |
| 17.15.2 | Atualizar imports em `packages/report/src/chart-plotter.ts` | idem | `deno check` |
| 17.15.3 | Atualizar imports em `packages/report/src/**` | idem | `deno check` |
| 17.15.4 | Re-rodar testes da Fase 14 | idem | verde |

---

## Bloco F — Golden tests

### 17.16 — Golden tests (HTML/XML/ICalendar)

**⚠️ RUBY: `HTMLDocument.rb` + `XMLElement.rb` + `ICalendar.rb`**
**Usa:** `tj3` real

**Pré-requisitos:** 17.12–17.15, Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 17.16.1 | Atualizar `scripts/golden/README.md` com seções de `html-xml` e `ical` | idem | existe |
| 17.16.2 | Criar `scripts/golden/html-xml.rb` — constrói `HTMLDocument` com várias tags; serializa | idem | roda |
| 17.16.3 | Testa `XMLElement` + `XMLText` + `XMLComment` + `XMLBlob` | idem | 8 testes |
| 17.16.4 | Serializa em `html-xml.golden.json` | idem | JSON válido |
| 17.16.5 | Criar `scripts/golden/ical.rb` — constrói `ICalendar` com `Todo`, `Event`, `Journal` | idem | roda |
| 17.16.6 | Serializa em `ical.golden.json` | idem | JSON válido |
| 17.16.7 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 17.16.8 | Criar `packages/core/tests/golden/html-xml_golden_test.ts` e `ical_golden_test.ts` | idem | verde |
| 17.16.9 | Comparação byte-a-byte (apenas normalizar line endings) | idem | 4 testes |
| 17.16.10 | Cobertura ≥ 30 casos; commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Bloco G — Verificação final

### 17.17 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 17.17.1 | `deno task check-all` verde | exit 0 |
| 17.17.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 17.17.3 | `grep -r "SimpleXMLElement" packages/` retorna 0 | grep |
| 17.17.4 | `grep -r "PainterMin" packages/` retorna 0 | grep |
| 17.17.5 | ADR 029 criada e commitada | git log |
| 17.17.6 | `XMLElement`, `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`, `XMLDocument`, `HTMLDocument`, `ICalendar`, `Todo`, `Event`, `Journal`, `Person`, `Painter`, `Color`, `Points`, `FontMetrics` exportados em `packages/core/mod.ts` | `deno check` |
| 17.17.7 | `tests/integration/smoke_after_phase_17_test.ts` — cria `HTMLDocument('html5')`, gera string, verifica `<!DOCTYPE html>`; verifica Fase 16 (`Journal`) | 1 teste |
| 17.17.8 | Auditoria: cada subfase do plano `fase-17-html-xml.md` tem tarefas correspondentes | grep |
| 17.17.9 | Corrigir numeração em `fase-17-html-xml.md` (`### 21.X` → `### 17.X`, `ADR 028` → `ADR 029`) | grep |
| 17.17.10 | Teste agregado: `RichTextElement.to_html()` retorna `XMLElement` real (não `SimpleXMLElement`) | 1 teste |

---

## Notas para a IA

1. **Ordem:** 17.0 → 17.1 → 17.2 → 17.3 → 17.4 → 17.5 → 17.6 → 17.7 → 17.8 → 17.9 → 17.10 → 17.11 → 17.12 → 17.13 → 17.14 → 17.15 → 17.16 → 17.17.
2. **`XMLElement` substitui `SimpleXMLElement`.** Interface `XMLElementLike` mantida.
3. **Escape em `XMLText`:** `<`, `>`, `&`. **Não** escapa `"`.
4. **Escape em `XMLElement` attrs:** `&`, `"`.
5. **`XMLComment` canonicaliza `--`** em `-\-`.
6. **`HTMLDocument` 4 doctypes** — html5, strict, transitional, frameset.
7. **`HTMLElements` map estático.** Não usar `class_eval`.
8. **`ICalendar.foldLines`** com `LINELENGTH = 75`.
9. **`dateTime` sempre em UTC.**
10. **`Color.hsvToRgb`** com `hi = (h/60).floor % 6`.
11. **`Painter` gera SVG.** Sem Canvas.
12. **`FontData.rb` copiado byte-a-byte.**
13. **`FontMetrics.width`** aplica kerning.
14. **`SVGSupport.valuesToSVG`** com `font_size` → `font-size` + `pt`.
15. **Substituições em subfases separadas** (17.12–17.15).
16. **Golden tests byte-a-byte** — normalizar apenas line endings.
17. **Sem `any`.** Use `unknown` + narrowing.
18. **Commit por subfase.** `feat(core): xml-element`, etc.
19. **ADR 029** (não 028). **ADR 028** é Journal (Fase 16).
20. **Não modificar saída de reports** (Fase 14) — apenas imports.
21. **Não modificar `RichTextElement`** (Fase 12) — apenas imports.
22. **Não modificar `GanttChart`** (Fase 15) — apenas imports.
23. **`Painter` mínimo (`PainterMin`) deletado.** Fase 17 substitui.
24. **Copiar `FontData.rb` sem erro.** ~1000 linhas.
25. **`XMLBlob` preserva newlines com indentação.**

---

## Notas específicas por subfase

### 17.0 — ADR 029

- **Substituição de `XMLElementLike` por `XMLElement` real.**
- **`SimpleXMLElement`, `HTMLDocument` mínimo, `ICalendar` mínimo, `Painter` mínimo removidos.**

### 17.1 — XMLElement

- **Classe principal de XML.**
- **`to_s` com indentação.**
- **Subclasses: `XMLText`, `XMLNamedText`, `XMLComment`, `XMLBlob`.**

### 17.2 — XMLDocument

- **Container.**
- **`append`, `to_s`, `write`.**

### 17.3 — HTMLElements

- **Map estático de classes.**
- **~25 tags.**

### 17.4 — HTMLDocument

- **4 doctypes.**
- **`generateHead` com meta tags.**

### 17.5 — ICalendar

- **`Person`, `Component`, `ICalendar`.**
- **`foldLines` com `LINELENGTH = 75`.**

### 17.6 — Todo, Event, Journal

- **Subclasses de `Component`.**
- **`DUE`, `COMPLETED`, `PRIORITY`, `DTEND`.**

### 17.7 — Color, Points, SVGSupport

- **`Color` com 155 cores nomeadas.**
- **`hsvToRgb` e `rgbToHsv`.**
- **`valuesToSVG` com `font_size` → `font-size`.**

### 17.8 — Element, Group

- **Base dos elementos SVG.**
- **`to_svg` retorna `XMLElement`.**

### 17.9 — Primitives, BasicShapes, Text

- **~5 formas.**
- **~9 helpers de desenho.**

### 17.10 — Painter

- **Container de SVG.**
- **`to_svg` com `<svg>`.**

### 17.11 — FontMetrics

- **Dados de fontes (Liberation Sans).**
- **`width` com kerning.**

### 17.12–17.15 — Substituições

- **Cada substituição é uma subfase.**
- **Rodar testes das fases anteriores.**

### 17.16 — Golden tests

- **HTML/XML/ICalendar.**
- **~30 casos.**
- **Byte-a-byte.**

### 17.17 — Verificação

- **Sem `SimpleXMLElement` nem `PainterMin`.**
- **ADR 029.**

---

**Fim do arquivo de tarefas da Fase 17.**