# Fase 12 — RichText

> **Arquivo:** `docs/syntaxmesh/fases/fase-12-richtext.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 10–12 dias
> **Depende de:** Fases 2, 4, 10, 11
> **Bloqueia:** Fases 10 (parser precisa de `RichTextFactory`), 14, 16, 17, 21

---

## ⚠️ Nota de ordem de execução

A Fase 10 (Parser) depende de `newRichText()`, que cria objetos `RichTextIntermediate`. Durante a Fase 10, usamos a interface `RichTextFactory` (definida na Fase 3) com um **stub**. A Fase 12 implementa o `RichTextFactory` real e **substitui o stub**.

Ordem recomendada:
1. **Fase 10** — implementa `ProjectFileParser` usando `RichTextFactory` stub.
2. **Fase 11** — `Query` disponível.
3. **Fase 12** — `RichText` completo + `RTFHandlers` + integração com parser.

Após Fase 12, o parser passa a criar `RichTextIntermediate` reais.

---

## 1. Contexto

O TaskJuggler usa um dialeto do **MediaWiki markup** para todo texto rico. Isso aparece em:

- `note` (task).
- `headline`, `caption`, `header`, `footer`, `left`, `center`, `right`, `prolog`, `epilog` (reports).
- `summary`, `details` (journal entries / time sheets).
- `celltext`, `tooltip`, `listitem` (colunas de reports).
- Nomes de tasks/resources com markup (menos comum).
- Dashboard de recursos (`query_journal`).
- Journals (`query_journal`).

O markup suportado inclui:

- **Títulos**: `== H1 ==`, `=== H2 ===`, `==== H3 ====`, `===== H4 =====`.
- **Listas**: `* bullet`, `** bullet2`, `# numbered`, `## numbered2`.
- **Formatação inline**: `''itálico''`, `'''negrito'''`, `''''mono''''`, `'''''itálico+negrito'''''`.
- **Pre**: linhas começando com espaço.
- **Linha horizontal**: `----`.
- **Links externos**: `[http://example.com]`, `[http://example.com Texto]`.
- **Links internos**: `[[file]]`, `[[file Texto]]`, `[[func:path arg1 arg2]]`.
- **Cor de fonte**: `<fcol:red>texto</fcol>` (extensão TJ).
- **Arquivos**: `[[File:path.png]]` (extensão TJ).
- **`<nowiki>...</nowiki>`** — desabilita markup.
- **`<html>...</html>`** — HTML puro (blob).

### Fluxo

```
String markup MediaWiki
    ↓ RichText.generateIntermediateFormat()
RichTextIntermediate (árvore de RichTextElement)
    ↓ to_s() / to_html() / to_tagged()
String / XMLElement tree
```

### Por que manter RichText?

Decisão registrada no ADR 009 (Fase 1). `.tjp` originais do TaskJuggler usam MediaWiki markup. Se substituíssemos por Markdown, `.tjp` existentes quebrariam. RichText é mantido para **compatibilidade total**. Um `@syntaxmesh/markdown` (Fase 13) coexiste para conteúdo nativo futuro.

### Reuso de `TextParser`

O `RichTextParser` herda de `TextParser` (Fase 10). O `RichTextScanner` herda de `Scanner`. Ou seja, o FSM construído na Fase 10 é reutilizado — apenas com regras e tokens próprios.

### Function handlers

RichText suporta **funções customizadas** dentro do markup:
- `[[query:attribute=effort]]` — executa uma Query e inclui o resultado.
- `[[report:id=r1]]` — inclui outro report.
- `[[reportlink:id=r2]]` — link para outro report.
- `[[navigator:id=n1]]` — gera navigation bar.
- `[[example:file=X tag=Y]]` — inclui snippet de arquivo de exemplo.

Cada função tem um `RichTextFunctionHandler`.

### RichText e Fase 11

`RTFQuery` usa `Query`. `RTFReport` usa `Report.generateIntermediateFormat()` (Fase 14). Isso cria uma **dependência circular**: RichText precisa de Report, Report precisa de RichText.

**Solução:** nesta fase, `RTFReport` e `RTFReportLink` são **stubs** que lançam `NotYetImplementedError`. Fase 14 completa.

---

## 2. Objetivo

Ao final desta fase:

- `RichText`, `RichTextIntermediate`, `RichTextElement`, `RichTextImage`.
- `RichTextScanner`, `RichTextParser`, `RichTextSyntaxRules`.
- `RichTextSnip`, `RichTextDocument`, `TOCEntry`, `TableOfContents`.
- `RichTextFunctionHandler` (abstract), `FunctionExample`.
- `RTFHandlers`, `RTFWithQuerySupport`, `RTFQuery`, `RTFNavigator`.
- Stubs: `RTFReport`, `RTFReportLink` (Fase 14).
- `RichTextFactory` implementado (substitui stub da Fase 10).
- Integração com `ProjectFileParser` (`newRichText`).
- **≥ 200 testes unitários** + **≥ 30 golden tests** (markup do `TestSuite/RichText/`).
- ADR 023 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/RichText/` (e um em `lib/taskjuggler/`):

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `RichText.rb` | ~250 | Média | **Crítica** |
| `RichText/Element.rb` | ~700 | **Altíssima** | **Crítica** |
| `RichText/Parser.rb` | ~80 | Baixa | **Crítica** |
| `RichText/Scanner.rb` | ~400 | **Alta** | **Crítica** |
| `RichText/SyntaxRules.rb` | ~600 | **Altíssima** | **Crítica** |
| `RichText/Snip.rb` | ~130 | Média | **Crítica** |
| `RichText/Document.rb` | ~180 | Média | Alta |
| `RichText/TOCEntry.rb` | ~80 | Baixa | Média |
| `RichText/TableOfContents.rb` | ~70 | Baixa | Média |
| `RichText/FunctionHandler.rb` | ~50 | Trivial | **Crítica** |
| `RichText/FunctionExample.rb` | ~80 | Baixa | Média |
| `RichText/RTFHandlers.rb` | ~30 | Trivial | **Crítica** |
| `RichText/RTFWithQuerySupport.rb` | ~40 | Baixa | **Crítica** |
| `RichText/RTFQuery.rb` | ~180 | Média | **Crítica** |
| `RichText/RTFNavigator.rb` | ~50 | Baixa | Média |
| `RichText/RTFReport.rb` | ~80 | Média | Stub (Fase 14) |
| `RichText/RTFReportLink.rb` | ~80 | Média | Stub (Fase 14) |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/14-blueprint-others.md` | §5.1 RichText | Estrutura |
| `docs/tj3-engine/14-blueprint-others.md` | §5.3 Element | Árvore |
| `docs/tj3-engine/14-blueprint-others.md` | §5.5 RTFHandlers | Handlers |
| `docs/tj3-engine/07-blueprint-engine6.md` | §5 RichText | Visão geral |

