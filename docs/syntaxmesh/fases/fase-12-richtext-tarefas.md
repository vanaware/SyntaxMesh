# Fase 12 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-12-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-12-richtext.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~215 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/RichText.rb` + `RichText/*.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ⚠️ ORDEM DE EXECUÇÃO CRÍTICA

A Fase 12 é **pós-Fase 10** (parser) e **pós-Fase 11** (Query). O parser (Fase 10) **usa um stub** de `RichTextFactory` porque a implementação real vive aqui. Ao final da Fase 12:

- **`RichTextFactory` real** é injetado em `ProjectFileParser` via `setRichTextFactory`.
- O stub é **substituído**.

Nada na Fase 10 precisa mudar; apenas o parser passa a usar a implementação real em runtime.

### ADRs relevantes

- **ADR 009** — RichText mantido, Markdown futuro (Fase 1).
- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (Fase 7).
- **ADR 019** — Modelo financeiro (Fase 8).
- **ADR 020** — Orquestrador e pipeline (Fase 9).
- **ADR 021** — FSM do TextParser (Fase 10).
- **ADR 022** — i18n de keywords (Fase 10).
- **ADR 023** — Expressões lógicas sem precedência (Fase 11).
- **ADR 024** — RichText e function handlers (**criado nesta fase**).

### Convenções CRÍTICAS

- **`RichTextParser` herda de `TextParser` (Fase 10).** Não recriar do zero.
- **`RichTextScanner` herda de `Scanner` (Fase 10).**
- **`RichText.@@parser` é singleton** — `reuse` reseta estado.
- **`RichTextIntermediate.setQuery` propaga para handlers.**
- **`RTFQuery` usa `Query` (Fase 11).**
- **`RTFReport`, `RTFReportLink`, `RTFNavigator` são stubs** — Fase 14 completa.
- **`XMLElementLike`** interface introduzida aqui (Fase 17 substitui por real).
- **`sectionNumbers` afeta `to_s`.**
- **`to_html` retorna `XMLElementLike`**, não string.
- **`<fcol:red>`** — extensão TJ.
- **`<html>...</html>`** — HTML puro.
- **`<nowiki>...</nowiki>`** — desabilita markup.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não substituir RichText por Markdown.
- ❌ Não recriar `TextParser` — herdar de Fase 10.
- ❌ Não usar `RichTextParser` sem `reuse` em singleton.
- ❌ Não completar `RTFReport`/`RTFReportLink`/`RTFNavigator` (Fase 14).
- ❌ Não usar `RichTextIntermediate` real para `RTFQuery` — é Fase 11.
- ❌ Não usar `Journal` real — Fase 16.
- ❌ Não usar `Proxy`.
- ❌ Não pular `sectionNumbers`/`blockMode`.

---

## Progresso

```
[ ] 12.0  ADR 024 (RichText e handlers)            —  0/5
[ ] 12.1  XMLElementLike + SimpleXMLElement        —  0/8
[ ] 12.2  RichTextImage                            —  0/4
[ ] 12.3  RichTextElement                          —  0/28
[ ] 12.4  RichTextIntermediate                     —  0/18
[ ] 12.5  RichTextScanner                          —  0/20
[ ] 12.6  RichTextParser + SyntaxRules             —  0/22
[ ] 12.7  TOCEntry                                 —  0/5
[ ] 12.8  TableOfContents                          —  0/5
[ ] 12.9  RichTextSnip                             —  0/8
[ ] 12.10 RichTextDocument                         —  0/10
[ ] 12.11 RichTextFunctionHandler                  —  0/6
[ ] 12.12 RichTextFunctionExample                  —  0/6
[ ] 12.13 RTFWithQuerySupport                      —  0/4
[ ] 12.14 RTFQuery                                 —  0/18
[ ] 12.15 RTFReport (stub)                         —  0/3
[ ] 12.16 RTFReportLink (stub)                     —  0/3
[ ] 12.17 RTFNavigator + RTFHandlers               —  0/10
[ ] 12.18 RichText + RichTextFactory + integração  —  0/14
[ ] 12.19 Golden tests (RichText)                  —  0/10
[ ] 12.20 Verificação final                        —  0/8
─────────────────────────────────────────────────────
TOTAL: ~215
```

---

## Bloco A — Fundação

### 12.0 — ADR 024 (RichText e function handlers)

**Objetivo:** formalizar o reuso de `TextParser` e o sistema de function handlers.

**⚠️ Nota:** o plano usa `ADR 023`, mas o ADR 023 foi alocado para `expressoes-logicas` (Fase 11). Aqui usamos **ADR 024**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.0.1 | Criar `docs/syntaxmesh/decisoes/024-richtext-handlers.md` com frontmatter | idem | arquivo existe |
| 12.0.2 | Seção **Contexto:** RichText MediaWiki; reuso de `TextParser`; function handlers; `RTFReport`/`RTFReportLink`/`RTFNavigator` são stubs | idem | — |
| 12.0.3 | Seção **Decisão:** RichText mantido (reforça ADR 009); `RichTextParser extends TextParser`; `RichTextFunctionHandler` abstrata + subclasses | idem | — |
| 12.0.4 | **Alternativas** (Markdown — descartada; parser próprio — descartada) + **Consequências** (reuso máximo; acoplamento com Fase 10/11) | idem | — |
| 12.0.5 | Atualizar linha `024` em `decisoes/README.md` | idem | 24 linhas |

---

### 12.1 — `XMLElementLike` + `SimpleXMLElement`