### 3.3 Casos de teste Ruby

- `docs/taskjuggler/test/TestSuite/RichText/` — arquivos de teste de markup.
- `docs/Learning/mwe001-009/` — notas com markup.

### 3.4 Golden tests

Script Ruby `richtext.rb` que processa arquivos de markup e serializa o HTML/tagged/plain resultante.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 RichText e Parser compartilhado

Ruby: `RichText.@@parser` é **singleton** (parse-time). Uma instância é reutilizada via `reuse(rti, counter, tokenSet)`.

TS: mesma decisão. `RichTextParser` estático.

### 4.2 `RichTextElement` — árvore

O `RichTextElement` é o nó da árvore. Cada nó tem `category`, `children`, `data`, `appendSpace`. O `category` é uma string que identifica o tipo (ex: `'title1'`, `'bold'`, `'href'`).

**Nota:** os `data` são muito heterogêneos. Números para títulos, strings para `href`, `RichTextImage` para `img`, arrays `[name, args]` para functions. Usar `data: unknown` + type guards.

### 4.3 `RichTextIntermediate.to_html` é usado por `XMLDocument`

O `to_html` retorna uma **árvore de `XMLElement`** (Fase 17). Como `XMLElement` ainda não existe, **nesta fase** `to_html` retorna uma string HTML **manualmente construída**.

**Alternativa:** definir interface `XMLElementLike` em `packages/richtext/src/xml-like.ts`:

```ts
interface XMLElementLike {
  tag: string;
  attrs: Record<string, string>;
  children: XMLElementLike[] | string[];
  toHTML(): string;
}
```

E `to_html` retorna `XMLElementLike`. Fase 17 cria `XMLElement` real que implementa `XMLElementLike`.

**Decisão:** usar interface `XMLElementLike`. Fase 17 substitui.

### 4.4 `RichTextScanner` — modos

7 modos: `:bop`, `:bol`, `:inline`, `:nowiki`, `:html`, `:ref`, `:href`, `:func`.

Cada modo tem seus próprios patterns. Replicar fielmente.

### 4.5 `RichTextParser` herda de `TextParser`

`RichTextParser extends TextParser` (Fase 10). Reuso de `Pattern`, `Rule`, `State`, `StackElement`.

### 4.6 `RichTextSyntaxRules` — patterns

~40 patterns, com modos específicos. Replicar.

### 4.7 `RichTextFunctionHandler` — abstract

Todos os handlers estendem. Interface:

```ts
abstract class RichTextFunctionHandler {
  readonly function: string;
  blockFunction: boolean;
  readonly sourceFileInfo: SourceFileInfo | null;
  abstract to_s(args: Record<string, string>): string;
  abstract to_html(args: Record<string, string>): XMLElementLike;
  abstract to_tagged(args: Record<string, string>): string;
}
```

### 4.8 `RTFHandlers.create(project, sfi)` — factory

Retorna array com:
- `RTFNavigator`
- `RTFQuery`
- `RTFReport`
- `RTFReportLink`

Cada um recebe `project` e `sfi`.

### 4.9 `RTFQuery` usa `Query` (Fase 11)

Parse dos args: `attribute`, `property`, `scenario`, `family`, `start`, `end`, `loadunit`, `numberformat`, `currencyformat`, `timeformat`, `journalmode`, `journalattributes`.

Replicar.

### 4.10 `RTFReport` — stub nesta fase

`RTFReport.to_html(args)` chama `report.generateIntermediateFormat()`. **Fase 14** implementa. Nesta fase, lança `NotYetImplementedError`.

### 4.11 `RTFReportLink` — stub nesta fase

Idem.

### 4.12 `RTFNavigator` — requer `Navigator` (Fase 14)

`RTFNavigator.to_html` busca `project.navigators[id]`. `Navigator` vem em Fase 14. Nesta fase, lança `NotYetImplementedError` se `Navigator` não existir.

**Alternativa:** implementar agora com `project.navigators` que é `Map<string, unknown>` (stub). Fase 14 preenche.

**Decisão:** lançar `NotYetImplementedError`.

### 4.13 `RichTextImage` — extensão TJ

Nova classe (não existe no Ruby como standalone — é implícito). Representa imagens em markup.

### 4.14 `TOCEntry` e `TableOfContents` — simples

Nesta fase, apenas estrutura. HTML rendering é usado por `RichTextDocument`.

### 4.15 `RichTextDocument.generate` — framework

Ruby `RichTextDocument` é abstrata; `UserManual` e outros a estendem. Nesta fase, apenas a classe base.

### 4.16 Regex e `str.replace` — atenção

O `RichTextScanner` usa regex específicas. TS tem regex similar, mas **comportamento em multiline** (`m` flag) e grupos pode variar. Testes exaustivos.

### 4.17 `String#each_utf8_char` — adaptação

Fase 16 tem `UTF8String`. Nesta fase, apenas usar `for (const c of str)` (iteração por code point).

### 4.18 Erros

`RichText` usa `MessageHandler` (Fase 9) via `error('id', 'message')`. Replicar.

### 4.19 `XMLText`, `XMLComment`, `XMLBlob` — stubs

Usados por `RichTextElement.to_html`. Nesta fase, definir classes simples em `xml-like.ts`.

---

## 5. Subfases detalhadas

**Bloco A — Core** (16.0–16.6)
**Bloco B — Documents** (16.7–16.10)
**Bloco C — Function Handlers** (16.11–16.17)
**Bloco D — Integração** (16.18)
**Bloco E — Golden tests** (16.19)

---

### Bloco A — Core

---

### 12.0 — ADR 023 (RichText e function handlers)

#### Contexto

O `RichText` é um dos componentes mais complexos do TaskJuggler. Duas decisões importantes:

1. **Reuso de `TextParser`** — `RichTextParser` herda de `TextParser`. Ou seja, reutiliza o FSM da Fase 10.
2. **Function handlers** — markup pode chamar funções (query, report, etc.) que executam lógica de projeto.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/023-richtext-handlers.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/023-richtext-handlers.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** RichText + TextParser + function handlers.
- [ ] **Decisões:**
  - RichText mantido para compatibilidade `.tjp` (reforça ADR 009).
  - `RichTextParser` herda de `TextParser`.
  - Function handlers como classe abstrata + subclasses.
  - `RTFReport` e `RTFReportLink` são stubs até Fase 14.
- [ ] **Alternativas:** substituir por Markdown (descartada), parser próprio (descartada).
- [ ] **Consequências:** reuso máximo; acoplamento com Fase 10/11.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md`.
- `docs/tj3-engine/14-blueprint-others.md` — §5.

#### Critério de aceite

- ADR 023 criado.
- Tabela atualizada.

---

### 12.1 — `XMLElementLike` + primitivas

#### Contexto

`RichTextElement.to_html` retorna uma árvore de `XMLElement` (Fase 17). Como não existe ainda, precisamos de uma interface + implementações simples.

#### Objetivo

Criar `XMLElementLike`, `XMLTextLike`, `XMLCommentLike`, `XMLBlobLike`.

#### Arquivos

- `packages/richtext/src/xml-like.ts`
- `packages/richtext/tests/xml-like_test.ts`

#### Requisitos

- [ ] `interface XMLElementLike`:
  - `tag: string`
  - `attrs: Record<string, string>`
  - `children: Array<XMLElementLike | string>`
  - `append(child): void`
  - `toHTML(): string`
- [ ] `class SimpleXMLElement implements XMLElementLike`:
  - Constructor `(tag, attrs = {})`.
  - `append(child)`.
  - `toHTML()` — serializa com indentação mínima.
- [ ] `function createText(content: string): string` — texto simples.
- [ ] `function createComment(content: string): XMLElementLike` — comentário.
- [ ] `function createBlob(content: string): XMLElementLike` — blob.
- [ ] Escapes: `&`, `<`, `>`, `"` em atributos e conteúdo.

**Nota:** quando a Fase 17 criar `XMLElement` real, ele implementará `XMLElementLike`. Substituição sem quebrar.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/XMLElement.rb` — comportamento de `to_s`.

#### Critério de aceite

```ts
const div = new SimpleXMLElement("div", { class: "foo" });
div.append("Hello");
assertEquals(div.toHTML(), '<div class="foo">Hello</div>');
```

#### Testes

- `xml-like_test.ts`:
  - `it("cria div vazio")`.
  - `it("append texto")`.
  - `it("append filho")`.
  - `it("escapa &<>")`.
  - `it("escapa em attr")`.
  - `it("aninha")`.

---

### 12.2 — `RichTextImage`

#### Contexto

Representa imagens em markup (`[[File:path.png alt=... middle]]`).

#### Objetivo

Implementar `RichTextImage`.

#### Arquivos

- `packages/richtext/src/rich-text-image.ts`
- `packages/richtext/tests/rich-text-image_test.ts`

#### Requisitos

- [ ] `class RichTextImage`:
  - `readonly fileName: string`
  - `altText: string | null`
  - `verticalAlign: string | null`
- [ ] Constructor `(fileName)`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Element.rb` — `RichTextImage`.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-image_test.ts`:
  - `it("constructor")`.
  - `it("altText/verticalAlign mutáveis")`.

---

### 12.3 — `RichTextElement`

#### Contexto

O nó da árvore. Categoria + children + data + appendSpace.

#### Objetivo

Implementar `RichTextElement` com `to_s`, `to_html`, `to_tagged`, `cleanUp`, `empty`, `tableOfContents`, `internalReferences`.

#### Arquivos

- `packages/richtext/src/rich-text-element.ts`
- `packages/richtext/tests/rich-text-element_test.ts`

#### Requisitos

**Categorias suportadas:**

- **Estruturais:** `richtext`, `paragraph`, `pre`, `hline`.
- **Títulos:** `title1`, `title2`, `title3`, `title4`.
- **Listas:** `bulletlist1-4`, `bulletitem1-4`, `numberlist1-4`, `numberitem1-4`.
- **Inline:** `italic`, `bold`, `fontCol`, `code`, `text`, `htmlblob`.
- **Links:** `href`, `ref`.
- **Imagens:** `img`.
- **Functions:** `blockfunc`, `inlinefunc`.

**`class RichTextElement`:**

- [ ] `richText: RichTextIntermediate` (referência ao container).
- [ ] `category: string`.
- [ ] `children: Array<RichTextElement | string>`.
- [ ] `data: unknown`.
- [ ] `appendSpace: boolean`.
- [ ] Constructor `(rti, category, arg?)`.
- [ ] `cleanUp(): RichTextElement`:
  - Se `richtext` tem 1 filho `paragraph`, promove children.
- [ ] `empty(): boolean` — `richtext` sem children.
- [ ] `tableOfContents(toc: TableOfContents, fileName: string): void`.
- [ ] `internalReferences(): string[]`.
- [ ] `to_s(): string` — plain text.
- [ ] `to_tagged(): string` — `<h1>`, `<p>`, etc.
- [ ] `to_html(): XMLElementLike`.
- [ ] `children_to_s(): string`.
- [ ] Private `convertToID(text: string): string`.
- [ ] Private `sTitle(level): string`.
- [ ] Private `htmlTitle(level): XMLElementLike`.
- [ ] Private `htmlObject(): XMLElementLike | null`.
- [ ] Private `textBlockFormat(indent, label, str, width): string`.

**Detalhes por categoria:**

- `richtext`: `<div>` ou `<span>` (depende de `blockMode`).
- `title1-4`: `<h1>-<h4>` com `id` e numeração opcional.
- `hline`: `<hr>`.
- `paragraph`: `<p>`.
- `pre`: `<div><pre>...</pre></div>`.
- `bulletlist1-4`: `<ul>`.
- `bulletitem1-4`: `<li>`.
- `numberlist1-4`: `<ol>`.
- `numberitem1-4`: `<li>`.
- `img`: `<object>` com data e alt.
- `ref`: `<a href=".html#...">`.
- `href`: `<a href="..." target="...">`.
- `blockfunc` / `inlinefunc`: dispatch para `functionHandler(name).to_html(args)`.
- `italic`: `<i>`.
- `bold`: `<b>`.
- `fontCol`: `<span style="color:...">`.
- `code`: `<code>`.
- `htmlblob`: raw HTML.
- `text`: texto puro.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Element.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-element_test.ts`:
  - `describe("RichTextElement")`
    - `it("cleanUp")`.
    - `it("empty")`.
    - `it("to_s para cada categoria")`.
    - `it("to_html para cada categoria")`.
    - `it("to_tagged para cada categoria")`.
    - `it("children_to_s")`.
    - `it("tableOfContents")`.
    - `it("internalReferences")`.