**⚠️ Contexto:** `RichTextElement.to_html` retorna uma árvore de `XMLElement` (Fase 17). Como `XMLElement` real ainda não existe, definimos uma **interface** e uma implementação mínima aqui.

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.1.1 | Criar `packages/richtext/src/xml-like.ts` com `interface XMLElementLike` | idem | `deno check` |
| 12.1.2 | `XMLElementLike`: campos `tag: string`, `attrs: Record<string, string>`, `children: Array<XMLElementLike \| string>` | idem | `deno check` |
| 12.1.3 | `XMLElementLike`: métodos `append(child): void`, `toHTML(): string` | idem | `deno check` |
| 12.1.4 | Criar `class SimpleXMLElement implements XMLElementLike` | idem | `deno check` |
| 12.1.5 | Constructor `(tag, attrs = {})` — inicializa `children = []` | idem | 2 testes |
| 12.1.6 | ⚠️ `append(child): void` — se `child` é string, adiciona como texto | idem | 3 testes |
| 12.1.7 | ⚠️ `toHTML(): string` — serializa com indentação mínima; escapa `&`, `<`, `>`, `"` | idem | 6 testes (auto-close, com filhos, com attrs, escapes) |
| 12.1.8 | Re-exportar em `packages/richtext/mod.ts` | idem | `deno check` |

---

### 12.2 — `RichTextImage`

**⚠️ RUBY: `RichText/Element.rb` — classe `RichTextImage`**

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.2.1 | Criar `packages/richtext/src/rich-text-image.ts` com `class RichTextImage` | idem | `deno check` |
| 12.2.2 | Campos: `readonly fileName: string`, `altText: string \| null`, `verticalAlign: string \| null` | idem | `deno check` |
| 12.2.3 | Constructor `(fileName)` — `altText = verticalAlign = null` | idem | 2 testes |
| 12.2.4 | Teste: `altText` e `verticalAlign` são mutáveis | idem | 1 teste |

---

## Bloco B — Core

### 12.3 — `RichTextElement`

**⚠️ RUBY: `RichText/Element.rb` (arquivo inteiro — ~700 linhas)**
**🔎 CHEAT: §3 `case/when` → `switch`, §5 strings, §12 Categoria B (escape)**

**Pré-requisitos:** 12.1, 12.2, 12.4 (referência circular — usar `import type`).

#### 12.3.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.1.1 | Criar `packages/richtext/src/rich-text-element.ts` com `class RichTextElement` | idem | `deno check` |
| 12.3.1.2 | Campos: `richText: RichTextIntermediate`, `category: string`, `children: Array<RichTextElement \| string>`, `data: unknown`, `appendSpace: boolean` | idem | `deno check` |
| 12.3.1.3 | Constructor `(rti, category, arg?)` — processa `arg` (string, array, número, etc.) | idem | 5 testes |

#### 12.3.2 — Limpeza + empty

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.2.1 | ⚠️ `cleanUp(): RichTextElement` — se `richtext` tem 1 filho `paragraph`, promove children | idem | 4 testes |
| 12.3.2.2 | `empty(): boolean` — `richtext` sem children | idem | 3 testes |

#### 12.3.3 — TOC + refs

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.3.1 | ⚠️ `tableOfContents(toc: TableOfContents, fileName: string): void` — para `title1-4`, adiciona entrada | idem | 5 testes |
| 12.3.3.2 | ⚠️ `internalReferences(): string[]` — coleta referências internas (`ref`) | idem | 4 testes |

#### 12.3.4 — `to_s` (plain text)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.4.1 | ⚠️ `to_s(): string` — dispatch por categoria | idem | 1 teste |
| 12.3.4.2 | `title1-4` → `"${number}) ${text}"` se `sectionNumbers`, senão `${text}` | idem | 6 testes |
| 12.3.4.3 | `paragraph` → texto + `\n\n` | idem | 2 testes |
| 12.3.4.4 | `pre` → texto sem indent | idem | 2 testes |
| 12.3.4.5 | `hline` → `"---\n"` | idem | 1 teste |
| 12.3.4.6 | `bulletitem1-4` → `* text` com indent | idem | 4 testes |
| 12.3.4.7 | `numberitem1-4` → `# text` com indent | idem | 4 testes |
| 12.3.4.8 | `italic` / `bold` / `code` → texto puro | idem | 3 testes |
| 12.3.4.9 | `text` → texto puro | idem | 1 teste |
| 12.3.4.10 | ⚠️ `children_to_s(): string` — concatena com espaços quando `appendSpace` | idem | 3 testes |

#### 12.3.5 — `to_tagged`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.5.1 | ⚠️ `to_tagged(): string` — `<h1>text</h1>`, `<p>text</p>`, etc. | idem | 4 testes |
| 12.3.5.2 | `title1-4` → `<title1>...</title1>` (tags customizadas) | idem | 4 testes |
| 12.3.5.3 | `paragraph` → `<p>...</p>` | idem | 2 testes |
| 12.3.5.4 | `italic` / `bold` / `code` → `<i>`, `<b>`, `<c>` | idem | 3 testes |
| 12.3.5.5 | `href` → `<a>...</a>` | idem | 2 testes |
| 12.3.5.6 | `bulletlist1-4` → `<bulletlist1>...</bulletlist1>` | idem | 4 testes |

#### 12.3.6 — `to_html` (retorna `XMLElementLike`)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.6.1 | ⚠️ `to_html(): XMLElementLike` — dispatch por categoria | idem | 1 teste |
| 12.3.6.2 | `richtext` → `<div>` (block) ou `<span>` (inline) conforme `blockMode` | idem | 3 testes |
| 12.3.6.3 | ⚠️ `title1-4` → `<h1>-<h4>` com `id` e numeração opcional | idem | 6 testes |
| 12.3.6.4 | `hline` → `<hr>` | idem | 1 teste |
| 12.3.6.5 | `paragraph` → `<p>` | idem | 2 testes |
| 12.3.6.6 | `pre` → `<div><pre>...</pre></div>` | idem | 2 testes |
| 12.3.6.7 | `bulletlist1-4` → `<ul>`; `bulletitem1-4` → `<li>` | idem | 6 testes |
| 12.3.6.8 | `numberlist1-4` → `<ol>`; `numberitem1-4` → `<li>` | idem | 6 testes |
| 12.3.6.9 | ⚠️ `img` → `<object>` com data e alt | idem | 4 testes |
| 12.3.6.10 | ⚠️ `ref` → `<a href=".html#...">` | idem | 3 testes |
| 12.3.6.11 | ⚠️ `href` → `<a href="..." target="...">` | idem | 4 testes |
| 12.3.6.12 | ⚠️ `blockfunc` / `inlinefunc` → dispatch para `functionHandler(name).to_html(args)` | idem | 5 testes |
| 12.3.6.13 | `italic` → `<i>`; `bold` → `<b>` | idem | 3 testes |
| 12.3.6.14 | `fontCol` → `<span style="color:...">` | idem | 3 testes |
| 12.3.6.15 | `code` → `<code>` | idem | 2 testes |
| 12.3.6.16 | `htmlblob` → raw HTML | idem | 2 testes |
| 12.3.6.17 | `text` → texto puro | idem | 1 teste |