---

### 12.4 — `RichTextIntermediate`

#### Contexto

Container da árvore. Expõe `to_s`, `to_html`, `to_tagged`, `setQuery`, `tableOfContents`, `internalReferences`.

#### Objetivo

Implementar `RichTextIntermediate`.

#### Arquivos

- `packages/richtext/src/rich-text-intermediate.ts`
- `packages/richtext/tests/rich-text-intermediate_test.ts`

#### Requisitos

- [ ] `class RichTextIntermediate`:
  - `richText: RichText`
  - `tree: RichTextElement | null`
  - `blockMode: boolean` (default `true`)
  - `sectionNumbers: boolean` (default `true`)
  - `lineWidth: number` (default 80)
  - `indent: number`
  - `titleIndent: number`
  - `parIndent: number`
  - `listIndent: number` (default 1)
  - `preIndent: number`
  - `linkTarget: string | null`
  - `cssClass: string | null`
  - `functionHandlers: Map<string, RichTextFunctionHandler>`
- [ ] `registerFunctionHandler(handler): void`.
- [ ] `functionHandler(name: string): RichTextFunctionHandler | null`.
- [ ] `empty(): boolean`.
- [ ] `tableOfContents(toc: TableOfContents, fileName: string): void`.
- [ ] `internalReferences(): string[]`.
- [ ] `to_s(): string` — plain text.
- [ ] `to_html(): XMLElementLike` — tree.
- [ ] `to_tagged(): string`.
- [ ] `setQuery(query: Query): void` — propaga para handlers que suportam.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText.rb` — `RichTextIntermediate`.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-intermediate_test.ts`:
  - `it("empty")`.
  - `it("to_s")`.
  - `it("to_html")`.
  - `it("setQuery propaga")`.
  - `it("sectionNumbers afeta to_s")`.

---

### 12.5 — `RichTextScanner`

#### Contexto

Lexer de markup. 7 modos.

#### Objetivo

Implementar `RichTextScanner extends Scanner`.

#### Arquivos

- `packages/richtext/src/rich-text-scanner.ts`
- `packages/richtext/tests/rich-text-scanner_test.ts`

#### Requisitos

**Modos:** `:bop`, `:bol`, `:inline`, `:nowiki`, `:html`, `:ref`, `:href`, `:func`.

**Tokens:** `LINEBREAK`, `SPACE`, `WORD`, `BOLD`, `ITALIC`, `CODE`, `BOLDITALIC`, `PRE`, `HREF`, `HREFEND`, `REF`, `REFEND`, `HLINE`, `HTMLBLOB`, `FCOLSTART`, `FCOLEND`, `QUERY`, `INLINEFUNCSTART`, `INLINEFUNCEND`, `BLOCKFUNCSTART`, `BLOCKFUNCEND`, `ID`, `STRING`, `TITLE1-4`, `TITLE1END-4END`, `BULLET1-4`, `NUMBER1-4`.

**Métodos:**

- [ ] `space(type, match)` — se contém `\n`, muda para `:bol`.
- [ ] `linebreak(type, match)` — muda para `:bop`.
- [ ] `inlineMode(type, match)` — muda para `:inline`.
- [ ] `titleStart(type, match)` — retorna `TITLE<n>`.
- [ ] `titleEnd(type, match)` — retorna `TITLE<n>END`.
- [ ] `bullet(type, match)` — retorna `BULLET<n>`.
- [ ] `number(type, match)` — retorna `NUMBER<n>`.
- [ ] `fontColorStart(type, match)` — extrai cor, valida.
- [ ] `fontColorEnd`.
- [ ] `quotes(type, match)` — 2/3/4/5 quotes.
- [ ] `htmlStart`, `htmlEnd`.
- [ ] `nowikiStart`, `nowikiEnd`.
- [ ] `functionStart`, `functionEnd`.
- [ ] `pre`.
- [ ] `dqString`, `sqString`.
- [ ] `query`.
- [ ] `hrefStart`, `hrefEnd`.
- [ ] `refStart`, `refEnd`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Scanner.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-scanner_test.ts`:
  - `it("título 1")`.
  - `it("título 2")`.
  - `it("bullet")`.
  - `it("number")`.
  - `it("itálico/negrito/mono")`.
  - `it("href")`.
  - `it("ref")`.
  - `it("fcol")`.
  - `it("nowiki")`.
  - `it("html")`.
  - `it("pre")`.
  - `it("query inline")`.
  - `it("inline function")`.
  - `it("block function")`.

---

### 12.6 — `RichTextParser` + `RichTextSyntaxRules`

#### Contexto

Parser de markup, herda de `TextParser`.

#### Objetivo

Implementar `RichTextParser` + `RichTextSyntaxRules`.

#### Arquivos

- `packages/richtext/src/rich-text-parser.ts`
- `packages/richtext/src/rich-text-syntax-rules.ts`
- `packages/richtext/tests/rich-text-parser_test.ts`

#### Requisitos

**`RichTextParser`:**

- [ ] `class RichTextParser extends TextParser`:
  - `richTextI: RichTextIntermediate`
  - `sectionCounter: number[]`
  - `numberListCounter: number[]`
- [ ] Constructor `(rti, sectionCounter = [0,0,0,0], tokenSet = null)`.
- [ ] `reuse(rti, sectionCounter, tokenSet): void`.
- [ ] `open(text: string): void`.
- [ ] `nextToken(): Token`.
- [ ] `returnToken(token): void`.
- [ ] `initRules(): void` — chama todas as `rule_*`.

**`RichTextSyntaxRules`** — funções `rule_*`:

- [ ] `rule_richtext`.
- [ ] `rule_sections`.
- [ ] `rule_section`.
- [ ] `rule_headlines`.
- [ ] `rule_pre`.
- [ ] `rule_title1-4`.
- [ ] `rule_bulletList1-4`.
- [ ] `rule_numberList1-4`.
- [ ] `rule_paragraph`.
- [ ] `rule_text`.
- [ ] `rule_textWithSpace`.
- [ ] `rule_plainTextWithLinks`.
- [ ] `rule_moreRefToken`.
- [ ] `rule_refToken`.
- [ ] `rule_wordWithQueries`.
- [ ] `rule_plainText`.
- [ ] `rule_plainTextWithQueries`.
- [ ] `rule_htmlBlob`.
- [ ] `rule_space`.
- [ ] `rule_blankLines`.
- [ ] `rule_blockFunction`.
- [ ] `rule_inlineFunction`.
- [ ] `rule_functionArguments`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Parser.rb`.
- `docs/taskjuggler/lib/taskjuggler/RichText/SyntaxRules.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-parser_test.ts`:
  - `it("parse título")`.
  - `it("parse bullet list")`.
  - `it("parse number list")`.
  - `it("parse itálico")`.
  - `it("parse negrito")`.
  - `it("parse href")`.
  - `it("parse ref")`.
  - `it("parse img")`.
  - `it("parse fcol")`.
  - `it("parse nowiki")`.
  - `it("parse html")`.
  - `it("parse inlinefunc")`.
  - `it("parse blockfunc")`.

---

### Bloco B — Documents

---

### 12.7 — `TOCEntry`

#### Contexto

Entrada em um TableOfContents.

#### Objetivo

Implementar `TOCEntry`.

#### Arquivos

- `packages/richtext/src/toc-entry.ts`
- `packages/richtext/tests/toc-entry_test.ts`

#### Requisitos

- [ ] `class TOCEntry`:
  - `readonly number: string`
  - `readonly title: string`
  - `readonly file: string`
  - `readonly tag: string | null`
- [ ] Constructor `(number, title, file, tag?)`.
- [ ] `to_html(): XMLElementLike[]`.
- [ ] Private `level(): number` — conta `.` em `number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/TOCEntry.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `toc-entry_test.ts`:
  - `it("constructor")`.
  - `it("to_html nível 0")`.
  - `it("to_html nível 1")`.

---

### 12.8 — `TableOfContents`

#### Contexto

Lista de entradas TOC.

#### Objetivo

Implementar `TableOfContents`.

#### Arquivos

- `packages/richtext/src/table-of-contents.ts`
- `packages/richtext/tests/table-of-contents_test.ts`

#### Requisitos

- [ ] `class TableOfContents`:
  - `private entries: TOCEntry[]`
- [ ] `addEntry(entry): void`.
- [ ] `[Symbol.iterator](): Iterator<TOCEntry>`.
- [ ] `to_html(): XMLElementLike`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/TableOfContents.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `table-of-contents_test.ts`:
  - `it("addEntry")`.
  - `it("iteração")`.
  - `it("to_html")`.

---

### 12.9 — `RichTextSnip`

#### Contexto

Fragmento de markup lido de arquivo. Usado por `RichTextDocument`.

#### Objetivo

Implementar `RichTextSnip`.

#### Arquivos

- `packages/richtext/src/rich-text-snip.ts`
- `packages/richtext/tests/rich-text-snip_test.ts`

#### Requisitos

- [ ] `class RichTextSnip`:
  - `name: string`
  - `prevSnip: RichTextSnip | null`
  - `nextSnip: RichTextSnip | null`
  - `private richText: RichTextIntermediate`
  - `private document: RichTextDocument`
- [ ] Constructor `(document, fileName, sectionCounter)`.
  - Lê o arquivo, cria `RichText`, gera `RichTextIntermediate`.
- [ ] `linkTarget=` setter.
- [ ] `cssClass=` setter.
- [ ] `tableOfContents(toc, fileName): void`.
- [ ] `internalReferences(): string[]`.
- [ ] `generateHTML(directory = ''): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Snip.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-snip_test.ts`:
  - `it("carrega de arquivo")`.
  - `it("tableOfContents")`.
  - `it("internalReferences")`.

---

### 12.10 — `RichTextDocument` (abstract)

#### Contexto

Documento composto por snips. Gera TOC e HTML consolidado.

#### Objetivo

Implementar `RichTextDocument` (abstract).

#### Arquivos

- `packages/richtext/src/rich-text-document.ts`
- `packages/richtext/tests/rich-text-document_test.ts`

#### Requisitos

- [ ] `abstract class RichTextDocument`:
  - `private snippets: RichTextSnip[]`
  - `private dirty: boolean`
  - `private sectionCounter: number[]`
  - `linkTarget: string | null`
  - `private toc: TableOfContents | null`
  - `private anchors: string[]`
  - `functionHandlers: RichTextFunctionHandler[]`
  - `private references: Map<string, string[]>`
- [ ] `registerFunctionHandler(handler): void`.
- [ ] `addSnip(file: string): RichTextSnip`.
- [ ] `tableOfContents(): void`.
- [ ] `checkInternalReferences(): void`.
- [ ] `generateHTML(directory = ''): void`.
- [ ] Private `crossReference(): void`.
- [ ] Private `generateHTMLTableOfContents(directory): void`.

**Abstract methods** (subclasses implementam):

- [ ] `abstract generateStyleSheet(): XMLElementLike`.
- [ ] `abstract generateHTMLCover(): XMLElementLike[]`.
- [ ] `abstract generateHTMLHeader(): XMLElementLike`.
- [ ] `abstract generateHTMLFooter(): XMLElementLike`.
- [ ] `abstract generateHTMLNavigationBar(...): XMLElementLike[]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Document.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `rich-text-document_test.ts`:
  - `it("addSnip")`.
  - `it("tableOfContents")`.
  - `it("crossReference")`.
  - `it("generateHTML")`.