#### 12.3.7 — Helpers privados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.3.7.1 | ⚠️ `private convertToID(text: string): string` — normaliza para ID HTML | idem | 4 testes |
| 12.3.7.2 | ⚠️ `private sTitle(level): string` — `"${number}) ${title}"` | idem | 3 testes |
| 12.3.7.3 | ⚠️ `private htmlTitle(level): XMLElementLike` | idem | 4 testes |
| 12.3.7.4 | ⚠️ `private htmlObject(): XMLElementLike \| null` | idem | 3 testes |
| 12.3.7.5 | ⚠️ `private textBlockFormat(indent, label, str, width): string` | idem | 4 testes |

---

### 12.4 — `RichTextIntermediate`

**⚠️ RUBY: `RichText.rb` — classe `RichTextIntermediate`**

**Pré-requisitos:** 12.3, Fase 11 (`Query`).

#### 12.4.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.4.1.1 | Criar `packages/richtext/src/rich-text-intermediate.ts` com `class RichTextIntermediate` | idem | `deno check` |
| 12.4.1.2 | Campos `richText: RichText`, `tree: RichTextElement \| null`, `blockMode: boolean = true`, `sectionNumbers: boolean = true` | idem | `deno check` |
| 12.4.1.3 | Campos de formatação: `lineWidth = 80`, `indent = 0`, `titleIndent = 0`, `parIndent = 0`, `listIndent = 1`, `preIndent = 0` | idem | `deno check` |
| 12.4.1.4 | Campos: `linkTarget: string \| null`, `cssClass: string \| null`, `functionHandlers: Map<string, RichTextFunctionHandler>` | idem | `deno check` |

#### 12.4.2 — Function handlers

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.4.2.1 | ⚠️ `registerFunctionHandler(handler): void` — adiciona ao Map | idem | 2 testes |
| 12.4.2.2 | ⚠️ `functionHandler(name: string): RichTextFunctionHandler \| null` | idem | 2 testes |
| 12.4.2.3 | ⚠️ `setQuery(query: Query): void` — propaga para handlers que suportam | idem | 3 testes |

#### 12.4.3 — TOC + refs

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.4.3.1 | `empty(): boolean` — `tree === null \|\| tree.empty()` | idem | 3 testes |
| 12.4.3.2 | ⚠️ `tableOfContents(toc: TableOfContents, fileName: string): void` — delega para tree | idem | 3 testes |
| 12.4.3.3 | ⚠️ `internalReferences(): string[]` — delega para tree | idem | 3 testes |

#### 12.4.4 — `to_s` / `to_html` / `to_tagged`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.4.4.1 | ⚠️ `to_s(): string` — `tree?.to_s() ?? ''` | idem | 3 testes |
| 12.4.4.2 | ⚠️ `to_html(): XMLElementLike` — `tree?.to_html()` ou `<span>` vazio | idem | 3 testes |
| 12.4.4.3 | ⚠️ `to_tagged(): string` — `tree?.to_tagged() ?? ''` | idem | 3 testes |
| 12.4.4.4 | Teste agregado: `RichTextIntermediate` com markup básico | idem | 1 teste |

---

## Bloco C — Parser e Scanner

### 12.5 — `RichTextScanner`

**⚠️ RUBY: `RichText/Scanner.rb` (arquivo inteiro — ~400 linhas)**
**🔎 CHEAT: §5 regex, §12 Categoria B (multiline)**

**Pré-requisitos:** Fase 10 (`Scanner`).

#### 12.5.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.5.1.1 | Criar `packages/richtext/src/rich-text-scanner.ts` com `class RichTextScanner extends Scanner` | idem | `deno check` |
| 12.5.1.2 | Constructor `(masterFile)` — chama `super(masterFile, ..., ':bop')` | idem | 1 teste |

#### 12.5.2 — Modos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.5.2.1 | Modo `:bop` (beginning of paragraph) | idem | 1 teste |
| 12.5.2.2 | Modo `:bol` (beginning of line) | idem | 1 teste |
| 12.5.2.3 | Modo `:inline` | idem | 1 teste |
| 12.5.2.4 | Modo `:nowiki` | idem | 1 teste |
| 12.5.2.5 | Modo `:html` | idem | 1 teste |
| 12.5.2.6 | Modo `:ref` e `:href` | idem | 2 testes |
| 12.5.2.7 | Modo `:func` | idem | 1 teste |

#### 12.5.3 — Tokens

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.5.3.1 | Registrar `LINEBREAK`, `SPACE`, `WORD` | idem | 4 testes |
| 12.5.3.2 | Registrar `TITLE1-4`, `TITLE1END-4END` | idem | 4 testes |
| 12.5.3.3 | Registrar `BULLET1-4`, `NUMBER1-4` | idem | 4 testes |
| 12.5.3.4 | Registrar `BOLD`, `ITALIC`, `CODE`, `BOLDITALIC` | idem | 5 testes |
| 12.5.3.5 | Registrar `PRE`, `HLINE`, `HTMLBLOB` | idem | 3 testes |
| 12.5.3.6 | Registrar `FCOLSTART`, `FCOLEND` | idem | 2 testes |
| 12.5.3.7 | Registrar `QUERY`, `INLINEFUNCSTART/END`, `BLOCKFUNCSTART/END` | idem | 4 testes |
| 12.5.3.8 | Registrar `HREF`, `HREFEND`, `REF`, `REFEND` | idem | 4 testes |
| 12.5.3.9 | Registrar `ID`, `STRING` | idem | 2 testes |