---

### Bloco C — Function Handlers

---

### 12.11 — `RichTextFunctionHandler` (abstract)

#### Contexto

Base para handlers.

#### Objetivo

Implementar `RichTextFunctionHandler`.

#### Arquivos

- `packages/richtext/src/handlers/function-handler.ts`

#### Requisitos

- [ ] `abstract class RichTextFunctionHandler`:
  - `readonly function: string`
  - `blockFunction: boolean` (default `false`)
  - `readonly sourceFileInfo: SourceFileInfo | null`
- [ ] Constructor `(function, sfi = null)`.
- [ ] `abstract to_s(args: Record<string, string>): string`.
- [ ] `abstract to_html(args: Record<string, string>): XMLElementLike`.
- [ ] `abstract to_tagged(args: Record<string, string>): string`.
- [ ] `dup(): RichTextFunctionHandler`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/FunctionHandler.rb`.

#### Critério de aceite

Análogo.

---

### 12.12 — `RichTextFunctionExample`

#### Contexto

Handler `[[example:file=X tag=Y]]` que inclui snippets de arquivo.

#### Objetivo

Implementar `RichTextFunctionExample`.

#### Arquivos

- `packages/richtext/src/handlers/function-example.ts`
- `packages/richtext/tests/function-example_test.ts`

#### Requisitos

- [ ] `class RichTextFunctionExample extends RichTextFunctionHandler`:
  - `function = 'example'`
  - `blockFunction = true`
- [ ] `to_s(args)` → `''`.
- [ ] `to_html(args)`:
  - `file = args.file`, `tag = args.tag`.
  - Carrega `docs/taskjuggler/test/TestSuite/Syntax/Correct/<file>.tjp`.
  - Extrai snippet com `tag`.
  - Retorna `<div class="codeframe"><pre class="code">...</pre></div>`.
- [ ] `to_tagged(args)` → `null`.

**Nota:** `TjpExample` (Fase 16) faz o parse de snippets. Nesta fase, apenas carregar o arquivo.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/FunctionExample.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `function-example_test.ts`:
  - `it("to_s vazio")`.
  - `it("to_html com file")`.
  - `it("erro se file ausente")`.

---

### 12.13 — `RTFWithQuerySupport`

#### Contexto

Base para handlers que usam `Query`.

#### Objetivo

Implementar `RTFWithQuerySupport`.

#### Arquivos

- `packages/richtext/src/handlers/rtf-with-query-support.ts`

#### Requisitos

- [ ] `abstract class RTFWithQuerySupport extends RichTextFunctionHandler`:
  - `protected query: Query | null`
- [ ] `setQuery(query: Query): void` — duplica a query.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb`.

#### Critério de aceite

Análogo.

---

### 12.14 — `RTFQuery`

#### Contexto

Handler `[[query:...]]` que executa uma Query.

#### Objetivo

Implementar `RTFQuery`.

#### Arquivos

- `packages/richtext/src/handlers/rtf-query.ts`
- `packages/richtext/tests/rtf-query_test.ts`

#### Requisitos

- [ ] `class RTFQuery extends RTFWithQuerySupport`:
  - `function = 'query'`
  - `blockFunction = false`
- [ ] `to_s(args)` — executa query, retorna string.
- [ ] `to_html(args)` — executa query, retorna `rti.to_html()` ou `text`.
- [ ] `to_tagged(args)` → `null`.
- [ ] Private `prepareQuery(args): Query | null`:
  - Valida args (`attribute`, `currencyformat`, `end`, `family`, `journalattributes`, `journalmode`, `loadunit`, `numberformat`, `property`, `scenario`, `scopeproperty`, `start`, `timeformat`).
  - Aplica cada arg à `Query`.
  - Chama `query.process()`.
- [ ] Private `recreateQuerySyntax(args): string`.
- [ ] Private `setPropertyType(query, args): void`.
- [ ] Private `setLoadUnit(query, args): void`.
- [ ] Private `setScenarioIdx(query, args): void`.
- [ ] Private `setJournalMode(query, args): void`.
- [ ] Private `setJournalAttributes(query, args): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/RTFQuery.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `rtf-query_test.ts`:
  - `it("to_s com attribute")`.
  - `it("to_html com rti")`.
  - `it("erro se attribute ausente")`.
  - `it("erro se family inválida")`.
  - `it("setLoadUnit")`.
  - `it("setJournalMode")`.

---

### 12.15 — `RTFReport` (stub)

#### Contexto

Handler `[[report:...]]`. Requer `Report.generateIntermediateFormat` (Fase 14).

#### Objetivo

Stub.

#### Arquivos

- `packages/richtext/src/handlers/rtf-report.ts`
- `packages/richtext/tests/rtf-report_test.ts`

#### Requisitos

- [ ] `class RTFReport extends RichTextFunctionHandler`:
  - `function = 'report'`
  - `blockFunction = true`
- [ ] `to_s(args)` → `''`.
- [ ] `to_html(args)`:
  - **Stub nesta fase:** `throw new NotYetImplementedError("RTFReport requer Fase 14")`.
- [ ] `to_tagged(args)` → `null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/RTFReport.rb`.

#### Critério de aceite

- Método lança erro com mensagem clara.

#### Testes

- `rtf-report_test.ts`:
  - `it("to_html lança NotYetImplementedError")`.

---

### 12.16 — `RTFReportLink` (stub)

#### Contexto

Handler `[[reportlink:...]]`. Requer `Report` (Fase 14).

#### Objetivo

Stub.

#### Arquivos

- `packages/richtext/src/handlers/rtf-report-link.ts`
- `packages/richtext/tests/rtf-report-link_test.ts`

#### Requisitos

- [ ] `class RTFReportLink extends RTFWithQuerySupport`:
  - `function = 'reportlink'`
- [ ] `to_s(args)` — stub.
- [ ] `to_html(args)` — stub que lança.
- [ ] `to_tagged(args)` → `null`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/RTFReportLink.rb`.

#### Critério de aceite

- Método lança erro.

#### Testes

- `rtf-report-link_test.ts`:
  - `it("to_html lança NotYetImplementedError")`.

---

### 12.17 — `RTFNavigator` + `RTFHandlers`

#### Contexto

`RTFNavigator` handler `[[navigator:...]]`. `RTFHandlers` factory que cria todos.

#### Objetivo

Implementar ambos.

#### Arquivos

- `packages/richtext/src/handlers/rtf-navigator.ts`
- `packages/richtext/src/handlers/rtf-handlers.ts`
- `packages/richtext/tests/rtf-navigator_test.ts`
- `packages/richtext/tests/rtf-handlers_test.ts`

#### Requisitos

**`RTFNavigator`:**

- [ ] `function = 'navigator'`
- [ ] `blockFunction = true`
- [ ] `to_s(args)` → `''`.
- [ ] `to_html(args)`:
  - `id = args.id` — obrigatório.
  - `navigator = project.getNavigator(id)`.
  - **Stub nesta fase:** se `!navigator`, `throw NotYetImplementedError("Navigator requer Fase 14")`. Senão, `navigator.to_html()`.
- [ ] `to_tagged(args)` → `null`.

**`RTFHandlers`:**

- [ ] `static create(project: Project, sfi: SourceFileInfo | null): RichTextFunctionHandler[]`:
  - `[new RTFNavigator(project, sfi), new RTFQuery(project, sfi), new RTFReport(project, sfi), new RTFReportLink(project, sfi)]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/RTFNavigator.rb`.
- `docs/taskjuggler/lib/taskjuggler/RichText/RTFHandlers.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `rtf-navigator_test.ts`:
  - `it("to_html lança se navigator não implementado")`.
- `rtf-handlers_test.ts`:
  - `it("create retorna 4 handlers")`.

---

### Bloco D — Integração

---

### 12.18 — `RichText` + `RichTextFactory` + integração com parser

#### Contexto

Agora implementamos o `RichText` top-level (o parser de markup). E integramos com `ProjectFileParser` via `RichTextFactory`.

#### Objetivo

Implementar `RichText` e `RichTextFactory`.

#### Arquivos

- `packages/richtext/src/rich-text.ts`
- `packages/richtext/src/factory.ts`
- `packages/richtext/mod.ts` (exports)
- `packages/parser/src/parser/project-file-parser.ts` (integração)
- `packages/richtext/tests/rich-text_test.ts`
- `packages/richtext/tests/factory_test.ts`

#### Requisitos

**`RichText`:**

- [ ] `class RichText`:
  - `readonly inputText: string`
  - `private functionHandlers: RichTextFunctionHandler[]`
  - `static parser: RichTextParser | null`
- [ ] Constructor `(text: string, functionHandlers: RichTextFunctionHandler[] = [])`.
- [ ] `generateIntermediateFormat(sectionCounter = [0, 0, 0, 0], tokenSet: string[] | null = null): RichTextIntermediate | null`:
  - Cria `RichTextIntermediate`.
  - Copia function handlers.
  - Reusa ou cria `RichText.parser`.
  - `parser.open(text)`, `parser.parse('richtext')`.
  - Se `false`, retorna null.
  - `tree.cleanUp()`.
  - Atribui `rti.tree`.
  - Retorna `rti`.
- [ ] `functionHandler(name, block): RichTextFunctionHandler | null`.

**`RichTextFactory`:**

- [ ] `class RichTextFactoryImpl implements RichTextFactory`:
  - `create(text: string): RichTextIntermediate`:
    - Cria `RichText` com `RTFHandlers.create(project, sfi)`.
    - Chama `generateIntermediateFormat`.
    - Se null, lança.

**Integração com `ProjectFileParser`:**

- [ ] Em `ProjectFileParser`:
  - `private richTextFactory: RichTextFactory = new StubRichTextFactory()` (default).
  - Setter `setRichTextFactory(factory)`.
  - `newRichText(text, sfi, tokenSet)` usa `this.richTextFactory.create(text)`.

Após Fase 12, `ProjectFileParser` usa `RichTextFactoryImpl` real.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText.rb` — arquivo completo.

#### Critério de aceite

```ts
const rt = new RichText("== Title ==\n\nParagraph.", []);
const rti = rt.generateIntermediateFormat();
assert(rti !== null);
assertEquals(rti.to_s(), "1) Title\n\nParagraph.");
```

#### Testes

- `rich-text_test.ts`:
  - `describe("RichText")`
    - `it("markup vazio")`.
    - `it("parágrafo")`.
    - `it("título 1")`.
    - `it("negrito + itálico")`.
    - `it("bullet list")`.
    - `it("href")`.
    - `it("reusa parser")`.
    - `it("erro de markup retorna null")`.
- `factory_test.ts`:
  - `it("create com markup válido")`.
  - `it("erro se markup inválido")`.

---

### Bloco E — Golden tests

---

### 12.19 — Golden tests (RichText)

#### Contexto

Validar markup contra `tj3`.

#### Objetivo

Script Ruby processa arquivos de teste de markup e serializa HTML/tagged/plain.

#### Arquivos