#### 12.5.4 — Handlers de modo

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.5.4.1 | ⚠️ `space(type, match)` — se contém `\n`, muda para `:bol` | idem | 3 testes |
| 12.5.4.2 | ⚠️ `linebreak(type, match)` — muda para `:bop` | idem | 2 testes |
| 12.5.4.3 | `inlineMode(type, match)` — muda para `:inline` | idem | 2 testes |
| 12.5.4.4 | `titleStart(type, match)` — retorna `TITLE<n>` | idem | 4 testes |
| 12.5.4.5 | `titleEnd(type, match)` — retorna `TITLE<n>END` | idem | 4 testes |
| 12.5.4.6 | `bullet(type, match)` — retorna `BULLET<n>` | idem | 4 testes |
| 12.5.4.7 | `number(type, match)` — retorna `NUMBER<n>` | idem | 4 testes |
| 12.5.4.8 | ⚠️ `fontColorStart(type, match)` — extrai cor, valida | idem | 4 testes |
| 12.5.4.9 | `fontColorEnd` | idem | 1 teste |
| 12.5.4.10 | ⚠️ `quotes(type, match)` — 2/3/4/5 quotes → `ITALIC`/`BOLD`/`CODE`/`BOLDITALIC` | idem | 5 testes |
| 12.5.4.11 | `htmlStart`, `htmlEnd` | idem | 2 testes |
| 12.5.4.12 | `nowikiStart`, `nowikiEnd` | idem | 2 testes |
| 12.5.4.13 | `functionStart`, `functionEnd` | idem | 2 testes |
| 12.5.4.14 | `pre` | idem | 1 teste |
| 12.5.4.15 | `dqString`, `sqString` | idem | 2 testes |
| 12.5.4.16 | `query` | idem | 1 teste |
| 12.5.4.17 | `hrefStart`, `hrefEnd` | idem | 2 testes |
| 12.5.4.18 | `refStart`, `refEnd` | idem | 2 testes |
| 12.5.4.19 | Teste agregado: tokenização de markup básico | idem | 1 teste |
| 12.5.4.20 | Re-exportar em `packages/richtext/mod.ts` | idem | `deno check` |

---

### 12.6 — `RichTextParser` + `RichTextSyntaxRules`

**⚠️ RUBY: `RichText/Parser.rb` + `RichText/SyntaxRules.rb`**

**Pré-requisitos:** 12.3, 12.4, 12.5, Fase 10 (`TextParser`).

#### 12.6.1 — `RichTextParser` estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.6.1.1 | Criar `packages/richtext/src/rich-text-parser.ts` com `class RichTextParser extends TextParser` | idem | `deno check` |
| 12.6.1.2 | Campos: `richTextI: RichTextIntermediate`, `sectionCounter: number[]`, `numberListCounter: number[]` | idem | `deno check` |
| 12.6.1.3 | Constructor `(rti, sectionCounter = [0,0,0,0], tokenSet = null)` | idem | 3 testes |
| 12.6.1.4 | ⚠️ `reuse(rti, sectionCounter, tokenSet): void` — reseta estado do singleton | idem | 4 testes |
| 12.6.1.5 | `open(text: string): void` — chama `RichTextScanner` | idem | 2 testes |
| 12.6.1.6 | `nextToken(): Token` — delega para scanner | idem | 1 teste |
| 12.6.1.7 | `returnToken(token): void` — delega | idem | 1 teste |
| 12.6.1.8 | ⚠️ `initRules(): void` — chama todas as `rule_*` (registro explícito) | idem | 2 testes |

#### 12.6.2 — `RichTextSyntaxRules` (patterns)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.6.2.1 | Criar `packages/richtext/src/rich-text-syntax-rules.ts` | idem | `deno check` |
| 12.6.2.2 | ⚠️ `rule_richtext` — entry point | idem | 2 testes |
| 12.6.2.3 | ⚠️ `rule_sections`, `rule_section` | idem | 3 testes |
| 12.6.2.4 | ⚠️ `rule_headlines` | idem | 2 testes |
| 12.6.2.5 | ⚠️ `rule_title1-4` — processa `TITLE<n>` | idem | 4 testes |
| 12.6.2.6 | ⚠️ `rule_pre` | idem | 2 testes |
| 12.6.2.7 | ⚠️ `rule_bulletList1-4`, `rule_numberList1-4` | idem | 8 testes |
| 12.6.2.8 | ⚠️ `rule_paragraph` | idem | 3 testes |
| 12.6.2.9 | ⚠️ `rule_text`, `rule_textWithSpace` | idem | 3 testes |
| 12.6.2.10 | ⚠️ `rule_plainTextWithLinks`, `rule_moreRefToken`, `rule_refToken` | idem | 5 testes |
| 12.6.2.11 | ⚠️ `rule_wordWithQueries`, `rule_plainText`, `rule_plainTextWithQueries` | idem | 5 testes |
| 12.6.2.12 | ⚠️ `rule_htmlBlob` | idem | 3 testes |
| 12.6.2.13 | ⚠️ `rule_space`, `rule_blankLines` | idem | 3 testes |
| 12.6.2.14 | ⚠️ `rule_blockFunction`, `rule_inlineFunction`, `rule_functionArguments` | idem | 6 testes |
| 12.6.2.15 | Teste agregado: parse de título + parágrafo | idem | 1 teste |
| 12.6.2.16 | Teste agregado: parse de bullet list | idem | 1 teste |
| 12.6.2.17 | Teste agregado: parse de itálico/negrito/mono | idem | 1 teste |
| 12.6.2.18 | Teste agregado: parse de `href` e `ref` | idem | 1 teste |
| 12.6.2.19 | Teste agregado: parse de `<fcol:red>...</fcol>` | idem | 1 teste |
| 12.6.2.20 | Teste agregado: parse de `<nowiki>` | idem | 1 teste |
| 12.6.2.21 | Teste agregado: parse de `<html>` blob | idem | 1 teste |
| 12.6.2.22 | Teste agregado: parse de `[[func:...]]` inline/block | idem | 2 testes |