- `scripts/golden/richtext.rb`
- `scripts/golden/README.md` (atualizar)
- `packages/richtext/tests/golden/richtext.golden.json`
- `packages/richtext/tests/golden/richtext_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Script Ruby:**

- [ ] Itera sobre `docs/taskjuggler/test/TestSuite/RichText/` (se existir).
- [ ] Para cada arquivo:
  - Cria `RichText.new(content)`.
  - `rti = rt.generateIntermediateFormat`.
  - Serializa:
    - `input`: conteúdo original.
    - `plain`: `rti.to_s`.
    - `tagged`: `rti.to_tagged`.
    - `html`: `rti.to_html.to_s`.

**Teste TS:**

- [ ] Compara `plain`, `tagged`, `html`.
- [ ] ≥ 30 casos.

**Task `golden:generate`:**

- [ ] Adicionar.

#### Referências

- `docs/taskjuggler/test/TestSuite/RichText/`.
- Fase 2, subfase 5.14.

#### Fora de escopo

- Markup de arquivos `.tjp` completos — Fase 21.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 30 casos.
- Todos passam.

#### Testes

- `richtext_golden_test.ts`:
  - `describe("Golden RichText")` — itera casos.

---

## 6. Ordem de execução sugerida

```text
16.0  ADR 023
      ↓
16.1  XMLElementLike
16.2  RichTextImage
16.3  RichTextElement
16.4  RichTextIntermediate
      ↓
16.5  RichTextScanner
16.6  RichTextParser + SyntaxRules
      ↓
16.7  TOCEntry
16.8  TableOfContents
16.9  RichTextSnip
16.10 RichTextDocument
      ↓
16.11 RichTextFunctionHandler
16.12 RichTextFunctionExample
16.13 RTFWithQuerySupport
16.14 RTFQuery
16.15 RTFReport (stub)
16.16 RTFReportLink (stub)
16.17 RTFNavigator + RTFHandlers
      ↓
16.18 RichText + RichTextFactory + integração
      ↓
16.19 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 12 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `RichText`, `RichTextIntermediate`, `RichTextElement`.
- [ ] `RichTextScanner`, `RichTextParser`, `RichTextSyntaxRules`.
- [ ] `RichTextSnip`, `RichTextDocument`, `TOCEntry`, `TableOfContents`.
- [ ] `RichTextFunctionHandler` + subclasses (`RTFQuery` funcional, outros stubs).
- [ ] `RichTextFactory` implementado e integrado.
- [ ] `ProjectFileParser` usa `RichTextFactory` real.
- [ ] **≥ 200 testes unitários**.
- [ ] **≥ 30 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 023 criado.
- [ ] Script `richtext.rb` funcional.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `RichTextElement.to_html` diverge | Alto | Golden tests tagged + html |
| Scanner com modos errados | Alto | Testes de tokenização por modo |
| Regex multiline divergem do Ruby | Médio | Testes com strings multiline |
| Parser singleton polui estado entre chamadas | Médio | `reuse` reseta; testes isolados |
| `RTFQuery` com args inválidos | Médio | Validação em `prepareQuery` |
| `RTFReport` stub quebra reports | Alto | Documentar; Fase 14 completa |
| `RichTextFactory` stub vs real divergem | Médio | Testes com ambos |
| Performance de `to_tagged` em textos grandes | Médio | Benchmarks; otimizar se necessário |
| `sectionCounter` compartilhado entre snippets | Médio | Testes com múltiplos snips |
| `to_s` com `sectionNumbers = false` | Médio | Teste específico |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/RichText.rb`
- `docs/taskjuggler/lib/taskjuggler/RichText/*.rb`

### Blueprints

- `docs/tj3-engine/14-blueprint-others.md` — §5
- `docs/tj3-engine/07-blueprint-engine6.md` — §5

### Documentos do projeto

- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md`
- `docs/syntaxmesh/decisoes/023-richtext-handlers.md` (novo)
- `docs/syntaxmesh/04-linguagem-multilingue.md`

### Casos de teste

- `docs/taskjuggler/test/TestSuite/RichText/`

### Fases dependentes

- **Fase 10 — Parser** (integração com `RichTextFactory` real).
- **Fase 13 — Markdown** (formato alternativo).
- **Fase 14 — Reports** (RTFReport, RTFReportLink, RTFNavigator completos).
- **Fase 16 — Journal** (usa RichText para summary/details).
- **Fase 17 — HTML/XML** (`XMLElement` real substitui `XMLElementLike`).
- **Fase 21 — Compatibilidade** (golden tests).

---

## 10. Notas para a IA

1. **RichText é mantido por compatibilidade com `.tjp`.** Não substituir por Markdown.
2. **`RichTextParser` herda de `TextParser`.** Reusar Fase 10.
3. **`RichText.@@parser` é singleton.** Cuidado com estado entre chamadas.
4. **`RichTextIntermediate.setQuery` propaga para handlers.** Não esquecer.
5. **`RTFQuery` usa `Query` (Fase 11).** Integração completa.
6. **`RTFReport`, `RTFReportLink`, `RTFNavigator` são stubs.** Fase 14.
7. **`XMLElementLike` substituído na Fase 17.** Não vazar dependência.
8. **`sectionNumbers` afeta `to_s`.** Teste ambos os modos.
9. **`str.each_utf8_char` → `for (const c of str)`.** Fase 16 tem UTF8String.
10. **Regex multiline: usar `m` flag com cuidado.** Testes com strings complexas.
11. **`RichTextFactory` substitui stub da Fase 10.** Aviso ao parser.
12. **`generateIntermediateFormat` pode retornar `null`.** Markup inválido.
13. **`children_to_s` concatena com espaços.** `appendSpace` controla.
14. **Sem `any`.** Use `unknown` + type guards.
15. **Commit por subfase.** `feat(richtext): rich-text-element`, `feat(richtext): rtf-query`, etc.

---

## 11. ADR 023 (referência rápida)

Criado como subfase 16.0. Conteúdo esperado:

- **Título:** RichText e function handlers
- **Contexto:** RichText MediaWiki; reuso de `TextParser`; handlers.
- **Decisões:**
  - RichText mantido (reforça ADR 009).
  - `RichTextParser` herda de `TextParser`.
  - `RichTextFunctionHandler` abstrata + subclasses.
  - `RTFReport`/`RTFReportLink`/`RTFNavigator` stubs até Fase 14.
- **Alternativas:** Markdown (descartada); parser próprio (descartada).
- **Consequências:** reuso máximo; acoplamento com Fase 10/11.

---

**Fim da Fase 12.**