---

## Bloco D — Documents

### 12.7 — `TOCEntry`

**⚠️ RUBY: `RichText/TOCEntry.rb` (arquivo inteiro — ~80 linhas)**

**Pré-requisitos:** 12.1 (`XMLElementLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.7.1 | Criar `packages/richtext/src/toc-entry.ts` com `class TOCEntry` | idem | `deno check` |
| 12.7.2 | Campos: `readonly number: string`, `readonly title: string`, `readonly file: string`, `readonly tag: string \| null` | idem | `deno check` |
| 12.7.3 | Constructor `(number, title, file, tag?)` | idem | 2 testes |
| 12.7.4 | ⚠️ `to_html(): XMLElementLike[]` — gera lista de elementos por nível | idem | 4 testes |
| 12.7.5 | ⚠️ `private level(): number` — conta `.` em `number` | idem | 3 testes |

---

### 12.8 — `TableOfContents`

**⚠️ RUBY: `RichText/TableOfContents.rb` (arquivo inteiro — ~70 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.8.1 | Criar `packages/richtext/src/table-of-contents.ts` com `class TableOfContents` | idem | `deno check` |
| 12.8.2 | Campo `private entries: TOCEntry[]` | idem | `deno check` |
| 12.8.3 | ⚠️ `addEntry(entry): void` | idem | 2 testes |
| 12.8.4 | ⚠️ `[Symbol.iterator](): Iterator<TOCEntry>` | idem | 2 testes |
| 12.8.5 | ⚠️ `to_html(): XMLElementLike` | idem | 3 testes |

---

### 12.9 — `RichTextSnip`

**⚠️ RUBY: `RichText/Snip.rb` (arquivo inteiro — ~130 linhas)**

**Pré-requisitos:** 12.4, 12.10 (referência circular — `import type`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.9.1 | Criar `packages/richtext/src/rich-text-snip.ts` com `class RichTextSnip` | idem | `deno check` |
| 12.9.2 | Campos: `name`, `prevSnip`, `nextSnip`, `private richText`, `private document` | idem | `deno check` |
| 12.9.3 | Constructor `(document, fileName, sectionCounter)` — lê arquivo, cria `RichText`, gera `RichTextIntermediate` | idem | 3 testes |
| 12.9.4 | Setter `linkTarget=` | idem | 2 testes |
| 12.9.5 | Setter `cssClass=` | idem | 2 testes |
| 12.9.6 | ⚠️ `tableOfContents(toc, fileName): void` | idem | 2 testes |
| 12.9.7 | ⚠️ `internalReferences(): string[]` | idem | 2 testes |
| 12.9.8 | ⚠️ `generateHTML(directory = ''): void` | idem | 3 testes |

---

### 12.10 — `RichTextDocument` (abstract)

**⚠️ RUBY: `RichText/Document.rb` (arquivo inteiro — ~180 linhas)**

**Pré-requisitos:** 12.8, 12.9.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.10.1 | Criar `packages/richtext/src/rich-text-document.ts` com `abstract class RichTextDocument` | idem | `deno check` |
| 12.10.2 | Campos: `snippets: RichTextSnip[]`, `dirty: boolean`, `sectionCounter: number[]`, `linkTarget`, `toc`, `anchors`, `functionHandlers`, `references` | idem | `deno check` |
| 12.10.3 | `registerFunctionHandler(handler): void` | idem | 2 testes |
| 12.10.4 | ⚠️ `addSnip(file: string): RichTextSnip` — encadeia `prevSnip`/`nextSnip` | idem | 4 testes |
| 12.10.5 | ⚠️ `tableOfContents(): void` — agrega TOCs dos snips | idem | 3 testes |
| 12.10.6 | ⚠️ `checkInternalReferences(): void` | idem | 3 testes |
| 12.10.7 | ⚠️ `generateHTML(directory = ''): void` | idem | 3 testes |
| 12.10.8 | `private crossReference(): void` | idem | 2 testes |
| 12.10.9 | `private generateHTMLTableOfContents(directory): void` | idem | 2 testes |
| 12.10.10 | Abstract methods: `generateStyleSheet`, `generateHTMLCover`, `generateHTMLHeader`, `generateHTMLFooter`, `generateHTMLNavigationBar` | idem | `deno check` |

---

## Bloco E — Function Handlers

### 12.11 — `RichTextFunctionHandler` (abstract)

**⚠️ RUBY: `RichText/FunctionHandler.rb` (arquivo inteiro — ~50 linhas)**

**Pré-requisitos:** 12.1 (`XMLElementLike`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.11.1 | Criar `packages/richtext/src/handlers/function-handler.ts` | idem | `deno check` |
| 12.11.2 | `abstract class RichTextFunctionHandler`: `readonly function: string`, `blockFunction: boolean`, `readonly sourceFileInfo: SourceFileInfo \| null` | idem | `deno check` |
| 12.11.3 | Constructor `(function, sfi = null)` — `blockFunction = false` | idem | 2 testes |
| 12.11.4 | Abstract: `to_s(args)`, `to_html(args)`, `to_tagged(args)` | idem | `deno check` |
| 12.11.5 | ⚠️ `dup(): RichTextFunctionHandler` — retorna nova instância | idem | 2 testes |
| 12.11.6 | Re-exportar em `packages/richtext/mod.ts` | idem | `deno check` |

---

### 12.12 — `RichTextFunctionExample`

**⚠️ RUBY: `RichText/FunctionExample.rb` (arquivo inteiro — ~80 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.12.1 | Criar `packages/richtext/src/handlers/function-example.ts` | idem | `deno check` |
| 12.12.2 | `class RichTextFunctionExample extends RichTextFunctionHandler`: `function = 'example'`, `blockFunction = true` | idem | 1 teste |
| 12.12.3 | ⚠️ `to_s(args): string` → `''` | idem | 1 teste |
| 12.12.4 | ⚠️ `to_html(args): XMLElementLike` — `file = args.file`, `tag = args.tag`; carrega `.tjp`, extrai snippet, retorna `<div class="codeframe"><pre class="code">...</pre></div>` | idem | 4 testes |
| 12.12.5 | Se `file` ausente → `error` | idem | 2 testes |
| 12.12.6 | `to_tagged(args): string` → `''` | idem | 1 teste |

---

### 12.13 — `RTFWithQuerySupport`

**⚠️ RUBY: `RichText/RTFWithQuerySupport.rb` (arquivo inteiro — ~40 linhas)**

**Pré-requisitos:** 12.11, Fase 11 (`Query`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.13.1 | Criar `packages/richtext/src/handlers/rtf-with-query-support.ts` | idem | `deno check` |
| 12.13.2 | `abstract class RTFWithQuerySupport extends RichTextFunctionHandler`: `protected query: Query \| null` | idem | `deno check` |
| 12.13.3 | ⚠️ `setQuery(query: Query): void` — duplica a query | idem | 3 testes |
| 12.13.4 | Teste: `dup()` preserva `query` | idem | 1 teste |

---

### 12.14 — `RTFQuery`

**⚠️ RUBY: `RichText/RTFQuery.rb` (arquivo inteiro — ~180 linhas)**

**Pré-requisitos:** 12.13, Fase 11 (`Query`).

#### 12.14.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.14.1.1 | Criar `packages/richtext/src/handlers/rtf-query.ts` | idem | `deno check` |
| 12.14.1.2 | `class RTFQuery extends RTFWithQuerySupport`: `function = 'query'`, `blockFunction = false` | idem | 1 teste |
| 12.14.1.3 | Constructor `(project, sfi)` | idem | 1 teste |

#### 12.14.2 — `prepareQuery`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.14.2.1 | ⚠️ `private prepareQuery(args: Record<string, string>): Query \| null` — valida args | idem | 3 testes |
| 12.14.2.2 | Args válidos: `attribute`, `currencyformat`, `end`, `family`, `journalattributes`, `journalmode`, `loadunit`, `numberformat`, `property`, `scenario`, `scopeproperty`, `start`, `timeformat` | idem | 4 testes |
| 12.14.2.3 | Arg desconhecido → warning | idem | 2 testes |
| 12.14.2.4 | `setPropertyType(query, args): void` | idem | 3 testes |
| 12.14.2.5 | `setLoadUnit(query, args): void` | idem | 3 testes |
| 12.14.2.6 | `setScenarioIdx(query, args): void` | idem | 3 testes |
| 12.14.2.7 | `setJournalMode(query, args): void` (stub para Fase 16) | idem | 2 testes |
| 12.14.2.8 | `setJournalAttributes(query, args): void` (stub) | idem | 2 testes |
| 12.14.2.9 | `query.process()` é chamado ao final | idem | 2 testes |

#### 12.14.3 — Saídas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.14.3.1 | ⚠️ `to_s(args): string` — executa query, retorna `query.to_s()` | idem | 4 testes |
| 12.14.3.2 | ⚠️ `to_html(args): XMLElementLike` — se `rti`, retorna `rti.to_html()`; senão, `<span>text</span>` | idem | 4 testes |
| 12.14.3.3 | `to_tagged(args): string` → `''` | idem | 1 teste |
| 12.14.3.4 | `private recreateQuerySyntax(args): string` | idem | 2 testes |

#### 12.14.4 — Testes agregados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.14.4.1 | Teste: `[[query:attribute=effort]]` em task com effort | idem | 1 teste |
| 12.14.4.2 | Teste: erro se `attribute` ausente | idem | 1 teste |
| 12.14.4.3 | Teste: erro se `family` inválida | idem | 1 teste |
| 12.14.4.4 | Re-exportar em `packages/richtext/mod.ts` | idem | `deno check` |

---

### 12.15 — `RTFReport` (stub)

**⚠️ RUBY: `RichText/RTFReport.rb` (arquivo inteiro — ~80 linhas)**

**Nota:** implementação completa é Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.15.1 | Criar `packages/richtext/src/handlers/rtf-report.ts` | idem | `deno check` |
| 12.15.2 | `class RTFReport extends RichTextFunctionHandler`: `function = 'report'`, `blockFunction = true` | idem | 1 teste |
| 12.15.3 | ⚠️ `to_html(args)` — **stub**: `throw new NotYetImplementedError("RTFReport requer Fase 14")` + comentário `// TODO Fase 14` | idem | 1 teste |

---

### 12.16 — `RTFReportLink` (stub)

**⚠️ RUBY: `RichText/RTFReportLink.rb` (arquivo inteiro — ~80 linhas)**

**Nota:** implementação completa é Fase 14.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.16.1 | Criar `packages/richtext/src/handlers/rtf-report-link.ts` | idem | `deno check` |
| 12.16.2 | `class RTFReportLink extends RTFWithQuerySupport`: `function = 'reportlink'` | idem | 1 teste |
| 12.16.3 | ⚠️ `to_html(args)` — **stub**: `throw NotYetImplementedError("Fase 14")` | idem | 1 teste |

---

### 12.17 — `RTFNavigator` + `RTFHandlers`

**⚠️ RUBY: `RichText/RTFNavigator.rb` + `RichText/RTFHandlers.rb`**

**Pré-requisitos:** 12.11, Fases 5 (`Project`), 14 (`Navigator` — stub).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.17.1 | Criar `packages/richtext/src/handlers/rtf-navigator.ts` | idem | `deno check` |
| 12.17.2 | `class RTFNavigator extends RichTextFunctionHandler`: `function = 'navigator'`, `blockFunction = true` | idem | 1 teste |
| 12.17.3 | ⚠️ `to_html(args)` — `id = args.id` obrigatório; **stub**: `throw NotYetImplementedError("Navigator requer Fase 14")` | idem | 2 testes |
| 12.17.4 | Criar `packages/richtext/src/handlers/rtf-handlers.ts` | idem | `deno check` |
| 12.17.5 | ⚠️ `RTFHandlers.create(project, sfi): RichTextFunctionHandler[]` — retorna `[RTFNavigator, RTFQuery, RTFReport, RTFReportLink]` | idem | 2 testes |
| 12.17.6 | Teste: `create` retorna 4 handlers | idem | 1 teste |
| 12.17.7 | Teste: cada handler tem `function` correto | idem | 4 testes |
| 12.17.8 | Teste: `RTFQuery` e `RTFReportLink` suportam `setQuery` | idem | 2 testes |
| 12.17.9 | Re-exportar em `packages/richtext/mod.ts` | idem | `deno check` |
| 12.17.10 | Teste agregado: `RTFHandlers.create` com `project` mockado | idem | 1 teste |

---

## Bloco F — Integração

### 12.18 — `RichText` + `RichTextFactory` + integração com parser

**⚠️ RUBY: `RichText.rb` (arquivo inteiro — ~250 linhas)**

**Pré-requisitos:** 12.1–12.17.

#### 12.18.1 — `RichText`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.18.1.1 | Criar `packages/richtext/src/rich-text.ts` com `class RichText` | idem | `deno check` |
| 12.18.1.2 | Campos: `readonly inputText: string`, `private functionHandlers`, `static parser: RichTextParser \| null` | idem | `deno check` |
| 12.18.1.3 | Constructor `(text: string, functionHandlers: RichTextFunctionHandler[] = [])` | idem | 3 testes |
| 12.18.1.4 | ⚠️ `generateIntermediateFormat(sectionCounter = [0,0,0,0], tokenSet: string[] \| null = null): RichTextIntermediate \| null` | idem | 4 testes |
| 12.18.1.5 | Cria `RichTextIntermediate` e copia function handlers | idem | 2 testes |
| 12.18.1.6 | ⚠️ Reusa ou cria `RichText.parser` (singleton) via `reuse` | idem | 3 testes |
| 12.18.1.7 | `parser.open(text)`, `parser.parse('richtext')` | idem | 2 testes |
| 12.18.1.8 | Se `false`, retorna `null` | idem | 2 testes |
| 12.18.1.9 | `tree.cleanUp()`; atribui a `rti.tree` | idem | 2 testes |
| 12.18.1.10 | ⚠️ `functionHandler(name, block): RichTextFunctionHandler \| null` | idem | 2 testes |

#### 12.18.2 — `RichTextFactory`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.18.2.1 | Criar `packages/richtext/src/factory.ts` com `class RichTextFactoryImpl implements RichTextFactory` | idem | `deno check` |
| 12.18.2.2 | Constructor `(project, sfi)` | idem | 1 teste |
| 12.18.2.3 | ⚠️ `create(text: string): RichTextIntermediate` — cria `RichText` com `RTFHandlers.create`, chama `generateIntermediateFormat` | idem | 3 testes |
| 12.18.2.4 | Se `null`, lança `TjArgumentError` | idem | 1 teste |

#### 12.18.3 — Integração com `ProjectFileParser`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.18.3.1 | Adicionar setter `setRichTextFactory(factory: RichTextFactory)` em `ProjectFileParser` | `packages/parser/src/parser/project-file-parser.ts` | 2 testes |
| 12.18.3.2 | ⚠️ `newRichText(text, sfi, tokenSet)` usa `this.richTextFactory.create(text)` | idem | 3 testes |
| 12.18.3.3 | `packages/richtext/mod.ts` exporta `RichTextFactoryImpl` | idem | `deno check` |
| 12.18.3.4 | Smoke test: parser cria `RichText` real (não stub) | idem | 1 teste |

---

## Bloco G — Golden tests

### 12.19 — Golden tests (RichText)

**⚠️ RUBY: `TestSuite/RichText/*.rb` (se existir) ou markup de exemplo**

**Pré-requisitos:** 12.18.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 12.19.1 | Atualizar `scripts/golden/README.md` com seção de `richtext` | idem | existe |
| 12.19.2 | Criar `scripts/golden/richtext.rb` — itera sobre `docs/taskjuggler/test/TestSuite/RichText/` (se existir) ou markup de exemplo | idem | roda |
| 12.19.3 | Para cada arquivo: cria `RichText.new(content)`, gera `rti`, serializa `input`/`plain`/`tagged`/`html` | idem | ≥ 30 casos |
| 12.19.4 | Serializa em `richtext.golden.json` | idem | JSON válido |
| 12.19.5 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 12.19.6 | Criar `packages/richtext/tests/golden/richtext_golden_test.ts` | idem | verde |
| 12.19.7 | Para cada caso: `plain`, `tagged`, `html` comparados | idem | ≥ 30 casos |
| 12.19.8 | Tolerância: normalizar whitespace em `to_s`; HTML byte-a-byte | idem | 3 testes |
| 12.19.9 | Cobertura ≥ 30 casos; commitar JSON em `packages/richtext/tests/golden/` | idem | versionado |
| 12.19.10 | Teste de regressão: rodar novamente e comparar | idem | 1 teste |

---

## Bloco H — Verificação final

### 12.20 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 12.20.1 | `deno task check-all` verde | exit 0 |
| 12.20.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 12.20.3 | `grep -r "NotYetImplementedError" packages/richtext/src/` — apenas `RTFReport`, `RTFReportLink`, `RTFNavigator` | ≤ 3 ocorrências |
| 12.20.4 | ADR 024 criada e commitada | git log |
| 12.20.5 | `RichText`, `RichTextIntermediate`, `RichTextElement`, `RichTextFactoryImpl`, `RTFHandlers` exportados em `packages/richtext/mod.ts` | `deno check` |
| 12.20.6 | `ProjectFileParser.setRichTextFactory` funcional | 1 teste |
| 12.20.7 | `tests/integration/smoke_after_phase_12_test.ts` — cria `RichText`, gera `rti`, verifica `to_s`; verifica Fase 11 (`Query`) | 1 teste |
| 12.20.8 | Auditoria: cada subfase do plano `fase-12-richtext.md` tem tarefas correspondentes | grep |
| 12.20.9 | Corrigir numeração em `fase-12-richtext.md` (`### 16.X` → `### 12.X`, `ADR 023` → `ADR 024`) | grep |
| 12.20.10 | Smoke test: parser cria `RichText` real (não stub) | 1 teste |

---

## Notas para a IA

1. **Ordem:** 12.0 → 12.1 → 12.2 → 12.4 → 12.3 (referência circular) → 12.5 → 12.6 → 12.7 → 12.8 → 12.9 → 12.10 → 12.11 → 12.12 → 12.13 → 12.14 → 12.15 → 12.16 → 12.17 → 12.18 → 12.19 → 12.20.
   - Exceção: 12.11 (`RichTextFunctionHandler`) pode rodar antes de 12.4.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura do arquivo inteiro.
3. **`RichTextParser` herda de `TextParser`.** Não recriar.
4. **`RichTextScanner` herda de `Scanner`.**
5. **`RichText.@@parser` é singleton.** Cuidado com estado entre chamadas.
6. **`RichTextIntermediate.setQuery` propaga para handlers.**
7. **`RTFQuery` usa `Query` (Fase 11).**
8. **`RTFReport`, `RTFReportLink`, `RTFNavigator` são stubs.** Fase 14 completa.
9. **`XMLElementLike` substituído na Fase 17.** Não vazar dependência.
10. **`sectionNumbers` afeta `to_s`.** Testar ambos os modos.
11. **`str.each_utf8_char` → `for (const c of str)`.**
12. **Regex multiline: usar `m` flag com cuidado.**
13. **`RichTextFactory` substitui stub da Fase 10.** Aviso ao parser.
14. **`generateIntermediateFormat` pode retornar `null`.**
15. **`children_to_s` concatena com espaços.** `appendSpace` controla.
16. **Sem `any`.** Use `unknown` + type guards.
17. **Commit por subfase.** `feat(richtext): rich-text-element`, `feat(richtext): rtf-query`, etc.
18. **ADR 024** (não 023). **ADR 023** é expressões lógicas (Fase 11).
19. **`XMLElementLike` é interface; `SimpleXMLElement` é implementação mínima.** Fase 17 substitui.
20. **`to_html` retorna `XMLElementLike`.** Não string.

---

## Notas específicas por subfase

### 12.0 — ADR 024

- **Documenta o reuso de `TextParser`.**
- **Documenta function handlers.**
- **Nota sobre stubs de `RTFReport`/`RTFReportLink`/`RTFNavigator`.**

### 12.1 — XMLElementLike

- **Interface + implementação mínima.**
- **Fase 17 substitui `SimpleXMLElement` por `XMLElement` real.**
- **`toHTML` escapa `&`, `<`, `>`, `"`.**

### 12.2 — RichTextImage

- **Trivial.** Só 3 campos + mutabilidade.

### 12.3 — RichTextElement

- **Nó da árvore.**
- **Muitas categorias.** ~20.
- **`to_s`, `to_html`, `to_tagged` com dispatch.**
- **`cleanUp` promove children quando `richtext` tem 1 parágrafo.**

### 12.4 — RichTextIntermediate

- **Container da árvore.**
- **`setQuery` propaga.**
- **`tableOfContents`, `internalReferences` delegam para `tree`.**

### 12.5 — RichTextScanner

- **Herdar de `Scanner` (Fase 10).**
- **7 modos.**
- **~20 tokens.**
- **Handlers de modo mudam o estado do scanner.**

### 12.6 — RichTextParser

- **Herdar de `TextParser`.**
- **~20 regras (`rule_*`).**
- **`reuse` para singleton.**

### 12.7 — TOCEntry

- **Simples.** `to_html` gera lista por nível.

### 12.8 — TableOfContents

- **Lista de entradas.**
- **Iterável.**

### 12.9 — RichTextSnip

- **Fragmento de markup.**
- **Encadeia `prevSnip`/`nextSnip`.**

### 12.10 — RichTextDocument

- **Abstract.**
- **`addSnip` encadeia.**
- **Subclasses implementam `generateHTMLCover`, etc.**

### 12.11 — RichTextFunctionHandler

- **Abstract.**
- **`dup` para singleton.**

### 12.12 — RichTextFunctionExample

- **Handler `[[example:...]]`.**
- **Carrega `.tjp`, extrai snippet.**

### 12.13 — RTFWithQuerySupport

- **Base para handlers que usam `Query`.**

### 12.14 — RTFQuery

- **Handler `[[query:...]]`.**
- **`prepareQuery` valida args.**
- **Usa `Query` (Fase 11).**

### 12.15–12.16 — Stubs

- **`RTFReport`, `RTFReportLink`.** Fase 14.

### 12.17 — RTFNavigator + RTFHandlers

- **`RTFNavigator` é stub.**
- **`RTFHandlers.create` factory.**

### 12.18 — Integração

- **`RichText` top-level.**
- **`RichTextFactoryImpl`.**
- **`ProjectFileParser.setRichTextFactory`.**

### 12.19 — Golden tests

- **Markup de exemplo.**
- **`plain`, `tagged`, `html`.**

### 12.20 — Verificação

- **Sem stubs além de `RTFReport`, `RTFReportLink`, `RTFNavigator`.**
- **ADR 024 (não 023).**

---

**Fim do arquivo de tarefas da Fase 12.**